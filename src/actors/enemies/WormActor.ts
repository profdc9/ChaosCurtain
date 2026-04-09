import * as ex from 'excalibur';
import { WORM } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { GameEvents } from '../../utils/GameEvents';

export class WormActor extends ex.Actor {
  readonly isEnemy = true;
  readonly enemyName = 'Worm';
  readonly collisionDamage = WORM.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly playerRef: ex.Actor;
  private readonly splitsLeft: number;
  private readonly registerEnemy: (actor: ex.Actor) => void;

  private dead = false;
  private hasBeenHit = false;
  private phase: number;
  private readonly wormCanvas: ex.Canvas;

  constructor(
    x: number,
    y: number,
    player: ex.Actor,
    health: number,
    splitsLeft: number,
    registerEnemy: (actor: ex.Actor) => void,
  ) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });

    this.playerRef   = player;
    this.splitsLeft  = splitsLeft;
    this.registerEnemy = registerEnemy;
    this.phase       = Math.random() * Math.PI * 2; // stagger oscillations across worms

    this.collider.useCircleCollider(WORM.COLLIDER_RADIUS);

    // Random initial direction; steering will pull it toward the player each frame
    const angle = Math.random() * Math.PI * 2;
    this.vel      = ex.vec(Math.cos(angle) * WORM.SPEED, Math.sin(angle) * WORM.SPEED);
    this.rotation = angle;

    this.healthComp = new HealthComponent(
      health,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.wormCanvas = new ex.Canvas({
      width:  WORM.CANVAS_SIZE,
      height: WORM.CANVAS_SIZE,
      cache: false,
      draw: (ctx) => this.drawWorm(ctx),
    });
    this.graphics.use(this.wormCanvas);
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
      if (this.dead) return;
      const other = evt.other as ex.Actor & { isBullet?: boolean; damage?: number };
      if (other.isBullet) {
        other.kill();
        if (!this.hasBeenHit && this.splitsLeft > 0) {
          this.hasBeenHit = true;
          this.doSplit();
        } else {
          this.healthComp.takeDamage(other.damage ?? 0);
        }
      }
    });
  }

  takeDamage(amount: number): void {
    if (this.dead) return;
    if (!this.hasBeenHit && this.splitsLeft > 0) {
      this.hasBeenHit = true;
      this.doSplit();
    } else {
      this.healthComp.takeDamage(amount);
    }
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    if (this.dead) return;
    const dt = delta / 1000;

    // Advance oscillation phase for inchworm animation
    this.phase += WORM.OSCILLATION_SPEED * dt;

    // Gradually steer toward player (same pattern as DartActor)
    const toPlayer = this.playerRef.pos.sub(this.pos);
    const targetAngle = Math.atan2(toPlayer.y, toPlayer.x);
    let diff = targetAngle - this.rotation;
    diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const maxTurn = WORM.TURN_RATE * dt;
    this.rotation += Math.max(-maxTurn, Math.min(maxTurn, diff));
    this.vel = ex.vec(Math.cos(this.rotation) * WORM.SPEED, Math.sin(this.rotation) * WORM.SPEED);

    this.clampToBounds();
  }

  private get separation(): number {
    return WORM.MIN_SEP + (WORM.MAX_SEP - WORM.MIN_SEP) * (0.5 + 0.5 * Math.sin(this.phase));
  }

  private doSplit(): void {
    if (this.dead) return;
    this.dead = true;
    const scene = this.scene;
    if (!scene) return;

    const offspringHealth   = this.healthComp.currentHp / 2;
    const offspringSplits   = this.splitsLeft - 1;

    // Perpendicular to current movement direction; random fallback if nearly stopped
    let perp: ex.Vector;
    if (this.vel.size > 1) {
      perp = ex.vec(-this.vel.y, this.vel.x).normalize();
    } else {
      const a = Math.random() * Math.PI * 2;
      perp = ex.vec(Math.cos(a), Math.sin(a));
    }

    for (const sign of [1, -1] as const) {
      const w = new WormActor(
        this.pos.x, this.pos.y,
        this.playerRef, offspringHealth, offspringSplits, this.registerEnemy,
      );
      w.vel      = perp.scale(sign * WORM.SPEED);
      w.rotation = Math.atan2(w.vel.y, w.vel.x);
      this.registerEnemy(w);
    }

    // Emit with 0 points: decrements liveCount for parent without awarding score
    GameEvents.emit('enemy:died', { points: 0, x: this.pos.x, y: this.pos.y });
    this.kill();
  }

  private clampToBounds(): void {
    const { INNER_LEFT, INNER_RIGHT, INNER_TOP, INNER_BOTTOM } =
      { INNER_LEFT: 16, INNER_RIGHT: 1264, INNER_TOP: 76, INNER_BOTTOM: 704 };
    const r = WORM.COLLIDER_RADIUS;

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
    GameEvents.emit('enemy:died', { points: WORM.POINT_VALUE, x: this.pos.x, y: this.pos.y });
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

    const sep  = this.separation;
    const half = sep / 2;
    const cos  = Math.cos(this.rotation);
    const sin  = Math.sin(this.rotation);

    const spawnFrag = (localPos: ex.Vector, length: number, rotation: number, outAngle: number) => {
      const worldPos = localPos.add(this.pos);
      const speed    = WORM.FRAGMENT_SPEED_MIN + Math.random() * (WORM.FRAGMENT_SPEED_MAX - WORM.FRAGMENT_SPEED_MIN);
      const vel      = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel   = (Math.random() - 0.5) * 2 * WORM.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = WORM.FRAGMENT_LIFETIME_MIN + Math.random() * (WORM.FRAGMENT_LIFETIME_MAX - WORM.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(worldPos.x, worldPos.y, rotation, vel, angVel, length, lifetime));
    };

    // Head circle — flies forward
    spawnFrag(ex.vec(cos * half, sin * half), WORM.CIRCLE_RADIUS * 2, this.rotation, this.rotation);
    // Tail circle — flies backward
    const backAngle = this.rotation + Math.PI;
    spawnFrag(ex.vec(-cos * half, -sin * half), WORM.CIRCLE_RADIUS * 2, backAngle, backAngle);
    // Connecting line — flies perpendicular
    spawnFrag(ex.vec(0, 0), sep, this.rotation, this.rotation + Math.PI / 2);
  }

  private drawWorm(ctx: CanvasRenderingContext2D): void {
    const s   = WORM.CANVAS_SIZE;
    const cx  = s / 2;
    const cy  = s / 2;
    const sep = this.separation;
    const half = sep / 2;
    const R   = WORM.CIRCLE_RADIUS;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 2;
    ctx.lineCap   = 'round';

    // Yellow connecting line drawn first (behind circles)
    ctx.strokeStyle = WORM.COLOR_LINE;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo( half, 0);
    ctx.stroke();

    // Brown circles drawn on top of the line
    ctx.strokeStyle = WORM.COLOR_CIRCLES;
    for (const x of [-half, half]) {
      ctx.beginPath();
      ctx.arc(x, 0, R, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
