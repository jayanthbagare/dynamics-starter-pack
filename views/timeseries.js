// Time series: x_n against n.
//
//   createTimeseries(canvas, store, {
//     select: (state) => ({
//       series: [{ values: [x0, x1, …], role: 'main' | 'ghost', label: 'start 0.9' }],  // label optional
//       nMax: 30,                       // right edge of the time axis
//       yRange: [0, 2],                 // values outside are clipped, drawn as an edge marker
//       fixedLines: [{ y: 0.739, kind: 'stable' }],   // optional
//       highlight: 12,                  // optional: step to emphasise
//     }),
//     hoverKey: 'hoverN',               // optional: writes the hovered step into the store
//   });
//
// The view only draws what `select` returns; it keeps no simulation state of its own.

import { setupCanvas, tokens, scale, ticks, drawAxes, drawFixedPoint } from './canvas.js';

export function createTimeseries(canvas, store, { select, hoverKey = null, xLabel = 'n', yLabel = 'xₙ' }) {
  let geom = null; // last-drawn scales, for hover hit-testing

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const d = select(store.get());
    const box = { left: 46, right: w - 14, top: 10, bottom: h - 26 };
    const nMax = Math.max(1, d.nMax);
    const [y0, y1] = d.yRange;
    const x = scale([0, nMax], [box.left, box.right]);
    const y = scale([y0, y1], [box.bottom, box.top]);
    geom = { x, box, nMax };

    ctx.clearRect(0, 0, w, h);
    drawAxes(ctx, T, {
      x, y, box, xLabel, yLabel,
      xTicks: ticks(0, nMax, 6).filter(Number.isInteger),
      yTicks: ticks(y0, y1, 5),
    });

    ctx.save();
    ctx.beginPath(); ctx.rect(box.left, box.top - 6, box.right - box.left, box.bottom - box.top + 12); ctx.clip();

    for (const f of d.fixedLines || []) {
      if (f.y < y0 || f.y > y1) continue;
      ctx.save();
      ctx.strokeStyle = f.kind === 'stable' ? T.stable : f.kind === 'unstable' ? T.unstable : T.ink;
      ctx.globalAlpha = 0.6; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(box.left, y(f.y)); ctx.lineTo(box.right, y(f.y)); ctx.stroke();
      ctx.restore();
    }

    if (d.highlight != null && d.highlight <= nMax) {
      ctx.save();
      ctx.strokeStyle = T.highlight; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(x(d.highlight), box.top); ctx.lineTo(x(d.highlight), box.bottom); ctx.stroke();
      ctx.restore();
    }

    const ordered = [...d.series].sort((a, b) => (a.role === 'main') - (b.role === 'main'));
    for (const s of ordered) drawSeries(ctx, T, s, x, y, [y0, y1], box, d.highlight);
    ctx.restore();
    drawLabels(ctx, T, d.series, x, y, [y0, y1], box);

    for (const f of d.fixedLines || []) {
      if (f.y >= y0 && f.y <= y1) drawFixedPoint(ctx, T, box.right, y(f.y), f.kind, 4.5);
    }
  });

  store.subscribe(redraw);

  if (hoverKey) {
    canvas.addEventListener('pointermove', (e) => {
      if (!geom) return;
      const r = canvas.getBoundingClientRect();
      const n = Math.round(geom.x.invert(e.clientX - r.left));
      store.set({ [hoverKey]: n >= 0 && n <= geom.nMax ? n : null });
    });
    canvas.addEventListener('pointerleave', () => store.set({ [hoverKey]: null }));
  }

  return { redraw };
}

function drawSeries(ctx, T, s, x, y, [y0, y1], box, highlight) {
  const main = s.role === 'main';
  const colour = main ? T.trajectory : T.muted;
  ctx.save();
  ctx.strokeStyle = colour; ctx.fillStyle = colour;
  ctx.globalAlpha = main ? 1 : 0.45;
  ctx.lineWidth = main ? 1.5 : 1;

  // Line through in-range points; break at anything undefined or off the chart.
  ctx.beginPath();
  let pen = false;
  s.values.forEach((v, n) => {
    const inRange = Number.isFinite(v) && v >= y0 && v <= y1;
    if (inRange) { pen ? ctx.lineTo(x(n), y(v)) : ctx.moveTo(x(n), y(v)); pen = true; }
    else pen = false;
  });
  ctx.stroke();

  const r = main ? 3 : 2;
  s.values.forEach((v, n) => {
    if (Number.isNaN(v)) return;
    if (v > y1 || v < y0) { // clipped: small triangle on the edge, pointing the way it went
      const up = v > y1, py = up ? box.top - 2 : box.bottom + 2, dir = up ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x(n), py - dir * 5); ctx.lineTo(x(n) - 4, py + dir * 2); ctx.lineTo(x(n) + 4, py + dir * 2);
      ctx.closePath(); ctx.fill();
      return;
    }
    ctx.beginPath(); ctx.arc(x(n), y(v), r, 0, 2 * Math.PI); ctx.fill();
  });

  if (main && highlight != null && Number.isFinite(s.values[highlight])) {
    const v = s.values[highlight];
    if (v >= y0 && v <= y1) {
      ctx.globalAlpha = 1; ctx.strokeStyle = T.highlight; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x(highlight), y(v), 6, 0, 2 * Math.PI); ctx.stroke();
    }
  }
  ctx.restore();
}

// Name each labelled run next to its last on-chart point, so colour isn't the only cue.
// Labels that would collide are pushed apart vertically.
function drawLabels(ctx, T, series, x, y, [y0, y1], box) {
  const labels = [];
  for (const s of series) {
    if (!s.label) continue;
    let last = -1;
    s.values.forEach((v, n) => { if (Number.isFinite(v) && v >= y0 && v <= y1) last = n; });
    if (last >= 0) labels.push({ text: s.label, px: x(last), py: y(s.values[last]) - 8 });
  }
  labels.sort((a, b) => a.py - b.py);
  for (let i = 1; i < labels.length; i++) {
    const a = labels[i - 1], b = labels[i];
    if (Math.abs(a.px - b.px) < 90 && b.py - a.py < 13) b.py = a.py + 13;
  }
  ctx.save();
  ctx.fillStyle = T.muted; ctx.font = `11px ${T.mono}`; ctx.textBaseline = 'middle';
  for (const l of labels) {
    const right = l.px > box.right - 90;
    ctx.textAlign = right ? 'right' : 'left';
    ctx.fillText(l.text, l.px + (right ? -10 : 8), Math.max(box.top + 6, l.py));
  }
  ctx.restore();
}
