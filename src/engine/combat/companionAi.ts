// Companions (DESIGN §4.9, §12; PLAN §8.1 "companion AI", §9.2 U28; D-013, D-053, D-059, D-066 #5/#12, D-068.2, D-072,
// D-078).
//
// In a fight the active companion acts on its own initiative turn by **stance**. `companionAct` is DESIGN §4.9's
// decision rules (pure, no rng) over its three auto abilities, which use cooldowns in its own turns (no MP, D-066 #12;
// `cooldown` defaults by kind, D-072); `companionTurn` plays the choice through the same pipeline as everyone else:
//   aggressive — its debuff, if no foe carries the debuff's status (immune foes do not count), on the first foe without
//                it → its area attack against two or more foes → its attack on a Marked foe, else the lowest-HP one
//   guarded    — its heal on the player below 40 % HP → Guard below 35 % HP → its shield on an unshielded player when
//                the visible intents aimed at them reach 30 % of their max HP → its attack on the lowest-HP foe
//   support    — its heal on the lower (HP %) of player and itself below 60 % that the heal can reach → its cleanse on
//                a player with a debuff → its shield on an unshielded player → its buff on the player if they lack its
//                status → its debuff on the first foe → its utility → its attack on the lowest-HP foe
// "Ready" = off cooldown and abilities not blocked by a status; an attack that cannot be used becomes the plain strike
// (1.0·ATK of the companion's damage type). Foes' "lowest HP" is current HP (slot order on ties); allies compare HP %.
// DESIGN §4.9 gives `buff` and `utility` kinds no rule (Caelum's Haste; Dask's Glimpse, "his action when no better
// option", §12.4): Support uses them where listed above; Aggressive and Guarded never do. The content `stances` record
// (PLAN §5.11 thresholds and weights) is not read: DESIGN §4.9's numbers are the rule.
//
// The player's companion commands (DESIGN §4.1 `C`; D-053, D-078):
//   signature — the player's action (abilities.ts `useSignature`); its self-cost is paid first (Nyx's Unmaking: 10 % of
//               her HP; never kills, D-066 #5); loyalty ≥ 50 shortens its cooldown by one turn (§12.5)
//   focus     — free, one order per player turn: the companion's single-target picks go to that enemy while it stands;
//               `focus` without a target clears it
//   hold      — free, one order per player turn: on its next turn the companion does not act and Guards
// A stance change is free, once per player turn in a fight (§4.1 free actions) and at any time outside one; the stance
// belongs to the active companion (remembered for the loop, default Guarded, §12.2) and is mirrored on the player (UI).
// Orders and the stance budget live in the fight: `focus:<uid>` / `hold` on the companion's `pattern.firedOnce`, and
// one-turn markers in the player's cooldown table (the player's turn end clears them).
//
// Loyalty in a fight (§12.2, §12.5): Trusted (≥ 75) +10 % damage and healing (damage.ts `isTrusted`); a KO costs 2.
// KO (§4.9, §12.6): out of the fight (reducers/combat.ts), carried until revived — a full rest revives at 50 % (a short
// rest does not), `reviveCompanion` at a given share (Last Bastion 40 %, Lanternreed Salts 30 %; in or out of combat).
// Max HP follows the player's level (§12.3): turnOrder.ts at fight setup, `companionPostStep` everywhere else.
// Dask (D-059, D-066 #12, D-068.2, §12.8): may stand only where the location is `temporallyUnstable` or Horde-infected.
// Elsewhere he flickers out — the active slot empties (`companionSwapped`, his `constraintText`) and he travels with the
// party (`waitingAt: null`, `arcFlags.flickered_out`) — and he rejoins at the next such node unless someone took his
// place. Checked on arrival (first of ARRIVAL_HOOKS, before encounters), after every step outside a fight, and at fight
// setup (turnOrder.ts leaves him out).
// Swapping (§12.1, `swapCompanion`): at a usable rest spot, or with the companion present (waiting here, or travelling
// with the party); never a KO'd companion out; never Dask where he cannot stand. The one swapped out waits at home.
import type { Ability } from '@schema/ability';
import type { Effect } from '@schema/effect';
import { evaluate } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { apply } from '../effects';
import type { ArrivalHook } from '../reducers/explore';
import type { PostStepHook } from '../step';
import type { ActionOf } from '../types/actions';
import type { Profile } from '../types/profile';
import type { Combatant, CombatState, CompanionRunState, GameState, Stance } from '../types/state';
import { round } from '../util/math';
import { pickTargets, resolveAbility, signatureActions, signatureProblem, useSignature, type Picked } from './abilities';
import { hasStatus, resolveHit, roundHalfUp, type HitSpec } from './damage';
import { TAG_ALL } from './intents';
import { setTimer, type CombatOps } from './specials';
import { STATUS, blocksAction, statusImmunities } from './statuses';
import { combatLog, companionAllowedAt, companionHpMax, isActive, playerOf } from './turnOrder';

