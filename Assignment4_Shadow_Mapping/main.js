var gl;
var shadowProgram, renderProgram;
var planeVBO, planeNBO, planeIBO, planeIndexCount;
var sphereVBO, sphereNBO, sphereIBO, sphereIndexCount;
var teapotVBO, teapotNBO, teapotIBO, teapotIndexCount;

// FBO and shadow texture
var depthFramebuffer, depthTexture;
const shadowMapSize = 4096;

var lightPos = [8.0, 5.0, 3.0]; // Starts on the right
const eyePosition = [6, 4, 6];   // Static base position for the camera

// JSON file to load
const input_JSON = "teapot.json";

var animate = false; // Flag to control animation
// Calculate the starting angle from the static eyePosition
var cameraAngle = Math.atan2(eyePosition[0], eyePosition[2]);
// Store the light's starting angle and distance from origin
var lightAngle = Math.atan2(lightPos[0], lightPos[2]);
var lightRadius = Math.sqrt(lightPos[0] * lightPos[0] + lightPos[2] * lightPos[2]);


// Entry point called by <body onload="webGLStart()">
function webGLStart() {
  const canvas = document.getElementById("webgl-canvas");

  try {
    gl = canvas.getContext("webgl2");
  } catch (e) {
    alert("WebGL 2.0 not supported!");
    return;
  }
  if (!gl) {
    alert("WebGL initialization failed");
    return;
  }

  gl.enable(gl.DEPTH_TEST);

  // Event Listeners
  const lightSlider = document.getElementById('lightXSlider');
  const animateCheckbox = document.getElementById('animateCheckbox');

  lightSlider.addEventListener('input', (event) => {
    // Only let the slider work if we are NOT animating
    if (!animate) {
      let sliderValue = parseFloat(event.target.value);

      // Update the X position directly from the slider
      lightPos[0] = sliderValue;

      // Map the slider value (-10 to 10) to the Z position (-3 to 3)
      lightPos[2] = (sliderValue + 8.0) / 1.0 - 15.0;
    }
  });

  animateCheckbox.addEventListener('change', (event) => {
    animate = event.target.checked;
    // Disable the slider when animating
    lightSlider.disabled = animate;

    // When we START animating, capture the
    // light's current angle and radius
    if (animate) {
        lightAngle = Math.atan2(lightPos[0], lightPos[2]);
        lightRadius = Math.sqrt(lightPos[0] * lightPos[0] + lightPos[2] * lightPos[2]);
    }
  });
  // END Listeners

  initShaders();    // Creates both programs
  initShadowMap();  // Creates the FBO
  initGeometry();   // Creates buffers for plane and sphere
  loadTeapot();     // Start loading the teapot

  drawScene();      // Start the render loop
}

