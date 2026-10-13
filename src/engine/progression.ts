// Progression (DESIGN §5.1, §6.1–6.4): the XP curve and level-ups (one grant may cross several levels; each level gives
// +1 stat point and +2 half-points of AP, and a level-up refills HP and MP), ability unlock rules (tier level gates,
// branch prerequisites, half-point costs, mastery halves them), the AP respec refund, and two pure helpers the combat
// units share: class resource generation per event and ability cost / self-cost availability ("Not enough blood").
// Mastery is read here, never written: the loop end copies this loop's unlocks into `classMastery` (DESIGN §10.3,
// U30), so the discount cannot be farmed by respeccing within a loop.
import type { Ability } from '@schema/ability';
import type { Class } from '@schema/class';
import type { GameConfig } from '@schema/contentPack';
import type { ContentPack, StepCtx } from './ctx';
import { derive, syncMaxima } from './derived';
import type { Profile } from './types/profile';
import type { GameState } from './types/state';

/** DESIGN §5.1 / §6.3: 1 AP (2 half-points) and +1 primary point per level. */
export const AP_HALF_PER_LEVEL = 2;
export const STAT_POINTS_PER_LEVEL = 1;
/** DESIGN §5.1: Tier 3 needs 2 abilities already unlocked in its branch, Tier 4 needs 3, the capstone all four. */
export const BRANCH_PREREQ: Readonly<Record<number, number>> = { 3: 2, 4: 3, 5: 4 };
/** DESIGN §6.3: an AP respec costs 50 × level gold. */
export const RESPEC_GOLD_PER_LEVEL = 50;
/** DESIGN §6.7: from Corruption 3 ("Veil-touched") `wvr_*` abilities cost 1 MP less. */
export const VEIL_TOUCHED_CORRUPTION = 3;
/** DESIGN §5.1 / D-017: after the Heartstone is destroyed, Ley abilities cost +25 % MP this loop. */
export const DESTROYED_HEARTSTONE_LEY_MP = 1.25;

// ---- XP and levels (DESIGN §6.1) -------------------------------------------------------------------------------------

/** XP needed to go from `level` to `level + 1` (`config.xpToNext`); undefined at the level cap. */
export function xpToNext(level: number, content: ContentPack): number | undefined {
  return content.config.xpToNext?.[level - 1];
}

/** The level cap: one more than the curve's length (20). */
export function maxLevel(content: ContentPack): number {
  return (content.config.xpToNext?.length ?? 0) + 1;
}

/** Total XP from level 1 to reach `level` (DESIGN §6.1 "Total XP to reach": 0, 100, 250, 470, … 26,900). */
export function totalXpToReach(level: number, content: ContentPack): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l, content) ?? 0;
  return total;
}

/**
 * Grants XP (the `xp` effect and every XP source; modifiers such as Pacifist's Vow or Quick Study are the source's).
 * Crosses as many levels as the amount pays for; each emits `levelUp`. Any level-up re-derives the maxima and refills
 * HP and MP (DESIGN §6.3). At the cap XP keeps accruing. Returns the number of levels gained.
 */
export function grantXp(ctx: StepCtx, amount: number): number {
  const player = ctx.s.player;
  player.xp = Math.max(0, player.xp + amount);
  ctx.emit({ t: 'xpGained', amount });
  let gained = 0;
  for (let cost = xpToNext(player.level, ctx.content); cost !== undefined && player.xp >= cost; cost = xpToNext(player.level, ctx.content)) {
    player.xp -= cost;
    player.level += 1;
    player.statPoints += STAT_POINTS_PER_LEVEL;
    player.apHalf += AP_HALF_PER_LEVEL;
    gained += 1;
    ctx.emit({ t: 'levelUp', level: player.level, statPoints: player.statPoints, apHalf: player.apHalf });
  }
  if (gained > 0) {
    syncMaxima(player, ctx.content);
    player.hp = player.hpMax;
    player.mp = player.mpMax;
  }
  return gained;
}

// ---- Ability unlocks, mastery, respec (DESIGN §5.1, §6.3, §6.4) -------------------------------------------------------

/** The class's mastered abilities from earlier loops (the profile is only written at loop end). */
export function masteredFor(profile: Readonly<Profile>, classId: string): readonly string[] {
  return profile.classMastery[classId]?.mastered ?? [];
}

