// The Veil — the creatures whose first region (WORLD §6's Regions column) is the Veil (D-090): the Hollow Lantern and the Null
// Mouth (fodder), the Starved Shadow (elite) and the regional boss, Vell's Umbra (the Hollowed, WORLD §6.1; XP WORLD §6 table /
// DESIGN §6.2; families WORLD §5; rules DESIGN §4.2–4.6, §4.10). The Void-Touched Stalker and the Veil Sentry are the Voidscar's
// (first region, U44), the Redundant Wayfinder the Ruins' (U42): the Veil's Gallery and Shelf place them by reference.
//
// Conventions are U42's, U45's and the Reach's (silverwood_ruins/creatures.ts, glowlands_nexus/creatures.ts and
// drowned_reach/creatures.ts headers): stats `HP · ATK · DEF armor/ward · AGI`, SP = ATK unless WORLD gives one (none here),
// non-physical moves scale on SP; a move's type is the creature's primary type unless the line names one; `all` = area,
// `you` = player, `ally` = the lowest-HP ally; the `breach_born` tag is Poison-immune (written out); loot rows in WORLD's
// order; bestiary and tactics WORLD's text verbatim (backticks, asterisks and decision references dropped); `description` a
// sentence from the bestiary or the location (no legacy line exists: the Veil is a new region).
//
// Patterns: WORLD's rule (unconditioned moves cycle top to bottom; a conditioned move replaces the next cycled move when its
// condition holds, first match top to bottom) as one first-match `if` chain evaluated on every turn (`firstOf`), two cycled
// moves alternating by the creature's own turn (`alternate`) — U45's form, which keeps every `everyNthTurn` cadence (D-092).
// Readings (each repeated at its move; listed in the U47 reply):
//   - "ifAllyPresent" is the Lantern's only conditioned move (Shelter): by WORLD's rule it replaces the cycled move for as long
//     as an ally lives, so a pair of Lanterns shields each other until one falls;
//   - "heal self … (consumes one lantern)" (the Umbra's Cling): the heal waits on a living Hollow Lantern (`allyPresent:
//     'cr_hollow_lantern'`) and the move's `consumesAlly` takes it (U34e, D-096: no XP, not a kill);
//   - "Haste self every turn" (Phase 3): a status row `target: 'self'` on each move the Umbra makes in Phase 3; the shared Her
//     Hand carries it `when` the Umbra's own HP is below the Phase 3 threshold (a Cling heal above it drops Her Hand's Haste
//     until the next Fall or Cling, which carry it unconditionally);
//   - the Starved Shadow's Hunger "1.8× highest-MAG target" is the `highest_mag` target rule; Open (hidden) is a plain hidden
//     move, no wind-up (WORLD gives none).
// Phase 1 is skipped "if `{killed:"cr_vells_umbra"}` in any earlier loop": the `killed` atom's `anyLoop` (U34e, D-096) reads
// the profile's kills of it in every loop.
// "Plain steel now lands in full" (the tactics note) needs nothing: the stat block lists no physical resistance, so physical
// damage is neutral.
import type { CombatWhen, CreatureInput, Step } from '@schema/creature';

const REVEALS = [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] as const;

/** WORLD's first-match rule as one step: `[condition, step]` pairs top to bottom, then `otherwise` (the cycled move). */
function firstOf(conditioned: readonly (readonly [CombatWhen, Step])[], otherwise: Step): Step {
  return conditioned.reduceRight<Step>((rest, [when, step]) => ({ if: when, then: [step], else: [rest] }), otherwise);
}

/** Two cycled moves: the first on the creature's odd turns, the second on its even turns. */
const alternate = (odd: Step, even: Step): Step => ({ if: { everyNth: 2 }, then: [even], else: [odd] });


