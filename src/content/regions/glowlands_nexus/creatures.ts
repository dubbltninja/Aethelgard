// Glowlands & Nexus — the creatures whose first region (WORLD §6's Regions column) is the Glowlands, the Nexus or the
// Apex (D-090): the Glowfen Mireling, the Lantern Toad, the Spore Drift (the Green); the Temporal Aberration, the
// Hourglass Crawler, the Orrery Knight, the Hour Leech (Watch-wardens); both Chronos Tyrants (D-051). With them the two
// Unravelled the Tyrants bring: the Tyrant's Reach (the Unveiled's add; its first region is the Highlands, but the brief
// gives it here) and the Horde Husk (no first region: "any infected node"; D-091 gives it to U45). WORLD §5–6 blocks;
// numbers DESIGN §4.10 for the Tyrants (D-062, the "Done when" check), §6.2/§6.5 for the rest; rules DESIGN §4.2–4.6.
//
// Conventions are U42's (silverwood_ruins/creatures.ts header): stats `HP · ATK · DEF armor/ward · AGI`, SP = ATK
// unless WORLD gives one (only the Tyrants do) and non-physical moves scale on SP; a move's type is the creature's
// primary type unless the line names one; `all` = area, `you` = player; `breach_born` / `construct` tags with their
// immunities written out; loot rows in WORLD's order; bestiary and tactics WORLD's text verbatim (markdown and decision
// references dropped); `description` the legacy line where one exists, else a sentence from the bestiary.
//
// Patterns. WORLD's rule: unconditioned moves cycle top to bottom; a conditioned move replaces the next cycled move when
// its condition holds at intent generation, first match top to bottom. The engine's pointer walk (combat/intents.ts)
// checks a step only when the pointer reaches it, so U42's "conditioned steps first" form tests the conditions once per
// lap, which loses a cadence whenever the lap does not divide it (three cycled moves and `everyNth: 3` never fire). So:
//   - a creature with one or two cycled moves has ONE step, a first-match `if` chain evaluated on every turn (`firstOf`);
//     two cycled moves alternate by its own turn (`alternate`: odd turns the first, even turns the second), which is
//     the cycle the pointer would walk, and keeps a `oncePerFight` step single (its once-key is the step's path);
//   - a Tyrant phase with three cycled moves and an `everyNth` move checks it before each cycled move (`everyNthAmong`),
//     so it fires on exactly the turns it names and the cycle resumes after it.
// tests/unit/content/regions/glowlands_nexus.test.ts walks every pattern turn by turn and checks each cadence word.
// Readings (listed in the U45 reply): a self-Rewind `ifHpBelow:50` with no "once" waits while its Rewind runs
// (`not selfHas status_rewind`: a second cast is a no-op, statuses.ts "already holds a Rewind"); the Hour Leech has no
// unconditioned move, so its opener (`first`) is also its cycled move.
import type { CombatWhen, CreatureInput, MoveInput, Step } from '@schema/creature';

const REVEALS = [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] as const;

/** WORLD's first-match rule as one step: `[condition, step]` pairs top to bottom, then `otherwise` (the cycled move). */
function firstOf(conditioned: readonly (readonly [CombatWhen, Step])[], otherwise: Step): Step {
  return conditioned.reduceRight<Step>((rest, [when, step]) => ({ if: when, then: [step], else: [rest] }), otherwise);
}

/** Two cycled moves: the first on the creature's odd turns, the second on its even turns. */
const alternate = (odd: Step, even: Step): Step => ({ if: { everyNth: 2 }, then: [even], else: [odd] });

/** `step` on the creature's n-th, 2n-th … turns, checked before each cycled move (see the header). */
const everyNthAmong = (step: Extract<Step, { move: string }>, n: number, cycle: readonly Step[]): Step[] =>
  cycle.flatMap((s) => [{ ...step, when: { everyNth: n } }, s]);

/** A self-Rewind at low HP that waits while its Rewind still runs (see the header). */
const hurtAndUnwound = (below: number): CombatWhen => ({ all: [{ hpBelow: below }, { not: { selfHas: 'status_rewind' } }] });

const REWIND_SELF: NonNullable<MoveInput['statuses']> = [{ status: 'status_rewind', duration: 2, target: 'self' }];

// ==== The Green (WORLD §6.6) =========================================================================================

// ---- cr_glowfen_mireling — Green (Mireling) · L9 fodder · XP 189 · legacy -------------------------------------------------
const glowfenMireling = {
  id: 'cr_glowfen_mireling',
  name: 'Glowfen Mireling',
  legacyName: 'Glowfen Mireling',
  description: 'An amphibious creature wreathed in eerie green light.',
  family: 'fam_green',
  materialKin: 'mireling',
  role: 'fodder',
  level: 9,
  stats: { hp: 110, atk: 18, sp: 18, armor: 2, ward: 3, agi: 6 },
  tags: ['legacy'],
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
      power: { coef: 0.9, stat: 'sp' },
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
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_blind', chance: 0.3, duration: 1 }],
    },
  },
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'mireling_breathe_in', target: 'self' }],
        [{ everyNth: 3 }, { move: 'mireling_glow_burst', target: 'all' }],
      ],
      alternate({ move: 'mireling_spit', target: 'player' }, { move: 'mireling_drag', target: 'player' }),
    ),
  ],
  loot: [
    { itemId: 'item_glow_moss', chance: 0.6 }, // legacy
    { itemId: 'mat_glow_gland', chance: 0.7 },
  ],
  gold: { min: 21, max: 33 },
  xp: 189,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Frog-backed, man-high, glowing from the throat down. It breathes in before it fights: that is its Regen. Void takes the Regen away; fire takes the rest. Mireya won\'t say what they were. She says "not yet," the way Elder Tam does. They follow lit boats and never touch them.',
    tactics: 'Void first (strips Regen, interplay 14), then fire. A lit party passes them in the Reed Maze (q_the_drowned_lantern).',
    codexId: 'codex_creatures_green',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_lit', details: ['throat_glow'] },
} satisfies CreatureInput;