/** Half-point cost: tier cost (2, capstone 4), halved for a mastered ability (1, capstone 2; DESIGN §6.4). */
export function unlockCostHalf(ability: Ability, mastered: readonly string[]): number {
  return mastered.includes(ability.id) ? ability.costHalf / 2 : ability.costHalf;
}

/** A tree ability of `classId` (tier + branch), as opposed to companion or item-granted abilities. */
export function isTreeAbility(ability: Ability | undefined, classId: string): ability is Ability & { tier: number; branch: string } {
  return ability !== undefined && ability.ownerId === classId && ability.tier !== undefined && ability.branch !== undefined;
}

/** Why `abilityId` cannot be unlocked now (the reducer's rejection text), or null if it can. */
export function unlockProblem(s: GameState, content: ContentPack, profile: Readonly<Profile>, abilityId: string): string | null {
  const player = s.player;
  const ability = content.abilities[abilityId];
  if (!isTreeAbility(ability, player.classId)) return `'${abilityId}' is not one of your class's abilities`;
  if (player.abilitiesUnlocked.includes(abilityId)) return `${ability.name} is already unlocked`;
  if (player.level < ability.levelReq) return `${ability.name} requires level ${ability.levelReq}`;
  const prereq = BRANCH_PREREQ[ability.tier] ?? 0;
  if (prereq > 0) {
    const inBranch = player.abilitiesUnlocked.filter((id) => {
      const a = content.abilities[id];
      return isTreeAbility(a, player.classId) && a.branch === ability.branch;
    }).length;
    if (inBranch < prereq) return `${ability.name} requires ${prereq} ${ability.branch} abilities unlocked first`;
  }
  if (ability.corruptionReq !== undefined && player.corruption < ability.corruptionReq) {
    return `${ability.name} requires Corruption ${ability.corruptionReq}`;
  }
  if (player.apHalf < unlockCostHalf(ability, masteredFor(profile, player.classId))) return 'Not enough ability points';
  return null;
}

export interface RespecPlan {
  /** Half-points returned: what every refunded unlock cost this loop (mastery is fixed within a loop). */
  refundHalf: number;
  /** Starting abilities and anything outside the class tree stay. */
  keep: string[];
  refunded: string[];
}

/** DESIGN §6.3: an AP respec refunds every tree ability bought this loop (starting abilities are free and stay). */
export function respecPlan(s: GameState, content: ContentPack, profile: Readonly<Profile>): RespecPlan {
  const player = s.player;
  const starting = content.classes[player.classId]?.startingAbilities ?? [];
  const mastered = masteredFor(profile, player.classId);
  const plan: RespecPlan = { refundHalf: 0, keep: [], refunded: [] };
  for (const id of player.abilitiesUnlocked) {
    const ability = content.abilities[id];
    if (!isTreeAbility(ability, player.classId) || starting.includes(id)) {
      plan.keep.push(id);
      continue;
    }
    plan.refunded.push(id);
    plan.refundHalf += unlockCostHalf(ability, mastered);
  }
  return plan;
}

// ---- Class resources and ability costs (DESIGN §5.1–5.6) ------------------------------------------------------------

export type ResourceEventName = Class['resource']['rules'][number]['on'];

/**
 * Class resource gained for one event (DESIGN §5.2–5.6): the class rule's amount (+ `perLevel` steps, + `pctMax` of
 * max MP), or for Guard without a class rule the universal `config.guardResource` (+5). `gainPct` is gear's
 * resource-generation bonus (affix_of_the_wellspring), rounded down. Ranger 8/12/5, Wizard 3 + ⌊L/4⌋, Elf 10/6/5,
 * Warden 6/8/4.
 */
export function resourceGain(
  cls: Pick<Class, 'resource'>,
  on: ResourceEventName,
  level: number,
  config: Pick<GameConfig, 'guardResource'>,
  opts: { mpMax?: number; gainPct?: number } = {},
): number {
  const rule = cls.resource.rules.find((r) => r.on === on);
  let amount = 0;
  if (rule) {
    amount += rule.amount ?? 0;
    if (rule.perLevel) amount += Math.floor(level / rule.perLevel.every) * rule.perLevel.add;
    if (rule.pctMax !== undefined) amount += Math.floor(rule.pctMax * (opts.mpMax ?? 0));
  } else if (on === 'guard') amount = config.guardResource;
  return opts.gainPct ? Math.floor(amount * (1 + opts.gainPct)) : amount;
}

