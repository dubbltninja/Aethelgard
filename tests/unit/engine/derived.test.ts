// U21: derived values (DESIGN §3.2–3.3, §6.7, §7.2–7.3). DESIGN §3.3's base maxima for all five classes at L1 and the
// reference levels, every §3.2 formula, rarity scaling, affixes, carried quest items, Corruption and status hooks.
import { describe, expect, test } from 'bun:test';
import { buildContentPack, type ContentPack } from '@content/index';
import type { AffixInput } from '@schema/affix';
import type { ClassInput } from '@schema/class';
import type { ItemInput } from '@schema/item';
import {
  RARITY_ORDER,
  derive,
  fleeChance,
  hitChance,
  itemStats,
  rarityScaled,
  syncMaxima,
  type ItemInstance,
  type PlayerState,
  type Rarity,
  type StatusInstance,
} from '@engine/index';
import { makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { fixturePack, miniContentTables } from '@tests/fixtures/miniContent';

const branches = (a: string, b: string, c: string) => [a, b, c].map((id) => ({ id, name: id, description: `The ${id} branch.` }));
const kit: ClassInput['starterItems'] = [{ itemId: 'item_rusty_dagger', equip: true }];
const classBase = (id: 'elf' | 'ironclad_warden' | 'shadow_weaver', name: string) => ({
  id,
  name,
  title: name,
  description: `${name} (DESIGN §3.3).`,
  intro: `${name}.`,
  sigil: id,
  dialogueTag: id,
  starterItems: kit,
});

/** DESIGN §3.3 / §5.4–5.6: the three classes the fixture pack leaves out. */
const EXTRA_CLASSES: ClassInput[] = [
  {
    ...classBase('elf', 'Elf'),
    legacy: true,
    baseStats: { hp: 90, mp: 44, strength: 7, magic: 7, agility: 10 },
    growth: { hp: 7, mp: 4 },
    resource: { name: 'Mana', rules: [{ on: 'dodge', amount: 10 }, { on: 'crit', amount: 6 }] },
    branches: branches('bladesong', 'leyweave', 'shadowstep'),
  },
  {
    ...classBase('ironclad_warden', 'Ironclad Warden'),
    baseStats: { hp: 116, mp: 30, strength: 12, magic: 5, agility: 7 },
    growth: { hp: 11, mp: 2 },
    resource: { name: 'Grit', rules: [{ on: 'hit_taken', amount: 6 }, { on: 'guard', amount: 8 }, { on: 'taunt', amount: 4 }] },
    branches: branches('bulwark', 'breaker', 'iron_will'),
  },
  {
    ...classBase('shadow_weaver', 'Shadow Weaver'),
    baseStats: { hp: 90, mp: 48, strength: 6, magic: 10, agility: 8 },
    growth: { hp: 7, mp: 4 },
    resource: { name: 'Mana', rules: [{ on: 'guard', amount: 5 }], bloodPrice: { hpPerMp: 2 } },
    branches: branches('hex', 'drain', 'unmaking'),
  },
];

const t = (text: string) => ({ text });
/** DESIGN §7.3 rows the tests use. */
const AFFIXES: AffixInput[] = [
  { id: 'affix_of_vigor', suffix: 'of Vigor', armor: { ...t('+8% max HP'), stats: { hpMaxPct: 0.08 } }, trinket: { ...t('+5% max HP'), stats: { hpMaxPct: 0.05 } } },
  {
    id: 'affix_of_the_gale',
    suffix: 'of the Gale',
    weapon: { ...t('+2 initiative'), stats: { initiative: 2 } },
    armor: { ...t('+5 evasion'), stats: { evasion: 5 } },
    trinket: { ...t('both'), stats: { initiative: 2, evasion: 5 } },
  },
  { id: 'affix_of_iron', suffix: 'of Iron', armor: { ...t('+2 armor'), stats: { armor: 2 } }, trinket: { ...t('+1 armor'), stats: { armor: 1 } } },
  { id: 'affix_of_the_hunt', suffix: 'of the Hunt', weapon: { ...t('+5 crit'), stats: { crit: 5 } }, trinket: { ...t('+3 crit'), stats: { crit: 3 } } },
  {
    id: 'affix_of_ley',
    suffix: 'of the Ley',
    weapon: { ...t('+10% Ley damage'), passives: [{ kind: 'damageBonus', damageType: 'ley', pct: 0.1 }] },
    armor: { ...t('+5 max MP'), stats: { mpMax: 5 } },
    trinket: { ...t('+5 max MP'), stats: { mpMax: 5 } },
  },
  {
    id: 'affix_of_embers',
    suffix: 'of Embers',
    armor: { ...t('one step vs Fire'), resistSteps: ['fire'] },
    trinket: { ...t('+10% Fire damage'), passives: [{ kind: 'damageBonus', damageType: 'fire', pct: 0.1 }] },
  },
  {
    id: 'affix_of_the_warden',
    suffix: 'of the Warden',
    armor: { ...t('Guard 60%'), passives: [{ kind: 'guardValue', pct: 0.6 }] },
    trinket: { ...t('Guard 55%'), passives: [{ kind: 'guardValue', pct: 0.55 }] },
  },
  {
    id: 'affix_of_the_wellspring',
    suffix: 'of the Wellspring',
    weapon: { ...t('resource +25%'), passives: [{ kind: 'resourceGain', pct: 0.25 }] },
    armor: { ...t('+2 MP regen'), passives: [{ kind: 'regen', mp: 2 }] },
  },
  { id: 'affix_of_echoes', suffix: 'of Echoes', unique: true, trinket: { ...t('+10% XP from kills'), passives: [{ kind: 'custom', scriptId: 'xp_from_kills', params: { pct: 0.1 } }] } },
];

/** DESIGN §7.7 legacy gear the fixture lacks, plus one generic passive carrier. */
const EXTRA_ITEMS: ItemInput[] = [
  {
    id: 'item_elven_bow', name: 'Elven Bow', type: 'weapon', slot: 'weapon', weaponType: 'ranged_bow', tier: 2, description: 'Fixture.',
    stats: { power: 8, agility: 1 }, value: 70, art: { icon: 'bow' },
  },
  {
    id: 'item_ironclad_plate_armor', name: 'Ironclad Plate Armor', type: 'armor', slot: 'armor', armorClass: 'heavy', tier: 2, description: 'Fixture.',
    stats: { armor: 6, ward: -2 }, value: 65, art: { icon: 'plate' },
  },
  {
    id: 'item_necromancer_staff', name: 'Necromancer Staff', type: 'weapon', slot: 'weapon', weaponType: 'magic_staff', tier: 2, description: 'Fixture.',
    stats: { power: 4, spellPower: 3 }, passives: [{ kind: 'mpCostReduction', pct: 0.2 }, { kind: 'lifeSteal', pct: 0.05 }], value: 100, art: { icon: 'staff' },
  },
  {
    id: 'item_salamander_charm', name: 'Salamander Charm', type: 'trinket', slot: 'trinket', tier: 2, description: 'Fixture.',
    stats: { accuracy: 3, hpMax: 10 }, resistSteps: ['fire'], value: 50, art: { icon: 'charm' },
    passives: [{ kind: 'statusImmunity', status: 'status_burn' }, { kind: 'statusImmunity', status: 'status_burn' }, { kind: 'damageBonus', pct: 0.05 }],
  },
];

let cached: ContentPack | null = null;
/** The fixture pack plus the three other classes, DESIGN §7.3 affixes and a few DESIGN §7.7 items. */
function characterPack(): ContentPack {
  cached ??= buildContentPack(
    {
      ...miniContentTables,
      classes: [...miniContentTables.classes, ...EXTRA_CLASSES],
      affixes: AFFIXES,
      items: [...miniContentTables.items, ...EXTRA_ITEMS],
    },
    { version: 'u21-character' },
  );
  return cached;
}

const content = characterPack();
const state = (o: StateOverrides = {}) => makeState(o, { content });
const player = (o: StateOverrides = {}): PlayerState => state(o).player;
const status = (statusId: string): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false });

