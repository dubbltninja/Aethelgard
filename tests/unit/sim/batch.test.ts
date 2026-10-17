// U39: the batch runner (PLAN §7.4) — configuration, the job list, the worker pool (1 worker and N give the same batch), the
// determinism sample, the options and the `batch` command. Packs are the fixtures; runs are kept short.
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BOTS } from '@sim/bots/index';
import { FIXTURE_PACKS, UsageError, loadPack } from '@sim/cli';
import {
  DEFAULT_DETERMINISM,
  DEFAULT_OUT,
  DEFAULT_SCENARIO_SEEDS,
  DEFAULT_SEEDS,
  SCENARIO_MAX_STEPS,
  batchMain,
  blockerCount,
  comparable,
  defaultScripts,
  execute,
  jobsOf,
  measureStepMicros,
  metricsOf,
  mismatchOf,
  parseBatchArgs,
  resolveConfig,
  runBatch,
  sampleEvenly,
  type BatchConfig,
  type BatchResult,
} from '@sim/batch';
import { PackCache, runJob, type Job, type JobOutcome } from '@sim/worker';
import { storyPack } from '@tests/fixtures/storyContent';
import { blankResult } from './helpers';

const small = (over: Partial<BatchConfig> = {}): BatchConfig => ({
  packs: ['fixture:story'],
  seeds: 2,
  classes: ['ranger'],
  bots: ['melee', 'random'],
  workers: 1,
  maxSteps: 150,
  maxLoops: 1,
  scenarioSeeds: 0,
  determinism: 0,
  scripts: [],
  ...over,
});
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'u39-batch-'));

describe('resolveConfig', () => {
  test('the defaults', () => {
    const c = resolveConfig({ seeds: DEFAULT_SEEDS, classes: 'all', bots: 'all' });
    expect(c.packs).toEqual(['fixture']);
    expect(c.seeds).toHaveLength(30);
    expect(c.seeds[0]).toBe('bal:0');
    expect(c.bots).toEqual(Object.keys(BOTS).sort());
    expect(c).toMatchObject({ classes: 'all', maxSteps: 6000, maxLoops: 3, modifiers: [], scripts: null, scenarioSeeds: DEFAULT_SCENARIO_SEEDS, determinism: DEFAULT_DETERMINISM, out: DEFAULT_OUT, json: undefined });
    expect(c.workers).toBeGreaterThanOrEqual(1);
  });

  test('explicit values: a seed list and prefix, workers floor at 1, scenario seeds never exceed the seeds, packs expand', () => {
    const c = resolveConfig({ packs: ['fixtures'], seeds: ['a', 'b', 'c'], seedPrefix: 'zz', classes: ['ranger'], bots: ['melee'], workers: 0, scenarioSeeds: 99, determinism: 5, out: 'o.md', json: 'o.json', modifiers: ['m'], scripts: ['x#y'], maxSteps: 7, maxLoops: 2 });
    expect(c.packs).toHaveLength(Object.keys(FIXTURE_PACKS).length);
    expect(c).toMatchObject({ seeds: ['a', 'b', 'c'], bots: ['melee'], workers: 1, scenarioSeeds: 3, determinism: 5, out: 'o.md', json: 'o.json', modifiers: ['m'], scripts: ['x#y'], maxSteps: 7, maxLoops: 2 });
    expect(resolveConfig({ seeds: 2, seedPrefix: 'zz', classes: 'all', bots: 'all' }).seeds).toEqual(['zz:0', 'zz:1']);
  });

  test('an unknown bot and an empty seed list are usage errors', () => {
    expect(() => resolveConfig({ seeds: 1, classes: 'all', bots: ['nobody'] })).toThrow(UsageError);
    expect(() => resolveConfig({ seeds: 1, classes: 'all', bots: ['nobody'] })).toThrow("unknown bot 'nobody'");
    expect(() => resolveConfig({ seeds: [], classes: 'all', bots: 'all' })).toThrow('at least one seed');
  });
});

