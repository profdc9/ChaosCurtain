import * as ex from 'excalibur';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { PlayerActor } from '../actors/PlayerActor';
import { HUD } from '../ui/HUD';
import { GameEvents } from '../utils/GameEvents';
import { RoomManager } from '../rooms/RoomManager';
import { MAZE, START_ROOM_ID } from '../rooms/MazeGraph';

export class GameplayScene extends ex.Scene {
  private sharedState!: SharedPlayerState;
  private roomManager!: RoomManager;

  onInitialize(engine: ex.Engine): void {
    this.sharedState = new SharedPlayerState();

    // Global score tracking (room manager handles room-clear logic separately).
    GameEvents.on('enemy:died', (evt) => {
      this.sharedState.addScore(evt.points);
    });

    const player = new PlayerActor(engine, this.sharedState);
    this.add(player);

    const hud = new HUD(this.sharedState);
    this.add(hud);

    this.roomManager = new RoomManager(this, player);
    this.roomManager.load(MAZE[START_ROOM_ID], null);
  }
}
