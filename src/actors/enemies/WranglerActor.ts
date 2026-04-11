import * as ex from 'excalibur';
import { WRANGLER } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { GameEvents } from '../../utils/GameEvents';

// Satellite offsets from body center (local space)
const SAT_OFFSETS: ex.Vector[] = [
  ex.vec(0,              -WRANGLER.SATELLITE_DIST),
  ex.vec(WRANGLER.SATELLITE_DIST,  0),
  ex.vec(0,               WRANGLER.SATELLITE_DIST),
  ex.vec(-WRANGLER.SATELLITE_DIST, 0),
];

export class WranglerActor extends ex.Actor {
  readonly isEnemy = true;
  readonly enemyName = 'Wrangler';
  readonly collisionDamage = WRANGLER.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly playerRef: ex.Actor;
  private currentBodyColor: string = WRANGLER.COLOR_BODY;
  private currentSatColor:  string = WRANGLER.COLOR_SATELLITES;

  private state: 'wander' | 'approach' = 'wander';
  private isTethered = false;
  private directionTimer = 0;
  private directionInterval: number;
  private readonly wranglerCanvas: ex.Canvas;

  constructor(x: number, y: number, player: ex.Actor) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });

    this.playerRef = player;
    this.collider.useCircleCollider(WRANGLER.COLLIDER_RADIUS);

    this.directionInterval = WranglerActor.randomInterval();
    this.pickNewWanderDir();

    this.healthComp = new HealthComponent(
      WRANGLER.HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.wranglerCanvas = new ex.Canvas({
      width:  WRANGLER.CANVAS_SIZE,
      height: WRANGLER.CANVAS_SIZE,
      cache: true,
      draw: (ctx) => this.drawWrangler(ctx),
    });
    this.graphics.use(this.wranglerCanvas);

    // Draw tether line in actor-local space (onPostDraw is called after _applyTransform,
    // so (0,0) = this actor's world position and player offset maps correctly).
    this.graphics.onPostDraw = (ctx, _elapsed) => {
      if (!this.isTethered) return;
      const rel = this.playerRef.pos.sub(this.pos);
      ctx.drawLine(ex.vec(0, 0), rel, ex.Color.fromHex(WRANGLER.COLOR_TETHER), 1.5);
    };
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
    const dist = this.pos.distance(this.playerRef.pos);

    // State transition: start approaching once player enters detection radius
    if (this.state === 'wander' && dist <= WRANGLER.DETECTION_RADIUS) {
      this.state = 'approach';
    }

    // Movement
    if (this.state === 'wander') {
      this.directionTimer += dt;
      if (this.directionTimer >= this.directionInterval) {
        this.pickNewWanderDir();
        this.directionTimer = 0;
        this.directionInterval = WranglerActor.randomInterval();
      }
    } else {
      // Approach: steer toward player
      const toPlayer = this.playerRef.pos.sub(this.pos);
      if (toPlayer.size > 0) {
        this.vel = toPlayer.normalize().scale(WRANGLER.APPROACH_SPEED);
      }
    }

    // Tether: activates once in range, persists until death
    if (!this.isTethered && dist <= WRANGLER.TETHER_RANGE) {
      this.isTethered = true;
      GameEvents.emit('wrangler:tether', { active: true });
    }

    // Register pull on player each frame while tethered (must clear when too close — stale
    // vectors read like gamepad drift / jitter from sub-pixel direction flips).
    if (this.isTethered) {
      const toWrangler = this.pos.sub(this.playerRef.pos);
      const reg = (this.playerRef as ex.Actor & { pullRegistry: Map<object, ex.Vector> }).pullRegistry;
      if (toWrangler.size < WRANGLER.TETHER_PULL_MIN_DIST) {
        reg.delete(this);
      } else {
        const pull = toWrangler.normalize().scale(WRANGLER.PULL_FORCE);
        reg.set(this, pull);
      }
    }

    this.clampToBounds();
  }

  private pickNewWanderDir(): void {
    const angle = Math.random() * Math.PI * 2;
    this.vel = ex.vec(Math.cos(angle) * WRANGLER.WANDER_SPEED, Math.sin(angle) * WRANGLER.WANDER_SPEED);
  }

  private clampToBounds(): void {
    const { INNER_LEFT, INNER_RIGHT, INNER_TOP, INNER_BOTTOM } =
      { INNER_LEFT: 16, INNER_RIGHT: 1264, INNER_TOP: 76, INNER_BOTTOM: 704 };
    const r = WRANGLER.COLLIDER_RADIUS;

    if (this.pos.x < INNER_LEFT + r)  { this.pos = ex.vec(INNER_LEFT + r,  this.pos.y); this.vel = ex.vec( Math.abs(this.vel.x), this.vel.y); }
    if (this.pos.x > INNER_RIGHT - r) { this.pos = ex.vec(INNER_RIGHT - r, this.pos.y); this.vel = ex.vec(-Math.abs(this.vel.x), this.vel.y); }
    if (this.pos.y < INNER_TOP + r)   { this.pos = ex.vec(this.pos.x, INNER_TOP + r);   this.vel = ex.vec(this.vel.x,  Math.abs(this.vel.y)); }
    if (this.pos.y > INNER_BOTTOM - r){ this.pos = ex.vec(this.pos.x, INNER_BOTTOM - r);this.vel = ex.vec(this.vel.x, -Math.abs(this.vel.y)); }
  }

  private onDamage(healthRatio: number, damage: number): void {
    this.updateColors(healthRatio);
    this.triggerScalePulse(damage);
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  /**
   * Excalibur does not call `onKill` — use {@link onPreKill}. Runs for health death, room unload, any `kill()`.
   */
  onPreKill(_scene: ex.Scene): void {
    (this.playerRef as ex.Actor & { pullRegistry?: Map<object, ex.Vector> })
      .pullRegistry?.delete(this);
    this.deactivateTether();
  }

  private deactivateTether(): void {
    if (this.isTethered) {
      this.isTethered = false;
      GameEvents.emit('wrangler:tether', { active: false });
    }
  }

  private onDeath(): void {
    this.deactivateTether();
    GameEvents.emit('enemy:died', { points: WRANGLER.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill(); // → onPreKill: registry + tether-off if still tethered
  }

  private updateColors(healthRatio: number): void {
    const t = 1 - healthRatio;
    // Body: green (#00ff00) → red (#ff0000)
    const br = Math.floor(255 * t);
    const bg = Math.floor(255 * healthRatio);
    this.currentBodyColor = `rgb(${br},${bg},0)`;
    // Satellites: yellow (#ffff00) → red (#ff0000)
    const sg = Math.floor(255 * healthRatio);
    this.currentSatColor = `rgb(255,${sg},0)`;
    this.wranglerCanvas.flagDirty();
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

    const R  = WRANGLER.BODY_RADIUS;
    const SR = WRANGLER.SATELLITE_RADIUS;
    const SD = WRANGLER.SATELLITE_DIST;

    const spawnFrag = (localPos: ex.Vector, length: number, rotation: number, outAngle: number) => {
      const worldPos = localPos.add(this.pos);
      const speed    = WRANGLER.FRAGMENT_SPEED_MIN + Math.random() * (WRANGLER.FRAGMENT_SPEED_MAX - WRANGLER.FRAGMENT_SPEED_MIN);
      const vel      = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel   = (Math.random() - 0.5) * 2 * WRANGLER.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = WRANGLER.FRAGMENT_LIFETIME_MIN + Math.random() * (WRANGLER.FRAGMENT_LIFETIME_MAX - WRANGLER.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(worldPos.x, worldPos.y, rotation, vel, angVel, length, lifetime));
    };

    // Central circle: random outward direction
    const centerAngle = Math.random() * Math.PI * 2;
    spawnFrag(ex.vec(0, 0), R * 2, centerAngle, centerAngle);

    // Four satellites + their connector segments
    for (const satOff of SAT_OFFSETS) {
      const outAngle = Math.atan2(satOff.y, satOff.x);

      // Satellite circle
      spawnFrag(satOff, SR * 2, outAngle, outAngle);

      // Connector segment (from body edge to satellite inner edge)
      const connLen = SD - SR - R;
      const connMid = satOff.normalize().scale((R + SD - SR) / 2);
      spawnFrag(connMid, connLen, outAngle, outAngle);
    }
  }

  private drawWrangler(ctx: CanvasRenderingContext2D): void {
    const s  = WRANGLER.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;
    const R  = WRANGLER.BODY_RADIUS;
    const SR = WRANGLER.SATELLITE_RADIUS;
    const SD = WRANGLER.SATELLITE_DIST;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';

    // Connector segments (body edge → satellite inner edge)
    ctx.strokeStyle = this.currentBodyColor;
    ctx.lineWidth = 2;
    for (const off of SAT_OFFSETS) {
      const dx = off.x === 0 ? 0 : Math.sign(off.x);
      const dy = off.y === 0 ? 0 : Math.sign(off.y);
      ctx.beginPath();
      ctx.moveTo(dx * R, dy * R);
      ctx.lineTo(dx * (SD - SR), dy * (SD - SR));
      ctx.stroke();
    }

    // Central circle
    ctx.strokeStyle = this.currentBodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();

    // Satellite circles
    ctx.strokeStyle = this.currentSatColor;
    for (const off of SAT_OFFSETS) {
      ctx.beginPath();
      ctx.arc(off.x, off.y, SR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private static randomInterval(): number {
    return WRANGLER.DIRECTION_CHANGE_MIN +
      Math.random() * (WRANGLER.DIRECTION_CHANGE_MAX - WRANGLER.DIRECTION_CHANGE_MIN);
  }
}
