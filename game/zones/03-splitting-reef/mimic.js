// The Mimic. The player shapes a one-hump reef; the Mimic swaps it in for the lane's rule
// (x → m·h(x), the tide turns m), finds its first three splits and marks them on the wheel. The
// player predicts the 4th from their own ratio of gaps. A prediction within 2% of the numerically
// detected 4th split wins; a miss shows the true 4th split on the wheel beside the guess.

import { createHump, PRESETS } from './hump.js';
import { findSplits, attractor, periodOf, cyclePoints, mimicTolerance, DELTA, MIMIC_TOL } from './cascade.js';
import { createReefEditor } from './reef-editor.js';
import { scoreValue } from '../../pedagogy/predict-score.js';

const f4 = (v) => (Number.isFinite(v) ? v.toFixed(4) : '—');

const LINES = {
  shape: 'Draw me a reef. Any reef with one smooth top. I will copy it, split for split.',
  set: 'Here are your first three splits. I know the fourth. Do you?',
  miss: (d) => `No. The fourth split is ${d === 'high' ? 'earlier' : 'later'} than that. Your own ratio knows where.`,
  win: 'You found it with a number you measured on someone else’s reef. How did my copying fail?',
  odd: 'That reef will not split cleanly for me. Give it a rounder top.',
};

