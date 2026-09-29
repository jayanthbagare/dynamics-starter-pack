// The Twin Fleets, the numbers behind the zone. Pure JavaScript, no DOM.
//
//   gapSeries(0.3, 1e-7, 40)            → |xₖ − yₖ| for k = 0…40, two boats started 1e-7 apart
//   flashesToSeparate(0.3, 1e-7, 0.1)   → the first flash at which the gap exceeds 0.1
//   pairStats(1e-7, 500, seed)          → { median, flashes } over many random pairs
//   binProbabilities(20)                → exact chance of each of 20 bins under the invariant density
//   judgeBand(band)                     → { pass, distance, edgesHeavy } for the Oracle
//
// The rule is x → 4x(1 − x). Nearby orbits separate by a factor of 2 per flash on average
// (Lyapunov exponent ln 2), and a long orbit spends its time with density 1 / (π √(x(1 − x))).

import { iterate } from '../../sim/maps.js';

export const logistic = (x) => 4 * x * (1 - x);

// A small seeded generator, so every test and every Oracle question is reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- sensitive dependence ----------------------------------------------------------------------

export function gapSeries(x0, gap0, n) {
  const xs = iterate(logistic, x0, n), ys = iterate(logistic, x0 + gap0, n);
  return xs.map((x, k) => Math.abs(x - ys[k]));
}

export function flashesToSeparate(x0, gap0, threshold = 0.1, max = 400) {
  let x = x0, y = x0 + gap0;
  for (let k = 1; k <= max; k++) {
    x = logistic(x); y = logistic(y);
    if (Math.abs(x - y) > threshold) return k;
  }
  return null;
}

export function pairStats(gap0, count, seed = 1, threshold = 0.1) {
  const rand = mulberry32(seed);
  const flashes = [];
  for (let i = 0; i < count; i++) {
    const x0 = 0.05 + 0.9 * rand();
    const k = flashesToSeparate(x0, gap0, threshold);
    if (k !== null) flashes.push(k);
  }
  flashes.sort((a, b) => a - b);
  const m = flashes.length;
  const median = m % 2 ? flashes[(m - 1) / 2] : (flashes[m / 2 - 1] + flashes[m / 2]) / 2;
  return { median, flashes };
}

// --- where a boat spends its time -----------------------------------------------------------------

export const invariantDensity = (x) => 1 / (Math.PI * Math.sqrt(x * (1 - x)));

// cumulative distribution of the invariant density: (2/π) asin √x
const cdf = (x) => (2 / Math.PI) * Math.asin(Math.sqrt(Math.min(1, Math.max(0, x))));

export function binProbabilities(bins) {
  return Array.from({ length: bins }, (_, i) => cdf((i + 1) / bins) - cdf(i / bins));
}

export function histogram(values, bins) {
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    if (!(v >= 0 && v <= 1)) continue;
    counts[Math.min(bins - 1, Math.floor(v * bins))]++;
  }
  return counts;
}

export function chiSquare(counts, probs) {
  const n = counts.reduce((a, b) => a + b, 0);
  let stat = 0;
  counts.forEach((c, i) => { const e = n * probs[i]; stat += ((c - e) ** 2) / e; });
  return { stat, df: counts.length - 1 };
}

// A long orbit, sampled every `every` flashes after a transient. If floating point ever lands the
// orbit on 0 (where it would stay forever), it restarts from a fresh random start.
export function longOrbit(n, { seed = 7, every = 3, skip = 100 } = {}) {
  const rand = mulberry32(seed);
  let x = 0.1 + 0.8 * rand();
  const out = [];
  for (let k = 0; out.length < n; k++) {
    x = logistic(x);
    if (x <= 0 || x >= 1) { x = 0.1 + 0.8 * rand(); k = 0; continue; }
    if (k >= skip && k % every === 0) out.push(x);
  }
  return out;
}

// Where a fleet of boats is at flash n, all started within `spread` of x0: what the Oracle can
// honestly say about a single boat whose start is known only to that precision.
export function cloudAt(x0, spread, count, n, seed = 3) {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => iterate(logistic, x0 + (rand() - 0.5) * spread, n).at(-1));
}

// --- the Oracle's band -------------------------------------------------------------------------------

export function normalize(band) {
  const total = band.reduce((a, b) => a + Math.max(0, b), 0);
  return total > 0 ? band.map((b) => Math.max(0, b) / total) : null;
}

// total variation distance: half the summed difference, 0 (identical) to 1 (no overlap)
export function bandDistance(band) {
  const p = normalize(band);
  if (!p) return 1;
  const q = binProbabilities(band.length);
  return p.reduce((s, v, i) => s + Math.abs(v - q[i]), 0) / 2;
}

// Heaviest near the edges: the two outermost bins on each side hold at least twice as much, per bin,
// as the middle half of the lane.
export function edgesHeavy(band) {
  const p = normalize(band);
  if (!p) return false;
  const n = p.length, e = Math.max(1, Math.round(n / 10));
  const edges = [...p.slice(0, e), ...p.slice(n - e)];
  const middle = p.slice(Math.round(n / 4), n - Math.round(n / 4));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  return mean(edges) >= 2 * mean(middle);
}

export const BAND_PASS = 0.15;

export function judgeBand(band, pass = BAND_PASS) {
  const distance = bandDistance(band);
  return { distance, pass: distance <= pass, edgesHeavy: edgesHeavy(band) };
}
