// The fixture pack (PLAN §8, U18): a small, schema-valid world that engine tests run against, so they never break when
// the real content changes. Built only through `buildContentPack` (never cast). Ids, names, numbers and lines are
// WORLD's / STORY's / DESIGN's wherever they fit; the fixture compresses the map and marks every invented line.
//
//   region_silverwood_ruins (1–4)                          region_glowlands_nexus (9–13; Apex 15–18)
//   loc_whispering_ruins ─N─ loc_shattered_library ─E─ loc_silverwood_plaza ─E─ loc_veridian_glowlands ─E─ loc_chronos_nexus ─N─ loc_temporal_breach_apex
//   (start, camp rest)       (Echo Crystal, 2 Shades)   (Tamsin's stall)         (wandering Mirelings)       (Aberration, Lens)  ▲ gated (apexGate)  (Tyrant)
//   └──────────────────────────── road, gate { echo: echo_apex_resonance }, 2 watches ───────────────────────────┘
//
// Later units append fixtures for their own systems (PLAN §9.1). Deviations from canon, on purpose:
// - One Tyrant, `cr_chronos_tyrant_unveiled`, with three phases (Movements I–III; DESIGN's `tyr_phase_4` dropped) and
//   the Contained form's Phase-2 add (`cr_temporal_aberration`), so four creatures cover fodder/elite/wandering/boss.
//   Like the real Unveiled it is fought from Loop 2; Loop 1's Contained Tyrant is not modelled.
// - `config.apexGate` counts one completed quest instead of six (the fixture has one quest).
// - U29 appends the communion's Echo-gated answers, Listen fragments (five codex entries), the Stabilized Heartstone
//   and the Breach-anchor, endings A and B, and one fixture-only Apex interaction that grants those Echoes and flags.
// - The map skips the Archway/Corridor and joins the Plaza to the Glowlands directly; the road is fixture-only.
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import { configInput } from '@content/shared/config';
import type { AbilityInput } from '@schema/ability';
import type { ClassInput } from '@schema/class';
import type { CodexEntryInput } from '@schema/codex';
import type { CompanionInput } from '@schema/companion';
import type { Condition } from '@schema/condition';
import type { CreatureInput, MoveInput, Step } from '@schema/creature';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { EchoInput } from '@schema/echo';
import type { EndingInput } from '@schema/ending';
import type { FactionInput } from '@schema/faction';
import type { ItemInput } from '@schema/item';
import type { LocationInput } from '@schema/location';
import type { MerchantInput } from '@schema/merchant';
import type { ModifierInput } from '@schema/modifier';
import type { NpcInput } from '@schema/npc';
import type { QuestInput } from '@schema/quest';
import type { RecipeInput } from '@schema/recipe';
import type { RegionInput } from '@schema/region';
import type { StatusInput } from '@schema/status';
import { clone, deepFreeze } from '@engine/util/clone';

/** Content version embedded in fixture saves. */
export const FIXTURE_VERSION = '0.0.0-fixture';

/** D-048's shape with the fixture's one quest: one completed quest, or (Loop 2+) the Apex Echo. */
export const FIXTURE_APEX_GATE: Condition = {
  any: [{ counter: { name: 'quests_completed', min: 1 } }, { echo: 'echo_apex_resonance' }],
};

// ---- Regions (WORLD §2.1, §2.5) ----------------------------------------------------------------------------------------

const regions = [
  {
    id: 'region_silverwood_ruins',
    name: 'Silverwood Ruins',
    description: 'The capital, five hundred years dead. Marble under moss. Crystals growing where lanterns hung.',
    order: 1,
    levelBand: { min: 1, max: 4 },
    legacy: true,
    factionId: 'remnants',
    palette: { bg: '#2B2140', bgAlt: '#4A3B6B', fg: '#6E5A8E', accent: '#7FE3FF', glow: '#7FE3FF' },
    ambient: 'silverwood_drone',
  },
  {
    id: 'region_glowlands_nexus',
    name: 'Glowlands & Nexus',
    description: 'The Aether Road ends in a swamp that glows and an observatory whose dome fell inward. Time buckles.',
    order: 5,
    levelBand: { min: 9, max: 13 },
    legacy: true,
    palette: { bg: '#0F2E2A', bgAlt: '#1F5A4A', fg: '#2E7A5A', accent: '#8CFF6B', glow: '#F2C14E' },
    ambient: 'glowlands_pulse',
    wanderingPool: [{ creatureId: 'cr_glowfen_mireling', weight: 1 }],
  },
] satisfies RegionInput[];

// ---- Locations (WORLD §3.1, §3.5; compressed) ----------------------------------------------------------------------------

const ROAD_GATE: Condition = { echo: 'echo_apex_resonance' };

