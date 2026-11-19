// Geometry-only display helpers. No infill, wall thickness, material, or physics is inferred.
export function buildSliceIndex(triangles) {
  if (!triangles || triangles.length % 9) throw new TypeError('Expected consecutive XYZ triangle vertices.');
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const zBounds = new Float64Array(triangles.length / 9 * 2);
  for (let i = 0; i < triangles.length; i += 9) {
    let lo = Infinity, hi = -Infinity;
    for (let vertex = 0; vertex < 3; vertex++) {
      for (let axis = 0; axis < 3; axis++) {
        const v = triangles[i + vertex * 3 + axis];
        if (!Number.isFinite(v)) throw new TypeError('Non-finite mesh coordinate.');
        bounds.min[axis] = Math.min(bounds.min[axis], v);bounds.max[axis] = Math.max(bounds.max[axis], v);
      }
      lo = Math.min(lo, triangles[i + vertex * 3 + 2]);hi = Math.max(hi, triangles[i + vertex * 3 + 2]);
    }
    zBounds[i / 9 * 2] = lo;zBounds[i / 9 * 2 + 1] = hi;
  }
  if (!triangles.length) throw new TypeError('Mesh contains no triangles.');
  return { triangles, zBounds, bounds, epsilon: Math.max(1e-7, (bounds.max[2] - bounds.min[2]) * 1e-7) };
}

export function sliceHeight(index, fraction) {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 1));
  const fullHeight = index.bounds.max[2] - index.bounds.min[2];
  return { z: index.bounds.min[2] + fullHeight * f, heightMm: fullHeight * f, fullHeightMm: fullHeight, fraction: f };
}

// Intersect the actual triangles with a horizontal plane. No closing/capping of
// open boundaries: holes and disconnected contours remain as the mesh defines them.
export function intersectSlice(index, height) {
  if (!Number.isFinite(height)) throw new TypeError('A finite cut height is required.');
  const { triangles: t, zBounds, epsilon: eps } = index;
  const positions = [], unique = new Set();let coplanarTriangles = 0;
  const close = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= eps;
  const pointKey = a => a.map(v => Math.round(v / eps)).join(',');
  for (let i = 0, triangle = 0; i < t.length; i += 9, triangle++) {
    if (height < zBounds[triangle * 2] - eps || height > zBounds[triangle * 2 + 1] + eps) continue;
    const points = [[t[i], t[i + 1], t[i + 2]], [t[i + 3], t[i + 4], t[i + 5]], [t[i + 6], t[i + 7], t[i + 8]]];
    const distances = points.map(p => p[2] - height);
    if (distances.every(d => Math.abs(d) <= eps)) { coplanarTriangles++;continue; }
    const intersections = [];
    const add = p => { if (!intersections.some(q => close(p, q))) intersections.push(p); };
    for (let edge = 0; edge < 3; edge++) {
      const next = (edge + 1) % 3, a = points[edge], b = points[next], da = distances[edge], db = distances[next];
      if (Math.abs(da) <= eps) add([a[0], a[1], height]);
      if ((da > eps && db < -eps) || (da < -eps && db > eps)) {
        const u = da / (da - db);add([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, height]);
      }
    }
    if (intersections.length !== 2 || close(...intersections)) continue;
    const keys = intersections.map(pointKey).sort(), key = keys.join('|');
    if (unique.has(key)) continue;unique.add(key);
    positions.push(...intersections[0], ...intersections[1]);
  }
  return { positions: new Float32Array(positions), segmentCount: positions.length / 6, coplanarTriangles };
}
