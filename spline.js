class Spline {
    constructor() {
        this.controlPoints = [];
        this.time = 0;
    }

    parse(text) {
        //break text into lines, then trim, then remove commented lines
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));

        //index is current position as it goes through the lines
        let index = 0;
        const nSplines = parseInt(lines[index++]);
        const numControlPoints = parseInt(lines[index++]);
        this.time = parseFloat(lines[index++]);

        //loop over control points
        for (let i = 0; i < numControlPoints; i++) {
            const posValues = lines[index++].split(',').map(Number);
            const rotValues = lines[index++].split(',').map(Number);
            this.controlPoints.push({
                position: { x: posValues[0], y: posValues[1], z: posValues[2] },
                rotation: { x: rotValues[0], y: rotValues[1], z: rotValues[2] }
            });
        }
    }

    //reused method from ICE03
    generateCatmullRomCurve(points =this.controlPoints, segments = 20) {
        let curve = [];
        const matrix = [
            [-1/2, 3/2, -3/2, 1/2],
            [1, -5/2, 2, -1/2],
            [-1/2, 0, 1/2, 0],
            [0, 1, 0, 0]
        ];
        for (let i = 0; i < points.length - 3; i++) {
            let P = [points[i], points[i+1], points[i+2], points[i+3]];
            for (let j = 0; j <= segments; j++) {
                let t = j/segments;
                let T = [t*t*t, t*t, t, 1];
                let B = [0, 0, 0, 0];
                for (let col = 0; col < 4; col++) {
                    for (let row = 0; row < 4; row++) {
                        B[col] += T[row] * matrix[row][col];
                    }
                }
                let x = 0, y = 0, z = 0;
                for (let k = 0; k < 4; k++) {
                    x += B[k] * P[k].position.x;
                    y += B[k] * P[k].position.y;
                    z += B[k] * P[k].position.z;
                }
                curve.push({ x, y, z });
            }
        }
        return curve;
    }

}


window.Spline = Spline;
