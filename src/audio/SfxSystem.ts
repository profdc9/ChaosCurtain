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
  private readonly hitHeavy: Tone.PolySynth<Tone.MetalSynth>;
  private readonly enemyDie: Tone.Synth;
  private readonly bossDie: Tone.PolySynth;
  private readonly playerHit: Tone.MembraneSynth;
  private readonly upgrade: Tone.Synth;
  private readonly downgrade: Tone.Synth;
  private readonly panicNoise: Tone.NoiseSynth;
  private readonly pickupChime: Tone.Synth;
  private readonly zapCrackle: Tone.MetalSynth;

  // ── New voices ───────────────────────────────────────────────────────────────
  private readonly doorBuzz: Tone.Synth;
  private readonly spawnChirp: Tone.Synth;
  private readonly fanfare: Tone.PolySynth;
  private readonly tetherGain: Tone.Volume;
  private readonly tetherOsc: Tone.Oscillator;
  private readonly tetherLfo: Tone.LFO;
  private tetherCount = 0;
  private readonly zapWarnSynth: Tone.PolySynth;
  private zapWarnInterval: ReturnType<typeof setInterval> | null = null;
  private zapWarnPhase = 0;
  private zapWarnCount = 0;
  private readonly marchSynth: Tone.Synth;
  private readonly gameOverSynth: Tone.Synth;
  private readonly gameWonSynth: Tone.PolySynth;

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

    this.hitHeavy = new Tone.PolySynth(Tone.MetalSynth, {
      envelope:        { attack: 0.001, decay: 0.15, release: 0.01 },
      harmonicity:     5.1,
      modulationIndex: 32,
      resonance:       4000,
      octaves:         1.5,
      volume:          -8,
    }).connect(dst);
    this.hitHeavy.maxPolyphony = 4;

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

    // ── New voices ─────────────────────────────────────────────────────────────

    this.doorBuzz = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope:   { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      volume: -10,
    }).connect(dst);

    this.spawnChirp = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope:   { attack: 0.001, decay: 0.08, sustain: 0, release: 0.01 },
      volume: -14,
    }).connect(dst);

    this.fanfare = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope:   { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 },
      volume: -6,
    }).connect(dst);
    (this.fanfare as Tone.PolySynth).maxPolyphony = 6;

    // Tether hum: always-running oscillator gated by a Volume node.
    // The LFO drives frequency between 150–250 Hz at 2 Hz.
    // Starts silent; volume raised when tether becomes active.
    this.tetherGain = new Tone.Volume(-80).connect(dst);
    this.tetherOsc  = new Tone.Oscillator({ type: 'sine', frequency: 0 })
      .connect(this.tetherGain);
    this.tetherLfo  = new Tone.LFO({ frequency: 2, min: 150, max: 250 });
    this.tetherLfo.connect(this.tetherOsc.frequency);

    this.zapWarnSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope:   { attack: 0.001, decay: 0.18, sustain: 0.1, release: 0.05 },
      volume: -8,
    }).connect(dst);
    (this.zapWarnSynth as Tone.PolySynth).maxPolyphony = 4;

    this.marchSynth = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope:   { attack: 0.01, decay: 0.35, sustain: 0.3, release: 0.4 },
      volume: -4,
    }).connect(dst);

    this.gameOverSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope:   { attack: 0.05, decay: 0.6, sustain: 0.3, release: 0.8 },
      volume: -4,
    }).connect(dst);

    this.gameWonSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope:   { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.7 },
      volume: -5,
    }).connect(dst);
    (this.gameWonSynth as Tone.PolySynth).maxPolyphony = 8;

    // ── Intercept console.warn to catch which PolySynth exceeds polyphony ────
    const origWarn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('Max polyphony')) {
        // Walk the call stack to find the PolySynth instance involved
        const synths: Array<[string, Tone.PolySynth]> = [
          ['hitHeavy',    this.hitHeavy as unknown as Tone.PolySynth],
          ['bossDie',     this.bossDie],
          ['fanfare',     this.fanfare],
          ['zapWarnSynth',this.zapWarnSynth],
          ['gameWonSynth',this.gameWonSynth],
        ];
        // Log active voice counts for each PolySynth at the moment of overflow
        const counts = synths.map(([name, ps]) => {
          const activeVoices = (ps as unknown as { _voices: unknown[] })._voices?.filter(
            (v: unknown) => (v as { _state?: { state?: string } })._state?.state === 'started'
          ).length ?? '?';
          return `${name}=${activeVoices}`;
        }).join(' ');
        origWarn(`[SFX OVERFLOW] Max polyphony exceeded — active voices: ${counts}`);
        return;
      }
      origWarn(...args);
    };

    this.subscribe();

    // ── Diagnostic health check every 5 s ─────────────────────────────────────
    setInterval(() => {
      const ctx = Tone.getContext().rawContext as AudioContext;
      console.log(
        `[SFX health] ctx.state=${ctx.state}` +
        ` currentTime=${ctx.currentTime.toFixed(2)}` +
        ` toneNow=${Tone.now().toFixed(2)}` +
        ` lag=${(ctx.currentTime - Tone.now()).toFixed(3)}`,
      );
    }, 5000);
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
   *
   * @param maxDelay  If the cursor is this far (seconds) ahead of now, the event
   *                  is dropped (returns null) and the cursor is reset to now.
   *                  Use for high-frequency voices (shoot, hit) to prevent a
   *                  build-up of queued notes that plays out as a rapid burst
   *                  after combat ends.
   */
  private now(voice: object, span = 0, maxDelay = Infinity): number | null {
    if (!AudioManager.isUnlocked) return null;
    const t    = Tone.now();
    const last = this.voiceNextTime.get(voice) ?? 0;
    const safe = Math.max(t, last + SfxSystem.MIN_GAP);
    if (safe - t > maxDelay) {
      // Cursor too far ahead — drop this event but keep the cursor where it is.
      // Do NOT reset to t: Tone.js's StateTimeline already has notes scheduled up
      // to the cursor, and scheduling behind them throws "time must be >= last
      // scheduled time". Leave the cursor alone; real time catches up naturally.
      return null;
    }
    this.voiceNextTime.set(voice, safe + span + SfxSystem.MIN_GAP);
    return safe;
  }

  private subscribe(): void {
    // ── Rate diagnostics for high-frequency events ────────────────────────────
    let hitCount = 0; let hitLogTimer = 0;
    let bulletCount = 0; let bulletLogTimer = 0;

    GameEvents.on('bullet:fired', () => { bulletCount++; });
    GameEvents.on('enemy:hit',    () => { hitCount++;    });
    setInterval(() => {
      const t = performance.now() / 1000;
      if (bulletCount > 0 || hitCount > 0) {
        console.log(`[SFX rates] bullet:fired=${bulletCount}/s  enemy:hit=${hitCount}/s`);
      }
      bulletCount = 0; hitCount = 0;
      bulletLogTimer = t; hitLogTimer = t;
    }, 1000);

    GameEvents.on('bullet:fired', () => {
      const dur = 0.08;
      const now = this.now(this.shoot, dur, 0.15); if (now === null) return;
      this.shoot.triggerAttack('C6', now);
      this.shoot.frequency.setValueAtTime(Tone.Frequency('C6').toFrequency(), now);
      this.shoot.frequency.exponentialRampToValueAtTime(
        Tone.Frequency('C3').toFrequency(), now + dur,
      );
      this.shoot.triggerRelease(now + dur);
    });

    GameEvents.on('enemy:hit', ({ damage }) => {
      if (damage >= DAMAGE.HEAVY_HIT_THRESHOLD) {
        const now = this.now(this.hitHeavy, 0.15, 0.15); if (now === null) return;
        this.hitHeavy.triggerAttackRelease('G3', '16n', now);
      } else {
        const now = this.now(this.hitLight, 0.08, 0.10); if (now === null) return;
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

    // ── Door lock buzz (room:entered): 4 alternating 200/300 Hz pulses at ~5 Hz ──
    GameEvents.on('room:entered', () => {
      const now = this.now(this.doorBuzz, 0.6); if (now === null) return;
      const freqs = [200, 300, 200, 300];
      freqs.forEach((f, i) => {
        this.doorBuzz.triggerAttackRelease(f, '32n', now + i * 0.15);
      });
    });

    // ── Room cleared fanfare: ascending arpeggio then held chord ──────────────
    GameEvents.on('room:cleared', () => {
      const now = this.now(this.fanfare, 2.5); if (now === null) return;
      // Ascending arpeggio
      (['C5', 'E5', 'G5', 'C6'] as const).forEach((n, i) => {
        this.fanfare.triggerAttackRelease(n, '16n', now + i * 0.15);
      });
      // Held chord
      this.fanfare.triggerAttackRelease(['C5', 'E5', 'G5', 'C6'], '2n', now + 0.8);
    });

    // ── Enemy spawned: upchirp 300→600 Hz over 80 ms ─────────────────────────
    let spawnCount = 0;
    let spawnLogTimer = 0;
    GameEvents.on('enemy:spawned', () => {
      spawnCount++;
      const t = performance.now() / 1000;
      if (t - spawnLogTimer >= 1.0) {
        console.log(`[SFX] enemy:spawned rate: ${spawnCount}/s (last 1s)`);
        spawnCount = 0;
        spawnLogTimer = t;
      }
      const dur = 0.08;
      const now = this.now(this.spawnChirp, dur); if (now === null) return;
      this.spawnChirp.triggerAttack(300, now);
      this.spawnChirp.frequency.setValueAtTime(300, now);
      this.spawnChirp.frequency.exponentialRampToValueAtTime(600, now + dur);
      this.spawnChirp.triggerRelease(now + dur);
    });

    // ── Wrangler tether hum: sinusoidal FM drone 150–250 Hz at 2 Hz ──────────
    GameEvents.on('wrangler:tether', ({ active }) => {
      if (active) {
        this.tetherCount++;
        if (this.tetherCount === 1) {
          if (!AudioManager.isUnlocked) { this.tetherCount = 0; return; }
          this.tetherOsc.start();
          this.tetherLfo.start();
          this.tetherGain.volume.rampTo(-12, 0.1);
        }
      } else {
        this.tetherCount = Math.max(0, this.tetherCount - 1);
        if (this.tetherCount === 0) {
          this.tetherGain.volume.rampTo(-80, 0.3);
          // Stop oscillator after fade-out
          const stopAt = Tone.now() + 0.35;
          this.tetherOsc.stop(stopAt);
          this.tetherLfo.stop(stopAt);
        }
      }
    });

    // ── Zapsphere proximity klaxon: dissonant chords alternating at 2 Hz ─────
    GameEvents.on('zapsphere:warning', ({ active }) => {
      if (active) {
        this.zapWarnCount++;
        if (this.zapWarnCount === 1) {
          this.zapWarnPhase = 0;
          this.zapWarnInterval = setInterval(() => {
            if (!AudioManager.isUnlocked) return;
            const t = Tone.now() + 0.01;
            const chords = [['E4', 'A#4'], ['F4', 'B4']];
            this.zapWarnSynth.triggerAttackRelease(chords[this.zapWarnPhase], '16n', t);
            this.zapWarnPhase = 1 - this.zapWarnPhase;
          }, 500);
        }
      } else {
        this.zapWarnCount = Math.max(0, this.zapWarnCount - 1);
        if (this.zapWarnCount === 0 && this.zapWarnInterval !== null) {
          clearInterval(this.zapWarnInterval);
          this.zapWarnInterval = null;
        }
      }
    });

    // ── Fleet lost march: slow 4-second funeral march ─────────────────────────
    GameEvents.on('fleet:lost', () => {
      const b = 0.55; // seconds per beat (≈ 109 bpm, "slow march")
      const total = b * 6;
      const now = this.now(this.marchSynth, total); if (now === null) return;
      const notes: [string, number][] = [
        ['C3',  0      ],
        ['C3',  b * 0.4],
        ['G2',  b      ],
        ['C3',  b * 2  ],
        ['C3',  b * 2.4],
        ['F2',  b * 3  ],
        ['G2',  b * 4  ],
        ['C3',  b * 5  ],
      ];
      notes.forEach(([n, t]) => this.marchSynth.triggerAttackRelease(n, '8n', now + t));
    });

    // ── Game over dirge: slow descending chromatic sequence ───────────────────
    GameEvents.on('game:over', () => {
      const now = this.now(this.gameOverSynth, 6.0); if (now === null) return;
      const notes: [string, number][] = [
        ['C4',  0  ],
        ['B3',  0.6],
        ['A#3', 1.2],
        ['A3',  1.8],
        ['G#3', 2.4],
        ['G3',  3.0],
        ['F#3', 3.8],
        ['F3',  4.8],
      ];
      notes.forEach(([n, t]) => this.gameOverSynth.triggerAttackRelease(n, '4n', now + t));
    });

    // ── Game won fanfare: extended 10-second ascending triumph ────────────────
    GameEvents.on('game:won', () => {
      const now = this.now(this.gameWonSynth, 8.0); if (now === null) return;
      // Run 1: ascending arpeggio
      (['C5', 'E5', 'G5', 'C6'] as const).forEach((n, i) =>
        this.gameWonSynth.triggerAttackRelease(n, '16n', now + i * 0.15));
      // First chord
      this.gameWonSynth.triggerAttackRelease(['C5', 'E5', 'G5', 'C6'], '4n', now + 0.8);
      // Run 2: faster, higher
      (['C5', 'E5', 'G5', 'C6', 'E6', 'G6'] as const).forEach((n, i) =>
        this.gameWonSynth.triggerAttackRelease(n, '32n', now + 1.6 + i * 0.1));
      // Second chord
      this.gameWonSynth.triggerAttackRelease(['C5', 'E5', 'G5', 'C6', 'E6'], '2n', now + 2.4);
      // Grand ascending flourish
      (['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'] as const).forEach((n, i) =>
        this.gameWonSynth.triggerAttackRelease(n, '16n', now + 4.2 + i * 0.1));
      // Final grand chord
      this.gameWonSynth.triggerAttackRelease(
        ['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'], '1n', now + 5.4);
    });
  }
}
