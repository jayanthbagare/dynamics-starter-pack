// Every zone of the game, in sailing order. This is content, not engine: a new zone adds a line
// here (and its folder), and flips live to true when it ships. at = position on the hub's
// world chart, in its 800 × 380 viewBox.

export const zones = [
  { key: '1', n: 1, folder: '01-lighthouse', title: 'The Lighthouse', chapters: [0, 1], topic: 'iteration, fixed points, stability', boss: 'The Keeper', live: true, at: [110, 250] },
  { key: '2', n: 2, folder: '02-twin-fleets', title: 'The Twin Fleets', chapters: [2], topic: 'sensitive dependence', boss: 'The Oracle', live: true, at: [230, 130] },
  { key: '3', n: 3, folder: '03-splitting-reef', title: 'The Splitting Reef', chapters: [3], topic: 'period doubling, universality', boss: 'The Mimic', live: false, at: [360, 235] },
  { key: '4', n: 4, folder: '04-river-mouth', title: 'The River Mouth', chapters: [4, 5], topic: '1D flows and their bifurcations', boss: 'The Ratchet', live: false, at: [480, 110] },
  { key: '5', n: 5, folder: '05-open-sea', title: 'The Open Sea', chapters: [6, 7], topic: 'linear systems, phase plane, Hopf', boss: 'The Gyre', live: false, at: [590, 260] },
  { key: '6', n: 6, folder: '06-storm', title: 'The Storm', chapters: [8], topic: 'Lorenz', boss: 'The Storm Itself', live: false, at: [700, 140] },
  { key: 'S', n: 'S', folder: 's-summit', title: 'The Summit', chapters: [9, 10], topic: 'fractals', boss: null, optional: true, live: false, at: [735, 45] },
];

export const findZone = (key) => zones.find((z) => z.key.toLowerCase() === String(key).toLowerCase()) ?? null;
