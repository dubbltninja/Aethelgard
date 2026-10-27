// Enemy intents (DESIGN §4.2; §4.1 Setup and "Enemy turn"; §4.8 targeting; §4.10 a boss reads its active phase's
// pattern; PLAN §4.10 "Intents", §8.1 row "intents"; D-066 #14: the ordered pattern wins).
//
// Pattern → program. A creature's pattern (for a boss, its active phase's: `Combatant.phase`) compiles once into a flat
// program: `move`, `branch` (an `if`: false jumps to its `else` block or past it), `jump`, `pick` (a `weighted` step:
// one rng draw), `hold` (`phaseHold`); a `repeat` block is unrolled. `Combatant.pattern.pointer` is the address of the
// next instruction; running off the end wraps to 0. So the pointer advances one step per intent and wraps, and a
// `then`/`else` block runs to completion before the pointer continues (DESIGN §4.2).
//
// Generation (`generateIntent`) runs the program from the pointer until a move step is chosen: a step whose `when` is
// false is skipped (the pointer advances, the walk goes on), a branch evaluates its condition, a pick draws, a hold
// stops the walk where it is (no intent until the phase changes, U27 `resetPattern`). Nothing eligible in a whole lap:
// no intent (the creature holds). `CombatWhen` is evaluated here, at generation, never later; it reads the turn the
// intent is for (`first` = its 1st turn, `everyNth: n` = its n-th, 2n-th … turn; `turnsTaken` counts every turn it
// reached its action, a stunned one included), the round that turn falls in (`roundAtLeast`), and — for target atoms —
// the step's target (an `if` reads the default single target). `oncePerFight` is step-scoped: the step's key (phase
// index + its path in the pattern) is recorded in `pattern.firedOnce` when the step is chosen, so a step inside a boss
// phase is "once in this phase". World Condition atoms evaluate through conditions.ts.
//
// Commitment (DESIGN §4.2 "generation = commitment"): the stored Intent is the move, the target (null for an area or a
// self move; an area intent carries the tag 'ALL'), the projected range — the damage pipeline at the variance bounds
// (damage.ts `damageRange`: no crit, no rng, not assuming Guard) × the move's hits, against the target's current
// statuses, armor and Shield (an area move: against the player) — the "?" flag, the telegraph line and effect tags.
// Target rules (DESIGN §4.8): `player`; `companion` (else the player); `lowest_hp` by HP %; `highest_mag` by SP;
// `random` 60/40 player/companion (one draw, only when both stand); `marked_first`; `taunter`; `all`; `self`; `ally`
// (the most hurt other ally, else itself). A Taunt on the creature overrides every single-target rule, at generation
// and at execution (D-076: the Taunt sits on the taunted creature, its source is the taunter).
//
// Turn order (reducers/combat.ts): every enemy generates its first intent before the first turn (`openingIntents`).
// An enemy's turn executes its intent (`executeIntent`), then — once its turn is over (end-of-turn countdowns done, so
// conditions and projections see the statuses its next turn will see) — generates the next. A Stun cancels the stored
// intent (statuses.ts) and the creature loses its action; after that turn it generates a fresh intent from the next
// step, so the stunned step is skipped, not replayed; while it stays stunned it holds (no intent). An interrupt
// (`interruptIntent`; a boss's Stagger, refused when `interruptible` is false) cancels the intent and generates the next
// one at once: the creature still acts. At the start of each player turn (`refreshIntents`) every intent is re-aimed
// (Taunt; a dead target → the rule's next valid pick, which with a party of at most two is the other member) and
// re-projected against the current state — the move is never re-chosen — and a hidden intent whose creature acts
// before the player's next turn is revealed (DESIGN: "at the start of the player's turn immediately preceding it").
// Archive Light (DESIGN §12.4; D-089, U34c): while specials.ts REVEAL_KEY runs in the player's cooldown table (its next 2
// player turns), every intent is generated unhidden and any still hidden is revealed; the cast reveals the hidden ones
// at once (`revealIntents`).
//
// Wind-ups (`windUp: { turns, then }`, tyr_gather → tyr_chrono_strike): the wind-up move holds the creature for `turns`
// turns (the move itself, then continuation intents of the same move), then `then` lands on the same target; the
// pointer holds meanwhile. The countdown lives in the creature's cooldown table under `windup:<move id>` (its turn end
// counts it down, like Stun's recovery window). Stun and interrupt break a wind-up.
//
// Execution: the move's special may replace all of it (hour_presses, bound_mage; U26 specials.ts); else the hits (each
// `resolveHit` → the reducer's `applyHit`; `power.hits` — or a `multiHit` effect — hits per target, an area move per
// living party member in party order; a creature a counter-hit downs stops), then per struck target its 'target' status
// rows if a hit connected (a dead target rolls nothing); a non-damaging move's 'target' rows land without a hit roll.
// Then cleanseSelf (debuffs), heal, self Shield, ally Shield, the other status rows, summon (at most `max` of that
// creature and 3 enemies alive), revive; then (U26, specials.ts `finishMove`) the special's `after`, the combat-scope
// effects (stripBuffs, healOnDamage) and `riposte`; last, `leaveCombat` (the move's flag or effect, D-069.9): the
// creature withdraws (`withdrawFromCombat`: out of the fight, no XP, no loot, not a kill).
//
// Events: `intentRevealed` carries a copy of the intent whenever one is generated (hidden ones too: the UI masks them
// by the flag) and whenever a refresh changes what the chip shows (revealed, re-aimed, re-projected).
//
// U34e (D-091, D-092, D-094, D-096, D-098): `allyDown` (an ally fell this fight) and `allyBelow` (a living ally under that
// share of its max HP) are CombatWhen atoms. A move with `repeatPrevious` becomes, at generation, the creature's previous
// move again — the same aim, the same target if it still stands (`prev:` tag, written when a move is played; skipped while
// there is none), shown with its own telegraph and the tag 'again'. Execution: a `missesIfGuarded` move misses a Guarding
// target outright (no damage, no status); `consumesAlly` takes one living ally of that creature out of the fight before
// the heal (not a kill); `clockCost` moves the Breach Clock's limit earlier (once a fight with `oncePerFight`, a `clock:`
// tag). A `class_mirror` or `last_spell` special decides the move's damage type (`moveDamageType`: the player's class type,
// WORLD §6.8 Redundant Wayfinder; the type of the player's last ability this fight, WORLD §6.5 Paradox Wisp), for the
// projection and the hit alike. A creature's `deathMove` (WORLD `onDeath`) resolves the moment it falls (`playDeathMove`,
// the reducer's knock-out), and an `hpLines` entry with a move replaces the committed intent (`forceIntent`, phases.ts).
import type { Condition } from '@schema/condition';
import type { CombatWhen, CombatWhenKey, Move, Step } from '@schema/creature';
import { atomOf, evaluate } from '../conditions';
import { changeLimit } from '../effects';
import type { ContentPack, StepCtx } from '../ctx';
import type { Rng } from '../rng';
import type { Combatant, CombatState, DamageType, Intent } from '../types/state';
import { damageRange, hasStatus, resolveHeal, resolveHit, roundHalfUp, type HitResult, type HitSpec, type RangeOptions } from './damage';
import { REVEAL_KEY, beginMove, finishMove, hooksOf, moveHits, replaceMove, type CombatOps, type HitKind } from './specials';
import { STATUS, applyStatus, applyStatusRows, cleanse, isBoss, skipsTurn, tauntedBy, type WhenEval } from './statuses';
import { FORCED_TAG, MAX_ENEMIES, combatLog, combatantByUid, enemyCombatant, isActive, sortTurnOrder } from './turnOrder';

