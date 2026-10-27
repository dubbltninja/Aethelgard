// The six companions' 24 abilities (DESIGN §12.4: three auto abilities and a signature each; D-053, D-066 #12, D-080).
// Ids are `comp_<companion>_…` (D-044). Companions have no MP: an auto ability's cooldown follows from its `kind` (attack 0,
// debuff/aoe/utility/buff 2, heal/shield/cleanse 3), a signature's from the companion record (`signature.cooldown`, 4–5).
// The numbers are DESIGN §12.4's, as U28 transcribed them into the companion fixture (tests/fixtures/companionContent.ts and
// the fixture pack's Ilyra) and the engine tests cast them. `description` is the play text (DESIGN has no flavor lines for
// companion abilities, so there are no `flavor` fields). Each companion's record, which names these rows, is in
// src/content/shared/companions.ts.
//
// NOT REGISTERED YET. A companion ability needs its companion record, and a companion record names its NPC, arc quests and
// camp scenes, none of which exist yet (validator rule 1), so these rows are exported but left out of `contentTables`
// (D-088). Registered by the unit that lands the last NPC/quest/scene they reference (U56).
//
// Two clauses of DESIGN §12.4 the ability fields cannot say are scripted by ability id in the engine
// (src/engine/combat/abilities.ts COMPANION_SCRIPTS; D-089, U34c), so these rows carry the rest of their effect as data and
// the descriptions state the whole of it:
//   comp_mireya_lanternreed_bloom  "party heal 30% max HP": `heal` is base + coef·stat, with no share of max HP;
//   comp_ilyra_archive_light       "all hidden intents revealed for 2 turns": no field or special reveals hidden intents.
import type { AbilityInput } from '@schema/ability';

