// Boss phases (DESIGN §4.10; PLAN §4.10 "Phases", §8.1 row "boss phases"; D-066 #1/#14, D-068.3, D-069.9, D-072).
//
// A boss — a creature with `phases` — is always in exactly one of them, `Combatant.phase` (an index). The fight opens
// in the first phase whose `skipWhen` (a world Condition) is false: "the fight opens past this phase" (Vell's Umbra,
// the Bell-Warden; WORLD §6), and that opening is a full entry (line, onEnter, adds).
//
// Triggers. After every damage event (reducers/combat.ts: each applied hit, start-of-turn ticks) and at the end of each
// round, `checkPhases` walks every standing boss's later phases in order and enters each one whose `enterWhen` OR-list
// holds (D-066 #14). So one blow that crosses two HP thresholds enters both, in order, firing both onEnters; a phase
// whose triggers never held is passed over for good (phases never go backwards). The atoms:
//   hpBelow         boss HP < fraction × max HP
//   round           the round counter has reached n (DESIGN §4.1 counts rounds, D-066 #1); at the end of round n − 1
//                   the counter goes up, then the check runs, so `round: 12` opens round 12 in that phase
//   event           `addsDead`: at least one add has fought in this fight and none still stands; `communionMovementEnd`:
//                   only when the communion (U29) reports a Movement's end through `phaseEvent`
//   resolveAtLeast  communion Resolve ≥ n
//
// Entering a phase (`enterPhase`): the `bossPhase` event and the transition line in the fight log (the phase's `line`,
// else its name); its `onEnter` effects in order — `surviveRounds` arms the survival win (below), `leaveCombat`
// withdraws the boss, `stripBuffs` strips its foes (or `self` / its allies), `multiHit` / `healOnDamage` are ignored (they
// only mean something on a move), every world effect goes through effects.ts `apply`; then the adds spawn (`count`, or
// `countSolo` when the player has no active companion; at `hpPct` of their max HP; into empty slots, never more than 3
// enemies standing; each with its own intent); then the pattern restarts on the phase's pattern and the intent is reset
// (intents.ts `resetPattern`). At the opening no intent is generated here: the reducer's opening intents follow.
// The phase's `damageTakenMult` (Contained Phase 3 ×1.5, D-068.3) and `damageDealtRampPerRound` are damage-pipeline
// rows (damage.ts `phaseMults`). A phase entered during the boss's own action keeps the intent generated at entry (the
// reducer skips the usual post-turn generation).
//
// Reinforcements (`adds[].reinforce`, the Unveiled Tyrant's reaches, WORLD §6.8): while the boss is in that phase, an add
// of that row that goes down is replaced at once — before the triggers are read, so `addsDead` waits for the last one —
// keeping the row's opening count (at most `maxAlive`) standing, until `total` of that creature have fought here.
// "Once in this phase" (`tyr_remember`, D-066 #1) is data: a step with `oncePerFight` is step-scoped per phase (the
// intents' once-keys carry the phase index), so every phase has its own one.
// Survival (`surviveRounds`, only legal in a boss's first phase, D-069.9; the Unraveling Tide): once that phase was
// entered, ending round n with the party standing wins the fight — no XP, no loot (`survivalRounds`, read by the
// reducer's round end). Entered phases are recorded as `phase:<index>` in the boss's `pattern.firedOnce` (no contract
// change: the once-keys there are `<phase>:<step path>`).
import type { Phase, Trigger } from '@schema/creature';
import { isCombatScope, type Effect, type EffectAtoms, type EffectKey } from '@schema/effect';
import { atomOf, evaluate } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { apply } from '../effects';
import type { Combatant, CombatState } from '../types/state';
import { roundHalfUp } from './damage';
import { generateIntent, resetPattern, withdrawFromCombat } from './intents';
import { STRIP_KINDS } from './specials';
import { removeStatus } from './statuses';
import { MAX_ENEMIES, combatLog, enemyCombatant, isActive, startRound } from './turnOrder';

/** `pattern.firedOnce` marker of an entered phase: `phase:<index>`. */
export const PHASE_ENTERED_KEY = 'phase:';

/** The `event` triggers (DESIGN §4.10 `Trigger`). */
export type PhaseEvent = 'addsDead' | 'communionMovementEnd';

/** A creature's phases ([] for a non-boss or a party member). */
export function phasesOf(content: ContentPack, c: Pick<Combatant, 'kind' | 'refId'>): readonly Phase[] {
  return c.kind === 'enemy' ? (content.creatures[c.refId]?.phases ?? []) : [];
}

