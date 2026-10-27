// U17: one authored record per new table, taken from STORY / WORLD / DESIGN (the source section is cited on each).
// Shared by the per-schema tests and contentPack.test.ts. These are inputs (`satisfies XInput`): defaults not applied.
import type { AchievementInput } from '@schema/achievement';
import type { AbilityInput } from '@schema/ability';
import type { AttunementInput } from '@schema/attunement';
import type { ClassInput } from '@schema/class';
import type { CodexEntryInput } from '@schema/codex';
import type { EchoInput } from '@schema/echo';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { EndingInput } from '@schema/ending';
import type { FactionInput } from '@schema/faction';
import type { LocationInput } from '@schema/location';
import type { MerchantInput } from '@schema/merchant';
import type { ModifierInput } from '@schema/modifier';
import type { NpcInput } from '@schema/npc';
import type { QuestInput } from '@schema/quest';
import type { RecipeInput } from '@schema/recipe';
import type { RegionInput } from '@schema/region';

/** STORY §11.2 `q_echo_crystal` (legacy): Reach the Library → take the Crystal → return and choose (Give / Keep). D-017 deltas. */
export const questEchoCrystal = {
  id: 'q_echo_crystal',
  name: 'Echoes in the Library',
  description: 'Ilyra asks you to retrieve the Echo Crystal from the Shattered Library and to decide whom it should answer to.',
  category: 'legacy',
  botHint: 'explorer',
  giverNpcId: 'npc_ilyra',
  factionId: 'remnants',
  stages: [
    {
      id: 'reach_library',
      journal: 'Retrieve the Echo Crystal from the Shattered Library to the north of Whispering Ruins.',
      objectives: [{ id: 'obj_reach_library', text: 'Reach the Shattered Library', when: { location: 'loc_shattered_library' }, hintLocationId: 'loc_shattered_library' }],
      next: 'take_crystal',
    },
    {
      id: 'take_crystal',
      journal: 'The Crystal lies in the third alcove behind the fallen shelf.',
      objectives: [{ id: 'obj_take_crystal', text: 'Take the Echo Crystal', when: { item: { id: 'item_echo_crystal' } } }],
      next: 'return_to_ilyra',
    },
    {
      id: 'return_to_ilyra',
      journal: 'Bring the Crystal back to Ilyra and choose whom it speaks for.',
      objectives: [{ id: 'obj_choose', text: 'Decide the Crystal\'s fate', when: { any: [{ flag: 'flag_crystal_given' }, { flag: 'flag_kept_echo_crystal' }] } }],
      next: [
        { when: { flag: 'flag_crystal_given' }, to: 'done_given' },
        { when: { flag: 'flag_kept_echo_crystal' }, to: 'done_kept' },
      ],
    },
    { id: 'done_given', journal: 'You gave the Crystal to the Remnants.', outcome: 'complete', onEnter: [{ rep: { faction: 'remnants', delta: 15 } }] },
    {
      id: 'done_kept',
      journal: 'You kept the Crystal. Its whispers are yours alone.',
      outcome: 'complete',
      onEnter: [
        { rep: { faction: 'weavers', delta: 10 } },
        { rep: { faction: 'remnants', delta: -10 } },
      ],
    },
  ],
  rewards: { xp: 120, gold: 20 },
  shortcuts: [{ echo: 'echo_crystal_location', skipTo: 'take_crystal', text: 'You remember: third alcove, behind the fallen shelf.' }],
} satisfies QuestInput;

