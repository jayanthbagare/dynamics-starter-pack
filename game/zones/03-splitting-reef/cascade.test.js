import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logistic, sineMap, findSplits, gapRatios, attractor, periodOf, DELTA, mimicTolerance } from './cascade.js';
import { createHump, sanitize, PRESETS, monotoneSpline } from './hump.js';
import { scoreValue } from '../../pedagogy/predict-score.js';

const REF = [3, 3.4495, 3.5441, 3.5644];

test('logistic split points match 3, 3.4495, 3.5441, 3.5644 within 1e-3', () => {
  const s = findSplits(logistic, 0.5, 4, [1, 4]);
  assert.equal(s.length, 4);
  s.forEach((r, i) => assert.ok(Math.abs(r - REF[i]) < 1e-3, `r${i + 1} = ${r}`));
  assert.ok(Math.abs(s[1] - (1 + Math.sqrt(6))) < 1e-6);
});

test('logistic gap ratios head for δ = 4.669', () => {
  const r = gapRatios(findSplits(logistic, 0.5, 6, [1, 4]));
  assert.ok(Math.abs(r.at(-1) - DELTA) < 0.01, `last ratio ${r.at(-1)}`);
});

test('sine map r·sin(πx): the ratio of split gaps is between 4.5 and 4.8', () => {
  const s = findSplits(sineMap, 0.5, 4, [0.3, 1]);
  const [first, second] = gapRatios(s);
  // the very first ratio (4.47) comes before the cascade has settled; r2–r4 give 4.70
  assert.ok(second > 4.5 && second < 4.8, `ratio from r2..r4 = ${second} (first was ${first})`);
});

test('periods along the logistic tide: 1, 2, 4, 8, chaos, and the period-3 window', () => {
  const p = (r) => periodOf(attractor(logistic, r));
  assert.deepEqual([2.9, 3.2, 3.5, 3.56].map(p), [1, 2, 4, 8]);
  assert.equal(p(3.7), 'chaos');
  assert.equal(p(1 + Math.sqrt(8) + 0.003), 3);
});

// --- the Mimic's reef ----------------------------------------------------------------------------

function localMaxima(h, n = 20000) {
  const out = [];
  for (let i = 1; i < n; i++) {
    const a = h((i - 1) / n), b = h(i / n), c = h((i + 1) / n);
    if (b > a && b >= c) out.push(i / n);
  }
  return out;
}
const curvatureAt = (h, c, e = 1e-4) => (h(c + e) - 2 * h(c) + h(c - e)) / (e * e);

function randomSpec(rand) {
  const peak = 0.1 + 0.8 * rand();
  const pts = (n) => Array.from({ length: n }, () => [rand(), rand()]);
  return { peak, left: pts(3), right: pts(3) };
}
function mulberry32(a) {
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('the spline constraint: one maximum, quadratic, [0,1] into [0,1], for any handles', () => {
  const rand = mulberry32(99);
  const specs = [...Object.values(PRESETS), ...Array.from({ length: 200 }, () => randomSpec(rand)),
    // adversarial: handles piled on top of each other, heights reversed, points outside the box
    { peak: 0.5, left: [[0.4, 0.99], [0.4, 0.99], [0.4, 0.99]], right: [[0.6, 0.01], [0.6, 0.01], [0.6, 0.01]] },
    { peak: 0.05, left: [[0.9, 0.1], [0.5, 0.9], [-1, 2]], right: [[0.1, 0.9], [2, -1], [0.5, 0.5]] },
    { peak: 0.95, left: [[0.2, 0.2], [0.3, 0.1], [0.4, 0.05]], right: [[0.99, 0.99], [0.97, 0.98], [0.96, 0.97]] }];
  for (const spec of specs) {
    const reef = createHump(spec);
    const maxima = localMaxima(reef.h);
    assert.equal(maxima.length, 1, `maxima at ${maxima} for ${JSON.stringify(spec)}`);
    assert.ok(Math.abs(maxima[0] - reef.c) < 1e-3);
    assert.ok(Math.abs(reef.h(reef.c) - 1) < 1e-12);
    assert.ok(curvatureAt(reef.h, reef.c) < -0.1, 'quadratic top: h″(c) < 0');
    assert.equal(reef.h(0), 0); assert.equal(reef.h(1), 0);
    for (let i = 0; i <= 1000; i++) { const v = reef.h(i / 1000); assert.ok(v >= 0 && v <= 1); }
  }
});

test('sanitize keeps flanks strictly monotone towards the peak', () => {
  const p = sanitize({ peak: 0.5, left: [[0.3, 0.9], [0.1, 0.95]], right: [[0.7, 0.2], [0.9, 0.8]] });
  assert.ok(p.left[0][0] < p.left[1][0] && p.left[0][1] < p.left[1][1]);
  assert.ok(p.right[0][0] < p.right[1][0] && p.right[0][1] > p.right[1][1]);
});

test('monotone spline never overshoots its data', () => {
  const s = monotoneSpline([0, 0.1, 0.5, 0.52, 1], [-1, -0.9, 0, 0.9, 1]);
  let prev = -Infinity;
  for (let i = 0; i <= 1000; i++) { const v = s.f(i / 1000); assert.ok(v >= prev - 1e-12 && v >= -1 && v <= 1); prev = v; }
});

test('the Mimic: split points of a drawn reef, and predicting the 4th with δ wins (within 2%)', () => {
  for (const spec of Object.values(PRESETS)) {
    const reef = createHump(spec);
    const s = findSplits((x, m) => m * reef.h(x), reef.c, 4, [0.1, 1]);
    assert.equal(s.length, 4);
    assert.ok(s[3] < 1);
    const pred = s[2] + (s[2] - s[1]) / DELTA;
    assert.equal(scoreValue(pred, s[3], mimicTolerance(s[3])).hit, true);
    assert.equal(scoreValue(s[3] * 1.03, s[3], mimicTolerance(s[3])).hit, false);
  }
});
