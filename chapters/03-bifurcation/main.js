// Chapter 3 · Bifurcation & universality
// One store drives the dial (§3.1), the live diagram and its linked cobweb (§3.2), the doubling
// marker (§3.3), and the hump you draw (§3.4).

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { orbit } from '../../core/integrate.js';
import { findFixedPoints } from '../../core/fixedpoints.js';
import { logistic } from '../../systems/logistic.js';
import { makeHump, presets } from '../../systems/hump.js';
import { createCobweb } from '../../views/cobweb.js';
import { createTimeseries } from '../../views/timeseries.js';
import { createBifurcation } from '../../views/bifurcation.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';
import { createHumpEditor } from './hump-editor.js';

mountLayout({ chapter: 3 });

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

const store = createStore(
  {
    r: 2.8, x0: 0.3,                                             // §3.1 dial and seed
    rlo: 2.5, rhi: 4, xlo: 0, xhi: 1, tool: 'pick', nonce: 0,     // §3.2 diagram window
    mlo: 2.9, mhi: 3.6, mxlo: 0.3, mxhi: 1, mtool: 'pick',        // §3.3 diagram window
    marks: '', reveal: false,                                     // §3.3 marked doublings
    hump: 'logistic', a: 0.9, alo: 0.6, ahi: 1, axlo: 0, axhi: 1, htool: 'pick',  // §3.4
  },
  { urlKeys: ['r', 'x0', 'rlo', 'rhi', 'xlo', 'xhi', 'mlo', 'mhi', 'mxlo', 'mxhi', 'marks', 'hump', 'a', 'alo', 'ahi'] },
);

const f = (r) => (x) => logistic.step(x, { r });

// Period of the long-run orbit (up to 64), or null if none is found: chaos, or not settled yet.
function periodOf(step, x0 = 0.3) {
  let x = x0;
  for (let i = 0; i < 3000; i++) x = step(x);
  const tail = orbit(step, x, 256);
  for (let p = 1; p <= 64; p++) {
    let ok = true;
    for (let i = p; i < tail.length && ok; i++) ok = Math.abs(tail[i] - tail[i - p]) < 1e-7;
    if (ok) return p;
  }
  return null;
}

// Liapunov exponent from Chapter 2: the average of ln|f′(x)| along the orbit.
function lyapunov(r, x0 = 0.3) {
  let x = x0, sum = 0;
  for (let i = 0; i < 1000; i++) x = r * x * (1 - x);
  const N = 4000;
  for (let i = 0; i < N; i++) { x = r * x * (1 - x); sum += Math.log(Math.abs(r * (1 - 2 * x)) + 1e-300); }
  return sum / N;
}

const describe = (r) => {
  const p = periodOf(f(r));
  const lam = lyapunov(r);
  const what = p ? `<strong>period ${p}</strong>` : '<strong>no period ≤ 64</strong>: chaotic';
  return `r = ${r.toFixed(4)} · ${what} · λ = ${lam.toFixed(3)} ${lam < 0 ? '(negative: settles)' : '(positive: chaos)'}`;
};

// --- §3.1 turn the dial ------------------------------------------------------

const cobwebFor = (s) => ({
  f: f(s.r),
  window: [0, 1],
  path: orbit(f(s.r), s.x0, 80),
  fixedPoints: findFixedPoints(f(s.r), [0, 1]),
});
const seriesFor = (s) => ({
  series: [{ values: orbit(f(s.r), s.x0, 60), role: 'main' }],
  nMax: 60,
  yRange: [0, 1],
});

createCobweb($('web1'), store, { select: cobwebFor, seedKey: 'x0', seedRange: [0.001, 0.999] });
createTimeseries($('ts1'), store, { select: seriesFor });
createSlider($('r-controls'), store, {
  key: 'r', label: 'dial r', min: 2.5, max: 4, step: 0.001, ticks: [2.5, 3, 3.5, 4], format: (v) => v.toFixed(3),
});