// ---------------- SHADERS ----------------
function initShaders() {
  // --- PASS 1: Shadow Shader ---
  const vsShadow = `#version 300 es
    in vec3 a_position;
    uniform mat4 uPMatrix;
    uniform mat4 uVMatrix;
    uniform mat4 uMMatrix;
    void main() {
      gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(a_position, 1.0);
    }`;

  const fsShadow = `#version 300 es
    precision highp float;
    void main() { }`; // Outputs only depth

  shadowProgram = createProgram(vsShadow, fsShadow);
  gl.bindAttribLocation(shadowProgram, 0, "a_position");
  gl.linkProgram(shadowProgram);
  if (!gl.getProgramParameter(shadowProgram, gl.LINK_STATUS)) {
    console.error("Could not link shadow program");
  }

  // --- PASS 2: Render Shader (Phong + PCF Shadow) ---
  const vsRender = `#version 300 es
    in vec3 a_position;
    in vec3 a_normal;
    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProj;
    uniform mat4 uLightVP; // Light's View-Projection

    const mat4 textureTransformMat = mat4(
        0.5, 0.0, 0.0, 0.0,
        0.0, 0.5, 0.0, 0.0,
        0.0, 0.0, 0.5, 0.0,
        0.5, 0.5, 0.5, 1.0);

    out vec3 vNormal;
    out vec3 vFragPos;
    out vec4 vShadowCoord; // Position relative to light

    void main() {
      vec4 worldPos = uModel * vec4(a_position, 1.0);
      vFragPos = worldPos.xyz;
      vNormal = mat3(uModel) * a_normal;
      vShadowCoord = textureTransformMat * uLightVP * worldPos;
      gl_Position = uProj * uView * worldPos;
    }`;

  const fsRender = `#version 300 es
    precision highp float;
    in vec3 vNormal;
    in vec3 vFragPos;
    in vec4 vShadowCoord;

    uniform vec3 uLightPos;
    uniform vec3 uColor;
    uniform vec3 uViewPos;
    uniform sampler2D uShadowMap;
    uniform float uShadowMapSize; // For PCF calculation

    out vec4 fragColor;

    // Shadow Calculation with 3x3 PCF for smooth edges
    float shadowCalc(vec4 shadowCoord) {
      vec3 proj = shadowCoord.xyz / shadowCoord.w;
      float currentDepth = proj.z;
      float bias = 0.002;

      if (proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0) {
        return 1.0; // Not in shadow
      }

      float shadow = 0.0;
      float texelSize = 1.0 / uShadowMapSize;

      // 3x3 PCF loop (9 samples)
      for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
          float closestDepth = texture(uShadowMap, proj.xy + vec2(x, y) * texelSize).r;
          if(currentDepth - bias > closestDepth) {
            shadow += 1.0;
          }
        }
      }

      shadow /= 9.0; // Average the 9 samples

      // Blend between 1.0 (lit) and 0.4 (shadow)
      return mix(1.0, 0.4, shadow);
    }

    void main() {
      float shininess = 32.0;
      vec3 norm = normalize(vNormal);
      vec3 lightDir = normalize(uLightPos - vFragPos);

      float ambientStrength = 0.3; // Brighter ambient
      vec3 ambient = ambientStrength * vec3(1.0);

      float diff = max(dot(norm, lightDir), 0.0);
      vec3 diffuse = diff * uColor;

      vec3 viewDir = normalize(uViewPos - vFragPos);
      vec3 reflectDir = reflect(-lightDir, norm);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
      vec3 specular = spec * vec3(1.0);

      float shadow = shadowCalc(vShadowCoord);

      vec3 color = (ambient * uColor * shadow) + (diffuse * shadow) + specular;
      fragColor = vec4(color, 1.0);
    }`;

  renderProgram = createProgram(vsRender, fsRender);
  gl.bindAttribLocation(renderProgram, 0, "a_position");
  gl.bindAttribLocation(renderProgram, 1, "a_normal");
  gl.linkProgram(renderProgram);
  if (!gl.getProgramParameter(renderProgram, gl.LINK_STATUS)) {
    console.error("Could not link render program");
  }
}

// Helper to compile and link a program
function createProgram(vsSrc, fsSrc) {
  const vs = createShader(gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl.FRAGMENT_SHADER, fsSrc);

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);

  return prog;
}

// Helper to compile a shader
function createShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}

// ---------------- SHADOW MAP ----------------
function initShadowMap() {
  depthFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);

  depthTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, depthTexture);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24,
    shadowMapSize, shadowMapSize, 0,
    gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0
  );

  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
    console.error("Shadow framebuffer not complete");

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}


// ---------------- GEOMETRY ----------------
function initGeometry() {
  createPlane();
  createSphere();
}

function createPlane() {
  const s = 5;
  const v = new Float32Array([-s,0,-s, s,0,-s, s,0,s, -s,0,s]);
  const n = new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]);
  const i = new Uint16Array([0,1,2,0,2,3]);

  planeVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, planeVBO);
  gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);

  planeNBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, planeNBO);
  gl.bufferData(gl.ARRAY_BUFFER, n, gl.STATIC_DRAW);

  planeIBO = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeIBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, i, gl.STATIC_DRAW);

  planeIndexCount = i.length;
}

