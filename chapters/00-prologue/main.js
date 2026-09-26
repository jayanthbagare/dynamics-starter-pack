// Chapter 0 · State, rule, time
// One store drives the calculator, its tape, and both time-series views; a second, smaller
// part of the same store drives the "other fates" comparison.

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { orbit } from '../../core/integrate.js';
import { findFixedPoints } from '../../core/fixedpoints.js';
import { cos } from '../../systems/cos.js';
import { sqrt } from '../../systems/sqrt.js';
import { square } from '../../systems/square.js';
import { createTimeseries } from '../../views/timeseries.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';

mountLayout({ chapter: 0 });

const systems = { cos, sqrt, square };
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const store = createStore(
  {
    map: 'cos', x0: 2, n: 0,   // the calculator: rule, starting number, presses so far
    ghosts: [],                // earlier starts, drawn faintly
    fmap: 'sqrt', fn: 0,       // the "other fates" comparison: rule and presses shown
  },
  { urlKeys: ['map', 'x0', 'n', 'fmap'] },
);

// Seed ranges for the drag slider, per rule.
const seedRange = { cos: [-3, 3], sqrt: [0, 10], square: [-1.5, 1.5] };
const plotRange = { cos: [-1.2, 3], sqrt: [0, 10], square: [-0.2, 2] };

// Display like a real calculator: 10 significant digits, "Error" for √ of a negative.
function show(v) {
  if (Number.isNaN(v)) return 'Error';
  if (!Number.isFinite(v) || Math.abs(v) >= 1e100) return 'overflow';
  if (Math.abs(v) < 1e-99) return '0'; // underflow, like a real calculator
  return String(Number(v.toPrecision(10)));
}

const run = (s) => orbit(systems[s.map].step, s.x0, s.n);

// --- §0.1 the calculator -------------------------------------------------

const ruleChoice = $('rule-choice');
ruleChoice.innerHTML = Object.entries(systems).map(([k, sys]) => `
  <label><input type="radio" name="rule" value="${k}"><span>${sys.name}</span></label>`).join('');
ruleChoice.addEventListener('change', (e) => store.set({ map: e.target.value, n: 0, ghosts: [] }));

$('press').addEventListener('click', () => store.set({ n: store.get().n + 1 }));
$('press10').addEventListener('click', () => animatePresses(10));
$('clear').addEventListener('click', () => store.set({ n: 0 }));

const seedInput = $('seed-input');
seedInput.addEventListener('change', () => {
  const v = Number(seedInput.value);
  if (seedInput.value.trim() !== '' && Number.isFinite(v)) store.set({ x0: v, n: 0, ghosts: [] });
  else seedInput.value = store.get().x0;
});

async function animatePresses(k, delay = 110) {
  for (let i = 0; i < k; i++) {
    store.set({ n: store.get().n + 1 });
    await sleep(delay);
  }
}

function renderCalculator(s) {
  const xs = run(s);
  $('display').textContent = show(xs[s.n]);
  $('display-meta').textContent = `n = ${s.n} · rule: ${systems[s.map].name}`;
  ruleChoice.querySelector(`input[value="${s.map}"]`).checked = true;
  if (document.activeElement !== seedInput) seedInput.value = s.x0;
  const tape = $('tape');
  tape.innerHTML = xs.map((v, i) => `<li><span class="n">${i}</span><span>${show(v)}</span></li>`).join('');
  tape.scrollTop = tape.scrollHeight;
}
store.subscribe(renderCalculator);
renderCalculator(store.get());

const fixedLinesFor = (map) => findFixedPoints(systems[map].step, seedRange[map]).map((p) => ({ y: p.x, kind: p.kind }));

createTimeseries($('ts-calc'), store, {
  select: (s) => ({
    series: [{ values: run(s), role: 'main' }],
    nMax: Math.max(10, s.n),
    yRange: plotRange[s.map],
    highlight: s.n,
  }),
});

createPredict($('predict-cos'), {
  question: 'You’ll start at 2 and press <strong>cos</strong> 30 times. What happens to the display?',
  options: [
    { value: 'grows', label: 'it keeps growing' },
    { value: 'settles', label: 'it settles on one number' },
    { value: 'bounces', label: 'it jumps around forever' },
    { value: 'zero', label: 'it shrinks to 0' },
  ],
  pressLabel: 'Press cos ×30',
  onPress: async () => {
    store.set({ map: 'cos', x0: 2, n: 0, ghosts: [] });
    $('calculator').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(300);
    await animatePresses(30, 90);
    return 'settles';
  },
  explain: () => `<p>The display settles on <span class="mono">0.7390851…</span>. Scroll the tape: the
    values land above and below it, taking turns, and get closer each time. Press cos on
    0.7390851… and you get 0.7390851… back. The button has nothing left to change.</p>`,
  onReset: () => store.set({ map: 'cos', x0: 2, n: 0 }),
});

// --- §0.2 try another start ----------------------------------------------

const N_SEEDS = 30;
let committedSeed = store.get().x0;
store.subscribe((s, changed) => { if (changed.has('map')) committedSeed = s.x0; });

