// LocationSchema (PLAN §5.3, WORLD §3, §11). Exits, items, events and art live here; the inline `encounters` use
// `EncounterSchema` from ./encounter.ts. Per-record refinements follow PLAN §5.19 rules 6–7 (cross-table checks —
// reverse exits, reachability, id resolution — are `validateContent()`, a later unit).
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { Effects } from './effect';
import { EncounterSchema } from './encounter';
import { Base, CreatureId, Id, ItemId, LocationId, NpcId, Pct, PId, Rarity, RegionId, Text } from './primitives';
import { LevelBandSchema } from './region';

export const Dir = z.enum(['north', 'south', 'east', 'west', 'up', 'down', 'in', 'out', 'portal', 'path']);

export const ExitSchema = z
  .object({
    dir: Dir,
    to: LocationId,
    /** "a hard climb north" (falls back to the destination's name). */
    label: z.string().optional(),
    /** Unmet → locked (shown with `lockedText`) unless hidden. */
    when: ConditionSchema.optional(),
    /** Legacy: "I should talk to Brak before going this way." */
    lockedText: z.string().optional(),
    /** Not displayed until `when` holds (Echo routes, D-010) or an `unlockExit` effect reveals it. */
    hidden: z.boolean().default(false),
    travelWatches: z.number().int().min(0).max(8).default(1),
    oneWay: z.boolean().default(false),
    /** Shown when the destination is horde-infected. */
    dangerText: z.string().optional(),
    /** D-069.9: 'road' = conditional road (Steppe waystones: loc_scorched_gate ↔ loc_reedmarch_descent, 1 watch). */
    kind: z.enum(['path', 'road']).default('path'),
    /**
     * Required iff `kind === 'road'`: the road does not exist (not drawn, not in graph distance or pathfinding) until
     * the gate holds, e.g. `{ echo: 'echo_steppe_waystones' }`; then it is a normal two-way exit unless `oneWay`.
     */
    gate: ConditionSchema.optional(),
  })
  .strict()
  .superRefine((x, ctx) => {
    if (x.kind === 'road' && x.gate === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gate'], message: "a road exit needs a `gate` (D-069.9)" });
    }
    if (x.kind !== 'road' && x.gate !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['kind'], message: "`gate` is only for kind: 'road' (use `when` for ordinary locks)" });
    }
  });

/**
 * A content item at a location. U34d (C1 additions, D-098 item 2): each entry appears at most once per loop, on the first
 * entry (or, if `hidden`, the first `examine` of the location) at which its `when` holds — so an item that waits for a
 * kill, a flag or a Bell turns up on a later visit; `chance` is rolled on the run Rng then, once (a miss is that loop's
 * one try); `onTake` effects apply when the player picks up what this entry placed (the Roost's greataxe: Ironclad −10
 * unless `echo_sky_oath`).
 */
export const LocationItemSchema = z
  .object({
    itemId: ItemId,
    count: z.number().int().min(1).default(1),
    when: ConditionSchema.optional(),
    rarity: Rarity.optional(),
    hidden: z.boolean().default(false),
    /** `once: false` respawns on `rest`. */
    once: z.boolean().default(true),
    /** U34d: the share of loops in which it appears at all (WORLD's "30 %", "50 % after …"). */
    chance: Pct.default(1),
    /** U34d: applied when the player takes a piece this entry placed, once per piece (source `take:<itemId>`). */
    onTake: Effects,
  })
  .strict();

/** DESIGN §8.2: a gathering node, 1–2 units per visit per day. */
export const GatherNodeSchema = z.object({ itemId: ItemId, perDay: z.number().int().min(1).max(2) }).strict();

/**
 * U34d (C1 addition): a second region's pool share at a location (WORLD §3.7 Reedmarch "pool(steppe) 10 % / pool(glowfen)
 * 10 %"). Replaces the region's own pool and rate: one return roll at the sum of the chances, then the pool by chance.
 */
export const LocationPoolSchema = z.object({ regionId: RegionId, chance: Pct }).strict();

/**
 * U34e (C1 addition, D-098 "the exploited Heartstone's +1 level"): while `when` holds, the named creatures fight here as a
 * variant `levels` above their own (WORLD §3.3 the Hollow, `ws_heartstone_exploited`: "Void-touched +1 level variants").
 * The engine scales HP, ATK/SP and kill XP by DESIGN §6.5/§6.2's per-level rules (combat/turnOrder.ts `levelVariant`).
 */
export const LevelBonusSchema = z
  .object({ when: ConditionSchema, creatures: z.array(CreatureId).min(1), levels: z.number().int().min(1).max(3) })
  .strict();

export const LocationEventSchema = Base.extend({
  id: PId('ev_'),
  text: Text,
  once: z.boolean().default(true),
  when: ConditionSchema.optional(),
  trigger: z.enum(['enter', 'rest', 'dawn', 'leave', 'interact']).default('enter'),
  /** For trigger 'interact': the button text ("Touch the Heartstone"). */
  label: z.string().optional(),
  effects: Effects,
})
  .strict()
  .superRefine((e, ctx) => {
    if (e.trigger === 'interact' && (e.label === undefined || e.label === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['label'], message: "an 'interact' event needs a button `label`" });
    }
  });