/** Has `c` entered phase `index` in this fight? */
export const phaseEntered = (c: Pick<Combatant, 'pattern'>, index: number): boolean => c.pattern.firedOnce.includes(`${PHASE_ENTERED_KEY}${index}`);

/** `addsDead`: at least one add has fought in this fight and none still stands. */
export function addsDown(combat: CombatState): boolean {
  const adds = combat.enemies.filter((e) => e.isAdd);
  return adds.length > 0 && !adds.some(isActive);
}

/** One trigger of an `enterWhen` OR-list (see the file header). `event` is the event being reported, if any. */
export function triggerHolds(combat: CombatState, boss: Combatant, t: Trigger, event?: PhaseEvent): boolean {
  if ('hpBelow' in t) return boss.hp < t.hpBelow * boss.hpMax;
  if ('round' in t) return combat.round >= t.round;
  if ('event' in t) return t.event === 'addsDead' ? addsDown(combat) : event === t.event;
  return (combat.communion?.resolve ?? Number.NEGATIVE_INFINITY) >= t.resolveAtLeast;
}

/** The party has no active companion: phase adds use `countSolo` (DESIGN §4.10). */
export const fightingSolo = (combat: CombatState): boolean => !combat.party.some((c) => c.kind === 'companion' && isActive(c));

// ---- adds ------------------------------------------------------------------------------------------------------------------

/**
 * Spawns up to `count` adds of `creatureId` at `hpPct` of their max HP into empty slots (never more than 3 enemies
 * standing); each is `isAdd`, counted as seen, and — unless `opening` — gets its first intent. Returns them.
 */
export function spawnAdds(ctx: StepCtx, combat: CombatState, boss: Combatant, creatureId: string, count: number, hpPct: number, opening = false): Combatant[] {
  const def = ctx.content.creatures[creatureId];
  const room = Math.min(count, MAX_ENEMIES - combat.enemies.filter(isActive).length);
  if (!def || room <= 0) return [];
  const adds: Combatant[] = [];
  for (let i = 0; i < room; i++) {
    const n = combat.enemies.filter((e) => e.refId === creatureId).length;
    const add = enemyCombatant(ctx, creatureId, n === 0 ? def.name : `${def.name} ${String.fromCharCode(65 + n)}`);
    add.isAdd = true;
    add.hp = Math.max(1, Math.min(add.hpMax, roundHalfUp(add.hpMax * hpPct)));
    combat.enemies.push(add);
    ctx.s.counters.seen[creatureId] = (ctx.s.counters.seen[creatureId] ?? 0) + 1;
    adds.push(add);
  }
  ctx.emit({ t: 'addsSummoned', uids: adds.map((a) => a.uid) });
  combatLog(combat, `${adds.map((a) => a.name).join(' and ')} join${adds.length === 1 ? 's' : ''} ${boss.name}.`, 'phase');
  if (!opening) for (const add of adds) generateIntent(ctx, combat, add);
  return adds;
}

/** The current phase's reinforcement rows: keep the opening count standing until `total` have fought (file header). */
function reinforce(ctx: StepCtx, combat: CombatState, boss: Combatant): void {
  const phase = phasesOf(ctx.content, boss)[boss.phase];
  for (const row of phase?.adds ?? []) {
    if (!row.reinforce) continue;
    const keep = Math.min(row.reinforce.maxAlive, fightingSolo(combat) ? (row.countSolo ?? row.count) : row.count);
    const of = combat.enemies.filter((e) => e.isAdd && e.refId === row.creatureId);
    const standing = of.filter(isActive).length;
    const want = Math.min(keep - standing, row.reinforce.total - of.length);
    if (want > 0) spawnAdds(ctx, combat, boss, row.creatureId, want, row.hpPct);
  }
}

// ---- entering a phase -------------------------------------------------------------------------------------------------------

/** A phase's `onEnter` effects in order (see the file header for the combat-scope atoms). */
function applyOnEnter(ctx: StepCtx, combat: CombatState, boss: Combatant, phase: Phase): void {
  for (const effect of phase.onEnter) {
    const [key, value] = atomOf<EffectKey>(effect, 'onEnter');
    if (!isCombatScope(key)) {
      apply(effect, ctx, { source: `phase:${phase.id}` });
      continue;
    }
    if (key === 'surviveRounds') {
      combatLog(combat, `Hold out for ${(value as EffectAtoms['surviveRounds']).rounds} rounds.`, 'phase');
    } else if (key === 'leaveCombat') {
      withdrawFromCombat(combat, boss);
    } else if (key === 'stripBuffs') {
      const strip = value as EffectAtoms['stripBuffs'];
      const who = strip.target === 'self' ? [boss] : strip.target === 'all_allies' || strip.target === 'ally' ? combat.enemies : combat.party;
      for (const c of who.filter(isActive)) for (const kind of strip.kinds) removeStatus(ctx, combat, c, STRIP_KINDS[kind], `${c.name}'s ${kind} is torn away.`);
    }
  }
}

