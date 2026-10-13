// U15: ItemSchema (PLAN §5.5) — every DESIGN §7.7 legacy item (the 26 of PLAN Appendix A.4) parses with its rebalanced numbers.
import { describe, expect, test } from 'bun:test';
import { ItemSchema, PassiveSchema, type ItemInput } from '@schema/item';

const messages = (value: unknown): string[] => {
  const r = ItemSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

const icon = (name: string) => ({ icon: name });

/** DESIGN §7.7, row for row. Quest items are slotless and unsellable; bound trinkets say so explicitly. */
const legacy: ItemInput[] = [
  { id: 'item_rusty_dagger', name: 'Rusty Dagger', legacyName: 'Rusty Dagger', description: 'A dull blade, barely holding an edge.', type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 1, stats: { power: 4 }, value: 8, art: icon('dagger') },
  {
    id: 'item_amulet_of_echoes', name: 'Amulet of Echoes', legacyName: 'Amulet of Echoes', description: 'It remembers what you do not.', type: 'quest', tier: 0,
    stats: { magic: 1 }, passives: [{ kind: 'grantAbility', abilityId: 'itm_echo_bolt' }], value: 60, sellable: false, droppable: false,
    tags: ['never_reset'], art: { icon: 'amulet', major: true },
  },
  { id: 'item_ley_touched_tonic', name: 'Ley-Touched Tonic', legacyName: 'Ley-Touched Tonic', description: 'A vial of shimmering liquid.', type: 'consumable', tier: 1, onUse: [{ heal: { hp: 25, mp: 15 } }], value: 12, art: icon('vial') },
  { id: 'item_ironclad_mail', name: 'Ironclad Mail', legacyName: 'Ironclad Mail', description: 'Patchwork armor of riveted plates.', type: 'armor', slot: 'armor', armorClass: 'medium', tier: 2, stats: { armor: 4, ward: 1 }, value: 40, art: icon('mail') },
  { id: 'item_echo_crystal', name: 'Echo Crystal', legacyName: 'Echo Crystal', description: 'A crystal humming with a voice.', type: 'quest', tier: 0, value: 70, art: icon('crystal') },
  {
    id: 'item_dark_spellbook', name: 'Dark Spellbook', legacyName: 'Dark Spellbook', description: 'The pages are warm. Reading costs something.', type: 'tome', tier: 0,
    onUse: [{ damage: { hp: 15 } }, { corruption: 1 }], usableInCombat: false, value: 8, art: icon('book_dark'),
  },
  { id: 'item_mana_bloom', name: 'Mana Bloom', legacyName: 'Mana Bloom', description: 'A flower that drinks the ley.', type: 'consumable', tier: 1, onUse: [{ heal: { hp: 10, mp: 30 } }], value: 25, art: icon('bloom') },
  { id: 'item_scholars_lost_scroll', name: "Scholar's Lost Scroll", legacyName: "Scholar's Lost Scroll", description: 'A scroll the Archives lost.', type: 'quest', tier: 0, value: 45, art: icon('scroll') },
  { id: 'item_void_shard', name: 'Void Shard', legacyName: 'Void Shard', description: 'A splinter of nothing.', type: 'material', tier: 0, maxStack: 99, value: 20, art: icon('shard_void') },
  {
    id: 'item_shadow_kissed_dagger', name: 'Shadow-Kissed Dagger', legacyName: 'Shadow-Kissed Dagger', description: 'It hungers for its wielder.', type: 'weapon', slot: 'weapon', weaponType: 'melee',
    tier: 2, stats: { power: 7 }, passives: [{ kind: 'curse', chance: 0.2, damage: 2 }], value: 75, art: icon('dagger_shadow'),
  },
  { id: 'item_ironclad_plate_armor', name: 'Ironclad Plate Armor', legacyName: 'Ironclad Plate Armor', description: 'Strong against blades, weak to magic.', type: 'armor', slot: 'armor', armorClass: 'heavy', tier: 2, stats: { armor: 6, ward: -2 }, value: 65, art: icon('plate') },
  {
    id: 'item_stabilized_heartstone', name: 'Stabilized Heartstone', legacyName: 'Stabilized Heartstone', description: 'A calm core of light.', type: 'trinket', slot: 'trinket', tier: 0,
    stats: { magic: 1, mpMax: 15 }, passives: [{ kind: 'custom', scriptId: 'grant_echo_on_equip', params: { echo: 'echo_heartstone_resonance' } }],
    value: 90, sellable: false, droppable: false, upgradeable: false, art: { icon: 'heartstone', major: true },
  },
  {
    id: 'item_heartstone_core', name: 'Heartstone Core', legacyName: 'Heartstone Core', description: 'It gives and it takes.', type: 'trinket', slot: 'trinket', tier: 0,
    stats: { magic: 2, mpMax: 25, hpMax: -15 }, value: 100, sellable: false, droppable: false, upgradeable: false, art: { icon: 'heartstone_core', major: true },
  },
  { id: 'item_chronal_dust', name: 'Chronal Dust', legacyName: 'Chronal Dust', description: 'Time, ground fine.', type: 'consumable', tier: 2, onUse: [{ heal: { mp: 25 } }], value: 18, tags: ['material'], art: icon('dust') },
  { id: 'item_glow_moss', name: 'Glow Moss', legacyName: 'Glow Moss', description: 'Soft light, soft remedy.', type: 'consumable', tier: 1, onUse: [{ heal: { hp: 20, mp: 5 } }], value: 10, art: icon('moss') },
  { id: 'item_aetherium_shard', name: 'Aetherium Shard', legacyName: 'Aetherium Shard', description: 'A sliver of aether.', type: 'material', tier: 0, maxStack: 99, value: 28, art: icon('shard_aether') },
  { id: 'item_sky_whisper_talisman', name: 'Sky-Whisper Talisman', legacyName: 'Sky-Whisper Talisman', description: 'A weathered charm that steadies breath in high winds.', type: 'trinket', slot: 'trinket', tier: 2, stats: { agility: 1 }, value: 32, tags: ['key', 'anchorable'], art: icon('talisman') },
  { id: 'item_chronos_lens', name: 'Chronos Lens', legacyName: 'Chronos Lens', description: 'It shows the door.', type: 'trinket', slot: 'trinket', tier: 3, stats: { magic: 2, mpMax: 10 }, value: 120, tags: ['key'], art: icon('lens') },
  { id: 'item_travelers_sword', name: "Traveler's Sword", legacyName: "Traveler's Sword", description: 'A serviceable blade.', type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 1, stats: { power: 5 }, value: 20, art: icon('sword') },
  { id: 'item_primitive_bow', name: 'Primitive Bow', legacyName: 'Primitive Bow', description: 'Bent wood and gut.', type: 'weapon', slot: 'weapon', weaponType: 'ranged_bow', tier: 1, stats: { power: 4 }, value: 15, art: icon('bow') },
  { id: 'item_elven_bow', name: 'Elven Bow', legacyName: 'Elven Bow', description: 'It draws itself.', type: 'weapon', slot: 'weapon', weaponType: 'ranged_bow', tier: 2, stats: { power: 8, agility: 1 }, value: 70, art: icon('bow_elven') },
  {
    id: 'item_apprentice_staff', name: 'Apprentice Staff', legacyName: 'Apprentice Staff', description: 'Chipped at the tip from lessons.', type: 'weapon', slot: 'weapon', weaponType: 'magic_staff',
    tier: 1, stats: { power: 2, spellPower: 1 }, passives: [{ kind: 'mpCostReduction', pct: 0.1 }], value: 30, art: icon('staff'),
  },
  {
    id: 'item_necromancer_staff', name: 'Necromancer Staff', legacyName: 'Necromancer Staff', description: 'Bone-topped and cold.', type: 'weapon', slot: 'weapon', weaponType: 'magic_staff',
    tier: 2, stats: { power: 4, spellPower: 3 }, passives: [{ kind: 'mpCostReduction', pct: 0.2 }, { kind: 'lifeSteal', pct: 0.05 }], value: 100, art: icon('staff_bone'),
  },
  { id: 'item_warriors_sword', name: "Warrior's Sword", legacyName: "Warrior's Sword", description: 'Well kept.', type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 2, stats: { power: 7 }, value: 40, art: icon('sword_war') },
  { id: 'item_wildling_hide_armor', name: 'Wildling Hide Armor', legacyName: 'Wildling Hide Armor', description: 'Smells faintly of damp earth.', type: 'armor', slot: 'armor', armorClass: 'light', tier: 1, stats: { armor: 2, ward: 1 }, value: 25, art: icon('hide') },
  { id: 'item_glyphbound_lantern', name: 'Glyphbound Lantern', legacyName: 'Glyphbound Lantern', description: "Ilyra's lamp, left for the divers.", type: 'trinket', slot: 'trinket', tier: 1, stats: { magic: 1 }, value: 30, art: icon('lantern') },
];

const rustyDagger = legacy[0] as ItemInput;
const tonic = legacy[2] as ItemInput;

describe('ItemSchema: DESIGN §7.7 legacy items', () => {
  test('the table has the 26 legacy items of PLAN Appendix A.4, each id once', () => {
    expect(legacy).toHaveLength(26);
    expect(new Set(legacy.map((i) => i.id)).size).toBe(26);
  });

  test('every legacy item parses', () => {
    for (const item of legacy) expect(messages(item)).toEqual([]);
  });

  test('rebalanced numbers survive parsing', () => {
    const byId = new Map(legacy.map((i) => [i.id, ItemSchema.parse(i)]));
    expect(byId.get('item_ironclad_plate_armor')?.stats).toMatchObject({ armor: 6, ward: -2 });
    expect(byId.get('item_heartstone_core')?.stats).toMatchObject({ magic: 2, mpMax: 25, hpMax: -15 });
    expect(byId.get('item_necromancer_staff')?.passives).toEqual([{ kind: 'mpCostReduction', pct: 0.2 }, { kind: 'lifeSteal', pct: 0.05 }]);
    expect(byId.get('item_shadow_kissed_dagger')?.passives).toEqual([{ kind: 'curse', chance: 0.2, damage: 2 }]);
    expect(byId.get('item_amulet_of_echoes')?.passives).toEqual([{ kind: 'grantAbility', abilityId: 'itm_echo_bolt' }]);
    expect(byId.get('item_dark_spellbook')?.onUse).toEqual([{ damage: { hp: 15 } }, { corruption: 1 }]);
    expect(byId.get('item_ley_touched_tonic')?.onUse).toEqual([{ heal: { hp: 25, mp: 15 } }]);
    expect(byId.get('item_chronos_lens')).toMatchObject({ tier: 3, value: 120 });
  });

  test('type-dependent defaults are resolved in the parsed item (DESIGN §7.1, §7.2, §7.8)', () => {
    const dagger = ItemSchema.parse(rustyDagger);
    expect(dagger).toMatchObject({ rarityRule: 'rolled', fixedRarity: 'common', stackable: false, maxStack: 1, sellable: true, droppable: true, upgradeable: true });
    const potion = ItemSchema.parse(tonic);
    expect(potion).toMatchObject({ rarityRule: 'fixed', stackable: true, maxStack: 10, sellable: true, upgradeable: false, consumeOnUse: true, usableInCombat: true });
    expect(ItemSchema.parse(legacy[4])).toMatchObject({ type: 'quest', sellable: false, droppable: false, rarityRule: 'fixed', stackable: false });
    expect(ItemSchema.parse(legacy[8])).toMatchObject({ type: 'material', stackable: true, maxStack: 99 });
    expect(ItemSchema.parse(legacy[5])).toMatchObject({ type: 'tome', stackable: true, maxStack: 5, usableInCombat: false });
    expect(ItemSchema.parse(legacy[2])?.stats).toEqual({ power: 0, spellPower: 0, armor: 0, ward: 0, strength: 0, magic: 0, agility: 0, hpMax: 0, mpMax: 0, hpMaxPct: 0, crit: 0, accuracy: 0, evasion: 0, initiative: 0 });
  });

  test('explicit values beat the defaults', () => {
    expect(ItemSchema.parse({ ...tonic, maxStack: 5, sellable: false }).maxStack).toBe(5);
    expect(ItemSchema.parse({ ...tonic, sellable: false, value: 0 }).sellable).toBe(false);
    expect(ItemSchema.parse({ ...tonic, type: 'key', onUse: [], stackable: true, maxStack: 3 })).toMatchObject({ stackable: true, maxStack: 3 });
  });
});

describe('ItemSchema: invalid records fail', () => {
  test('bad id prefix', () => {
    expect(messages({ ...rustyDagger, id: 'rusty_dagger' })[0]).toContain('prefix item_ or mat_');
    expect(messages({ ...rustyDagger, id: 'weapon_rusty_dagger' })).not.toEqual([]);
    expect(messages({ ...rustyDagger, id: 'item_Rusty_Dagger' })).not.toEqual([]);
    expect(messages({ ...rustyDagger, fixedAffixes: ['of_embers'] })[0]).toContain('prefix affix_');
    expect(messages({ ...rustyDagger, passives: [{ kind: 'statusOnHit', status: 'curse', chance: 0.2 }] })[0]).toContain('prefix status_');
    expect(messages({ ...rustyDagger, passives: [{ kind: 'grantAbility', abilityId: 'echo_bolt' }] })[0]).toContain('prefix itm_');
    expect(messages({ ...rustyDagger, codexId: 'dagger' })[0]).toContain('prefix codex_');
  });

  test('unknown slot, type, weapon type, tier and rarity', () => {
    expect(messages({ ...rustyDagger, slot: 'head' })).not.toEqual([]);
    expect(messages({ ...rustyDagger, slot: 'trinket_1' })).not.toEqual([]);
    expect(messages({ ...rustyDagger, type: 'sword' })).not.toEqual([]);
    expect(messages({ ...rustyDagger, weaponType: 'whip' })).not.toEqual([]);
    expect(messages({ ...rustyDagger, tier: 6 })).not.toEqual([]);
    expect(messages({ ...rustyDagger, fixedRarity: 'mythic' })).not.toEqual([]);
    expect(messages({ ...rustyDagger, stats: { power: 4, luck: 1 } })).not.toEqual([]);
    expect(messages({ ...rustyDagger, passives: [{ kind: 'explode' }] })).not.toEqual([]);
  });

  test('missing required fields', () => {
    for (const key of ['name', 'description', 'type', 'value', 'art'] as const) {
      const copy: Record<string, unknown> = { ...rustyDagger };
      delete copy[key];
      expect(messages(copy).join()).toContain(key);
    }
    expect(messages({ ...rustyDagger, art: {} })).not.toEqual([]);
    expect(messages({ ...rustyDagger, value: -1 })).not.toEqual([]);
    expect(messages({ ...rustyDagger, sparkle: true })).not.toEqual([]);
  });

  test('equipment needs a matching slot (PLAN §5.19 rule 12)', () => {
    const { slot: _s, ...noSlot } = rustyDagger as Record<string, unknown>;
    expect(messages(noSlot)).toEqual(["slot: a weapon needs slot: 'weapon'"]);
    expect(messages({ ...rustyDagger, slot: 'armor' })).toEqual(["slot: a weapon needs slot: 'weapon'"]);
    expect(messages({ ...tonic, slot: 'trinket' })).toEqual(['slot: a consumable item has no equipment slot']);
  });

  test('weaponType and armorClass only where they belong', () => {
    const { weaponType: _w, ...noWeaponType } = rustyDagger as Record<string, unknown>;
    expect(messages(noWeaponType)).toEqual(['weaponType: a weapon needs a weaponType (DESIGN §5.7)']);
    expect(messages({ ...legacy[3], weaponType: 'melee' })).toEqual(['weaponType: weaponType is only for weapons']);
    expect(messages({ ...rustyDagger, armorClass: 'light' })).toEqual(['armorClass: armorClass is only for armor']);
  });

  test('consumables need onUse; only gear rolls rarity or stacks differently', () => {
    expect(messages({ ...tonic, onUse: [] })).toEqual(['onUse: a consumable needs at least one onUse effect']);
    const { onUse: _o, ...noOnUse } = tonic as Record<string, unknown>;
    expect(messages(noOnUse)).toEqual(['onUse: a consumable needs at least one onUse effect']);
    expect(messages({ ...tonic, rarityRule: 'rolled' })[0]).toContain("only weapon/armor/trinket roll a rarity");
    expect(messages({ ...rustyDagger, rarityRule: 'rolled' })).toEqual([]);
    expect(messages({ ...rustyDagger, rarityRule: 'fixed', fixedRarity: 'rare' })).toEqual([]);
    expect(messages({ ...rustyDagger, stackable: true })).toEqual(['stackable: gear never stacks (each piece has rarity and affixes)']);
    expect(messages({ ...tonic, upgradeable: true })).toEqual(['upgradeable: only weapon/armor/trinket can be upgraded (DESIGN §8.3)']);
    expect(messages({ ...rustyDagger, stackable: false, maxStack: 5 })).toEqual(['maxStack: maxStack > 1 on a non-stackable item']);
  });

  test('onUse uses the canonical effects', () => {
    expect(messages({ ...tonic, onUse: [{ applyStatus: 'status_regen' }] })[0]).toContain("unknown effect atom 'applyStatus'");
  });

  test('value is positive for sellable items; quest items cannot be sold or dropped', () => {
    expect(messages({ ...rustyDagger, value: 0 })).toEqual(['value: a sellable item needs value > 0']);
    expect(messages({ ...rustyDagger, value: 0, sellable: false })).toEqual([]);
    expect(messages({ ...legacy[4], sellable: true })).toEqual(['sellable: quest items are bound: they cannot be sold (DESIGN §7.5)']);
    expect(messages({ ...legacy[4], droppable: true })).toEqual(['droppable: quest items are bound: they cannot be dropped (DESIGN §7.1)']);
    expect(messages({ ...legacy[4], value: 0 })).toEqual([]);
  });

  test('fixed affixes: gear only, no duplicates, at most the rarity allows (DESIGN §7.3)', () => {
    const fixed = { ...rustyDagger, rarityRule: 'fixed', fixedRarity: 'rare' } as const;
    expect(messages({ ...fixed, fixedAffixes: ['affix_of_the_void'] })).toEqual([]);
    expect(messages({ ...fixed, fixedAffixes: ['affix_of_the_void', 'affix_of_embers'] })).toEqual(['fixedAffixes: a rare item carries at most 1 affix(es) (DESIGN §7.3)']);
    expect(messages({ ...fixed, fixedRarity: 'epic', fixedAffixes: ['affix_of_the_warden', 'affix_of_vigor'] })).toEqual([]);
    expect(messages({ ...fixed, fixedRarity: 'epic', fixedAffixes: ['affix_of_vigor', 'affix_of_vigor'] })).toEqual(['fixedAffixes: an item never carries the same affix twice']);
    expect(messages({ ...fixed, fixedRarity: 'common', fixedAffixes: ['affix_of_iron'] })).toEqual(['fixedAffixes: a common item carries at most 0 affix(es) (DESIGN §7.3)']);
    expect(messages({ ...tonic, fixedAffixes: ['affix_of_iron'] })).toEqual(['fixedAffixes: only weapon/armor/trinket carry affixes']);
    expect(messages({ ...rustyDagger, fixedAffixes: ['affix_of_iron', 'affix_of_vigor', 'affix_of_embers'] })).toEqual(['fixedAffixes: at most 2 affixes (DESIGN §7.3)']);
  });

  test('sources are validated by prefix', () => {
    const sources = ['drop:cr_corrupted_shade', 'merchant:npc_kaelen_stonehand', 'craft:recipe_voidforged_edge', 'quest:q_lost_scroll', 'loc:loc_shattered_library'];
    expect(messages({ ...rustyDagger, sources })).toEqual([]);
    expect(messages({ ...rustyDagger, sources: ['drop:corrupted_shade'] })[0]).toContain("source 'drop:corrupted_shade' must be drop:cr_");
    expect(messages({ ...rustyDagger, sources: ['pool:npc_x'] })).not.toEqual([]);
    expect(messages({ ...rustyDagger, sources: ['quest:loc_x'] })).not.toEqual([]);
  });

  test('requirements use the five class ids and a Condition', () => {
    expect(messages({ ...rustyDagger, requirements: { classIds: ['ranger', 'elf'], level: 3, when: { echo: 'echo_x' } } })).toEqual([]);
    expect(messages({ ...rustyDagger, requirements: { classIds: ['paladin'] } })).not.toEqual([]);
    expect(messages({ ...rustyDagger, requirements: { when: { echoes: 'echo_x' } } })).not.toEqual([]);
  });
});

describe('PassiveSchema', () => {
  test('every PLAN §5.5 passive kind parses', () => {
    const passives: unknown[] = [
      { kind: 'resist', damageType: 'fire', level: 'resist' },
      { kind: 'statusOnHit', status: 'status_curse', chance: 0.2, duration: 3 },
      { kind: 'mpCostReduction', pct: 0.1 },
      { kind: 'lifeSteal', pct: 0.05 },
      { kind: 'curse', chance: 0.2, damage: 2 },
      { kind: 'regen', mp: 2 },
      { kind: 'resourceGain', pct: 0.25 },
      { kind: 'statusImmunity', status: 'status_poison' },
      { kind: 'damageBonus', damageType: 'ley', pct: 0.1 },
      { kind: 'damageBonus', pct: 0.05 },
      { kind: 'guardValue', pct: 0.6 },
      { kind: 'grantAbility', abilityId: 'itm_echo_bolt' },
      { kind: 'custom', scriptId: 'soaked_shorter' },
    ];
    for (const p of passives) expect(PassiveSchema.safeParse(p).success).toBe(true);
    expect(PassiveSchema.parse({ kind: 'statusOnHit', status: 'status_slow', chance: 0.1 })).toMatchObject({ duration: 2 });
    expect(PassiveSchema.parse({ kind: 'regen', mp: 2 })).toEqual({ kind: 'regen', hp: 0, mp: 2 });
    expect(PassiveSchema.parse({ kind: 'custom', scriptId: 'x' })).toEqual({ kind: 'custom', scriptId: 'x', params: {} });
  });

  test('bad passives fail', () => {
    expect(PassiveSchema.safeParse({ kind: 'lifeSteal' }).success).toBe(false);
    expect(PassiveSchema.safeParse({ kind: 'lifeSteal', pct: 0.1, extra: 1 }).success).toBe(false);
    expect(PassiveSchema.safeParse({ kind: 'resist', damageType: 'arcane', level: 'resist' }).success).toBe(false);
    expect(PassiveSchema.safeParse({ kind: 'resist', damageType: 'fire', level: 'absorb' }).success).toBe(false);
    expect(PassiveSchema.safeParse({ kind: 'statusOnHit', status: 'status_slow', chance: 1.5 }).success).toBe(false);
    expect(PassiveSchema.safeParse({ kind: 'custom', scriptId: 'Bad Id' }).success).toBe(false);
  });
});
