# Zone 1 · The Lighthouse: playtest script

Target: about 18 minutes for a first-time player. Starter pack Ch 0 and Ch 1; Strogatz §10.1.

## Setup

1. From the repo's parent folder: `python3 -m http.server 8765`, then open
   `http://localhost:8765/dynamics-starter-pack/game/?zone=1` (the Pages subpath).
2. Clean start: on the hub, press “Forget my progress”.
3. Useful links: `?zone=1&boss=1` jumps straight to the Keeper; `/game/` is the hub.

## What was verified before handing over

- `npm test`: 20 tests pass (cos convergence to 1e-6, fixed points and slope classification for
  x* + a(x − x*) across a ∈ [−1.3, 1.3], chart grading accept/reject, scoring, storage fallback).
- A headless run (jsdom + real three.js, with only the WebGL renderer stubbed) played the whole
  zone with no errors: 5 starts, chart graded correct, a 3-jump ghost line scored, the beam
  prediction, all three logbook levels, both Keeper phases (including a wrong mark at 1.20), the
  win, and the return to the cos lane. Also checked: hub, unknown zone, `?zone=<script>` shown as
  text, reduced motion (flashes wait for Space), and no WebGL (message with links back).
- **Not verified: how it looks.** No browser with WebGL was available, so nothing on this list has
  been seen on screen. The visual checks below come first.

## 1. Visual first pass (5 min, the tester alone)

- [ ] The sea is low-poly and gently moving; lane, end posts (−π, π), numbered posts, lighthouse.
- [ ] Click the lane: a boat appears; each flash it hops along an arc; the lamp pulses and a ray
      reaches the boat; the beam draws lane → curve → lane on the water.
- [ ] The rule curve on the water crosses the lane at the harbour (a little right of 0).
- [ ] No arrows on the water anywhere.
- [ ] Theme toggle (top right): light, dark, auto. Sea, lane, labels and symbols all recolour.
- [ ] `V`: top-down chart view frames the whole lane; `V` again returns. WASD pans in both.
- [ ] Scroll and `+`/`−` zoom. Labels stay readable.

## 2. Challenges (watch a player; don't explain)

**(a) Find the harbour.** Expect: the player drops boats and sees them all collect at one spot.
Watch for: do they spread their starts out? Do they find the vantage (`V`) and the palette
without help? Is 0.08 a fair tolerance for placing the harbour by clicking?
- [ ] Starts counter fills (● ● ● ● ●); duplicates within 0.05 don't count.
- [ ] Check chart: “Chart correct” with the harbour; a fountain there says “isn’t a fountain”; a
      harbour at 1.2 says “No fixed point near” and the true harbour appears faintly, labelled *true*.
- [ ] Charting before 5 starts: told how many more starts are needed; the challenge completes on
      the 5th start without re-checking.

**(b) Ghost lines.** Expect: drag, drag, drag, click. Watch for: do they understand that each drag
is one jump? Is the dashed ghost arc distinguishable from the solid true arcs? Is the
error line between guess and truth readable?
- [ ] Toast after each drag counts the jumps. The click releases the boat at the ghost start.
- [ ] After the boat has made its jumps, the panel table shows guess, true, close / off by.
- [ ] Keyboard route: helm slider, “Predict from here”, “Add jump here”, “Release boat”.

**(c) Read the beam.** Expect: they watch a far-away boat spiral in, then answer.
- [ ] Either answer completes the challenge (no fail state); a wrong answer is corrected.
- [ ] The dashed slope line through the harbour appears; the signed gaps alternate + − + −.

## 3. The Keeper (5–7 min)

- [ ] A pier appears at the harbour; a boat is relaunched from beside it after each tide change.
- [ ] Tide wheel: drag, `[` `]`, Shift+`]`, arrows when focused. The chart greys and says STALE.
- [ ] Keeper lines: “holds” below 1, “stays where it was” at exactly 1.00, “fountain” above 1.
- [ ] A wrong mark retunes the tide to the mark so the player sees what happens there; after two
      wrong marks the true value appears on the dial.
- [ ] Phase 2 runs −0.3 → −1.3; boats bounce side to side while leaving.
- [ ] Win: the “Keeper’s rule” page unlocks; Cartographer level shows |f′(x*)| < 1.
- Watch for: do players find 1 by turning the tide, or by reasoning? Is the marker slider clearly
  separate from the tide wheel? Does anyone mark at 1 in phase 2 instead of −1 (it counts |a|)?

## 4. Logbook

- [ ] `L` opens it; level switch works any time and is remembered across zones and reloads.
- [ ] “Your chart” describes the player’s own symbols at each level; links go to Ch 0 / Ch 1.
- [ ] Locked pages show a hint, not the content.

## 5. Access and robustness

- [ ] Keyboard only, mouse unplugged: finish (a), (b), (c) and the Keeper with Tab, helm, palette,
      wheel, `M`, `Space`, `R`. Focus is always visible.
- [ ] OS reduced motion on: still water, instant hops, flashes wait for Space, no lamp pulse.
- [ ] Private window / storage blocked: plays normally; hub says progress won’t be saved.
- [ ] Reload mid-zone: challenges, chart and logbook pages persist; boats don’t (by design).
- [ ] Narrow window (< 52rem): panels stack and remain usable.
- [ ] Round trip: landing page → Companion game card → hub → Zone 1 → “Starter pack” link;
      Ch 0 and Ch 1 “Sail this chapter” → Zone 1; logbook links → chapters.

## Timing notes (fill in)

| player | age | (a) | (b) | (c) | Keeper | total | stuck on |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |

## Known limits and open questions

- A click anywhere on the sea drops a boat at the lane position under it (not only on the lane):
  convenient, but it may surprise. Decide after watching players.
- Challenge (b) completes for any score once 3+ jumps are predicted (no fail states); only the table
  shows accuracy.
- Boats persist only for the visit; progress, charts and logbook are saved.
- Sweeping the tide with keys relaunches the moored boat 0.3 s after the last change.
