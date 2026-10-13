// AffixSchema (DESIGN §7.3; PLAN §5.18 table `affixes`, ids `affix_*` from D-044). An affix appends its suffix to the
// display name ("Warrior's Sword of Embers") and does something different on each equipment slot; an absent slot (the
// "—" cells of the DESIGN table) means the affix cannot roll there. Effects reuse the item vocabulary (stats, resist
// steps, passives) so the engine has one code path for gear; behaviors the passive set lacks use `custom` scripts.
import { z } from 'zod';
import { ItemStatsSchema, PassiveSchema } from './item';
import { Base, DamageType, PId, Text } from './primitives';

export const AffixSlotEffectSchema = z
  .object({
    /** Tooltip line for this slot, as in the DESIGN §7.3 table cell. */
    text: Text,
    stats: ItemStatsSchema.default({}),
    /** One step toward immune per entry. */
    resistSteps: z.array(DamageType).default([]),
    passives: z.array(PassiveSchema).default([]),
  })
  .strict();
export type AffixSlotEffect = z.output<typeof AffixSlotEffectSchema>;

export const AFFIX_SLOTS = ['weapon', 'armor', 'trinket'] as const;

export const AffixSchema = Base.extend({
  id: PId('affix_'),
  /** Appended to the display name: "of Embers". */
  suffix: Text,
  weapon: AffixSlotEffectSchema.optional(),
  armor: AffixSlotEffectSchema.optional(),
  trinket: AffixSlotEffectSchema.optional(),
  /** True when only one equipped copy counts ("of Echoes": not stackable). */
  unique: z.boolean().default(false),
})
  .strict()
  .superRefine((affix, ctx) => {
    const present = AFFIX_SLOTS.filter((slot) => affix[slot] !== undefined);
    if (present.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'an affix must define at least one of weapon / armor / trinket' });
    }
    for (const slot of present) {
      const effect = affix[slot];
      if (!effect) continue;
      const hasStats = Object.values(effect.stats).some((v) => v !== 0);
      if (!hasStats && effect.resistSteps.length === 0 && effect.passives.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [slot], message: `the ${slot} effect does nothing (no stats, resist steps or passives)` });
      }
    }
  });

export type Affix = z.output<typeof AffixSchema>;
export type AffixInput = z.input<typeof AffixSchema>;
