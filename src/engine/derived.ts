// Derived character values (DESIGN §3.2, §3.3, §6.7, §7.2–7.3). One pure function, `derive(player, content)`, turns a
// PlayerState into every number the UI and combat read: maxima, ATK/SP, accuracy, evasion, crit, initiative, armor,
// ward, Guard value and the gear-borne resistances and passives. Inputs, in order: class base + growth (§3.3), the
// player's primaries (base + allocated points), `passiveBonuses`, slotless quest/key items carried (the Amulet's
// +1 MAG, §7.1), equipped gear with rarity scaling (§7.2) and affixes (§7.3), Corruption (§6.7), and statuses (hooks:
// the player's out-of-combat statuses by default; combat passes a Combatant's). Combat adds what is per-action
// (spell +10 accuracy, weapon-type basic-attack modifiers, the per-fight d4) on top.
//
// `hpMax`/`mpMax` are also stored on the PlayerState; `syncMaxima` keeps them equal to `derive()` (a post-step hook
// runs it after every accepted action outside combat, so every source of change — equip, level, Corruption, picking
// up the Amulet — is covered without each reducer remembering to).
import type { AffixSlotEffect } from '@schema/affix';
import type { Item, ItemStats, Passive } from '@schema/item';
import type { GameConfig } from '@schema/contentPack';
import type { ContentPack } from './ctx';
import { ATT_SCRIPT, attunementPct, scriptNumber } from './runRules';
import type { DamageType, EquipSlot, ItemInstance, PlayerState, Rarity, StatName, StatusInstance } from './types/state';
import { clamp, round } from './util/math';

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'trinket1', 'trinket2'];
export const STAT_NAMES: readonly StatName[] = ['strength', 'magic', 'agility'];
export const DAMAGE_TYPES: readonly DamageType[] = ['physical', 'fire', 'storm', 'ley', 'void', 'chrono'];

/** The item kind an equipment slot holds (affix effects are keyed by it). */
export type GearKind = 'weapon' | 'armor' | 'trinket';
export const gearKindOf = (slot: EquipSlot): GearKind => (slot === 'trinket1' || slot === 'trinket2' ? 'trinket' : slot);

/** DESIGN §7.2: which stats rarity scales, per gear kind (negative values, e.g. Ironclad Plate's ward −2, never scale). */
export const RARITY_SCALED: Readonly<Record<GearKind, readonly (keyof ItemStats)[]>> = {
  weapon: ['power', 'spellPower'],
  armor: ['armor', 'ward'],
  trinket: ['strength', 'magic', 'agility'],
};

/** DESIGN §6.7: per Corruption point, Wizard and Shadow Weaver gain +1 SP; every other class deals +5 % Void damage. */
export const CORRUPTION_SP_CLASSES: readonly string[] = ['wizard', 'shadow_weaver'];
export const CORRUPTION_VOID_PCT = 0.05;
/** DESIGN §6.7: all classes deal −3 % Ley damage per Corruption point. */
export const CORRUPTION_LEY_PCT = -0.03;
/** DESIGN §6.7: at the maximum (6, "Marked for the Weavers") max HP −10 %. */
export const CORRUPTION_MARK_HP_PCT = -0.1;
/** Percent maxima round down; this keeps 129.99999… (binary fractions) from losing a point. */
const FLOAT_EPSILON = 1e-9;

export interface Derived {
  /** Effective primaries: allocated + passiveBonuses + carried quest items + gear + affixes (+ status `agiFlat`). */
  strength: number;
  magic: number;
  agility: number;
  hpMax: number;
  mpMax: number;
  /** STR + weapon power (DESIGN §3.2). */
  atk: number;
  /** MAG + weapon spell power (+ Corruption for Wizard/Weaver, §6.7). */
  sp: number;
  /** 85 + ⌊AGI/2⌋ + gear + status; abilities tagged `spell` add `config.spellAccuracyBonus` in combat. */
  accuracy: number;
  evasion: number;
  /** 5 + ⌊AGI/2⌋ + gear + status, capped at 60. */
  crit: number;
  critMult: number;
  /** AGI + gear + status; combat adds the d4 rolled once per fight. */
  initiative: number;
  armor: number;
  ward: number;
  /** Fraction of direct damage Guard removes (0.5; affix_of_the_warden 0.60/0.55). */
  guardValue: number;
  /** Resistance steps toward immune from gear and affixes (DESIGN §4.4). */
  resistSteps: Partial<Record<DamageType, number>>;
  /** Damage dealt modifiers by type (fractions): gear/affix `damageBonus` and Corruption. */
  damagePct: Partial<Record<DamageType, number>>;
  /** Best staff reduction (DESIGN §5.1: Apprentice 0.10, Necromancer 0.20). */
  mpCostReduction: number;
  lifeSteal: number;
  regen: { hp: number; mp: number };
  /** affix_of_the_wellspring: class resource generation +pct. */
  resourceGainPct: number;
  statusImmunities: string[];
  /** Item-granted abilities (the Amulet → itm_echo_bolt, D-047). */
  grantedAbilities: string[];
  /** Every gear/affix/quest-item passive, for combat hooks (statusOnHit, curse, custom …). */
  passives: Passive[];
}

