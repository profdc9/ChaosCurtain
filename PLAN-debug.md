# ChaosCurtain — Debug & Testing System

## Philosophy

All debug tooling is isolated to `DebugConfig.ts` and `DebugOverlay`. Nothing debug-related leaks into normal gameplay code — game systems only check `DebugConfig` at initialization time, not per-frame.

---

## Access ✓ implemented (edit-file approach; menu deferred until main menu exists)

- **Current entry point:** Edit `src/constants/DebugConfig.ts` directly and reload. Fields are commented out by default; uncomment and set values to activate overrides.
- **Planned:** Secret keypress on main menu opens a `DebugScene` UI — deferred until `MainMenuScene` is built.
- Game applies overrides on startup; all changes are session-only (not persisted).

---

## DebugConfig Object ✓ implemented

Lives in `src/constants/DebugConfig.ts`. All fields are optional — `undefined` means "use normal game value."

```
DebugConfig {
  // Maze
  seed?: number                  // Override maze PRNG seed
  gridW?: number                 // Override grid width
  gridH?: number                 // Override grid height

  // Room overrides (applies to starting room)
  roomDifficulty?: number        // 0.0–1.0; overrides BFS difficulty for room 1
  forcedEnemies?: EnemySpawnDef[]  // Replace normal enemy list entirely
                                   // EnemySpawnDef: { type: EnemyType, count: number }

  // Starting upgrades
  startMaxUpgrades?: boolean     // If true: Cardinal Shot, max weapon power, max shield, N panic buttons
  startShooterType?: 1 | 2 | 3  // Override shooter level directly
  startWeaponPower?: number      // Override weapon power level directly
  startShieldLevel?: number      // Override shield level directly
  startPanicCount?: number       // Override panic button count directly

  // Pickup tuning
  pickupDensity?: number         // Multiplier on normal pickup spawn rate (e.g. 3.0 = 3× more pickups)
  forcePickupType?: PickupType   // All spawned pickups are this type (useful to farm a specific upgrade)

  // Gameplay
  godMode?: boolean              // Player takes no damage
}
```

---

## Debug Menu Sections (planned — pending MainMenuScene)

### Maze Settings
- Seed (text input — blank = random)
- Grid width / height (number inputs)
- Room difficulty override for room 1 (slider 0.0–1.0; default off)

### Enemy Override
- Toggle: replace room 1 enemy list
- Per enemy type: count selector (0–N) — only visible when toggle is on
- Enemy types listed: Wanderer, Dart, Wrangler, Satellite, Worm, Blaster, Bird, Snake, Zapsphere, GlitchBoss

### Starting Upgrades
- Quick preset button: "Max Upgrades" (sets all to max in one click)
- Individual fields: Shooter Type (1/2/3), Weapon Power (level), Shield Level, Panic Button Count

### Pickup Settings
- Pickup density multiplier (1× default, can go up to 5×)
- Force pickup type (dropdown: None / Shooter / Weapon Power / Shield / Panic Button / Health / Extra Life)

### Gameplay
- God Mode toggle

### Overlay
- Debug overlay toggle (see below — also independently accessible outside debug mode)

---

## Debug Overlay ✓ implemented (`src/ui/DebugOverlay.ts`)

A **permanent dev tool** — accessible independently of debug mode via `` ` `` or `F3`. Not hidden behind the debug menu.

Displays in a corner of the screen (small, semi-transparent vector text):

| Field | Description |
|---|---|
| Room ID | Current room identifier |
| Difficulty | Room difficulty value (0.00–1.00) |
| Live count | Current liveCount (spawners + enemies) |
| Enemy list | Each live enemy: type, current HP / max HP |
| Last damage | Most recent damage event: source, raw, post-shield, post-threshold |
| FPS | Frame rate |
| Seed | Current maze seed |
| Upgrades | Current shooter type / weapon power / shield level+charge / panic count |

Damage numbers float above the hit target briefly (same vector font, small size) — visible regardless of overlay state.

---

## Panic Button Input ✓ implemented

| Device | Input |
|---|---|
| Keyboard + mouse | `Space` |
| Gamepad | Any of the four face buttons (A/B/X/Y or Cross/Circle/Square/Triangle) |

Panic button fires on press, not hold (`keyboard.wasPressed` / `gp.wasButtonPressed`). Input is ignored if panic count is zero.

---

## Runtime God Mode Toggle ✓ implemented

`G` key toggles `SharedPlayerState.godMode` at runtime without reloading. Visible in overlay (`God: ON/off`). Also settable via `DebugConfig.godMode` for sessions that should start with it on.
