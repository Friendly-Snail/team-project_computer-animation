let gl, program;
let vertexCount;
let track = [];
let carPosition = 0.0;
let carSpeed = 0.002;
let controlPointQuaternions = [];

function main()
{
	console.log('Starting main()');
	
	// Retrieve <canvas> element
	let canvas = document.getElementById('webgl');
	if (!canvas) {
		console.error('Canvas element not found!');
		return;
	}
	console.log('Canvas found:', canvas);

	// Get the rendering context for WebGL
	gl = WebGLUtils.setupWebGL(canvas, null);
	console.log('WebGL context created:', gl);
	console.log('Canvas size:', canvas.width, canvas.height);
	
	//Check that the return value is not null.
	if (!gl) 
	{
		console.error('Failed to get the rendering context for WebGL');
		return;
	}

	// Initialize shaders
	program = initShaders(gl, "vshader", "fshader");
	if (!program) {
		console.error('Failed to initialize shaders');
		return;
	}
	console.log('Shaders initialized');
	gl.useProgram(program);

	//Set up the viewport
	gl.viewport( 0, 0, canvas.width, canvas.height );
	console.log('Viewport set to:', canvas.width, canvas.height);

	let cameraMatrix = lookAt(vec3(0.0, 0.0, 2.0), vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));
	let projMatrix = perspective(120, 1, 0.1, 10);

	// Debug logging for matrices
	console.log('Camera Matrix:', cameraMatrix);
	console.log('Projection Matrix:', projMatrix);

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
			// Scale and center the track for a 650x650 canvas
			const scale = 200;
			const offset = vec2(325, 325);
			const curve2D = catmullPoints.map(p => add(vec2(p.x * scale, p.y * scale), offset));
			track = curve2D;
			vertexCount = curve2D.length;
			controlPointQuaternions = mySpline.controlPoints.map(point =>
				eulerToQuaternion(point.rotation.x, point.rotation.y, point.rotation.z)
			);
			// Debug: log first 5 track points
			console.log('First 5 track points:', JSON.stringify(track.slice(0, 5)));
			// Debug: log all track points
			console.log('All track points:', JSON.stringify(track));
		};
		reader.readAsText(event.target.files[0]);
	});


	render();
}

function render() {
	// Debug: log key state each frame
	console.log('vertexCount:', vertexCount, 'track.length:', track.length, 'carPosition:', carPosition);
	
	// Clear the canvas
	gl.clearColor(1.0, 1.0, 1.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	
	// Use orthographic projection that matches track coordinates
	let projMatrix = ortho(0, 1125, 0, 1125, -1, 1);
	setUniformMatrix("projMatrix", projMatrix);
	console.log('Projection Matrix:', projMatrix);
	
	// Use identity camera matrix
	setUniformMatrix("cameraMatrix", mat4());
	
	// Log attribute locations
	let posLoc = gl.getAttribLocation(program, "vPosition");
	let colLoc = gl.getAttribLocation(program, "vColor");
	console.log('Attribute locations - Position:', posLoc, 'Color:', colLoc);
	
	if (vertexCount > 0) {
		// Draw the track in red
		setUniformMatrix("modelMatrix", mat4());
		const trackColors = new Array(track.length).fill(vec4(1, 0, 0, 1));
		setAttributes(track, trackColors, 2, 4);
		gl.drawArrays(gl.LINE_STRIP, 0, vertexCount);
		
		// Draw the cart as a black rectangle at the cart's position
		const cartPosition = track[Math.floor(carPosition * (track.length - 1))];
		console.log('Cart position:', cartPosition);
		setUniformMatrix("modelMatrix", translate(cartPosition[0], cartPosition[1], 0));
		drawCoasterCar();
		
		// Update car position
		carPosition = (carPosition + 0.001) % 1.0;
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
function drawCoasterCar() {
	// Draw a larger rectangle centered at the origin in model space for visibility
	const carVertices = [
		vec2(-5, -5),
		vec2( 5, -5),
		vec2( 5,  5),
		vec2(-5,  5)
	];
	const carColors = [
		vec4(0, 0, 0, 1),
		vec4(0, 0, 0, 1),
		vec4(0, 0, 0, 1),
		vec4(0, 0, 0, 1)
	];
	setAttributes(carVertices, carColors, 2, 4);
	gl.drawArrays(gl.TRIANGLE_FAN, 0, carVertices.length);
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

window.addEventListener('load', main);