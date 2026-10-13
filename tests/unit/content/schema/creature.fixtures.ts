// U16 fixtures: the DESIGN §4.12 worked-example creatures and both Chronos Tyrants (DESIGN §4.10), transcribed with
// WORLD §6 move ids and telegraph lines. Numbers are DESIGN's; text is WORLD's (fixture-only lines are marked).
import type { CreatureInput, MoveInput, Step } from '@schema/creature';

/** DESIGN §4.12: HP 64, ATK 11, armor 3, ward 0, AGI 3; `strike → strike → maul → {hp<50%: root_knit | strike}`. */
export const wildlingBrute = {
  id: 'cr_wildling_brute',
  name: 'Wildling Brute',
  description: 'A hulking creature grown from twisted roots and bone.',
  family: 'fam_wilds',
  role: 'fodder',
  level: 4,
  stats: { hp: 64, atk: 11, armor: 3, ward: 0, agi: 3 },
  resistances: { fire: 'weak' },
  moves: {
    brute_strike: { name: 'Strike', line: 'It lifts a root-knotted arm over you.', type: 'physical', power: { coef: 1.0, stat: 'atk' } },
    brute_maul: { name: 'Maul', line: 'Bone grinds as it winds back both arms.', type: 'physical', power: { coef: 1.6, stat: 'atk' } },
    brute_root_knit: {
      name: 'Root Knit',
      line: 'Roots crawl back over its wounds.',
      statuses: [{ status: 'status_regen', duration: 2, target: 'self', power: { base: 3 } }],
    },
  },
  pattern: [
    { move: 'brute_strike', target: 'player' },
    { move: 'brute_strike', target: 'player' },
    { move: 'brute_maul', target: 'player' },
    { if: { hpBelow: 0.5 }, then: [{ move: 'brute_root_knit', target: 'self' }], else: [{ move: 'brute_strike', target: 'player' }] },
  ],
  loot: [
    { itemId: 'item_ley_touched_tonic', chance: 0.6 },
    { itemId: 'item_wildling_hide_armor', chance: 0.25 },
    { itemId: 'mat_wildling_hide', chance: 0.8 },
    { itemId: 'mat_rootbone', chance: 0.4 },
  ],
  gold: { min: 11, max: 18 },
  xp: 71,
  bestiary: {
    voice: 'wayfinder_notes',
    summary: 'Roots and bone, grown into a shape that walks. It swings twice and then winds up; the third one is the one to Guard.',
    tactics: 'Guard the Maul. Fire is weak; Void strips the knit-Regen; Bleed and Poison both work.',
  },
  sigil: { base: 'brute' },
  legacyName: 'Wildling Brute',
} satisfies CreatureInput;

/** DESIGN §4.12: HP 36, ATK 7, SP 7, armor 1, ward 2, AGI 5; poison-immune; `rake → wail → {hp<70%: fade | rake}`. */
export const corruptedShade = {
  id: 'cr_corrupted_shade',
  name: 'Corrupted Shade',
  description: 'A smeared silhouette of a once-noble mage, warped by wild magic.',
  family: 'fam_hollowed',
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
  // D-055 as PLAN §5.4 states it: 100% while the flag is unset, then 50%.
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
  legacyName: 'Corrupted Shade',
} satisfies CreatureInput;

const TYRANT_DESCRIPTION =
  'A towering, amorphous figure of rippling time. Skeletal limbs and crystalline shards surface and vanish within its shifting mass.';
const TYRANT_IMMUNE: `status_${string}`[] = ['status_stun', 'status_slow', 'status_poison', 'status_bleed'];

