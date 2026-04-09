import type { SpawnerDef } from '../rooms/RoomDef';

export interface DebugSettings {
  // ── Maze ──────────────────────────────────────────────────────────────────────
  /** Override the maze PRNG seed. undefined = use MAZE_GEN.SEED. */
  seed?: number;
  /** Override maze grid width. */
  gridW?: number;
  /** Override maze grid height. */
  gridH?: number;

  // ── Starting room ─────────────────────────────────────────────────────────────
  /** Override the starting room's difficulty (0.0–1.0). Affects spawner timings. */
  roomDifficulty?: number;
  /**
   * Replace the starting room's spawner list entirely.
   * Example — two wanderer machines and one dart machine:
   *   forcedSpawners: [{ type: 'wanderer', count: 2 }, { type: 'dart', count: 1 }]
   */
  forcedSpawners?: SpawnerDef[];

  // ── Starting upgrades ─────────────────────────────────────────────────────────
  /** If true, start with all upgrades at maximum level. */
  startMaxUpgrades?: boolean;
  /** Override starting shooter type (1 = single, 2 = dual, 3 = cardinal). */
  startShooterType?: 1 | 2 | 3;
  /** Override starting weapon power level. */
  startWeaponPower?: number;
  /** Override starting shield level. */
  startShieldLevel?: number;
  /** Override starting panic button count. */
  startPanicCount?: number;

  // ── Gameplay ──────────────────────────────────────────────────────────────────
  /** Player takes no damage. */
  godMode?: boolean;
  /** Incoming damage multiplier. 0.25 = easy (default), 1.0 = full/hard. */
  damageScale?: number;
}

/**
 * Edit the fields below to configure a debug session.
 * All fields are optional — undefined means "use normal game value".
 * Changes take effect on the next page reload.
 *
 * Example — hard room with max upgrades and god mode:
 *   roomDifficulty: 1.0,
 *   forcedSpawners: [{ type: 'dart', count: 3 }],
 *   startMaxUpgrades: true,
 *   godMode: true,
 */
const DebugConfig: DebugSettings = {
  // roomDifficulty: 1.0,
  // forcedSpawners: [{ type: 'wanderer', count: 2 }, { type: 'dart', count: 2 }],
  // startMaxUpgrades: true,
  // godMode: true,
};

export default DebugConfig;