const locations = [
  {
    id: 'loc_whispering_ruins',
    regionId: 'region_silverwood_ruins',
    name: 'Whispering Ruins',
    legacyName: 'Whispering Ruins',
    description:
      'The air smells of ozone and decay, and a chill wind carries faint whispers. Twisted trees reach into a twilight sky, their branches dotted with glowing crystals. Broken stone tablets litter the ground, etched with worn sigils.',
    descriptionVariants: [{ when: { loop: { min: 2 } }, text: 'The whispers are the same. The sky is the same. You have stood here before, and the stones know it.' }],
    exits: [
      { dir: 'north', to: 'loc_shattered_library' },
      // fixture-only road (D-069.9 shape): the way back from the Nexus, once you have stood at the Apex
      { dir: 'path', to: 'loc_chronos_nexus', kind: 'road', gate: ROAD_GATE, label: 'the Aether Road, remembered', travelWatches: 2 },
    ],
    items: [{ itemId: 'item_amulet_of_echoes', when: { loop: { max: 1 } } }],
    npcs: ['npc_ilyra'],
    events: [{ id: 'ev_ruins_echo', text: 'A low, resonant hum vibrates under your skin, as if the stones are breathing.' }],
    art: { template: 'ruins', silhouettes: ['dead_tree', 'tablet', 'arch_broken'], particles: 'motes', timeOfDay: 'dusk' },
    rest: { kind: 'camp', text: 'You make camp beneath the twisted trees. The whispers keep you company.' },
    levelBand: { min: 1, max: 2 },
    map: { x: 0, y: 6 },
    safe: true,
    tags: ['start', 'legacy', 'remnants'],
  },
  {
    id: 'loc_shattered_library',
    regionId: 'region_silverwood_ruins',
    name: 'Shattered Library',
    legacyName: 'Shattered Library',
    description:
      'Collapsed shelves form jagged ridges of splintered wood and stone. Dust motes swirl in a dim glow, and you can almost hear pages turning on their own.',
    exits: [
      { dir: 'south', to: 'loc_whispering_ruins' },
      { dir: 'east', to: 'loc_silverwood_plaza' },
    ],
    items: [{ itemId: 'item_echo_crystal' }],
    // fixture: the Corridor's Shade, two of them (legacy has one Shade in the Darkened Corridor)
    encounters: [{ id: 'enc_library_shades', groups: [{ creatureId: 'cr_corrupted_shade', count: 2 }], intro: 'A growl echoes between the stacks.' }],
    events: [{ id: 'ev_library_shiver', text: 'A cold gust rattles the shelves, and you smell old ink and rain.' }],
    art: { template: 'archive', silhouettes: ['shelf_ridge', 'ladder', 'alcove_arch'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 2, max: 3 },
    map: { x: 0, y: 0 },
    tags: ['legacy', 'portal'],
  },
  {
    id: 'loc_silverwood_plaza',
    regionId: 'region_silverwood_ruins',
    name: 'Silverwood Plaza',
    legacyName: 'Silverwood Plaza',
    description:
      "Once the heart of Silverwood, this plaza is now a cratered ring of marble. Broken fountains seep shimmering mist, and the air tastes of copper. A Remnant scribe has set a table on the fountain's rim and weighs ink against salt.",
    exits: [
      { dir: 'west', to: 'loc_shattered_library' },
      { dir: 'east', to: 'loc_veridian_glowlands', label: 'the long road east' }, // fixture link (WORLD goes by the Highlands)
    ],
    npcs: ['npc_tamsin_reed'],
    merchantId: 'npc_tamsin_reed',
    events: [{ id: 'ev_plaza_surge', text: 'Wild magic surges. A chorus of distant bells rings out, then fades.' }],
    art: { template: 'city', silhouettes: ['fountain_stump', 'marble_rim', 'column'], particles: 'motes', timeOfDay: 'dusk' },
    levelBand: { min: 2, max: 4 },
    map: { x: 8, y: 0 },
    tags: ['legacy'],
  },
  {
    id: 'loc_veridian_glowlands',
    regionId: 'region_glowlands_nexus',
    name: 'Veridian Glowlands',
    legacyName: 'Veridian Glowlands',
    description:
      'A swampy basin packed with bioluminescent flora. The soil glows green, and humid air clings as amphibious shapes slip through the reeds.',
    exits: [
      { dir: 'west', to: 'loc_silverwood_plaza' },
      { dir: 'east', to: 'loc_chronos_nexus' },
    ],
    items: [{ itemId: 'item_glow_moss', once: false }],
    events: [{ id: 'ev_glowlands_pulse', text: 'The glow brightens in waves, like the basin is breathing.' }],
    art: { template: 'swamp', silhouettes: ['reed_clump', 'lantern_tree', 'causeway'], particles: 'spores', timeOfDay: 'night' },
    gather: { itemId: 'item_glow_moss', perDay: 1 },
    waitable: true,
    levelBand: { min: 9, max: 10 },
    map: { x: 32, y: 10 },
    tags: ['legacy'],
  },
  {
    id: 'loc_chronos_nexus',
    regionId: 'region_glowlands_nexus',
    name: 'The Chronos Nexus',
    legacyName: 'The Chronos Nexus',
    description:
      'A ruined observatory sits beneath a shattered dome. Time buckles here, and echoes of past and future flicker across cracked stone.',
    exits: [
      { dir: 'west', to: 'loc_veridian_glowlands' },
      { dir: 'north', to: 'loc_temporal_breach_apex', when: FIXTURE_APEX_GATE, lockedText: 'The stair up into the Breach will not hold you yet.' }, // fixture line
      { dir: 'path', to: 'loc_whispering_ruins', kind: 'road', gate: ROAD_GATE, label: 'the Aether Road, remembered', travelWatches: 2 },
    ],
    items: [{ itemId: 'item_chronos_lens' }],
    encounters: [{ id: 'enc_nexus_aberration', groups: [{ creatureId: 'cr_temporal_aberration' }], elite: true }],
    events: [{ id: 'ev_nexus_echo', text: 'A future voice overlaps your own, warning of a choice already made.' }],
    art: { template: 'observatory', silhouettes: ['dome_ribs', 'orrery', 'handleless_door'], particles: 'static', timeOfDay: 'timeless' },
    levelBand: { min: 11, max: 13 },
    map: { x: 40, y: 10 },
    temporallyUnstable: true,
    tags: ['legacy'],
  },
  {
    id: 'loc_temporal_breach_apex',
    regionId: 'region_glowlands_nexus',
    name: 'The Temporal Breach Apex',
    legacyName: 'The Temporal Breach Apex',
    description:
      'Reality tears here in violent seams. Impossible angles fold into one another, and the air hums with distant, unsettling screams.',
    exits: [{ dir: 'south', to: 'loc_chronos_nexus' }],
    encounters: [
      {
        id: 'enc_apex_tyrant',
        groups: [{ creatureId: 'cr_chronos_tyrant_unveiled' }],
        when: { loop: { min: 2 } },
        fleeable: false,
        onFlee: 'hold',
        intro: 'At the center, something holds very still, the way a hand holds a wound closed.',
      },
    ],
    events: [
      // PLAN Appendix A.5: `apex_first_entry` → a location flag + the `echo_apex_resonance` grant
      { id: 'ev_apex_first_entry', text: 'The breach flashes, and the world stutters as if deciding what to become.', effects: [{ grantEcho: 'echo_apex_resonance' }] },
      // STORY §12: `echo_tyrant_speaks` comes from *Listen* at the Apex (Loop 2+); the fixture grants it from an interaction
      {
        id: 'ev_apex_listen',
        trigger: 'interact',
        label: 'Listen',
        when: { loop: { min: 2 } },
        text: "It speaks: 'You have crossed. So.'",
        effects: [{ grantEcho: 'echo_tyrant_speaks' }],
      },
      // U29, fixture-only: one place that grants what the communion answers and outcomes A/B read (the real game
      // spreads these over STORY §12's sources)
      {
        id: 'ev_apex_remember',
        trigger: 'interact',
        label: 'Remember',
        when: { loop: { min: 2 } },
        text: 'Everything you carried here comes back at once.', // fixture line
        effects: [
          ...[
            'echo_tyrant_jailer', 'echo_tyrant_never_struck', 'echo_thirtieth_dawn', 'echo_seven_wayfinders', 'echo_litany_verse_2',
            'echo_korr_marginalia', 'echo_litany_verse_7', 'echo_eye_of_masque', 'echo_ritual_inevitable', 'echo_hallow_said_stop',
            'echo_litany_complete', 'echo_void_resonance', 'echo_heartstone_resonance', 'echo_anchor_mechanic',
          ].map((grantEcho) => ({ grantEcho: grantEcho as `echo_${string}` })),
          { setFlag: 'flag_conflux_anchored' },
          { setFlag: 'flag_cradle_pin_anchored' },
        ],
      },
    ],
    art: { template: 'breach', silhouettes: ['folded_plane', 'tyrant_cleft', 'stair_fragment'], particles: 'shards', timeOfDay: 'timeless' },
    levelBand: { min: 15, max: 18 },
    map: { x: 40, y: 8 },
    temporallyUnstable: true,
    tags: ['legacy', 'apex'],
  },
] satisfies LocationInput[];

// ---- Creatures (DESIGN §4.10/§4.12, WORLD §6) ------------------------------------------------------------------------------

/** WORLD §6.1 / DESIGN §4.12: fodder. Loot follows D-055 (first Shade each loop 100%, later 50%). */
const corruptedShade = {
  id: 'cr_corrupted_shade',
  name: 'Corrupted Shade',
  legacyName: 'Corrupted Shade',
  description: 'A smeared silhouette of a once-noble mage, warped by wild magic.',
  family: 'fam_hollowed',
  materialKin: 'shade',
  role: 'fodder',
  level: 2,
  stats: { hp: 36, atk: 7, sp: 7, armor: 1, ward: 2, agi: 5 },
  tags: ['breach_born'],
  resistances: { ley: 'weak', fire: 'weak', void: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    shade_rake: { name: 'Rake', line: 'It drags long fingers through the air toward you.', type: 'physical', power: { coef: 1.0, stat: 'atk' } },
    shade_wail: {
      name: 'Wail',
      line: 'Its mouth opens wider than its face.',
      type: 'void',
      power: { coef: 0.9, stat: 'sp' },
      spell: true,
      statuses: [{ status: 'status_weaken', chance: 0.5, duration: 2 }],
    },
    shade_fade: { name: 'Fade', line: 'It thins until the wall shows through.', statuses: [{ status: 'status_phase', duration: 1, target: 'self' }] },
  },
  pattern: [
    { move: 'shade_rake', target: 'player' },
    { move: 'shade_wail', target: 'player' },
    { if: { hpBelow: 0.7 }, then: [{ move: 'shade_fade', target: 'self' }], else: [{ move: 'shade_rake', target: 'player' }] },
  ],
  loot: [
    { itemId: 'item_dark_spellbook', when: { not: { flag: 'flag_spellbook_dropped' } } },
    { itemId: 'item_dark_spellbook', chance: 0.5, when: { flag: 'flag_spellbook_dropped' } },
    { itemId: 'mat_shadow_ash', chance: 0.8 },
  ],
  onDefeat: [{ setFlag: 'flag_spellbook_dropped' }],
  gold: { min: 7, max: 12 },
  xp: 41,
  bestiary: {
    voice: 'remnant_archive',
    summary: 'Year 212. Shades keep to corridors and stairs, the places students walked between lectures.',
    tactics: 'Hit hard before 70%; when it Fades, use an area or Chrono hit or spend the turn Guarding.',
    reveals: [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }],
  },
  sigil: { base: 'shade', details: ['spellbook'] },
} satisfies CreatureInput;

