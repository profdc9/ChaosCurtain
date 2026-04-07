import * as ex from 'excalibur';

export class FragmentActor extends ex.Actor {
  private elapsed = 0;
  private readonly fragmentCanvas: ex.Canvas;

  constructor(
    x: number,
    y: number,
    rotation: number,
    velocity: ex.Vector,
    angularVelocity: number,
    length: number,
    private readonly lifetime: number,
  ) {
    super({
      pos: ex.vec(x, y),
      rotation,
      vel: velocity,
      angularVelocity,
      collisionType: ex.CollisionType.PreventCollision,
    });

    const canvasW = length + 8;
    const canvasH = 8;

    this.fragmentCanvas = new ex.Canvas({
      width: canvasW,
      height: canvasH,
      cache: false,
      draw: (ctx) => this.drawFragment(ctx, canvasW, canvasH, length),
    });

    this.graphics.use(this.fragmentCanvas);
  }

  private drawFragment(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, length: number): void {
    ctx.clearRect(0, 0, canvasW, canvasH);

    const t = Math.min(1, this.elapsed / this.lifetime);
    const alpha = 1 - t;

    // White → yellow → orange → dim red
    const r = 255;
    let g: number;
    if (t < 0.4) {
      g = 255;
    } else if (t < 0.7) {
      g = Math.floor(255 * (1 - (t - 0.4) / 0.3));
    } else {
      g = 0;
    }

    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const halfLen = length / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgb(${r},${g},0)`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - halfLen, cy);
    ctx.lineTo(cx + halfLen, cy);
    ctx.stroke();
    ctx.restore();
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    this.elapsed += delta / 1000;
    if (this.elapsed >= this.lifetime) {
      this.kill();
    }
  }
}
