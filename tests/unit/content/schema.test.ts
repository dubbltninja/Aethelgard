// U76 (PLAN §8.2 `schema.test.ts`): the real pack builds, every table parses, and the counts stand against the minimums of
// D-015 (73 locations in 12 regions), D-045 (44 story quests + 5 class mini-quests), D-020 (80+ codex entries) and the
// validator's EXPECTED_COUNTS. The floors are hard (the pack is complete since D-136); the exact snapshot of today's counts is
// soft (`soft()` collects and reports a drift, failing only under RELEASE_GATE=1), so a balance unit that adds an item or a
// recipe is told, not blocked.
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, formatIssue, parseContentPack } from '@content/index';
import { EXPECTED_COUNTS } from '@content/validate';
import { TABLE_NAMES } from '@schema/contentPack';
import { soft } from '@tests/fixtures/soft';

const pack = buildContentPack();
const count = (table: (typeof TABLE_NAMES)[number]): number => Object.keys(pack[table]).length;

/** Today's counts (D-136). A change is a notice, not a failure, until the release gate. */
const SNAPSHOT = {
  regions: 12,
  locations: 73,
  creatures: 73,
  items: 157,
  recipes: 31,
  abilities: 107,
  classes: 5,
  statuses: 19,
  quests: 49,
  dialogues: 228,
  npcs: 38,
  companions: 6,
  echoes: 103,
  codex: 90,
  achievements: 40,
  attunements: 15,
  modifiers: 6,
  endings: 8,
  merchants: 8,
  affixes: 12,
  encounters: 12,
  factions: 3,
} as const;

describe('the real content pack (PLAN §8.2 schema.test.ts)', () => {
  test('buildContentPack() succeeds and every table parses with no schema error', () => {
    const { report } = parseContentPack(contentTables, { validate: false });
    expect(report.errors.map(formatIssue)).toEqual([]);
    for (const name of TABLE_NAMES) expect([name, typeof pack[name]]).toEqual([name, 'object']);
  });

  test('every record is filed under its own id, in every table', () => {
    for (const name of TABLE_NAMES) {
      for (const [key, record] of Object.entries(pack[name] as Record<string, { id: string }>)) expect([name, key, record.id]).toEqual([name, key, key]);
    }
  });

  test('the snapshot covers every table the pack has', () => {
    const named = new Set(Object.keys(SNAPSHOT));
    expect(TABLE_NAMES.filter((t) => !named.has(t))).toEqual([]);
  });

  test('regions and locations: 12 regions, 73 locations (D-015), 21 of them legacy', () => {
    expect(count('regions')).toBe(EXPECTED_COUNTS.regions);
    expect(count('locations')).toBe(EXPECTED_COUNTS.locations);
    expect(Object.values(pack.locations).filter((l) => l.legacyName !== undefined)).toHaveLength(21);
    expect(Object.values(pack.regions).filter((r) => r.legacy)).toHaveLength(5);
  });

  test('quests: 44 story quests incl. the legacy six (D-045) and 5 class mini-quests', () => {
    const quests = Object.values(pack.quests);
    expect(quests.filter((q) => q.category !== 'class' && q.category !== 'stretch')).toHaveLength(EXPECTED_COUNTS.quests);
    expect(quests.filter((q) => q.category === 'class')).toHaveLength(EXPECTED_COUNTS.classQuests);
    expect(quests.filter((q) => q.legacyId !== undefined)).toHaveLength(6);
  });

  test('the floors: codex ≥ 85 (D-020 asks 80+), items ≥ 120, creatures ≥ 57 + 16 anomaly variants, 103 Echoes, 40 achievements', () => {
    expect(count('codex')).toBeGreaterThanOrEqual(EXPECTED_COUNTS.codexMin);
    expect(count('codex')).toBeGreaterThanOrEqual(80);
    expect(count('items')).toBeGreaterThanOrEqual(EXPECTED_COUNTS.itemsMin);
    const creatures = Object.values(pack.creatures);
    expect(creatures.filter((c) => c.role === 'anomaly').length).toBeGreaterThanOrEqual(EXPECTED_COUNTS.anomalies);
    expect(creatures.length).toBeGreaterThanOrEqual(EXPECTED_COUNTS.creatures + EXPECTED_COUNTS.anomalies);
    expect(count('echoes')).toBe(EXPECTED_COUNTS.echoes);
    expect(count('achievements')).toBe(EXPECTED_COUNTS.achievements);
  });

  test('the fixed sets: 8 endings, 3 factions, 15 Attunements, 6 companions, 5 classes, 19 statuses, 6 challenge modifiers', () => {
    expect(count('endings')).toBe(EXPECTED_COUNTS.endings);
    expect(count('factions')).toBe(EXPECTED_COUNTS.factions);
    expect(count('attunements')).toBe(EXPECTED_COUNTS.attunements);
    expect(count('companions')).toBe(EXPECTED_COUNTS.companions);
    expect(count('classes')).toBe(EXPECTED_COUNTS.classes);
    expect(count('statuses')).toBe(EXPECTED_COUNTS.statuses);
    expect(count('modifiers')).toBeGreaterThanOrEqual(6);
  });

  test('abilities: 15 per class (3 branches × 5 tiers), 24 companion abilities, 8 item abilities', () => {
    const abilities = Object.values(pack.abilities);
    for (const cls of Object.values(pack.classes)) {
      expect([cls.id, abilities.filter((a) => a.ownerId === cls.id).length]).toEqual([cls.id, EXPECTED_COUNTS.abilitiesPerClass]);
    }
    expect(abilities.filter((a) => a.ownerId in pack.companions)).toHaveLength(EXPECTED_COUNTS.companionAbilities);
    expect(abilities.filter((a) => a.id.startsWith('itm_'))).toHaveLength(EXPECTED_COUNTS.itemAbilities);
    expect(abilities).toHaveLength(EXPECTED_COUNTS.classAbilities + EXPECTED_COUNTS.companionAbilities + EXPECTED_COUNTS.itemAbilities);
  });

  test('every table is non-empty (D-136: every content table is complete)', () => {
    for (const name of TABLE_NAMES) expect([name, count(name) > 0]).toEqual([name, true]);
  });

  test('soft: the exact counts are today\'s (D-136) — drift is reported, not fatal, until RELEASE_GATE=1', () => {
    for (const [table, expected] of Object.entries(SNAPSHOT)) {
      soft(`schema count ${table}`, () => expect([table, count(table as (typeof TABLE_NAMES)[number])]).toEqual([table, expected]));
    }
  });
});
