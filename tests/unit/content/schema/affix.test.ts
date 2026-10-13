// U15: AffixSchema (DESIGN §7.3) — all 12 affixes parse; absent slots are the table's "—" cells.
import { describe, expect, test } from 'bun:test';
import { AffixSchema, type AffixInput } from '@schema/affix';
import { ItemSchema, type ItemInput } from '@schema/item';

const messages = (value: unknown): string[] => {
  const r = AffixSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

/** DESIGN §7.3 table, cell for cell. Behaviors outside the passive vocabulary are `custom` scripts. */
const affixes: AffixInput[] = [
  {
    id: 'affix_of_embers', suffix: 'of Embers',
    weapon: { text: 'Basic attacks add 15% of damage as Fire', passives: [{ kind: 'custom', scriptId: 'basic_attack_extra_damage', params: { damageType: 'fire', pct: 0.15 } }] },
    armor: { text: 'One resistance step vs Fire', resistSteps: ['fire'] },
    trinket: { text: '+10% Fire damage dealt', passives: [{ kind: 'damageBonus', damageType: 'fire', pct: 0.1 }] },
  },
  {
    id: 'affix_of_the_gale', suffix: 'of the Gale',
    weapon: { text: '+2 initiative', stats: { initiative: 2 } },
    armor: { text: '+5 evasion', stats: { evasion: 5 } },
    trinket: { text: '+2 initiative, +5 evasion', stats: { initiative: 2, evasion: 5 } },
  },
  {
    id: 'affix_of_ley', suffix: 'of the Ley',
    weapon: { text: '+10% Ley damage dealt', passives: [{ kind: 'damageBonus', damageType: 'ley', pct: 0.1 }] },
    armor: { text: '+5 max MP', stats: { mpMax: 5 } },
    trinket: { text: '+5 max MP', stats: { mpMax: 5 } },
  },
  {
    id: 'affix_of_the_void', suffix: 'of the Void',
    weapon: { text: '15% chance on hit to apply Curse (3)', passives: [{ kind: 'statusOnHit', status: 'status_curse', chance: 0.15, duration: 3 }] },
    armor: { text: 'One step vs Void', resistSteps: ['void'] },
    trinket: { text: '+10% Void damage dealt', passives: [{ kind: 'damageBonus', damageType: 'void', pct: 0.1 }] },
  },
  {
    id: 'affix_of_moments', suffix: 'of Moments',
    weapon: { text: '10% chance on hit to apply Slow (2)', passives: [{ kind: 'statusOnHit', status: 'status_slow', chance: 0.1, duration: 2 }] },
    armor: { text: 'One step vs Chrono', resistSteps: ['chrono'] },
    trinket: { text: '+1 initiative', stats: { initiative: 1 } },
  },
  {
    id: 'affix_of_iron', suffix: 'of Iron',
    weapon: { text: '+10% damage vs Armor Broken', passives: [{ kind: 'custom', scriptId: 'damage_vs_status', params: { status: 'status_armor_break', pct: 0.1 } }] },
    armor: { text: '+2 armor', stats: { armor: 2 } },
    trinket: { text: '+1 armor', stats: { armor: 1 } },
  },
  {
    id: 'affix_of_the_hunt', suffix: 'of the Hunt',
    weapon: { text: '+5 crit chance', stats: { crit: 5 } },
    trinket: { text: '+3 crit chance', stats: { crit: 3 } },
  },
  {
    id: 'affix_of_vigor', suffix: 'of Vigor',
    armor: { text: '+8% max HP', stats: { hpMaxPct: 0.08 } },
    trinket: { text: '+5% max HP', stats: { hpMaxPct: 0.05 } },
  },
  {
    id: 'affix_of_the_wellspring', suffix: 'of the Wellspring',
    weapon: { text: 'Class resource generation +25%', passives: [{ kind: 'resourceGain', pct: 0.25 }] },
    armor: { text: '+2 MP regen per turn', passives: [{ kind: 'regen', mp: 2 }] },
    trinket: { text: '+2 MP regen per turn', passives: [{ kind: 'regen', mp: 2 }] },
  },
  {
    id: 'affix_of_thorns', suffix: 'of Thorns',
    weapon: { text: '10% chance on hit to Bleed (3)', passives: [{ kind: 'statusOnHit', status: 'status_bleed', chance: 0.1, duration: 3 }] },
    armor: { text: 'Reflect 10% of melee damage taken as Physical', passives: [{ kind: 'custom', scriptId: 'reflect_melee', params: { pct: 0.1, damageType: 'physical' } }] },
  },
  {
    id: 'affix_of_the_warden', suffix: 'of the Warden',
    armor: { text: 'Guard reduces 60% instead of 50%', passives: [{ kind: 'guardValue', pct: 0.6 }] },
    trinket: { text: 'Guard reduces 55%', passives: [{ kind: 'guardValue', pct: 0.55 }] },
  },
  {
    id: 'affix_of_echoes', suffix: 'of Echoes', unique: true,
    trinket: { text: '+10% XP from kills (not stackable)', passives: [{ kind: 'custom', scriptId: 'xp_bonus', params: { pct: 0.1 } }] },
  },
];

describe('AffixSchema', () => {
  test('all 12 DESIGN §7.3 affixes parse', () => {
    expect(affixes).toHaveLength(12);
    expect(new Set(affixes.map((a) => a.id)).size).toBe(12);
    for (const a of affixes) expect(messages(a)).toEqual([]);
  });

  test('"—" cells are absent slots; defaults fill the rest', () => {
    const hunt = AffixSchema.parse(affixes[6]);
    expect(hunt.armor).toBeUndefined();
    expect(hunt.weapon?.stats.crit).toBe(5);
    expect(hunt.weapon?.passives).toEqual([]);
    expect(hunt.weapon?.resistSteps).toEqual([]);
    expect(hunt.unique).toBe(false);
    expect(AffixSchema.parse(affixes[11]).unique).toBe(true);
    expect(AffixSchema.parse(affixes[0]).armor?.resistSteps).toEqual(['fire']);
  });

  test('affix effects use the item stat and passive vocabulary', () => {
    const wellspring = AffixSchema.parse(affixes[8]);
    expect(wellspring.armor?.passives).toEqual([{ kind: 'regen', hp: 0, mp: 2 }]);
    expect(messages({ ...affixes[0], armor: { text: 'x', stats: { dodge: 5 } } })).not.toEqual([]);
    expect(messages({ ...affixes[0], armor: { text: 'x', resistSteps: ['arcane'] } })).not.toEqual([]);
    expect(messages({ ...affixes[0], weapon: { text: 'x', passives: [{ kind: 'statusOnHit', status: 'curse', chance: 0.1 }] } })[0]).toContain('prefix status_');
  });

  test('an affix parses as a fixed affix of an item and bad ids fail', () => {
    const cloak: ItemInput = {
      id: 'item_sky_whisper_cloak', name: 'Sky-Whisper Cloak', description: 'The wind goes around you.', type: 'armor', slot: 'armor', armorClass: 'light',
      tier: 3, rarityRule: 'fixed', fixedRarity: 'rare', fixedAffixes: ['affix_of_the_gale'], stats: { armor: 7, ward: 3, agility: 1 }, resistSteps: ['storm'],
      value: 190, art: { icon: 'cloak' },
    };
    expect(ItemSchema.safeParse(cloak).success).toBe(true);
    expect(messages({ ...affixes[0], id: 'of_embers' })[0]).toContain('prefix affix_');
    expect(messages({ ...affixes[0], id: 'item_of_embers' })).not.toEqual([]);
  });

  test('missing fields, empty effects and unknown keys fail', () => {
    const { suffix: _s, ...noSuffix } = affixes[0] as Record<string, unknown>;
    expect(messages(noSuffix).join()).toContain('suffix');
    expect(messages({ id: 'affix_of_nothing', suffix: 'of Nothing' })).toEqual([': an affix must define at least one of weapon / armor / trinket']);
    expect(messages({ id: 'affix_of_nothing', suffix: 'of Nothing', armor: { text: 'Nothing happens' } })).toEqual(['armor: the armor effect does nothing (no stats, resist steps or passives)']);
    expect(messages({ ...affixes[0], helm: { text: 'x', stats: { armor: 1 } } })).not.toEqual([]);
    const { text: _t, ...noText } = (affixes[1] as { weapon: Record<string, unknown> }).weapon;
    expect(messages({ ...affixes[1], weapon: noText }).join()).toContain('text');
  });
});