describe('sampleEvenly and defaultScripts', () => {
  test('k indices spread over n; all of them when k ≥ n; none when k is 0', () => {
    expect(sampleEvenly(10, 3)).toEqual([1, 5, 8]);
    expect(sampleEvenly(4, 4)).toEqual([0, 1, 2, 3]);
    expect(sampleEvenly(4, 9)).toEqual([0, 1, 2, 3]);
    expect(sampleEvenly(100, 0)).toEqual([]);
    const s = sampleEvenly(1000, 200);
    expect(new Set(s).size).toBe(200);
    expect(s.every((i) => i >= 0 && i < 1000)).toBe(true);
  });

  test('fixture packs get the fixture ending scripts; another pack gets none (the real pack only once its scripts exist)', () => {
    for (const spec of ['fixture', 'fixture:story']) {
      const [only] = defaultScripts(spec);
      expect(defaultScripts(spec)).toHaveLength(1);
      expect(only?.export).toBe('FIXTURE_ENDING_SCRIPTS');
      expect(fs.existsSync(only?.module ?? '')).toBe(true);
    }
    expect(defaultScripts('./some/pack.ts#pack')).toEqual([]);
    const real = defaultScripts('real');
    expect(real.length).toBe(fs.existsSync(path.resolve('src/sim/scripts/endings/index.ts')) ? 1 : 0);
  });
});

describe('jobsOf', () => {
  const content = storyPack();
  const cfg = (over: Partial<BatchConfig> = {}): ReturnType<typeof resolveConfig> => resolveConfig(small({ bots: ['melee', 'caster', 'pacifist'], classes: ['ranger', 'wizard'], seeds: 3, scenarioSeeds: 2, ...over }));

  test('main jobs run bot × class × seed in that order', async () => {
    const jobs = await jobsOf('fixture:story', content, cfg({ scenarioSeeds: 0 }));
    expect(jobs).toHaveLength(3 * 2 * 3);
    expect(jobs.every((j) => j.suite === 'main' && j.stopAt === 'ending' && j.maxSteps === 150)).toBe(true);
    expect(jobs.slice(0, 4).map((j) => `${j.bot}/${j.classId}/${j.seed}`)).toEqual(['melee/ranger/bal:0', 'melee/ranger/bal:1', 'melee/ranger/bal:2', 'melee/wizard/bal:0']);
  });

  test('scenario jobs: pre-Tyrant for melee and caster, solo and with the first companion, then the communion for pacifist and caster', async () => {
    const jobs = (await jobsOf('fixture:story', content, cfg())).filter((j) => j.suite === 'scenario');
    const pre = jobs.filter((j) => j.scenario !== 'communion_movement_2');
    // 2 scenarios × 2 bots × 2 classes × (solo + companion) × 2 seeds
    expect(pre).toHaveLength(2 * 2 * 2 * 2 * 2);
    expect(pre.every((j) => j.maxSteps === SCENARIO_MAX_STEPS && j.maxLoops === 1 && j.stopAt === 'loop_end')).toBe(true);
    expect(new Set(pre.map((j) => j.companionId))).toEqual(new Set([undefined, Object.keys(content.companions).sort()[0]]));
    const communion = jobs.filter((j) => j.scenario === 'communion_movement_2');
    expect(communion.map((j) => `${j.bot}/${j.classId}/${j.stopAt}`)).toEqual(['pacifist/ranger/ending', 'pacifist/ranger/ending', 'caster/ranger/ending', 'caster/ranger/ending']);
  });

  test('a pack without companions has only solo scenario jobs; the communion class falls back to the first class', async () => {
    const jobs = await jobsOf('fixture:story', { ...content, companions: {} }, cfg({ classes: ['wizard'], bots: ['melee', 'pacifist'] }));
    const scenario = jobs.filter((j) => j.suite === 'scenario');
    expect(scenario.every((j) => j.companionId === undefined)).toBe(true);
    expect(scenario.filter((j) => j.scenario === 'communion_movement_2').every((j) => j.classId === 'wizard')).toBe(true);
    // no melee/caster/pacifist/caster bots at all: no scenario jobs
    expect((await jobsOf('fixture:story', content, cfg({ bots: ['random'] }))).filter((j) => j.suite === 'scenario')).toHaveLength(0);
  });

  test('script jobs: the default of a fixture pack, or the --scripts list; one job per script, run by the path bot', async () => {
    const jobs = (await jobsOf('fixture:story', content, cfg({ scenarioSeeds: 0, scripts: undefined }))).filter((j) => j.suite === 'script');
    expect(jobs.length).toBeGreaterThan(5);
    expect(jobs.every((j) => j.bot === 'pathBot' && j.script !== undefined)).toBe(true);
    expect(jobs.map((j) => j.script?.index)).toEqual(jobs.map((_, i) => i));
    const some = (await jobsOf('fixture:story', content, cfg({ scenarioSeeds: 0, scripts: ['tests/fixtures/scripts/endings.ts#FIXTURE_ENDING_SCRIPTS'] }))).filter((j) => j.suite === 'script');
    expect(some).toHaveLength(jobs.length);
    expect(path.isAbsolute(some[0]?.script?.module ?? '')).toBe(true);
    // a --scripts spec with no export name takes `default`
    await expect(jobsOf('fixture:story', content, cfg({ scripts: ['tests/fixtures/scripts/endings.ts'] }))).rejects.toThrow('not an EndingScript[]');
  });

  test('a pack with no world is a usage error; an unknown class is too', async () => {
    await expect(jobsOf('p', { ...content, locations: {} }, cfg())).rejects.toThrow('no start location');
    await expect(jobsOf('p', content, cfg({ classes: ['paladin'] }))).rejects.toThrow("no class 'paladin'");
  });
});