/** WORLD §6.6: the Glowlands' wandering creature (region wandering pool). */
const glowfenMireling = {
  id: 'cr_glowfen_mireling',
  name: 'Glowfen Mireling',
  legacyName: 'Glowfen Mireling',
  description: 'An amphibious creature wreathed in eerie green light.',
  family: 'fam_green',
  materialKin: 'mireling',
  role: 'fodder',
  level: 9,
  stats: { hp: 110, atk: 18, armor: 2, ward: 3, agi: 6 },
  resistances: { fire: 'weak', void: 'weak', ley: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    mireling_breathe_in: {
      name: 'Breathe In',
      line: 'The Mireling breathes in.',
      statuses: [{ status: 'status_regen', duration: 3, target: 'self', power: { coef: 0.3, stat: 'atk' } }],
    },
    mireling_spit: {
      name: 'Spit',
      line: 'Its throat glows. It spits light at you.',
      type: 'ley',
      power: { coef: 0.9, stat: 'atk' },
      statuses: [{ status: 'status_poison', chance: 0.5, duration: 4 }],
    },
    mireling_drag: {
      name: 'Drag',
      line: 'Webbed hands close on your ankle under the water.',
      type: 'physical',
      power: { coef: 1.1, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.4, duration: 2 }],
    },
    mireling_glow_burst: {
      name: 'Glow Burst',
      line: 'Green light swells under its skin until it hurts to look.',
      type: 'ley',
      power: { coef: 0.6, stat: 'atk' },
      statuses: [{ status: 'status_blind', chance: 0.3, duration: 1 }],
    },
  },
  pattern: [
    { move: 'mireling_breathe_in', target: 'self', when: { first: true } },
    { move: 'mireling_spit', target: 'player' },
    { if: { everyNth: 3 }, then: [{ move: 'mireling_glow_burst', target: 'all' }], else: [{ move: 'mireling_drag', target: 'player' }] },
  ],
  loot: [{ itemId: 'item_glow_moss', chance: 0.6 }],
  gold: { min: 21, max: 33 },
  xp: 189,
  bestiary: {
    voice: 'wayfinder_notes',
    summary: 'Frog-backed, man-high, glowing from the throat down. It breathes in before it fights: that is its Regen.',
    tactics: 'Void first (strips Regen), then fire.',
  },
  sigil: { base: 'mireling' },
} satisfies CreatureInput;

/** WORLD §6.7: the elite at the Nexus, and the Tyrant's Phase-2 add at 40% HP (the Contained form's add, D-066.1). */
const temporalAberration = {
  id: 'cr_temporal_aberration',
  name: 'Temporal Aberration',
  legacyName: 'Temporal Aberration',
  description: 'A warped being that flickers between past and future strikes.',
  family: 'fam_watch_wardens',
  materialKin: 'aberration',
  role: 'elite',
  level: 12,
  stats: { hp: 280, atk: 23, armor: 4, ward: 4, agi: 8 },
  tags: ['breach_born'],
  resistances: { void: 'weak', chrono: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    aberration_flicker_strike: {
      name: 'Flicker Strike',
      line: 'It flickers. The blow is already on its way.',
      type: 'chrono',
      power: { coef: 1.3, stat: 'atk' },
      hidden: true,
    },
    aberration_past_blow: {
      name: 'Past Blow',
      line: 'Something it did a moment ago arrives now.',
      type: 'chrono',
      power: { coef: 1.0, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.4, duration: 2 }],
    },
    aberration_future_blow: {
      name: 'Future Blow',
      line: 'It strikes at a moment that has not happened.',
      type: 'chrono',
      power: { coef: 0.8, stat: 'atk' },
      hidden: true,
    },
    aberration_rewind: {
      name: 'Rewind',
      line: 'Its wounds run backward into it.',
      statuses: [{ status: 'status_rewind', duration: 2, target: 'self' }],
    },
  },
  pattern: [
    {
      if: { all: [{ hpBelow: 0.5 }, { oncePerFight: true }] },
      then: [{ move: 'aberration_rewind', target: 'self' }],
      else: [{ if: { everyNth: 3 }, then: [{ move: 'aberration_future_blow', target: 'all' }], else: [{ move: 'aberration_flicker_strike', target: 'player' }] }],
    },
    { move: 'aberration_past_blow', target: 'player' },
  ],
  loot: [{ itemId: 'item_chronal_dust' }, { itemId: 'mat_frayed_moment', chance: 0.8 }],
  gold: { min: 54, max: 84 },
  xp: 520,
  bestiary: {
    voice: 'remnant_archive',
    summary: 'Year 302. Tovren Masque built watch-wardens to keep the observatory’s hours. When the dome fell the hours broke, and the wardens kept them anyway.',
    tactics: 'Guard the "?" turns. Hit it with Void while Rewind is on it.',
  },
  sigil: { base: 'aberration' },
} satisfies CreatureInput;

const P1_MOVES = [
  { w: 1, step: { move: 'tyr_time_lash', target: 'player' } },
  { w: 1, step: { move: 'tyr_grasp', target: 'player' } },
  { w: 1, step: { move: 'tyr_shear', target: 'all' } },
] satisfies { w: number; step: Step }[];

const tyrantMoves = {
  tyr_speak: { name: 'Speak', line: "It speaks: 'You have crossed. So.'" },
  tyr_grasp: {
    name: 'Grasp',
    line: 'A skeletal limb surfaces, reaching.',
    type: 'physical',
    power: { coef: 1.2, stat: 'atk' },
    statuses: [{ status: 'status_slow', chance: 1, duration: 2 }],
  },
  tyr_shear: { name: 'Shear', line: 'Time thickens around your feet.', type: 'chrono', power: { coef: 1.0, stat: 'sp' } },
  tyr_time_lash: { name: 'Time Lash', line: 'The hour draws tight, then lashes at you.', type: 'chrono', power: { coef: 1.3, stat: 'sp' } },
  tyr_gather: { name: 'Gather', line: 'The hour draws back like an arm. It will fall.', hidden: true, windUp: { turns: 2, then: 'tyr_chrono_strike' } },
  tyr_chrono_strike: {
    name: 'Chrono-Strike',
    line: 'The hour falls.', // fixture line (WORLD gives only the wind-up's)
    type: 'chrono',
    power: { coef: 2.0, stat: 'sp' },
    hidden: true,
    statuses: [{ status: 'status_stun', duration: 1, when: { playerGuarding: false } }],
  },
  tyr_remember: {
    name: 'Remember',
    line: 'An eye opens in the mass and looks back a moment.',
    statuses: [{ status: 'status_rewind', duration: 2, target: 'self' }],
  },
  tyr_hour_presses: { name: 'The Hour Presses', line: 'The hour leans on you while it waits.', type: 'chrono', special: 'hour_presses' },
} satisfies Record<string, MoveInput>;

/**
 * DESIGN §4.10 row 2 numbers (900/32/36/8/10/4) and §4.11 communion, cut to three phases = three Movements. Answers,
 * offers and outcomes are DESIGN/STORY rows whose conditions need only fixture content; U29 appended the Echo-gated
 * answers (WORLD §6.8's question ids: all of Movement I; Korr, Masque and Hallow's silence of Movement II), each
 * Movement's Listen fragment, the other two offers and the outcomes Before-pass, A and B (STORY §10 requirement atoms).
 * Answer texts are fixture lines.
 */
