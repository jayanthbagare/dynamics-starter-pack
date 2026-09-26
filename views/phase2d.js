// Phase portrait of a flow in the plane, ẋ = f(x, y): a direction field, trajectories through
// chosen starting points (forward and backward in time), optional straight lines (eigenvectors),
// fixed points, and an optional cloud of particles drifting with the flow.
//
//   createPhase2D(canvas, store, {
//     select: (state) => ({
//       f: ([x, y]) => [y, -x],
//       window: [-3, 3, -3, 3],            // xmin, xmax, ymin, ymax
//       seeds: [[1, 0.5]],                 // trajectories start here
//       lines: [{ dir: [1, 1], label: 'v₁' }],   // optional straight lines through the origin
//       fixedPoints: [{ x: 0, y: 0, kind: 'stable' }],
//       lineOfFixed: [1, 0],               // optional: a whole line of fixed points (direction)
//       particles: [[x, y], …],            // optional flow cloud
//     }),
//     seedsKey: 'seeds',                   // click adds, drag moves, Shift-click clears; keys: arrows + Enter
//   });

import { setupCanvas, tokens, scale, ticks, drawAxes, drawFixedPoint } from './canvas.js';
import { rk4 } from '../core/integrate.js';

const STEPS = 500, DT = 0.02;

