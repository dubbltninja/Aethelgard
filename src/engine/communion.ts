// Communion — talking the Unveiled Tyrant down (DESIGN §4.11; STORY §8.3, §8.5, §10.1/10.2/10.6; WORLD §6.8; PLAN §4.11
// "Communion", §8.1 row "communion"; D-054, D-066 #6, D-067.3, D-069.8, D-079).
//
// State: `CombatState.communion` (null while nobody is communing). Data: the creature's `communion` spec — three Movements
// mirroring the phases `tyr_movement_1..3`, their questions and Echo-gated answers, each Movement's Listen fragment, the
// offers, the press move and the outcomes. The encounter screen stays the combat screen.
//
// Opening. Against a standing creature with a spec, from Loop 2, while it is in a phase that mirrors a Movement (none in
// the Unveiled's Phase 4), and only on the player's first turn of the fight or the first player turn after the creature
// entered a new phase (STORY §8.4 "at any phase transition"): `communionTurnStart` sets `commune:window` in the fight's
// cooldown table, which the player's turn end clears. Never again in a fight where it rejected the player.
//   Commune (`toggle`, free)  when one of `opensWith` holds (`echo_tyrant_speaks`)
//   Listen (the turn)         always (STORY §8.3, C-07: "or from the moment the player chooses Listen")
// It opens at the Movement mirroring the phase (Movement II at least once `echo_tyrant_rejected` is held, STORY §8.5),
// with Resolve 1 (D-066 #6), `world.tyrant` 'communing', and the creature's pattern paused: its intent is the question.
//
// Rhythm. While communing, the creature's turns alternate the current question (a pseudo-intent: `moveId` = the question
// id, tag 'question', no damage) and the press (`pressMove`; D-067.3: Chrono 8 % of the player's max HP × (1 − Resolve/8)
// through the resistance step only, never below 1 HP while Resolve ≥ 3 — the same formula as specials.ts
// `hour_presses`). The current question (`questionIndex` in the Movement) stays current until it is answered (Speak) or
// forfeited: any player action that strikes or debuffs an enemy skips it unanswered (D-067.3). A Movement ends when its
// last question is resolved. A companion stands down and Guards — except Dask or Caelum in Support stance, whose first
// turn in each Movement adds +1. Adds already in the fight keep their own patterns. A phase entered meanwhile (the player's
// blows, a `communionMovementEnd` trigger) does not change the Movement; a phase with no Movement closes the communion.
//
// The dialogue actions (each costs the turn):
//   Speak   an answer of the current question whose `when` holds, each answer id once per encounter: its `resolve`
//           (+1 Echo answer, +2 Hallow's silence / Masque's perfect answer, +1 the honest "to kill you", −2 a lie). A
//           second lie is an immediate rejection. An answer gated on Corruption (Korr) costs −1 as the next asker comes.
//   Listen  +1 once per Movement; the Movement's `listen.effects` (its codex fragments) and `echo_tyrant_speaks`; no
//           lash (D-069.8) — its cost is that the next press is not softened by Resolve (REVIEW-STORY-WORLD #4, STORY §8.3).
//   Offer   an `offers` item the player holds, each once per encounter, never consumed (D-067.3): its `resolve` and effects.
//   Resist  +0; the player Guards (and gains the class Guard resource).
// Every gain is +1 more while the creature is below 30 % HP ("it is tired"). Resolve is clamped to 0–8 after every change;
// each change emits `resolveChanged`. The first time in a loop it reaches 4, the Breach Clock limit gains 8 watches
// (`flag_tyrant_steadied`, a run flag; `clockBonusGranted` mirrors it).
//
// End of a Movement (`movementEnded`): after II and III, Resolve < 3 is a rejection; after I and II the next Movement
// starts (Listen and Support again) and `communionMovementEnd` is reported to the phase triggers (phases.ts).
// Rejection (`communionRejected`, 'resolve' | 'lies'): the communion is over for this fight; combat resumes at Phase 2
// (the creature enters `tyr_movement_2` if it is not past it — phases never go backwards — else its pattern restarts),
// or the player may leave: `flee` becomes legal, closing the loop as `closer_fall` / `rejected` with
// `echo_tyrant_rejected` (reducers/combat.ts `finishLeft`).
// End of Movement III with Resolve ≥ 3: the creature is spared — `flag_tyrant_spared`, `world.tyrant` 'spared', the
// bestiary's `recordSpared` (no bestiary event, D-079), `tyrantResolved` — and the fight holds on the player's turn for
// the Resolution: Speak now takes an outcome `choiceId` whose `minResolve` and `when` hold (F ≥ 3, A ≥ 6, B = 8 with
// D-054's requirements are data). Its effects apply while the communion is still readable (so `{ resolve }` in an
// ending's requirements holds when its `ending` effect fires); then the fight closes (reducers/combat.ts `finishSpared`).
// Nothing else is legal meanwhile (combat.ts `playerTurnCombat`). With no outcome to offer, the fight closes at once.
import { COMMUNION_MOVEMENTS, RESOLVE_MAX as RESOLVE_TOP, RESOLVE_MIN as RESOLVE_BOTTOM, type CommunionSpec } from '@schema/creature';
import type { Condition } from '@schema/condition';
import { atomOf, evaluate, hasEcho, itemCount } from './conditions';
import type { ContentPack, StepCtx } from './ctx';
import { apply, applyAll } from './effects';
import type { ActionOf } from './types/actions';
import type { Profile } from './types/profile';
import type { Combatant, CombatState, CommunionState, GameState, Intent } from './types/state';
import { clamp } from './util/math';
import { resolveTick, type HitSpec } from './combat/damage';
import { WIND_UP_KEY, resetPattern } from './combat/intents';
import { enterPhase, phaseEvent, phasesOf } from './combat/phases';
import { recordSpared } from './combat/rewards';
import { HOUR_PRESSES_PCT, HOUR_PRESSES_RESOLVE_MAX, HOUR_PRESSES_SPARE_RESOLVE, fixedHit, type CombatOps } from './combat/specials';
import { stanceOf } from './combat/companionAi';
import { blocksAction } from './combat/statuses';
import { combatLog, isActive, playerOf } from './combat/turnOrder';

