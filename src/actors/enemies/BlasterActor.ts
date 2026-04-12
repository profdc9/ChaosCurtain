import * as ex from 'excalibur';
import { BLASTER } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { LightningBoltActor } from '../LightningBoltActor';
import { GameEvents } from '../../utils/GameEvents';
import { freezeActorIfGameplayPaused } from '../../utils/GameplayPause';

// Precompute 10 spike segments (2 per spike × 5 spikes) in local space.
// Each spike: two line segments forming a narrow triangular point.
const OR = BLASTER.SPIKE_OUTER_RADIUS;
const IR = BLASTER.SPIKE_INNER_RADIUS;
const HA = BLASTER.SPIKE_HALF_ANGLE;
const SEGMENTS: Array<[number, number, number, number]> = [];
for (let i = 0; i < 5; i++) {
  const angle = (i * Math.PI * 2) / 5;
  const tipX  = Math.cos(angle) * OR;
  const tipY  = Math.sin(angle) * OR;
  const lx    = Math.cos(angle - HA) * IR;
  const ly    = Math.sin(angle - HA) * IR;
  const rx    = Math.cos(angle + HA) * IR;
  const ry    = Math.sin(angle + HA) * IR;
  SEGMENTS.push([lx, ly, tipX, tipY]); // left edge → tip
  SEGMENTS.push([tipX, tipY, rx, ry]); // tip → right edge
}

export class BlasterActor extends ex.Actor {
  readonly isEnemy = true;
  readonly enemyName = 'Blaster';
  readonly collisionDamage = BLASTER.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly playerRef: ex.Actor;
  private readonly speed: number;

  private elapsed = 0;
  private dead = false;
  private strobeState = -1; // -1 = uninitialized; tracks last drawn state to avoid redundant redraws
  private readonly blasterCanvas: ex.Canvas;

  constructor(x: number, y: number, player: ex.Actor, difficulty: number) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });

    this.playerRef = player;
    this.speed = BLASTER.SPEED_MIN + difficulty * (BLASTER.SPEED_MAX - BLASTER.SPEED_MIN);

    this.collider.useCircleCollider(BLASTER.COLLIDER_RADIUS);

    this.healthComp = new HealthComponent(
      BLASTER.HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.blasterCanvas = new ex.Canvas({
      width:  BLASTER.CANVAS_SIZE,
      height: BLASTER.CANVAS_SIZE,
      cache: true,
      draw: (ctx) => this.drawBlaster(ctx),
    });
    this.graphics.use(this.blasterCanvas);
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
      if (this.dead) return;
      const other = evt.other as ex.Actor & { isBullet?: boolean; damage?: number };
      if (other.isBullet) {
        this.healthComp.takeDamage(other.damage ?? 0);
        other.kill();
      }
    });
  }

  takeDamage(amount: number): void {
    if (this.dead) return;
    this.healthComp.takeDamage(amount);
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    if (freezeActorIfGameplayPaused(this)) return;
    if (this.dead) return;
    this.elapsed += delta / 1000;

    // Flag dirty only when strobe state flips (every 0.25s), not every frame
    const newStrobeState = Math.floor(this.elapsed * BLASTER.STROBE_HZ * 2) % 2;
    if (newStrobeState !== this.strobeState) {
      this.strobeState = newStrobeState;
      this.blasterCanvas.flagDirty();
    }

    // Move directly toward player
    const toPlayer = this.playerRef.pos.sub(this.pos);
    const dist = toPlayer.size;

    if (dist <= BLASTER.FIRE_RANGE) {
      this.fire(engine);
      return;
    }

    if (dist > 1) {
      this.vel = toPlayer.normalize().scale(this.speed);
    }

    this.clampToBounds();
  }

  private fire(engine: ex.Engine): void {
    if (this.dead) return;
    this.dead = true;

    // Deal damage to player via duck-typed sharedState
    const ps = (this.playerRef as ex.Actor & {
      sharedState?: { applyDamage: (n: number) => void };
    }).sharedState;
    ps?.applyDamage(BLASTER.FIRE_DAMAGE);

    // Spawn lightning bolt visual
    engine.currentScene.add(new LightningBoltActor(this.pos.clone(), this.playerRef.pos.clone()));

    GameEvents.emit('enemy:died', { points: BLASTER.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill();
  }

  private clampToBounds(): void {
    const { INNER_LEFT, INNER_RIGHT, INNER_TOP, INNER_BOTTOM } =
      { INNER_LEFT: 16, INNER_RIGHT: 1264, INNER_TOP: 76, INNER_BOTTOM: 704 };
    const r = BLASTER.COLLIDER_RADIUS;

    if (this.pos.x < INNER_LEFT + r)   { this.pos = ex.vec(INNER_LEFT + r,  this.pos.y); this.vel = ex.vec( Math.abs(this.vel.x), this.vel.y); }
    if (this.pos.x > INNER_RIGHT - r)  { this.pos = ex.vec(INNER_RIGHT - r, this.pos.y); this.vel = ex.vec(-Math.abs(this.vel.x), this.vel.y); }
    if (this.pos.y < INNER_TOP + r)    { this.pos = ex.vec(this.pos.x, INNER_TOP + r);   this.vel = ex.vec(this.vel.x,  Math.abs(this.vel.y)); }
    if (this.pos.y > INNER_BOTTOM - r) { this.pos = ex.vec(this.pos.x, INNER_BOTTOM - r);this.vel = ex.vec(this.vel.x, -Math.abs(this.vel.y)); }
  }

  private onDamage(_healthRatio: number, damage: number): void {
    this.triggerScalePulse(damage);
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  private onDeath(): void {
    if (this.dead) return;
    this.dead = true;
    GameEvents.emit('enemy:died', { points: BLASTER.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill();
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

    for (const [x1, y1, x2, y2] of SEGMENTS) {
      const midLocal = ex.vec((x1 + x2) / 2, (y1 + y2) / 2);
      const worldMid = midLocal.add(this.pos);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const segLen     = Math.sqrt(dx * dx + dy * dy);
      const fragRot    = Math.atan2(dy, dx);
      const outAngle   = Math.atan2(midLocal.y, midLocal.x);
      const speed      = BLASTER.FRAGMENT_SPEED_MIN + Math.random() * (BLASTER.FRAGMENT_SPEED_MAX - BLASTER.FRAGMENT_SPEED_MIN);
      const vel        = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel     = (Math.random() - 0.5) * 2 * BLASTER.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime   = BLASTER.FRAGMENT_LIFETIME_MIN + Math.random() * (BLASTER.FRAGMENT_LIFETIME_MAX - BLASTER.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(worldMid.x, worldMid.y, fragRot, vel, angVel, segLen, lifetime));
    }
  }

  private drawBlaster(ctx: CanvasRenderingContext2D): void {
    const s  = BLASTER.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;

    const isWhite = this.strobeState === 0;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = isWhite ? BLASTER.COLOR_WHITE : BLASTER.COLOR_GRAY;
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';

    for (const [x1, y1, x2, y2] of SEGMENTS) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
