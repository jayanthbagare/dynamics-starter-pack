// Zone 2 · The Twin Fleets. Starter pack Ch 2: sensitive dependence on initial conditions.
// Rule: x_{n+1} = 4 x_n (1 − x_n) on [0, 1]. Twins 1e-7 apart part company near flash 21;
// starting 1000× closer buys only about 10 more flashes. Boss: the Oracle.

import { logistic } from './twins.js';

export default {
  n: 2,
  folder: '02-twin-fleets',
  title: 'The Twin Fleets',
  chapters: [2],

  domain: [0, 1],
  laneScale: 20,
  laneEndLabels: ['0', '1'],
  laneTicks: [0.25, 0.5, 0.75],
  lighthouse: [10, -12],
  rule: { name: 'logistic', step: (x) => logistic(x), params: {}, tex: 'x_{n+1} = 4x_n(1 - x_n)' },

  buoyBudget: 6,
  flashEvery: 0.9,
  chart: { symbols: ['harbour', 'fountain', 'half-harbour'], tol: 0.03 },
  ghost: { maxHops: 5, tol: 0.05 },

  challenges: [
    { id: 'a', title: 'Bet on the split' },
    { id: 'b', title: 'Read the gap' },
    { id: 'c', title: 'A thousand times closer' },
  ],
  gap0: 1e-7,
  closer: 1000,
  threshold: 0.1,
  plotFlashes: 40,

  boss: { name: 'The Oracle', x0: 0.3, flash: 60, bins: 20, cloud: 20000 },

  logbook: [
    {
      id: 'twins', chapter: 2, read: '§9.3',
      title: 'Twins that don’t stay twins',
      hint: 'Launch two boats almost on top of each other.',
      sailor: `<p>I launched two boats so close together that no instrument aboard could tell them
        apart. For about twenty flashes they jumped as one. Then, within a couple of flashes, they
        were on opposite sides of the lane, as if they had never met.</p>`,
      navigator: `<p>This is <strong>sensitive dependence on initial conditions</strong>, the
        signature of <strong>chaos</strong>. The rule is simple and exact, with no randomness in it,
        yet two starts that differ by one part in ten million end up completely different.
        Popularly: the <em>butterfly effect</em>.</p>`,
      cartographer: `<p class="tex-display">x_{n+1} = 4x_n(1 - x_n), \\qquad |\\delta_0| = 10^{-7}</p>
        <p>The gap <span class="tex">\\delta_n = y_n - x_n</span> passes 0.1 at about
        <span class="tex">n \\approx 21</span>. A deterministic rule, and still unpredictable in
        practice.</p>`,
    },
    {
      id: 'doubling', chapter: 2, read: '§9.3, §10.5',
      title: 'The gap doubles',
      hint: 'Watch the gap on a log scale.',
      sailor: `<p>On the log plot the gap climbed in a straight line, the same step up every flash,
        until it hit the ceiling: two boats on a lane of length 1 can’t be more than 1 apart. The
        slope of the line said the gap doubled with each flash.</p>`,
      navigator: `<p>A straight line on a log scale means <strong>exponential growth</strong>. The
        growth rate per flash, averaged along the orbit, is the <strong>Lyapunov exponent</strong>.
        Positive means nearby orbits separate: chaos. For this rule it is ln 2, so the gap doubles
        each flash on average.</p>`,
      cartographer: `<p class="tex-display">|\\delta_n| \\approx |\\delta_0|\\, e^{\\lambda n}, \\qquad
        \\lambda = \\lim_{n\\to\\infty} \\frac{1}{n} \\sum_{i=0}^{n-1} \\ln |f'(x_i)| = \\ln 2</p>
        <p>With <span class="tex">f'(x) = 4 - 8x</span>. Growth stops when
        <span class="tex">|\\delta_n|</span> reaches the size of the lane: the line saturates.</p>`,
    },
    {
      id: 'horizon', chapter: 2, read: '§9.3',
      title: 'The horizon barely moves',
      hint: 'Start the twins a thousand times closer.',
      sailor: `<p>I started the twins a thousand times closer. I expected them to stay together a
        thousand times longer. They lasted about ten flashes longer. Being much more careful at the
        start buys only a little more time.</p>`,
      navigator: `<p>The <strong>prediction horizon</strong> is how long a forecast stays useful.
        Because the gap grows exponentially, shrinking the starting error by a factor only
        <em>adds</em> to the horizon, by the logarithm of that factor. 1000 is about
        <span class="mono">2<sup>10</sup></span>, so 10 more flashes.</p>`,
      cartographer: `<p class="tex-display">t_{\\text{horizon}} \\approx \\frac{1}{\\lambda}
        \\ln \\frac{a}{|\\delta_0|}</p>
        <p>With tolerance <span class="tex">a = 0.1</span> and <span class="tex">\\lambda = \\ln 2</span>:
        <span class="tex">\\delta_0 = 10^{-7}</span> gives about 20, and
        <span class="tex">10^{-10}</span> adds <span class="tex">\\log_2 1000 \\approx 10</span>.</p>`,
    },
    {
      id: 'density', chapter: 2, read: '§10.5',
      title: 'What the Oracle knows',
      hint: 'Answer the Oracle.',
      sailor: `<p>The Oracle wouldn’t accept a number for where the boat would be at flash 60. She
        wanted a band: where boats like it tend to be. The honest band is heaviest near both ends of
        the lane. Boats slow down there, turning back like a pendulum at the top of its swing, and
        rush through the middle.</p>`,
      navigator: `<p>Past the horizon, a single forecast is luck. What survives is a
        <strong>probability distribution</strong>: the fraction of time an orbit spends in each part
        of the lane. Here it is the same for almost every start, the map’s
        <strong>invariant density</strong>, shaped like a U.</p>`,
      cartographer: `<p class="tex-display">\\rho(x) = \\frac{1}{\\pi\\sqrt{x(1-x)}}</p>
        <p>The chance of finding the boat in <span class="tex">[a, b]</span> is
        <span class="tex">\\tfrac{2}{\\pi}\\left(\\arcsin\\sqrt{b} - \\arcsin\\sqrt{a}\\right)</span>.
        It blows up at 0 and 1, which is why the band is heaviest at the edges.</p>`,
    },
    {
      id: 'fountains', chapter: 2, read: '§10.3',
      title: 'Two fountains, no harbour',
      hint: 'Chart this lane.',
      sailor: `<p>I looked for a harbour and found none. There are two spots where a boat could sit
        still, at 0 and at three-quarters, and both push boats away. With nowhere to settle, boats
        wander forever.</p>`,
      navigator: `<p>Both fixed points are <strong>unstable</strong>. With no stable fixed point or
        cycle to settle on, orbits keep moving over the whole lane: the chaotic regime.</p>`,
      cartographer: `<p>Fixed points solve <span class="tex">4x(1-x) = x</span>:
        <span class="tex">x^* = 0</span> with <span class="tex">f'(0) = 4</span>, and
        <span class="tex">x^* = \\tfrac34</span> with <span class="tex">f'(\\tfrac34) = -2</span>.
        Both have <span class="tex">|f'(x^*)| > 1</span>.</p>`,
    },
  ],
};
