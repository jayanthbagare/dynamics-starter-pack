// The six chart symbols as flat 3D marks on the water. Each is told apart by shape first,
// colour second:
//   harbour       filled disc            (stable point)
//   fountain      hollow ring            (unstable point)
//   half-harbour  ring, left half filled (half-stable)
//   whirlpool     spiral                 (spiral)
//   crossing      X                      (saddle)
//   gyre          wide loop with 3 beads (limit cycle)
//
//   buildSymbol(world, 'harbour', { muted: false, opacity: 1 })   → THREE.Group lying flat, radius ≈ 0.5

import { THREE } from './scene.js';
import { tube } from './shapes.js';

const ROLE = {
  harbour: 'stable', fountain: 'unstable', 'half-harbour': 'ink',
  whirlpool: 'trajectory', crossing: 'unstable', gyre: 'stable',
};

export function buildSymbol(world, symbol, { muted = false, opacity = 1, r = 0.5 } = {}) {
  const role = muted ? 'muted' : ROLE[symbol];
  const mat = () => world.paint(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthWrite: opacity >= 1 }), role, opacity);
  const back = () => world.paint(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 'bg', opacity);
  const flat = (geo, m, y = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; return mesh; };
  const g = new THREE.Group();

  if (symbol === 'harbour') {
    g.add(flat(new THREE.CircleGeometry(r, 28), mat()));
  } else if (symbol === 'fountain') {
    g.add(flat(new THREE.CircleGeometry(r * 0.78, 28), back()));
    g.add(flat(new THREE.RingGeometry(r * 0.72, r, 28), mat(), 0.01));
  } else if (symbol === 'half-harbour') {
    g.add(flat(new THREE.CircleGeometry(r * 0.78, 28), back()));
    // left half: angles π/2 → 3π/2 in the circle's plane; after lying flat, −x is west
    g.add(flat(new THREE.CircleGeometry(r * 0.78, 28, Math.PI / 2, Math.PI), mat(), 0.01));
    g.add(flat(new THREE.RingGeometry(r * 0.72, r, 28), mat(), 0.02));
  } else if (symbol === 'whirlpool') {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = t * 4.2 * Math.PI, rr = r * (0.12 + 0.88 * t);
      pts.push(new THREE.Vector3(rr * Math.cos(a), 0, rr * Math.sin(a)));
    }
    g.add(tube(pts, r * 0.09, mat(), 120));
  } else if (symbol === 'crossing') {
    for (const s of [1, -1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(r * 2.2, 0.05, r * 0.26), mat());
      bar.rotation.y = s * Math.PI / 4;
      g.add(bar);
    }
  } else if (symbol === 'gyre') {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, r * 0.07, 6, 40), mat());
    loop.rotation.x = Math.PI / 2;
    g.add(loop);
    for (let k = 0; k < 3; k++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 8, 6), mat());
      const a = (k * 2 * Math.PI) / 3;
      bead.position.set(r * 1.15 * Math.cos(a), 0, r * 1.15 * Math.sin(a));
      g.add(bead);
    }
  }
  g.userData.symbol = symbol;
  return g;
}
