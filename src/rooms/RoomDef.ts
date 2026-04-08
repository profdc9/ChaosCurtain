export type DoorSide = 'north' | 'south' | 'east' | 'west';

export interface DoorDef {
  side: DoorSide;
  targetRoomId: string;
}

export interface EnemySpawnDef {
  type: 'wanderer' | 'dart';
  count: number;
}

export interface RoomDef {
  id: string;
  doors: DoorDef[];
  enemies: EnemySpawnDef[];
  /** 0.0 = easy (far from exit), 1.0 = hardest (at exit). */
  difficulty: number;
  isExit: boolean;
}
