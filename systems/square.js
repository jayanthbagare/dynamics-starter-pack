// Press the x² button, over and over.
export const square = {
  kind: 'map',
  name: 'x²',
  tex: 'x_{n+1} = x_n^2',
  params: {},
  domain: [-0.5, 1.6],
  step: (x) => x * x,
};
