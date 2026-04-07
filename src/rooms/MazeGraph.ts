import type { RoomDef } from './RoomDef';

/**
 * Hard-coded 4-room test maze:
 *
 *   [A: 3 wanderers] --east--> [B: 5 wanderers] --east--> [C: 7 wanderers]
 *                                      |
 *                                    south
 *                                      |
 *                               [D: 4 wanderers]
 */
export const MAZE: Record<string, RoomDef> = {
  roomA: {
    id: 'roomA',
    doors: [{ side: 'east', targetRoomId: 'roomB' }],
    enemies: [{ type: 'wanderer', count: 3 }],
  },
  roomB: {
    id: 'roomB',
    doors: [
      { side: 'west', targetRoomId: 'roomA' },
      { side: 'east', targetRoomId: 'roomC' },
      { side: 'south', targetRoomId: 'roomD' },
    ],
    enemies: [{ type: 'wanderer', count: 3 }, { type: 'dart', count: 2 }],
  },
  roomC: {
    id: 'roomC',
    doors: [{ side: 'west', targetRoomId: 'roomB' }],
    enemies: [{ type: 'wanderer', count: 3 }, { type: 'dart', count: 4 }],
  },
  roomD: {
    id: 'roomD',
    doors: [{ side: 'north', targetRoomId: 'roomB' }],
    enemies: [{ type: 'wanderer', count: 2 }, { type: 'dart', count: 3 }],
  },
};
