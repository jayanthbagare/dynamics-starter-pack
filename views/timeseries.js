// Time series: x_n against n.
//
//   createTimeseries(canvas, store, {
//     select: (state) => ({
//       series: [{ values: [x0, x1, …], role: 'main' | 'ghost', label: 'start 0.9' }],  // label optional
//                                       // style: 'twin' draws a series dashed with hollow dots
//                                       // times: [t0, t1, …] places points in continuous time
//                                       //   (then nMax is the right edge in time units)
//                                       // dots: false draws a line only (e.g. an exact solution)
//       nMax: 30,                       // right edge of the time axis
//       yRange: [0, 2],                 // values outside are clipped, drawn as an edge marker
//       fixedLines: [{ y: 0.739, kind: 'stable' }],   // optional
//       highlight: 12,                  // optional: step to emphasise
//       refLine: { from: [0, 1e-7], to: [30, 0.1] },  // optional straight guide (a "ruler")
//       markers: [{ n: 23, label: 'they part' }],     // optional labelled vertical lines
//     }),
//     hoverKey: 'hoverN',               // optional: writes the hovered step into the store
//     yScale: 'log',                    // optional: log₁₀ axis; values ≤ 0 are not drawn
//   });
//
// The view only draws what `select` returns; it keeps no simulation state of its own.

import { setupCanvas, tokens, scale, ticks, drawAxes, drawFixedPoint } from './canvas.js';

