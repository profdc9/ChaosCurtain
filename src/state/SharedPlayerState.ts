import { PLAYER } from '../constants';
import { GameEvents } from '../utils/GameEvents';

export class SharedPlayerState {
  health: number;
  readonly maxHealth: number;
  fleet: number;
  score: number;

  constructor() {
    this.maxHealth = PLAYER.START_HEALTH;
    this.health = this.maxHealth;
    this.fleet = PLAYER.START_FLEET;
    this.score = 0;
  }

  get healthRatio(): number {
    return this.health / this.maxHealth;
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    GameEvents.emit('health:changed', { current: this.health, max: this.maxHealth });
    GameEvents.emit('player:hit', { damage: amount });
  }

  addScore(points: number): void {
    this.score += points;
    GameEvents.emit('score:changed', { score: this.score });
  }
}
