// The game store (PLAN §6.1): dispatch through `step`, profile persistence, save requests and autosave checkpoints,
// slots, export/import, settings, engine-error recovery; plus the profile/persistence helpers and the selector memo.
import { describe, expect, mock, test } from 'bun:test';
import {
  PROFILE_KEY,
  SETTINGS_MIRROR_KEY,
  bakKey,
  memoryStorage,
  serializeSettingsMirror,
  slotKey,
  step,
  type GameState,
  type StepFn,
  type StoragePort,
} from '@engine/index';
import { ENGINE_ERROR_TEXT, createGameStore, titleState, type StoreOptions } from '@ui/store/gameStore';
import { browserStorage, loadProfile, safePort, saveProfile, saveSettingsMirror, storageProblem } from '@ui/store/persistence';
import { DEFAULT_SETTINGS, freshProfile, newProfileId, patchSettings } from '@ui/store/profile';
import { selectorSnapshot, shallowEqual } from '@ui/store/useGame';
import { createEmitter } from '@ui/store/eventBus';
import { bootGame } from '@ui/boot';
import { fixturePack } from '@tests/fixtures/miniContent';

const content = fixturePack();
const NOW = '2026-10-17T09:05:00.000Z';

function setup(opts: StoreOptions = {}, storage = memoryStorage()) {
  const profile = freshProfile('p1');
  const store = createGameStore(content, profile, { storage, now: () => NOW, rethrow: false, report: () => undefined, ...opts });
  return { store, storage, profile };
}

function started(opts: StoreOptions = {}, storage = memoryStorage()) {
  const s = setup(opts, storage);
  expect(s.store.shell.newGame('Ann', 'ranger')).toEqual({ ok: true });
  return s;
}

