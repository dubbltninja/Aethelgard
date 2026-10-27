// The Codex's read state (DESIGN §16.3 `screen_codex`: new entries are marked until opened). Which entries a player has
// opened is a reading habit, not game state: it lives beside the profile in its own small localStorage key, per profile id,
// so it never touches a save or a replay trace and a reset profile starts unread. Storage can be missing or full; then the
// marks last for the session only. Also here: a one-shot request for a panel to open at a given entry (the Bestiary's "Read
// in the Codex"), which the Codex panel takes on opening.
import type { StoragePort } from '@engine/index';
import { createEmitter } from './eventBus';
import { browserStorage } from './persistence';

export const CODEX_READ_KEY = 'aethelgard.codex.read';

export interface CodexReadStore {
  /** The ids opened under `profileId`; a new Set only when something changed (stable for `useSyncExternalStore`). */
  read(profileId: string): ReadonlySet<string>;
  mark(profileId: string, entryId: string): void;
  subscribe(listener: () => void): () => void;
}

export function createCodexReadStore(port: StoragePort | null): CodexReadStore {
  const sets = new Map<string, ReadonlySet<string>>();
  const changed = createEmitter<[]>();
  const keyOf = (profileId: string): string => `${CODEX_READ_KEY}.${profileId}`;
  const load = (profileId: string): ReadonlySet<string> => {
    try {
      const text = port?.getItem(keyOf(profileId)) ?? null;
      const parsed: unknown = text === null ? [] : JSON.parse(text);
      return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  };
  return {
    read(profileId) {
      let set = sets.get(profileId);
      if (set === undefined) {
        set = load(profileId);
        sets.set(profileId, set);
      }
      return set;
    },
    mark(profileId, entryId) {
      const before = this.read(profileId);
      if (before.has(entryId)) return;
      const next = new Set(before);
      next.add(entryId);
      sets.set(profileId, next);
      try {
        port?.setItem(keyOf(profileId), JSON.stringify([...next].sort()));
      } catch {
        // storage is full or blocked: the mark lasts for this session
      }
      changed.emit();
    },
    subscribe: (listener) => changed.on(listener),
  };
}

let shared: CodexReadStore | null = null;

/** The page's store, over its localStorage (created on first use). */
export function sharedCodexReadStore(): CodexReadStore {
  shared ??= createCodexReadStore(browserStorage());
  return shared;
}

/** Tests only: forget the shared store. */
export function resetSharedCodexReadStore(next: CodexReadStore | null = null): void {
  shared = next;
}

// ---- opening a panel at an entry ---------------------------------------------------------------------------------------------

let requested: string | null = null;

/** Asks the next Codex panel to open at `entryId`. */
export function requestCodexEntry(entryId: string): void {
  requested = entryId;
}

/** The pending request, once: reading it clears it. */
export function takeCodexRequest(): string | null {
  const id = requested;
  requested = null;
  return id;
}
