// RegionSchema (PLAN §5.2, DESIGN §6.5/§17.1, WORLD §2). Level bands are fixed and creatures do not scale (D-009).
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { Base, CodexId, CreatureId, FactionId, Id, Pct, RegionId, Text } from './primitives';

/** Inclusive character-level band of a region or location. */
export const LevelBandSchema = z
  .object({ min: z.number().int().min(1), max: z.number().int().min(1) })
  .strict()
  .refine((b) => b.min <= b.max, 'level band min must be ≤ max');

export const RegionPaletteSchema = z
  .object({
    bg: z.string(),
    bgAlt: z.string(),
    fg: z.string(),
    accent: z.string(),
    glow: z.string(),
    danger: z.string().optional(),
  })
  .strict();

export const RegionSchema = Base.extend({
  id: RegionId,
  name: Text,
  description: Text,
  /** Map/codex ordering. */
  order: z.number().int(),
  levelBand: LevelBandSchema,
  /** One of the five legacy regions (D-015). */
  legacy: z.boolean().default(false),
  factionId: FactionId.optional(),
  /** CSS colors, applied by <RegionPalette/>. */
  palette: RegionPaletteSchema,
  /** Ambient preset id in src/audio/ambient (validated against a registry list). */
  ambient: Id,
  wanderingPool: z.array(z.object({ creatureId: CreatureId, weight: z.number().positive().default(1) }).strict()).default([]),
  returnEncounterChance: Pct.default(0.2),
  codexId: CodexId.optional(),
  /** e.g. Silverwood Before: { loop: { min: 2 } }. */
  unlockWhen: ConditionSchema.optional(),
})
  .strict()
  .superRefine((r, ctx) => {
    const seen = new Set<string>();
    r.wanderingPool.forEach((entry, i) => {
      if (seen.has(entry.creatureId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['wanderingPool', i, 'creatureId'], message: `${entry.creatureId} is in the wandering pool twice; raise its weight instead` });
      }
      seen.add(entry.creatureId);
    });
  });

export type Region = z.output<typeof RegionSchema>;
export type RegionInput = z.input<typeof RegionSchema>;
