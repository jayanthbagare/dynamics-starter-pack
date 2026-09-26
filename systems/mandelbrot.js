// The map behind the Mandelbrot set (Ch 10): z_{n+1} = z_n^2 + c, with z = x + iy.
// Squaring a complex number couples the two coordinates, so the state is a pair.

export const mandelbrot = { kind: 'map', dim: 2, params: { cx: -0.75, cy: 0.1 },
  step: ([x, y], { cx, cy }) => [x * x - y * y + cx, 2 * x * y + cy] };
