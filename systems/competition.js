// Two species competing for the same resource. Each grows logistically on its own (rates r1, r2,
// capacities 1) and is held back by the other with strengths a (on x) and c (on y).
export const competition = { kind: 'flow', dim: 2, params: { r1: 1, r2: 0.8, a: 0.5, c: 0.5 },
  f: ([x, y], { r1, r2, a, c }) => [x * (r1 - x - a * y), y * (r2 - y - c * x)] };
