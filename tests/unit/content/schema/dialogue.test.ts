// U17: DialogueSchema (PLAN §5.10) — STORY §13 `scene_first_meeting_ilyra` parses; defaults; graph-local rules bite.
import { describe, expect, test } from 'bun:test';
import { DialogueChoiceSchema, DialogueSceneSchema } from '@schema/dialogue';
import { sceneFirstMeetingIlyra } from '../examples';

const issues = (value: unknown): string[] => {
  const r = DialogueSceneSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const expectIssue = (value: unknown, path: string, fragment: string) => {
  const found = issues(value);
  expect(found.some((i) => i.startsWith(`${path}: `) && i.includes(fragment)), `wanted "${path}: …${fragment}…", got ${JSON.stringify(found)}`).toBe(true);
};
const node = (id: string, extra: Record<string, unknown> = {}) => ({ id, speaker: 'narrator', text: `Text of ${id}.`, next: 'end', ...extra });
const scene = (nodes: unknown[], extra: Record<string, unknown> = {}) => ({ id: 'scene_test', entry: 'a', nodes, ...extra });

describe('DialogueSceneSchema', () => {
  test('STORY §13 scene_first_meeting_ilyra parses and applies defaults', () => {
    const s = DialogueSceneSchema.parse(sceneFirstMeetingIlyra);
    expect(s).toMatchObject({ id: 'scene_first_meeting_ilyra', npcId: 'npc_ilyra', priority: 0, repeatable: true, onEnd: [], companionReactions: [] });
    expect(s.nodes.map((n) => n.id)).toEqual(['greet', 'declined', 'told', 'recruitable']);
    const greet = s.nodes[0]!;
    expect(greet.choices).toHaveLength(5);
    expect(greet.choices[0]).toMatchObject({ once: false, oncePerLoop: false, tags: [], effects: [{ questStart: 'q_echo_crystal' }], next: 'end' });
    expect(greet.choices[3]).toMatchObject({ echoHint: 'echo_ilyra_watchword', tags: ['echo'], when: { echo: 'echo_ilyra_watchword' } });
    expect(s.nodes[1]).toMatchObject({ mood: 'grim', choices: [], textVariants: [], onEnter: [] });
    expect(greet.textVariants[0]?.when).toEqual({ loop: { min: 2 } });
  });

  test('scene ids are scene_*; entry may be a rule list; speakers are plain ids', () => {
    expectIssue({ ...sceneFirstMeetingIlyra, id: 'first_meeting' }, 'id', 'scene_');
    expect(issues(scene([node('a'), node('b')], { entry: [{ when: { loop: { min: 2 } }, node: 'b' }, { when: { all: [] }, node: 'a' }] }))).toEqual([]);
    expectIssue(scene([node('a')], { entry: [] }), 'entry', '');
    expectIssue(scene([node('a', { speaker: 'Ilyra' })]), 'nodes.0.speaker', 'snake_case');
    expectIssue(scene([]), 'nodes', 'at least 1');
  });

  test('node references resolve inside the scene (or end): entry, node.next, choice.next', () => {
    expectIssue(scene([node('a')], { entry: 'missing' }), 'entry', "'missing' is not a node");
    expectIssue(scene([node('a')], { entry: [{ when: { all: [] }, node: 'missing' }] }), 'entry.0.node', "'missing' is not a node");
    expectIssue(scene([node('a', { next: 'nowhere' })]), 'nodes.0.next', "'nowhere' is not a node");
    expectIssue(scene([node('a', { next: undefined, choices: [{ id: 'c', text: 'Go.', next: 'nowhere' }] })]), 'nodes.0.choices.0.next', "'nowhere' is not a node");
    expect(issues(scene([node('a', { next: undefined, choices: [{ id: 'c', text: 'Leave.', next: 'end' }] })]))).toEqual([]);
  });

  test('duplicate node ids, choice ids and hotkeys are rejected; unhotkeyed choices never collide', () => {
    expectIssue(scene([node('a'), node('a')]), 'nodes.1.id', "duplicate node id 'a'");
    const choices = (...cs: Record<string, unknown>[]) => scene([node('a', { next: undefined, choices: cs })]);
    expectIssue(choices({ id: 'x', text: '1', next: 'end' }, { id: 'x', text: '2', next: 'end' }), 'nodes.0.choices.1.id', "duplicate choice id 'x'");
    expectIssue(choices({ id: 'x', text: '1', next: 'end', hotkey: '1' }, { id: 'y', text: '2', next: 'end', hotkey: '1' }), 'nodes.0.choices.1.hotkey', 'used twice');
    expect(issues(choices({ id: 'x', text: '1', next: 'end' }, { id: 'y', text: '2', next: 'end' }))).toEqual([]);
  });

  test('choice fields: hotkey is one digit 1–9, tags are the DESIGN §13.2 glyphs, echoHint is an Echo id', () => {
    const base = { id: 'c', text: 'Go.', next: 'end' };
    expect(DialogueChoiceSchema.safeParse({ ...base, hotkey: '9' }).success).toBe(true);
    expect(DialogueChoiceSchema.safeParse({ ...base, hotkey: '0' }).success).toBe(false);
    expect(DialogueChoiceSchema.safeParse({ ...base, hotkey: '10' }).success).toBe(false);
    expect(DialogueChoiceSchema.safeParse({ ...base, tags: ['echo', 'class', 'faction', 'companion'] }).success).toBe(true);
    expect(DialogueChoiceSchema.safeParse({ ...base, tags: ['romance'] }).success).toBe(false);
    expect(DialogueChoiceSchema.safeParse({ ...base, echoHint: 'ilyra_watchword' }).success).toBe(false);
    expect(DialogueChoiceSchema.safeParse({ ...base, effects: [{ gold: 'lots' }] }).success).toBe(false);
  });

  test('companion reactions name a companion id; mood is a closed set', () => {
    const reaction = { companionId: 'brak', text: 'Brak grunts.', loyalty: 2 };
    expect(issues(scene([node('a')], { companionReactions: [reaction] }))).toEqual([]);
    expectIssue(scene([node('a')], { companionReactions: [{ ...reaction, companionId: 'npc_brak' }] }), 'companionReactions.0.companionId', 'Invalid enum value');
    expectIssue(scene([node('a', { mood: 'furious' })]), 'nodes.0.mood', 'Invalid enum value');
  });
});
