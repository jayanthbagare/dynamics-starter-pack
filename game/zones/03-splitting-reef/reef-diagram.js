// The bifurcation diagram, laid on the water north of the lane, and the harbour lights on the lane.
// Zone-only three.js, built from the engine's THREE and world.paint (so themes recolour it).
//
//   const reef = createReefDiagram(z, { from: 2.8, to: 4.0, stepR: logistic });
//   reef.sweepTo(r)          // add columns for every tide bucket between the last r and this one
//   reef.setCurrent(r)       // the gold line across the diagram
//   reef.setLogs([r, …]); reef.setTruth([r, …])   // posts on the west / east edge
//   reef.setHarbours([x, …]) // filled harbour discs on the lane at the cycle's states
//   reef.coverage()          → fraction of buckets filled
//   reef.reset({ from, to, stepR })
//
// State runs along the lane (east), the tide runs north: r = from at the lane's edge of the
// diagram, r = to far away.

import { THREE, WATER } from '../../render/scene.js';
import { rod } from '../../render/shapes.js';
import { buildSymbol } from '../../render/symbols.js';
import { attractor } from './cascade.js';

const BUCKETS = 240, SAMPLES = 48, Z0 = -9, SPAN = 24;   // 240 columns: 0.005 apart on 2.8–4.0

export function createReefDiagram(z, { from, to, stepR, labels = [] }) {
  const { world, space } = z;
  const group = new THREE.Group();
  world.scene.add(group);
  let cfg, buckets, filled, positions, points, lastR = null, current = null, marks = null, lights = null, frame = null;

  const zOf = (r) => Z0 - ((r - cfg.from) / (cfg.to - cfg.from)) * SPAN;
  const X0 = space.toWorld(space.domain[0]).x, X1 = space.toWorld(space.domain[1]).x;

  function build() {
    if (frame) world.discard(frame);
    if (points) { group.remove(points); points.geometry.dispose(); }
    buckets = BUCKETS;
    filled = new Uint8Array(buckets + 1);
    positions = new Float32Array((buckets + 1) * SAMPLES * 3).fill(-1000);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    points = new THREE.Points(geo, world.paint(new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false }), 'trajectory'));
    points.frustumCulled = false;
    group.add(points);

    // a faint frame and tide labels
    frame = new THREE.Group();
    const m = world.paint(new THREE.MeshBasicMaterial(), 'rule');
    const y = WATER - 0.02;
    const c = [[X0, zOf(cfg.from)], [X1, zOf(cfg.from)], [X1, zOf(cfg.to)], [X0, zOf(cfg.to)]];
    for (let i = 0; i < 4; i++) {
      const [a, b] = [c[i], c[(i + 1) % 4]];
      frame.add(rod(new THREE.Vector3(a[0], y, a[1]), new THREE.Vector3(b[0], y, b[1]), 0.04, m));
    }
    for (const r of [cfg.from, ...(cfg.labels ?? []), cfg.to]) {
      const s = world.label(`r ${r}`, 'muted', 0.7);
      s.position.set(X0 - 2.4, WATER + 0.3, zOf(r));
      frame.add(s);
    }
    group.add(frame);
  }

  const bucketOf = (r) => Math.round(((r - cfg.from) / (cfg.to - cfg.from)) * buckets);
  const rOf = (b) => cfg.from + (b / buckets) * (cfg.to - cfg.from);

  function fill(b) {
    if (b < 0 || b > buckets || filled[b]) return;
    const r = rOf(b);
    const xs = attractor(cfg.stepR, r, { samples: SAMPLES, transient: 800 });
    xs.forEach((x, i) => {
      const w = space.toWorld(Math.min(1, Math.max(0, x)));
      positions.set([w.x, WATER + 0.02, zOf(r)], (b * SAMPLES + i) * 3);
    });
    filled[b] = 1;
    points.geometry.attributes.position.needsUpdate = true;
  }

  function posts(list, role, x, prev) {
    if (prev) world.discard(prev);
    const g = new THREE.Group();
    const m = world.paint(new THREE.MeshStandardMaterial({ flatShading: true }), role);
    for (const r of list) {
      if (r < cfg.from || r > cfg.to) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 6), m);
      post.position.set(x, WATER + 0.4, zOf(r));
      g.add(post);
      g.add(rod(new THREE.Vector3(X0, WATER + 0.01, zOf(r)), new THREE.Vector3(X1, WATER + 0.01, zOf(r)), 0.02,
        world.paint(new THREE.MeshBasicMaterial(), role, 0.45)));
    }
    group.add(g);
    return g;
  }
  let logs = null, truth = null;

  function reset(next) {
    cfg = { ...next };
    lastR = null;
    build();
    if (logs) { world.discard(logs); logs = null; }
    if (truth) { world.discard(truth); truth = null; }
  }
  reset({ from, to, stepR, labels });

  return {
    group,
    zOf,
    frameRect: () => [X0 - 5, zOf(cfg.to) - 2, X1 + 3, 4],
    reset,
    sweepTo(r) {
      const b = bucketOf(r);
      if (lastR === null) fill(b);
      else {
        const a = bucketOf(lastR), s = Math.sign(b - a) || 1;
        for (let k = a; k !== b + s; k += s) fill(k);
      }
      lastR = r;
    },
    coverage: () => filled.reduce((s, v) => s + v, 0) / filled.length,
    setCurrent(r) {
      if (current) world.discard(current);
      const m = world.paint(new THREE.MeshBasicMaterial(), 'parameter');
      current = rod(new THREE.Vector3(X0 - 0.8, WATER + 0.05, zOf(r)), new THREE.Vector3(X1 + 0.8, WATER + 0.05, zOf(r)), 0.07, m);
      group.add(current);
    },
    setLogs(list) { logs = posts(list, 'highlight', X0 - 0.9, logs); },
    setTruth(list) { truth = posts(list, 'ink', X1 + 0.9, truth); },
    setHarbours(xs) {
      if (lights) world.discard(lights);
      lights = new THREE.Group();
      for (const x of xs) {
        const s = buildSymbol(world, 'harbour', { r: 0.42 });
        s.position.copy(space.toWorld(x)).setY(WATER + 0.03);
        s.position.z = 1.1;   // just south of the lane, so boats don't hide them
        lights.add(s);
      }
      world.scene.add(lights);
    },
    dispose() {
      world.discard(group);
      if (lights) world.discard(lights);
    },
  };
}
