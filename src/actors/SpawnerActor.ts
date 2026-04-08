import * as ex from 'excalibur';
import { SPAWNER } from '../constants';
import { HealthComponent } from '../components/HealthComponent';
import { FragmentActor } from './FragmentActor';
import { GameEvents } from '../utils/GameEvents';
import { WandererActor } from './enemies/WandererActor';
import { DartActor } from './enemies/DartActor';
import type { SpawnEnemyType } from '../rooms/RoomDef';

export class SpawnerActor extends ex.Actor {
  readonly isEnemy = true;
  readonly enemyName = 'Spawner';
  readonly collisionDamage = SPAWNER.COLLISION_DAMAGE;

  readonly healthComp: HealthComponent;
  private readonly enemyType: SpawnEnemyType;
  private readonly player: ex.Actor;
  private readonly registerEnemy: (actor: ex.Actor) => void;
  private readonly spawnInterval: number;
  private spawnTimer: number;
  private currentColor = '#ffffff';
  private readonly spawnerCanvas: ex.Canvas;

  constructor(
    x: number,
    y: number,
    enemyType: SpawnEnemyType,
    spawnInterval: number,
    player: ex.Actor,
    registerEnemy: (actor: ex.Actor) => void,
  ) {
    super({ pos: ex.vec(x, y), collisionType: ex.CollisionType.Active });

    this.enemyType = enemyType;
    this.spawnInterval = spawnInterval;
    this.spawnTimer = spawnInterval * SPAWNER.INITIAL_DELAY_FACTOR;
    this.player = player;
    this.registerEnemy = registerEnemy;

    this.collider.useBoxCollider(SPAWNER.SIZE, SPAWNER.SIZE);

    this.healthComp = new HealthComponent(
      SPAWNER.HEALTH,
      (ratio, damage) => this.onDamage(ratio, damage),
      () => this.onDeath(),
    );
    this.addComponent(this.healthComp);

    this.spawnerCanvas = new ex.Canvas({
      width: SPAWNER.CANVAS_SIZE,
      height: SPAWNER.CANVAS_SIZE,
      cache: false,
      draw: (ctx) => this.drawSpawner(ctx),
    });
    this.graphics.use(this.spawnerCanvas);
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
    this.spawnTimer -= delta / 1000;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      this.spawnEnemy();
    }
  }

  private spawnEnemy(): void {
    const actor =
      this.enemyType === 'wanderer'
        ? new WandererActor(this.pos.x, this.pos.y)
        : new DartActor(this.pos.x, this.pos.y, this.player);
    this.registerEnemy(actor);
  }

  private onDamage(healthRatio: number, damage: number): void {
    // White (#ffffff) → red (#ff0000)
    const gb = Math.floor(255 * healthRatio);
    this.currentColor = `rgb(255,${gb},${gb})`;
    this.triggerScalePulse(damage);
    GameEvents.emit('enemy:hit', { damage, x: this.pos.x, y: this.pos.y });
  }

  private onDeath(): void {
    GameEvents.emit('enemy:died', { points: SPAWNER.POINT_VALUE, x: this.pos.x, y: this.pos.y });
    this.spawnFragments();
    this.kill();
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

    const h = SPAWNER.HALF_SIZE;
    const sides = [
      { mid: ex.vec(0, -h), rot: 0           }, // top
      { mid: ex.vec(h,  0), rot: Math.PI / 2 }, // right
      { mid: ex.vec(0,  h), rot: 0           }, // bottom
      { mid: ex.vec(-h, 0), rot: Math.PI / 2 }, // left
    ];

    for (const { mid, rot } of sides) {
      const worldPos = mid.add(this.pos);
      const outAngle = Math.atan2(mid.y, mid.x);
      const speed = SPAWNER.FRAGMENT_SPEED_MIN + Math.random() * (SPAWNER.FRAGMENT_SPEED_MAX - SPAWNER.FRAGMENT_SPEED_MIN);
      const vel = ex.vec(Math.cos(outAngle) * speed, Math.sin(outAngle) * speed);
      const angVel = (Math.random() - 0.5) * 2 * SPAWNER.FRAGMENT_ANGULAR_VEL_MAX;
      const lifetime = SPAWNER.FRAGMENT_LIFETIME_MIN + Math.random() * (SPAWNER.FRAGMENT_LIFETIME_MAX - SPAWNER.FRAGMENT_LIFETIME_MIN);
      scene.add(new FragmentActor(worldPos.x, worldPos.y, rot, vel, angVel, SPAWNER.SIZE, lifetime));
    }
  }

  private drawSpawner(ctx: CanvasRenderingContext2D): void {
    const s = SPAWNER.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;
    const h = SPAWNER.HALF_SIZE;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Box outline — shifts white → red as health drops
    ctx.strokeStyle = this.currentColor;
    ctx.strokeRect(-h, -h, SPAWNER.SIZE, SPAWNER.SIZE);

    // Portrait — always its native color (independent of health)
    if (this.enemyType === 'wanderer') {
      this.drawWandererPortrait(ctx);
    } else {
      this.drawDartPortrait(ctx);
    }

    ctx.restore();
  }

  /** Small gray square centered inside the box. */
  private drawWandererPortrait(ctx: CanvasRenderingContext2D): void {
    const ph = 8;
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-ph, -ph, ph * 2, ph * 2);
  }

  /** Small cyan chevron pointing right inside the box. */
  private drawDartPortrait(ctx: CanvasRenderingContext2D): void {
    const pl = 9; // half-length
    const pw = 6; // half-width
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1.5;

    // V shape: top-back → nose → bottom-back
    ctx.beginPath();
    ctx.moveTo(-pl, -pw);
    ctx.lineTo(pl, 0);
    ctx.lineTo(-pl, pw);
    ctx.stroke();

    // Trailing edge
    ctx.beginPath();
    ctx.moveTo(-pl, -pw);
    ctx.lineTo(-pl, pw);
    ctx.stroke();
  }
}
