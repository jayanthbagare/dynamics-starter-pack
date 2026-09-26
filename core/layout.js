// Shared page chrome: header (brand, chapter crumb, theme toggle), prev/next nav, footer.
//
//   mountLayout({ chapter: 1 })   // on a chapter page
//   mountLayout()                 // on the landing page
//
// Pages provide <div class="wrap"><main>…</main></div>; the header goes before <main> and the
// footer after it. Links are built from this file's own URL, so they work at the domain root
// and under the GitHub Pages subpath (/dynamics-starter-pack/) without configuration.

import { initPresenterMode } from '../ui/presenter-mode.js';

export const ROOT = new URL('../', import.meta.url);

export const chapters = [
  { n: 0, folder: '00-prologue',        title: 'State, rule, time',          live: true },
  { n: 1, folder: '01-iteration',       title: 'Iteration & fixed points',   live: true },
  { n: 2, folder: '02-butterfly',       title: 'The butterfly effect',       live: true  },
  { n: 3, folder: '03-bifurcation',     title: 'Bifurcation & universality', live: true  },
  { n: 4, folder: '04-flows-line',      title: 'Flows on the line',          live: false },
  { n: 5, folder: '05-bifurcations-1d', title: 'Bifurcations in 1D flows',   live: false },
  { n: 6, folder: '06-linear',          title: 'Linear systems',             live: false },
  { n: 7, folder: '07-phase-plane',     title: 'The phase plane',            live: false },
  { n: 8, folder: '08-lorenz',          title: 'Lorenz: closing the loop',   live: false },
];

export const chapterURL = (c) => new URL(`chapters/${c.folder}/`, ROOT).href;

export function mountLayout({ chapter = null } = {}) {
  const wrap = document.querySelector('.wrap');
  const main = wrap.querySelector('main');
  const current = chapters.find((c) => c.n === chapter);

  main.insertAdjacentHTML('beforebegin', `
    <header class="site-header">
      <nav class="crumbs" aria-label="Site">
        <a class="brand" href="${ROOT.href}">dynamics starter pack</a>
        ${current ? `<span aria-hidden="true">/</span> <span class="crumb">Ch ${current.n}</span>` : ''}
      </nav>
      <button class="theme-toggle" type="button" aria-live="polite">theme: auto</button>
    </header>`);

  main.insertAdjacentHTML('afterend', `
    <footer class="site-footer">
      ${current ? chapterNav(current) : ''}
      <p>
        A companion to Steven H. Strogatz, <em>Nonlinear Dynamics and Chaos</em>. It is not
        affiliated with the book or its publisher and reproduces none of its text, figures, or
        exercises. Chapters cite sections of the book to read next.
      </p>
      <p>Plain HTML and JavaScript with no build step. Fork it and open <code>index.html</code>.
        Press <kbd>P</kbd> for presenter mode.</p>
    </footer>`);

  initThemeToggle(wrap.querySelector('.theme-toggle'));
  initPresenterMode();
}

function chapterNav(current) {
  const prev = chapters.find((c) => c.n === current.n - 1);
  const next = chapters.find((c) => c.n === current.n + 1);
  const link = (c, rel, arrow) => !c ? '<span></span>'
    : c.live
      ? `<a rel="${rel}" href="${chapterURL(c)}">${arrow === '←' ? '← ' : ''}Ch ${c.n}: ${c.title}${arrow === '→' ? ' →' : ''}</a>`
      : `<span class="muted">Ch ${c.n}: ${c.title} (coming soon)</span>`;
  return `<nav class="chapter-nav" aria-label="Chapters">
    ${link(prev, 'prev', '←')} ${link(next, 'next', '→')}
  </nav>`;
}

// Theme: auto → light → dark → auto. "auto" follows the OS setting. Each page also carries a
// tiny inline script in <head> that applies a saved theme before first paint.
function initThemeToggle(btn) {
  const root = document.documentElement;
  const order = ['auto', 'light', 'dark'];
  const current = () => root.dataset.theme || 'auto';
  const render = () => { btn.textContent = 'theme: ' + current(); };
  btn.addEventListener('click', () => {
    const next = order[(order.indexOf(current()) + 1) % order.length];
    if (next === 'auto') delete root.dataset.theme; else root.dataset.theme = next;
    try {
      if (next === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', next);
    } catch (e) {}
    render();
  });
  render();
}
