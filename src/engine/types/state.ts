// GameState and its sub-types (PLAN §4.2). Everything here is JSON-serializable: no Map, Set, Date, functions,
// class instances or `undefined`-bearing arrays — `structuredClone` is exact and saves are plain JSON.
// Optional properties are either present with a value or absent (never written as `undefined`).
import type { CloserReason, EndingId } from './ids';

/**
 * Four unsigned 32-bit words: the xoshiro128** state (PLAN §4.1). Stored in GameState.rng; never all zero.
 * Declared here so the types compile on their own; `src/engine/rng.ts` re-exports it.
 */
export type RngState = readonly [number, number, number, number];

export type Mode = 'title' | 'explore' | 'combat' | 'dialogue' | 'threshold' | 'ending';
/** dawn, day, dusk, night (DESIGN §10.1) — travel costs one (D-005). */
export type Watch = 0 | 1 | 2 | 3;
/** D-044 plain ids. */
export type StatName = 'strength' | 'magic' | 'agility';
export type DamageType = 'physical' | 'fire' | 'storm' | 'ley' | 'void' | 'chrono';
export type Resistance = 'weak' | 'neutral' | 'resist' | 'immune';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type FactionId = 'remnants' | 'weavers' | 'ironclad';
export type Stance = 'aggressive' | 'guarded' | 'support';
export type EquipSlot = 'weapon' | 'armor' | 'trinket1' | 'trinket2';
export type FlagValue = boolean | number | string;

export interface GameMeta {
  /** The run seed string (shown in run summary; replay key). */
  seed: string;
  /** 1-based. */
  loop: number;
  /** GameState schema version (saves migrate on this). */
  version: number;
  /** Actions accepted so far (sim metrics, autosave cadence). */
  stepCount: number;
  /** Monotonically increasing; source of all instance ids (no randomness, no clock). */
  nextUid: number;
  /** `${seed}:${loop}` at loop start; used by achievements/runHistory. */
  runId: string;
  /** ModifierIds active for this run (copied from profile at newLoop; immutable mid-run). */
  modifiers: string[];
  playerName: string;
}

export interface Stats {
  strength: number;
  magic: number;
  agility: number;
}

/** The Breach Clock, stored in ticks (one tick = one watch; D-066 #15). Day/watch are derived. */
export interface ClockState {
  /** 0 = Day 1 Dawn. */
  ticks: number;
  /** 116 = Day 30 Dawn; never below dayStart(now) + 12 (clock floor, DESIGN §10.1). */
  limitTicks: number;
  /** Audit trail shown in the HUD tooltip. */
  modifiers: { source: string; watches: number }[];
  /** True inside Silverwood Before. */
  frozen: boolean;
  /** Set at the limit; the expiry Horde runs (DESIGN §10.2). */
  expired: boolean;
}

/** Silverwood Before's own counter (DESIGN §10.1, D-066 #9); null outside the Before. */
export interface BeforeState {
  day: 1 | 2 | 3;
  resets: number;
}

export interface ItemInstance {
  /** `i${nextUid}`. */
  uid: string;
  itemId: string;
  /** Stackables only; equipment always 1. */
  qty: number;
  /** Rarity IS the upgrade ladder (DESIGN §8.3); no separate upgrade level. */
  rarity: Rarity;
  /** AffixIds (DESIGN §7.3); saves must keep them. */
  affixes: string[];
  /** Set when granted by a quest; cannot be sold/dropped while that quest is active. */
  boundQuest?: string;
}

/** Per-loop / per-day usage records (DESIGN §14.1). */
export type Uses = Record<string, { loop?: number; day?: number; count?: number }>;

export interface Equipment {
  weapon: ItemInstance | null;
  armor: ItemInstance | null;
  trinket1: ItemInstance | null;
  trinket2: ItemInstance | null;
}

