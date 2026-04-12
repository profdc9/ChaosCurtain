# ChaosCurtain — Implementation Architecture

## Build Tooling

- **Vite** — TypeScript compilation, hot module replacement, browser and Tauri build targets
- **Tauri** — desktop wrapper; Vite is Tauri's default frontend tooling
- No additional bundler configuration needed for Excalibur + Vite

---

## Project Structure

```
src/
  scenes/        -- Excalibur scenes
  actors/        -- Excalibur Actors (Player, enemies, spawners, pickups, doors, bullets)
  components/    -- Reusable Excalibur Components
  systems/       -- Standalone game systems
  maze/          -- Maze generation and room graph
  ui/            -- HUD, vector stroke font, UI widgets
  audio/         -- Web Audio (AudioManager), ZzFX bake/play (ZzfxSoundBank, ZzfxSfxSystem), ZzFXM music
  constants/     -- ALL tunable values (damage, speeds, timings, point values)
  utils/         -- Shared utilities (vector math, PRNG, typed event bus)
  main.ts        -- Entry point
```

---

## Scene Structure

| Scene | Purpose |
|---|---|
| `MainMenuScene` | Main menu navigation; **settings** are an in-scene `SettingsScreen` overlay, not a separate scene |
| `GameplayScene` | Core game loop — owns `RoomManager`, players, HUD, debug overlay, **`PauseOverlay`** (not a separate pause scene) |
| `PauseScene` | *Design target* — today: `PauseOverlay` `ScreenElement` inside `GameplayScene` |
| `GameOverScene` | Defeat screen with stats |
| `VictoryScene` | Win screen with stats |
| `TestControlsScene` | Input verification screen |
| `SettingsScene` | *Design target* — today: `SettingsScreen` inside `MainMenuScene` |

**`main.ts` today:** registers **`menu`** and **`gameplay`** scenes; start goes to `menu`. Quitting gameplay switches to `menu`, then **`gameplay` is removed and re-registered** so the next Start gets a new scene instance (Excalibur does not re-run `onInitialize` on reused scenes).

---

## Entity/Component Architecture

Each enemy is an **Excalibur Actor**. Behaviors are **Components** attached to the Actor. New enemy types are defined by composing existing components — no new logic required for combinations of existing behaviors.

### Reusable Components

| Component | Responsibility |
|---|---|
| `GeometryComponent` | Owns list of geometric primitives; handles color shift on damage and fragment explosion on death |
| `HealthComponent` | Health pool, damage threshold check, scale pulse trigger |
| `MovementComponent` | Pluggable movement strategy (Wanderer, Chaser, Spiral, DoorBlocker, etc.) |
| `AttackComponent` | Pluggable attack strategy (Tether, Lightning, DeathRay, etc.) |
| `CollisionComponent` | Collision damage rules — immune flag, damage values |
| `DifficultyScalingComponent` | Scales speed, health, and timing based on room difficulty value |

### Player Architecture

Two independent `PlayerActor` instances share one `SharedPlayerState` object:

```
PlayerActor (P1)  ──┐
                    ├──▶  SharedPlayerState
PlayerActor (P2)  ──┘
```

**`SharedPlayerState` owns:**
- Health pool
- Fleet count (lives)
- Shooter type upgrade level
- Weapon power upgrade level
- Shield level + charge
- Panic button count
- Current score

**Each `PlayerActor` owns:**
- Position and velocity
- Aim direction
- Input source (gamepad index or mouse+keyboard)
- Visual geometry (color, ship shape)
- Current tether references (Wrangler links)
- Glitch state (GlitchBoss cone effect)

---

## Collision System

Uses **Excalibur's built-in sparse hash grid** broad phase — efficient for many similarly-sized moving objects (bullets). Collision groups eliminate unnecessary pair checks:

| Group | Collides With |
|---|---|
| `bullets` | enemies, spawners, players |
| `enemies` | players, walls |
| `players` | enemies, spawners, walls, pickups |
| `walls` | players, enemies |
| `pickups` | players |

Bullets do NOT collide with other bullets or walls. Enemies do NOT collide with each other.

Collision events fire automatically into the event bus.

---

## Event Bus

A single typed global `GameEvents` bus. All cross-system communication goes through it. Per-frame logic (movement, rendering) stays in actor update loops — events fire only for discrete state changes, keeping overhead low.

### Event Catalog