export function startMimic(z, { reef: diagram, ownRatio, render, onWin, onExit }) {
  let spec = PRESETS.lopsided, hump = createHump(spec), splits = null;
  let phase = 'shape', mood = 'shape', ratio = ownRatio ? ownRatio.toFixed(2) : '', prediction = '', guesses = [], won = false;
  let editor = null;

  const stepM = (x, m) => m * hump.h(x);

  const offTide = z.on('tide', (m) => {
    if (phase !== 'predict') return;
    const vals = attractor(stepM, m);
    const p = periodOf(vals);
    diagram.sweepTo(m);
    diagram.setCurrent(m);
    diagram.setHarbours(typeof p === 'number' && p <= 16 ? cyclePoints(vals, p) : []);
    const out = z.tideWheel?.el.querySelector('output');
    if (out) out.textContent = f4(m);
  });
  const offKey = z.on('key', (k) => { if (k === 'm' && phase === 'predict') lock(); });

  function setReef() {
    hump = createHump(editor.spec);
    splits = findSplits(stepM, hump.c, 4, [0.05, 1]);
    if (splits.length < 4 || splits[3] >= 1) { mood = 'odd'; draw(); return; }
    phase = 'predict'; mood = 'set';
    const from = Math.max(0.3, Math.floor((splits[0] - 0.08) * 20) / 20);
    z.fleet.recall();
    diagram.reset({ from, to: 1, stepR: stepM, labels: [] });
    const wheel = z.enableTide({
      key: 'm', label: 'tide · m', from, to: 1, step: 0.001, value: from,
      rule: (m) => ({ name: 'your reef', step: (x, p) => p.m * hump.h(x), params: { m } }),
    });
    wheel.setMarks(splits.slice(0, 3).map((value) => ({ value, kind: 'truth' })));
    diagram.setTruth(splits.slice(0, 3));
    diagram.sweepTo(from);
    diagram.setCurrent(from);
    draw();
  }

  function lock() {
    const v = +prediction;
    if (!(v > 0 && v < 1)) { z.say('Type your prediction for the 4th split (a tide between the third split and 1).'); return; }
    guesses.push(v);
    const r = scoreValue(v, splits[3], mimicTolerance(splits[3]));
    const marks = splits.slice(0, 3).map((value) => ({ value, kind: 'truth' }));
    marks.push({ value: v, kind: 'guess' });
    if (r.hit || guesses.length >= 2) marks.push({ value: splits[3], kind: 'truth' });
    z.tideWheel.setMarks(marks);
    if (r.hit) { won = true; mood = 'win'; onWin(); } else mood = 'miss';
    lastDirection = r.direction;
    draw();
  }
  let lastDirection = null;

  function draw() {
    const line = mood === 'miss' ? LINES.miss(lastDirection) : LINES[mood];
    const head = `
      <div class="keeper mimic">
        <p class="keeper-name">The Mimic <span class="muted mono">${phase === 'shape' ? 'shape a reef' : 'predict the 4th split'}</span></p>
        <blockquote class="keeper-line">${line}</blockquote>`;
    if (phase === 'shape') {
      render(`${head}
        <p>Drag the handles (or focus the editor and use the arrow keys). The top always stays a single smooth hump.</p>
        <div class="editor-slot"></div>
        <div class="hud-row">
          ${Object.keys(PRESETS).map((k) => `<button type="button" class="button quiet" data-preset="${k}">${k}</button>`).join('')}
        </div>
        <div class="hud-row">
          <button type="button" class="button primary" data-m="set">Give her this reef</button>
          <button type="button" class="button quiet" data-m="exit">Leave the Mimic</button>
        </div>
      </div>`, wire);
      return;
    }
    const [r1, r2, r3, r4] = splits;
    const suggestion = Number(ratio) > 0 ? r3 + (r3 - r2) / Number(ratio) : null;
    render(`${head}
      <table class="ghost-table"><tbody>
        <tr><td>1st split</td><td class="mono">m = ${f4(r1)}</td></tr>
        <tr><td>2nd split</td><td class="mono">m = ${f4(r2)}</td><td class="mono muted">gap ${f4(r2 - r1)}</td></tr>
        <tr><td>3rd split</td><td class="mono">m = ${f4(r3)}</td><td class="mono muted">gap ${f4(r3 - r2)}</td></tr>
        <tr><td>4th split</td><td class="mono">${won || guesses.length >= 2 ? `m = ${f4(r4)}` : '?'}</td></tr>
      </tbody></table>
      <p>If each gap is <em>ratio</em> times the next, the 4th split is at 3rd + (3rd − 2nd) ÷ ratio.
        ${ownRatio ? `Your ratio from the logistic reef was <span class="mono">${ownRatio.toFixed(2)}</span>.` : 'Use the ratio you measured on the logistic reef.'}</p>
      <form class="hud-row mimic-form">
        <label for="mimic-ratio">ratio</label>
        <input id="mimic-ratio" type="number" step="0.01" value="${ratio}" style="width:5rem;font-family:var(--font-mono)">
        <button type="button" class="button quiet" data-m="use" ${suggestion ? '' : 'disabled'}>Use it</button>
      </form>
      <form class="hud-row mimic-lock">
        <label for="mimic-pred">4th split at m =</label>
        <input id="mimic-pred" type="number" step="0.0001" value="${prediction}" style="width:6.5rem;font-family:var(--font-mono)" ${won ? 'disabled' : ''}>
        <button type="submit" class="button primary" ${won ? 'disabled' : ''}>Lock it in <kbd>M</kbd></button>
      </form>
      ${guesses.length ? `<p class="mono">your guess ${f4(guesses.at(-1))}${won || guesses.length >= 2 ? ` · true ${f4(r4)} · off by ${f4(Math.abs(guesses.at(-1) - r4))} (she allows ${(MIMIC_TOL * 100).toFixed(0)}%, ${f4(mimicTolerance(r4))})` : ''}</p>` : ''}
      ${won ? `<p><strong>You beat the Mimic.</strong> A reef you drew splits with the same shrinking gaps as the logistic reef.
        The ratio you needed is the one number every smooth-topped reef shares, δ ≈ ${DELTA.toFixed(3)}. The logbook explains why.</p>` : ''}
      <p class="muted">Turn the tide to watch your reef’s own cascade grow on the water.</p>
      <div class="hud-row">
        ${won ? '<button type="button" class="button primary" data-m="again">Draw another reef</button>' : ''}
        <button type="button" class="button quiet" data-m="exit">Leave the Mimic</button>
      </div>
    </div>`, wire);
  }

  function wire(panel) {
    const slot = panel.querySelector('.editor-slot');
    if (slot) editor = createReefEditor(slot, { spec, onChange: (s) => { spec = s; } });
    panel.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { spec = PRESETS[b.dataset.preset]; editor.setSpec(spec); }));
    panel.querySelector('#mimic-ratio')?.addEventListener('input', (e) => {
      ratio = e.target.value;
      panel.querySelector('[data-m="use"]').disabled = !(Number(ratio) > 0);
    });
    panel.querySelector('#mimic-pred')?.addEventListener('input', (e) => { prediction = e.target.value; });
    panel.querySelector('.mimic-form')?.addEventListener('submit', (e) => e.preventDefault());
    panel.querySelector('.mimic-lock')?.addEventListener('submit', (e) => { e.preventDefault(); lock(); });
    const act = {
      set: setReef,
      use: () => { const [, r2, r3] = splits; prediction = (r3 + (r3 - r2) / Number(ratio)).toFixed(4); draw(); },
      again: () => { phase = 'shape'; mood = 'shape'; won = false; guesses = []; prediction = ''; z.disableTide(); draw(); },
      exit: stop,
    };
    panel.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => act[b.dataset.m]()));
  }

  function stop() {
    offTide(); offKey();
    z.disableTide();
    z.setRule(z.config.rule);
    onExit();
  }

  z.disableTide();
  z.fleet.recall();
  draw();
  return { stop };
}
