import DebugConfig from '../constants/DebugConfig';
import { AudioManager } from './AudioManager';
import { ZzfxSoundBank } from './ZzfxSoundBank';
import { ZzfxSfxSystem } from './ZzfxSfxSystem';
import { startTrackerPlaylist } from './roomTrackerMusic';

let prepared = false;

/**
 * Run once after a keyboard/mouse gesture on the main menu: unlock Web Audio,
 * bake ZzFX samples, wire SFX subscribers, start BGM. Idempotent.
 */
export async function prepareGameAudioFromUserGesture(): Promise<void> {
  if (prepared) return;
  AudioManager.init();
  await AudioManager.unlock();
  ZzfxSoundBank.buildAll();
  if (DebugConfig.enableSfx !== false) {
    new ZzfxSfxSystem();
  }
  if (DebugConfig.enableMusic !== false) {
    queueMicrotask(() => {
      startTrackerPlaylist();
    });
  }
  prepared = true;
}

export function isGameAudioPrepared(): boolean {
  return prepared;
}
