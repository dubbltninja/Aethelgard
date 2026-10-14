// Combat fixtures (U23; PLAN §8, §9.1 "later units may append fixtures for their own systems"). Kept beside the shared
// fixture pack rather than inside it so the explore/saves walks keep their map:
//   combatPack()      — the fixture pack plus what DESIGN §4.12's worked example and the combat tests need: the Wildling
//                       Brute, the Traveler's Sword and the other weapon types, the Elf / Warden / Weaver classes, the
//                       Mistwood Path (a return node on the Mistwood wandering pool, east of the Ruins), a table
//                       encounter for `startCombat`, and the Glass / Pacifist modifiers.
//                       U26 appends DESIGN §5 ability rows for all five classes (at least three per class), a throwable
//                       (Ember Flask), and a Duelist whose moves carry the U26 move parts (riposte, effects, specials).
//   ScriptedRng, D    — an Rng that returns queued draws (the example's printed rolls), and the draw for each roll kind.
//   scriptedStep      — `step`'s accept path (handlers, post-step hooks) over a ScriptedRng.
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import type { AbilityInput } from '@schema/ability';
import type { ClassInput } from '@schema/class';
import type { CreatureInput } from '@schema/creature';
import type { EncounterInput } from '@schema/encounter';
import type { ItemInput } from '@schema/item';
import type { LocationInput } from '@schema/location';
import type { ModifierInput } from '@schema/modifier';
import type { RegionInput } from '@schema/region';
import {
  Ctx,
  HANDLERS,
  POST_STEP_HOOKS,
  RejectSignal,
  Rng,
  type Action,
  type GameEvent,
  type GameState,
  type Profile,
  type StepCtx,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { FIXTURE_VERSION, miniContentTables } from './miniContent';

export const MISTWOOD = 'loc_mistwood_path';
export const BRUTE = 'cr_wildling_brute';
export const SHADE = 'cr_corrupted_shade';

/** DESIGN §4.12: L4 fodder, HP 64, ATK 11, armor 3, ward 0, AGI 3; strike → strike → maul → {hp < 50 %: root_knit | strike}. */
const wildlingBrute = {
  id: BRUTE,
  name: 'Wildling Brute',
  legacyName: 'Wildling Brute',
  description: 'A hulking, savage creature from the Mistwood, covered in coarse fur and twisted bark.',
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'fodder',
  level: 4,
  stats: { hp: 64, atk: 11, armor: 3, ward: 0, agi: 3 },
  moves: {
    brute_strike: { name: 'Strike', line: 'It swings a knotted fist.', type: 'physical', power: { coef: 1.0, stat: 'atk' } },
    brute_maul: { name: 'Maul', line: 'It rears back with both arms.', type: 'physical', power: { coef: 1.6, stat: 'atk' } },
    brute_root_knit: {
      name: 'Root Knit',
      line: 'Bark creeps over its wounds.',
      statuses: [{ status: 'status_regen', duration: 2, target: 'self', power: { base: 3 } }],
    },
  },
  pattern: [
    { move: 'brute_strike', target: 'player' },
    { move: 'brute_strike', target: 'player' },
    { move: 'brute_maul', target: 'player' },
    { if: { hpBelow: 0.5 }, then: [{ move: 'brute_root_knit', target: 'self' }], else: [{ move: 'brute_strike', target: 'player' }] },
  ],
  loot: [
    { itemId: 'item_ley_touched_tonic', chance: 0.6 },
    { itemId: 'item_wildling_hide_armor', chance: 0.25 },
    { itemId: 'mat_wildling_hide', chance: 0.8 },
  ],
  gold: { min: 11, max: 18 },
  xp: 71,
  bestiary: { voice: 'wayfinder_notes', summary: 'Fixture: the §4.12 Brute.' },
  sigil: { base: 'brute' },
} satisfies CreatureInput;

const items = [
  {
    id: 'item_travelers_sword', name: "Traveler's Sword", legacyName: "Traveler's Sword", type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 1,
    description: 'A reliable, if unremarkable, blade.', stats: { power: 5 }, value: 20, art: { icon: 'sword' },
  },
  {
    id: 'item_primitive_bow', name: 'Primitive Bow', type: 'weapon', slot: 'weapon', weaponType: 'ranged_bow', tier: 1,
    description: 'Fixture: a bent stave and gut string.', stats: { power: 4 }, value: 12, art: { icon: 'bow' },
  },
  {
    id: 'item_nomads_maul', name: "Nomad's Maul", type: 'weapon', slot: 'weapon', weaponType: 'shield_heavy', tier: 1,
    description: 'Fixture: a hammer the size of a door handle.', stats: { power: 5 }, value: 20, art: { icon: 'maul' },
  },
  {
    id: 'item_cracked_void_focus', name: 'Cracked Void Focus', type: 'weapon', slot: 'weapon', weaponType: 'void_focus', tier: 1,
    description: 'Fixture: a split stone that hums.', stats: { power: 2, spellPower: 2 }, value: 20, art: { icon: 'focus' },
  },
  { id: 'mat_wildling_hide', name: 'Wildling Hide', type: 'material', tier: 1, description: 'Fixture: coarse hide.', value: 4, art: { icon: 'hide' } },
] satisfies ItemInput[];

const branch = (id: string, name: string) => ({ id, name, description: `The ${name} branch.` });

/** DESIGN §3.3 / §5.4–5.6 base stats and resource rules (no trees: the combat tests need only the resources). */
const classes = [
  {
    id: 'elf', name: 'Elf', title: 'ley-duelist', legacy: true, sigil: 'elf', dialogueTag: 'elf', description: 'Fixture.', intro: 'Fixture.',
    baseStats: { hp: 90, mp: 44, strength: 7, magic: 7, agility: 10 },
    growth: { hp: 7, mp: 4 },
    resource: { name: 'Mana', rules: [{ on: 'dodge', amount: 10 }, { on: 'crit', amount: 6 }, { on: 'guard', amount: 5 }] },
    branches: [branch('bladesong', 'Bladesong'), branch('leyweave', 'Leyweave'), branch('shadowstep', 'Shadowstep')],
    starterItems: [{ itemId: 'item_primitive_bow', equip: true }],
  },
  {
    id: 'ironclad_warden', name: 'Ironclad Warden', title: "the Nomads' wall", sigil: 'warden', dialogueTag: 'warden', description: 'Fixture.', intro: 'Fixture.',
    baseStats: { hp: 116, mp: 30, strength: 12, magic: 5, agility: 7 },
    growth: { hp: 11, mp: 2 },
    resource: { name: 'Grit', rules: [{ on: 'hit_taken', amount: 6 }, { on: 'guard', amount: 8 }, { on: 'taunt', amount: 4 }] },
    branches: [branch('bulwark', 'Bulwark'), branch('breaker', 'Breaker'), branch('iron_will', 'Iron Will')],
    starterItems: [{ itemId: 'item_nomads_maul', equip: true }],
  },
  {
    id: 'shadow_weaver', name: 'Shadow Weaver', title: 'void-touched', sigil: 'weaver', dialogueTag: 'weaver', description: 'Fixture.', intro: 'Fixture.',
    baseStats: { hp: 90, mp: 48, strength: 6, magic: 10, agility: 8 },
    growth: { hp: 7, mp: 4 },
    resource: { name: 'Mana', rules: [{ on: 'guard', amount: 5 }], bloodPrice: { hpPerMp: 2 } },
    branches: [branch('hex', 'Hex'), branch('drain', 'Drain'), branch('unmaking', 'Unmaking')],
    starterItems: [{ itemId: 'item_cracked_void_focus', equip: true }],
  },
] satisfies ClassInput[];

/** WORLD §2.2 shape; the return chance is 100 % so a return visit always rolls the pool. */
const mistwood = {
  id: 'region_mistwood_ironclad_reach',
  name: 'Mistwood & the Ironclad Reach',
  description: 'Fixture: the wood past the Ruins.',
  order: 2,
  levelBand: { min: 2, max: 6 },
  legacy: true,
  palette: { bg: '#1E2B1E', bgAlt: '#2F4A2F', fg: '#4F6F4F', accent: '#B5D99C', glow: '#B5D99C' },
  ambient: 'mistwood_rain',
  wanderingPool: [
    { creatureId: BRUTE, weight: 1 },
    { creatureId: SHADE, weight: 1 },
  ],
  returnEncounterChance: 1,
} satisfies RegionInput;

const mistwoodPath = {
  id: MISTWOOD,
  regionId: 'region_mistwood_ironclad_reach',
  name: 'Mistwood Path',
  description: 'Fixture: a muddy trail under dripping branches.',
  exits: [{ dir: 'west', to: 'loc_whispering_ruins' }],
  art: { template: 'forest' },
  map: { x: 8, y: 6 },
} satisfies LocationInput;

/** For `startCombat` effects (ids are global across the table and location encounters). */
const encounters = [{ id: 'enc_brute_ambush', groups: [{ creatureId: BRUTE }], intro: 'Something heavy breaks through the ferns.' }] satisfies EncounterInput[];

const modifiers = [
  { id: 'mod_glass', name: 'Glass', description: 'Everything deals double damage.', rules: [{ kind: 'damage_multiplier', outgoing: 2, incoming: 2 }], icon: 'glass' },
  { id: 'mod_pacifist', name: "Pacifist's Vow", description: 'Kill XP 0.', rules: [{ kind: 'xp_sources', allow: ['quest', 'discovery'] }], icon: 'vow' },
] satisfies ModifierInput[];

// ---- U26: abilities, a throwable, the Duelist -------------------------------------------------------------------------------

export const DUELIST = 'cr_fixture_duelist';

type A = AbilityInput;
const cls = (id: string, ownerId: string, branch: string, tier: number, name: string, rest: Omit<A, 'id' | 'ownerId' | 'branch' | 'tier' | 'name' | 'description'>): A => ({
  id, ownerId, branch, tier, name, description: `Fixture: DESIGN §5 ${name}.`, ...rest,
});
const R = (id: string, branch: string, tier: number, name: string, rest: Omit<A, 'id' | 'ownerId' | 'branch' | 'tier' | 'name' | 'description'>) => cls(id, 'ranger', branch, tier, name, rest);
const W = (id: string, branch: string, tier: number, name: string, rest: Omit<A, 'id' | 'ownerId' | 'branch' | 'tier' | 'name' | 'description'>) => cls(id, 'wizard', branch, tier, name, rest);
const E = (id: string, branch: string, tier: number, name: string, rest: Omit<A, 'id' | 'ownerId' | 'branch' | 'tier' | 'name' | 'description'>) => cls(id, 'elf', branch, tier, name, rest);
const K = (id: string, branch: string, tier: number, name: string, rest: Omit<A, 'id' | 'ownerId' | 'branch' | 'tier' | 'name' | 'description'>) => cls(id, 'ironclad_warden', branch, tier, name, rest);
const V = (id: string, branch: string, tier: number, name: string, rest: Omit<A, 'id' | 'ownerId' | 'branch' | 'tier' | 'name' | 'description'>) => cls(id, 'shadow_weaver', branch, tier, name, rest);
const notBoss = { targetIsBoss: false } as const;
const boss = { targetIsBoss: true } as const;

/** DESIGN §5.2–5.6 rows (the fixture pack already has Marked Shot, Rend, Piercing Arrow, Fireball, Echo Bolt, Temporal Drag). */
export const u26Abilities: AbilityInput[] = [
  // Ranger (§5.2)
  R('rgr_venom_coat', 'wildcraft', 1, 'Venom Coat', { mp: 6, target: 'self', statuses: [{ status: 'status_poison', chance: 1, duration: 4 }] }),
  R('rgr_riposte_stance', 'steel', 2, 'Riposte Stance', { mp: 8, target: 'self', damageType: 'physical', power: { coef: 0.8, stat: 'atk' }, special: 'counter_stance', cooldown: 3 }),
  R('rgr_field_dressing', 'wildcraft', 2, 'Field Dressing', { mp: 10, target: 'self_or_ally', heal: { base: 18, coef: 0.8, stat: 'maxStrAgi', target: 'ally' }, outOfCombat: [{ heal: { hp: 20 } }] }),
  R('rgr_hunters_eye', 'hunt', 3, "Hunter's Eye", { mp: 10, target: 'self', special: 'foresight', cooldown: 4 }),
  R('rgr_hamstring', 'steel', 3, 'Hamstring', {
    mp: 10, target: 'enemy', damageType: 'physical', power: { coef: 0.9, stat: 'atk' },
    statuses: [{ status: 'status_slow', duration: 2 }, { status: 'status_bleed', duration: 3, when: { targetHas: 'status_bleed' } }],
  }),
  R('rgr_snare_trap', 'wildcraft', 3, 'Snare Trap', {
    mp: 12, target: 'enemy', damageType: 'physical', power: { coef: 0.5, stat: 'atk' }, special: 'trap', cooldown: 3,
    statuses: [{ status: 'status_stun', duration: 1, when: notBoss }, { status: 'status_slow', duration: 2, when: boss }],
  }),
  R('rgr_pinning_shot', 'hunt', 4, 'Pinning Shot', { mp: 14, target: 'enemy', damageType: 'physical', power: { coef: 1.0, stat: 'atk' }, interrupt: true, statuses: [{ status: 'status_slow', duration: 2 }], cooldown: 3 }),
  R('rgr_whirling_steel', 'steel', 4, 'Whirling Steel', { mp: 16, target: 'all_enemies', damageType: 'physical', power: { coef: 0.85, stat: 'atk' }, statuses: [{ status: 'status_bleed', duration: 3, when: { targetHas: 'status_bleed' } }] }),
  R('rgr_smoke_bomb', 'wildcraft', 4, 'Smoke Bomb', { mp: 12, target: 'all_enemies', statuses: [{ status: 'status_blind', duration: 2 }], cooldown: 3 }),
  R('rgr_killing_shot', 'hunt', 5, 'Killing Shot', { mp: 24, target: 'enemy', damageType: 'physical', power: { coef: 2.2, stat: 'atk' }, special: 'mark_execute', onKill: { refundMp: 24 }, cooldown: 4 }),
  R('rgr_exsanguinate', 'steel', 5, 'Exsanguinate', { mp: 20, target: 'enemy', damageType: 'physical', power: { coef: 1.4, stat: 'atk' }, cooldown: 4 }),
  // Wizard (§5.3)
  W('wiz_static_lash', 'storm', 1, 'Static Lash', { mp: 8, target: 'enemy', damageType: 'storm', spell: true, power: { base: 2, coef: 1.1, stat: 'sp' }, statuses: [{ status: 'status_shock', chance: 0.5, duration: 2 }] }),
  W('wiz_lightning_bolt', 'storm', 2, 'Lightning Bolt', { mp: 14, target: 'enemy', damageType: 'storm', spell: true, power: { base: 4, coef: 1.7, stat: 'sp' }, special: 'chain', statuses: [{ status: 'status_shock', duration: 2 }] }),
  W('wiz_cinder_shield', 'pyre', 2, 'Cinder Shield', { mp: 10, target: 'self', shield: { base: 10, coef: 1.5, stat: 'sp', turns: 3 }, cooldown: 3 }),
  W('wiz_flame_wave', 'pyre', 3, 'Flame Wave', { mp: 18, target: 'all_enemies', damageType: 'fire', spell: true, power: { base: 3, coef: 1.0, stat: 'sp' }, statuses: [{ status: 'status_burn', chance: 0.6, duration: 3 }] }),
  W('wiz_rewind', 'chronomancy', 3, 'Rewind', { mp: 14, target: 'self_or_ally', special: 'rewind', cooldown: 4 }),
  W('wiz_immolate', 'pyre', 4, 'Immolate', { mp: 16, target: 'enemy', damageType: 'fire', spell: true, power: { coef: 1.2, stat: 'sp' } }),
  W('wiz_stutter', 'chronomancy', 4, 'Stutter', {
    mp: 16, target: 'enemy', damageType: 'chrono', spell: true, power: { coef: 0.6, stat: 'sp' }, interrupt: true, cooldown: 3,
    statuses: [{ status: 'status_stun', duration: 1, when: notBoss }, { status: 'status_slow', duration: 2, when: boss }],
  }),
  W('wiz_pyre_of_the_nine', 'pyre', 5, 'Pyre of the Nine', {
    mp: 30, target: 'all_enemies', damageType: 'fire', spell: true, power: { base: 10, coef: 2.0, stat: 'sp' }, selfCost: { hpPctMax: 0.1 }, cooldown: 4,
    statuses: [{ status: 'status_burn', duration: 3 }, { status: 'status_armor_break', duration: 2 }],
  }),
  // Elf (§5.4)
  E('elf_twin_strike', 'bladesong', 1, 'Twin Strike', { mp: 8, target: 'enemy', damageType: 'physical', power: { coef: 0.65, stat: 'atk', hits: 2 } }),
  E('elf_ley_mend', 'leyweave', 1, 'Ley Mend', { mp: 8, target: 'self_or_ally', heal: { base: 14, coef: 1.2, stat: 'sp', target: 'ally' }, outOfCombat: [{ heal: { hp: 20 } }] }),
  E('elf_shadowstep', 'shadowstep', 1, 'Shadowstep', { mp: 6, target: 'self', special: 'phase', cooldown: 2 }),
  E('elf_ambush', 'shadowstep', 2, 'Ambush', {
    mp: 12, target: 'enemy', damageType: 'physical', power: { coef: 1.6, stat: 'atk' },
    bonuses: [{ when: { any: [{ selfHas: 'status_phase' }, { targetHasActed: false }] }, mult: 1.5 }],
  }),
  E('elf_barkskin', 'leyweave', 2, 'Barkskin', {
    mp: 10, target: 'self_or_ally', shield: { base: 12, coef: 1.4, stat: 'sp', turns: 3 }, cooldown: 3,
    statuses: [{ status: 'status_regen', duration: 3, power: { base: 4, coef: 0.4, stat: 'sp' } }],
  }),
  E('elf_thornlash', 'leyweave', 3, 'Thornlash', { mp: 12, target: 'enemy', damageType: 'ley', spell: true, power: { base: 4, coef: 1.3, stat: 'sp' }, statuses: [{ status: 'status_bleed', duration: 3 }] }),
  E('elf_blink_strike', 'shadowstep', 3, 'Blink Strike', { mp: 12, target: 'enemy', damageType: 'physical', power: { coef: 1.1, stat: 'atk' }, statuses: [{ status: 'status_weaken', duration: 2 }] }),
  E('elf_silverwood_bloom', 'leyweave', 4, 'Silverwood Bloom', {
    mp: 16, target: 'party', special: 'cleanse', cooldown: 4,
    statuses: [{ status: 'status_regen', duration: 3, power: { base: 6, coef: 0.3, stat: 'sp' } }, { status: 'status_soaked', duration: 3, target: 'all_enemies' }],
  }),
  E('elf_veilwalk', 'shadowstep', 4, 'Veilwalk', { mp: 14, target: 'party', special: 'phase', cooldown: 4 }),
  // Ironclad Warden (§5.5)
  K('wrd_iron_guard', 'bulwark', 1, 'Iron Guard', { mp: 6, target: 'self', special: 'guard' }),
  K('wrd_challenge', 'bulwark', 2, 'Challenge', { mp: 8, target: 'all_enemies', statuses: [{ status: 'status_taunt', duration: 2 }], cooldown: 2 }),
  K('wrd_shield_wall', 'bulwark', 3, 'Shield Wall', { mp: 12, target: 'party', shield: { base: 18, coef: 1.2, stat: 'atk', turns: 3 }, cooldown: 3 }),
  K('wrd_crushing_blow', 'breaker', 1, 'Crushing Blow', { mp: 8, target: 'enemy', damageType: 'physical', power: { coef: 1.3, stat: 'atk' }, statuses: [{ status: 'status_armor_break', duration: 3 }] }),
  K('wrd_concussive_slam', 'breaker', 2, 'Concussive Slam', {
    mp: 12, target: 'enemy', damageType: 'physical', power: { coef: 1.0, stat: 'atk' }, cooldown: 3,
    statuses: [{ status: 'status_stun', chance: 0.75, duration: 1, when: notBoss }, { status: 'status_weaken', duration: 2, when: boss }],
  }),
  K('wrd_earthbreaker', 'breaker', 3, 'Earthbreaker', { mp: 16, target: 'all_enemies', damageType: 'physical', power: { coef: 0.9, stat: 'atk' }, statuses: [{ status: 'status_slow', duration: 2 }] }),
  K('wrd_executioners_arc', 'breaker', 4, "Executioner's Arc", {
    mp: 16, target: 'enemy', damageType: 'physical', power: { coef: 1.6, stat: 'atk' },
    bonuses: [{ when: { any: [{ targetHas: 'status_armor_break' }, { targetHas: 'status_stun' }] }, mult: 1.5 }],
  }),
  K('wrd_steady_breath', 'iron_will', 1, 'Steady Breath', { mp: 6, target: 'self', heal: { base: 10, coef: 0.6, stat: 'atk' }, outOfCombat: [{ heal: { hp: 15 } }] }),
  // Shadow Weaver (§5.6)
  V('wvr_hex_of_frailty', 'hex', 1, 'Hex of Frailty', { mp: 8, target: 'enemy', damageType: 'void', spell: true, power: { base: 2, coef: 0.9, stat: 'sp' }, statuses: [{ status: 'status_weaken', duration: 2 }] }),
  V('wvr_mark_of_the_void', 'hex', 2, 'Mark of the Void', { mp: 10, target: 'enemy', damageType: 'void', spell: true, power: { coef: 0.8, stat: 'sp' }, statuses: [{ status: 'status_curse', duration: 3 }] }),
  V('wvr_wither', 'hex', 3, 'Wither', {
    mp: 16, target: 'all_enemies', damageType: 'void', spell: true, power: { coef: 0.8, stat: 'sp' },
    statuses: [{ status: 'status_weaken', chance: 0.6, duration: 2 }, { status: 'status_slow', duration: 2, when: { targetHas: 'status_curse' } }],
  }),
  V('wvr_doom_sigil', 'hex', 4, 'Doom Sigil', { mp: 14, target: 'enemy', damageType: 'void', spell: true, power: { coef: 3.0, stat: 'sp' }, statuses: [{ status: 'status_stun', duration: 1, when: { targetHas: 'status_curse' } }], cooldown: 4 }),
  V('wvr_siphon', 'drain', 1, 'Siphon', { mp: 8, target: 'enemy', damageType: 'void', spell: true, power: { base: 2, coef: 1.0, stat: 'sp' }, special: 'drain' }),
  V('wvr_blood_pact', 'drain', 2, 'Blood Pact', { mp: 0, target: 'self', selfCost: { hpPctMax: 0.15 }, special: 'resource_convert', cooldown: 2 }),
  V('wvr_void_lance', 'unmaking', 1, 'Void Lance', { mp: 10, target: 'enemy', damageType: 'void', spell: true, power: { base: 3, coef: 1.3, stat: 'sp' }, selfCost: { hpPctMax: 0.08 } }),
  V('wvr_unravel', 'unmaking', 2, 'Unravel', { mp: 12, target: 'enemy', damageType: 'chrono', spell: true, power: { coef: 1.1, stat: 'sp' } }),
  V('wvr_breach_echo', 'unmaking', 3, 'Breach Echo', { mp: 10, target: 'self', special: 'phase', selfCost: { hpPctMax: 0.05 }, cooldown: 3 }),
  V('wvr_collapse', 'unmaking', 4, 'Collapse', { mp: 20, target: 'all_enemies', damageType: 'void', spell: true, power: { base: 2, coef: 1.3, stat: 'sp' }, selfCost: { hpPctMax: 0.12 } }),
  V('wvr_unmaking_word', 'unmaking', 5, 'The Unmaking Word', {
    mp: 30, target: 'enemy', damageType: 'void', spell: true, power: { base: 10, coef: 3.2, stat: 'sp' }, selfCost: { hpPctCur: 0.4 }, special: 'unmaking', onKill: { refundMp: 20 }, cooldown: 5,
  }),
  // a throwable's ability (DESIGN §7.9 `item_ember_flask`: Fire 25 + Burn)
  { id: 'itm_ember_flask', ownerId: 'item_ember_flask', name: 'Ember Flask', description: 'Fixture: Fire 25 + Burn.', target: 'enemy', damageType: 'fire', power: { base: 25, coef: 0, stat: 'atk' }, statuses: [{ status: 'status_burn', duration: 3 }] },
];

const u26Items = [
  {
    id: 'item_ember_flask', name: 'Ember Flask', type: 'consumable', tier: 1, description: 'Fixture: a stoppered flask of forge-fire.',
    onUse: [{ counter: { name: 'flasks_thrown', delta: 1 } }], passives: [{ kind: 'grantAbility', abilityId: 'itm_ember_flask' }], value: 15, art: { icon: 'flask' },
  },
] satisfies ItemInput[];

/** A creature whose moves carry U26's move parts: riposte, multiHit, healOnDamage, stripBuffs and move specials. */
const duelist = {
  id: DUELIST,
  name: 'Fixture Duelist',
  description: 'Fixture: every U26 move part on one body.',
  family: 'fam_wilds',
  role: 'fodder',
  level: 3,
  stats: { hp: 60, atk: 10, sp: 10, armor: 1, ward: 1, agi: 4 },
  moves: {
    duel_set: { name: 'Set', line: 'It sets its feet and waits for you to strike.', riposte: { power: { coef: 1.0, stat: 'atk' }, turns: 1 } },
    duel_lunge: { name: 'Lunge', line: 'Two quick cuts.', type: 'physical', power: { coef: 0.5, stat: 'atk' }, effects: [{ multiHit: { hits: 2 } }] },
    duel_drink: { name: 'Drink', line: 'It bites and drinks.', type: 'physical', power: { coef: 1.0, stat: 'atk' }, effects: [{ healOnDamage: { pct: 0.5 } }] },
    duel_take: { name: 'Take', line: 'It pulls the ward off you.', effects: [{ stripBuffs: { kinds: ['shield', 'regen'] } }] },
    duel_parry: { name: 'Parry', line: 'It strikes and stays on guard.', type: 'physical', power: { coef: 0.5, stat: 'atk' }, special: 'counter_stance' },
    duel_leech: { name: 'Leech', line: 'Void runs from you to it.', type: 'void', power: { coef: 1.0, stat: 'sp' }, special: 'drain' },
    duel_arc: { name: 'Arc', line: 'Lightning jumps between you.', type: 'storm', power: { coef: 1.0, stat: 'sp' }, special: 'chain' },
    duel_press: { name: 'The Hour Presses', line: 'The hour leans on you.', special: 'hour_presses' },
    duel_dead_spell: { name: 'Dead Spell', line: 'Something not its own.', special: 'bound_mage' },
    duel_mend: { name: 'Mend', line: 'It cleans its wounds.', special: 'cleanse' },
    duel_guard: { name: 'Brace', line: 'It braces.', special: 'guard' },
  },
  pattern: [{ move: 'duel_lunge', target: 'player' }],
  gold: { min: 1, max: 1 },
  xp: 10,
  bestiary: { voice: 'wayfinder_notes', summary: 'Fixture: U26 move parts.' },
  sigil: { base: 'duelist' },
} satisfies CreatureInput;

/** The combat tables: the fixture's plus the records above (the Ruins gain an exit east to the Mistwood Path). */
export function combatTables(patch: (t: { locations: LocationInput[] }) => void = () => {}): ContentTables {
  const locations: LocationInput[] = miniContentTables.locations.map((loc) =>
    loc.id === 'loc_whispering_ruins' ? { ...clone(loc), exits: [...clone(loc.exits ?? []), { dir: 'east', to: MISTWOOD }] } : clone(loc),
  );
  locations.push(clone(mistwoodPath));
  patch({ locations });
  return {
    ...miniContentTables,
    regions: [...miniContentTables.regions, mistwood],
    locations,
    creatures: [...miniContentTables.creatures, wildlingBrute, duelist],
    items: [...miniContentTables.items, ...items, ...u26Items],
    abilities: [...miniContentTables.abilities, ...u26Abilities],
    classes: [...miniContentTables.classes, ...classes],
    encounters: [...miniContentTables.encounters, ...encounters],
    modifiers: [...miniContentTables.modifiers, ...modifiers],
  };
}

let cached: ContentPack | null = null;

/** The combat pack (built and validated like the fixture pack); `patch` builds an uncached variant. */
export function combatPack(patch?: (t: { locations: LocationInput[] }) => void): ContentPack {
  if (patch) return buildContentPack(combatTables(patch), { version: FIXTURE_VERSION });
  cached ??= buildContentPack(combatTables(), { version: FIXTURE_VERSION });
  return cached;
}

// ---- scripted rolls ---------------------------------------------------------------------------------------------------

/** An Rng whose `next()` returns queued draws in order; running out throws, so a test pins the exact draw count. */
export class ScriptedRng extends Rng {
  readonly queue: number[];
  constructor(draws: readonly number[]) {
    super([1, 2, 3, 4]);
    this.queue = [...draws];
  }
  override next(): number {
    const v = this.queue.shift();
    if (v === undefined) throw new Error('ScriptedRng: out of draws');
    return v;
  }
}

/** The `next()` value that makes each kind of roll come out as wanted (Rng.int/chance/weighted map draws linearly). */
export const D = {
  /** `rng.int(0, 99)` → `roll` (the percentage rolls: hit, crit, status chances). */
  pct: (roll: number): number => (roll + 0.5) / 100,
  /** `rng.int(min, max)` → `k`. */
  int: (k: number, min: number, max: number): number => (k - min + 0.5) / (max - min + 1),
  /** The initiative d4. */
  d4: (k: number): number => (k - 0.5) / 4,
  /** Variance U(0.90, 1.10) → `v`. */
  variance: (v: number): number => (v - 0.9) / 0.2,
  /** `rng.chance(p)` / `weighted` first entry: passes; `no` fails any p < 1. */
  yes: 0,
  no: 0.999999,
};

class ScriptedCtx extends Ctx {
  readonly #scripted: Rng;
  constructor(s: GameState, profile: Profile, content: ContentPack, rng: Rng) {
    super(s, profile, content);
    this.#scripted = rng;
  }
  override get rng(): Rng {
    return this.#scripted;
  }
}

/** A StepCtx over a clone of `state` with scripted draws (for calling setup and pipeline functions directly). */
export function scriptedCtx(state: GameState, draws: readonly number[], content: ContentPack, profile: Profile): StepCtx & { rng: ScriptedRng } {
  return new ScriptedCtx(clone(state), profile, content, new ScriptedRng(draws)) as unknown as StepCtx & { rng: ScriptedRng };
}

export interface ScriptedResult {
  state: GameState;
  events: GameEvent[];
  rejected: string | null;
  /** Draws left unused. */
  left: number;
}

/** `step`'s accept path (the action's handler, then POST_STEP_HOOKS) with scripted draws; no mode gate or freeze. */
export function scriptedStep(state: GameState, action: Action, draws: readonly number[], content: ContentPack, profile: Profile): ScriptedResult {
  const ctx = scriptedCtx(state, draws, content, profile);
  try {
    (HANDLERS[action.type] as (c: StepCtx, a: Action) => void)(ctx, action);
    for (const hook of POST_STEP_HOOKS) hook(ctx);
  } catch (e) {
    if (e instanceof RejectSignal) return { state, events: [], rejected: e.reason, left: ctx.rng.queue.length };
    throw e;
  }
  ctx.s.meta.stepCount += 1;
  return { state: ctx.s, events: ctx.events, rejected: null, left: ctx.rng.queue.length };
}