// ---- cr_lantern_toad — Green · L8 fodder · XP 161 (also the Lantern Matron's add, the Glowfen unit's) ----------------------
const lanternToad = {
  id: 'cr_lantern_toad',
  name: 'Lantern Toad',
  description: 'A dog-sized toad of the Causeway, its throat-sac lit by Breach-leak. It lures with the light and strikes whatever comes to look.',
  family: 'fam_green',
  materialKin: 'mireling',
  role: 'fodder',
  level: 8,
  stats: { hp: 96, atk: 17, sp: 17, armor: 3, ward: 2, agi: 4 },
  tags: ['matron_add'],
  resistances: { fire: 'weak', void: 'weak', ley: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    toad_lure: { name: 'Lure', line: 'Its throat-sac lights like a lantern on a pole.', statuses: [{ status: 'status_blind', chance: 0.5, duration: 2 }] },
    toad_tongue: {
      name: 'Tongue',
      line: 'A tongue the length of a reed snaps out.',
      type: 'physical',
      power: { coef: 1.0, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.3, duration: 2 }],
    },
    toad_swallow_light: { name: 'Swallow Light', line: 'It gulps, and the light goes into it.', shield: { power: { coef: 1.0, stat: 'atk' } } },
    toad_flop: { name: 'Flop', line: 'It gathers itself, heavy, over your feet.', type: 'physical', power: { coef: 1.3, stat: 'atk' } },
  },
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'toad_lure', target: 'player' }],
        [{ targetHas: 'status_blind' }, { move: 'toad_swallow_light', target: 'self' }],
        [{ everyNth: 3 }, { move: 'toad_flop', target: 'player' }],
      ],
      { move: 'toad_tongue', target: 'player' },
    ),
  ],
  // WORLD lists the Glow Gland twice (50 %, then 30 %): two rows, as written
  loot: [
    { itemId: 'mat_glow_gland', chance: 0.5 },
    { itemId: 'mat_glow_gland', chance: 0.3 },
  ],
  gold: { min: 19, max: 30 },
  xp: 161,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      'Year 488. The lantern-toad of the Causeway: dog-sized, its throat-sac lit by Breach-leak. It lures with the light and strikes whatever comes to look. Lanternreed children call them night-lamps and are taught not to follow them. The Matron in the Hall keeps them the way a village keeps geese.',
    tactics: 'Cleanse Blind and it never Shields; fire.',
    codexId: 'codex_creatures_green',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_lit', details: ['throat_sac'] },
} satisfies CreatureInput;

// ---- cr_spore_drift — Green · L9 fodder · XP 189 ---------------------------------------------------------------------------
const sporeDrift = {
  id: 'cr_spore_drift',
  name: 'Spore Drift',
  description: 'A cloud that drifts against the wind. Breathing it is sweet, then it is not.',
  family: 'fam_green',
  materialKin: 'mireling',
  role: 'fodder',
  level: 9,
  stats: { hp: 96, atk: 18, sp: 18, armor: 0, ward: 4, agi: 5 },
  tags: [],
  resistances: { fire: 'weak', storm: 'weak', physical: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    spore_sweet_air: {
      name: 'Sweet Air',
      line: 'The air around it turns sweet.',
      type: 'ley',
      power: { coef: 0.3, stat: 'sp' },
      statuses: [{ status: 'status_poison', chance: 0.7, duration: 4 }],
    },
    spore_settle: {
      name: 'Settle',
      line: 'It settles on you like warm dust.',
      type: 'ley',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_weaken', chance: 0.4, duration: 2 }],
    },
    spore_bloom: { name: 'Bloom', line: 'Light-dust blooms from it in a slow ring.', statuses: [{ status: 'status_blind', chance: 0.4, duration: 1 }] },
    // WORLD `onDeath` ("resolves when it dies, before loot"): the creature's `deathMove` (U34e, D-092)
    spore_burst: {
      name: 'Burst',
      line: 'It bursts, sweetly.',
      type: 'ley',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_poison', chance: 1, duration: 4 }],
    },
  },
  pattern: [
    firstOf(
      [[{ everyNth: 3 }, { move: 'spore_bloom', target: 'all' }]],
      alternate({ move: 'spore_sweet_air', target: 'all' }, { move: 'spore_settle', target: 'player' }),
    ),
  ],
  deathMove: { move: 'spore_burst', target: 'all' }, // U34e (D-092): "0.8× all · poison 100% 4 · onDeath"
  loot: [
    { itemId: 'mat_glow_gland', chance: 0.7 },
    { itemId: 'item_antidote_root', chance: 0.2 },
  ],
  gold: { min: 21, max: 33 },
  xp: 189,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'A cloud that drifts against the wind. Breathing it is sweet, then it is not. A blade mostly hits air. Fire takes it in one breath. If I must kill it close, I kill it last, and I have the antidote root out first: it bursts when it dies.',
    tactics: 'Fire or Storm from range; carry antidote root; kill it after its neighbours.',
    codexId: 'codex_creatures_green',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_lit', details: ['spore_ring'] },
} satisfies CreatureInput;

// ==== Watch-wardens (WORLD §6.7) ======================================================================================

// ---- cr_temporal_aberration — Watch-wardens (Aberration) · L12 elite · XP 520 · legacy; the Contained Tyrant's add --------
const temporalAberration = {
  id: 'cr_temporal_aberration',
  name: 'Temporal Aberration',
  legacyName: 'Temporal Aberration',
  description: 'A warped being that flickers between past and future strikes.',
  family: 'fam_watch_wardens',
  materialKin: 'aberration',
  role: 'elite',
  level: 12,
  stats: { hp: 280, atk: 23, sp: 23, armor: 4, ward: 4, agi: 8 },
  tags: ['breach_born', 'legacy'],
  resistances: { void: 'weak', chrono: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    aberration_flicker_strike: {
      name: 'Flicker Strike',
      line: 'It flickers. The blow is already on its way.',
      type: 'chrono',
      power: { coef: 1.3, stat: 'sp' },
      hidden: true,
    },
    aberration_past_blow: {
      name: 'Past Blow',
      line: 'Something it did a moment ago arrives now.',
      type: 'chrono',
      power: { coef: 1.0, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.4, duration: 2 }],
    },
    aberration_future_blow: {
      name: 'Future Blow',
      line: 'It strikes at a moment that has not happened.',
      type: 'chrono',
      power: { coef: 0.8, stat: 'sp' },
      hidden: true,
    },
    aberration_rewind: { name: 'Rewind', line: 'Its wounds run backward into it.', statuses: [...REWIND_SELF] },
  },
  pattern: [
    firstOf(
      [
        [{ everyNth: 3 }, { move: 'aberration_future_blow', target: 'all' }],
        [{ all: [{ hpBelow: 0.5 }, { oncePerFight: true }] }, { move: 'aberration_rewind', target: 'self' }],
      ],
      alternate({ move: 'aberration_flicker_strike', target: 'player' }, { move: 'aberration_past_blow', target: 'player' }),
    ),
  ],
  loot: [
    { itemId: 'item_chronal_dust' }, // legacy, 100 %
    { itemId: 'mat_frayed_moment', chance: 0.8 },
    // WORLD §7.10: 100 % while q_unlidded_eye is active (the Nexus Aberration is its target)
    { itemId: 'item_aberrant_eye', when: { quest: { id: 'q_unlidded_eye', status: 'active' } } },
  ],
  gold: { min: 54, max: 84 },
  xp: 520,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 302. Tovren Masque built watch-wardens to keep the observatory's hours while he read the sky. When the dome fell the hours broke, and the wardens kept them anyway, all of them, out of order. An Aberration strikes from a moment that has not arrived, or one already gone. Its eye sees between moments. The Weavers pay well for one.",
    tactics: 'Guard the "?" turns. Hit it with Void while Rewind is on it (consumes it, ×1.25).',
    codexId: 'codex_creatures_watch_wardens',
    reveals: [...REVEALS],
  },
  sigil: { base: 'spiral', details: ['slow_rotation'] },
} satisfies CreatureInput;

