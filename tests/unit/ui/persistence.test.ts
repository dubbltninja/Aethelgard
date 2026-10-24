// U69 persistence (DESIGN §14.2–14.4): the two-phase write's crash states, `.bak` restore, corrupt JSON, future and old
// versions, a full storage, and a run file imported into a slot — all over a memory port, no DOM.
import { describe, expect, test } from 'bun:test';
import { PROFILE_KEY, bakKey, memoryStorage, slotKey, tmpKey, writeTwoPhase, type StoragePort } from '@engine/index';
import { createGameStore } from '@ui/store/gameStore';
import { previewRunImport, readSlotText, recoverInterrupted, saveProfile, writeRunToSlot } from '@ui/store/persistence';
import { freshProfile } from '@ui/store/profile';
import { fixturePack } from '@tests/fixtures/miniContent';

const content = fixturePack();
const NOW = '2026-10-17T09:05:00.000Z';

function make(storage: StoragePort) {
  return createGameStore(content, freshProfile('p1'), { storage, now: () => NOW, rethrow: false, report: () => undefined });
}

function started(storage = memoryStorage()) {
  const store = make(storage);
  expect(store.shell.newGame('Ann', 'ranger')).toEqual({ ok: true });
  return { store, storage };
}

describe('recoverInterrupted (the .tmp left by a closed page)', () => {
  test('a .tmp beside a healthy value is dropped and the value stays', () => {
    const { store, storage } = started();
    store.shell.save(1);
    const before = storage.getItem(slotKey(1));
    storage.setItem(tmpKey(slotKey(1)), 'half a wri');
    const report = recoverInterrupted(storage, content);
    expect(report).toEqual({ promoted: [], discarded: [slotKey(1)] });
    expect(storage.getItem(slotKey(1))).toBe(before);
    expect(storage.getItem(tmpKey(slotKey(1)))).toBeNull();
  });

  test('a verified .tmp replaces a value that is missing or unreadable', () => {
    const { storage } = started();
    const good = storage.getItem(slotKey('auto'))!;
    storage.removeItem(slotKey('auto'));
    storage.setItem(tmpKey(slotKey('auto')), good);
    expect(recoverInterrupted(storage, content).promoted).toEqual([slotKey('auto')]);
    expect(storage.getItem(slotKey('auto'))).toBe(good);

    storage.setItem(slotKey('auto'), '{"kind":');
    storage.setItem(tmpKey(slotKey('auto')), good);
    expect(recoverInterrupted(storage, content).promoted).toEqual([slotKey('auto')]);
    expect(storage.getItem(slotKey('auto'))).toBe(good);
  });

  test('a torn .tmp never replaces anything, and the profile gets the same treatment', () => {
    const { storage } = started();
    storage.setItem(tmpKey(slotKey(3)), '{"kind":"run","vers');
    storage.setItem(tmpKey(PROFILE_KEY), 'garbage');
    const report = recoverInterrupted(storage, content);
    expect(report.promoted).toEqual([]);
    expect(report.discarded).toEqual([slotKey(3), PROFILE_KEY]);
    expect(storage.getItem(slotKey(3))).toBeNull();
    expect(storage.getItem(tmpKey(PROFILE_KEY))).toBeNull();
  });

  test('nothing to do is an empty report', () => {
    expect(recoverInterrupted(memoryStorage(), content)).toEqual({ promoted: [], discarded: [] });
  });

  test('a crash at each step of a real two-phase write leaves a readable slot', () => {
    for (let failAt = 1; failAt <= 3; failAt++) {
      const { store, storage } = started();
      store.shell.save(1);
      const first = storage.getItem(slotKey(1))!;
      let writes = 0;
      const flaky: StoragePort = {
        getItem: (k) => storage.getItem(k),
        removeItem: (k) => storage.removeItem(k),
        setItem(k, v) {
          if (++writes === failAt) throw new Error('crash');
          storage.setItem(k, v);
        },
      };
      expect(writeTwoPhase(flaky, slotKey(1), first).ok).toBe(false);
      recoverInterrupted(storage, content);
      expect(readSlotText(storage, 1, content)?.readable).toBe(true);
      expect(storage.getItem(tmpKey(slotKey(1)))).toBeNull();
    }
  });
});

