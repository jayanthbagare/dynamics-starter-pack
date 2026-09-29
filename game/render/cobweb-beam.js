// The lighthouse and its beam: the cobweb diagram, drawn on the water.
//
// The rule curve w = f(u) lies on the sea beside the lane (the lane is the diagonal w = u; see
// lane.js). On each flash the beam leaves the boat, runs to the rule curve (apply the rule), then
// back to the lane (the output becomes the next input): the cobweb, one bounce per flash.
//
//   const beam = createCobwebBeam(world, space, { lighthouse: [0, -13] });
//   beam.setRule((x) => Math.cos(x))
//   beam.setBeam([x₀, x₁, …], progress)   // progress ∈ [0, 1] draws the latest bounce partway
//   beam.flash(worldPoint)                  // lamp pulse and a ray to that point
//   beam.setTangent({ x, slope } | null)    // the rule's tangent line at a fixed point
//   beam.setRuleVisible(bool)

import { THREE, WATER } from './scene.js';
import { tube, rod, dashed } from './shapes.js';

export function createCobwebBeam(world, space, { lighthouse = [0, -13], samples = 320 } = {}) {
  const group = new THREE.Group();
  world.scene.add(group);

  // --- the lighthouse on its islet --------------------------------------------------------------
  const [lx, lz] = lighthouse;
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), world.paint(new THREE.MeshStandardMaterial({ flatShading: true }), 'rock'));
  rock.scale.set(1.3, 0.45, 1.1);
  rock.position.set(lx, -0.3, lz);
  const towerMat = world.paint(new THREE.MeshStandardMaterial({ flatShading: true }), 'surface');
  const bandMat = world.paint(new THREE.MeshStandardMaterial({ flatShading: true }), 'unstable');
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 5, 8), towerMat);
  tower.position.set(lx, 3, lz);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.76, 0.8, 8), bandMat);
  band.position.set(lx, 2.6, lz);
  const lampMat = world.paint(new THREE.MeshBasicMaterial({ transparent: true }), 'highlight');
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), lampMat);
  lamp.position.set(lx, 6, lz);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.8, 8), world.paint(new THREE.MeshStandardMaterial({ flatShading: true }), 'ink'));
  cap.position.set(lx, 6.8, lz);
  group.add(rock, tower, band, lamp, cap);
  const lampAt = lamp.position.clone();

  // --- rule curve ------------------------------------------------------------------------------------
  let ruleGroup = null;
  const ruleMat = world.paint(new THREE.MeshBasicMaterial(), 'ink', 0.75);
  function setRule(f) {
    if (ruleGroup) { group.remove(ruleGroup); ruleGroup.traverse((o) => o.geometry?.dispose()); }
    ruleGroup = new THREE.Group();
    const [lo, hi] = space.domain;
    const limit = 2.2 * Math.max(Math.abs(lo), Math.abs(hi));
    let run = [];
    const flush = () => { if (run.length > 1) ruleGroup.add(tube(run, 0.05, ruleMat, run.length * 2)); run = []; };
    for (let i = 0; i <= samples; i++) {
      const u = lo + ((hi - lo) * i) / samples, w = f(u);
      if (Number.isFinite(w) && Math.abs(w) < limit) run.push(space.cob(u, w, WATER - 0.02));
      else flush();
    }
    flush();
    group.add(ruleGroup);
  }

  // --- the bouncing beam --------------------------------------------------------------------------------
  let beamGroup = null, beamSig = '';
  function setBeam(path, progress = 1) {
    const sig = `${path.join(',')}|${progress.toFixed(2)}`;
    if (sig === beamSig) return;
    beamSig = sig;
    if (beamGroup) world.discard(beamGroup);
    beamGroup = new THREE.Group();
    const pts = [];
    for (let i = 0; i + 1 < path.length; i++) {
      const u = path[i], w = path[i + 1];
      if (!space.inside(u) || !space.inside(w)) break;
      pts.push([space.cob(u, u), space.cob(u, w), space.cob(w, w)]);
    }
    pts.forEach(([a, b, c], i) => {
      const latest = i === pts.length - 1;
      const age = pts.length - 1 - i;
      const m = world.paint(new THREE.MeshBasicMaterial(), 'highlight', latest ? 1 : Math.max(0.15, 0.7 - age * 0.09));
      const r = latest ? 0.075 : 0.05;
      if (!latest || progress >= 1) {
        beamGroup.add(rod(a, b, r, m), rod(b, c, r, m));
        return;
      }
      if (progress <= 0.5) beamGroup.add(rod(a, a.clone().lerp(b, progress * 2), r, m));
      else beamGroup.add(rod(a, b, r, m), rod(b, b.clone().lerp(c, progress * 2 - 1), r, m));
    });
    group.add(beamGroup);
  }

  // --- flash: the lamp brightens and a ray reaches the boat ----------------------------------------
  let ray = null, rayAge = Infinity;
  const rayMat = world.paint(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), 'highlight', 0.5);
  function flash(target) {
    if (ray) { group.remove(ray); ray.geometry.dispose(); }
    ray = rod(lampAt, target, 0.07, rayMat);
    group.add(ray);
    rayAge = 0;
  }
  world.onFrame((dt) => {
    if (!ray) return;
    rayAge += dt;
    const k = Math.max(0, 1 - rayAge / 0.7);
    rayMat.opacity = world.reducedMotion ? 0.35 * (k > 0 ? 1 : 0) : 0.55 * k;
    lamp.scale.setScalar(world.reducedMotion ? 1 : 1 + 0.6 * k);
    if (k <= 0) { group.remove(ray); ray.geometry.dispose(); ray = null; }
  });

  // --- tangent at a fixed point -------------------------------------------------------------------------
  let tangent = null;
  const tanMat = world.paint(new THREE.MeshBasicMaterial(), 'parameter');
  function setTangent(tan) {
    if (tangent) { group.remove(tangent); tangent.traverse((o) => o.geometry?.dispose()); tangent = null; }
    if (!tan) return;
    const { x, slope, span = 1.1 } = tan;
    const a = space.cob(x - span, x - slope * span, WATER + 0.03);
    const b = space.cob(x + span, x + slope * span, WATER + 0.03);
    tangent = dashed([a, b], 0.045, tanMat, 10);
    group.add(tangent);
  }

  return {
    group, lampAt,
    setRule, setBeam, flash, setTangent,
    setRuleVisible(v) { if (ruleGroup) ruleGroup.visible = v; },
  };
}
