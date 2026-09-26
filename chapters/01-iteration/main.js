// Chapter 1 · Iteration & fixed points
// One store drives all four sims: the step-by-step cobweb (§1.1), the fixed-point explorer
// (§1.2, same map and seed), the slope dial (§1.3), and the zoom (§1.4).

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { orbit } from '../../core/integrate.js';
import { findFixedPoints, slopeAt, classify } from '../../core/fixedpoints.js';
import { cos } from '../../systems/cos.js';
import { sqrt } from '../../systems/sqrt.js';
import { square } from '../../systems/square.js';
import { linear } from '../../systems/linear.js';
import { createCobweb } from '../../views/cobweb.js';
import { createTimeseries } from '../../views/timeseries.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';

mountLayout({ chapter: 1 });

const maps = { cos, sqrt, square };
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (v, d = 4) => (Number.isFinite(v) ? String(+v.toFixed(d)) : '—');
const defaultSeed = { cos: 2, sqrt: 2, square: 0.9 };

const store = createStore(
  {
    map: 'cos', x0: 2, h: 0, hoverN: null,   // §1.1–1.2: rule, seed, half-steps drawn, hovered step
    m: 0.5, s0: 0.2, sh: 60,                 // §1.3: slope, seed, half-steps drawn
    zcase: 'cos', zoom: 0,                   // §1.4: which fixed point, zoom level (×2 each)
  },
  { urlKeys: ['map', 'x0', 'm', 's0', 'zcase', 'zoom'] },
);

// Names shared by the slope dial and the zoom, so the two sections speak the same language.
function regime(m) {
  const eps = 1e-9;
  if (Math.abs(m) < eps) return ['superstable', 'lands on x* in one step'];
  if (Math.abs(m - 1) < eps) return ['marginal', 'every point is fixed; nothing moves'];
  if (Math.abs(m + 1) < eps) return ['marginal', 'bounces between two values forever'];
  if (m > 0 && m < 1) return ['staircase in', 'converges, staying on one side'];
  if (m < 0 && m > -1) return ['spiral in', 'converges, alternating sides'];
  if (m > 1) return ['staircase out', 'escapes, staying on one side'];
  return ['spiral out', 'escapes, alternating sides'];
}