export interface CostCaster {
  hp: number;
  hpMax: number;
  mp: number;
}

export interface CostOptions {
  /** Staff reduction (Derived.mpCostReduction): rounded down, minimum 1 (DESIGN §5.1). */
  mpCostReduction?: number;
  /** Multiplier before the reduction (Heartstone destroyed: Ley ×1.25), rounded down. */
  mpMult?: number;
  /** Caster Corruption: ≥ 3 makes `wvr_*` abilities 1 MP cheaper (DESIGN §6.7). */
  corruption?: number;
  /** Shadow Weaver Blood price: missing MP paid in HP (DESIGN §5.6). */
  bloodPrice?: { hpPerMp: number };
}

export interface AbilityCost {
  /** MP cost after modifiers. */
  mp: number;
  /** MP actually spent (less than `mp` when Blood price covers the rest). */
  mpPaid: number;
  /** Total HP cost: % HP self-costs plus Blood price. */
  hp: number;
  ok: boolean;
  /** 'Not enough MP' | 'Not enough blood' (the tile text, D-066 #5). */
  reason: string | null;
}

/**
 * What casting `ability` costs this caster, and whether it can (DESIGN §5.1, §5.6, D-066 #5). Percent HP costs round
 * down (minimum 1). Without Blood price, missing MP makes it unavailable; with it, each missing MP costs `hpPerMp` HP.
 * The total HP cost must be strictly less than current HP — a self-cost never kills. Per-hit costs (`hpPerHit`) are
 * paid during resolution, not here.
 */
export function abilityCost(ability: Pick<Ability, 'id' | 'mp' | 'selfCost'>, caster: CostCaster, opts: CostOptions = {}): AbilityCost {
  let mp = ability.mp;
  if (mp > 0 && opts.mpMult !== undefined && opts.mpMult !== 1) mp = Math.floor(mp * opts.mpMult);
  if (mp > 0 && opts.mpCostReduction) mp = Math.max(1, Math.floor(mp * (1 - opts.mpCostReduction)));
  if (mp > 0 && ability.id.startsWith('wvr_') && (opts.corruption ?? 0) >= VEIL_TOUCHED_CORRUPTION) mp -= 1;
  let hp = 0;
  const self = ability.selfCost;
  if (self?.hpPctMax) hp += Math.max(1, Math.floor(self.hpPctMax * caster.hpMax));
  if (self?.hpPctCur) hp += Math.max(1, Math.floor(self.hpPctCur * caster.hp));
  const missing = Math.max(0, mp - caster.mp);
  if (missing > 0 && !opts.bloodPrice) return { mp, mpPaid: 0, hp, ok: false, reason: 'Not enough MP' };
  hp += missing * (opts.bloodPrice?.hpPerMp ?? 0);
  if (hp > 0 && hp >= caster.hp) return { mp, mpPaid: 0, hp, ok: false, reason: 'Not enough blood' };
  return { mp, mpPaid: mp - missing, hp, ok: true, reason: null };
}

/** `abilityCost` for the player out of combat (or with `caster` = the combat snapshot), with every modifier applied. */
export function playerAbilityCost(s: GameState, content: ContentPack, abilityId: string, caster?: CostCaster): AbilityCost {
  const ability = content.abilities[abilityId];
  if (!ability) throw new Error(`playerAbilityCost: unknown ability '${abilityId}'`);
  const player = s.player;
  const cls = content.classes[player.classId];
  const opts: CostOptions = {
    mpCostReduction: derive(player, content).mpCostReduction,
    corruption: player.corruption,
  };
  if (s.world.heartstone === 'destroyed' && ability.damageType === 'ley') opts.mpMult = DESTROYED_HEARTSTONE_LEY_MP;
  if (cls?.resource.bloodPrice) opts.bloodPrice = cls.resource.bloodPrice;
  return abilityCost(ability, caster ?? player, opts);
}
