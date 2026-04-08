import { generateMaze } from '../maze/MazeGenerator';
import { MAZE_GEN } from '../constants';

const { rooms, startRoomId, exitRoomId } = generateMaze(
  MAZE_GEN.SEED,
  MAZE_GEN.GRID_W,
  MAZE_GEN.GRID_H,
);

export const MAZE = rooms;
export const START_ROOM_ID = startRoomId;
export const EXIT_ROOM_ID = exitRoomId;
