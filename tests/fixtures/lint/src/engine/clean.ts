// Clean engine file: near-misses that must NOT be reported.
import { z } from 'zod';
import type { ItemSchema } from '@schema/item';
import { helper } from './helper';
import type { GameEvent } from './types/events';

export interface Doc {
  document: string;
  window: number;
}

export function pure(state: { window: number; document: string }, events: GameEvent[]): number {
  const options = { window: 1, navigator: 'no', crypto: false };
  const label = 'console.log debugger @ts-ignore Math.random() Date.now()';
  const floor = Math.floor(state.window / 2);
  const parsed = z.number().parse(floor);
  type Win = typeof window;
  const typed: Win | null = null;
  return parsed + options.window + label.length + helper(events.length) + (typed ? 1 : 0) + ({} as ItemSchema | null ? 0 : 0);
}
