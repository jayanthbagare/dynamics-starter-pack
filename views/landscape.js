// The landscape of a one-dimensional flow ẋ = f(x) = −dV/dx, for a whole family of rules at once.
// Left–right is x, front–back is the parameter r, height is V(x; r). The slice at the current r is
// highlighted; balls sit on it and slide downhill. The floor shows where the fixed points are for
// every r (stable solid, unstable dashed), which is the bifurcation diagram lying flat.
//
//   createLandscape(canvas, store, {
//     select: (state) => ({
//       key: 'saddle-node',                 // change to rebuild the surface
//       V: (x, r) => …, f: (x, r) => …,
//       xRange: [-2, 2], rRange: [-1, 1],
//       r: state.r, balls: [x1, x2],
//     }),
//     yawKey: 'yaw', pitchKey: 'pitch',     // camera angles live in the store (and URL)
//   });
//
// Renders only when something changes. Drag to turn the view; ←/→/↑/↓ do the same from the keyboard.

import * as THREE from '../vendor/three/three.module.js';
import { tokens, onThemeChange } from './canvas.js';
import { findZeros } from '../core/fixedpoints.js';
import { attachOrbit, placeCamera } from './orbit-camera.js';

const NX = 90, NR = 50;          // surface resolution
const SX = 2.2, SR = 1.6, SV = 1; // world size of the x, r and height directions