/** STORY §13 `scene_first_meeting_ilyra`: the opening scene; from Loop 2 it gains Echo and loop-aware choices. */
export const sceneFirstMeetingIlyra = {
  id: 'scene_first_meeting_ilyra',
  npcId: 'npc_ilyra',
  title: 'The whispers are louder',
  entry: 'greet',
  nodes: [
    {
      id: 'greet',
      speaker: 'npc_ilyra',
      text: 'The whispers here are louder each day. The past is trying to speak. Will you help me listen?',
      textVariants: [
        {
          when: { loop: { min: 2 } },
          text: 'She has a smudge of ink on her thumb. You remember the smudge. "The whispers here are louder each day. The past is trying to speak. Will you help me listen?"',
        },
      ],
      mood: 'warm',
      choices: [
        { id: 'yes', text: 'Yes.', hotkey: '1', effects: [{ questStart: 'q_echo_crystal' }], next: 'end' },
        { id: 'no', text: 'No.', hotkey: '2', next: 'declined' },
        {
          id: 'done_before',
          text: "Ilyra, I've done this before.",
          hotkey: '3',
          when: { loop: { min: 2 } },
          effects: [{ setFlag: 'flag_ilyra_told' }],
          next: 'told',
        },
        {
          id: 'the_ink',
          text: 'The ink still holds.',
          hotkey: '4',
          when: { echo: 'echo_ilyra_watchword' },
          echoHint: 'echo_ilyra_watchword',
          tags: ['echo'],
          effects: [{ rep: { faction: 'remnants', delta: 10 } }],
          next: 'recruitable',
        },
        {
          id: 'third_alcove',
          text: 'Third alcove, behind the fallen shelf.',
          hotkey: '5',
          when: { echo: 'echo_crystal_location' },
          echoHint: 'echo_crystal_location',
          tags: ['echo'],
          oncePerLoop: true,
          effects: [{ questStart: 'q_echo_crystal' }, { questAdvance: { quest: 'q_echo_crystal', stage: 'take_crystal' } }],
          next: 'end',
        },
      ],
    },
    { id: 'declined', speaker: 'narrator', text: 'Ilyra nods, her eyes shadowed with disappointment.', mood: 'grim', next: 'end' },
    {
      id: 'told',
      speaker: 'npc_ilyra',
      text: "Then you'll know I say yes to that with a smile and don't believe a word. Help me listen anyway.",
      mood: 'wry',
      next: 'end',
    },
    {
      id: 'recruitable',
      speaker: 'npc_ilyra',
      text: '...I have never said that aloud. Sit down. Tell me everything, and tell me quickly, because if you know that you know how little time we have.',
      mood: 'afraid',
      next: 'end',
    },
  ],
} satisfies DialogueSceneInput;

/** WORLD §4: Ilyra, the Remnant scholar and companion anchor. */
export const npcIlyra = {
  id: 'npc_ilyra',
  name: 'Ilyra',
  description: "Remnant scholar, about thirty, in faded robes by a cold fire. Oriel Danthe's descendant; she does not know it.",
  factionId: 'remnants',
  homeLocationId: 'loc_whispering_ruins',
  portrait: { sigil: 'quill' },
  roles: ['questgiver', 'companion', 'lore'],
  companionId: 'ilyra',
  barks: [
    { text: 'The whispers are louder each day, Wayfinder. You hear them too, I think?' },
    { text: 'Ink remembers what hands forget. That is the whole of my faith.' },
  ],
  age: 30,
} satisfies NpcInput;

/** WORLD §4 / §9: Kaelen Stonehand, the neutral-ground trader (his own stall, `merchantId` = his id). */
export const npcKaelen = {
  id: 'npc_kaelen_stonehand',
  name: 'Kaelen Stonehand',
  description: 'Trader, about forty-four; left the Nomads and kept the name. Has not spoken to Brak in years.',
  homeLocationId: 'loc_wayfarers_respite',
  portrait: { sigil: 'scales', accent: '#c9a227' },
  roles: ['merchant', 'questgiver'],
  merchantId: 'npc_kaelen_stonehand',
  barks: [{ text: 'Tonic\'s three. Fair weight. The road east is not.' }],
} satisfies NpcInput;

/** WORLD §9.1–9.2 `npc_kaelen_stonehand`: core stock, a rolled pool of T1–T2 gear, the best of the three rep tiers, never refuses. */
export const merchantKaelen = {
  id: 'npc_kaelen_stonehand',
  npcId: 'npc_kaelen_stonehand',
  name: "The Wayfarer's Respite",
  stock: [
    { itemId: 'item_ley_touched_tonic', count: 3 },
    { itemId: 'item_mana_bloom', count: 1 },
    { itemId: 'item_antidote_root', count: 2 },
    { itemId: 'item_glow_moss', count: 3 },
    { itemId: 'mat_steppe_salt', count: 2 },
    { itemId: 'mat_ley_resin', count: 3 },
    { itemId: 'item_glyphbound_lantern', count: 1, when: { loop: { min: 2 } } },
  ],
  rollStock: {
    pool: ['item_rusty_dagger', 'item_travelers_sword', 'item_primitive_bow', 'item_elven_bow', 'item_apprentice_staff', 'item_nomads_maul', 'item_ironclad_mail'],
    pick: { min: 3, max: 4 },
  },
  regionMarkup: 1,
  repFaction: 'best',
  services: ['buy', 'sell'],
} satisfies MerchantInput;

