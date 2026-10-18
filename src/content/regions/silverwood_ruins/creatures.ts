// Silverwood Ruins — the creatures whose first region (WORLD §6's Regions column) is the Ruins (D-090): the Corrupted
// Shade, the Mistwood Prowler, the Drowned Archivist, the Arcane Wisp, the Paradox Wisp, the Redundant Wayfinder and the
// Unraveling Tide (WORLD §6.1–6.3, §6.5, §6.8; XP WORLD §6 table / DESIGN §6.2; families WORLD §5; rules DESIGN §4.2,
// §4.4–4.6). The Horde Husk ("any infected node") has no first region and is referenced, not authored.
//
// Conventions (WORLD "Conventions for §4–6"):
//   stats     `HP · ATK · DEF armor/ward · AGI`; SP = ATK unless WORLD gives one (only the Tyrants do), so `sp` is set
//             explicitly and non-physical moves scale on it;
//   moves     WORLD's intent line, id for id: `line` is the telegraph verbatim, `power.coef` the multiplier, the type
//             the creature's primary type unless the line names one; `all` = area, `you` = player;
//   pattern   WORLD's cadence words → DESIGN §4.2 steps (`first` → first, `everyNthTurn:n` → everyNth, `ifHpBelow:n`
//             → hpBelow, `round:n` → roundAtLeast): the conditioned steps come first in priority order, then the
//             unconditioned moves cycle (a false `when` is skipped and the walk goes on, so a conditioned step replaces
//             the next cycled move when it holds). The Shade keeps DESIGN §4.12's worked-example pattern;
//   tags      `breach_born` and `construct` are Poison-immune (engine); `construct` adds Bleed immunity and `drowned`
//             Soaked-on-turn-start (WORLD §5) as explicit `statusImmunities` / a tag the engine does not read yet;
//   loot      gold `[3+2L, 6+3L]` and the rows in WORLD's order; the Shade's first-kill Spellbook (D-055) is the
//             `flag_spellbook_dropped` pair PLAN §5.4 names;
//   bestiary  WORLD's entry, verbatim, in WORLD's voice; `description` is the legacy line where one exists, else a
//             sentence drawn from the bestiary (listed in the U42 reply); reveals per DESIGN §4.2 (resistances at the
//             first kill, exact numbers at the third);
//   sigil     DESIGN §17.3: the family's outer shape as `base`, one animated detail.
import type { CreatureInput } from '@schema/creature';

const REVEALS = [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] as const;

// ---- cr_corrupted_shade — Hollowed (Shade) · L2 fodder · XP 41 (WORLD §6.1; DESIGN §4.12 numbers and pattern) -------------
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
  tags: ['breach_born', 'legacy'],
  resistances: { ley: 'weak', fire: 'weak', void: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    shade_rake: { name: 'Rake', line: 'It drags long fingers through the air toward you.', type: 'physical', power: { coef: 1.0, stat: 'atk' } },
    shade_wail: {
      name: 'Wail',
      line: 'Its mouth opens wider than its face.',
      type: 'void',
      power: { coef: 0.9, stat: 'sp' },
      spell: true, // DESIGN §4.12: the Wail is a spell (+10 accuracy)
      statuses: [{ status: 'status_weaken', chance: 0.5, duration: 2 }],
    },
    shade_fade: { name: 'Fade', line: 'It thins until the wall shows through.', statuses: [{ status: 'status_phase', duration: 1, target: 'self' }] },
  },
  pattern: [
    { move: 'shade_rake', target: 'player' },
    { move: 'shade_wail', target: 'player' },
    { if: { hpBelow: 0.7 }, then: [{ move: 'shade_fade', target: 'self' }], else: [{ move: 'shade_rake', target: 'player' }] },
  ],
  // D-055: the first Shade killed each loop drops its Spellbook; every later one at 50 % (PLAN §5.4's flag pair).
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
    summary:
      'Year 212. Shades keep to corridors and stairs, the places students walked between lectures. Each carries a Dark Spellbook, or the memory of one. Maelis Korr taught that knowledge is a debt; these are the students who paid in full and are still being billed. Do not read what one drops in the room where it fell.',
    tactics: 'Hit hard before 70%; when it Fades, use an area or Chrono hit (Phase stops neither) or spend the turn Guarding. Ley or fire ends it fastest.',
    codexId: 'codex_creatures_hollowed',
    reveals: [...REVEALS],
  },
  sigil: { base: 'teardrop', details: ['smear'] },
} satisfies CreatureInput;

