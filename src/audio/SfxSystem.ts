import * as Tone from 'tone';
import { GameEvents } from '../utils/GameEvents';
import { AudioManager } from './AudioManager';
import { DAMAGE } from '../constants';

/**
 * Procedural chiptune SFX — one synth voice per sound category, all routed
 * through AudioManager.sfxVol. Subscribes to GameEvents at construction time.
 */
export class SfxSystem {
  // ── Voices ──────────────────────────────────────────────────────────────────
  private readonly shoot: Tone.Synth;
  private readonly hitLight: Tone.Synth;
  private readonly hitHeavy: Tone.MetalSynth;
  private readonly enemyDie: Tone.Synth;
  private readonly bossDie: Tone.PolySynth;
  private readonly playerHit: Tone.MembraneSynth;
  private readonly upgrade: Tone.Synth;
  private readonly downgrade: Tone.Synth;
  private readonly panicNoise: Tone.NoiseSynth;
  private readonly pickupChime: Tone.Synth;
  private readonly zapCrackle: Tone.MetalSynth;

  constructor() {
    const dst = AudioManager.sfxVol;

    this.shoot = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope:   { attack: 0.001, decay: 0.06, sustain: 0, release: 0.01 },
      volume: -8,
    }).connect(dst);

    this.hitLight = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope:   { attack: 0.001, decay: 0.08, sustain: 0, release: 0.01 },
      volume: -10,
    }).connect(dst);

    this.hitHeavy = new Tone.MetalSynth({
      envelope:        { attack: 0.001, decay: 0.15, release: 0.01 },
      harmonicity:     5.1,
      modulationIndex: 32,
      resonance:       4000,
      octaves:         1.5,
      volume:          -8,
    }).connect(dst);
    this.hitHeavy.frequency.value = 200;

    this.enemyDie = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope:   { attack: 0.001, decay: 0.07, sustain: 0, release: 0.01 },
      volume: -8,
    }).connect(dst);

    this.bossDie = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope:   { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.3 },
      volume: -8,
    }).connect(dst);

    this.playerHit = new Tone.MembraneSynth({
      pitchDecay:  0.08,
      octaves:     4,
      envelope:    { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
      volume: -6,
    }).connect(dst);

    this.upgrade = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.001, decay: 0.07, sustain: 0, release: 0.01 },
      volume: -8,
    }).connect(dst);

    this.downgrade = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.001, decay: 0.07, sustain: 0, release: 0.01 },
      volume: -8,
    }).connect(dst);

    this.panicNoise = new Tone.NoiseSynth({
      noise:    { type: 'white' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 },
      volume: -6,
    }).connect(dst);

    this.pickupChime = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      volume: -8,
    }).connect(dst);

    this.zapCrackle = new Tone.MetalSynth({
      envelope:        { attack: 0.001, decay: 0.2, release: 0.05 },
      harmonicity:     8.5,
      modulationIndex: 40,
      resonance:       7000,
      octaves:         2,
      volume:          -6,
    }).connect(dst);
    this.zapCrackle.frequency.value = 400;

    this.subscribe();
  }

  // ── Event subscriptions ──────────────────────────────────────────────────────

  private subscribe(): void {
    GameEvents.on('bullet:fired', () => {
      const now = Tone.now();
      this.shoot.triggerAttackRelease('C6', '64n', now);
    });

    GameEvents.on('enemy:hit', ({ damage }) => {
      const now = Tone.now();
      if (damage >= DAMAGE.HEAVY_HIT_THRESHOLD) {
        this.hitHeavy.triggerAttackRelease('16n', now);
      } else {
        // Pitch scales with damage: more damage → higher pitch
        const midiNote = 52 + Math.round((damage / DAMAGE.HEAVY_HIT_THRESHOLD) * 12);
        const note = Tone.Frequency(midiNote, 'midi').toNote();
        this.hitLight.triggerAttackRelease(note, '32n', now);
      }
    });

    GameEvents.on('enemy:died', ({ points }) => {
      const now = Tone.now();
      if (points >= 2000) {
        // Boss death: descending minor chord burst
        this.bossDie.triggerAttackRelease(['A4', 'C5', 'E5'], '8n', now);
        this.bossDie.triggerAttackRelease(['G3', 'A#3', 'D4'], '4n', now + 0.15);
      } else {
        // Regular death: quick descending 3-note chirp
        this.enemyDie.triggerAttackRelease('A4', '32n', now);
        this.enemyDie.triggerAttackRelease('E4', '32n', now + 0.08);
        this.enemyDie.triggerAttackRelease('A3', '32n', now + 0.16);
      }
    });

    GameEvents.on('player:hit', () => {
      this.playerHit.triggerAttackRelease('C1', '8n', Tone.now());
    });

    GameEvents.on('player:upgraded', () => {
      const now = Tone.now();
      const notes = ['C5', 'E5', 'G5', 'C6'];
      notes.forEach((n, i) => this.upgrade.triggerAttackRelease(n, '32n', now + i * 0.07));
    });

    GameEvents.on('player:downgraded', () => {
      const now = Tone.now();
      const notes = ['C6', 'G5', 'E5', 'C5'];
      notes.forEach((n, i) => this.downgrade.triggerAttackRelease(n, '32n', now + i * 0.07));
    });

    GameEvents.on('panic:deployed', () => {
      this.panicNoise.triggerAttackRelease('8n', Tone.now());
    });

    GameEvents.on('pickup:collected', () => {
      const now = Tone.now();
      this.pickupChime.triggerAttackRelease('C6', '16n', now);
      this.pickupChime.triggerAttackRelease('E6', '16n', now + 0.06);
    });

    GameEvents.on('zapsphere:lightning', () => {
      this.zapCrackle.triggerAttackRelease('32n', Tone.now());
    });
  }
}
