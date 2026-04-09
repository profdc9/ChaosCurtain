import * as ex from 'excalibur';
import { SNAKE_BOSS } from '../../constants';
import { HealthComponent } from '../../components/HealthComponent';
import { FragmentActor } from '../FragmentActor';
import { GameEvents } from '../../utils/GameEvents';

export class SnakeSegmentActor extends ex.Actor {
  readonly isEnemy       = true;
  readonly enemyName     = 'SnakeSegment';
  readonly ignoresPlayerRam = true;
  readonly collisionDamage  = 0; // head handles all collision damage

  readonly healthComp: HealthComponent;
  private currentColor: string = SNAKE_BOSS.COLOR_BODY;
  private readonly segCanvas: ex.Canvas;
  private readonly onSegmentDied: (segment: SnakeSegmentActor) => void;

  constructor(
    x: number,
    y: number,
    onSegmentDied: (segment: SnakeSegmentActor) => void,
  ) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Active,
    });

    this.onSegmentDied = onSegmentDied;
    this.collider.useCircleCollider(SNAKE_BOSS.COLLIDER_RADIUS_SEGMENT);

    this.healthComp = new HealthComponent(
      SNAKE_BOSS.SEGMENT_HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.segCanvas = new ex.Canvas({
      width:  SNAKE_BOSS.CANVAS_SIZE_SEGMENT,
      height: SNAKE_BOSS.CANVAS_SIZE_SEGMENT,
      cache: true,
      draw: (ctx) => this.drawSegment(ctx),
    });
    this.graphics.use(this.segCanvas);
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

  /** Called by SnakeBossActor each frame to reposition this segment. */
  updatePos(pos: ex.Vector, angle: number): void {
    this.pos = pos.clone();
    this.rotation = angle;
  }

  /** Force this segment to die (used for cascade destruction from head). */
  killSilently(): void {
    GameEvents.emit('enemy:died', { points: SNAKE_BOSS.POINT_VALUE_SEGMENT, x: this.pos.x, y: this.pos.y });
    this.spawnFragment();
    this.kill();
  }

  private onDamage(healthRatio: number, damage: number): void {
    const t = 1 - healthRatio;
    const r = Math.floor(t * 255);
    const g = Math.floor(healthRatio * 255);
    this.currentColor = `rgb(${r},${g},0)`;
    this.segCanvas.flagDirty();
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  private onDeath(): void {
    GameEvents.emit('enemy:died', { points: SNAKE_BOSS.POINT_VALUE_SEGMENT, x: this.pos.x, y: this.pos.y });
    this.spawnFragment();
    this.onSegmentDied(this);
    this.kill();
  }

  private spawnFragment(): void {
    const scene = this.scene;
    if (!scene) return;
    const R = SNAKE_BOSS.SEGMENT_RADIUS;
    const outAngle = Math.random() * Math.PI * 2;
    const speed    = SNAKE_BOSS.FRAGMENT_SPEED_MIN + Math.random() * (SNAKE_BOSS.FRAGMENT_SPEED_MAX - SNAKE_BOSS.FRAGMENT_SPEED_MIN);
    const vel      = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
    const angVel   = (Math.random() - 0.5) * 2 * SNAKE_BOSS.FRAGMENT_ANGULAR_VEL_MAX;
    const lifetime = SNAKE_BOSS.FRAGMENT_LIFETIME_MIN + Math.random() * (SNAKE_BOSS.FRAGMENT_LIFETIME_MAX - SNAKE_BOSS.FRAGMENT_LIFETIME_MIN);
    scene.add(new FragmentActor(this.pos.x, this.pos.y, outAngle, vel, angVel, R * 2, lifetime));
  }

  private drawSegment(ctx: CanvasRenderingContext2D): void {
    const s  = SNAKE_BOSS.CANVAS_SIZE_SEGMENT;
    const cx = s / 2;
    const cy = s / 2;
    const R  = SNAKE_BOSS.SEGMENT_RADIUS;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = this.currentColor;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
