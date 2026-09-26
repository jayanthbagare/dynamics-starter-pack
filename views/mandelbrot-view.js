export class MandelbrotView {
  constructor(mandelCanvas, orbitCanvas, orbitRead, store) {
    this.mCanvas = mandelCanvas;
    this.oCanvas = orbitCanvas;
    this.readout = orbitRead;
    this.store = store;

    this.dpr = window.devicePixelRatio || 1;
    
    // WebGL for Mandelbrot
    this.gl = this.mCanvas.getContext('webgl');
    this.initWebGL();

    // 2D for Orbit
    this.oCtx = this.oCanvas.getContext('2d');

    this.pointer = { cx: -0.5, cy: 0, active: false };

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Interaction
    this.setupInteraction();
    
    this.store.subscribe(s => this.drawMandelbrot(s));
    this.drawOrbit();
  }

  resize() {
    // Mandelbrot
    const rect1 = this.mCanvas.getBoundingClientRect();
    this.mCanvas.width = rect1.width * this.dpr;
    this.mCanvas.height = rect1.height * this.dpr;
    this.gl.viewport(0, 0, this.mCanvas.width, this.mCanvas.height);
    
    // Orbit
    const rect2 = this.oCanvas.getBoundingClientRect();
    this.oCanvas.width = rect2.width * this.dpr;
    this.oCanvas.height = rect2.height * this.dpr;
    
    this.drawMandelbrot(this.store.get());
    this.drawOrbit();
  }

  initWebGL() {
    const gl = this.gl;
    if (!gl) return;

    const vsSource = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main() {
        vUv = aPos;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

    // A smooth coloring Mandelbrot shader
    const fsSource = `
      precision highp float;
      varying vec2 vUv;
      uniform vec2 uCenter;
      uniform float uZoom;
      uniform float uAspect;

      // Color mapping: simple heat palette based on normalized iterations
      vec3 color(float t) {
        float r = 9.0 * (1.0 - t) * t * t * t;
        float g = 15.0 * (1.0 - t) * (1.0 - t) * t * t;
        float b = 8.5 * (1.0 - t) * (1.0 - t) * (1.0 - t) * t;
        return vec3(r, g, b);
      }

      void main() {
        // Map UV [-1, 1] to complex plane based on zoom and center
        vec2 c = uCenter + vec2(vUv.x * uAspect, vUv.y) * 2.0 / uZoom;
        
        vec2 z = vec2(0.0);
        float iter = 0.0;
        const float maxIter = 200.0;
        
        for(float i = 0.0; i < 200.0; i++) {
          float x2 = z.x * z.x;
          float y2 = z.y * z.y;
          if (x2 + y2 > 16.0) break;
          z.y = 2.0 * z.x * z.y + c.y;
          z.x = x2 - y2 + c.x;
          iter++;
        }

        if (iter >= maxIter) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black for inside
        } else {
          // Smooth shading
          float log_zn = log(z.x*z.x + z.y*z.y) / 2.0;
          float nu = log(log_zn / log(2.0)) / log(2.0);
          float t = iter + 1.0 - nu;
          gl_FragColor = vec4(color(t / 60.0), 1.0);
        }
      }
    `;

    const prog = gl.createProgram();
    
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    gl.attachShader(prog, vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    gl.attachShader(prog, fs);

    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1,  1,
      -1,  1,  1, -1,   1,  1
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.prog = prog;
    this.uCenter = gl.getUniformLocation(prog, 'uCenter');
    this.uZoom = gl.getUniformLocation(prog, 'uZoom');
    this.uAspect = gl.getUniformLocation(prog, 'uAspect');
  }

  drawMandelbrot(s) {
    if (!this.gl) return;
    const gl = this.gl;
    
    gl.uniform2f(this.uCenter, s.offsetX, s.offsetY);
    gl.uniform1f(this.uZoom, s.zoom);
    gl.uniform1f(this.uAspect, this.mCanvas.width / this.mCanvas.height);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  setupInteraction() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const getComplex = (x, y) => {
      const rect = this.mCanvas.getBoundingClientRect();
      const nx = (x - rect.left) / rect.width * 2 - 1;
      const ny = -((y - rect.top) / rect.height * 2 - 1);
      const aspect = rect.width / rect.height;
      const s = this.store.get();
      return {
        cx: s.offsetX + nx * aspect * 2 / s.zoom,
        cy: s.offsetY + ny * 2 / s.zoom
      };
    };

    this.mCanvas.addEventListener('pointerdown', e => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      this.mCanvas.setPointerCapture(e.pointerId);
    });

    this.mCanvas.addEventListener('pointermove', e => {
      const c = getComplex(e.clientX, e.clientY);
      this.pointer = { cx: c.cx, cy: c.cy, active: true };
      this.drawOrbit();

      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const s = this.store.get();
        const rect = this.mCanvas.getBoundingClientRect();
        const aspect = rect.width / rect.height;
        
        // Convert screen delta to complex delta
        const dcx = -dx / rect.width * 4 * aspect / s.zoom;
        const dcy = dy / rect.height * 4 / s.zoom;

        this.store.set({ offsetX: s.offsetX + dcx, offsetY: s.offsetY + dcy });
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    this.mCanvas.addEventListener('pointerup', e => {
      isDragging = false;
      this.mCanvas.releasePointerCapture(e.pointerId);
    });

    this.mCanvas.addEventListener('pointerleave', () => {
      this.pointer.active = false;
      this.drawOrbit();
    });

    this.mCanvas.addEventListener('wheel', e => {
      e.preventDefault();
      const s = this.store.get();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      
      // Zoom toward pointer
      const c = getComplex(e.clientX, e.clientY);
      
      // New offset so c stays under pointer
      const nox = c.cx - (c.cx - s.offsetX) / factor;
      const noy = c.cy - (c.cy - s.offsetY) / factor;

      this.store.set({ 
        zoom: s.zoom * factor,
        offsetX: nox,
        offsetY: noy
      });
    }, { passive: false });
  }

  drawOrbit() {
    const ctx = this.oCtx;
    const w = this.oCanvas.width;
    const h = this.oCanvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    if (!this.pointer.active) {
      this.readout.textContent = "Hover over the set...";
      return;
    }

    const { cx, cy } = this.pointer;
    this.readout.textContent = \`c = \${cx.toFixed(3)} \${cy >= 0 ? '+' : '-'} \${Math.abs(cy).toFixed(3)}i\`;

    const style = getComputedStyle(document.documentElement);
    const color = style.getPropertyValue('--brand').trim() || '#2e7a55';
    const trace = style.getPropertyValue('--ink-muted').trim() || '#888';

    // Draw axes
    ctx.strokeStyle = style.getPropertyValue('--surface-edge').trim() || '#ddd';
    ctx.lineWidth = 1 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
    ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);
    ctx.stroke();
    
    // Scale: radius 2 circle fits in view
    const scale = Math.min(w, h) / 4.5;
    const toScreen = (x, y) => ({
      sx: w/2 + x * scale,
      sy: h/2 - y * scale
    });

    // Draw escape circle r=2
    ctx.beginPath();
    ctx.arc(w/2, h/2, 2 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = style.getPropertyValue('--surface-edge').trim() || '#ddd';
    ctx.stroke();

    let x = 0;
    let y = 0;
    
    ctx.beginPath();
    const start = toScreen(x, y);
    ctx.moveTo(start.sx, start.sy);

    let escaped = false;
    let iter = 0;
    for (let i = 0; i < 50; i++) {
      const nx = x*x - y*y + cx;
      const ny = 2*x*y + cy;
      x = nx;
      y = ny;
      
      const pt = toScreen(x, y);
      ctx.lineTo(pt.sx, pt.sy);
      
      if (x*x + y*y > 4 && !escaped) {
        escaped = true;
        iter = i;
      }
    }

    ctx.strokeStyle = trace;
    ctx.stroke();

    // Mark current c
    const cpt = toScreen(cx, cy);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cpt.sx, cpt.sy, 4 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    if (escaped) {
      this.readout.textContent += \` (escaped in \${iter} steps)\`;
    } else {
      this.readout.textContent += \` (bounded)\`;
    }
  }
}
