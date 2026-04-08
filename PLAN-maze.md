# ChaosCurtain — Maze & Room System

## Maze Generation ✓ implemented

- Procedurally generated, simply connected (perfect) maze — no loops, one path between any two rooms
- Single entry point `(0,0)` and single exit point (farthest cell by BFS from entry)
- Seeded PRNG (Mulberry32 in `src/utils/SeededRandom.ts`) — any seed fully reproduces the maze
- `src/maze/MazeGenerator.ts` — recursive backtracking DFS; outputs `MazeResult` with `rooms`, `startRoomId`, `exitRoomId`
- `src/rooms/MazeGraph.ts` — calls `generateMaze(MAZE_GEN.SEED, MAZE_GEN.GRID_W, MAZE_GEN.GRID_H)`; exports `MAZE`, `START_ROOM_ID`, `EXIT_ROOM_ID`
- Tunable via `MAZE_GEN` constants: `GRID_W` (default 5), `GRID_H` (default 4), `SEED`
- Tunable parameters (partially implemented):
  - Grid dimensions ✓
  - Enemy density per room ✓ (scales with difficulty tier)
  - Room merge probability — deferred (requires variable room dimensions + camera)
  - Spawner count per room — deferred (spawners not yet implemented)
  - Pickup density — deferred (pickups not yet implemented)
  - Boss room frequency — deferred (bosses not yet implemented)

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

### Cleared Rooms ✓ implemented
- All enemies and spawner machines destroyed
- `RoomManager` tracks cleared room IDs in a persistent `Set<string>` across transitions
- On re-entry: no enemies spawned, doors unlock immediately
- Doors permanently open (green) — player can freely backtrack
- Pickups respawn on room entry or on a periodic timer — deferred (pickups not yet implemented)

### Uncleared Rooms ✓ implemented
- If the player exits before clearing, the room fully resets to its initial state
- Player can re-enter and attempt again — reset applies every time they leave without clearing
- Door-blocking enemies deliberately position between players and exits to make fleeing costly — deferred (door-blocker movement behavior not yet implemented)

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

### Doors ✓ implemented
- Drawn as a **narrow hollow rectangle** across the door gap (stroke only, no fill — vector display authentic)
- **Locked** (enemies still alive): white rectangle, player cannot pass; touching it does nothing
- **Unlocked** (room cleared): green rectangle, player touching it triggers the open animation
- **Opening animation**: rectangle shrinks along its long dimension (horizontal on N/S walls, vertical on E/W walls) until it disappears
- **Transition fires** when the bar is fully gone — player is placed at the opposite door in the new room
- **Entry door** in the new room starts open and immediately plays the close animation (expands into place) to show the door sealing behind the player
- Cleared rooms: doors stay open (no rectangle) and player can pass freely in both directions

### Door Trigger
- Player must physically touch (collide with) the door bar to initiate opening
- The bar is both the visual element and the collision body
- When the room is not yet cleared, the bar acts as a solid wall segment