// ---- cr_hollow_lantern — Hollowed (Void) · L10 fodder · XP 220 (WORLD §6.1) ------------------------------------------------
const hollowLantern = {
  id: 'cr_hollow_lantern',
  name: 'Hollow Lantern',
  description: 'A Weaver lantern that holds dark the way ours hold flame. A few got loose, and they float at the Veil Mouth and wait for anything bright.',
  family: 'fam_hollowed',
  materialKin: 'void_touched',
  role: 'fodder',
  level: 10,
  stats: { hp: 110, atk: 20, sp: 20, armor: 0, ward: 5, agi: 8 },
  tags: ['breach_born', 'umbra_add'],
  resistances: { physical: 'weak', ley: 'weak', void: 'resist', fire: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    lantern_gutter: {
      name: 'Gutter',
      line: 'Its glass goes black. Your light bends toward it.',
      type: 'void',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_blind', chance: 0.4, duration: 2 }],
    },
    // "heals self for 50 % of damage dealt"
    lantern_drink: {
      name: 'Drink',
      line: 'It drinks the light out of your wounds.',
      type: 'void',
      power: { coef: 1.0, stat: 'sp' },
      effects: [{ healOnDamage: { pct: 0.5 } }],
    },
    // "shield ally 1.2×" (× ATK, WORLD's convention)
    lantern_shelter: { name: 'Shelter', line: 'It draws its dark around another.', shieldAlly: { power: { coef: 1.2, stat: 'atk' } } },
  },
  pattern: [
    firstOf([[{ allyPresent: true }, { move: 'lantern_shelter', target: 'ally' }]], alternate({ move: 'lantern_gutter', target: 'player' }, { move: 'lantern_drink', target: 'player' })),
  ],
  loot: [
    { itemId: 'mat_shadow_ash', chance: 0.6 },
    { itemId: 'mat_breach_glass', chance: 0.25 },
    { itemId: 'item_hollow_lantern_focus', chance: 0.1 },
  ],
  gold: { min: 23, max: 36 },
  xp: 220,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'The Weavers carry lanterns that hold dark the way ours hold flame. A few got loose. They float at the Veil Mouth and wait for anything bright. Break the glass and the dark goes back where it came from, which is everywhere.',
    tactics: 'Plain steel breaks the glass. Kill it before it Shelters something bigger.',
    codexId: 'codex_creatures_hollowed',
    reveals: [...REVEALS],
  },
  sigil: { base: 'teardrop', details: ['lantern_glass'] },
} satisfies CreatureInput;

// ---- cr_null_mouth — Hollowed (Void) · L12 fodder · XP 289 (WORLD §6.1) ----------------------------------------------------
const nullMouth = {
  id: 'cr_null_mouth',
  name: 'Null Mouth',
  description: "A mouth with no head attached, roughly round, roughly a man's height.",
  family: 'fam_hollowed',
  materialKin: 'void_touched',
  role: 'fodder',
  level: 12,
  stats: { hp: 140, atk: 23, sp: 23, armor: 3, ward: 4, agi: 4 },
  tags: ['breach_born'],
  resistances: { ley: 'weak', chrono: 'weak', void: 'resist', physical: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    // "(Void: destroys Shield)": Void damage destroys a Shield outright (DESIGN §4.5), so the Bite is a plain Void hit
    null_bite: { name: 'Bite', line: 'Its edge opens toward your shield arm.', type: 'void', power: { coef: 1.2, stat: 'sp' } },
    // "strips your shield, regen, haste, rewind": the combat-scope stripBuffs on the struck target (D-069.9)
    null_unmake: {
      name: 'Unmake',
      line: 'It swallows something of yours you were relying on.',
      type: 'void',
      power: { coef: 0.5, stat: 'sp' },
      effects: [{ stripBuffs: { kinds: ['shield', 'regen', 'haste', 'rewind'] } }],
    },
    null_gape: {
      name: 'Gape',
      line: 'It opens wide enough to step into.',
      type: 'void',
      power: { coef: 1.2, stat: 'sp' }, // U81b2: was 1.6 (two at the Orchard: 88 % deaths at L10, band 10-11)
      statuses: [{ status: 'status_weaken', chance: 0.5, duration: 2 }],
    },
    // "regen self 0.4×/3": 0.4 × ATK a turn for 3 turns, as the Mireling's Breathe In
    null_fill: {
      name: 'Fill',
      line: 'It closes on nothing and is briefly less hungry.',
      statuses: [{ status: 'status_regen', duration: 3, target: 'self', power: { coef: 0.4, stat: 'atk' } }],
    },
  },
  // `everyNthTurn:3` → the Gape; `ifHpBelow:40` → the Fill, which waits while its own Regen runs (no "once": otherwise it would
  // repeat every turn and the creature would never strike, as the Reach's Eddy); the Bite and the Unmake are the cycled moves
  pattern: [
    firstOf(
      [
        [{ everyNth: 3 }, { move: 'null_gape', target: 'player' }],
        [{ all: [{ hpBelow: 0.4 }, { not: { selfHas: 'status_regen' } }] }, { move: 'null_fill', target: 'self' }],
      ],
      alternate({ move: 'null_bite', target: 'player' }, { move: 'null_unmake', target: 'player' }),
    ),
  ],
  loot: [
    { itemId: 'mat_breach_glass', chance: 0.4 },
    { itemId: 'item_void_shard', chance: 0.25 },
    { itemId: 'mat_umbral_thread', chance: 0.3 },
  ],
  gold: { min: 27, max: 42 },
  xp: 289,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 488, the Null Orchard. A mouth with no head attached, roughly round, roughly a man's height. It eats what holds you together for the length of a fight: wards, regrowth, borrowed speed. It does not eat flesh. The Weavers call it the orchard's gardener. We did not ask what it prunes.",
    tactics: 'Do not pre-buff. Cast shields and regen after Unmake, not before. Chrono hits it hard.',
    codexId: 'codex_creatures_hollowed',
    reveals: [...REVEALS],
  },
  sigil: { base: 'teardrop', details: ['open_mouth'] },
} satisfies CreatureInput;