/** DESIGN §4.8: a `random` intent picks the player 60 % of the time when a companion also stands. */
export const RANDOM_PLAYER_SHARE = 0.6;
/** The tag that marks an area intent (the chip's "ALL"; `targetUid` is null). */
export const TAG_ALL = 'ALL';
/** The tag of a wind-up move and of its continuation intents. */
export const TAG_WIND_UP = 'winding up';
/** Cooldown-table key prefix of a running wind-up: `windup:<wind-up move id>` → turns left (counted down at turn end). */
export const WIND_UP_KEY = 'windup:';
/** Effect tags for a status the creature puts on itself (DESIGN §4.2 Display: "Shield", "heals itself"; §4.12 "shrouds itself"). */
export const SELF_STATUS_TAGS: Readonly<Record<string, string>> = {
  [STATUS.phase]: 'shrouds itself',
  [STATUS.regen]: 'heals itself',
  [STATUS.rewind]: 'rewinds itself',
  [STATUS.haste]: 'hastens itself',
  [STATUS.shield]: 'Shield',
};

type MoveStep = Extract<Step, { move: string }>;
export type TargetRuleId = MoveStep['target'];
/** How an intent is aimed: one opponent, every opponent, itself, or one of its own side. */
export type IntentAim = 'single' | 'all' | 'self' | 'ally';
/** What CombatWhen evaluation reads: no rng, no Rng-bearing context needed. */
export type IntentRead = Pick<StepCtx, 's' | 'profile' | 'content'>;
/** The combat reducer's hit application (reducers/combat.ts `applyHit`), passed in to keep the import graph acyclic. */
export type HitApplier = (ctx: StepCtx, combat: CombatState, attacker: Combatant, target: Combatant, spec: HitSpec, result: HitResult, kind: HitKind) => void;

// ---- the program ---------------------------------------------------------------------------------------------------------

/** One instruction of a compiled pattern; `key` is the step's path in the pattern ("3", "2.then.0", "0.weighted.1"). */
export type Instr =
  | { op: 'move'; key: string; move: string; target: TargetRuleId; when?: CombatWhen }
  | { op: 'branch'; key: string; cond: CombatWhen; else: number }
  | { op: 'jump'; to: number }
  | { op: 'pick'; options: { w: number; to: number }[] }
  | { op: 'hold'; key: string };

const PROGRAMS = new WeakMap<readonly Step[], readonly Instr[]>();

/** The program of a pattern (cached per pattern array; content is immutable). */
export function compilePattern(steps: readonly Step[]): readonly Instr[] {
  let prog = PROGRAMS.get(steps);
  if (!prog) {
    const out: Instr[] = [];
    emitSteps(out, steps, '');
    prog = out;
    PROGRAMS.set(steps, prog);
  }
  return prog;
}

function emitSteps(out: Instr[], steps: readonly Step[], prefix: string): void {
  steps.forEach((st, i) => emitStep(out, st, `${prefix}${i}`));
}

function emitStep(out: Instr[], st: Step, key: string): void {
  if ('move' in st) {
    const ins: Instr = { op: 'move', key, move: st.move, target: st.target };
    if (st.when !== undefined) ins.when = st.when;
    out.push(ins);
  } else if ('if' in st) {
    const branch = { op: 'branch' as const, key, cond: st.if, else: -1 };
    out.push(branch);
    emitSteps(out, st.then, `${key}.then.`);
    if (st.else) {
      const jump = { op: 'jump' as const, to: -1 };
      out.push(jump);
      branch.else = out.length;
      emitSteps(out, st.else, `${key}.else.`);
      jump.to = out.length;
    } else branch.else = out.length;
  } else if ('weighted' in st) {
    const pick = { op: 'pick' as const, options: [] as { w: number; to: number }[] };
    out.push(pick);
    const ends: { op: 'jump'; to: number }[] = [];
    st.weighted.forEach((o, j) => {
      pick.options.push({ w: o.w, to: out.length });
      emitStep(out, o.step, `${key}.weighted.${j}`);
      const end = { op: 'jump' as const, to: -1 };
      out.push(end);
      ends.push(end);
    });
    for (const end of ends) end.to = out.length;
  } else if ('repeat' in st) {
    for (let k = 0; k < st.times; k++) emitSteps(out, st.repeat, `${key}.repeat.`); // same keys: once-steps stay step-scoped
  } else out.push({ op: 'hold', key });
}

/** The pattern a creature follows now: its active phase's for a boss (DESIGN §4.10), else its own. */
export function patternOf(content: ContentPack, c: Combatant): readonly Step[] {
  const def = content.creatures[c.refId];
  if (!def) return [];
  if (def.phases.length === 0) return def.pattern;
  return def.phases[Math.min(Math.max(0, c.phase), def.phases.length - 1)]?.pattern ?? [];
}

// ---- CombatWhen ------------------------------------------------------------------------------------------------------------

export interface WhenScope {
  /** The creature (or caster) the predicate is about. */
  self: Combatant;
  /** What `targetHas` / `targetIsBoss` / `targetHasActed` read (null: none, they are false). */
  target: Combatant | null;
  /** The turn of `self` being planned or played (1 = its first turn). */
  turn: number;
  /** The round that turn falls in. */
  round: number;
  /** The step's once-key (`oncePerFight`); absent → `oncePerFight` holds. */
  onceKey?: string;
}

