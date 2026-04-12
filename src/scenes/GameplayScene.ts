import * as ex from 'excalibur';
import { PLAYER, UPGRADE, ROOM, MAZE_GEN } from '../constants';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { PlayerActor } from '../actors/PlayerActor';
import { HUD } from '../ui/HUD';
import { DebugOverlay } from '../ui/DebugOverlay';
import { GameEvents } from '../utils/GameEvents';
import { RoomManager } from '../rooms/RoomManager';
import { PickupActor } from '../actors/PickupActor';
import { EXIT_ROOM_ID, MAZE, START_ROOM_ID, resetMazeGraph } from '../rooms/MazeGraph';
import DebugConfig from '../constants/DebugConfig';
import type { RoomDef } from '../rooms/RoomDef';
import type { PickupType } from '../types/GameTypes';
import { isGameAudioPrepared } from '../audio/prepareGameAudio';
import { damageScaleForDifficulty, getGameSettings } from '../settings/GameSettings';
import { spawnPlayerDeathFragments } from '../utils/spawnPlayerDeathFragments';
import { PauseOverlay } from '../ui/PauseOverlay';
import { setGameplayPaused } from '../utils/GameplayPause';

/** Seconds between pickup spawns (randomised each time). */
const PICKUP_INTERVAL_MIN = 60;
const PICKUP_INTERVAL_MAX = 120;

/** Margin from room walls when choosing a random spawn position. */
const PICKUP_SPAWN_MARGIN = 80;

export class GameplayScene extends ex.Scene {
  private sharedState!: SharedPlayerState;
  private roomManager!: RoomManager;
  private playerActor!: PlayerActor;
  private playerActor2: PlayerActor | null = null;
  private pauseOverlay!: PauseOverlay;

  private readonly onEnemyDiedBound = (evt: { points: number }): void => {
    this.sharedState.addScore(evt.points);
  };

  private readonly onFleetLostBound = (): void => {
    this.fleetDeathRoomId = this.roomManager.currentRoomId;
    this.playerActor.setFleetLossFrozen(true);
    this.playerActor2?.setFleetLossFrozen(true);
    const fragPos = this.playerActor2
      ? ex.vec(
        (this.playerActor.pos.x + this.playerActor2.pos.x) / 2,
        (this.playerActor.pos.y + this.playerActor2.pos.y) / 2,
      )
      : this.playerActor.pos;
    spawnPlayerDeathFragments(
      this,
      fragPos,
      this.playerActor.rotation,
      this.playerActor.shipStrokeColor,
    );
    this.fleetRespawnTimer = PLAYER.FLEET_RESPAWN_DELAY_SEC;
  };

  private readonly onGameWonBound = (): void => {
    this.sharedState.scoreLocked = true;
    resetMazeGraph(MAZE_GEN.SEED);
    this.roomManager.clearClearedRooms();
    // Empty exit stays "cleared" so re-entering does not fire `game:won` again until other rooms are played.
    this.roomManager.markRoomCleared(EXIT_ROOM_ID);
    this.spawnVictoryPickups(MAZE_GEN.VICTORY_PICKUP_COUNT);
  };

  // ── Pickup spawn timer ─────────────────────────────────────────────────────
  private pickupTimer    = 0;
  private pickupInterval = GameplayScene.randomPickupInterval();

  /** Countdown to `respawnAfterFleetLoss` after `fleet:lost`. */
  private fleetRespawnTimer: number | null = null;
  private fleetDeathRoomId: string | null = null;

  private static randomPickupInterval(): number {
    return PICKUP_INTERVAL_MIN + Math.random() * (PICKUP_INTERVAL_MAX - PICKUP_INTERVAL_MIN);
  }

  onInitialize(engine: ex.Engine): void {
    this.sharedState = new SharedPlayerState();

    if (!isGameAudioPrepared()) {
      console.warn('[Audio] GameplayScene started without menu audio prep; SFX/BGM may be silent until refresh.');
    }

    const gameSettings = getGameSettings();
    this.sharedState.damageScale = damageScaleForDifficulty(gameSettings.difficulty);

    // ── Game objects ─────────────────────────────────────────────────────────
    this.applyDebugUpgrades();

    GameEvents.on('enemy:died', this.onEnemyDiedBound);

    const p1 = new PlayerActor(
      engine,
      this.sharedState,
      gameSettings.playerControls[0],
      PLAYER.COLOR_P1,
    );
    this.playerActor = p1;
    this.add(p1);

    if (gameSettings.playerCount === 2) {
      const p2 = new PlayerActor(
        engine,
        this.sharedState,
        gameSettings.playerControls[1],
        PLAYER.COLOR_P2,
      );
      this.playerActor2 = p2;
      this.add(p2);
      p1.pos = ex.vec(600, 390);
      p2.pos = ex.vec(720, 390);
    } else {
      this.playerActor2 = null;
    }

    const hud = new HUD(this.sharedState);
    this.add(hud);

    this.roomManager = new RoomManager(this, p1, this.playerActor2);
    this.roomManager.load(this.buildStartRoom(MAZE[START_ROOM_ID]), null);

    GameEvents.on('fleet:lost', this.onFleetLostBound);

    GameEvents.on('game:won', this.onGameWonBound);

    this.add(new DebugOverlay(this.sharedState, this.roomManager));

    this.pauseOverlay = new PauseOverlay(engine);
    this.add(this.pauseOverlay);
  }