// ---- cr_mistwood_prowler — Wilds · L2 fodder · XP 41 (WORLD §6.2) ----------------------------------------------------------
const mistwoodProwler = {
  id: 'cr_mistwood_prowler',
  name: 'Mistwood Prowler',
  description: 'A lean grey cat with bark-light patterning along the flanks. It hunts the Archway at dusk.',
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'fodder',
  level: 2,
  stats: { hp: 38, atk: 9, sp: 9, armor: 1, ward: 1, agi: 8 },
  tags: ['beast'],
  resistances: { fire: 'weak' },
  moves: {
    prowler_from_fog: { name: 'From the Fog', line: 'The fog thickens on your left. It is not fog.', type: 'physical', power: { coef: 1.3, stat: 'atk' } },
    prowler_rake: {
      name: 'Rake',
      line: 'Bark-patterned flanks ripple as it circles you.',
      type: 'physical',
      power: { coef: 0.9, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.3, duration: 3 }],
    },
    prowler_fade: { name: 'Fade', line: 'It steps back into the fog and is gone.', statuses: [{ status: 'status_phase', duration: 1, target: 'self' }] },
  },
  pattern: [
    { move: 'prowler_from_fog', target: 'player', when: { first: true } },
    { move: 'prowler_fade', target: 'self', when: { everyNth: 3 } },
    { move: 'prowler_rake', target: 'player' },
  ],
  loot: [
    { itemId: 'mat_wildling_hide', chance: 0.4 },
    { itemId: 'mat_ley_resin', chance: 0.3 },
    { itemId: 'item_travelers_sword', chance: 0.1 },
  ],
  gold: { min: 7, max: 12 },
  xp: 41,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      'Year 471. A lean grey cat with bark-light patterning along the flanks. It hunts the Archway at dusk and will follow a scholar a mile without closing. Lanterns do not deter it. Noise does. Remnants who walk the Archway walk in pairs, and talk.',
    tactics: 'Guard the opening; hold your heavy hit for the turn after it Fades.',
    codexId: 'codex_creatures_wilds',
    reveals: [...REVEALS],
  },
  sigil: { base: 'triangle', details: ['bark_stripes'] },
} satisfies CreatureInput;

// ---- cr_drowned_archivist — Drowned · L4 fodder · XP 71 (WORLD §6.3; D-046, D-067.19) ------------------------------------
const drownedArchivist = {
  id: 'cr_drowned_archivist',
  name: 'Drowned Archivist',
  legacyName: 'Drowned Archivist',
  description: 'A sodden scholar bound to drowned pages, still guarding secrets.',
  family: 'fam_drowned',
  materialKin: 'drowned',
  role: 'fodder',
  level: 4,
  stats: { hp: 58, atk: 11, sp: 11, armor: 1, ward: 3, agi: 4 },
  // `drowned` (WORLD §5: Soaked re-applied at the start of each of its turns) is not read by the engine yet.
  tags: ['breach_born', 'drowned', 'legacy'],
  resistances: { fire: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    // Oriel's echo, the First Drowned: only the Archivist at the Sunken Archives during q_lost_scroll turns her back first.
    first_drowned_turns: { name: 'Turns Her Back', line: 'She clutches the scroll and turns her back to you.' },
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
    {
      move: 'first_drowned_turns',
      target: 'self',
      when: { all: [{ first: true }, { location: 'loc_sunken_archives' }, { quest: { id: 'q_lost_scroll', status: 'active' } }] },
    },
    { move: 'archivist_bind', target: 'player', when: { everyNth: 3 } },
    { move: 'archivist_page_cut', target: 'player' },
    { move: 'archivist_recite', target: 'player' },
  ],
  loot: [
    { itemId: 'item_mana_bloom', chance: 0.6 },
    { itemId: 'mat_sodden_vellum', chance: 0.8 },
    { itemId: 'item_necromancer_staff', chance: 0.05 },
    // the quest drop at the Sunken Archives (WORLD §3.1, §6.3): once, while q_lost_scroll is open and the scroll is not held
    {
      itemId: 'item_scholars_lost_scroll',
      when: {
        all: [{ location: 'loc_sunken_archives' }, { quest: { id: 'q_lost_scroll', status: 'active' } }, { not: { item: { id: 'item_scholars_lost_scroll' } } }],
      },
    },
  ],
  gold: { min: 11, max: 18 },
  xp: 71,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      'Year 61. The scholars who stayed with the shelves when the ley-water rose are still with them. They read to the water and guard what they were last carrying. One, in the carrel under the east stair, guards a scroll sealed in Danthe wax and turns her back before she fights. The Keeper asks that no one record her name until we are sure.',
    tactics: 'Storm (always Soaked); never fire. From Loop 2, q_the_first_drowned avoids the fight.',
    codexId: 'codex_creatures_drowned',
    reveals: [...REVEALS],
  },
  sigil: { base: 'circle_waterline', details: ['drip'] },
} satisfies CreatureInput;

