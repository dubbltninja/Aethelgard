// Silverwood Before — the creatures whose first region (WORLD §6's Regions column) is the Before (D-090): the Ley Hound
// (Wilds, §6.2), the Ninefold Knight (elite) and the regional boss, the Unbroken Warden (Wards, §6.4), and the two Mortals,
// the City Watch Halberdier and the Circle Adept (§6.9). The Warding Pillar's first region is Mistwood & the Reach, so U43
// authors it; here it is the Archives' and the Conflux's guard and the Warden's add. XP WORLD §6 table / DESIGN §6.2;
// families WORLD §5; rules DESIGN §4.2–4.6, §4.10.
//
// Conventions are U42's, U45's and U46's (silverwood_ruins/creatures.ts, glowlands_nexus/creatures.ts, ashen_steppe/
// creatures.ts headers): stats `HP · ATK · DEF armor/ward · AGI`, SP = ATK (WORLD gives none here), non-physical moves scale on
// SP; a move's type is the creature's primary type unless the line names one; `all` = area, `you` = player; shields are × ATK;
// `construct` carries Poison and Bleed immunity written out (WORLD's conventions; D-094); loot rows in WORLD's order;
// bestiary and tactics WORLD's text verbatim (backticks and decision references dropped); `description` a sentence from the
// bestiary (no legacy line exists: the Before is a new region). The Mortals are U44's Veil Sentry's form: family `fam_mortal`,
// a `portrait` sigil, no family codex entry.
//
// Patterns: WORLD's rule (unconditioned moves cycle top to bottom; a conditioned move replaces the next cycled move when its
// condition holds, first match top to bottom) as one first-match `if` chain evaluated on every turn (`firstOf`), two cycled
// moves alternating by the creature's own turn (`alternate`) — U45's form, which keeps every `everyNthTurn` cadence (D-092).
// Readings (each repeated at its move; listed in the U48b reply):
//   - a move WORLD conditions only on "ifAllyPresent" would fire on every turn of a pair and the creature would never strike
//     (the Hound's Track, the Adept's Ward). Each waits while its own effect still stands, U45's and U46's reading of a
//     self-move with no cadence: the Track while you are Marked, the Ward while the Adept's Shield holds. "Shield self or
//     ally" is read as self, the one whose Shield the condition can see;
//   - "ifAllyDown" (the Halberdier's Whistle) is `allyCountBelow: 1` with `oncePerFight` (U43's and U46's reading; the Watch
//     comes in pairs);
//   - the Halberdier is "non-lethal": its blows "cannot take you below 1 HP; at 1 HP you are arrested (wake in the Garret,
//     lose a day)". No field says it, so losing to the Watch is a death (a gap for U34d); beating them sets
//     `flag_wanted_in_silverwood` (WORLD §6.9) as the creature's `onDefeat`, which the engine applies even when the Before has
//     already paid that fight's spoils this loop;
//   - the Warden's Phase 3 "armor 0" is `damageTakenMult`, U46's reading for Ashmaw: 51.6 expected physical damage a round
//     (WORLD's Before reference) against armor 10 is 41.6 through it, 51.6 / 41.6 = 1.24 without it; its "Haste self every
//     turn" rides on the phase's two own moves (the Sweep is Phase 1's too), two turns at a time so it holds across the
//     Sweep's turns;
//   - WORLD gives the Gate Slam (the Raise's payoff) no telegraph: one is written here (the Bell-Warden's Great Toll form);
//   - "100% on the first kill" (the Knight's pattern) and the Warden's pattern are 100 % rows: the Before pays a fight's
//     spoils once per loop (D-067.5), so each loop's first kill is the one that pays; a first kill per profile is the item
//     unit's.
import type { CombatWhen, CreatureInput, Step } from '@schema/creature';

const REVEALS = [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] as const;

/** WORLD's first-match rule as one step: `[condition, step]` pairs top to bottom, then `otherwise` (the cycled move). */
function firstOf(conditioned: readonly (readonly [CombatWhen, Step])[], otherwise: Step): Step {
  return conditioned.reduceRight<Step>((rest, [when, step]) => ({ if: when, then: [step], else: [rest] }), otherwise);
}

/** Two cycled moves: the first on the creature's odd turns, the second on its even turns. */
const alternate = (odd: Step, even: Step): Step => ({ if: { everyNth: 2 }, then: [even], else: [odd] });

/** The Warden's Phase 3 Haste, carried by its own two moves (see the header). */
const HASTE_SELF = { status: 'status_haste', duration: 2, target: 'self' } as const;

// ==== The Wilds (WORLD §6.2) =========================================================================================

