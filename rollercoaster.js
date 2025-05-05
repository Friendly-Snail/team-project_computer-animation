let gl, program;
let vertexCount;
let track = [];
let carPosition = 0.0;
let controlPointQuaternions = [];
let cartDistance = 0;
const cartScale = 2.5;

// physics variables
let mass = 1.0;
let gravity = 100;

// shape‐deformation tuning: higher = more dramatic stretch/squash
const deformationIntensity = 5.0;

let lastTime = null;
let curve3D = [];
let initialHeight = 0;

// speed slider multiplier (1.0 = nominal speed)
let speedMultiplier = 1.0;

// Rider Skeleton Definition (unchanged)
const riderSkeleton = [
	{ name: "root", parent: null, length: 0, angle: 0 },
	{ name: "torso", parent: "root", length: 20, angle: 0 },
	{ name: "head", parent: "torso", length: 8, angle: 0 },
	{ name: "leftArm", parent: "torso", length: 15, angle: 0 },
	{ name: "rightArm", parent: "torso", length: 15, angle: 0 },
	{ name: "leftLeg", parent: "root", length: 15, angle: 45 },
	{ name: "rightLeg", parent: "root", length: 15, angle: -45 }
];

function main() {
	// setup canvas and WebGL
	const canvas = document.getElementById('webgl');
	if (!canvas) return;
	gl = WebGLUtils.setupWebGL(canvas);
	program = initShaders(gl, "vertex-shader", "fragment-shader");
	gl.useProgram(program);
	gl.viewport(0, 0, canvas.width, canvas.height);

	// camera + projection (unchanged)
	const cameraMatrix = lookAt(
		vec3(0,0,2),
		vec3(0,0,0),
		vec3(0,1,0)
	);
	const projMatrix = perspective(120, 1, 0.1, 10);
	setUniformMatrix("cameraMatrix", cameraMatrix);
	setUniformMatrix("projMatrix", projMatrix);

	// hook up speed slider
	const speedSlider = document.getElementById('speed-slider');
	speedSlider.addEventListener('input', e => {
		speedMultiplier = parseFloat(e.target.value);
	});

	// file input for spline
	const fileInput = document.getElementById("files");
	const mySpline  = new Spline();
	fileInput.addEventListener("change", ev => {
		const reader = new FileReader();
		reader.onload = e => {
			mySpline.parse(e.target.result);
			curve3D = mySpline.generateCatmullRomCurve();

			// compute 2D bounding box & auto-scale/center
			let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
			for (let p of curve3D) {
				minX = Math.min(minX, p.x);
				minY = Math.min(minY, p.y);
				maxX = Math.max(maxX, p.x);
				maxY = Math.max(maxY, p.y);
			}
			const width  = maxX - minX;
			const height = maxY - minY;
			const cw = canvas.width, ch = canvas.height;
			const margin = 40;
			const scale = Math.min((cw - margin*2)/width, (ch - margin*2)/height);
			const offset = vec2(
				(cw - scale*width)/2  - scale*minX,
				(ch - scale*height)/2 - scale*minY
			);

			track = curve3D.map(p => add(vec2(p.x*scale, p.y*scale), offset));
			vertexCount = track.length;

			// compute 2D track length
			trackLength = 0;
			for (let i=1; i<track.length; i++) {
				const dx = track[i][0] - track[i-1][0];
				const dy = track[i][1] - track[i-1][1];
				trackLength += Math.hypot(dx,dy);
			}

			// init physics & SLERP quaternions
			lastTime = performance.now();
			initialHeight = curve3D[0].z;
			controlPointQuaternions = mySpline.controlPoints.map(pt =>
				eulerToQuaternion(pt.rotation.x, pt.rotation.y, pt.rotation.z)
			);
		};
		reader.readAsText(ev.target.files[0]);
	});

	// start render loop
	render();
}

