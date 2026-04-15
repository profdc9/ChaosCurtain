import * as ex from 'excalibur';
import { GAME, MENU, ROOM } from '../constants';
import { StrokeFont } from './StrokeFont';
import { setGameplayPaused } from '../utils/GameplayPause';

type PauseAction = 'resume' | 'quit';

interface PauseRow {
  readonly label: string;
  readonly action: PauseAction;
}

const ROWS: PauseRow[] = [
  { label: 'RESUME GAME', action: 'resume' },
  { label: 'QUIT GAME', action: 'quit' },
];

/**
 * Full-screen pause menu: dim backdrop, bordered box, vector labels.
 * Sets {@link setGameplayPaused} so gameplay actors skip updates; window key handlers keep
 * Escape / arrows / Enter working regardless of frame delta.
 */
export class PauseOverlay extends ex.ScreenElement {
  private readonly engineRef: ex.Engine;

  private menuOpen = false;
  private selectedIndex = 0;
  private lastScreenX = 0;
  private lastScreenY = 0;

  private readonly canvas: ex.Canvas;
  private readonly boxW = 420;
  private readonly boxH = 200;
  private readonly boxX: number;
  private readonly boxY: number;
  private readonly listTopY: number;
  private readonly rowStep = 52;
  private readonly itemSize = 28;
  private readonly rowHitHalf = this.itemSize * 0.55;

