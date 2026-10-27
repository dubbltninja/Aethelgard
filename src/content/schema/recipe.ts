// RecipeSchema (PLAN §5.6, DESIGN §8.1/§8.5). Borin at the Emberforge is the only crafter, so there is no station field.
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { Base, ItemId, QuestId, RecipeId, Rarity, Text } from './primitives';

export const RepTier = z.enum(['neutral', 'trusted', 'sworn']);
const REP_RANK: Record<z.infer<typeof RepTier>, number> = { neutral: 0, trusted: 1, sworn: 2 };

export const RecipeInputSchema = z.object({ itemId: ItemId, count: z.number().int().min(1).default(1) }).strict();
/** One alternative group of an `anyOf`: every entry of the group is required together. */
export const RecipeAltInputSchema = z.object({ itemId: ItemId, count: z.number().int().min(1) }).strict();

export const RecipeSchema = Base.extend({
  id: RecipeId,
  name: Text,
  inputs: z.array(RecipeInputSchema).min(1),
  /** Alternatives, exactly one group of which must be paid on top of `inputs` (e.g. stable OR dead fragment, D-052). */
  anyOf: z.array(z.array(RecipeAltInputSchema).min(1)).default([]),
  output: z.object({ itemId: ItemId, count: z.number().int().min(1).default(1), rarity: Rarity.optional() }).strict(),
  /** Borin's fee before `att_borins_favor`; story recipes 0 (D-066 #10). */
  gold: z.number().int().min(0),
  /** A quest stage requires this recipe: no fee, and its rep gate drops while that quest is active. */
  story: z.boolean().default(false),
  /** Ironclad tier required. */
  repTier: RepTier.default('neutral'),
  /** The anchor is Neutral while `q_the_mending` or `q_iron_silence` is active (DESIGN §8.5). */
  repTierWhileActive: z
    .object({ quests: z.array(QuestId).min(1), tier: z.enum(['neutral', 'trusted']) })
    .strict()
    .optional(),
  /** Echoes, flags, Heartstone state … */
  requires: ConditionSchema.optional(),
  /** A recipe/pattern item that must have been read this loop (or known via Echo). */
  requiresItemRead: ItemId.optional(),
  /** Watches: the first craft per visit costs 1, later ones 0. */
  timeCost: z.union([z.literal(0), z.literal(1)]).default(1),
  category: z.enum(['weapon', 'armor', 'trinket', 'consumable', 'quest']),
})
  .strict()
  .superRefine((r, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (r.story && r.gold !== 0) issue(['gold'], 'a story recipe charges no fee (gold must be 0, D-066 #10)');
    const seen = new Set<string>();
    r.inputs.forEach((input, i) => {
      if (seen.has(input.itemId)) issue(['inputs', i, 'itemId'], `duplicate input ${input.itemId}; raise its count instead`);
      seen.add(input.itemId);
    });
    if (r.repTierWhileActive && REP_RANK[r.repTierWhileActive.tier] >= REP_RANK[r.repTier]) {
      issue(['repTierWhileActive', 'tier'], `repTierWhileActive must be lower than repTier (${r.repTier})`);
    }
  });

export type Recipe = z.output<typeof RecipeSchema>;
export type RecipeInput = z.input<typeof RecipeSchema>;
