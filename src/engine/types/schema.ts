// GameStateSchema (PLAN §9.2 U11, §4.12): a structural zod mirror of GameState (§4.2). Saves validate `state`
// against it (U22 wires it into `saves/saveFile.ts`; scenario tests in §4.13 assert it too). Every object is
// `.strict()`, so an unknown or misspelled key fails with a readable path. Each schema is annotated with its
// TypeScript type, so tsc fails if a required field is missing here; the round-trip test catches the reverse.
// Content-shaped values (`onVictory` etc.) stay `unknown` until the Effect schema exists (U14).
import { z } from 'zod';
import type { EndingId } from './ids';
import type {
  BeforeState,
  ClockState,
  CombatLogEntry,
  CombatState,
  Combatant,
  CommunionState,
  CompanionRunState,
  CompanionsState,
  DialogueState,
  EndingPending,
  Equipment,
  GameMeta,
  GameState,
  Intent,
  ItemInstance,
  LocationState,
  LogEntry,
  MerchantState,
  PatternState,
  PlayerState,
  QuestState,
  RngState,
  RunCounters,
  SpawnedEncounter,
  Stats,
  StatusInstance,
  ThresholdState,
  Uses,
  WorldState,
} from './state';

const num = z.number().finite();
const int = z.number().int();
const str = z.string();
const strs = z.array(str);
const recordOf = <T extends z.ZodTypeAny>(value: T) => z.record(z.string(), value);
const numRecord = recordOf(num);

export const FlagValueSchema = z.union([z.boolean(), num, str]);
export const ModeSchema = z.enum(['title', 'explore', 'combat', 'dialogue', 'threshold', 'ending']);
export const StanceSchema = z.enum(['aggressive', 'guarded', 'support']);
export const RaritySchema = z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']);
export const DamageTypeSchema = z.enum(['physical', 'fire', 'storm', 'ley', 'void', 'chrono']);
export const ResistanceSchema = z.enum(['weak', 'neutral', 'resist', 'immune']);
export const CloserReasonSchema = z.enum(['death', 'expiry', 'rejected', 'released']);
const movement = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const u32 = z.number().int().min(0).max(0xffffffff);
export const RngStateSchema: z.ZodType<RngState> = z
  .tuple([u32, u32, u32, u32])
  .refine((s) => s.some((word) => word !== 0), 'rng state must not be all zero');

const endingId = z.custom<EndingId>((v) => typeof v === 'string' && /^ending_[a-z0-9_]+$/.test(v), 'expected an ending_* id');

export const GameMetaSchema: z.ZodType<GameMeta> = z
  .object({
    seed: str,
    loop: int.min(1),
    version: int.min(0),
    stepCount: int.min(0),
    nextUid: int.min(0),
    runId: str,
    modifiers: strs,
    playerName: str,
  })
  .strict();

export const StatsSchema: z.ZodType<Stats> = z.object({ strength: num, magic: num, agility: num }).strict();

export const ClockStateSchema: z.ZodType<ClockState> = z
  .object({
    ticks: int.min(0),
    limitTicks: int.min(0),
    modifiers: z.array(z.object({ source: str, watches: num }).strict()),
    frozen: z.boolean(),
    expired: z.boolean(),
  })
  .strict();

export const BeforeStateSchema: z.ZodType<BeforeState> = z
  .object({ day: z.union([z.literal(1), z.literal(2), z.literal(3)]), resets: int.min(0) })
  .strict();

export const ItemInstanceSchema: z.ZodType<ItemInstance> = z
  .object({
    uid: str,
    itemId: str,
    qty: int.min(0),
    rarity: RaritySchema,
    affixes: strs,
    boundQuest: str.optional(),
  })
  .strict();

export const UsesSchema: z.ZodType<Uses> = recordOf(
  z.object({ loop: num.optional(), day: num.optional(), count: num.optional() }).strict(),
);

export const StatusInstanceSchema: z.ZodType<StatusInstance> = z
  .object({
    statusId: str,
    stacks: num,
    duration: num,
    sourceUid: str.nullable(),
    tick: num.optional(),
    appliedOnOwnTurn: z.boolean(),
    snapshotHp: num.optional(),
  })
  .strict();

const item = ItemInstanceSchema;
export const EquipmentSchema: z.ZodType<Equipment> = z
  .object({ weapon: item.nullable(), armor: item.nullable(), trinket1: item.nullable(), trinket2: item.nullable() })
  .strict();

