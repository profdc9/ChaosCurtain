import * as ex from 'excalibur';
import { GAME, ROOM, DOOR, WANDERER } from '../constants';
import type { RoomDef, DoorDef, DoorSide } from './RoomDef';
import { MAZE } from './MazeGraph';
import { DoorActor } from '../actors/DoorActor';
import { WandererActor } from '../actors/enemies/WandererActor';
import { GameEvents } from '../utils/GameEvents';

const OPPOSITE: Record<DoorSide, DoorSide> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

/** Centre of the door gap on each wall's inner boundary. */
function doorPos(side: DoorSide): ex.Vector {
  const midX = (ROOM.INNER_LEFT + ROOM.INNER_RIGHT) / 2;
  const midY = (ROOM.INNER_TOP + ROOM.INNER_BOTTOM) / 2;
  const wh = ROOM.WALL_THICKNESS / 2;
  switch (side) {
    case 'north': return ex.vec(midX, ROOM.INNER_TOP - wh);
    case 'south': return ex.vec(midX, ROOM.INNER_BOTTOM + wh);
    case 'east':  return ex.vec(ROOM.INNER_RIGHT + wh, midY);
    case 'west':  return ex.vec(ROOM.INNER_LEFT - wh, midY);
  }
}

/** Where the player appears after entering through a given side. */
function entryPos(side: DoorSide): ex.Vector {
  const midX = (ROOM.INNER_LEFT + ROOM.INNER_RIGHT) / 2;
  const midY = (ROOM.INNER_TOP + ROOM.INNER_BOTTOM) / 2;
  const o = DOOR.ENTRY_OFFSET;
  switch (side) {
    case 'north': return ex.vec(midX, ROOM.INNER_TOP + o);
    case 'south': return ex.vec(midX, ROOM.INNER_BOTTOM - o);
    case 'east':  return ex.vec(ROOM.INNER_RIGHT - o, midY);
    case 'west':  return ex.vec(ROOM.INNER_LEFT + o, midY);
  }
}

export class RoomManager {
  private readonly scene: ex.Scene;
  private readonly player: ex.Actor;
  private roomActors: ex.Actor[] = [];
  private doors: DoorActor[] = [];
  private enemyCount = 0;
  private diedHandler: (() => void) | null = null;

  constructor(scene: ex.Scene, player: ex.Actor) {
    this.scene = scene;
    this.player = player;
  }

