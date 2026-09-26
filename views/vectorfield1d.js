// A flow on the line, drawn the way Strogatz draws it: the graph of ẋ = f(x), with the x-axis
// doubling as the phase line. Arrows on the axis show which way x moves (longer = faster);
// fixed points are the zeros of f, drawn filled (stable), hollow (unstable) or half-filled.
//
//   createVectorField1D(canvas, store, {
//     select: (state) => ({
//       f: (x) => x - x ** 3,
//       xRange: [-3, 3], yRange: [-2, 2],
//       particles: [0.4, -1.2],          // optional: dots riding the phase line
//       handles: { xs: [...], ys: [...] },  // optional: ◆ handles for drawing f
//     }),
//     onHandle: (k, y) => ({ … }),      // optional: patch to apply when handle k is moved to height y
//     onAxis: (x, event) => {},         // optional: click on the plot away from handles (drop a particle)
//   });

import { setupCanvas, tokens, scale, ticks, drawAxes, drawFixedPoint } from './canvas.js';
import { findZeros } from '../core/fixedpoints.js';

export function createVectorField1D(canvas, store, { select, onHandle = null, onAxis = null, label = 'Phase line' }) {
  let geom = null;
  let active = 3;
  let dragging = null;

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const d = select(store.get());
    const [x0, x1] = d.xRange, [y0, y1] = d.yRange;
    const box = { left: 40, right: w - 12, top: 10, bottom: h - 26 };
    const x = scale([x0, x1], [box.left, box.right]);
    const y = scale([y0, y1], [box.bottom, box.top]);
    const zeros = d.fixedPoints ?? findZeros(d.f, d.xRange);
    geom = { x, y, box, handles: d.handles };

    ctx.clearRect(0, 0, w, h);
    drawAxes(ctx, T, { x, y, box, xTicks: ticks(x0, x1, 6), yTicks: ticks(y0, y1, 4), xLabel: 'x', yLabel: 'ẋ = f(x)' });

    ctx.save();
    ctx.beginPath(); ctx.rect(box.left, box.top, box.right - box.left, box.bottom - box.top); ctx.clip();

    // the phase line (the axis ẋ = 0)
    const ay = y(0);
    ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(box.left, ay); ctx.lineTo(box.right, ay); ctx.stroke();

    // graph of f
    ctx.strokeStyle = d.handles ? T.parameter : T.ink; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = box.left; px <= box.right; px++) {
      const v = d.f(x.invert(px));
      px === box.left ? ctx.moveTo(px, y(v)) : ctx.lineTo(px, y(v));
    }
    ctx.stroke();

    // arrows on the phase line: direction = sign of f, length grows with speed
    const N = 18, fmax = Math.max(1e-9, ...Array.from({ length: 200 }, (_, i) => Math.abs(d.f(x0 + ((i + 0.5) / 200) * (x1 - x0)))));
    ctx.fillStyle = T.ink; ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5;
    for (let i = 0; i < N; i++) {
      const xv = x0 + ((i + 0.5) / N) * (x1 - x0);
      const v = d.f(xv);
      const near = zeros.some((z) => Math.abs(x(z.x) - x(xv)) < 12);
      if (near || Math.abs(v) < 1e-3 * fmax) continue;
      const len = 6 + 12 * Math.min(1, Math.abs(v) / fmax), dir = Math.sign(v), cx = x(xv);
      ctx.beginPath(); ctx.moveTo(cx - (dir * len) / 2, ay); ctx.lineTo(cx + (dir * len) / 2 - dir * 4, ay); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + (dir * len) / 2 + dir * 2, ay); ctx.lineTo(cx + (dir * len) / 2 - dir * 5, ay - 4); ctx.lineTo(cx + (dir * len) / 2 - dir * 5, ay + 4);
      ctx.closePath(); ctx.fill();
    }

    // particles ride the line
    for (const p of d.particles || []) {
      if (p < x0 || p > x1) continue;
      ctx.fillStyle = T.trajectory; ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x(p), ay - 9, 4.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    for (const z of zeros) drawFixedPoint(ctx, T, x(z.x), ay, z.kind, 6.5);

    // handles
    if (d.handles) {
      d.handles.xs.forEach((hx, k) => {
        const px = x(hx), py = y(d.handles.ys[k]);
        ctx.save();
        ctx.fillStyle = T.parameter; ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py - 8); ctx.lineTo(px + 8, py); ctx.lineTo(px, py + 8); ctx.lineTo(px - 8, py);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (k === active && document.activeElement === canvas) {
          ctx.strokeStyle = T.highlight; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, py, 13, 0, 2 * Math.PI); ctx.stroke();
        }
        ctx.restore();
      });
    }
  });

  store.subscribe(redraw);

  // --- interaction ---------------------------------------------------------

  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const nearHandle = (px, py) => {
    if (!geom?.handles || !onHandle) return -1;
    const { xs, ys } = geom.handles;
    let best = -1, bd = 18;
    xs.forEach((hx, k) => { const dd = Math.hypot(geom.x(hx) - px, geom.y(ys[k]) - py); if (dd < bd) { bd = dd; best = k; } });
    return best;
  };
  const setHandle = (k, v) => {
    const [lo, hi] = [geom.y.invert(geom.box.bottom), geom.y.invert(geom.box.top)];
    store.set(onHandle(k, Math.min(hi, Math.max(lo, v))));
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!geom) return;
    const [px, py] = local(e);
    const k = nearHandle(px, py);
    if (k >= 0) {
      dragging = active = k;
      canvas.setPointerCapture(e.pointerId);
    } else if (onAxis && px >= geom.box.left && px <= geom.box.right) {
      onAxis(geom.x.invert(px), e);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging == null) return;
    setHandle(dragging, geom.y.invert(local(e)[1]));
  });
  const end = () => { dragging = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  if (onHandle) {
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', `${label}. Left and right arrows choose a handle; up and down arrows move it; hold Shift for fine steps.`);
    canvas.addEventListener('keydown', (e) => {
      if (!geom?.handles) return;
      const n = geom.handles.xs.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        active = Math.min(n - 1, Math.max(0, active + (e.key === 'ArrowRight' ? 1 : -1)));
        redraw();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const step = (e.shiftKey ? 0.01 : 0.1) * (e.key === 'ArrowUp' ? 1 : -1);
        setHandle(active, geom.handles.ys[active] + step);
      } else return;
      e.preventDefault();
    });
    canvas.addEventListener('focus', redraw);
    canvas.addEventListener('blur', redraw);
  } else {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
  }

  return { redraw };
}
