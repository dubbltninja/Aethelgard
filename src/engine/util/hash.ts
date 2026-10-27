// Stable hashing for seeds, ids and determinism checks (PLAN §2 `hash.ts`, §7.4): FNV-1a (32-bit) over the UTF-8
// bytes of a canonical JSON with sorted keys. Same value → same hash in bun and every browser, independent of
// object key insertion order.
import type { GameState } from '../types/state';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit over the UTF-8 encoding of `text` (lone surrogates encode as 3 bytes). Returns a uint32. */
export function fnv1a32(text: string): number {
  let h = FNV_OFFSET;
  const byte = (b: number): void => {
    h = Math.imul(h ^ b, FNV_PRIME);
  };
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
      const lo = text.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) byte(cp);
    else if (cp < 0x800) {
      byte(0xc0 | (cp >> 6));
      byte(0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      byte(0xe0 | (cp >> 12));
      byte(0x80 | ((cp >> 6) & 0x3f));
      byte(0x80 | (cp & 0x3f));
    } else {
      byte(0xf0 | (cp >> 18));
      byte(0x80 | ((cp >> 12) & 0x3f));
      byte(0x80 | ((cp >> 6) & 0x3f));
      byte(0x80 | (cp & 0x3f));
    }
  }
  return h >>> 0;
}

/** `fnv1a32` as 8 lowercase hex digits — the stable string hash used for seeds and ids. */
export function hashString(text: string): string {
  return fnv1a32(text).toString(16).padStart(8, '0');
}

const isPlainObject = (v: object): boolean => {
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * JSON with object keys sorted (UTF-16 code-unit order) and no whitespace. Properties whose value is `undefined`
 * are omitted (as JSON.stringify does); anything JSON cannot represent exactly throws a TypeError naming its path:
 * `undefined` in an array, non-finite numbers, functions, bigints, symbols, non-plain objects (Map, Set, Date,
 * class instances) and cycles.
 */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  const write = (v: unknown, path: string): string => {
    if (v === null) return 'null';
    switch (typeof v) {
      case 'string':
        return JSON.stringify(v);
      case 'boolean':
        return v ? 'true' : 'false';
      case 'number':
        if (!Number.isFinite(v)) throw new TypeError(`canonicalJson: non-finite number at ${path}`);
        return JSON.stringify(v);
      case 'object': {
        if (ancestors.has(v)) throw new TypeError(`canonicalJson: cycle at ${path}`);
        if (!Array.isArray(v) && !isPlainObject(v)) throw new TypeError(`canonicalJson: non-plain object at ${path}`);
        ancestors.add(v);
        let out: string;
        if (Array.isArray(v)) {
          out = `[${v.map((item: unknown, i) => {
            if (item === undefined) throw new TypeError(`canonicalJson: undefined at ${path}[${i}]`);
            return write(item, `${path}[${i}]`);
          }).join(',')}]`;
        } else {
          const record = v as Record<string, unknown>;
          const parts: string[] = [];
          for (const key of Object.keys(record).sort()) {
            const child = record[key];
            if (child !== undefined) parts.push(`${JSON.stringify(key)}:${write(child, `${path}.${key}`)}`);
          }
          out = `{${parts.join(',')}}`;
        }
        ancestors.delete(v);
        return out;
      }
      default:
        throw new TypeError(`canonicalJson: ${typeof v} at ${path}`);
    }
  };
  return write(value, '$');
}

/** Hash of any JSON-shaped value, independent of key order. */
export function hashValue(value: unknown): string {
  return hashString(canonicalJson(value));
}

/**
 * The gameplay hash of a state for determinism checks (`finalStateHash`, PLAN §7.4, §8.1). `recentLog` is excluded:
 * its length follows a UI setting, so two runs that differ only there must hash equal.
 */
export function stateHash(state: GameState): string {
  return hashValue({ ...state, recentLog: [] });
}
