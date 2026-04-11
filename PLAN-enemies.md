# ChaosCurtain — Enemy System

## Architecture

Enemies are composed of independent, combinable parts to keep the system extensible:

- **Geometry** — separable components that fly apart on destruction
- **Movement behavior** — how the enemy moves (composable, reusable)
- **Attack behavior** — bullet patterns (composable, reusable)
- **Health & difficulty scaling** — stats tuned per room difficulty
- **Special traits** — optional flags (door blocker, boss, etc.)

### Design Note
Most threats are **contact-based** (body vs player). **Exceptions in code:** **Blaster** applies damage in a burst when it enters fire range (with `LightningBoltActor` as a visual), then dies; **Zapsphere** uses timed lightning strikes (`LightningBoltActor`). There is **no** shared enemy “bullet” pool colliding like `BulletActor` — ranged patterns today are scripted strikes / VFX, not reusable projectile patterns for all types.

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

### Wanderer ✓ implemented
- **Geometry:** Simple square; gray
- **Movement:** Random wandering, bounces/steers away from walls; rotates continuously in a random direction (can change periodically)
- **Attack:** None — purely a collision hazard
- **Threat:** Low individually; dangerous in large numbers by restricting maneuvering space
- **Health:** Low
- **Collision damage:** Light
- **Destruction:** Four line segments fly apart individually, burning fragment animation
- **Role:** Fodder; pairs well with stationary turrets

---

### Dart ✓ implemented
- **Geometry:** Single chevron (six line segments), always oriented to face movement direction; cyan
- **Movement:** Homes toward player like a guided missile with a turning radius — steers gradually, not instantly; speed and turning rate scale with room difficulty
- **Attack:** None — purely a collision threat
- **Threat:** Low early game, dangerous at high speed; multiple converging darts are hard to dodge simultaneously
- **Health:** Low (30 HP)
- **Collision damage:** Medium (25)
- **Destruction:** Six line segments fly apart individually, burning fragment animation
- **Scaling:** `DART.SPEED` and `DART.TURN_RATE` are direct tunable constants
- **Implementation notes:**
  - Six segments defined as local-space coordinate pairs; rotated to world space for both drawing and fragment spawning
  - Steering: each frame computes angle diff to player, clamps to `TURN_RATE * dt`, updates rotation and velocity
  - Color shifts cyan → red as health drops (same pattern as Wanderer)
  - Uses duck-typed `isEnemy = true` / `collisionDamage` pattern; PlayerActor no longer needs per-enemy `instanceof` checks

---

### Wrangler ✓ implemented
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
- **Implementation notes:**
  - Two states: `wander` (random direction changes) → `approach` (steer toward player) once within `DETECTION_RADIUS`
  - Tether activates once within `TETHER_RANGE`; persists until death; pull registered via `player.pullRegistry` Map (keyed by wrangler instance) so multiple wranglers stack
  - Tether line drawn via `graphics.onPostDraw` in actor-local space (`ExcaliburGraphicsContext.drawLine`)
  - Color shifts on damage: body green → red, satellites yellow → red
  - Spawns in medium rooms (~17% chance) and hard rooms (~33% chance)

---

### Satellite ✓ implemented
- **Geometry:** Circle (blue) with four lines passing through the center at 45° intervals (0/180, 45/225, 90/270, 135/315°); lines protrude slightly beyond the circle edge giving an 8-pointed spiky appearance; spikes are gray; spikes rotate continuously around the center as the satellite moves
- **Movement:** Spirals inward toward the player — velocity is primarily tangential (perpendicular to the player-satellite line) with a small inward radial component; angular velocity increases with room difficulty
- **Attack:** None — purely a collision threat
- **Threat:** Difficult to hit due to angular velocity; inward spiral creates time pressure — ignoring it allows it to close to collision range; multiple satellites at different radii are extremely difficult to manage
- **Health:** Medium
- **Collision damage:** Medium
- **Destruction:** Circle and eight spike segments fly apart individually, burning fragment animation
- **Scaling:** Angular velocity scales directly with room difficulty
- **Implementation notes:**
  - Constant tangential speed (perpendicular to player direction) + constant inward radial speed; tangential speed lerps from `TANGENTIAL_SPEED_MIN` to `TANGENTIAL_SPEED_MAX` with difficulty
  - `spinSign` (+1/-1) chosen randomly at construction for CW vs CCW orbit
  - `spokeAngle` accumulated each frame for visual spoke rotation; used directly in `drawSatellite` and `spawnFragments`
  - Fragments: 1 circle diameter line + 8 half-spoke lines (2 per spoke × 4 spokes)
  - Wall clamping: position-only (velocity recomputed each frame, no bounce needed)
  - Spawns guaranteed in every hard room (difficulty ≥ 0.66)

