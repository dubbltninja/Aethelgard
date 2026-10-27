// U79: the determinism gate in bun (PLAN §1.2 "Determinism", §7.4, §8.1). Every committed trace in
// tests/fixtures/traces/ is replayed action by action through `step` from its start, and must reach the recorded
// `finalStateHash`; tests/e2e/replay.spec.ts replays the real-pack traces in the browser against the same hashes.
//
// THE RULE: a trace is a recorded fact about the engine. When an engine or content change moves a hash ON PURPOSE,
// re-record the affected traces (`bun tools/record-traces.ts [names…]`, which prints old → new hashes) IN THE SAME
// COMMIT as the change, and give the reason in the commit message. Never re-record to make an unexplained mismatch go
// away: an unexplained mismatch is nondeterminism, a release blocker. Fixture-pack traces should move only with the
// engine or their pack; real-pack traces also move with content tuning (D-141: U81a/U81b re-record them).
import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import type { ContentPack } from '@engine/index';
import { TRACE_DIR, TRACE_FORMAT, TRACE_PACKS, TRACE_SPECS, replayTrace, tracePath, traceText, type TraceFile, type TracePack } from '@tests/fixtures/traces/traces';

const files: TraceFile[] = TRACE_SPECS.map((spec) => JSON.parse(readFileSync(tracePath(spec.name), 'utf8')) as TraceFile);

const packs = new Map<TracePack, ContentPack>();
const packOf = (id: TracePack): ContentPack => {
  const hit = packs.get(id);
  if (hit !== undefined) return hit;
  const built = TRACE_PACKS[id]();
  packs.set(id, built);
  return built;
};

describe('the committed traces', () => {
  test('one file per spec, nothing else, each in the committed layout', () => {
    const onDisk = readdirSync(TRACE_DIR).filter((f) => f.endsWith('.json')).sort();
    expect(onDisk).toEqual(TRACE_SPECS.map((s) => `${s.name}.json`).sort());
    for (const file of files) {
      expect(file.format).toBe(TRACE_FORMAT);
      expect(readFileSync(tracePath(file.name), 'utf8')).toBe(traceText(file));
      expect(file.trace.length).toBe(file.steps);
    }
  });

  test('they cover every fixture pack, every class on the real pack, and a real Loop 2', () => {
    expect(new Set(files.map((f) => f.pack))).toEqual(new Set(Object.keys(TRACE_PACKS) as TracePack[]));
    const real = files.filter((f) => f.pack === 'real');
    expect(new Set(real.map((f) => f.classId))).toEqual(new Set(Object.keys(packOf('real').classes)));
    expect(real.some((f) => f.scenario === 'loop2_day1' && f.final.loop === 2)).toBe(true);
    expect(files.filter((f) => f.pack !== 'real').length).toBeGreaterThanOrEqual(2 * (Object.keys(TRACE_PACKS).length - 1) - 2);
  });
});

describe('replay reaches the recorded state hash', () => {
  for (const file of files) {
    test(`${file.name} (${file.pack} pack, ${file.bot} bot, ${file.steps} actions)`, () => {
      const out = replayTrace(file, packOf(file.pack));
      expect({ loop: out.state.meta.loop, mode: out.state.mode, locationId: out.state.world.currentLocationId }).toEqual({
        loop: file.final.loop,
        mode: file.final.mode,
        locationId: file.final.locationId,
      });
      expect(out.hash).toBe(file.finalStateHash);
    }, 60_000);
  }

  test('replaying twice is identical (no hidden state between replays)', () => {
    const file = files.find((f) => f.name === 'fixture-random') as TraceFile;
    const a = replayTrace(file, packOf(file.pack));
    const b = replayTrace(file, packOf(file.pack));
    expect(b.hash).toBe(a.hash);
    expect(b.rejected).toBe(a.rejected);
    expect(b.profile).toEqual(a.profile);
  });

  test('a changed action changes the hash (the check can fail)', () => {
    const file = files.find((f) => f.name === 'fixture-melee-ranger') as TraceFile;
    const cut = { ...file, trace: file.trace.slice(0, -1) };
    expect(replayTrace(cut, packOf(file.pack)).hash).not.toBe(file.finalStateHash);
  });
});
