// The damage pipeline (DESIGN §4.3, §4.4; PLAN §4.10). One function per kind of number:
//   resolveHit   — a damaging hit: hit roll, then DESIGN §4.3's eleven steps in order, in floating point, one rounding
//                  at the end; every intermediate value is recorded in `steps` for the expandable combat log (§16.5).
//   damageRange  — the same pipeline at the variance bounds without crit or rng (intent chips, the Guard preview).
//   resolveTick  — a DoT tick: the resistance step only (no variance, crit, armor, ward or Guard; Poison untyped).
//   resolveHeal  — DESIGN §4.3's healing pipeline.
//
// Rolls (PLAN §4.10). A percentage is one `rng.int(0, 99) < chance` draw; a certain or impossible chance draws nothing
// (like `Rng.chance`). Variance is one `rng.next()` mapped linearly onto [0.90, 1.10). The draw order per hit is fixed:
//   hit (unless certain: Mark, `cannotMiss`, hit% 100; or impossible: Phase) → variance → crit (unless guaranteed or
//   impossible)
// and status chances follow in their listed order (combat/statuses.ts `applyStatusRows`). A miss draws nothing after
// the hit roll. An immune target still costs the variance and crit draws, so a replay never depends on resistances.
//
// Status rules that change a number live here (U24, DESIGN §4.5–4.6): Phase evades a single-target non-Chrono attack
// (hit% 0, interplay 10); Void treats `resist` as neutral against a Cursed target (D-067.18, hits and ticks); step 6
// is the interplay table's multipliers (rows 1, 2, 9, 13); step 7 adds Shock's +25 % Storm and a boss phase's damage
// taken / per-round ramp (U27, `phaseMults`), a Trusted companion's +10 % (U28; its heals too), and the player's gear
// `damage_vs_status` on its direct hits (U34b, `gearStatusMults`; the rest of the gear hooks: gear.ts). The Shield pool is the
// Shield instance's `StatusInstance.tick` (the status's stored magnitude, like a DoT's tick or Regen's heal).
// What a status rule *does* to statuses (removals, spreads, stacks) is combat/statuses.ts `afterHit`.
//
// Nothing here mutates: callers apply a HitResult (reducers/combat.ts `applyHit`, `consumeShield`).
import type { Phase } from '@schema/creature';
import type { Status } from '@schema/status';
import type { ContentPack } from '../ctx';
import { GEAR_SCRIPT, derive, gearPassives, hitChance, isGearSource } from '../derived';
import type { Rng } from '../rng';
import type { Combatant, DamageType, GameState, Resistance, StatusInstance } from '../types/state';
import { clamp, round } from '../util/math';
import { COUNTER_PREFIX, buffedResistance, critBonusOf, critMultOf, dealtMultOf, evasionBonusOf, hitCapOf, holdsNextCrit, takenMultOf } from './buffs';

/** DESIGN §4.4: the four resistance steps. */
export const RESIST_MULT: Readonly<Record<Resistance, number>> = { weak: 1.5, neutral: 1, resist: 0.5, immune: 0 };
/** DESIGN §4.3 step 3: × U(0.90, 1.10). */
export const VARIANCE_MIN = 0.9;
export const VARIANCE_MAX = 1.1;
/** DESIGN §4.3 step 7 / §4.5: Armor Break takes +15 % Physical. */
export const ARMOR_BREAK_PHYSICAL_MULT = 1.15;

export const STATUS_MARK = 'status_mark';
export const STATUS_ARMOR_BREAK = 'status_armor_break';
export const STATUS_SHIELD = 'status_shield';
export const STATUS_SOAKED = 'status_soaked';
export const STATUS_SHOCK = 'status_shock';
export const STATUS_CURSE = 'status_curse';
export const STATUS_REWIND = 'status_rewind';
export const STATUS_PHASE = 'status_phase';

