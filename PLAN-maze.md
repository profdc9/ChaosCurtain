# ChaosCurtain — Maze & Room System

## Maze Generation

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

---

## Room Sizing

- Base unit is a grid cell
- Adjacent passable cells may be merged into a single larger rectangular room
- Merged rooms have larger dimensions along one axis (e.g. two cells → one double-width room)
- Doors only exist at boundaries between distinct rooms

---

## Difficulty Gradient

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

## Room & Door Visuals

### Walls
- Drawn as heavy light blue lines only — no fill, no shading
- Pure vector display aesthetic: lines define the boundary, nothing else
- Gaps cut into the line where doors exist

### Doors
- Drawn as a **narrow hollow white rectangle** across the door gap (stroke only, no fill — vector display authentic)
- **Locked** (enemies still alive): full-length rectangle, player cannot pass; touching it does nothing
- **Unlocked** (room cleared): full-length rectangle, player touching it triggers the open animation
- **Opening animation**: rectangle shrinks along its long dimension (horizontal on N/S walls, vertical on E/W walls) until it disappears
- **Transition fires** when the bar is fully gone — player is placed at the opposite door in the new room
- **Entry door** in the new room starts open and immediately plays the close animation (expands into place) to show the door sealing behind the player
- Cleared rooms: doors stay open (no rectangle) and player can pass freely in both directions

### Door Trigger
- Player must physically touch (collide with) the door bar to initiate opening
- The bar is both the visual element and the collision body
- When the room is not yet cleared, the bar acts as a solid wall segment
