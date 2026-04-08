import { SeededRandom } from '../utils/SeededRandom';
import type { RoomDef, SpawnerDef, DoorSide } from '../rooms/RoomDef';
import { MAZE_GEN } from '../constants';

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
 * Easy rooms get only wanderer machines; harder rooms mix in dart machines.
 */
function buildSpawners(difficulty: number, rng: SeededRandom): SpawnerDef[] {
  const { EASY_TIER, MED_TIER } = MAZE_GEN;
  const result: SpawnerDef[] = [];

  if (difficulty < EASY_TIER) {
    result.push({ type: 'wanderer', count: rng.nextInt(1, 2) });
  } else if (difficulty < MED_TIER) {
    result.push({ type: 'wanderer', count: rng.nextInt(1, 2) });
    result.push({ type: 'dart',     count: 1 });
  } else {
    result.push({ type: 'wanderer', count: 1 });
    result.push({ type: 'dart',     count: rng.nextInt(1, 2) });
  }

  return result;
}

/**
 * Generate a perfect maze on a gridW×gridH grid using recursive backtracking (DFS).
 *
 * - Start room: (0, 0)
 * - Exit room: the cell farthest from start by graph distance (BFS)
 * - Difficulty: normalized BFS distance from exit (0.0 = far from exit = easy,
 *   1.0 = at exit = hardest)
 * - Enemy mix scales with difficulty; exit room spawns no enemies
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

  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const id = cellId(c, r);
      const dFromExit  = distFromExit.get(id) ?? 0;
      const difficulty = maxDistFromExit > 0 ? 1 - dFromExit / maxDistFromExit : 0;
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

      rooms[id] = {
        id,
        doors,
        spawners: isExit ? [] : buildSpawners(difficulty, rng),
        difficulty,
        isExit,
      };
    }
  }

  return { rooms, startRoomId, exitRoomId };
}
