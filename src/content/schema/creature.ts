// CreatureSchema (PLAN §5.4; DESIGN §4.2 ordered-pattern intents, §4.10 boss framework, §4.11 communion; D-066 #14).
// A creature has a `moves` table and an ordered `pattern` of steps that reference moves; a boss has 2–4 `phases`
// instead, each with its own pattern and an OR-list of triggers. `CombatWhen` is DESIGN §4.2's combat-only predicate
// language; it also accepts every world Condition atom (DESIGN: `if: CombatWhen | Condition`), which share no key with
// the combat atoms. Per-record rules (PLAN §5.19 rules 1 and 11, the parts that need no other table) are enforced here;
// cross-table references (adds, summons, loot items) are U19's validator.
import { z } from 'zod';
import { CONDITION_ATOMS, CONDITION_KEYS, ConditionSchema, type ConditionAtoms, type ConditionKey } from './condition';
import { COMBAT_SCOPE_EFFECTS, Effects, type Effect } from './effect';
import {
  Base,
  CreatureId,
  DamageType,
  Id,
  ItemId,
  Pct,
  PId,
  Rarity,
  Resistance,
  StatusId,
  Tags,
  Text,
  Voice,
  oneKeyUnion,
} from './primitives';
import { SpecialFor } from './specials';

const int = z.number().int();
type Path = (string | number)[];
const custom = z.ZodIssueCode.custom;

// ---------------------------------------------------------------------------------------------------------------
// CombatWhen

/** Combat-only predicate atoms (DESIGN §4.2), evaluated when an intent is generated or a hit lands. */
export interface CombatWhenAtoms {
  all: CombatWhen[];
  any: CombatWhen[];
  not: CombatWhen;
  /** The creature's own HP is below this fraction of its max. */
  hpBelow: number;
  roundAtLeast: number;
  /** Living allies on the creature's side (itself excluded) fewer than n. */
  allyCountBelow: number;
  /** Any ally, or a specific creature id. */
  allyPresent: true | `cr_${string}`;
  targetHas: `status_${string}`;
  selfHas: `status_${string}`;
  /** True on the creature's n-th, 2n-th … turn (WORLD `everyNthTurn:n`). */
  everyNth: number;
  /** Its first turn of the fight. */
  first: true;
  /** True until this step has fired once (step-scoped, so once per phase for a step inside a phase). */
  oncePerFight: true;
  playerGuarding: boolean;
  /** Boss/non-boss splits in ability rows (Snare Trap, Stutter, Concussive Slam … DESIGN §5). */
  targetIsBoss: boolean;
  /** The target has acted this fight (Ambush: "act before the target has acted"). */
  targetHasActed: boolean;
}

type WorldKey = Exclude<ConditionKey, 'all' | 'any' | 'not'>;
type CombatWhenAtomMap = CombatWhenAtoms & Pick<ConditionAtoms, WorldKey>;
export type CombatWhenKey = keyof CombatWhenAtomMap;
export type CombatWhen = { [K in CombatWhenKey]: { [P in K]: CombatWhenAtomMap[P] } }[CombatWhenKey];

const lazyWhen: z.ZodType<CombatWhen> = z.lazy(() => CombatWhenSchema);

export const COMBAT_WHEN_ATOMS: { readonly [K in keyof CombatWhenAtoms]: z.ZodType<CombatWhenAtoms[K]> } = {
  all: z.array(lazyWhen),
  any: z.array(lazyWhen).min(1, '`any` needs at least one condition'),
  not: lazyWhen,
  hpBelow: z.number().gt(0, 'hpBelow is a fraction of max HP in (0, 1]').max(1, 'hpBelow is a fraction of max HP in (0, 1]'),
  roundAtLeast: int.min(1),
  allyCountBelow: int.min(1),
  allyPresent: z.union([z.literal(true), CreatureId]),
  targetHas: StatusId,
  selfHas: StatusId,
  everyNth: int.min(2, '`everyNth` is ≥ 2 (every turn is a plain step)'),
  first: z.literal(true),
  oncePerFight: z.literal(true),
  playerGuarding: z.boolean(),
  targetIsBoss: z.boolean(),
  targetHasActed: z.boolean(),
};