function createSphere() {
  const nslices = 60; // Smoother sphere
  const nstacks = nslices / 2 + 1;
  const radius = 0.5;

  const spVerts = [];
  const spNormals = [];
  const spIndicies = [];

  var theta1, theta2;
  for (let i = 0; i < nslices; i++) {
    spVerts.push(0); spVerts.push(-radius); spVerts.push(0);
    spNormals.push(0); spNormals.push(-1.0); spNormals.push(0);
  }
  for (let j = 1; j < nstacks - 1; j++) {
    theta1 = (j * 2 * Math.PI) / nslices - Math.PI / 2;
    for (let i = 0; i < nslices; i++) {
      theta2 = (i * 2 * Math.PI) / nslices;
      spVerts.push(radius * Math.cos(theta1) * Math.cos(theta2));
      spVerts.push(radius * Math.sin(theta1));
      spVerts.push(radius * Math.cos(theta1) * Math.sin(theta2));
      spNormals.push(Math.cos(theta1) * Math.cos(theta2));
      spNormals.push(Math.sin(theta1));
      spNormals.push(Math.cos(theta1) * Math.sin(theta2));
    }
  }
  for (let i = 0; i < nslices; i++) {
    spVerts.push(0); spVerts.push(radius); spVerts.push(0);
    spNormals.push(0); spNormals.push(1.0); spNormals.push(0);
  }
  for (let j = 0; j < nstacks - 1; j++) {
    for (let i = 0; i <= nslices; i++) {
      var mi = i % nslices;
      var mi2 = (i + 1) % nslices;
      var idx = (j + 1) * nslices + mi;
      var idx2 = j * nslices + mi;
      var idx3 = j * nslices + mi2;
      var idx4 = (j + 1) * nslices + mi;
      var idx5 = j * nslices + mi2;
      var idx6 = (j + 1) * nslices + mi2;
      spIndicies.push(idx); spIndicies.push(idx2); spIndicies.push(idx3);
      spIndicies.push(idx4); spIndicies.push(idx5); spIndicies.push(idx6);
    }
  }

  sphereVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVBO);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);

  sphereNBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereNBO);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);

  sphereIBO = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(spIndicies), gl.STATIC_DRAW);

  sphereIndexCount = spIndicies.length;
}

// ---------------- TEAPOT ----------------
function loadTeapot() {
  const req = new XMLHttpRequest();
  req.open("GET", input_JSON);
  req.overrideMimeType("application/json");
  req.onload = () => {
    if (req.status != 200) {
      console.error("Error: Could not load " + input_JSON);
      return;
    }
    const d = JSON.parse(req.responseText);

    const v = new Float32Array(d.vertexPositions);
    teapotVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, teapotVBO);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);

    const n = new Float32Array(d.vertexNormals);
    teapotNBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, teapotNBO);
    gl.bufferData(gl.ARRAY_BUFFER, n, gl.STATIC_DRAW);

    const i = new Uint16Array(d.indices);
    teapotIBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotIBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, i, gl.STATIC_DRAW);

    teapotIndexCount = i.length;
  };
  req.onerror = () => {
     console.error("Error: XMLHttpRequest failed for " + input_JSON);
  };
  req.send();
}

// ---------------- DRAW ----------------
// Draws to the shadow map (Pass 1)
function drawObjectShadow(vbo, ibo, indexCount, indexType, modelMatrix) {
  if (!vbo || !ibo) return;

  gl.uniformMatrix4fv(gl.getUniformLocation(shadowProgram, "uMMatrix"), false, modelMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  gl.disableVertexAttribArray(1); // No normals needed

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.drawElements(gl.TRIANGLES, indexCount, indexType, 0);

  gl.disableVertexAttribArray(0);
}

// Draws to the main scene (Pass 2)
function drawObject(vbo, nbo, ibo, indexCount, indexType, modelMatrix, color) {
  if (!vbo || !nbo || !ibo) return;

  gl.uniformMatrix4fv(gl.getUniformLocation(renderProgram, "uModel"), false, modelMatrix);
  gl.uniform3fv(gl.getUniformLocation(renderProgram, "uColor"), color);

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); // location 0
  gl.enableVertexAttribArray(0);

  gl.bindBuffer(gl.ARRAY_BUFFER, nbo);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0); // location 1
  gl.enableVertexAttribArray(1);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.drawElements(gl.TRIANGLES, indexCount, indexType, 0);

  gl.disableVertexAttribArray(0);
  gl.disableVertexAttribArray(1);
}


