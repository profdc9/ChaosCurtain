# ChaosCurtain — Audio

## Technology

- **Tone.js** for all synthesis — chiptune aesthetic using square/sawtooth oscillators and noise
- **`@tonejs/midi`** for MIDI parsing and playback
- Square and sawtooth wave oscillators via Tone.js `Synth` and `FMSynth`
- LFSR or LCG noise implemented in a custom `AudioWorkletNode`
- Background music sourced from free/public domain MIDI files (techno with a beat); user will source these
- Music volume ducks (smoothly fades down and back up) when intense sound effects play

---

## Sound Effects

| Event | Sound |
|---|---|
| Bullet fired | Brief high chirp — short square wave pulse |
| Enemy hit | Bass note + burst of LFSR noise (synced with scale pulse) |
| Enemy destroyed | Descending noise burst — longer than hit sound |
| Player hit | Distinct bass hit — lower/heavier than enemy hit |
| Enemy spawn | Brief noise burst — short, percussive |
| Door opens | Rising buzz — short sawtooth sweep upward |
| Door closes | Falling buzz — sawtooth sweep downward |
| Upgrade collected | Bright ascending bleep — short square wave arpeggio |
| Room cleared | Brief fanfare — a few ascending notes |
| Panic button deployed | Full noise burst — wide, impactful |
| Blaster lightning | Sharp crackling noise burst |
| Wrangler tether active | Continuous low hum while tethered — fades on tether break |
| Zapsphere danger zone | Rising pitch warning tone as dwell timer counts down |
| GlitchBoss glitching | Stuttering/glitchy noise |
| Fleet ship lost | Descending ominous tone |
| Game over | Slow descending sequence |

---

## Proximity Warnings

Audio cues when enemies approach critical range:

- **Blaster** — most important; warn before it reaches lightning firing range
- **Wrangler** — warn before tether deploys
- **Snake** — warn when head is approaching to ram
- General low pulse increasing in frequency as any enemy reaches critical proximity
