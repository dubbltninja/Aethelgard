// Status effects in a fight (DESIGN §4.1 turn timing, §4.5 the status table, §4.6 the interplay table; D-066 #4,
// D-067.18; PLAN §4.10 "Status timing", §8.1 rows "statuses" and "interplay").
//
// Data and code. A status record (content `StatusSchema`) carries what the pipeline reads generically: default duration,
// the stacking cap, the tick formula, flat modifiers (accuracy, evasion, initiative, outgoing/incoming/healing %,
// armorWardZero, skipTurn, blockActions). What no field can say is coded here by status id (DESIGN §4.5 columns
// "Stacking", "Tick timing", "Numeric effect", "Cleansed by"; §4.6), and in combat/damage.ts when it is a number in the
// hit pipeline (Phase's evasion, Shock's +25 % Storm, the step-6 multipliers, D-067.18).
//
// An instance (StatusInstance):
//   duration    turns of the holder. It counts down at the end of the holder's turn, except once for a status applied
//               during the holder's own turn (`appliedOnOwnTurn`, D-066 #4). At 0 it expires (`statusExpired`), except
//               Rewind, which fires at the start of the holder's next turn.
//   tick        the stored magnitude, computed at application from the source (DESIGN §4.5): a DoT's damage per stack,
//               Regen's heal per turn, the Shield's pool (what is left of it).
//   snapshotHp  Rewind's HP at application.
//
// A turn (DESIGN §4.1): `startOfTurnStatuses` — DoTs (Bleed, Burn, Poison, Curse), then Regen, then Rewind; a holder
// they kill does not act — then a Stunned holder loses its action (`skipsTurn`), then `endOfTurnStatuses` counts down.
// A Stun that wears off opens a 2-turn immunity window (DESIGN §4.5), kept in the holder's cooldown table under
// `status_stun` (the table its turn end already counts down; no ability id starts with `status_`).
//
// Applying (`applyStatus`; `applyStatusRows` for a move's or an ability's rows): a dead holder takes nothing; immunity
// (creature/companion records, the player's gear, Poison for constructs and breach-born, `tauntImmune`, Stun's window)
// logs "Immune"; interplay at application (rows 5, 6, 11); a refresh resets the duration to the application's and keeps
// the stronger tick; Bleed stacks (+n, cap 3); the Shield keeps the higher pool; Rewind is one per target. A row's chance
// is one percentage roll per recipient, in row order, after the hit's draws (PLAN §4.10).
//
// After a hit (`afterHit`, from the reducer's `applyHit`): Phase consumption on a Phased miss, and the interplay rows
// that change statuses (1–4, 9, 10, 12–16). DoT ticks take the resistance step only (damage.ts `dotDamage`) — no armor,
// ward, Guard, Shield, variance or crit — and trigger no interplay.
import type { CombatWhen, StatusApply } from '@schema/creature';
import type { Status } from '@schema/status';
import type { ContentPack, StepCtx } from '../ctx';
import { derive } from '../derived';
import { modifierDamageMult } from '../runRules';
import type { Combatant, CombatState, GameState, StatusInstance } from '../types/state';
import { afterHitBuffs, buffTurnEnd, buffTurnStart, tetherHeal } from './buffHooks';
import { buffBlocks, buffImmune, dotsTwice } from './buffs';
import { dotDamage, resolveTick, rollPct, roundHalfUp, statusMods, type HitResult, type HitSpec, type ScaleStat } from './damage';
import { combatLog, combatantByUid, isActive } from './turnOrder';

/** The 18 combat statuses and Rested (DESIGN §4.5; content `CANONICAL_STATUSES`). */
export const STATUS = {
  bleed: 'status_bleed',
  burn: 'status_burn',
  shock: 'status_shock',
  soaked: 'status_soaked',
  slow: 'status_slow',
  haste: 'status_haste',
  stun: 'status_stun',
  weaken: 'status_weaken',
  armorBreak: 'status_armor_break',
  mark: 'status_mark',
  curse: 'status_curse',
  shield: 'status_shield',
  regen: 'status_regen',
  taunt: 'status_taunt',
  phase: 'status_phase',
  rewind: 'status_rewind',
  poison: 'status_poison',
  blind: 'status_blind',
  rested: 'status_rested',
} as const;

