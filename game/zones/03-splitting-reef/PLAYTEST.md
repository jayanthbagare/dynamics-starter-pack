# Zone 3 · The Splitting Reef: playtest script

Target: about 18 minutes for a first-time player. Starter pack Ch 3; Strogatz §10.2–10.7.

## Setup

1. From the repo's parent folder: `python3 -m http.server 8765`, then open
   `http://localhost:8765/dynamics-starter-pack/game/?zone=3`. Live: `…/game/?zone=3`.
2. Clean start: hub → “Forget my progress”. `?zone=3&boss=1` jumps to the Mimic.

## What was verified before handing over

- `npm test`: 35 tests pass. Zone 3 adds:
  - logistic splits 3, 3.44949, 3.54409, 3.56441 (reference within 1e-3; r₂ = 1 + √6 to 1e-6);
  - ratios 4.751, 4.656, 4.668 heading to δ;
  - sine map r·sin(πx): ratio from r₂–r₄ is 4.70 (the first ratio, 4.47, is below 4.5, so the test
    uses the settled one);
  - the reef spline has exactly one maximum, h″ < 0 at it, values in [0, 1], ends at 0, for 3 presets,
    200 random and 3 adversarial handle sets;
  - for every preset reef, a prediction made with δ wins the Mimic and one 3% off loses.
- Headless run (jsdom, real three.js, stubbed WebGL renderer), no errors: splits logged at 3.000,
  3.450, 3.544, 3.564 and matched; map coverage ≥ 85%; period 3 found; ratio 4.79 checked and the
  table shown; the Mimic's lopsided reef splits at 0.5938, 0.7414, 0.7766; the player's ratio 4.70
  predicts 0.7841 (true 0.7841); five logbook pages; exit restores the logistic tide. Zones 1–2 and
  the hub re-run clean.
- **Not verified: how it looks.** No WebGL browser was available.

## 1. Visual first pass

- [ ] Lane 0 to 1; the bifurcation map lies north of it (tide labels r 2.8, 3, 3.5, 4 on its west
      edge), and the gold line across it follows the tide.
- [ ] The camera opens pulled back to show lane and map; `V` frames both from above.
- [ ] Harbour lights (filled discs) sit just south of the lane: 1, then 2, 4, 8; none in chaos, 3 in
      the window. The sounding boat hops between them.
- [ ] The map's dots are readable in light and dark; logged splits are highlight posts on the west
      edge; after (d) the true splits are ink posts on the east edge.
- [ ] The wheel shows 4 decimals (the zone overrides the engine's 2); its end labels still show 2.

## 2. Challenges

**(a) Log the splits.** Watch: do players log where the lights *change*, or where they *look* settled?
Near a split, boats settle slowly, so the lights can lag the true split by a few thousandths.
- [ ] Logging near a split names it; logging elsewhere says the count doesn't change there.
- [ ] Tolerances 0.02, 0.02, 0.006, 0.004. Is the 4th split findable with single steps?

**(b) Grow the reef map.** Done at 85% coverage. A fast drag fills the skipped tides too.

**(c) Find the calm window.** Note: sweeping straight through the window at speed can land on it and
count. Watch whether players actually *see* the three lights, or just get the toast.

**(d) The ratio of the gaps.** The player divides; a second wrong answer reveals anyway (no fail
state). Their last ratio is carried to the Mimic.

## 3. The Mimic

- [ ] Editor: drag handles; keyboard ←/→ picks, ↑/↓ raises, Shift+←/→ slides, without moving the
      camera. Presets: logistic, sine, lopsided. Nothing the player does breaks the single top.
- [ ] “Give her this reef”: the lane's rule becomes m·h(x); the wheel runs from just below her 1st
      split to 1 with her first three splits marked; the map regrows for this reef.
- [ ] “Use it” fills 3rd + (3rd − 2nd) ÷ ratio; lock with the button or `M`.
- [ ] A miss says earlier/later; after two misses the true 4th split appears on the wheel.
- [ ] **Tolerance, as specified: within 2% of the 4th split's value** (≈ ±0.016 on this scale). That
      is wider than the gap between the 3rd and 4th splits (≈ 0.005–0.008), so repeating the 3rd
      split also wins. Watch whether players notice; tighten later if the boss feels free.
- [ ] “Every reef splits the same way” unlocks.

## 4. Access and round trip

- [ ] Keyboard only: wheel (focus, arrows; or `[` `]` anywhere), `K` to log, ratio field, editor,
      prediction field, `M`.
- [ ] Reduced motion: flashes wait for Space; harbour lights and the map still update with the tide.
- [ ] Ch 3 “Sail this chapter” → Zone 3; landing card says Zones 1–3; hub shows Zone 3 open.

## Timing notes (fill in)

| player | age | (a) logs | (b) | (c) | (d) ratio | Mimic tries | total | stuck on |
|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |

## Known limits and open questions

- The wheel's precision is set by zone code writing into the engine's readout; forwarding
  `format` through `enableTide` (one line) would be cleaner. Proposed, not approved.
- The period readout near a split can say the lower period for a few thousandths past it (slow
  settling). The logged-split tolerances absorb this.
