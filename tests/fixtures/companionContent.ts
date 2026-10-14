// Companion fixtures (U28; PLAN §8, §9.1 "later units may append fixtures for their own systems"): the combat pack plus
// the five companions the fixture pack lacks — Brak, Nyx, Dask, Mireya, Caelum — with DESIGN §12.3 stats and §12.4
// abilities (three autos + a signature each; Ilyra is already in miniContent), and their NPC records.
//   companionPack()                 — the pack (cached).
//   companionPack({ cleanse: true }) — Mireya's Spore Cloud swapped for a `cleanse`-kind auto: DESIGN §12.4 gives no
//                                      companion one, but §4.9's Support rule names it.
// Kept apart from combatContent.ts so the combat units' fixture stays theirs.
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import type { AbilityInput } from '@schema/ability';
import type { CompanionInput } from '@schema/companion';
import type { NpcInput } from '@schema/npc';
import { combatTables } from './combatContent';
import { FIXTURE_VERSION } from './miniContent';

type A = AbilityInput;
const comp = (id: string, ownerId: string, kind: NonNullable<A['kind']>, name: string, rest: Omit<A, 'id' | 'ownerId' | 'kind' | 'name' | 'description'>): A => ({
  id, ownerId, kind, name, description: `Fixture: DESIGN §12.4 ${name}.`, ...rest,
});
const notBoss = { targetIsBoss: false } as const;
const boss = { targetIsBoss: true } as const;

/** DESIGN §12.4, one block per companion (attack, then the other autos, then the signature). */
export const companionAbilities: A[] = [
  // Brak — bruiser / tank
  comp('comp_brak_axe', 'brak', 'attack', 'Axe', { target: 'enemy', damageType: 'physical', power: { coef: 1.1, stat: 'atk' } }),
  comp('comp_brak_cleave', 'brak', 'aoe', 'Cleave', { target: 'all_enemies', damageType: 'physical', power: { coef: 0.8, stat: 'atk' } }),
  comp('comp_brak_shieldbreak', 'brak', 'debuff', 'Shieldbreak', {
    target: 'enemy', damageType: 'physical', power: { coef: 0.7, stat: 'atk' }, statuses: [{ status: 'status_armor_break', duration: 3 }],
  }),
  comp('comp_brak_hold_the_line', 'brak', 'signature', 'Hold the Line', {
    target: 'self', shield: { base: 15, coef: 1.0, stat: 'atk' }, special: 'guard', statuses: [{ status: 'status_taunt', target: 'all_enemies', duration: 2 }],
  }),
  // Nyx — Void caster
  comp('comp_nyx_void_needle', 'nyx', 'attack', 'Void Needle', { target: 'enemy', damageType: 'void', power: { coef: 1.1, stat: 'sp' } }),
  comp('comp_nyx_hex', 'nyx', 'debuff', 'Hex', { target: 'enemy', damageType: 'void', power: { coef: 0.6, stat: 'sp' }, statuses: [{ status: 'status_weaken', duration: 2 }] }),
  comp('comp_nyx_drink', 'nyx', 'heal', 'Drink', { target: 'enemy', damageType: 'void', power: { coef: 0.8, stat: 'sp' }, special: 'drain' }),
  comp('comp_nyx_unmaking', 'nyx', 'signature', 'Unmaking', { target: 'all_enemies', damageType: 'void', power: { coef: 1.6, stat: 'sp' }, selfCost: { hpPctMax: 0.1 } }),
  // Dask — Chrono phantom (location-restricted)
  comp('comp_dask_flicker_strike', 'dask', 'attack', 'Flicker Strike', { target: 'enemy', damageType: 'chrono', power: { coef: 1.0, stat: 'sp' } }),
  comp('comp_dask_stall', 'dask', 'debuff', 'Stall', { target: 'enemy', damageType: 'chrono', power: { coef: 0.5, stat: 'sp' }, statuses: [{ status: 'status_slow', duration: 2 }] }),
  comp('comp_dask_glimpse', 'dask', 'utility', 'Glimpse', { target: 'self', special: 'foresight' }),
  comp('comp_dask_between_instants', 'dask', 'signature', 'Between Instants', {
    target: 'party', statuses: [{ status: 'status_rewind', target: 'ally', duration: 2 }, { status: 'status_haste', target: 'all_allies', duration: 2 }],
  }),
  // Mireya — glow healer
  comp('comp_mireya_glowsalve', 'mireya', 'heal', 'Glowsalve', {
    target: 'ally', heal: { base: 10, coef: 1.0, stat: 'sp', target: 'ally' }, statuses: [{ status: 'status_regen', duration: 3, power: { base: 3, coef: 0.3, stat: 'sp' } }],
  }),
  comp('comp_mireya_spore_cloud', 'mireya', 'debuff', 'Spore Cloud', { target: 'all_enemies', statuses: [{ status: 'status_blind', duration: 2 }] }),
  comp('comp_mireya_lantern_light', 'mireya', 'attack', 'Lantern Light', {
    target: 'enemy', damageType: 'ley', power: { coef: 0.9, stat: 'sp' }, statuses: [{ status: 'status_soaked', duration: 3 }],
  }),
  comp('comp_mireya_lanternreed_bloom', 'mireya', 'signature', 'Lanternreed Bloom', {
    target: 'party', special: 'cleanse', statuses: [{ status: 'status_regen', target: 'all_allies', duration: 3, power: { base: 4, coef: 0.4, stat: 'sp' } }],
  }),
  // Caelum — Chrono caster
  comp('comp_caelum_chrono_shard', 'caelum', 'attack', 'Chrono Shard', {
    target: 'enemy', damageType: 'chrono', power: { coef: 1.1, stat: 'sp' }, statuses: [{ status: 'status_slow', chance: 0.3, duration: 2 }],
  }),
  comp('comp_caelum_haste', 'caelum', 'buff', 'Haste', { target: 'ally', statuses: [{ status: 'status_haste', duration: 2 }] }),
  comp('comp_caelum_foresight', 'caelum', 'shield', 'Foresight', { target: 'ally', shield: { base: 8, coef: 1.0, stat: 'sp' } }),
  comp('comp_caelum_stutter', 'caelum', 'signature', 'Stutter', {
    target: 'enemy', interrupt: true, statuses: [{ status: 'status_stun', duration: 1, when: notBoss }, { status: 'status_slow', duration: 2, when: boss }],
  }),
];

