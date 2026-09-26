// Chapter 8 · Lorenz: closing the loop
// One store drives the trajectory in space and the waterwheel (§8.1–8.2, the same state), the
// 10,000-particle cloud (§8.3) and the peak-to-peak map (§8.4). The 3D views share one camera.

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { rk4, orbit } from '../../core/integrate.js';
import { findFixedPoints } from '../../core/fixedpoints.js';
import { lorenz, lorenzFixedPoints } from '../../systems/lorenz.js';
import { createScene3D } from '../../views/scene3d.js';
import { createTimeseries } from '../../views/timeseries.js';
import { createCobweb } from '../../views/cobweb.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';
import { createWaterwheel } from './waterwheel-view.js';

mountLayout({ chapter: 8 });

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BOUNDS = [[-22, 22], [-30, 30], [0, 52]];
const { sigma: SIGMA, b: B } = lorenz.params;

const store = createStore(
  {
    r: 28, yaw: 0.7, elev: 0.3, zoom: 1,                              // dial and shared camera
    ls: [1, 1, 20], trail: [], xhist: { times: [0], values: [1] }, t: 0, angle: 0,   // §8.1–8.2
    ball: 3, lam: 0.5, cloudTick: 0, ct: 0, spread: { times: [], values: [] }, count: 10000, cloudRunning: false,  // §8.3
    curve: 'fit', pz: 36,                                             // §8.4
  },
  { urlKeys: ['r', 'yaw', 'elev', 'zoom', 'ball', 'curve'] },
);

const P = (s) => ({ sigma: SIGMA, r: s.r, b: B });
const fL = (s) => (q) => lorenz.f(q, P(s));
const markers = (s) => lorenzFixedPoints(P(s)).map(({ p, name }) => ({
  p, kind: name === 'origin' ? (s.r < 1 ? 'stable' : 'unstable') : s.r < 24.74 ? 'stable' : 'unstable',
}));

// --- §8.1–8.2 one trajectory, shown in space and as a waterwheel ----------------------------

const DT = 0.01, PER_FRAME = 3, TRAIL = 2000, XT = 25;

createScene3D($('space'), store, {
  select: (s) => ({ bounds: BOUNDS, lines: [{ points: s.trail, colour: 'trajectory', fade: true }], markers: markers(s), dots: [s.ls] }),
  yawKey: 'yaw', pitchKey: 'elev', zoomKey: 'zoom', label: 'The Lorenz trajectory in space',
});
const xSeries = (s, label) => ({
  xLabel: 't', yLabel: label,
  select: (st) => {
    const t0 = st.xhist.times[0] ?? 0;
    return { series: [{ values: st.xhist.values, times: st.xhist.times.map((t) => t - t0), role: 'main', dots: false }], nMax: XT, yRange: [-22, 22] };
  },
});
createTimeseries($('ts-x'), store, xSeries(store, 'x(t)'));
createTimeseries($('ts-spin'), store, xSeries(store, 'spin (x)'));
createWaterwheel($('wheel-canvas'), store, { select: (s) => ({ angle: s.angle, x: s.ls[0], y: s.ls[1], z: s.ls[2], r: s.r }) });
createSlider($('r-controls'), store, { key: 'r', label: 'dial r (how hard it is driven)', min: 0.5, max: 30, step: 0.01, ticks: [1, 24.74, 28], format: (v) => v.toFixed(2) });
$('restart').addEventListener('click', () => restart([1, 1, 20]));

function restart(p) {
  store.set({ ls: p, trail: [p], xhist: { times: [0], values: [p[0]] }, t: 0 });
}

let visibleTraj = new Set(), trajRunning = false;
for (const id of ['space', 'wheel-canvas', 'ts-x', 'ts-spin']) {
  new IntersectionObserver(([e]) => {
    e.isIntersecting ? visibleTraj.add(id) : visibleTraj.delete(id);
    if (visibleTraj.size && !trajRunning) runTrajectory();
  }).observe($(id));
}
async function runTrajectory() {
  trajRunning = true;
  while (visibleTraj.size) {
    const s = store.get();
    let q = s.ls;
    for (let i = 0; i < PER_FRAME; i++) q = rk4(fL(s), q, DT);
    const t = s.t + DT * PER_FRAME;
    const keep = s.xhist.times.findIndex((tt) => tt > t - XT);
    store.set({
      ls: q, t,
      trail: [...s.trail, q].slice(-TRAIL),
      xhist: { times: [...s.xhist.times.slice(keep), t], values: [...s.xhist.values.slice(keep), q[0]] },
      angle: s.angle + 0.012 * q[0] * DT * PER_FRAME * 10,
    });
    await new Promise(requestAnimationFrame);
  }
  trajRunning = false;
}

