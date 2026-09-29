// Shape your own reef: an SVG editor for the Mimic's hump. Seven handles: the peak (moves sideways
// only; its height is always 1) and three points on each flank. Every edit goes through
// createHump, so whatever the player does, the curve keeps one smooth quadratic top.
//
//   const ed = createReefEditor(container, { spec: PRESETS.logistic, onChange(spec) });
//   ed.spec; ed.setSpec(spec)
//   Keyboard (when focused): ←/→ pick a handle; ↑/↓ raise or lower it; Shift+←/→ move it sideways.

import { createHump } from './hump.js';

const W = 320, H = 200, M = { l: 26, r: 10, t: 10, b: 22 };
const px = (x) => M.l + x * (W - M.l - M.r);
const py = (h) => M.t + (1 - h) * (H - M.t - M.b);
const ix = (p) => (p - M.l) / (W - M.l - M.r);
const iy = (p) => 1 - (p - M.t) / (H - M.t - M.b);

export function createReefEditor(container, { spec, onChange = () => {} }) {
  const wrap = document.createElement('div');
  wrap.className = 'reef-editor';
  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" tabindex="0" role="application" style="width:100%;height:auto;display:block;touch-action:none"
      aria-label="Reef shape editor. Left and right arrows pick a handle; up and down raise or lower it; Shift with left or right moves it sideways."></svg>
    <p class="mono muted reef-readout" aria-live="polite" style="margin:0.25rem 0;font-size:0.75rem"></p>`;
  container.append(wrap);
  const svg = wrap.querySelector('svg');
  const readout = wrap.querySelector('.reef-readout');
  let reef = createHump(spec), sel = 0, drag = null;

  // handle list: 0 = peak, then left flank (1..3), then right flank (4..6)
  const handles = () => [[reef.c, 1], ...reef.points.left, ...reef.points.right];
  const name = (i) => (i === 0 ? 'peak' : i <= reef.points.left.length ? `left ${i}` : `right ${i - reef.points.left.length}`);

  function draw() {
    const parts = [
      `<rect x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="var(--bg)" stroke="var(--rule)"/>`,
      `<line x1="${px(0)}" y1="${py(0)}" x2="${px(1)}" y2="${py(1)}" stroke="var(--ink-muted)" stroke-dasharray="2 3"/>`,
    ];
    let d = '';
    for (let i = 0; i <= 200; i++) { const x = i / 200; d += `${i ? 'L' : 'M'} ${px(x).toFixed(1)} ${py(reef.h(x)).toFixed(1)} `; }
    parts.push(`<path d="${d}" fill="none" stroke="var(--c-parameter)" stroke-width="2.5"/>`);
    handles().forEach(([x, h], i) => {
      const on = i === sel && document.activeElement === svg;
      parts.push(i === 0
        ? `<path d="M ${px(x)} ${py(h) - 7} l 7 7 l -7 7 l -7 -7 z" fill="var(--c-parameter)" stroke="${on ? 'var(--c-highlight)' : 'var(--bg)'}" stroke-width="2"/>`
        : `<circle cx="${px(x)}" cy="${py(h)}" r="6" fill="var(--bg)" stroke="${on ? 'var(--c-highlight)' : 'var(--c-parameter)'}" stroke-width="${on ? 3 : 2}"/>`);
    });
    for (const t of [0, 0.5, 1]) parts.push(`<text x="${px(t)}" y="${H - 6}" text-anchor="middle" style="font:9px var(--font-mono);fill:var(--ink-muted)">${t}</text>`);
    svg.innerHTML = parts.join('');
  }

  function update(i, x, h) {
    const p = reef.points;
    const next = { peak: p.peak, left: p.left.map((q) => [...q]), right: p.right.map((q) => [...q]) };
    if (i === 0) next.peak = x;
    else if (i <= p.left.length) next.left[i - 1] = [x, h];
    else next.right[i - 1 - p.left.length] = [x, h];
    reef = createHump(next);
    const [hx, hh] = handles()[i];
    readout.textContent = `${name(i)}: x ${hx.toFixed(2)}${i ? `, height ${hh.toFixed(2)}` : ''}`;
    draw();
    onChange(reef.points);
  }

  const toLocal = (e) => {
    const r = svg.getBoundingClientRect();
    return [ix(((e.clientX - r.left) / r.width) * W), iy(((e.clientY - r.top) / r.height) * H)];
  };
  svg.addEventListener('pointerdown', (e) => {
    const [x, h] = toLocal(e);
    let best = -1, bd = Infinity;
    handles().forEach(([hx, hh], i) => { const dd = Math.hypot(hx - x, (hh - h) * 0.7); if (dd < bd) { bd = dd; best = i; } });
    if (bd > 0.12) return;
    drag = best; sel = best;
    svg.setPointerCapture(e.pointerId);
    draw();
  });
  svg.addEventListener('pointermove', (e) => { if (drag !== null) update(drag, ...toLocal(e)); });
  svg.addEventListener('pointerup', () => { drag = null; });
  svg.addEventListener('pointercancel', () => { drag = null; });
  svg.addEventListener('keydown', (e) => {
    const n = handles().length;
    const [x, h] = handles()[sel];
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey) {
      sel = (sel + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
      readout.textContent = `${name(sel)} selected`;
      draw();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') update(sel, x + (e.key === 'ArrowRight' ? 0.01 : -0.01), h);
    else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && sel !== 0) update(sel, x, h + (e.key === 'ArrowUp' ? 0.02 : -0.02));
    else return;
    e.preventDefault();
    e.stopPropagation();   // keep arrows away from the camera ship
  });
  svg.addEventListener('focus', draw);
  svg.addEventListener('blur', draw);
  draw();

  return {
    el: wrap,
    get spec() { return reef.points; },
    get reef() { return reef; },
    setSpec(s) { reef = createHump(s); draw(); onChange(reef.points); },
  };
}
