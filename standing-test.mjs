// Read-only replay helpers. These do not run physics or manufacture outcomes.
export const STANDING_DURATION = 10;
export const TILT_THRESHOLD_DEG = 10;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function tiltDegrees(q) {
  return Math.acos(clamp(1 - 2 * (q[1] ** 2 + q[2] ** 2), -1, 1)) * 180 / Math.PI;
}

export function validateStandingData(input, expectedKey) {
  const unavailable = reason => ({ status: 'unavailable', reason });
  if (!input || typeof input !== 'object') return unavailable('Replay data is missing.');
  if (input.status === 'unsupported') return unavailable(
    typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim().slice(0, 500) : 'This mesh is not supported by the current rigid-body protocol.');
  if (input.status !== 'ready' || input.schemaVersion !== 1 || input.engine !== 'MuJoCo') return unavailable('Replay format or simulation engine could not be verified.');
  if (typeof expectedKey !== 'string' || !expectedKey || input.key !== expectedKey) return unavailable('Replay does not match this model.');
  if (!input.protocol || typeof input.protocol !== 'object' || Array.isArray(input.protocol)) return unavailable('Replay protocol metadata is missing or invalid.');
  if (!Number.isFinite(input.duration_s) || Math.abs(input.duration_s - STANDING_DURATION) > 1e-6) return unavailable('A complete 10-second trajectory is required.');
  if (!Number.isFinite(input.fps) || input.fps <= 0 || input.fps > 240) return unavailable('Replay sampling rate is invalid.');
  const times = input.time_s, states = input.states;
  if (!Array.isArray(times) || !Array.isArray(states) || states.length < 2 || states.length > 10000 || times.length !== states.length) return unavailable('Replay sample counts are inconsistent.');
  if (states.length !== Math.round(input.duration_s * input.fps) + 1) return unavailable('Replay sample count does not match its duration and frame rate.');
  // Allow microsecond-level JSON rounding, not omitted frames or irregular sampling.
  const interval = 1 / input.fps, timeTolerance = Math.max(1e-6, interval * 1e-4);
  if (Math.abs(times[0]) > 1e-8 || Math.abs(times.at(-1) - STANDING_DURATION) > 1e-6) return unavailable('Replay does not cover the full release-to-10-second interval.');
  const clean = [], tilts = [], peaks = [];
  for (let i = 0; i < states.length; i++) {
    if (!Number.isFinite(times[i]) || times[i] < 0 || (i && times[i] <= times[i - 1])) return unavailable('Replay time samples are not strictly increasing.');
    if (Math.abs(times[i] - i * interval) > timeTolerance ||
      (i && Math.abs(times[i] - times[i - 1] - interval) > 2 * timeTolerance)) return unavailable('Replay time samples do not match the declared uniform frame rate.');
    const state = states[i];
    if (!Array.isArray(state) || state.length !== 7 || !state.every(Number.isFinite)) return unavailable('Replay contains an invalid rigid-body pose.');
    const norm = Math.hypot(...state.slice(3));
    if (Math.abs(norm - 1) > 1e-4) return unavailable('Replay contains a non-unit orientation quaternion.');
    const pose = [...state.slice(0, 3), ...state.slice(3).map(v => v / norm)];
    if (!i && (Math.max(...pose.slice(0, 3).map(Math.abs)) > 1e-6 || Math.abs(Math.abs(pose[3]) - 1) > 1e-6 || Math.max(...pose.slice(4).map(Math.abs)) > 1e-6)) return unavailable('Replay does not start at the original generated pose.');
    clean.push(pose);
    tilts.push(tiltDegrees(pose.slice(3)));
    peaks.push(Math.max(tilts[i], peaks[i - 1] || 0));
  }
  return { status: 'ready', engine: input.engine, duration_s: input.duration_s,
    fps: input.fps, time_s: [...times], states: clean, tilts, peaks, protocol: input.protocol,
    caution: typeof input.caution==='string'?input.caution:'',timestepSensitive:input.metrics?.timestepSensitive===true };
}

function slerp(a, b, t) {
  let dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  if (dot < 0) { b = b.map(v => -v); dot = -dot; }
  let q;
  if (dot > .9995) q = a.map((v, i) => v + t * (b[i] - v));
  else {
    const angle = Math.acos(clamp(dot, -1, 1)), denominator = Math.sin(angle);
    const first = Math.sin((1 - t) * angle) / denominator, second = Math.sin(t * angle) / denominator;
    q = a.map((v, i) => first * v + second * b[i]);
  }
  const norm = Math.hypot(...q);
  return q.map(v => v / norm);
}

export function sampleStanding(data, elapsed) {
  if (data?.status !== 'ready') return null;
  const t = clamp(Number.isFinite(elapsed) ? elapsed : 0, 0, data.duration_s);
  let a = 0, hi = data.time_s.length - 1;
  while (a + 1 < hi) {
    const mid = (a + hi) >> 1;
    if (data.time_s[mid] <= t) a = mid; else hi = mid;
  }
  const b = Math.min(a + 1, data.time_s.length - 1);
  const ratio = clamp((t - data.time_s[a]) / (data.time_s[b] - data.time_s[a]), 0, 1);
  const first = data.states[a], second = data.states[b];
  const q = slerp(first.slice(3), second.slice(3), ratio);
  const position = first.slice(0, 3).map((v, i) => v + (second[i] - v) * ratio);
  const tiltDeg = tiltDegrees(q);
  return { elapsed: t, position, quaternion: q, tiltDeg,
    maxTiltDeg: Math.max(data.peaks[a], tiltDeg),
    state: tiltDeg > TILT_THRESHOLD_DEG ? 'Rotated >10°' : 'Within 10°',
    complete: t >= data.duration_s };
}