function renderMeet(s) {
  const regime = s.r < 1 ? 'r &lt; 1: everything falls into the origin'
    : s.r < 24.74 ? '1 &lt; r &lt; 24.74: the trajectory settles into C⁺ or C⁻ (it may wander for a while first)'
    : 'r &gt; 24.74: C⁺ and C⁻ are unstable too. Nothing to settle on: <strong>chaos</strong>';
  const q = s.ls.map((v) => v.toFixed(1)).join(', ');
  $('meet-read').innerHTML = `r = ${s.r.toFixed(2)} · ${regime}<br>state (x, y, z) = (${q})`;
  const crossings = s.xhist.values.reduce((n, v, i, a) => n + (i && Math.sign(v) !== Math.sign(a[i - 1]) ? 1 : 0), 0);
  $('wheel-read').innerHTML = `pour rate r = ${s.r.toFixed(2)} · ${crossings} reversal${crossings === 1 ? '' : 's'} in the last ${XT} time units`
    + (s.r > 24.74 ? ': irregular, and never quite repeating' : '');
}
store.subscribe((s, changed) => { if (changed.has('r') || changed.has('t')) renderMeet(s); });
renderMeet(store.get());

createPredict($('predict-never'), {
  question: 'At r = 28, one trajectory runs forever. It…',
  options: [
    { value: 'point', label: 'settles to a point' },
    { value: 'loop', label: 'settles into a repeating loop' },
    { value: 'never', label: 'never repeats, but stays in a bounded region' },
    { value: 'escape', label: 'escapes to infinity' },
  ],
  pressLabel: 'Run it',
  onPress: async () => {
    store.set({ r: 28 });
    restart([1, 1, 20]);
    $('meet').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(4000);
    return 'never';
  },
  explain: () => `<p>It never repeats and never settles, yet it never leaves the butterfly-shaped region either. It loops round one wing a few times,
    switches to the other, and the pattern of switches never repeats. A set like this is a <strong>strange attractor</strong>. All three fixed
    points are unstable (hollow rings), so there is nowhere to rest.</p>`,
});

createPredict($('predict-r20'), {
  question: 'Now turn the dial down to r = 20. The trajectory…',
  options: [
    { value: 'same', label: 'behaves just the same' },
    { value: 'settle', label: 'spirals into the centre of one wing' },
    { value: 'origin', label: 'falls into the origin' },
    { value: 'escape', label: 'escapes' },
  ],
  pressLabel: 'Set r = 20',
  onPress: async () => {
    store.set({ r: 20 });
    restart([9, 9, 24]);   // near one wing, so it settles within seconds (from far away it can wander for a long time)
    $('meet').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(6000);
    return 'settle';
  },
  explain: () => `<p>It spirals into C⁺ or C⁻, the centre of one wing, and stays there (after wandering for a while). For r below about 24.74 the wing
    centres are stable, and they turn unstable in a (subcritical) Hopf bifurcation from Chapter 7. As in Chapter 3, whether you see chaos
    depends on the dial.</p>`,
});

