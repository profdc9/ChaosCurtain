import * as ex from 'excalibur';
import { DART } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { GameEvents } from '../../utils/GameEvents';

// Six line segments defining the dart chevron in local space (rotation = 0, pointing right).
// Points: Nose(16,0), TopWing(-8,-10), BotWing(-8,10), TopInner(0,-5), BotInner(0,5)
const L = DART.HALF_LENGTH;
const W = DART.HALF_WIDTH;
const SEGMENTS: Array<[number, number, number, number]> = [
  [-L / 2, -W,    L,      0   ],  // top wing → nose
  [ L,      0,   -L / 2,  W   ],  // nose → bottom wing
  [-L / 2, -W,    0,     -W / 2], // top wing → top inner
  [-L / 2,  W,    0,      W / 2], // bottom wing → bottom inner
  [ 0,     -W / 2, 0,     W / 2], // spine
  [-L / 2, -W,   -L / 2,  W   ],  // trailing edge
];

export class DartActor extends ex.Actor {
  readonly isEnemy = true;
  readonly enemyName = 'Dart';
  readonly collisionDamage = DART.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly playerRef: ex.Actor;
  private currentColor: string = DART.COLOR;
  private readonly dartCanvas: ex.Canvas;

  constructor(x: number, y: number, player: ex.Actor) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });

    this.playerRef = player;
    this.collider.useCircleCollider(DART.COLLIDER_RADIUS);

    // Start facing the player
    const dx = player.pos.x - x;
    const dy = player.pos.y - y;
    this.rotation = Math.atan2(dy, dx);
    this.vel = ex.vec(Math.cos(this.rotation) * DART.SPEED, Math.sin(this.rotation) * DART.SPEED);

    this.healthComp = new HealthComponent(
      DART.HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.dartCanvas = new ex.Canvas({
      width: DART.CANVAS_SIZE,
      height: DART.CANVAS_SIZE,
      cache: true,
      draw: (ctx) => this.drawDart(ctx),
    });
    this.graphics.use(this.dartCanvas);
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
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

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    const dt = delta / 1000;

    // Steer gradually toward player
    const target = this.playerRef.pos;
    const targetAngle = Math.atan2(target.y - this.pos.y, target.x - this.pos.x);
    let diff = targetAngle - this.rotation;
    // Normalize to [-PI, PI]
    diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

    const maxTurn = DART.TURN_RATE * dt;
    this.rotation += Math.max(-maxTurn, Math.min(maxTurn, diff));
    this.vel = ex.vec(Math.cos(this.rotation) * DART.SPEED, Math.sin(this.rotation) * DART.SPEED);
  }

  private onDamage(healthRatio: number, damage: number): void {
    this.updateColor(healthRatio);
    this.triggerScalePulse(damage);
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  private onDeath(): void {
    GameEvents.emit('enemy:died', { points: DART.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill();
  }

  private updateColor(healthRatio: number): void {
    // Cyan (#00ffff) → red (#ff0000) as health drops
    const r = Math.floor(255 * (1 - healthRatio));
    const g = Math.floor(255 * healthRatio);
    const b = Math.floor(255 * healthRatio);
    this.currentColor = `rgb(${r},${g},${b})`;
    this.dartCanvas.flagDirty();
  }

  private triggerScalePulse(damage: number): void {
    const duration = HealthComponent.getPulseDuration(damage);
    const speed = HealthComponent.getScaleSpeed(duration);
    this.actions.clearActions();
    this.actions.scaleTo(1.3, 1.3, speed, speed).scaleTo(1, 1, speed, speed);
  }

  private spawnFragments(): void {
    const scene = this.scene;
    if (!scene) return;

    for (const [x1, y1, x2, y2] of SEGMENTS) {
      const midLocal = ex.vec((x1 + x2) / 2, (y1 + y2) / 2);
      const worldMid = midLocal.rotate(this.rotation).add(this.pos);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      const fragRotation = this.rotation + Math.atan2(dy, dx);

      const outAngle = Math.atan2(midLocal.y, midLocal.x) + this.rotation;
      const speed = DART.FRAGMENT_SPEED_MIN + Math.random() * (DART.FRAGMENT_SPEED_MAX - DART.FRAGMENT_SPEED_MIN);
      const vel = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel = (Math.random() - 0.5) * 2 * DART.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = DART.FRAGMENT_LIFETIME_MIN + Math.random() * (DART.FRAGMENT_LIFETIME_MAX - DART.FRAGMENT_LIFETIME_MIN);

      scene.add(new FragmentActor(worldMid.x, worldMid.y, fragRotation, vel, angVel, segLen, lifetime));
    }
  }

  private drawDart(ctx: CanvasRenderingContext2D): void {
    const s = DART.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = this.currentColor;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    for (const [x1, y1, x2, y2] of SEGMENTS) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
