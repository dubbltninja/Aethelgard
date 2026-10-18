// The Skyreach — the creatures whose first region (WORLD §6's Regions column) is the Skyreach (D-090): the Spire Loom (elite),
// the Gale Kite, the Cloud Ray and the regional boss, the Stormcrown (Spireborn, WORLD §6.5; XP WORLD §6 table / DESIGN §6.2;
// families WORLD §5; rules DESIGN §4.2–4.6, §4.10). The Aetherial Weaver, the Glass Mote and the Sky-Whisper Sentinel stand here
// too, but their first region is the Highlands (U44 authors them; they are placed here by reference).
//
// Conventions are U42's, U44's and U45's (silverwood_ruins/creatures.ts, aether_kissed_highlands/creatures.ts and
// glowlands_nexus/creatures.ts headers): stats `HP · ATK · DEF armor/ward · AGI`, SP = ATK (WORLD gives no SP here) and
// non-physical moves scale on SP; a move's type is the creature's primary type unless the line names one; `all` = area,
// `you` = player; `construct` carries Poison and Bleed immunity written out (WORLD §4–6 conventions; D-094), whatever the
// Resist line names; loot rows in WORLD's order; bestiary and tactics WORLD's text verbatim (backticks and document
// references dropped); `description` a sentence from the bestiary or the location (no legacy line exists: a new region).
//
// Patterns: WORLD's rule (unconditioned moves cycle top to bottom; a conditioned move replaces the next cycled move when its
// condition holds, first match top to bottom) as one first-match `if` chain evaluated on every turn (`firstOf`), two cycled
// moves alternating by the creature's own turn (`alternate`) — U45's form, which keeps every `everyNthTurn` cadence (D-092);
// three cycled moves and no condition (the Cloud Ray) is the plain cycle. tests/unit/content/regions/skyreach.test.ts walks
// every pattern turn by turn. Readings (each repeated at its move; listed in the U48a reply):
//   - the Spire Loom's Rethread ("ifHpBelow:50", no "once") waits while its own Shield stands (`not selfHas status_shield`),
//     U44's reading of the Weaver's Mend;
//   - the Stormcrown's "ifAllyDown" Call Kite is `allyDown` (U34e, D-094) while no kite stands ("max 1 alive": the summon's
//     `max` is 1, and a call it cannot answer would waste the turn);
//   - the Stormcrown's Call Lightning comes "the turn after crown_rain": the Rain's `everyNth: 3` opens a `then` block of two
//     steps, the Rain and then the Lightning, which DESIGN §4.2 runs to completion before the pointer continues, so the
//     Lightning is the very next intent after every Rain and never comes without one;
//   - the Stormcrown's Phase 3 "Haste self every turn": a phase has no per-turn status hook (its `onEnter` has no status
//     atom), so both Phase 3 moves put Haste (2) on the Stormcrown as they land. The Talon is shared with Phase 1, so its row
//     carries `when: hpBelow 0.3`, the Phase 3 threshold (the Stormcrown never heals, so the row holds exactly in Phase 3);
//     the intent chip of a Phase 1 Talon still lists "hastens itself" (tags do not read a row's `when`), as the Cinderback's
//     Guard-gated Burn still reads "may Burn".
// Skyborn Haste in the gale and the storm's lightning on Soaked are the places' `hazards` (U34e, D-097, locations.ts);
// the Cloud Ray's "×1.5 if you are Soaked" is the engine's Storm-on-Soaked interplay (DESIGN §4.6 row 1), not a field.
import type { CombatWhen, CreatureInput, StatusApply, Step } from '@schema/creature';

const REVEALS = [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] as const;

/** WORLD's first-match rule as one step: `[condition, step]` pairs top to bottom, then `otherwise` (the cycled move). */
function firstOf(conditioned: readonly (readonly [CombatWhen, Step])[], otherwise: Step): Step {
  return conditioned.reduceRight<Step>((rest, [when, step]) => ({ if: when, then: [step], else: [rest] }), otherwise);
}

