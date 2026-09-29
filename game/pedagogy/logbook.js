// The logbook (key L). Pages unlock as the player discovers things. Every page reads at three
// levels, switchable at any time: Sailor (what you saw), Navigator (the proper names),
// Cartographer (the equations and the Strogatz section). It opens with notes on the player's own
// chart, and every page links back to its starter-pack chapter.
//
//   const log = createLogbook(host, {
//     zone: 1, progress,
//     entries: [{ id, title, sailor, navigator, cartographer, chapter: 1, read: '§10.1' }],
//     chapterHref: (n) => '…/chapters/01-iteration/',  chapterTitle: (n) => 'Iteration & fixed points',
//     annotate: (level) => 'html notes on the player’s chart',
//   });
//   log.unlock('harbour')   → true the first time
//   log.open(); log.close(); log.toggle(); log.refresh()

import { renderMath } from '../../ui/math-layers.js';

export const LEVELS = [
  ['sailor', 'Sailor'],
  ['navigator', 'Navigator'],
  ['cartographer', 'Cartographer'],
];

export function createLogbook(host, { zone, progress, entries, chapterHref, chapterTitle, annotate = () => '', onToggle = () => {} }) {
  const id = `log-${zone}`;
  const el = document.createElement('aside');
  el.className = 'logbook';
  el.id = id;
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', `${id}-h`);
  el.innerHTML = `
    <header class="logbook-head">
      <h2 id="${id}-h">Logbook</h2>
      <button type="button" class="button quiet logbook-close" aria-label="Close logbook">Close <kbd>L</kbd></button>
    </header>
    <div class="choice logbook-levels" role="radiogroup" aria-label="Reading level">
      ${LEVELS.map(([k, name]) => `<label><input type="radio" name="${id}-level" value="${k}"><span>${name}</span></label>`).join('')}
    </div>
    <div class="logbook-body"></div>`;
  host.append(el);

  const body = el.querySelector('.logbook-body');
  let level = progress.pref('logLevel', 'sailor');
  let returnFocus = null;
  el.querySelector(`input[value="${level}"]`).checked = true;
  el.querySelector('.logbook-levels').addEventListener('change', (e) => {
    level = e.target.value;
    progress.setPref('logLevel', level);
    render();
  });
  el.querySelector('.logbook-close').addEventListener('click', () => api.close());

  const unlocked = () => new Set(progress.zone(zone).log);

  function render() {
    const open = unlocked();
    const chartNotes = annotate(level);
    body.innerHTML = `
      <section class="log-chart">
        <h3>Your chart</h3>
        ${chartNotes || '<p class="muted">Nothing charted yet. Press <kbd>V</kbd> for the vantage and place a symbol.</p>'}
      </section>
      ${entries.map((e) => open.has(e.id) ? `
        <article class="log-entry">
          <h3>${e.title}</h3>
          <div class="log-text">${e[level]}</div>
          <p class="log-links">
            <a href="${chapterHref(e.chapter)}">Starter pack · Ch ${e.chapter}: ${chapterTitle(e.chapter)}</a>
            ${level === 'cartographer' && e.read ? `<span class="mono">Strogatz ${e.read}</span>` : ''}
          </p>
        </article>` : `
        <article class="log-entry locked" aria-label="A page not yet written">
          <h3 class="muted">· · ·</h3>
          <p class="muted">${e.hint || 'A page you haven’t written yet.'}</p>
        </article>`).join('')}`;
    renderMath(body);
  }

  const api = {
    el,
    get isOpen() { return !el.hidden; },
    get level() { return level; },
    open() {
      returnFocus = document.activeElement;
      render();
      el.hidden = false;
      el.querySelector('.logbook-close').focus();
      onToggle(true);
    },
    close() {
      el.hidden = true;
      if (returnFocus?.isConnected) returnFocus.focus();
      onToggle(false);
    },
    toggle() { el.hidden ? this.open() : this.close(); },
    unlock(entryId) {
      const log = progress.zone(zone).log;
      if (log.includes(entryId)) return false;
      progress.updateZone(zone, { log: [...log, entryId] });
      if (!el.hidden) render();
      return true;
    },
    has: (entryId) => unlocked().has(entryId),
    refresh() { if (!el.hidden) render(); },
  };
  return api;
}
