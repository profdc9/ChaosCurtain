import * as ex from 'excalibur';
import { INPUT } from '../constants';

export interface InputState {
  move: ex.Vector;
  aim: ex.Vector;
  isFiring: boolean;
}

/**
 * Applies a radial deadzone to a raw stick vector and rescales the live range
 * to [0, 1] so there is no dead-band artifact at the threshold edge.
 */
function applyDeadzone(x: number, y: number): ex.Vector {
  const dz = INPUT.GAMEPAD_DEADZONE;
  const mag = Math.sqrt(x * x + y * y);
  if (mag < dz) return ex.Vector.Zero;
  const scale = (mag - dz) / (1 - dz);
  return ex.vec((x / mag) * scale, (y / mag) * scale);
}

/**
 * Normalises raw input from either a gamepad (preferred when connected) or
 * mouse + keyboard into a device-agnostic { move, aim, isFiring } state.
 *
 * Gamepad layout (standard mapping):
 *   Left stick  → movement vector
 *   Right stick → aim vector + fire when magnitude > GAMEPAD_FIRE_THRESHOLD
 *
 * Mouse + keyboard layout:
 *   WASD / Arrow keys → movement vector
 *   Mouse position    → aim vector
 *   Mouse button held → fire
 */
export class InputSystem {
  private mouseDown = false;
  private lastMouseScreenPos: ex.Vector = ex.vec(0, 0);

  constructor(private readonly engine: ex.Engine) {
    engine.input.gamepads.enabled = true;

    engine.input.pointers.primary.on('down', () => { this.mouseDown = true; });
    engine.input.pointers.primary.on('up',   () => { this.mouseDown = false; });
    engine.input.pointers.primary.on('move', (evt) => {
      this.lastMouseScreenPos = ex.vec(evt.screenPos.x, evt.screenPos.y);
    });
  }

  getState(playerPos: ex.Vector): InputState {
    const gp = this.engine.input.gamepads.at(0);
    if (gp.connected) {
      return this.getGamepadState(gp);
    }
    return this.getMouseKeyboardState(playerPos);
  }

  // ── Gamepad ──────────────────────────────────────────────────────────────────

  private getGamepadState(gp: ex.Gamepad): InputState {
    const move = applyDeadzone(
      gp.getAxes(ex.Axes.LeftStickX),
      gp.getAxes(ex.Axes.LeftStickY),
    );

    const aimRaw = applyDeadzone(
      gp.getAxes(ex.Axes.RightStickX),
      gp.getAxes(ex.Axes.RightStickY),
    );

    const aimMag = Math.sqrt(aimRaw.x * aimRaw.x + aimRaw.y * aimRaw.y);
    const aim      = aimMag > 0 ? aimRaw.normalize() : ex.Vector.Zero;
    const isFiring = aimMag >= INPUT.GAMEPAD_FIRE_THRESHOLD;

    return { move: move.size > 0 ? move.normalize() : ex.Vector.Zero, aim, isFiring };
  }

  // ── Mouse + Keyboard ─────────────────────────────────────────────────────────

  private getMouseKeyboardState(playerPos: ex.Vector): InputState {
    const kb = this.engine.input.keyboard;

    let mx = 0, my = 0;
    if (kb.isHeld(ex.Keys.W) || kb.isHeld(ex.Keys.ArrowUp))    my -= 1;
    if (kb.isHeld(ex.Keys.S) || kb.isHeld(ex.Keys.ArrowDown))  my += 1;
    if (kb.isHeld(ex.Keys.A) || kb.isHeld(ex.Keys.ArrowLeft))  mx -= 1;
    if (kb.isHeld(ex.Keys.D) || kb.isHeld(ex.Keys.ArrowRight)) mx += 1;

    const moveRaw = ex.vec(mx, my);
    const move    = moveRaw.size > 0 ? moveRaw.normalize() : ex.Vector.Zero;

    const mouseWorld = this.engine.screen.screenToWorldCoordinates(this.lastMouseScreenPos);
    const aimRaw     = mouseWorld.sub(playerPos);
    const aim        = aimRaw.size > 1 ? aimRaw.normalize() : ex.Vector.Zero;

    const isFiring = this.mouseDown && aim.size > 0;

    return { move, aim, isFiring };
  }
}
