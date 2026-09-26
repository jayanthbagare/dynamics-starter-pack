// Supercritical Hopf normal form. In polar coordinates: ṙ = μr − r³, θ̇ = ω.
// For μ < 0 the origin is a stable spiral; for μ > 0 it is unstable and a stable loop of radius √μ appears.
export const hopf = { kind: 'flow', dim: 2, params: { mu: 0.2, omega: 1 },
  f: ([x, y], { mu, omega }) => {
    const r2 = x * x + y * y;
    return [mu * x - omega * y - r2 * x, omega * x + mu * y - r2 * y];
  } };
