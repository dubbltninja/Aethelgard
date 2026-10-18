// The game store (PLAN §6.1): one per app, created in main.tsx with the content pack and the loaded profile. It owns
// the current GameState and Profile, runs every player input through the engine's `step`, persists the profile,
// answers the engine's save requests and autosave checkpoints, and fans changes out to React (`subscribe`) and to
// UI effects (`onEvents`: audio, live region, toasts). Panels and sub-views are not engine state and never pass here.
//
// Pattern for later screens: never call `step` yourself. Dispatch an Action (only ones `getLegal` lists or `isLegal`
// accepts are enabled in the UI); read what you draw from `getState()` through `useGame(selector)`; react to what
// happened through `useGameEvents`. Anything that is not gameplay (settings, slots, export) goes through `shell`.
import {
  SAVE_SLOTS,
  canAutosave,
  exportProfile as profileText,
  exportRun,
  importProfile as parseProfileText,
  importRun,
  isLegal,
  legalActions,
  newRun,
  readRunSlot,
  restoreBackup,
  serialize,
  slotKey,
  slotKeys,
  step as engineStep,
  writeTwoPhase,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
  type SaveFile,
  type SaveSlot,
  type SaveSummary,
  type Settings,
  type StepFn,
  type StoragePort,
} from '@engine/index';
import { stateHash } from '@engine/util/hash';
import { createEmitter } from './eventBus';
import { saveProfile, saveSettingsMirror, storageProblem } from './persistence';
import { freshProfile, newProfileId, patchSettings } from './profile';

export type Result = { ok: true } | { ok: false; error: string };

export type SlotInfo =
  | { slot: SaveSlot; status: 'empty' }
  | { slot: SaveSlot; status: 'ok'; summary: SaveSummary; savedAt: string }
  /** DESIGN §14.4: shown as Corrupted with Restore `.bak` (when `hasBackup`), Export raw text and Delete. */
  | { slot: SaveSlot; status: 'corrupted'; error: string; hasBackup: boolean };

export type NoticeTone = 'info' | 'success' | 'error';
export interface Notice {
  id: number;
  text: string;
  tone: NoticeTone;
}

/** The recoverable-error toast of PLAN §6.1. */
export const ENGINE_ERROR_TEXT = 'The Breach stuttered — your last action was undone.';
const MAX_NOTICES = 4;

export interface GameStore {
  getState(): GameState;
  getProfile(): Profile;
  getContent(): ContentPack;
  /** Memoized per state (and profile) reference. */
  getLegal(): Action[];
  isLegal(action: Action): boolean;
  /** Toasts waiting to be shown, oldest first. */
  getNotices(): readonly Notice[];
  /** State, profile or notices changed. */
  subscribe(listener: () => void): () => void;
  /** Every dispatch's events with the state they produced (rejections included). */
  onEvents(listener: (events: GameEvent[], state: GameState) => void): () => void;
  /** step() → state/profile → persist profile → save requests and autosave → notify. Returns the step's events. */
  dispatch(action: Action): GameEvent[];
  notify(text: string, tone?: NoticeTone): void;
  dismissNotice(id: number): void;
  shell: {
    newGame(name: string, classId: string, seed?: string): Result;
    save(slot: SaveSlot): Result;
    /** Title mode, or anywhere `returnToTitle` is legal (the store goes to the title first). */
    load(slot: SaveSlot): Result;
    listSlots(): SlotInfo[];
    /** The autosave a Continue button resumes, or null. */
    continueSlot(): SlotInfo | null;
    deleteSlot(slot: SaveSlot): void;
    restoreSlot(slot: SaveSlot): Result;
    exportSave(): string;
    importSave(json: string): Result;
    exportProfile(): string;
    /** Replaces the profile (U69 adds DESIGN §14.3's merge on top). */
    importProfile(json: string): Result;
    /** A fresh profile that keeps the settings; the game returns to the title. */
    resetProfile(): void;
    /** Writes profile.settings at once and mirrors them (settings are not gameplay, so not an engine action). */
    updateSettings(patch: Partial<Settings>): void;
    /** False when the browser gave the game no storage (the game still runs, nothing persists). */
    canPersist(): boolean;
  };
}

export interface StoreOptions {
  /** Where saves live; null keeps everything in memory. */
  storage?: StoragePort | null;
  /** The state to start in (default: the title of a fresh run). */
  initialState?: GameState;
  /** ISO timestamp for `savedAt` and export names (the engine never reads a clock). */
  now?: () => string;
  /** Test seam: a different `step`. */
  step?: StepFn;
  /** Rethrow engine exceptions after restoring the state (default: `__DEV__`, PLAN §6.1). */
  rethrow?: boolean;
  /** Where engine exceptions are reported (default: console.error). */
  report?: (message: string, error: unknown) => void;
  /** Id source for `resetProfile`. */
  makeProfileId?: () => string;
}