// ---- rules ------------------------------------------------------------------------------------------------------------------

export const STANCES: readonly Stance[] = ['aggressive', 'guarded', 'support'];
/** DESIGN §12.2: a new companion's stance. */
export const DEFAULT_STANCE: Stance = 'guarded';
/** DESIGN §4.9 Guarded: heal the player below this share of max HP. */
export const GUARDED_HEAL_BELOW = 0.4;
/** DESIGN §4.9 Guarded: Guard below this share of its own max HP. */
export const GUARDED_GUARD_BELOW = 0.35;
/** DESIGN §4.9 Guarded: shield the player when the intents aimed at them reach this share of their max HP. */
export const GUARDED_SHIELD_INCOMING = 0.3;
/** DESIGN §4.9 Support: heal the lower of player and companion below this share. */
export const SUPPORT_HEAL_BELOW = 0.6;
/** DESIGN §12.5: loyalty from which the signature's cooldown is one turn shorter. */
export const SIGNATURE_LOYALTY = 50;
/** DESIGN §12.5: loyalty change when the companion is knocked out in a fight. */
export const KO_LOYALTY = -2;
/** DESIGN §4.9 / §12.6: a full rest revives a knocked-out companion at this share of max HP. */
export const REST_REVIVE_PCT = 0.5;

/** `pattern.firedOnce` marker on the companion: `focus:<enemy uid>`. */
export const FOCUS_TAG = 'focus:';
/** `pattern.firedOnce` marker on the companion: hold on its next turn. */
export const HOLD_TAG = 'hold';
/** One-turn markers in the player's cooldown table: the stance was changed / an order was given this turn. */
export const STANCE_SET_KEY = 'stance_set';
export const ORDER_KEY = 'order_given';
/** `CompanionRunState.arcFlags` key: Dask flickered out and rejoins at the next flagged node (D-068.2). */
export const FLICKERED_FLAG = 'flickered_out';

const STANCE_NAMES: Readonly<Record<Stance, string>> = { aggressive: 'Aggressive', guarded: 'Guarded', support: 'Support' };

// ---- reading the fight --------------------------------------------------------------------------------------------------

/** What the decision reads: the state (stances, loyalty, immunities) and the pack. */
export type CompanionRead = Pick<StepCtx, 's' | 'content'>;

const hpPct = (c: Combatant): number => (c.hpMax > 0 ? c.hp / c.hpMax : 0);
const livingFoes = (combat: CombatState): Combatant[] => combat.enemies.filter(isActive);

/** The lowest current HP (slot order on ties). */
const lowestHp = (foes: readonly Combatant[]): Combatant | undefined => foes.reduce<Combatant | undefined>((a, b) => (a === undefined || b.hp < a.hp ? b : a), undefined);

/** A Marked foe first (DESIGN §4.5 "Aggressive companions prefer it"), lowest HP among them, else the lowest-HP foe. */
const markedThenLowest = (foes: readonly Combatant[]): Combatant | undefined => lowestHp(foes.filter((f) => hasStatus(f, STATUS.mark))) ?? lowestHp(foes);

/** The companion's run record (stance, loyalty). */
export const companionRun = (s: GameState, c: Pick<Combatant, 'refId'>): CompanionRunState | undefined => s.companions.recruited[c.refId];

/** The active companion's stance (default Guarded). */
export const stanceOf = (s: GameState, c: Pick<Combatant, 'refId'>): Stance => companionRun(s, c)?.stance ?? DEFAULT_STANCE;

/** The companion's three auto abilities, in its record's order. */
export function autoAbilities(content: ContentPack, companionId: string): Ability[] {
  return (content.companions[companionId]?.abilities ?? []).flatMap((id) => (content.abilities[id] ? [content.abilities[id] as Ability] : []));
}