describe('execute', () => {
  const jobs = (n: number): Job[] =>
    Array.from({ length: n }, (_, id) => ({ id, pack: 'fixture:story', suite: 'main' as const, seed: `x:${id}`, classId: 'ranger', bot: 'melee', stopAt: 'ending' as const, maxSteps: 60, maxLoops: 1, modifiers: [], verify: false }));
  const hashes = (o: JobOutcome[]): (string | undefined)[] => o.map((x) => (x.kind === 'run' ? x.result.finalStateHash : undefined));

  test('in this thread: outcomes by job id, progress after each', async () => {
    const seen: [number, number][] = [];
    const out = await execute(jobs(3), 1, (d, t) => seen.push([d, t]));
    expect(out.map((o) => o.id)).toEqual([0, 1, 2]);
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(await execute([], 4)).toEqual([]);
    expect(hashes(await execute(jobs(1), 4))).toEqual(hashes(out).slice(0, 1)); // one job never needs a pool
  });

  test('on worker threads: the same outcomes as in this thread, whatever the pool size', async () => {
    const js = jobs(5);
    const inThread = hashes(await execute(js, 1));
    let done = 0;
    expect(hashes(await execute(js, 2, () => (done += 1)))).toEqual(inThread);
    expect(done).toBe(5);
    expect(hashes(await execute(js, 8))).toEqual(inThread); // more workers than jobs
    expect(inThread.every((h) => typeof h === 'string')).toBe(true);
  });

  test('a worker keeps its pack between jobs, and a job that cannot run comes back as a failure, not a crash', async () => {
    const js = [...jobs(2), { ...jobs(1)[0], id: 2, bot: 'nobody' } as Job];
    const out = await execute(js, 2);
    expect(out.map((o) => o.kind)).toEqual(['run', 'run', 'failed']);
  });
});

describe('mismatchOf', () => {
  const job: Job = { id: 3, pack: 'fixture:story', suite: 'main', seed: 'm:0', classId: 'ranger', bot: 'melee', stopAt: 'ending', maxSteps: 10, maxLoops: 1, modifiers: [], verify: true };
  const out = (hash: string, check: { rerun: string; replay: string } | undefined, stopReason = 'ending'): Extract<JobOutcome, { kind: 'run' }> => ({
    id: 3,
    kind: 'run',
    result: blankResult({ finalStateHash: hash, stopReason: stopReason as never }),
    ...(check === undefined ? {} : { check }),
  });

  test('no check, or three equal hashes, is no mismatch', () => {
    expect(mismatchOf(job, out('h', undefined))).toBeNull();
    expect(mismatchOf(job, out('h', { rerun: 'h', replay: 'h' }))).toBeNull();
  });

  test('a re-run or a replay that ends elsewhere is a mismatch that carries all three hashes and the repro', () => {
    expect(mismatchOf(job, out('h', { rerun: 'x', replay: 'h' }))).toMatchObject({ pack: 'fixture:story', bot: 'melee', classId: 'ranger', seed: 's:0', expected: 'h', rerun: 'x', replay: 'h' });
    const replayOnly = mismatchOf(job, out('h', { rerun: 'h', replay: 'y' }));
    expect(replayOnly).toMatchObject({ rerun: 'h', replay: 'y' });
    expect(replayOnly?.repro).toContain('--seed m:0');
  });

  test('a run that ended on an engine error is compared by its re-run only', () => {
    expect(mismatchOf(job, out('h', { rerun: 'h', replay: 'threw:boom' }, 'error'))).toBeNull();
    expect(mismatchOf(job, out('h', { rerun: 'z', replay: 'threw:boom' }, 'error'))).not.toBeNull();
  });
});

