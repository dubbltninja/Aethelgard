// The batch runner (PLAN §7.4; U39): plays every (pack, bot, class, seed) of a configuration, the pre-Tyrant and communion
// scenario sims of DESIGN §19 #19/#20 and the ending scripts of PLAN §7.8, on a pool of `node:worker_threads` workers, then
// re-runs a sample of the runs to check determinism. `--workers 1` plays in this thread; any other count gives the byte-identical
// result (every job has an index, results are stored by it, and a run's `durationMs` is its only wall-clock field).
//
// Speed (D-086): under `__DEV__` a step deep-freezes its result (0.65–0.9 ms); the batch is meant to run with `__DEV__` off —
// `bun --define __DEV__=false --define __E2E__=true …` (the `sim:balance` and `sim:batch` scripts). `__E2E__` stays on because
// `loadScenario` is a dev/e2e facility (PLAN §4.13) and the scenario sims need it. Workers inherit the defines.
//
//   npm run sim:balance -- --pack fixtures --seeds 20 --out /tmp/BALANCE.md
//   bun --define __DEV__=false --define __E2E__=true src/sim/cli.ts batch --pack fixture:story --bots melee,caster --seeds 5 --json /tmp/b.json
//
// Options (comma lists everywhere a list is taken):
//   --pack/--packs <spec,…>     as `npm run sim` (fixture, fixture:<name>, fixtures, real, <module>#<export>); default real
//   --seeds <n>                 seeds per (bot, class), default 30        --seed-prefix <p>   default "bal"
//   --bots <names|all>          default all                               --classes <ids|all> default all
//   --workers <n>               default availableParallelism() - 1, at least 1
//   --max-steps <n>             default 6000                              --max-loops <n>     default 3
//   --modifiers <ids>           challenge modifiers toggled on in every run's profile
//   --scripts <module#export,…> EndingScript[] exports to run on every pack (default: tests/fixtures/scripts for fixture packs,
//                               src/sim/scripts/endings for `real` once it exists)
//   --scenario-seeds <n>        seeds per scenario cell (default min(seeds, 10); 0 = no scenario sims)
//   --determinism <n>           runs re-run and replayed (default 200; 0 = off)
//   --quest-proofs on|off       U82: also play every quest proof of scripts/quests.ts (PLAN §7.8) as a script job, so the
//                               coverage is the union of the runs and the proofs (default on for `real`, never on a fixture)
//   --out <file>                the BALANCE.md to write (default docs/BALANCE.md)      --json <file>   the raw batch (no traces)
//   --merge <json,json,…>       no play: combine `--json` batches (same pack and content) into one report, for a release batch
//                               too long for one shell timeout; seeds, runs, determinism samples and durations are summed
//   --quiet                     no progress lines
// Exit 0 = report written, no blocker; 1 = a blocker (engine error, soft-lock, failed ending proof, determinism mismatch,
// a job that crashed); 2 = a usage or configuration error. Failing balance targets are not blockers: they are the report.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { step, type ContentPack } from '@engine/index';
import { BOTS } from './bots/index';
import { UsageError, classesFor, expandPacks, loadPack } from './cli';
import { computeMetrics, isBlockerRun, SCENARIO_COMMUNION, SCENARIO_PRE_TYRANT, type BatchRun, type DeterminismSummary, type Metrics, type Suite } from './metrics';
import { renderBalance } from './report';
import { resolveClass, runLoop, startRun } from './runner';
import { QUEST_SCRIPTS } from './scripts/quests';
import { batchRunOf, loadEndingScripts, PackCache, reproOf, runJob, type Job, type JobOutcome } from './worker';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

// ---- configuration -------------------------------------------------------------------------------------------------------------

export interface BatchConfig {
  /** Pack specs (default `['real']` for the CLI, `['fixture']` here). */
  packs?: string[];
  seeds: number | string[];
  seedPrefix?: string;
  classes: string[] | 'all';
  bots: string[] | 'all';
  workers?: number;
  maxSteps?: number;
  maxLoops?: number;
  modifiers?: string[];
  out?: string;
  /** `<module>#<export>` of `EndingScript[]`s; default per pack (see the header). */
  scripts?: string[];
  scenarioSeeds?: number;
  determinism?: number;
  /** U82: play the quest proofs of scripts/quests.ts on the `real` pack (default true). */
  questProofs?: boolean;
  json?: string;
  /** `--json` files to combine instead of playing. */
  merge?: string[];
}

