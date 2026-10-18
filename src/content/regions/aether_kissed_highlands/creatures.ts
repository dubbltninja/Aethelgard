// Aether-Kissed Highlands — the creatures whose first region (WORLD §6's Regions column) is the Highlands (D-090): the Shimmering
// Phantom and the Moment Moth (Watch-wardens, §6.7), the Glass Mote, the Aetherial Weaver and the Sky-Whisper Sentinel
// (Spireborn, §6.5) and the Steppe Harrier (Wilds, §6.2: "Highlands, Ashen Steppe", so the Highlands are its first region and
// the Steppe unit references it). XP per WORLD §6 table / DESIGN §6.2; families WORLD §5; rules DESIGN §4.2, §4.4–4.6.
//
// Conventions are U42's and U45's (silverwood_ruins/creatures.ts and glowlands_nexus/creatures.ts headers): stats `HP · ATK ·
// DEF armor/ward · AGI` with SP = ATK, non-physical moves scaling on SP; WORLD's intent line id for id, the telegraph
// verbatim; a move's type is the creature's primary type unless the line names one (the Glass Mote's Refract is Ley by
// its block); `all` = area, `you` = player; loot rows in WORLD's order; bestiary and tactics WORLD's text verbatim (markdown
// and decision references dropped); `legacyName` on the legacy records; a `description` where no legacy line exists is a
// sentence drawn from the bestiary. Patterns are U45's: WORLD's first-match rule as one step evaluated every turn
// (`firstOf`), two cycled moves alternating by the creature's own turn (`alternate`); the Glass Mote, with no conditioned
// move, is the plain cycle. tests/unit/content/regions/aether_kissed_highlands.test.ts walks them turn by turn.
//
// Readings (each is repeated at its move):
//   - `construct` carries Poison and Bleed immunity as the Ruins' Arcane Wisp does (WORLD's Resist line for the Weaver and the
//     Sentinel names Poison only; the tag decides, WORLD §5);
//   - the Weaver's Mend ("ifHpBelow:50") waits while its Shield stands (`not selfHas status_shield`: a second cast refreshes
//     the pool and spends the turn, status_shield "keeps the higher pool"), the reading U45 made for the self-Rewind;
//   - the Glass Mote's Shatter ("onDeath") has no hook (DESIGN §4.2's CombatWhen has none): it is authored, telegraph and
//     all, and no pattern reaches it, as U45's Spore Drift burst (a gap for U34d);
//   - the Moth's "ifAllyPresent, everyNthTurn:3" Swarm is both conditions at once (`all`); "strips your haste" is the
//     combat-scope `stripBuffs` (D-069.9);
//   - the Harrier's Storm Glass (30 %) is DESIGN §8.2 / WORLD §8.1's drop table; the §6.2 block's Loot line omits it.
import type { CombatWhen, CreatureInput, Step } from '@schema/creature';

const REVEALS = [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] as const;

/** WORLD's first-match rule as one step: `[condition, step]` pairs top to bottom, then `otherwise` (the cycled move). */
function firstOf(conditioned: readonly (readonly [CombatWhen, Step])[], otherwise: Step): Step {
  return conditioned.reduceRight<Step>((rest, [when, step]) => ({ if: when, then: [step], else: [rest] }), otherwise);
}

/** Two cycled moves: the first on the creature's odd turns, the second on its even turns. */
const alternate = (odd: Step, even: Step): Step => ({ if: { everyNth: 2 }, then: [even], else: [odd] });

// ==== Watch-wardens (WORLD §6.7) ======================================================================================

