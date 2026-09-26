// Ch 10: the Mandelbrot set on the left (WebGL fragment shader, so panning and zooming stay
// smooth), the orbit of the pointed-at c on the right. One store holds the view
// (centre + zoom, synced to the URL); the orbit view never owns state, it just reads the pointer.

import { setupCanvas, tokens } from './canvas.js';
import { mandelbrot } from '../systems/mandelbrot.js';

const VS = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const FS = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying vec2 vUv;
  uniform vec2 uCentre;
  uniform float uZoom;
  uniform float uAspect;
  uniform float uMaxIter;

  vec3 pal(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  }

  void main() {
    vec2 c = uCentre + vec2(vUv.x * uAspect, vUv.y) * 2.0 / uZoom;
    vec2 z = vec2(0.0);
    float iter = 0.0;
    bool escaped = false;
    for (float i = 0.0; i < 1000.0; i++) {
      if (i >= uMaxIter) break;
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
      iter = i + 1.0;
      if (dot(z, z) > 16.0) { escaped = true; break; }
    }
    if (!escaped) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      float logZn = log(dot(z, z)) / 2.0;
      float nu = log(logZn / 0.693147) / 0.693147;
      float t = iter + 1.0 - nu;
      gl_FragColor = vec4(pal(fract(t / 64.0)), 1.0);
    }
  }
`;

export function createMandelbrotView(mCanvas, oCanvas, readout, store) {
  const pointer = { c: { x: 0, y: 0 }, active: false, sx: 0, sy: 0 };

  // --- the set itself (WebGL) ---------------------------------------------------------------

  const gl = mCanvas.getContext('webgl', { antialias: false });
  let u = null, ok = false;

  if (gl) {
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (vs && fs) {
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        u = {
          centre: gl.getUniformLocation(prog, 'uCentre'),
          zoom: gl.getUniformLocation(prog, 'uZoom'),
          aspect: gl.getUniformLocation(prog, 'uAspect'),
          maxIter: gl.getUniformLocation(prog, 'uMaxIter'),
        };
        ok = true;
      }
    }
  }

  function drawSet() {
    const s = store.get();
    if (!ok) return;
    gl.uniform2f(u.centre, s.zx, s.zy);
    gl.uniform1f(u.zoom, s.zoom);
    gl.uniform1f(u.aspect, mCanvas.width / mCanvas.height);
    gl.uniform1f(u.maxIter, Math.min(1000, 150 + 100 * Math.log2(Math.max(1, s.zoom))));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  if (ok) {
    new ResizeObserver(() => {
      const r = mCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      mCanvas.width = Math.max(1, Math.round(r.width * dpr));
      mCanvas.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, mCanvas.width, mCanvas.height);
      drawSet();
    }).observe(mCanvas);
    store.subscribe(drawSet);
  } else {
    readout.textContent = 'This browser has no WebGL, so the set can’t be drawn — the orbit view still works.';
  }

  // --- pointer → complex coordinate ---------------------------------------------------------

  const rect = () => mCanvas.getBoundingClientRect();
  const at = (sx, sy) => {
    const r = rect();
    const s = store.get();
    const nx = ((sx - r.left) / r.width) * 2 - 1;
    const ny = -(((sy - r.top) / r.height) * 2 - 1);
    return {
      x: s.zx + (nx * (r.width / r.height) * 2) / s.zoom,
      y: s.zy + (ny * 2) / s.zoom,
    };
  };

  // --- the orbit of the pointed-at c (Canvas 2D) --------------------------------------------

  const drawOrbit = setupCanvas(oCanvas, (ctx, size) => {
    const { w, h } = size;
    const T = tokens();
    ctx.clearRect(0, 0, w, h);
    const k = Math.min(w, h) / 4.6;                 // complex units → pixels, so |z| = 2 fits
    const px = (x) => w / 2 + x * k;
    const py = (y) => h / 2 - y * k;

    // axes and the escape circle |z| = 2
    ctx.strokeStyle = T.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0));
    ctx.moveTo(px(0), 0); ctx.lineTo(px(0), h);
    ctx.stroke();
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(px(0), py(0), 2 * k, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!pointer.active) {
      readout.textContent = 'hover or drag over the set to watch one orbit…';
      return;
    }

    const c = pointer.c;
    let z = [0, 0];
    const path = [z];
    let escapeIter = null;
    for (let i = 0; i < 80; i++) {
      z = mandelbrot.step(z, { cx: c.x, cy: c.y });
      path.push(z);
      if (escapeIter === null && z[0] * z[0] + z[1] * z[1] > 4) escapeIter = i + 1;
    }

    ctx.strokeStyle = T.trajectory;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    for (const [zx, zy] of path) ctx.lineTo(px(zx), py(zy));
    ctx.stroke();

    // the parameter c (what your pointer picked) and the current z
    ctx.fillStyle = T.parameter;
    ctx.beginPath();
    ctx.arc(px(c.x), py(c.y), 4, 0, 2 * Math.PI);
    ctx.fill();
    const [zx, zy] = path[path.length - 1];
    ctx.strokeStyle = T.highlight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(zx), py(zy), 3.5, 0, 2 * Math.PI);
    ctx.stroke();

    const im = (c.y < 0 ? ' − ' : ' + ') + Math.abs(c.y).toFixed(3) + 'i';
    readout.textContent = `c = ${c.x.toFixed(3)}${im} · ${escapeIter === null ? 'bounded, in the set' : `escapes past |z| = 2 in about ${escapeIter} steps`}`;
  });

  function probe(e) {
    pointer.sx = e.clientX;
    pointer.sy = e.clientY;
    pointer.c = at(e.clientX, e.clientY);
    pointer.active = true;
    drawOrbit();
  }

  // --- pan, zoom, probe ----------------------------------------------------------------------

  let dragging = false, lastX = 0, lastY = 0;

  mCanvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    probe(e);
    mCanvas.setPointerCapture(e.pointerId);
  });
  mCanvas.addEventListener('pointermove', (e) => {
    probe(e);
    if (!dragging) return;
    const s = store.get();
    const r = rect();
    const dcx = (-(e.clientX - lastX) / r.width) * 4 * (r.width / r.height) / s.zoom;
    const dcy = ((e.clientY - lastY) / r.height) * 4 / s.zoom;
    store.set({ zx: s.zx + dcx, zy: s.zy + dcy });
    lastX = e.clientX; lastY = e.clientY;
    pointer.c = at(e.clientX, e.clientY);   // re-probe: the view moved under the pointer
  });
  mCanvas.addEventListener('pointerup', (e) => {
    dragging = false;
    mCanvas.releasePointerCapture(e.pointerId);
  });
  mCanvas.addEventListener('pointerleave', () => { pointer.active = false; drawOrbit(); });

  mCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const s = store.get();
    const factor = e.deltaY > 0 ? 1 / 1.15 : 1.15;
    const zoom = Math.min(4e5, Math.max(0.5, s.zoom * factor));
    const f = zoom / s.zoom;
    const c = at(e.clientX, e.clientY);
    store.set({ zoom, zx: c.x - (c.x - s.zx) / f, zy: c.y - (c.y - s.zy) / f });
    probe(e);
  }, { passive: false });

  // pan/zoom from a link (?zx=…&zy=…&zoom=…) leaves the pointer where it was: re-probe
  store.subscribe(() => { if (pointer.active) { pointer.c = at(pointer.sx, pointer.sy); drawOrbit(); } });

  return { drawSet, drawOrbit };
}
