// The Glowfen — the creatures whose first region (WORLD §6's Regions column) is the Glowfen (D-090): the Barrow-Light (fodder)
// and the regional boss, the Lantern Matron (the Green, WORLD §6.6; XP WORLD §6 table / DESIGN §6.2; families WORLD §5; rules
// DESIGN §4.2–4.6, §4.10). The Glowfen Mireling, the Lantern Toad and the Spore Drift are the Glowlands' (first region, U45),
// the Reed Stalker the Steppe's (U46): the Glowfen's locations and the Matron's Call place them by reference.
//
// Conventions are U42's, U45's and the Reach's (silverwood_ruins/creatures.ts, glowlands_nexus/creatures.ts and
// drowned_reach/creatures.ts headers): stats `HP · ATK · DEF armor/ward · AGI`, SP = ATK unless WORLD gives one (none here),
// non-physical moves scale on SP; a move's type is the creature's primary type (ley) unless the line names one; `all` = area,
// `you` = player; the Green's Poison immunity ("they carry it") written out; loot rows in WORLD's order; bestiary and tactics
// WORLD's text verbatim (backticks, asterisks and decision references dropped); `description` a sentence from the bestiary or
// the location (no legacy line exists: both creatures are new).
//
// Patterns: WORLD's rule (unconditioned moves cycle top to bottom; a conditioned move replaces the next cycled move when its
// condition holds, first match top to bottom) as one first-match `if` chain evaluated on every turn (`firstOf`), two cycled
// moves alternating by the creature's own turn (`alternate`), and a phase of three cycled moves with an `everyNth` move checks
// that move before each cycled move (`everyNthAmong`) — U45's forms, which keep every `everyNthTurn` cadence (D-092).
// Readings (each repeated at its move; listed in the U47 reply):
//   - the Barrow-Light's Stun: the tactics say "from Loop 3 the named turn is the Stun turn", and the bestiary that the lights
//     began to say names "in the third loop", so the Stun row of `barrow_say_a_name` carries `when: { loop: { min: 3 } }` and
//     the move is the 0.5× hit alone before then. Its `item_barrow_light_vial` ("the first one killed at loc_firefly_barrows,
//     100 %, WORLD §3.9") is the Barrows' hidden item once a light has been killed there (locations.ts), so the creature's loot
//     holds the other two rows and nothing pays twice. Gather ("ifHpBelow:40", no "once") replaces the cycled move on every
//     turn below 40 % HP, as WORLD's rule reads;
//   - "heal self … ifAllyPresent (consumes the toad)" (the Matron's Drink): the heal waits on a living Lantern Toad
//     (`allyPresent: 'cr_lantern_toad'`) and the move's `consumesAlly` takes the toad (U34e, D-096: no XP, not a kill), so she
//     drinks at most once per toad;
//   - "her Regen and Shield end and cannot be reapplied" (Phase 3): the phase's `onEnter` strips both from her, and the phase's
//     `statusImmunities` refuse them from any source after (U34e, D-096);
//   - the Call's toads come from `matron_call` alone (WORLD gives the encounter no opening group: "adds cr_lantern_toad").
import type { CombatWhen, CreatureInput, Step } from '@schema/creature';

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


