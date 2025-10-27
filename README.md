# Introduction to Computer Graphics Assignments (CS360)

This repository contains a series of four assignments for a CS360 Computer Graphics course. These projects are implemented from scratch using WebGL and JavaScript, covering fundamental concepts from 2D transformations to advanced 3D shading, texturing, and shadow mapping.

**Core Technologies:** WebGL, JavaScript, GLSL (GL Shader Language), and the `glMatrix.js` library.

---

## Assignment 1: 2D Scene Rendering & Animation

![Assignment 1 Scene](./assets/Assignment_1.png)

This project involved rendering a 2D animated scene using only three basic shapes: triangles, squares, and circles. All objects in the scene, like the house, car, and windmills, are constructed by applying affine transformations (translation, rotation, scaling) to these basic primitives.

**Key Features:**
* Hierarchical modeling to build complex objects (e.g., house, windmills) from simple shapes.
* Simple animations, including rotating windmill blades and a boat moving back and forth on the river.
* UI buttons to toggle the rendering mode between solid surfaces (`gl.TRIANGLES`), wireframes (`gl.LINE_LOOP`), and points (`gl.POINTS`).

---

## Assignment 2: 3D Rendering & Shading Models

![Assignment 2 Scene](./assets/Assignment_2.png)

This assignment focused on implementing and comparing three fundamental shading algorithms.The canvas is split into three distinct viewports, with each viewport rendering 3D objects using a different shading technique.

**Key Features:**
* **Flat (Per-Face) Shading:** Lighting calculations are performed once per face.
* **Gouraud (Per-Vertex) Shading:** Lighting is calculated in the vertex shader and interpolated across the face.
* **Phong (Per-Fragment) Shading:** Lighting is calculated for every pixel in the fragment shader, providing smooth specular highlights.
* Interactive viewport-specific mouse controls for object rotation.
* UI sliders to control the light's X-position and the camera's Z-axis zoom.

---

## Assignment 3: Texture & Environment Mapping

![Assignment 3 Scene](./assets/Assignment_3.png)

A comprehensive project to demonstrate advanced texturing techniques, including 2D texture mapping, cubemap environment mapping (for reflections and refractions), and skyboxes.

**Key Features:**
* **Skybox:** A skybox is rendered by mapping six environment textures onto the inside faces of a large cube.
* **Environment Reflection:** A teapot is rendered as a perfect mirror reflecting the skybox. A second sphere blends this reflection with its own Phong-shaded color.
* **Environment Refraction:** A "glass" block is simulated by using the `refract()` function in the shader to sample the cubemap, mimicking light bending through it.
* **2D Texture Mapping:** Standard texture mapping is applied to the globe and the wooden tabletop.
* **Alpha Channel Texturing:** A texture with an alpha channel is used to discard fragments on a cube, creating a "cage" effect.

---

## Assignment 4: Shadow Mapping

![Assignment 4 Scene](./assets/Assignment_4.png)

This assignment involved implementing a dynamic shadow map algorithm using a two-pass rendering technique. This method, based on rasterization, creates realistic, hard shadows for 3D objects in a scene.

**Key Features:**
* **Two-Pass Rendering:**
    1.  **Depth Pass:** The scene is first rendered from the light's point of view, storing only the depth information in a shadow map (a texture).
    2.  **Render Pass:** The scene is rendered from the camera's view. Each fragment's position is compared to the depth stored in the shadow map to determine if it is in shadow.
* An interactive slider controls the light's X-position, causing the shadows to update dynamically in real-time.
* An animation checkbox toggles a continuous camera rotation around the scene.