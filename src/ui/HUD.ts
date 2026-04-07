import * as ex from 'excalibur';
import { GAME, ROOM } from '../constants';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { GameEvents } from '../utils/GameEvents';
import { StrokeFont, FONT_COARSENESS } from './StrokeFont';

export class HUD extends ex.ScreenElement {
  private readonly state: SharedPlayerState;
  private readonly hudCanvas: ex.Canvas;

  constructor(state: SharedPlayerState) {
    super({ x: 0, y: 0, z: 100 });
    this.state = state;

    this.hudCanvas = new ex.Canvas({
      width: GAME.WIDTH,
      height: ROOM.HUD_HEIGHT,
      cache: false,
      draw: (ctx) => this.drawHUD(ctx),
    });

    this.graphics.use(this.hudCanvas);
    this.graphics.anchor = ex.vec(0, 0);

    GameEvents.on('health:changed', () => { /* canvas redraws every frame */ });
    GameEvents.on('score:changed', () => { /* canvas redraws every frame */ });
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    const w = GAME.WIDTH;
    const h = ROOM.HUD_HEIGHT;

    ctx.clearRect(0, 0, w, h);

    // HUD bottom separator line
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w, h - 1);
    ctx.stroke();

    // --- Health bar (left side) ---
    const barX = 20;
    const barY = 20;
    const barW = 180;
    const barH = 18;
    const ratio = this.state.healthRatio;

    // Outer border rectangle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    // Zig-zag fill — fully saturated green, length proportional to health
    const innerLeft = barX + 2;
    const innerTop = barY + 2;
    const innerBottom = barY + barH - 2;
    const healthRight = innerLeft + Math.max(0, (barW - 4) * ratio);
    const toothHalf = 6; // px per half-tooth (full V = 12 px wide)

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(innerLeft, innerBottom);

    let x = innerLeft;
    let toTop = true;
    while (x < healthRight) {
      const nextX = Math.min(x + toothHalf, healthRight);
      ctx.lineTo(nextX, toTop ? innerTop : innerBottom);
      x = nextX;
      toTop = !toTop;
    }
    ctx.stroke();

    // --- Ship icon × fleet count ---
    const iconX = barX + barW + 20;
    const iconCY = h / 2;
    this.drawShipIcon(ctx, iconX, iconCY, '#ADD8E6');

    const fontSize = 22;
    const fleetText = `X ${this.state.fleet}`;
    StrokeFont.draw(ctx, fleetText, iconX + 24, iconCY - fontSize / 2, fontSize, '#ffffff', 1.5, FONT_COARSENESS);

    // --- Score (right side) ---
    const scoreText = `SCORE ${this.state.score}`;
    const scoreW = StrokeFont.measure(scoreText, fontSize);
    StrokeFont.draw(ctx, scoreText, w - 20 - scoreW, iconCY - fontSize / 2, fontSize, '#ffffff', 1.5, FONT_COARSENESS);
  }

  // Draws a miniature player ship centered at (cx, cy)
  private drawShipIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
    const len = 18;
    const hw = 7;
    const nr = 2.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    // Triangle body
    ctx.beginPath();
    ctx.moveTo(len / 2, 0);
    ctx.lineTo(-len / 2, -hw);
    ctx.lineTo(-len / 2, hw);
    ctx.closePath();
    ctx.stroke();

    // Nacelle circles
    ctx.beginPath();
    ctx.arc(-len / 2, -hw, nr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-len / 2, hw, nr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