/** DESIGN §4.1: the start-of-turn DoTs, in the order they tick. */
export const DOT_ORDER: readonly string[] = [STATUS.bleed, STATUS.burn, STATUS.poison, STATUS.curse];
/** DESIGN §4.5: a target that just recovered from Stun is immune for 2 of its turns. */
export const STUN_RECOVERY_TURNS = 2;
/** The cooldown-table key of that window. */
export const STUN_RECOVERY_KEY = STATUS.stun;
/** DESIGN §4.5 Poison: constructs and breach-born are immune (creature tags). */
export const POISON_IMMUNE_TAGS: readonly string[] = ['construct', 'breach_born'];
/** DESIGN §4.5 / D-066 #1: a boss's Rewind restores at most 10 % of its max HP. */
export const BOSS_REWIND_CAP = 0.1;
/** DESIGN §4.5 Rewind: what its restore also cleanses. */
export const REWIND_CLEANSES: readonly string[] = [STATUS.bleed, STATUS.burn, STATUS.poison];
/** Interplay 8: Regen heals 50 % while Poisoned. */
export const REGEN_POISONED_MULT = 0.5;
/** Interplay 1: the Shock a Storm hit on a Soaked target spreads (turns). */
export const SHOCK_SPREAD_TURNS = 2;
/** Interplay 12: the Stun a Storm crit on a Shocked target applies (turns). */
export const SHOCK_STUN_TURNS = 1;
/** Interplay 16: `wiz_immolate` consumes Burn for 3× its remaining ticks. */
export const IMMOLATE_ABILITY = 'wiz_immolate';
export const IMMOLATE_MULT = 3;

/** DESIGN §4.6, one row each; `rule` is the `interplay` event's id. Where each row lives is in its `where`. */
export interface InterplayRule {
  row: number;
  rule: string;
  trigger: string;
  result: string;
  where: 'damage step 6' | 'damage step 7' | 'damage hit%' | 'afterHit' | 'applyStatus' | 'turn start';
}

export const INTERPLAY_TABLE: readonly InterplayRule[] = [
  { row: 1, rule: 'storm_on_soaked', trigger: 'Storm damage on a Soaked target', result: '×1.5; Shock (2) on every other combatant of its side', where: 'damage step 6' },
  { row: 2, rule: 'fire_on_soaked', trigger: 'Fire damage on a Soaked target', result: '×0.5; Soaked removed', where: 'damage step 6' },
  { row: 3, rule: 'chrono_on_haste', trigger: 'Chrono damage on a Hasted target', result: 'Haste removed', where: 'afterHit' },
  { row: 4, rule: 'void_on_shield', trigger: 'Void damage on a Shielded target', result: 'Shield destroyed, no absorption', where: 'afterHit' },
  { row: 5, rule: 'soaked_on_burn', trigger: 'Soaked applied to a Burning target', result: 'Burn removed; Burn cannot be applied while Soaked', where: 'applyStatus' },
  { row: 6, rule: 'slow_haste_cancel', trigger: 'Slow applied to a Hasted target (or Haste to a Slowed one)', result: 'the existing one is removed; the new one is not applied', where: 'applyStatus' },
  { row: 7, rule: 'regen_on_bleed', trigger: 'Regen tick on a Bleeding target', result: '1 Bleed stack removed', where: 'turn start' },
  { row: 8, rule: 'poison_on_regen', trigger: 'Poison on a target with Regen', result: 'Regen heals 50 %', where: 'turn start' },
  { row: 9, rule: 'rewind_consumed', trigger: 'Void or Ley damage on a Rewound target', result: 'Rewind consumed (snapshot lost); Void ×1.25', where: 'damage step 6' },
  { row: 10, rule: 'chrono_ignores_phase', trigger: 'Chrono attack vs a Phased target', result: 'hits normally; Phase kept', where: 'damage hit%' },
  { row: 11, rule: 'stun_ends_taunt', trigger: 'Stun on a Taunting combatant', result: 'its Taunt ends', where: 'applyStatus' },
  { row: 12, rule: 'storm_crit_on_shock', trigger: 'Storm crit on a Shocked target', result: 'Stun (1) unless stun-immune', where: 'afterHit' },
  { row: 13, rule: 'ley_on_curse', trigger: 'Ley damage on a Cursed target', result: '×1.25; Curse removed', where: 'damage step 6' },
  { row: 14, rule: 'void_on_regen', trigger: 'Void damage on a target with Regen', result: 'Regen removed', where: 'afterHit' },
  { row: 15, rule: 'physical_crit_on_bleed', trigger: 'Physical crit on a Bleeding target', result: '+1 Bleed stack (max 3)', where: 'afterHit' },
  { row: 16, rule: 'immolate_on_burn', trigger: 'Fire damage by wiz_immolate on a Burning target', result: 'Burn consumed: 3× its remaining ticks at once', where: 'afterHit' },
  { row: 17, rule: 'armor_break_physical', trigger: 'Armor Break + Physical', result: '×1.15 and armor ignored', where: 'damage step 7' },
  { row: 18, rule: 'mark', trigger: 'Mark + any attack', result: 'cannot miss; ×1.15', where: 'damage step 7' },
];

