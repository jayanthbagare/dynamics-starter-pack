// A 3D scene for flows in space (three.js): a cloud of points, trajectories that fade with age,
// fixed-point markers and an axes box. Model z points up.
//
//   createScene3D(canvas, store, {
//     select: (state) => ({
//       bounds: [[-20, 20], [-27, 27], [0, 50]],
//       cloud: { array: Float32Array (x, y, z, x, y, z, …), count: 10000 },   // optional
//       lines: [{ points: [[x, y, z], …], colour: 'trajectory' | 'parameter', fade: true }],
//       markers: [{ p: [x, y, z], kind: 'unstable' | 'stable' | 'half' }],
//       dots: [[x, y, z], …],                  // optional small highlighted points (e.g. peaks)
//     }),
//     yawKey: 'yaw', pitchKey: 'elev', zoomKey: 'zoom',
//   });
//
// Renders only when the store changes, so an idle page costs nothing.

import * as THREE from '../vendor/three/three.module.js';
import { tokens, onThemeChange } from './canvas.js';
import { attachOrbit, placeCamera } from './orbit-camera.js';

const SIZE = 4;   // the largest side of the bounds box, in world units

export function createScene3D(canvas, store, { select, yawKey, pitchKey, zoomKey = null, label = '3D view', axes = ['x', 'y', 'z'] }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'caption', textContent: '3D view unavailable (WebGL is off). The 2D plots below show the same motion.',
    }));
    return { redraw: () => {} };
  }
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(3, 6, 4);
  scene.add(sun);

  const mats = {
    cloud: new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false }),
    line: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true }),
    box: new THREE.LineBasicMaterial(),
    unstable: new THREE.MeshBasicMaterial(),
    stable: new THREE.MeshBasicMaterial(),
    half: new THREE.MeshBasicMaterial(),
    dot: new THREE.MeshBasicMaterial(),
  };
  const staticGroup = new THREE.Group(), dynamic = new THREE.Group();
  scene.add(staticGroup, dynamic);

  let cloudPoints = null, cloudBuf = null;
  let T = tokens();
  let map = null, builtBounds = null;

  function mapper(bounds) {
    const ext = bounds.map(([a, b]) => b - a), s = SIZE / Math.max(...ext);
    const mid = bounds.map(([a, b]) => (a + b) / 2);
    // model (x, y, z) → world (X, Y, Z) with z up
    return { s, mid, w: (x, y, z) => [(x - mid[0]) * s, (z - mid[2]) * s, -(y - mid[1]) * s] };
  }

  function buildStatic(bounds) {
    staticGroup.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); });
    staticGroup.clear();
    map = mapper(bounds);
    const [[x0, x1], [y0, y1], [z0, z1]] = bounds;
    const c = [];
    for (const x of [x0, x1]) for (const y of [y0, y1]) c.push([x, y, z0], [x, y, z1]);
    for (const x of [x0, x1]) for (const z of [z0, z1]) c.push([x, y0, z], [x, y1, z]);
    for (const y of [y0, y1]) for (const z of [z0, z1]) c.push([x0, y, z], [x1, y, z]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(c.flatMap((p) => map.w(...p)), 3));
    staticGroup.add(new THREE.LineSegments(g, mats.box));
    // axis letters just outside the box
    const lab = [[axes[0], [x1 + 0.06 * (x1 - x0), y0, z0]], [axes[1], [x0, y1 + 0.06 * (y1 - y0), z0]], [axes[2], [x0, y0, z1 + 0.05 * (z1 - z0)]]];
    for (const [text, p] of lab) {
      const sp = textSprite(text, T.muted, T.mono);
      sp.position.set(...map.w(...p));
      staticGroup.add(sp);
    }
    builtBounds = JSON.stringify(bounds);
  }

  function colourOf(name) { return new THREE.Color(T[name] ?? T.trajectory); }

  function render() {
    const d = select(store.get());
    if (JSON.stringify(d.bounds) !== builtBounds) buildStatic(d.bounds);
    // narrow (portrait) views need the camera further back to fit the box
    placeCamera(camera, store.get(), { yawKey, pitchKey, zoomKey, distance: 8.8 * Math.max(1, 1 / camera.aspect) ** 1.4 });

    dynamic.traverse((o) => { if (o !== cloudPoints) o.geometry?.dispose(); });
    dynamic.clear();

    // cloud: reuse one buffer, rewritten in place
    if (d.cloud?.count) {
      const n = d.cloud.count;
      if (!cloudBuf || cloudBuf.length < 3 * n) {
        cloudBuf = new Float32Array(3 * n);
        cloudPoints?.geometry.dispose();
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(cloudBuf, 3));
        cloudPoints = new THREE.Points(g, mats.cloud);
      }
      const a = d.cloud.array, { s, mid } = map;
      for (let i = 0; i < n; i++) {
        cloudBuf[3 * i] = (a[3 * i] - mid[0]) * s;
        cloudBuf[3 * i + 1] = (a[3 * i + 2] - mid[2]) * s;
        cloudBuf[3 * i + 2] = -(a[3 * i + 1] - mid[1]) * s;
      }
      cloudPoints.geometry.setDrawRange(0, n);
      cloudPoints.geometry.attributes.position.needsUpdate = true;
      cloudPoints.geometry.computeBoundingSphere();
      dynamic.add(cloudPoints);
    }

    // lines, fading from background colour (old) to full colour (new)
    const bg = new THREE.Color(T.bg);
    for (const ln of d.lines || []) {
      if (ln.points.length < 2) continue;
      const col = colourOf(ln.colour ?? 'trajectory');
      const pos = [], cols = [], n = ln.points.length;
      ln.points.forEach((p, i) => {
        pos.push(...map.w(...p));
        const t = ln.fade ? Math.pow(i / (n - 1), 0.7) : 1;
        const c = bg.clone().lerp(col, 0.15 + 0.85 * t);
        cols.push(c.r, c.g, c.b);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      dynamic.add(new THREE.Line(g, mats.line));
    }

    // fixed points: unstable = ring (hollow), stable = ball (filled)
    for (const m of d.markers || []) {
      const obj = m.kind === 'unstable'
        ? new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 24), mats.unstable)
        : new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), m.kind === 'stable' ? mats.stable : mats.half);
      obj.position.set(...map.w(...m.p));
      if (m.kind === 'unstable') obj.lookAt(camera.position);
      dynamic.add(obj);
    }
    for (const p of d.dots || []) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mats.dot);
      o.position.set(...map.w(...p));
      dynamic.add(o);
    }

    renderer.render(scene, camera);
  }

  function applyColours() {
    T = tokens();
    mats.cloud.color = colourOf('trajectory');
    mats.box.color = colourOf('rule');
    mats.unstable.color = colourOf('unstable');
    mats.stable.color = colourOf('stable');
    mats.half.color = colourOf('ink');
    mats.dot.color = colourOf('highlight');
    builtBounds = null; // rebuild labels in the new colours
  }

  new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    render();
  }).observe(canvas);

  // off-screen: don't render; catch up when visible again
  let visible = true, stale = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && stale) { stale = false; render(); } }, { rootMargin: '200px' }).observe(canvas);
  const maybeRender = () => { if (visible) render(); else stale = true; };

  applyColours();
  onThemeChange(() => { applyColours(); render(); });
  store.subscribe(maybeRender);
  attachOrbit(canvas, store, { yawKey, pitchKey, zoomKey, label });

  return { redraw: render };
}

function textSprite(text, colour, font) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = colour; g.font = `italic 40px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 32, 32);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(0.35, 0.35, 1);
  return sp;
}