/**
 * Enters phase `index` of `boss` (DESIGN §4.10): marker, `bossPhase` + the line, `onEnter`, adds, then the pattern
 * restarts with a fresh intent (none at the opening: the reducer's opening intents follow).
 */
export function enterPhase(ctx: StepCtx, combat: CombatState, boss: Combatant, index: number, opening = false): void {
  const phase = phasesOf(ctx.content, boss)[index];
  if (!phase) throw new Error(`phases: ${boss.refId} has no phase ${index}`);
  boss.phase = index;
  boss.pattern.firedOnce.push(`${PHASE_ENTERED_KEY}${index}`);
  const text = phase.line ?? phase.name;
  ctx.emit({ t: 'bossPhase', uid: boss.uid, phase: index, text });
  combatLog(combat, text, 'phase');
  applyOnEnter(ctx, combat, boss, phase);
  const solo = fightingSolo(combat);
  for (const row of phase.adds) spawnAdds(ctx, combat, boss, row.creatureId, solo ? (row.countSolo ?? row.count) : row.count, row.hpPct, opening);
  if (opening) {
    boss.pattern.pointer = 0;
    boss.pattern.phaseEnteredRound = combat.round;
  } else if (isActive(boss)) resetPattern(ctx, combat, boss);
}

/**
 * DESIGN §4.1 Setup for bosses (the reducer calls it before the opening intents): each boss enters its opening phase —
 * the first whose `skipWhen` is false — then any later phase whose triggers already hold. Adds spawned here join round 1.
 */
export function openPhases(ctx: StepCtx, combat: CombatState): void {
  const before = combat.enemies.length;
  for (const boss of [...combat.enemies]) {
    const phases = phasesOf(ctx.content, boss);
    if (phases.length === 0 || !isActive(boss)) continue;
    const skip = (p: Phase): boolean => p.skipWhen !== undefined && evaluate(p.skipWhen, ctx.s, ctx.profile, ctx.content);
    let start = phases.findIndex((p) => !skip(p));
    if (start < 0) start = phases.length - 1;
    enterPhase(ctx, combat, boss, start, true);
    advance(ctx, combat, boss, undefined, true);
  }
  if (combat.enemies.length !== before) startRound(combat, ctx.content);
}

/** Enters, in order, every later phase of `boss` whose `enterWhen` holds. */
function advance(ctx: StepCtx, combat: CombatState, boss: Combatant, event: PhaseEvent | undefined, opening = false): void {
  const phases = phasesOf(ctx.content, boss);
  for (let i = boss.phase + 1; i < phases.length && isActive(boss); i++) {
    const phase = phases[i] as Phase;
    if (phase.enterWhen.some((t) => triggerHolds(combat, boss, t, event))) enterPhase(ctx, combat, boss, i, opening);
  }
}

/**
 * The phase check (after every damage event and at round end; DESIGN §4.10): for each standing boss, its current phase's
 * reinforcements first (a fallen add is replaced at once, so `addsDead` sees the replacement), then the later phases
 * whose triggers hold are entered in order. Nothing while the player is down.
 */
export function checkPhases(ctx: StepCtx, combat: CombatState, event?: PhaseEvent): void {
  if (!combat.party.some((c) => c.kind === 'player' && c.alive)) return;
  for (const boss of [...combat.enemies]) {
    if (!isActive(boss) || phasesOf(ctx.content, boss).length === 0) continue;
    reinforce(ctx, combat, boss);
    advance(ctx, combat, boss, event);
  }
}

/** An `event` trigger reported by another system (U29: `communionMovementEnd`). */
export function phaseEvent(ctx: StepCtx, combat: CombatState, event: PhaseEvent): void {
  checkPhases(ctx, combat, event);
}

// ---- survival (D-069.9) -----------------------------------------------------------------------------------------------------

/** The `surviveRounds` armed in this fight (a boss that entered its first phase with it), if any. */
export function survivalRounds(content: ContentPack, combat: CombatState): { rounds: number; line?: string } | null {
  for (const e of combat.enemies) {
    const first = phasesOf(content, e)[0];
    if (!first || !phaseEntered(e, 0)) continue;
    for (const effect of first.onEnter as readonly Effect[]) if ('surviveRounds' in effect) return effect.surviveRounds;
  }
  return null;
}