type Movement = CommunionSpec['movements'][number];
type Question = Movement['questions'][number];
type Answer = Question['answers'][number];
type Outcome = CommunionSpec['outcomes'][number];
type MovementNo = CommunionState['movement'];

/** Resolve when the communion opens (D-066 #6). */
export const COMMUNION_RESOLVE_START = 1;
/** Listen: +1 once per Movement. */
export const COMMUNION_LISTEN_GAIN = 1;
/** A companion in Support stance: +1 once per Movement, Dask or Caelum only (WORLD §6.8). */
export const COMMUNION_SUPPORT_GAIN = 1;
export const COMMUNION_SUPPORT_COMPANIONS: readonly string[] = ['dask', 'caelum'];
/** "It is tired": below 30 % of its HP every gain is +1 more. */
export const COMMUNION_TIRED_BELOW = 0.3;
export const COMMUNION_TIRED_BONUS = 1;
/** Rejection at the end of Movements II and III below this; outcomes need at least it (F). */
export const COMMUNION_REJECT_BELOW = 3;
/** The second lie rejects at once. */
export const COMMUNION_LIES_REJECT = 2;
/** The first time in a loop Resolve reaches 4, the Breach Clock gains 8 watches (+2 days, DESIGN §10.1). */
export const COMMUNION_STEADY_AT = 4;
export const COMMUNION_STEADY_WATCHES = 8;
/** Corruption ≥ 3 satisfies Korr but costs −1 at the next asker (STORY §8.3). */
export const COMMUNION_CORRUPTION_COST = 1;
/** Combat resumes at this phase after a rejection (STORY §8.5: "Combat begins at Phase 2 with no Phase 1"). */
export const COMMUNION_REJECTION_PHASE = 'tyr_movement_2';
export const ECHO_TYRANT_SPEAKS = 'echo_tyrant_speaks';
export const ECHO_TYRANT_REJECTED = 'echo_tyrant_rejected';
export const FLAG_TYRANT_SPARED = 'flag_tyrant_spared';
/** Run flag: the communion's clock bonus was paid this loop. */
export const FLAG_TYRANT_STEADIED = 'flag_tyrant_steadied';
/** The question pseudo-intent's tag. */
export const TAG_QUESTION = 'question';
/** The press chip's tag while Resolve ≥ 3. */
export const TAG_CANNOT_KILL = 'cannot kill';
/** The fight's (player) cooldown table: communion may open this turn. Cleared by the player's turn end. */
export const COMMUNE_WINDOW_KEY = 'commune:window';
/** The creature's `pattern.firedOnce` markers: a phase the player has had a turn in; rejected in this fight; the next press is full. */
export const COMMUNE_SEEN_KEY = 'commune:seen:';
export const COMMUNE_REJECTED_KEY = 'commune:rejected';
export const COMMUNE_FULL_PRESS_KEY = 'commune:full_press';

/** What a dialogue action did to the player's turn: goes on (free), ends, holds for the Resolution, or closed the fight. */
export type CommuneResult = 'free' | 'turn' | 'hold' | 'chosen';

// ---- reading ---------------------------------------------------------------------------------------------------------------

/** The fight's communing creature (the first standing enemy whose creature has a communion spec) and its spec. */
export function communionBoss(content: ContentPack, combat: CombatState): { boss: Combatant; spec: CommunionSpec } | null {
  for (const e of combat.enemies) {
    const spec = content.creatures[e.refId]?.communion;
    if (spec && isActive(e)) return { boss: e, spec };
  }
  return null;
}

