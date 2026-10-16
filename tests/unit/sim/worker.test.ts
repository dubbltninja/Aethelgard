// U39: one batch job and the worker that runs it (PLAN §7.4) — the in-thread unit both paths share, the determinism check
// (re-run + replay through `step`), the kept trace of a blocker, and the outcomes that are not runs.
import { describe, expect, test } from 'bun:test';
import { meleeBot } from '@sim/bots/melee';
import { UsageError, loadPack } from '@sim/cli';
import { runLoop } from '@sim/runner';
import { PackCache, batchRunOf, handleMessage, loadEndingScripts, replayTrace, reproOf, runJob, type Job, type JobOutcome } from '@sim/worker';

const job = (over: Partial<Job> = {}): Job => ({
  id: 0,
  pack: 'fixture:story',
  suite: 'main',
  seed: 'w:0',
  classId: 'ranger',
  bot: 'melee',
  stopAt: 'ending',
  maxSteps: 400,
  maxLoops: 1,
  modifiers: [],
  verify: false,
  ...over,
});
const SCRIPTS = 'tests/fixtures/scripts/endings.ts';

describe('PackCache and the scripts', () => {
  test('a pack is built once per spec', async () => {
    const cache = new PackCache();
    const a = cache.get('fixture:story');
    expect(cache.get('fixture:story')).toBe(a);
    expect((await a).version).toBeDefined();
    expect(cache.get('fixture:combat')).not.toBe(a);
  });

  test('loadEndingScripts reads a module export, relative to the working directory; a non-array export is a usage error', async () => {
    const scripts = await loadEndingScripts(SCRIPTS, 'FIXTURE_ENDING_SCRIPTS');
    expect(scripts.length).toBeGreaterThan(5);
    expect(scripts.map((s) => s.endingId)).toContain('ending_unbound');
    await expect(loadEndingScripts(SCRIPTS, 'FIXTURE_PACK_FACTORIES')).rejects.toThrow(UsageError);
    await expect(loadEndingScripts(SCRIPTS, 'nothing')).rejects.toThrow('not an EndingScript[]');
  });
});

