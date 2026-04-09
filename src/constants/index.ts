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
  BODY_RADIUS: 18,
  SATELLITE_RADIUS: 7,
  SATELLITE_DIST: 36,          // center-to-center from body to each satellite
  WANDER_SPEED: 45,
  APPROACH_SPEED: 90,
  DETECTION_RADIUS: 260,       // player within this → start approaching
  TETHER_RANGE: 240,           // player within this → deploy tether (6 × PLAYER.SHIP_LENGTH)
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
} as const;

// Spawner machine configuration
export const SPAWNER = {
  SIZE: 40,
  HALF_SIZE: 20,
  HEALTH: 80,
  COLLISION_DAMAGE: 10,
  POINT_VALUE: 200,
  SPAWN_INTERVAL_SLOW: 6.0,   // seconds per enemy at difficulty 0
  SPAWN_INTERVAL_FAST: 1.5,   // seconds per enemy at difficulty 1
  INITIAL_DELAY_FACTOR: 0.5,  // first spawn fires at interval × this
  CANVAS_SIZE: 64,
  FRAGMENT_SPEED_MIN: 60,
  FRAGMENT_SPEED_MAX: 160,
  FRAGMENT_ANGULAR_VEL_MAX: 3.0,
  FRAGMENT_LIFETIME_MIN: 0.6,
  FRAGMENT_LIFETIME_MAX: 1.4,
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
