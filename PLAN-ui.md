# ChaosCurtain — UI, Menus & Scoring

## Visual Style — UI

- All UI elements drawn as vector line graphics — boxes, buttons, borders are stroked lines only
- Fonts rendered as stroke-based vector characters (Asteroids/Tempest style) — each letter is a series of line segments
- No bitmap fonts, no filled shapes — fully consistent with the game aesthetic
- **Implemented:** Hershey futural vector font via `StrokeFont` class (`src/ui/StrokeFont.ts`)
  - Font data pre-extracted to a static JSON (`src/ui/hershey-futural.json`) — no runtime Node.js dependency
  - `StrokeFont.draw(ctx, text, x, y, size, color, lineWidth, coarseness)` renders stroked text to any Canvas 2D context
  - `StrokeFont.measure(text, size)` returns rendered width without drawing
  - **Coarseness control** (`FONT_COARSENESS = 5`): accumulates segment lengths along each path; only commits a new line segment once the threshold is exceeded, producing angular/coarse letterforms authentic to low-resolution vector displays. Final point of each path is always included to close curves correctly.

---

## Start Screen — Implemented

- Full-screen overlay (`src/ui/StartScreenOverlay.ts`) rendered at z=1000 above all game actors
- Title "CHAOS CURTAIN" in `ROOM.WALL_LINE_COLOR` (light blue) at size 72 via `StrokeFont`
- Prompt "PRESS ANY KEY OR CLICK TO START" in white at size 28
- First `keydown` or `pointerdown` on `document` dismisses the overlay and unlocks Web Audio simultaneously
- Note: gamepad button presses do not satisfy browser autoplay policy — keyboard/mouse required once before gamepad play

---

## Pickup Spawning — Implemented

- Test pickups removed from scene; pickups now spawn dynamically during gameplay
- Timer fires every 60–120 seconds (randomised per interval) in `GameplayScene.onPreUpdate`
- Spawn position: random interior point with 80 px margin from room walls
- Type selection: equal-weight random draw from the pool of types the player still needs:
  - `health` — only if below max health
  - `shooterType` — only if below level 3
  - `weaponPower` — only if below `UPGRADE.MAX_WEAPON_POWER`
  - `shield` — only if below `UPGRADE.MAX_SHIELD_LEVEL`
  - `panicButton` — only if below `UPGRADE.MAX_PANIC_COUNT`
  - `extraLife` — always included
- Pickups persist in the scene until collected (not tied to room transitions)

---

## Main Menu ✓ partial

**Implemented in code:** `MainMenuScene` / `MainMenuScreen` — **Start Game** (runs audio prep then `goToScene('gameplay')`), **Settings** (`SettingsScreen`), **Quit** (row present; no action wired). Vector **`StrokeFont`** styling on menu copy.

**Settings screen (`SettingsScreen`) today:**
- **Difficulty** — easy / moderate / hard (maps to incoming-damage scale via `SharedPlayerState.damageScale`)
- **Players** — one or two (two = co-op: two `PlayerActor`s, one `SharedPlayerState`; see `PLAN-combat.md`)
- **Per-player controls** — keyboard+mouse (max once) or gamepad index per slot; persisted with other settings

**Still design / not in menu yet:** Test Controls mini-scene; music / SFX volume sliders; **Secret keypress** for maze seed entry (useful for testing and sharing specific mazes)

---

## HUD (minimal, arcade style)

| Element | Description |
|---|---|
| Score | Current total score |
| Multiplier | Current kill streak multiplier; hidden or shows 1× when inactive; flashes/pulses when active |
| Room timer | Time elapsed since entering current room |
| Health bar | Shared health pool — white outline rectangle, zig-zag fill in saturated green (#00ff00) proportional to health; no solid fill (vector authentic) |
| Fleet count | Lives remaining |
| Shooter type | Upgrade level indicator |
| Weapon power | Square-with-dot icon × level |
| Shield | Box-with-X icon × level + charge indicator |
| Panic buttons | Top hat icon × count |

**Implemented in `HUD.ts` today:** health bar (zig-zag), fleet × ship icon, score, shooter / weapon power / shield / panic indicators. **Not implemented yet:** multiplier line, room timer (and streak logic — see `SCORE` constants unused in gameplay).

---

## Pause Menu

- Resume
- Quit

**Current code:** no pause overlay or scene — design only.

---

## Game Over / Victory Screen

- Final score
- Rooms cleared
- Enemies destroyed by type (one count per enemy type: Wanderer, Dart, Wrangler, Satellite, Worm, Blaster, Bird, Snake, Zapsphere, GlitchBoss)
- Time elapsed (total run)

**Current code:** no dedicated `GameOverScene` / `VictoryScene`; fleet loss and game over emit events (`fleet:lost`, `game:over`) for audio. **`game:won` is never emitted** — clearing the exit room does not yet trigger a win flow or UI.

---

## Scoring System

### Per-Enemy Points
Each enemy type has a base point value. Rough hierarchy (exact values TBD during balancing):

Wanderer < Dart < Worm < Satellite < Blaster < Wrangler < Bird < Snake < Zapsphere < GlitchBoss

Bosses worth significantly more than regular enemies.

**Implemented:** points from `enemy:died` / spawner death accumulate in `SharedPlayerState.score` (per-type values live in `src/constants/index.ts`).

### Room Clear Bonus
- Awarded when all enemies and spawners in a room are destroyed
- Scales with room difficulty — harder rooms yield larger bonuses

**Not implemented** — no bonus score on `room:cleared`.

### Time Bonus
- Awarded on room clear based on speed of clear
- Faster clear = larger bonus
- Incentivizes aggressive play over cautious farming

**Not implemented.**

### Kill Streak Multiplier
- Triggered when a threshold number of enemies are destroyed within a rolling 10-second window
- Multiplier increases with successive kills within the window
- Resets when the window expires without enough kills
- Example tiers (defaults exist as `SCORE.STREAK_*` in constants — **not wired** to `addScore` yet):
  - 3 kills / 10s → 2×
  - 5 kills / 10s → 3×
  - 8 kills / 10s → 4×
- Multiplier display on HUD flashes/pulses when active to reinforce urgency of maintaining the streak

**Not implemented** (constants only).
