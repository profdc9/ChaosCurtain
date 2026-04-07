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
  audio/         -- Tone.js wrapper and sound definitions
  constants/     -- ALL tunable values (damage, speeds, timings, point values)
  utils/         -- Shared utilities (vector math, PRNG, typed event bus)
  main.ts        -- Entry point
```

---

## Scene Structure

| Scene | Purpose |
|---|---|
| `MainMenuScene` | Main menu navigation |
| `GameplayScene` | Core game loop — owns the room system |
| `PauseScene` | Overlay on top of GameplayScene |
| `GameOverScene` | Defeat screen with stats |
| `VictoryScene` | Win screen with stats |
| `TestControlsScene` | Input verification screen |
| `SettingsScene` | Audio and control configuration |

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

| Event | Publisher | Subscribers |
|---|---|---|
| `enemy:hit` | DamageSystem | AudioManager |
| `enemy:died` | HealthComponent | ScoreManager, RoomManager, AudioManager |
| `player:hit` | DamageSystem | AudioManager |
| `player:upgraded` | UpgradeManager | AudioManager, HUD |
| `player:downgraded` | DamageSystem | AudioManager, HUD |
| `bullet:fired` | PlayerActor | AudioManager |
| `panic:deployed` | PlayerActor | AudioManager, ScoreManager |
| `room:entered` | RoomManager | AudioManager, ScoreManager, HUD |
| `room:cleared` | RoomManager | ScoreManager, AudioManager |
| `door:opened` | RoomManager | AudioManager |
| `door:closed` | RoomManager | AudioManager |
| `spawn:released` | SpawnerActor | AudioManager |
| `streak:updated` | ScoreManager | HUD |
| `fleet:lost` | DamageSystem | AudioManager, HUD |
| `game:over` | DamageSystem | SceneManager |
| `game:won` | RoomManager | SceneManager |

---

## Standalone Systems

Live in `src/systems/` — independent of any single actor:

| System | Responsibility |
|---|---|
| `InputSystem` | Normalizes gamepad + mouse/keyboard to movement vector + aim vector; device-agnostic output |
| `MazeGenerator` | Generates room graph from seed + tunable parameters; outputs node/edge structure |
| `RoomManager` | Tracks room state, triggers transitions, manages spawner timers, handles room reset |
| `DamageSystem` | Implements full damage resolution flow (shield → health → threshold → upgrade loss) |
| `UpgradeManager` | Tracks and applies shooter type, weapon power, and shield state |
| `ScoreManager` | Score accumulation, streak timer, multiplier, room clear and time bonuses |
| `AudioManager` | Wraps Tone.js; exposes named trigger methods (e.g. `AudioManager.play('enemy:hit')`) |
| `BulletPool` | Object pool for bullet actors — pre-allocates, recycles on despawn, avoids GC spikes |

---

## Maze Generator Output

Generator produces a **room graph**:
- **Nodes** — rooms, each carrying: dimensions, difficulty value (BFS distance from exit), spawner definitions, pickup list, door positions
- **Edges** — connections between rooms with door positions on each side

`RoomManager` consumes this graph and instantiates the actual Excalibur actors for the current room on demand.

---

## Vector Stroke Font

A `StrokeFont` utility class in `src/ui/`:
- Maps each character to an array of line segment coordinates
- Used by all UI rendering — HUD, menus, game over screen, score display
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
- Streak timing windows
- Point values per enemy type
- Room clear and time bonus formulas
- Spawner timing intervals

**Never use magic numbers in game logic.** All values reference named constants for easy balancing iteration.

---

## Development Approach — Vertical Slice First

Start with a minimal but complete game loop before building complex systems:

### Vertical Slice Scope

**Included:**
- Single static room with walls
- One PlayerActor (mouse+keyboard)
- Single-shot white dot bullets
- One Wanderer enemy
- HealthComponent with scale pulse
- Color shift as Wanderer takes damage
- Destruction animation on Wanderer death
- Basic HUD (health bar + score)
- Collision groups configured correctly

**Excluded until slice is validated:**
- Maze generation and room transitions
- Spawner machines
- Co-op / second player
- Upgrades and pickups
- Audio
- Menus
- Additional enemy types

This validates the core architecture (input → movement → shooting → collision → damage → visual feedback) before complexity is layered on top. Structural issues surface early when they are cheap to fix.
