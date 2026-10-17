// STARTER ITEMS — minimal records of the kit items that are not gear: the three consumables and the Dark Spellbook the class
// starting kits name (DESIGN §5.2–5.6), so the classes' `starterItems` references resolve (PLAN §5.19 rule 1) before the item
// units land. Numbers are DESIGN §7.7's legacy rows. U49 moved the five kit weapons and the Scrap Harness to items/{weapons,armor}.ts.
//
// HANDOVER: the item unit that authors these ids (WORLD §7: global consumables, the Dark Spellbook's Echo rules) moves each
// record to its home file and deletes it here — ids are unique across the pack, so a second record is a duplicate-id error.
// Until then nothing else in the pack may define these ids. `sources` are left out: they name merchants and creatures that do
// not exist yet (rule 1).
import type { ItemInput } from '@schema/item';

export const starterItems = [
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
