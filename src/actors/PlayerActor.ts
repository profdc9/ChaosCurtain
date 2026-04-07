import * as ex from 'excalibur';
import { PLAYER, ROOM, WANDERER } from '../constants';
import { InputSystem } from '../systems/InputSystem';
import { BulletActor } from './BulletActor';
import { WandererActor } from './enemies/WandererActor';
import { SharedPlayerState } from '../state/SharedPlayerState';

export class PlayerActor extends ex.Actor {
  private readonly input: InputSystem;
  private readonly sharedState: SharedPlayerState;
  private fireTimer = 0;
  private readonly playerCanvas: ex.Canvas;
  private readonly shipColor: string;

  constructor(
    engine: ex.Engine,
    sharedState: SharedPlayerState,
    color: string = PLAYER.COLOR_P1,
  ) {
    super({
      pos: ex.vec(640, 390),
      collisionType: ex.CollisionType.Active,
    });

    this.shipColor = color;
    this.sharedState = sharedState;
    this.input = new InputSystem(engine);

    this.collider.useCircleCollider(PLAYER.COLLIDER_RADIUS);

    this.playerCanvas = new ex.Canvas({
      width: PLAYER.CANVAS_SIZE,
      height: PLAYER.CANVAS_SIZE,
      cache: true,
      draw: (ctx) => this.drawShip(ctx),
    });
    this.graphics.use(this.playerCanvas);
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
      const other = evt.other;
      if (other instanceof WandererActor) {
        this.sharedState.takeDamage(WANDERER.COLLISION_DAMAGE);
        other.takeDamage(PLAYER.COLLISION_DAMAGE_TO_ENEMY);
      }
    });
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    const dt = delta / 1000;
    const state = this.input.getState(this.pos);

    // Movement
    if (Math.sqrt(state.move.x * state.move.x + state.move.y * state.move.y) > 0) {
      this.vel = state.move.scale(PLAYER.SPEED);
      this.rotation = Math.atan2(state.move.y, state.move.x);
    } else {
      this.vel = ex.Vector.Zero;
    }

    // Clamp to room bounds
    this.pos = ex.vec(
      Math.max(ROOM.INNER_LEFT + PLAYER.COLLIDER_RADIUS, Math.min(ROOM.INNER_RIGHT - PLAYER.COLLIDER_RADIUS, this.pos.x)),
      Math.max(ROOM.INNER_TOP + PLAYER.COLLIDER_RADIUS, Math.min(ROOM.INNER_BOTTOM - PLAYER.COLLIDER_RADIUS, this.pos.y)),
    );

    // Firing
    this.fireTimer += dt;
    if (state.isFiring && Math.sqrt(state.aim.x * state.aim.x + state.aim.y * state.aim.y) > 0 && this.fireTimer >= PLAYER.FIRE_RATE) {
      this.fireTimer = 0;
      const bullet = new BulletActor(this.pos.clone(), state.aim);
      engine.currentScene.add(bullet);
    }
  }

  private drawShip(ctx: CanvasRenderingContext2D): void {
    const s = PLAYER.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;
    const len = PLAYER.SHIP_LENGTH;
    const hw = PLAYER.SHIP_HALF_WIDTH;
    const nr = PLAYER.NACELLE_RADIUS;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = this.shipColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    // Triangle: apex at (+len/2, 0), base corners at (-len/2, ±hw)
    ctx.beginPath();
    ctx.moveTo(len / 2, 0);
    ctx.lineTo(-len / 2, -hw);
    ctx.lineTo(-len / 2, hw);
    ctx.closePath();
    ctx.stroke();

    // Nacelle circles at base corners
    ctx.beginPath();
    ctx.arc(-len / 2, -hw, nr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-len / 2, hw, nr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
