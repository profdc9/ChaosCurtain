import * as ex from 'excalibur';

export interface InputState {
  move: ex.Vector;
  aim: ex.Vector;
  isFiring: boolean;
}

export class InputSystem {
  private mouseDown = false;
  private lastMouseScreenPos: ex.Vector = ex.vec(0, 0);

  constructor(private readonly engine: ex.Engine) {
    engine.input.pointers.primary.on('down', () => { this.mouseDown = true; });
    engine.input.pointers.primary.on('up', () => { this.mouseDown = false; });
    engine.input.pointers.primary.on('move', (evt) => {
      this.lastMouseScreenPos = ex.vec(evt.screenPos.x, evt.screenPos.y);
    });
  }

  getState(playerPos: ex.Vector): InputState {
    const kb = this.engine.input.keyboard;

    let mx = 0, my = 0;
    if (kb.isHeld(ex.Keys.W) || kb.isHeld(ex.Keys.ArrowUp)) my -= 1;
    if (kb.isHeld(ex.Keys.S) || kb.isHeld(ex.Keys.ArrowDown)) my += 1;
    if (kb.isHeld(ex.Keys.A) || kb.isHeld(ex.Keys.ArrowLeft)) mx -= 1;
    if (kb.isHeld(ex.Keys.D) || kb.isHeld(ex.Keys.ArrowRight)) mx += 1;

    const moveRaw = ex.vec(mx, my);
    const moveMag = Math.sqrt(moveRaw.x * moveRaw.x + moveRaw.y * moveRaw.y);
    const move = moveMag > 0 ? moveRaw.normalize() : ex.Vector.Zero;

    // Convert screen mouse position to world coordinates
    const mouseWorld = this.engine.screen.screenToWorldCoordinates(this.lastMouseScreenPos);
    const aimRaw = mouseWorld.sub(playerPos);
    const aimMag = Math.sqrt(aimRaw.x * aimRaw.x + aimRaw.y * aimRaw.y);
    const aim = aimMag > 1 ? aimRaw.normalize() : ex.Vector.Zero;

    const isFiring = this.mouseDown && aimMag > 0;

    return { move, aim, isFiring };
  }
}
