// Press the √ button, over and over. Only defined for x ≥ 0 (a negative seed gives NaN, "Error").
export const sqrt = {
  kind: 'map',
  name: '√',
  tex: 'x_{n+1} = \\sqrt{x_n}',
  params: {},
  domain: [0, 2.5],
  step: (x) => Math.sqrt(x),
};