const WORLD_KEYS = CONDITION_KEYS.filter((k): k is WorldKey => k !== 'all' && k !== 'any' && k !== 'not');
const WORLD_ATOMS = Object.fromEntries(WORLD_KEYS.map((k) => [k, CONDITION_ATOMS[k]])) as {
  readonly [K in WorldKey]: z.ZodType<ConditionAtoms[K]>;
};
const COMBAT_WHEN_TABLE: Readonly<Record<string, z.ZodTypeAny>> = { ...COMBAT_WHEN_ATOMS, ...WORLD_ATOMS };

export const COMBAT_WHEN_KEYS = Object.keys(COMBAT_WHEN_ATOMS) as (keyof CombatWhenAtoms)[];

export const CombatWhenSchema: z.ZodType<CombatWhen> = oneKeyUnion<CombatWhen>(
  'combat condition',
  () => COMBAT_WHEN_TABLE,
  'combine with { all: [...] }',
);

// ---------------------------------------------------------------------------------------------------------------
// Moves

export const StatTarget = z.enum(['atk', 'sp']);

/** `base + coef·stat`, used where a status carries a magnitude (Regen per turn, a Shield pool). */
export const ScaleSchema = z
  .object({ base: z.number().default(0), coef: z.number().min(0).default(0), stat: StatTarget.default('sp') })
  .strict();

export const StatusApplySchema = z
  .object({
    status: StatusId,
    chance: Pct.default(1),
    stacks: int.min(1).default(1),
    duration: int.min(1).default(2),
    target: z.enum(['target', 'self', 'all_enemies', 'all_allies', 'ally']).default('target'),
    /** Magnitude computed from the source at application (Regen `4 + 0.4·SP`/turn, Wildling Brute's Regen 3). */
    power: ScaleSchema.optional(),
    /** Applied only if true when the hit lands ("Stun unless the target Guarded", "Slow on bosses instead"). */
    when: lazyWhen.optional(),
  })
  .strict();

export const TargetRule = z.enum(['player', 'companion', 'lowest_hp', 'highest_mag', 'random', 'all', 'self', 'ally', 'marked_first', 'taunter']);

export const PowerSchema = z
  .object({ base: z.number().default(0), coef: z.number().min(0), stat: StatTarget, hits: int.min(1).default(1) })
  .strict();

const MoveObject = z
  .object({
    name: Text,
    /** WORLD §6 telegraph line ("The hour draws tight, then lashes at you."). */
    line: Text,
    /** Absent = non-damaging. */
    type: DamageType.optional(),
    power: PowerSchema.optional(),
    /** +10 accuracy (DESIGN §3.2; the Shade's Wail, §4.12). */
    spell: z.boolean().default(false),
    statuses: z.array(StatusApplySchema).default([]),
    /** "?" chip (DESIGN §4.2). */
    hidden: z.boolean().default(false),
    /** tyr_gather → tyr_chrono_strike. */
    windUp: z.object({ turns: int.min(1).max(3), then: Id }).strict().optional(),
    summon: z.object({ creatureId: CreatureId, count: int.min(1), max: int.min(1), hpPct: Pct.default(1) }).strict().optional(),
    revive: z.object({ hpPct: Pct }).strict().optional(),
    riposte: z.object({ power: PowerSchema, turns: int.min(1) }).strict().optional(),
    shieldAlly: z.object({ power: PowerSchema }).strict().optional(),
    /** Self shield (tyr_brace, tyr_aulde_sings). */
    shield: z.object({ power: PowerSchema }).strict().optional(),
    heal: z.object({ power: PowerSchema, target: z.enum(['self', 'ally', 'lowest_ally']) }).strict().optional(),
    cleanseSelf: z.boolean().default(false),
    /** reach_withdraw (shorthand for the { leaveCombat: true } effect). */
    leaveCombat: z.boolean().default(false),
    /** Combat-scope atoms: multiHit, stripBuffs, healOnDamage, leaveCombat (PLAN §4.9, D-069.9, D-070.5). */
    effects: Effects,
    /** Engine-coded script (specials.ts, 'move' scope). */
    special: SpecialFor('move').optional(),
  })
  .strict();

