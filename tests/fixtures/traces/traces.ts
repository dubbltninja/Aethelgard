// U79: committed determinism traces (PLAN §1.2 "Determinism", §7.4, §8.1; D-138). A trace is (where it starts, the
// action list, the final state hash): replaying the actions through `step` from the same start must land on the same
// `stateHash`, in bun (`tests/unit/sim/traces.test.ts`) and in the browser (`tests/e2e/replay.spec.ts`, real-pack traces).
//
// - `TRACE_SPECS` lists every committed trace; `bun tools/record-traces.ts` (re)records them into
//   `tests/fixtures/traces/<name>.json` with a bot and the runner, which is the only place bots matter: a replay plays
//   the stored actions, so a bot change never breaks a trace, only an engine or content change does.
// - Fixture-pack traces (the test packs in `tests/fixtures/`) change only when the engine or that pack does; real-pack
//   traces (`pack: 'real'`) also change with any content tuning. A trace that changes on purpose is re-recorded in the
//   same commit, with the reason in the commit message (the rule is spelled out in traces.test.ts).
import { buildContentPack } from '@content/index';
import { step, type Action, type ContentPack, type GameState, type Mode, type Profile } from '@engine/index';
import { stateHash } from '@engine/util/hash';
import { BOTS } from '@sim/bots/index';
import { runLoop, startRun, type StopReason } from '@sim/runner';
import { newProfile, type ScenarioId } from '@sim/scenarios';
import { beforePack } from '../beforeContent';
import { combatPack } from '../combatContent';
import { companionPack } from '../companionContent';
import { beforeEconomyPack, economyPack } from '../economyContent';
import { hordePack } from '../hordeContent';
import { fixturePack } from '../miniContent';
import { storyPack } from '../storyContent';
import { thresholdPack } from '../thresholdContent';

export const TRACE_FORMAT = 1;

/** The packs a trace can run on: the fixture packs, and the shipped content. */
export const TRACE_PACKS = {
  fixture: fixturePack,
  combat: () => combatPack(),
  companion: () => companionPack(),
  horde: hordePack,
  story: storyPack,
  threshold: thresholdPack,
  economy: economyPack,
  before: beforePack,
  before_economy: beforeEconomyPack,
  real: () => buildContentPack(),
} as const satisfies Record<string, () => ContentPack>;
export type TracePack = keyof typeof TRACE_PACKS;

/** How a trace is made: which pack, which bot, where it starts, how long it runs. */
export interface TraceSpec {
  name: string;
  pack: TracePack;
  bot: string;
  /** Loop 1's seed; for a title start also the fresh profile's id (so Loop 2+ seeds follow it, PLAN §4.11). */
  seed: string;
  classId: string;
  /** Start from `loadScenario(id)` (seeded with `seed`) instead of the title. */
  scenario?: ScenarioId;
  maxSteps: number;
  /** What the trace is there to cover, for a reader of the JSON. */
  covers: string;
}

/** A recorded trace, as committed. */
export interface TraceFile {
  format: typeof TRACE_FORMAT;
  name: string;
  pack: TracePack;
  bot: string;
  seed: string;
  classId: string;
  scenario: ScenarioId | null;
  covers: string;
  steps: number;
  stopReason: StopReason;
  /** Where the run stood at the end (for a reader; the hash is what is compared). */
  final: { loop: number; day: number; level: number; mode: Mode; locationId: string };
  finalStateHash: string;
  trace: Action[];
}

/**
 * Real-pack scenario traces use the seed `?scenario=<id>` boots from in the browser (`loadScenario(id, content, {})`
 * seeds itself `scenario:<id>` and picks the Ranger), so the e2e replay can start from the very same state.
 */
const scenarioSeed = (id: ScenarioId): string => `scenario:${id}`;

