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
| [PLAN-ui.md](PLAN-ui.md) | Audio, menus, HUD, pause, game over/victory screens, scoring system |
| [PLAN-architecture.md](PLAN-architecture.md) | Build tooling, project structure, scenes, entity/component design, collision, event bus, systems, vertical slice scope |

---

## TBD — Still to Plan

- Save system — deferred; desktop (Tauri) saves to local disk via Tauri file system API; browser version requires persistent server or cloud storage (larger architectural decision to be made separately)
