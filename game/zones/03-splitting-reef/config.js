// Zone 3 · The Splitting Reef. Starter pack Ch 3: period doubling, the bifurcation diagram,
// windows, Feigenbaum's δ, universality. Rule: x_{n+1} = r x_n (1 − x_n), the tide turns r.
// Boss: the Mimic, who copies any one-hump reef the player draws.

import { logistic } from './cascade.js';

export default {
  n: 3,
  folder: '03-splitting-reef',
  title: 'The Splitting Reef',
  chapters: [3],

  domain: [0, 1],
  laneScale: 20,
  laneEndLabels: ['0', '1'],
  laneTicks: [0.25, 0.5, 0.75],
  lighthouse: [-7, -2],
  rule: { name: 'logistic', step: (x, p) => logistic(x, p.r), params: { r: 2.8 }, tex: 'x_{n+1} = r\\,x_n(1 - x_n)' },

  buoyBudget: 6,
  flashEvery: 0.9,
  chart: { symbols: ['harbour', 'fountain', 'half-harbour'], tol: 0.03 },
  ghost: { maxHops: 5, tol: 0.05 },

  tide: { key: 'r', label: 'tide · r', from: 2.8, to: 4.0, step: 0.001, labels: [3, 3.5] },
  // how close a logged tide must be to count as that split (they crowd together)
  splitTol: [0.02, 0.02, 0.006, 0.004],
  window3: [1 + Math.sqrt(8), 3.8415],
  coverage: 0.85,

  challenges: [
    { id: 'a', title: 'Log the splits' },
    { id: 'b', title: 'Grow the reef map' },
    { id: 'c', title: 'Find the calm window' },
    { id: 'd', title: 'The ratio of the gaps' },
  ],

  boss: { name: 'The Mimic' },

  logbook: [
    {
      id: 'doubling', chapter: 3, read: '§10.2',
      title: 'The harbour splits',
      hint: 'Turn the tide and log where the harbour splits.',
      sailor: `<p>As I turned the tide up, the single harbour didn’t move so much as split: boats
        started hopping between two harbours, one flash here, the next flash there. Further on, each
        of those split again, making four. The splits came faster and faster, until the boats never
        settled at all.</p>`,
      navigator: `<p>This is a <strong>period-doubling cascade</strong>. The fixed point loses its
        stability and a <strong>2-cycle</strong> is born; then a 4-cycle, an 8-cycle, and so on. Each
        split is a <strong>period-doubling (flip) bifurcation</strong>. The splits pile up at a limit
        tide, beyond which the motion is chaotic.</p>`,
      cartographer: `<p>The fixed point <span class="tex">x^* = 1 - 1/r</span> has
        <span class="tex">f'(x^*) = 2 - r</span>, which passes <span class="tex">-1</span> at
        <span class="tex">r_1 = 3</span>. The 2-cycle loses stability at
        <span class="tex">r_2 = 1 + \\sqrt 6 \\approx 3.4495</span>; then
        <span class="tex">r_3 \\approx 3.5441</span>, <span class="tex">r_4 \\approx 3.5644</span>,
        accumulating at <span class="tex">r_\\infty \\approx 3.5699</span>.</p>`,
    },
    {
      id: 'diagram', chapter: 3, read: '§10.2',
      title: 'A map of every tide',
      hint: 'Sweep the tide across its whole range.',
      sailor: `<p>Every tide I visited left a row of dots on the water: where boats keep going at that
        tide. Put together, the rows grew into a tree that forks, and forks again, and then dissolves
        into a mist with thin clear stripes in it.</p>`,
      navigator: `<p>That picture is the <strong>bifurcation diagram</strong> (sometimes called an
        orbit diagram): for each value of the parameter, the long-run states of the orbit. Forks are
        period-doubling bifurcations; the mist is chaos; the clear stripes are
        <strong>periodic windows</strong>.</p>`,
      cartographer: `<p>For each <span class="tex">r</span>: iterate past the transient, then plot
        <span class="tex">x_n</span> for many <span class="tex">n</span>. The diagram is the attractor
        as a function of <span class="tex">r</span>.</p>`,
    },
    {
      id: 'windows', chapter: 3, read: '§10.4',
      title: 'Calm in the middle of chaos',
      hint: 'Look for a clear stripe past 3.8.',
      sailor: `<p>Deep in the chaotic part of the tide, a clear stripe: for a short stretch the boats
        calmed down and hopped between just three harbours. Then, turning a little further, the three
        split into six, and chaos came back.</p>`,
      navigator: `<p>A <strong>periodic window</strong>. The widest one holds a stable
        <strong>3-cycle</strong>. It is born suddenly, in a <strong>tangent (saddle-node)
        bifurcation</strong>, and then period-doubles back into chaos, a small copy of the whole cascade.</p>`,
      cartographer: `<p>The 3-cycle appears at <span class="tex">r = 1 + \\sqrt 8 \\approx 3.8284</span>, where
        the graph of <span class="tex">f^3</span> touches the diagonal. Just before it, orbits linger
        near the ghost of the cycle: <strong>intermittency</strong>.</p>`,
    },
    {
      id: 'delta', chapter: 3, read: '§10.6',
      title: 'The gaps shrink by 4.669',
      hint: 'Divide one gap between splits by the next.',
      sailor: `<p>The gaps between my logged splits shrank fast. When I divided each gap by the next one,
        I got nearly the same number each time, a bit over four and a half.</p>`,
      navigator: `<p>The ratio of successive gaps between period-doubling bifurcations tends to
        <strong>Feigenbaum’s constant</strong>, δ ≈ 4.669. Because the gaps shrink geometrically,
        infinitely many splits fit before a finite tide: the accumulation point.</p>`,
      cartographer: `<p class="tex-display">\\delta = \\lim_{n\\to\\infty} \\frac{r_n - r_{n-1}}{r_{n+1} - r_n}
        = 4.669201609\\ldots</p>
        <p>For the logistic map: <span class="tex">4.751, 4.656, 4.668, \\ldots</span></p>`,
    },
    {
      id: 'universality', chapter: 3, read: '§10.6–10.7',
      title: 'Every reef splits the same way',
      hint: 'Beat the Mimic.',
      sailor: `<p>I drew my own reef, a lopsided hump nothing like the one on this lane, and it split
        just the same: one harbour, two, four, then chaos. And the gaps between its splits shrank by
        the same number I had measured on the logistic reef. The Mimic didn’t copy my reef. Every reef
        with one smooth top copies the same pattern.</p>`,
      navigator: `<p><strong>Universality</strong>: the number δ ≈ 4.669 doesn’t depend on the formula,
        only on the rule having a single smooth (quadratic) maximum. The logistic map, the sine map,
        a hump you drew, and real experiments in fluids and circuits all share it.</p>`,
      cartographer: `<p>For any unimodal <span class="tex">f_r</span> with a quadratic maximum,
        <span class="tex">(r_n - r_{n-1})/(r_{n+1} - r_n) \\to \\delta</span>. The explanation is
        <strong>renormalization</strong>: near <span class="tex">r_\\infty</span>, <span class="tex">f^2</span>,
        rescaled, looks like <span class="tex">f</span> itself, and δ is an eigenvalue of that
        doubling operator. A flat or pointed top gives a different constant, or none.</p>`,
    },
  ],
};
