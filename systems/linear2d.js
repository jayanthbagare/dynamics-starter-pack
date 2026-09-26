// A linear system in the plane: ẋ = A x, with A = [[a, b], [c, d]].
export const linear2d = {
  kind: 'flow',
  dim: 2,
  name: 'linear',
  tex: '\\dot{\\mathbf x} = A\\mathbf x',
  params: { a: -1, b: 1, c: -1, d: -1 },
  f: ([x, y], { a, b, c, d }) => [a * x + b * y, c * x + d * y],
};

// The spring form used on the trace–determinant map: x'' = τ x' − Δ x, written as ẋ = y, ẏ = −Δ x + τ y.
export const springMatrix = (tau, det) => ({ a: 0, b: 1, c: -det, d: tau });

export const trace = ({ a, d }) => a + d;
export const det = ({ a, b, c, d }) => a * d - b * c;

// Eigenvalues of A (real pair, or complex α ± iω) and real eigenvectors when they exist.
export function eigen(A) {
  const t = trace(A), D = det(A), disc = t * t - 4 * D;
  if (disc < 0) {
    return { complex: true, re: t / 2, im: Math.sqrt(-disc) / 2, vectors: [] };
  }
  const s = Math.sqrt(disc);
  const values = [(t + s) / 2, (t - s) / 2];
  const vectors = [];
  for (const l of disc === 0 ? [values[0]] : values) {
    // (A − λI) v = 0: take whichever row gives a usable direction
    let v = Math.hypot(A.b, l - A.a) > 1e-12 ? [A.b, l - A.a]
      : Math.hypot(l - A.d, A.c) > 1e-12 ? [l - A.d, A.c] : null;
    if (v) { const n = Math.hypot(...v); vectors.push([v[0] / n, v[1] / n]); }
    else vectors.push([1, 0], [0, 1]); // A = λI: every direction is an eigenvector (a star)
  }
  return { complex: false, values, vectors: vectors.slice(0, 2) };
}

// Name the portrait from τ and Δ alone. Also returns the dot kind for the fixed point at the origin.
export function classify(tau, D, eps = 1e-9) {
  const disc = tau * tau - 4 * D;
  if (Math.abs(D) < eps) return { name: 'line of fixed points', kind: 'half' };
  if (D < 0) return { name: 'saddle', kind: 'unstable' };
  if (Math.abs(tau) < eps) return { name: 'center', kind: 'half' };
  const side = tau < 0 ? 'stable' : 'unstable';
  if (Math.abs(disc) < eps) return { name: `${side} star or degenerate node`, kind: side };
  return { name: `${side} ${disc > 0 ? 'node' : 'spiral'}`, kind: side };
}
