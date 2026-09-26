// A pendulum: angle θ from straight down, angular velocity ω, gravity g, length L, damping b.
export const pendulum = { kind: 'flow', dim: 2, params: { g: 9.8, L: 1, b: 0 },
  f: ([θ, ω], { g, L, b }) => [ω, -(g / L) * Math.sin(θ) - b * ω] };

// Energy per unit mass·length²: ½ω² + (g/L)(1 − cos θ). Conserved when b = 0.
export const energy = ([θ, ω], { g, L }) => 0.5 * ω * ω + (g / L) * (1 - Math.cos(θ));
