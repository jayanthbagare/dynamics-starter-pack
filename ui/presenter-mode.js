// Presenter mode, for teaching from a projector.
//   P        toggle: large type, prose hidden (anything with class="prose")
//   [ / ]    move focus to the previous / next slider; ←/→ then adjust it
//   Space    press the chapter's primary button (the one marked data-primary)
// Keys are ignored while typing in a text field.

export function initPresenterMode() {
  const body = document.body;
  const badge = document.createElement('div');
  badge.className = 'presenter-badge';
  badge.setAttribute('role', 'status');
  badge.innerHTML = 'Presenter mode · <kbd>P</kbd> exit · <kbd>[</kbd> <kbd>]</kbd> sliders · <kbd>Space</kbd> press';
  badge.hidden = true;
  body.append(badge);

  const typing = (el) => el && (el.isContentEditable || /^(TEXTAREA|SELECT)$/.test(el.tagName)
    || (el.tagName === 'INPUT' && !/^(range|radio|checkbox|button|submit)$/.test(el.type)));

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(document.activeElement)) return;

    if (e.key === 'p' || e.key === 'P') {
      const on = body.classList.toggle('presenter');
      badge.hidden = !on;
      return;
    }
    if (!body.classList.contains('presenter')) return;

    if (e.key === '[' || e.key === ']') {
      const sliders = [...document.querySelectorAll('input[type=range]')].filter((s) => s.offsetParent);
      if (!sliders.length) return;
      const i = sliders.indexOf(document.activeElement);
      const j = e.key === ']' ? (i + 1) % sliders.length : (i <= 0 ? sliders.length - 1 : i - 1);
      sliders[j].focus();
      sliders[j].scrollIntoView({ block: 'center', behavior: 'smooth' });
      e.preventDefault();
    } else if (e.key === ' ' && !/^(BUTTON|A)$/.test(document.activeElement?.tagName)) {
      const primary = [...document.querySelectorAll('[data-primary]')].find((b) => b.offsetParent && !b.disabled);
      if (primary) { e.preventDefault(); primary.click(); }
    }
  });
}
