// The Cartographer: route /game/ to the hub, and /game/?zone=N straight into zone N.
// Every zone boots on its own from its link; the hub is never required.

import { zones, findZone } from './zones/index.js';
import { createProgress } from './pedagogy/progress.js';
import { chapters, chapterURL } from '../core/layout.js';

const params = new URLSearchParams(location.search);
const key = params.get('zone');
const zone = key ? findZone(key) : null;
const progress = createProgress();

const chapterHref = (n) => chapterURL(chapters.find((c) => c.n === n));
const chapterTitle = (n) => chapters.find((c) => c.n === n)?.title ?? '';

if (zone?.live) {
  document.body.classList.add('in-zone');
  document.title = `Zone ${zone.key} · ${zone.title} · The Cartographer`;
  const { start } = await import(`./zones/${zone.folder}/main.js`);
  start(document.getElementById('zone-root'), { progress, chapterHref, chapterTitle, params });
} else {
  const { renderHub } = await import('./hub.js');
  renderHub(document.getElementById('hub'), {
    zones, progress, chapterHref, chapterTitle,
    notice: key ? (zone ? `${zone.title} isn’t charted yet. Zone 1 is open.` : `There is no zone “${key}”. Pick one from the chart.`) : null,
  });
}
