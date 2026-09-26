// Chapter 10 · The Mandelbrot set
// One store holds the view (centre + zoom, in the URL); the set and the orbit view both read it.

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';
import { createMandelbrotView } from '../../views/mandelbrot-view.js';

mountLayout({ chapter: 10 });

const $ = (id) => document.getElementById(id);

const store = createStore(
  { zx: -0.6, zy: 0, zoom: 1 },
  { urlKeys: ['zx', 'zy', 'zoom'] },
);

createMandelbrotView($('mandel-canvas'), $('orbit-canvas'), $('orbit-read'), store);

$('reset-view').addEventListener('click', () => store.reset());

initMathLayers();
renderLens($('lens'), {
  read: [
    { ref: '§11.4', note: 'The Mandelbrot set, escape velocity, and the dictionary between c and the dynamics' },
    { ref: '§10.3', note: 'Back to where maps came from: the logistic map’s parameter r is one real slice of this picture' },
  ],
  notation: [
    ['<span class="tex">z</span>', '<span class="tex">z</span>', 'the state, a complex number <span class="tex">x + iy</span>'],
    ['<span class="tex">c</span>', '<span class="tex">c</span>', 'the parameter — a point of the plane you pick with the pointer'],
    ['<span class="tex">z_0 = 0</span>', '<span class="tex">z_0 = 0</span>', 'every orbit starts at the origin'],
    ['bounded orbit', '<span class="tex">c \\in M</span>', 'the point is in the Mandelbrot set'],
  ],
  exercises: [
    { html: 'Visit <span class="tex">c = -1</span>, the big bulb left of the body. Watch the orbit: what period does it settle into? Then find the bulb whose orbits have period 3 — this is where “period three implies chaos” lives on the page.',
      sim: '?zx=-1.05&zy=0&zoom=2.5' },
    { html: 'Visit <span class="tex">c = -2</span>, the tip of the needle. The orbit walks out to <span class="tex">z = 2</span> and stands exactly on the escape circle. Why does that count as bounded, and why is -2 the largest real c that survives?',
      sim: '?zx=-1.85&zy=0&zoom=3' },
    { html: 'Zoom into the valley between the main body and its head and hunt for a miniature copy of the whole set. Each minibrot sits at the centre of its own bulb-and-spoke decorations — check with the orbit view that points on it behave locally like the big one.',
      sim: '?zx=-1.75&zy=0&zoom=30' },
  ],
});
