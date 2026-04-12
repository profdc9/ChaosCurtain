import { AudioManager } from './AudioManager';
import { densifyStereo, zzfxM, ZZFXM_SAMPLE_RATE } from './zzfxmRender';

let cachedBuffer: AudioBuffer | null = null;
let cachedSourceKey = '';
let currentSource: AudioBufferSourceNode | null = null;
let pendingOnEnded: (() => void) | null = null;

function parseZzfxmSong(song: unknown): {
  instruments: number[][];
  patterns: number[][][];
  sequence: number[];
  bpm: number;
} {
  const s = song as unknown[];
  if (!Array.isArray(s) || s.length < 3) {
    throw new Error('ZzfxmMusicPlayer: invalid song (expected array with instruments, patterns, sequence)');
  }
  const rawBpm = s[3];
  const bpm = typeof rawBpm === 'number' && Number.isFinite(rawBpm) ? rawBpm : 125;
  return {
    instruments: s[0] as number[][],
    patterns: s[1] as number[][][],
    sequence: s[2] as number[],
    bpm,
  };
}

function buildAudioBuffer(ctx: AudioContext, song: unknown): AudioBuffer {
  const { instruments, patterns, sequence, bpm } = parseZzfxmSong(song);
  const [L, R] = densifyStereo(...zzfxM(instruments, patterns, sequence, bpm));
  const len = L.length;
  const buf = ctx.createBuffer(2, len, ZZFXM_SAMPLE_RATE);
  buf.getChannelData(0).set(L);
  buf.getChannelData(1).set(R);
  return buf;
}

export type ZzfxmMusicStartOptions = {
  /** Stable id for buffer cache; omit only for legacy callers. */
  bufferCacheKey?: string;
  /** When false, buffer plays once and `onEnded` runs (Web Audio `onended`). Default true. */
  loop?: boolean;
  /** Fired after a non-looping buffer finishes naturally (not when {@link stop} is used). */
  onEnded?: () => void;
};

/**
 * ZzFXM → AudioBuffer, then BufferSource on {@link AudioManager.musicGainNode}
 * (after {@link AudioManager.unlock}). Supports looping BGM or one-shot + callback.
 */
export const ZzfxmMusicPlayer = {
  start(song: unknown, options?: string | ZzfxmMusicStartOptions): void {
    const ctx = AudioManager.context;
    const gain = AudioManager.musicGainNode;
    if (!ctx || !gain || !AudioManager.isUnlocked) return;

    const opt: ZzfxmMusicStartOptions =
      typeof options === 'string' ? { bufferCacheKey: options } : (options ?? {});

    this.stop();

    const s = song as unknown[];
    const key =
      opt.bufferCacheKey ??
      (Array.isArray(s) && s.length >= 3
        ? `legacy:${(s[0] as unknown[])?.length}|${(s[1] as unknown[])?.length}|${JSON.stringify(s[2])}|${String(s[3])}`
        : 'legacy:invalid');
    if (!cachedBuffer || cachedSourceKey !== key) {
      cachedBuffer = buildAudioBuffer(ctx, song);
      cachedSourceKey = key;
    }

    const loop = opt.loop !== false;
    pendingOnEnded = !loop && opt.onEnded ? opt.onEnded : null;

    const src = ctx.createBufferSource();
    src.buffer = cachedBuffer;
    src.loop = loop;
    src.connect(gain);

    if (!loop && pendingOnEnded) {
      const handler = pendingOnEnded;
      src.onended = () => {
        if (currentSource !== src) return;
        currentSource = null;
        pendingOnEnded = null;
        handler();
      };
    } else {
      src.onended = null;
    }

    src.start(0);
    currentSource = src;
  },

  stop(): void {
    pendingOnEnded = null;
    if (currentSource) {
      try {
        currentSource.onended = null;
        currentSource.stop();
        currentSource.disconnect();
      } catch {
        /* already stopped */
      }
      currentSource = null;
    }
  },
};
