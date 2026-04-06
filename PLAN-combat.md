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

## Spawner Machines

- Persistent objects within a room that continuously spawn enemies until destroyed
- Spawn enemies on a timer or wave pattern
- Boss rooms contain a specialized spawner that produces the boss enemy
- Room is not cleared until all machines AND all enemies are destroyed

### Visual Design
- A box drawn with a heavy white line
- Box contains a miniature portrait of the enemy type it spawns — immediately readable
- White line shifts to red as the machine takes damage (consistent with global damage color language)
- Subject to the same scale pulse hit feedback as enemies and players
- On destruction: box segments and portrait components fly apart with the burning fragment animation

---

## Collision Rules

- If an enemy or spawning machine collides with a player, both the colliding object and the player take damage
- Collision damage and bullet damage values are tuned independently per enemy type
- The scale pulse hit feedback applies to both the player and the colliding object