/** DESIGN §4.6 step-6 multipliers: rows 1 (Storm on Soaked), 2 (Fire on Soaked), 9 (Void on Rewind), 13 (Ley on Curse). */
export const INTERPLAY_MULT = { stormOnSoaked: 1.5, fireOnSoaked: 0.5, voidOnRewind: 1.25, leyOnCurse: 1.25 } as const;
/** DESIGN §4.5: a Shocked target takes +25 % Storm (step 7). */
export const SHOCK_STORM_MULT = 1.25;

/** Binary fractions (6.3 × 0.9 − 1 = 4.669999…) must not lose a half on the way to "round half-up". */
const ROUND_EPSILON = 1e-9;
/** Round half-up, robust to binary fractions (the pipeline's one rounding; status magnitudes at application). */
export const roundHalfUp = (x: number): number => round(x + (x >= 0 ? ROUND_EPSILON : -ROUND_EPSILON));

/** What the pipeline reads: the state (run modifiers, the player's gear), the pack, and — for resolveHit — the Rng. */
export interface PipelineCtx {
  readonly s: GameState;
  readonly content: ContentPack;
  readonly rng: Rng;
}
export type PipelineRead = Omit<PipelineCtx, 'rng'>;

export type ScaleStat = 'atk' | 'sp';

/** One damaging hit's definition: a basic attack (§5.7), an ability row (§5), or a creature move. */
export interface HitSpec {
  /** 'basic', an ability id or a move id (logs, damageBySource). */
  source: string;
  type: DamageType;
  /** Step 1 (0 for basic melee). */
  base: number;
  /** Step 2: `coef · stat`. */
  coef: number;
  stat: ScaleStat;
  /** `itm_echo_bolt`: the larger of `base + coef·stat` and this (D-067.19). */
  maxOf?: { base: number; coef: number; stat: ScaleStat };
  /** +`config.spellAccuracyBonus` (DESIGN §3.2). */
  spell?: boolean;
  /** Flat accuracy (bow +5, heavy −5; DESIGN §5.7). */
  accuracy?: number;
  /** Flat crit chance (bow +5). */
  critBonus?: number;
  ignoresArmor?: boolean;
  guaranteedCrit?: boolean;
  cannotMiss?: boolean;
  /** An area hit ('all'): Phase does not evade it (DESIGN §4.2). Default: single-target. */
  aoe?: boolean;
  /** Step-7 multipliers the caller evaluated (ability bonuses such as ×1.25 vs Marked, Collapse's missing-HP bonus). */
  mults?: readonly { name: string; mult: number }[];
}

export interface PipelineStep {
  name: string;
  value: number;
}

export interface HitResult {
  hit: boolean;
  /** The miss was the target's Phase (the caller consumes it, statuses.ts `afterHit`). */
  phased: boolean;
  crit: boolean;
  /** The resistance step was `immune` (the chip prints "Immune"). */
  immune: boolean;
  hitChance: number;
  critChance: number;
  /** The drawn variance; null on a miss. */
  variance: number | null;
  /** HP the target loses (step 11). */
  amount: number;
  /** Taken by the target's Shield pool (step 10). */
  absorbed: number;
  /** Void destroyed the target's Shield before step 10 (interplay row 4). */
  shieldBroken: boolean;
  /** Removed by flat reduction and Guard (steps 8–9), rounded. */
  mitigated: number;
  steps: PipelineStep[];
}

// ---- status and run modifiers ---------------------------------------------------------------------------------------

/** Sums of the content `modifiers` of a combatant's statuses (DESIGN §4.5); percentages listed per instance. */
export interface StatusMods {
  accuracy: number;
  evasion: number;
  crit: number;
  initiative: number;
  /** Outgoing damage fractions (Weaken −0.25), one per status. */
  outgoing: number[];
  /** Incoming damage fractions (Mark +0.15), one per status. */
  incoming: number[];
  /** Healing received fractions (Curse −0.5). */
  healing: number[];
  armorWardZero: boolean;
}