export const LocationArtSchema = z
  .object({
    template: z.enum([
      'ruins', 'forest', 'cavern', 'swamp', 'peaks', 'spires', 'void', 'observatory', 'breach', 'camp', 'forge', 'shore',
      'city', 'archive', 'steppe', 'sky', 'threshold', 'undercity', 'sanctum', 'custom',
    ]),
    horizon: Pct.default(0.6),
    /** Keys from the src/ui/art/shapes registry; the validator warns on unknown. */
    silhouettes: z.array(z.string()).default([]),
    particles: z.enum(['none', 'motes', 'embers', 'spores', 'ash', 'static', 'shards', 'rain', 'fireflies', 'snow', 'pollen']).default('none'),
    /** Key in the src/ui/art/focal registry (hand-authored piece). */
    focal: z.string().optional(),
    timeOfDay: z.enum(['dawn', 'day', 'dusk', 'night', 'timeless']).default('dusk'),
    /** e.g. the Depths go dark. */
    variants: z.array(z.object({ when: ConditionSchema, patch: z.record(z.unknown()) }).strict()).default([]),
  })
  .strict();

export const LocationRestSchema = z
  .object({
    kind: z.enum(['camp', 'inn', 'sanctum', 'wild']),
    cost: z.number().int().min(0).default(0),
    healPct: Pct.default(1),
    companionSwap: z.boolean().default(true),
    when: ConditionSchema.optional(),
    text: z.string().optional(),
    /** Wild camps. */
    ambushChance: Pct.default(0),
  })
  .strict();

const findDuplicates = (ids: readonly string[]): number[] => {
  const seen = new Set<string>();
  const dup: number[] = [];
  ids.forEach((id, i) => {
    if (seen.has(id)) dup.push(i);
    seen.add(id);
  });
  return dup;
};

export const LocationSchema = Base.extend({
  id: LocationId,
  regionId: RegionId,
  name: Text,
  description: Text,
  descriptionVariants: z.array(z.object({ when: ConditionSchema, text: Text }).strict()).default([]),
  exits: z.array(ExitSchema).default([]),
  items: z.array(LocationItemSchema).default([]),
  encounters: z.array(EncounterSchema).default([]),
  npcs: z.array(NpcId).default([]),
  events: z.array(LocationEventSchema).default([]),
  art: LocationArtSchema,
  /** Overrides the region's ambient preset. */
  ambient: Id.optional(),
  rest: LocationRestSchema.optional(),
  /** Keyed by the merchant NPC's id (WORLD §9). */
  merchantId: NpcId.optional(),
  craftingStation: z.enum(['forge', 'alchemy', 'loom', 'anchor']).optional(),
  /** Overrides the region's band. */
  levelBand: LevelBandSchema.optional(),
  map: z.object({ x: z.number(), y: z.number() }).strict(),
  /** No wandering encounters. */
  safe: z.boolean().default(false),
  /** D-059 static flag (Dask); Horde infection adds it at runtime. */
  temporallyUnstable: z.boolean().default(false),
  /**
   * DESIGN §8.2: 1–2 units per visit per day. U34d (C1 change): one node or a list of them, read as a list (the Rootbone's
   * bark gives `mat_rootbone` and `mat_ley_resin`); with several, `gather` names the node by `itemId`.
   */
  gather: z
    .union([GatherNodeSchema, z.array(GatherNodeSchema).min(1)])
    .transform((g) => (Array.isArray(g) ? g : [g]))
    .optional(),
  /** U34d: the location's return rolls draw from these pools instead of its region's (see `LocationPoolSchema`). */
  wanderingPools: z.array(LocationPoolSchema).min(1).optional(),
  /** U34e: level variants of creatures fighting here (see `LevelBonusSchema`); the first entry that holds and names it wins. */
  levelBonus: z.array(LevelBonusSchema).default([]),
  /** The `wait` action is allowed. */
  waitable: z.boolean().default(false),
  /** Original Python name, for Appendix A / BIBLE cross-check. */
  legacyName: z.string().optional(),
})
  .strict()
  .superRefine((loc, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    loc.exits.forEach((exit, i) => {
      if (exit.to === loc.id) issue(['exits', i, 'to'], 'an exit cannot lead to its own location');
    });
    // Directions are unique per location (PLAN §5.19 rule 7); 'path' is the generic direction (roads, side trails) and may repeat.
    const dirs = loc.exits.map((exit, i) => (exit.dir === 'path' ? `path#${i}` : exit.dir));
    for (const i of findDuplicates(dirs)) issue(['exits', i, 'dir'], `direction '${loc.exits[i]?.dir}' is used by two exits; use 'path' for extra routes`);
    for (const i of findDuplicates(loc.encounters.map((e) => e.id))) issue(['encounters', i, 'id'], `duplicate encounter id '${loc.encounters[i]?.id}' in this location`);
    for (const i of findDuplicates(loc.events.map((e) => e.id))) issue(['events', i, 'id'], `duplicate event id '${loc.events[i]?.id}' in this location`);
    const nodes = loc.gather ?? [];
    for (const i of findDuplicates(nodes.map((g) => g.itemId))) issue(['gather', i, 'itemId'], `'${nodes[i]?.itemId}' is gathered by two nodes here; raise its perDay instead`);
    const pools = loc.wanderingPools ?? [];
    for (const i of findDuplicates(pools.map((p) => p.regionId))) issue(['wanderingPools', i, 'regionId'], `pool '${pools[i]?.regionId}' is listed twice`);
    if (loc.safe && pools.length > 0) issue(['wanderingPools'], 'a safe location rolls no wandering pool');
  });

export type Dir = z.output<typeof Dir>;
export type Exit = z.output<typeof ExitSchema>;
export type ExitInput = z.input<typeof ExitSchema>;
export type LocationItem = z.output<typeof LocationItemSchema>;
export type GatherNode = z.output<typeof GatherNodeSchema>;
export type LocationPool = z.output<typeof LocationPoolSchema>;
export type LevelBonus = z.output<typeof LevelBonusSchema>;
export type LocationEvent = z.output<typeof LocationEventSchema>;
export type LocationArt = z.output<typeof LocationArtSchema>;
export type Location = z.output<typeof LocationSchema>;
export type LocationInput = z.input<typeof LocationSchema>;
