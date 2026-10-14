// The canonical Effect set (DESIGN §13.3, PLAN §4.9; D-066 #16, D-069.9). One atom per object key, object forms for
// multi-field atoms, full D-044 ids, `.strict()` everywhere. Effect types are inferred from the atom schemas.
// Clock effects are always in watches (D-066 #15). Combat-scope atoms (COMBAT_SCOPE_EFFECTS) are legal only in creature
// data — a Move's `effects`, a phase's `onEnter` — which `validateContent()` (U19) enforces.
import { z } from 'zod';
import {
  CodexId,
  CompanionId,
  CreatureId,
  EchoId,
  EndingId,
  FactionId,
  FlagId,
  Id,
  ItemId,
  LocationId,
  Pct,
  QuestId,
  Rarity,
  RecipeId,
  Text,
  oneKeyUnion,
} from './primitives';

const int = z.number().int();

export const EFFECT_ATOMS = {
  setFlag: FlagId,
  clearFlag: FlagId,
  /** Written to the profile at once. */
  grantEcho: EchoId,
  questStart: QuestId,
  questAdvance: z.object({ quest: QuestId, stage: Id }).strict(),
  questFail: QuestId,
  giveItem: z.object({ item: ItemId, count: int.min(1).optional(), rarity: Rarity.optional() }).strict(),
  takeItem: z.object({ item: ItemId, count: int.min(1).optional() }).strict(),
  rep: z.object({ faction: FactionId, delta: int }).strict(),
  loyalty: z.object({ companion: CompanionId, delta: int }).strict(),
  gold: int,
  xp: int.min(0),
  resonance: int,
  heal: z
    .object({ hp: z.union([int.min(0), z.literal('full')]).optional(), mp: z.union([int.min(0), z.literal('full')]).optional() })
    .strict()
    .refine((h) => h.hp !== undefined || h.mp !== undefined, '`heal` needs hp and/or mp'),
  damage: z.object({ hp: int.min(1) }).strict(),
  corruption: int,
  /** Moves the Breach Clock LIMIT by n watches (−10 days = −40), floored at current day + 3 dawns (DESIGN §10.1). */
  clockWatches: int,
  /** Time passes by n ≥ 1 watches (an event's timeCost); the limit is untouched (D-069.5). */
  passWatches: int.min(1, '`passWatches` must be ≥ 1 (time never runs backwards)'),
  spawn: z.object({ creature: CreatureId, location: LocationId.optional() }).strict(),
  teleport: LocationId,
  unlockExit: z.object({ from: LocationId, to: LocationId }).strict(),
  /** DESIGN §4.7: the node's fixed non-boss groups scatter for the loop. */
  scatter: z.object({ location: LocationId }).strict(),
  // combat scope (D-069.9)
  multiHit: z.object({ hits: int.min(1) }).strict(),
  stripBuffs: z
    .object({
      kinds: z.array(z.enum(['shield', 'regen', 'haste', 'rewind'])).min(1),
      target: z.enum(['target', 'self', 'all_enemies', 'all_allies', 'ally']).optional(),
    })
    .strict(),
  healOnDamage: z.object({ pct: Pct }).strict(),
  surviveRounds: z.object({ rounds: int.min(1), line: Text.optional() }).strict(),
  leaveCombat: z.literal(true),
  /** A boss phase's onEnter "AoE" (DESIGN §4.10): one of the boss's own moves lands on every opponent (U26b, C1 note). */
  areaMove: Id,
  // companions, flow, unlocks, counters
  recruit: CompanionId,
  dismiss: CompanionId,
  /** Encounter id. */
  startCombat: Id,
  /** Dialogue id. */
  startDialogue: Id,
  endLoop: z
    .object({ closer: z.enum(['closer_escape', 'closer_fall']), reason: z.enum(['death', 'expiry', 'rejected', 'released']).optional() })
    .strict()
    .refine((e) => e.reason === undefined || e.closer === 'closer_fall', 'only closer_fall carries a reason (D-066 #7)'),
  ending: EndingId,
  unlockRecipe: RecipeId,
  unlockCodex: CodexId,
  counter: z.object({ name: z.string().min(1), delta: int }).strict(),
  /** Communion only; clamped 0–8. */
  resolve: int,
} as const;

export type EffectAtoms = { [K in keyof typeof EFFECT_ATOMS]: z.output<(typeof EFFECT_ATOMS)[K]> };
export type EffectKey = keyof EffectAtoms;
export type Effect = { [K in EffectKey]: { [P in K]: EffectAtoms[P] } }[EffectKey];

export const EFFECT_KEYS = Object.keys(EFFECT_ATOMS) as EffectKey[];
/** Legal only in creature definitions (Move.effects, PhaseSchema.onEnter); D-069.9. */
export const COMBAT_SCOPE_EFFECTS = ['multiHit', 'stripBuffs', 'healOnDamage', 'surviveRounds', 'leaveCombat', 'areaMove'] as const satisfies readonly EffectKey[];
export type CombatScopeEffectKey = (typeof COMBAT_SCOPE_EFFECTS)[number];

export const EffectSchema: z.ZodType<Effect> = oneKeyUnion<Effect>('effect', () => EFFECT_ATOMS);
/** An effect list; absent = []. */
export const Effects = z.array(EffectSchema).default([]);

export const isCombatScope = (key: EffectKey): key is CombatScopeEffectKey =>
  (COMBAT_SCOPE_EFFECTS as readonly EffectKey[]).includes(key);
