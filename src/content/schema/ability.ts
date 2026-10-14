// AbilitySchema (PLAN §5.7; DESIGN §5 ability rows, §5.7 the Amulet's itm_echo_bolt, §12.4 companion abilities).
// One table for class abilities (rgr_|wiz_|elf_|wrd_|wvr_, D-044/D-061), companion abilities (comp_<companion>_) and
// item-granted abilities (itm_). The id prefix decides the owner and which fields apply. `levelReq`, `costHalf` and
// `cooldown` may be omitted: they default from the tier (gates 1/4/8/12/16; 2 half-points, capstone 4; DESIGN §5.1)
// and, for companions, from `kind` (D-066 #12); an authored value that contradicts the rule is an error.
import { z } from 'zod';
import { CombatWhenSchema, StatTarget, StatusApplySchema, noCombatScope } from './creature';
import { Effects } from './effect';
import { Base, ClassId, CompanionId, DamageType, Id, ItemId, Pct, Text } from './primitives';
import { SpecialFor } from './specials';

const int = z.number().int();
const custom = z.ZodIssueCode.custom;

export const ABILITY_ID_RE = /^(rgr|wiz|elf|wrd|wvr|comp_[a-z]+|itm)_[a-z0-9_]+$/;

/** Class ability prefix → class (D-061). */
export const CLASS_OF_PREFIX = {
  rgr: 'ranger',
  wiz: 'wizard',
  elf: 'elf',
  wrd: 'ironclad_warden',
  wvr: 'shadow_weaver',
} as const satisfies Record<string, z.infer<typeof ClassId>>;
export type ClassAbilityPrefix = keyof typeof CLASS_OF_PREFIX;

/** Class → its ability id prefix. */
export const PREFIX_OF_CLASS = Object.fromEntries(Object.entries(CLASS_OF_PREFIX).map(([p, c]) => [c, p])) as Record<
  z.infer<typeof ClassId>,
  ClassAbilityPrefix
>;

/** Tier → unlock level (DESIGN §5.1). */
export const TIER_LEVELS = [1, 4, 8, 12, 16] as const;
/** Tier → cost in half-points: T1–T4 = 2, capstone = 4 (DESIGN §5.1, D-066 #15). */
export const tierCostHalf = (tier: number): number => (tier === 5 ? 4 : 2);

export const AbilityKind = z.enum(['attack', 'debuff', 'aoe', 'heal', 'shield', 'cleanse', 'buff', 'utility', 'signature']);
export type AbilityKind = z.infer<typeof AbilityKind>;
/** Companion auto-ability cooldowns in the companion's own turns (D-066 #12, DESIGN §12.4); signatures are per companion. */
export const COMPANION_KIND_COOLDOWN = {
  attack: 0,
  debuff: 2,
  aoe: 2,
  utility: 2,
  buff: 2,
  heal: 3,
  shield: 3,
  cleanse: 3,
} as const satisfies Record<Exclude<AbilityKind, 'signature'>, number>;

export const AbilityTarget = z.enum(['enemy', 'all_enemies', 'self', 'ally', 'self_or_ally', 'party']);

/**
 * Class abilities whose DESIGN §5 row the engine scripts by id (`src/engine/combat/abilities.ts` ABILITY_SCRIPTS; content
 * cannot import the engine, so this copy is mirrored and an engine test asserts the two lists are equal). A scripted row
 * may have nothing else to declare (Dancer's Guard, Unbroken, The Moment Between …), so it is exempt from "an ability must
 * do something" (PLAN §5.19 rule 13; U26b, C1 note). Adding a script = add its id here AND in ABILITY_SCRIPTS.
 */
export const SCRIPTED_ABILITIES = [
  'rgr_hunters_eye', 'rgr_venom_coat', 'rgr_field_dressing', 'rgr_smoke_bomb', 'rgr_exsanguinate', 'rgr_apex_predator',
  'wiz_cinder_shield', 'wiz_skyfall',
  'elf_dancers_guard', 'elf_flurry', 'elf_crescendo', 'elf_final_verse', 'elf_heart_of_the_grove', 'elf_shadowstep', 'elf_blink_strike',
  'elf_veilwalk', 'elf_moment_between',
  'wrd_iron_guard', 'wrd_unbroken', 'wrd_last_bastion', 'wrd_crushing_blow', 'wrd_mountainfall', 'wrd_steady_breath', 'wrd_null_plate',
  'wrd_spellbreaker', 'wrd_oathbound', 'wrd_iron_silence',
  'wvr_doom_sigil', 'wvr_ninefold_hex', 'wvr_leech_veil', 'wvr_soul_tether', 'wvr_breach_echo', 'wvr_collapse', 'wvr_unravel',
] as const;
const SCRIPTED: ReadonlySet<string> = new Set(SCRIPTED_ABILITIES);
/** Does the engine script this ability's row (SCRIPTED_ABILITIES)? */
export const isScriptedAbility = (id: string): boolean => SCRIPTED.has(id);

