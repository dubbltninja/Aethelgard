// U81b1 (D-145): the class-aware combat policy shared by the `melee`, `explorer`, `speedrunner` and `caster` bots, so every
// bot plays the class it was given (DESIGN §19 #12). U80's batch showed the non-caster bots casting in 0–5 % of a Wizard's
// or a Weaver's actions (they only knew physical strikes), and no bot ever paid the Weaver's Blood price. The rows, in order
// (the caller has already played its own flight and communion rows):
//
//   heal       below `healBelow`: the biggest healing draught, else a self-heal ability (Field Dressing, Ley Mend).
//   guard      below 25 % with no draught: Guard (`pressOn` caps the streak at two).
//   setup      the class's non-damaging abilities on their cooldowns — a debuff the foe lacks (Weaken, Curse, Mark, Armor
//              Break, Soaked …; the boss first), a buff or shield the player lacks, a scripted stance — only in a fight worth
//              it (the foes have more HP than two of the best strikes: a boss at 15 HP gets no buff), only when the resource
//              left still pays for the cheapest damaging ability, an HP-for-resource ability (Blood Pact) only below 30 % of the
//              pool, and each again only after its cooldown (at least three rounds).
//   strike     the strike worth the most: a basic attack or ANY damaging ability the class has (the damage type's weakness ×1.5,
//              resistance ×0.5, immunity ×0, a Storm spell on a Soaked foe ×1.5, the summoner before its adds), weighted by the
//              bot's lean (an ability against the lean ×0.85: the melee bot still prefers its weapon line, the caster its
//              spells). A basic attack that finishes the strike's single target is taken instead (no resource on a kill the
//              weapon makes anyway).
//   costs      an ability that costs HP — a % HP self-cost, or the Weaver's Blood price (2 HP per missing MP, DESIGN §5.6) —
//              is cast only when HP is comfortable afterwards: at least 40 % of max HP left and more than the blows the
//              foes have telegraphed; a cost of at most 5 % of max HP needs only to stay above the telegraphed blows and 25 %.
//   empty      nothing worth casting: a caster class Guards when a held damaging ability is short of resource and HP is under
//              half (Guard feeds the pool), else the best basic attack.
// Pure reader of (state, legal, content) plus a per-fight note in the bot's memory; no randomness.
import { playerAbilityCost, playerOf, type Action, type Combatant, type ContentPack, type GameState } from '@engine/index';
import type { Ability } from '@schema/ability';
import { abilityOf, allOf, expectedDamage, fightKey, firstOf, foesOf, hasStatus, healAmount, healthFraction, isShellAction, itemOf, primaryStat, resistanceOf } from './shared';
import type { BotMemory } from './types';

export const CLASS_FIGHT = {
  /** Below this fraction of max HP with no draught: Guard. */
  guardBelow: 0.25,
  /** HP left after a Blood price or self-cost must be at least this fraction of max HP … */
  comfort: 0.4,
  /** … unless the cost is at most this fraction of max HP (then `floor` and the telegraphed blows are enough). */
  smallCost: 0.05,
  floor: 0.25,
  /** A basic attack whose expected damage × this covers the target's HP finishes it. */
  overkill: 0.8,
  /** A setup ability only when the foes' HP exceeds this many of the best strike (or a boss stands). */
  setupWorth: 2,
  /** Rounds before the same setup ability is used again (at least its cooldown). */
  recastGap: 3,
  /** An ability whose damage goes against the bot's lean. */
  offLean: 0.85,
  weakMult: 1.5,
  resistMult: 0.5,
  soakedStormMult: 1.5,
  /** A shield is a setup only below this fraction of max HP. */
  shieldBelow: 0.7,
  /** An HP-for-resource ability (no MP cost, a self-cost, no status) only below this fraction of the resource pool. */
  convertBelow: 0.3,
  /** A strike that lays a debuff the target lacks. */
  debuffBonus: 1.3,
  /** The statuses a caster puts on a boss first. */
  hexStatuses: ['status_weaken', 'status_curse'] as readonly string[],
  /** Guard for the resource when a held strike is short of it and HP is below this. */
  guardForResourceBelow: 0.5,
} as const;

/** Flight aids (the pacifist's), never part of a fighting rotation. */
export const FLEE_AIDS: ReadonlySet<string> = new Set(['rgr_smoke_bomb', 'elf_veilwalk']);

