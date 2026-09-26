// The trace–determinant plane: every linear system ẋ = Ax in the plane is one point (τ, Δ), and the
// point's region names its phase portrait. Drag the point (or use the arrow keys) and it snaps onto the
// special curves: the τ-axis (Δ = 0), the positive Δ-axis (centers) and the parabola τ² = 4Δ.
//
//   createTraceDet(canvas, store, { tauKey: 'tau', detKey: 'det', tauRange: [-4, 4], detRange: [-3, 5] });

import { setupCanvas, tokens, scale, ticks, drawAxes } from './canvas.js';
import { classify, springMatrix, linear2d } from '../systems/linear2d.js';
import { rk4 } from '../core/integrate.js';

const SNAP = 0.1;

export function createTraceDet(canvas, store, { tauKey, detKey, tauRange = [-4, 4], detRange = [-3, 5], label = 'Trace–determinant plane' }) {
  let geom = null;
  let dragging = false;

  const regionOf = (t, D) => classify(t, D, 1e-9).name;

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const s = store.get();
    const tau = s[tauKey], D = s[detKey];
    const [t0, t1] = tauRange, [d0, d1] = detRange;
    const box = { left: 40, right: w - 12, top: 10, bottom: h - 26 };
    const x = scale([t0, t1], [box.left, box.right]);
    const y = scale([d0, d1], [box.bottom, box.top]);
    geom = { x, y, box };

    ctx.clearRect(0, 0, w, h);
    drawAxes(ctx, T, { x, y, box, xTicks: ticks(t0, t1, 8), yTicks: ticks(d0, d1, 8), xLabel: 'τ (trace)', yLabel: 'Δ (determinant)' });

    ctx.save();
    ctx.beginPath(); ctx.rect(box.left, box.top, box.right - box.left, box.bottom - box.top); ctx.clip();

    // shade the region the point is in
    const here = regionOf(tau, D), cellPx = 5;
    ctx.fillStyle = T.highlight; ctx.globalAlpha = 0.09;
    for (let px = box.left; px < box.right; px += cellPx) {
      for (let py = box.top; py < box.bottom; py += cellPx) {
        if (regionOf(x.invert(px + cellPx / 2), y.invert(py + cellPx / 2)) === here) ctx.fillRect(px, py, cellPx, cellPx);
      }
    }
    ctx.globalAlpha = 1;

    // the special curves
    ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(box.left, y(0)); ctx.lineTo(box.right, y(0)); ctx.stroke();             // Δ = 0
    ctx.beginPath(); ctx.moveTo(x(0), y(0)); ctx.lineTo(x(0), box.top); ctx.stroke();                   // centers
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let px = box.left; px <= box.right; px++) { const t = x.invert(px); px === box.left ? ctx.moveTo(px, y(t * t / 4)) : ctx.lineTo(px, y(t * t / 4)); }
    ctx.stroke(); ctx.setLineDash([]);

    // region labels (two short lines each, kept inside the plot), each with a thumbnail of its portrait
    const regions = [
      { t: 0, D: -1.8, name: ['saddles'] },
      { t: -3.1, D: 0.7, name: ['stable', 'nodes'] },
      { t: 3.1, D: 0.7, name: ['unstable', 'nodes'] },
      { t: -1.5, D: 3.5, name: ['stable', 'spirals'] },
      { t: 1.5, D: 3.5, name: ['unstable', 'spirals'] },
    ];
    ctx.font = `11px ${T.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const r of regions) {
      if (r.t < t0 || r.t > t1 || r.D < d0 || r.D > d1) continue;
      const half = Math.max(...r.name.map((l) => ctx.measureText(l).width)) / 2 + 3;
      const cx = Math.min(box.right - half, Math.max(box.left + half, x(r.t)));
      miniPortrait(ctx, T, cx, y(r.D) - 20, r.t, r.D);
      ctx.fillStyle = T.muted;
      r.name.forEach((l, i) => ctx.fillText(l, cx, y(r.D) + 2 + i * 13));
    }
    ctx.fillStyle = T.muted;
    ctx.textAlign = 'left';
    ctx.fillText('centers (τ = 0)', x(0) + 6, box.top + 6);
    ctx.textAlign = 'right';
    ctx.fillText('τ² = 4Δ', x(1.75) - 8, y(1.75 * 1.75 / 4) - 6);
    ctx.restore();

    // the point
    const px = x(tau), py = y(D);
    ctx.save();
    ctx.fillStyle = T.parameter; ctx.strokeStyle = T.bg; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py - 9); ctx.lineTo(px + 9, py); ctx.lineTo(px, py + 9); ctx.lineTo(px - 9, py);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (document.activeElement === canvas) {
      ctx.strokeStyle = T.highlight; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 14, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.restore();
  });

  store.subscribe(redraw);

  // snap onto the special curves when close
  function snapped(t, D) {
    if (Math.abs(D) < SNAP) D = 0;
    if (Math.abs(t) < SNAP && D > 0) t = 0;
    if (Math.abs(D - (t * t) / 4) < SNAP) D = (t * t) / 4;
    return [+t.toFixed(3), +D.toFixed(4)];
  }
  const setFromPx = (px, py) => {
    const t = Math.min(tauRange[1], Math.max(tauRange[0], geom.x.invert(px)));
    const D = Math.min(detRange[1], Math.max(detRange[0], geom.y.invert(py)));
    const [st, sD] = snapped(t, D);
    store.set({ [tauKey]: st, [detKey]: sD });
  };
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => { if (!geom) return; dragging = true; setFromPx(...local(e)); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (dragging) setFromPx(...local(e)); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', `${label}. Drag the point, or use the arrow keys (Shift for fine steps), to choose τ and Δ.`);
  canvas.addEventListener('keydown', (e) => {
    const st = e.shiftKey ? 0.01 : 0.1;
    const mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
    if (!mv) return;
    e.preventDefault();
    const s = store.get();
    const t = Math.min(tauRange[1], Math.max(tauRange[0], s[tauKey] + mv[0]));
    const D = Math.min(detRange[1], Math.max(detRange[0], s[detKey] + mv[1]));
    const [a, b] = e.shiftKey ? [+t.toFixed(3), +D.toFixed(4)] : snapped(t, D);
    store.set({ [tauKey]: a, [detKey]: b });
  });
  canvas.addEventListener('focus', redraw);
  canvas.addEventListener('blur', redraw);

  return { redraw };
}

// A 34-pixel sketch of the portrait at (τ, Δ): a few short trajectories of the spring form.
function miniPortrait(ctx, T, cx, cy, tau, D) {
  const A = springMatrix(tau, D);
  const f = (p) => linear2d.f(p, A);
  const R = 15;
  ctx.save();
  ctx.strokeStyle = T.muted; ctx.lineWidth = 1;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 2 * Math.PI + 0.3;
    let p = [Math.cos(a), Math.sin(a)];
    const sign = tau > 0 && D > 0 ? -1 : 1;         // unstable: draw backwards from the rim so it fits
    const g = sign > 0 ? f : (q) => f(q).map((c) => -c);
    ctx.beginPath(); ctx.moveTo(cx + R * p[0], cy - R * p[1]);
    for (let i = 0; i < 60; i++) {
      p = rk4(g, p, 0.05);
      const m = Math.hypot(...p);
      if (!Number.isFinite(m) || m > 1.2) break;
      ctx.lineTo(cx + R * p[0], cy - R * p[1]);
    }
    ctx.stroke();
  }
  ctx.restore();
}
