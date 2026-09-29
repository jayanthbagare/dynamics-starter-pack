// Zone 1 · The Lighthouse: the three challenges and the way into the Keeper.
//   (a) Find the harbour: boats from 5 different starts, then chart the single harbour.
//   (b) Ghost lines: predict a boat's jumps, then see them beside the true jumps.
//   (c) Read the beam: predict how boats approach the harbour; the answer is the negative slope.

import config, { XSTAR } from './config.js';
import { createDiscreteZone } from '../../harness/discrete.js';
import { startKeeper } from './boss.js';

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '—');
const signed = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);

export function start(root, { progress, chapterHref, chapterTitle, params }) {
  const z = createDiscreteZone(root, { config, progress, chapterHref, chapterTitle });
  if (!z) return;
  const N = config.n;
  const done = (id) => !!progress.zone(N).challenges[id];
  const allDone = () => config.challenges.every((c) => done(c.id));

  const starts = [];
  let chartOk = false;       // last chart check passed, and nothing changed since
  let lastGhost = null;      // { score, buoy }
  let beamAnswer = null;     // 'side' | 'zigzag'
  let boss = null;
  let chosen = null;         // challenge the player picked from the list

  function complete(id, message) {
    if (done(id)) return;
    progress.updateZone(N, { challenges: { ...progress.zone(N).challenges, [id]: true } });
    const page = { a: 'harbour', b: 'ghost', c: 'zigzag' }[id];
    const fresh = z.logbook.unlock(page);
    z.say(`${message}${fresh ? ' A new logbook page is written (<kbd>L</kbd>).' : ''}`);
    chosen = null;
    render();
  }

  // --- events -----------------------------------------------------------------------------------
  z.on('drop', (b) => {
    if (boss) return;
    const x0 = b.xs[0];
    if (!starts.some((s) => Math.abs(s - x0) < 0.05)) starts.push(x0);
    if (starts.length >= config.startsNeeded && chartOk) complete('a', 'Five starts, one harbour, charted.');
    render();
  });

  z.on('flash', () => {
    if (boss) return;
    const f = z.focusBuoy();
    if (f && f.xs.length > 4 && Math.abs(f.xs.at(-1) - f.xs.at(-2)) < 0.005 && z.logbook.unlock('orbit')) {
      z.say('That boat has stopped moving. A new logbook page is written (<kbd>L</kbd>).');
    }
    if (current() === 'c' && beamAnswer) render();
  });

  z.on('chart', ({ grade }) => {
    if (boss) return;
    chartOk = grade.ok;
    if (!grade.ok) return;
    if (starts.length >= config.startsNeeded) complete('a', 'Five starts, one harbour, charted.');
    else z.say(`Your chart is right. Now back it up: drop boats from ${config.startsNeeded - starts.length} more different start${config.startsNeeded - starts.length > 1 ? 's' : ''}.`);
    render();
  });
  z.on('chartEdit', () => { chartOk = false; });

  z.on('ghost', ({ score, buoy }) => {
    if (boss) return;
    lastGhost = { score, buoy };
    const enough = score.total >= config.ghost.minHops;
    if (enough) complete('b', `Your ghost line: ${score.hits} of ${score.total} jumps within ${config.ghost.tol}.`);
    else z.say(`Scored ${score.hits} of ${score.total}. Predict at least ${config.ghost.minHops} jumps to finish this challenge.`);
    render();
  });

  // --- panel -------------------------------------------------------------------------------------
  const current = () => chosen ?? config.challenges.find((c) => !done(c.id))?.id ?? null;

  function render() {
    if (boss) return;
    const cur = current();
    z.setChallenges([
      ...config.challenges.map((c) => ({ ...c, done: done(c.id), active: c.id === cur })),
      { id: 'boss', title: `Boss: ${config.boss.name}`, done: progress.zone(N).boss, active: false, pickable: false },
    ], { onPick: (id) => { chosen = id; render(); } });
    z.panel.innerHTML = panelFor(cur) + bossBlock();
    wire(cur);
  }

  function panelFor(id) {
    if (id === 'a') {
      const dots = Array.from({ length: config.startsNeeded }, (_, i) => (i < starts.length ? '●' : '○')).join(' ');
      return `
        <h3>Find the harbour</h3>
        <p>Click the lane to drop a boat. Drop boats from ${config.startsNeeded} different starts: near,
          far, left, right. Where do they end up?</p>
        <p>Then press <kbd>V</kbd> for the vantage and chart what you found.</p>
        <p class="mono starts" aria-label="${starts.length} of ${config.startsNeeded} different starts">${dots}
          <span class="muted">${starts.slice(0, 8).map((s) => fmt(s, 2)).join(', ')}</span></p>`;
    }
    if (id === 'b') {
      const g = lastGhost;
      return `
        <h3>Ghost lines</h3>
        <p>Before you release a boat, predict it. <strong>Drag</strong> across the water from where you’ll
          drop it to where you think it lands after one flash. Drag again for the next jump.
          Predict at least ${config.ghost.minHops} jumps, then click to let it go.</p>
        <p class="muted">No mouse? Use the helm: “Predict from here”, then “Add jump here”.</p>
        ${g ? ghostTable(g.score) : ''}`;
    }
    if (id === 'c') {
      const f = z.focusBuoy();
      const gaps = f ? f.xs.slice(-6).map((x) => x - XSTAR) : [];
      return `
        <h3>Read the beam</h3>
        <p>The lighthouse beam draws each jump: from the boat to the curve on the water, then back to the
          lane. Drop a boat far from the harbour and watch the beam as the boat closes in.</p>
        <p><strong>Predict:</strong> close to the harbour, how does a boat approach it?</p>
        <div class="hud-row" role="group" aria-label="Your prediction">
          <button type="button" class="button ${beamAnswer === 'side' ? 'primary' : ''}" data-c="side" ${beamAnswer ? 'disabled' : ''}>Creeping in from one side</button>
          <button type="button" class="button ${beamAnswer === 'zigzag' ? 'primary' : ''}" data-c="zigzag" ${beamAnswer ? 'disabled' : ''}>Hopping from side to side</button>
        </div>
        ${beamAnswer ? `
          <p>${beamAnswer === 'zigzag' ? 'Right:' : 'Look again:'} each jump lands on the <em>other</em> side of the
            harbour. The gap from the harbour, jump by jump, for the newest boat:</p>
          <p class="mono gaps">${gaps.length ? gaps.map((g) => signed(g)).join('  ') : 'drop a boat to see its gaps'}</p>
          <p>The dashed line through the harbour is the rule’s slope there: <span class="mono">${fmt(-Math.sin(XSTAR), 2)}</span>.
            Negative, so each jump flips sides. Smaller than 1 in size, so each gap is about two-thirds of the last.</p>` : ''}`;
    }
    return `
      <h3>All three challenges done</h3>
      <p>The harbour is charted, your guesses are logged, and you know why the beam spirals.</p>`;
  }

  function ghostTable(score) {
    return `
      <table class="ghost-table">
        <caption class="muted">Your last ghost line: ${score.hits} of ${score.total} within ${config.ghost.tol}</caption>
        <thead><tr><th scope="col">jump</th><th scope="col">guess</th><th scope="col">true</th><th scope="col"></th></tr></thead>
        <tbody>${score.steps.map((s) => `
          <tr><td>${s.i}</td><td class="mono">${fmt(s.guess, 2)}</td><td class="mono">${fmt(s.truth, 2)}</td>
          <td>${s.hit ? 'close' : '<span class="muted">off by ' + fmt(s.error, 2) + '</span>'}</td></tr>`).join('')}
        </tbody>
      </table>`;
  }

  function bossBlock() {
    const beaten = progress.zone(N).boss;
    if (!allDone() && !beaten) {
      return `<p class="muted boss-teaser">Finish all three to meet ${config.boss.name}.</p>`;
    }
    return `
      <div class="boss-call">
        <p>${beaten ? `You beat ${config.boss.name}. Rematch any time.` : `${config.boss.name} is waiting at the dock.`}</p>
        <button type="button" class="button primary" data-boss>${beaten ? 'Rematch' : 'Challenge'} ${config.boss.name}</button>
      </div>`;
  }

  function wire(id) {
    z.panel.querySelector('[data-boss]')?.addEventListener('click', enterBoss);
    if (id === 'c') {
      z.panel.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
        beamAnswer = b.dataset.c;
        z.setTangent({ x: XSTAR, slope: -Math.sin(XSTAR) });
        complete('c', beamAnswer === 'zigzag'
          ? 'Side to side it is: the slope at the harbour is negative.'
          : 'Not quite: watch the gaps, they flip sign every jump. The slope at the harbour is negative.');
        chosen = 'c';
        render();
      }));
    }
  }

  // --- the Keeper ---------------------------------------------------------------------------------
  function enterBoss() {
    z.setChallenges([
      ...config.challenges.map((c) => ({ ...c, done: done(c.id) })),
      { id: 'boss', title: `Boss: ${config.boss.name}`, done: progress.zone(N).boss, active: true },
    ]);
    boss = startKeeper(z, {
      render(html, wireUp) { z.panel.innerHTML = html; wireUp(z.panel); },
      onWin() {
        progress.updateZone(N, { boss: true });
        z.logbook.unlock('criterion');
        z.say(`You beat ${config.boss.name}. The logbook has his secret (<kbd>L</kbd>).`);
      },
      onExit() { boss = null; render(); },
    });
  }

  render();
  if (params.get('boss') === '1') enterBoss();
  else if (!progress.zone(N).log.length) {
    z.say(`Welcome to the Lighthouse. Click anywhere on the lane to drop a boat, and watch what the lighthouse does to it.${
      z.world.reducedMotion ? ' Reduced motion is on, so the lighthouse waits: press <kbd>Space</kbd> to flash.' : ''}`, { sticky: z.world.reducedMotion });
  }
}
