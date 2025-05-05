let gl, program;
let vertexCount;
let track = [];
let carPosition = 0.0;
let carSpeed = 0.002;
let controlPointQuaternions = [];
let cartDistance = 0;
const cartScale = 2.5;

// physics variables
let mass = 1.0;
let gravity = 100;

let energy = 0.0;
let trackLength = 0.0;

let lastTime = null;
let curve3D = [];
let initialHeight = 0;

// Rider Skeleton Definition
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
	// Retrieve <canvas> element
	let canvas = document.getElementById('webgl');
	if (!canvas) {
		return;
	}

	// Get the rendering context for WebGL
	gl = WebGLUtils.setupWebGL(canvas, null);

	// Initialize shaders
	program = initShaders(gl, "vertex-shader", "fragment-shader");
	if (!program) return;
	gl.useProgram(program);

	// Set up the viewport
	gl.viewport(0, 0, canvas.width, canvas.height);

	// set up the camera view matrix (eye, at, up)
	let cameraMatrix = lookAt(
		vec3(0.0, 0.0, 2.0),  // eye position (camera)
		vec3(0.0, 0.0, 0.0),  // point looking at
		vec3(0.0, 1.0, 0.0)   // up vector
	);

	// set up a perspective projection (FOV, aspect, near, far)
	let projMatrix = perspective(120, 1, 0.1, 10);

	// pass matrices to the shaders as uniforms
	setUniformMatrix("cameraMatrix", cameraMatrix);
	setUniformMatrix("projMatrix", projMatrix);

	// set up file input handling for spline upload
	const fileInput = document.getElementById("files");
	const mySpline = new Spline();

	// when a file is selected:
	fileInput.addEventListener("change", function(event) {
		const reader = new FileReader();

		reader.onload = function(e) {
			// read and parse the spline file content
			const fileContents = e.target.result;
			mySpline.parse(fileContents); // Populate controlPoints

			// generate interpolated points along the spline using Catmull-Rom
			const catmullPoints = mySpline.generateCatmullRomCurve();
			curve3D = catmullPoints; // 3D points for speed and elevation

			// calculate bounding box of the curve for scaling and centering
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const p of catmullPoints) {
				if (p.x < minX) minX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.x > maxX) maxX = p.x;
				if (p.y > maxY) maxY = p.y;
			}

			// auto-scale and center the track inside canvas
			const width = maxX - minX;
			const height = maxY - minY;
			const cw = canvas.width;
			const ch = canvas.height;
			const margin = 40;
			const scale = Math.min(
				(cw - margin * 2) / width,
				(ch - margin * 2) / height
			);
			const offset = vec2(
				(cw - scale * width)  / 2 - scale * minX,
				(ch - scale * height) / 2 - scale * minY
			);

			// store 2D track points (scaled and centered) for rendering
			track = catmullPoints.map(p =>
				add(vec2(p.x * scale, p.y * scale), offset)
			);
			vertexCount = track.length;

			// compute total length of the 2D track
			trackLength = 0;
			for (let i = 1; i < track.length; i++) {
				const dx = track[i][0] - track[i-1][0];
				const dy = track[i][1] - track[i-1][1];
				trackLength += Math.hypot(dx, dy);
			}

			// initialize physics: set energy based on initial height (z-axis)
			lastTime = performance.now();
			initialHeight = curve3D[0].z;
			energy = mass * gravity * initialHeight;

			// convert euler angles to quaternions for SLERP-based rotation
			controlPointQuaternions = mySpline.controlPoints.map(point =>
				eulerToQuaternion(point.rotation.x, point.rotation.y, point.rotation.z)
			);
		};

		// read the selected file as text
		reader.readAsText(event.target.files[0]);
	});

	// start the rendering loop
	render();
}

