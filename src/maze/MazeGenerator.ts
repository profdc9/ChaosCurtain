import { SeededRandom } from '../utils/SeededRandom';
import type { RoomDef, SpawnerDef, DoorSide, SpawnEnemyType } from '../rooms/RoomDef';
import { MAZE_GEN } from '../constants';

const { MIN_SPAWNER_MACHINES_PER_ROOM: MIN_MACHINES } = MAZE_GEN;

function totalSpawnerMachines(spawners: SpawnerDef[]): number {
  return spawners.reduce((n, s) => n + s.count, 0);
}

/** Ensure at least `min` spawner actors; pad with extra wanderer machines. */
function ensureMinSpawnerMachines(result: SpawnerDef[], min: number): void {
  while (totalSpawnerMachines(result) < min) {
    const w = result.find((s) => s.type === 'wanderer');
    if (w) w.count += 1;
    else result.push({ type: 'wanderer', count: 1 });
  }
}

export interface MazeResult {
  rooms: Record<string, RoomDef>;
  startRoomId: string;
  exitRoomId: string;
}

const DIRS: { dx: number; dy: number; side: DoorSide; opposite: DoorSide }[] = [
  { dx: 0, dy: -1, side: 'north', opposite: 'south' },
  { dx: 0, dy:  1, side: 'south', opposite: 'north' },
  { dx: -1, dy: 0, side: 'west',  opposite: 'east'  },
  { dx:  1, dy: 0, side: 'east',  opposite: 'west'  },
];

function cellId(col: number, row: number): string {
  return `room_c${col}_r${row}`;
}

/**
 * BFS from (startCol, startRow) returning a distance map for every reachable cell.
 */
function bfsDistances(
  startCol: number,
  startRow: number,
  connections: Map<string, Set<string>>,
): Map<string, number> {
  const dist = new Map<string, number>();
  const start = cellId(startCol, startRow);
  const queue: string[] = [start];
  dist.set(start, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const d = dist.get(current)!;
    for (const neighbor of connections.get(current) ?? []) {
      if (!dist.has(neighbor)) {
        dist.set(neighbor, d + 1);
        queue.push(neighbor);
      }
    }
  }

  return dist;
}

/**
 * Build spawner machine definitions for a room based on difficulty (0 = easy, 1 = hardest).
 * Every room gets at least {@link MAZE_GEN.MIN_SPAWNER_MACHINES_PER_ROOM} machines.
 * Blasters appear in all tiers with rising probability / guaranteed presence on harder rooms.
 */
function buildSpawners(difficulty: number, rng: SeededRandom, bossType?: SpawnEnemyType): SpawnerDef[] {
  const { EASY_TIER, MED_TIER } = MAZE_GEN;
  const result: SpawnerDef[] = [];

  if (bossType) {
    // Boss room: boss spawner (one-shot) + fodder spawners
    result.push({ type: bossType, count: 1, oneShot: true });
    result.push({ type: 'wanderer', count: 1 });
    if (difficulty >= 0.5) result.push({ type: 'dart', count: 1 });
    if (difficulty >= 0.35 && !result.some((s) => s.type === 'blaster')) {
      result.push({ type: 'blaster', count: 1 });
    }
    ensureMinSpawnerMachines(result, MIN_MACHINES);
    return result;
  }

  if (difficulty < EASY_TIER) {
    result.push({ type: 'wanderer', count: rng.nextInt(1, 2) });
    if (rng.nextBool(0.33)) result.push({ type: 'worm', count: 1 });
    if (rng.nextBool(0.28)) result.push({ type: 'blaster', count: 1 });
  } else if (difficulty < MED_TIER) {
    result.push({ type: 'wanderer', count: 1 });
    result.push({ type: 'dart', count: 1 });
    result.push({ type: 'worm', count: 1 });
    if (rng.nextBool(0.30)) result.push({ type: 'wrangler', count: 1 });
    result.push({ type: 'blaster', count: 1 });
  } else {
    result.push({ type: 'wanderer', count: 1 });
    result.push({ type: 'dart', count: rng.nextInt(1, 2) });
    result.push({ type: 'worm', count: 1 });
    result.push({ type: 'satellite', count: 1 });
    result.push({ type: 'blaster', count: 1 });
    if (rng.nextBool(0.55)) result.push({ type: 'blaster', count: 1 });
    if (rng.nextBool(0.45)) result.push({ type: 'wrangler', count: 1 });
  }

  ensureMinSpawnerMachines(result, MIN_MACHINES);
  return result;
}

/** Exit cell: combat finale before victory (was empty). */
function buildExitRoomSpawners(difficulty: number, rng: SeededRandom): SpawnerDef[] {
  const result: SpawnerDef[] = [
    { type: 'wanderer', count: 1 },
    { type: 'dart', count: 1 },
    { type: 'worm', count: 1 },
  ];
  if (difficulty >= 0.35) result.push({ type: 'satellite', count: 1 });
  if (difficulty >= 0.5) result.push({ type: 'wrangler', count: 1 });
  result.push({ type: 'blaster', count: 1 });
  if (difficulty >= 0.75 && rng.nextBool(0.5)) {
    result.push({ type: 'blaster', count: 1 });
  }
  ensureMinSpawnerMachines(result, MIN_MACHINES);
  return result;
}