function render() {
	const now = performance.now();
	const dt = lastTime ? (now - lastTime) / 1000 : 0;
	lastTime = now;

	// clear
	gl.clearColor(1, 1, 1, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// update to full‐canvas ortho projection
	const cw = gl.canvas.width, ch = gl.canvas.height;
	const orthoM = ortho(0, cw, 0, ch, -1, 1);
	setUniformMatrix("cameraMatrix", mat4());
	setUniformMatrix("projMatrix", orthoM);

	if (vertexCount > 0) {
		// draw the track
		setUniformMatrix("modelMatrix", mat4());
		setAttributes(track, new Array(track.length).fill(vec4(1, 0, 0, 1)), 2, 4);
		gl.drawArrays(gl.LINE_STRIP, 0, vertexCount);

		// find current segment on 2D track
		const idx = Math.floor(carPosition * (track.length - 1));
		const p = track[idx];
		const prevIdx = (idx - 1 + track.length) % track.length;
		const pPrev = track[prevIdx];

		// compute world‐space speed along the 3D spline
		const u3 = carPosition * (curve3D.length - 1);
		const i3 = Math.floor(u3), j3 = (i3 + 1) % curve3D.length;
		const z0 = curve3D[i3].z, z1 = curve3D[j3].z;
		const dz = z1 - z0;
		const baseSpeed = 50;
		const speed = Math.max(baseSpeed - 3 * gravity * dz, 20) * speedMultiplier;

		// advance along track
		carPosition = (carPosition + speed * dt / trackLength) % 1;

		// SLERP for bank/orientation
		const cpCount = controlPointQuaternions.length;
		const uQ = carPosition * (cpCount - 1);
		const iQ = Math.floor(uQ), jQ = (iQ + 1) % cpCount, tQ = uQ - iQ;
		const qInterp = slerp(controlPointQuaternions[iQ], controlPointQuaternions[jQ], tQ);
		const orientMat = quatToMatrix(qInterp);

		// wheels spin
		const segmentDist = Math.hypot(p[0] - pPrev[0], p[1] - pPrev[1]);
		cartDistance += segmentDist * speedMultiplier;
		const wheelAngle = (cartDistance / (2 * Math.PI * 3)) * 360;

		// shape deformation based on track curvature
		const nextIdx = (idx + 1) % track.length;
		const pNext = track[nextIdx];

		// compute unit direction vectors
		let v1 = subtract(p, pPrev); normalize(v1);
		let v2 = subtract(pNext, p); normalize(v2);

		// angle between segments -> [0, pi], normalize to [0,1]
		const cosTheta = v1[0] * v2[0] + v1[1] * v2[1];
		const theta = Math.acos(Math.min(Math.max(cosTheta, -1), 1));
		const curvature = theta / Math.PI;

		// drive stretch/squash
		const stretchFactor = 1 + curvature * deformationIntensity;
		const squashFactor = 1 / stretchFactor;

		// build the cart’s model matrix with squash & stretch
		const cartYOffset = 7.5 * cartScale;
		const modelMat = mult(
			translate(p[0], p[1], 0),
			orientMat,
			translate(0, cartYOffset, 0),
			// squash in X, stretch in Y
			scalem(
				cartScale * squashFactor,
				cartScale * stretchFactor,
				cartScale
			)
		);

		setUniformMatrix("modelMatrix", modelMat);
		drawCoasterCar(modelMat, wheelAngle);
		drawRiderSkeleton(modelMat, now / 1000);
	}

	// schedule next frame
	requestAnimationFrame(render);
}

function setAttributes(positions, colors, posLength = 2, colorLength = 4) {
	let pBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, pBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW);
	let aLoc = gl.getAttribLocation(program, "vPosition");
	if (aLoc !== -1) {
		gl.vertexAttribPointer(aLoc, posLength, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(aLoc);
	}
	let cBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
	let cLoc = gl.getAttribLocation(program, "vColor");
	if (cLoc !== -1) {
		gl.vertexAttribPointer(cLoc, colorLength, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(cLoc);
	}
}

function setUniformMatrix(name, data) {
	let matrixLoc = gl.getUniformLocation(program, name);
	gl.uniformMatrix4fv(matrixLoc, false, flatten(data));
}


function slerp(q1, q2, t) {

	let dotProd = q1[0]*q2[0] + q1[1]*q2[1] + q1[2]*q2[2] + q1[3]*q2[3];


	// Calculate angle
	let theta = Math.acos(dotProd);
	let sinTheta = Math.sin(theta);

	let scale1 = Math.sin((1 - t) * theta) / sinTheta;
	let scale2 = Math.sin(t * theta) / sinTheta;


	return vec4(
		scale1 * q1[0] + scale2 * q2[0],
		scale1 * q1[1] + scale2 * q2[1],
		scale1 * q1[2] + scale2 * q2[2],
		scale1 * q1[3] + scale2 * q2[3]
	);
}

// Draw a visible black rectangle for the cart
function drawCoasterCar(cartModelMatrix, wheelAngle = 0) {
	// Draw the cart body (rectangle)
	setUniformMatrix("modelMatrix", cartModelMatrix);
	const carVertices = [
		vec2(-5 * cartScale, -5 * cartScale),
		vec2( 5 * cartScale, -5 * cartScale),
		vec2( 5 * cartScale,  5 * cartScale),
		vec2(-5 * cartScale,  5 * cartScale)
	];
	const carColors = [
		vec4(0, 0, 0, 1),
		vec4(0, 0, 0, 1),
		vec4(0, 0, 0, 1),
		vec4(0, 0, 0, 1)
	];
	setAttributes(carVertices, carColors, 2, 4);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, carVertices.length);

	// Draw wheels (bottom left and top left)
	const wheelOffsets = [

		[-5 * cartScale, -7.5 * cartScale],
		[-5 * cartScale,  7.5 * cartScale]

	];
	const wheelRadius = 3 * cartScale;
	for (const [dx, dy] of wheelOffsets) {
		// Wheel's model matrix: cart's model matrix * translate to wheel offset * rotate for spin
		let wheelMat = mult(cartModelMatrix, mult(translate(dx, dy, 0), rotate(wheelAngle, 0, 0, 1)));
		setUniformMatrix("modelMatrix", wheelMat);
		// Draw wheel as a circle
		const circleVerts = [];
		const circleColors = [];
		for (let i = 0; i <= 20; ++i) {
			const theta = (i / 20) * 2 * Math.PI;
			circleVerts.push(vec2(
				wheelRadius * Math.cos(theta),
				wheelRadius * Math.sin(theta)
			));
			circleColors.push(vec4(0.2, 0.2, 0.2, 1));
		}
		setAttributes(circleVerts, circleColors, 2, 4);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, circleVerts.length);
	}
}

