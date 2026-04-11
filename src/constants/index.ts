// Game canvas dimensions
export const GAME = {
  WIDTH: 1280,
  HEIGHT: 720,
} as const;

// Room layout
export const ROOM = {
  HUD_HEIGHT: 60,
  WALL_THICKNESS: 16,
  INNER_LEFT: 16,
  INNER_RIGHT: 1264,
  INNER_TOP: 76,
  INNER_BOTTOM: 704,
  WALL_LINE_COLOR: '#ADD8E6',
} as const;

// Door configuration
export const DOOR = {
  WIDTH: 80,         // gap width in pixels
  BAR_THICKNESS: 10, // short dimension of the hollow rectangle bar
  OPEN_SPEED: 3.0,   // progress units/sec (1 = closed → 0 = open; fully opens in ~0.33s)
  ENTRY_OFFSET: 50,  // px inside the room where the player appears after entering
  CANVAS_SIZE: 80,   // canvas square used for bar drawing
} as const;

// Player configuration
export const PLAYER = {
  SPEED: 220,
  SHIP_LENGTH: 40,
  SHIP_HALF_WIDTH: 9,
  NACELLE_RADIUS: 4,
  COLOR_P1: '#ADD8E6',
  COLOR_P2: '#90EE90',
  START_HEALTH: 100,
  START_FLEET: 3,
  CANVAS_SIZE: 64,
  COLLIDER_RADIUS: 14,
  FIRE_RATE: 0.12,
  COLLISION_DAMAGE_TO_ENEMY: 5,
  /** Multiplier on all incoming player damage. 0.25 = easy, 1.0 = full/hard. */
  DAMAGE_SCALE: 0.25,
} as const;

// Bullet configuration
export const BULLET = {
  SPEED: 520,
  RADIUS: 3,
  DAMAGE: 12,
  CANVAS_SIZE: 10,
  COLOR: '#ffffff',
} as const;

// Wanderer enemy configuration
export const WANDERER = {
  INTERVAL_MULTIPLIER: 1.0,  // relative spawn speed (higher = slower)
  SPAWNING_PRIORITY: 0.8,    // throttle strength near cap (higher = more throttled; weak enemies yield slots to harder ones)
  SIZE: 24,
  HALF_SIZE: 12,
  SPEED: 70,
  HEALTH: 60,
  COLLISION_DAMAGE: 15,
  ROTATION_SPEED_MIN: 0.8,
  ROTATION_SPEED_MAX: 2.2,
  DIRECTION_CHANGE_MIN: 1.0,
  DIRECTION_CHANGE_MAX: 3.0,
  COLOR: '#888888',
  CANVAS_SIZE: 48,
  COLLIDER_RADIUS: 14,
  POINT_VALUE: 100,
  FRAGMENT_SPEED_MIN: 60,
  FRAGMENT_SPEED_MAX: 160,
  FRAGMENT_ANGULAR_VEL_MAX: 4.0,
  FRAGMENT_LIFETIME_MIN: 0.5,
  FRAGMENT_LIFETIME_MAX: 1.2,
} as const;

// Dart enemy configuration
export const DART = {
  INTERVAL_MULTIPLIER: 1.5,
  SPAWNING_PRIORITY: 0.4,
  SPEED: 160,
  TURN_RATE: 2.5,         // radians per second (gradual homing, not instant)
  HEALTH: 30,
  COLLISION_DAMAGE: 25,
  HALF_LENGTH: 16,        // nose to trailing-edge half-length
  HALF_WIDTH: 10,         // half-wingspan
  COLOR: '#00ffff',       // cyan
  CANVAS_SIZE: 64,
  COLLIDER_RADIUS: 10,
  POINT_VALUE: 150,
  FRAGMENT_SPEED_MIN: 60,
  FRAGMENT_SPEED_MAX: 150,
  FRAGMENT_ANGULAR_VEL_MAX: 5.0,
  FRAGMENT_LIFETIME_MIN: 0.4,
  FRAGMENT_LIFETIME_MAX: 1.0,
} as const;

