// ModifierSchema (PLAN §5.13; DESIGN §15.1 challenge modifiers, D-021). Toggled at the Loom, fixed for the loop; each one
// multiplies the loop's Resonance. `rules` are interpreted by the engine (clock base, damage, XP sources …).
import { z } from 'zod';
import { AchievementId } from './achievement';
import { Base, Id, ModifierId, Pct, Text } from './primitives';

export const ModifierRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('disable_attunements') }).strict(),
  /** Frayed Clock: 80, true (DESIGN §10.1: base 20 days; every other clock modifier halved toward zero). */
  z.object({ kind: z.literal('clock_base_watches'), watches: z.number().int().min(20), halveOthers: z.boolean() }).strict(),
  z.object({ kind: z.literal('disable_echo_shortcuts') }).strict(),
  z.object({ kind: z.literal('elite_chance'), pct: Pct }).strict(),
  z.object({ kind: z.literal('damage_multiplier'), outgoing: z.number(), incoming: z.number() }).strict(),
  z.object({ kind: z.literal('xp_sources'), allow: z.array(z.enum(['combat', 'quest', 'discovery'])) }).strict(),
  z.object({ kind: z.literal('custom'), scriptId: Id }).strict(),
]);

export const ModifierSchema = Base.extend({
  id: ModifierId,
  name: Text,
  description: Text,
  rules: z.array(ModifierRuleSchema).min(1),
  achievementId: AchievementId.optional(),
  icon: Text,
}).strict();

/** D-021, DESIGN §15.1: the six challenge modifiers that must exist. */
export const REQUIRED_MODIFIERS = ['mod_iron_loop', 'mod_frayed_clock', 'mod_mute_ley', 'mod_horde_rising', 'mod_glass', 'mod_pacifist'] as const;

export type ModifierRule = z.output<typeof ModifierRuleSchema>;
export type Modifier = z.output<typeof ModifierSchema>;
export type ModifierInput = z.input<typeof ModifierSchema>;
