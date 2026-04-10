# ChaosCurtain — Audio

## Status: ON HOLD

Both the music system and the SFX system have been implemented but disabled due to the same unresolved Tone.js issue: persistent audio stuttering (rapid on/off artefacts at ~10 Hz) that begins under normal game load and does not stop. Diagnostics confirmed the Tone.js scheduler is healthy (lag stable at −0.100 s); the root cause is likely total AudioNode count overwhelming the Web Audio render thread.

**All audio is currently silent.** The implementations are preserved in source for future revival.

### Recommended path forward

Pre-render all sounds to short OGG/MP3 clips and play them via `HTMLAudioElement` or raw Web Audio `AudioBufferSourceNode`, bypassing Tone.js's synthesis graph entirely. This avoids the node-count overhead that causes the stuttering.

---

## Technology (current, non-functional)

- **Tone.js** for all synthesis — chiptune aesthetic using square/sawtooth oscillators and noise
- `AudioManager` owns two master `Tone.Volume` nodes: `musicVol` and `sfxVol` (independently adjustable)
- Audio context unlock on first user gesture (keydown / pointerdown) via `Tone.start()` — browser autoplay policy

---

## Background Music — Status: Deferred (branch `chiptune-music`)

- MIDI playback via `Tone.Transport` + `PolySynth` implemented and archived on branch **`chiptune-music`**
- Root cause of choppiness: some MIDI tracks require up to 8 simultaneous voices; `PolySynth` voice scheduling degrades under sustained polyphony load — not resolved
- Music playback removed from main branch

---

## Sound Effects — Status: Deferred (`src/audio/SfxSystem.ts`)

Full implementation exists in `src/audio/SfxSystem.ts` but `SfxSystem` is not instantiated in `GameplayScene`. Same stuttering issue as music. The implementation and design specs are preserved below for when audio is revisited.

---

## SFX Design Specifications

### Original SFX (implemented in SfxSystem.ts)

| Event | Design spec | Implementation |
|---|---|---|
| `bullet:fired` | Short downward chirp on each shot | C6→C3 exponential ramp over 80 ms, square wave, −18 dB |
| `enemy:hit` light | Pitch proportional to damage magnitude | Sawtooth synth, MIDI note 52–64 scaled to damage |
| `enemy:hit` heavy | Short metallic clang | `PolySynth<MetalSynth>`, G3, 16th note |
| `enemy:died` regular | 3-note descending death chirp | Square wave: A4→E4→A3, 32nd notes |
| `enemy:died` boss (≥2000 pts) | Two chord hits, dramatic | Square PolySynth: Am → Gm chords |
| `player:hit` | Low bass thud | `MembraneSynth` at C1, 8th note |
| `player:upgraded` | Ascending arpeggio | Triangle wave: C5 E5 G5 C6, 32nd notes |
| `player:downgraded` | Descending arpeggio | Triangle wave: C6 G5 E5 C5, 32nd notes |
| `panic:deployed` | White noise burst | `NoiseSynth`, 8th note |
| `pickup:collected` | Two-note chime | Triangle wave: C6→E6 |
| `zapsphere:lightning` | High crackling burst | `MetalSynth` at 400 Hz, 32nd note |

### Additional SFX (implemented in SfxSystem.ts)

| Event | Design spec | Implementation |
|---|---|---|
| `room:entered` | Noise-like buzz: two alternating low tones (200 Hz / 300 Hz) alternating at 5 Hz | Square synth, 4 pulses at 0.15 s spacing |
| `room:cleared` | Fanfare | Ascending C5-E5-G5-C6 arpeggio, then held 4-note chord |
| `enemy:spawned` | Upward chirp 300→600 Hz | Square synth, exponential ramp over 80 ms |
| `wrangler:tether` | Continuous sinusoidal FM hum; frequency oscillates between 150–250 Hz at 2 Hz; fades in when tether activates, fades out on death | `Tone.Oscillator` (sine, freq=0) + `Tone.LFO` (2 Hz, 150–250 Hz); gated by `Tone.Volume` node; ref-counted for multiple wranglers |
| `zapsphere:warning` | Klaxon: two dissonant chords alternating at 2 Hz; continuous while player is inside danger radius | Square PolySynth, [E4,A#4] / [F4,B4] alternating every 500 ms via `setInterval`; ref-counted |
| `fleet:lost` | Slow funeral march, 4–5 seconds, played when a life is lost | Square synth, C3/G2/F2 bass march, 8 notes at 0.55 s/beat |
| `game:over` | Slow descending chromatic dirge | Sawtooth synth, C4 down to F3 chromatically over ~5 s |
| `game:won` | Extended triumphant fanfare, ~10 seconds | Square PolySynth, two ascending runs + chords + grand 7-voice final chord over ~8 s |

### GameEvents emitted (wired but SFX disabled)

- `room:cleared` — `RoomManager.unlockDoors()`
- `enemy:spawned` — `SpawnerActor.spawnEnemy()`
- `wrangler:tether { active }` — `WranglerActor.onKill()` / `onPreUpdate` (tether flip)
- `zapsphere:warning { active }` — `ZapsphereActor.onKill()` / `onPreUpdate` (danger radius enter/exit)
- `fleet:lost` / `game:over` — `SharedPlayerState.applyDamage()` when health hits 0

---

## Proximity Warnings (planned, not yet implemented)

Audio cues when enemies approach critical range:

- **Blaster** — warn before it reaches lightning firing range
- **Wrangler** — warn before tether deploys
- **Snake** — warn when head is approaching to ram
- General low pulse increasing in frequency as any enemy reaches critical proximity
