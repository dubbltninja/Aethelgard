// The Voidscar — the creatures whose first region (WORLD §6's Regions column) is the Voidscar (D-090): the Void-Touched
// Stalker (Hollowed, §6.1) and the Veil Sentry (Mortal, §6.9). XP per WORLD §6 table / DESIGN §6.2; families WORLD §5; rules
// DESIGN §4.2, §4.4–4.6.
//
// Conventions are U42's and U45's (silverwood_ruins/creatures.ts and glowlands_nexus/creatures.ts headers): stats `HP · ATK ·
// DEF armor/ward · AGI` with SP = ATK, non-physical moves scaling on SP; WORLD's intent line id for id, the telegraph
// verbatim; a move's type is the creature's primary type unless the line names one; `all` = area, `you` = player; loot
// rows in WORLD's order; bestiary and tactics WORLD's text verbatim (markdown and decision references dropped); `legacyName`
// on the legacy record; a `description` where no legacy line exists is a sentence drawn from the bestiary. Patterns are U45's:
// WORLD's first-match rule as one step evaluated every turn (`firstOf`), two cycled moves alternating by the creature's own
// turn (`alternate`); tests/unit/content/regions/voidscar.test.ts walks them turn by turn.
//
// Readings the schema forces (each is repeated at its move):
//   - the Sentry is a Mortal: WORLD §5 gives Mortals "no sigil; a portrait", but a creature record carries a sigil, so its
//     base is `portrait`; its family id is `fam_mortal` (REGISTRY: `fam_<family>`, WORLD §6's "Mortal"); no family codex
//     entry exists for it (STORY §14 lists the eight families), so it has no `codexId`;
//   - "ifAllyDown" (an ally died this fight) is the `allyDown` atom (U34e, D-094; it was `allyCountBelow: 1`).
import type { CombatWhen, CreatureInput, Step } from '@schema/creature';

const REVEALS = [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] as const;

/** WORLD's first-match rule as one step: `[condition, step]` pairs top to bottom, then `otherwise` (the cycled move). */
function firstOf(conditioned: readonly (readonly [CombatWhen, Step])[], otherwise: Step): Step {
  return conditioned.reduceRight<Step>((rest, [when, step]) => ({ if: when, then: [step], else: [rest] }), otherwise);
}

/** Two cycled moves: the first on the creature's odd turns, the second on its even turns. */
const alternate = (odd: Step, even: Step): Step => ({ if: { everyNth: 2 }, then: [even], else: [odd] });

// ---- cr_void_touched_stalker — Hollowed (Void) · L6 fodder · XP 111 · legacy (WORLD §6.1) ------------------------------------
const voidTouchedStalker = {
  id: 'cr_void_touched_stalker',
  name: 'Void-Touched Stalker',
  legacyName: 'Void-Touched Stalker',
  description: 'A predator born of corrupted ley echoes, eyes like cold stars.',
  family: 'fam_hollowed',
  materialKin: 'void_touched',
  role: 'fodder',
  level: 6,
  // legacy: HP 40 · dmg 9 · def 2 · agi 6 · XP 55
  stats: { hp: 76, atk: 14, sp: 14, armor: 2, ward: 2, agi: 8 },
  tags: ['breach_born', 'legacy'],
  resistances: { ley: 'weak', void: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    stalker_circle: {
      name: 'Circle',
      line: 'It slips out of sight between two moments.',
      statuses: [{ status: 'status_phase', duration: 1, target: 'self' }],
    },
    stalker_lunge: {
      name: 'Lunge',
      line: 'Cold starlight narrows on your throat.',
      type: 'physical',
      power: { coef: 1.1, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.4, duration: 3 }],
    },
    stalker_starbite: {
      name: 'Starbite',
      line: 'Its eyes flare; the cold reaches you first.',
      type: 'void',
      power: { coef: 0.9, stat: 'sp' },
      statuses: [{ status: 'status_curse', chance: 0.4, duration: 3 }],
    },
    stalker_pounce: {
      name: 'Pounce',
      line: 'It crouches low, all its weight on the back legs.',
      type: 'physical',
      power: { coef: 1.5, stat: 'atk' },
    },
  },
  // `first` → the Circle; `ifTargetHas:curse` → the Pounce; the Lunge and the Starbite are the cycled moves
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'stalker_circle', target: 'self' }],
        [{ targetHas: 'status_curse' }, { move: 'stalker_pounce', target: 'player' }],
      ],
      alternate({ move: 'stalker_lunge', target: 'player' }, { move: 'stalker_starbite', target: 'player' }),
    ),
  ],
  loot: [
    { itemId: 'item_void_shard' }, // legacy, 100 % (DESIGN §8.2)
    { itemId: 'item_warriors_sword', chance: 0.25 }, // legacy bonus loot
    { itemId: 'item_chasmglass_focus', chance: 0.1 },
  ],
  gold: { min: 15, max: 24 },
  xp: 111,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Three in the Hollow, always three. They open by vanishing, so my first swing hits air. Wait it out. The pounce only comes after the cold gets into me. Clean the Curse with Ley and the pounce never comes. Each one carries a shard behind the eyes. Nyx wants them. So does Borin.',
    tactics: 'Guard or buff on turn one; answer every Curse with a Ley hit (removes it, ×1.25).',
    codexId: 'codex_creatures_hollowed',
    reveals: [...REVEALS],
  },
  sigil: { base: 'teardrop', details: ['starlit_eyes'] },
} satisfies CreatureInput;