/** The debuffs worth putting on a foe that lacks them. */
export const DEBUFFS: readonly string[] = ['status_weaken', 'status_curse', 'status_armor_break', 'status_mark', 'status_soaked', 'status_slow', 'status_blind', 'status_stun', 'status_taunt', 'status_poison', 'status_bleed', 'status_burn'];

export interface ClassFightCfg {
  /** The bot's identity: `weapon` (melee, explorer, speedrunner) or `spell` (caster). */
  lean: 'weapon' | 'spell';
  /** Heal below this fraction of max HP (melee 0.3, caster 0.35). */
  healBelow: number;
  /** The caster's lean: Weaken / Curse on a boss that lacks them, before anything else (PLAN §7.2). */
  hexBossFirst?: boolean;
}

type AbilityAction = Extract<Action, { type: 'ability' }>;
type StrikeAction = Extract<Action, { type: 'ability' | 'attack' }>;

const fallback = (legal: readonly Action[]): Action => legal.find((a) => !isShellAction(a) && a.type !== 'examine') ?? (legal[0] as Action);

/** The blows the foes have telegraphed at the player this round, at their worst. */
export function incomingBlow(s: GameState): number {
  const combat = s.combat;
  if (combat === null) return 0;
  const me = playerOf(combat);
  let total = 0;
  for (const e of foesOf(s)) {
    const intent = combat.intents[e.uid];
    if (intent !== undefined && (intent.targetUid === null || intent.targetUid === me.uid)) total += intent.projected[1];
  }
  return total;
}

/** HP an ability would cost now (self-cost + Blood price), 0 if none. */
export function hpCostOf(s: GameState, content: ContentPack, me: Combatant, abilityId: string): number {
  if (content.abilities[abilityId] === undefined) return 0;
  const cost = playerAbilityCost(s, content, abilityId, me);
  return cost.ok ? cost.hp : 0;
}

/** Does this cast pay part of its MP in HP (the Blood price)? */
export function paysBlood(s: GameState, content: ContentPack, me: Combatant, abilityId: string): boolean {
  if (content.classes[s.player.classId]?.resource.bloodPrice === undefined || content.abilities[abilityId] === undefined) return false;
  const cost = playerAbilityCost(s, content, abilityId, me);
  return cost.ok && cost.mpPaid < cost.mp;
}

/** Is HP comfortable enough to pay `hp` for a cast (see the header's `costs` row)? */
export function bloodComfortable(me: Combatant, hp: number, incoming: number): boolean {
  if (hp <= 0) return true;
  const after = me.hp - hp;
  if (after <= incoming) return false;
  if (hp <= CLASS_FIGHT.smallCost * me.hpMax) return after >= CLASS_FIGHT.floor * me.hpMax;
  return after >= CLASS_FIGHT.comfort * me.hpMax;
}

/** The damage multiplier of an ability (or a basic attack) on one foe: resistances and the Soaked → Storm combo. */
export function hitMult(content: ContentPack, ab: Ability | undefined, foe: Combatant): number {
  const type = ab?.damageType ?? 'physical';
  const r = resistanceOf(content, foe, type);
  let m = r === 'weak' ? CLASS_FIGHT.weakMult : r === 'resist' ? CLASS_FIGHT.resistMult : r === 'immune' ? 0 : 1;
  if (type === 'storm' && hasStatus(foe, 'status_soaked')) m *= CLASS_FIGHT.soakedStormMult;
  return m;
}

/** The foes a strike lands on. */
function aimedAt(content: ContentPack, foes: readonly Combatant[], a: StrikeAction): Combatant[] {
  if (a.targetUid !== undefined) return foes.filter((f) => f.uid === a.targetUid);
  const ab = a.type === 'ability' ? content.abilities[a.abilityId] : undefined;
  return ab?.target === 'all_enemies' ? [...foes] : foes.slice(0, 1);
}

/**
 * Does an ability bonus's `when` hold on this target by its statuses (`targetHas`, through any/all)? Other atoms (who acted
 * first, the HP fraction …) are not read: false.
 */
export function targetHasNow(when: unknown, foe: Combatant): boolean {
  if (typeof when !== 'object' || when === null) return false;
  const [key, value] = Object.entries(when)[0] ?? [];
  if (key === 'targetHas' && typeof value === 'string') return hasStatus(foe, value);
  if (key === 'any' && Array.isArray(value)) return value.some((c) => targetHasNow(c, foe));
  if (key === 'all' && Array.isArray(value)) return value.length > 0 && value.every((c) => targetHasNow(c, foe));
  return false;
}

