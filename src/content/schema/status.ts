// StatusSchema (PLAN §5.8, DESIGN §4.5). One record per status effect; the engine's `statuses.ts` implements the
// interplay table and the `special` hooks, this file only describes the data. Percent-named fields are fractions
// (-0.25 = -25 %), like `Pct`; flat fields are whole points.
import { z } from 'zod';
import { Base, DamageType, Id, StatusId, Text } from './primitives';

/** DESIGN §4.5: the 18 combat statuses plus `status_rested` (inn rest, out-of-combat only). */
export const CANONICAL_STATUSES = [
  'status_bleed', 'status_burn', 'status_shock', 'status_soaked', 'status_slow', 'status_haste', 'status_stun',
  'status_weaken', 'status_armor_break', 'status_mark', 'status_curse', 'status_shield', 'status_regen', 'status_taunt',
  'status_phase', 'status_rewind', 'status_poison', 'status_blind', 'status_rested',
] as const;
export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

export const StatusKind = z.enum(['buff', 'debuff', 'neutral']);
export const StatusExpiry = z.enum(['hit_taken', 'turn', 'ability_used']);
export const BlockedAction = z.enum(['ability', 'item', 'flee', 'guard']);

export const StatusTickSchema = z
  .object({
    timing: z.enum(['turn_start', 'turn_end']).default('turn_start'),
    /** Computed at application from the source (D-066 #4); resistance step only. No `type` = untyped (Poison). */
    damage: z
      .object({
        base: z.number(),
        coef: z.number(),
        stat: z.enum(['atk', 'sp']),
        perStack: z.boolean().default(false),
        type: DamageType.optional(),
      })
      .strict()
      .optional(),
    heal: z.object({ flat: z.number().default(0), pctMaxHp: z.number().default(0) }).strict().optional(),
  })
  .strict();

export const StatusModifiersSchema = z
  .object({
    outgoingPct: z.number().default(0),
    incomingPct: z.number().default(0),
    healingPct: z.number().default(0),
    armorWardZero: z.boolean().default(false),
    agiFlat: z.number().default(0),
    initiativeFlat: z.number().default(0),
    accuracyFlat: z.number().default(0),
    evasionFlat: z.number().default(0),
    critFlat: z.number().default(0),
    skipTurn: z.boolean().default(false),
    untargetable: z.boolean().default(false),
    forcedTargetUidFromSource: z.boolean().default(false),
    /** Shield: uses `StatusInstance.power` when set. */
    absorbFlat: z.number().default(0),
    blockActions: z.array(BlockedAction).default([]),
  })
  .strict();

export const StatusSchema = Base.extend({
  id: StatusId,
  name: Text,
  description: Text,
  kind: StatusKind,
  stackable: z.boolean().default(false),
  maxStacks: z.number().int().min(1).default(1),
  defaultDuration: z.number().int().min(1).default(2),
  tick: StatusTickSchema.optional(),
  modifiers: StatusModifiersSchema.default({}),
  expiresOn: z.array(StatusExpiry).default(['turn']),
  color: z.string(),
  icon: z.string(),
  /** 'rewind' (restore hp to the value at application), 'phase', 'taunt' … logic in the engine's statuses.ts. */
  special: Id.optional(),
})
  .strict()
  .superRefine((s, ctx) => {
    if (s.stackable && s.maxStacks <= 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxStacks'], message: 'a stackable status needs maxStacks > 1' });
    }
    if (!s.stackable && s.maxStacks > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stackable'], message: 'maxStacks > 1 needs stackable: true' });
    }
    if (s.tick && !s.tick.damage && !s.tick.heal) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tick'], message: 'a tick needs damage and/or heal' });
    }
    if (s.tick?.damage && s.tick.damage.coef <= 0 && s.tick.damage.base <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tick', 'damage'], message: 'a damage tick must deal something (base or coef > 0)' });
    }
    if (new Set(s.expiresOn).size !== s.expiresOn.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresOn'], message: 'expiresOn lists each trigger once' });
    }
  });

export type Status = z.output<typeof StatusSchema>;
export type StatusInput = z.input<typeof StatusSchema>;