const sideOf = (combat: CombatState, c: Combatant): Combatant[] => (c.kind === 'enemy' ? combat.enemies : combat.party);
const foesOf = (combat: CombatState, c: Combatant): Combatant[] => (c.kind === 'enemy' ? combat.party : combat.enemies);
const alliesOf = (combat: CombatState, c: Combatant): Combatant[] => sideOf(combat, c).filter((o) => o !== c && isActive(o));
const hpFraction = (c: Combatant): number => c.hp / c.hpMax;

/** DESIGN §4.2's combat predicates plus the world Condition atoms (U16, PLAN §5.4). Pure: no rng, no writes. */
export function evalCombatWhen(r: IntentRead, combat: CombatState, when: CombatWhen, scope: WhenScope): boolean {
  const [key, v] = atomOf<CombatWhenKey>(when, 'CombatWhen');
  const { self, target } = scope;
  switch (key) {
    case 'all':
      return (v as CombatWhen[]).every((w) => evalCombatWhen(r, combat, w, scope));
    case 'any':
      return (v as CombatWhen[]).some((w) => evalCombatWhen(r, combat, w, scope));
    case 'not':
      return !evalCombatWhen(r, combat, v as CombatWhen, scope);
    case 'hpBelow':
      return self.hp < (v as number) * self.hpMax;
    case 'roundAtLeast':
      return scope.round >= (v as number);
    case 'allyCountBelow':
      return alliesOf(combat, self).length < (v as number);
    case 'allyPresent':
      return alliesOf(combat, self).some((a) => v === true || a.refId === v);
    case 'targetHas':
      return target !== null && hasStatus(target, v as string);
    case 'selfHas':
      return hasStatus(self, v as string);
    case 'everyNth':
      return scope.turn % (v as number) === 0;
    case 'first':
      return scope.turn === 1;
    case 'oncePerFight':
      return scope.onceKey === undefined || !onceFired(r, combat, self, scope.onceKey);
    case 'playerGuarding':
      return (combat.party.find((c) => c.kind === 'player')?.guarding ?? false) === v;
    case 'targetIsBoss':
      return (target !== null && isBoss(r.content, target)) === v;
    case 'targetHasActed':
      return (target !== null && target.pattern.turnsTaken > 0) === v;
    case 'allyDown':
      return sideOf(combat, self).some((o) => o !== self && !o.alive && !o.fledOrGone);
    case 'allyBelow':
      return alliesOf(combat, self).some((a) => a.hp < (v as number) * a.hpMax);
    default:
      return evaluate(when as Condition, r.s, r.profile, r.content);
  }
}

/** Does a condition mention `oncePerFight` (then choosing its step records it)? */
function mentionsOnce(when: CombatWhen): boolean {
  const [key, v] = atomOf<CombatWhenKey>(when, 'CombatWhen');
  if (key === 'oncePerFight') return true;
  if (key === 'all' || key === 'any') return (v as CombatWhen[]).some(mentionsOnce);
  return key === 'not' && mentionsOnce(v as CombatWhen);
}

const onceKeyOf = (c: Combatant, key: string): string => `${c.phase}:${key}`;

const TURN_PHASES: readonly CombatState['phase'][] = ['playerTurn', 'companionTurn', 'enemyTurn'];

/** The turn and round of `c`'s next turn: later this round if it is still to act, else next round. */
function nextTurnOf(combat: CombatState, c: Combatant): { turn: number; round: number } {
  const i = combat.turnOrder.indexOf(c.uid);
  const acting = TURN_PHASES.includes(combat.phase) && combat.turnOrder[combat.turnIndex] === c.uid;
  const later = i >= 0 && i >= combat.turnIndex && !acting;
  return { turn: c.pattern.turnsTaken + 1, round: combat.round + (later ? 0 : 1) };
}

// ---- targets ---------------------------------------------------------------------------------------------------------------

/** The living opponent a Taunt on `c` forces its single-target intents onto (DESIGN §4.2), if any. */
export function taunterOf(combat: CombatState, c: Combatant): Combatant | null {
  const uid = tauntedBy(c);
  const t = uid === null ? undefined : combatantByUid(combat, uid);
  return t && isActive(t) && foesOf(combat, c).includes(t) ? t : null;
}

const aimOf = (rule: TargetRuleId): IntentAim => (rule === 'all' || rule === 'self' || rule === 'ally' ? rule : 'single');

/** A single-target rule's pick among `c`'s living opponents (Taunt first); `rng` only for `random` with two candidates. */
function pickFoe(combat: CombatState, c: Combatant, rule: TargetRuleId, rng?: Rng): Combatant | null {
  const foes = foesOf(combat, c).filter(isActive);
  const first = foes.find((f) => f.kind === 'player') ?? foes[0];
  if (!first) return null;
  const taunter = taunterOf(combat, c);
  if (taunter) return taunter;
  const companion = foes.find((f) => f.kind === 'companion');
  switch (rule) {
    case 'companion':
      return companion ?? first;
    case 'lowest_hp':
      return foes.reduce((a, b) => (hpFraction(b) < hpFraction(a) ? b : a), first);
    case 'highest_mag':
      return foes.reduce((a, b) => (b.sp > a.sp ? b : a), first);
    case 'random':
      return companion && first.kind === 'player' && rng ? (rng.chance(RANDOM_PLAYER_SHARE) ? first : companion) : first;
    case 'marked_first':
      return foes.find((f) => hasStatus(f, STATUS.mark)) ?? first;
    default:
      return first; // 'player'; 'taunter' without a living taunter
  }
}

/** The most hurt other living ally of `c`, else `c` itself. */
function pickAlly(combat: CombatState, c: Combatant): Combatant {
  const allies = alliesOf(combat, c);
  const first = allies[0];
  return first ? allies.reduce((a, b) => (hpFraction(b) < hpFraction(a) ? b : a), first) : c;
}

/** How a stored intent is aimed: 'ALL' tag → all; no target → self; a target on its own side → ally; else single. */
export function aimOfIntent(combat: CombatState, c: Combatant, intent: Pick<Intent, 'targetUid' | 'tags'>): IntentAim {
  if (intent.tags.includes(TAG_ALL)) return 'all';
  if (intent.targetUid === null) return 'self';
  const t = combatantByUid(combat, intent.targetUid);
  return t && sideOf(combat, c).includes(t) ? 'ally' : 'single';
}

/**
 * Who a stored intent hits now (DESIGN §4.2): a Taunt retargets a single-target intent; a dead target → the rule's next
 * valid pick (the default single target); an ally intent whose ally fell → the most hurt other ally. Null for an area intent.
 */