/** The Movement (1–3) mirroring the creature's current phase, or null for a phase without one (the Unveiled's Phase 4). */
export function movementOfPhase(content: ContentPack, boss: Combatant): MovementNo | null {
  const id = phasesOf(content, boss)[boss.phase]?.id;
  const i = (COMMUNION_MOVEMENTS as readonly string[]).indexOf(id ?? '');
  return i < 0 ? null : ((i + 1) as MovementNo);
}

const movementOf = (spec: CommunionSpec, communion: CommunionState): Movement => spec.movements[communion.movement - 1] as Movement;

/** The current question (undefined once the Movement's questions are all resolved: the Resolution). */
export const currentQuestion = (spec: CommunionSpec, communion: CommunionState): Question | undefined =>
  movementOf(spec, communion).questions[communion.questionIndex];

/** The Resolution: Movement III is over, the creature is spared, the player picks an outcome. */
export const communionResolving = (s: GameState): boolean => s.combat?.communion != null && s.world.tyrant === 'spared';

/** Rejected the player in this fight: the communion cannot reopen, and the player may leave (`flee`). */
export const communionRejected = (combat: CombatState): boolean =>
  combat.communion === null && combat.enemies.some((e) => isActive(e) && e.pattern.firedOnce.includes(COMMUNE_REJECTED_KEY));

/** A communion is running against a creature standing in this fight. */
export const communing = (content: ContentPack, combat: CombatState): boolean => combat.communion !== null && communionBoss(content, combat) !== null;

/** Is `actor` the communing creature of a running communion (its turn is a communion beat)? */
export const communes = (content: ContentPack, combat: CombatState, actor: Combatant): boolean =>
  combat.communion !== null && actor.kind === 'enemy' && content.creatures[actor.refId]?.communion !== undefined;

/** The outcomes offered now: `minResolve` ≤ Resolve and `when` holds. */
export function eligibleOutcomes(s: GameState, profile: Readonly<Profile>, content: ContentPack, spec: CommunionSpec, communion: CommunionState): Outcome[] {
  return spec.outcomes.filter((o) => communion.resolve >= o.minResolve && (o.when === undefined || evaluate(o.when, s, profile, content)));
}

/** The current question's answers the player can give: `when` holds, not given before in this encounter. */
export function availableAnswers(s: GameState, profile: Readonly<Profile>, content: ContentPack, spec: CommunionSpec, communion: CommunionState): Answer[] {
  const q = currentQuestion(spec, communion);
  return (q?.answers ?? []).filter((a) => !communion.usedAnswers.includes(a.id) && evaluate(a.when, s, profile, content));
}

/** The offers the player can make: held (pack, Satchel or equipped), not shown before in this encounter. */
export function availableOffers(s: GameState, spec: CommunionSpec, communion: CommunionState): CommunionSpec['offers'] {
  return spec.offers.filter((o) => !communion.usedAnswers.includes(o.itemId) && itemCount(s, o.itemId) > 0);
}

/** Does a condition read Corruption (Korr's corruption answer)? */
function readsCorruption(c: Condition): boolean {
  const [key, v] = atomOf<string>(c, 'Condition');
  if (key === 'corruption') return true;
  if (key === 'all' || key === 'any') return (v as Condition[]).some(readsCorruption);
  return key === 'not' && readsCorruption(v as Condition);
}

/**
 * The press against `target` now (no rng): 8 % of its max HP × (1 − Resolve/8) — the full 8 % after a Listen — through
 * the Chrono resistance step; while Resolve ≥ 3 it stops at 1 HP.
 */
export function pressDamage(combat: CombatState, target: Combatant, full = false): { raw: number; amount: number; immune: boolean; steps: ReturnType<typeof resolveTick>['steps'] } {
  const resolve = combat.communion?.resolve ?? 0;
  const raw = HOUR_PRESSES_PCT * target.hpMax * (full ? 1 : 1 - resolve / HOUR_PRESSES_RESOLVE_MAX);
  const tick = raw > 0 ? resolveTick(target, raw, 'chrono') : { amount: 0, immune: false, steps: [{ name: 'tick', value: 0 }] };
  const amount = resolve >= HOUR_PRESSES_SPARE_RESOLVE ? Math.min(tick.amount, Math.max(0, target.hp - 1)) : tick.amount;
  return { raw, amount, immune: tick.immune, steps: tick.steps };
}

const fullPress = (boss: Combatant): boolean => boss.pattern.firedOnce.includes(COMMUNE_FULL_PRESS_KEY);

// ---- the creature's intent ---------------------------------------------------------------------------------------------------

const copyIntent = (i: Intent): Intent => ({ ...i, projected: [i.projected[0], i.projected[1]], tags: [...i.tags] });
const sameIntent = (a: Intent | undefined, b: Intent): boolean =>
  a !== undefined && a.moveId === b.moveId && a.targetUid === b.targetUid && a.text === b.text && a.projected[0] === b.projected[0] && a.projected[1] === b.projected[1] && a.tags.join() === b.tags.join();

