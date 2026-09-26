// Shared canvas plumbing for the 2D views: crisp HiDPI drawing, resize handling, the site's
// colour tokens (re-read when the theme changes), axes, and the fixed-point dot convention.

export function setupCanvas(canvas, draw) {
  const ctx = canvas.getContext('2d');
  const size = { w: 0, h: 0 };
  // Off-screen canvases skip redraws (they can be expensive) and catch up when they scroll into view.
  let visible = true, stale = false;
  const redraw = () => {
    if (!visible) { stale = true; return; }
    stale = false;
    if (size.w > 0) draw(ctx, size);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && stale) redraw();
  }, { rootMargin: '200px' }).observe(canvas);

  new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    size.w = r.width; size.h = r.height;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }).observe(canvas);

  onThemeChange(redraw);
  return redraw;
}

export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim();
  return {
    bg: v('--bg'), surface: v('--surface'), ink: v('--ink'), muted: v('--ink-muted'), rule: v('--rule'),
    trajectory: v('--c-trajectory'), stable: v('--c-stable'), unstable: v('--c-unstable'),
    parameter: v('--c-parameter'), highlight: v('--c-highlight'),
    mono: v('--font-mono'),
  };
}

export function onThemeChange(fn) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
  new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// Linear map from [d0, d1] to [r0, r1], with .invert.
export function scale([d0, d1], [r0, r1]) {
  const s = (x) => r0 + ((x - d0) / (d1 - d0)) * (r1 - r0);
  s.invert = (y) => d0 + ((y - r0) / (r1 - r0)) * (d1 - d0);
  return s;
}

// Roughly `count` round tick values across [a, b].
export function ticks(a, b, count = 5) {
  const raw = (b - a) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let t = Math.ceil(a / step) * step; t <= b + step * 1e-9; t += step) out.push(+t.toPrecision(12));
  return out;
}

export function fmtTick(t) {
  return Math.abs(t) >= 1e4 || (t !== 0 && Math.abs(t) < 1e-3) ? t.toExponential(0) : String(t);
}

// Frame, grid ticks and labels for a plot area.
export function drawAxes(ctx, T, { x, y, xTicks, yTicks, xLabel, yLabel, box, xFormat = fmtTick, yFormat = fmtTick }) {
  ctx.save();
  ctx.strokeStyle = T.rule; ctx.lineWidth = 1;
  ctx.strokeRect(box.left + 0.5, box.top + 0.5, box.right - box.left, box.bottom - box.top);
  ctx.fillStyle = T.muted;
  ctx.font = `11px ${T.mono}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const t of xTicks) {
    const px = x(t);
    ctx.beginPath(); ctx.moveTo(px, box.bottom); ctx.lineTo(px, box.bottom + 4); ctx.stroke();
    ctx.fillText(xFormat(t), px, box.bottom + 6);
  }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const t of yTicks) {
    const py = y(t);
    ctx.beginPath(); ctx.moveTo(box.left - 4, py); ctx.lineTo(box.left, py); ctx.stroke();
    ctx.fillText(yFormat(t), box.left - 6, py);
  }
  ctx.font = `italic 12px ${T.mono}`;
  if (xLabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(xLabel, box.right - 4, box.bottom - 4); }
  if (yLabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(yLabel, box.left + 6, box.top + 4); }
  ctx.restore();
}

// Stable = filled, unstable = hollow, half = left half filled. Colour doubles the shape, never replaces it.
export function drawFixedPoint(ctx, T, px, py, kind, r = 5.5) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(px, py, r, 0, 2 * Math.PI);
  if (kind === 'stable') {
    ctx.fillStyle = T.stable; ctx.strokeStyle = T.stable; ctx.fill(); ctx.stroke();
  } else if (kind === 'unstable') {
    ctx.fillStyle = T.bg; ctx.strokeStyle = T.unstable; ctx.fill(); ctx.stroke();
  } else {
    ctx.fillStyle = T.bg; ctx.strokeStyle = T.ink; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, r, Math.PI / 2, (3 * Math.PI) / 2); ctx.closePath();
    ctx.fillStyle = T.ink; ctx.fill();
  }
  ctx.restore();
}
