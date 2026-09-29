import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeChart, chartTruth, symbolFor } from './chart-grading.js';
import { findFixedPoints1D } from '../sim/maps.js';

const cosTruth = chartTruth(findFixedPoints1D((x) => Math.cos(x), [-Math.PI, Math.PI]));
const XSTAR = 0.7390851332151607;
const linearTruth = (a) => chartTruth(findFixedPoints1D((x) => XSTAR + a * (x - XSTAR), [-Math.PI, Math.PI]));

test('truth for cos is one harbour at x*', () => {
  assert.equal(cosTruth.length, 1);
  assert.equal(cosTruth[0].symbol, 'harbour');
  assert.ok(Math.abs(cosTruth[0].at[0] - XSTAR) < 1e-9);
});

test('accepts a correct chart', () => {
  const r = gradeChart([{ symbol: 'harbour', at: [0.74] }], cosTruth, { tol: 0.08 });
  assert.equal(r.ok, true);
  assert.equal(r.placed[0].status, 'correct');
  assert.deepEqual(r.missing, []);
});

test('rejects a misplaced symbol', () => {
  const r = gradeChart([{ symbol: 'harbour', at: [1.2] }], cosTruth, { tol: 0.08 });
  assert.equal(r.ok, false);
  assert.equal(r.placed[0].status, 'misplaced');
  assert.equal(r.missing.length, 1);
});

test('rejects a wrongly typed symbol in the right place', () => {
  for (const symbol of ['fountain', 'half-harbour', 'whirlpool']) {
    const r = gradeChart([{ symbol, at: [0.739] }], cosTruth, { tol: 0.08 });
    assert.equal(r.ok, false, symbol);
    assert.equal(r.placed[0].status, 'wrong-symbol');
    assert.equal(r.placed[0].expected, 'harbour');
  }
});

test('rejects an empty chart and an extra symbol', () => {
  assert.equal(gradeChart([], cosTruth).ok, false);
  const r = gradeChart([{ symbol: 'harbour', at: [0.74] }, { symbol: 'harbour', at: [-2] }], cosTruth, { tol: 0.08 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.placed.map((p) => p.status), ['correct', 'misplaced']);
});

test('two symbols cannot both claim the same fixed point', () => {
  const r = gradeChart([{ symbol: 'harbour', at: [0.73] }, { symbol: 'harbour', at: [0.75] }], cosTruth, { tol: 0.08 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.placed.map((p) => p.status), ['correct', 'misplaced']);
});

test('the Keeper: harbour, half-harbour and fountain follow |a|', () => {
  assert.equal(linearTruth(0.5)[0].symbol, 'harbour');
  assert.equal(linearTruth(-0.5)[0].symbol, 'harbour');
  assert.equal(linearTruth(-1)[0].symbol, 'half-harbour');
  assert.equal(linearTruth(1.2)[0].symbol, 'fountain');
  assert.equal(linearTruth(-1.2)[0].symbol, 'fountain');
  assert.equal(gradeChart([{ symbol: 'harbour', at: [XSTAR] }], linearTruth(1.2)).ok, false);
  assert.equal(gradeChart([{ symbol: 'fountain', at: [XSTAR] }], linearTruth(1.2)).ok, true);
});

test('plane positions and named symbols are supported', () => {
  const truth = chartTruth([{ x: 0, y: 0, symbol: 'crossing' }]);
  assert.deepEqual(truth, [{ symbol: 'crossing', at: [0, 0] }]);
  assert.equal(gradeChart([{ symbol: 'crossing', at: [0.03, -0.04] }], truth, { tol: 0.1 }).ok, true);
  assert.equal(symbolFor({ kind: 'half' }), 'half-harbour');
});
