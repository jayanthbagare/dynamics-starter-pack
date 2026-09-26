// Predict, then press: the student commits to a guess before the reveal.
//
//   createPredict(container, {
//     question: 'You’ll press cos over and over, starting from 2. What happens?',
//     options: [{ value: 'settles', label: 'settles on one number' }, …],
//     pressLabel: 'Press',
//     onPress: async (guess) => 'settles',          // run the reveal; return what actually happened
//     explain: (guess, actual) => 'Some html…',     // shown after the reveal
//     onReset: () => {},                            // optional: "try again" puts the sim back
//   });
//
// There is no score: the point is that a committed guess makes the reveal land.

import { renderMath } from './math-layers.js';

export function createPredict(container, { question, options, pressLabel = 'Press', onPress, explain, onReset = null }) {
  const name = `predict-${Math.random().toString(36).slice(2, 7)}`;
  const el = document.createElement('form');
  el.className = 'predict';
  el.innerHTML = `
    <fieldset>
      <legend><span class="predict-tag">Predict</span> ${question}</legend>
      <div class="predict-options">
        ${options.map((o) => `
          <label class="predict-option">
            <input type="radio" name="${name}" value="${o.value}">
            ${o.icon ? `<span class="predict-icon" aria-hidden="true">${o.icon}</span>` : ''}
            <span>${o.label}</span>
          </label>`).join('')}
      </div>
    </fieldset>
    <div class="predict-actions">
      <button type="submit" class="button primary" disabled>${pressLabel}</button>
      <span class="predict-hint muted">Pick a guess first.</span>
    </div>
    <div class="predict-result" aria-live="polite" hidden></div>`;
  container.append(el);
  renderMath(el);

  const radios = [...el.querySelectorAll('input[type=radio]')];
  const press = el.querySelector('button[type=submit]');
  const hint = el.querySelector('.predict-hint');
  const result = el.querySelector('.predict-result');
  const labelOf = (v) => options.find((o) => o.value === v)?.label ?? v;

  el.addEventListener('change', () => {
    press.disabled = !radios.some((r) => r.checked);
    hint.hidden = !press.disabled;
  });

  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const guess = radios.find((r) => r.checked)?.value;
    if (!guess) return;
    radios.forEach((r) => { r.disabled = true; });
    press.disabled = true;
    const actual = await onPress(guess);
    const right = guess === actual;
    result.hidden = false;
    result.innerHTML = `
      <p><strong>You said:</strong> ${labelOf(guess)}. <strong>What happened:</strong> ${labelOf(actual)}.
        ${right ? '' : '<span class="muted">Surprising? That’s the interesting part.</span>'}</p>
      ${explain ? `<div>${explain(guess, actual)}</div>` : ''}
      <button type="button" class="button quiet predict-again">Try again</button>`;
    renderMath(result);
    el.classList.add('revealed');
    result.querySelector('.predict-again').addEventListener('click', () => {
      radios.forEach((r) => { r.disabled = false; r.checked = false; });
      result.hidden = true; hint.hidden = false; press.disabled = true;
      el.classList.remove('revealed');
      onReset?.();
    });
  });

  return el;
}
