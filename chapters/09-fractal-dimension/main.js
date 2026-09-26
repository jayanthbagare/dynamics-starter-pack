import { createStore } from '../../core/store.js';
import { mountLayout } from '../../core/layout.js';
import { attachSlider } from '../../ui/slider.js';
import { attachPredictThenPress } from '../../ui/predict-then-press.js';
import { mountMathLayers } from '../../ui/math-layers.js';
import { mountLens } from '../../ui/strogatz-lens.js';
import { mountPresenterMode } from '../../ui/presenter-mode.js';
import { FractalBuilder } from '../../views/fractal-builder.js';

mountLayout();
mountPresenterMode();

const store = createStore({
  cantorGen: 0,
  kochGen: 0
});

// Predict: Cantor
attachPredictThenPress(document.getElementById('predict-cantor'), {
  id: 'cantor-fate',
  question: 'What is the total length of the remaining pieces as we repeat this forever?',
  options: [
    { value: 'half', label: '1/2', text: 'It settles to exactly half the original length.' },
    { value: 'zero', label: '0', text: 'The length goes to zero, leaving only points.' },
    { value: 'inf', label: 'Infinity', text: 'The number of pieces explodes.' }
  ],
  onReveal: () => {
    store.set({ cantorGen: 6 });
  }
});

// Cantor UI
const cantorControls = document.getElementById('cantor-controls');
attachSlider(cantorControls, {
  id: 'cantorGen', label: 'Generation', min: 0, max: 7, step: 1, value: store.get().cantorGen,
  onChange: (val) => store.set({ cantorGen: val })
});
const cantorRead = document.getElementById('cantor-read');
store.subscribe(s => {
  const pieces = Math.pow(2, s.cantorGen);
  const length = Math.pow(2/3, s.cantorGen).toFixed(3);
  cantorRead.textContent = `n = ${s.cantorGen}: ${pieces} pieces, total length = ${length}`;
});

// Koch UI
const kochControls = document.getElementById('koch-controls');
attachSlider(kochControls, {
  id: 'kochGen', label: 'Generation', min: 0, max: 6, step: 1, value: store.get().kochGen,
  onChange: (val) => store.set({ kochGen: val })
});
const kochRead = document.getElementById('koch-read');
store.subscribe(s => {
  const pieces = Math.pow(4, s.kochGen);
  const length = Math.pow(4/3, s.kochGen).toFixed(2);
  kochRead.textContent = `n = ${s.kochGen}: ${pieces} pieces, total length = ${length}`;
});

// Views
const stageCantor = document.getElementById('stage-cantor');
const stageKoch = document.getElementById('stage-koch');
const glassKoch = document.getElementById('glass-koch');

const viewCantor = new FractalBuilder(stageCantor, { type: 'cantor' });
const viewKoch = new FractalBuilder(stageKoch, { type: 'koch' });
const viewGlass = new FractalBuilder(glassKoch, { type: 'koch-glass' });

store.subscribe(s => {
  viewCantor.render(s.cantorGen);
  viewKoch.render(s.kochGen);
  viewGlass.render(5); // Fixed high generation for glass
});

mountMathLayers();
mountLens(document.getElementById('lens'), {
  readNext: 'Strogatz §11.1–11.3 (Fractals and the Cantor Set, Similarity Dimension).',
  notation: [
    { tex: 'd', desc: 'similarity dimension' },
    { tex: 'N', desc: 'number of small copies needed to build the whole' },
    { tex: 'r', desc: 'scale factor by which each copy is shrunk' }
  ],
  exercises: [
    'For the Cantor set, what happens to the dimension if instead of removing the middle third, you remove the middle half? Use the similarity dimension formula to find out.',
    'Imagine a square where you divide it into 9 smaller squares (a 3x3 grid) and remove the middle one, leaving 8. If you repeat this forever on the remaining squares (the Sierpinski carpet), what is its similarity dimension?',
    'The Koch curve has a length that goes to infinity. What happens to the area under the Koch curve as n goes to infinity? Is it infinite too?'
  ]
});
