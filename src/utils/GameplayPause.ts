import * as ex from 'excalibur';

/**
 * Soft pause while the in-game pause overlay is open.
 * (Excalibur 0.29 rejects {@link Engine.timescale} &lt;= 0, so we cannot freeze time that way.)
 */
let gameplayPaused = false;

/** Saved on first paused frame per actor; restored on first frame after unpause (then removed). */
const motionStash = new WeakMap<ex.Actor, { vel: ex.Vector; angularVelocity: number }>();

export function setGameplayPaused(value: boolean): void {
  gameplayPaused = value;
}

export function isGameplayPaused(): boolean {
  return gameplayPaused;
}

/**
 * While paused: stash linear + angular velocity once, then zero so physics does not advance the actor.
 * First frame after unpause: restore stashed motion (if any), then return false so logic runs as usual.
 * @returns whether the caller should bail out of the rest of `onPreUpdate`.
 */
export function freezeActorIfGameplayPaused(actor: ex.Actor): boolean {
  if (!isGameplayPaused()) {
    const saved = motionStash.get(actor);
    if (saved) {
      actor.vel = saved.vel.clone();
      actor.angularVelocity = saved.angularVelocity;
      motionStash.delete(actor);
    }
    return false;
  }
  if (!motionStash.has(actor)) {
    motionStash.set(actor, {
      vel: actor.vel.clone(),
      angularVelocity: actor.angularVelocity,
    });
  }
  actor.vel = ex.Vector.Zero;
  actor.angularVelocity = 0;
  return true;
}
