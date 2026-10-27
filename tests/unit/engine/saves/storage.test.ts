// U22: storage keys, the storage port, the two-phase write and the slot reader (PLAN §4.12; DESIGN §14.3–14.4).
import { describe, expect, test } from 'bun:test';
import {
  MANUAL_SLOTS,
  PROFILE_KEY,
  SAVE_SLOTS,
  SETTINGS_MIRROR_KEY,
  bakKey,
  exportFileName,
  exportRun,
  isSaveSlot,
  memoryStorage,
  readRunSlot,
  restoreBackup,
  slotKey,
  slotKeys,
  slotOfKey,
  tmpKey,
  writeTwoPhase,
} from '@engine/index';
import { makeState } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';

const content = fixturePack();
const profile = { loopCounter: 1 };
const runText = (day: number): string => exportRun(makeState({ day }), profile, content, `2026-10-13T0${day}:00:00Z`);

describe('keys', () => {
  test('three manual slots, the autosave, the profile and the settings mirror', () => {
    expect(SAVE_SLOTS.map(slotKey)).toEqual(['aethelgard.run.slot1', 'aethelgard.run.slot2', 'aethelgard.run.slot3', 'aethelgard.run.auto']);
    expect(MANUAL_SLOTS).toEqual([1, 2, 3]);
    expect(PROFILE_KEY).toBe('aethelgard.profile');
    expect(SETTINGS_MIRROR_KEY).toBe('aethelgard.settings.mirror');
    expect(tmpKey(slotKey(2))).toBe('aethelgard.run.slot2.tmp');
    expect(bakKey(PROFILE_KEY)).toBe('aethelgard.profile.bak');
    expect(slotKeys('auto')).toEqual(['aethelgard.run.auto', 'aethelgard.run.auto.tmp', 'aethelgard.run.auto.bak']);
  });

  test('all keys are distinct and slotOfKey inverts slotKey (and refuses everything else)', () => {
    const all = [...SAVE_SLOTS.flatMap(slotKeys), PROFILE_KEY, SETTINGS_MIRROR_KEY];
    expect(new Set(all).size).toBe(all.length);
    for (const slot of SAVE_SLOTS) expect(slotOfKey(slotKey(slot))).toBe(slot);
    expect(slotOfKey(bakKey(slotKey(1)))).toBeNull();
    expect(slotOfKey(PROFILE_KEY)).toBeNull();
  });

  test('isSaveSlot', () => {
    for (const ok of [1, 2, 3, 'auto']) expect(isSaveSlot(ok)).toBe(true);
    for (const bad of [0, 4, '1', 'slot1', null, undefined]) expect(isSaveSlot(bad)).toBe(false);
  });

  test('export file names carry kind, slot and the yyyymmdd-hhmm of savedAt', () => {
    expect(exportFileName('run', 1, '2026-10-09T12:00:00Z')).toBe('aethelgard-run-slot1-20261009-1200.json');
    expect(exportFileName('run', 'auto', '2026-10-09 07:05:30')).toBe('aethelgard-run-auto-20261009-0705.json');
    expect(exportFileName('profile', null, '2026-01-02T03:04:05.678+02:00')).toBe('aethelgard-profile-20260102-0304.json');
    expect(exportFileName('run', 2, 'yesterday')).toBe('aethelgard-run-slot2-unknown-time.json');
  });
});

describe('memoryStorage', () => {
  test('behaves like Storage; quota errors look like a full localStorage', () => {
    const port = memoryStorage({ a: '1' });
    expect(port.getItem('a')).toBe('1');
    expect(port.getItem('b')).toBeNull();
    port.setItem('b', '2');
    port.removeItem('a');
    expect(port.keys()).toEqual(['b']);

    const tiny = memoryStorage({}, 10);
    tiny.setItem('k', '12345'); // 6 chars
    tiny.setItem('k', '1234567'); // replacing counts the new value only: 8 chars
    expect(tiny.getItem('k')).toBe('1234567');
    expect(() => tiny.setItem('other', 'xx')).toThrow(/quota/);
    try {
      tiny.setItem('other', 'xx');
    } catch (e) {
      expect((e as Error).name).toBe('QuotaExceededError');
    }
  });
});