function render() {
	const now = performance.now();
	const dt  = lastTime ? (now - lastTime) / 1000 : 0;
	lastTime  = now;

	// Clear the canvas
	gl.clearColor(1.0, 1.0, 1.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// use orthographic projection that matches track coordinates
	const cw = gl.canvas.width;
	const ch = gl.canvas.height;
	let projMatrix = ortho(0, cw, 0, ch, -1, 1);

	// use identity camera matrix
	setUniformMatrix("cameraMatrix", mat4());
	setUniformMatrix("projMatrix", projMatrix);

	// log attribute locations
	let posLoc = gl.getAttribLocation(program, "vPosition");
	let colLoc = gl.getAttribLocation(program, "vColor");

	if (vertexCount > 0) {
		// Draw the track in red
		setUniformMatrix("modelMatrix", mat4());
		const trackColors = new Array(track.length).fill(vec4(1, 0, 0, 1));
		setAttributes(track, trackColors, 2, 4);
		gl.drawArrays(gl.LINE_STRIP, 0, vertexCount);

		// Get the current and next point on the track
		const idx = Math.floor(carPosition * (track.length - 1));
		const p = track[idx];

		const cartYOffset = 7.5 * cartScale;

		const cpCount = controlPointQuaternions.length;
		const uQ = carPosition * (cpCount - 1);
		const iQ = Math.floor(uQ);
		const jQ = (iQ + 1) % cpCount;
		const tQ = uQ - iQ;

		// SLERP
		const qInterp  = slerp(
			controlPointQuaternions[iQ],
			controlPointQuaternions[jQ],
			tQ
		);
		const orientMat = quatToMatrix(qInterp);

		// calculate previous & next indices for stretch/squash
		const prevIdx = (idx - 1 + track.length) % track.length;
		const nextIdx = (idx + 1) % track.length;
		const pPrev = track[prevIdx];
		const pNext = track[nextIdx];

		// calculate vectors between points
		const v1 = [p[0] - pPrev[0], p[1] - pPrev[1]];
		const v2 = [pNext[0] - p[0], pNext[1] - p[1]];

		// calculate angle between vectors
		const dot = v1[0]*v2[0] + v1[1]*v2[1];
		const mag1 = Math.hypot(v1[0], v1[1]);
		const mag2 = Math.hypot(v2[0], v2[1]);
		const cosA = dot / (mag1 * mag2);
		const angle = Math.acos(Math.max(-1, Math.min(1, cosA)));

		// dramatic stretch/squash
		const stretchFactor = 1.0 + (angle * 5000);
		const squashFactor  = 1.0 / (stretchFactor * 10);

		const deformMatrix = scalem(
			cartScale * squashFactor,
			cartScale * stretchFactor,
			cartScale
		);

		// build final model matrix with deformation
		const modelMat = mult(
			translate(p[0], p[1], 0), // position on track
			orientMat, // orientation
			translate(0, cartYOffset, 0), // offset from track
			deformMatrix // apply deformation
		);

		setUniformMatrix("modelMatrix", modelMat);

		// wheel animation
		const segmentDist = Math.hypot(p[0] - pPrev[0], p[1] - pPrev[1]);
		cartDistance += segmentDist * carSpeed;
		const wheelCircumference = 2 * Math.PI * 3; // r=3
		const wheelAngle = (cartDistance / wheelCircumference) * 360;

		// Draw the cart with deformation
		drawCoasterCar(modelMat, wheelAngle);

		// Draw the rider skeleton on top of the cart
		drawRiderSkeleton(modelMat, performance.now() / 1000);

		// update care position along the 3D curve
		if (curve3D.length > 1 && trackLength > 0) {
			const u3 = carPosition * (curve3D.length - 1);
			const i3 = Math.floor(u3);
			const j3 = (i3 + 1) % curve3D.length;
			const t3 = u3 - i3;

			const z0 = curve3D[i3].z;
			const z1 = curve3D[j3].z;
			const dz = z1 - z0;

			const baseSpeed = 50;
			const speed = Math.max(baseSpeed - 3 * gravity * dz, 20);
			const frac = speed * dt / trackLength;
			carPosition = (carPosition + frac) % 1;
		}
	}

	// check and report any WebGL errors
	let error = gl.getError();
	if (error !== gl.NO_ERROR) {
		console.error('WebGL error:', error);
	}

	// schedule the next animation frame
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