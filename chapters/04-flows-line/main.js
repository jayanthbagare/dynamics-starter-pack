// Chapter 4 · Flows on the line
// One store drives the phase line and particles (§4.1–4.2) and the Euler map (§4.3).

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { orbit, rk4 } from '../../core/integrate.js';
import { findZeros, findFixedPoints } from '../../core/fixedpoints.js';
import { makeFlow, presets, nodeXs, encodeHeights, X_RANGE, Y_RANGE } from '../../systems/drawn-flow.js';
import { logisticGrowth } from '../../systems/logistic-growth.js';
import { createVectorField1D } from '../../views/vectorfield1d.js';
import { createTimeseries } from '../../views/timeseries.js';
import { createCobweb } from '../../views/cobweb.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';

mountLayout({ chapter: 4 });

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const store = createStore(
  {
    f: 'cubic',                 // the flow: preset name or 7 heights
    trails: [],                 // one per particle: { times: [...], values: [...] }
    h: 0.5, e0: 0.1,            // §4.3 Euler step size and start
  },
  { urlKeys: ['f', 'h', 'e0'] },
);

let flowCache = null;
const flow = (s) => {
  if (!flowCache || flowCache.spec !== s.f) flowCache = { spec: s.f, ...makeFlow(s.f) };
  return flowCache;
};

// --- particles: each one flows under ẋ = f(x), integrated with RK4 -----------------

const T_MAX = 16, DT = 0.02, PER_FRAME = 3;
let animating = false;

function drop(xs) {
  const s = store.get();
  store.set({ trails: [...s.trails, ...xs.map((x) => ({ times: [0], values: [x] }))].slice(-40) });
  if (!animating) animate();
}

async function animate() {
  animating = true;
  while (true) {
    const s = store.get();
    const { f } = flow(s);
    let moving = false;
    const trails = s.trails.map((tr) => {
      const t = tr.times.at(-1), x = tr.values.at(-1);
      if (t >= T_MAX || Math.abs(x) > 50) return tr;
      moving = true;
      let xn = x;
      for (let i = 0; i < PER_FRAME; i++) xn = rk4(f, xn, DT);
      return { times: [...tr.times, t + DT * PER_FRAME], values: [...tr.values, xn] };
    });
    if (!moving) break;
    store.set({ trails });
    await new Promise(requestAnimationFrame);
  }
  animating = false;
}

// When the rule changes, particles carry on from where they are, on a fresh clock.
store.subscribe((s, changed) => {
  if (!changed.has('f') || !s.trails.length) return;
  store.set({ trails: s.trails.map((tr) => ({ times: [0], values: [tr.values.at(-1)] })) });
  if (!animating) animate();
});

const particles = (s) => s.trails.map((tr) => tr.values.at(-1));
const row = () => Array.from({ length: 13 }, (_, i) => X_RANGE[0] + 0.25 + (i * (X_RANGE[1] - X_RANGE[0] - 0.5)) / 12);

// --- §4.1 a flow on the line ------------------------------------------------------

createVectorField1D($('field1'), store, {
  select: (s) => ({ f: flow(s).f, xRange: X_RANGE, yRange: Y_RANGE, particles: particles(s) }),
  onAxis: (x, e) => drop(e.shiftKey ? row() : [+x.toFixed(3)]),
  label: 'Phase line: the graph of f with arrows showing the flow. Click to drop a particle.',
});

createTimeseries($('ts1'), store, {
  xLabel: 't', yLabel: 'x(t)',
  select: (s) => ({
    series: s.trails.map((tr) => ({ values: tr.values, times: tr.times, role: 'main', dots: false })),
    nMax: T_MAX,
    yRange: X_RANGE,
    fixedLines: findZeros(flow(s).f, X_RANGE).map((z) => ({ y: z.x, kind: z.kind })),
  }),
});

$('drop-row').addEventListener('click', () => drop(row()));
$('clear').addEventListener('click', () => store.set({ trails: [] }));