describe('runBatch', () => {
  test('the packs, runs in job order, the sampled determinism check, and the numbers a report needs', async () => {
    const planned: number[] = [];
    let last = 0;
    const b = await runBatch(small({ determinism: 3 }), { onPlan: (packs, total) => planned.push(packs[0]?.jobs ?? -1, total), onProgress: (d) => (last = d) });
    expect(b.packs).toHaveLength(1);
    expect(b.packs[0]).toMatchObject({ spec: 'fixture:story', classes: ['elf', 'ironclad_warden', 'ranger', 'shadow_weaver', 'wizard'], jobs: 4 });
    expect(typeof b.packs[0]?.contentVersion).toBe('string');
    expect(planned).toEqual([4, 4]);
    expect(last).toBe(4);
    expect(b.runs.map((r) => `${r.result.bot}/${r.result.seed}`)).toEqual(['melee/bal:0', 'melee/bal:1', 'random/bal:0', 'random/bal:1']);
    expect(b.runs.every((r) => r.pack === 'fixture:story' && r.suite === 'main' && r.repro.includes('sim:replay'))).toBe(true);
    expect(b.determinism['fixture:story']).toEqual({ sampled: 3, mismatches: [] });
    expect(b).toMatchObject({ workers: 1, dev: true, skipped: [], failures: [] });
    expect(b.config.workers).toBe(1);
    expect(b.contentVersion).toBe(b.packs[0]?.contentVersion);
    expect(b.gitSha).toMatch(/^[0-9a-f]{7,}$|^unknown$/);
    expect(b.durationMs).toBeGreaterThan(0);
    expect(b.runMicrosPerStep).toBeGreaterThan(0);
    expect(new Date(b.startedAt).getTime()).toBeGreaterThan(0);
    expect(blockerCount(b)).toBe(0);
  });

  test('determinism 0 samples nothing; a sample larger than the batch takes every run', async () => {
    expect((await runBatch(small())).determinism['fixture:story']).toEqual({ sampled: 0, mismatches: [] });
    expect((await runBatch(small({ determinism: 50 }))).determinism['fixture:story']?.sampled).toBe(4);
  });

  test('scenario sims the pack cannot express are skipped, and a job that cannot run is a failure', async () => {
    const b = await runBatch(small({ bots: ['melee', 'pacifist'], scenarioSeeds: 1 }));
    expect(b.skipped.length).toBeGreaterThan(0);
    expect(b.skipped[0]).toMatchObject({ pack: 'fixture:story', suite: 'scenario' });
    expect(b.skipped[0]?.reason).toContain('pre_tyrant_l11_ranger');
    expect(b.skipped[0]?.what).toBe('melee ranger bal:0 pre_tyrant_l11_ranger');
    expect(b.skipped.some((s) => s.what.includes('+'))).toBe(true); // the companion variant says so
    const bad = await runBatch(small({ modifiers: ['mod_nope'], bots: ['random'], seeds: 1 }));
    expect(bad.runs).toEqual([]);
    expect(bad.failures).toHaveLength(1);
    expect(bad.failures[0]).toMatchObject({ pack: 'fixture:story', suite: 'main', what: 'random ranger bal:0' });
    expect(bad.failures[0]?.message).toContain('mod_nope');
    expect(blockerCount(bad)).toBe(1);
  });

  test('ending scripts are run on the path bot and carry their proof', async () => {
    const b = await runBatch(small({ bots: ['random'], seeds: 1, scripts: ['tests/fixtures/scripts/endings.ts#FIXTURE_ENDING_SCRIPTS'] }));
    const scripts = b.runs.filter((r) => r.suite === 'script');
    expect(scripts.length).toBeGreaterThan(5);
    expect(scripts.every((r) => r.proof !== undefined && r.script !== undefined)).toBe(true);
    expect(scripts.filter((r) => r.proof?.reached !== true)).toEqual([]);
    expect(b.determinism['fixture:story']?.sampled).toBe(0);
  });

  test('a soft-lock is a blocker that keeps its trace and counts in the exit', async () => {
    const b = await runBatch(small({ packs: ['fixture:combat'], bots: ['caster'], classes: ['shadow_weaver'], seeds: ['bal:0'], maxSteps: 6000, maxLoops: 3 }));
    expect(b.runs[0]?.result.softLock.detected).toBe(true);
    expect(b.runs[0]?.result.trace?.length).toBeGreaterThan(0);
    expect(blockerCount(b)).toBe(1);
  });

  test('1 worker and 2 workers give the same batch (the clock aside), scripts and scenarios included', async () => {
    const cfg = small({ packs: ['fixture:story', 'fixture:horde'], bots: ['melee', 'pacifist'], seeds: 2, scenarioSeeds: 1, determinism: 4, scripts: undefined, maxSteps: 200 });
    const one = await runBatch({ ...cfg, workers: 1 });
    const two = await runBatch({ ...cfg, workers: 2 });
    expect(one.workers).toBe(1);
    expect(two.workers).toBe(2);
    expect(comparable(two)).toEqual(comparable(one));
    expect(one.runs.some((r) => r.suite === 'scenario')).toBe(true);
    expect(one.runs.some((r) => r.suite === 'script')).toBe(true);
    expect(Object.values(one.determinism).reduce((t, d) => t + d.sampled, 0)).toBe(4);
  }, 30_000); // two full batches with worker threads: ~6 s on a shared 2-core box (bun's default is 5 s)
});

