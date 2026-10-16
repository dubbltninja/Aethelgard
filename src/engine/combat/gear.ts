// Gear in a fight: passives and affix scripts (U34b; DESIGN §7.3 the affix table, §7.7 Shadow-Kissed Dagger and
// Necromancer Staff, §4.3 the pipeline, §4.5 statuses, §5.1 self-costs; D-066 #5, D-083, D-085). `derive()` collects what
// the player's gear carries; `gearPassives` (derived.ts) lists each passive with its source — `gear:<itemId>` for an
// item's own, `affix:<affixId>` for an affix's — in gear order (weapon, armor, trinkets; an item's passives, then its
// affixes'). Already read elsewhere before U34b: kill_xp (rewards.ts), damageBonus (damage.ts step 7), mpCostReduction
// (progression.ts), resourceGain and guardValue (reducers/combat.ts, damage.ts), statusImmunity (statuses.ts), resist
// (turnOrder.ts) and grantAbility (abilities.ts). This file is the rest, at the reducer's hook points
// (reducers/combat.ts):
//
//   on hit (rule 1)   a direct hit by the player that lands and deals damage (HP or Shield): the basic attack
//                     (`gearAfterBasic`) and a damaging ability (`gearAfterCast`: each target once per cast, the HP of
//                     every hit the cast dealt it under the ability's id summed). Not DoT ticks, counters, reflects,
//                     auras, companions or items. After the action's own resolution, per target in strike order, the
//                     passives in gear order:
//     statusOnHit     `chance` → the status for `duration` through `applyStatus` (immunities and caps apply);
//     curse           `chance` → Curse (3) on the target; then the wielder pays `damage` HP, never below 1 (self-costs
//                     never kill, D-066 #5) — "The dagger drinks.";
//     lifeSteal       heals ⌊pct × the HP the target lost × the wielder's healing modifiers (Curse ×0.5)⌋, clamped to
//                     missing HP. DoT ticks never steal.
//                     A chance is one `rng.int(0, 99) < chance%` roll on the run Rng (none when certain or impossible),
//                     made only while its target stands.
//   rider             `basic_attack_rider` (affix_of_embers): a basic attack that lands adds pct × its damage (HP and
//                     Shield) as a separate hit of `damageType` — the resistance step only (`resolveTick`: cannot miss,
//                     no crit), and not "on hit". Before the on-hit passives.
//   step 7            `damage_vs_status` (affix_of_iron): damage.ts `gearStatusMults`, on any player direct hit.
//   reflect           `reflect_melee` (affix_of_thorns): a non-area Physical blow an enemy rolls against the player that
//                     takes HP (the engine's "melee" proxy, as ripostes use; specials.ts `reactToHit`) sends pct × that HP
//                     back as `damageType` — resistance step only, cannot miss, no crit; a fixed hit, so nothing
//                     reflects or counters it again (`gearReflect`, from the reducer's applyHit after `reactToHit`).
//   turn start        `gearTurnStart`, each of the player's turns (not a bonus action's start), before the class's
//                     `turn_start` resource (the Wizard's mana regen): `regen` — HP (halved while Poisoned, like
//                     status_regen, × healing modifiers, rounded half-up) and MP per passive. Out of combat: nothing
//                     (travel regen is the Attunements'). Also Foresight below.
//   Foresight         `att_foresight` (D-083): Hunter's Eye's FORESIGHT_KEY held in the fight's cooldown table for the
//                     whole fight (`keepForesight`: at the opening and every player turn start), so the party sees the
//                     next-next intents exactly as Hunter's Eye gives them.
//
// Events name their source for U39's damage share: `statusApplied.source`, `healed.source`, `resourceGained.reason`,
// and a gear hit's `damageDealt.refId` (kind 'item') — which is also its `counters.damageBySource` key.
// Unknown `custom` script ids, or params of the wrong shape, are ignored here (the content validator owns them).
import type { Passive } from '@schema/item';
import type { StepCtx } from '../ctx';
import { DAMAGE_TYPES, GEAR_SCRIPT, gearPassives, type SourcedPassive } from '../derived';
import { ATT_SCRIPT, attunementScript } from '../runRules';
import type { Combatant, CombatState, DamageType } from '../types/state';
import { gainMp } from './buffHooks';
import { COUNTER_PREFIX, bonusState } from './buffs';
import { resolveTick, rollPct, roundHalfUp, statusMods, type HitResult, type HitSpec } from './damage';
import { FORESIGHT_KEY, fixedHit, type CombatOps, type HitKind } from './specials';
import { REGEN_POISONED_MULT, STATUS, applyStatus, findStatus } from './statuses';
import { combatLog, isActive } from './turnOrder';