createPredict($('predict-wheel'), {
  question: 'Water pours steadily into the top of the wheel (r = 28). The wheel…',
  options: [
    { value: 'steady', label: 'spins steadily one way' },
    { value: 'stops', label: 'stops' },
    { value: 'rocks', label: 'rocks back and forth regularly' },
    { value: 'reverses', label: 'spins, then reverses at unpredictable moments' },
  ],
  pressLabel: 'Pour',
  onPress: async () => {
    store.set({ r: 28 });
    restart([1, 1, 20]);
    $('wheel').querySelector('.sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(6000);
    return 'reverses';
  },
  explain: () => `<p>It spins one way for a while, slows, reverses, spins the other way… and the number of turns between reversals never settles into
    a pattern. The spin plot is just <span class="tex">x(t)</span> from §8.1: each reversal is the trajectory switching wings. A real
    machine, with no randomness anywhere, whose behaviour can’t be forecast for long.</p>`,
});

// --- §8.3 ten thousand butterflies ---------------------------------------------------------------

// A point on the attractor to start the ball from: run for 20 time units and take where it ends up.
const ON_ATTRACTOR = (() => {
  let q = [1, 1, 20];
  for (let i = 0; i < 4000; i++) q = rk4((p) => lorenz.f(p, lorenz.params), q, 0.005);
  return q;
})();
const X = new Float64Array(3 * 10000);
let count = 10000;

function resetBall() {
  const s = store.get(), rad = 10 ** -s.ball;
  for (let i = 0; i < count; i++) {
    let u, v, w;
    do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; w = Math.random() * 2 - 1; } while (u * u + v * v + w * w > 1);
    X[3 * i] = ON_ATTRACTOR[0] + rad * u; X[3 * i + 1] = ON_ATTRACTOR[1] + rad * v; X[3 * i + 2] = ON_ATTRACTOR[2] + rad * w;
  }
  store.set({ ct: 0, spread: { times: [0], values: [spreadOf()] }, cloudTick: s.cloudTick + 1, cloudRunning: false });
}

function spreadOf() {
  let mx = 0, my = 0, mz = 0;
  for (let i = 0; i < count; i++) { mx += X[3 * i]; my += X[3 * i + 1]; mz += X[3 * i + 2]; }
  mx /= count; my /= count; mz /= count;
  let v = 0;
  for (let i = 0; i < count; i++) v += (X[3 * i] - mx) ** 2 + (X[3 * i + 1] - my) ** 2 + (X[3 * i + 2] - mz) ** 2;
  return Math.sqrt(v / count);
}