describe('comparable, metricsOf, blockerCount', () => {
  test('comparable drops only the durations', async () => {
    const b = await runBatch(small({ seeds: 1, bots: ['melee'] }));
    const c = comparable(b) as { runs: { result: { durationMs: number; steps: number } }[] };
    expect(c.runs[0]?.result.durationMs).toBe(0);
    expect(c.runs[0]?.result.steps).toBe(b.runs[0]?.result.steps);
  });

  test('the metrics of each pack from its own runs, with the determinism summary only when it was run', async () => {
    const b = await runBatch(small({ packs: ['fixture:story', 'fixture:combat'], seeds: 1, bots: ['melee'], determinism: 2 }));
    const ms = await metricsOf(b);
    expect(ms.map((m) => m.pack)).toEqual(['fixture:story', 'fixture:combat']);
    expect(ms.map((m) => m.metrics.runs)).toEqual([1, 1]);
    expect(ms[0]?.metrics.targets.find((t) => t.row === 'G6')?.status).toBe('pass');
    const off = await metricsOf(await runBatch(small({ seeds: 1, bots: ['melee'] })));
    expect(off[0]?.metrics.targets.find((t) => t.row === 'G6')?.status).toBe('n/a');
  });

  test('blockerCount adds runs with errors or soft-locks, failed proofs, crashed jobs and determinism mismatches', () => {
    const base = { runs: [], failures: [], determinism: {} } as unknown as BatchResult;
    expect(blockerCount(base)).toBe(0);
    const mismatch = { pack: 'p', bot: 'b', classId: 'c', seed: 's', expected: 'a', rerun: 'b', replay: 'c', repro: 'r' };
    const batch = {
      ...base,
      runs: [{ pack: 'p', suite: 'main', repro: '', result: blankResult({ errors: [{ step: 1, message: 'x' }] }) }, { pack: 'p', suite: 'script', repro: '', result: blankResult(), proof: { reached: false, detail: '' } }, { pack: 'p', suite: 'main', repro: '', result: blankResult() }],
      failures: [{ pack: 'p', suite: 'main', what: 'w', message: 'm' }],
      determinism: { p: { sampled: 1, mismatches: [mismatch] } },
    } as unknown as BatchResult;
    expect(blockerCount(batch)).toBe(4);
  });
});

