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

// --- flows: ẋ = f(x) -----------------------------------------------------------
//
//   findZeros((x) => x - x ** 3, [-2, 2])
//     → [{ x: -1, kind: 'stable' }, { x: 0, kind: 'unstable' }, { x: 1, kind: 'stable' }]
//
// Stability comes from the sign of f on each side: + then − means nearby points flow in (stable),
// − then + means they flow out (unstable), and the same sign on both sides is half-stable.
// Zeros where f only touches the axis (no sign change) are found too.

export function findZeros(f, [a, b], samples = 2000) {
  const h = (b - a) / samples;
  const xs = Array.from({ length: samples + 1 }, (_, i) => a + i * h);
  const gs = xs.map((x) => f(x)); // not xs.map(f): map would pass the index as a second argument
  const scale = Math.max(1e-12, ...gs.map(Math.abs));
  const roots = [];

  for (let i = 0; i <= samples; i++) {
    if (gs[i] === 0) roots.push(xs[i]);
    else if (i < samples && gs[i + 1] !== 0 && gs[i] * gs[i + 1] < 0) roots.push(bisect(f, xs[i], xs[i + 1]));
    else if (i > 0 && i < samples && gs[i - 1] * gs[i] > 0 && gs[i] * gs[i + 1] > 0
      && Math.abs(gs[i]) < Math.abs(gs[i - 1]) && Math.abs(gs[i]) <= Math.abs(gs[i + 1])
      && Math.abs(gs[i]) < 1e-3 * scale) {
      // a dip towards the axis without crossing: does it actually touch?
      const x = minimise((x) => Math.abs(f(x)), xs[i - 1], xs[i + 1]);
      if (Math.abs(f(x)) < 1e-9 * scale) roots.push(x);
    }
  }

  // zeros on the very edge of the range can't be classified (nothing beyond them), so drop them
  const unique = roots.filter((x, i) => x > a + h / 2 && x < b - h / 2 && (i === 0 || x - roots[i - 1] > h));
  const eps = (b - a) * 1e-7;
  return unique.map((x) => {
    const l = Math.sign(f(x - eps)), r = Math.sign(f(x + eps));
    const kind = l > 0 && r < 0 ? 'stable' : l < 0 && r > 0 ? 'unstable' : 'half';
    return { x, kind, slope: slopeAt(f, x) };
  });
}

function minimise(g, lo, hi) {
  const k = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 80; i++) {
    const p = hi - k * (hi - lo), q = lo + k * (hi - lo);
    if (g(p) < g(q)) hi = q; else lo = p;
  }
  return (lo + hi) / 2;
}

// --- flows in the plane: ẋ = f([x, y]) ---------------------------------------------------
//
//   findFixedPoints2D(([x, y]) => [y, -Math.sin(x)], [-4, 4, -3, 3])
//     → [{ x: 0, y: 0, J, tau, det }, { x: 3.14159…, y: 0, … }, …]
//
// Newton's method from a grid of starting points; duplicates merged. J is the Jacobian (numerical),
// and tau / det are its trace and determinant (classify them with systems/linear2d.js).

export function jacobian(f, [x, y], h = 1e-6) {
  const [fxp, gxp] = f([x + h, y]), [fxm, gxm] = f([x - h, y]);
  const [fyp, gyp] = f([x, y + h]), [fym, gym] = f([x, y - h]);
  return { a: (fxp - fxm) / (2 * h), b: (fyp - fym) / (2 * h), c: (gxp - gxm) / (2 * h), d: (gyp - gym) / (2 * h) };
}

export function findFixedPoints2D(f, [x0, x1, y0, y1], n = 9) {
  const found = [];
  const tol = 1e-4 * Math.max(x1 - x0, y1 - y0);
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      let p = [x0 + (i / n) * (x1 - x0), y0 + (j / n) * (y1 - y0)];
      for (let k = 0; k < 50; k++) {
        const [u, v] = f(p), J = jacobian(f, p);
        const D = J.a * J.d - J.b * J.c;
        if (!Number.isFinite(D) || Math.abs(D) < 1e-14) break;
        const step = [(J.d * u - J.b * v) / D, (-J.c * u + J.a * v) / D];
        p = [p[0] - step[0], p[1] - step[1]];
        if (Math.hypot(...step) < 1e-12) break;
      }
      const [u, v] = f(p);
      const inside = p[0] >= x0 - tol && p[0] <= x1 + tol && p[1] >= y0 - tol && p[1] <= y1 + tol;
      if (!p.every(Number.isFinite) || Math.hypot(u, v) > 1e-9 || !inside) continue;
      if (found.some((q) => Math.hypot(q.x - p[0], q.y - p[1]) < tol)) continue;
      const J = jacobian(f, p);
      found.push({ x: p[0], y: p[1], J, tau: J.a + J.d, det: J.a * J.d - J.b * J.c });
    }
  }
  return found.sort((a, b) => a.x - b.x || a.y - b.y);
}
