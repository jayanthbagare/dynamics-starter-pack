import { createStore } from '../../core/store.js';
import { mountLayout } from '../../core/layout.js';
import { mountMathLayers } from '../../ui/math-layers.js';
import { mountLens } from '../../ui/strogatz-lens.js';
import { mountPresenterMode } from '../../ui/presenter-mode.js';
import { MandelbrotView } from '../../views/mandelbrot-view.js';

mountLayout();
mountPresenterMode();

const store = createStore({
  cx: 0,
  cy: 0,
  zoom: 1.0,
  offsetX: -0.5,
  offsetY: 0
});

const mandelCanvas = document.getElementById('mandel-canvas');
const orbitCanvas = document.getElementById('orbit-canvas');
const orbitRead = document.getElementById('orbit-read');

const view = new MandelbrotView(mandelCanvas, orbitCanvas, orbitRead, store);

mountMathLayers();
mountLens(document.getElementById('lens'), {
  readNext: 'Strogatz §11.4 (The Mandelbrot Set).',
  notation: [
    { tex: 'z', desc: 'the state of the system, a complex number (x + iy)' },
    { tex: 'c', desc: 'the parameter, also a complex number, representing a location on the screen' }
  ],
  exercises: [
    'Explore the largest circle attached to the left of the main body (the "head"). Watch the orbit. What period does the cycle settle into? Now explore the bulb on top of the main body. What is its period?',
    'Zoom into the "valley" between the main body and the head. The spirals here are chaotic. Can you find a miniature Mandelbrot set floating in the dust?',
    'The Mandelbrot set is connected. What does that imply about all the isolated "dust" and "islands" you see when you zoom in?'
  ]
});
