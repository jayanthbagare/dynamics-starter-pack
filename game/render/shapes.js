// Small geometry helpers shared by the render modules. Lines in WebGL are one pixel wide, so
// anything the player must see (lanes, beams, arcs) is drawn as a thin tube instead.

import { THREE } from './scene.js';

// A smooth tube through points (at least two).
export function tube(points, radius, material, segments = null) {
  const curve = points.length === 2
    ? new THREE.LineCurve3(points[0], points[1])
    : new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, segments ?? Math.max(2, points.length * 2), radius, 6, false);
  return new THREE.Mesh(geo, material);
}

// A straight rod from a to b.
export function rod(a, b, radius, material) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(radius, radius, Math.max(len, 1e-4), 6, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

// A dashed path: every other piece of the polyline through points, as rods.
export function dashed(points, radius, material, dashes = 9) {
  const group = new THREE.Group();
  const total = points.length - 1;
  const pieces = dashes * 2 - 1;
  const at = (s) => { // s in [0, 1] along the polyline
    const f = s * total, i = Math.min(total - 1, Math.floor(f));
    return points[i].clone().lerp(points[i + 1], f - i);
  };
  for (let k = 0; k < pieces; k += 2) group.add(rod(at(k / pieces), at((k + 1) / pieces), radius, material));
  return group;
}

// Points along a hop: a parabola over the water from a to b.
export function arcPoints(a, b, height, n = 20) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y += height * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}
