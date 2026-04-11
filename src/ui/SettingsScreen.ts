import * as ex from 'excalibur';
import { GAME, MENU, ROOM } from '../constants';
import {
  controlSchemeLabel,
  cycleDifficulty,
  cyclePlayerControl,
  difficultyLabel,
  getGameSettings,
  togglePlayerCount,
} from '../settings/GameSettings';
import { StrokeFont } from './StrokeFont';

type RowKind = 'difficulty' | 'players' | 'p1' | 'p2' | 'back';

interface RowDef {
  readonly kind: RowKind;
  readonly label: string;
}

/**
 * Coop + difficulty + per-player control assignment (keyboard/mouse at most once).
 */
export class SettingsScreen extends ex.ScreenElement {
  private readonly engineRef: ex.Engine;
  private readonly onClose: () => void;
  private selectedIndex = 0;
  private lastScreenPos = ex.vec(0, 0);
  private pointerClickPending = false;
  private readonly canvas: ex.Canvas;

  private readonly titleY: number;
  private readonly listTopY: number;
  private readonly lineStep = 44;
  private readonly itemSize = 26;
  private readonly itemCoarseness = 5;
  private readonly rowHitHalf = this.itemSize * 0.55;

  private moveHandler!: (e: ex.PointerEvent) => void;
  private downHandler!: () => void;

  constructor(engine: ex.Engine, onClose: () => void) {
    super({ x: 0, y: 0, z: 2000 });
    this.engineRef = engine;
    this.onClose = onClose;

    const midY = ROOM.HUD_HEIGHT + (GAME.HEIGHT - ROOM.HUD_HEIGHT) / 2;
    this.titleY = midY - 200;
    this.listTopY = midY - 70;

    this.canvas = new ex.Canvas({
      width:  GAME.WIDTH,
      height: GAME.HEIGHT,
      cache:  false,
      draw:   (ctx) => this.drawScreen(ctx),
    });
    this.graphics.use(this.canvas);
    this.graphics.anchor = ex.vec(0, 0);

    this.moveHandler = (e: ex.PointerEvent) => {
      this.lastScreenPos = ex.vec(e.screenPos.x, e.screenPos.y);
    };
    this.downHandler = () => {
      this.pointerClickPending = true;
    };
    engine.input.pointers.primary.on('move', this.moveHandler);
    engine.input.pointers.primary.on('down', this.downHandler);

    this.on('prekill', () => {
      engine.input.pointers.primary.off('move', this.moveHandler);
      engine.input.pointers.primary.off('down', this.downHandler);
    });
  }

  private visibleRows(): RowDef[] {
    const g = getGameSettings();
    const rows: RowDef[] = [
      { kind: 'difficulty', label: 'DIFFICULTY' },
      { kind: 'players', label: 'PLAYERS' },
      { kind: 'p1', label: 'PLAYER 1 CONTROLS' },
    ];
    if (g.playerCount === 2) {
      rows.push({ kind: 'p2', label: 'PLAYER 2 CONTROLS' });
    }
    rows.push({ kind: 'back', label: 'BACK TO MENU' });
    return rows;
  }

  private valueLabel(kind: RowKind): string {
    const g = getGameSettings();
    switch (kind) {
      case 'difficulty': return difficultyLabel(g.difficulty);
      case 'players': return g.playerCount === 1 ? 'ONE' : 'TWO (COOP)';
      case 'p1': return controlSchemeLabel(g.playerControls[0]);
      case 'p2': return controlSchemeLabel(g.playerControls[1]);
      case 'back': return '';
    }
  }

