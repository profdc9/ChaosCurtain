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

### Device assignment ✓ implemented (menu)
- **`GameSettings`** (`src/settings/GameSettings.ts`) stores per-player **control scheme**: keyboard+mouse (at most one player) or **gamepad 1–4** (indices 0–3). Loaded at boot from **`localStorage`**; edited from **Settings** on the main menu.
- Each **`PlayerActor`** owns an **`InputSystem`** constructed with that scheme only — there is **no** global “prefer gamepad then fall back” merge anymore.
- Radial deadzone (`GAMEPAD_DEADZONE`) with smooth rescaling still applies to **gamepad** sticks.
- **Not implemented:** in-menu “test controls” mini-scene; audio volume sliders in Settings (see `PLAN-ui.md`).

### Ship Rotation ✓ implemented
- Ship rotates to face the **aim direction** when non-zero (right stick or mouse cursor)
- Falls back to **movement direction** when only moving with no aim input

### Input Abstraction ✓ implemented
- `InputSystem` normalizes both schemes to `{ move: Vector, aim: Vector, isFiring: boolean }`
- `PlayerActor` and all game logic are device-agnostic
- Co-op: each `PlayerActor` has its own `InputSystem` instance; schemes are whatever the player chose (e.g. P1 gamepad, P2 mouse+keyboard, or both gamepad).
