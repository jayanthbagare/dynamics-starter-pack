// A flow on the line that you draw: ẋ = f(x), with f a smooth curve through 7 heights at
// x = -3, -2, …, 3. Or a named preset with an exact formula.
//
//   makeFlow('cubic')                     // ẋ = x - x³
//   makeFlow('0,1,0.5,-0.5,0.2,-1,-1.5')  // your own curve
import { naturalSpline } from '../core/spline.js';

export const NODES = 7;
export const X_RANGE = [-3, 3];
export const Y_RANGE = [-2, 2];

export const presets = {
  one:      { label: 'one stable point', f: (x) => -0.5 * x },
  cubic:    { label: 'x − x³/3',        f: (x) => x - x ** 3 / 3 },
  touching: { label: 'touching',         f: (x) => 0.35 * (x - 1) ** 2 },
  wavy:     { label: 'wavy',             f: (x) => Math.sin(1.4 * x) },
};

export function makeFlow(spec) {
  const preset = presets[spec];
  const heights = preset ? nodeXs().map(preset.f) : parseHeights(spec);
  const f = preset ? preset.f : naturalSpline(X_RANGE[0], X_RANGE[1], heights).f;
  return { kind: 'flow', dim: 1, name: preset ? preset.label : 'your f', params: {}, f, heights };
}

export const nodeXs = () => Array.from({ length: NODES }, (_, k) => X_RANGE[0] + (k * (X_RANGE[1] - X_RANGE[0])) / (NODES - 1));

export function parseHeights(spec) {
  const v = String(spec).split(',').map(Number);
  if (v.length !== NODES || v.some((y) => !Number.isFinite(y))) return nodeXs().map(presets.cubic.f);
  return v.map((y) => Math.min(Y_RANGE[1], Math.max(Y_RANGE[0], y)));
}

export const encodeHeights = (hs) => hs.map((y) => +y.toFixed(3)).join(',');
