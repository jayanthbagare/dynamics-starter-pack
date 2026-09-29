// The Oracle. She launches a boat from 0.3 and asks where it will be at flash 60.
// Every single number is rejected, with the true value (and her own twin's) drawn beside it.
// She is satisfied by a painted probability band close to the map's invariant density
// (total variation ≤ BAND_PASS), and says so when the player noticed the heavy edges.
// A band that misses gets the true distribution, 20,000 boats at flash 60, beside it.

import { iterate } from '../../sim/maps.js';
import { logistic, judgeBand, cloudAt, histogram, BAND_PASS } from './twins.js';
import { createBandPainter } from './plots.js';

const LINES = {
  ask: 'I know where my boat started to seven digits. Tell me where it will be at flash 60.',
  reject: 'A single number? That is a coin toss dressed as a forecast.',
  again: 'Another number. It will not help.',
  paint: 'Paint me where it might be, and how likely each place is. Heavy where it is likely, light where it is not.',
  flat: 'Even-handed. But boats do not spend equal time everywhere on this lane.',
  far: 'Most of your band sits where my boats rarely are. Look at mine beside it.',
  near: 'Closer. Compare the ends of the lane with mine.',
  edges: 'You saw it: heaviest at the edges, where boats slow, turn, and linger. That is all anyone can know at flash 60, and it is a great deal.',
  pass: 'That will do. Though look again at the ends of the lane: my boats crowd there.',
};

