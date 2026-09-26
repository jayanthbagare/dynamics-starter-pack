// Chapter 6 · Linear systems
// One store drives the primer (§6.0), the uncoupled system (§6.1), the general matrix (§6.2)
// and the trace–determinant map with its spring (§6.3).

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { rk4 } from '../../core/integrate.js';
import { linear2d, eigen, classify, springMatrix, trace, det } from '../../systems/linear2d.js';
import { createPhase2D } from '../../views/phase2d.js';
import { createTraceDet } from '../../views/tracedet.js';
import { createTimeseries } from '../../views/timeseries.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';
import { createGridTransform } from './grid-transform.js';

mountLayout({ chapter: 6 });

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = [-3, 3, -3, 3];
const fmt = (v) => (Math.abs(v) < 5e-4 ? '0' : v.toFixed(3));
const dotOf = { stable: '●', unstable: '○', half: '◐' };

const primerMatrices = {
  stretch:  { label: 'stretch',  A: { a: 2, b: 1, c: 1, d: 2 } },
  shear:    { label: 'shear',    A: { a: 1.5, b: 0.8, c: 0, d: 0.6 } },
  rotate:   { label: 'turn',     A: { a: 0.7, b: -1, c: 1, d: 0.7 } },
};
const matrixPresets = {
  saddle: { label: 'saddle', A: { a: 1, b: 2, c: 2, d: 1 } },
  node:   { label: 'node',   A: { a: -2, b: 1, c: 1, d: -2 } },
  spiral: { label: 'spiral', A: { a: -0.5, b: 2, c: -2, d: -0.5 } },
  skew:   { label: 'skewed node', A: { a: -1, b: 0.5, c: 0.2, d: -3 } },
};
const tours = {
  'stable node': [-3, 2], 'stable spiral': [-1, 2], center: [0, 2], 'unstable spiral': [1, 2],
  'unstable node': [3, 2], saddle: [0.5, -1.5], 'star / degenerate': [-2, 1], 'line of fixed points': [-1.5, 0],
};

const store = createStore(
  {
    pm: 'stretch', pt: 0, v: [1, 0.35],                             // §6.0 primer: matrix, morph 0→1, test vector
    l1: -1, l2: -2, s1: [[2.5, 2.5], [-2.5, 2], [1.5, -2.8], [-2.8, -1.2], [0.3, 2.8]],  // §6.1
    ...matrixPresets.node.A, s2: [[2.5, 1], [-1.5, 2.5], [-2.5, -2]],                 // §6.2
    tau: -1, det: 2, s3: [[2.5, 0]], cloud: [], paused: false,                          // §6.3
  },
  { urlKeys: ['pm', 'l1', 'l2', 'a', 'b', 'c', 'd', 'tau', 'det'] },
);

const choiceButtons = (box, presets, onPick) => {
  box.insertAdjacentHTML('afterbegin', Object.entries(presets).map(([k, p]) =>
    `<button class="button quiet" type="button" data-k="${k}">${p.label ?? k}</button>`).join(''));
  box.addEventListener('click', (e) => { const k = e.target.closest('[data-k]')?.dataset.k; if (k) onPick(k); });
};

// --- §6.0 primer: matrices move the plane ---------------------------------------------

const primerA = (s) => (primerMatrices[s.pm] ?? primerMatrices.stretch).A;
createGridTransform($('grid'), store, { select: (s) => ({ A: primerA(s), t: s.pt }), vKey: 'v' });
choiceButtons($('primer-presets'), primerMatrices, (k) => store.set({ pm: k, pt: 0 }));
createSlider($('primer-controls'), store, { key: 'pt', label: 'morph I → A', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) });

async function morph() {
  for (let i = 0; i <= 40; i++) { store.set({ pt: i / 40 }); await sleep(25); }
}
$('transform').addEventListener('click', morph);