describe('writeTwoPhase', () => {
  const key = slotKey(1);

  test('first write: value stored, no .tmp left, no .bak yet', () => {
    const port = memoryStorage();
    expect(writeTwoPhase(port, key, runText(1))).toEqual({ ok: true });
    expect(port.keys()).toEqual([key]);
    expect(port.getItem(key)).toBe(runText(1));
  });

  test('second write keeps the previous value in .bak', () => {
    const port = memoryStorage();
    writeTwoPhase(port, key, runText(1));
    writeTwoPhase(port, key, runText(2));
    expect(port.getItem(key)).toBe(runText(2));
    expect(port.getItem(bakKey(key))).toBe(runText(1));
    expect(port.keys()).toEqual([key, bakKey(key)]);
  });

  test('a full storage leaves the slot as it was and says why', () => {
    const text = runText(1);
    const port = memoryStorage({}, text.length * 2 + 200);
    expect(writeTwoPhase(port, key, text).ok).toBe(true);
    const result = writeTwoPhase(port, key, runText(2));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(`Could not write ${key}: The quota has been exceeded.`);
    expect(port.getItem(key)).toBe(text);
    expect(port.getItem(tmpKey(key))).toBeNull();
  });

  test('a write that does not read back is refused', () => {
    const port = { ...memoryStorage(), getItem: () => 'something else' };
    const result = writeTwoPhase(port, key, runText(1));
    expect(result).toEqual({ ok: false, error: `Could not write ${key}: the written copy did not read back identically` });
  });

  test('a port that throws on everything still returns a result', () => {
    const broken = {
      getItem: () => null,
      setItem: () => { throw 'denied'; },
      removeItem: () => { throw new Error('also denied'); },
    };
    expect(writeTwoPhase(broken, key, 'x')).toEqual({ ok: false, error: `Could not write ${key}: denied` });
  });
});

describe('readRunSlot and restoreBackup', () => {
  const key = slotKey(3);

  test('empty, ok', () => {
    const port = memoryStorage();
    expect(readRunSlot(port, key, content)).toEqual({ status: 'empty' });
    writeTwoPhase(port, key, runText(4));
    const read = readRunSlot(port, key, content);
    expect(read.status).toBe('ok');
    if (read.status === 'ok') {
      expect(read.state.clock.ticks).toBe(12);
      expect(read.file.summary.day).toBe(4);
      expect(read.file.savedAt).toBe('2026-10-13T04:00:00Z');
    }
  });

  test('a damaged slot is marked corrupted, with the raw text and whether a valid backup exists', () => {
    const port = memoryStorage();
    writeTwoPhase(port, key, runText(1));
    writeTwoPhase(port, key, runText(2));
    port.setItem(key, runText(2).replace('"hp"', '"hit"'));
    const read = readRunSlot(port, key, content);
    expect(read.status).toBe('corrupted');
    if (read.status === 'corrupted') {
      expect(read.error).toMatch(/state\.player\.hp: is missing/);
      expect(read.raw).toContain('"hit"');
      expect(read.hasBackup).toBe(true);
    }
    expect(restoreBackup(port, key, content)).toBe(true);
    expect(readRunSlot(port, key, content).status).toBe('ok');
    expect(port.getItem(key)).toBe(runText(1));
  });

  test('no backup, or a corrupted one: nothing to restore', () => {
    const port = memoryStorage({ [key]: '{oops' });
    const read = readRunSlot(port, key, content);
    expect(read).toMatchObject({ status: 'corrupted', hasBackup: false, raw: '{oops' });
    expect(restoreBackup(port, key, content)).toBe(false);
    port.setItem(bakKey(key), '{also oops');
    expect(readRunSlot(port, key, content)).toMatchObject({ hasBackup: false });
    expect(restoreBackup(port, key, content)).toBe(false);
    expect(port.getItem(key)).toBe('{oops');
  });
});
