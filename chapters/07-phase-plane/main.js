// Chapter 7 · The phase plane
// One store drives the pendulum and its portrait (§7.1), the linearization zoom (§7.2), competition (§7.3),
// the van der Pol limit cycle (§7.4) and the Hopf bifurcation (§7.5).

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { rk4 } from '../../core/integrate.js';
import { findFixedPoints2D, jacobian } from '../../core/fixedpoints.js';
import { pendulum, energy } from '../../systems/pendulum.js';
import { competition } from '../../systems/competition.js';
import { vanderpol } from '../../systems/vanderpol.js';
import { hopf } from '../../systems/hopf.js';
import { linear2d, eigen, classify } from '../../systems/linear2d.js';
import { createPhase2D } from '../../views/phase2d.js';
import { createTraceDet } from '../../views/tracedet.js';
import { createTimeseries } from '../../views/timeseries.js';
import { createBifurcation } from '../../views/bifurcation.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';
import { createPendulumView } from './pendulum-view.js';

mountLayout({ chapter: 7 });

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PI = Math.PI;
const fmt = (v) => (Math.abs(v) < 5e-4 ? '0' : v.toFixed(3));
const dotOf = { stable: '●', unstable: '○', half: '◐' };
const withKind = (p) => ({ ...p, ...classify(p.tau, p.det) });

const store = createStore(
  {
    th: 0.5, om: 0, b: 0, ps: [0.5, 0], held: false, trail: [], energyOn: false,   // §7.1
    fp: 'bottom', zoom: 1, lt: 0, ld: 9.8,                                         // §7.2
    ca: 0.5, cc: 0.5, cseeds: [[0.1, 0.9], [1.2, 0.2], [0.3, 0.1]],                 // §7.3
    mu: 1, vseeds: [[0.1, 0], [3, 3]],                                              // §7.4
    hm: -0.2, hw: 1, htau: -0.4, hdet: 1.04, hseeds: [[0.05, 0], [1.1, 0]],          // §7.5
    alo: -0.5, ahi: 0.5, axlo: 0, axhi: 1,
  },
  { urlKeys: ['th', 'om', 'b', 'fp', 'zoom', 'ca', 'cc', 'mu', 'hm', 'hw'] },
);
if (store.get().ps[0] !== store.get().th || store.get().ps[1] !== store.get().om) store.set({ ps: [store.get().th, store.get().om] });

// --- §7.1 the pendulum -------------------------------------------------------------------

