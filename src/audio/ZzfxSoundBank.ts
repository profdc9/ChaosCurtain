import { ZZFX } from 'zzfx';
import { SFX_PRESETS, type SfxPresetId } from './zzfxPresets';

/** Must match ZzFX internal rate used when baking. */
export const ZZFX_BAKE_SAMPLE_RATE = ZZFX.sampleRate;

const bank = new Map<SfxPresetId, Float32Array>();

export const ZzfxSoundBank = {
  /** Bake all presets once (deterministic: randomness 0 in presets). */
  buildAll(): void {
    bank.clear();
    const savedVol = ZZFX.volume;
    ZZFX.volume = 1;
    try {
      for (const id of Object.keys(SFX_PRESETS) as SfxPresetId[]) {
        const params = SFX_PRESETS[id];
        const args = [...params] as unknown[] as Parameters<typeof ZZFX.buildSamples>;
        const raw = ZZFX.buildSamples(...args);
        bank.set(id, Float32Array.from(raw));
      }
    } finally {
      ZZFX.volume = savedVol;
    }
  },

  get(id: SfxPresetId): Float32Array | undefined {
    return bank.get(id);
  },
};