// ---- cr_barrow_light — Green · L11 fodder · XP 253 (WORLD §6.6) ---------------------------------------------------------------
const barrowLight = {
  id: 'cr_barrow_light',
  name: 'Barrow-Light',
  description: "The light that leaks out of a Glowfen barrow at dusk and walks the mound's edge, keeping watch over itself.",
  family: 'fam_green',
  materialKin: 'mireling',
  role: 'fodder',
  level: 11,
  stats: { hp: 120, atk: 21, sp: 21, armor: 0, ward: 6, agi: 8 },
  tags: ['barrow'],
  resistances: { void: 'weak', ley: 'resist', physical: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    barrow_keep_watch: {
      name: 'Keep Watch',
      line: "The light paces the mound's edge and turns to you.",
      statuses: [{ status: 'status_mark', chance: 1, duration: 3 }],
    },
    barrow_cold_glow: {
      name: 'Cold Glow',
      line: 'It brightens, and the warmth leaves your hands.',
      type: 'ley',
      power: { coef: 1.1, stat: 'sp' },
      statuses: [{ status: 'status_weaken', chance: 0.4, duration: 2 }],
    },
    // "stun 30 % 1": the Stun is from Loop 3 (see the header)
    barrow_say_a_name: {
      name: 'Say a Name',
      line: 'It speaks a name. You turn before you can stop.',
      type: 'ley',
      power: { coef: 0.5, stat: 'sp' },
      statuses: [{ status: 'status_stun', chance: 0.3, duration: 1, when: { loop: { min: 3 } } }],
    },
    barrow_gather: {
      name: 'Gather',
      line: 'More light leaks out of the mound into it.',
      heal: { power: { coef: 0.5, stat: 'atk' }, target: 'self' }, // U81b2: was 1.0 (every turn below 40 %: a resisted physical Elf stalled at round 61)
    },
  },
  // `first` → Keep Watch; `everyNthTurn:3` → Say a Name; `ifHpBelow:40` → Gather (WORLD's order, top to bottom); the Cold Glow is
  // the only cycled move
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'barrow_keep_watch', target: 'player' }],
        [{ everyNth: 3 }, { move: 'barrow_say_a_name', target: 'player' }],
        [{ hpBelow: 0.4 }, { move: 'barrow_gather', target: 'self' }],
      ],
      { move: 'barrow_cold_glow', target: 'player' },
    ),
  ],
  // WORLD's first row, `item_barrow_light_vial`, is the Barrows' item (see the header)
  loot: [
    { itemId: 'mat_ley_resin', chance: 0.4 },
    { itemId: 'mat_glow_gland', chance: 0.3 },
  ],
  gold: { min: 25, max: 39 },
  xp: 253,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "The Glowfen bury their dead in the water and the dead do not stay dark. At dusk the light leaks out and walks the edge of its own barrow, keeping watch over itself. It is not angry. It is on watch. In the third loop they began to say names. Seven were Wayfinders'. I waited for the eighth.",
    tactics: 'Void; from Loop 3 the named turn is the Stun turn, so Guard it.',
    codexId: 'codex_creatures_green',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_lit', details: ['walking_light'] },
} satisfies CreatureInput;