  onPreUpdate(_engine: ex.Engine, _delta: number): void {
    const rows = this.visibleRows();
    this.selectedIndex = Math.min(this.selectedIndex, rows.length - 1);

    const kb = this.engineRef.input.keyboard;
    if (kb.wasPressed(ex.Keys.ArrowUp) || kb.wasPressed(ex.Keys.W)) {
      this.selectedIndex = (this.selectedIndex - 1 + rows.length) % rows.length;
    }
    if (kb.wasPressed(ex.Keys.ArrowDown) || kb.wasPressed(ex.Keys.S)) {
      this.selectedIndex = (this.selectedIndex + 1) % rows.length;
    }
    if (kb.wasPressed(ex.Keys.Escape)) {
      this.onClose();
      return;
    }

    const row = rows[this.selectedIndex];
    if (row.kind !== 'back') {
      if (kb.wasPressed(ex.Keys.ArrowLeft) || kb.wasPressed(ex.Keys.A)) {
        this.adjustRow(row.kind, -1);
      }
      if (kb.wasPressed(ex.Keys.ArrowRight) || kb.wasPressed(ex.Keys.D)) {
        this.adjustRow(row.kind, 1);
      }
    }

    if (kb.wasPressed(ex.Keys.Enter) || kb.wasPressed(ex.Keys.Space)) {
      this.activateRow(row);
    }

    if (this.pointerClickPending) {
      this.pointerClickPending = false;
      this.updateHoverFromPointer(rows);
      this.activateRow(rows[this.selectedIndex]);
    }

    this.updateHoverFromPointer(rows);
  }

  private adjustRow(kind: RowKind, dir: -1 | 1): void {
    switch (kind) {
      case 'difficulty': cycleDifficulty(dir); break;
      case 'players': togglePlayerCount(); break;
      case 'p1': cyclePlayerControl(0, dir); break;
      case 'p2': cyclePlayerControl(1, dir); break;
      default: break;
    }
  }

  private activateRow(row: RowDef): void {
    if (row.kind === 'back') {
      this.onClose();
    }
  }

  private updateHoverFromPointer(rows: RowDef[]): void {
    const { x, y } = this.lastScreenPos;
    for (let i = 0; i < rows.length; i++) {
      const cy = this.rowCenterY(i);
      if (Math.abs(y - cy) < this.rowHitHalf && x >= ROOM.INNER_LEFT && x <= ROOM.INNER_RIGHT) {
        this.selectedIndex = i;
        break;
      }
    }
  }

  private rowCenterY(i: number): number {
    return this.listTopY + this.itemSize * 0.35 + i * this.lineStep;
  }

  private drawScreen(ctx: CanvasRenderingContext2D): void {
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;
    const rows = this.visibleRows();

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const title = 'SETTINGS';
    const titleX = (w - StrokeFont.measure(title, MENU.TITLE_SIZE)) / 2;
    StrokeFont.draw(
      ctx,
      title,
      titleX,
      this.titleY,
      MENU.TITLE_SIZE,
      ROOM.WALL_LINE_COLOR,
      2.2,
      MENU.TITLE_COARSENESS,
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const val = this.valueLabel(row.kind);
      const line = val ? `${row.label}   ${val}` : row.label;
      const tw = StrokeFont.measure(line, this.itemSize);
      const tx = (w - tw) / 2;
      const ty = this.listTopY + i * this.lineStep;
      const sel = i === this.selectedIndex;
      const color = row.kind === 'back'
        ? (sel ? '#ccaa88' : '#886644')
        : (sel ? '#ffffff' : '#99aacc');
      const lw = sel ? 2.0 : 1.3;
      StrokeFont.draw(ctx, line, tx, ty, this.itemSize, color, lw, this.itemCoarseness);
    }

    const hint = 'LEFT / RIGHT ADJUST   ENTER BACK OR ESC';
    const hs = MENU.HINT_SIZE;
    const hx = (w - StrokeFont.measure(hint, hs)) / 2;
    const hy = this.listTopY + rows.length * this.lineStep + 28;
    StrokeFont.draw(ctx, hint, hx, hy, hs, '#555555', 1.1, MENU.HINT_COARSENESS);
  }
}
