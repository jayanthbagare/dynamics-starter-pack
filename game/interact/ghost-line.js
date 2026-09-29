// The ghost line: before a boat is released, the player predicts its jumps. Each drag across the
// water adds one predicted hop, from the last guess (or the start) to where the drag ends.
//
//   const ghost = createGhostLine({ maxHops: 5 });
//   ghost.begin(x0)        // a drag that starts on the water
//   ghost.preview(x)       // while dragging
//   ghost.hop(x)           // drag released: one more guessed jump
//   ghost.undo(); ghost.clear()
//   ghost.state            → { start, guesses: [x₁, x₂, …], preview } or null

export function createGhostLine({ maxHops = 5 } = {}) {
  let start = null, guesses = [], preview = null;
  return {
    maxHops,
    get active() { return start !== null; },
    get full() { return guesses.length >= maxHops; },
    get anchor() { return guesses.length ? guesses.at(-1) : start; },
    get state() { return start === null ? null : { start, guesses: [...guesses], preview }; },
    begin(x0) { if (start === null) { start = x0; guesses = []; } },
    preview(x) { preview = this.full ? null : x; },
    hop(x) {
      preview = null;
      if (start === null || this.full) return false;
      guesses.push(x);
      return true;
    },
    undo() { preview = null; if (guesses.length) guesses.pop(); else start = null; },
    clear() { start = null; guesses = []; preview = null; },
  };
}
