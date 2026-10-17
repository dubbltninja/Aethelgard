// The Threshold (U31; DESIGN §10.6–10.9, §14.2, §15.1; STORY §10.7; D-011, D-012, D-021, D-049, D-067.15, D-082;
// PLAN §4.11, §8.1). U30 lands the Wayfinder here after the last slide of a Loop 2+ closer or ending: the state is
// already the next loop's fresh run (reducers/loop.ts `nextLoopState`) in threshold mode at the Still Shore, with the
// pending outcome kept. The four places and what they hold:
//   Still Shore    STORY §10.7's shore, the last run's summary line, the Echoes it gained and the Resonance to spend
//                  (log lines from `thresholdPostStep`; the screens read the profile's last RunRecord)
//   Gallery        nothing to do: run history, achievements and the timeline are read from the profile
//   the Loom       thresholdSpend (buy an Attunement: Resonance ≥ cost and its `requires`; owned forever),
//                  thresholdRefund (only one bought during this visit: the tail of `attunements.owned` that adds up to
//                  `spentThisVisit`), equipAttunement (owned; at most `config.attunementEquipCap` = 5 equipped),
//                  toggleModifier (the profile's toggles for the next loop; a run's set is fixed when it starts),
//                  newGamePlus (once this profile has reached an ending)
//   the Far Light  chooseClass (any other class; mastery is per class, so that class's mastered abilities cost half
//                  again, DESIGN §10.9), newLoop ("Step into the light": `nextLoopState` for the chosen class with what
//                  the Loom set — equipped Attunements, toggled modifiers — keeping the quests and Echoes the Threshold
//                  itself gave (D-067.15), then `beginLoop`: Day 1)
// `threshold.visited` lists the places walked this visit; the last one is where the Wayfinder stands. Each place is also a
// WORLD §3.12 location (THRESHOLD_LOCATIONS): whoever stands there can be spoken to with `talk` (reducers/dialogue.ts),
// as Dask on the Still Shore (D-012, D-084; U34c). A scene opened here returns to the Threshold when it ends; Resonance
// gained in it is not the running loop's tally.
//
// New Game+ (D-021: "a fresh save that starts with all Echoes and codex of a completed save (any true ending) and loop
// counter continuing"): offered on a true ending's screens (PLAN §4.4) and at the Loom (DESIGN §10.8) once an ending
// has been reached. The profile becomes a fresh one that keeps only its Echoes and codex (with the discovery keys that
// already paid for them), the loop counter, and what is not save progress — achievements, settings, the Loom's modifier
// toggles, its id — and counts the start (`newGamePlus`); a new run (seed `${profileId}:ng${n}:${loop}`) then begins
// Day 1 of the next loop. `ach_ng_plus` is the achievement unit's (it reads `newGamePlus`).
//
// `thresholdPostStep` (after U30's `loopEndHook`) keeps the loop's Resonance tally (`counters.resonance`), pays the
// challenge modifiers' multiplier on it when the loop ends (DESIGN §15.1: ×1.25 / ×1.5 each, multiplied, at most ×3;
// D-082), writes the Still Shore's lines, and asks for an autosave on entering the Threshold (DESIGN §14.2).
import { evaluate, explain } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { apply } from '../effects';
import type { Enumerator } from '../legalActions';
import { newRun } from '../newRun';
import { resonanceMultiplier } from '../runRules';
import type { PostStepHook } from '../step';
import type { ActionOf } from '../types/actions';
import type { GameEvent } from '../types/events';
import type { Profile } from '../types/profile';
import type { GameState, Mode, ThresholdArea, ThresholdState } from '../types/state';
import { clone } from '../util/clone';
import { round } from '../util/math';
import { beginLoop, nextLoopState } from './loop';

/** DESIGN §10.8's four places, in screen order. */
export const THRESHOLD_AREAS: readonly ThresholdArea[] = ['still_shore', 'gallery', 'loom', 'far_light'];

