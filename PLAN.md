# ChaosCurtain — Game Design Plan

## Technology Stack

- **Language:** TypeScript
- **Game Engine:** Excalibur.js (TypeScript-native, clean OOP/component architecture)
- **Renderer:** WebGL with Canvas 2D fallback (built into Excalibur)
- **Desktop:** Tauri (already installed)
- **Target:** Browser and standalone desktop

---

## Visual Style

- Vector graphics aesthetic — geometry drawn as lines, polygons, and circles
- No bitmap sprites; all visuals are procedurally drawn primitives
- Antialiased lines via Excalibur's built-in `antialias` option (enabled by default)
- No phosphor persistence effect (deferred for performance reasons)

---

## Input

### Mouse + Keyboard
- **WASD** — move
- **Mouse** — aim / shoot direction

### Gamepad
- **Left analog stick** — move
- **Right analog stick** — aim / shoot direction

### Input Abstraction
- Both schemes normalize to a **movement vector** and an **aim vector**
- Game logic never needs to know which device is active
- Supports simultaneous use: Player 1 gamepad, Player 2 mouse+keyboard (or both gamepad)

---

## Maze & Room System

### Maze Generation
- Procedurally generated, simply connected (perfect) maze — no loops, one path between any two rooms
- Single entry point and single exit point
- Seeded PRNG — any maze is fully reproducible from its seed
- Tunable parameters:
  - Grid dimensions (4×4 to 8×8)
  - Room merge probability
  - Enemy density per room
  - Spawner count per room
  - Pickup density
  - Boss room frequency

### Room Sizing
- Base unit is a grid cell
- Adjacent passable cells may be merged into a single larger rectangular room
- Merged rooms have larger dimensions along one axis (e.g. two cells → one double-width room)
- Doors only exist at boundaries between distinct rooms

### Difficulty Gradient
- Each room is assigned a difficulty based on its **graph distance from the exit** (computed via BFS after generation)
- Rooms far from exit = easy (near start)
- Rooms near exit = hard
- Serves as a "hot/cold" navigation signal — harder enemies = moving toward exit
- Boss rooms placed near the exit
- Pickup quality may scale inversely with difficulty (better rewards near the exit)

---

## Room State & Progression

### Cleared Rooms
- All enemies and spawner machines destroyed
- Doors permanently open
- Player can freely backtrack through cleared rooms
- Pickups respawn on room entry or on a periodic timer

### Uncleared Rooms
- If the player exits before clearing, the room fully resets to its initial state
- Player can re-enter and attempt again — reset applies every time they leave without clearing
- Door-blocking enemies deliberately position between players and exits to make fleeing costly

### Navigation Flow
- Player starts at the maze entry room
- Clears rooms to expand their safe network
- Must reach and clear the exit room to complete the run

---

## Spawner Machines

- Persistent objects within a room that continuously spawn enemies until destroyed
- Spawn enemies on a timer or wave pattern
- Boss rooms contain a specialized spawner that produces the boss enemy
- Room is not cleared until all machines AND all enemies are destroyed

---

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

## Visual Feedback Systems

### Hit Feedback — Scale Pulse
Applies to: players, enemies, spawner machines

- On hit, the object scales up then returns to normal size
- Duration maps to damage magnitude:
  - Light hit: ~0.3 seconds (fast pulse)
  - Major hit: ~2.0 seconds (slow swell and recession)
- Scale rate also maps to damage — light hits pulse quickly, heavy hits swell and recede slowly
- Peak scale size TBD (e.g. 1.3× normal)
- Implemented as a smooth ease-in/ease-out tween on the scale property

### Damage Color Shift
Applies to: enemies, spawner machines (not players)

- Objects start with their base color (little to no red component)
- Color interpolates continuously toward red as health depletes:
  - Full health → base color
  - ~50% health → base color mixed with red
  - Near death → predominantly red
- Enemy base colors should be chosen with high blue or green components for maximum readability of the red shift
- No health bars needed — color is the health indicator

### Destruction Animation — Burning Fragments
Applies to: enemies, spawner machines

- On destruction, constituent geometry (lines, circles, polygons) separates into individual fragments
- Each fragment receives:
  - Random outward velocity
  - Random angular spin
  - Slight deceleration/drag
  - Fade from bright white/yellow → orange → dim red → transparent
  - Duration: ~0.5–1.5 seconds
- Objects must be built as collections of named, separable geometric components
- More complex objects produce more dramatic destruction animations

---

## TBD — Still to Plan

- Enemy types and behaviors
- Weapon variety and upgrades
- Pickup/upgrade categories
- Boss designs
- Audio
- Menus and UI
- Save system (seeds, high scores, etc.)
