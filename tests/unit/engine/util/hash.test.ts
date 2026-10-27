// U12: stable hashing (src/engine/util/hash.ts) — FNV-1a vectors, canonical JSON, the determinism state hash.
import { describe, expect, test } from 'bun:test';
import { canonicalJson, fnv1a32, hashString, hashValue, stateHash } from '@engine/util/hash';
import { fullState, minimalState } from '../types/handmade';

/** Byte-wise FNV-1a over Node's own UTF-8 encoder: an independent reference for the inline encoder. */
function referenceFnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(text, 'utf8')) h = Number((BigInt((h ^ b) >>> 0) * 0x01000193n) & 0xffffffffn);
  return h >>> 0;
}

describe('fnv1a32 / hashString', () => {
  test('published FNV-1a 32-bit vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  test('UTF-8 encoding matches a byte-wise reference (1-, 2-, 3- and 4-byte code points)', () => {
    for (const text of ['aethelgard', 'Æthelgard', 'naïve café', '✦ Fable', 'emoji 🜂🜄', 'mixed ÿ€𐍈z', '\u0000\u007f\u0080߿ࠀ￿']) {
      expect(fnv1a32(text)).toBe(referenceFnv1a(text));
    }
  });

  test('hashString is 8 lowercase hex digits, stable, and pinned', () => {
    expect(hashString('aethelgard')).toBe('7cfad978');
    expect(hashString('')).toBe('811c9dc5');
    expect(hashString('a')).toMatch(/^[0-9a-f]{8}$/);
    expect(hashString('x')).toBe(hashString('x'));
    expect(hashString('loop:1')).not.toBe(hashString('loop:2'));
  });
});

describe('canonicalJson', () => {
  test('sorts object keys at every depth and keeps array order', () => {
    const a = { b: 1, a: { z: [3, 1, 2], y: null }, c: 'x' };
    const b = { c: 'x', a: { y: null, z: [3, 1, 2] }, b: 1 };
    expect(canonicalJson(a)).toBe('{"a":{"y":null,"z":[3,1,2]},"b":1,"c":"x"}');
    expect(canonicalJson(b)).toBe(canonicalJson(a));
  });

  test('round-trips through JSON.parse to an equal value', () => {
    const s = fullState();
    expect(JSON.parse(canonicalJson(s))).toStrictEqual(JSON.parse(JSON.stringify(s)));
  });

  test('omits undefined properties like JSON.stringify, writes -0 as 0, escapes strings', () => {
    expect(canonicalJson({ a: undefined, b: -0, c: 'q"\n', d: true, e: false })).toBe('{"b":0,"c":"q\\"\\n","d":true,"e":false}');
    expect(canonicalJson(Object.assign(Object.create(null) as object, { k: 1 }))).toBe('{"k":1}');
  });

  test('throws a TypeError naming the path for anything JSON cannot carry exactly', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    const cases: [unknown, string][] = [
      [{ list: [1, undefined] }, '$.list[1]'],
      [{ n: Number.NaN }, 'non-finite number at $.n'],
      [{ n: Number.POSITIVE_INFINITY }, 'non-finite number at $.n'],
      [{ f: () => 1 }, 'function at $.f'],
      [{ big: 1n }, 'bigint at $.big'],
      [{ sym: Symbol('s') }, 'symbol at $.sym'],
      [{ when: new Date(0) }, 'non-plain object at $.when'],
      [{ m: new Map() }, 'non-plain object at $.m'],
      [{ s: [new Set()] }, 'non-plain object at $.s[0]'],
      [cyclic, 'cycle at $.self'],
      [undefined, 'undefined at $'],
    ];
    for (const [value, message] of cases) {
      expect(() => canonicalJson(value)).toThrow(TypeError);
      expect(() => canonicalJson(value)).toThrow(message);
    }
  });

  test('shared (non-cyclic) references are fine', () => {
    const shared = { x: 1 };
    expect(canonicalJson({ a: shared, b: [shared, shared] })).toBe('{"a":{"x":1},"b":[{"x":1},{"x":1}]}');
  });
});

describe('hashValue / stateHash', () => {
  test('hashValue ignores key order and sees every value change', () => {
    expect(hashValue({ a: 1, b: [1, 2] })).toBe(hashValue({ b: [1, 2], a: 1 }));
    expect(hashValue({ a: 1, b: [1, 2] })).not.toBe(hashValue({ a: 1, b: [2, 1] }));
  });

  test('equal states hash equal regardless of construction order', () => {
    const a = fullState();
    const b = JSON.parse(canonicalJson(fullState())) as typeof a; // keys re-inserted in sorted order
    expect(Object.keys(b)).not.toEqual(Object.keys(a));
    expect(stateHash(b)).toBe(stateHash(a));
    expect(stateHash(structuredClone(a))).toBe(stateHash(a));
  });

  test('any gameplay change changes the hash', () => {
    const base = stateHash(minimalState());
    const moved = minimalState();
    moved.clock.ticks = 1;
    const rolled = minimalState();
    rolled.rng = [1, 2, 3, 5];
    const flagged = minimalState();
    flagged.flags.flag_x = true;
    expect(new Set([base, stateHash(moved), stateHash(rolled), stateHash(flagged)]).size).toBe(4);
  });

  test('recentLog is excluded (its length is a UI setting)', () => {
    const a = minimalState();
    const b = minimalState();
    b.recentLog = Array.from({ length: 150 }, (_, i) => ({ step: i, text: `line ${i}`, kind: 'narration' as const }));
    expect(stateHash(b)).toBe(stateHash(a));
    expect(hashValue(b)).not.toBe(hashValue(a));
  });
});
