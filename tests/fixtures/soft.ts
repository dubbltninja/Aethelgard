// Soft assertions for content tests (PLAN §8.2): bun has no `expect.soft`, so `soft(name, fn)` runs a block of
// expectations, records a failure instead of throwing, and `tests/preload.ts` prints every recorded failure in one
// summary after the run. With RELEASE_GATE=1 (the release gate) a soft failure fails its test like any other.

export interface SoftFailure {
  name: string;
  message: string;
}

const failures: SoftFailure[] = [];

/** True when soft assertions must fail hard (`RELEASE_GATE=1`). */
export function releaseGate(): boolean {
  return process.env.RELEASE_GATE === '1';
}

/** Runs `fn`; a throw is recorded under `name` (or rethrown at the release gate). Returns whether `fn` passed. */
export function soft(name: string, fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch (error) {
    if (releaseGate()) throw error;
    failures.push({ name, message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/** Failures recorded so far in this run, oldest first. */
export function softFailures(): readonly SoftFailure[] {
  return failures;
}

/** Truncates the record to its first `keep` entries (tests of the collector remove what they added). */
export function resetSoft(keep = 0): void {
  failures.length = Math.min(keep, failures.length);
}

/** One report for the whole run, or null when nothing failed softly. */
export function softSummary(list: readonly SoftFailure[] = failures): string | null {
  if (list.length === 0) return null;
  const oneLine = (m: string) => m.split('\n').map((l) => l.trim()).filter((l) => l !== '').join(' · ');
  const lines = list.map((f, i) => `  ${i + 1}. ${f.name}: ${oneLine(f.message)}`);
  return `${list.length} soft assertion(s) failed (not fatal until RELEASE_GATE=1):\n${lines.join('\n')}`;
}