/** DESIGN §4.9 `ready(c, a)`: off cooldown (in the companion's turns), and no status blocks abilities. */
export const abilityReady = (content: ContentPack, c: Combatant, a: Ability): boolean => (c.cooldowns[a.id] ?? 0) <= 0 && !blocksAction(content, c, 'ability');

/** The status an ability puts on its target (debuffs, buffs): its first row on the target / every enemy / an ally. */
export const statusOfAbility = (a: Ability): string | undefined => a.statuses.find((r) => r.target === 'target' || r.target === 'all_enemies' || r.target === 'ally')?.status;

/** Who a heal ability can reach from `me`: the party for party/ally heals; the companion alone for a self heal or a drain. */
function healReaches(a: Ability, me: Combatant, who: Combatant): boolean {
  if (a.heal?.target === 'party' || a.target === 'party' || a.target === 'ally' || a.target === 'self_or_ally') return true;
  return who === me;
}

/**
 * The damage the player can see coming at `target` (DESIGN §4.9 `nextIntentDamage`): the upper projected bound of every
 * revealed intent aimed at them, area intents included. Hidden intents ("?") are not counted — the companion reacts to
 * what the player sees.
 */
export function incomingDamage(combat: CombatState, target: Combatant): number {
  let total = 0;
  for (const e of livingFoes(combat)) {
    const intent = combat.intents[e.uid];
    if (!intent || intent.hidden) continue;
    if (intent.tags.includes(TAG_ALL) || intent.targetUid === target.uid) total += intent.projected[1];
  }
  return total;
}

/** The enemy the player ordered the companion to focus, while it stands. */
export function focusOf(combat: CombatState, c: Combatant): Combatant | undefined {
  const tag = c.pattern.firedOnce.find((t) => t.startsWith(FOCUS_TAG));
  const uid = tag?.slice(FOCUS_TAG.length);
  return uid === undefined ? undefined : livingFoes(combat).find((f) => f.uid === uid);
}

export const holdOrdered = (c: Combatant): boolean => c.pattern.firedOnce.includes(HOLD_TAG);

// ---- the decision (DESIGN §4.9 companionAct) ------------------------------------------------------------------------------

export type CompanionMove =
  | { kind: 'ability'; ability: Ability; targetUid?: string; reason: string }
  | { kind: 'strike'; targetUid: string; reason: string }
  | { kind: 'guard'; reason: string }
  | { kind: 'wait'; reason: string };

/** The `ability` move with the target its `target` field takes (an enemy, a party member, or none). */
function use(a: Ability, recipient: Combatant | undefined, reason: string): CompanionMove {
  const takesTarget = a.target === 'enemy' || a.target === 'ally' || a.target === 'self_or_ally';
  return takesTarget && recipient ? { kind: 'ability', ability: a, targetUid: recipient.uid, reason } : { kind: 'ability', ability: a, reason };
}

/**
 * DESIGN §4.9 `companionAct`: what the companion does on its turn, by stance (see the file header). Pure: reads the
 * fight, the companion's cooldowns and statuses, the stance and the player's order (focus, hold). No rng.
 */
