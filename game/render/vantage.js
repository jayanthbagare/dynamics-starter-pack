// The chart, seen from the vantage (key V): the player's symbols on the water, the graded truth
// beside any wrong guess, and a grey STALE look when the tide has changed since charting.
//
//   const chart = createChartLayer(world, space);
//   chart.setSymbols([{ symbol: 'harbour', at: [0.74], status: 'correct' | 'misplaced' | 'wrong-symbol' }])
//   chart.setTruth([{ symbol, at }] | null)      // revealed after a wrong chart
//   chart.setPreview({ symbol, at } | null)       // translucent symbol under the pointer
//   chart.setStale(bool)
//   chart.setVisible(bool)

import { THREE, WATER } from './scene.js';
import { buildSymbol } from './symbols.js';

export function createChartLayer(world, space) {
  const group = new THREE.Group();
  group.visible = false;
  world.scene.add(group);
  let symbols = [], truth = null, preview = null, stale = false;
  let built = null;

  const statusRing = (status) => {
    if (!status || status === 'correct') return null;
    const m = world.paint(new THREE.MeshBasicMaterial(), 'highlight');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 6, 32), m);
    ring.rotation.x = Math.PI / 2;
    return ring;
  };

  function rebuild() {
    if (built) world.discard(built);
    built = new THREE.Group();
    for (const s of symbols) {
      const g = buildSymbol(world, s.symbol, { muted: stale, opacity: stale ? 0.45 : 1 });
      g.position.copy(space.atWorld(s.at, WATER + 0.06));
      const ring = !stale && statusRing(s.status);
      if (ring) g.add(ring);
      built.add(g);
    }
    for (const t of truth || []) {
      const g = buildSymbol(world, t.symbol, { opacity: 0.55, r: 0.4 });
      // drawn just north of the lane, beside the guess
      g.position.copy(space.atWorld(t.at, WATER + 0.04)).add(new THREE.Vector3(0, 0, -1.25));
      const tag = world.label('true', 'muted', 0.45);
      tag.position.set(0, 0.3, -0.75);
      g.add(tag);
      built.add(g);
    }
    if (preview) {
      const g = buildSymbol(world, preview.symbol, { opacity: 0.4 });
      g.position.copy(space.atWorld(preview.at, WATER + 0.08));
      built.add(g);
    }
    group.add(built);
  }

  return {
    group,
    setSymbols(list) { symbols = list; rebuild(); },
    setTruth(list) { truth = list; rebuild(); },
    setPreview(p) {
      const same = (!p && !preview) || (p && preview && p.symbol === preview.symbol && Math.abs(p.at[0] - preview.at[0]) < 1e-3);
      if (same) return;
      preview = p; rebuild();
    },
    setStale(v) { if (v !== stale) { stale = v; rebuild(); } },
    setVisible(v) { group.visible = v; },
    get stale() { return stale; },
  };
}
