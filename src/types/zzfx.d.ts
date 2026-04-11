declare module 'zzfx' {
  export const ZZFX: {
    volume: number;
    sampleRate: number;
    buildSamples: (...parameters: (number | undefined)[]) => number[];
    play: (...parameters: number[]) => unknown;
  };
  export function zzfx(...parameters: number[]): unknown;
}
