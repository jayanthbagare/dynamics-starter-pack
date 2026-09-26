// Supercritical pitchfork, with a tilt h that breaks the left-right symmetry (h = 0: the pure pitchfork).
export const pitchfork = {
  kind: 'flow', dim: 1, name: 'pitchfork',
  tex: '\\dot x = h + r x - x^3',
  params: { r: -0.5, h: 0 },
  f: (x, { r, h = 0 }) => h + r * x - x ** 3,
  V: (x, { r, h = 0 }) => -h * x - r * x * x / 2 + x ** 4 / 4,
};
