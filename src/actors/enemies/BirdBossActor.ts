import * as ex from 'excalibur';
import { BIRD_BOSS, ROOM } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { GameEvents } from '../../utils/GameEvents';

type BirdState = 'flit' | 'charge' | 'retreat';

const INNER = {
  L: ROOM.INNER_LEFT  + 60,
  R: ROOM.INNER_RIGHT - 60,
  T: ROOM.INNER_TOP   + 60,
  B: ROOM.INNER_BOTTOM- 60,
};

export class BirdBossActor extends ex.Actor {
  readonly isEnemy       = true;
  readonly enemyName     = 'Bird';
  readonly ignoresPlayerRam = true; // player ram does not damage the bird
  readonly collisionDamage  = BIRD_BOSS.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly playerRef: ex.Actor;

  private state: BirdState = 'flit';
  private stateTimer   = 0;
  private flitTarget   = ex.vec(0, 0);
  private chargeTarget = ex.vec(0, 0);
  private retreatDir   = ex.vec(-1, 0);
  private flitDuration = 0;
  private flapPhase    = 0;
  private flapSpeed: number = BIRD_BOSS.FLAP_SPEED_FLIT;

  private readonly birdCanvas: ex.Canvas;

  constructor(x: number, y: number, player: ex.Actor) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });
    this.playerRef = player;
    this.collider.useCircleCollider(BIRD_BOSS.COLLIDER_RADIUS);

    this.healthComp = new HealthComponent(
      BIRD_BOSS.HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.birdCanvas = new ex.Canvas({
      width:  BIRD_BOSS.CANVAS_SIZE,
      height: BIRD_BOSS.CANVAS_SIZE,
      cache: false,
      draw: (ctx) => this.drawBird(ctx),
    });
    this.graphics.use(this.birdCanvas);

    this.pickFlitTarget();
    this.flitDuration = this.randomFlitDuration();
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
      const other = evt.other as ex.Actor & { isBullet?: boolean; damage?: number; isPlayer?: boolean };
      if (other.isBullet) {
        this.healthComp.takeDamage(other.damage ?? 0);
        other.kill();
      } else if (other.isPlayer && this.state !== 'retreat') {
        // Player collision: deal damage (already done by player's own handler via collisionDamage),
        // then immediately retreat
        this.enterRetreat();
      }
    });
  }

  takeDamage(amount: number): void {
    this.healthComp.takeDamage(amount);
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    const dt = delta / 1000;
    this.flapPhase += this.flapSpeed * dt;
    this.stateTimer += dt;

    switch (this.state) {
      case 'flit':   this.updateFlit(dt); break;
      case 'charge': this.updateCharge(dt); break;
      case 'retreat':this.updateRetreat(dt); break;
    }

    // Clamp to room
    this.pos = ex.vec(
      Math.max(INNER.L, Math.min(INNER.R, this.pos.x)),
      Math.max(INNER.T, Math.min(INNER.B, this.pos.y)),
    );
  }

  private updateFlit(dt: number): void {
    // Steer toward flit target
    const toTarget = this.flitTarget.sub(this.pos);
    const dist = toTarget.size;

    if (dist < 40) {
      this.pickFlitTarget();
    }

    if (dist > 1) {
      const targetAngle = Math.atan2(toTarget.y, toTarget.x);
      this.smoothRotate(targetAngle, dt, 4.0);
      this.vel = ex.vec(Math.cos(this.rotation), Math.sin(this.rotation)).scale(BIRD_BOSS.FLIT_SPEED);
    }

    // After flit duration, charge
    if (this.stateTimer >= this.flitDuration) {
      this.enterCharge();
    }
  }

  private updateCharge(_dt: number): void {
    const toTarget = this.chargeTarget.sub(this.pos);
    const dist = toTarget.size;

    if (dist < 50 || this.stateTimer > 2.0) {
      this.enterFlit();
      return;
    }

    if (dist > 1) {
      const dir = toTarget.normalize();
      this.rotation = Math.atan2(dir.y, dir.x);
      this.vel = dir.scale(BIRD_BOSS.CHARGE_SPEED);
    }
  }

  private updateRetreat(dt: number): void {
    this.vel = this.retreatDir.scale(BIRD_BOSS.RETREAT_SPEED);
    const targetAngle = Math.atan2(-this.retreatDir.y, -this.retreatDir.x);
    this.smoothRotate(targetAngle, dt, 3.0);

    if (this.stateTimer >= BIRD_BOSS.RETREAT_DURATION) {
      this.enterFlit();
    }
  }

  private enterFlit(): void {
    this.state = 'flit';
    this.stateTimer = 0;
    this.flapSpeed = BIRD_BOSS.FLAP_SPEED_FLIT;
    this.flitDuration = this.randomFlitDuration();
    this.pickFlitTarget();
  }

  private enterCharge(): void {
    this.state = 'charge';
    this.stateTimer = 0;
    this.flapSpeed = BIRD_BOSS.FLAP_SPEED_CHARGE;
    this.chargeTarget = this.playerRef.pos.clone();
    const dir = this.chargeTarget.sub(this.pos).normalize();
    this.retreatDir = dir.negate();
  }

  private enterRetreat(): void {
    if (this.state === 'charge') {
      // retreatDir already set when charge started
    } else {
      this.retreatDir = ex.vec(Math.cos(this.rotation + Math.PI), Math.sin(this.rotation + Math.PI));
    }
    this.state = 'retreat';
    this.stateTimer = 0;
    this.flapSpeed = BIRD_BOSS.FLAP_SPEED_RETREAT;
  }

  private smoothRotate(targetAngle: number, dt: number, speed: number): void {
    let diff = targetAngle - this.rotation;
    diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.rotation += Math.max(-speed * dt, Math.min(speed * dt, diff));
  }

  private pickFlitTarget(): void {
    this.flitTarget = ex.vec(
      INNER.L + Math.random() * (INNER.R - INNER.L),
      INNER.T + Math.random() * (INNER.B - INNER.T),
    );
  }

  private randomFlitDuration(): number {
    return BIRD_BOSS.FLIT_DURATION_MIN +
      Math.random() * (BIRD_BOSS.FLIT_DURATION_MAX - BIRD_BOSS.FLIT_DURATION_MIN);
  }

  private onDamage(_healthRatio: number, damage: number): void {
    this.triggerScalePulse(damage);
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  private onDeath(): void {
    GameEvents.emit('enemy:died', { points: BIRD_BOSS.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill();
  }

  private triggerScalePulse(damage: number): void {
    const duration = HealthComponent.getPulseDuration(damage);
    const speed    = HealthComponent.getScaleSpeed(duration);
    this.actions.clearActions();
    this.actions.scaleTo(1.3, 1.3, speed, speed).scaleTo(1, 1, speed, speed);
  }

  private get flapY(): number {
    return BIRD_BOSS.FLAP_BASE + BIRD_BOSS.FLAP_AMPLITUDE * (0.5 + 0.5 * Math.sin(this.flapPhase));
  }

  private spawnFragments(): void {
    const scene = this.scene;
    if (!scene) return;

    const flapY = this.flapY;
    const tx = -10; // tail x
    const innerX = 2;
    const innerY = flapY * 0.55;
    const headX = 18;
    const outerX = -18;

    const segs: Array<[number, number, number, number]> = [
      [tx, 0, outerX, -flapY],        // left outer wing
      [tx, 0, innerX, -innerY],       // left inner wing
      [tx, 0, outerX,  flapY],        // right outer wing
      [tx, 0, innerX,  innerY],       // right inner wing
      [innerX, -innerY, headX, 0],    // head left
      [innerX,  innerY, headX, 0],    // head right
    ];

    for (const [x1, y1, x2, y2] of segs) {
      const localMid = ex.vec((x1 + x2) / 2, (y1 + y2) / 2);
      const worldMid = localMid.rotate(this.rotation).add(this.pos);
      const segLen   = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const fragRot  = this.rotation + Math.atan2(y2 - y1, x2 - x1);
      const outAngle = Math.atan2(localMid.y, localMid.x) + this.rotation;
      const speed    = BIRD_BOSS.FRAGMENT_SPEED_MIN + Math.random() * (BIRD_BOSS.FRAGMENT_SPEED_MAX - BIRD_BOSS.FRAGMENT_SPEED_MIN);
      const vel      = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel   = (Math.random() - 0.5) * 2 * BIRD_BOSS.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = BIRD_BOSS.FRAGMENT_LIFETIME_MIN + Math.random() * (BIRD_BOSS.FRAGMENT_LIFETIME_MAX - BIRD_BOSS.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(worldMid.x, worldMid.y, fragRot, vel, angVel, segLen, lifetime));
    }

    // Eye fragments (draw as short lines)
    for (const [ex_, ey] of [[12, -3], [12, 3]] as const) {
      const localEye = ex.vec(ex_, ey);
      const worldEye = localEye.rotate(this.rotation).add(this.pos);
      const outAngle = Math.atan2(localEye.y, localEye.x) + this.rotation;
      const speed    = BIRD_BOSS.FRAGMENT_SPEED_MIN + Math.random() * (BIRD_BOSS.FRAGMENT_SPEED_MAX - BIRD_BOSS.FRAGMENT_SPEED_MIN);
      const vel      = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel   = (Math.random() - 0.5) * 2 * BIRD_BOSS.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = BIRD_BOSS.FRAGMENT_LIFETIME_MIN + Math.random() * (BIRD_BOSS.FRAGMENT_LIFETIME_MAX - BIRD_BOSS.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(worldEye.x, worldEye.y, Math.random() * Math.PI, vel, angVel, 6, lifetime));
    }
  }

  private drawBird(ctx: CanvasRenderingContext2D): void {
    const s  = BIRD_BOSS.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;

    const flapY  = this.flapY;
    const tx     = -10;
    const innerX = 2;
    const innerY = flapY * 0.55;
    const headX  = 18;
    const outerX = -18;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = BIRD_BOSS.COLOR_WINGS;
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';

    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    // Wing segments (all yellow)
    line(tx, 0, outerX, -flapY);       // left outer wing
    line(tx, 0, innerX, -innerY);      // left inner wing
    line(tx, 0, outerX,  flapY);       // right outer wing
    line(tx, 0, innerX,  innerY);      // right inner wing
    line(innerX, -innerY, headX, 0);   // head left arm
    line(innerX,  innerY, headX, 0);   // head right arm

    // Eyes (light blue circles)
    ctx.strokeStyle = BIRD_BOSS.COLOR_EYES;
    ctx.lineWidth = 1.5;
    for (const [ex_, ey] of [[12, -3], [12, 3]] as const) {
      ctx.beginPath();
      ctx.arc(ex_, ey, 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
