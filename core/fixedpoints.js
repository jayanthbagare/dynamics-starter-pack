// Fixed points of a 1D map, found numerically so any system file works without extra math.
//
//   findFixedPoints(Math.cos, [-2, 3])  → [{ x: 0.739085…, slope: -0.673…, kind: 'stable' }]
//
// kind follows the site's dot convention: 'stable' (filled), 'unstable' (hollow),
// 'half' (half-filled, |slope| = 1: the linear test can't decide).

export function findFixedPoints(f, [a, b], samples = 4000) {
  const g = (x) => f(x) - x;
  const h = (b - a) / samples;
  const roots = [];

  let x0 = a, g0 = g(a);
  if (g0 === 0) roots.push(a);
  for (let i = 1; i <= samples; i++) {
    const x1 = a + i * h, g1 = g(x1);
    if (g1 === 0) roots.push(x1);
    else if (g0 !== 0 && g0 * g1 < 0) roots.push(bisect(g, x0, x1));
    x0 = x1; g0 = g1;
  }
  // Note: a fixed point where the graph only touches the diagonal (no sign change) is missed.
  // None of the site's systems need that yet.

  return roots.map((x) => {
    const slope = slopeAt(f, x);
    return { x, slope, kind: classify(slope) };
  });
}

export function slopeAt(f, x, h = 1e-6) {
  const central = (f(x + h) - f(x - h)) / (2 * h);
  if (Number.isFinite(central)) return central;
  return (f(x + h) - f(x)) / h; // e.g. √x at 0, where the left side is undefined
}

export function classify(slope, tol = 1e-9) {
  const s = Math.abs(slope);
  if (Math.abs(s - 1) < tol) return 'half';
  return s < 1 ? 'stable' : 'unstable';
}

function bisect(g, lo, hi) {
  let glo = g(lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, gm = g(mid);
    if (gm === 0) return mid;
    if (glo * gm < 0) hi = mid;
    else { lo = mid; glo = gm; }
  }
  return (lo + hi) / 2;
}
