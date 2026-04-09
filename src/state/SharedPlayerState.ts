import { PLAYER, BULLET, UPGRADE, PICKUP, DAMAGE } from '../constants';
import { GameEvents } from '../utils/GameEvents';
import type { UpgradeType } from '../types/GameTypes';

export class SharedPlayerState {
  health: number;
  readonly maxHealth: number;
  fleet: number;
  score: number;

  /** When true, applyDamage is a no-op. Set from DebugConfig in GameplayScene. */
  godMode = false;
  /** Multiplier on all incoming damage. 0.25 = easy, 1.0 = full/hard. */
  damageScale: number = PLAYER.DAMAGE_SCALE;

  // Upgrade levels
  shooterType: 1 | 2 | 3 = 1;
  weaponPower: number = 1;
  shieldLevel: number = 0;
  shieldCharge: number = 0;
  panicCount: number = 0;

  constructor() {
    this.maxHealth = PLAYER.START_HEALTH;
    this.health = this.maxHealth;
    this.fleet = PLAYER.START_FLEET;
    this.score = 0;
  }

  get healthRatio(): number {
    return this.health / this.maxHealth;
  }

  get shieldMaxCharge(): number {
    return UPGRADE.SHIELD_CHARGE_PER_LEVEL * this.shieldLevel;
  }

  /** Damage per bullet after weapon power scaling. */
  get bulletDamage(): number {
    return BULLET.DAMAGE * (1 + (this.weaponPower - 1) * UPGRADE.WEAPON_POWER_DAMAGE_MULTIPLIER);
  }

  /** Total panic damage at current count (calculated before decrementing). */
  get panicDamage(): number {
    return UPGRADE.PANIC_DAMAGE_BASE + this.panicCount * UPGRADE.PANIC_DAMAGE_PER_BUTTON;
  }

  /**
   * Full damage resolution pipeline:
   * raw → shield absorption → health pool → upgrade loss threshold check
   */
  applyDamage(raw: number): void {
    if (this.godMode) return;
    let postShield = raw * this.damageScale;

    if (this.shieldLevel > 0) {
      const reduction = Math.min(0.9, this.shieldLevel * UPGRADE.SHIELD_REDUCTION_PER_LEVEL);
      const absorbed = raw * reduction;
      postShield = raw - absorbed;
      this.shieldCharge -= absorbed;
      if (this.shieldCharge <= 0) {
        this.shieldLevel = Math.max(0, this.shieldLevel - 1);
        this.shieldCharge = this.shieldLevel > 0
          ? UPGRADE.SHIELD_CHARGE_PER_LEVEL * this.shieldLevel
          : 0;
        GameEvents.emit('player:downgraded', { upgradeType: 'shield' });
      }
    }

    this.health = Math.max(0, this.health - postShield);
    GameEvents.emit('health:changed', { current: this.health, max: this.maxHealth });
    GameEvents.emit('player:hit', { damage: postShield });

    if (postShield > DAMAGE.UPGRADE_LOSS_THRESHOLD) {
      this.loseRandomUpgrade();
    }
  }

  private loseRandomUpgrade(): void {
    const loseable: UpgradeType[] = [];
    if (this.shooterType > 1) loseable.push('shooterType');
    if (this.weaponPower > 1) loseable.push('weaponPower');
    if (loseable.length === 0) return;
    const type = loseable[Math.floor(Math.random() * loseable.length)];
    if (type === 'shooterType') {
      this.shooterType = (this.shooterType - 1) as 1 | 2;
    } else {
      this.weaponPower--;
    }
    GameEvents.emit('player:downgraded', { upgradeType: type });
  }

  applyUpgrade(type: UpgradeType): void {
    switch (type) {
      case 'shooterType':
        if (this.shooterType < 3) this.shooterType = (this.shooterType + 1) as 2 | 3;
        break;
      case 'weaponPower':
        if (this.weaponPower < UPGRADE.MAX_WEAPON_POWER) this.weaponPower++;
        break;
      case 'shield':
        if (this.shieldLevel < UPGRADE.MAX_SHIELD_LEVEL) {
          this.shieldLevel++;
          this.shieldCharge = UPGRADE.SHIELD_CHARGE_PER_LEVEL * this.shieldLevel;
        }
        break;
      case 'panicButton':
        if (this.panicCount < UPGRADE.MAX_PANIC_COUNT) this.panicCount++;
        break;
    }
    GameEvents.emit('player:upgraded', { upgradeType: type });
  }

  /**
   * Deploy the panic button. Returns the damage dealt to each enemy, or null
   * if the panic count is already zero.
   */
  deployPanic(): number | null {
    if (this.panicCount === 0) return null;
    const damage = this.panicDamage; // calculate before decrementing
    this.panicCount--;
    GameEvents.emit('panic:deployed', { damage });
    return damage;
  }

  restoreHalfHealth(): void {
    this.health = Math.min(this.maxHealth, this.health + this.maxHealth * PICKUP.HEALTH_RESTORE_RATIO);
    GameEvents.emit('health:changed', { current: this.health, max: this.maxHealth });
  }

  addExtraLife(): void {
    this.fleet++;
  }

  addScore(points: number): void {
    this.score += points;
    GameEvents.emit('score:changed', { score: this.score });
  }
}
