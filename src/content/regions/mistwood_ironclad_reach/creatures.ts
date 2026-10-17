// Mistwood & the Ironclad Reach — the creatures whose first region (WORLD §6's Regions column) is this region (D-090): the
// Wildling Brute and the Rootling (Wilds, §6.2), the Stone-Hide Golem and the Warding Pillar (Wards, §6.4) and the Stutter
// Hound (Watch-wardens, §6.7). The Mistwood Prowler's first region is the Ruins, so it lives there (D-090). XP per WORLD §6
// table / DESIGN §6.2; families WORLD §5; rules DESIGN §4.2, §4.4–4.6.
//
// The conventions are the Ruins' (../silverwood_ruins/creatures.ts header): `HP · ATK · DEF armor/ward · AGI` with SP = ATK;
// WORLD's intent line id for id, the telegraph verbatim; `first`/`everyNthTurn`/`ifHpBelow` → `first`/`everyNth`/`hpBelow`;
// the conditioned steps first in WORLD's priority order, then the unconditioned cycle (a false `when` is skipped and the
// walk goes on); bestiary and tactics verbatim in WORLD's voice (backticks dropped, as the Ruins did); `legacyName` on the
// two legacy records; a `description` where no legacy line exists is a sentence drawn from the bestiary entry.
//
// Readings the schema forces (each is repeated at its move):
//   - "ifAllyDown" (an ally died this fight) has no atom; the Rootling uses `allyCountBelow: 2`, which holds once one of a
//     group of three has fallen (WORLD: "they come in threes");
//   - "the ally is below 50 %" (the Golem's Cover) has no atom (`hpBelow` is the creature's own HP); Cover is gated on an
//     ally being present;
//   - "shield ally = 10 % of that ally's max HP" (the Pillar's Ward) is a scale on ATK: 1.0 × 14 = 14, the 10 % of a
//     130-HP Outpost Golem; a boss in the Before would be shielded more by WORLD's rule than here;
//   - "repeats its previous move" (the Hound's Echo) has no special; it is the Bite again, which is the move WORLD's own
//     tactics say it repeats ("Guard the turn after a Bite").
import type { CreatureInput } from '@schema/creature';

const REVEALS = [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] as const;

// ---- cr_wildling_brute — Wilds · L4 fodder · XP 71 (WORLD §6.2; DESIGN §4.12 numbers and pattern) -------------------------
const wildlingBrute = {
  id: 'cr_wildling_brute',
  name: 'Wildling Brute',
  legacyName: 'Wildling Brute',
  description: 'A hulking creature grown from twisted roots and bone.',
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'fodder',
  level: 4,
  stats: { hp: 64, atk: 11, sp: 11, armor: 3, ward: 0, agi: 3 },
  tags: ['growth', 'legacy'],
  resistances: { fire: 'weak' },
  moves: {
    brute_strike: { name: 'Strike', line: 'It lifts a root-knotted arm over you.', type: 'physical', power: { coef: 1.0, stat: 'atk' } },
    brute_maul: { name: 'Maul', line: 'Bone grinds as it winds back both arms.', type: 'physical', power: { coef: 1.6, stat: 'atk' } },
    // regen self 3 per turn for 2 turns (DESIGN §4.12: "Wildling Brute's Regen 3")
    brute_root_knit: {
      name: 'Root Knit',
      line: 'Roots crawl back over its wounds.',
      statuses: [{ status: 'status_regen', duration: 2, target: 'self', power: { base: 3 } }],
    },
  },
  // WORLD's stats line says "DESIGN §4.12 numbers and pattern": strike → strike → maul → {hp < 50 %: root_knit | strike}.
  // (WORLD's intent line writes the Maul as everyNthTurn:3; DESIGN's four-step walk is the worked example and the bestiary
  // entry: "swings twice and then winds up".)
  pattern: [
    { move: 'brute_strike', target: 'player' },
    { move: 'brute_strike', target: 'player' },
    { move: 'brute_maul', target: 'player' },
    { if: { hpBelow: 0.5 }, then: [{ move: 'brute_root_knit', target: 'self' }], else: [{ move: 'brute_strike', target: 'player' }] },
  ],
  loot: [
    { itemId: 'item_ley_touched_tonic', chance: 0.6 },
    { itemId: 'item_wildling_hide_armor', chance: 0.25 }, // legacy 50 %
    { itemId: 'mat_wildling_hide', chance: 0.8 },
    { itemId: 'mat_rootbone', chance: 0.4 },
  ],
  gold: { min: 11, max: 18 },
  xp: 71,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Roots and bone, grown into a shape that walks. It swings twice and then winds up; the third one is the one to Guard. Below half it lets roots crawl over its wounds. Brak says the Peaks were quiet before the Brute. Brak says a lot of things were quiet before.',
    tactics: 'Guard the Maul. Fire is weak; Void strips the knit-Regen; Bleed and Poison both work.',
    codexId: 'codex_creatures_wilds',
    reveals: [...REVEALS],
  },
  sigil: { base: 'triangle', details: ['root_knots'] },
} satisfies CreatureInput;

