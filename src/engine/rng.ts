// Deterministic RNG (PLAN §4.1): xoshiro128** over four uint32 words kept in GameState.rng, seeded by a cyrb128-style
// string hash. Uses only Math.imul, xor, shifts and float division, so bun and browsers produce identical streams.
// Nothing in src/engine may use Math.random (lint `engine-purity`).
import type { RngState } from './types/state';

/** Four unsigned 32-bit words. Stored in GameState.rng; never all zero. (Declared in types/state.ts.) */
export type { RngState };

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

/**
 * Mutable cursor over an immutable RngState. A reducer creates one from the draft at the start of `step`,
 * draws from it freely, and writes `rng.state()` back at the end. Nothing else may hold an Rng.
 */
export class Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(state: RngState) {
    this.s0 = state[0];
    this.s1 = state[1];
    this.s2 = state[2];
    this.s3 = state[3];
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  static fromSeed(seed: string | number): Rng {
    return new Rng(seedFromString(String(seed)));
  }

  state(): RngState {
    return [this.s0 >>> 0, this.s1 >>> 0, this.s2 >>> 0, this.s3 >>> 0];
  }

  /** Uniform uint32 — the one primitive; everything else derives from it. */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Float in [min, max). One draw. Throws RangeError if the bounds are not finite or max < min. */
  float(min = 0, max = 1): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) throw new RangeError(`float(${min}, ${max})`);
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max], inclusive. One draw. Throws RangeError if max < min or a bound is not an integer. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError(`int(${min}, ${max})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p (clamped to [0,1]). p >= 1 never draws, p <= 0 never draws — keeps traces stable. */
  chance(p: number): boolean {
    return p >= 1 ? true : p <= 0 ? false : this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError('pick([])');
    return arr[this.int(0, arr.length - 1)] as T;
  }

  /** Fisher–Yates on a copy. */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const t = out[i] as T;
      out[i] = out[j] as T;
      out[j] = t;
    }
    return out;
  }

  /** One draw; negative weights count as 0. Throws RangeError if the total weight is not positive. */
  weighted<T>(entries: readonly { weight: number; value: T }[]): T {
    const total = entries.reduce((s, e) => s + Math.max(0, e.weight), 0);
    if (total <= 0) throw new RangeError('weighted(): total weight 0');
    let r = this.next() * total;
    for (const e of entries) {
      r -= Math.max(0, e.weight);
      if (r < 0) return e.value;
    }
    return (entries[entries.length - 1] as { value: T }).value;
  }

  /** Independent stream for a sub-system (e.g., merchant restock) without disturbing the main sequence order. */
  fork(label: string): Rng {
    return new Rng(seedFromString(`${this.nextU32()}:${label}`));
  }
}

/** cyrb128-style string hash → 4 words. Deterministic across platforms (uses only imul/xor/shift). */
export function seedFromString(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const s: [number, number, number, number] = [(h1 ^ h2 ^ h3 ^ h4) >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  if ((s[0] | s[1] | s[2] | s[3]) === 0) s[0] = 0x9e3779b9;
  return s;
}
