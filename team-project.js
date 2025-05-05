let gl, program;
let vertexCount;
let track = [];
let carPosition = 0.0;
let carSpeed = 0.002;
let controlPointQuaternions = [];
let cartDistance = 0;
const cartScale = 2.5;




//physics variables
let mass= 1.0;
let gravity = 100;

let energy = 0.0;
let trackLength = 0.0;

let lastTime = null;
let curve3D       = [];
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

function main()
{
	// Retrieve <canvas> element
	let canvas = document.getElementById('webgl');
	if (!canvas) {
		return;
	}

	// Get the rendering context for WebGL
	gl = WebGLUtils.setupWebGL(canvas, null);

	// Initialize shaders
	program = initShaders(gl, "vshader", "fshader");
	if (!program) {
		return;
	}
	gl.useProgram(program);

	//Set up the viewport
	gl.viewport( 0, 0, canvas.width, canvas.height );

	let cameraMatrix = lookAt(vec3(0.0, 0.0, 2.0), vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));
	let projMatrix = perspective(120, 1, 0.1, 10);

	setUniformMatrix("cameraMatrix", cameraMatrix);
	setUniformMatrix("projMatrix", projMatrix);


	const fileInput = document.getElementById("files");
	const mySpline = new Spline();
	fileInput.addEventListener("change", function(event) {
		const reader = new FileReader();
		reader.onload = function(e) {
			const fileContents = e.target.result;
			mySpline.parse(fileContents);
			const catmullPoints = mySpline.generateCatmullRomCurve();
			curve3D = catmullPoints;


			// Auto-scale and center the track

			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const p of catmullPoints) {
				if (p.x < minX) minX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.x > maxX) maxX = p.x;
				if (p.y > maxY) maxY = p.y;
			}
			const width = maxX - minX;
			const height = maxY - minY;
			const canvasSize = 650;
			const margin = 40;
			const scale = Math.min(
				(canvasSize - margin * 2) / width,
				(canvasSize - margin * 2) / height
			);
			const offset = vec2(
				(canvasSize - scale * width) / 2 - scale * minX,
				(canvasSize - scale * height) / 2 - scale * minY
			);
			track = catmullPoints.map(p =>
				add(vec2(p.x * scale, p.y * scale), offset)
			);
			vertexCount = track.length;

			trackLength = 0;

			for (let i = 1; i < track.length; i++) {
				const dx = track[i][0] - track[i-1][0];
				const dy = track[i][1] - track[i-1][1];
				trackLength += Math.hypot(dx, dy);

			}

			lastTime = performance.now();
			initialHeight = curve3D[0].z;
			energy = mass * gravity * initialHeight;

			controlPointQuaternions = mySpline.controlPoints.map(point =>
				eulerToQuaternion(point.rotation.x, point.rotation.y, point.rotation.z)
			);
		};
		reader.readAsText(event.target.files[0]);
	});


	render();
}

function render() {
	const now = performance.now();
	const dt  = lastTime ? (now - lastTime) / 1000 : 0;
	lastTime  = now;
	
	// Clear the canvas
	gl.clearColor(1.0, 1.0, 1.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Use orthographic projection that matches track coordinates
	let projMatrix = ortho(0, 1125, 0, 1125, -1, 1);

	// Use identity camera matrix
	setUniformMatrix("cameraMatrix", mat4());
	setUniformMatrix("projMatrix", projMatrix);

	// Log attribute locations
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
		const pNext = track[(idx + 1) % track.length];
		const tangent = [pNext[0] - p[0], pNext[1] - p[1]];

		const cartYOffset = 7.5 * cartScale;


		const cpCount = controlPointQuaternions.length;
		const uQ      = carPosition * (cpCount - 1);
		const iQ      = Math.floor(uQ);
		const jQ      = (iQ + 1) % cpCount;
		const tQ      = uQ - iQ;

		//SLERP
		const qInterp  = slerp(
			controlPointQuaternions[iQ],
			controlPointQuaternions[jQ],
			tQ
		);
		const orientMat = quatToMatrix(qInterp);

		// build 3D model matrix and draw:
		const modelMat = mult(
			translate(p[0], p[1], 0),
			orientMat,
			translate(0, cartYOffset, 0),
			scalem(cartScale, cartScale, cartScale)
		);
		setUniformMatrix("modelMatrix", modelMat);




		// Calculate distance traveled for wheel animation
		const prevIdx = (idx - 1 + track.length) % track.length;
		const prevP = track[prevIdx];
		const segmentDist = Math.sqrt(Math.pow(p[0] - prevP[0], 2) + Math.pow(p[1] - prevP[1], 2));
		cartDistance += segmentDist * carSpeed;
		const wheelCircumference = 2 * Math.PI * 3; // r=3
		const wheelAngle = (cartDistance / wheelCircumference) * 360;
		setUniformMatrix("modelMatrix", modelMat);
		drawCoasterCar(modelMat, wheelAngle);
		
		// Draw the rider skeleton on top of the cart
		drawRiderSkeleton(modelMat, performance.now() / 1000);
		
		// Update car position
		if (curve3D.length > 1 && trackLength > 0) {
			// Find where we are on the 3D curve

			const u3 = carPosition * (curve3D.length - 1);
			const i3 = Math.floor(u3);
			const j3 = (i3 + 1) % curve3D.length;
			const t3 = u3 - i3;


			// Interpolate the current height
			const z0    = curve3D[i3].z;
			const z1    = curve3D[j3].z;
			const zCurr = z0 * (1 - t3) + z1 * t3;


			// Use local slope for speed
			const dz = z1 - z0;
			const baseSpeed = 50; 
			const speed = Math.max(baseSpeed - 3 * gravity * dz, 20); 
			console.log('Cart speed:', speed.toFixed(2), 'pixels/sec, dz:', dz.toFixed(2), 'zCurr:', zCurr.toFixed(2));
			const frac = speed * dt / trackLength;
			carPosition = (carPosition + frac) % 1;
		}
	}
	
	let error = gl.getError();
	if (error !== gl.NO_ERROR) {
		console.error('WebGL error:', error);
	}
	
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

function quatToMatrix(q) {
	const [x, y, z, w] = q;
	return new mat4(
		1 - 2 * (y * y + z * z), 2 * (x * y - w * z),     2 * (x * z + w * y),     0,
		2 * (x * y + w * z),     1 - 2 * (x * x + z * z), 2 * (y * z - w * x),     0,
		2 * (x * z - w * y),     2 * (y * z + w * x),     1 - 2 * (x * x + y * y), 0,
		0,                       0,                       0,                       1
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