export function createPhase2D(canvas, store, { select, seedsKey = null, xLabel = 'x', yLabel = 'y', label = 'Phase portrait' }) {
  let geom = null;
  let dragging = -1;
  let cursor = [0.5, 0.5];   // keyboard cursor, in window fractions

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const d = select(store.get());
    const [x0, x1, y0, y1] = d.window;
    const side = Math.min(w - 50, h - 34);
    const box = { left: 44, top: 8, right: 44 + side, bottom: 8 + side };
    const x = scale([x0, x1], [box.left, box.right]);
    const y = scale([y0, y1], [box.bottom, box.top]);
    geom = { x, y, box, seeds: d.seeds || [] };

    ctx.clearRect(0, 0, w, h);
    drawAxes(ctx, T, { x, y, box, xTicks: ticks(x0, x1, 5), yTicks: ticks(y0, y1, 5), xLabel, yLabel });
    ctx.save();
    ctx.beginPath(); ctx.rect(box.left, box.top, side, side); ctx.clip();

    // faint axes through the origin
    ctx.strokeStyle = T.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x(0), box.top); ctx.lineTo(x(0), box.bottom); ctx.moveTo(box.left, y(0)); ctx.lineTo(box.right, y(0)); ctx.stroke();

    // direction field: short arrows, length grows gently with speed
    const n = Math.max(9, Math.round(side / 34));
    const grid = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const px = x0 + ((i + 0.5) / n) * (x1 - x0), py = y0 + ((j + 0.5) / n) * (y1 - y0);
      grid.push([px, py, d.f([px, py])]);
    }
    const speeds = grid.map(([, , v]) => Math.hypot(...v)).sort((a, b) => a - b);
    const typical = speeds[Math.floor(speeds.length * 0.7)] || 1;
    ctx.strokeStyle = T.muted; ctx.fillStyle = T.muted; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
    const cell = side / n;
    for (const [px, py, [u, v]] of grid) {
      const sp = Math.hypot(u, v);
      if (sp < 1e-12) continue;
      const len = cell * (0.25 + 0.3 * Math.min(1, sp / typical));
      const dx = (u / sp) * len, dy = -(v / sp) * len; // screen y points down
      const cx = x(px), cy = y(py);
      ctx.beginPath(); ctx.moveTo(cx - dx / 2, cy - dy / 2); ctx.lineTo(cx + dx / 2, cy + dy / 2); ctx.stroke();
      const a = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(cx + dx / 2, cy + dy / 2);
      ctx.lineTo(cx + dx / 2 - 4 * Math.cos(a - 0.5), cy + dy / 2 - 4 * Math.sin(a - 0.5));
      ctx.lineTo(cx + dx / 2 - 4 * Math.cos(a + 0.5), cy + dy / 2 - 4 * Math.sin(a + 0.5));
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // a whole line of fixed points
    if (d.lineOfFixed) {
      const [u, v] = d.lineOfFixed, L = 2 * Math.max(x1 - x0, y1 - y0);
      ctx.strokeStyle = T.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x(-L * u), y(-L * v)); ctx.lineTo(x(L * u), y(L * v)); ctx.stroke();
    }

    // straight lines (eigenvectors)
    for (const ln of d.lines || []) {
      const [u, v] = ln.dir, L = 2 * Math.max(x1 - x0, y1 - y0);
      ctx.save();
      ctx.strokeStyle = T.highlight; ctx.lineWidth = 1.5; ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(x(-L * u), y(-L * v)); ctx.lineTo(x(L * u), y(L * v)); ctx.stroke();
      ctx.restore();
      if (ln.label) {
        // label near where the line leaves the window (on the side with u ≥ 0)
        const sgn = u < 0 ? -1 : 1;
        const t = 0.85 * Math.min(u ? Math.max(Math.abs(x0), Math.abs(x1)) / Math.abs(u) : Infinity,
          v ? Math.max(Math.abs(y0), Math.abs(y1)) / Math.abs(v) : Infinity);
        const lx = x(sgn * u * t), ly = y(sgn * v * t);
        ctx.font = `12px ${T.mono}`; ctx.fillStyle = T.highlight; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ln.label, lx + 10, ly - 10);
      }
    }

    // particles
    if (d.particles?.length) {
      ctx.fillStyle = T.trajectory; ctx.globalAlpha = 0.5;
      for (const [px, py] of d.particles) { ctx.beginPath(); ctx.arc(x(px), y(py), 1.8, 0, 2 * Math.PI); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    // trajectories
    const inside = ([px, py]) => px > x0 - (x1 - x0) && px < x1 + (x1 - x0) && py > y0 - (y1 - y0) && py < y1 + (y1 - y0);
    const back = (p) => d.f(p).map((c) => -c);
    for (const s of d.seeds || []) {
      for (const [g, dir] of [[d.f, 1], [back, -1]]) {
        const pts = [s];
        let p = s;
        for (let i = 0; i < STEPS; i++) {
          p = rk4(g, p, DT);
          if (!p.every(Number.isFinite) || !inside(p)) break;
          pts.push(p);
          if (Math.hypot(...g(p)) < 1e-6) break;
        }
        ctx.strokeStyle = T.trajectory; ctx.lineWidth = 1.8;
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(x(px), y(py)) : ctx.moveTo(x(px), y(py))));
        ctx.stroke();
        if (dir > 0) for (const k of [25, 90, 200]) if (pts[k + 1]) arrowHead(ctx, T, x, y, pts[k], pts[k + 1]);
      }
      ctx.fillStyle = T.trajectory; ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x(s[0]), y(s[1]), 4, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    for (const fp of d.fixedPoints || []) drawFixedPoint(ctx, T, x(fp.x), y(fp.y), fp.kind, 6.5);

    // keyboard cursor
    if (seedsKey && document.activeElement === canvas) {
      const cx = box.left + cursor[0] * side, cy = box.bottom - cursor[1] * side;
      ctx.strokeStyle = T.highlight; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();
    }
  });

  store.subscribe(redraw);

  if (seedsKey) {
    const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const toModel = ([px, py]) => [+geom.x.invert(px).toFixed(3), +geom.y.invert(py).toFixed(3)];
    const inBox = ([px, py]) => px >= geom.box.left && px <= geom.box.right && py >= geom.box.top && py <= geom.box.bottom;

    canvas.addEventListener('pointerdown', (e) => {
      if (!geom) return;
      const p = local(e);
      if (!inBox(p)) return;
      const seeds = store.get()[seedsKey];
      if (e.shiftKey) { store.set({ [seedsKey]: [] }); return; }
      dragging = seeds.findIndex(([sx, sy]) => Math.hypot(geom.x(sx) - p[0], geom.y(sy) - p[1]) < 12);
      if (dragging < 0) {
        store.set({ [seedsKey]: [...seeds, toModel(p)].slice(-12) });
        dragging = Math.min(seeds.length, 11);
      }
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (dragging < 0) return;
      const p = local(e);
      if (!inBox(p)) return;
      const seeds = [...store.get()[seedsKey]];
      seeds[dragging] = toModel(p);
      store.set({ [seedsKey]: seeds });
    });
    const end = () => { dragging = -1; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', `${label}. Click to start a trajectory, drag one to move it, Shift-click to clear. Keyboard: arrows move a cursor, Enter starts a trajectory there, Delete clears.`);
    canvas.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.01 : 0.05;
      const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (mv) {
        cursor = [Math.min(1, Math.max(0, cursor[0] + mv[0])), Math.min(1, Math.max(0, cursor[1] + mv[1]))];
        redraw();
      } else if (e.key === 'Enter') {
        const { box } = geom, side = box.right - box.left;
        const p = toModel([box.left + cursor[0] * side, box.bottom - cursor[1] * side]);
        store.set({ [seedsKey]: [...store.get()[seedsKey], p].slice(-12) });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        store.set({ [seedsKey]: [] });
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

function arrowHead(ctx, T, x, y, [ax, ay], [bx, by]) {
  const px = x(bx), py = y(by), a = Math.atan2(py - y(ay), px - x(ax));
  if (!Number.isFinite(a)) return;
  ctx.fillStyle = T.trajectory;
  ctx.beginPath();
  ctx.moveTo(px + 6 * Math.cos(a), py + 6 * Math.sin(a));
  ctx.lineTo(px - 5 * Math.cos(a - 0.6), py - 5 * Math.sin(a - 0.6));
  ctx.lineTo(px - 5 * Math.cos(a + 0.6), py - 5 * Math.sin(a + 0.6));
  ctx.closePath(); ctx.fill();
}
