// CompanionSchema (PLAN §5.11; DESIGN §4.9 stances, §12.3 stats, §12.4 abilities, §12.8 Dask; D-013, D-059, D-066 #12).
// Companions have no MP: three auto abilities on kind-based cooldowns plus a signature with its own cooldown, which the
// player triggers with their action (D-053). The ability records live in the ability table (ability.ts, comp_<id>_*).
// NpcSchema (also §5.11) is U17's.
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { dupes } from './creature';
import { Base, CompanionId, DamageType, LocationId, NpcId, Pct, PId, QuestId, RegionId, Stance, StatusId, Text } from './primitives';

const int = z.number().int();
const custom = z.ZodIssueCode.custom;

export const CompanionRole = z.enum(['bruiser', 'caster', 'support', 'skirmisher']);

export const StanceRulesSchema = z
  .object({
    guardBelowHpPct: Pct.default(0.3),
    healAllyBelowPct: Pct.default(0.4),
    preferStatuses: z.boolean().default(false),
    targetRule: z.enum(['lowest_hp', 'highest_threat', 'player_target', 'random']).default('lowest_hp'),
    abilityWeight: Pct.default(0.6),
  })
  .strict();

const CompAbilityId = PId('comp_');

export const CompanionSchema = Base.extend({
  /** Plain id (D-044). */
  id: CompanionId,
  npcId: NpcId,
  name: Text,
  role: CompanionRole,
  damageType: DamageType.default('physical'),
  /** Level 1 (DESIGN §12.3). `evasion` = innate bonus (Dask's "flickering" +20). */
  stats: z
    .object({
      hp: int.min(1),
      atk: z.number().min(0),
      sp: z.number().min(0),
      agi: z.number().min(0),
      armor: z.number().min(0),
      ward: z.number().min(0),
      evasion: int.min(0).default(0),
    })
    .strict(),
  /** Armor/ward +1 per 4 levels and fixed AGI are engine rules. */
  perLevel: z.object({ hp: z.number().min(0), atk: z.number().min(0), sp: z.number().min(0) }).strict(),
  /** Auto abilities; cooldown by `kind` (DESIGN §12.4); no MP. */
  abilities: z.array(CompAbilityId).length(3, 'a companion has exactly three auto abilities (DESIGN §12.4)'),
  signature: z.object({ abilityId: CompAbilityId, cooldown: int.min(1) }).strict(),
  stances: z.record(Stance, StanceRulesSchema).default({}),
  /** Mireya: immune Poison (DESIGN §12.3). */
  statusImmunities: z.array(StatusId).default([]),
  /** 25 with the matching *_bond Echo (DESIGN §12.5). */
  startingLoyalty: int.min(0).max(100).default(0),
  /** Dask: active only where location.temporallyUnstable || infected (D-059). */
  requiresTemporallyUnstable: z.boolean().default(false),
  /** "Dask flickers and cannot follow." */
  constraintText: z.string().optional(),
  deathRule: z.enum(['ko', 'permadeath_scripted']).default('ko'),
  /** ≥ 3 after content lands (validator warns < 3). */
  arcQuestIds: z.array(QuestId).min(1),
  banter: z
    .array(
      z
        .object({ when: ConditionSchema.optional(), locationId: LocationId.optional(), regionId: RegionId.optional(), text: Text, loyalty: z.number().default(0) })
        .strict(),
    )
    .default([]),
  /** Dialogue scene ids offered at rest. */
  campScenes: z.array(PId('scene_')).default([]),
  portrait: z.object({ sigil: z.string(), accent: z.string().optional() }).strict(),
})
  .strict()
  .superRefine((c, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
    const own = `comp_${c.id}_`;
    c.abilities.forEach((a, i) => {
      if (!a.startsWith(own)) issue(['abilities', i], `${c.id}'s abilities are ${own}… (D-044)`);
    });
    dupes(c.abilities).forEach((i) => issue(['abilities', i], 'duplicate auto ability'));
    if (!c.signature.abilityId.startsWith(own)) issue(['signature', 'abilityId'], `${c.id}'s signature is ${own}… (D-044)`);
    if (c.abilities.includes(c.signature.abilityId)) issue(['signature', 'abilityId'], 'the signature is not one of the three auto abilities');
    if (c.requiresTemporallyUnstable && !c.constraintText) {
      issue(['constraintText'], 'a location-restricted companion needs constraintText (shown when it cannot follow)');
    }
    dupes(c.arcQuestIds).forEach((i) => issue(['arcQuestIds', i], 'duplicate arc quest'));
  });

export type StanceRules = z.output<typeof StanceRulesSchema>;
export type Companion = z.output<typeof CompanionSchema>;
export type CompanionInput = z.input<typeof CompanionSchema>;
