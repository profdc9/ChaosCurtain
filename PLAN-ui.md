# ChaosCurtain — UI, Menus, Audio & Scoring

## Visual Style — UI

- All UI elements drawn as vector line graphics — boxes, buttons, borders are stroked lines only
- Fonts rendered as stroke-based vector characters (Asteroids/Tempest style) — each letter is a series of line segments
- No bitmap fonts, no filled shapes — fully consistent with the game aesthetic
- A custom stroke font will need to be implemented or a suitable vector font library found

---

## Audio

### Technology
- **Tone.js** for all synthesis
- **`@tonejs/midi`** for MIDI parsing and playback
- Square and sawtooth wave oscillators via Tone.js `Synth` and `FMSynth`
- LFSR or LCG noise implemented in a custom `AudioWorkletNode`
- Background music sourced from free/public domain MIDI files (techno with a beat); user will source these
- Music volume ducks (smoothly fades down and back up) when intense sound effects play

### Sound Effects

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

### Proximity Warnings
Audio cues when enemies approach critical range:
- **Blaster** — most important; warn before it reaches lightning firing range
- **Wrangler** — warn before tether deploys
- **Snake** — warn when head is approaching to ram
- General low pulse increasing in frequency as any enemy reaches critical proximity

---

## Main Menu

- Start Game
- Choose Number of Players (1 or 2)
- Test Controls — verify gamepad or mouse+keyboard input; see ship move and fire
- Settings — music volume, SFX volume, control configuration
- Quit
- **Secret keypress** — reveals a seed entry field for the maze generator (useful for testing and sharing specific mazes)

---

## HUD (minimal, arcade style)

| Element | Description |
|---|---|
| Score | Current total score |
| Multiplier | Current kill streak multiplier; hidden or shows 1× when inactive; flashes/pulses when active |
| Room timer | Time elapsed since entering current room |
| Health bar | Shared health pool |
| Fleet count | Lives remaining |
| Shooter type | Upgrade level indicator |
| Weapon power | Square-with-dot icon × level |
| Shield | Box-with-X icon × level + charge indicator |
| Panic buttons | Top hat icon × count |

---

## Pause Menu

- Resume
- Quit

---

## Game Over / Victory Screen

- Final score
- Rooms cleared
- Enemies destroyed by type (one count per enemy type: Wanderer, Dart, Wrangler, Satellite, Worm, Blaster, Bird, Snake, Zapsphere, GlitchBoss)
- Time elapsed (total run)

---

## Scoring System

### Per-Enemy Points
Each enemy type has a base point value. Rough hierarchy (exact values TBD during balancing):

Wanderer < Dart < Worm < Satellite < Blaster < Wrangler < Bird < Snake < Zapsphere < GlitchBoss

Bosses worth significantly more than regular enemies.

### Room Clear Bonus
- Awarded when all enemies and spawners in a room are destroyed
- Scales with room difficulty — harder rooms yield larger bonuses

### Time Bonus
- Awarded on room clear based on speed of clear
- Faster clear = larger bonus
- Incentivizes aggressive play over cautious farming

### Kill Streak Multiplier
- Triggered when a threshold number of enemies are destroyed within a rolling 10-second window
- Multiplier increases with successive kills within the window
- Resets when the window expires without enough kills
- Example tiers (TBD during balancing):
  - 3 kills / 10s → 2×
  - 5 kills / 10s → 3×
  - 8 kills / 10s → 4×
- Multiplier display on HUD flashes/pulses when active to reinforce urgency of maintaining the streak
