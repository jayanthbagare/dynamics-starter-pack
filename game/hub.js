// The hub: a world chart of the zones, with progress, the symbol legend and the controls.
// It uses the site's own header and footer, so the way back to the starter pack is always there.

import { mountLayout, ROOT } from '../core/layout.js';
import { symbolIcon, SYMBOL_INFO } from './interact/chart-tools.js';

export function renderHub(main, { zones, progress, chapterHref, chapterTitle, notice }) {
  const status = (z) => {
    if (!z.live) return { cls: '', text: 'uncharted' };
    const p = progress.zone(z.n);
    const done = Object.values(p.challenges).filter(Boolean).length;
    if (p.boss) return { cls: 'ready', text: 'boss beaten ✓' };
    if (done) return { cls: 'ready', text: `${done} done · sail on →` };
    return { cls: 'ready', text: 'set sail →' };
  };
  const chapterList = (z) => z.chapters.map((n) => `<a href="${chapterHref(n)}">Ch ${n}</a>`).join(' · ');
  const href = (z) => `?zone=${encodeURIComponent(z.key)}`;

  main.innerHTML = `
    <section class="hero">
      <p class="eyebrow">a companion game to the starter pack</p>
      <h1>The Cartographer</h1>
      <p class="lede">
        Chart a sea that runs on the rules from the starter pack. You never steer a boat. You drop it,
        predict where it goes, and reshape the whole sea with the tide. Then you draw the chart.
      </p>
      <p class="prose muted">Six zones and an optional summit, about 18 minutes each. No timers, no way to
        lose: you win by reading the sea. New here? The <a href="${ROOT.href}">starter pack</a> chapters are
        the same ideas, one page at a time.</p>
      <p class="hub-notice" role="status" hidden></p>
    </section>

    <section aria-labelledby="map-h">
      <h2 id="map-h">World chart</h2>
      <div class="world-chart">${worldChart(zones, href)}</div>
      <ol class="chapters zones">
        ${zones.map((z) => {
          const s = status(z);
          return `
          <li class="chapter zone-card ${z.live ? 'live' : 'locked'}">
            <span class="num">${z.optional ? 'Summit · optional' : `Zone ${z.key}`}</span>
            <h3>${z.live ? `<a href="${href(z)}">${z.title}</a>` : z.title}</h3>
            <p>${z.topic[0].toUpperCase() + z.topic.slice(1)}.${z.boss ? ` Boss: ${z.boss}.` : ''}</p>
            <div class="meta"><span>Starter pack ${z.chapters.map((n) => `Ch ${n}`).join(', ')}</span><span class="status ${s.cls}">${s.text}</span></div>
          </li>`;
        }).join('')}
      </ol>
      <p class="caption">Each zone replays starter-pack chapters: ${zones.filter((z) => z.live).map((z) => `${z.title} (${chapterList(z)})`).join('; ')}.</p>
    </section>

    <section aria-labelledby="legend-h">
      <h2 id="legend-h">Chart symbols</h2>
      <p class="prose">The same dots as the starter pack: filled means boats settle, hollow means boats are pushed away.
        Every symbol differs in shape, not just colour.</p>
      <ul class="legend symbol-legend">
        ${Object.entries(SYMBOL_INFO).map(([k, v]) => `<li>${symbolIcon(k, 18)} <strong>${v.name}</strong>&nbsp;<span class="muted">${v.meaning}</span></li>`).join('')}
      </ul>
    </section>

    <section aria-labelledby="keys-h">
      <h2 id="keys-h">Controls</h2>
      <div class="table-scroll">
        <table class="lens-notation keys-table">
          <tbody>
            <tr><td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrows</td><td>sail the camera ship</td></tr>
            <tr><td>scroll, <kbd>+</kbd> <kbd>−</kbd></td><td>zoom</td></tr>
            <tr><td>click the water</td><td>drop a boat (or, in the vantage, place a chart symbol)</td></tr>
            <tr><td>drag across the water</td><td>draw a ghost line: your prediction, one jump per drag</td></tr>
            <tr><td><kbd>V</kbd></td><td>vantage: look straight down and chart the sea</td></tr>
            <tr><td><kbd>[</kbd> <kbd>]</kbd></td><td>turn the tide (the parameter), where a zone has one</td></tr>
            <tr><td><kbd>L</kbd></td><td>logbook, at three reading levels</td></tr>
            <tr><td><kbd>Space</kbd>, <kbd>R</kbd></td><td>flash the lighthouse once, recall all boats</td></tr>
          </tbody>
        </table>
      </div>
      <p class="caption">Every mouse action also has a button in the helm panel, reachable with <kbd>Tab</kbd>.
        With reduced motion on, waves are still and the lighthouse waits for you.</p>
    </section>

    <section aria-labelledby="save-h">
      <h2 id="save-h">Your logbooks</h2>
      <p class="prose save-note"></p>
      <button type="button" class="button quiet" data-reset>Forget my progress</button>
    </section>`;

  mountLayout({ crumb: 'The Cartographer' });

  const noticeEl = main.querySelector('.hub-notice');
  if (notice) { noticeEl.textContent = notice; noticeEl.hidden = false; }

  const saveNote = main.querySelector('.save-note');
  saveNote.textContent = progress.persistent
    ? 'Progress, charts and logbook pages are saved in this browser only. Nothing is sent anywhere.'
    : 'This browser won’t let the game save (storage is off), so progress lasts until you close the tab.';
  main.querySelector('[data-reset]').addEventListener('click', (e) => {
    if (!confirm('Forget all zone progress, charts and logbook pages?')) return;
    for (const z of zones) progress.resetZone(z.n);
    e.target.textContent = 'Forgotten';
    e.target.disabled = true;
  });
}