export function statusMods(c: Pick<Combatant, 'statuses'>, content: ContentPack): StatusMods {
  const out: StatusMods = { accuracy: 0, evasion: 0, crit: 0, initiative: 0, outgoing: [], incoming: [], healing: [], armorWardZero: false };
  for (const st of c.statuses) {
    const m = content.statuses[st.statusId]?.modifiers;
    if (!m) continue;
    out.accuracy += m.accuracyFlat;
    out.evasion += m.evasionFlat;
    out.crit += m.critFlat;
    out.initiative += m.initiativeFlat;
    if (m.outgoingPct !== 0) out.outgoing.push(m.outgoingPct);
    if (m.incomingPct !== 0) out.incoming.push(m.incomingPct);
    if (m.healingPct !== 0) out.healing.push(m.healingPct);
    out.armorWardZero ||= m.armorWardZero;
  }
  return out;
}

export const hasStatus = (c: Pick<Combatant, 'statuses'>, statusId: string): boolean => c.statuses.some((st) => st.statusId === statusId);

const isParty = (c: Pick<Combatant, 'kind'>): boolean => c.kind !== 'enemy';

/** Challenge modifiers' `damage_multiplier` rules (Glass ×2 both ways, DESIGN §15.1): party outgoing / party incoming. */
function runMultipliers(r: PipelineRead, attacker: Combatant, target: Combatant): PipelineStep[] {
  const out: PipelineStep[] = [];
  for (const id of r.s.meta.modifiers) {
    for (const rule of r.content.modifiers[id]?.rules ?? []) {
      if (rule.kind !== 'damage_multiplier') continue;
      if (isParty(attacker) && rule.outgoing !== 1) out.push({ name: `${id}:outgoing`, value: rule.outgoing });
      if (isParty(target) && rule.incoming !== 1) out.push({ name: `${id}:incoming`, value: rule.incoming });
    }
  }
  return out;
}

/** DESIGN §12.2 / §12.5: a companion at loyalty ≥ 75 is Trusted: +10 % to its damage (step 7) and healing (U28). */
export const TRUSTED_LOYALTY = 75;
export const TRUSTED_MULT = 1.1;
export const isTrusted = (s: GameState, c: Pick<Combatant, 'kind' | 'refId'>): boolean =>
  c.kind === 'companion' && (s.companions.recruited[c.refId]?.loyalty ?? 0) >= TRUSTED_LOYALTY;

/** `guard_value:<percent>` in the player's cooldown table: an ability's stronger Guard this round (Iron Guard 65 %; U26). */
export const GUARD_VALUE_KEY = 'guard_value:';

/**
 * The Guard fraction protecting `target`: the player's gear may raise it (affix_of_the_warden), and so may an ability's
 * Guard this round (GUARD_VALUE_KEY, the best one wins); else config (0.5).
 */
export function guardValueOf(r: PipelineRead, target: Combatant): number {
  if (target.kind !== 'player') return r.content.config.guardValue;
  let value = derive(r.s.player, r.content).guardValue;
  const table = r.s.combat?.cooldowns ?? {};
  for (const key of Object.keys(table)) {
    if (key.startsWith(GUARD_VALUE_KEY) && (table[key] ?? 0) > 0) value = Math.max(value, Number(key.slice(GUARD_VALUE_KEY.length)) / 100);
  }
  return value;
}

/** Who a resistance step or a status rule reads: resistances, and statuses (and buff timers, U26b) when the holder has any. */
export type ResistHolder = Pick<Combatant, 'resistances'> & {
  readonly statuses?: readonly Pick<StatusInstance, 'statusId'>[];
  readonly cooldowns?: Readonly<Record<string, number>>;
};