export interface DeriveOptions {
  /** Status hooks; default: the player's own (out-of-combat) statuses. */
  statuses?: readonly StatusInstance[];
}

/**
 * DESIGN §7.2: a gear stat at `rarity`. Each tier multiplies the Common value (×1.0/1.1/1.25/1.5/1.75), rounds half
 * up, and is at least +1 over the previous tier. Zero and negative values are not scaled.
 */
export function rarityScaled(base: number, rarity: Rarity, mult: GameConfig['rarityStatMult']): number {
  if (base <= 0) return base;
  let value = base;
  for (let i = 1; i <= RARITY_ORDER.indexOf(rarity); i++) value = Math.max(round(base * mult[RARITY_ORDER[i] as Rarity]), value + 1);
  return value;
}

/** An item's stats at its instance rarity (gear kinds only scale; DESIGN §7.2). */
export function itemStats(def: Item, rarity: Rarity, content: ContentPack): ItemStats {
  const stats = { ...def.stats };
  const kind = def.slot;
  if (kind === undefined) return stats;
  for (const key of RARITY_SCALED[kind]) stats[key] = rarityScaled(stats[key], rarity, content.config.rarityStatMult);
  return stats;
}

/** DESIGN §3.2 `hit%`: clamp(accuracy − evasion, 50, 100). */
export function hitChance(accuracy: number, evasion: number, config: Pick<GameConfig, 'hitFloor'>): number {
  return clamp(accuracy - evasion, config.hitFloor, 100);
}

/** DESIGN §3.2 `flee%`: clamp(40 + 3·AGI − 2·max enemy AGI, 10, 90) + 15 per failed attempt this fight (≤ 100). */
export function fleeChance(agility: number, maxEnemyAgility: number, failedAttempts: number, config: Pick<GameConfig, 'flee'>): number {
  const f = config.flee;
  return Math.min(100, clamp(f.base + f.perAgi * agility - f.perEnemyAgi * maxEnemyAgility, f.min, f.max) + f.perFail * failedAttempts);
}

/** `source` prefixes of what gear does in a fight (U34b, combat/gear.ts): the item's own passive, or an affix's. */
export const GEAR_SOURCE = 'gear:';
export const AFFIX_SOURCE = 'affix:';
/** A `source` (an event's, a hit's) that names a piece of gear or an affix (`gear:<itemId>` / `affix:<affixId>`). */
export const isGearSource = (source: string): boolean => source.startsWith(GEAR_SOURCE) || source.startsWith(AFFIX_SOURCE);
/**
 * The `custom` passive scripts combat implements (content/shared/affixes.ts header; U34b, combat/gear.ts and damage.ts).
 * `kill_xp` is combat/rewards.ts `KILL_XP_SCRIPT`. Any other script id is ignored in a fight (the validator owns them).
 */