// ---- lookups ------------------------------------------------------------------------------------------------------------

/** The status record (an unknown id is a content bug: loud). */
export function statusDef(content: ContentPack, statusId: string): Status {
  const def = content.statuses[statusId];
  if (!def) throw new Error(`status: unknown status '${statusId}'`);
  return def;
}

export const findStatus = (c: Pick<Combatant, 'statuses'>, statusId: string): StatusInstance | undefined => c.statuses.find((st) => st.statusId === statusId);

const has = (c: Pick<Combatant, 'statuses'>, statusId: string): boolean => c.statuses.some((st) => st.statusId === statusId);

/** A creature whose role is `boss` (Stun from heavy weapons, the Rewind cap). */
export const isBoss = (content: ContentPack, c: Combatant): boolean => c.kind === 'enemy' && content.creatures[c.refId]?.role === 'boss';

/** The cooldown table a combatant's turn end counts down: the fight's for the player, its own otherwise. */
export const cooldownsOf = (combat: CombatState, c: Combatant): Record<string, number> => (c.kind === 'player' ? combat.cooldowns : c.cooldowns);

const TURN_PHASES: readonly CombatState['phase'][] = ['playerTurn', 'companionTurn', 'enemyTurn'];

/** Is it `c`'s own turn right now (D-066 #4)? */
export const isOwnTurn = (combat: CombatState, c: Combatant): boolean => TURN_PHASES.includes(combat.phase) && combat.turnOrder[combat.turnIndex] === c.uid;

const sideOf = (combat: CombatState, c: Combatant): Combatant[] => (c.kind === 'enemy' ? combat.enemies : combat.party);
const opponentsOf = (combat: CombatState, c: Combatant): Combatant[] => (c.kind === 'enemy' ? combat.party : combat.enemies);

/**
 * What `c` cannot be given: a creature's `statusImmunities` (+ Poison for constructs and breach-born, + Taunt when
 * `tauntImmune`), a companion's record, the player's gear passives (derive).
 */
export function statusImmunities(s: GameState, content: ContentPack, c: Combatant): string[] {
  if (c.kind === 'enemy') {
    const def = content.creatures[c.refId];
    if (!def) return [];
    const out = [...def.statusImmunities];
    if (def.tags.some((t) => POISON_IMMUNE_TAGS.includes(t)) && !out.includes(STATUS.poison)) out.push(STATUS.poison);
    if (def.tauntImmune && !out.includes(STATUS.taunt)) out.push(STATUS.taunt);
    return out;
  }
  if (c.kind === 'companion') return [...(content.companions[c.refId]?.statusImmunities ?? [])];
  return derive(s.player, content).statusImmunities;
}

/** The holder loses its action this turn (Stun; any status with `skipTurn`). */
export const skipsTurn = (content: ContentPack, c: Combatant): boolean =>
  c.statuses.some((st) => st.statusId === STATUS.stun || (content.statuses[st.statusId]?.modifiers.skipTurn ?? false));

/** A status forbids this action kind (Slow: flee; content `blockActions`), or a scripted buff does (U26b: Mountainfall's Guard). */
export const blocksAction = (content: ContentPack, c: Combatant, action: 'ability' | 'item' | 'flee' | 'guard'): boolean =>
  c.statuses.some((st) => content.statuses[st.statusId]?.modifiers.blockActions.includes(action) ?? false) || buffBlocks(c, action);

/** The taunter whose uid a Taunted creature's single-target intents must target (DESIGN §4.2), if any. */
export const tauntedBy = (c: Combatant): string | null => findStatus(c, STATUS.taunt)?.sourceUid ?? null;

// ---- events and removal ---------------------------------------------------------------------------------------------------

const note = (combat: CombatState, text: string, kind: CombatState['log'][number]['kind'] = 'status'): void => combatLog(combat, text, kind);

function interplay(ctx: StepCtx, rule: string, target: Combatant): void {
  ctx.emit({ t: 'interplay', rule, targetUid: target.uid });
}

const nameOf = (content: ContentPack, statusId: string): string => content.statuses[statusId]?.name ?? statusId;

/** Removes a status (any cause: expiry, cleanse, interplay, consumption); emits `statusExpired`. False if absent. */
export function removeStatus(ctx: StepCtx, combat: CombatState, target: Combatant, statusId: string, why?: string): boolean {
  const i = target.statuses.findIndex((st) => st.statusId === statusId);
  if (i < 0) return false;
  target.statuses.splice(i, 1);
  ctx.emit({ t: 'statusExpired', targetUid: target.uid, statusId });
  note(combat, why ?? `${nameOf(ctx.content, statusId)} leaves ${target.name}.`);
  return true;
}

