// Quests reducer (U33; DESIGN §13.1, §13.4; PLAN §4.6 rule 3, §5.9, §8.1 "quests"; STORY §11; D-010, D-045, D-048,
// D-067.15/.17, D-072). The stage transitions themselves (enter a stage, finish a quest, pay its rewards) are effects.ts
// `enterStage` / `finishQuest`, shared with the `questStart` / `questAdvance` / `questFail` effects; this file decides
// when they happen.
//
// The sweep (`questPostStep`, the first post-step hook, so the effects it applies — time passing, a teleport, a fight,
// a recruit, an ending — still reach the hooks after it). It runs in explore, dialogue and threshold mode outside a
// fight, until nothing moves (at most SWEEP_PASSES passes):
//   1. Echo shortcuts for the quests that started this step (echoes.ts `applyShortcut`, U32), before their first stage
//      is swept: the quest opens at `skipTo`.
//   2. Auto-starts: an inactive quest whose `startWhen` holds starts (if it may: `questStartProblem`).
//   3. Every active quest, in content order:
//      - `failWhen` holds → the quest fails (`onFail`);
//      - objectives: each one whose `when` holds is done and stays done for the stage (`questObjective`; latched, so a
//        stage that asks to reach two places can be finished); `killed.sinceStage` counts from the stage's start;
//      - the stage advances when its `advanceWhen` holds, else when every non-optional objective is done; it goes to
//        `next` — a stage id, or the first branch whose `when` holds (none holds: it waits). A stage with no
//        `advanceWhen` and no required objective is driven from outside: a branch list still moves it once a branch
//        holds, a plain `next` waits for a `questAdvance` (the dialogue's "report back"); so does a stage without
//        `next` (validator rule 9 warns). Entering a stage with an `outcome` ends the quest (effects.ts; a quest found
//        active on such a stage — a hand-built or old state — ends at the sweep);
//      - otherwise, `timeLimitDays` after the stage began → `onTimeoutTo`, or the quest fails.
//   The sweep stops early if an effect leaves those modes (a fight, an ending); the rest waits for the next step.
//   An autosave checkpoint follows a completion in explore or threshold mode.
// `acceptQuest` (dialogue): the UI's "Accept" for a quest the NPC being spoken to gives (`giverNpcId`) that may start
// now. The journal (`questJournal`) is a read model for the UI: started quests, the current stage's text, the visible
// objectives (hidden ones once done), and the stages already passed.
import type { Condition } from '@schema/condition';
import type { Quest, QuestStage } from '@schema/quest';
import { dayOf, evaluate } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { applyShortcut } from '../echoes';
import { STAGE_DAY, STAGE_ORDER, apply, enterStage, finishQuest, questDoneEarlier } from '../effects';
import type { Enumerator } from '../legalActions';
import type { PostStepHook } from '../step';
import type { ActionOf } from '../types/actions';
import type { Profile } from '../types/profile';
import type { GameState, Mode, QuestState, QuestStatus } from '../types/state';
import { autosave } from './explore';

type Pr = Readonly<Profile>;

/** Modes in which quests are swept (never mid-fight, never on ending screens). */
export const SWEEP_MODES: readonly Mode[] = ['explore', 'dialogue', 'threshold'];
/** Upper bound on sweep passes in one step (content cycles of always-true stages cannot hang the engine). */
export const SWEEP_PASSES = 16;

// ---- reads ----------------------------------------------------------------------------------------------------------------

const questDef = (content: ContentPack, id: string): Quest | undefined => content.quests[id];
const stageDef = (quest: Quest, id: string): QuestStage | undefined => quest.stages.find((st) => st.id === id);

/** Why `questId` cannot start now (null: it can): running or finished, another class's, once per profile and done, `availableWhen`. */
export function questStartProblem(s: GameState, content: ContentPack, profile: Pr, questId: string): string | null {
  const def = questDef(content, questId);
  if (def === undefined) return `there is no quest '${questId}'`;
  const status = s.quests[questId]?.status ?? 'inactive';
  if (status === 'active') return `${def.name} is already under way`;
  if (status !== 'inactive') return `${def.name} is over for this loop`;
  if (def.classId !== undefined && def.classId !== s.player.classId) return `${def.name} is not for your class`;
  if (def.repeatablePerLoop === false && questDoneEarlier(profile, questId)) return `${def.name} was finished in an earlier loop`;
  if (def.availableWhen !== undefined && !evaluate(def.availableWhen, s, profile, content)) return `${def.name} is not offered yet`;
  return null;
}

