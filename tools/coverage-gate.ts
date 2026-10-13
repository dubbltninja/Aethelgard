// Coverage bars (PLAN §1.1, §3.3), enforced after `bun test` from coverage/lcov.info on summed line/function counts:
// the global floor (all loaded files: lines ≥ 80 %, functions ≥ 75 %) and the per-directory bars.
// The global floor lives here, not in bunfig.toml: bun 1.4.2 applies `coverageThreshold` to EVERY file (verified),
// which would fail any UI file whose event handlers cannot run without a DOM. bun reports lines and functions only;
// branch coverage is not gated (D-066).
//
//   bun tools/coverage-gate.ts [--lcov coverage/lcov.info]
//
// A directory no test loads is reported as "no files" and passes: bun only knows about files that were imported.
import fs from 'node:fs';
import path from 'node:path';

export interface Bar {
  dir: string;
  lines: number;
  functions?: number;
}

export const BARS: readonly Bar[] = [
  { dir: '', lines: 0.8, functions: 0.75 },   // global floor over every file bun loaded
  { dir: 'src/engine/', lines: 0.85, functions: 0.8 },
  { dir: 'src/content/', lines: 0.7 },
  { dir: 'src/sim/', lines: 0.7 },
];

export interface FileCoverage {
  file: string;
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
}

export interface GateRow {
  bar: Bar;
  files: number;
  lines: number | null;
  functions: number | null;
  ok: boolean;
}

export function parseLcov(text: string, root: string = process.cwd()): FileCoverage[] {
  const out: FileCoverage[] = [];
  let current: FileCoverage | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const colon = line.indexOf(':');
    const key = colon >= 0 ? line.slice(0, colon) : line;
    const value = colon >= 0 ? line.slice(colon + 1) : '';
    if (key === 'SF') {
      const file = path.isAbsolute(value) ? path.relative(root, value) : value;
      current = { file: file.split(path.sep).join('/'), linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 };
    } else if (current && key === 'LF') current.linesFound = Number(value);
    else if (current && key === 'LH') current.linesHit = Number(value);
    else if (current && key === 'FNF') current.functionsFound = Number(value);
    else if (current && key === 'FNH') current.functionsHit = Number(value);
    else if (current && key === 'end_of_record') {
      out.push(current);
      current = null;
    }
  }
  return out;
}

const ratio = (hit: number, found: number): number | null => (found === 0 ? null : hit / found);

export function gate(files: readonly FileCoverage[], bars: readonly Bar[] = BARS): GateRow[] {
  return bars.map((bar) => {
    const inDir = files.filter((f) => f.file.startsWith(bar.dir));
    const sum = (pick: (f: FileCoverage) => number) => inDir.reduce((total, f) => total + pick(f), 0);
    const lines = ratio(sum((f) => f.linesHit), sum((f) => f.linesFound));
    const functions = ratio(sum((f) => f.functionsHit), sum((f) => f.functionsFound));
    const linesOk = lines === null || lines >= bar.lines;
    const functionsOk = bar.functions === undefined || functions === null || functions >= bar.functions;
    return { bar, files: inDir.length, lines, functions, ok: linesOk && functionsOk };
  });
}

const pct = (value: number | null): string => (value === null ? '—' : `${(value * 100).toFixed(1)}%`);

export function formatRows(rows: readonly GateRow[]): string[] {
  const header = ['directory', 'files', 'lines', 'functions', 'bar', 'result'];
  const body = rows.map((row) => [
    row.bar.dir || '(all files)',
    String(row.files),
    pct(row.lines),
    pct(row.functions),
    `lines ≥ ${row.bar.lines * 100}%${row.bar.functions === undefined ? '' : `, functions ≥ ${row.bar.functions * 100}%`}`,
    row.files === 0 ? 'ok (no files)' : row.ok ? 'ok' : 'FAIL',
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((cells) => (cells[i] ?? '').length)));
  const fmt = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
  return [fmt(header), fmt(widths.map((w) => '-'.repeat(w))), ...body.map(fmt)];
}

export function main(argv: readonly string[], write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): number {
  const index = argv.indexOf('--lcov');
  const lcov = path.resolve(index >= 0 ? (argv[index + 1] ?? '') : 'coverage/lcov.info');
  if (!fs.existsSync(lcov)) {
    write(`coverage-gate: ${path.relative(process.cwd(), lcov)} not found — run \`bun test\` first`);
    return 1;
  }
  const rows = gate(parseLcov(fs.readFileSync(lcov, 'utf8')));
  for (const line of formatRows(rows)) write(line);
  const failed = rows.filter((row) => !row.ok);
  write(failed.length === 0 ? 'coverage-gate: ok' : `coverage-gate: ${failed.length} bar(s) missed`);
  return failed.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
