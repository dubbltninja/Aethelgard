// U12: xoshiro128** Rng and seedFromString (PLAN §4.1, §8.1 RNG row). The golden vectors below were recorded once
// from this implementation and are cross-checked against an independent reference written inline (Uint32Array,
// transcribed from the C reference at prng.di.unimi.it/xoshiro128starstar.c).
import { describe, expect, test } from 'bun:test';
import { GameStateSchema, Rng, seedFromString, type RngState } from '@engine/index';
import { minimalState } from './types/handmade';

/** Independent xoshiro128** reference: C's uint32_t arithmetic via a Uint32Array. */
function referenceXoshiro128ss(seed: readonly [number, number, number, number], count: number): number[] {
  const s = Uint32Array.from(seed); // element writes wrap mod 2^32, like C's uint32_t
  const g = (i: number): number => s[i] as number;
  const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;
  const mul = (a: number, b: bigint): number => Number((BigInt(a) * b) & 0xffffffffn);
  const out: number[] = [];
  for (let n = 0; n < count; n++) {
    out.push(mul(rotl(mul(g(1), 5n), 7), 9n));
    const t = (g(1) << 9) >>> 0;
    s[2] = g(2) ^ g(0);
    s[3] = g(3) ^ g(1);
    s[1] = g(1) ^ g(2);
    s[0] = g(0) ^ g(3);
    s[2] = g(2) ^ t;
    s[3] = rotl(g(3), 11);
  }
  return out;
}

const draws = <T>(n: number, f: () => T): T[] => Array.from({ length: n }, f);

/** First ten outputs for state [1, 2, 3, 4]; equal to the published xoshiro128** reference vector. */
const GOLDEN_1234 = [11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597, 4258142804];
const GOLDEN_SEED_AETHELGARD: RngState = [3140948500, 2038920751, 649491487, 3454216975];
const GOLDEN_AETHELGARD = [
  1742938919, 2288725002, 4111458572, 154814580, 172006788, 2429690727, 1451913122, 1282243963, 3589205062, 2265333286,
];

describe('Rng — golden vectors', () => {
  test('new Rng([1,2,3,4]) first output is 0x2D00 and the first ten match the reference vector', () => {
    const rng = new Rng([1, 2, 3, 4]);
    const got = draws(10, () => rng.nextU32());
    expect(got[0]).toBe(0x2d00);
    expect(got).toEqual(GOLDEN_1234);
  });

  test('inline reference implementation agrees (seeded [1,2,3,4] and from "aethelgard", 1000 outputs)', () => {
    expect(referenceXoshiro128ss([1, 2, 3, 4], 10)).toEqual(GOLDEN_1234);
    for (const seed of [[1, 2, 3, 4], seedFromString('aethelgard'), [0xffffffff, 0x80000000, 0x7fffffff, 1]] as const) {
      const rng = new Rng(seed);
      expect(draws(1000, () => rng.nextU32())).toEqual(referenceXoshiro128ss(seed, 1000));
    }
  });

  test('seedFromString("aethelgard") and its stream are pinned', () => {
    expect(seedFromString('aethelgard')).toEqual(GOLDEN_SEED_AETHELGARD);
    const rng = Rng.fromSeed('aethelgard');
    expect(rng.state()).toEqual(GOLDEN_SEED_AETHELGARD);
    expect(draws(10, () => rng.nextU32())).toEqual(GOLDEN_AETHELGARD);
  });
});

describe('seedFromString', () => {
  test('is stable, pinned for a few inputs, and returns four uint32 words', () => {
    expect(seedFromString('')).toEqual([41608494, 3451745039, 1474919459, 1228645970]);
    expect(seedFromString('42')).toEqual([2814168319, 2808028881, 2588294151, 2683158596]);
    expect(seedFromString('Æthelgard ✦')).toEqual([3809141876, 1825775236, 143881757, 1645851487]);
    for (const seed of ['', 'a', 'aethelgard', 'run:2', 'Æthelgard ✦']) {
      const s = seedFromString(seed);
      expect(seedFromString(seed)).toEqual(s);
      expect(s).toHaveLength(4);
      for (const w of s) expect(Number.isInteger(w) && w >= 0 && w <= 0xffffffff).toBe(true);
      expect(s.some((w) => w !== 0)).toBe(true);
    }
  });

  test('distinct inputs give distinct states', () => {
    const seeds = Array.from({ length: 200 }, (_, i) => JSON.stringify(seedFromString(`seed-${i}`)));
    expect(new Set(seeds).size).toBe(200);
  });

  test('fromSeed(number) equals fromSeed(String(number))', () => {
    expect(Rng.fromSeed(42).state()).toEqual(Rng.fromSeed('42').state());
  });
});

describe('Rng — state', () => {
  test('an all-zero state is repaired (xoshiro would emit zeros forever)', () => {
    const rng = new Rng([0, 0, 0, 0]);
    expect(rng.state()).toEqual([1, 0, 0, 0]);
    expect(draws(8, () => rng.nextU32()).some((x) => x !== 0)).toBe(true);
  });

  test('state() is a fresh uint32 tuple and does not advance the stream', () => {
    const rng = Rng.fromSeed('state');
    for (let i = 0; i < 50; i++) rng.nextU32();
    const a = rng.state();
    const b = rng.state();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    for (const w of a) expect(Number.isInteger(w) && w >= 0 && w <= 0xffffffff).toBe(true);
  });

  test('a JSON round-trip of the state mid-stream reproduces the continuation', () => {
    const rng = Rng.fromSeed('mid-stream');
    for (let i = 0; i < 37; i++) rng.next();
    const saved = JSON.parse(JSON.stringify(rng.state())) as RngState;
    const expected = draws(100, () => rng.nextU32());
    const resumed = new Rng(saved);
    expect(draws(100, () => resumed.nextU32())).toEqual(expected);
  });

  test('the same holds through GameState.rng and GameStateSchema (the save path)', () => {
    const rng = Rng.fromSeed('save-path');
    rng.int(1, 6);
    rng.shuffle([1, 2, 3, 4, 5]);
    const s = { ...minimalState(), rng: rng.state() };
    const loaded = GameStateSchema.parse(JSON.parse(JSON.stringify(s)));
    const expected = draws(20, () => rng.next());
    const resumed = new Rng(loaded.rng);
    expect(draws(20, () => resumed.next())).toEqual(expected);
  });
});