function renderPrimer(s) {
  const A = primerA(s);
  const [vx, vy] = s.v, [ax, ay] = linear2d.f(s.v, A);
  const ang = Math.abs(Math.atan2(vx * ay - vy * ax, vx * ax + vy * ay)) * 180 / Math.PI;
  const lam = (vx * ax + vy * ay) / (vx * vx + vy * vy);
  const e = eigen(A);
  $('grid-read').innerHTML = `A = [[${A.a}, ${A.b}], [${A.c}, ${A.d}]]<br>`
    + `angle between v and Av: <strong>${ang.toFixed(1)}°</strong><br>`
    + (ang < 2 || ang > 178 ? `✓ <strong>Av = λv</strong> with λ = ${lam.toFixed(2)}: v is an eigenvector.`
      : e.complex ? 'This matrix turns every direction. No eigenvectors (no dashed lines).'
      : 'Turn v until it lies on a dashed line.');
}
store.subscribe(renderPrimer);
renderPrimer(store.get());

createPredict($('predict-eigen'), {
  question: 'A matrix turns almost every arrow. Are there directions it doesn’t turn at all?',
  options: [
    { value: 'none', label: 'none' },
    { value: 'one', label: 'exactly one' },
    { value: 'two', label: 'usually two' },
    { value: 'all', label: 'every direction' },
  ],
  pressLabel: 'Transform',
  onPress: async () => { store.set({ pm: 'stretch', pt: 0 }); await sleep(200); await morph(); return 'two'; },
  explain: () => `<p>Usually two. Along the dashed lines the grid only stretches or shrinks. Those are the
    <strong>eigenvectors</strong>, and the stretch factors are the <strong>eigenvalues</strong> λ. Try the <em>turn</em>
    matrix: it rotates everything, so there are no such directions. That’s where spirals will come from.</p>`,
});

// --- §6.1 two rules at once ----------------------------------------------------------------

const A1 = (s) => ({ a: s.l1, b: 0, c: 0, d: s.l2 });
const fp = (A) => [{ x: 0, y: 0, kind: classify(trace(A), det(A)).kind }];
createPhase2D($('p1'), store, {
  select: (s) => ({ f: (p) => linear2d.f(p, A1(s)), window: W, seeds: s.s1, fixedPoints: fp(A1(s)) }),
  seedsKey: 's1',
});
for (const [key, label] of [['l1', 'λ₁ (x-rate)'], ['l2', 'λ₂ (y-rate)']]) {
  createSlider($('l-controls'), store, { key, label, min: -4, max: 2, step: 0.05, ticks: [-4, 0, 2], format: (v) => v.toFixed(2) });
}
createTimeseries($('ts1'), store, {
  xLabel: 't', yLabel: '',
  select: (s) => {
    const [x0, y0] = s.s1[0] ?? [2, 2];
    const ts = Array.from({ length: 201 }, (_, i) => i * 0.03);
    return {
      series: [
        { values: ts.map((t) => x0 * Math.exp(s.l1 * t)), times: ts, role: 'main', dots: false, label: 'x(t)' },
        { values: ts.map((t) => y0 * Math.exp(s.l2 * t)), times: ts, role: 'main', style: 'twin', dots: false, label: 'y(t)' },
      ],
      nMax: 6, yRange: [-3, 3],
    };
  },
});
function render1(s) {
  const c = classify(s.l1 + s.l2, s.l1 * s.l2);
  $('read1').innerHTML = `λ₁ = ${s.l1.toFixed(2)}, λ₂ = ${s.l2.toFixed(2)} → <strong>${c.name}</strong> ${dotOf[c.kind]}<br>`
    + (s.l1 < 0 && s.l2 < 0 && s.l1 !== s.l2
      ? `the <em>slow</em> direction is the ${s.l1 > s.l2 ? 'x' : 'y'}-axis: trajectories arrive along it`
      : s.l1 * s.l2 < 0 ? 'one direction shrinks while the other grows: a saddle' : '');
}
store.subscribe(render1);
render1(store.get());

createPredict($('predict-slow'), {
  question: 'Set λ₁ = −1 and λ₂ = −4: both coordinates decay, y four times faster. Trajectories come into the origin along…',
  options: [
    { value: 'x', label: 'the x-axis' },
    { value: 'y', label: 'the y-axis' },
    { value: 'straight', label: 'straight lines from every direction' },
    { value: 'spiral', label: 'spirals' },
  ],
  pressLabel: 'Set the rates',
  onPress: async () => {
    store.set({ l1: -1, l2: -4 });
    $('uncoupled').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(500);
    return 'x';
  },
  explain: () => `<p>Along the x-axis: the <em>slow</em> direction. The fast coordinate y dies off first, leaving only
    the slowly shrinking x. So every trajectory bends to come in tangent to the x-axis. Now drag λ₂ above 0 and the
    y-direction grows instead: a <strong>saddle</strong>.</p>`,
});

