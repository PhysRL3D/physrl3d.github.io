import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const colours = { baseline: 0xc65b55, ours: 0x2878b5 };
const labels = { baseline: 'TRELLIS.2', ours: 'PhysRL3D-SAS' };

// Scale both the vertices AND the centre translation. These GLBs use millimetres.
export function normalisationForBounds(min, max) {
  const axes = ['x', 'y', 'z'];
  const size = axes.map(k => max[k] - min[k]);
  if (!size.every(Number.isFinite) || Math.max(...size) <= 0) throw Error('Empty mesh');
  const scale = 1.8 / Math.max(...size);
  const offset = axes.map(k => -(min[k] + max[k]) * 0.5 * scale);
  return { scale, offset };
}

function disposeModel(model) {
  const geometries = new Set(), materials = new Set();
  model.traverse(child => {
    if (!child.isMesh) return;
    geometries.add(child.geometry);
    for (const m of Array.isArray(child.material) ? child.material : [child.material]) materials.add(m);
  });
  geometries.forEach(g => g?.dispose());
  materials.forEach(m => m?.dispose());
}

const dialog = document.getElementById('mesh-dialog');
const dialogContent = document.getElementById('mesh-dialog-content');
let expanded = null;
document.getElementById('mesh-dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => {
  if (!expanded) return;
  const { host, placeholder, button, restoreInline } = expanded;
  placeholder.replaceWith(host);
  host.classList.remove('in-dialog');
  button.textContent = '⤢ Larger view';
  document.body.classList.remove('mesh-dialog-open');
  expanded = null;
  restoreInline();
  button.focus({ preventScroll: true });
});

