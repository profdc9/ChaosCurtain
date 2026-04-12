import * as ex from 'excalibur';
import { ZAPSPHERE, ROOM } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { LightningBoltActor } from '../LightningBoltActor';
import { GameEvents } from '../../utils/GameEvents';
import { freezeActorIfGameplayPaused } from '../../utils/GameplayPause';

// Gray → White → Blue (3-state cycle)
const SQUARE_COLORS = ['#888888', '#ffffff', '#0088ff'];

const INNER = {
  L: ROOM.INNER_LEFT  + 30,
  R: ROOM.INNER_RIGHT - 30,
  T: ROOM.INNER_TOP   + 30,
  B: ROOM.INNER_BOTTOM- 30,
};

type PlayerActor = ex.Actor & {
  isPlayer?: boolean;
  sharedState?: { applyDamage: (n: number) => void };
};

export class ZapsphereActor extends ex.Actor {
  readonly isEnemy       = true;
  readonly enemyName     = 'Zapsphere';
  readonly collisionDamage = ZAPSPHERE.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly pickTargetPlayer: (from: ex.Vector) => ex.Actor;
  private readonly dwellThreshold: number;

  private squareAngle  = 0;
  private colorPhase   = 0;
  private dwellTimer   = 0;
  private lightningCooldown = 0;
  private playerInDanger = false;
  /** Satellite-like spiral: perpendicular sign to inward vector. */
  private readonly spiralSpinSign: number;
  private radialInwardSpeed: number = ZAPSPHERE.SPIRAL_RADIAL_LOW;
  private radialJumpTimer = 0;

  private readonly zapsCanvas: ex.Canvas;

