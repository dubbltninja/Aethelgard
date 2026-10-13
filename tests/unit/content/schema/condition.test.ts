// U14: the canonical Condition schema (DESIGN §13.3, PLAN §4.9). Every atom has a valid sample that parses and
// invalid samples that fail with a message naming the atom/path.
import { describe, expect, test } from 'bun:test';
import { CONDITION_KEYS, ConditionSchema, VariantText, type Condition, type ConditionKey } from '@schema/condition';

const issues = (value: unknown): string[] => {
  const r = ConditionSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

/** One valid sample per atom (typed: tsc fails if an atom is missing or the shape is wrong). */
const VALID: { [K in ConditionKey]: Condition[] } = {
  all: [{ all: [] }, { all: [{ flag: 'flag_a' }, { not: { echo: 'echo_b' } }] }],
  any: [{ any: [{ loop: { min: 2 } }] }],
  not: [{ not: { any: [{ flag: 'flag_a' }, { all: [{ day: { max: 3 } }] }] } }],
  flag: [{ flag: 'flag_ilyra_told' }],
  echo: [{ echo: 'echo_litany_verse_1' }],
  quest: [
    { quest: { id: 'q_clear_path' } },
    { quest: { id: 'q_clear_path', status: 'failed' } },
    { quest: { id: 'q_clear_path', stage: 'done', status: 'completed' } },
  ],
  item: [{ item: { id: 'item_chronos_lens' } }, { item: { id: 'mat_ember_ore', count: 3 } }],
  rep: [{ rep: { faction: 'weavers', min: 20 } }, { rep: { faction: 'ironclad', min: -9, max: 19 } }],
  loop: [{ loop: { min: 2 } }],
  day: [{ day: { min: 5, max: 9 } }],
  level: [{ level: { max: 10 } }],
  watch: [{ watch: 'night' }],
  clock: [{ clock: { daysLeft: { max: 1 } } }],
  beforeDay: [{ beforeDay: 1 }, { beforeDay: 3 }],
  beforeResets: [{ beforeResets: { min: 3 } }],
  class: [{ class: 'shadow_weaver' }],
  stat: [{ stat: { name: 'magic', min: 12 } }],
  companion: [{ companion: { id: 'mireya' } }, { companion: { id: 'brak', state: 'ko' } }],
  loyalty: [{ loyalty: { companion: 'mireya', min: 25 } }],
  corruption: [{ corruption: { min: 3 } }],
  location: [{ location: 'loc_cistern_gardens' }],
  killed: [{ killed: { id: 'cr_wildling_brute', count: 1, sinceStage: true } }],
  counter: [{ counter: { name: 'quests_completed', min: 6 } }],
  resolve: [{ resolve: { min: 8 } }],
  modifier: [{ modifier: 'mod_frayed_clock' }],
};

/** Invalid samples per atom, with a fragment of the expected message. */
const INVALID: { [K in ConditionKey]: [unknown, string][] } = {
  all: [[{ all: { flag: 'flag_a' } }, 'all: Expected array']],
  any: [[{ any: [] }, '`any` needs at least one condition'], [{ any: [{ flags: 'flag_a' }] }, "any.0.flags: unknown condition atom 'flags'"]],
  not: [[{ not: [] }, 'not: a condition is an object']],
  flag: [[{ flag: 'ilyra_told' }, 'flag: expected an id with prefix flag_']],
  echo: [[{ echo: 'echo.x' }, 'echo: expected an id with prefix echo_']],
  quest: [
    [{ quest: 'q_clear_path' }, 'quest: Expected object'],
    [{ quest: { id: 'quest_x' } }, 'quest.id: expected an id with prefix q_'],
    [{ quest: { id: 'q_x', status: 'done' } }, 'quest.status: Invalid enum value'],
    [{ quest: { id: 'q_x', stag: 'a' } }, "quest: Unrecognized key(s) in object: 'stag'"],
  ],
  item: [[{ item: { id: 'item_x', count: 0 } }, 'item.count'], [{ item: { id: 'potion' } }, 'item.id: expected an item id']],
  rep: [[{ rep: { faction: 'guild', min: 1 } }, 'rep.faction'], [{ rep: { faction: 'weavers', min: 5, max: 1 } }, 'min must be ≤ max']],
  loop: [[{ loop: 2 }, 'loop: Expected object'], [{ loop: { min: 3, max: 2 } }, 'range min must be ≤ max']],
  day: [[{ day: { from: 1 } }, "day: Unrecognized key(s) in object: 'from'"]],
  level: [[{ level: { min: '3' } }, 'level.min: Expected number']],
  watch: [[{ watch: 'noon' }, 'watch: Invalid enum value']],
  clock: [[{ clock: { daysLeft: 1 } }, 'clock.daysLeft: Expected object'], [{ clock: { days: { max: 1 } } }, 'Unrecognized key']],
  beforeDay: [[{ beforeDay: 4 }, 'beforeDay']],
  beforeResets: [[{ beforeResets: 3 }, 'beforeResets: Expected object']],
  class: [[{ class: 'bard' }, 'class: Invalid enum value']],
  stat: [[{ stat: { name: 'luck', min: 1 } }, 'stat.name'], [{ stat: { name: 'magic', min: 9, max: 1 } }, 'min must be ≤ max']],
  companion: [[{ companion: { id: 'npc_brak' } }, 'companion.id'], [{ companion: { id: 'brak', state: 'dead' } }, 'companion.state']],
  loyalty: [[{ loyalty: { id: 'brak', min: 1 } }, 'loyalty.companion: Required'], [{ loyalty: { companion: 'nyx', min: 9, max: 1 } }, 'min must be ≤ max']],
  corruption: [[{ corruption: 3 }, 'corruption: Expected object']],
  location: [[{ location: 'cistern_gardens' }, 'location: expected an id with prefix loc_']],
  killed: [[{ killed: { id: 'wildling_brute' } }, 'killed.id'], [{ killed: { id: 'cr_x', count: 1.5 } }, 'killed.count']],
  counter: [[{ counter: { name: '', min: 1 } }, 'counter.name'], [{ counter: { name: 'x', min: 2, max: 1 } }, 'min must be ≤ max']],
  resolve: [[{ resolve: 8 }, 'resolve: Expected object']],
  modifier: [[{ modifier: 'frayed_clock' }, 'modifier: expected an id with prefix mod_']],
};

describe('ConditionSchema', () => {
  test('the atom set is exactly DESIGN §13.3’s 25 atoms', () => {
    expect([...CONDITION_KEYS].sort()).toEqual(
      [
        'all', 'any', 'not', 'flag', 'echo', 'quest', 'item', 'rep', 'loop', 'day', 'level', 'watch', 'clock', 'beforeDay',
        'beforeResets', 'class', 'stat', 'companion', 'loyalty', 'corruption', 'location', 'killed', 'counter', 'resolve',
        'modifier',
      ].sort(),
    );
  });

  for (const key of Object.keys(VALID) as ConditionKey[]) {
    test(`${key}: valid samples parse unchanged; invalid samples fail with a useful message`, () => {
      for (const sample of VALID[key]) {
        const r = ConditionSchema.safeParse(sample);
        if (!r.success) throw new Error(`${JSON.stringify(sample)}: ${r.error.message}`);
        expect(r.data).toEqual(sample);
      }
      for (const [bad, fragment] of INVALID[key]) {
        const found = issues(bad);
        if (!found.some((m) => m.includes(fragment))) throw new Error(`${JSON.stringify(bad)} → ${JSON.stringify(found)} (wanted '${fragment}')`);
      }
    });
  }

  test('shape errors: more than one key, none, unknown atom, non-object', () => {
    expect(issues({ flag: 'flag_a', echo: 'echo_b' })[0]).toContain('exactly one key; got flag, echo (combine with { all: [...] })');
    expect(issues({})[0]).toContain('got none');
    expect(issues({ visited: 'loc_x' })[0]).toContain("visited: unknown condition atom 'visited' (expected one of: all, any, not, flag");
    expect(issues('flag_a')[0]).toContain('a condition is an object with exactly one key');
    expect(issues(null)).toHaveLength(1);
  });

  test('nested errors carry the full path', () => {
    expect(issues({ all: [{ flag: 'flag_a' }, { not: { quest: { id: 'q_x', status: 'won' } } }] })).toEqual([
      "all.1.not.quest.status: Invalid enum value. Expected 'inactive' | 'active' | 'completed' | 'failed', received 'won'",
    ]);
  });

  test('withdrawn atoms of the earlier draft are rejected (PLAN §4.9)', () => {
    for (const atom of ['visited', 'gold', 'eventFired', 'equipped', 'hpPct', 'always', 'never', 'achievement']) {
      expect(issues({ [atom]: true })[0]).toContain(`unknown condition atom '${atom}'`);
    }
  });
});

describe('VariantText', () => {
  test('variants default to [] and each `when` is a Condition', () => {
    expect(VariantText.parse({ text: 'The ruins hum.' })).toEqual({ text: 'The ruins hum.', variants: [] });
    expect(VariantText.safeParse({ text: 'x', variants: [{ when: { loop: { min: 2 } }, text: 'Again.' }] }).success).toBe(true);
    const bad = VariantText.safeParse({ text: 'x', variants: [{ when: { loops: 2 }, text: 'y' }] });
    expect(bad.success).toBe(false);
    expect(bad.error!.issues[0]!.path).toEqual(['variants', 0, 'when', 'loops']);
  });
});
