// The lane: a one-dimensional state space laid across the sea, for the discrete zones.
// Boats sit on the lane at their state x, and hop along arcs when the lighthouse flashes.
//
//   const space = createLaneSpace({ domain: [-Math.PI, Math.PI], K: 4 });
//   space.toWorld(x)       → the point on the lane for state x
//   space.cob(u, w)        → the point for the cobweb pair (u, w) = (xₙ, xₙ₊₁), see cobweb-beam.js
//   space.fromWorld(v)     → the state x nearest a world point
//
//   const lane = createLane(world, space, { ticks: [-3, -2, -1, 0, 1, 2, 3] });
//   lane.setFleet([{ id, from, to, t, trail: [x₀, x₁, …], adrift }])   // every frame is fine
//   lane.setGhost({ start, guesses, preview, results: [{ guess, truth, hit }] } | null)
//   lane.setCursor(x | null);  lane.setDock(x | null)
//
// The cobweb plane: a pair (u, w) is drawn rotated 45°, so the diagonal w = u is the lane itself
// and the rule curve w = f(u) lies on the water beside it. (u, w) → (K(u+w)/2, −K(w−u)/2).

import { THREE, WATER } from './scene.js';
import { tube, rod, dashed, arcPoints } from './shapes.js';

export function createLaneSpace({ domain = [-Math.PI, Math.PI], K = 4 } = {}) {
  const toWorld = (x, y = WATER) => new THREE.Vector3(K * x, y, 0);
  return {
    dim: 1, domain, K,
    toWorld,
    atWorld: (at, y) => toWorld(at[0], y),
    cob: (u, w, y = WATER) => new THREE.Vector3((K * (u + w)) / 2, y, (-K * (w - u)) / 2),
    fromWorld: (v) => v.x / K,
    clamp: (x) => Math.min(domain[1], Math.max(domain[0], x)),
    inside: (x) => Number.isFinite(x) && x >= domain[0] - 1e-9 && x <= domain[1] + 1e-9,
    bounds: () => [K * domain[0], -K * 2, K * domain[1], K * 2],   // x0, z0, x1, z1 in world
  };
}