/** A damaging ability (it has `power`). */
const damaging = (ab: Ability | undefined): boolean => ab?.power !== undefined;

/** The cheapest damaging ability the player has unlocked (the resource a setup ability must leave), 0 if none. */
export function strikeReserve(s: GameState, content: ContentPack): number {
  const costs = s.player.abilitiesUnlocked.map((id) => content.abilities[id]).filter((a): a is Ability => damaging(a) && (a?.mp ?? 0) > 0).map((a) => a.mp);
  return costs.length === 0 ? 0 : Math.min(...costs);
}

// ---- the per-fight note: when each setup ability was last used ---------------------------------------------------------------------

const USED_KEY = 'classFight:used';
interface UsedNote {
  fight: string;
  at: Record<string, number>;
  /** The round of the last setup. */
  lastRound?: number;
}

function usedNote(memory: BotMemory, s: GameState): UsedNote {
  const key = fightKey(s);
  const have = memory[USED_KEY] as UsedNote | undefined;
  if (have !== undefined && have.fight === key) return have;
  const fresh: UsedNote = { fight: key, at: {} };
  memory[USED_KEY] = fresh;
  return fresh;
}

// ---- the policy ----------------------------------------------------------------------------------------------------------------------

/** The heal row: below `below`, the biggest draught, else a self-heal ability. */
export function healRow(s: GameState, legal: readonly Action[], content: ContentPack, below: number): Action | undefined {
  if (s.combat === null || healthFraction(s) >= below) return undefined;
  const me = playerOf(s.combat);
  const draught = allOf(legal, 'item')
    .filter((a) => a.targetUid === undefined || a.targetUid === me.uid)
    .map((a) => ({ a, hp: healAmount(content, itemOf(s, a.uid)?.itemId ?? '') }))
    .filter((x) => x.hp > 0)
    .sort((x, y) => y.hp - x.hp)[0];
  if (draught !== undefined) return draught.a;
  return allOf(legal, 'ability').find((a) => content.abilities[a.abilityId]?.heal !== undefined && (a.targetUid === undefined || a.targetUid === me.uid));
}

/**
 * Would this setup ability add something now? A debuff (DEBUFFS) a foe it reaches lacks; a shield the player lacks while hurt
 * (below `shieldBelow`); a buff on the player it lacks, once a fight (`used`). A scripted ability with no status (a stance,
 * a utility) is never a setup: U81b1's first cut cast those on their cooldowns and the Tyrant fights doubled in length.
 */
function setupAdds(me: Combatant, foes: readonly Combatant[], a: AbilityAction, ab: Ability, used: boolean): boolean {
  if (ab.shield !== undefined) return !hasStatus(me, 'status_shield') && me.hp < CLASS_FIGHT.shieldBelow * me.hpMax;
  // HP into resource (Blood Pact; the caller allows it only when the resource is low)
  if (ab.statuses.length === 0) return ab.mp === 0 && ab.selfCost !== undefined;
  // a coating or stance cast on oneself (Venom Coat) is worn once a fight; only a debuff cast at a foe is renewed
  if (used && ab.target !== 'enemy' && ab.target !== 'all_enemies') return false;
  return ab.statuses.some((st) => {
    if (st.target === 'self' || st.target === 'all_allies' || st.target === 'ally') return !used && !hasStatus(me, st.status);
    if (!DEBUFFS.includes(st.status)) return false;
    const on = st.target === 'all_enemies' || ab.target === 'all_enemies' ? foes : foes.filter((f) => a.targetUid === undefined || f.uid === a.targetUid);
    return on.some((f) => !hasStatus(f, st.status));
  });
}

/**
 * The class-aware fight (see the header). `memory` holds the per-fight setup note. Returns one listed action; the caller
 * passes it through `pressOn`.
 */