const chronosTyrant = {
  id: 'cr_chronos_tyrant_unveiled',
  name: 'The Chronos Tyrant',
  description:
    'A towering, amorphous figure of rippling time. Skeletal limbs and crystalline shards surface and vanish within its shifting mass.',
  family: 'fam_unravelled',
  role: 'boss',
  level: 18,
  stats: { hp: 900, atk: 32, sp: 36, armor: 8, ward: 10, agi: 4 },
  tags: ['breach_born'],
  resistances: { ley: 'weak', chrono: 'resist', void: 'resist' },
  statusImmunities: ['status_stun', 'status_slow', 'status_poison', 'status_bleed'],
  tauntImmune: true,
  fleeable: false,
  moves: tyrantMoves,
  phases: [
    {
      id: 'tyr_movement_1',
      name: 'Lament',
      pattern: [
        { move: 'tyr_speak', target: 'self', when: { first: true } },
        { move: 'tyr_time_lash', target: 'player' },
        { move: 'tyr_grasp', target: 'player' },
        { move: 'tyr_shear', target: 'all' },
      ],
    },
    {
      id: 'tyr_movement_2',
      name: 'The Nine Surface',
      enterWhen: [{ hpBelow: 0.75 }],
      line: "'Then you came to finish it.' The mass opens. Two of the five reach out.",
      adds: [{ creatureId: 'cr_temporal_aberration', count: 2, countSolo: 1, hpPct: 0.4 }],
      pattern: [{ if: { everyNth: 3 }, then: [{ move: 'tyr_remember', target: 'self' }], else: [{ weighted: [...P1_MOVES] }] }],
    },
    {
      id: 'tyr_movement_3',
      name: 'Chrono-Strike',
      enterWhen: [{ hpBelow: 0.5 }, { round: 12 }], // the round trigger is fixture-only (an OR-list to test)
      line: "'I hold,' it says. 'If I do not hold, you have seen what comes.'",
      damageDealtRampPerRound: 0.1,
      pattern: [{ if: { everyNth: 3 }, then: [{ move: 'tyr_gather', target: 'player' }], else: [{ weighted: [...P1_MOVES] }] }],
    },
  ],
  communion: {
    opensWith: [{ echo: 'echo_tyrant_speaks' }],
    pressMove: 'tyr_hour_presses',
    movements: [
      {
        id: 'tyr_movement_1',
        questions: [
          {
            id: 'tyr_q_why',
            line: 'It asks why you have come.',
            answers: [
              { id: 'to_kill_you', when: { all: [] }, resolve: 1, text: 'To kill you.' },
              { id: 'lie', when: { all: [] }, resolve: -2, lie: true, text: 'I was lost.' },
              { id: 'the_jailer', when: { echo: 'echo_tyrant_jailer' }, resolve: 1, text: 'You are the jailer, and the cell.' },
              { id: 'never_struck', when: { echo: 'echo_tyrant_never_struck' }, resolve: 1, text: 'You never struck first.' },
            ],
          },
          {
            id: 'tyr_q_hour',
            line: 'It asks what day this is, for you.',
            answers: [
              { id: 'thirtieth_dawn', when: { echo: 'echo_thirtieth_dawn' }, resolve: 1, text: 'The thirtieth dawn is coming.' },
              { id: 'lie_first_day', when: { all: [] }, resolve: -2, lie: true, text: 'The first day.' },
            ],
          },
          {
            id: 'tyr_q_before',
            line: 'It asks who came before you.',
            answers: [
              { id: 'seven_wayfinders', when: { echo: 'echo_seven_wayfinders' }, resolve: 1, text: 'Seven. I read their names.' },
              { id: 'lie_no_one', when: { all: [] }, resolve: -2, lie: true, text: 'No one.' },
            ],
          },
        ],
        listen: { effects: [{ unlockCodex: 'codex_tyrant_holding' }, { unlockCodex: 'codex_tyrant_reflex' }] },
      },
      {
        id: 'tyr_movement_2',
        questions: [
          {
            id: 'tyr_q_korr',
            line: "'What is read is owed. What have you read?'",
            answers: [
              { id: 'corrupted', when: { corruption: { min: 3 } }, resolve: 1, text: 'Enough to owe.' },
              { id: 'verse_2', when: { echo: 'echo_litany_verse_2' }, resolve: 1, text: 'The second verse.' },
              { id: 'korr_marginalia', when: { echo: 'echo_korr_marginalia' }, resolve: 1, text: 'Your margins.' },
            ],
          },
          {
            id: 'tyr_q_masque',
            line: "'Tell me what you saw from the far side.'",
            answers: [
              { id: 'verse_7', when: { echo: 'echo_litany_verse_7' }, resolve: 1, text: 'The seventh verse.' },
              { id: 'eye_of_masque', when: { echo: 'echo_eye_of_masque' }, resolve: 1, text: 'Your eye, still open.' },
              { id: 'ritual_inevitable', when: { echo: 'echo_ritual_inevitable' }, resolve: 2, text: 'It failed. It always fails.' },
            ],
          },
          {
            id: 'tyr_q_hallow',
            line: 'The chorus leaves a gap where a sixth voice should be.',
            answers: [{ id: 'hallow_said_stop', when: { echo: 'echo_hallow_said_stop' }, resolve: 2, text: 'He said stop.' }],
          },
        ],
        listen: { effects: [{ unlockCodex: 'codex_tyrant_fracture' }] },
      },
      {
        id: 'tyr_movement_3',
        questions: [
          {
            id: 'tyr_q_choice',
            line: 'The chorus stops. One voice asks what you will do.',
            answers: [{ id: 'answer', when: { resolve: { min: 3 } }, resolve: 0, text: 'Choose.' }],
          },
        ],
        listen: { effects: [{ unlockCodex: 'codex_tyrant_alone' }] },
      },
    ],
    offers: [
      { itemId: 'item_chronos_lens', resolve: 1, effects: [] },
      { itemId: 'item_heartstone_core', resolve: -2, effects: [] },
      { itemId: 'item_stabilized_heartstone', resolve: 1, effects: [] },
      { itemId: 'item_breach_anchor', resolve: 2, effects: [{ setFlag: 'flag_anchor_offered' }] },
    ],
    outcomes: [
      {
        minResolve: 3,
        choiceId: 'let_pass',
        effects: [{ setFlag: 'flag_tyrant_spared' }, { setFlag: 'flag_refused_all_paths' }, { ending: 'ending_unbound' }],
      },
      // let you pass into Silverwood Before (D-016): the fixture has no Before map, so the tear only opens
      { minResolve: 3, choiceId: 'pass_before', effects: [{ setFlag: 'flag_tyrant_tear_open' }] },
      { minResolve: 6, when: { echo: 'echo_litany_complete' }, choiceId: 'take_place', effects: [{ ending: 'ending_wardens_vigil' }] },
      {
        minResolve: 8,
        when: {
          all: [
            { echo: 'echo_heartstone_resonance' },
            { echo: 'echo_litany_complete' },
            { echo: 'echo_void_resonance' },
            { echo: 'echo_anchor_mechanic' },
            { item: { id: 'item_breach_anchor' } },
            { counter: { name: 'factions_trusted', min: 2 } },
            { flag: 'flag_conflux_anchored' },
            { flag: 'flag_cradle_pin_anchored' },
          ],
        },
        choiceId: 'mending',
        effects: [{ grantEcho: 'echo_tyrant_consent' }, { ending: 'ending_mending' }],
      },
    ],
  },
  loot: [{ itemId: 'mat_frayed_moment', count: 3 }],
  gold: { min: 0, max: 0 },
  xp: 1600,
  onDefeat: [{ setFlag: 'flag_tyrant_dead' }],
  bestiary: {
    voice: 'wayfinder_notes',
    summary: 'Loop 2. It spoke. "You have crossed. So." A chorus, with one voice under it like a bass line.',
    tactics: 'Fight: Ley, Guard every Chrono-Strike. Commune: answer honestly.',
  },
  sigil: { base: 'tyrant', accent: 'chrono', details: ['unveiled'] },
} satisfies CreatureInput;

