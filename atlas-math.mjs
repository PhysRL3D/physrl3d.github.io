// Pure presentation math. No physics, evidence selection, or browser state.
export const ATLAS_ZONES = Object.freeze([
  { key: 'home', id: 'support-examples', label: 'Home', x: 0, y: 0 },
  { key: 'slice', id: 'slicing', label: 'Slicing', x: -1.34, y: -1.22 },
  { key: 'standing', id: 'standing-test', label: 'Standing', x: 1.34, y: -1.22 },
  { key: 'prints', id: 'examples', label: 'Real prints', x: 1.34, y: 1.22 },
  { key: 'paper', id: 'atlas-paper', label: 'Research', x: -1.34, y: 1.22 },
].map(Object.freeze));
export const OVERVIEW_SCALE = 0.225;
export const TRAVEL_SCREENS = 2.8;
export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => clamp(a + (b - a) * t, Math.min(a, b), Math.max(a, b));

export function stationProgress(index, count = ATLAS_ZONES.length) {
  return clamp(index / Math.max(1, count - 1));
}

export function cameraAt(progress, zones = ATLAS_ZONES) {
  if (!zones.length) throw new Error('The atlas needs at least one zone.');
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  if (zones.length === 1 || p === 1) {
    const index = zones.length - 1, zone = zones[index];
    return { x: zone.x, y: zone.y, scale: 1, index, phase: 'rest', settled: true, progress: p };
  }
  const segment = p * (zones.length - 1), index = Math.floor(segment), t = segment - index;
  const a = zones[index], b = zones[index + 1];
  if (t < .14) return { x: a.x, y: a.y, scale: 1, index, phase: 'rest', settled: true, progress: p };
  if (t < .36) return { x: a.x, y: a.y, scale: mix(1, OVERVIEW_SCALE, ease((t - .14) / .22)), index, phase: 'pull-back', settled: false, progress: p };
  if (t < .64) {
    const u = ease((t - .36) / .28);
    return { x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), scale: OVERVIEW_SCALE, index: t < .5 ? index : index + 1, phase: 'travel', settled: false, progress: p };
  }
  if (t < .86) return { x: b.x, y: b.y, scale: mix(OVERVIEW_SCALE, 1, ease((t - .64) / .22)), index: index + 1, phase: 'approach', settled: false, progress: p };
  return { x: b.x, y: b.y, scale: 1, index: index + 1, phase: 'rest', settled: true, progress: p };
}

export function worldTransform(camera, width, height) {
  const x = -camera.x * width * camera.scale, y = -camera.y * height * camera.scale;
  return `translate3d(${x.toFixed(4)}px,${y.toFixed(4)}px,0) scale(${camera.scale.toFixed(6)})`;
}

export function projectPoint(point, camera, width, height) {
  return { x: width / 2 + (point.x - camera.x) * width * camera.scale,
    y: height / 2 + (point.y - camera.y) * height * camera.scale };
}

export function progressFromScroll(scroll, top, travel) {
  return travel > 0 ? clamp((scroll - top) / travel) : 0;
}

export function immersiveAllowed(width, height, reduced, documentRequested) {
  return !reduced && !documentRequested && width >= 1000 && height >= 700;
}