function createViewer(host) {
  const stage = host.querySelector('.viewer-stage');
  const status = host.querySelector('.viewer-status');
  const zoomOutput = host.querySelector('.viewer-zoom');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf9f6f1);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', host.dataset.name + ' interactive 3D model');
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
  controls.enablePan = false;
  controls.zoomSpeed = 0.8;
  function setExpandedInteraction(value) {
    controls.enableZoom = value;
    // Both canvas and parent must allow page gestures; touch-action is intersected.
    renderer.domElement.style.touchAction = value ? 'none' : 'pan-y';
    stage.style.touchAction = value ? 'none' : 'pan-y';
  }
  setExpandedInteraction(false);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const spinButton = host.querySelector('.viewer-spin');
  controls.autoRotateSpeed = 1.2;
  function setSpin(value) {
    controls.autoRotate = value;
    spinButton.setAttribute('aria-pressed', String(value));
    spinButton.textContent = value ? 'Pause rotation' : 'Rotate';
  }
  setSpin(!reducedMotion.matches);
  spinButton.addEventListener('click', () => setSpin(!controls.autoRotate));
  controls.addEventListener('start', () => setSpin(false));
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) setSpin(false); });
  let activeModel = null, loadId = 0, fittedDistance = 4, inView = false, frameId = 0;
  let fittedAspect = 1, contextLost = false;
  const initialDirection = new THREE.Vector3(2.2, 1.4, 3.2).normalize();

  function updateZoom() {
    const distance = camera.position.distanceTo(controls.target);
    zoomOutput.value = Math.round(fittedDistance / distance * 100) + '%';
    host.querySelector('[data-zoom="in"]').disabled = distance <= controls.minDistance * 1.001;
    host.querySelector('[data-zoom="out"]').disabled = distance >= controls.maxDistance * 0.999;
  }
  function zoom(factor) {
    const vector = camera.position.clone().sub(controls.target);
    vector.setLength(THREE.MathUtils.clamp(vector.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(vector);
    controls.update();
    updateZoom();
  }
  function resetView() {
    controls.target.set(0, 0, 0);
    camera.position.copy(initialDirection).multiplyScalar(fittedDistance);
    camera.lookAt(controls.target);
    controls.update();
    updateZoom();
  }
  function fitCamera(preserveZoom = false) {
    if (!activeModel) return;
    const zoomRatio = fittedDistance / Math.max(camera.position.distanceTo(controls.target), 0.001);
    const radius = new THREE.Box3().setFromObject(activeModel).getBoundingSphere(new THREE.Sphere()).radius;
    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const limitingAngle = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
    fittedDistance = radius / Math.sin(limitingAngle) * 1.12;
    controls.minDistance = fittedDistance / 4;
    controls.maxDistance = fittedDistance * 2.5;
    if (preserveZoom) {
      const direction = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(direction, fittedDistance / zoomRatio);
      controls.update();
      updateZoom();
    } else resetView();
  }
  function resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (width < 1 || height < 1) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (Math.abs(camera.aspect - fittedAspect) > 0.001) {
      fittedAspect = camera.aspect;
      fitCamera(true);
    }
  }
  function atlasPaperActive() {
    const state = document.documentElement.dataset;
    return state.atlasMode !== 'space' || (state.atlasZone === 'paper' && state.atlasMoving !== 'true');
  }
  function isActive() {
    const inDialog = dialog.open && expanded?.host === host;
    return !document.hidden && !contextLost && (inDialog || (!dialog.open && inView && atlasPaperActive()));
  }
  function animate() {
    frameId = 0;
    if (!isActive()) return;
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  }
  function updateActivity() {
    if (!isActive()) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    } else if (!frameId) frameId = requestAnimationFrame(animate);
  }
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    updateActivity();
  }).observe(stage);
  document.addEventListener('visibilitychange', updateActivity);
  document.addEventListener('physrl3d:atlas-zone', () => { resize(); updateActivity(); });
  dialog.addEventListener('close', updateActivity);
  controls.addEventListener('change', updateZoom);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    updateActivity();
    status.hidden = false;
    status.textContent = '3D graphics paused. Waiting for the browser to restore the view…';
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    status.hidden = Boolean(activeModel);
    updateActivity();
  });
  resize();

  function loadModel(kind) {
    const requestId = ++loadId;
    host.querySelectorAll('[data-model]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.model === kind)));
    status.hidden = false;
    status.textContent = 'Loading ' + labels[kind] + ' mesh…';
    const timeout = setTimeout(() => {
      if (requestId === loadId && !status.hidden) status.textContent = 'Still loading. Select a method again to retry.';
    }, 15000);
    loader.load(host.dataset[kind], gltf => {
      clearTimeout(timeout);
      if (requestId !== loadId) { disposeModel(gltf.scene); return; }
      try {
        // Preserve GLB transforms inside a wrapper. The wrapper translation is scaled.
        const normalised = new THREE.Group();
        normalised.add(gltf.scene);
        const box = new THREE.Box3().setFromObject(normalised);
        const transform = normalisationForBounds(box.min, box.max);
        normalised.scale.setScalar(transform.scale);
        normalised.position.set(...transform.offset);
        const display = new THREE.Group();
        display.add(normalised);
        // The 3MF exporter already rotates Z-up to glTF Y-up. Do not rotate twice.
        gltf.scene.traverse(child => {
          if (!child.isMesh) return;
          // The public compact exports have POSITION and COLOR_0, but no NORMAL.
          // A new lit material needs normals; without them it renders as a silhouette.
          if (!child.geometry.getAttribute('normal')) child.geometry.computeVertexNormals();
          const old = Array.isArray(child.material) ? child.material : [child.material];
          old.forEach(m => m?.dispose());
          child.material = new THREE.MeshStandardMaterial({ color: colours[kind], roughness: 0.72, metalness: 0.02 });
        });
        if (activeModel) { scene.remove(activeModel); disposeModel(activeModel); }
        activeModel = display;
        scene.add(activeModel);
        fitCamera();
        renderer.render(scene, camera);
        status.hidden = true;
        host.dataset.loaded = kind;
      } catch (error) {
        disposeModel(gltf.scene);
        console.error('Mesh preparation failed', error);
        status.textContent = 'This mesh could not be displayed. Select a method to retry.';
      }
    }, undefined, error => {
      clearTimeout(timeout);
      if (requestId !== loadId) return;
      console.error('Mesh load failed', error);
      status.textContent = 'The mesh could not be loaded. Select a method to retry.';
    });
  }

  host.querySelectorAll('[data-model]').forEach(button => button.addEventListener('click', () => loadModel(button.dataset.model)));
  host.querySelector('.viewer-reset').addEventListener('click', resetView);
  host.querySelector('[data-zoom="in"]').addEventListener('click', () => zoom(1 / 1.2));
  host.querySelector('[data-zoom="out"]').addEventListener('click', () => zoom(1.2));
  const expandButton = host.querySelector('.viewer-expand');
  expandButton.addEventListener('click', () => {
    if (expanded?.host === host) { dialog.close(); return; }
    const placeholder = document.createElement('div');
    placeholder.style.height = host.offsetHeight + 'px';
    host.replaceWith(placeholder);
    dialogContent.append(host);
    host.classList.add('in-dialog');
    expandButton.textContent = '↙ Return to page';
    expanded = { host, placeholder, button: expandButton, restoreInline: () => { setExpandedInteraction(false); resize(); updateActivity(); } };
    document.body.classList.add('mesh-dialog-open');
    dialog.showModal();
    setExpandedInteraction(true);
    resize();
    updateActivity();
  });
  stage.addEventListener('keydown', event => {
    if (event.key === 'r' || event.key === 'R') { event.preventDefault(); resetView(); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1 / 1.2); }
    if (event.key === '-' || event.key === '_') { event.preventDefault(); zoom(1.2); }
  });
  loadModel('ours');
}

// A failed WebGL context must not prevent the other viewer from initialising.
document.querySelectorAll('.mesh-viewer').forEach(host => {
  try { createViewer(host); }
  catch (error) {
    console.error('Viewer unavailable', error);
    const status = host.querySelector('.viewer-status');
    status.hidden = false;
    status.textContent = 'Interactive 3D is unavailable in this browser. Try a WebGL-enabled browser.';
  }
});
