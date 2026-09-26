# Dynamics Starter Pack

An interactive, visual introduction to dynamical systems, built as a warm-up for
Steven Strogatz’s *Nonlinear Dynamics and Chaos*.

**Live site:** https://jayanthbagare.github.io/dynamics-starter-pack/

## Who it’s for

Students getting ready to read Strogatz. The goal is to make chapters 1–10 of the book feel
familiar before you open it. You only need one-variable calculus. Chapter 6 opens with a short,
skippable primer on eigenvectors.

## How it works

It starts with maps (press a button, iterate a function, watch what happens), then moves on to
Strogatz’s flows-first, geometric way of thinking, and ends among the fractals the maps leave
behind: Cantor dust, the Koch curve, and the Mandelbrot set. Every chapter follows the same
pattern: **touch first, name second, equation third**. You make a prediction before each reveal,
and every chapter ends with a *Strogatz lens*: the sections to read next, how our notation maps
onto the book’s, and three exercises that use the simulations.

| Ch | Chapter | Strogatz |
|---|---|---|
| 0 | [State, rule, time](chapters/00-prologue/) | Ch 1 |
| 1 | [Iteration & fixed points](chapters/01-iteration/) | §10.1–10.2 |
| 2 | [The butterfly effect](chapters/02-butterfly/) | §9.3, §10.5 |
| 3 | [Bifurcation & universality](chapters/03-bifurcation/) | §10.2–10.7 |
| 4 | [Flows on the line](chapters/04-flows-line/) | Ch 2 |
| 5 | [Bifurcations in 1D flows](chapters/05-bifurcations-1d/) | Ch 3 |
| 6 | [Linear systems](chapters/06-linear/) | Ch 5 |
| 7 | [The phase plane](chapters/07-phase-plane/) | Ch 6–8 |
| 8 | [Lorenz: closing the loop](chapters/08-lorenz/) | Ch 9 |
| 9 | [The Cantor set & fractal dimension](chapters/09-fractal-dimension/) | §11.1–11.3 |
| 10 | [The Mandelbrot set](chapters/10-mandelbrot/) | §11.4 |

Every simulation keeps its settings in the address bar, so a link reproduces exactly what you see.
Press <kbd>P</kbd> on any page for presenter mode (large type, prose hidden, keyboard sliders).

## Run it locally

There is no build step: no npm, no bundler, no framework. Clone or fork the repo and serve the
folder:

```sh
python3 -m http.server
```

Then open <http://localhost:8000>.

## Where things are

```
systems/     one small file per system: a step() for maps, an f() for flows. Start reading here.
core/        store (shared state + URL sync), integrate (orbit, Euler, RK4), fixed points, spline, layout
views/       timeseries, cobweb, bifurcation, vectorfield1d, landscape (3D), phase2d, tracedet, scene3d (3D),
             fractal-builder (Cantor/Koch), mandelbrot-view (WebGL set + orbit)
ui/          slider, predict-then-press, math layers (KaTeX), Strogatz lens, presenter mode
chapters/    one folder per chapter: index.html + main.js (plus any chapter-only views)
styles/      base.css: colour tokens (light and dark), type, and components
vendor/      pinned copies of KaTeX and three.js (nothing loads from a CDN)
```

Colours mean the same thing everywhere: trajectories, stable (filled dots), unstable (hollow dots),
the parameter you are turning, and a highlight. Half-filled dots are neutral or half-stable.

## Note on the book

This site is an independent companion. It is not affiliated with the book or its publisher, and
it does not reproduce its text, figures, or exercises. It only cites section numbers.
