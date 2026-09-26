// Press the cos button on a calculator (radians), over and over.
export const cos = {
  kind: 'map',
  name: 'cos',
  tex: 'x_{n+1} = \\cos x_n',
  params: {},
  domain: [-0.5, 2.5],
  step: (x) => Math.cos(x),
};
