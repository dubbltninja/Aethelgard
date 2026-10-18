// The `?scenario=` boot (U64; D-104 ruling 1, PLAN §4.13, §6.2): main.tsx — the app layer, and only it — imports the
// scenario builders, behind `__DEV__ || __E2E__`; `bootGame({ start })` starts the store in the scenario's state with
// the player's own settings; the lint allows exactly that one import; and a production bundle of the real entry keeps
// none of the builders while the e2e bundle has them (the build gate, as U36's dev-gate test does for a probe).
import { describe, expect, test } from 'bun:test';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { memoryStorage } from '@engine/index';
import { bootGame } from '@ui/boot';
import { fixturePack } from '@tests/fixtures/miniContent';
import { scenarioStart } from '../../../src/main';
import { ROOT, esbuildOptions } from '../../../tools/build';
import { APP_SCENARIOS, lint } from '../../../tools/lint';

const content = fixturePack();

describe('scenarioStart (dev and test builds)', () => {
  test('no id, no scenario; an unknown id is an error naming the known ones', () => {
    expect(scenarioStart('')).toBeUndefined();
    expect(scenarioStart('?scenario=')).toBeUndefined();
    expect(scenarioStart('?other=1')).toBeUndefined();
    expect(() => scenarioStart('?scenario=nowhere')).toThrow("unknown scenario 'nowhere' (known: loop1_day1, ");
  });

  test('a known id builds the scenario on the booted pack', () => {
    const start = scenarioStart('?scenario=first_fight');
    expect(start).toBeDefined();
    const built = start?.(content);
    expect(built?.state.mode).toBe('combat');
  });
});

describe('bootGame({ start })', () => {
  test('the store starts in the scenario’s state and profile, keeping the player’s settings', () => {
    const storage = memoryStorage();
    const first = bootGame({ content, storage });
    first.store.shell.updateSettings({ highContrast: true });
    const start = scenarioStart('?scenario=expiry_minus_1');
    const { store } = bootGame({ content, storage, start });
    expect(store.getState().mode).toBe('explore');
    expect(store.getState().clock.ticks).toBe(store.getState().clock.limitTicks - 1);
    expect(store.getProfile().settings.highContrast).toBe(true);
    // without a start the title, as before
    expect(bootGame({ content, storage: memoryStorage() }).store.getState().mode).toBe('title');
  });
});

describe('lint: only the app layer may import the scenario builders', () => {
  function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'u64-lint-'));
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    return root;
  }

  test('main.tsx → @sim/scenarios is allowed; the runner, and any ui import of sim, are not', () => {
    expect(APP_SCENARIOS).toBe('src/sim/scenarios.ts');
    const root = tree({
      'src/sim/scenarios.ts': 'export const loadScenario = 1;\n',
      'src/sim/runner.ts': 'export const runLoop = 1;\n',
      'src/main.tsx': "import { loadScenario } from '@sim/scenarios';\nimport { runLoop } from '@sim/runner';\nexport const x = [loadScenario, runLoop];\n",
      'src/ui/screen.ts': "import { loadScenario } from '@sim/scenarios';\nexport const y = loadScenario;\n",
    });
    try {
      const { findings } = lint({ root, aliases: { '@sim/*': 'src/sim/*', '@ui/*': 'src/ui/*' } });
      const layers = findings.filter((f) => f.rule === 'layers').map((f) => `${f.file}:${f.line}`);
      expect(layers).toEqual(['src/main.tsx:2', 'src/ui/screen.ts:1']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('the build gate: production drops the builders, e2e keeps them', () => {
  async function bundle(mode: 'production' | 'e2e'): Promise<string> {
    const { outdir: _outdir, sourcemap: _map, entryNames: _names, assetNames: _assets, metafile: _meta, entryPoints: _entry, ...base } = esbuildOptions({
      root: ROOT,
      entry: 'src/main.tsx',
      assetsDir: path.join(ROOT, 'unused'),
      mode,
      version: 'test',
    });
    const out = await esbuild.build({ ...base, entryPoints: ['src/main.tsx'], write: false, outdir: path.join(ROOT, 'unused'), logLevel: 'silent' });
    return out.outputFiles.filter((f) => f.path.endsWith('.js')).map((f) => f.text).join('\n');
  }

  const MARKER = 'pre_tyrant_l13_ranger'; // a string only the scenario registry contains

  test('src/main.tsx in production has no scenario registry and no scenario hook', async () => {
    const js = await bundle('production');
    expect(js).not.toContain(MARKER);
    expect(js).not.toContain('unknown scenario');
  }, 120_000);

  test('src/main.tsx in e2e has both', async () => {
    const js = await bundle('e2e');
    expect(js).toContain(MARKER);
    expect(js).toContain('unknown scenario');
  }, 120_000);
});
