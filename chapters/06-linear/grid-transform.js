// Primer view (chapter-local): a matrix moving the plane. The grid morphs from the identity to A;
// a test vector v (drag its tip) is drawn with its image Av; A's eigen-directions are the dashed lines
// that stay put while everything else turns.

import { setupCanvas, tokens, scale, ticks, drawAxes } from '../../views/canvas.js';
import { eigen } from '../../systems/linear2d.js';

export function createGridTransform(canvas, store, { select, vKey }) {
  let geom = null, dragging = false;

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const s = store.get();
    const { A, t } = select(s);
    const M = { a: 1 + t * (A.a - 1), b: t * A.b, c: t * A.c, d: 1 + t * (A.d - 1) };   // from I to A
    const apply = (m, [x, y]) => [m.a * x + m.b * y, m.c * x + m.d * y];
    const R = 3.2;
    const side = Math.min(w - 50, h - 34);
    const box = { left: 44, top: 8, right: 44 + side, bottom: 8 + side };
    const x = scale([-R, R], [box.left, box.right]);
    const y = scale([-R, R], [box.bottom, box.top]);
    geom = { x, y, box };

    ctx.clearRect(0, 0, w, h);
    drawAxes(ctx, T, { x, y, box, xTicks: ticks(-3, 3, 6), yTicks: ticks(-3, 3, 6) });
    ctx.save();
    ctx.beginPath(); ctx.rect(box.left, box.top, side, side); ctx.clip();

    // the moved grid
    ctx.strokeStyle = T.muted; ctx.globalAlpha = 0.45; ctx.lineWidth = 1;
    for (let k = -6; k <= 6; k++) {
      for (const [p, q] of [[[k, -6], [k, 6]], [[-6, k], [6, k]]]) {
        const [a, b] = [apply(M, p), apply(M, q)];
        ctx.beginPath(); ctx.moveTo(x(a[0]), y(a[1])); ctx.lineTo(x(b[0]), y(b[1])); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // eigen-directions of A
    const e = eigen(A);
    ctx.strokeStyle = T.highlight; ctx.setLineDash([7, 5]); ctx.lineWidth = 1.5;
    for (const [u, v] of e.vectors) {
      ctx.beginPath(); ctx.moveTo(x(-9 * u), y(-9 * v)); ctx.lineTo(x(9 * u), y(9 * v)); ctx.stroke();
    }
    ctx.setLineDash([]);

    // a ring of unit arrows, moved
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * 2 * Math.PI;
      arrow(ctx, x, y, [0, 0], apply(M, [Math.cos(a), Math.sin(a)]), T.rule, 1.5);
    }

    // test vector v and its image Av
    const v = s[vKey];
    arrow(ctx, x, y, [0, 0], apply(A, v), T.trajectory, 2.5);
    arrow(ctx, x, y, [0, 0], v, T.parameter, 2.5);
    ctx.fillStyle = T.parameter;
    ctx.beginPath(); ctx.arc(x(v[0]), y(v[1]), 6, 0, 2 * Math.PI); ctx.fill();
    ctx.font = `12px ${T.mono}`; ctx.textAlign = 'left';
    ctx.fillText('v', x(v[0]) + 8, y(v[1]) - 8);
    ctx.fillStyle = T.trajectory;
    const Av = apply(A, v);
    ctx.fillText('Av', x(Av[0]) + 8, y(Av[1]) - 8);
    ctx.restore();
  });

  store.subscribe(redraw);

  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const setV = ([px, py]) => {
    const v = [+geom.x.invert(px).toFixed(2), +geom.y.invert(py).toFixed(2)];
    if (Math.hypot(...v) > 0.05) store.set({ [vKey]: v });
  };
  canvas.addEventListener('pointerdown', (e) => { if (!geom) return; dragging = true; setV(local(e)); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (dragging) setV(local(e)); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', 'A matrix moving the plane. Drag, or use left and right arrows, to turn the test vector v.');
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const [vx, vy] = store.get()[vKey];
    const r = Math.hypot(vx, vy), a = Math.atan2(vy, vx) + (e.key === 'ArrowLeft' ? 1 : -1) * (e.shiftKey ? 0.005 : 0.05);
    store.set({ [vKey]: [+(r * Math.cos(a)).toFixed(3), +(r * Math.sin(a)).toFixed(3)] });
  });

  return { redraw };
}

function arrow(ctx, x, y, [ax, ay], [bx, by], colour, width) {
  const x1 = x(ax), y1 = y(ay), x2 = x(bx), y2 = y(by);
  const a = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 1) return;
  ctx.save();
  ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - 6 * Math.cos(a), y2 - 6 * Math.sin(a)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 10 * Math.cos(a - 0.4), y2 - 10 * Math.sin(a - 0.4));
  ctx.lineTo(x2 - 10 * Math.cos(a + 0.4), y2 - 10 * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