export function companionAct(r: CompanionRead, combat: CombatState, me: Combatant): CompanionMove {
  const { content } = r;
  const foes = livingFoes(combat);
  if (foes.length === 0) return { kind: 'wait', reason: 'no one left to fight' };
  const canGuard = !blocksAction(content, me, 'guard');
  if (holdOrdered(me)) return canGuard ? { kind: 'guard', reason: 'holding as ordered' } : { kind: 'wait', reason: 'holding as ordered' };
  const autos = autoAbilities(content, me.refId);
  const find = (kind: NonNullable<Ability['kind']>): Ability | undefined => {
    const a = autos.find((x) => x.kind === kind);
    return a && abilityReady(content, me, a) ? a : undefined;
  };
  const pl = playerOf(combat);
  const focus = focusOf(combat, me);
  const attack = (pick: Combatant | undefined, reason: string): CompanionMove => {
    const target = focus ?? pick ?? (foes[0] as Combatant);
    const a = find('attack');
    const why = focus ? 'the focused enemy' : reason;
    if (a && a.target === 'all_enemies') return use(a, undefined, why);
    return a ? use(a, target, why) : { kind: 'strike', targetUid: target.uid, reason: why };
  };
  const debuffTarget = (a: Ability): Combatant | undefined => {
    const st = statusOfAbility(a);
    if (st === undefined) return focus ?? foes[0];
    const open = (f: Combatant): boolean => !hasStatus(f, st) && !statusImmunities(r.s, content, f).includes(st);
    return focus && open(focus) ? focus : foes.find(open);
  };

  switch (stanceOf(r.s, me)) {
    case 'aggressive': {
      const debuff = find('debuff');
      const st = debuff ? statusOfAbility(debuff) : undefined;
      if (debuff && (st === undefined || !foes.some((f) => hasStatus(f, st)))) {
        const t = debuffTarget(debuff);
        if (t) return use(debuff, t, 'opening with its debuff');
      }
      const aoe = find('aoe');
      if (foes.length >= 2 && aoe) return use(aoe, undefined, 'two or more foes');
      return attack(markedThenLowest(foes), 'the Marked or weakest foe');
    }
    case 'guarded': {
      const heal = find('heal');
      if (hpPct(pl) < GUARDED_HEAL_BELOW && heal && healReaches(heal, me, pl)) return use(heal, heal.target === 'enemy' ? lowestHp(foes) : pl, 'you are badly hurt');
      if (hpPct(me) < GUARDED_GUARD_BELOW && canGuard) return { kind: 'guard', reason: 'it is badly hurt' };
      const shield = find('shield');
      if (shield && incomingDamage(combat, pl) >= GUARDED_SHIELD_INCOMING * pl.hpMax && !hasStatus(pl, STATUS.shield)) return use(shield, pl, 'a heavy blow is coming at you');
      return attack(lowestHp(foes), 'the weakest foe');
    }
    case 'support': {
      const heal = find('heal');
      if (heal) {
        const low = [pl, me].filter((c) => isActive(c) && hpPct(c) < SUPPORT_HEAL_BELOW && healReaches(heal, me, c)).sort((a, b) => hpPct(a) - hpPct(b))[0];
        if (low) return use(heal, heal.target === 'enemy' ? (focus ?? lowestHp(foes)) : low, low === pl ? 'you are hurt' : 'it is hurt');
      }
      const cleanse = find('cleanse');
      if (cleanse && pl.statuses.some((st) => content.statuses[st.statusId]?.kind === 'debuff')) return use(cleanse, pl, 'you carry a debuff');
      const shield = find('shield');
      if (shield && !hasStatus(pl, STATUS.shield)) return use(shield, pl, 'you have no Shield');
      const buff = find('buff');
      const buffStatus = buff ? statusOfAbility(buff) : undefined;
      if (buff && (buffStatus === undefined || !hasStatus(pl, buffStatus))) return use(buff, pl, 'you could use it');
      const debuff = find('debuff');
      if (debuff) return use(debuff, focus ?? foes[0], 'weakening the foe');
      const utility = find('utility');
      if (utility) return use(utility, pl, 'no better option');
      return attack(lowestHp(foes), 'the weakest foe');
    }
  }
}

// ---- the turn -------------------------------------------------------------------------------------------------------------

/** The plain strike: 1.0·ATK of the companion's damage type (DESIGN §4.9 `basic(c)`). */
export function strikeSpec(content: ContentPack, companionId: string): HitSpec {
  return { source: 'basic', type: content.companions[companionId]?.damageType ?? 'physical', base: 0, coef: 1, stat: 'atk' };
}

/** An auto ability on the companion's own turn: its cooldown (+1 on its own turn, D-078), `abilityUsed`, resolution. */
function useAuto(ops: CombatOps, ctx: StepCtx, combat: CombatState, me: Combatant, a: Ability, picked: Picked, reason: string): void {
  if (a.cooldown > 0) setTimer(combat, me, a.id, a.cooldown);
  ctx.s.counters.abilitiesUsed[a.id] = (ctx.s.counters.abilitiesUsed[a.id] ?? 0) + 1;
  ctx.emit({ t: 'abilityUsed', uid: me.uid, abilityId: a.id });
  combatLog(combat, `${me.name} uses ${a.name} (${reason}).`, 'info');
  resolveAbility(ops, ctx, combat, me, a, picked, 0);
}

function strike(ops: CombatOps, ctx: StepCtx, combat: CombatState, me: Combatant, target: Combatant): void {
  const spec = strikeSpec(ctx.content, me.refId);
  ops.applyHit(ctx, combat, me, target, spec, resolveHit(ctx, me, target, spec), 'basic');
}

