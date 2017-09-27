// Require ThreeJS and any necessary extensions
global.THREE = require('three');
require('three/examples/js/curves/NURBSUtils');
require('three/examples/js/curves/NURBSCurve');

// Include dat.gui sliders
const dat = require('dat.gui/build/dat.gui.js');
const gui = new dat.GUI({ load: require('./gui.json'), preset: 'Sleek' });

// Grab some nice color palettes
const palettes = require('nice-color-palettes');

//  glslify is used for including GLSL shader code
const glslify = require('glslify');
const path = require('path');

// our geometry helper functions
const {
  addBarycentricCoordinates,
  unindexBufferGeometry
} = require('./geom');

// grab a default palette
let palette = palettes[13].slice();

const canvas = document.querySelector('#canvas');

// the 1st color in our palette is our background
const background = palette.shift();
canvas.style.background = background;

// create an anti-aliased ThreeJS WebGL renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas
});

// Enable Alpha to Coverage for alpha cutouts + depth test
const gl = renderer.getContext();
gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);

// Configure renderer
renderer.setClearColor(background, 1);
renderer.setPixelRatio(window.devicePixelRatio);

// Listen for window resizes
window.addEventListener('resize', () => resize());

// Create a scene and camera for 3D world
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);

// Create our custom wireframe shader material
const material = new THREE.ShaderMaterial({
  extensions: {
    // needed for anti-alias smoothstep, aastep()
    derivatives: true
  },
  transparent: true,
  side: THREE.DoubleSide,
  uniforms: { // some parameters for the shader
    time: { value: 0 },
    fill: { value: new THREE.Color(palette[0]) },
    stroke: { value: new THREE.Color(palette[1]) },
    noiseA: { value: false },
    noiseB: { value: false },
    dualStroke: { value: false },
    seeThrough: { value: false },
    insideAltColor: { value: true },
    thickness: { value: 0.01 },
    secondThickness: { value: 0.05 },
    dashEnabled: { value: true },
    dashRepeats: { value: 2.0 },
    dashOverlap: { value: false },
    dashLength: { value: 0.55 },
    dashAnimate: { value: false },
    squeeze: { value: false },
    squeezeMin: { value: 0.1 },
    squeezeMax: { value: 1.0 }
  },
  // use glslify here to bring in the GLSL code
  fragmentShader: glslify(path.resolve(__dirname, 'wire.frag')),
  vertexShader: glslify(path.resolve(__dirname, 'wire.vert'))
});

// add the mesh with an empty geometry for now, we will change it later
const mesh = new THREE.Mesh(new THREE.Geometry(), material);
scene.add(mesh);

const clock = new THREE.Clock();

// set up scene and start drawing
createGeometry();
setupGUI();
resize();
renderer.animate(update);
canvas.style.visibility = '';
update();
draw();

function update () {
  // orbit the camera and update shader time
  const time = clock.getElapsedTime();
  const radius = 4;
  const angle = time * 2.5 * Math.PI / 180;
  camera.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  camera.lookAt(new THREE.Vector3());
  mesh.material.uniforms.time.value = time;
  draw();
}

function draw () {
  // render a single frame
  renderer.render(scene, camera);
}

function resize (width = window.innerWidth, height = window.innerHeight, pixelRatio = window.devicePixelRatio) {
  // handle window resize
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  draw();
}

function createGeometry (type = 'TorusKnot', edgeRemoval = true) {
  // dispose the old geometry if we have one
  if (mesh.geometry) mesh.geometry.dispose();

  // here we change the geometry of the mesh to visualize
  // the shader in different applications
  let geometry;
  switch (type) {
    case 'TorusKnot':
      geometry = new THREE.TorusKnotBufferGeometry(0.7, 0.3, 30, 4);
      geometry.rotateY(-Math.PI * 0.5);
      break;
    case 'Icosphere':
      geometry = new THREE.IcosahedronBufferGeometry(1, 1);
      break;
    case 'Tube':
      const baseGeom = new THREE.IcosahedronGeometry(1, 0);
      const points = baseGeom.vertices;
      baseGeom.dispose();
      const curve = toSpline(points);
      geometry = new THREE.TubeBufferGeometry(curve, 30, 0.3, 4, false);
      break;
    case 'Sphere':
      geometry = new THREE.SphereBufferGeometry(1, 20, 10);
      break;
    case 'Torus':
      geometry = new THREE.TorusBufferGeometry(1, 0.3, 8, 30);
      break;
  }

  // the BufferGeometry needs to be un-indexed, then we can
  // add barycentric coordiantes for the wireframe effect
  unindexBufferGeometry(geometry);
  addBarycentricCoordinates(geometry, edgeRemoval);

  // set the new geometry on the mesh
  mesh.geometry = geometry;
}

function toSpline (points) {
  // This helper function makes a smooth NURBS curve from a set of points
  const nurbsDegree = 3;
  const nurbsKnots = [];
  for (let i = 0; i <= nurbsDegree; i++) {
    nurbsKnots.push(0);
  }
  let nurbsControlPoints = points.map((p, i, list) => {
    const knot = (i + 1) / (list.length - nurbsDegree);
    nurbsKnots.push(Math.max(Math.min(1, knot), 0));
    return new THREE.Vector4(p.x, p.y, p.z, 1);
  });
  return new THREE.NURBSCurve(nurbsDegree, nurbsKnots, nurbsControlPoints);
}