export function startOracle(z, { render, onWin, onExit }) {
  const { x0, flash, bins, cloud } = z.config.boss;
  const gap0 = z.config.gap0;
  const truth = iterate(logistic, x0, flash).at(-1);
  const twin = iterate(logistic, x0 + gap0, flash).at(-1);
  let phase = 'ask', guesses = [], mood = 'ask', result = null, won = false;
  let trueBand = null, painter = null, boat = null;

  function launch() {
    z.fleet.recall();
    z.clearGhost();
    boat = z.fleet.drop(x0);
  }

  const offFlash = z.on('flash', () => {
    if (!boat) return;
    const k = boat.xs.length - 1;
    const el = z.panel.querySelector('.oracle-count');
    if (el) el.textContent = k <= flash ? `her boat: flash ${k} of ${flash}` : `her boat: past flash ${flash}`;
    if (k === flash) z.say(`Flash ${flash}: the Oracle’s boat is at <span class="mono">${truth.toFixed(4)}</span>.`);
  });

  function numberLine() {
    const X = (v) => 12 + v * 296;
    const last = guesses.at(-1);
    return `
      <svg viewBox="0 0 320 64" role="img" style="width:100%;height:auto;display:block"
        aria-label="Your answer ${last.toFixed(3)}, the true position ${truth.toFixed(3)}, her twin ${twin.toFixed(3)}">
        <line x1="12" x2="308" y1="30" y2="30" stroke="var(--ink-muted)"/>
        ${[0, 0.5, 1].map((t) => `<text x="${X(t)}" y="60" text-anchor="middle" style="font:9px var(--font-mono);fill:var(--ink-muted)">${t}</text>`).join('')}
        <circle cx="${X(last)}" cy="30" r="6" fill="var(--bg)" stroke="var(--c-highlight)" stroke-width="2.5"/>
        <text x="${X(last)}" y="14" text-anchor="middle" style="font:9px var(--font-mono);fill:var(--c-highlight)">you</text>
        <circle cx="${X(truth)}" cy="30" r="5" fill="var(--c-trajectory)"/>
        <text x="${X(truth)}" y="48" text-anchor="middle" style="font:9px var(--font-mono);fill:var(--c-trajectory)">true</text>
        <rect x="${X(twin) - 4.5}" y="25.5" width="9" height="9" fill="var(--bg)" stroke="var(--c-trajectory)" stroke-width="1.5"/>
        <text x="${X(twin)}" y="14" text-anchor="middle" style="font:9px var(--font-mono);fill:var(--ink-muted)">her twin</text>
      </svg>`;
  }

  function draw() {
    const line = LINES[mood];
    const head = `
      <div class="keeper oracle">
        <p class="keeper-name">${z.config.boss.name}<span class="muted mono oracle-count">her boat: flash ${boat ? Math.min(boat.xs.length - 1, flash) : 0} of ${flash}</span></p>
        <blockquote class="keeper-line">${line}</blockquote>`;
    if (phase === 'ask') {
      render(`${head}
        <p>Her boat left from <span class="mono">${x0.toFixed(7)}</span>.</p>
        <form class="oracle-ask hud-row">
          <label for="oracle-guess">position at flash ${flash}</label>
          <input id="oracle-guess" type="number" min="0" max="1" step="0.001" required style="width:6rem;font-family:var(--font-mono)">
          <button type="submit" class="button primary">Tell her</button>
        </form>
        ${guesses.length ? `${numberLine()}
          <p>You said <span class="mono">${guesses.at(-1).toFixed(3)}</span>. The boat will be at
            <span class="mono">${truth.toFixed(4)}</span>. Her twin, started ${gap0.toExponential(0)} away, will be at
            <span class="mono">${twin.toFixed(4)}</span>.</p>
          <div class="hud-row"><button type="button" class="button primary" data-o="paint">Paint a band instead</button></div>` : ''}
        <div class="hud-row"><button type="button" class="button quiet" data-o="exit">Leave the Oracle</button></div>
      </div>`, wireUp);
      return;
    }
    render(`${head}
      <p>Paint how likely the boat is to be in each part of the lane at flash ${flash}. Only the shape
        matters: taller means more likely.</p>
      <div class="painter-slot"></div>
      ${result ? `<p class="mono muted">distance from the truth: ${result.distance.toFixed(2)} (she accepts ${BAND_PASS} or less)</p>` : ''}
      ${result && !result.pass ? '<p>The dashed outlines are where 20,000 boats, all launched within a ten-millionth of hers, really are at flash 60.</p>' : ''}
      <div class="hud-row">
        ${won ? `<button type="button" class="button primary" data-o="exit">Back to the fleets</button><a class="button" href="./">World chart</a>`
          : `<button type="button" class="button primary" data-o="judge">Show her</button>
             <button type="button" class="button quiet" data-o="clear">Clear</button>
             <button type="button" class="button quiet" data-o="exit">Leave the Oracle</button>`}
      </div>
    </div>`, wireUp);
  }

  function wireUp(panel) {
    panel.querySelector('.oracle-ask')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = +panel.querySelector('#oracle-guess').value;
      if (!(v >= 0 && v <= 1)) { z.say('Somewhere on the lane, from 0 to 1.'); return; }
      guesses.push(v);
      mood = guesses.length > 1 ? 'again' : 'reject';
      draw();
    });
    const slot = panel.querySelector('.painter-slot');
    if (slot) {
      const band = painter?.band;   // the painter is rebuilt on each draw; carry the band over
      painter = createBandPainter(slot, { bins });
      if (band) painter.setBand(band);
      if (result && !result.pass) painter.setTruth(trueShares());
      if (won) painter.setLocked(true);
    }
    const act = { paint: () => { phase = 'paint'; mood = 'paint'; draw(); }, judge, clear: () => { painter.reset(); result = null; mood = 'paint'; draw(); }, exit: stop };
    panel.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => act[b.dataset.o]()));
  }

  function trueShares() {
    trueBand ??= histogram(cloudAt(x0, gap0, cloud, flash), bins).map((c) => c / cloud);
    return trueBand;
  }

  function judge() {
    const band = painter.band;
    if (band.every((v) => v === 0)) { z.say('Paint something first: drag across the band, or use the arrow keys.'); return; }
    result = judgeBand(band);
    if (result.pass) {
      won = true;
      mood = result.edgesHeavy ? 'edges' : 'pass';
      onWin({ edgesHeavy: result.edgesHeavy });
    } else {
      const flat = Math.max(...band) - Math.min(...band) < 0.15 * Math.max(...band);
      mood = flat ? 'flat' : result.distance > 0.35 ? 'far' : 'near';
    }
    draw();
  }

  function stop() {
    offFlash();
    z.fleet.recall();
    onExit();
  }

  launch();
  draw();
  return { stop };
}
