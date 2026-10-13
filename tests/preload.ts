// bun test preload (bunfig.toml [test].preload; PLAN §3.3, §8.2). Runs once before every test file:
// - builds the fixture pack, so a fixture that stops parsing fails the run at once with the full ContentError report;
// - prints the soft-assertion summary after the run (soft failures fail only with RELEASE_GATE=1; tests/fixtures/soft.ts).
import { afterAll } from 'bun:test';
import { fixturePack } from './fixtures/miniContent';
import { softSummary } from './fixtures/soft';

fixturePack();

afterAll(() => {
  const summary = softSummary();
  if (summary !== null) console.warn(`\n${summary}`);
});