// ---- cr_ley_hound — Wilds · L13 fodder · XP 327 (WORLD §6.2) -------------------------------------------------------------------
const leyHound = {
  id: 'cr_ley_hound',
  name: 'Ley Hound',
  description: "Silverwood's hounds, bred on the ley and handled by the Circle's adepts. They hunt in pairs.",
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'fodder',
  level: 13,
  stats: { hp: 150, atk: 24, sp: 24, armor: 3, ward: 4, agi: 11 },
  tags: ['beast', 'hound'],
  // "weak chrono · resist ley · immune —"
  resistances: { chrono: 'weak', ley: 'resist' },
  moves: {
    // "haste self and ally 2": the hound's whole side
    hound_bay: {
      name: 'Bay',
      line: 'It lifts its head and bays. The other one answers.',
      statuses: [{ status: 'status_haste', duration: 2, target: 'all_allies' }],
    },
    hound_bite: {
      name: 'Bite',
      line: 'Jaws lit faintly blue close on your forearm.',
      type: 'physical',
      power: { coef: 1.1, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.4, duration: 3 }],
    },
    hound_ley_snap: {
      name: 'Ley Snap',
      line: 'Blue light runs down its spine into its teeth.',
      type: 'ley',
      power: { coef: 1.2, stat: 'sp' },
      statuses: [{ status: 'status_shock', chance: 0.3, duration: 2 }],
    },
    hound_track: {
      name: 'Track',
      line: 'It puts its nose to your shadow and stays there.',
      statuses: [{ status: 'status_mark', chance: 1, duration: 3 }],
    },
  },
  // WORLD's order: `first` → the Bay; `ifAllyPresent` → the Track (while you are not Marked: see the header); else the Bite
  // and the Ley Snap alternate
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'hound_bay', target: 'self' }],
        [{ all: [{ allyPresent: true }, { not: { targetHas: 'status_mark' } }] }, { move: 'hound_track', target: 'player' }],
      ],
      alternate({ move: 'hound_bite', target: 'player' }, { move: 'hound_ley_snap', target: 'player' }),
    ),
  ],
  loot: [
    { itemId: 'mat_ley_spark', chance: 0.5 },
    { itemId: 'mat_wildling_hide', chance: 0.4 },
  ],
  gold: { min: 29, max: 45 },
  xp: 327,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Silverwood's hounds, bred on the ley and handled by the Circle's adepts, let loose on the Walks once the Archives are sealed. They hunt in pairs and bay to speed each other. Strip the speed with a Chrono hit and they are only dogs. Large, blue-toothed dogs.",
    tactics: 'Open with Chrono on the hasted one; split them with a Taunt.',
    codexId: 'codex_creatures_wilds',
    reveals: [...REVEALS],
  },
  sigil: { base: 'triangle', details: ['blue_teeth'] },
} satisfies CreatureInput;

// ==== Wards (WORLD §6.4) =============================================================================================

// ---- cr_ninefold_knight — Wards · L15 elite · XP 738 (WORLD §6.4) ------------------------------------------------------------
const ninefoldKnight = {
  id: 'cr_ninefold_knight',
  name: 'Ninefold Knight',
  description: "Plate on no one, a shield with nine sides, Vane's sigil on the breast. It guards the empty Hall on Last Bell.",
  family: 'fam_wards',
  materialKin: 'golem',
  role: 'elite',
  level: 15,
  stats: { hp: 340, atk: 27, sp: 27, armor: 8, ward: 5, agi: 5 },
  tags: ['construct'],
  resistances: { storm: 'weak', fire: 'resist', ley: 'resist', void: 'resist', chrono: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    knight_shield_up: { name: 'Shield Up', line: 'Its nine-sided shield comes up. The floor-map glows.', shield: { power: { coef: 1.5, stat: 'atk' } } },
    knight_cleave: {
      name: 'Cleave',
      line: 'The blade comes level with your ribs.',
      type: 'physical',
      power: { coef: 1.3, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.4, duration: 3 }],
    },
    knight_bash: {
      name: 'Bash',
      line: "It drives the shield's rim at your jaw.",
      type: 'physical',
      power: { coef: 0.9, stat: 'atk' },
      statuses: [{ status: 'status_stun', chance: 0.3, duration: 1 }],
    },
    // "weaken 60% 2, armor_break 40% 2 on you"
    knight_verse: {
      name: 'Verse',
      line: 'It speaks one line of a verse it does not understand.',
      statuses: [
        { status: 'status_weaken', chance: 0.6, duration: 2 },
        { status: 'status_armor_break', chance: 0.4, duration: 2 },
      ],
    },
  },
  // WORLD's order: `first` → Shield Up; `ifSelfHas:shield` → the Bash ("It bashes only from behind the shield"); `everyNthTurn:3`
  // → the Verse; else the Cleave
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'knight_shield_up', target: 'self' }],
        [{ selfHas: 'status_shield' }, { move: 'knight_bash', target: 'player' }],
        [{ everyNth: 3 }, { move: 'knight_verse', target: 'player' }],
      ],
      { move: 'knight_cleave', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_slate_core', count: 2 },
    { itemId: 'mat_silverwood_heartwood', chance: 0.4 },
    { itemId: 'mat_iron_rivet', chance: 0.6 },
    { itemId: 'item_pattern_breachsteel_blade' }, // "100% on the first kill": see the header
  ],
  gold: { min: 66, max: 102 },
  xp: 738,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "On Last Bell the Ninefold Hall is empty except for this: plate on no one, a shield with nine sides, Vane's sigil on the breast. It bashes only from behind the shield. One Void hit takes the shield away. Then strike where the sigil is.",
    tactics: 'Void destroys its Shield outright (interplay 4); without a Shield it cannot Bash.',
    codexId: 'codex_creatures_wards',
    reveals: [...REVEALS],
  },
  sigil: { base: 'hexagon', details: ['nine_sided_shield', 'double_outline'] },
} satisfies CreatureInput;

