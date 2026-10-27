// EncounterSchema (PLAN §5.3, WORLD §10, DESIGN §4.7). Used inline by `LocationSchema.encounters` and as the record
// type of the pack's `encounters` table (fixed, wandering-pool and anomaly encounters). `onFlee` (what a successful
// flee does to the group) and `onFleeEffects` (extra effects) are separate fields (D-071.1).
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { Effects } from './effect';
import { Base, CreatureId, Id, Pct } from './primitives';

export const EncounterGroupSchema = z.object({ creatureId: CreatureId, count: z.number().int().min(1).max(3).default(1) }).strict();

export const EncounterSchema = Base.extend({
  groups: z.array(EncounterGroupSchema).min(1),
  chance: Pct.default(1),
  when: ConditionSchema.optional(),
  /** DESIGN §13.3 #8 (Golem shortcut): when true the fight can be bypassed without fighting (not forced). */
  optionalWhen: ConditionSchema.optional(),
  /** Cleared for the loop after victory. */
  once: z.boolean().default(true),
  respawn: z.enum(['never', 'daily', 'on_return']).default('never'),
  /** False only for bosses and story gates (D-066 #11). */
  fleeable: z.boolean().default(true),
  /** Fixed groups scatter; wandering rolls → previous node; bosses and story gates hold; quest-drop groups regroup at dawn (DESIGN §4.7, D-144: `regroup` a C1 addition of U81c). */
  onFlee: z.enum(['scatter', 'hold', 'previous', 'regroup']).default('scatter'),
  ambush: z.boolean().default(false),
  intro: z.string().optional(),
  onVictory: Effects,
  onDefeat: Effects,
  onFleeEffects: Effects,
  /** Horde Rising modifier upgrades non-elites. */
  elite: z.boolean().default(false),
  /**
   * U81a (D-121, DESIGN §16.8; C1 addition): the opening intents of this fight, in order, when `when` holds as it starts —
   * each enemy that has the move shows it as its next intent (the first Shade: Wail, then Rake, so Guard visibly halves the
   * second); its own pattern then runs from its start.
   */
  forcedIntents: z.object({ when: ConditionSchema.optional(), moves: z.array(Id).min(1) }).strict().optional(),
})
  .strict()
  .superRefine((e, ctx) => {
    const seen = new Set<string>();
    e.groups.forEach((g, i) => {
      if (seen.has(g.creatureId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['groups', i, 'creatureId'], message: `${g.creatureId} appears in two groups; raise its count instead` });
      }
      seen.add(g.creatureId);
    });
    const total = e.groups.reduce((n, g) => n + g.count, 0);
    if (total > 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['groups'], message: `an encounter fields 1–3 enemies in slots (DESIGN §4.8); got ${total}` });
    }
  });

export type EncounterGroup = z.output<typeof EncounterGroupSchema>;
export type Encounter = z.output<typeof EncounterSchema>;
export type EncounterInput = z.input<typeof EncounterSchema>;