export function createLandscape(canvas, store, { select, yawKey, pitchKey, label = '3D landscape' }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'caption', textContent: '3D view unavailable (WebGL is off). The 2D views below show the same thing.',
    }));
    return { redraw: () => {} };
  }
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-2, 4, 3);
  scene.add(sun);

  const mats = {
    surface: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
    grid: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 }),
    slice: new THREE.MeshBasicMaterial(),
    ball: new THREE.MeshLambertMaterial(),
    stable: new THREE.MeshBasicMaterial(),
    unstable: new THREE.MeshBasicMaterial(),
    half: new THREE.MeshBasicMaterial(),
    floorStable: new THREE.PointsMaterial({ size: 3, sizeAttenuation: false }),
    floorUnstable: new THREE.PointsMaterial({ size: 3, sizeAttenuation: false }),
    frame: new THREE.LineBasicMaterial(),
    rLine: new THREE.LineBasicMaterial(),
  };

  const groups = { surface: new THREE.Group(), dynamic: new THREE.Group() };
  scene.add(groups.surface, groups.dynamic);

  let built = null;    // { key, vmin, vmax }
  let dirty = true;

  function mapper(d, vmin, vmax) {
    const [x0, x1] = d.xRange, [r0, r1] = d.rRange;
    return {
      x: (x) => ((x - x0) / (x1 - x0) - 0.5) * 2 * SX,
      r: (r) => ((r - r0) / (r1 - r0) - 0.5) * 2 * SR,
      v: (v) => ((Math.min(vmax, Math.max(vmin, v)) - vmin) / (vmax - vmin)) * SV,
    };
  }

  function buildSurface(d) {
    groups.surface.clear();
    const [x0, x1] = d.xRange, [r0, r1] = d.rRange;
    // clamp heights to a central range so steep edges don't flatten the interesting middle
    const vals = [];
    for (let j = 0; j <= NR; j++) for (let i = 0; i <= NX; i++) vals.push(d.V(x0 + (i / NX) * (x1 - x0), r0 + (j / NR) * (r1 - r0)));
    const sorted = [...vals].sort((a, b) => a - b);
    const vmin = sorted[Math.floor(sorted.length * 0.02)], vmax = sorted[Math.floor(sorted.length * 0.98)];
    const m = mapper(d, vmin, vmax);

    const geo = new THREE.PlaneGeometry(1, 1, NX, NR);
    const pos = geo.attributes.position;
    for (let j = 0; j <= NR; j++) {
      for (let i = 0; i <= NX; i++) {
        const k = j * (NX + 1) + i;
        const x = x0 + (i / NX) * (x1 - x0), r = r0 + (j / NR) * (r1 - r0);
        pos.setXYZ(k, m.x(x), m.v(vals[k]), m.r(r));
      }
    }
    geo.computeVertexNormals();
    groups.surface.add(new THREE.Mesh(geo, mats.surface));

    // contour-like grid: a line along x at every 5th r, and along r at every 10th x
    const pts = [];
    for (let j = 0; j <= NR; j += 5) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      pts.push(pos.getX(a), pos.getY(a) + 0.003, pos.getZ(a), pos.getX(a + 1), pos.getY(a + 1) + 0.003, pos.getZ(a + 1));
    }
    for (let i = 0; i <= NX; i += 10) for (let j = 0; j < NR; j++) {
      const a = j * (NX + 1) + i, b = a + NX + 1;
      pts.push(pos.getX(a), pos.getY(a) + 0.003, pos.getZ(a), pos.getX(b), pos.getY(b) + 0.003, pos.getZ(b));
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    groups.surface.add(new THREE.LineSegments(gridGeo, mats.grid));

    // floor: fixed points for every r (the bifurcation diagram, lying flat)
    const floorY = -0.35, st = [], un = [];
    for (let j = 0; j <= 240; j++) {
      const r = r0 + (j / 240) * (r1 - r0);
      for (const z of findZeros((x) => d.f(x, r), d.xRange, 400)) {
        const p = [m.x(z.x), floorY, m.r(r)];
        if (z.kind === 'stable') st.push(...p);
        else if (j % 6 < 3) un.push(...p); // dashed
      }
    }
    for (const [arr, mat] of [[st, mats.floorStable], [un, mats.floorUnstable]]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      groups.surface.add(new THREE.Points(g, mat));
    }
    // floor frame
    const fr = new THREE.BufferGeometry();
    fr.setAttribute('position', new THREE.Float32BufferAttribute([
      -SX, floorY, -SR, SX, floorY, -SR, SX, floorY, -SR, SX, floorY, SR,
      SX, floorY, SR, -SX, floorY, SR, -SX, floorY, SR, -SX, floorY, -SR,
    ], 3));
    groups.surface.add(new THREE.LineSegments(fr, mats.frame));

    built = { key: d.key, vmin, vmax, floorY };
  }

  function buildDynamic(d) {
    groups.dynamic.traverse((o) => o.geometry?.dispose());
    groups.dynamic.clear();
    const m = mapper(d, built.vmin, built.vmax);
    const [x0, x1] = d.xRange;

    // the slice at the current r, as a tube so it reads as a thick line
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 120 }, (_, i) => {
      const x = x0 + (i / 119) * (x1 - x0);
      return new THREE.Vector3(m.x(x), m.v(d.V(x, d.r)) + 0.012, m.r(d.r));
    }));
    groups.dynamic.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.012, 6), mats.slice));

    // current r on the floor
    const rl = new THREE.BufferGeometry();
    rl.setAttribute('position', new THREE.Float32BufferAttribute([-SX, built.floorY, m.r(d.r), SX, built.floorY, m.r(d.r)], 3));
    groups.dynamic.add(new THREE.Line(rl, mats.rLine));

    // fixed points on the slice: stable = solid ball, unstable = ring (hollow), half = small dark ball
    for (const z of findZeros((x) => d.f(x, d.r), d.xRange, 800)) {
      const p = new THREE.Vector3(m.x(z.x), m.v(d.V(z.x, d.r)) + 0.02, m.r(d.r));
      const obj = z.kind === 'unstable'
        ? new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 8, 24), mats.unstable)
        : new THREE.Mesh(new THREE.SphereGeometry(z.kind === 'stable' ? 0.06 : 0.045, 16, 12), z.kind === 'stable' ? mats.stable : mats.half);
      obj.position.copy(p);
      if (z.kind === 'unstable') obj.lookAt(camera.position);
      groups.dynamic.add(obj);
    }

    // balls
    for (const b of d.balls || []) {
      if (b < x0 || b > x1) continue;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), mats.ball);
      ball.position.set(m.x(b), m.v(d.V(b, d.r)) + 0.075, m.r(d.r));
      groups.dynamic.add(ball);
    }
  }

  function applyColours() {
    const T = tokens();
    const c = (css) => new THREE.Color(css);
    mats.surface.color = c(T.surface).lerp(c(T.muted), 0.35);
    mats.grid.color = c(T.muted);
    mats.slice.color = c(T.parameter);
    mats.ball.color = c(T.trajectory);
    mats.stable.color = c(T.stable);
    mats.unstable.color = c(T.unstable);
    mats.half.color = c(T.ink);
    mats.floorStable.color = c(T.stable);
    mats.floorUnstable.color = c(T.unstable);
    mats.frame.color = c(T.rule);
    mats.rLine.color = c(T.parameter);
    dirty = true;
  }

  function render() {
    const d = select(store.get());
    if (!built || built.key !== d.key) buildSurface(d);
    placeCamera(camera, store.get(), { yawKey, pitchKey, distance: 7.2, target: [0, 0.25, 0] });
    buildDynamic(d);
    renderer.render(scene, camera);
    dirty = false;
  }

  new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    render();
  }).observe(canvas);

  applyColours();
  onThemeChange(() => { applyColours(); render(); });
  store.subscribe(render);

  attachOrbit(canvas, store, { yawKey, pitchKey, label });

  return { redraw: render };
}
