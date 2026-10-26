// U79: (re)records the committed determinism traces (tests/fixtures/traces/traces.ts) and prints what changed.
//
//   bun tools/record-traces.ts                 record every trace in TRACE_SPECS, report old → new hashes
//   bun tools/record-traces.ts real-ranger …   only the named traces
//   bun tools/record-traces.ts --pack real     only one pack's traces
//   bun tools/record-traces.ts --start NAME    print the trace's start `{ state, profile }` as JSON (for replay.spec.ts)
//
// Re-record only on purpose (an engine or content change that moves the hashes) and say why in the commit.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { TRACE_PACKS, TRACE_SPECS, recordTrace, traceStart, tracePath, traceText, type TraceFile, type TracePack } from '../tests/fixtures/traces/traces';

const args = process.argv.slice(2);

if (args[0] === '--start') {
  const name = args[1];
  const file = name === undefined ? null : (JSON.parse(readFileSync(tracePath(name), 'utf8')) as TraceFile);
  if (file === null) throw new Error('usage: bun tools/record-traces.ts --start <trace name>');
  process.stdout.write(JSON.stringify(traceStart(file, TRACE_PACKS[file.pack]())));
} else {
  const packAt = args.indexOf('--pack');
  const pack = packAt >= 0 ? (args[packAt + 1] as TracePack | undefined) : undefined;
  const names = args.filter((a, i) => !a.startsWith('--') && i !== packAt + 1);
  const specs = TRACE_SPECS.filter((s) => (pack === undefined || s.pack === pack) && (names.length === 0 || names.includes(s.name)));
  if (specs.length === 0) throw new Error(`no trace matches ${args.join(' ')}`);
  const packs = new Map<TracePack, ReturnType<(typeof TRACE_PACKS)[TracePack]>>();
  for (const spec of specs) {
    const content = packs.get(spec.pack) ?? TRACE_PACKS[spec.pack]();
    packs.set(spec.pack, content);
    const before = existsSync(tracePath(spec.name)) ? (JSON.parse(readFileSync(tracePath(spec.name), 'utf8')) as TraceFile).finalStateHash : null;
    const file = recordTrace(spec, content);
    writeFileSync(tracePath(spec.name), traceText(file));
    const change = before === null ? 'new' : before === file.finalStateHash ? 'unchanged' : `${before} → ${file.finalStateHash}`;
    const where = `loop ${file.final.loop} day ${file.final.day} L${file.final.level} ${file.final.mode} @ ${file.final.locationId}`;
    process.stdout.write(`${spec.name.padEnd(24)} ${String(file.steps).padStart(5)} steps  ${file.stopReason.padEnd(9)} ${where}  ${change}\n`);
  }
}