/** The companion's action on its own turn (the reducer handles the turn's start and end): DESIGN §4.9 by stance. */
export function companionTurn(ops: CombatOps, ctx: StepCtx, combat: CombatState, me: Combatant): CompanionMove {
  const move = companionAct(ctx, combat, me);
  me.pattern.firedOnce = me.pattern.firedOnce.filter((t) => t !== HOLD_TAG); // a hold lasts one turn
  switch (move.kind) {
    case 'ability': // the decision only names targets that fit (a living foe, a party member, or none)
      useAuto(ops, ctx, combat, me, move.ability, pickTargets(combat, me, move.ability, move.targetUid) as Picked, move.reason);
      break;
    case 'strike': {
      const t = livingFoes(combat).find((f) => f.uid === move.targetUid);
      if (t) strike(ops, ctx, combat, me, t);
      break;
    }
    case 'guard':
      me.guarding = true;
      ctx.emit({ t: 'guarded', uid: me.uid });
      combatLog(combat, `${me.name} guards (${move.reason}).`, 'info');
      break;
    case 'wait':
      combatLog(combat, `${me.name} waits (${move.reason}).`, 'info');
      break;
  }
  return move;
}

/** DESIGN §12.5: a companion knocked out in a fight loses 2 loyalty; its orders end with it. */
export function companionKnockedOut(ctx: StepCtx, c: Combatant): void {
  c.pattern.firedOnce = c.pattern.firedOnce.filter((t) => !t.startsWith(FOCUS_TAG) && t !== HOLD_TAG);
  if (companionRun(ctx.s, c)) apply({ loyalty: { companion: c.refId, delta: KO_LOYALTY } } as Effect, ctx);
}

// ---- revive ----------------------------------------------------------------------------------------------------------------

/**
 * Revives the knocked-out companion at `pct` of its max HP (DESIGN §12.6: Last Bastion 40 %, Lanternreed Salts 30 %),
 * in a fight (it stands again, statuses cleared, and takes its turns from the next round) or outside one (the active
 * companion if it is down, else the first one down). False when no one is down.
 */
export function reviveCompanion(ctx: StepCtx, pct: number, source: string): boolean {
  const combat = ctx.s.combat;
  if (combat !== null) {
    const down = combat.party.find((c) => c.kind === 'companion' && !c.alive && !c.fledOrGone);
    if (!down) return false;
    Object.assign(down, { alive: true, hp: Math.max(1, roundHalfUp(down.hpMax * pct)), statuses: [], guarding: false });
    ctx.emit({ t: 'healed', targetUid: down.uid, amount: down.hp, source });
    combatLog(combat, `${down.name} stands up again (${down.hp} HP).`, 'heal');
    return true;
  }
  const { recruited, activeId } = ctx.s.companions;
  const active = activeId === null ? undefined : recruited[activeId];
  const down = active?.ko && !active.dead ? active : Object.values(recruited).find((c) => c.ko && !c.dead);
  if (!down) return false;
  down.ko = false;
  down.hp = Math.max(1, round(down.hpMax * pct));
  ctx.log(`${ctx.content.companions[down.id]?.name ?? down.id} comes round (${down.hp} HP).`, 'event');
  return true;
}

/**
 * A rest (reducers/explore.ts): every companion standing recovers `pct` of its max HP (at least 1); a knocked-out one is
 * revived only by a full rest, at 50 % (DESIGN §4.9, §12.6).
 */
export function restCompanions(ctx: StepCtx, full: boolean, pct: number): void {
  for (const c of Object.values(ctx.s.companions.recruited)) {
    if (c.dead) continue;
    if (!c.ko) {
      c.hp = Math.min(c.hpMax, Math.max(1, c.hp + round(c.hpMax * pct)));
      continue;
    }
    if (!full) continue;
    c.ko = false;
    c.hp = Math.max(1, round(c.hpMax * REST_REVIVE_PCT));
    ctx.log(`${ctx.content.companions[c.id]?.name ?? c.id} comes round by the fire (${c.hp} HP).`, 'event');
  }
}

// ---- the player's commands --------------------------------------------------------------------------------------------------

/** The standing companion of a fight. */
export const standingCompanion = (combat: CombatState): Combatant | undefined => combat.party.find((c) => c.kind === 'companion' && isActive(c));