export const DEFAULT_SEEDS = 30;
export const DEFAULT_SEED_PREFIX = 'bal';
export const DEFAULT_DETERMINISM = 200;
export const DEFAULT_SCENARIO_SEEDS = 10;
/** Step caps of the scenario sims (a Tyrant fight plus the walk to the portal; the communion to its ending). */
export const SCENARIO_MAX_STEPS = 2500;
export const DEFAULT_OUT = 'docs/BALANCE.md';
/** U82: a quest proof's step cap when its script names none (scripts/quests.ts `runQuestScript`). */
export const DEFAULT_QUEST_PROOF_STEPS = 6000;

/** A configuration with every default filled in. */
export interface ResolvedConfig {
  packs: string[];
  seeds: string[];
  classes: string[] | 'all';
  bots: string[];
  workers: number;
  maxSteps: number;
  maxLoops: number;
  modifiers: string[];
  scripts: string[] | null;
  scenarioSeeds: number;
  determinism: number;
  /** U82: the quest proofs run on the `real` pack. */
  questProofs: boolean;
  out: string;
  json: string | undefined;
}

export interface Skipped {
  pack: string;
  suite: Suite;
  what: string;
  reason: string;
}

export interface Failure {
  pack: string;
  suite: Suite;
  what: string;
  message: string;
}

export interface PackSummary {
  spec: string;
  contentVersion: string;
  classes: string[];
  jobs: number;
}

export interface BatchResult {
  config: ResolvedConfig;
  packs: PackSummary[];
  /** Every run, in job order (pack, suite, bot, class, seed). */
  runs: BatchRun[];
  /** Scenario sims the pack cannot express (not an error). */
  skipped: Skipped[];
  /** Jobs that crashed outright (a blocker). */
  failures: Failure[];
  /** Per pack spec. */
  determinism: Record<string, DeterminismSummary>;
  startedAt: string;
  durationMs: number;
  contentVersion: string;
  gitSha: string;
  /** Threads that played the batch (1 = this thread). */
  workers: number;
  /** Was `__DEV__` on (deep-frozen steps)? A batch for the report should run with it off. */
  dev: boolean;
  /** Mean µs per accepted step over the main suite's runs (bot, legalActions and step together). */
  runMicrosPerStep: number;
}

const workerCount = (n: number | undefined): number => Math.max(1, n ?? os.availableParallelism() - 1);

export function resolveConfig(cfg: BatchConfig): ResolvedConfig {
  const prefix = cfg.seedPrefix ?? DEFAULT_SEED_PREFIX;
  const seeds = typeof cfg.seeds === 'number' ? Array.from({ length: cfg.seeds }, (_, i) => `${prefix}:${i}`) : [...cfg.seeds];
  const bots = cfg.bots === 'all' ? Object.keys(BOTS).sort() : [...cfg.bots];
  for (const b of bots) if (BOTS[b] === undefined) throw new UsageError(`unknown bot '${b}' (available: ${Object.keys(BOTS).join(', ')})`);
  if (seeds.length === 0) throw new UsageError('a batch needs at least one seed');
  return {
    packs: expandPacks(cfg.packs ?? ['fixture']),
    seeds,
    classes: cfg.classes,
    bots,
    workers: workerCount(cfg.workers),
    maxSteps: cfg.maxSteps ?? 6000,
    maxLoops: cfg.maxLoops ?? 3,
    modifiers: cfg.modifiers ?? [],
    scripts: cfg.scripts ?? null,
    scenarioSeeds: Math.min(seeds.length, cfg.scenarioSeeds ?? DEFAULT_SCENARIO_SEEDS),
    determinism: cfg.determinism ?? DEFAULT_DETERMINISM,
    questProofs: cfg.questProofs ?? true,
    out: cfg.out ?? DEFAULT_OUT,
    json: cfg.json,
  };
}

// ---- jobs ---------------------------------------------------------------------------------------------------------------------------

