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
  WALL_COLOR: '#444444',
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
