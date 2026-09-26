// The pendulum itself (chapter-local): pivot, rod, bob and an angle arc. Drag the bob to set the angle
// (the pendulum is held still while you drag); let go to release it. ←/→ nudge the angle, Space releases.

import { setupCanvas, tokens } from '../../views/canvas.js';

export function createPendulumView(canvas, store, { stateKey, heldKey, onRelease }) {
  let geom = null;

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const s = store.get();
    const [θ, ω] = s[stateKey];
    const cx = w / 2, cy = h * 0.42, R = Math.min(w, h) * 0.36;
    const bx = cx + R * Math.sin(θ), by = cy + R * Math.cos(θ);
    geom = { cx, cy, R };

    ctx.clearRect(0, 0, w, h);
    // the circle the bob can travel on, and "down"
    ctx.strokeStyle = T.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + R + 10); ctx.stroke();
    ctx.setLineDash([]);

    // angle arc
    ctx.strokeStyle = T.parameter; ctx.lineWidth = 1.5;
    ctx.beginPath();
    const a0 = Math.PI / 2, a1 = Math.PI / 2 - θ;
    ctx.arc(cx, cy, R * 0.3, Math.min(a0, a1), Math.max(a0, a1));
    ctx.stroke();
    ctx.fillStyle = T.parameter; ctx.font = `12px ${T.mono}`; ctx.textAlign = 'left';
    ctx.fillText(`θ = ${(θ * 180 / Math.PI).toFixed(0)}°`, cx + 8, cy + R * 0.3 + 16);

    // rod, pivot, bob
    ctx.strokeStyle = T.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = T.ink; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = T.trajectory; ctx.strokeStyle = T.bg; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, 14, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    if (document.activeElement === canvas) {
      ctx.strokeStyle = T.highlight; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 19, 0, 2 * Math.PI); ctx.stroke();
    }

    ctx.fillStyle = T.muted; ctx.textAlign = 'center';
    ctx.fillText(s[heldKey] ? 'held: let go to release' : `ω = ${ω.toFixed(2)} rad/s`, cx, h - 10);
  });

  store.subscribe(redraw);

  const angleAt = (e) => {
    const r = canvas.getBoundingClientRect();
    return Math.atan2(e.clientX - r.left - geom.cx, e.clientY - r.top - geom.cy);
  };
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (!geom) return;
    dragging = true;
    store.set({ [stateKey]: [angleAt(e), 0], [heldKey]: true });
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => { if (dragging) store.set({ [stateKey]: [angleAt(e), 0] }); });
  const end = () => { if (!dragging) return; dragging = false; store.set({ [heldKey]: false }); onRelease(); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', 'Pendulum. Drag the bob to set the angle and let go to release; or use left and right arrows to set the angle and Space to release.');
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const [θ] = store.get()[stateKey];
      store.set({ [stateKey]: [θ + (e.key === 'ArrowLeft' ? 0.05 : -0.05), 0], [heldKey]: true });
    } else if (e.key === ' ') {
      store.set({ [heldKey]: false }); onRelease();
    } else return;
    e.preventDefault(); e.stopPropagation();
  });
  canvas.addEventListener('focus', redraw);
  canvas.addEventListener('blur', redraw);

  return { redraw };
}
