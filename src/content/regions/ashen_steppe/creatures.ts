// The Ashen Steppe — the creatures whose first region (WORLD §6's Regions column) is the Steppe (D-090): the Salt Jackal, the
// Cinderback (elite), the Reed Stalker and the regional boss, Ashmaw (WORLD §6.2, §6.6; XP WORLD §6 table / DESIGN §6.2;
// families WORLD §5; rules DESIGN §4.2–4.6, §4.10). The Steppe Harrier's first region is the Highlands (U44 authors it; here
// it is a pending reference in the region's pool and three locations). The Horde Husk is U45's.
//
// Conventions are U42's, U45's and the Reach's (silverwood_ruins/creatures.ts, glowlands_nexus/creatures.ts and
// drowned_reach/creatures.ts headers): stats `HP · ATK · DEF armor/ward · AGI`, SP = ATK unless WORLD gives one (none here),
// non-physical moves scale on SP; a move's type is the creature's primary type unless the line names one; `all` = area,
// `you` = player; loot rows in WORLD's order; bestiary and tactics WORLD's text verbatim (backticks dropped); `description` a
// sentence from the bestiary or the location (no legacy line exists: the Steppe is a new region).
//
// Patterns: WORLD's rule (unconditioned moves cycle top to bottom; a conditioned move replaces the next cycled move when its
// condition holds, first match top to bottom) as one first-match `if` chain evaluated on every turn (`firstOf`), two cycled
// moves alternating by the creature's own turn (`alternate`) — U45's form, which keeps every `everyNthTurn` cadence (D-092).
// Readings (each repeated at its move; listed in the U46 reply):
//   - a low-HP self-move with no "once" (the Cinderback's Rekindle, the Stalker's Wade) waits while its own effect still
//     stands (`not selfHas`), as U45's self-Rewind and the Reach's Eddy do: otherwise it would repeat every turn and the
//     creature would never strike;
//   - the Cinderback's Stampede "misses entirely if you Guard" (WORLD §3.7): the move's `missesIfGuarded` (U34e, D-094);
//   - Ashmaw's Phase 3 "armor is 0 for the rest of the fight": no field sets a creature's armor mid-fight (a phase's
//     `onEnter` has no stat atom, and Armor Break would zero the ward too and add 15 %), so the phase takes `damageTakenMult`,
//     the reference arithmetic of D-067.20 inverted: 38.4 expected physical damage a round against armor 6 is 32.4 a round
//     through it, 38.4 / 32.4 = 1.185 without it (the Contained Tyrant's ×1.5 phase is the field's precedent, D-068.3);
//   - Ashmaw's Grief (`ifHpBelow:15`, once, "no action") is the creature's `hpLines` with the move (U34e, D-094): the moment its
//     HP falls under 15 % its next action is the Grief, whatever the Stampede's cadence.
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

// ---- cr_salt_jackal — Wilds (Steppe) · L7 fodder · XP 135 (WORLD §6.2) ------------------------------------------------------
const saltJackal = {
  id: 'cr_salt_jackal',
  name: 'Salt Jackal',
  description: 'Jackals the colour of the salt run in packs and are not seen until they are heard.',
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'fodder',
  level: 7,
  stats: { hp: 74, atk: 15, sp: 15, armor: 2, ward: 1, agi: 10 },
  tags: ['pack'],
  resistances: { storm: 'weak', fire: 'resist' },
  moves: {
    jackal_harry: {
      name: 'Harry',
      line: 'The pack laughs together and spreads around you.',
      type: 'physical',
      power: { coef: 0.6, stat: 'atk' },
      statuses: [{ status: 'status_mark', chance: 1, duration: 2 }],
    },
    jackal_snap: {
      name: 'Snap',
      line: 'A salt-white shape darts in low at your heel.',
      type: 'physical',
      power: { coef: 0.9, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.3, duration: 3 }],
    },
    jackal_pull_down: { name: 'Pull Down', line: 'They all look at the same leg.', type: 'physical', power: { coef: 1.4, stat: 'atk' } },
    // "leaves combat (no loot)": the move's `leaveCombat` (a withdrawn creature pays nothing, combat/rewards.ts)
    jackal_scatter: { name: 'Scatter', line: 'It yelps and runs for the glare.', leaveCombat: true },
  },
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'jackal_harry', target: 'player' }],
        [{ targetHas: 'status_mark' }, { move: 'jackal_pull_down', target: 'player' }],
        [{ hpBelow: 0.25 }, { move: 'jackal_scatter', target: 'self' }],
      ],
      { move: 'jackal_snap', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_steppe_salt', chance: 0.6 },
    { itemId: 'mat_wildling_hide', chance: 0.4 },
  ],
  gold: { min: 17, max: 27 },
  xp: 135,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "I hear them before I see them, and at noon on the Pan I don't see them at all. One marks me; the rest go for whatever is marked. Kill the first one that laughs. Hurt one badly and it runs into the white, which is fine, because I wasn't going to find it.",
    tactics: 'Clear Mark or Guard when the pack converges; Storm across the pack.',
    codexId: 'codex_creatures_wilds',
    reveals: [...REVEALS],
  },
  sigil: { base: 'triangle', details: ['salt_white', 'pack'] },
} satisfies CreatureInput;

