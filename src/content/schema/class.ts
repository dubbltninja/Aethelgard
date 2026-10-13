// ClassSchema (PLAN §5.7; DESIGN §3.3 base stats and growth, §5.2–5.6 resources, branches and starting kits; D-008).
// Resource rules drive class resource generation (PLAN §4.10): Ranger Focus, Wizard regen 3 + ⌊level/4⌋, Elf on dodge
// and crit, Warden Grit, Weaver Blood price.
import { z } from 'zod';
import { PREFIX_OF_CLASS } from './ability';
import { dupes } from './creature';
import { Base, ClassId, Id, ItemId, PId, Text } from './primitives';

const int = z.number().int();
const custom = z.ZodIssueCode.custom;

/** What generates class resource. `basic_crit` = a basic attack that crits (Ranger +12 instead of +8); `crit` = any crit. */
export const ResourceEvent = z.enum(['basic_hit', 'basic_crit', 'crit', 'guard', 'hit_taken', 'dodge', 'taunt', 'turn_start']);

export const ResourceRuleSchema = z
  .object({
    on: ResourceEvent,
    amount: z.number().optional(),
    pctMax: z.number().optional(),
    /** Wizard: 3 + ⌊level/4⌋ = { amount: 3, perLevel: { every: 4, add: 1 } } (D-066 #3). */
    perLevel: z.object({ every: int.min(1), add: z.number() }).strict().optional(),
  })
  .strict()
  .refine((r) => r.amount !== undefined || r.pctMax !== undefined, 'a resource rule needs amount and/or pctMax');

export const ClassSchema = Base.extend({
  id: ClassId,
  name: Text,
  /** "hunter of the wilds between settlements". */
  title: Text,
  description: Text,
  /** Class-select blurb (legacy intros preserved for Ranger/Wizard/Elf). */
  intro: Text,
  baseStats: z
    .object({ hp: int.min(1), mp: int.min(0), strength: int.min(0), magic: int.min(0), agility: int.min(0) })
    .strict(),
  /** DESIGN §3.3; +1 stat point and +2 half-AP per level are global. */
  growth: z.object({ hp: int.min(0), mp: int.min(0) }).strict(),
  resource: z
    .object({
      /** Focus / Mana / Mana / Grit / Mana. */
      name: Text,
      rules: z.array(ResourceRuleSchema).min(1),
      /** Shadow Weaver: 2 HP per missing MP. */
      bloodPrice: z.object({ hpPerMp: z.number().positive() }).strict().optional(),
    })
    .strict(),
  branches: z.array(z.object({ id: Id, name: Text, description: Text }).strict()).length(3, 'a class has exactly three branches (D-008)'),
  starterItems: z.array(z.object({ itemId: ItemId, equip: z.boolean().default(false), count: int.min(1).default(1) }).strict()),
  startingAbilities: z.array(Id).default([]),
  startingGold: int.min(0).default(30),
  /** D-008: one class mini-quest, q_class_<class>; Loop 2+ only (D-069.7). */
  uniqueQuestId: PId('q_class_').optional(),
  /** Used by `{ class: id }` conditions and text tokens. */
  dialogueTag: Id,
  sigil: Text,
  legacy: z.boolean().default(false),
})
  .strict()
  .superRefine((c, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
    dupes(c.branches.map((b) => b.id)).forEach((i) => issue(['branches', i, 'id'], `duplicate branch id '${c.branches[i]?.id}'`));
    dupes(c.resource.rules.map((r) => r.on)).forEach((i) => issue(['resource', 'rules', i, 'on'], 'one rule per event'));
    dupes(c.starterItems.map((s) => s.itemId)).forEach((i) => issue(['starterItems', i, 'itemId'], 'list each starter item once (use count)'));
    if (c.uniqueQuestId !== undefined && c.uniqueQuestId !== `q_class_${c.id}`) {
      issue(['uniqueQuestId'], `the ${c.id} mini-quest is q_class_${c.id} (D-008)`);
    }
    const prefix = `${PREFIX_OF_CLASS[c.id]}_`;
    c.startingAbilities.forEach((a, i) => {
      if (!a.startsWith(prefix)) issue(['startingAbilities', i], `${c.id} abilities start with ${prefix} (D-061)`);
    });
  });

export type Class = z.output<typeof ClassSchema>;
export type ClassInput = z.input<typeof ClassSchema>;