// Wrangler enemy configuration
export const WRANGLER = {
  INTERVAL_MULTIPLIER: 2.0,
  SPAWNING_PRIORITY: 0.2,
  BODY_RADIUS: 18,
  SATELLITE_RADIUS: 7,
  SATELLITE_DIST: 36,          // center-to-center from body to each satellite
  WANDER_SPEED: 45,
  APPROACH_SPEED: 90,
  DETECTION_RADIUS: 260,       // player within this → start approaching
  TETHER_RANGE: 240,           // player within this → deploy tether (6 × PLAYER.SHIP_LENGTH)
  /** Below this separation (px), tether pull is cleared — avoids stale / jittery pull near overlap. */
  TETHER_PULL_MIN_DIST: 4,
  PULL_FORCE: 82,              // px/sec pull applied to player toward wrangler
  HEALTH: 120,
  COLLISION_DAMAGE: 20,
  COLOR_BODY: '#00ff00',
  COLOR_SATELLITES: '#ffff00',
  COLOR_TETHER: '#ffff88',
  CANVAS_SIZE: 96,
  COLLIDER_RADIUS: 22,
  POINT_VALUE: 300,
  DIRECTION_CHANGE_MIN: 1.5,
  DIRECTION_CHANGE_MAX: 3.5,
  FRAGMENT_SPEED_MIN: 50,
  FRAGMENT_SPEED_MAX: 140,
  FRAGMENT_ANGULAR_VEL_MAX: 4.0,
  FRAGMENT_LIFETIME_MIN: 0.5,
  FRAGMENT_LIFETIME_MAX: 1.3,
} as const;

// Satellite enemy configuration
export const SATELLITE = {
  INTERVAL_MULTIPLIER: 1.5,
  SPAWNING_PRIORITY: 0.35,
  CIRCLE_RADIUS: 18,
  SPOKE_LENGTH: 26,            // half-length of each line through center (protrudes 8px beyond circle)
  TANGENTIAL_SPEED_MIN: 100,   // px/sec tangential speed at difficulty 0
  TANGENTIAL_SPEED_MAX: 200,   // px/sec tangential speed at difficulty 1
  RADIAL_SPEED: 30,            // px/sec constant inward radial speed
  SPOKE_ROTATION_SPEED: 1.5,   // rad/sec visual spoke rotation
  HEALTH: 80,
  COLLISION_DAMAGE: 20,
  COLOR_CIRCLE: '#4466ff',
  COLOR_SPOKES: '#888888',
  CANVAS_SIZE: 64,
  COLLIDER_RADIUS: 20,
  POINT_VALUE: 250,
  FRAGMENT_SPEED_MIN: 60,
  FRAGMENT_SPEED_MAX: 160,
  FRAGMENT_ANGULAR_VEL_MAX: 5.0,
  FRAGMENT_LIFETIME_MIN: 0.4,
  FRAGMENT_LIFETIME_MAX: 1.1,
} as const;

// Worm enemy configuration
export const WORM = {
  INTERVAL_MULTIPLIER: 1.2,
  SPAWNING_PRIORITY: 0.6,
  CIRCLE_RADIUS: 10,
  MIN_SEP: 14,             // min circle center-to-center separation
  MAX_SEP: 32,             // max circle center-to-center separation
  OSCILLATION_SPEED: 3.0,  // rad/sec phase advance for inchworm animation
  SPEED: 50,
  TURN_RATE: 0.8,          // rad/sec steering toward player
  HEALTH: 80,
  COLLISION_DAMAGE: 10,
  COLOR_CIRCLES: '#c07830',
  COLOR_LINE: '#ffff00',
  CANVAS_SIZE: 64,
  COLLIDER_RADIUS: 22,
  POINT_VALUE: 180,
  FRAGMENT_SPEED_MIN: 50,
  FRAGMENT_SPEED_MAX: 130,
  FRAGMENT_ANGULAR_VEL_MAX: 4.0,
  FRAGMENT_LIFETIME_MIN: 0.4,
  FRAGMENT_LIFETIME_MAX: 1.0,
} as const;

