# Zone 2 · The Twin Fleets: playtest script

Target: about 18 minutes for a first-time player. Starter pack Ch 2; Strogatz §9.3, §10.3, §10.5.

## Setup

1. From the repo's parent folder: `python3 -m http.server 8765`, then open
   `http://localhost:8765/dynamics-starter-pack/game/?zone=2`. Live: `…/game/?zone=2`.
2. Clean start: hub → “Forget my progress”. `?zone=2&boss=1` jumps to the Oracle.

## What was verified before handing over

- `npm test`: 27 tests pass. Zone 2 adds: median flashes to a 0.1 gap over 1000 seeded pairs at
  1e-7 is 21 (asked for 18–28); 1e-10 adds 10 (500 pairs); growth per flash ≈ ln 2; a 200,000-point
  orbit fits 1/(π√(x(1−x))) with χ² = 42.8 on 49 degrees of freedom (limit 85.4); a flat band
  fails the Oracle (distance 0.21 > 0.15), a rough U passes (0.08); a fleet within 1e-7 of one start
  is spread by flash 60 like the invariant density.
- Headless run (jsdom, real three.js, stubbed WebGL renderer), no errors: bet 22 → split at 21;
  log-gap plot fills to 30 flashes; growth question; 1000× closer → 31 (+10) with both runs plotted
  and the 500-pair medians; two fountains charted; the Oracle rejects 0.5 with the true value and
  her twin beside it; a flat band is rejected with the true outlines; a painted U passes with
  the edges line; five logbook pages; exit. Zone 1 and the hub re-run clean.
- **Not verified: how it looks.** No WebGL browser was available.

## 1. Visual first pass (tester alone)

- [ ] Lane runs 0 to 1 with posts at 0.25, 0.5, 0.75; end posts read 0 and 1 (not −π, π).
- [ ] The camera opens centred on the lane; the lighthouse sits clear of the rule curve (a hump
      north of the lane, dipping south near 1).
- [ ] Twins overlap exactly at launch, then visibly split around flash 20. Can a player tell
      two boats have become two? (Both boats are the same colour: the engine has no per-boat tint.)
- [ ] Flashes every 0.9 s feel right; the beam follows the newest boat (twin B).
- [ ] Plot: log axis labels 1e−10 … 1e−1, dashed “visible (0.1)” line, gold dashed doubling line,
      solid dots for 10⁻⁷, hollow for 10⁻¹⁰, your bet and the true flash as vertical lines.
- [ ] Band painter: bars readable in light and dark; true outlines dashed and distinct.

## 2. Challenges (watch; don't explain)

**(a) Bet on the split.** Expect bets far too early (“1e−7 is nothing”) or far too late
(“it’s a millionth, so a million flashes”). Both are the interesting cases.
- [ ] Bet slider locks after launch; toast says split flash and how far off the bet was.
- [ ] Twins launch from the helm position (clamped to 0.05–0.95). Is that discoverable?

**(b) Read the gap.** Watch whether “each step up is ten times bigger” lands. Do they connect the
straight line with “the same factor every flash”?
- [ ] The growth question only appears once the gap has levelled off; either answer finishes.
- [ ] “Next: a thousand times closer” moves on.

**(c) A thousand times closer.** The prediction is the whole point: most people pick ×1000 or +100.
- [ ] Launch only after a prediction. Result names both flash counts and the difference.
- [ ] Medians over 500 pairs (21 vs 31) shown under the plot; the single run may differ by 1–2.

## 3. The Oracle (5–7 min)

- [ ] Any number is rejected; the number line shows you (ring), true (dot), her twin (square).
- [ ] Painting: drag works; keyboard ←/→ picks a bin and ↑/↓ sets it **without moving the camera**.
- [ ] Flat band → “Even-handed…”; hump in the middle → “Most of your band sits…”, with outlines.
- [ ] Rough U → pass; edges line if the ends are clearly heavier; “What the Oracle knows” unlocks.
- [ ] Her boat reaches flash 60 (≈ 54 s) and the toast confirms the true value she stated.
- Watch for: do players copy the outlines after one failure? (Allowed: no fail states.) Does
  anyone *predict* heavy edges before seeing them? That is the insight the edges line rewards.

## 4. Logbook and chart

- [ ] Pages: twins (a), the gap doubles (b), horizon (c), what the Oracle knows (boss), two
      fountains (optional chart of 0 and ¾). Cartographer level shows λ = ln 2 and ρ(x).
- [ ] Links go to Ch 2 (The butterfly effect).

## 5. Access and round trip

- [ ] Keyboard only: bet slider, launch buttons, prediction buttons, number field, band painter.
- [ ] Reduced motion: flashes wait for Space; the twins' split is still visible step by step.
- [ ] Ch 2 “Sail this chapter” → Zone 2; landing card mentions Zones 1–2; hub shows Zone 2 open.

## Timing notes (fill in)

| player | age | (a) bet / true | (b) | (c) prediction | Oracle tries | total | stuck on |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |

## Known limits and open questions

- Twins are identical boats; the split is readable from the lane and the readout, not by colour.
  A per-boat tint would be an engine change: propose only if playtests show confusion.
- The band threshold (0.15) is calibrated so flat fails and a rough U passes; tune after watching.
- Her 60-flash boat takes about a minute to arrive; players may leave the Oracle before it does.
