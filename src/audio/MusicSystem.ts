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

  constructor() {
    GameEvents.on('room:entered', ({ isBoss }) => {
      void this.switchTo(isBoss ? 'boss' : 'gameplay');
    });
  }

  async switchTo(track: TrackName): Promise<void> {
    if (track === this.currentTrack) return;
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
    transport.bpm.value = midi.header.tempos[0]?.bpm ?? 120;
    transport.loop    = true;
    transport.loopEnd = midi.duration;

    // Collect eligible tracks (non-empty, non-percussion), cap at MAX_TRACKS
    const eligible = midi.tracks.filter(
      t => t.notes.length > 0 && t.channel !== 9,
    ).slice(0, MAX_TRACKS);

    for (const track of eligible) {
      const avgMidi = track.notes.reduce((s, n) => s + n.midi, 0) / track.notes.length;
      const isBass  = avgMidi < 55;

      // PolySynth with 2 voices per track: each note gets its own oscillator so
      // simultaneous notes (common in MIDI) don't hit the "start time must be
      // strictly greater" assertion on a shared oscillator. The fixed pool of 2
      // prevents the unbounded voice accumulation that caused the original
      // degradation with unlimited polyphony.
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: isBass ? 'sawtooth' as const : 'square' as const },
        envelope:   isBass
          ? { attack: 0.01, decay: 0.1,  sustain: 0.3, release: 0.1  }
          : { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.05 },
      }).connect(AudioManager.musicVol);
      synth.maxPolyphony = 2;
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
        synth.triggerAttackRelease(ev.note, ev.duration, time, ev.velocity);
      }, events);

      part.start(0);
      this.parts.push(part);
      this.synths.push(synth);
    }

    transport.start();
  }
}
