import * as ex from 'excalibur';
import { SNAKE_BOSS, ROOM } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { GameEvents } from '../../utils/GameEvents';
import { freezeActorIfGameplayPaused } from '../../utils/GameplayPause';
import { SnakeSegmentActor } from './SnakeSegmentActor';

type SnakeState = 'orbit' | 'ram' | 'recoil';

const INNER = {
  L: ROOM.INNER_LEFT  + 20,
  R: ROOM.INNER_RIGHT - 20,
  T: ROOM.INNER_TOP   + 20,
  B: ROOM.INNER_BOTTOM- 20,
};

export class SnakeBossActor extends ex.Actor {
  readonly isEnemy       = true;
  readonly enemyName     = 'Snake';
  readonly ignoresPlayerRam = true;
  readonly collisionDamage  = SNAKE_BOSS.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly pickTargetPlayer: (from: ex.Vector) => ex.Actor;
  private readonly registerEnemy: (actor: ex.Actor) => void;

  private state: SnakeState = 'orbit';
  private stateTimer   = 0;
  private orbitRadius: number = SNAKE_BOSS.ORBIT_RADIUS;
  private orbitAngle   = 0; // current angle around player
  private orbitDuration = 0;
  private ramTarget    = ex.vec(0, 0);
  private recoilDir    = ex.vec(1, 0);
  private speedMult    = 1.0;
  private segmentsLost = 0;

  private currentHeadColor: string = SNAKE_BOSS.COLOR_BODY;
  private readonly headCanvas: ex.Canvas;
  private readonly segments: SnakeSegmentActor[] = [];

  // Position history for body-follows-head movement
  private readonly posHistory: {pos: ex.Vector; angle: number}[] = [];
  private static readonly MAX_HISTORY = 400;

