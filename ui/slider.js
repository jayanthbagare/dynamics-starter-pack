// A labelled range slider bound to one store key.
//
//   createSlider(container, store, {
//     key: 'm', label: 'slope m', min: -2, max: 2, step: 0.01,
//     ticks: [-1, 0, 1],                 // optional marks under the track
//     format: (v) => v.toFixed(2),       // optional readout format
//     commit: (v) => ({ … }),            // optional: extra patch when the user lets go
//   });
//
// min and max may be functions of the store state, for ranges that depend on another control.

export function createSlider(container, store, {
  key, label, min, max, step = 0.01, ticks = [], format = (v) => String(v), commit = null,
}) {
  const id = `slider-${key}-${Math.random().toString(36).slice(2, 7)}`;
  const el = document.createElement('div');
  el.className = 'slider';
  el.innerHTML = `
    <label for="${id}">${label}</label>
    <output for="${id}" class="mono"></output>
    <div class="slider-track">
      <input id="${id}" type="range" step="${step}">
      <div class="slider-ticks" aria-hidden="true"></div>
    </div>`;
  container.append(el);

  const input = el.querySelector('input');
  const output = el.querySelector('output');
  const tickBox = el.querySelector('.slider-ticks');
  const val = (x) => (typeof x === 'function' ? x(store.get()) : x);

  function render() {
    const s = store.get();
    const lo = val(min), hi = val(max);
    input.min = lo; input.max = hi;
    input.value = s[key];
    output.textContent = format(s[key]);
    tickBox.innerHTML = ticks
      .filter((t) => t >= lo && t <= hi)
      .map((t) => `<span style="left:${((t - lo) / (hi - lo)) * 100}%">${format(t)}</span>`)
      .join('');
  }

  input.addEventListener('input', () => store.set({ [key]: Number(input.value) }));
  if (commit) input.addEventListener('change', () => store.set(commit(Number(input.value))));
  store.subscribe(render);
  render();
  return { input };
}