export function intentTarget(combat: CombatState, c: Combatant, intent: Pick<Intent, 'targetUid' | 'tags'>): Combatant | null {
  const aim = aimOfIntent(combat, c, intent);
  const t = intent.targetUid === null ? undefined : combatantByUid(combat, intent.targetUid);
  switch (aim) {
    case 'all':
      return null;
    case 'self':
      return c;
    case 'ally':
      return t && isActive(t) ? t : pickAlly(combat, c);
    case 'single':
      return taunterOf(combat, c) ?? (t && isActive(t) ? t : pickFoe(combat, c, 'player'));
  }
}

// ---- the intent ------------------------------------------------------------------------------------------------------------

/** A creature move as a hit (null for a non-damaging move); an area move is not stopped by Phase. */
export function intentHitSpec(moveId: string, move: Move, aoe: boolean): HitSpec | null {
  if (!move.power || !move.type) return null;
  const spec: HitSpec = { source: moveId, type: move.type, base: move.power.base, coef: move.power.coef, stat: move.power.stat };
  if (move.spell) spec.spell = true;
  if (aoe) spec.aoe = true;
  return spec;
}

/** The chip's effect tags (DESIGN §4.2 Display): 'may Weaken', 'Slow', 'shrouds itself', 'Shield', 'heals itself' … */
export function intentTags(content: ContentPack, move: Move): string[] {
  const name = (id: string): string => content.statuses[id]?.name ?? id;
  const tags: string[] = [];
  for (const row of move.statuses) {
    if (row.target === 'target' || row.target === 'all_enemies') tags.push(row.chance < 1 ? `may ${name(row.status)}` : name(row.status));
    else if (row.target === 'self') tags.push(SELF_STATUS_TAGS[row.status] ?? `${name(row.status)} on itself`);
    else tags.push(`${name(row.status)} on ${row.target === 'ally' ? 'an ally' : 'its allies'}`);
  }
  if (move.shield) tags.push('Shield');
  if (move.shieldAlly) tags.push('shields an ally');
  if (move.heal) tags.push(move.heal.target === 'self' ? 'heals itself' : 'heals an ally');
  if (move.cleanseSelf) tags.push('cleanses itself');
  if (move.summon) tags.push('summons');
  if (move.revive) tags.push('revives an ally');
  if (move.windUp) tags.push(TAG_WIND_UP);
  return [...new Set(tags)];
}

/**
 * The projected damage of an intent now (DESIGN §4.2): `damageRange` × hits against its target (an area intent: the
 * player, else the first living opponent); [0, 0] for a non-damaging move or no opponent to hit. `{ guard: true }` is the Guard
 * button's preview ("14–17 → 7–9"). No rng.
 */
export function projectIntent(r: IntentRead, combat: CombatState, c: Combatant, intent: Pick<Intent, 'moveId' | 'targetUid' | 'tags'>, opts: RangeOptions = {}): [number, number] {
  const move = r.content.creatures[c.refId]?.moves[intent.moveId];
  const aim = aimOfIntent(combat, c, intent);
  const spec = move ? typed(r, combat, move, intentHitSpec(intent.moveId, move, aim === 'all')) : null;
  const target = aim === 'all' ? pickFoe(combat, c, 'player') : intentTarget(combat, c, intent);
  if (!move || !spec || !target || sideOf(combat, c).includes(target)) return [0, 0];
  const [lo, hi] = damageRange(r, c, target, spec, opts);
  const hits = moveHits(move);
  return [lo * hits, hi * hits];
}

/** U34e (WORLD §10.2, the Aberration Pair): a `shared_once` creature's `oncePerFight` steps are one between all of its kind. */
export const SHARED_ONCE_TAG = 'shared_once';
/** U34e (WORLD §10.2, the Unlit Lantern): "intent hidden until it takes damage". */
export const UNLIT_TAG = 'unlit';
const hasCreatureTag = (r: Pick<IntentRead, 'content'>, c: Combatant, tag: string): boolean => c.kind === 'enemy' && (r.content.creatures[c.refId]?.tags.includes(tag) ?? false);

function onceFired(r: IntentRead, combat: CombatState, self: Combatant, key: string): boolean {
  if (self.pattern.firedOnce.includes(key)) return true;
  return hasCreatureTag(r, self, SHARED_ONCE_TAG) && combat.enemies.some((e) => e.refId === self.refId && e.pattern.firedOnce.includes(key));
}

/** An `unlit` creature's intents stay hidden until it has taken damage. */
export const unlitNow = (r: Pick<IntentRead, 'content'>, c: Combatant): boolean => hasCreatureTag(r, c, UNLIT_TAG) && c.hp >= c.hpMax;

function makeIntent(r: IntentRead, combat: CombatState, c: Combatant, moveId: string, move: Move, aim: IntentAim, target: Combatant | null): Intent {
  const tags = intentTags(r.content, move);
  const intent: Intent = {
    moveId,
    targetUid: aim === 'single' || (aim === 'ally' && target !== c) ? (target?.uid ?? null) : null,
    projected: [0, 0],
    hidden: (move.hidden || unlitNow(r, c)) && !intentsRevealed(combat),
    text: move.line,
    tags: aim === 'all' ? [TAG_ALL, ...tags] : tags,
  };
  intent.projected = projectIntent(r, combat, c, intent);
  return intent;
}

const copyOf = (i: Intent): Intent => ({ ...i, projected: [i.projected[0], i.projected[1]], tags: [...i.tags] });

function store(ctx: StepCtx, combat: CombatState, c: Combatant, intent: Intent): Intent {
  combat.intents[c.uid] = intent;
  ctx.emit({ t: 'intentRevealed', uid: c.uid, intent: copyOf(intent) });
  return intent;
}

/** The running wind-up's cooldown key, if any. */
const windUpKeyOf = (c: Combatant): string | undefined => Object.keys(c.cooldowns).find((k) => k.startsWith(WIND_UP_KEY));

function breakWindUp(c: Combatant): void {
  const key = windUpKeyOf(c);
  if (key !== undefined) delete c.cooldowns[key];
}

/** During a wind-up: the continuation (more turns to go) or the `then` move, aimed like the intent just played. */
function windUpIntent(ctx: StepCtx, combat: CombatState, c: Combatant, after: Intent | null): Intent | null {
  const key = windUpKeyOf(c);
  if (key === undefined) return null;
  const moves = ctx.content.creatures[c.refId]?.moves ?? {};
  const windId = key.slice(WIND_UP_KEY.length);
  const left = c.cooldowns[key] ?? 0;
  const nextId = left > 1 ? windId : (moves[windId]?.windUp?.then ?? '');
  const next = moves[nextId];
  if (!next) {
    delete c.cooldowns[key];
    return null;
  }
  const aim = after ? aimOfIntent(combat, c, after) : 'single';
  const target = after ? intentTarget(combat, c, after) : pickFoe(combat, c, 'player');
  return makeIntent(ctx, combat, c, nextId, next, aim, target);
}