  constructor(
    x: number,
    y: number,
    pickTargetPlayer: (from: ex.Vector) => ex.Actor,
    _difficulty: number,
    registerEnemy: (actor: ex.Actor) => void,
  ) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });

    this.pickTargetPlayer = pickTargetPlayer;
    this.registerEnemy = registerEnemy;
    this.collider.useCircleCollider(SNAKE_BOSS.COLLIDER_RADIUS_HEAD);

    // Start orbiting on a random angle
    this.orbitAngle   = Math.random() * Math.PI * 2;
    this.orbitDuration = this.randomOrbitDuration();

    this.healthComp = new HealthComponent(
      SNAKE_BOSS.HEAD_HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.headCanvas = new ex.Canvas({
      width:  SNAKE_BOSS.CANVAS_SIZE_HEAD,
      height: SNAKE_BOSS.CANVAS_SIZE_HEAD,
      cache: true,
      draw: (ctx) => this.drawHead(ctx),
    });
    this.graphics.use(this.headCanvas);
  }

  onInitialize(_engine: ex.Engine): void {
    // Create and register all body segments
    for (let i = 0; i < SNAKE_BOSS.SEGMENT_COUNT; i++) {
      const seg = new SnakeSegmentActor(this.pos.x, this.pos.y, (s) => this.onSegmentDied(s));
      this.segments.push(seg);
      this.registerEnemy(seg);
    }

    this.on('collisionstart', (evt) => {
      const other = evt.other as ex.Actor & { isBullet?: boolean; damage?: number; isPlayer?: boolean };
      if (other.isBullet) {
        this.healthComp.takeDamage(other.damage ?? 0);
        other.kill();
      } else if (other.isPlayer && this.state === 'ram') {
        this.enterRecoil();
      }
    });
  }

  takeDamage(amount: number): void {
    this.healthComp.takeDamage(amount);
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    if (freezeActorIfGameplayPaused(this)) return;
    const dt = delta / 1000;
    this.stateTimer += dt;

    switch (this.state) {
      case 'orbit': this.updateOrbit(dt); break;
      case 'ram':   this.updateRam(dt);   break;
      case 'recoil':this.updateRecoil(dt);break;
    }

    // Clamp head to room
    this.pos = ex.vec(
      Math.max(INNER.L, Math.min(INNER.R, this.pos.x)),
      Math.max(INNER.T, Math.min(INNER.B, this.pos.y)),
    );

    // Update position history
    this.posHistory.push({ pos: this.pos.clone(), angle: this.rotation });
    if (this.posHistory.length > SnakeBossActor.MAX_HISTORY) {
      this.posHistory.shift();
    }

    // Update segment positions from history
    this.updateSegmentPositions();
  }

  private updateOrbit(dt: number): void {
    const orbitCenter = this.pickTargetPlayer(this.pos).pos;
    const toPlayer  = orbitCenter.sub(this.pos);
    const dist      = toPlayer.size;
    const orbitSpeed = SNAKE_BOSS.ORBIT_SPEED * this.speedMult;

    // Angular velocity to maintain orbit
    this.orbitAngle += (orbitSpeed / Math.max(dist, 1)) * dt;
    this.orbitRadius = Math.max(
      SNAKE_BOSS.ORBIT_MIN_RADIUS,
      this.orbitRadius - SNAKE_BOSS.ORBIT_TIGHTEN_RATE * dt,
    );

    // Target position on orbit circle
    const targetPos = orbitCenter.add(
      ex.vec(Math.cos(this.orbitAngle) * this.orbitRadius, Math.sin(this.orbitAngle) * this.orbitRadius),
    );
    const dir = targetPos.sub(this.pos);

    if (dir.size > 1) {
      const targetAngle = Math.atan2(dir.y, dir.x);
      this.smoothRotate(targetAngle, dt, 5.0);
      this.vel = ex.vec(Math.cos(this.rotation), Math.sin(this.rotation)).scale(orbitSpeed);
    }

    if (this.stateTimer >= this.orbitDuration || this.orbitRadius <= SNAKE_BOSS.ORBIT_MIN_RADIUS) {
      this.enterRam();
    }
  }

  private updateRam(_dt: number): void {
    const toTarget = this.ramTarget.sub(this.pos);
    const dist     = toTarget.size;

    if (dist < 60 || this.stateTimer > 2.5) {
      this.enterOrbit();
      return;
    }

    if (dist > 1) {
      const dir = toTarget.normalize();
      this.rotation = Math.atan2(dir.y, dir.x);
      this.vel = dir.scale(SNAKE_BOSS.RAM_SPEED * this.speedMult);
    }
  }

  private updateRecoil(dt: number): void {
    this.vel = this.recoilDir.scale(SNAKE_BOSS.RECOIL_SPEED);
    const targetAngle = Math.atan2(-this.recoilDir.y, -this.recoilDir.x);
    this.smoothRotate(targetAngle, dt, 3.0);

    if (this.stateTimer >= SNAKE_BOSS.RECOIL_DURATION) {
      this.enterOrbit();
    }
  }

  private enterOrbit(): void {
    this.state = 'orbit';
    this.stateTimer = 0;
    this.orbitRadius = SNAKE_BOSS.ORBIT_RADIUS;
    this.orbitDuration = this.randomOrbitDuration();
    this.vel = ex.Vector.Zero;
  }

  private enterRam(): void {
    this.state = 'ram';
    this.stateTimer = 0;
    this.ramTarget = this.pickTargetPlayer(this.pos).pos.clone();
    const dir = this.ramTarget.sub(this.pos);
    this.recoilDir = dir.size > 0 ? dir.normalize().negate() : ex.vec(-1, 0);
  }

  private enterRecoil(): void {
    this.state = 'recoil';
    this.stateTimer = 0;
    this.vel = ex.Vector.Zero;
  }

  private smoothRotate(targetAngle: number, dt: number, speed: number): void {
    let diff = targetAngle - this.rotation;
    diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.rotation += Math.max(-speed * dt, Math.min(speed * dt, diff));
  }

  private randomOrbitDuration(): number {
    return SNAKE_BOSS.ORBIT_DURATION_MIN +
      Math.random() * (SNAKE_BOSS.ORBIT_DURATION_MAX - SNAKE_BOSS.ORBIT_DURATION_MIN);
  }

  private updateSegmentPositions(): void {
    if (this.posHistory.length === 0) return;

    const currentSpeed = Math.max(10, this.vel.size);
    // frames needed to travel one SEGMENT_SPACING at current speed (assuming ~60fps)
    const step = Math.max(1, Math.round(SNAKE_BOSS.SEGMENT_SPACING * 60 / currentSpeed));

    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i].isKilled()) continue;
      const idx = Math.max(0, this.posHistory.length - 1 - (i + 1) * step);
      const h   = this.posHistory[idx];
      this.segments[i].updatePos(h.pos, h.angle);
    }
  }

  private onSegmentDied(segment: SnakeSegmentActor): void {
    const idx = this.segments.indexOf(segment);
    if (idx < 0) return;

    // Kill all segments tail-ward (higher indices)
    for (let i = idx + 1; i < this.segments.length; i++) {
      if (!this.segments[i].isKilled()) {
        this.segments[i].killSilently();
      }
    }

    this.segmentsLost = this.segments.filter(s => s.isKilled()).length;
    this.speedMult = Math.min(
      SNAKE_BOSS.MAX_SPEED_MULTIPLIER,
      1 + this.segmentsLost * SNAKE_BOSS.SPEED_BOOST_PER_LOSS,
    );
  }

  private onDamage(healthRatio: number, damage: number): void {
    const t = 1 - healthRatio;
    const r = Math.floor(t * 255);
    const g = Math.floor(healthRatio * 255);
    this.currentHeadColor = `rgb(${r},${g},0)`;
    this.headCanvas.flagDirty();
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  private onDeath(): void {
    // Kill all remaining segments
    for (const seg of this.segments) {
      if (!seg.isKilled()) {
        seg.killSilently();
      }
    }
    GameEvents.emit('enemy:died', { points: SNAKE_BOSS.POINT_VALUE_HEAD, x: this.pos.x, y: this.pos.y });
    this.spawnHeadFragments();
    this.kill();
  }

  private spawnHeadFragments(): void {
    const scene = this.scene;
    if (!scene) return;
    const R = SNAKE_BOSS.HEAD_RADIUS;

    for (let i = 0; i < 3; i++) {
      const outAngle = (i * Math.PI * 2) / 3 + Math.random() * 0.5;
      const speed    = SNAKE_BOSS.FRAGMENT_SPEED_MIN + Math.random() * (SNAKE_BOSS.FRAGMENT_SPEED_MAX - SNAKE_BOSS.FRAGMENT_SPEED_MIN);
      const vel      = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel   = (Math.random() - 0.5) * 2 * SNAKE_BOSS.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = SNAKE_BOSS.FRAGMENT_LIFETIME_MIN + Math.random() * (SNAKE_BOSS.FRAGMENT_LIFETIME_MAX - SNAKE_BOSS.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(this.pos.x, this.pos.y, outAngle, vel, angVel, R * 2, lifetime));
    }
  }

  private drawHead(ctx: CanvasRenderingContext2D): void {
    const s  = SNAKE_BOSS.CANVAS_SIZE_HEAD;
    const cx = s / 2;
    const cy = s / 2;
    const R  = SNAKE_BOSS.HEAD_RADIUS;
    const ER = SNAKE_BOSS.EYE_RADIUS;
    const EO = SNAKE_BOSS.EYE_OFFSET;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);

    // Head circle
    ctx.strokeStyle = this.currentHeadColor;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();

    // Eyes (drawn in the forward direction, which is +x in local space)
    ctx.strokeStyle = this.currentHeadColor;
    ctx.lineWidth   = 1.5;
    for (const dy of [-EO / 2, EO / 2]) {
      ctx.beginPath();
      ctx.arc(EO, dy, ER, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