/** The `cleanse` variant's auto (replaces Spore Cloud). */
const cleansingReed = comp('comp_mireya_cleansing_reed', 'mireya', 'cleanse', 'Cleansing Reed', { target: 'ally', special: 'cleanse' });

const companion = (c: Omit<CompanionInput, 'arcQuestIds' | 'portrait'>): CompanionInput => ({ arcQuestIds: ['q_echo_crystal'], portrait: { sigil: c.id }, ...c });

/** DESIGN §12.3 stats; signatures per §12.4. */
export const companionRecords: CompanionInput[] = [
  companion({
    id: 'brak', npcId: 'npc_brak', name: 'Brak', role: 'bruiser', damageType: 'physical',
    stats: { hp: 130, atk: 12, sp: 0, agi: 5, armor: 4, ward: 0 }, perLevel: { hp: 10, atk: 1, sp: 0 },
    abilities: ['comp_brak_axe', 'comp_brak_cleave', 'comp_brak_shieldbreak'], signature: { abilityId: 'comp_brak_hold_the_line', cooldown: 4 },
  }),
  companion({
    id: 'nyx', npcId: 'npc_nyx', name: 'Nyx', role: 'caster', damageType: 'void',
    stats: { hp: 90, atk: 5, sp: 11, agi: 8, armor: 1, ward: 2 }, perLevel: { hp: 6, atk: 0.5, sp: 1 },
    abilities: ['comp_nyx_void_needle', 'comp_nyx_hex', 'comp_nyx_drink'], signature: { abilityId: 'comp_nyx_unmaking', cooldown: 4 },
  }),
  companion({
    id: 'dask', npcId: 'npc_dask', name: 'Dask', role: 'skirmisher', damageType: 'chrono',
    stats: { hp: 70, atk: 6, sp: 10, agi: 12, armor: 0, ward: 2, evasion: 20 }, perLevel: { hp: 5, atk: 0.5, sp: 1 },
    abilities: ['comp_dask_flicker_strike', 'comp_dask_stall', 'comp_dask_glimpse'], signature: { abilityId: 'comp_dask_between_instants', cooldown: 5 },
    requiresTemporallyUnstable: true, constraintText: 'Dask flickers and cannot follow.',
  }),
  companion({
    id: 'mireya', npcId: 'npc_mireya', name: 'Mireya', role: 'support', damageType: 'ley',
    stats: { hp: 95, atk: 6, sp: 9, agi: 6, armor: 2, ward: 2 }, perLevel: { hp: 7, atk: 0.5, sp: 1 },
    abilities: ['comp_mireya_glowsalve', 'comp_mireya_spore_cloud', 'comp_mireya_lantern_light'], signature: { abilityId: 'comp_mireya_lanternreed_bloom', cooldown: 5 },
    statusImmunities: ['status_poison'],
  }),
  companion({
    id: 'caelum', npcId: 'npc_caelum', name: 'Caelum', role: 'caster', damageType: 'chrono',
    stats: { hp: 75, atk: 5, sp: 11, agi: 8, armor: 1, ward: 3 }, perLevel: { hp: 5, atk: 0.5, sp: 1 },
    abilities: ['comp_caelum_chrono_shard', 'comp_caelum_haste', 'comp_caelum_foresight'], signature: { abilityId: 'comp_caelum_stutter', cooldown: 4 },
  }),
];