// --- §6.2 eigenvectors ---------------------------------------------------------------------

const A2 = (s) => ({ a: s.a, b: s.b, c: s.c, d: s.d });
createPhase2D($('p2'), store, {
  select: (s) => {
    const A = A2(s), e = eigen(A);
    return {
      f: (p) => linear2d.f(p, A), window: W, seeds: s.s2, fixedPoints: fp(A),
      lines: e.vectors.map((v, i) => ({ dir: v, label: `v${'₁₂'[i]}` })),
      // Δ = 0: the eigenvector for the zero eigenvalue is a whole line of fixed points
      lineOfFixed: Math.abs(det(A)) < 1e-9 && !e.complex ? e.vectors[Math.abs(e.values[0]) < Math.abs(e.values[1]) ? 0 : 1] ?? e.vectors[0] : null,
    };
  },
  seedsKey: 's2',
});
choiceButtons($('m-presets'), matrixPresets, (k) => store.set({ ...matrixPresets[k].A }));
for (const k of ['a', 'b', 'c', 'd']) {
  createSlider($('m-controls'), store, { key: k, label: k, min: -3, max: 3, step: 0.05, ticks: [0], format: (v) => v.toFixed(2) });
}
function render2(s) {
  const A = A2(s), e = eigen(A), c = classify(trace(A), det(A));
  $('read2').innerHTML = `τ = ${fmt(trace(A))}, Δ = ${fmt(det(A))} → <strong>${c.name}</strong> ${dotOf[c.kind]}<br>`
    + (e.complex ? `λ = ${fmt(e.re)} ± ${fmt(e.im)}i: complex, so no real eigenvectors`
      : `λ₁ = ${fmt(e.values[0])}, λ₂ = ${fmt(e.values[1])}` + e.vectors.map((v, i) => `<br>v${'₁₂'[i]} = (${fmt(v[0])}, ${fmt(v[1])})`).join(''));
}
store.subscribe(render2);
render2(store.get());

createPredict($('predict-line'), {
  question: 'Start a trajectory exactly on an eigenvector line. It…',
  options: [
    { value: 'stays', label: 'stays on the line' },
    { value: 'curves', label: 'curves off it' },
    { value: 'spirals', label: 'spirals around the origin' },
  ],
  pressLabel: 'Start on v₁',
  onPress: async () => {
    store.set({ ...matrixPresets.skew.A });
    const [v] = eigen(matrixPresets.skew.A).vectors;
    store.set({ s2: [[2.6 * v[0], 2.6 * v[1]], [-2.6 * v[0], -2.6 * v[1]]] });
    $('eigen').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(500);
    return 'stays';
  },
  explain: () => `<p>It stays on the line and slides straight in (or out). On an eigenvector the arrow <span class="tex">A\\mathbf x</span>
    points along the line, so there’s nothing to turn it. These are the <strong>straight-line solutions</strong>. Now click
    somewhere between the lines, then choose the <em>spiral</em> preset, where the lines disappear.</p>`,
});

// --- §6.3 the trace–determinant map ----------------------------------------------------------

const A3 = (s) => springMatrix(s.tau, s.det);
createTraceDet($('td'), store, { tauKey: 'tau', detKey: 'det' });
createPhase2D($('p3'), store, {
  select: (s) => {
    const A = A3(s), e = eigen(A);
    return {
      f: (p) => linear2d.f(p, A), window: W, seeds: s.s3, fixedPoints: fp(A), particles: s.cloud,
      lines: e.vectors.map((v) => ({ dir: v })),
      lineOfFixed: Math.abs(s.det) < 1e-9 ? [1, 0] : null,
    };
  },
  seedsKey: 's3', xLabel: 'x', yLabel: 'ẋ',
});
createTimeseries($('ts3'), store, {
  xLabel: 't', yLabel: 'x(t)',
  select: (s) => {
    let p = s.s3[0] ?? [2.5, 0];
    const f = (q) => linear2d.f(q, A3(s)), xs = [p[0]], ts = [0];
    for (let i = 1; i <= 600; i++) { p = rk4(f, p, 0.025); if (!p.every(Number.isFinite)) break; xs.push(p[0]); ts.push(i * 0.025); }
    return { series: [{ values: xs, times: ts, role: 'main', dots: false }], nMax: 15, yRange: [-3, 3] };
  },
});
choiceButtons($('tour'), Object.fromEntries(Object.keys(tours).map((k) => [k, { label: k }])), (k) => {
  const [tau, D] = tours[k];
  store.set({ tau, det: D });
});

