# ChaosCurtain — Game Design Plan

## Contents

| File | Topics |
|---|---|
| [PLAN-tech.md](PLAN-tech.md) | Technology stack, visual style, input controls |
| [PLAN-maze.md](PLAN-maze.md) | Maze generation, room sizing, difficulty gradient, room state & progression |
| [PLAN-combat.md](PLAN-combat.md) | Co-op system, player ship, spawner machines, collision rules |
| [PLAN-visuals.md](PLAN-visuals.md) | Hit feedback, damage color shift, destruction animation |
| [PLAN-enemies.md](PLAN-enemies.md) | Enemy architecture, movement/attack behaviors, all enemy types |
| [PLAN-weapons.md](PLAN-weapons.md) | Primary weapon, upgrades, shield, panic button, damage resolution, balance notes |
| [PLAN-debug.md](PLAN-debug.md) | Debug menu, DebugConfig overrides, debug overlay, enemy/upgrade/pickup testing tools |
| [PLAN-audio.md](PLAN-audio.md) | Web Audio + ZzFX SFX, ZzFXM BGM, proximity warnings (planned), DebugConfig toggles |
| [PLAN-ui.md](PLAN-ui.md) | Menus, HUD, pause, game over/victory screens, scoring system |
| [PLAN-architecture.md](PLAN-architecture.md) | Build tooling, project structure, scenes, entity/component design, collision, event bus, systems, vertical slice scope |

---

## Completed / shipped (April 2026)

- **Gameplay pause** — Excalibur 0.29 rejects `engine.timescale <= 0`. Soft pause uses `src/utils/GameplayPause.ts`: `setGameplayPaused` / `freezeActorIfGameplayPaused`, which stashes and restores each actor’s linear and angular velocity so physics does not advance while logic is skipped.
- **Pause overlay** — `src/ui/PauseOverlay.ts` (`ScreenElement`): dimmed dialog, Resume / Quit to menu, ESC + arrows + Enter + mouse + gamepads; wired in `GameplayScene`.
- **Quit → main menu** — Returning from gameplay replaces the `GameplayScene` instance (`removeScene` / `addScene`) so the old run does not keep updating behind the menu; `onDeactivate` clears `GameEvents` subscriptions and `RoomManager.detachGlobalListeners()`.
- **Main menu input** — `MainMenuScreen` blocks pointer activation until release after scene show / settings return, avoiding the quit click immediately firing Start.
- **Background music** — `src/audio/roomTrackerMusic.ts`: several converted MODs as `export default` ZzFXM songs; playlist starts after audio unlock; each module **loops in-room**; **`room:entered`** picks a new random track (reduces decode hitches vs. chaining on every song end); `ZzfxmMusicPlayer` supports loop flag, buffer cache key, and optional `onEnded`.
- **Enemy / boss tuning** — Additional constants for Zapsphere spiral, GlitchBoss arrow phase timing (see `src/constants/index.ts`).

---

## TBD — Still to Plan

- Save system — deferred; desktop (Tauri) saves to local disk via Tauri file system API; browser version requires persistent server or cloud storage (larger architectural decision to be made separately)