function store(ctx: StepCtx, combat: CombatState, boss: Combatant, intent: Intent): void {
  if (sameIntent(combat.intents[boss.uid], intent)) return;
  combat.intents[boss.uid] = intent;
  ctx.emit({ t: 'intentRevealed', uid: boss.uid, intent: copyIntent(intent) });
}

function questionIntent(combat: CombatState, q: Question): Intent {
  return { moveId: q.id, targetUid: playerOf(combat).uid, projected: [0, 0], hidden: false, text: q.line, tags: [TAG_QUESTION] };
}

function pressIntent(ctx: StepCtx, combat: CombatState, boss: Combatant, spec: CommunionSpec): Intent {
  const player = playerOf(combat);
  const { amount } = pressDamage(combat, player, fullPress(boss));
  const resolve = combat.communion?.resolve ?? 0;
  const line = ctx.content.creatures[boss.refId]?.moves[spec.pressMove]?.line ?? '';
  return { moveId: spec.pressMove, targetUid: player.uid, projected: [amount, amount], hidden: false, text: line, tags: resolve >= HOUR_PRESSES_SPARE_RESOLVE ? [TAG_CANNOT_KILL] : [] };
}

/**
 * Keeps the creature's intent a communion beat: a press stays a press (re-projected: Resolve or the player's HP moved);
 * anything else — the question, or a combat intent a phase change or an interrupt put there — shows the current question.
 * No intent during the Resolution.
 */
export function syncCommunionIntent(ctx: StepCtx, combat: CombatState, boss: Combatant, spec: CommunionSpec): void {
  const communion = combat.communion;
  if (!communion) return;
  const q = currentQuestion(spec, communion);
  if (ctx.s.world.tyrant === 'spared' || !q) {
    delete combat.intents[boss.uid];
    return;
  }
  const isPress = combat.intents[boss.uid]?.moveId === spec.pressMove;
  store(ctx, combat, boss, isPress ? pressIntent(ctx, combat, boss, spec) : questionIntent(combat, q));
}

// ---- Resolve -----------------------------------------------------------------------------------------------------------------

/** The first time in a loop Resolve reaches 4: +8 watches on the Breach Clock limit (DESIGN §10.1, §4.11). */
function steady(ctx: StepCtx, combat: CombatState): void {
  const communion = combat.communion;
  if (!communion || communion.resolve < COMMUNION_STEADY_AT || ctx.s.flags[FLAG_TYRANT_STEADIED] === true) return;
  ctx.s.flags[FLAG_TYRANT_STEADIED] = true;
  communion.clockBonusGranted = true;
  combatLog(combat, 'The hour steadies when it is heard.', 'phase');
  apply({ clockWatches: COMMUNION_STEADY_WATCHES }, ctx, { source: 'communion' });
}

/** Moves Resolve by `delta` (clamped 0–8), emits `resolveChanged`, then the clock bonus. */
function changeResolve(ctx: StepCtx, combat: CombatState, delta: number, reason: string): void {
  const communion = combat.communion as CommunionState;
  const before = communion.resolve;
  communion.resolve = clamp(before + delta, RESOLVE_BOTTOM, RESOLVE_TOP);
  ctx.emit({ t: 'resolveChanged', delta: communion.resolve - before, value: communion.resolve, movement: communion.movement, reason });
  steady(ctx, combat);
}

/** A Resolve change from an action: a gain is +1 more while the creature is below 30 % HP ("it is tired"). */
function gain(ctx: StepCtx, combat: CombatState, boss: Combatant, delta: number, reason: string): void {
  const tired = delta > 0 && boss.hp < COMMUNION_TIRED_BELOW * boss.hpMax;
  if (tired) combatLog(combat, `${boss.name} is tired.`, 'info');
  changeResolve(ctx, combat, delta + (tired ? COMMUNION_TIRED_BONUS : 0), tired ? `${reason}:tired` : reason);
}

// ---- opening -----------------------------------------------------------------------------------------------------------------

/** Why the communion cannot open now (null: it can). `how`: the free Commune toggle, or Listen as the opener. */
export function openProblem(s: GameState, content: ContentPack, profile: Readonly<Profile>, combat: CombatState, how: 'toggle' | 'listen'): string | null {
  if (combat.communion !== null) return 'You are already communing';
  const cb = communionBoss(content, combat);
  if (!cb) return 'There is nothing here that would listen';
  if (s.meta.loop < 2) return 'It cannot hear you yet';
  if (cb.boss.pattern.firedOnce.includes(COMMUNE_REJECTED_KEY)) return 'It will not listen to you again in this fight';
  if (movementOfPhase(content, cb.boss) === null) return 'The hold is failing; there is nothing left to say';
  if ((combat.cooldowns[COMMUNE_WINDOW_KEY] ?? 0) <= 0) return 'Communion opens only on your first turn or at a phase transition';
  if (how === 'toggle' && !cb.spec.opensWith.some((c) => evaluate(c, s, profile, content))) return 'You do not know how to speak to it yet';
  return null;
}

