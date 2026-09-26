// The logistic map: a hump of height r/4 over [0, 1].
// At r = 4 it is fully chaotic; lower r gives calmer behaviour (Chapter 3 explores the whole range).
export const logistic = {
  kind: 'map',
  name: 'logistic',
  tex: 'x_{n+1} = r\\,x_n (1 - x_n)',
  params: { r: 4 },
  domain: [0, 1],
  step: (x, { r }) => r * x * (1 - x),
};
