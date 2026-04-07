import * as ex from 'excalibur';
import { GAME, ROOM, WANDERER } from '../constants';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { PlayerActor } from '../actors/PlayerActor';
import { WandererActor } from '../actors/enemies/WandererActor';
import { HUD } from '../ui/HUD';
import { GameEvents } from '../utils/GameEvents';

export class GameplayScene extends ex.Scene {
  private sharedState!: SharedPlayerState;

  onInitialize(engine: ex.Engine): void {
    this.sharedState = new SharedPlayerState();

    // Listen for score updates from enemy deaths
    GameEvents.on('enemy:died', (evt) => {
      this.sharedState.addScore(evt.points);
    });

    this.buildRoom(engine);

    const player = new PlayerActor(engine, this.sharedState);
    this.add(player);

    this.spawnWanderers(5);

    const hud = new HUD(this.sharedState);
    this.add(hud);
  }

  private buildRoom(engine: ex.Engine): void {
    const thickness = ROOM.WALL_THICKNESS;
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;
    const hudH = ROOM.HUD_HEIGHT;

    // Draw walls as a canvas overlay on a background actor
    const roomCanvas = new ex.Canvas({
      width: w,
      height: h,
      cache: true,
      draw: (ctx) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#111111';
        // Top wall (below HUD)
        ctx.fillRect(0, hudH, w, thickness);
        // Bottom wall
        ctx.fillRect(0, h - thickness, w, thickness);
        // Left wall
        ctx.fillRect(0, hudH, thickness, h - hudH);
        // Right wall
        ctx.fillRect(w - thickness, hudH, thickness, h - hudH);

        // Wall border lines in brighter color
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.strokeRect(thickness, hudH + thickness, w - thickness * 2, h - hudH - thickness * 2);
      },
    });

    const roomBg = new ex.Actor({
      pos: ex.vec(0, 0),
      anchor: ex.vec(0, 0),
      z: -1,
    });
    roomBg.graphics.use(roomCanvas);
    roomBg.graphics.anchor = ex.vec(0, 0);
    this.add(roomBg);
  }

  private spawnWanderers(count: number): void {
    const margin = WANDERER.COLLIDER_RADIUS + 20;
    const xMin = ROOM.INNER_LEFT + margin;
    const xMax = ROOM.INNER_RIGHT - margin;
    const yMin = ROOM.INNER_TOP + margin;
    const yMax = ROOM.INNER_BOTTOM - margin;

    for (let i = 0; i < count; i++) {
      const x = xMin + Math.random() * (xMax - xMin);
      const y = yMin + Math.random() * (yMax - yMin);
      this.add(new WandererActor(x, y));
    }
  }
}