  /**
   * Tear down the current room and build a new one.
   * @param roomDef     Definition of the room to load.
   * @param entranceSide  The side of the new room the player enters through,
   *                      or null for the starting room (player placed at centre).
   */
  load(roomDef: RoomDef, entranceSide: DoorSide | null): void {
    // Remove all current room actors.
    for (const actor of this.roomActors) {
      actor.kill();
    }
    this.roomActors = [];
    this.doors = [];

    if (this.diedHandler) {
      GameEvents.off('enemy:died', this.diedHandler);
      this.diedHandler = null;
    }

    // Build new room.
    this.buildWalls(roomDef);
    this.buildDoors(roomDef, entranceSide);
    this.spawnEnemies(roomDef);

    // Position player.
    if (entranceSide !== null) {
      this.player.pos = entryPos(entranceSide);
      this.player.vel = ex.Vector.Zero;
    }

    // Watch for enemy deaths to check room clear.
    this.enemyCount = roomDef.enemies.reduce((sum, e) => sum + e.count, 0);

    if (this.enemyCount === 0) {
      this.unlockDoors();
    } else {
      this.diedHandler = () => {
        this.enemyCount = Math.max(0, this.enemyCount - 1);
        if (this.enemyCount === 0) this.unlockDoors();
      };
      GameEvents.on('enemy:died', this.diedHandler);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Register an actor as owned by this room (added to scene + tracked). */
  private add(actor: ex.Actor): void {
    this.scene.add(actor);
    this.roomActors.push(actor);
  }

  private buildWalls(roomDef: RoomDef): void {
    const doorSides = new Set(roomDef.doors.map((d) => d.side));

    // Visual canvas: heavy light-blue lines with gaps for doors.
    const canvas = new ex.Canvas({
      width: GAME.WIDTH,
      height: GAME.HEIGHT,
      cache: true,
      draw: (ctx) => this.drawWalls(ctx, doorSides),
    });
    const bg = new ex.Actor({ pos: ex.vec(0, 0), anchor: ex.vec(0, 0), z: -1 });
    bg.graphics.use(canvas);
    bg.graphics.anchor = ex.vec(0, 0);
    this.add(bg);

    // Invisible Fixed colliders for each wall side.
    for (const side of ['north', 'south', 'east', 'west'] as DoorSide[]) {
      this.buildWallColliders(side, doorSides.has(side));
    }
  }

  private drawWalls(ctx: CanvasRenderingContext2D, doorSides: Set<DoorSide>): void {
    const w = GAME.WIDTH;
    const h = GAME.HEIGHT;
    ctx.clearRect(0, 0, w, h);

    // Black background for entire play area.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, ROOM.HUD_HEIGHT, w, h - ROOM.HUD_HEIGHT);

    ctx.strokeStyle = ROOM.WALL_LINE_COLOR;
    ctx.lineWidth = 3;
    ctx.lineCap = 'square';

    const L = ROOM.INNER_LEFT;
    const R = ROOM.INNER_RIGHT;
    const T = ROOM.INNER_TOP;
    const B = ROOM.INNER_BOTTOM;
    const gHalf = DOOR.WIDTH / 2;
    const midX = (L + R) / 2;
    const midY = (T + B) / 2;

    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    if (doorSides.has('north')) {
      seg(L, T, midX - gHalf, T);
      seg(midX + gHalf, T, R, T);
    } else {
      seg(L, T, R, T);
    }

    if (doorSides.has('south')) {
      seg(L, B, midX - gHalf, B);
      seg(midX + gHalf, B, R, B);
    } else {
      seg(L, B, R, B);
    }

    if (doorSides.has('west')) {
      seg(L, T, L, midY - gHalf);
      seg(L, midY + gHalf, L, B);
    } else {
      seg(L, T, L, B);
    }

    if (doorSides.has('east')) {
      seg(R, T, R, midY - gHalf);
      seg(R, midY + gHalf, R, B);
    } else {
      seg(R, T, R, B);
    }
  }

  private buildWallColliders(side: DoorSide, hasDoor: boolean): void {
    const wt = ROOM.WALL_THICKNESS;
    const L = ROOM.INNER_LEFT;
    const R = ROOM.INNER_RIGHT;
    const T = ROOM.INNER_TOP;
    const B = ROOM.INNER_BOTTOM;
    const gHalf = DOOR.WIDTH / 2;
    const midX = (L + R) / 2;
    const midY = (T + B) / 2;

    const seg = (cx: number, cy: number, width: number, height: number) => {
      const wall = new ex.Actor({ pos: ex.vec(cx, cy), collisionType: ex.CollisionType.Fixed });
      wall.collider.useBoxCollider(width, height);
      this.add(wall);
    };

    if (side === 'north') {
      const cy = T - wt / 2;
      if (hasDoor) {
        seg((L + midX - gHalf) / 2, cy, midX - gHalf - L, wt);
        seg((midX + gHalf + R) / 2, cy, R - (midX + gHalf), wt);
      } else {
        seg((L + R) / 2, cy, R - L, wt);
      }
    } else if (side === 'south') {
      const cy = B + wt / 2;
      if (hasDoor) {
        seg((L + midX - gHalf) / 2, cy, midX - gHalf - L, wt);
        seg((midX + gHalf + R) / 2, cy, R - (midX + gHalf), wt);
      } else {
        seg((L + R) / 2, cy, R - L, wt);
      }
    } else if (side === 'west') {
      const cx = L - wt / 2;
      if (hasDoor) {
        seg(cx, (T + midY - gHalf) / 2, wt, midY - gHalf - T);
        seg(cx, (midY + gHalf + B) / 2, wt, B - (midY + gHalf));
      } else {
        seg(cx, (T + B) / 2, wt, B - T);
      }
    } else { // east
      const cx = R + wt / 2;
      if (hasDoor) {
        seg(cx, (T + midY - gHalf) / 2, wt, midY - gHalf - T);
        seg(cx, (midY + gHalf + B) / 2, wt, B - (midY + gHalf));
      } else {
        seg(cx, (T + B) / 2, wt, B - T);
      }
    }
  }

  private buildDoors(roomDef: RoomDef, entranceSide: DoorSide | null): void {
    for (const doorDef of roomDef.doors) {
      const isEntrance = doorDef.side === entranceSide;
      const door = new DoorActor(
        doorDef.side,
        doorPos(doorDef.side),
        isEntrance,   // startOpen: entry door animates closed; exits start closed
        !isEntrance,  // locked: exits locked until room cleared; entry always open
        () => this.onDoorOpened(doorDef),
      );
      this.doors.push(door);
      this.add(door);
    }
  }

  private onDoorOpened(doorDef: DoorDef): void {
    const targetDef = MAZE[doorDef.targetRoomId];
    if (!targetDef) return;
    this.load(targetDef, OPPOSITE[doorDef.side]);
  }

  private unlockDoors(): void {
    for (const door of this.doors) {
      door.unlock();
    }
  }

  private spawnEnemies(roomDef: RoomDef): void {
    const margin = WANDERER.COLLIDER_RADIUS + 20;
    const xMin = ROOM.INNER_LEFT + margin;
    const xMax = ROOM.INNER_RIGHT - margin;
    const yMin = ROOM.INNER_TOP + margin;
    const yMax = ROOM.INNER_BOTTOM - margin;

    for (const spawnDef of roomDef.enemies) {
      for (let i = 0; i < spawnDef.count; i++) {
        const x = xMin + Math.random() * (xMax - xMin);
        const y = yMin + Math.random() * (yMax - yMin);
        if (spawnDef.type === 'wanderer') {
          this.add(new WandererActor(x, y));
        }
      }
    }
  }
}
