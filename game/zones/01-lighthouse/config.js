// Zone 1 · The Lighthouse. Starter pack Ch 0 and Ch 1: iteration, fixed points, stability.
// Rule: x_{n+1} = cos x_n on a lane spanning [−π, π]. Every start ends at x* = 0.739085…
// Boss: the Keeper, who swaps the rule for x* + a(x − x*) and hands the player the tide.

export const XSTAR = 0.7390851332151607;

export default {
  n: 1,
  folder: '01-lighthouse',
  title: 'The Lighthouse',
  chapters: [0, 1],

  domain: [-Math.PI, Math.PI],
  laneTicks: [-3, -2, -1, 0, 1, 2, 3],
  lighthouse: [0, -13],
  rule: { name: 'cos', step: (x) => Math.cos(x), params: {}, tex: 'x_{n+1} = \\cos x_n' },

  buoyBudget: 6,
  flashEvery: 1.3,
  chart: { symbols: ['harbour', 'fountain', 'half-harbour'], tol: 0.08 },
  ghost: { maxHops: 5, minHops: 3, tol: 0.15 },

  challenges: [
    { id: 'a', title: 'Find the harbour' },
    { id: 'b', title: 'Ghost lines' },
    { id: 'c', title: 'Read the beam' },
  ],
  startsNeeded: 5,

  boss: {
    name: 'The Keeper',
    xstar: XSTAR,
    dockOffset: 0.35,
    tol: 0.05,
    phases: [
      { from: 0.3, to: 1.3, target: 1 },
      { from: -0.3, to: -1.3, target: -1 },
    ],
  },

  logbook: [
    {
      id: 'orbit', chapter: 0, read: 'Ch 1; §10.1',
      title: 'Every boat stops somewhere',
      hint: 'Drop a boat and wait for it to stop moving.',
      sailor: `<p>I dropped a boat and waited. Every flash it jumped to a new spot on the lane, each
        jump smaller than the one before, until it hardly moved at all. It came to rest a little to
        the right of the 0 post.</p>`,
      navigator: `<p>The boat’s position is the <strong>state</strong>. The flash applies the
        <strong>rule</strong>. Counting flashes is <strong>time</strong>. The list of places a boat
        visits is its <strong>orbit</strong>, and this orbit settles on a <strong>fixed point</strong>:
        a position the rule leaves where it is.</p>`,
      cartographer: `<p class="tex-display">x_{n+1} = \\cos x_n</p>
        <p>A fixed point solves <span class="tex">\\cos x^* = x^*</span>, giving
        <span class="tex">x^* \\approx 0.739085</span>. No formula gives it exactly: iterating is how
        you find it.</p>`,
    },
    {
      id: 'harbour', chapter: 0, read: '§10.1',
      title: 'One harbour for every boat',
      hint: 'Chart where boats from many different starts end up.',
      sailor: `<p>Five boats, five different starts, one resting place. Even boats dropped at the far
        ends of the lane ended at the same spot. I charted it as a harbour.</p>`,
      navigator: `<p>A <strong>stable fixed point</strong>, or <em>attractor</em>: boats that start
        nearby are pulled in. Here every start on the lane is pulled in, so the whole lane is its
        <strong>basin of attraction</strong>. Stable fixed points are drawn as filled dots, which is
        why the harbour is a filled disc.</p>`,
      cartographer: `<p>For every <span class="tex">x_0 \\in [-\\pi, \\pi]</span>,
        <span class="tex">x_n \\to x^* \\approx 0.7391</span> as <span class="tex">n \\to \\infty</span>.
        Stable means a small nudge away from <span class="tex">x^*</span> shrinks as you iterate.</p>`,
    },
    {
      id: 'ghost', chapter: 1, read: '§10.1',
      title: 'Guessing the jumps',
      hint: 'Predict a boat’s jumps with a ghost line before you release it.',
      sailor: `<p>Before letting a boat go I drew where I thought it would land, jump after jump. The
        first jump was the easiest to guess. Later ones were harder, because a small miss early on
        carried into every jump after it.</p>`,
      navigator: `<p>Each guess predicts the next <strong>iterate</strong>. Guessing the third jump
        means applying the rule three times. The ghost line is a guessed orbit; the boat sails the true
        one. The lighthouse beam draws the same thing as a <strong>cobweb</strong>.</p>`,
      cartographer: `<p>The <span class="tex">n</span>-th jump lands at
        <span class="tex">x_n = f^{n}(x_0) = f(f(\\cdots f(x_0)\\cdots))</span>. The beam builds this
        geometrically: from the lane to the curve <span class="tex">w = f(u)</span> (apply the rule),
        then back to the lane <span class="tex">w = u</span> (output becomes input).</p>`,
    },
    {
      id: 'zigzag', chapter: 1, read: '§10.1',
      title: 'Why the boats zig-zag',
      hint: 'Watch the beam close to the harbour.',
      sailor: `<p>Close to the harbour the beam winds inward like a square whirlpool. The boat hops
        over the harbour, then back, then over again, landing a bit closer every time.</p>`,
      navigator: `<p>Close to a fixed point the rule behaves like a straight line with the rule’s
        <strong>slope</strong> there. At the harbour the slope is about −0.67.
        <em>Negative</em>: every jump flips the boat to the other side, so the cobweb spirals.
        <em>Smaller than 1 in size</em>: every jump shrinks the gap, to about two-thirds of what it was.</p>`,
      cartographer: `<p>Write <span class="tex">x_n = x^* + \\eta_n</span>. Then
        <span class="tex">\\eta_{n+1} \\approx f'(x^*)\\,\\eta_n</span>, with
        <span class="tex">f'(x^*) = -\\sin x^* \\approx -0.674</span>. The sign of
        <span class="tex">f'(x^*)</span> picks the side of the next jump; its size sets how fast the
        gap shrinks.</p>`,
    },
    {
      id: 'criterion', chapter: 1, read: '§10.1',
      title: 'The Keeper’s rule',
      hint: 'Beat the Keeper.',
      sailor: `<p>The Keeper let me turn the tide until the harbour stopped holding boats. While each
        jump made the gap smaller, boats docked. Once the jumps stopped shrinking the gap, the harbour
        turned into a fountain and threw them out. Turning the tide the other way did the same thing,
        except the boats bounced side to side on their way out.</p>`,
      navigator: `<p>The <strong>stability test</strong> for a fixed point of a map: if the slope there
        is smaller than 1 in size, the fixed point is stable; if larger, unstable. When it is exactly 1
        in size the test can’t decide, which is what the half-harbour is for. The sign of the slope only
        decides staircase (positive) or zig-zag (negative).</p>`,
      cartographer: `<p class="tex-display">|f'(x^*)| < 1 \\;\\Rightarrow\\; \\text{stable}, \\qquad
        |f'(x^*)| > 1 \\;\\Rightarrow\\; \\text{unstable}.</p>
        <p>For the Keeper’s rule <span class="tex">f(x) = x^* + a(x - x^*)</span> this is exact:
        <span class="tex">\\eta_n = a^n \\eta_0</span>, which shrinks exactly when
        <span class="tex">|a| < 1</span>. For cos, <span class="tex">|f'(x^*)| \\approx 0.674 < 1</span>.
        When <span class="tex">|f'(x^*)| = 1</span> the linear test is silent.</p>`,
    },
  ],
};
