// The damage pipeline (DESIGN §4.3, §4.4; PLAN §4.10). One function per kind of number:
//   resolveHit   — a damaging hit: hit roll, then DESIGN §4.3's eleven steps in order, in floating point, one rounding
//                  at the end; every intermediate value is recorded in `steps` for the expandable combat log (§16.5).
//   damageRange  — the same pipeline at the variance bounds without crit or rng (intent chips, the Guard preview).
//   resolveTick  — a DoT tick: the resistance step only (no variance, crit, armor, ward or Guard; Poison untyped).
//   resolveHeal  — DESIGN §4.3's healing pipeline.
//
// Rolls (PLAN §4.10). A percentage is one `rng.int(0, 99) < chance` draw; a certain or impossible chance draws nothing
// (like `Rng.chance`). Variance is one `rng.next()` mapped linearly onto [0.90, 1.10). The draw order per hit is fixed:
//   hit (unless certain: Mark, `cannotMiss`, hit% 100) → variance → crit (unless guaranteed or impossible)
// and status chances follow in their listed order (U24). A miss draws nothing after the hit roll. An immune target
// still costs the variance and crit draws, so a replay never depends on resistances.
//
// Nothing here mutates: callers apply a HitResult (reducers/combat.ts `applyHit`, `consumeShield`).
import type { ContentPack } from '../ctx';
import { derive, hitChance } from '../derived';
import type { Rng } from '../rng';
import type { Combatant, DamageType, GameState, Resistance } from '../types/state';
import { clamp, round } from '../util/math';

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

/** Binary fractions (6.3 × 0.9 − 1 = 4.669999…) must not lose a half on the way to "round half-up". */
const ROUND_EPSILON = 1e-9;
const roundHalfUp = (x: number): number => round(x + (x >= 0 ? ROUND_EPSILON : -ROUND_EPSILON));

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
  /** Step-7 multipliers the caller evaluated (ability bonuses such as ×1.25 vs Marked, Collapse's missing-HP bonus). */
  mults?: readonly { name: string; mult: number }[];
}

export interface PipelineStep {
  name: string;
  value: number;
}

