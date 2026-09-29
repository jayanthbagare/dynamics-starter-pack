// The tide wheel: the one control that changes the world (the parameter). A ship's wheel that
// turns with a drag, the arrow keys when focused, or [ and ] from anywhere (via nudge).
//
//   const wheel = createTideWheel(container, store, {
//     key: 'a', label: 'tide · a', from: 0.3, to: 1.3, step: 0.01,
//   });
//   wheel.nudge(+1)                     // one step toward `to`; nudge(+1, true) for ten steps
//   wheel.setRange(from, to)            // `from` may be larger than `to`: ] always turns toward `to`
//   wheel.setMarks([{ value, kind: 'guess' | 'truth' }])
//
// The wheel only writes store[key]; whoever owns the rule listens to the store.

const SWEEP = 135; // degrees either side of top

export function createTideWheel(container, store, { key, label, from, to, step = 0.01, format = (v) => v.toFixed(2) }) {
  const el = document.createElement('div');
  el.className = 'tide-wheel';
  const id = `tide-${Math.random().toString(36).slice(2, 7)}`;
  el.innerHTML = `
    <svg class="dial" viewBox="-52 -52 104 104" role="slider" tabindex="0" aria-labelledby="${id}">
      <path class="dial-track" d=""/>
      <g class="dial-marks"></g>
      <g class="dial-wheel">
        <circle class="dial-rim" r="30"/>
        ${Array.from({ length: 8 }, (_, i) => `<line class="dial-spoke" x1="0" y1="0" x2="${(40 * Math.sin((i * Math.PI) / 4)).toFixed(2)}" y2="${(-40 * Math.cos((i * Math.PI) / 4)).toFixed(2)}"/>`).join('')}
        <circle class="dial-hub" r="6"/>
        <circle class="dial-handle" cx="0" cy="-40" r="5"/>
      </g>
      <text class="dial-end dial-from" x="-40" y="48"></text>
      <text class="dial-end dial-to" x="40" y="48"></text>
    </svg>
    <div class="tide-readout">
      <span class="tide-label" id="${id}">${label}</span>
      <output class="mono"></output>
      <span class="muted tide-hint"><kbd>[</kbd> <kbd>]</kbd></span>
    </div>`;
  container.append(el);

  const svg = el.querySelector('svg');
  const wheelG = el.querySelector('.dial-wheel');
  const out = el.querySelector('output');
  const marksG = el.querySelector('.dial-marks');
  let marks = [];

  const tOf = (v) => (v - from) / (to - from);
  const vOf = (t) => {
    const raw = from + Math.min(1, Math.max(0, t)) * (to - from);
    return +(Math.round(raw / step) * step).toFixed(6);
  };
  const angle = (t) => -SWEEP + 2 * SWEEP * t;
  const polar = (deg, r) => [r * Math.sin((deg * Math.PI) / 180), -r * Math.cos((deg * Math.PI) / 180)];

  function render() {
    const v = store.get()[key];
    const t = tOf(v);
    wheelG.setAttribute('transform', `rotate(${angle(t)})`);
    out.textContent = format(v);
    svg.setAttribute('aria-valuenow', v);
    svg.setAttribute('aria-valuemin', Math.min(from, to));
    svg.setAttribute('aria-valuemax', Math.max(from, to));
    svg.setAttribute('aria-valuetext', `${label} ${format(v)}`);
    const [x0, y0] = polar(-SWEEP, 46), [x1, y1] = polar(SWEEP, 46);
    el.querySelector('.dial-track').setAttribute('d', `M ${x0} ${y0} A 46 46 0 1 1 ${x1} ${y1}`);
    el.querySelector('.dial-from').textContent = format(from);
    el.querySelector('.dial-to').textContent = format(to);
    marksG.innerHTML = marks.map((m) => {
      const deg = angle(tOf(m.value));
      return `<g transform="rotate(${deg})"><path class="dial-mark ${m.kind}" d="M 0 -41 L -4.5 -51 L 4.5 -51 Z"><title>${m.kind === 'truth' ? 'true value' : 'your mark'} ${format(m.value)}</title></path></g>`;
    }).join('');
  }

  const set = (v) => store.set({ [key]: v });
  const nudge = (dir, big = false) => set(vOf(tOf(store.get()[key]) + (dir * step * (big ? 10 : 1)) / Math.abs(to - from)));

  // drag: the pointer's angle around the centre sets the value
  const fromPointer = (e) => {
    const r = svg.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    set(vOf((deg + SWEEP) / (2 * SWEEP)));
  };
  let dragging = false;
  svg.addEventListener('pointerdown', (e) => { dragging = true; svg.setPointerCapture(e.pointerId); fromPointer(e); });
  svg.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });
  svg.addEventListener('keydown', (e) => {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (dir) { e.preventDefault(); nudge(dir, e.shiftKey); }
    else if (e.key === 'Home') { e.preventDefault(); set(from); }
    else if (e.key === 'End') { e.preventDefault(); set(to); }
  });

  store.subscribe((_, changed) => { if (changed.has(key)) render(); });
  render();

  return {
    el,
    nudge,
    setRange(f, t) { from = f; to = t; render(); },
    setMarks(m) { marks = m; render(); },
    focus() { svg.focus(); },
  };
}