// Blaster enemy configuration
export const BLASTER = {
  INTERVAL_MULTIPLIER: 2.5,
  SPAWNING_PRIORITY: 0.1,
  SPIKE_OUTER_RADIUS: 22,  // tip distance from center
  SPIKE_INNER_RADIUS: 12,  // base corner distance from center
  SPIKE_HALF_ANGLE: 0.3,   // radians — half-width of each spike base (~17°)
  SPEED_MIN: 45,
  SPEED_MAX: 110,          // scales with room difficulty
  FIRE_RANGE: 110,         // ~2.75 × PLAYER.SHIP_LENGTH
  FIRE_DAMAGE: 40,
  STROBE_HZ: 2,            // complete gray↔white cycles per second
  BOLT_LIFETIME: 0.5,      // seconds the lightning bolt lingers
  BOLT_JAGS: 8,            // jag segments along the bolt
  BOLT_JITTER: 18,         // px perpendicular jitter per jag point
  COLOR_GRAY: '#888888',
  COLOR_WHITE: '#ffffff',
  HEALTH: 80,
  COLLISION_DAMAGE: 20,
  CANVAS_SIZE: 60,
  COLLIDER_RADIUS: 18,
  POINT_VALUE: 200,
  FRAGMENT_SPEED_MIN: 60,
  FRAGMENT_SPEED_MAX: 160,
  FRAGMENT_ANGULAR_VEL_MAX: 5.0,
  FRAGMENT_LIFETIME_MIN: 0.4,
  FRAGMENT_LIFETIME_MAX: 1.0,
} as const;

// Zapsphere boss configuration
export const ZAPSPHERE = {
  INTERVAL_MULTIPLIER: 1.0, // unused — one-shot
  SPAWNING_PRIORITY: 0.0,
  HEALTH: 800,
  COLLISION_DAMAGE: 20,
  CANVAS_SIZE: 64,
  COLLIDER_RADIUS: 24,
  CIRCLE_RADIUS: 24,
  SQUARE_HALF: 14,            // half-size of rotating inner square
  DANGER_RADIUS: 180,         // ~7.5× circle radius
  DWELL_THRESHOLD_EASY: 3.0,  // seconds before lightning at difficulty 0
  DWELL_THRESHOLD_HARD: 0.8,  // seconds before lightning at difficulty 1
  LIGHTNING_DAMAGE: 50,
  LIGHTNING_COOLDOWN: 2.0,    // seconds between lightning shots
  DRIFT_SPEED: 60,
  SQUARE_ROT_BASE: 1.2,       // base rad/s for inner square rotation
  SQUARE_ROT_ACCEL: 3.0,      // multiplier added at full dwell (total = base × (1 + accel × ratio))
  COLOR_CYCLE_BASE: 1.0,      // color states/s at zero dwell
  COLOR_CYCLE_ACCEL: 5.0,     // multiplier added at full dwell
  DAMAGE_MULTIPLIER: 2.5,     // bullet damage multiplier when player is in danger zone
  COLOR_CIRCLE: '#00ffff',
  POINT_VALUE: 2500,
  FRAGMENT_SPEED_MIN: 80,
  FRAGMENT_SPEED_MAX: 200,
  FRAGMENT_ANGULAR_VEL_MAX: 5.0,
  FRAGMENT_LIFETIME_MIN: 0.5,
  FRAGMENT_LIFETIME_MAX: 1.5,
} as const;

// GlitchBoss configuration
export const GLITCH_BOSS = {
  INTERVAL_MULTIPLIER: 1.0, // unused — one-shot
  SPAWNING_PRIORITY: 0.0,
  HEALTH: 800,
  COLLISION_DAMAGE: 20,
  CANVAS_SIZE: 60,
  COLLIDER_RADIUS: 20,
  BOX_HALF: 20,
  ARROW_LENGTH: 13,           // center to arrow tip
  RETREAT_SPEED: 100,         // slower than player (220) so gap can be closed
  WALL_AVOIDANCE_DIST: 90,    // px from wall at which repulsion kicks in
  WALL_AVOIDANCE_WEIGHT: 2.5, // relative weight of wall repulsion vs flee-from-player
  CONE_BASE_HALF: 0.30,       // rad, cone half-angle at max range (narrow)
  CONE_MAX_HALF: 1.35,        // rad, cone half-angle at close range (wide)
  CONE_MAX_DIST: 420,         // distance beyond which cone is at minimum angle
  /** Max rad/s the arrow rotates toward the closest player (shortest arc). */
  ARROW_TRACKING_TURN_RATE: 0.9,
  DAMAGE_MIN_SCALE: 0.15,     // bullet damage fraction at max distance
  DAMAGE_MAX_DIST: 500,       // beyond this, minimum damage applies
  COLOR_CYCLE_SPEED: 0.5,     // arrow color states per second
  POINT_VALUE: 3000,
  FRAGMENT_SPEED_MIN: 80,
  FRAGMENT_SPEED_MAX: 200,
  FRAGMENT_ANGULAR_VEL_MAX: 5.0,
  FRAGMENT_LIFETIME_MIN: 0.5,
  FRAGMENT_LIFETIME_MAX: 1.5,
} as const;