/** Runs the program from the pointer to the next move step (see the file header); null when it holds. */
function patternIntent(ctx: StepCtx, combat: CombatState, c: Combatant): Intent | null {
  const moves = ctx.content.creatures[c.refId]?.moves ?? {};
  const prog = compilePattern(patternOf(ctx.content, c));
  const { turn, round } = nextTurnOf(combat, c);
  const scope = (target: Combatant | null, key: string): WhenScope => ({ self: c, target, turn, round, onceKey: onceKeyOf(c, key) });
  const fire = (when: CombatWhen, key: string): void => {
    const k = onceKeyOf(c, key);
    if (mentionsOnce(when) && !c.pattern.firedOnce.includes(k)) c.pattern.firedOnce.push(k);
  };
  let pc = c.pattern.pointer;
  for (let n = 0; n <= 2 * prog.length; n++) {
    if (pc < 0 || pc >= prog.length) pc = 0;
    const ins = prog[pc];
    if (!ins) return null;
    switch (ins.op) {
      case 'move': {
        const aim = aimOf(ins.target);
        const provisional = aim === 'self' ? c : aim === 'ally' ? pickAlly(combat, c) : pickFoe(combat, c, aim === 'all' ? 'player' : ins.target);
        const move = moves[ins.move];
        const again = move?.repeatPrevious ? previousOf(ctx, combat, c) : null;
        if (!move || (move.repeatPrevious && again === null) || (ins.when !== undefined && !evalCombatWhen(ctx, combat, ins.when, scope(provisional, ins.key)))) {
          pc += 1;
          break;
        }
        if (ins.when !== undefined) fire(ins.when, ins.key);
        c.pattern.pointer = pc + 1;
        if (again !== null) return againIntent(ctx, combat, c, move, again);
        const target = aim === 'single' ? pickFoe(combat, c, ins.target, ctx.rng) : provisional;
        return makeIntent(ctx, combat, c, ins.move, move, aim, target);
      }
      case 'branch': {
        const ok = evalCombatWhen(ctx, combat, ins.cond, scope(pickFoe(combat, c, 'player'), ins.key));
        if (ok) fire(ins.cond, ins.key);
        pc = ok ? pc + 1 : ins.else;
        break;
      }
      case 'jump':
        pc = ins.to;
        break;
      case 'pick':
        pc = ctx.rng.weighted(ins.options.map((o) => ({ weight: o.w, value: o.to })));
        break;
      case 'hold':
        c.pattern.pointer = pc;
        return null;
    }
  }
  return null;
}

// ---- U34e: the previous move, forced intents, the damage type a special decides -------------------------------------------------

/** `pattern.firedOnce` tag prefix of the move a creature played last: `prev:<moveId>|<aim>|<targetUid>`. */
export const PREV_MOVE_TAG = 'prev:';
/** The tag a repeated intent carries (the chip's "again"). */
export const TAG_AGAIN = 'again';

/** The creature's previous move (its id, aim and target), or null before it has played one. */
function previousOf(ctx: IntentRead, combat: CombatState, c: Combatant): { moveId: string; move: Move; aim: IntentAim; target: Combatant | null } | null {
  const tag = c.pattern.firedOnce.find((t) => t.startsWith(PREV_MOVE_TAG));
  if (tag === undefined) return null;
  const [moveId = '', aim = 'single', uid = ''] = tag.slice(PREV_MOVE_TAG.length).split('|');
  const move = ctx.content.creatures[c.refId]?.moves[moveId];
  if (!move) return null;
  const was = uid === '' ? undefined : combatantByUid(combat, uid);
  const a = aim as IntentAim;
  const target = a === 'self' ? c : a === 'all' ? null : was && isActive(was) ? was : a === 'ally' ? pickAlly(combat, c) : pickFoe(combat, c, 'player');
  return { moveId, move, aim: a, target };
}

/** A `repeatPrevious` move's intent: the previous move again (its numbers), with the repeating move's telegraph and 'again'. */
function againIntent(ctx: StepCtx, combat: CombatState, c: Combatant, echo: Move, again: NonNullable<ReturnType<typeof previousOf>>): Intent {
  const intent = makeIntent(ctx, combat, c, again.moveId, again.move, again.aim, again.target);
  intent.text = echo.line;
  intent.tags = [...intent.tags, TAG_AGAIN];
  return intent;
}

/** Records the move `c` just played (the `prev:` tag; a repeat records what it repeated). */
function notePlayed(combat: CombatState, c: Combatant, intent: Intent): void {
  c.pattern.firedOnce = c.pattern.firedOnce.filter((t) => !t.startsWith(PREV_MOVE_TAG));
  c.pattern.firedOnce.push(`${PREV_MOVE_TAG}${intent.moveId}|${aimOfIntent(combat, c, intent)}|${intent.targetUid ?? ''}`);
}

/**
 * U34e (`hpLines` with a move, phases.ts): `c`'s committed intent is replaced by `moveId` (as a phase entry resets it) — a
 * non-damaging move aimed at itself, a damaging one at the player (the `player` rule); a wind-up is broken. Emits
 * `intentRevealed`.
 */
export function forceIntent(ctx: StepCtx, combat: CombatState, c: Combatant, moveId: string): Intent | null {
  const move = ctx.content.creatures[c.refId]?.moves[moveId];
  if (!move || !isActive(c)) return null;
  breakWindUp(c);
  if (!c.pattern.firedOnce.includes(`${FORCED_TAG}${moveId}`)) c.pattern.firedOnce.push(`${FORCED_TAG}${moveId}`);
  return store(ctx, combat, c, forcedOf(ctx, combat, c, moveId, move));
}

const forcedOf = (r: IntentRead, combat: CombatState, c: Combatant, moveId: string, move: Move): Intent =>
  move.power ? makeIntent(r, combat, c, moveId, move, 'single', pickFoe(combat, c, 'player')) : makeIntent(r, combat, c, moveId, move, 'self', c);

// A forced move waits in `forced:<moveId>` until it is played (FORCED_TAG, turnOrder.ts since U81a: the first fight's intents).

function forcedIntent(ctx: StepCtx, combat: CombatState, c: Combatant): Intent | null {
  const tag = c.pattern.firedOnce.find((t) => t.startsWith(FORCED_TAG));
  const moveId = tag?.slice(FORCED_TAG.length);
  const move = moveId === undefined ? undefined : ctx.content.creatures[c.refId]?.moves[moveId];
  return moveId !== undefined && move ? forcedOf(ctx, combat, c, moveId, move) : null;
}