function renderFlowCap(s) {
  const n = s.trails.length;
  $('flow-cap').textContent = n ? `${n} particle${n > 1 ? 's' : ''}. Each line in the lower plot is one particle’s x(t).`
    : 'Click the plot to drop a particle.';
}
store.subscribe(renderFlowCap);
renderFlowCap(store.get());

createPredict($('predict-direction'), {
  question: 'Where the graph of f is <strong>above</strong> the axis, a particle on the axis moves…',
  options: [
    { value: 'right', label: 'right' },
    { value: 'left', label: 'left' },
    { value: 'up', label: 'up, off the axis' },
    { value: 'depends', label: 'it depends how far above' },
  ],
  pressLabel: 'Drop a particle at x = 0.3',
  onPress: async () => {
    store.set({ f: 'cubic', trails: [] });
    $('flow').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(400);
    drop([0.3]);
    await sleep(1800);
    return 'right';
  },
  explain: () => `<p>Right. <span class="tex">f(x) &gt; 0</span> means <span class="tex">x</span> is increasing,
    so the particle slides right. It stays on the line; the height of the graph is its <em>speed</em>, not a place.
    It slows as the graph comes down to the axis and stops where <span class="tex">f = 0</span>.</p>`,
});

// --- §4.2 drag f(x) ----------------------------------------------------------------

const presetBox = $('presets');
presetBox.innerHTML = Object.entries(presets).map(([k, p]) =>
  `<button class="button quiet" type="button" data-flow="${k}">${p.label}</button>`).join('');
presetBox.addEventListener('click', (e) => {
  const k = e.target.closest('[data-flow]')?.dataset.flow;
  if (k) store.set({ f: k });
});

createVectorField1D($('field2'), store, {
  select: (s) => {
    const F = flow(s);
    return { f: F.f, xRange: X_RANGE, yRange: Y_RANGE, particles: particles(s), handles: { xs: nodeXs(), ys: F.heights } };
  },
  onHandle: (k, y) => {
    const hs = [...flow(store.get()).heights];
    hs[k] = y;
    return { f: encodeHeights(hs) };
  },
  onAxis: (x, e) => drop(e.shiftKey ? row() : [+x.toFixed(3)]),
  label: 'Drawable f(x)',
});

function renderDraw(s) {
  const zs = findZeros(flow(s).f, X_RANGE);
  const sym = { stable: '● stable', unstable: '○ unstable', half: '◐ half-stable' };
  $('draw-read').innerHTML = zs.length
    ? zs.map((z) => `x* = ${z.x.toFixed(3)} · f′(x*) = ${z.slope.toFixed(3)} · ${sym[z.kind]}`).join('<br>')
    : 'No fixed points: every particle runs off the edge.';
}
store.subscribe(renderDraw);
renderDraw(store.get());

createPredict($('predict-stability'), {
  question: 'A fixed point where f crosses the axis going <strong>downhill</strong> (+ on the left, − on the right) is…',
  options: [
    { value: 'stable', label: 'stable' },
    { value: 'unstable', label: 'unstable' },
    { value: 'half', label: 'half-stable' },
    { value: 'depends', label: 'it depends how steep' },
  ],
  pressLabel: 'Drop particles on both sides',
  onPress: async () => {
    store.set({ f: 'cubic', trails: [] });
    $('draw').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(400);
    drop([1.2, 2.4]);
    await sleep(1800);
    return 'stable';
  },
  explain: () => `<p>Stable. On the left, f &gt; 0 pushes right, towards it. On the right, f &lt; 0 pushes left,
    towards it again. The steepness sets how <em>fast</em> they arrive, not whether. Uphill crossings are unstable,
    and a graph that just touches the axis gives a half-stable point (try the <em>touching</em> preset).</p>`,
});

