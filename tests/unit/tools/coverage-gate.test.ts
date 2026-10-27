// tools/coverage-gate.ts: lcov parsing and the per-directory bars of PLAN §1.1.
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BARS, formatRows, gate, main, parseLcov } from '../../../tools/coverage-gate';

const record = (file: string, lf: number, lh: number, fnf: number, fnh: number) =>
  `TN:\nSF:${file}\nFNF:${fnf}\nFNH:${fnh}\nDA:1,1\nLF:${lf}\nLH:${lh}\nend_of_record\n`;

describe('parseLcov', () => {
  test('reads SF/LF/LH/FNF/FNH per record, relative to the root', () => {
    const text = record('src/engine/rng.ts', 10, 9, 4, 4) + record('/repo/tools/lint.ts', 20, 10, 2, 1);
    expect(parseLcov(text, '/repo')).toEqual([
      { file: 'src/engine/rng.ts', linesFound: 10, linesHit: 9, functionsFound: 4, functionsHit: 4 },
      { file: 'tools/lint.ts', linesFound: 20, linesHit: 10, functionsFound: 2, functionsHit: 1 },
    ]);
  });
});

describe('gate', () => {
  test('sums counts per directory and applies line and function bars', () => {
    const files = parseLcov(
      record('src/engine/a.ts', 100, 90, 10, 9) +
        record('src/engine/b.ts', 100, 80, 10, 7) +
        record('src/content/x.ts', 10, 6, 1, 0) +
        record('tools/lint.ts', 10, 0, 1, 0),
    );
    const [all, engine, content, sim] = gate(files);
    expect(all).toMatchObject({ files: 4, lines: 176 / 220, functions: 16 / 22, ok: false });
    expect(engine).toMatchObject({ files: 2, lines: 0.85, functions: 0.8, ok: true });
    expect(content).toMatchObject({ files: 1, lines: 0.6, ok: false });
    expect(sim).toMatchObject({ files: 0, lines: null, functions: null, ok: true });
  });

  test('a function miss fails the engine bar', () => {
    const [all, engine] = gate(parseLcov(record('src/engine/a.ts', 10, 10, 10, 7)));
    expect(all?.ok).toBe(false);
    expect(engine?.ok).toBe(false);
  });

  test('formats an aligned table', () => {
    const lines = formatRows(gate([]));
    expect(lines[0]).toMatch(/^directory\s+files\s+lines\s+functions\s+bar\s+result$/);
    expect(lines).toHaveLength(2 + BARS.length);
    expect(lines[2]).toMatch(/^\(all files\)\s+0\s/);
    expect(lines[3]).toContain('ok (no files)');
  });
});

describe('cli', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-gate-'));

  test('exits 0 when every bar is met', () => {
    const file = path.join(dir, 'ok.info');
    fs.writeFileSync(file, record('src/engine/a.ts', 10, 10, 2, 2));
    const out: string[] = [];
    expect(main(['--lcov', file], (line) => out.push(line))).toBe(0);
    expect(out.at(-1)).toBe('coverage-gate: ok');
  });

  test('exits 1 on a miss and when lcov.info is missing', () => {
    const file = path.join(dir, 'miss.info');
    fs.writeFileSync(file, record('src/sim/runner.ts', 10, 1, 2, 2) + record('tools/x.ts', 90, 90, 2, 2));
    const out: string[] = [];
    expect(main(['--lcov', file], (line) => out.push(line))).toBe(1);
    expect(out.at(-1)).toBe('coverage-gate: 1 bar(s) missed');
    expect(main(['--lcov', path.join(dir, 'absent.info')], (line) => out.push(line))).toBe(1);
    expect(out.at(-1)).toContain('not found');
  });
});