// ---- cr_arcane_wisp — Spireborn (Wisp) · L2 fodder · XP 41 (WORLD §6.5) ---------------------------------------------------
const arcaneWisp = {
  id: 'cr_arcane_wisp',
  name: 'Arcane Wisp',
  legacyName: 'Arcane Wisp',
  description: 'A floating knot of feral magic crackling with unstable energy.',
  family: 'fam_spireborn',
  materialKin: 'wisp',
  role: 'fodder',
  level: 2,
  stats: { hp: 34, atk: 8, sp: 8, armor: 0, ward: 2, agi: 7 },
  tags: ['construct', 'legacy'],
  resistances: { void: 'weak', ley: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    wisp_crackle: { name: 'Crackle', line: 'It knots tighter, spitting blue sparks at you.', type: 'ley', power: { coef: 1.0, stat: 'sp' } },
    wisp_arc: {
      name: 'Arc',
      line: 'A thread of light jumps from it to you and holds.',
      type: 'storm',
      power: { coef: 0.7, stat: 'sp' },
      statuses: [{ status: 'status_shock', chance: 0.4, duration: 2 }],
    },
    wisp_flare: {
      name: 'Flare',
      line: 'It swells, bright enough to show your bones.',
      type: 'ley',
      power: { coef: 0.5, stat: 'sp' },
      statuses: [{ status: 'status_blind', chance: 0.3, duration: 1 }],
    },
  },
  pattern: [
    { move: 'wisp_flare', target: 'all', when: { everyNth: 3 } },
    { move: 'wisp_crackle', target: 'player' },
    { move: 'wisp_arc', target: 'player' },
  ],
  loot: [
    { itemId: 'item_ley_touched_tonic', chance: 0.6 },
    { itemId: 'mat_ley_spark', chance: 0.8 },
  ],
  gold: { min: 7, max: 12 },
  xp: 41,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 9. Wisps are loose ends. When Seraphine Aulde's Spires cracked, the strands they spun came unwound and drifted west along the Aether Road to where the line rises under the ruin. They knot around ley-light: lanterns, crystals, the Plaza fountains. They are not malicious. They burn the hand that grasps them and come apart for a sharp blade.",
    tactics: 'Steel or Void. Echo Bolt is Ley and it resists: a lesson the first room teaches.',
    codexId: 'codex_creatures_spireborn',
    reveals: [...REVEALS],
  },
  sigil: { base: 'rhombus', details: ['spark'] },
} satisfies CreatureInput;

// ---- cr_paradox_wisp — Spireborn (Wisp) · L4 anomaly, Loop 2+ · XP 92 (WORLD §6.5, §3.1) -------------------------------------
const paradoxWisp = {
  id: 'cr_paradox_wisp',
  name: 'Paradox Wisp',
  description: 'A wisp that was at the fountain before you arrived, in both senses. It throws your last spell back at you.',
  family: 'fam_spireborn',
  materialKin: 'wisp',
  role: 'anomaly',
  level: 4,
  stats: { hp: 50, atk: 11, sp: 11, armor: 0, ward: 3, agi: 9 },
  tags: ['construct', 'anomaly'],
  resistances: { void: 'weak', ley: 'resist', chrono: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    paradox_before: { name: 'Before', line: 'It is already where you are aiming.', statuses: [{ status: 'status_phase', duration: 1, target: 'self' }] },
    // WORLD: "using the damage type of the ability you used last": the `last_spell` special (U34e, D-091); Ley, its own type,
    // before you have used one
    paradox_mirror: { name: 'Mirror', line: 'It flickers into the shape of your last spell.', type: 'ley', power: { coef: 1.0, stat: 'sp' }, special: 'last_spell' },
    paradox_knot: {
      name: 'Knot',
      line: 'Two of it, briefly. Then one.',
      type: 'chrono',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_rewind', duration: 2, target: 'self' }],
    },
  },
  pattern: [
    { move: 'paradox_before', target: 'self', when: { first: true } },
    { move: 'paradox_knot', target: 'player', when: { hpBelow: 0.5 } },
    { move: 'paradox_mirror', target: 'player' },
  ],
  loot: [
    { itemId: 'mat_ley_spark' }, // the anomaly's guaranteed material
    { itemId: 'mat_frayed_moment', chance: 0.3 },
  ],
  gold: { min: 11, max: 18 },
  xp: 92,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Loop 2. A wisp at the Plaza that was there before I arrived, in both senses. It throws back the last spell I cast. So I cast the cheap one last. Void it while it is rewinding. It is the first thing I have killed that I think remembered me.',
    tactics: 'End your turn on a weak or Void ability; Void consumes its Rewind ×1.25.',
    codexId: 'codex_creatures_spireborn',
    reveals: [...REVEALS],
  },
  sigil: { base: 'rhombus', details: ['double_outline'] },
} satisfies CreatureInput;

