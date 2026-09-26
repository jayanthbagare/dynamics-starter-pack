// Cobweb diagram: the graph y = f(x), the diagonal y = x, and the path of an orbit.
// Each move goes up (or down) to the curve (apply the rule), then across to the diagonal
// (the output becomes the next input).
//
//   createCobweb(canvas, store, {
//     select: (state) => ({
//       f: (x) => Math.cos(x),
//       window: [-0.5, 2.5],            // square data window, used for both axes
//       path: [x0, x1, …],              // the orbit
//       halfSteps: 7,                   // optional: draw only this many segments (animation)
//       fixedPoints: [{ x, kind, label }],  // kind: 'stable' | 'unstable' | 'half'; label optional
//       tangent: { x, slope },          // optional: tangent line at a fixed point
//       highlight: 3,                   // optional: emphasise the move x₂ → x₃
//       lineColour: 'parameter',        // optional: colour the graph as the thing being dialled
//       twinPath: [y0, y1, …],          // optional: a second orbit, dashed with hollow dots
//       points: [[x, y], …],            // optional: scatter (a return map); f may then be omitted
//     }),
//     seedKey: 'x0',                    // drag the ▲ on the x-axis, or focus + ←/→
//     seedRange: [a, b],                // optional clamp for the seed (or a function of state)
//     slope: { key: 'm', pivot: [0.5, 0.5], min: -2, max: 2, snap: [-1, 0, 1] },  // optional
//   });

import { setupCanvas, tokens, scale, ticks, drawAxes, drawFixedPoint } from './canvas.js';

