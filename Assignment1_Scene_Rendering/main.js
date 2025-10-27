let gl;
let shaderProgram;
let renderMode;
let squareBuffer, triangleBuffer, circleBuffer, starTriangleBuffer, rightTriangleBuffer;

let boatOffset = 0, boatDir = 1;
let windmillAngle = 0;
let moonAngle = 0;
let twinklePhase =0;

function initGL() {
  const canvas = document.getElementById("glcanvas");
  gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    alert("webGL not supported!");
    return;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // black sky
  renderMode = gl.TRIANGLES;

  initShaders();
  initBuffers();
}

function getShader(gl, id, str, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, str);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert("error compiling shader: " + gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders() {
  const vsSource = `
    attribute vec2 aVertexPosition;
    uniform mat4 uMatrix;
    void main(void) {
      vec4 pos = uMatrix * vec4(aVertexPosition, 0.0, 1.0);
      gl_Position = pos;
      gl_PointSize = 6.0;
    }
  `;

  const fsSource = `
    precision mediump float;
    uniform vec4 uColor;
    void main(void) {
      gl_FragColor = uColor;
    }
  `;

  const vertexShader = getShader(gl, "shader-vs", vsSource, gl.VERTEX_SHADER);
  const fragmentShader = getShader(gl, "shader-fs", fsSource, gl.FRAGMENT_SHADER);

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Could not initialize shaders");
  }

  gl.useProgram(shaderProgram);

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.uMatrix = gl.getUniformLocation(shaderProgram, "uMatrix");
  shaderProgram.uColor = gl.getUniformLocation(shaderProgram, "uColor");
}

function initBuffers() {
  //square
  squareBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer);
  const squareVertices = [
    -0.5, -0.5,
     0.5, -0.5,
     0.5,  0.5,
    -0.5,  0.5
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(squareVertices), gl.STATIC_DRAW);
  squareBuffer.itemSize = 2;
  squareBuffer.numItems = 4;

  //isosceles triangle
  triangleBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer);
  const triVertices = [ 0, 0.5, -0.5, -0.5, 0.5, -0.5 ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triVertices), gl.STATIC_DRAW);
  triangleBuffer.itemSize = 2;
  triangleBuffer.numItems = 3;

  //right angle triangle
  rightTriangleBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rightTriangleBuffer);
  const rightTriVertices = [
    0.0, 0.0,   // right angle corner
    1.0, 0.0,   // along X
    0.0, 1.0    // along Y
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rightTriVertices), gl.STATIC_DRAW);
  rightTriangleBuffer.itemSize = 2;
  rightTriangleBuffer.numItems = 3;

  // circle
  initCircleBuffer();

  //star wedge triangle
  starTriangleBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, starTriangleBuffer);
  const starTriVertices = [
     0.0,  0.4,   // tip
    -0.08, 0.0,   // left base
     0.08, 0.0    // right base
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starTriVertices), gl.STATIC_DRAW);
  starTriangleBuffer.itemSize = 2;
  starTriangleBuffer.numItems = 3;
}

function initCircleBuffer() {
  circleBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, circleBuffer);
  const verts = [];
  const segments = 50;
  for (let i = 0; i < segments; i++) {
    const angle = 2 * Math.PI * i / segments;
    verts.push(Math.cos(angle) * 0.5);
    verts.push(Math.sin(angle) * 0.5);
  }
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  circleBuffer.itemSize = 2;
  circleBuffer.numItems = segments;
}

function setRenderMode(mode) {
  renderMode = mode;
}

function drawBuffer(buffer, color, matrix) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, buffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(shaderProgram.uMatrix, false, matrix);
  gl.uniform4fv(shaderProgram.uColor, color);

  if (renderMode === gl.POINTS) {
    gl.drawArrays(gl.POINTS, 0, buffer.numItems);
  } else if (renderMode === gl.LINES) {
    // draw outline of shape
    if (buffer === squareBuffer) {
      gl.drawArrays(gl.LINE_LOOP, 0, buffer.numItems);
    } else if (buffer === triangleBuffer || buffer === starTriangleBuffer || buffer === rightTriangleBuffer) {
      gl.drawArrays(gl.LINE_LOOP, 0, buffer.numItems);
    } else if (buffer === circleBuffer) {
      gl.drawArrays(gl.LINE_LOOP, 0, buffer.numItems);
    }
  } else {
    //default filled mode
    if (buffer === squareBuffer) {
      gl.drawArrays(gl.TRIANGLE_FAN, 0, buffer.numItems);
    } else if (buffer === triangleBuffer || buffer === starTriangleBuffer || buffer === rightTriangleBuffer) {
      gl.drawArrays(gl.TRIANGLES, 0, buffer.numItems);
    } else if (buffer === circleBuffer) {
      gl.drawArrays(gl.TRIANGLE_FAN, 0, buffer.numItems);
    }
  }
}

