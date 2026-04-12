import * as ex from 'excalibur';
import { GAME, ROOM, DOOR, PLAYER, SPAWNER } from '../constants';
import { PickupActor } from '../actors/PickupActor';
import type { RoomDef, DoorDef, DoorSide } from './RoomDef';
import { EXIT_ROOM_ID, MAZE, START_ROOM_ID } from './MazeGraph';
import { DoorActor } from '../actors/DoorActor';
import { SpawnerActor } from '../actors/SpawnerActor';
import { GameEvents } from '../utils/GameEvents';
import { setCoopPassageWallClampBypass } from '../utils/CoopPassageClamp';

const OPPOSITE: Record<DoorSide, DoorSide> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

/** Player circle (center + radius) vs axis-aligned rectangle (inclusive edges). */
function circleIntersectsAabb(
  px: number,
  py: number,
  r: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const nx = Math.max(x0, Math.min(px, x1));
  const ny = Math.max(y0, Math.min(py, y1));
  const dx = px - nx;
  const dy = py - ny;
  return dx * dx + dy * dy <= r * r;
}

/** Segment (ax,ay)-(bx,by) vs axis-aligned rect (inclusive), Liang–Barsky. */
function segmentIntersectsAabb(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
): boolean {
  const xmin = Math.min(rx0, rx1);
  const xmax = Math.max(rx0, rx1);
  const ymin = Math.min(ry0, ry1);
  const ymax = Math.max(ry0, ry1);

  const dx = bx - ax;
  const dy = by - ay;
  let u0 = 0;
  let u1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > u1) return false;
      if (t > u0) u0 = t;
    } else {
      if (t < u0) return false;
      if (t < u1) u1 = t;
    }
    return true;
  };

  if (!clip(-dx, ax - xmin)) return false;
  if (!clip(dx, xmax - ax)) return false;
  if (!clip(-dy, ay - ymin)) return false;
  if (!clip(dy, ymax - ay)) return false;
  return u1 >= u0;
}

