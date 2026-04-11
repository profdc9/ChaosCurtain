import { AudioManager } from './AudioManager';
import { densifyStereo, zzfxM, ZZFXM_SAMPLE_RATE } from './zzfxmRender';

let cachedBuffer: AudioBuffer | null = null;
let cachedSourceKey = '';
let currentSource: AudioBufferSourceNode | null = null;

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

/**
 * ZzFXM → AudioBuffer, then looping BufferSource on {@link AudioManager.musicGainNode}
 * (after {@link AudioManager.unlock}).
 */
export const ZzfxmMusicPlayer = {
  start(song: unknown): void {
    const ctx = AudioManager.context;
    const gain = AudioManager.musicGainNode;
    if (!ctx || !gain || !AudioManager.isUnlocked) return;

    this.stop();

    const key = JSON.stringify((song as unknown[])[2]);
    if (!cachedBuffer || cachedSourceKey !== key) {
      cachedBuffer = buildAudioBuffer(ctx, song);
      cachedSourceKey = key;
    }

    const src = ctx.createBufferSource();
    src.buffer = cachedBuffer;
    src.loop = true;
    src.connect(gain);
    src.start(0);
    currentSource = src;
  },

  stop(): void {
    if (currentSource) {
      try {
        currentSource.stop();
        currentSource.disconnect();
      } catch {
        /* already stopped */
      }
      currentSource = null;
    }
  },
};
