// Chapter 2 · The butterfly effect
// One store drives the twins (§2.1), their gap on a log scale (§2.2), the forecaster game (§2.3),
// and the random-or-rule comparison (§2.4).

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { orbit } from '../../core/integrate.js';
import { findFixedPoints } from '../../core/fixedpoints.js';
import { logistic } from '../../systems/logistic.js';
import { createCobweb } from '../../views/cobweb.js';
import { createTimeseries } from '../../views/timeseries.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';

mountLayout({ chapter: 2 });

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sci = (v) => (v === 0 ? '0' : v < 1e-3 ? v.toExponential(1) : String(+v.toFixed(4)));
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const tenTo = (k) => '10' + String(k).split('').map((c) => SUP[c]).join('');

// A small seeded random-number generator (mulberry32), so a URL reproduces a round exactly.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const store = createStore(
  {
    x0: 0.4, gap: 7, n: 0, r: 4, alt: false,     // §2.1 twins: start, gap 10⁻ᵏ, steps shown, rule
    mult: 1.5,                                   // §2.2 ruler: multiplier per step
    digits: 6, truth: 1, fn: 0, results: [],     // §2.3 forecaster
    swap: -1, rn: 0, overlay: false,             // §2.4 random or rule
  },
  { urlKeys: ['x0', 'gap', 'n', 'r', 'mult', 'digits', 'truth', 'swap'] },
);

// Which mystery sequence is the rule: chosen at random on a first visit, then kept in the URL.
if (store.get().swap === -1) store.set({ swap: Math.random() < 0.5 ? 0 : 1 });

// --- §2.1 twins ------------------------------------------------------------

const N = 60;
const rule = (s) => (x) => logistic.step(x, { r: s.r });
// The same rule written differently: identical on paper, rounded differently by the computer.
const ruleExpanded = (s) => (x) => s.r * x - s.r * x * x;

const twins = (s) => {
  const xs = orbit(rule(s), s.x0, N);
  const ys = s.alt ? orbit(ruleExpanded(s), s.x0, N) : orbit(rule(s), s.x0 + 10 ** -s.gap, N);
  return { xs, ys, gaps: xs.map((v, i) => Math.abs(v - ys[i])) };
};
const partAt = (gaps, tol = 0.1) => gaps.findIndex((g) => g > tol);
const twinLabel = (s) => (s.alt ? 'written 4x − 4x²' : `start + ${tenTo(-s.gap)}`);

createCobweb($('web-twins'), store, {
  select: (s) => {
    const { xs, ys } = twins(s);
    return {
      f: rule(s),
      window: [0, 1],
      path: xs,
      twinPath: ys,
      halfSteps: 2 * s.n,
      fixedPoints: findFixedPoints(rule(s), [0, 1]),
    };
  },
  seedKey: 'x0',
  seedRange: [0.001, 0.999],
});

createTimeseries($('ts-twins'), store, {
  select: (s) => {
    const { xs, ys, gaps } = twins(s);
    const p = partAt(gaps);
    return {
      series: [
        { values: xs.slice(0, s.n + 1), role: 'main', label: `start ${s.x0}` },
        { values: ys.slice(0, s.n + 1), role: 'main', style: 'twin', label: twinLabel(s) },
      ],
      nMax: N,
      yRange: [0, 1],
      markers: p >= 0 && p <= s.n ? [{ n: p, label: `they part · n = ${p}` }] : [],
    };
  },
});

createSlider($('twin-controls'), store, {
  key: 'gap', label: 'gap between the twins', min: 1, max: 15, step: 1,
  ticks: [1, 5, 10, 15], format: (k) => tenTo(-k),
});

const rChoice = $('r-choice');
rChoice.addEventListener('change', (e) => store.set({ r: Number(e.target.value) }));

function renderTwins(s) {
  const rInput = rChoice.querySelector(`input[value="${s.r}"]`);
  if (rInput) rInput.checked = true;
  const { xs, ys, gaps } = twins(s);
  const p = partAt(gaps);
  const now = `n = ${s.n} · x = ${sci(xs[s.n])} · twin = ${sci(ys[s.n])} · gap = <strong>${sci(gaps[s.n])}</strong>`;
  const fate = s.r !== 4
    ? 'Both slide into the same filled dot. The gap shrinks instead of growing.'
    : p < 0 ? 'They never part within 60 steps.'
    : s.n >= p ? `They parted at n = ${p}.` : 'Keep stepping…';
  $('twins-cap').innerHTML = `${now}<br>${fate}`;
}
store.subscribe(renderTwins);
renderTwins(store.get());