export const GEAR_SCRIPT = {
  /** affix_of_embers weapon `{ damageType, pct }`: a landed basic attack adds pct × its damage as a hit of that type. */
  basicAttackRider: 'basic_attack_rider',
  /** affix_of_iron weapon `{ status, pct }`: × (1 + pct) at step 7 when the target holds the status. */
  damageVsStatus: 'damage_vs_status',
  /** affix_of_thorns armor `{ damageType, pct }`: pct × the HP a melee blow took goes back to the attacker. */
  reflectMelee: 'reflect_melee',
  // U34e (D-099, D-101): the item rows' scripts (combat/gear.ts, reducers/inventory.ts, reducers/economy.ts, progression.ts,
  // horde-free hazards in reducers/explore.ts) — each named by the item that carries it.
  /** Bell-Warden's Clapper `{ chance }`: the basic attack's Stun chance (non-bosses) is at least this (heavy 10 % → 20 %). */
  basicStunChance: 'basic_stun_chance',
  /** Diver's Coat, Salt Charm `{ statuses, turns }`: those statuses last `turns` fewer turns on the wearer (at least 1). */
  statusDurationReduction: 'status_duration_reduction',
  /** Lantern-Moth Brooch `{ below, status, duration, oncePerFight, power? }`: the wearer's HP drops below `below` → the status. */
  lowHpStatus: 'low_hp_status',
  /** Unlidded Eye `{}`: next-next intents all fight, as `att_foresight` (one key: the two never stack). */
  foresight: 'foresight',
  /** Oriel's Quill `{ damageType, pct }`: abilities of that type cost pct less MP, on top of a staff's reduction. */
  abilityMpCostReduction: 'ability_mp_cost_reduction',
  /** Weaver's Thread Ring `{ hazard }`: the named location hazard passes the wearer by (reducers/explore.ts hazards). */
  hazardImmunity: 'hazard_immunity',
  /** Antidote Root, Brine Draught, Hearth Broth `{ statuses }`: using the consumable removes those statuses. */
  cleanse: 'cleanse',
  /** Whetstone Strip `{ basicAttacks, power }`: used out of combat, the next fight's first n basic attacks have +power. */
  whetstoneStrip: 'whetstone_strip',
  /** Remnant Ink `{ status: 'status_shield', amount }`: used out of combat, the next fight opens with that Shield. */
  remnantInk: 'remnant_ink',
  /** Lantern Oil `{ preventsStatusOnAmbush }`: used out of combat, no such status at an ambush's onset until the next dawn. */
  lanternOilWard: 'lantern_oil_ward',
  /** Keeper's Copy: used out of combat, the verse Echoes held are read again (a codex replay in the log). */
  keepersCopy: 'keepers_copy',
  /** Scout's Whistle `{ companion }`: used at a camp, the companion is called to the active slot. */
  scoutsWhistle: 'scouts_whistle',
  /** Remnant Wax Seal `{ faction, tiersHigher, merchants }`: carried, those merchants stock as if the tier were higher. */
  remnantWaxSeal: 'remnant_wax_seal',
  /** Korr's Marginalia `{ toward }`: reading it counts as one Dark Spellbook read (no HP, no Corruption). */
  countsAsSpellbook: 'counts_as_spellbook',
} as const;

/** U34e: the `custom` passives with `scriptId` the player's gear (and carried quest items) hold, each with its source. */
export function scriptPassives(player: PlayerState, content: ContentPack, scriptId: string): { source: string; params: Record<string, unknown> }[] {
  const out: { source: string; params: Record<string, unknown> }[] = [];
  for (const { source, passive } of gearPassives(player, content)) if (passive.kind === 'custom' && passive.scriptId === scriptId) out.push({ source, params: passive.params });
  return out;
}

/** U34e: an item's own `custom` passive with `scriptId` (a consumable's use script), if it carries one. */
export function itemScript(def: Pick<Item, 'passives'>, scriptId: string): Record<string, unknown> | undefined {
  for (const p of def.passives) if (p.kind === 'custom' && p.scriptId === scriptId) return p.params;
  return undefined;
}

/** U34e (`status_duration_reduction`): how many turns the wearer's gear takes off `statusId` (0 for none). */
export function statusDurationCut(player: PlayerState, content: ContentPack, statusId: string): number {
  let turns = 0;
  for (const { params } of scriptPassives(player, content, GEAR_SCRIPT.statusDurationReduction)) {
    const ids = params.statuses;
    if (Array.isArray(ids) && ids.includes(statusId) && typeof params.turns === 'number') turns += params.turns;
  }
  return turns;
}

/** A gear passive with what carries it: `gear:<itemId>` or `affix:<affixId>` (U34b: the `source` of its events). */
export interface SourcedPassive {
  source: string;
  passive: Passive;
}

interface Acc {
  stats: ItemStats;
  resist: Partial<Record<DamageType, number>>;
  passives: Passive[];
  sourced: SourcedPassive[];
}

const zeroStats = (): ItemStats => ({
  power: 0,
  spellPower: 0,
  armor: 0,
  ward: 0,
  strength: 0,
  magic: 0,
  agility: 0,
  hpMax: 0,
  mpMax: 0,
  hpMaxPct: 0,
  crit: 0,
  accuracy: 0,
  evasion: 0,
  initiative: 0,
});