/** A cleanse (Field Dressing, Steady Breath, Oathbound, Bloom, Unravel …; the ability lists what): the ids removed. */
export function cleanse(ctx: StepCtx, combat: CombatState, target: Combatant, statusIds: readonly string[]): string[] {
  return statusIds.filter((id) => removeStatus(ctx, combat, target, id, `${target.name} is cleansed of ${nameOf(ctx.content, id)}.`));
}

/** Interplay 11: a Stunned taunter's Taunts end (every Taunt it is the source of). */
function endTaunts(ctx: StepCtx, combat: CombatState, taunter: Combatant): void {
  for (const c of [...combat.party, ...combat.enemies]) {
    if (findStatus(c, STATUS.taunt)?.sourceUid !== taunter.uid) continue;
    interplay(ctx, 'stun_ends_taunt', c);
    removeStatus(ctx, combat, c, STATUS.taunt, `${taunter.name} is stunned; ${c.name} is no longer taunted.`);
  }
}

// ---- applying -------------------------------------------------------------------------------------------------------------

export interface StatusApplyOptions {
  /** Turns (default: the status's `defaultDuration`). */
  duration?: number;
  /** Stacks added (stackable statuses; default 1). */
  stacks?: number;
  /** A magnitude scaled on the source (`StatusApply.power`: Regen per turn, a Shield pool). */
  power?: { base: number; coef: number; stat: ScaleStat };
  /** An explicit magnitude (overheal → Shield, a move's computed shield); wins over every formula. */
  amount?: number;
  /** What put it there, when not the source's own action: `gear:<itemId>` / `affix:<affixId>` (U34b) → `statusApplied.source`. */
  source?: string;
}

/**
 * applied/refreshed/stacked: the status is on the target. kept: Rewind already there (one per target). immune: an
 * immunity or Stun's recovery window. blocked: Burn on Soaked (row 5). cancelled: Slow/Haste met their opposite (row 6).
 * failed: the chance roll missed (`applyStatusRows`). ignored: the target is down.
 */
export type ApplyOutcome = 'applied' | 'refreshed' | 'stacked' | 'kept' | 'immune' | 'blocked' | 'cancelled' | 'failed' | 'ignored';

export interface ApplyResult {
  statusId: string;
  targetUid: string;
  outcome: ApplyOutcome;
}

const statOf = (c: Combatant, stat: ScaleStat): number => (stat === 'atk' ? c.atk : c.sp);

/**
 * The stored magnitude at application (DESIGN §4.5 "computed at application time from the source's stats"): an explicit
 * amount; else a DoT's own formula (round(base + coef·stat), D-066 #3: the same for every source); else the
 * application's `power`; else Regen's record (flat + % max HP); else the Shield record's `absorbFlat`.
 */
function magnitudeOf(def: Status, source: Combatant | null, target: Combatant, opts: StatusApplyOptions): number | undefined {
  if (opts.amount !== undefined) return Math.max(0, roundHalfUp(opts.amount));
  const scaled = (base: number, coef: number, stat: ScaleStat): number => Math.max(0, roundHalfUp(base + coef * (source ? statOf(source, stat) : 0)));
  const dmg = def.tick?.damage;
  if (dmg) return scaled(dmg.base, dmg.coef, dmg.stat);
  if (opts.power) return scaled(opts.power.base, opts.power.coef, opts.power.stat);
  const heal = def.tick?.heal;
  if (heal) return Math.max(0, roundHalfUp(heal.flat + heal.pctMaxHp * target.hpMax));
  if (def.modifiers.absorbFlat > 0) return def.modifiers.absorbFlat;
  return undefined;
}

/** Why `target` cannot take `statusId` right now, or null. */
function immunityOf(ctx: StepCtx, combat: CombatState, target: Combatant, statusId: string): string | null {
  if (statusImmunities(ctx.s, ctx.content, target).includes(statusId)) return 'Immune';
  if (buffImmune(target, statusId, ctx.content.statuses[statusId]?.kind)) return 'Immune'; // U26b: Unbroken, Oathbound
  if (statusId === STATUS.stun && (cooldownsOf(combat, target)[STUN_RECOVERY_KEY] ?? 0) > 0) return 'Immune (recovering)';
  return null;
}

/**
 * Puts a status on `target` (DESIGN §4.5): see the file header for the order of checks. Emits `statusApplied` (with the
 * resulting stacks and duration) when the status is on the target afterwards; a Stun also cancels the target's stored
 * intent (DESIGN §4.2; the pattern pointer is the intent unit's) and ends the Taunts the target is the source of.
 */
