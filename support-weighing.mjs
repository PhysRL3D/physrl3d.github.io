// Presentation timing, not a physics or mass-estimation algorithm.
export const SWEEP_START = 2.8;
export const SWEEP_END = 5.3;
export const WEIGH_TIME = 5.5;
export const RELEASE_TIME = 6.2;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

export function massSummary(record) {
  if (!record || !Number.isFinite(record.body_g) || !Number.isFinite(record.support_g) || record.body_g < 0 || record.support_g < 0) return null;
  const total = record.body_g + record.support_g;
  if (total <= 0) return null;
  return {body:record.body_g, support:record.support_g, total, percent:100 * record.support_g / total};
}

export function sweepPose(start, chunkIndex, radius, time) {
  const delay = (chunkIndex % 9) * .035;
  const progress = smooth((time - SWEEP_START - delay) / (SWEEP_END - SWEEP_START - .28));
  const golden = chunkIndex * 2.3999632297;
  const ring = Math.sqrt(((chunkIndex * 17) % 97) / 96);
  // A compact display pile on the tray. This is not a collision-solved packing.
  const target = [Math.cos(golden)*ring*11, -65+Math.sin(golden)*ring*7, 5.1 + radius*.32 + (chunkIndex%3)*.35];
  const arc = Math.sin(Math.PI * progress);
  return {
    progress,
    position: start.map((v,i)=>v+(target[i]-v)*progress+(i===0?(v>=0?1:-1)*12*arc:i===2?4*arc:0)),
    scale:1-.68*progress,
  };
}
