// U79: the save format frozen at `version: 1` (D-058, DESIGN §14.1, §14.4; PLAN §4.12).
//
// - Golden files: `golden/*.json` were written once from real-pack play at the U79 checkpoint (a Loop 1 mid-run, a Loop 2
//   run, and the profile that run built, with its Echoes and codex) and are NEVER re-recorded. A later format change bumps
//   SAVE_VERSION / PROFILE_VERSION and adds a migration; these tests then require the v1 files to migrate and load.
// - An unversioned (pre-checkpoint) file is read as v1 when it has v1's shape, else refused in a sentence that says why.
// - A file from a future version is refused, without throwing, through every door: deserialize, the profile, `load`.
import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { buildContentPack } from '@content/index';
import {
  FIRST_FROZEN_VERSION,
  PROFILE_VERSION,
  SAVE_VERSION,
  UNVERSIONED,
  deserialize,
  deserializeProfile,
  legalActions,
  migrations,
  newRun,
  profileMigrations,
  serialize,
  serializeProfile,
  step,
  type DeserializeResult,
  type GameState,
  type LoadedRun,
  type Profile,
  type SaveFile,
} from '@engine/index';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';
import { del, set, type Obj } from './json';

const real = buildContentPack();
const mini = fixturePack();
const GOLDEN = path.join(import.meta.dirname, 'golden');
const golden = (name: string): Obj => JSON.parse(readFileSync(path.join(GOLDEN, name), 'utf8')) as Obj;
const RUNS = { loop1: 'v1-run-loop1-midrun.json', loop2: 'v1-run-loop2.json' } as const;
const PROFILE = 'v1-profile-echoes-codex.json';

const loaded = (r: DeserializeResult): LoadedRun => {
  if ('error' in r) throw new Error(`expected a loaded run, got: ${r.error}`);
  return r;
};
const errorOf = (r: DeserializeResult | ReturnType<typeof deserializeProfile>): string => {
  if (!('error' in r)) throw new Error('expected a refusal, but it loaded');
  return r.error;
};
const profileOf = (r: ReturnType<typeof deserializeProfile>): Profile => {
  if ('error' in r) throw new Error(`expected a profile, got: ${r.error}`);
  return r.profile;
};
/** Only the content-version note is expected when the pack moved on; a dropped id would mean content lost something. */
const onlyVersionNotes = (warnings: readonly string[]): void => {
  for (const w of warnings) expect(w).toMatch(/^saved with content /);
};
const titleOf = (content = real): GameState => ({ ...newRun('golden-title', 'ranger', content, freshProfile()), mode: 'title' });

describe('the migration framework (D-058)', () => {
  test('v1 is the first frozen version and both tables are empty today', () => {
    expect(SAVE_VERSION).toBe(1);
    expect(PROFILE_VERSION).toBe(1);
    expect(FIRST_FROZEN_VERSION).toBe(1);
    expect(Object.keys(migrations)).toEqual([]);
    expect(Object.keys(profileMigrations)).toEqual([]);
  });

  test('every version from the first frozen one up to the current one has its step (a bump without a migration fails here)', () => {
    for (let v = FIRST_FROZEN_VERSION; v < SAVE_VERSION; v++) expect(typeof migrations[v]).toBe('function');
    for (let v = FIRST_FROZEN_VERSION; v < PROFILE_VERSION; v++) expect(typeof profileMigrations[v]).toBe('function');
  });
});

