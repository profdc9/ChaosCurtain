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
