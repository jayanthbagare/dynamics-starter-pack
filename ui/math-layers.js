// Three layers for every idea: intuition / picture / equation.
//
//   <div class="layers">
//     <div data-layer="intuition">…</div>
//     <div data-layer="picture">…</div>
//     <div data-layer="equation">… <span class="tex">x_{n+1} = \cos x_n</span> …</div>
//   </div>
//
// initMathLayers() turns each block into tabs. Choosing a tab switches that block and becomes
// the default for blocks on other pages. renderMath() typesets .tex (inline) and .tex-display.

import katex from '../vendor/katex/katex.mjs';

const LAYERS = [
  ['intuition', 'Intuition'],
  ['picture', 'Picture'],
  ['equation', 'Equation'],
];
const PREF = 'math-layer';

// KaTeX's stylesheet travels with this module, so pages don't have to remember it.
if (!document.querySelector('link[data-katex]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../vendor/katex/katex.min.css', import.meta.url).href;
  link.dataset.katex = '';
  document.head.append(link);
}

export function renderMath(root = document) {
  for (const el of root.querySelectorAll('.tex, .tex-display')) {
    if (el.dataset.rendered) continue;
    katex.render(el.textContent, el, { displayMode: el.classList.contains('tex-display'), throwOnError: false });
    el.dataset.rendered = '1';
  }
}

export function initMathLayers(root = document) {
  let preferred = 'intuition';
  try { preferred = localStorage.getItem(PREF) || preferred; } catch (e) {}

  root.querySelectorAll('.layers').forEach((block, bi) => {
    const panels = Object.fromEntries(LAYERS.map(([k]) => [k, block.querySelector(`[data-layer="${k}"]`)]));
    const tabs = document.createElement('div');
    tabs.className = 'layer-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Explanation layer');
    block.prepend(tabs);

    const buttons = LAYERS.filter(([k]) => panels[k]).map(([k, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = `layer-${bi}-${k}`;
      b.textContent = label;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', `layer-${bi}-${k}-panel`);
      panels[k].id = `layer-${bi}-${k}-panel`;
      panels[k].setAttribute('role', 'tabpanel');
      panels[k].setAttribute('aria-labelledby', b.id);
      b.addEventListener('click', () => {
        show(k);
        try { localStorage.setItem(PREF, k); } catch (e) {}
      });
      tabs.append(b);
      return [k, b];
    });

    function show(k) {
      for (const [key, b] of buttons) {
        const on = key === k;
        b.setAttribute('aria-selected', on);
        b.tabIndex = on ? 0 : -1;
        panels[key].hidden = !on;
      }
    }

    // arrow keys move between tabs
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = buttons.findIndex(([, b]) => b === document.activeElement);
      const j = (i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length;
      buttons[j][1].focus(); buttons[j][1].click();
    });

    show(panels[preferred] ? preferred : buttons[0][0]);
  });

  renderMath(root);
}
