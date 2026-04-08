import * as ex from 'excalibur';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { PlayerActor } from '../actors/PlayerActor';
import { HUD } from '../ui/HUD';
import { GameEvents } from '../utils/GameEvents';
import { RoomManager } from '../rooms/RoomManager';
import { PickupActor } from '../actors/PickupActor';
import { MAZE, START_ROOM_ID } from '../rooms/MazeGraph';

export class GameplayScene extends ex.Scene {
  private sharedState!: SharedPlayerState;
  private roomManager!: RoomManager;

  onInitialize(engine: ex.Engine): void {
    this.sharedState = new SharedPlayerState();

    // Global score tracking
    GameEvents.on('enemy:died', (evt) => {
      this.sharedState.addScore(evt.points);
    });

    const player = new PlayerActor(engine, this.sharedState);
    this.add(player);

    const hud = new HUD(this.sharedState);
    this.add(hud);

    this.roomManager = new RoomManager(this, player);
    this.roomManager.load(MAZE[START_ROOM_ID], null);

    // TEST PICKUPS — one of each type for system verification
    // These will be replaced by RoomManager / DebugConfig placement
    this.add(new PickupActor(300, 200, 'shooterType'));
    this.add(new PickupActor(450, 200, 'weaponPower'));
    this.add(new PickupActor(600, 200, 'shield'));
    this.add(new PickupActor(750, 200, 'panicButton'));
    this.add(new PickupActor(900, 200, 'health'));
    this.add(new PickupActor(1050, 200, 'extraLife'));
  }
}