// ---- cr_cinderback — Wilds (Steppe) · L8 elite · XP 290 (WORLD §6.2; stampede WORLD §3.7) -----------------------------------
const cinderback = {
  id: 'cr_cinderback',
  name: 'Cinderback',
  description: 'A bull of the old herds that never finished burning: ash for a hide, coals along the spine.',
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'elite',
  level: 8,
  stats: { hp: 200, atk: 17, sp: 17, armor: 5, ward: 2, agi: 3 },
  tags: ['herd'],
  resistances: { storm: 'weak', fire: 'resist' },
  statusImmunities: ['status_burn'],
  moves: {
    // "misses entirely if you Guard" (see the header)
    cinder_stampede: {
      name: 'Stampede',
      line: 'The ground shakes. It lowers a burning head at you.',
      type: 'fire',
      power: { coef: 2.0, stat: 'sp' },
      statuses: [{ status: 'status_burn', chance: 0.6, duration: 3 }],
      missesIfGuarded: true,
    },
    cinder_hook: {
      name: 'Hook',
      line: 'It swings a horn wreathed in coals.',
      type: 'physical',
      power: { coef: 1.1, stat: 'atk' },
      statuses: [{ status: 'status_armor_break', chance: 0.3, duration: 2 }],
    },
    cinder_shake: {
      name: 'Shake',
      line: 'It shakes, and ash pours off its back.',
      type: 'fire',
      power: { coef: 0.5, stat: 'sp' },
      statuses: [{ status: 'status_blind', chance: 0.4, duration: 1 }],
    },
    cinder_rekindle: { name: 'Rekindle', line: 'The coals along its spine flare white.', shield: { power: { coef: 1.0, stat: 'atk' } } },
    cinder_paw: {
      name: 'Paw',
      line: 'It backs off, pawing the ash, eyes on you.',
      type: 'fire',
      power: { coef: 1.8, stat: 'sp' },
      statuses: [{ status: 'status_burn', chance: 0.6, duration: 3 }],
    },
  },
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'cinder_stampede', target: 'player' }],
        [hurtAndWithout(0.5, 'status_shield'), { move: 'cinder_rekindle', target: 'self' }],
        [{ everyNth: 4 }, { move: 'cinder_paw', target: 'player' }],
      ],
      alternate({ move: 'cinder_hook', target: 'player' }, { move: 'cinder_shake', target: 'all' }),
    ),
  ],
  loot: [
    { itemId: 'mat_cinder_horn' }, // "100 %"; † = a material WORLD introduced and DESIGN §8.2 adopted (C-42)
    { itemId: 'mat_ember_ore', chance: 0.4 },
    { itemId: 'mat_wildling_hide', chance: 0.6 },
  ],
  gold: { min: 38, max: 60 },
  xp: 290,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'The herds died standing, most of them. Some of the stone bison in the Orchard are warm. A Cinderback is a bull of the old herds that never finished burning: ash for a hide, coals along the spine. It charges once to say hello. Guard, and it goes past. Lightning makes it shy. Fire feeds it.',
    tactics: 'Guard turn one, and every fourth turn; Storm Jars from the Cairns.',
    codexId: 'codex_creatures_wilds',
    reveals: [...REVEALS],
  },
  sigil: { base: 'triangle', details: ['coal_spine', 'double_outline'] },
} satisfies CreatureInput;