/** Two cycled moves: the first on the creature's odd turns, the second on its even turns. */
const alternate = (odd: Step, even: Step): Step => ({ if: { everyNth: 2 }, then: [even], else: [odd] });

/** A self-move at low HP that waits while its own effect still stands (see the header). */
const hurtAndWithout = (below: number, status: `status_${string}`): CombatWhen => ({ all: [{ hpBelow: below }, { not: { selfHas: status } }] });

const CONSTRUCT_IMMUNITIES = ['status_poison', 'status_bleed'] as const;

// ---- cr_spire_loom — Spireborn (Aetherial) · L14 elite · XP 661 (WORLD §6.5) ---------------------------------------------------
const spireLoom = {
  id: 'cr_spire_loom',
  name: 'Spire Loom',
  description: "One of Aulde's looms, still running: brass frames, glass shuttles, no weaver.",
  family: 'fam_spireborn',
  materialKin: 'aetherial',
  role: 'elite',
  level: 14,
  stats: { hp: 320, atk: 26, sp: 26, armor: 6, ward: 6, agi: 2 },
  tags: ['construct'],
  resistances: { void: 'weak', ley: 'resist', storm: 'resist' },
  statusImmunities: [...CONSTRUCT_IMMUNITIES, 'status_stun'],
  moves: {
    // "summons 1 cr_aetherial_weaver (max 2)"
    loom_weave: {
      name: 'Weave',
      line: 'The shuttles fly. A cord of light lengthens toward the window.',
      summon: { creatureId: 'cr_aetherial_weaver', count: 1, max: 2 },
    },
    loom_shuttle: {
      name: 'Shuttle',
      line: 'A shuttle leaves the frame at the height of your head.',
      type: 'physical',
      power: { coef: 1.3, stat: 'atk' },
      statuses: [{ status: 'status_stun', chance: 0.2, duration: 1 }],
    },
    loom_warp: {
      name: 'Warp',
      line: 'The warp threads tighten across the room.',
      type: 'ley',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.5, duration: 2 }],
    },
    loom_rethread: { name: 'Rethread', line: 'It rethreads itself. The broken threads take up again.', shield: { power: { coef: 1.5, stat: 'atk' } } },
  },
  // WORLD's order, top to bottom: `everyNthTurn:3` → the Weave; `ifHpBelow:50` → the Rethread (while no Shield stands); else
  // the Shuttle and the Warp alternate
  pattern: [
    firstOf(
      [
        [{ everyNth: 3 }, { move: 'loom_weave', target: 'self' }],
        [hurtAndWithout(0.5, 'status_shield'), { move: 'loom_rethread', target: 'self' }],
      ],
      alternate({ move: 'loom_shuttle', target: 'player' }, { move: 'loom_warp', target: 'all' }),
    ),
  ],
  loot: [
    { itemId: 'mat_spire_thread', count: 3 },
    { itemId: 'item_aetherium_shard', count: 2 },
    { itemId: 'mat_skyreach_crystal', chance: 0.4 },
  ],
  gold: { min: 62, max: 96 },
  xp: 661,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Aulde's looms still run. Brass frames, glass shuttles, no weaver. They make Aetherial Weavers the way a spider makes thread, one every few breaths if I let them. Kill the loom, not the cord. With the Heartstone dark they stop, and her notes are just lying there.",
    // WORLD's "(WORLD §3.10)" is a document reference, dropped like the decision references
    tactics: 'Ignore the Weavers it makes; Void the loom. Heartstone destroyed: no fight.',
    codexId: 'codex_creatures_spireborn',
    reveals: [...REVEALS],
  },
  sigil: { base: 'rhombus', details: ['shuttles', 'double_outline'] },
} satisfies CreatureInput;

