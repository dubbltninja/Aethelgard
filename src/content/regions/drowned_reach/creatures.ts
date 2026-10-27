// The Drowned Reach — the creatures whose first region (WORLD §6's Regions column) is the Reach (D-090): the Tide Clerk,
// the Pale Diver and the Brine Lamprey (fodder), the Ledger Choir and the Bell-Ringer (elites) and the regional boss, the
// Bell-Warden (WORLD §6.3; XP WORLD §6 table / DESIGN §6.2; families WORLD §5; rules DESIGN §4.2–4.6, §4.10). The Drowned
// Archivist's first region is the Ruins, so it lives there (D-090); the Unmade's first region is the Depths (a Ruins
// location; WORLD §6.8) and nobody has authored it, so the Scriptorium's Loop 3+ group names it as a pending reference
// (listed in the U46 reply).
//
// Conventions are U42's and U45's (silverwood_ruins/creatures.ts and glowlands_nexus/creatures.ts headers): stats
// `HP · ATK · DEF armor/ward · AGI`, SP = ATK unless WORLD gives one (none here), non-physical moves scale on SP; a move's
// type is the creature's primary type unless the line names one; `all` = area, `you` = player, `ally` = the lowest-HP
// ally; the `breach_born` tag is Poison-immune (written out), `drowned` is WORLD §5's Soaked-each-turn (the engine's
// since U34e, D-094); loot rows in WORLD's order; bestiary and tactics WORLD's text verbatim (backticks and decision
// references dropped); `description` a sentence from the bestiary or the location (no legacy line exists: the Archivist is
// the Reach's only legacy Drowned).
//
// Patterns: WORLD's rule (unconditioned moves cycle top to bottom; a conditioned move replaces the next cycled move when
// its condition holds, first match top to bottom) as one first-match `if` chain evaluated on every turn (`firstOf`), two
// cycled moves alternating by the creature's own turn (`alternate`) — U45's form, which keeps every `everyNthTurn` cadence
// (D-092). Readings (each repeated at its move; listed in the U46 reply):
//   - "ifAllyDown" (an ally fell this fight) is the `allyDown` atom (U34e, D-094), with `oncePerFight` where WORLD says
//     "once per fight";
//   - "heal ally … ifAllyPresent" (the Choir's Amend) heals a wounded ally: `allyBelow: 1` (U34e, D-094), in WORLD's order
//     (first), so an unhurt reader beside it no longer makes it heal nothing;
//   - a low-HP self-move with no "once" (the Lamprey's Eddy, the Ringer's Shell) waits while its own effect still stands
//     (`not selfHas`), as U45's self-Rewind does: otherwise it would repeat every turn and the creature would never strike.
// The Bell-Warden's Phase 2 "every combatant is Soaked at the start of each round" is the phase's `roundStatuses`, and the
// `drowned` tag's Soaked-each-turn is the engine's (U34e, D-094).
import type { CombatWhen, CreatureInput, Step } from '@schema/creature';

const REVEALS = [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] as const;

/** WORLD's first-match rule as one step: `[condition, step]` pairs top to bottom, then `otherwise` (the cycled move). */
function firstOf(conditioned: readonly (readonly [CombatWhen, Step])[], otherwise: Step): Step {
  return conditioned.reduceRight<Step>((rest, [when, step]) => ({ if: when, then: [step], else: [rest] }), otherwise);
}

/** Two cycled moves: the first on the creature's odd turns, the second on its even turns. */
const alternate = (odd: Step, even: Step): Step => ({ if: { everyNth: 2 }, then: [even], else: [odd] });

/** A self-move at low HP that waits while its own effect still stands (see the header). */
const hurtAndWithout = (below: number, status: `status_${string}`): CombatWhen => ({ all: [{ hpBelow: below }, { not: { selfHas: status } }] });