/** The title screen's state: a run that has not started (mode `title`); `newGame` replaces it wholesale. */
export function titleState(content: ContentPack, profile: Profile): GameState {
  const classId = Object.keys(content.classes)[0];
  if (classId === undefined) throw new Error('titleState: the content pack has no classes');
  return { ...newRun(`${profile.profileId}:title`, classId, content, profile), mode: 'title' };
}

export function createGameStore(content: ContentPack, initialProfile: Profile, options: StoreOptions = {}): GameStore {
  const storage = options.storage ?? null;
  const now = options.now ?? (() => new Date().toISOString());
  const runStep = options.step ?? engineStep;
  const rethrow = options.rethrow ?? __DEV__;
  const report = options.report ?? ((message: string, error: unknown) => console.error(message, error));
  const makeProfileId = options.makeProfileId ?? newProfileId;

  let state: GameState = options.initialState ?? titleState(content, initialProfile);
  let profile: Profile = initialProfile;
  let notices: readonly Notice[] = [];
  let nextNoticeId = 1;
  let legalFor: { state: GameState; profile: Profile; legal: Action[] } | null = null;
  /** Bumped by every slot write/delete, so `listSlots` re-reads storage only when something changed. */
  let slotsVersion = 0;
  let slotsCache: { version: number; slots: SlotInfo[] } | null = null;
  let autosaveFailing = false;
  /** The last `saveRequested` write, so `shell.save` can return its outcome. */
  let lastWrite: Result | null = null;
  /** Whether the last dispatch threw inside the engine (its state was restored). */
  let lastThrew = false;

  const changed = createEmitter<[]>();
  const events = createEmitter<[GameEvent[], GameState]>();

  const notify = (text: string, tone: NoticeTone = 'info'): void => {
    notices = [...notices, { id: nextNoticeId++, text, tone }].slice(-MAX_NOTICES);
    changed.emit();
  };

  const persistProfile = (): void => {
    if (storage === null) return;
    const result = saveProfile(storage, profile);
    if (!result.ok) notify(storageProblem(result.error), 'error');
  };

  const writeSlot = (slot: SaveSlot): Result => {
    if (storage === null) return { ok: false, error: 'This browser gives the game no storage, so saves cannot be kept.' };
    const file = serialize(state, profile, content, now());
    const result = writeTwoPhase(storage, slotKey(slot), JSON.stringify(file));
    slotsVersion += 1;
    return result;
  };

  /** One autosave write per step however many checkpoints it emitted (PLAN §6.1). */
  const autosave = (): void => {
    if (!profile.settings.autosave || !canAutosave(state)) return;
    const result = writeSlot('auto');
    if (result.ok) {
      autosaveFailing = false;
    } else if (!autosaveFailing) {
      autosaveFailing = true; // say it once, not on every step
      notify(storageProblem(result.error), 'error');
    }
  };

  const dispatch = (action: Action): GameEvent[] => {
    const before = { state, profile };
    let result: ReturnType<StepFn>;
    lastThrew = false;
    try {
      result = runStep(state, action, content, profile);
    } catch (error) {
      lastThrew = true;
      state = before.state;
      profile = before.profile;
      report(`step threw on ${JSON.stringify(action)} at state ${stateHash(before.state)}`, error);
      notify(ENGINE_ERROR_TEXT, 'error');
      if (rethrow) throw error;
      return [];
    }
    state = result.state;
    const profileChanged = result.profile !== profile;
    profile = result.profile;
    if (profileChanged) persistProfile();
    let checkpoint = false;
    for (const event of result.events) {
      if (event.t === 'saveRequested') {
        const written = writeSlot(event.slot);
        if (written.ok) notify(event.slot === 'auto' ? 'Saved to the autosave slot.' : `Saved to slot ${event.slot}.`, 'success');
        else notify(storageProblem(written.error), 'error');
        lastWrite = written;
      } else if (event.t === 'autosaveCheckpoint') {
        checkpoint = true;
      }
    }
    if (checkpoint) autosave();
    if (state !== before.state || profileChanged) changed.emit();
    events.emit(result.events, state);
    return result.events;
  };

  const rejection = (out: GameEvent[]): string | null => {
    const rejected = out.find((e) => e.t === 'actionRejected');
    return rejected?.t === 'actionRejected' ? rejected.reason : null;
  };

  const runAction = (action: Action): Result => {
    const out = dispatch(action);
    const why = rejection(out);
    if (why !== null) return { ok: false, error: why };
    return lastThrew ? { ok: false, error: ENGINE_ERROR_TEXT } : { ok: true };
  };

  /** Back to the title so a `load` can run there (D-075: `load` is title-only). */
  const toTitle = (): Result => (state.mode === 'title' ? { ok: true } : runAction({ type: 'returnToTitle' }));

  const loadFile = (file: SaveFile): Result => {
    const back = toTitle();
    if (!back.ok) return back;
    return runAction({ type: 'load', save: file });
  };

  const readSlot = (slot: SaveSlot): SlotInfo => {
    if (storage === null) return { slot, status: 'empty' };
    const read = readRunSlot(storage, slotKey(slot), content);
    if (read.status === 'empty') return { slot, status: 'empty' };
    if (read.status === 'corrupted') return { slot, status: 'corrupted', error: read.error, hasBackup: read.hasBackup };
    return { slot, status: 'ok', summary: read.file.summary, savedAt: read.file.savedAt };
  };

  const listSlots = (): SlotInfo[] => {
    if (slotsCache === null || slotsCache.version !== slotsVersion) {
      slotsCache = { version: slotsVersion, slots: SAVE_SLOTS.map(readSlot) };
    }
    return slotsCache.slots;
  };

  const store: GameStore = {
    getState: () => state,
    getProfile: () => profile,
    getContent: () => content,
    getLegal() {
      if (legalFor === null || legalFor.state !== state || legalFor.profile !== profile) {
        legalFor = { state, profile, legal: legalActions(state, content, profile) };
      }
      return legalFor.legal;
    },
    isLegal: (action) => isLegal(state, action, content, profile),
    getNotices: () => notices,
    subscribe: (listener) => changed.on(listener),
    onEvents: (listener) => events.on(listener),
    dispatch,
    notify,
    dismissNotice(id) {
      const next = notices.filter((n) => n.id !== id);
      if (next.length === notices.length) return;
      notices = next;
      changed.emit();
    },
    shell: {
      newGame: (name, classId, seed) => runAction(seed === undefined || seed === '' ? { type: 'newGame', name, classId } : { type: 'newGame', name, classId, seed }),
      save(slot) {
        lastWrite = null;
        const asked = runAction({ type: 'save', slot });
        const written = lastWrite as Result | null;
        if (!asked.ok) return asked;
        if (written !== null && !written.ok) return { ok: false, error: storageProblem(written.error) };
        return { ok: true };
      },
      load(slot) {
        if (storage === null) return { ok: false, error: 'This browser gives the game no storage, so there is nothing to load.' };
        const read = readRunSlot(storage, slotKey(slot), content);
        if (read.status === 'empty') return { ok: false, error: 'That slot is empty.' };
        if (read.status === 'corrupted') return { ok: false, error: `That save is damaged: ${read.error}` };
        return loadFile(read.file);
      },
      listSlots,
      continueSlot() {
        const auto = listSlots().find((s) => s.slot === 'auto');
        return auto !== undefined && auto.status === 'ok' ? auto : null;
      },
      deleteSlot(slot) {
        if (storage === null) return;
        for (const key of slotKeys(slot)) storage.removeItem(key);
        slotsVersion += 1;
        changed.emit();
      },
      restoreSlot(slot) {
        if (storage === null || !restoreBackup(storage, slotKey(slot), content)) return { ok: false, error: 'There is no readable backup of that slot.' };
        slotsVersion += 1;
        changed.emit();
        return { ok: true };
      },
      exportSave: () => exportRun(state, profile, content, now()),
      importSave(json) {
        const imported = importRun(json, content);
        if ('error' in imported) return { ok: false, error: imported.error };
        return loadFile(imported.file);
      },
      exportProfile: () => profileText(profile),
      importProfile(json) {
        const imported = parseProfileText(json);
        if ('error' in imported) return { ok: false, error: imported.error };
        profile = imported.profile;
        persistProfile();
        if (storage !== null) saveSettingsMirror(storage, profile.settings);
        changed.emit();
        return { ok: true };
      },
      resetProfile() {
        profile = freshProfile(makeProfileId(), profile.settings);
        state = titleState(content, profile);
        persistProfile();
        changed.emit();
      },
      updateSettings(patch) {
        profile = { ...profile, settings: patchSettings(profile.settings, patch) };
        persistProfile();
        if (storage !== null) {
          const mirrored = saveSettingsMirror(storage, profile.settings);
          if (!mirrored.ok) notify(storageProblem(mirrored.error), 'error');
        }
        changed.emit();
      },
      canPersist: () => storage !== null,
    },
  };
  return store;
}
