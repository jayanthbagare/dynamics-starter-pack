// Advancing a system in time.
//
// Maps:  orbit(step, x0, n, params)   → [x0, x1, …, xn]
// Flows: euler / rk4 take one step of size dt for ẋ = f(x). The state x may be a number
//        (1D flows) or an array (2D, 3D). f has the signature f(x, params).

export function orbit(step, x0, n, params = {}) {
  const xs = [x0];
  let x = x0;
  for (let i = 0; i < n; i++) {
    x = step(x, params);
    xs.push(x);
  }
  return xs;
}

export function euler(f, x, dt, params = {}) {
  return axpy(x, f(x, params), dt);
}

export function rk4(f, x, dt, params = {}) {
  const k1 = f(x, params);
  const k2 = f(axpy(x, k1, dt / 2), params);
  const k3 = f(axpy(x, k2, dt / 2), params);
  const k4 = f(axpy(x, k3, dt), params);
  // x + dt/6 · (k1 + 2k2 + 2k3 + k4)
  return axpy(x, combine(k1, k2, k3, k4), dt / 6);
}

// x + s·v, for numbers or arrays
function axpy(x, v, s) {
  return typeof x === 'number' ? x + s * v : x.map((xi, i) => xi + s * v[i]);
}

function combine(k1, k2, k3, k4) {
  return typeof k1 === 'number'
    ? k1 + 2 * k2 + 2 * k3 + k4
    : k1.map((_, i) => k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}