// ---- cr_unbroken_warden — Wards · L19 boss · XP 1,200 (WORLD §6.4; HP D-067.20: 12 × (51.6 − 10 armor) = 499 → 500) -----------
// The Before's regional boss (band top 17 + 2). Cannot be fled. The bypass is the Conflux's (locations.ts): the ward seal with
// Caelum active, and it kneels. Phase 1 opens with two Warding Pillars (U43's record). The hidden Raise winds up into the Gate
// Slam (the Bell-Warden's Lift and Great Toll form). Phase ids are the creature's move prefix, `uw_`, and the phase's name.
const unbrokenWarden = {
  id: 'cr_unbroken_warden',
  name: 'The Unbroken Warden',
  description: "Haldric Vane's masterwork at the Conflux stair. It lets the Nine through and no one else.",
  family: 'fam_wards',
  materialKin: 'golem',
  role: 'boss',
  level: 19,
  stats: { hp: 500, atk: 34, sp: 34, armor: 10, ward: 6, agi: 6 },
  tags: ['construct', 'regional_boss'],
  resistances: { storm: 'weak', fire: 'resist', ley: 'resist', void: 'resist', chrono: 'resist' },
  // "status immune: poison, bleed, stun, slow; Stagger allowed"
  statusImmunities: ['status_poison', 'status_bleed', 'status_stun', 'status_slow'],
  interruptible: true,
  fleeable: false,
  moves: {
    uw_hold_the_gate: { name: 'Hold the Gate', line: 'It plants itself on the stair. The pillars brighten.', shield: { power: { coef: 1.5, stat: 'atk' } } },
    uw_stone_stand: {
      name: 'Stone Stand',
      line: 'A fist of slate and silver drops toward you.',
      type: 'physical',
      power: { coef: 1.2, stat: 'atk' },
      statuses: [{ status: 'status_armor_break', chance: 0.4, duration: 3 }],
    },
    uw_sweep: { name: 'Sweep', line: 'Its arm sweeps the full width of the stair.', type: 'physical', power: { coef: 0.9, stat: 'atk' } },
    // "riposte: 1.0× you if you deal Physical damage to it before its next turn, else nothing"
    uw_meet_what_comes: { name: 'Meet What Comes', line: 'It sets its feet and waits for you to strike.', riposte: { power: { coef: 1.0, stat: 'atk' }, turns: 1 } },
    // "hidden wind-up, then `uw_gate_slam` 1.8× you · stun 50% 1"
    uw_raise: { name: 'Raise', line: 'It raises both arms. The stair darkens beneath them.', hidden: true, windUp: { turns: 1, then: 'uw_gate_slam' } },
    uw_gate_slam: {
      name: 'Gate Slam',
      line: 'The arms come down. The stair shuts like a gate.',
      type: 'physical',
      power: { coef: 1.8, stat: 'atk' },
      hidden: true,
      statuses: [{ status: 'status_stun', chance: 0.5, duration: 1 }],
    },
    uw_break: { name: 'Break', line: 'Silver and stone come down together.', type: 'physical', power: { coef: 1.5, stat: 'atk' }, statuses: [HASTE_SELF] },
    uw_last_order: {
      name: 'The Last Order',
      line: "'Not Nine,' it says. 'Not Nine. Not Nine.'",
      type: 'physical',
      power: { coef: 1.0, stat: 'atk' },
      statuses: [{ status: 'status_weaken', chance: 0.5, duration: 2 }, HASTE_SELF],
    },
  },
  phases: [
    {
      id: 'uw_keep_the_line',
      name: 'Keep the Line',
      // 100–65 %; onEnter: 2× cr_warding_pillar
      adds: [{ creatureId: 'cr_warding_pillar', count: 2 }],
      pattern: [firstOf([[{ first: true }, { move: 'uw_hold_the_gate', target: 'self' }]], alternate({ move: 'uw_stone_stand', target: 'player' }, { move: 'uw_sweep', target: 'all' }))],
    },
    {
      id: 'uw_without_fear',
      name: 'Without Fear',
      enterWhen: [{ hpBelow: 0.65 }],
      line: "The sigil turns from blue to white. Vane's voice, out of the stone: 'Meet what comes without fear.'",
      pattern: [
        firstOf(
          [
            [{ everyNth: 2 }, { move: 'uw_meet_what_comes', target: 'self' }],
            [{ everyNth: 3 }, { move: 'uw_raise', target: 'player' }],
          ],
          { move: 'uw_stone_stand', target: 'player' },
        ),
      ],
    },
    {
      id: 'uw_the_last_order',
      name: 'The Last Order',
      enterWhen: [{ hpBelow: 0.3 }],
      line: 'Stone sheds from it like bark. Under the slate, silver. It moves fast now.',
      // "armor 0": see the header (51.6 / 41.6)
      damageTakenMult: 1.24,
      pattern: [firstOf([[{ everyNth: 3 }, { move: 'uw_last_order', target: 'all' }]], alternate({ move: 'uw_break', target: 'player' }, { move: 'uw_sweep', target: 'all' }))],
    },
  ],
  loot: [
    { itemId: 'mat_silverwood_heartwood', count: 2 },
    { itemId: 'mat_slate_core', count: 3 },
    { itemId: 'item_chronal_dust', count: 2 },
    { itemId: 'item_pattern_breachwarden_mail' },
  ],
  gold: { min: 195, max: 300 },
  xp: 1200,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Haldric Vane's masterwork at the Conflux stair. It lets the Nine through and no one else. The third verse is cut into its chest: Stone, stand where flesh would fall. The golems at the Outpost are its rough drafts. Tobrin Vask kept a seal it kneels to. With the seal and Caelum, it kneels. Without them, it doesn't.",
    tactics: 'Break the pillars before its Shield cycles. In Phase 2 cast or Guard on Meet What Comes turns; Guard every Gate Slam. Storm throughout; Chrono strips the Phase 3 Haste for a turn.',
    codexId: 'codex_creatures_wards',
    reveals: [...REVEALS],
  },
  sigil: { base: 'hexagon', details: ['silver_seam', 'segmented_ring', 'double_outline'] },
} satisfies CreatureInput;