interface ScriptSpec {
  module: string;
  export: string;
}

/** `path#export` → a script source (relative paths are the working directory's). */
function parseScriptSpec(spec: string): ScriptSpec {
  const [module = '', exportName = 'default'] = spec.split('#');
  return { module: path.resolve(module), export: exportName };
}

/** The ending scripts a pack gets when `--scripts` is not given. */
export function defaultScripts(pack: string): ScriptSpec[] {
  if (pack === 'fixture' || pack.startsWith('fixture:')) return [{ module: path.join(ROOT, 'tests/fixtures/scripts/endings.ts'), export: 'FIXTURE_ENDING_SCRIPTS' }];
  const real = path.join(ROOT, 'src/sim/scripts/endings/index.ts');
  return pack === 'real' && fs.existsSync(real) ? [{ module: real, export: 'ENDING_SCRIPTS' }] : [];
}

/** `k` indices spread evenly over `0 … n-1` (all of them when `k ≥ n`). */
export function sampleEvenly(n: number, k: number): number[] {
  if (k >= n) return Array.from({ length: n }, (_, i) => i);
  return Array.from({ length: Math.max(0, k) }, (_, i) => Math.floor(((i + 0.5) * n) / k));
}

type JobSpec = Omit<Job, 'id' | 'verify'>;

/** The jobs of one pack, in the canonical order that fixes the report: main (bot, class, seed), scenarios, scripts. */
export async function jobsOf(spec: string, content: ContentPack, cfg: ResolvedConfig): Promise<JobSpec[]> {
  const jobs: JobSpec[] = [];
  const base = { pack: spec, maxLoops: cfg.maxLoops, modifiers: cfg.modifiers };
  const classIds = classesFor({ classes: cfg.classes }, content);
  if (content.locations[content.config.startLocationId] === undefined) {
    throw new UsageError(`pack ${spec}: no start location '${content.config.startLocationId}' — the pack has no world yet`);
  }
  for (const bot of cfg.bots) for (const classId of classIds) for (const seed of cfg.seeds) jobs.push({ ...base, suite: 'main', seed, classId, bot, stopAt: 'ending', maxSteps: cfg.maxSteps });

  if (cfg.scenarioSeeds > 0) {
    const seeds = cfg.seeds.slice(0, cfg.scenarioSeeds);
    const companion = Object.keys(content.companions).sort()[0];
    const scenario = { ...base, suite: 'scenario' as const, maxSteps: SCENARIO_MAX_STEPS };
    for (const id of Object.values(SCENARIO_PRE_TYRANT)) {
      for (const bot of ['melee', 'caster'].filter((b) => cfg.bots.includes(b))) {
        for (const classId of classIds) {
          for (const companionId of companion === undefined ? [undefined] : [undefined, companion]) {
            for (const seed of seeds) jobs.push({ ...scenario, maxLoops: 1, seed, classId, bot, scenario: id, stopAt: 'loop_end', ...(companionId === undefined ? {} : { companionId }) });
          }
        }
      }
    }
    // the communion path (DESIGN §19 #20): one class is enough to show the Resolve is reachable
    const communionClass = classIds.includes('ranger') ? 'ranger' : classIds[0];
    if (communionClass !== undefined) {
      for (const bot of ['pacifist', 'caster'].filter((b) => cfg.bots.includes(b))) {
        for (const seed of seeds) jobs.push({ ...scenario, seed, classId: communionClass, bot, scenario: SCENARIO_COMMUNION, stopAt: 'ending' });
      }
    }
  }

  for (const source of cfg.scripts === null ? defaultScripts(spec) : cfg.scripts.map(parseScriptSpec)) {
    const scripts = await loadEndingScripts(source.module, source.export);
    scripts.forEach((script, index) => {
      jobs.push({ ...base, suite: 'script', seed: script.seed, classId: script.classId, bot: 'pathBot', stopAt: 'ending', maxSteps: cfg.maxSteps, script: { module: source.module, export: source.export, index } });
    });
  }
  // U82: the quest proofs (PLAN §7.8: "the union of batch + scripts completes 100 %") are part of the batch, so the coverage
  // rows read the same union the quest-proof test asserts
  if (cfg.questProofs && spec === 'real') {
    QUEST_SCRIPTS.forEach((script, index) => {
      jobs.push({ ...base, suite: 'script', seed: script.seed, classId: script.classId, bot: 'pathBot', stopAt: 'max_steps', maxSteps: script.maxSteps ?? DEFAULT_QUEST_PROOF_STEPS, quest: { index } });
    });
  }
  return jobs;
}

