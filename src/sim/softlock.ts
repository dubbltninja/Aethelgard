// Soft-lock detector (PLAN §7.6; DESIGN §19 #7; D-037): "no state-changing legal action for K steps, or a day stuck with
// no progress". Fed by the runner after every accepted step (`observe`) and with every legal list (`checkLegal`).
//
// Rules:
//   1. stall        the progress signature unchanged for K consecutive accepted steps (K = 60 for policy bots, 200 for
//                   `random`; the bot's `stallSteps`).
//   2. hard_lock    `legalActions` empty outside the ending screens, or only `returnToTitle`/`save` in explore → at once.
//   3. day_stuck    the day unchanged for 400 counted steps with no quest stage change (catches "can travel but nothing
//                   ever changes" at zero-watch exits). Not counted: fights, dialogue, the Threshold, ending screens, the
//                   title, Silverwood Before (frozen clock) — the menus and places where time rightly stands still.
//   4. combat_stall a fight past round 60 (an immortal enemy, a zero-damage loop).
//   5. rejected storm  > 30 `actionRejected` in a window of 50 steps: a bot/legal mismatch, reported by the runner as an
//                   error, not a soft-lock (`observeRejection`).
// The signature (PLAN §7.6's fields, plus what tells menus apart so paging through them is not a stall): mode, location,
// clock ticks, Before day, quest stages and objectives, the inventory's item multiset, equipment, hp, level, gold, the
// number of flags, fight round, dialogue scene/node, ending slide, Threshold area and spend, Echoes this loop, loop.
import { dayOf, type Action, type GameState } from '@engine/index';
import { hashString } from '@engine/util/hash';

export const STALL_STEPS_POLICY = 60;
export const DAY_STUCK_STEPS = 400;
export const COMBAT_ROUND_LIMIT = 60;
export const REJECT_WINDOW = 50;
export const REJECT_MAX = 30;

export interface SoftLockOptions {
  /** Rule 1's K. */
  stallSteps: number;
  /** Rule 3's step count. */
  dayStuckSteps: number;
  /** Rule 4: a fight past this round. */
  combatRounds: number;
  /** Rule 5's window and threshold. */
  rejectWindow: number;
  rejectMax: number;
}

export const DEFAULT_SOFTLOCK: SoftLockOptions = {
  stallSteps: STALL_STEPS_POLICY,
  dayStuckSteps: DAY_STUCK_STEPS,
  combatRounds: COMBAT_ROUND_LIMIT,
  rejectWindow: REJECT_WINDOW,
  rejectMax: REJECT_MAX,
};

export type SoftLockRule = 'stall' | 'hard_lock' | 'day_stuck' | 'combat_stall';

export interface SoftLockDetection {
  rule: SoftLockRule;
  /** The run step at which it was detected. */
  step: number;
  signature: string;
  detail: string;
}

/** The progress signature of a state (see the header): equal signatures mean nothing a player would call progress changed. */
export function progressSignature(s: GameState): string {
  const multiset = (ids: readonly string[]): string => [...ids].sort().join(',');
  const inventory = s.player.inventory.map((i) => `${i.itemId}x${i.qty}`);
  const equipment = Object.values(s.player.equipment).map((i) => i?.itemId ?? '-');
  const quests = Object.keys(s.quests)
    .sort()
    .map((id) => {
      const q = s.quests[id];
      return q === undefined ? id : `${id}:${q.status}:${q.stage}:${q.objectivesDone.length}`;
    });
  const parts: unknown[] = [
    s.mode,
    s.meta.loop,
    s.world.currentLocationId,
    s.clock.ticks,
    s.before?.day ?? 0,
    quests.join('|'),
    multiset(inventory),
    equipment.join(','),
    s.player.hp,
    s.player.level,
    s.player.gold,
    Object.keys(s.flags).length,
    s.combat === null ? '-' : `${s.combat.round}:${s.combat.phase}:${s.combat.enemies.map((e) => e.hp).join('/')}`,
    s.dialogue === null ? '-' : `${s.dialogue.sceneId}:${s.dialogue.nodeId}`,
    s.pendingEnding === null ? '-' : `${s.pendingEnding.outcome}:${s.pendingEnding.slideIndex}`,
    s.threshold === null ? '-' : `${s.threshold.visited.join('>')}:${s.threshold.spentThisVisit}:${s.threshold.pendingClassId ?? ''}`,
    s.echoesThisLoop.length,
  ];
  return hashString(JSON.stringify(parts));
}