/**
 * Generate a perfect maze on a gridW×gridH grid using recursive backtracking (DFS).
 *
 * - Start room: (0, 0)
 * - Exit room: the cell farthest from start by graph distance (BFS)
 * - Difficulty: normalized BFS distance from exit (0.0 = far from exit = easy,
 *   1.0 = at exit = hardest)
 * - Enemy mix scales with difficulty; exit room is a short finale (`buildExitRoomSpawners`).
 */
export function generateMaze(seed: number, gridW: number, gridH: number): MazeResult {
  const rng = new SeededRandom(seed);

  // ── 1. Build adjacency map (all walls intact to start) ──────────────────────
  const connections = new Map<string, Set<string>>();
  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      connections.set(cellId(c, r), new Set());
    }
  }

  // ── 2. Recursive backtracking DFS to carve passages ─────────────────────────
  const visited = new Set<string>();

  function dfs(col: number, row: number): void {
    const id = cellId(col, row);
    visited.add(id);

    const dirs = [...DIRS];
    rng.shuffle(dirs);

    for (const { dx, dy } of dirs) {
      const nc = col + dx;
      const nr = row + dy;
      if (nc < 0 || nc >= gridW || nr < 0 || nr >= gridH) continue;
      const nid = cellId(nc, nr);
      if (visited.has(nid)) continue;

      connections.get(id)!.add(nid);
      connections.get(nid)!.add(id);
      dfs(nc, nr);
    }
  }

  dfs(0, 0);

  // ── 3. Find exit: farthest cell from (0,0) by BFS ───────────────────────────
  const distFromStart = bfsDistances(0, 0, connections);
  let maxDist = 0;
  let exitCol = 0;
  let exitRow = 0;
  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const d = distFromStart.get(cellId(c, r)) ?? 0;
      if (d > maxDist) {
        maxDist = d;
        exitCol = c;
        exitRow = r;
      }
    }
  }

  const startRoomId = cellId(0, 0);
  const exitRoomId  = cellId(exitCol, exitRow);

  // ── 4. Assign difficulty via BFS from exit ───────────────────────────────────
  // difficulty 0.0 = far from exit (easy), 1.0 = at exit (hardest)
  const distFromExit = bfsDistances(exitCol, exitRow, connections);
  const maxDistFromExit = Math.max(...distFromExit.values());

  // ── 5. Build RoomDefs ────────────────────────────────────────────────────────
  const rooms: Record<string, RoomDef> = {};

  // Pre-compute difficulties to assign boss rooms
  const diffMap = new Map<string, number>();
  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const id = cellId(c, r);
      const dFromExit = distFromExit.get(id) ?? 0;
      diffMap.set(id, maxDistFromExit > 0 ? 1 - dFromExit / maxDistFromExit : 0);
    }
  }

  // Assign bosses to the 4 hardest non-exit rooms, in descending difficulty order:
  // [0] = hardest (closest to exit) → GlitchBoss
  // [1] = 2nd hardest              → Zapsphere
  // [2] = 3rd hardest              → Snake
  // [3] = 4th hardest              → Bird (first boss player encounters)
  const nonExitIds = [...diffMap.keys()]
    .filter(id => id !== exitRoomId && id !== startRoomId)
    .sort((a, b) => (diffMap.get(b) ?? 0) - (diffMap.get(a) ?? 0));

  const glitchBossRoomId    = nonExitIds[0] ?? null;
  const zapsphereBossRoomId = nonExitIds[1] ?? null;
  const snakeBossRoomId     = nonExitIds[2] ?? null;
  const birdBossRoomId      = nonExitIds[3] ?? null;

  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const id         = cellId(c, r);
      const difficulty = diffMap.get(id) ?? 0;
      const isExit     = id === exitRoomId;

      const doors = [];
      for (const { dx, dy, side } of DIRS) {
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nc >= gridW || nr < 0 || nr >= gridH) continue;
        const nid = cellId(nc, nr);
        if (connections.get(id)!.has(nid)) {
          doors.push({ side, targetRoomId: nid });
        }
      }

      let bossType: SpawnEnemyType | undefined;
      if      (id === glitchBossRoomId)    bossType = 'glitch_boss';
      else if (id === zapsphereBossRoomId) bossType = 'zapsphere_boss';
      else if (id === snakeBossRoomId)     bossType = 'snake_boss';
      else if (id === birdBossRoomId)      bossType = 'bird_boss';

      rooms[id] = {
        id,
        doors,
        spawners: isExit ? buildExitRoomSpawners(difficulty, rng) : buildSpawners(difficulty, rng, bossType),
        difficulty,
        isExit,
      };
    }
  }

  return { rooms, startRoomId, exitRoomId };
}