export interface PlayerState {
  name: string;
  classId: string;
  level: number;
  /** XP toward next level (curve in progression.ts; legacy: level*100). */
  xp: number;
  stats: Stats;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  gold: number;
  /** 0..6 (D-017). */
  corruption: number;
  inventory: ItemInstance[];
  equipment: Equipment;
  abilitiesUnlocked: string[];
  /** Unspent ability points in half-points (1 AP = 2; DESIGN §5.1). */
  apHalf: number;
  statPoints: number;
  /** Out-of-combat Poison/Bleed/Curse and status_rested (DESIGN §4.5, §9.5). */
  statuses: StatusInstance[];
  /** att_second_wind, free inn rest, Remembered Steps, respec once per day … */
  uses: Uses;
  /** The player's stance only affects companion AI defaults; stored here for UI. */
  stance: Stance;
  /** From quest-item passives (legacy Amulet +1 MAG etc.). */
  passiveBonuses: Partial<Record<StatName | 'hpMax' | 'mpMax', number>>;
}

export interface CompanionRunState {
  id: string;
  recruited: boolean;
  /** 0..100. */
  loyalty: number;
  hp: number;
  hpMax: number;
  /** Knocked out this fight/day; recovers on rest. */
  ko: boolean;
  /** Permadeath only where content says so (Brak at the Apex). */
  dead: boolean;
  stance: Stance;
  /** Auto abilities + signature, in the companion's turns; companions have no MP (D-066 #12). */
  cooldowns: Record<string, number>;
  /** LocationId where a non-active companion waits (camps); null = travels with party but inactive. */
  waitingAt: string | null;
  arcFlags: Record<string, FlagValue>;
}

export interface CompanionsState {
  /** Keyed by CompanionId; only recruited ones present. */
  recruited: Record<string, CompanionRunState>;
  activeId: string | null;
}

export interface LocationState {
  visited: boolean;
  visitCount: number;
  /** Items currently lying here (initial from content on first entry + drops). */
  items: ItemInstance[];
  /** Content items have been instantiated. */
  itemsSpawned: boolean;
  /** Encounter ids beaten with once=true, or respawn pending. */
  encountersCleared: string[];
  /** For respawn: 'daily'. */
  encounterClearedDay: Record<string, number>;
  eventsFired: string[];
  flags: Record<string, FlagValue>;
  /** LocationIds unlocked by `unlockExit`. */
  unlockedExits: string[];
  /** LocationIds locked by `lockExit`. */
  lockedExits: string[];
  /** Fixed non-boss encounters fled this loop (onFlee 'scatter', DESIGN §4.7). */
  scattered: string[];
  /** Fled boss/story-gate encounter → creatureId → HP, until dawn. */
  encounterHp: Record<string, Record<string, number>>;
}

export interface SpawnedEncounter {
  id: string;
  groups: { creatureId: string; count: number }[];
  once: boolean;
  onFlee: 'scatter' | 'hold';
  label?: string;
}

export type HeartstoneState = 'intact' | 'stabilized' | 'exploited' | 'destroyed';
export type TyrantState = 'waiting' | 'defeated' | 'spared' | 'communing';

export interface WorldState {
  currentLocationId: string;
  previousLocationId: string | null;
  /** Sparse: created on first touch. */
  locationStates: Record<string, LocationState>;
  /** LocationIds known this run (map). */
  discovered: string[];
  /** From `spawn` effects, keyed by LocationId. */
  pendingEncounters: Record<string, SpawnedEncounter[]>;
  /** Moved/hidden NPCs (Ilyra → portal). */
  npcOverrides: Record<string, { location: string | null }>;
  hordeActive: boolean;
  hordeDelay: number;
  /** LocationIds (legacy horde spread). */
  infected: string[];
  hordePending: Record<string, number>;
  /** Expiry Hordes start after a 3-move delay (DESIGN §10.2). */
  hordeCause: 'tyrant' | 'expiry' | null;
  heartstone: HeartstoneState;
  tyrant: TyrantState;
  /** Gathering nodes, 1–2 per day (DESIGN §8.2). */
  gather: Record<string, { day: number; taken: number }>;
  /** Free-form, content-driven flavor. */
  weather?: string;
}