/** Opens the communion (see the file header): Resolve 1, the Movement mirroring the phase, the first question as the intent. */
function openCommunion(ctx: StepCtx, combat: CombatState, boss: Combatant, spec: CommunionSpec): CommunionState {
  const mirrored = movementOfPhase(ctx.content, boss) as MovementNo;
  const movement = (hasEcho(ctx.s, ctx.profile, ECHO_TYRANT_REJECTED) ? Math.max(2, mirrored) : mirrored) as MovementNo;
  const communion: CommunionState = {
    movement,
    resolve: COMMUNION_RESOLVE_START,
    questionIndex: 0,
    answered: [],
    usedAnswers: [],
    lies: 0,
    listened: false,
    supportUsed: false,
    clockBonusGranted: ctx.s.flags[FLAG_TYRANT_STEADIED] === true,
  };
  combat.communion = communion;
  ctx.s.world.tyrant = 'communing';
  for (const key of Object.keys(boss.cooldowns)) if (key.startsWith(WIND_UP_KEY)) delete boss.cooldowns[key]; // its pattern pauses
  combatLog(combat, `${boss.name} goes still and listens. Movement ${movement}.`, 'phase');
  ctx.emit({ t: 'resolveChanged', delta: 0, value: communion.resolve, movement, reason: 'open' });
  delete combat.intents[boss.uid];
  syncCommunionIntent(ctx, combat, boss, spec);
  return communion;
}

// ---- the end of a question, a Movement, the communion -----------------------------------------------------------------------

/** Closes the communion without an outcome (a rejection, a phase without a Movement, the creature down). */
function closeCommunion(ctx: StepCtx, combat: CombatState): void {
  combat.communion = null;
  if (ctx.s.world.tyrant === 'communing') ctx.s.world.tyrant = 'waiting';
}

/** Rejection (STORY §8.5): over for this fight; combat resumes at Phase 2, or the player may leave (`flee`). */
function reject(ctx: StepCtx, combat: CombatState, boss: Combatant, reason: 'resolve' | 'lies'): void {
  ctx.emit({ t: 'communionRejected', reason });
  combatLog(combat, `${boss.name} turns from you. The communion is over.`, 'phase');
  boss.pattern.firedOnce.push(COMMUNE_REJECTED_KEY);
  boss.pattern.firedOnce = boss.pattern.firedOnce.filter((k) => k !== COMMUNE_FULL_PRESS_KEY);
  closeCommunion(ctx, combat);
  const resume = phasesOf(ctx.content, boss).findIndex((p) => p.id === COMMUNION_REJECTION_PHASE);
  if (resume > boss.phase) enterPhase(ctx, combat, boss, resume);
  else resetPattern(ctx, combat, boss);
}

/** The end of Movement III with Resolve ≥ 3: the creature is spared; the Resolution follows ('hold'), or closes at once. */
function spare(ctx: StepCtx, combat: CombatState, boss: Combatant, spec: CommunionSpec): CommuneResult {
  const { s } = ctx;
  s.world.tyrant = 'spared';
  s.flags[FLAG_TYRANT_SPARED] = true;
  delete combat.intents[boss.uid];
  boss.guarding = false;
  recordSpared(ctx, boss.refId); // the bestiary's spared count; no bestiary event (D-079)
  ctx.emit({ t: 'tyrantResolved', outcome: 'spared' });
  combatLog(combat, `${boss.name} is spared. It waits for your answer.`, 'phase');
  return eligibleOutcomes(s, ctx.profile, ctx.content, spec, combat.communion as CommunionState).length > 0 ? 'hold' : 'chosen';
}

/** A Movement's last question is resolved (see the file header). */
function endMovement(ctx: StepCtx, combat: CombatState, boss: Combatant, spec: CommunionSpec): CommuneResult {
  const communion = combat.communion as CommunionState;
  const m = communion.movement;
  ctx.emit({ t: 'movementEnded', movement: m, resolve: communion.resolve });
  combatLog(combat, `Movement ${m} ends (Resolve ${communion.resolve}).`, 'phase');
  if (m >= 2 && communion.resolve < COMMUNION_REJECT_BELOW) {
    reject(ctx, combat, boss, 'resolve');
    return 'turn';
  }
  if (m === 3) return spare(ctx, combat, boss, spec);
  Object.assign(communion, { movement: (m + 1) as MovementNo, questionIndex: 0, listened: false, supportUsed: false });
  phaseEvent(ctx, combat, 'communionMovementEnd'); // a content phase may follow the Movements (DESIGN §4.10 Trigger)
  if (combat.communion !== null && movementOfPhase(ctx.content, boss) === null) {
    closeCommunion(ctx, combat);
    return 'turn';
  }
  syncCommunionIntent(ctx, combat, boss, spec);
  return 'turn';
}