describe('measureStepMicros', () => {
  test('clocks `step` alone over recorded runs', async () => {
    const t = measureStepMicros(await loadPack('fixture:story'), { seeds: 1, bots: ['melee'], maxSteps: 80 });
    expect(t.steps).toBeGreaterThan(20);
    expect(t.medianMicros).toBeGreaterThan(0);
    expect(t.p90Micros).toBeGreaterThanOrEqual(t.medianMicros);
    expect(t.meanMicros).toBeGreaterThan(0);
    expect(t.dev).toBe(true);
    expect(measureStepMicros(await loadPack('fixture:story'), { seeds: 0 })).toMatchObject({ steps: 0, medianMicros: 0, meanMicros: 0 });
  });
});

describe('parseBatchArgs', () => {
  test('the defaults are the real pack, 30 seeds, every bot and class', () => {
    expect(parseBatchArgs([])).toEqual({ config: { packs: ['real'], seeds: 30, classes: 'all', bots: 'all' }, quiet: false });
    expect(parseBatchArgs(['batch', '--quiet']).quiet).toBe(true);
  });

  test('every option', () => {
    const { config, quiet } = parseBatchArgs([
      'batch', '--pack', 'fixture:story, fixture:combat', '--seeds', '7', '--seed-prefix', 'q', '--bots', 'melee,caster', '--classes', 'ranger', '--workers', '3', '--max-steps', '900', '--max-loops', '2',
      '--modifiers', 'mod_a,mod_b', '--scripts', 'a.ts#X,b.ts#Y', '--scenario-seeds', '0', '--determinism', '12', '--out', 'o.md', '--json', 'o.json', '--quiet',
    ]);
    expect(quiet).toBe(true);
    expect(config).toEqual({
      packs: ['fixture:story', 'fixture:combat'], seeds: 7, seedPrefix: 'q', bots: ['melee', 'caster'], classes: ['ranger'], workers: 3, maxSteps: 900, maxLoops: 2,
      modifiers: ['mod_a', 'mod_b'], scripts: ['a.ts#X', 'b.ts#Y'], scenarioSeeds: 0, determinism: 12, out: 'o.md', json: 'o.json',
    });
    expect(parseBatchArgs(['--packs', 'fixtures', '--bot', 'all', '--class', 'all']).config).toMatchObject({ packs: ['fixtures'], bots: 'all', classes: 'all' });
    expect(parseBatchArgs(['--scripts', '']).config.scripts).toEqual([]);
  });

  test('a flag without a value, an unknown flag, a stray word and a bad number are usage errors', () => {
    expect(() => parseBatchArgs(['--seeds'])).toThrow('--seeds needs a value');
    expect(() => parseBatchArgs(['--seeds', '--quiet'])).toThrow('--seeds needs a value');
    expect(() => parseBatchArgs(['--wat', '1'])).toThrow('unknown option --wat');
    expect(() => parseBatchArgs(['wat'])).toThrow("unexpected 'wat'");
    expect(() => parseBatchArgs(['--seeds', '0'])).toThrow('--seeds wants a whole number ≥ 1');
    expect(() => parseBatchArgs(['--seeds', '2.5'])).toThrow(UsageError);
    expect(() => parseBatchArgs(['--determinism', 'x'])).toThrow("not 'x'");
    expect(parseBatchArgs(['--determinism', '0']).config.determinism).toBe(0);
  });
});