// Quaternion helper: Euler angles to quaternion
function eulerToQuaternion(x, y, z) {
	x = x * Math.PI / 180;
	y = y * Math.PI / 180;
	z = z * Math.PI / 180;
	const c1 = Math.cos(x/2);
	const c2 = Math.cos(y/2);
	const c3 = Math.cos(z/2);
	const s1 = Math.sin(x/2);
	const s2 = Math.sin(y/2);
	const s3 = Math.sin(z/2);
	return vec4(
		s1 * c2 * c3 + c1 * s2 * s3,
		c1 * s2 * c3 - s1 * c2 * s3,
		c1 * c2 * s3 + s1 * s2 * c3,
		c1 * c2 * c3 - s1 * s2 * s3
	);
}

// Draw the rider skeleton on top of the cart
function drawRiderSkeleton(modelMatrix, time) {
	// Animate arms and head

	const armSwing = Math.sin(time * 2) * 45;
	const headBob = Math.sin(time * 2) * 10;


	// Compute world positions for each joint
	const positions = { root: [0, 10] };
	const angles = {
		root: 0,
		torso: 0,
		head: headBob,
		leftArm: -60 + armSwing,
		rightArm: 60 - armSwing,
		leftLeg: 45,
		rightLeg: -45
	};

	// Helper to get endpoint of a bone
	function endpoint(start, angleDeg, length) {
		const rad = angleDeg * Math.PI / 180;
		return [
			start[0] + length * Math.cos(rad),
			start[1] + length * Math.sin(rad)
		];
	}

	// Torso
	positions.torso = endpoint(positions.root, angles.torso + angles.root, 20);
	// Head
	positions.head = endpoint(positions.torso, angles.head + angles.torso + angles.root, 8);
	// Left Arm
	positions.leftArm = endpoint(positions.torso, angles.leftArm + angles.torso + angles.root, 15);
	// Right Arm
	positions.rightArm = endpoint(positions.torso, angles.rightArm + angles.torso + angles.root, 15);
	// Left Leg
	positions.leftLeg = endpoint(positions.root, angles.leftLeg + angles.root, 15);
	// Right Leg
	positions.rightLeg = endpoint(positions.root, angles.rightLeg + angles.root, 15);

	// Draw bones as lines
	const lines = [
		// [start, end, color]
		[positions.root, positions.torso, vec4(0,0,0,1)],
		[positions.torso, positions.head, vec4(0,0,0,1)],
		[positions.torso, positions.leftArm, vec4(0,0,0,1)],
		[positions.torso, positions.rightArm, vec4(0,0,0,1)],
		[positions.root, positions.leftLeg, vec4(0,0,0,1)],
		[positions.root, positions.rightLeg, vec4(0,0,0,1)]
	];

	for (const [start, end, color] of lines) {
		setUniformMatrix("modelMatrix", modelMatrix);
		setAttributes([vec2(start[0], start[1]), vec2(end[0], end[1])], [color, color], 2, 4);
		gl.drawArrays(gl.LINES, 0, 2);
	}

	// Draw head as a circle (approximate with a triangle fan)
	const headCenter = positions.head;
	const headRadius = 4;
	const circleVerts = [];
	const circleColors = [];
	for (let i = 0; i <= 20; ++i) {
		const theta = (i / 20) * 2 * Math.PI;
		circleVerts.push(vec2(
			headCenter[0] + headRadius * Math.cos(theta),
			headCenter[1] + headRadius * Math.sin(theta)
		));
		circleColors.push(vec4(0,0,0,1));
	}
	setUniformMatrix("modelMatrix", modelMatrix);
	setAttributes(circleVerts, circleColors, 2, 4);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, circleVerts.length);
}

window.addEventListener('load', main);