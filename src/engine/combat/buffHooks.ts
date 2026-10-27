// What scripted buffs (combat/buffs.ts) do at the fight's fixed hook points (U26b; DESIGN §5; D-078). The numbers they
// change inside the hit pipeline are damage.ts's; this file is the side effects, called from:
//   statuses.ts startOfTurnStatuses → `buffTurnStart`: the player's turn begins — `round` buffs end; a bonus action's
//                                     start is not a turn (no ticks, no Doom Sigil);
//                                     each DoT tick → `tetherHeal` (Soul Tether);
//   statuses.ts endOfTurnStatuses   → `buffTurnEnd`: the turn that granted a bonus action does not end (no countdowns; the
//                                     caller's turn count is given back); otherwise Apex Predator doubles the class
//                                     resource gained this turn, then the player's own buff timers count down;
//   statuses.ts afterHit            → `afterHitBuffs`: a held crit is spent (Shadowstep), a miss on the player pays the dodge
//                                     MP (Dancer's Guard), the Shield's absorption heals (Leech Veil), damage on a tethered
//                                     target heals its opponents (Soul Tether);
//   specials.ts reactToHit          → `buffReactions`: the hit is reflected (Last Bastion), a Physical blow meets the heat
//                                     aura (Cinder Shield).
// Imports no statuses/specials code (statuses.ts imports this file); the reactions get the reducer's hit application and
// the status applier passed in.
import type { StepCtx } from '../ctx';
import type { Combatant, CombatState } from '../types/state';
import { resolveHit, resolveTick, rollPct, roundHalfUp, statusMods, type HitResult, type HitSpec } from './damage';
import {
  BONUS_ACTIVE,
  BONUS_KEY,
  BONUS_PENDING,
  COUNTER_PREFIX,
  NEXT_CRIT_TAG,
  absorbHealOf,
  auraOf,
  bonusState,
  clearRoundBuffs,
  countDownBuffs,
  dodgeMpOf,
  holdsNextCrit,
  reflectOf,
  removeTag,
  resourceMultOf,
  tetherOf,
} from './buffs';
import type { HitKind } from './specials';
import { combatLog, isActive } from './turnOrder';

const nameOf = (ctx: StepCtx, id: string): string => ctx.content.abilities[id]?.name ?? id;
const opponentsOf = (combat: CombatState, c: Combatant): Combatant[] => (c.kind === 'enemy' ? combat.party : combat.enemies);
const sameSide = (a: Combatant, b: Combatant): boolean => (a.kind === 'enemy') === (b.kind === 'enemy');

// ---- small effects ------------------------------------------------------------------------------------------------------------

/** MP for a party combatant, capped; `resourceGained` (the reducer's `addMp` rule). */
export function gainMp(ctx: StepCtx, combat: CombatState, c: Combatant, amount: number, reason: string): number {
  if (amount <= 0 || c.kind === 'enemy') return 0;
  const before = c.mp;
  c.mp = Math.min(c.mpMax, c.mp + amount);
  const gained = c.mp - before;
  if (gained > 0) {
    combat.resourceGainedThisTurn += gained;
    ctx.emit({ t: 'resourceGained', uid: c.uid, amount: gained, reason });
  }
  return gained;
}

/** A flat heal on a standing combatant (specials.ts `healFlat`'s rule): × healing modifiers, rounded, clamped to missing HP. */
export function healBy(ctx: StepCtx, combat: CombatState, target: Combatant, raw: number, source: string): number {
  if (!isActive(target) || target.hp <= 0 || raw <= 0) return 0;
  let x = raw;
  for (const pct of statusMods(target, ctx.content).healing) x *= 1 + pct;
  const amount = Math.min(Math.max(0, roundHalfUp(x)), Math.max(0, target.hpMax - target.hp));
  target.hp += amount;
  if (amount > 0) ctx.emit({ t: 'healed', targetUid: target.uid, amount, source });
  combatLog(combat, `${target.name} recovers ${amount} HP.`, 'heal');
  return amount;
}

/** Soul Tether: a share of the damage `holder` took heals its living opponents, split evenly. */
export function tetherHeal(ctx: StepCtx, combat: CombatState, holder: Combatant, amount: number): void {
  const tether = tetherOf(holder);
  if (!tether || amount <= 0) return;
  const healed = opponentsOf(combat, holder).filter((c) => isActive(c) && c.hp > 0);
  if (healed.length === 0) return;
  const share = (tether.value * amount) / healed.length;
  for (const c of healed) healBy(ctx, combat, c, share, tether.id);
}

// ---- turns ----------------------------------------------------------------------------------------------------------------------

const bonusKeyOf = (c: Combatant): string | undefined => Object.keys(c.cooldowns).find((k) => k.startsWith(BONUS_KEY));

/** The start of `actor`'s turn: true when it is a bonus action's start (no ticks follow). The player's turn ends `round` buffs. */
export function buffTurnStart(_ctx: StepCtx, combat: CombatState, actor: Combatant): boolean {
  if (actor.kind !== 'player') return false;
  if (bonusState(actor) === 'active') return true;
  for (const c of [...combat.party, ...combat.enemies]) clearRoundBuffs(c);
  return false;
}

/**
 * The end of `actor`'s turn: true when the turn granted a bonus action — then nothing counts down and the turn count the
 * reducer adds next is given back, so the bonus action and the turn that granted it are one turn. Otherwise (the player):
 * Apex Predator's resource doubling, then the player's own buff timers count down.
 */
