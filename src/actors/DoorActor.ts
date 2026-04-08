import * as ex from 'excalibur';
import { DOOR, ROOM } from '../constants';
import type { DoorSide } from '../rooms/RoomDef';

/**
 * A door is a white bar drawn across a gap in the wall.
 *
 * States:
 *  - Closed + locked   → Fixed collider, full-length bar, player touch does nothing
 *  - Closed + unlocked → Fixed collider, full-length bar, player touch starts opening
 *  - Opening           → PreventCollision, bar shrinks along its long axis
 *  - Fully open        → fires onOpened() callback → room transition
 *
 * Entry doors start fully open (bar length = 0) and immediately animate closed.
 * Once closed, the entry door is unlocked so the player can flee back.
 */
export class DoorActor extends ex.Actor {
  // 1 = fully closed (full bar), 0 = fully open (no bar)
  private progress: number;
  private locked: boolean;
  // -1 = opening (progress → 0), 0 = idle, +1 = closing (progress → 1)
  private animDir = 0;
  private readonly side: DoorSide;
  private readonly onOpened: () => void;

  constructor(
    side: DoorSide,
    pos: ex.Vector,
    startOpen: boolean,
    locked: boolean,
    onOpened: () => void,
  ) {
    // Actor positioned at the wall collider centre (8px inside the wall from the inner edge).
    // The graphics are offset outward so the visual bar sits on the inner wall boundary.
    super({ pos, collisionType: ex.CollisionType.Fixed });

    this.side = side;
    this.locked = locked;
    this.onOpened = onOpened;
    this.progress = startOpen ? 0 : 1;

    // Box collider sized to fill the door gap × wall thickness, centred on actor.
    const isNS = side === 'north' || side === 'south';
    this.collider.useBoxCollider(
      isNS ? DOOR.WIDTH : ROOM.WALL_THICKNESS,
      isNS ? ROOM.WALL_THICKNESS : DOOR.WIDTH,
    );

    // Entry doors start open: no collision until they animate closed.
    if (startOpen) {
      this.body.collisionType = ex.CollisionType.PreventCollision;
      this.animDir = 1; // animate → closed
    }

    // Offset graphics so the bar appears on the inner wall edge rather than the
    // collider centre (which is half a wall-thickness inside the wall).
    const wh = ROOM.WALL_THICKNESS / 2;
    const graphicsOffset =
      side === 'north' ? ex.vec(0, wh) :
      side === 'south' ? ex.vec(0, -wh) :
      side === 'east'  ? ex.vec(-wh, 0) :
                         ex.vec(wh, 0);

    const canvas = new ex.Canvas({
      width: DOOR.CANVAS_SIZE,
      height: DOOR.CANVAS_SIZE,
      cache: false,
      draw: (ctx) => this.drawBar(ctx),
    });
    this.graphics.use(canvas);
    this.graphics.offset = graphicsOffset;
  }

  unlock(): void {
    this.locked = false;
  }

  onInitialize(_engine: ex.Engine): void {
    this.on('collisionstart', (evt) => {
      const other = evt.other as ex.Actor & { isPlayer?: boolean };
      if (other.isPlayer && !this.locked && this.animDir === 0 && this.progress >= 1) {
        this.animDir = -1;
        this.body.collisionType = ex.CollisionType.PreventCollision;
      }
    });
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    if (this.animDir === 0) return;

    const dt = delta / 1000;
    this.progress = Math.max(0, Math.min(1, this.progress + this.animDir * DOOR.OPEN_SPEED * dt));

    if (this.animDir < 0 && this.progress <= 0) {
      this.animDir = 0;
      this.onOpened(); // trigger room transition
    } else if (this.animDir > 0 && this.progress >= 1) {
      this.animDir = 0;
      this.body.collisionType = ex.CollisionType.Fixed; // seal the entry door
    }
  }

  private drawBar(ctx: CanvasRenderingContext2D): void {
    const s = DOOR.CANVAS_SIZE;
    ctx.clearRect(0, 0, s, s);
    if (this.progress <= 0) return;

    ctx.save();
    ctx.strokeStyle = this.locked ? '#ffffff' : '#00ff00';
    ctx.lineWidth = 1.5;

    const half = s / 2;
    const longSide = DOOR.WIDTH * this.progress; // animating dimension
    const shortSide = DOOR.BAR_THICKNESS;        // fixed dimension

    const isNS = this.side === 'north' || this.side === 'south';
    const rectW = isNS ? longSide : shortSide;
    const rectH = isNS ? shortSide : longSide;

    ctx.strokeRect(half - rectW / 2, half - rectH / 2, rectW, rectH);
    ctx.restore();
  }
}
