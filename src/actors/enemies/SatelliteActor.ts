import * as ex from 'excalibur';
import { SATELLITE } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { GameEvents } from '../../utils/GameEvents';

export class SatelliteActor extends ex.Actor {
  readonly isEnemy = true;
  readonly enemyName = 'Satellite';
  readonly collisionDamage = SATELLITE.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly playerRef: ex.Actor;
  private currentCircleColor: string = SATELLITE.COLOR_CIRCLE;

  private spokeAngle = 0;
  private readonly spinSign: number;         // +1 or -1: clockwise vs counter-clockwise orbit
  private readonly tangentialSpeed: number;  // px/sec, scaled by difficulty

  private readonly satelliteCanvas: ex.Canvas;

  constructor(x: number, y: number, player: ex.Actor, difficulty: number) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });

    this.playerRef = player;
    this.spinSign  = Math.random() < 0.5 ? 1 : -1;
    this.tangentialSpeed =
      SATELLITE.TANGENTIAL_SPEED_MIN +
      difficulty * (SATELLITE.TANGENTIAL_SPEED_MAX - SATELLITE.TANGENTIAL_SPEED_MIN);

    this.collider.useCircleCollider(SATELLITE.COLLIDER_RADIUS);

    this.healthComp = new HealthComponent(
      SATELLITE.HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.satelliteCanvas = new ex.Canvas({
      width:  SATELLITE.CANVAS_SIZE,
      height: SATELLITE.CANVAS_SIZE,
      cache: false,
      draw: (ctx) => this.drawSatellite(ctx),
    });
    this.graphics.use(this.satelliteCanvas);
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

    // Rotate spokes visually
    this.spokeAngle += SATELLITE.SPOKE_ROTATION_SPEED * this.spinSign * dt;

    // Spiral movement: tangential (constant speed) + inward radial (constant speed)
    const toPlayer = this.playerRef.pos.sub(this.pos);
    const dist = toPlayer.size;

    if (dist > 1) {
      const inward  = toPlayer.normalize();
      // Tangential direction: perpendicular to inward, in spinSign direction
      const tangent = ex.vec(-inward.y, inward.x).scale(this.spinSign);
      this.vel = tangent.scale(this.tangentialSpeed).add(inward.scale(SATELLITE.RADIAL_SPEED));
    }

    this.clampToBounds();
  }

  private clampToBounds(): void {
    const { INNER_LEFT, INNER_RIGHT, INNER_TOP, INNER_BOTTOM } =
      { INNER_LEFT: 16, INNER_RIGHT: 1264, INNER_TOP: 76, INNER_BOTTOM: 704 };
    const r = SATELLITE.COLLIDER_RADIUS;
    this.pos = ex.vec(
      Math.max(INNER_LEFT + r,  Math.min(INNER_RIGHT - r,  this.pos.x)),
      Math.max(INNER_TOP  + r,  Math.min(INNER_BOTTOM - r, this.pos.y)),
    );
  }

  private onDamage(healthRatio: number, damage: number): void {
    this.updateColor(healthRatio);
    this.triggerScalePulse(damage);
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  private onDeath(): void {
    GameEvents.emit('enemy:died', { points: SATELLITE.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill();
  }

  private updateColor(healthRatio: number): void {
    // Blue (#4466ff) → red (#ff0000) as health drops
    const t = 1 - healthRatio;
    const r = Math.floor(0x44 + (0xff - 0x44) * t);
    const g = Math.floor(0x66 * healthRatio);
    const b = Math.floor(0xff * healthRatio);
    this.currentCircleColor = `rgb(${r},${g},${b})`;
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

    const R  = SATELLITE.CIRCLE_RADIUS;
    const SL = SATELLITE.SPOKE_LENGTH;

    const spawnFrag = (localPos: ex.Vector, length: number, rotation: number, outAngle: number) => {
      const worldPos = localPos.add(this.pos);
      const speed    = SATELLITE.FRAGMENT_SPEED_MIN + Math.random() * (SATELLITE.FRAGMENT_SPEED_MAX - SATELLITE.FRAGMENT_SPEED_MIN);
      const vel      = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel   = (Math.random() - 0.5) * 2 * SATELLITE.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = SATELLITE.FRAGMENT_LIFETIME_MIN + Math.random() * (SATELLITE.FRAGMENT_LIFETIME_MAX - SATELLITE.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(worldPos.x, worldPos.y, rotation, vel, angVel, length, lifetime));
    };

    // Circle fragment: diameter line at a random angle
    const circleAngle = Math.random() * Math.PI * 2;
    spawnFrag(ex.vec(0, 0), R * 2, circleAngle, circleAngle);

    // Eight half-spoke fragments: for each of 4 spokes, spawn 2 halves flying outward
    for (let i = 0; i < 4; i++) {
      const spokeRot = this.spokeAngle + (i * Math.PI / 4);
      const cos = Math.cos(spokeRot);
      const sin = Math.sin(spokeRot);

      for (const sign of [1, -1] as const) {
        const halfMid = ex.vec(cos * (SL / 2) * sign, sin * (SL / 2) * sign);
        const outAngle = Math.atan2(halfMid.y, halfMid.x);
        spawnFrag(halfMid, SL, spokeRot, outAngle);
      }
    }
  }

  private drawSatellite(ctx: CanvasRenderingContext2D): void {
    const s  = SATELLITE.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;
    const R  = SATELLITE.CIRCLE_RADIUS;
    const SL = SATELLITE.SPOKE_LENGTH;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';

    // Spokes: 4 lines through center at 45° intervals, rotating continuously
    ctx.strokeStyle = SATELLITE.COLOR_SPOKES;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const angle = this.spokeAngle + (i * Math.PI / 4);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(-cos * SL, -sin * SL);
      ctx.lineTo( cos * SL,  sin * SL);
      ctx.stroke();
    }

    // Circle outline drawn on top of spokes
    ctx.strokeStyle = this.currentCircleColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
