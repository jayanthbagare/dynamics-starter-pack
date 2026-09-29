// The fleet of buoys (boats, in the discrete zones). A limited number can be on the water at once;
// recalling them, or losing them off the edge of the lane, frees the budget again. Nothing fails.
//
//   const fleet = createFleet({ budget: 6, inside: space.inside });
//   fleet.setRule(step, params)          // the rule every boat obeys (the tide can change it)
//   fleet.drop(x0, { ghost })            → buoy { id, xs: [x0, …], adrift } or null if none left
//   fleet.flash()                        → the buoys that moved (each takes one step)
//   fleet.recall()
//   fleet.list(); fleet.remaining; fleet.budget

export function createFleet({ budget, inside = () => true }) {
  let step = (x) => x, params = {};
  let buoys = [];
  let nextId = 1;

  return {
    budget,
    get remaining() { return budget - buoys.filter((b) => !b.gone).length; },
    list: () => buoys,
    setRule(s, p = {}) { step = s; params = p; },

    drop(x0, extra = {}) {
      if (this.remaining <= 0) return null;
      const b = { id: nextId++, xs: [x0], adrift: false, gone: false, droppedAt: performance.now(), ...extra };
      buoys.push(b);
      return b;
    },

    flash() {
      const moved = [];
      for (const b of buoys) {
        if (b.adrift) { b.gone = true; continue; }   // one flash to sail off the edge, then gone
        const x = step(b.xs.at(-1), params);
        b.xs.push(x);
        if (b.xs.length > 400) b.xs.splice(0, b.xs.length - 400);
        if (!inside(x)) b.adrift = true;
        moved.push(b);
      }
      buoys = buoys.filter((b) => !b.gone);
      return moved;
    },

    recall() { buoys = []; },
    remove(id) { buoys = buoys.filter((b) => b.id !== id); },
  };
}