export function applyStatus(ctx: StepCtx, combat: CombatState, source: Combatant | null, target: Combatant, statusId: string, opts: StatusApplyOptions = {}): ApplyResult {
  const def = statusDef(ctx.content, statusId);
  if (statusId === STATUS.rested) throw new Error('status: status_rested is granted by an inn rest, never in a fight (DESIGN §4.5)');
  const result = (outcome: ApplyOutcome): ApplyResult => ({ statusId, targetUid: target.uid, outcome });
  if (!isActive(target)) return result('ignored');
  const immune = immunityOf(ctx, combat, target, statusId);
  if (immune !== null) {
    note(combat, `${target.name}: ${immune} to ${def.name}.`);
    return result('immune');
  }
  // interplay at application (rows 5 and 6)
  if (statusId === STATUS.burn && has(target, STATUS.soaked)) {
    interplay(ctx, 'soaked_on_burn', target);
    note(combat, `${def.name} hisses out on the soaked ${target.name}.`);
    return result('blocked');
  }
  if (statusId === STATUS.soaked && has(target, STATUS.burn)) {
    interplay(ctx, 'soaked_on_burn', target);
    removeStatus(ctx, combat, target, STATUS.burn, `The water puts out ${target.name}'s Burn.`);
  }
  const opposite = statusId === STATUS.slow ? STATUS.haste : statusId === STATUS.haste ? STATUS.slow : null;
  if (opposite !== null && has(target, opposite)) {
    interplay(ctx, 'slow_haste_cancel', target);
    removeStatus(ctx, combat, target, opposite, `${def.name} and ${nameOf(ctx.content, opposite)} cancel out on ${target.name}.`);
    return result('cancelled');
  }

  const ownTurn = isOwnTurn(combat, target);
  const duration = Math.max(1, opts.duration ?? def.defaultDuration);
  const magnitude = magnitudeOf(def, source, target, opts);
  const existing = findStatus(target, statusId);
  let inst: StatusInstance;
  let outcome: ApplyOutcome;
  if (existing) {
    if (statusId === STATUS.rewind) {
      note(combat, `${target.name} already holds a Rewind.`);
      return result('kept');
    }
    inst = existing;
    outcome = def.stackable ? 'stacked' : 'refreshed';
    if (def.stackable) existing.stacks = Math.min(def.maxStacks, existing.stacks + (opts.stacks ?? 1));
    existing.duration = duration;
    existing.appliedOnOwnTurn = ownTurn;
    if (magnitude === undefined) existing.sourceUid = source?.uid ?? existing.sourceUid;
    else if (existing.tick === undefined || magnitude > existing.tick) {
      existing.tick = magnitude; // the stronger tick (Shield: the higher pool) wins
      existing.sourceUid = source?.uid ?? null;
    }
  } else {
    inst = { statusId, stacks: def.stackable ? Math.min(def.maxStacks, Math.max(1, opts.stacks ?? 1)) : 1, duration, sourceUid: source?.uid ?? null, appliedOnOwnTurn: ownTurn };
    if (magnitude !== undefined) inst.tick = magnitude;
    if (statusId === STATUS.rewind) inst.snapshotHp = target.hp;
    target.statuses.push(inst);
    outcome = 'applied';
  }
  ctx.emit({ t: 'statusApplied', targetUid: target.uid, statusId, stacks: inst.stacks, duration: inst.duration, ...(opts.source === undefined ? {} : { source: opts.source }) });
  const stacks = def.stackable ? ` ×${inst.stacks}` : '';
  const amount = inst.tick === undefined ? '' : `, ${inst.tick}`;
  note(combat, `${target.name}: ${def.name}${stacks} (${inst.duration}${amount}).`);
  if (statusId === STATUS.stun) {
    delete combat.intents[target.uid];
    endTaunts(ctx, combat, target);
  }
  return result(outcome);
}

/** Evaluates a row's `when` for one recipient (the intent and ability units own the CombatWhen language). */
export type WhenEval = (when: CombatWhen, recipient: Combatant) => boolean;

/** The combatants a row's `target` names, from the source's side (DESIGN §4.8: an ally row defaults to the companion, else self). */
function recipients(combat: CombatState, source: Combatant, target: Combatant | null, rule: StatusApply['target']): Combatant[] {
  switch (rule) {
    case 'target':
      return target ? [target] : [];
    case 'self':
      return [source];
    case 'all_enemies':
      return opponentsOf(combat, source).filter(isActive);
    case 'all_allies':
      return sideOf(combat, source).filter(isActive);
    case 'ally':
      return [sideOf(combat, source).find((c) => c !== source && isActive(c)) ?? source];
  }
}

/**
 * A move's or an ability's status rows (content `StatusApply`), in listed order: per recipient, `when` (through
 * `evalWhen`; a row with `when` and no evaluator is a caller bug), then one `rng.int(0, 99) < chance%` roll (none when
 * certain), then `applyStatus` with the row's duration, stacks and power.
 */
