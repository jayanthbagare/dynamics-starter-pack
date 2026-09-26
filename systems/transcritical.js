// Transcritical normal form: two fixed points cross at r = 0 and swap stability.
export const transcritical = {
  kind: 'flow', dim: 1, name: 'transcritical',
  tex: '\\dot x = r x - x^2',
  params: { r: -0.5 },
  f: (x, { r }) => r * x - x * x,
  V: (x, { r }) => -r * x * x / 2 + x ** 3 / 3,
};