// ---- DESIGN §3.3 ----------------------------------------------------------------------------------------------------

/** class → L1 [HP, MP], then L4/L8/L12/L16/L20 (DESIGN §3.3 tables). */
const REFERENCE: Record<string, [number, number][]> = {
  ranger: [[120, 48], [144, 57], [176, 69], [208, 81], [240, 93], [272, 105]],
  wizard: [[96, 72], [114, 87], [138, 107], [162, 127], [186, 147], [210, 167]],
  elf: [[104, 58], [125, 70], [153, 86], [181, 102], [209, 118], [237, 134]],
  ironclad_warden: [[140, 40], [173, 46], [217, 54], [261, 62], [305, 70], [349, 78]],
  shadow_weaver: [[102, 68], [123, 80], [151, 96], [179, 112], [207, 128], [235, 144]],
};
const LEVELS = [1, 4, 8, 12, 16, 20];

describe('DESIGN §3.3 class base stats and growth', () => {
  for (const [classId, rows] of Object.entries(REFERENCE)) {
    test(`${classId}: L1 and the reference levels, before stat points and gear`, () => {
      rows.forEach(([hp, mp], i) => {
        const level = LEVELS[i]!;
        const p = player({ classId, level });
        expect([derive(p, content).hpMax, derive(p, content).mpMax]).toEqual([hp, mp]);
        expect([p.hpMax, p.mpMax]).toEqual([hp, mp]);
      });
    });
  }

  test('every class sums to 24 primary points at level 1', () => {
    for (const cls of Object.values(content.classes)) expect(cls.baseStats.strength + cls.baseStats.magic + cls.baseStats.agility).toBe(24);
  });

  test('max HP gains 2 per STR and max MP 2 per MAG (allocated points count)', () => {
    const p = player({ classId: 'ranger', level: 5 });
    p.stats.strength += 3;
    p.stats.magic += 1;
    expect(derive(p, content)).toMatchObject({ hpMax: 152 + 6, mpMax: 60 + 2 });
  });
});