  private readonly boundKeyDown = (e: KeyboardEvent): void => {
    if (!this.menuOpen) return;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + ROWS.length) % ROWS.length;
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % ROWS.length;
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      this.applyAction(ROWS[this.selectedIndex].action);
    } else if (e.code === 'Escape') {
      e.preventDefault();
      // Second Esc after opening pause: leave the run (GameplayScene handles the first Esc).
      this.applyAction('quit');
    }
  };

  private readonly boundPointerDown = (): void => {
    if (!this.menuOpen) return;
    this.syncPointerFromEngine();
    const row = this.pickRowAt(this.lastScreenX, this.lastScreenY);
    if (row === null) return;
    this.selectedIndex = row;
    this.applyAction(ROWS[row].action);
  };

  private readonly boundPointerMove = (evt: ex.PointerEvent): void => {
    this.lastScreenX = evt.screenPos.x;
    this.lastScreenY = evt.screenPos.y;
  };

  constructor(engine: ex.Engine) {
    super({ x: 0, y: 0, z: 2500 });
    this.engineRef = engine;

    const midX = GAME.WIDTH / 2;
    const midY = ROOM.HUD_HEIGHT + (GAME.HEIGHT - ROOM.HUD_HEIGHT) / 2;
    this.boxX = midX - this.boxW / 2;
    this.boxY = midY - this.boxH / 2;
    this.listTopY = this.boxY + 72;

    this.canvas = new ex.Canvas({
      width:  GAME.WIDTH,
      height: GAME.HEIGHT,
      cache:  false,
      draw:   (ctx) => this.drawOverlay(ctx),
    });
    this.graphics.use(this.canvas);
    this.graphics.anchor = ex.vec(0, 0);
    this.graphics.visible = false;

    engine.input.pointers.primary.on('move', this.boundPointerMove);
    engine.input.pointers.primary.on('down', this.boundPointerDown);

    this.on('prekill', () => {
      this.forceCloseIfOpen();
      engine.input.pointers.primary.off('move', this.boundPointerMove);
      engine.input.pointers.primary.off('down', this.boundPointerDown);
    });
  }

  isMenuOpen(): boolean {
    return this.menuOpen;
  }

  /** If the scene is left while paused (e.g. quit), release listeners and clear gameplay pause. */
  forceCloseIfOpen(): void {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.graphics.visible = false;
    setGameplayPaused(false);
    window.removeEventListener('keydown', this.boundKeyDown, true);
  }

  openMenu(): void {
    if (this.menuOpen) return;
    this.menuOpen = true;
    this.selectedIndex = 0;
    this.graphics.visible = true;
    setGameplayPaused(true);
    window.addEventListener('keydown', this.boundKeyDown, true);
  }

  private resume(): void {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.graphics.visible = false;
    setGameplayPaused(false);
    window.removeEventListener('keydown', this.boundKeyDown, true);
  }

  private applyAction(action: PauseAction): void {
    if (action === 'resume') {
      this.resume();
      return;
    }
    this.resume();
    void this.engineRef.goToScene('menu');
  }

  private syncPointerFromEngine(): void {
    const p = this.engineRef.input.pointers.primary.lastScreenPos;
    this.lastScreenX = p.x;
    this.lastScreenY = p.y;
  }

  /** Row index if `(x,y)` is over a menu line inside the dialog; otherwise `null`. */
  private pickRowAt(screenX: number, screenY: number): number | null {
    const padX = 20;
    if (screenX < this.boxX + padX || screenX > this.boxX + this.boxW - padX) return null;
    let best: number | null = null;
    let bestD = Infinity;
    for (let i = 0; i < ROWS.length; i++) {
      const d = Math.abs(screenY - this.rowCenterY(i));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best === null || bestD > this.rowHitHalf * 1.65) return null;
    return best;
  }

  private updateHoverFromPointer(): void {
    this.syncPointerFromEngine();
    const row = this.pickRowAt(this.lastScreenX, this.lastScreenY);
    if (row !== null) this.selectedIndex = row;
  }

  /** Vertical center of the label row (must match drawing). */
  private rowCenterY(i: number): number {
    return this.listTopY + i * this.rowStep + this.itemSize * 0.42;
  }

  onPreUpdate(engine: ex.Engine, _delta: number): void {
    if (!this.menuOpen) return;
    this.updateHoverFromPointer();
    this.pollGamepads(engine);
  }

  /** D-pad / face buttons so co-op gamepad-only players can use the pause menu when the clock runs. */
  private pollGamepads(engine: ex.Engine): void {
    const pads = engine.input.gamepads;
    if (!pads.enabled) return;
    for (let i = 0; i < 4; i++) {
      const gp = pads.at(i);
      if (!gp.connected) continue;
      if (gp.wasButtonPressed(ex.Buttons.DpadUp)) {
        this.selectedIndex = (this.selectedIndex - 1 + ROWS.length) % ROWS.length;
      }
      if (gp.wasButtonPressed(ex.Buttons.DpadDown)) {
        this.selectedIndex = (this.selectedIndex + 1) % ROWS.length;
      }
      if (gp.wasButtonPressed(ex.Buttons.Face1) || gp.wasButtonPressed(ex.Buttons.Start)) {
        this.applyAction(ROWS[this.selectedIndex].action);
        return;
      }
      if (gp.wasButtonPressed(ex.Buttons.Face2) || gp.wasButtonPressed(ex.Buttons.Select)) {
        this.applyAction('resume');
        return;
      }
    }
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;
    if (!this.menuOpen) {
      ctx.clearRect(0, 0, w, h);
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = ROOM.WALL_LINE_COLOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(this.boxX, this.boxY, this.boxW, this.boxH);

    const title = 'PAUSED';
    const titleSize = MENU.TITLE_SIZE * 0.55;
    const tw = StrokeFont.measure(title, titleSize);
    StrokeFont.draw(
      ctx,
      title,
      (w - tw) / 2,
      this.boxY + 28,
      titleSize,
      ROOM.WALL_LINE_COLOR,
      2,
      MENU.TITLE_COARSENESS,
    );

    for (let i = 0; i < ROWS.length; i++) {
      const row = ROWS[i];
      const label = row.label;
      const lw = StrokeFont.measure(label, this.itemSize);
      const tx = (w - lw) / 2;
      const ty = this.listTopY + i * this.rowStep;
      const sel = i === this.selectedIndex;
      const color = sel ? '#ffffff' : '#aaccee';
      StrokeFont.draw(ctx, label, tx, ty, this.itemSize, color, sel ? 2.2 : 1.4, MENU.ITEM_COARSENESS);
    }

    const hint = 'UP / DOWN   ENTER / CLICK ROW   ESC = QUIT TO MENU   B / SELECT = RESUME';
    const hs = MENU.HINT_SIZE;
    const hx = (w - StrokeFont.measure(hint, hs)) / 2;
    const hy = this.boxY + this.boxH - 36;
    StrokeFont.draw(ctx, hint, hx, hy, hs, '#666666', 1.2, MENU.HINT_COARSENESS);
  }
}