/** DESIGN §7.7 Shadow-Kissed Dagger: "Curse (3) on target". */
export const CURSE_ON_HIT_TURNS = 3;
/** The dagger's self-cost line (U34b brief). */
export const CURSE_COST_LINE = 'The dagger drinks.';
/** What Foresight holds FORESIGHT_KEY at: through the player's turn end and the enemies' turns, to the next refresh. */
export const FORESIGHT_HOLD = 2;
/** `damageDealt.kind` of a hit the gear itself deals (the rider, the reflect). */
export const GEAR_HIT_KIND: HitKind = 'item';
/** Floors must not lose a point to binary fractions (0.29 × 100 = 28.999…). */
const FLOOR_EPSILON = 1e-9;

/** One target a direct hit landed on, and the HP it lost to it (rule 1). */
export interface GearHit {
  target: Combatant;
  amount: number;
}

const ON_HIT_KINDS: readonly Passive['kind'][] = ['statusOnHit', 'curse', 'lifeSteal'];

/** A source for the log: the item's name, or the affix's suffix without "of (the)" ("Thorns", "Void"). */
const sourceName = (ctx: StepCtx, source: string): string => {
  const id = source.slice(source.indexOf(':') + 1);
  return ctx.content.items[id]?.name ?? ctx.content.affixes[id]?.suffix.replace(/^of (the )?/, '') ?? id;
};

/** A `custom` damage script's params (`{ damageType, pct }`), or null when it is another passive or malformed. */
function damageScript(p: Passive, scriptId: string): { damageType: DamageType; pct: number } | null {
  if (p.kind !== 'custom' || p.scriptId !== scriptId) return null;
  const { damageType, pct } = p.params;
  if (typeof pct !== 'number' || !(pct > 0) || typeof damageType !== 'string' || !(DAMAGE_TYPES as readonly string[]).includes(damageType)) return null;
  return { damageType: damageType as DamageType, pct };
}

/** A hit that landed and dealt damage, to HP or to a Shield (rule 1). */
const landed = (r: Pick<HitResult, 'hit' | 'immune' | 'amount' | 'absorbed'>): boolean => r.hit && !r.immune && r.amount + r.absorbed > 0;

// ---- on hit -------------------------------------------------------------------------------------------------------------------

/** A status from gear: one chance roll while the target stands, then `applyStatus` with the source. */
function rollStatus(ctx: StepCtx, combat: CombatState, player: Combatant, target: Combatant, statusId: string, chance: number, duration: number, source: string): void {
  if (!isActive(target)) return;
  if (!rollPct(ctx.rng, Math.round(chance * 100))) return;
  applyStatus(ctx, combat, player, target, statusId, { duration, source });
}

/** The curse's self-cost: `cost` HP, never below 1 (D-066 #5). */
function payBlood(combat: CombatState, player: Combatant, cost: number): void {
  const paid = Math.min(Math.max(0, roundHalfUp(cost)), Math.max(0, player.hp - 1));
  if (paid <= 0) return;
  player.hp -= paid;
  combatLog(combat, CURSE_COST_LINE, 'info');
}