const P = (s) => ({ ...pendulum.params, b: s.b });
const fPend = (s) => (q) => pendulum.f(q, P(s));
const wrapAngle = (θ) => ((θ + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
const PW = [-PI, PI, -8, 8];
const pendFixedCache = new Map();
const pendFixed = (s) => {
  if (!pendFixedCache.has(s.b)) pendFixedCache.set(s.b, findFixedPoints2D(fPend(s), PW).map(withKind));
  return pendFixedCache.get(s.b);
};
const E_TOP = 2 * pendulum.params.g / pendulum.params.L;   // energy of the upside-down rest state

createPendulumView($('pend'), store, { stateKey: 'ps', heldKey: 'held', onRelease: () => release() });
createPhase2D($('p-pend'), store, {
  select: (s) => ({
    f: fPend(s), window: PW, wrapX: [-PI, PI],
    fixedPoints: pendFixed(s),
    levelSets: [
      { g: (q) => energy(q, P(s)), level: E_TOP, style: 'separatrix', label: 'separatrix' },
      ...(s.energyOn ? [2, 6, 12, 26, 34].map((level) => ({ g: (q) => energy(q, P(s)), level, style: 'contour' })) : []),
    ],
    state: s.ps, trail: s.trail,
  }),
  onPick: ([θ, ω]) => { store.set({ ps: [θ, ω], trail: [], held: false }); release(); },
  xLabel: 'θ', yLabel: 'ω', label: 'Pendulum phase portrait on the cylinder',
});
createSlider($('pend-controls'), store, { key: 'b', label: 'damping b', min: 0, max: 1.5, step: 0.01, ticks: [0], format: (v) => v.toFixed(2) });
$('energy').addEventListener('change', (e) => store.set({ energyOn: e.target.checked }));
$('stop').addEventListener('click', () => store.set({ held: true, ps: [store.get().ps[0], 0], trail: [] }));

function renderPend(s) {
  const E = energy(s.ps, P(s));
  const kind = s.held ? 'held still' : E < E_TOP - 1e-6 ? 'swinging back and forth (libration)' : 'going over the top (rotation)';
  $('pend-read').innerHTML = `θ = ${(s.ps[0] * 180 / PI).toFixed(1)}°, ω = ${s.ps[1].toFixed(2)} · energy ${E.toFixed(2)} `
    + `(the separatrix is at ${E_TOP.toFixed(2)}) · <strong>${kind}</strong>`;
}
store.subscribe(renderPend);
renderPend(store.get());

// the pendulum's clock: real time, RK4, only while visible and moving
let pendVisible = false, pendRunning = false;
new IntersectionObserver(([en]) => { pendVisible = en.isIntersecting; release(); }).observe($('pend'));
function release() {
  const s = store.get();
  store.set({ th: +s.ps[0].toFixed(3), om: +s.ps[1].toFixed(3) });
  if (!pendRunning) runPendulum();
}
async function runPendulum() {
  pendRunning = true;
  while (pendVisible && !store.get().held) {
    const s = store.get();
    let q = s.ps;
    for (let i = 0; i < 4; i++) q = rk4(fPend(s), q, 1 / 240);
    q = [wrapAngle(q[0]), q[1]];
    const atRest = Math.abs(q[1]) < 1e-3 && Math.abs(Math.sin(q[0])) < 1e-3;
    store.set({ ps: q, trail: [...s.trail, q].slice(-240) });
    if (atRest) break;
    await new Promise(requestAnimationFrame);
  }
  pendRunning = false;
}

async function setPendulum(θ, ω, watchMs) {
  store.set({ ps: [θ, ω], trail: [], held: false });
  $('pendulum').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  release();
  await sleep(watchMs);
}

createPredict($('predict-swing'), {
  question: 'Pull the pendulum to 30° and let go. In the portrait, the state traces…',
  options: [
    { value: 'loop', label: 'a closed loop' },
    { value: 'spiral', label: 'a spiral into the middle' },
    { value: 'line', label: 'a straight line' },
    { value: 'point', label: 'a single point' },
  ],
  pressLabel: 'Let go from 30°',
  onPress: async () => { store.set({ b: 0 }); await setPendulum(PI / 6, 0, 2800); return 'loop'; },
  explain: () => `<p>A closed loop, round and round forever. Right of centre it’s moving right, and left of centre it’s
    moving back. With no friction the energy never changes, so the state stays on one energy contour, and those
    contours are closed curves around the bottom. That’s Chapter 6’s <strong>center</strong>, now in a nonlinear system.</p>`,
});

createPredict($('predict-over'), {
  question: 'At the bottom, give it a hard shove: ω = 7. The state…',
  options: [
    { value: 'loop', label: 'swings back, on a bigger loop' },
    { value: 'over', label: 'goes over the top and keeps going round' },
    { value: 'stop', label: 'stops at the top' },
  ],
  pressLabel: 'Shove it',
  onPress: async () => { store.set({ b: 0 }); await setPendulum(0, 7, 3000); return 'over'; },
  explain: () => `<p>Over the top, again and again. In the portrait the path runs off the right edge and comes back on the left
    (it’s the same angle), never crossing the ω = 0 axis. It sits <em>outside</em> the separatrix. The threshold speed is
    <span class="tex">2\\sqrt{g/L} \\approx 6.26</span>: exactly enough energy to reach the top.</p>`,
});

// --- §7.2 linearization zoom -----------------------------------------------------------

const fpPoint = (s) => (s.fp === 'top' ? [PI, 0] : [0, 0]);
const zoomWindow = (s) => {
  const [cx, cy] = fpPoint(s), h = 3 / 2 ** s.zoom;
  return [cx - h, cx + h, cy - h, cy + h];
};
const ringSeeds = (s) => {
  const [cx, cy] = fpPoint(s), r = 0.55 * (3 / 2 ** s.zoom);
  return Array.from({ length: 8 }, (_, k) => [cx + r * Math.cos((k * PI) / 4 + 0.2), cy + r * Math.sin((k * PI) / 4 + 0.2)]);
};
const J = (s) => jacobian(fPend(s), fpPoint(s));
const linF = (s) => { const A = J(s), [cx, cy] = fpPoint(s); return ([x, y]) => linear2d.f([x - cx, y - cy], A); };
const fpDot = (s) => { const A = J(s); return [{ x: fpPoint(s)[0], y: fpPoint(s)[1], kind: classify(A.a + A.d, A.a * A.d - A.b * A.c).kind }]; };

createPhase2D($('p-nl'), store, { select: (s) => ({ f: fPend(s), window: zoomWindow(s), seeds: ringSeeds(s), fixedPoints: fpDot(s) }), xLabel: 'θ', yLabel: 'ω' });
createPhase2D($('p-lin'), store, { select: (s) => ({ f: linF(s), window: zoomWindow(s), seeds: ringSeeds(s), fixedPoints: fpDot(s) }), xLabel: 'θ', yLabel: 'ω' });
createTraceDet($('td-lin'), store, { tauKey: 'lt', detKey: 'ld', tauRange: [-4, 4], detRange: [-12, 12], readOnly: true });
createSlider($('zoom-controls'), store, { key: 'zoom', label: 'zoom', min: 0, max: 6, step: 1, ticks: [0, 2, 4, 6], format: (v) => `×${2 ** v}` });
$('fp-choice').addEventListener('change', (e) => store.set({ fp: e.target.value }));
store.subscribe((s, changed) => {
  if (!changed.has('fp') && !changed.has('b')) return;
  const A = J(s);
  store.set({ lt: +(A.a + A.d).toFixed(4), ld: +(A.a * A.d - A.b * A.c).toFixed(4) });
});
store.set({ lt: +(J(store.get()).a + J(store.get()).d).toFixed(4), ld: +(J(store.get()).a * J(store.get()).d - J(store.get()).b * J(store.get()).c).toFixed(4) });

function renderLin(s) {
  $('fp-choice').querySelector(`input[value="${s.fp}"]`).checked = true;
  const A = J(s), c = classify(A.a + A.d, A.a * A.d - A.b * A.c);
  $('lin-read').innerHTML = `J = [[${fmt(A.a)}, ${fmt(A.b)}], [${fmt(A.c)}, ${fmt(A.d)}]] · τ = ${fmt(A.a + A.d)}, Δ = ${fmt(A.a * A.d - A.b * A.c)}`
    + ` → <strong>${c.name}</strong> ${dotOf[c.kind]} · zoom ×${2 ** s.zoom}`;
}
store.subscribe((s, changed) => { if (changed.has('fp') || changed.has('zoom') || changed.has('b')) renderLin(s); });
renderLin(store.get());

createPredict($('predict-top'), {
  question: 'Zoom into the <strong>upside-down</strong> position. Up close, the portrait looks like…',
  options: [
    { value: 'center', label: 'a center' },
    { value: 'spiral', label: 'a spiral' },
    { value: 'saddle', label: 'a saddle' },
    { value: 'node', label: 'a node' },
  ],
  pressLabel: 'Zoom in on the top',
  onPress: async () => {
    store.set({ fp: 'top', zoom: 0, b: 0 });
    $('zoom').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    for (let z = 1; z <= 4; z++) { await sleep(450); store.set({ zoom: z }); }
    return 'saddle';
  },
  explain: () => `<p>A saddle. Up close, one direction falls away (the pendulum topples) and one direction comes in (the rare
    motion that just barely reaches the top). Those two directions are the separatrix from §7.1, seen up close. On the map,
    Δ = −g/L &lt; 0: saddle territory.</p>`,
});

// --- §7.3 competition ---------------------------------------------------------------------

const CW = [-0.05, 1.35, -0.05, 1.35];
const C = (s) => ({ ...competition.params, a: s.ca, c: s.cc });
const fComp = (s) => (q) => competition.f(q, C(s));
const compFixed = (s) => findFixedPoints2D(fComp(s), [-0.01, 1.35, -0.01, 1.35]).map(withKind);

// The separatrix: the stable manifold of an interior saddle, traced backwards in time from just beside it.
function separatrix(s) {
  const sad = compFixed(s).find((p) => p.name === 'saddle' && p.x > 0.01 && p.y > 0.01);
  if (!sad) return null;
  const e = eigen(sad.J);
  const v = e.vectors[e.values[0] < 0 ? 0 : 1];
  const back = (q) => fComp(s)(q).map((c) => -c);
  const branch = (sign) => {
    let q = [sad.x + sign * 1e-4 * v[0], sad.y + sign * 1e-4 * v[1]];
    const pts = [[sad.x, sad.y], q];
    for (let i = 0; i < 3000; i++) {
      q = rk4(back, q, 0.01);
      if (!q.every(Number.isFinite) || q[0] < -0.05 || q[1] < -0.05 || q[0] > 1.4 || q[1] > 1.4) break;
      pts.push(q);
    }
    return pts;
  };
  return { saddle: sad, points: [...branch(-1).reverse(), ...branch(1)], unstable: e.vectors[e.values[0] < 0 ? 1 : 0] };
}

createPhase2D($('p-comp'), store, {
  select: (s) => {
    const sep = separatrix(s);
    return {
      f: fComp(s), window: CW, seeds: s.cseeds, fixedPoints: compFixed(s), steps: 2500,
      levelSets: [
        { g: (q) => fComp(s)(q)[0], style: 'nullcline-x', label: 'ẋ = 0' },
        { g: (q) => fComp(s)(q)[1], style: 'nullcline-y', label: 'ẏ = 0' },
      ],
      curves: sep ? [{ points: sep.points, label: 'separatrix' }] : [],
    };
  },
  seedsKey: 'cseeds', xLabel: 'x (species 1)', yLabel: 'y (species 2)',
});
const compPresets = {
  coexist: { label: 'coexistence', ca: 0.5, cc: 0.5 },
  xwins: { label: 'species 1 wins', ca: 0.5, cc: 1.5 },
  ywins: { label: 'species 2 wins', ca: 2, cc: 0.5 },
  bistable: { label: 'tipping point', ca: 2, cc: 2 },
};
$('comp-presets').innerHTML = Object.entries(compPresets).map(([k, p]) => `<button class="button quiet" type="button" data-k="${k}">${p.label}</button>`).join('');
$('comp-presets').addEventListener('click', (e) => {
  const k = e.target.closest('[data-k]')?.dataset.k;
  if (k) store.set({ ca: compPresets[k].ca, cc: compPresets[k].cc });
});
createSlider($('comp-controls'), store, { key: 'ca', label: 'a: how much y crowds x', min: 0.1, max: 2.5, step: 0.01, ticks: [1.25], format: (v) => v.toFixed(2) });
createSlider($('comp-controls'), store, { key: 'cc', label: 'c: how much x crowds y', min: 0.1, max: 2.5, step: 0.01, ticks: [0.8], format: (v) => v.toFixed(2) });

function renderComp(s) {
  const fps = compFixed(s);
  const stable = fps.filter((p) => p.kind === 'stable');
  const outcome = stable.length > 1 ? 'two stable outcomes: <strong>who wins depends on where you start</strong>'
    : stable[0] && stable[0].x > 0.01 && stable[0].y > 0.01 ? '<strong>coexistence</strong>'
    : stable[0] ? `<strong>species ${stable[0].x > 0.01 ? 1 : 2} always wins</strong>` : '';
  $('comp-read').innerHTML = fps.map((p) => `${dotOf[p.kind]} (${fmt(p.x)}, ${fmt(p.y)}) ${p.name}`).join('<br>') + `<br>${outcome}`;
}
store.subscribe((s, changed) => { if (changed.has('ca') || changed.has('cc')) renderComp(s); });
renderComp(store.get());

createPredict($('predict-tip'), {
  question: 'Each species crowds the other <em>more</em> than it crowds itself (a = c = 2). The outcome…',
  options: [
    { value: 'coexist', label: 'they coexist' },
    { value: 'same', label: 'the same species always wins' },
    { value: 'depends', label: 'who wins depends on where you start' },
  ],
  pressLabel: 'Start two close neighbours',
  onPress: async () => {
    store.set({ ca: 2, cc: 2 });
    const sep = separatrix(store.get());
    // the point of the separatrix farthest into the plot, so both runs cross the portrait visibly
    const [px, py] = sep.points.filter(([x, y]) => x < 1.25 && y < 1.25).reduce((a, b) => (b[0] + b[1] > a[0] + a[1] ? b : a));
    const [u, v] = sep.unstable;
    store.set({ cseeds: [[px + 0.01 * u, py + 0.01 * v], [px - 0.01 * u, py - 0.01 * v]] });
    $('competition').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(500);
    return 'depends';
  },
  explain: () => `<p>It depends where you start. The two trajectories began 0.02 apart, one on each side of the highlighted
    <strong>separatrix</strong>, and they end at opposite winners. The separatrix is the saddle’s stable manifold: the knife-edge
    set of starts that head for the saddle itself. It divides the plane into two <strong>basins of attraction</strong>.</p>`,
});

// --- §7.4 limit cycles --------------------------------------------------------------------

const vdpWindow = (s) => { const Y = Math.max(3.2, 1.55 * s.mu + 1); return [-3, 3, -Y, Y]; };
const fVdp = (s) => (q) => vanderpol.f(q, { mu: s.mu });
createPhase2D($('p-vdp'), store, {
  select: (s) => ({ f: fVdp(s), window: vdpWindow(s), seeds: s.vseeds, fixedPoints: findFixedPoints2D(fVdp(s), [-1, 1, -1, 1]).map(withKind) }),
  seedsKey: 'vseeds', yLabel: 'ẋ',
});
createTimeseries($('ts-vdp'), store, {
  xLabel: 't', yLabel: 'x(t)',
  select: (s) => {
    let q = s.vseeds[0] ?? [0.1, 0];
    const xs = [q[0]], ts = [0];
    for (let i = 1; i <= 1600; i++) { q = rk4(fVdp(s), q, 0.025); xs.push(q[0]); ts.push(i * 0.025); }
    return { series: [{ values: xs, times: ts, role: 'main', dots: false }], nMax: 40, yRange: [-3, 3] };
  },
});
createSlider($('vdp-controls'), store, { key: 'mu', label: 'μ', min: 0.1, max: 6, step: 0.05, ticks: [1, 3, 6], format: (v) => v.toFixed(2) });
function renderVdp(s) {
  let q = [0.1, 0], mx = 0;
  for (let i = 0; i < 8000; i++) { q = rk4(fVdp(s), q, 0.01); if (i > 5000) mx = Math.max(mx, Math.abs(q[0])); }
  $('vdp-read').innerHTML = `μ = ${s.mu.toFixed(2)} · the loop reaches x ≈ ±${mx.toFixed(2)}`
    + (s.mu > 3 ? ' · <strong>relaxation oscillation</strong>: slow creep, sudden jump' : '');
}
store.subscribe((s, changed) => { if (changed.has('mu')) renderVdp(s); });
renderVdp(store.get());

createPredict($('predict-cycle'), {
  question: 'Start one trajectory very near the origin and one far outside. Where do they end up?',
  options: [
    { value: 'origin', label: 'both at the origin' },
    { value: 'different', label: 'on different loops' },
    { value: 'same', label: 'on the same loop' },
    { value: 'escape', label: 'they escape' },
  ],
  pressLabel: 'Start them',
  onPress: async () => {
    store.set({ mu: 1, vseeds: [[0.05, 0], [2.8, 2.8]] });
    $('cycle').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(500);
    return 'same';
  },
  explain: () => `<p>The same loop: one spirals <em>out</em> from the unstable origin, and the other spirals <em>in</em> from outside. That loop is a
    <strong>limit cycle</strong>, and its size (x reaches about ±2) is set by the system, not by where you start.</p>`,
});

createPredict($('predict-relax'), {
  question: 'Turn μ up to 5. What does x(t) look like?',
  options: [
    { value: 'wave', label: 'a smooth wave' },
    { value: 'relax', label: 'slow creep, then sudden jumps' },
    { value: 'decay', label: 'it dies away' },
    { value: 'irregular', label: 'irregular, like chaos' },
  ],
  pressLabel: 'Set μ = 5',
  onPress: async () => {
    const from = store.get().mu;
    for (let i = 1; i <= 20; i++) { store.set({ mu: +(from + ((5 - from) * i) / 20).toFixed(2) }); await sleep(40); }
    return 'relax';
  },
  explain: () => `<p>Slow creep, then sudden jumps: a <strong>relaxation oscillation</strong>. The loop has slow stretches and fast
    stretches. It’s the rhythm of a dripping tap or a flashing firefly: charge up slowly, let go all at once.</p>`,
});

// --- §7.5 Hopf ----------------------------------------------------------------------------

const fHopf = (s) => (q) => hopf.f(q, { mu: s.hm, omega: s.hw });
createPhase2D($('p-hopf'), store, {
  select: (s) => ({ f: fHopf(s), window: [-1.2, 1.2, -1.2, 1.2], seeds: s.hseeds, fixedPoints: [withKind({ x: 0, y: 0, ...(() => { const A = jacobian(fHopf(s), [0, 0]); return { tau: A.a + A.d, det: A.a * A.d - A.b * A.c }; })() })] }),
  seedsKey: 'hseeds',
});
createBifurcation($('dia-hopf'), store, {
  select: () => ({ mode: 'branches', key: 'hopf-radius', f: (r, mu) => mu * r - r ** 3 }),
  paramKey: 'hm', windowKeys: ['alo', 'ahi', 'axlo', 'axhi'], home: [-0.5, 0.5, 0, 1],
  label: 'Dial μ', xLabel: 'μ', yLabel: 'r',
});
createTraceDet($('td-hopf'), store, { tauKey: 'htau', detKey: 'hdet', tauRange: [-2, 2], detRange: [-1, 4] });
createSlider($('hopf-controls'), store, { key: 'hm', label: 'μ', min: -0.5, max: 0.5, step: 0.01, ticks: [0], format: (v) => v.toFixed(2) });
createSlider($('hopf-controls'), store, { key: 'hw', label: 'ω (turning rate)', min: 0.3, max: 1.8, step: 0.05, format: (v) => v.toFixed(2) });

// keep (μ, ω) and the τ–Δ point in step: eigenvalues μ ± iω ⇔ τ = 2μ, Δ = μ² + ω²
let syncing = false;
store.subscribe((s, changed) => {
  if (syncing) return;
  syncing = true;
  if (changed.has('htau') || changed.has('hdet')) {
    const mu = Math.max(-0.5, Math.min(0.5, s.htau / 2));
    const w = Math.max(0.3, Math.min(1.8, Math.sqrt(Math.max(0.09, s.hdet - mu * mu))));
    store.set({ hm: +mu.toFixed(3), hw: +w.toFixed(3), htau: +(2 * mu).toFixed(3), hdet: +(mu * mu + w * w).toFixed(4) });
  } else if (changed.has('hm') || changed.has('hw')) {
    store.set({ htau: +(2 * s.hm).toFixed(3), hdet: +(s.hm * s.hm + s.hw * s.hw).toFixed(4) });
  }
  queueMicrotask(() => { syncing = false; });
});

function renderHopf(s) {
  let q = [0.3, 0];
  for (let i = 0; i < 6000; i++) q = rk4(fHopf(s), q, 0.02);
  const r = Math.hypot(...q);
  $('hopf-read').innerHTML = `μ = ${s.hm.toFixed(2)} · eigenvalues ${s.hm.toFixed(2)} ± ${s.hw.toFixed(2)}i · `
    + (s.hm > 0.005 ? `<strong>stable loop</strong>, radius ${r.toFixed(3)} (√μ = ${Math.sqrt(s.hm).toFixed(3)})`
      : s.hm < -0.005 ? '<strong>stable spiral</strong>: no loop' : '<strong>μ = 0</strong>: right at the bifurcation');
}
store.subscribe((s, changed) => { if (changed.has('hm') || changed.has('hw')) renderHopf(s); });
renderHopf(store.get());

createPredict($('predict-hopf'), {
  question: 'Slide μ from −0.2 up past 0 to +0.2. The stable spiral…',
  options: [
    { value: 'runaway', label: 'becomes an unstable spiral that runs off forever' },
    { value: 'loop', label: 'gives birth to a small stable loop' },
    { value: 'saddle', label: 'becomes a saddle' },
    { value: 'nothing', label: 'doesn’t change' },
  ],
  pressLabel: 'Slide μ up',
  onPress: async () => {
    store.set({ hm: -0.2, hseeds: [[0.05, 0], [1.1, 0]] });
    $('hopf').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    for (let i = 1; i <= 40; i++) { store.set({ hm: +(-0.2 + (0.4 * i) / 40).toFixed(3) }); await sleep(45); }
    return 'loop';
  },
  explain: () => `<p>A small stable loop is born. The origin does become unstable, but the −r³ term catches the growth, and the spiral settles
    onto a loop of radius √μ. On Chapter 6’s map, the eigenvalue point μ ± iω crosses the <strong>centers line</strong> (τ = 0).
    That’s a <strong>Hopf bifurcation</strong>: how rhythms switch on, in lasers, chemical clocks and the flutter of an aircraft wing.</p>`,
});

initMathLayers();

// --- Strogatz lens -------------------------------------------------------------------------------

renderLens($('lens'), {
  read: [
    { ref: '§6.0–6.2', note: 'Phase portraits, and why trajectories can’t cross (skim the existence–uniqueness part).' },
    { ref: '§6.3', note: 'Fixed points and linearization, including the warning about centers.' },
    { ref: '§6.4', note: 'Competing species: nullclines, basins and the stable manifold.' },
    { ref: '§6.5, §6.7', note: 'Conservative systems and the pendulum: energy contours, libration and rotation.' },
    { ref: '§7.0–7.1, §7.5', note: 'Limit cycles, and relaxation oscillations in the van der Pol oscillator.' },
    { ref: '§8.2', note: 'Hopf bifurcations, supercritical and subcritical.' },
    { ref: '§6.8', note: 'Optional: index theory, a topological way to count fixed points.' },
  ],
  notation: [
    ['slopes at a fixed point', 'Jacobian <span class="tex">J</span>', 'the linearization <span class="tex">\\dot{\\boldsymbol\\eta} = J\\boldsymbol\\eta</span>'],
    ['ẋ = 0, ẏ = 0 curves', 'nullclines', 'fixed points sit where they cross'],
    ['separatrix', 'separatrix; stable manifold of a saddle', 'the boundary between basins of attraction'],
    ['upside-down to upside-down', 'heteroclinic orbit', 'a path joining two saddles'],
    ['swinging / going round', 'libration / rotation', 'inside / outside the separatrix'],
    ['energy contour', 'conserved quantity, conservative system', 'why the pendulum keeps its center'],
    ['self-made rhythm', 'limit cycle', 'an isolated closed orbit'],
    ['slow creep, sudden jump', 'relaxation oscillation', 'large μ in van der Pol'],
    ['a loop is born', 'Hopf bifurcation (super- or subcritical)', 'complex eigenvalues cross the imaginary axis'],
  ],
  exercises: [
    {
      html: 'Using the portrait (click on the ω-axis at θ = 0), find the smallest speed at the bottom that carries the pendulum over the top. Then derive it from energy, <span class="tex">\\tfrac12\\omega^2 = 2g/L</span>, and compare.',
      sim: '?b=0#pendulum',
    },
    {
      html: 'In the <em>tipping point</em> setting, find two starting populations less than 0.02 apart that end with different winners. Where do you have to put them? Now slide c down slowly: at what value does the tipping point disappear, and what happens to the saddle?',
      sim: '?ca=2&cc=2#competition',
    },
    {
      html: 'Measure the Hopf loop’s radius at μ = 0.04, 0.16 and 0.36. What law do the radii follow? What does it say about how an oscillation “switches on” as μ passes 0: gradually or suddenly?',
      sim: '?hm=0.04#hopf',
    },
  ],
});