// ---- DESIGN §3.2 formulas ------------------------------------------------------------------------------------------------

describe('DESIGN §3.2 derived values', () => {
  test('Ranger L1 with the Rusty Dagger', () => {
    const d = derive(player(), content);
    expect(d).toMatchObject({
      strength: 10, magic: 6, agility: 8, hpMax: 120, mpMax: 48,
      atk: 14, sp: 6, accuracy: 89, evasion: 4, crit: 9, critMult: 1.5, initiative: 8,
      armor: 0, ward: 0, guardValue: 0.5, mpCostReduction: 0, lifeSteal: 0, resourceGainPct: 0,
    });
    expect(d.regen).toEqual({ hp: 0, mp: 0 });
    expect(d.resistSteps).toEqual({});
    expect(d.damagePct).toEqual({});
    expect(d.grantedAbilities).toEqual([]);
  });

  test('Wizard L1 with the Apprentice Staff: SP = MAG + spell power, staff MP reduction', () => {
    expect(derive(player({ classId: 'wizard' }), content)).toMatchObject({ atk: 8, sp: 12, accuracy: 88, evasion: 3, crit: 8, initiative: 7, mpCostReduction: 0.1 });
  });

  test('gear: weapon power and spell power, armor and (negative) ward, primary bonuses, flat stats, resist steps and passives', () => {
    const p = player({
      items: [
        { itemId: 'item_necromancer_staff', equip: true },
        { itemId: 'item_ironclad_plate_armor', equip: true },
        { itemId: 'item_salamander_charm', equip: true },
        { itemId: 'item_chronos_lens', equip: true },
      ],
    });
    const d = derive(p, content);
    expect(d).toMatchObject({
      magic: 8, atk: 14, sp: 11, armor: 6, ward: -2, accuracy: 92, hpMax: 130, mpMax: 36 + 16 + 10,
      mpCostReduction: 0.2, lifeSteal: 0.05, statusImmunities: ['status_burn'], resistSteps: { fire: 1 },
    });
    for (const type of ['physical', 'fire', 'storm', 'ley', 'void', 'chrono'] as const) expect(d.damagePct[type]).toBeCloseTo(0.05);
    expect(d.passives.map((x) => x.kind)).toEqual(['mpCostReduction', 'lifeSteal', 'statusImmunity', 'statusImmunity', 'damageBonus']);
  });

  test('crit is capped at 60; accuracy/evasion/crit use ⌊AGI/2⌋', () => {
    const p = player();
    p.stats.agility = 11;
    expect(derive(p, content)).toMatchObject({ accuracy: 90, evasion: 5, crit: 10, initiative: 11 });
    p.stats.agility = 120;
    expect(derive(p, content).crit).toBe(60);
  });

  test('hit% = clamp(accuracy − evasion, 50, 100)', () => {
    const { config } = content;
    expect(hitChance(89, 4, config)).toBe(85);
    expect(hitChance(60, 30, config)).toBe(50);
    expect(hitChance(130, 2, config)).toBe(100);
  });

  test('flee% = clamp(40 + 3·AGI − 2·max enemy AGI, 10, 90) + 15 per failed attempt', () => {
    const { config } = content;
    expect(fleeChance(8, 5, 0, config)).toBe(54);
    expect(fleeChance(8, 5, 2, config)).toBe(84);
    expect(fleeChance(30, 0, 0, config)).toBe(90);
    expect(fleeChance(30, 0, 1, config)).toBe(100);
    expect(fleeChance(0, 30, 0, config)).toBe(10);
    expect(fleeChance(0, 30, 1, config)).toBe(25);
  });

  test('passiveBonuses add to primaries and maxima', () => {
    const p = player();
    p.passiveBonuses = { strength: 2, hpMax: 5, mpMax: 3, agility: 2 };
    expect(derive(p, content)).toMatchObject({ strength: 12, hpMax: 129, mpMax: 51, atk: 16, agility: 10, initiative: 10 });
  });
});

