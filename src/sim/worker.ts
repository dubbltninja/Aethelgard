// One batch job and the worker thread that runs jobs (PLAN §7.4). `runJob` is the unit both the worker and the single-worker
// (in-thread) path execute, so `--workers 1` and `--workers N` play exactly the same runs. A worker builds each pack once and
// keeps it (`PackCache`); the main thread sends it one job at a time and gets back an outcome without the action trace —
// traces are kept only for failures (a blocker's run is replayed with `record: true`, which is deterministic by construction).
//
// Determinism check (PLAN §7.4, §1.2): a job with `verify` is run a second time with `record: true`, and the recorded actions
// are then replayed from the start through `step` alone; the final state hashes of the three must agree.
import { parentPort } from 'node:worker_threads';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { step, type Action, type ContentPack, type GameState, type Profile } from '@engine/index';
import { stateHash } from '@engine/util/hash';
import { BOTS } from './bots/index';
import { loadPack, UsageError } from './cli';
import type { BatchRun, Suite } from './metrics';
import { resolveClass, runLoop, startRun, type RunConfig, type RunResult, type StopAt } from './runner';
import { ScenarioDefeat, ScenarioUnavailable, type ScenarioId } from './scenarios';
import { runEndingScript } from './scripts/run';
import type { EndingScript } from './scripts/types';

export interface ScriptRef {
  /** A module path, relative to the working directory or absolute. */
  module: string;
  /** The module's export (an `EndingScript[]`). */
  export: string;
  index: number;
}

export interface Job {
  id: number;
  /** The pack spec (`cli.ts` `loadPack`). */
  pack: string;
  suite: Suite;
  seed: string;
  classId: string;
  bot: string;
  stopAt: StopAt;
  maxSteps: number;
  maxLoops: number;
  modifiers: string[];
  scenario?: ScenarioId;
  companionId?: string;
  script?: ScriptRef;
  /** Re-run with recording and replay through `step`; compare the final state hashes (PLAN §7.4). */
  verify: boolean;
}

export type JobOutcome =
  | {
      id: number;
      kind: 'run';
      result: RunResult;
      /** Script jobs: the script's label, whether its ending was reached, and the one-line reason. */
      proof?: { label: string; reached: boolean; detail: string };
      /** `verify` jobs: the final hashes of the recorded re-run and of its replay through `step`. */
      check?: { rerun: string; replay: string };
    }
  | { id: number; kind: 'skipped'; reason: string }
  | { id: number; kind: 'failed'; message: string };

/** Packs a worker has built, by spec (each is built once). */
export class PackCache {
  private readonly packs = new Map<string, Promise<ContentPack>>();
  get(spec: string): Promise<ContentPack> {
    let pack = this.packs.get(spec);
    if (pack === undefined) {
      pack = loadPack(spec);
      this.packs.set(spec, pack);
    }
    return pack;
  }
}

/** The ending scripts of `<module>#<export>` (a path relative to the working directory, or absolute). */
export async function loadEndingScripts(module: string, exportName: string): Promise<readonly EndingScript[]> {
  const mod = (await import(pathToFileURL(path.resolve(module)).href)) as Record<string, unknown>;
  const scripts = mod[exportName];
  if (!Array.isArray(scripts)) throw new UsageError(`scripts ${module}#${exportName}: not an EndingScript[]`);
  return scripts as EndingScript[];
}

/** A run's `RunConfig` from its job (the bot is fresh: bots hold their memory in `BotMemory`, but a factory keeps that honest). */
function configOf(job: Job, record: boolean): RunConfig {
  const factory = BOTS[job.bot];
  if (factory === undefined) throw new UsageError(`unknown bot '${job.bot}'`);
  return {
    seed: job.seed,
    classId: job.classId,
    bot: factory(),
    stopAt: job.stopAt,
    maxSteps: job.maxSteps,
    maxLoops: job.maxLoops,
    ...(job.modifiers.length === 0 ? {} : { modifiers: job.modifiers }),
    ...(job.scenario === undefined ? {} : { scenario: job.scenario }),
    ...(job.companionId === undefined ? {} : { companionId: job.companionId }),
    ...(record ? { record: true } : {}),
  };
}

/**
 * Replays a recorded action list from the run's start through `step` alone (no bot, no runner shell) and returns the final
 * state hash — the replay half of PLAN §1.2's determinism gate. An action that throws ends the replay: the hash is then
 * `threw:<message>`, which never equals a real hash (the run it replays recorded that same exception).
 */