// ---------------- RENDER ----------------
// This function will now loop
function drawScene() {

  // --- Update Camera AND Light if animating ---
  if (animate) {
    cameraAngle += 0.01; // Animation speed
    lightAngle += 0.00;  // Animate light AT THE SAME SPEED

    // Recalculate light's X/Z position
    lightPos[0] = Math.sin(lightAngle) * lightRadius;
    lightPos[2] = Math.cos(lightAngle) * lightRadius;
  }
  // (If not animating, lightPos is controlled by the slider)

  // Calculate camera's X/Z position
  const radius = Math.sqrt(eyePosition[0] * eyePosition[0] + eyePosition[2] * eyePosition[2]);
  const camX = Math.sin(cameraAngle) * radius;
  const camZ = Math.cos(cameraAngle) * radius;

  const currentEye = [camX, eyePosition[1], camZ]; // Keep Y height constant

  // --- Create Light's camera matrices ---
  // This now uses the (potentially) animated lightPos
  const lightView = mat4.create();
  const lightProj = mat4.create();
  const lightVP = mat4.create();

  mat4.lookAt(lightPos, [0, 0, 0], [0, 1, 0], lightView);
  mat4.perspective(60, 1.0, 1.0, 50.0, lightProj);
  mat4.multiply(lightProj, lightView, lightVP);

  // --- Model Matrices (create them once) ---
  const modelPlane = mat4.identity(mat4.create());
  mat4.rotate(modelPlane, -3.9, [0, 1, 0]); // Rotate plane
  mat4.translate(modelPlane, [-0.8, 0.0, 0.0]); // Translate plane

  const modelSphere = mat4.identity(mat4.create());
  mat4.scale(modelSphere, [1.5, 1.5, 1.5]);      // Scale sphere
  mat4.translate(modelSphere, [2.3, 0.4, 1.4]);  // Move sphere

  const modelTeapot = mat4.identity(mat4.create());
  mat4.scale(modelTeapot, [0.2, 0.2, 0.2]);     // Scale teapot
  mat4.translate(modelTeapot, [-5.5, 6.0, 0.0]); // Move teapot
  mat4.rotate(modelTeapot, -0.8, [0, 1, 0]);     // Rotate teapot

  // --- PASS 1: Render Shadows ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
  gl.viewport(0, 0, shadowMapSize, shadowMapSize);
  gl.clear(gl.DEPTH_BUFFER_BIT);

  gl.useProgram(shadowProgram);
  gl.uniformMatrix4fv(gl.getUniformLocation(shadowProgram, "uVMatrix"), false, lightView);
  gl.uniformMatrix4fv(gl.getUniformLocation(shadowProgram, "uPMatrix"), false, lightProj);

  // Draw sphere AND teapot to shadow map
  drawObjectShadow(sphereVBO, sphereIBO, sphereIndexCount, gl.UNSIGNED_INT, modelSphere);
  drawObjectShadow(teapotVBO, teapotIBO, teapotIndexCount, gl.UNSIGNED_SHORT, modelTeapot);

  // --- PASS 2: Render Full Scene ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(renderProgram);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, depthTexture);
  gl.uniform1i(gl.getUniformLocation(renderProgram, "uShadowMap"), 0);

  // --- Set Camera and Global Uniforms ---
  const cameraView = mat4.create();
  mat4.lookAt(currentEye, [0, 0, 0], [0, 1, 0], cameraView); // Use animated 'currentEye'

  const cameraProj = mat4.create();
  mat4.perspective(60, gl.canvas.width / gl.canvas.height, 1, 50, cameraProj);

  gl.uniformMatrix4fv(gl.getUniformLocation(renderProgram, "uView"), false, cameraView);
  gl.uniformMatrix4fv(gl.getUniformLocation(renderProgram, "uProj"), false, cameraProj);
  gl.uniform3fv(gl.getUniformLocation(renderProgram, "uLightPos"), lightPos); // Use animated 'lightPos'
  gl.uniform3fv(gl.getUniformLocation(renderProgram, "uViewPos"), currentEye); // Use animated 'currentEye'
  gl.uniformMatrix4fv(gl.getUniformLocation(renderProgram, "uLightVP"), false, lightVP);
  gl.uniform1f(gl.getUniformLocation(renderProgram, "uShadowMapSize"), shadowMapSize);

  // --- Colors ---
  const colorPlane = [0.5, 0.5, 0.5]; // light grey
  const colorSphere = [0.5, 0.5, 1.0]; // Light blue
  const colorTeapot = [0.0, 0.8, 0.4]; // Green

  // --- Draw All Objects ---
  drawObject(planeVBO, planeNBO, planeIBO, planeIndexCount, gl.UNSIGNED_SHORT, modelPlane, colorPlane);
  drawObject(sphereVBO, sphereNBO, sphereIBO, sphereIndexCount, gl.UNSIGNED_INT, modelSphere, colorSphere);
  drawObject(teapotVBO, teapotNBO, teapotIBO, teapotIndexCount, gl.UNSIGNED_SHORT, modelTeapot, colorTeapot);

  // --- Request the next frame ---
  requestAnimationFrame(drawScene);
}