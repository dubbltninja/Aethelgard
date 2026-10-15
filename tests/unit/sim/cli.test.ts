// U37: `npm run sim` (src/sim/cli.ts) — argument parsing, pack specs (fixtures by name, all nine, the real pack, any
// module), the summary and the blocker report, exit codes and the JSON dump.
import { afterAll, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { meleeBot } from '@sim/bots/melee';
import {
  BOTS,
  FIXTURE_PACKS,
  UsageError,
  blockerLines,
  classesFor,
  expandPacks,
  groupLines,
  isBlocker,
  loadPack,
  main,
  parseArgs,
  report,
  reproCommand,
  runLine,
  runPack,
  type PackRun,
} from '@sim/cli';
import { runLoop, type RunResult } from '@sim/runner';
import { fixturePack } from '@tests/fixtures/miniContent';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'u37-sim-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

async function run(argv: string[]): Promise<{ code: number; out: string[] }> {
  const out: string[] = [];
  const code = await main(argv, (line) => out.push(line));
  return { code, out };
}

describe('parseArgs', () => {
  test('defaults: melee, auto class, ten seeds, the fixture pack, stop at the ending', () => {
    const o = parseArgs([]);
    expect(o).toMatchObject({ bots: ['melee'], classes: 'auto', packs: ['fixture'], stopAt: 'ending', verbose: false });
    expect(o.seeds).toEqual(Array.from({ length: 10 }, (_, i) => `sim:${i}`));
  });

  test("the brief's command and PLAN's `run` form", () => {
    expect(parseArgs(['--bot', 'melee', '--class', 'ranger', '--seeds', '50', '--pack', 'fixture'])).toMatchObject({ bots: ['melee'], classes: ['ranger'], packs: ['fixture'] });
    expect(parseArgs(['--seeds', '50']).seeds).toHaveLength(50);
    const o = parseArgs(['run', '--bots', 'melee,random', '--classes', 'all', '--seeds', '2', '--seed-prefix', 'x', '--stop-at', 'loop_end', '--verbose']);
    expect(o).toMatchObject({ bots: ['melee', 'random'], classes: 'all', seeds: ['x:0', 'x:1'], stopAt: 'loop_end', verbose: true });
    expect(parseArgs(['--bot', 'all']).bots).toEqual(Object.keys(BOTS));
    expect(parseArgs(['--seed', 'a', '--seed', 'b', '--seeds', '5']).seeds).toEqual(['a', 'b']);
    expect(
      parseArgs(['--max-steps', '9', '--max-loops', '2', '--max-fallen', '3', '--on-fallen', 'stop', '--scenario', 'first_fight', '--json', 'o.json', '--packs', 'fixtures,real']),
    ).toMatchObject({ maxSteps: 9, maxLoops: 2, maxFallen: 3, onFallen: 'stop', scenario: 'first_fight', json: 'o.json', packs: ['fixtures', 'real'] });
  });

  const BAD: readonly (readonly [string[], string])[] = [
    [['--bogus', '1'], 'unknown option --bogus'],
    [['stray'], "unexpected 'stray'"],
    [['--seeds'], '--seeds needs a value'],
    [['--seeds', '--verbose'], '--seeds needs a value'],
    [['--seeds', '0'], 'whole number'],
    [['--max-steps', 'x'], 'whole number'],
    [['--bot', 'caster'], "unknown bot 'caster'"],
    [['--stop-at', 'never'], '--stop-at is one of'],
    [['--on-fallen', 'cry'], '--on-fallen is reload or stop'],
    [['--scenario', 'nope'], "unknown scenario 'nope'"],
  ];
  test.each(BAD)('%j → UsageError', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(UsageError);
    expect(() => parseArgs(argv)).toThrow(message);
  });
});

