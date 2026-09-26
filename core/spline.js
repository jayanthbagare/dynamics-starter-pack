// Natural cubic spline through equally spaced points: a smooth curve you can shape by dragging
// a handful of heights. Used for drawn humps (Ch 3) and drawn flows (Ch 4).
//
//   const s = naturalSpline(-3, 3, [y0, y1, …, y6]);   // nodes at -3, -2, …, 3
//   s.f(x)          // the curve (clamped to the end values outside [x0, x1])
//   s.critical()    // x where the slope is exactly zero, found per segment in closed form

export function naturalSpline(x0, x1, ys) {
  const n = ys.length, dx = (x1 - x0) / (n - 1);

  // second derivatives M_k, with M_0 = M_{n-1} = 0: a tridiagonal system (Thomas algorithm)
  const M = new Array(n).fill(0), c = new Array(n).fill(0), d = new Array(n).fill(0);
  for (let k = 1; k < n - 1; k++) {
    const rhs = (6 / (dx * dx)) * (ys[k + 1] - 2 * ys[k] + ys[k - 1]);
    const m = 4 - c[k - 1];
    c[k] = 1 / m;
    d[k] = (rhs - d[k - 1]) / m;
  }
  for (let k = n - 2; k >= 1; k--) M[k] = d[k] - c[k] * M[k + 1];

  const node = (k) => x0 + k * dx;
  const seg = (x) => Math.min(n - 2, Math.max(0, Math.floor((x - x0) / dx)));

  function f(x) {
    if (x <= x0) return ys[0];
    if (x >= x1) return ys[n - 1];
    const k = seg(x), a = node(k + 1) - x, b = x - node(k);
    return (M[k] * a ** 3 + M[k + 1] * b ** 3) / (6 * dx)
      + (ys[k] / dx - (M[k] * dx) / 6) * a + (ys[k + 1] / dx - (M[k + 1] * dx) / 6) * b;
  }

  // On segment k the slope is a quadratic in b = x - node(k): A b² + B b + C.
  function critical() {
    const out = [];
    for (let k = 0; k < n - 1; k++) {
      const A = (M[k + 1] - M[k]) / (2 * dx);
      const B = M[k];
      const C = (ys[k + 1] - ys[k]) / dx - (dx / 6) * (2 * M[k] + M[k + 1]);
      let roots;
      if (Math.abs(A) < 1e-14) roots = Math.abs(B) < 1e-14 ? [] : [-C / B];
      else {
        const D = B * B - 4 * A * C;
        roots = D < 0 ? [] : [(-B + Math.sqrt(D)) / (2 * A), (-B - Math.sqrt(D)) / (2 * A)];
      }
      for (const b of roots) if (b >= 0 && b <= dx) out.push(node(k) + b);
    }
    return out;
  }

  return { f, critical };
}