// ---- the pool ---------------------------------------------------------------------------------------------------------------------------

/** Runs `jobs` (job `i` has `id === i`) and returns their outcomes by id. */
export async function execute(jobs: readonly Job[], workers: number, onDone: (done: number, total: number) => void = () => {}): Promise<JobOutcome[]> {
  const outcomes = new Array<JobOutcome>(jobs.length);
  if (workers <= 1 || jobs.length <= 1) {
    const cache = new PackCache();
    for (const job of jobs) {
      outcomes[job.id] = await runJob(job, cache);
      onDone(job.id + 1, jobs.length);
    }
    return outcomes;
  }
  const pool: Worker[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      let next = 0;
      let done = 0;
      const feed = (w: Worker): void => {
        const job = jobs[next];
        if (job !== undefined) {
          next += 1;
          w.postMessage(job);
        }
      };
      for (let i = 0; i < Math.min(workers, jobs.length); i++) {
        const w = new Worker(new URL('./worker.ts', import.meta.url));
        pool.push(w);
        w.on('message', (outcome: JobOutcome) => {
          outcomes[outcome.id] = outcome;
          done += 1;
          onDone(done, jobs.length);
          if (done === jobs.length) resolve();
          else feed(w);
        });
        w.on('error', reject);
        feed(w);
      }
    });
  } finally {
    await Promise.all(pool.map((w) => w.terminate()));
  }
  return outcomes;
}

// ---- the batch ---------------------------------------------------------------------------------------------------------------------------

function gitSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

const describe = (j: Job): string => [j.bot, j.classId, j.seed, j.scenario, j.companionId === undefined ? undefined : `+${j.companionId}`, j.script === undefined ? undefined : `script#${j.script.index}`, j.quest === undefined ? undefined : `quest#${j.quest.index}`].filter((x) => x !== undefined).join(' ');

export interface RunBatchHooks {
  /** Called as jobs finish. */
  onProgress?: (done: number, total: number) => void;
  /** Called once the packs are loaded and the job list is known. */
  onPlan?: (packs: readonly PackSummary[], total: number) => void;
}

export type Mismatch = DeterminismSummary['mismatches'][number];

/**
 * The determinism verdict of one verified run (PLAN §1.2 G6): null when the recorded re-run and the replay through `step` both end
 * on the hash of the run itself. A step that threw ends the run before the exception and cannot be replayed to a hash, so such a
 * run is compared by its re-run only.
 */
export function mismatchOf(job: Job, out: Extract<JobOutcome, { kind: 'run' }>): Mismatch | null {
  if (out.check === undefined) return null;
  const expected = out.result.finalStateHash;
  const replayBad = out.result.stopReason !== 'error' && out.check.replay !== expected;
  if (out.check.rerun === expected && !replayBad) return null;
  return { pack: job.pack, bot: out.result.bot, classId: out.result.classId, seed: out.result.seed, expected, rerun: out.check.rerun, replay: out.check.replay, repro: reproOf(job) };
}

