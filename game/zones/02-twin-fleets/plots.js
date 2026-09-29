// Two small SVG widgets for the Twin Fleets panel. Colours come from the site tokens.
//
//   const plot = createGapPlot(container, { maxFlash: 40 });
//   plot.set({ series: [{ gaps, hollow }], gap0, bet, truth })   // gaps[k] = gap after k flashes
//
//   const painter = createBandPainter(container, { bins: 20, onChange(band) });
//   painter.band; painter.setBand(band); painter.setTruth(probs | null); painter.setLocked(bool)
//   Paint by dragging; or focus it, ←/→ to pick a bin, ↑/↓ to set its height.

const NS = 'http://www.w3.org/2000/svg';
const W = 320, H = 180, M = { l: 42, r: 10, t: 10, b: 26 };

export function createGapPlot(container, { maxFlash = 40, yMin = -11, yMax = 0 } = {}) {
  const wrap = document.createElement('figure');
  wrap.className = 'twin-plot';
  wrap.style.margin = '0.5rem 0';
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" style="width:100%;height:auto;display:block"></svg>
    <figcaption class="muted" style="font-size:0.75rem">gap between the twins (log scale) against flash number</figcaption>`;
  container.append(wrap);
  const svg = wrap.querySelector('svg');
  const x = (k) => M.l + (k / maxFlash) * (W - M.l - M.r);
  const y = (lg) => M.t + ((yMax - lg) / (yMax - yMin)) * (H - M.t - M.b);
  const clampLg = (g) => Math.max(yMin, Math.min(yMax, Math.log10(Math.max(g, 1e-300))));

  function set({ series = [], gap0 = null, bet = null, truth = null } = {}) {
    const parts = [];
    parts.push(`<rect x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="none" stroke="var(--rule)"/>`);
    for (let lg = yMin + 1; lg <= yMax; lg += 3) {
      parts.push(`<text x="${M.l - 4}" y="${y(lg) + 3}" text-anchor="end" style="font:9px var(--font-mono);fill:var(--ink-muted)">1e${lg}</text>`);
      parts.push(`<line x1="${M.l}" x2="${M.l + 3}" y1="${y(lg)}" y2="${y(lg)}" stroke="var(--ink-muted)"/>`);
    }
    for (let k = 0; k <= maxFlash; k += 10) {
      parts.push(`<text x="${x(k)}" y="${H - 10}" text-anchor="middle" style="font:9px var(--font-mono);fill:var(--ink-muted)">${k}</text>`);
    }
    // the line where the gap becomes visible
    parts.push(`<line x1="${M.l}" x2="${W - M.r}" y1="${y(-1)}" y2="${y(-1)}" stroke="var(--ink-muted)" stroke-dasharray="4 3"/>
      <text x="${W - M.r - 2}" y="${y(-1) - 3}" text-anchor="end" style="font:9px var(--font-mono);fill:var(--ink-muted)">visible (0.1)</text>`);
    if (gap0) { // doubling every flash, from the starting gap
      const k1 = Math.min(maxFlash, (yMax - Math.log10(gap0)) / Math.log10(2));
      parts.push(`<line x1="${x(0)}" y1="${y(Math.log10(gap0))}" x2="${x(k1)}" y2="${y(Math.log10(gap0) + k1 * Math.log10(2))}"
        stroke="var(--c-parameter)" stroke-dasharray="2 3" stroke-width="1.5"/>`);
    }
    if (bet != null) {
      parts.push(`<line x1="${x(bet)}" x2="${x(bet)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--c-highlight)" stroke-dasharray="3 3" stroke-width="1.5"/>
        <text x="${x(bet) + 3}" y="${M.t + 10}" style="font:9px var(--font-mono);fill:var(--c-highlight)">your bet ${bet}</text>`);
    }
    if (truth != null) {
      parts.push(`<line x1="${x(truth)}" x2="${x(truth)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--ink)" stroke-width="1.5"/>
        <text x="${x(truth) + 3}" y="${M.t + 22}" style="font:9px var(--font-mono);fill:var(--ink)">true ${truth}</text>`);
    }
    for (const s of series) {
      s.gaps.slice(0, maxFlash + 1).forEach((g, k) => {
        const fill = s.hollow ? 'var(--bg)' : 'var(--c-trajectory)';
        const stroke = s.hollow ? 'var(--c-highlight)' : 'var(--c-trajectory)';
        parts.push(`<circle cx="${x(k)}" cy="${y(clampLg(g))}" r="2.6" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`);
      });
    }
    svg.innerHTML = parts.join('');
    const last = series.at(-1)?.gaps;
    svg.setAttribute('aria-label', last && last.length
      ? `Gap plot: ${last.length - 1} flashes so far; the gap is now ${last.at(-1).toExponential(1)}.${truth != null ? ` It passed 0.1 at flash ${truth}.` : ''}`
      : 'Gap plot: empty until a pair is launched.');
  }
  set();
  return { el: wrap, set };
}

export function createBandPainter(container, { bins = 20, onChange = () => {} } = {}) {
  const BW = 320, BH = 170, B = { l: 8, r: 8, t: 8, b: 22 };
  const wrap = document.createElement('div');
  wrap.className = 'band-painter';
  wrap.innerHTML = `
    <svg viewBox="0 0 ${BW} ${BH}" tabindex="0" role="application"
      aria-label="Probability band painter, ${bins} bins from 0 to 1. Drag to paint. Keyboard: left and right pick a bin, up and down set its height."
      style="width:100%;height:auto;display:block;touch-action:none;cursor:crosshair"></svg>
    <p class="mono muted band-readout" aria-live="polite" style="margin:0.25rem 0;font-size:0.75rem"></p>`;
  container.append(wrap);
  const svg = wrap.querySelector('svg');
  const readout = wrap.querySelector('.band-readout');
  let band = new Array(bins).fill(0), truth = null, locked = false, focus = Math.floor(bins / 2);
  const bw = (BW - B.l - B.r) / bins, hh = BH - B.t - B.b;

  function draw() {
    const scale = Math.max(1, ...band);   // heights are relative: the tallest bar fills the box
    const total = band.reduce((a, b) => a + b, 0) || 1;
    const parts = [`<rect x="${B.l}" y="${B.t}" width="${BW - B.l - B.r}" height="${hh}" fill="var(--bg)" stroke="var(--rule)"/>`];
    band.forEach((v, i) => {
      const h = (v / scale) * hh;
      parts.push(`<rect x="${B.l + i * bw + 1}" y="${B.t + hh - h}" width="${bw - 2}" height="${h}" fill="var(--c-trajectory)" opacity="0.75"/>`);
    });
    if (truth) { // the true share of each bin, at the same total as the painted band, as outlines
      const tmax = Math.max(...truth.map((q) => q * total));
      const ts = Math.max(scale, tmax);
      truth.forEach((q, i) => {
        const h = ((q * total) / ts) * hh;
        parts.push(`<rect x="${B.l + i * bw + 3}" y="${B.t + hh - h}" width="${bw - 6}" height="${h}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 2"/>`);
      });
    }
    if (document.activeElement === svg) {
      parts.push(`<rect x="${B.l + focus * bw}" y="${B.t}" width="${bw}" height="${hh}" fill="none" stroke="var(--c-highlight)" stroke-width="2"/>`);
    }
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      parts.push(`<text x="${B.l + t * (BW - B.l - B.r)}" y="${BH - 8}" text-anchor="middle" style="font:9px var(--font-mono);fill:var(--ink-muted)">${t}</text>`);
    }
    svg.innerHTML = parts.join('');
  }

  function setBin(i, v) {
    if (locked) return;
    band[i] = Math.max(0, Math.min(1, v));
    readout.textContent = `bin ${(i / bins).toFixed(2)}–${((i + 1) / bins).toFixed(2)}: height ${band[i].toFixed(1)}`;
    draw();
    onChange(band);
  }

  const fromPointer = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * BW, py = ((e.clientY - r.top) / r.height) * BH;
    const i = Math.floor((px - B.l) / bw);
    if (i < 0 || i >= bins) return;
    focus = i;
    setBin(i, 1 - (py - B.t) / hh);
  };
  let painting = false;
  svg.addEventListener('pointerdown', (e) => { painting = true; svg.setPointerCapture(e.pointerId); fromPointer(e); });
  svg.addEventListener('pointermove', (e) => { if (painting) fromPointer(e); });
  svg.addEventListener('pointerup', () => { painting = false; });
  svg.addEventListener('pointercancel', () => { painting = false; });
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      focus = (focus + (e.key === 'ArrowRight' ? 1 : bins - 1)) % bins;
      readout.textContent = `bin ${(focus / bins).toFixed(2)}–${((focus + 1) / bins).toFixed(2)}: height ${band[focus].toFixed(1)}`;
      draw();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      setBin(focus, band[focus] + (e.key === 'ArrowUp' ? 0.1 : -0.1));
    } else return;
    e.preventDefault();
    e.stopPropagation();   // keep the arrows away from the camera ship
  });
  svg.addEventListener('focus', draw);
  svg.addEventListener('blur', draw);
  draw();

  return {
    el: wrap,
    get band() { return [...band]; },
    setBand(b) { band = b.map((v) => Math.max(0, Math.min(1, v))); draw(); },
    setTruth(t) { truth = t; draw(); },
    setLocked(v) { locked = v; },
    reset() { band = new Array(bins).fill(0); truth = null; draw(); onChange(band); },
  };
}