// ---- cr_starved_shadow — Hollowed (Shade) · L12 elite · XP 520 (WORLD §6.1) --------------------------------------------------
const starvedShadow = {
  id: 'cr_starved_shadow',
  name: 'Starved Shadow',
  description: 'A shadow that does not want you. It wants your light, and while you are blind it eats, and grows.',
  family: 'fam_hollowed',
  materialKin: 'shade',
  role: 'elite',
  level: 12,
  stats: { hp: 280, atk: 23, sp: 23, armor: 2, ward: 6, agi: 9 },
  tags: ['breach_born'],
  resistances: { fire: 'weak', ley: 'weak', void: 'resist', physical: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    starved_snuff: {
      name: 'Snuff',
      line: 'It leans over the light you carry and inhales.',
      type: 'void',
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_blind', chance: 0.6, duration: 2 }],
    },
    starved_gnaw: {
      name: 'Gnaw',
      line: 'It folds around your arm, mouth first.',
      type: 'void',
      power: { coef: 1.3, stat: 'sp' },
      statuses: [{ status: 'status_curse', chance: 0.5, duration: 3 }],
    },
    starved_feed: { name: 'Feed', line: 'It swallows the dark it made and swells.', heal: { power: { coef: 0.8, stat: 'atk' }, target: 'self' } }, // U81b2: was 1.5 (the Gallery: 85 % deaths, fights to 24 rounds)
    starved_hunger: { name: 'Hunger', line: 'It goes thin and fast toward the brightest thing here.', type: 'void', power: { coef: 1.8, stat: 'sp' } },
  },
  // `first` → the Snuff; `ifTargetHas:blind` → the Feed; `everyNthTurn:4` → the Hunger (the highest-MAG target); the Gnaw is the
  // only cycled move
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'starved_snuff', target: 'all' }],
        [{ targetHas: 'status_blind' }, { move: 'starved_feed', target: 'self' }],
        [{ everyNth: 4 }, { move: 'starved_hunger', target: 'highest_mag' }],
      ],
      { move: 'starved_gnaw', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_shadow_ash', count: 2 },
    { itemId: 'mat_breach_glass', chance: 0.3 },
    { itemId: 'item_dark_spellbook', chance: 0.25 },
  ],
  gold: { min: 54, max: 84 },
  xp: 520,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Blind on the first turn, every time, unless I carry the Hollow Lantern focus. It does not want me. It wants my light. While I'm blind it eats, and grows. Fire makes it flinch. Ley makes it remember it was a student. I don't know which is crueller.",
    tactics: 'Bring item_hollow_lantern_focus or a Blind cleanse so Feed never triggers; burst it with fire or ley; Guard on its fourth turn, especially as a caster.',
    codexId: 'codex_creatures_hollowed',
    reveals: [...REVEALS],
  },
  sigil: { base: 'teardrop', details: ['thin_figure', 'double_outline'] },
} satisfies CreatureInput;