// ---- cr_shimmering_phantom — Watch-wardens (Phantom) · L6 fodder · XP 111 · legacy ---------------------------------------------
const shimmeringPhantom = {
  id: 'cr_shimmering_phantom',
  name: 'Shimmering Phantom',
  legacyName: 'Shimmering Phantom',
  description: 'A mirage given teeth, flickering between moments.',
  family: 'fam_watch_wardens',
  materialKin: 'phantom',
  role: 'fodder',
  level: 6,
  // legacy: HP 32 · dmg 7 · def 2 · agi 7 · XP 45
  stats: { hp: 72, atk: 14, sp: 14, armor: 1, ward: 3, agi: 10 },
  tags: ['breach_born', 'legacy'],
  resistances: { void: 'weak', chrono: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    phantom_flicker: {
      name: 'Flicker',
      line: 'The Phantom flickers; it will strike where you were.',
      type: 'chrono',
      power: { coef: 1.1, stat: 'sp' },
    },
    phantom_mirage: {
      name: 'Mirage',
      line: 'Two of it stand on the path. One is lying.',
      statuses: [{ status: 'status_phase', duration: 1, target: 'self' }],
    },
    phantom_teeth: {
      name: 'Teeth',
      line: 'The mirage opens a mouth with real teeth in it.',
      type: 'physical',
      power: { coef: 1.3, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.4, duration: 2 }],
    },
  },
  // WORLD's order, top to bottom: `everyNthTurn:3` → the Mirage; `ifSelfHas:phase` → the Teeth; else the Flicker
  pattern: [
    firstOf(
      [
        [{ everyNth: 3 }, { move: 'phantom_mirage', target: 'self' }],
        [{ selfHas: 'status_phase' }, { move: 'phantom_teeth', target: 'player' }],
      ],
      { move: 'phantom_flicker', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'item_chronal_dust' }, // legacy, 100 %
    { itemId: 'mat_frayed_moment', chance: 0.3 },
  ],
  gold: { min: 15, max: 24 },
  xp: 111,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'The Pass bends distance and the Phantom bends with it. It strikes where I was a breath ago, so stepping aside does nothing; Guarding does. When there are two of it, the one with teeth is the one that is Phased. Dask says it was the same Phantom seventy years ago. He says it like a compliment.',
    tactics: 'Chrono ignores Phase; otherwise Guard the Teeth turn.',
    codexId: 'codex_creatures_watch_wardens',
    reveals: [...REVEALS],
  },
  sigil: { base: 'spiral', details: ['flicker'] },
} satisfies CreatureInput;

// ---- cr_moment_moth — Watch-wardens · L6 fodder · XP 111 -----------------------------------------------------------------------
const momentMoth = {
  id: 'cr_moment_moth',
  name: 'Moment Moth',
  description: 'Grey moths of the Pass, in threes, that settle on bare skin and take a second or two.',
  family: 'fam_watch_wardens',
  materialKin: 'phantom',
  role: 'fodder',
  level: 6,
  stats: { hp: 54, atk: 14, sp: 14, armor: 0, ward: 2, agi: 11 },
  tags: ['breach_born'],
  resistances: { fire: 'weak', void: 'weak', chrono: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    moth_flutter: {
      name: 'Flutter',
      line: 'Grey wings blur the air between you and the path.',
      type: 'chrono',
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.4, duration: 2 }],
    },
    // "strips your haste": the combat-scope stripBuffs on the struck target (D-069.9)
    moth_eat_a_second: {
      name: 'Eat a Second',
      line: 'It lands on your wrist. Something is missing.',
      type: 'chrono',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_stun', chance: 0.1, duration: 1 }],
      effects: [{ stripBuffs: { kinds: ['haste'] } }],
    },
    moth_swarm: { name: 'Swarm', line: 'The others turn toward you all at once.', type: 'chrono', power: { coef: 0.5, stat: 'sp' } },
  },
  // `ifAllyPresent, everyNthTurn:3` → the Swarm; the Flutter and the Eat a Second are the cycled moves
  pattern: [
    firstOf([[{ all: [{ allyPresent: true }, { everyNth: 3 }] }, { move: 'moth_swarm', target: 'all' }]], alternate({ move: 'moth_flutter', target: 'player' }, { move: 'moth_eat_a_second', target: 'player' })),
  ],
  loot: [
    { itemId: 'item_chronal_dust', chance: 0.3 },
    { itemId: 'mat_frayed_moment', chance: 0.2 },
  ],
  gold: { min: 15, max: 24 },
  xp: 111,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      'Year 460. Grey moths of the Pass, in threes, that settle on bare skin and take a second or two. Surveyors return reporting watches shorter than their count. Lantern-light does not draw them. A ticking watch does. Burn them.',
    tactics: 'Area fire; do not spend a Haste before they are down.',
    codexId: 'codex_creatures_watch_wardens',
    reveals: [...REVEALS],
  },
  sigil: { base: 'spiral', details: ['wing_blur'] },
} satisfies CreatureInput;