// ---- cr_hourglass_crawler — Watch-wardens · L11 fodder · XP 253 (also the exploited Depths') -------------------------------
const hourglassCrawler = {
  id: 'cr_hourglass_crawler',
  name: 'Hourglass Crawler',
  description: 'Hand-long, glass in the middle, sand inside. Hurt, it rolls over and the sand runs back up, and so does its health.',
  family: 'fam_watch_wardens',
  materialKin: 'aberration',
  role: 'fodder',
  level: 11,
  stats: { hp: 130, atk: 21, sp: 21, armor: 5, ward: 3, agi: 3 },
  tags: ['breach_born'],
  resistances: { void: 'weak', storm: 'weak', chrono: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    crawler_sand: {
      name: 'Sand',
      line: 'Sand runs from its body across your boots.',
      type: 'chrono',
      power: { coef: 0.7, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.6, duration: 2 }],
    },
    crawler_pincer: {
      name: 'Pincer',
      line: 'Glass pincers close at the back of your knee.',
      type: 'physical',
      power: { coef: 1.2, stat: 'atk' },
      statuses: [{ status: 'status_armor_break', chance: 0.3, duration: 2 }],
    },
    crawler_turn_over: { name: 'Turn Over', line: 'It rolls onto its back. The sand runs the other way.', statuses: [...REWIND_SELF] },
    crawler_dig_in: { name: 'Dig In', line: 'It digs into its own sand.', shield: { power: { coef: 1.0, stat: 'atk' } } },
  },
  pattern: [
    firstOf(
      [
        [hurtAndUnwound(0.5), { move: 'crawler_turn_over', target: 'self' }],
        [{ everyNth: 4 }, { move: 'crawler_dig_in', target: 'self' }],
      ],
      alternate({ move: 'crawler_sand', target: 'player' }, { move: 'crawler_pincer', target: 'player' }),
    ),
  ],
  loot: [
    { itemId: 'item_chronal_dust', chance: 0.5 },
    { itemId: 'mat_frayed_moment', chance: 0.4 },
  ],
  gold: { min: 25, max: 39 },
  xp: 253,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Hand-long, glass in the middle, sand inside. It slows me with the sand and then pinches. Hurt, it rolls over and the sand runs back up, and so does its health. Void it then and the rewind breaks. In the Depths, with the Heartstone torn out, they crawl from the socket in pairs.',
    tactics: 'Void during Rewind; Storm cracks the glass.',
    codexId: 'codex_creatures_watch_wardens',
    reveals: [...REVEALS],
  },
  sigil: { base: 'spiral', details: ['hourglass'] },
} satisfies CreatureInput;

// ---- cr_orrery_knight — Watch-wardens · L13 elite · XP 589 (DESIGN §6.2; WORLD writes 588) · while the key is untaken -----
const orreryKnight = {
  id: 'cr_orrery_knight',
  name: 'Orrery Knight',
  description: "A brass knight with an orrery for a chest, standing over the observatory's great orrery like a nurse.",
  family: 'fam_watch_wardens',
  materialKin: 'aberration',
  role: 'elite',
  level: 13,
  stats: { hp: 300, atk: 24, sp: 24, armor: 6, ward: 5, agi: 5 },
  tags: ['construct'],
  resistances: { void: 'weak', storm: 'weak', chrono: 'resist', fire: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    orrery_align: {
      name: 'Align',
      line: 'The rings in its chest turn into a line pointing at you.',
      statuses: [{ status: 'status_mark', chance: 1, duration: 3 }],
    },
    orrery_epicycle: { name: 'Epicycle', line: 'A brass ring swings out on its arm and around.', type: 'physical', power: { coef: 1.1, stat: 'atk' } },
    orrery_conjunction: { name: 'Conjunction', line: 'Every ring stops. The line is complete.', type: 'chrono', power: { coef: 1.8, stat: 'sp' } },
    orrery_retrograde: { name: 'Retrograde', line: 'The rings run backward. So does the dent you made.', statuses: [...REWIND_SELF] },
  },
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'orrery_align', target: 'player' }],
        // "ifTargetHas:mark, everyNthTurn:3": both
        [{ all: [{ targetHas: 'status_mark' }, { everyNth: 3 }] }, { move: 'orrery_conjunction', target: 'player' }],
        [hurtAndUnwound(0.5), { move: 'orrery_retrograde', target: 'self' }],
      ],
      { move: 'orrery_epicycle', target: 'all' },
    ),
  ],
  loot: [
    { itemId: 'item_chronal_dust', count: 2 },
    { itemId: 'mat_frayed_moment', chance: 0.8 },
    { itemId: 'mat_iron_rivet', chance: 0.4 },
    { itemId: 'item_pattern_hour_spindle' },
  ],
  gold: { min: 58, max: 90 },
  // DESIGN §6.2: elite = fodder × 1.8 = round(round(20 + 8·13 + 1.2·13²) × 1.8) = round(327 × 1.8) = 589 (the engine's
  // `expectedKillXp`); WORLD's table has 588 (326.8 × 1.8 unrounded). DESIGN owns numbers (D-062).
  xp: 589,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 377. A brass knight with an orrery for a chest, standing over the observatory's great orrery like a nurse. Hadrek the Clockwright's mark is on its heel. It aligns its rings on one target and strikes when the line is complete. It guards the key in the orrery's foot and nothing else.",
    tactics: 'Clear Mark and the Conjunction has no target; Void during Retrograde; Storm on the brass.',
    codexId: 'codex_creatures_watch_wardens',
    reveals: [...REVEALS],
  },
  sigil: { base: 'spiral', details: ['rings'] },
} satisfies CreatureInput;

