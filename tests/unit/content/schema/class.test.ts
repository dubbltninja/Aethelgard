// U16: ClassSchema (PLAN §5.7). All five classes' DESIGN §3.3 base stat blocks and §5.2–5.6 resources parse, and
// reproduce DESIGN's level-1 max HP/MP; per-record rules fail with clear messages.
import { describe, expect, test } from 'bun:test';
import { ClassSchema, ResourceRuleSchema, type ClassInput } from '@schema/class';

const issues = (value: unknown): string[] => {
  const r = ClassSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const expectIssue = (value: unknown, path: string, fragment: string) => {
  const found = issues(value);
  expect(found.some((i) => i.startsWith(`${path}: `) && i.includes(fragment)), `wanted "${path}: …${fragment}…", got ${JSON.stringify(found)}`).toBe(true);
};

const branch = (id: string, name: string) => ({ id, name, description: `The ${name} branch.` });

const CLASSES = [
  {
    id: 'ranger', name: 'Ranger', title: 'hunter of the wilds between settlements', legacy: true, sigil: 'ranger', dialogueTag: 'ranger',
    description: 'Good HP, honest Physical damage, and tools for every situation if you spent the points.',
    intro: 'You read the ground before the sky, carry three kinds of knife and a bow you made yourself.',
    baseStats: { hp: 100, mp: 36, strength: 10, magic: 6, agility: 8 },
    growth: { hp: 8, mp: 3 },
    resource: { name: 'Focus', rules: [{ on: 'basic_hit', amount: 8 }, { on: 'basic_crit', amount: 12 }, { on: 'guard', amount: 5 }] },
    branches: [branch('hunt', 'Hunt'), branch('steel', 'Steel'), branch('wildcraft', 'Wildcraft')],
    starterItems: [{ itemId: 'item_rusty_dagger', equip: true }, { itemId: 'item_ley_touched_tonic', count: 2 }],
    uniqueQuestId: 'q_class_ranger',
  },
  {
    id: 'wizard', name: 'Wizard', title: 'self-taught ley-caster', legacy: true, sigil: 'wizard', dialogueTag: 'wizard',
    description: 'Big pool, steady regeneration, fragile body.',
    intro: 'Nobody trained you; the Dark Spellbooks did, and they are not kind teachers.',
    baseStats: { hp: 84, mp: 50, strength: 6, magic: 11, agility: 7 },
    growth: { hp: 6, mp: 5 },
    resource: { name: 'Mana', rules: [{ on: 'turn_start', amount: 3, perLevel: { every: 4, add: 1 } }, { on: 'guard', amount: 5 }] },
    branches: [branch('pyre', 'Pyre'), branch('storm', 'Storm'), branch('chronomancy', 'Chronomancy')],
    starterItems: [{ itemId: 'item_apprentice_staff', equip: true }, { itemId: 'item_mana_bloom' }, { itemId: 'item_ley_touched_tonic' }],
    uniqueQuestId: 'q_class_wizard',
  },
  {
    id: 'elf', name: 'Elf', title: 'Silverwood-blooded ley-duelist', legacy: true, sigil: 'elf', dialogueTag: 'elf',
    description: 'Fast, evasive, and the only class that heals as naturally as it cuts.',
    intro: 'Trained to fight the way the city’s fountains moved.',
    baseStats: { hp: 90, mp: 44, strength: 7, magic: 7, agility: 10 },
    growth: { hp: 7, mp: 4 },
    resource: { name: 'Mana', rules: [{ on: 'dodge', amount: 10 }, { on: 'crit', amount: 6 }, { on: 'guard', amount: 5 }] },
    branches: [branch('bladesong', 'Bladesong'), branch('leyweave', 'Leyweave'), branch('shadowstep', 'Shadowstep')],
    starterItems: [{ itemId: 'item_primitive_bow', equip: true }, { itemId: 'item_glow_moss', count: 2 }],
    uniqueQuestId: 'q_class_elf',
  },
  {
    id: 'ironclad_warden', name: 'Ironclad Warden', title: 'the Nomads’ wall', sigil: 'warden', dialogueTag: 'ironclad_warden',
    description: 'You win by being the last one standing and making sure everything is hitting you.',
    intro: 'Steel and stubbornness.',
    baseStats: { hp: 116, mp: 30, strength: 12, magic: 5, agility: 7 },
    growth: { hp: 11, mp: 2 },
    resource: { name: 'Grit', rules: [{ on: 'hit_taken', amount: 6 }, { on: 'guard', amount: 8 }, { on: 'taunt', amount: 4 }] },
    branches: [branch('bulwark', 'Bulwark'), branch('breaker', 'Breaker'), branch('iron_will', 'Iron Will')],
    starterItems: [{ itemId: 'item_nomads_maul', equip: true }, { itemId: 'item_scrap_harness', equip: true }, { itemId: 'item_ley_touched_tonic' }],
    uniqueQuestId: 'q_class_ironclad_warden',
  },
  {
    id: 'shadow_weaver', name: 'Shadow Weaver', title: 'void-touched', sigil: 'weaver', dialogueTag: 'shadow_weaver',
    description: 'Your spells unmake; your body is the purse you pay from.',
    intro: 'You have heard the Chasm’s murmur and answered.',
    baseStats: { hp: 90, mp: 48, strength: 6, magic: 10, agility: 8 },
    growth: { hp: 7, mp: 4 },
    resource: { name: 'Mana', rules: [{ on: 'guard', amount: 5 }], bloodPrice: { hpPerMp: 2 } },
    branches: [branch('hex', 'Hex'), branch('drain', 'Drain'), branch('unmaking', 'Unmaking')],
    starterItems: [{ itemId: 'item_cracked_void_focus', equip: true }, { itemId: 'item_dark_spellbook' }, { itemId: 'item_ley_touched_tonic' }],
    uniqueQuestId: 'q_class_shadow_weaver',
  },
] satisfies ClassInput[];

/** DESIGN §3.3: L1 max HP = base + 2·STR, L1 max MP = base + 2·MAG. */
const L1 = { ranger: [120, 48], wizard: [96, 72], elf: [104, 58], ironclad_warden: [140, 40], shadow_weaver: [102, 68] };

describe('the five classes parse (DESIGN §3.3, §5.2–5.6)', () => {
  test.each(CLASSES.map((c) => [c.id, c]))('%s', (_id, c) => {
    expect(issues(c)).toEqual([]);
  });

  test('base stats reproduce DESIGN §3.3 level-1 HP/MP and the 24-point spread', () => {
    for (const raw of CLASSES) {
      const c = ClassSchema.parse(raw);
      const s = c.baseStats;
      expect([s.hp + 2 * s.strength, s.mp + 2 * s.magic]).toEqual(L1[c.id]);
      expect(s.strength + s.magic + s.agility).toBe(24);
    }
  });

  test('defaults', () => {
    const w = ClassSchema.parse(CLASSES[3]);
    expect(w).toMatchObject({ startingGold: 30, startingAbilities: [], legacy: false, tags: [] });
    expect(w.starterItems).toEqual([
      { itemId: 'item_nomads_maul', equip: true, count: 1 },
      { itemId: 'item_scrap_harness', equip: true, count: 1 },
      { itemId: 'item_ley_touched_tonic', equip: false, count: 1 },
    ]);
    expect(ClassSchema.parse(CLASSES[1]).resource.rules[0]).toEqual({ on: 'turn_start', amount: 3, perLevel: { every: 4, add: 1 } });
  });
});

describe('invalid classes fail with clear messages', () => {
  const ranger = CLASSES[0] as (typeof CLASSES)[number];

  test('rules', () => {
    expectIssue({ ...ranger, id: 'paladin' }, 'id', '');
    expectIssue({ ...ranger, branches: ranger.branches.slice(0, 2) }, 'branches', 'exactly three branches');
    expectIssue({ ...ranger, branches: [ranger.branches[0], ranger.branches[0], ranger.branches[2]] }, 'branches.1.id', "duplicate branch id 'hunt'");
    expectIssue({ ...ranger, uniqueQuestId: 'q_class_wizard' }, 'uniqueQuestId', 'the ranger mini-quest is q_class_ranger');
    expectIssue({ ...ranger, uniqueQuestId: 'q_ranger' }, 'uniqueQuestId', 'prefix q_class_');
    expectIssue({ ...ranger, startingAbilities: ['wiz_fireball'] }, 'startingAbilities.0', 'ranger abilities start with rgr_');
    expectIssue({ ...ranger, resource: { name: 'Focus', rules: [{ on: 'guard', amount: 5 }, { on: 'guard', amount: 3 }] } }, 'resource.rules.1.on', 'one rule per event');
    expectIssue({ ...ranger, resource: { name: 'Focus', rules: [{ on: 'kill', amount: 5 }] } }, 'resource.rules.0.on', '');
    expectIssue({ ...ranger, starterItems: [{ itemId: 'item_rusty_dagger' }, { itemId: 'item_rusty_dagger' }] }, 'starterItems.1.itemId', 'list each starter item once');
    expectIssue({ ...ranger, starterItems: [{ itemId: 'rusty_dagger' }] }, 'starterItems.0.itemId', 'item_ or mat_');
    expectIssue({ ...ranger, baseStats: { ...ranger.baseStats, vitality: 3 } }, 'baseStats', 'Unrecognized key');
    expect(ResourceRuleSchema.safeParse({ on: 'guard' }).error?.issues[0]?.message).toBe('a resource rule needs amount and/or pctMax');
  });
});
