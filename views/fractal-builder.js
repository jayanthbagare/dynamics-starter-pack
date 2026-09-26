export class FractalBuilder {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.type = options.type || 'cantor'; // 'cantor', 'koch', 'koch-glass'
    
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    if (this.type === 'koch-glass') {
      this.glassActive = false;
      this.pointer = { x: 0, y: 0 };
      
      this.canvas.addEventListener('pointerenter', () => this.glassActive = true);
      this.canvas.addEventListener('pointerleave', () => { this.glassActive = false; this.redraw(); });
      this.canvas.addEventListener('pointermove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = e.clientX - rect.left;
        this.pointer.y = e.clientY - rect.top;
        this.redraw();
      });
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.redraw();
  }

  render(gen) {
    this.gen = gen;
    this.redraw();
  }

  redraw() {
    if (this.gen === undefined) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    const style = getComputedStyle(document.documentElement);
    const color = style.getPropertyValue('--ink').trim() || '#1a1a1a';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (this.type === 'cantor') {
      this.drawCantor(ctx, 40, this.w - 40, this.h / 2, this.gen);
    } else if (this.type === 'koch') {
      const margin = 40;
      const width = this.w - 2 * margin;
      // height of triangle is width * sqrt(3)/6
      const dy = width * Math.sqrt(3) / 6;
      this.drawKoch(ctx, margin, this.h / 2 + dy/2, this.w - margin, this.h / 2 + dy/2, this.gen);
    } else if (this.type === 'koch-glass') {
      const margin = 40;
      const width = this.w - 2 * margin;
      const dy = width * Math.sqrt(3) / 6;
      
      ctx.save();
      
      // If glass is active, we clip to a circle and scale up, otherwise normal draw
      if (this.glassActive) {
        // Draw background normal Koch faded
        ctx.globalAlpha = 0.2;
        this.drawKoch(ctx, margin, this.h / 2 + dy/2, this.w - margin, this.h / 2 + dy/2, this.gen);
        ctx.globalAlpha = 1.0;

        // Clip and scale
        const r = 80; // glass radius
        ctx.beginPath();
        ctx.arc(this.pointer.x, this.pointer.y, r, 0, Math.PI * 2);
        ctx.save();
        ctx.clip();

        // Fill background of glass
        ctx.fillStyle = style.getPropertyValue('--surface').trim() || '#fff';
        ctx.fill();

        // 3x zoom centered at pointer
        ctx.translate(this.pointer.x, this.pointer.y);
        ctx.scale(3, 3);
        ctx.translate(-this.pointer.x, -this.pointer.y);

        ctx.strokeStyle = color;
        this.drawKoch(ctx, margin, this.h / 2 + dy/2, this.w - margin, this.h / 2 + dy/2, this.gen);
        ctx.restore();

        // Glass border
        ctx.beginPath();
        ctx.arc(this.pointer.x, this.pointer.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = style.getPropertyValue('--brand').trim() || '#2e7a55';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        this.drawKoch(ctx, margin, this.h / 2 + dy/2, this.w - margin, this.h / 2 + dy/2, this.gen);
      }
      
      ctx.restore();
    }
  }

  drawCantor(ctx, x0, x1, y, gen) {
    if (gen === 0) {
      ctx.fillRect(x0, y - 5, x1 - x0, 10);
    } else {
      const w = (x1 - x0) / 3;
      this.drawCantor(ctx, x0, x0 + w, y, gen - 1);
      this.drawCantor(ctx, x1 - w, x1, y, gen - 1);
    }
  }

  drawKoch(ctx, x0, y0, x1, y1, gen) {
    if (gen === 0) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const dx = x1 - x0;
      const dy = y1 - y0;
      
      const p1x = x0 + dx / 3;
      const p1y = y0 + dy / 3;
      
      const p3x = x0 + 2 * dx / 3;
      const p3y = y0 + 2 * dy / 3;

      // Peak of equilateral triangle
      // Rotate vector (p1 -> p3) by -60 degrees
      const vx = p3x - p1x;
      const vy = p3y - p1y;
      const cos60 = 0.5;
      const sin60 = Math.sqrt(3) / 2;
      
      const p2x = p1x + vx * cos60 - vy * (-sin60);
      const p2y = p1y + vx * (-sin60) + vy * cos60;

      this.drawKoch(ctx, x0, y0, p1x, p1y, gen - 1);
      this.drawKoch(ctx, p1x, p1y, p2x, p2y, gen - 1);
      this.drawKoch(ctx, p2x, p2y, p3x, p3y, gen - 1);
      this.drawKoch(ctx, p3x, p3y, x1, y1, gen - 1);
    }
  }
}
