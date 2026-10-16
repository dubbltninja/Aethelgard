// The sim runner (PLAN §7.3; D-037, D-043, D-049, D-082): plays one seeded run of a bot through `step`, checking the
// engine on the way, and returns what happened. Headless and runtime-neutral (no bun/node APIs), so the same code can
// run in a worker (U39) or the browser.
//
// The loop: `legal = legalActions(state)`; a hard lock (no legal action) ends the run; `action = bot.choose(...)`; the
// action must be structurally equal to a listed one (else a bot bug in `errors`, and it is still played); `step`; the
// step's events feed the record and the soft-lock detector; the run stops per `stopAt`. An exception from `step` (or the
// bot) is recorded with the state hash and the last 20 actions and ends the run — an engine exception is always a
// release blocker. Per-step invariants: no throw; a listed action is never rejected (C2, D-085); the state parses as a
// `GameState` every `validateEvery` steps and at the end (the profile as a `Profile` at the end).
//
// The runner is also the shell (the bot never sees these screens):
//   title       `newGame` (the configured class and seed) — or, after a FALLEN screen, `load` of the last autosave;
//   FALLEN      a Loop 1 death outside a Horde (D-049, D-082): `returnToTitle`, then the reload above, as a player
//               would. `onFallen: 'stop'` ends the run there instead; `maxFallen` caps the reloads per run;
//   autosave    after a step that emits `autosaveCheckpoint`, where `canAutosave` allows it and the profile's
//               `settings.autosave` is on, the shell keeps `serialize(state)` as the autosave slot.
// Run seeds: the run's `seed` is Loop 1's seed (`newGame`), and a fresh profile's id, so Loop 2+ seeds
// (`${profileId}:${loop}`, PLAN §4.11) follow it too. The bot's seed is `${seed}:bot:${name}`.
import {
  GameStateSchema,
  ProfileSchema,
  canAutosave,
  dayOf,
  legalActions,
  newRun,
  playerAbilityCost,
  serialize,
  step,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Mode,
  type Profile,
  type SaveFile,
  type StepResult,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { stateHash } from '@engine/util/hash';
import { actionKey, isShellAction } from './bots/shared';
import type { Bot, BotMemory } from './bots/types';
import { loadScenario, newProfile, type ScenarioId } from './scenarios';
import { STALL_STEPS_POLICY, SoftLockDetector, type SoftLockOptions, type SoftLockRule } from './softlock';

// ---- contract (PLAN §7.3) -------------------------------------------------------------------------------------------------

export type StopAt = 'loop_end' | 'ending' | 'max_steps';

export interface RunConfig {
  seed: string;
  classId: string | 'auto';
  bot: Bot;
  /** Default 6000. Every action played counts (shell steps and rejected ones too). */
  maxSteps?: number;
  /** Default 3 (stop at the Threshold of loop maxLoops; `stopAt: 'ending'` only). */
  maxLoops?: number;
  /** Default 'ending' with maxLoops as the cap. 'loop_end': the first loop's end. 'max_steps': only the step cap. */
  stopAt?: StopAt;
  /** Carried across runs for multi-loop knowledge (default: a fresh profile whose id is `seed`). Copied, never mutated. Not with `scenario` (it builds its own). */
  profile?: Profile;
  /** Modifier ids toggled on in the profile before the first loop (not with `scenario`). */
  modifiers?: string[];
  /** Keep the full action trace (memory!). */
  record?: boolean;
  /** Start from `loadScenario(id)` (PLAN §4.13) instead of the title screen. */
  scenario?: ScenarioId;
  /** U39: a recruited companion who travels with the Wayfinder from the scenario's start (DESIGN §19 #19 "with a companion"); only with `scenario`. */
  companionId?: string;
  /**
   * U37: the shell on the Loop 1 FALLEN screen (D-049): 'reload' the last autosave (a new game when there is none), or
   * 'stop' the run. Default 'reload'; 'stop' for a scenario run (its start is no save to go back to).
   */
  onFallen?: 'reload' | 'stop';
  /** U37: FALLEN screens allowed before the run stops (default 25). */
  maxFallen?: number;
  /** U37: parse the state as a GameState every N steps (default 50; 0 = only at the end). */
  validateEvery?: number;
  /** U37: soft-lock detector overrides (the stall window defaults to the bot's `stallSteps`, else 60). */
  softLock?: Partial<SoftLockOptions>;
}

export interface FightRecord {
  encounterId: string;
  regionId: string;
  playerLevel: number;
  rounds: number;
  result: 'victory' | 'defeat' | 'fled';
  damageTaken: number;
  enemies: string[];
  boss: boolean;
  /** U39: HP the party dealt in the fight (the effective HP a won boss fight demanded, DESIGN §19 #19). */
  damageDealt: number;
  /** U39: the player's gold when the fight began. */
  gold: number;
  /** U39: the player's MP and MP pool when the fight ended (DESIGN §19 #13: fights that end with 0 MP). */
  endMp: number;
  mpMax: number;
  /** U39: a companion fought alongside the player (DESIGN §19 #17). */
  companion: boolean;
  /** U39: the highest boss phase index reached (0 = the first phase). */
  phase: number;
  /** U39: the player spoke, listened, offered or resisted in the fight (the Unveiled Tyrant's communion, not the fight path). */
  communion: boolean;
}

export interface LoopRecord {
  loop: number;
  classId: string;
  daysUsed: number;
  outcome: string;
  reason?: string;
  level: number;
  questsCompleted: string[];
  echoesGained: string[];
  heartstone: string;
  tyrant: string;
  /** U39: accepted and rejected actions played in this loop, the deaths it saw (FALLEN screens included) and the gold at its end. */
  steps: number;
  deaths: number;
  gold: number;
}

/** Why the run stopped (U37 addition). */
export type StopReason = 'ending' | 'loop_end' | 'max_loops' | 'max_steps' | 'soft_lock' | 'error' | 'fallen' | 'script_done' | 'script_assert';

export interface RunError {
  step: number;
  message: string;
  stack?: string;
  action?: Action;
  stateHash?: string;
}

export interface SoftLockInfo {
  detected: boolean;
  step?: number;
  signature?: string;
  lastActions?: Action[];
  locationId?: string;
  mode?: Mode;
  /** U37: which PLAN §7.6 rule fired, and why. */
  rule?: SoftLockRule;
  detail?: string;
}

export interface RunResult {
  seed: string;
  classId: string;
  bot: string;
  steps: number;
  durationMs: number;
  loops: LoopRecord[];
  /** True endings reached (`endingReached`). */
  endings: string[];
  /** Loop closers reached, in order (`closer_escape`, `closer_fall`); the reasons are in `loops`. */
  closers: string[];
  /** Every `playerDied` (FALLEN screens included). */
  deaths: number;
  damageBySource: Record<string, number>;
  abilitiesUsed: Record<string, number>;
  itemsCrafted: number;
  questsCompleted: string[];
  questsStarted: string[];
  questsFailed: string[];
  locationsVisited: string[];
  creaturesKilled: Record<string, number>;
  creaturesSeen: string[];
  itemsObtained: string[];
  codexUnlocked: string[];
  achievements: string[];
  echoes: string[];
  fights: FightRecord[];
  softLock: SoftLockInfo;
  errors: RunError[];
  /** `actionRejected` count (a bot/legal mismatch indicator). */
  rejected: number;
  finalStateHash: string;
  trace?: Action[];
  /** U37: why the run stopped (U38: `script_done` / `script_assert` for a scripted bot). */
  stopReason: StopReason;
  /** U38: the failed checkpoint's message when `stopReason` is `script_assert`. */
  stopMessage?: string;
  /** U37: Loop 1 FALLEN screens (game overs the shell reloaded from, or stopped at). */
  fallen: number;
  /** U37: where the run stood at the end. */
  final: { loop: number; day: number; level: number; mode: Mode; locationId: string };
  /** U39: accepted actions played in combat, by action type (shell actions excluded). */
  combatActions: Record<string, number>;
  /** U39: ability casts whose MP cost was partly paid in HP (the Shadow Weaver's Blood price, DESIGN §5.6). */
  bloodCasts: number;
  /** U39: purchases by item id, crafts by recipe id, upgrades by the rarity reached (DESIGN §19 #14, PLAN §7.5 `economy`). */
  purchases: Record<string, number>;
  craftsByRecipe: Record<string, number>;
  upgradesByRarity: Record<string, number>;
  /** U39: days from a quest's start to its first completion in the run (loop-local). */
  questDays: Record<string, number>;
  /** U39: dialogue choices taken, as `<sceneId>/<choiceId>` (PLAN §7.7 `dialogueChoices`). */
  choicesTaken: string[];
  /** U39: the lowest gold the player held at any step (DESIGN §19 #14: never negative). */
  minGold: number;
  /** U39: the highest Resolve the Tyrant's communion reached (DESIGN §19 #20; 0 = no communion). */
  maxResolve: number;
  /** U39: per recruited companion: knocked-out count, died, last loyalty (PLAN §7.5 `companions`). */
  companions: Record<string, { kos: number; died: boolean; loyalty: number }>;
}

export const DEFAULT_MAX_STEPS = 6000;
export const DEFAULT_MAX_LOOPS = 3;
export const DEFAULT_MAX_FALLEN = 25;
export const DEFAULT_VALIDATE_EVERY = 50;
export const LAST_ACTIONS = 20;
/** The name the shell gives the Wayfinder (the title's default). */
export const SIM_PLAYER_NAME = 'Wayfinder';

/** `classId: 'auto'` → the bot's first preferred class the pack has, else the pack's first class by id. */
export function resolveClass(classId: string, bot: Pick<Bot, 'preferredClasses'>, content: ContentPack): string {
  if (classId !== 'auto') {
    if (content.classes[classId] === undefined) throw new Error(`runner: the pack has no class '${classId}'`);
    return classId;
  }
  const pick = (bot.preferredClasses ?? []).find((id) => content.classes[id] !== undefined) ?? Object.keys(content.classes).sort()[0];
  if (pick === undefined) throw new Error('runner: the pack has no classes');
  return pick;
}

/** The Loop 1 FALLEN screen (D-049, D-082): the fight left on screen in phase 'defeat'. */
export const isFallenScreen = (s: GameState): boolean => s.mode === 'combat' && s.combat?.phase === 'defeat';

const zodIssues = (issues: readonly { path: (string | number)[]; message: string }[]): string =>
  issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');

// ---- the record --------------------------------------------------------------------------------------------------------------

/** Combat phases of a finished fight still on screen (the FALLEN screen is `defeat`). */
const OVER_PHASES: ReadonlySet<string> = new Set(['victory', 'defeat', 'fled']);

/** Adds `next − prev` of each counter key (new loops and reloads start their counters afresh: the caller skips those). */
function addDelta(into: Record<string, number>, prev: Record<string, number>, next: Record<string, number>): void {
  for (const [k, v] of Object.entries(next)) {
    const d = v - (prev[k] ?? 0);
    if (d > 0) into[k] = (into[k] ?? 0) + d;
  }
}

/** What happened, step by step (counters by delta on the same timeline, the rest from events). Exported for tests/unit/sim/runnerStats.test.ts. */
export class Recorder {
  deaths = 0;
  readonly damageBySource: Record<string, number> = {};
  readonly abilitiesUsed: Record<string, number> = {};
  readonly creaturesKilled: Record<string, number> = {};
  itemsCrafted = 0;
  readonly questsStarted = new Set<string>();
  readonly questsCompleted = new Set<string>();
  readonly questsFailed = new Set<string>();
  readonly locations = new Set<string>();
  readonly seen = new Set<string>();
  readonly items = new Set<string>();
  readonly codex = new Set<string>();
  readonly achievements = new Set<string>();
  readonly echoes = new Set<string>();
  readonly loops: LoopRecord[] = [];
  readonly endings: string[] = [];
  readonly closers: string[] = [];
  readonly fights: FightRecord[] = [];
  // U39: what the balance report (metrics.ts) reads
  readonly combatActions: Record<string, number> = {};
  bloodCasts = 0;
  readonly purchases: Record<string, number> = {};
  readonly craftsByRecipe: Record<string, number> = {};
  readonly upgradesByRarity: Record<string, number> = {};
  readonly questDays: Record<string, number> = {};
  readonly choices = new Set<string>();
  minGold = Number.POSITIVE_INFINITY;
  maxResolve = 0;
  readonly companions: Record<string, { kos: number; died: boolean; loyalty: number }> = {};
  private open: (Omit<FightRecord, 'rounds' | 'result' | 'damageTaken' | 'damageDealt'> & { taken: number; dealt: number }) | null = null;
  private readonly questStart = new Map<string, number>();
  private loopStartSteps = 0;
  private loopStartDeaths = 0;

  constructor(private readonly content: ContentPack) {}

  /** `steps`: the runner's action count including this one; `action`: the accepted action that produced `next`. */
  observe(prev: GameState, next: GameState, events: readonly GameEvent[], action: Action, steps: number): void {
    const sameTimeline = prev.meta.runId === next.meta.runId && !events.some((e) => e.t === 'saveLoaded');
    if (sameTimeline) {
      addDelta(this.damageBySource, prev.counters.damageBySource, next.counters.damageBySource);
      addDelta(this.abilitiesUsed, prev.counters.abilitiesUsed, next.counters.abilitiesUsed);
      addDelta(this.creaturesKilled, prev.counters.kills, next.counters.kills);
      this.itemsCrafted += Math.max(0, next.counters.itemsCrafted - prev.counters.itemsCrafted);
      if (this.open !== null) {
        this.open.taken += Math.max(0, next.counters.damageTaken - prev.counters.damageTaken);
        this.open.dealt += Math.max(0, next.counters.damageDealt - prev.counters.damageDealt);
      }
    }
    this.minGold = Math.min(this.minGold, next.player.gold);
    // a scenario can begin inside a fight: its `combatStarted` is not in the run
    if (this.open === null && prev.mode === 'combat' && prev.combat !== null && !OVER_PHASES.has(prev.combat.phase)) this.startFight(prev, prev, prev.combat.encounterId, prev.combat.enemies.map((c) => c.refId));
    if (prev.mode === 'combat' && !isShellAction(action)) {
      this.combatActions[action.type] = (this.combatActions[action.type] ?? 0) + 1;
      if (action.type === 'ability' && this.paidInBlood(prev, action.abilityId)) this.bloodCasts += 1;
      if (action.type === 'commune' && this.open !== null) this.open.communion = true;
    }
    if (action.type === 'choose' && prev.dialogue !== null) this.choices.add(`${prev.dialogue.sceneId}/${action.choiceId}`);
    let loop: LoopRecord | null = null;
    for (const e of events) loop = this.event(e, prev, next, loop);
    if (loop !== null) {
      // the loop's own step and death counts, after every event of the step (a death precedes its loopEnded, but the order is not relied on)
      loop.steps = steps - this.loopStartSteps;
      loop.deaths = this.deaths - this.loopStartDeaths;
      this.loopStartSteps = steps;
      this.loopStartDeaths = this.deaths;
    }
  }

  /** Did this cast pay part of its MP cost in HP (Blood price)? */
  private paidInBlood(prev: GameState, abilityId: string): boolean {
    if (this.content.classes[prev.player.classId]?.resource.bloodPrice === undefined || this.content.abilities[abilityId] === undefined) return false;
    const me = prev.combat?.party.find((c) => c.kind === 'player');
    const cost = playerAbilityCost(prev, this.content, abilityId, me);
    return cost.ok && cost.mpPaid < cost.mp;
  }

  private companion(id: string): { kos: number; died: boolean; loyalty: number } {
    return (this.companions[id] ??= { kos: 0, died: false, loyalty: 0 });
  }

  /** Opens a fight record (`combatStarted`, or the fight a scenario starts the run in the middle of). */
  private startFight(prev: GameState, next: GameState, encounterId: string, enemies: string[]): void {
    for (const id of enemies) this.seen.add(id);
    const at = next.combat?.locationId ?? next.world.currentLocationId;
    this.open = {
      encounterId,
      regionId: this.content.locations[at]?.regionId ?? '',
      playerLevel: prev.player.level,
      taken: 0,
      dealt: 0,
      enemies,
      boss: enemies.some((id) => this.content.creatures[id]?.role === 'boss'),
      gold: prev.player.gold,
      endMp: 0,
      mpMax: 0,
      companion: (next.combat?.party.length ?? prev.combat?.party.length ?? 1) > 1,
      phase: 0,
      communion: false,
    };
  }

  private event(e: GameEvent, prev: GameState, next: GameState, loop: LoopRecord | null): LoopRecord | null {
    switch (e.t) {
      case 'locationEntered':
        this.locations.add(e.locationId);
        break;
      case 'questStarted':
        this.questsStarted.add(e.questId);
        if (!this.questStart.has(e.questId)) this.questStart.set(e.questId, dayOf(next.clock.ticks));
        break;
      case 'questCompleted':
        this.questsCompleted.add(e.questId);
        this.questDays[e.questId] ??= Math.max(0, dayOf(next.clock.ticks) - (this.questStart.get(e.questId) ?? dayOf(next.clock.ticks)));
        break;
      case 'questFailed':
        this.questsFailed.add(e.questId);
        break;
      case 'itemTaken':
      case 'itemGiven':
        this.items.add(e.item.itemId);
        break;
      case 'purchased':
        this.items.add(e.itemId);
        this.purchases[e.itemId] = (this.purchases[e.itemId] ?? 0) + 1;
        break;
      case 'crafted':
        this.items.add(e.item.itemId);
        this.craftsByRecipe[e.recipeId] = (this.craftsByRecipe[e.recipeId] ?? 0) + 1;
        break;
      case 'upgraded':
        this.upgradesByRarity[e.item.rarity] = (this.upgradesByRarity[e.item.rarity] ?? 0) + 1;
        break;
      case 'codexUnlocked':
        this.codex.add(e.codexId);
        break;
      case 'achievementUnlocked':
        this.achievements.add(e.achievementId);
        break;
      case 'echoGained':
        this.echoes.add(e.echoId);
        break;
      case 'companionRecruited':
        this.companion(e.companionId);
        break;
      case 'companionKo':
        this.companion(e.companionId).kos += 1;
        break;
      case 'companionDied':
        this.companion(e.companionId).died = true;
        break;
      case 'loyaltyChanged':
        this.companion(e.companionId).loyalty = e.value;
        break;
      case 'resolveChanged':
        this.maxResolve = Math.max(this.maxResolve, e.value);
        break;
      case 'playerDied':
        this.deaths += 1;
        break;
      case 'endingReached':
        this.endings.push(e.endingId);
        break;
      case 'bossPhase':
        if (this.open !== null) this.open.phase = Math.max(this.open.phase, e.phase);
        break;
      case 'combatStarted':
        this.startFight(prev, next, e.encounterId, e.enemies.map((en) => en.creatureId));
        break;
      case 'combatEnded': {
        const o = this.open;
        if (o !== null) {
          const { taken, dealt, ...rest } = o;
          this.fights.push({ ...rest, endMp: next.player.mp, mpMax: next.player.mpMax, damageTaken: taken, damageDealt: dealt, rounds: e.rounds, result: e.result });
        }
        this.open = null;
        break;
      }
      case 'loopEnded': {
        const r = e.record;
        const rec: LoopRecord = {
          loop: r.loop,
          classId: r.classId,
          daysUsed: r.daysUsed,
          outcome: r.outcome,
          ...(r.reason === undefined ? {} : { reason: r.reason }),
          level: r.level,
          questsCompleted: [...r.questsCompleted],
          echoesGained: [...r.echoesGained],
          heartstone: r.heartstone,
          tyrant: r.tyrant,
          steps: 0,
          deaths: 0,
          gold: next.player.gold,
        };
        this.loops.push(rec);
        this.questStart.clear();
        if (r.outcome === 'closer_escape' || r.outcome === 'closer_fall') this.closers.push(r.outcome);
        return rec;
      }
      default:
        break;
    }
    return loop;
  }
}

// ---- the run -------------------------------------------------------------------------------------------------------------------

/**
 * The state a run begins in (U39: shared with the batch's replay check): the title screen of a fresh game, or the scenario's
 * state (PLAN §4.13). `classId` is already resolved.
 */
export function startRun(
  cfg: Pick<RunConfig, 'seed' | 'profile' | 'modifiers' | 'scenario' | 'companionId'>,
  classId: string,
  content: ContentPack,
): { state: GameState; profile: Profile } {
  if (cfg.scenario !== undefined) {
    const built = loadScenario(cfg.scenario, content, { seed: cfg.seed, classId, ...(cfg.companionId === undefined ? {} : { companionId: cfg.companionId }) });
    return { state: built.state, profile: built.profile };
  }
  if (content.locations[content.config.startLocationId] === undefined) {
    throw new Error(`runner: the pack has no start location '${content.config.startLocationId}' (no world authored yet)`);
  }
  const profile = cfg.profile !== undefined ? clone(cfg.profile) : newProfile(cfg.seed);
  for (const id of cfg.modifiers ?? []) {
    if (content.modifiers[id] === undefined) throw new Error(`runner: the pack has no modifier '${id}'`);
    profile.modifiers[id] = true;
  }
  return { state: { ...newRun(cfg.seed, classId, content, profile), mode: 'title' }, profile };
}

/** Plays one run (PLAN §7.3). Throws only for a bad configuration (unknown class, a pack with no world, a scenario it cannot build). */
export function runLoop(cfg: RunConfig, content: ContentPack): RunResult {
  const t0 = performance.now();
  const { bot } = cfg;
  const maxSteps = cfg.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxLoops = cfg.maxLoops ?? DEFAULT_MAX_LOOPS;
  const stopAt = cfg.stopAt ?? 'ending';
  const maxFallen = cfg.maxFallen ?? DEFAULT_MAX_FALLEN;
  const onFallen = cfg.onFallen ?? (cfg.scenario !== undefined ? 'stop' : 'reload');
  const validateEvery = cfg.validateEvery ?? DEFAULT_VALIDATE_EVERY;
  const classId = resolveClass(cfg.classId, bot, content);
  const botSeed = `${cfg.seed}:bot:${bot.name}`;
  const memory: BotMemory = bot.init?.(botSeed) ?? {};
  const detector = new SoftLockDetector({ stallSteps: bot.stallSteps ?? STALL_STEPS_POLICY, ...cfg.softLock });
  const rec = new Recorder(content);

  let { state: s, profile } = startRun(cfg, classId, content);

  let autosave: SaveFile | null = canAutosave(s) ? serialize(s, profile, content, 'sim') : null;
  let steps = 0;
  let rejected = 0;
  let fallen = 0;
  let loopsEnded = 0;
  let stopReason: StopReason = 'max_steps';
  let stopMessage: string | undefined;
  let softLock: SoftLockInfo = { detected: false };
  const errors: RunError[] = [];
  const lastActions: Action[] = [];
  const trace: Action[] | undefined = cfg.record === true ? [] : undefined;
  let pending: GameEvent[] = [];

  const fail = (message: string, e?: unknown, action?: Action): void => {
    errors.push({
      step: steps,
      message,
      ...(e instanceof Error && e.stack !== undefined ? { stack: e.stack } : {}),
      ...(action === undefined ? {} : { action }),
      stateHash: stateHash(s),
    });
  };
  const lock = (d: { rule: SoftLockRule; step: number; signature: string; detail: string }): void => {
    softLock = {
      detected: true,
      step: d.step,
      signature: d.signature,
      lastActions: [...lastActions],
      locationId: s.world.currentLocationId,
      mode: s.mode,
      rule: d.rule,
      detail: d.detail,
    };
    stopReason = 'soft_lock';
  };

  /** Plays one action; false when the run must stop. `listed`: the action came from the legal list. */
  const play = (action: Action, listed: boolean): boolean => {
    steps += 1;
    lastActions.push(action);
    if (lastActions.length > LAST_ACTIONS) lastActions.shift();
    trace?.push(action);
    let out: StepResult;
    try {
      out = step(s, action, content, profile);
    } catch (e) {
      fail(`step threw on ${action.type}: ${e instanceof Error ? e.message : String(e)}`, e, action);
      stopReason = 'error';
      return false;
    }
    pending.push(...out.events);
    const refused = out.events.find((e) => e.t === 'actionRejected');
    if (refused?.t === 'actionRejected') {
      rejected += 1;
      if (listed) fail(`a listed action was rejected (${action.type}): ${refused.reason}`, undefined, action);
      if (detector.observeRejection(true)) {
        fail(`rejected storm: more than ${detector.opts.rejectMax} rejections in ${detector.opts.rejectWindow} steps`);
        stopReason = 'error';
        return false;
      }
      return true;
    }
    detector.observeRejection(false);
    const prev = s;
    s = out.state;
    profile = out.profile;
    rec.observe(prev, s, out.events, action, steps);

    if (out.events.some((e) => e.t === 'autosaveCheckpoint') && canAutosave(s) && profile.settings.autosave) {
      autosave = serialize(s, profile, content, 'sim');
    }
    if (validateEvery > 0 && steps % validateEvery === 0) {
      const parsed = GameStateSchema.safeParse(s);
      if (!parsed.success) {
        fail(`the state is not a valid GameState after ${action.type}: ${zodIssues(parsed.error.issues)}`, undefined, action);
        stopReason = 'error';
        return false;
      }
    }
    const detected = detector.observe(s, steps);
    if (detected !== null) {
      lock(detected);
      return false;
    }
    for (const e of out.events) {
      if (e.t === 'endingReached' && stopAt === 'ending') {
        stopReason = 'ending';
        return false;
      }
      if (e.t === 'loopEnded') {
        loopsEnded += 1;
        if (stopAt === 'loop_end') {
          stopReason = 'loop_end';
          return false;
        }
        if (stopAt === 'ending' && loopsEnded >= maxLoops) {
          stopReason = 'max_loops';
          return false;
        }
      }
    }
    return true;
  };

  /** The title screen: reload the autosave if there is one (after a FALLEN screen), else a new game. */
  const shellTitle = (): boolean => {
    if (autosave !== null && fallen > 0) {
      const save = autosave;
      autosave = null; // a refused load falls back to a new game on the next pass
      const ok = play({ type: 'load', save }, false);
      if (ok && s.mode === 'title') fail('the autosave the shell kept did not load (serialize → load round trip)');
      else if (ok) autosave = save;
      return ok;
    }
    return play({ type: 'newGame', name: SIM_PLAYER_NAME, classId, seed: cfg.seed }, false);
  };

  while (steps < maxSteps) {
    if (s.mode === 'title') {
      if (!shellTitle()) break;
      continue;
    }
    if (isFallenScreen(s)) {
      fallen += 1;
      if (onFallen === 'stop' || fallen > maxFallen) {
        stopReason = 'fallen';
        break;
      }
      if (!play({ type: 'returnToTitle' }, false)) break;
      continue;
    }
    const legal = legalActions(s, content, profile, bot.examines === true ? { includeExamine: true } : {});
    // `examine` is always listed in explore when asked for: it must not hide a hard lock (PLAN §7.6 rule 2)
    const hard = detector.checkLegal(s, bot.examines === true ? legal.filter((a) => a.type !== 'examine') : legal, steps);
    if (hard !== null) {
      fail(`hard lock: ${hard.detail}`); // PLAN §7.3 calls it an error, §7.6 rule 2 a soft-lock: it is recorded as both
      lock(hard);
      break;
    }
    let action: Action;
    try {
      action = bot.choose(s, legal, content, memory, { profile, rngSeed: botSeed, step: steps, recentEvents: pending });
    } catch (e) {
      fail(`bot '${bot.name}' threw: ${e instanceof Error ? e.message : String(e)}`, e);
      stopReason = 'error';
      break;
    }
    pending = [];
    const halt = bot.halt?.(memory) ?? null; // U38: a scripted bot ends the run itself (its action is not played)
    if (halt !== null) {
      stopReason = halt.reason;
      if (halt.message !== undefined) stopMessage = halt.message;
      break;
    }
    const key = actionKey(action);
    const listed = legal.some((a) => actionKey(a) === key);
    if (!listed) fail(`bot '${bot.name}' chose an unlisted action`, undefined, action);
    else if (isShellAction(action)) fail(`bot '${bot.name}' chose a shell action (${action.type})`, undefined, action);
    if (!play(action, listed)) break;
  }

  if (stopReason !== 'error') {
    const state = GameStateSchema.safeParse(s);
    if (!state.success) fail(`the final state is not a valid GameState: ${zodIssues(state.error.issues)}`);
    const prof = ProfileSchema.safeParse(profile);
    if (!prof.success) fail(`the final profile is not a valid Profile: ${zodIssues(prof.error.issues)}`);
  }

  return {
    seed: cfg.seed,
    classId,
    bot: bot.name,
    steps,
    durationMs: performance.now() - t0,
    loops: rec.loops,
    endings: rec.endings,
    closers: rec.closers,
    deaths: rec.deaths,
    damageBySource: rec.damageBySource,
    abilitiesUsed: rec.abilitiesUsed,
    itemsCrafted: rec.itemsCrafted,
    questsCompleted: [...rec.questsCompleted].sort(),
    questsStarted: [...rec.questsStarted].sort(),
    questsFailed: [...rec.questsFailed].sort(),
    locationsVisited: [...rec.locations].sort(),
    creaturesKilled: rec.creaturesKilled,
    creaturesSeen: [...rec.seen].sort(),
    itemsObtained: [...rec.items].sort(),
    codexUnlocked: [...rec.codex].sort(),
    achievements: [...rec.achievements].sort(),
    echoes: [...rec.echoes].sort(),
    fights: rec.fights,
    softLock,
    errors,
    rejected,
    finalStateHash: stateHash(s),
    ...(trace === undefined ? {} : { trace }),
    stopReason,
    ...(stopMessage === undefined ? {} : { stopMessage }),
    fallen,
    final: { loop: s.meta.loop, day: dayOf(s.clock.ticks), level: s.player.level, mode: s.mode, locationId: s.world.currentLocationId },
    combatActions: rec.combatActions,
    bloodCasts: rec.bloodCasts,
    purchases: rec.purchases,
    craftsByRecipe: rec.craftsByRecipe,
    upgradesByRarity: rec.upgradesByRarity,
    questDays: rec.questDays,
    choicesTaken: [...rec.choices].sort(),
    minGold: Number.isFinite(rec.minGold) ? rec.minGold : s.player.gold,
    maxResolve: rec.maxResolve,
    companions: rec.companions,
  };
}
