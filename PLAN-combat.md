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
- Spawn one enemy every N seconds (N = `lerp(SPAWN_INTERVAL_SLOW=6s, SPAWN_INTERVAL_FAST=1.5s, difficulty)`)
- First spawn fires at `interval × INITIAL_DELAY_FACTOR` (0.5) so rooms feel active immediately
- Multiple may appear in a single room; count and enemy type distribution scale with difficulty

### Boss Spawners
- Spawn exactly one boss enemy when the player enters the room, then sit idle
- A room may contain both a boss spawner and regular spawners simultaneously — deferred (bosses not yet implemented)

### Visual Design ✓ implemented
- Box (40×40) drawn with a heavy line: white when at full health, shifts to red as damaged
- Box contains a miniature portrait of the enemy type it spawns:
  - Wanderer spawner: small gray square
  - Dart spawner: small cyan chevron
- Subject to the same scale pulse hit feedback as enemies
- On destruction: 4 box-side segments fly apart with the burning fragment animation; emits `enemy:died`

---

## Collision Rules

- If an enemy or spawning machine collides with a player, both the colliding object and the player take damage
- Collision damage and bullet damage values are tuned independently per enemy type
- The scale pulse hit feedback applies to both the player and the colliding object
