// The Mimic's reef: a one-hump rule the player shapes, guaranteed to have a single, smooth,
// quadratic maximum. Pure JavaScript, no DOM.
//
//   const reef = createHump({ peak: 0.5, left: [[0.15, 0.5], [0.3, 0.84]], right: [[0.7, 0.84], [0.85, 0.5]] });
//   reef.h(x)      height in [0, 1]; h(0) = h(1) = 0; h(peak) = 1
//   reef.c         the peak
//   reef.points    the handles after sanitizing (what the editor should show)
//
// Construction: h(x) = 1 − s(x)², where s rises from −1 at 0 to +1 at 1 through a monotone cubic
// (Fritsch–Carlson) spline, with a knot exactly where s = 0. Because s only rises, h climbs to one
// peak and falls; because s′ > 0 at that knot, h″(c) = −2 s′(c)² < 0: a quadratic top.
// Handles: flank points (x, h). Left heights must rise towards the peak, right heights fall.

const GAP = 0.02;     // minimum spacing between handles, in x and in h

export function sanitize({ peak, left, right }) {
  const c = Math.min(0.8, Math.max(0.2, peak));
  // Each handle i of n gets a slot that leaves room (GAP) for its neighbours, in x and in h;
  // then one pass makes x increase and h rise towards the peak.
  const side = (pts, lo, hi, rising) => {
    const n = pts.length;
    const sorted = [...pts].map(([x, h]) => [x, h]).sort((a, b) => a[0] - b[0]);
    sorted.forEach((p, i) => {
      p[0] = Math.min(hi - GAP * (n - i), Math.max(lo + GAP * (i + 1), p[0]));
      const up = rising ? i : n - 1 - i;   // rank from the low end of the flank
      p[1] = Math.min(1 - GAP * (n - up), Math.max(GAP * (up + 1), p[1]));
    });
    for (let i = 1; i < n; i++) sorted[i][0] = Math.max(sorted[i][0], sorted[i - 1][0] + GAP);
    if (rising) for (let i = 1; i < n; i++) sorted[i][1] = Math.max(sorted[i][1], sorted[i - 1][1] + GAP);
    else for (let i = n - 2; i >= 0; i--) sorted[i][1] = Math.max(sorted[i][1], sorted[i + 1][1] + GAP);
    return sorted;
  };
  return { peak: c, left: side(left, 0, c, true), right: side(right, c, 1, false) };
}

// Fritsch–Carlson monotone cubic through strictly increasing (xs, ys)
export function monotoneSpline(xs, ys) {
  const n = xs.length;
  const d = [], m = new Array(n);
  for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    const a = m[k] / d[k], b = m[k + 1] / d[k], t = a * a + b * b;
    if (t > 9) { const tau = 3 / Math.sqrt(t); m[k] = tau * a * d[k]; m[k + 1] = tau * b * d[k]; }
  }
  const f = (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let k = 0;
    while (x > xs[k + 1]) k++;
    const hk = xs[k + 1] - xs[k], t = (x - xs[k]) / hk;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * hk * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * hk * m[k + 1];
  };
  return { f, slopes: m };
}

export function createHump(spec) {
  const points = sanitize(spec);
  const { peak: c, left, right } = points;
  const xs = [0, ...left.map((p) => p[0]), c, ...right.map((p) => p[0]), 1];
  const ys = [-1, ...left.map((p) => -Math.sqrt(1 - p[1])), 0, ...right.map((p) => Math.sqrt(1 - p[1])), 1];
  const s = monotoneSpline(xs, ys);
  const h = (x) => (x <= 0 || x >= 1 ? 0 : Math.max(0, 1 - s.f(x) ** 2));
  return { h, c, points, s: s.f };
}

// handles for a hump given as a formula (peak value 1), for presets
export function handlesFrom(fn, c, xsLeft, xsRight) {
  return { peak: c, left: xsLeft.map((x) => [x, fn(x)]), right: xsRight.map((x) => [x, fn(x)]) };
}

export const PRESETS = {
  logistic: handlesFrom((x) => 4 * x * (1 - x), 0.5, [0.1, 0.25, 0.4], [0.6, 0.75, 0.9]),
  sine: handlesFrom((x) => Math.sin(Math.PI * x), 0.5, [0.1, 0.25, 0.4], [0.6, 0.75, 0.9]),
  lopsided: handlesFrom((x) => (x * (1 - x) ** 2) / (4 / 27), 1 / 3, [0.08, 0.18, 0.27], [0.45, 0.65, 0.85]),
};