export function createCobweb(canvas, store, { select, seedKey, seedRange = null, slope = null, label = 'Seed x₀' }) {
  let geom = null;
  let drag = null; // 'seed' | 'slope'

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const s = store.get();
    const d = select(s);
    const [lo, hi] = d.window;
    const side = Math.min(w - 50, h - 34);
    const box = { left: 44, top: 8, right: 44 + side, bottom: 8 + side };
    const x = scale([lo, hi], [box.left, box.right]);
    const y = scale([lo, hi], [box.bottom, box.top]);
    const seed = seedKey ? s[seedKey] : d.path?.[0];
    geom = { x, y, box, lo, hi, knob: null, seedPx: x(seed) };

    ctx.clearRect(0, 0, w, h);
    drawAxes(ctx, T, { x, y, box, xTicks: ticks(lo, hi, 5), yTicks: ticks(lo, hi, 5), xLabel: 'xₙ', yLabel: 'xₙ₊₁' });

    ctx.save();
    ctx.beginPath(); ctx.rect(box.left, box.top, side, side); ctx.clip();

    // diagonal y = x
    ctx.strokeStyle = T.muted; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(x(lo), y(lo)); ctx.lineTo(x(hi), y(hi)); ctx.stroke();
    ctx.setLineDash([]);

    // graph of f, one sample per pixel
    if (d.f) {
      ctx.strokeStyle = d.lineColour === 'parameter' ? T.parameter : T.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let pen = false;
      for (let px = box.left; px <= box.right; px += 1) {
        const v = d.f(x.invert(px));
        if (Number.isFinite(v) && Math.abs(v) < 1e6) { pen ? ctx.lineTo(px, y(v)) : ctx.moveTo(px, y(v)); pen = true; }
        else pen = false;
      }
      ctx.stroke();
    }

    // scatter of (xₙ, xₙ₊₁) pairs
    if (d.points) {
      ctx.fillStyle = T.trajectory;
      for (const [px, py] of d.points) {
        ctx.beginPath(); ctx.arc(x(px), y(py), 2.2, 0, 2 * Math.PI); ctx.fill();
      }
    }

    // tangent line at a fixed point
    if (d.tangent) {
      const { x: tx, slope: m } = d.tangent;
      ctx.save();
      ctx.strokeStyle = T.highlight; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(x(lo), y(tx + m * (lo - tx))); ctx.lineTo(x(hi), y(tx + m * (hi - tx))); ctx.stroke();
      ctx.restore();
    }

    // guide from the seed on the axis up to the diagonal
    const path = d.path || [];
    if (Number.isFinite(path[0])) {
      ctx.save();
      ctx.strokeStyle = T.parameter; ctx.globalAlpha = 0.6; ctx.setLineDash([1, 3]);
      ctx.beginPath(); ctx.moveTo(x(path[0]), box.bottom); ctx.lineTo(x(path[0]), y(path[0])); ctx.stroke();
      ctx.restore();
    }

    // the cobweb: vertical to the curve, horizontal to the diagonal
    const segments = (p) => {
      const out = [];
      for (let i = 0; i + 1 < p.length; i++) {
        const a = p[i], b = p[i + 1];
        if (!Number.isFinite(a) || !Number.isFinite(b)) break;
        out.push([a, a, a, b], [a, b, b, b]);
      }
      return out;
    };
    const segs = segments(path);
    const shown = Math.min(segs.length, d.halfSteps ?? segs.length);

    if (d.twinPath) { // drawn first and dashed, so the main path stays readable where they overlap
      const tsegs = segments(d.twinPath).slice(0, d.halfSteps ?? Infinity);
      ctx.save();
      ctx.strokeStyle = T.highlight; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of tsegs) { ctx.moveTo(x(x1), y(y1)); ctx.lineTo(x(x2), y(y2)); }
      ctx.stroke();
      if (tsegs.length) {
        const [, , x2, y2] = tsegs.at(-1);
        ctx.setLineDash([]); ctx.fillStyle = T.bg;
        ctx.beginPath(); ctx.arc(x(x2), y(y2), 4, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = T.trajectory; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < shown; i++) {
      const [x1, y1, x2, y2] = segs[i];
      ctx.moveTo(x(x1), y(y1)); ctx.lineTo(x(x2), y(y2));
    }
    ctx.stroke();
    if (shown > 0) { // leading edge
      const [x1, y1, x2, y2] = segs[shown - 1];
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x(x1), y(y1)); ctx.lineTo(x(x2), y(y2)); ctx.stroke();
      ctx.fillStyle = T.trajectory;
      ctx.beginPath(); ctx.arc(x(x2), y(y2), 3.5, 0, 2 * Math.PI); ctx.fill();
    }
    if (d.highlight != null && d.highlight > 0 && 2 * d.highlight <= shown) {
      ctx.strokeStyle = T.highlight; ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of segs.slice(2 * d.highlight - 2, 2 * d.highlight)) {
        ctx.moveTo(x(x1), y(y1)); ctx.lineTo(x(x2), y(y2));
      }
      ctx.stroke();
    }

    for (const p of d.fixedPoints || []) {
      drawFixedPoint(ctx, T, x(p.x), y(p.x), p.kind);
      if (p.label) {
        ctx.fillStyle = T.ink; ctx.font = `12px ${T.mono}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(p.label, x(p.x) + 10, y(p.x) + 6);
      }
    }
    ctx.restore();

    // slope knob: a handle on the line, a fixed pixel distance from the pivot
    if (slope) {
      const m = s[slope.key];
      const [px0, py0] = slope.pivot;
      const len = 0.32 * side;
      const ang = Math.atan2(m, 1);
      const kx = x(px0) + len * Math.cos(ang), ky = y(py0) - len * Math.sin(ang);
      geom.knob = [kx, ky];
      ctx.save();
      // a diamond, so it can't be mistaken for a (round) fixed-point dot
      ctx.fillStyle = T.parameter; ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(kx, ky - 9); ctx.lineTo(kx + 9, ky); ctx.lineTo(kx, ky + 9); ctx.lineTo(kx - 9, ky);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // seed handle on the x-axis
    if (seedKey && Number.isFinite(seed) && seed >= lo && seed <= hi) {
      const px = x(seed);
      ctx.save();
      ctx.fillStyle = T.parameter;
      ctx.beginPath(); ctx.moveTo(px, box.bottom - 9); ctx.lineTo(px - 7, box.bottom + 3); ctx.lineTo(px + 7, box.bottom + 3);
      ctx.closePath(); ctx.fill();
      if (document.activeElement === canvas) {
        ctx.strokeStyle = T.highlight; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, box.bottom - 2, 12, 0, 2 * Math.PI); ctx.stroke();
      }
      ctx.restore();
    }
  });

  store.subscribe(redraw);

  // --- interaction ---------------------------------------------------------

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const clampSeed = (v) => {
    const r = typeof seedRange === 'function' ? seedRange(store.get()) : seedRange;
    return r ? Math.min(r[1], Math.max(r[0], v)) : v;
  };
  const setSeedFromPx = (px) => {
    const v = geom.x.invert(Math.min(geom.box.right, Math.max(geom.box.left, px)));
    store.set({ [seedKey]: clampSeed(+v.toFixed(4)) });
  };
  const setSlopeFromPx = ([px, py]) => {
    const [x0, y0] = slope.pivot;
    const dx = geom.x.invert(px) - x0, dy = geom.y.invert(py) - y0;
    if (Math.abs(dx) < 1e-6) return;
    let m = dy / dx;
    m = Math.min(slope.max, Math.max(slope.min, m));
    for (const t of slope.snap || []) if (Math.abs(m - t) < 0.04) m = t;
    store.set({ [slope.key]: +m.toFixed(2) });
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!geom) return;
    const p = local(e);
    if (slope && geom.knob && Math.hypot(p[0] - geom.knob[0], p[1] - geom.knob[1]) < 16) drag = 'slope';
    else if (seedKey) { drag = 'seed'; setSeedFromPx(p[0]); }
    if (drag) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = local(e);
    drag === 'seed' ? setSeedFromPx(p[0]) : setSlopeFromPx(p);
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  if (seedKey) {
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'slider');
    canvas.setAttribute('aria-label', `${label}. Use left and right arrow keys; hold Shift for fine steps.`);
    const syncAria = () => {
      const v = store.get()[seedKey];
      canvas.setAttribute('aria-valuenow', v);
      canvas.setAttribute('aria-valuetext', `${label} = ${v}`);
    };
    syncAria();
    store.subscribe((_, changed) => { if (changed.has(seedKey)) syncAria(); });
    canvas.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const stepSize = (geom.hi - geom.lo) / (e.shiftKey ? 1000 : 100);
      const v = store.get()[seedKey] + (e.key === 'ArrowRight' ? stepSize : -stepSize);
      store.set({ [seedKey]: clampSeed(+v.toFixed(4)) });
    });
    canvas.addEventListener('focus', redraw);
    canvas.addEventListener('blur', redraw);
  }

  return { redraw };
}
