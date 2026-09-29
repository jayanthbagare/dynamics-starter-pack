// Iterated maps x_{n+1} = f(x_n): orbits, fixed points, and the slope test for stability.
// Pure JavaScript, no DOM. A rule is a plain function step(x, params) → number.
//
//   iterate(Math.cos, 2, 50)                        → [2, -0.416…, 0.914…, …, 0.739…]
//   findFixedPoints1D((x) => Math.cos(x), [-Math.PI, Math.PI])
//                                                   → [{ x: 0.739…, slope: -0.673…, kind: 'stable', alternates: true }]
//
// kind uses the site's dot convention: 'stable' (filled), 'unstable' (hollow), 'half' (|slope| = 1,
// where the slope test can't decide). alternates is true when the slope is negative, so nearby
// orbits hop from one side of x* to the other (the cobweb spirals instead of staircasing).

export function iterate(step, x0, n, params = {}) {
  const xs = [x0];
  let x = x0;
  for (let i = 0; i < n; i++) {
    x = step(x, params);
    xs.push(x);
  }
  return xs;
}

export function slopeAt(f, x, h = 1e-6) {
  return (f(x + h) - f(x - h)) / (2 * h);
}

export function classifySlope(slope, tol = 1e-6) {
  const s = Math.abs(slope);
  if (Math.abs(s - 1) <= tol) return 'half';
  return s < 1 ? 'stable' : 'unstable';
}

// Scan for sign changes of f(x) − x, then bisect. A rule that is the identity on a whole interval
// (every point fixed) has no isolated fixed points, so it returns [].
export function findFixedPoints1D(step, [a, b], params = {}, samples = 4000) {
  const f = (x) => step(x, params);
  const g = (x) => f(x) - x;
  const h = (b - a) / samples;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  if (isIdentity(g, a, b, scale)) return [];

  const roots = [];
  let x0 = a, g0 = g(a);
  for (let i = 1; i <= samples; i++) {
    const x1 = a + i * h, g1 = g(x1);
    if (g0 === 0) roots.push(x0);
    else if (g1 !== 0 && g0 * g1 < 0) roots.push(bisect(g, x0, x1));
    x0 = x1; g0 = g1;
  }
  if (g0 === 0) roots.push(x0);

  return roots
    .filter((x, i) => i === 0 || x - roots[i - 1] > h / 2)
    .map((x) => {
      const slope = slopeAt(f, x);
      return { x, slope, kind: classifySlope(slope), alternates: slope < 0 };
    });
}

function isIdentity(g, a, b, scale) {
  for (let i = 0; i <= 16; i++) if (Math.abs(g(a + (i / 16) * (b - a))) > 1e-12 * scale) return false;
  return true;
}

function bisect(g, lo, hi) {
  let glo = g(lo);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2, gm = g(mid);
    if (gm === 0) return mid;
    if (glo * gm < 0) hi = mid;
    else { lo = mid; glo = gm; }
  }
  return (lo + hi) / 2;
}