createSlider($('seed-controls'), store, {
  key: 'x0', label: 'start x₀', step: 0.01,
  min: (s) => seedRange[s.map][0], max: (s) => seedRange[s.map][1],
  format: (v) => v.toFixed(2),
  commit: (v) => {
    const s = store.get();
    const ghosts = [committedSeed, ...s.ghosts].slice(0, 5);
    committedSeed = v;
    return { ghosts, n: 0 };
  },
});
$('seed-controls').prepend($('seed-controls').lastElementChild); // slider first, then buttons

$('random10').addEventListener('click', () => {
  const [a, b] = seedRange[store.get().map];
  store.set({ ghosts: Array.from({ length: 10 }, () => +(a + Math.random() * (b - a)).toFixed(3)) });
});
$('clear-ghosts').addEventListener('click', () => store.set({ ghosts: [] }));

createTimeseries($('ts-seeds'), store, {
  select: (s) => ({
    series: [
      ...s.ghosts.map((g) => ({ values: orbit(systems[s.map].step, g, N_SEEDS), role: 'ghost' })),
      { values: orbit(systems[s.map].step, s.x0, N_SEEDS), role: 'main' },
    ],
    nMax: N_SEEDS,
    yRange: plotRange[s.map],
  }),
});

function renderSeedsCaption(s) {
  const ends = [s.x0, ...s.ghosts].map((g) => orbit(systems[s.map].step, g, N_SEEDS).at(-1));
  $('seeds-caption').innerHTML = `rule ${systems[s.map].name} · ${ends.length} start${ends.length > 1 ? 's' : ''} · after ${N_SEEDS} presses: `
    + [...new Set(ends.map(show))].slice(0, 4).map((v) => `<strong>${v}</strong>`).join(', ');
}
store.subscribe(renderSeedsCaption);
renderSeedsCaption(store.get());

// --- §0.3 names ----------------------------------------------------------

initMathLayers();

// --- §0.4 other buttons, other fates -------------------------------------

const fates = {
  sqrt:   { seeds: [0.05, 9], yRange: [0, 10] },
  square: { seeds: [0.9, 1, 1.1], yRange: [-0.2, 2] },
};
const revealed = new Set();

const fateChoice = $('fate-choice');
fateChoice.innerHTML = ['sqrt', 'square'].map((k) => `
  <label><input type="radio" name="fate" value="${k}"><span>${systems[k].name}</span></label>`).join('');
fateChoice.addEventListener('change', (e) => store.set({ fmap: e.target.value, fn: 0 }));
$('fate-run').addEventListener('click', () => runFates(store.get().fmap));

async function runFates(map) {
  store.set({ fmap: map, fn: 0 });
  for (let i = 1; i <= 12; i++) { await sleep(120); store.set({ fn: i }); }
}

createTimeseries($('ts-fates'), store, {
  select: (s) => ({
    series: fates[s.fmap].seeds.map((x0) => ({ values: orbit(systems[s.fmap].step, x0, s.fn), role: 'main', label: `start ${x0}` })),
    nMax: 12,
    yRange: fates[s.fmap].yRange,
    fixedLines: revealed.has(s.fmap) ? fixedLinesFor(s.fmap) : [],
  }),
});

function renderFates(s) {
  fateChoice.querySelector(`input[value="${s.fmap}"]`).checked = true;
  const { seeds } = fates[s.fmap];
  $('fates-caption').innerHTML = `rule ${systems[s.fmap].name} · after ${s.fn} presses: `
    + seeds.map((x0) => `${x0} → <strong>${show(orbit(systems[s.fmap].step, x0, s.fn).at(-1))}</strong>`).join(' · ');
  $('fates-line').hidden = !revealed.has(s.fmap);
  if (revealed.has(s.fmap)) drawFatesLine(s.fmap);
}
store.subscribe(renderFates);
renderFates(store.get());