describe('golden v1 files (never re-recorded)', () => {
  test('the golden directory holds exactly the three checkpoint files', () => {
    expect(readdirSync(GOLDEN).sort()).toEqual([RUNS.loop1, RUNS.loop2, PROFILE].sort());
  });

  for (const [which, name] of Object.entries(RUNS)) {
    describe(name, () => {
      const file = golden(name);
      const out = loaded(deserialize(file, real));

      test('is a v1 file, and loads on this build (migrated if the format moved on)', () => {
        expect(file.version).toBe(1);
        expect(out.migratedFrom).toBe(SAVE_VERSION === 1 ? null : 1);
        onlyVersionNotes(out.warnings);
        expect(out.state.meta.loop).toBe(which === 'loop1' ? 1 : 2);
        expect(out.state.mode).toBe('explore');
      });

      test('round-trips: serialize(deserialize(file)) is the file again', () => {
        const again = serialize(out.state, { loopCounter: out.file.profileLoopAtSave }, real, out.file.savedAt);
        if (SAVE_VERSION === 1) expect(JSON.parse(JSON.stringify(again))).toEqual({ ...file, contentVersion: real.version, summary: again.summary });
        expect(again.summary).toEqual(out.file.summary);
        expect(loaded(deserialize(JSON.parse(JSON.stringify(again)), real)).state).toEqual(out.state);
      });

      test('resumes through the `load` action and plays on', () => {
        const res = step(titleOf(), { type: 'load', save: file }, real, freshProfile({ loopCounter: out.file.profileLoopAtSave }));
        expect(res.events.find((e) => e.t === 'actionRejected')).toBeUndefined();
        expect(res.events).toContainEqual({ t: 'saveLoaded', version: SAVE_VERSION, migratedFrom: out.migratedFrom });
        expect(res.state.world.currentLocationId).toBe(out.state.world.currentLocationId);
        const next = legalActions(res.state, real, freshProfile()).find((a) => a.type === 'rest' || a.type === 'wait' || a.type === 'move');
        expect(next).toBeDefined();
        const after = step(res.state, next as NonNullable<typeof next>, real, freshProfile());
        expect(after.events.find((e) => e.t === 'actionRejected')).toBeUndefined();
      });
    });
  }

  describe(PROFILE, () => {
    const file = golden(PROFILE);
    const profile = profileOf(deserializeProfile(file));

    test('is a v1 profile with Echoes, codex entries and a run behind it', () => {
      expect(file.version).toBe(1);
      expect(profile.echoes.length).toBeGreaterThan(0);
      expect(profile.codexUnlocked.length).toBeGreaterThan(0);
      expect(profile.runHistory.length).toBeGreaterThan(0);
      expect(profile.loopCounter).toBe(2);
      for (const id of profile.echoes) expect(real.echoes[id]).toBeDefined();
      for (const id of profile.codexUnlocked) expect(real.codex[id]).toBeDefined();
    });

    test('round-trips', () => {
      if (PROFILE_VERSION === 1) expect(JSON.parse(JSON.stringify(serializeProfile(profile)))).toEqual(file);
      expect(profileOf(deserializeProfile(JSON.parse(JSON.stringify(serializeProfile(profile)))))).toEqual(profile);
    });

    test('drives the Loop 2 golden run: the run loads under it', () => {
      const res = step(titleOf(), { type: 'load', save: golden(RUNS.loop2) }, real, profile);
      expect(res.events.find((e) => e.t === 'actionRejected')).toBeUndefined();
      expect(res.state.meta.loop).toBe(2);
    });
  });
});

