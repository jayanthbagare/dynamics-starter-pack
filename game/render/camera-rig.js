// The camera ship. It glides over the water (WASD / arrow keys held down), zooms (wheel, + / −),
// and switches between the ship's view and the top-down vantage.
//
//   const rig = createCameraRig(world, { target: [0, -3], distance: 30, bounds: [[-40, 40], [-40, 30]] });
//   rig.hold('left', true)    // key down; rig.hold('left', false) on key up
//   rig.zoom(1.1)             // > 1 zooms in
//   rig.setVantage(true)
//   rig.frame([x0, z0, x1, z1])   // fit a world rectangle in the vantage view

export function createCameraRig(world, {
  target = [0, 0], distance = 30, pitch = 0.95, bounds = [[-50, 50], [-50, 50]], zoomRange = [10, 70],
} = {}) {
  const state = { x: target[0], z: target[1], dist: distance, vantage: false };
  const held = new Set();
  const home = { ...state, half: world.orthoHalf };

  function place() {
    const cam = world.cameras.ship;
    cam.position.set(state.x, state.dist * Math.sin(pitch), state.z + state.dist * Math.cos(pitch));
    cam.lookAt(state.x, 0, state.z);
    const o = world.cameras.vantage;
    o.position.set(state.x, 80, state.z);
    o.up.set(0, 0, -1);
    o.lookAt(state.x, 0, state.z);
  }

  world.onFrame((dt) => {
    if (!held.size) return;
    const speed = (state.vantage ? world.orthoHalf * 1.2 : state.dist * 0.7) * dt;
    if (held.has('left')) state.x -= speed;
    if (held.has('right')) state.x += speed;
    if (held.has('up')) state.z -= speed;
    if (held.has('down')) state.z += speed;
    state.x = Math.min(bounds[0][1], Math.max(bounds[0][0], state.x));
    state.z = Math.min(bounds[1][1], Math.max(bounds[1][0], state.z));
    place();
  });

  function zoom(f) {
    if (state.vantage) world.setOrthoHalf(Math.min(40, Math.max(4, world.orthoHalf / f)));
    else state.dist = Math.min(zoomRange[1], Math.max(zoomRange[0], state.dist / f));
    place();
  }

  world.canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  place();

  return {
    state,
    hold(dir, down) { if (down) held.add(dir); else held.delete(dir); },
    release() { held.clear(); },
    zoom,
    setVantage(on) {
      state.vantage = on;
      world.useCamera(on ? 'vantage' : 'ship');
      place();
    },
    frame([x0, z0, x1, z1]) {
      state.x = (x0 + x1) / 2; state.z = (z0 + z1) / 2;
      const a = world.size.w / world.size.h;
      world.setOrthoHalf(Math.max((z1 - z0) / 2, (x1 - x0) / 2 / a) * 1.08);
      place();
    },
    home() {
      Object.assign(state, { x: home.x, z: home.z, dist: home.dist });
      place();
    },
  };
}