// ==== Spireborn (WORLD §6.5) ===========================================================================================

// ---- cr_glass_mote — Spireborn · L8 fodder · XP 161 ---------------------------------------------------------------------------
const glassMote = {
  id: 'cr_glass_mote',
  name: 'Glass Mote',
  description: "Chips of the Spires' crystal, hand-sized, spinning on the hum.",
  family: 'fam_spireborn',
  materialKin: 'aetherial',
  role: 'fodder',
  level: 8,
  stats: { hp: 84, atk: 17, sp: 17, armor: 3, ward: 3, agi: 9 },
  tags: ['construct'],
  resistances: { physical: 'weak', void: 'weak', ley: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    mote_spin: {
      name: 'Spin',
      line: 'It spins, edges out, toward your face.',
      type: 'physical',
      power: { coef: 1.0, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.4, duration: 3 }],
    },
    mote_refract: { name: 'Refract', line: 'Light enters it and leaves it pointed at you.', type: 'ley', power: { coef: 1.1, stat: 'sp' } },
    // WORLD `onDeath` ("resolves when it dies"): no pattern condition or creature hook fires a move at death (see the header),
    // so the burst is authored, telegraph and all, and no pattern reaches it
    mote_shatter: { name: 'Shatter', line: 'Cracks race through it. It is going to burst.', type: 'physical', power: { coef: 1.2, stat: 'atk' } },
  },
  pattern: [
    { move: 'mote_spin', target: 'player' },
    { move: 'mote_refract', target: 'player' },
  ],
  loot: [
    { itemId: 'item_aetherium_shard', chance: 0.3 },
    { itemId: 'mat_skyreach_crystal', chance: 0.15 },
  ],
  gold: { min: 19, max: 30 },
  xp: 161,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 455. Chips of the Spires' crystal, hand-sized, spinning on the hum. They gather where a Weaver works and cut whatever comes near the loom. Struck hard, they burst. Survey teams carry shields for the motes and nothing for the Weavers, which tells you which they fear.",
    tactics: 'Guard the turn after you bring one low, or kill it while your companion is out of range.',
    codexId: 'codex_creatures_spireborn',
    reveals: [...REVEALS],
  },
  sigil: { base: 'rhombus', details: ['spin'] },
} satisfies CreatureInput;