/** Whether an objective's `when` holds now (`killed.sinceStage` scoped to the quest). */
function objectiveHolds(s: GameState, profile: Pr, content: ContentPack, questId: string, when: Condition): boolean {
  return evaluate(when, s, profile, content, { questId });
}

/** The stage the current one leads to now: its `next` id, the first branch that holds, or null (waits). */
function nextStage(s: GameState, profile: Pr, content: ContentPack, questId: string, stage: QuestStage): string | null {
  if (stage.next === undefined) return null;
  if (typeof stage.next === 'string') return stage.next;
  return stage.next.find((b) => evaluate(b.when, s, profile, content, { questId }))?.to ?? null;
}

/**
 * True when the stage's own condition to move on holds: `advanceWhen`, else every non-optional objective done. A stage
 * with neither (no `advanceWhen`, no required objective) is driven from outside: only a branch list moves it on by
 * itself (its first branch that holds); a plain `next` waits for a `questAdvance` (a dialogue's "report back").
 */
function stageDone(s: GameState, profile: Pr, content: ContentPack, questId: string, stage: QuestStage, qs: QuestState): boolean {
  if (stage.advanceWhen !== undefined) return evaluate(stage.advanceWhen, s, profile, content, { questId });
  const required = stage.objectives.filter((o) => !o.optional);
  if (required.length === 0) return Array.isArray(stage.next);
  return required.every((o) => qs.objectivesDone.includes(o.id));
}

// ---- the sweep ------------------------------------------------------------------------------------------------------------

const sweeping = (s: GameState): boolean => SWEEP_MODES.includes(s.mode) && s.combat === null;

/** Marks the current stage's objectives that hold now (`questObjective`); true if any changed. */
function sweepObjectives(ctx: StepCtx, questId: string, stage: QuestStage): boolean {
  const qs = ctx.s.quests[questId] as QuestState;
  let changed = false;
  for (const o of stage.objectives) {
    if (qs.objectivesDone.includes(o.id) || !objectiveHolds(ctx.s, ctx.profile, ctx.content, questId, o.when)) continue;
    qs.objectivesDone.push(o.id);
    ctx.emit({ t: 'questObjective', questId, objectiveId: o.id, done: true });
    changed = true;
  }
  return changed;
}

/** One active quest: fail, objectives, advance or time out. True if anything changed. */
function sweepQuest(ctx: StepCtx, quest: Quest): boolean {
  const { s, profile, content } = ctx;
  const qs = s.quests[quest.id];
  if (qs?.status !== 'active') return false;
  if (quest.failWhen !== undefined && evaluate(quest.failWhen, s, profile, content, { questId: quest.id })) {
    finishQuest(ctx, quest.id, 'fail');
    return true;
  }
  const stage = stageDef(quest, qs.stage);
  if (stage === undefined) return false; // a stage the content no longer has (old save): leave it to a questAdvance
  if (stage.outcome !== undefined) {
    finishQuest(ctx, quest.id, stage.outcome); // active on an ending stage (a state built or saved that way): it ends
    return true;
  }
  const changed = sweepObjectives(ctx, quest.id, stage);
  if (stageDone(s, profile, content, quest.id, stage, qs)) {
    const to = nextStage(s, profile, content, quest.id, stage);
    if (to !== null) {
      enterStage(ctx, quest.id, to);
      return true;
    }
  }
  const limit = stage.timeLimitDays;
  if (limit !== undefined && dayOf(s.clock.ticks) - (qs.counters[STAGE_DAY] ?? dayOf(s.clock.ticks)) >= limit) {
    ctx.log(`${quest.name}: time has run out.`, 'event');
    if (stage.onTimeoutTo !== undefined) enterStage(ctx, quest.id, stage.onTimeoutTo);
    else finishQuest(ctx, quest.id, 'fail');
    return true;
  }
  return changed;
}

/** Starts every inactive quest whose `startWhen` holds and that may start. True if any started. */
function autoStart(ctx: StepCtx): boolean {
  let started = false;
  for (const quest of Object.values(ctx.content.quests)) {
    if (quest.startWhen === undefined || !sweeping(ctx.s)) continue;
    if (questStartProblem(ctx.s, ctx.content, ctx.profile, quest.id) !== null) continue;
    if (!evaluate(quest.startWhen, ctx.s, ctx.profile, ctx.content)) continue;
    apply({ questStart: quest.id }, ctx, { source: `quest:${quest.id}` });
    started = true;
  }
  return started;
}

/** Shortcuts (U32) for quests whose `questStarted` this step has not been seen yet. */
function shortcutsFrom(ctx: StepCtx, seen: Set<string>): void {
  for (let i = 0; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e?.t !== 'questStarted' || seen.has(e.questId)) continue;
    seen.add(e.questId);
    applyShortcut(ctx, e.questId);
  }
}

