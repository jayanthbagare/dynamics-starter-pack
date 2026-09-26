# Dynamics Starter Pack

An interactive, visual introduction to dynamical systems, built as a warm-up for
Steven Strogatz’s *Nonlinear Dynamics and Chaos*.

**Live site:** https://jayanthbagare.github.io/dynamics-starter-pack/

## Who it’s for

Students getting ready to read Strogatz. The goal is to make chapters 1–10 of the book feel
familiar before you open it. You only need one-variable calculus.

## How it works

It starts with maps (press a button, iterate a function, watch what happens), then moves on to
Strogatz’s flows-first, geometric way of thinking: flows on the line, bifurcations, phase planes,
and finally the Lorenz attractor. Every chapter follows the same pattern: **touch first, name
second, equation third**. You make a prediction before each reveal, and each chapter ends with
the Strogatz sections to read next.

Nine chapters (0–8) are planned. They go live one at a time.

## Run it locally

There is no build step: no npm, no bundler, no framework. Clone or fork the repo and serve the
folder:

```sh
python3 -m http.server
```

Then open <http://localhost:8000>. As chapters arrive, each system will live in its own small
file under `/systems` that you can read and change.

## Note on the book

This site is an independent companion. It is not affiliated with the book or its publisher, and
it does not reproduce its text, figures, or exercises. It only cites section numbers.
