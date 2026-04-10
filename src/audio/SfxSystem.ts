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
      envelope:   { attack: 0.001, decay: 0.08, sustain: 0, release: 0.01 },
      volume: -18,
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

  // Per-voice "next safe start time" — prevents same-timestamp double-trigger
  // on monophonic synths, which Tone.js rejects with a fatal assertion.
  private readonly voiceNextTime = new Map<object, number>();
  private static readonly MIN_GAP = 0.005; // 5 ms minimum between triggers

  /**
   * Returns the safe time to schedule the next event on `voice`, or null if
   * the AudioContext is not yet running. Advances the per-voice cursor so the
   * next call is guaranteed to be strictly later.
   */
  private now(voice: object, span = 0): number | null {
    if (!AudioManager.isUnlocked) return null;
    const t    = Tone.now();
    const last = this.voiceNextTime.get(voice) ?? 0;
    const safe = Math.max(t, last + SfxSystem.MIN_GAP);
    this.voiceNextTime.set(voice, safe + span + SfxSystem.MIN_GAP);
    return safe;
  }

  private subscribe(): void {
    GameEvents.on('bullet:fired', () => {
      const dur = 0.08;
      const now = this.now(this.shoot, dur); if (now === null) return;
      this.shoot.triggerAttack('C6', now);
      this.shoot.frequency.setValueAtTime(Tone.Frequency('C6').toFrequency(), now);
      this.shoot.frequency.exponentialRampToValueAtTime(
        Tone.Frequency('C3').toFrequency(), now + dur,
      );
      this.shoot.triggerRelease(now + dur);
    });

    GameEvents.on('enemy:hit', ({ damage }) => {
      if (damage >= DAMAGE.HEAVY_HIT_THRESHOLD) {
        const now = this.now(this.hitHeavy, 0.15); if (now === null) return;
        this.hitHeavy.triggerAttackRelease('16n', now);
      } else {
        const now = this.now(this.hitLight, 0.08); if (now === null) return;
        const midiNote = 52 + Math.round((damage / DAMAGE.HEAVY_HIT_THRESHOLD) * 12);
        const note = Tone.Frequency(midiNote, 'midi').toNote();
        this.hitLight.triggerAttackRelease(note, '32n', now);
      }
    });

    GameEvents.on('enemy:died', ({ points }) => {
      if (points >= 2000) {
        const now = this.now(this.bossDie, 0.4); if (now === null) return;
        this.bossDie.triggerAttackRelease(['A4', 'C5', 'E5'], '8n', now);
        this.bossDie.triggerAttackRelease(['G3', 'A#3', 'D4'], '4n', now + 0.15);
      } else {
        const now = this.now(this.enemyDie, 0.24); if (now === null) return;
        this.enemyDie.triggerAttackRelease('A4', '32n', now);
        this.enemyDie.triggerAttackRelease('E4', '32n', now + 0.08);
        this.enemyDie.triggerAttackRelease('A3', '32n', now + 0.16);
      }
    });

    GameEvents.on('player:hit', () => {
      const now = this.now(this.playerHit, 0.25); if (now === null) return;
      this.playerHit.triggerAttackRelease('C1', '8n', now);
    });

    GameEvents.on('player:upgraded', () => {
      const now = this.now(this.upgrade, 0.28); if (now === null) return;
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) =>
        this.upgrade.triggerAttackRelease(n, '32n', now + i * 0.07));
    });

    GameEvents.on('player:downgraded', () => {
      const now = this.now(this.downgrade, 0.28); if (now === null) return;
      ['C6', 'G5', 'E5', 'C5'].forEach((n, i) =>
        this.downgrade.triggerAttackRelease(n, '32n', now + i * 0.07));
    });

    GameEvents.on('panic:deployed', () => {
      const now = this.now(this.panicNoise, 0.4); if (now === null) return;
      this.panicNoise.triggerAttackRelease('8n', now);
    });

    GameEvents.on('pickup:collected', () => {
      const now = this.now(this.pickupChime, 0.12); if (now === null) return;
      this.pickupChime.triggerAttackRelease('C6', '16n', now);
      this.pickupChime.triggerAttackRelease('E6', '16n', now + 0.06);
    });

    GameEvents.on('zapsphere:lightning', () => {
      const now = this.now(this.zapCrackle, 0.2); if (now === null) return;
      this.zapCrackle.triggerAttackRelease('32n', now);
    });
  }
}