function addSource(acc: Acc, stats: ItemStats, resistSteps: readonly DamageType[], passives: readonly Passive[], source: string): void {
  for (const key of Object.keys(stats) as (keyof ItemStats)[]) acc.stats[key] += stats[key];
  for (const type of resistSteps) acc.resist[type] = (acc.resist[type] ?? 0) + 1;
  acc.passives.push(...passives);
  for (const passive of passives) acc.sourced.push({ source, passive });
}

/** Equipped gear (with rarity and affixes) and carried slotless quest/key items, summed. */
function gearSources(player: PlayerState, content: ContentPack): Acc {
  const acc: Acc = { stats: zeroStats(), resist: {}, passives: [], sourced: [] };
  const uniqueSeen = new Set<string>();
  for (const slot of EQUIP_SLOTS) {
    const inst = player.equipment[slot];
    if (!inst) continue;
    const def = need(content.items[inst.itemId], inst);
    addSource(acc, itemStats(def, inst.rarity, content), def.resistSteps, def.passives, `${GEAR_SOURCE}${def.id}`);
    for (const affixId of inst.affixes) {
      const affix = content.affixes[affixId];
      const effect: AffixSlotEffect | undefined = affix?.[gearKindOf(slot)];
      if (!affix || !effect) continue;
      if (affix.unique) {
        if (uniqueSeen.has(affixId)) continue;
        uniqueSeen.add(affixId);
      }
      addSource(acc, effect.stats, effect.resistSteps, effect.passives, `${AFFIX_SOURCE}${affixId}`);
    }
  }
  // DESIGN §7.1: quest items with passive stats (the Amulet of Echoes) apply without a slot; one copy counts.
  const carried = new Set<string>();
  for (const inst of player.inventory) {
    const def = need(content.items[inst.itemId], inst);
    if ((def.type !== 'quest' && def.type !== 'key') || def.slot !== undefined || carried.has(def.id)) continue;
    carried.add(def.id);
    addSource(acc, def.stats, def.resistSteps, def.passives, `${GEAR_SOURCE}${def.id}`);
  }
  return acc;
}

/**
 * Every passive the player's gear carries, with its source, in a fixed order (U34b, combat/gear.ts): equipment by slot
 * (weapon, armor, trinket 1, trinket 2) — each item's own passives in listed order, then its affixes' in instance order —
 * then the carried slotless quest/key items. `derive().passives` is the same list without the sources.
 */
export function gearPassives(player: PlayerState, content: ContentPack): SourcedPassive[] {
  return gearSources(player, content).sourced;
}

function need(def: Item | undefined, inst: ItemInstance): Item {
  if (!def) throw new Error(`derive: unknown item '${inst.itemId}' (${inst.uid})`);
  return def;
}