// ---- DESIGN §7.2 rarity ------------------------------------------------------------------------------------------------

describe('DESIGN §7.2 rarity scaling', () => {
  const ladder = (base: number) => RARITY_ORDER.map((r) => rarityScaled(base, r, content.config.rarityStatMult));

  test('×1.0/1.1/1.25/1.5/1.75, round half up, at least +1 over the previous tier', () => {
    expect(ladder(4)).toEqual([4, 5, 6, 7, 8]);
    expect(ladder(10)).toEqual([10, 11, 13, 15, 18]);
    expect(ladder(20)).toEqual([20, 22, 25, 30, 35]);
    expect(ladder(1)).toEqual([1, 2, 3, 4, 5]);
  });

  test('zero and negative values are not scaled', () => {
    expect(ladder(0)).toEqual([0, 0, 0, 0, 0]);
    expect(ladder(-2)).toEqual([-2, -2, -2, -2, -2]);
  });

  test('weapons scale power/spell power, armor armor/ward, trinkets their primaries; nothing else', () => {
    const items = content.items;
    const at = (id: string, r: Rarity) => itemStats(items[id]!, r, content);
    expect(at('item_elven_bow', 'uncommon')).toMatchObject({ power: 9, agility: 1 });
    expect(at('item_necromancer_staff', 'legendary')).toMatchObject({ power: 8, spellPower: 7 });
    expect(at('item_ironclad_plate_armor', 'rare')).toMatchObject({ armor: 8, ward: -2 });
    expect(at('item_chronos_lens', 'epic')).toMatchObject({ magic: 5, mpMax: 10 });
    expect(at('item_salamander_charm', 'legendary')).toMatchObject({ accuracy: 3, hpMax: 10 });
    expect(at('item_glow_moss', 'legendary')).toEqual(items.item_glow_moss!.stats);
  });

  test('derive reads the instance rarity', () => {
    const p = player({
      items: [
        { itemId: 'item_elven_bow', rarity: 'uncommon', equip: true },
        { itemId: 'item_ironclad_plate_armor', rarity: 'rare', equip: true },
        { itemId: 'item_chronos_lens', rarity: 'epic', equip: true },
      ],
    });
    expect(derive(p, content)).toMatchObject({ magic: 11, agility: 9, atk: 19, sp: 11, armor: 8, ward: -2, mpMax: 36 + 22 + 10, initiative: 9 });
  });
});

