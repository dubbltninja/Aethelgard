// The canonical Condition set (DESIGN §13.3, PLAN §4.9; D-033 as revised by D-066 #16). One atom per object key;
// object forms wherever an atom has more than one field; every id a full D-044 id; unknown keys fail (`.strict()`).
// `Condition` is declared (zod cannot infer a recursive type) and every atom schema is checked against it by the
// `{ [K in ConditionKey]: z.ZodType<ConditionAtoms[K]> }` annotation, so the type and the schema cannot drift.
import { z } from 'zod';
import {
  ClassId,
  CompanionId,
  CreatureId,
  EchoId,
  FactionId,
  FlagId,
  Id,
  ItemId,
  LocationId,
  ModifierId,
  QuestId,
  QuestStatus,
  RangeSchema,
  StatName,
  Text,
  Watch,
  oneKeyUnion,
  type Range,
} from './primitives';

export type { Range };
type Bounds = { min?: number; max?: number };

/** Atom name → its value. `Condition` is the union of the single-key objects built from this map. */
export interface ConditionAtoms {
  all: Condition[];
  any: Condition[];
  not: Condition;
  /** True if set this loop. */
  flag: `flag_${string}`;
  /** In the profile (any loop) or granted this loop. */
  echo: `echo_${string}`;
  /** `stage` = current stage id; neither stage nor status = active or completed. */
  quest: { id: `q_${string}`; stage?: string; status?: z.infer<typeof QuestStatus> };
  /** count default 1; inventory + satchel + equipped. */
  item: { id: `item_${string}` | `mat_${string}`; count?: number };
  rep: { faction: z.infer<typeof FactionId> } & Bounds;
  loop: Range;
  /** Breach Clock day (1-based). */
  day: Range;
  level: Range;
  /** The watch of day; inside Silverwood Before (frozen clock) the echo's own hour (U34d, engine before.ts). */
  watch: z.infer<typeof Watch>;
  /** Dawns before the limit: ⌊(limitTicks − ticks) / 4⌋ (ending E: `{ max: 1 }`). */
  clock: { daysLeft: Range };
  /** Silverwood Before counter (DESIGN §10.1); false outside the Before. */
  beforeDay: 1 | 2 | 3;
  beforeResets: Range;
  class: z.infer<typeof ClassId>;
  /** Primaries only (D-044). */
  stat: { name: z.infer<typeof StatName> } & Bounds;
  /** `state` default `active`. */
  companion: { id: z.infer<typeof CompanionId>; state?: 'active' | 'recruited' | 'ko' };
  loyalty: { companion: z.infer<typeof CompanionId> } & Bounds;
  corruption: Range;
  /** Current node. */
  location: `loc_${string}`;
  /** This loop; `sinceStage` counts only kills after the current quest stage began. */
  killed: { id: `cr_${string}`; count?: number; sinceStage?: boolean };
  /** Named counters; engine-maintained: `quests_completed` (D-048), `factions_trusted`. */
  counter: { name: string } & Bounds;
  /** Communion only (DESIGN §4.11); false outside communion. */
  resolve: Range;
  /** Active challenge modifier. */
  modifier: `mod_${string}`;
  /** U34d (C1 addition): the current location is in the Horde's infected set (WORLD §12.1 `ws_infected`). */
  infected: true;
}

export type ConditionKey = keyof ConditionAtoms;
export type Condition = { [K in ConditionKey]: { [P in K]: ConditionAtoms[P] } }[ConditionKey];

const bounds = { min: z.number().optional(), max: z.number().optional() };
const ordered = (b: Bounds) => b.min === undefined || b.max === undefined || b.min <= b.max;
const lazyCondition: z.ZodType<Condition> = z.lazy(() => ConditionSchema);

export const CONDITION_ATOMS: { readonly [K in ConditionKey]: z.ZodType<ConditionAtoms[K]> } = {
  all: z.array(lazyCondition),
  any: z.array(lazyCondition).min(1, '`any` needs at least one condition'),
  not: lazyCondition,
  flag: FlagId,
  echo: EchoId,
  quest: z.object({ id: QuestId, stage: Id.optional(), status: QuestStatus.optional() }).strict(),
  item: z.object({ id: ItemId, count: z.number().int().min(1).optional() }).strict(),
  rep: z.object({ faction: FactionId, ...bounds }).strict().refine(ordered, 'min must be ≤ max'),
  loop: RangeSchema,
  day: RangeSchema,
  level: RangeSchema,
  watch: Watch,
  clock: z.object({ daysLeft: RangeSchema }).strict(),
  beforeDay: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  beforeResets: RangeSchema,
  class: ClassId,
  stat: z.object({ name: StatName, ...bounds }).strict().refine(ordered, 'min must be ≤ max'),
  companion: z.object({ id: CompanionId, state: z.enum(['active', 'recruited', 'ko']).optional() }).strict(),
  loyalty: z.object({ companion: CompanionId, ...bounds }).strict().refine(ordered, 'min must be ≤ max'),
  corruption: RangeSchema,
  location: LocationId,
  killed: z.object({ id: CreatureId, count: z.number().int().min(1).optional(), sinceStage: z.boolean().optional() }).strict(),
  counter: z.object({ name: z.string().min(1), ...bounds }).strict().refine(ordered, 'min must be ≤ max'),
  resolve: RangeSchema,
  modifier: ModifierId,
  infected: z.literal(true),
};

export const CONDITION_KEYS = Object.keys(CONDITION_ATOMS) as ConditionKey[];

export const ConditionSchema: z.ZodType<Condition> = oneKeyUnion<Condition>('condition', () => CONDITION_ATOMS, 'combine with { all: [...] }');

/** Text with conditional variants (PLAN §5.1); the first matching variant wins, else `text`. */
export const VariantText = z
  .object({ text: Text, variants: z.array(z.object({ when: ConditionSchema, text: Text }).strict()).default([]) })
  .strict();
