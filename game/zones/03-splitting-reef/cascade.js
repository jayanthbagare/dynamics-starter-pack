// The Splitting Reef, the numbers behind the zone. Pure JavaScript, no DOM.
//
//   attractor(stepR, 3.5)                  → 64 states the boat keeps visiting, after the transient
//   periodOf(values)                       → 1, 2, 4, 8, 3, … or 'chaos'
//   findSplits(stepR, c, 4, [2, 4])        → [3, 3.4495, 3.5441, 3.5644] for the logistic map
//   gapRatios([r1, r2, r3, r4])            → [(r2−r1)/(r3−r2), (r3−r2)/(r4−r3)]
//
// stepR(x, r) is a one-hump rule with its maximum at c. Splits are found exactly, not by
// watching boats (which settle painfully slowly near a split): between two superstable tides
// (where c lies on the cycle), the cycle is followed with Newton's method and the split is the
// tide at which its multiplier, the product of the slopes around the cycle, reaches −1.

export const logistic = (x, r) => r * x * (1 - x);
export const sineMap = (x, r) => r * Math.sin(Math.PI * x);
export const DELTA = 4.669201609;

export function attractor(stepR, r, { x0 = 0.3, transient = 2000, samples = 64 } = {}) {
  let x = x0;
  for (let i = 0; i < transient; i++) x = stepR(x, r);
  const out = [];
  for (let i = 0; i < samples; i++) { x = stepR(x, r); out.push(x); }
  return out;
}

export function periodOf(values, tol = 1e-5, maxP = 32) {
  for (let p = 1; p <= maxP; p++) {
    let ok = true;
    for (let i = 0; i + p < values.length; i++) if (Math.abs(values[i] - values[i + p]) > tol) { ok = false; break; }
    if (ok) return p;
  }
  return 'chaos';
}

// the distinct states of a cycle, sorted, or [] in chaos
export function cyclePoints(values, p) {
  return p === 'chaos' ? [] : values.slice(0, p).sort((a, b) => a - b);
}

const slope = (stepR, x, r, h = 1e-7) => (stepR(x + h, r) - stepR(x - h, r)) / (2 * h);

// f^p(x) and its derivative along the way (the multiplier, when x is on a p-cycle)
function iterateP(stepR, x, r, p) {
  let d = 1;
  for (let i = 0; i < p; i++) { d *= slope(stepR, x, r); x = stepR(x, r); }
  return [x, d];
}

function bisect(g, lo, hi) {
  let glo = g(lo);
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2, gm = g(mid);
    if ((gm < 0) === (glo < 0)) { lo = mid; glo = gm; } else hi = mid;
  }
  return (lo + hi) / 2;
}

// superstable tides: f_r^p(c) = c, for p = 1, 2, 4, …; each is the first root after the last
export function superstables(stepR, c, count, [rLo, rHi]) {
  const g = (p) => (r) => iterateP(stepR, c, r, p)[0] - c;
  const out = [];
  let from = rLo, step = (rHi - rLo) / 4000;
  for (let k = 0, p = 1; k < count; k++, p *= 2) {
    const gp = g(p);
    let r = from + step / 2, prev = gp(r), found = null;
    for (; r < rHi; r += step) {
      const v = gp(r + step);
      if (Number.isFinite(v) && Number.isFinite(prev) && (v < 0) !== (prev < 0)) { found = bisect(gp, r, r + step); break; }
      prev = v;
    }
    if (found === null) break;
    out.push(found);
    if (out.length >= 2) step = (out.at(-1) - out.at(-2)) / 40;
    from = found;
  }
  return out;
}

// the p-cycle point near c at tide r, by Newton on f^p(x) − x, continued from a nearby tide
function cycleNear(stepR, x, r, p) {
  for (let i = 0; i < 60; i++) {
    const [y, d] = iterateP(stepR, x, r, p);
    const dx = (y - x) / (d - 1);
    if (!Number.isFinite(dx)) break;
    x -= dx;
    if (Math.abs(dx) < 1e-14) break;
  }
  return x;
}

export function findSplits(stepR, c, count, range) {
  const s = superstables(stepR, c, count + 1, range);
  const splits = [];
  for (let k = 0; k + 1 < s.length && splits.length < count; k++) {
    const p = 2 ** k, a = s[k], b = s[k + 1];
    // multiplier of the p-cycle through c's neighbourhood, following the cycle from tide a
    const mult = (r) => {
      let x = c;
      const n = 24;
      for (let i = 1; i <= n; i++) x = cycleNear(stepR, x, a + ((r - a) * i) / n, p);
      return iterateP(stepR, x, r, p)[1] + 1;
    };
    splits.push(bisect(mult, a, b));
  }
  return splits;
}

export function gapRatios(splits) {
  const out = [];
  for (let i = 0; i + 2 < splits.length; i++) out.push((splits[i + 1] - splits[i]) / (splits[i + 2] - splits[i + 1]));
  return out;
}

// The Mimic accepts a prediction of her 4th split within 2% of its value.
export const MIMIC_TOL = 0.02;
export const mimicTolerance = (r4) => MIMIC_TOL * r4;
