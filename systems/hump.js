// A one-hump map you can draw: x → a · h(x), where h is a hump over [0, 1] scaled so its peak is 1,
// and a ∈ [0, 1] sets how tall the hump is.
//
//   makeHump('sine')                              // a named preset (exact formula)
//   makeHump('0,0.4,0.8,1,0.7,0.3,0')             // 7 heights at x = 0, 1/6, …, 1 (ends are pinned to 0)
//
// A drawn hump is a natural cubic spline through the heights: its curvature is continuous, so the
// top of the hump is smooth (that matters for universality in Chapter 3).

import { naturalSpline } from '../core/spline.js';

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

// A drawn hump: the spline through the heights, clamped at 0, and its exact highest point.
function spline(ys) {
  const sp = naturalSpline(0, 1, ys);
  const f = (x) => Math.max(0, sp.f(x));
  let peak = 0, best = -Infinity;
  for (const x of [...ys.map((_, k) => k / (ys.length - 1)), ...sp.critical()]) {
    const v = f(x);
    if (v > best) { best = v; peak = x; }
  }
  return { f, peak };
}
