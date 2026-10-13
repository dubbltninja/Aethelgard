// AttunementSchema (PLAN §5.13; DESIGN §10.7: 15 Attunements bought with Resonance at the Loom; D-066 #15). Owned forever,
// no ranks. The cap that keeps them a convenience is the equip cap of 5 (`GameConfig.attunementEquipCap`, REVIEW-CROSS
// C-41), enforced by the engine (`equipAttunement`) and checked by the validator; there is no power budget.
// Percent fields (`pct`) are fractions (0.1 = 10 %), as in AffixSchema.
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { Base, ItemId, PId, RegionId, StatName, Text } from './primitives';

const int = z.number().int();

export const AttunementId = PId('att_');

export const AttunementEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start_gold'), amount: int }).strict(),
  z.object({ kind: z.literal('start_item'), itemId: ItemId, count: int.min(1).default(1) }).strict(),
  z.object({ kind: z.literal('stat'), stat: StatName, amount: int }).strict(),
  z.object({ kind: z.literal('hp_max_pct'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('clock_watches'), watches: int }).strict(),
  z.object({ kind: z.literal('xp_pct'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('shop_discount_pct'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('ability_points'), amount: int }).strict(),
  z.object({ kind: z.literal('reveal_region'), regionId: RegionId }).strict(),
  z.object({ kind: z.literal('loyalty_start'), amount: int }).strict(),
  z.object({ kind: z.literal('rest_heal_pct'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('flee_pct'), pct: z.number() }).strict(),
]);

export const AttunementSchema = Base.extend({
  id: AttunementId,
  name: Text,
  description: Text,
  /** Resonance (DESIGN §10.7); owned forever, no ranks. */
  cost: int.min(1),
  effects: z.array(AttunementEffectSchema).min(1),
  /** `att_steady_hours` requires `echo_breach_clock`. */
  requires: ConditionSchema.optional(),
  icon: Text,
}).strict();

export type AttunementEffect = z.output<typeof AttunementEffectSchema>;
export type Attunement = z.output<typeof AttunementSchema>;
export type AttunementInput = z.input<typeof AttunementSchema>;
