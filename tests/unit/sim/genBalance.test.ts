// U39: `tools/gen-balance.ts` — the entry point of `npm run sim:balance` (PLAN §7.9). The module exposes `main` (the same
// command as `sim batch`), and the script itself runs under bun with `__DEV__` off and `__E2E__` on, as the package script does.
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { batchMain } from '@sim/batch';
import { main } from '../../../tools/gen-balance';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const ARGS = ['--pack', 'fixture:story', '--seeds', '1', '--bots', 'melee', '--classes', 'ranger', '--workers', '1', '--max-steps', '100', '--max-loops', '1', '--scenario-seeds', '0', '--scripts', '', '--determinism', '1'];

describe('tools/gen-balance.ts', () => {
  test('exports the batch command as main', async () => {
    expect(main).toBe(batchMain);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u39-gen-'));
    const out = path.join(dir, 'BALANCE.md');
    expect(await main([...ARGS, '--out', out, '--quiet'], () => {})).toBe(0);
    expect(fs.readFileSync(out, 'utf8')).toContain('## Recommendations · fixture:story');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('as a script, with the package script\'s defines: __DEV__ off, a report on disk, exit 0; a usage error exits 2', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u39-gen-'));
    const out = path.join(dir, 'BALANCE.md');
    const scripts = (JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
    expect(scripts['sim:balance']).toBe('bun --define __DEV__=false --define __E2E__=true tools/gen-balance.ts');
    const run = (args: string[]): { code: number; text: string } => {
      const p = spawnSync('bun', ['--define', '__DEV__=false', '--define', '__E2E__=true', 'tools/gen-balance.ts', ...args], { cwd: ROOT, encoding: 'utf8' });
      return { code: p.status ?? -1, text: `${p.stdout}${p.stderr}` };
    };
    const ok = run([...ARGS, '--out', out]);
    expect(ok.code).toBe(0);
    expect(ok.text).toContain('(__DEV__ off)');
    expect(ok.text).not.toContain('__DEV__ is ON');
    expect(fs.readFileSync(out, 'utf8')).toContain('with `__DEV__` off');
    const bad = run(['--wat', '1']);
    expect(bad.code).toBe(2);
    expect(bad.text).toContain('unknown option --wat');
    fs.rmSync(dir, { recursive: true, force: true });
  }, 60_000);
});
