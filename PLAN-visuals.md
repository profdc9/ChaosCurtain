# ChaosCurtain — Visual Feedback Systems

## Hit Feedback — Scale Pulse

Applies to: players, enemies, spawner machines

- On hit, the object scales up then returns to normal size
- Duration maps to damage magnitude:
  - Light hit: ~0.3 seconds (fast pulse)
  - Major hit: ~2.0 seconds (slow swell and recession)
- Scale rate also maps to damage — light hits pulse quickly, heavy hits swell and recede slowly
- Peak scale: **`DAMAGE.SCALE_PEAK` = 1.3** in `src/constants/index.ts` (used by `HealthComponent` pulse tweens)
- Implemented as a smooth ease-in/ease-out tween on the scale property

---

## Damage Color Shift

Applies to: enemies, spawner machines (not players)

- Objects start with their base color (little to no red component)
- Color interpolates continuously toward red as health depletes:
  - Full health → base color
  - ~50% health → base color mixed with red
  - Near death → predominantly red
- Spawner machines start white and shift toward red (consistent damage language, different starting color)
- Enemy base colors should be chosen with high blue or green components for maximum readability of the red shift
- No health bars needed — color is the health indicator

---

## Destruction Animation — Burning Fragments

Applies to: enemies, spawner machines

- On destruction, constituent geometry (lines, circles, polygons) separates into individual fragments
- Each fragment receives:
  - Random outward velocity
  - Random angular spin
  - Slight deceleration/drag
  - Fade from bright white/yellow → orange → dim red → transparent
  - Duration: ~0.5–1.5 seconds
- Objects must be built as collections of named, separable geometric components
- More complex objects produce more dramatic destruction animations
- The complexity of the destruction reflects the significance of the kill
