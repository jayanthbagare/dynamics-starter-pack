import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePath, scoreValue } from './predict-score.js';
import { createProgress } from './progress.js';

test('scorePath compares each guessed jump with the true jump', () => {
  const truths = [-0.416, 0.915, 0.610];
  const r = scorePath([-0.4, 0.5, 0.62], truths, { tol: 0.1 });
  assert.deepEqual(r.steps.map((s) => s.hit), [true, false, true]);
  assert.equal(r.hits, 2);
  assert.equal(r.total, 3);
  assert.ok(Math.abs(r.score - 2 / 3) < 1e-12);
});

test('scorePath: guesses beyond the known truth never hit', () => {
  const r = scorePath([0.1, 0.2], [0.1], { tol: 0.1 });
  assert.deepEqual(r.steps.map((s) => s.hit), [true, false]);
});

test('scoreValue: the Keeper marker must land within 0.05 of |a| = 1', () => {
  assert.equal(scoreValue(1.04, 1, 0.05).hit, true);
  assert.equal(scoreValue(0.96, 1, 0.05).hit, true);
  assert.equal(scoreValue(1.06, 1, 0.05).hit, false);
  assert.equal(scoreValue(1.06, 1, 0.05).direction, 'high');
  assert.equal(scoreValue(0.9, 1, 0.05).direction, 'low');
  assert.equal(scoreValue(Math.abs(-1.03), 1, 0.05).hit, true);
});

test('progress works without storage and survives broken storage', () => {
  const mem = createProgress(null);
  mem.updateZone(1, { boss: true });
  assert.equal(mem.zone(1).boss, true);
  assert.equal(mem.persistent, false);

  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const p = createProgress(broken);
  p.updateZone(1, { challenges: { a: true } });
  assert.equal(p.zone(1).challenges.a, true);
  assert.equal(p.persistent, false);
});

test('progress round-trips through storage', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  createProgress(storage).updateZone(1, { chart: [{ symbol: 'harbour', at: [0.74] }] });
  assert.deepEqual(createProgress(storage).zone(1).chart, [{ symbol: 'harbour', at: [0.74] }]);
});
