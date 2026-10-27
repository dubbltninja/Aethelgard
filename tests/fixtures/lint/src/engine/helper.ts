import type { pure } from './clean';

export function helper(n: number): number {
  return n as ReturnType<typeof pure>;
}
