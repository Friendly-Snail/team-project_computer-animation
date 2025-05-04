let gl, program;
let vertexCount;
let track = [];
let carPosition = 0.0;
const carSpeed = 0.0005;
let controlPointQuaternions = [];

function main()
{
	// Retrieve <canvas> element
	let canvas = document.getElementById('webgl');

	// Get the rendering context for WebGL
	gl = WebGLUtils.setupWebGL(canvas, null);
	
	//Check that the return value is not null.
	if (!gl) 
	{
		console.log('Failed to get the rendering context for WebGL');
		return;
	}
	
	// Initialize shaders
	program = initShaders(gl, "vshader", "fshader");
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
            console.log("Loaded spline points:", catmullPoints);

            const curve2D = catmullPoints.map(p => vec2(p.x, p.y));
            setAttribute("vPosition", curve2D, 2);
            track = curve2D;
            vertexCount = curve2D.length;

        };
        reader.readAsText(event.target.files[0]);
    });


    render();
}

function render() {

    // Set clear color
    gl.clearColor(1.0, 1.0, 1.0, 1.0);


    // Clear <canvas> by clearing the color buffer
    gl.clear(gl.COLOR_BUFFER_BIT);


    if (vertexCount > 0) {
        gl.drawArrays(gl.LINE_STRIP, 0, vertexCount);


        carPosition = (carPosition + carSpeed) % 1.0;
        const idx = Math.floor(carPosition * (track.length - 1));
        const carPos = track[idx];

        setAttribute("vPosition", [carPos], 2);
        gl.drawArrays(gl.POINTS, 0, 1);

    }


    const segments = controlPointQuaternions.length - 1;


    const segmentPosition   = carPosition * segments;
    const segmentIndex   = Math.floor(segmentPosition);
    const segmentFraction   = segmentPosition - segmentIndex;

    const startQuat  = controlPointQuaternions[segmentIndex];
    const endQuat  = controlPointQuaternions[segmentIndex + 1];

    // interpolate
    const interpolatedQuaternion = slerp(startQuat, endQuat, segmentFraction);

    // turn into a rotation matrix
    const rotMat  = quatToMatrix(interpolatedQuaternion);

    const p = track[Math.floor(carPosition * (track.length - 1))];
    const modelMat = mult( translate(p[0], p[1], 0), rotMat );

    // upload & draw cart
    setUniformMatrix("modelMatrix", modelMat);


    drawCoasterCar();







    requestAnimationFrame(render);
}

function setAttribute(name, data, length = 4) {
    let pBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STATIC_DRAW);

    let aLoc = gl.getAttribLocation(program,  name);
    gl.vertexAttribPointer(aLoc, length, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aLoc);
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

// This will draw a single point at the origin of the car on the track
function drawCoasterCar(){

    setAttribute("vPosition", [ vec2(0, 0) ], 2);
    gl.drawArrays(gl.POINTS, 0, 1);

}


window.addEventListener('load', main);