// ---- cr_gale_kite — Spireborn (Sentinel) · L12 fodder · XP 289; skyborn (WORLD §6.5) -----------------------------------------
const galeKite = {
  id: 'cr_gale_kite',
  name: 'Gale Kite',
  description: "A spotter Aulde built for the Sentinels: diamond-shaped, wide as a man's arms, with a tail of wind.",
  family: 'fam_spireborn',
  materialKin: 'sentinel',
  role: 'fodder',
  level: 12,
  stats: { hp: 128, atk: 23, sp: 23, armor: 2, ward: 3, agi: 13 },
  tags: ['construct', 'skyborn'],
  resistances: { physical: 'weak', chrono: 'weak', storm: 'resist' },
  statusImmunities: [...CONSTRUCT_IMMUNITIES],
  moves: {
    kite_tether: {
      name: 'Tether',
      line: 'It hooks a line of wind to you and pulls.',
      type: 'storm',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_mark', chance: 1, duration: 2 }],
    },
    kite_slice: {
      name: 'Slice',
      line: 'It turns edge-on and comes at you like a thrown blade.',
      type: 'physical',
      power: { coef: 1.1, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.4, duration: 3 }],
    },
    // 1.2× (WORLD struck the old 1.4×, REVIEW-STORY-WORLD #19)
    kite_swoop: { name: 'Swoop', line: 'It drops out of the sun down its line.', type: 'physical', power: { coef: 1.2, stat: 'atk' } },
    kite_updraft: {
      name: 'Updraft',
      line: 'It catches a gust, and the gust catches you.',
      type: 'storm',
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.5, duration: 2 }],
    },
  },
  // WORLD's order, top to bottom: `first` → the Tether; `ifTargetHas:mark` → the Swoop; `everyNthTurn:3` → the Updraft; else
  // the Slice
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'kite_tether', target: 'player' }],
        [{ targetHas: 'status_mark' }, { move: 'kite_swoop', target: 'player' }],
        [{ everyNth: 3 }, { move: 'kite_updraft', target: 'player' }],
      ],
      { move: 'kite_slice', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_gale_feather', chance: 0.7 },
    { itemId: 'mat_storm_glass', chance: 0.2 }, // † = a material WORLD introduced and DESIGN §8.2 adopted (C-42)
  ],
  gold: { min: 27, max: 42 },
  xp: 289,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Diamond-shaped, wide as my arms, with a tail of wind. Aulde built them as spotters for the Sentinels. They tether me with a line of air and swoop down it. Clear the Mark and they swoop at nothing. On the Stair, running costs a tenth of my blood. I don't run.",
    tactics: 'Clear Mark; plain steel through the paper-thin frame.',
    codexId: 'codex_creatures_spireborn',
    reveals: [...REVEALS],
  },
  sigil: { base: 'rhombus', details: ['wind_tail'] },
} satisfies CreatureInput;

// ---- cr_cloud_ray — Spireborn (Sentinel) · L13 fodder · XP 327; skyborn (WORLD §6.5) -----------------------------------------
const cloudRay = {
  id: 'cr_cloud_ray',
  name: 'Cloud Ray',
  description: "A flat glider the width of a wagon, drifting along the Roost's ledges with its own cloud.",
  family: 'fam_spireborn',
  materialKin: 'sentinel',
  role: 'fodder',
  level: 13,
  stats: { hp: 160, atk: 24, sp: 24, armor: 3, ward: 4, agi: 7 },
  tags: ['construct', 'skyborn'],
  resistances: { void: 'weak', storm: 'resist' },
  statusImmunities: [...CONSTRUCT_IMMUNITIES],
  moves: {
    // "soaked 100% 3 all": non-damaging, on everyone it glides over
    ray_mist_over: { name: 'Mist Over', line: 'It glides over you, trailing cloud.', statuses: [{ status: 'status_soaked', chance: 1, duration: 3 }] },
    // "(×1.5 if you are Soaked)": the engine's Storm-on-Soaked interplay (DESIGN §4.6 row 1), see the header
    ray_discharge: {
      name: 'Discharge',
      line: 'Its underside flickers white.',
      type: 'storm',
      power: { coef: 1.1, stat: 'sp' },
      statuses: [{ status: 'status_shock', chance: 0.4, duration: 2 }],
    },
    ray_wingbeat: {
      name: 'Wingbeat',
      line: 'One slow wingbeat, wide as the ledge.',
      type: 'physical',
      power: { coef: 0.8, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.3, duration: 2 }],
    },
  },
  // "Its pattern is fixed: Mist, Discharge, Wingbeat" (no conditioned move: the plain cycle)
  pattern: [
    { move: 'ray_mist_over', target: 'all' },
    { move: 'ray_discharge', target: 'player' },
    { move: 'ray_wingbeat', target: 'all' },
  ],
  loot: [
    { itemId: 'mat_skyreach_crystal', chance: 0.3 },
    { itemId: 'mat_storm_glass', chance: 0.4 },
  ],
  gold: { min: 29, max: 45 },
  xp: 327,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 497, from a Nomad sky-burial report. Flat gliders the width of a wagon, drifting along the Roost's ledges. They carry their own cloud, lay it on you, then light it. The Nomads watch the underside: when it goes white, they crouch behind their shields.",
    tactics: 'Its pattern is fixed: Mist, Discharge, Wingbeat. Guard every Discharge.',
    codexId: 'codex_creatures_spireborn',
    reveals: [...REVEALS],
  },
  sigil: { base: 'rhombus', details: ['cloud_trail'] },
} satisfies CreatureInput;

