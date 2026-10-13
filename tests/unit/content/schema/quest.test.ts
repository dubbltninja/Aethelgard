// U17: QuestSchema (PLAN §5.9) — STORY §11 `q_echo_crystal` parses; defaults; per-record structure rules bite.
import { describe, expect, test } from 'bun:test';
import { QuestSchema } from '@schema/quest';
import { questEchoCrystal } from '../examples';

const issues = (value: unknown): string[] => {
  const r = QuestSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const expectIssue = (value: unknown, path: string, fragment: string) => {
  const found = issues(value);
  expect(found.some((i) => i.startsWith(`${path}: `) && i.includes(fragment)), `wanted "${path}: …${fragment}…", got ${JSON.stringify(found)}`).toBe(true);
};
/** The example with one stage replaced or appended. */
const withStages = (...stages: unknown[]) => ({ ...questEchoCrystal, stages });

describe('QuestSchema', () => {
  test('STORY §11 q_echo_crystal parses and applies defaults', () => {
    const q = QuestSchema.parse(questEchoCrystal);
    expect(q.id).toBe('q_echo_crystal');
    expect(q.stages.map((s) => s.id)).toEqual(['reach_library', 'take_crystal', 'return_to_ilyra', 'done_given', 'done_kept']);
    expect(q.rewards).toEqual({ xp: 120, gold: 20, items: [], rep: [], echoes: [], resonance: 0 });
    expect(q).toMatchObject({ repeatablePerLoop: true, hiddenUntilStarted: true, countsForApex: true, onFail: [], tags: [] });
    const [first, , , given] = q.stages;
    expect(first).toMatchObject({ onEnter: [], onExit: [], tags: [] });
    expect(first?.objectives[0]).toMatchObject({ optional: false, hidden: false, hintLocationId: 'loc_shattered_library' });
    expect(given?.outcome).toBe('complete');
    expect(given?.next).toBeUndefined();
  });

  test('rewards default to zero when omitted', () => {
    const { rewards: _omitted, ...bare } = questEchoCrystal;
    expect(QuestSchema.parse(bare).rewards).toEqual({ xp: 0, gold: 0, items: [], rep: [], echoes: [], resonance: 0 });
  });

  test('ids carry their prefix; category and botHint are closed sets; unknown keys fail', () => {
    expectIssue({ ...questEchoCrystal, id: 'echo_crystal' }, 'id', 'q_');
    expectIssue({ ...questEchoCrystal, giverNpcId: 'ilyra' }, 'giverNpcId', 'npc_');
    expectIssue({ ...questEchoCrystal, category: 'side' }, 'category', 'Invalid enum value');
    expectIssue({ ...questEchoCrystal, botHint: 'tank' }, 'botHint', 'Invalid enum value');
    expectIssue({ ...questEchoCrystal, rewards: { items: [{ itemId: 'crystal' }] } }, 'rewards.items.0.itemId', 'item_');
    expectIssue({ ...questEchoCrystal, shortcuts: [{ echo: 'crystal_location', skipTo: 'take_crystal', text: 'x' }] }, 'shortcuts.0.echo', 'echo_');
    expectIssue({ ...questEchoCrystal, reward: 1 }, '', 'Unrecognized key');
  });

  test('a quest has at least one stage; conditions inside stages are checked', () => {
    expectIssue({ ...questEchoCrystal, stages: [] }, 'stages', 'at least 1');
    expectIssue(
      withStages({ id: 'a', journal: 'x', objectives: [{ id: 'o', text: 'x', when: { flagg: 'flag_x' } }], outcome: 'complete' }),
      'stages.0.objectives.0.when.flagg',
      "unknown condition atom 'flagg'",
    );
  });

  test('stage references stay inside the quest: firstStage, next, branches, onTimeoutTo, shortcut targets', () => {
    expectIssue({ ...questEchoCrystal, firstStage: 'nowhere' }, 'firstStage', 'not a stage');
    expectIssue(withStages({ id: 'a', journal: 'x', next: 'b' }), 'stages.0.next', "'b' is not a stage");
    expectIssue(withStages({ id: 'a', journal: 'x', next: [{ when: { flag: 'flag_x' }, to: 'zzz' }] }), 'stages.0.next.0.to', "'zzz' is not a stage");
    expectIssue(withStages({ id: 'a', journal: 'x', timeLimitDays: 3, onTimeoutTo: 'gone', outcome: 'complete' }), 'stages.0.onTimeoutTo', "'gone' is not a stage");
    expectIssue({ ...questEchoCrystal, shortcuts: [{ echo: 'echo_crystal_location', skipTo: 'gone', text: 'x' }] }, 'shortcuts.0.skipTo', "'gone' is not a stage");
  });

  test('duplicate stage and objective ids; outcome and next are exclusive; timeouts need a limit', () => {
    expectIssue(withStages({ id: 'a', journal: 'x', outcome: 'complete' }, { id: 'a', journal: 'y', outcome: 'fail' }), 'stages.1.id', "duplicate stage id 'a'");
    expectIssue(
      withStages({
        id: 'a',
        journal: 'x',
        objectives: [
          { id: 'o', text: 'one', when: { flag: 'flag_a' } },
          { id: 'o', text: 'two', when: { flag: 'flag_b' } },
        ],
        outcome: 'complete',
      }),
      'stages.0.objectives.1.id',
      "duplicate objective id 'o'",
    );
    expectIssue(withStages({ id: 'a', journal: 'x', outcome: 'complete', next: 'a' }), 'stages.0.next', 'cannot have `next`');
    expectIssue(withStages({ id: 'a', journal: 'x', outcome: 'complete' }, { id: 'b', journal: 'y', onTimeoutTo: 'a', outcome: 'fail' }), 'stages.1.onTimeoutTo', 'needs `timeLimitDays`');
    expectIssue(withStages({ id: 'a', journal: 'x', timeLimitDays: 0, outcome: 'complete' }), 'stages.0.timeLimitDays', 'greater than or equal to 1');
    expectIssue(withStages({ id: 'a', journal: 'x', next: [], outcome: undefined }), 'stages.0.next', '');
  });

  test('a stage may time out into another stage', () => {
    const q = {
      ...withStages(
        { id: 'wait', journal: 'Wait for the caravan.', timeLimitDays: 5, onTimeoutTo: 'missed', next: 'met' },
        { id: 'met', journal: 'You met it.', outcome: 'complete' },
        { id: 'missed', journal: 'It left without you.', outcome: 'fail' },
      ),
      shortcuts: [],
    };
    expect(issues(q)).toEqual([]);
  });
});