export type QuestStatus = 'inactive' | 'active' | 'completed' | 'failed';

export interface QuestState {
  status: QuestStatus;
  stage: string;
  startedDay: number | null;
  endedDay: number | null;
  counters: Record<string, number>;
  objectivesDone: string[];
}

export interface StatusInstance {
  statusId: string;
  stacks: number;
  duration: number;
  sourceUid: string | null;
  /** DoT/Regen amount computed at application from the source's stats (DESIGN §4.5). */
  tick?: number;
  /** Skip this turn's decrement (D-066 #4). */
  appliedOnOwnTurn: boolean;
  /** status_rewind. */
  snapshotHp?: number;
}

/** Ordered-pattern bookkeeping for enemy AI (DESIGN §4.2). */
export interface PatternState {
  pointer: number;
  turnsTaken: number;
  firedOnce: string[];
  phaseEnteredRound: number;
}

export interface Combatant {
  /** `c${nextUid}`. */
  uid: string;
  kind: 'player' | 'companion' | 'enemy';
  /** classId / companionId / creatureId. */
  refId: string;
  name: string;
  level: number;
  hp: number;
  hpMax: number;
  /** Enemies and companions: 0/0 (companions use cooldowns). */
  mp: number;
  mpMax: number;
  /** ATK = STR + weapon power (DESIGN §3.2). */
  atk: number;
  /** SP = MAG + spell power (DESIGN §3.2). */
  sp: number;
  armor: number;
  ward: number;
  agi: number;
  accuracy: number;
  evasion: number;
  crit: number;
  critMult: number;
  statuses: StatusInstance[];
  guarding: boolean;
  initiative: number;
  resistances: Partial<Record<DamageType, Resistance>>;
  /** Boss phase index (0 = tyr_movement_1 …). */
  phase: number;
  pattern: PatternState;
  /** Companions' abilities; enemies' move cooldowns if a move declares one. */
  cooldowns: Record<string, number>;
  alive: boolean;
  fledOrGone: boolean;
  /** Summoned by a phase. */
  isAdd: boolean;
}

/** Generation = commitment (DESIGN §4.2): computed when the creature finishes its turn, never re-rolled. */
export interface Intent {
  moveId: string;
  /** null for 'all' / 'self'. */
  targetUid: string | null;
  /** Full pipeline with variance bounds, not assuming Guard. */
  projected: [number, number];
  /** "?" chip until the player's turn immediately preceding it. */
  hidden: boolean;
  /** Telegraph line (WORLD §6 move line). */
  text: string;
  /** Effect tags: 'may Weaken', 'Shield', 'heals itself' … */
  tags: string[];
}

/** Communion (DESIGN §4.11, D-054, D-066 #6). */
export interface CommunionState {
  movement: 1 | 2 | 3;
  /** 0..8, starts at 1. */
  resolve: number;
  /** Within the movement. */
  questionIndex: number;
  /** Question ids answered (tyr_q_*). */
  answered: string[];
  /** Echo/item/answer ids already used this encounter. */
  usedAnswers: string[];
  /** Two lies → rejection. */
  lies: number;
  /** Once per movement. */
  listened: boolean;
  /** Once per movement. */
  supportUsed: boolean;
  /** +8 watches at Resolve ≥ 4, once per loop. */
  clockBonusGranted: boolean;
}

export type CombatPhase = 'start' | 'playerTurn' | 'companionTurn' | 'enemyTurn' | 'roundEnd' | 'victory' | 'defeat' | 'fled';

export interface CombatLogEntry {
  round: number;
  text: string;
  kind: 'info' | 'damage' | 'heal' | 'status' | 'intent' | 'phase' | 'system';
}