// ---- cr_veil_sentry — Mortal (Weaver) · L10 fodder · XP 220 (WORLD §6.9) ---------------------------------------------------
const veilSentry = {
  id: 'cr_veil_sentry',
  name: 'Veil Sentry',
  description: 'A Weaver in grey thread, counting you in or out.',
  family: 'fam_mortal',
  role: 'fodder',
  level: 10,
  stats: { hp: 120, atk: 20, sp: 20, armor: 2, ward: 5, agi: 9 },
  tags: ['mortal', 'weaver'],
  // WORLD: "resist void · statuses work normally"
  resistances: { void: 'resist' },
  moves: {
    sentry_count: {
      name: 'Count',
      line: "'One,' she says. The thread at your wrist tightens.",
      type: 'void',
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.5, duration: 2 }],
    },
    sentry_thread_cut: {
      name: 'Thread Cut',
      line: 'A grey thread snaps taut across your path.',
      type: 'void',
      power: { coef: 1.1, stat: 'sp' },
      statuses: [{ status: 'status_bleed', chance: 0.4, duration: 3 }],
    },
    sentry_unsee: {
      name: 'Unsee',
      line: 'She steps sideways out of being seen.',
      statuses: [{ status: 'status_phase', duration: 1, target: 'self' }],
    },
    sentry_call_the_choir: {
      name: 'Call the Choir',
      line: 'She hums one note. The dark answers.',
      type: 'void',
      power: { coef: 0.4, stat: 'sp' },
      statuses: [{ status: 'status_curse', chance: 0.6, duration: 3 }],
    },
    // "leaves combat": the move's `leaveCombat` flag (D-069.9), as U45's Tyrant's Reach
    sentry_withdraw: { name: 'Withdraw', line: 'She cuts her own thread and is gone.', leaveCombat: true },
  },
  // WORLD's priority order, top to bottom: `first` → Count; `everyNthTurn:3` → Unsee; `ifAllyDown` → the Choir (U34e,
  // D-094: `allyDown`); `ifHpBelow:25` → Withdraw; else the Thread Cut (the only cycled move)
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'sentry_count', target: 'player' }],
        [{ everyNth: 3 }, { move: 'sentry_unsee', target: 'self' }],
        [{ allyDown: true }, { move: 'sentry_call_the_choir', target: 'all' }],
        [{ hpBelow: 0.25 }, { move: 'sentry_withdraw', target: 'self' }],
      ],
      { move: 'sentry_thread_cut', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_umbral_thread', chance: 0.4 },
    { itemId: 'item_void_shard', chance: 0.15 },
  ],
  gold: { min: 23, max: 36 },
  xp: 220,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Two Weavers in grey thread at the Veil Mouth, counting. When the Weavers trust me they count me in. When they don't, they count me out, with thread. They fight like people who would rather be elsewhere: careful, quick, gone when hurt.",
    tactics: "Ley after the Choir's Curse; let the wounded one go. Better: be Neutral with the Weavers.",
    reveals: [...REVEALS],
  },
  sigil: { base: 'portrait', details: ['grey_thread'] },
} satisfies CreatureInput;