// RK4 for the Lorenz system written out on flat arrays: the same method as core/integrate.js, but with no
// temporary arrays, because it runs 10,000 times per step.
function stepCloud(dt, r) {
  const s = SIGMA, b = B, h = dt / 2;
  for (let i = 0; i < count; i++) {
    const x = X[3 * i], y = X[3 * i + 1], z = X[3 * i + 2];
    const k1x = s * (y - x), k1y = r * x - y - x * z, k1z = x * y - b * z;
    const x2 = x + h * k1x, y2 = y + h * k1y, z2 = z + h * k1z;
    const k2x = s * (y2 - x2), k2y = r * x2 - y2 - x2 * z2, k2z = x2 * y2 - b * z2;
    const x3 = x + h * k2x, y3 = y + h * k2y, z3 = z + h * k2z;
    const k3x = s * (y3 - x3), k3y = r * x3 - y3 - x3 * z3, k3z = x3 * y3 - b * z3;
    const x4 = x + dt * k3x, y4 = y + dt * k3y, z4 = z + dt * k3z;
    const k4x = s * (y4 - x4), k4y = r * x4 - y4 - x4 * z4, k4z = x4 * y4 - b * z4;
    X[3 * i] = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    X[3 * i + 1] = y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    X[3 * i + 2] = z + (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
  }
}

createScene3D($('space-cloud'), store, {
  select: (s) => ({ bounds: BOUNDS, cloud: { array: X, count: s.count }, markers: markers(s) }),
  yawKey: 'yaw', pitchKey: 'elev', zoomKey: 'zoom', label: 'A cloud of ten thousand points on the Lorenz attractor',
});

const CT = 20;
createTimeseries($('ts-spread'), store, {
  yScale: 'log', xLabel: 't', yLabel: 'spread of the cloud',
  select: (s) => {
    const s0 = s.spread.values[0] ?? 10 ** -s.ball;
    return {
      series: [{ values: s.spread.values, times: s.spread.times, role: 'main', dots: false }],
      nMax: CT, yRange: [1e-7, 60],
      refLine: { from: [0, s0], to: [CT, s0 * Math.exp(s.lam * CT)] },
    };
  },
});
createSlider($('ruler-controls'), store, { key: 'lam', label: 'ruler: growth rate per unit time', min: 0, max: 2, step: 0.01, ticks: [0, 0.906, 2], format: (v) => v.toFixed(2) });
createSlider($('cloud-controls'), store, { key: 'ball', label: 'ball size', min: 1, max: 6, step: 1, ticks: [1, 3, 6], format: (v) => `10⁻${'¹²³⁴⁵⁶'[v - 1]}` });
$('release').addEventListener('click', () => { store.set({ cloudRunning: true }); runCloud(); });
$('cloud-pause').addEventListener('click', () => store.set({ cloudRunning: false }));
$('cloud-reset').addEventListener('click', resetBall);
store.subscribe((s, changed) => { if (changed.has('ball')) resetBall(); });

let cloudVisible = false, cloudLoop = false, slowFrames = 0;
new IntersectionObserver(([e]) => { cloudVisible = e.isIntersecting; runCloud(); }).observe($('cloud-sim'));
async function runCloud() {
  if (cloudLoop) return;
  cloudLoop = true;
  while (cloudVisible && store.get().cloudRunning && store.get().ct < CT) {
    const s = store.get();
    const t0 = performance.now();
    for (let k = 0; k < 4; k++) stepCloud(0.01, s.r);
    const ct = s.ct + 0.04;
    // keep the page responsive: if stepping takes too long, halve the cloud (down to 2,500)
    slowFrames = performance.now() - t0 > 20 ? slowFrames + 1 : 0;
    if (slowFrames > 15 && count > 2500) { count = Math.floor(count / 2); slowFrames = 0; }
    store.set({
      ct, count, cloudTick: s.cloudTick + 1,
      spread: { times: [...s.spread.times, ct], values: [...s.spread.values, spreadOf()] },
    });
    await new Promise(requestAnimationFrame);
  }
  cloudLoop = false;
}

function measuredRate(sp) {
  const s0 = sp.values[0];
  const pts = sp.times.map((t, i) => [t, sp.values[i]]).filter(([, v]) => v > 3 * s0 && v < 1);
  if (pts.length < 8) return null;
  const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + Math.log(p[1]), 0);
  const sxx = pts.reduce((a, p) => a + p[0] ** 2, 0), sxy = pts.reduce((a, p) => a + p[0] * Math.log(p[1]), 0);
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}
function renderCloud(s) {
  const m = measuredRate(s.spread);
  const cur = s.spread.values.at(-1);
  $('cloud-read').innerHTML = `${s.count.toLocaleString()} points${s.count < 10000 ? ' (reduced to keep this device responsive)' : ''} · t = ${s.ct.toFixed(1)}`
    + ` · spread ${cur ? cur.toExponential(1) : '—'}<br>`
    + `ruler: spread × e<sup>${s.lam.toFixed(2)} t</sup>`
    + (m ? ` · measured growth rate ≈ <strong>${m.toFixed(2)}</strong> per unit time (the true largest Liapunov exponent is 0.906; a finite ball measures it roughly)` : '');
  $('cloud-pause').disabled = !s.cloudRunning;
}
store.subscribe((s, changed) => { if (changed.has('cloudTick') || changed.has('lam') || changed.has('cloudRunning')) renderCloud(s); });
resetBall();
renderCloud(store.get());

createPredict($('predict-cloud'), {
  question: 'Ten thousand points in a ball 10⁻³ across. After 15 time units the cloud will be…',
  options: [
    { value: 'ball', label: 'still a tiny ball' },
    { value: 'thread', label: 'stretched into a thin thread' },
    { value: 'smeared', label: 'smeared over the whole butterfly' },
    { value: 'point', label: 'collapsed to a point' },
  ],
  pressLabel: 'Release',
  onPress: async () => {
    store.set({ ball: 3 });
    resetBall();
    $('cloud-sim').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await sleep(400);
    store.set({ cloudRunning: true });
    runCloud();
    while (store.get().ct < 15 && store.get().cloudRunning) await sleep(200);
    return 'smeared';
  },
  explain: () => `<p>Smeared over the whole butterfly. First it stretches into a thread (exponential growth, a straight line on the log plot,
    like Chapter 2’s twins), then the thread folds over and over until the points are everywhere on the attractor. Line up the ruler with
    the straight part: that growth rate estimates the <strong>Liapunov exponent</strong>. Over a short stretch it depends on where the
    ball starts (you’ll typically measure somewhere between 0.5 and 1); averaged over the whole attractor it is 0.906 per time unit.
    Stretching and folding is how chaos works.</p>`,
});

// --- §8.4 the peak-to-peak map --------------------------------------------------------------------

