// The art's own random source (PLAN §6.4, D-032): a second xoshiro128** instance, seeded from a visual seed string
// (`ui:` + seed), never the engine's run Rng — drawing a scene can never move the game's dice. Same seed, same picture.
import { Rng } from '@engine/index';

export interface UiRng {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max]. */
  int(min: number, max: number): number;
  /** One element (the array must not be empty). */
  pick<T>(items: readonly T[]): T;
}

export function uiRng(seed: string): UiRng {
  const rng = Rng.fromSeed(`ui:${seed}`);
  const next = (): number => rng.next();
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
  };
}