---

### Worm ✓ implemented
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
- **Implementation notes:**
  - Constructor takes `pickTargetPlayer`, `health`, `splitsLeft` (1 = splits once, 2 = splits twice), and `registerEnemy` callback
  - First hit triggers `doSplit()` instead of damage if `splitsLeft > 0`; emits `enemy:died` with 0 points to decrement `_liveCount` without awarding score; two offspring registered via callback
  - Offspring each start with parent's current HP / 2; initial velocity perpendicular to parent velocity (one each way)
  - Post-split worms steer toward player with `TURN_RATE`; `splitsLeft - 1` passed to offspring
  - `splitsLeft` = 1 in easy/medium rooms, 2 in hard rooms (difficulty ≥ 0.66)
  - `phase` randomized at construction to stagger oscillations across worms; separation = `MIN_SEP + (MAX_SEP - MIN_SEP) * (0.5 + 0.5 * sin(phase))`
  - Fragments: head circle + tail circle + line, all fly outward along body axis

---

### Blaster ✓ implemented
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
- **Implementation notes:**
  - 10 spike segments (2 per spike × 5) precomputed at module load from `SPIKE_OUTER_RADIUS`, `SPIKE_INNER_RADIUS`, `SPIKE_HALF_ANGLE`
  - Strobe: `Math.floor(elapsed * STROBE_HZ * 2) % 2` toggles gray/white every 0.25s
  - Speed lerps `SPEED_MIN` → `SPEED_MAX` with difficulty; pure chaser (no steering delay)
  - Fires when within `FIRE_RANGE` (110px): damages player via duck-typed `sharedState.applyDamage`, spawns `LightningBoltActor`, then disintegrates
  - `LightningBoltActor`: full-screen canvas at world origin with `anchor (0,0)`; 8-point jagged path pre-generated at construction; fades over `BOLT_LIFETIME` seconds
  - `dead` flag guards against double-fire from simultaneous bullet collision + range check
  - Spawns at ~25% chance in hard rooms (difficulty ≥ 0.66); fire range halved from original spec after playtesting

---

## Boss Enemies

Boss enemies differ from regular enemies in the following ways:
- Spawned once on room entry by a dedicated boss spawner (which then sits idle)
- Boss rooms may also contain regular spawners producing fodder enemies simultaneously
- Room is not cleared until all spawners and all enemies (including the boss) are destroyed
- Health is ~10× that of ordinary enemies (tunable per boss)
- Each boss has unique movement patterns, geometry, and special traits

### Co-op player targeting ✓ implemented

When two ships are in play, bosses (and the **Worm**) react to **whichever player is nearer** to a reference point `from` (usually the enemy or boss position). **Single-player** is unchanged in practice: `RoomManager.pickTargetPlayer` returns only P1 and ignores `from`, so behavior matches the old pattern of holding a single spawn-time `playerRef`.

- **`RoomManager.pickTargetPlayer(from)`** — No P2: always `this.player`. With P2: returns the ship whose `pos` is closer to `from` (equal distance picks P1).

- **`SpawnerActor`** wires **`(from) => this.pickTargetPlayer(from)`** into actors that need live targeting. Enemies that still take a **one-shot** `target` at spawn (Dart, Wrangler, Satellite, Blaster) use `pickTargetPlayer(this.pos)` once from the **spawner** position only; they have not been converted to continuous re-targeting.