// ---- cr_rootling — Wilds · L2 fodder · XP 41 (WORLD §6.2) -----------------------------------------------------------------
const rootling = {
  id: 'cr_rootling',
  name: 'Rootling',
  description: 'Knee-high. They come in threes.',
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'fodder',
  level: 2,
  stats: { hp: 30, atk: 7, sp: 7, armor: 2, ward: 0, agi: 4 },
  tags: ['growth'],
  resistances: { fire: 'weak' },
  moves: {
    rootling_trip: {
      name: 'Trip',
      line: 'Roots slide toward your ankles.',
      type: 'physical',
      power: { coef: 0.7, stat: 'atk' },
      statuses: [{ status: 'status_slow', chance: 0.4, duration: 2 }],
    },
    rootling_jab: {
      name: 'Jab',
      line: 'It whips a sharpened root at your shin.',
      type: 'physical',
      power: { coef: 1.0, stat: 'atk' },
      statuses: [{ status: 'status_bleed', chance: 0.25, duration: 2 }],
    },
    rootling_burrow: { name: 'Burrow', line: 'It sinks into the loam, leaving a twitching mound.', shield: { power: { coef: 1.0, stat: 'atk' } } },
  },
  pattern: [
    // ifAllyDown: fewer than two allies left of a group of three
    { move: 'rootling_burrow', target: 'self', when: { allyCountBelow: 2 } },
    { move: 'rootling_trip', target: 'player' },
    { move: 'rootling_jab', target: 'player' },
  ],
  loot: [
    { itemId: 'mat_rootbone', chance: 0.5 },
    { itemId: 'mat_ley_resin', chance: 0.2 },
  ],
  gold: { min: 7, max: 12 },
  xp: 41,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Knee-high. They come in threes. Ilyra thinks a Rootling is what a Wildling Brute is before it gets its bones. When one dies the others dig in, so kill them evenly, or burn them all at once.',
    tactics: 'Area damage; fire.',
    codexId: 'codex_creatures_wilds',
    reveals: [...REVEALS],
  },
  sigil: { base: 'triangle', details: ['root_tendrils'] },
} satisfies CreatureInput;