function transform(tx, ty, sx, sy, angle, ox=0, oy=0) {
  let m = mat4.create();
  mat4.identity(m);
  mat4.translate(m, [tx, ty, 0]);  
  mat4.rotateZ(m, angle);
  mat4.translate(m, [ox, oy, 0]);
  mat4.scale(m, [sx, sy, 1]);

  return m;
}

//done
function drawGround() {
  drawBuffer(squareBuffer, [0.1, 0.9, 0.5, 1], transform(0, -0.79, 2, 1.7, 0));
}

//done
function drawRiver() {
  //river
  drawBuffer(squareBuffer, [0.0, 0.4, 1.0, 1], transform(0, -0.08, 2, 0.22, 0));
  //river white line
  drawBuffer(squareBuffer, [0.9, 0.9, 0.9, 1], transform(0, -0.01, 0.26, 0.004, 0));
  drawBuffer(squareBuffer, [0.9, 0.9, 0.9, 1], transform(0.75, -0.16, 0.26, 0.004, 0));
  drawBuffer(squareBuffer, [0.9, 0.9, 0.9, 1], transform(-0.75, -0.1, 0.26, 0.004, 0));
}

//done
function drawMountains() {
  // Left mountain
  drawBuffer(triangleBuffer, [0.4, 0.3, 0.2, 1], transform(-0.62, 0.14, 1, 0.22, -0.05));
  drawBuffer(triangleBuffer, [0.4, 0.3, 0.1, 0.8], transform(-0.6, 0.14, 1, 0.22, 0.1));
  //right mountain
  
  drawBuffer(triangleBuffer, [0.4, 0.3, 0.1, 0.8], transform(0.75, 0.12, 1.2, 0.2, 0));
  //middle mountain
  drawBuffer(triangleBuffer, [0.4, 0.3, 0.2, 1], transform(0.025, 0.18, 1.2, 0.35, 0.1));
  drawBuffer(triangleBuffer, [0.4, 0.3, 0.1, 0.8], transform(0.05, 0.14, 1.2, 0.43, 0.2));

}
//done
function drawTrees() {
  // third
  drawBuffer(squareBuffer, [0.4, 0.2, 0.1, 1], transform(0.8, 0.16, 0.035, 0.25, 0));
  drawBuffer(triangleBuffer, [0, 0.6, 0.2, 1], transform(0.8, 0.47, 0.35, 0.4, 0));
  drawBuffer(triangleBuffer, [0.2, 0.6, 0.2, 0.9], transform(0.8, 0.5, 0.38, 0.35, 0));
  drawBuffer(triangleBuffer, [0.3, 0.7, 0.2, 0.9], transform(0.8, 0.52, 0.39, 0.3, 0));
  // second
  drawBuffer(squareBuffer, [0.4, 0.2, 0.1, 1], transform(0.55, 0.23, 0.045, 0.38, 0));
  drawBuffer(triangleBuffer, [0, 0.6, 0.2, 1], transform(0.55, 0.6, 0.5, 0.5, 0));
  drawBuffer(triangleBuffer, [0.2, 0.6, 0.2, 0.9], transform(0.55, 0.63, 0.53, 0.45, 0));
  drawBuffer(triangleBuffer, [0.3, 0.7, 0.2, 0.9], transform(0.55, 0.65, 0.55, 0.4, 0));
  //first
  drawBuffer(squareBuffer, [0.4, 0.2, 0.1, 1], transform(0.3, 0.16, 0.035, 0.25, 0));
  drawBuffer(triangleBuffer, [0, 0.6, 0.2, 1], transform(0.3, 0.4, 0.3, 0.35, 0));
  drawBuffer(triangleBuffer, [0.2, 0.6, 0.2, 0.9], transform(0.3, 0.42, 0.32, 0.3, 0));
  drawBuffer(triangleBuffer, [0.3, 0.7, 0.2, 0.9], transform(0.3, 0.44, 0.35, 0.25, 0));
}
//done
function drawTrapezium(x, y, w, h, color) {
  // center rectangle
  drawBuffer(squareBuffer, color, transform(x, y, w, h, 0));
  // left slant using right-angled triangle
  drawBuffer(rightTriangleBuffer, color, transform(x - w/2, y + h/2, w/3, h, Math.PI));
  // right slant rotated right-angled triangle
  drawBuffer(rightTriangleBuffer,  color, transform(x + w/2, y + h/2, -w/3, h, Math.PI));
}

