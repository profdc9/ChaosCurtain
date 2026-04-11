import { AUDIO } from '../constants';

function dbToLinearGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Shared Web Audio context plus separate music and SFX gain buses.
 * Browser autoplay: call {@link unlock} from the first user gesture.
 */
export class AudioManager {
  private static _ctx: AudioContext | null = null;
  private static _sfxGain: GainNode | null = null;
  private static _musicGain: GainNode | null = null;
  private static _unlocked = false;

  static init(): void {
    if (this._ctx) return;
    this._ctx = new AudioContext();
    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = dbToLinearGain(AUDIO.SFX_VOLUME_DB);
    this._sfxGain.connect(this._ctx.destination);

    this._musicGain = this._ctx.createGain();
    this._musicGain.gain.value = dbToLinearGain(AUDIO.MUSIC_VOLUME_DB);
    this._musicGain.connect(this._ctx.destination);
  }

  static get context(): AudioContext | null {
    return this._ctx;
  }

  /** SFX bus — connect BufferSource or worklet here. */
  static get sfxGainNode(): GainNode | null {
    return this._sfxGain;
  }

  /** Music bus — ZzFXM and other BGM. */
  static get musicGainNode(): GainNode | null {
    return this._musicGain;
  }

  static get isUnlocked(): boolean {
    return this._unlocked;
  }

  static async unlock(): Promise<void> {
    if (!this._ctx) this.init();
    await this._ctx!.resume();
    this._unlocked = true;
  }

  static setSfxVolumeDb(db: number): void {
    if (this._sfxGain) this._sfxGain.gain.value = dbToLinearGain(db);
  }

  static setMusicVolumeDb(db: number): void {
    if (this._musicGain) this._musicGain.gain.value = dbToLinearGain(db);
  }
}
