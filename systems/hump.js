// A one-hump map you can draw: x → a · h(x), where h is a hump over [0, 1] scaled so its peak is 1,
// and a ∈ [0, 1] sets how tall the hump is.
//
//   makeHump('sine')                              // a named preset (exact formula)
//   makeHump('0,0.4,0.8,1,0.7,0.3,0')             // 7 heights at x = 0, 1/6, …, 1 (ends are pinned to 0)
//
// A drawn hump is a natural cubic spline through the heights: its curvature is continuous, so the
// top of the hump is smooth (that matters for universality in Chapter 3).

export const NODES = 7;

export const presets = {
  logistic: { label: 'logistic', h: (x) => 4 * x * (1 - x),                peak: 0.5 },
  sine:     { label: 'sine',     h: (x) => Math.sin(Math.PI * x),         peak: 0.5 },
  lopsided: { label: 'lopsided', h: (x) => (x * (1 - x) ** 2) / (4 / 27), peak: 1 / 3 },
  flattop:  { label: 'flat top', h: (x) => 1 - (2 * x - 1) ** 4,          peak: 0.5 },
  tent:     { label: 'tent',     h: (x) => 1 - Math.abs(2 * x - 1),       peak: 0.5 },
};

export function makeHump(spec) {
  const preset = presets[spec];
  const sp = preset ? null : spline(parseHeights(spec));
  const raw = preset ? preset.h : sp.f;
  const c = preset ? preset.peak : sp.peak;
  const top = raw(c);
  const h = (x) => (x <= 0 || x >= 1 ? 0 : raw(x) / top);
  return {
    kind: 'map',
    name: preset ? preset.label : 'your hump',
    params: { a: 0.9 },
    step: (x, { a }) => a * h(x),
    h,
    peak: c,                                                   // where the hump is highest
    raw,                                                       // the curve as drawn (before scaling to peak 1)
    heights: preset ? presetHeights(spec) : parseHeights(spec), // the 7 handle heights, as drawn
  };
}

export function parseHeights(spec) {
  const v = String(spec).split(',').map(Number);
  if (v.length !== NODES || v.some((y) => !Number.isFinite(y))) return presetHeights('logistic');
  v[0] = 0; v[NODES - 1] = 0;
  const clamped = v.map((y) => Math.min(1, Math.max(0, y)));
  if (Math.max(...clamped) < 0.05) clamped[3] = 1; // an empty hump isn't a hump
  return clamped;
}

export const presetHeights = (name) =>
  Array.from({ length: NODES }, (_, k) => presets[name].h(k / (NODES - 1)));

export const encodeHeights = (hs) => hs.map((y) => +y.toFixed(3)).join(',');

// Natural cubic spline through (k/6, y_k), clamped at 0, plus its exact highest point.
function spline(ys) {
  const n = ys.length, dx = 1 / (n - 1);
  // second derivatives M_k: M_0 = M_{n-1} = 0, tridiagonal system solved by the Thomas algorithm
  const M = new Array(n).fill(0), c = new Array(n).fill(0), d = new Array(n).fill(0);
  for (let k = 1; k < n - 1; k++) {
    const rhs = (6 / (dx * dx)) * (ys[k + 1] - 2 * ys[k] + ys[k - 1]);
    const m = 4 - c[k - 1];
    c[k] = 1 / m;
    d[k] = (rhs - d[k - 1]) / m;
  }
  for (let k = n - 2; k >= 1; k--) M[k] = d[k] - c[k] * M[k + 1];

  const seg = (x) => Math.min(n - 2, Math.max(0, Math.floor(x / dx)));
  const cubic = (k, x) => {
    const a = (k + 1) * dx - x, b = x - k * dx;
    return (M[k] * a ** 3 + M[k + 1] * b ** 3) / (6 * dx)
      + (ys[k] / dx - (M[k] * dx) / 6) * a + (ys[k + 1] / dx - (M[k + 1] * dx) / 6) * b;
  };
  const f = (x) => Math.max(0, cubic(seg(x), x));

  // highest point: nodes, plus zeros of each segment's (quadratic) derivative
  let peak = 0, best = -Infinity;
  const consider = (x) => { const v = f(x); if (v > best) { best = v; peak = x; } };
  for (let k = 0; k < n; k++) consider(k * dx);
  for (let k = 0; k < n - 1; k++) {
    // d/dx of the cubic = A b² + B b + C, with b = x - k·dx
    const A = (M[k + 1] - M[k]) / (2 * dx);
    const B = M[k];
    const C = (ys[k + 1] - ys[k]) / dx - (dx / 6) * (2 * M[k] + M[k + 1]);
    const roots = Math.abs(A) < 1e-14 ? (Math.abs(B) < 1e-14 ? [] : [-C / B])
      : (() => { const D = B * B - 4 * A * C; if (D < 0) return [];
          const q = Math.sqrt(D); return [(-B + q) / (2 * A), (-B - q) / (2 * A)]; })();
    for (const b of roots) if (b > 0 && b < dx) consider(k * dx + b);
  }
  return { f, peak };
}
