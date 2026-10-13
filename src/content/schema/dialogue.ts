// DialogueSchema (PLAN §5.10; DESIGN §13.2; STORY §13 key scenes). A scene is a graph of nodes; `talk` to an NPC picks the
// highest-priority available scene, `entry` picks the first node, a node shows its text (first matching variant) and its
// choices, and `next: 'end'` closes the scene. Scene ids are `scene_*` (D-044); node and choice ids are plain ids unique
// inside the scene (`flag_choice_<scene>_<choice>`, `flag_scene_done_<scene>` are written by the engine, C-58).
// Per-record structure (duplicate ids, node references, hotkeys) is checked here; "every node reachable", "no `continue`
// cycles" and speaker resolution are `validateContent()` (PLAN §5.19 rule 10).
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { dupes } from './creature';
import { Effects } from './effect';
import { Base, CompanionId, EchoId, Id, NpcId, PId, Text } from './primitives';

const custom = z.ZodIssueCode.custom;

export const SceneId = PId('scene_');
/** Where a choice or node goes: a node id of the same scene, or `'end'`. */
export const NodeTarget = z.union([Id, z.literal('end')]);
/** UI glyph on a choice (DESIGN §13.2). */
export const ChoiceTag = z.enum(['echo', 'class', 'faction', 'companion']);
export const Mood = z.enum(['neutral', 'warm', 'grim', 'urgent', 'afraid', 'wry', 'cold']);

export const DialogueChoiceSchema = Base.extend({
  text: Text,
  /** Hidden when false (use `disabledText`/`disabledWhen` to show it greyed instead). */
  when: ConditionSchema.optional(),
  disabledText: z.string().optional(),
  effects: Effects,
  next: NodeTarget,
  /** UI marks the choice with the Echo sigil (D-010: "I know what you are, Nyx"). */
  echoHint: EchoId.optional(),
  /** Per scene visit. */
  once: z.boolean().default(false),
  /** Writes flag `flag_choice_<sceneId>_<choiceId>` (C-58). */
  oncePerLoop: z.boolean().default(false),
  /** Shown greyed with its reason ("(You do not yet know this)"). */
  disabledWhen: ConditionSchema.optional(),
  /** Overrides `Base.tags`: the UI glyphs of DESIGN §13.2. */
  tags: z.array(ChoiceTag).default([]),
  hotkey: z.string().regex(/^[1-9]$/, 'a hotkey is one digit, 1–9').optional(),
}).strict();

export const DialogueNodeSchema = Base.extend({
  /** An NPC id (`npc_*`), a companion id, a creature id (the Tyrant), or `narrator` / `player` / `companion`. */
  speaker: Id,
  text: Text,
  textVariants: z.array(z.object({ when: ConditionSchema, text: Text }).strict()).default([]),
  choices: z.array(DialogueChoiceSchema).default([]),
  /** Where a choice-less node goes (the validator requires it when `choices` is empty). */
  next: NodeTarget.optional(),
  onEnter: Effects,
  mood: Mood.default('neutral'),
  /** Optional focal art key for the dialogue backdrop. */
  art: z.string().optional(),
}).strict();

export const DialogueEntrySchema = z.union([Id, z.array(z.object({ when: ConditionSchema, node: Id }).strict()).min(1)]);

export const DialogueSceneSchema = Base.extend({
  id: SceneId,
  /** The scene is offered by `talk` to this NPC (absent: started only via `startDialogue`). */
  npcId: NpcId.optional(),
  title: z.string().optional(),
  /** Availability. */
  when: ConditionSchema.optional(),
  /** Highest available wins on `talk`. */
  priority: z.number().int().default(0),
  /** False → flag `flag_scene_done_<scene>` set at the end (C-58). */
  repeatable: z.boolean().default(true),
  /** First match, else the first node. */
  entry: DialogueEntrySchema,
  nodes: z.array(DialogueNodeSchema).min(1),
  onEnd: Effects,
  companionReactions: z
    .array(z.object({ companionId: CompanionId, when: ConditionSchema.optional(), text: Text, loyalty: z.number().default(0) }).strict())
    .default([]),
})
  .strict()
  .superRefine((scene, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
    const nodeIds = new Set(scene.nodes.map((n) => n.id));
    const target = (to: string, path: (string | number)[]) => {
      if (to !== 'end' && !nodeIds.has(to)) issue(path, `'${to}' is not a node of ${scene.id} (or 'end')`);
    };
    dupes(scene.nodes.map((n) => n.id)).forEach((i) => issue(['nodes', i, 'id'], `duplicate node id '${scene.nodes[i]?.id}'`));
    if (typeof scene.entry === 'string') {
      if (!nodeIds.has(scene.entry)) issue(['entry'], `'${scene.entry}' is not a node of ${scene.id}`);
    } else {
      scene.entry.forEach((rule, i) => {
        if (!nodeIds.has(rule.node)) issue(['entry', i, 'node'], `'${rule.node}' is not a node of ${scene.id}`);
      });
    }
    scene.nodes.forEach((node, ni) => {
      if (node.next !== undefined) target(node.next, ['nodes', ni, 'next']);
      dupes(node.choices.map((c) => c.id)).forEach((i) => issue(['nodes', ni, 'choices', i, 'id'], `duplicate choice id '${node.choices[i]?.id}'`));
      const hotkeys = node.choices.map((c, i) => c.hotkey ?? `\0${i}`);
      dupes(hotkeys).forEach((i) => issue(['nodes', ni, 'choices', i, 'hotkey'], `hotkey '${node.choices[i]?.hotkey}' is used twice in this node`));
      node.choices.forEach((choice, ci) => target(choice.next, ['nodes', ni, 'choices', ci, 'next']));
    });
  });

export type DialogueChoice = z.output<typeof DialogueChoiceSchema>;
export type DialogueNode = z.output<typeof DialogueNodeSchema>;
export type DialogueScene = z.output<typeof DialogueSceneSchema>;
export type DialogueSceneInput = z.input<typeof DialogueSceneSchema>;