export function classFight(s: GameState, legal: readonly Action[], content: ContentPack, memory: BotMemory, cfg: ClassFightCfg): Action {
  const combat = s.combat;
  if (combat === null) return fallback(legal);
  const me = playerOf(combat);
  const hp = healthFraction(s);
  const foes = foesOf(s);
  const incoming = incomingBlow(s);

  const heal = healRow(s, legal, content, cfg.healBelow);
  if (heal !== undefined) return heal;
  const hasDraught = allOf(legal, 'item').some((a) => healAmount(content, itemOf(s, a.uid)?.itemId ?? '') > 0);
  if (hp < CLASS_FIGHT.guardBelow && !hasDraught && firstOf(legal, 'guard') !== undefined) return { type: 'guard' };

  const payable = (a: AbilityAction): boolean => bloodComfortable(me, hpCostOf(s, content, me, a.abilityId), incoming);

  // the strikes
  const main = foes.filter((f) => !f.isAdd);
  const wanted = new Set((main.length > 0 ? main : foes).map((f) => f.uid));
  const value = (a: StrikeAction): number => {
    const ab = a.type === 'ability' ? content.abilities[a.abilityId] : undefined;
    const targets = aimedAt(content, foes, a);
    if (targets.length === 0) return 0;
    const per = expectedDamage(content, me, a, foes.length);
    const m = targets.reduce((t, f) => t + hitMult(content, ab, f), 0) / targets.length;
    const physical = (ab?.damageType ?? 'physical') === 'physical';
    const lean = ab === undefined ? (cfg.lean === 'spell' ? CLASS_FIGHT.offLean : 1) : physical === (cfg.lean === 'weapon') ? 1 : CLASS_FIGHT.offLean;
    const focus = targets.some((f) => wanted.has(f.uid)) ? 1 : 0.25;
    // a strike that also lays a debuff the target lacks (Soaked before Storm, Mark, Bleed …) is worth a little more
    const lays = ab !== undefined && ab.statuses.some((st) => st.target !== 'self' && DEBUFFS.includes(st.status) && targets.some((f) => !hasStatus(f, st.status)));
    // the authored bonuses the target's statuses earn now (Executioner's Arc ×1.5 on an Armor Broken foe)
    const bonus = ab === undefined ? 1 : ab.bonuses.reduce((b, x) => (targets[0] !== undefined && targetHasNow(x.when, targets[0]) ? b * x.mult : b), 1);
    return per * m * lean * focus * bonus * (lays ? CLASS_FIGHT.debuffBonus : 1);
  };
  const strikes: StrikeAction[] = [
    ...allOf(legal, 'ability').filter((a) => {
      const ab = content.abilities[a.abilityId];
      return damaging(ab) && !FLEE_AIDS.has(a.abilityId) && (a.targetUid === undefined || foes.some((f) => f.uid === a.targetUid)) && payable(a);
    }),
    ...allOf(legal, 'attack'),
  ].filter((a) => value(a) > 0);
  const hpOf = (a: StrikeAction): number => aimedAt(content, foes, a)[0]?.hp ?? Number.POSITIVE_INFINITY;
  const best = [...strikes].sort((a, b) => value(b) - value(a) || hpOf(a) - hpOf(b))[0];
  const bestValue = best === undefined ? 0 : value(best);

  // the caster's lean (PLAN §7.2): a boss first gets Weaken / Curse — a damaging hex too — while it lacks them
  const boss0 = foes.find((f) => content.creatures[f.refId]?.role === 'boss');
  if (cfg.hexBossFirst === true && boss0 !== undefined) {
    const hex = allOf(legal, 'ability').find((a) => {
      const ab = content.abilities[a.abilityId];
      if (ab === undefined || (a.targetUid !== undefined && a.targetUid !== boss0.uid) || !payable(a)) return false;
      if (ab.power === undefined && ab.mp > 0 && me.mp - ab.mp < strikeReserve(s, content)) return false;
      return CLASS_FIGHT.hexStatuses.some((st) => ab.statuses.some((x) => x.status === st && x.target !== 'self') && !hasStatus(boss0, st));
    });
    if (hex !== undefined) return hex;
  }

  // the setup row
  const note = usedNote(memory, s);
  const reserve = strikeReserve(s, content);
  const boss = foes.find((f) => content.creatures[f.refId]?.role === 'boss');
  const foeHp = foes.reduce((t, f) => t + f.hp, 0);
  const worth = foeHp > CLASS_FIGHT.setupWorth * Math.max(1, bestValue);
  // never two setups in a row: a strike between them
  if (worth && note.lastRound !== combat.round - 1) {
    const setups = allOf(legal, 'ability').filter((a) => {
      const ab = content.abilities[a.abilityId];
      if (ab === undefined || damaging(ab) || ab.heal !== undefined || FLEE_AIDS.has(ab.id) || ab.target === 'ally') return false;
      const last = note.at[ab.id];
      if (last !== undefined && combat.round - last < Math.max(ab.cooldown ?? 0, CLASS_FIGHT.recastGap)) return false;
      if (ab.mp > 0 && me.mp - ab.mp < reserve) return false;
      // HP into resource (Blood Pact): only when the resource is low
      if (ab.mp === 0 && ab.selfCost !== undefined && ab.statuses.length === 0 && ab.shield === undefined && me.mp >= CLASS_FIGHT.convertBelow * me.mpMax) return false;
      if (a.targetUid !== undefined && !foes.some((f) => f.uid === a.targetUid) && a.targetUid !== me.uid) return false;
      return payable(a) && setupAdds(me, foes, a, ab, last !== undefined);
    });
    // a debuff on the boss (else the toughest foe) first, then the rest in the class's authored order
    const toughest = boss ?? [...foes].sort((x, y) => y.hp - x.hp)[0];
    const rank = (a: AbilityAction): number => {
      const ab = content.abilities[a.abilityId] as Ability;
      const debuff = ab.statuses.some((st) => DEBUFFS.includes(st.status) && st.target !== 'self');
      if (debuff && a.targetUid !== undefined && a.targetUid === toughest?.uid) return 0;
      return debuff ? 1 : 2;
    };
    const pick = [...setups].sort((a, b) => rank(a) - rank(b))[0];
    if (pick !== undefined) {
      note.at[pick.abilityId] = combat.round;
      note.lastRound = combat.round;
      return pick;
    }
  }

  if (best !== undefined) {
    // a basic attack that finishes the strike's single target spends no resource
    if (best.type === 'ability' && (content.abilities[best.abilityId]?.mp ?? 0) > 0) {
      const targets = aimedAt(content, foes, best);
      const only = targets.length === 1 ? targets[0] : undefined;
      if (only !== undefined) {
        const finisher = allOf(legal, 'attack').find((a) => a.targetUid === only.uid && me.atk * hitMult(content, undefined, only) * CLASS_FIGHT.overkill >= only.hp);
        if (finisher !== undefined) return finisher;
      }
    }
    if (best.type === 'ability') return best;
  }
  // nothing worth casting (a caster class): Guard feeds the pool when a held strike is short of it — a martial class's
  // basic attack builds its own resource (Focus) or takes the blows that do (Grit), so it attacks
  const casterClass = primaryStat(content, s.player.classId) === 'magic';
  const starved = s.player.abilitiesUnlocked.some((id) => {
    const ab = content.abilities[id];
    return damaging(ab) && (ab?.mp ?? 0) > me.mp;
  });
  if (casterClass && starved && hp < CLASS_FIGHT.guardForResourceBelow && firstOf(legal, 'guard') !== undefined) return { type: 'guard' };
  return best ?? firstOf(legal, 'attack') ?? firstOf(legal, 'guard') ?? fallback(legal);
}