let playing = false;
async function playTo(target, delay) {
  playing = true;
  $('play').textContent = 'Pause';
  while (playing && store.get().n < target) {
    store.set({ n: store.get().n + 1 });
    await sleep(delay);
  }
  playing = false;
  $('play').textContent = 'Play';
}
$('step').addEventListener('click', () => store.set({ n: Math.min(N, store.get().n + 1) }));
$('reset').addEventListener('click', () => { playing = false; store.set({ n: 0 }); });
$('play').addEventListener('click', () => {
  if (playing) { playing = false; return; }
  if (store.get().n >= N) store.set({ n: 0 });
  playTo(N, 150);
});

createPredict($('predict-twins'), {
  question: 'Two starts, <strong>0.4</strong> and <strong>0.4000001</strong>, same rule. After 50 steps they will be…',
  options: [
    { value: 'same', label: 'still identical, to the eye' },
    { value: 'slight', label: 'slightly apart' },
    { value: 'unrelated', label: 'completely unrelated' },
    { value: 'blowup', label: 'one of them blows up' },
  ],
  pressLabel: 'Run 50 steps',
  onPress: async () => {
    store.set({ x0: 0.4, gap: 7, r: 4, alt: false, n: 0 });
    $('twins').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(400);
    await playTo(50, 70);
    return 'unrelated';
  },
  explain: () => {
    const p = partAt(twins(store.get()).gaps);
    return `<p>For about twenty steps the two lines overlap exactly. Then, around n = ${p}, they split
      and never agree again. Neither run blows up: both stay on the hump between 0 and 1. They just
      stop having anything to do with each other.</p>`;
  },
  onReset: () => store.set({ n: 0 }),
});

// --- §2.2 the gap on a log scale --------------------------------------------

// Fit the rising (or falling) part of the gap: points between 10⁻¹⁵ and 10⁻², until it first saturates.
function measuredMultiplier(gaps) {
  const pts = [];
  for (let n = 0; n < gaps.length; n++) {
    if (gaps[n] >= 1e-2) break;
    if (gaps[n] > 1e-15) pts.push([n, Math.log10(gaps[n])]);
  }
  if (pts.length < 4) return null;
  const m = pts.length;
  const sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] ** 2, 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  return 10 ** ((m * sxy - sx * sy) / (m * sxx - sx * sx));
}

createTimeseries($('ts-gap'), store, {
  yScale: 'log',
  yLabel: '|xₙ − yₙ|',
  select: (s) => {
    const { gaps } = twins(s);
    const d0 = Math.max(gaps[0], 1e-16);
    return {
      series: [{ values: gaps.slice(0, s.n + 1), role: 'main' }],
      nMax: N,
      yRange: [1e-16, 3],
      refLine: { from: [0, d0], to: [N, d0 * s.mult ** N] },
    };
  },
});

createSlider($('ruler-controls'), store, {
  key: 'mult', label: 'ruler: multiplier per step', min: 0.5, max: 3, step: 0.01,
  ticks: [0.5, 1, 2, 3], format: (v) => `×${v.toFixed(2)}`,
});

function renderRuler(s) {
  const measured = measuredMultiplier(twins(s).gaps.slice(0, s.n + 1));
  const lam = Math.log(s.mult);
  let verdict;
  if (measured == null) verdict = 'Step the twins further to give the ruler something to match.';
  else if (Math.abs(s.mult - measured) / measured < 0.05) {
    verdict = `✓ The ruler matches the gap’s ${measured > 1 ? 'rise' : 'fall'}: measured ×${measured.toFixed(2)} per step, `
      + `λ ≈ ${Math.log(measured).toFixed(2)}.`;
  } else verdict = `Tilt the ruler until it lies along the ${measured > 1 ? 'rising' : 'falling'} part of the gap.`;
  $('ruler-read').innerHTML = `ruler: ×${s.mult.toFixed(2)} per step → λ = ln ${s.mult.toFixed(2)} = <strong>${lam.toFixed(2)}</strong><br>${verdict}`;
}
store.subscribe(renderRuler);
renderRuler(store.get());