function springWords(tau, D) {
  if (Math.abs(D) < 1e-9) return 'no stiffness: the spring doesn’t pull back at all';
  if (D < 0) return 'negative stiffness: the “spring” pushes away from the middle';
  if (Math.abs(tau) < 1e-9) return 'no damping: it rings forever';
  const disc = tau * tau - 4 * D;
  if (tau > 0) return 'negative damping: energy is pumped in, so the motion grows';
  if (Math.abs(disc) < 1e-9) return 'critically damped: settles as fast as possible without ringing';
  return disc > 0 ? 'overdamped: creeps back without ringing' : 'underdamped: rings as it settles';
}
function render3(s) {
  const e = eigen(A3(s)), c = classify(s.tau, s.det);
  $('read3').innerHTML = `τ = ${fmt(s.tau)}, Δ = ${fmt(s.det)} → <strong>${c.name}</strong> ${dotOf[c.kind]}<br>`
    + (e.complex ? `λ = ${fmt(e.re)} ± ${fmt(e.im)}i` : `λ₁ = ${fmt(e.values[0])}, λ₂ = ${fmt(e.values[1])}`)
    + `<br>spring: ${springWords(s.tau, s.det)}`;
  $('pause').setAttribute('aria-pressed', s.paused);
  $('pause').textContent = s.paused ? 'Resume the flow' : 'Pause the flow';
}
store.subscribe(render3);
render3(store.get());

// the particle cloud: drifts with the flow while the sim is on screen and not paused
const N = 140, rand = () => [(Math.random() * 2 - 1) * 3, (Math.random() * 2 - 1) * 3];
let visible = false, cloudRunning = false, ages = [];
new IntersectionObserver(([en]) => { visible = en.isIntersecting; runCloud(); }).observe($('map-sim'));
$('pause').addEventListener('click', () => { store.set({ paused: !store.get().paused }); runCloud(); });

async function runCloud() {
  if (cloudRunning) return;
  cloudRunning = true;
  if (!store.get().cloud.length) { store.set({ cloud: Array.from({ length: N }, rand) }); ages = Array.from({ length: N }, () => Math.random() * 200); }
  while (visible && !store.get().paused) {
    const s = store.get(), f = (q) => linear2d.f(q, A3(s));
    const cloud = s.cloud.map((p, i) => {
      ages[i] = (ages[i] ?? 0) + 1;
      let q = rk4(f, p, 0.02);
      q = rk4(f, q, 0.02);
      const out = !q.every(Number.isFinite) || Math.abs(q[0]) > 3.2 || Math.abs(q[1]) > 3.2;
      if (out || ages[i] > 260 || Math.hypot(...q) < 0.03) { ages[i] = 0; return rand(); }
      return q;
    });
    store.set({ cloud });
    await new Promise(requestAnimationFrame);
  }
  cloudRunning = false;
}