// ---- cr_hour_leech — Watch-wardens · L12 anomaly, Loop 4+ · XP 376 -----------------------------------------------------------
const hourLeech = {
  id: 'cr_hour_leech',
  name: 'Hour Leech',
  description: 'A grey leech ringed like a clock-face. It does not drink blood. It drinks the hour.',
  family: 'fam_watch_wardens',
  materialKin: 'aberration',
  role: 'anomaly',
  level: 12,
  stats: { hp: 150, atk: 23, sp: 23, armor: 2, ward: 5, agi: 6 },
  tags: ['breach_born', 'anomaly'],
  resistances: { void: 'weak', chrono: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    leech_attach: {
      name: 'Attach',
      line: 'It fastens to the end of your shadow that touches tomorrow.',
      type: 'chrono',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.5, duration: 2 }],
    },
    // WORLD: also "Breach Clock −1 watch (once per fight)": the move's `clockCost` (U34e, D-092)
    leech_drink_hour: {
      name: 'Drink the Hour',
      line: 'It swells. Somewhere, a watch goes missing.',
      type: 'chrono',
      power: { coef: 1.0, stat: 'sp' },
      effects: [{ healOnDamage: { pct: 0.5 } }],
      clockCost: { watches: 1, oncePerFight: true },
    },
    leech_coil: { name: 'Coil', line: 'It coils back into the moment it came from.', statuses: [...REWIND_SELF] },
  },
  pattern: [
    firstOf(
      [
        [{ everyNth: 3 }, { move: 'leech_drink_hour', target: 'player' }],
        [hurtAndUnwound(0.5), { move: 'leech_coil', target: 'self' }],
      ],
      // WORLD marks Attach `first` and gives no unconditioned move: the opener is also what it does otherwise
      { move: 'leech_attach', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_frayed_moment', count: 2 }, // the anomaly's guaranteed material
    { itemId: 'item_chronal_dust', chance: 0.6 },
  ],
  gold: { min: 27, max: 42 },
  xp: 376,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Loop 4. A leech as long as my arm, grey, ringed like a clock-face. It does not drink blood. It drinks the hour. If it lives to its third turn, the Breach Clock is a watch lighter. Kill it in two turns or pay later. Pell Ashcombe counted the days. I wonder if one of these ever counted him.',
    tactics: 'Burst it before its third turn; Void through the Coil.',
    codexId: 'codex_creatures_watch_wardens',
    reveals: [...REVEALS],
  },
  sigil: { base: 'spiral', details: ['clock_face'] },
} satisfies CreatureInput;

// ==== The Unravelled (WORLD §6.8) =====================================================================================

// ---- cr_horde_husk — Unravelled · L12 fodder · XP 289 · any infected node; the Tide's add; the Nexus waves -----------------
// The Horde's fixed groups (the Corridor, the Camp, the Scorched Gate) are their regions'; the Nexus waves of
// q_day_of_teeth (three of one) and q_weavers_dawn (×2, then ×3) are those quests' fights (stage ids are STORY's units').
const hordeHusk = {
  id: 'cr_horde_husk',
  name: 'Horde Husk',
  description: 'What is left of anything, from any family, once the hold slips: flickering, with no next moment.',
  family: 'fam_unravelled',
  role: 'fodder',
  level: 12,
  stats: { hp: 140, atk: 23, sp: 23, armor: 3, ward: 3, agi: 6 },
  tags: ['breach_born', 'horde'],
  resistances: { ley: 'weak', chrono: 'resist', void: 'resist' },
  statusImmunities: ['status_poison'],
  // all hidden: "it has no next moment" (STORY §8.6)
  moves: {
    husk_claw: { name: 'Claw', line: 'Its next moment is not there. Neither is its face.', type: 'physical', power: { coef: 1.1, stat: 'atk' }, hidden: true },
    husk_flicker: { name: 'Flicker', line: 'It is three creatures for a moment, then one.', type: 'chrono', power: { coef: 0.8, stat: 'sp' }, hidden: true },
    husk_come_apart: { name: 'Come Apart', line: 'It comes apart toward you.', type: 'void', power: { coef: 1.4, stat: 'sp' }, hidden: true },
  },
  pattern: [
    firstOf(
      [[{ hpBelow: 0.3 }, { move: 'husk_come_apart', target: 'player' }]],
      alternate({ move: 'husk_claw', target: 'player' }, { move: 'husk_flicker', target: 'all' }),
    ),
  ],
  loot: [{ itemId: 'mat_frayed_moment', chance: 0.5 }],
  gold: { min: 27, max: 42 },
  xp: 289,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Brak calls it the Horde; the Remnants say the unraveling. A husk is what is left of anything, from any family, once the hold slips: a golem's shoulder, a Shade's mouth, a Mireling's light, flickering, with no next moment, so nothing tells me what it will do. Ley gives it an order to fall apart in.",
    tactics: 'Ley; Guard when one drops below a third (Come Apart).',
    codexId: 'codex_creatures_unravelled',
    reveals: [...REVEALS],
  },
  sigil: { base: 'broken_circle', details: ['flicker'] },
} satisfies CreatureInput;

