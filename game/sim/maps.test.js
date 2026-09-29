import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iterate, findFixedPoints1D, classifySlope, slopeAt } from './maps.js';

const XSTAR = 0.7390851332151607;
const cos = (x) => Math.cos(x);
const linear = (x, { a, xs }) => xs + a * (x - xs);

test('cos iteration converges to 0.739085 within 1e-6 from starts across the lane', () => {
  for (const x0 of [-Math.PI, -2, -0.5, 0, 0.739, 1, 2, 3, Math.PI]) {
    const xs = iterate(cos, x0, 100);
    assert.ok(Math.abs(xs.at(-1) - 0.739085) < 1e-6, `start ${x0} ended at ${xs.at(-1)}`);
  }
});

test('iterate returns the start followed by n steps', () => {
  const xs = iterate(cos, 2, 3);
  assert.equal(xs.length, 4);
  assert.equal(xs[0], 2);
  assert.equal(xs[1], Math.cos(2));
  assert.equal(xs[3], Math.cos(Math.cos(Math.cos(2))));
});

test('cos on [-π, π] has exactly one fixed point: stable and alternating', () => {
  const fps = findFixedPoints1D(cos, [-Math.PI, Math.PI]);
  assert.equal(fps.length, 1);
  assert.ok(Math.abs(fps[0].x - XSTAR) < 1e-9);
  assert.ok(Math.abs(fps[0].slope - -Math.sin(XSTAR)) < 1e-6);
  assert.equal(fps[0].kind, 'stable');
  assert.equal(fps[0].alternates, true);
});

test('classifySlope follows |slope| < 1', () => {
  assert.equal(classifySlope(0), 'stable');
  assert.equal(classifySlope(-0.99), 'stable');
  assert.equal(classifySlope(1.01), 'unstable');
  assert.equal(classifySlope(-1.3), 'unstable');
  assert.equal(classifySlope(1), 'half');
  assert.equal(classifySlope(-1), 'half');
});

test('linear map x* + a(x − x*): fixed point and stability across a', () => {
  const as = [];
  for (let a = -1.3; a <= 1.3 + 1e-9; a += 0.05) as.push(+a.toFixed(2));
  for (const a of as) {
    const fps = findFixedPoints1D(linear, [-Math.PI, Math.PI], { a, xs: XSTAR });
    if (a === 1) { // every point is fixed: no isolated fixed point to classify
      assert.deepEqual(fps, []);
      continue;
    }
    assert.equal(fps.length, 1, `a = ${a}`);
    assert.ok(Math.abs(fps[0].x - XSTAR) < 1e-9, `a = ${a}: x* = ${fps[0].x}`);
    assert.ok(Math.abs(fps[0].slope - a) < 1e-6, `a = ${a}: slope ${fps[0].slope}`);
    const expected = Math.abs(a) === 1 ? 'half' : Math.abs(a) < 1 ? 'stable' : 'unstable';
    assert.equal(fps[0].kind, expected, `a = ${a}`);
    assert.equal(fps[0].alternates, a < 0, `a = ${a}`);
  }
});

test('linear map orbits: docked for |a| < 1, adrift for |a| > 1', () => {
  for (const a of [0.3, 0.9, -0.3, -0.9]) {
    const xs = iterate(linear, XSTAR + 0.3, 200, { a, xs: XSTAR });
    assert.ok(Math.abs(xs.at(-1) - XSTAR) < 1e-6, `a = ${a}`);
  }
  for (const a of [1.1, 1.3, -1.1, -1.3]) {
    const xs = iterate(linear, XSTAR + 0.3, 60, { a, xs: XSTAR });
    assert.ok(Math.abs(xs.at(-1) - XSTAR) > 10, `a = ${a}`);
  }
});

test('slopeAt matches the derivative of cos', () => {
  for (const x of [-2, 0, 0.5, 2]) assert.ok(Math.abs(slopeAt(cos, x) + Math.sin(x)) < 1e-8);
});
