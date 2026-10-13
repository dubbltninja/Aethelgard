// tools/lint.ts fixture test (PLAN §2.3, §3.4): every rule catches its fixture, clean files pass, so no rule can
// rot silently. Fixtures: tests/fixtures/lint/ (a miniature repo tree; see its README).
import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { REPO_ROOT, RULES, formatFinding, layerOf, lint, main, type Finding, type RuleName } from '../../../tools/lint';

const FIXTURES = path.join(REPO_ROOT, 'tests/fixtures/lint');
const { files, findings } = lint({ root: FIXTURES });

/** Fixture file → the one rule it violates (each at least once, and nothing else). */
const EXPECTED: Record<string, RuleName> = {
  'src/engine/layers.ts': 'layers',
  'src/engine/cycle-b.ts': 'layers',
  'src/audio/layers.ts': 'layers',
  'src/content/layers-package.ts': 'layers',
  'src/engine/engine-purity.ts': 'engine-purity',
  'src/content/no-console.ts': 'no-console',
  'src/ui/no-explicit-any.ts': 'no-explicit-any',
  'tests/no-focused-tests.test.ts': 'no-focused-tests',
  'tools/no-debugger.ts': 'no-debugger',
  'src/ui/no-ts-ignore.ts': 'no-ts-ignore',
  'tests/no-ts-ignore.test.ts': 'no-ts-ignore',
  'src/content/content-literals.ts': 'content-literals',
  'src/ui/whitespace.ts': 'whitespace',
  'src/ui/whitespace-eof.css': 'whitespace',
};

const CLEAN = [
  'src/engine/clean.ts',
  'src/engine/helper.ts',
  'src/engine/types/events.ts',
  'src/engine/cycle-a.ts',
  'src/content/regions/locations.ts',
  'src/content/schema/item.ts',
  'src/ui/clean.tsx',
  'src/audio/clean.ts',
  'src/types/clean.d.ts',
  'tests/clean.test.ts',
];

const byFile = (file: string): Finding[] => findings.filter((f) => f.file === file);
const messages = (file: string): string[] => byFile(file).map((f) => f.message);

describe('lint fixtures', () => {
  test('walks the whole fixture tree', () => {
    expect(files).toBe(Object.keys(EXPECTED).length + CLEAN.length);
  });

  test('every rule has at least one fixture', () => {
    const covered = new Set(Object.values(EXPECTED));
    expect([...RULES].filter((rule) => !covered.has(rule))).toEqual([]);
  });

  test.each(Object.entries(EXPECTED))('%s is caught by %s and nothing else', (file, rule) => {
    const found = byFile(file);
    expect(found.length).toBeGreaterThan(0);
    expect([...new Set(found.map((f) => f.rule))]).toEqual([rule]);
  });

  test.each(CLEAN)('%s is clean', (file) => {
    expect(byFile(file).map(formatFinding)).toEqual([]);
  });

  test('no findings outside the expected files', () => {
    const unexpected = findings.filter((f) => !(f.file in EXPECTED));
    expect(unexpected.map(formatFinding)).toEqual([]);
  });
});

describe('rule details', () => {
  test('layers: forbidden edges via alias and relative paths, bare packages, and engine cycles', () => {
    expect(messages('src/engine/layers.ts')).toEqual([
      "engine must not import ui ('@ui/App', PLAN §2.1)",
      "engine must not import content ('../content/regions/locations', PLAN §2.1)",
    ]);
    expect(messages('src/audio/layers.ts')).toHaveLength(2);
    expect(messages('src/content/layers-package.ts')).toEqual(["content may import only zod — not 'react'"]);
    expect(messages('src/engine/cycle-b.ts')).toEqual([
      'import cycle in src/engine: src/engine/cycle-a.ts → src/engine/cycle-b.ts → src/engine/cycle-a.ts',
    ]);
  });

  test('engine-purity: entropy, clock, DOM, timers, storage and package imports', () => {
    const text = messages('src/engine/engine-purity.ts').join('\n');
    for (const needle of ["'react'", "'node:fs'", 'Math.random', 'Date.now', '`Date` construction', 'window', 'setTimeout', 'localStorage', 'performance']) {
      expect(text).toContain(needle);
    }
  });

  test('no-focused-tests: describe.only and test.only', () => {
    expect(messages('tests/no-focused-tests.test.ts')).toEqual(['focused test `describe.only`', 'focused test `test.only`']);
  });

  test('no-ts-ignore: @ts-ignore anywhere, @ts-expect-error only in tests and only with a reason', () => {
    expect(messages('src/ui/no-ts-ignore.ts')).toEqual([
      '`@ts-ignore` hides type errors; fix the type instead',
      '`@ts-expect-error` is allowed only in tests/',
    ]);
    expect(messages('tests/no-ts-ignore.test.ts')).toEqual(['`@ts-expect-error` needs a reason after it']);
  });

  test('content-literals: only top-level table ids are checked', () => {
    const found = messages('src/content/content-literals.ts');
    expect(found).toHaveLength(2);
    expect(found[0]).toContain("'rusty_dagger'");
    expect(found[1]).toContain("'Region_Mistwood'");
  });

  test('whitespace: trailing, tabs, CRLF, final newline, blank lines at EOF', () => {
    expect(byFile('src/ui/whitespace.ts').map((f) => `${f.line} ${f.message}`)).toEqual([
      '1 trailing whitespace',
      '2 CRLF / CR line ending (use LF)',
      '2 tab indentation (indent with 2 spaces)',
      '3 missing final newline',
    ]);
    expect(byFile('src/ui/whitespace-eof.css').map((f) => `${f.line} ${f.message}`)).toEqual(['4 blank line(s) at end of file']);
  });

  test('layerOf maps paths to layers', () => {
    expect(layerOf('src/content/schema/item.ts')).toBe('schema');
    expect(layerOf('src/content/shared/classes.ts')).toBe('content');
    expect(layerOf('src/main.tsx')).toBe('app');
    expect(layerOf('tests/unit/x.test.ts')).toBeNull();
  });
});

describe('cli', () => {
  test('prints `path:line:col rule message` lines and exits 1 on findings', () => {
    const lines: string[] = [];
    expect(main(['--root', FIXTURES], (line) => lines.push(line))).toBe(1);
    expect(lines).toContain('tools/no-debugger.ts:2:3 no-debugger `debugger` statement');
    expect(lines.at(-1)).toBe(`lint: ${findings.length} problem(s) in ${files} files`);
  });

  test('exits 0 on a clean tree', () => {
    const lines: string[] = [];
    expect(main(['--root', path.join(FIXTURES, 'src/types')], (line) => lines.push(line))).toBe(0);
    expect(lines.at(-1)).toBe(`lint: ok — 0 files, ${RULES.length} rules`);
  });
});