async function glide(tau, D) {
  const s = store.get(), steps = 30;
  $('map-sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await sleep(300);
  for (let i = 1; i <= steps; i++) {
    store.set({ tau: +(s.tau + ((tau - s.tau) * i) / steps).toFixed(3), det: +(s.det + ((D - s.det) * i) / steps).toFixed(4) });
    await sleep(35);
  }
}

createPredict($('predict-spiral'), {
  question: 'Keep τ = −1 and raise Δ from 0.2 to 0.4, across the dashed parabola. What changes in the portrait?',
  options: [
    { value: 'nothing', label: 'nothing' },
    { value: 'spiral', label: 'it starts to spiral' },
    { value: 'unstable', label: 'it becomes unstable' },
    { value: 'saddle', label: 'it becomes a saddle' },
  ],
  pressLabel: 'Move across',
  onPress: async () => {
    store.set({ tau: -1, det: 0.2, s3: [[2.5, 0]] });
    await glide(-1, 0.4);
    return 'spiral';
  },
  explain: () => `<p>It starts to spiral. Above the parabola, <span class="tex">\\tau^2 &lt; 4\\Delta</span>, so the eigenvalues are
    complex and the eigenvector highways vanish. The spring goes from <em>overdamped</em> (creeping back) to
    <em>underdamped</em> (ringing): look at x(t). It’s still stable, because τ &lt; 0.</p>`,
});

createPredict($('predict-center'), {
  question: 'Now move to τ = 0 with Δ &gt; 0. The trajectories…',
  options: [
    { value: 'in', label: 'spiral in' },
    { value: 'out', label: 'spiral out' },
    { value: 'loops', label: 'go round in closed loops' },
    { value: 'straight', label: 'head straight in' },
  ],
  pressLabel: 'Set τ = 0',
  onPress: async () => { await glide(0, 2); return 'loops'; },
  explain: () => `<p>Closed loops: a <strong>center</strong>. No damping, so the spring rings forever. Centers are fragile: nudge τ
    by the smallest amount and the loops open into spirals, in or out. (Chapter 7 asks what happens to centers when the
    system isn’t linear.) The dot is half-filled: neither attracting nor repelling.</p>`,
});

createPredict($('predict-saddle'), {
  question: 'Anywhere below the τ-axis (Δ &lt; 0), the origin is…',
  options: [
    { value: 'node', label: 'a stable node' },
    { value: 'saddle', label: 'a saddle' },
    { value: 'depends', label: 'it depends on τ' },
  ],
  pressLabel: 'Visit three points',
  onPress: async () => { await glide(-2, -1); await sleep(500); await glide(0, -1); await sleep(500); await glide(2, -1); return 'saddle'; },
  explain: () => `<p>Always a saddle. Δ is the product of the eigenvalues, so Δ &lt; 0 means one is positive and one is negative:
    one highway in, one highway out. τ only tilts them. The highway in is the saddle’s <strong>stable manifold</strong>, and
    the one out is its <strong>unstable manifold</strong>.</p>`,
});

initMathLayers();

// --- Strogatz lens -----------------------------------------------------------------------------

renderLens($('lens'), {
  read: [
    { ref: '§5.0–5.1', note: 'Linear systems, the uncoupled case, and eigenvectors as straight-line solutions.' },
    { ref: '§5.2', note: 'Classification of fixed points and the trace–determinant plane.' },
    { ref: '§5.3', note: 'Optional: a playful application of the same classification.' },
  ],
  notation: [
    ['<span class="tex">\\dot{\\mathbf x} = A\\mathbf x</span>', 'same', 'a linear system in the plane'],
    ['trace τ, determinant Δ', 'τ, Δ', '<span class="tex">\\tau = a + d,\\ \\Delta = ad - bc</span>'],
    ['highways', 'eigenvectors <span class="tex">\\mathbf v_1, \\mathbf v_2</span>', 'straight-line solutions'],
    ['rates', 'eigenvalues <span class="tex">\\lambda_1, \\lambda_2</span>', 'roots of <span class="tex">\\lambda^2 - \\tau\\lambda + \\Delta = 0</span>'],
    ['node / spiral / center / saddle', 'same, plus star and degenerate node', 'the portrait types'],
    ['highway in / out of a saddle', 'stable / unstable manifold', ''],
    ['◐ (center)', 'neutrally stable', 'neither attracting nor repelling'],
    ['whole line of fixed points', 'non-isolated fixed points', 'Δ = 0'],
  ],
  exercises: [
    {
      html: 'With the a–d sliders, build a matrix with τ = −3 and Δ = 2. Before looking, predict the eigenvalues and the portrait type. Then find a <em>second</em> matrix with the same τ and Δ. Are the two portraits the same type? Are they the same picture?',
      sim: '#eigen',
    },
    {
      html: 'On the map, walk straight up the line τ = −1 from Δ = −1 to Δ = 2. List the portrait types in order, and say at exactly which Δ each change happens.',
      sim: '?tau=-1&det=-1#map',
    },
    {
      html: 'For the spring with stiffness Δ = 1, find the τ that makes x(t) settle <em>fastest without ringing</em>. Where is that point on the map, and why must it be there?',
      sim: '?tau=-1&det=1#map',
    },
  ],
});
