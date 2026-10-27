// U39: the step budget of PLAN §7.4 — the median `step` on a fixture pack stays at or under 400 µs, measured with `__DEV__` off
// (D-086: under `__DEV__` a step deep-freezes its result and costs 0.65–0.9 ms, so the batch runs without it). The number is
// measured in a subprocess started with the production define, the way `npm run sim:balance` runs; the `__DEV__` number of this
// process is logged for the record.
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { measureStepMicros, type StepTiming } from '@sim/batch';
import { loadPack } from '@sim/cli';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const BUDGET_MICROS = 400;

/** One timing in a fresh `bun` with `__DEV__` off; the best of up to three medians (a loaded machine only ever adds time). */
function measureWithoutDev(pack: string): StepTiming {
  const script = `
    import { measureStepMicros } from '@sim/batch';
    import { loadPack } from '@sim/cli';
    const content = await loadPack(${JSON.stringify(pack)});
    measureStepMicros(content, { seeds: 1, maxSteps: 200 }); // warm-up
    console.log(JSON.stringify(measureStepMicros(content, { seeds: 4, maxSteps: 500 })));
  `;
  let best: StepTiming | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const p = spawnSync('bun', ['--define', '__DEV__=false', '--define', '__E2E__=true', '-e', script], { cwd: ROOT, encoding: 'utf8' });
    if (p.status !== 0) throw new Error(`perf subprocess failed (${String(p.status)}): ${p.stderr}`);
    const timing = JSON.parse(p.stdout.trim().split('\n').at(-1) ?? '') as StepTiming;
    if (best === undefined || timing.medianMicros < best.medianMicros) best = timing;
    if (best.medianMicros <= BUDGET_MICROS) break;
  }
  return best as StepTiming;
}

describe('step cost (PLAN §7.4)', () => {
  test('the median step on a fixture pack is at most 400 µs with __DEV__ off', () => {
    const off = measureWithoutDev('fixture:story');
    console.log(`perf: fixture:story step median ${off.medianMicros.toFixed(0)} µs, p90 ${off.p90Micros.toFixed(0)} µs, mean ${off.meanMicros.toFixed(0)} µs over ${off.steps} steps (__DEV__ off)`);
    expect(off.dev).toBe(false);
    expect(off.steps).toBeGreaterThan(1000);
    expect(off.medianMicros).toBeLessThanOrEqual(BUDGET_MICROS);
  }, 120_000);

  test('the __DEV__-on number of this process is measured for the record (deep-freezing costs more, never less than nothing)', async () => {
    const on = measureStepMicros(await loadPack('fixture:story'), { seeds: 2, maxSteps: 300 });
    console.log(`perf: fixture:story step median ${on.medianMicros.toFixed(0)} µs, p90 ${on.p90Micros.toFixed(0)} µs over ${on.steps} steps (__DEV__ on)`);
    expect(on.dev).toBe(true);
    expect(on.steps).toBeGreaterThan(300);
    expect(on.medianMicros).toBeGreaterThan(0);
  }, 60_000);
});