export type AbilityOwnerKind = 'class' | 'companion' | 'item';
/** Which table owns an ability id, from its prefix; undefined for a malformed id. */
export function abilityOwnerKind(id: string): AbilityOwnerKind | undefined {
  if (!ABILITY_ID_RE.test(id)) return undefined;
  if (id.startsWith('comp_')) return 'companion';
  if (id.startsWith('itm_')) return 'item';
  return 'class';
}

const AbilityObject = Base.extend({
  id: z.string().regex(ABILITY_ID_RE, 'expected an ability id: rgr_|wiz_|elf_|wrd_|wvr_|comp_<companion>_|itm_ + snake_case (D-044, D-061)'),
  /** classId, companionId, or the granting item id for itm_ abilities. */
  ownerId: z.string(),
  /** Class abilities only. */
  branch: Id.optional(),
  tier: int.min(1).max(5).optional(),
  /** Companion abilities only (cooldown by kind). */
  kind: AbilityKind.optional(),
  name: Text,
  description: Text,
  mp: int.min(0).default(0),
  /** Never kills; requires current HP > cost (D-066 #5). */
  selfCost: z.object({ hpPctMax: Pct.optional(), hpPctCur: Pct.optional(), hpPerHit: z.number().min(0).optional() }).strict().optional(),
  target: AbilityTarget,
  damageType: DamageType.optional(),
  /** +10 accuracy (DESIGN §3.2). */
  spell: z.boolean().default(false),
  power: z
    .object({
      base: z.number().default(0),
      coef: z.number(),
      stat: StatTarget,
      hits: int.min(1).default(1),
      perHitCrit: z.boolean().default(true),
      /** itm_echo_bolt: max(0.75·ATK, 4 + 0.8·SP) (D-067.19). */
      maxOf: z.object({ base: z.number(), coef: z.number(), stat: StatTarget }).strict().optional(),
      ignoresArmor: z.boolean().default(false),
    })
    .strict()
    .optional(),
  /** ×1.25 vs Marked ({ targetHas: 'status_mark' }), ×1.5 if acting before the target ({ targetHasActed: false }) … */
  bonuses: z.array(z.object({ when: CombatWhenSchema, mult: z.number().positive() }).strict()).default([]),
  heal: z
    .object({ base: z.number(), coef: z.number(), stat: z.enum(['atk', 'sp', 'maxStrAgi']), target: z.enum(['self', 'ally', 'party']).default('self') })
    .strict()
    .optional(),
  shield: z.object({ base: z.number(), coef: z.number(), stat: StatTarget, turns: int.min(1).default(3) }).strict().optional(),
  statuses: z.array(StatusApplySchema).default([]),
  onKill: z.object({ refundMp: z.number().optional(), refundHp: z.literal('spent').optional() }).strict().optional(),
  interrupt: z.boolean().default(false),
  /** Default: 0, or the companion kind's cooldown. */
  cooldown: int.min(0).optional(),
  /** Half-points; default from tier. */
  costHalf: int.min(2).optional(),
  /** Default from tier; branch prerequisites are the validator's (U19). */
  levelReq: int.min(1).optional(),
  /** Engine hook (specials.ts, 'ability' scope). */
  special: SpecialFor('ability').optional(),
  /** Usable outside combat; if non-empty, legal in explore. */
  outOfCombat: Effects,
  flavor: z.string().optional(),
  /** Weaver/Wizard corruption-gated abilities (D-017). */
  corruptionReq: int.min(0).max(6).optional(),
}).strict();

type AbilityShape = z.output<typeof AbilityObject>;