/** HP the signature's self-cost takes from the companion (%-costs round down, at least 1; D-074). */
export function signatureHpCost(content: ContentPack, companion: Combatant): number {
  const sig = content.companions[companion.refId]?.signature;
  const cost = sig ? content.abilities[sig.abilityId]?.selfCost : undefined;
  if (!cost) return 0;
  let hp = 0;
  if (cost.hpPctMax !== undefined) hp += Math.max(1, Math.floor(cost.hpPctMax * companion.hpMax));
  if (cost.hpPctCur !== undefined) hp += Math.max(1, Math.floor(cost.hpPctCur * companion.hp));
  return hp;
}

/** Why the order (`focus` / `hold`) cannot be given now, or null. Free; one order per player turn (D-078). */
export function orderProblem(combat: CombatState, a: ActionOf<'companionCommand'>): string | null {
  const me = standingCompanion(combat);
  if (!me) return 'You have no companion standing';
  if ((combat.cooldowns[ORDER_KEY] ?? 0) > 0) return `${me.name} already has an order this turn`;
  if (a.command === 'hold') {
    if (a.targetUid !== undefined) return 'Hold takes no target';
    return holdOrdered(me) ? `${me.name} is already holding` : null;
  }
  const focus = focusOf(combat, me);
  if (a.targetUid === undefined) return focus ? null : `${me.name} has no focus to clear`;
  const t = livingFoes(combat).find((f) => f.uid === a.targetUid);
  if (!t) return `There is no enemy '${a.targetUid}' to focus`;
  return focus === t ? `${me.name} is already focused on ${t.name}` : null;
}

/** Gives a `focus` / `hold` order (the reducer checked `orderProblem`); the player's turn goes on. */
export function giveOrder(ctx: StepCtx, combat: CombatState, a: ActionOf<'companionCommand'>): void {
  const me = standingCompanion(combat) as Combatant;
  combat.cooldowns[ORDER_KEY] = 1;
  let text: string;
  if (a.command === 'hold') {
    me.pattern.firedOnce.push(HOLD_TAG);
    text = `${me.name} will hold and guard.`;
  } else {
    me.pattern.firedOnce = me.pattern.firedOnce.filter((t) => !t.startsWith(FOCUS_TAG));
    const t = a.targetUid === undefined ? undefined : livingFoes(combat).find((f) => f.uid === a.targetUid);
    if (t) me.pattern.firedOnce.push(`${FOCUS_TAG}${t.uid}`);
    text = t ? `${me.name} turns on ${t.name}.` : `${me.name} picks its own targets again.`;
  }
  combatLog(combat, text, 'info');
  ctx.log(text, 'combat'); // no dedicated event: the log line is the UI's cue (the state holds the order)
}

/** Every order the player could give now: focus on each other living enemy, clear a focus, hold. */
export function orderActions(combat: CombatState): ActionOf<'companionCommand'>[] {
  const out: ActionOf<'companionCommand'>[] = [
    { type: 'companionCommand', command: 'focus' },
    ...livingFoes(combat).map((f): ActionOf<'companionCommand'> => ({ type: 'companionCommand', command: 'focus', targetUid: f.uid })),
    { type: 'companionCommand', command: 'hold' },
  ];
  return out.filter((a) => orderProblem(combat, a) === null);
}

/** Why the signature cannot be commanded now (abilities.ts `signatureProblem`, plus its self-cost), or null. */
export function commandProblem(content: ContentPack, combat: CombatState, a: ActionOf<'companionCommand'>): string | null {
  if (a.command !== 'signature') return orderProblem(combat, a);
  const why = signatureProblem(content, combat, a);
  if (why !== null) return why;
  const me = standingCompanion(combat) as Combatant;
  const cost = signatureHpCost(content, me);
  return cost > 0 && me.hp <= cost ? 'Not enough blood' : null; // a self-cost never kills (D-066 #5)
}

/**
 * The signature on the player's action (D-053): its self-cost, then abilities.ts `useSignature` (cooldown, resolution),
 * then the loyalty ≥ 50 cooldown cut (§12.5).
 */
