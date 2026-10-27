// FactionSchema (PLAN §5.15; DESIGN §11 factions and reputation, D-014 tiers). Three factions (D-013 world): remnants,
// weavers, ironclad. Tier boundaries and price multipliers are `GameConfig` (contentPack.ts); this record is the text.
import { z } from 'zod';
import { FactionId, Text } from './primitives';

export const REP_TIER_NAMES = ['hostile', 'wary', 'neutral', 'trusted', 'sworn'] as const;
export const RepTierName = z.enum(REP_TIER_NAMES);

export const FactionSchema = z
  .object({
    id: FactionId,
    name: Text,
    shortName: Text,
    description: Text,
    /** CSS color of the faction's chips. */
    color: Text,
    /** One line per tier (every tier needs one). */
    tierTexts: z.object({ hostile: Text, wary: Text, neutral: Text, trusted: Text, sworn: Text }).strict(),
  })
  .strict();

export type Faction = z.output<typeof FactionSchema>;
export type FactionInput = z.input<typeof FactionSchema>;
