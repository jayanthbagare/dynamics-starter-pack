// Chapter 5 · Bifurcations in 1D flows
// One store drives the sticky stage (3D landscape, phase line, controls) and the per-section views
// (bottleneck time series, hysteresis diagram). Balls are overdamped: ẋ = f(x; r), plus a little noise
// (about a thousandth), as in any real system. Without it a ball on a hilltop would stay there forever.

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { rk4 } from '../../core/integrate.js';
import { findZeros } from '../../core/fixedpoints.js';
import { saddleNode } from '../../systems/saddle-node.js';
import { transcritical } from '../../systems/transcritical.js';
import { pitchfork } from '../../systems/pitchfork.js';
import { subcritical } from '../../systems/subcritical.js';
import { createLandscape } from '../../views/landscape.js';
import { createVectorField1D } from '../../views/vectorfield1d.js';
import { createTimeseries } from '../../views/timeseries.js';
import { createBifurcation } from '../../views/bifurcation.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';

mountLayout({ chapter: 5 });

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const forms = {
  saddle: { sys: saddleNode,    label: 'saddle-node',   x: [-1.6, 1.6], r: [-1, 1] },
  trans:  { sys: transcritical, label: 'transcritical', x: [-1.5, 1.5], r: [-1, 1] },
  pitch:  { sys: pitchfork,     label: 'pitchfork',     x: [-1.6, 1.6], r: [-1, 1] },
  sub:    { sys: subcritical,   label: 'subcritical',   x: [-1.4, 1.4], r: [-0.4, 0.4] },
};

const store = createStore(
  {
    form: 'pitch', r: 0.5, tilt: 0,
    balls: [0.001],                 // ball positions (the first one is tracked)
    trail: { times: [0], values: [0.001] }, // first ball's x(t), for the bottleneck
    trace: [],                      // [r, x] history of the first ball, for hysteresis
    yaw: 0.55, elev: 0.5,           // camera angles
    blo: -0.4, bhi: 0.4, bxlo: -1.4, bxhi: 1.4, btool: 'pick',  // hysteresis diagram window
  },
  { urlKeys: ['form', 'r', 'tilt', 'yaw', 'elev'] },
);

const cfg = (s) => forms[s.form] ?? forms.pitch;
const fOf = (s) => (x, r = s.r) => cfg(s).sys.f(x, { r, h: s.tilt });
const VOf = (s) => (x, r = s.r) => cfg(s).sys.V(x, { r, h: s.tilt });

// --- ball dynamics: a small loop that runs while anything is moving -----------------------

const DT = 0.01, SUB = 8, SUB_SWEEP = 300, NOISE = 1e-3;
let sweep = 0;          // +1 sweeping up, -1 down, 0 still
let sweepTarget = null;
let running = false;

function kick() { if (!running) loop(); }

async function loop() {
  running = true;
  while (true) {
    const s = store.get();
    const c = cfg(s);
    let r = s.r;
    if (sweep) {
      const end = sweepTarget ?? (sweep > 0 ? c.r[1] : c.r[0]);
      r = sweep > 0 ? Math.min(end, r + 0.003) : Math.max(end, r - 0.003);
      if (r === end) { sweep = 0; sweepTarget = null; }
    }
    const f = (x) => c.sys.f(x, { r, h: s.tilt });
    // resting = no speed, and downhill on both sides (a stable spot). A ball on a hilltop keeps going: noise will move it.
    // (the threshold sits above the noise, or a jittering ball would never count as resting)
    const resting = (x) => Math.abs(f(x)) < 1e-3 && f(x + 1e-4) - f(x - 1e-4) <= 0;
    // while sweeping, let the ball relax at each r (a slow, experiment-like sweep)
    const steps = sweep ? SUB_SWEEP : SUB;
    let moving = !!sweep;
    const balls = s.balls.map((x) => {
      if (!Number.isFinite(x) || Math.abs(x) > 20) return x;
      let y = x;
      for (let i = 0; i < steps; i++) y = rk4(f, y, DT) + NOISE * Math.sqrt(DT) * (Math.random() - 0.5);
      if (!resting(y)) moving = true;
      return y;
    });
    const b = balls[0];
    const t = s.trail.times.at(-1) + DT * steps;
    const patch = { balls };
    if (r !== s.r) patch.r = +r.toFixed(4);
    if (moving && Number.isFinite(b) && t <= 60) patch.trail = { times: [...s.trail.times, t], values: [...s.trail.values, b] };
    if (Number.isFinite(b) && Math.abs(b) < 5 && (sweep || s.trace.length)) patch.trace = [...s.trace, [r, b]].slice(-4000);
    store.set(patch);
    if (!moving) break;
    await new Promise(requestAnimationFrame);
  }
  running = false;
}