**Implemented dynamic targeting**

| Actor | What changed |
|-------|----------------|
| **Worm** | Constructor takes `pickTargetPlayer`; head steers toward nearest ship each frame (split children inherit the same callback). |
| **Bird boss** | `enterCharge` aims at `pickTargetPlayer(this.pos).pos` when the charge begins (no longer a fixed spawn-time player). |
| **Snake boss** | Orbit center and ram vector use nearest player each update / ram start. |
| **Zapsphere** | Danger ring and dwell use **min** distance to any player; bullet damage boost uses min distance. On lightning, **each** player inside the danger radius takes damage and gets a `LightningBoltActor`; `zapsphere:lightning` still fires **once** per discharge for SFX. |
| **Glitch boss** | Retreat and proximity damage use nearest / min distance as appropriate. Glitch **cone** is evaluated per player: each ship’s `glitchRegistry` is updated independently; arrow highlight if **any** ship is glitched. Death / pre-kill clears this boss from **all** players’ registries. |

### Boss — Bird ✓ implemented
- **Geometry:** Two wing pairs (each a V shape) joined at a center-bottom point — left wing V opens lower-left, right wing V opens lower-right; an upward-pointing V connects the tops of both wings forming the head; two small circles inside the upward V as eyes; all line segments yellow, eyes light blue
- **Animation:** Wings fan inward and outward continuously — flapping motion; faster on dive, slower on retreat
- **Movement:** Erratic flapping around the room; repeatedly dives swiftly toward the player then pulls back (charge-and-retreat); after colliding with the player, bounces back as if deflected — must reorient before charging again, giving the player a brief damage window
- **Special trait — Collision immunity:** Bird does not take damage from colliding with the player; player does take damage; bird can only be damaged by player weapons — no attrition strategy possible
- **Threat:** High mobility and unpredictable charge timing; collision immunity removes trading hits as a strategy; paired with fodder spawners forces split attention
- **Health:** ~10× ordinary enemy baseline
- **Collision damage dealt:** Heavy (to player only)
- **Destruction:** All line segments and eye circles fly apart individually with burning fragment animation
- **Implementation notes:**
  - States: `flit` (erratic movement toward random room targets, charges after 1–2.5s) → `charge` (beelines to **nearest** player position via `pickTargetPlayer(this.pos)`, recorded at charge start) → `retreat` (bounces opposite to charge dir for 0.8s)
  - `flapPhase` advances at `FLAP_SPEED_FLIT/CHARGE/RETREAT` (3/7/1.5 rad/s); `flapY` = base (6) + amplitude (16) * (0.5 + 0.5 * sin(phase)) drives all wing vertices each frame → `cache: false` canvas
  - Wing geometry in local space (bird points +x): tail join (-10,0); outer wing tips (-18, ±flapY); inner wing tips (2, ±flapY*0.55); head tip (18,0) — 6 segments + 2 eye circles
  - `ignoresPlayerRam = true`: PlayerActor skips `other.takeDamage` call; player still takes `collisionDamage` (30) from bird's `collisionDamage` field
  - On player collision: immediately enters `retreat` state
  - Health: 800 (≈ 10× Wanderer); point value: 2000
  - Spawned by one-shot boss spawner; boss room also has wanderer + dart fodder spawners

---

### Boss — Snake ✓ implemented
- **Geometry:** Chain of 15–20 tangent circles (segment count tunable, to be revised once relative sizes are established); head circle contains two small eye circles; entire snake green; each segment independently shifts toward red as its own health depletes — body can show a patchwork of health states
- **Movement:** Classic snake body-follows-head motion; attempts to encircle the **nearest** player, slowly tightening a loop to trap them; once a full loop is completed, the head rams toward that target; bounces back on collision (like the Bird) giving a brief damage window
- **Special trait — Segmented health:**
  - Each segment has its own independent health pool
  - Head has 2× the health of regular segments
  - When a segment reaches zero health: that segment and all segments behind it (tail-ward) disintegrate, shortening the snake
  - If the head is destroyed: entire snake disintegrates immediately
  - Head cannot be damaged by ramming the player; player does take damage from the ram