export function createTimeseries(canvas, store, { select, hoverKey = null, xLabel = 'n', yLabel = 'xₙ', yScale = 'linear' }) {
  const log = yScale === 'log';
  const tf = log ? (v) => (v > 0 ? Math.log10(v) : NaN) : (v) => v;
  let geom = null; // last-drawn scales, for hover hit-testing

  const redraw = setupCanvas(canvas, (ctx, { w, h }) => {
    const T = tokens();
    const d = log ? toLog(select(store.get()), tf) : select(store.get());
    const box = { left: 46, right: w - 14, top: 10, bottom: h - 26 };
    const nMax = Math.max(1, d.nMax);
    const [y0, y1] = d.yRange;
    const x = scale([0, nMax], [box.left, box.right]);
    const y = scale([y0, y1], [box.bottom, box.top]);
    geom = { x, box, nMax };

    ctx.clearRect(0, 0, w, h);
    drawAxes(ctx, T, {
      x, y, box, xLabel, yLabel,
      xTicks: d.series.some((s) => s.times) ? ticks(0, nMax, 6) : ticks(0, nMax, 6).filter(Number.isInteger),
      yTicks: log ? logTicks(y0, y1) : ticks(y0, y1, 5),
      yFormat: log ? pow10 : undefined,
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

    if (d.refLine) {
      const [[n0, v0], [n1, v1]] = [d.refLine.from, d.refLine.to];
      ctx.save();
      ctx.strokeStyle = T.parameter; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.moveTo(x(n0), y(v0)); ctx.lineTo(x(n1), y(v1)); ctx.stroke();
      ctx.restore();
    }

    for (const m of d.markers || []) {
      if (m.n < 0 || m.n > nMax) continue;
      ctx.save();
      ctx.strokeStyle = T.ink; ctx.globalAlpha = 0.55; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x(m.n), box.top); ctx.lineTo(x(m.n), box.bottom); ctx.stroke();
      ctx.restore();
    }

    // ghosts at the back, then twins, then main runs on top (a main dot sits inside a twin's hollow ring)
    const rank = (s) => (s.role !== 'main' ? 0 : s.style === 'twin' ? 1 : 2);
    const ordered = [...d.series].sort((a, b) => rank(a) - rank(b));
    for (const s of ordered) drawSeries(ctx, T, s, x, y, [y0, y1], box, d.highlight);
    ctx.restore();
    const taken = drawLabels(ctx, T, d.series, x, y, [y0, y1], box);

    // marker labels go wherever they don't cover a series label: top, bottom, or middle
    for (const m of d.markers || []) {
      if (m.n < 0 || m.n > nMax) continue;
      const right = x(m.n) > box.right - 140;
      const px = x(m.n) + (right ? -5 : 5);
      const w = measure(ctx, T, m.label);
      const left = right ? px - w : px;
      const py = [box.top + 10, box.bottom - 12, (box.top + box.bottom) / 2].find((cy) =>
        !taken.some((r) => left < r.right && left + w > r.left && cy - 8 < r.bottom && cy + 8 > r.top)) ?? box.top + 10;
      plate(ctx, T, m.label, px, py, right ? 'right' : 'left', T.ink);
    }

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
  const twin = s.style === 'twin';
  const colour = twin ? T.highlight : main ? T.trajectory : T.muted;
  const tOf = (n) => (s.times ? s.times[n] : n);
  ctx.save();
  ctx.strokeStyle = colour; ctx.fillStyle = colour;
  ctx.globalAlpha = main ? 1 : 0.45;
  ctx.lineWidth = main ? 1.5 : 1;
  if (twin) ctx.setLineDash([5, 3]);

  // Line through in-range points; break at anything undefined or off the chart.
  ctx.beginPath();
  let pen = false;
  s.values.forEach((v, n) => {
    const inRange = Number.isFinite(v) && v >= y0 && v <= y1;
    if (inRange) { pen ? ctx.lineTo(x(tOf(n)), y(v)) : ctx.moveTo(x(tOf(n)), y(v)); pen = true; }
    else pen = false;
  });
  ctx.stroke();
  ctx.setLineDash([]);

  const r = main ? 3 : 2;
  if (s.dots !== false) s.values.forEach((v, n) => {
    if (Number.isNaN(v)) return;
    if (v > y1 || v < y0) { // clipped: small triangle on the edge, pointing the way it went
      const up = v > y1, py = up ? box.top - 2 : box.bottom + 2, dir = up ? 1 : -1;
      ctx.beginPath();
      const tx = x(tOf(n)); ctx.moveTo(tx, py - dir * 5); ctx.lineTo(tx - 4, py + dir * 2); ctx.lineTo(tx + 4, py + dir * 2);
      ctx.closePath(); ctx.fill();
      return;
    }
    ctx.beginPath(); ctx.arc(x(tOf(n)), y(v), twin ? r + 0.5 : r, 0, 2 * Math.PI);
    if (twin) { ctx.save(); ctx.fillStyle = T.bg; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
    else ctx.fill();
  });

  if (main && highlight != null && Number.isFinite(s.values[highlight])) {
    const v = s.values[highlight];
    if (v >= y0 && v <= y1) {
      ctx.globalAlpha = 1; ctx.strokeStyle = T.highlight; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x(tOf(highlight)), y(v), 6, 0, 2 * Math.PI); ctx.stroke();
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
    if (last >= 0) labels.push({ text: s.label, px: x(s.times ? s.times[last] : last), py: y(s.values[last]) - 8 });
  }
  labels.sort((a, b) => a.py - b.py);
  for (let i = 1; i < labels.length; i++) {
    const a = labels[i - 1], b = labels[i];
    if (Math.abs(a.px - b.px) < 90 && b.py - a.py < 13) b.py = a.py + 13;
  }
  return labels.map((l) => {
    const right = l.px > box.right - 90;
    return plate(ctx, T, l.text, l.px + (right ? -10 : 8), Math.max(box.top + 8, l.py), right ? 'right' : 'left', T.muted);
  });
}

function measure(ctx, T, text) {
  ctx.save(); ctx.font = `11px ${T.mono}`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

// Small text on a background plate, so it stays legible over data. Returns the plate's rectangle.
function plate(ctx, T, text, px, py, align, colour) {
  ctx.save();
  ctx.font = `11px ${T.mono}`; ctx.textBaseline = 'middle'; ctx.textAlign = align;
  const w = ctx.measureText(text).width;
  const left = align === 'right' ? px - w : px;
  ctx.fillStyle = T.bg; ctx.globalAlpha = 0.85;
  ctx.fillRect(left - 3, py - 8, w + 6, 16);
  ctx.globalAlpha = 1; ctx.fillStyle = colour;
  ctx.fillText(text, px, py);
  ctx.restore();
  return { left: left - 3, right: left + w + 3, top: py - 8, bottom: py + 8 };
}

// --- log scale -------------------------------------------------------------

// Move everything the caller gave us into log₁₀ space; the drawing code then stays linear.
function toLog(d, tf) {
  return {
    ...d,
    yRange: d.yRange.map(tf),
    series: d.series.map((s) => ({ ...s, values: s.values.map(tf) })),
    fixedLines: (d.fixedLines || []).map((f) => ({ ...f, y: tf(f.y) })),
    refLine: d.refLine && { from: [d.refLine.from[0], tf(d.refLine.from[1])], to: [d.refLine.to[0], tf(d.refLine.to[1])] },
  };
}

function logTicks(a, b) {
  const lo = Math.ceil(a), hi = Math.floor(b);
  const step = Math.max(1, Math.ceil((hi - lo) / 6));
  const out = [];
  for (let k = hi; k >= lo; k -= step) out.unshift(k);
  return out;
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const pow10 = (k) => (k === 0 ? '1' : '10' + String(k).split('').map((c) => SUP[c]).join(''));
