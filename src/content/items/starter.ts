// STARTER ITEMS — minimal records of the ten items the class starting kits name (DESIGN §5.2–5.6), so the classes'
// `starterItems` references resolve (PLAN §5.19 rule 1) before the item units land. Numbers are DESIGN §7.7's legacy rows;
// the three new kit pieces take DESIGN §5.5–5.6's numbers and WORLD §7's values and descriptions.
//
// HANDOVER: the item unit that authors these ids (WORLD §7: global consumables, start-kit gear, the Dark Spellbook's
// Echo rules) moves each record to its home file and deletes it here — ids are unique across the pack, so a second
// record is a duplicate-id error. Until then nothing else in the pack may define these ids. `sources` are left out:
// they name merchants and creatures that do not exist yet (rule 1).
import type { ItemInput } from '@schema/item';

export const starterItems = [
  // weapons — the five kit weapons, one per class (DESIGN §5.7 weapon types)
  {
    id: 'item_rusty_dagger',
    name: 'Rusty Dagger',
    legacyName: 'Rusty Dagger',
    description: 'A pitted blade with a faint echo of old magic.',
    type: 'weapon',
    slot: 'weapon',
    weaponType: 'melee',
    tier: 1,
    stats: { power: 4 },
    value: 8,
    art: { icon: 'dagger' },
  },
  {
    id: 'item_apprentice_staff',
    name: 'Apprentice Staff',
    legacyName: 'Apprentice Staff',
    description: 'A basic wooden staff, suitable for channeling nascent magical energies.',
    type: 'weapon',
    slot: 'weapon',
    weaponType: 'magic_staff',
    tier: 1,
    stats: { power: 2, spellPower: 1 },
    // MP costs −10 % (DESIGN §5.1: rounded down, minimum 1).
    passives: [{ kind: 'mpCostReduction', pct: 0.1 }],
    value: 30,
    art: { icon: 'staff' },
  },
  {
    id: 'item_primitive_bow',
    name: 'Primitive Bow',
    legacyName: 'Primitive Bow',
    description: 'A simple hunting bow, crudely fashioned but effective for a quick shot.',
    type: 'weapon',
    slot: 'weapon',
    weaponType: 'ranged_bow',
    tier: 1,
    stats: { power: 4 },
    value: 15,
    art: { icon: 'bow' },
  },
  {
    id: 'item_nomads_maul',
    name: "Nomad's Maul",
    description: 'A Nomad training maul. The haft is older than the head.',
    type: 'weapon',
    slot: 'weapon',
    weaponType: 'shield_heavy',
    tier: 1,
    stats: { power: 5, accuracy: -5 },
    value: 18,
    art: { icon: 'maul' },
  },
  {
    id: 'item_cracked_void_focus',
    name: 'Cracked Void Focus',
    description: 'A palm of black glass with a split down it. Light goes in and does not come back.',
    type: 'weapon',
    slot: 'weapon',
    weaponType: 'void_focus',
    tier: 1,
    stats: { power: 2, spellPower: 2 },
    value: 20,
    art: { icon: 'void_focus' },
  },
  // armor — the Warden's harness
  {
    id: 'item_scrap_harness',
    name: 'Scrap Harness',
    description: "Offcuts from Borin's floor, buckled together. It will do until it won't.",
    type: 'armor',
    slot: 'armor',
    armorClass: 'heavy',
    tier: 1,
    stats: { armor: 2, ward: 0 },
    value: 12,
    art: { icon: 'harness' },
  },
  // consumables (stack 10)
  {
    id: 'item_ley_touched_tonic',
    name: 'Ley-Touched Tonic',
    legacyName: 'Ley-Touched Tonic',
    description: 'A swirling vial that smells like rain on stone. Restores health and mana.',
    type: 'consumable',
    tier: 1,
    onUse: [{ heal: { hp: 25, mp: 15 } }],
    value: 12,
    art: { icon: 'vial' },
  },
  {
    id: 'item_mana_bloom',
    name: 'Mana Bloom',
    legacyName: 'Mana Bloom',
    description: 'A rare blossom steeped in ley mist. It brings cool clarity.',
    type: 'consumable',
    tier: 1,
    onUse: [{ heal: { hp: 10, mp: 30 } }],
    value: 25,
    art: { icon: 'bloom' },
  },
  {
    id: 'item_glow_moss',
    name: 'Glow Moss',
    legacyName: 'Glow Moss',
    description: 'Bioluminescent moss steeped in swamp magic. It soothes wounds.',
    type: 'consumable',
    tier: 1,
    onUse: [{ heal: { hp: 20, mp: 5 } }],
    value: 10,
    art: { icon: 'moss' },
  },
  // the tome — the Weaver's lure (DESIGN §6.7; read out of combat: −15 HP, +1 Corruption)
  {
    id: 'item_dark_spellbook',
    name: 'Dark Spellbook',
    legacyName: 'Dark Spellbook',
    description:
      'A charred tome of corrupted secrets. Reading its forbidden pages unlocks new magical abilities, but at a cost to your vitality.',
    type: 'tome',
    tier: 0,
    onUse: [{ damage: { hp: 15 } }, { corruption: 1 }],
    usableInCombat: false,
    value: 8,
    art: { icon: 'tome' },
  },
] satisfies ItemInput[];