export interface CombatState {
  encounterId: string;
  locationId: string;
  enemies: Combatant[];
  /** [player, companion?] — snapshots synced back to player/companion on exit. */
  party: Combatant[];
  /** uids. */
  turnOrder: string[];
  turnIndex: number;
  round: number;
  phase: CombatPhase;
  /** By enemy uid, for the *next* enemy action. */
  intents: Record<string, Intent>;
  /** Capped at 200 entries. */
  log: CombatLogEntry[];
  /** Player ability id → turns remaining. */
  cooldowns: Record<string, number>;
  /** False for bosses and story gates only (D-066 #11). */
  canFlee: boolean;
  /** Fixed group / boss-gate / wandering (DESIGN §4.7). */
  onFlee: 'scatter' | 'hold' | 'previous';
  fleeAttempts: number;
  communion: CommunionState | null;
  resourceGainedThisTurn: number;
  /** Effect[] copied from the encounter (typed as Effect once src/content/schema/effect.ts exists, U14). */
  onVictory: unknown[];
  onDefeat: unknown[];
  /**
   * The encounter's on-flee Effect[]. PLAN §4.2 lists `onFlee` twice (mode and effects); a TS interface cannot,
   * so the effect list is `onFleeEffects` and `onFlee` stays the flee mode.
   */
  onFleeEffects: unknown[];
  /** UI-only hint: awaiting target pick. */
  pendingSelection: { abilityId?: string; itemUid?: string } | null;
}

export interface DialogueState {
  sceneId: string;
  nodeId: string;
  npcId: string | null;
  visitedNodes: string[];
  /** Choice ids taken this scene (for once=true choices). */
  choicesTaken: string[];
  returnMode: 'explore' | 'combat' | 'threshold';
}

export interface MerchantState {
  stock: ItemInstance[];
  lastRestockDay: number;
  purchasesThisLoop: number;
}

export interface RunCounters {
  kills: Record<string, number>;
  seen: Record<string, number>;
  damageDealt: number;
  damageTaken: number;
  /** 'basic' | abilityId | 'companion:<id>' | 'status:<id>' | 'item:<id>'. */
  damageBySource: Record<string, number>;
  abilitiesUsed: Record<string, number>;
  itemsCrafted: number;
  itemsUpgraded: number;
  goldEarned: number;
  goldSpent: number;
  fights: number;
  fightsWon: number;
  fled: number;
  rests: number;
  travels: number;
  questsCompleted: number;
  questsFailed: number;
  echoesGainedThisLoop: number;
  /** 0/1; Loop 1 game over is recorded as a closer. */
  deathsThisLoop: number;
  /** Content `counter` effects. */
  custom: Record<string, number>;
}

export interface LogEntry {
  step: number;
  text: string;
  kind: 'narration' | 'event' | 'system' | 'dialogue' | 'combat';
}

export interface EndingPending {
  outcome: 'closer_escape' | 'closer_fall' | EndingId;
  /** closer_fall only (D-066 #7; `released` = *Let go*, D-067.14). */
  reason?: CloserReason;
  slideIndex: number;
}

export type ThresholdArea = 'still_shore' | 'gallery' | 'loom' | 'far_light';

export interface ThresholdState {
  visited: ThresholdArea[];
  spentThisVisit: number;
  pendingClassId: string | null;
}

export interface GameState {
  meta: GameMeta;
  clock: ClockState;
  before: BeforeState | null;
  player: PlayerState;
  companions: CompanionsState;
  world: WorldState;
  /** Sparse; absent = inactive & never started. */
  quests: Record<string, QuestState>;
  flags: Record<string, FlagValue>;
  /** −100..100 (D-014). */
  reputation: Record<FactionId, number>;
  /** Echo ids granted this loop (also written to profile). */
  echoesThisLoop: string[];
  combat: CombatState | null;
  dialogue: DialogueState | null;
  merchants: Record<string, MerchantState>;
  rng: RngState;
  counters: RunCounters;
  pendingEnding: EndingPending | null;
  mode: Mode;
  /** Last 100 narration/system lines; UI log beyond this comes from events. */
  recentLog: LogEntry[];
  threshold: ThresholdState | null;
}
