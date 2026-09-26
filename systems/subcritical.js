// Subcritical pitchfork, held in check by a quintic term: the source of hysteresis.
export const subcritical = {
  kind: 'flow', dim: 1, name: 'subcritical pitchfork',
  tex: '\\dot x = r x + x^3 - x^5',
  params: { r: -0.5 },
  f: (x, { r }) => r * x + x ** 3 - x ** 5,
  V: (x, { r }) => -r * x * x / 2 - x ** 4 / 4 + x ** 6 / 6,
};