export async function runBatch(input: BatchConfig, hooks: RunBatchHooks = {}): Promise<BatchResult> {
  const t0 = performance.now();
  const startedAt = new Date().toISOString();
  const cfg = resolveConfig(input);
  const contents = new Map<string, ContentPack>();
  const specs: JobSpec[] = [];
  const packs: PackSummary[] = [];
  for (const spec of cfg.packs) {
    const content = await loadPack(spec);
    contents.set(spec, content);
    const jobs = await jobsOf(spec, content, cfg);
    specs.push(...jobs);
    packs.push({ spec, contentVersion: content.version, classes: Object.keys(content.classes).sort(), jobs: jobs.length });
  }
  // the determinism sample: evenly spaced over the main suite (every such job produces a run to verify; a scenario sim may be
  // skipped and a script proof is not a recorded replay)
  const replayable = specs.map((s, i) => [s, i] as const).filter(([s]) => s.suite === 'main').map(([, i]) => i);
  const sampled = new Set(sampleEvenly(replayable.length, cfg.determinism).map((k) => replayable[k] as number));
  const jobs: Job[] = specs.map((s, id) => ({ ...s, id, verify: sampled.has(id) }));
  hooks.onPlan?.(packs, jobs.length);

  const outcomes = await execute(jobs, cfg.workers, hooks.onProgress);

  const runs: BatchRun[] = [];
  const skipped: Skipped[] = [];
  const failures: Failure[] = [];
  const determinism: Record<string, DeterminismSummary> = Object.fromEntries(cfg.packs.map((p) => [p, { sampled: 0, mismatches: [] }]));
  for (const job of jobs) {
    const out = outcomes[job.id] as JobOutcome;
    if (out.kind === 'skipped') skipped.push({ pack: job.pack, suite: job.suite, what: describe(job), reason: out.reason });
    else if (out.kind === 'failed') failures.push({ pack: job.pack, suite: job.suite, what: describe(job), message: out.message });
    else {
      const run = batchRunOf(job, out);
      runs.push(run);
      if (out.check !== undefined) {
        const d = determinism[job.pack] as DeterminismSummary;
        d.sampled += 1;
        const bad = mismatchOf(job, out);
        if (bad !== null) d.mismatches.push(bad);
      }
    }
  }
  const main = runs.filter((r) => r.suite === 'main').map((r) => r.result);
  const steps = main.reduce((t, r) => t + r.steps, 0);
  return {
    config: cfg,
    packs,
    runs,
    skipped,
    failures,
    determinism,
    startedAt,
    durationMs: performance.now() - t0,
    contentVersion: [...new Set(packs.map((p) => p.contentVersion))].join(', '),
    gitSha: gitSha(),
    workers: cfg.workers <= 1 || jobs.length <= 1 ? 1 : Math.min(cfg.workers, jobs.length),
    dev: __DEV__,
    runMicrosPerStep: steps === 0 ? 0 : (1000 * main.reduce((t, r) => t + r.durationMs, 0)) / steps,
  };
}

/** What a batch has to say about itself without its timing: for comparing two batches run with different worker counts. */
export function comparable(batch: BatchResult): unknown {
  return {
    runs: batch.runs.map((r) => ({ ...r, result: { ...r.result, durationMs: 0 } })),
    skipped: batch.skipped,
    failures: batch.failures,
    determinism: batch.determinism,
  };
}

/** What one `step` costs, in µs (PLAN §7.4: the median step on a fixture pack must stay ≤ 400 µs, measured with `__DEV__` off). */
export interface StepTiming {
  steps: number;
  medianMicros: number;
  p90Micros: number;
  meanMicros: number;
  dev: boolean;
}

/**
 * Times `step` alone: records some runs of the given bots, then replays their actions one by one and clocks each call (after one
 * unmeasured pass to warm the JIT). `tests/unit/engine/perf.test.ts` runs it in a subprocess with `__DEV__` off.
 */