export function replayTrace(trace: readonly Action[], cfg: RunConfig, content: ContentPack): string {
  const classId = resolveClass(cfg.classId, cfg.bot, content);
  const start = startRun(cfg, classId, content);
  let state: GameState = start.state;
  let profile: Profile = start.profile;
  for (const action of trace) {
    try {
      const out = step(state, action, content, profile);
      // the runner keeps the previous state across a refused action (its events still count, its state does not)
      if (!out.events.some((e) => e.t === 'actionRejected')) {
        state = out.state;
        profile = out.profile;
      }
    } catch (e) {
      return `threw:${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return stateHash(state);
}

const isBlocker = (r: RunResult): boolean => r.errors.length > 0 || r.softLock.detected;

/**
 * Runs one job. Throws nothing. A scenario the pack cannot express (`ScenarioUnavailable`) or that this class cannot get through
 * on this seed (`ScenarioDefeat`: the builder's own played fight was lost on every retry) is `skipped` and named in the report;
 * any other failure is `failed` (a blocker).
 */
export async function runJob(job: Job, cache: PackCache): Promise<JobOutcome> {
  try {
    const content = await cache.get(job.pack);
    if (job.script !== undefined) {
      const script = (await loadEndingScripts(job.script.module, job.script.export))[job.script.index];
      if (script === undefined) return { id: job.id, kind: 'failed', message: `no script #${job.script.index} in ${job.script.module}#${job.script.export}` };
      const proof = runEndingScript(script, content, { maxSteps: job.maxSteps });
      const label = `${script.endingId}${script.name === undefined ? '' : `:${script.name}`}#${job.script.index}`;
      return { id: job.id, kind: 'run', result: proof.result, proof: { label, reached: proof.reached, detail: proof.detail } };
    }
    const result = runLoop(configOf(job, false), content);
    if (!job.verify && !isBlocker(result)) return { id: job.id, kind: 'run', result };
    // a failure keeps its trace (replaying it is deterministic by construction); a sampled run is replayed to prove that
    const cfg = configOf(job, true);
    const again = runLoop(cfg, content);
    const trace = again.trace ?? [];
    const check = { rerun: again.finalStateHash, replay: replayTrace(trace, cfg, content) };
    if (isBlocker(result)) result.trace = trace;
    return { id: job.id, kind: 'run', result, check };
  } catch (e) {
    if (e instanceof ScenarioUnavailable || e instanceof ScenarioDefeat) return { id: job.id, kind: 'skipped', reason: e.message };
    return { id: job.id, kind: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
}

/** The repro command of a job (`npm run sim:replay -- …`; companion scenarios and scripts have no CLI form, so they say so). */
export function reproOf(job: Job): string {
  if (job.script !== undefined) return `runEndingScript(${job.script.module}#${job.script.export}[${job.script.index}]) on --pack ${job.pack}`;
  const parts = ['npm run sim:replay --', `--pack ${job.pack}`, `--bot ${job.bot}`, `--class ${job.classId}`, `--seed ${job.seed}`, `--stop-at ${job.stopAt}`, `--max-steps ${job.maxSteps}`, `--max-loops ${job.maxLoops}`];
  if (job.scenario !== undefined) parts.push(`--scenario ${job.scenario}`);
  return job.companionId === undefined ? parts.join(' ') : `${parts.join(' ')} (with companion ${job.companionId}: no CLI flag; use runLoop({ companionId }))`;
}

/** The `BatchRun` a finished job becomes. */
export function batchRunOf(job: Job, outcome: Extract<JobOutcome, { kind: 'run' }>): BatchRun {
  return {
    pack: job.pack,
    suite: job.suite,
    ...(job.scenario === undefined ? {} : { scenario: job.scenario }),
    ...(job.companionId === undefined ? {} : { companionId: job.companionId }),
    ...(outcome.proof === undefined ? {} : { script: outcome.proof.label, proof: { reached: outcome.proof.reached, detail: outcome.proof.detail } }),
    repro: reproOf(job),
    result: outcome.result,
  };
}

// ---- the worker thread --------------------------------------------------------------------------------------------------------

/** A worker's answer to one job message: the outcome, posted back to the main thread (`runJob` never throws). */
export async function handleMessage(job: Job, cache: PackCache, post: (outcome: JobOutcome) => void): Promise<void> {
  post(await runJob(job, cache));
}

if (parentPort !== null) {
  const port = parentPort;
  const cache = new PackCache();
  port.on('message', (job: Job) => void handleMessage(job, cache, (outcome) => port.postMessage(outcome)));
}