export function createLane(world, space, { ticks = [], endLabels = ['−π', 'π'] } = {}) {
  const group = new THREE.Group();
  world.scene.add(group);
  const [lo, hi] = space.domain;
  const mats = {
    lane: world.paint(new THREE.MeshBasicMaterial(), 'ink', 0.85),
    post: world.paint(new THREE.MeshStandardMaterial({ flatShading: true }), 'muted'),
    cursor: world.paint(new THREE.MeshBasicMaterial(), 'parameter'),
    hull: world.paint(new THREE.MeshStandardMaterial({ flatShading: true }), 'trajectory'),
    sail: world.paint(new THREE.MeshStandardMaterial({ flatShading: true, side: THREE.DoubleSide }), 'surface'),
    pier: world.paint(new THREE.MeshStandardMaterial({ flatShading: true }), 'rock'),
  };

  // --- the lane itself, its end posts and ticks -----------------------------------------------
  group.add(rod(space.toWorld(lo), space.toWorld(hi), 0.06, mats.lane));
  const post = (x, h, r) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 6), mats.post);
    m.position.copy(space.toWorld(x)).setY(WATER + h / 2 - 0.2);
    group.add(m);
  };
  const label = (text, x, dz = 1.1, role = 'muted', h = 0.62) => {
    const s = world.label(text, role, h);
    s.position.copy(space.toWorld(x)).add(new THREE.Vector3(0, 0.35, dz));
    group.add(s);
  };
  post(lo, 1.3, 0.22); post(hi, 1.3, 0.22);
  label(endLabels[0], lo); label(endLabels[1], hi);
  for (const t of ticks) {
    if (t <= lo || t >= hi) continue;
    post(t, 0.55, 0.08);
    label(String(t).replace('-', '−'), t);
  }

  // --- cursor (where a click or the helm would drop) -------------------------------------------
  const cursor = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), mats.cursor);
  cone.rotation.x = Math.PI; cone.position.y = 1.5;
  cursor.add(cone, rod(new THREE.Vector3(0, WATER, 0), new THREE.Vector3(0, 1.2, 0), 0.025, mats.cursor));
  cursor.visible = false;
  group.add(cursor);

  // --- dock (a pier south of the lane) ----------------------------------------------------------
  const dock = new THREE.Group();
  const pier = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 2.2), mats.pier);
  pier.position.set(0, WATER, 1.5);
  const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 6), mats.post);
  bollard.position.set(0, WATER + 0.3, 0.55);
  dock.add(pier, bollard);
  dock.visible = false;
  group.add(dock);

  // --- boats --------------------------------------------------------------------------------------
  const boats = new Map();   // id → { mesh, trail: Group, sig }
  const hopHeight = (a, b) => 0.5 + 0.12 * Math.abs(space.K * (b - a));
  const beyond = (x) => {  // adrift boats keep going past the end posts, then vanish in the fog
    if (Number.isFinite(x) && x >= lo && x <= hi) return x;
    const s = Number.isFinite(x) ? Math.sign(x) : 1;
    return s * (Math.abs(s > 0 ? hi : lo) + 0.6);
  };

  function boatPosition(from, to, t) {
    const a = space.toWorld(beyond(from)), b = space.toWorld(beyond(to));
    if (t >= 1) return b;
    const p = a.clone().lerp(b, t);
    p.y += hopHeight(beyond(from), beyond(to)) * 4 * t * (1 - t);
    return p;
  }

  function makeBoat() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.26, 5), mats.hull);
    hull.scale.set(1.5, 1, 0.8);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 3), mats.sail);
    sail.position.y = 0.58;
    g.add(hull, sail);
    return g;
  }

  function buildTrail(trail, inFlight) {
    const g = new THREE.Group();
    const done = inFlight ? trail.slice(0, -1) : trail;
    const recent = done.slice(-6);
    recent.forEach((x, i) => {
      if (!space.inside(x)) return;
      const fade = (i + 1) / (recent.length + 1);
      const m = world.paint(new THREE.MeshBasicMaterial(), 'trajectory', 0.2 + 0.5 * fade);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), m);
      dot.position.copy(space.toWorld(x));
      g.add(dot);
    });
    for (let i = Math.max(0, done.length - 6); i + 1 < done.length; i++) {
      const a = beyond(done[i]), b = beyond(done[i + 1]);
      if (!Number.isFinite(done[i])) break;
      const fade = (i - done.length + 7) / 6;
      const m = world.paint(new THREE.MeshBasicMaterial(), 'trajectory', 0.12 + 0.45 * fade);
      g.add(tube(arcPoints(space.toWorld(a), space.toWorld(b), hopHeight(a, b)), 0.035, m, 24));
    }
    return g;
  }

  function setFleet(list) {
    const seen = new Set();
    for (const b of list) {
      seen.add(b.id);
      let entry = boats.get(b.id);
      if (!entry) {
        entry = { mesh: makeBoat(), trail: null, sig: '' };
        group.add(entry.mesh);
        boats.set(b.id, entry);
      }
      entry.mesh.position.copy(boatPosition(b.from, b.to, b.t));
      entry.mesh.rotation.y = b.to >= b.from ? 0 : Math.PI;
      const sig = `${b.trail.length}:${b.trail.at(-1)}:${b.t < 1}`;
      if (sig !== entry.sig) {
        if (entry.trail) world.discard(entry.trail);
        entry.trail = buildTrail(b.trail, b.t < 1);
        group.add(entry.trail);
        entry.sig = sig;
      }
    }
    for (const [id, entry] of boats) {
      if (seen.has(id)) continue;
      group.remove(entry.mesh);   // boat meshes share materials: remove, don't discard them
      entry.mesh.traverse((o) => o.geometry?.dispose());
      if (entry.trail) world.discard(entry.trail);
      boats.delete(id);
    }
  }

  // --- ghost line: the player's predicted hops, then the comparison ------------------------------
  let ghostGroup = null, ghostSig = '';
  function setGhost(ghost) {
    const sig = JSON.stringify(ghost);
    if (sig === ghostSig) return;
    ghostSig = sig;
    if (ghostGroup) world.discard(ghostGroup);
    ghostGroup = null;
    if (!ghost || ghost.start == null) return;
    const g = new THREE.Group();
    const ring = (x, role, r = 0.3) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 20), world.paint(new THREE.MeshBasicMaterial(), role));
      m.rotation.x = Math.PI / 2;
      m.position.copy(space.toWorld(x)).setY(WATER + 0.02);
      g.add(m);
    };
    ring(ghost.start, 'parameter', 0.36);
    const chain = [ghost.start, ...ghost.guesses];
    for (let i = 0; i + 1 < chain.length; i++) {
      const a = chain[i], b = chain[i + 1];
      const m = world.paint(new THREE.MeshBasicMaterial(), 'highlight');
      g.add(dashed(arcPoints(space.toWorld(a), space.toWorld(b), hopHeight(a, b) * 1.45, 24), 0.04, m, 8));
      ring(b, 'highlight', 0.24);
    }
    if (ghost.preview != null) {
      const a = chain.at(-1), b = ghost.preview;
      const m = world.paint(new THREE.MeshBasicMaterial(), 'highlight', 0.55);
      g.add(dashed(arcPoints(space.toWorld(a), space.toWorld(b), hopHeight(a, b) * 1.45, 24), 0.03, m, 8));
      ring(b, 'highlight', 0.2);
    }
    for (const r of ghost.results || []) {
      if (!space.inside(r.truth)) continue;
      const m = world.paint(new THREE.MeshBasicMaterial(), r.hit ? 'muted' : 'highlight', 0.9);
      const a = space.toWorld(r.guess).setY(WATER + 0.05), b = space.toWorld(r.truth).setY(WATER + 0.05);
      a.z = b.z = -0.45;
      g.add(rod(a, b, 0.05, m));
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), world.paint(new THREE.MeshBasicMaterial(), 'trajectory'));
      dot.position.copy(b);
      g.add(dot);
    }
    ghostGroup = g;
    group.add(g);
  }

  return {
    group, boatPosition,
    setFleet,
    setGhost,
    setCursor(x) {
      cursor.visible = x != null && space.inside(x);
      if (cursor.visible) cursor.position.copy(space.toWorld(x)).setY(0);
    },
    setDock(x) {
      dock.visible = x != null;
      if (dock.visible) dock.position.copy(space.toWorld(x)).setY(0);
    },
  };
}
