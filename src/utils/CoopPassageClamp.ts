/**
 * While both ships must pass through an exit doorway, their centers may sit slightly
 * outside {@link ROOM} inner bounds. Player post-clamp must not pull them back in.
 */
let bypassInnerWallClamp = false;

export function setCoopPassageWallClampBypass(active: boolean): void {
  bypassInnerWallClamp = active;
}

export function isCoopPassageWallClampBypassed(): boolean {
  return bypassInnerWallClamp;
}