// Bird boss configuration
export const BIRD_BOSS = {
  INTERVAL_MULTIPLIER: 1.0, // unused — boss spawner is one-shot
  SPAWNING_PRIORITY: 0.0,   // unused
  HEALTH: 800,
  COLLISION_DAMAGE: 30,
  CANVAS_SIZE: 80,
  COLLIDER_RADIUS: 20,
  FLIT_SPEED: 120,
  CHARGE_SPEED: 320,
  RETREAT_SPEED: 180,
  FLIT_DURATION_MIN: 1.0,
  FLIT_DURATION_MAX: 2.5,
  RETREAT_DURATION: 0.8,
  FLAP_BASE: 6,           // min y-offset of wing tips (canvas local units)
  FLAP_AMPLITUDE: 16,     // additional y-offset range
  FLAP_SPEED_FLIT: 3.0,   // rad/sec phase advance while flitting
  FLAP_SPEED_CHARGE: 7.0, // rad/sec while charging
  FLAP_SPEED_RETREAT: 1.5,// rad/sec while retreating
  COLOR_WINGS: '#ffff00',
  COLOR_EYES: '#add8e6',
  POINT_VALUE: 2000,
  FRAGMENT_SPEED_MIN: 80,
  FRAGMENT_SPEED_MAX: 200,
  FRAGMENT_ANGULAR_VEL_MAX: 6.0,
  FRAGMENT_LIFETIME_MIN: 0.5,
  FRAGMENT_LIFETIME_MAX: 1.5,
} as const;

// Snake boss configuration
export const SNAKE_BOSS = {
  INTERVAL_MULTIPLIER: 1.0, // unused — boss spawner is one-shot
  SPAWNING_PRIORITY: 0.0,   // unused
  HEAD_HEALTH: 2000,
  SEGMENT_HEALTH: 600,
  SEGMENT_COUNT: 15,
  SEGMENT_SPACING: 26,       // px between consecutive segment centers along path
  HEAD_RADIUS: 14,
  SEGMENT_RADIUS: 10,
  EYE_RADIUS: 3,
  EYE_OFFSET: 6,
  ORBIT_SPEED: 100,          // px/sec tangential speed during orbit
  ORBIT_RADIUS: 200,         // starting orbit radius
  ORBIT_TIGHTEN_RATE: 12,    // px/sec reduction in orbit radius while orbiting
  ORBIT_MIN_RADIUS: 80,      // orbit radius at which it transitions to ram
  ORBIT_DURATION_MIN: 4.0,
  ORBIT_DURATION_MAX: 7.0,
  RAM_SPEED: 280,
  RECOIL_SPEED: 140,
  RECOIL_DURATION: 0.7,
  SPEED_BOOST_PER_LOSS: 0.06, // speed multiplier added per segment lost
  MAX_SPEED_MULTIPLIER: 2.0,
  COLLISION_DAMAGE: 40,
  CANVAS_SIZE_HEAD: 40,
  CANVAS_SIZE_SEGMENT: 28,
  COLLIDER_RADIUS_HEAD: 14,
  COLLIDER_RADIUS_SEGMENT: 10,
  COLOR_BODY: '#00ff00',
  COLOR_DEAD: '#ff0000',
  POINT_VALUE_HEAD: 3000,
  POINT_VALUE_SEGMENT: 200,
  FRAGMENT_SPEED_MIN: 80,
  FRAGMENT_SPEED_MAX: 180,
  FRAGMENT_ANGULAR_VEL_MAX: 5.0,
  FRAGMENT_LIFETIME_MIN: 0.5,
  FRAGMENT_LIFETIME_MAX: 1.3,
} as const;