createPredict($('predict-monotone'), {
  question: 'Can a particle on the line ever pass through a fixed point, or turn around?',
  options: [
    { value: 'fast', label: 'yes, if it’s moving fast enough' },
    { value: 'unstable', label: 'yes, near unstable points' },
    { value: 'never', label: 'never' },
  ],
  pressLabel: 'Drop a whole row',
  onPress: async () => {
    store.set({ trails: [] });
    $('flow').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(400);
    drop(row());
    await sleep(2200);
    return 'never';
  },
  explain: () => `<p>Never. At each point the speed has one value, so a particle can’t reverse. And it can’t reach
    a fixed point in finite time, let alone pass it, because it slows to zero on the way in. Every time series is
    <strong>monotonic</strong>: rising or falling, then flattening. Oscillation needs at least two dimensions (Chapter 7).</p>`,
});

// --- §4.3 Euler is iteration --------------------------------------------------------

const EULER_T = 12;
const eulerStep = (h) => (x) => x + h * logisticGrowth.f(x);

createCobweb($('web-euler'), store, {
  select: (s) => ({
    f: eulerStep(s.h),
    window: [-0.1, 1.45],
    path: orbit(eulerStep(s.h), s.e0, 40),
    fixedPoints: findFixedPoints(eulerStep(s.h), [-0.1, 1.45]),
  }),
  seedKey: 'e0',
  seedRange: [0.01, 1.4],
  label: 'Euler start x₀',
});

createTimeseries($('ts-euler'), store, {
  xLabel: 't', yLabel: 'x',
  select: (s) => {
    const n = Math.ceil(EULER_T / s.h);
    const euler = orbit(eulerStep(s.h), s.e0, n);
    const ts = Array.from({ length: 301 }, (_, i) => (i / 300) * EULER_T);
    return {
      series: [
        { values: ts.map((t) => logisticGrowth.exact(t, s.e0)), times: ts, role: 'main', dots: false, label: 'exact' },
        { values: euler, times: euler.map((_, i) => i * s.h), role: 'main', style: 'twin', label: 'Euler' },
      ],
      nMax: EULER_T,
      yRange: [-0.1, 1.45],
    };
  },
});

createSlider($('h-controls'), store, {
  key: 'h', label: 'step size h', min: 0.05, max: 3, step: 0.01, ticks: [1, 2, 3], format: (v) => v.toFixed(2),
});

