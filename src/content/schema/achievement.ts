// AchievementSchema (PLAN §5.13; DESIGN §15.2: 40 achievements). An achievement is a Condition checked at the listed
// checkpoints; the first time it holds in a profile it is earned and pays its Resonance.
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { Base, PId, Text } from './primitives';

export const AchievementId = PId('ach_');
export const CHECKPOINTS = ['step', 'combat_end', 'day_end', 'loop_end', 'ending'] as const;
export const Checkpoint = z.enum(CHECKPOINTS);

export const AchievementSchema = Base.extend({
  id: AchievementId,
  name: Text,
  description: Text,
  hidden: z.boolean().default(false),
  when: ConditionSchema,
  checkpoints: z.array(Checkpoint).min(1).default(['loop_end', 'ending']),
  resonance: z.number().int().min(0).default(10),
  icon: Text,
}).strict();

export type Achievement = z.output<typeof AchievementSchema>;
export type AchievementInput = z.input<typeof AchievementSchema>;
