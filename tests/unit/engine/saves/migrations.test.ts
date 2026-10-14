// U22: the migration chain (PLAN §4.12, §8.1; DESIGN §14.4). Run saves ship at v1 with an empty table, so the
// mechanism is proved with test tables: a v0 → v1 fixture through `deserialize`, and a longer chain through `migrate`.
import { describe, expect, test } from 'bun:test';
import { deserialize, migrateFile, serialize, type DeserializeResult, type GameState, type MigrationTable, type PlayerState } from '@engine/index';
import { formatIssues, migrate, parseFileText, pathText } from '@engine/saves/problems';
import { z } from 'zod';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';

const content = fixturePack();

type V0State = Omit<GameState, 'player'> & { player: Omit<PlayerState, 'hp'> & { health: number } };
interface V0File {
  version: number;
  seed: string;
  profileLoop: number;
  state: V0State;
}

/** What a v0 save looked like in this test's story: no kind / summary / contentVersion / savedStep / savedAt, and the
 *  hit points under a different name. */
function v0File(): V0File {
  const { hp, ...player } = makeState({ level: 3 }).player;
  const state = { ...makeState({ level: 3 }), player: { ...player, health: hp } };
  return JSON.parse(JSON.stringify({ version: 0, seed: 'fixture', profileLoop: 2, state })) as V0File;
}

/** The v0 → v1 fixture migration: adds the envelope fields v1 requires and renames `health` to `hp`. */
const v0ToV1: TestMigration = (old) => {
  const f = old as V0File;
  const { health, ...player } = f.state.player;
  const place = f.state.world.currentLocationId;
  return {
    kind: 'run',
    seed: f.seed,
    contentVersion: 'pre-v1',
    profileLoopAtSave: f.profileLoop,
    savedAt: 'unknown',
    savedStep: f.state.meta.stepCount,
    summary: { classId: player.classId, level: player.level, loop: f.state.meta.loop, day: 1, watch: 0, locationId: place, title: 'migrated', playtimeSteps: f.state.meta.stepCount },
    state: { ...f.state, player: { ...player, hp: health } },
  };
};
type TestMigration = (old: unknown) => unknown;

const errorOf = (r: DeserializeResult): string => {
  if (!('error' in r)) throw new Error('expected an error');
  return r.error;
};

describe('v0 → v1 through deserialize', () => {
  const table: MigrationTable = { 0: v0ToV1 };

  test('the unmigrated v0 file is refused (the real table is empty), the migrated one loads', () => {
    expect(errorOf(deserialize(v0File(), content))).toMatch(/v0, which is too old to open \(no migration from v0\)/);
    const out = deserialize(v0File(), content, { migrations: table });
    if ('error' in out) throw new Error(out.error);
    expect(out.migratedFrom).toBe(0);
    expect(out.file.version).toBe(1);
    expect(out.file.profileLoopAtSave).toBe(2);
    expect(out.file.contentVersion).toBe('pre-v1');
    expect(out.state.player.level).toBe(3);
    expect(out.state.player.hp).toBe(makeState({ level: 3 }).player.hp);
    expect(out.warnings).toEqual([`saved with content pre-v1; this build has ${content.version}`]);
  });

  test('the migrated v0 state equals the same run saved natively at v1', () => {
    const native = serialize(makeState({ level: 3 }), freshProfile({ loopCounter: 2 }), content, 'unknown');
    const out = deserialize(JSON.stringify(v0File()), content, { migrations: table });
    if ('error' in out) throw new Error(out.error);
    expect(out.state).toEqual(native.state);
  });

  test('a v1 file is not migrated even when the table has entries', () => {
    const out = deserialize(serialize(makeState(), freshProfile(), content, 'now'), content, { migrations: table });
    if ('error' in out) throw new Error(out.error);
    expect(out.migratedFrom).toBeNull();
  });

  test('a migration that throws, or returns junk, becomes a readable error', () => {
    const boom = deserialize(v0File(), content, { migrations: { 0: () => { throw new Error('cannot find player.health'); } } });
    expect(errorOf(boom)).toBe('Save rejected: upgrading the save from v0 to v1 failed: cannot find player.health');
    const junk = deserialize(v0File(), content, { migrations: { 0: () => 'oops' } });
    expect(errorOf(junk)).toBe('Save rejected: upgrading the save from v0 to v1 did not produce an object');
    const nonError = deserialize(v0File(), content, { migrations: { 0: () => { throw 'plain string'; } } });
    expect(errorOf(nonError)).toMatch(/failed: plain string$/);
  });

  test('a migrated file still has to satisfy the v1 schema', () => {
    const lazy = deserialize(v0File(), content, { migrations: { 0: (old) => ({ ...(old as object), kind: 'run' }) } });
    expect(errorOf(lazy)).toMatch(/^Save rejected: contentVersion: is missing/);
  });
});

