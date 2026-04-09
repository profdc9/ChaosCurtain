import * as ex from 'excalibur';
import { SPAWNER, WORM } from '../constants';
import { HealthComponent } from '../components/HealthComponent';
import { FragmentActor } from './FragmentActor';
import { GameEvents } from '../utils/GameEvents';
import { WandererActor } from './enemies/WandererActor';
import { DartActor } from './enemies/DartActor';
import { WranglerActor } from './enemies/WranglerActor';
import { SatelliteActor } from './enemies/SatelliteActor';
import { WormActor } from './enemies/WormActor';
import { BlasterActor } from './enemies/BlasterActor';
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
  private readonly difficulty: number;
  private spawnTimer: number;
  private currentColor = '#ffffff';
  private readonly spawnerCanvas: ex.Canvas;

  constructor(
    x: number,
    y: number,
    enemyType: SpawnEnemyType,
    spawnInterval: number,
    difficulty: number,
    player: ex.Actor,
    registerEnemy: (actor: ex.Actor) => void,
  ) {
    super({ pos: ex.vec(x, y), collisionType: ex.CollisionType.Active });

    this.enemyType = enemyType;
    this.spawnInterval = spawnInterval;
    this.spawnTimer = spawnInterval * SPAWNER.INITIAL_DELAY_FACTOR;
    this.difficulty = difficulty;
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
    let actor: ex.Actor;
    switch (this.enemyType) {
      case 'wanderer':  actor = new WandererActor(this.pos.x, this.pos.y); break;
      case 'dart':      actor = new DartActor(this.pos.x, this.pos.y, this.player); break;
      case 'wrangler':  actor = new WranglerActor(this.pos.x, this.pos.y, this.player); break;
      case 'satellite': actor = new SatelliteActor(this.pos.x, this.pos.y, this.player, this.difficulty); break;
      case 'worm': {
        const splitsLeft = this.difficulty >= 0.66 ? 2 : 1;
        actor = new WormActor(this.pos.x, this.pos.y, this.player, WORM.HEALTH, splitsLeft, this.registerEnemy);
        break;
      }
      case 'blaster': actor = new BlasterActor(this.pos.x, this.pos.y, this.player, this.difficulty); break;
    }
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
    } else if (this.enemyType === 'dart') {
      this.drawDartPortrait(ctx);
    } else if (this.enemyType === 'wrangler') {
      this.drawWranglerPortrait(ctx);
    } else if (this.enemyType === 'satellite') {
      this.drawSatellitePortrait(ctx);
    } else if (this.enemyType === 'worm') {
      this.drawWormPortrait(ctx);
    } else {
      this.drawBlasterPortrait(ctx);
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

  /** Small green circle with four yellow dots at 90° intervals. */
  private drawWranglerPortrait(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffff00';
    for (const [dx, dy] of [[0, -13], [13, 0], [0, 13], [-13, 0]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Small blue circle with gray cross through center. */
  private drawSatellitePortrait(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#888888';
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(angle) * 12, -Math.sin(angle) * 12);
      ctx.lineTo( Math.cos(angle) * 12,  Math.sin(angle) * 12);
      ctx.stroke();
    }
    ctx.strokeStyle = '#4466ff';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** Two small brown circles connected by a yellow line. */
  private drawWormPortrait(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffff00';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.strokeStyle = '#c07830';
    for (const x of [-10, 10]) {
      ctx.beginPath();
      ctx.arc(x, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Five small spike lines radiating from center. */
  private drawBlasterPortrait(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 5, Math.sin(angle) * 5);
      ctx.lineTo(Math.cos(angle) * 13, Math.sin(angle) * 13);
      ctx.stroke();
    }
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