/** STORY §10.7 steps 3–5 (the shore, the figure) and engine lines for the Far Light and New Game+. */
export const THRESHOLD_TEXT = {
  shore: 'The Still Shore: grey water, no horizon, a far light.',
  figure: 'Far out on the water, a figure holds something up with both hands. It does not move.',
  farLight: 'You step into the light. Day 1, Dawn.',
  newGamePlus: 'The ring turns. You begin again, and the Amulet remembers everything you were told.',
} as const;

/** `resonanceGained.reason` of the challenge modifiers' payment at the loop's end. */
export const MULTIPLIER_REASON = 'modifiers';
/** `resonanceGained.reason` prefix of a refund at the Loom. */
export const REFUND_REASON = 'refund:';
/** Modes whose Resonance gains belong to the running loop's tally (not the Threshold's spending, not the title). */
const TALLY_MODES: readonly Mode[] = ['explore', 'combat', 'dialogue', 'ending'];

const LOOM_ONLY = 'that is done at the Loom';
const FAR_LIGHT_ONLY = 'that is done at the Far Light';

// ---- where the Wayfinder stands ----------------------------------------------------------------------------------------

/** The place the Wayfinder stands in: the last one visited (the Still Shore on arrival or without a record). */
export function thresholdArea(s: GameState): ThresholdArea {
  const visited = s.threshold?.visited ?? [];
  return visited[visited.length - 1] ?? 'still_shore';
}

/** WORLD §2.12 / §3.12: the location each of the four places is. */
export const THRESHOLD_LOCATIONS: Readonly<Record<ThresholdArea, string>> = {
  still_shore: 'loc_still_shore',
  gallery: 'loc_gallery_of_loops',
  loom: 'loc_loom',
  far_light: 'loc_far_light',
};

/** The location the Wayfinder stands in at the Threshold (its NPCs are who can be talked to there). */
export const thresholdLocationId = (s: GameState): string => THRESHOLD_LOCATIONS[thresholdArea(s)];

/** The class the next loop starts as: the Far Light's choice, else the class just played. */
export const chosenClass = (s: GameState): string => s.threshold?.pendingClassId ?? s.player.classId;

/** The draft's Threshold record (created for a threshold state that has none). */
function thresholdOf(ctx: StepCtx): ThresholdState {
  ctx.s.threshold ??= { visited: ['still_shore'], spentThisVisit: 0, pendingClassId: null };
  return ctx.s.threshold;
}

/** Replaces the whole draft with `next` (as U30's ending → next loop does) and reports the mode change. */
function replaceState(ctx: StepCtx, next: GameState): void {
  const from = ctx.s.mode;
  const draft = ctx.s as unknown as Record<string, unknown>;
  for (const key of Object.keys(draft)) delete draft[key];
  Object.assign(draft, next);
  if (from !== next.mode) ctx.emit({ t: 'modeChanged', from, to: next.mode });
}

// ---- thresholdGo -----------------------------------------------------------------------------------------------------------

export function goProblem(s: GameState, to: unknown): string | null {
  if (!THRESHOLD_AREAS.includes(to as ThresholdArea)) return `there is no place called '${String(to)}' here`;
  return thresholdArea(s) === to ? 'you are already there' : null;
}

/** `thresholdGo`: walk to another of the four places (`thresholdEntered`; the Still Shore's lines come from the hook). */
export function thresholdGoHandler(ctx: StepCtx, a: ActionOf<'thresholdGo'>): void {
  const why = goProblem(ctx.s, a.to);
  if (why !== null) ctx.reject(why);
  const th = thresholdOf(ctx);
  th.visited = [...th.visited.filter((x) => x !== a.to), a.to];
  ctx.emit({ t: 'thresholdEntered', area: a.to });
}

export const thresholdGoEnumerator: Enumerator<'thresholdGo'> = (s) =>
  THRESHOLD_AREAS.filter((to) => goProblem(s, to) === null).map((to) => ({ type: 'thresholdGo', to }));

// ---- the Loom: Attunements -----------------------------------------------------------------------------------------------