describe('runJob', () => {
  const cache = new PackCache();

  test('a plain job is one run with no check and no trace', async () => {
    const out = await runJob(job(), cache);
    expect(out.kind).toBe('run');
    if (out.kind !== 'run') return;
    expect(out.check).toBeUndefined();
    expect(out.proof).toBeUndefined();
    expect(out.result.trace).toBeUndefined();
    expect(out.result.steps).toBeGreaterThan(0);
    // the same job again is the same run (the clock aside)
    const again = await runJob(job(), cache);
    expect(again.kind === 'run' && again.result.finalStateHash).toBe(out.result.finalStateHash);
  });

  test('a verified job is re-run with recording and replayed through step: three equal hashes', async () => {
    const out = await runJob(job({ verify: true, bot: 'random' }), cache);
    expect(out.kind).toBe('run');
    if (out.kind !== 'run' || out.check === undefined) throw new Error('no check');
    expect(out.check.rerun).toBe(out.result.finalStateHash);
    expect(out.check.replay).toBe(out.result.finalStateHash);
    expect(out.result.trace).toBeUndefined(); // not a blocker: no trace kept
  });

  test('a soft-locked run keeps its trace, and the trace replays to the same hash', async () => {
    const out = await runJob(job({ pack: 'fixture:combat', classId: 'shadow_weaver', bot: 'caster', seed: 'bal:0', maxSteps: 6000, maxLoops: 3 }), cache);
    expect(out.kind).toBe('run');
    if (out.kind !== 'run' || out.check === undefined) throw new Error('no check');
    expect(out.result.softLock.detected).toBe(true);
    expect(out.result.trace?.length).toBe(out.result.steps);
    expect(out.check.replay).toBe(out.result.finalStateHash);
    expect(out.check.rerun).toBe(out.result.finalStateHash);
  });

  test('a scenario job reaches the runner with its companion; a modifier the pack lacks fails the job', async () => {
    const out = await runJob(job({ pack: 'fixture:companion', scenario: 'first_fight', companionId: 'ilyra', stopAt: 'max_steps', maxSteps: 30 }), cache);
    expect(out.kind === 'run' && out.result.fights[0]?.companion).toBe(true);
    const mods = await runJob(job({ modifiers: ['mod_nope'] }), cache);
    expect(mods).toMatchObject({ kind: 'failed' });
  });

  test('a scenario job is verified too: the replay starts from the scenario the run started from', async () => {
    const out = await runJob(job({ pack: 'fixture:companion', scenario: 'first_fight', companionId: 'ilyra', stopAt: 'max_steps', maxSteps: 40, verify: true }), cache);
    if (out.kind !== 'run' || out.check === undefined) throw new Error('no check');
    expect(out.check).toEqual({ rerun: out.result.finalStateHash, replay: out.result.finalStateHash });
  });

  test('a script job returns the proof, with the script\'s label', async () => {
    const out = await runJob(job({ suite: 'script', bot: 'pathBot', seed: 'script:x', script: { module: SCRIPTS, export: 'FIXTURE_ENDING_SCRIPTS', index: 0 }, maxSteps: 6000 }), cache);
    expect(out.kind).toBe('run');
    if (out.kind !== 'run' || out.proof === undefined) throw new Error('no proof');
    expect(out.proof.label).toMatch(/^closer_escape:the portal after the thirtieth dawn#0$/);
    expect(typeof out.proof.reached).toBe('boolean');
  });

  test('a script that is not there is a failure', async () => {
    const out = await runJob(job({ script: { module: SCRIPTS, export: 'FIXTURE_ENDING_SCRIPTS', index: 999 } }), cache);
    expect(out.kind).toBe('failed');
    expect(out.kind === 'failed' && out.message).toContain('no script #999');
  });

  test('a scenario the pack cannot express, or the class cannot get through, is skipped; an unknown bot or pack fails', async () => {
    const cannot = await runJob(job({ scenario: 'pre_tyrant_l11_ranger' }), cache);
    expect(cannot.kind === 'skipped' && cannot.reason).toContain('unavailable');
    const lost = await runJob(job({ pack: 'fixture:horde', classId: 'elf', scenario: 'pre_tyrant_l11_ranger', stopAt: 'loop_end', maxSteps: 2500 }), cache);
    expect(lost.kind === 'skipped' && lost.reason).toContain('the Wayfinder fell');
    expect(await runJob(job({ bot: 'nobody' }), cache)).toMatchObject({ kind: 'failed', message: "unknown bot 'nobody'" });
    const noPack = await runJob(job({ pack: 'fixture:nothing' }), cache);
    expect(noPack.kind === 'failed' && noPack.message).toContain("unknown fixture pack 'nothing'");
  });
});

describe('replayTrace', () => {
  test('replays the actions of a recorded run from its start; an action that throws ends the replay as threw:<message>', async () => {
    const content = await loadPack('fixture:story');
    const cfg = { seed: 'r:0', classId: 'ranger', bot: meleeBot(), stopAt: 'ending' as const, maxSteps: 200, record: true };
    const run = runLoop(cfg, content);
    const trace = run.trace ?? [];
    expect(replayTrace(trace, cfg, content)).toBe(run.finalStateHash);
    expect(replayTrace([], cfg, content)).not.toBe(run.finalStateHash);
    // a refused action leaves the state as it was
    const refused = replayTrace([{ type: 'flee' }, ...trace], cfg, content);
    expect(refused).toBe(run.finalStateHash);
    // a step that throws ends the replay: the hash says so (and never equals a real one)
    let reads = 0;
    const hostile = new Proxy(content, {
      get(target, key, receiver) {
        reads += 1;
        if (reads === 400) throw new Error('boom');
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    expect(replayTrace(trace, cfg, hostile)).toBe('threw:boom');
  });
});

describe('reproOf and batchRunOf', () => {
  test('a main job repro is a sim:replay command; scenarios and companions are named', () => {
    expect(reproOf(job())).toBe('npm run sim:replay -- --pack fixture:story --bot melee --class ranger --seed w:0 --stop-at ending --max-steps 400 --max-loops 1');
    expect(reproOf(job({ scenario: 'first_fight' }))).toContain('--scenario first_fight');
    expect(reproOf(job({ companionId: 'ilyra' }))).toContain('(with companion ilyra: no CLI flag; use runLoop({ companionId }))');
    expect(reproOf(job({ script: { module: 'm.ts', export: 'S', index: 3 } }))).toBe('runEndingScript(m.ts#S[3]) on --pack fixture:story');
  });

  test('a finished job becomes a BatchRun, with its scenario, companion and proof when it has them', async () => {
    const cache = new PackCache();
    const plain = await runJob(job(), cache);
    if (plain.kind !== 'run') throw new Error('not a run');
    expect(batchRunOf(job(), plain)).toMatchObject({ pack: 'fixture:story', suite: 'main', repro: reproOf(job()), result: plain.result });
    expect(Object.keys(batchRunOf(job(), plain))).not.toContain('scenario');
    const fancy: Extract<JobOutcome, { kind: 'run' }> = { ...plain, proof: { label: 'x#0', reached: true, detail: 'ok' } };
    expect(batchRunOf(job({ scenario: 'first_fight', companionId: 'ilyra' }), fancy)).toMatchObject({ scenario: 'first_fight', companionId: 'ilyra', script: 'x#0', proof: { reached: true, detail: 'ok' } });
  });
});

describe('handleMessage', () => {
  test('posts exactly the outcome of the job', async () => {
    const posted: JobOutcome[] = [];
    await handleMessage(job({ id: 7, bot: 'nobody' }), new PackCache(), (o) => posted.push(o));
    expect(posted).toEqual([{ id: 7, kind: 'failed', message: "unknown bot 'nobody'" }]);
  });
});