  constructor(x: number, y: number, pickTargetPlayer: (from: ex.Vector) => ex.Actor, difficulty: number) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });

    this.pickTargetPlayer = pickTargetPlayer;
    this.spiralSpinSign = Math.random() < 0.5 ? 1 : -1;
    this.pickNewRadialJumpInterval();
    this.pickNewRadialInwardSpeed();

    this.dwellThreshold =
      ZAPSPHERE.DWELL_THRESHOLD_EASY +
      difficulty * (ZAPSPHERE.DWELL_THRESHOLD_HARD - ZAPSPHERE.DWELL_THRESHOLD_EASY);

    this.collider.useCircleCollider(ZAPSPHERE.COLLIDER_RADIUS);

    this.healthComp = new HealthComponent(
      ZAPSPHERE.HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.zapsCanvas = new ex.Canvas({
      width:  ZAPSPHERE.CANVAS_SIZE,
      height: ZAPSPHERE.CANVAS_SIZE,
      cache: false,
      draw: (ctx) => this.drawZapsphere(ctx),
    });
    this.graphics.use(this.zapsCanvas);
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
      const other = evt.other as ex.Actor & { isBullet?: boolean; damage?: number };
      if (other.isBullet) {
        // Bullets from within the danger zone deal boosted damage
        const playerDist = this.minDistToAnyPlayer();
        const rawDamage  = other.damage ?? 0;
        const damage = playerDist <= ZAPSPHERE.DANGER_RADIUS
          ? rawDamage * ZAPSPHERE.DAMAGE_MULTIPLIER
          : rawDamage;
        this.healthComp.takeDamage(damage);
        other.kill();
      }
    });
  }

  takeDamage(amount: number): void {
    this.healthComp.takeDamage(amount);
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    if (freezeActorIfGameplayPaused(this)) return;
    const dt = delta / 1000;

    // Animate inner square
    const dwellRatio = Math.min(1, this.dwellTimer / this.dwellThreshold);
    this.squareAngle += ZAPSPHERE.SQUARE_ROT_BASE * (1 + ZAPSPHERE.SQUARE_ROT_ACCEL * dwellRatio) * dt;
    this.colorPhase  += ZAPSPHERE.COLOR_CYCLE_BASE * (1 + ZAPSPHERE.COLOR_CYCLE_ACCEL * dwellRatio) * dt;

    // Dwell tracking + proximity warning (any player inside danger ring)
    const inDanger = this.minDistToAnyPlayer() <= ZAPSPHERE.DANGER_RADIUS;
    if (inDanger && !this.playerInDanger) {
      this.playerInDanger = true;
      GameEvents.emit('zapsphere:warning', { active: true });
    } else if (!inDanger && this.playerInDanger) {
      this.playerInDanger = false;
      GameEvents.emit('zapsphere:warning', { active: false });
    }
    if (inDanger) {
      this.dwellTimer += dt;
      this.lightningCooldown = Math.max(0, this.lightningCooldown - dt);
      if (this.dwellTimer >= this.dwellThreshold && this.lightningCooldown <= 0) {
        const struck = this.playersInDangerRadius();
        if (struck.length > 0) {
          this.fireLightning(engine, struck);
        }
        this.dwellTimer = 0;
        this.lightningCooldown = ZAPSPHERE.LIGHTNING_COOLDOWN;
      }
    } else {
      this.dwellTimer = Math.max(0, this.dwellTimer - dt * 2); // drains faster outside
    }

    // Spiral inward toward nearest player (satellite-like) with abrupt radial speed changes.
    this.radialJumpTimer -= dt;
    if (this.radialJumpTimer <= 0) {
      this.pickNewRadialJumpInterval();
      this.pickNewRadialInwardSpeed();
    }

    const prey = this.pickTargetPlayer(this.pos);
    const toPlayer = prey.pos.sub(this.pos);
    const dist = toPlayer.size;
    if (dist > 1) {
      const inward = toPlayer.normalize();
      const tangent = ex.vec(-inward.y, inward.x).scale(this.spiralSpinSign);
      this.vel = tangent
        .scale(ZAPSPHERE.SPIRAL_TANGENTIAL_SPEED)
        .add(inward.scale(this.radialInwardSpeed));
    } else {
      this.vel = ex.Vector.Zero;
    }

    // Clamp to room
    this.pos = ex.vec(
      Math.max(INNER.L, Math.min(INNER.R, this.pos.x)),
      Math.max(INNER.T, Math.min(INNER.B, this.pos.y)),
    );
  }

  private pickNewRadialJumpInterval(): void {
    const lo = ZAPSPHERE.RADIAL_JUMP_INTERVAL_MIN;
    const hi = ZAPSPHERE.RADIAL_JUMP_INTERVAL_MAX;
    this.radialJumpTimer = lo + Math.random() * (hi - lo);
  }

  /** Abruptly pick a new inward radial speed (high vs low) for a pulsing spiral feel. */
  private pickNewRadialInwardSpeed(): void {
    const lo = ZAPSPHERE.SPIRAL_RADIAL_LOW;
    const hi = ZAPSPHERE.SPIRAL_RADIAL_HIGH;
    const useHigh = Math.random() < 0.5;
    let next = useHigh ? hi : lo;
    if (Math.abs(next - this.radialInwardSpeed) < 1) {
      next = useHigh ? lo : hi;
    }
    this.radialInwardSpeed = next;
  }

  private fireLightning(engine: ex.Engine, targets: ex.Actor[]): void {
    for (const t of targets) {
      const ps = (t as PlayerActor).sharedState;
      ps?.applyDamage(ZAPSPHERE.LIGHTNING_DAMAGE);
      engine.currentScene.add(new LightningBoltActor(this.pos.clone(), t.pos.clone()));
    }
    GameEvents.emit('zapsphere:lightning', {});
  }

  private allPlayerActors(): ex.Actor[] {
    const scene = this.scene;
    if (!scene) return [this.pickTargetPlayer(this.pos)];
    const list: ex.Actor[] = [];
    for (const child of scene.actors) {
      const a = child as PlayerActor;
      if (a.isPlayer) list.push(a);
    }
    return list.length > 0 ? list : [this.pickTargetPlayer(this.pos)];
  }

  private minDistToAnyPlayer(): number {
    let best = Infinity;
    for (const a of this.allPlayerActors()) {
      best = Math.min(best, a.pos.distance(this.pos));
    }
    return best === Infinity ? this.pickTargetPlayer(this.pos).pos.distance(this.pos) : best;
  }

  private playersInDangerRadius(): ex.Actor[] {
    const r = ZAPSPHERE.DANGER_RADIUS;
    return this.allPlayerActors().filter((a) => a.pos.distance(this.pos) <= r);
  }

  private onDamage(_healthRatio: number, damage: number): void {
    this.triggerScalePulse(damage);
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  /**
   * Excalibur does not call `onKill` — use {@link onPreKill}. Ensures warning-off on room unload etc.
   */
  onPreKill(_scene: ex.Scene): void {
    this.deactivateWarning();
  }

  private deactivateWarning(): void {
    if (this.playerInDanger) {
      this.playerInDanger = false;
      GameEvents.emit('zapsphere:warning', { active: false });
    }
  }

  private onDeath(): void {
    this.deactivateWarning();
    GameEvents.emit('enemy:died', { points: ZAPSPHERE.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill(); // → onPreKill: warning-off if needed
  }

  private triggerScalePulse(damage: number): void {
    const duration = HealthComponent.getPulseDuration(damage);
    const speed    = HealthComponent.getScaleSpeed(duration);
    this.actions.clearActions();
    this.actions.scaleTo(1.3, 1.3, speed, speed).scaleTo(1, 1, speed, speed);
  }

  private spawnFragments(): void {
    const scene = this.scene;
    if (!scene) return;

    const R  = ZAPSPHERE.CIRCLE_RADIUS;
    const SH = ZAPSPHERE.SQUARE_HALF;

    const spawnFrag = (localPos: ex.Vector, length: number, rotation: number, outAngle: number) => {
      const worldPos = localPos.add(this.pos);
      const speed    = ZAPSPHERE.FRAGMENT_SPEED_MIN + Math.random() * (ZAPSPHERE.FRAGMENT_SPEED_MAX - ZAPSPHERE.FRAGMENT_SPEED_MIN);
      const vel      = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel   = (Math.random() - 0.5) * 2 * ZAPSPHERE.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = ZAPSPHERE.FRAGMENT_LIFETIME_MIN + Math.random() * (ZAPSPHERE.FRAGMENT_LIFETIME_MAX - ZAPSPHERE.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(worldPos.x, worldPos.y, rotation, vel, angVel, length, lifetime));
    };

    // Outer circle: diameter line in a random direction
    const ca = Math.random() * Math.PI * 2;
    spawnFrag(ex.vec(0, 0), R * 2, ca, ca);

    // Inner square: 4 sides fly outward from their midpoints
    const corners = [
      [-SH, -SH], [SH, -SH], [SH, SH], [-SH, SH],
    ];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = corners[i];
      const [bx, by] = corners[(i + 1) % 4];
      const cos = Math.cos(this.squareAngle);
      const sin = Math.sin(this.squareAngle);
      const rx = (ax + bx) / 2;
      const ry = (ay + by) / 2;
      const rotMidX = rx * cos - ry * sin;
      const rotMidY = rx * sin + ry * cos;
      const sideLen = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
      const rot = Math.atan2(by - ay, bx - ax) + this.squareAngle;
      const out = Math.atan2(rotMidY, rotMidX);
      spawnFrag(ex.vec(rotMidX, rotMidY), sideLen, rot, out);
    }
  }

  private drawZapsphere(ctx: CanvasRenderingContext2D): void {
    const s  = ZAPSPHERE.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;
    const R  = ZAPSPHERE.CIRCLE_RADIUS;
    const SH = ZAPSPHERE.SQUARE_HALF;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';

    // Outer circle (cyan)
    ctx.strokeStyle = ZAPSPHERE.COLOR_CIRCLE;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();

    // Inner rotating square — color cycles gray→white→blue→gray
    const colorIdx = Math.floor(this.colorPhase % 3);
    ctx.strokeStyle = SQUARE_COLORS[colorIdx];
    ctx.lineWidth   = 1.5;
    ctx.save();
    ctx.rotate(this.squareAngle);
    ctx.strokeRect(-SH, -SH, SH * 2, SH * 2);
    ctx.restore();

    ctx.restore();
  }
}
