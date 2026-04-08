# ChaosCurtain

A browser-based bullet hell shooter with a vector/wireframe aesthetic, built with [Excalibur.js](https://excaliburjs.com/).

**[Play the live game](https://profdc9.github.io/ChaosCurtain/)**

## About

ChaosCurtain is a twin-stick shooter set in a procedurally generated maze of rooms. Each room must be cleared of enemies before the doors unlock and you can advance. Rooms get progressively harder as you move toward the exit.

All graphics are drawn as glowing vector outlines — no sprites or textures. Enemies explode into burning line-segment fragments on death.

## Enemies

- **Wanderer** — drifts randomly, dangerous in numbers
- **Dart** — guided missile with a turning radius; homes toward the player
- **Wrangler** — deploys a tether that pulls the player toward it; multiple wranglers create compounding pull vectors
- **Satellite** — spirals inward on a collision course; difficult to hit due to angular velocity

## Upgrades

Collect pickups to upgrade your ship between rooms:

- **Shooter type** — adds a rear gun, then a cardinal four-way spread
- **Weapon power** — increases bullet damage
- **Shield** — absorbs a portion of incoming damage
- **Panic button** — emergency area-of-effect damage burst (up to 9 charges)

Taking heavy damage can cost you an upgrade level, so staying alive matters beyond just health.

## Controls

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| Move | WASD / Arrow keys | Left stick |
| Aim & fire | Mouse (hold to fire) | Right stick |
| Panic button | Space | South button |

## Development

```bash
npm install
npm run dev     # local dev server
npm run build   # production build → dist/
```

Built with TypeScript + [Excalibur.js](https://excaliburjs.com/) + Vite.