// ---- cr_stone_hide_golem — Wards · L6 elite · XP 200 (WORLD §6.4; DESIGN §4.8 elite pair, §13.3 #8 shortcut) ----------------
const stoneHideGolem = {
  id: 'cr_stone_hide_golem',
  name: 'Stone-Hide Golem',
  legacyName: 'Stone-Hide Golem',
  description: 'A hulking construct of slate and iron. Magic skitters off its hide.',
  family: 'fam_wards',
  materialKin: 'golem',
  role: 'elite',
  level: 6,
  // HP 130 (DESIGN §6.5 Mistwood elite); legacy HP 50 · dmg 12 · def 5 · agi 2 · XP 85 · magic resistance 80 %
  stats: { hp: 130, atk: 14, sp: 14, armor: 6, ward: 4, agi: 2 },
  tags: ['construct', 'legacy'],
  resistances: { fire: 'resist', ley: 'resist', void: 'resist', chrono: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed'],
  moves: {
    golem_slam: {
      name: 'Slam',
      line: 'Slate fists rise together over your head.',
      type: 'physical',
      power: { coef: 1.2, stat: 'atk' },
      statuses: [{ status: 'status_stun', chance: 0.2, duration: 1 }],
    },
    golem_grind: {
      name: 'Grind',
      line: 'It leans its weight into you, iron on bone.',
      type: 'physical',
      power: { coef: 0.9, stat: 'atk' },
      statuses: [{ status: 'status_armor_break', chance: 0.4, duration: 2 }],
    },
    // "removes its Armor Break; shield self 1.0×": cleanseSelf drops every debuff it carries, Armor Break being the one
    // the player puts on it on purpose
    golem_harden: {
      name: 'Harden',
      line: 'Grit rains from its seams as the slate locks shut.',
      cleanseSelf: true,
      shield: { power: { coef: 1.0, stat: 'atk' } },
    },
    golem_cover: { name: 'Cover', line: 'It steps in front of the other one.', shieldAlly: { power: { coef: 1.0, stat: 'atk' } } },
  },
  pattern: [
    { move: 'golem_harden', target: 'self', when: { selfHas: 'status_armor_break' } },
    // WORLD: "ifAllyPresent and the ally is below 50 %" — no atom reads an ally's HP, so Cover waits only on an ally
    { move: 'golem_cover', target: 'ally', when: { allyPresent: true } },
    { move: 'golem_slam', target: 'player' },
    { move: 'golem_grind', target: 'player' },
  ],
  loot: [
    { itemId: 'mat_slate_core' },
    { itemId: 'mat_iron_rivet', chance: 0.6 },
    // the cores were cut from Silverwood's own trees (D-067.6): ending D's anchor needs no Before
    { itemId: 'mat_silverwood_heartwood', chance: 0.25 },
  ],
  gold: { min: 30, max: 48 },
  xp: 200,
  bestiary: {
    voice: 'remnant_archive',
    summary:
      "Year 30. The golems at the northern ley-knot, once Vane's Watch, turned outward at the third verse on the night of the Sundering and have faced outward since. Haldric Vane built them to shrug off the ritual's backlash, which is why magic skitters off them. Their sigil is a ring with a bar through it. They guard. No one told them what from.",
    tactics:
      "Armor Break, then plain steel; it Hardens the turn after, so break it again on the following turn. Storm on Soaked is the caster's road. Poison does nothing.",
    codexId: 'codex_creatures_wards',
    reveals: [...REVEALS],
  },
  sigil: { base: 'hexagon', details: ['ring_and_bar', 'ember_seams', 'double_outline'] },
} satisfies CreatureInput;

// ---- cr_warding_pillar — Wards · L6 fodder · XP 111 (WORLD §6.4) ---------------------------------------------------------
const wardingPillar = {
  id: 'cr_warding_pillar',
  name: 'Warding Pillar',
  description: "A standing stone cut with Vane's ring-and-bar.",
  family: 'fam_wards',
  materialKin: 'golem',
  role: 'fodder',
  level: 6,
  stats: { hp: 90, atk: 14, sp: 14, armor: 6, ward: 6, agi: 1 },
  tags: ['construct'],
  resistances: { storm: 'weak', fire: 'resist', ley: 'resist', void: 'resist', chrono: 'resist' },
  statusImmunities: ['status_poison', 'status_bleed', 'status_stun'],
  moves: {
    pillar_hum: {
      name: 'Hum',
      line: 'The pillar hums. Your feet grow heavy on the stone.',
      statuses: [{ status: 'status_slow', chance: 0.6, duration: 2 }],
    },
    // shield ally = 10 % of that ally's max HP: 1.0 × ATK 14 is the 10 % of an Outpost Golem's 130
    pillar_ward: { name: 'Ward', line: 'Sigils climb the pillar and leap to its ally.', shieldAlly: { power: { coef: 1.0, stat: 'atk' } } },
    pillar_discharge: { name: 'Discharge', line: "Light gathers at the pillar's iron cap.", type: 'ley', power: { coef: 0.8, stat: 'sp' } },
    // "ends the fight, no loot": it withdraws (the fight closes when it is the last enemy)
    pillar_seal: { name: 'Seal', line: 'The sigils close. The pillar goes still.', leaveCombat: true },
  },
  pattern: [
    { move: 'pillar_ward', target: 'ally', when: { allyPresent: true } },
    { move: 'pillar_discharge', target: 'all', when: { everyNth: 3 } },
    { move: 'pillar_seal', target: 'self', when: { all: [{ roundAtLeast: 6 }, { not: { allyPresent: true } }] } },
    { move: 'pillar_hum', target: 'all' },
  ],
  loot: [
    { itemId: 'mat_slate_core', chance: 0.3 },
    // Silverwood Before only: its three days
    { itemId: 'item_chronal_dust', chance: 0.3, when: { any: [{ beforeDay: 1 }, { beforeDay: 2 }, { beforeDay: 3 }] } },
  ],
  gold: { min: 15, max: 24 },
  xp: 111,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      "A standing stone cut with Vane's ring-and-bar. At the Outpost it was there all along, dormant, and woke when the golems fell. In the Before they guard the Archives' door and the Conflux stair. Alone, it slows me and waits. Beside something bigger, it shields it. Lightning likes its cap.",
    tactics: "Its threat is the Ward it gives a boss, which scales with the boss; break pillars first. item_ward_seal makes the Before's pillars stand aside.",
    codexId: 'codex_creatures_wards',
    reveals: [...REVEALS],
  },
  sigil: { base: 'hexagon', details: ['ring_and_bar'] },
} satisfies CreatureInput;

