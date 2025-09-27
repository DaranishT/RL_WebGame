export class Crosshair {
  constructor(params = {}) {
    this.size = params.size || 12;             // crosshair line size
    this.color = params.color || 'white';      // base crosshair color
    this.fireColor = params.fireColor || 'red';// fire indicator
    this.errorMargin = params.errorMargin || 10; // px radius for inaccuracy
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';

    document.body.appendChild(this.canvas);
    window.addEventListener('resize', () => this.resize());
    this.resize();

    this.isFiring = false;
    this.fireTimer = 0;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
  }

  onFire() {
    this.isFiring = true;
    this.fireTimer = 0.15; // show fire effect briefly
  }

  /**
   * Returns a 3D spread vector in camera space.
   * Assumes a perspective projection where (0,0) is screen center.
   * You can later transform this with your camera to world space.
   */
  getSpreadVector() {
    // random polar offset inside error margin
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.errorMargin;

    // offset in screen space
    const offsetX = Math.cos(angle) * radius;
    const offsetY = Math.sin(angle) * radius;

    // normalized device coords [-1,1]
    const ndcX = (this.centerX + offsetX) / this.canvas.width * 2 - 1;
    const ndcY = -((this.centerY + offsetY) / this.canvas.height * 2 - 1);

    // return a vector in clip space (z= -1 forward)
    return { x: ndcX, y: ndcY, z: -1 };
  }

  update(deltaTime) {
    if (this.isFiring) {
      this.fireTimer -= deltaTime;
      if (this.fireTimer <= 0) {
        this.isFiring = false;
      }
    }
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // crosshair lines
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;

    const s = this.size;
    ctx.beginPath();
    ctx.moveTo(this.centerX - s, this.centerY);
    ctx.lineTo(this.centerX - s / 2, this.centerY);
    ctx.moveTo(this.centerX + s / 2, this.centerY);
    ctx.lineTo(this.centerX + s, this.centerY);
    ctx.moveTo(this.centerX, this.centerY - s);
    ctx.lineTo(this.centerX, this.centerY - s / 2);
    ctx.moveTo(this.centerX, this.centerY + s / 2);
    ctx.lineTo(this.centerX, this.centerY + s);
    ctx.stroke();

    // fire effect
    if (this.isFiring) {
      ctx.strokeStyle = this.fireColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, this.errorMargin, 0, Math.PI * 2);
      ctx.stroke();

      // error dot
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * this.errorMargin;
      const errX = this.centerX + Math.cos(angle) * radius;
      const errY = this.centerY + Math.sin(angle) * radius;
      ctx.fillStyle = this.fireColor;
      ctx.beginPath();
      ctx.arc(errX, errY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
