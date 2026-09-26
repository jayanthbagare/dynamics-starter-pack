// Saddle-node normal form: two fixed points meet at r = 0 and annihilate.
export const saddleNode = {
  kind: 'flow', dim: 1, name: 'saddle-node',
  tex: '\\dot x = r + x^2',
  params: { r: -0.5 },
  f: (x, { r }) => r + x * x,
  V: (x, { r }) => -r * x - x ** 3 / 3,           // f = -dV/dx
};
