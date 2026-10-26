// Run by bun (`bun tests/e2e/helpers/recordTrace.ts [seed] [classId] [steps]`, U77): plays the melee bot on the REAL content pack
// from the title, records the action trace and prints `{ seed, classId, steps, stopReason, fallen, trace, finalStateHash }` as
// JSON. `replay.spec.ts` replays that trace through the browser's store and compares the hash with this value (PLAN §8.3
// "determinism parity": the engine in bun and in a browser reach the same state). It is recorded at test time, never stored,
// so a content change cannot leave a stale fixture behind.
import { buildContentPack } from '@content/index';
import { meleeBot } from '@sim/bots/melee';
import { runLoop } from '@sim/runner';

const seed = process.argv[2] ?? 'replay-parity';
const classId = process.argv[3] ?? 'ranger';
const maxSteps = Number(process.argv[4] ?? 300);

const result = runLoop({ seed, classId, bot: meleeBot(), stopAt: 'max_steps', maxSteps, record: true, validateEvery: 0 }, buildContentPack());
process.stdout.write(
  JSON.stringify({
    seed,
    classId,
    steps: result.steps,
    stopReason: result.stopReason,
    fallen: result.fallen,
    errors: result.errors.length,
    trace: result.trace,
    finalStateHash: result.finalStateHash,
  }),
);