// ==== Mortals (WORLD §6.9) ===========================================================================================

// ---- cr_city_watch_halberdier — Mortal (the Silverwood Watch) · L13 fodder · XP 327 (WORLD §6.9) -------------------------------
const cityWatchHalberdier = {
  id: 'cr_city_watch_halberdier',
  name: 'City Watch Halberdier',
  description: 'The Silverwood Watch in blue and white, with halberds and whistles. They would rather carry you to a cell than kill you.',
  family: 'fam_mortal',
  role: 'fodder',
  level: 13,
  stats: { hp: 150, atk: 24, sp: 24, armor: 6, ward: 2, agi: 6 },
  tags: ['mortal', 'watch'],
  // "neutral to all · statuses work normally"
  moves: {
    watch_halt: {
      name: 'Halt',
      line: "'Halt.' The halberd comes level with your chest.",
      type: 'physical',
      power: { coef: 0.6, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.6, duration: 2 }],
    },
    watch_hook: {
      name: 'Hook',
      line: 'The hook of the halberd reaches for your knee.',
      type: 'physical',
      power: { coef: 1.0, stat: 'atk' },
      statuses: [{ status: 'status_stun', chance: 0.25, duration: 1 }],
    },
    watch_haft: { name: 'Haft', line: 'It reverses the halberd and drives the haft.', type: 'physical', power: { coef: 1.2, stat: 'atk' } },
    // "summons 1 `cr_city_watch_halberdier` · ifAllyDown · once": at most the pair stands again
    watch_whistle: { name: 'Whistle', line: 'A whistle. Boots on stone, coming.', summon: { creatureId: 'cr_city_watch_halberdier', count: 1, max: 2 } },
  },
  // WORLD's order: `first` → the Halt; `ifAllyDown` · once → the Whistle (see the header); else the Hook and the Haft alternate
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'watch_halt', target: 'player' }],
        [{ all: [{ allyCountBelow: 1 }, { oncePerFight: true }] }, { move: 'watch_whistle', target: 'self' }],
      ],
      alternate({ move: 'watch_hook', target: 'player' }, { move: 'watch_haft', target: 'player' }),
    ),
  ],
  loot: [{ itemId: 'item_silverwood_honeycake', chance: 0.3 }],
  // "beating them sets `flag_wanted_in_silverwood`" (see the header)
  onDefeat: [{ setFlag: 'flag_wanted_in_silverwood' }],
  gold: { min: 29, max: 45 },
  xp: 327,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Blue and white, halberds, whistles. They do not want to kill me. They want me carried to a cell, and in the end they manage it. Losing costs a day in the Garret, not a loop. Winning makes the Before notice me. Sheathe the blade in the Plaza.',
    tactics: "Don't draw in the Plaza. If it starts, Stun one and flee before the whistle.",
    reveals: [...REVEALS],
  },
  sigil: { base: 'portrait', details: ['halberd'] },
} satisfies CreatureInput;

