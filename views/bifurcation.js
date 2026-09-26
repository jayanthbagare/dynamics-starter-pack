// Bifurcation diagram: for each parameter value (a column), run the map until the start is
// forgotten, then plot where it keeps landing. The diagram builds live, left to right.
//
//   createBifurcation(canvas, store, {
//     select: (state) => ({
//       key: 'logistic',               // identity of the rule; change it to force a rebuild
//       step: (x, p) => p * x * (1 - x),
//       x0: 0.3,
//       marks: [{ p: 3.449, label: 'r₂' }],   // optional ticks along the top
//     }),
//
// For flows, select can instead return { mode: 'branches', key, f: (x, p) => …, trace: [[p, x], …] }:
// each column then shows the zeros of f, stable ones solid and unstable ones dotted (Strogatz's
// solid/dashed convention), and `trace` draws a path on top (e.g. a ball's history, for hysteresis).
//     paramKey: 'r',                   // click / drag / ←→ set this key
//     windowKeys: ['rlo', 'rhi', 'xlo', 'xhi'],   // the visible window lives in the store (and URL)
//     home: [2.5, 4, 0, 1],            // "reset zoom" goes here
//     toolKey: 'tool',                 // store key: 'pick' (default) or 'zoom' (drag a box)
//     building: 'building',            // optional store key: true while columns are still being computed
//   });
//
// Hits are counted per device pixel and shaded by density, so periodic branches are solid lines
// and chaotic bands are a fine haze. The view keeps only drawing buffers, never simulation state.

import { setupCanvas, tokens, scale, ticks, drawAxes } from './canvas.js';
import { findZeros } from '../core/fixedpoints.js';

const TRANSIENT = 300;

