import * as ex from 'excalibur';
import { FragmentActor, type FragmentBurnFrom } from '../actors/FragmentActor';
import { PLAYER } from '../constants';

function parseHexColorRgb(hex: string): FragmentBurnFrom {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function toWorld(local: ex.Vector, pos: ex.Vector, rot: number): ex.Vector {
  return local.rotate(rot).add(pos);
}

/** Explode the player ship into line fragments (triangle + nacelles) like enemy death. */
export function spawnPlayerDeathFragments(
  scene: ex.Scene,
  pos: ex.Vector,
  rotation: number,
  shipColor: string,
): void {
  const burn = parseHexColorRgb(shipColor);
  const L = PLAYER.SHIP_LENGTH / 2;
  const hw = PLAYER.SHIP_HALF_WIDTH;
  const nr = PLAYER.NACELLE_RADIUS;

  const tip = ex.vec(L, 0);
  const topN = ex.vec(-L, -hw);
  const botN = ex.vec(-L, hw);

  const segments: Array<{ a: ex.Vector; b: ex.Vector }> = [
    { a: tip, b: topN },
    { a: topN, b: botN },
    { a: botN, b: tip },
  ];

  for (const { a, b } of segments) {
    const midLocal = ex.vec((a.x + b.x) / 2, (a.y + b.y) / 2);
    const worldMid = toWorld(midLocal, pos, rotation);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.max(4, Math.sqrt(dx * dx + dy * dy));
    const fragRot = Math.atan2(dy, dx) + rotation;
    const outAngle = Math.atan2(midLocal.y, midLocal.x) + rotation + (Math.random() - 0.5) * 0.4;
    const sp =
      PLAYER.DEATH_FRAGMENT_SPEED_MIN +
      Math.random() * (PLAYER.DEATH_FRAGMENT_SPEED_MAX - PLAYER.DEATH_FRAGMENT_SPEED_MIN);
    const vel = ex.vec(Math.cos(outAngle) * sp, Math.sin(outAngle) * sp);
    const angVel = (Math.random() - 0.5) * 2 * PLAYER.DEATH_FRAGMENT_ANGULAR_VEL_MAX;
    const lifetime =
      PLAYER.DEATH_FRAGMENT_LIFETIME_MIN +
      Math.random() * (PLAYER.DEATH_FRAGMENT_LIFETIME_MAX - PLAYER.DEATH_FRAGMENT_LIFETIME_MIN);
    scene.add(new FragmentActor(worldMid.x, worldMid.y, fragRot, vel, angVel, segLen, lifetime, burn));
  }

  for (const nc of [ex.vec(-L, -hw), ex.vec(-L, hw)]) {
    for (let i = 0; i < 6; i++) {
      const ring = (i / 6) * Math.PI * 2;
      const midLocal = nc.add(ex.vec(Math.cos(ring), Math.sin(ring)).scale(nr * 0.55));
      const worldMid = toWorld(midLocal, pos, rotation);
      const outAngle = Math.atan2(midLocal.y - nc.y, midLocal.x - nc.x) + rotation;
      const sp =
        PLAYER.DEATH_FRAGMENT_SPEED_MIN * 0.55 +
        Math.random() * (PLAYER.DEATH_FRAGMENT_SPEED_MAX - PLAYER.DEATH_FRAGMENT_SPEED_MIN) * 0.4;
      const vel = ex.vec(Math.cos(outAngle) * sp, Math.sin(outAngle) * sp);
      const angVel = (Math.random() - 0.5) * 5;
      const lifetime =
        PLAYER.DEATH_FRAGMENT_LIFETIME_MIN +
        Math.random() * (PLAYER.DEATH_FRAGMENT_LIFETIME_MAX - PLAYER.DEATH_FRAGMENT_LIFETIME_MIN);
      scene.add(
        new FragmentActor(worldMid.x, worldMid.y, outAngle + Math.PI / 2, vel, angVel, nr * 1.6, lifetime, burn),
      );
    }
  }
}