/** The post-step quest sweep (see the header). */
export const questPostStep: PostStepHook = (ctx) => {
  if (!sweeping(ctx.s)) return;
  const shortcutsSeen = new Set<string>();
  for (let pass = 0; pass < SWEEP_PASSES; pass++) {
    shortcutsFrom(ctx, shortcutsSeen);
    let changed = autoStart(ctx);
    for (const quest of Object.values(ctx.content.quests)) {
      if (!sweeping(ctx.s)) break;
      if (sweepQuest(ctx, quest)) changed = true;
    }
    if (!changed || !sweeping(ctx.s)) break;
  }
  shortcutsFrom(ctx, shortcutsSeen);
  const completed = ctx.events.some((e) => e.t === 'questCompleted');
  if (completed && (ctx.s.mode === 'explore' || ctx.s.mode === 'threshold')) autosave(ctx, 'questCompleted');
};

// ---- acceptQuest ----------------------------------------------------------------------------------------------------------

/** Quests the NPC being spoken to can hand over now (`giverNpcId`, and it may start). */
export function offeredQuests(s: GameState, content: ContentPack, profile: Pr): string[] {
  const npcId = s.mode === 'dialogue' ? s.dialogue?.npcId : null;
  if (npcId === null || npcId === undefined) return [];
  return Object.values(content.quests)
    .filter((q) => q.giverNpcId === npcId && questStartProblem(s, content, profile, q.id) === null)
    .map((q) => q.id);
}

/** `acceptQuest` (dialogue mode): starts a quest the NPC being spoken to offers; the scene stays open. */
export function acceptQuestHandler(ctx: StepCtx, a: ActionOf<'acceptQuest'>): void {
  const { s, content, profile } = ctx;
  const why = questStartProblem(s, content, profile, a.questId);
  if (why !== null) ctx.reject(why);
  if (!offeredQuests(s, content, profile).includes(a.questId)) ctx.reject(`no one here offers ${content.quests[a.questId]?.name ?? a.questId}`);
  apply({ questStart: a.questId as `q_${string}` }, ctx, { source: 'accept' });
}

export const acceptQuestEnumerator: Enumerator<'acceptQuest'> = (s, content, profile) =>
  offeredQuests(s, content, profile).map((questId) => ({ type: 'acceptQuest', questId }));

// ---- the journal (UI read model) ------------------------------------------------------------------------------------------

export interface JournalObjective {
  id: string;
  text: string;
  done: boolean;
  optional: boolean;
  hintLocationId?: string;
}

export interface JournalEntry {
  questId: string;
  name: string;
  description: string;
  status: QuestStatus;
  stage: string;
  /** The current stage's journal text. */
  journal: string;
  /** The current stage's objectives the player may see (hidden ones once done). */
  objectives: JournalObjective[];
  /** Stages passed before the current one, oldest first (the journal shows them collapsed). */
  history: { stage: string; journal: string }[];
  startedDay: number | null;
  endedDay: number | null;
}

const STATUS_ORDER: Readonly<Record<QuestStatus, number>> = { active: 0, completed: 1, failed: 2, inactive: 3 };

/** The journal: every started quest (active, then completed, then failed; in content order within each). */
export function questJournal(s: GameState, content: ContentPack): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const quest of Object.values(content.quests)) {
    const qs = s.quests[quest.id];
    if (qs === undefined || qs.status === 'inactive') continue;
    const stage = stageDef(quest, qs.stage);
    const objectives = (stage?.objectives ?? [])
      .map((o) => ({ o, done: qs.status === 'completed' || qs.objectivesDone.includes(o.id) }))
      .filter(({ o, done }) => !o.hidden || done)
      .map(({ o, done }) => ({ id: o.id, text: o.text, done, optional: o.optional, ...(o.hintLocationId !== undefined ? { hintLocationId: o.hintLocationId } : {}) }));
    const history = Object.entries(qs.counters)
      .filter(([k]) => k.startsWith(STAGE_ORDER) && k !== `${STAGE_ORDER}${qs.stage}`)
      .sort(([, a], [, b]) => a - b)
      .map(([k]) => k.slice(STAGE_ORDER.length))
      .map((id) => ({ stage: id, journal: stageDef(quest, id)?.journal ?? '' }));
    out.push({
      questId: quest.id,
      name: quest.name,
      description: quest.description,
      status: qs.status,
      stage: qs.stage,
      journal: stage?.journal ?? '',
      objectives,
      history,
      startedDay: qs.startedDay,
      endedDay: qs.endedDay,
    });
  }
  return out.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}