const creatures = [corruptedShade, glowfenMireling, temporalAberration, chronosTyrant] satisfies CreatureInput[];

// ---- Items (DESIGN §7.7, WORLD §7–8; two per equipment slot, plus what the world references) ------------------------------

const items = [
  // weapons
  {
    id: 'item_rusty_dagger', name: 'Rusty Dagger', legacyName: 'Rusty Dagger', type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 1,
    description: 'A pitted blade with a faint echo of old magic.', stats: { power: 4 }, value: 8, art: { icon: 'dagger' },
  },
  {
    id: 'item_apprentice_staff', name: 'Apprentice Staff', legacyName: 'Apprentice Staff', type: 'weapon', slot: 'weapon', weaponType: 'magic_staff', tier: 1,
    description: 'A basic wooden staff, suitable for channeling nascent magical energies.', stats: { power: 2, spellPower: 1 },
    passives: [{ kind: 'mpCostReduction', pct: 0.1 }], value: 30, art: { icon: 'staff' },
  },
  // armor
  {
    id: 'item_wildling_hide_armor', name: 'Wildling Hide Armor', legacyName: 'Wildling Hide Armor', type: 'armor', slot: 'armor', armorClass: 'light', tier: 1,
    description: 'Crude but tough armor made from Mistwood hides. Smells faintly of damp earth.', stats: { armor: 2, ward: 1 }, value: 25, art: { icon: 'hide' },
  },
  {
    id: 'item_ironclad_mail', name: 'Ironclad Mail', legacyName: 'Ironclad Mail', type: 'armor', slot: 'armor', armorClass: 'medium', tier: 1,
    description: 'Patchwork armor of riveted plates, worn by the nomads. Provides solid protection.', stats: { armor: 4, ward: 1 }, value: 40, art: { icon: 'mail' },
  },
  // trinkets (the Lens and the Core are communion offers; the Lantern is the recipe's output)
  {
    id: 'item_chronos_lens', name: 'Chronos Lens', legacyName: 'Chronos Lens', type: 'trinket', slot: 'trinket', tier: 3,
    description: "A cracked lens that focuses time's echo.", stats: { magic: 2, mpMax: 10 }, value: 120, art: { icon: 'lens', major: true }, tags: ['key'],
  },
  {
    id: 'item_heartstone_core', name: 'Heartstone Core', legacyName: 'Heartstone Core', type: 'trinket', slot: 'trinket', tier: 0, rarityRule: 'fixed',
    description: 'A stolen heartbeat of the world. Power surges, but each pulse hurts.', stats: { magic: 2, mpMax: 25, hpMax: -15 },
    sellable: false, droppable: false, upgradeable: false, value: 100, art: { icon: 'heart_core', major: true }, tags: ['bound'],
  },
  {
    id: 'item_glyphbound_lantern', name: 'Glyphbound Lantern', legacyName: 'Glyphbound Lantern', type: 'trinket', slot: 'trinket', tier: 1,
    description: 'A lantern etched with warding glyphs that sharpen focus.', stats: { magic: 1 }, value: 30, art: { icon: 'lantern' }, tags: ['key'],
  },
  // consumables
  {
    id: 'item_ley_touched_tonic', name: 'Ley-Touched Tonic', legacyName: 'Ley-Touched Tonic', type: 'consumable', tier: 1,
    description: 'A swirling vial that smells like rain on stone. Restores health and mana.', onUse: [{ heal: { hp: 25, mp: 15 } }], value: 12, art: { icon: 'vial' },
  },
  {
    id: 'item_mana_bloom', name: 'Mana Bloom', legacyName: 'Mana Bloom', type: 'consumable', tier: 1,
    description: 'A rare blossom steeped in ley mist. It brings cool clarity.', onUse: [{ heal: { hp: 10, mp: 30 } }], value: 25, art: { icon: 'bloom' },
  },
  {
    id: 'item_glow_moss', name: 'Glow Moss', legacyName: 'Glow Moss', type: 'consumable', tier: 1,
    description: 'Bioluminescent moss steeped in swamp magic. It soothes wounds.', onUse: [{ heal: { hp: 20, mp: 5 } }], value: 10, art: { icon: 'moss' },
  },
  {
    id: 'item_chronal_dust', name: 'Chronal Dust', legacyName: 'Chronal Dust', type: 'consumable', tier: 2,
    description: 'Fine grains that glitter with frozen time. It sharpens the mind.', onUse: [{ heal: { mp: 25 } }], value: 18, art: { icon: 'dust' }, tags: ['material'],
  },
  // quest items and the tome
  {
    id: 'item_amulet_of_echoes', name: 'Amulet of Echoes', legacyName: 'Amulet of Echoes', type: 'quest', tier: 0,
    description: 'A faintly glowing amulet tied to the Great Sundering. Enhances magical affinity.', stats: { magic: 1 },
    passives: [{ kind: 'grantAbility', abilityId: 'itm_echo_bolt' }], value: 60, art: { icon: 'amulet', major: true },
  },
  {
    id: 'item_echo_crystal', name: 'Echo Crystal', legacyName: 'Echo Crystal', type: 'quest', tier: 0,
    description: 'A crystal that seems to hold voices from the past.', value: 70, art: { icon: 'crystal', major: true },
  },
  // U29: the other two communion offers (DESIGN §4.11; fixture descriptions)
  {
    id: 'item_stabilized_heartstone', name: 'Stabilized Heartstone', type: 'quest', tier: 0,
    description: 'The Heartstone, quieted. It beats evenly in your hand.', value: 0, art: { icon: 'heart_core', major: true },
  },
  {
    id: 'item_breach_anchor', name: 'Breach-anchor', type: 'quest', tier: 0,
    description: 'An anchor-pin forged for a wound in time. One end of a pair.', value: 0, art: { icon: 'anchor', major: true },
  },
  {
    id: 'item_dark_spellbook', name: 'Dark Spellbook', legacyName: 'Dark Spellbook', type: 'tome', tier: 0,
    description: 'A charred tome of corrupted secrets. Reading its forbidden pages unlocks new magical abilities, but at a cost to your vitality.',
    onUse: [{ damage: { hp: 15 } }, { corruption: 1 }], usableInCombat: false, value: 8, art: { icon: 'tome' },
  },
  // materials (fixture descriptions)
  { id: 'mat_shadow_ash', name: 'Shadow Ash', type: 'material', tier: 1, description: 'Grey ash that clings to whatever a Shade touched.', value: 4, art: { icon: 'ash' } },
  { id: 'mat_frayed_moment', name: 'Frayed Moment', type: 'material', tier: 3, description: 'A thread of an hour that came loose.', value: 18, art: { icon: 'thread' } },
  { id: 'mat_ley_spark', name: 'Ley Spark', type: 'material', tier: 1, description: 'A mote of ley light that will not go out.', value: 6, art: { icon: 'spark' } },
  { id: 'mat_iron_rivet', name: 'Iron Rivet', type: 'material', tier: 1, description: 'A Nomad rivet, cold-hammered.', value: 3, art: { icon: 'rivet' } },
] satisfies ItemInput[];

/** WORLD §8.2: the gate item's recipe (no fee, Neutral). */
const recipes = [
  {
    id: 'recipe_glyphbound_lantern',
    name: 'Glyphbound Lantern',
    category: 'trinket',
    inputs: [{ itemId: 'mat_ley_spark', count: 2 }, { itemId: 'mat_iron_rivet', count: 1 }],
    output: { itemId: 'item_glyphbound_lantern' },
    gold: 0,
  },
] satisfies RecipeInput[];

// ---- Statuses (DESIGN §4.5: all 18 combat statuses + status_rested) -------------------------------------------------------

const debuff = { kind: 'debuff' } as const;
const d45 = (what: string) => `${what} (DESIGN §4.5).`;

