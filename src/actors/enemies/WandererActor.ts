import * as ex from 'excalibur';
import { WANDERER } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { GameEvents } from '../../utils/GameEvents';

export class WandererActor extends ex.Actor {
  readonly isEnemy = true;
  readonly enemyName = 'Wanderer';
  readonly collisionDamage = WANDERER.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private currentColor: string = WANDERER.COLOR;
  private directionTimer = 0;
  private directionInterval: number;
  private readonly wandererCanvas: ex.Canvas;

  constructor(x: number, y: number) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
      angularVelocity: WandererActor.randomRotationSpeed(),
    });

    this.collider.useCircleCollider(WANDERER.COLLIDER_RADIUS);

    this.directionInterval = WandererActor.randomDirectionInterval();
    this.pickNewDirection();

    this.healthComp = new HealthComponent(
      WANDERER.HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.wandererCanvas = new ex.Canvas({
      width: WANDERER.CANVAS_SIZE,
      height: WANDERER.CANVAS_SIZE,
      cache: false,
      draw: (ctx) => this.drawWanderer(ctx),
    });
    this.graphics.use(this.wandererCanvas);
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
      // Bullet imports handled via dynamic check on class name to avoid circular imports
      const other = evt.other as ex.Actor & { isBullet?: boolean; damage?: number };
      if (other.isBullet) {
        this.healthComp.takeDamage(other.damage ?? 0);
        other.kill();
      }
    });
  }

  takeDamage(amount: number): void {
    this.healthComp.takeDamage(amount);
  }

  private onDamage(healthRatio: number, damage: number): void {
    this.updateColor(healthRatio);
    this.triggerScalePulse(damage);
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  private onDeath(): void {
    GameEvents.emit('enemy:died', { points: WANDERER.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill();
  }

  private updateColor(healthRatio: number): void {
    // Gray (#888888) interpolates toward red (#FF0000) as health drops
    const baseR = 0x88, baseG = 0x88, baseB = 0x88;
    const t = 1 - healthRatio;
    const r = Math.floor(baseR + (255 - baseR) * t);
    const g = Math.floor(baseG * healthRatio);
    const b = Math.floor(baseB * healthRatio);
    this.currentColor = `rgb(${r},${g},${b})`;
  }

  private triggerScalePulse(damage: number): void {
    const duration = HealthComponent.getPulseDuration(damage);
    const speed = HealthComponent.getScaleSpeed(duration);
    this.actions.clearActions();
    this.actions
      .scaleTo(1.3, 1.3, speed, speed)
      .scaleTo(1, 1, speed, speed);
  }

  private spawnFragments(): void {
    const scene = this.scene;
    if (!scene) return;

    const h = WANDERER.HALF_SIZE;
    // Four sides: top, right, bottom, left
    const sides = [
      { midLocal: ex.vec(0, -h), rot: 0 },
      { midLocal: ex.vec(h, 0), rot: Math.PI / 2 },
      { midLocal: ex.vec(0, h), rot: 0 },
      { midLocal: ex.vec(-h, 0), rot: Math.PI / 2 },
    ];

    for (const side of sides) {
      const worldMid = side.midLocal.rotate(this.rotation).add(this.pos);
      const outAngle = Math.atan2(side.midLocal.y, side.midLocal.x) + this.rotation;
      const speed = WANDERER.FRAGMENT_SPEED_MIN + Math.random() * (WANDERER.FRAGMENT_SPEED_MAX - WANDERER.FRAGMENT_SPEED_MIN);
      const vel = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel = (Math.random() - 0.5) * 2 * WANDERER.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = WANDERER.FRAGMENT_LIFETIME_MIN + Math.random() * (WANDERER.FRAGMENT_LIFETIME_MAX - WANDERER.FRAGMENT_LIFETIME_MIN);

      scene.add(new FragmentActor(worldMid.x, worldMid.y, side.rot + this.rotation, vel, angVel, WANDERER.SIZE, lifetime));
    }
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    const dt = delta / 1000;
    this.directionTimer += dt;
    if (this.directionTimer >= this.directionInterval) {
      this.pickNewDirection();
      this.directionTimer = 0;
      this.directionInterval = WandererActor.randomDirectionInterval();
    }

    // Clamp to room inner bounds and bounce direction
    this.clampToBounds();
  }

  private pickNewDirection(): void {
    const angle = Math.random() * Math.PI * 2;
    this.vel = ex.vec(Math.cos(angle) * WANDERER.SPEED, Math.sin(angle) * WANDERER.SPEED);
  }

  private clampToBounds(): void {
    // Import constants inline to avoid top-level import cycle
    const { INNER_LEFT, INNER_RIGHT, INNER_TOP, INNER_BOTTOM } = { INNER_LEFT: 16, INNER_RIGHT: 1264, INNER_TOP: 76, INNER_BOTTOM: 704 };
    const r = WANDERER.COLLIDER_RADIUS;

    if (this.pos.x < INNER_LEFT + r) { this.pos = ex.vec(INNER_LEFT + r, this.pos.y); this.vel = ex.vec(Math.abs(this.vel.x), this.vel.y); }
    if (this.pos.x > INNER_RIGHT - r) { this.pos = ex.vec(INNER_RIGHT - r, this.pos.y); this.vel = ex.vec(-Math.abs(this.vel.x), this.vel.y); }
    if (this.pos.y < INNER_TOP + r) { this.pos = ex.vec(this.pos.x, INNER_TOP + r); this.vel = ex.vec(this.vel.x, Math.abs(this.vel.y)); }
    if (this.pos.y > INNER_BOTTOM - r) { this.pos = ex.vec(this.pos.x, INNER_BOTTOM - r); this.vel = ex.vec(this.vel.x, -Math.abs(this.vel.y)); }
  }

  private drawWanderer(ctx: CanvasRenderingContext2D): void {
    const s = WANDERER.CANVAS_SIZE;
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.strokeStyle = this.currentColor;
    ctx.lineWidth = 2;
    const h = WANDERER.HALF_SIZE;
    ctx.strokeRect(-h, -h, WANDERER.SIZE, WANDERER.SIZE);
    ctx.restore();
  }

  private static randomRotationSpeed(): number {
    const speed = WANDERER.ROTATION_SPEED_MIN + Math.random() * (WANDERER.ROTATION_SPEED_MAX - WANDERER.ROTATION_SPEED_MIN);
    return Math.random() < 0.5 ? speed : -speed;
  }

  private static randomDirectionInterval(): number {
    return WANDERER.DIRECTION_CHANGE_MIN + Math.random() * (WANDERER.DIRECTION_CHANGE_MAX - WANDERER.DIRECTION_CHANGE_MIN);
  }
}
