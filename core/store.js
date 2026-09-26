// A tiny reactive store: one flat object of params + state that every view reads.
//
//   const store = createStore({ map: 'cos', x0: 2, n: 0 }, { urlKeys: ['map', 'x0', 'n'] });
//   store.subscribe((state, changed) => draw(state));
//   store.set({ x0: 0.5 });
//
// Subscribers are called at most once per animation frame, with the set of keys that changed.
// Keys listed in `urlKeys` are read from the query string on load and written back on change,
// so a link reproduces an exact setting. Several stores can share a page as long as their
// URL keys don't overlap.

export function createStore(defaults, { urlKeys = [] } = {}) {
  let state = { ...defaults, ...readURL(defaults, urlKeys) };
  const subscribers = new Set();
  let changed = new Set();
  let scheduled = false;
  let urlTimer = null;

  function notify() {
    if (scheduled) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      const keys = changed;
      changed = new Set();
      for (const fn of subscribers) fn(state, keys);
    });
  }

  function writeURL() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const url = new URL(location.href);
      for (const k of urlKeys) {
        if (state[k] === defaults[k]) url.searchParams.delete(k);
        else url.searchParams.set(k, encode(state[k]));
      }
      history.replaceState(history.state, '', url);
    }, 150);
  }

  return {
    get: () => state,

    set(patch) {
      let any = false;
      for (const k in patch) {
        if (!Object.is(state[k], patch[k])) { changed.add(k); any = true; }
      }
      if (!any) return;
      state = { ...state, ...patch };
      notify();
      if (urlKeys.some((k) => k in patch)) writeURL();
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    reset() { this.set({ ...defaults }); },
  };
}

// --- helpers -------------------------------------------------------------

const schedule = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : (fn) => queueMicrotask(fn);

// Numbers go into the URL with enough digits to reproduce a setting, but not float noise.
function encode(v) {
  if (typeof v === 'number') return String(Number(v.toPrecision(10)));
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

// Values come back typed like their defaults; anything unparsable is ignored.
function readURL(defaults, urlKeys) {
  if (typeof location === 'undefined') return {};
  const params = new URLSearchParams(location.search);
  const out = {};
  for (const k of urlKeys) {
    if (!params.has(k)) continue;
    const raw = params.get(k);
    const d = defaults[k];
    if (typeof d === 'number') {
      const v = Number(raw);
      if (raw !== '' && Number.isFinite(v)) out[k] = v;
    } else if (typeof d === 'boolean') {
      out[k] = raw === '1' || raw === 'true';
    } else {
      out[k] = raw;
    }
  }
  return out;
}
