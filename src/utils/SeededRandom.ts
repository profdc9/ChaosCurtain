/**
 * Mulberry32 — fast, high-quality 32-bit seeded PRNG.
 * All maze generation uses this so any seed fully reproduces a run.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 0x100000000;
  }

  /** Returns an integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Returns true with the given probability (0–1). */
  nextBool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /** Returns a random element from an array. */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Shuffles an array in place using Fisher-Yates. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
