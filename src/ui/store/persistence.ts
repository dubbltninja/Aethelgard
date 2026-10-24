// The localStorage side of saves (PLAN §4.12, DESIGN §14): the browser storage port, and reading/writing the profile
// and the settings mirror through the engine's file code (`deserializeProfile`, `writeTwoPhase`, …). Nothing here
// throws: a blocked or full storage turns into `null` / `{ ok: false, error }` and the game keeps running in memory.
// U69 adds, on top, what the Saves panel needs (DESIGN §14.3–14.4): crash recovery of an interrupted two-phase write
// (`recoverInterrupted`), the raw text of a slot for export (`readSlotText`), and importing a run file into a chosen
// slot (`previewRunImport`, `writeRunToSlot`). All of it is pure over a StoragePort, so it is unit-tested without a DOM.
import {
  PROFILE_KEY,
  SAVE_SLOTS,
  SETTINGS_MIRROR_KEY,
  bakKey,
  deserialize,
  deserializeProfile,
  exportFileName,
  importRun,
  parseSettingsMirror,
  serializeProfile,
  serializeSettingsMirror,
  slotKey,
  tmpKey,
  writeTwoPhase,
  type ContentPack,
  type Profile,
  type SaveSlot,
  type SaveSummary,
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

// ---- crash recovery (DESIGN §14.4) --------------------------------------------------------------------------------------

export interface RecoveryReport {
  /** Keys whose `.tmp` replaced a missing or unreadable value (the write had been verified, only the swap was lost). */
  promoted: string[];
  /** Keys whose leftover `.tmp` was dropped (the stored value was fine, or the `.tmp` was not). */
  discarded: string[];
}

/**
 * A page closed in the middle of `writeTwoPhase` leaves `<key>.tmp` behind. The stored value is still the previous one
 * (the swap is the last step), so a leftover `.tmp` is normally just removed; only when the value itself is missing or
 * unreadable and the `.tmp` validates is it promoted, so a very first save is not lost. Run once at boot.
 */
export function recoverInterrupted(port: StoragePort, content: ContentPack): RecoveryReport {
  const report: RecoveryReport = { promoted: [], discarded: [] };
  const targets: { key: string; valid: (text: string) => boolean }[] = [
    ...SAVE_SLOTS.map((slot) => ({ key: slotKey(slot), valid: (text: string) => !('error' in deserialize(text, content)) })),
    { key: PROFILE_KEY, valid: (text) => !('error' in deserializeProfile(text)) },
  ];
  for (const { key, valid } of targets) {
    const tmp = port.getItem(tmpKey(key));
    if (tmp === null) continue;
    const main = port.getItem(key);
    if ((main === null || !valid(main)) && valid(tmp)) {
      try {
        port.setItem(key, tmp);
        report.promoted.push(key);
      } catch {
        report.discarded.push(key);
      }
    } else {
      report.discarded.push(key);
    }
    port.removeItem(tmpKey(key));
  }
  return report;
}

// ---- slots as files (export / import) -----------------------------------------------------------------------------------

export interface SlotText {
  /** The text to download: a readable slot pretty-printed, a damaged one verbatim. */
  text: string;
  /** `aethelgard-run-slot2-20261017-0905.json`; `…-unknown-time.json` for a damaged slot. */
  fileName: string;
  /** False when the stored text could not be read as a save: the file is the raw text (DESIGN §14.4 "Export raw text"). */
  readable: boolean;
}

/** The stored text of a slot ready to download, or null for an empty slot. */
export function readSlotText(port: StoragePort, slot: SaveSlot, content: ContentPack): SlotText | null {
  const raw = port.getItem(slotKey(slot));
  if (raw === null) return null;
  const read = deserialize(raw, content);
  if ('error' in read) return { text: raw, fileName: exportFileName('run', slot, 'unknown'), readable: false };
  return { text: JSON.stringify(read.file, null, 2), fileName: exportFileName('run', slot, read.file.savedAt), readable: true };
}

export interface RunPreview {
  summary: SaveSummary;
  savedAt: string;
  /** The file was written by an older save version and upgraded. */
  migratedFrom: number | null;
  /** Unknown ids dropped while checking the content pack (DESIGN §14.4). */
  warnings: string[];
}

/** Validates a run file for the import preview card; a refusal comes back as a sentence, never an exception. */
export function previewRunImport(text: string, content: ContentPack): { ok: true; preview: RunPreview } | { ok: false; error: string } {
  const read = importRun(text, content);
  if ('error' in read) return { ok: false, error: read.error };
  return { ok: true, preview: { summary: read.file.summary, savedAt: read.file.savedAt, migratedFrom: read.migratedFrom, warnings: read.warnings } };
}

/** Validates a run file and writes it, upgraded, to `slot` with the two-phase write; the slot is untouched on any failure. */
export function writeRunToSlot(port: StoragePort, slot: SaveSlot, text: string, content: ContentPack): WriteResult {
  const read = importRun(text, content);
  if ('error' in read) return { ok: false, error: read.error };
  return writeTwoPhase(port, slotKey(slot), JSON.stringify(read.file));
}

// ---- UI-only preferences: tutorials (U70) -----------------------------------------------------------------------------------
// `Settings` is frozen (D-073), so "Tutorials: off" and the callouts already seen live beside it in their own small keys:
// the switch once per browser (like the settings mirror), what was seen per profile id (a reading habit, like the codex marks).

export const TUTORIALS_OFF_KEY = 'aethelgard.tutorials.off';
export const TUTORIALS_SEEN_KEY = 'aethelgard.tutorials.seen';

/** Whether the player turned the tutorial callouts off. A missing or unreadable key means on. */
export function loadTutorialsOff(port: StoragePort | null): boolean {
  try {
    return port?.getItem(TUTORIALS_OFF_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveTutorialsOff(port: StoragePort | null, off: boolean): void {
  try {
    if (off) port?.setItem(TUTORIALS_OFF_KEY, '1');
    else port?.removeItem(TUTORIALS_OFF_KEY);
  } catch {
    // storage is full or blocked: the switch lasts for this session
  }
}

/** The callout ids already shown under `profileId`. */
export function loadTutorialsSeen(port: StoragePort | null, profileId: string): Set<string> {
  try {
    const text = port?.getItem(`${TUTORIALS_SEEN_KEY}.${profileId}`) ?? null;
    const parsed: unknown = text === null ? [] : JSON.parse(text);
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveTutorialsSeen(port: StoragePort | null, profileId: string, seen: ReadonlySet<string>): void {
  try {
    port?.setItem(`${TUTORIALS_SEEN_KEY}.${profileId}`, JSON.stringify([...seen].sort()));
  } catch {
    // storage is full or blocked: the marks last for this session
  }
}
