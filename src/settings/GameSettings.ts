/**
 * Run configuration chosen from the main menu: difficulty, player count, and per-player controls.
 * At most one player may use keyboard + mouse; any number of gamepads may be assigned (distinct indices when both use pads).
 */

export type Difficulty = 'easy' | 'moderate' | 'hard';

export type ControlScheme =
  | { kind: 'keyboard_mouse' }
  | { kind: 'gamepad'; index: number };

export interface GameSettings {
  difficulty: Difficulty;
  playerCount: 1 | 2;
  /** [P1, P2] — P2 is ignored when `playerCount === 1`. */
  playerControls: [ControlScheme, ControlScheme];
}

const STORAGE_KEY = 'chaosCurtain.gameSettings.v1';

const MAX_GAMEPAD_INDEX = 3;

export function defaultGameSettings(): GameSettings {
  return {
    difficulty: 'moderate',
    playerCount: 1,
    playerControls: [
      { kind: 'keyboard_mouse' },
      { kind: 'gamepad', index: 0 },
    ],
  };
}

/** Incoming damage scale: lower = easier (less damage taken). */
export function damageScaleForDifficulty(d: Difficulty): number {
  switch (d) {
    case 'easy': return 0.15;
    case 'moderate': return 0.25;
    case 'hard': return 0.38;
  }
}

function clampGamepadIndex(n: number): number {
  return Math.max(0, Math.min(MAX_GAMEPAD_INDEX, Math.floor(n)));
}

function normalizeScheme(c: ControlScheme): ControlScheme {
  if (c.kind === 'keyboard_mouse') return { kind: 'keyboard_mouse' };
  return { kind: 'gamepad', index: clampGamepadIndex(c.index) };
}

/** Ensure at most one keyboard, no duplicate gamepads for active players, indices in range. */
export function sanitizeGameSettings(raw: GameSettings): GameSettings {
  const difficulty: Difficulty =
    raw.difficulty === 'easy' || raw.difficulty === 'moderate' || raw.difficulty === 'hard'
      ? raw.difficulty
      : 'moderate';
  const playerCount: 1 | 2 = raw.playerCount === 2 ? 2 : 1;

  let a = normalizeScheme(raw.playerControls[0]);
  let b = normalizeScheme(raw.playerControls[1]);

  if (playerCount === 1) {
    return {
      difficulty,
      playerCount: 1,
      playerControls: [a, b],
    };
  }

  const kbA = a.kind === 'keyboard_mouse';
  const kbB = b.kind === 'keyboard_mouse';
  if (kbA && kbB) {
    b = { kind: 'gamepad', index: 0 };
  }

  if (a.kind === 'gamepad' && b.kind === 'gamepad' && a.index === b.index) {
    b = { kind: 'gamepad', index: (a.index + 1) % (MAX_GAMEPAD_INDEX + 1) };
  }

  return {
    difficulty,
    playerCount: 2,
    playerControls: [a, b],
  };
}

let current: GameSettings = sanitizeGameSettings(defaultGameSettings());

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw) as Partial<GameSettings>;
    const merged: GameSettings = {
      ...defaultGameSettings(),
      ...o,
      playerControls: o.playerControls?.length === 2
        ? [normalizeScheme(o.playerControls[0]), normalizeScheme(o.playerControls[1])]
        : defaultGameSettings().playerControls,
    };
    current = sanitizeGameSettings(merged);
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

/** Call once at app bootstrap (before menu). */
export function initGameSettings(): void {
  loadFromStorage();
  current = sanitizeGameSettings(current);
}

export function getGameSettings(): GameSettings {
  return current;
}

export function setGameSettings(patch: Partial<GameSettings>): void {
  const next: GameSettings = sanitizeGameSettings({
    ...current,
    ...patch,
    playerControls: patch.playerControls ?? current.playerControls,
  });
  current = next;
  persist();
}

export function controlSchemeLabel(c: ControlScheme): string {
  if (c.kind === 'keyboard_mouse') return 'KEYBOARD + MOUSE';
  return `GAMEPAD ${c.index + 1}`;
}

export function difficultyLabel(d: Difficulty): string {
  return d.toUpperCase();
}

/** Cycle helpers for the settings UI (sanitization runs on `setGameSettings`). */

export function cycleDifficulty(dir: -1 | 1): void {
  const order: Difficulty[] = ['easy', 'moderate', 'hard'];
  const i = order.indexOf(current.difficulty);
  const n = (i + dir + order.length) % order.length;
  setGameSettings({ difficulty: order[n] });
}

export function togglePlayerCount(): void {
  setGameSettings({ playerCount: current.playerCount === 1 ? 2 : 1 });
}

const SCHEME_CYCLE_LEN = 5; // keyboard + gamepads 0..3

function schemeCycleIndex(c: ControlScheme): number {
  if (c.kind === 'keyboard_mouse') return 0;
  return 1 + clampGamepadIndex(c.index);
}

function schemeFromCycleIndex(i: number): ControlScheme {
  const n = ((i % SCHEME_CYCLE_LEN) + SCHEME_CYCLE_LEN) % SCHEME_CYCLE_LEN;
  if (n === 0) return { kind: 'keyboard_mouse' };
  return { kind: 'gamepad', index: n - 1 };
}

export function cyclePlayerControl(slot: 0 | 1, dir: -1 | 1): void {
  const [a0, a1] = current.playerControls;
  const cur = slot === 0 ? a0 : a1;
  const idx = schemeCycleIndex(cur);
  const next = schemeFromCycleIndex(idx + dir);
  if (slot === 0) {
    setGameSettings({ playerControls: [next, a1] });
  } else {
    setGameSettings({ playerControls: [a0, next] });
  }
}