const statuses = [
  { id: 'status_bleed', name: 'Bleed', description: d45('Physical DoT, ignores armor'), ...debuff, color: '#c0392b', icon: 'drip',
    stackable: true, maxStacks: 3, defaultDuration: 3, tick: { timing: 'turn_start', damage: { base: 1, coef: 0.2, stat: 'atk', perStack: true, type: 'physical' } } },
  { id: 'status_burn', name: 'Burn', description: d45('Fire DoT; cannot be applied to Soaked'), ...debuff, color: '#e67e22', icon: 'flame',
    defaultDuration: 3, tick: { damage: { base: 1, coef: 0.2, stat: 'sp', type: 'fire' } }, special: 'burn' },
  { id: 'status_shock', name: 'Shock', description: d45('-15 accuracy; takes +25% Storm'), ...debuff, color: '#f1c40f', icon: 'jag',
    defaultDuration: 2, modifiers: { accuracyFlat: -15 }, special: 'shock' },
  { id: 'status_soaked', name: 'Soaked', description: d45('+50% Storm taken, -50% Fire taken'), ...debuff, color: '#3498db', icon: 'droplet',
    defaultDuration: 3, special: 'soaked' },
  { id: 'status_slow', name: 'Slow', description: d45('-5 initiative, -10 evasion, cannot flee'), ...debuff, color: '#7f8c8d', icon: 'hourglass_grey',
    defaultDuration: 2, modifiers: { initiativeFlat: -5, evasionFlat: -10, blockActions: ['flee'] }, special: 'slow' },
  { id: 'status_haste', name: 'Haste', description: d45('+5 initiative, +10 evasion; removes Slow'), kind: 'buff', color: '#f9e79f', icon: 'hourglass_bright',
    defaultDuration: 2, modifiers: { initiativeFlat: 5, evasionFlat: 10 }, special: 'haste' },
  { id: 'status_stun', name: 'Stun', description: d45('Loses the next action; intent cancelled'), ...debuff, color: '#f4d03f', icon: 'starburst',
    defaultDuration: 1, modifiers: { skipTurn: true }, special: 'stun' },
  { id: 'status_weaken', name: 'Weaken', description: d45('Deals -25% damage'), ...debuff, color: '#95a5a6', icon: 'arrow_droop',
    defaultDuration: 2, modifiers: { outgoingPct: -0.25 } },
  { id: 'status_armor_break', name: 'Armor Break', description: d45('Armor and ward count as 0; +15% Physical taken'), ...debuff, color: '#bdc3c7', icon: 'plate_cracked',
    defaultDuration: 3, modifiers: { armorWardZero: true }, special: 'armor_break' },
  { id: 'status_mark', name: 'Mark', description: d45('+15% damage taken; attacks cannot miss'), ...debuff, color: '#e74c3c', icon: 'crosshair',
    defaultDuration: 3, modifiers: { incomingPct: 0.15 }, special: 'mark' },
  { id: 'status_curse', name: 'Curse', description: d45('Void DoT; healing received x0.5'), ...debuff, color: '#8e44ad', icon: 'sigil',
    defaultDuration: 3, tick: { damage: { base: 2, coef: 0.2, stat: 'sp', type: 'void' } }, modifiers: { healingPct: -0.5 } },
  { id: 'status_shield', name: 'Shield', description: d45('Absorbs damage before HP; Void destroys it'), kind: 'buff', color: '#1abc9c', icon: 'hex',
    defaultDuration: 3, modifiers: { absorbFlat: 0 }, special: 'shield' },
  { id: 'status_regen', name: 'Regen', description: d45('Heals the stored amount each turn; removes a Bleed stack'), kind: 'buff', color: '#2ecc71', icon: 'leaf',
    defaultDuration: 3, tick: { heal: { flat: 0, pctMaxHp: 0 } }, special: 'regen' },
  { id: 'status_taunt', name: 'Taunt', description: d45('Single-target intents target the taunter'), ...debuff, color: '#c0392b', icon: 'horn',
    defaultDuration: 2, modifiers: { forcedTargetUidFromSource: true }, special: 'taunt' },
  { id: 'status_phase', name: 'Phase', description: d45('The next single-target attack misses'), kind: 'buff', color: '#ecf0f1', icon: 'outline',
    defaultDuration: 1, expiresOn: ['hit_taken', 'turn'], special: 'phase' },
  { id: 'status_rewind', name: 'Rewind', description: d45('HP restored to the snapshot on expiry'), kind: 'buff', color: '#5dade2', icon: 'spiral',
    defaultDuration: 2, special: 'rewind' },
  { id: 'status_poison', name: 'Poison', description: d45('Untyped DoT; ignores armor and resistances'), ...debuff, color: '#27ae60', icon: 'skull',
    defaultDuration: 4, tick: { damage: { base: 1, coef: 0.15, stat: 'atk' } }, special: 'poison' },
  { id: 'status_blind', name: 'Blind', description: d45('-30 accuracy'), ...debuff, color: '#34495e', icon: 'eye_closed',
    defaultDuration: 2, modifiers: { accuracyFlat: -30 } },
  { id: 'status_rested', name: 'Rested', description: d45('+2 initiative, +5 accuracy for the first fight of the day'), kind: 'buff', color: '#f5cba7', icon: 'moon',
    defaultDuration: 1, modifiers: { initiativeFlat: 2, accuracyFlat: 5 } },
] satisfies StatusInput[];

// ---- Classes and abilities (DESIGN §3.3, §5.2–5.3, §5.7, §12.4) -------------------------------------------------------------

const branch = (id: string, name: string) => ({ id, name, description: `The ${name} branch.` });

const classes = [
  {
    id: 'ranger', name: 'Ranger', title: 'hunter of the wilds between settlements', legacy: true, sigil: 'ranger', dialogueTag: 'ranger',
    description: 'Good HP, honest Physical damage, and tools for every situation if you spent the points.',
    intro: 'You read the ground before the sky, carry three kinds of knife and a bow you made yourself.',
    baseStats: { hp: 100, mp: 36, strength: 10, magic: 6, agility: 8 },
    growth: { hp: 8, mp: 3 },
    resource: { name: 'Focus', rules: [{ on: 'basic_hit', amount: 8 }, { on: 'basic_crit', amount: 12 }, { on: 'guard', amount: 5 }] },
    branches: [branch('hunt', 'Hunt'), branch('steel', 'Steel'), branch('wildcraft', 'Wildcraft')],
    starterItems: [{ itemId: 'item_rusty_dagger', equip: true }, { itemId: 'item_ley_touched_tonic', count: 2 }],
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
  },
] satisfies ClassInput[];

