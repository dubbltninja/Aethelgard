// The bot interface (PLAN §7.1; D-037). A bot is a policy over engine observations: given the state and the list of
// legal actions (`legalActions`), it returns ONE of those actions. Bots are deterministic — any randomness comes from an
// `Rng` seeded from `ctx.rngSeed` (never `Math.random` / `Date.now`), so a (seed, class, bot) triple replays exactly.
// The runner (runner.ts) asserts that the returned action is structurally equal to a listed one and counts a violation
// as a bot bug (`RunResult.errors`). Shell actions (title `newGame`, `load`, the FALLEN screen's `returnToTitle`, `save`)
// are the runner's, not the bot's: a bot never sees the title screen or the Loop 1 FALLEN screen.
import type { Action, ContentPack, GameEvent, GameState, Profile } from '@engine/index';

/** Per-run scratch (bots type their own view). It survives reloads after a FALLEN screen: it is the player's memory. */
export interface BotMemory {
  [key: string]: unknown;
}

export interface BotContext {
  /** The profile as it stands before this choice (Echoes, Resonance, attunements). */
  profile: Profile;
  /** The bot's own seed (`<run seed>:bot:<bot name>`); seed an `Rng` from it, never from the clock. */
  rngSeed: string;
  /** Accepted steps so far in this run (shell steps included). */
  step: number;
  /** Every event since the bot's previous choice — its own last action's, and the shell's (a reload's `saveLoaded`). */
  recentEvents: GameEvent[];
}

export interface Bot {
  readonly name: string;
  /** Fresh memory for a run; the runner calls it once with `ctx.rngSeed`. */
  init?(seed: string): BotMemory;
  /** One action from `legal` (never empty when the runner calls this). */
  choose(state: GameState, legal: readonly Action[], content: ContentPack, memory: BotMemory, ctx: BotContext): Action;
  /** Optional: which classes this bot prefers when the runner is given `classId: 'auto'` (first one the pack has). */
  preferredClasses?: readonly string[];
  /**
   * U37 (PLAN §7.6 rule 1): the soft-lock stall window K for this bot — identical progress signatures for K accepted
   * steps is a soft-lock. Default `STALL_STEPS_POLICY` (60, DESIGN §19 #7); `random`, which legitimately dithers, uses 200.
   */
  readonly stallSteps?: number;
}

/** Builds a fresh bot (bots hold no state outside `BotMemory`, but a factory keeps the registry honest). */
export type BotFactory = () => Bot;