/** Quest stages only (rule 3's "no quest stage change"). */
const stagesOf = (s: GameState): string =>
  Object.keys(s.quests)
    .sort()
    .map((id) => `${id}:${s.quests[id]?.stage ?? ''}:${s.quests[id]?.status ?? ''}`)
    .join('|');

/** Rule 3 counts only steps taken in the world with the clock running. */
const countsForDay = (s: GameState): boolean => s.mode === 'explore' && !s.clock.frozen && s.before === null;

/** Rule 2 on its own (also used by the runner before it asks the bot). */
export function hardLock(s: GameState, legal: readonly Action[]): string | null {
  if (legal.length === 0) return s.mode === 'ending' ? null : `no legal action in ${s.mode} mode`;
  if (s.mode === 'explore' && legal.every((a) => a.type === 'returnToTitle' || a.type === 'save')) {
    return 'only returnToTitle/save are legal in explore mode';
  }
  return null;
}

export class SoftLockDetector {
  readonly opts: SoftLockOptions;
  private lastSignature: string | null = null;
  private same = 0;
  private day: number | null = null;
  private dayRun = '';
  private stages = '';
  private dayCount = 0;
  private readonly rejects: boolean[] = [];

  constructor(opts: Partial<SoftLockOptions> = {}) {
    this.opts = { ...DEFAULT_SOFTLOCK, ...opts };
  }

  /** Rule 2 for the legal list of the state about to be played. */
  checkLegal(s: GameState, legal: readonly Action[], step: number): SoftLockDetection | null {
    const why = hardLock(s, legal);
    return why === null ? null : { rule: 'hard_lock', step, signature: progressSignature(s), detail: why };
  }

  /** Rules 1, 3, 4 after an accepted step; the first that fires is returned (the run stops there). */
  observe(s: GameState, step: number): SoftLockDetection | null {
    const signature = progressSignature(s);
    // rule 4
    if (s.combat !== null && s.combat.round > this.opts.combatRounds) {
      return { rule: 'combat_stall', step, signature, detail: `fight ${s.combat.encounterId} at round ${s.combat.round} (> ${this.opts.combatRounds})` };
    }
    // rule 1
    this.same = signature === this.lastSignature ? this.same + 1 : 1;
    this.lastSignature = signature;
    if (this.same >= this.opts.stallSteps) {
      return { rule: 'stall', step, signature, detail: `the progress signature has not changed for ${this.same} steps (${s.mode} at ${s.world.currentLocationId})` };
    }
    // rule 3
    const day = dayOf(s.clock.ticks);
    const stages = stagesOf(s);
    if (day !== this.day || s.meta.runId !== this.dayRun || stages !== this.stages) {
      this.day = day;
      this.dayRun = s.meta.runId;
      this.stages = stages;
      this.dayCount = 0;
    } else if (countsForDay(s)) {
      this.dayCount += 1;
      if (this.dayCount >= this.opts.dayStuckSteps) {
        return { rule: 'day_stuck', step, signature, detail: `Day ${day} for ${this.dayCount} steps in the world with no quest stage change` };
      }
    }
    return null;
  }

  /** Rule 5: feed whether this step's action was rejected; true once the window holds more than `rejectMax` rejections. */
  observeRejection(rejected: boolean): boolean {
    this.rejects.push(rejected);
    if (this.rejects.length > this.opts.rejectWindow) this.rejects.shift();
    return this.rejects.filter(Boolean).length > this.opts.rejectMax;
  }
}