/** Moves both Tyrants share (WORLD §6.8); each definition carries its own copy. */
const sharedMoves = {
  tyr_grasp: {
    name: 'Grasp',
    line: 'A skeletal limb surfaces, reaching.',
    type: 'physical',
    power: { coef: 1.2, stat: 'atk' },
    statuses: [{ status: 'status_slow', chance: 1, duration: 2 }],
  },
  tyr_shear: { name: 'Shear', line: 'Time thickens around your feet.', type: 'chrono', power: { coef: 1.0, stat: 'sp' } },
  tyr_time_lash: { name: 'Time Lash', line: 'The hour draws tight, then lashes at you.', type: 'chrono', power: { coef: 1.3, stat: 'sp' } },
  tyr_gather: {
    name: 'Gather',
    line: 'The hour draws back like an arm. It will fall.',
    hidden: true,
    windUp: { turns: 2, then: 'tyr_chrono_strike' },
  },
  tyr_chrono_strike: {
    name: 'Chrono-Strike',
    line: 'The hour falls.', // fixture-only line (WORLD gives only the wind-up's)
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
  tyr_unraveling: {
    name: 'Unraveling',
    line: 'The Tyrant stops guarding itself. Everything here comes loose.',
    type: 'chrono',
    power: { coef: 1.1, stat: 'sp' },
    statuses: [{ status: 'status_armor_break', chance: 1, duration: 2 }],
  },
} satisfies Record<string, MoveInput>;

/** DESIGN §4.10 row 1 (D-051, D-066.1): 460/24/26/6/8/4; The Holding → The Fracture (<66%) → The Nine Speak (<33% OR round 12). */
export const tyrantContained = {
  id: 'cr_chronos_tyrant_contained',
  name: 'The Chronos Tyrant',
  description: TYRANT_DESCRIPTION,
  family: 'fam_unravelled',
  role: 'boss',
  level: 14,
  stats: { hp: 460, atk: 24, sp: 26, armor: 6, ward: 8, agi: 4 },
  tags: ['breach_born'],
  resistances: { ley: 'weak', chrono: 'resist', void: 'resist' },
  statusImmunities: TYRANT_IMMUNE,
  tauntImmune: true,
  interruptible: true,
  fleeable: false,
  moves: {
    ...sharedMoves,
    tyr_brace: { name: 'Brace', line: 'The Tyrant braces the hour against you.', shield: { power: { coef: 0.6, stat: 'sp' } } },
    tyr_korr_burns: {
      name: 'Korr Burns',
      line: 'Something that was a scholar burns.',
      type: 'fire',
      power: { coef: 1.0, stat: 'sp' },
      statuses: [{ status: 'status_burn', chance: 0.6, duration: 3 }],
    },
    tyr_vane_closes: {
      name: 'Vane Closes',
      line: 'Stone-grey hands close on your left.',
      type: 'physical',
      power: { coef: 1.1, stat: 'atk' },
      statuses: [{ status: 'status_armor_break', chance: 0.6, duration: 3 }],
    },
    tyr_aulde_sings: { name: 'Aulde Sings', line: 'One clear note rises. Light settles over the mass.', shield: { power: { coef: 1.0, stat: 'sp' } } },
    tyr_sallow_breathes: {
      name: 'Sallow Breathes',
      line: 'Green breath leaks from the mass toward you.',
      type: 'ley',
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_poison', chance: 0.7, duration: 4 }],
    },
  },
  phases: [
    {
      id: 'tyr_movement_1',
      name: 'The Holding',
      // tyr_brace alternating with grasp / shear / time lash
      pattern: [
        { move: 'tyr_brace', target: 'self' },
        { move: 'tyr_grasp', target: 'player' },
        { move: 'tyr_brace', target: 'self' },
        { move: 'tyr_shear', target: 'all' },
        { move: 'tyr_brace', target: 'self' },
        { move: 'tyr_time_lash', target: 'player' },
      ],
    },
    {
      id: 'tyr_movement_2',
      name: 'The Fracture',
      enterWhen: [{ hpBelow: 0.66 }],
      line: 'The mass splits along old seams. Things that were people surface and do not sink back.',
      adds: [{ creatureId: 'cr_temporal_aberration', count: 2, countSolo: 1, hpPct: 0.4 }],
      pattern: [
        { move: 'tyr_korr_burns', target: 'player' },
        { move: 'tyr_vane_closes', target: 'player' },
        { move: 'tyr_gather', target: 'player' },
        { move: 'tyr_aulde_sings', target: 'self' },
        { move: 'tyr_sallow_breathes', target: 'player' },
        { move: 'tyr_remember', target: 'self', when: { oncePerFight: true } },
      ],
    },
    {
      id: 'tyr_movement_3',
      name: 'The Nine Speak',
      enterWhen: [{ hpBelow: 0.33 }, { round: 12 }],
      line: 'It stops guarding itself. Every wound you give it is answered by a voice.',
      damageTakenMult: 1.5,
      pattern: [
        { move: 'tyr_unraveling', target: 'all' },
        { move: 'tyr_remember', target: 'self', when: { oncePerFight: true } },
      ],
    },
  ],
  gold: { min: 0, max: 0 },
  xp: 900,
  onDefeat: [{ setFlag: 'flag_tyrant_dead' }],
  bestiary: {
    voice: 'remnant_archive',
    summary: 'Year 44. The Remnants named it the Chronos Tyrant after the first Wayfinder, Sael Orrin, died before it.',
    tactics: 'Ley throughout. Guard every Chrono-Strike wind-up. Void or Ley after Remember.',
  },
  sigil: { base: 'tyrant', accent: 'chrono' },
  legacyName: 'The Chronos Tyrant',
} satisfies CreatureInput;

const P1_MOVES = [
  { w: 1, step: { move: 'tyr_time_lash', target: 'player' } },
  { w: 1, step: { move: 'tyr_grasp', target: 'player' } },
  { w: 1, step: { move: 'tyr_shear', target: 'all' } },
] satisfies { w: number; step: Step }[];

/** DESIGN §4.10 row 2 (D-051) + §4.11 communion (D-054, D-066.6, D-067.3): 900/32/36/8/10/4, four phases. */
export const tyrantUnveiled = {
  id: 'cr_chronos_tyrant_unveiled',
  name: 'The Chronos Tyrant',
  description: TYRANT_DESCRIPTION,
  family: 'fam_unravelled',
  role: 'boss',
  level: 18,
  stats: { hp: 900, atk: 32, sp: 36, armor: 8, ward: 10, agi: 4 },
  tags: ['breach_born'],
  resistances: { ley: 'weak', chrono: 'resist', void: 'resist' },
  statusImmunities: TYRANT_IMMUNE,
  tauntImmune: true,
  fleeable: false,
  moves: {
    ...sharedMoves,
    tyr_speak: { name: 'Speak', line: "It speaks: 'You have crossed. So.'" },
    tyr_hour_presses: { name: 'The Hour Presses', line: 'The hour leans on you while it waits.', type: 'chrono', special: 'hour_presses' },
  },
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
      adds: [{ creatureId: 'cr_tyrants_reach', count: 2, reinforce: { maxAlive: 2, total: 5 } }],
      pattern: [{ if: { everyNth: 3 }, then: [{ move: 'tyr_remember', target: 'self' }], else: [{ weighted: [...P1_MOVES] }] }],
    },
    {
      id: 'tyr_movement_3',
      name: 'Chrono-Strike',
      enterWhen: [{ hpBelow: 0.5 }],
      line: "'I hold,' it says. 'If I do not hold, you have seen what comes.'",
      pattern: [{ if: { everyNth: 3 }, then: [{ move: 'tyr_gather', target: 'player' }], else: [{ weighted: [...P1_MOVES] }] }],
    },
    {
      id: 'tyr_phase_4',
      name: 'The Hold Fails',
      enterWhen: [{ hpBelow: 0.25 }, { round: 20 }],
      line: 'The hold fails. The chorus stops pretending to be one voice.',
      damageDealtRampPerRound: 0.1,
      pattern: [{ move: 'tyr_unraveling', target: 'all' }],
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
              { id: 'jailer', when: { echo: 'echo_tyrant_jailer' }, resolve: 1, text: 'You are not the cause. You are the lock.' },
              { id: 'never_struck', when: { echo: 'echo_tyrant_never_struck' }, resolve: 1, text: 'You have never struck first.' },
              { id: 'to_kill_you', when: { all: [] }, resolve: 1, text: 'To kill you.' },
              { id: 'lie', when: { all: [] }, resolve: -2, lie: true, text: 'I was lost.' },
            ],
          },
          {
            id: 'tyr_q_hour',
            line: 'It asks what day this is, for you.',
            answers: [{ id: 'thirtieth_dawn', when: { echo: 'echo_thirtieth_dawn' }, resolve: 1, text: 'The thirtieth dawn is coming.' }],
          },
          {
            id: 'tyr_q_before',
            line: 'It asks who came before you.',
            answers: [{ id: 'seven_wayfinders', when: { echo: 'echo_seven_wayfinders' }, resolve: 1, text: 'Seven Wayfinders.' }],
          },
        ],
      },
      {
        id: 'tyr_movement_2',
        questions: [
          {
            id: 'tyr_q_korr',
            line: "'What is read is owed. What have you read?'",
            answers: [
              { id: 'verse', when: { echo: 'echo_litany_verse_2' }, resolve: 1, text: 'The second verse.' },
              { id: 'marginalia', when: { echo: 'echo_korr_marginalia' }, resolve: 1, text: 'Your marginalia.' },
              { id: 'corrupted', when: { corruption: { min: 3 } }, resolve: 1, text: 'Enough to owe.' },
            ],
          },
          {
            id: 'tyr_q_vane',
            line: "'Who guards the gate now?'",
            answers: [
              { id: 'verse', when: { echo: 'echo_litany_verse_3' }, resolve: 1, text: 'The third verse.' },
              { id: 'stone_hide', when: { echo: 'echo_stone_hide_origin' }, resolve: 1, text: 'Your stone, still standing.' },
            ],
          },
          {
            id: 'tyr_q_aulde',
            line: "'What note does the sky hold?'",
            answers: [
              { id: 'verse', when: { echo: 'echo_litany_verse_5' }, resolve: 1, text: 'The fifth verse.' },
              { id: 'spire_note', when: { echo: 'echo_spire_note' }, resolve: 1, text: 'Your note, in the Spires.' },
            ],
          },
          {
            id: 'tyr_q_sallow',
            line: "'What lives, that carries what does not?'",
            answers: [
              { id: 'verse', when: { echo: 'echo_litany_verse_6' }, resolve: 1, text: 'The sixth verse.' },
              { id: 'breathing_pool', when: { any: [{ echo: 'echo_breathing_pool' }, { companion: { id: 'mireya' } }] }, resolve: 1, text: 'The pool breathes.' },
            ],
          },
          {
            id: 'tyr_q_masque',
            line: "'Tell me what you saw from the far side.'",
            answers: [
              { id: 'verse', when: { echo: 'echo_litany_verse_7' }, resolve: 1, text: 'The seventh verse.' },
              { id: 'eye', when: { echo: 'echo_eye_of_masque' }, resolve: 1, text: 'Your eye, looking back.' },
              { id: 'inevitable', when: { echo: 'echo_ritual_inevitable' }, resolve: 2, text: 'That it could not have gone otherwise.' },
            ],
          },
          {
            id: 'tyr_q_hallow',
            line: 'The chorus leaves a gap where a sixth voice should be.',
            answers: [{ id: 'hallow_said_stop', when: { echo: 'echo_hallow_said_stop' }, resolve: 2, text: 'Hallow said stop.' }],
          },
        ],
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
      },
    ],
    offers: [
      { itemId: 'item_chronos_lens', resolve: 1, effects: [] },
      { itemId: 'item_stabilized_heartstone', resolve: 1, effects: [] },
      { itemId: 'item_breach_anchor', resolve: 2, effects: [{ setFlag: 'flag_anchor_offered' }] },
      { itemId: 'item_heartstone_core', resolve: -2, effects: [] },
    ],
    outcomes: [
      { minResolve: 3, choiceId: 'let_pass', effects: [{ setFlag: 'flag_tyrant_spared' }] },
      { minResolve: 6, when: { echo: 'echo_litany_complete' }, choiceId: 'take_its_place', effects: [{ setFlag: 'flag_tyrant_spared' }] },
      {
        minResolve: 8,
        when: {
          all: [
            { echo: 'echo_litany_complete' },
            { echo: 'echo_heartstone_resonance' },
            { echo: 'echo_void_resonance' },
            { echo: 'echo_anchor_mechanic' },
            { item: { id: 'item_breach_anchor' } },
            { counter: { name: 'factions_trusted', min: 2 } },
            { flag: 'flag_conflux_anchored' },
            { flag: 'flag_cradle_pin_anchored' },
          ],
        },
        choiceId: 'the_mending',
        effects: [{ setFlag: 'flag_tyrant_spared' }, { grantEcho: 'echo_tyrant_consent' }],
      },
    ],
  },
  loot: [
    { itemId: 'mat_tyrant_shard', count: 4 },
    { itemId: 'mat_frayed_moment', count: 3 },
  ],
  gold: { min: 0, max: 0 },
  xp: 1600,
  onDefeat: [{ setFlag: 'flag_tyrant_dead' }],
  bestiary: {
    voice: 'wayfinder_notes',
    summary: 'Loop 2. It spoke. "You have crossed. So." A chorus, with one voice under it like a bass line.',
    tactics: 'Fight: Ley, kill Aulde and Sallow reaches first, Guard every Chrono-Strike. Commune: bring the verses.',
  },
  sigil: { base: 'tyrant', accent: 'chrono', details: ['unveiled'] },
} satisfies CreatureInput;
