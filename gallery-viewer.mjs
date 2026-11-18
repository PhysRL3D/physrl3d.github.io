import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const colours = { baseline: 0xc65b55, ours: 0x2878b5 };

// New print meshes share one scale and one vertical origin. Legacy exports are
// explicitly display-normalised separately; neither policy changes orientation.
export function pairLayout(boxes, shared = true) {
  if (!boxes.length) throw Error('No model bounds');
  const dimensions = boxes.map(({ min, max }) => ['x', 'y', 'z'].map(k => max[k] - min[k]));
  if (dimensions.some(size => size.some(v => !Number.isFinite(v) || v < 0) || Math.max(...size) <= 0)) throw Error('Invalid model bounds');
  const largest = Math.max(...dimensions.flat());
  const scales = dimensions.map(size => 2 / (shared ? largest : Math.max(...size)));
  const widths = dimensions.map((size, i) => size[0] * scales[i]);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, boxes.length - 1) * .7;
  const commonFloor = Math.min(0, ...boxes.map(box => box.min.y));
  let cursor = -total / 2;
  return boxes.map(({ min, max }, i) => {
    const scale = scales[i];
    const offset = [cursor + widths[i] / 2 - (min.x + max.x) * .5 * scale, -(shared ? commonFloor : min.y) * scale, -(min.z + max.z) * .5 * scale];
    cursor += widths[i] + .7;
    return { scale, offset };
  });
}

