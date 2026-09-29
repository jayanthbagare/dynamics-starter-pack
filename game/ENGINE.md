# The Cartographer: engine API notes

What exists, what each piece promises, and how a zone plugs in. Update this file whenever a zone
adds or changes an API. Each module's header comment has the same information in more detail.

## Layout

```
game/
  index.html, main.js      router: /game/ → hub, /game/?zone=N → zone N (standalone)
  hub.js                   world chart, zone cards, symbol legend, controls, progress reset
  zones/index.js           registry of zones (content: one line per zone, `live` flag)
  zones/NN-name/           config.js, main.js (+ zone-only files such as boss.js), PLAYTEST.md
  harness/discrete.js      composes the four layers into a playable discrete (map) zone
  sim/  render/  interact/  pedagogy/   the four engine layers
  styles/game.css          hub + HUD; colours only via site tokens
```

Dependency direction: `zones → harness → {pedagogy, interact, render} → sim`. `sim/` imports
nothing. `pedagogy/` grading imports `sim/` only in tests. Nothing in `sim/` or the pedagogy grading
touches the DOM, so `npm test` (`node --test "game/**/*.test.js"`) runs them with no dependencies.

Shared with the starter pack (reused, not copied): `core/store.js` (reactive store),
`core/layout.js` (`mountLayout({ crumb })`, `initThemeToggle`, `chapters`, `chapterURL`),
`views/canvas.js` (`tokens`, `onThemeChange`), `ui/math-layers.js` (`renderMath`, vendored KaTeX),
`vendor/three` (r186, pinned), `styles/base.css` (tokens, `.button`, `.choice`, `.chapter` cards).

## Zone contract

A zone is a folder `zones/NN-name/` plus a line in `zones/index.js`
(`{ key, n, folder, title, chapters, topic, boss, live, at }`).

`zones/NN-name/main.js` exports `start(root, { progress, chapterHref, chapterTitle, params })`.
`params` is the page's `URLSearchParams` (Zone 1 honours `&boss=1`).

`zones/NN-name/config.js` default export, as read by the discrete harness:

| key | meaning |
|---|---|
| `n`, `title` | zone number (progress key) and name |
| `domain` | lane range, e.g. `[-Math.PI, Math.PI]` |
| `laneScale` | world units per unit of state (default 4, which suits [−π, π]; [0, 1] wants about 20) |
| `laneEndLabels` | labels on the two end posts (default `['−π', 'π']`) |
| `laneTicks` | numbered posts along the lane |
| `lighthouse` | `[x, z]` world position of the lighthouse |
| `rule` | `{ step: (x, params) => number, params, tex }` |
| `buoyBudget` | boats allowed on the water at once |
| `flashEvery` | seconds between flashes |
| `chart` | `{ symbols: [...], tol }` palette subset and grading tolerance |
| `ghost` | `{ maxHops, tol }` (+ zone-specific keys such as `minHops`) |
| `logbook` | `[{ id, title, hint, sailor, navigator, cartographer, chapter, read }]` (HTML; `.tex` / `.tex-display` for KaTeX) |
| anything else | zone-specific (Zone 1: `challenges`, `startsNeeded`, `boss`) |

Zone code never edits the engine: it listens to harness events and calls harness methods.

## harness/discrete.js

`createDiscreteZone(root, { config, progress, chapterHref, chapterTitle })` → `z`, or `null` when
WebGL is unavailable (a message and links back are shown).

Events (`z.on(name, fn)` returns an unsubscribe function):

| event | payload | when |
|---|---|---|
| `drop` | buoy `{ id, xs, ghost? }` | a boat is put on the water (click, helm, ghost release) |
| `flash` | `{ moved }` | the lighthouse flashes and every boat takes one step |
| `ghost` | `{ buoy, score }` | a ghost line has been compared with its boat (see `scorePath`) |
| `chart` | `{ grade, truth }` | the player pressed Check chart |
| `chartEdit` | chart list | a symbol was placed, removed, undone or cleared |
| `tide` | value | the tide wheel changed (the rule is already swapped) |
| `rule` | rule | `setRule` ran |
| `vantage` | boolean | vantage toggled |
| `key` | key | any key the harness did not claim (Zone 1 uses `m`) |

Methods and fields: `setRule(rule)` (a rule may set `everyPointFixed: true` to make Check chart
explain instead of grade), `fixedPoints()`, `enableTide({ key, label, from, to, value, rule: v => rule })`
→ wheel, `disableTide()`, `tideWheel`, `flash()`, `drop(x0, extra)`, `focusBuoy()` (the boat the
beam follows: newest boat not adrift), `say(html, { sticky })`, `setChallenges(list, { onPick })`
(list items `{ id, title, done, active, pickable }`), `panel` (element the zone fills),
`setDock(x|null)`, `setTangent({ x, slope }|null)`, `clearGhost()`, `checkChart()`, and the layers:
`world, space, lane, beam, rig, fleet, chart, chartLayer, logbook, store`.

The camera starts centred on the lane, whatever its domain and scale.

Store keys: `cursor` (helm position), `vantage`, `paused`, `chartStale`, plus the tide key.
Any tide change marks a non-empty chart STALE (greyed symbols, badge) and removes a revealed truth.
Keys the harness owns: WASD/arrows, `V`, `L`, `Esc`, `[` `]` (Shift = ×10), `Space`, `R`, `+` `−`.
Reduced motion: waves still, hops instant, no lamp pulse, flashes paused until Space.