// Input configuration
export const INPUT = {
  GAMEPAD_DEADZONE: 0.15,       // radial deadzone applied to both sticks
  GAMEPAD_FIRE_THRESHOLD: 0.25, // right-stick magnitude required to fire
} as const;

// Maze generation configuration
export const MAZE_GEN = {
  GRID_W: 5,
  GRID_H: 4,
  SEED: 12345,
  EASY_TIER: 0.33,  // difficulty < this → wanderers only
  MED_TIER:  0.66,  // difficulty < this → wanderers + light darts
                    // difficulty >= MED_TIER → wanderers + heavy darts
  /** Minimum spawner *machines* (SpawnerActor count) placed in every non-empty room. */
  MIN_SPAWNER_MACHINES_PER_ROOM: 3,
  /** Pickups spawned in the exit room when the run is completed. */
  VICTORY_PICKUP_COUNT: 20,
} as const;

// Spawner machine configuration
export const SPAWNER = {
  SIZE: 40,
  HALF_SIZE: 20,
  HEALTH: 80,
  COLLISION_DAMAGE: 10,
  POINT_VALUE: 200,
  SPAWN_INTERVAL_SLOW: 4.0,   // seconds per enemy at difficulty 0
  SPAWN_INTERVAL_FAST: 1.0,   // seconds per enemy at difficulty 1
  INITIAL_DELAY_FACTOR: 0.5,  // first spawn fires at interval × this
  MAX_LIVE_ENEMIES: 30,        // spawners pause when total live count (spawners+enemies) reaches this
  CANVAS_SIZE: 64,
  FRAGMENT_SPEED_MIN: 60,
  FRAGMENT_SPEED_MAX: 160,
  FRAGMENT_ANGULAR_VEL_MAX: 3.0,
  FRAGMENT_LIFETIME_MIN: 0.6,
  FRAGMENT_LIFETIME_MAX: 1.4,
} as const;

// Audio volume configuration (dB; 0 = unity, -Infinity = silent)
export const AUDIO = {
  MUSIC_VOLUME_DB: -18,
  SFX_VOLUME_DB:   -6,
} as const;

// Damage and hit feedback
export const DAMAGE = {
  LIGHT_HIT_THRESHOLD: 15,
  HEAVY_HIT_THRESHOLD: 30,
  LIGHT_PULSE_DURATION: 0.3,
  MEDIUM_PULSE_DURATION: 0.8,
  HEAVY_PULSE_DURATION: 2.0,
  SCALE_PEAK: 1.3,
  UPGRADE_LOSS_THRESHOLD: 20,
} as const;

// Score configuration
export const SCORE = {
  STREAK_WINDOW_SECONDS: 10,
  STREAK_THRESHOLDS: [3, 5, 8] as const,
  STREAK_MULTIPLIERS: [2, 3, 4] as const,
} as const;

// Upgrade system configuration
export const UPGRADE = {
  // Weapon power: each level multiplies base bullet damage by this additional factor
  // Level 1 = 1.0×, Level 2 = 1.5×, Level 3 = 2.0×, etc.
  WEAPON_POWER_DAMAGE_MULTIPLIER: 0.5,
  MAX_WEAPON_POWER: 5,
  // Shield: fraction of raw damage absorbed per shield level (capped at 0.9 total)
  SHIELD_REDUCTION_PER_LEVEL: 0.15,
  // Total absorb capacity per shield level before losing a level
  SHIELD_CHARGE_PER_LEVEL: 60,
  MAX_SHIELD_LEVEL: 5,
  // Panic button: damage = base + (count × per_button) before decrementing count
  PANIC_DAMAGE_BASE: 30,
  PANIC_DAMAGE_PER_BUTTON: 10,
  MAX_PANIC_COUNT: 9,
} as const;

// Pickup actor configuration
export const PICKUP = {
  RADIUS: 22,
  CANVAS_SIZE: 56,
  FLASH_PERIOD: 1.2,          // seconds per full fade cycle
  COLOR_A: '#0000aa',          // muted blue
  COLOR_B: '#bfbfbf',          // 75% white
  INTERIOR_SCALE: 0.52,        // interior graphic fits within this fraction of RADIUS
  HEALTH_RESTORE_RATIO: 0.5,   // fraction of max health restored on collection
} as const;