function regime(m) {
  const eps = 1e-9;
  if (Math.abs(m) < eps) return 'superstable: the fastest possible convergence';
  if (m > 0 && m < 1) return 'staircase in: no overshoot';
  if (m < 0 && m > -1) return 'spiral in: overshoots, alternating, but converges';
  if (Math.abs(m + 1) < eps) return 'on the edge: a 2-cycle is about to appear';
  return 'the fixed point is unstable for Euler';
}
function periodOf(step, x0) {
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

function renderEuler(s) {
  const m = 1 - s.h;
  const p = periodOf(eulerStep(s.h), s.e0);
  $('euler-read').innerHTML = `slope of the Euler map at x* = 1: 1 − h = <strong>${m.toFixed(2)}</strong> → ${regime(m)}<br>`
    + `long run: ${p === 1 ? 'settles on 1' : p ? `<strong>a ${p}-cycle</strong>` : '<strong>chaos</strong> (no period ≤ 64)'}`
    + ` · this is Ch 3’s logistic map with r = 1 + h = ${(1 + s.h).toFixed(2)}`;
}
store.subscribe(renderEuler);
renderEuler(store.get());

async function slideH(target) {
  const from = store.get().h;
  $('euler').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  for (let i = 1; i <= 25; i++) { store.set({ h: +(from + ((target - from) * i) / 25).toFixed(3) }); await sleep(30); }
}

createPredict($('predict-overshoot'), {
  question: 'Take big steps, <strong>h = 1.5</strong>. The Euler path toward 1 will…',
  options: [
    { value: 'smooth', label: 'approach smoothly, like the real flow' },
    { value: 'overshoot', label: 'overshoot, alternate, but converge' },
    { value: 'never', label: 'never settle' },
    { value: 'blowup', label: 'blow up' },
  ],
  pressLabel: 'Set h = 1.5',
  onPress: async () => { await slideH(1.5); return 'overshoot'; },
  explain: () => `<p>It overshoots 1, comes back below, and closes in, alternating. On the cobweb that’s a spiral,
    Chapter 1’s <em>spiral in</em>, because the Euler map’s slope at 1 is 1 − h = −0.5. The true solution never
    overshoots (Chapter 4’s “never”). The oscillation belongs to the method, not the flow.</p>`,
});

createPredict($('predict-period'), {
  question: 'Now <strong>h = 2.5</strong>. What does Euler do?',
  options: [
    { value: '1', label: 'converges to 1' },
    { value: '2', label: 'a 2-cycle' },
    { value: '4', label: 'a 4-cycle' },
    { value: 'chaos', label: 'chaos' },
  ],
  pressLabel: 'Set h = 2.5',
  onPress: async () => { await slideH(2.5); const p = periodOf(eulerStep(2.5), store.get().e0); return p ? String(p) : 'chaos'; },
  explain: () => `<p>A 4-cycle. Substitute <span class="tex">x = \\tfrac{1+h}{h}\\,y</span> and the Euler map becomes
    <span class="tex">y \\mapsto (1+h)\\,y(1-y)</span>: <strong>Chapter 3’s logistic map with r = 1 + h</strong>.
    h = 2.5 is r = 3.5, the period-4 you met there. Push h toward 3 and you’ll find the whole cascade, then chaos,
    from a flow that only ever rises smoothly to 1.</p>`,
});

initMathLayers();

// --- Strogatz lens ----------------------------------------------------------------------

renderLens($('lens'), {
  read: [
    { ref: '§2.0–2.2', note: 'Flows on the line, drawn as a vector field on the phase line, exactly as above.' },
    { ref: '§2.3', note: 'Logistic growth, the flow in the Euler section.' },
    { ref: '§2.4', note: 'Linear stability analysis: f′(x*) &lt; 0.' },
    { ref: '§2.5', note: 'Existence and uniqueness. Skim it; it’s why trajectories can’t cross.' },
    { ref: '§2.6', note: 'Why flows on the line can’t oscillate.' },
    { ref: '§2.8', note: 'Solving on the computer: Euler, improved Euler, Runge–Kutta (this site uses RK4).' },
  ],
  notation: [
    ['<span class="tex">\\dot x = f(x)</span>', 'same', 'a one-dimensional flow (a vector field on the line)'],
    ['phase line', 'phase portrait on the line', 'the axis with arrows and fixed points'],
    ['fixed point', '<span class="tex">x^*</span> with <span class="tex">f(x^*) = 0</span>', 'not <span class="tex">f(x^*) = x^*</span> as for maps'],
    ['● / ○ / ◐', 'stable / unstable / half-stable', 'from the arrows on either side'],
    ['<span class="tex">f\'(x^*)</span>', 'linear stability: sign of <span class="tex">f\'(x^*)</span>', 'negative means stable'],
    ['step size <span class="tex">h</span>', '<span class="tex">\\Delta t</span>', 'the time step of a numerical method'],
  ],
  exercises: [
    {
      html: 'Draw an f with exactly three fixed points. Must their stabilities alternate (stable, unstable, stable, or the reverse)? Can you draw one where they don’t? What do you have to do to f?',
      sim: '?f=cubic#draw',
    },
    {
      html: 'In the Euler section, find the largest h where Euler reaches 1 <em>without overshooting</em>, and the largest h where it reaches 1 at all. Explain both numbers using the slope 1 − h and Chapter 1’s slope dial.',
      sim: '?h=0.5#euler',
    },
    {
      html: 'Find the h where Euler first becomes a 2-cycle, and roughly where it first becomes chaotic. Which values of r in Chapter 3 are these? What does that tell you about choosing a step size?',
      sim: '?h=1.9#euler',
    },
  ],
});