const npc = (id: NpcInput['id'], name: string, homeLocationId: NpcInput['homeLocationId'], companionId: NonNullable<NpcInput['companionId']>): NpcInput => ({
  id, name, description: `Fixture: ${name}.`, homeLocationId, portrait: { sigil: companionId }, roles: ['companion'], companionId,
});

export const companionNpcs: NpcInput[] = [
  npc('npc_brak', 'Brak', 'loc_silverwood_plaza', 'brak'),
  npc('npc_nyx', 'Nyx', 'loc_shattered_library', 'nyx'),
  npc('npc_dask', 'Dask', 'loc_chronos_nexus', 'dask'),
  npc('npc_mireya', 'Mireya of Lanternreed', 'loc_veridian_glowlands', 'mireya'),
  npc('npc_caelum', 'Caelum Vesper', 'loc_silverwood_plaza', 'caelum'),
];

export interface CompanionPackOptions {
  /** Mireya's debuff auto becomes a `cleanse` auto (DESIGN §4.9 Support's cleanse rule). */
  cleanse?: boolean;
}

export function companionTables(opts: CompanionPackOptions = {}): ContentTables {
  const base = combatTables();
  const records = companionRecords.map((c) =>
    opts.cleanse && c.id === 'mireya' ? { ...c, abilities: ['comp_mireya_glowsalve', 'comp_mireya_cleansing_reed', 'comp_mireya_lantern_light'] satisfies CompanionInput['abilities'] } : c,
  );
  return {
    ...base,
    abilities: [...base.abilities, ...companionAbilities, ...(opts.cleanse ? [cleansingReed] : [])],
    companions: [...base.companions, ...records],
    npcs: [...base.npcs, ...companionNpcs],
  };
}

let cached: ContentPack | null = null;

/** The companion pack (built and validated like the fixture pack); options build an uncached variant. */
export function companionPack(opts?: CompanionPackOptions): ContentPack {
  if (opts) return buildContentPack(companionTables(opts), { version: FIXTURE_VERSION });
  cached ??= buildContentPack(companionTables(), { version: FIXTURE_VERSION });
  return cached;
}
