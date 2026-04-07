# ChaosCurtain — Weapons, Upgrades & Balance

## Controls — Firing

- Right stick (gamepad) or mouse (keyboard+mouse) controls aim direction
- Weapon fires continuously while aim input is held off-center
- Ship rotates to face movement direction independently of aim direction
- Player can strafe relative to their firing direction

---

## Primary Weapon — Dot Shot

Bullets appear as small bright white dots. Linear upgrade path:

| Level | Name | Behavior |
|---|---|---|
| 1 | Single Shot | One dot fired in aim direction |
| 2 | Dual Shot | Dots fired simultaneously forward and backward |
| 3 | Cardinal Shot | Dots fired in all four cardinal directions simultaneously |

- Upgrade path is linear: Single → Dual → Cardinal
- Higher levels are strictly more powerful — no trade-offs within this track

---

## Weapon Power Upgrade

- Increases bullet damage per level
- Independent of shooter type — both tracks can be held simultaneously
- Display: square with bright dot inside × level count (e.g. ⊡ × 3)

---

## Upgrade Pickups

- Appear as flashing deep blue and white circles with interior vector graphic showing upgrade type
- Player collides to collect — no button press required
- Respawn on room entry or periodic timer in cleared rooms

### Pickup Interior Graphics
- Shooter type upgrades: dot(s) with directional lines showing the firing pattern
- Weapon power: dot-in-square icon
- Shield: box-with-X icon
- Panic button: top hat icon

---

## Shield Upgrade

- Display: box-with-X icon × level count (e.g. ⊠ × 3)
- Each shield level reduces the amount of damage that reaches the health pool — reduction scales with level count
- Shield has a charge pool that depletes as damage is absorbed
- When charge is fully exhausted: one shield level is lost, charge replenishes to new level's maximum
- Collecting a new shield upgrade: level increases by one, charge replenishes to new level's full maximum
- A strong shield can reduce damage below the weapon upgrade loss threshold, indirectly protecting weapon upgrades against weaker enemies

---

## Panic Button

- Display: top hat icon × count (e.g. 🎩 × 5)
- Deployed on demand via a dedicated input — not continuous fire
- Instantly deals flat damage to every enemy in the room simultaneously
- Flat damage means proportionally less effective against high-health enemies (bosses)
- **Power scales with current count** — more stored = more damage per use
- On use: count drops by one, power recalculates at new (lower) count
- When count hits zero: power resets to minimum baseline regardless of prior accumulation
- The cost of using a panic button is the reduction in power of all remaining ones — incentivizes hoarding and judicious use

---

## Damage Resolution Flow

On any hit, in order:

1. **Raw damage** determined by enemy/source type and difficulty
2. **Shield reduces** raw damage based on current shield level
3. **Shield charge depletes** by absorbed portion; if charge hits zero → lose one shield level
4. **Reduced damage hits health pool**
5. **Threshold check** — if post-shield damage exceeds a tunable threshold → lose one weapon upgrade at random (weapon power level OR shooter type level, chosen randomly)

### Implications
- Strong shield can protect weapon upgrades against weak enemies by reducing damage below threshold
- Powerful enemy attacks (Blaster bolt, Zapsphere lightning, GlitchBoss lightning) exceed threshold even through a strong shield
- Creates meaningful shield value beyond just health preservation
- Weapon upgrade loss is always random between power and shooter type — player cannot choose which to sacrifice

### At Baseline (no upgrades, no shield)
- Full raw damage hits health pool
- No threshold check — weapon upgrade loss only triggers when upgrades exist

---

## Balance Notes

Game balance requires careful playtesting and iteration. Key considerations:

**Known sensitive areas:**
- **Weapon upgrade loss threshold** — too sensitive and players constantly lose upgrades; too forgiving and upgrades feel permanent
- **Shield damage reduction curve** — scaling per level must feel meaningful without making the player invincible at high levels
- **Panic button power curve** — accumulation incentive must feel worth the self-imposed pressure not to use them
- **Worm cascade** — rapid fire weapons can instantly split worms into 4; may feel unfair if room density is high
- **Co-op vs single player** — two players drawing from one health pool changes damage math significantly

**Structural aids for balancing:**
- Seeded PRNG means any problematic scenario is exactly reproducible for targeted testing
- All damage values, thresholds, speeds, and timings should be named constants — never magic numbers
- A debug mode showing room difficulty, enemy health, and damage values in real time is essential during development
- Tunable maze parameters (enemy density, spawner count, pickup density) are the primary per-room balancing levers