createPredict($('predict-gap'), {
  question: 'On a log scale, what shape will the gap between the twins trace?',
  options: [
    { value: 'line', label: 'a straight line going up' },
    { value: 'bend', label: 'a curve bending up ever faster' },
    { value: 'zigzag', label: 'a zigzag with no trend' },
    { value: 'flat', label: 'flat' },
  ],
  pressLabel: 'Show the gap',
  onPress: async () => {
    delete $('gap-sim').dataset.veiled;
    store.set({ n: 0, alt: false });
    $('gap-sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(400);
    await playTo(N, 40);
    return 'line';
  },
  explain: () => `<p>A straight line, wobbling a little, then a flat ceiling once the gap is as big as the hump.
    A straight line on a log scale means the gap is <em>multiplied</em> by the same factor every step.
    Use the ruler to find that factor.</p>`,
});

// Your computer is a butterfly too
function renderAlt(s) {
  const btn = $('alt-toggle');
  btn.setAttribute('aria-pressed', s.alt);
  btn.textContent = s.alt ? 'Back to the twins' : 'Compare the two ways of writing it';
  if (!s.alt) { $('alt-cap').textContent = ''; return; }
  const a = orbit(rule(s), s.x0, 120), b = orbit(ruleExpanded(s), s.x0, 120);
  const first = a.findIndex((v, i) => v !== b[i]);
  const part = a.findIndex((v, i) => Math.abs(v - b[i]) > 0.1);
  $('alt-cap').innerHTML = `Same start, same rule on paper. The computer rounds the two formulas differently in the
    last digit, so they first differ at n = ${first} (by about ${sci(Math.abs(a[first] - b[first]))}) and
    part ways at <strong>n = ${part}</strong>. The plots above now show the two versions.`;
}
$('alt-toggle').addEventListener('click', () => {
  const alt = !store.get().alt;
  store.set({ alt, n: alt ? N : store.get().n });
});
store.subscribe(renderAlt);
renderAlt(store.get());

// --- §2.3 the forecaster ---------------------------------------------------

const F = 80, TOL = 0.1;
const f4 = (x) => logistic.step(x, { r: 4 });
const truthOf = (seed) => 0.05 + 0.9 * seeded(seed)();
const forecast = (s) => {
  const truth = truthOf(s.truth);
  const measured = +truth.toFixed(s.digits);
  const T = orbit(f4, truth, F), P = orbit(f4, measured, F);
  const h = P.findIndex((v, i) => Math.abs(v - T[i]) > TOL);
  return { truth, measured, T, P, horizon: h < 0 ? F : h };
};

createTimeseries($('ts-forecast'), store, {
  select: (s) => {
    const { T, P, horizon } = forecast(s);
    return {
      series: [
        { values: T.slice(0, s.fn + 1), role: 'main', label: 'truth' },
        { values: P.slice(0, s.fn + 1), role: 'main', style: 'twin', label: 'forecast' },
      ],
      nMax: F,
      yRange: [0, 1],
      markers: horizon <= s.fn ? [{ n: horizon, label: `forecast fails · n = ${horizon}` }] : [],
    };
  },
});

createSlider($('forecast-controls'), store, {
  key: 'digits', label: 'digits you measure', min: 1, max: 15, step: 1,
  ticks: [1, 5, 10, 15], format: (v) => `${v}`,
});
$('forecast-controls').prepend($('forecast-controls').lastElementChild);

async function runForecast() {
  const s0 = store.get();
  const { horizon } = forecast(s0);
  store.set({ fn: 0 });
  const end = Math.min(F, horizon + 8);
  for (let i = 1; i <= end; i++) { store.set({ fn: i }); await sleep(35); }
  const s = store.get();
  store.set({ results: [...s.results.filter(([d]) => d !== s.digits), [s.digits, horizon]] });
  return horizon;
}
$('run-forecast').addEventListener('click', runForecast);
$('new-round').addEventListener('click', () => store.set({ truth: 1 + Math.floor(Math.random() * 1e6), fn: 0 }));
$('clear-results').addEventListener('click', () => store.set({ results: [] }));
store.subscribe((s, changed) => { if (changed.has('digits')) store.set({ fn: 0 }); });

function renderForecast(s) {
  const { truth, measured, horizon } = forecast(s);
  $('forecast-cap').innerHTML = `truth x₀ = ${truth.toPrecision(16)} · you measured <strong>${measured.toFixed(s.digits)}</strong> (${s.digits} digit${s.digits > 1 ? 's' : ''})<br>`
    + (s.fn >= horizon ? `Your forecast held for <strong>${horizon} steps</strong>.` : 'Press Forecast.');
}
store.subscribe(renderForecast);
renderForecast(store.get());

function fitLine(results) {
  if (new Set(results.map(([d]) => d)).size < 3) return null;
  const m = results.length;
  const sx = results.reduce((a, [d]) => a + d, 0), sy = results.reduce((a, [, h]) => a + h, 0);
  const sxx = results.reduce((a, [d]) => a + d * d, 0), sxy = results.reduce((a, [d, h]) => a + d * h, 0);
  const a = (m * sxy - sx * sy) / (m * sxx - sx * sx);
  return { a, b: (sy - a * sx) / m };
}

createTimeseries($('ts-horizons'), store, {
  xLabel: 'digits',
  yLabel: 'horizon (steps)',
  select: (s) => {
    const values = Array.from({ length: 16 }, () => NaN);
    for (const [d, h] of s.results) values[d] = h;
    const fit = fitLine(s.results);
    return {
      series: [{ values, role: 'main' }],
      nMax: 16,
      yRange: [0, 70],
      refLine: fit && { from: [0, fit.b], to: [16, fit.b + 16 * fit.a] },
    };
  },
});

function renderHorizons(s) {
  const fit = fitLine(s.results);
  $('horizon-read').innerHTML = !fit
    ? `${s.results.length} point${s.results.length === 1 ? '' : 's'} so far. Forecast with at least three different digit counts to see the pattern.`
    : `Each extra digit buys about <strong>${fit.a.toFixed(1)} steps</strong> (theory: log₂ 10 ≈ 3.3).<br>`
      + `A 100-step forecast would need about ${Math.round((100 - fit.b) / fit.a)} digits. Your computer carries about 16.`;
}
store.subscribe(renderHorizons);
renderHorizons(store.get());

createPredict($('predict-forecast'), {
  question: 'You measured the start to <strong>6 decimal places</strong>. How many steps ahead will your forecast hold?',
  options: [
    { value: 'five', label: 'about 5' },
    { value: 'twenty', label: 'about 20' },
    { value: 'hundred', label: 'about 100' },
    { value: 'forever', label: 'forever: the rule is exact' },
  ],
  pressLabel: 'Forecast',
  onPress: async () => {
    store.set({ digits: 6 });
    $('forecast').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(400);
    const h = await runForecast();
    return h < 12 ? 'five' : h < 50 ? 'twenty' : h < 500 ? 'hundred' : 'forever';
  },
  explain: () => `<p>The rule is exact, but your start isn’t. The error in the seventh digit doubles every step,
    and after about 20 doublings it’s as big as the hump. Now change the digits and forecast again. Each run adds
    a point to the plot below.</p>`,
});

// --- §2.4 random or rule? --------------------------------------------------

const M = 300;
const ruleSeq = orbit(f4, 0.2718281828, M);
const randSeq = (() => { const g = seeded(20260926); return Array.from({ length: M + 1 }, g); })();
const seqs = (s) => (s.swap === 1 ? { A: randSeq, B: ruleSeq } : { A: ruleSeq, B: randSeq });
const ruleName = (s) => (s.swap === 1 ? 'B' : 'A');

for (const k of ['A', 'B']) {
  createTimeseries($(`ts-${k}`), store, {
    select: (s) => ({ series: [{ values: seqs(s)[k].slice(0, 101), role: 'main' }], nMax: 100, yRange: [0, 1] }),
  });
  createCobweb($(`rm-${k}`), store, {
    select: (s) => {
      const v = seqs(s)[k];
      const pts = [];
      for (let i = 0; i < Math.min(s.rn, M); i++) pts.push([v[i], v[i + 1]]);
      return { f: s.overlay ? f4 : null, window: [0, 1], path: [], points: pts };
    },
  });
}

let guess = null;
document.querySelectorAll('[data-guess]').forEach((b) => b.addEventListener('click', () => {
  guess = b.dataset.guess;
  $('guess-cap').textContent = `You picked ${guess}. Hold that thought.`;
}));

$('overlay').addEventListener('change', (e) => store.set({ overlay: e.target.checked }));

async function plotPairs() {
  store.set({ rn: 0 });
  for (let i = 1; i <= M; i += 5) { store.set({ rn: i }); await sleep(16); }
  store.set({ rn: M });
}
$('plot-pairs').addEventListener('click', plotPairs);

function renderReturn(s) {
  if (s.rn < M) { $('return-cap').textContent = ''; return; }
  const r = ruleName(s), other = r === 'A' ? 'B' : 'A';
  $('return-cap').innerHTML = `<strong>${r}</strong> is the rule: every pair lies on one curve. `
    + `<strong>${other}</strong> is random: its pairs fill the square, because no rule links one value to the next.`
    + (guess ? ` Your gut said ${guess}, which was ${guess === r ? 'right' : 'wrong'}. By eye it’s close to a coin toss; with pairs it’s certain.` : '');
}
store.subscribe(renderReturn);
renderReturn(store.get());

createPredict($('predict-return'), {
  question: 'Plot each sequence as pairs <span class="tex">(x_n, x_{n+1})</span>. What will the <em>rule’s</em> pairs look like?',
  options: [
    { value: 'cloud', label: 'a cloud, like the random one' },
    { value: 'curve', label: 'a curve' },
    { value: 'clusters', label: 'a few tight clusters' },
    { value: 'line', label: 'a straight line' },
  ],
  pressLabel: 'Plot as pairs',
  onPress: async () => {
    $('plot-pairs').closest('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(400);
    await plotPairs();
    return 'curve';
  },
  explain: () => `<p>A curve, and it’s the hump itself: <span class="tex">x_{n+1} = 4x_n(1 - x_n)</span> is
    exactly the rule, and every pair has to satisfy it. That’s the cobweb’s graph from Chapter 1, traced out
    by the data. Tick “overlay the hump” to check.</p>`,
});

initMathLayers();

// --- Strogatz lens -----------------------------------------------------------

renderLens($('lens'), {
  read: [
    { ref: '§10.5', note: 'The Liapunov exponent for maps: the number your ruler measured.' },
    { ref: '§9.3', note: 'Chaos in the Lorenz system: exponential divergence and the time horizon for prediction. We’ll meet Lorenz in Ch 8; the argument is the one you just made.' },
    { ref: '§10.2', note: 'The logistic map with r as a dial. That’s Chapter 3.' },
  ],
  notation: [
    ['<span class="tex">x_{n+1} = 4x_n(1 - x_n)</span>', 'logistic map, <span class="tex">x_{n+1} = r x_n (1 - x_n)</span>', 'this chapter mostly uses <span class="tex">r = 4</span>'],
    ['gap between the twins', '<span class="tex">\\delta_n</span> (start: <span class="tex">\\delta_0</span>)', 'separation of nearby orbits'],
    ['ruler multiplier', '<span class="tex">e^{\\lambda}</span>', 'factor the gap grows by per step'],
    ['<span class="tex">\\lambda</span>', 'Liapunov exponent <span class="tex">\\lambda</span>', 'average log-stretching rate; <span class="tex">\\lambda &gt; 0</span> means chaos'],
    ['forecast horizon', '<span class="tex">t_{\\text{horizon}}</span>', 'how long a prediction stays within tolerance <span class="tex">a</span>'],
    ['twins part', 'sensitive dependence on initial conditions', 'the butterfly effect'],
  ],
  exercises: [
    {
      html: 'Set the gap to <span class="tex">10^{-3}</span>, then <span class="tex">10^{-7}</span>, then <span class="tex">10^{-11}</span>, and record the step where the twins part each time. How many extra steps does each factor of 1000 buy? Compare with <span class="tex">2^{10} \\approx 1000</span>.',
      sim: '?gap=3#twins',
    },
    {
      html: 'In the forecaster, use your steps-per-digit rule to predict the fewest digits that give a 30-step forecast. Then test it, and try two or three new rounds. Does the answer depend on the round?',
      sim: '?digits=9#forecast',
    },
    {
      html: 'The pairs gave the rule away. Find a second clue using only the time series: where does the rule’s sequence spend most of its time, compared with the random one? (Hint: look near 0 and 1.)',
      sim: '#random',
    },
  ],
});
