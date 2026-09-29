// Pointer on the sea: tells a click from a drag and reports positions as states in the zone's
// space (a number on a lane).
//
//   attachSeaPointer(world, space, {
//     onHover(x), onLeave(),
//     onClick(x),                              // pressed and released without moving
//     onDragStart(x), onDragMove(x), onDragEnd(x),
//   });

export function attachSeaPointer(world, space, handlers) {
  const canvas = world.canvas;
  const call = (name, ...args) => handlers[name]?.(...args);
  let down = null, dragging = false;

  const stateAt = (e) => {
    const p = world.pick(e.clientX, e.clientY);
    return p ? space.fromWorld(p) : null;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const x = stateAt(e);
    if (x == null) return;
    down = { px: e.clientX, py: e.clientY, x };
    dragging = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const x = stateAt(e);
    if (x == null) return;
    call('onHover', x);
    if (!down) return;
    if (!dragging && Math.hypot(e.clientX - down.px, e.clientY - down.py) > 6) {
      dragging = true;
      call('onDragStart', down.x);
    }
    if (dragging) call('onDragMove', x);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const x = stateAt(e) ?? down.x;
    if (dragging) call('onDragEnd', x); else call('onClick', down.x);
    down = null; dragging = false;
  });
  canvas.addEventListener('pointercancel', () => { down = null; dragging = false; });
  canvas.addEventListener('pointerleave', () => { if (!down) call('onLeave'); });
}