/** The current question is resolved (answered or forfeited): the next one, or the Movement's end. */
function nextQuestion(ctx: StepCtx, combat: CombatState, boss: Combatant, spec: CommunionSpec): CommuneResult {
  const communion = combat.communion as CommunionState;
  communion.questionIndex += 1;
  if (communion.questionIndex < movementOf(spec, communion).questions.length) {
    syncCommunionIntent(ctx, combat, boss, spec);
    return 'turn';
  }
  return endMovement(ctx, combat, boss, spec);
}

// ---- the dialogue actions ----------------------------------------------------------------------------------------------------

/** Why `a` is not a legal dialogue action now (null: it is). `combat` is the fight on the player's turn. */
export function communeProblem(s: GameState, content: ContentPack, profile: Readonly<Profile>, combat: CombatState, a: ActionOf<'commune'>): string | null {
  const communion = combat.communion;
  const cb = communionBoss(content, combat);
  if (communion === null || !cb) {
    if (a.act === 'toggle' || a.act === 'listen') return openProblem(s, content, profile, combat, a.act);
    return 'You are not communing';
  }
  if (s.world.tyrant === 'spared') {
    if (a.act !== 'speak') return 'Only your answer remains';
    return eligibleOutcomes(s, profile, content, cb.spec, communion).some((o) => o.choiceId === a.answerId) ? null : `'${String(a.answerId)}' is not offered`;
  }
  switch (a.act) {
    case 'toggle':
      return 'You are already communing';
    case 'speak':
      return availableAnswers(s, profile, content, cb.spec, communion).some((x) => x.id === a.answerId) ? null : `'${String(a.answerId)}' is not an answer you can give`;
    case 'listen':
      return communion.listened ? 'You have listened in this Movement' : null;
    case 'offer':
      return availableOffers(s, cb.spec, communion).some((o) => o.itemId === a.itemId) ? null : `'${String(a.itemId)}' is not something you can show it`;
    case 'resist':
      return null;
  }
}

/** Every legal dialogue action (the `commune` enumerator; `combat` is the fight on the player's turn). */
export function communeActions(s: GameState, content: ContentPack, profile: Readonly<Profile>, combat: CombatState): ActionOf<'commune'>[] {
  const communion = combat.communion;
  const cb = communionBoss(content, combat);
  if (communion === null || !cb) {
    return (['toggle', 'listen'] as const).filter((act) => openProblem(s, content, profile, combat, act) === null).map((act) => ({ type: 'commune', act }));
  }
  if (s.world.tyrant === 'spared') return eligibleOutcomes(s, profile, content, cb.spec, communion).map((o) => ({ type: 'commune', act: 'speak', answerId: o.choiceId }));
  const out: ActionOf<'commune'>[] = availableAnswers(s, profile, content, cb.spec, communion).map((x) => ({ type: 'commune', act: 'speak', answerId: x.id }));
  if (!communion.listened) out.push({ type: 'commune', act: 'listen' });
  for (const o of availableOffers(s, cb.spec, communion)) out.push({ type: 'commune', act: 'offer', itemId: o.itemId });
  out.push({ type: 'commune', act: 'resist' });
  return out;
}

function speak(ctx: StepCtx, combat: CombatState, boss: Combatant, spec: CommunionSpec, answerId: string): CommuneResult {
  const communion = combat.communion as CommunionState;
  const q = currentQuestion(spec, communion) as Question;
  const answer = q.answers.find((x) => x.id === answerId) as Answer;
  communion.usedAnswers.push(answer.id);
  communion.answered.push(q.id);
  combatLog(combat, `You answer: ${answer.text}`, 'info');
  gain(ctx, combat, boss, answer.resolve, `answer:${q.id}:${answer.id}`);
  if (answer.lie) {
    communion.lies += 1;
    combatLog(combat, `${boss.name} knows a lie when it hears one.`, 'info');
    if (communion.lies >= COMMUNION_LIES_REJECT) {
      reject(ctx, combat, boss, 'lies');
      return 'turn';
    }
  }
  const result = nextQuestion(ctx, combat, boss, spec);
  if (readsCorruption(answer.when) && result === 'turn' && combat.communion !== null && currentQuestion(spec, combat.communion)) {
    changeResolve(ctx, combat, -COMMUNION_CORRUPTION_COST, 'corruption'); // the next asker recoils (STORY §8.3)
    syncCommunionIntent(ctx, combat, boss, spec);
  }
  return result;
}

function listen(ctx: StepCtx, combat: CombatState, boss: Combatant, spec: CommunionSpec): CommuneResult {
  const communion = combat.communion as CommunionState;
  communion.listened = true;
  combatLog(combat, `You listen. ${boss.name} speaks of what it knows.`, 'info');
  gain(ctx, combat, boss, COMMUNION_LISTEN_GAIN, 'listen');
  apply({ grantEcho: ECHO_TYRANT_SPEAKS }, ctx, { source: 'communion:listen' });
  applyAll(movementOf(spec, communion).listen?.effects ?? [], ctx, { source: 'communion:listen' });
  if (!fullPress(boss)) boss.pattern.firedOnce.push(COMMUNE_FULL_PRESS_KEY); // its cost: the next press is not softened
  steady(ctx, combat);
  syncCommunionIntent(ctx, combat, boss, spec);
  return 'turn';
}