export function measureStepMicros(content: ContentPack, opts: { seeds?: number; bots?: readonly string[]; maxSteps?: number } = {}): StepTiming {
  const samples: number[] = [];
  const seeds = Array.from({ length: opts.seeds ?? 6 }, (_, i) => `perf:${i}`);
  for (const bot of opts.bots ?? ['melee', 'explorer', 'random']) {
    for (const seed of seeds) {
      const cfg = { seed, classId: 'auto', bot: (BOTS[bot] as (typeof BOTS)[string])(), stopAt: 'ending' as const, maxSteps: opts.maxSteps ?? 600, record: true };
      const trace = runLoop(cfg, content).trace ?? [];
      for (const timed of [false, true]) {
        const start = startRun(cfg, resolveClass(cfg.classId, cfg.bot, content), content);
        let { state, profile } = start;
        for (const action of trace) {
          const t0 = performance.now();
          const out = step(state, action, content, profile);
          const dt = performance.now() - t0;
          if (!out.events.some((e) => e.t === 'actionRejected')) ({ state, profile } = out);
          if (timed) samples.push(dt * 1000);
        }
      }
    }
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  return { steps: samples.length, medianMicros: at(0.5), p90Micros: at(0.9), meanMicros: samples.reduce((t, x) => t + x, 0) / Math.max(1, samples.length), dev: __DEV__ };
}

/** The metrics of each pack of a batch (the packs are rebuilt: a batch does not keep them). */
export async function metricsOf(batch: BatchResult): Promise<{ pack: string; metrics: Metrics }[]> {
  const out: { pack: string; metrics: Metrics }[] = [];
  for (const p of batch.packs) {
    const content = await loadPack(p.spec);
    const runs = batch.runs.filter((r) => r.pack === p.spec);
    const determinism = batch.config.determinism === 0 ? null : (batch.determinism[p.spec] ?? null);
    out.push({ pack: p.spec, metrics: computeMetrics({ pack: p.spec, content, runs, determinism }) });
  }
  return out;
}

/** Blockers of the whole batch: runs with an error or soft-lock, failed proofs, determinism mismatches, crashed jobs. */
export function blockerCount(batch: BatchResult): number {
  return batch.runs.filter(isBlockerRun).length + batch.failures.length + Object.values(batch.determinism).reduce((t, d) => t + d.mismatches.length, 0);
}

// ---- the command line -------------------------------------------------------------------------------------------------------------------

const list = (v: string): string[] =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');

function whole(flag: string, v: string, min: number): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new UsageError(`${flag} wants a whole number ≥ ${min}, not '${v}'`);
  return n;
}

export interface BatchArgs {
  config: BatchConfig;
  quiet: boolean;
}