export function buffTurnEnd(ctx: StepCtx, combat: CombatState, actor: Combatant): boolean {
  if (actor.kind !== 'player') return false;
  const bonus = bonusKeyOf(actor);
  if (bonus !== undefined && actor.cooldowns[bonus] === BONUS_PENDING) {
    actor.cooldowns[bonus] = BONUS_ACTIVE;
    actor.pattern.turnsTaken -= 1;
    return true;
  }
  if (bonus !== undefined) delete actor.cooldowns[bonus];
  doubleResources(ctx, combat, actor);
  for (const id of countDownBuffs(actor)) combatLog(combat, `${nameOf(ctx, id)} fades from ${actor.name}.`, 'status');
  return false;
}

/**
 * Apex Predator (DESIGN §5.2, "Focus generation ×2"): the class resource the player gained this turn — the class rules'
 * events since its turn began — is gained once more. (Riposte Stance's counter Focus, gained in enemy turns, is doubled
 * where it is paid: specials.ts.)
 */
function doubleResources(ctx: StepCtx, combat: CombatState, actor: Combatant): void {
  const mult = resourceMultOf(actor);
  if (!mult || mult.value <= 1) return;
  const rules = new Set<string>(ctx.content.classes[ctx.s.player.classId]?.resource.rules.map((r) => r.on) ?? []);
  let from = 0;
  for (let i = ctx.events.length - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e?.t === 'turnStarted' && e.uid === actor.uid) {
      from = i + 1;
      break;
    }
  }
  let gained = 0;
  for (let i = from; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e?.t === 'resourceGained' && e.uid === actor.uid && rules.has(e.reason)) gained += e.amount;
  }
  gainMp(ctx, combat, actor, Math.round(gained * (mult.value - 1)), mult.id);
}

// ---- hits -------------------------------------------------------------------------------------------------------------------

/** The scripted buffs' part of a resolved hit (statuses.ts `afterHit`, before its interplay; see the file header). */
export function afterHitBuffs(ctx: StepCtx, combat: CombatState, attacker: Combatant, target: Combatant, spec: HitSpec, result: HitResult): void {
  const rolled = !result.hit || result.variance !== null;
  if (rolled && holdsNextCrit(attacker, spec.source)) removeTag(attacker, NEXT_CRIT_TAG);
  if (!result.hit) {
    const dodge = dodgeMpOf(target);
    if (dodge && target.kind === 'player' && attacker.kind === 'enemy') gainMp(ctx, combat, target, dodge.value, dodge.id);
    return;
  }
  if (result.immune) return;
  const leech = absorbHealOf(target);
  if (leech && result.absorbed > 0) healBy(ctx, combat, target, leech.value * result.absorbed, leech.id);
  tetherHeal(ctx, combat, target, result.amount + result.absorbed);
}

type HitApplier = (ctx: StepCtx, combat: CombatState, attacker: Combatant, target: Combatant, spec: HitSpec, result: HitResult, kind: HitKind) => void;
type StatusApplier = (ctx: StepCtx, combat: CombatState, source: Combatant | null, target: Combatant, statusId: string, opts: { duration: number }) => unknown;

const fixed = (amount: number, immune: boolean, steps: HitResult['steps']): HitResult => ({
  hit: true, phased: false, crit: false, immune, hitChance: 100, critChance: 0, variance: null, amount, absorbed: 0, shieldBroken: false, mitigated: 0, steps,
});

/**
 * specials.ts `reactToHit` (the holder survived an opponent's connecting hit): Last Bastion reflects its share of the hit
 * (HP and Shield) as Physical, resistance step only; Cinder Shield answers a rolled Physical single-target blow with its
 * Fire (cannot miss) and may Burn the attacker. Counter-hits are never answered.
 */
export function buffReactions(ctx: StepCtx, combat: CombatState, applyHit: HitApplier, applyStatus: StatusApplier, attacker: Combatant, target: Combatant, spec: HitSpec, result: HitResult): void {
  if (!result.hit || result.immune || spec.source.startsWith(COUNTER_PREFIX) || sameSide(attacker, target)) return;
  const kind: HitKind = target.kind === 'enemy' ? 'intent' : 'ability';
  const reflect = reflectOf(target);
  const taken = result.amount + result.absorbed;
  if (reflect && taken > 0 && isActive(target) && isActive(attacker)) {
    const raw = reflect.value * taken;
    const tick = resolveTick(attacker, raw, 'physical');
    const rspec: HitSpec = { source: `${COUNTER_PREFIX}${reflect.id}`, type: 'physical', base: raw, coef: 0, stat: 'atk', cannotMiss: true };
    combatLog(combat, `${nameOf(ctx, reflect.id)} throws part of the blow back at ${attacker.name}.`, 'damage');
    applyHit(ctx, combat, target, attacker, rspec, fixed(tick.amount, tick.immune, tick.steps), kind);
  }
  const aura = auraOf(target);
  if (!aura || result.variance === null || spec.type !== 'physical' || spec.aoe || !isActive(target) || !isActive(attacker)) return;
  const a = aura.value;
  const aspec: HitSpec = { source: `${COUNTER_PREFIX}${aura.id}`, type: a.type, base: 0, coef: a.coef, stat: a.stat, cannotMiss: true };
  combatLog(combat, `${nameOf(ctx, aura.id)} scorches ${attacker.name}.`, 'damage');
  const r = resolveHit(ctx, target, attacker, aspec);
  applyHit(ctx, combat, target, attacker, aspec, r, kind);
  if (r.hit && !r.immune && isActive(attacker) && rollPct(ctx.rng, Math.round(a.chance * 100))) applyStatus(ctx, combat, target, attacker, a.status, { duration: a.duration });
}
