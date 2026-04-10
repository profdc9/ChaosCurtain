import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { AudioManager } from './AudioManager';
import { GameEvents } from '../utils/GameEvents';

type TrackName = 'gameplay' | 'boss';

const TRACK_URLS: Record<TrackName, string> = {
  gameplay: '/midi/airport_attack.mid',
  boss:     '/midi/punch_your_way_through.mid',
};

// Per-synth attenuation so multiple voices don't clip
const SYNTH_VOLUME_DB = -10;
// Maximum melodic tracks to activate — limits Web Audio node count
const MAX_TRACKS = 4;

interface NoteEvent {
  time:     number;
  note:     string;
  duration: number;
  velocity: number;
}

export class MusicSystem {
  private parts:        Tone.Part<NoteEvent>[] = [];
  private synths:       Tone.PolySynth[]       = [];
  private currentTrack: TrackName | null       = null;
  private readonly midiCache = new Map<TrackName, Midi>();

  // ── Diagnostic state ───────────────────────────────────────────────────────
  private _loopCount   = 0;
  private _notesFired  = 0;
  private _diagInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    GameEvents.on('room:entered', ({ isBoss }) => {
      void this.switchTo(isBoss ? 'boss' : 'gameplay');
    });
  }

  async switchTo(track: TrackName): Promise<void> {
    if (track === this.currentTrack) return;
    console.log(`[Music] switchTo: ${this.currentTrack ?? 'none'} → ${track}`);
    this.stop();
    this.currentTrack = track;
    const midi = await this.loadMidi(track);
    if (AudioManager.isUnlocked) this.play(midi);
    // If not yet unlocked, play() will be called from startPending() after unlock.
  }

  /** Call after AudioManager.unlock() to begin the pending track. */
  async startPending(): Promise<void> {
    if (this.currentTrack === null) return;
    if (this.parts.length > 0) return; // already playing
    const midi = await this.loadMidi(this.currentTrack);
    this.play(midi);
  }

  stop(): void {
    if (this.parts.length === 0 && this.synths.length === 0) return;
    console.log(`[Music] stop(): disposing ${this.parts.length} parts, ${this.synths.length} synths`);
    if (this._diagInterval !== null) {
      clearInterval(this._diagInterval);
      this._diagInterval = null;
    }
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    for (const part  of this.parts)  part.dispose();
    for (const synth of this.synths) synth.dispose();
    this.parts  = [];
    this.synths = [];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async loadMidi(track: TrackName): Promise<Midi> {
    if (this.midiCache.has(track)) return this.midiCache.get(track)!;
    const res = await fetch(TRACK_URLS[track]);
    const buf = await res.arrayBuffer();
    const midi = new Midi(buf);
    this.midiCache.set(track, midi);
    return midi;
  }

  private play(midi: Midi): void {
    const transport = Tone.getTransport();
    const bpm = midi.header.tempos[0]?.bpm ?? 120;
    transport.bpm.value = bpm;
    transport.loop    = true;
    transport.loopEnd = midi.duration;

    this._loopCount  = 0;
    this._notesFired = 0;

    // Log on each transport loop
    transport.on('loopEnd', () => {
      this._loopCount++;
      console.log(
        `[Music] loop #${this._loopCount} | parts=${this.parts.length}` +
        ` synths=${this.synths.length} notesFired=${this._notesFired}` +
        ` transport.pos=${transport.position}`,
      );
    });

    // Collect eligible tracks (non-empty, non-percussion), cap at MAX_TRACKS
    const allEligible = midi.tracks.filter(
      t => t.notes.length > 0 && t.channel !== 9,
    );
    const eligible = allEligible.slice(0, MAX_TRACKS);

    console.log(
      `[Music] play(): track="${this.currentTrack ?? ''}"` +
      ` BPM=${bpm} duration=${midi.duration.toFixed(2)}s` +
      ` totalMidiTracks=${midi.tracks.length}` +
      ` eligibleTracks=${allEligible.length} activating=${eligible.length}`,
    );

    eligible.forEach((track, i) => {
      const avgMidi = track.notes.reduce((s, n) => s + n.midi, 0) / track.notes.length;
      const isBass  = avgMidi < 55;

      // Count max simultaneous notes (worst-case polyphony demand)
      let maxSimul = 0;
      for (let a = 0; a < track.notes.length; a++) {
        const aEnd = track.notes[a].time + track.notes[a].duration;
        let simul = 1;
        for (let b = a + 1; b < track.notes.length; b++) {
          if (track.notes[b].time >= aEnd) break;
          simul++;
        }
        if (simul > maxSimul) maxSimul = simul;
      }

      console.log(
        `[Music]   track[${i}]: name="${track.name}" channel=${track.channel}` +
        ` notes=${track.notes.length} avgMidi=${avgMidi.toFixed(1)}` +
        ` type=${isBass ? 'bass' : 'melody'} maxSimulNotes=${maxSimul}`,
      );

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: isBass ? 'sawtooth' as const : 'square' as const },
        envelope:   isBass
          ? { attack: 0.01, decay: 0.1,  sustain: 0.3, release: 0.1  }
          : { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.05 },
      }).connect(AudioManager.musicVol);
      synth.maxPolyphony = 6;
      synth.volume.value = SYNTH_VOLUME_DB;

      const events: NoteEvent[] = track.notes
        .filter(n => n.duration > 0)
        .map(n => ({
          time:     n.time,
          note:     isBass
                      ? Tone.Frequency(Math.max(0, n.midi - 12), 'midi').toNote()
                      : n.name,
          duration: Math.max(0.016, n.duration),
          velocity: n.velocity,
        }));

      const part = new Tone.Part<NoteEvent>((time, ev) => {
        this._notesFired++;
        synth.triggerAttackRelease(ev.note, ev.duration, time, ev.velocity);
      }, events);

      part.start(0);
      this.parts.push(part);
      this.synths.push(synth);
    });

    // Periodic health check every 10 s
    this._diagInterval = setInterval(() => {
      const ctx = Tone.getContext().rawContext as AudioContext;
      console.log(
        `[Music] health: parts=${this.parts.length} synths=${this.synths.length}` +
        ` notesFired=${this._notesFired} loops=${this._loopCount}` +
        ` transport.state=${transport.state}` +
        ` audioCtx.state=${ctx.state}`,
      );
    }, 10_000);

    transport.start();
    console.log(`[Music] transport started — maxPolyphony=6 per synth`);
  }
}
