// Bots are deterministic like the engine (PLAN §7.1): same seed, same run.
export function pick(n: number): number {
  return Math.floor(Math.random() * n) + (Date.now() % 2);
}