// ---- cr_circle_adept — Mortal (the Circle's students) · L14 fodder · XP 367 (WORLD §6.9) ---------------------------------------
const circleAdept = {
  id: 'cr_circle_adept',
  name: 'Circle Adept',
  description: "Grey robes, ink on the cuffs: one of the Circle's students, set on the stacks on Last Bell.",
  family: 'fam_mortal',
  role: 'fodder',
  level: 14,
  stats: { hp: 150, atk: 26, sp: 26, armor: 2, ward: 6, agi: 7 },
  tags: ['mortal', 'circle'],
  // "weak physical · resist ley · statuses work normally"
  resistances: { physical: 'weak', ley: 'resist' },
  moves: {
    adept_ley_dart: { name: 'Ley Dart', line: 'An adept in grey draws a line of blue in the air.', type: 'ley', power: { coef: 1.0, stat: 'sp' } },
    // "shield self or ally 1.2× · ifAllyPresent": its own Shield (see the header)
    adept_ward: { name: 'Ward', line: 'They speak a phrase from the Warding. Light hardens over them.', shield: { power: { coef: 1.2, stat: 'atk' } } },
    adept_pyre: {
      name: 'Pyre',
      line: "A scholar's hand lights at the fingertips.",
      type: 'fire',
      power: { coef: 1.2, stat: 'sp' },
      statuses: [{ status: 'status_burn', chance: 0.5, duration: 3 }],
    },
    adept_seal: {
      name: 'Seal',
      line: "'The Archives are sealed,' they say, and mean you.",
      type: 'ley',
      power: { coef: 0.5, stat: 'sp' },
      statuses: [{ status: 'status_stun', chance: 0.3, duration: 1 }],
    },
  },
  // WORLD's order: `ifAllyPresent` → the Ward (while its Shield is down); `everyNthTurn:3` → the Pyre; `everyNthTurn:4` → the
  // Seal; else the Ley Dart (the only cycled move)
  pattern: [
    firstOf(
      [
        [{ all: [{ allyPresent: true }, { not: { selfHas: 'status_shield' } }] }, { move: 'adept_ward', target: 'self' }],
        [{ everyNth: 3 }, { move: 'adept_pyre', target: 'player' }],
        [{ everyNth: 4 }, { move: 'adept_seal', target: 'player' }],
      ],
      { move: 'adept_ley_dart', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'item_remnant_ink', chance: 0.4 },
    { itemId: 'item_mana_bloom', chance: 0.3 },
    { itemId: 'mat_silverwood_heartwood', chance: 0.15 },
  ],
  gold: { min: 31, max: 48 },
  xp: 367,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Grey robes, ink on the cuffs: the Circle's students. On Last Bell the Circle closes the Library and sets them on the stacks. They are not soldiers. They are frightened scholars with a great deal of training. One of them will be a Shade in a corridor in a few hours. I try not to think about which.",
    tactics: 'Steel through the robes; Stagger the Pyre.',
    reveals: [...REVEALS],
  },
  sigil: { base: 'portrait', details: ['grey_robes'] },
} satisfies CreatureInput;

/** WORLD §6 order: the Ley Hound (§6.2), the Ninefold Knight and the Unbroken Warden (§6.4), the two Mortals (§6.9). */
export const creatures = [leyHound, ninefoldKnight, unbrokenWarden, cityWatchHalberdier, circleAdept] satisfies CreatureInput[];