/** The damage type a move deals now: its special's `damageType` hook decides (`class_mirror`, `last_spell`), else its own. */
export function moveDamageType(r: IntentRead, combat: CombatState, move: Pick<Move, 'type' | 'special'>): DamageType | undefined {
  const hook = hooksOf(move.special)?.damageType;
  return hook ? hook(r, combat, move.type) : move.type;
}

/** A move's hit spec with the damage type its special decides (unchanged without one). */
function typed(r: IntentRead, combat: CombatState, move: Move, spec: HitSpec | null): HitSpec | null {
  const type = spec === null ? undefined : moveDamageType(r, combat, move);
  return spec === null || type === undefined || type === spec.type ? spec : { ...spec, type };
}

/** The miss a `missesIfGuarded` move makes against a Guarding target. */
const GUARDED_MISS: HitResult = { hit: false, phased: false, crit: false, immune: false, hitChance: 0, critChance: 0, variance: null, amount: 0, absorbed: 0, shieldBroken: false, mitigated: 0, steps: [] };

/** `consumesAlly`: one living ally of that creature is gone from the fight (no XP, no loot, not a kill). */
function consumeAlly(combat: CombatState, c: Combatant, creatureId: string): void {
  const ally = combat.enemies.find((e) => e !== c && e.refId === creatureId && isActive(e));
  if (!ally) return;
  combatLog(combat, `${c.name} takes ${ally.name} into itself.`, 'info');
  ally.fledOrGone = true;
  ally.guarding = false;
  ally.statuses = [];
  breakWindUp(ally);
  delete combat.intents[ally.uid];
}

/** `clockCost`: the Breach Clock's limit moves `watches` earlier (once a fight with `oncePerFight`). */
function payClock(ctx: StepCtx, combat: CombatState, c: Combatant, moveId: string, cost: NonNullable<Move['clockCost']>): void {
  const tag = `clock:${moveId}`;
  if (cost.oncePerFight && c.pattern.firedOnce.includes(tag)) return;
  if (cost.oncePerFight) c.pattern.firedOnce.push(tag);
  combatLog(combat, `The Breach Clock loses ${cost.watches === 1 ? 'a watch' : `${cost.watches} watches`}.`, 'info');
  changeLimit(ctx, -cost.watches, `creature:${c.refId}`);
}

/**
 * U34e (WORLD `onDeath`): a creature's `deathMove` the moment it falls (the reducer's knock-out), before loot: its hits on
 * the move's target(s) — every living opponent for `all` — and, where one connected, its `target` status rows.
 */
export function playDeathMove(ctx: StepCtx, combat: CombatState, c: Combatant, applyHit: HitApplier): void {
  const dm = ctx.content.creatures[c.refId]?.deathMove;
  const move = dm === undefined ? undefined : ctx.content.creatures[c.refId]?.moves[dm.move];
  if (!dm || !move) return;
  const aim = aimOf(dm.target);
  combatLog(combat, `${c.name}: ${move.line}`, 'intent');
  const spec = typed(ctx, combat, move, intentHitSpec(dm.move, move, aim === 'all'));
  const struck = aim === 'all' ? foesOf(combat, c).filter(isActive) : aim === 'single' ? [pickFoe(combat, c, dm.target, ctx.rng)].filter((t): t is Combatant => t !== null) : [];
  const rows = move.statuses.filter((row) => row.target === 'target');
  const evalRow: WhenEval = (when, recipient) => evalCombatWhen(ctx, combat, when, { self: c, target: recipient, turn: c.pattern.turnsTaken + 1, round: combat.round });
  for (const t of struck) {
    let landed = spec === null;
    for (let h = 0; spec && h < moveHits(move) && isActive(t); h++) {
      const r = resolveHit(ctx, c, t, spec);
      applyHit(ctx, combat, c, t, spec, r, 'intent');
      landed ||= r.hit && !r.immune;
    }
    if (landed && isActive(t) && rows.length > 0) applyStatusRows(ctx, combat, c, t, rows, evalRow);
  }
}

/**
 * Generates and stores `c`'s next intent (DESIGN §4.2), replacing any stored one; emits `intentRevealed`. None for a
 * creature that is down, Stunned (it holds until the Stun is gone), unknown, holding (`phaseHold`) or with nothing
 * eligible, or when no opponent stands. `after` is the intent it just played (a wind-up keeps its aim).
 */
export function generateIntent(ctx: StepCtx, combat: CombatState, c: Combatant, after: Intent | null = null): Intent | null {
  delete combat.intents[c.uid];
  if (!isActive(c) || skipsTurn(ctx.content, c) || !foesOf(combat, c).some(isActive) || !ctx.content.creatures[c.refId]) return null;
  const intent = forcedIntent(ctx, combat, c) ?? windUpIntent(ctx, combat, c, after) ?? patternIntent(ctx, combat, c);
  return intent ? store(ctx, combat, c, intent) : null;
}

/** DESIGN §4.1 Setup: every enemy without one generates its first intent, in slot order. */
export function openingIntents(ctx: StepCtx, combat: CombatState): void {
  for (const e of combat.enemies) if (isActive(e) && !combat.intents[e.uid]) generateIntent(ctx, combat, e);
}

/**
 * After `c` lost its turn to Stun (DESIGN §4.2): the stunned step is skipped, not replayed — a fresh intent from the
 * next step, or none while it stays stunned (the pointer holds). A wind-up is broken.
 */
export function afterStunnedTurn(ctx: StepCtx, combat: CombatState, c: Combatant): Intent | null {
  breakWindUp(c);
  return generateIntent(ctx, combat, c);
}

/**
 * An interrupt (Pinning Shot, Stutter, Spellbreaker, Mountainfall; a boss's Stagger): cancels the stored intent and
 * generates the next one from the next step — the creature still acts. Refused (false) when the creature is not
 * `interruptible` or has no intent.
 */
export function interruptIntent(ctx: StepCtx, combat: CombatState, c: Combatant): boolean {
  const intent = combat.intents[c.uid];
  const def = ctx.content.creatures[c.refId];
  if (!intent || !def || !isActive(c)) return false;
  const what = def.moves[intent.moveId]?.name ?? intent.moveId;
  if (!def.interruptible) {
    combatLog(combat, `${c.name} cannot be staggered.`, 'intent');
    return false;
  }
  breakWindUp(c);
  combatLog(combat, isBoss(ctx.content, c) ? `${c.name} staggers: ${what} is lost.` : `${c.name}'s ${what} is interrupted.`, 'intent');
  const next = generateIntent(ctx, combat, c);
  const replacement = next === null ? null : next.hidden ? 'an unrevealed move' : (def.moves[next.moveId]?.name ?? next.moveId);
  combatLog(combat, replacement === null ? `${c.name} has no replacement move ready.` : `${c.name} still acts: next is ${replacement}.`, 'intent');
  return true;
}