function saveScreenshot () {
  // force a specific output size
  const width = 2048;
  const height = 2048;
  resize(width, height, 1);

  const dataURI = canvas.toDataURL('image/png');

  // revert to old size
  resize();

  // force download
  const link = document.createElement('a');
  link.download = 'Screenshot.png';
  link.href = dataURI;
  link.click();
}

function setupGUI () {
  // This function handles all the GUI sliders and updates
  const shader = gui.addFolder('Shader');

  const guiData = {
    name: 'TorusKnot',
    edgeRemoval: true,
    backgroundHex: background,
    saveScreenshot,
    fillHex: `#${mesh.material.uniforms.fill.value.getHexString()}`,
    strokeHex: `#${mesh.material.uniforms.stroke.value.getHexString()}`
  };

  // add all the uniforms into our gui data
  Object.keys(mesh.material.uniforms).forEach(key => {
    const uniform = mesh.material.uniforms[key];
    if (typeof uniform.value === 'boolean' || typeof uniform.value === 'number') {
      guiData[key] = uniform.value;
    }
  });

  const randomColors = () => {
    palette = palettes[Math.floor(Math.random() * palettes.length)].slice();
    guiData.backgroundHex = palette.shift();
    guiData.fillHex = palette[0];
    guiData.strokeHex = palette[1];
    updateColors();

    // Iterate over all controllers
    for (let k in gui.__folders.Shader.__controllers) {
      gui.__folders.Shader.__controllers[k].updateDisplay();
    }
  };

  const updateColors = () => {
    canvas.style.background = guiData.backgroundHex;
    renderer.setClearColor(guiData.backgroundHex, 1.0);
    mesh.material.uniforms.fill.value.setStyle(guiData.fillHex);
    mesh.material.uniforms.stroke.value.setStyle(guiData.strokeHex);
  };

  const updateUniforms = () => {
    Object.keys(guiData).forEach(key => {
      if (key in mesh.material.uniforms) {
        mesh.material.uniforms[key].value = guiData[key];
      }
    });
  };

  const updateGeom = () => createGeometry(guiData.name, guiData.edgeRemoval);

  guiData.randomColors = randomColors;
  gui.remember(guiData);

  shader.add(guiData, 'seeThrough').name('See Through').onChange(updateUniforms);
  shader.add(guiData, 'thickness', 0.005, 0.2).step(0.001).name('Thickness').onChange(updateUniforms);
  shader.addColor(guiData, 'backgroundHex').name('Background').onChange(updateColors);
  shader.addColor(guiData, 'fillHex').name('Fill').onChange(updateColors);
  shader.addColor(guiData, 'strokeHex').name('Stroke').onChange(updateColors);
  shader.add(guiData, 'randomColors').name('Random Palette');
  shader.add(guiData, 'saveScreenshot').name('Save PNG');

  const dash = shader.addFolder('Dash');
  dash.add(guiData, 'dashEnabled').name('Enabled').onChange(updateUniforms);
  dash.add(guiData, 'dashAnimate').name('Animate').onChange(updateUniforms);
  dash.add(guiData, 'dashRepeats', 1, 10).step(1).name('Repeats').onChange(updateUniforms);
  dash.add(guiData, 'dashLength', 0, 1).step(0.01).name('Length').onChange(updateUniforms);
  dash.add(guiData, 'dashOverlap').name('Overlap Join').onChange(updateUniforms);

  const effects = shader.addFolder('Effects');
  effects.add(guiData, 'noiseA').name('Noise Big').onChange(updateUniforms);
  effects.add(guiData, 'noiseB').name('Noise Small').onChange(updateUniforms);
  effects.add(guiData, 'insideAltColor').name('Backface Color').onChange(updateUniforms);
  effects.add(guiData, 'squeeze').name('Squeeze').onChange(updateUniforms);
  effects.add(guiData, 'squeezeMin', 0, 1).step(0.01).name('Squeeze Min').onChange(updateUniforms);
  effects.add(guiData, 'squeezeMax', 0, 1).step(0.01).name('Squeeze Max').onChange(updateUniforms);
  effects.add(guiData, 'dualStroke').name('Dual Stroke').onChange(updateUniforms);
  effects.add(guiData, 'secondThickness', 0, 0.2).step(0.001).name('Dual Thick').onChange(updateUniforms);

  const geom = shader.addFolder('Geometry');
  geom.add(guiData, 'name', [
    'TorusKnot',
    'Icosphere',
    'Tube',
    'Sphere',
    'Torus'
  ]).name('Geometry').onChange(updateGeom);
  geom.add(guiData, 'edgeRemoval').name('Edge Removal').onChange(updateGeom);

  // close GUI for mobile devices
  const isMobile = /(Android|iPhone|iOS|iPod|iPad)/i.test(navigator.userAgent);
  if (isMobile) {
    gui.close();
  }

  updateGeom();
  updateColors();
  updateUniforms();
}