// ---- cr_vells_umbra — Hollowed (Void) · L16 boss · XP 880 (WORLD §6.1; HP D-067.20: 12 × (42 − 2 armor) = 480) -----------------
// The Veil's regional boss (band 10–14 top + 2). Cannot be fled. The bypass is the Eye's (locations.ts): with Nyx active and
// `echo_nyx_is_of_the_nine` she calls it back and the encounter is skipped. Phase 1 is skipped when the Umbra has been killed
// (the fight then opens on Phase 2 with its line: the engine's `skipWhen`). Phase 2 opens with two Hollow Lanterns at full HP.
const vellsUmbra = {
  id: 'cr_vells_umbra',
  name: "Vell's Umbra",
  description: "A shadow no one casts, with Nyx's shoulders and her way of standing.",
  family: 'fam_hollowed',
  materialKin: 'void_touched',
  role: 'boss',
  level: 15, // U81b2 (D-137): band top + 2 (Eye of the Scar 10-13); was 16
  stats: { hp: 480, atk: 29, sp: 29, armor: 2, ward: 8, agi: 11 },
  tags: ['breach_born', 'regional_boss'],
  resistances: { ley: 'weak', fire: 'weak', void: 'resist' },
  statusImmunities: ['status_poison', 'status_blind'],
  interruptible: true, // "Stagger allowed"
  fleeable: false,
  moves: {
    // the Haste row: Phase 3's "Haste self every turn" (see the header). Her Hand is shared, so its Haste waits on the Umbra's
    // own HP being under the Phase 3 threshold
    umbra_her_hand: {
      name: 'Her Hand',
      line: "A woman's hand of shadow reaches for your face.",
      type: 'void',
      power: { coef: 1.0, stat: 'sp' },
      statuses: [
        { status: 'status_curse', chance: 0.5, duration: 3 },
        { status: 'status_haste', duration: 2, target: 'self', when: { hpBelow: 0.25 } },
      ],
    },
    umbra_name_the_dark: {
      name: 'Name the Dark',
      line: 'It says a word you almost hear. The room dims.',
      statuses: [{ status: 'status_blind', chance: 0.6, duration: 2 }],
    },
    umbra_open: {
      name: 'Open',
      line: "'Open,' it mouths, 'and be entered.'",
      type: 'void',
      power: { coef: 1.6, stat: 'sp' },
      hidden: true,
    },
    umbra_between: {
      name: 'Between',
      line: 'It steps into the gap between your heartbeats.',
      type: 'void',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_phase', duration: 1, target: 'self' }],
    },
    // "strips your shield": the combat-scope stripBuffs on the struck target (D-069.9)
    umbra_unname: {
      name: 'Unname',
      line: 'It takes back something it never gave you.',
      type: 'void',
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_weaken', chance: 1, duration: 2 }],
      effects: [{ stripBuffs: { kinds: ['shield'] } }],
    },
    umbra_fall: {
      name: 'Fall',
      line: 'It falls toward you from very far away.',
      type: 'void',
      power: { coef: 2.2, stat: 'sp' },
      hidden: true,
      statuses: [{ status: 'status_haste', duration: 2, target: 'self' }],
    },
    // "(consumes one lantern)": see the header
    umbra_cling: {
      name: 'Cling',
      line: 'It pulls a lantern into itself and darkens.',
      heal: { power: { coef: 2.0, stat: 'atk' }, target: 'self' },
      statuses: [{ status: 'status_haste', duration: 2, target: 'self' }],
      consumesAlly: 'cr_hollow_lantern', // U34e (D-096)
    },
  },
  phases: [
    {
      id: 'umbra_her_shape',
      name: 'Her Shape',
      // 100–60 %; skipped (the fight opens in Phase 2) if the Umbra was killed in an earlier loop (WORLD §2.9; U34e: `anyLoop`)
      skipWhen: { killed: { id: 'cr_vells_umbra', anyLoop: true } },
      pattern: [
        firstOf(
          [
            [{ everyNth: 3 }, { move: 'umbra_name_the_dark', target: 'all' }],
            [{ targetHas: 'status_blind' }, { move: 'umbra_open', target: 'player' }],
          ],
          { move: 'umbra_her_hand', target: 'player' },
        ),
      ],
    },
    {
      id: 'umbra_the_dark_between',
      name: 'The Dark Between',
      enterWhen: [{ hpBelow: 0.6 }],
      // onEnter: 2× cr_hollow_lantern at full HP
      adds: [{ creatureId: 'cr_hollow_lantern', count: 2 }],
      line: 'The shadow lets go of the floor. It is the whole room now, and it has stopped waiting.',
      pattern: [
        { move: 'umbra_between', target: 'all' },
        { move: 'umbra_unname', target: 'player' },
        { move: 'umbra_her_hand', target: 'player' },
      ],
    },
    {
      id: 'umbra_forty_years',
      name: 'Forty Years',
      enterWhen: [{ hpBelow: 0.25 }],
      line: "'Forty years,' says a voice that is almost Nyx's. 'I have been patient forty years.'",
      pattern: [
        firstOf(
          [
            [{ everyNth: 3 }, { move: 'umbra_fall', target: 'all' }],
            [{ allyPresent: 'cr_hollow_lantern' }, { move: 'umbra_cling', target: 'self' }],
          ],
          { move: 'umbra_her_hand', target: 'player' },
        ),
      ],
    },
  ],
  loot: [
    { itemId: 'item_umbral_mirror' },
    { itemId: 'mat_umbral_thread', count: 3 },
    { itemId: 'mat_breach_glass', count: 2 },
    { itemId: 'item_void_shard', count: 2, chance: 0.6 },
  ],
  gold: { min: 165, max: 255 },
  xp: 880,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "A shadow no one casts, with Nyx's shoulders and her way of standing. When Nyxaria Vell fell out of the year, her shadow stayed behind at the Eye. For forty years it has learned her shape from memory and got it slightly wrong. It wants her back. It will settle for something warm. When Nyx stands beside me and says her own name, it goes to her like a dog.",
    tactics:
      'Ley twice per Curse. Keep a Blind cleanse for the Open combo. Kill the lanterns before 25% or it eats them. In Phase 3, Guard every third turn; Chrono strips its Haste for a turn. Plain steel now lands in full. A Shadow Weaver Curses it first: against a Cursed target its Void treats resist void as neutral, and wvr_unravel is Chrono.',
    codexId: 'codex_creatures_hollowed',
    reveals: [...REVEALS],
  },
  sigil: { base: 'teardrop', details: ['woman_shape', 'segmented_ring', 'double_outline'] },
} satisfies CreatureInput;