describe('unversioned (pre-checkpoint) files', () => {
  const v1File = (): Obj => JSON.parse(JSON.stringify(serialize(makeState({ level: 4 }), freshProfile(), mini, '2026-10-01T00:00:00Z'))) as Obj;
  const unversioned = (mutate?: (f: Obj) => void): Obj => {
    const f = v1File();
    del(f, 'version');
    mutate?.(f);
    return f;
  };
  const REFUSAL = /^Save rejected: this save has no version number, so it comes from a build made before the save format was frozen at v1, and it does not fit that format \(/;

  test('one with exactly v1’s shape is safe: it loads as v1, marked as migrated from UNVERSIONED', () => {
    const out = loaded(deserialize(unversioned(), mini));
    expect(UNVERSIONED).toBe(0);
    expect(out.migratedFrom).toBe(UNVERSIONED);
    expect(out.file.version).toBe(1);
    expect(out.state).toEqual(loaded(deserialize(v1File(), mini)).state);
    const viaText = loaded(deserialize(JSON.stringify(unversioned()), mini));
    expect(viaText.migratedFrom).toBe(UNVERSIONED);
  });

  test('the `load` action reports where it came from', () => {
    const res = step(titleOf(mini), { type: 'load', save: unversioned() }, mini, freshProfile());
    expect(res.events).toContainEqual({ t: 'saveLoaded', version: 1, migratedFrom: UNVERSIONED });
  });

  test('one with an older layout is refused, saying why and naming the fields', () => {
    const renamed = unversioned((f) => {
      const player = (f.state as Obj).player as Obj;
      player.health = player.hp;
      delete player.hp;
    });
    const text = errorOf(deserialize(renamed, mini));
    expect(text).toMatch(REFUSAL);
    expect(text).toContain('state.player.hp: is missing (expected number)');
    expect(text).toContain("state.player: unknown field 'health'");
    expect(errorOf(deserialize(unversioned((f) => del(f, 'summary')), mini))).toMatch(REFUSAL);
    expect(errorOf(deserialize(unversioned((f) => set(f, 'state.meta.version', 0)), mini))).toMatch(
      /^Save rejected: this save has no version number, .*\(state\.meta\.version: expected 1, got 0/,
    );
    expect(errorOf(deserialize({ hello: 'world' }, mini))).toMatch(REFUSAL);
  });

  test('a refused unversioned save through `load` is an actionRejected, not a throw', () => {
    const res = step(titleOf(mini), { type: 'load', save: unversioned((f) => del(f, 'state')) }, mini, freshProfile());
    expect(res.events).toHaveLength(1);
    expect(res.events[0]).toMatchObject({ t: 'actionRejected' });
    expect(JSON.stringify(res.events[0])).toContain('has no version number');
  });

  test('profiles follow the same rule', () => {
    const file = JSON.parse(JSON.stringify(serializeProfile(freshProfile({ loopCounter: 3 })))) as Obj;
    del(file, 'version');
    const ok = deserializeProfile(file);
    expect(profileOf(ok).loopCounter).toBe(3);
    expect('error' in ok ? null : ok.migratedFrom).toBe(UNVERSIONED);
    del(file, 'profile.echoes');
    expect(errorOf(deserializeProfile(file))).toMatch(
      /^Profile rejected: this profile has no version number, so it comes from a build made before the save format was frozen at v1, and it does not fit that format \(profile\.echoes: is missing/,
    );
  });

  test('a versioned file that fails the schema keeps the plain message (the pre-checkpoint sentence is only for unversioned files)', () => {
    const f = v1File();
    del(f, 'summary');
    expect(errorOf(deserialize(f, mini))).toBe('Save rejected: summary: is missing (expected object)');
  });
});

describe('future versions are refused without crashing', () => {
  const future = SAVE_VERSION + 1;
  const NEWER = new RegExp(`written by a newer version of the game \\(file v${future}, this build reads up to v${SAVE_VERSION}\\); update the game to open it`);

  test('deserialize: a future run save, even with a body this build cannot read', () => {
    const file = JSON.parse(JSON.stringify(golden(RUNS.loop1))) as SaveFile & Obj;
    expect(errorOf(deserialize({ ...file, version: future }, real))).toMatch(NEWER);
    expect(errorOf(deserialize({ kind: 'run', version: future, state: null, somethingNew: [1, 2, 3] }, real))).toMatch(NEWER);
    expect(errorOf(deserialize(JSON.stringify({ kind: 'run', version: 1e9 }), real))).toMatch(/file v1000000000, this build reads up to v1/);
  });

  test('the profile', () => {
    const file = { ...golden(PROFILE), version: PROFILE_VERSION + 1 };
    expect(errorOf(deserializeProfile(file))).toMatch(/^Profile rejected: version: this profile was written by a newer version of the game/);
    expect(errorOf(deserializeProfile({ kind: 'profile', version: 7, profile: 'from the future' }))).toMatch(/newer version/);
  });

  test('the `load` action: rejected with the reason, the title state untouched', () => {
    const title = titleOf();
    const res = step(title, { type: 'load', save: { ...golden(RUNS.loop2), version: future } }, real, freshProfile());
    expect(res.events).toHaveLength(1);
    expect(res.events[0]).toMatchObject({ t: 'actionRejected' });
    expect(JSON.stringify(res.events[0])).toMatch(/newer version of the game/);
    expect(res.state.mode).toBe('title');
  });
});
