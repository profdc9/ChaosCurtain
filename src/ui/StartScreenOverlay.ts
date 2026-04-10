import * as ex from 'excalibur';
import { GAME, ROOM } from '../constants';
import { StrokeFont } from './StrokeFont';

/**
 * Full-screen overlay shown at startup. Sits above all game actors (z=1000).
 * Call dismiss() to remove it — triggered by the first user gesture.
 */
export class StartScreenOverlay extends ex.Actor {
  private readonly overlayCanvas: ex.Canvas;

  constructor() {
    super({
      pos:           ex.vec(0, 0),
      anchor:        ex.vec(0, 0),
      collisionType: ex.CollisionType.PreventCollision,
      z:             1000,
    });

    this.overlayCanvas = new ex.Canvas({
      width:  GAME.WIDTH,
      height: GAME.HEIGHT,
      cache:  true,
      draw:   (ctx) => this.drawOverlay(ctx),
    });
    this.graphics.use(this.overlayCanvas);
    this.graphics.anchor = ex.vec(0, 0);
  }

  dismiss(): void {
    this.kill();
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    const w    = GAME.WIDTH;
    const h    = GAME.HEIGHT;
    const midY = ROOM.HUD_HEIGHT + (h - ROOM.HUD_HEIGHT) / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const titleSize  = 72;
    const promptSize = 28;

    const titleText  = 'CHAOS CURTAIN';
    const promptText = 'PRESS ANY KEY OR CLICK TO START';

    const titleX  = (w - StrokeFont.measure(titleText,  titleSize))  / 2;
    const promptX = (w - StrokeFont.measure(promptText, promptSize)) / 2;

    StrokeFont.draw(ctx, titleText,  titleX,  midY - 80, titleSize,  ROOM.WALL_LINE_COLOR, 2.5);
    StrokeFont.draw(ctx, promptText, promptX, midY + 20, promptSize, '#ffffff', 1.5);
  }
}