// ---- cr_tyrants_reach — Unravelled · L9 anomaly, Loop 3+ · XP 246 · the Unveiled Tyrant's Phase 2 add -----------------------
// The Spires placement (10 %, once a loop) is the Highlands unit's encounter. The bound mage is the engine's
// `bound_mage` special (combat/specials.ts BOUND_MAGES: WORLD's five variants, rolled at its first cast, no repeats
// among the Reaches of a fight); the move's one telegraph is written here (WORLD gives one line per mage, not one for
// the move). "round:4" is `roundAtLeast`, as U42.
const tyrantsReach = {
  id: 'cr_tyrants_reach',
  name: "Tyrant's Reach",
  description: 'An arm out of the air, bone and crystal: one of the five who stood with the Tyrant, coming loose.',
  family: 'fam_unravelled',
  role: 'anomaly',
  level: 9,
  stats: { hp: 90, atk: 18, sp: 18, armor: 3, ward: 5, agi: 5 },
  tags: ['breach_born', 'anomaly', 'tyrant_add'],
  resistances: { ley: 'weak', chrono: 'resist', void: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    reach_grasp: {
      name: 'Grasp',
      line: 'A skeletal limb surfaces out of the air, reaching.',
      type: 'chrono',
      power: { coef: 1.0, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.4, duration: 2 }],
    },
    reach_dead_spell: { name: 'Dead Spell', line: 'The limb works a spell that is not its own.', special: 'bound_mage' },
    reach_withdraw: { name: 'Withdraw', line: 'The limb sinks back toward the east.', leaveCombat: true },
  },
  pattern: [
    firstOf(
      [
        [{ everyNth: 2 }, { move: 'reach_dead_spell', target: 'player' }],
        [{ all: [{ roundAtLeast: 4 }, { location: 'loc_aetherium_spires' }] }, { move: 'reach_withdraw', target: 'self' }],
      ],
      { move: 'reach_grasp', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_frayed_moment' }, // the anomaly's guaranteed material
    { itemId: 'mat_breach_glass', chance: 0.4 },
    { itemId: 'item_aetherium_shard', chance: 0.5, when: { location: 'loc_aetherium_spires' } },
  ],
  gold: { min: 21, max: 33 },
  xp: 246,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Loop 3, the Spires. An arm came out of the air, bone and crystal, and reached for the Spires' note like a man reaching for a rail in the dark. It struck me once with something not its own: Korr's fire. At the Apex the Tyrant puts out two at a time. Each is one of the five who stood with him. They are not attacking. They are what he is made of, coming loose.",
    tactics: 'At the Apex kill Aulde and Sallow reaches first (they heal and shield the Tyrant); Ley.',
    codexId: 'codex_creatures_unravelled',
    reveals: [...REVEALS],
  },
  sigil: { base: 'broken_circle', details: ['limb'] },
} satisfies CreatureInput;

// ---- the Tyrants' shared moves (DESIGN §4.10 numbers; WORLD §6.8 ids and lines) ---------------------------------------------

const TYRANT_DESCRIPTION =
  'A towering, amorphous figure of rippling time. Skeletal limbs and crystalline shards surface and vanish within its shifting mass.';

/** The moves both forms share, "as Contained, with these stats" (WORLD §6.8). */
const tyrGrasp: MoveInput = {
  name: 'Grasp',
  line: 'A skeletal limb surfaces, reaching.',
  type: 'physical',
  power: { coef: 1.2, stat: 'atk' },
  statuses: [{ status: 'status_slow', chance: 1, duration: 2 }],
};
const tyrShear: MoveInput = { name: 'Shear', line: 'Time thickens around your feet.', type: 'chrono', power: { coef: 1.0, stat: 'sp' } };
const tyrTimeLash: MoveInput = { name: 'Time Lash', line: 'The hour draws tight, then lashes at you.', type: 'chrono', power: { coef: 1.3, stat: 'sp' } };
/** Hidden 2-turn wind-up, then the strike "that scattered Dask". */
const tyrGather: MoveInput = { name: 'Gather', line: 'The hour draws back like an arm. It will fall.', hidden: true, windUp: { turns: 2, then: 'tyr_chrono_strike' } };
/** WORLD gives the wind-up's line only: the strike's telegraph is written here (the fixture's line). */
const tyrChronoStrike: MoveInput = {
  name: 'Chrono-Strike',
  line: 'The hour falls.',
  type: 'chrono',
  power: { coef: 2.0, stat: 'sp' },
  hidden: true,
  // "stun 100% 1 unless you Guarded"
  statuses: [{ status: 'status_stun', chance: 1, duration: 1, when: { playerGuarding: false } }],
};
/** Masque: self Rewind 2 (a boss Rewind restores at most 10 % max HP; Void or Ley removes it — engine). */
const tyrRemember: MoveInput = { name: 'Remember', line: 'An eye opens in the mass and looks back a moment.', statuses: [...REWIND_SELF] };
const tyrUnraveling: MoveInput = {
  name: 'Unraveling',
  line: 'The Tyrant stops guarding itself. Everything here comes loose.',
  type: 'chrono',
  power: { coef: 1.1, stat: 'sp' },
  statuses: [{ status: 'status_armor_break', chance: 1, duration: 2 }],
};

const TYRANT_IMMUNITIES: NonNullable<CreatureInput['statusImmunities']> = ['status_stun', 'status_slow', 'status_poison', 'status_bleed'];

// ---- cr_chronos_tyrant_contained — Unravelled · L14 boss, Loop 1 · XP 900 (DESIGN §4.10 row 1; D-051, D-066.1) ------------
// Tuned for a level-11 party; effective HP ≤ 850 (DESIGN §6.6). Cannot speak (D-004). The Horde starts on its death
// (D-060: the engine sets `flag_tyrant_dead` and runs the legacy defeat sequence). Loot: none (legacy); the Frayed
// Moments lie at the Apex afterwards (locations.ts).
const ONCE_IN_THIS_PHASE: Step = { move: 'tyr_remember', target: 'self', when: { oncePerFight: true } };