function offer(ctx: StepCtx, combat: CombatState, boss: Combatant, spec: CommunionSpec, itemId: string): CommuneResult {
  const communion = combat.communion as CommunionState;
  const row = spec.offers.find((o) => o.itemId === itemId) as CommunionSpec['offers'][number];
  communion.usedAnswers.push(itemId);
  combatLog(combat, `You show it the ${ctx.content.items[itemId]?.name ?? itemId}.`, 'info');
  gain(ctx, combat, boss, row.resolve, `offer:${itemId}`);
  applyAll(row.effects, ctx, { source: `communion:offer:${itemId}` });
  steady(ctx, combat);
  syncCommunionIntent(ctx, combat, boss, spec);
  return 'turn';
}

function resist(ops: CombatOps, ctx: StepCtx, combat: CombatState): CommuneResult {
  const player = playerOf(combat);
  if (!blocksAction(ctx.content, player, 'guard')) {
    player.guarding = true;
    ctx.emit({ t: 'guarded', uid: player.uid });
    ops.gainResource(ctx, combat, player, 'guard');
  }
  combatLog(combat, `${player.name} resists the hour.`, 'info');
  return 'turn';
}

/** Applies the chosen outcome's effects while the communion is still readable; the reducer then closes the fight. */
function choose(ctx: StepCtx, combat: CombatState, spec: CommunionSpec, choiceId: string): CommuneResult {
  const outcome = spec.outcomes.find((o) => o.choiceId === choiceId) as Outcome;
  combatLog(combat, `You choose: ${choiceId}.`, 'phase');
  applyAll(outcome.effects, ctx, { source: `communion:${choiceId}` });
  return 'chosen';
}

/** Plays a legal dialogue action (`communeProblem` returned null) and says what happens to the player's turn. */
export function commune(ops: CombatOps, ctx: StepCtx, combat: CombatState, a: ActionOf<'commune'>): CommuneResult {
  let cb = communionBoss(ctx.content, combat) as { boss: Combatant; spec: CommunionSpec };
  if (combat.communion === null) {
    openCommunion(ctx, combat, cb.boss, cb.spec);
    if (a.act === 'toggle') return 'free';
    cb = communionBoss(ctx.content, combat) as typeof cb;
  }
  const { boss, spec } = cb;
  if (ctx.s.world.tyrant === 'spared') return choose(ctx, combat, spec, a.answerId as string);
  switch (a.act) {
    case 'speak':
      return speak(ctx, combat, boss, spec, a.answerId as string);
    case 'listen':
      return listen(ctx, combat, boss, spec);
    case 'offer':
      return offer(ctx, combat, boss, spec, a.itemId as string);
    default:
      return resist(ops, ctx, combat);
  }
}

// ---- hooks the turn loop calls (reducers/combat.ts) ---------------------------------------------------------------------------

/**
 * At the start of each player turn (after the intents' refresh): the phase-transition window (the first player turn in
 * each phase of a Movement), then — while communing — a phase with no Movement closes it, else the creature's intent is
 * kept a communion beat.
 */
export function communionTurnStart(ctx: StepCtx, combat: CombatState): void {
  const cb = communionBoss(ctx.content, combat);
  if (!cb) return;
  const { boss, spec } = cb;
  const seen = `${COMMUNE_SEEN_KEY}${boss.phase}`;
  if (!boss.pattern.firedOnce.includes(seen)) {
    boss.pattern.firedOnce.push(seen);
    if (combat.communion === null && movementOfPhase(ctx.content, boss) !== null) combat.cooldowns[COMMUNE_WINDOW_KEY] = 1;
  }
  if (combat.communion === null || ctx.s.world.tyrant === 'spared') return;
  if (movementOfPhase(ctx.content, boss) === null) {
    combatLog(combat, 'The hold fails. There is nothing left to say.', 'phase');
    closeCommunion(ctx, combat);
    return;
  }
  syncCommunionIntent(ctx, combat, boss, spec);
}

/** Did the player's action this step strike or debuff an enemy (an attack, D-067.3)? */
function attackedThisStep(ctx: StepCtx, combat: CombatState): boolean {
  const party = new Set(combat.party.map((c) => c.uid));
  const enemies = new Set(combat.enemies.map((c) => c.uid));
  return ctx.events.some(
    (e) =>
      ((e.t === 'attackResolved' || e.t === 'damageDealt') && party.has(e.sourceUid) && enemies.has(e.targetUid)) ||
      (e.t === 'statusApplied' && enemies.has(e.targetUid) && ctx.content.statuses[e.statusId]?.kind === 'debuff'),
  );
}