// ---- DESIGN §7.3 affixes ------------------------------------------------------------------------------------------------

describe('DESIGN §7.3 affixes', () => {
  test('each affix applies its own slot effect; a unique affix counts once', () => {
    const p = player({
      items: [
        { itemId: 'item_wildling_hide_armor', affixes: ['affix_of_vigor', 'affix_of_iron'], equip: true },
        { itemId: 'item_glyphbound_lantern', affixes: ['affix_of_echoes', 'affix_of_ley'], equip: true },
        { itemId: 'item_glyphbound_lantern', affixes: ['affix_of_echoes', 'affix_of_the_warden'], equip: true },
      ],
      patch: (s) => void (s.player.equipment.weapon!.affixes = ['affix_of_the_gale', 'affix_of_the_hunt', 'affix_of_the_wellspring']),
    });
    const d = derive(p, content);
    expect(d).toMatchObject({
      magic: 8,
      hpMax: 129, // ⌊(100 + 20) × 1.08⌋
      mpMax: 36 + 16 + 5,
      crit: 14,
      initiative: 10,
      armor: 4,
      ward: 1,
      guardValue: 0.55,
      resourceGainPct: 0.25,
    });
    expect(d.passives.filter((x) => x.kind === 'custom')).toHaveLength(1);
  });

  test('armor vs trinket effects of the same affix differ', () => {
    const armor = derive(player({ items: [{ itemId: 'item_wildling_hide_armor', affixes: ['affix_of_embers', 'affix_of_the_gale', 'affix_of_the_warden', 'affix_of_the_wellspring'], equip: true }] }), content);
    expect(armor).toMatchObject({ resistSteps: { fire: 1 }, evasion: 9, initiative: 8, guardValue: 0.6, regen: { hp: 0, mp: 2 } });
    expect(armor.damagePct).toEqual({});
    const trinket = derive(player({ items: [{ itemId: 'item_glyphbound_lantern', affixes: ['affix_of_embers', 'affix_of_the_gale', 'affix_of_vigor'], equip: true }] }), content);
    expect(trinket).toMatchObject({ resistSteps: {}, evasion: 9, initiative: 10, hpMax: 126 });
    expect(trinket.damagePct.fire).toBeCloseTo(0.1);
  });

  test('an affix with no effect on that slot, or an unknown affix id, does nothing', () => {
    const base = derive(player(), content);
    const p = player({ patch: (s) => void (s.player.equipment.weapon!.affixes = ['affix_of_vigor', 'affix_of_nowhere']) });
    expect(derive(p, content)).toEqual(base);
  });
});

// ---- carried items, Corruption, statuses -----------------------------------------------------------------------------------

describe('carried quest items (DESIGN §7.1) and Corruption (§6.7)', () => {
  test('the Amulet of Echoes applies from the Satchel: +1 MAG and itm_echo_bolt, one copy only', () => {
    const p = player({ items: ['item_amulet_of_echoes', 'item_amulet_of_echoes'] });
    expect(derive(p, content)).toMatchObject({ magic: 7, sp: 7, mpMax: 50, grantedAbilities: ['itm_echo_bolt'] });
  });

  test('gear in the pack (not equipped) does nothing', () => {
    expect(derive(player({ items: ['item_chronos_lens', 'item_ironclad_plate_armor'] }), content)).toEqual(derive(player(), content));
  });

  test('Wizard and Shadow Weaver: +1 SP per point; others +5 % Void per point; all −3 % Ley per point', () => {
    const wizard = derive(player({ classId: 'wizard', corruption: 4 }), content);
    expect(wizard.sp).toBe(16);
    expect(wizard.damagePct.void).toBeUndefined();
    expect(wizard.damagePct.ley).toBeCloseTo(-0.12);
    expect(derive(player({ classId: 'shadow_weaver', corruption: 2 }), content).sp).toBe(12);
    const ranger = derive(player({ corruption: 2 }), content);
    expect(ranger.sp).toBe(6);
    expect(ranger.damagePct.void).toBeCloseTo(0.1);
    expect(ranger.damagePct.ley).toBeCloseTo(-0.06);
  });

  test('Corruption 6 ("Marked for the Weavers"): max HP −10 %', () => {
    expect(derive(player({ corruption: 5 }), content).hpMax).toBe(120);
    expect(derive(player({ corruption: 6 }), content).hpMax).toBe(108);
  });
});

