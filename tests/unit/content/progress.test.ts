// D-090: while the real pack is authored region by region, a reference into a table still being authored (INCOMPLETE_TABLES)
// is a pending warning, not an error — for the authored tables only. Test packs stay fully resolved.
import { describe, expect, test } from 'bun:test';
import { ContentError, buildContentPack, contentTables, parseContentPack, type ContentTables } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { validateContent } from '@content/validate';
import { TABLE_NAMES } from '@schema/contentPack';
import { main } from '../../../tools/validate-content';

/** The authored tables without the Rusty Dagger, which a class's starting kit names. */
const withoutDagger = (): Partial<ContentTables> => ({ ...contentTables, items: contentTables.items.filter((i) => i.id !== 'item_rusty_dagger') });
const daggerIssue = (messages: readonly string[]) => messages.filter((m) => m.includes("'item_rusty_dagger' not found in items"));

describe('INCOMPLETE_TABLES', () => {
  test('names real tables, once each; the finished shared tables are not on it', () => {
    for (const t of INCOMPLETE_TABLES) expect(TABLE_NAMES).toContain(t);
    expect(new Set(INCOMPLETE_TABLES).size).toBe(INCOMPLETE_TABLES.length);
    for (const done of ['classes', 'statuses', 'affixes', 'abilities'] as const) expect(INCOMPLETE_TABLES).not.toContain(done);
  });
});

describe('validateContent({ incompleteTables })', () => {
  const { pack } = parseContentPack(withoutDagger(), { validate: false });

  test('a dangling reference into an incomplete table is a pending warning, not an error', () => {
    const report = validateContent(pack, { incompleteTables: ['items'] });
    expect(daggerIssue(report.errors.map((e) => e.message))).toEqual([]);
    const pending = daggerIssue(report.warnings.map((w) => w.message));
    expect(pending.length).toBeGreaterThan(0);
    for (const m of pending) expect(m.startsWith('pending — content not yet authored (reference): ')).toBe(true);
  });

  test('into a complete table it stays an error', () => {
    expect(daggerIssue(validateContent(pack, {}).errors.map((e) => e.message)).length).toBeGreaterThan(0);
    expect(daggerIssue(validateContent(pack, { incompleteTables: ['quests'] }).errors.map((e) => e.message)).length).toBeGreaterThan(0);
  });
});

describe('the real pack uses INCOMPLETE_TABLES by default; other packs do not', () => {
  test('buildContentPack() builds the authored tables; an explicit incompleteTables relaxes a test pack the same way', () => {
    expect(() => buildContentPack()).not.toThrow();
    // a copy of the tables is not the authored set: every dangling reference is an error (the dagger's among the region
    // files' pending ones, U42), and `incompleteTables` relaxes exactly the tables it names
    const thrown = (() => {
      try {
        buildContentPack(withoutDagger());
        return null;
      } catch (e) {
        return e as ContentError;
      }
    })();
    expect(thrown).toBeInstanceOf(ContentError);
    expect(daggerIssue(thrown?.report.errors.map((e) => e.message) ?? []).length).toBeGreaterThan(0);
    expect(() => buildContentPack(withoutDagger(), { incompleteTables: ['items'] })).toThrow(ContentError);
    // (U50 completed the items table, so the dagger is no longer a pending reference: relaxing it takes 'items' as well)
    expect(() => buildContentPack(withoutDagger(), { incompleteTables: [...INCOMPLETE_TABLES, 'items'] })).not.toThrow();
  });

  test('the validate CLI: the authored tables report pending references; a test table set stays strict', () => {
    const out: string[] = [];
    expect(main([], (l) => out.push(l))).toBe(0);
    expect(out.join('\n')).toMatch(/\d+ pending reference\(s\) \(\d+ table\(s\) still being authored\)/);

    const strictOut: string[] = [];
    expect(main(['--lenient'], (l) => strictOut.push(l), withoutDagger())).toBe(1);
    expect(strictOut.join('\n')).toContain("'item_rusty_dagger' not found in items");
  });
});
