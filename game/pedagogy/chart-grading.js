// Grading the player's chart against the computed fixed points. No DOM.
//
//   const truth = chartTruth(findFixedPoints1D(Math.cos, [-Math.PI, Math.PI]));
//     → [{ symbol: 'harbour', at: [0.739…] }]
//   gradeChart([{ symbol: 'harbour', at: [0.74] }], truth, { tol: 0.08 })
//     → { ok: true, placed: [{ …, status: 'correct', target: 0 }], missing: [] }
//
// Positions are arrays (one entry on a lane, two on a plane). Each placed symbol is matched to the
// nearest unclaimed fixed point within tol:
//   'correct'       right place, right symbol
//   'wrong-symbol'  right place, wrong symbol (e.g. a fountain where the harbour is)
//   'misplaced'     no fixed point within tol
// Fixed points no symbol claimed are listed in missing. ok means every symbol is correct and
// nothing is missing.

export const SYMBOLS = ['harbour', 'fountain', 'half-harbour', 'whirlpool', 'crossing', 'gyre'];

// The symbol a fixed point deserves. Lane (map or 1D flow) fixed points carry a stability kind.
// Plane fixed points may name their symbol directly (set by the zone from the eigenvalues).
export function symbolFor(fp) {
  if (fp.symbol) return fp.symbol;
  return { stable: 'harbour', unstable: 'fountain', half: 'half-harbour' }[fp.kind];
}

export function chartTruth(fixedPoints) {
  return fixedPoints.map((fp) => ({
    symbol: symbolFor(fp),
    at: fp.at ?? (fp.y === undefined ? [fp.x] : [fp.x, fp.y]),
  }));
}

export function gradeChart(placed, truth, { tol = 0.1 } = {}) {
  const claimed = new Set();
  const out = placed.map((p) => {
    let best = -1, bestD = Infinity;
    truth.forEach((t, i) => {
      if (claimed.has(i)) return;
      const d = dist(p.at, t.at);
      if (d < bestD) { best = i; bestD = d; }
    });
    if (best < 0 || bestD > tol) return { ...p, status: 'misplaced', target: null, error: bestD };
    claimed.add(best);
    const status = truth[best].symbol === p.symbol ? 'correct' : 'wrong-symbol';
    return { ...p, status, target: best, error: bestD, expected: truth[best].symbol };
  });
  const missing = truth.filter((_, i) => !claimed.has(i));
  return { ok: out.every((p) => p.status === 'correct') && missing.length === 0, placed: out, missing };
}

function dist(a, b) {
  return Math.hypot(...a.map((v, i) => v - b[i]));
}