function setup(patch) {
  sweep = 0; sweepTarget = null;
  const s = store.get();
  const form = patch.form ?? s.form;
  const c = forms[form];
  const x0 = patch.balls?.[0] ?? s.balls[0];
  store.set({
    tilt: 0, trace: [], ...patch,
    trail: { times: [0], values: [x0] },
    blo: c.r[0], bhi: c.r[1], bxlo: c.x[0], bxhi: c.x[1],
  });
  kick();
}

async function sweepTo(target) {
  sweep = Math.sign(target - store.get().r);
  sweepTarget = target;
  kick();
  while (sweep) await sleep(50);
  await sleep(600); // let the ball settle
}

// --- the stage: 3D landscape, phase line, controls ------------------------------------------

createLandscape($('land'), store, {
  select: (s) => ({
    key: `${s.form}:${s.tilt}`,
    V: (x, r) => VOf(s)(x, r), f: (x, r) => fOf(s)(x, r),
    xRange: cfg(s).x, rRange: cfg(s).r, r: s.r, balls: s.balls,
  }),
  yawKey: 'yaw', pitchKey: 'elev',
  label: 'Landscape V(x; r) for every r, with the current slice and the ball',
});

createVectorField1D($('line'), store, {
  select: (s) => {
    const [x0, x1] = cfg(s).x;
    const f = fOf(s);
    const ymax = Math.max(0.2, ...Array.from({ length: 50 }, (_, i) => Math.abs(f(x0 + (i / 49) * (x1 - x0)))));
    return { f, xRange: cfg(s).x, yRange: [-Math.min(ymax, 2), Math.min(ymax, 2)], particles: s.balls };
  },
  onAxis: (x) => {
    const s = store.get();
    store.set({ balls: [...s.balls, +x.toFixed(3)].slice(-6) });
    kick();
  },
  label: 'Phase line at the current r. Click to drop a ball.',
});

const formChoice = $('form-choice');
formChoice.innerHTML = Object.entries(forms).map(([k, f]) =>
  `<label><input type="radio" name="form" value="${k}"><span>${f.label}</span></label>`).join('');
formChoice.addEventListener('change', (e) => {
  const form = e.target.value;
  const c = forms[form];
  setup({ form, r: c.r[0] / 2, balls: [form === 'saddle' ? -Math.sqrt(-c.r[0] / 2) : 0.001] });
});

createSlider($('stage-sliders'), store, {
  key: 'r', label: 'dial r', step: 0.001, min: (s) => cfg(s).r[0], max: (s) => cfg(s).r[1],
  ticks: [0], format: (v) => v.toFixed(3),
});
const tiltSlider = createSlider($('stage-sliders'), store, {
  key: 'tilt', label: 'tilt h', min: -0.2, max: 0.2, step: 0.005, ticks: [0], format: (v) => v.toFixed(3),
});
store.subscribe((s, changed) => { if (changed.has('r') || changed.has('tilt')) kick(); });

$('sweep-up').addEventListener('click', () => { sweep = 1; sweepTarget = null; if (!store.get().trace.length) store.set({ trace: [[store.get().r, store.get().balls[0]]] }); kick(); });
$('sweep-down').addEventListener('click', () => { sweep = -1; sweepTarget = null; if (!store.get().trace.length) store.set({ trace: [[store.get().r, store.get().balls[0]]] }); kick(); });
$('stop').addEventListener('click', () => { sweep = 0; sweepTarget = null; });
$('reset-ball').addEventListener('click', () => setup({ balls: [0.001] }));

function renderStage(s) {
  formChoice.querySelector(`input[value="${s.form}"]`).checked = true;
  tiltSlider.input.closest('.slider').hidden = s.form !== 'pitch';
  const zs = findZeros(fOf(s), cfg(s).x);
  const sym = { stable: '●', unstable: '○', half: '◐' };
  const b = s.balls[0];
  const where = !Number.isFinite(b) || Math.abs(b) > cfg(s).x[1] ? 'rolled away, off the edge' : `x = ${b.toFixed(3)}`;
  $('stage-read').innerHTML = `${cfg(s).label} · r = ${s.r.toFixed(3)}${s.form === 'pitch' ? ` · h = ${s.tilt.toFixed(3)}` : ''}<br>`
    + `fixed points: ${zs.length ? zs.map((z) => `${sym[z.kind]} ${z.x.toFixed(3)}`).join('  ') : 'none'}<br>ball: ${where}`;
}
store.subscribe(renderStage);
renderStage(store.get());
kick(); // let the ball settle wherever the page (or a link) put it

// --- §5.1 landscapes -----------------------------------------------------------------------

