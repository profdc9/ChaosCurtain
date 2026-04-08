import * as ex from 'excalibur';
import { BULLET, ROOM } from '../constants';

export class BulletActor extends ex.Actor {
  readonly isBullet = true;
  readonly damage: number;

  constructor(pos: ex.Vector, direction: ex.Vector, damage: number = BULLET.DAMAGE) {
    super({
      pos,
      vel: direction.scale(BULLET.SPEED),
      collisionType: ex.CollisionType.Passive,
      radius: BULLET.RADIUS,
    });

    this.damage = damage;

    const canvas = new ex.Canvas({
      width: BULLET.CANVAS_SIZE,
      height: BULLET.CANVAS_SIZE,
      cache: true,
      draw: (ctx) => {
        ctx.clearRect(0, 0, BULLET.CANVAS_SIZE, BULLET.CANVAS_SIZE);
        ctx.save();
        ctx.translate(BULLET.CANVAS_SIZE / 2, BULLET.CANVAS_SIZE / 2);
        ctx.fillStyle = BULLET.COLOR;
        ctx.beginPath();
        ctx.arc(0, 0, BULLET.RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    });
    this.graphics.use(canvas);
  }

  onPreUpdate(_engine: ex.Engine, _delta: number): void {
    // Kill when out of room bounds
    if (
      this.pos.x < ROOM.INNER_LEFT ||
      this.pos.x > ROOM.INNER_RIGHT ||
      this.pos.y < ROOM.INNER_TOP ||
      this.pos.y > ROOM.INNER_BOTTOM
    ) {
      this.kill();
    }
  }
}