export const PlayerStateSchema: z.ZodType<PlayerState> = z
  .object({
    name: str,
    classId: str,
    level: int.min(1),
    xp: num,
    stats: StatsSchema,
    hp: num,
    hpMax: num,
    mp: num,
    mpMax: num,
    gold: num,
    corruption: num,
    inventory: z.array(item),
    equipment: EquipmentSchema,
    abilitiesUnlocked: strs,
    apHalf: int,
    statPoints: int,
    statuses: z.array(StatusInstanceSchema),
    uses: UsesSchema,
    stance: StanceSchema,
    passiveBonuses: z
      .object({ strength: num.optional(), magic: num.optional(), agility: num.optional(), hpMax: num.optional(), mpMax: num.optional() })
      .strict(),
    attunements: strs.optional(),
  })
  .strict();

export const CompanionRunStateSchema: z.ZodType<CompanionRunState> = z
  .object({
    id: str,
    recruited: z.boolean(),
    loyalty: num,
    hp: num,
    hpMax: num,
    ko: z.boolean(),
    dead: z.boolean(),
    stance: StanceSchema,
    cooldowns: numRecord,
    waitingAt: str.nullable(),
    arcFlags: recordOf(FlagValueSchema),
  })
  .strict();

export const CompanionsStateSchema: z.ZodType<CompanionsState> = z
  .object({ recruited: recordOf(CompanionRunStateSchema), activeId: str.nullable() })
  .strict();

export const LocationStateSchema: z.ZodType<LocationState> = z
  .object({
    visited: z.boolean(),
    visitCount: int.min(0),
    items: z.array(item),
    itemsSpawned: z.boolean(),
    encountersCleared: strs,
    encounterClearedDay: numRecord,
    eventsFired: strs,
    flags: recordOf(FlagValueSchema),
    unlockedExits: strs,
    lockedExits: strs,
    scattered: strs,
    encounterHp: recordOf(numRecord),
  })
  .strict();

export const SpawnedEncounterSchema: z.ZodType<SpawnedEncounter> = z
  .object({
    id: str,
    groups: z.array(z.object({ creatureId: str, count: int.min(1) }).strict()),
    once: z.boolean(),
    onFlee: z.enum(['scatter', 'hold']),
    label: str.optional(),
  })
  .strict();

export const WorldStateSchema: z.ZodType<WorldState> = z
  .object({
    currentLocationId: str,
    previousLocationId: str.nullable(),
    locationStates: recordOf(LocationStateSchema),
    discovered: strs,
    pendingEncounters: recordOf(z.array(SpawnedEncounterSchema)),
    npcOverrides: recordOf(z.object({ location: str.nullable() }).strict()),
    hordeActive: z.boolean(),
    hordeDelay: num,
    infected: strs,
    hordePending: numRecord,
    hordeCause: z.enum(['tyrant', 'expiry']).nullable(),
    heartstone: z.enum(['intact', 'stabilized', 'exploited', 'destroyed']),
    tyrant: z.enum(['waiting', 'defeated', 'spared', 'communing']),
    gather: recordOf(z.object({ day: num, taken: num }).strict()),
    weather: str.optional(),
  })
  .strict();

export const QuestStateSchema: z.ZodType<QuestState> = z
  .object({
    status: z.enum(['inactive', 'active', 'completed', 'failed']),
    stage: str,
    startedDay: num.nullable(),
    endedDay: num.nullable(),
    counters: numRecord,
    objectivesDone: strs,
  })
  .strict();

export const PatternStateSchema: z.ZodType<PatternState> = z
  .object({ pointer: int.min(0), turnsTaken: int.min(0), firedOnce: strs, phaseEnteredRound: num })
  .strict();

export const CombatantSchema: z.ZodType<Combatant> = z
  .object({
    uid: str,
    kind: z.enum(['player', 'companion', 'enemy']),
    refId: str,
    name: str,
    level: num,
    hp: num,
    hpMax: num,
    mp: num,
    mpMax: num,
    atk: num,
    sp: num,
    armor: num,
    ward: num,
    agi: num,
    accuracy: num,
    evasion: num,
    crit: num,
    critMult: num,
    statuses: z.array(StatusInstanceSchema),
    guarding: z.boolean(),
    initiative: num,
    resistances: z
      .object({
        physical: ResistanceSchema.optional(),
        fire: ResistanceSchema.optional(),
        storm: ResistanceSchema.optional(),
        ley: ResistanceSchema.optional(),
        void: ResistanceSchema.optional(),
        chrono: ResistanceSchema.optional(),
      })
      .strict(),
    phase: int.min(0),
    pattern: PatternStateSchema,
    cooldowns: numRecord,
    alive: z.boolean(),
    fledOrGone: z.boolean(),
    isAdd: z.boolean(),
  })
  .strict();

export const IntentSchema: z.ZodType<Intent> = z
  .object({
    moveId: str,
    targetUid: str.nullable(),
    projected: z.tuple([num, num]),
    hidden: z.boolean(),
    text: str,
    tags: strs,
  })
  .strict();