// ---- cr_lantern_matron — Green · L14 boss · XP 770 (WORLD §6.6; HP D-067.20: 12 × (39.6 − 4 armor) = 427, set to 430) ------------
// The Glowfen's regional boss (band 8–12 top + 2): Elder Mother Sulis of Lanternreed. Cannot be fled. The bypass is the Hall's
// (locations.ts): with Mireya active and her lantern lit, Sulis is lulled and the encounter is skipped.
const lanternMatron = {
  id: 'cr_lantern_matron',
  name: 'The Lantern Matron',
  description: "What was Elder Mother Sulis of Lanternreed: vast, patient, her back a hill of lanterns that were once her children's names.",
  family: 'fam_green',
  materialKin: 'mireling',
  role: 'boss',
  level: 14,
  stats: { hp: 430, atk: 26, sp: 26, armor: 4, ward: 6, agi: 4 },
  tags: ['regional_boss'],
  resistances: { void: 'weak', fire: 'weak', ley: 'resist' },
  statusImmunities: ['status_poison', 'status_blind', 'status_stun'],
  interruptible: true, // "Stagger allowed"
  fleeable: false,
  moves: {
    matron_hum: {
      name: 'Hum',
      line: 'She hums the tune every Lanternreed mother hums.',
      type: 'ley',
      power: { coef: 0.4, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.6, duration: 2 }],
    },
    // "shield self 1.2× and regen self 0.3×/3"
    matron_lantern_light: {
      name: 'Lantern Light',
      line: 'The lanterns on her back brighten one by one.',
      shield: { power: { coef: 1.2, stat: 'atk' } },
      statuses: [{ status: 'status_regen', duration: 3, target: 'self', power: { coef: 0.3, stat: 'atk' } }],
    },
    matron_call: {
      name: 'Call',
      line: 'She clicks her tongue. Something wet climbs onto the roots.',
      summon: { creatureId: 'cr_lantern_toad', count: 1, max: 2 },
    },
    matron_reach: {
      name: 'Reach',
      line: 'An arm as long as a boat reaches for you, gently.',
      type: 'physical',
      power: { coef: 1.2, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.4, duration: 2 }],
    },
    matron_name_you: {
      name: 'Name You',
      line: 'She says a name. It is almost yours.',
      type: 'ley',
      power: { coef: 0.5, stat: 'sp' },
      statuses: [
        { status: 'status_curse', chance: 1, duration: 3 },
        { status: 'status_mark', chance: 1, duration: 3 },
      ],
    },
    matron_embrace: {
      name: 'Embrace',
      line: 'Both arms open around you, warm, and close.',
      type: 'physical',
      power: { coef: 1.6, stat: 'atk' },
      statuses: [{ status: 'status_poison', chance: 0.6, duration: 4 }],
    },
    // "(consumes the toad)": see the header
    matron_drink: {
      name: 'Drink',
      line: 'She lifts a toad to her mouth. Its light goes out.',
      heal: { power: { coef: 1.5, stat: 'atk' }, target: 'self' },
      consumesAlly: 'cr_lantern_toad', // U34e (D-096): "(consumes the toad)"
    },
    matron_flood: {
      name: 'Flood',
      line: 'The Breach-light under the Hall rises through her and out.',
      type: 'ley',
      power: { coef: 1.1, stat: 'sp' },
      statuses: [{ status: 'status_blind', chance: 0.5, duration: 1 }],
    },
  },
  phases: [
    {
      id: 'matron_lullaby',
      name: 'Lullaby',
      // 100–65 %: the Call on every third turn, otherwise Hum, Lantern Light and Reach in turn
      pattern: everyNthAmong({ move: 'matron_call', target: 'self' }, 3, [
        { move: 'matron_hum', target: 'all' },
        { move: 'matron_lantern_light', target: 'self' },
        { move: 'matron_reach', target: 'player' },
      ]),
    },
    {
      id: 'matron_counting_the_names',
      name: 'Counting the Names',
      enterWhen: [{ hpBelow: 0.65 }],
      line: "She looks at you properly for the first time. 'You have a name,' she says. 'Let me keep it.'",
      // Drink replaces the cycled move while a toad stands (it consumes the toad, see the header); Name You and Embrace in turn
      pattern: [
        firstOf([[{ allyPresent: 'cr_lantern_toad' }, { move: 'matron_drink', target: 'self' }]], alternate({ move: 'matron_name_you', target: 'player' }, { move: 'matron_embrace', target: 'player' })),
      ],
    },
    {
      id: 'matron_she_wants_more',
      name: 'She Wants More',
      enterWhen: [{ hpBelow: 0.3 }],
      line: 'The lanterns on her back crack. The names scratched in the glass go dark. She stops humming.',
      // "her Regen and Shield end and cannot be reapplied" (see the header)
      onEnter: [{ stripBuffs: { kinds: ['shield', 'regen'], target: 'self' } }],
      statusImmunities: ['status_shield', 'status_regen'],
      // Flood on every second turn, otherwise Embrace
      pattern: [alternate({ move: 'matron_embrace', target: 'player' }, { move: 'matron_flood', target: 'all' })],
    },
  ],
  loot: [
    { itemId: 'item_lantern_moth_brooch' },
    { itemId: 'mat_ley_resin', count: 4 },
    { itemId: 'mat_glow_gland', count: 3 },
  ],
  gold: { min: 145, max: 225 },
  xp: 770,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      'Year 431. Elder Mother Sulis of Lanternreed went down into the cavern under the swamp, where the light pools thickest, to bring back the children who had followed it. She brought none back. She stayed, and the light grew her. Her back is a hill of lanterns, each scratched with a name. She remembers all of them. Lanternreed does not speak of her. Mireya does, once.',
    tactics: 'Kill the toads before she drinks them. Void strips her Shield and Regen. A Ley hit lifts her Curse from you. Guard the Flood.',
    codexId: 'codex_creatures_green',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_lit', details: ['lantern_back', 'seated_figure', 'double_outline'] },
} satisfies CreatureInput;

