import * as ex from 'excalibur';
import { GAME, ROOM, MAZE_GEN } from '../constants';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { RoomManager } from '../rooms/RoomManager';
import { StrokeFont, FONT_COARSENESS } from './StrokeFont';
import { HealthComponent } from '../components/HealthComponent';

const FONT_SIZE = 6;
const LINE_HEIGHT = 9;
const PADDING = 6;

/** Toggle with backtick (`) or F3. */
export class DebugOverlay extends ex.ScreenElement {
  private visible = false;
  private smoothFps = 60;
  private lastDamage: { raw: number; post: number } | null = null;

  private readonly state: SharedPlayerState;
  private readonly roomManager: RoomManager;
  private readonly canvas: ex.Canvas;

  constructor(state: SharedPlayerState, roomManager: RoomManager) {
    super({ x: 0, y: 0, z: 200 });
    this.state = state;
    this.roomManager = roomManager;

    this.canvas = new ex.Canvas({
      width: GAME.WIDTH,
      height: GAME.HEIGHT,
      cache: false,
      draw: (ctx) => this.drawOverlay(ctx),
    });
    this.graphics.use(this.canvas);
    this.graphics.anchor = ex.vec(0, 0);

    // Track last damage for display
    import('../utils/GameEvents').then(({ GameEvents }) => {
      GameEvents.on('player:hit', (evt) => {
        this.lastDamage = { raw: evt.damage, post: evt.damage };
      });
    });
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    // FPS smoothing
    if (delta > 0) {
      const fps = 1000 / delta;
      this.smoothFps = this.smoothFps * 0.9 + fps * 0.1;
    }

    const kb = engine.input.keyboard;

    // Toggle overlay
    if (kb.wasPressed(ex.Keys.Backquote) || kb.wasPressed(ex.Keys.F3)) {
      this.visible = !this.visible;
    }

    // Toggle god mode at runtime
    if (kb.wasPressed(ex.Keys.G)) {
      this.state.godMode = !this.state.godMode;
    }
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) {
      ctx.clearRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
      return;
    }

    ctx.clearRect(0, 0, GAME.WIDTH, GAME.HEIGHT);

    // Collect enemy data from scene
    type EnemyDebug = { name: string; hp: number; maxHp: number };
    const enemies: EnemyDebug[] = [];
    if (this.scene) {
      for (const actor of this.scene.actors) {
        const e = actor as ex.Actor & {
          isEnemy?: boolean;
          enemyName?: string;
          healthComp?: HealthComponent;
        };
        if (e.isEnemy && e.healthComp) {
          enemies.push({
            name: e.enemyName ?? '?',
            hp: e.healthComp.currentHp,
            maxHp: e.healthComp.maxHp,
          });
        }
      }
    }

    // Build lines
    const s = this.state;
    const rm = this.roomManager;
    const lines: string[] = [
      `FPS: ${Math.round(this.smoothFps)}`,
      `Room: ${rm.currentRoomId}  Diff: ${rm.currentDifficulty.toFixed(2)}  Live: ${rm.liveCount}`,
      `Seed: ${MAZE_GEN.SEED}`,
      `Upgrades: S${s.shooterType} W${s.weaponPower} SH${s.shieldLevel}(${Math.round(s.shieldCharge)}/${s.shieldMaxCharge}) P${s.panicCount}`,
      `God: ${s.godMode ? 'ON' : 'off'}`,
      `Health: ${Math.round(s.health)}/${s.maxHealth}`,
      `Last hit: ${this.lastDamage ? `${Math.round(this.lastDamage.post)} dmg` : '—'}`,
      '',
      `Enemies (${enemies.length}):`,
      ...enemies.map((e) => `  ${e.name}: ${Math.round(e.hp)}/${e.maxHp}`),
    ];

    // Draw panel outline
    const panelW = 160;
    const panelH = PADDING * 2 + lines.length * LINE_HEIGHT;
    const panelX = GAME.WIDTH - panelW - 10;
    const panelY = ROOM.HUD_HEIGHT + 10;

    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Draw lines
    let y = panelY + PADDING + FONT_SIZE;
    for (const line of lines) {
      if (line !== '') {
        StrokeFont.draw(ctx, line, panelX + PADDING, y - FONT_SIZE, FONT_SIZE, '#aaaacc', 1, FONT_COARSENESS);
      }
      y += LINE_HEIGHT;
    }

    // Toggle hint (bottom-right)
    const hint = '`/F3: overlay  G: god mode';
    const hintW = StrokeFont.measure(hint, FONT_SIZE);
    StrokeFont.draw(ctx, hint, GAME.WIDTH - hintW - 8, GAME.HEIGHT - 12, FONT_SIZE, '#333355', 1, FONT_COARSENESS);
  }
}