const abilities = [
  // Ranger (§5.2)
  {
    id: 'rgr_marked_shot', ownerId: 'ranger', branch: 'hunt', tier: 1, name: 'Marked Shot', description: 'Every hunt begins with a choice of prey.',
    mp: 8, target: 'enemy', damageType: 'physical', power: { coef: 1.1, stat: 'atk' }, statuses: [{ status: 'status_mark', chance: 1, duration: 3 }],
  },
  {
    id: 'rgr_rend', ownerId: 'ranger', branch: 'steel', tier: 1, name: 'Rend', description: 'A wound that keeps working after you stop.',
    mp: 8, target: 'enemy', damageType: 'physical', power: { coef: 1.0, stat: 'atk' }, statuses: [{ status: 'status_bleed', chance: 1, duration: 3 }],
  },
  {
    id: 'rgr_piercing_arrow', ownerId: 'ranger', branch: 'hunt', tier: 2, name: 'Piercing Arrow', description: 'Hide, plate, bark. It does not care.',
    mp: 12, target: 'enemy', damageType: 'physical', power: { coef: 1.5, stat: 'atk', ignoresArmor: true },
    bonuses: [{ when: { targetHas: 'status_mark' }, mult: 1.25 }],
  },
  // Wizard (§5.3)
  {
    id: 'wiz_fireball', ownerId: 'wizard', branch: 'pyre', tier: 1, name: 'Fireball', description: 'The first spell Maelis wrote down. It still works.',
    mp: 10, target: 'enemy', damageType: 'fire', spell: true, power: { base: 3, coef: 1.2, stat: 'sp' }, statuses: [{ status: 'status_burn', chance: 0.6, duration: 3 }],
  },
  {
    id: 'wiz_echo_bolt', ownerId: 'wizard', branch: 'chronomancy', tier: 1, name: 'Echo Bolt',
    description: 'A moment’s residue, thrown. Cheap, clean, reliable — and no more than that.',
    mp: 10, target: 'enemy', damageType: 'ley', spell: true, power: { base: 2, coef: 1.1, stat: 'sp' },
  },
  {
    id: 'wiz_temporal_drag', ownerId: 'wizard', branch: 'chronomancy', tier: 2, name: 'Temporal Drag', description: 'Make a second last.',
    mp: 10, target: 'enemy', damageType: 'chrono', spell: true, power: { coef: 0.8, stat: 'sp' }, statuses: [{ status: 'status_slow', chance: 1, duration: 2 }],
  },
  // The Amulet's bolt (§5.7, D-047, D-067.19)
  {
    id: 'itm_echo_bolt', ownerId: 'item_amulet_of_echoes', name: 'Echo Bolt (Amulet)', description: 'The Amulet remembers the first spell you ever saw.',
    mp: 10, target: 'enemy', damageType: 'ley', power: { coef: 0.75, stat: 'atk', maxOf: { base: 4, coef: 0.8, stat: 'sp' } }, cooldown: 1,
  },
  // Ilyra (§12.4)
  { id: 'comp_ilyra_ley_dart', ownerId: 'ilyra', kind: 'attack', name: 'Ley Dart', description: 'A needle of ley light.', target: 'enemy', damageType: 'ley', power: { coef: 1.0, stat: 'sp' } },
  { id: 'comp_ilyra_ward', ownerId: 'ilyra', kind: 'shield', name: 'Ward', description: 'Ink-light settles over the weakest of you.', target: 'ally', shield: { base: 10, coef: 1.2, stat: 'sp', turns: 3 } },
  { id: 'comp_ilyra_mend', ownerId: 'ilyra', kind: 'heal', name: 'Mend', description: 'She reads a wound shut.', target: 'ally', heal: { base: 12, coef: 1.1, stat: 'sp', target: 'ally' } },
  {
    id: 'comp_ilyra_archive_light', ownerId: 'ilyra', kind: 'signature', name: 'Archive Light',
    description: 'Cleanse the party; Shield both; every hidden intent revealed for 2 turns.',
    target: 'party', shield: { base: 10, coef: 1.5, stat: 'sp' }, special: 'cleanse',
  },
] satisfies AbilityInput[];

/** DESIGN §12.3–12.4. The fixture's one quest stands in for her arc. */
const companions = [
  {
    id: 'ilyra',
    npcId: 'npc_ilyra',
    name: 'Ilyra',
    role: 'support',
    damageType: 'ley',
    stats: { hp: 80, atk: 6, sp: 10, agi: 7, armor: 1, ward: 3 },
    perLevel: { hp: 6, atk: 0.5, sp: 1 },
    abilities: ['comp_ilyra_ley_dart', 'comp_ilyra_ward', 'comp_ilyra_mend'],
    signature: { abilityId: 'comp_ilyra_archive_light', cooldown: 4 },
    arcQuestIds: ['q_echo_crystal'],
    banter: [{ locationId: 'loc_shattered_library', text: 'Ink remembers what hands forget.' }],
    portrait: { sigil: 'quill', accent: 'remnants' },
  },
] satisfies CompanionInput[];

// ---- People, trade, the quest and the scene (WORLD §4, §9; STORY §11.2, §13) ------------------------------------------------

const npcs = [
  {
    id: 'npc_ilyra',
    name: 'Ilyra',
    description: "Remnant scholar, about thirty, in faded robes by a cold fire. Oriel Danthe's descendant; she does not know it.",
    factionId: 'remnants',
    homeLocationId: 'loc_whispering_ruins',
    portrait: { sigil: 'quill' },
    roles: ['questgiver', 'companion', 'lore'],
    companionId: 'ilyra',
    barks: [{ text: 'The whispers are louder each day, Wayfinder. You hear them too, I think?' }],
    age: 30,
  },
  {
    id: 'npc_tamsin_reed',
    name: 'Scribe Tamsin Reed',
    description: "Remnant scribe who weighs ink against salt on the fountain's rim.",
    factionId: 'remnants',
    homeLocationId: 'loc_silverwood_plaza',
    portrait: { sigil: 'inkwell' },
    roles: ['merchant'],
    merchantId: 'npc_tamsin_reed',
    barks: [{ text: 'Ink by the dram, salt by the cup. The Keeper sets the rate, not me.' }],
  },
] satisfies NpcInput[];

/** WORLD §9.2 `npc_tamsin_reed`: core stock (all three DESIGN items) and a rolled pool. */
const merchants = [
  {
    id: 'npc_tamsin_reed',
    npcId: 'npc_tamsin_reed',
    name: 'Silverwood Plaza',
    stock: [
      { itemId: 'item_glow_moss', count: 3 },
      { itemId: 'item_ley_touched_tonic', count: 2 },
      { itemId: 'item_chronal_dust', count: 2 },
    ],
    rollStock: { pool: ['item_apprentice_staff', 'item_glyphbound_lantern'], pick: { min: 1, max: 2 } },
    regionMarkup: 1,
    repFaction: 'remnants',
    services: ['buy', 'sell'],
  },
] satisfies MerchantInput[];

/** STORY §11.2 `q_echo_crystal`, cut to two stages (the Give/Keep choice is STORY §13's scene, not modelled here). */
const quests = [
  {
    id: 'q_echo_crystal',
    name: 'Echoes in the Library',
    description: 'Ilyra asks you to retrieve the Echo Crystal from the Shattered Library.',
    category: 'legacy',
    botHint: 'explorer',
    giverNpcId: 'npc_ilyra',
    factionId: 'remnants',
    stages: [
      {
        id: 'find_crystal',
        journal: 'Retrieve the Echo Crystal from the Shattered Library to the north of Whispering Ruins.',
        objectives: [
          { id: 'obj_reach_library', text: 'Reach the Shattered Library', when: { location: 'loc_shattered_library' }, hintLocationId: 'loc_shattered_library' },
          { id: 'obj_take_crystal', text: 'Take the Echo Crystal', when: { item: { id: 'item_echo_crystal' } } },
        ],
        next: 'crystal_found',
      },
      { id: 'crystal_found', journal: 'You have the Echo Crystal. Ilyra is waiting by her cold fire.', outcome: 'complete' },
    ],
    rewards: { xp: 120, gold: 20 },
  },
] satisfies QuestInput[];

/** STORY §13 `scene_first_meeting_ilyra`; the Echo choice is fixture-only (the real ones need Echoes the fixture lacks). */
const dialogues = [
  {
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
          { id: 'done_before', text: "Ilyra, I've done this before.", hotkey: '3', when: { loop: { min: 2 } }, effects: [{ setFlag: 'flag_ilyra_told' }], next: 'told' },
          {
            id: 'it_spoke',
            text: 'It spoke to me. At the Apex.', // fixture line
            hotkey: '4',
            when: { echo: 'echo_tyrant_speaks' },
            echoHint: 'echo_tyrant_speaks',
            tags: ['echo'],
            oncePerLoop: true,
            effects: [{ rep: { faction: 'remnants', delta: 5 } }],
            next: 'spoke',
          },
        ],
      },
      { id: 'declined', speaker: 'narrator', text: 'Ilyra nods, her eyes shadowed with disappointment.', mood: 'grim', next: 'end' },
      { id: 'told', speaker: 'npc_ilyra', text: "Then you'll know I say yes to that with a smile and don't believe a word. Help me listen anyway.", mood: 'wry', next: 'end' },
      { id: 'spoke', speaker: 'npc_ilyra', text: 'Then write down every word, before you lose them.', mood: 'afraid', next: 'end' }, // fixture line
    ],
  },
] satisfies DialogueSceneInput[];