export function commandSignature(ops: CombatOps, ctx: StepCtx, combat: CombatState, a: ActionOf<'companionCommand'>): void {
  const me = standingCompanion(combat) as Combatant;
  const cost = signatureHpCost(ctx.content, me);
  if (cost > 0) {
    me.hp -= cost;
    combatLog(combat, `It takes ${cost} HP from ${me.name}.`, 'info');
  }
  useSignature(ops, ctx, combat, a);
  const id = ctx.content.companions[me.refId]?.signature.abilityId;
  const loyalty = companionRun(ctx.s, me)?.loyalty ?? 0;
  if (id !== undefined && loyalty >= SIGNATURE_LOYALTY && (me.cooldowns[id] ?? 0) > 1) me.cooldowns[id] = (me.cooldowns[id] ?? 0) - 1;
}

/** Every companion command the player may give now: the signature's targets (cost permitting) and the free orders. */
export function commandActions(content: ContentPack, combat: CombatState): ActionOf<'companionCommand'>[] {
  return [...signatureActions(content, combat).filter((a) => commandProblem(content, combat, a) === null), ...orderActions(combat)];
}

// ---- stance -------------------------------------------------------------------------------------------------------------------

/** Why the active companion's stance cannot become `stance` now, or null (a fight: the player's turn, once per turn). */
export function stanceProblem(s: GameState, stance: Stance): string | null {
  if (!STANCES.includes(stance)) return `Unknown stance '${String(stance)}'`;
  const combat = s.combat;
  const id = combat ? standingCompanion(combat)?.refId : s.companions.activeId;
  const run = id === undefined || id === null ? undefined : s.companions.recruited[id];
  if (!run || run.dead) return 'You have no companion with you';
  if (run.stance === stance) return `The stance is already ${STANCE_NAMES[stance]}`;
  if (combat && (combat.cooldowns[STANCE_SET_KEY] ?? 0) > 0) return 'The stance was already changed this turn';
  return null;
}

/** Sets the active companion's stance (and the player's mirror); in a fight, uses the turn's stance change. */
export function changeStance(ctx: StepCtx, stance: Stance): void {
  const { s } = ctx;
  const id = s.combat ? (standingCompanion(s.combat)?.refId as string) : (s.companions.activeId as string);
  const run = s.companions.recruited[id] as CompanionRunState;
  run.stance = stance;
  s.player.stance = stance;
  const name = ctx.content.companions[id]?.name ?? id;
  if (s.combat) {
    s.combat.cooldowns[STANCE_SET_KEY] = 1;
    combatLog(s.combat, `${name} takes the ${STANCE_NAMES[stance]} stance.`, 'info');
  }
  ctx.log(`${name} takes the ${STANCE_NAMES[stance]} stance.`, s.combat ? 'combat' : 'event');
}

export const stanceActions = (s: GameState): ActionOf<'setStance'>[] =>
  STANCES.filter((stance) => stanceProblem(s, stance) === null).map((stance) => ({ type: 'setStance', stance }));

// ---- Dask's places, max HP by level (out of combat) ----------------------------------------------------------------------------

const nameOf = (content: ContentPack, id: string): string => content.companions[id]?.name ?? id;

/**
 * D-059 / D-068.2 / DESIGN §12.8 at the current location: an active companion who cannot stand here flickers out; a
 * flickered one rejoins where he can, if the active slot is still empty. Idempotent.
 */
export function applyLocationRule(ctx: StepCtx): void {
  const { s, content } = ctx;
  const companions = s.companions;
  const here = s.world.currentLocationId;
  const activeId = companions.activeId;
  const active = activeId === null ? undefined : companions.recruited[activeId];
  if (activeId !== null && active && !companionAllowedAt(s, content, activeId, here)) {
    companions.activeId = null;
    active.waitingAt = null;
    active.arcFlags[FLICKERED_FLAG] = true;
    ctx.emit({ t: 'companionSwapped', activeId: null });
    ctx.log(content.companions[activeId]?.constraintText ?? `${nameOf(content, activeId)} cannot follow you here.`, 'event');
  }
  if (companions.activeId !== null) return;
  const back = Object.values(companions.recruited).find((c) => c.arcFlags[FLICKERED_FLAG] === true && !c.dead && companionAllowedAt(s, content, c.id, here));
  if (!back) return;
  delete back.arcFlags[FLICKERED_FLAG];
  companions.activeId = back.id;
  ctx.emit({ t: 'companionSwapped', activeId: back.id });
  ctx.log(`${nameOf(content, back.id)} flickers back into step beside you.`, 'event');
}

/** ARRIVAL_HOOKS (reducers/explore.ts), first: Dask's rule before any encounter rolls. */
export const companionArrivalHook: ArrivalHook = (ctx) => applyLocationRule(ctx);