/** Every derived value of `player` (DESIGN §3.2). Throws on an unknown class or item (validated content). */
export function derive(player: PlayerState, content: ContentPack, opts: DeriveOptions = {}): Derived {
  const cls = content.classes[player.classId];
  if (!cls) throw new Error(`derive: unknown class '${player.classId}'`);
  const config = content.config;
  const gear = gearSources(player, content);
  const g = gear.stats;
  const bonus = player.passiveBonuses;

  let agiFlat = 0;
  let initiativeFlat = 0;
  let accuracyFlat = 0;
  let evasionFlat = 0;
  let critFlat = 0;
  let armorWardZero = false;
  for (const st of opts.statuses ?? player.statuses) {
    const m = content.statuses[st.statusId]?.modifiers;
    if (!m) continue;
    agiFlat += m.agiFlat;
    initiativeFlat += m.initiativeFlat;
    accuracyFlat += m.accuracyFlat;
    evasionFlat += m.evasionFlat;
    critFlat += m.critFlat;
    armorWardZero ||= m.armorWardZero;
  }

  const strength = player.stats.strength + (bonus.strength ?? 0) + g.strength;
  const magic = player.stats.magic + (bonus.magic ?? 0) + g.magic;
  const agility = player.stats.agility + (bonus.agility ?? 0) + g.agility + agiFlat;
  const halfAgi = Math.floor(agility / 2);

  const corruption = player.corruption;
  const marked = corruption >= config.corruptionMax;
  const hpFlat = cls.baseStats.hp + cls.growth.hp * (player.level - 1) + 2 * strength + g.hpMax + (bonus.hpMax ?? 0);
  // U31: Steady Hand / Deep Well (DESIGN §10.7, the run's Attunements, engine/runRules.ts)
  const hpPct = g.hpMaxPct + (marked ? CORRUPTION_MARK_HP_PCT : 0) + attunementPct(player, content, 'hp_max_pct');
  const hpMax = Math.max(1, Math.floor(hpFlat * (1 + hpPct) + FLOAT_EPSILON));
  const mpFlat = cls.baseStats.mp + cls.growth.mp * (player.level - 1) + 2 * magic + g.mpMax + (bonus.mpMax ?? 0);
  const mpMax = Math.max(0, Math.floor(mpFlat * (1 + attunementPct(player, content, 'mp_max_pct')) + FLOAT_EPSILON));

  const damagePct: Partial<Record<DamageType, number>> = {};
  const addPct = (type: DamageType, pct: number): void => {
    if (pct !== 0) damagePct[type] = (damagePct[type] ?? 0) + pct;
  };
  let mpCostReduction = 0;
  let lifeSteal = 0;
  let resourceGainPct = 0;
  let guardValue = config.guardValue;
  const regen = { hp: 0, mp: 0 };
  const statusImmunities: string[] = [];
  const grantedAbilities: string[] = [];
  for (const p of gear.passives) {
    if (p.kind === 'damageBonus') for (const type of p.damageType ? [p.damageType] : DAMAGE_TYPES) addPct(type, p.pct);
    else if (p.kind === 'mpCostReduction') mpCostReduction = Math.max(mpCostReduction, p.pct);
    else if (p.kind === 'lifeSteal') lifeSteal += p.pct;
    else if (p.kind === 'resourceGain') resourceGainPct += p.pct;
    else if (p.kind === 'guardValue') guardValue = Math.max(guardValue, p.pct);
    else if (p.kind === 'regen') {
      regen.hp += p.hp;
      regen.mp += p.mp;
    } else if (p.kind === 'statusImmunity' && !statusImmunities.includes(p.status)) statusImmunities.push(p.status);
    else if (p.kind === 'grantAbility' && !grantedAbilities.includes(p.abilityId)) grantedAbilities.push(p.abilityId);
  }
  const corruptionToSp = CORRUPTION_SP_CLASSES.includes(player.classId);
  if (!corruptionToSp) addPct('void', CORRUPTION_VOID_PCT * corruption);
  addPct('ley', CORRUPTION_LEY_PCT * corruption);

  return {
    strength,
    magic,
    agility,
    hpMax,
    mpMax,
    atk: strength + g.power,
    sp: magic + g.spellPower + (corruptionToSp ? corruption : 0),
    accuracy: config.baseAccuracy + halfAgi + g.accuracy + accuracyFlat,
    evasion: halfAgi + g.evasion + evasionFlat,
    crit: clamp(config.critBase + halfAgi + g.crit + critFlat + scriptNumber(player, content, ATT_SCRIPT.crit, 'amount'), 0, config.critCap), // + Keen Eye (U31)
    critMult: config.critMult,
    initiative: agility + g.initiative + initiativeFlat,
    armor: armorWardZero ? 0 : g.armor,
    ward: armorWardZero ? 0 : g.ward,
    guardValue,
    resistSteps: gear.resist,
    damagePct,
    mpCostReduction,
    lifeSteal,
    regen,
    resourceGainPct,
    statusImmunities,
    grantedAbilities,
    passives: gear.passives,
  };
}

/**
 * Brings the stored `hpMax`/`mpMax` in line with `derive()`. A change of the maximum moves the current value by the
 * same amount (so equip → unequip is neutral and a full bar stays full), clamped to the new maximum and never below 1 HP
 * (a maximum change neither kills nor revives: a state already at 0 HP stays there). Returns whether anything changed.
 */
export function syncMaxima(player: PlayerState, content: ContentPack): boolean {
  const d = derive(player, content);
  const dHp = d.hpMax - player.hpMax;
  const dMp = d.mpMax - player.mpMax;
  if (dHp === 0 && dMp === 0) return false;
  if (player.hp > 0) player.hp = clamp(player.hp + dHp, 1, d.hpMax);
  player.mp = clamp(player.mp + dMp, 0, d.mpMax);
  player.hpMax = d.hpMax;
  player.mpMax = d.mpMax;
  return true;
}
