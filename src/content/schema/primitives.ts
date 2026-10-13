// Shared zod primitives for every content schema (PLAN §5.1). Ids follow D-044: lowercase snake_case, and the type
// prefix is part of the id. Typed ids (`PId`) carry their prefix into the inferred TS type (`q_${string}` …), so a
// content literal with the wrong prefix is a type error in the editor as well as a validation error.
import { z } from 'zod';

/** Plain lowercase snake_case id (classes, companions, factions, encounters, stage/node ids …). */
export const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'expected a lowercase snake_case id');

/** D-044 typed id: the prefix is part of the id, e.g. `PId('loc_')` accepts `loc_whispering_ruins`. */
export function PId<P extends string>(prefix: P): z.ZodType<`${P}${string}`> {
  const re = new RegExp(`^${prefix}[a-z0-9_]+$`);
  return z.custom<`${P}${string}`>((v) => typeof v === 'string' && re.test(v), (v: unknown) => ({
    message: v === undefined ? 'Required' : `expected an id with prefix ${prefix} (lowercase snake_case, D-044)`,
  }));
}

/** Every item id: `item_` (incl. quest/key/recipe/tome items) or `mat_` (materials). */
export const ItemId: z.ZodType<`item_${string}` | `mat_${string}`> = z.custom<`item_${string}` | `mat_${string}`>(
  (v) => typeof v === 'string' && /^(item|mat)_[a-z0-9_]+$/.test(v),
  (v: unknown) => ({ message: v === undefined ? 'Required' : 'expected an item id with prefix item_ or mat_ (D-044)' }),
);

export const FlagId = PId('flag_');
export const EchoId = PId('echo_');
export const QuestId = PId('q_');
export const LocationId = PId('loc_');
export const RegionId = PId('region_');
export const CreatureId = PId('cr_');
export const RecipeId = PId('recipe_');
export const CodexId = PId('codex_');
export const EndingId = PId('ending_');
export const ModifierId = PId('mod_');
export const StatusId = PId('status_');
export const NpcId = PId('npc_');

export const ClassId = z.enum(['ranger', 'wizard', 'elf', 'ironclad_warden', 'shadow_weaver']);
export const CompanionId = z.enum(['ilyra', 'brak', 'nyx', 'dask', 'mireya', 'caelum']);
export const QuestStatus = z.enum(['inactive', 'active', 'completed', 'failed']);
export const Text = z.string().min(1);
export const Tags = z.array(z.string()).default([]);
/** `{ min?, max? }`, inclusive bounds. */
export const RangeSchema = z
  .object({ min: z.number().optional(), max: z.number().optional() })
  .strict()
  .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, 'range min must be ≤ max');
export type Range = z.infer<typeof RangeSchema>;
export const StatName = z.enum(['strength', 'magic', 'agility']);
export const DamageType = z.enum(['physical', 'fire', 'storm', 'ley', 'void', 'chrono']);
export const Resistance = z.enum(['weak', 'neutral', 'resist', 'immune']);
export const Rarity = z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']);
export const FactionId = z.enum(['remnants', 'weavers', 'ironclad']);
export const Voice = z.enum(['remnant_archive', 'ironclad_telling', 'weaver_fragment', 'wayfinder_notes']);
export const Stance = z.enum(['aggressive', 'guarded', 'support']);
export const Pct = z.number().min(0).max(1);
export const Watch = z.enum(['dawn', 'day', 'dusk', 'night']);
export const Base = z.object({ id: Id, tags: Tags, notes: z.string().optional() });
// `VariantText` (text with conditional variants) lives in condition.ts: it needs ConditionSchema, and keeping it there
// avoids a primitives ↔ condition import cycle.

/**
 * A union of single-key objects (`{ flag: … }`, `{ gold: … }`): the canonical shape of Conditions and Effects
 * (DESIGN §13.3). Dispatches on the one key, so errors name the atom and the exact path — `unknown condition atom
 * 'flags'` or `quest.id: expected an id with prefix q_` — instead of zod's "Invalid input" over 25 union members.
 * `atoms` is a thunk so recursive atoms (`all`, `any`, `not`) can reference the schema being defined.
 */
export function oneKeyUnion<T>(
  what: string,
  atoms: () => Readonly<Record<string, z.ZodTypeAny>>,
  hint = 'put several in a list',
): z.ZodType<T> {
  const a = /^[aeiou]/.test(what) ? `an ${what}` : `a ${what}`;
  return z.custom<T>(() => true).superRefine((value, ctx) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a} is an object with exactly one key, e.g. { flag: "flag_x" }` });
      return;
    }
    const keys = Object.keys(value);
    const table = atoms();
    if (keys.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${a} has exactly one key; got ${keys.length === 0 ? 'none' : keys.join(', ')} (${hint})`,
      });
      return;
    }
    const key = keys[0] as string;
    const schema = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
    if (!schema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `unknown ${what} atom '${key}' (expected one of: ${Object.keys(table).join(', ')})`,
      });
      return;
    }
    const result = schema.safeParse((value as Record<string, unknown>)[key]);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key, ...issue.path], message: issue.message });
      }
    }
  });
}
