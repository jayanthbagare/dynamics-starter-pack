// The Lorenz system: a stripped-down model of a fluid heated from below (and of a leaky waterwheel).
// σ: how quickly x follows y. r: how hard the system is driven. b: a geometric factor.
export const lorenz = { kind: 'flow', dim: 3, params: { sigma: 10, r: 28, b: 8 / 3 },
  f: ([x, y, z], { sigma, r, b }) => [sigma * (y - x), r * x - y - x * z, x * y - b * z] };

// Fixed points: the origin, and for r > 1 the pair C± at the centres of the two wings.
export function lorenzFixedPoints({ r, b }) {
  if (r <= 1) return [{ name: 'origin', p: [0, 0, 0] }];
  const c = Math.sqrt(b * (r - 1));
  return [{ name: 'origin', p: [0, 0, 0] }, { name: 'C⁺', p: [c, c, r - 1] }, { name: 'C⁻', p: [-c, -c, r - 1] }];
}