describe('status hooks', () => {
  const withStatuses = (...ids: string[]) => player({ items: [{ itemId: 'item_wildling_hide_armor', equip: true }], patch: (s) => void (s.player.statuses = ids.map(status)) });

  test("the player's own statuses apply by default", () => {
    expect(derive(withStatuses('status_rested'), content)).toMatchObject({ initiative: 10, accuracy: 94 });
    expect(derive(withStatuses('status_slow'), content)).toMatchObject({ initiative: 3, evasion: -6 });
    expect(derive(withStatuses('status_haste', 'status_blind'), content)).toMatchObject({ initiative: 13, evasion: 14, accuracy: 59 });
    expect(derive(withStatuses('status_armor_break'), content)).toMatchObject({ armor: 0, ward: 0 });
    expect(derive(withStatuses('status_poison', 'status_unknown'), content)).toEqual(derive(withStatuses(), content));
  });

  test('a caller-supplied list (a combat snapshot) replaces them', () => {
    const p = withStatuses('status_rested');
    expect(derive(p, content, { statuses: [] }).initiative).toBe(8);
    expect(derive(p, content, { statuses: [status('status_shock')] }).accuracy).toBe(74);
  });
});

describe('errors', () => {
  test('unknown class or item ids are programmer errors', () => {
    expect(() => derive({ ...player(), classId: 'bard' }, content)).toThrow("unknown class 'bard'");
    const bad: ItemInstance = { uid: 'i99', itemId: 'item_nope', qty: 1, rarity: 'common', affixes: [] };
    expect(() => derive({ ...player(), inventory: [bad] }, content)).toThrow("unknown item 'item_nope'");
    expect(() => derive({ ...player(), equipment: { weapon: bad, armor: null, trinket1: null, trinket2: null } }, content)).toThrow('item_nope');
  });
});

// ---- syncMaxima -------------------------------------------------------------------------------------------------------

describe('syncMaxima', () => {
  test('moves current HP/MP with the maximum, so a round trip is neutral', () => {
    const p = player({ hp: 60, mp: 20 });
    p.passiveBonuses = { hpMax: 10, mpMax: -8 };
    expect(syncMaxima(p, content)).toBe(true);
    expect(p).toMatchObject({ hp: 70, hpMax: 130, mp: 12, mpMax: 40 });
    p.passiveBonuses = {};
    expect(syncMaxima(p, content)).toBe(true);
    expect(p).toMatchObject({ hp: 60, hpMax: 120, mp: 20, mpMax: 48 });
    expect(syncMaxima(p, content)).toBe(false);
  });

  test('a lower maximum never kills (min 1 HP) and MP floors at 0; 0 HP stays 0 either way', () => {
    const p = player({ hp: 5, mp: 3 });
    p.passiveBonuses = { hpMax: -50, mpMax: -20 };
    syncMaxima(p, content);
    expect(p).toMatchObject({ hp: 1, hpMax: 70, mp: 0, mpMax: 28 });
    const dead = player({ hp: 0 });
    dead.passiveBonuses = { hpMax: 10 };
    syncMaxima(dead, content);
    expect(dead).toMatchObject({ hp: 0, hpMax: 130 });
    dead.passiveBonuses = { hpMax: -20 };
    syncMaxima(dead, content);
    expect(dead).toMatchObject({ hp: 0, hpMax: 100 });
  });

  test('the fixture pack (two classes) derives the same as the character pack', () => {
    const p = makeState({ classId: 'wizard', level: 7 }).player;
    expect(derive(p, fixturePack())).toEqual(derive(p, content));
  });
});