/** STORY §12: `echo_litany_verse_1` "The Witness". */
export const echoLitanyVerse1 = {
  id: 'echo_litany_verse_1',
  name: 'The Witness',
  codexLine: 'First verse of the Litany. Give the Crystal and Ilyra speaks it on your next meeting; keep it and Listen. Someone has to witness a thing for it to have happened.',
  category: 'lore',
  obtainedBy: ['dialogue:scene_echo_crystal:give', 'quest:q_the_first_drowned', 'item:item_litany_page_1'],
  timelineGroup: 'litany',
} satisfies EchoInput;

/** STORY §14 plan: a Remnant Archive entry on the Circle. */
export const codexNinefoldCircle = {
  id: 'codex_ninefold_circle',
  title: 'The Ninefold Circle',
  voice: 'remnant_archive',
  category: 'the_nine',
  body: 'Nine mages of Silverwood, chosen one from each discipline, who bound the Breach in the last hour of the old city and kept the Holding until it kept them.',
  unlockWhen: { echo: 'echo_litany_verse_1' },
  date: 'Year 412 of the Sundering',
} satisfies CodexEntryInput;

/** DESIGN §11.5 / §15.2 `ach_two_oaths`: Sworn with two factions in one loop (hidden). */
export const achievementTwoOaths = {
  id: 'ach_two_oaths',
  name: 'Two Oaths',
  description: 'Sworn with two factions in one loop.',
  hidden: true,
  when: {
    any: [
      { all: [{ rep: { faction: 'remnants', min: 60 } }, { rep: { faction: 'ironclad', min: 60 } }] },
      { all: [{ rep: { faction: 'remnants', min: 60 } }, { rep: { faction: 'weavers', min: 60 } }] },
      { all: [{ rep: { faction: 'weavers', min: 60 } }, { rep: { faction: 'ironclad', min: 60 } }] },
    ],
  },
  icon: 'two_oaths',
} satisfies AchievementInput;

/** DESIGN §10.7. */
export const attunementSteadyHand = {
  id: 'att_steady_hand',
  name: 'Steady Hand',
  description: '+5% max HP.',
  cost: 20,
  effects: [{ kind: 'hp_max_pct', pct: 0.05 }],
  icon: 'steady_hand',
} satisfies AttunementInput;

/** DESIGN §10.7: Breach Clock +1 day (4 watches), requires `echo_breach_clock`. */
export const attunementSteadyHours = {
  id: 'att_steady_hours',
  name: 'Steady Hours',
  description: 'The Breach Clock runs one day longer.',
  cost: 50,
  effects: [{ kind: 'clock_watches', watches: 4 }],
  requires: { echo: 'echo_breach_clock' },
  icon: 'steady_hours',
} satisfies AttunementInput;

/** DESIGN §15.1 / §10.1: base clock 20 days (80 watches), every other clock modifier halved. */
export const modifierFrayedClock = {
  id: 'mod_frayed_clock',
  name: 'Frayed Clock',
  description: 'Base clock 20 days; all clock modifiers halved toward zero.',
  rules: [{ kind: 'clock_base_watches', watches: 80, halveOthers: true }],
  icon: 'frayed_clock',
} satisfies ModifierInput;

/** STORY §10.1 ending A. */
export const endingWardensVigil = {
  id: 'ending_wardens_vigil',
  letter: 'A',
  kind: 'true',
  name: "The Warden's Vigil",
  tagline: 'The Breach is held, not sealed.',
  requirements: {
    all: [{ echo: 'echo_litany_complete' }, { flag: 'flag_tyrant_spared' }, { resolve: { min: 6 } }, { location: 'loc_temporal_breach_apex' }],
  },
  requirementTexts: [{ when: { not: { echo: 'echo_litany_complete' } }, text: 'You do not yet know all nine verses.' }],
  sequence: [
    { text: 'Communion, Movement III. Veyran: "You have all nine. You could say them. You understand that whoever says the ninth must stay in it."', mood: 'grim' },
    { text: 'Verse nine. "Hour, stay. Be as you are, and do not become. I hold you. I hold you."' },
    { text: 'The sky over the Apex steadies. The Breach Clock stops at the current day and does not restart.' },
  ],
  epilogues: [
    { subject: 'remnants', text: 'The Ledger gains an eighth name and the words "did not die."' },
    { subject: 'ironclad', text: 'Hadda sends a scout to the Apex every year to leave an axe-head on the floor.' },
  ],
  achievementId: 'ach_the_ninth_verse',
  resonance: 50,
  credits: true,
} satisfies EndingInput;

