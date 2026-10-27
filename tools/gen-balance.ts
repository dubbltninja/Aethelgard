// `npm run sim:balance` (PLAN §7.9): plays the batch and writes docs/BALANCE.md.
//
//   npm run sim:balance -- --pack fixtures --seeds 20 --out /tmp/BALANCE.md
//   npm run sim:balance                                   (the real pack, 30 seeds, docs/BALANCE.md)
//
// The package script runs bun with `--define __DEV__=false --define __E2E__=true`: with `__DEV__` on every step deep-freezes its
// result (0.65–0.9 ms against ~0.25 ms), and `__E2E__` keeps `loadScenario` (the pre-Tyrant sims) available. All options are
// documented in src/sim/batch.ts; do not commit a BALANCE.md generated from the fixture packs.
import { batchMain } from '../src/sim/batch';

export { batchMain as main };

if (import.meta.main) process.exit(await batchMain(process.argv.slice(2)));
