import { generateMaze } from '../maze/MazeGenerator';
import { MAZE_GEN } from '../constants';
import type { RoomDef } from './RoomDef';

export let MAZE: Record<string, RoomDef>;
export let START_ROOM_ID: string;
export let EXIT_ROOM_ID: string;

/** Last-used maze params (defaults match {@link MAZE_GEN}; gameplay applies expert menu overrides). */
let activeSeed = MAZE_GEN.SEED >>> 0;
let activeGridW: number = MAZE_GEN.GRID_W;
let activeGridH: number = MAZE_GEN.GRID_H;

function assignMaze(seed: number, gridW: number, gridH: number): void {
  const { rooms, startRoomId, exitRoomId } = generateMaze(seed, gridW, gridH);
  MAZE = rooms;
  START_ROOM_ID = startRoomId;
  EXIT_ROOM_ID = exitRoomId;
}

assignMaze(activeSeed, activeGridW, activeGridH);

export function getActiveMazeParams(): Readonly<{ seed: number; gridW: number; gridH: number }> {
  return { seed: activeSeed, gridW: activeGridW, gridH: activeGridH };
}

/**
 * Regenerate the maze graph. Omit arguments to keep the current run's seed and grid size
 * (e.g. after a victory loop). Pass values to replace what the next run uses.
 */
export function resetMazeGraph(seed?: number, gridW?: number, gridH?: number): void {
  if (seed !== undefined) activeSeed = seed >>> 0;
  if (gridW !== undefined) activeGridW = gridW;
  if (gridH !== undefined) activeGridH = gridH;
  assignMaze(activeSeed, activeGridW, activeGridH);
}