// Tiny sparkline icons for the prediction choices: distance to x* over a few steps.
function icon(m, amp) {
  const pts = Array.from({ length: 7 }, (_, k) => `${3 + k * 6.3},${11 - Math.max(-10, Math.min(10, amp * m ** k * 9))}`);
  return `<svg viewBox="0 0 44 22"><line x1="0" y1="11" x2="44" y2="11" stroke="currentColor" stroke-opacity="0.3"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
}

// --- §1.1 from presses to a picture --------------------------------------

const MAX_STEPS = 20;
const path1 = (s) => orbit(maps[s.map].step, s.x0, MAX_STEPS);

createCobweb($('web1'), store, {
  select: (s) => ({
    f: maps[s.map].step,
    window: maps[s.map].domain,
    path: path1(s),
    halfSteps: s.h,
    highlight: s.hoverN,
  }),
  seedKey: 'x0',
  seedRange: (s) => maps[s.map].domain,
});

createTimeseries($('ts1'), store, {
  select: (s) => {
    const k = Math.ceil(s.h / 2);
    return {
      series: [{ values: path1(s).slice(0, k + 1), role: 'main' }],
      nMax: Math.max(10, k),
      yRange: maps[s.map].domain,
      highlight: s.hoverN ?? k,
    };
  },
  hoverKey: 'hoverN',
});

function caption1(s) {
  const xs = path1(s);
  const k = Math.ceil(s.h / 2);
  const f = maps[s.map].name;
  if (s.hoverN != null && s.hoverN <= k) return `x<sub>${s.hoverN}</sub> = <strong>${fmt(xs[s.hoverN], 6)}</strong>`;
  if (s.h === 0) return `Start: x<sub>0</sub> = <strong>${fmt(s.x0)}</strong>. Press Step.`;
  if (s.h % 2 === 1) return `Up to the curve: ${f}(${fmt(xs[k - 1])}) = <strong>${fmt(xs[k])}</strong>. That’s x<sub>${k}</sub>.`;
  return `Across to the diagonal: x<sub>${k}</sub> = <strong>${fmt(xs[k])}</strong> becomes the next input.`;
}
store.subscribe((s) => { $('cap1').innerHTML = caption1(s); });
$('cap1').innerHTML = caption1(store.get());

let playing = false;
$('step').addEventListener('click', () => store.set({ h: Math.min(2 * MAX_STEPS, store.get().h + 1) }));
$('reset').addEventListener('click', () => { playing = false; store.set({ h: 0 }); });
$('play').addEventListener('click', async () => {
  if (playing) { playing = false; return; }
  playing = true;
  $('play').textContent = 'Pause';
  if (store.get().h >= 2 * MAX_STEPS) store.set({ h: 0 });
  while (playing && store.get().h < 2 * MAX_STEPS) {
    store.set({ h: store.get().h + 1 });
    await sleep(220);
  }
  playing = false;
  $('play').textContent = 'Play';
});

// --- §1.2 fixed points live on the diagonal ------------------------------

const fixedPointsOf = (map) => findFixedPoints(maps[map].step, maps[map].domain);

const mapChoice = $('map-choice');
mapChoice.innerHTML = Object.entries(maps).map(([k, sys]) => `
  <label><input type="radio" name="map" value="${k}"><span>${sys.name}</span></label>`).join('');
mapChoice.addEventListener('change', (e) => {
  const map = e.target.value;
  store.set({ map, x0: defaultSeed[map], h: 2 * MAX_STEPS });
});

createCobweb($('web2'), store, {
  select: (s) => ({
    f: maps[s.map].step,
    window: maps[s.map].domain,
    path: path1(s),
    fixedPoints: fixedPointsOf(s.map).map((p) => ({ ...p, label: `x* = ${fmt(p.x, 3)}` })),
  }),
  seedKey: 'x0',
  seedRange: (s) => maps[s.map].domain,
});

function render2(s) {
  mapChoice.querySelector(`input[value="${s.map}"]`).checked = true;
  const fps = fixedPointsOf(s.map);
  $('cap2').innerHTML = `${maps[s.map].name} has ${fps.length} fixed point${fps.length === 1 ? '' : 's'}:<br>`
    + fps.map((p) => `x* = ${fmt(p.x, 6)} · ${p.kind === 'stable' ? '● stable' : '○ unstable'}`).join('<br>');
  const end = path1(s).at(-1);
  $('cap2b').innerHTML = `Starting at x<sub>0</sub> = ${fmt(s.x0)}, after ${MAX_STEPS} steps: `
    + (Number.isFinite(end) && Math.abs(end) < 1e6 ? `<strong>${fmt(end, 6)}</strong>` : '<strong>gone</strong> (off to infinity)');
}
store.subscribe(render2);
render2(store.get());

// --- §1.3 the slope dial -------------------------------------------------

const XS = linear.params.xs;
const path3 = (s) => orbit(linear.step, s.s0, 30, { m: s.m, xs: XS });

createCobweb($('web3'), store, {
  select: (s) => ({
    f: (x) => linear.step(x, { m: s.m, xs: XS }),
    window: linear.domain,
    path: path3(s),
    halfSteps: s.sh,
    fixedPoints: Math.abs(s.m - 1) < 1e-9 ? [] : [{ x: XS, kind: classify(s.m) }],
    lineColour: 'parameter',
  }),
  seedKey: 's0',
  seedRange: linear.domain,
  slope: { key: 'm', pivot: [XS, XS], min: -2, max: 2, snap: [-1, 0, 1] },
  label: 'Start',
});

createTimeseries($('ts3'), store, {
  select: (s) => ({
    series: [{ values: path3(s).slice(0, Math.ceil(s.sh / 2) + 1), role: 'main' }],
    nMax: 30,
    yRange: linear.domain,
    fixedLines: [{ y: XS, kind: Math.abs(s.m - 1) < 1e-9 ? 'half' : classify(s.m) }],
  }),
});

createSlider($('m-controls'), store, {
  key: 'm', label: 'slope m', min: -2, max: 2, step: 0.01, ticks: [-2, -1, 0, 1, 2],
  format: (v) => v.toFixed(2),
});

function render3(s) {
  const [name, detail] = regime(s.m);
  const dot = Math.abs(Math.abs(s.m) - 1) < 1e-9 ? '◐ marginal' : Math.abs(s.m) < 1 ? '● stable' : '○ unstable';
  $('regime').innerHTML = `m = ${s.m.toFixed(2)} → <strong>${name}</strong>: ${detail}<br>|m| ${Math.abs(s.m) < 1 ? '&lt;' : Math.abs(s.m) > 1 ? '&gt;' : '='} 1 · ${dot}`;
}
store.subscribe(render3);
render3(store.get());

async function animateSlope(patch, upTo) {
  store.set({ ...patch, sh: 0 });
  $('slope-dial').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await sleep(400);
  for (let i = 1; i <= upTo; i++) { store.set({ sh: i }); await sleep(90); }
  store.set({ sh: 60 });
}

const regimeOptions = [
  { value: 'staircase in', label: 'staircase in', icon: icon(0.6, 0.9) },
  { value: 'spiral in', label: 'spiral in', icon: icon(-0.6, 0.9) },
  { value: 'staircase out', label: 'staircase out', icon: icon(1.35, 0.25) },
  { value: 'spiral out', label: 'spiral out', icon: icon(-1.35, 0.25) },
];

createPredict($('predict-spiral'), {
  question: 'We’ll set the slope to <strong>m = −0.8</strong> and start at 0.2. The path will…',
  options: regimeOptions,
  pressLabel: 'Set m = −0.8',
  onPress: async () => { await animateSlope({ m: -0.8, s0: 0.2 }, 40); return 'spiral in'; },
  explain: () => `<p>Each step multiplies the distance to 0.5 by −0.8: a bit smaller, and flipped
    to the other side. So the path spirals in. Now take the dial yourself and find the slope
    where the spiral stops closing in.</p>`,
});

createPredict($('predict-cycle'), {
  question: 'Now exactly <strong>m = −1</strong>. What does the path do?',
  options: [
    { value: 'in', label: 'slowly closes in on 0.5' },
    { value: 'out', label: 'slowly escapes' },
    { value: 'cycle', label: 'bounces between two values forever' },
    { value: 'stuck', label: 'stops moving at once' },
  ],
  pressLabel: 'Set m = −1',
  onPress: async () => { await animateSlope({ m: -1, s0: 0.2 }, 24); return 'cycle'; },
  explain: () => `<p>Multiplying the distance by −1 keeps its size and flips the side: 0.2 → 0.8 → 0.2 → …
    The path is a closed rectangle. This back-and-forth is a <strong>2-cycle</strong>, and it is
    the seed of everything in Chapter 3.</p>`,
});

// --- §1.4 zoom in ---------------------------------------------------------

const cases = {
  cos:     { map: 'cos',    near: 0.739, label: 'cos at 0.739' },
  sqrt:    { map: 'sqrt',   near: 1,     label: '√ at 1' },
  square1: { map: 'square', near: 1,     label: 'x² at 1' },
  square0: { map: 'square', near: 0,     label: 'x² at 0' },
};
const caseFixedPoint = (c) => {
  const f = maps[c.map].step;
  const x = fixedPointsOf(c.map).reduce((a, p) => (Math.abs(p.x - c.near) < Math.abs(a - c.near) ? p.x : a), Infinity);
  return { x, slope: slopeAt(f, x) };
};

const caseChoice = $('case-choice');
caseChoice.innerHTML = Object.entries(cases).map(([k, c]) => `
  <label><input type="radio" name="zcase" value="${k}"><span>${c.label}</span></label>`).join('');
caseChoice.addEventListener('change', (e) => store.set({ zcase: e.target.value }));

createSlider($('zoom-controls'), store, {
  key: 'zoom', label: 'zoom', min: 0, max: 5, step: 1, ticks: [0, 1, 2, 3, 4, 5],
  format: (v) => `×${2 ** v}`,
});

const zoomWindow = (s) => {
  const c = cases[s.zcase] ?? cases.cos;
  const fp = caseFixedPoint(c);
  const half = 1 / 2 ** s.zoom;
  return { c, fp, half, window: [fp.x - half, fp.x + half] };
};

createCobweb($('web4'), store, {
  select: (s) => {
    const { c, fp, half, window } = zoomWindow(s);
    return {
      f: maps[c.map].step,
      window,
      path: orbit(maps[c.map].step, fp.x + 0.6 * half * (fp.x === 0 ? 1 : -1), 25),
      fixedPoints: [{ x: fp.x, kind: classify(fp.slope) }],
      tangent: fp,
    };
  },
});

function render4(s) {
  const { c, fp } = zoomWindow(s);
  const input = caseChoice.querySelector(`input[value="${s.zcase}"]`);
  if (input) input.checked = true;
  let [name, detail] = regime(fp.slope);
  // On a curve (not a line) λ = 0 doesn't land in one step, but the distance roughly squares each step.
  if (name === 'superstable') detail = 'distance shrinks faster than any fixed factor';
  $('zread').innerHTML = `x* = ${fmt(fp.x, 4)} · f′(x*) = <strong>${fmt(fp.slope, 3)}</strong><br>`
    + `slope dial says: <strong>${name}</strong> (${detail})<br>`
    + `|f′(x*)| ${Math.abs(fp.slope) < 1 ? '&lt; 1 · ● stable' : '&gt; 1 · ○ unstable'}`;
  $('znote').textContent = s.zoom >= 3
    ? 'At this zoom the curve and its tangent are nearly the same line.'
    : 'Zoom in until the curve and the dashed tangent line merge.';
}
store.subscribe(render4);
render4(store.get());

initMathLayers();

// --- Strogatz lens -------------------------------------------------------

renderLens($('lens'), {
  read: [
    { ref: '§10.0', note: 'Why maps are worth studying on their own.' },
    { ref: '§10.1', note: 'Fixed points and cobwebs, including the linear stability test you just found with the slope dial.' },
    { ref: '§10.2', note: 'A first look at the logistic map. Skim it; we build it up properly in Chapters 2 and 3.' },
  ],
  notation: [
    ['<span class="tex">x_{n+1} = f(x_n)</span>', 'same', 'a one-dimensional map'],
    ['cobweb', 'cobweb', 'up to the curve, across to the diagonal'],
    ['fixed point <span class="tex">x^*</span>', '<span class="tex">x^*</span>', '<span class="tex">f(x^*) = x^*</span>; on the diagonal'],
    ['slope <span class="tex">m</span>, <span class="tex">f\'(x^*)</span>', 'multiplier <span class="tex">\\lambda = f\'(x^*)</span>', 'what each step multiplies the distance by'],
    ['distance to <span class="tex">x^*</span>', '<span class="tex">\\eta_n</span>', 'a small perturbation from the fixed point'],
    ['spiral / staircase in', 'stable, <span class="tex">|\\lambda| &lt; 1</span>', 'filled dot'],
    ['spiral / staircase out', 'unstable, <span class="tex">|\\lambda| &gt; 1</span>', 'hollow dot'],
    ['superstable', 'superstable, <span class="tex">\\lambda = 0</span>', 'errors shrink faster than any fixed factor'],
    ['marginal', 'marginal, <span class="tex">|\\lambda| = 1</span>', 'half-filled dot; the linear test can’t decide'],
  ],
  exercises: [
    {
      html: 'On the slope dial, start at 1 (distance 0.5 from the fixed point). Choose <span class="tex">m</span> so the distance halves every step. Predict how many steps until the path is within 0.001 of 0.5, then check it on the time series.',
      sim: '?s0=1#slope-dial',
    },
    {
      html: 'Run cos from <span class="tex">x_0 = 1</span> and hover the time series to read <span class="tex">x_3, x_4, x_5, x_6</span>. Compute the ratios of successive distances to 0.739085. What number are they heading towards, and where else on this page does it appear?',
      sim: '?map=cos&x0=1#presses',
    },
    {
      html: 'With the dial at <span class="tex">m = -1</span>, try three different starts. Each one bounces between two values. What do the two values of each pair always have in common? Explain it with <span class="tex">\\eta_{n+1} = -\\eta_n</span>.',
      sim: '?m=-1&s0=0.2#slope-dial',
    },
  ],
});