export function applyStatusRows(
  ctx: StepCtx,
  combat: CombatState,
  source: Combatant,
  target: Combatant | null,
  rows: readonly StatusApply[],
  evalWhen?: WhenEval,
): ApplyResult[] {
  const out: ApplyResult[] = [];
  for (const row of rows) {
    for (const r of recipients(combat, source, target, row.target)) {
      if (row.when !== undefined) {
        if (!evalWhen) throw new Error(`applyStatusRows: '${row.status}' has a \`when\` but no evaluator was given`);
        if (!evalWhen(row.when, r)) continue;
      }
      if (!rollPct(ctx.rng, Math.round(row.chance * 100))) {
        out.push({ statusId: row.status, targetUid: r.uid, outcome: 'failed' });
        continue;
      }
      const opts: StatusApplyOptions = { duration: row.duration, stacks: row.stacks };
      if (row.power) opts.power = row.power;
      out.push(applyStatus(ctx, combat, source, r, row.status, opts));
    }
  }
  return out;
}

// ---- the turn ---------------------------------------------------------------------------------------------------------------

export interface TurnStartResult {
  /** The DoT whose tick brought the holder to 0 HP (it does not act), else null. */
  killedBy: string | null;
  /** Every tick dealt, in order (`statusTicked` amounts; Regen's is its heal). */
  ticks: { statusId: string; amount: number }[];
}

/** Run counters for status damage: the party's damage by `status:<id>`, the player's damage taken. */
function countStatusDamage(ctx: StepCtx, combat: CombatState, sourceUid: string | null, target: Combatant, statusId: string, amount: number): void {
  const { counters } = ctx.s;
  if (target.kind === 'player') counters.damageTaken += amount;
  if (target.kind === 'enemy' && combat.party.some((p) => p.uid === sourceUid)) {
    counters.damageDealt += amount;
    const key = `status:${statusId}`;
    counters.damageBySource[key] = (counters.damageBySource[key] ?? 0) + amount;
  }
}

/**
 * DESIGN §4.1 (1), the start of `actor`'s turn: DoTs in DOT_ORDER (each `dotDamage`; the first that brings it to 0 HP
 * stops the rest), then Regen (its heal × 0.5 while Poisoned (row 8) × the healing modifiers (Curse), clamped to missing
 * HP; then 1 Bleed stack off (row 7)), then Rewind when its countdown has reached 0 (HP = max(current, snapshot), a
 * boss's restore capped at 10 % of max HP; Bleed/Burn/Poison cleansed). The caller knocks out a holder left at 0 HP.
 */
export function startOfTurnStatuses(ctx: StepCtx, combat: CombatState, actor: Combatant): TurnStartResult {
  const { content } = ctx;
  const out: TurnStartResult = { killedBy: null, ticks: [] };
  if (buffTurnStart(ctx, combat, actor)) return out; // U26b: a bonus action's start is not a turn
  for (const id of DOT_ORDER) {
    const st = findStatus(actor, id);
    const glass = modifierDamageMult(ctx.s.meta.modifiers, content, actor.kind !== 'enemy'); // Glass ×2 both ways (U31)
    const tick = st ? dotDamage(actor, st, content.statuses[id], glass) : null;
    if (!st || !tick) continue;
    const source = st.sourceUid === null ? undefined : combatantByUid(combat, st.sourceUid);
    for (let n = source && dotsTwice(source) ? 2 : 1; n > 0; n--) { // U26b: Apex Predator's DoTs tick twice
      actor.hp = Math.max(0, actor.hp - tick.amount);
      countStatusDamage(ctx, combat, st.sourceUid, actor, id, tick.amount);
      ctx.emit({ t: 'statusTicked', targetUid: actor.uid, statusId: id, amount: tick.amount });
      note(combat, tick.immune ? `${actor.name}: Immune to ${nameOf(content, id)}.` : `${nameOf(content, id)} deals ${tick.amount} to ${actor.name}.`, 'damage');
      out.ticks.push({ statusId: id, amount: tick.amount });
      tetherHeal(ctx, combat, actor, tick.amount); // U26b: Soul Tether
      if (actor.hp <= 0) {
        out.killedBy = id;
        return out;
      }
    }
  }

  const regen = findStatus(actor, STATUS.regen);
  if (regen) {
    const poisoned = has(actor, STATUS.poison);
    let x = (regen.tick ?? 0) * (poisoned ? REGEN_POISONED_MULT : 1);
    for (const pct of statusMods(actor, content).healing) x *= 1 + pct;
    const amount = Math.min(Math.max(0, roundHalfUp(x)), Math.max(0, actor.hpMax - actor.hp));
    actor.hp += amount;
    if (poisoned) interplay(ctx, 'poison_on_regen', actor);
    ctx.emit({ t: 'statusTicked', targetUid: actor.uid, statusId: STATUS.regen, amount });
    if (amount > 0) ctx.emit({ t: 'healed', targetUid: actor.uid, amount, source: STATUS.regen });
    note(combat, `Regen restores ${amount} to ${actor.name}.`, 'heal');
    out.ticks.push({ statusId: STATUS.regen, amount });
    const bleed = findStatus(actor, STATUS.bleed);
    if (bleed) {
      interplay(ctx, 'regen_on_bleed', actor);
      bleed.stacks -= 1;
      if (bleed.stacks <= 0) removeStatus(ctx, combat, actor, STATUS.bleed, `${actor.name}'s wounds close.`);
      else ctx.emit({ t: 'statusApplied', targetUid: actor.uid, statusId: STATUS.bleed, stacks: bleed.stacks, duration: bleed.duration });
    }
  }

  const rewind = findStatus(actor, STATUS.rewind);
  if (rewind && rewind.duration <= 0) {
    let restore = Math.max(0, (rewind.snapshotHp ?? actor.hp) - actor.hp);
    if (isBoss(content, actor)) restore = Math.min(restore, roundHalfUp(BOSS_REWIND_CAP * actor.hpMax));
    restore = Math.min(restore, actor.hpMax - actor.hp);
    actor.hp += restore;
    if (restore > 0) ctx.emit({ t: 'healed', targetUid: actor.uid, amount: restore, source: STATUS.rewind });
    note(combat, `Time runs backward for ${actor.name} (+${restore} HP).`, 'heal');
    for (const id of REWIND_CLEANSES) removeStatus(ctx, combat, actor, id);
    removeStatus(ctx, combat, actor, STATUS.rewind);
  }
  return out;
}