// ---- cr_redundant_wayfinder — Unravelled · L12 anomaly (elite stats), Loop 4+ · XP 676 (WORLD §6.8, §12.1 ws_loop_4) ------
const redundantWayfinder = {
  id: 'cr_redundant_wayfinder',
  name: 'Redundant Wayfinder',
  description: 'A Wayfinder the Breach made twice and only needed once, standing where you died and wearing what you wore.',
  family: 'fam_unravelled',
  role: 'anomaly',
  level: 12,
  stats: { hp: 260, atk: 23, sp: 23, armor: 4, ward: 4, agi: 9 },
  tags: ['breach_born', 'anomaly'],
  // WORLD: "resist the player's class type": the engine's, for a creature with a `class_mirror` move (U34e, D-091)
  resistances: { ley: 'weak' },
  statusImmunities: ['status_poison'],
  moves: {
    redundant_recognize: { name: 'Recognize', line: 'It looks at you the way you look at a mirror.' },
    // WORLD: 1.2× "the player's class type" with the class's status: the `class_mirror` special decides the type (U34e,
    // D-091; Physical is its default), the status rows read the class
    redundant_your_move: {
      name: 'Your Move',
      line: 'It lifts its weapon the way you lift yours.',
      type: 'physical',
      power: { coef: 1.2, stat: 'atk' },
      special: 'class_mirror',
      statuses: [
        { status: 'status_bleed', chance: 0.4, duration: 3, when: { class: 'ranger' } },
        { status: 'status_burn', chance: 0.4, duration: 3, when: { class: 'wizard' } },
        { status: 'status_phase', duration: 1, target: 'self', when: { class: 'elf' } },
        { status: 'status_armor_break', chance: 0.4, duration: 2, when: { class: 'ironclad_warden' } },
        { status: 'status_curse', chance: 0.4, duration: 3, when: { class: 'shadow_weaver' } },
      ],
    },
    redundant_your_guard: { name: 'Your Guard', line: 'It braces exactly as you would.', special: 'guard' },
    redundant_leave: { name: 'Leave', line: 'It turns and walks to where you died.', leaveCombat: true },
  },
  pattern: [
    { move: 'redundant_recognize', target: 'self', when: { first: true } },
    // round 3, only if it has taken no damage (hpBelow 1 = below full HP)
    { move: 'redundant_leave', target: 'self', when: { all: [{ roundAtLeast: 3 }, { not: { hpBelow: 1 } }] } },
    { move: 'redundant_your_guard', target: 'self', when: { hpBelow: 0.5 } },
    { move: 'redundant_your_move', target: 'player' },
  ],
  loot: [
    { itemId: 'mat_frayed_moment', count: 2 },
    // the player's class starter weapon, 30 % (DESIGN §5.2–5.6 kits)
    { itemId: 'item_rusty_dagger', chance: 0.3, when: { class: 'ranger' } },
    { itemId: 'item_apprentice_staff', chance: 0.3, when: { class: 'wizard' } },
    { itemId: 'item_primitive_bow', chance: 0.3, when: { class: 'elf' } },
    { itemId: 'item_nomads_maul', chance: 0.3, when: { class: 'ironclad_warden' } },
    { itemId: 'item_cracked_void_focus', chance: 0.3, when: { class: 'shadow_weaver' } },
  ],
  gold: { min: 54, max: 84 },
  xp: 676,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "Loop 4. Standing where I died in Loop 2, wearing what I wore. Not a ghost: a Wayfinder the Breach made twice and only needed once. It waited for me to strike. When I didn't, it walked to the place I fell and lay down there. The time I did strike, it fought exactly as I do. Badly, at first.",
    tactics: 'Leave it be (it goes on round 3), or fight it with the type your class does not use; Ley.',
    codexId: 'codex_creatures_unravelled',
    reveals: [...REVEALS],
  },
  sigil: { base: 'broken_circle', details: ['mirror'] },
} satisfies CreatureInput;

