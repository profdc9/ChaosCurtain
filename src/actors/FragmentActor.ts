import * as ex from 'excalibur';
import { freezeActorIfGameplayPaused } from '../utils/GameplayPause';

export type FragmentBurnFrom = { r: number; g: number; b: number };

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
    /** When set, stroke fades from this color through yellow/orange to transparent (player wreck). */
    private readonly burnFrom?: FragmentBurnFrom,
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

    let r: number;
    let g: number;
    let b: number;
    if (this.burnFrom) {
      // Ship tint → hot yellow → orange → dark, then fade via alpha
      const br = this.burnFrom.r;
      const bg = this.burnFrom.g;
      const bb = this.burnFrom.b;
      if (t < 0.35) {
        const u = t / 0.35;
        r = br + (255 - br) * u * 0.35;
        g = bg + (255 - bg) * u * 0.5;
        b = bb * (1 - u * 0.4);
      } else if (t < 0.65) {
        const u = (t - 0.35) / 0.3;
        r = 255;
        g = 200 + 55 * (1 - u);
        b = Math.floor(bb * (1 - u));
      } else {
        const u = (t - 0.65) / 0.35;
        r = 255;
        g = Math.floor(200 * (1 - u * 0.85));
        b = 0;
      }
    } else {
      // White → yellow → orange → dim red (enemy wreck)
      r = 255;
      if (t < 0.4) {
        g = 255;
      } else if (t < 0.7) {
        g = Math.floor(255 * (1 - (t - 0.4) / 0.3));
      } else {
        g = 0;
      }
      b = 0;
    }

    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const halfLen = length / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - halfLen, cy);
    ctx.lineTo(cx + halfLen, cy);
    ctx.stroke();
    ctx.restore();
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    if (freezeActorIfGameplayPaused(this)) return;
    this.elapsed += delta / 1000;
    if (this.elapsed >= this.lifetime) {
      this.kill();
    }
  }
}