/** Why `id` cannot be bought now (DESIGN §10.7): not at the Loom, unknown, owned, its `requires`, or too dear. */
export function spendProblem(s: GameState, content: ContentPack, profile: Readonly<Profile>, id: string): string | null {
  if (thresholdArea(s) !== 'loom') return LOOM_ONLY;
  const def = content.attunements[id];
  if (def === undefined) return `unknown attunement '${id}'`;
  if (profile.attunements.owned.includes(id)) return `${def.name} is already yours`;
  if (def.requires !== undefined && !evaluate(def.requires, s, profile, content)) {
    const missing = explain(def.requires, s, profile, content).parts.filter((part) => !part.ok).map((part) => part.text);
    return `${def.name} needs ${missing.join('; ')}`;
  }
  if (profile.resonance < def.cost) return `${def.name} costs ${def.cost} Resonance; you have ${profile.resonance}`;
  return null;
}

/** `thresholdSpend`: Resonance − cost (`resonanceGained` < 0), owned forever (`attunementBought`), counted for this visit. */
export function thresholdSpendHandler(ctx: StepCtx, a: ActionOf<'thresholdSpend'>): void {
  const why = spendProblem(ctx.s, ctx.content, ctx.profile, a.attunementId);
  if (why !== null) ctx.reject(why);
  const def = ctx.content.attunements[a.attunementId] as NonNullable<ContentPack['attunements'][string]>;
  apply({ resonance: -def.cost }, ctx, { source: `attunement:${def.id}` });
  ctx.profileDraft().attunements.owned.push(def.id);
  thresholdOf(ctx).spentThisVisit += def.cost;
  ctx.emit({ t: 'attunementBought', attunementId: def.id });
  ctx.log(`${def.name} is woven into you.`, 'system');
}

export const thresholdSpendEnumerator: Enumerator<'thresholdSpend'> = (s, content, profile) =>
  Object.keys(content.attunements)
    .sort()
    .filter((id) => spendProblem(s, content, profile, id) === null)
    .map((attunementId) => ({ type: 'thresholdSpend', attunementId }));

/**
 * The Attunements bought during this visit: purchases append to `owned` and refunds remove from that tail, so they are
 * the shortest tail of `owned` whose costs add up to `spentThisVisit` ([] when none does).
 */
export function boughtThisVisit(s: GameState, content: ContentPack, profile: Readonly<Profile>): string[] {
  const spent = s.threshold?.spentThisVisit ?? 0;
  const owned = profile.attunements.owned;
  let sum = 0;
  let i = owned.length;
  while (sum < spent && i > 0) {
    i -= 1;
    sum += content.attunements[owned[i] as string]?.cost ?? 0;
  }
  return sum === spent ? owned.slice(i) : [];
}

export function refundProblem(s: GameState, content: ContentPack, profile: Readonly<Profile>, id: string): string | null {
  if (thresholdArea(s) !== 'loom') return LOOM_ONLY;
  if (!profile.attunements.owned.includes(id)) return 'that Attunement is not yours';
  return boughtThisVisit(s, content, profile).includes(id) ? null : 'only an Attunement woven during this visit can be unpicked';
}

/** `thresholdRefund`: the cost back (not counted as earned), unowned and unequipped, uncounted for this visit. */
export function thresholdRefundHandler(ctx: StepCtx, a: ActionOf<'thresholdRefund'>): void {
  const why = refundProblem(ctx.s, ctx.content, ctx.profile, a.attunementId);
  if (why !== null) ctx.reject(why);
  const def = ctx.content.attunements[a.attunementId] as NonNullable<ContentPack['attunements'][string]>;
  const p = ctx.profileDraft();
  p.attunements.owned = p.attunements.owned.filter((id) => id !== def.id);
  if (p.attunements.equipped.includes(def.id)) {
    p.attunements.equipped = p.attunements.equipped.filter((id) => id !== def.id);
    ctx.emit({ t: 'attunementEquipped', attunementId: def.id, on: false });
  }
  p.resonance += def.cost;
  thresholdOf(ctx).spentThisVisit -= def.cost;
  ctx.emit({ t: 'resonanceGained', amount: def.cost, reason: `${REFUND_REASON}${def.id}`, total: p.resonance });
  ctx.log(`${def.name} is unpicked; its Resonance returns.`, 'system');
}