/**
 * DESIGN §4.4 step 5 for `type` against `target`; D-067.18: Void treats `resist` as neutral against a Cursed target; then
 * the holder's scripted buffs (U26b, combat/buffs.ts: Null Plate's step, Iron Silence's immunity).
 */
export function effectiveResistance(target: ResistHolder, type: DamageType): Resistance {
  const r = target.resistances[type] ?? 'neutral';
  const base = r === 'resist' && type === 'void' && (target.statuses?.some((st) => st.statusId === STATUS_CURSE) ?? false) ? 'neutral' : r;
  return buffedResistance(target, type, base);
}

/** DESIGN §4.2/§4.5: Phase makes the next single-target attack against its holder miss; AoE and Chrono ignore it (row 10). */
export const phaseEvades = (target: Pick<Combatant, 'statuses'>, spec: Pick<HitSpec, 'aoe' | 'type'>): boolean =>
  !spec.aoe && spec.type !== 'chrono' && hasStatus(target, STATUS_PHASE);

/**
 * DESIGN §4.3 step 6 — the interplay table's multipliers (§4.6), in row order: Storm on Soaked ×1.5 (1), Fire on Soaked
 * ×0.5 (2), Void on Rewind ×1.25 (9), Ley on Cursed ×1.25 (13). Rows 17–18 are status definitions (step 7); the rows
 * that change statuses are combat/statuses.ts `afterHit`.
 */
export function interplayMults(_r: PipelineRead, _attacker: Combatant, target: Combatant, spec: HitSpec): PipelineStep[] {
  const out: PipelineStep[] = [];
  if (spec.type === 'storm' && hasStatus(target, STATUS_SOAKED)) out.push({ name: 'storm on soaked', value: INTERPLAY_MULT.stormOnSoaked });
  if (spec.type === 'fire' && hasStatus(target, STATUS_SOAKED)) out.push({ name: 'fire on soaked', value: INTERPLAY_MULT.fireOnSoaked });
  if (spec.type === 'void' && hasStatus(target, STATUS_REWIND)) out.push({ name: 'void on rewind', value: INTERPLAY_MULT.voidOnRewind });
  if (spec.type === 'ley' && hasStatus(target, STATUS_CURSE)) out.push({ name: 'ley on curse', value: INTERPLAY_MULT.leyOnCurse });
  return out;
}

/** A boss's active phase record (DESIGN §4.10; `Combatant.phase`), if it has phases. */
export function activePhaseOf(content: ContentPack, c: Pick<Combatant, 'kind' | 'refId' | 'phase'>): Phase | undefined {
  return c.kind === 'enemy' ? content.creatures[c.refId]?.phases[c.phase] : undefined;
}

/**
 * Step 7, the boss phase rows (U27, combat/phases.ts; D-072): the target's phase `damageTakenMult` (Contained Phase 3
 * ×1.5, D-068.3) and the attacker's phase `damageDealtRampPerRound` (+x per round spent in the phase: the rounds since
 * `pattern.phaseEnteredRound`, so the round of entry adds nothing).
 */
export function phaseMults(r: PipelineRead, attacker: Combatant, target: Combatant): PipelineStep[] {
  const out: PipelineStep[] = [];
  const taken = activePhaseOf(r.content, target)?.damageTakenMult ?? 1;
  if (taken !== 1) out.push({ name: 'phase damage taken', value: taken });
  const ramp = activePhaseOf(r.content, attacker)?.damageDealtRampPerRound ?? 0;
  const rounds = Math.max(0, (r.s.combat?.round ?? 0) - attacker.pattern.phaseEnteredRound);
  if (ramp > 0 && rounds > 0) out.push({ name: 'phase ramp', value: 1 + ramp * rounds });
  return out;
}

/**
 * A direct hit by the player (U34b; combat/gear.ts rule 1): its basic attack or one of its abilities — not a counter,
 * reflect or aura (`counter:` sources), not gear's own damage (`gear:` / `affix:` sources), not a thrown item (an ability
 * a consumable unleashes, D-078).
 */
