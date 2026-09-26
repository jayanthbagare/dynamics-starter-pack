// Logistic growth: a population x (as a fraction of capacity) grows fast when small and levels off at 1.
export const logisticGrowth = {
  kind: 'flow',
  dim: 1,
  name: 'logistic growth',
  tex: '\\dot x = x(1 - x)',
  params: {},
  f: (x) => x * (1 - x),
  // exact solution from x(0) = x0, used to check the computer's answer
  exact: (t, x0) => 1 / (1 + (1 / x0 - 1) * Math.exp(-t)),
};