export const thresholdRefundEnumerator: Enumerator<'thresholdRefund'> = (s, content, profile) =>
  [...new Set(boughtThisVisit(s, content, profile))]
    .sort()
    .filter((id) => refundProblem(s, content, profile, id) === null)
    .map((attunementId) => ({ type: 'thresholdRefund', attunementId }));

export function equipProblem(s: GameState, content: ContentPack, profile: Readonly<Profile>, id: string, on: unknown): string | null {
  if (thresholdArea(s) !== 'loom') return LOOM_ONLY;
  if (typeof on !== 'boolean') return 'equip on or off?';
  if (!profile.attunements.owned.includes(id)) return 'you do not own that Attunement';
  const equipped = profile.attunements.equipped.includes(id);
  if (!on) return equipped ? null : 'that Attunement is not equipped';
  if (equipped) return 'that Attunement is already equipped';
  const cap = content.config.attunementEquipCap;
  return profile.attunements.equipped.length >= cap ? `at most ${cap} Attunements can be equipped` : null;
}

/** `equipAttunement`: in or out of the five slots (DESIGN §10.7); the set a loop carries is fixed at the Far Light. */
export function equipAttunementHandler(ctx: StepCtx, a: ActionOf<'equipAttunement'>): void {
  const why = equipProblem(ctx.s, ctx.content, ctx.profile, a.attunementId, a.on);
  if (why !== null) ctx.reject(why);
  const at = ctx.profileDraft().attunements;
  at.equipped = a.on ? [...at.equipped, a.attunementId] : at.equipped.filter((id) => id !== a.attunementId);
  ctx.emit({ t: 'attunementEquipped', attunementId: a.attunementId, on: a.on });
}

export const equipAttunementEnumerator: Enumerator<'equipAttunement'> = (s, content, profile) =>
  [...new Set(profile.attunements.owned)].sort().flatMap((attunementId) =>
    [true, false].filter((on) => equipProblem(s, content, profile, attunementId, on) === null).map((on) => ({ type: 'equipAttunement' as const, attunementId, on })),
  );

// ---- the Loom: challenge modifiers ---------------------------------------------------------------------------------------

export function toggleProblem(s: GameState, content: ContentPack, id: string): string | null {
  if (thresholdArea(s) !== 'loom') return LOOM_ONLY;
  return content.modifiers[id] === undefined ? `unknown modifier '${id}'` : null;
}

/** `toggleModifier`: the profile's toggle for the *next* loop flips (D-021); the run being prepared is rebuilt at the Far Light. */
export function toggleModifierHandler(ctx: StepCtx, a: ActionOf<'toggleModifier'>): void {
  const why = toggleProblem(ctx.s, ctx.content, a.modifierId);
  if (why !== null) ctx.reject(why);
  const toggles = ctx.profileDraft().modifiers;
  const on = toggles[a.modifierId] !== true;
  if (on) toggles[a.modifierId] = true;
  else delete toggles[a.modifierId];
  ctx.emit({ t: 'modifierToggled', modifierId: a.modifierId, on });
}

export const toggleModifierEnumerator: Enumerator<'toggleModifier'> = (s, content) =>
  Object.keys(content.modifiers)
    .sort()
    .filter((id) => toggleProblem(s, content, id) === null)
    .map((modifierId) => ({ type: 'toggleModifier', modifierId }));

// ---- the Far Light -----------------------------------------------------------------------------------------------------------

export function chooseClassProblem(s: GameState, content: ContentPack, classId: string): string | null {
  if (s.mode !== 'threshold') return 'a new game names its class';
  if (thresholdArea(s) !== 'far_light') return FAR_LIGHT_ONLY;
  if (content.classes[classId] === undefined) return `unknown class '${classId}'`;
  return classId === chosenClass(s) ? 'that is the shape you will wake in already' : null;
}

