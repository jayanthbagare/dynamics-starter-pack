// The world every zone sails in: a three.js renderer, a low-poly sea, two cameras (the ship's
// perspective view and the top-down vantage), and materials that follow the site's colour tokens.
//
//   const world = createWorld(canvas, { reducedMotion });   // null if WebGL is unavailable
//   const mat = world.paint(new THREE.MeshBasicMaterial(), 'stable');   // recoloured on theme change
//   world.onFrame((dt, t) => { … });                                    // every animation frame
//   world.pick(clientX, clientY)     → THREE.Vector3 on the water, or null
//   world.useCamera('ship' | 'vantage')
//   world.label('π', 'muted')        → a text sprite
//
// Colour roles are the site tokens: bg, surface, ink, muted, rule, trajectory, stable, unstable,
// parameter, highlight. Waves freeze under prefers-reduced-motion.

import * as THREE from '../../vendor/three/three.module.js';
import { tokens, onThemeChange } from '../../views/canvas.js';

export { THREE };

export const WATER = 0.25;   // height at which lanes, boats and charts sit above the waves

export function createWorld(canvas, { reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

  const scene = new THREE.Scene();
  const cameras = {
    ship: new THREE.PerspectiveCamera(42, 1, 0.1, 500),
    vantage: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500),
  };
  let active = 'ship';

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-25, 40, 18);
  scene.add(sun);

  // --- colour -------------------------------------------------------------------------------
  let css = tokens();
  const palette = {};
  const painted = new Map();   // material → [role, opacity]
  const paletteListeners = new Set();

  function readPalette() {
    css = tokens();
    for (const role of ['bg', 'surface', 'ink', 'muted', 'rule', 'trajectory', 'stable', 'unstable', 'parameter', 'highlight']) {
      palette[role] = new THREE.Color(css[role] || '#888');
    }
    const dark = palette.bg.getHSL({}).l < 0.4;
    palette.sea = palette.bg.clone().lerp(palette.trajectory, dark ? 0.28 : 0.2);
    palette.rock = palette.bg.clone().lerp(palette.ink, dark ? 0.25 : 0.35);
    palette.dark = dark;
  }
  readPalette();

  function applyPalette() {
    scene.background = palette.bg;
    scene.fog = new THREE.Fog(palette.bg, 60, 170);
    for (const [mat, role] of painted) mat.color.copy(palette[role]);
    for (const fn of paletteListeners) fn(palette);
  }

  // --- the sea: a flat-shaded grid whose vertices bob on two slow sine waves ------------------
  const seaGeo = new THREE.PlaneGeometry(260, 260, 72, 72).toNonIndexed();
  seaGeo.rotateX(-Math.PI / 2);
  const rest = seaGeo.attributes.position.array.slice();
  const sea = new THREE.Mesh(seaGeo, paint(new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 }), 'sea'));
  sea.position.y = -0.2;
  scene.add(sea);

  function waves(t) {
    const p = seaGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = rest[i], z = rest[i + 2];
      p[i + 1] = 0.13 * Math.sin(0.21 * x + 0.6 * t) + 0.1 * Math.sin(0.29 * z - 0.45 * t + 0.13 * x);
    }
    seaGeo.attributes.position.needsUpdate = true;
  }
  waves(0);

  // --- size & cameras -------------------------------------------------------------------------
  const size = { w: 1, h: 1 };
  let orthoHalf = 16;
  function resize() {
    const r = canvas.getBoundingClientRect();
    size.w = Math.max(1, r.width); size.h = Math.max(1, r.height);
    renderer.setSize(size.w, size.h, false);
    cameras.ship.aspect = size.w / size.h;
    cameras.ship.updateProjectionMatrix();
    setOrthoHalf(orthoHalf);
  }
  function setOrthoHalf(h) {
    orthoHalf = h;
    const a = size.w / size.h, o = cameras.vantage;
    o.left = -h * a; o.right = h * a; o.top = h; o.bottom = -h;
    o.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // --- frame loop -------------------------------------------------------------------------------
  const frameListeners = new Set();
  let last = performance.now(), t = 0;
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    if (!reducedMotion) waves(t);
    for (const fn of frameListeners) fn(dt, t);
    renderer.render(scene, cameras[active]);
  });

  onThemeChange(() => { readPalette(); applyPalette(); });
  applyPalette();

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER);

  function paint(mat, role, opacity = 1) {
    painted.set(mat, role);
    mat.color.copy(palette[role]);
    if (opacity < 1) { mat.transparent = true; mat.opacity = opacity; }
    return mat;
  }

  return {
    THREE, renderer, scene, canvas, palette, size, reducedMotion,
    get css() { return css; },
    get camera() { return cameras[active]; },
    get view() { return active; },
    cameras,
    useCamera(name) { active = name; },
    setOrthoHalf,
    get orthoHalf() { return orthoHalf; },

    paint,
    unpaint(mat) { painted.delete(mat); mat.dispose(); },
    // remove an object and forget/dispose everything it owns
    discard(obj) {
      obj.parent?.remove(obj);
      obj.traverse((o) => {
        o.userData.dispose?.();
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) { painted.delete(m); m.map?.dispose(); m.dispose(); }
      });
    },
    onPalette(fn) { paletteListeners.add(fn); return () => paletteListeners.delete(fn); },
    onFrame(fn) { frameListeners.add(fn); return () => frameListeners.delete(fn); },

    pick(clientX, clientY, height = WATER) {
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, cameras[active]);
      plane.constant = -height;
      return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    },

    label(text, role = 'ink', height = 0.7) { return makeLabel(this, text, role, height); },
  };
}

// A text sprite in the mono font, redrawn when the theme changes.
function makeLabel(world, text, role, height) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const px = 64;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const draw = () => {
    const font = `${px}px ${world.css.mono || 'monospace'}`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 16;
    canvas.width = w; canvas.height = Math.ceil(px * 1.3);
    ctx.font = font;
    ctx.fillStyle = world.css[role] || '#888';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, canvas.height / 2);
    tex.needsUpdate = true;
    sprite.scale.set((height * w) / canvas.height, height, 1);
  };
  draw();
  const off = world.onPalette(draw);
  sprite.userData.dispose = off;
  return sprite;
}
