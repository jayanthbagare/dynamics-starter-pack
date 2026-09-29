// The Keeper. He replaces the rule with x* + a(x − x*) and hands the player the tide wheel
// (a from 0.3 to 1.3, then −0.3 to −1.3). A boat is moored at the dock and relaunched whenever the
// tide changes. To win, lock in a mark at the value of a where the harbour becomes a fountain,
// within 0.05 of |a| = 1, for both signs. A wrong mark relaunches the boat at the marked tide so the
// player sees the true behaviour there. Nothing is lost by missing.

import { scoreValue } from '../../pedagogy/predict-score.js';

const LINES = {
  intro: [
    'I keep this harbour. Any boat that comes near, I bring home. Watch.',
    'The tide turns the other way now. Boats will bounce on their way in, if they come in at all.',
  ],
  docks: 'See? Home again. My harbour holds.',
  holds: 'Hm. Not pulled in, not pushed out. It just… stays where it was.',
  drifts: 'Where are you going? My harbour has become a fountain!',
  low: (a) => `At a = ${a}? My harbour still holds there. It breaks further along.`,
  high: (a) => `At a = ${a}? It broke before that. Look closer.`,
  hint: 'I’ll show you where I think it is. You still have to set your mark on it.',
  phaseWon: 'You read my tide. But can you read it the other way?',
  won: 'You know my secret now. Take it with you: it works for every harbour on every lane.',
};

export function startKeeper(z, { onWin, onExit, render }) {
  const { xstar: XS, phases, tol, dockOffset } = z.config.boss;
  let phase = 0, tries = 0, moored = null, relaunchTimer = null;
  let mark = phases[0].from, mood = 'intro', lastWrong = null;
  let won = false;
  let showingGuess = false;   // the tide change that shows a wrong mark shouldn't clear its message

  const keeperRule = (a) => ({
    name: 'keeper',
    step: (x, p) => XS + p.a * (x - XS),
    params: { a },
    everyPointFixed: a === 1,
    tex: 'x_{n+1} = x^* + a\\,(x_n - x^*)',
  });

  function relaunch() {
    if (moored) z.fleet.remove(moored.id);
    moored = z.drop(XS + dockOffset);
  }

  function beginPhase(i) {
    phase = i; tries = 0; lastWrong = null; mood = 'intro';
    const { from, to } = phases[i];
    mark = from;
    const wheel = z.enableTide({ key: 'a', label: 'tide · a', from, to, value: from, rule: keeperRule });
    wheel.setMarks([]);
    relaunch();
    draw();
  }

  // the mooring, judged from what the boat actually does: gap to the dock after each jump
  function mooring() {
    if (!moored || moored.xs.length < 3) return null;
    const g = moored.xs.slice(-3).map((x) => Math.abs(x - XS));
    if (moored.adrift || g[2] > g[1] * 1.001) return 'drifts';
    if (g[2] < g[1] * 0.999) return 'docks';
    return 'holds';
  }

  const offTide = z.on('tide', () => {
    clearTimeout(relaunchTimer);
    relaunchTimer = setTimeout(relaunch, 300);
    if (showingGuess) showingGuess = false;
    else { lastWrong = null; mood = 'intro'; }
    draw();
  });
  const offFlash = z.on('flash', () => {
    const m = mooring();
    if (m && m !== mood && !lastWrong) { mood = m; draw(); }
  });
  const offKey = z.on('key', (k) => { if (k === 'm') lockMark(); });

  function lockMark() {
    if (won) return;
    const { target } = phases[phase];
    const r = scoreValue(Math.abs(mark), Math.abs(target), tol);
    const marks = [{ value: mark, kind: 'guess' }];
    if (r.hit) {
      z.tideWheel.setMarks([...marks, { value: target, kind: 'truth' }]);
      if (phase === 0) {
        z.say(`Mark locked at a = ${mark.toFixed(2)}. ${LINES.phaseWon}`);
        setTimeout(() => beginPhase(1), 1800);
        mood = 'phaseWon';
        draw();
      } else {
        won = true;
        mood = 'won';
        onWin();
        draw();
      }
      return;
    }
    tries++;
    if (tries >= 2) marks.push({ value: target, kind: 'truth' });
    z.tideWheel.setMarks(marks);
    lastWrong = { a: mark.toFixed(2), direction: r.direction };
    // show the true path at the guessed tide
    if (z.store.get().a !== +mark.toFixed(2)) showingGuess = true;
    z.store.set({ a: +mark.toFixed(2) });
    clearTimeout(relaunchTimer);
    relaunchTimer = setTimeout(relaunch, 50);
    draw();
  }

  function keeperSays() {
    if (lastWrong) {
      const line = lastWrong.direction === 'low' ? LINES.low(lastWrong.a) : LINES.high(lastWrong.a);
      return tries >= 2 ? `${line} ${LINES.hint}` : line;
    }
    if (mood === 'intro') return LINES.intro[phase];
    return LINES[mood];
  }

  function draw() {
    const { from, to } = phases[phase];
    const lo = Math.min(from, to), hi = Math.max(from, to);
    render(`
      <div class="keeper">
        <p class="keeper-name">${z.config.boss.name}
          <span class="muted mono">phase ${phase + 1} of 2</span></p>
        <blockquote class="keeper-line">${keeperSays()}</blockquote>
        ${won ? `
          <p><strong>You beat the Keeper.</strong> The harbour holds while each jump shrinks the gap, and
            breaks when it doesn’t: at <span class="mono">|a| = 1</span>, whichever way the tide turns.</p>
          <p>A new logbook page is open (<kbd>L</kbd>). Try the Cartographer level.</p>
          <div class="hud-row">
            <button type="button" class="button primary" data-k="exit">Back to the cos lane</button>
            <a class="button" href="./">World chart</a>
          </div>` : `
          <p>Turn the tide with the wheel, or <kbd>[</kbd> and <kbd>]</kbd>. A boat is relaunched from
            beside the dock each time. Where does the harbour stop holding? Set your mark there and lock it in.</p>
          <div class="slider keeper-mark">
            <label for="keeper-mark">your mark · a</label>
            <output class="mono">${mark.toFixed(2)}</output>
            <div class="slider-track">
              <input id="keeper-mark" type="range" min="${lo}" max="${hi}" step="0.01" value="${mark}">
            </div>
          </div>
          <div class="hud-row">
            <button type="button" class="button primary" data-k="lock">Lock in mark <kbd>M</kbd></button>
            <button type="button" class="button quiet" data-k="exit">Leave the Keeper</button>
          </div>`}
      </div>`, (panel) => {
      const input = panel.querySelector('#keeper-mark');
      input?.addEventListener('input', () => {
        mark = +input.value;
        panel.querySelector('.keeper-mark output').textContent = mark.toFixed(2);
      });
      panel.querySelector('[data-k="lock"]')?.addEventListener('click', lockMark);
      panel.querySelector('[data-k="exit"]')?.addEventListener('click', stop);
    });
  }

  function stop() {
    clearTimeout(relaunchTimer);
    offTide(); offFlash(); offKey();
    z.disableTide();
    z.fleet.recall();
    z.setDock(null);
    z.setRule(z.config.rule);
    onExit();
  }

  z.fleet.recall();
  z.clearGhost();
  z.setTangent(null);
  z.setDock(XS);
  beginPhase(0);
  return { stop };
}