/** `chooseClass` at the Far Light (DESIGN §10.9): the next loop's class; back to the one just played clears the choice. */
export function chooseClassHandler(ctx: StepCtx, a: ActionOf<'chooseClass'>): void {
  const why = chooseClassProblem(ctx.s, ctx.content, a.classId);
  if (why !== null) ctx.reject(why);
  thresholdOf(ctx).pendingClassId = a.classId === ctx.s.player.classId ? null : a.classId;
  ctx.log(`The Wayfinder re-manifests: ${ctx.content.classes[a.classId]?.name ?? a.classId}.`, 'narration');
}

export const chooseClassEnumerator: Enumerator<'chooseClass'> = (s, content) =>
  Object.keys(content.classes)
    .sort()
    .filter((classId) => chooseClassProblem(s, content, classId) === null)
    .map((classId) => ({ type: 'chooseClass', classId }));

export const newLoopProblem = (s: GameState): string | null => (thresholdArea(s) === 'far_light' ? null : FAR_LIGHT_ONLY);

/**
 * `newLoop` ("Step into the light", DESIGN §10.8): the next loop rebuilt for the chosen class from the profile as the
 * Loom left it (`nextLoopState`: equipped Attunements, toggled modifiers, carry-over level), keeping what the Threshold
 * itself started — its quests (D-067.15) and Echoes — then `beginLoop` (Day 1 at the start location).
 */
export function newLoopHandler(ctx: StepCtx): void {
  const why = newLoopProblem(ctx.s);
  if (why !== null) ctx.reject(why);
  const { s } = ctx;
  const next = nextLoopState(ctx, chosenClass(s));
  next.quests = clone(s.quests);
  for (const id of s.echoesThisLoop) if (!next.echoesThisLoop.includes(id)) next.echoesThisLoop.push(id);
  next.counters.echoesGainedThisLoop = next.echoesThisLoop.length;
  replaceState(ctx, next);
  ctx.log(THRESHOLD_TEXT.farLight, 'narration');
  beginLoop(ctx);
}

export const newLoopEnumerator: Enumerator<'newLoop'> = (s) => (newLoopProblem(s) === null ? [{ type: 'newLoop' }] : []);

// ---- New Game+ --------------------------------------------------------------------------------------------------------------

const isCloser = (outcome: string): boolean => outcome === 'closer_escape' || outcome === 'closer_fall';

/** Why New Game+ is not offered: not a true ending's screen, not at the Loom, or no ending reached yet. */
export function newGamePlusProblem(s: GameState, profile: Readonly<Profile>): string | null {
  if (s.mode === 'ending') {
    const outcome = s.pendingEnding?.outcome;
    return outcome !== undefined && !isCloser(outcome) ? null : 'New Game+ follows a true ending';
  }
  if (thresholdArea(s) !== 'loom') return LOOM_ONLY;
  return profile.endingsReached.length > 0 ? null : 'New Game+ opens once an ending has been reached';
}

/** D-021: the profile a New Game+ starts with (see the file header). */
export function newGamePlusProfile(p: Readonly<Profile>): Profile {
  return {
    version: p.version,
    profileId: p.profileId,
    echoes: [...p.echoes],
    codexUnlocked: [...p.codexUnlocked],
    bestiary: {},
    achievements: clone(p.achievements),
    resonance: 0,
    resonanceEarnedTotal: 0,
    attunements: { owned: [], equipped: [] },
    classMastery: {},
    runHistory: [],
    settings: clone(p.settings),
    modifiers: { ...p.modifiers },
    mapKnowledge: [],
    discoveries: p.discoveries.filter((key) => key.startsWith('codex:') || key.startsWith('echo:')),
    endingsReached: [],
    loopCounter: p.loopCounter,
    newGamePlus: p.newGamePlus + 1,
    lastClassId: p.lastClassId,
  };
}