// ---- cr_tide_clerk — Drowned · L5 fodder · XP 90 (WORLD §6.3) --------------------------------------------------------------
const tideClerk = {
  id: 'cr_tide_clerk',
  name: 'Tide Clerk',
  description: 'A clerk in a coat that has been underwater five hundred years, walking the benches of Tidewell Hall, checking the drowned against the ledger.',
  family: 'fam_drowned',
  materialKin: 'drowned',
  role: 'fodder',
  level: 5,
  stats: { hp: 70, atk: 12, sp: 12, armor: 2, ward: 2, agi: 5 },
  tags: ['breach_born', 'drowned'],
  resistances: { fire: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    clerk_check_name: {
      name: 'Check Name',
      line: 'It runs a wet finger down the ledger to your name.',
      statuses: [{ status: 'status_mark', chance: 1, duration: 3 }],
    },
    clerk_stamp: {
      name: 'Stamp',
      line: 'It brings the ledger down like a seal.',
      type: 'physical',
      power: { coef: 1.2, stat: 'atk' },
      statuses: [{ status: 'status_stun', chance: 0.15, duration: 1 }],
    },
    clerk_strike_out: {
      name: 'Strike Out',
      line: 'It draws a line through something with its pen.',
      type: 'physical',
      power: { coef: 0.9, stat: 'atk' },
      statuses: [{ status: 'status_weaken', chance: 0.4, duration: 2 }],
    },
  },
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'clerk_check_name', target: 'player' }],
        [{ targetHas: 'status_mark' }, { move: 'clerk_stamp', target: 'player' }],
      ],
      { move: 'clerk_strike_out', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_sodden_vellum', chance: 0.7 },
    { itemId: 'item_remnant_ink', chance: 0.2 },
  ],
  gold: { min: 13, max: 21 },
  xp: 90,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "A clerk in a coat that has been underwater five hundred years, walking the benches of Tidewell Hall, checking the drowned against the ledger. When it finds my name it marks it, and then it stamps. The ledger's last line is in a different hand. I read it later.",
    tactics: 'Clear the Mark and it never Stamps; Storm.',
    codexId: 'codex_creatures_drowned',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_waterline', details: ['drip'] },
} satisfies CreatureInput;