export const companionAbilities = [
  // ---- Ilyra: support / Ley caster -------------------------------------------------------------------------------------
  {
    id: 'comp_ilyra_ley_dart',
    ownerId: 'ilyra',
    kind: 'attack',
    name: 'Ley Dart',
    description: '1.0·SP Ley to one enemy.',
    target: 'enemy',
    damageType: 'ley',
    power: { coef: 1.0, stat: 'sp' },
  },
  {
    id: 'comp_ilyra_ward',
    ownerId: 'ilyra',
    kind: 'shield',
    name: 'Ward',
    description: 'Shield an ally for 10 + 1.2·SP for 3 turns.',
    target: 'ally',
    shield: { base: 10, coef: 1.2, stat: 'sp', turns: 3 },
  },
  {
    id: 'comp_ilyra_mend',
    ownerId: 'ilyra',
    kind: 'heal',
    name: 'Mend',
    description: 'Heal an ally for 12 + 1.1·SP.',
    target: 'ally',
    heal: { base: 12, coef: 1.1, stat: 'sp', target: 'ally' },
  },
  {
    id: 'comp_ilyra_archive_light',
    ownerId: 'ilyra',
    kind: 'signature',
    name: 'Archive Light',
    description: 'Cleanse your party, Shield you both for 10 + 1.5·SP, and reveal every hidden enemy intent for 2 turns.',
    target: 'party',
    shield: { base: 10, coef: 1.5, stat: 'sp' },
    special: 'cleanse',
  },

  // ---- Brak: bruiser / tank --------------------------------------------------------------------------------------------
  {
    id: 'comp_brak_axe',
    ownerId: 'brak',
    kind: 'attack',
    name: 'Axe',
    description: '1.1·ATK Physical to one enemy.',
    target: 'enemy',
    damageType: 'physical',
    power: { coef: 1.1, stat: 'atk' },
  },
  {
    id: 'comp_brak_cleave',
    ownerId: 'brak',
    kind: 'aoe',
    name: 'Cleave',
    description: '0.8·ATK Physical to every enemy.',
    target: 'all_enemies',
    damageType: 'physical',
    power: { coef: 0.8, stat: 'atk' },
  },
  {
    id: 'comp_brak_shieldbreak',
    ownerId: 'brak',
    kind: 'debuff',
    name: 'Shieldbreak',
    description: '0.7·ATK Physical to one enemy, and Armor Break for 3 turns.',
    target: 'enemy',
    damageType: 'physical',
    power: { coef: 0.7, stat: 'atk' },
    statuses: [{ status: 'status_armor_break', duration: 3 }],
  },
  {
    id: 'comp_brak_hold_the_line',
    ownerId: 'brak',
    kind: 'signature',
    name: 'Hold the Line',
    description: 'Taunt every enemy for 2 turns, Guard, and Shield himself for 1.0·ATK + 15.',
    target: 'self',
    shield: { base: 15, coef: 1.0, stat: 'atk' },
    special: 'guard',
    statuses: [{ status: 'status_taunt', target: 'all_enemies', duration: 2 }],
  },

  // ---- Nyx: Void caster ------------------------------------------------------------------------------------------------
  {
    id: 'comp_nyx_void_needle',
    ownerId: 'nyx',
    kind: 'attack',
    name: 'Void Needle',
    description: '1.1·SP Void to one enemy.',
    target: 'enemy',
    damageType: 'void',
    power: { coef: 1.1, stat: 'sp' },
  },
  {
    id: 'comp_nyx_hex',
    ownerId: 'nyx',
    kind: 'debuff',
    name: 'Hex',
    description: '0.6·SP Void to one enemy, and Weaken for 2 turns.',
    target: 'enemy',
    damageType: 'void',
    power: { coef: 0.6, stat: 'sp' },
    statuses: [{ status: 'status_weaken', duration: 2 }],
  },
  {
    id: 'comp_nyx_drink',
    ownerId: 'nyx',
    kind: 'heal',
    name: 'Drink',
    description: '0.8·SP Void to one enemy; Nyx heals for 60% of the damage dealt.',
    target: 'enemy',
    damageType: 'void',
    power: { coef: 0.8, stat: 'sp' },
    special: 'drain',
  },
  {
    id: 'comp_nyx_unmaking',
    ownerId: 'nyx',
    kind: 'signature',
    name: 'Unmaking',
    description: '1.6·SP Void to every enemy; it destroys Shields and Rewinds. Costs 10% of Nyx\'s max HP.',
    target: 'all_enemies',
    damageType: 'void',
    power: { coef: 1.6, stat: 'sp' },
    selfCost: { hpPctMax: 0.1 },
  },

  // ---- Dask: Chrono phantom (location-restricted, §12.8) ---------------------------------------------------------------
  {
    id: 'comp_dask_flicker_strike',
    ownerId: 'dask',
    kind: 'attack',
    name: 'Flicker Strike',
    description: '1.0·SP Chrono to one enemy. Chrono ignores Phase.',
    target: 'enemy',
    damageType: 'chrono',
    power: { coef: 1.0, stat: 'sp' },
  },
  {
    id: 'comp_dask_stall',
    ownerId: 'dask',
    kind: 'debuff',
    name: 'Stall',
    description: '0.5·SP Chrono to one enemy, and Slow for 2 turns.',
    target: 'enemy',
    damageType: 'chrono',
    power: { coef: 0.5, stat: 'sp' },
    statuses: [{ status: 'status_slow', duration: 2 }],
  },
  {
    id: 'comp_dask_glimpse',
    ownerId: 'dask',
    kind: 'utility',
    name: 'Glimpse',
    description: 'The party sees each enemy\'s next two intents.',
    target: 'self',
    special: 'foresight',
  },
  {
    id: 'comp_dask_between_instants',
    ownerId: 'dask',
    kind: 'signature',
    name: 'Between Instants',
    description: 'Rewind you for 2 turns, and Haste you both for 2 turns.',
    target: 'party',
    statuses: [
      { status: 'status_rewind', target: 'ally', duration: 2 },
      { status: 'status_haste', target: 'all_allies', duration: 2 },
    ],
  },

  // ---- Mireya: nature / glow healer ------------------------------------------------------------------------------------
  {
    id: 'comp_mireya_glowsalve',
    ownerId: 'mireya',
    kind: 'heal',
    name: 'Glowsalve',
    description: 'Heal an ally for 10 + 1.0·SP and give it Regen of 3 + 0.3·SP per turn for 3 turns.',
    target: 'ally',
    heal: { base: 10, coef: 1.0, stat: 'sp', target: 'ally' },
    statuses: [{ status: 'status_regen', duration: 3, power: { base: 3, coef: 0.3, stat: 'sp' } }],
  },
  {
    id: 'comp_mireya_spore_cloud',
    ownerId: 'mireya',
    kind: 'debuff',
    name: 'Spore Cloud',
    description: 'Blind every enemy for 2 turns.',
    target: 'all_enemies',
    statuses: [{ status: 'status_blind', duration: 2 }],
  },
  {
    id: 'comp_mireya_lantern_light',
    ownerId: 'mireya',
    kind: 'attack',
    name: 'Lantern Light',
    description: '0.9·SP Ley to one enemy, and Soak it for 3 turns.',
    target: 'enemy',
    damageType: 'ley',
    power: { coef: 0.9, stat: 'sp' },
    statuses: [{ status: 'status_soaked', duration: 3 }],
  },
  {
    id: 'comp_mireya_lanternreed_bloom',
    ownerId: 'mireya',
    kind: 'signature',
    name: 'Lanternreed Bloom',
    description: 'Heal your party for 30% of max HP, cleanse it, and give everyone Regen of 4 + 0.4·SP per turn for 3 turns.',
    target: 'party',
    special: 'cleanse',
    statuses: [{ status: 'status_regen', target: 'all_allies', duration: 3, power: { base: 4, coef: 0.4, stat: 'sp' } }],
  },

  // ---- Caelum: Chrono caster -------------------------------------------------------------------------------------------
  {
    id: 'comp_caelum_chrono_shard',
    ownerId: 'caelum',
    kind: 'attack',
    name: 'Chrono Shard',
    description: '1.1·SP Chrono to one enemy, with a 30% chance to Slow it for 2 turns.',
    target: 'enemy',
    damageType: 'chrono',
    power: { coef: 1.1, stat: 'sp' },
    statuses: [{ status: 'status_slow', chance: 0.3, duration: 2 }],
  },
  {
    id: 'comp_caelum_haste',
    ownerId: 'caelum',
    kind: 'buff',
    name: 'Haste',
    description: 'Haste an ally for 2 turns.',
    target: 'ally',
    statuses: [{ status: 'status_haste', duration: 2 }],
  },
  {
    id: 'comp_caelum_foresight',
    ownerId: 'caelum',
    kind: 'shield',
    name: 'Foresight',
    description: 'Shield an ally for 1.0·SP + 8.',
    target: 'ally',
    shield: { base: 8, coef: 1.0, stat: 'sp' },
  },
  {
    id: 'comp_caelum_stutter',
    ownerId: 'caelum',
    kind: 'signature',
    name: 'Skipped Beat', // U81b2: renamed from 'Stutter' (D-137: the Wizard's wiz_stutter keeps the name)
    description: "Interrupt one enemy's intent and Stun it for 1 turn (a boss is Staggered and Slowed for 2 turns instead).",
    target: 'enemy',
    interrupt: true,
    statuses: [
      { status: 'status_stun', duration: 1, when: { targetIsBoss: false } },
      { status: 'status_slow', duration: 2, when: { targetIsBoss: true } },
    ],
  },
] satisfies AbilityInput[];
