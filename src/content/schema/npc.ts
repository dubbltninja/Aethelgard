// NpcSchema (PLAN §5.11; WORLD §4 ids, names, factions and placement (D-064); STORY §3.3). Companions' combat data is
// `CompanionSchema` (companion.ts); an NPC that can be recruited points at it with `companionId`, and the companion
// record points back with `npcId`. A merchant NPC is also the key of its `MerchantSchema` record (WORLD §9).
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { dupes } from './creature';
import { Base, CompanionId, FactionId, LocationId, NpcId, Text } from './primitives';

const custom = z.ZodIssueCode.custom;

export const NPC_ROLES = ['questgiver', 'merchant', 'smith', 'healer', 'companion', 'lore', 'keeper'] as const;
export const NpcRole = z.enum(NPC_ROLES);

export const PortraitSchema = z.object({ sigil: z.string().min(1), accent: z.string().optional() }).strict();

export const NpcSchema = Base.extend({
  /** WORLD §4 ids (D-064); names and roles are STORY's. */
  id: NpcId,
  name: Text,
  description: Text,
  /** Kaelen = neutral (D-014). */
  factionId: z.union([FactionId, z.literal('neutral')]).default('neutral'),
  homeLocationId: LocationId,
  portrait: PortraitSchema,
  roles: z.array(NpcRole).default([]),
  /** Merchants are keyed by their NPC id (WORLD §9): when set, it is this NPC's own id. */
  merchantId: NpcId.optional(),
  /** Plain companion id; the NPC id stays npc_<name>. */
  companionId: CompanionId.optional(),
  /** One random bark shown on `examine` / idle. */
  barks: z.array(z.object({ when: ConditionSchema.optional(), text: Text }).strict()).default([]),
  legacyName: z.string().optional(),
  /** BIBLE cross-check (D-025). */
  age: z.number().int().min(0).optional(),
})
  .strict()
  .superRefine((npc, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
    if (npc.merchantId !== undefined && npc.merchantId !== npc.id) {
      issue(['merchantId'], `merchants are keyed by their NPC id: merchantId must be '${npc.id}' (WORLD §9)`);
    }
    dupes(npc.roles).forEach((i) => issue(['roles', i], `duplicate role '${npc.roles[i]}'`));
  });

export type Npc = z.output<typeof NpcSchema>;
export type NpcInput = z.input<typeof NpcSchema>;
