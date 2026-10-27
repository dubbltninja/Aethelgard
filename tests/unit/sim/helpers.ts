// Shared builders for the U39 tests: blank run results, loops, fights and batch runs a test fills in to drive one metric.
import type { FightRecord, LoopRecord, RunResult } from '@sim/runner';
import type { BatchRun } from '@sim/metrics';

export const blankFight = (over: Partial<FightRecord> = {}): FightRecord => ({
  encounterId: 'enc_x',
  regionId: 'region_silverwood_ruins',
  playerLevel: 3,
  rounds: 4,
  result: 'victory',
  damageTaken: 10,
  enemies: ['cr_corrupted_shade'],
  boss: false,
  damageDealt: 50,
  gold: 10,
  endMp: 5,
  mpMax: 20,
  companion: false,
  phase: 0,
  communion: false,
  ...over,
});

export const blankLoop = (over: Partial<LoopRecord> = {}): LoopRecord => ({
  loop: 1,
  classId: 'ranger',
  daysUsed: 30,
  outcome: 'closer_escape',
  level: 5,
  questsCompleted: [],
  echoesGained: [],
  heartstone: 'intact',
  tyrant: 'defeated', // U81b1: an Escape is through the Tyrant (an untouched one is the expiry Horde's portal: metrics.ts)
  steps: 400,
  deaths: 0,
  gold: 100,
  ...over,
});

export const blankResult = (over: Partial<RunResult> = {}): RunResult => ({
  seed: 's:0',
  classId: 'ranger',
  bot: 'melee',
  steps: 100,
  durationMs: 1,
  loops: [],
  endings: [],
  closers: [],
  deaths: 0,
  damageBySource: {},
  abilitiesUsed: {},
  itemsCrafted: 0,
  questsCompleted: [],
  questsStarted: [],
  questsFailed: [],
  locationsVisited: [],
  creaturesKilled: {},
  creaturesSeen: [],
  itemsObtained: [],
  codexUnlocked: [],
  achievements: [],
  echoes: [],
  fights: [],
  softLock: { detected: false },
  errors: [],
  rejected: 0,
  finalStateHash: 'h',
  stopReason: 'max_steps',
  fallen: 0,
  final: { loop: 1, day: 1, level: 1, mode: 'explore', locationId: 'loc_whispering_ruins' },
  combatActions: {},
  bloodCasts: 0,
  purchases: {},
  craftsByRecipe: {},
  upgradesByRarity: {},
  questDays: {},
  choicesTaken: [],
  minGold: 0,
  maxResolve: 0,
  companions: {},
  ...over,
});

export const batchRun = (result: RunResult, meta: Partial<Omit<BatchRun, 'result'>> = {}): BatchRun => ({ pack: 'p', suite: 'main', repro: 'npm run sim:replay -- x', result, ...meta });

/** `n` copies of a run with consecutive seeds. */
export const many = (n: number, make: (i: number) => RunResult, meta: Partial<Omit<BatchRun, 'result'>> = {}): BatchRun[] => Array.from({ length: n }, (_, i) => batchRun(make(i), meta));