/** WORLD §6.6's block order within the Green: the Barrow-Light, then the Lantern Matron (the Mireling, Toad, Spore Drift and Reed Stalker between are other regions'). */
// ==== Anomaly variants (U34e; WORLD §10.2, DESIGN §6.6; D-087, D-091 gap 4) ===============================================
// Each twists a creature of this region: its numbers and gold (the base's, unless the twist changes them), WORLD §10.2's
// twist, XP ×1.3 of the base's, the guaranteed material as its loot (`mat_frayed_moment`, the material WORLD §6.8 calls
// "anomaly guaranteed"), and its `anomaly` spawn (region, Loop, count). The engine reads the twist tags named at each
// record (reducers/combat.ts header). Bestiary entries are the Wayfinder's notes on the twist (WORLD §10.2 gives the twist
// only).
// ---- cr_anomaly_seeding_toad — Green · L8 anomaly, Loop 2+ · XP 209 ("Adds one Spore Drift each turn (max 2)") --------------
// The Lantern Toad's numbers and moves (glowlands_nexus/creatures.ts), each move also summoning a Spore Drift (two at most).
const SEED = { creatureId: 'cr_spore_drift', count: 1, max: 2 } as const;
const seedingToad = {
  id: 'cr_anomaly_seeding_toad',
  name: 'Seeding Toad',
  description: 'A Lantern Toad that spits Spore Drifts out with its light.',
  family: 'fam_green',
  materialKin: 'mireling',
  role: 'anomaly',
  level: 8,
  stats: { hp: 96, atk: 17, sp: 17, armor: 3, ward: 2, agi: 4 },
  tags: ['anomaly'],
  resistances: { fire: 'weak', void: 'weak', ley: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    toad_lure: { name: 'Lure', line: 'Its throat-sac lights like a lantern on a pole.', statuses: [{ status: 'status_blind', chance: 0.5, duration: 2 }], summon: SEED },
    toad_tongue: {
      name: 'Tongue',
      line: 'A tongue the length of a reed snaps out.',
      type: 'physical',
      power: { coef: 1.0, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.3, duration: 2 }],
      summon: SEED,
    },
    toad_swallow_light: { name: 'Swallow Light', line: 'It gulps, and the light goes into it.', shield: { power: { coef: 1.0, stat: 'atk' } }, summon: SEED },
    toad_flop: { name: 'Flop', line: 'It gathers itself, heavy, over your feet.', type: 'physical', power: { coef: 1.3, stat: 'atk' }, summon: SEED },
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
  loot: [{ itemId: 'mat_frayed_moment' }], // DESIGN §6.6: the anomaly's guaranteed material drop (WORLD §10.2 lists no other)
  gold: { min: 19, max: 30 },
  xp: 209,
  anomaly: { region: 'region_glowfen', loop: 2 },
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Loop 2. A lantern-toad with a throat full of spores. Each time it moves, a Drift comes loose and floats toward me, two at a time, never more. Kill the toad and the seeding stops.',
    tactics: 'Kill the toad first; fire; do not stand over a dying Drift.',
    codexId: 'codex_creatures_green',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_lit', details: ['throat_sac', 'double_outline'] },
} satisfies CreatureInput;

export const creatures = [barrowLight, lanternMatron, seedingToad] satisfies CreatureInput[];
