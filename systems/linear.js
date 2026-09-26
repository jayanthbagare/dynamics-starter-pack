// A straight line through the fixed point xs = 0.5 with slope m.
// Every step multiplies the distance to xs by m, so |m| < 1 pulls in and |m| > 1 pushes out.
export const linear = {
  kind: 'map',
  name: 'linear',
  tex: 'x_{n+1} = x^* + m\\,(x_n - x^*)',
  params: { m: -0.8, xs: 0.5 },
  domain: [-0.25, 1.25],
  step: (x, { m, xs }) => xs + m * (x - xs),
};
