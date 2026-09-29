// Progress and charts, saved in localStorage. Every access is wrapped: in a private window, with
// storage blocked, or in node, progress simply lives in memory for this visit.
//
//   const progress = createProgress();          // or createProgress(fakeStorage) in tests
//   progress.zone(1)                            → { challenges: {}, boss: false, chart: [], log: [] }
//   progress.updateZone(1, { boss: true })
//   progress.pref('level', 'sailor')            // read, with a default
//   progress.setPref('level', 'navigator')
//   progress.persistent                         → false if nothing will survive a reload

const KEY = 'cartographer:v1';

export function createProgress(storage = defaultStorage()) {
  let data = { zones: {}, prefs: {} };
  let persistent = !!storage;
  try {
    const raw = storage?.getItem(KEY);
    if (raw) data = { zones: {}, prefs: {}, ...JSON.parse(raw) };
  } catch (e) { persistent = false; }

  const save = () => {
    if (!storage) return;
    try { storage.setItem(KEY, JSON.stringify(data)); } catch (e) { persistent = false; }
  };
  const blank = () => ({ challenges: {}, boss: false, chart: [], log: [] });

  return {
    get persistent() { return persistent; },
    zone: (n) => ({ ...blank(), ...data.zones[n] }),
    updateZone(n, patch) {
      data.zones[n] = { ...blank(), ...data.zones[n], ...patch };
      save();
      return data.zones[n];
    },
    resetZone(n) { delete data.zones[n]; save(); },
    pref: (k, fallback) => (k in data.prefs ? data.prefs[k] : fallback),
    setPref(k, v) { data.prefs[k] = v; save(); },
  };
}

function defaultStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (e) { return null; }
}