/** A boss phase change (U27, DESIGN §4.10): the pointer restarts on the new phase's pattern and the intent is reset. */
export function resetPattern(ctx: StepCtx, combat: CombatState, c: Combatant): Intent | null {
  c.pattern.pointer = 0;
  c.pattern.phaseEnteredRound = combat.round;
  breakWindUp(c);
  return generateIntent(ctx, combat, c);
}

/** Does `c` act before the player's next turn (the player is acting now)? Later this round, or ahead of the player next round. */
function actsBeforePlayerAgain(ctx: StepCtx, combat: CombatState, c: Combatant): boolean {
  if (combat.turnOrder.indexOf(c.uid) > combat.turnIndex) return true;
  const next = sortTurnOrder(combat, ctx.content);
  const me = next.findIndex((uid) => combatantByUid(combat, uid)?.kind === 'player');
  const at = next.indexOf(c.uid);
  return at >= 0 && (me < 0 || at < me);
}

const sameChip = (a: Intent, b: Intent): boolean =>
  a.targetUid === b.targetUid && a.hidden === b.hidden && a.projected[0] === b.projected[0] && a.projected[1] === b.projected[1];

/** Archive Light's reveal is running (specials.ts REVEAL_KEY in the player's cooldown table): no intent is hidden. */
export const intentsRevealed = (combat: CombatState): boolean => (combat.cooldowns[REVEAL_KEY] ?? 0) > 0;

function unhide(ctx: StepCtx, combat: CombatState, c: Combatant, intent: Intent): void {
  intent.hidden = false;
  const name = ctx.content.creatures[c.refId]?.moves[intent.moveId]?.name ?? intent.moveId;
  combatLog(combat, `${c.name}'s intent clears: ${name}.`, 'intent');
}

/** Archive Light's cast: every living enemy's hidden intent becomes fully visible now; `intentRevealed` for each. */
export function revealIntents(ctx: StepCtx, combat: CombatState): void {
  for (const c of combat.enemies) {
    const intent = combat.intents[c.uid];
    if (!intent || !intent.hidden || !isActive(c)) continue;
    unhide(ctx, combat, c, intent);
    ctx.emit({ t: 'intentRevealed', uid: c.uid, intent: copyOf(intent) });
  }
}

/**
 * At the start of the player's turn: every stored intent is re-aimed and re-projected against the current state (the
 * move is never re-chosen), and a hidden one whose creature acts before the player's next turn — or any, while Archive
 * Light's reveal runs — is revealed (DESIGN §4.2, §12.4). Emits `intentRevealed` for each chip that changed.
 */
export function refreshIntents(ctx: StepCtx, combat: CombatState): void {
  for (const c of combat.enemies) {
    const intent = combat.intents[c.uid];
    if (!intent || !isActive(c)) continue;
    const before = copyOf(intent);
    const aim = aimOfIntent(combat, c, intent);
    if (aim === 'single' || aim === 'ally') {
      const t = intentTarget(combat, c, intent);
      intent.targetUid = t === null || t === c ? null : t.uid;
    }
    intent.projected = projectIntent(ctx, combat, c, intent);
    // U34e: an unlit creature's chip stays hidden until it is struck; then it shows as any other (its own hidden moves aside)
    const unlit = unlitNow(ctx, c);
    const struck = !unlit && hasCreatureTag(ctx, c, UNLIT_TAG) && !(ctx.content.creatures[c.refId]?.moves[intent.moveId]?.hidden ?? false);
    if (intent.hidden && (intentsRevealed(combat) || (actsBeforePlayerAgain(ctx, combat, c) && !unlit) || struck)) unhide(ctx, combat, c, intent);
    if (!sameChip(before, intent)) ctx.emit({ t: 'intentRevealed', uid: c.uid, intent: copyOf(intent) });
  }
}

// ---- execution -------------------------------------------------------------------------------------------------------------

/** The scale of a move's Shield or heal (`hits` is not part of it). */
const scaleOf = (p: NonNullable<Move['power']>): { base: number; coef: number; stat: 'atk' | 'sp' } => ({ base: p.base, coef: p.coef, stat: p.stat });

function heal(ctx: StepCtx, combat: CombatState, c: Combatant, moveId: string, h: NonNullable<Move['heal']>, aimed: Combatant | null): void {
  const side = sideOf(combat, c).filter(isActive);
  let target = c;
  if (h.target === 'ally') target = aimed && aimed !== c && side.includes(aimed) ? aimed : pickAlly(combat, c);
  else if (h.target === 'lowest_ally') target = side.reduce((a, b) => (hpFraction(b) < hpFraction(a) ? b : a), c);
  const r = resolveHeal(ctx, c, target, scaleOf(h.power));
  target.hp += r.amount;
  if (r.amount > 0) ctx.emit({ t: 'healed', targetUid: target.uid, amount: r.amount, source: moveId });
  combatLog(combat, `${target.name} recovers ${r.amount} HP.`, 'heal');
}

/** DESIGN §4.2 `summon`: up to `count`, never more than `max` of that creature alive, nor 3 enemies; each add gets its first intent. */
function summon(ctx: StepCtx, combat: CombatState, c: Combatant, sm: NonNullable<Move['summon']>): void {
  const def = ctx.content.creatures[sm.creatureId];
  const alive = combat.enemies.filter(isActive);
  const room = Math.min(sm.count, sm.max - alive.filter((e) => e.refId === sm.creatureId).length, MAX_ENEMIES - alive.length);
  if (!def || room <= 0) {
    combatLog(combat, `Nothing answers ${c.name}'s call.`, 'info');
    return;
  }
  const adds: Combatant[] = [];
  for (let i = 0; i < room; i++) {
    const n = combat.enemies.filter((e) => e.refId === sm.creatureId).length;
    const add = enemyCombatant(ctx, sm.creatureId, n === 0 ? def.name : `${def.name} ${String.fromCharCode(65 + n)}`);
    add.isAdd = true;
    add.hp = Math.max(1, Math.min(add.hpMax, roundHalfUp(add.hpMax * sm.hpPct)));
    combat.enemies.push(add);
    ctx.s.counters.seen[sm.creatureId] = (ctx.s.counters.seen[sm.creatureId] ?? 0) + 1;
    adds.push(add);
  }
  ctx.emit({ t: 'addsSummoned', uids: adds.map((a) => a.uid) });
  combatLog(combat, `${adds.map((a) => a.name).join(' and ')} answer${adds.length === 1 ? 's' : ''} ${c.name}'s call.`, 'info');
  for (const add of adds) generateIntent(ctx, combat, add);
}

