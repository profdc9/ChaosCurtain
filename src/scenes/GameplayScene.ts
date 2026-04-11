import * as ex from 'excalibur';
import { UPGRADE, ROOM, MAZE_GEN } from '../constants';
import { SharedPlayerState } from '../state/SharedPlayerState';
import { PlayerActor } from '../actors/PlayerActor';
import { HUD } from '../ui/HUD';
import { DebugOverlay } from '../ui/DebugOverlay';
import { StartScreenOverlay } from '../ui/StartScreenOverlay';
import { GameEvents } from '../utils/GameEvents';
import { RoomManager } from '../rooms/RoomManager';
import { PickupActor } from '../actors/PickupActor';
import { EXIT_ROOM_ID, MAZE, START_ROOM_ID, resetMazeGraph } from '../rooms/MazeGraph';
import DebugConfig from '../constants/DebugConfig';
import type { RoomDef } from '../rooms/RoomDef';
import type { PickupType } from '../types/GameTypes';
import { AudioManager } from '../audio/AudioManager';
import { ZzfxSoundBank } from '../audio/ZzfxSoundBank';
import { ZzfxSfxSystem } from '../audio/ZzfxSfxSystem';
import { ZzfxmMusicPlayer } from '../audio/ZzfxmMusicPlayer';
import { musicJumpSong } from '../audio/songs/musicJumpSong';

/** Seconds between pickup spawns (randomised each time). */
const PICKUP_INTERVAL_MIN = 60;
const PICKUP_INTERVAL_MAX = 120;

/** Margin from room walls when choosing a random spawn position. */
const PICKUP_SPAWN_MARGIN = 80;

export class GameplayScene extends ex.Scene {
  private sharedState!: SharedPlayerState;
  private roomManager!: RoomManager;
  private startOverlay!: StartScreenOverlay;

  // ── Pickup spawn timer ─────────────────────────────────────────────────────
  private pickupTimer    = 0;
  private pickupInterval = GameplayScene.randomPickupInterval();

  private static randomPickupInterval(): number {
    return PICKUP_INTERVAL_MIN + Math.random() * (PICKUP_INTERVAL_MAX - PICKUP_INTERVAL_MIN);
  }

  onInitialize(engine: ex.Engine): void {
    this.sharedState = new SharedPlayerState();

    // ── Audio ────────────────────────────────────────────────────────────────
    AudioManager.init();
    ZzfxSoundBank.buildAll();
    if (DebugConfig.enableSfx !== false) {
      new ZzfxSfxSystem();
    }

    // ── Start-screen overlay ─────────────────────────────────────────────────
    this.startOverlay = new StartScreenOverlay();
    this.add(this.startOverlay);

    // First user gesture: resume AudioContext AND dismiss the start screen.
    const onStart = async () => {
      this.startOverlay.dismiss();
      try {
        await AudioManager.unlock();
        if (DebugConfig.enableMusic !== false) {
          queueMicrotask(() => ZzfxmMusicPlayer.start(musicJumpSong));
        }
      } catch (err) {
        console.error('[Audio] Failed to resume AudioContext:', err);
      }
    };
    document.addEventListener('keydown',     onStart, { once: true });
    document.addEventListener('pointerdown', onStart, { once: true });

    // ── Game objects ─────────────────────────────────────────────────────────
    this.applyDebugUpgrades();

    GameEvents.on('enemy:died', (evt) => {
      this.sharedState.addScore(evt.points);
    });

    const player = new PlayerActor(engine, this.sharedState);
    this.add(player);

    const hud = new HUD(this.sharedState);
    this.add(hud);

    this.roomManager = new RoomManager(this, player);
    this.roomManager.load(this.buildStartRoom(MAZE[START_ROOM_ID]), null);

    GameEvents.on('game:won', () => {
      resetMazeGraph(MAZE_GEN.SEED);
      this.roomManager.clearClearedRooms();
      // Empty exit stays "cleared" so re-entering does not fire `game:won` again until other rooms are played.
      this.roomManager.markRoomCleared(EXIT_ROOM_ID);
      this.spawnVictoryPickups(MAZE_GEN.VICTORY_PICKUP_COUNT);
    });

    this.add(new DebugOverlay(this.sharedState, this.roomManager));
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    this.pickupTimer += delta / 1000;
    if (this.pickupTimer >= this.pickupInterval) {
      this.pickupTimer    = 0;
      this.pickupInterval = GameplayScene.randomPickupInterval();
      this.spawnPickup();
    }
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
