# ChaosCurtain — Audio

## Technology

- **Tone.js** for all synthesis — chiptune aesthetic using square/sawtooth oscillators and noise
- Square and sawtooth wave oscillators via Tone.js `Synth`, `PolySynth`, `MetalSynth`, `MembraneSynth`, `NoiseSynth`
- `AudioManager` owns two master `Tone.Volume` nodes: `musicVol` and `sfxVol` (independently adjustable)
- Audio context unlocked on first user gesture (keydown / pointerdown) via `Tone.start()` — browser autoplay policy

### Background Music — Status: Deferred

- MIDI playback via `Tone.Transport` + `PolySynth` was implemented and archived on branch **`chiptune-music`**
- Root cause of choppiness: some MIDI tracks require up to 8 simultaneous voices and Tone.js `PolySynth` voice scheduling degrades under sustained polyphony load — not resolved
- Music playback is currently disabled; `SfxSystem` (below) remains active
- Future options: pre-render MIDI to OGG/MP3 and play via `Tone.Player`, or revisit polyphony management

---

## Sound Effects — Implemented (`src/audio/SfxSystem.ts`)

All voices routed through `AudioManager.sfxVol`. Per-voice time cursor prevents same-frame double-triggers on monophonic synths.

| Event | Voice | Sound |
|---|---|---|
| `bullet:fired` | `Tone.Synth` (square) | C6→C3 downchirp over 80 ms (exponential ramp), −18 dB |
| `enemy:hit` light | `Tone.Synth` (sawtooth) | Pitch scaled with damage magnitude |
| `enemy:hit` heavy | `PolySynth<MetalSynth>` | Short metallic clang; PolySynth wrapper survives rapid panic-button bursts |
| `enemy:died` regular | `Tone.Synth` (square) | 3-note descending chirp: A4→E4→A3 |
| `enemy:died` boss (≥2000 pts) | `Tone.PolySynth` | Two chord hits: Am → Gm |
| `player:hit` | `Tone.MembraneSynth` | Low bass thud at C1 |
| `player:upgraded` | `Tone.Synth` (triangle) | Ascending arpeggio: C5 E5 G5 C6 |
| `player:downgraded` | `Tone.Synth` (triangle) | Descending arpeggio: C6 G5 E5 C5 |
| `panic:deployed` | `Tone.NoiseSynth` | White noise burst |
| `pickup:collected` | `Tone.Synth` (triangle) | Two-note chime: C6 → E6 |
| `zapsphere:lightning` | `Tone.MetalSynth` | High crackling burst at 400 Hz |

### Unimplemented SFX (planned)
- Door open/close tones
- Enemy spawn burst
- Room cleared fanfare
- Fleet ship lost / game over sequences
- Wrangler tether hum
- Zapsphere proximity warning

---

## Proximity Warnings

Audio cues when enemies approach critical range:

- **Blaster** — most important; warn before it reaches lightning firing range
- **Wrangler** — warn before tether deploys
- **Snake** — warn when head is approaching to ram
- General low pulse increasing in frequency as any enemy reaches critical proximity
