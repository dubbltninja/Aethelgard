// Determinism parity (PLAN §1.2 "Determinism", §7.4, §8.3 `replay.spec.ts`; U77, D-138; U79): the engine in bun and the
// engine in a browser reach the same state. U79 switched this spec from traces recorded at test time to the COMMITTED
// real-pack traces in tests/fixtures/traces/ (`real-*.json`: a short Loop 1 per class and one Loop 2), the same files
// tests/unit/sim/traces.test.ts replays in bun against the same recorded `finalStateHash`.
//
// Each trace starts where bun's replay starts: `bun tools/record-traces.ts --start <name>` prints the trace's start
// `{ state, profile }` (the title with a fresh profile whose id is the trace's seed, or the scenario's state), which boots
// through the e2e build's `?start=session` seam (src/main.tsx). Every action then goes through the page's real store
// (`window.__aethelgard.dispatch`, the very function the UI's buttons call), and the `stateHash` of the state the browser
// ends in must be the recorded one, on desktop and on mobile. A stale trace fails here and in bun alike: re-record it
// (`bun tools/record-traces.ts`) in the commit that changed the engine or content, as traces.test.ts says.
//
// The browser build carries only the real pack, so the fixture-pack traces are replayed in bun only.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { stateHash } from '@engine/util/hash';
import { expect, test } from 'playwright/test';

interface Trace {
  name: string;
  pack: string;
  steps: number;
  final: { loop: number; mode: string; locationId: string };
  finalStateHash: string;
  trace: { type: string }[];
}

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIR = path.join(ROOT, 'tests', 'fixtures', 'traces');
const TRACES: Trace[] = readdirSync(DIR)
  .filter((f) => f.startsWith('real-') && f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as Trace)
  .filter((t) => t.pack === 'real');

/** The trace's start state and profile, from bun (the real content pack is built there, as in traces.test.ts). */
function startOf(name: string): string {
  return execFileSync('bun', ['tools/record-traces.ts', '--start', name], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
}

test.describe('replay parity', () => {
  test('the committed real-pack traces are there (one per class and a Loop 2)', () => {
    expect(TRACES.length).toBeGreaterThanOrEqual(6);
    expect(TRACES.some((t) => t.final.loop === 2 && t.name.includes('loop2'))).toBe(true);
  });

  for (const trace of TRACES) {
    test(`${trace.name}: ${trace.steps} recorded actions replay in the browser to bun's state hash`, async ({ page }) => {
      test.setTimeout(120_000);
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(e.message));
      await page.goto('./');
      await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
      const start = startOf(trace.name);
      await page.evaluate((text) => sessionStorage.setItem('aethelgard.e2e.start', text), start);
      await page.goto('./?start=session');
      await page.waitForFunction(() => (window as unknown as { __aethelgard?: { state?: unknown } }).__aethelgard?.state !== undefined);

      // every action through the store's own dispatch
      const replayed = await page.evaluate((actions) => {
        const game = (window as unknown as { __aethelgard: { dispatch(action: unknown): { t: string }[]; state: unknown } }).__aethelgard;
        let rejected = 0;
        for (const action of actions) {
          const events = game.dispatch(action);
          if (events.some((e) => e.t === 'actionRejected')) rejected += 1;
        }
        return { rejected, state: game.state };
      }, trace.trace);

      expect(problems).toEqual([]);
      const state = replayed.state as Parameters<typeof stateHash>[0];
      expect({ loop: state.meta.loop, mode: state.mode, locationId: state.world.currentLocationId }).toEqual({
        loop: trace.final.loop,
        mode: trace.final.mode,
        locationId: trace.final.locationId,
      });
      expect(stateHash(state), `the browser's state hash after ${trace.trace.length} actions (${replayed.rejected} rejected)`).toBe(trace.finalStateHash);
    });
  }
});
