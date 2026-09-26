// Draw-your-own hump: five draggable heights (the ends stay at 0). Chapter-local.
// The hump lives in the store as a string (a preset name or 7 heights), so a link reproduces it.

import { makeHump, NODES, encodeHeights } from '../../systems/hump.js';
import { setupCanvas, tokens, scale, ticks, drawAxes } from '../../views/canvas.js';

export function createHumpEditor(canvas, store, { key = 'hump' } = {}) {
  let geom = null;
  let active = 3;       // handle chosen for keyboard control
  let dragging = null;

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const hump = makeHump(store.get()[key]);
    const box = { left: 40, right: w - 12, top: 10, bottom: h - 26 };
    const x = scale([0, 1], [box.left, box.right]);
    const y = scale([0, 1.05], [box.bottom, box.top]);
    geom = { x, y, box, heights: hump.heights };

    ctx.clearRect(0, 0, w, h);
    drawAxes(ctx, T, { x, y, box, xTicks: ticks(0, 1, 4), yTicks: [0, 0.5, 1], xLabel: 'x', yLabel: 'h(x)' });

    // peak marker
    ctx.save();
    ctx.strokeStyle = T.muted; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x(hump.peak), box.bottom); ctx.lineTo(x(hump.peak), y(hump.raw(hump.peak))); ctx.stroke();
    ctx.fillStyle = T.muted; ctx.font = `11px ${T.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('peak', x(hump.peak), box.bottom - 4);
    ctx.restore();

    // the hump
    ctx.strokeStyle = T.ink; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = box.left; px <= box.right; px++) {
      const v = hump.raw(x.invert(px));
      px === box.left ? ctx.moveTo(px, y(v)) : ctx.lineTo(px, y(v));
    }
    ctx.stroke();

    // handles: diamonds (controls), fixed ends as small squares
    hump.heights.forEach((v, k) => {
      const px = x(k / (NODES - 1)), py = y(v);
      ctx.save();
      if (k === 0 || k === NODES - 1) {
        ctx.fillStyle = T.muted; ctx.fillRect(px - 3, py - 3, 6, 6);
      } else {
        ctx.fillStyle = T.parameter; ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py - 8); ctx.lineTo(px + 8, py); ctx.lineTo(px, py + 8); ctx.lineTo(px - 8, py);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (k === active && document.activeElement === canvas) {
          ctx.strokeStyle = T.highlight; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, py, 13, 0, 2 * Math.PI); ctx.stroke();
        }
      }
      ctx.restore();
    });
  });

  store.subscribe(redraw);

  const setHeight = (k, v) => {
    const hs = [...geom.heights];
    hs[k] = Math.min(1, Math.max(0, v));
    store.set({ [key]: encodeHeights(hs) });
  };
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  canvas.addEventListener('pointerdown', (e) => {
    if (!geom) return;
    const [px, py] = local(e);
    // nearest movable handle by horizontal position
    const k = Math.round(geom.x.invert(px) * (NODES - 1));
    if (k < 1 || k > NODES - 2) return;
    dragging = active = k;
    setHeight(k, geom.y.invert(py));
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging == null) return;
    setHeight(dragging, geom.y.invert(local(e)[1]));
  });
  const end = () => { dragging = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', 'Hump editor. Left and right arrows choose a handle; up and down arrows move it; hold Shift for fine steps.');
  canvas.addEventListener('keydown', (e) => {
    if (!geom) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      active = Math.min(NODES - 2, Math.max(1, active + (e.key === 'ArrowRight' ? 1 : -1)));
      redraw();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const d = (e.shiftKey ? 0.005 : 0.03) * (e.key === 'ArrowUp' ? 1 : -1);
      setHeight(active, geom.heights[active] + d);
    } else return;
    e.preventDefault();
  });
  canvas.addEventListener('focus', redraw);
  canvas.addEventListener('blur', redraw);

  return { redraw };
}
