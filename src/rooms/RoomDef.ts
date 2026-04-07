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
}