/** Keeps every companion's max HP at the player's level (DESIGN §12.3); current HP moves by the same amount (≥ 1 unless KO'd). */
export function syncCompanionLevels(ctx: StepCtx): void {
  const { s, content } = ctx;
  for (const run of Object.values(s.companions.recruited)) {
    const def = content.companions[run.id];
    if (!def || run.dead) continue;
    const hpMax = companionHpMax(def, s.player.level);
    if (hpMax === run.hpMax) continue;
    const delta = hpMax - run.hpMax;
    run.hpMax = hpMax;
    run.hp = run.ko ? 0 : Math.min(hpMax, Math.max(1, run.hp + delta));
  }
}

/** Post-step hook (after characterPostStep): outside a fight, companion max HP by level; on the map, Dask's rule. */
export const companionPostStep: PostStepHook = (ctx) => {
  if (ctx.s.combat !== null) return;
  syncCompanionLevels(ctx);
  if (ctx.s.mode === 'explore' || ctx.s.mode === 'dialogue') applyLocationRule(ctx);
};

// ---- swapping (DESIGN §12.1) ---------------------------------------------------------------------------------------------------

/** The location's rest spot is usable now (its `when`). */
function restHere(s: GameState, content: ContentPack, profile: Readonly<Profile>): boolean {
  const rest = content.locations[s.world.currentLocationId]?.rest;
  return rest !== undefined && (rest.when === undefined || evaluate(rest.when, s, profile, content));
}

/** Where a companion sent away waits: its NPC's home node (DESIGN §12.1), else here. */
const homeOf = (s: GameState, content: ContentPack, id: string): string => {
  const npcId = content.companions[id]?.npcId;
  return (npcId === undefined ? undefined : content.npcs[npcId]?.homeLocationId) ?? s.world.currentLocationId;
};

/** Why the active companion cannot become `companionId` (null: no one) now, or null. */
export function swapProblem(s: GameState, content: ContentPack, profile: Readonly<Profile>, companionId: string | null): string | null {
  const { recruited, activeId } = s.companions;
  const here = s.world.currentLocationId;
  if (companionId === activeId) return companionId === null ? 'No one travels with you' : `${nameOf(content, companionId)} is already with you`;
  const active = activeId === null ? undefined : recruited[activeId];
  if (active?.ko) return `${nameOf(content, active.id)} is down; they cannot be sent away until revived`;
  if (companionId === null) return null;
  const c = recruited[companionId];
  if (!c || !c.recruited || c.dead) return `${nameOf(content, companionId)} is not one of your companions`;
  if (c.ko) return `${nameOf(content, companionId)} is down`;
  const present = c.waitingAt === null || c.waitingAt === here;
  if (!present && !restHere(s, content, profile)) return `${nameOf(content, companionId)} is not here (swap at a rest, or where they wait)`;
  if (!companionAllowedAt(s, content, companionId, here)) return content.companions[companionId]?.constraintText ?? `${nameOf(content, companionId)} cannot be here`;
  return null;
}

/** Swaps the active companion (the reducer checked `swapProblem`): the one leaving waits at home. */
export function swapCompanion(ctx: StepCtx, companionId: string | null): void {
  const { s, content } = ctx;
  const companions = s.companions;
  for (const c of Object.values(companions.recruited)) {
    const leaving = c.id === companions.activeId || c.arcFlags[FLICKERED_FLAG] === true;
    if (c.id === companionId || !leaving) continue;
    delete c.arcFlags[FLICKERED_FLAG];
    c.waitingAt = homeOf(s, content, c.id);
  }
  if (companionId !== null) {
    const c = companions.recruited[companionId] as CompanionRunState;
    c.waitingAt = null;
    delete c.arcFlags[FLICKERED_FLAG];
  }
  companions.activeId = companionId;
  ctx.emit({ t: 'companionSwapped', activeId: companionId });
  ctx.log(companionId === null ? 'You go on alone.' : `${nameOf(content, companionId)} travels with you now.`, 'event');
}

export function swapActions(s: GameState, content: ContentPack, profile: Readonly<Profile>): ActionOf<'swapCompanion'>[] {
  return [null, ...Object.keys(s.companions.recruited)]
    .filter((id) => swapProblem(s, content, profile, id) === null)
    .map((companionId) => ({ type: 'swapCompanion', companionId }));
}