/** Life steal: ⌊raw × healing modifiers⌋, clamped to missing HP; `healed` with the source. */
function steal(ctx: StepCtx, combat: CombatState, player: Combatant, raw: number, source: string): void {
  let x = raw;
  for (const pct of statusMods(player, ctx.content).healing) x *= 1 + pct;
  const amount = Math.min(Math.max(0, Math.floor(x + FLOOR_EPSILON)), Math.max(0, player.hpMax - player.hp));
  if (amount <= 0) return;
  player.hp += amount;
  ctx.emit({ t: 'healed', targetUid: player.uid, amount, source });
  combatLog(combat, `${sourceName(ctx, source)} drinks: ${player.name} recovers ${amount} HP.`, 'heal');
}

function onHitPassive(ctx: StepCtx, combat: CombatState, player: Combatant, hit: GearHit, { source, passive: p }: SourcedPassive): void {
  if (p.kind === 'statusOnHit') rollStatus(ctx, combat, player, hit.target, p.status, p.chance, p.duration, source);
  else if (p.kind === 'curse') {
    rollStatus(ctx, combat, player, hit.target, STATUS.curse, p.chance, CURSE_ON_HIT_TURNS, source);
    payBlood(combat, player, p.damage);
  } else if (p.kind === 'lifeSteal' && p.pct > 0 && hit.amount > 0) steal(ctx, combat, player, p.pct * hit.amount, source);
}

/** Rules 2–4: the gear's on-hit passives for each target a direct hit landed on, targets in order, passives in gear order. */
export function gearOnHit(ctx: StepCtx, combat: CombatState, player: Combatant, hits: readonly GearHit[]): void {
  if (hits.length === 0 || player.kind !== 'player') return;
  const passives = gearPassives(ctx.s.player, ctx.content).filter((sp) => ON_HIT_KINDS.includes(sp.passive.kind));
  for (const hit of hits) {
    for (const sp of passives) {
      if (!isActive(player)) return;
      onHitPassive(ctx, combat, player, hit, sp);
    }
  }
}

/**
 * The targets a cast's direct hits landed on, from the events since `from` (the `damageDealt` the player dealt under the
 * ability's id, kind 'ability', that took HP or Shield): first-hit order, each with the HP it lost in all.
 */
export function castHits(ctx: StepCtx, combat: CombatState, player: Combatant, abilityId: string, from: number): GearHit[] {
  const out = new Map<string, GearHit>();
  for (let i = from; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e?.t !== 'damageDealt' || e.sourceUid !== player.uid || e.kind !== 'ability' || e.refId !== abilityId || e.amount + e.absorbed <= 0) continue;
    const target = combat.enemies.find((c) => c.uid === e.targetUid);
    if (!target) continue;
    const row = out.get(target.uid) ?? { target, amount: 0 };
    row.amount += e.amount;
    out.set(target.uid, row);
  }
  return [...out.values()];
}

/** After the player's ability in a fight (reducers/combat.ts): the on-hit passives for every target it landed on. */
export function gearAfterCast(ctx: StepCtx, combat: CombatState, player: Combatant, abilityId: string, from: number): void {
  gearOnHit(ctx, combat, player, castHits(ctx, combat, player, abilityId, from));
}

// ---- the rider ------------------------------------------------------------------------------------------------------------------

/** `basic_attack_rider`: pct × the landed basic attack's damage, as its own hit of the script's type (resistance step only). */
export function gearRider(ops: CombatOps, ctx: StepCtx, combat: CombatState, player: Combatant, target: Combatant, result: HitResult): void {
  const dealt = result.amount + result.absorbed;
  for (const { source, passive } of gearPassives(ctx.s.player, ctx.content)) {
    const rider = damageScript(passive, GEAR_SCRIPT.basicAttackRider);
    if (!rider || dealt <= 0 || !isActive(target) || !isActive(player)) continue;
    const raw = rider.pct * dealt;
    const tick = resolveTick(target, raw, rider.damageType);
    const spec: HitSpec = { source, type: rider.damageType, base: raw, coef: 0, stat: 'atk', cannotMiss: true };
    combatLog(combat, `${sourceName(ctx, source)} follows the blow.`, 'damage');
    ops.applyHit(ctx, combat, player, target, spec, fixedHit(tick.amount, tick.immune, tick.steps), GEAR_HIT_KIND);
  }
}

