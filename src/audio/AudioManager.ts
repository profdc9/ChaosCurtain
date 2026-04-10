import * as Tone from 'tone';
import { AUDIO } from '../constants';

/**
 * Initialises the Tone.js audio context and owns the two master volume nodes
 * (music chain and SFX chain). Must be initialised before MusicSystem or
 * SfxSystem are constructed.
 *
 * Browser autoplay policy requires a user gesture before audio can start.
 * Call AudioManager.unlock() from the first keydown/pointerdown handler.
 */
export class AudioManager {
  private static _musicVol: Tone.Volume;
  private static _sfxVol:   Tone.Volume;
  private static _unlocked = false;

  static init(): void {
    this._musicVol = new Tone.Volume(AUDIO.MUSIC_VOLUME_DB).toDestination();
    this._sfxVol   = new Tone.Volume(AUDIO.SFX_VOLUME_DB).toDestination();
  }

  static get musicVol(): Tone.Volume { return this._musicVol; }
  static get sfxVol():   Tone.Volume { return this._sfxVol;   }
  static get isUnlocked(): boolean   { return this._unlocked; }

  /** Must be called from a user-gesture handler (keydown, pointerdown). */
  static async unlock(): Promise<void> {
    if (this._unlocked) return;
    await Tone.start();
    this._unlocked = true;
  }

  static setMusicVolume(db: number): void {
    this._musicVol.volume.value = db;
  }

  static setSfxVolume(db: number): void {
    this._sfxVol.volume.value = db;
  }
}