// ---- cr_stutter_hound — Watch-wardens · L5 anomaly, Loop 2+ · XP 117 (WORLD §6.7, §3.2) ---------------------------------
const stutterHound = {
  id: 'cr_stutter_hound',
  name: 'Stutter Hound',
  description: 'A grey hound that does everything twice.',
  family: 'fam_watch_wardens',
  materialKin: 'aberration',
  role: 'anomaly',
  level: 5,
  stats: { hp: 70, atk: 12, sp: 12, armor: 2, ward: 2, agi: 12 },
  tags: ['breach_born', 'anomaly'],
  resistances: { void: 'weak', chrono: 'resist' },
  statusImmunities: ['status_poison'],
  moves: {
    stutter_bite: {
      name: 'Bite',
      line: 'It bites. It bites again, the same bite.',
      type: 'chrono',
      power: { coef: 0.6, stat: 'sp', hits: 2 },
      statuses: [{ status: 'status_bleed', chance: 0.3, duration: 2 }],
    },
    stutter_skip: { name: 'Skip', line: 'It is behind you. It was never in between.', statuses: [{ status: 'status_phase', duration: 1, target: 'self' }] },
    // WORLD: "repeats its previous move". No move can read the previous one; the Bite is the move WORLD's tactics say it
    // repeats, so the Echo is the Bite's numbers again.
    stutter_echo: {
      name: 'Echo',
      line: 'It does the last thing again, exactly.',
      type: 'chrono',
      power: { coef: 0.6, stat: 'sp', hits: 2 },
      statuses: [{ status: 'status_bleed', chance: 0.3, duration: 2 }],
    },
  },
  pattern: [
    { move: 'stutter_skip', target: 'self', when: { everyNth: 3 } },
    { move: 'stutter_echo', target: 'player', when: { hpBelow: 0.5 } },
    { move: 'stutter_bite', target: 'player' },
  ],
  loot: [
    { itemId: 'mat_frayed_moment' }, // the anomaly's guaranteed material
    { itemId: 'item_chronal_dust', chance: 0.4 },
  ],
  gold: { min: 13, max: 21 },
  xp: 117,
  bestiary: {
    voice: 'wayfinder_notes',
    summary:
      'Loop 2, the Barren Peaks. A grey hound that does everything twice: one bite and the same bite a heartbeat late, like a word caught in a throat. It was not here in Loop 1. I think it came in with me. Void hits it where the second bite comes from.',
    tactics: 'Guard the turn after a Bite (the Echo repeats it); Void.',
    codexId: 'codex_creatures_watch_wardens',
    reveals: [...REVEALS],
  },
  sigil: { base: 'spiral', details: ['after_image'] },
} satisfies CreatureInput;

/** WORLD §6 order within the region: the Wilds (§6.2), Wards (§6.4), Watch-wardens (§6.7). */
export const creatures = [wildlingBrute, rootling, stoneHideGolem, wardingPillar, stutterHound] satisfies CreatureInput[];