function render1(s) {
  const xs = 1 - 1 / s.r, slope = 2 - s.r;
  const dot = Math.abs(slope) < 1 ? '● stable' : '○ unstable';
  $('read1').innerHTML = `${describe(s.r)}<br>fixed point x* = 1 − 1/r = ${xs.toFixed(4)} · slope 2 − r = <strong>${slope.toFixed(3)}</strong> · ${dot}`;
}
store.subscribe(render1);
render1(store.get());

// Slide the dial to a value, so the change is visible rather than a jump.
async function slideR(target, ms = 900) {
  const from = store.get().r, steps = 30;
  for (let i = 1; i <= steps; i++) {
    store.set({ r: +(from + ((target - from) * i) / steps).toFixed(4) });
    await sleep(ms / steps);
  }
}

createPredict($('predict-two'), {
  question: 'Turn the dial to <strong>r = 3.2</strong>. Once the start fades, the path will…',
  options: [
    { value: 'one', label: 'settle on one value' },
    { value: 'two', label: 'alternate between two values' },
    { value: 'wander', label: 'wander forever' },
    { value: 'escape', label: 'escape the hump' },
  ],
  pressLabel: 'Set r = 3.2',
  onPress: async () => {
    $('dial').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await slideR(3.2);
    return periodOf(f(3.2)) === 2 ? 'two' : 'one';
  },
  explain: () => `<p>The fixed point’s slope is 2 − 3.2 = −1.2. By Chapter 1’s slope dial, |−1.2| &gt; 1 means
    hollow (spiral out). But the path can’t leave the hump either, so it settles into a
    <strong>2-cycle</strong>: a rectangle on the cobweb. The fixed point turned unstable exactly when its slope
    passed −1, at r = 3. That’s the Chapter 1 “m = −1” moment in a real rule.</p>`,
});

createPredict($('predict-four'), {
  question: 'Now <strong>r = 3.5</strong>. How many values does the path settle into?',
  options: [
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: 'inf', label: 'infinitely many' },
  ],
  pressLabel: 'Set r = 3.5',
  onPress: async () => {
    $('dial').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await slideR(3.5);
    return String(periodOf(f(3.5)));
  },
  explain: () => `<p>Four. The 2-cycle went hollow in turn and split in two. Every doubling happens the same
    way: a cycle’s slope passes −1. Keep turning the dial and it happens again and again, faster each time.</p>`,
});

// --- §3.2 the diagram builds itself --------------------------------------------

const bif1 = createBifurcation($('bif'), store, {
  select: (s) => ({ key: `logistic-${s.nonce}`, step: (x, r) => r * x * (1 - x), x0: 0.3 }),
  paramKey: 'r', windowKeys: ['rlo', 'rhi', 'xlo', 'xhi'], home: [2.5, 4, 0, 1], toolKey: 'tool',
  label: 'Dial r',
});
createCobweb($('web2'), store, { select: cobwebFor });
createTimeseries($('ts2'), store, { select: seriesFor });

function render2(s) {
  $('read2').innerHTML = describe(s.r);
  $('zoom-tool').setAttribute('aria-pressed', s.tool === 'zoom');
  $('zoom-tool2').setAttribute('aria-pressed', s.mtool === 'zoom');
  $('zoom-tool3').setAttribute('aria-pressed', s.htool === 'zoom');
}
store.subscribe(render2);
render2(store.get());

const zoomPresets = {
  cascade: { rlo: 3.4, rhi: 3.58, xlo: 0.3, xhi: 0.92 },
  window: { rlo: 3.8, rhi: 3.87, xlo: 0, xhi: 1 },
  inside: { rlo: 3.8405, rhi: 3.8585, xlo: 0.43, xhi: 0.57 },
};
document.querySelectorAll('[data-preset]').forEach((b) =>
  b.addEventListener('click', () => store.set({ ...zoomPresets[b.dataset.preset], tool: 'pick' })));