const containedTyrant = {
  id: 'cr_chronos_tyrant_contained',
  name: 'The Chronos Tyrant',
  legacyName: 'The Chronos Tyrant',
  description: TYRANT_DESCRIPTION,
  family: 'fam_unravelled',
  materialKin: 'chronos_tyrant',
  role: 'boss',
  level: 14,
  stats: { hp: 460, atk: 24, sp: 26, armor: 6, ward: 8, agi: 4 },
  tags: ['breach_born', 'legacy', 'tyrant'],
  resistances: { ley: 'weak', chrono: 'resist', void: 'resist' },
  statusImmunities: [...TYRANT_IMMUNITIES],
  tauntImmune: true, // "Taunt ignored"
  interruptible: true, // "Stagger allowed"
  fleeable: false,
  moves: {
    tyr_brace: { name: 'Brace', line: 'The Tyrant braces the hour against you.', shield: { power: { coef: 0.6, stat: 'sp' } } },
    tyr_grasp: tyrGrasp,
    tyr_shear: tyrShear,
    tyr_time_lash: tyrTimeLash,
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
    tyr_gather: tyrGather,
    tyr_chrono_strike: tyrChronoStrike,
    tyr_aulde_sings: { name: 'Aulde Sings', line: 'One clear note rises. Light settles over the mass.', shield: { power: { coef: 1.0, stat: 'sp' } } },
    // no regen in this form (D-066.1)
    tyr_sallow_breathes: {
      name: 'Sallow Breathes',
      line: 'Green breath leaks from the mass toward you.',
      type: 'ley',
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_poison', chance: 0.7, duration: 4 }],
    },
    tyr_remember: tyrRemember,
    tyr_unraveling: tyrUnraveling,
  },
  phases: [
    {
      id: 'tyr_movement_1',
      name: 'The Holding',
      // "tyr_brace every second turn (alternates with the moves below)": its even turns; the three strikes cycle on the
      // odd ones (STORY §8.4: it braces rather than attacks on alternate turns)
      pattern: [
        { move: 'tyr_grasp', target: 'player' },
        { move: 'tyr_brace', target: 'self' },
        { move: 'tyr_shear', target: 'all' },
        { move: 'tyr_brace', target: 'self' },
        { move: 'tyr_time_lash', target: 'player' },
        { move: 'tyr_brace', target: 'self' },
      ],
    },
    {
      id: 'tyr_movement_2',
      name: 'The Fracture',
      enterWhen: [{ hpBelow: 0.66 }],
      line: 'The mass splits along old seams. Things that were people surface and do not sink back.',
      // 2× Temporal Aberration at 40 % HP (112), 1 if the player has no active companion (D-066.1)
      adds: [{ creatureId: 'cr_temporal_aberration', count: 2, countSolo: 1, hpPct: 0.4 }],
      // the five strike once per rotation (STORY §8.4); Remember once in this phase (a step-scoped `oncePerFight`)
      pattern: [
        { move: 'tyr_korr_burns', target: 'player' },
        { move: 'tyr_vane_closes', target: 'player' },
        { move: 'tyr_gather', target: 'player' },
        { move: 'tyr_aulde_sings', target: 'self' },
        { move: 'tyr_sallow_breathes', target: 'player' },
        ONCE_IN_THIS_PHASE,
      ],
    },
    {
      id: 'tyr_movement_3',
      name: 'The Nine Speak',
      enterWhen: [{ hpBelow: 0.33 }, { round: 12 }],
      line: 'It stops guarding itself. Every wound you give it is answered by a voice.',
      // ×1.5 taken (STORY §8.4; provisional until the §19 #19 sims, D-068.3); no more Brace; Unraveling every turn
      damageTakenMult: 1.5,
      pattern: [ONCE_IN_THIS_PHASE, { move: 'tyr_unraveling', target: 'all' }],
    },
  ],
  loot: [],
  gold: { min: 0, max: 0 },
  xp: 900,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      'Year 44. The Remnants named it the Chronos Tyrant after the first Wayfinder, Sael Orrin, died before it: a towering mass of rippling time at the Apex, limbs and crystal surfacing and sinking. It has never left the Apex. Scholars reasoned that whatever stands at the heart of the Breach must be its cause. A later hand adds: it braces before it strikes, like something that would rather not.',
    tactics:
      "Ley throughout. Guard every Chrono-Strike wind-up. Void or Ley after Remember (consumes the Rewind; the Amulet's bolt does it for every class). The Aberrations can be ignored if your damage is high; their Slow cannot. Loop 1 offers Face it / Not yet on arrival and writes no autosave at the Apex, so an under-levelled player can walk back to the Nexus.",
    codexId: 'codex_creatures_unravelled',
    reveals: [...REVEALS],
  },
  sigil: { base: 'broken_circle', accent: 'chrono', details: ['segmented_ring', 'contained'] },
} satisfies CreatureInput;

