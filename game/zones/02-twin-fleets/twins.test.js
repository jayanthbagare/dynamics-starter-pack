import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pairStats, flashesToSeparate, gapSeries, longOrbit, histogram, chiSquare, binProbabilities,
  judgeBand, invariantDensity, cloudAt,
} from './twins.js';

test('twins 1e-7 apart: median flashes until the gap exceeds 0.1 is between 18 and 28 (1000 seeds)', () => {
  const { median, flashes } = pairStats(1e-7, 1000, 2024);
  assert.equal(flashes.length, 1000);
  assert.ok(median >= 18 && median <= 28, `median ${median}`);
});

test('shrinking the starting gap 1000× buys about 10 more flashes', () => {
  const a = pairStats(1e-7, 500, 11).median, b = pairStats(1e-10, 500, 11).median;
  assert.ok(b - a >= 8 && b - a <= 12, `${a} → ${b}`);
});

test('the gap roughly doubles each flash before it saturates', () => {
  const g = gapSeries(0.3, 1e-7, 30);
  const k = flashesToSeparate(0.3, 1e-7, 0.1);
  const rate = Math.log(g[k - 3] / g[0]) / (k - 3);   // mean growth per flash, well before saturation
  assert.ok(Math.abs(rate - Math.LN2) < 0.25, `rate ${rate}`);
  assert.ok(g.every((v) => v <= 1));
});

test('a long orbit matches the invariant density 1/(π√(x(1−x))) (chi-square)', () => {
  const bins = 50;
  const { stat, df } = chiSquare(histogram(longOrbit(200000), bins), binProbabilities(bins));
  // 0.1% critical value of χ² with 49 degrees of freedom is about 85.4
  assert.equal(df, 49);
  assert.ok(stat < 85.4, `χ² = ${stat}`);
});

test('exact bin probabilities sum to 1 and agree with the density', () => {
  const p = binProbabilities(20);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(Math.abs(p[10] - invariantDensity(0.525) / 20) < 1e-3);
  assert.ok(p[0] > 4 * p[10]);
});

test('the Oracle: a flat band fails, a rough U passes, edges are noticed', () => {
  const flat = new Array(20).fill(1);
  const rough = [5, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 5];
  const hump = Array.from({ length: 20 }, (_, i) => Math.exp(-((i - 9.5) ** 2) / 20));
  const edgesOnly = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  assert.deepEqual([judgeBand(flat).pass, judgeBand(flat).edgesHeavy], [false, false]);
  assert.deepEqual([judgeBand(rough).pass, judgeBand(rough).edgesHeavy], [true, true]);
  assert.equal(judgeBand(hump).pass, false);
  assert.equal(judgeBand(edgesOnly).pass, false);
  assert.equal(judgeBand(edgesOnly).edgesHeavy, true);
  assert.equal(judgeBand(new Array(20).fill(0)).pass, false);
});

test('a fleet started within 1e-7 of one point is spread over the whole lane by flash 60', () => {
  const cloud = cloudAt(0.3, 1e-7, 4000, 60);
  const { stat } = chiSquare(histogram(cloud, 20), binProbabilities(20));
  assert.ok(stat < 45, `χ² = ${stat}`);   // 0.1% critical value, 19 degrees of freedom: 43.8 (loose bound)
});