/**
 * DESIGN §4.1 (3), the end of `actor`'s turn: every status on it counts down one — except one applied during this
 * turn, which only loses that mark (D-066 #4) — and those at 0 expire, except Rewind (it fires at the start of the next
 * turn). A Stun that wears off opens the recovery window. Call it after the turn's ability cooldowns count down, so the
 * window covers the holder's next 2 turns.
 */
export function endOfTurnStatuses(ctx: StepCtx, combat: CombatState, actor: Combatant): void {
  if (buffTurnEnd(ctx, combat, actor)) return; // U26b: the turn that granted a bonus action goes on; else buff timers
  for (const st of actor.statuses) {
    if (st.appliedOnOwnTurn) st.appliedOnOwnTurn = false;
    else st.duration = Math.max(0, st.duration - 1);
  }
  const expired = actor.statuses.filter((st) => st.duration <= 0 && st.statusId !== STATUS.rewind);
  for (const st of expired) {
    removeStatus(ctx, combat, actor, st.statusId, `${nameOf(ctx.content, st.statusId)} wears off ${actor.name}.`);
    if (st.statusId === STATUS.stun) cooldownsOf(combat, actor)[STUN_RECOVERY_KEY] = STUN_RECOVERY_TURNS;
  }
}

// ---- after a hit ------------------------------------------------------------------------------------------------------------

/** A Phase that made a blow miss is consumed; a Mark on the same holder goes with it (DESIGN §4.5 Mark "Cleansed by"). */
function consumePhase(ctx: StepCtx, combat: CombatState, target: Combatant): void {
  removeStatus(ctx, combat, target, STATUS.phase, `The blow passes through ${target.name}; its Phase is spent.`);
  removeStatus(ctx, combat, target, STATUS.mark, `${target.name} slips its Mark.`);
}

/** Interplay 16: Immolate burns the rest of the Burn at once (3 × tick × turns left), Fire's resistance step only. */
function immolate(ctx: StepCtx, combat: CombatState, attacker: Combatant, target: Combatant): void {
  const burn = findStatus(target, STATUS.burn);
  if (!burn) return;
  const def = ctx.content.statuses[STATUS.burn];
  const per = burn.tick ?? def?.tick?.damage?.base ?? 0;
  const r = resolveTick(target, IMMOLATE_MULT * per * Math.max(0, burn.duration), 'fire');
  interplay(ctx, 'immolate_on_burn', target);
  removeStatus(ctx, combat, target, STATUS.burn, `${target.name}'s Burn flares all at once.`);
  target.hp = Math.max(0, target.hp - r.amount);
  ctx.emit({ t: 'damageDealt', sourceUid: attacker.uid, targetUid: target.uid, amount: r.amount, damageType: 'fire', mitigated: 0, absorbed: 0, kind: 'status', refId: STATUS.burn });
  countStatusDamage(ctx, combat, attacker.uid, target, STATUS.burn, r.amount);
  note(combat, `Immolate: ${r.amount} to ${target.name}.`, 'damage');
}

