import * as ex from 'excalibur';
import { DAMAGE } from '../constants';

export class HealthComponent extends ex.Component {
  private current: number;
  private dead = false;

  constructor(
    private readonly max: number,
    private readonly onDamageCallback: (healthRatio: number, damageAmount: number) => void,
    private readonly onDeathCallback: () => void,
  ) {
    super();
    this.current = max;
  }

  get healthRatio(): number {
    return this.current / this.max;
  }

  takeDamage(amount: number): void {
    if (this.dead) return;
    this.current = Math.max(0, this.current - amount);
    const ratio = this.current / this.max;
    this.onDamageCallback(ratio, amount);
    if (this.current <= 0) {
      this.dead = true;
      this.onDeathCallback();
    }
  }

  static getPulseDuration(damage: number): number {
    if (damage >= DAMAGE.HEAVY_HIT_THRESHOLD) return DAMAGE.HEAVY_PULSE_DURATION;
    if (damage >= DAMAGE.LIGHT_HIT_THRESHOLD) return DAMAGE.MEDIUM_PULSE_DURATION;
    return DAMAGE.LIGHT_PULSE_DURATION;
  }

  static getScaleSpeed(pulseDuration: number): number {
    // Speed (scale units/sec) to reach SCALE_PEAK in half the total pulse duration
    return (DAMAGE.SCALE_PEAK - 1.0) / (pulseDuration / 2);
  }
}
