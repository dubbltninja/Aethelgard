// The localStorage side of saves (PLAN §4.12, DESIGN §14): the browser storage port, and reading/writing the profile
// and the settings mirror through the engine's file code (`deserializeProfile`, `writeTwoPhase`, …). Nothing here
// throws: a blocked or full storage turns into `null` / `{ ok: false, error }` and the game keeps running in memory.
// U69 adds the slot panel's corrupted-slot actions and the profile merge-on-import (DESIGN §14.3–14.4) on top.
import {
  PROFILE_KEY,
  SETTINGS_MIRROR_KEY,
  bakKey,
  deserializeProfile,
  parseSettingsMirror,
  serializeProfile,
  serializeSettingsMirror,
  writeTwoPhase,
  type Profile,
  type Settings,
  type StoragePort,
  type WriteResult,
} from '@engine/index';
import { freshProfile, newProfileId } from './profile';

const PROBE_KEY = 'aethelgard.probe';

/**
 * Wraps a port so reads and removals never throw (a read that throws counts as empty). Writes still throw, so
 * `writeTwoPhase` can report a full or blocked storage with its reason.
 */
export function safePort(port: StoragePort): StoragePort {
  return {
    getItem(key) {
      try {
        return port.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => port.setItem(key, value),
    removeItem(key) {
      try {
        port.removeItem(key);
      } catch {
        // nothing to do: the key stays, the next write retries
      }
    },
  };
}

/**
 * The page's localStorage as a safe port, or null where it cannot be used at all (blocked cookies, some private
 * windows, a sandboxed frame): reaching `window.localStorage` itself can throw there.
 */
export function browserStorage(win: { localStorage?: StoragePort } | undefined = globalThis as { localStorage?: StoragePort }): StoragePort | null {
  try {
    const ls = win?.localStorage;
    if (!ls) return null;
    ls.setItem(PROBE_KEY, '1');
    ls.removeItem(PROBE_KEY);
    return safePort(ls);
  } catch {
    return null;
  }
}

export interface LoadedProfile {
  profile: Profile;
  /** Set when the stored profile was missing a piece or unreadable, in words for a notice. */
  problem: string | null;
  /** True when no profile was stored before (a first visit). */
  fresh: boolean;
}

/**
 * The stored profile; else its `.bak` (DESIGN §14.4); else a fresh profile that keeps the mirrored settings, so a
 * corrupt profile still restores the player's accessibility settings (PLAN §4.12).
 */
export function loadProfile(port: StoragePort | null, makeId: () => string = newProfileId): LoadedProfile {
  if (port === null) return { profile: freshProfile(makeId()), problem: null, fresh: true };
  const text = port.getItem(PROFILE_KEY);
  if (text !== null) {
    const main = deserializeProfile(text);
    if (!('error' in main)) return { profile: main.profile, problem: null, fresh: false };
    const backupText = port.getItem(bakKey(PROFILE_KEY));
    const backup = backupText === null ? null : deserializeProfile(backupText);
    if (backup !== null && !('error' in backup)) {
      return { profile: backup.profile, problem: 'Your profile could not be read, so its backup copy was restored.', fresh: false };
    }
  }
  const mirrorText = port.getItem(SETTINGS_MIRROR_KEY);
  const mirror = mirrorText === null ? null : parseSettingsMirror(mirrorText);
  const settings = mirror !== null && !('error' in mirror) ? mirror.settings : undefined;
  const profile = freshProfile(makeId(), settings);
  if (text === null) return { profile, problem: null, fresh: true };
  return { profile, problem: 'Your profile could not be read, so a new one was started. Your settings were kept.', fresh: false };
}

/** Writes the profile (two-phase: `.tmp`, then `.bak` keeps the previous copy). */
export function saveProfile(port: StoragePort, profile: Profile): WriteResult {
  return writeTwoPhase(port, PROFILE_KEY, JSON.stringify(serializeProfile(profile)));
}

/** Writes the settings mirror (a single small key; a failure is reported, never thrown). */
export function saveSettingsMirror(port: StoragePort, settings: Settings): WriteResult {
  try {
    port.setItem(SETTINGS_MIRROR_KEY, serializeSettingsMirror(settings));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Could not write ${SETTINGS_MIRROR_KEY}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** A storage failure in words for the player (quota is the common one, PLAN §8.3 persistence.spec). */
export function storageProblem(error: string): string {
  return /quota/i.test(error)
    ? 'The browser’s storage is full, so the game could not be saved. Export your save from the Saves panel to keep it.'
    : 'The game could not be saved in this browser. Export your save from the Saves panel to keep it.';
}