/**
 * What a resolved hit does to statuses (call after its HP and Shield changes, before a knock-out): a Phased miss
 * consumes the Phase; a hit that connected (not immune) runs the interplay rows below against the statuses the target
 * had when it was struck. Draws nothing.
 *   4  the Shield gone (Void broke it, or absorption emptied it) → `statusExpired`
 *   10 Chrono through Phase (the event only; damage.ts let it hit)
 *   1  Storm on Soaked → Shock (2) on every other living combatant of the target's side
 *   2  Fire on Soaked → Soaked removed      3  Chrono on Haste → Haste removed
 *   9  Void or Ley on Rewind → Rewind consumed   13 Ley on Curse → Curse removed   14 Void on Regen → Regen removed
 *   12 Storm crit on Shocked → Stun (1)     15 Physical crit on Bleeding → +1 stack (max 3)
 *   16 `wiz_immolate` on Burning → the rest of the Burn at once
 */
export function afterHit(ctx: StepCtx, combat: CombatState, attacker: Combatant, target: Combatant, spec: HitSpec, result: HitResult): void {
  afterHitBuffs(ctx, combat, attacker, target, spec, result); // U26b: held crit, dodge MP, Leech Veil, Soul Tether
  if (!result.hit) {
    if (result.phased) consumePhase(ctx, combat, target);
    return;
  }
  if (result.immune) return;
  const had = new Set(target.statuses.map((st) => st.statusId));
  const type = spec.type;
  if (result.shieldBroken || (result.absorbed > 0 && !had.has(STATUS.shield))) {
    if (result.shieldBroken) interplay(ctx, 'void_on_shield', target);
    ctx.emit({ t: 'statusExpired', targetUid: target.uid, statusId: STATUS.shield });
    note(combat, result.shieldBroken ? `Void tears ${target.name}'s Shield apart.` : `${target.name}'s Shield breaks.`);
  }
  if (type === 'chrono' && had.has(STATUS.phase) && !spec.aoe) interplay(ctx, 'chrono_ignores_phase', target);
  if (type === 'storm' && had.has(STATUS.soaked)) {
    interplay(ctx, 'storm_on_soaked', target);
    for (const other of sideOf(combat, target).filter((c) => c !== target && isActive(c))) {
      applyStatus(ctx, combat, attacker, other, STATUS.shock, { duration: SHOCK_SPREAD_TURNS });
    }
  }
  if (type === 'fire' && had.has(STATUS.soaked)) {
    interplay(ctx, 'fire_on_soaked', target);
    removeStatus(ctx, combat, target, STATUS.soaked, `The fire boils ${target.name} dry.`);
  }
  if (type === 'chrono' && had.has(STATUS.haste)) {
    interplay(ctx, 'chrono_on_haste', target);
    removeStatus(ctx, combat, target, STATUS.haste, `${target.name}'s Haste is torn away.`);
  }
  if ((type === 'void' || type === 'ley') && had.has(STATUS.rewind)) {
    interplay(ctx, 'rewind_consumed', target);
    removeStatus(ctx, combat, target, STATUS.rewind, `${target.name}'s Rewind unravels.`);
  }
  if (type === 'storm' && result.crit && had.has(STATUS.shock)) {
    if (applyStatus(ctx, combat, attacker, target, STATUS.stun, { duration: SHOCK_STUN_TURNS }).outcome !== 'immune') interplay(ctx, 'storm_crit_on_shock', target);
  }
  if (type === 'ley' && had.has(STATUS.curse)) {
    interplay(ctx, 'ley_on_curse', target);
    removeStatus(ctx, combat, target, STATUS.curse, `The clean current lifts ${target.name}'s Curse.`);
  }
  if (type === 'void' && had.has(STATUS.regen)) {
    interplay(ctx, 'void_on_regen', target);
    removeStatus(ctx, combat, target, STATUS.regen, `Void smothers ${target.name}'s Regen.`);
  }
  const bleed = findStatus(target, STATUS.bleed);
  const maxBleed = ctx.content.statuses[STATUS.bleed]?.maxStacks ?? 1;
  if (type === 'physical' && result.crit && bleed && bleed.stacks < maxBleed) {
    interplay(ctx, 'physical_crit_on_bleed', target);
    bleed.stacks += 1;
    ctx.emit({ t: 'statusApplied', targetUid: target.uid, statusId: STATUS.bleed, stacks: bleed.stacks, duration: bleed.duration });
    note(combat, `The wound tears wider: ${target.name} Bleed ×${bleed.stacks}.`);
  }
  if (type === 'fire' && spec.source === IMMOLATE_ABILITY && had.has(STATUS.burn)) immolate(ctx, combat, attacker, target);
}
