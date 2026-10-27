// QuestSchema (PLAN §5.9; DESIGN §13.1 data model, §6.2 quest XP tiers; STORY §11 catalog; D-010 Echo shortcuts, D-011
// per-loop reset, D-045 quest count, D-048 `quests_completed`). A quest is a graph of stages; a stage advances when its
// `advanceWhen` (default: every non-optional objective) holds, follows `next`, and ends the quest when it carries an
// `outcome`. Per-record structure is checked here (duplicate ids, stage references inside the record, `outcome` vs
// `next`); cross-table references and graph reachability are `validateContent()` (PLAN §5.19 rules 1, 9).
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { dupes } from './creature';
import { Effects } from './effect';
import { Base, ClassId, CompanionId, EchoId, FactionId, Id, ItemId, LocationId, NpcId, QuestId, Text } from './primitives';

const int = z.number().int();
const custom = z.ZodIssueCode.custom;

export const QUEST_CATEGORIES = ['legacy', 'faction', 'companion', 'regional', 'loop', 'ending', 'class', 'stretch'] as const;
/** DESIGN §13.1 (+ `stretch`, D-066 #20). */
export const QuestCategory = z.enum(QUEST_CATEGORIES);
/** Which bot must be able to complete the quest (DESIGN §13.4). */
export const BotHint = z.enum(['melee', 'caster', 'explorer', 'speedrunner', 'pacifist']);

export const ObjectiveSchema = Base.extend({
  /** Journal line: "Recover the Echo Crystal from the Shattered Library". */
  text: Text,
  /** Satisfied when true. */
  when: ConditionSchema,
  optional: z.boolean().default(false),
  /** Revealed when done. */
  hidden: z.boolean().default(false),
  /** Map marker. */
  hintLocationId: LocationId.optional(),
}).strict();

export const QuestBranchSchema = z.object({ when: ConditionSchema, to: Id }).strict();

export const QuestStageSchema = Base.extend({
  /** Current-stage journal text (STORY §11: ≤ 40 words). */
  journal: Text,
  objectives: z.array(ObjectiveSchema).default([]),
  /** Default: all non-optional objectives done. */
  advanceWhen: ConditionSchema.optional(),
  /** Absent → terminal unless `outcome` is set. A branch list takes the first `when` that holds. */
  next: z.union([Id, z.array(QuestBranchSchema).min(1)]).optional(),
  /** Reaching this stage ends the quest. */
  outcome: z.enum(['complete', 'fail']).optional(),
  onEnter: Effects,
  onExit: Effects,
  /** Auto-fail (or `onTimeoutTo` stage) after N days in this stage. */
  timeLimitDays: int.min(1).optional(),
  onTimeoutTo: Id.optional(),
}).strict();

export const QuestRewardsSchema = z
  .object({
    xp: int.min(0).default(0),
    gold: int.min(0).default(0),
    items: z.array(z.object({ itemId: ItemId, count: int.min(1).default(1) }).strict()).default([]),
    rep: z.array(z.object({ faction: FactionId, delta: int }).strict()).default([]),
    echoes: z.array(EchoId).default([]),
    resonance: int.min(0).default(0),
  })
  .strict();

export const QuestSchema = Base.extend({
  /** STORY §11 ids (q_echo_crystal …, q_class_<class>). */
  id: QuestId,
  name: Text,
  /** Journal header blurb. */
  description: Text,
  /** DESIGN §13.1. */
  category: QuestCategory,
  /** DESIGN §13.4: which bot must complete it. */
  botHint: BotHint,
  failWhen: ConditionSchema.optional(),
  onFail: Effects,
  giverNpcId: NpcId.optional(),
  factionId: FactionId.optional(),
  companionId: CompanionId.optional(),
  classId: ClassId.optional(),
  /** Auto-start sweep (e.g. legacy `q_echoing_heartbeat`: two quests completed). */
  startWhen: ConditionSchema.optional(),
  /** Can be offered (dialogue uses the `questStart` effect). */
  availableWhen: ConditionSchema.optional(),
  stages: z.array(QuestStageSchema).min(1),
  /** Default `stages[0].id`. */
  firstStage: Id.optional(),
  rewards: QuestRewardsSchema.default({}),
  /** D-010 Echo shortcuts. */
  shortcuts: z.array(z.object({ echo: EchoId, skipTo: Id, text: Text }).strict()).default([]),
  /** All quests reset per loop (D-011); false = once per profile (loop-only reveals). */
  repeatablePerLoop: z.boolean().default(true),
  hiddenUntilStarted: z.boolean().default(true),
  /** Contributes to the engine counter `quests_completed` (D-048). */
  countsForApex: z.boolean().default(true),
  /** The Python id, for Appendix A cross-checks. */
  legacyId: z.string().optional(),
})
  .strict()
  .superRefine((q, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
    const ids = new Set(q.stages.map((s) => s.id));
    const known = (to: string, path: (string | number)[]) => {
      if (!ids.has(to)) issue(path, `'${to}' is not a stage of ${q.id}`);
    };
    dupes(q.stages.map((s) => s.id)).forEach((i) => issue(['stages', i, 'id'], `duplicate stage id '${q.stages[i]?.id}'`));
    if (q.firstStage !== undefined) known(q.firstStage, ['firstStage']);
    q.stages.forEach((stage, si) => {
      dupes(stage.objectives.map((o) => o.id)).forEach((i) =>
        issue(['stages', si, 'objectives', i, 'id'], `duplicate objective id '${stage.objectives[i]?.id}'`),
      );
      if (stage.outcome !== undefined && stage.next !== undefined) issue(['stages', si, 'next'], 'a stage with an `outcome` ends the quest and cannot have `next`');
      if (typeof stage.next === 'string') known(stage.next, ['stages', si, 'next']);
      else if (stage.next) stage.next.forEach((b, bi) => known(b.to, ['stages', si, 'next', bi, 'to']));
      if (stage.onTimeoutTo !== undefined) {
        known(stage.onTimeoutTo, ['stages', si, 'onTimeoutTo']);
        if (stage.timeLimitDays === undefined) issue(['stages', si, 'onTimeoutTo'], '`onTimeoutTo` needs `timeLimitDays`');
      }
    });
    q.shortcuts.forEach((s, i) => known(s.skipTo, ['shortcuts', i, 'skipTo']));
  });

export type Objective = z.output<typeof ObjectiveSchema>;
export type QuestStage = z.output<typeof QuestStageSchema>;
export type QuestRewards = z.output<typeof QuestRewardsSchema>;
export type Quest = z.output<typeof QuestSchema>;
export type QuestInput = z.input<typeof QuestSchema>;
