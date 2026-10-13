// EncounterSchema (PLAN §5.3, WORLD §10, DESIGN §4.7). Used inline by `LocationSchema.encounters` and as the record
// type of the pack's `encounters` table (fixed, wandering-pool and anomaly encounters). `onFlee` (what a successful
// flee does to the group) and `onFleeEffects` (extra effects) are separate fields (D-071.1).
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { Effects } from './effect';
import { Base, CreatureId, Pct } from './primitives';

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
  /** Fixed groups scatter; wandering rolls → previous node; bosses and story gates hold (DESIGN §4.7). */
  onFlee: z.enum(['scatter', 'hold', 'previous']).default('scatter'),
  ambush: z.boolean().default(false),
  intro: z.string().optional(),
  onVictory: Effects,
  onDefeat: Effects,
  onFleeEffects: Effects,
  /** Horde Rising modifier upgrades non-elites. */
  elite: z.boolean().default(false),
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