$('zoom-tool').addEventListener('click', () => store.set({ tool: store.get().tool === 'zoom' ? 'pick' : 'zoom' }));
$('zoom-out').addEventListener('click', bif1.zoomOut);
$('zoom-reset').addEventListener('click', bif1.reset);

createPredict($('predict-cascade'), {
  question: 'As r goes from 2.5 up to 4, how does the long-run behavior change?',
  options: [
    { value: 'gradual', label: 'it gets messier gradually' },
    { value: 'cascade', label: 'the period doubles again and again, then chaos' },
    { value: 'jump', label: 'straight from one value to chaos' },
    { value: 'periodic', label: 'it stays periodic' },
  ],
  pressLabel: 'Build the diagram',
  onPress: async () => {
    delete $('diagram-sim').dataset.veiled;
    store.set({ nonce: store.get().nonce + 1, rlo: 2.5, rhi: 4, xlo: 0, xhi: 1 });
    $('diagram-sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(1200);
    return 'cascade';
  },
  explain: () => `<p>One branch splits into 2, then 4, then 8. The splits crowd together and pile up near
    r ≈ 3.57, where chaos begins. Chaos isn’t the end of the story either: look for the white gaps, such as
    the period-3 window near r = 3.83. Click anywhere on the diagram to see that r on the cobweb below.</p>`,
});

// --- §3.3 measure the doublings -----------------------------------------------

const ACCURATE = [3, 3.449490, 3.544090, 3.564407, 3.568759, 3.569692];
const DELTA = 4.669201;
const parseMarks = (s) => s.marks.split(',').filter(Boolean).map(Number).filter(Number.isFinite).sort((a, b) => a - b);

const bif2 = createBifurcation($('bif2'), store, {
  select: (s) => {
    const m = parseMarks(s);
    const marks = m.map((p, i) => ({ p, label: `r${SUB[i + 1] ?? ''}` }));
    if (m.length >= 3) {
      const [a, b] = m.slice(-2);
      marks.push({ p: b + (b - a) / DELTA, label: `r${SUB[m.length + 1] ?? ''}?`, style: 'predicted' });
    }
    return { key: 'logistic', step: (x, r) => r * x * (1 - x), x0: 0.3, marks };
  },
  paramKey: 'r', windowKeys: ['mlo', 'mhi', 'mxlo', 'mxhi'], home: [2.9, 3.6, 0.3, 1], toolKey: 'mtool',
  label: 'Dial r',
});
$('zoom-tool2').addEventListener('click', () => store.set({ mtool: store.get().mtool === 'zoom' ? 'pick' : 'zoom' }));
$('zoom-out2').addEventListener('click', bif2.zoomOut);
$('zoom-reset2').addEventListener('click', bif2.reset);
$('mark').addEventListener('click', () => {
  const s = store.get();
  const m = parseMarks(s);
  if (m.some((v) => Math.abs(v - s.r) < 1e-7)) return;
  store.set({ marks: [...m, s.r].sort((a, b) => a - b).join(',') });
});
$('reveal').addEventListener('change', (e) => store.set({ reveal: e.target.checked }));
$('marks-table').addEventListener('click', (e) => {
  const i = e.target.closest('button[data-remove]')?.dataset.remove;
  if (i == null) return;
  const m = parseMarks(store.get());
  m.splice(Number(i), 1);
  store.set({ marks: m.join(',') });
});

function renderMarks(s) {
  $('reveal').checked = s.reveal;
  $('mark').textContent = `Mark doubling at r = ${s.r}`;
  const m = parseMarks(s);
  const rows = Math.max(m.length, s.reveal ? ACCURATE.length : 0);
  const gap = (v, i) => (i > 0 && v[i] != null && v[i - 1] != null ? v[i] - v[i - 1] : null);
  const ratio = (v, i) => { const g1 = gap(v, i - 1), g2 = gap(v, i); return g1 && g2 ? g1 / g2 : null; };
  const cell = (x, d = 6) => (x == null ? '' : x.toFixed(d));
  let html = `<thead><tr><th>n</th><th>your rₙ</th><th>gap</th><th>ratio</th>${s.reveal ? '<th>accurate rₙ</th><th>ratio</th>' : ''}<th></th></tr></thead><tbody>`;
  for (let i = 0; i < rows; i++) {
    const rt = ratio(m, i), ra = ratio(ACCURATE, i);
    const good = (x) => (x != null && Math.abs(x - DELTA) < 0.25 ? ' class="good"' : '');
    html += `<tr><td>${i + 1}</td><td>${cell(m[i])}</td><td>${cell(gap(m, i))}</td><td${good(rt)}>${cell(rt, 3)}</td>`
      + (s.reveal ? `<td>${cell(ACCURATE[i])}</td><td${good(ra)}>${cell(ra, 3)}</td>` : '')
      + `<td>${m[i] != null ? `<button type="button" data-remove="${i}" aria-label="Remove mark ${i + 1}">×</button>` : ''}</td></tr>`;
  }
  $('marks-table').innerHTML = html + '</tbody>';
  const last = m.length >= 3 ? ratio(m, m.length - 1) : null;
  $('marks-read').innerHTML = m.length < 3
    ? `${m.length} mark${m.length === 1 ? '' : 's'}. Ratios need at least three. Zoom in for accuracy: r₄ is only 0.02 past r₃.`
    : `Your latest ratio: <strong>${last.toFixed(3)}</strong>. The dashed tick shows where δ ≈ 4.669 predicts the next doubling. Zoom in and check.`;
}
store.subscribe(renderMarks);
renderMarks(store.get());

createPredict($('predict-delta'), {
  question: 'Each gap between doublings is smaller than the one before. By roughly what factor?',
  options: [
    { value: 'two', label: '×2 each time' },
    { value: 'ten', label: '×10 each time' },
    { value: 'feig', label: 'about ×4.7 each time' },
    { value: 'none', label: 'no steady factor' },
  ],
  pressLabel: 'Show accurate values',
  onPress: async () => { store.set({ reveal: true }); return 'feig'; },
  explain: () => `<p>The gaps shrink by about <strong>4.669</strong> every time. This is the
    <strong>Feigenbaum constant</strong> δ. Now find it yourself: mark r₁ to r₄ on the diagram and watch your own
    ratios in the table.</p>`,
});

// --- §3.4 draw your own hump -----------------------------------------------------

const humpCache = new Map();
const hump = (spec) => {
  if (!humpCache.has(spec)) { humpCache.clear(); humpCache.set(spec, makeHump(spec)); }
  return humpCache.get(spec);
};

// Superstable parameters s_n: the peak c lies on the 2ⁿ-cycle, a·h iterated 2ⁿ times returns to c.
function superstable({ h, peak: c }, N = 8) {
  const F = (a, x, k) => { for (let i = 0; i < k; i++) x = a * h(x); return x; };
  const s = [c];               // n = 0: a·h(c) = c, and h(c) = 1
  let lo = c, width = 1 - c;
  for (let n = 1; n <= N; n++) {
    const k = 2 ** n, g = (a) => F(a, c, k) - c, steps = 4000, dA = width / steps;
    let a0 = lo + dA * 0.5, g0 = g(a0), found = null;
    for (let i = 1; i <= steps && a0 < 1; i++) {
      const a1 = Math.min(1, lo + (i + 0.5) * dA), g1 = g(a1);
      if (g0 * g1 < 0) { found = bisect(g, a0, a1, g0); break; }
      a0 = a1; g0 = g1;
    }
    if (found == null) break;
    s.push(found);
    width = Math.min(found - lo, 1 - found);
    lo = found;
  }
  return s;
}
function bisect(g, lo, hi, glo) {
  for (let j = 0; j < 80; j++) {
    const m = (lo + hi) / 2, gm = g(m);
    if (glo * gm <= 0) hi = m; else { lo = m; glo = gm; }
  }
  return (lo + hi) / 2;
}

const presetBox = $('hump-presets');
presetBox.innerHTML = Object.entries(presets).map(([k, p]) =>
  `<button class="button quiet" type="button" data-hump="${k}">${p.label}</button>`).join('');
presetBox.addEventListener('click', (e) => {
  const k = e.target.closest('[data-hump]')?.dataset.hump;
  if (k) store.set({ hump: k, alo: 0.6, ahi: 1, axlo: 0, axhi: 1 });
});
createSlider(presetBox, store, { key: 'a', label: 'height a', min: 0.6, max: 1, step: 0.001, format: (v) => v.toFixed(3) });

createHumpEditor($('editor'), store, { key: 'hump' });

let supers = superstable(hump(store.get().hump));
const bif3 = createBifurcation($('bif3'), store, {
  select: (s) => {
    const H = hump(s.hump);
    return {
      key: s.hump, step: (x, a) => a * H.h(x), x0: 0.3,
      marks: supers.slice(0, 5).map((p, i) => ({ p, label: `s${SUB[i]}` })),
    };
  },
  paramKey: 'a', windowKeys: ['alo', 'ahi', 'axlo', 'axhi'], home: [0.6, 1, 0, 1], toolKey: 'htool',
  label: 'Height a', xLabel: 'a',
});
$('zoom-tool3').addEventListener('click', () => store.set({ htool: store.get().htool === 'zoom' ? 'pick' : 'zoom' }));
$('zoom-reset3').addEventListener('click', bif3.reset);

function classify(s) {
  if (s.length < 5) return 'none';
  const d = (s.at(-3) - s.at(-4)) / (s.at(-2) - s.at(-3)), d2 = (s.at(-2) - s.at(-3)) / (s.at(-1) - s.at(-2));
  return Math.abs(d2 - DELTA) < 0.02 && Math.abs(d - DELTA) < 0.05 ? 'same' : 'depends';
}

function renderDelta() {
  const s = supers;
  let html = '<thead><tr><th>n</th><th>sₙ</th><th>gap</th><th>ratio</th></tr></thead><tbody>';
  s.forEach((v, i) => {
    const gp = i > 0 ? v - s[i - 1] : null;
    const rt = i > 1 ? (s[i - 1] - s[i - 2]) / gp : null;
    const good = rt != null && Math.abs(rt - DELTA) < 0.01 ? ' class="good"' : '';
    html += `<tr><td>${i}</td><td>${v.toFixed(8)}</td><td>${gp == null ? '' : gp.toExponential(3)}</td><td${good}>${rt == null ? '' : rt.toFixed(4)}</td></tr>`;
  });
  $('delta-table').innerHTML = html + '</tbody>';
  const kind = classify(s);
  const last = s.length > 2 ? (s.at(-2) - s.at(-3)) / (s.at(-1) - s.at(-2)) : null;
  $('delta-read').innerHTML = kind === 'same'
    ? `The ratios settle to <strong>${last.toFixed(4)}</strong>: Feigenbaum’s δ again, from a different hump.`
    : kind === 'none'
      ? 'No doubling cascade here. A hump with a sharp point on top (like the tent) never goes through the doublings at all.'
      : `The ratios head for about <strong>${last.toFixed(3)}</strong>, not 4.669. Is the top of your hump unusually flat or pointed?`;
}

let deltaTimer = null;
store.subscribe((s, changed) => {
  if (!changed.has('hump')) return;
  clearTimeout(deltaTimer);
  deltaTimer = setTimeout(() => { supers = superstable(hump(store.get().hump)); renderDelta(); bif3.redraw(); }, 200);
});
renderDelta();

createPredict($('predict-universal'), {
  question: 'Draw any single hump you like, or pick a preset. Will its doublings shrink by the same factor, 4.669?',
  options: [
    { value: 'same', label: 'yes, 4.669 again' },
    { value: 'depends', label: 'a different factor for each hump' },
    { value: 'none', label: 'there won’t be doublings at all' },
  ],
  pressLabel: 'Measure δ for my hump',
  onPress: async () => {
    supers = superstable(hump(store.get().hump));
    renderDelta();
    delete $('delta-sim').dataset.veiled;
    return classify(supers);
  },
  explain: (guess, actual) => actual === 'same'
    ? `<p>The same 4.669, to three or four decimal places, from a hump that isn’t <span class="tex">r\\,x(1-x)</span>.
       That’s <strong>universality</strong>. Now try the <em>flat top</em> and <em>tent</em> presets to find its limits.</p>`
    : `<p>This hump is one of the exceptions: its top is too flat or too sharp. Try a rounded hump, such as the
       <em>sine</em> or <em>lopsided</em> preset, or draw your own, and the table goes back to 4.669.</p>`,
});

// A link that lands on a sim (an exercise, a shared URL) shouldn't land behind a prediction veil.
const params = new URLSearchParams(location.search);
if (location.hash === '#diagram' || params.has('rlo')) delete $('diagram-sim').dataset.veiled;
if (location.hash === '#universal' || params.has('hump')) delete $('delta-sim').dataset.veiled;

initMathLayers();

// --- Strogatz lens -----------------------------------------------------------------

renderLens($('lens'), {
  read: [
    { ref: '§10.2', note: 'Numerics of the logistic map, and the orbit diagram you just built.' },
    { ref: '§10.3', note: 'The 2-cycle worked out by hand: why it’s born at r = 3 and when it loses stability.' },
    { ref: '§10.4', note: 'Periodic windows, including period 3, and how windows open.' },
    { ref: '§10.6', note: 'Universality, and why experiments on real fluids and circuits find the same δ.' },
    { ref: '§10.7', note: 'Renormalization: the reason behind universality. Skim it; it’s the hardest section of Ch 10.' },
  ],
  notation: [
    ['dial <span class="tex">r</span>', '<span class="tex">r</span>', 'the parameter of <span class="tex">x_{n+1} = r x_n(1 - x_n)</span>'],
    ['bifurcation diagram', 'orbit diagram', 'long-run values plotted against <span class="tex">r</span>'],
    ['a branch splits', 'period-doubling (flip) bifurcation', 'a cycle’s multiplier passes −1'],
    ['2-cycle', '<span class="tex">p, q</span> with <span class="tex">f(p) = q,\\ f(q) = p</span>', 'fixed points of <span class="tex">f \\circ f</span>'],
    ['doubling points', '<span class="tex">r_n</span>, accumulating at <span class="tex">r_\\infty \\approx 3.5699</span>', 'where the period becomes <span class="tex">2^n</span>'],
    ['the shrink factor', 'Feigenbaum constant <span class="tex">\\delta \\approx 4.669</span>', 'universal for humps with a rounded (quadratic) top'],
    ['<span class="tex">s_n</span>', 'superstable cycle', 'the peak lies on the cycle; multiplier 0'],
    ['<span class="tex">\\lambda</span> (Ch 2)', 'Liapunov exponent', 'negative in windows, positive in chaos'],
  ],
  exercises: [
    {
      html: 'Find where the period-3 window opens: move r up from 3.82 until the cobweb settles into 3 values. Read off the three values. Then zoom into the window. What’s inside it, and where have you seen that before?',
      sim: '?r=3.82&rlo=3.8&rhi=3.87#diagram',
    },
    {
      html: 'Mark r₂, r₃ and r₄ as accurately as you can. Use δ to predict r₅ (the dashed tick), then zoom in until you can see whether the 8-cycle really splits there. How far off were you, and was the error in your marks or in the prediction?',
      sim: '?mlo=3.54&mhi=3.575&mxlo=0.3&mxhi=0.92#doublings',
    },
    {
      html: 'Start from the <em>logistic</em> preset and make the top of the hump flatter and flatter by raising the handles next to the peak. Watch the ratio column. Then choose the <em>tent</em>. Why might only the shape <em>near the top</em> matter for δ?',
      sim: '?hump=logistic#universal',
    },
  ],
});
