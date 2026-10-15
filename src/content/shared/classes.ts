// The five classes (DESIGN §3.3 base stats and growth, §5.2–5.6 resources, branches and starting kits; D-008, D-061).
// Pattern for content files: plain object literals, every field written out, `satisfies XInput[]` (PLAN §5.17).
//
// - Resources: each class lists the events that fill its pool. Guard is the universal +5 (`config.guardResource`); it is
//   written on every class anyway so the table reads as DESIGN does (the Warden's +8 replaces it), and the Weaver,
//   whose pool fills from nothing else, needs one rule.
// - Starting kits are DESIGN §5.2–5.6's; the item records live in `src/content/items/starter.ts` until the item units
//   own them. Every class starts with 30 gold and no ability: 1 AP at level 1 buys a Tier-1 ability (DESIGN §5.1).
// - `intro` keeps the legacy class-select lines for Ranger, Wizard and Elf (legacy/echoes_of_aethelgard.py CLASS_DEFS);
//   the Warden's and the Weaver's follow their pattern.
// - `uniqueQuestId` (q_class_<class>, STORY §11.8) is set by the quest unit that authors those quests: a reference to a
//   missing quest is a rule-1 error.
import type { ClassInput } from '@schema/class';

export const classes = [
  {
    id: 'ranger',
    name: 'Ranger',
    title: 'hunter of the wilds between settlements',
    description:
      'You read the ground before the sky, carry three kinds of knife and a bow you made yourself, and have never once asked a ley line for help. Good HP, honest Physical damage, and a tool for every situation. Basic attacks build Focus; abilities spend it.',
    intro: 'As a Ranger, you possess adept strength in combat, a vital skill in these fractured lands.',
    baseStats: { hp: 100, mp: 36, strength: 10, magic: 6, agility: 8 },
    growth: { hp: 8, mp: 3 },
    resource: {
      name: 'Focus',
      rules: [
        { on: 'basic_hit', amount: 8 },
        { on: 'basic_crit', amount: 12 },
        { on: 'guard', amount: 5 },
      ],
    },
    branches: [
      { id: 'hunt', name: 'Hunt', description: 'Marks, clean shots and the one arrow you have been saving.' },
      { id: 'steel', name: 'Steel', description: 'Bleeds, counters and close work that finishes what the first cut started.' },
      { id: 'wildcraft', name: 'Wildcraft', description: 'Poison, traps, smoke and field medicine.' },
    ],
    starterItems: [
      { itemId: 'item_rusty_dagger', equip: true },
      { itemId: 'item_ley_touched_tonic', count: 2 },
    ],
    startingAbilities: [],
    startingGold: 30,
    dialogueTag: 'ranger',
    sigil: 'ranger',
    legacy: true,
  },
  {
    id: 'wizard',
    name: 'Wizard',
    title: 'self-taught ley-caster',
    description:
      'Nobody trained you; the Dark Spellbooks did, and they are not kind teachers. A big pool, steady regeneration, a fragile body. Pyre burns, Storm chains, Chronomancy bends the order of things.',
    intro: 'As a Wizard, you possess potent magical abilities, a rare gift in a world scarred by wild energies.',
    baseStats: { hp: 84, mp: 50, strength: 6, magic: 11, agility: 7 },
    growth: { hp: 6, mp: 5 },
    resource: {
      name: 'Mana',
      rules: [
        // 3 + ⌊level/4⌋ MP at the start of each of your turns (D-066 #3): 3 at L1, 6 at L12, 8 at L20.
        { on: 'turn_start', amount: 3, perLevel: { every: 4, add: 1 } },
        { on: 'guard', amount: 5 },
      ],
    },
    branches: [
      { id: 'pyre', name: 'Pyre', description: 'Fire and Burn: the flame that lit the Conflux.' },
      { id: 'storm', name: 'Storm', description: 'Storm and Shock: lightning that chains from one foe to the next.' },
      { id: 'chronomancy', name: 'Chronomancy', description: 'Slow, Stun and Rewind: bend the order of things.' },
    ],
    starterItems: [
      { itemId: 'item_apprentice_staff', equip: true },
      { itemId: 'item_mana_bloom', count: 1 },
      { itemId: 'item_ley_touched_tonic', count: 1 },
    ],
    startingAbilities: [],
    startingGold: 30,
    dialogueTag: 'wizard',
    sigil: 'wizard',
    legacy: true,
  },
  {
    id: 'elf',
    name: 'Elf',
    title: 'Silverwood-blooded ley-duelist',
    description:
      "The old bloodlines of the capital: long-lived, ley-sensitive, trained to fight the way the city's fountains moved. Fast, evasive, and the only class that heals as naturally as it cuts. Dodges and crits restore Mana.",
    intro: 'As an Elf, your agility skills may come in handy, allowing you to navigate the perilous echoes of Aethelgard.',
    baseStats: { hp: 90, mp: 44, strength: 7, magic: 7, agility: 10 },
    growth: { hp: 7, mp: 4 },
    resource: {
      name: 'Mana',
      rules: [
        // +10 when an attack against you misses or is Phased, +6 on each of your crits.
        { on: 'dodge', amount: 10 },
        { on: 'crit', amount: 6 },
        { on: 'guard', amount: 5 },
      ],
    },
    branches: [
      { id: 'bladesong', name: 'Bladesong', description: 'Fast multi-hits: every verse of the song builds the next.' },
      { id: 'leyweave', name: 'Leyweave', description: 'Heals, Shields, Regen and Ley damage.' },
      { id: 'shadowstep', name: 'Shadowstep', description: 'Phase, ambush and the guaranteed crit.' },
    ],
    starterItems: [
      { itemId: 'item_primitive_bow', equip: true },
      { itemId: 'item_glow_moss', count: 2 },
    ],
    startingAbilities: [],
    startingGold: 30,
    dialogueTag: 'elf',
    sigil: 'elf',
    legacy: true,
  },
  {
    id: 'ironclad_warden',
    name: 'Ironclad Warden',
    title: "the Nomads' wall",
    description:
      'Steel and stubbornness. You win by being the last one standing and making sure everything is hitting you. Slow, heavy, nearly immune to being rushed. Every blow you take builds Grit.',
    intro: "As an Ironclad Warden, you are the Nomads' wall: slow, heavy, and very hard to move.",
    baseStats: { hp: 116, mp: 30, strength: 12, magic: 5, agility: 7 },
    growth: { hp: 11, mp: 2 },
    resource: {
      name: 'Grit',
      rules: [
        // +6 per enemy hit taken, +8 per Guard (replaces the universal +5), +4 per enemy Taunted by Challenge.
        { on: 'hit_taken', amount: 6 },
        { on: 'guard', amount: 8 },
        { on: 'taunt', amount: 4 },
      ],
    },
    branches: [
      { id: 'bulwark', name: 'Bulwark', description: 'Guard, Taunt and Shields: be the wall.' },
      { id: 'breaker', name: 'Breaker', description: 'Armor Break, Stun and the heavy blow that follows.' },
      { id: 'iron_will', name: 'Iron Will', description: 'Cleanses, resistances and interrupted spells.' },
    ],
    starterItems: [
      { itemId: 'item_nomads_maul', equip: true },
      { itemId: 'item_scrap_harness', equip: true },
      { itemId: 'item_ley_touched_tonic', count: 1 },
    ],
    startingAbilities: [],
    startingGold: 30,
    dialogueTag: 'warden',
    sigil: 'warden',
    legacy: false,
  },
  {
    id: 'shadow_weaver',
    name: 'Shadow Weaver',
    title: 'void-touched',
    description:
      "You have heard the Chasm's murmur and answered. Your spells unmake; your body is the purse you pay from. Short of Mana, you pay in blood: 2 HP for every missing MP.",
    intro: "As a Shadow Weaver, you answered the Chasm's murmur, and when the Mana runs dry you pay in blood.",
    baseStats: { hp: 90, mp: 48, strength: 6, magic: 10, agility: 8 },
    growth: { hp: 7, mp: 4 },
    resource: {
      name: 'Mana',
      rules: [{ on: 'guard', amount: 5 }],
      // Blood price: any ability may be cast short of MP for 2 HP per missing MP (never the last HP; D-066 #5).
      bloodPrice: { hpPerMp: 2 },
    },
    branches: [
      { id: 'hex', name: 'Hex', description: 'Weaken, Curse and slow ruin: take the strength out of the arm before it swings.' },
      { id: 'drain', name: 'Drain', description: 'Void that heals you as it hurts them.' },
      { id: 'unmaking', name: 'Unmaking', description: 'Raw Void bought with your own HP: end things quickly or die trying.' },
    ],
    starterItems: [
      { itemId: 'item_cracked_void_focus', equip: true },
      { itemId: 'item_dark_spellbook', count: 1 },
      { itemId: 'item_ley_touched_tonic', count: 1 },
    ],
    startingAbilities: [],
    startingGold: 30,
    dialogueTag: 'weaver',
    sigil: 'weaver',
    legacy: false,
  },
] satisfies ClassInput[];
