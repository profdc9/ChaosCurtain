import * as ex from 'excalibur';
import { GAME, BLASTER } from '../constants';

/**
 * Full-screen overlay actor that draws a fading jagged lightning bolt between
 * two world-space points. Kills itself after BLASTER.BOLT_LIFETIME seconds.
 *
 * Positioned at world origin (0, 0) with anchor (0, 0) so the canvas pixels
 * map directly to world coordinates — same pattern as the room background actor.
 */
export class LightningBoltActor extends ex.Actor {
  private elapsed = 0;
  private readonly jagPoints: ex.Vector[];
  private readonly boltCanvas: ex.Canvas;

  constructor(start: ex.Vector, end: ex.Vector) {
    super({
      pos: ex.vec(0, 0),
      anchor: ex.vec(0, 0),
      collisionType: ex.CollisionType.PreventCollision,
      z: 10,
    });

    this.jagPoints = LightningBoltActor.generateJags(start, end);

    this.boltCanvas = new ex.Canvas({
      width:  GAME.WIDTH,
      height: GAME.HEIGHT,
      cache: false,
      draw: (ctx) => this.drawBolt(ctx),
    });
    this.graphics.use(this.boltCanvas);
    this.graphics.anchor = ex.vec(0, 0);
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    this.elapsed += delta / 1000;
    if (this.elapsed >= BLASTER.BOLT_LIFETIME) {
      this.kill();
    }
  }

  private static generateJags(start: ex.Vector, end: ex.Vector): ex.Vector[] {
    const points: ex.Vector[] = [start];
    const span = end.sub(start);
    // Perpendicular unit vector for random lateral offsets
    const perp = ex.vec(-span.y, span.x);
    const perpLen = perp.size;
    const perpUnit = perpLen > 0 ? perp.scale(1 / perpLen) : ex.vec(0, 1);

    for (let i = 1; i < BLASTER.BOLT_JAGS; i++) {
      const t      = i / BLASTER.BOLT_JAGS;
      const base   = start.add(span.scale(t));
      const offset = (Math.random() - 0.5) * 2 * BLASTER.BOLT_JITTER;
      points.push(base.add(perpUnit.scale(offset)));
    }
    points.push(end);
    return points;
  }

  private drawBolt(ctx: CanvasRenderingContext2D): void {
    const alpha = 1 - Math.min(1, this.elapsed / BLASTER.BOLT_LIFETIME);

    ctx.clearRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = BLASTER.COLOR_WHITE;
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    ctx.beginPath();
    ctx.moveTo(this.jagPoints[0].x, this.jagPoints[0].y);
    for (let i = 1; i < this.jagPoints.length; i++) {
      ctx.lineTo(this.jagPoints[i].x, this.jagPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}
