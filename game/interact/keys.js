// Game keys, ignored while the player is typing, and arrow keys left alone for a focused control
// that uses them (a slider, a radio group).
//
//   const off = onGameKeys((key, down, e) => { if (key === 'v' && down) toggleVantage(); return true; });
//
// key is e.key lower-cased for letters ('w', 'v', '[', ' ', 'arrowleft', 'escape').
// Return true from the handler to claim the key (preventDefault).

const ARROWS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown']);

export function onGameKeys(handler) {
  const typing = (el) => el && (el.isContentEditable || /^(TEXTAREA|SELECT)$/.test(el.tagName)
    || (el.tagName === 'INPUT' && !/^(range|radio|checkbox|button|submit)$/.test(el.type)));
  const usesArrows = (el) => el && ((el.tagName === 'INPUT' && /^(range|radio)$/.test(el.type))
    || el.getAttribute?.('role') === 'slider');
  const usesSpace = (el) => !!el && (/^(BUTTON|A|SUMMARY)$/.test(el.tagName) || (el.tagName === 'INPUT' && /^(radio|checkbox)$/.test(el.type)));

  const listen = (down) => (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    if (typing(el)) return;
    const key = e.key.toLowerCase();
    if (ARROWS.has(key) && usesArrows(el)) return;
    if (key === ' ' && usesSpace(el)) return;
    if (handler(key, down, e)) e.preventDefault();
  };
  const kd = listen(true), ku = listen(false);
  document.addEventListener('keydown', kd);
  document.addEventListener('keyup', ku);
  return () => { document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); };
}