// ==== Anomaly variants (U34e; WORLD §10.2, DESIGN §6.6; D-087, D-091 gap 4) ===============================================
// Each twists a creature of this region: its numbers and gold (the base's, unless the twist changes them), WORLD §10.2's
// twist, XP ×1.3 of the base's, the guaranteed material as its loot (`mat_frayed_moment`, the material WORLD §6.8 calls
// "anomaly guaranteed"), and its `anomaly` spawn (region, Loop, count). The engine reads the twist tags named at each
// record (reducers/combat.ts header). Bestiary entries are the Wayfinder's notes on the twist (WORLD §10.2 gives the twist
// only).
// ---- cr_anomaly_phase_stalker — Hollowed (Void) · L6 anomaly, Loop 2+ · XP 144 ("Phased on even turns; Void damage still lands")
// Its even-turn move Phases it as it bites; the `void_lands` tag lets Void through the Phase (combat/damage.ts `phaseEvades`).
const phaseStalker = {
  id: 'cr_anomaly_phase_stalker',
  name: 'Phase Stalker',
  description: 'A Stalker that is only half here on every other step.',
  family: 'fam_hollowed',
  materialKin: 'void_touched',
  role: 'anomaly',
  level: 6,
  stats: voidTouchedStalker.stats,
  tags: ['breach_born', 'anomaly', 'void_lands'],
  resistances: voidTouchedStalker.resistances,
  statusImmunities: voidTouchedStalker.statusImmunities,
  moves: {
    ...voidTouchedStalker.moves,
    phase_half_here: {
      ...voidTouchedStalker.moves.stalker_starbite,
      name: 'Half Here',
      line: 'It bites from a moment it is only half in.',
      statuses: [...voidTouchedStalker.moves.stalker_starbite.statuses, { status: 'status_phase', duration: 1, target: 'self' }],
    },
  },
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'stalker_circle', target: 'self' }],
        [{ targetHas: 'status_curse' }, { move: 'stalker_pounce', target: 'player' }],
      ],
      alternate({ move: 'stalker_lunge', target: 'player' }, { move: 'phase_half_here', target: 'player' }),
    ),
  ],
  loot: [{ itemId: 'mat_frayed_moment' }], // DESIGN §6.6: the anomaly's guaranteed material drop (WORLD §10.2 lists no other)
  gold: voidTouchedStalker.gold,
  xp: 144,
  anomaly: { region: 'region_voidscar', loop: 2 },
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Loop 2. This one is only here every other moment. On its even turns it bites and is gone before the blow comes. Void still finds it there; nothing else does.',
    tactics: 'Void through the Phase, or hold the heavy hit for its odd turns; Ley clears the Curse.',
    codexId: 'codex_creatures_hollowed',
    reveals: [...REVEALS],
  },
  sigil: { base: 'teardrop', details: ['starlit_eyes', 'double_outline'] },
} satisfies CreatureInput;

// ---- cr_anomaly_tethered_stalkers — Hollowed (Void) · L6 anomaly ×2, Loop 3+ · XP 144 each ("Damage to one is split between both")
// The `tethered` tag: half of each blow (rounded down) goes to the living twin (reducers/combat.ts `applyHit`).
const tetheredStalkers = {
  id: 'cr_anomaly_tethered_stalkers',
  name: 'Tethered Stalker',
  description: 'Two Stalkers on one line of cold; what wounds one, the other shares.',
  family: 'fam_hollowed',
  materialKin: 'void_touched',
  role: 'anomaly',
  level: 6,
  stats: voidTouchedStalker.stats,
  tags: ['breach_born', 'anomaly', 'tethered'],
  resistances: voidTouchedStalker.resistances,
  statusImmunities: voidTouchedStalker.statusImmunities,
  moves: voidTouchedStalker.moves,
  pattern: voidTouchedStalker.pattern,
  loot: [{ itemId: 'mat_frayed_moment' }], // DESIGN §6.6: the anomaly's guaranteed material drop (WORLD §10.2 lists no other)
  gold: voidTouchedStalker.gold,
  xp: 144,
  anomaly: { region: 'region_voidscar', loop: 3, count: 2 },
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Loop 3. Two Stalkers tied by a cord of cold I can see only from the side. Whatever I do to one, the other takes half. They die together or not at all.',
    tactics: 'Half of every blow crosses the tether, so area attacks pay twice; Ley for the Curse.',
    codexId: 'codex_creatures_hollowed',
    reveals: [...REVEALS],
  },
  sigil: { base: 'teardrop', details: ['starlit_eyes', 'tether'] },
} satisfies CreatureInput;

export const creatures = [voidTouchedStalker, veilSentry, phaseStalker, tetheredStalkers] satisfies CreatureInput[];
