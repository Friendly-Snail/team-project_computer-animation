let gl, program;

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

    render();
}

function render() {

    // Set clear color
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Clear <canvas> by clearing the color buffer
    gl.clear(gl.COLOR_BUFFER_BIT);

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