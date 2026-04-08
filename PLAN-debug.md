# ChaosCurtain — Debug & Testing System

## Philosophy

All debug tooling is isolated to a single `DebugScene` and a `DebugConfig` object. Nothing debug-related leaks into normal gameplay code — game systems only check `DebugConfig` at initialization time, not per-frame. Removing debug access is a matter of hiding the menu entry point, not auditing scattered conditionals.

---

## Access

- **Entry point:** Secret keypress on the main menu (same mechanism as the seed entry field) opens the Debug Menu
- Debug Menu is a full `DebugScene` — not an overlay, not a modal — so it has its own clean UI and is clearly separated from normal gameplay
- Game launches normally after confirming debug settings; all overrides apply on that run only (not persisted)

---

## DebugConfig Object

Lives in `src/constants/DebugConfig.ts`. All fields are optional — `undefined` means "use normal game value." A `DEBUG_ENABLED` flag gates whether the debug menu entry point is visible at all (set via build-time env var or a simple compile-time constant).

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

## Debug Menu Sections

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

## Debug Overlay

A **permanent dev tool** — accessible independently of debug mode via a dedicated key combo (e.g. `F3` or backtick `` ` ``). Not hidden behind the debug menu.

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

## Panic Button Input

| Device | Input |
|---|---|
| Keyboard + mouse | `Space` |
| Gamepad | Any of the four face buttons (A/B/X/Y or Cross/Circle/Square/Triangle) |

Panic button fires on press, not hold. Input is ignored if panic count is zero.
