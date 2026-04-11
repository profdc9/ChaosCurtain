import * as ex from 'excalibur';
import { GLITCH_BOSS, ROOM } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { GameEvents } from '../../utils/GameEvents';

// Arrow colors — never red (reserved for damage)
const ARROW_COLORS = ['#00ff00', '#4444ff', '#888888', '#ffffff'];

const INNER = {
  L: ROOM.INNER_LEFT  + 30,
  R: ROOM.INNER_RIGHT - 30,
  T: ROOM.INNER_TOP   + 30,
  B: ROOM.INNER_BOTTOM- 30,
};

type PlayerRef = ex.Actor & {
  glitchRegistry?: Map<object, ex.Vector>;
  sharedState?: { applyDamage: (n: number) => void };
};

export class GlitchBossActor extends ex.Actor {
  readonly isEnemy       = true;
  readonly enemyName     = 'GlitchBoss';
  readonly collisionDamage = GLITCH_BOSS.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly playerRef: ex.Actor;

  private arrowAngle = 0;
  private colorPhase = 0;
  private isGlitching   = false;

  private readonly glitchCanvas: ex.Canvas;

  constructor(x: number, y: number, player: ex.Actor) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });

    this.playerRef = player;

    this.collider.useCircleCollider(GLITCH_BOSS.COLLIDER_RADIUS);

    this.healthComp = new HealthComponent(
      GLITCH_BOSS.HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.glitchCanvas = new ex.Canvas({
      width:  GLITCH_BOSS.CANVAS_SIZE,
      height: GLITCH_BOSS.CANVAS_SIZE,
      cache: false,
      draw: (ctx) => this.drawGlitch(ctx),
    });
    this.graphics.use(this.glitchCanvas);
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
      const other = evt.other as ex.Actor & { isBullet?: boolean; damage?: number };
      if (other.isBullet) {
        // Damage scales with player proximity — closer shots deal more damage
        const dist  = this.playerRef.pos.distance(this.pos);
        const scale = GLITCH_BOSS.DAMAGE_MIN_SCALE +
          (1 - GLITCH_BOSS.DAMAGE_MIN_SCALE) *
          Math.max(0, 1 - dist / GLITCH_BOSS.DAMAGE_MAX_DIST);
        this.healthComp.takeDamage((other.damage ?? 0) * scale);
        other.kill();
      }
    });
  }

  takeDamage(amount: number): void {
    this.healthComp.takeDamage(amount);
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    const dt = delta / 1000;

    // Arrow slowly tracks the bearing to the closest player (shortest rotation).
    const target = this.closestPlayerPos();
    const targetAngle = Math.atan2(target.y - this.pos.y, target.x - this.pos.x);
    let turn = targetAngle - this.arrowAngle;
    turn = ((turn + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const maxStep = GLITCH_BOSS.ARROW_TRACKING_TURN_RATE * dt;
    this.arrowAngle += Math.sign(turn) * Math.min(Math.abs(turn), maxStep);

    // Cycle arrow color
    this.colorPhase += GLITCH_BOSS.COLOR_CYCLE_SPEED * dt;

    // Retreat: move away from player, with wall avoidance to prevent cornering
    const toPlayer = this.playerRef.pos.sub(this.pos);
    const dist      = toPlayer.size;

    // Base flee direction: directly away from player
    let moveDir = dist > 1 ? toPlayer.normalize().scale(-1) : ex.Vector.Zero;

    // Wall repulsion: push away from nearby walls
    const WD = GLITCH_BOSS.WALL_AVOIDANCE_DIST;
    const WW = GLITCH_BOSS.WALL_AVOIDANCE_WEIGHT;
    let wallForce = ex.Vector.Zero;
    const dL = this.pos.x - INNER.L;
    const dR = INNER.R - this.pos.x;
    const dT = this.pos.y - INNER.T;
    const dB = INNER.B - this.pos.y;
    if (dL < WD) wallForce = wallForce.add(ex.vec( 1,  0).scale(1 - dL / WD));
    if (dR < WD) wallForce = wallForce.add(ex.vec(-1,  0).scale(1 - dR / WD));
    if (dT < WD) wallForce = wallForce.add(ex.vec( 0,  1).scale(1 - dT / WD));
    if (dB < WD) wallForce = wallForce.add(ex.vec( 0, -1).scale(1 - dB / WD));

    moveDir = moveDir.add(wallForce.scale(WW));
    this.vel = moveDir.size > 0.01
      ? moveDir.normalize().scale(GLITCH_BOSS.RETREAT_SPEED)
      : ex.Vector.Zero;

    // Clamp to room
    this.pos = ex.vec(
      Math.max(INNER.L, Math.min(INNER.R, this.pos.x)),
      Math.max(INNER.T, Math.min(INNER.B, this.pos.y)),
    );

    // Evaluate cone and update glitch registry
    this.updateGlitch(dist);
  }

  private updateGlitch(distToPlayer: number): void {
    const player = this.playerRef as PlayerRef;
    if (!player.glitchRegistry) return;

    if (distToPlayer < 1) {
      player.glitchRegistry.delete(this);
      this.isGlitching = false;
      return;
    }

    // Cone half-angle widens as player gets closer
    const t = Math.max(0, 1 - distToPlayer / GLITCH_BOSS.CONE_MAX_DIST);
    const halfAngle = GLITCH_BOSS.CONE_BASE_HALF +
      (GLITCH_BOSS.CONE_MAX_HALF - GLITCH_BOSS.CONE_BASE_HALF) * t;

    // Angle from boss to player
    const toPlayer  = this.playerRef.pos.sub(this.pos);
    const angleToPlayer = Math.atan2(toPlayer.y, toPlayer.x);
    let diff = angleToPlayer - this.arrowAngle;
    diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI; // normalize to [-π, π]

    const inCone = Math.abs(diff) <= halfAngle;
    this.isGlitching = inCone;

    if (inCone) {
      // Register approach-block direction (unit vector from player toward boss)
      const towardBoss = this.pos.sub(this.playerRef.pos).normalize();
      player.glitchRegistry.set(this, towardBoss);
    } else {
      player.glitchRegistry.delete(this);
    }
  }

  private onDamage(_healthRatio: number, damage: number): void {
    this.triggerScalePulse(damage);
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  private onDeath(): void {
    // Clean up glitch registry
    (this.playerRef as PlayerRef).glitchRegistry?.delete(this);
    GameEvents.emit('enemy:died', { points: GLITCH_BOSS.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill();
  }

  private triggerScalePulse(damage: number): void {
    const duration = HealthComponent.getPulseDuration(damage);
    const speed    = HealthComponent.getScaleSpeed(duration);
    this.actions.clearActions();
    this.actions.scaleTo(1.3, 1.3, speed, speed).scaleTo(1, 1, speed, speed);
  }

  private closestPlayerPos(): ex.Vector {
    const scene = this.scene;
    if (!scene) return this.playerRef.pos;
    let best = this.playerRef.pos;
    let bestD = Infinity;
    for (const child of scene.actors) {
      const a = child as ex.Actor & { isPlayer?: boolean };
      if (!a.isPlayer) continue;
      const d = a.pos.distance(this.pos);
      if (d < bestD) {
        bestD = d;
        best = a.pos;
      }
    }
    return best;
  }

  private spawnFragments(): void {
    const scene = this.scene;
    if (!scene) return;

    const BH = GLITCH_BOSS.BOX_HALF;
    const AL = GLITCH_BOSS.ARROW_LENGTH;

    const spawnFrag = (localPos: ex.Vector, length: number, rotation: number, outAngle: number) => {
      const worldPos = localPos.add(this.pos);
      const speed    = GLITCH_BOSS.FRAGMENT_SPEED_MIN + Math.random() * (GLITCH_BOSS.FRAGMENT_SPEED_MAX - GLITCH_BOSS.FRAGMENT_SPEED_MIN);
      const vel      = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel   = (Math.random() - 0.5) * 2 * GLITCH_BOSS.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = GLITCH_BOSS.FRAGMENT_LIFETIME_MIN + Math.random() * (GLITCH_BOSS.FRAGMENT_LIFETIME_MAX - GLITCH_BOSS.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(worldPos.x, worldPos.y, rotation, vel, angVel, length, lifetime));
    };

    // Box: 4 sides
    const boxCorners = [[-BH,-BH],[BH,-BH],[BH,BH],[-BH,BH]];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = boxCorners[i];
      const [bx, by] = boxCorners[(i + 1) % 4];
      const mid = ex.vec((ax + bx) / 2, (ay + by) / 2);
      const len = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
      spawnFrag(mid, len, Math.atan2(by - ay, bx - ax), Math.atan2(mid.y, mid.x));
    }

    // Arrow shaft
    const cos = Math.cos(this.arrowAngle);
    const sin = Math.sin(this.arrowAngle);
    const shaftMid = ex.vec(cos * AL * 0.3, sin * AL * 0.3);
    spawnFrag(shaftMid, AL * 1.4, this.arrowAngle, this.arrowAngle);

    // Arrow head wings
    for (const ang of [this.arrowAngle + 2.4, this.arrowAngle - 2.4]) {
      const tip = ex.vec(cos * AL, sin * AL);
      spawnFrag(tip, 8, ang, Math.atan2(tip.y, tip.x));
    }
  }

  private drawGlitch(ctx: CanvasRenderingContext2D): void {
    const s  = GLITCH_BOSS.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;
    const BH = GLITCH_BOSS.BOX_HALF;
    const AL = GLITCH_BOSS.ARROW_LENGTH;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';

    // Box outline — white, shifts red on damage (no, let healthComp handle scale; box stays white)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.strokeRect(-BH, -BH, BH * 2, BH * 2);

    // Arrow — color cycles, pulses white when actively glitching
    const colorIdx   = Math.floor(this.colorPhase % 4);
    ctx.strokeStyle  = this.isGlitching ? '#ffffff' : ARROW_COLORS[colorIdx];
    ctx.lineWidth    = this.isGlitching ? 2.5 : 1.5;

    ctx.save();
    ctx.rotate(this.arrowAngle);

    // Shaft
    ctx.beginPath();
    ctx.moveTo(-AL * 0.4, 0);
    ctx.lineTo(AL, 0);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath(); ctx.moveTo(AL, 0); ctx.lineTo(AL - 6, -5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(AL, 0); ctx.lineTo(AL - 6,  5); ctx.stroke();

    ctx.restore();
    ctx.restore();
  }
}