describe('packs', () => {
  test('fixtures expands to all nine; duplicates collapse', () => {
    const all = expandPacks(['fixtures']);
    expect(all).toHaveLength(Object.keys(FIXTURE_PACKS).length);
    expect(all).toHaveLength(9);
    expect(all[0]).toBe('fixture');
    expect(all).toContain('fixture:horde');
    expect(expandPacks(['fixture', 'fixture:all', 'real'])).toEqual([...all, 'real']);
  });

  test('every fixture pack loads by name; unknown names fail', async () => {
    for (const name of expandPacks(['fixtures'])) {
      const pack = await loadPack(name);
      expect(Object.keys(pack.locations).length).toBeGreaterThan(0);
    }
    expect(await loadPack('fixture')).toBe(fixturePack()); // the module's cached pack
    await expect(loadPack('fixture:nope')).rejects.toThrow("unknown fixture pack 'nope'");
    await expect(loadPack('no/such/file.ts')).rejects.toThrow("unknown pack 'no/such/file.ts'");
  });

  test('the real pack loads (no world yet); a module path loads with its export', async () => {
    expect(Object.keys((await loadPack('real')).locations)).toHaveLength(0);
    const file = path.join(ROOT, 'tests/fixtures/miniContent.ts');
    expect(Object.keys((await loadPack(`${file}#fixturePack`)).locations).length).toBeGreaterThan(0);
    await expect(loadPack(`${file}#FIXTURE_VERSION`)).rejects.toThrow('is not a ContentPack');
  });

  test('classes: auto, all, a list; an unknown class fails', () => {
    const pack = fixturePack();
    expect(classesFor({ classes: 'auto' }, pack)).toEqual(['auto']);
    expect(classesFor({ classes: 'all' }, pack)).toEqual(['ranger', 'wizard']);
    expect(classesFor({ classes: ['wizard'] }, pack)).toEqual(['wizard']);
    expect(() => classesFor({ classes: ['elf'] }, pack)).toThrow("no class 'elf'");
  });
});

describe('main', () => {
  test("the brief's command: a summary, exit 0", async () => {
    const { code, out } = await run(['--bot', 'melee', '--class', 'ranger', '--seeds', '3', '--pack', 'fixture', '--stop-at', 'loop_end']);
    expect(code).toBe(0);
    expect(out[0]).toBe('fixture · melee · ranger: 3 run(s), no blockers, stop: loop_end 3');
    expect(out[1]).toContain('Loop 1 closer 3/3 (100%)');
    expect(out.at(-1)).toMatch(/^sim: 3 run\(s\), \d+ steps — 0 error\(s\), 0 soft-lock\(s\)$/);
  });

  test('--verbose prints a line per run; --json writes the results without traces', async () => {
    const json = path.join(tmp, 'out.json');
    const { code, out } = await run(['--bots', 'melee,random', '--seeds', '2', '--max-steps', '50', '--stop-at', 'max_steps', '--verbose', '--json', json]);
    expect(code).toBe(0);
    expect(out.filter((l) => l.startsWith('  fixture '))).toHaveLength(4);
    expect(out.at(-1)).toBe(`sim: wrote ${json}`);
    const data = JSON.parse(fs.readFileSync(json, 'utf8')) as { options: unknown; results: (RunResult & { pack: string })[] };
    expect(data.results).toHaveLength(4);
    expect(data.results[0]).toMatchObject({ pack: 'fixture', bot: 'melee', steps: 50 });
    expect(data.results[0]?.trace).toBeUndefined();
  });

  test('configuration errors exit 2: the real pack has no world, an unknown bot', async () => {
    const real = await run(['--pack', 'real', '--seeds', '1']);
    expect(real.code).toBe(2);
    expect(real.out[0]).toContain('no start location');
    expect((await run(['--bot', 'caster'])).code).toBe(2);
  });

  test('a blocker exits 1 and prints its repro command', async () => {
    const file = path.join(tmp, 'broken.ts');
    const fixture = path.join(ROOT, 'tests/fixtures/miniContent.ts');
    fs.writeFileSync(file, `import { fixturePack } from ${JSON.stringify(fixture)};\nexport const broken = () => ({ ...fixturePack(), creatures: {} });\n`);
    const { code, out } = await run(['--pack', `${file}#broken`, '--seeds', '1', '--stop-at', 'loop_end']);
    expect(code).toBe(1);
    const at = out.findIndex((l) => l.startsWith('BLOCKER '));
    expect(at).toBeGreaterThan(0);
    expect(out[at + 1]).toMatch(/error @\d+: step threw on move/);
    expect(out.find((l) => l.includes('repro: '))).toContain(`npm run sim -- --pack ${file}#broken --bot melee --class ranger --seed sim:0 --stop-at loop_end --verbose`);
  });
});