// A number line with the fixed points and arrows showing where starts drift under repeated presses.
function drawFatesLine(map) {
  const W = 560, H = 90, lo = -0.25, hi = 2.25;
  const X = (v) => 30 + ((v - lo) / (hi - lo)) * (W - 60);
  const y = 44;
  const arrow = (a, b) => {
    const [x1, x2] = [X(a), X(b)];
    const dir = Math.sign(x2 - x1);
    return `<line class="flow" x1="${x1}" y1="${y}" x2="${x2 - dir * 6}" y2="${y}"/>
      <path class="flow-head" d="M ${x2} ${y} l ${-dir * 9} -5 l 0 10 z"/>`;
  };
  const dot = (v, kind) => `<circle class="fp-${kind}" cx="${X(v)}" cy="${y}" r="7"/>
    <text class="t ${kind}-t" x="${X(v)}" y="${y + 26}" text-anchor="middle">${v} ${kind}</text>`;
  const tick = (v) => `<line class="tick" x1="${X(v)}" y1="${y - 4}" x2="${X(v)}" y2="${y + 4}"/>
    <text class="t" x="${X(v)}" y="${y - 12}" text-anchor="middle">${v}</text>`;

  const body = map === 'sqrt'
    ? arrow(0.1, 0.85) + arrow(2.2, 1.15) + dot(0, 'unstable') + dot(1, 'stable')
    : arrow(0.9, 0.12) + arrow(1.1, 2.2) + dot(0, 'stable') + dot(1, 'unstable');
  $('fates-svg').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${map === 'sqrt'
      ? 'Number line: 0 is unstable, 1 is stable; starts between and above move toward 1'
      : 'Number line: 0 is stable, 1 is unstable; starts below 1 move toward 0, starts above 1 grow without bound'}">
      <line class="axis" x1="${X(lo)}" y1="${y}" x2="${X(hi)}" y2="${y}"/>
      ${[0.5, 1.5, 2].map(tick).join('')}
      ${body}
    </svg>`;
  $('fates-note').textContent = map === 'sqrt'
    ? 'Every positive start drifts to 1 (filled). 0 stays put only if you start exactly there (hollow).'
    : 'Starts below 1 fall to 0 (filled). Starts above 1 run off to infinity. 1 itself is a knife edge (hollow).';
}

const reveal = (map, delayMs = 0) => async () => {
  $('fates').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await sleep(delayMs);
  revealed.add(map);
  await runFates(map);
  return null;
};

createPredict($('predict-sqrt'), {
  question: 'Two starts, 0.05 and 9. Press <strong>√</strong> over and over. Where do they end up?',
  options: [
    { value: 'one', label: 'both settle on 1' },
    { value: 'split', label: '9 stays big, 0.05 stays small' },
    { value: 'zero', label: 'both shrink to 0' },
    { value: 'grow', label: 'both grow without bound' },
  ],
  pressLabel: 'Press √ ×12',
  onPress: async () => { await reveal('sqrt', 300)(); return 'one'; },
  explain: () => `<p>Both end at 1. One climbs up to it and the other falls down to it, from the same
    side each time, with no alternating like cos. √1 = 1, so 1 is a fixed point, and it pulls
    everything in. What about 0? √0 = 0, so 0 is a fixed point as well, but only if you start
    exactly there.</p>`,
});

createPredict($('predict-square'), {
  question: 'Three starts, 0.9, 1, and 1.1. Press <strong>x²</strong> over and over. What happens?',
  options: [
    { value: 'allone', label: 'all three stay near 1' },
    { value: 'allzero', label: 'all three fall to 0' },
    { value: 'three', label: 'three different fates' },
    { value: 'allgrow', label: 'all three blow up' },
  ],
  pressLabel: 'Press x² ×12',
  onPress: async () => { await reveal('square', 300)(); return 'three'; },
  explain: () => `<p>0.9 falls to 0. 1 stays at 1 forever. 1.1 runs off the chart (the triangles
    mean “off the top”); on a real calculator it would overflow. Starts a hair apart get
    completely different futures, because 1 is a fixed point that <em>pushes</em> things away.</p>`,
});

// --- Strogatz lens -------------------------------------------------------

renderLens($('lens'), {
  read: [
    { ref: 'Ch 1', note: 'Overview. Read it all; it’s short. §1.2 and §1.3 set up the “dynamical view” used for the rest of the book.' },
    { ref: '§10.0–10.1', note: 'Where maps like this calculator come back, much later, with cobwebs. That’s our Ch 1.' },
  ],
  notation: [
    ['display value', 'state <span class="tex">x</span>', 'what the system is doing right now'],
    ['the button', 'rule <span class="tex">f</span>', 'turns the current state into the next'],
    ['presses <span class="tex">n</span>', 'time <span class="tex">t</span> (continuous) or <span class="tex">n</span> (maps)', 'Strogatz starts with continuous time; maps return in Ch 10'],
    ['<span class="tex">x_{n+1} = f(x_n)</span>', '<span class="tex">x_{n+1} = f(x_n)</span>', 'a map (one-dimensional, discrete time)'],
    ['0.739…', 'fixed point <span class="tex">x^*</span>', 'a state the rule leaves alone: <span class="tex">f(x^*) = x^*</span>'],
    ['filled / hollow dot', 'stable / unstable', 'nearby starts pulled in / pushed away'],
  ],
  exercises: [
    {
      html: 'Start at 0, then at 3. How many presses of cos does it take until the display reads 0.7391 (to 4 decimals)? Is the far start much slower than the near one? Guess why before you check.',
      sim: '?map=cos&x0=0#calculator',
    },
    {
      html: 'Start √ at exactly 0 and press a few times. Then start at 0.000001. What happens in each case, and why does that make 0 a hollow dot rather than a filled one?',
      sim: '?map=sqrt&x0=0#calculator',
    },
    {
      html: 'Start x² at 1.000001 and keep pressing. How many presses until the display is clearly no longer 1? Now try 0.999999. How does this show that 1 is a knife edge?',
      sim: '?map=square&x0=1.000001#calculator',
    },
  ],
});
