global.THREE = require('three');
require('three/examples/js/curves/NURBSUtils');
require('three/examples/js/curves/NURBSCurve');

const dat = require('dat.gui/build/dat.gui.js');
const gui = new dat.GUI({ load: require('./gui.json'), preset: 'Sleek' });

const palettes = require('nice-color-palettes');
const glslify = require('glslify');
const path = require('path');

let palette = palettes[13].slice();
const background = palette.shift();
const canvas = document.querySelector('#canvas');
canvas.style.background = background;

const {
  addBarycentricCoordinates,
  unindexBufferGeometry
} = require('./geom');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas
});

const gl = renderer.getContext();
gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);

renderer.setClearColor(background, 1);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.sortObjects = false;

window.addEventListener('resize', () => resize());

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);

const material = new THREE.ShaderMaterial({
  extensions: {
    derivatives: true
  },
  transparent: true,
  side: THREE.DoubleSide,
  uniforms: {
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
  fragmentShader: glslify(path.resolve(__dirname, 'wire.frag')),
  vertexShader: glslify(path.resolve(__dirname, 'wire.vert'))
});

const mesh = new THREE.Mesh(new THREE.Geometry(), material);
scene.add(mesh);

const clock = new THREE.Clock();

createGeometry();
setupGUI();
resize();
renderer.animate(update);
canvas.style.visibility = '';
update();
draw();

function update () {
  const time = clock.getElapsedTime();
  const radius = 4;
  const angle = time * 2.5 * Math.PI / 180;
  camera.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  camera.lookAt(new THREE.Vector3());
  mesh.material.uniforms.time.value = time;
  draw();
}

function draw () {
  renderer.render(scene, camera);
}

function resize (width = window.innerWidth, height = window.innerHeight, pixelRatio = window.devicePixelRatio) {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  draw();
}

function createGeometry (type = 'TorusKnot', edgeRemoval = true) {
  if (mesh.geometry) mesh.geometry.dispose();
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
  unindexBufferGeometry(geometry);
  addBarycentricCoordinates(geometry, edgeRemoval);
  mesh.geometry = geometry;
}

function toSpline (points) {
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

  var link = document.createElement('a');
  link.download = 'Screenshot.png';
  link.href = dataURI;
  link.click();
}

function setupGUI () {
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
    for (var k in gui.__folders.Shader.__controllers) {
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
  dash.open();

  const effects = shader.addFolder('Effects');
  effects.add(guiData, 'noiseA').name('Noise Big').onChange(updateUniforms);
  effects.add(guiData, 'noiseB').name('Noise Small').onChange(updateUniforms);
  effects.add(guiData, 'insideAltColor').name('Backface Color').onChange(updateUniforms);
  effects.add(guiData, 'squeeze').name('Squeeze').onChange(updateUniforms);
  effects.add(guiData, 'squeezeMin', 0, 1).step(0.01).name('Squeeze Min').onChange(updateUniforms);
  effects.add(guiData, 'squeezeMax', 0, 1).step(0.01).name('Squeeze Max').onChange(updateUniforms);
  effects.add(guiData, 'dualStroke').name('Dual Stroke').onChange(updateUniforms);
  effects.add(guiData, 'secondThickness', 0, 0.2).step(0.001).name('Dual Thick').onChange(updateUniforms);
  effects.open();

  const geom = shader.addFolder('Geometry');
  geom.add(guiData, 'name', [
    'TorusKnot',
    'Icosphere',
    'Tube',
    'Sphere',
    'Torus'
  ]).name('Geometry').onChange(updateGeom);
  geom.add(guiData, 'edgeRemoval').name('Edge Removal').onChange(updateGeom);
  geom.open();

  shader.open();

  updateGeom();
  updateColors();
  updateUniforms();
}