export function isPlayerDirectHit(content: ContentPack, attacker: Pick<Combatant, 'kind'>, spec: Pick<HitSpec, 'source'>): boolean {
  if (attacker.kind !== 'player' || spec.source.startsWith(COUNTER_PREFIX) || isGearSource(spec.source)) return false;
  const owner = content.abilities[spec.source]?.ownerId;
  return owner === undefined || content.items[owner]?.type !== 'consumable';
}

/**
 * Step 7, the gear's `damage_vs_status` scripts (U34b, DESIGN §7.3 `affix_of_iron`: +10 % vs Armor Broken): on a player
 * direct hit, × (1 + pct) per passive whose status the target holds, named by its source (`affix:<id>`).
 */
export function gearStatusMults(r: PipelineRead, attacker: Combatant, target: Combatant, spec: HitSpec): PipelineStep[] {
  if (!isPlayerDirectHit(r.content, attacker, spec)) return [];
  const out: PipelineStep[] = [];
  for (const { source, passive: p } of gearPassives(r.s.player, r.content)) {
    if (p.kind !== 'custom' || p.scriptId !== GEAR_SCRIPT.damageVsStatus) continue;
    const { status, pct } = p.params;
    if (typeof status === 'string' && typeof pct === 'number' && pct !== 0 && hasStatus(target, status)) out.push({ name: source, value: 1 + pct });
  }
  return out;
}

/** DESIGN §4.3 step 7 — every percentage modifier, multiplicatively, in a fixed order. */
function statusStepMults(r: PipelineRead, attacker: Combatant, target: Combatant, spec: HitSpec): PipelineStep[] {
  const out: PipelineStep[] = [];
  for (const pct of statusMods(attacker, r.content).outgoing) out.push({ name: 'attacker status', value: 1 + pct });
  if (attacker.kind === 'player') {
    // gear `damageBonus` and Corruption (+5 % Void / −3 % Ley per point, DESIGN §6.7), from derive()
    const pct = derive(r.s.player, r.content).damagePct[spec.type] ?? 0;
    if (pct !== 0) out.push({ name: 'gear', value: 1 + pct });
    out.push(...gearStatusMults(r, attacker, target, spec)); // U34b: affix_of_iron
  }
  if (isTrusted(r.s, attacker)) out.push({ name: 'trusted', value: TRUSTED_MULT });
  for (const pct of statusMods(target, r.content).incoming) out.push({ name: 'target status', value: 1 + pct });
  if (spec.type === 'physical' && hasStatus(target, STATUS_ARMOR_BREAK)) out.push({ name: 'armor break', value: ARMOR_BREAK_PHYSICAL_MULT });
  if (spec.type === 'storm' && hasStatus(target, STATUS_SHOCK)) out.push({ name: 'shock', value: SHOCK_STORM_MULT });
  for (const m of spec.mults ?? []) out.push({ name: m.name, value: m.mult });
  out.push(...phaseMults(r, attacker, target));
  out.push(...runMultipliers(r, attacker, target));
  return out;
}

// ---- the pipeline ---------------------------------------------------------------------------------------------------

const statOf = (c: Combatant, stat: ScaleStat): number => (stat === 'atk' ? c.atk : c.sp);

/** Steps 1–2: `base + coef · stat` (or the larger of two scalings). */
export function scaledPower(attacker: Combatant, spec: Pick<HitSpec, 'base' | 'coef' | 'stat' | 'maxOf'>): number {
  const main = spec.base + spec.coef * statOf(attacker, spec.stat);
  if (!spec.maxOf) return main;
  return Math.max(main, spec.maxOf.base + spec.maxOf.coef * statOf(attacker, spec.maxOf.stat));
}

/**
 * DESIGN §3.2 hit% for this hit (live status accuracy/evasion; Mark and `cannotMiss` make it 100). Phase makes it 0
 * first: a Phased target that is also Marked still evades, and the Phase's consumption cleanses the Mark (DESIGN §4.5).
 */