- **Speed scaling:** Snake speeds up as segments are lost; capped at 2× its initial speed — shorter snake trades reduced encircling reach for increased aggression
- **Threat:** Encircling behavior restricts player movement over time; segmented health creates a strategic choice between targeting the head (risky, high payoff) or chipping the tail (safer, speeds up the snake)
- **Health:** Head ~20× ordinary enemy baseline; regular segments ~10×
- **Collision damage dealt:** Heavy (head only, to player only)
- **Destruction:** Disintegrating segments each fly apart as individual circles with burning fragment animation; full snake destruction produces a cascade of fragments along the entire length
- **Implementation notes:**
  - `SnakeBossActor` (head) + 15 `SnakeSegmentActor` instances registered individually (each counts toward room live-count)
  - States: `orbit` (circles **nearest** player at `orbitRadius`, tightening at 12 px/s; transitions to ram after 4–7s or when radius hits 80px) → `ram` (beelines to nearest player position at ram start at 280px/s) → `recoil` (reverse dir for 0.7s)
  - Body-follows-head: head maintains position history ring buffer (max 400 entries); each segment i reads history at `(i+1) * step` from end where `step = round(SEGMENT_SPACING * 60 / currentSpeed)` — dynamically adapts to speed changes
  - `speedMult` increases by `SPEED_BOOST_PER_LOSS (0.06)` per dead segment, capped at 2×
  - When a segment reaches zero health: it and all tail-ward segments cascade die (each emits `enemy:died` with its point value, decrementing live count)
  - Head death cascades kills all remaining segments
  - `ignoresPlayerRam = true` on both head and segments; player collision triggers recoil on head
  - Head: 2000 HP, 3000 pts; segment: 600 HP, 200 pts
  - Spawned by one-shot boss spawner in the hardest non-exit room; snake boss room also has wanderer + dart fodder

---

### Boss — Zapsphere ✓ implemented
- **Geometry:** Large circle (cyan outline, not filled) with a rotating square inside (gray outline, not filled); square continuously cycles gray → white → blue → gray; all shapes outlines only — vector display consistent
- **Movement:** Drifts slowly around the room; actively tends toward clusters of other enemies, using them as cover and forcing the player to clear fodder before getting a clean shot
- **Special mechanic — Danger zone:**
  - Projectiles deal significantly more damage when fired from within ~7–8 sphere lengths (proximity uses the **closest** ship in co-op)
  - If **any** player dwells within that range too long, lightning fires: **each** player still inside the ring at discharge takes severe damage and gets a bolt visual
  - Dwell time before lightning fires decreases with room difficulty (low difficulty: generous window; high difficulty: very short, requires precise dart-in/dart-out timing)
  - Internal square animation accelerates and shifts as the dwell timer counts down — readable visual warning
- **Threat:** Forces a risk/reward rhythm of closing in to deal full damage then retreating before the lightning fires; paired with other enemies the player must navigate the danger zone while dodging; a wrangler tether while in the danger zone is lethal; hides among fodder enemies to impede clean shots
- **Health:** ~10× ordinary enemy baseline
- **Collision damage dealt:** Medium
- **Destruction:** Circle and square outlines fly apart individually with burning fragment animation
- **Implementation notes:**
  - Canvas `cache: false` — inner square rotates and color changes every frame
  - `dwellThreshold` lerps `DWELL_THRESHOLD_EASY (3.0s)` → `DWELL_THRESHOLD_HARD (0.8s)` with difficulty
  - `dwellTimer` increments while **any** player is within `DANGER_RADIUS (180px)` (min distance to players); drains at 2× rate outside
  - Inner square: `squareAngle` advances at `SQUARE_ROT_BASE × (1 + SQUARE_ROT_ACCEL × dwellRatio)` — spins up to 4× faster at full dwell; color snaps through gray/white/blue at similarly accelerating rate
  - Lightning fires when `dwellTimer >= dwellThreshold` and `lightningCooldown == 0`; one `LightningBoltActor` per struck player; 2s cooldown after an attempt; uses existing `LightningBoltActor`
  - Bullet damage boost: in `collisionstart`, if **any** player is within `DANGER_RADIUS` (min distance), applies `DAMAGE_MULTIPLIER (2.5×)` to bullet damage before passing to `healthComp`
  - Cluster movement: scans `engine.currentScene.actors` every 0.5s to find centroid of all other live enemies; drifts toward it at `DRIFT_SPEED (60px/s)`; falls back to room-center drift when alone
  - Placed in 3rd-hardest non-exit room; 800 HP, 2500 pts