// ---- cr_unraveling_tide — Unravelled · L14 Horde boss · XP 500, kill only (WORLD §6.8, §3.1, §10.5, §12.2) ------------------
const unravelingTide = {
  id: 'cr_unraveling_tide',
  name: 'The Unraveling Tide',
  description: 'Not a creature: the edge of the unraveling, a wave of loose moments with husks in it, filling the corridor between you and the Library.',
  family: 'fam_unravelled',
  role: 'boss',
  level: 14,
  stats: { hp: 480, atk: 26, sp: 26, armor: 2, ward: 6, agi: 1 },
  tags: ['breach_born', 'horde'],
  resistances: { ley: 'weak', chrono: 'resist', void: 'resist' },
  statusImmunities: ['status_stun', 'status_slow', 'status_poison', 'status_bleed', 'status_burn'],
  interruptible: true, // Stagger allowed
  fleeable: false,
  moves: {
    tide_wash: {
      name: 'Wash',
      line: 'Moments wash over your boots, cold and out of order.',
      type: 'chrono',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.5, duration: 2 }],
    },
    tide_take: {
      name: 'Take',
      line: 'Something in the wave takes what you were holding onto.',
      type: 'void',
      power: { coef: 0.6, stat: 'sp' },
      effects: [{ stripBuffs: { kinds: ['shield', 'regen', 'haste', 'rewind'] } }],
    },
    tide_shape: { name: 'Shape', line: 'A shape climbs out of the wave.', summon: { creatureId: 'cr_horde_husk', count: 1, max: 2 } },
    tide_pull: {
      name: 'Pull',
      line: 'The floor tilts toward the wave.',
      type: 'chrono',
      power: { coef: 1.2, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.6, duration: 2 }],
    },
    // hidden wind-up, then the full crest (1.8× all): the wind-up's payoff needs its own move id (U42: `tide_fall`)
    tide_rise: { name: 'Rise', line: 'The wave rises to the ceiling and hangs there.', hidden: true, windUp: { turns: 1, then: 'tide_fall' } },
    tide_fall: { name: 'Fall', line: 'The wave comes down all at once.', type: 'chrono', power: { coef: 1.8, stat: 'sp' }, hidden: true },
    tide_crest: { name: 'Crest', line: 'It breaks over you on its way somewhere else.', type: 'chrono', power: { coef: 1.6, stat: 'sp' } },
  },
  phases: [
    {
      id: 'tide_the_edge',
      name: 'The Edge',
      // win condition: kill it, or be standing at the end of round 10 (no loot, no XP)
      onEnter: [{ surviveRounds: { rounds: 10, line: 'The Tide passes. It had somewhere else to be.' } }],
      pattern: [
        { move: 'tide_shape', target: 'self', when: { everyNth: 3 } },
        { move: 'tide_wash', target: 'all' },
        { move: 'tide_take', target: 'player' },
      ],
    },
    {
      id: 'tide_the_undertow',
      name: 'The Undertow',
      enterWhen: [{ round: 4 }, { hpBelow: 0.66 }],
      line: 'The Tide pulls back to gather. The corridor walls go with it, then return.',
      pattern: [
        { move: 'tide_rise', target: 'all', when: { everyNth: 3 } },
        { move: 'tide_pull', target: 'player' },
        { move: 'tide_wash', target: 'all' },
      ],
    },
    {
      id: 'tide_it_passes',
      name: 'It Passes',
      enterWhen: [{ round: 8 }, { hpBelow: 0.33 }],
      line: 'The Tide is thinner here. Through it: the Library, and a violet light.',
      pattern: [
        { move: 'tide_crest', target: 'all', when: { everyNth: 2 } },
        { move: 'tide_wash', target: 'all' },
      ],
    },
  ],
  // kill only: a survival win pays nothing (engine)
  loot: [
    { itemId: 'mat_frayed_moment', count: 4 },
    { itemId: 'item_chronal_dust', count: 2 },
  ],
  gold: { min: 155, max: 240 },
  xp: 500,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "When the Tyrant falls, this comes down the ley lines ahead of everything else. Not a creature: the edge of the unraveling, a wave of loose moments with husks in it. If I dawdle after the Apex it fills the Corridor between me and the Library. I don't have to kill it. I have to still be standing when it moves on.",
    tactics: 'Guard every Crest; Ley throughout; kill the husks it lifts. Survival is a win.',
    codexId: 'codex_creatures_unravelled',
    reveals: [...REVEALS],
  },
  sigil: { base: 'broken_circle', details: ['wave'] },
} satisfies CreatureInput;

/** WORLD §6 order within the region: the Hollowed, the Wilds, the Drowned, Spireborn, the Unravelled. */
export const creatures = [corruptedShade, mistwoodProwler, drownedArchivist, arcaneWisp, paradoxWisp, redundantWayfinder, unravelingTide] satisfies CreatureInput[];