## sim/

`maps.js`: `iterate(step, x0, n, params)` → `[x0 … xn]`; `slopeAt(f, x, h)`;
`classifySlope(slope, tol = 1e-6)` → `'stable' | 'unstable' | 'half'`;
`findFixedPoints1D(step, [a, b], params, samples)` → `[{ x, slope, kind, alternates }]`
(`[]` when the rule is the identity).

Not built yet (for Zones 4–6): flows (`rk4`), 1D flow zeros, 2D fixed points, Jacobians,
eigenvalues. Add them as new files (`sim/flows.js`, `sim/plane.js`); do not change `maps.js`.

## render/

- `scene.js`: `createWorld(canvas, { reducedMotion })` → `world` or `null`.
  `world.paint(material, role, opacity)` registers a material for theme recolouring (roles are the
  token names plus `sea`, `rock`); `world.discard(obj)` removes and disposes; `world.onFrame(fn)`;
  `world.onPalette(fn)`; `world.pick(clientX, clientY)` → point on the water;
  `world.useCamera('ship' | 'vantage')`; `world.label(text, role, height)` → sprite.
  Exports `THREE` and `WATER` (height of lanes and marks).
- `camera-rig.js`: `createCameraRig(world, { target, distance, pitch, bounds })` → `hold(dir, down)`,
  `zoom(f)`, `setVantage(on)`, `frame([x0, z0, x1, z1])`, `home()`, `release()`.
- `lane.js`: `createLaneSpace({ domain, K })` → `toWorld(x)`, `atWorld([x])`, `cob(u, w)`,
  `fromWorld(v)`, `clamp`, `inside`, `bounds()`. The cobweb plane is rotated 45°: the lane is the
  diagonal. `createLane(world, space, { ticks })` → `setFleet(list)`, `setGhost(ghost)`,
  `setCursor(x)`, `setDock(x)`, `boatPosition(from, to, t)`.
- `cobweb-beam.js`: `createCobwebBeam(world, space, { lighthouse })` → `setRule(f)`,
  `setBeam(path, progress)`, `flash(worldPoint)`, `setTangent(t)`, `setRuleVisible(v)`.
- `symbols.js`: `buildSymbol(world, symbol, { muted, opacity, r })`, all six symbols, shape-distinct.
- `vantage.js`: `createChartLayer(world, space)` → `setSymbols`, `setTruth`, `setPreview`,
  `setStale`, `setVisible`. Positions are arrays (`at: [x]`), ready for plane zones.
- `shapes.js`: `tube`, `rod`, `dashed`, `arcPoints`. No vector-field arrows anywhere, by design.

For plane zones, write a `createPlaneSpace` with the same `atWorld / fromWorld / inside` shape so
`vantage.js` and chart grading work unchanged; `pointer.js` currently reports `space.fromWorld`,
which for a plane should return `[x, y]`.

## interact/

- `keys.js`: `onGameKeys((key, down, e) => claimed)`; ignores typing, leaves arrows to sliders.
- `pointer.js`: `attachSeaPointer(world, space, { onHover, onLeave, onClick, onDragStart, onDragMove, onDragEnd })`.
- `buoys.js`: `createFleet({ budget, inside })` → `setRule`, `drop`, `flash`, `recall`, `remove`,
  `list`, `remaining`. Boats leaving the lane go adrift, then free their slot.
- `ghost-line.js`: `createGhostLine({ maxHops })` → `begin`, `preview`, `hop`, `undo`, `clear`, `state`.
- `chart-tools.js`: `createChartModel(list, { tol })` (place toggles/replaces nearby marks, undo,
  clear), `createChartPalette(container, { symbols, onPlace, onUndo, onClear, onCheck })`,
  `symbolIcon(symbol, size)`, `SYMBOL_INFO`.
- `tide-wheel.js`: `createTideWheel(container, store, { key, label, from, to, step })` →
  `nudge(dir, big)`, `setRange`, `setMarks([{ value, kind: 'guess' | 'truth' }])`, `focus()`.
  `from` may exceed `to`; `]` always turns toward `to`.

## pedagogy/

- `predict-score.js`: `scorePath(guesses, truths, { tol })` → `{ steps, hits, total, score }`;
  `scoreValue(guess, target, tol)` → `{ error, hit, direction }`; `distance`.
- `chart-grading.js`: `SYMBOLS`, `symbolFor(fp)` (lane kinds → harbour / fountain / half-harbour;
  plane fixed points may carry `symbol`), `chartTruth(fixedPoints)`,
  `gradeChart(placed, truth, { tol })` → `{ ok, placed: [{ status: 'correct' | 'wrong-symbol' | 'misplaced', expected, target }], missing }`.
- `progress.js`: `createProgress(storage?)` → `zone(n)`, `updateZone(n, patch)`, `resetZone(n)`,
  `pref(k, fallback)`, `setPref(k, v)`, `persistent`. Key `cartographer:v1`; in-memory fallback.
- `logbook.js`: `createLogbook(host, { zone, progress, entries, chapterHref, chapterTitle, annotate, onToggle })`
  → `open`, `close`, `toggle`, `unlock(id)`, `has(id)`, `refresh()`, `level`. Level is a global pref.

## Tests

`npm test` or `node --test "game/**/*.test.js"`. `sim/maps.test.js`, `pedagogy/chart-grading.test.js`,
`pedagogy/predict-score.test.js` (also covers `progress.js`).