export const MoveSchema = MoveObject.superRefine((m, ctx) => {
  if (m.power && !m.type) {
    ctx.addIssue({ code: custom, path: ['type'], message: 'a move with power needs a damage type (absent type = non-damaging)' });
  }
  if (m.summon && m.summon.max < m.summon.count) {
    ctx.addIssue({ code: custom, path: ['summon', 'max'], message: 'summon.max must be ≥ summon.count' });
  }
  m.effects.forEach((e, i) => {
    if (effectKey(e) === 'surviveRounds') {
      ctx.addIssue({ code: custom, path: ['effects', i], message: '`surviveRounds` belongs in a boss’s first phase onEnter, not in a move (PLAN §5.19 rule 11)' });
    }
    if (effectKey(e) === 'areaMove') {
      ctx.addIssue({ code: custom, path: ['effects', i], message: '`areaMove` belongs in a boss phase’s onEnter, not in a move (DESIGN §4.10)' });
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Pattern steps

export type Step =
  | { move: string; target: z.infer<typeof TargetRule>; when?: CombatWhen }
  | { if: CombatWhen; then: Step[]; else?: Step[] }
  | { weighted: { w: number; step: Step }[] }
  | { repeat: Step[]; times: number }
  | { phaseHold: true };

const lazyStep: z.ZodType<Step> = z.lazy(() => StepSchema);

/** One strict schema per step kind, keyed by the key that identifies it. */
export const STEP_KINDS = {
  move: z.object({ move: Id, target: TargetRule, when: lazyWhen.optional() }).strict(),
  if: z.object({ if: lazyWhen, then: z.array(lazyStep).min(1), else: z.array(lazyStep).min(1).optional() }).strict(),
  weighted: z.object({ weighted: z.array(z.object({ w: z.number().positive(), step: lazyStep }).strict()).min(1) }).strict(),
  repeat: z.object({ repeat: z.array(lazyStep).min(1), times: int.min(1) }).strict(),
  phaseHold: z.object({ phaseHold: z.literal(true) }).strict(),
} as const;
type StepKind = keyof typeof STEP_KINDS;
const STEP_KIND_LIST = Object.keys(STEP_KINDS) as StepKind[];

/** Dispatches on the identifying key so errors name the step kind and path instead of zod's "Invalid input". */
export const StepSchema: z.ZodType<Step> = z.custom<Step>(() => true).superRefine((value, ctx) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    ctx.addIssue({ code: custom, message: 'a pattern step is an object: { move, target }, { if, then }, { weighted }, { repeat, times } or { phaseHold: true }' });
    return;
  }
  const kinds = STEP_KIND_LIST.filter((k) => Object.prototype.hasOwnProperty.call(value, k));
  if (kinds.length !== 1) {
    const got = kinds.length === 0 ? `keys ${Object.keys(value).join(', ') || 'none'}` : kinds.join(' and ');
    ctx.addIssue({ code: custom, message: `a pattern step has exactly one of ${STEP_KIND_LIST.join(', ')}; got ${got}` });
    return;
  }
  const result = STEP_KINDS[kinds[0] as StepKind].safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues) ctx.addIssue({ code: custom, path: issue.path, message: issue.message });
  }
});

/** Visits every step of a pattern, nested ones included, depth first, with its path. */
export function walkSteps(steps: readonly Step[], path: Path, visit: (step: Step, path: Path) => void): void {
  steps.forEach((step, i) => walkStep(step, [...path, i], visit));
}

// Refinements also run on data with non-fatal issues elsewhere (zod 3 "dirty" results), so walkers check shapes.
function walkStep(step: Step, path: Path, visit: (step: Step, path: Path) => void): void {
  if (!isRecord(step)) return;
  visit(step, path);
  if ('if' in step) {
    if (Array.isArray(step.then)) walkSteps(step.then, [...path, 'then'], visit);
    if (Array.isArray(step.else)) walkSteps(step.else, [...path, 'else'], visit);
  } else if ('weighted' in step) {
    if (Array.isArray(step.weighted)) step.weighted.forEach((w, j) => isRecord(w) && walkStep(w.step, [...path, 'weighted', j, 'step'], visit));
  } else if ('repeat' in step) {
    if (Array.isArray(step.repeat)) walkSteps(step.repeat, [...path, 'repeat'], visit);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Phases

export const RESOLVE_MIN = 0;
export const RESOLVE_MAX = 8;
/** Communion Resolve, an integer 0–8 (D-054, D-066 #6). */
export const ResolveSchema = int
  .min(RESOLVE_MIN, 'Resolve is an integer 0–8 (D-054)')
  .max(RESOLVE_MAX, 'Resolve is an integer 0–8 (D-054)');
/** A change to Resolve (answer, offer); the meter itself is clamped to 0–8. */
const ResolveDelta = int.min(-RESOLVE_MAX).max(RESOLVE_MAX);

export interface TriggerAtoms {
  /** Boss HP below this fraction of max, in (0, 1). */
  hpBelow: number;
  /** Round counter (counts rounds, not turns; DESIGN §4.1). */
  round: number;
  event: 'addsDead' | 'communionMovementEnd';
  resolveAtLeast: number;
}
export type Trigger = { [K in keyof TriggerAtoms]: { [P in K]: TriggerAtoms[P] } }[keyof TriggerAtoms];

export const TRIGGER_ATOMS: { readonly [K in keyof TriggerAtoms]: z.ZodType<TriggerAtoms[K]> } = {
  hpBelow: z.number().gt(0, 'hpBelow is a fraction of max HP in (0, 1)').lt(1, 'hpBelow is a fraction of max HP in (0, 1)'),
  round: int.min(1, 'round triggers count rounds from 1'),
  event: z.enum(['addsDead', 'communionMovementEnd']),
  resolveAtLeast: ResolveSchema,
};
export const TriggerSchema: z.ZodType<Trigger> = oneKeyUnion<Trigger>('phase trigger', () => TRIGGER_ATOMS, 'an OR-list takes several triggers');

export const PhaseAddSchema = z
  .object({
    creatureId: CreatureId,
    count: int.min(1),
    /** Count when the player has no active companion. */
    countSolo: int.min(0).optional(),
    hpPct: Pct.default(1),
    /** Replace adds as they die: at most `maxAlive` at once, `total` over the fight (Unveiled Tyrant P2, WORLD §6.8). */
    reinforce: z.object({ maxAlive: int.min(1).max(3), total: int.min(1) }).strict().optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.countSolo !== undefined && a.countSolo > a.count) ctx.addIssue({ code: custom, path: ['countSolo'], message: 'countSolo must be ≤ count' });
    if (a.reinforce && a.reinforce.maxAlive < a.count) ctx.addIssue({ code: custom, path: ['reinforce', 'maxAlive'], message: 'reinforce.maxAlive must be ≥ count' });
    if (a.reinforce && a.reinforce.total < a.count) ctx.addIssue({ code: custom, path: ['reinforce', 'total'], message: 'reinforce.total must be ≥ count' });
  });

export const PhaseSchema = z
  .object({
    /** tyr_movement_1..3, tyr_phase_4 for the Tyrants. */
    id: Id,
    name: Text,
    /** OR-list; the first phase has none. */
    enterWhen: z.array(TriggerSchema).default([]),
    /** The fight opens past this phase when true (Vell's Umbra, the Bell-Warden; WORLD §6). */
    skipWhen: ConditionSchema.optional(),
    pattern: z.array(StepSchema).min(1, 'a phase needs a pattern with at least one step'),
    adds: z.array(PhaseAddSchema).default([]),
    onEnter: Effects,
    /** Transition line (WORLD §6.8). */
    line: z.string().optional(),
    /** Contained P3 ×1.5 (provisional, D-068.3). */
    damageTakenMult: z.number().positive().default(1),
    /** Outgoing damage +x per round spent in this phase, uncapped (Unveiled `tyr_phase_4`: 0.1). */
    damageDealtRampPerRound: z.number().min(0).default(0),
  })
  .strict();

// ---------------------------------------------------------------------------------------------------------------
// Communion (DESIGN §4.11, D-054, D-066 #6, D-067.3)

export const COMMUNION_MOVEMENTS = ['tyr_movement_1', 'tyr_movement_2', 'tyr_movement_3'] as const;

export const CommunionAnswerSchema = z
  .object({ id: Id, when: ConditionSchema, resolve: ResolveDelta, lie: z.boolean().default(false), text: Text })
  .strict();

export const CommunionQuestionSchema = z
  .object({ id: PId('tyr_q_'), line: Text, answers: z.array(CommunionAnswerSchema).min(1) })
  .strict();

export const CommunionSpecSchema = z
  .object({
    /** Any-of: Commune is open from turn 1 when one holds ({ echo: 'echo_tyrant_speaks' }); Listen opens it otherwise. */
    opensWith: z.array(ConditionSchema).min(1),
    movements: z
      .array(
        z
          .object({
            id: z.enum(COMMUNION_MOVEMENTS),
            questions: z.array(CommunionQuestionSchema).min(1),
            /** What *Listen* speaks in this Movement: the codex fragment(s) it unlocks (DESIGN §4.11; U29, C1 note). */
            listen: z.object({ effects: Effects }).strict().optional(),
          })
          .strict(),
      )
      .length(3, 'communion has exactly three Movements (D-054)'),
    /** Offer: never consumed (D-067.3). */
    offers: z.array(z.object({ itemId: ItemId, resolve: ResolveDelta, effects: Effects }).strict()),
    /** The pressure move between questions (tyr_hour_presses); must be in `moves`. */
    pressMove: Id,
    outcomes: z
      .array(z.object({ minResolve: ResolveSchema, when: ConditionSchema.optional(), choiceId: Id, effects: Effects }).strict())
      .min(1),
  })
  .strict()
  .superRefine((c, ctx) => {
    c.movements.forEach((m, i) => {
      if (m.id !== COMMUNION_MOVEMENTS[i]) {
        ctx.addIssue({ code: custom, path: ['movements', i, 'id'], message: `Movement ${i + 1} must be ${COMMUNION_MOVEMENTS[i]} (in order)` });
      }
    });
    const questionIds = new Set<string>();
    c.movements.forEach((m, i) =>
      m.questions.forEach((q, j) => {
        if (questionIds.has(q.id)) ctx.addIssue({ code: custom, path: ['movements', i, 'questions', j, 'id'], message: `duplicate question id ${q.id}` });
        questionIds.add(q.id);
        dupes(q.answers.map((a) => a.id)).forEach((k) =>
          ctx.addIssue({ code: custom, path: ['movements', i, 'questions', j, 'answers', k, 'id'], message: `duplicate answer id ${q.answers[k]?.id}` }),
        );
      }),
    );
    dupes(c.offers.map((o) => o.itemId)).forEach((k) => ctx.addIssue({ code: custom, path: ['offers', k, 'itemId'], message: 'each item is offered once' }));
    dupes(c.outcomes.map((o) => o.choiceId)).forEach((k) => ctx.addIssue({ code: custom, path: ['outcomes', k, 'choiceId'], message: 'duplicate outcome choiceId' }));
    c.offers.forEach((o, i) => noCombatScope(o.effects, ['offers', i, 'effects'], ctx));
    c.outcomes.forEach((o, i) => noCombatScope(o.effects, ['outcomes', i, 'effects'], ctx));
    c.movements.forEach((m, i) => noCombatScope(m.listen?.effects ?? [], ['movements', i, 'listen', 'effects'], ctx));
  });

// ---------------------------------------------------------------------------------------------------------------
// Creature

export const CreatureRole = z.enum(['fodder', 'elite', 'boss', 'anomaly', 'add']);

export const LootSchema = z
  .object({ itemId: ItemId, chance: Pct.default(1), count: int.min(1).default(1), rarity: Rarity.optional(), when: ConditionSchema.optional() })
  .strict();

export const BOSS_PHASES = { min: 2, max: 4 } as const;

const CreatureObject = Base.extend({
  id: CreatureId,
  name: Text,
  description: Text,
  /** WORLD §5's eight families. */
  family: PId('fam_'),
  /** DESIGN §8.2 loot family. */
  materialKin: z.string().optional(),
  role: CreatureRole,
  level: int.min(1).max(20),
  stats: z
    .object({ hp: int.min(1), atk: z.number().min(0), sp: z.number().min(0).default(0), armor: z.number().min(0), ward: z.number().min(0), agi: z.number().min(0) })
    .strict(),
  /** 'breach_born' (poison-immune), 'construct', … */
  tags: Tags,
  resistances: z.record(DamageType, Resistance).default({}),
  statusImmunities: z.array(StatusId).default([]),
  tauntImmune: z.boolean().default(false),
  /** Stagger allowed on bosses. */
  interruptible: z.boolean().default(true),
  moves: z.record(Id, MoveSchema),
  /** Creatures without phases; a creature with phases uses phases[].pattern and leaves this empty. */
  pattern: z.array(StepSchema).default([]),
  /** Bosses: 2–4. */
  phases: z.array(PhaseSchema).default([]),
  /** cr_chronos_tyrant_unveiled only. */
  communion: CommunionSpecSchema.optional(),
  /** False for bosses and story gates. */
  fleeable: z.boolean().default(true),
  loot: z.array(LootSchema).default([]),
  gold: z.object({ min: int.min(0), max: int.min(0) }).strict(),
  xp: int.min(0),
  bestiary: z
    .object({
      voice: Voice,
      summary: Text,
      tactics: z.string().optional(),
      codexId: PId('codex_').optional(),
      reveals: z.array(z.object({ kills: int.min(1), reveal: z.enum(['resist', 'pattern', 'all']) }).strict()).default([]),
    })
    .strict(),
  sigil: z.object({ base: z.string(), accent: z.string().optional(), details: z.array(z.string()).default([]) }).strict(),
  onDefeat: Effects,
  legacyName: z.string().optional(),
}).strict();

type CreatureShape = z.output<typeof CreatureObject>;

function checkCreature(c: CreatureShape, ctx: z.RefinementCtx): void {
  const issue = (path: Path, message: string) => ctx.addIssue({ code: custom, path, message });
  const moveIds = Object.keys(c.moves);
  const known = new Set(moveIds);
  const isBoss = c.role === 'boss';

  if (moveIds.length === 0) issue(['moves'], 'a creature needs at least one move');

  // 1. Every step's move exists; phaseHold only inside phases.
  const checkPattern = (steps: readonly Step[], path: Path, inPhase: boolean) =>
    walkSteps(steps, path, (step, p) => {
      if ('move' in step && typeof step.move === 'string' && !known.has(step.move)) {
        issue([...p, 'move'], `pattern references unknown move '${step.move}' (moves: ${moveIds.join(', ') || 'none'})`);
      }
      if ('phaseHold' in step && !inPhase) issue(p, '`phaseHold` is only meaningful inside a boss phase pattern');
    });
  checkPattern(c.pattern, ['pattern'], false);
  c.phases.forEach((ph, i) => checkPattern(ph.pattern, ['phases', i, 'pattern'], true));

  // 2. Wind-ups resolve to another move.
  for (const [id, m] of Object.entries(c.moves)) {
    if (!m.windUp) continue;
    if (m.windUp.then === id) issue(['moves', id, 'windUp', 'then'], `move '${id}' winds up into itself`);
    else if (!known.has(m.windUp.then)) issue(['moves', id, 'windUp', 'then'], `windUp.then references unknown move '${m.windUp.then}'`);
  }

  // 3. Pattern vs phases; boss rules (PLAN §5.19 rule 11).
  if (c.phases.length === 0 && c.pattern.length === 0) issue(['pattern'], 'a creature without phases needs a pattern with at least one step');
  if (c.phases.length > 0 && c.pattern.length > 0) issue(['pattern'], 'a creature with phases uses phases[].pattern; leave `pattern` empty');
  if (isBoss) {
    if (c.phases.length < BOSS_PHASES.min || c.phases.length > BOSS_PHASES.max) {
      issue(['phases'], `a boss has ${BOSS_PHASES.min}–${BOSS_PHASES.max} phases; got ${c.phases.length}`);
    }
    if (c.fleeable) issue(['fleeable'], 'bosses cannot be fled (fleeable: false; D-066 #11)');
  } else if (c.phases.length > 0) {
    issue(['phases'], `only bosses have phases (role is '${c.role}')`);
  }

  // 4. Phase order: unique ids; the first phase has no trigger, later ones need one; hpBelow strictly decreasing and
  //    round strictly increasing across phases (phases never go backwards, DESIGN §4.10).
  dupes(c.phases.map((p) => p.id)).forEach((i) => issue(['phases', i, 'id'], `duplicate phase id '${c.phases[i]?.id}'`));
  let lastHp = 1;
  let lastRound = 0;
  c.phases.forEach((ph, i) => {
    if (i === 0 && ph.enterWhen.length > 0) issue(['phases', 0, 'enterWhen'], 'the first phase is where the fight starts; it has no enterWhen triggers');
    if (i > 0 && ph.enterWhen.length === 0) issue(['phases', i, 'enterWhen'], `phase '${ph.id}' needs at least one enterWhen trigger (OR-list)`);
    const hp = ph.enterWhen.filter((t): t is { hpBelow: number } => isRecord(t) && typeof (t as Record<string, unknown>).hpBelow === 'number').map((t) => t.hpBelow);
    const rounds = ph.enterWhen.filter((t): t is { round: number } => isRecord(t) && typeof (t as Record<string, unknown>).round === 'number').map((t) => t.round);
    if (hp.length > 1) issue(['phases', i, 'enterWhen'], 'at most one hpBelow trigger per phase');
    if (rounds.length > 1) issue(['phases', i, 'enterWhen'], 'at most one round trigger per phase');
    for (const h of hp) {
      if (h >= lastHp) issue(['phases', i, 'enterWhen'], `hpBelow triggers must strictly decrease across phases (${h} after ${lastHp})`);
      lastHp = h;
    }
    for (const r of rounds) {
      if (r <= lastRound) issue(['phases', i, 'enterWhen'], `round triggers must strictly increase across phases (${r} after ${lastRound})`);
      lastRound = r;
    }
    ph.onEnter.forEach((e, j) => {
      if (effectKey(e) === 'surviveRounds' && !(isBoss && i === 0)) {
        issue(['phases', i, 'onEnter', j], '`surviveRounds` is only legal in a boss’s first phase (PLAN §5.19 rule 11)');
      }
      const area = isRecord(e) ? (e as Record<string, unknown>).areaMove : undefined;
      if (typeof area === 'string' && !known.has(area)) issue(['phases', i, 'onEnter', j, 'areaMove'], `areaMove references unknown move '${area}'`);
    });
  });

  // 5. Combat-scope effects never leave combat data.
  noCombatScope(c.onDefeat, ['onDefeat'], ctx);

  // 6. Communion: the press move exists and the Movements mirror the phases.
  if (c.communion) {
    if (!known.has(c.communion.pressMove)) issue(['communion', 'pressMove'], `pressMove references unknown move '${c.communion.pressMove}'`);
    const phaseIds = new Set(c.phases.map((p) => p.id));
    const missing = COMMUNION_MOVEMENTS.filter((m) => !phaseIds.has(m));
    if (missing.length > 0) issue(['communion'], `communion Movements mirror the phases; missing phase(s) ${missing.join(', ')} (D-054)`);
  }

  if (c.gold.min > c.gold.max) issue(['gold'], 'gold.min must be ≤ gold.max');
}

export const CreatureSchema = CreatureObject.superRefine(checkCreature);

export type StatusApply = z.output<typeof StatusApplySchema>;
export type Power = z.output<typeof PowerSchema>;
export type Move = z.output<typeof MoveSchema>;
export type MoveInput = z.input<typeof MoveSchema>;
export type Phase = z.output<typeof PhaseSchema>;
export type PhaseInput = z.input<typeof PhaseSchema>;
export type CommunionSpec = z.output<typeof CommunionSpecSchema>;
export type CommunionSpecInput = z.input<typeof CommunionSpecSchema>;
export type Creature = z.output<typeof CreatureSchema>;
export type CreatureInput = z.input<typeof CreatureSchema>;

// ---------------------------------------------------------------------------------------------------------------
// helpers

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function effectKey(e: Effect): string {
  return isRecord(e) ? (Object.keys(e)[0] ?? '') : '';
}

/** Adds an issue for every combat-scope effect atom in a list that is not combat data (D-069.9). */
export function noCombatScope(effects: readonly Effect[], path: Path, ctx: z.RefinementCtx): void {
  effects.forEach((e, i) => {
    const key = effectKey(e);
    if ((COMBAT_SCOPE_EFFECTS as readonly string[]).includes(key)) {
      ctx.addIssue({ code: custom, path: [...path, i], message: `'${key}' is a combat-scope effect, legal only in a move's effects or a phase's onEnter (D-069.9)` });
    }
  });
}

/** Indexes of entries that repeat an earlier one. */
export function dupes(values: readonly string[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  values.forEach((v, i) => {
    if (seen.has(v)) out.push(i);
    seen.add(v);
  });
  return out;
}
