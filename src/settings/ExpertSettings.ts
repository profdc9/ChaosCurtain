/**
 * Expert / dev maze parameters chosen from the main menu (persisted locally).
 * Applied when a gameplay run starts; victory loops reuse the same dimensions + seed.
 */

import { MAZE_GEN } from '../constants';

export interface ExpertMazeSettings {
  gridW: number;
  gridH: number;
  /** Maze PRNG seed in 0..999999 (six decimal digits; passed to {@link SeededRandom}). */
  seed: number;
}

/** Exclusive upper bound for expert seed (valid values: 0 .. SEED_MOD - 1). */
export const EXPERT_SEED_MOD = 1_000_000;

const STORAGE_KEY = 'chaosCurtain.expertMaze.v1';

export const EXPERT_MAZE_GRID_MIN = 3;
export const EXPERT_MAZE_GRID_MAX = 16;

function clampGrid(n: number): number {
  return Math.max(EXPERT_MAZE_GRID_MIN, Math.min(EXPERT_MAZE_GRID_MAX, Math.floor(n)));
}

export function clampExpertSeed(n: number): number {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return 0;
  return ((x % EXPERT_SEED_MOD) + EXPERT_SEED_MOD) % EXPERT_SEED_MOD;
}

/** Six-digit string 000000–999999 for menus and HUD. */
export function formatExpertSeedDisplay(seed: number): string {
  return String(clampExpertSeed(seed)).padStart(6, '0');
}

export function defaultExpertMazeSettings(): ExpertMazeSettings {
  return {
    gridW: MAZE_GEN.GRID_W,
    gridH: MAZE_GEN.GRID_H,
    seed: clampExpertSeed(MAZE_GEN.SEED),
  };
}

export function sanitizeExpertMazeSettings(raw: Partial<ExpertMazeSettings>): ExpertMazeSettings {
  const d = defaultExpertMazeSettings();
  return {
    gridW: clampGrid(raw.gridW ?? d.gridW),
    gridH: clampGrid(raw.gridH ?? d.gridH),
    seed: clampExpertSeed(raw.seed ?? d.seed),
  };
}

let current = sanitizeExpertMazeSettings(defaultExpertMazeSettings());

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw) as Partial<ExpertMazeSettings>;
    current = sanitizeExpertMazeSettings({ ...defaultExpertMazeSettings(), ...o });
  } catch {
    /* ignore */
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

/** Call once at app bootstrap (with {@link initGameSettings}). */
export function initExpertSettings(): void {
  loadFromStorage();
  current = sanitizeExpertMazeSettings(current);
}

export function getExpertMazeSettings(): ExpertMazeSettings {
  return current;
}

export function setExpertMazeSettings(patch: Partial<ExpertMazeSettings>): void {
  current = sanitizeExpertMazeSettings({ ...current, ...patch });
  persist();
}

export function adjustExpertGridW(dir: -1 | 1): void {
  setExpertMazeSettings({ gridW: current.gridW + dir });
}

export function adjustExpertGridH(dir: -1 | 1): void {
  setExpertMazeSettings({ gridH: current.gridH + dir });
}

const SEED_FINE_STEP = 1;
const SEED_COARSE_STEP = 4096;

export function adjustExpertSeed(fineDir: -1 | 0 | 1, coarseDir: -1 | 0 | 1): void {
  if (fineDir === 0 && coarseDir === 0) return;
  let s = current.seed;
  if (fineDir !== 0) {
    s = clampExpertSeed(s + fineDir * SEED_FINE_STEP);
  }
  if (coarseDir !== 0) {
    s = clampExpertSeed(s + coarseDir * SEED_COARSE_STEP);
  }
  setExpertMazeSettings({ seed: s });
}

/** Shift-decimal entry: `(seed * 10 + digit) % 1_000_000`. */
export function appendExpertSeedDigit(digit: number): void {
  const d = Math.floor(digit);
  if (d < 0 || d > 9) return;
  setExpertMazeSettings({ seed: (current.seed * 10 + d) % EXPERT_SEED_MOD });
}