createPredict($('predict-hill'), {
  question: 'A ball balances on a hilltop. Nudge it by 0.001. It…',
  options: [
    { value: 'stays', label: 'stays on top' },
    { value: 'returns', label: 'wobbles and comes back' },
    { value: 'valley', label: 'rolls into a valley and stops' },
  ],
  pressLabel: 'Nudge it',
  onPress: async () => {
    setup({ form: 'pitch', r: 0.5, balls: [0] });
    await sleep(500);
    store.set({ balls: [0.001] });
    kick();
    await sleep(2500);
    return 'valley';
  },
  explain: () => `<p>It rolls into the valley on the side it was nudged towards and stops there. No overshoot,
    no wobble: in this sticky world the ball only ever goes downhill (Chapter 4’s “never oscillates”). A hilltop
    is a hollow dot, and a valley floor is a filled one.</p>`,
});

// --- §5.2 saddle-node and the bottleneck ------------------------------------------------------

createPredict($('predict-saddle'), {
  question: 'A ball rests in the valley at r = −0.3. Now r rises past 0. The ball…',
  options: [
    { value: 'stays', label: 'stays where it is' },
    { value: 'away', label: 'rolls away' },
    { value: 'jumps', label: 'jumps to another valley' },
    { value: 'wobbles', label: 'wobbles' },
  ],
  pressLabel: 'Raise r to 0.2',
  onPress: async () => {
    setup({ form: 'saddle', r: -0.3, balls: [-Math.sqrt(0.3)] });
    await sleep(600);
    await sweepTo(0.2);
    return 'away';
  },
  explain: () => `<p>It rolls away. The valley holding it merged with the hill at r = 0 (the dot was half-filled for
    an instant) and then vanished. With no valley left, nothing stops the ball. There’s nothing gentle about it:
    a fixed point that existed a moment ago simply isn’t there any more.</p>`,
});

createTimeseries($('ts-ball'), store, {
  xLabel: 't', yLabel: 'x(t)',
  select: (s) => ({
    series: [{ values: s.trail.values, times: s.trail.times, role: 'main', dots: false }],
    nMax: Math.max(10, Math.min(60, Math.ceil(s.trail.times.at(-1) / 10) * 10)),
    yRange: cfg(s).x,
  }),
});

async function bottleneck(r) {
  setup({ form: 'saddle', r, balls: [-1.5] });
  $('bottleneck-read').textContent = 'Watching…';
  const start = performance.now();
  while (performance.now() - start < 30000) {
    const s = store.get();
    const i1 = s.trail.values.findIndex((x) => x > -1), i2 = s.trail.values.findIndex((x) => x > 1);
    if (i2 >= 0) {
      const T = s.trail.times[i2] - s.trail.times[i1];
      const theory = (2 / Math.sqrt(r)) * Math.atan(1 / Math.sqrt(r));
      $('bottleneck-read').innerHTML = `r = ${r}: from x = −1 to x = 1 took <strong>${T.toFixed(1)}</strong> time units `
        + `(theory ${theory.toFixed(1)}; for small r it’s about π/√r = ${(Math.PI / Math.sqrt(r)).toFixed(1)}).`;
      return;
    }
    await sleep(100);
  }
}
$('bottleneck-01').addEventListener('click', () => bottleneck(0.01));
$('bottleneck-04').addEventListener('click', () => bottleneck(0.04));

// --- §5.3 transcritical ----------------------------------------------------------------------

createPredict($('predict-trans'), {
  question: 'The ball sits at x = 0 while r goes from −0.5 to +0.5. It…',
  options: [
    { value: 'stays', label: 'stays at 0' },
    { value: 'slides', label: 'slides over to the other fixed point' },
    { value: 'away', label: 'rolls off to infinity' },
  ],
  pressLabel: 'Sweep r up',
  onPress: async () => {
    setup({ form: 'trans', r: -0.5, balls: [0] });
    await sleep(600);
    await sweepTo(0.5);
    return 'slides';
  },
  explain: () => `<p>At r = 0 the two fixed points pass through each other and <strong>swap stability</strong>: 0 goes
    hollow, and the one at x = r becomes filled. The ball follows the new valley, smoothly and without a jump. On the
    floor of the 3D view, two branches cross in an X, each solid on one side and dotted on the other.</p>`,
});

// --- §5.4 pitchfork ----------------------------------------------------------------------------

createPredict($('predict-pitch'), {
  question: 'The ball sits at x = 0 as r rises past 0 and one valley becomes two. Which way does it roll?',
  options: [
    { value: 'left', label: 'left' },
    { value: 'right', label: 'right' },
    { value: 'stays', label: 'it stays at 0' },
    { value: 'cant', label: 'you can’t tell in advance' },
  ],
  pressLabel: 'Sweep r up',
  onPress: async () => {
    setup({ form: 'pitch', r: -0.5, balls: [0] });
    await sleep(600);
    await sweepTo(0.6);
    return 'cant';
  },
  explain: () => {
    const b = store.get().balls[0];
    return `<p>This time it went <strong>${b > 0 ? 'right' : 'left'}</strong>, but that was decided by a little noise,
      about a thousandth in size, that the sim adds to every step (like any real system). Press <em>Try again</em> and it may go the
      other way. The rule is perfectly symmetric, so the choice comes from outside it: <strong>symmetry breaking</strong>,
      with Chapter 2’s butterfly deciding.</p>`;
  },
});

