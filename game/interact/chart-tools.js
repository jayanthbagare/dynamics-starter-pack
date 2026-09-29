// Chart tools: the symbol palette, the chart the player is drawing, and the symbol icons
// used by the HUD and the logbook.
//
//   const chart = createChartModel(savedList);
//   chart.place('harbour', [0.74])   // on top of an existing mark: same symbol removes it, another replaces it
//   chart.list                        → [{ symbol, at }]
//
//   const palette = createChartPalette(container, {
//     symbols: ['harbour', 'fountain', 'half-harbour'],
//     onPlace: () => …,  onUndo, onClear, onCheck,    // buttons (keyboard route to every action)
//   });
//   palette.selected                  → 'harbour'
//   palette.setStatus(html)

export const SYMBOL_INFO = {
  harbour: { name: 'harbour', meaning: 'stable point: boats settle here' },
  fountain: { name: 'fountain', meaning: 'unstable point: boats are pushed away' },
  'half-harbour': { name: 'half-harbour', meaning: 'half-stable: can’t tell by slope alone' },
  whirlpool: { name: 'whirlpool', meaning: 'spiral' },
  crossing: { name: 'crossing', meaning: 'saddle' },
  gyre: { name: 'gyre', meaning: 'limit cycle' },
};

export function symbolIcon(symbol, size = 20) {
  const s = `width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true" focusable="false"`;
  const st = 'var(--c-stable)', un = 'var(--c-unstable)', ink = 'var(--ink)', bg = 'var(--bg)', tr = 'var(--c-trajectory)';
  switch (symbol) {
    case 'harbour': return `<svg ${s}><circle cx="10" cy="10" r="7" fill="${st}" stroke="${st}" stroke-width="2"/></svg>`;
    case 'fountain': return `<svg ${s}><circle cx="10" cy="10" r="7" fill="${bg}" stroke="${un}" stroke-width="2.4"/></svg>`;
    case 'half-harbour': return `<svg ${s}><circle cx="10" cy="10" r="7" fill="${bg}" stroke="${ink}" stroke-width="2"/><path d="M10 3 A7 7 0 0 0 10 17 Z" fill="${ink}"/></svg>`;
    case 'whirlpool': return `<svg ${s}><path d="M10 10 m0.8 0 a0.8 0.8 0 1 0 -1.6 0 a2.4 2.4 0 1 0 4.8 0 a4 4 0 1 0 -8 0 a5.6 5.6 0 1 0 11.2 0" fill="none" stroke="${tr}" stroke-width="1.8"/></svg>`;
    case 'crossing': return `<svg ${s}><path d="M3 3 L17 17 M17 3 L3 17" stroke="${un}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    case 'gyre': return `<svg ${s}><circle cx="10" cy="10" r="7.5" fill="none" stroke="${st}" stroke-width="1.4"/><circle cx="17.5" cy="10" r="1.8" fill="${st}"/><circle cx="6.25" cy="16.5" r="1.8" fill="${st}"/><circle cx="6.25" cy="3.5" r="1.8" fill="${st}"/></svg>`;
    default: return '';
  }
}

export function createChartModel(initial = [], { tol = 0.15 } = {}) {
  let list = initial.map((s) => ({ symbol: s.symbol, at: [...s.at] }));
  const history = [];
  const near = (at) => list.findIndex((s) => Math.hypot(...s.at.map((v, i) => v - at[i])) < tol);
  return {
    get list() { return list; },
    place(symbol, at) {
      history.push(list);
      const i = near(at);
      if (i < 0) list = [...list, { symbol, at }];
      else if (list[i].symbol === symbol) list = list.filter((_, j) => j !== i);
      else list = list.map((s, j) => (j === i ? { symbol, at: s.at } : s));
    },
    undo() { if (history.length) list = history.pop(); },
    clear() { if (list.length) { history.push(list); list = []; } },
    set(l) { list = l; },
  };
}

export function createChartPalette(container, { symbols, onSelect = () => {}, onPlace, onUndo, onClear, onCheck }) {
  const name = `sym-${Math.random().toString(36).slice(2, 7)}`;
  const el = document.createElement('div');
  el.className = 'chart-tools';
  el.innerHTML = `
    <div class="symbol-choice" role="radiogroup" aria-label="Chart symbol">
      ${symbols.map((s, i) => `
        <label title="${SYMBOL_INFO[s].meaning}">
          <input type="radio" name="${name}" value="${s}" ${i === 0 ? 'checked' : ''}>
          <span>${symbolIcon(s)} ${SYMBOL_INFO[s].name}</span>
        </label>`).join('')}
    </div>
    <div class="hud-row">
      <button type="button" class="button" data-act="place">Place at helm</button>
      <button type="button" class="button quiet" data-act="undo">Undo</button>
      <button type="button" class="button quiet" data-act="clear">Clear</button>
      <button type="button" class="button primary" data-act="check">Check chart</button>
    </div>
    <div class="chart-status" aria-live="polite"></div>`;
  container.append(el);

  const radios = [...el.querySelectorAll('input[type=radio]')];
  el.addEventListener('change', () => onSelect(palette.selected));
  const acts = { place: onPlace, undo: onUndo, clear: onClear, check: onCheck };
  el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => acts[b.dataset.act]?.()));
  const status = el.querySelector('.chart-status');
  const placeBtn = el.querySelector('[data-act=place]');

  const palette = {
    el,
    get selected() { return radios.find((r) => r.checked)?.value ?? symbols[0]; },
    select(s) { const r = radios.find((r) => r.value === s); if (r) { r.checked = true; onSelect(s); } },
    setStatus(html) { status.innerHTML = html; },
    setPlaceLabel(text) { placeBtn.textContent = text; },
  };
  return palette;
}