---

### Boss — GlitchBoss ✓ implemented *(most difficult; placed closest to exit)*
- **Geometry:** Square box (outline only) containing an arrow that can point in any direction; arrow color cycles randomly between green, blue, gray, and white (never red — reserved for damage indication); all outlines only
- **Animation:** Arrow rotates at a constant slow speed with random direction changes — player cannot predict or time a fixed spin cycle
- **Movement:** Retreats to maintain distance from the **nearest** player; moves slower than the player's maximum speed so the gap can be closed, but the glitch mechanic complicates doing so
- **Special mechanic — Glitch cone:**
  - Projects an invisible cone centered on itself, aligned with the arrow direction
  - If a player is within the cone, **that** ship is glitched — any movement that would decrease distance to the GlitchBoss is blocked; lateral and retreating movement remain free (each co-op ship has its own `glitchRegistry` entry)
  - Cone angle widens as the player gets closer — at long range narrow and easy to step out of; at close range nearly any approach direction is blocked
  - Player escapes the glitch by moving away until the arrow rotates to point elsewhere
  - Cone is invisible — its geometry is learned through experience, adding a layer of skill expression
  - **Glitch feedback:** When actively glitching **any** player, the arrow pulses brightly — confirms the glitch state without revealing cone geometry
- **Damage scaling:** Damage dealt to the GlitchBoss scales with proximity — closer shots deal significantly more damage; rewards precise, aggressive play during approach windows
- **Threat:** Hardest boss in the game; retreating movement plus widening invisible cone makes sustained close-range combat nearly impossible; player must read arrow direction, wait for a window, dash in to fire, retreat before the cone catches them; other room enemies create pressure during waiting phases; wrangler tether while glitched is near-lethal; one per room
- **Health:** ~10× ordinary enemy baseline
- **Collision damage dealt:** Medium
- **Destruction:** Box and arrow fly apart individually with burning fragment animation
- **Implementation notes:**
  - Canvas `cache: false` — arrow angle changes every frame
  - Arrow rotates at `arrowSpeed` (random magnitude `ARROW_SPEED_MIN–MAX`, random sign CW/CCW); speed picks a new random value every `ARROW_CHANGE_MIN–MAX (1–3s)`
  - Arrow color cycles through green/blue/gray/white (never red) at `COLOR_CYCLE_SPEED (0.5 states/s)`; pulses white and thickens when actively glitching
  - Retreat: velocity = `normalize(closestPlayerPos - boss) × -RETREAT_SPEED (100px/s)` each frame
  - **Glitch cone**: half-angle = `CONE_BASE_HALF (0.30rad) + (CONE_MAX_HALF (1.35rad) - base) × (1 - dist/CONE_MAX_DIST (420px))` per player; in cone if angle from boss to **that** ship differs from `arrowAngle` by less than halfAngle
  - When in cone: registers `towardBoss` into **that** ship’s `glitchRegistry`; PlayerActor zeroes velocity component toward boss each frame
  - When out of cone or boss dies/pre-kill: removes this boss from **each** player’s registry so stale vectors cannot persist off-room
  - **Proximity damage scaling**: uses **minimum** distance to any player in the bullet damage formula × `(DAMAGE_MIN_SCALE + (1-MIN_SCALE) × max(0, 1 - dist/DAMAGE_MAX_DIST (500px)))`; far shots deal 15% damage, point-blank deals 100%
  - Placed in hardest non-exit room (closest to exit); 800 HP, 3000 pts