describe('report pieces', () => {
  const pack = fixturePack();
  const opts = parseArgs(['--seeds', '1', '--max-steps', '7', '--max-loops', '2', '--scenario', 'first_fight', '--on-fallen', 'stop', '--max-fallen', '4']);
  const base = runLoop({ seed: 'r', classId: 'ranger', bot: meleeBot(), maxSteps: 60, stopAt: 'loop_end' }, pack);

  test('runPack runs every bot × class × seed and reports each', () => {
    const seen: PackRun[] = [];
    const runs = runPack('fixture', pack, { ...parseArgs(['--bots', 'all', '--classes', 'all', '--seeds', '1', '--max-steps', '20', '--stop-at', 'max_steps']) }, (r) => seen.push(r));
    expect(runs).toHaveLength(Object.keys(BOTS).length * 2);
    expect(seen).toEqual(runs);
  });

  test('a run with an error and a soft-lock is a blocker with both, and its repro carries every option', () => {
    const bad: RunResult = {
      ...base,
      errors: Array.from({ length: 6 }, (_, i) => ({ step: i, message: `e${i}`, action: { type: 'wait' } })),
      softLock: { detected: true, step: 9, rule: 'stall', detail: 'stuck', lastActions: [{ type: 'wait' }] },
    };
    expect(isBlocker(base)).toBe(false);
    expect(isBlocker(bad)).toBe(true);
    const lines = blockerLines({ pack: 'fixture', result: bad }, opts);
    expect(lines[0]).toMatch(/^BLOCKER fixture · melee · ranger · seed r /);
    expect(lines.filter((l) => l.startsWith('  error @'))).toHaveLength(5);
    expect(lines).toContain('  … 1 more error(s)');
    expect(lines).toContain('  soft-lock @9 stall: stuck');
    expect(lines).toContain('  last actions: wait');
    expect(reproCommand({ pack: 'fixture', result: bad }, opts)).toBe(
      'npm run sim -- --pack fixture --bot melee --class ranger --seed r --stop-at ending --max-steps 7 --max-loops 2 --scenario first_fight --on-fallen stop --max-fallen 4 --verbose',
    );
    expect(runLine({ pack: 'fixture', result: bad })).toContain('6 error(s), soft-lock stall');
    const all = report([{ pack: 'fixture', result: base }, { pack: 'fixture', result: bad }], opts);
    expect(all[0]).toContain('2 run(s), 1 BLOCKER(S)');
    expect(all.at(-1)).toContain('6 error(s), 1 soft-lock(s)');
  });

  test('group lines: closers, falls by reason, FALLEN stops', () => {
    const fall: RunResult = { ...base, loops: [{ ...(base.loops[0] as RunResult['loops'][number]), outcome: 'closer_fall', reason: 'expiry' }], stopReason: 'fallen', fallen: 2 };
    const none: RunResult = { ...base, loops: [], endings: ['ending_mending'] };
    const lines = groupLines('p', 'melee', 'ranger', [base, fall, none]);
    expect(lines[1]).toContain('Loop 1 closer 2/3 (67%): escape 1, fall 1 (expiry 1); FALLEN-stopped 1');
    expect(lines[2]).toContain('endings ending_mending 1');
    expect(groupLines('p', 'melee', 'ranger', [])[1]).toContain('closer 0/0 (—)');
  });
});