describe('dispatch', () => {
  test('starts at the title with newGame legal for every class', () => {
    const { store } = setup();
    expect(store.getState().mode).toBe('title');
    expect(store.getContent()).toBe(content);
    const classes = store.getLegal().filter((a) => a.type === 'newGame').map((a) => (a.type === 'newGame' ? a.classId : ''));
    expect(classes.sort()).toEqual(Object.keys(content.classes).sort());
    expect(store.getLegal()).toBe(store.getLegal()); // memoized per state
    expect(store.isLegal({ type: 'newGame', name: 'X', classId: 'ranger' })).toBe(true);
  });

  test('newGame lands in explore, notifies subscribers and event listeners, and writes the autosave', () => {
    const { store, storage } = setup();
    const changed = mock(() => undefined);
    const seen: string[] = [];
    store.subscribe(changed);
    store.onEvents((events, state) => seen.push(...events.map((e) => e.t), state.mode));
    expect(store.shell.newGame('Ann', 'wizard', 'seed-1')).toEqual({ ok: true });
    const s = store.getState();
    expect(s.mode).toBe('explore');
    expect(s.player.classId).toBe('wizard');
    expect(s.meta.seed).toBe('seed-1');
    expect(s.meta.playerName).toBe('Ann');
    expect(changed).toHaveBeenCalled();
    expect(seen).toContain('autosaveCheckpoint');
    expect(seen.at(-1)).toBe('explore');
    expect(storage.getItem(slotKey('auto'))).not.toBeNull();
    expect(store.shell.continueSlot()).toMatchObject({ slot: 'auto', status: 'ok', savedAt: NOW });
  });

  test('a rejected action keeps the state, reports the reason and notifies nobody', () => {
    const { store } = setup();
    const before = store.getState();
    const changed = mock(() => undefined);
    store.subscribe(changed);
    const events = store.dispatch({ type: 'move', to: 'loc_nowhere' });
    expect(events[0]?.t).toBe('actionRejected');
    expect(store.getState()).toBe(before);
    expect(changed).not.toHaveBeenCalled();
    expect(store.shell.newGame('Ann', 'no_such_class').ok).toBe(false);
  });

  test('U62b: a checkpoint reached while a scene is open (Loop 2’s waking) is written when the scene closes, once', () => {
    const storage = memoryStorage();
    // the real step, except `wait` opens a scene with a checkpoint (an arrival that opens one) and `continue` closes it
    let base: GameState | null = null;
    const fake: StepFn = (s, action, c, p) => {
      if (action.type === 'wait' && base !== null) {
        const dialogue = { sceneId: 'scene_x', nodeId: 'a', npcId: null, visitedNodes: [], choicesTaken: [], returnMode: 'explore' as const };
        return { state: { ...base, mode: 'dialogue', dialogue }, profile: p, events: [{ t: 'autosaveCheckpoint', reason: 'arrival' }] } as never;
      }
      if (action.type === 'continue' && base !== null) return { state: { ...base, meta: { ...base.meta, playerName: 'After' } }, profile: p, events: [] };
      return step(s, action, c, p);
    };
    const { store } = started({ step: fake }, storage);
    base = store.getState();
    storage.removeItem(slotKey('auto'));
    store.dispatch({ type: 'wait' });
    expect(storage.getItem(slotKey('auto'))).toBeNull(); // not inside the scene
    store.dispatch({ type: 'continue' });
    expect(storage.getItem(slotKey('auto'))).toContain('"playerName":"After"');
    storage.removeItem(slotKey('auto'));
    store.dispatch({ type: 'continue' });
    expect(storage.getItem(slotKey('auto'))).toBeNull(); // written once
  });

  test('autosave off: checkpoints write nothing', () => {
    const { store, storage } = setup();
    store.shell.updateSettings({ autosave: false });
    store.shell.newGame('Ann', 'ranger');
    expect(storage.getItem(slotKey('auto'))).toBeNull();
  });

  test('an engine exception restores the state, shows the recoverable toast, and rethrows only when asked', () => {
    const boom: StepFn = () => {
      throw new Error('boom');
    };
    const report = mock(() => undefined);
    const { store } = setup({ step: boom, report });
    const before = store.getState();
    expect(store.dispatch({ type: 'newGame', name: 'A', classId: 'ranger' })).toEqual([]);
    expect(store.getState()).toBe(before);
    expect(store.getNotices().at(-1)).toMatchObject({ text: ENGINE_ERROR_TEXT, tone: 'error' });
    expect(report).toHaveBeenCalledTimes(1);
    expect(store.shell.newGame('A', 'ranger')).toEqual({ ok: false, error: ENGINE_ERROR_TEXT });
    const loud = setup({ step: boom, rethrow: true }).store;
    expect(() => loud.dispatch({ type: 'newGame', name: 'A', classId: 'ranger' })).toThrow('boom');
  });

  test('notices are capped and dismissable', () => {
    const { store } = setup();
    for (let i = 0; i < 6; i++) store.notify(`n${i}`);
    expect(store.getNotices().map((n) => n.text)).toEqual(['n2', 'n3', 'n4', 'n5']);
    const first = store.getNotices()[0]!;
    const changed = mock(() => undefined);
    store.subscribe(changed);
    store.dismissNotice(first.id);
    store.dismissNotice(first.id); // a second dismiss changes nothing
    expect(store.getNotices()).toHaveLength(3);
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('slots', () => {
  test('save to a manual slot writes it and lists its summary', () => {
    const { store, storage } = started();
    expect(store.shell.save(1)).toEqual({ ok: true });
    expect(storage.getItem(slotKey(1))).not.toBeNull();
    expect(store.getNotices().at(-1)?.text).toBe('Saved to slot 1.');
    const slots = store.shell.listSlots();
    expect(slots.map((s) => [s.slot, s.status])).toEqual([
      [1, 'ok'],
      [2, 'empty'],
      [3, 'empty'],
      ['auto', 'ok'],
    ]);
    expect(store.shell.listSlots()).toBe(slots); // cached until a write
    const one = slots[0];
    expect(one?.status === 'ok' ? one.summary.title : '').toMatch(/^Loop 1 · Day 1 · /);
  });

  test('saving is refused at the title (the engine rejects it)', () => {
    const { store } = setup();
    const result = store.shell.save(2);
    expect(result.ok).toBe(false);
  });

  test('load returns to the title first, then resumes the slot', () => {
    const { store } = started();
    store.shell.save(2);
    const saved = store.getState();
    store.dispatch({ type: 'rest', kind: 'short' });
    expect(store.getState().clock.ticks).not.toBe(saved.clock.ticks);
    expect(store.shell.load(2)).toEqual({ ok: true });
    const back = store.getState();
    expect(back.mode).toBe('explore');
    expect(back.clock.ticks).toBe(saved.clock.ticks);
    expect(back.world.currentLocationId).toBe(saved.world.currentLocationId);
  });

  test('load explains an empty or damaged slot, and a missing storage', () => {
    const { store, storage } = setup();
    expect(store.shell.load(3)).toEqual({ ok: false, error: 'That slot is empty.' });
    storage.setItem(slotKey(3), '{"kind":"run"');
    expect(store.shell.load(3).ok).toBe(false);
    const none = createGameStore(content, freshProfile('p'), { storage: null });
    expect(none.shell.load(1).ok).toBe(false);
    expect(none.shell.canPersist()).toBe(false);
    expect(none.shell.listSlots().every((s) => s.status === 'empty')).toBe(true);
  });

  test('a damaged slot is listed as corrupted, restorable from a valid backup, and deletable', () => {
    const { store, storage } = started();
    store.shell.save(1);
    store.shell.save(1); // the second write keeps the first in .bak
    storage.setItem(slotKey(1), 'not json');
    store.shell.deleteSlot(2); // bumps the slot cache
    expect(store.shell.listSlots()[0]).toMatchObject({ slot: 1, status: 'corrupted', hasBackup: true });
    expect(store.shell.restoreSlot(1)).toEqual({ ok: true });
    expect(store.shell.listSlots()[0]).toMatchObject({ slot: 1, status: 'ok' });
    store.shell.deleteSlot(1);
    expect(storage.getItem(slotKey(1))).toBeNull();
    expect(storage.getItem(bakKey(slotKey(1)))).toBeNull();
    expect(store.shell.listSlots()[0]).toMatchObject({ slot: 1, status: 'empty' });
    expect(store.shell.restoreSlot(1).ok).toBe(false);
  });

  test('a full storage: the save fails with the quota message, and a failing autosave says so once', () => {
    const big = memoryStorage({}, 200_000);
    const { store } = started({}, big);
    const used = big.keys().reduce((n, k) => n + k.length + (big.getItem(k) ?? '').length, 0);
    big.setItem('filler', 'x'.repeat(200_000 - used - 'filler'.length - 100)); // 100 characters left
    const result = store.shell.save(1);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('storage is full');
    const before = store.getNotices().filter((n) => n.tone === 'error').length;
    store.dispatch({ type: 'rest', kind: 'short' }); // checkpoints → autosave fails
    store.dispatch({ type: 'rest', kind: 'short' });
    const errors = store.getNotices().filter((n) => n.tone === 'error').length;
    expect(errors - before).toBeLessThanOrEqual(1);
  });

  test('export and import a run', () => {
    const { store } = started();
    const text = store.shell.exportSave();
    expect(JSON.parse(text)).toMatchObject({ kind: 'run', savedAt: NOW });
    store.dispatch({ type: 'returnToTitle' });
    expect(store.getState().mode).toBe('title');
    expect(store.shell.importSave(text)).toEqual({ ok: true });
    expect(store.getState().mode).toBe('explore');
    expect(store.shell.importSave('{}').ok).toBe(false);
  });
});

describe('profile and settings', () => {
  test('updateSettings writes the profile and the settings mirror at once', () => {
    const { store, storage } = setup();
    const changed = mock(() => undefined);
    store.subscribe(changed);
    store.shell.updateSettings({ textScale: 1.5, highContrast: true, volumes: { master: 0.1, ambient: 0.6, sfx: 0.8, music: 0.5 } });
    expect(store.getProfile().settings).toMatchObject({ textScale: 1.5, highContrast: true });
    expect(store.getProfile().settings.volumes.master).toBe(0.1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(loadProfile(storage).profile.settings.textScale).toBe(1.5);
    expect(storage.getItem(SETTINGS_MIRROR_KEY)).toContain('"textScale":1.5');
  });

  test('export / import the profile; a bad file is refused', () => {
    const { store } = setup();
    store.shell.updateSettings({ highContrast: true });
    const text = store.shell.exportProfile();
    const other = setup().store;
    expect(other.shell.importProfile(text)).toEqual({ ok: true });
    expect(other.getProfile().settings.highContrast).toBe(true);
    expect(other.shell.importProfile('nope').ok).toBe(false);
  });

  test('resetProfile starts a new profile id, keeps the settings and goes back to the title', () => {
    const { store } = started({ makeProfileId: () => 'fresh-id' });
    store.shell.updateSettings({ textScale: 1.25 });
    store.shell.resetProfile();
    expect(store.getProfile().profileId).toBe('fresh-id');
    expect(store.getProfile().settings.textScale).toBe(1.25);
    expect(store.getState().mode).toBe('title');
  });

  test('a profile change made by a step is persisted', () => {
    const { store, storage } = started();
    const profileStep: StepFn = (state, _action, _content, profile) => ({ state, profile: { ...profile, resonance: 7 }, events: [] });
    const writer = createGameStore(content, store.getProfile(), { storage, step: profileStep, now: () => NOW });
    writer.dispatch({ type: 'wait' });
    expect(loadProfile(storage).profile.resonance).toBe(7);
  });

  test('titleState needs at least one class', () => {
    const state: GameState = titleState(content, freshProfile('x'));
    expect(state.mode).toBe('title');
    expect(() => titleState({ ...content, classes: {} }, freshProfile('x'))).toThrow('no classes');
  });
});

describe('persistence helpers', () => {
  test('loadProfile: first visit, a stored profile, a damaged one with a backup, a damaged one with only the mirror', () => {
    const port = memoryStorage();
    expect(loadProfile(null, () => 'n')).toMatchObject({ fresh: true, problem: null, profile: { profileId: 'n' } });
    expect(loadProfile(port, () => 'a')).toMatchObject({ fresh: true, profile: { profileId: 'a' } });

    const stored = { ...freshProfile('stored'), resonance: 3 };
    saveProfile(port, stored);
    expect(loadProfile(port)).toMatchObject({ fresh: false, problem: null, profile: { profileId: 'stored', resonance: 3 } });

    saveProfile(port, { ...stored, resonance: 4 }); // .bak keeps resonance 3
    port.setItem(PROFILE_KEY, '{broken');
    const fromBak = loadProfile(port);
    expect(fromBak.profile.resonance).toBe(3);
    expect(fromBak.problem).toContain('backup');

    port.setItem(bakKey(PROFILE_KEY), '{broken');
    saveSettingsMirror(port, { ...DEFAULT_SETTINGS, textScale: 1.5 });
    const fromMirror = loadProfile(port, () => 'm');
    expect(fromMirror.profile).toMatchObject({ profileId: 'm', settings: { textScale: 1.5 } });
    expect(fromMirror.problem).toContain('settings were kept');
    expect(fromMirror.fresh).toBe(false);
  });

  test('safePort swallows read and remove failures but not write failures', () => {
    const throwing: StoragePort = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const port = safePort(throwing);
    expect(port.getItem('k')).toBeNull();
    expect(() => port.removeItem('k')).not.toThrow();
    expect(() => port.setItem('k', 'v')).toThrow('full');
    expect(saveSettingsMirror(port, DEFAULT_SETTINGS)).toMatchObject({ ok: false });
  });

  test('browserStorage: a working localStorage, a blocked one, none at all', () => {
    expect(browserStorage({ localStorage: memoryStorage() })).not.toBeNull();
    const blocked = {
      get localStorage(): StoragePort {
        throw new Error('SecurityError');
      },
    };
    expect(browserStorage(blocked)).toBeNull();
    expect(browserStorage({})).toBeNull();
    expect(browserStorage(undefined)).toBeNull();
  });

  test('storageProblem tells quota apart from other failures', () => {
    expect(storageProblem('Could not write x: The quota has been exceeded.')).toContain('full');
    expect(storageProblem('Could not write x: denied')).not.toContain('full');
  });

  test('profile helpers', () => {
    expect(newProfileId(() => 0)).toBe('00000000');
    expect(newProfileId(() => 0.5)).toBe('80000000');
    expect(newProfileId()).toMatch(/^[0-9a-f]{8}$/);
    const p = freshProfile('x', { ...DEFAULT_SETTINGS, muted: true });
    expect(p.settings.muted).toBe(true);
    expect(p.settings.volumes).not.toBe(DEFAULT_SETTINGS.volumes);
    const patched = patchSettings(DEFAULT_SETTINGS, { volumes: { ...DEFAULT_SETTINGS.volumes, sfx: 0 } });
    expect(patched.volumes).toEqual({ ...DEFAULT_SETTINGS.volumes, sfx: 0 });
    expect(serializeSettingsMirror(DEFAULT_SETTINGS)).toContain('"kind":"settings"');
  });
});

describe('boot', () => {
  test('a first visit writes its profile at once; no storage means a notice and an in-memory game', () => {
    const storage = memoryStorage();
    const { store } = bootGame({ content, storage });
    expect(store.getState().mode).toBe('title');
    expect(loadProfile(storage).profile.profileId).toBe(store.getProfile().profileId);
    expect(store.getNotices()).toEqual([]);
    const again = bootGame({ content, storage }).store;
    expect(again.getProfile().profileId).toBe(store.getProfile().profileId);

    const none = bootGame({ content, storage: null }).store;
    expect(none.shell.canPersist()).toBe(false);
    expect(none.getNotices()[0]?.text).toContain('nothing will be saved');

    storage.setItem(PROFILE_KEY, '{broken');
    storage.removeItem(bakKey(PROFILE_KEY));
    expect(bootGame({ content, storage }).store.getNotices()[0]?.tone).toBe('error');
  });
});

describe('selectors and the emitter', () => {
  test('selectorSnapshot recomputes only for a new source and keeps an equal selection', () => {
    let source = { a: 1, list: [1, 2] };
    const select = mock((s: typeof source) => [...s.list]);
    const get = selectorSnapshot(() => source, select, shallowEqual);
    const first = get();
    expect(get()).toBe(first);
    expect(select).toHaveBeenCalledTimes(1);
    source = { ...source, a: 2 };
    expect(get()).toBe(first); // new source, same contents → same reference
    source = { ...source, list: [3] };
    expect(get()).toEqual([3]);
  });

  test('shallowEqual', () => {
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual([1], { 0: 1 })).toBe(false);
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual<unknown>(null, {})).toBe(false);
  });

  test('the emitter survives listeners that unsubscribe during an emit', () => {
    const e = createEmitter<[number]>();
    const calls: string[] = [];
    const offA = e.on(() => {
      calls.push('a');
      offA();
    });
    e.on((n) => calls.push(`b${n}`));
    e.emit(1);
    e.emit(2);
    expect(calls).toEqual(['a', 'b1', 'b2']);
    expect(e.size()).toBe(1);
  });
});