export interface HitResult {
  hit: boolean;
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

/** The Guard fraction protecting `target`: the player's gear may raise it (affix_of_the_warden); else config (0.5). */
export function guardValueOf(r: PipelineRead, target: Combatant): number {
  return target.kind === 'player' ? derive(r.s.player, r.content).guardValue : r.content.config.guardValue;
}

/**
 * DESIGN §4.3 step 6 — interplay multipliers (§4.6). TODO(U24): the interplay table (Storm on Soaked ×1.5, Fire on
 * Soaked ×0.5, Void on Rewind ×1.25, Ley on Cursed ×1.25 …). Returns the multipliers to apply, in order.
 */
export function interplayMults(_r: PipelineRead, _attacker: Combatant, _target: Combatant, _spec: HitSpec): PipelineStep[] {
  return [];
}

/** DESIGN §4.3 step 7 — every percentage modifier, multiplicatively, in a fixed order. */
function statusStepMults(r: PipelineRead, attacker: Combatant, target: Combatant, spec: HitSpec): PipelineStep[] {
  const out: PipelineStep[] = [];
  for (const pct of statusMods(attacker, r.content).outgoing) out.push({ name: 'attacker status', value: 1 + pct });
  if (attacker.kind === 'player') {
    // gear `damageBonus` and Corruption (+5 % Void / −3 % Ley per point, DESIGN §6.7), from derive()
    const pct = derive(r.s.player, r.content).damagePct[spec.type] ?? 0;
    if (pct !== 0) out.push({ name: 'gear', value: 1 + pct });
  }
  for (const pct of statusMods(target, r.content).incoming) out.push({ name: 'target status', value: 1 + pct });
  if (spec.type === 'physical' && hasStatus(target, STATUS_ARMOR_BREAK)) out.push({ name: 'armor break', value: ARMOR_BREAK_PHYSICAL_MULT });
  for (const m of spec.mults ?? []) out.push({ name: m.name, value: m.mult });
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

/** DESIGN §3.2 hit% for this hit (live status accuracy/evasion; Mark and `cannotMiss` make it 100). */
export function hitChanceOf(content: ContentPack, attacker: Combatant, target: Combatant, spec: HitSpec): number {
  const { config } = content;
  if (spec.cannotMiss || hasStatus(target, STATUS_MARK)) return 100;
  const accuracy = attacker.accuracy + statusMods(attacker, content).accuracy + (spec.spell ? config.spellAccuracyBonus : 0) + (spec.accuracy ?? 0);
  const evasion = target.evasion + statusMods(target, content).evasion;
  return hitChance(accuracy, evasion, config);
}

/** DESIGN §3.2 crit% for this hit (capped at `config.critCap`). */
export function critChanceOf(content: ContentPack, attacker: Combatant, spec: HitSpec): number {
  if (spec.guaranteedCrit) return 100;
  return clamp(attacker.crit + statusMods(attacker, content).crit + (spec.critBonus ?? 0), 0, content.config.critCap);
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
  if (rolled.crit) x *= attacker.critMult;
  push('crit', x);
  // 5 resistance / weakness (immune short-circuits to 0)
  const resistance = target.resistances[spec.type] ?? 'neutral';
  x *= RESIST_MULT[resistance];
  push('resistance', x);
  if (resistance === 'immune') {
    push('final', 0);
    return { immune: true, amount: 0, absorbed: 0, shieldBroken: false, mitigated: 0, steps };
  }
  // 6 interplay (U24), 7 status / percentage modifiers
  for (const m of interplayMults(r, attacker, target, spec)) x *= m.value;
  push('interplay', x);
  for (const m of statusStepMults(r, attacker, target, spec)) x *= m.value;
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
  const pool = shield?.tick ?? 0; // TODO(U24): where the Shield pool lives; `tick` holds it until then
  let absorbed = 0;
  let shieldBroken = false;
  if (shield && spec.type === 'void') shieldBroken = true;
  else if (pool > 0 && x > 0) absorbed = x >= pool ? pool : Math.min(pool, Math.max(1, roundHalfUp(x)));
  x -= absorbed;
  push('shield', x);
  // 11 clamp & round: half-up, min 1 for a connecting non-immune hit (0 when the Shield took all of it), max hpMax
  const amount = absorbed > 0 && x <= 0 ? 0 : Math.min(target.hpMax, Math.max(1, roundHalfUp(x)));
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
    return { hit: false, crit: false, immune: false, hitChance: hitPct, critChance: critPct, variance: null, amount: 0, absorbed: 0, shieldBroken: false, mitigated: 0, steps: [hitStep] };
  }
  const variance = drawVariance(ctx.rng);
  const crit = rollPct(ctx.rng, critPct);
  const c = compute(ctx, attacker, target, spec, { variance, crit, guard: target.guarding });
  return { hit: true, crit, immune: c.immune, hitChance: hitPct, critChance: critPct, variance, amount: c.amount, absorbed: c.absorbed, shieldBroken: c.shieldBroken, mitigated: c.mitigated, steps: [hitStep, ...c.steps] };
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
 * 1 unless immune, at most max HP. No variance, crit, armor, ward or Guard. Untyped ticks (Poison) ignore resistance.
 */
export function resolveTick(target: Pick<Combatant, 'resistances' | 'hpMax'>, amount: number, type?: DamageType): TickResult {
  const steps: PipelineStep[] = [{ name: 'tick', value: amount }];
  const mult = type === undefined ? 1 : RESIST_MULT[target.resistances[type] ?? 'neutral'];
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
  for (const pct of statusMods(target, ctx.content).healing) x *= 1 + pct;
  steps.push({ name: 'status', value: x });
  const rounded = Math.max(0, roundHalfUp(x));
  const missing = Math.max(0, target.hpMax - target.hp);
  const amount = Math.min(rounded, missing);
  steps.push({ name: 'final', value: amount });
  return { amount, overheal: rounded - amount, variance, steps };
}
