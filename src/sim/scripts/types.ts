// Scripted-bot types (PLAN §7.8; U38). A `ScriptStep[]` is what `pathBot` plays; an `EndingScript` is a proof that an
// ending (or a loop closer) can be reached: one script per loop, flattened by `runEndingScript` (run.ts).
//
// PLAN §7.8's declarations, with three additive optional fields (the C1 freeze, D-073, is about engine/content contracts;
// these are sim-layer types):
//   · `maxSteps` on `goto` and `loopEnd` (PLAN gives it to `until` only; the brief has `goto` honour it too), default 400
//   · `EndingScript.scenario`: start from `loadScenario(id)` (PLAN §7.8: "long prefixes start from loadScenario")
//   · `EndingScript.name`: a label when one ending has several scripts (closer_fall by expiry, by death, by *Let go*)
//   · `until.do` also names the other policy bots (`caster`, `speedrunner`, `pacifist`), not only `explorer` and `melee`
//   · `EndingScript.profile` (U58): a constructed Loop 2+ profile to start from, as the quest proofs' (scripts/quests.ts) — an
//     ending that needs a companion's bond or a region's Echoes from an earlier loop is proved from the loop that has them
import type { Action } from '@engine/index';
import type { Condition } from '@schema/condition';
import type { Bot } from '../bots/types';
import type { ScenarioId } from '../scenarios';

/** The policy bots a script can hand a stretch of play to (and the ones a `fight` step plays encounters with). */
export type DelegateName = 'melee' | 'explorer' | 'caster' | 'speedrunner' | 'pacifist';

/** How `pathBot` plays an encounter: `melee`'s or `caster`'s combat rows, or `flee` where it can be fled (else `melee`). */
export type FightPolicy = 'melee' | 'caster' | 'flee';

/** How `loopEnd` drives a loop to its end (see pathBot.ts for each route). */
export type LoopEndRoute = 'portal' | 'clock' | 'death';

export type ScriptStep =
  /** An exact action: it must be among the legal ones when its turn comes, else the run ends with `script_assert`. */
  | Action
  /** BFS travel to a location (fights on the way are played with the `fight` policy, `melee` until a `fight` step says otherwise). */
  | { goto: string; maxSteps?: number }
  /** Sets the policy for encounters from here on, and plays the fight on screen (if any) with it until combat ends. */
  | { fight: FightPolicy }
  /** Talk to an NPC and take these choice ids in order (*Continue* otherwise); the dialogue must end with every pick used. */
  | { talk: string; pick: string[] }
  /** Hand the play to a bot until the condition holds (checked before every choice, so an already-true one is a no-op). */
  | { until: Condition; do: Bot | DelegateName; maxSteps?: number }
  /** A proof checkpoint: the run ends with `script_assert` and this message when the condition does not hold. */
  | { assert: Condition; message: string }
  /** Rest N times (a full rest where one is listed, else a short one). */
  | { rest: number }
  /** Drive the loop to its end by that route, and acknowledge the closer's slides. */
  | { loopEnd: LoopEndRoute; maxSteps?: number };

/** One proof: the ending (or closer) it reaches, who plays, from which seed and (optionally) which named scenario. */
export interface EndingScript {
  /** An ending id (`ending_unbound` …) or a closer (`closer_escape`, `closer_fall`). */
  endingId: string;
  classId: string;
  /** One script per loop; `runEndingScript` plays them back to back. */
  loops: ScriptStep[][];
  seed: string;
  /** Start from this scenario instead of the title screen. */
  scenario?: ScenarioId;
  /** A label when one ending has several scripts. */
  name?: string;
  /** U58: a constructed profile to start from (the loop counter, the Echoes earlier loops earned, the class's best level). */
  profile?: { loop: number; echoes?: readonly `echo_${string}`[]; bestLevel?: number };
}

/** Default step budget of `goto`, `until` and `loopEnd` (PLAN §7.8). */
export const DEFAULT_SCRIPT_STEPS = 400;
