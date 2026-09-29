// Scoring a prediction against what really happened. No DOM.
//
//   scorePath([-0.4, 0.9, 0.6], [-0.416, 0.915, 0.610], { tol: 0.1 })
//     → { steps: [{ i: 1, guess, truth, error, hit }, …], hits: 3, total: 3, score: 1 }
//   scoreValue(1.02, 1, 0.05) → { guess: 1.02, target: 1, error: 0.02, hit: true, direction: 'high' }
//
// Guesses and truths are aligned by jump: guesses[k] is the guess for truths[k]. Positions may be
// numbers (a lane) or arrays (a plane). There is no failing: the score only says how close.

export function scorePath(guesses, truths, { tol = 0.1 } = {}) {
  const steps = guesses.map((guess, k) => {
    const truth = truths[k];
    const error = truth === undefined ? Infinity : distance(guess, truth);
    return { i: k + 1, guess, truth, error, hit: error <= tol };
  });
  const hits = steps.filter((s) => s.hit).length;
  return { steps, hits, total: steps.length, score: steps.length ? hits / steps.length : 0 };
}

export function scoreValue(guess, target, tol) {
  const error = Math.abs(guess - target);
  return { guess, target, error, hit: error <= tol, direction: guess > target ? 'high' : guess < target ? 'low' : 'exact' };
}

export function distance(p, q) {
  if (typeof p === 'number') return Math.abs(p - q);
  return Math.hypot(...p.map((v, i) => v - q[i]));
}