/** `revive`: the first fallen ally (slot order) stands up at `hpPct` of its max HP, statuses cleared, with a new intent. */
function revive(ctx: StepCtx, combat: CombatState, c: Combatant, moveId: string, hpPct: number): void {
  const fallen = sideOf(combat, c).find((o) => o !== c && !o.alive && !o.fledOrGone);
  if (!fallen) {
    combatLog(combat, `${c.name} calls, but no one is down.`, 'info');
    return;
  }
  Object.assign(fallen, { alive: true, hp: Math.max(1, roundHalfUp(fallen.hpMax * hpPct)), statuses: [], guarding: false });
  ctx.emit({ t: 'healed', targetUid: fallen.uid, amount: fallen.hp, source: moveId });
  combatLog(combat, `${fallen.name} stands up again (${fallen.hp} HP).`, 'heal');
  if (fallen.kind === 'enemy') generateIntent(ctx, combat, fallen);
}

/**
 * The enemy turn's action (DESIGN §4.1, §4.2): plays the stored intent and consumes it — see the file header for the
 * order. No intent (cancelled, holding, unknown creature or move): it holds still. Returns the intent played. `more` is
 * the reducer's resource operations for the U26 parts (counter-hits, drains); tests may leave it out.
 */
export function executeIntent(ctx: StepCtx, combat: CombatState, c: Combatant, applyHit: HitApplier, more?: Omit<CombatOps, 'applyHit'>): Intent | null {
  const intent = combat.intents[c.uid] ?? null;
  delete combat.intents[c.uid];
  const move = intent ? ctx.content.creatures[c.refId]?.moves[intent.moveId] : undefined;
  if (!intent || !move) {
    breakWindUp(c); // a wind-up whose intent was cancelled is broken
    combatLog(combat, `${c.name} holds still.`, 'info');
    return null;
  }
  if (move.windUp && windUpKeyOf(c) === undefined) c.cooldowns[`${WIND_UP_KEY}${intent.moveId}`] = move.windUp.turns + 1; // its turn end takes one

  const aim = aimOfIntent(combat, c, intent);
  const spec = typed(ctx, combat, move, intentHitSpec(intent.moveId, move, aim === 'all'));
  const aimed = intentTarget(combat, c, intent);
  notePlayed(combat, c, intent); // U34e: what a `repeatPrevious` move repeats
  c.pattern.firedOnce = c.pattern.firedOnce.filter((t) => t !== `${FORCED_TAG}${intent.moveId}`); // a forced move, played
  const struck = aim === 'all' ? foesOf(combat, c).filter(isActive) : aimed ? [aimed] : [];
  const evalRow: WhenEval = (when, recipient) =>
    evalCombatWhen(ctx, combat, when, { self: c, target: recipient, turn: c.pattern.turnsTaken + 1, round: combat.round });
  const targetRows = move.statuses.filter((row) => row.target === 'target');
  const otherRows = move.statuses.filter((row) => row.target !== 'target');
  const ops: CombatOps = { applyHit, gainResource: more?.gainResource ?? (() => 0), addMp: more?.addMp ?? (() => 0) };
  const use = beginMove(ctx, combat, ops, c, intent.moveId, move, aimed, struck, spec); // U26: the special's `before`
  if (!spec) combatLog(combat, `${c.name}: ${move.line}`, 'intent');
  if (replaceMove(use, move)) return intent; // U26: hour_presses, bound_mage

  const hits = moveHits(move);
  for (const t of struck) {
    let landed = spec === null;
    if (move.missesIfGuarded && t.guarding) {
      // U34e (D-094): "misses entirely if you Guard" — no damage, no status
      combatLog(combat, `${t.name} braces: ${move.name} misses entirely.`, 'damage');
      if (spec) applyHit(ctx, combat, c, t, spec, GUARDED_MISS, 'intent');
      continue;
    }
    for (let h = 0; spec && h < hits && isActive(t) && isActive(c); h++) {
      const r = resolveHit(ctx, c, t, spec);
      applyHit(ctx, combat, c, t, spec, r, 'intent');
      landed ||= r.hit && !r.immune;
    }
    if (landed && isActive(t) && isActive(c) && targetRows.length > 0) applyStatusRows(ctx, combat, c, t, targetRows, evalRow);
  }
  if (!isActive(c)) return intent;
  if (move.cleanseSelf) {
    const debuffs = c.statuses.filter((st) => ctx.content.statuses[st.statusId]?.kind === 'debuff').map((st) => st.statusId);
    cleanse(ctx, combat, c, debuffs);
  }
  if (move.consumesAlly !== undefined) consumeAlly(combat, c, move.consumesAlly); // U34e (D-096): "consumes the toad"
  if (move.heal) heal(ctx, combat, c, intent.moveId, move.heal, aimed);
  if (move.shield) applyStatus(ctx, combat, c, c, STATUS.shield, { power: scaleOf(move.shield.power) });
  if (move.shieldAlly) {
    const ally = aim === 'ally' && aimed ? aimed : pickAlly(combat, c);
    applyStatus(ctx, combat, c, ally, STATUS.shield, { power: scaleOf(move.shieldAlly.power) });
  }
  if (otherRows.length > 0) applyStatusRows(ctx, combat, c, aimed, otherRows, evalRow);
  if (move.summon) summon(ctx, combat, c, move.summon);
  if (move.revive) revive(ctx, combat, c, intent.moveId, move.revive.hpPct);
  finishMove(use, move); // U26: special `after`, stripBuffs, healOnDamage, riposte
  if (move.clockCost && isActive(c)) payClock(ctx, combat, c, intent.moveId, move.clockCost); // U34e (D-092): the Hour Leech
  if (isActive(c) && (move.leaveCombat || move.effects.some((e) => 'leaveCombat' in e))) withdrawFromCombat(combat, c);
  return intent;
}

/**
 * D-069.9 `leaveCombat` (a move's, or a boss phase's onEnter): `c` withdraws — out of the fight (`fledOrGone`), its
 * intent and wind-up dropped, statuses gone; no XP, no loot, not a kill. A fight whose enemies are all down or gone is won.
 */
export function withdrawFromCombat(combat: CombatState, c: Combatant): void {
  if (!isActive(c)) return;
  c.fledOrGone = true;
  c.guarding = false;
  c.statuses = [];
  breakWindUp(c);
  delete combat.intents[c.uid];
  combatLog(combat, `${c.name} withdraws from the fight.`, 'info');
}