export function hitChanceOf(content: ContentPack, attacker: Combatant, target: Combatant, spec: HitSpec): number {
  const { config } = content;
  if (phaseEvades(target, spec)) return 0;
  if (spec.cannotMiss || hasStatus(target, STATUS_MARK)) return 100;
  const accuracy = attacker.accuracy + statusMods(attacker, content).accuracy + (spec.spell ? config.spellAccuracyBonus : 0) + (spec.accuracy ?? 0);
  const evasion = target.evasion + statusMods(target, content).evasion + evasionBonusOf(target); // + scripted buffs (U26b)
  return hitChance(accuracy, evasion, config);
}

/** DESIGN §3.2 crit% for this hit (capped at `config.critCap`); scripted buffs add theirs (U26b: Hunter's Eye, Shadowstep's held crit). */
export function critChanceOf(content: ContentPack, attacker: Combatant, spec: HitSpec): number {
  if (spec.guaranteedCrit || holdsNextCrit(attacker, spec.source)) return 100;
  return clamp(attacker.crit + statusMods(attacker, content).crit + critBonusOf(attacker) + (spec.critBonus ?? 0), 0, content.config.critCap);
}

/** One percentage roll: `rng.int(0, 99) < pct`; ≥ 100 and ≤ 0 draw nothing. */
export function rollPct(rng: Rng, pct: number): boolean {
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  return rng.int(0, 99) < pct;
}

/** Variance from one draw: U(0.90, 1.10) mapped linearly from `rng.next()`. */
export const drawVariance = (rng: Rng): number => VARIANCE_MIN + (VARIANCE_MAX - VARIANCE_MIN) * rng.next();

interface Rolled {
  variance: number;
  crit: boolean;
  /** Projections skip Guard unless asked (DESIGN §4.2: "not assuming Guard"). */
  guard: boolean;
}

interface Computed {
  immune: boolean;
  amount: number;
  absorbed: number;
  shieldBroken: boolean;
  mitigated: number;
  steps: PipelineStep[];
}

/** Steps 1–11 after the hit roll, given the variance and crit outcome. Pure. */
function compute(r: PipelineRead, attacker: Combatant, target: Combatant, spec: HitSpec, rolled: Rolled): Computed {
  const steps: PipelineStep[] = [];
  const push = (name: string, value: number) => steps.push({ name, value });
  // 1–2 base + stat scaling
  push('base', spec.base);
  let x = scaledPower(attacker, spec);
  push('scaled', x);
  // 3 variance
  x *= rolled.variance;
  push('variance', x);
  // 4 crit
  if (rolled.crit) x *= critMultOf(attacker); // a buff may raise it (U26b: Hunter's Eye ×1.75)
  push('crit', x);
  // 5 resistance / weakness (immune short-circuits to 0; D-067.18 Void vs Cursed)
  const resistance = effectiveResistance(target, spec.type);
  x *= RESIST_MULT[resistance];
  push('resistance', x);
  if (resistance === 'immune') {
    push('final', 0);
    return { immune: true, amount: 0, absorbed: 0, shieldBroken: false, mitigated: 0, steps };
  }
  // 6 interplay, 7 status / percentage modifiers
  for (const m of interplayMults(r, attacker, target, spec)) x *= m.value;
  push('interplay', x);
  for (const m of statusStepMults(r, attacker, target, spec)) x *= m.value;
  x *= dealtMultOf(attacker, spec.type) * takenMultOf(target); // scripted buffs (U26b: Heart of the Grove, Iron Guard)
  push('status', x);
  const beforeMitigation = x;
  // 8 flat reduction (skipped by ignores_armor and Armor Break)
  if (!spec.ignoresArmor && !statusMods(target, r.content).armorWardZero) x -= spec.type === 'physical' ? target.armor : target.ward;
  push('flat', x);
  // 9 Guard
  if (rolled.guard) x *= 1 - guardValueOf(r, target);
  push('guard', x);
  const mitigated = Math.max(0, roundHalfUp(beforeMitigation - x));
  // 10 Shield (Void destroys it first: no absorption)
  const shield = target.statuses.find((st) => st.statusId === STATUS_SHIELD);
  const pool = shield?.tick ?? 0; // the Shield pool is the instance's stored magnitude (U24)
  let absorbed = 0;
  let shieldBroken = false;
  if (shield && spec.type === 'void') shieldBroken = true;
  else if (pool > 0 && x > 0) absorbed = x >= pool ? pool : Math.min(pool, Math.max(1, roundHalfUp(x)));
  x -= absorbed;
  push('shield', x);
  // 11 clamp & round: half-up, min 1 for a connecting non-immune hit (0 when the Shield took all of it), max hpMax
  const amount = absorbed > 0 && x <= 0 ? 0 : Math.min(target.hpMax, hitCapOf(target) ?? target.hpMax, Math.max(1, roundHalfUp(x))); // U26b: Unbroken's cap
  push('final', amount);
  return { immune: false, amount, absorbed, shieldBroken, mitigated, steps };
}

