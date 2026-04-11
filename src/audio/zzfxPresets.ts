/**
 * Original ChaosCurtain ZzFX tuples (`zzfx(...[, …])` — leading hole → default volume 1).
 * Passed to `ZZFX.buildSamples` for offline baking; randomness is already 0 at index 1.
 */
export const SFX_PRESETS = {
  bulletFired: [0.12, 0, 1500, , 0.1, , 5, , -15] as number[],

  enemyHitLight: [, 0, 500, , , 0.25, , , 300, 100, , , , , , 0.5] as number[],

  enemyHitHeavy: [, 0, 500, , 0.5, 0.25, , , 300, 100, , , , , , 0.5] as number[],

  enemyDied: [, 0, 500, , 0.2, 0.3, 4, , 100, , , , , , , 0.3] as number[],

  enemyDiedBoss: [, 0, 500, , 1, 0.5, 4, , , , , , , , , 0.3] as number[],

  playerHitLight: [, 0, 1e3, , 0.3, 0.3, , , 400, , , , , , , 0.25] as number[],

  playerHitHeavy: [, 0, 1e3, , 0.6, 0.6, , , 800, , , , , , , 0.25] as number[],

  upgraded: [, 0, 1e3, , 0.3, 0.6, 1, , 1e3] as number[],

  downgraded: [, 0, 500, , 0.3, 0.6, 1, , , -1] as number[],

  panic: [, 0, 1e3, , 0.6, 0.3, 2, , , , , , , , , 0.5] as number[],

  pickup: [, 0, 500, , , 0.2, 5, , , 10] as number[],

  zapLightning: [, 0, 500, , 0.1, 0.8, 4, , -1, 100, , , , , , 0.1, , 2] as number[],

  zapWarning: [, 0, 500, , 0.1, 0.5, 1, , 1.5, , , , , , , , , 2] as number[],

  roomEntered: [, 0, 1500, , 0.1, 0.6, 5, , , , -250, 0.3] as number[],

  roomCleared: [, 0, 800, , 1.2, 0.2, 5, , 1.5, , 160, 0.3, 0.1] as number[],

  enemySpawned: [, 0, 800, , 0.1, , 1, , , , -250, 0.1] as number[],

  wranglerTether: [, 0, 250, , 0.5, 0.5, 1, , , , , , , , 1] as number[],

  fleetLost: [, 0, 1200, , 2, 0.2, 1, , , , -100, 0.1, 0.2] as number[],

  gameOver: [, 0, 1200, , 3, 0.2, 1, , , , -50, 0.1, 0.2, , , 0.25] as number[],

  gameWon: [, 0, 500, , 3, 0.2, , , -0.5, 0.1, 50, 0.1, 0.2, , , 0.25] as number[],
} as const;

export type SfxPresetId = keyof typeof SFX_PRESETS;
