// Storage keys (PLAN §4.12, DESIGN §14.1/§14.4): pure string builders. The localStorage adapter is UI-side; this file
// only fixes the names so the engine, the shell and the tests agree on them.
import type { SaveSlot } from '../types/actions';

/** Namespace of every key the game writes. */
export const KEY_PREFIX = 'aethelgard.';
export const RUN_KEY_PREFIX = `${KEY_PREFIX}run.`;

/** Every run slot, in display order: three manual slots, then the autosave. */
export const SAVE_SLOTS: readonly SaveSlot[] = [1, 2, 3, 'auto'];
/** The slots a player writes by hand. */
export const MANUAL_SLOTS: readonly (1 | 2 | 3)[] = [1, 2, 3];

export const PROFILE_KEY = `${KEY_PREFIX}profile`;
/** Settings duplicated outside the profile so a corrupt profile still restores accessibility settings (PLAN §4.12). */
export const SETTINGS_MIRROR_KEY = `${KEY_PREFIX}settings.mirror`;

export function isSaveSlot(value: unknown): value is SaveSlot {
  return value === 1 || value === 2 || value === 3 || value === 'auto';
}

/** `aethelgard.run.slot1|slot2|slot3|auto`. */
export function slotKey(slot: SaveSlot): string {
  return slot === 'auto' ? `${RUN_KEY_PREFIX}auto` : `${RUN_KEY_PREFIX}slot${slot}`;
}

/** The slot a run key belongs to, or null for any other key (including `.tmp` / `.bak` siblings). */
export function slotOfKey(key: string): SaveSlot | null {
  return SAVE_SLOTS.find((slot) => slotKey(slot) === key) ?? null;
}

/** Phase-one write target of the two-phase write (DESIGN §14.4). */
export const tmpKey = (key: string): string => `${key}.tmp`;
/** The previous value of `key`, kept by the two-phase write. */
export const bakKey = (key: string): string => `${key}.bak`;

/** Every key that belongs to a slot: the value, its `.tmp` and its `.bak`. */
export const slotKeys = (slot: SaveSlot): string[] => [slotKey(slot), tmpKey(slotKey(slot)), bakKey(slotKey(slot))];

/**
 * `aethelgard-<kind>-<slot>-<yyyymmdd-hhmm>.json` (DESIGN §14.3), the stamp read from an ISO-8601 `savedAt`
 * (`2026-10-09T12:00:00Z` → `20261009-1200`). The engine never reads a clock, so the caller passes the stamp.
 * A `savedAt` that is not ISO-shaped yields `unknown-time`. Pass `null` for the profile (it has no slot).
 */
export function exportFileName(kind: 'run' | 'profile', slot: SaveSlot | null, savedAt: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(savedAt);
  const stamp = m ? `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}` : 'unknown-time';
  const which = slot === null ? '' : slot === 'auto' ? '-auto' : `-slot${slot}`;
  return `aethelgard-${kind}${which}-${stamp}.json`;
}