/**
 * Resolves one damaging hit (DESIGN §4.3) with the run's Rng: hit roll, variance, crit, then the eleven steps. Pure
 * apart from the draws; apply the result with the combat reducer.
 */
export function resolveHit(ctx: PipelineCtx, attacker: Combatant, target: Combatant, spec: HitSpec): HitResult {
  const hitPct = hitChanceOf(ctx.content, attacker, target, spec);
  const critPct = critChanceOf(ctx.content, attacker, spec);
  const hitStep: PipelineStep = { name: 'hit%', value: hitPct };
  if (!rollPct(ctx.rng, hitPct)) {
    const phased = phaseEvades(target, spec);
    return { hit: false, phased, crit: false, immune: false, hitChance: hitPct, critChance: critPct, variance: null, amount: 0, absorbed: 0, shieldBroken: false, mitigated: 0, steps: [hitStep] };
  }
  const variance = drawVariance(ctx.rng);
  const crit = rollPct(ctx.rng, critPct);
  const c = compute(ctx, attacker, target, spec, { variance, crit, guard: target.guarding });
  return { hit: true, phased: false, crit, immune: c.immune, hitChance: hitPct, critChance: critPct, variance, amount: c.amount, absorbed: c.absorbed, shieldBroken: c.shieldBroken, mitigated: c.mitigated, steps: [hitStep, ...c.steps] };
}

export interface RangeOptions {
  /** Apply the target's Guard (the Guard button's preview, "14–17 → 7–9"). Default false (DESIGN §4.2). */
  guard?: boolean;
}

/**
 * The projected damage of a hit against the target's current statuses, armor and Shield: the pipeline at variance
 * 0.90 and 1.10, no crit, no rng (DESIGN §4.2 "generation = commitment"). [0, 0] against an immune target.
 */
export function damageRange(r: PipelineRead, attacker: Combatant, target: Combatant, spec: HitSpec, opts: RangeOptions = {}): [number, number] {
  const guard = opts.guard ?? false;
  const lo = compute(r, attacker, target, spec, { variance: VARIANCE_MIN, crit: false, guard });
  const hi = compute(r, attacker, target, spec, { variance: VARIANCE_MAX, crit: false, guard });
  return [lo.amount, hi.amount];
}

/** Takes a HitResult's Shield effects off the target: Void removes the Shield, absorption drains its pool. */
export function consumeShield(target: Combatant, result: Pick<HitResult, 'absorbed' | 'shieldBroken'>): void {
  const i = target.statuses.findIndex((st) => st.statusId === STATUS_SHIELD);
  if (i < 0) return;
  const shield = target.statuses[i];
  if (!shield) return;
  const left = (shield.tick ?? 0) - result.absorbed;
  if (result.shieldBroken || left <= 0) target.statuses.splice(i, 1);
  else shield.tick = left;
}

