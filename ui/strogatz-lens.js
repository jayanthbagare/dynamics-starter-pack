// The "Strogatz lens" panel that closes every chapter: what to read next, how our notation maps
// onto the book's, and three original exercises that use the sims on this page.
//
//   renderLens(container, {
//     read: [{ ref: '§10.1', note: 'Fixed points and cobwebs' }],
//     notation: [['here', 'Strogatz', 'meaning'], …],
//     exercises: [{ html: 'Starting from …', sim: '?map=cos&x0=0#calculator' }],
//   });
//
// Section numbers only: never quote the book's text, figures, or exercises.

import { renderMath } from './math-layers.js';

export function renderLens(container, { read, notation, exercises }) {
  const el = document.createElement('aside');
  el.className = 'lens';
  el.setAttribute('aria-labelledby', 'lens-heading');
  el.innerHTML = `
    <h2 id="lens-heading">Strogatz lens</h2>

    <h3>Read next</h3>
    <ul class="lens-read">
      ${read.map((r) => `<li><span class="mono">${r.ref}</span> ${r.note}</li>`).join('')}
    </ul>

    <h3>Notation</h3>
    <div class="table-scroll">
      <table class="lens-notation">
        <thead><tr><th scope="col">On this site</th><th scope="col">In Strogatz</th><th scope="col">Meaning</th></tr></thead>
        <tbody>
          ${notation.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <h3>Exercises</h3>
    <ol class="lens-exercises">
      ${exercises.map((x) => `
        <li>${x.html}
          ${x.sim ? `<a class="open-sim" href="${x.sim}">Open in sim</a>` : ''}
        </li>`).join('')}
    </ol>`;
  container.append(el);
  renderMath(el);
  return el;
}
