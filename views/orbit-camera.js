// Turn a 3D view by dragging (or with the arrow keys); zoom with the wheel or a two-finger pinch.
// The angles live in the store, so a link reproduces the view. Shared by landscape.js and scene3d.js.
//
//   attachOrbit(canvas, store, { yawKey: 'yaw', pitchKey: 'elev', zoomKey: 'zoom', label })
//   placeCamera(camera, store.get(), { yawKey, pitchKey, zoomKey, distance: 7, target: [0, 0, 0] })

export function placeCamera(camera, s, { yawKey, pitchKey, zoomKey = null, distance = 7, target = [0, 0, 0] }) {
  const yaw = s[yawKey], pitch = s[pitchKey], d = distance / (zoomKey ? s[zoomKey] : 1);
  camera.position.set(
    target[0] + d * Math.cos(pitch) * Math.sin(yaw),
    target[1] + d * Math.sin(pitch),
    target[2] + d * Math.cos(pitch) * Math.cos(yaw),
  );
  camera.lookAt(...target);
}

export function attachOrbit(canvas, store, { yawKey, pitchKey, zoomKey = null, label = '3D view', pitchRange = [0.12, 1.35] }) {
  const turn = (dyaw, dpitch) => {
    const s = store.get();
    store.set({
      [yawKey]: +(s[yawKey] + dyaw).toFixed(3),
      [pitchKey]: +Math.min(pitchRange[1], Math.max(pitchRange[0], s[pitchKey] + dpitch)).toFixed(3),
    });
  };
  const zoomBy = (f) => {
    if (!zoomKey) return;
    store.set({ [zoomKey]: +Math.min(3, Math.max(0.5, store.get()[zoomKey] * f)).toFixed(3) });
  };

  const pointers = new Map();
  let pinch = null;
  canvas.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoomBy(d / pinch);
      pinch = d;
    } else {
      turn(-(e.clientX - prev[0]) * 0.008, (e.clientY - prev[1]) * 0.006);
    }
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  if (zoomKey) canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });

  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${label}. Drag, or use the arrow keys, to turn the view${zoomKey ? '; + and − zoom' : ''}.`);
  canvas.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [0.08, 0], ArrowRight: [-0.08, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] }[e.key];
    if (k) { e.preventDefault(); turn(...k); } else if (e.key === '+' || e.key === '=') zoomBy(1.15); else if (e.key === '-') zoomBy(1 / 1.15);
  });
}
