import type { GameEvent } from '@engine/types/events';

export function sfxFor(event: GameEvent): string {
  return event.type;
}