/** STORY §10.7 `closer_escape`: any flight through the Library portal. */
export const closerEscape = {
  id: 'closer_escape',
  kind: 'closer',
  name: 'The Escape',
  tagline: 'Through the Library portal, into the Breach.',
  requirements: { all: [] },
  sequence: [{ text: 'You step through. The stones remember nothing; the Amulet remembers everything.' }],
  resonance: 10,
} satisfies EndingInput;

/** DESIGN §11 / WORLD §2: the Remnants. */
export const factionRemnants = {
  id: 'remnants',
  name: 'Remnants of Aethelgard',
  shortName: 'Remnants',
  description: 'Scribes and keepers who have kept the Ledger of Wayfinders for five hundred years.',
  color: '#c9a227',
  tierTexts: {
    hostile: 'The Keepers close the Ledger when you enter.',
    wary: 'They answer in single sentences.',
    neutral: 'You are a stranger with a good pen.',
    trusted: 'They show you the margins.',
    sworn: 'They have ruled a line for you.',
  },
} satisfies FactionInput;

// ---- records of other units' tables, minimal, for index and assembly tests ---------------------------------------------

export const regionSilverwoodRuins = {
  id: 'region_silverwood_ruins',
  name: 'Silverwood Ruins',
  description: 'The capital, five hundred years dead. Marble under moss. Crystals growing where lanterns hung.',
  order: 1,
  levelBand: { min: 1, max: 4 },
  legacy: true,
  factionId: 'remnants',
  palette: { bg: '#1B1F3B', bgAlt: '#4A3F6B', fg: '#ECEFF4', accent: '#9FD8FF', glow: '#9FD8FF' },
  ambient: 'silverwood_drone',
} satisfies RegionInput;

export const locationWhisperingRuins = {
  id: 'loc_whispering_ruins',
  regionId: 'region_silverwood_ruins',
  name: 'Whispering Ruins',
  description: 'The air smells of ozone and decay, and a chill wind carries faint whispers.',
  exits: [
    { dir: 'north', to: 'loc_crumbling_archway' },
    { dir: 'east', to: 'loc_mistwood_path' },
  ],
  npcs: ['npc_ilyra'],
  art: { template: 'ruins', silhouettes: ['dead_tree', 'tablet'], particles: 'motes', timeOfDay: 'dusk' },
  map: { x: 0, y: 6 },
  safe: true,
} satisfies LocationInput;

export const classRanger = {
  id: 'ranger',
  name: 'Ranger',
  title: 'hunter of the wilds between settlements',
  legacy: true,
  sigil: 'ranger',
  dialogueTag: 'ranger',
  description: 'Good HP, honest Physical damage, and tools for every situation if you spent the points.',
  intro: 'You read the ground before the sky, carry three kinds of knife and a bow you made yourself.',
  baseStats: { hp: 100, mp: 36, strength: 10, magic: 6, agility: 8 },
  growth: { hp: 8, mp: 3 },
  resource: { name: 'Focus', rules: [{ on: 'basic_hit', amount: 8 }, { on: 'basic_crit', amount: 12 }, { on: 'guard', amount: 5 }] },
  branches: [
    { id: 'hunt', name: 'Hunt', description: 'The Hunt branch.' },
    { id: 'steel', name: 'Steel', description: 'The Steel branch.' },
    { id: 'wildcraft', name: 'Wildcraft', description: 'The Wildcraft branch.' },
  ],
  starterItems: [{ itemId: 'item_rusty_dagger', equip: true }, { itemId: 'item_ley_touched_tonic', count: 2 }],
  uniqueQuestId: 'q_class_ranger',
} satisfies ClassInput;

export const abilityMarkedShot = {
  id: 'rgr_marked_shot',
  ownerId: 'ranger',
  branch: 'hunt',
  tier: 1,
  name: 'Marked Shot',
  description: 'Every hunt begins with a choice of prey.',
  mp: 8,
  target: 'enemy',
  damageType: 'physical',
  power: { coef: 1.1, stat: 'atk' },
  statuses: [{ status: 'status_mark', chance: 1, duration: 3 }],
} satisfies AbilityInput;

export const recipeEmberFlask = {
  id: 'recipe_ember_flask',
  name: 'Ember Flask',
  category: 'consumable',
  inputs: [{ itemId: 'mat_ember_ore' }, { itemId: 'mat_ley_resin' }],
  output: { itemId: 'item_ember_flask' },
  gold: 20,
} satisfies RecipeInput;
