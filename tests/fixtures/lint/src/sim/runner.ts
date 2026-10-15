// The sim runner (outside src/sim/bots) may time itself.
export function elapsed(start: number): number {
  return performance.now() - start;
}