function checkAbility(a: AbilityShape, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
  const owner = abilityOwnerKind(a.id);

  if (owner === 'class') {
    const prefix = a.id.slice(0, a.id.indexOf('_')) as ClassAbilityPrefix;
    const cls = CLASS_OF_PREFIX[prefix];
    if (a.ownerId !== cls) issue(['ownerId'], `${prefix}_ abilities belong to class '${cls}'; got '${a.ownerId}' (D-061)`);
    if (a.branch === undefined) issue(['branch'], 'a class ability needs a branch');
    if (a.tier === undefined) issue(['tier'], 'a class ability needs a tier (1–5)');
    if (a.kind !== undefined) issue(['kind'], '`kind` is for companion abilities (cooldown by kind)');
    if (a.mp === 0 && a.special !== 'resource_convert') {
      issue(['mp'], 'a class ability costs MP > 0 unless it converts a resource (special: resource_convert, e.g. wvr_blood_pact; PLAN §5.19 rule 13)');
    }
    if (a.tier !== undefined) {
      const gate = TIER_LEVELS[a.tier - 1];
      if (a.levelReq !== undefined && a.levelReq !== gate) issue(['levelReq'], `tier ${a.tier} unlocks at level ${gate} (DESIGN §5.1)`);
      const half = tierCostHalf(a.tier);
      if (a.costHalf !== undefined && a.costHalf !== half) {
        issue(['costHalf'], `tier ${a.tier} costs ${half} half-points (T1–T4 = 2, capstone = 4; DESIGN §5.1)`);
      }
    }
  } else if (owner === 'companion') {
    const name = /^comp_([a-z]+)_/.exec(a.id)?.[1] ?? '';
    if (!CompanionId.safeParse(name).success) issue(['id'], `unknown companion '${name}' in ability id (expected comp_<${CompanionId.options.join('|')}>_…)`);
    else if (a.ownerId !== name) issue(['ownerId'], `comp_${name}_ abilities belong to companion '${name}'; got '${a.ownerId}'`);
    if (a.kind === undefined) issue(['kind'], 'a companion ability needs a kind (its cooldown follows from it; DESIGN §12.4)');
    if (a.branch !== undefined || a.tier !== undefined) issue([a.branch !== undefined ? 'branch' : 'tier'], 'branch and tier are for class abilities');
    if (a.mp !== 0) issue(['mp'], 'companions have no MP; their abilities use cooldowns (D-066 #12)');
    if (a.kind !== undefined && a.kind !== 'signature' && a.cooldown !== undefined && a.cooldown !== COMPANION_KIND_COOLDOWN[a.kind]) {
      issue(['cooldown'], `companion ${a.kind} abilities have cooldown ${COMPANION_KIND_COOLDOWN[a.kind]} (D-066 #12, DESIGN §12.4)`);
    }
  } else if (owner === 'item') {
    if (!ItemId.safeParse(a.ownerId).success) issue(['ownerId'], `itm_ abilities are owned by the granting item (item_…); got '${a.ownerId}'`);
    if (a.branch !== undefined || a.tier !== undefined || a.kind !== undefined) issue(['id'], 'item abilities have no branch, tier or kind');
  }

  if (a.power && a.damageType === undefined) issue(['damageType'], 'an ability with power needs a damageType');
  if (!a.power && !a.heal && !a.shield && a.statuses.length === 0 && a.special === undefined && !isScriptedAbility(a.id)) {
    issue([], 'an ability must do something: power, heal, shield, statuses, special or an engine script (PLAN §5.19 rule 13)');
  }
  if (a.selfCost && Object.keys(a.selfCost).length === 0) issue(['selfCost'], 'selfCost needs hpPctMax, hpPctCur and/or hpPerHit');
  noCombatScope(a.outOfCombat, ['outOfCombat'], ctx);
}

export const AbilitySchema = AbilityObject.superRefine(checkAbility).transform((a) => ({
  ...a,
  levelReq: a.levelReq ?? (a.tier !== undefined ? TIER_LEVELS[a.tier - 1] ?? 1 : 1),
  costHalf: a.costHalf ?? (a.tier !== undefined ? tierCostHalf(a.tier) : 2),
  cooldown: a.cooldown ?? (a.kind !== undefined && a.kind !== 'signature' ? COMPANION_KIND_COOLDOWN[a.kind] : 0),
}));

export type Ability = z.output<typeof AbilitySchema>;
export type AbilityInput = z.input<typeof AbilitySchema>;