// ---- cr_pale_diver — Drowned · L6 fodder · XP 111 (WORLD §6.3) -------------------------------------------------------------
const paleDiver = {
  id: 'cr_pale_diver',
  name: 'Pale Diver',
  description: 'A Remnant diver lost in the Cistern of Names. It still carries its lamp, and it still dives.',
  family: 'fam_drowned',
  materialKin: 'drowned',
  role: 'fodder',
  level: 6,
  stats: { hp: 80, atk: 14, sp: 14, armor: 1, ward: 3, agi: 7 },
  tags: ['breach_born', 'drowned'],
  resistances: { fire: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    diver_grapple: {
      name: 'Grapple',
      line: 'Pale hands close on your belt and pull downward.',
      type: 'physical',
      power: { coef: 0.9, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.6, duration: 2 }],
    },
    diver_hold_under: {
      name: 'Hold Under',
      line: 'It wraps around you and the water closes over.',
      type: 'physical',
      power: { coef: 1.1, stat: 'atk' }, // U81b2: was 1.4 (two Divers chained it on a Slowed player: 85 % deaths at L7)
      statuses: [{ status: 'status_soaked', chance: 1, duration: 3 }],
    },
    diver_rise: { name: 'Rise', line: 'It sinks out of reach and rises behind you.', statuses: [{ status: 'status_phase', duration: 1, target: 'self' }] },
  },
  pattern: [
    firstOf(
      [
        [{ targetHas: 'status_slow' }, { move: 'diver_hold_under', target: 'player' }],
        [{ everyNth: 3 }, { move: 'diver_rise', target: 'self' }],
      ],
      { move: 'diver_grapple', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_drowned_pearl', chance: 0.3 },
    { itemId: 'item_lantern_oil', chance: 0.25 },
    { itemId: 'mat_sodden_vellum', chance: 0.3 },
  ],
  gold: { min: 15, max: 24 },
  xp: 111,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 140 to the present. Remnant divers lost in the Cistern of Names: eleven, by the Lamplighters' count. Pellam believes the pale ones at the rim are ours, not the city's. They still carry their lamps. They still dive. They want company on the way down.",
    tactics: 'Cleanse Slow at once and Hold Under never fires.',
    codexId: 'codex_creatures_drowned',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_waterline', details: ['drip', 'lamp'] },
} satisfies CreatureInput;

// ---- cr_brine_lamprey — Drowned · L5 fodder · XP 90; the Bell-Warden's add (WORLD §6.3) ------------------------------------
const brineLamprey = {
  id: 'cr_brine_lamprey',
  name: 'Brine Lamprey',
  description: 'Pale, eel-long, too many mouths, all of them round.',
  family: 'fam_drowned',
  materialKin: 'drowned',
  role: 'fodder',
  level: 5,
  stats: { hp: 56, atk: 12, sp: 12, armor: 0, ward: 1, agi: 9 },
  tags: ['breach_born', 'drowned', 'warden_add'],
  resistances: { fire: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    lamprey_latch: {
      name: 'Latch',
      line: 'A pale shape with too many mouths finds your calf.',
      type: 'physical',
      power: { coef: 0.8, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.5, duration: 3 }],
    },
    // "heals self for 100 % of damage dealt"
    lamprey_drink: {
      name: 'Drink',
      line: 'It pulses as it drinks.',
      type: 'physical',
      power: { coef: 0.6, stat: 'atk' },
      effects: [{ healOnDamage: { pct: 1 } }],
    },
    lamprey_eddy: { name: 'Eddy', line: 'It vanishes into an eddy by the rusted grate.', statuses: [{ status: 'status_phase', duration: 1, target: 'self' }] },
  },
  pattern: [
    firstOf(
      [
        [{ targetHas: 'status_bleed' }, { move: 'lamprey_drink', target: 'player' }],
        [hurtAndWithout(0.5, 'status_phase'), { move: 'lamprey_eddy', target: 'self' }],
      ],
      { move: 'lamprey_latch', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_drowned_pearl', chance: 0.1 },
    { itemId: 'item_brine_draught', chance: 0.15 },
  ],
  gold: { min: 13, max: 21 },
  xp: 90,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Pale, eel-long, too many mouths, all of them round. They wait where the grates have rusted and come in threes. They don't hit hard. They hold on. One Storm through the water and every one of them jumps at once.",
    tactics: 'Storm on one Shocks the rest (interplay 1); cleanse Bleed to stop the Drink.',
    codexId: 'codex_creatures_drowned',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_waterline', details: ['drip', 'mouths'] },
} satisfies CreatureInput;

// ---- cr_ledger_choir — Drowned · L7 elite · XP 243 (WORLD §6.3) ----------------------------------------------------------------
const ledgerChoir = {
  id: 'cr_ledger_choir',
  name: 'Ledger Choir',
  description: 'The drowned stand in a ring around the lectern and read the names of the drowned, by street, as they are written.',
  family: 'fam_drowned',
  materialKin: 'drowned',
  role: 'elite',
  level: 7,
  stats: { hp: 180, atk: 15, sp: 15, armor: 2, ward: 4, agi: 4 },
  tags: ['breach_born', 'drowned'],
  resistances: { fire: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    choir_intone: {
      name: 'Intone',
      line: 'Many wet voices read one name together.',
      type: 'ley',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_weaken', chance: 0.4, duration: 2 }],
    },
    choir_amend: { name: 'Amend', line: "The pages turn back. An ally's wound closes.", heal: { power: { coef: 0.9, stat: 'atk' }, target: 'ally' } }, // U81b2: was 1.5 (12 rounds, 35 % deaths at band 5)
    choir_reinscribe: { name: 'Reinscribe', line: 'They read a fallen name back into the book.', revive: { hpPct: 0.4 } },
    choir_verse: {
      name: 'Verse',
      line: 'The voices find a note under the water.',
      type: 'ley',
      power: { coef: 1.4, stat: 'sp' },
      statuses: [{ status: 'status_soaked', chance: 1, duration: 3 }],
    },
  },
  pattern: [
    firstOf(
      [
        // "ifAllyPresent": a wounded ally (see the header)
        [{ allyBelow: 1 }, { move: 'choir_amend', target: 'ally' }],
        // "ifAllyDown, once per fight"
        [{ all: [{ allyDown: true }, { oncePerFight: true }] }, { move: 'choir_reinscribe', target: 'self' }],
        [{ everyNth: 3 }, { move: 'choir_verse', target: 'player' }],
      ],
      { move: 'choir_intone', target: 'all' },
    ),
  ],
  loot: [
    { itemId: 'mat_sodden_vellum', count: 2 },
    { itemId: 'mat_drowned_pearl', chance: 0.4 },
    { itemId: 'item_remnant_ink', chance: 0.5 },
  ],
  gold: { min: 34, max: 54 },
  xp: 243,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      'Year 302. In the Scriptorium the desks face one lectern, and around it the drowned stand in a ring and read: the names of the drowned, by street, written as they are read. Kill a reader and the Choir reads it back in. Silence the Choir first. In the margin, in Ashcombe\'s hand: "Ley breaks the binding."',
    tactics: 'Focus the Choir (or Stagger the Reinscribe); Storm area damage hits all three ×1.5.',
    codexId: 'codex_creatures_drowned',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_waterline', details: ['drip', 'double_outline'] },
} satisfies CreatureInput;

// ---- cr_bell_ringer — Drowned · L7 elite · XP 243 (WORLD §6.3) -----------------------------------------------------------------
const bellRinger = {
  id: 'cr_bell_ringer',
  name: 'Bell-Ringer',
  description: 'Something lives in the great bell on its side: a rope, a pale hand, a shape that rings.',
  family: 'fam_drowned',
  materialKin: 'drowned',
  role: 'elite',
  level: 7,
  stats: { hp: 180, atk: 15, sp: 15, armor: 4, ward: 2, agi: 3 },
  tags: ['breach_born', 'drowned'],
  resistances: { void: 'weak', fire: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    ringer_low_note: {
      name: 'Low Note',
      line: 'The great bell speaks one low note. The water shivers.',
      type: 'storm',
      power: { coef: 0.7, stat: 'sp' },
      statuses: [{ status: 'status_shock', chance: 0.4, duration: 2 }],
    },
    ringer_stand_them_up: { name: 'Stand Them Up', line: 'The note goes on. Something drowned stands up again.', revive: { hpPct: 0.5 } },
    ringer_rope: {
      name: 'Rope',
      line: "A rope of drowned hair swings out of the bell's mouth.",
      type: 'physical',
      power: { coef: 1.2, stat: 'atk' },
      statuses: [{ status: 'status_stun', chance: 0.2, duration: 1 }],
    },
    ringer_shell: { name: 'Shell', line: 'It draws back into the bell. Bronze closes.', shield: { power: { coef: 1.5, stat: 'atk' } } },
  },
  pattern: [
    firstOf(
      [
        // "ifAllyDown, once per fight" (U34e: `allyDown`)
        [{ all: [{ allyDown: true }, { oncePerFight: true }] }, { move: 'ringer_stand_them_up', target: 'self' }],
        [hurtAndWithout(0.5, 'status_shield'), { move: 'ringer_shell', target: 'self' }],
      ],
      alternate({ move: 'ringer_low_note', target: 'all' }, { move: 'ringer_rope', target: 'player' }),
    ),
  ],
  loot: [
    { itemId: 'mat_bell_bronze', count: 2 },
    { itemId: 'mat_drowned_pearl', chance: 0.3 },
    { itemId: 'item_bell_shard', chance: 0.2 },
  ],
  gold: { min: 34, max: 54 },
  xp: 243,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'A bell lies on its side in a flooded tower and something lives in it. I never saw it whole: a rope, a pale hand, a shape that rings. When it rings, the drowned stand up. Void cracks the bronze it hides behind. Kill the archivist first, or it rises on the next note.',
    tactics: 'Its Low Note is Storm, and you are Soaked down here: Guard it. Void breaks the Shell.',
    codexId: 'codex_creatures_drowned',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_waterline', details: ['drip', 'bell', 'double_outline'] },
} satisfies CreatureInput;

// ---- cr_bell_warden — Drowned · L10 boss · XP 500 (WORLD §6.3; HP D-067.20: 12 × (30 − 5 armor) = 300) ---------------------
// The Reach's regional boss (band 4–8 top + 2). Cannot be fled. The bypass is the Deep's (locations.ts): with
// `echo_rhune_choice` the player says the Warden of Waters' name and the encounter is skipped. Phase 1 is skipped when the
// Heartstone is stabilized ("it does not toll"): the fight then opens on Phase 2 with its line (the engine's `skipWhen`).
const bellWarden = {
  id: 'cr_bell_warden',
  name: 'The Bell-Warden',
  description: "A drowned giant in the Warden of Waters' chain of office, sitting in the well with the bell's clapper across its knees.",
  family: 'fam_drowned',
  materialKin: 'drowned',
  role: 'boss',
  level: 10,
  stats: { hp: 300, atk: 20, sp: 20, armor: 5, ward: 4, agi: 5 },
  tags: ['breach_born', 'drowned', 'regional_boss'],
  resistances: { fire: 'resist' },
  statusImmunities: ['status_poison', 'status_stun'],
  interruptible: true, // "Stagger allowed"
  fleeable: false,
  moves: {
    warden_ask: { name: 'Ask', line: "It lifts its head. 'Is it the hour?'" },
    warden_toll: {
      name: 'Toll',
      line: 'It strikes the clapper on its knee. The water jumps.',
      type: 'storm',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_soaked', chance: 1, duration: 3 }],
    },
    warden_clapper: {
      name: 'Clapper',
      line: 'The clapper rises from its knees toward you.',
      type: 'physical',
      power: { coef: 1.4, stat: 'atk' },
      statuses: [{ status: 'status_armor_break', chance: 0.4, duration: 2 }],
    },
    warden_call: {
      name: 'Call',
      line: 'It hums. Something in the black water answers.',
      summon: { creatureId: 'cr_brine_lamprey', count: 1, max: 2 },
    },
    warden_undertow: {
      name: 'Undertow',
      line: 'The well pulls at your legs like a tide.',
      type: 'physical',
      power: { coef: 1.0, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.5, duration: 2 }],
    },
    // hidden wind-up, then the Great Toll (1.8× storm, all): WORLD gives the wind-up's line only, the payoff's is written here
    warden_lift: { name: 'Lift', line: 'It lifts the clapper high. The water goes still.', hidden: true, windUp: { turns: 1, then: 'warden_great_toll' } },
    warden_great_toll: {
      name: 'Great Toll',
      line: 'The clapper falls. The whole well rings with it.',
      type: 'storm',
      power: { coef: 1.8, stat: 'sp' },
      hidden: true,
    },
    warden_ring_the_city: {
      name: 'Ring the City',
      line: 'It rings for everyone who drowned, all at once.',
      type: 'storm',
      power: { coef: 1.2, stat: 'sp' },
    },
  },
  phases: [
    {
      id: 'warden_is_it_the_hour',
      name: 'Is It the Hour?',
      // 100–65 %; "skipped if flag_heartstone_stabilized: it does not toll"
      skipWhen: { flag: 'flag_heartstone_stabilized' },
      pattern: [
        firstOf(
          [
            [{ first: true }, { move: 'warden_ask', target: 'self' }],
            [{ everyNth: 3 }, { move: 'warden_call', target: 'self' }],
          ],
          alternate({ move: 'warden_toll', target: 'all' }, { move: 'warden_clapper', target: 'player' }),
        ),
      ],
    },
    {
      id: 'warden_the_water_rises',
      name: 'The Water Rises',
      enterWhen: [{ hpBelow: 0.65 }],
      // "every combatant is Soaked at the start of each round" (U34e, D-094)
      roundStatuses: ['status_soaked'],
      line: 'The Warden stands. The chain of office swings. The water in the well begins to rise.',
      pattern: [
        firstOf([[{ everyNth: 3 }, { move: 'warden_lift', target: 'all' }]], alternate({ move: 'warden_undertow', target: 'all' }, { move: 'warden_clapper', target: 'player' })),
      ],
    },
    {
      id: 'warden_the_hour',
      name: 'The Hour',
      enterWhen: [{ hpBelow: 0.25 }],
      line: "'It is the hour,' it says, in the voice of a city. 'She said I would know.'",
      pattern: [alternate({ move: 'warden_clapper', target: 'player' }, { move: 'warden_ring_the_city', target: 'all' })],
    },
  ],
  loot: [
    { itemId: 'item_cistern_key' },
    { itemId: 'item_bell_clapper' },
    { itemId: 'item_rhunes_hydromancy' }, // "100 % (first clear)"; the profile-level "first" is the item unit's
    { itemId: 'mat_drowned_pearl', count: 2 },
    { itemId: 'mat_bell_bronze', count: 3 },
  ],
  gold: { min: 105, max: 165 },
  xp: 500,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 500, from the Tidewell ledger. On the last day the Warden of Waters, Ilsabet Rhune, sent the bell-ringers' guild to the great bell under the cisterns, to ring when she opened them. They rang. The water came. They did not leave the ropes. What sits in the Deep is the guild, grown together around the clapper, wearing the chain she hung on it. It waits to be told the hour. It will take her name instead.",
    tactics:
      'Guard every Great Toll (you are Soaked: Storm ×1.5). Storm is the answer: it is always Soaked, so Storm hits ×1.5 and Shocks the lampreys. Kill lampreys as they come. itm_echo_bolt is no shortcut here (Ley is neutral).',
    codexId: 'codex_creatures_drowned',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_waterline', details: ['drip', 'segmented_ring'] },
} satisfies CreatureInput;

/** WORLD §6 order within the Drowned: the Tide Clerk, the Pale Diver, the Brine Lamprey, the Ledger Choir, the Bell-Ringer, the Bell-Warden. */
// ==== Anomaly variants (U34e; WORLD §10.2, DESIGN §6.6; D-087, D-091 gap 4) ===============================================
// Each twists a creature of this region: its numbers and gold (the base's, unless the twist changes them), WORLD §10.2's
// twist, XP ×1.3 of the base's, the guaranteed material as its loot (`mat_frayed_moment`, the material WORLD §6.8 calls
// "anomaly guaranteed"), and its `anomaly` spawn (region, Loop, count). The engine reads the twist tags named at each
// record (reducers/combat.ts header). Bestiary entries are the Wayfinder's notes on the twist (WORLD §10.2 gives the twist
// only).
// ---- cr_anomaly_unfiled_archivist — Drowned · L4 anomaly, Loop 2+ · XP 92 ("Rewinds a wounded ally instead of attacking") ----
// The Drowned Archivist's numbers and moves (silverwood_ruins/creatures.ts; its quest-only turn and drop left out), and a
// Rewind on its most wounded ally while one is below 75 % (WORLD gives no line for "wounded"). Spawned alone it has no ally.
const unfiledArchivist = {
  id: 'cr_anomaly_unfiled_archivist',
  name: 'Unfiled Archivist',
  description: 'A Drowned Archivist that files wounds back where they came from.',
  family: 'fam_drowned',
  materialKin: 'drowned',
  role: 'anomaly',
  level: 4,
  stats: { hp: 58, atk: 11, sp: 11, armor: 1, ward: 3, agi: 4 },
  tags: ['breach_born', 'drowned', 'anomaly'],
  resistances: { fire: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    unfiled_unfile: {
      name: 'Unfile',
      line: 'It reads a wounded page back into its binding.',
      statuses: [{ status: 'status_rewind', duration: 2 }],
    },
    archivist_page_cut: {
      name: 'Page Cut',
      line: 'A sodden page lifts from its book, edge first.',
      type: 'physical',
      power: { coef: 1.0, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.3, duration: 2 }],
    },
    archivist_recite: {
      name: 'Recite',
      line: 'It reads aloud. The water around you listens.',
      type: 'ley',
      power: { coef: 0.9, stat: 'sp' },
      statuses: [{ status: 'status_soaked', chance: 1, duration: 3 }],
    },
    archivist_bind: {
      name: 'Bind',
      line: 'It closes its book on your shadow.',
      type: 'ley',
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.5, duration: 2 }],
    },
  },
  pattern: [
    firstOf(
      [
        [{ allyBelow: 0.75 }, { move: 'unfiled_unfile', target: 'ally' }],
        [{ everyNth: 3 }, { move: 'archivist_bind', target: 'player' }],
      ],
      alternate({ move: 'archivist_page_cut', target: 'player' }, { move: 'archivist_recite', target: 'player' }),
    ),
  ],
  loot: [{ itemId: 'mat_frayed_moment' }], // DESIGN §6.6: the anomaly's guaranteed material drop (WORLD §10.2 lists no other)
  gold: { min: 11, max: 18 },
  xp: 92,
  anomaly: { region: 'region_drowned_reach', loop: 2 },
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Loop 2. An Archivist reading the wrong book: to it a wounded ally is a wounded page, and it reads them back to whole. It does that instead of fighting, as long as anyone near it is hurt.',
    tactics: 'Kill it first, or its allies cleanly; Storm (always Soaked); Void consumes the Rewind it gives.',
    codexId: 'codex_creatures_drowned',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_waterline', details: ['drip', 'double_outline'] },
} satisfies CreatureInput;

export const creatures = [tideClerk, paleDiver, brineLamprey, ledgerChoir, bellRinger, bellWarden, unfiledArchivist] satisfies CreatureInput[];
