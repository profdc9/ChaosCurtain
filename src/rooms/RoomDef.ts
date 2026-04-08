export type DoorSide = 'north' | 'south' | 'east' | 'west';

export interface DoorDef {
  side: DoorSide;
  targetRoomId: string;
}

export type SpawnEnemyType = 'wanderer' | 'dart' | 'wrangler' | 'satellite';

export interface SpawnerDef {
  type: SpawnEnemyType;
  count: number;
}

export interface RoomDef {
  id: string;
  doors: DoorDef[];
  spawners: SpawnerDef[];
  /** 0.0 = easy (far from exit), 1.0 = hardest (at exit). */
  difficulty: number;
  isExit: boolean;
}