| Event | Publisher | Subscribers (representative) |
|---|---|---|
| `enemy:hit` | Enemy actors | `ZzfxSfxSystem`, … |
| `enemy:died` | Enemy actors | `ZzfxSfxSystem`, `RoomManager`, … |
| `player:hit` | `SharedPlayerState` | `ZzfxSfxSystem`, HUD, … |
| `player:upgraded` / `player:downgraded` | `SharedPlayerState` | `ZzfxSfxSystem`, HUD |
| `bullet:fired` | `PlayerActor` | `ZzfxSfxSystem` |
| `panic:deployed` | `SharedPlayerState` | `ZzfxSfxSystem` |
| `pickup:collected` | `PickupActor` | `ZzfxSfxSystem` |
| `room:entered` / `room:cleared` | `RoomManager` | `ZzfxSfxSystem`, HUD, … |
| `enemy:spawned` | `SpawnerActor` | `ZzfxSfxSystem` |
| `wrangler:tether` / `zapsphere:warning` | respective actors | `ZzfxSfxSystem` (ref-counted loops) |
| `zapsphere:lightning` | `ZapsphereActor` | `ZzfxSfxSystem` |
| `score:changed` / `health:changed` | `SharedPlayerState` | HUD (no SFX today) |
| `fleet:lost` / `game:over` | `SharedPlayerState.applyDamage` | `ZzfxSfxSystem` |
| `game:won` | *(not emitted yet — no victory transition wired)* | `ZzfxSfxSystem` listens (fanfare ready) |

Full typed list: `src/utils/GameEvents.ts`.

---

## Standalone Systems

Live in `src/systems/` — independent of any single actor:

| System | Responsibility |
|---|---|
| `InputSystem` ✓ | Per-`PlayerActor` instance: normalizes **assigned** scheme (gamepad index or keyboard+mouse) to movement/aim/fire/panicPressed; device-agnostic output |
| `MazeGenerator` ✓ | Generates room graph from seed + tunable parameters; outputs node/edge structure (`src/maze/MazeGenerator.ts`) |
| `RoomManager` ✓ | Tracks room state (including cleared set), triggers transitions, handles room reset (`src/rooms/RoomManager.ts`) |
| `DamageSystem` ✓ | Implemented inside `SharedPlayerState.applyDamage` — shield absorption → health → threshold → upgrade loss |
| `UpgradeManager` ✓ | Implemented inside `SharedPlayerState` — shooterType, weaponPower, shield, panicButton tracking and application |
| `ScoreManager` | **Deferred as a standalone system.** Today: `SharedPlayerState.addScore` on `enemy:died` only. `SCORE` constants (`STREAK_*`) exist in `src/constants/index.ts` but **are not read** by gameplay code yet — no streak multiplier or room/time bonuses. |
| `AudioManager` | Shared `AudioContext`, `musicGainNode` + `sfxGainNode`, `unlock()` — **active** |
| `ZzfxSfxSystem` | `GameEvents` → baked ZzFX buffers → `sfxGainNode` — **active** (`GameplayScene`) |
| `ZzfxmMusicPlayer` | ZzFXM render + looping BGM on `musicGainNode` — **active** |
| `BulletPool` | Object pool for bullet actors — deferred |

---

## Maze Generator Output ✓ implemented

Generator produces a **room graph**:
- **Nodes** — rooms, each carrying: `difficulty` (0.0 = easy, 1.0 = hardest), `isExit`, enemy spawn list, door positions
- **Edges** — connections between rooms encoded as `DoorDef` arrays with `targetRoomId`

`RoomManager` consumes this graph and instantiates Excalibur actors for the current room on demand. Cleared room IDs are retained in `RoomManager.clearedRooms` across transitions.

---

## Vector Stroke Font

A `StrokeFont` utility class in `src/ui/`:
- Maps each character to an array of line segment coordinates
- Used by HUD, main menu / settings, debug overlay, etc. (dedicated game-over / pause scenes still thin)
- Defined once, used everywhere
- Consistent with the vector display aesthetic

---

## Constants File

All tunable game values live in `src/constants/`:
- Enemy health values
- Damage amounts per enemy type
- Movement speeds
- Upgrade damage threshold
- Shield reduction curve
- Streak timing windows (`SCORE.*` — **present; gameplay not wired**)
- Point values per enemy type
- Room clear and time bonus formulas (**not used in scoring yet**)
- Spawner timing intervals

**Never use magic numbers in game logic.** All values reference named constants for easy balancing iteration.

---

## Development Approach — Vertical Slice First

The project began from a **minimal vertical slice** (single room, one player, one enemy type, basic HUD) to validate input → movement → shooting → collision → damage → feedback.

### Current `main` scope (high level)

**In the tree today:** procedural maze + `RoomManager` room loads, **spawner machines** and full enemy roster, **upgrades and pickups** (scene-level pickup timer), **Web Audio + ZzFX / ZzFXM**, **main menu** (`MainMenuScene` / `MainMenuScreen`) with **settings** (difficulty, 1–2 players, per-player controls; persisted in `localStorage`), **debug overlay** + `DebugConfig` file overrides.

**Still thin vs design docs:** polished **game-over** / victory UI scenes (events exist), kill-streak scoring and room/time bonuses, optional systems like `BulletPool`. **Co-op exit doors** — see `PLAN-combat.md` (same-door + dual passage overlap in `RoomManager.tickCoopPassageOverlap`, called from `GameplayScene.onPostUpdate`). **Pause** is implemented as an overlay + soft pause, not a standalone `PauseScene`.