// A stylised chart: islands along a dotted route. Decorative for assistive tech (the list below
// carries the same links), but every live island is clickable.
function worldChart(zones, href) {
  const route = zones.filter((z) => !z.optional).map((z) => z.at.join(',')).join(' ');
  const summit = zones.find((z) => z.optional);
  const last = zones.filter((z) => !z.optional).at(-1);
  const island = (z) => {
    const [x, y] = z.at;
    const shape = `<path class="island-shape" d="M ${x - 34} ${y + 6} Q ${x - 26} ${y - 22} ${x - 4} ${y - 18} Q ${x + 14} ${y - 30} ${x + 30} ${y - 8} Q ${x + 40} ${y + 10} ${x + 18} ${y + 16} Q ${x - 10} ${y + 24} ${x - 34} ${y + 6} Z"/>`;
    const label = `<text class="island-num" x="${x}" y="${y + 4}" text-anchor="middle">${z.key}</text>
      <text class="island-name" x="${x}" y="${y + 38}" text-anchor="middle">${z.title}</text>`;
    const g = `<g class="island ${z.live ? 'live' : 'locked'}">${shape}${label}</g>`;
    return z.live ? `<a href="${href(z)}" tabindex="-1">${g}</a>` : g;
  };
  return `
    <svg viewBox="0 0 800 380" aria-hidden="true" focusable="false">
      <rect class="chart-sea" x="0" y="0" width="800" height="380" rx="6"/>
      ${Array.from({ length: 7 }, (_, i) => `<line class="chart-grid" x1="${(i + 1) * 100}" y1="0" x2="${(i + 1) * 100}" y2="380"/>`).join('')}
      ${Array.from({ length: 3 }, (_, i) => `<line class="chart-grid" x1="0" y1="${(i + 1) * 95}" x2="800" y2="${(i + 1) * 95}"/>`).join('')}
      <polyline class="chart-route" points="${route}"/>
      <line class="chart-route optional" x1="${last.at[0]}" y1="${last.at[1]}" x2="${summit.at[0]}" y2="${summit.at[1]}"/>
      <g class="compass" transform="translate(56 64)">
        <circle r="26"/><path d="M 0 -22 L 5 0 L 0 22 L -5 0 Z"/><text y="-30" text-anchor="middle">N</text>
      </g>
      ${zones.map(island).join('')}
    </svg>`;
}