describe('Rng — derived draws', () => {
  test('next() is in [0, 1)', () => {
    const rng = Rng.fromSeed('next');
    for (const x of draws(10_000, () => rng.next())) {
      expect(x >= 0 && x < 1).toBe(true);
    }
  });

  test('int(min, max) is inclusive and in bounds over 10k draws', () => {
    const rng = Rng.fromSeed('int');
    const seen = new Map<number, number>();
    for (const x of draws(10_000, () => rng.int(-3, 3))) {
      expect(Number.isInteger(x) && x >= -3 && x <= 3).toBe(true);
      seen.set(x, (seen.get(x) ?? 0) + 1);
    }
    expect([...seen.keys()].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    for (const count of seen.values()) expect(count).toBeGreaterThan(10_000 / 7 / 2);
    expect(rng.int(5, 5)).toBe(5);
  });

  test('int rejects reversed or fractional bounds', () => {
    const rng = Rng.fromSeed('int-bad');
    expect(() => rng.int(3, 2)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
    expect(() => rng.int(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  test('float(min, max) is in [min, max) over 10k draws and defaults to [0, 1)', () => {
    const rng = Rng.fromSeed('float');
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const x of draws(10_000, () => rng.float(2, 5))) {
      expect(x >= 2 && x < 5).toBe(true);
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    expect(lo).toBeLessThan(2.01);
    expect(hi).toBeGreaterThan(4.99);
    const d = rng.float();
    expect(d >= 0 && d < 1).toBe(true);
    expect(rng.float(7, 7)).toBe(7);
    expect(() => rng.float(1, 0)).toThrow(RangeError);
    expect(() => rng.float(0, Number.NaN)).toThrow(RangeError);
  });

  test('chance(0) and chance(1) never draw (and neither do out-of-range p)', () => {
    const rng = Rng.fromSeed('chance');
    const before = rng.state();
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(-0.5)).toBe(false);
    expect(rng.chance(1)).toBe(true);
    expect(rng.chance(3)).toBe(true);
    expect(rng.state()).toEqual(before);
    rng.chance(0.5);
    expect(rng.state()).not.toEqual(before);
  });

  test('chance(p) hits about p of the time', () => {
    const rng = Rng.fromSeed('chance-rate');
    const hits = draws(10_000, () => rng.chance(0.3)).filter(Boolean).length;
    expect(hits).toBeGreaterThan(2800);
    expect(hits).toBeLessThan(3200);
  });

  test('pick returns members and throws on an empty array', () => {
    const rng = Rng.fromSeed('pick');
    const arr = ['a', 'b', 'c'] as const;
    const got = new Set(draws(300, () => rng.pick(arr)));
    expect([...got].sort()).toEqual(['a', 'b', 'c']);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  test('shuffle returns a permutation of a copy', () => {
    const rng = Rng.fromSeed('shuffle');
    const input = Object.freeze(Array.from({ length: 20 }, (_, i) => i));
    let moved = 0;
    for (let n = 0; n < 50; n++) {
      const out = rng.shuffle(input);
      expect(out).not.toBe(input);
      expect([...out].sort((a, b) => a - b)).toEqual([...input]);
      if (out.some((v, i) => v !== i)) moved++;
    }
    expect(moved).toBe(50);
    expect(rng.shuffle([])).toEqual([]);
    expect(rng.shuffle(['only'])).toEqual(['only']);
  });

  test('weighted follows the weights, never picks zero/negative weights, and rejects an empty total', () => {
    const rng = Rng.fromSeed('weighted');
    const entries = [
      { weight: 1, value: 'rare' },
      { weight: 0, value: 'never' },
      { weight: -5, value: 'negative' },
      { weight: 3, value: 'common' },
    ];
    const counts: Record<string, number> = {};
    for (const v of draws(10_000, () => rng.weighted(entries))) counts[v] = (counts[v] ?? 0) + 1;
    expect(counts.never).toBeUndefined();
    expect(counts.negative).toBeUndefined();
    expect(counts.rare! + counts.common!).toBe(10_000);
    expect(counts.common! / 10_000).toBeCloseTo(0.75, 1);
    expect(rng.weighted([{ weight: 2, value: 'solo' }])).toBe('solo');
    expect(() => rng.weighted([])).toThrow(RangeError);
    expect(() => rng.weighted([{ weight: 0, value: 'x' }])).toThrow(RangeError);
  });

  test('fork gives an independent, reproducible stream and advances the parent by one draw', () => {
    const parent = Rng.fromSeed('fork');
    const twin = new Rng(parent.state());
    const a = parent.fork('merchant');
    twin.nextU32();
    expect(parent.state()).toEqual(twin.state());

    const again = Rng.fromSeed('fork').fork('merchant');
    const streamA = draws(10, () => a.nextU32());
    expect(draws(10, () => again.nextU32())).toEqual(streamA);

    const b = Rng.fromSeed('fork').fork('weather');
    expect(draws(10, () => b.nextU32())).not.toEqual(streamA);
    expect(draws(10, () => parent.nextU32())).not.toEqual(streamA);
  });
});
