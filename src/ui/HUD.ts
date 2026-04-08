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
    GameEvents.on('player:upgraded', () => { /* canvas redraws every frame */ });
    GameEvents.on('player:downgraded', () => { /* canvas redraws every frame */ });
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

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    // Zig-zag fill — saturated green, proportional to health
    const innerLeft   = barX + 2;
    const innerTop    = barY + 2;
    const innerBottom = barY + barH - 2;
    const healthRight = innerLeft + Math.max(0, (barW - 4) * ratio);
    const toothHalf   = 3;

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
    const iconX  = barX + barW + 20;
    const iconCY = h / 2;
    const fontSize = 22;
    this.drawShipIcon(ctx, iconX, iconCY, '#ADD8E6');
    const fleetText = `X ${this.state.fleet}`;
    StrokeFont.draw(ctx, fleetText, iconX + 24, iconCY - fontSize / 2, fontSize, '#ffffff', 1.5, FONT_COARSENESS);

    // --- Upgrade indicators (center) ---
    const upgradeStartX = 340;
    const upgradeCY = h / 2;
    this.drawUpgrades(ctx, upgradeStartX, upgradeCY);

    // --- Score (right side) ---
    const scoreText = `SCORE ${this.state.score}`;
    const scoreW = StrokeFont.measure(scoreText, fontSize);
    StrokeFont.draw(ctx, scoreText, w - 20 - scoreW, iconCY - fontSize / 2, fontSize, '#ffffff', 1.5, FONT_COARSENESS);
  }

  private drawUpgrades(ctx: CanvasRenderingContext2D, startX: number, cy: number): void {
    const s = this.state;
    let x = startX;
    const spacing = 160;
    const labelSize = 14;

    // Shooter type indicator
    x = this.drawShooterIndicator(ctx, x, cy, s.shooterType);
    x = startX + spacing;

    // Weapon power (only if > 1)
    if (s.weaponPower > 1) {
      x = this.drawWeaponPowerIndicator(ctx, x, cy, s.weaponPower, labelSize);
    }
    x = startX + spacing * 2;

    // Shield (only if > 0)
    if (s.shieldLevel > 0) {
      x = this.drawShieldIndicator(ctx, x, cy, s.shieldLevel, s.shieldCharge, s.shieldMaxCharge, labelSize);
    }
    x = startX + spacing * 3;

    // Panic count (only if > 0)
    if (s.panicCount > 0) {
      this.drawPanicIndicator(ctx, x, cy, s.panicCount, labelSize);
    }
  }

  // Shooter type: 1–3 dots arranged in the active firing pattern
  private drawShooterIndicator(ctx: CanvasRenderingContext2D, x: number, cy: number, level: number): number {
    const r = 3;
    const gap = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    // Forward dot (always present)
    ctx.beginPath(); ctx.arc(x + gap, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (level >= 2) {
      // Back dot
      ctx.beginPath(); ctx.arc(x - gap, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    if (level >= 3) {
      // Top + bottom dots (cardinal)
      ctx.beginPath(); ctx.arc(x, cy - gap, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, cy + gap, r, 0, Math.PI * 2); ctx.stroke();
    }
    return x;
  }

  // Weapon power: small square-with-dot icon + level count
  private drawWeaponPowerIndicator(
    ctx: CanvasRenderingContext2D, x: number, cy: number, level: number, fontSize: number,
  ): number {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    const h = 7;
    ctx.strokeRect(x - h, cy - h, h * 2, h * 2);
    ctx.beginPath(); ctx.arc(x, cy, 2.5, 0, Math.PI * 2); ctx.stroke();
    const label = `\xD7${level}`;
    StrokeFont.draw(ctx, label, x + h + 4, cy - fontSize / 2, fontSize, '#ffffff', 1.2, FONT_COARSENESS);
    return x;
  }

  // Shield: square-with-X icon + level count + thin charge bar below
  private drawShieldIndicator(
    ctx: CanvasRenderingContext2D, x: number, cy: number,
    level: number, charge: number, maxCharge: number, fontSize: number,
  ): number {
    ctx.strokeStyle = '#88aaff';
    ctx.lineWidth = 1.5;
    const h = 7;
    ctx.strokeRect(x - h, cy - h, h * 2, h * 2);
    ctx.beginPath();
    ctx.moveTo(x - h, cy - h); ctx.lineTo(x + h, cy + h);
    ctx.moveTo(x + h, cy - h); ctx.lineTo(x - h, cy + h);
    ctx.stroke();
    const label = `\xD7${level}`;
    StrokeFont.draw(ctx, label, x + h + 4, cy - fontSize / 2, fontSize, '#88aaff', 1.2, FONT_COARSENESS);
    // Charge bar: 30px wide, 3px tall, just below the icon
    const barW = 30;
    const barY = cy + h + 3;
    const chargeRatio = maxCharge > 0 ? charge / maxCharge : 0;
    ctx.strokeStyle = '#334488';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - barW / 2, barY, barW, 3);
    ctx.fillStyle = '#88aaff';
    ctx.fillRect(x - barW / 2 + 1, barY + 1, Math.max(0, (barW - 2) * chargeRatio), 1);
    return x;
  }

  // Panic: top hat icon + count
  private drawPanicIndicator(ctx: CanvasRenderingContext2D, x: number, cy: number, count: number, fontSize: number): void {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    const brimW = 10;
    const brimH = 2;
    const crownW = 6;
    const crownH = 8;
    const brimY = cy + 4;
    ctx.strokeRect(x - brimW, brimY - brimH, brimW * 2, brimH);
    ctx.strokeRect(x - crownW, brimY - brimH - crownH, crownW * 2, crownH);
    const label = `\xD7${count}`;
    StrokeFont.draw(ctx, label, x + brimW + 4, cy - fontSize / 2, fontSize, '#ffffff', 1.2, FONT_COARSENESS);
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

    ctx.beginPath();
    ctx.moveTo(len / 2, 0);
    ctx.lineTo(-len / 2, -hw);
    ctx.lineTo(-len / 2, hw);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-len / 2, -hw, nr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-len / 2, hw, nr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
