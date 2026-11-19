// Pure presentation math. No physics, evidence selection, or browser state.
export const ATLAS_ZONES = Object.freeze([
  { key: 'home', id: 'support-examples', label: 'Home', x: 0, y: 0 },
  { key: 'slice', id: 'slicing', label: 'Slicing', x: -1.34, y: -1.22 },
  { key: 'standing', id: 'standing-test', label: 'Standing', x: 1.34, y: -1.22 },
  { key: 'prints', id: 'examples', label: 'Real prints', x: 1.34, y: 1.22 },
  { key: 'paper', id: 'atlas-paper', label: 'Research', x: -1.34, y: 1.22 },
].map(Object.freeze));
export const OVERVIEW_SCALE = 0.225;
export const TRAVEL_SCALE = 0.62;
export const TRAVEL_SCREENS = 1.1;
export const DIRECT_NAV_MS = 480;
export const MAP_NAV_MS = 300;
export const SETTLE_NAV_MS = 180;
export const SCROLL_IDLE_MS = 160;
export const INTERRUPT_BLEND_MS = 120;
export const STATION_EPSILON = 0.001;
export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => clamp(a + (b - a) * t, Math.min(a, b), Math.max(a, b));

export function stationProgress(index, count = ATLAS_ZONES.length) {
  return clamp(index / Math.max(1, count - 1));
}

export function cameraBetween(from, to, progress, dip = true) {
  const t = clamp(Number.isFinite(progress) ? progress : 0);
  if (t === 0) return {x: from.x, y: from.y, scale: from.scale};
  if (t === 1) return {x: to.x, y: to.y, scale: to.scale};
  const u = ease(t), baseScale = mix(from.scale, to.scale, u);
  const depth = dip ? Math.max(0, Math.min(from.scale, to.scale) - TRAVEL_SCALE) : 0;
  return {x: mix(from.x, to.x, u), y: mix(from.y, to.y, u),
    scale: Math.max(Math.min(from.scale, to.scale, TRAVEL_SCALE), baseScale - depth * Math.sin(Math.PI * t))};
}

export function cameraAt(progress, zones = ATLAS_ZONES) {
  if (!zones.length) throw new Error('The atlas needs at least one zone.');
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  if (zones.length === 1 || p === 1) {
    const index = zones.length - 1, zone = zones[index];
    return { x: zone.x, y: zone.y, scale: 1, index, phase: 'rest', settled: true, progress: p };
  }
  const segment = p * (zones.length - 1), index = Math.floor(segment), t = segment - index;
  // scrollY may be rounded to a CSS pixel even when a viewport multiple is not.
  const nearest = Math.round(segment);
  if (Math.abs(segment - nearest) <= STATION_EPSILON) {
    const zone = zones[nearest];
    return {x: zone.x, y: zone.y, scale: 1, index: nearest, phase: 'rest', settled: true, progress: p};
  }
  const a = zones[index], b = zones[index + 1];
  if (t === 0) return {x: a.x, y: a.y, scale: 1, index, phase: 'rest', settled: true, progress: p};
  return {...cameraBetween({...a, scale: 1}, {...b, scale: 1}, t),
    index: t < .5 ? index : index + 1, phase: t < .5 ? 'depart' : t > .5 ? 'approach' : 'travel', settled: false, progress: p};
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