// ---- Loop-meta records (STORY §10, §12; DESIGN §11, §15.1) ------------------------------------------------------------------

const echoes = [
  {
    id: 'echo_tyrant_speaks',
    name: 'It Speaks',
    codexLine: "I listened instead of striking. It said: 'You have crossed. So.' Next time I can answer it.",
    category: 'dialogue',
    obtainedBy: ['event:ev_apex_listen'],
  },
  {
    id: 'echo_apex_resonance',
    name: 'The Way Up',
    codexLine: 'I have stood at the Apex once. The stair at the Nexus remembers me now.',
    category: 'route',
    obtainedBy: ['event:ev_apex_first_entry'],
  },
  // U29: what the communion answers and outcomes read (STORY §12 ids and categories; fixture codex lines), all granted
  // by the fixture's `ev_apex_remember`; the consent Echo by outcome B
  ...(
    [
      ['echo_tyrant_jailer', 'The Jailer', 'lore'],
      ['echo_tyrant_never_struck', 'It Never Struck First', 'lore'],
      ['echo_thirtieth_dawn', 'The Thirtieth Dawn', 'lore'],
      ['echo_seven_wayfinders', 'Seven Before Me', 'lore'],
      ['echo_litany_verse_2', 'Litany, Verse Two', 'lore'],
      ['echo_korr_marginalia', "Korr's Margins", 'lore'],
      ['echo_litany_verse_7', 'Litany, Verse Seven', 'lore'],
      ['echo_eye_of_masque', 'The Eye of Masque', 'lore'],
      ['echo_ritual_inevitable', 'It Always Failed', 'lore'],
      ['echo_hallow_said_stop', 'Hallow Said Stop', 'lore'],
      ['echo_litany_complete', 'The Whole Litany', 'ending'],
      ['echo_void_resonance', 'Void Resonance', 'ending'],
      ['echo_heartstone_resonance', 'Heartstone Resonance', 'ending'],
      ['echo_anchor_mechanic', 'Both Ends', 'ending'],
    ] as const
  ).map(([id, name, category]) => ({ id, name, codexLine: `Fixture: ${name}.`, category, obtainedBy: ['event:ev_apex_remember'] })),
  {
    id: 'echo_tyrant_consent',
    name: 'Consent',
    codexLine: 'Fixture: it said the word it could not say.',
    category: 'ending',
    obtainedBy: ['creature:cr_chronos_tyrant_unveiled'],
  },
] satisfies EchoInput[];

/** U29: each Movement's Listen fragments (DESIGN §4.11), one per voice, and what the consent unlocks (fixture bodies). */
const codex = [
  { id: 'codex_tyrant_holding', title: 'The Holding', voice: 'remnant_archive', category: 'the_nine', body: 'Fixture: it calls the hold the Holding.' },
  { id: 'codex_tyrant_reflex', title: 'The Reflex', voice: 'weaver_fragment', category: 'the_nine', body: 'Fixture: the strikes are the hold, not the man.' },
  { id: 'codex_tyrant_fracture', title: 'Five Under One', voice: 'ironclad_telling', category: 'the_nine', body: 'Fixture: five of the Nine surface through him.' },
  { id: 'codex_tyrant_alone', title: 'One Voice', voice: 'wayfinder_notes', category: 'the_nine', body: 'Fixture: the chorus quiets; Veyran speaks alone.' },
  {
    id: 'codex_tyrant_consent',
    title: 'Hour, Go',
    voice: 'wayfinder_notes',
    category: 'the_nine',
    body: 'Fixture: the word he could not say.',
    unlockWhen: { echo: 'echo_tyrant_consent' },
  },
] satisfies CodexEntryInput[];

/** STORY §10.6: ending F, reached from the communion outcome `let_pass`. */
const endings = [
  {
    id: 'ending_unbound',
    letter: 'F',
    kind: 'true',
    name: 'The Unbound',
    tagline: 'Through the tear, toward somewhere that is not Aethelgard.',
    requirements: {
      all: [
        { flag: 'flag_tyrant_spared' },
        { loop: { min: 2 } },
        { resolve: { min: 3 } },
        { location: 'loc_temporal_breach_apex' },
        { flag: 'flag_refused_all_paths' },
      ],
    },
    sequence: [
      { text: "The Tyrant, spared: 'Or go. The tear is open. I will not stop you. I have never been able to stop anyone.'", mood: 'cold' },
      { text: 'You step past it, into the Breach, toward somewhere that is not Aethelgard.' },
      {
        text: 'The journey through the Temporal Breach is disorienting, a maelstrom of fractured realities. When you finally emerge, the air is still, the world unfamiliar.',
      },
    ],
    epilogues: [
      { subject: 'world', text: 'The thirtieth dawn came. The sky tore. It was as you saw it.' },
      { subject: 'remnants', text: 'They kept writing until there was no paper.' },
    ],
    resonance: 50,
    credits: true,
  },
  // U29: STORY §10.1 / §10.2 requirement blocks, reached from the communion outcomes `take_place` and `mending`
  {
    id: 'ending_wardens_vigil',
    letter: 'A',
    kind: 'true',
    name: "The Warden's Vigil",
    tagline: 'Whoever says the ninth must stay in it.', // fixture line
    requirements: {
      all: [{ echo: 'echo_litany_complete' }, { flag: 'flag_tyrant_spared' }, { resolve: { min: 6 } }, { location: 'loc_temporal_breach_apex' }],
    },
    sequence: [{ text: '—I hold you.' }], // fixture line
    resonance: 50,
    credits: true,
  },
  {
    id: 'ending_mending',
    letter: 'B',
    kind: 'true',
    name: 'The Mending',
    tagline: 'Both ends.', // fixture line
    requirements: {
      all: [
        { resolve: { min: 8 } },
        { flag: 'flag_tyrant_spared' },
        { echo: 'echo_heartstone_resonance' },
        { echo: 'echo_litany_complete' },
        { echo: 'echo_void_resonance' },
        { echo: 'echo_anchor_mechanic' },
        { item: { id: 'item_breach_anchor' } },
        { counter: { name: 'factions_trusted', min: 2 } },
        { flag: 'flag_conflux_anchored' },
        { flag: 'flag_cradle_pin_anchored' },
        { location: 'loc_temporal_breach_apex' },
      ],
    },
    sequence: [{ text: 'Hour, go.' }], // fixture line
    resonance: 100,
    credits: true,
  },
] satisfies EndingInput[];

const factions = [
  {
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
  },
] satisfies FactionInput[];

/** DESIGN §15.1 / §10.1. */
const modifiers = [
  {
    id: 'mod_frayed_clock',
    name: 'Frayed Clock',
    description: 'Base clock 20 days; all clock modifiers halved toward zero.',
    rules: [{ kind: 'clock_base_watches', watches: 80, halveOthers: true }],
    icon: 'frayed_clock',
  },
] satisfies ModifierInput[];

// ---- Assembly -----------------------------------------------------------------------------------------------------------

/** The fixture's authored tables. Frozen: build a variant with `{ ...miniContentTables, items: [...] }`. */
export const miniContentTables: ContentTables = deepFreeze({
  regions,
  locations,
  creatures,
  items,
  recipes,
  abilities,
  classes,
  statuses,
  quests,
  dialogues,
  npcs,
  companions,
  echoes,
  codex,
  achievements: [],
  attunements: [],
  modifiers,
  endings,
  merchants,
  affixes: [],
  encounters: [],
  factions,
  config: { ...clone(configInput), apexGate: FIXTURE_APEX_GATE }, // cloned: freezing must not reach the shared defaults
});

let cached: ContentPack | null = null;

/**
 * The fixture pack, built once through `buildContentPack` (throws `ContentError` with the full report if a table
 * stops parsing) and deep-frozen, so an engine reducer that writes to content fails at once.
 */
export function fixturePack(): ContentPack {
  cached ??= deepFreeze(buildContentPack(miniContentTables, { version: FIXTURE_VERSION }));
  return cached;
}