/**
 * Before the player's turn ends: the communion follows what the action did — the creature down or gone closes it, a
 * phase with no Movement closes it, an attack forfeits the current question (which may end the Movement: a rejection, the
 * next Movement, or Movement III's end → 'hold' for the Resolution / 'chosen' with nothing to offer). Else 'go'.
 */
export function communionAfterAction(ctx: StepCtx, combat: CombatState): 'go' | 'hold' | 'chosen' {
  if (combat.communion === null || ctx.s.world.tyrant === 'spared') return 'go';
  const cb = communionBoss(ctx.content, combat);
  if (!cb) {
    // the creature is down or gone: the fight ends on its own (a kill ends in the Horde)
    if (combat.enemies.some((e) => ctx.content.creatures[e.refId]?.communion !== undefined)) closeCommunion(ctx, combat);
    return 'go';
  }
  const { boss, spec } = cb;
  if (movementOfPhase(ctx.content, boss) === null) {
    combatLog(combat, 'The hold fails. There is nothing left to say.', 'phase');
    closeCommunion(ctx, combat);
    return 'go';
  }
  if (attackedThisStep(ctx, combat)) {
    combatLog(combat, 'You strike instead of answering; the question goes unanswered.', 'info');
    const r = nextQuestion(ctx, combat, boss, spec);
    if (r === 'hold' || r === 'chosen') return r;
  }
  if (combat.communion !== null) syncCommunionIntent(ctx, combat, boss, spec);
  return 'go';
}

/**
 * The communing creature's turn (instead of its intent; reducers/combat.ts): a question beat asks (no damage), a press
 * beat presses the player (the full 8 % once after a Listen); then `endTurn`; then the other beat is its next intent.
 */
export function communionBossTurn(ops: CombatOps, ctx: StepCtx, combat: CombatState, boss: Combatant, endTurn: () => void): void {
  const cb = communionBoss(ctx.content, combat);
  const communion = combat.communion;
  if (!cb || !communion) {
    endTurn();
    return;
  }
  const { spec } = cb;
  const press = combat.intents[boss.uid]?.moveId === spec.pressMove;
  delete combat.intents[boss.uid];
  const player = playerOf(combat);
  if (press && isActive(player)) {
    const move = ctx.content.creatures[boss.refId]?.moves[spec.pressMove];
    const full = fullPress(boss);
    boss.pattern.firedOnce = boss.pattern.firedOnce.filter((k) => k !== COMMUNE_FULL_PRESS_KEY);
    combatLog(combat, `${boss.name}: ${move?.line ?? spec.pressMove}`, 'intent');
    const hit = pressDamage(combat, player, full);
    const hitSpec: HitSpec = { source: spec.pressMove, type: move?.type ?? 'chrono', base: hit.raw, coef: 0, stat: 'sp', cannotMiss: true };
    ops.applyHit(ctx, combat, boss, player, hitSpec, fixedHit(hit.amount, hit.immune, hit.steps), 'intent');
  } else {
    const q = currentQuestion(spec, communion);
    combatLog(combat, `${boss.name}: ${q?.line ?? '…'}`, 'intent');
  }
  endTurn();
  if (combat.communion === null || !isActive(boss) || !isActive(playerOf(combat))) return;
  const q = currentQuestion(spec, combat.communion);
  if (!q) return;
  store(ctx, combat, boss, press ? questionIntent(combat, q) : pressIntent(ctx, combat, boss, spec));
}

/** A companion's turn while communing: Dask or Caelum in Support stance add +1 once per Movement; anyone else Guards. */
export function communionCompanionTurn(ctx: StepCtx, combat: CombatState, me: Combatant): void {
  const communion = combat.communion;
  const cb = communionBoss(ctx.content, combat);
  if (communion && cb && !communion.supportUsed && COMMUNION_SUPPORT_COMPANIONS.includes(me.refId) && stanceOf(ctx.s, me) === 'support') {
    communion.supportUsed = true;
    combatLog(combat, `${me.name} speaks for you.`, 'info');
    gain(ctx, combat, cb.boss, COMMUNION_SUPPORT_GAIN, `support:${me.refId}`);
    syncCommunionIntent(ctx, combat, cb.boss, cb.spec);
    return;
  }
  me.guarding = true;
  ctx.emit({ t: 'guarded', uid: me.uid });
  combatLog(combat, `${me.name} stands down and guards.`, 'info');
}

/** Leaving after a rejection (STORY §8.5): `echo_tyrant_rejected`, then the loop closes as `closer_fall` / `rejected`. */
export function leaveRejected(ctx: StepCtx): void {
  apply({ grantEcho: ECHO_TYRANT_REJECTED }, ctx, { source: 'communion:rejected' });
  apply({ endLoop: { closer: 'closer_fall', reason: 'rejected' } }, ctx, { source: 'communion:rejected' });
}
