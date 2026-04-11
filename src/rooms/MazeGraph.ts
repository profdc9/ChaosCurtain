import { generateMaze } from '../maze/MazeGenerator';
import { MAZE_GEN } from '../constants';
import type { RoomDef } from './RoomDef';

export let MAZE: Record<string, RoomDef>;
export let START_ROOM_ID: string;
export let EXIT_ROOM_ID: string;

function assignMaze(seed: number): void {
  const { rooms, startRoomId, exitRoomId } = generateMaze(
    seed,
    MAZE_GEN.GRID_W,
    MAZE_GEN.GRID_H,
  );
  MAZE = rooms;
  START_ROOM_ID = startRoomId;
  EXIT_ROOM_ID = exitRoomId;
}

assignMaze(MAZE_GEN.SEED);

/**
 * Regenerate the maze graph (same topology if `seed` matches the previous run).
 * Call after a victory loop so cleared-room state can be cleared independently.
 */
export function resetMazeGraph(seed: number = MAZE_GEN.SEED): void {
  assignMaze(seed);
}