/** WORLD §6.1's block order: the Starved Shadow, the Hollow Lantern, the Null Mouth, Vell's Umbra (the Stalker between is the Voidscar's). */
// ==== Anomaly variants (U34e; WORLD §10.2, DESIGN §6.6; D-087, D-091 gap 4) ===============================================
// Each twists a creature of this region: its numbers and gold (the base's, unless the twist changes them), WORLD §10.2's
// twist, XP ×1.3 of the base's, the guaranteed material as its loot (`mat_frayed_moment`, the material WORLD §6.8 calls
// "anomaly guaranteed"), and its `anomaly` spawn (region, Loop, count). The engine reads the twist tags named at each
// record (reducers/combat.ts header). Bestiary entries are the Wayfinder's notes on the twist (WORLD §10.2 gives the twist
// only).
// ---- cr_anomaly_unlit_lantern — Hollowed · L10 anomaly, Loop 2+ · XP 286 ("Intent hidden until it takes damage") ------------
// The `unlit` tag: its intents stay hidden while it is at full HP (combat/intents.ts).
const unlitLantern = {
  id: 'cr_anomaly_unlit_lantern',
  name: 'Unlit Lantern',
  description: 'A Hollow Lantern with its glass painted over: nothing in it shows until it is cracked.',
  family: 'fam_hollowed',
  materialKin: 'void_touched',
  role: 'anomaly',
  level: 10,
  stats: hollowLantern.stats,
  tags: ['breach_born', 'anomaly', 'unlit'],
  resistances: hollowLantern.resistances,
  statusImmunities: hollowLantern.statusImmunities,
  moves: hollowLantern.moves,
  pattern: hollowLantern.pattern,
  loot: [{ itemId: 'mat_frayed_moment' }], // DESIGN §6.6: the anomaly's guaranteed material drop (WORLD §10.2 lists no other)
  gold: hollowLantern.gold,
  xp: 286,
  anomaly: { region: 'region_veil', loop: 2 },
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Loop 2, the Mouth. A lantern whose glass shows nothing, not even the dark. I cannot tell what it means to do until I have hit it. After the first crack it is an ordinary lantern, which is bad enough.',
    tactics: 'Open with any hit to crack it, then read it like any Lantern; plain steel.',
    codexId: 'codex_creatures_hollowed',
    reveals: [...REVEALS],
  },
  sigil: { base: 'teardrop', details: ['lantern_glass', 'double_outline'] },
} satisfies CreatureInput;

export const creatures = [starvedShadow, hollowLantern, nullMouth, vellsUmbra, unlitLantern] satisfies CreatureInput[];
