/**
 * ZzFX + ZzFXM (music renderer) — vendored from ZzFXM v2.0.3 (MIT).
 */

export const ZZFXM_SAMPLE_RATE = 44100;
const zzfxV = 0.3;

export function zzfxG(
  q = 1,
  k = 0.05,
  c = 220,
  e = 0,
  t = 0,
  u = 0.1,
  r = 0,
  F = 1,
  v = 0,
  z = 0,
  w = 0,
  A = 0,
  l = 0,
  B = 0,
  x = 0,
  G = 0,
  d = 0,
  y = 1,
  m = 0,
  C = 0,
): number[] {
  const R = ZZFXM_SAMPLE_RATE;
  const b = 2 * Math.PI;
  const H = (v *= (500 * b) / R ** 2);
  const I = (0 < x ? 1 : -1) * (b / 4);
  let D = (c *= (1 + 2 * k * Math.random() - k) * (b / R));
  const Z: number[] = [];
  let g = 0;
  let E = 0;
  let a = 0;
  let n = 1;
  let J = 0;
  let K = 0;
  let f = 0;
  let p: number;
  e = 99 + R * e;
  m *= R;
  t *= R;
  u *= R;
  d *= R;
  z *= (500 * b) / R ** 3;
  x *= b / R;
  w *= b / R;
  A *= R;
  l = (R * l) | 0;
  const h = (e + m + t + u + d) | 0;
  for (; a < h; Z[a++] = f) {
    if (!(++K % ((100 * G) | 0))) {
      f = r
        ? 1 < r
          ? 2 < r
            ? 3 < r
              ? Math.sin((g % b) ** 3)
              : Math.max(Math.min(Math.tan(g), 1), -1)
            : 1 - (((2 * g) / b) % 2 + 2) % 2
          : 1 - 4 * Math.abs(Math.round(g / b) - g / b)
        : Math.sin(g);
      f =
        (l ? 1 - C + C * Math.sin((2 * Math.PI * a) / l) : 1) *
        (0 < f ? 1 : -1) *
        Math.abs(f) ** F *
        q *
        zzfxV *
        (a < e ? a / e : a < e + m ? 1 - ((a - e) / m) * (1 - y) : a < e + m + t ? y : a < h - d ? ((h - a - d) / u) * y : 0);
      f = d ? f / 2 + (d > a ? 0 : a < h - d ? 1 : ((h - a) / d) * (Z[(a - d) | 0] / 2)) : f;
    }
    p = (c += v += z) * Math.sin(E * x - I);
    g += p - p * B * (1 - (1e9 * (Math.sin(a) + 1)) % 2);
    E += p - p * B * (1 - (1e9 * (Math.sin(a) ** 2 + 1)) % 2);
    if (n && ++n > A) {
      c += w;
      D += w;
      n = 0;
    }
    if (!l || ++J % l) continue;
    c = D;
    v = H;
    n = n || 1;
  }
  return Z;
}

export function zzfxM(
  instruments: number[][],
  patterns: number[][][],
  sequence: number[],
  BPM = 125,
): [number[], number[]] {
  const zzfxR = ZZFXM_SAMPLE_RATE;
  let instrumentParameters: number[];
  let i: number;
  let j: number;
  let k: number;
  let note: number;
  let sample: number;
  let patternChannel: number[];
  let notFirstBeat: number;
  let stop: number;
  let instrument = 0;
  let pitch = 0;
  let attenuation = 0;
  let outSampleOffset = 0;
  let isSequenceEnd: boolean;
  let sampleOffset = 0;
  let nextSampleOffset = 0;
  let sampleBuffer: number[] = [];
  let leftChannelBuffer: number[] = [];
  let rightChannelBuffer: number[] = [];
  let channelIndex = 0;
  let panning = 0;
  let hasMore = 1;
  const sampleCache: Record<string, number[]> = {};
  const beatLength = (zzfxR / BPM) * 60 >> 2;

  for (; hasMore; channelIndex++) {
    sampleBuffer = [hasMore = notFirstBeat = pitch = outSampleOffset = 0];

    sequence.map((patternIndex, sequenceIndex) => {
      patternChannel = patterns[patternIndex][channelIndex] || [0, 0, 0];
      hasMore |= patterns[patternIndex][channelIndex] ? 1 : 0;
      nextSampleOffset =
        outSampleOffset + (patterns[patternIndex][0].length - 2 - (notFirstBeat ? 0 : 1)) * beatLength;
      isSequenceEnd = sequenceIndex == sequence.length - 1;
      for (i = 2, k = outSampleOffset; i < patternChannel.length + (isSequenceEnd ? 1 : 0); notFirstBeat = ++i) {
        note = patternChannel[i] as number;

        stop = Number(
          (i == patternChannel.length + (isSequenceEnd ? 1 : 0) - 1 && isSequenceEnd) ||
            ((instrument != (patternChannel[0] || 0) ? 1 : 0) | note | 0),
        );

        for (j = 0; j < beatLength && notFirstBeat; ) {
          j++ > beatLength - 99 && stop ? (attenuation += (attenuation < 1 ? 1 : 0) / 99) : 0;
          sample = ((1 - attenuation) * sampleBuffer[sampleOffset++]) / 2 || 0;
          leftChannelBuffer[k] = (leftChannelBuffer[k] || 0) - sample * panning + sample;
          rightChannelBuffer[k] = (rightChannelBuffer[k++] || 0) + sample * panning + sample;
        }

        if (note) {
          attenuation = note % 1;
          panning = patternChannel[1] || 0;
          if ((note |= 0)) {
            instrument = patternChannel[(sampleOffset = 0)] || 0;
            const key = `${instrument},${note}`;
            sampleBuffer =
              sampleCache[key] ||
              (() => {
                instrumentParameters = [...instruments[instrument]];
                instrumentParameters[2] *= 2 ** ((note - 12) / 12);
                const buf = note > 0 ? zzfxG(...(instrumentParameters as unknown[] as Parameters<typeof zzfxG>)) : [];
                sampleCache[key] = buf;
                return buf;
              })();
          }
        }
      }
      outSampleOffset = nextSampleOffset;
    });
  }

  return [leftChannelBuffer, rightChannelBuffer];
}

export function densifyStereo(left: number[], right: number[]): [Float32Array, Float32Array] {
  const len = Math.max(left.length, right.length);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    L[i] = left[i] ?? 0;
    R[i] = right[i] ?? 0;
  }
  return [L, R];
}
