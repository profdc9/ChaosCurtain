# ChaosCurtain — Enemy System

## Architecture

Enemies are composed of independent, combinable parts to keep the system extensible:

- **Geometry** — separable components that fly apart on destruction
- **Movement behavior** — how the enemy moves (composable, reusable)
- **Attack behavior** — bullet patterns (composable, reusable)
- **Health & difficulty scaling** — stats tuned per room difficulty
- **Special traits** — optional flags (door blocker, boss, etc.)

### Design Note
All enemies defined so far are **kinetic threats** — they are the projectiles. Danger comes from contact, not from being shot at. Whether any enemies will fire projectiles is TBD.

---

## Movement Behaviors (reusable)

- **Chaser** — moves directly toward the player
- **Orbiter** — circles the player at a fixed radius
- **Patroller** — moves along a fixed path within the room
- **Wanderer** — moves randomly, changes direction periodically
- **Door blocker** — positions between the player and the nearest door
- **Stationary** — doesn't move (turret-style)
- **Retreater** — moves away from the player, keeping distance
- **Spiral** — moves tangentially to the player with a slow inward radial component

## Attack Behaviors (reusable)

- **Aimed shot** — single bullet fired directly at the player
- **Spread shot** — fan of bullets centered on player direction
- **Ring shot** — bullets fired in all directions simultaneously
- **Spiral shot** — rotating stream of bullets
- **Burst** — rapid succession of aimed shots then a cooldown
- **Predictive** — leads the player's position rather than aiming directly

---

## Enemy Types

### Wanderer
- **Geometry:** Simple square; gray
- **Movement:** Random wandering, bounces/steers away from walls; rotates continuously in a random direction (can change periodically)
- **Attack:** None — purely a collision hazard
- **Threat:** Low individually; dangerous in large numbers by restricting maneuvering space
- **Health:** Low
- **Collision damage:** Light
- **Destruction:** Four line segments fly apart individually, burning fragment animation
- **Role:** Fodder; pairs well with stationary turrets

---

### Dart
- **Geometry:** Single chevron (six line segments), always oriented to face movement direction; cyan
- **Movement:** Homes toward player like a guided missile with a turning radius — steers gradually, not instantly; speed and turning rate scale with room difficulty
- **Attack:** None — purely a collision threat
- **Threat:** Low early game, dangerous at high speed; multiple converging darts are hard to dodge simultaneously
- **Health:** Low
- **Collision damage:** Medium (pointed missile)
- **Destruction:** Six line segments fly apart individually, burning fragment animation
- **Scaling:** Speed and turning rate are direct tunable parameters tied to room difficulty

---

### Wrangler
- **Geometry:** Large central circle (pure green) with four smaller circles (yellow) at 90° intervals, connected by short line segments
- **Movement:** Wanders passively until player enters detection radius, then approaches player
- **Attack:** Deploys a tether line (light yellow) once within ~6× the player ship length
  - Player movement away from the wrangler is resisted — pulled toward the wrangler
  - Player can still move but with reduced effectiveness against the pull direction
  - Multiple wranglers can tether simultaneously, each applying an independent pull vector
  - Tether only breaks when the wrangler is destroyed
  - Tether line disappears instantly on wrangler death
- **Threat:** High — forces immediate prioritization; multiple wranglers create compounding pull vectors
- **Health:** Medium
- **Collision damage:** Medium
- **Destruction:** Central circle, four satellite circles, connecting segments all fly apart; tether snaps and vanishes; burning fragment animation

---

### Satellite
- **Geometry:** Circle (blue) with four lines passing through the center at 45° intervals (0/180, 45/225, 90/270, 135/315°); lines protrude slightly beyond the circle edge giving an 8-pointed spiky appearance; spikes are gray; spikes rotate continuously around the center as the satellite moves
- **Movement:** Spirals inward toward the player — velocity is primarily tangential (perpendicular to the player-satellite line) with a small inward radial component; angular velocity increases with room difficulty
- **Attack:** None — purely a collision threat
- **Threat:** Difficult to hit due to angular velocity; inward spiral creates time pressure — ignoring it allows it to close to collision range; multiple satellites at different radii are extremely difficult to manage
- **Health:** Medium
- **Collision damage:** Medium
- **Destruction:** Circle and eight spike segments fly apart individually, burning fragment animation
- **Scaling:** Angular velocity scales directly with room difficulty