function disposeModel(model) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model?.traverse(child => {
    if (!child.isMesh) return;
    geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(item => item.dispose());
  materials.forEach(item => item.dispose());
  geometries.forEach(item => item.dispose());
}

function initialiseGallery(section) {
  const cards = [...section.querySelectorAll('[data-example]')];
  const track = section.querySelector('.inspection-track');
  const panel = section.querySelector('.inspection-panel');
  const stage = panel.querySelector('.inspection-stage');
  const status = panel.querySelector('.inspection-status');
  const dialog = document.getElementById('inspection-dialog');
  const expandButton = panel.querySelector('[data-inspect-expand]');
  const retryButton = panel.querySelector('[data-inspect-retry]');
  const spinButton = panel.querySelector('[data-inspect-spin]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const previousButton = section.querySelector('[data-inspect-prev]');
  const nextButton = section.querySelector('[data-inspect-next]');
  const methodButtons = [...panel.querySelectorAll('[data-inspect-method]')];
  const loader = new GLTFLoader();
  let index = 0, method = 'both', renderer = null, scene, camera, controls;
  let models = [], requestId = 0, fittedDistance = 5, aspect = 1, frameId = 0;
  let inView = false, contextLost = false, placeholder = null;
  const initialDirection = new THREE.Vector3(2.1, 1.4, 4.8).normalize();

  function setSpin(value) {
    if (controls) controls.autoRotate = value;
    spinButton.setAttribute('aria-pressed', String(value));
    spinButton.textContent = value ? 'Pause rotation' : 'Rotate';
  }
  function showStatus(message, failed = false) {
    status.hidden = !message;
    status.textContent = message || '';
    retryButton.hidden = !failed;
  }
  function updateZoom() {
    if (!camera || !controls) return;
    const distance = camera.position.distanceTo(controls.target);
    panel.querySelector('[data-inspect-zoom-level]').value = Math.round(fittedDistance / distance * 100) + '%';
    panel.querySelector('[data-inspect-zoom="in"]').disabled = distance <= controls.minDistance * 1.001;
    panel.querySelector('[data-inspect-zoom="out"]').disabled = distance >= controls.maxDistance * .999;
  }
  function visibleBounds() {
    const bounds = new THREE.Box3();
    for (const model of models) if (model.group.visible) bounds.union(new THREE.Box3().setFromObject(model.group));
    return bounds;
  }
  function fitCamera(preserveView = false) {
    if (!models.length || !camera) return;
    const bounds = visibleBounds();
    if (bounds.isEmpty()) return;
    const previousRatio = fittedDistance / Math.max(.001, camera.position.distanceTo(controls.target));
    const direction = preserveView ? camera.position.clone().sub(controls.target).normalize() : initialDirection;
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const angle = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
    fittedDistance = sphere.radius / Math.sin(angle) * 1.12;
    controls.minDistance = fittedDistance / 4;
    controls.maxDistance = fittedDistance * 2.5;
    controls.target.copy(sphere.center);
    const distance = preserveView ? THREE.MathUtils.clamp(fittedDistance / previousRatio, controls.minDistance, controls.maxDistance) : fittedDistance;
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    camera.lookAt(controls.target);
    controls.update();
    updateZoom();
  }
  function resize() {
    if (!renderer) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    if (Math.abs(camera.aspect - aspect) > .001) { aspect = camera.aspect; fitCamera(true); }
  }
  function animate() {
    frameId = 0;
    if (!renderer || (!inView && !dialog.open) || document.hidden || contextLost) return;
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  }
  function updateActivity() {
    if ((!inView && !dialog.open) || document.hidden || contextLost) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    } else if (renderer && !frameId) frameId = requestAnimationFrame(animate);
  }
  function prepareRenderer() {
    if (renderer) return true;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      stage.append(renderer.domElement);
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf9f6f1);
      camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
      camera.position.copy(initialDirection).multiplyScalar(5);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x71809a, 2.8));
      const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(3, 5, 4); scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 1.1); fill.position.set(-4, 1, -3); scene.add(fill);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false;
      controls.zoomSpeed = .8; controls.autoRotateSpeed = 1;
      controls.addEventListener('start', () => setSpin(false));
      controls.addEventListener('change', updateZoom);
      renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault(); contextLost = true; updateActivity();
        showStatus('3D graphics paused. Waiting for the browser to restore this view…');
      });
      renderer.domElement.addEventListener('webglcontextrestored', () => {
        contextLost = false; if (models.length) showStatus(''); updateActivity();
      });
      setSpin(false);
      resize();
      return true;
    } catch (error) {
      renderer?.dispose(); renderer = null;
      console.error('Interactive gallery unavailable', error);
      showStatus('Interactive 3D is unavailable. Try a WebGL-enabled browser.', true);
      return false;
    }
  }
  function updateMethodUI() {
    const hasBaseline = Boolean(cards[index].dataset.baseline);
    methodButtons.forEach(button => {
      button.disabled = !hasBaseline && button.dataset.inspectMethod !== 'ours';
      button.setAttribute('aria-pressed', String(button.dataset.inspectMethod === method));
    });
    for (const model of models) model.group.visible = method === 'both' || model.kind === method;
  }
  async function loadExample() {
    if (!prepareRenderer()) return;
    const id = ++requestId;
    const card = cards[index];
    const name = card.dataset.name;
    const kinds = ['baseline', 'ours'].filter(kind => card.dataset[kind]);
    showStatus('Loading ' + name + ' meshes…');
    panel.dataset.loaded = '';
    for (const model of models) { scene.remove(model.group); disposeModel(model.group); }
    models = [];
    const timeout = setTimeout(() => { if (id === requestId) showStatus('Still loading ' + name + '. You can retry if the connection is slow.', true); }, 20000);
    const results = await Promise.allSettled(kinds.map(kind => loader.loadAsync(card.dataset[kind])));
    clearTimeout(timeout);
    if (id !== requestId) { results.forEach(result => { if (result.status === 'fulfilled') disposeModel(result.value.scene); }); return; }
    if (results.some(result => result.status === 'rejected')) {
      results.forEach(result => { if (result.status === 'fulfilled') disposeModel(result.value.scene); });
      showStatus(name + ' could not be loaded. Please retry or select another example.', true);
      return;
    }
    const prepared = [];
    try {
      results.forEach((result, i) => {
        const kind = kinds[i];
        const source = result.value.scene;
        const oriented = new THREE.Group(); oriented.add(source);
        // New body exports are raw print coordinates: Z-up, in millimetres.
        // The legacy koala/kangaroo GLBs have already been converted to Y-up.
        if (card.dataset.up === 'z') oriented.rotation.x = -Math.PI / 2;
        oriented.updateMatrixWorld(true);
        source.traverse(child => {
          if (!child.isMesh) return;
          if (!child.geometry.getAttribute('normal')) child.geometry.computeVertexNormals();
          for (const old of Array.isArray(child.material) ? child.material : [child.material]) {
            if (!old) continue;
            for (const value of Object.values(old)) if (value?.isTexture) value.dispose();
            old.dispose();
          }
          child.material = new THREE.MeshStandardMaterial({ color: colours[kind], roughness: .72, metalness: .02 });
        });
        prepared.push({ kind, oriented, bounds: new THREE.Box3().setFromObject(oriented) });
      });
      const layout = pairLayout(prepared.map(model => model.bounds), card.dataset.scale === 'shared');
      prepared.forEach((model, i) => {
        const group = new THREE.Group(); group.add(model.oriented);
        group.scale.setScalar(layout[i].scale); group.position.set(...layout[i].offset);
        models.push({ kind: model.kind, group }); scene.add(group);
      });
      updateMethodUI(); fitCamera(); resize(); showStatus('');
      panel.dataset.loaded = card.dataset.example;
      panel.dataset.loadedModels = kinds.join(',');
      updateActivity();
    } catch (error) {
      console.error('Interactive mesh preparation failed', error);
      for (const model of models) scene.remove(model.group);
      results.forEach(result => disposeModel(result.value.scene));
      models = [];
      showStatus(name + ' could not be displayed. Please retry.', true);
    }
  }
  function selectExample(next, focus = false) {
    index = Math.max(0, Math.min(cards.length - 1, next));
    const card = cards[index];
    cards.forEach((item, i) => { item.setAttribute('aria-selected', String(i === index)); item.tabIndex = i === index ? 0 : -1; });
    previousButton.disabled = index === 0; nextButton.disabled = index === cards.length - 1;
    section.querySelector('[data-inspect-count]').textContent = `${index + 1} / ${cards.length}`;
    panel.setAttribute('aria-labelledby', card.id);
    panel.querySelector('[data-inspect-name]').textContent = card.dataset.name;
    panel.querySelector('[data-inspect-note]').textContent = card.dataset.note;
    stage.setAttribute('aria-label', card.dataset.name + ' interactive model comparison. Drag to orbit, plus or minus to zoom, R to reset.');
    method = card.dataset.baseline ? 'both' : 'ours';
    setSpin(false); updateMethodUI();
    // Scroll only the horizontal strip, never move the page to an off-screen tab.
    const left = card.offsetLeft - track.offsetLeft;
    const target = left - (track.clientWidth - card.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, target), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    if (focus) card.focus({ preventScroll: true });
    if (renderer || inView) loadExample();
  }
  cards.forEach((card, i) => card.addEventListener('click', () => selectExample(i)));
  previousButton.addEventListener('click', () => selectExample(index - 1));
  nextButton.addEventListener('click', () => selectExample(index + 1));
  track.addEventListener('keydown', event => {
    const targets = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: cards.length - 1 };
    if (!(event.key in targets)) return;
    event.preventDefault(); selectExample(targets[event.key], true);
  });
  methodButtons.forEach(button => button.addEventListener('click', () => {
    method = button.dataset.inspectMethod; setSpin(false); updateMethodUI(); fitCamera();
  }));
  spinButton.addEventListener('click', () => { if (controls) setSpin(!controls.autoRotate); });
  panel.querySelector('[data-inspect-reset]').addEventListener('click', () => { setSpin(false); fitCamera(); });
  retryButton.addEventListener('click', loadExample);
  function zoom(factor) {
    if (!camera || !models.length) return;
    const direction = camera.position.clone().sub(controls.target);
    direction.setLength(THREE.MathUtils.clamp(direction.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(direction); controls.update(); updateZoom();
  }
  panel.querySelectorAll('[data-inspect-zoom]').forEach(button => button.addEventListener('click', () => zoom(button.dataset.inspectZoom === 'in' ? 1 / 1.2 : 1.2)));
  stage.addEventListener('keydown', event => {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1 / 1.2); }
    if (event.key === '-' || event.key === '_') { event.preventDefault(); zoom(1.2); }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); setSpin(false); fitCamera(); }
  });
  expandButton.addEventListener('click', () => {
    if (dialog.open) { dialog.close(); return; }
    if (!renderer && prepareRenderer()) loadExample();
    placeholder = document.createElement('div'); placeholder.style.height = panel.offsetHeight + 'px';
    panel.replaceWith(placeholder); dialog.querySelector('[data-inspect-dialog-content]').append(panel);
    panel.classList.add('in-dialog'); expandButton.textContent = '↙ Return to page';
    document.body.classList.add('inspection-dialog-open'); dialog.showModal(); resize(); updateActivity();
  });
  dialog.querySelector('[data-inspect-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    if (!placeholder) return;
    placeholder.replaceWith(panel); placeholder = null; panel.classList.remove('in-dialog');
    expandButton.textContent = '⤢ Larger view'; document.body.classList.remove('inspection-dialog-open');
    resize(); updateActivity(); expandButton.focus({ preventScroll: true });
  });
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView && !renderer) loadExample();
    updateActivity();
  }, { rootMargin: '150px' }).observe(stage);
  document.addEventListener('visibilitychange', updateActivity);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) setSpin(false); });
}

const gallery = document.querySelector('.inspection-gallery');
if (gallery) initialiseGallery(gallery);