// ---- the build: stat points and unlocks that fit the class --------------------------------------------------------------------------

/** The stat a bot puts its points into: its own lean, except that a caster class always takes MAG and a martial class never does. */
export function classStat(content: ContentPack, classId: string, lean: 'strength' | 'magic' | 'agility'): 'strength' | 'magic' | 'agility' {
  const caster = primaryStat(content, classId) === 'magic';
  if (caster) return 'magic';
  return lean === 'magic' ? 'strength' : lean;
}

/**
 * The unlock rank for a bot that leans to `branches` (lower first; never undefined, so every point is spent): the bot's
 * branches, then damaging abilities on the class's own stat (SP for a caster class, ATK otherwise), then other damaging
 * ones, then heals and shields, then the rest. Flight aids last.
 */
export function classUnlockRank(content: ContentPack, classId: string, branches: readonly string[]): (ab: Ability) => number {
  const sp = primaryStat(content, classId) === 'magic';
  return (ab) => {
    if (FLEE_AIDS.has(ab.id)) return 6;
    const own = ab.power !== undefined && (ab.power.stat === 'sp') === sp;
    if (ab.branch !== undefined && branches.includes(ab.branch) && (ab.power === undefined || own)) return 0;
    if (own) return 1;
    if (ab.power !== undefined) return 2;
    if (ab.heal !== undefined || ab.shield !== undefined) return 3;
    return 4;
  };
}

/** Is `a` a cast that pays the Blood price (for tests and the runner's count)? */
export const castPaysBlood = (s: GameState, content: ContentPack, a: Action): boolean =>
  a.type === 'ability' && s.combat !== null && abilityOf(content, a) !== undefined && paysBlood(s, content, playerOf(s.combat), a.abilityId);