describe('batchMain', () => {
  const run = async (argv: string[]): Promise<{ code: number; lines: string[] }> => {
    const lines: string[] = [];
    const code = await batchMain(argv, (l) => lines.push(l));
    return { code, lines };
  };
  const common = ['--pack', 'fixture:story', '--seeds', '2', '--bots', 'melee,random', '--classes', 'ranger', '--workers', '1', '--max-steps', '150', '--max-loops', '1', '--scenario-seeds', '0', '--scripts', '', '--determinism', '2'];

  test('writes the report and the raw batch, and says what it did', async () => {
    const dir = tmp();
    const out = path.join(dir, 'deep', 'BALANCE.md');
    const json = path.join(dir, 'batch.json');
    const { code, lines } = await run([...common, '--out', out, '--json', json]);
    expect(code).toBe(0);
    expect(lines[0]?.startsWith('batch: 4 job(s) over 1 pack(s) [fixture:story 4]')).toBe(true);
    expect(lines[0]).toContain('__DEV__ is ON');
    expect(lines.some((l) => l === 'batch: 4/4 job(s)')).toBe(true);
    expect(lines.some((l) => /^fixture:story: 4 run\(s\); targets \d+ pass, \d+ fail, \d+ partial, \d+ n\/a$/.test(l))).toBe(true);
    expect(lines.at(-2)).toMatch(/^batch: 4 run\(s\) in 0m\d\ds on 1 worker\(s\), \d+ µs\/step \(__DEV__ on\), 0 scenario sim\(s\) skipped$/);
    expect(lines.at(-1)).toBe(`batch: 0 blocker(s); wrote ${out}`);
    const md = fs.readFileSync(out, 'utf8');
    expect(md.startsWith('# BALANCE\n')).toBe(true);
    expect(md).toContain('## Targets · fixture:story');
    const raw = JSON.parse(fs.readFileSync(json, 'utf8')) as BatchResult;
    expect(raw.runs).toHaveLength(4);
    expect(raw.runs.every((r) => r.result.trace === undefined)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('--quiet prints the summary only; two workers write the same report body as one', async () => {
    const dir = tmp();
    const a = await run([...common, '--out', path.join(dir, 'a.md'), '--quiet']);
    expect(a.lines).toHaveLength(3);
    await run([...common.map((x, i) => (common[i - 1] === '--workers' ? '2' : x)), '--out', path.join(dir, 'b.md'), '--quiet']);
    const body = (f: string): string => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter((l) => !/^- \*\*(Date|Duration)/.test(l)).join('\n');
    expect(body('b.md')).toBe(body('a.md'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('a blocker makes the exit code 1 and the report names it', async () => {
    const dir = tmp();
    const out = path.join(dir, 'B.md');
    const { code, lines } = await run(['--pack', 'fixture:combat', '--seeds', '1', '--bots', 'caster', '--classes', 'shadow_weaver', '--workers', '1', '--scenario-seeds', '0', '--scripts', '', '--determinism', '0', '--out', out, '--quiet']);
    expect(code).toBe(1);
    expect(lines.at(-1)?.startsWith('batch: 1 blocker(s)')).toBe(true);
    expect(fs.readFileSync(out, 'utf8')).toContain('combat_stall');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('a usage error is exit 2 with the message; any other failure is exit 1', async () => {
    const dir = tmp();
    expect(await run(['--wat', '1'])).toEqual({ code: 2, lines: ['batch: unknown option --wat'] });
    expect((await run([...common, '--pack', 'fixture:nothing', '--out', path.join(dir, 'x.md')])).code).toBe(2);
    expect((await run([...common, '--classes', 'paladin', '--out', path.join(dir, 'x.md')])).code).toBe(2);
    const file = path.join(dir, 'a-file');
    fs.writeFileSync(file, 'x');
    const unwritable = await run([...common, '--out', path.join(file, 'sub', 'B.md'), '--quiet']);
    expect(unwritable.code).toBe(1);
    expect(unwritable.lines).toHaveLength(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('the same job outcome from runJob in every path', () => {
  test('a verified job in this thread and a verified job through the pool agree', async () => {
    const job: Job = { id: 0, pack: 'fixture:story', suite: 'main', seed: 'v:0', classId: 'wizard', bot: 'explorer', stopAt: 'ending', maxSteps: 120, maxLoops: 1, modifiers: [], verify: true };
    const here = await runJob(job, new PackCache());
    const [there] = await execute([job, { ...job, id: 1 }], 2);
    expect(there?.kind === 'run' && there.check).toEqual(here.kind === 'run' ? here.check : undefined);
  });
});
