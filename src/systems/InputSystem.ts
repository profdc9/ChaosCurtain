import * as ex from 'excalibur';
import { INPUT } from '../constants';
import type { ControlScheme } from '../settings/GameSettings';

export interface InputState {
  move: ex.Vector;
  aim: ex.Vector;
  isFiring: boolean;
  panicPressed: boolean; // edge-triggered: true only on the frame the button is first pressed
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
 * Normalises raw input from a gamepad or mouse + keyboard into
 * { move, aim, isFiring, panicPressed }.
 *
 * Gamepad layout (standard mapping):
 *   Left stick       → movement vector
 *   Right stick      → aim vector + fire when magnitude > GAMEPAD_FIRE_THRESHOLD
 *   Any face button  → panic
 *
 * Mouse + keyboard layout:
 *   WASD / Arrow keys → movement vector
 *   Mouse position    → aim vector
 *   Mouse button held → fire
 *   Space             → panic
 */
export class InputSystem {
  private mouseDown = false;
  private lastMouseScreenPos: ex.Vector = ex.vec(0, 0);
  private readonly pointerDownHandler = () => { this.mouseDown = true; };
  private readonly pointerUpHandler = () => { this.mouseDown = false; };
  private readonly pointerMoveHandler = (evt: ex.PointerEvent) => {
    this.lastMouseScreenPos = ex.vec(evt.screenPos.x, evt.screenPos.y);
  };

  constructor(
    private readonly engine: ex.Engine,
    private readonly scheme: ControlScheme,
  ) {
    engine.input.gamepads.enabled = true;
    if (scheme.kind === 'keyboard_mouse') {
      const p = engine.input.pointers.primary;
      p.on('down', this.pointerDownHandler);
      p.on('up', this.pointerUpHandler);
      p.on('move', this.pointerMoveHandler);
    }
  }

  /** Detach pointer listeners when the owning player is removed (e.g. scene change). */
  dispose(): void {
    if (this.scheme.kind !== 'keyboard_mouse') return;
    const p = this.engine.input.pointers.primary;
    p.off('down', this.pointerDownHandler);
    p.off('up', this.pointerUpHandler);
    p.off('move', this.pointerMoveHandler);
  }

  getState(playerPos: ex.Vector): InputState {
    if (this.scheme.kind === 'gamepad') {
      const gp = this.engine.input.gamepads.at(this.scheme.index);
      if (gp.connected) {
        return this.getGamepadState(gp);
      }
      return {
        move: ex.Vector.Zero,
        aim: ex.Vector.Zero,
        isFiring: false,
        panicPressed: false,
      };
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

    const panicPressed =
      gp.wasButtonPressed(ex.Buttons.Face1) ||
      gp.wasButtonPressed(ex.Buttons.Face2) ||
      gp.wasButtonPressed(ex.Buttons.Face3) ||
      gp.wasButtonPressed(ex.Buttons.Face4);

    return { move: move.size > 0 ? move.normalize() : ex.Vector.Zero, aim, isFiring, panicPressed };
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

    const isFiring   = this.mouseDown && aim.size > 0;
    const panicPressed = kb.wasPressed(ex.Keys.Space);

    return { move, aim, isFiring, panicPressed };
  }
}
