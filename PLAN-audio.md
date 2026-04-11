# ChaosCurtain — Audio

## Status: ACTIVE (Web Audio + ZzFX / ZzFXM)

Tone.js was removed from the main branch. Audio uses a **single `AudioContext`**, separate **music** and **SFX** gain buses (`AUDIO.MUSIC_VOLUME_DB` / `AUDIO.SFX_VOLUME_DB`), and **no live synthesis graph** for SFX (avoids the old Tone.js node-count / stutter issues).

| Piece | Role |
|--------|------|
| `AudioManager` | Creates context, `musicGainNode`, `sfxGainNode`; `unlock()` after first user gesture (`GameplayScene` start overlay). |
| `ZzfxSoundBank` | One-time bake: `ZZFX.buildSamples` from `zzfxPresets.ts` → `Float32Array` per cue. |
| `ZzfxSfxSystem` | Subscribes to `GameEvents`; plays one-shots via `AudioBufferSourceNode` → `sfxGainNode`. |
| `ZzfxmMusicPlayer` | Renders ZzFXM song data (`zzfxmRender.ts`) → stereo buffer → looping source → `musicGainNode`. |
| `src/audio/songs/music-jump.js` | Default BGM (converted MOD → ZzFXM); re-exported from `musicJumpSong.ts`. |

**DebugConfig:** `enableSfx`, `enableMusic` — set to `false` to mute either bus.

---

## Background music

- **In use:** ZzFXM procedural track **music-jump** (looping) after audio unlock, unless `enableMusic === false`.
- **Historical:** MIDI + `Tone.Transport` lived on branch **`chiptune-music`**; not used on `main`.

---

## Sound effects

- **In use:** `ZzfxSfxSystem` is constructed from `GameplayScene` when `enableSfx !== false`, after `ZzfxSoundBank.buildAll()`.
- **Presets:** `src/audio/zzfxPresets.ts` — original game `zzfx(...[, …])` sparse tuples (volume slot empty → default 1; randomness `0` for deterministic bakes).
- **Removed from tree:** `src/audio/SfxSystem.ts`, `src/audio/MusicSystem.ts` (old Tone-based implementations).

### Continuous cues (no unbounded synth nodes)

| Event | Behaviour |
|--------|-----------|
| `wrangler:tether` | Ref-count + `setInterval` replays baked `wranglerTether` tick while any tether is active. |
| `zapsphere:warning` | Ref-count + interval replays baked `zapWarning` while in danger. |

---

## SFX design specifications (design intent → current implementation)

Design columns describe the original intent; implementation is **ZzFX presets** + Web Audio playback (see `zzfxPresets.ts` / `ZzfxSfxSystem.ts`).

### Core cues

| Event | Design spec | Implementation |
|---|---|---|
| `bullet:fired` | Short downward chirp on each shot | ZzFX tuple (tunable in `zzfxPresets`) |
| `enemy:hit` light | Pitch proportional to damage magnitude | `enemyHitLight` vs `enemyHitHeavy` by `DAMAGE.HEAVY_HIT_THRESHOLD` |
| `enemy:hit` heavy | Short metallic clang | `enemyHitHeavy` |
| `enemy:died` regular | 3-note descending death chirp | `enemyDied` |
| `enemy:died` boss (≥2000 pts) | Two chord hits, dramatic | `enemyDiedBoss` |
| `player:hit` light / heavy | Bass thud scaling with hit severity | `playerHitLight` / `playerHitHeavy` by `DAMAGE.HEAVY_HIT_THRESHOLD` |
| `player:upgraded` | Ascending arpeggio | `upgraded` |
| `player:downgraded` | Descending arpeggio | `downgraded` |
| `panic:deployed` | White noise burst | `panic` |
| `pickup:collected` | Two-note chime | `pickup` |
| `zapsphere:lightning` | High crackling burst | `zapLightning` |

### Room / meta cues

| Event | Design spec | Implementation |
|---|---|---|
| `room:entered` | Noise-like buzz / alternating low tones | `roomEntered` |
| `room:cleared` | Fanfare | `roomCleared` |
| `enemy:spawned` | Upward chirp | `enemySpawned` |
| `wrangler:tether` | Continuous hum while tethered | Baked tick + interval (not Tone oscillator graph) |
| `zapsphere:warning` | Klaxon while in danger radius | Baked slice + interval |
| `fleet:lost` | Funeral march feel | `fleetLost` |
| `game:over` | Descending dirge | `gameOver` |
| `game:won` | Triumphant fanfare | `gameWon` |

### GameEvents (audio-related)

- `room:cleared` — `RoomManager.unlockDoors()`
- `enemy:spawned` — `SpawnerActor.spawnEnemy()`
- `wrangler:tether { active }` — `WranglerActor` tether state; **cleanup on `onPreKill`** (Excalibur does not call `onKill`)
- `zapsphere:warning { active }` — `ZapsphereActor` danger radius; **cleanup on `onPreKill`**
- `fleet:lost` / `game:over` — `SharedPlayerState.applyDamage()` when health hits 0

### Wrangler tether — player movement (2026 fix notes)

- Pull is registered on `PlayerActor.pullRegistry` (per-wrangler key). **`onPreKill`** removes the key so room unload and death always clear the map (the old `onKill` hook was never invoked by Excalibur).
- Very small separation: entry removed from registry (`TETHER_PULL_MIN_DIST`) to avoid stale vectors / jitter.
- **Smoothed** tether pull sum on the player + **zero** smoothed vector when registry is empty so tug does not “tail” after destroy.

---

## Proximity warnings (planned, not yet implemented)

Audio cues when enemies approach critical range (Blaster, Wrangler, Snake, general pulse) — still future work; see earlier plan bullets.