---

### Worm
- **Geometry:** Two brown circles connected by a yellow line; line always oriented along the direction of movement; circles oscillate closer and farther apart as it moves — the line contracts and extends in a crawling inchworm rhythm
- **Movement:** Slowly crawls in the general direction of the player
- **Attack:** None — purely a collision threat
- **Special mechanic — Splitting:**
  - When first hit, the worm splits into two independent worms each with half the health of the original
  - The two offspring crawl away from each other but both still trend toward the player
  - Each new worm is a complete worm — two circles, a line, same crawling animation
  - Split depth scales with difficulty:
    - **Low difficulty:** splits once (1 → 2); split worms do not split again
    - **High difficulty:** split worms also split on first hit (1 → 2 → 4)
  - Any weapon fire rate can trigger the cascade — rapid fire splits worms instantly before the player can react
- **Threat:** Deceptively dangerous; rewards careful single-shot targeting; punishes careless rapid fire; pairs dangerously with enemies that restrict movement
- **Health:** Medium (halved on each split)
- **Collision damage:** Light
- **Destruction:** When a worm that cannot split further is depleted, its two circles and line fly apart with the burning fragment animation

---

### Blaster
- **Geometry:** Five triangular spikes at 72° intervals — a pentagram with only the outer points, no interior segments or fill; strobes between gray and white at ~2 Hz
- **Movement:** Moves slowly and directly toward the player (pure chaser); speed increases with room difficulty
- **Attack:** Once within ~5–6× the player ship length, fires a bright white jagged lightning bolt line directly at the nearest player
  - Target player takes major damage (long scale pulse)
  - Lightning bolt lingers briefly before fading
  - Only damages the player at the endpoint — does not damage objects along its path
  - Blaster immediately disintegrates after firing — one shot, then gone
- **Threat:** Instantly recognizable due to strobing; slow approach gives reaction time but a wrangler tether or crowded room removes that option; multiple blasters with staggered timing force prioritization; pairs lethally with wranglers
- **Health:** Medium — intended to be destroyed before it reaches firing range
- **Collision damage:** Medium
- **Destruction:** Five spike segments fly apart individually with burning fragment animation; lightning bolt line fades simultaneously

---

## Boss Enemies

Boss enemies differ from regular enemies in the following ways:
- Spawned once on room entry by a dedicated boss spawner (which then sits idle)
- Boss rooms may also contain regular spawners producing fodder enemies simultaneously
- Room is not cleared until all spawners and all enemies (including the boss) are destroyed
- Health is ~10× that of ordinary enemies (tunable per boss)
- Each boss has unique movement patterns, geometry, and special traits

### Boss — Bird
- **Geometry:** Two wing pairs (each a V shape) joined at a center-bottom point — left wing V opens lower-left, right wing V opens lower-right; an upward-pointing V connects the tops of both wings forming the head; two small circles inside the upward V as eyes; all line segments yellow, eyes light blue
- **Animation:** Wings fan inward and outward continuously — flapping motion; faster on dive, slower on retreat
- **Movement:** Erratic flapping around the room; repeatedly dives swiftly toward the player then pulls back (charge-and-retreat); after colliding with the player, bounces back as if deflected — must reorient before charging again, giving the player a brief damage window
- **Special trait — Collision immunity:** Bird does not take damage from colliding with the player; player does take damage; bird can only be damaged by player weapons — no attrition strategy possible
- **Threat:** High mobility and unpredictable charge timing; collision immunity removes trading hits as a strategy; paired with fodder spawners forces split attention
- **Health:** ~10× ordinary enemy baseline
- **Collision damage dealt:** Heavy (to player only)
- **Destruction:** All line segments and eye circles fly apart individually with burning fragment animation