// ---- cr_aetherial_weaver — Spireborn (Aetherial) · L8 fodder · XP 161 · legacy -----------------------------------------------
const aetherialWeaver = {
  id: 'cr_aetherial_weaver',
  name: 'Aetherial Weaver',
  legacyName: 'Aetherial Weaver',
  description: 'A luminous entity spinning strands of raw magic between the spires.',
  family: 'fam_spireborn',
  materialKin: 'aetherial',
  role: 'fodder',
  level: 8,
  // legacy: HP 38 · dmg 8 · def 3 · agi 5 · XP 55; WORLD: −25 % HP if the Heartstone was destroyed (the engine's breach rule)
  stats: { hp: 96, atk: 17, sp: 17, armor: 2, ward: 4, agi: 7 },
  // U34e (D-105): `ley_made` — WORLD §2.4 "the Breach-born rule applies to Constructs of ley make too": the engine's −25 %
  tags: ['construct', 'ley_made', 'legacy'],
  resistances: { void: 'weak', ley: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    weaver_strand: {
      name: 'Strand',
      line: 'It draws a strand of light out of the air at you.',
      type: 'ley',
      power: { coef: 1.0, stat: 'sp' },
      statuses: [{ status: 'status_slow', chance: 0.3, duration: 2 }],
    },
    weaver_bind: {
      name: 'Bind',
      line: 'Strands loop your wrists and pull tight.',
      type: 'ley',
      power: { coef: 0.8, stat: 'sp' },
      statuses: [{ status: 'status_weaken', chance: 0.5, duration: 2 }],
    },
    weaver_web: {
      name: 'Web',
      line: 'It spreads strands between the spires and plucks one.',
      type: 'ley',
      power: { coef: 0.7, stat: 'sp' },
      statuses: [{ status: 'status_shock', chance: 0.3, duration: 2 }],
    },
    weaver_mend: { name: 'Mend', line: 'It spins light over its own torn edges.', shield: { power: { coef: 1.2, stat: 'atk' } } },
  },
  // WORLD's order, top to bottom: `everyNthTurn:3` → the Web; `ifHpBelow:50` → the Mend (while no Shield stands); else the
  // Strand and the Bind alternate
  pattern: [
    firstOf(
      [
        [{ everyNth: 3 }, { move: 'weaver_web', target: 'all' }],
        [{ all: [{ hpBelow: 0.5 }, { not: { selfHas: 'status_shield' } }] }, { move: 'weaver_mend', target: 'self' }],
      ],
      alternate({ move: 'weaver_strand', target: 'player' }, { move: 'weaver_bind', target: 'player' }),
    ),
  ],
  loot: [
    { itemId: 'item_aetherium_shard' }, // legacy, 100 %
    { itemId: 'mat_spire_thread', chance: 0.7 },
  ],
  gold: { min: 19, max: 30 },
  xp: 161,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "A loom in the Eyrie finished a cord of light and let it go, and it drifted out of the window toward the Spires, spinning. That is an Aetherial Weaver. Seraphine Aulde made them to carry her note from spire to spire. They still do. They bind before they hurt. Void unspins them; their own light doesn't.",
    tactics: 'Void, or steel; cleanse Weaken before your big turn.',
    codexId: 'codex_creatures_spireborn',
    reveals: [...REVEALS],
  },
  sigil: { base: 'rhombus', details: ['strands'] },
} satisfies CreatureInput;

// ---- cr_sky_whisper_sentinel — Spireborn (Sentinel) · L9 fodder · XP 189 · legacy; skyborn ---------------------------------------
const skyWhisperSentinel = {
  id: 'cr_sky_whisper_sentinel',
  name: 'Sky-Whisper Sentinel',
  legacyName: 'Sky-Whisper Sentinel',
  description: 'A wind-hardened guardian that strikes with cutting gusts.',
  family: 'fam_spireborn',
  materialKin: 'sentinel',
  role: 'fodder',
  level: 9,
  // legacy: HP 42 · dmg 9 · def 3 · agi 5 · XP 60
  stats: { hp: 110, atk: 18, sp: 18, armor: 3, ward: 3, agi: 8 },
  tags: ['construct', 'skyborn', 'legacy'],
  resistances: { chrono: 'weak', void: 'weak', storm: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    sentinel_cutting_gust: {
      name: 'Cutting Gust',
      line: 'The wind around it sharpens and turns toward you.',
      type: 'storm',
      power: { coef: 1.0, stat: 'sp' },
      statuses: [{ status: 'status_bleed', chance: 0.3, duration: 2 }],
    },
    sentinel_gale_wall: {
      name: 'Gale Wall',
      line: 'It spreads its vanes. The gale doubles.',
      type: 'storm',
      power: { coef: 0.6, stat: 'sp' },
      statuses: [{ status: 'status_blind', chance: 0.3, duration: 1 }],
    },
    sentinel_ride_the_wind: {
      name: 'Ride the Wind',
      line: 'It lifts on a gust and hangs above you.',
      statuses: [{ status: 'status_haste', duration: 2, target: 'self' }],
    },
    sentinel_dive: { name: 'Dive', line: 'It folds its vanes and drops.', type: 'physical', power: { coef: 1.5, stat: 'atk' } },
  },
  // WORLD's order, top to bottom: `everyNthTurn:3` → the Ride; `ifSelfHas:haste` → the Dive; else the Gust and the Wall alternate
  pattern: [
    firstOf(
      [
        [{ everyNth: 3 }, { move: 'sentinel_ride_the_wind', target: 'self' }],
        [{ selfHas: 'status_haste' }, { move: 'sentinel_dive', target: 'player' }],
      ],
      alternate({ move: 'sentinel_cutting_gust', target: 'player' }, { move: 'sentinel_gale_wall', target: 'all' }),
    ),
  ],
  loot: [
    // legacy, 100 %; "a second copy is a trinket upgrade material, WORLD §3.4"
    { itemId: 'item_sky_whisper_talisman' },
    { itemId: 'mat_gale_feather', chance: 0.8 },
  ],
  gold: { min: 21, max: 33 },
  xp: 189,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 120. The Sentinels of the Plateau keep watch to the east. Seraphine Aulde set them to guard the Spires' outer markers; they have extended the order to everything in sight. The Nomads leave their dead on the Roost because the Sentinels let no bird near. Each carries a talisman of wind-cut stone. Wearing one, you can breathe above the Plateau.",
    tactics: 'A Chrono hit on its rise strips the Haste and cancels the Dive.',
    codexId: 'codex_creatures_spireborn',
    reveals: [...REVEALS],
  },
  sigil: { base: 'rhombus', details: ['vanes'] },
} satisfies CreatureInput;

