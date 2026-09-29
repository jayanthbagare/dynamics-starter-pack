# The Cartographer: design spec

## Purpose
Companion game to the Dynamics Starter Pack. It runs in laptop browsers for mixed-age learners. There are 6 zones plus an optional summit, about 18 minutes each, with a total of 2 hours or less.

## Principles
- The mechanic IS the mathematics. The player never steers the state; they reshape the world through the parameter.
- Challenges are beaten by reading the sea better, never by reflexes. There are no timers and no fail states. A wrong prediction shows the true path beside the guess.
- Touch first, name second, equation third.

## Verbs
- Buoy (state): click to drop a buoy that drifts with the flow, leaving a fading trail. Buoys come from a limited budget per zone.
- Ghost line (prediction): before releasing a buoy, the player drags a predicted path. The guess is scored against the true path.
- Chart (portrait): the vantage view (key V). The player places symbols (harbour = stable point, fountain = unstable, whirlpool = spiral, crossing = saddle, gyre = limit cycle, half-harbour = half-stable) and draws separatrices. The chart is graded against computed fixed points and their eigenvalues.
- Tide wheel (parameter): the [ and ] keys or a dial. Any change greys out the chart and marks it STALE.

## Logbook (key L)
The logbook has three reading levels, switchable at any time: Sailor (plain description of what the player saw), Navigator (proper names), and Cartographer (equations and the Strogatz section). It annotates the player's own chart and links back to the matching starter-pack chapter.

## Visuals
- Reuse the starter pack's colour tokens and light/dark behaviour. Stable = filled dot, unstable = hollow dot, half-stable = half-filled dot. Symbols must be distinguishable by shape, not only by colour.
- Use a stylised low-poly sea. NEVER draw vector-field arrows; the field is revealed only by buoys and particles.
- Discrete zones (1 to 3): a lighthouse flashes, and on each flash boats jump by the rule. The state lives on a 1D lane across the sea. The cobweb is drawn as the lighthouse beam bouncing between the rule curve and the diagonal.
- Continuous zones (4 to 6): buoys drift smoothly.

## Controls
WASD or arrow keys move the camera ship, click drops a buoy, drag draws a ghost line, scroll zooms, V toggles vantage, [ and ] turn the tide, L opens the logbook. Everything must be keyboard-accessible and respect prefers-reduced-motion.

## Architecture
- Static site on GitHub Pages with no backend. Add no build step unless the repo already has one.
- /game/index.html is the hub (a world chart of zones). Deep links use /game/?zone=N, and every zone must work standalone.
- Layers depend in one direction only:
  - sim/: pure JavaScript with no DOM. Iterated maps, RK4 integration, fixed-point finding, Jacobians and eigenvalues.
  - render/: three.js, loaded at a pinned version.
  - interact/: buoys, ghost lines, chart tools, tide wheel.
  - pedagogy/: prediction scoring, chart grading, logbook.
- Each zone is a config in zones/NN-name/config.js: rule, tide range, buoy budget, challenges, and boss script. Adding a zone must not require engine edits. If one seems necessary, propose it separately with a justification.
- Save progress and charts in localStorage, wrapped in try/catch, and degrade gracefully when storage is unavailable.
- Test sim/ and the pedagogy grading with node --test and no dependencies.
- Cross-links: each starter-pack chapter page gets a "Sail this chapter" button, and each logbook links back to its chapter.

## Zones
1. The Lighthouse: Ch 0 and 1 (iteration, fixed points, stability). Boss: The Keeper.
2. The Twin Fleets: Ch 2 (sensitive dependence). Boss: The Oracle.
3. The Splitting Reef: Ch 3 (period doubling, universality). Boss: The Mimic.
4. The River Mouth: Ch 4 and 5 (1D flows and their bifurcations). Boss: The Ratchet.
5. The Open Sea: Ch 6 and 7 (linear systems, phase plane, Hopf). Boss: The Gyre.
6. The Storm: Ch 8 (Lorenz). Boss: The Storm Itself.
S. The Summit: Ch 9 and 10 (fractals). Optional.

## Workflow for every zone
1. Read DESIGN.md and ENGINE.md.
2. Present a plan listing the files to create or change, then WAIT for approval.
3. Build the zone.
4. Get all tests passing.
5. Write zones/NN-name/PLAYTEST.md.
6. Update ENGINE.md with any new APIs.
7. STOP. Never start the next zone.