function collectPeaks(n = 450) {
  const f = (q) => lorenz.f(q, lorenz.params);
  let q = ON_ATTRACTOR, a = q[2], bz = q[2];
  const peaks = [], zt = [], zv = [], mark = [];
  for (let i = 0; peaks.length < n && i < 200000; i++) {
    const nq = rk4(f, q, 0.01);
    if (bz > a && bz > nq[2] && i > 1) {
      peaks.push(bz);
      if (i < 3000 && zt.length) mark[zt.length - 1] = zv[zv.length - 1];   // mark it on the z(t) plot
    }
    if (i < 3000) { zt.push(i * 0.01); zv.push(nq[2]); mark.push(NaN); }
    a = bz; bz = nq[2]; q = nq;
  }
  return { peaks, zt, zv, mark };
}
const PK = collectPeaks();
const pairs = PK.peaks.slice(0, -1).map((z, i) => [z, PK.peaks[i + 1]]);
const zLo = Math.min(...PK.peaks) - 1, zHi = Math.max(...PK.peaks) + 1;

// fitted curve: average zₙ₊₁ in narrow bins of zₙ, joined by straight segments
const fitted = (() => {
  const nb = 36, w = (zHi - zLo) / nb, sums = Array(nb).fill(0), cnt = Array(nb).fill(0);
  for (const [a, b] of pairs) { const k = Math.min(nb - 1, Math.floor((a - zLo) / w)); sums[k] += b; cnt[k]++; }
  const knots = sums.map((s, k) => [zLo + (k + 0.5) * w, cnt[k] ? s / cnt[k] : NaN]).filter(([, v]) => Number.isFinite(v));
  return (z) => {
    if (z <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++) {
      if (z <= knots[i][0]) { const [x0, y0] = knots[i - 1], [x1, y1] = knots[i]; return y0 + ((z - x0) * (y1 - y0)) / (x1 - x0); }
    }
    return knots.at(-1)[1];
  };
})();
const zPeakIn = pairs.reduce((m, p) => (p[1] > m[1] ? p : m))[0];
const slopeFit = (sel) => {
  const n = sel.length, sx = sel.reduce((a, p) => a + p[0], 0), sy = sel.reduce((a, p) => a + p[1], 0);
  const sxx = sel.reduce((a, p) => a + p[0] ** 2, 0), sxy = sel.reduce((a, p) => a + p[0] * p[1], 0);
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
};
const SL = slopeFit(pairs.filter(([a]) => a < zPeakIn - 0.5)), SR = slopeFit(pairs.filter(([a]) => a > zPeakIn + 0.5));
const zTop = Math.max(...PK.peaks);
const tent = (z) => zTop - ((Math.abs(SL) + Math.abs(SR)) / 2) * Math.abs(z - zPeakIn);   // Ch 3's tent, scaled to fit

createTimeseries($('ts-z'), store, {
  xLabel: 't', yLabel: 'z(t)',
  select: () => ({
    series: [
      { values: PK.zv, times: PK.zt, role: 'main', dots: false },
      { values: PK.mark, times: PK.zt, role: 'main', style: 'twin', label: 'peaks' },
    ],
    nMax: 30, yRange: [0, 52],
  }),
});

const curveOf = (s) => (s.curve === 'tent' ? tent : s.curve === 'fit' ? fitted : null);
let peaksShown = false;
createCobweb($('web-peaks'), store, {
  select: (s) => {
    const f = curveOf(s);
    return {
      f, window: [zLo, zHi],
      points: peaksShown ? pairs : [],
      path: f ? orbit(f, s.pz, 30) : [],
      fixedPoints: f ? findFixedPoints(f, [zLo, zHi]) : [],
    };
  },
  seedKey: 'pz', seedRange: [zLo, zHi], label: 'Starting peak z₁',
  axisLabels: ['zₙ', 'zₙ₊₁'],
});
$('curve-choice').addEventListener('change', (e) => store.set({ curve: e.target.value }));

