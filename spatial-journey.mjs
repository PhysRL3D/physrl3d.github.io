// Progressive presentation only. Native scrolling, model data and evidence stay intact.
export const CHAPTERS = Object.freeze([
  ['support-examples', 'Examples'],
  ['examples', 'Prints'],
  ['simulation', '3D'],
  ['method', 'Method'],
  ['results', 'Results']
].map(Object.freeze));

// Align the fallback with CSS's "entry 0% → entry 100%" view-timeline range.
export function entryProgress(top, height, viewportHeight) {
  if (![top, height, viewportHeight].every(Number.isFinite) || height <= 0 || viewportHeight <= 0) return 1;
  return Math.max(0, Math.min(1, (viewportHeight - top) / Math.min(height, viewportHeight)));
}

export function enhanceJourney(doc = document, win = window) {
  const page = doc.documentElement;
  if (!page || page.dataset.spatialJourney === 'ready' || !doc.body) return;
  page.dataset.spatialJourney = 'ready';

  const chapters = CHAPTERS.map(([id, label]) => ({ element: doc.getElementById(id), id, label }))
    .filter(chapter => chapter.element);
  const surfaces = ['examples', 'highlights', 'simulation', 'method', 'results', 'prints']
    .map(id => doc.getElementById(id)).filter(Boolean);
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const nativeTimeline = Boolean(win.CSS?.supports?.('animation-timeline', 'view()') &&
    win.CSS?.supports?.('animation-range', 'entry 0% entry 100%'));
  const canObserve = typeof win.IntersectionObserver === 'function';
  const animations = new Map();
  const near = new Set();
  const held = new Set();
  const layout = new Map();
  let frame = 0;
  let layoutDirty = true;

  surfaces.forEach((element, index) => {
    element.classList.add('journey-chapter');
    element.dataset.journeyDirection = index % 2 ? 'right' : 'left';
  });
  page.classList.add('spatial-journey-ready');
  page.classList.toggle('journey-native-timeline', nativeTimeline);

  const dock = doc.createElement('nav');
  dock.className = 'journey-dock';
  dock.setAttribute('aria-label', 'Page chapters');
  dock.hidden = true;
  const links = new Map();
  for (const { id, label } of chapters) {
    const link = doc.createElement('a');
    link.href = `#${id}`;
    link.textContent = label;
    link.className = 'journey-dock-link';
    dock.append(link);
    links.set(id, link);
  }
  doc.body.append(dock);

  function layoutTop(element) {
    let top = 0;
    for (let node = element; node; node = node.offsetParent) top += node.offsetTop || 0;
    return top;
  }

  function measureLayout() {
    for (const { element } of chapters) layout.set(element, { top: layoutTop(element), height: element.offsetHeight });
    for (const element of surfaces) layout.set(element, { top: layoutTop(element), height: element.offsetHeight });
    layoutDirty = false;
  }

  function activeFocusBlocksDock(viewportHeight) {
    const active = doc.activeElement;
    if (!active || active === doc.body || dock.contains(active) || !active.getBoundingClientRect) return false;
    const bounds = active.getBoundingClientRect();
    return bounds.bottom > viewportHeight - 100 && bounds.top < viewportHeight;
  }

  function update() {
    frame = 0;
    if (layoutDirty) measureLayout();
    const viewportHeight = win.innerHeight || page.clientHeight;
    const scrollTop = win.scrollY || 0;
    const focalLine = scrollTop + viewportHeight * .42;
    let closest = null;
    let distance = Infinity;
    for (const chapter of chapters) {
      const box = layout.get(chapter.element);
      const delta = Math.max(box.top - focalLine, focalLine - box.top - box.height, 0);
      if (delta < distance) { closest = chapter.id; distance = delta; }
    }
    for (const [id, link] of links) {
      if (id === closest) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }

    const hero = chapters.find(chapter => chapter.id === 'support-examples');
    const heroBox = hero && layout.get(hero.element);
    const heroVisible = heroBox && heroBox.top + heroBox.height > scrollTop + 90 && heroBox.top < scrollTop + viewportHeight;
    const modalOpen = Boolean(doc.querySelector('dialog[open]'));
    // Keep keyboard focus visible. The dock never covers the homepage's controls.
    dock.hidden = !dock.contains(doc.activeElement) &&
      (heroVisible || modalOpen || activeFocusBlocksDock(viewportHeight));
    page.classList.toggle('journey-dock-visible', !dock.hidden);

    if (nativeTimeline || reduced.matches) return;
    for (const [element, animation] of animations) {
      if (!near.has(element) || held.has(element)) continue;
      const box = layout.get(element);
      animation.currentTime = entryProgress(box.top - scrollTop, box.height, viewportHeight) * 1000;
    }
  }

  function queueUpdate() {
    if (!frame) frame = win.requestAnimationFrame(update);
  }
  function resize() { layoutDirty = true; queueUpdate(); }

  function syncMotionPreference() {
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
    if (reduced.matches) {
      for (const element of held) {
        delete element.dataset.journeyHeld;
        element.style.removeProperty('--journey-held-transform');
      }
      held.clear();
    }
    page.classList.toggle('journey-reduced', reduced.matches);
    if (!reduced.matches && !nativeTimeline && canObserve) {
      for (const element of surfaces) {
        if (!element.animate) continue;
        const shift = win.innerWidth <= 680 ? 6 : 12;
        const x = element.dataset.journeyDirection === 'right' ? shift : -shift;
        const animation = element.animate([
          { transform: `translate3d(${x}px, 36px, 0) scale(.94)` },
          { transform: 'translate3d(0, 0, 0) scale(1)' }
        ], { duration: 1000, fill: 'both', easing: 'cubic-bezier(.22,.68,.25,1)' });
        animation.pause();
        animation.currentTime = 1000; // Always readable if observation is unavailable or delayed.
        animations.set(element, animation);
      }
    }
    queueUpdate();
  }

  // Freeze at the current presentation transform during keyboard or pointer use.
  // Clearing a freeze only happens after interaction leaves that whole chapter.
  function hold(element) {
    if (!element || held.has(element) || reduced.matches) return;
    const matrix = win.getComputedStyle(element).transform;
    held.add(element);
    element.style.setProperty('--journey-held-transform', matrix === 'none' ? 'none' : matrix);
    element.dataset.journeyHeld = 'true';
    animations.get(element)?.pause();
  }
  function release(element) {
    if (!element || element.contains(doc.activeElement) || element.dataset.journeyPointer === 'true') return;
    held.delete(element);
    delete element.dataset.journeyHeld;
    element.style.removeProperty('--journey-held-transform');
    queueUpdate();
  }
  function surfaceFor(target) {
    return target?.closest?.('.journey-chapter');
  }

  doc.addEventListener('focusin', event => { hold(surfaceFor(event.target)); queueUpdate(); });
  doc.addEventListener('focusout', event => {
    const element = surfaceFor(event.target);
    win.setTimeout(() => { release(element); queueUpdate(); }, 0);
  });
  doc.addEventListener('pointerdown', event => {
    const element = surfaceFor(event.target);
    if (!element) return;
    hold(element);
    element.dataset.journeyPointer = 'true';
  }, { passive: true });
  function finishPointer() {
    for (const element of surfaces) {
      if (element.dataset.journeyPointer !== 'true') continue;
      delete element.dataset.journeyPointer;
      release(element);
    }
  }
  win.addEventListener('pointerup', finishPointer, { passive: true });
  win.addEventListener('pointercancel', finishPointer, { passive: true });
  win.addEventListener('blur', finishPointer);
  win.addEventListener('scroll', queueUpdate, { passive: true });
  win.addEventListener('resize', resize, { passive: true });
  win.addEventListener('load', resize, { once: true });
  doc.addEventListener('toggle', queueUpdate, true);
  doc.addEventListener('close', queueUpdate, true);
  doc.addEventListener('click', queueUpdate, { passive: true });

  if (canObserve) {
    const observer = new win.IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (isIntersecting) near.add(target);
        else near.delete(target);
      }
      queueUpdate();
    }, { rootMargin: '20% 0px 20% 0px', threshold: [0, .1, .5, 1] });
    new Set([...surfaces, ...chapters.map(chapter => chapter.element)])
      .forEach(element => observer.observe(element));
  }
  if (typeof win.ResizeObserver === 'function') {
    const observer = new win.ResizeObserver(resize);
    observer.observe(doc.body);
    surfaces.forEach(element => observer.observe(element));
  }
  reduced.addEventListener?.('change', syncMotionPreference);
  syncMotionPreference();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhanceJourney(), { once: true });
  else enhanceJourney();
}