// ---- cr_chronos_tyrant_unveiled — Unravelled · L18 boss, Loop 2+ · XP 1,600 (DESIGN §4.10 row 2, §4.11; D-051, D-054) ----
// Veyran Thal, holding. It never attacks first (D-067.12): Phase 1 speaks until it is hurt (DESIGN's `tyr_speak`
// `first`, held while no blow has landed, WORLD §6.8 "The fight begins only when the player attacks"). Communion
// (DESIGN §4.11, STORY §8.3, WORLD §6.8's table) is the `communion` spec below; the engine keeps Resolve, the press,
// Listen, Offer, the tired bonus, the Korr cost, rejection and the clock bonus (communion.ts). WORLD's "its next intent
// becomes a full-strength tyr_time_lash" after Listen is superseded (D-069.8, D-081): not transcribed.
const unveiledTyrant = {
  id: 'cr_chronos_tyrant_unveiled',
  name: 'The Chronos Tyrant',
  // the same mass as the legacy Tyrant: its legacy description (WORLD's Unveiled block gives none of its own)
  description: TYRANT_DESCRIPTION,
  family: 'fam_unravelled',
  materialKin: 'chronos_tyrant',
  role: 'boss',
  level: 18,
  stats: { hp: 900, atk: 32, sp: 36, armor: 8, ward: 10, agi: 4 },
  tags: ['breach_born', 'tyrant'],
  resistances: { ley: 'weak', chrono: 'resist', void: 'resist' },
  statusImmunities: [...TYRANT_IMMUNITIES],
  tauntImmune: true,
  interruptible: true,
  fleeable: false,
  // Phase 4: "at 10% HP, once" (WORLD §6.8; U34e, D-098)
  hpLines: [{ below: 0.1, text: "'If you finish this, run,' says the voice under the chorus. 'I mean that kindly.'" }],
  moves: {
    tyr_speak: { name: 'Speak', line: "It speaks: 'You have crossed. So.'" },
    tyr_time_lash: tyrTimeLash,
    tyr_grasp: tyrGrasp,
    tyr_shear: tyrShear,
    tyr_remember: tyrRemember,
    tyr_gather: tyrGather,
    tyr_chrono_strike: tyrChronoStrike,
    tyr_unraveling: tyrUnraveling,
    tyr_hour_presses: { name: 'The Hour Presses', line: 'The hour leans on you while it waits.', type: 'chrono', special: 'hour_presses' },
  },
  phases: [
    {
      id: 'tyr_movement_1',
      name: 'Lament',
      // speaks while unhurt (the opening intent included), then Time Lash, Grasp, Shear in turn; STORY §8.2's later-loop
      // lines are longer than a telegraph and belong to `scene_tyrant_first_words` (the dialogue unit's)
      pattern: [
        {
          if: { not: { hpBelow: 1 } },
          then: [{ move: 'tyr_speak', target: 'self' }],
          else: [
            { move: 'tyr_time_lash', target: 'player' },
            { move: 'tyr_grasp', target: 'player' },
            { move: 'tyr_shear', target: 'all' },
          ],
        },
      ],
    },
    {
      id: 'tyr_movement_2',
      name: 'The Nine Surface',
      enterWhen: [{ hpBelow: 0.75 }],
      line: "'Then you came to finish it.' The mass opens. Two of the five reach out.",
      // 2× Tyrant's Reach (90 HP each), bound mages rolled without repeat; one more each time one dies, max 2 alive and
      // 5 in total (WORLD §6.8; `reinforce`, combat/phases.ts)
      adds: [{ creatureId: 'cr_tyrants_reach', count: 2, hpPct: 1, reinforce: { maxAlive: 2, total: 5 } }],
      // Remember everyNth 3, otherwise the Phase 1 moves
      pattern: everyNthAmong({ move: 'tyr_remember', target: 'self' }, 3, [
        { move: 'tyr_time_lash', target: 'player' },
        { move: 'tyr_grasp', target: 'player' },
        { move: 'tyr_shear', target: 'all' },
      ]),
    },
    {
      id: 'tyr_movement_3',
      name: 'Chrono-Strike',
      enterWhen: [{ hpBelow: 0.5 }],
      line: "'I hold,' it says. 'If I do not hold, you have seen what comes.'",
      // Gather → Chrono-Strike everyNth 3, otherwise the Phase 1 moves. The wind-up holds it two turns and the strike
      // lands on the third, so a Gather begins on the first third turn after the cycle resumes (every 6 turns).
      pattern: everyNthAmong({ move: 'tyr_gather', target: 'player' }, 3, [
        { move: 'tyr_time_lash', target: 'player' },
        { move: 'tyr_grasp', target: 'player' },
        { move: 'tyr_shear', target: 'all' },
      ]),
    },
    {
      id: 'tyr_phase_4',
      name: 'The Hold Fails',
      enterWhen: [{ hpBelow: 0.25 }, { round: 20 }],
      line: 'The hold fails. The chorus stops pretending to be one voice.',
      // outgoing damage +10 % per round in this phase, uncapped (DESIGN). The voice under the chorus "at 10 % HP, once" is
      // the creature's `hpLines` (U34e, D-098)
      damageDealtRampPerRound: 0.1,
      pattern: [{ move: 'tyr_unraveling', target: 'all' }],
    },
  ],
  communion: {
    // Commune is open from the first turn with this Echo; Listen opens it otherwise (and grants it, engine)
    opensWith: [{ echo: 'echo_tyrant_speaks' }],
    pressMove: 'tyr_hour_presses',
    movements: [
      {
        id: 'tyr_movement_1',
        // I — The Holding (why have you come). Answers: WORLD §6.8's table; the texts are the Wayfinder's words.
        questions: [
          {
            id: 'tyr_q_why',
            line: 'It asks why you have come.',
            answers: [
              { id: 'tyrant_jailer', when: { echo: 'echo_tyrant_jailer' }, resolve: 1, text: 'You are holding the door shut. You are the jailer, and the cell.' },
              { id: 'to_kill_you', when: { all: [] }, resolve: 1, text: 'To kill you.' }, // the honest answer (STORY §8.3)
              { id: 'lie_lost', when: { all: [] }, resolve: -2, lie: true, text: 'I was lost.' },
              { id: 'tyrant_never_struck', when: { echo: 'echo_tyrant_never_struck' }, resolve: 1, text: 'You have never struck first. Not once.' },
            ],
          },
          {
            id: 'tyr_q_hour',
            line: 'It asks what day this is, for you.',
            answers: [{ id: 'thirtieth_dawn', when: { echo: 'echo_thirtieth_dawn' }, resolve: 1, text: 'The thirtieth dawn. I have seen what comes.' }],
          },
          {
            id: 'tyr_q_before',
            line: 'It asks who came before you.',
            answers: [{ id: 'seven_wayfinders', when: { echo: 'echo_seven_wayfinders' }, resolve: 1, text: 'Seven. Sael Orrin was the first.' }],
          },
        ],
        // Listen: "What it told me; what it couldn't" (STORY §14 codex_tyrant_holding)
        listen: { effects: [{ unlockCodex: 'codex_tyrant_holding' }] },
      },
      {
        id: 'tyr_movement_2',
        // II — The Fracture: each of the five asks through the mass; the matching verse (STORY §2.3's text) or a trace
        // Echo answers; Hallow's silence is a sixth question with no asker
        questions: [
          {
            id: 'tyr_q_korr',
            line: "'What is read is owed. What have you read?'",
            answers: [
              { id: 'litany_verse_2', when: { echo: 'echo_litany_verse_2' }, resolve: 1, text: 'What is read is owed. We have read, and we have paid, and we are not done paying.' },
              { id: 'korr_marginalia', when: { echo: 'echo_korr_marginalia' }, resolve: 1, text: 'Your margins. I read them, and I owe.' },
              // Corruption ≥ 3 also satisfies him; the engine takes −1 at the next asker (STORY §8.3)
              { id: 'corruption', when: { corruption: { min: 3 } }, resolve: 1, text: 'Enough to owe. I am still paying.' },
            ],
          },
          {
            id: 'tyr_q_vane',
            line: "'Who guards the gate now?'",
            answers: [
              { id: 'litany_verse_3', when: { echo: 'echo_litany_verse_3' }, resolve: 1, text: 'Stone, stand where flesh would fall. Keep the line and hold the gate.' },
              { id: 'stone_hide_origin', when: { echo: 'echo_stone_hide_origin' }, resolve: 1, text: 'Your stone still keeps the Outpost. Nobody relieved it.' },
            ],
          },
          {
            id: 'tyr_q_aulde',
            line: "'What note does the sky hold?'",
            answers: [
              { id: 'litany_verse_5', when: { echo: 'echo_litany_verse_5' }, resolve: 1, text: 'Rise, lines, and be lifted. Sing the one note the world was tuned to.' },
              { id: 'spire_note', when: { echo: 'echo_spire_note' }, resolve: 1, text: 'The note the Spires still hold. East.' },
            ],
          },
          {
            id: 'tyr_q_sallow',
            line: "'What lives, that carries what does not?'",
            answers: [
              { id: 'litany_verse_6', when: { echo: 'echo_litany_verse_6' }, resolve: 1, text: 'Green, take what the stone cannot. Let what lives carry what does not.' },
              { id: 'breathing_pool', when: { echo: 'echo_breathing_pool' }, resolve: 1, text: 'The Breathing Pool. It breathes for the Glowfen now.' },
              // "Mireya present: automatic" (STORY §8.3; D-081: an answer gated on her)
              { id: 'mireya_present', when: { companion: { id: 'mireya', state: 'active' } }, resolve: 1, text: 'She does. Look at her hands.' },
            ],
          },
          {
            id: 'tyr_q_masque',
            line: "'Tell me what you saw from the far side.'",
            answers: [
              { id: 'litany_verse_7', when: { echo: 'echo_litany_verse_7' }, resolve: 1, text: 'See the hour from its far side. Tell us true, and we will not turn away.' },
              { id: 'eye_of_masque', when: { echo: 'echo_eye_of_masque' }, resolve: 1, text: 'Your eye is still open on the orrery.' },
              // the perfect answer (+2); STORY §10.1: "It failed."
              { id: 'ritual_inevitable', when: { echo: 'echo_ritual_inevitable' }, resolve: 2, text: 'It failed.' },
            ],
          },
          {
            id: 'tyr_q_hallow',
            line: 'The chorus leaves a gap where a sixth voice should be.',
            answers: [
              { id: 'hallow_said_stop', when: { echo: 'echo_hallow_said_stop' }, resolve: 2, text: 'Durn Hallow said stop.' },
              // STORY §12: verse IV "Answers Hallow's silence" (WORLD's table names only the +2 Echo)
              { id: 'litany_verse_4', when: { echo: 'echo_litany_verse_4' }, resolve: 1, text: 'Iron that does not wish, hold the heart. Take the weight and do not want it.' },
            ],
          },
        ],
        // Listen: "Who the limbs and shards are" (STORY §14 codex_tyrant_six)
        listen: { effects: [{ unlockCodex: 'codex_tyrant_six' }] },
      },
      {
        id: 'tyr_movement_3',
        // III — The Nine Speak: the chorus quiets and Veyran asks alone; with Resolve ≥ 3 the answer ends the Movement
        // and the Tyrant is spared (engine), else the question can only be forfeited and the end is a rejection
        questions: [
          {
            id: 'tyr_q_choice',
            line: 'The chorus stops. One voice asks what you will do.',
            answers: [{ id: 'choose', when: { resolve: { min: 3 } }, resolve: 0, text: 'I know what I will do.' }],
          },
        ],
        // Listen: Veyran alone (STORY §14 codex_veyran_thal)
        listen: { effects: [{ unlockCodex: 'codex_veyran_thal' }] },
      },
    ],
    // shown, never consumed (D-067.3)
    offers: [
      { itemId: 'item_chronos_lens', resolve: 1, effects: [] },
      { itemId: 'item_stabilized_heartstone', resolve: 1, effects: [] },
      { itemId: 'item_breach_anchor', resolve: 2, effects: [{ setFlag: 'flag_anchor_offered' }] },
      { itemId: 'item_heartstone_core', resolve: -2, effects: [] }, // it recoils
    ],
    // The Resolution (DESIGN §4.11, STORY §8.3 / §10): spared (`flag_tyrant_spared`, engine), then one outcome. The
    // endings' own last choices (`scene_ending_vigil`, `_mending`, `_unbound`) are the dialogue units'.
    outcomes: [
      // Resolve ≥ 3: let you pass — the tear opens onto Silverwood Before (D-016; locations.ts, `gate_tyrant_tear`) …
      { minResolve: 3, choiceId: 'pass_into_before', effects: [] },
      // … or onto the far side: refusing every other offer (STORY §10.6) is ending F
      { minResolve: 3, choiceId: 'pass_beyond', effects: [{ setFlag: 'flag_refused_all_paths' }, { ending: 'ending_unbound' }] },
      // ≥ 6 with the whole Litany: take its place (A)
      { minResolve: 6, when: { echo: 'echo_litany_complete' }, choiceId: 'take_its_place', effects: [{ ending: 'ending_wardens_vigil' }] },
      // 8 with STORY §10.2's requirements (DESIGN §4.11's three plus STORY's): consent to the Mending (B)
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
        choiceId: 'consent_mending',
        effects: [{ grantEcho: 'echo_tyrant_consent' }, { ending: 'ending_mending' }],
      },
    ],
  },
  // DESIGN §8.2: a Tyrant Shard per phase cleared (max 4); a kill takes it through all four phases (a fight resumed at
  // Phase 2 after a rejection clears three, which a loot row cannot tell). A kill triggers the Horde (D-060).
  loot: [
    { itemId: 'mat_tyrant_shard', count: 4 },
    { itemId: 'mat_frayed_moment', count: 3 },
  ],
  gold: { min: 0, max: 0 },
  xp: 1600,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Loop 2. It spoke. "You have crossed. So." A chorus, with one voice under it like a bass line. Veyran Thal stepped into the tear to hold it, and he is still holding it: five of the Nine surface through him, the hour does not move, and he cannot ask for help. Kill it and the unraveling comes. Talk to it and it listens, verse by verse. It falls silent where I am missing words.',
    tactics:
      "Fight: Ley, kill Aulde and Sallow reaches first, Guard every Chrono-Strike, finish before Phase 4's ramp. Commune: bring the verses and the trace Echoes, Dask or Caelum in Support.",
    codexId: 'codex_creatures_unravelled',
    reveals: [...REVEALS],
  },
  sigil: { base: 'broken_circle', accent: 'chrono', details: ['segmented_ring', 'unveiled'] },
} satisfies CreatureInput;

/** WORLD §6 order within the region: the Green, Watch-wardens, the Unravelled. */
export const creatures = [
  glowfenMireling,
  lanternToad,
  sporeDrift,
  temporalAberration,
  hourglassCrawler,
  orreryKnight,
  hourLeech,
  hordeHusk,
  tyrantsReach,
  containedTyrant,
  unveiledTyrant,
] satisfies CreatureInput[];