/** `newGamePlus`: the fresh profile (above), then a new run of the chosen class at the next loop, Day 1. */
export function newGamePlusHandler(ctx: StepCtx): void {
  const why = newGamePlusProblem(ctx.s, ctx.profile);
  if (why !== null) ctx.reject(why);
  const { s } = ctx;
  const classId = s.mode === 'threshold' ? chosenClass(s) : s.player.classId;
  const p = ctx.profileDraft();
  const fresh = newGamePlusProfile(p);
  const draft = p as unknown as Record<string, unknown>;
  for (const key of Object.keys(draft)) delete draft[key];
  Object.assign(draft, fresh);
  const seed = `${p.profileId}:ng${p.newGamePlus}:${Math.max(1, p.loopCounter)}`;
  replaceState(ctx, newRun(seed, classId, ctx.content, p, { playerName: s.player.name }));
  ctx.log(THRESHOLD_TEXT.newGamePlus, 'narration');
  beginLoop(ctx);
}

export const newGamePlusEnumerator: Enumerator<'newGamePlus'> = (s, _content, profile) =>
  newGamePlusProblem(s, profile) === null ? [{ type: 'newGamePlus' }] : [];

// ---- the post-step hook ------------------------------------------------------------------------------------------------------

/** The running loop's Resonance gains this step (not the multiplier itself) join `counters.resonance`. */
function tallyResonance(ctx: StepCtx, events: readonly GameEvent[]): void {
  if (!TALLY_MODES.includes(ctx.s.mode) || ctx.s.dialogue?.returnMode === 'threshold') return; // a Threshold conversation is not the loop
  let gained = 0;
  for (const e of events) if (e.t === 'resonanceGained' && e.amount > 0 && e.reason !== MULTIPLIER_REASON) gained += e.amount;
  if (gained > 0) ctx.s.counters.resonance = (ctx.s.counters.resonance ?? 0) + gained;
}

/** DESIGN §15.1: at the loop's end its tally × (the modifiers' multiplier − 1) more, rounded. */
function payModifierMultiplier(ctx: StepCtx): void {
  const mult = resonanceMultiplier(ctx.s.meta.modifiers);
  const bonus = round((ctx.s.counters.resonance ?? 0) * (mult - 1));
  if (bonus <= 0) return;
  apply({ resonance: bonus }, ctx, { source: MULTIPLIER_REASON });
  ctx.log(`Challenge modifiers ×${mult}: +${bonus} Resonance.`, 'system');
}

/** STORY §10.7 steps 3–4 and DESIGN §10.8's Still Shore: the shore, the last run's summary, its Echoes, the Resonance. */
function shoreLines(ctx: StepCtx): void {
  const p = ctx.profile;
  ctx.log(THRESHOLD_TEXT.shore, 'narration');
  const record = p.runHistory[p.runHistory.length - 1];
  if (record !== undefined) {
    ctx.log(record.summary, 'system');
    const names = record.echoesGained.map((id) => ctx.content.echoes[id]?.name ?? id);
    ctx.log(names.length === 0 ? 'No Echo came back with you.' : `Echoes gained: ${names.join(', ')}.`, 'system');
  }
  ctx.log(`Resonance to spend at the Loom: ${p.resonance}.`, 'system');
  ctx.log(THRESHOLD_TEXT.figure, 'narration');
}

/** Post-step (after `loopEndHook`): the Resonance tally and multiplier, the Still Shore's lines, the Threshold autosave. */
export const thresholdPostStep: PostStepHook = (ctx) => {
  const events = ctx.events.slice();
  tallyResonance(ctx, events);
  if (events.some((e) => e.t === 'loopEnded')) payModifierMultiplier(ctx);
  for (const e of events) if (e.t === 'thresholdEntered' && e.area === 'still_shore') shoreLines(ctx);
  if (ctx.s.mode === 'threshold' && events.some((e) => e.t === 'modeChanged' && e.from === 'ending' && e.to === 'threshold')) {
    ctx.emit({ t: 'autosaveCheckpoint', reason: 'thresholdEntered' });
  }
};
