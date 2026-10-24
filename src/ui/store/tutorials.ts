// The tutorial state (DESIGN §16.8; U70): the "Tutorials: off" switch and which callouts a profile has already seen. Both
// are reading habits, not game state, so they live beside the profile in their own localStorage keys (persistence.ts) and
// never touch a save or a replay trace. `Settings` has no field for the switch (the schema is frozen, D-073). Storage can
// be missing or full; then the state lasts for the session only.
import type { StoragePort } from '@engine/index';
import { createEmitter } from './eventBus';
import { browserStorage, loadTutorialsOff, loadTutorialsSeen, saveTutorialsOff, saveTutorialsSeen } from './persistence';

export interface TutorialStore {
  off(): boolean;
  setOff(off: boolean): void;
  /** The callout ids shown under `profileId`; a new Set only when something changed (stable for `useSyncExternalStore`). */
  seen(profileId: string): ReadonlySet<string>;
  markSeen(profileId: string, id: string): void;
  /** Forgets what a profile has seen (the Settings panel's "Show the hints again"). */
  reset(profileId: string): void;
  subscribe(listener: () => void): () => void;
}

export function createTutorialStore(port: StoragePort | null): TutorialStore {
  let off = loadTutorialsOff(port);
  const sets = new Map<string, ReadonlySet<string>>();
  const changed = createEmitter<[]>();
  const store: TutorialStore = {
    off: () => off,
    setOff(next) {
      if (next === off) return;
      off = next;
      saveTutorialsOff(port, next);
      changed.emit();
    },
    seen(profileId) {
      let set = sets.get(profileId);
      if (set === undefined) {
        set = loadTutorialsSeen(port, profileId);
        sets.set(profileId, set);
      }
      return set;
    },
    markSeen(profileId, id) {
      const before = store.seen(profileId);
      if (before.has(id)) return;
      const next = new Set(before);
      next.add(id);
      sets.set(profileId, next);
      saveTutorialsSeen(port, profileId, next);
      changed.emit();
    },
    reset(profileId) {
      if (store.seen(profileId).size === 0) return;
      const empty = new Set<string>();
      sets.set(profileId, empty);
      saveTutorialsSeen(port, profileId, empty);
      changed.emit();
    },
    subscribe: (listener) => changed.on(listener),
  };
  return store;
}

let shared: TutorialStore | null = null;

/** The page's store, over its localStorage (created on first use). */
export function sharedTutorialStore(): TutorialStore {
  shared ??= createTutorialStore(browserStorage());
  return shared;
}

/** Tests only: replace (or forget) the shared store. */
export function resetSharedTutorialStore(next: TutorialStore | null = null): void {
  shared = next;
}
