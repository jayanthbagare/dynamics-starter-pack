// A discrete zone, ready to play: the lighthouse, the lane, boats that jump on each flash, ghost
// lines, the chart, the tide wheel, the logbook and the HUD. It composes the four engine layers;
// a zone supplies a config and listens to events to run its challenges and boss.
//
//   const z = createDiscreteZone(root, { config, progress, chapterHref, chapterTitle });
//   z.on('drop' | 'flash' | 'ghost' | 'chart' | 'chartEdit' | 'tide' | 'key' | 'vantage', fn)
//   z.setRule({ step, params, tex })         // the rule every boat obeys
//   z.enableTide({ key, label, from, to, value, rule: (v) => ({ step, params, tex }) })
//   z.disableTide()
//   z.fixedPoints()                           → sim fixed points of the current rule
//   z.say(html)                               // the HUD message line (read out to screen readers)
//   z.setChallenges([{ id, title, done, active }], { onPick });  z.panel  (an element the zone fills)
//   z.focusBuoy()                             → the boat the beam follows
//   z.setDock(x | null); z.setTangent({ x, slope } | null)
//   z.lane, z.beam, z.fleet, z.chart, z.logbook, z.store, z.world  (the layers, for zone code)
//
// config: { n, title, domain, laneScale, laneEndLabels, rule, buoyBudget, flashEvery, laneTicks, chart: { symbols, tol },
//           ghost: { maxHops, tol }, logbook: [entries] }

import { createStore } from '../../core/store.js';
import { initThemeToggle } from '../../core/layout.js';
import { findFixedPoints1D } from '../sim/maps.js';
import { createWorld } from '../render/scene.js';
import { createCameraRig } from '../render/camera-rig.js';
import { createLaneSpace, createLane } from '../render/lane.js';
import { createCobwebBeam } from '../render/cobweb-beam.js';
import { createChartLayer } from '../render/vantage.js';
import { onGameKeys } from '../interact/keys.js';
import { attachSeaPointer } from '../interact/pointer.js';
import { createFleet } from '../interact/buoys.js';
import { createGhostLine } from '../interact/ghost-line.js';
import { createChartModel, createChartPalette, symbolIcon, SYMBOL_INFO } from '../interact/chart-tools.js';
import { createTideWheel } from '../interact/tide-wheel.js';
import { scorePath } from '../pedagogy/predict-score.js';
import { gradeChart, chartTruth } from '../pedagogy/chart-grading.js';
import { createLogbook } from '../pedagogy/logbook.js';

const HOP = 0.55; // seconds a boat spends in the air

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '—');

