import * as ex from 'excalibur';
import { UPGRADE } from '../constants';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { PlayerActor } from '../actors/PlayerActor';
import { HUD } from '../ui/HUD';
import { DebugOverlay } from '../ui/DebugOverlay';
import { GameEvents } from '../utils/GameEvents';
import { RoomManager } from '../rooms/RoomManager';
import { PickupActor } from '../actors/PickupActor';
import { MAZE, START_ROOM_ID } from '../rooms/MazeGraph';
import DebugConfig from '../constants/DebugConfig';
import type { RoomDef } from '../rooms/RoomDef';

export class GameplayScene extends ex.Scene {
  private sharedState!: SharedPlayerState;
  private roomManager!: RoomManager;

  onInitialize(engine: ex.Engine): void {
    this.sharedState = new SharedPlayerState();

    // Apply debug starting upgrades
    this.applyDebugUpgrades();

    // Global score tracking
    GameEvents.on('enemy:died', (evt) => {
      this.sharedState.addScore(evt.points);
    });

    const player = new PlayerActor(engine, this.sharedState);
    this.add(player);

    const hud = new HUD(this.sharedState);
    this.add(hud);

    this.roomManager = new RoomManager(this, player);

    const startRoom = this.buildStartRoom(MAZE[START_ROOM_ID]);
    this.roomManager.load(startRoom, null);

    const overlay = new DebugOverlay(this.sharedState, this.roomManager);
    this.add(overlay);

    // TEST PICKUPS — one of each type for system verification
    // These will be replaced by RoomManager / DebugConfig placement
    this.add(new PickupActor(300, 200, 'shooterType'));
    this.add(new PickupActor(450, 200, 'weaponPower'));
    this.add(new PickupActor(600, 200, 'shield'));
    this.add(new PickupActor(750, 200, 'panicButton'));
    this.add(new PickupActor(900, 200, 'health'));
    this.add(new PickupActor(1050, 200, 'extraLife'));
  }

  /** Apply DebugConfig overrides to starting upgrade state. */
  private applyDebugUpgrades(): void {
    const s = this.sharedState;
    const d = DebugConfig;

    if (d.godMode) s.godMode = true;

    if (d.startMaxUpgrades) {
      s.shooterType = 3;
      s.weaponPower = UPGRADE.MAX_WEAPON_POWER;
      // Shield: apply level-by-level so charge initialises correctly per level
      for (let i = 0; i < UPGRADE.MAX_SHIELD_LEVEL; i++) s.applyUpgrade('shield');
      s.panicCount = UPGRADE.MAX_PANIC_COUNT;
      return;
    }

    if (d.startShooterType !== undefined) s.shooterType = d.startShooterType;
    if (d.startWeaponPower !== undefined) s.weaponPower = Math.min(d.startWeaponPower, UPGRADE.MAX_WEAPON_POWER);
    if (d.startShieldLevel !== undefined) {
      for (let i = 0; i < Math.min(d.startShieldLevel, UPGRADE.MAX_SHIELD_LEVEL); i++) {
        s.applyUpgrade('shield');
      }
    }
    if (d.startPanicCount !== undefined) s.panicCount = Math.min(d.startPanicCount, UPGRADE.MAX_PANIC_COUNT);
  }

  /**
   * Return a (possibly modified) RoomDef for the starting room,
   * substituting DebugConfig overrides for difficulty and spawners.
   */
  private buildStartRoom(base: RoomDef): RoomDef {
    const d = DebugConfig;
    if (d.roomDifficulty === undefined && d.forcedSpawners === undefined) return base;
    return {
      ...base,
      difficulty: d.roomDifficulty ?? base.difficulty,
      spawners: d.forcedSpawners ?? base.spawners,
    };
  }
}