/** Parses the options of `batch` / `gen-balance` (an optional leading `batch`). Throws UsageError. */
export function parseBatchArgs(argv: readonly string[]): BatchArgs {
  const args = argv[0] === 'batch' ? argv.slice(1) : [...argv];
  const config: BatchConfig = { packs: ['real'], seeds: DEFAULT_SEEDS, classes: 'all', bots: 'all' };
  let quiet = false;
  let seedCount = DEFAULT_SEEDS;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i] as string;
    if (flag === '--quiet') {
      quiet = true;
      continue;
    }
    const value = args[i + 1];
    if (!flag.startsWith('--')) throw new UsageError(`unexpected '${flag}'`);
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} needs a value`);
    i += 1;
    switch (flag) {
      case '--pack':
      case '--packs':
        config.packs = list(value);
        break;
      case '--seeds':
        seedCount = whole(flag, value, 1);
        config.seeds = seedCount;
        break;
      case '--seed-prefix':
        config.seedPrefix = value;
        break;
      case '--bot':
      case '--bots':
        config.bots = value === 'all' ? 'all' : list(value);
        break;
      case '--class':
      case '--classes':
        config.classes = value === 'all' ? 'all' : list(value);
        break;
      case '--workers':
        config.workers = whole(flag, value, 1);
        break;
      case '--max-steps':
        config.maxSteps = whole(flag, value, 1);
        break;
      case '--max-loops':
        config.maxLoops = whole(flag, value, 1);
        break;
      case '--modifiers':
        config.modifiers = list(value);
        break;
      case '--scripts':
        config.scripts = list(value);
        break;
      case '--scenario-seeds':
        config.scenarioSeeds = whole(flag, value, 0);
        break;
      case '--determinism':
        config.determinism = whole(flag, value, 0);
        break;
      case '--out':
        config.out = value;
        break;
      case '--json':
        config.json = value;
        break;
      case '--merge':
        config.merge = list(value);
        break;
      case '--quest-proofs':
        if (value !== 'on' && value !== 'off') throw new UsageError('--quest-proofs is on or off');
        config.questProofs = value === 'on';
        break;
      default:
        throw new UsageError(`unknown option ${flag}`);
    }
  }
  return { config, quiet };
}

const mmss = (ms: number): string => `${Math.floor(ms / 60000)}m${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}s`;

/** Combines raw `--json` batches (traces dropped) into one: runs concatenated, seeds and determinism samples summed. */
export function mergeBatches(files: readonly string[], out: string, json?: string): BatchResult {
  const parts = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')) as BatchResult);
  const first = parts[0] as BatchResult;
  const determinism: Record<string, DeterminismSummary> = {};
  for (const b of parts) {
    for (const [k, d] of Object.entries(b.determinism)) {
      const t = (determinism[k] ??= { sampled: 0, mismatches: [] });
      t.sampled += d.sampled;
      t.mismatches.push(...d.mismatches);
    }
  }
  const mainSteps = parts.map((b) => b.runs.filter((r) => r.suite === 'main').reduce((t, r) => t + r.result.steps, 0));
  const steps = mainSteps.reduce((a, b) => a + b, 0);
  return {
    ...first,
    config: { ...first.config, seeds: parts.flatMap((b) => b.config.seeds), scenarioSeeds: Math.max(...parts.map((b) => b.config.scenarioSeeds)), determinism: parts.reduce((t, b) => t + b.config.determinism, 0), out, json },
    packs: first.packs.map((p) => ({ ...p, jobs: parts.reduce((t, b) => t + (b.packs.find((q) => q.spec === p.spec)?.jobs ?? 0), 0) })),
    runs: parts.flatMap((b) => b.runs),
    skipped: parts.flatMap((b) => b.skipped),
    failures: parts.flatMap((b) => b.failures),
    determinism,
    durationMs: parts.reduce((t, b) => t + b.durationMs, 0),
    runMicrosPerStep: steps === 0 ? 0 : parts.reduce((t, b, i) => t + b.runMicrosPerStep * (mainSteps[i] as number), 0) / steps,
  };
}

/** `npm run sim:balance` / `sim batch`: plays the batch, writes the report (and the raw batch with --json). */
export async function batchMain(argv: readonly string[], write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): Promise<number> {
  let batch: BatchResult;
  let reports: { pack: string; metrics: Metrics }[];
  let outFile: string;
  try {
    const { config, quiet } = parseBatchArgs(argv);
    let lastTenth = -1;
    batch = config.merge !== undefined ? mergeBatches(config.merge, config.out ?? DEFAULT_OUT, config.json) : await runBatch(config, {
      onPlan: (packs, total) => {
        if (!quiet) write(`batch: ${total} job(s) over ${packs.length} pack(s) [${packs.map((p) => `${p.spec} ${p.jobs}`).join(', ')}]${resolveConfig(config).workers > 1 ? `, ${resolveConfig(config).workers} workers` : ''}${__DEV__ ? ' — __DEV__ is ON (steps are deep-frozen; run through the sim:balance script)' : ''}`);
      },
      onProgress: (done, total) => {
        const tenth = Math.floor((10 * done) / total);
        if (!quiet && tenth !== lastTenth) {
          lastTenth = tenth;
          write(`batch: ${done}/${total} job(s)`);
        }
      },
    });
    reports = await metricsOf(batch);
    outFile = path.resolve(batch.config.out);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, renderBalance(batch, reports));
    if (batch.config.json !== undefined) {
      const runs = batch.runs.map((r) => {
        const { trace: _trace, ...result } = r.result;
        return { ...r, result };
      });
      fs.writeFileSync(batch.config.json, `${JSON.stringify({ ...batch, runs }, null, 2)}\n`);
    }
  } catch (e) {
    write(`batch: ${e instanceof Error ? e.message : String(e)}`);
    return e instanceof UsageError ? 2 : 1;
  }
  const blockers = blockerCount(batch);
  for (const { pack, metrics } of reports) {
    const t = metrics.targets;
    const n = (s: string): number => t.filter((r) => r.status === s).length;
    write(`${pack}: ${metrics.runs} run(s); targets ${n('pass')} pass, ${n('fail')} fail, ${n('partial')} partial, ${n('n/a')} n/a`);
  }
  write(`batch: ${batch.runs.length} run(s) in ${mmss(batch.durationMs)} on ${batch.workers} worker(s), ${batch.runMicrosPerStep.toFixed(0)} µs/step (${batch.dev ? '__DEV__ on' : '__DEV__ off'}), ${batch.skipped.length} scenario sim(s) skipped`);
  write(`batch: ${blockers} blocker(s); wrote ${outFile}`);
  return blockers === 0 ? 0 : 1;
}