export function createDiscreteZone(root, { config, progress, chapterHref, chapterTitle }) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [lo, hi] = config.domain;

  root.innerHTML = `
    <div class="game" data-view="ship">
      <canvas class="sea" role="img" aria-label="The sea of ${config.title}. Boats, the lane and the lighthouse beam are described in the helm panel."></canvas>
      <header class="hud hud-top">
        <nav class="hud-nav" aria-label="Leave the zone">
          <a href="./">← World chart</a>
          <a href="../">Starter pack</a>
        </nav>
        <h1 class="zone-title"><span class="mono">Zone ${config.n}</span> ${config.title}</h1>
        <div class="hud-buttons">
          <button type="button" class="button" data-act="vantage" aria-pressed="false">Vantage <kbd>V</kbd></button>
          <button type="button" class="button" data-act="logbook" aria-expanded="false">Logbook <kbd>L</kbd></button>
          <button type="button" class="theme-toggle">theme: auto</button>
        </div>
      </header>
      <section class="hud hud-quest" aria-labelledby="quest-h">
        <h2 id="quest-h">Challenges</h2>
        <ol class="quest-list"></ol>
        <div class="quest-panel"></div>
      </section>
      <section class="hud hud-helm" aria-label="Helm">
        <div class="helm-x">
          <label for="helm-x">helm <span class="mono">x</span></label>
          <input id="helm-x" type="range" min="${lo}" max="${hi}" step="0.01">
          <output class="mono" for="helm-x"></output>
        </div>
        <div class="hud-row helm-sea">
          <button type="button" class="button primary" data-act="drop">Drop boat here</button>
          <button type="button" class="button" data-act="predict">Predict from here</button>
          <button type="button" class="button primary" data-act="hop" hidden>Add jump here</button>
          <button type="button" class="button primary" data-act="release" hidden>Release boat</button>
          <button type="button" class="button quiet" data-act="cancel" hidden>Cancel prediction</button>
          <button type="button" class="button quiet" data-act="recall">Recall boats <kbd>R</kbd></button>
        </div>
        <div class="helm-chart" hidden></div>
        <div class="hud-row helm-time">
          <button type="button" class="button quiet" data-act="pause" aria-pressed="false">Pause</button>
          <button type="button" class="button quiet" data-act="flash">Flash once <kbd>Space</kbd></button>
          <span class="mono muted budget"></span>
        </div>
        <p class="tape mono" aria-live="off"></p>
      </section>
      <div class="hud hud-tide" hidden></div>
      <p class="hud-toast" role="status" aria-live="polite"></p>
      <p class="stale-badge" role="status" hidden><strong>STALE</strong> The tide turned since you charted. Check the chart again.</p>
      <p class="hud-keys muted"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> sail · scroll zoom · click drop · drag predict · <kbd>V</kbd> vantage · <kbd>L</kbd> logbook</p>
    </div>`;

  const game = root.querySelector('.game');
  const $ = (sel) => game.querySelector(sel);
  const $act = (a) => game.querySelector(`[data-act="${a}"]`);
  initThemeToggle($('.theme-toggle'));

  // --- events ------------------------------------------------------------------------------------
  const listeners = {};
  const on = (name, fn) => { (listeners[name] ||= new Set()).add(fn); return () => listeners[name].delete(fn); };
  const emit = (name, data) => { for (const fn of listeners[name] || []) fn(data); };

  const toast = $('.hud-toast');
  let toastTimer = null;
  const say = (html, { sticky = false } = {}) => {
    toast.innerHTML = html;
    toast.hidden = !html;
    clearTimeout(toastTimer);
    if (!sticky && html) toastTimer = setTimeout(() => { toast.hidden = true; }, 9000);
  };

  // --- world ----------------------------------------------------------------------------------------
  const world = createWorld($('.sea'), { reducedMotion });
  if (!world) {
    game.classList.add('no-webgl');
    say('This game needs WebGL, which is switched off or unavailable in this browser. The <a href="../">starter pack</a> chapters work without it.', { sticky: true });
    return null;
  }
  const space = createLaneSpace({ domain: config.domain, K: config.laneScale ?? 4 });
  const lane = createLane(world, space, { ticks: config.laneTicks ?? [], endLabels: config.laneEndLabels ?? ['−π', 'π'] });
  const beam = createCobwebBeam(world, space, { lighthouse: config.lighthouse ?? [0, -13] });
  const chartLayer = createChartLayer(world, space);
  const midX = (space.bounds()[0] + space.bounds()[2]) / 2;
  const rig = createCameraRig(world, { target: [midX, -2], distance: 32, bounds: [[midX - 30, midX + 30], [-30, 20]] });

  const store = createStore({ cursor: 0, vantage: false, paused: reducedMotion, chartStale: false });
  const fleet = createFleet({ budget: config.buoyBudget, inside: space.inside });
  const ghost = createGhostLine({ maxHops: config.ghost?.maxHops ?? 5 });
  const saved = progress.zone(config.n);
  const chart = createChartModel(saved.chart);
  let lastGhost = null;     // the most recent released prediction, kept on the water
  let rule = null;
  let tide = null;
  let anim = 1, sinceFlash = 0;

  // --- rule ----------------------------------------------------------------------------------------
  function setRule(r) {
    rule = { params: {}, ...r };
    fleet.setRule(rule.step, rule.params);
    beam.setRule((x) => rule.step(x, rule.params));
    emit('rule', rule);
  }
  const fixedPoints = () => findFixedPoints1D(rule.step, config.domain, rule.params);
  setRule(config.rule);

  // --- boats and the flash ------------------------------------------------------------------------
  const focusBuoy = () => [...fleet.list()].reverse().find((b) => !b.adrift) ?? null;

  function flash() {
    const moved = fleet.flash();
    anim = reducedMotion ? 1 : 0;
    sinceFlash = 0;
    const f = focusBuoy();
    if (f) beam.flash(space.toWorld(f.xs.at(-2) ?? f.xs[0]));
    for (const b of moved) {
      if (b.adrift) say(`A boat sailed off the end of the lane at <span class="mono">x = ${fmt(b.xs.at(-1), 2)}</span>.`);
      if (b.ghost && !b.ghost.results && (b.adrift || b.xs.length - 1 >= b.ghost.guesses.length)) scoreGhost(b);
    }
    renderTape();
    renderBudget();
    emit('flash', { moved });
  }

  function scoreGhost(b) {
    const k = b.ghost.guesses.length;
    const score = scorePath(b.ghost.guesses, b.xs.slice(1, k + 1), { tol: config.ghost?.tol ?? 0.15 });
    b.ghost.results = score.steps.map((s) => ({ guess: s.guess, truth: s.truth, hit: s.hit }));
    if (lastGhost?.buoyId === b.id) lastGhost.results = b.ghost.results;
    emit('ghost', { buoy: b, score });
  }

  function drop(x0, extra = {}) {
    if (!space.inside(x0)) { say('Drop boats on the lane, between the two end posts.'); return null; }
    const b = fleet.drop(+x0.toFixed(4), extra);
    if (!b) {
      say(`All ${fleet.budget} boats are on the water. Recall them (<kbd>R</kbd>) to drop more.`);
      return null;
    }
    renderBudget();
    renderTape();
    emit('drop', b);
    return b;
  }

  function release() {
    const st = ghost.state;
    if (!st || !st.guesses.length) return;
    const b = drop(st.start, { ghost: { guesses: st.guesses, results: null } });
    if (!b) return;
    lastGhost = { start: st.start, guesses: st.guesses, results: null, buoyId: b.id };
    ghost.clear();
    say(`Released. Watch the boat make its ${st.guesses.length} jump${st.guesses.length > 1 ? 's' : ''} beside your ghost line.`);
    renderHelm();
  }

  world.onFrame((dt) => {
    if (!store.get().paused) {
      sinceFlash += dt;
      if (sinceFlash >= (config.flashEvery ?? 1.3)) flash();
    }
    if (anim < 1) anim = Math.min(1, anim + dt / HOP);
    const list = fleet.list().map((b) => ({
      id: b.id,
      from: b.xs.length > 1 ? b.xs.at(-2) : b.xs[0],
      to: b.xs.at(-1),
      t: b.xs.length > 1 ? anim : 1,
      trail: b.xs.slice(-7),
    }));
    lane.setFleet(list);
    const f = focusBuoy();
    beam.setBeam(f ? f.xs.slice(-11) : [], f && f.xs.length > 1 ? anim : 1);
    lane.setGhost(ghost.state ?? lastGhost);
  });

  // --- chart -------------------------------------------------------------------------------------------
  const tol = config.chart?.tol ?? 0.1;
  function saveChart() { progress.updateZone(config.n, { chart: chart.list }); }
  function chartEdited() {
    chartLayer.setSymbols(chart.list);
    chartLayer.setTruth(null);
    store.set({ chartStale: false });
    saveChart();
    palette.setStatus('');
    emit('chartEdit', chart.list);
  }
  function placeSymbol(x) {
    if (!space.inside(x)) return;
    chart.place(palette.selected, [+x.toFixed(3)]);
    chartEdited();
  }
  function checkChart() {
    const fps = fixedPoints();
    if (!fps.length && rule.everyPointFixed) {
      palette.setStatus('Right now <em>every</em> point stays put: there is nothing single to chart. Turn the tide.');
      return;
    }
    const truth = chartTruth(fps);
    const grade = gradeChart(chart.list, truth, { tol });
    chartLayer.setSymbols(grade.placed);
    chartLayer.setTruth(grade.ok ? null : truth);
    store.set({ chartStale: false });
    const lines = grade.placed.map((p) => {
      const name = SYMBOL_INFO[p.symbol].name;
      if (p.status === 'correct') return `${symbolIcon(p.symbol, 14)} ${name} at ${fmt(p.at[0], 2)}: right.`;
      if (p.status === 'wrong-symbol') return `${symbolIcon(p.symbol, 14)} Something is there, but it isn’t a ${name}.`;
      return `${symbolIcon(p.symbol, 14)} No fixed point near ${fmt(p.at[0], 2)}.`;
    });
    if (grade.missing.length) lines.push(`${grade.missing.length} fixed point${grade.missing.length > 1 ? 's' : ''} not charted yet.`);
    if (!grade.ok) lines.push('The true chart is drawn faintly beside yours.');
    palette.setStatus(`<p>${grade.ok ? '<strong>Chart correct.</strong> ' : ''}${lines.join('<br>')}</p>`);
    emit('chart', { grade, truth });
    logbook.refresh();
  }

  const palette = createChartPalette($('.helm-chart'), {
    symbols: config.chart?.symbols ?? ['harbour', 'fountain', 'half-harbour'],
    onPlace: () => placeSymbol(store.get().cursor),
    onUndo: () => { chart.undo(); chartEdited(); },
    onClear: () => { chart.clear(); chartEdited(); },
    onCheck: checkChart,
  });
  chartLayer.setSymbols(chart.list);

  function markStale() {
    if (chart.list.length) store.set({ chartStale: true });
    chartLayer.setTruth(null);
  }

  // --- vantage -----------------------------------------------------------------------------------------
  function setVantage(v) {
    store.set({ vantage: v });
    rig.setVantage(v);
    if (v) {
      const [x0, , x1] = space.bounds();
      rig.frame([x0 - 1.5, -6, x1 + 1.5, 4]);
    }
    chartLayer.setVisible(v);
    chartLayer.setPreview(null);
    game.dataset.view = v ? 'vantage' : 'ship';
    $act('vantage').setAttribute('aria-pressed', String(v));
    ghost.clear();
    renderHelm();
    emit('vantage', v);
  }

  // --- tide ------------------------------------------------------------------------------------------------
  function enableTide({ key, label, from, to, value, rule: ruleFor, step = 0.01 }) {
    disableTide();
    store.set({ [key]: value });
    const host = $('.hud-tide');
    host.hidden = false;
    const wheel = createTideWheel(host, store, { key, label, from, to, step });
    const off = store.subscribe((s, changed) => {
      if (!changed.has(key)) return;
      setRule(ruleFor(s[key]));
      markStale();
      emit('tide', s[key]);
    });
    setRule(ruleFor(value));
    tide = { key, wheel, off, host };
    return wheel;
  }
  function disableTide() {
    if (!tide) return;
    tide.off();
    tide.host.innerHTML = '';
    tide.host.hidden = true;
    tide = null;
  }

  // --- logbook ------------------------------------------------------------------------------------------------
  const logbook = createLogbook(game, {
    zone: config.n, progress, entries: config.logbook, chapterHref, chapterTitle,
    annotate: (level) => annotateChart(level),
    onToggle: (open) => $act('logbook').setAttribute('aria-expanded', String(open)),
  });

  function annotateChart(level) {
    if (!chart.list.length) return '';
    const fps = fixedPoints();
    const grade = gradeChart(chart.list, chartTruth(fps), { tol });
    const items = grade.placed.map((p) => {
      const fp = p.target != null ? fps[p.target] : null;
      const name = SYMBOL_INFO[p.symbol].name;
      const at = fmt(p.at[0], 2);
      if (level === 'sailor') {
        if (p.status === 'correct') return `${symbolIcon(p.symbol, 14)} A ${name} at ${at}. ${p.symbol === 'harbour' ? 'Boats really do settle there.' : 'Boats really are pushed away from there.'}`;
        if (p.status === 'wrong-symbol') return `${symbolIcon(p.symbol, 14)} A ${name} at ${at}. Something is there, but boats ${fp.kind === 'stable' ? 'settle there' : 'leave it'}: it’s a ${SYMBOL_INFO[p.expected].name}.`;
        return `${symbolIcon(p.symbol, 14)} A ${name} at ${at}. No boat stops there.`;
      }
      if (!fp) return `${symbolIcon(p.symbol, 14)} ${name} at <span class="mono">x = ${at}</span>: no fixed point within ${tol}.`;
      if (level === 'navigator') {
        return `${symbolIcon(p.symbol, 14)} ${name} at <span class="mono">x = ${at}</span>: fixed point <span class="mono">x* = ${fmt(fp.x, 4)}</span>, ${fp.kind === 'stable' ? 'stable' : fp.kind === 'unstable' ? 'unstable' : 'half-stable'}. Slope of the rule there: <span class="mono">${fmt(fp.slope, 3)}</span>${p.status === 'correct' ? '.' : ` (should be a ${SYMBOL_INFO[p.expected].name}).`}`;
      }
      const cmp = Math.abs(fp.slope) < 1 ? '<' : Math.abs(fp.slope) > 1 ? '>' : '=';
      return `${symbolIcon(p.symbol, 14)} <span class="tex">x^* \\approx ${fp.x.toFixed(4)},\\quad f'(x^*) \\approx ${fp.slope.toFixed(3)},\\quad |f'(x^*)| ${cmp} 1</span>`;
    });
    const stale = store.get().chartStale ? '<p class="muted"><strong>STALE:</strong> the tide changed after you charted; these notes use the tide as it is now.</p>' : '';
    return `${stale}<ul class="log-chart-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  }

  // --- HUD ------------------------------------------------------------------------------------------------------
  const helmInput = $('#helm-x'), helmOut = $('.helm-x output');
  helmInput.addEventListener('input', () => store.set({ cursor: +helmInput.value }));
  function renderHelm() {
    const s = store.get();
    helmInput.value = s.cursor;
    helmOut.textContent = fmt(s.cursor, 2);
    const g = ghost.active;
    $act('drop').hidden = g; $act('predict').hidden = g;
    $act('hop').hidden = !g; $act('release').hidden = !g; $act('cancel').hidden = !g;
    $act('hop').disabled = ghost.full;
    $act('release').disabled = !g || !ghost.state.guesses.length;
    $('.helm-sea').hidden = s.vantage;
    $('.helm-chart').hidden = !s.vantage;
    $act('pause').textContent = s.paused ? 'Resume flashes' : 'Pause';
    $act('pause').setAttribute('aria-pressed', String(s.paused));
    palette.setPlaceLabel(`Place ${SYMBOL_INFO[palette.selected].name} at helm`);
  }
  function renderBudget() {
    $('.budget').textContent = `boats on the water: ${fleet.budget - fleet.remaining} of ${fleet.budget}`;
  }
  function renderTape() {
    const f = focusBuoy();
    $('.tape').textContent = f ? `boat ${f.id}: ${f.xs.slice(-6).map((v) => fmt(v)).join(' → ')}` : 'No boats on the water.';
  }

  $act('drop').addEventListener('click', () => drop(store.get().cursor));
  $act('predict').addEventListener('click', () => {
    ghost.begin(store.get().cursor);
    lastGhost = null;
    say('Prediction started. Move the helm to where you think the boat lands after one flash, then “Add jump here”.');
    renderHelm();
  });
  $act('hop').addEventListener('click', () => { ghost.hop(store.get().cursor); renderHelm(); });
  $act('release').addEventListener('click', release);
  $act('cancel').addEventListener('click', () => { ghost.clear(); renderHelm(); });
  $act('recall').addEventListener('click', () => { fleet.recall(); renderBudget(); renderTape(); });
  $act('pause').addEventListener('click', () => store.set({ paused: !store.get().paused }));
  $act('flash').addEventListener('click', flash);
  $act('vantage').addEventListener('click', () => setVantage(!store.get().vantage));
  $act('logbook').addEventListener('click', () => logbook.toggle());

  const stale = $('.stale-badge');
  store.subscribe((s, changed) => {
    if (changed.has('cursor')) lane.setCursor(s.cursor);
    if (changed.has('chartStale')) { chartLayer.setStale(s.chartStale); stale.hidden = !s.chartStale; }
    renderHelm();
  });
  lane.setCursor(0);

  // --- pointer --------------------------------------------------------------------------------------------------
  attachSeaPointer(world, space, {
    onHover(x) {
      const c = space.clamp(+x.toFixed(2));
      store.set({ cursor: c });
      if (store.get().vantage) chartLayer.setPreview(space.inside(x) ? { symbol: palette.selected, at: [c] } : null);
    },
    onLeave() { chartLayer.setPreview(null); },
    onClick(x) {
      if (store.get().vantage) { placeSymbol(x); return; }
      if (ghost.active && ghost.state.guesses.length) { release(); return; }
      ghost.clear();
      drop(x);
      renderHelm();
    },
    onDragStart(x) {
      if (store.get().vantage || !space.inside(x)) return;
      if (!ghost.active) {
        ghost.begin(+x.toFixed(3));
        lastGhost = null;
      }
      renderHelm();
    },
    onDragMove(x) { if (ghost.active) ghost.preview(space.clamp(x)); },
    onDragEnd(x) {
      if (!ghost.active) return;
      if (ghost.hop(+space.clamp(x).toFixed(3))) {
        const n = ghost.state.guesses.length;
        say(ghost.full
          ? `${n} jumps predicted. Click the water (or “Release boat”) to let it go.`
          : `Jump ${n} predicted. Drag again from anywhere for jump ${n + 1}, or click to release the boat.`);
      }
      renderHelm();
    },
  });

  // --- keys ---------------------------------------------------------------------------------------------------------
  const DIRS = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' };
  onGameKeys((key, down, e) => {
    if (DIRS[key]) { rig.hold(DIRS[key], down); return true; }
    if (!down) return false;
    if (key === 'v') { setVantage(!store.get().vantage); return true; }
    if (key === 'l') { logbook.toggle(); return true; }
    if (key === 'escape' && logbook.isOpen) { logbook.close(); return true; }
    if ((key === '[' || key === ']' || key === '{' || key === '}') && tide) { tide.wheel.nudge(key === ']' || key === '}' ? 1 : -1, e.shiftKey); return true; }
    if (key === ' ') { flash(); return true; }
    if (key === 'r') { fleet.recall(); renderBudget(); renderTape(); return true; }
    if (key === '+' || key === '=') { rig.zoom(1.15); return true; }
    if (key === '-') { rig.zoom(1 / 1.15); return true; }
    emit('key', key);
    return false;
  });
  window.addEventListener('blur', () => rig.release());

  renderHelm(); renderBudget(); renderTape();
  if (reducedMotion) say('Reduced motion is on, so the lighthouse waits for you: press <kbd>Space</kbd> or “Flash once” to make boats jump.');

  // --- quest HUD ----------------------------------------------------------------------------------------------------
  function setChallenges(list, { onPick = null } = {}) {
    const ol = $('.quest-list');
    ol.innerHTML = list.map((c) => {
      const inner = `<span class="quest-mark" aria-hidden="true">${c.done ? '✓' : c.active ? '▸' : '○'}</span>
        <span>${c.title}</span>${c.done ? '<span class="visually-hidden"> (done)</span>' : ''}`;
      const pickable = onPick && c.pickable !== false;
      return `<li class="${c.done ? 'done' : ''} ${c.active ? 'active' : ''}">${pickable
        ? `<button type="button" class="quest-pick" data-id="${c.id}" ${c.active ? 'aria-current="step"' : ''}>${inner}</button>`
        : inner}</li>`;
    }).join('');
    ol.querySelectorAll('.quest-pick').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.id)));
  }

  return {
    world, space, lane, beam, rig, fleet, chart, chartLayer, logbook, store, config, progress,
    panel: $('.quest-panel'),
    on, say, setRule, fixedPoints, enableTide, disableTide, flash, drop, focusBuoy, setChallenges,
    get rule() { return rule; },
    get tideWheel() { return tide?.wheel ?? null; },
    setDock: (x) => lane.setDock(x),
    setTangent: (t) => beam.setTangent(t),
    clearGhost() { ghost.clear(); lastGhost = null; renderHelm(); },
    checkChart,
  };
}
