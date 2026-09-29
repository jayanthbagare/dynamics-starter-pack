// Zone 2 · The Twin Fleets: the three challenges and the way to the Oracle.
//   (a) Bet on the flash when twins 1e-7 apart become visibly apart (gap > 0.1), then launch.
//   (b) Watch log(gap) climb a straight line, then say how fast it grows.
//   (c) Start the twins 1000× closer and see it buys about 10 flashes.
// Twins are dropped with z.fleet.drop, not z.drop: z.drop rounds starts to 4 decimals.

import config from './config.js';
import { createDiscreteZone } from '../../harness/discrete.js';
import { pairStats } from './twins.js';
import { createGapPlot } from './plots.js';
import { startOracle } from './oracle.js';

const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const sci = (v) => { const e = Math.round(Math.log10(v)); return `10<sup>${e < 0 ? '−' : ''}${Math.abs(e)}</sup>`; };

export function start(root, { progress, chapterHref, chapterTitle, params }) {
  const z = createDiscreteZone(root, { config, progress, chapterHref, chapterTitle });
  if (!z) return;
  const N = config.n;
  const done = (id) => !!progress.zone(N).challenges[id];
  const allDone = () => config.challenges.every((c) => done(c.id));
  z.store.set({ cursor: 0.3 });

  let pair = null;          // { a, b, gap0, gaps, splitAt, bet }
  const runs = {};          // gap0 → finished pair, for comparing (a) with (c)
  let bet = 12;             // (a) the player's bet
  let growthAnswer = null;  // (b)
  let closerBet = null;     // (c)
  let chosen = null;
  let oracle = null;
  let plot = null;
  let stats = null;         // medians over many random pairs, computed once for (c)

  function complete(id, message) {
    if (done(id)) { z.say(message); return; }
    progress.updateZone(N, { challenges: { ...progress.zone(N).challenges, [id]: true } });
    const fresh = z.logbook.unlock({ a: 'twins', b: 'doubling', c: 'horizon' }[id]);
    z.say(`${message}${fresh ? ' A new logbook page is written (<kbd>L</kbd>).' : ''}`);
    chosen = null;
  }

  function launch(gap0) {
    const x0 = Math.min(0.95, Math.max(0.05, z.store.get().cursor));
    z.fleet.recall();
    z.clearGhost();
    const a = z.fleet.drop(x0), b = z.fleet.drop(x0 + gap0);
    pair = { a, b, gap0, gaps: [gap0], splitAt: null, bet: gap0 === config.gap0 ? bet : null };
    z.store.set({ paused: z.world.reducedMotion });
    z.say(`Twins launched from <span class="mono">${fmt(x0)}</span>, ${sci(gap0)} apart. ${z.world.reducedMotion ? 'Press <kbd>Space</kbd> to flash.' : 'Watch them.'}`);
    render();
  }

  // --- events ---------------------------------------------------------------------------------------
  z.on('flash', () => {
    if (oracle || !pair) return;
    const { a, b } = pair;
    const k = a.xs.length - 1;
    if (pair.gaps.length > config.plotFlashes) return;
    const gap = Math.abs(a.xs.at(-1) - b.xs.at(-1));
    pair.gaps.push(gap);
    if (pair.splitAt === null && gap > config.threshold) {
      pair.splitAt = k;
      runs[pair.gap0] = pair;
      onSplit();
      render();
    }
    if (pair.splitAt !== null && k === pair.splitAt + 5) {
      if (current() === 'b') z.say('The gap has hit the ceiling: two boats on a lane of length 1 can’t be more than 1 apart.');
      render();   // the (b) question appears now
      return;
    }
    if (k === pair.splitAt) return;   // onSplit already re-rendered
    updateLive();
  });

  // every flash: only the numbers and the plot change, so focus stays where the player left it
  function updateLive() {
    const r = z.panel.querySelector('.twin-readout');
    if (r) r.outerHTML = liveReadout();
    if (plot && z.panel.contains(plot.el)) updatePlot(current());
  }

  z.on('chart', ({ grade }) => {
    if (grade.ok && z.logbook.unlock('fountains')) z.say('Two fountains and no harbour. A new logbook page is written (<kbd>L</kbd>).');
  });

  function onSplit() {
    const k = pair.splitAt;
    if (pair.gap0 === config.gap0) {
      if (pair.bet != null && !done('a')) {
        const off = Math.abs(pair.bet - k);
        complete('a', `Visible at flash ${k}. You bet ${pair.bet}: ${off === 0 ? 'exactly right.' : off <= 3 ? 'close.' : `off by ${off}.`}`);
      } else {
        z.say(`Visible at flash ${k}.`);
      }
    } else if (pair.gap0 === config.gap0 / config.closer) {
      const ref = runs[config.gap0]?.splitAt;
      if (closerBet && !done('c')) {
        complete('c', ref ? `1000× closer: visible at flash ${k}, against ${ref} before. That is ${k - ref} more flashes.` : `1000× closer: visible at flash ${k}.`);
        chosen = 'c';   // stay here: the medians over many pairs are the point
      } else {
        z.say(`Visible at flash ${k}.`);
      }
    }
  }

  // --- panel ------------------------------------------------------------------------------------------
  const current = () => chosen ?? config.challenges.find((c) => !done(c.id))?.id ?? null;

  function render() {
    if (oracle) return;
    const cur = current();
    z.setChallenges([
      ...config.challenges.map((c) => ({ ...c, done: done(c.id), active: c.id === cur })),
      { id: 'boss', title: `Boss: ${config.boss.name}`, done: progress.zone(N).boss, active: false, pickable: false },
    ], { onPick: (id) => { chosen = id; render(); } });
    const keep = plot && cur !== 'a' ? plot.el : null;   // reuse the plot so it doesn't flicker
    z.panel.innerHTML = panelFor(cur) + bossBlock();
    const slot = z.panel.querySelector('.plot-slot');
    if (slot) {
      if (keep) slot.append(keep);
      else plot = createGapPlot(slot, { maxFlash: config.plotFlashes });
      updatePlot(cur);
    }
    wire(cur);
  }

  function updatePlot(cur) {
    const series = [];
    if (cur === 'c' && runs[config.gap0] && pair?.gap0 !== config.gap0) series.push({ gaps: runs[config.gap0].gaps });
    if (pair) series.push({ gaps: pair.gaps, hollow: pair.gap0 !== config.gap0 });
    plot.set({ series, gap0: pair?.gap0 ?? config.gap0, truth: pair?.splitAt ?? null });
  }

  function liveReadout() {
    if (!pair) return '<p class="muted twin-readout">No twins on the water yet.</p>';
    const { a, b } = pair;
    const k = a.xs.length - 1;
    return `<p class="mono twin-readout">flash ${k}<br>A ${fmt(a.xs.at(-1), 7)}<br>B ${fmt(b.xs.at(-1), 7)}<br>gap ${pair.gaps.at(-1).toExponential(2)}${pair.splitAt !== null ? ` · visible since flash ${pair.splitAt}` : ''}</p>`;
  }

  function panelFor(id) {
    const where = `<p class="muted">They launch from the helm position (<span class="mono">${fmt(Math.min(0.95, Math.max(0.05, z.store.get().cursor)), 2)}</span>); move it with the mouse or the helm slider.</p>`;
    if (id === 'a') {
      const launched = pair && pair.gap0 === config.gap0 && pair.bet != null;
      return `
        <h3>Bet on the split</h3>
        <p>Two boats will launch <strong>one ten-millionth</strong> apart (${sci(config.gap0)}). At first you
          can’t tell them apart. At which flash will the gap first be bigger than 0.1, easy to see?</p>
        <div class="slider">
          <label for="twin-bet">your bet: flash</label>
          <output class="mono">${bet}</output>
          <div class="slider-track"><input id="twin-bet" type="range" min="1" max="60" step="1" value="${bet}" ${launched ? 'disabled' : ''}></div>
        </div>
        ${where}
        <div class="hud-row">
          <button type="button" class="button primary" data-launch="a">${launched ? 'Launch again' : 'Lock bet and launch'}</button>
        </div>
        ${liveReadout()}`;
    }
    if (id === 'b') {
      const finished = pair && pair.splitAt !== null && pair.gaps.length > pair.splitAt + 4;
      return `
        <h3>Read the gap</h3>
        <p>The plot shows the gap on a <strong>log scale</strong>: each step up is ten times bigger.
          Launch a pair and watch the dots.</p>
        <div class="plot-slot"></div>
        <div class="hud-row"><button type="button" class="button" data-launch="b">Launch a pair</button></div>
        ${finished ? `
          <p><strong>Predict:</strong> while the dots climb their straight line, how much bigger does the gap get each flash?</p>
          <div class="hud-row" role="group" aria-label="Growth per flash">
            ${[['1.1', 'about 1.1×'], ['2', 'about 2×'], ['10', 'about 10×']].map(([v, l]) => `<button type="button" class="button ${growthAnswer === v ? 'primary' : ''}" data-grow="${v}" ${growthAnswer ? 'disabled' : ''}>${l}</button>`).join('')}
          </div>
          ${growthAnswer ? `<p>${growthAnswer === '2' ? 'Yes:' : 'Not quite:'} the dashed line doubles every flash, and the dots follow it
            until they reach the ceiling. Ten steps of doubling is about ×1000.</p>
            ${done('c') ? '' : '<div class="hud-row"><button type="button" class="button primary" data-next>Next: a thousand times closer</button></div>'}` : ''}` : '<p class="muted">The question appears once the gap has levelled off.</p>'}`;
    }
    if (id === 'c') {
      stats ??= { a: pairStats(config.gap0, 500, 5).median, c: pairStats(config.gap0 / config.closer, 500, 5).median };
      const ref = runs[config.gap0]?.splitAt;
      return `
        <h3>A thousand times closer</h3>
        <p>${ref ? `Twins ${sci(config.gap0)} apart became visible at flash <strong>${ref}</strong>.` : `Twins ${sci(config.gap0)} apart usually become visible around flash 20.`}
          Now start them 1000× closer: ${sci(config.gap0 / config.closer)}.</p>
        <p><strong>Predict:</strong> how much longer will they stay together?</p>
        <div class="hud-row" role="group" aria-label="How much longer">
          ${[['x1000', 'about 1000× longer'], ['100', 'about 100 flashes more'], ['10', 'about 10 flashes more'], ['0', 'hardly any longer']].map(([v, l]) => `<button type="button" class="button ${closerBet === v ? 'primary' : ''}" data-closer="${v}" ${closerBet ? 'disabled' : ''}>${l}</button>`).join('')}
        </div>
        ${closerBet ? `<div class="hud-row"><button type="button" class="button primary" data-launch="c">Launch 1000× closer</button></div>` : ''}
        <div class="plot-slot"></div>
        ${done('c') ? `<p>Over 500 random pairs the median is <span class="mono">${stats.a}</span> flashes at ${sci(config.gap0)}
          and <span class="mono">${stats.c}</span> at ${sci(config.gap0 / config.closer)}: <strong>${stats.c - stats.a} more</strong>.
          The gap doubles each flash, and 1000 is about 2<sup>10</sup>.</p>` : ''}
        ${liveReadout()}`;
    }
    return `
      <h3>All three challenges done</h3>
      <p>You have seen twins part, the gap double, and the horizon refuse to move. Relaunch any time from the list.</p>`;
  }

  function bossBlock() {
    const beaten = progress.zone(N).boss;
    if (!allDone() && !beaten) return `<p class="muted boss-teaser">Finish all three to meet ${config.boss.name}.</p>`;
    return `
      <div class="boss-call">
        <p>${beaten ? `You satisfied ${config.boss.name}. Ask her again any time.` : `${config.boss.name} has a question for you.`}</p>
        <button type="button" class="button primary" data-boss>${beaten ? 'Visit' : 'Answer'} ${config.boss.name}</button>
      </div>`;
  }

  function wire(id) {
    const q = (s) => z.panel.querySelector(s);
    z.panel.querySelector('[data-boss]')?.addEventListener('click', enterOracle);
    z.panel.querySelector('[data-next]')?.addEventListener('click', () => { chosen = null; render(); });
    q('#twin-bet')?.addEventListener('input', (e) => {
      bet = +e.target.value;
      e.target.closest('.slider').querySelector('output').textContent = bet;
    });
    z.panel.querySelectorAll('[data-launch]').forEach((b) => b.addEventListener('click', () => {
      launch(b.dataset.launch === 'c' ? config.gap0 / config.closer : config.gap0);
    }));
    z.panel.querySelectorAll('[data-grow]').forEach((b) => b.addEventListener('click', () => {
      growthAnswer = b.dataset.grow;
      complete('b', growthAnswer === '2' ? 'Doubling each flash: the Lyapunov exponent is ln 2.' : 'It doubles each flash: the straight line climbs by log 2 per flash.');
      chosen = 'b';
      render();
    }));
    z.panel.querySelectorAll('[data-closer]').forEach((b) => b.addEventListener('click', () => {
      closerBet = b.dataset.closer;
      render();
    }));
  }

  // --- the Oracle -------------------------------------------------------------------------------------------
  function enterOracle() {
    pair = null;
    plot = null;
    z.setChallenges([
      ...config.challenges.map((c) => ({ ...c, done: done(c.id) })),
      { id: 'boss', title: `Boss: ${config.boss.name}`, done: progress.zone(N).boss, active: true },
    ]);
    oracle = startOracle(z, {
      render(html, wireUp) { z.panel.innerHTML = html; wireUp(z.panel); },
      onWin({ edgesHeavy }) {
        progress.updateZone(N, { boss: true, ...(edgesHeavy ? { edges: true } : {}) });
        z.logbook.unlock('density');
        z.say(`${config.boss.name} is satisfied. The logbook has her answer (<kbd>L</kbd>).`);
      },
      onExit() { oracle = null; render(); },
    });
  }

  render();
  if (params.get('boss') === '1') enterOracle();
  else if (!progress.zone(N).log.length) {
    z.say(`Welcome to the Twin Fleets. The rule here is new: the lane runs from 0 to 1.${z.world.reducedMotion ? ' Reduced motion is on: press <kbd>Space</kbd> to flash.' : ''}`, { sticky: z.world.reducedMotion });
  }
}