//done
function drawHouse() {
  drawBuffer(squareBuffer, [0.9, 0.9, 0.9, 1], transform(-0.6, -0.55, 0.45, 0.2, 0));
  drawTrapezium(-0.6, -0.35, 0.35, -0.22, [1, 0.3, 0.0, 1]);
  drawBuffer(squareBuffer, [0.9, 0.7, 0.0, 1], transform(-0.6, -0.59, 0.06, 0.12, 0));
  drawBuffer(squareBuffer, [0.9, 0.7, 0.0, 1], transform(-0.73, -0.52, 0.07, 0.06, 0));
  drawBuffer(squareBuffer, [0.9, 0.7, 0.0, 1], transform(-0.47, -0.52, 0.07, 0.06, 0));
}

//done
function drawCar() {
  //car roof
  drawBuffer(circleBuffer, [0.1, 0.1, 0.6, 0.9], transform(-0.53, -0.74, 0.25, 0.19, 0));
  drawBuffer(squareBuffer, [0.8, 0.8, 0.8, 1], transform(-0.53, -0.745, 0.18, 0.07, 0));
  //car wheels
  drawBuffer(circleBuffer, [0, 0, 0, 1], transform(-0.63, -0.88, 0.08, 0.08, 0));
  drawBuffer(circleBuffer, [0.6, 0.6, 0.6, 1], transform(-0.63, -0.88, 0.07, 0.07, 0));
  drawBuffer(circleBuffer, [0, 0, 0, 1], transform(-0.45, -0.88, 0.08, 0.08, 0));
  drawBuffer(circleBuffer, [0.6, 0.6, 0.6, 1], transform(-0.45, -0.88, 0.07, 0.07, 0));
  //car body
  drawTrapezium(-0.53, -0.82, 0.3, -0.11, [0, 0.3, 0.8, 0.8]);
}

