// Zone 3 · The Splitting Reef: four challenges and the way to the Mimic.
//   (a) Turn the tide; log where the harbour splits (1 → 2 → 4 → chaos).
//   (b) The bifurcation diagram grows on the water as the tide sweeps; cover the range.
//   (c) Find the calm window of period 3 near r = 1 + √8.
//   (d) From the logged splits, the ratio of successive gaps, beside the true values and δ.
// The dial shows 2 decimals (the engine's wheel format); this zone writes 4 into it.

import config from './config.js';
import { createDiscreteZone } from '../../harness/discrete.js';
import { logistic, attractor, periodOf, cyclePoints, findSplits, gapRatios, DELTA } from './cascade.js';
import { createReefDiagram } from './reef-diagram.js';
import { startMimic } from './mimic.js';

const f4 = (v) => (Number.isFinite(v) ? v.toFixed(4) : '—');
const ORD = ['1st', '2nd', '3rd', '4th'];
const harboursText = (p) => (p === 'chaos' ? 'many: no harbour holds (chaos)' : p === 1 ? '1' : `${p}, visited in turn`);

export function start(root, { progress, chapterHref, chapterTitle, params }) {
  const z = createDiscreteZone(root, { config, progress, chapterHref, chapterTitle });
  if (!z) return;
  const N = config.n;
  const done = (id) => !!progress.zone(N).challenges[id];
  const allDone = () => config.challenges.every((c) => done(c.id));
  const TRUE = findSplits(logistic, 0.5, 4, [1, 4]);

  let logs = progress.zone(N).splits ?? [];
  let period = 1, sounding = null, soundTimer = null;
  let ratioTries = 0, ratioShown = !!progress.zone(N).ratio;
  let chosen = null, mimic = null;

  const reef = createReefDiagram(z, { from: config.tide.from, to: config.tide.to, stepR: logistic, labels: config.tide.labels });
  z.rig.state.z = -12; z.rig.state.dist = 44; z.rig.zoom(1);
  z.on('vantage', (v) => { if (v) z.rig.frame(reef.frameRect()); });

  function complete(id, message) {
    if (done(id)) { if (message) z.say(message); return; }
    progress.updateZone(N, { challenges: { ...progress.zone(N).challenges, [id]: true } });
    const fresh = z.logbook.unlock({ a: 'doubling', b: 'diagram', c: 'windows', d: 'delta' }[id]);
    z.say(`${message}${fresh ? ' A new logbook page is written (<kbd>L</kbd>).' : ''}`);
  }

  // --- the tide ------------------------------------------------------------------------------------
  function enableMainTide(value = config.tide.from) {
    const { key, label, from, to, step } = config.tide;
    z.enableTide({ key, label, from, to, step, value, rule: (r) => ({ ...config.rule, params: { r } }) });
    onTide(value);
  }

  function onTide(r) {
    if (mimic) return;
    const vals = attractor(logistic, r);
    period = periodOf(vals);
    const cycle = typeof period === 'number' && period <= 16 ? cyclePoints(vals, period) : [];
    reef.sweepTo(r);
    reef.setCurrent(r);
    reef.setHarbours(cycle);
    const out = z.tideWheel?.el.querySelector('output');
    if (out) out.textContent = f4(r);
    // a sounding boat, already settled, so the harbours show at once
    clearTimeout(soundTimer);
    soundTimer = setTimeout(() => {
      if (sounding) z.fleet.remove(sounding.id);
      sounding = z.fleet.drop(vals.at(-1));
    }, 200);
    if (reef.coverage() >= config.coverage && !done('b')) { complete('b', 'The whole reef is mapped: forks, mist, and clear stripes.'); render(); }
    if (period === 3 && r >= config.window3[0] - 0.001 && !done('c')) { complete('c', `Calm at r = ${f4(r)}: three harbours in the middle of chaos.`); render(); }
    const live = z.panel.querySelector('.live');
    if (live) live.innerHTML = liveText(r);
  }
  const liveText = (r) => `tide <span class="mono">r = ${f4(r)}</span> · harbours: <strong>${harboursText(period)}</strong>`;
  z.on('tide', onTide);

  // --- (a) logging splits -----------------------------------------------------------------------------
  const matched = () => TRUE.map((t, i) => {
    let best = null;
    for (const l of logs) if (Math.abs(l - t) <= config.splitTol[i] && (best === null || Math.abs(l - t) < Math.abs(best - t))) best = l;
    return best;
  });

  function logSplit() {
    if (mimic) return;
    const r = +z.store.get().r.toFixed(4);
    logs = [...logs, r].sort((a, b) => a - b);
    progress.updateZone(N, { splits: logs });
    reef.setLogs(logs);
    const i = TRUE.findIndex((t, k) => Math.abs(r - t) <= config.splitTol[k]);
    z.say(i >= 0
      ? `Logged ${f4(r)}: the ${ORD[i]} split (${2 ** i} → ${2 ** (i + 1)} harbours).`
      : `Logged ${f4(r)}, but the number of harbours doesn’t change there. Look where it does.`);
    const m = matched();
    if (m[0] !== null && m[1] !== null && m[2] !== null) complete('a', 'Three splits logged: 1 → 2 → 4 → 8.');
    render();
  }
  z.on('key', (k) => { if (k === 'k') logSplit(); });

  // --- panel -----------------------------------------------------------------------------------------------
  const current = () => chosen ?? config.challenges.find((c) => !done(c.id))?.id ?? null;

  function render() {
    if (mimic) return;
    const cur = current();
    z.setChallenges([
      ...config.challenges.map((c) => ({ ...c, done: done(c.id), active: c.id === cur })),
      { id: 'boss', title: `Boss: ${config.boss.name}`, done: progress.zone(N).boss, active: false, pickable: false },
    ], { onPick: (id) => { chosen = id; render(); } });
    z.panel.innerHTML = `<p class="live">${liveText(z.store.get().r ?? config.tide.from)}</p>${panelFor(cur)}${bossBlock()}`;
    wire();
  }

  function logTable() {
    const m = matched();
    return `<ul class="split-log mono">${TRUE.map((_, i) => `<li>${ORD[i]} split: ${m[i] !== null ? `<strong>${f4(m[i])}</strong>` : '<span class="muted">not logged</span>'}</li>`).join('')}</ul>
      ${logs.length ? `<p class="muted">all logs: ${logs.map(f4).join(', ')}</p>` : ''}`;
  }

  function panelFor(id) {
    if (id === 'a') {
      return `
        <h3>Log the splits</h3>
        <p>Turn the tide up (drag the wheel, or <kbd>]</kbd>; <kbd>Shift</kbd>+<kbd>]</kbd> for bigger steps).
          Watch the harbour lights on the lane. When one harbour becomes two, log the tide. Then two
          becoming four, and four becoming eight.</p>
        <div class="hud-row">
          <button type="button" class="button primary" data-act-z="log">Log a split here <kbd>K</kbd></button>
          <button type="button" class="button quiet" data-act-z="clear">Clear logs</button>
        </div>
        ${logTable()}
        <p class="muted">The splits crowd together. Near the third and fourth, use single steps.</p>`;
    }
    if (id === 'b') {
      return `
        <h3>Grow the reef map</h3>
        <p>Every tide you visit leaves a row of dots north of the lane: where boats keep going. Sweep
          the whole tide, 2.8 to 4.0, and watch the map grow. Press <kbd>V</kbd> to see it from above.</p>
        <p class="mono">mapped: ${Math.round(reef.coverage() * 100)}% (need ${config.coverage * 100}%)</p>`;
    }
    if (id === 'c') {
      return `
        <h3>Find the calm window</h3>
        <p>Past about 3.57 the boats never settle. But the map has clear stripes. Somewhere past 3.8
          there is a stretch of tide where only <strong>three</strong> harbours hold. Find it.</p>
        ${done('c') ? `<p>Found. It opens at <span class="mono">1 + √8 ≈ ${f4(config.window3[0])}</span>, suddenly, out of chaos.</p>` : ''}`;
    }
    if (id === 'd') {
      const m = matched();
      if (m.slice(0, 3).some((v) => v === null)) {
        return `<h3>The ratio of the gaps</h3><p>First log at least three splits (challenge 1).</p>${logTable()}`;
      }
      const have = m.filter((v) => v !== null);
      const gaps = have.slice(1).map((v, i) => v - have[i]);
      const own = gapRatios(have), truth = gapRatios(TRUE);
      return `
        <h3>The ratio of the gaps</h3>
        <p>Your splits, and the gaps between them:</p>
        <table class="ghost-table"><tbody>
          ${gaps.map((g, i) => `<tr><td>gap ${i + 1}</td><td class="mono">${f4(have[i + 1])} − ${f4(have[i])} = ${f4(g)}</td></tr>`).join('')}
        </tbody></table>
        <p><strong>Your turn:</strong> gap 1 ÷ gap 2 = ?</p>
        <form class="hud-row ratio-form">
          <input id="ratio-in" type="number" step="0.01" min="0" style="width:6rem;font-family:var(--font-mono)" aria-label="gap 1 divided by gap 2" ${ratioShown ? 'disabled' : ''}>
          <button type="submit" class="button primary" ${ratioShown ? 'disabled' : ''}>Check</button>
        </form>
        ${ratioShown ? `
          <table class="ghost-table"><thead><tr><th scope="col"></th><th scope="col">yours</th><th scope="col">true</th></tr></thead><tbody>
            ${truth.map((t, i) => `<tr><td>gap ${i + 1} ÷ gap ${i + 2}</td><td class="mono">${own[i] !== undefined ? own[i].toFixed(2) : '—'}</td><td class="mono">${t.toFixed(3)}</td></tr>`).join('')}
            <tr><td>in the limit</td><td></td><td class="mono">δ = ${DELTA.toFixed(3)}</td></tr>
          </tbody></table>
          <p>Each gap is about 4.7 times the next. Your ratio, <span class="mono">${own.at(-1).toFixed(2)}</span>, goes with you to the Mimic.</p>` : ''}`;
    }
    return `<h3>All four challenges done</h3><p>The reef is mapped, split by split. Revisit any challenge from the list.</p>`;
  }

  function bossBlock() {
    const beaten = progress.zone(N).boss;
    if (!allDone() && !beaten) return `<p class="muted boss-teaser">Finish all four to meet ${config.boss.name}.</p>`;
    return `
      <div class="boss-call">
        <p>${beaten ? `You outguessed ${config.boss.name}. Draw her another reef any time.` : `${config.boss.name} wants to see a reef of your own.`}</p>
        <button type="button" class="button primary" data-boss>${beaten ? 'Rematch' : 'Challenge'} ${config.boss.name}</button>
      </div>`;
  }

  function wire() {
    const q = (s) => z.panel.querySelector(s);
    q('[data-act-z="log"]')?.addEventListener('click', logSplit);
    q('[data-act-z="clear"]')?.addEventListener('click', () => { logs = []; progress.updateZone(N, { splits: [] }); reef.setLogs([]); render(); });
    q('[data-boss]')?.addEventListener('click', enterMimic);
    q('.ratio-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const have = matched().filter((v) => v !== null);
      const want = (have[1] - have[0]) / (have[2] - have[1]);
      const v = +q('#ratio-in').value;
      ratioTries++;
      if (Math.abs(v - want) <= 0.1 * want || ratioTries >= 2) {
        ratioShown = true;
        const own = gapRatios(have);
        progress.updateZone(N, { ratio: +own.at(-1).toFixed(3) });
        reef.setTruth(TRUE);
        complete('d', Math.abs(v - want) <= 0.1 * want
          ? `Right: ${want.toFixed(2)}. The true ratios run 4.75, 4.66, … towards δ = 4.669.`
          : `Gap 1 ÷ gap 2 is ${want.toFixed(2)} from your logs. The true ratios run 4.75, 4.66, … towards δ = 4.669.`);
        chosen = 'd';
      } else {
        z.say('Not quite: divide the first gap by the second one. Try once more.');
      }
      render();
    });
  }

  // --- the Mimic --------------------------------------------------------------------------------------------
  function enterMimic() {
    z.setChallenges([
      ...config.challenges.map((c) => ({ ...c, done: done(c.id) })),
      { id: 'boss', title: `Boss: ${config.boss.name}`, done: progress.zone(N).boss, active: true },
    ]);
    if (sounding) { z.fleet.remove(sounding.id); sounding = null; }
    mimic = startMimic(z, {
      reef,
      ownRatio: progress.zone(N).ratio ?? null,
      render(html, wireUp) { z.panel.innerHTML = html; wireUp(z.panel); },
      onWin() {
        progress.updateZone(N, { boss: true });
        z.logbook.unlock('universality');
        z.say(`${config.boss.name} is outguessed. The logbook has the reason (<kbd>L</kbd>).`);
      },
      onExit() {
        mimic = null;
        z.fleet.recall();
        reef.reset({ from: config.tide.from, to: config.tide.to, stepR: logistic, labels: config.tide.labels });
        reef.setLogs(logs);
        if (done('d')) reef.setTruth(TRUE);
        enableMainTide();
        render();
      },
    });
  }

  enableMainTide();
  reef.setLogs(logs);
  if (done('d')) reef.setTruth(TRUE);
  render();
  if (params.get('boss') === '1') enterMimic();
  else if (!progress.zone(N).log.length) {
    z.say(`Welcome to the Splitting Reef. The same lane, but now you hold the tide: it sets <span class="mono">r</span>.${z.world.reducedMotion ? ' Reduced motion is on: press <kbd>Space</kbd> to flash.' : ''}`, { sticky: z.world.reducedMotion });
  }
}
