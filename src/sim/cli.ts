// `npm run sim -- [run] [options]` (PLAN §7, §9.2 U37): plays bots over seeded runs and prints a summary per
// (pack, bot, class), then every blocker (an error or a soft-lock) with the command that reproduces it. Exit 0 = no
// errors and no soft-locks; 1 = at least one; 2 = a usage or configuration error.
//
//   npm run sim -- --bot melee --class ranger --seeds 50 --pack fixture
//   bun src/sim/cli.ts run --bots melee,random --classes all --seeds 20 --pack fixtures --stop-at loop_end
//
// Options (comma lists everywhere a list is taken):
//   --bot/--bots <name,…|all>        default melee                 (registered: bots/index.ts)
//   --class/--classes <id,…|all|auto> default auto (the bot's preferred class the pack has)
//   --seeds <n> [--seed-prefix p]    seeds p:0 … p:n-1 (default 10 seeds, prefix "sim")
//   --seed <s>                       one explicit seed (repeatable; replaces --seeds)
//   --pack <spec,…>                  default fixture. Specs:
//        fixture                       the fixture pack (tests/fixtures/miniContent.ts)
//        fixture:<name>                one fixture pack: FIXTURE_PACKS' keys (horde, story, combat …)
//        fixtures | fixture:all        all nine fixture packs
//        real                          the authored content (src/content, `buildContentPack()`); runs once it has a world
//        <module path>[#export]        any module whose export (default: `default`) is a ContentPack or returns one
//   --stop-at loop_end|ending|max_steps   default ending (with --max-loops, default 3)
//   --max-steps <n>  --max-loops <n>  --scenario <id>  --on-fallen reload|stop  --max-fallen <n>
//   --json <file>                    writes { options, results } (no traces)
//   --verbose                        one line per run
// Packs load at run time by path (`import()`), so the sim layer never imports test code statically and the real pack
// plugs in with no change here.
//
// `quest` (U52) runs the quest proofs of scripts/quests.ts (PLAN §7.8): `npm run sim -- quest [<questId>…] [--pack real] [--verbose]`.
//
// `batch` (U39) plays whole batches on worker threads and writes docs/BALANCE.md — see batch.ts for its options:
//   bun --define __DEV__=false --define __E2E__=true src/sim/cli.ts batch --pack fixtures --seeds 20 --out /tmp/BALANCE.md
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildContentPack, type ContentPack } from '@content/index';
import { BOTS } from './bots/index';
import type { BotFactory } from './bots/types';
import { runLoop, type RunResult, type StopAt } from './runner';
import { SCENARIO_IDS, type ScenarioId } from './scenarios';

export { BOTS };

const ROOT = path.resolve(import.meta.dirname, '..', '..');

/** The fixture packs (tests/fixtures): name → module and factory. */
export const FIXTURE_PACKS: Readonly<Record<string, { file: string; factory: string }>> = {
  fixture: { file: 'tests/fixtures/miniContent.ts', factory: 'fixturePack' },
  combat: { file: 'tests/fixtures/combatContent.ts', factory: 'combatPack' },
  companion: { file: 'tests/fixtures/companionContent.ts', factory: 'companionPack' },
  horde: { file: 'tests/fixtures/hordeContent.ts', factory: 'hordePack' },
  story: { file: 'tests/fixtures/storyContent.ts', factory: 'storyPack' },
  threshold: { file: 'tests/fixtures/thresholdContent.ts', factory: 'thresholdPack' },
  economy: { file: 'tests/fixtures/economyContent.ts', factory: 'economyPack' },
  before: { file: 'tests/fixtures/beforeContent.ts', factory: 'beforePack' },
  before_economy: { file: 'tests/fixtures/economyContent.ts', factory: 'beforeEconomyPack' },
};

export class UsageError extends Error {
  override name = 'UsageError';
}

export interface SimOptions {
  bots: string[];
  /** Class ids, or 'all' / 'auto' (resolved per pack). */
  classes: string[] | 'all' | 'auto';
  seeds: string[];
  packs: string[];
  stopAt: StopAt;
  maxSteps?: number;
  maxLoops?: number;
  scenario?: ScenarioId;
  onFallen?: 'reload' | 'stop';
  maxFallen?: number;
  json?: string;
  verbose: boolean;
}

const STOPS: readonly StopAt[] = ['loop_end', 'ending', 'max_steps'];

const list = (v: string): string[] =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');

function count(flag: string, v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new UsageError(`${flag} wants a whole number ≥ 1, not '${v}'`);
  return n;
}