  onDeactivate(_ctx: ex.SceneActivationContext): void {
    this.pauseOverlay.forceCloseIfOpen();
    setGameplayPaused(false);
    this.roomManager.detachGlobalListeners();
    GameEvents.off('enemy:died', this.onEnemyDiedBound);
    GameEvents.off('fleet:lost', this.onFleetLostBound);
    GameEvents.off('game:won', this.onGameWonBound);
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    const kb = _engine.input.keyboard;
    if (!this.pauseOverlay.isMenuOpen() && kb.wasPressed(ex.Keys.Escape)) {
      this.pauseOverlay.openMenu();
    }
    if (this.pauseOverlay.isMenuOpen()) return;

    if (this.fleetRespawnTimer !== null) {
      this.fleetRespawnTimer -= delta / 1000;
      if (this.fleetRespawnTimer <= 0) {
        this.fleetRespawnTimer = null;
        const deathRoom = this.fleetDeathRoomId;
        this.fleetDeathRoomId = null;
        if (deathRoom) this.roomManager.respawnAfterFleetLoss(deathRoom);
        this.playerActor.setFleetLossFrozen(false);
        this.playerActor2?.setFleetLossFrozen(false);
      }
    }

    this.pickupTimer += delta / 1000;
    if (this.pickupTimer >= this.pickupInterval) {
      this.pickupTimer    = 0;
      this.pickupInterval = GameplayScene.randomPickupInterval();
      this.spawnPickup();
    }
  }

  /** After movement/physics so co-op exit passage overlap sees up-to-date player positions. */
  onPostUpdate(_engine: ex.Engine, _delta: number): void {
    if (this.pauseOverlay.isMenuOpen()) return;
    this.roomManager.tickCoopPassageOverlap();
  }

  // ── Pickup spawning ────────────────────────────────────────────────────────

  private spawnPickup(): void {
    const type = this.selectPickupType();
    if (type === null) return;
    const x = ROOM.INNER_LEFT  + PICKUP_SPAWN_MARGIN +
              Math.random() * (ROOM.INNER_RIGHT - ROOM.INNER_LEFT  - 2 * PICKUP_SPAWN_MARGIN);
    const y = ROOM.INNER_TOP   + PICKUP_SPAWN_MARGIN +
              Math.random() * (ROOM.INNER_BOTTOM - ROOM.INNER_TOP  - 2 * PICKUP_SPAWN_MARGIN);
    this.add(new PickupActor(x, y, type));
  }

  /** Victory celebration pickups — random types and positions. */
  private spawnVictoryPickups(count: number): void {
    const types: PickupType[] = [
      'shooterType', 'weaponPower', 'shield', 'panicButton', 'health', 'extraLife',
    ];
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const x = ROOM.INNER_LEFT + PICKUP_SPAWN_MARGIN +
        Math.random() * (ROOM.INNER_RIGHT - ROOM.INNER_LEFT - 2 * PICKUP_SPAWN_MARGIN);
      const y = ROOM.INNER_TOP + PICKUP_SPAWN_MARGIN +
        Math.random() * (ROOM.INNER_BOTTOM - ROOM.INNER_TOP - 2 * PICKUP_SPAWN_MARGIN);
      this.add(new PickupActor(x, y, type));
    }
  }

  /**
   * Returns a pickup type the player actually needs, weighted equally among
   * all applicable options. Returns null only if everything is maxed (very
   * unlikely — extraLife is always a candidate).
   */
  private selectPickupType(): PickupType | null {
    const s = this.sharedState;
    const candidates: PickupType[] = [];

    if (s.health < s.maxHealth)                       candidates.push('health');
    if (s.shooterType < 3)                            candidates.push('shooterType');
    if (s.weaponPower < UPGRADE.MAX_WEAPON_POWER)     candidates.push('weaponPower');
    if (s.shieldLevel < UPGRADE.MAX_SHIELD_LEVEL)     candidates.push('shield');
    if (s.panicCount  < UPGRADE.MAX_PANIC_COUNT)      candidates.push('panicButton');
    candidates.push('extraLife'); // lives are always useful

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ── Debug helpers ──────────────────────────────────────────────────────────

  private applyDebugUpgrades(): void {
    const s = this.sharedState;
    const d = DebugConfig;

    if (d.godMode) s.godMode = true;
    if (d.damageScale !== undefined) s.damageScale = d.damageScale;

    if (d.startMaxUpgrades) {
      s.shooterType = 3;
      s.weaponPower = UPGRADE.MAX_WEAPON_POWER;
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

  private buildStartRoom(base: RoomDef): RoomDef {
    const d = DebugConfig;
    if (d.roomDifficulty === undefined && d.forcedSpawners === undefined) return base;
    return {
      ...base,
      difficulty: d.roomDifficulty ?? base.difficulty,
      spawners:   d.forcedSpawners  ?? base.spawners,
    };
  }
}
