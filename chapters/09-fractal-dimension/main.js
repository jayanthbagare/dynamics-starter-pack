// Chapter 9 · The Cantor set & fractal dimension
// One store drives the Cantor construction, the Koch construction, and the magnifying glass.

import { mountLayout } from '../../core/layout.js';
import { createStore } from '../../core/store.js';
import { createSlider } from '../../ui/slider.js';
import { createPredict } from '../../ui/predict-then-press.js';
import { initMathLayers } from '../../ui/math-layers.js';
import { renderLens } from '../../ui/strogatz-lens.js';
import { createFractalBuilder } from '../../views/fractal-builder.js';

mountLayout({ chapter: 9 });

const $ = (id) => document.getElementById(id);

const store = createStore(
  { cantorGen: 4, kochGen: 3 },
  { urlKeys: ['cantorGen', 'kochGen'] },
);

// --- §11.1 the Cantor set -------------------------------------------------------------------

createPredict($('predict-cantor'), {
  question: 'Repeat the cut forever. What happens to what’s left?',
  options: [
    { value: 'half', label: 'it settles at half the original length' },
    { value: 'zero', label: 'the total length goes to zero, but points survive' },
    { value: 'dust', label: 'only the endpoints of the cuts survive, a countable dust' },
  ],
  pressLabel: 'Cut forever',
  onPress: async () => {
    for (let n = store.get().cantorGen; n <= 7; n++) {
      store.set({ cantorGen: n });
      await new Promise((r) => setTimeout(r, 240));
    }
    return 'zero';
  },
  explain: () => `<p>At step <span class="tex">n</span> there are <span class="tex">2^n</span> pieces of length
    <span class="tex">3^{-n}</span>, so the total length is <span class="tex">(2/3)^n \\to 0</span>. And yet the
    leftovers are far more than endpoints: any address made of endless left/right choices, like
    <span class="tex">0.202020…_3</span>, survives. Zero length, uncountably many points.</p>`,
  onReset: () => store.set({ cantorGen: 4 }),
});

createSlider($('cantor-controls'), store, {
  key: 'cantorGen', label: 'cuts n', min: 0, max: 7, step: 1, format: (v) => String(v),
});
createSlider($('koch-controls'), store, {
  key: 'kochGen', label: 'folds n', min: 0, max: 6, step: 1, format: (v) => String(v),
});

// --- views -----------------------------------------------------------------------------------

const cantorView = createFractalBuilder($('stage-cantor'), { type: 'cantor' });
const kochView = createFractalBuilder($('stage-koch'), { type: 'koch' });
const glassView = createFractalBuilder($('glass-koch'), { type: 'koch-glass' });

function render(s) {
  cantorView.render(s.cantorGen);
  kochView.render(s.kochGen);
  glassView.render(5);
  $('cantor-read').textContent =
    `n = ${s.cantorGen} · ${2 ** s.cantorGen} pieces · total length = ${((2 / 3) ** s.cantorGen).toFixed(4)} of the original`;
  $('koch-read').textContent =
    `n = ${s.kochGen} · ${4 ** s.kochGen} segments · length = ${((4 / 3) ** s.kochGen).toFixed(3)} × the original`;
}

store.subscribe(render);
render(store.get());

// --- Strogatz lens ----------------------------------------------------------------------------

initMathLayers();
renderLens($('lens'), {
  read: [
    { ref: '§11.1', note: 'Countable and uncountable sets; the Cantor set' },
    { ref: '§11.2', note: 'Dimension of fractals, and the similarity dimension used here' },
    { ref: '§11.3', note: 'Box dimension — a second way to measure the same idea' },
  ],
  notation: [
    ['<span class="tex">d</span>', '<span class="tex">d</span>', 'similarity dimension'],
    ['<span class="tex">N = r^d</span>', '<span class="tex">N(\\varepsilon) \\sim \\varepsilon^{-d}</span>', 'N copies at scale 1/r'],
    ['Cantor: <span class="tex">N = 2,\\ r = 3</span>', 'example 11.2.1', '<span class="tex">d = \\ln 2 / \\ln 3 \\approx 0.63</span>'],
    ['Koch: <span class="tex">N = 4,\\ r = 3</span>', 'example 11.2.2', '<span class="tex">d = \\ln 4 / \\ln 3 \\approx 1.26</span>'],
  ],
  exercises: [
    { html: 'Cut the middle <em>half</em> of each piece instead of the middle third. Sketch three steps by hand, then work out its similarity dimension. Which is “bigger”, this set or the middle-thirds Cantor set?',
      sim: '?cantorGen=7' },
    { html: 'Divide a square into a 3 × 3 grid and remove the centre square; repeat forever on the survivors (the Sierpinski carpet). Count <span class="tex">N</span> and <span class="tex">r</span> and find <span class="tex">d</span>. Sanity-check it against the Koch curve’s 1.26.' },
    { html: 'The Koch curve’s length grows by 4/3 at every fold, yet the snowflake it bounds has <em>finite</em> area. Watch the length readout race upwards, then explain what the area does instead — and what dimension has to do with the difference.',
      sim: '?kochGen=6' },
  ],
});
