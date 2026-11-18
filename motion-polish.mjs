// Presentation only: no scroll interception, simulation, or changes to model data.
// Content is visible before this module runs and if animation APIs are absent.
const REVEAL_SELECTOR = [
  '.physics-intro', '.motion-intro', '.section-heading', '.hero-copy',
  '.motion-card', '.highlight-card', '.method-stage', '.sas-summary',
  '.print-main-video', 'section > h2', '[data-motion-reveal]'
].join(',');

const SELECTION_SELECTOR = [
  '.physics-picker button', '.inspection-track button',
  '.print-case-picker button', '[data-motion-input]'
].join(',');

export function enhanceMotion(root = document) {
  const page = root.documentElement;
  if (!page || page.dataset.motionPolish === 'ready') return;
  page.dataset.motionPolish = 'ready';
  page.classList.add('motion-ready');

  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const seen = new WeakSet();
  let observer;

  const safeTarget = element => element && !element.matches('canvas') &&
    !element.querySelector('canvas') &&
    !element.closest('.physics-stage, .inspection-stage, .viewer-stage');

  function animate(element, frames, duration = 650) {
    if (preference.matches || !safeTarget(element) || !element.animate) return;
    const animation = element.animate(frames, {
      duration,
      easing: 'cubic-bezier(.2,.75,.25,1)',
      fill: 'none'
    });
    running.add(animation);
    animation.finished.catch(() => {}).finally(() => running.delete(animation));
  }

  // Only first entrances are animated. A heading and its parent never animate
  // together; canvas surfaces and their containing panels are never transformed.
  const candidates = [...root.querySelectorAll(REVEAL_SELECTOR)]
    .filter(safeTarget)
    .filter(element => !element.parentElement?.closest(REVEAL_SELECTOR));
  if ('IntersectionObserver' in globalThis) {
    observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting || seen.has(target)) continue;
        seen.add(target);
        observer.unobserve(target);
        animate(target, [
          { opacity: .3, transform: 'translateY(18px) scale(.97)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ]);
      }
    }, { threshold: .12, rootMargin: '0px 0px -20px 0px' });
    candidates.forEach(element => observer.observe(element));
  }

  // Input thumbnails give a small, immediate focus response when changing an
  // example. It does not animate a renderer, rebuild a model, or delay selection.
  root.addEventListener('click', event => {
    if (preference.matches || !(event.target instanceof Element)) return;
    const control = event.target.closest(SELECTION_SELECTOR);
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    const image = control.matches('img') ? control : control.querySelector('img');
    if (image) animate(image, [
      { opacity: .72, transform: 'scale(.94)' },
      { opacity: 1, transform: 'scale(1)' }
    ], 420);
  });

  // A single passive scroll listener, scheduled only on actual scroll/resize.
  // No perpetual pointer loop and no custom wheel/touch scrolling.
  const progress = root.createElement('div');
  progress.className = 'motion-page-progress';
  progress.setAttribute('aria-hidden', 'true');
  root.body.append(progress);
  let queued = false;
  function updateProgress() {
    queued = false;
    const scroller = root.scrollingElement || page;
    const extent = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const fraction = extent ? Math.max(0, Math.min(1, scroller.scrollTop / extent)) : 0;
    progress.style.transform = `scaleX(${fraction})`;
  }
  function queueProgress() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(updateProgress);
  }
  globalThis.addEventListener('scroll', queueProgress, { passive: true });
  globalThis.addEventListener('resize', queueProgress, { passive: true });
  globalThis.addEventListener('load', queueProgress, { once: true });
  queueProgress();

  function syncPreference() {
    page.classList.toggle('motion-reduced', preference.matches);
    if (preference.matches) {
      for (const animation of running) animation.cancel();
      running.clear();
    }
  }
  preference.addEventListener('change', syncPreference);
  syncPreference();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhanceMotion(), { once: true });
  } else {
    enhanceMotion();
  }
}