function renderMap(s) {
  $('curve-choice').querySelector(`input[value="${s.curve}"]`).checked = true;
  if (!peaksShown) { $('map-read').textContent = 'Make your prediction first.'; return; }
  const f = curveOf(s), fps = f ? findFixedPoints(f, [zLo, zHi]) : [];
  $('map-read').innerHTML = `${pairs.length} pairs of successive peaks<br>`
    + `left branch slope ≈ <strong>${SL.toFixed(2)}</strong>, right branch slope ≈ <strong>${SR.toFixed(2)}</strong><br>`
    + `|slope| &gt; 1 on both sides, so by Chapter 1’s rule every fixed point and cycle is hollow`
    + (fps.length ? `<br>fixed point of the ${s.curve === 'tent' ? 'tent' : 'fitted map'}: z* ≈ ${fps.at(-1).x.toFixed(2)}, slope ${fps.at(-1).slope.toFixed(2)} ${fps.at(-1).kind === 'unstable' ? '○' : '●'}` : '');
}
store.subscribe((s, changed) => { if (changed.has('curve') || changed.has('pz')) renderMap(s); });
renderMap(store.get());

createPredict($('predict-tent'), {
  question: 'Plot each peak of z against the next one, as points (zₙ, zₙ₊₁). The points will…',
  options: [
    { value: 'cloud', label: 'form a cloud' },
    { value: 'curve', label: 'lie on a thin curve' },
    { value: 'clusters', label: 'form a few clusters' },
    { value: 'line', label: 'lie on a straight line' },
  ],
  pressLabel: `Plot ${pairs.length} pairs`,
  onPress: async () => {
    peaksShown = true;
    store.set({ curve: 'none' });
    renderMap(store.get());
    $('web-peaks').scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500);
    return 'curve';
  },
  explain: () => `<p>A thin curve shaped like a <strong>tent</strong>. It’s the <strong>Lorenz map</strong>: the size of one peak (nearly) decides the next.
    The chaos of a three-dimensional flow is captured by a one-dimensional map, like the one you pressed on a calculator in Chapter 0.
    Choose <em>fitted curve</em> and drag the ▲: the cobweb never settles, because both branches are steeper than 1.</p>`,
});

if (location.hash === '#map') { peaksShown = true; renderMap(store.get()); }

initMathLayers();

// --- Strogatz lens ---------------------------------------------------------------------------------

renderLens($('lens'), {
  read: [
    { ref: '§9.0–9.1', note: 'The chaotic waterwheel and how its equations become Lorenz’s.' },
    { ref: '§9.2', note: 'Simple properties: volume contraction, the fixed points, and what happens at r = 1 and r ≈ 24.74.' },
    { ref: '§9.3', note: 'Chaos on a strange attractor: exponential divergence and the limit on prediction.' },
    { ref: '§9.4', note: 'The Lorenz map, and why it rules out stable limit cycles.' },
    { ref: '§9.5', note: 'Optional: exploring parameter space, with windows and transient chaos.' },
  ],
  notation: [
    ['σ, r, b', 'same', 'Prandtl number, Rayleigh number, geometric factor'],
    ['wing centres', '<span class="tex">C^+, C^-</span>', 'the two nontrivial fixed points'],
    ['the butterfly', 'strange attractor', 'bounded, never repeating, fractal'],
    ['growth rate of the cloud', 'Liapunov exponent <span class="tex">\\lambda \\approx 0.906</span>', 'a long-run average, per unit time (Chapter 2’s was per step)'],
    ['peak-to-peak map', 'Lorenz map <span class="tex">z_{n+1} = f(z_n)</span>', 'successive local maxima of z'],
    ['shrinking volumes', 'volume contraction', 'every blob of states shrinks in volume, even as it stretches'],
    ['wandering before settling', 'transient chaos', 'seen for some r below 24.74'],
  ],
  exercises: [
    {
      html: 'At r = 20, start the trajectory and watch it settle into one wing. Now raise r in small steps (Restart each time). At what r does it stop settling? Try lowering r from 28 instead. Do you get the same answer?',
      sim: '?r=20#meet',
    },
    {
      html: 'Release the ball, line up the ruler, and read off the growth rate. Using it, estimate how long a ball 10⁻⁶ across takes to spread over the whole attractor. Then set the ball size to 10⁻⁶ and check.',
      sim: '?ball=6#cloud',
    },
    {
      html: 'Measure the steepness of each branch of the Lorenz map (use the readout, or two points on the fitted curve). Using Chapter 1’s slope rule, explain why no cycle of the map, of any period, can be stable. Why does that force the peaks never to repeat?',
      sim: '?curve=fit#map',
    },
  ],
});