/** Parses the command line (an optional leading `run`). Throws UsageError. */
export function parseArgs(argv: readonly string[]): SimOptions {
  const args = argv[0] === 'run' ? argv.slice(1) : [...argv];
  const opts: SimOptions = { bots: ['melee'], classes: 'auto', seeds: [], packs: ['fixture'], stopAt: 'ending', verbose: false };
  let seedCount = 10;
  let prefix = 'sim';
  for (let i = 0; i < args.length; i++) {
    const flag = args[i] as string;
    if (flag === '--verbose') {
      opts.verbose = true;
      continue;
    }
    const value = args[i + 1];
    if (!flag.startsWith('--')) throw new UsageError(`unexpected '${flag}'`);
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} needs a value`);
    i += 1;
    switch (flag) {
      case '--bot':
      case '--bots':
        opts.bots = value === 'all' ? Object.keys(BOTS) : list(value);
        for (const b of opts.bots) if (BOTS[b] === undefined) throw new UsageError(`unknown bot '${b}' (available: ${Object.keys(BOTS).join(', ')})`);
        break;
      case '--class':
      case '--classes':
        opts.classes = value === 'all' || value === 'auto' ? value : list(value);
        break;
      case '--seeds':
        seedCount = count(flag, value);
        break;
      case '--seed-prefix':
        prefix = value;
        break;
      case '--seed':
        opts.seeds.push(value);
        break;
      case '--pack':
      case '--packs':
        opts.packs = list(value);
        break;
      case '--stop-at':
        if (!(STOPS as readonly string[]).includes(value)) throw new UsageError(`--stop-at is one of ${STOPS.join(', ')}`);
        opts.stopAt = value as StopAt;
        break;
      case '--max-steps':
        opts.maxSteps = count(flag, value);
        break;
      case '--max-loops':
        opts.maxLoops = count(flag, value);
        break;
      case '--max-fallen':
        opts.maxFallen = count(flag, value);
        break;
      case '--on-fallen':
        if (value !== 'reload' && value !== 'stop') throw new UsageError('--on-fallen is reload or stop');
        opts.onFallen = value;
        break;
      case '--scenario':
        if (!(SCENARIO_IDS as readonly string[]).includes(value)) throw new UsageError(`unknown scenario '${value}' (${SCENARIO_IDS.join(', ')})`);
        opts.scenario = value as ScenarioId;
        break;
      case '--json':
        opts.json = value;
        break;
      default:
        throw new UsageError(`unknown option ${flag}`);
    }
  }
  if (opts.seeds.length === 0) opts.seeds = Array.from({ length: seedCount }, (_, i) => `${prefix}:${i}`);
  return opts;
}

// ---- packs ------------------------------------------------------------------------------------------------------------

/** A pack spec → named packs (see the header). */
export function expandPacks(specs: readonly string[]): string[] {
  const out: string[] = [];
  for (const spec of specs) {
    if (spec === 'fixtures' || spec === 'fixture:all') out.push(...Object.keys(FIXTURE_PACKS).map((k) => (k === 'fixture' ? 'fixture' : `fixture:${k}`)));
    else out.push(spec);
  }
  return [...new Set(out)];
}

const isPack = (v: unknown): v is ContentPack =>
  typeof v === 'object' && v !== null && 'locations' in v && 'classes' in v && 'config' in v && 'index' in v;

async function fromModule(file: string, name: string, label: string): Promise<ContentPack> {
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  const exported = mod[name];
  const pack: unknown = typeof exported === 'function' ? (exported as () => unknown)() : exported;
  if (!isPack(pack)) throw new UsageError(`pack ${label}: '${name}' in ${file} is not a ContentPack (or a function returning one)`);
  return pack;
}

/** Loads one named pack. */
export async function loadPack(spec: string): Promise<ContentPack> {
  if (spec === 'real') return buildContentPack();
  const fixture = spec === 'fixture' ? 'fixture' : spec.startsWith('fixture:') ? spec.slice('fixture:'.length) : undefined;
  if (fixture !== undefined) {
    const def = FIXTURE_PACKS[fixture];
    if (def === undefined) throw new UsageError(`unknown fixture pack '${fixture}' (${Object.keys(FIXTURE_PACKS).join(', ')})`);
    return fromModule(path.join(ROOT, def.file), def.factory, spec);
  }
  const [file = '', name = 'default'] = spec.split('#');
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new UsageError(`unknown pack '${spec}' (fixture, fixture:<name>, fixtures, real, or a module path)`);
  return fromModule(abs, name, spec);
}

// ---- runs ---------------------------------------------------------------------------------------------------------------

export interface PackRun {
  pack: string;
  result: RunResult;
}

/** The classes to run on `pack`. */
export function classesFor(opts: Pick<SimOptions, 'classes'>, pack: ContentPack): string[] {
  if (opts.classes === 'auto') return ['auto'];
  if (opts.classes === 'all') return Object.keys(pack.classes).sort();
  for (const c of opts.classes) if (pack.classes[c] === undefined) throw new UsageError(`the pack has no class '${c}' (${Object.keys(pack.classes).sort().join(', ')})`);
  return opts.classes;
}

/** Every (bot, class, seed) on one pack. */
export function runPack(name: string, pack: ContentPack, opts: SimOptions, onRun: (r: PackRun) => void = () => {}): PackRun[] {
  if (opts.scenario === undefined && pack.locations[pack.config.startLocationId] === undefined) {
    throw new UsageError(`pack ${name}: no start location '${pack.config.startLocationId}' — the pack has no world yet`);
  }
  const out: PackRun[] = [];
  for (const botName of opts.bots) {
    const factory = BOTS[botName] as BotFactory;
    for (const classId of classesFor(opts, pack)) {
      for (const seed of opts.seeds) {
        const result = runLoop(
          {
            seed,
            classId,
            bot: factory(),
            stopAt: opts.stopAt,
            ...(opts.maxSteps === undefined ? {} : { maxSteps: opts.maxSteps }),
            ...(opts.maxLoops === undefined ? {} : { maxLoops: opts.maxLoops }),
            ...(opts.scenario === undefined ? {} : { scenario: opts.scenario }),
            ...(opts.onFallen === undefined ? {} : { onFallen: opts.onFallen }),
            ...(opts.maxFallen === undefined ? {} : { maxFallen: opts.maxFallen }),
          },
          pack,
        );
        const run = { pack: name, result };
        out.push(run);
        onRun(run);
      }
    }
  }
  return out;
}

// ---- report -------------------------------------------------------------------------------------------------------------

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};
const pct = (n: number, d: number): string => (d === 0 ? '—' : `${Math.round((100 * n) / d)}%`);
const tally = (xs: readonly string[]): string => {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
};

/** A run is a blocker when it recorded an error or a soft-lock. */
export const isBlocker = (r: RunResult): boolean => r.errors.length > 0 || r.softLock.detected;

/** One line for a run (`--verbose`). */
export function runLine(r: PackRun): string {
  const x = r.result;
  const loops = x.loops.map((l) => `L${l.loop} ${l.outcome}${l.reason === undefined ? '' : `/${l.reason}`} d${l.daysUsed}`).join(', ');
  const flags = [x.errors.length > 0 ? `${x.errors.length} error(s)` : '', x.softLock.detected ? `soft-lock ${x.softLock.rule ?? ''}` : ''].filter((f) => f !== '');
  return `  ${r.pack} ${x.bot} ${x.classId} ${x.seed}: ${x.steps} steps, stop ${x.stopReason}, loop ${x.final.loop} day ${x.final.day} L${x.final.level}, deaths ${x.deaths}${loops === '' ? '' : ` — ${loops}`}${flags.length > 0 ? ` — ${flags.join(', ')}` : ''}`;
}

/** The summary of one (pack, bot, class) group. */
export function groupLines(pack: string, bot: string, classId: string, runs: readonly RunResult[]): string[] {
  const n = runs.length;
  const loop1 = runs.map((r) => r.loops.find((l) => l.loop === 1));
  const closed = loop1.filter((l) => l !== undefined);
  const escapes = closed.filter((l) => l.outcome === 'closer_escape').length;
  const falls = closed.filter((l) => l.outcome === 'closer_fall');
  const endings = runs.flatMap((r) => r.endings);
  const steps = runs.reduce((t, r) => t + r.steps, 0);
  const ms = runs.reduce((t, r) => t + r.durationMs, 0);
  const blockers = runs.filter(isBlocker).length;
  return [
    `${pack} · ${bot} · ${classId}: ${n} run(s), ${blockers === 0 ? 'no blockers' : `${blockers} BLOCKER(S)`}, stop: ${tally(runs.map((r) => r.stopReason))}`,
    `  Loop 1 closer ${closed.length}/${n} (${pct(closed.length, n)}): escape ${escapes}, fall ${falls.length}${falls.length > 0 ? ` (${tally(falls.map((l) => l.reason ?? 'death'))})` : ''}; FALLEN-stopped ${runs.filter((r) => r.stopReason === 'fallen').length}; median day ${median(closed.map((l) => l.daysUsed))}, median level ${median(closed.map((l) => l.level))}`,
    `  loops/run ${(runs.reduce((t, r) => t + r.loops.length, 0) / Math.max(1, n)).toFixed(2)}, endings ${endings.length === 0 ? 'none' : tally(endings)}, deaths/run ${(runs.reduce((t, r) => t + r.deaths, 0) / Math.max(1, n)).toFixed(2)}, FALLEN/run ${(runs.reduce((t, r) => t + r.fallen, 0) / Math.max(1, n)).toFixed(2)}, median steps ${median(runs.map((r) => r.steps))}, ${steps === 0 ? '—' : `${((1000 * ms) / steps).toFixed(0)} µs/step`}, rejected ${runs.reduce((t, r) => t + r.rejected, 0)}`,
  ];
}

/** The command that replays one run. */
export function reproCommand(r: PackRun, opts: SimOptions): string {
  const x = r.result;
  const parts = ['npm run sim --', `--pack ${r.pack}`, `--bot ${x.bot}`, `--class ${x.classId}`, `--seed ${x.seed}`, `--stop-at ${opts.stopAt}`];
  if (opts.maxSteps !== undefined) parts.push(`--max-steps ${opts.maxSteps}`);
  if (opts.maxLoops !== undefined) parts.push(`--max-loops ${opts.maxLoops}`);
  if (opts.scenario !== undefined) parts.push(`--scenario ${opts.scenario}`);
  if (opts.onFallen !== undefined) parts.push(`--on-fallen ${opts.onFallen}`);
  if (opts.maxFallen !== undefined) parts.push(`--max-fallen ${opts.maxFallen}`);
  return `${parts.join(' ')} --verbose`;
}

/** The blocker lines for one run. */
export function blockerLines(r: PackRun, opts: SimOptions): string[] {
  const x = r.result;
  const out = [`BLOCKER ${r.pack} · ${x.bot} · ${x.classId} · seed ${x.seed} (step ${x.steps}, ${x.final.mode} at ${x.final.locationId}, stop ${x.stopReason})`];
  for (const e of x.errors.slice(0, 5)) out.push(`  error @${e.step}: ${e.message}${e.action === undefined ? '' : ` — ${JSON.stringify(e.action).slice(0, 160)}`}`);
  if (x.errors.length > 5) out.push(`  … ${x.errors.length - 5} more error(s)`);
  if (x.softLock.detected) {
    out.push(`  soft-lock @${x.softLock.step ?? '?'} ${x.softLock.rule ?? ''}: ${x.softLock.detail ?? ''}`);
    out.push(`  last actions: ${(x.softLock.lastActions ?? []).map((a) => a.type).join(' ')}`);
  }
  out.push(`  repro: ${reproCommand(r, opts)}`);
  return out;
}

/** The whole report. */
export function report(runs: readonly PackRun[], opts: SimOptions): string[] {
  const lines: string[] = [];
  const groups = new Map<string, { pack: string; bot: string; classId: string; runs: RunResult[] }>();
  for (const r of runs) {
    const key = `${r.pack}\u0000${r.result.bot}\u0000${r.result.classId}`;
    const g = groups.get(key) ?? { pack: r.pack, bot: r.result.bot, classId: r.result.classId, runs: [] };
    g.runs.push(r.result);
    groups.set(key, g);
  }
  for (const g of groups.values()) lines.push(...groupLines(g.pack, g.bot, g.classId, g.runs));
  const blockers = runs.filter((r) => isBlocker(r.result));
  for (const r of blockers) lines.push(...blockerLines(r, opts));
  const errors = runs.reduce((t, r) => t + r.result.errors.length, 0);
  const locks = runs.filter((r) => r.result.softLock.detected).length;
  lines.push(`sim: ${runs.length} run(s), ${runs.reduce((t, r) => t + r.result.steps, 0)} steps — ${errors} error(s), ${locks} soft-lock(s)`);
  return lines;
}

// ---- main -------------------------------------------------------------------------------------------------------------------

export async function main(argv: readonly string[], write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): Promise<number> {
  if (argv[0] === 'batch') return (await import('./batch')).batchMain(argv.slice(1), write); // loaded on demand: batch.ts imports this module
  if (argv[0] === 'quest') return (await import('./scripts/quests')).questMain(argv.slice(1), write, loadPack); // U52: the quest proofs
  let opts: SimOptions;
  const runs: PackRun[] = [];
  try {
    opts = parseArgs(argv);
    for (const name of expandPacks(opts.packs)) {
      const pack = await loadPack(name);
      runs.push(...runPack(name, pack, opts, (r) => (opts.verbose ? write(runLine(r)) : undefined)));
    }
  } catch (e) {
    write(`sim: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  for (const line of report(runs, opts)) write(line);
  if (opts.json !== undefined) {
    const results = runs.map((r) => {
      const { trace: _trace, ...rest } = r.result;
      return { pack: r.pack, ...rest };
    });
    fs.writeFileSync(opts.json, `${JSON.stringify({ options: opts, results }, null, 2)}\n`);
    write(`sim: wrote ${opts.json}`);
  }
  return runs.some((r) => isBlocker(r.result)) ? 1 : 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