// ---- ticks and heals ------------------------------------------------------------------------------------------------

export interface TickResult {
  amount: number;
  immune: boolean;
  steps: PipelineStep[];
}

/**
 * A DoT tick (DESIGN §4.5, D-066 #4): the stored amount × the damage type's resistance step, rounded half-up, at least
 * 1 unless immune, at most max HP. No variance, crit, armor, ward, Guard, interplay or Shield (PLAN §8.1 "DoT ticks take
 * resistance only"). Untyped ticks (Poison) ignore resistance. D-067.18 applies (a Curse tick on a void-resistant target).
 */
export function resolveTick(target: ResistHolder & Pick<Combatant, 'hpMax'>, amount: number, type?: DamageType): TickResult {
  const steps: PipelineStep[] = [{ name: 'tick', value: amount }];
  const mult = type === undefined ? 1 : RESIST_MULT[effectiveResistance(target, type)];
  const x = amount * mult;
  steps.push({ name: 'resistance', value: x });
  if (mult === 0) {
    steps.push({ name: 'final', value: 0 });
    return { amount: 0, immune: true, steps };
  }
  const final = amount <= 0 ? 0 : Math.min(target.hpMax, Math.max(1, roundHalfUp(x)));
  steps.push({ name: 'final', value: final });
  return { amount: final, immune: false, steps };
}

/**
 * One DoT instance's tick against its holder — the rule every tick uses, in a fight (statuses.ts) and per watch outside
 * one (turnOrder.ts `tickCarriedWatch`): the stored tick (computed at application; the status's `base` if none) × stacks
 * when it ticks per stack, then `resolveTick` with the status's damage type. Null for a status that deals no damage.
 */
export function dotDamage(
  holder: ResistHolder & Pick<Combatant, 'hpMax'>,
  st: Pick<StatusInstance, 'tick' | 'stacks'>,
  def: Pick<Status, 'tick'> | undefined,
  /** The run's challenge-modifier multiplier on this holder's ticks (Glass ×2, U31: runRules.ts `modifierDamageMult`). */
  mult = 1,
): TickResult | null {
  const dmg = def?.tick?.damage;
  if (!dmg) return null;
  return resolveTick(holder, (st.tick ?? dmg.base) * (dmg.perStack ? st.stacks : 1) * mult, dmg.type);
}

export interface HealSpec {
  base: number;
  coef: number;
  stat: ScaleStat;
}

export interface HealResult {
  /** HP actually restored (clamped to missing HP). */
  amount: number;
  /** What the clamp cut off (abilities that say so turn it into Shield). */
  overheal: number;
  variance: number;
  steps: PipelineStep[];
}

/** DESIGN §4.3 healing: `base + coef·stat` → variance ±10 % (one draw) → healing modifiers (Curse ×0.5) → clamp. */
export function resolveHeal(ctx: PipelineCtx, source: Combatant, target: Combatant, spec: HealSpec): HealResult {
  const steps: PipelineStep[] = [];
  let x = scaledPower(source, spec);
  steps.push({ name: 'scaled', value: x });
  const variance = drawVariance(ctx.rng);
  x *= variance;
  steps.push({ name: 'variance', value: x });
  if (isTrusted(ctx.s, source)) x *= TRUSTED_MULT;
  for (const pct of statusMods(target, ctx.content).healing) x *= 1 + pct;
  steps.push({ name: 'status', value: x });
  const rounded = Math.max(0, roundHalfUp(x));
  const missing = Math.max(0, target.hpMax - target.hp);
  const amount = Math.min(rounded, missing);
  steps.push({ name: 'final', value: amount });
  return { amount, overheal: rounded - amount, variance, steps };
}
