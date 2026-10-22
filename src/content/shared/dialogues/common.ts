// What every dialogue file shares (U52; the conventions are in ./index.ts's header): the priority bands `talk` picks scenes
// by, the Horde gate every NPC scene carries, the Echo-locked choice, and DESIGN §12.5's loyalty for a choice that touches
// a companion's values. Content only: nothing here reads the engine.
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { Effect } from '@schema/effect';

/** A scene's node and a node's choice, as authored (`z.input`). */
export type NodeInput = DialogueSceneInput['nodes'][number];
export type ChoiceInput = NonNullable<NodeInput['choices']>[number];

/**
 * `talk` opens the highest-priority scene of the NPC whose `when` holds (reducers/dialogue.ts). One scene per purpose, each in
 * its band, lets later units add scenes for the same NPC without editing these: a decision outranks a payoff, a payoff a
 * report, a report an offer, an offer a reminder, a reminder a line once all is done.
 */
export const SCENE_PRIORITY = {
  /** Reserved: the Horde's lines and the portal (U62). */
  urgent: 90,
  /** A choice that decides a quest's outcome (`scene_echo_crystal`, the shards in Nyx's hand). */
  decision: 60,
  /** A one-time consequence spoken on the next talk (verse I after the Crystal; the dawn count after a Destroy). */
  payoff: 55,
  /** Reporting a finished objective; the giver pays (no choice). */
  report: 50,
  /** The giver offers a quest (the legacy yes/no prompt). */
  offer: 40,
  /**
   * A once-a-loop line that waits for every offer and report but comes before reminders: the Loop 2+ déjà vu (STORY §5.2,
   * §6.4; the companion units, U54). Above `offer` it would stand between a proof's `talk` and the pick it expects.
   */
  dejaVu: 30,
  /** A reminder while the quest runs. */
  waiting: 20,
  /** What the giver says once the quest is done. */
  after: 10,
  /** Greetings and déjà vu with nothing else to say (the companion units). */
  idle: 0,
} as const;

/** Legacy rule (`talk_to_npc`): while the Horde runs, every NPC says only "Go, Wayfinder! The horde approaches!" (U62's scenes). */
export const NOT_IN_HORDE: Condition = { not: { flag: 'flag_horde_active' } };

/** Loop 1 is the legacy game (D-067.17): loop knowledge is offered from Loop 2. */
export const FROM_LOOP_2: Condition = { loop: { min: 2 } };

/**
 * An Echo-locked line (DESIGN §13.2): offered from Loop 2, greyed "(You do not yet know this)" until `echo` is held, marked
 * with the Echo sigil. A `when` the choice already has still applies.
 */
export function echoLocked(echo: `echo_${string}`, choice: ChoiceInput): ChoiceInput {
  return {
    ...choice,
    when: choice.when === undefined ? FROM_LOOP_2 : { all: [FROM_LOOP_2, choice.when] },
    disabledWhen: { not: { echo } },
    echoHint: echo,
    tags: ['echo', ...(choice.tags ?? []).filter((t) => t !== 'echo')],
  };
}

/** DESIGN §12.5 "choice aligned with their value" / "against their value". */
export const LOYALTY_ALIGNED = 3;
export const LOYALTY_AGAINST = -10;

type CompanionId = 'ilyra' | 'brak' | 'nyx' | 'dask' | 'mireya' | 'caelum';

/**
 * DESIGN §12.5 for one choice: +3 to each companion whose value it is, −10 to each whose value is another option of the same
 * choice. A `loyalty` effect changes a recruited companion only (effects.ts), so these are silent until one has joined.
 */
export function loyaltyFor(aligned: readonly CompanionId[], against: readonly CompanionId[] = []): Effect[] {
  return [
    ...aligned.map((companion): Effect => ({ loyalty: { companion, delta: LOYALTY_ALIGNED } })),
    ...against.map((companion): Effect => ({ loyalty: { companion, delta: LOYALTY_AGAINST } })),
  ];
}