/** Disk sweep: segment of circle centers vs passage rect expanded by radius (conservative capsule vs AABB). */
function sweptDiskIntersectsPassage(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  return segmentIntersectsAabb(ax, ay, bx, by, x0 - r, y0 - r, x1 + r, y1 + r);
}

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
  /** Second coop ship — same `SharedPlayerState`; null for solo. */
  private readonly player2: ex.Actor | null;
  private roomActors: ex.Actor[] = [];
  private doors: DoorActor[] = [];
  /** Spawner machines + all live enemies they have produced. Room clears at 0. */
  private _liveCount = 0;
  private _currentRoomId = '';
  private _currentDifficulty = 0;
  private diedHandler: (() => void) | null = null;
  private readonly clearedRooms = new Set<string>();
  /** Room definition for the last `load` (used when live count hits 0). */
  private currentRoomDef: RoomDef | null = null;
  /** After `load`, where fleet-loss respawn sends the player (neighbor you entered this room from). */
  private deathReturnRoomId: string | null = null;
  private deathReturnEntranceSide: DoorSide | null = null;

  /**
   * Co-op: after an exit door finishes opening, both players must enter the passage zone
   * before `load` runs. `doorSide` blocks other exits until then.
   */
  private coopPending: {
    doorSide: DoorSide;
    targetDef: RoomDef;
    entranceSide: DoorSide;
    p1Passed: boolean;
    p2Passed: boolean;
    /** World-space exit strip (inflated); tested each frame after movement. */
    passageBounds: { x0: number; y0: number; x1: number; y1: number };
  } | null = null;

  /** Previous-frame player centers for swept co-op passage tests (avoids tunneling through thin band). */
  private coopPassagePrev: { p1: ex.Vector; p2: ex.Vector } | null = null;

  get liveCount(): number { return this._liveCount; }
  get currentRoomId(): string { return this._currentRoomId; }
  get currentDifficulty(): number { return this._currentDifficulty; }

  constructor(scene: ex.Scene, player: ex.Actor, player2: ex.Actor | null = null) {
    this.scene = scene;
    this.player = player;
    this.player2 = player2;
  }

  /** Remove `enemy:died` subscription when the owning scene is discarded (e.g. quit to menu). */
  detachGlobalListeners(): void {
    if (this.diedHandler) {
      GameEvents.off('enemy:died', this.diedHandler);
      this.diedHandler = null;
    }
  }

  private pickTargetPlayer(from: ex.Vector): ex.Actor {
    if (!this.player2) return this.player;
    const d1 = from.distance(this.player.pos);
    const d2 = from.distance(this.player2.pos);
    return d1 <= d2 ? this.player : this.player2;
  }

  /**
   * After physics/movement each frame: co-op exit requires both player **bodies** (circle colliders)
   * to overlap an inflated passage rect. Passive trigger actors were unreliable vs update order.
   */
  tickCoopPassageOverlap(): void {
    const pending = this.coopPending;
    if (!pending?.passageBounds || !this.player2) return;
    const b = pending.passageBounds;
    const r = PLAYER.COLLIDER_RADIUS;
    const prev = this.coopPassagePrev;

    const hitP1 =
      circleIntersectsAabb(this.player.pos.x, this.player.pos.y, r, b.x0, b.y0, b.x1, b.y1) ||
      (prev !== null &&
        sweptDiskIntersectsPassage(
          prev.p1.x, prev.p1.y, this.player.pos.x, this.player.pos.y, r,
          b.x0, b.y0, b.x1, b.y1,
        ));
    if (hitP1) {
      this.onCoopPassageTouch(this.player);
    }

    if (!this.coopPending) return;

    const hitP2 =
      circleIntersectsAabb(this.player2.pos.x, this.player2.pos.y, r, b.x0, b.y0, b.x1, b.y1) ||
      (prev !== null &&
        sweptDiskIntersectsPassage(
          prev.p2.x, prev.p2.y, this.player2.pos.x, this.player2.pos.y, r,
          b.x0, b.y0, b.x1, b.y1,
        ));
    if (hitP2) {
      this.onCoopPassageTouch(this.player2);
    }

    if (this.coopPending) {
      this.coopPassagePrev = {
        p1: this.player.pos.clone(),
        p2: this.player2.pos.clone(),
      };
    }
  }

  /**
   * Tear down the current room and build a new one.
   * @param roomDef      Definition of the room to load.
   * @param entranceSide The side the player enters through, or null for the start room.
   */
  load(roomDef: RoomDef, entranceSide: DoorSide | null): void {
    this.coopPending = null;
    this.coopPassagePrev = null;
    setCoopPassageWallClampBypass(false);

    // Remove all current room actors.
    // Guard against actors that were queued via scene.add() but not yet
    // processed by Excalibur's EntityManager — calling kill() on those
    // logs "never added to the Scene" warnings and is a no-op anyway.
    for (const actor of this.roomActors) {
      if (actor.scene !== null) actor.kill();
    }
    this.roomActors = [];
    this.doors = [];
    this._liveCount = 0;

    if (this.diedHandler) {
      GameEvents.off('enemy:died', this.diedHandler);
      this.diedHandler = null;
    }

    // Build new room.
    this.currentRoomDef = roomDef;
    // Re-allow an empty-exit `game:won` after a victory once the player returns to the maze entry.
    if (roomDef.id === START_ROOM_ID) {
      this.clearedRooms.delete(EXIT_ROOM_ID);
    }
    this._currentRoomId = roomDef.id;
    this._currentDifficulty = roomDef.difficulty;

    const bossTypes = new Set(['bird_boss', 'snake_boss', 'zapsphere_boss', 'glitch_boss']);
    const isBoss = roomDef.spawners.some(s => bossTypes.has(s.type));
    GameEvents.emit('room:entered', { isBoss });

    this.buildWalls(roomDef);
    this.buildDoors(roomDef, entranceSide);

    const alreadyCleared = this.clearedRooms.has(roomDef.id);

    if (!alreadyCleared) {
      this.spawnMachines(roomDef); // increments _liveCount for each machine placed
    }

    // Position player(s).
    if (entranceSide !== null) {
      const base = entryPos(entranceSide);
      if (this.player2) {
        this.player.pos = base.add(ex.vec(-34, 0));
        this.player2.pos = base.add(ex.vec(34, 0));
        this.player2.vel = ex.Vector.Zero;
      } else {
        this.player.pos = base;
      }
      this.player.vel = ex.Vector.Zero;
    }

    if (this._liveCount === 0) {
      if (alreadyCleared) {
        this.openDoorsWithoutClearFanfare();
      } else {
        this.unlockAfterAllEnemiesGone(roomDef);
      }
    } else {
      this.diedHandler = () => {
        this._liveCount = Math.max(0, this._liveCount - 1);
        if (this._liveCount === 0 && this.currentRoomDef) {
          this.unlockAfterAllEnemiesGone(this.currentRoomDef);
        }
      };
      GameEvents.on('enemy:died', this.diedHandler);
    }

    this.updateDeathReturnAnchor(roomDef, entranceSide);
  }

  /**
   * After losing a ship while `fleet > 0`: strip cleared flag from the death room,
   * then load the room we had entered the death room from (doors re-lock as fresh).
   */
  respawnAfterFleetLoss(deathRoomId: string): void {
    this.clearedRooms.delete(deathRoomId);
    const id = this.deathReturnRoomId;
    const side = this.deathReturnEntranceSide;
    const def = id ? MAZE[id] : undefined;
    if (def) {
      this.load(def, side);
    } else if (MAZE[START_ROOM_ID]) {
      this.load(MAZE[START_ROOM_ID], null);
    }
  }

  /** Forget which rooms were cleared (e.g. after a full maze victory). */
  clearClearedRooms(): void {
    this.clearedRooms.clear();
  }

  /** Mark a room as cleared without combat (e.g. new maze exit after a win). */
  markRoomCleared(roomId: string): void {
    this.clearedRooms.add(roomId);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Register an actor as owned by this room (added to scene + tracked for cleanup). */
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
        !isEntrance,  // locked: exits locked until room cleared; entry always unlocked
        () => this.onDoorFullyOpened(doorDef),
        () => this.canPlayerStartOpeningDoor(doorDef),
      );
      this.doors.push(door);
      this.add(door);
    }
  }

  /** Solo: transition immediately. Co-op: arm passage bounds; `load` runs when both circles overlap the rect. */
  private onDoorFullyOpened(doorDef: DoorDef): void {
    const targetDef = MAZE[doorDef.targetRoomId];
    if (!targetDef) return;

    if (!this.player2) {
      this.load(targetDef, OPPOSITE[doorDef.side]);
      return;
    }

    if (this.coopPending) return;

    const entranceSide = OPPOSITE[doorDef.side];
    this.coopPending = {
      doorSide: doorDef.side,
      targetDef,
      entranceSide,
      p1Passed: false,
      p2Passed: false,
      passageBounds: this.coopPassageWorldBoundsInflated(doorDef.side),
    };
    setCoopPassageWallClampBypass(true);
    this.coopPassagePrev = {
      p1: this.player.pos.clone(),
      p2: this.player2.pos.clone(),
    };
  }

  /** While waiting for co-op passage, only the active exit remains openable (others stay idle). */
  private canPlayerStartOpeningDoor(doorDef: DoorDef): boolean {
    if (!this.player2) return true;
    if (!this.coopPending) return true;
    return doorDef.side === this.coopPending.doorSide;
  }

  /**
   * Inflated world AABB so both ships' circle colliders register when hugging the doorway;
   * extends slightly past the inner wall line toward the gap (fixes “walk away then back” counting).
   */
  private coopPassageWorldBoundsInflated(side: DoorSide): { x0: number; y0: number; x1: number; y1: number } {
    const pad = PLAYER.COLLIDER_RADIUS + 12;
    const ex = DOOR.COOP_PASSAGE_EXITWARD;
    const depth = DOOR.COOP_PASSAGE_DEPTH + pad;
    const inset = DOOR.COOP_PASSAGE_WALL_INSET;
    const midX = (ROOM.INNER_LEFT + ROOM.INNER_RIGHT) / 2;
    const midY = (ROOM.INNER_TOP + ROOM.INNER_BOTTOM) / 2;
    const gw = DOOR.WIDTH + 2 * pad;

    switch (side) {
      case 'north': {
        const y0 = ROOM.INNER_TOP - pad - ex;
        const y1 = ROOM.INNER_TOP + inset + depth;
        return { x0: midX - gw / 2, x1: midX + gw / 2, y0, y1 };
      }
      case 'south': {
        const y0 = ROOM.INNER_BOTTOM - inset - depth;
        const y1 = ROOM.INNER_BOTTOM + pad + ex;
        return { x0: midX - gw / 2, x1: midX + gw / 2, y0, y1 };
      }
      case 'west': {
        const x0 = ROOM.INNER_LEFT - pad - ex;
        const x1 = ROOM.INNER_LEFT + inset + depth;
        return { x0, x1, y0: midY - gw / 2, y1: midY + gw / 2 };
      }
      case 'east': {
        const x0 = ROOM.INNER_RIGHT - inset - depth;
        const x1 = ROOM.INNER_RIGHT + pad + ex;
        return { x0, x1, y0: midY - gw / 2, y1: midY + gw / 2 };
      }
    }
  }

  private onCoopPassageTouch(actor: ex.Actor): void {
    if (!this.coopPending || !this.player2) return;
    if (actor === this.player) this.coopPending.p1Passed = true;
    else if (actor === this.player2) this.coopPending.p2Passed = true;
    else return;

    if (this.coopPending.p1Passed && this.coopPending.p2Passed) {
      const { targetDef, entranceSide } = this.coopPending;
      this.coopPending = null;
      this.coopPassagePrev = null;
      this.load(targetDef, entranceSide);
    }
  }

  /** Re-entering a room that was already cleared: open doors, no `room:cleared` SFX. */
  private openDoorsWithoutClearFanfare(): void {
    for (const door of this.doors) {
      door.unlock();
    }
  }

  /** First time this room goes from contested → empty: fanfare once; empty exit skips `room:cleared` but still wins. */
  private unlockAfterAllEnemiesGone(roomDef: RoomDef): void {
    const firstClear = !this.clearedRooms.has(this._currentRoomId);
    this.clearedRooms.add(this._currentRoomId);
    const spawnerMachines = roomDef.spawners.reduce((n, s) => n + s.count, 0);
    const emptyExit = roomDef.isExit && spawnerMachines === 0;
    if (firstClear && !emptyExit) {
      GameEvents.emit('room:cleared', {});
    }
    if (firstClear && !emptyExit && spawnerMachines > 0) {
      const p = Math.min(
        ROOM.EXTRA_LIFE_ON_CLEAR_PROB_CAP,
        ROOM.EXTRA_LIFE_ON_CLEAR_BASE + ROOM.EXTRA_LIFE_ON_CLEAR_PER_DIFF * roomDef.difficulty,
      );
      if (Math.random() < p) {
        this.spawnRoomClearBonusExtraLife();
      }
    }
    if (roomDef.isExit && firstClear) {
      GameEvents.emit('game:won', {});
    }
    for (const door of this.doors) {
      door.unlock();
    }
  }

  private updateDeathReturnAnchor(roomDef: RoomDef, entranceSide: DoorSide | null): void {
    if (entranceSide !== null) {
      const door = roomDef.doors.find((d) => d.side === entranceSide);
      if (door) {
        this.deathReturnRoomId = door.targetRoomId;
        this.deathReturnEntranceSide = OPPOSITE[entranceSide];
      }
    } else {
      this.deathReturnRoomId = roomDef.id;
      this.deathReturnEntranceSide = null;
    }
  }

  /** Bonus pickup is room-owned so it is removed on the next room transition. */
  private spawnRoomClearBonusExtraLife(): void {
    const M = 80;
    const x =
      ROOM.INNER_LEFT +
      M +
      Math.random() * (ROOM.INNER_RIGHT - ROOM.INNER_LEFT - 2 * M);
    const y =
      ROOM.INNER_TOP +
      M +
      Math.random() * (ROOM.INNER_BOTTOM - ROOM.INNER_TOP - 2 * M);
    this.add(new PickupActor(x, y, 'extraLife'));
  }

  private spawnMachines(roomDef: RoomDef): void {
    // Place machines at the four corners and center, far from doors (which sit at wall midpoints).
    // Shuffle so successive machines cycle through distinct positions.
    const CM = 100; // corner margin from inner wall edges
    const L = ROOM.INNER_LEFT  + CM;
    const R = ROOM.INNER_RIGHT - CM;
    const T = ROOM.INNER_TOP   + CM;
    const B = ROOM.INNER_BOTTOM - CM;
    const cx = (ROOM.INNER_LEFT + ROOM.INNER_RIGHT) / 2;
    const cy = (ROOM.INNER_TOP  + ROOM.INNER_BOTTOM) / 2;

    const candidates = [
      ex.vec(L, T), ex.vec(R, T), ex.vec(L, B), ex.vec(R, B), ex.vec(cx, cy),
    ].sort(() => Math.random() - 0.5);

    let posIdx = 0;
    const nextPos = (): ex.Vector => {
      const base = candidates[posIdx % candidates.length];
      posIdx++;
      // Small jitter so stacked machines don't sit exactly on top of each other
      const jx = (Math.random() - 0.5) * 40;
      const jy = (Math.random() - 0.5) * 40;
      return ex.vec(base.x + jx, base.y + jy);
    };

    const interval =
      SPAWNER.SPAWN_INTERVAL_SLOW +
      (SPAWNER.SPAWN_INTERVAL_FAST - SPAWNER.SPAWN_INTERVAL_SLOW) * roomDef.difficulty;

    for (const spawnDef of roomDef.spawners) {
      for (let i = 0; i < spawnDef.count; i++) {
        const pos = nextPos();
        const spawner = new SpawnerActor(
          pos.x, pos.y,
          spawnDef.type,
          interval,
          roomDef.difficulty,
          (from) => this.pickTargetPlayer(from),
          (actor) => {
            this._liveCount++;
            this.add(actor);
          },
          () => this._liveCount,
          spawnDef.oneShot ?? false,
        );
        this._liveCount++;
        this.add(spawner);
      }
    }
  }
}