export const CommunionStateSchema: z.ZodType<CommunionState> = z
  .object({
    movement,
    resolve: num.min(0).max(8),
    questionIndex: int.min(0),
    answered: strs,
    usedAnswers: strs,
    lies: int.min(0),
    listened: z.boolean(),
    supportUsed: z.boolean(),
    clockBonusGranted: z.boolean(),
  })
  .strict();

export const CombatLogEntrySchema: z.ZodType<CombatLogEntry> = z
  .object({ round: num, text: str, kind: z.enum(['info', 'damage', 'heal', 'status', 'intent', 'phase', 'system']) })
  .strict();

const effects = z.array(z.unknown());

export const CombatStateSchema: z.ZodType<CombatState> = z
  .object({
    encounterId: str,
    locationId: str,
    enemies: z.array(CombatantSchema),
    party: z.array(CombatantSchema),
    turnOrder: strs,
    turnIndex: int.min(0),
    round: num,
    phase: z.enum(['start', 'playerTurn', 'companionTurn', 'enemyTurn', 'roundEnd', 'victory', 'defeat', 'fled']),
    intents: recordOf(IntentSchema),
    log: z.array(CombatLogEntrySchema),
    cooldowns: numRecord,
    canFlee: z.boolean(),
    onFlee: z.enum(['scatter', 'hold', 'previous']),
    fleeAttempts: int.min(0),
    communion: CommunionStateSchema.nullable(),
    resourceGainedThisTurn: num,
    onVictory: effects,
    onDefeat: effects,
    onFleeEffects: effects,
    pendingSelection: z.object({ abilityId: str.optional(), itemUid: str.optional() }).strict().nullable(),
  })
  .strict();

export const DialogueStateSchema: z.ZodType<DialogueState> = z
  .object({
    sceneId: str,
    nodeId: str,
    npcId: str.nullable(),
    visitedNodes: strs,
    choicesTaken: strs,
    returnMode: z.enum(['explore', 'combat', 'threshold']),
  })
  .strict();

export const MerchantStateSchema: z.ZodType<MerchantState> = z
  .object({ stock: z.array(item), lastRestockDay: num, purchasesThisLoop: int.min(0) })
  .strict();

export const RunCountersSchema: z.ZodType<RunCounters> = z
  .object({
    kills: numRecord,
    seen: numRecord,
    damageDealt: num,
    damageTaken: num,
    damageBySource: numRecord,
    abilitiesUsed: numRecord,
    itemsCrafted: num,
    itemsUpgraded: num,
    goldEarned: num,
    goldSpent: num,
    fights: num,
    fightsWon: num,
    fled: num,
    rests: num,
    travels: num,
    questsCompleted: num,
    questsFailed: num,
    echoesGainedThisLoop: num,
    deathsThisLoop: num,
    custom: numRecord,
    resonance: num.optional(),
  })
  .strict();

export const LogEntrySchema: z.ZodType<LogEntry> = z
  .object({ step: num, text: str, kind: z.enum(['narration', 'event', 'system', 'dialogue', 'combat']) })
  .strict();

export const EndingPendingSchema: z.ZodType<EndingPending> = z
  .object({
    outcome: z.union([z.literal('closer_escape'), z.literal('closer_fall'), endingId]),
    reason: CloserReasonSchema.optional(),
    slideIndex: int.min(0),
  })
  .strict();

export const ThresholdStateSchema: z.ZodType<ThresholdState> = z
  .object({
    visited: z.array(z.enum(['still_shore', 'gallery', 'loom', 'far_light'])),
    spentThisVisit: num,
    pendingClassId: str.nullable(),
  })
  .strict();

export const GameStateSchema: z.ZodType<GameState> = z
  .object({
    meta: GameMetaSchema,
    clock: ClockStateSchema,
    before: BeforeStateSchema.nullable(),
    player: PlayerStateSchema,
    companions: CompanionsStateSchema,
    world: WorldStateSchema,
    quests: recordOf(QuestStateSchema),
    flags: recordOf(FlagValueSchema),
    reputation: z.object({ remnants: num, weavers: num, ironclad: num }).strict(),
    echoesThisLoop: strs,
    combat: CombatStateSchema.nullable(),
    dialogue: DialogueStateSchema.nullable(),
    merchants: recordOf(MerchantStateSchema),
    rng: RngStateSchema,
    counters: RunCountersSchema,
    pendingEnding: EndingPendingSchema.nullable(),
    mode: ModeSchema,
    recentLog: z.array(LogEntrySchema),
    threshold: ThresholdStateSchema.nullable(),
  })
  .strict();
