import * as ex from 'excalibur';
import { GAME, MENU, ROOM } from '../constants';
import { StrokeFont } from './StrokeFont';

type MenuAction = 'start' | 'settings' | 'noop';

interface MenuRow {
  readonly label: string;
  readonly action: MenuAction;
}

const ROWS: MenuRow[] = [
  { label: 'START GAME', action: 'start' },
  { label: 'SETTINGS', action: 'settings' },
  { label: 'QUIT', action: 'noop' },
];

/**
 * Full-screen main menu: vector text with StrokeFont coarseness, keyboard + mouse.
 */
export class MainMenuScreen extends ex.ScreenElement {
  private readonly engineRef: ex.Engine;
  private readonly onStartGame: () => Promise<void>;
  private readonly onOpenSettings: () => void;
  private selectedIndex = 0;
  private lastScreenPos = ex.vec(0, 0);
  private pointerClickPending = false;
  private readonly canvas: ex.Canvas;

  private readonly titleY: number;
  private readonly listTopY: number;
  private readonly rowHitHalf = MENU.ITEM_SIZE * 0.55;

  private moveHandler!: (e: ex.PointerEvent) => void;
  private downHandler!: () => void;

  constructor(engine: ex.Engine, onStartGame: () => Promise<void>, onOpenSettings: () => void) {
    super({ x: 0, y: 0, z: 2000 });
    this.engineRef = engine;
    this.onStartGame = onStartGame;
    this.onOpenSettings = onOpenSettings;

    const midY = ROOM.HUD_HEIGHT + (GAME.HEIGHT - ROOM.HUD_HEIGHT) / 2;
    this.titleY = midY - 140;
    this.listTopY = midY + 10;

    this.canvas = new ex.Canvas({
      width:  GAME.WIDTH,
      height: GAME.HEIGHT,
      cache:  false,
      draw:   (ctx) => this.drawMenu(ctx),
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

  onPreUpdate(_engine: ex.Engine, _delta: number): void {
    const kb = this.engineRef.input.keyboard;
    if (kb.wasPressed(ex.Keys.ArrowUp) || kb.wasPressed(ex.Keys.W)) {
      this.selectedIndex = (this.selectedIndex - 1 + ROWS.length) % ROWS.length;
    }
    if (kb.wasPressed(ex.Keys.ArrowDown) || kb.wasPressed(ex.Keys.S)) {
      this.selectedIndex = (this.selectedIndex + 1) % ROWS.length;
    }
    if (kb.wasPressed(ex.Keys.Enter) || kb.wasPressed(ex.Keys.Space)) {
      void this.activateSelection();
    }

    if (this.pointerClickPending) {
      this.pointerClickPending = false;
      this.updateHoverFromPointer();
      void this.activateSelection();
    }

    this.updateHoverFromPointer();
  }

  private updateHoverFromPointer(): void {
    const { x, y } = this.lastScreenPos;
    for (let i = 0; i < ROWS.length; i++) {
      const cy = this.rowCenterY(i);
      if (Math.abs(y - cy) < this.rowHitHalf && x >= ROOM.INNER_LEFT && x <= ROOM.INNER_RIGHT) {
        this.selectedIndex = i;
        break;
      }
    }
  }

  private rowCenterY(i: number): number {
    return this.listTopY + MENU.ITEM_SIZE * 0.35 + i * MENU.LINE_STEP;
  }

  private async activateSelection(): Promise<void> {
    const row = ROWS[this.selectedIndex];
    if (row.action === 'start') {
      await this.onStartGame();
      return;
    }
    if (row.action === 'settings') {
      this.onOpenSettings();
    }
  }

  private drawMenu(ctx: CanvasRenderingContext2D): void {
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const title = 'CHAOS CURTAIN';
    const titleX = (w - StrokeFont.measure(title, MENU.TITLE_SIZE)) / 2;
    StrokeFont.draw(
      ctx,
      title,
      titleX,
      this.titleY,
      MENU.TITLE_SIZE,
      ROOM.WALL_LINE_COLOR,
      2.5,
      MENU.TITLE_COARSENESS,
    );

    for (let i = 0; i < ROWS.length; i++) {
      const row = ROWS[i];
      const label = row.label;
      const tw = StrokeFont.measure(label, MENU.ITEM_SIZE);
      const tx = (w - tw) / 2;
      const ty = this.listTopY + i * MENU.LINE_STEP;
      const sel = i === this.selectedIndex;
      const color = row.action === 'start' || row.action === 'settings'
        ? (sel ? '#ffffff' : '#aaccee')
        : (sel ? '#8899aa' : '#445566');
      const lw = sel ? 2.2 : 1.4;
      StrokeFont.draw(ctx, label, tx, ty, MENU.ITEM_SIZE, color, lw, MENU.ITEM_COARSENESS);
    }

    const hint = 'UP / DOWN OR MOUSE   ENTER / CLICK';
    const hs = MENU.HINT_SIZE;
    const hx = (w - StrokeFont.measure(hint, hs)) / 2;
    const hy = this.listTopY + ROWS.length * MENU.LINE_STEP + 36;
    StrokeFont.draw(ctx, hint, hx, hy, hs, '#666666', 1.2, MENU.HINT_COARSENESS);
  }
}