// ---- cr_reed_stalker — Green · L9 fodder · XP 189 (WORLD §6.6) --------------------------------------------------------------
const reedStalker = {
  id: 'cr_reed_stalker',
  name: 'Reed Stalker',
  description: "A grey-green wader twice a man's height, all neck and patience.",
  family: 'fam_green',
  materialKin: 'mireling',
  role: 'fodder',
  level: 9,
  stats: { hp: 112, atk: 18, sp: 18, armor: 3, ward: 2, agi: 10 },
  tags: ['wader'],
  resistances: { fire: 'weak', ley: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    reed_still: { name: 'Still', line: 'The reeds stop moving. One of them is watching you.', statuses: [{ status: 'status_phase', duration: 1, target: 'self' }] },
    reed_spear: {
      name: 'Spear',
      line: 'A beak like a reed-knife darts at your eye.',
      type: 'physical',
      power: { coef: 1.2, stat: 'atk' },
      statuses: [{ status: 'status_blind', chance: 0.3, duration: 1 }],
    },
    // "2 hits × 0.7× you"
    reed_twice: {
      name: 'Twice',
      line: 'It cocks its head twice.',
      type: 'physical',
      power: { coef: 0.7, stat: 'atk', hits: 2 },
      statuses: [{ status: 'status_bleed', chance: 0.3, duration: 2 }],
    },
    // "regen self 0.3×/3": 0.3 × ATK a turn for 3 turns, as the Mireling's Breathe In
    reed_wade: {
      name: 'Wade',
      line: 'It steps back into the reeds, slow and patient.',
      statuses: [{ status: 'status_regen', duration: 3, target: 'self', power: { coef: 0.3, stat: 'atk' } }],
    },
  },
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'reed_still', target: 'self' }],
        [{ everyNth: 3 }, { move: 'reed_twice', target: 'player' }],
        [hurtAndWithout(0.5, 'status_regen'), { move: 'reed_wade', target: 'self' }],
      ],
      { move: 'reed_spear', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_ley_resin', chance: 0.4 },
    { itemId: 'mat_glow_gland', chance: 0.3 },
  ],
  gold: { min: 21, max: 33 },
  xp: 189,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 490. A grey-green wader twice a man's height, all neck and patience. It stands in the reeds at the Reedmarch where Glowfen baskets meet Nomad salt, and has never taken either. It takes the people who come for them. The Glowfen say it was a fisherman's heron once. It still fishes.",
    tactics: 'Hold the opener until its Phase drops; fire; Guard the double strike.',
    codexId: 'codex_creatures_green',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_lit', details: ['long_neck'] },
} satisfies CreatureInput;