export function createBifurcation(canvas, store, {
  select, paramKey, windowKeys, home, toolKey = null, building = null, label = 'Parameter r',
  xLabel = 'r', yLabel = 'x',
}) {
  const [kLo, kHi, kXlo, kXhi] = windowKeys;
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');
  let img = null;           // ImageData for the diagram, one column per device pixel
  let job = null;           // { sig, col, W, H, … } current build
  let geom = null;
  let drag = null;          // { mode: 'pick' | 'zoom', x0, y0, x1, y1 }
  let colour = null;
  let kinds = null;         // branches mode: 1 stable, 2 unstable, 3 half, per device pixel

  const win = (s) => [s[kLo], s[kHi], s[kXlo], s[kXhi]];

  function startBuild(W, H, d, s) {
    const [plo, phi, xlo, xhi] = win(s);
    off.width = W; off.height = H;
    img = offCtx.createImageData(W, H);
    kinds = new Uint8Array(W * H);
    job = { sig: signature(W, H, d, s), col: 0, W, H, plo, phi, xlo, xhi, step: d.step, x0: d.x0 ?? 0.3,
      keep: Math.max(250, Math.round(H * 0.6)), mode: d.mode || 'density', f: d.f };
    if (building) store.set({ [building]: true });
    requestAnimationFrame(work);
  }

  const signature = (W, H, d, s) => JSON.stringify([d.key, W, H, ...win(s)]);

  // Compute columns for ~8ms per frame, then redraw.
  function work() {
    if (!job) return;
    const j = job, t0 = performance.now();
    const counts = new Uint16Array(j.H);
    const [r, g, b] = colour;
    while (j.mode === 'branches' && j.col < j.W && performance.now() - t0 < 8) {
      const p = j.plo + ((j.col + 0.5) / j.W) * (j.phi - j.plo);
      const dotted = Math.floor(j.col / 4) % 2 === 1;
      for (const z of findZeros((x) => j.f(x, p), [j.xlo, j.xhi], 400)) {
        const kind = z.kind === 'stable' ? 1 : z.kind === 'unstable' ? 2 : 3;
        if (kind === 2 && dotted) continue;
        const row = Math.floor(((j.xhi - z.x) / (j.xhi - j.xlo)) * j.H);
        const t = Math.max(1, Math.round(j.H / 250)); // line thickness in device pixels
        for (let dr = -t; dr <= t; dr++) {
          const rr = row + dr;
          if (rr >= 0 && rr < j.H) paint(j.col, rr, kind, j.W);
        }
      }
      j.col++;
    }
    while (j.mode !== 'branches' && j.col < j.W && performance.now() - t0 < 8) {
      const p = j.plo + ((j.col + 0.5) / j.W) * (j.phi - j.plo);
      counts.fill(0);
      let x = j.x0;
      for (let i = 0; i < TRANSIENT; i++) x = j.step(x, p);
      for (let i = 0; i < j.keep; i++) {
        x = j.step(x, p);
        const row = Math.floor(((j.xhi - x) / (j.xhi - j.xlo)) * j.H);
        if (row >= 0 && row < j.H) counts[row]++;
      }
      for (let row = 0; row < j.H; row++) {
        const k = 4 * (row * j.W + j.col);
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b;
        img.data[k + 3] = counts[row] ? Math.round(255 * (1 - Math.exp(-0.9 * counts[row]))) : 0;
      }
      j.col++;
    }
    offCtx.putImageData(img, 0, 0);
    redraw();
    if (job === j && j.col < j.W) requestAnimationFrame(work);
    else if (job === j && building) store.set({ [building]: false });
  }

  let palette = null;  // branches mode colours by kind
  function paint(col, row, kind, W) {
    const i = row * W + col, k = 4 * i;
    kinds[i] = kind;
    const [r, g, b] = palette[kind];
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
  }

  function recolour() {
    const T = tokens();
    colour = rgb(T.trajectory);
    palette = [null, rgb(T.stable), rgb(T.unstable), rgb(T.ink)];
    if (!img) return;
    for (let i = 0, k = 0; k < img.data.length; i++, k += 4) {
      const [r, g, b] = kinds[i] ? palette[kinds[i]] : colour;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b;
    }
    offCtx.putImageData(img, 0, 0);
  }

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    if (!colour || rgb(T.trajectory).join() !== colour.join()) recolour();
    const s = store.get();
    const d = select(s);
    const [plo, phi, xlo, xhi] = win(s);
    const box = { left: 46, right: w - 12, top: 22, bottom: h - 26 };
    const x = scale([plo, phi], [box.left, box.right]);
    const y = scale([xlo, xhi], [box.bottom, box.top]);
    geom = { x, y, box };

    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round((box.right - box.left) * dpr));
    const H = Math.max(1, Math.round((box.bottom - box.top) * dpr));
    if (!job || job.sig !== signature(W, H, d, s)) startBuild(W, H, d, s);

    ctx.clearRect(0, 0, w, h);
    drawAxes(ctx, T, { x, y, box, xTicks: ticks(plo, phi, 6), yTicks: ticks(xlo, xhi, 5), xLabel, yLabel,
      xFormat: (t) => fmt(t, phi - plo) });
    ctx.drawImage(off, box.left, box.top, box.right - box.left, box.bottom - box.top);

    // build progress: a thin bar under the top edge
    if (job && job.col < job.W) {
      ctx.fillStyle = T.muted;
      ctx.fillRect(box.left, box.top - 3, (box.right - box.left) * (job.col / job.W), 2);
    }

    // marks along the top
    ctx.save();
    ctx.font = `11px ${T.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    let lastLabel = -Infinity;
    for (const m of [...(d.marks || [])].sort((a, b) => a.p - b.p)) {
      if (m.p < plo || m.p > phi) continue;
      ctx.strokeStyle = ctx.fillStyle = m.style === 'predicted' ? T.highlight : T.ink;
      ctx.setLineDash(m.style === 'predicted' ? [3, 3] : []);
      ctx.beginPath(); ctx.moveTo(x(m.p), box.top); ctx.lineTo(x(m.p), box.top + 10); ctx.stroke();
      if (m.label && x(m.p) - lastLabel > 22) { ctx.fillText(m.label, x(m.p), box.top - 4); lastLabel = x(m.p); }
    }
    ctx.restore();

    // a path on top, e.g. the ball's history as the parameter was swept
    if (d.trace?.length) {
      ctx.save();
      ctx.beginPath(); ctx.rect(box.left, box.top, box.right - box.left, box.bottom - box.top); ctx.clip();
      ctx.strokeStyle = T.trajectory; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      d.trace.forEach(([tp, tx], i) => (i ? ctx.lineTo(x(tp), y(tx)) : ctx.moveTo(x(tp), y(tx))));
      ctx.stroke();
      const [lp, lx] = d.trace.at(-1);
      ctx.fillStyle = T.trajectory; ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x(lp), y(lx), 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // the current parameter
    const p = s[paramKey];
    if (p >= plo && p <= phi) {
      ctx.save();
      ctx.strokeStyle = T.parameter; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x(p), box.top); ctx.lineTo(x(p), box.bottom); ctx.stroke();
      ctx.fillStyle = T.parameter;
      ctx.beginPath(); ctx.moveTo(x(p), box.bottom - 9); ctx.lineTo(x(p) - 7, box.bottom + 3); ctx.lineTo(x(p) + 7, box.bottom + 3);
      ctx.closePath(); ctx.fill();
      if (document.activeElement === canvas) {
        ctx.strokeStyle = T.highlight; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x(p), box.bottom - 2, 12, 0, 2 * Math.PI); ctx.stroke();
      }
      ctx.restore();
    }

    // zoom rectangle while dragging
    if (drag?.mode === 'zoom' && drag.x1 != null) {
      ctx.save();
      ctx.strokeStyle = T.highlight; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
      ctx.fillStyle = T.highlight; ctx.globalAlpha = 0.08;
      const rx = Math.min(drag.x0, drag.x1), ry = Math.min(drag.y0, drag.y1);
      const rw = Math.abs(drag.x1 - drag.x0), rh = Math.abs(drag.y1 - drag.y0);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.globalAlpha = 1; ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  });

  store.subscribe(redraw);

  // --- interaction ---------------------------------------------------------

  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const clampX = (px) => Math.min(geom.box.right, Math.max(geom.box.left, px));
  const clampY = (py) => Math.min(geom.box.bottom, Math.max(geom.box.top, py));
  const pick = (px) => {
    const s = store.get();
    const v = geom.x.invert(clampX(px));
    store.set({ [paramKey]: roundTo(v, s[kHi] - s[kLo]) });
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!geom) return;
    const [px, py] = local(e);
    const mode = toolKey && store.get()[toolKey] === 'zoom' ? 'zoom' : 'pick';
    drag = { mode, x0: clampX(px), y0: clampY(py) };
    if (mode === 'pick') pick(px);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [px, py] = local(e);
    if (drag.mode === 'pick') pick(px);
    else { drag.x1 = clampX(px); drag.y1 = clampY(py); redraw(); }
  });
  const end = () => {
    if (drag?.mode === 'zoom' && drag.x1 != null && Math.abs(drag.x1 - drag.x0) > 8 && Math.abs(drag.y1 - drag.y0) > 8) {
      const [a, b] = [drag.x0, drag.x1].map(geom.x.invert).sort((m, n) => m - n);
      const [c, e2] = [drag.y0, drag.y1].map(geom.y.invert).sort((m, n) => m - n);
      store.set({ [kLo]: a, [kHi]: b, [kXlo]: c, [kXhi]: e2, ...(toolKey ? { [toolKey]: 'pick' } : {}) });
    }
    drag = null;
    redraw();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'slider');
  canvas.setAttribute('aria-label', `${label}. Click or drag to choose; left and right arrow keys to adjust, Shift for fine steps.`);
  const syncAria = () => {
    const v = store.get()[paramKey];
    canvas.setAttribute('aria-valuenow', v);
    canvas.setAttribute('aria-valuetext', `${label} = ${v}`);
  };
  syncAria();
  store.subscribe((_, changed) => { if (changed.has(paramKey)) syncAria(); });
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const s = store.get();
    const span = s[kHi] - s[kLo];
    const v = s[paramKey] + (e.key === 'ArrowRight' ? 1 : -1) * span / (e.shiftKey ? 2000 : 200);
    store.set({ [paramKey]: roundTo(v, span) });
  });
  canvas.addEventListener('focus', redraw);
  canvas.addEventListener('blur', redraw);

  return {
    redraw,
    reset: () => store.set({ [kLo]: home[0], [kHi]: home[1], [kXlo]: home[2], [kXhi]: home[3] }),
    zoomOut: () => {
      const s = store.get();
      const [plo, phi, xlo, xhi] = win(s);
      const cp = (plo + phi) / 2, wp = Math.min(home[1] - home[0], (phi - plo) * 2.5);
      const cx = (xlo + xhi) / 2, wx = Math.min(home[3] - home[2], (xhi - xlo) * 2.5);
      const lo = Math.max(home[0], Math.min(cp - wp / 2, home[1] - wp));
      const xl = Math.max(home[2], Math.min(cx - wx / 2, home[3] - wx));
      store.set({ [kLo]: lo, [kHi]: lo + wp, [kXlo]: xl, [kXhi]: xl + wx });
    },
  };
}

// Round a parameter to a sensible number of digits for the current zoom.
function roundTo(v, span) {
  const digits = Math.max(3, Math.ceil(-Math.log10(span)) + 4);
  return +v.toFixed(Math.min(12, digits));
}
function fmt(t, span) {
  const digits = Math.max(0, Math.ceil(-Math.log10(span)) + 1);
  return t.toFixed(Math.min(8, digits));
}
function rgb(css) {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = css;
  const hex = c.fillStyle; // normalised to #rrggbb
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