export const TRACE_SPECS: readonly TraceSpec[] = [
  // fixture packs: a few per pack
  { name: 'fixture-melee-ranger', pack: 'fixture', bot: 'melee', seed: 'u79:fixture:1', classId: 'ranger', maxSteps: 1500, covers: 'a full fixture Loop 1 by the melee bot' },
  { name: 'fixture-caster-wizard', pack: 'fixture', bot: 'caster', seed: 'u79:fixture:2', classId: 'wizard', maxSteps: 1500, covers: 'the caster bot as a Wizard' },
  { name: 'fixture-random', pack: 'fixture', bot: 'random', seed: 'u79:fixture:3', classId: 'auto', maxSteps: 800, covers: 'random legal actions, FALLEN reloads included' },
  { name: 'fixture-loop2', pack: 'fixture', bot: 'melee', seed: 'u79:fixture:4', classId: 'ranger', scenario: 'loop2_day1', maxSteps: 600, covers: 'Loop 2 from its first day' },
  { name: 'combat-melee', pack: 'combat', bot: 'melee', seed: 'u79:combat:1', classId: 'auto', maxSteps: 800, covers: 'the combat pack (affixes, bosses, interrupts)' },
  { name: 'combat-random', pack: 'combat', bot: 'random', seed: 'u79:combat:2', classId: 'auto', maxSteps: 600, covers: 'the combat pack, random actions' },
  { name: 'companion-melee', pack: 'companion', bot: 'melee', seed: 'u79:companion:1', classId: 'auto', maxSteps: 800, covers: 'companions recruited and fighting' },
  { name: 'companion-explorer', pack: 'companion', bot: 'explorer', seed: 'u79:companion:2', classId: 'auto', maxSteps: 800, covers: 'the explorer bot with companions' },
  { name: 'horde-melee', pack: 'horde', bot: 'melee', seed: 'u79:horde:1', classId: 'auto', maxSteps: 1500, covers: 'the Horde after the Tyrant' },
  { name: 'horde-speedrunner', pack: 'horde', bot: 'speedrunner', seed: 'u79:horde:2', classId: 'auto', maxSteps: 1500, covers: 'the speedrunner bot into the Horde' },
  { name: 'story-melee', pack: 'story', bot: 'melee', seed: 'u79:story:1', classId: 'ranger', maxSteps: 1500, covers: 'quests, dialogue and the Heartstone' },
  { name: 'story-pacifist', pack: 'story', bot: 'pacifist', seed: 'u79:story:2', classId: 'auto', maxSteps: 1000, covers: 'the pacifist bot through the story pack' },
  { name: 'threshold-loop2-end', pack: 'threshold', bot: 'melee', seed: 'u79:threshold:1', classId: 'auto', scenario: 'loop2_end', maxSteps: 400, covers: 'the Threshold: Resonance, Attunements, a new loop' },
  { name: 'threshold-melee', pack: 'threshold', bot: 'melee', seed: 'u79:threshold:2', classId: 'auto', maxSteps: 1500, covers: 'the threshold pack from the title' },
  { name: 'economy-melee', pack: 'economy', bot: 'melee', seed: 'u79:economy:1', classId: 'auto', maxSteps: 1200, covers: 'merchants, crafting and upgrades' },
  { name: 'economy-explorer', pack: 'economy', bot: 'explorer', seed: 'u79:economy:2', classId: 'auto', maxSteps: 1000, covers: 'the explorer bot through the economy' },
  { name: 'before-melee', pack: 'before', bot: 'melee', seed: 'u79:before:1', classId: 'auto', maxSteps: 1500, covers: 'Silverwood Before' },
  { name: 'before-economy-melee', pack: 'before_economy', bot: 'melee', seed: 'u79:before-economy:1', classId: 'auto', maxSteps: 1500, covers: 'Silverwood Before with the economy' },
  // the real pack: a short Loop 1 per class, and one Loop 2
  { name: 'real-ranger', pack: 'real', bot: 'melee', seed: 'u79:real:ranger', classId: 'ranger', maxSteps: 400, covers: 'a short Loop 1 as the Ranger' },
  { name: 'real-wizard', pack: 'real', bot: 'caster', seed: 'u79:real:wizard', classId: 'wizard', maxSteps: 400, covers: 'a short Loop 1 as the Wizard' },
  { name: 'real-elf', pack: 'real', bot: 'melee', seed: 'u79:real:elf', classId: 'elf', maxSteps: 400, covers: 'a short Loop 1 as the Elf' },
  { name: 'real-warden', pack: 'real', bot: 'melee', seed: 'u79:real:warden', classId: 'ironclad_warden', maxSteps: 400, covers: 'a short Loop 1 as the Ironclad Warden' },
  { name: 'real-weaver', pack: 'real', bot: 'caster', seed: 'u79:real:weaver', classId: 'shadow_weaver', maxSteps: 400, covers: 'a short Loop 1 as the Shadow Weaver' },
  { name: 'real-loop2', pack: 'real', bot: 'melee', seed: scenarioSeed('loop2_day1'), classId: 'ranger', scenario: 'loop2_day1', maxSteps: 400, covers: 'Loop 2 from its waking (the loop2_day1 scenario)' },
];