/** After the player's basic attack (reducers/combat.ts `attack`): if it landed, the rider, then the on-hit passives. */
export function gearAfterBasic(ops: CombatOps, ctx: StepCtx, combat: CombatState, player: Combatant, target: Combatant, result: HitResult): void {
  if (!landed(result)) return;
  gearRider(ops, ctx, combat, player, target, result);
  gearOnHit(ctx, combat, player, [{ target, amount: result.amount }]);
}

// ---- the reflect ----------------------------------------------------------------------------------------------------------------

/**
 * `reflect_melee` (the reducer's applyHit, after `reactToHit`, when the player survived): a rolled, non-area Physical blow
 * from an enemy that took the player's HP sends pct × that HP back, per passive in gear order, while both stand.
 */
export function gearReflect(ops: CombatOps, ctx: StepCtx, combat: CombatState, attacker: Combatant, target: Combatant, spec: HitSpec, result: HitResult): void {
  if (target.kind !== 'player' || attacker.kind !== 'enemy') return;
  if (!result.hit || result.immune || result.variance === null || result.amount <= 0 || spec.type !== 'physical' || spec.aoe || spec.source.startsWith(COUNTER_PREFIX)) return;
  for (const { source, passive } of gearPassives(ctx.s.player, ctx.content)) {
    const reflect = damageScript(passive, GEAR_SCRIPT.reflectMelee);
    if (!reflect || !isActive(target) || !isActive(attacker)) continue;
    const raw = reflect.pct * result.amount;
    const tick = resolveTick(attacker, raw, reflect.damageType);
    const rspec: HitSpec = { source, type: reflect.damageType, base: raw, coef: 0, stat: 'atk', cannotMiss: true };
    combatLog(combat, `${sourceName(ctx, source)} bites back at ${attacker.name}.`, 'damage');
    ops.applyHit(ctx, combat, target, attacker, rspec, fixedHit(tick.amount, tick.immune, tick.steps), GEAR_HIT_KIND);
  }
}

// ---- the turn's start -----------------------------------------------------------------------------------------------------------

/** Foresight (att_foresight): Hunter's Eye's key, held for the whole fight while the Attunement is active. */
export function keepForesight(ctx: StepCtx, combat: CombatState): void {
  if (attunementScript(ctx.s.player, ctx.content, ATT_SCRIPT.foresight) === undefined) return;
  combat.cooldowns[FORESIGHT_KEY] = Math.max(combat.cooldowns[FORESIGHT_KEY] ?? 0, FORESIGHT_HOLD);
}

/** A `regen` passive's HP: halved while Poisoned (like status_regen), × healing modifiers, rounded half-up, clamped. */
function regenHp(ctx: StepCtx, combat: CombatState, player: Combatant, hp: number, source: string): void {
  let x = hp * (findStatus(player, STATUS.poison) ? REGEN_POISONED_MULT : 1);
  for (const pct of statusMods(player, ctx.content).healing) x *= 1 + pct;
  const amount = Math.min(Math.max(0, roundHalfUp(x)), Math.max(0, player.hpMax - player.hp));
  if (amount <= 0) return;
  player.hp += amount;
  ctx.emit({ t: 'healed', targetUid: player.uid, amount, source });
  combatLog(combat, `${sourceName(ctx, source)} restores ${amount} HP to ${player.name}.`, 'heal');
}

/** The start of the player's turn (reducers/combat.ts `startTurn`, before `turn_start`): Foresight, then each `regen`. */
export function gearTurnStart(ctx: StepCtx, combat: CombatState, actor: Combatant): void {
  if (actor.kind !== 'player' || bonusState(actor) === 'active') return; // a bonus action's start is not a turn
  keepForesight(ctx, combat);
  for (const { source, passive: p } of gearPassives(ctx.s.player, ctx.content)) {
    if (p.kind !== 'regen' || !isActive(actor)) continue;
    if (p.hp > 0) regenHp(ctx, combat, actor, p.hp, source);
    if (p.mp > 0) gainMp(ctx, combat, actor, p.mp, source);
  }
}
