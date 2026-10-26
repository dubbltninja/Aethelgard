// Determinism parity (U77; PLAN §8.3 `replay.spec.ts`, §7.4, §8.1): the engine in bun and the engine in a browser reach the same
// state. A trace is recorded by bun (`helpers/recordTrace.ts`: the melee bot on the real content pack from the title, a few
// hundred actions — moves, fights, talks, quests, equips, a reload from the title) together with bun's `finalStateHash`; the
// trace is replayed action by action through the page's real store (`window.__aethelgard.dispatch`, the very function the UI's
// buttons call), and the hash of the state it ends in — the same `stateHash` function, on the state the browser holds —
// must be bun's value, on desktop and on mobile.
//
// What was used: no fixture-pack trace exists in the repository and the browser build carries only the real pack, so the trace
// is recorded at test time on the real pack (never stored, so a content change cannot leave a stale fixture); bun runs it.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { stateHash } from '@engine/util/hash';
import { expect, test } from 'playwright/test';

interface Recorded {
  seed: string;
  classId: string;
  steps: number;
  stopReason: string;
  fallen: number;
  errors: number;
  trace: { type: string }[];
  finalStateHash: string;
}

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function record(seed: string, classId: string, maxSteps: number, profileId: string): Recorded {
  const out = execFileSync('bun', ['tests/e2e/helpers/recordTrace.ts', seed, classId, String(maxSteps), profileId], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
  return JSON.parse(out) as Recorded;
}

const RUNS: { seed: string; classId: string; steps: number }[] = [
  { seed: 'replay-parity', classId: 'ranger', steps: 300 },
  { seed: 'replay-wizard', classId: 'wizard', steps: 300 },
];

test.describe('replay parity', () => {
  for (const run of RUNS) {
    test(`bun's ${run.steps}-step ${run.classId} run replays in the browser to the same state hash`, async ({ page }) => {
      test.setTimeout(120_000);
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(e.message));
      await page.goto('./');
      await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();

      // a loop's seed comes from the profile's id, which a browser makes at random: bun plays the same profile id
      const profileId = await page.evaluate(() => (window as unknown as { __aethelgard: { store: { getProfile(): { profileId: string } } } }).__aethelgard.store.getProfile().profileId);
      const recorded = record(run.seed, run.classId, run.steps, profileId);
      expect(recorded.errors, 'the recorded run had no engine errors').toBe(0);
      expect(recorded.trace.length, 'a trace long enough to mean something').toBeGreaterThan(100);

      // every action through the store's own dispatch; the page reports the first one the engine rejects out of turn
      const replayed = await page.evaluate((trace) => {
        const game = (window as unknown as { __aethelgard: { dispatch(action: unknown): { t: string }[]; state: unknown } }).__aethelgard;
        let rejected = 0;
        for (const action of trace) {
          const events = game.dispatch(action);
          if (events.some((e) => e.t === 'actionRejected')) rejected += 1;
        }
        return { rejected, state: game.state };
      }, recorded.trace);

      expect(problems).toEqual([]);
      expect(replayed.state).toMatchObject({ meta: { loop: expect.any(Number) } });
      const hash = stateHash(replayed.state as Parameters<typeof stateHash>[0]);
      expect(hash, `the browser's state hash after ${recorded.trace.length} actions (bun: ${recorded.finalStateHash}, ${replayed.rejected} rejected)`).toBe(recorded.finalStateHash);
    });
  }
});