//done
function drawBushes() {
  //left 
  drawBuffer(circleBuffer, [0.0, 0.7, 0.0, 1], transform(-0.98, -0.6, 0.1, 0.08, 0));
  drawBuffer(circleBuffer, [0.0, 0.6, 0.0, 1], transform(-0.9, -0.6, 0.13, 0.1, 0));
   //middle
   drawBuffer(circleBuffer, [0.0, 0.5, 0.0, 1], transform(-0.16, -0.61, 0.09, 0.08, 0));
   drawBuffer(circleBuffer, [0.0, 0.8, 0.0, 1], transform(-0.35, -0.6, 0.07, 0.07, 0));
   drawBuffer(circleBuffer, [0.0, 0.6, 0.0, 1], transform(-0.26, -0.6, 0.16, 0.12, 0));
   //right most
   drawBuffer(circleBuffer, [0.0, 0.7, 0.0, 1], transform(0.86, -0.54, 0.12, 0.12, 0));
   drawBuffer(circleBuffer, [0.0, 0.6, 0.0, 1], transform(0.96, -0.52, 0.15, 0.15, 0));
   //low
   drawBuffer(circleBuffer, [0.0, 0.5, 0.0, 1], transform(0.07, -1.03, 0.16, 0.12, 0));
   drawBuffer(circleBuffer, [0.0, 0.8, 0.0, 1], transform(-0.22, -1.02, 0.16, 0.12, 0));
   drawBuffer(circleBuffer, [0.0, 0.6, 0.0, 1], transform(-0.08, -1.01, 0.28, 0.17, 0));
}
//done
function drawClouds() {
  drawBuffer(circleBuffer, [0.7, 0.7, 0.7, 1], transform(-0.88, 0.58, 0.33, 0.18, 0));
  drawBuffer(circleBuffer, [ 1, 1, 1, 1], transform(-0.68, 0.55, 0.23, 0.14, 0));
  drawBuffer(circleBuffer, [0.7, 0.7, 0.7, 1], transform(-0.54, 0.553, 0.16, 0.09, 0));
}
//done
function drawStar(x, y, baseScale) {
  // oscillates between 0.9x and 1.1x of baseScale
  let twinkleScale = baseScale * (1 + 0.1 * Math.sin(twinklePhase + x * 5 + y * 5));
  for (let i = 0; i < 4; i++) {
    drawBuffer(
      starTriangleBuffer,
      [1, 1, 1, 1],
      transform(x, y, twinkleScale, twinkleScale, i * Math.PI / 2)
    );
  }
}
//done
function drawStars() {
  drawStar(-0.25, 0.65, 0.06);
  drawStar(-0.3, 0.55, 0.045);
  drawStar(-0.4, 0.75, 0.07);
  // drawStar(-0.2, 0.9, 0.08);
  drawStar(0.2, 0.78, 0.12);
  drawStar(0.45, 0.89, 0.06);
  // drawStar(0.8, 0.75, 0.07);
}
//done
function drawBoat() {
  //big boat
  // Boat base trapezium  x, y, w, h, color
  drawTrapezium(boatOffset , -0.1, 0.18, 0.07, [0.8, 0.8, 0.8, 1]);
  // pole
  drawBuffer(squareBuffer, [0.0, 0.2, 0.1, 1], transform(boatOffset, 0.065, 0.008, 0.26, 0));
  // red flag
  drawBuffer(triangleBuffer, [1.0, 0.0, 0.0, 1], transform(boatOffset + 0.115, 0.08, 0.2, 0.22, -1.56));
  // rope            
  drawBuffer(squareBuffer, [0.0, 0.2, 0.1, 1], transform(boatOffset - 0.072, 0.052, 0.006, 0.28, -0.55));

    //small boat
    // Boat base trapezium x, y, w, h, color
  drawTrapezium(boatOffset - 0.4, -0.05, 0.09, 0.05, [0.8, 0.8, 0.8, 1]);
  // pole
  drawBuffer(squareBuffer, [0.0, 0.2, 0.1, 1], transform(boatOffset -0.4, 0.045, 0.006, 0.14, 0));
  // violet flag
  drawBuffer(triangleBuffer, [0.6, 0.0, 1, 1], transform(boatOffset -0.379, 0.07, 0.08, 0.08, 0.45));
  // rope            
  drawBuffer(squareBuffer, [0.0, 0.2, 0.1, 1], transform(boatOffset -0.435, 0.033, 0.004, 0.14, -0.55));
}
//done
function drawWindmill() {
  //first
  drawBuffer(squareBuffer, [0.2, 0.2, 0.2, 1], transform(0.7, -0.12, 0.023, 0.45, 0));
  for (let i = 0; i < 4; i++) {
   drawBuffer(
  triangleBuffer,
  [0.8, 0.8, 0, 1],
  transform(0.7, 0.1, 0.06, 0.25, -windmillAngle+ i * Math.PI / 2, 0, -0.1)
);

  }
  drawBuffer(circleBuffer, [0, 0, 0, 1], transform(0.7, 0.1, 0.04, 0.04, 0));
  //second
  drawBuffer(squareBuffer, [0.2, 0.2, 0.2, 1], transform(0.5, -0.07, 0.023, 0.32, 0));
  for (let i = 0; i < 4; i++) {
    drawBuffer(triangleBuffer, [0.8, 0.8, 0.0, 1], transform(0.5, 0.1, 0.04, 0.13, -windmillAngle + i * Math.PI / 2, 0 , -0.06));
  }
  drawBuffer(circleBuffer, [0, 0, 0, 1], transform(0.5, 0.1, 0.04, 0.04, 0));
}
//done
function drawRoad() {
  drawBuffer(rightTriangleBuffer,  [0.4, 0.7, 0.1, 1], transform(0.77, -1.25, -0.8, 1.6, 0.7)); 
  drawBuffer(rightTriangleBuffer,  [0.4, 0.7, 0.1, 1], transform(1.1, -1.6, 1.25, 2, 0.75)); 
}
//done
function drawMoon() {
  //rotating moon
  drawBuffer(circleBuffer, [1, 1, 1, 1], transform(-0.7, 0.83, 0.2, 0.2, moonAngle));
  for (let i = 0; i < 10; i++) {
    drawBuffer(triangleBuffer, [1, 1, 1, 1], 
      transform(-0.7, 0.83, 0.005, 0.25, moonAngle + i * Math.PI / 4));
  }
}


function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT);

  drawMountains();
  drawGround();      
  drawRoad();        
  drawRiver();       
  drawStars();
  drawClouds();
  drawMoon();
  drawTrees();
  drawBushes();
  drawHouse();
  drawCar();
  drawBoat();
  drawWindmill();
}


function animate() {
  boatOffset += 0.003 * boatDir;
  if (boatOffset > 0.8 || boatOffset < -0.5) boatDir *= -1;
  windmillAngle += 0.05;
  moonAngle += 0.007;
  twinklePhase += 0.15
}

function tick() {
  requestAnimationFrame(tick);
  animate();
  drawScene();
}

function webGLStart() {
  initGL();
  tick();
}

window.onload = webGLStart;
