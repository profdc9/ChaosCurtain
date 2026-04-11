import * as ex from 'excalibur';
import { PLAYER } from '../constants';
import { InputSystem } from '../systems/InputSystem';
import { BulletActor } from './BulletActor';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { GameEvents } from '../utils/GameEvents';

export class PlayerActor extends ex.Actor {
  readonly isPlayer = true; // duck-typed by DoorActor and PickupActor
  readonly sharedState: SharedPlayerState;
  /** Pull forces applied by active Wrangler tethers. Keys are wrangler actor instances. */
  readonly pullRegistry = new Map<object, ex.Vector>();
  /** Approach-block directions from active GlitchBoss cones. Value = unit vector toward boss. */
  readonly glitchRegistry = new Map<object, ex.Vector>();

  private readonly input: InputSystem;
  /** Low-pass of summed tether pulls — raw pull direction flickers sub-pixel each frame and felt like stick drift. */
  private tetherPullSmoothed = ex.Vector.Zero;
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
      const other = evt.other as ex.Actor & {
        isEnemy?: boolean;
        collisionDamage?: number;
        takeDamage?: (n: number) => void;
        ignoresPlayerRam?: boolean;
      };
      if (other.isEnemy) {
        this.sharedState.applyDamage(other.collisionDamage ?? 0);
        if (!other.ignoresPlayerRam) {
          other.takeDamage?.(PLAYER.COLLISION_DAMAGE_TO_ENEMY);
        }
      }
    });
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    const dt = delta / 1000;
    const state = this.input.getState(this.pos);

    // Movement
    if (state.move.size > 0) {
      this.vel = state.move.scale(PLAYER.SPEED);
    } else {
      this.vel = ex.Vector.Zero;
    }

    // Apply wrangler tether pulls (smoothed — per-frame normalize() on tiny deltas is noisy)
    if (this.pullRegistry.size === 0) {
      this.tetherPullSmoothed = ex.Vector.Zero;
    } else {
      let pullSum = ex.Vector.Zero;
      for (const pull of this.pullRegistry.values()) {
        pullSum = pullSum.add(pull);
      }
      const smooth = 0.55;
      if (pullSum.size < 0.25) {
        this.tetherPullSmoothed = this.tetherPullSmoothed.scale(0.62);
      } else {
        this.tetherPullSmoothed = ex.vec(
          this.tetherPullSmoothed.x * (1 - smooth) + pullSum.x * smooth,
          this.tetherPullSmoothed.y * (1 - smooth) + pullSum.y * smooth,
        );
      }
    }
    this.vel = this.vel.add(this.tetherPullSmoothed);

    // Apply GlitchBoss cone constraints — remove any velocity component directed toward a boss
    for (const towardBoss of this.glitchRegistry.values()) {
      const dot = this.vel.dot(towardBoss);
      if (dot > 0) {
        this.vel = this.vel.sub(towardBoss.scale(dot));
      }
    }

    // Rotation: face aim direction when non-zero, fall back to movement direction
    if (state.aim.size > 0) {
      this.rotation = Math.atan2(state.aim.y, state.aim.x);
    } else if (state.move.size > 0) {
      this.rotation = Math.atan2(state.move.y, state.move.x);
    }

    // Firing — multi-direction based on shooterType
    this.fireTimer += dt;
    if (state.isFiring && state.aim.size > 0 && this.fireTimer >= PLAYER.FIRE_RATE) {
      this.fireTimer = 0;
      this.spawnBullets(engine, state.aim);
    }

    // Panic button — edge-triggered
    if (state.panicPressed) {
      const damage = this.sharedState.deployPanic();
      if (damage !== null) {
        this.applyPanicDamage(engine, damage);
      }
    }
  }

  private spawnBullets(engine: ex.Engine, aim: ex.Vector): void {
    const damage = this.sharedState.bulletDamage;
    const directions: ex.Vector[] = [aim];

    if (this.sharedState.shooterType >= 2) {
      directions.push(aim.negate());
    }
    if (this.sharedState.shooterType >= 3) {
      // Cardinal: add the two perpendicular directions
      const perp = ex.vec(-aim.y, aim.x);
      directions.push(perp, perp.negate());
    }

    for (const dir of directions) {
      engine.currentScene.add(new BulletActor(this.pos.clone(), dir, damage));
    }
    GameEvents.emit('bullet:fired', {});
  }

  private applyPanicDamage(engine: ex.Engine, damage: number): void {
    for (const actor of engine.currentScene.actors) {
      const enemy = actor as ex.Actor & { isEnemy?: boolean; takeDamage?: (n: number) => void };
      if (enemy.isEnemy && enemy.takeDamage) {
        enemy.takeDamage(damage);
      }
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
