import * as ex from 'excalibur';
import { PICKUP, PLAYER } from '../constants';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { GameEvents } from '../utils/GameEvents';
import type { PickupType } from '../types/GameTypes';

/** Linearly interpolate between two hex color strings by factor t (0=a, 1=b). */
function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 0xff, ag = (pa >> 8) & 0xff, ab = pa & 0xff;
  const br = (pb >> 16) & 0xff, bg = (pb >> 8) & 0xff, bb = pb & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${b2})`;
}

export class PickupActor extends ex.Actor {
  readonly pickupType: PickupType;
  private flashTimer = 0;
  private readonly pickupCanvas: ex.Canvas;

  constructor(x: number, y: number, type: PickupType) {
    super({
      pos: ex.vec(x, y),
      collisionType: ex.CollisionType.Passive,
      radius: PICKUP.RADIUS,
    });
    this.pickupType = type;

    this.pickupCanvas = new ex.Canvas({
      width: PICKUP.CANVAS_SIZE,
      height: PICKUP.CANVAS_SIZE,
      cache: false,
      draw: (ctx) => this.drawPickup(ctx),
    });
    this.graphics.use(this.pickupCanvas);
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
      const other = evt.other as ex.Actor & { isPlayer?: boolean; sharedState?: SharedPlayerState };
      if (other.isPlayer && other.sharedState) {
        this.applyEffect(other.sharedState);
        this.kill();
      }
    });
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    this.flashTimer += delta / 1000;
  }

  private applyEffect(state: SharedPlayerState): void {
    GameEvents.emit('pickup:collected', { pickupType: this.pickupType });
    switch (this.pickupType) {
      case 'shooterType':
      case 'weaponPower':
      case 'shield':
      case 'panicButton':
        state.applyUpgrade(this.pickupType);
        break;
      case 'health':
        state.restoreHalfHealth();
        break;
      case 'extraLife':
        state.addExtraLife();
        break;
    }
  }

  private drawPickup(ctx: CanvasRenderingContext2D): void {
    const s = PICKUP.CANVAS_SIZE;
    const cx = s / 2;
    const cy = s / 2;
    const r = PICKUP.RADIUS;
    const ir = r * PICKUP.INTERIOR_SCALE;

    // Smooth sine fade between muted blue and 75% white
    const t = (Math.sin((this.flashTimer / PICKUP.FLASH_PERIOD) * Math.PI * 2) + 1) / 2;
    const outerColor = lerpColor(PICKUP.COLOR_A, PICKUP.COLOR_B, t);
    const innerColor = lerpColor(PICKUP.COLOR_A, PICKUP.COLOR_B, 1 - t);

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);

    // Outer circle
    ctx.strokeStyle = outerColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Interior graphic
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    this.drawInterior(ctx, innerColor, ir);

    ctx.restore();
  }

  private drawInterior(ctx: CanvasRenderingContext2D, color: string, ir: number): void {
    switch (this.pickupType) {
      case 'shooterType':   this.drawShooterIcon(ctx, color, ir);     break;
      case 'weaponPower':   this.drawWeaponPowerIcon(ctx, color, ir); break;
      case 'shield':        this.drawShieldIcon(ctx, color, ir);      break;
      case 'panicButton':   this.drawPanicIcon(ctx, color, ir);       break;
      case 'health':        this.drawHeartIcon(ctx, ir);              break; // always red
      case 'extraLife':     this.drawShipIcon(ctx, ir);               break; // always white
    }
  }

  // Shooter type: a dot with a line pointing right (suggests directional shot)
  private drawShooterIcon(ctx: CanvasRenderingContext2D, color: string, ir: number): void {
    ctx.strokeStyle = color;
    const dotX = ir * 0.65;
    ctx.beginPath();
    ctx.moveTo(-ir * 0.5, 0);
    ctx.lineTo(dotX - 3, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dotX, 0, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Weapon power: small square with dot inside (⊡ icon)
  private drawWeaponPowerIcon(ctx: CanvasRenderingContext2D, color: string, ir: number): void {
    ctx.strokeStyle = color;
    const h = ir * 0.6;
    ctx.strokeRect(-h, -h, h * 2, h * 2);
    ctx.beginPath();
    ctx.arc(0, 0, ir * 0.18, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Shield: square with X inside (⊠ icon)
  private drawShieldIcon(ctx: CanvasRenderingContext2D, color: string, ir: number): void {
    ctx.strokeStyle = color;
    const h = ir * 0.6;
    ctx.strokeRect(-h, -h, h * 2, h * 2);
    ctx.beginPath();
    ctx.moveTo(-h, -h);
    ctx.lineTo(h, h);
    ctx.moveTo(h, -h);
    ctx.lineTo(-h, h);
    ctx.stroke();
  }

  // Panic button: top hat shape
  private drawPanicIcon(ctx: CanvasRenderingContext2D, color: string, ir: number): void {
    ctx.strokeStyle = color;
    const brimW = ir * 0.85;
    const brimH = ir * 0.18;
    const crownW = ir * 0.48;
    const crownH = ir * 0.65;
    const brimY = ir * 0.2;
    // Brim: wide flat rectangle at bottom
    ctx.strokeRect(-brimW, brimY - brimH, brimW * 2, brimH);
    // Crown: taller narrower rectangle rising above brim
    ctx.strokeRect(-crownW, brimY - brimH - crownH, crownW * 2, crownH);
  }

  // Health: red heart (two top arcs + two slanted lines to a bottom point)
  private drawHeartIcon(_ctx: CanvasRenderingContext2D, ir: number): void {
    const ctx = _ctx;
    ctx.strokeStyle = '#ff4444';
    const r = ir * 0.38;
    const topY = -ir * 0.12;
    const tipY = ir * 0.62;

    // Left top bump: counterclockwise arc from (0,topY) up and over to (-2r,topY)
    ctx.beginPath();
    ctx.arc(-r, topY, r, 0, Math.PI, true);
    ctx.stroke();

    // Right top bump: clockwise arc from (0,topY) up and over to (2r,topY)
    ctx.beginPath();
    ctx.arc(r, topY, r, Math.PI, 0, false);
    ctx.stroke();

    // Left side: from bottom of left arc down to tip
    ctx.beginPath();
    ctx.moveTo(-2 * r, topY);
    ctx.lineTo(0, tipY);
    ctx.stroke();

    // Right side: from bottom of right arc down to tip
    ctx.beginPath();
    ctx.moveTo(2 * r, topY);
    ctx.lineTo(0, tipY);
    ctx.stroke();
  }

  // Extra life: miniature white ship (triangle + nacelles)
  private drawShipIcon(ctx: CanvasRenderingContext2D, ir: number): void {
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'round';
    const len = ir * 1.1;
    const hw  = ir * 0.42;
    const nr  = ir * 0.16;

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
  }
}
