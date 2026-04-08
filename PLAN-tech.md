# ChaosCurtain — Technology & Input

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
- **All shapes are outlines/strokes only — no filled shapes anywhere**; consistent with a vector display which draws lines directly
- Antialiased lines via Excalibur's built-in `antialias` option (enabled by default)
- No phosphor persistence effect (deferred for performance reasons)

---

## Input ✓ implemented

### Mouse + Keyboard
- **WASD / Arrow keys** — move
- **Mouse position** — aim; **mouse button held** — fire

### Gamepad ✓ implemented
- **Left analog stick** — move
- **Right analog stick** — aim; pushing stick past `GAMEPAD_FIRE_THRESHOLD` fires

### Device Priority ✓ implemented
- Gamepad is preferred; `InputSystem.getState()` checks `gamepad.connected` each frame and falls back to mouse+keyboard automatically
- Radial deadzone (`GAMEPAD_DEADZONE`) with smooth rescaling applied to both sticks
- Future: configuration screen to override device preference and test controls

### Ship Rotation ✓ implemented
- Ship rotates to face the **aim direction** when non-zero (right stick or mouse cursor)
- Falls back to **movement direction** when only moving with no aim input

### Input Abstraction ✓ implemented
- `InputSystem` normalizes both schemes to `{ move: Vector, aim: Vector, isFiring: boolean }`
- `PlayerActor` and all game logic are device-agnostic
- Co-op: each `PlayerActor` will get its own `InputSystem` instance (P1 gamepad, P2 mouse+keyboard, or both gamepad)