describe('.bak restore, corrupt JSON and versions', () => {
  test('the previous write is kept in .bak and restores a slot that later fails to parse', () => {
    const { store, storage } = started();
    store.shell.save(1);
    store.shell.save(1);
    storage.setItem(slotKey(1), '{"kind":"run","vers');
    store.shell.deleteSlot(3); // bumps the slot cache
    expect(store.shell.listSlots()[0]).toMatchObject({ slot: 1, status: 'corrupted', hasBackup: true });
    expect(store.shell.restoreSlot(1)).toEqual({ ok: true });
    expect(store.shell.listSlots()[0]?.status).toBe('ok');
  });

  test('a damaged slot with a damaged backup offers no restore and exports its raw text', () => {
    const { store, storage } = started();
    store.shell.save(2);
    storage.setItem(slotKey(2), 'not json at all');
    storage.setItem(bakKey(slotKey(2)), '{}');
    store.shell.deleteSlot(3);
    expect(store.shell.listSlots()[1]).toMatchObject({ status: 'corrupted', hasBackup: false });
    expect(store.shell.restoreSlot(2).ok).toBe(false);
    expect(store.shell.exportSlot(2)).toEqual({ text: 'not json at all', fileName: 'aethelgard-run-slot2-unknown-time.json', readable: false });
  });

  test('a newer save version is refused with an update hint; an older one with no migration is refused too', () => {
    const { store } = started();
    const file = JSON.parse(store.shell.exportSave()) as object;
    const newer = previewRunImport(JSON.stringify({ ...file, version: 99 }), content);
    expect(newer.ok).toBe(false);
    expect(newer.ok ? '' : newer.error).toMatch(/newer version of the game/);
    const older = previewRunImport(JSON.stringify({ ...file, version: 0 }), content);
    expect(older.ok).toBe(false);
    expect(older.ok ? '' : older.error).toMatch(/too old to open/);
  });

  test('a slot holding a future version is listed as damaged, not loaded', () => {
    const { store, storage } = started();
    const file = JSON.parse(store.shell.exportSave()) as object;
    storage.setItem(slotKey(3), JSON.stringify({ ...file, version: 7 }));
    store.shell.deleteSlot(2);
    expect(store.shell.listSlots()[2]).toMatchObject({ slot: 3, status: 'corrupted' });
    expect(store.shell.load(3).ok).toBe(false);
  });
});

describe('export and import through a slot', () => {
  test('export a slot, import it into another: the same save, the running game untouched', () => {
    const { store, storage } = started();
    store.shell.save(1);
    const out = store.shell.exportSlot(1)!;
    expect(out.readable).toBe(true);
    expect(out.fileName).toBe('aethelgard-run-slot1-20261017-0905.json');
    expect(out.text).toContain('\n  '); // pretty-printed
    const preview = store.shell.previewImport(out.text);
    expect(preview.ok && preview.preview.summary.title).toMatch(/^Loop 1 · Day 1 · /);
    const state = store.getState();
    expect(store.shell.importToSlot(out.text, 3)).toEqual({ ok: true });
    expect(store.getState()).toBe(state);
    expect(store.shell.listSlots()[2]).toMatchObject({ slot: 3, status: 'ok', savedAt: NOW });
    expect(JSON.parse(storage.getItem(slotKey(3))!)).toEqual(JSON.parse(storage.getItem(slotKey(1))!));
  });

  test('import refusals leave the slot alone and say why', () => {
    const { store, storage } = started();
    store.shell.save(2);
    const before = storage.getItem(slotKey(2));
    const cases: [string, RegExp][] = [
      ['{"kind":', /not valid JSON/],
      ['[]', /not a JSON object/],
      ['{"kind":"run","version":1}', /./],
      [store.shell.exportProfile(), /./],
      ['x'.repeat(1_000_001), /too large/],
    ];
    for (const [text, why] of cases) {
      const result = store.shell.importToSlot(text, 2);
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.error).toMatch(why);
    }
    expect(storage.getItem(slotKey(2))).toBe(before);
  });

  test('an import into a full storage reports it and offers the export way out; nothing is left half-written', () => {
    const big = memoryStorage();
    const { store } = started(big);
    store.shell.save(1);
    const text = store.shell.exportSlot(1)!.text;
    const used = big.keys().reduce((n, k) => n + k.length + (big.getItem(k) ?? '').length, 0);
    const tight = memoryStorage(Object.fromEntries(big.keys().map((k) => [k, big.getItem(k)!])), used + 50);
    const full = make(tight);
    const result = full.shell.importToSlot(text, 2);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toMatch(/storage is full.*Export/s);
    expect(tight.getItem(slotKey(2))).toBeNull();
    expect(tight.getItem(tmpKey(slotKey(2)))).toBeNull();
  });

  test('no storage: nothing exports and nothing imports', () => {
    const store = createGameStore(content, freshProfile('p1'), { storage: null });
    expect(store.shell.exportSlot(1)).toBeNull();
    expect(store.shell.importToSlot('{}', 1).ok).toBe(false);
  });

  test('writeRunToSlot keeps the old slot as .bak and refuses garbage', () => {
    const { store, storage } = started();
    store.shell.save(1);
    const old = storage.getItem(slotKey(1))!;
    const text = store.shell.exportSlot(1)!.text;
    expect(writeRunToSlot(storage, 1, text, content)).toEqual({ ok: true });
    expect(storage.getItem(bakKey(slotKey(1)))).toBe(old);
    expect(writeRunToSlot(storage, 1, 'nope', content).ok).toBe(false);
  });
});

describe('the profile survives a bad write', () => {
  test('a failed profile write keeps the previous one', () => {
    const storage = memoryStorage();
    const profile = freshProfile('p1');
    expect(saveProfile(storage, profile)).toEqual({ ok: true });
    const prior = storage.getItem(PROFILE_KEY)!;
    const tight = memoryStorage(Object.fromEntries(storage.keys().map((k) => [k, storage.getItem(k)!])), prior.length + PROFILE_KEY.length + 20);
    expect(saveProfile(tight, { ...profile, echoes: ['echo_a'.repeat(50)] }).ok).toBe(false);
    expect(tight.getItem(PROFILE_KEY)).toBe(prior);
  });
});
