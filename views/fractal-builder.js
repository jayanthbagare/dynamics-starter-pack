// Construction views for Ch 9: the middle-thirds Cantor set (generations stacked so the
// construction reads top to bottom) and the Koch curve, plus a 3x magnifying glass that
// shows the Koch curve is made of 4 copies of itself at 1/3 the scale.

import { setupCanvas, tokens } from './canvas.js';

const THIRD = 1 / 3;

export function createFractalBuilder(canvas, { type }) {
  let gen = 0;
  const pointer = { x: 0, y: 0, active: false };

  const redraw = setupCanvas(canvas, (ctx, size) => {
    ctx.clearRect(0, 0, size.w, size.h);
    const T = tokens();
    if (type === 'cantor') drawCantorStack(ctx, T, size, gen);
    else if (type === 'koch') drawKoch(ctx, T, size, gen);
    else drawGlass(ctx, T, size, gen, pointer);
  });

  function render(n) { gen = n; redraw(); }

  if (type === 'koch-glass') {
    canvas.addEventListener('pointerenter', () => { pointer.active = true; });
    canvas.addEventListener('pointerleave', () => { pointer.active = false; redraw(); });
    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
      pointer.active = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
      pointer.active = true;
      redraw();
    });
  }

  return { render };
}

// --- Cantor: generations stacked, the latest one in full colour ---------------------------

function drawCantorStack(ctx, T, { w, h }, gen) {
  const pad = 16;
  const rows = gen + 1;
  const rowH = (h - 2 * pad) / rows;
  const bar = Math.min(10, rowH * 0.45);
  const x0 = 40, x1 = w - 40;
  for (let i = 0; i <= gen; i++) {
    const y = pad + rowH * (i + 0.5);
    ctx.globalAlpha = i === gen ? 1 : 0.45;
    ctx.fillStyle = i === gen ? T.trajectory : T.muted;
    cantorBar(ctx, x0, x1, y, bar, i);
  }
  ctx.globalAlpha = 1;
}

function cantorBar(ctx, x0, x1, y, bar, gen) {
  if (gen === 0) { ctx.fillRect(x0, y - bar / 2, x1 - x0, bar); return; }
  const w = (x1 - x0) * THIRD;
  cantorBar(ctx, x0, x0 + w, y, bar, gen - 1);
  cantorBar(ctx, x1 - w, x1, y, bar, gen - 1);
}

// --- Koch curve: 4 copies at 1/3 scale, fitted to the canvas ------------------------------

function kochGeometry({ w, h }, pad = 24) {
  // Peak height above the base segment is width * sqrt(3)/6; fit both dimensions.
  const width = Math.min(w - 2 * pad, ((h - 2 * pad) * 6) / Math.sqrt(3));
  return { x0: (w - width) / 2, x1: (w + width) / 2, y0: h - pad };
}

function drawKoch(ctx, T, size, gen) {
  const { x0, x1, y0 } = kochGeometry(size);
  ctx.strokeStyle = T.trajectory;
  ctx.lineWidth = gen >= 4 ? 1.25 : 2;
  ctx.lineCap = 'round';
  kochEdge(ctx, x0, y0, x1, y0, gen);
}

function kochEdge(ctx, x0, y0, x1, y1, gen) {
  if (gen === 0) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    return;
  }
  const dx = x1 - x0, dy = y1 - y0;
  const ax = x0 + dx * THIRD, ay = y0 + dy * THIRD;
  const bx = x0 + 2 * dx * THIRD, by = y0 + 2 * dy * THIRD;
  // Equilateral peak: rotate the middle third by -60 degrees (upward for a left-to-right base).
  const vx = bx - ax, vy = by - ay;
  const px = ax + vx * COS60 + vy * SIN60;
  const py = ay - vx * SIN60 + vy * COS60;
  kochEdge(ctx, x0, y0, ax, ay, gen - 1);
  kochEdge(ctx, ax, ay, px, py, gen - 1);
  kochEdge(ctx, px, py, bx, by, gen - 1);
  kochEdge(ctx, bx, by, x1, y1, gen - 1);
}

// 60-degree rotation constants for the Koch peak.
const COS60 = Math.cos(Math.PI / 3);   // 0.5
const SIN60 = Math.sin(Math.PI / 3);   // sqrt(3)/2

function drawGlass(ctx, T, size, gen, pointer) {
  const { w, h } = size;
  const { x0, x1, y0 } = kochGeometry(size, 40);

  if (!pointer.active) {
    drawKoch(ctx, T, size, gen);
    ctx.fillStyle = T.muted;
    ctx.font = `12px ${T.mono}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('move the pointer over the curve to zoom 3×', 12, 10);
    return;
  }

  // Faded full view behind the glass.
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = T.trajectory;
  ctx.lineWidth = 1.25;
  kochEdge(ctx, x0, y0, x1, y0, gen);
  ctx.globalAlpha = 1;

  const r = Math.min(w, h) * 0.22;
  ctx.save();
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, r, 0, 2 * Math.PI);
  ctx.clip();
  ctx.fillStyle = T.bg;
  ctx.fill();
  ctx.translate(pointer.x, pointer.y);
  ctx.scale(3, 3);
  ctx.translate(-pointer.x, -pointer.y);
  ctx.strokeStyle = T.trajectory;
  ctx.lineWidth = 1.25;
  kochEdge(ctx, x0, y0, x1, y0, gen);
  ctx.restore();

  // Ring and label.
  ctx.strokeStyle = T.highlight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, r, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = T.highlight;
  ctx.font = `12px ${T.mono}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('3×', pointer.x + r + 8, pointer.y - 6);
}
