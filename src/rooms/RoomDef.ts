export type DoorSide = 'north' | 'south' | 'east' | 'west';

export interface DoorDef {
  side: DoorSide;
  targetRoomId: string;
}

export type SpawnEnemyType = 'wanderer' | 'dart' | 'wrangler' | 'satellite' | 'worm' | 'blaster' | 'bird_boss' | 'snake_boss';

export interface SpawnerDef {
  type: SpawnEnemyType;
  count: number;
  /** If true, spawns the entity once immediately on room entry then goes idle. */
  oneShot?: boolean;
}

export interface RoomDef {
  id: string;
  doors: DoorDef[];
  spawners: SpawnerDef[];
  /** 0.0 = easy (far from exit), 1.0 = hardest (at exit). */
  difficulty: number;
  isExit: boolean;
}
