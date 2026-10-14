// The storage port (PLAN §4.12, DESIGN §14.4): the three methods of `Storage` the saves need. The UI hands in
// `window.localStorage` (it fits structurally); tests use `memoryStorage`. The two-phase write and the slot reader
// live here so they are tested once, without a DOM.
import type { ContentPack } from '../ctx';
import { bakKey, tmpKey } from './keys';
import { deserialize, type LoadedRun } from './saveFile';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MemoryStorage extends StoragePort {
  /** Every key currently stored, sorted. */
  keys(): string[];
}

/**
 * An in-memory port. With `quotaChars`, a `setItem` that would push the stored characters (keys and values) over the
 * quota throws a `QuotaExceededError`, like a full localStorage.
 */
export function memoryStorage(initial: Readonly<Record<string, string>> = {}, quotaChars = Infinity): MemoryStorage {
  const data = new Map<string, string>(Object.entries(initial));
  const used = (): number => [...data].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      const without = used() - (data.has(key) ? key.length + (data.get(key) as string).length : 0);
      if (without + key.length + value.length > quotaChars) {
        const err = new Error('The quota has been exceeded.');
        err.name = 'QuotaExceededError';
        throw err;
      }
      data.set(key, value);
    },
    removeItem: (key) => void data.delete(key),
    keys: () => [...data.keys()].sort(),
  };
}

export type WriteResult = { ok: true } | { ok: false; error: string };

/**
 * Two-phase write (DESIGN §14.4): `<key>.tmp` ← text, read it back and check it is JSON, then the previous value of
 * `<key>` moves to `<key>.bak`, `<key>` ← text, `<key>.tmp` is removed. A failure at any step (quota, a write that
 * did not stick) leaves `<key>` as it was and reports the reason.
 */
export function writeTwoPhase(port: StoragePort, key: string, text: string): WriteResult {
  const tmp = tmpKey(key);
  try {
    port.setItem(tmp, text);
    const back = port.getItem(tmp);
    if (back !== text) throw new Error('the written copy did not read back identically');
    const previous = port.getItem(key);
    if (previous !== null) port.setItem(bakKey(key), previous);
    port.setItem(key, text);
    port.removeItem(tmp);
    return { ok: true };
  } catch (e) {
    try {
      port.removeItem(tmp);
    } catch {
      // storage is unusable; the original error is the useful one
    }
    return { ok: false, error: `Could not write ${key}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export type SlotRead =
  | { status: 'empty' }
  | ({ status: 'ok' } & LoadedRun)
  /** `raw` is the stored text (for "export raw text"); `hasBackup` says whether `.bak` validates (for "restore"). */
  | { status: 'corrupted'; error: string; raw: string; hasBackup: boolean };

/** Reads and validates a run slot; a damaged one comes back `corrupted` with what the slot list needs. */
export function readRunSlot(port: StoragePort, key: string, content: ContentPack): SlotRead {
  const raw = port.getItem(key);
  if (raw === null) return { status: 'empty' };
  const result = deserialize(raw, content);
  if (!('error' in result)) return { status: 'ok', ...result };
  const backup = port.getItem(bakKey(key));
  return { status: 'corrupted', error: result.error, raw, hasBackup: backup !== null && !('error' in deserialize(backup, content)) };
}

/** Copies a valid `.bak` over a corrupted `key`; false if there is no valid backup. */
export function restoreBackup(port: StoragePort, key: string, content: ContentPack): boolean {
  const backup = port.getItem(bakKey(key));
  if (backup === null || 'error' in deserialize(backup, content)) return false;
  port.setItem(key, backup);
  return true;
}
