// The leaky waterwheel (chapter-local): water pours into the top, every cup leaks, and the wheel turns
// under the weight. Drawn from the Lorenz state after rescaling:
//   x ↔ the wheel's spin,  y ↔ left–right imbalance of the water,  z − (r − 1) ↔ top–bottom imbalance.

import { setupCanvas, tokens } from '../../views/canvas.js';

const CUPS = 12;

export function createWaterwheel(canvas, store, { select }) {
  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const { angle, x, y, z, r } = select(store.get());
    const cx = w / 2, cy = h / 2 + 10, R = Math.min(w, h) * 0.36;

    ctx.clearRect(0, 0, w, h);

    // the pour, at the top
    ctx.strokeStyle = T.trajectory; ctx.globalAlpha = 0.6; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, 6); ctx.lineTo(cx, cy - R - 18); ctx.stroke();
    ctx.globalAlpha = 1;

    // axle and rim
    ctx.strokeStyle = T.rule; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = T.ink; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 2 * Math.PI); ctx.fill();

    // cups: α measured clockwise from the top
    for (let k = 0; k < CUPS; k++) {
      const α = angle + (2 * Math.PI * k) / CUPS;
      const fill = Math.min(1, Math.max(0.04, 0.5 + 0.022 * y * Math.sin(α) - 0.018 * (z - (r - 1)) * Math.cos(α)));
      const px = cx + R * Math.sin(α), py = cy - R * Math.cos(α);
      ctx.strokeStyle = T.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();       // spoke
      const cw = 20, ch = 26;
      ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5;
      ctx.strokeRect(px - cw / 2, py - ch / 2, cw, ch);                            // cups hang upright
      ctx.fillStyle = T.trajectory; ctx.globalAlpha = 0.75;
      ctx.fillRect(px - cw / 2 + 1.5, py + ch / 2 - 1.5 - (ch - 3) * fill, cw - 3, (ch - 3) * fill);
      ctx.globalAlpha = 1;
      // a drip under each cup
      ctx.fillStyle = T.trajectory; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(px, py + ch / 2 + 5, 1.8, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // spin arrow
    const dir = Math.sign(x) || 1;
    ctx.strokeStyle = T.parameter; ctx.fillStyle = T.parameter; ctx.lineWidth = 2.5;
    const a0 = -Math.PI / 2 - 0.9, a1 = -Math.PI / 2 + 0.9;
    ctx.beginPath(); ctx.arc(cx, cy, R + 26, a0, a1); ctx.stroke();
    const ae = dir > 0 ? a1 : a0, ex = cx + (R + 26) * Math.cos(ae), ey = cy + (R + 26) * Math.sin(ae);
    const t = ae + dir * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(ex + 9 * Math.cos(t), ey + 9 * Math.sin(t));
    ctx.lineTo(ex - 5 * Math.cos(t) + 6 * Math.cos(ae), ey - 5 * Math.sin(t) + 6 * Math.sin(ae));
    ctx.lineTo(ex - 5 * Math.cos(t) - 6 * Math.cos(ae), ey - 5 * Math.sin(t) - 6 * Math.sin(ae));
    ctx.closePath(); ctx.fill();

    ctx.font = `12px ${T.mono}`; ctx.fillStyle = T.muted; ctx.textAlign = 'center';
    ctx.fillText(`${dir > 0 ? 'clockwise' : 'anticlockwise'} · spin ${Math.abs(x).toFixed(1)}`, cx, h - 8);
  });
  store.subscribe(redraw);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A leaky waterwheel, turning as water pours in at the top');
  return { redraw };
}
