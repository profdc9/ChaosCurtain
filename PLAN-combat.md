# ChaosCurtain — Combat, Co-op & Player

## Co-op System

**Current code:** `GameplayScene` reads **`getGameSettings()`** (`src/settings/GameSettings.ts`). With **two players**, it constructs **two** `PlayerActor` instances (P1 light blue, P2 light green per `PLAYER.COLOR_*`) that **share one** `SharedPlayerState` — same health pool, fleet, upgrades, score, and panic. Each ship has its own **`InputSystem`** bound to the menu-assigned **control scheme** (keyboard+mouse at most once across both; otherwise distinct gamepad indices). `RoomManager` accepts an optional second player; **`SpawnerActor`** resolves the **nearest** ship when spawning so homing / tether / boss logic targets one ref per spawn.

### Players
- 1 or 2 players (chosen in **Settings** on the main menu)
- Player 1: light blue ship
- Player 2: light green ship

### Room Transition (Co-op) ✓ implemented

**Design (from spec):**
- Both players must exit through the **same** door for that transition
- Room transition triggers only when **both** have passed through
- Room state does not change until then (no `load` of the next room until both qualify)

**What the code does (`RoomManager` + `DoorActor` + `GameplayScene.onPostUpdate` → `tickCoopPassageOverlap`):**
- **Solo:** unchanged — first touch opens the door; when the bar finishes opening, **`load(targetRoom, entrance)`** runs immediately.
- **Co-op:** the **first** player to touch an unlocked exit starts the door opening. When the bar finishes, an **inflated world-space passage rectangle** is stored on `RoomManager` (see `coopPassageWorldBoundsInflated`). **`load` does not run yet.** Each frame after movement, **`tickCoopPassageOverlap`** tests each ship’s **circle collider** vs that rect (`GameplayScene.onPostUpdate`). When **both** overlap (order free; flags are **sticky**), **`load`** runs and both ships are placed at the new room’s entrance offsets.
- While waiting for the second player, **other exits cannot start opening** (`canPlayerStartOpeningDoor` is false for every door except the side already committed in `coopPending`). The first player can stand in the passage / doorway area (“waiting on the other side” of the wall line) without changing rooms until the partner arrives.
- **Implementation detail:** there is no separate physics “limbo room”; the next room is still loaded only after both qualify, as above.

### Shared Health & Lives
- Single shared health bar drawn from by either player taking damage
- Shared fleet (lives) — a pool of ships both players draw from
- Health depletes → one ship lost from fleet, health resets
- Fleet depleted → game over for both players simultaneously
- No friendly fire
- System is identical for single player (no special casing)

### Death & Respawn
- When health depletes: **both** player actors use **`setFleetLossFrozen`** during the fragment delay, then **`respawnAfterFleetLoss`** reloads the prior room and repositions **both** ships at the entrance when co-op is active
- If in an uncleared room: room resets on respawn
- If in a cleared room: respawn at the entry door, health restored

---

## Player Ship Design

### Geometry
- Long narrow isosceles triangle, apex pointing in direction of movement/aim
- Two small circles centered at the two base corners (rear — engine nacelles)
- All drawn as vector primitives

### Colors
- Player 1: light blue
- Player 2: light green

---

## Spawner Machines ✓ implemented

- Persistent objects within a room that continuously spawn enemies until destroyed
- Room is not cleared until all machines AND all active enemies are destroyed
- `RoomManager.liveCount` = spawner count + live enemy count; room clears at 0
- Enemies are no longer pre-placed in rooms; all enemies emerge from machines

### Regular Spawners ✓ implemented
- Base interval: `lerp(SPAWN_INTERVAL_SLOW, SPAWN_INTERVAL_FAST, difficulty)` with values from `SPAWNER` in `src/constants/index.ts` (**currently 4.0 s → 1.0 s** across difficulty 0→1)
- Each enemy type has its own `INTERVAL_MULTIPLIER` applied on top: `spawnInterval = base × multiplier`
  - Wanderer 1.0×, Worm 1.2×, Dart 1.5×, Satellite 1.5×, Wrangler 2.0×, Blaster 2.5×
- First spawn fires at `spawnInterval × INITIAL_DELAY_FACTOR (0.5)` so rooms feel active immediately
- Multiple may appear in a single room; count and enemy type distribution scale with difficulty

#### Spawn throttle near cap
- `MAX_LIVE_ENEMIES` (**30** in `SPAWNER`) is used in the probability gate, not as a hard spawn cap
- When a spawner's timer fires, a probabilistic check gates the spawn:
  `threshold = liveCount × SPAWNING_PRIORITY / MAX_LIVE_ENEMIES`
  Spawn succeeds if `random() > threshold`
- Each type has its own `SPAWNING_PRIORITY`:
  - Wanderer 0.8, Worm 0.6, Satellite 0.35, Dart 0.4, Wrangler 0.2, Blaster 0.1
- Higher priority = more aggressively throttled as count rises (weaker enemies yield slots)
- Lower priority = pushes through even at high counts (harder enemies maintain spawn rate)
- Effect: as the room fills, composition shifts toward harder enemy types; player cannot exploit
  the cap by keeping weak enemies alive to block dangerous spawns

### Boss Spawners ✓ implemented
- `oneShot = true`: timer initialised to 0 (fires immediately on room entry), then set to `Infinity`
- A boss room contains one boss spawner + 1–2 regular fodder spawners
- **Boss room assignment** (`MazeGenerator.ts`, four hardest non-exit rooms by difficulty): **GlitchBoss** (hardest), **Zapsphere** (2nd), **Snake** (3rd), **Bird** (4th — first boss encountered on the hardest→easiest ordering used in code)

### Visual Design ✓ implemented
- Box (40×40) drawn with a heavy line: white when at full health, shifts to red as damaged
- Box contains a miniature portrait of the enemy type it spawns:
  - Wanderer: small gray square; Dart: small cyan chevron; Wrangler: green circle + yellow satellites
  - Satellite: blue circle + gray spokes; Worm: brown circles + yellow line; Blaster: 5 spike lines
  - Bird boss: yellow V-wings + head V; Snake boss: chain of green circles; Zapsphere boss: cyan ring + gray square; Glitch boss: white box + green arrow
- Subject to the same scale pulse hit feedback as enemies
- On destruction: 4 box-side segments fly apart with the burning fragment animation; emits `enemy:died`

---

## Collision Rules

- If an enemy or spawning machine collides with a player, both the colliding object and the player take damage
- Collision damage and bullet damage values are tuned independently per enemy type
- The scale pulse hit feedback applies to both the player and the colliding object