describe('migrate: the chain', () => {
  const table: MigrationTable = {
    0: (o) => ({ ...(o as object), a: 1 }),
    1: (o) => ({ ...(o as Record<string, number>), a: (o as Record<string, number>).a! + 1, b: 'two' }),
    2: (o) => ({ ...(o as object), c: true }),
  };

  test('applies each step in order, stamps the version, and reports where it started', () => {
    expect(migrate({ version: 0 }, 3, table, 'save')).toEqual({ ok: true, value: { version: 3, a: 2, b: 'two', c: true }, migratedFrom: 0 });
    expect(migrate({ version: 2 }, 3, table, 'save')).toEqual({ ok: true, value: { version: 3, c: true }, migratedFrom: 2 });
    expect(migrate({ version: 3, keep: 1 }, 3, table, 'save')).toEqual({ ok: true, value: { version: 3, keep: 1 }, migratedFrom: null });
  });

  test('a migration that forgets to bump the version still ends at the target', () => {
    const out = migrate({ version: 0 }, 2, { 0: (o) => ({ ...(o as object), version: 0 }), 1: (o) => o }, 'save');
    expect(out).toEqual({ ok: true, value: { version: 2 }, migratedFrom: 0 });
  });

  test('never mutates its input, and each step gets its own copy', () => {
    const input = { version: 0, nested: { n: 1 } };
    const out = migrate(input, 1, { 0: (o) => { (o as typeof input).nested.n = 99; return o; } }, 'save');
    expect(input).toEqual({ version: 0, nested: { n: 1 } });
    expect(out).toMatchObject({ ok: true, value: { nested: { n: 99 } } });
  });

  test('a gap in the table names the version without a migration', () => {
    const out = migrate({ version: 0 }, 3, { 0: (o) => o, 2: (o) => o }, 'profile');
    expect(out).toEqual({ ok: false, error: 'version: this profile is v0, which is too old to open (no migration from v1)' });
  });

  test('migrateFile is the same function the barrel exports', () => {
    expect(migrateFile).toBe(migrate);
  });
});

describe('error text helpers', () => {
  test('pathText', () => {
    expect(pathText([])).toBe('(file)');
    expect(pathText(['state', 'player', 'inventory', 2, 'qty'])).toBe('state.player.inventory[2].qty');
    expect(pathText([0, 'x'])).toBe('[0].x');
  });

  test('formatIssues describes each zod issue kind and removes duplicates', () => {
    const schema = z.object({ n: z.number().min(1), tag: z.enum(['a', 'b']), on: z.literal(true), pair: z.tuple([z.number(), z.number()]) }).strict();
    const bad = schema.safeParse({ n: 0, tag: 'c', on: false, pair: [1], extra: 1, more: 2 });
    if (bad.success) throw new Error('should fail');
    const text = formatIssues(bad.error.issues);
    expect(text).toContain('n: Number must be greater than or equal to 1');
    expect(text).toContain('tag: expected one of "a" | "b", got "c"');
    expect(text).toContain('on: expected true, got false');
    expect(text).toContain("(file): unknown fields 'extra', 'more'");
    const dup = formatIssues([bad.error.issues[0]!, bad.error.issues[0]!]);
    expect(dup.split('; ')).toHaveLength(1);
  });

  test('parseFileText: size, then JSON', () => {
    expect(parseFileText('{"a":1}', 'Save')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseFileText('{', 'Save')).toMatchObject({ ok: false });
    expect(parseFileText('x'.repeat(1_000_001), 'Profile')).toEqual({ ok: false, error: 'Profile file is too large (1001 kB; the limit is 1000 kB)' });
  });
});
