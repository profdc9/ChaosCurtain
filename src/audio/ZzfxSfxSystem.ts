import { AudioManager } from './AudioManager';
import { DAMAGE } from '../constants';
import { GameEvents } from '../utils/GameEvents';
import { ZzfxSoundBank, ZZFX_BAKE_SAMPLE_RATE } from './ZzfxSoundBank';
import type { SfxPresetId } from './zzfxPresets';

const BOSS_POINTS_THRESHOLD = 2000;

/**
 * Subscribes to {@link GameEvents} and plays pre-baked ZzFX buffers through Web Audio.
 * Continuous cues (tether / zap warning) use ref-counted timers, not unbounded OscillatorNodes.
 */
export class ZzfxSfxSystem {
  private tetherRef = 0;
  private tetherInterval: ReturnType<typeof setInterval> | null = null;
  private zapWarnRef = 0;
  private zapWarnInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    GameEvents.on('bullet:fired', () => this.play('bulletFired'));
    GameEvents.on('enemy:hit', (e) => this.onEnemyHit(e.damage));
    GameEvents.on('enemy:died', (e) =>
      this.play(e.points >= BOSS_POINTS_THRESHOLD ? 'enemyDiedBoss' : 'enemyDied'),
    );
    GameEvents.on('player:hit', (e) =>
      this.play(e.damage >= DAMAGE.HEAVY_HIT_THRESHOLD ? 'playerHitHeavy' : 'playerHitLight'),
    );
    GameEvents.on('player:upgraded', () => this.play('upgraded'));
    GameEvents.on('player:downgraded', () => this.play('downgraded'));
    GameEvents.on('panic:deployed', () => this.play('panic'));
    GameEvents.on('pickup:collected', () => this.play('pickup'));
    GameEvents.on('zapsphere:lightning', () => this.play('zapLightning'));
    GameEvents.on('room:entered', () => this.play('roomEntered'));
    GameEvents.on('room:cleared', () => this.play('roomCleared'));
    GameEvents.on('enemy:spawned', () => this.play('enemySpawned'));
    GameEvents.on('fleet:lost', () => this.play('fleetLost'));
    GameEvents.on('game:over', () => this.play('gameOver'));
    GameEvents.on('game:won', () => this.play('gameWon'));

    GameEvents.on('wrangler:tether', ({ active }) => this.onTether(active));
    GameEvents.on('zapsphere:warning', ({ active }) => this.onZapWarn(active));
  }

  private onEnemyHit(damage: number): void {
    this.play(damage >= DAMAGE.HEAVY_HIT_THRESHOLD ? 'enemyHitHeavy' : 'enemyHitLight');
  }

  private onTether(active: boolean): void {
    if (active) {
      this.tetherRef++;
      if (this.tetherRef === 1) {
        this.play('wranglerTether');
        this.tetherInterval = setInterval(() => this.play('wranglerTether'), 320);
      }
    } else {
      this.tetherRef = Math.max(0, this.tetherRef - 1);
      if (this.tetherRef === 0 && this.tetherInterval !== null) {
        clearInterval(this.tetherInterval);
        this.tetherInterval = null;
      }
    }
  }

  private onZapWarn(active: boolean): void {
    if (active) {
      this.zapWarnRef++;
      if (this.zapWarnRef === 1) {
        this.play('zapWarning');
        this.zapWarnInterval = setInterval(() => this.play('zapWarning'), 520);
      }
    } else {
      this.zapWarnRef = Math.max(0, this.zapWarnRef - 1);
      if (this.zapWarnRef === 0 && this.zapWarnInterval !== null) {
        clearInterval(this.zapWarnInterval);
        this.zapWarnInterval = null;
      }
    }
  }

  private play(id: SfxPresetId, playbackRate = 1): void {
    if (!AudioManager.isUnlocked) return;
    const ctx = AudioManager.context;
    const bus = AudioManager.sfxGainNode;
    const samples = ZzfxSoundBank.get(id);
    if (!ctx || !bus || !samples?.length) return;

    const buf = ctx.createBuffer(1, samples.length, ZZFX_BAKE_SAMPLE_RATE);
    buf.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = playbackRate;
    src.connect(bus);
    src.onended = () => src.disconnect();
    try {
      src.start();
    } catch {
      src.disconnect();
    }
  }
}