// ---- cr_ashmaw — Wilds (Steppe) · L13 boss · XP 720 (WORLD §6.2; HP D-067.20: 12 × (38.4 − 6 armor) = 389, WORLD prints 390) ---
// The Steppe's regional boss (band top 11 + 2). Cannot be fled. The bypass is the Grave's (locations.ts): with
// `echo_dreyl_brand` the player breaks the brand-stone and the encounter is skipped. Phase 1 opens with two jackals ("They
// come for the leavings."). The hidden Paw winds up into the Stampede (the Warden's Lift and Great Toll form); the Stampede
// is also a plain move in Phase 3 ("no wind-up"), where it is visible: WORLD gives it no telegraph, so one is written here.
const ashmaw = {
  id: 'cr_ashmaw',
  name: 'Ashmaw',
  description: 'The herd that did not turn to stone. It burned, and kept burning, and learned to move as one.',
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'boss',
  level: 13,
  stats: { hp: 390, atk: 25, sp: 25, armor: 6, ward: 3, agi: 6 },
  tags: ['regional_boss', 'herd'],
  resistances: { storm: 'weak', fire: 'immune' },
  statusImmunities: ['status_burn', 'status_stun'],
  interruptible: true, // "Stagger allowed"
  fleeable: false,
  // `ifHpBelow:15` · once · "no action": the Grief takes its next turn the moment its HP falls under 15 % (U34e, D-094)
  hpLines: [{ below: 0.15, move: 'ashmaw_grief' }],
  moves: {
    ashmaw_breathe: {
      name: 'Breathe',
      line: 'The ash in the bowl rises and falls toward you.',
      type: 'fire',
      power: { coef: 0.7, stat: 'sp' },
      statuses: [{ status: 'status_blind', chance: 0.4, duration: 1 }],
    },
    ashmaw_shoulder: {
      name: 'Shoulder',
      line: 'A hill of ash turns over. A shoulder comes at you.',
      type: 'physical',
      power: { coef: 1.3, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.4, duration: 2 }],
    },
    ashmaw_low: {
      name: 'Low',
      line: 'Something under the ash lows with a hundred throats.',
      statuses: [{ status: 'status_weaken', chance: 0.6, duration: 2 }],
    },
    ashmaw_paw: { name: 'Paw', line: 'The bowl shakes. Every burning head lowers at you.', hidden: true, windUp: { turns: 1, then: 'ashmaw_stampede' } },
    ashmaw_stampede: {
      name: 'Stampede',
      line: 'The herd comes down on you as one.',
      type: 'fire',
      power: { coef: 2.2, stat: 'sp' },
      statuses: [{ status: 'status_burn', chance: 0.8, duration: 3 }],
    },
    ashmaw_gore: { name: 'Gore', line: 'Horns in a row, like a fence, coming.', type: 'physical', power: { coef: 1.2, stat: 'atk' } },
    ashmaw_brand_flare: {
      name: 'Brand Flare',
      line: 'The ring-brand flares. The air between you catches.',
      type: 'fire',
      power: { coef: 1.0, stat: 'sp' },
      statuses: [{ status: 'status_burn', chance: 1, duration: 3 }],
    },
    ashmaw_grief: { name: 'Grief', line: 'It stops. It lows for the calves that were not left.' },
  },
  phases: [
    {
      id: 'ashmaw_the_herd_sleeps',
      name: 'The Herd Sleeps',
      // 100–70 %; onEnter: 2× cr_salt_jackal, "They come for the leavings."
      line: 'They come for the leavings.',
      adds: [{ creatureId: 'cr_salt_jackal', count: 2 }],
      pattern: [firstOf([[{ everyNth: 3 }, { move: 'ashmaw_low', target: 'all' }]], alternate({ move: 'ashmaw_breathe', target: 'all' }, { move: 'ashmaw_shoulder', target: 'player' }))],
    },
    {
      id: 'ashmaw_the_herd_wakes',
      name: 'The Herd Wakes',
      enterWhen: [{ hpBelow: 0.7 }],
      line: 'The ash slides off. Under it, a hundred backs, burning, turn the same way at once.',
      pattern: [firstOf([[{ everyNth: 3 }, { move: 'ashmaw_paw', target: 'player' }]], alternate({ move: 'ashmaw_gore', target: 'all' }, { move: 'ashmaw_breathe', target: 'all' }))],
    },
    {
      id: 'ashmaw_one_animal',
      name: 'One Animal',
      enterWhen: [{ hpBelow: 0.35 }],
      line: "The brand on its flank, a flame inside a ring, burns brighter than the rest. Dreyl's mark.",
      // "its armor is 0 for the rest of the fight": see the header
      damageTakenMult: 1.185,
      // `ifHpBelow:15` · once → the Grief: the creature's `hpLines` (see the header)
      pattern: [firstOf([[{ everyNth: 2 }, { move: 'ashmaw_stampede', target: 'player' }]], { move: 'ashmaw_brand_flare', target: 'all' })],
    },
  ],
  loot: [
    { itemId: 'item_cinder_heart' },
    { itemId: 'mat_cinder_horn', count: 3 },
    { itemId: 'mat_ember_ore', count: 3 },
    // The Grave's block lists the ledger as "100 % first clear" and the creature block does not: the fight pays it here (the
    // bypass's share is placed at the location); "first clear" at the profile level is the item unit's
    { itemId: 'item_dreyls_pyre_ledger' },
  ],
  gold: { min: 135, max: 210 },
  xp: 720,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 9, a Nomad report, copied. The herd in the deep bowl did not turn to stone. Corvin Dreyl's pyre-ward was built to shield the city; in the Sundering it faced outward, burned the plains in a day, and branded what it burned. This herd burned and kept burning, and learned to move as one. The Nomads call it Ashmaw and leave it the first calf of every spring.",
    tactics: 'Kill the jackals first. Storm Jars and Storm abilities. Guard every Stampede. In Phase 3 its armor is gone: spend everything physical.',
    codexId: 'codex_creatures_wilds',
    reveals: [...REVEALS],
  },
  sigil: { base: 'triangle', details: ['ring_brand', 'segmented_ring', 'double_outline'] },
} satisfies CreatureInput;

/** WORLD §6 order: the Salt Jackal (§6.2), the Cinderback, Ashmaw; the Reed Stalker (§6.6). */
export const creatures = [saltJackal, cinderback, ashmaw, reedStalker] satisfies CreatureInput[];