/** The state and profile a trace starts from (the runner's own start, so recording and replaying agree). */
export function traceStart(t: Pick<TraceFile, 'seed' | 'classId' | 'scenario'>, content: ContentPack): { state: GameState; profile: Profile } {
  return startRun({ seed: t.seed, profile: newProfile(t.seed), ...(t.scenario === null ? {} : { scenario: t.scenario }) }, t.classId, content);
}

export interface Replayed {
  state: GameState;
  profile: Profile;
  hash: string;
  /** Actions the engine refused on the way (a recorded run's shell steps can be refused; the count must match too). */
  rejected: number;
}

/** Plays the stored actions through `step` from the trace's start. */
export function replayTrace(t: TraceFile, content: ContentPack): Replayed {
  let { state, profile } = traceStart(t, content);
  let rejected = 0;
  for (const action of t.trace) {
    const out = step(state, action, content, profile);
    if (out.events.some((e) => e.t === 'actionRejected')) rejected += 1;
    state = out.state;
    profile = out.profile;
  }
  return { state, profile, hash: stateHash(state), rejected };
}

/** Records a spec with its bot through the runner. Throws if the run met an engine error (never commit those). */
export function recordTrace(spec: TraceSpec, content: ContentPack): TraceFile {
  const factory = BOTS[spec.bot];
  if (factory === undefined) throw new Error(`trace ${spec.name}: no bot '${spec.bot}'`);
  const result = runLoop(
    {
      seed: spec.seed,
      classId: spec.classId,
      bot: factory(),
      stopAt: 'max_steps',
      maxSteps: spec.maxSteps,
      record: true,
      ...(spec.scenario === undefined ? { profile: newProfile(spec.seed) } : { scenario: spec.scenario }),
    },
    content,
  );
  if (result.errors.length > 0) throw new Error(`trace ${spec.name}: the run had engine errors: ${result.errors.map((e) => e.message).join('; ')}`);
  if (result.trace === undefined) throw new Error(`trace ${spec.name}: no trace recorded`);
  return {
    format: TRACE_FORMAT,
    name: spec.name,
    pack: spec.pack,
    bot: spec.bot,
    seed: spec.seed,
    classId: result.classId,
    scenario: spec.scenario ?? null,
    covers: spec.covers,
    steps: result.steps,
    stopReason: result.stopReason,
    final: result.final,
    finalStateHash: result.finalStateHash,
    trace: result.trace,
  };
}

/** The committed text: the header pretty-printed, one action per line (readable diffs, lint-clean whitespace). */
export function traceText(t: TraceFile): string {
  const { trace, ...head } = t;
  const header = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  const actions = trace.map((a) => `    ${JSON.stringify(a)}`).join(',\n');
  return `${header},\n  "trace": [\n${actions}\n  ]\n}\n`;
}

export const TRACE_DIR = 'tests/fixtures/traces';
export const tracePath = (name: string): string => `${TRACE_DIR}/${name}.json`;