// ---- cr_stormcrown — Spireborn (Sentinel) · L17 boss · XP 1,050 (WORLD §6.5; HP D-067.20: 12 × (49.2 − 6 armor) = 518, 520) --
// The Skyreach's regional boss (band 12–15 top + 2). Cannot be fled. The bypass is the Perch's (locations.ts): with
// `echo_sky_oath` and the Talisman, from Loop 2, the Stormcrown yields the Talon and the encounter is skipped. Phase 1 opens
// with a Gale Kite ("onEnter: 1× cr_gale_kite"; WORLD gives no line for it).

/** "Haste self every turn" (Phase 3): see the header. The Talon's row holds only below the Phase 3 threshold. */
const PHASE_3_HASTE: StatusApply = { status: 'status_haste', chance: 1, stacks: 1, duration: 2, target: 'self' };

const stormcrown = {
  id: 'cr_stormcrown',
  name: 'The Stormcrown',
  description: 'The first Sentinel, made before the others, with a crown of storm-glass and five hundred years of watching the Apex.',
  family: 'fam_spireborn',
  materialKin: 'sentinel',
  role: 'boss',
  level: 17,
  stats: { hp: 520, atk: 31, sp: 31, armor: 6, ward: 8, agi: 11 },
  tags: ['regional_boss', 'construct', 'skyborn'],
  resistances: { chrono: 'weak', storm: 'resist', ley: 'resist' },
  // "status immune: shock, blind, poison" (+ Bleed: the construct rule, see the header)
  statusImmunities: ['status_shock', 'status_blind', ...CONSTRUCT_IMMUNITIES],
  interruptible: true, // "Stagger allowed"
  fleeable: false,
  moves: {
    crown_regard: { name: 'Regard', line: 'It turns from the east and looks at you, once.', statuses: [{ status: 'status_mark', chance: 1, duration: 3 }] },
    crown_gale: { name: 'Gale', line: 'The ring of lightning tightens around the pinnacle.', type: 'storm', power: { coef: 0.9, stat: 'sp' } },
    crown_talon: {
      name: 'Talon',
      line: 'A talon of storm-glass opens over you.',
      type: 'physical',
      power: { coef: 1.3, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.5, duration: 3 }, { ...PHASE_3_HASTE, when: { hpBelow: 0.3 } }],
    },
    crown_rain: { name: 'Rain', line: 'Cloud pours off its crown and over you.', statuses: [{ status: 'status_soaked', chance: 1, duration: 3 }] },
    // "hidden · 2.0× you · shock 100% 2 · the turn after crown_rain"
    crown_call_lightning: {
      name: 'Call Lightning',
      line: 'The crown goes white. Everything on the Perch holds still.',
      type: 'storm',
      power: { coef: 2.0, stat: 'sp' },
      hidden: true,
      statuses: [{ status: 'status_shock', chance: 1, duration: 2 }],
    },
    // "summons 1 cr_gale_kite · ifAllyDown (max 1 alive)"
    crown_call_kite: {
      name: 'Call Kite',
      line: 'It cries once. A kite peels off the ledges.',
      summon: { creatureId: 'cr_gale_kite', count: 1, max: 1 },
    },
    // "7 hits × 0.3× you · everyNthTurn:2"
    crown_seven: {
      name: 'Seven',
      line: 'It names seven Wayfinders, one strike for each.',
      type: 'storm',
      power: { coef: 0.3, stat: 'sp', hits: 7 },
      statuses: [PHASE_3_HASTE],
    },
  },
  phases: [
    {
      id: 'crown_the_watch',
      name: 'The Watch',
      // 100–70 %; onEnter: 1× cr_gale_kite
      adds: [{ creatureId: 'cr_gale_kite', count: 1 }],
      // `first` → the Regard; then the Gale and the Talon in turn
      pattern: [firstOf([[{ first: true }, { move: 'crown_regard', target: 'player' }]], alternate({ move: 'crown_gale', target: 'all' }, { move: 'crown_talon', target: 'player' }))],
    },
    {
      id: 'crown_the_storm_comes_down',
      name: 'The Storm Comes Down',
      enterWhen: [{ hpBelow: 0.7 }],
      line: "'Seven came,' it says. 'Seven struck.' The sky over the Perch goes black.",
      // `everyNthTurn:3` → the Rain, and the turn after it the hidden Lightning (one `then` block, see the header); otherwise
      // "ifAllyDown" → Call Kite (no kite standing), else the Gale
      pattern: [
        {
          if: { everyNth: 3 },
          then: [
            { move: 'crown_rain', target: 'all' },
            { move: 'crown_call_lightning', target: 'player' },
          ],
          else: [firstOf([[{ all: [{ allyDown: true }, { allyCountBelow: 1 }] }, { move: 'crown_call_kite', target: 'self' }]], { move: 'crown_gale', target: 'all' })],
        },
      ],
    },
    {
      id: 'crown_seven_struck',
      name: 'Seven Struck',
      enterWhen: [{ hpBelow: 0.3 }],
      line: "It spreads its vanes across the whole sky. 'You are the eighth,' it says. 'Strike, then.'",
      // `everyNthTurn:2` → Seven, else the Talon; Haste on itself with either (see the header)
      pattern: [firstOf([[{ everyNth: 2 }, { move: 'crown_seven', target: 'player' }]], { move: 'crown_talon', target: 'player' })],
    },
  ],
  loot: [
    { itemId: 'item_stormcrown_talon' },
    { itemId: 'mat_gale_feather' },
    { itemId: 'mat_storm_glass', count: 3 },
    { itemId: 'mat_skyreach_crystal', count: 2 },
  ],
  gold: { min: 175, max: 270 },
  xp: 1050,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      'Year 500. The first Sentinel, made by Seraphine Aulde before the others, with a crown of storm-glass. It has watched the Apex for five hundred years and keeps one fact the Remnants never recorded: the thing in the Apex does not strike what keeps its distance. Seven Wayfinders came. Seven came close. It will fight the eighth if the eighth insists.',
    tactics: 'Guard every Call Lightning (you will be Soaked). Physical and Chrono; it resists Storm and Ley. Kill the kite to keep Mark off you. Chrono strips its Phase 3 Haste.',
    codexId: 'codex_creatures_spireborn',
    reveals: [...REVEALS],
  },
  sigil: { base: 'rhombus', details: ['storm_crown', 'segmented_ring'] },
} satisfies CreatureInput;

/** WORLD §6.5 order: the Spire Loom, the Gale Kite, the Cloud Ray, the Stormcrown. */
export const creatures = [spireLoom, galeKite, cloudRay, stormcrown] satisfies CreatureInput[];
