import * as ex from 'excalibur';
import { GAME, ROOM } from '../constants';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { GameEvents } from '../utils/GameEvents';

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

    // HUD background separator line
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w, h - 1);
    ctx.stroke();

    // Health bar
    const barX = 20;
    const barY = 18;
    const barW = 200;
    const barH = 20;
    const ratio = this.state.healthRatio;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    // Fill proportional to health
    const fillW = Math.max(0, (barW - 2) * ratio);
    const fillColor = ratio > 0.5 ? '#00cc44' : ratio > 0.25 ? '#ccaa00' : '#cc2200';
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX + 1, barY + 1, fillW, barH - 2);

    // Health label
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(`HEALTH  ${this.state.fleet} SHIPS`, barX + barW + 16, barY + 14);

    // Score
    ctx.font = '20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE  ${this.state.score}`, w - 20, barY + 16);
    ctx.textAlign = 'left';
  }
}
