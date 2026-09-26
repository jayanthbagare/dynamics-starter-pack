// The van der Pol oscillator: negative damping for small x (it pumps energy in), positive damping for
// large x (it drains energy). The balance is a single isolated loop, a limit cycle.
export const vanderpol = { kind: 'flow', dim: 2, params: { mu: 1 },
  f: ([x, y], { mu }) => [y, mu * (1 - x * x) * y - x] };
