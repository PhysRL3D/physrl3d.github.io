import {ATLAS_ZONES, OVERVIEW_SCALE, TRAVEL_SCREENS, cameraAt, immersiveAllowed, progressFromScroll, stationProgress, worldTransform} from './atlas-math.mjs';

// Presentation only: one DOM, one live support viewer, no new experimental data.
const root = document.documentElement;
const main = document.querySelector('main#top');
const home = document.getElementById('support-examples');
const host = document.getElementById('physics-viewer');
const clips = document.getElementById('examples');
const dialog = document.getElementById('physics-dialog');

if (main && home && host && clips && !document.getElementById('atlas-track')) initialiseAtlas();

function initialiseAtlas() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const samples = [['chair', 'Chair'], ['cat', 'Cat'], ['poodle', 'Poodle'], ['xmastree', 'Christmas tree'], ['penguin', 'Penguin']];
  const originalNodes = [...main.childNodes];
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, className = '') => { const node = make('button', className, text); node.type = 'button'; return node; };
  const announce = make('p', 'atlas-sr-only'); announce.setAttribute('role', 'status');
  const track = make('div', 'atlas-track'); track.id = 'atlas-track';
  const viewport = make('div', 'atlas-viewport');
  const world = make('div', 'atlas-world');
  viewport.append(world); track.append(viewport);
  const zones = new Map(), mounts = new Map(), posters = new Map();
  const existingIds = new Set([...document.querySelectorAll('[id]')].map(node => node.id));
  let mode = 'document', activeZone = 'home', viewerZone = 'home', pendingViewer = null;
  let frame = 0, travel = 0, top = 0, width = innerWidth, height = innerHeight;
  let currentCamera = cameraAt(0), overview = false, pendingAnchor = null, queuedNavigation = null;
  let previousState = '', layoutKey = '', documentRequested = false;
  try { documentRequested = localStorage.getItem('physrl3d-atlas-document') === 'true'; } catch { /* Private browsing can deny storage. */ }

  // Native dialogs must not inherit the CSS camera transform. Move, never clone.
  for (const node of main.querySelectorAll('dialog')) document.body.append(node);

  function sampleStrip() {
    const strip = make('div', 'atlas-input-strip');
    for (const [id, name] of samples) {
      const figure = make('figure');
      const img = make('img'); img.src = `static/support-shatter-20261118/${id}-input.jpg`;
      img.alt = `${name}: original conditioning image`; img.loading = 'lazy'; img.decoding = 'async';
      figure.append(img, make('figcaption', '', name)); strip.append(figure);
    }
    return strip;
  }
  function makePoster(key, title, copy) {
    const poster = make('div', 'atlas-station-poster');
    poster.append(make('p', 'atlas-kicker', key === 'standing' ? 'GENERATED-POSE INSPECTION' : key === 'slice' ? 'LOOK INSIDE THE DISPLAY MESH' : 'THE SAME FIVE CONDITIONING IMAGES'), make('h2', '', title), make('p', 'atlas-station-copy', copy), sampleStrip());
    const activate = button(key === 'standing' ? 'Open standing station' : key === 'slice' ? 'Open cutaway' : 'Open shared 3D view', 'atlas-activate');
    activate.dataset.atlasActivate = key;
    poster.append(activate, make('p', 'atlas-caption', 'Input images shown here. The live 3D viewer is shared between stations.'));
    posters.set(key, poster);
    return poster;
  }
  function zoneShell(config) {
    const zone = make('section', `atlas-zone atlas-zone-${config.key}`);
    zone.dataset.atlasZone = config.key;
    zone.style.setProperty('--atlas-x', config.x);
    zone.style.setProperty('--atlas-y', config.y);
    zone.setAttribute('aria-label', config.label);
    const label = make('div', 'atlas-world-label', config.label);
    label.setAttribute('aria-hidden', 'true'); zone.append(label);
    zones.set(config.key, zone); world.append(zone);
    return zone;
  }
  for (const config of ATLAS_ZONES) zoneShell(config);

  const homeMount = make('div', 'atlas-live-mount spatial-gallery'); homeMount.dataset.atlasMount = 'home';
  homeMount.append(host, makePoster('home', 'One space. Every example.', 'Compare generated shapes and their sliced supports, then move closer to a pair.'));
  home.prepend(homeMount); mounts.set('home', homeMount);
  const notes = make('details', 'atlas-home-notes');
  notes.append(make('summary', '', 'What the animation and numbers mean'));
  for (const child of [...home.children]) if (child !== homeMount) notes.append(child);
  home.append(notes); zones.get('home').append(home);

  const descriptions = {
    slice: ['slicing', 'Look inside.', 'Move a horizontal cut through the same display meshes. Cyan contours show the intersection; this is not printed walls, infill or G-code.'],
    standing: ['standing-test', 'After the supports.', 'Inspect the original generated poses. The new numerical standing replay has not been run or enabled; fixed objects here are not evidence of standability.'],
  };
  for (const key of ['slice', 'standing']) {
    const [id, title, copy] = descriptions[key];
    const shell = make('section', 'atlas-station'); shell.id = id;
    const mount = make('div', 'atlas-live-mount spatial-gallery'); mount.dataset.atlasMount = key;
    mount.append(makePoster(key, title, copy)); mounts.set(key, mount);
    const caption = make('div', 'atlas-station-note');
    caption.append(make('p', '', copy));
    if (key === 'standing') { const link = make('a', '', 'Watch the separate real-print footage'); link.href = '#examples'; caption.append(link); }
    shell.append(mount, caption); zones.get(key).append(shell);
  }
  const printsScroller = make('div', 'atlas-zone-scroll'); printsScroller.tabIndex = 0;
  printsScroller.setAttribute('aria-label', 'Real-print footage. Scroll this section to see its clips and notes.');
  printsScroller.append(clips); zones.get('prints').append(printsScroller);
  const paperScroller = make('div', 'atlas-zone-scroll atlas-paper-scroll'); paperScroller.id = 'atlas-paper'; paperScroller.tabIndex = 0;
  paperScroller.setAttribute('aria-label', 'Research content. Scroll this section to read the method, results and full text.');
  for (const node of originalNodes) {
    if (node === home || node === clips || node.nodeType === 1 && node.tagName === 'DIALOG') continue;
    paperScroller.append(node);
  }
  zones.get('paper').append(paperScroller);
  main.append(track);

  const dock = make('nav', 'atlas-dock'); dock.setAttribute('aria-label', 'Explore the shared space');
  const locations = make('div', 'atlas-locations');
  const map = make('div', 'atlas-minimap'); map.setAttribute('role', 'group'); map.setAttribute('aria-label', 'Spatial map');
  const navButtons = new Map(), mapButtons = new Map();
  for (const config of ATLAS_ZONES) {
    const go = button(config.label); go.dataset.atlasGo = config.key; navButtons.set(config.key, go); locations.append(go);
    const dot = button('', 'atlas-map-point'); dot.dataset.atlasGo = config.key;
    dot.style.setProperty('--map-x', `${50 + config.x * 25}%`); dot.style.setProperty('--map-y', `${50 + config.y * 25}%`);
    dot.setAttribute('aria-label', `Move to ${config.label}`); dot.title = config.label;
    dot.append(make('span', '', config.label)); mapButtons.set(config.key, dot); map.append(dot);
  }
  const utility = make('div', 'atlas-utility');
  const mapToggle = button('Whole space', 'atlas-map-toggle'); mapToggle.setAttribute('aria-pressed', 'false');
  const modeToggle = button('Document view', 'atlas-mode-toggle'); modeToggle.setAttribute('aria-pressed', 'false');
  const status = make('span', 'atlas-location-status', 'Home');
  utility.append(mapToggle, modeToggle); dock.append(locations, utility);
  const mapWrap = make('div', 'atlas-map-wrap'); mapWrap.append(map, status);
  const help = make('p', 'atlas-scroll-hint', 'Scroll to pull back, move across, and look closer.');
  viewport.append(help); document.body.append(dock, mapWrap, announce);

  function dispatch(name, detail, target = host) { target.dispatchEvent(new CustomEvent(name, {detail})); }
  function anyModalOpen() { return Boolean(document.querySelector('dialog[open]')); }
  function refreshViewer() { requestAnimationFrame(() => dispatch('physrl3d:refresh')); }
  function setViewerActivity(value) {
    const next = String(value);
    if (host.dataset.atlasActive !== next) { host.dataset.atlasActive = next; dispatch('physrl3d:visibility'); }
  }
  function updatePosters() {
    for (const [key, poster] of posters) {
      // The dialog temporarily owns the same viewer; keep its home footprint.
      const live = key === viewerZone;
      poster.hidden = live;
      mounts.get(key).dataset.live = String(live);
    }
  }
  function moveViewer(key) {
    if (!mounts.has(key)) return;
    if (anyModalOpen()) { pendingViewer = key; return; }
    pendingViewer = null;
    const changed = viewerZone !== key || host.parentElement !== mounts.get(key);
    viewerZone = key;
    if (changed) mounts.get(key).prepend(host);
    updatePosters();
    host.dataset.requestedMode = key;
    dispatch('physrl3d:mode', {mode: key});
    if (changed) refreshViewer();
  }
  function emitState(key, moving = false) {
    activeZone = key;
    root.dataset.atlasMode = mode; root.dataset.atlasZone = key; root.dataset.atlasMoving = String(moving);
    const state = `${mode}:${key}:${moving}`;
    if (state === previousState) return;
    previousState = state;
    for (const config of ATLAS_ZONES) {
      const active = config.key === key && !moving;
      zones.get(config.key).dataset.active = String(active);
      for (const node of [navButtons.get(config.key), mapButtons.get(config.key)]) {
        if (active) node.setAttribute('aria-current', 'location'); else node.removeAttribute('aria-current');
      }
    }
    status.textContent = overview ? 'Whole space' : moving ? 'Moving across the space' : ATLAS_ZONES.find(zone => zone.key === key).label;
    if (!moving) announce.textContent = `${status.textContent}. ${mode === 'space' ? 'Scroll to continue, or choose another area.' : 'Document view.'}`;
    dispatch('physrl3d:atlas-zone', {zone: key, mode, active: !moving}, document);
  }
  function setInert(settledKey) {
    for (const [key, zone] of zones) {
      const inert = mode === 'space' && key !== settledKey;
      if (zone.inert !== inert) zone.inert = inert;
    }
  }
  function targetZone(target) {
    if (!target || target === main || target === track) return 'home';
    if (target === host || host.contains(target)) return viewerZone;
    return target.closest?.('.atlas-zone')?.dataset.atlasZone || null;
  }
  function showAnchor() {
    if (!pendingAnchor || targetZone(pendingAnchor) !== activeZone) return;
    const target = pendingAnchor; pendingAnchor = null;
    for (let node = target.parentElement; node && node !== main; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true;
    const scroll = target.closest('.atlas-zone-scroll');
    if (scroll) {
      if (target === scroll) scroll.scrollTop = 0;
      else scroll.scrollTop += target.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 24;
    } else if (target.matches?.('details')) target.open = true;
    // Do not send focus to a hidden native details descendant.
    const hadIndex = target.hasAttribute('tabindex');
    if (!hadIndex) target.setAttribute('tabindex', '-1');
    target.focus?.({preventScroll: true});
    if (!hadIndex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), {once: true});
  }
  function readDocumentZone() {
    let closest = 'home', best = Infinity;
    const threshold = Math.min(innerHeight * .35, 260);
    for (const [key, zone] of zones) {
      const rect = zone.getBoundingClientRect();
      const distance = rect.top <= threshold && rect.bottom >= threshold ? 0 : Math.min(Math.abs(rect.top - threshold), Math.abs(rect.bottom - threshold));
      if (distance < best) { best = distance; closest = key; }
    }
    return closest;
  }
  function render() {
    frame = 0;
    if (anyModalOpen()) return;
    if (mode === 'document') {
      const key = readDocumentZone();
      emitState(key); setInert(null);
      setViewerActivity(key === viewerZone);
      return;
    }
    currentCamera = overview ? {x: 0, y: 0, scale: OVERVIEW_SCALE, index: ATLAS_ZONES.findIndex(zone => zone.key === activeZone), settled: false, phase: 'map'} : cameraAt(progressFromScroll(scrollY, top, travel));
    world.style.transform = worldTransform(currentCamera, width, height);
    const key = ATLAS_ZONES[currentCamera.index].key;
    const moving = !currentCamera.settled;
    setInert(moving ? null : key);
    emitState(key, moving);
    setViewerActivity(!moving && mounts.has(key));
    if (!moving) {
      if (mounts.has(key) && viewerZone !== key) moveViewer(key);
      showAnchor();
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(render); }
  function setOverview(value) {
    overview = value; root.dataset.atlasOverview = String(value);
    mapToggle.setAttribute('aria-pressed', String(value)); mapToggle.textContent = value ? 'Return to detail' : 'Whole space';
    schedule();
  }
  function navigate(key, {target = null, updateHash = false, immediate = false} = {}) {
    const index = ATLAS_ZONES.findIndex(zone => zone.key === key); if (index < 0) return;
    if (anyModalOpen()) { queuedNavigation = {key, target, updateHash, immediate}; return; }
    setOverview(false); pendingAnchor = target;
    if (updateHash) {
      const id = target?.id || ATLAS_ZONES[index].id;
      if (id && location.hash !== `#${id}`) history.pushState(null, '', `#${encodeURIComponent(id)}`);
    }
    document.querySelector('.explore-menu')?.removeAttribute('open');
    if (mode === 'space') {
      window.scrollTo({top: top + travel * stationProgress(index), behavior: immediate || reduced.matches ? 'instant' : 'smooth'});
      schedule();
    } else {
      if (mounts.has(key)) moveViewer(key);
      const destination = target && target !== main ? target : mounts.get(key) || zones.get(key);
      emitState(key); setViewerActivity(mounts.has(key));
      destination.scrollIntoView({block: 'start', behavior: immediate || reduced.matches ? 'instant' : 'smooth'});
      pendingAnchor = null;
    }
  }
  function hashTarget() {
    let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    return id ? document.getElementById(id) : null;
  }
  function updateLayout({preserve = true} = {}) {
    if (anyModalOpen()) { layoutKey = ''; return; }
    const formerMode = mode, key = activeZone;
    width = innerWidth; height = innerHeight;
    const desired = immersiveAllowed(width, height, reduced.matches, documentRequested) ? 'space' : 'document';
    const nextKey = `${desired}:${width}:${height}`;
    if (nextKey === layoutKey) return;
    layoutKey = nextKey; mode = desired; previousState = ''; overview = false;
    root.dataset.atlasMode = mode; root.dataset.atlasOverview = 'false';
    root.classList.add('atlas-ready');
    mapToggle.hidden = mode !== 'space'; mapWrap.hidden = mode !== 'space'; help.hidden = mode !== 'space';
    modeToggle.textContent = mode === 'space' ? 'Document view' : 'Spatial view';
    modeToggle.setAttribute('aria-pressed', String(documentRequested));
    const spatialPossible = immersiveAllowed(width, height, reduced.matches, false);
    modeToggle.disabled = mode !== 'space' && !spatialPossible;
    modeToggle.title = !spatialPossible ? reduced.matches ? 'Reduced-motion preference: document view is enabled.' : 'Spatial view is available in a larger, taller window.' : '';
    if (mode === 'space') {
      travel = (ATLAS_ZONES.length - 1) * TRAVEL_SCREENS * height;
      track.style.height = `${height + travel}px`;
      viewport.style.setProperty('--atlas-width', `${width}px`); viewport.style.setProperty('--atlas-height', `${height}px`);
      top = track.getBoundingClientRect().top + scrollY;
      if (preserve) window.scrollTo({top: top + travel * stationProgress(ATLAS_ZONES.findIndex(zone => zone.key === key)), behavior: 'instant'});
    } else {
      track.style.removeProperty('height'); world.style.removeProperty('transform'); setInert(null);
      if (preserve && formerMode !== mode) zones.get(key).scrollIntoView({block: 'start', behavior: 'instant'});
    }
    updatePosters(); refreshViewer(); schedule();
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const action = event.target.closest?.('[data-atlas-go], [data-atlas-activate]');
    if (action) { navigate(action.dataset.atlasGo || action.dataset.atlasActivate, {updateHash: true}); return; }
    const anchor = event.target.closest?.('a[href]'); if (!anchor) return;
    let url; try { url = new URL(anchor.href, location.href); } catch { return; }
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return;
    let target; try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { return; }
    const key = targetZone(target); if (!key) return;
    event.preventDefault(); navigate(key, {target, updateHash: true});
  });
  dock.addEventListener('keydown', event => {
    if (mode !== 'space' || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = ATLAS_ZONES.findIndex(zone => zone.key === activeZone);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? ATLAS_ZONES.length - 1 : Math.max(0, Math.min(ATLAS_ZONES.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
    navigate(ATLAS_ZONES[next].key); navButtons.get(ATLAS_ZONES[next].key).focus({preventScroll: true});
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && overview && !anyModalOpen()) setOverview(false); });
  mapToggle.addEventListener('click', () => setOverview(!overview));
  modeToggle.addEventListener('click', () => {
    documentRequested = mode === 'space';
    try { localStorage.setItem('physrl3d-atlas-document', String(documentRequested)); } catch { /* Preference still works for this visit. */ }
    updateLayout();
  });
  // Ordinary browser scrolling remains authoritative. No wheel/touch interception.
  window.addEventListener('scroll', () => { if (overview) setOverview(false); schedule(); }, {passive: true});
  window.addEventListener('resize', () => updateLayout(), {passive: true});
  reduced.addEventListener('change', () => updateLayout());
  window.addEventListener('hashchange', () => { const target = hashTarget(), key = targetZone(target); if (key) navigate(key, {target}); });
  // Native close does not bubble. Capture also covers the other existing inspectors.
  document.addEventListener('close', event => {
    if (event.target.tagName !== 'DIALOG') return;
    requestAnimationFrame(() => {
      if (anyModalOpen()) return;
      // Inspector modules restore their own placeholders before this frame.
      if (pendingViewer) moveViewer(pendingViewer);
      updateLayout();
      if (queuedNavigation) { const {key, ...options} = queuedNavigation; queuedNavigation = null; navigate(key, options); }
      else schedule();
    });
  }, true);
  host.addEventListener('physrl3d:ready', () => {
    host.dataset.requestedMode = viewerZone;
    dispatch('physrl3d:mode', {mode: viewerZone}); refreshViewer(); schedule();
  });
  updatePosters();
  // This is a preservation invariant, not an experimental integrity claim.
  for (const id of existingIds) if (!document.getElementById(id)) throw new Error(`Atlas lost an existing anchor: ${id}`);
  updateLayout({preserve: false});
  moveViewer('home');
  requestAnimationFrame(() => { const target = hashTarget(), key = targetZone(target); if (target && key) navigate(key, {target, immediate: true}); else schedule(); });
}
