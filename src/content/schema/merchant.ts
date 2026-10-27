// MerchantSchema (PLAN §5.15; DESIGN §9.2 price formula, §9.3 restock, §9.4 stock themes; WORLD §9 merchants and stock).
// Merchants are keyed by their NPC id (WORLD §9; REGISTRY §23): `id` and `npcId` are the same string. Restock is every
// dawn (D-057): core stock refilled and the theme picks re-rolled; Anso restocks each Before day (an engine rule).
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { dupes } from './creature';
import { Base, FactionId, ItemId, NpcId, Rarity, Text } from './primitives';

const int = z.number().int();
const custom = z.ZodIssueCode.custom;

export const MERCHANT_SERVICES = ['buy', 'sell', 'upgrade', 'cleanse', 'identify'] as const;
export const MerchantService = z.enum(MERCHANT_SERVICES);

export const StockEntrySchema = z
  .object({
    itemId: ItemId,
    count: z.union([int.min(1), z.literal('unlimited')]).default(1),
    when: ConditionSchema.optional(),
    priceMult: z.number().positive().default(1),
    rarity: Rarity.optional(),
    /** Roll the item's rarity by band weights (DESIGN §7.2) instead of using `rarity`. */
    rollRarity: z.boolean().default(true),
  })
  .strict();

export const MerchantSchema = Base.extend({
  /** The NPC id. */
  id: NpcId,
  npcId: NpcId,
  name: Text,
  /** The core list: always present, refilled each dawn. */
  stock: z.array(StockEntrySchema).min(1),
  /** Legacy Kaelen: 3–4 random gear from a pool, re-rolled each dawn. */
  rollStock: z
    .object({
      pool: z.array(ItemId).min(1),
      pick: z.object({ min: int.min(0), max: int.min(1) }).strict(),
    })
    .strict()
    .optional(),
  /** DESIGN §9.2, per merchant. */
  regionMarkup: z.number().positive().default(1),
  /** Legacy 75 % (DESIGN §7.5). */
  sellMult: z.number().positive().default(0.75),
  /**
   * `tier_mod` follows the player's tier with this faction: Hostile refuses / Wary ×1.15 / Neutral ×1 / Trusted ×0.90 /
   * Sworn ×0.80 (DESIGN §9.2). `'best'` = the best of the three tracks and never refuses (Kaelen). Absent = no faction
   * (Old Fennick, Anso): ×1.0, never refuses.
   */
  repFaction: z.union([FactionId, z.literal('best')]).optional(),
  refusesWhen: ConditionSchema.optional(),
  services: z.array(MerchantService).min(1).default(['buy', 'sell']),
})
  .strict()
  .superRefine((m, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
    if (m.npcId !== m.id) issue(['npcId'], `merchants are keyed by their NPC id: npcId must equal id '${m.id}' (WORLD §9)`);
    if (m.rollStock && m.rollStock.pick.min > m.rollStock.pick.max) issue(['rollStock', 'pick'], 'pick min must be ≤ max');
    dupes(m.services).forEach((i) => issue(['services', i], `duplicate service '${m.services[i]}'`));
    // The same item may appear twice only under different `when`s (a quest-priced variant); unconditional repeats are a typo.
    const open = m.stock.map((s, i) => ({ id: s.itemId, i })).filter(({ i }) => m.stock[i]?.when === undefined);
    dupes(open.map((o) => o.id)).forEach((k) => issue(['stock', open[k]?.i ?? 0, 'itemId'], `${open[k]?.id} is stocked twice; raise its count instead`));
  });

export type StockEntry = z.output<typeof StockEntrySchema>;
export type Merchant = z.output<typeof MerchantSchema>;
export type MerchantInput = z.input<typeof MerchantSchema>;
