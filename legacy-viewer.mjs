import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const colours = { baseline: 0xc65b55, ours: 0x2878b5 };

function disposeModel(model) {
  model.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      child.material?.dispose();
    }
  });
}

function createViewer(host) {
  const stage = host.querySelector('.viewer-stage');
  const status = host.querySelector('.viewer-status');
  const name = host.dataset.name;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf9f6f1);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', `${name} interactive 3D model`);
  stage.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x71809a, 2.8));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 1.1);
  fillLight.position.set(-4, 1, -3);
  scene.add(fillLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.75;
  controls.maxDistance = 7;
  controls.enablePan = false;
  let activeModel = null;
  let loadId = 0;

  function resize() {
    const rect = stage.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  function frame() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  function setButtons(selected) {
    host.querySelectorAll('[data-model]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.model === selected));
    });
  }

  function frameCamera(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const largestSide = Math.max(size.x, size.y, size.z);
    const scale = 1.65 / Math.max(largestSide, 0.001);
    model.scale.setScalar(scale);
    controls.target.set(0, 0, 0);
    camera.position.set(2.2, 1.6, 2.5);
    camera.lookAt(0, 0, 0);
    controls.saveState();
    controls.update();
  }

  function loadModel(kind) {
    const requestId = ++loadId;
    status.hidden = false;
    status.textContent = `Loading ${kind === 'baseline' ? 'TRELLIS.2' : 'earlier fixed-weight PhysRL3D'} mesh…`;
    loader.load(host.dataset[kind], (gltf) => {
      if (requestId !== loadId) return;
      if (activeModel) {
        scene.remove(activeModel);
        disposeModel(activeModel);
      }
      activeModel = gltf.scene;
      activeModel.traverse((child) => {
        if (!child.isMesh) return;
        child.material = new THREE.MeshStandardMaterial({ color: colours[kind], roughness: 0.72, metalness: 0.02 });
        child.castShadow = false;
      });
      scene.add(activeModel);
      frameCamera(activeModel);
      setButtons(kind);
      status.hidden = true;
    }, undefined, () => {
      if (requestId !== loadId) return;
      status.textContent = 'The interactive mesh could not be loaded. The turntable above remains available.';
    });
  }

  host.querySelectorAll('[data-model]').forEach((button) => button.addEventListener('click', () => loadModel(button.dataset.model)));
  host.querySelector('.viewer-reset').addEventListener('click', () => controls.reset());
  stage.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R') controls.reset();
  });
  loadModel('ours');
}

document.querySelectorAll('.mesh-viewer').forEach(createViewer);