// ==== The Wilds (WORLD §6.2) ===========================================================================================

// ---- cr_steppe_harrier — Wilds (Steppe) · L8 fodder · XP 161; skyborn ---------------------------------------------------------
const steppeHarrier = {
  id: 'cr_steppe_harrier',
  name: 'Steppe Harrier',
  description: 'The grey hawk of the Steppe, wingspan of a tall man, hunting in pairs.',
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'fodder',
  level: 8,
  stats: { hp: 88, atk: 17, sp: 17, armor: 1, ward: 2, agi: 12 },
  tags: ['skyborn'],
  // WORLD: "weak chrono · resist fire · immune —"
  resistances: { chrono: 'weak', fire: 'resist' },
  moves: {
    harrier_stoop: { name: 'Stoop', line: 'A shadow drops out of the white sky at you.', type: 'physical', power: { coef: 1.3, stat: 'atk' } },
    harrier_rake: {
      name: 'Rake',
      line: 'Talons open as it skims past your eyes.',
      type: 'physical',
      power: { coef: 0.8, stat: 'atk' },
      statuses: [{ status: 'status_blind', chance: 0.3, duration: 1 }],
    },
    harrier_climb: {
      name: 'Climb',
      line: 'It beats upward into the wind and hangs there.',
      statuses: [{ status: 'status_haste', duration: 2, target: 'self' }],
    },
    harrier_dive: { name: 'Dive', line: 'It folds its wings above you.', type: 'physical', power: { coef: 1.5, stat: 'atk' } },
  },
  // WORLD's order, top to bottom: `first` → the Stoop; `everyNthTurn:3` → the Climb; `ifSelfHas:haste` → the Dive; else the Rake
  pattern: [
    firstOf(
      [
        [{ first: true }, { move: 'harrier_stoop', target: 'player' }],
        [{ everyNth: 3 }, { move: 'harrier_climb', target: 'self' }],
        [{ selfHas: 'status_haste' }, { move: 'harrier_dive', target: 'player' }],
      ],
      { move: 'harrier_rake', target: 'player' },
    ),
  ],
  loot: [
    { itemId: 'mat_gale_feather', chance: 0.5 },
    { itemId: 'mat_steppe_salt', chance: 0.2 },
    { itemId: 'mat_storm_glass', chance: 0.3 }, // DESIGN §8.2 / WORLD §8.1 (see the header)
  ],
  gold: { min: 19, max: 30 },
  xp: 161,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      'Year 497. The grey hawk of the Steppe, wingspan of a tall man, hunting in pairs along the ash-paths and up onto the Plateau when the gales come. It climbs, it hangs, it drops. The Nomads shout "up" and raise shields. Its feathers fetch good salt.',
    tactics: 'A Chrono hit strips the Haste and cancels the dive; otherwise Guard after it climbs.',
    codexId: 'codex_creatures_wilds',
    reveals: [...REVEALS],
  },
  sigil: { base: 'triangle', details: ['wings'] },
} satisfies CreatureInput;

/** East along the road: the Pass's wardens, the Spires' Spireborn, the Plateau's hawk. */
export const creatures = [shimmeringPhantom, momentMoth, glassMote, aetherialWeaver, skyWhisperSentinel, steppeHarrier] satisfies CreatureInput[];