// --- §5.5 hysteresis ---------------------------------------------------------------------------

const bif = createBifurcation($('branches'), store, {
  select: (s) => ({ mode: 'branches', key: `${s.form}:${s.tilt}`, f: (x, r) => fOf(s)(x, r), trace: s.trace }),
  paramKey: 'r', windowKeys: ['blo', 'bhi', 'bxlo', 'bxhi'], home: [-0.4, 0.4, -1.4, 1.4], toolKey: 'btool',
  label: 'Dial r', yLabel: 'x*',
});
$('clear-trace').addEventListener('click', () => store.set({ trace: [] }));

createPredict($('predict-hyst'), {
  question: 'Sweep r up past 0 so the ball jumps out. Then bring r back down to exactly 0. Where’s the ball?',
  options: [
    { value: 'zero', label: 'back at 0' },
    { value: 'outer', label: 'still out on the far branch' },
    { value: 'wobble', label: 'oscillating between them' },
  ],
  pressLabel: 'Sweep up, then back to 0',
  onPress: async () => {
    setup({ form: 'sub', r: -0.3, balls: [0.001], trace: [[-0.3, 0.001]] });
    $('branches').scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(600);
    await sweepTo(0.3);
    await sweepTo(0);
    return Math.abs(store.get().balls[0]) > 0.5 ? 'outer' : 'zero';
  },
  explain: () => `<p>Still out on the far branch. Same r, different state: which one you get depends on where you came
    from. That’s <strong>hysteresis</strong>. (The jump out came a little after r = 0, not exactly at it: the ball needs a
    moment for the noise to push it off the hilltop, which is also true in real experiments.) Keep sweeping down, and the ball only falls back to 0 at
    r = −1/4, where the outer valley vanishes in a saddle-node. The loop on the diagram is the system’s memory.</p>`,
});

initMathLayers();

// --- Strogatz lens ----------------------------------------------------------------------------------

renderLens($('lens'), {
  read: [
    { ref: '§2.7', note: 'Potentials: the landscape picture, f = −dV/dx.' },
    { ref: '§3.0–3.1', note: 'Saddle-node bifurcations (and the ghost that remains after one).' },
    { ref: '§3.2', note: 'Transcritical bifurcations.' },
    { ref: '§3.4', note: 'Pitchfork bifurcations, supercritical and subcritical, including hysteresis.' },
    { ref: '§3.6', note: 'Imperfect bifurcations: what the tilt slider shows.' },
    { ref: '§3.3, §3.5', note: 'Optional applications: a laser threshold, and a bead on a rotating hoop.' },
  ],
  notation: [
    ['dial <span class="tex">r</span>', 'bifurcation parameter <span class="tex">r</span>', 'the knob being turned'],
    ['landscape height', 'potential <span class="tex">V(x)</span>', '<span class="tex">\\dot x = -dV/dx</span>'],
    ['the four forms', 'normal forms', 'the simplest equation for each kind of bifurcation'],
    ['floor of the 3D view', 'bifurcation diagram', 'solid = stable, dashed = unstable'],
    ['ghost, bottleneck', 'ghost, bottleneck', 'slow passage after a saddle-node; time ∝ <span class="tex">1/\\sqrt r</span>'],
    ['tilt <span class="tex">h</span>', 'imperfection parameter <span class="tex">h</span>', 'breaks the pitchfork’s symmetry'],
    ['the loop', 'hysteresis', 'the state depends on history'],
  ],
  exercises: [
    {
      html: 'Release the ball at r = 0.01, then at r = 0.04 (buttons in the saddle-node section). The bottleneck time should scale like <span class="tex">1/\\sqrt r</span>. Does quadrupling r halve the time? Predict r = 0.0025 before trying it with the slider.',
      sim: '?form=saddle#saddle',
    },
    {
      html: 'Set a small tilt (say h = 0.05) on the pitchfork, and sweep r up and down with the ball starting on the <em>left</em>. Is there still a jump? Where does the right-hand valley come from, and where does it go?',
      sim: '?form=pitch&tilt=0.05#pitchfork',
    },
    {
      html: 'In the subcritical form, sweep up until the ball jumps, then sweep down but press Stop at r = −0.2. Sweep up again. Does the ball jump? Use the diagram to explain what the width of the loop means.',
      sim: '?form=sub&r=-0.3#hysteresis',
    },
  ],
});
