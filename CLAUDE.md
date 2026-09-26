# Dynamics Starter Pack

An interactive, visual introduction to dynamical systems, built as a **starter pack for students
before they read Steven Strogatz, _Nonlinear Dynamics and Chaos_**. Hosted on GitHub Pages.

The job of this site: make Strogatz Ch 1–10 feel familiar before students open the book.
Maps-first intuition (after Feldman's SFI course), then a hinge into Strogatz's geometric,
flows-first vocabulary and notation.

## Audience
Students taught by the author (Jayanth). Assume one-variable calculus.
Linear algebra (eigenvalues) comfort: **TBD** — if shaky, Ch 6 opens with a visual primer
(a matrix transforming a grid; eigenvectors stay on their own lines).

## Design principles (apply to every chapter)
1. **Touch before formula.** Drag first, name second, equation third. Math sits behind a
   three-layer toggle: intuition / picture / equation.
2. **Predict, then press.** Before each reveal, the student commits to a guess
   (e.g. converges / oscillates / explodes). Use the shared `predict-then-press` widget.
3. **Linked views.** One store drives all views of a system; moving any control updates all.
4. **Readable source.** A student opening any system file should find a `step()` or `f()`
   of a few lines. Clarity beats cleverness everywhere in `/systems`.

## Notation and visual conventions (match Strogatz)
- Flows: `ẋ = f(x)`; fixed points `x*`; maps: `x_{n+1} = f(x_n)`.
- **Stable fixed point = filled dot. Unstable = hollow dot. Half-stable = half-filled.**
  Use from Ch 1 onward, everywhere.
- Consistent color semantics across the site (define once as CSS custom properties):
  trajectory, stable, unstable, parameter, highlight.
- Support light and dark themes.

## Visual direction
Calm and paper-like: generous whitespace, serif body text, monospace for numbers and code,
restrained palette where color carries meaning. Simulations are the visual heroes; chrome
stays quiet. No stock imagery, no decorative gradients.

## v1 chapters
| Ch | Folder | Title | Signature interaction | Strogatz |
|---|---|---|---|---|
| 0 | 00-prologue | State, rule, time | Press cos repeatedly → 0.739; also √ and x² | Ch 1 |
| 1 | 01-iteration | Iteration & fixed points | Cobweb, draggable seed; drag slope through magnitude 1 | §10.1–10.2 |
| 2 | 02-butterfly | The butterfly effect | Twin seeds 0.4 vs 0.4000001; log-scale separation; prediction game; random-vs-chaotic return map | §9.3, §10.5 |
| 3 | 03-bifurcation | Bifurcation & universality | Diagram builds live, click column → cobweb; draw-your-own hump → δ≈4.669 | §10.2–10.7 |
| 4 | 04-flows-line | Flows on the line (hinge) | Drag f(x); arrows and x* update on the axis; Euler as iteration | Ch 2 |
| 5 | 05-bifurcations-1d | Bifurcations in 1D flows | Tilting landscape; saddle-node, transcritical, pitchfork normal forms; hysteresis | Ch 3 |
| 6 | 06-linear | Linear systems | Drag point on trace–determinant plane; phase portrait morphs | Ch 5 |
| 7 | 07-phase-plane | The phase plane | Pendulum ↔ portrait; linearization zoom; competition; limit cycle; Hopf | Ch 6–8 |
| 8 | 08-lorenz | Lorenz: closing the loop | 10k-particle cloud; waterwheel; peak-to-peak map → tent map | Ch 9 |
| 9 | 09-fractal-dimension | The Cantor set & fractal dimension | Construct Cantor/Koch curves, zoom to see similarity | §11.1–11.3 |
| 10 | 10-mandelbrot | The Mandelbrot set | Zoomable Mandelbrot with linked orbit view | §11.4 |

Out of scope for v1 (do not build): magnetic pendulum, pattern formation.

## Every chapter ends with a "Strogatz lens" panel
Sections to read next, notation mapping, and **three original exercises** that use the sims.
**Never reproduce Strogatz's text, figures, or exercises** — cite section numbers only.

## Architecture
- **No build step.** Plain HTML + native ES modules, served directly from `main` by GitHub Pages.
  No npm, no bundler, no framework. A student must be able to fork and open it as-is.
- Vendor pinned copies of three.js and KaTeX into `/vendor` (no CDN at runtime).
- Canvas 2D for 2D views; three.js for landscape and Lorenz. Web Workers only if profiling demands.
- All relative paths must work under the Pages subpath (`/<repo-name>/`).

### Layout
```
/index.html                 landing + chapter index
/chapters/NN-name/index.html
/core/store.js              params + state, subscribe(), URL query sync
/core/integrate.js          euler, rk4
/core/layout.js             shared header/nav/footer include
/systems/*.js               one file per system
/views/*.js                 timeseries, cobweb, bifurcation, vectorfield1d, landscape,
                            phase2d, tracedet, scene3d, fractal-builder, mandelbrot-view
/ui/*.js                    slider, predict-then-press, presenter-mode, strogatz-lens,
                            math-layers toggle
/styles/base.css            tokens (colors, type, spacing), themes
/vendor/                    three.js, KaTeX
```

### System contract
```js
// map
export const logistic = { kind: 'map', params: { r: 3.2 },
  step: (x, { r }) => r * x * (1 - x) };
// flow
export const pendulum = { kind: 'flow', dim: 2, params: { g: 9.8, L: 1, b: 0 },
  f: ([θ, ω], { g, L, b }) => [ω, -(g / L) * Math.sin(θ) - b * ω] };
```
Views receive a store and subscribe; they never own simulation state.

### Cross-cutting features
- **URL state:** every sim's params/initial state sync to the query string
  (`?r=3.8284&x0=0.2`), so a link reproduces an exact setting.
- **Presenter mode:** key `P` toggles large type, hides prose, keyboard-driven sliders.
- Accessible: keyboard-operable controls, labels on sliders, never color alone for meaning.

## Milestones (each one ships to the live site)
- [x] M0 — repo, Pages enabled, live landing page
- [x] M1 — core (store, integrate, layout), timeseries + cobweb views → Ch 0–1
- [x] M2 — Ch 2
- [x] M3 — bifurcation view → Ch 3
- [x] M4 — vectorfield1d + landscape → Ch 4–5
- [x] M5 — tracedet + phase2d → Ch 6
- [x] M6 — Ch 7
- [x] M7 — scene3d → Ch 8
- [x] M8 — Ch 9 & 10 (Part III: Fractals)

## Working rules for Claude Code
- **Plan before executing.** For each milestone, propose a plan and wait for approval.
- One milestone per session. Don't start the next milestone unprompted.
- Small, meaningful commits (`core: add store with URL sync`, `ch1: cobweb interaction`).
  Push at the end of each milestone.
- Before declaring a milestone done: serve locally (`python3 -m http.server`), check every
  page loads with no console errors, check links under the Pages subpath, test light/dark.
- When a milestone ships, tick its box above and add a line to the log below.
- Do not add chapters, systems, or features that aren't in this file. Propose them instead.

## Log
<!-- date — milestone — note -->
- 2026-09-26 — M0 shipped: repo renamed to `dynamics-starter-pack`, Pages live at https://jayanthbagare.github.io/dynamics-starter-pack/ ; landing page with color tokens, light/dark/auto theme toggle, fixed-point legend, nine chapters listed as coming soon; README.
- 2026-09-26 — M1 shipped: core (store + URL sync, integrate, layout, fixedpoints), views (timeseries, cobweb), ui (slider, predict-then-press, math-layers w/ vendored KaTeX 0.18.9, strogatz-lens, presenter mode), systems (cos, sqrt, square, linear); Ch 0 (calculator, starts, fates) and Ch 1 (cobweb, fixed points, slope dial, zoom) live.
- 2026-09-26 — M2 shipped: Ch 2 live (twins with calm/chaotic toggle, gap on log scale with ruler → λ, "computer is a butterfly" aside, forecaster game with horizon-vs-digits fit, random-or-rule return maps); systems/logistic.js; timeseries gained log scale/twin style/ruler/markers, cobweb gained scatter points/twin path.
- 2026-09-26 — M3 shipped: views/bifurcation.js (live density-shaded build, click/drag/keys to pick, box zoom in URL); systems/hump.js (presets + natural-spline drawn hump); Ch 3 live (dial with 2- and 4-cycle predictions, live diagram with window presets, mark-your-own doublings → δ, draw-your-own hump with auto δ via superstable parameters: 4.669 for rounded tops, 7.285 flat top, none for tent).
- 2026-09-26 — M4 shipped: vendored three.js r186; core/spline.js (shared), findZeros for flows; views vectorfield1d, landscape (3D V(x;r) with slice, balls, floor diagram), timeseries continuous time, bifurcation branches mode; Ch 4 live (phase line, drag f(x), Euler = logistic map with r = 1 + h) and Ch 5 live (sticky 3D stage; saddle-node + bottleneck, transcritical, pitchfork with tilt, subcritical hysteresis). Store URL writes now throttled.
- 2026-09-26 — M5 shipped: systems/linear2d.js (eigen, classify, spring form); views phase2d (field, trajectories, eigen lines, particle cloud that idles off-screen) and tracedet (regions, snapping, thumbnails); Ch 6 live with the eigenvector primer (audience LA comfort still TBD, so primer included, open by default), uncoupled rates, eigenvector highways, and the trace–determinant map driving a spring. Centers drawn half-filled (neutral).
- 2026-09-26 — M6 shipped: Ch 7 live (pendulum ↔ portrait on a cylinder with separatrix and damping, linearization zoom with Ch 6 map, competition with nullclines and separatrix, van der Pol limit cycle and relaxation, Hopf with radius diagram and eigenvalue point on the τ–Δ map). systems: pendulum (contract form), competition, vanderpol, hopf; core: findFixedPoints2D + Jacobian; phase2d: level sets, curves, wrap, live state; canvases skip redraws off-screen.
- 2026-09-26 — M7 shipped, v1 complete: systems/lorenz.js; views/scene3d.js (10k-point cloud, fading trajectory, markers) and shared views/orbit-camera.js; Ch 8 live (Lorenz in 3D with r dial, waterwheel drawn from the Lorenz state, 10,000-particle ball with log-scale spread and ruler at 60 fps, peak-to-peak Lorenz map with cobweb and Ch 3 tent, closing-the-loop recap). README updated for v1.
- 2026-09-26 — M8 shipped, v2 Part III Fractals: Ch 9 live (Cantor set, Koch curve, similarity dimension with 3x magnifying glass); Ch 10 live (Mandelbrot set with WebGL fragment shader, linked complex plane orbit view); systems/mandelbrot.js; views fractal-builder + mandelbrot-view on shared canvas plumbing; layout nav extended to Ch 10; README updated for v2.
