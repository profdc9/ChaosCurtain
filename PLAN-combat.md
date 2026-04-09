# ChaosCurtain — Combat, Co-op & Player

## Co-op System

### Players
- 1 or 2 players
- Player 1: light blue ship
- Player 2: light green ship

### Room Transition (Co-op)
- Both players must exit through the same door
- First player to reach the door enters a waiting state on the other side
- Room transition triggers only when both players have passed through
- Room state does not change until both players have exited

### Shared Health & Lives
- Single shared health bar drawn from by either player taking damage
- Shared fleet (lives) — a pool of ships both players draw from
- Health depletes → one ship lost from fleet, health resets
- Fleet depleted → game over for both players simultaneously
- No friendly fire
- System is identical for single player (no special casing)

### Death & Respawn
- When health depletes: both players respawn at the door they entered from
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
- Base interval: `lerp(SPAWN_INTERVAL_SLOW=6s, SPAWN_INTERVAL_FAST=1.5s, difficulty)`
- Each enemy type has its own `INTERVAL_MULTIPLIER` applied on top: `spawnInterval = base × multiplier`
  - Wanderer 1.0×, Worm 1.2×, Dart 1.5×, Satellite 1.5×, Wrangler 2.0×, Blaster 2.5×
- First spawn fires at `spawnInterval × INITIAL_DELAY_FACTOR (0.5)` so rooms feel active immediately
- Multiple may appear in a single room; count and enemy type distribution scale with difficulty

#### Spawn throttle near cap
- `MAX_LIVE_ENEMIES = 20` is a soft target, not a hard cutoff
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
- Snake boss assigned to the hardest non-exit room; Bird boss to second hardest

### Visual Design ✓ implemented
- Box (40×40) drawn with a heavy line: white when at full health, shifts to red as damaged
- Box contains a miniature portrait of the enemy type it spawns:
  - Wanderer: small gray square; Dart: small cyan chevron; Wrangler: green circle + yellow satellites
  - Satellite: blue circle + gray spokes; Worm: brown circles + yellow line; Blaster: 5 spike lines
  - Bird boss: yellow V-wings + head V; Snake boss: chain of green circles
- Subject to the same scale pulse hit feedback as enemies
- On destruction: 4 box-side segments fly apart with the burning fragment animation; emits `enemy:died`

---

## Collision Rules

- If an enemy or spawning machine collides with a player, both the colliding object and the player take damage
- Collision damage and bullet damage values are tuned independently per enemy type
- The scale pulse hit feedback applies to both the player and the colliding object
