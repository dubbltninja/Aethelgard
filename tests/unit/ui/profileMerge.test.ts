// DESIGN §14.3: a profile import merges by default (set-union, max of mastery, capped Resonance) or replaces.
import { describe, expect, test } from 'bun:test';
import { memoryStorage, type Profile } from '@engine/index';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { mergeProfiles } from '@ui/store/profileMerge';
import { fixturePack } from '@tests/fixtures/miniContent';

function profile(id: string, patch: Partial<Profile> = {}): Profile {
  return { ...freshProfile(id), ...patch };
}

const mastery = (loopsPlayed: number, bestLevel: number, bestDays: number | null, mastered: string[] = [], endings: string[] = []) => ({ loopsPlayed, mastered, endings, bestLevel, bestDays });

describe('mergeProfiles', () => {
  test('lists are unions, counters take the larger, knowledge the deeper', () => {
    const a = profile('a', {
      echoes: ['e1', 'e2'],
      codexUnlocked: ['c1'],
      mapKnowledge: ['l1'],
      loopCounter: 2,
      newGamePlus: 0,
      bestiary: { cr_x: { seen: 3, killed: 1, spared: 0, revealed: 'resist', intentsSeen: ['m1'] } },
      classMastery: { ranger: mastery(1, 7, 20, ['r1'], ['end_a']) },
      lastClassId: null,
    });
    const b = profile('b', {
      echoes: ['e2', 'e3'],
      codexUnlocked: ['c2'],
      mapKnowledge: ['l2'],
      loopCounter: 4,
      newGamePlus: 1,
      bestiary: { cr_x: { seen: 2, killed: 5, spared: 1, revealed: 'all', intentsSeen: ['m2'] }, cr_y: { seen: 1, killed: 0, spared: 0, revealed: 'none', intentsSeen: [] } },
      classMastery: { ranger: mastery(3, 5, 14, ['r2'], ['end_a', 'end_b']), wizard: mastery(1, 2, null) },
      lastClassId: 'wizard',
    });
    const m = mergeProfiles(a, b);
    expect(m.echoes).toEqual(['e1', 'e2', 'e3']);
    expect(m.codexUnlocked).toEqual(['c1', 'c2']);
    expect(m.mapKnowledge).toEqual(['l1', 'l2']);
    expect([m.loopCounter, m.newGamePlus]).toEqual([4, 1]);
    expect(m.bestiary.cr_x).toEqual({ seen: 3, killed: 5, spared: 1, revealed: 'all', intentsSeen: ['m1', 'm2'] });
    expect(Object.keys(m.bestiary)).toEqual(['cr_x', 'cr_y']);
    expect(m.classMastery.ranger).toEqual({ loopsPlayed: 3, mastered: ['r1', 'r2'], endings: ['end_a', 'end_b'], bestLevel: 7, bestDays: 14 });
    expect(m.classMastery.wizard?.bestDays).toBeNull();
    expect(m.lastClassId).toBe('wizard');
  });

  test('an achievement earned in both keeps the earlier; run history merges by run id', () => {
    const run = (runId: string) => ({ runId, seed: 's', loop: 1, classId: 'ranger', outcome: 'closer_escape', daysUsed: 5, level: 3, echoesGained: [], questsCompleted: [], tyrant: 'untouched' as const, heartstone: 'none', modifiers: [], summary: '' });
    const a = profile('a', { achievements: { x: { loop: 2, day: 4, runId: 'r2' } }, runHistory: [run('r1')] });
    const b = profile('b', { achievements: { x: { loop: 1, day: 9, runId: 'r1' }, y: { loop: 3, day: 1, runId: 'r3' } }, runHistory: [run('r1'), run('r2')] });
    const m = mergeProfiles(a, b);
    expect(m.achievements.x?.runId).toBe('r1');
    expect(Object.keys(m.achievements)).toEqual(['x', 'y']);
    expect(m.runHistory.map((r) => r.runId)).toEqual(['r1', 'r2']);
  });

  test('Resonance adds up but never beyond what both profiles earned; the same profile counts once', () => {
    const a = profile('a', { resonance: 40, resonanceEarnedTotal: 50 });
    const b = profile('b', { resonance: 30, resonanceEarnedTotal: 35 });
    expect(mergeProfiles(a, b)).toMatchObject({ resonance: 70, resonanceEarnedTotal: 85 });
    const c = profile('c', { resonance: 90, resonanceEarnedTotal: 50 }); // a figure that exceeds its sources is capped
    expect(mergeProfiles(a, c)).toMatchObject({ resonance: 100, resonanceEarnedTotal: 100 });
    const back = mergeProfiles(a, { ...a, resonance: 45, resonanceEarnedTotal: 60 });
    expect(back).toMatchObject({ resonance: 45, resonanceEarnedTotal: 60 });
  });

  test('settings, the profile id, the modifiers and the equipped attunements stay the current profile’s', () => {
    const a = profile('a', { modifiers: { m1: true }, attunements: { owned: ['t1'], equipped: ['t1'] }, settings: { ...freshProfile('a').settings, textScale: 1.5 } });
    const b = profile('b', { modifiers: { m2: true }, attunements: { owned: ['t2'], equipped: ['t2'] }, lastDeathLocation: 'loc_z' });
    const m = mergeProfiles(a, b);
    expect(m.profileId).toBe('a');
    expect(m.settings.textScale).toBe(1.5);
    expect(m.modifiers).toEqual({ m1: true });
    expect(m.attunements).toEqual({ owned: ['t1', 't2'], equipped: ['t1'] });
    expect(m.lastDeathLocation).toBe('loc_z');
  });

  test('merging does not mutate either side', () => {
    const a = profile('a', { echoes: ['e1'] });
    const b = profile('b', { echoes: ['e2'] });
    const snapshot = JSON.stringify([a, b]);
    mergeProfiles(a, b);
    expect(JSON.stringify([a, b])).toBe(snapshot);
  });
});

describe('store.shell.importProfile modes', () => {
  const content = fixturePack();
  const make = (id: string, patch: Partial<Profile> = {}) => createGameStore(content, profile(id, patch), { storage: memoryStorage(), rethrow: false, report: () => undefined });

  test('merge is chosen on request and keeps this browser’s settings and id; replace swaps the file in', () => {
    const source = make('src', { echoes: ['e9'], settings: { ...freshProfile('x').settings, highContrast: true } });
    const text = source.shell.exportProfile();
    const merged = make('mine', { echoes: ['e1'] });
    expect(merged.shell.importProfile(text, 'merge')).toEqual({ ok: true });
    expect(merged.getProfile()).toMatchObject({ profileId: 'mine', echoes: ['e1', 'e9'] });
    expect(merged.getProfile().settings.highContrast).toBe(false);
    const replaced = make('mine', { echoes: ['e1'] });
    expect(replaced.shell.importProfile(text, 'replace')).toEqual({ ok: true });
    expect(replaced.getProfile()).toMatchObject({ profileId: 'src', echoes: ['e9'] });
    expect(replaced.getProfile().settings.highContrast).toBe(true);
  });

  test('a run save is refused as a profile, and nothing changes', () => {
    const store = make('mine');
    const before = store.getProfile();
    expect(store.shell.importProfile('{"kind":"run","version":1}', 'merge').ok).toBe(false);
    expect(store.getProfile()).toBe(before);
  });
});
