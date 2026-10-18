// What the live region says after a step (PLAN §6.7): one sentence (or a few joined) per dispatch, never one per
// event, so a screen reader is not flooded. U63 covers arrival, narration and the shell's own events; U70 writes the
// full phrasing (combat announcements such as "You hit the Corrupted Shade for 12. It readies a claw strike…").
import { WATCH_NAMES, dayOf, watchOf, type ContentPack, type GameEvent, type GameState } from '@engine/index';

const NARRATED: ReadonlySet<string> = new Set(['narration', 'event', 'system', 'dialogue', 'combat']);

export function announceStep(events: readonly GameEvent[], state: GameState, content: ContentPack): string | null {
  const parts: string[] = [];
  for (const event of events) {
    switch (event.t) {
      case 'locationEntered': {
        const name = content.locations[event.locationId]?.name ?? event.locationId;
        parts.push(`${name}. Day ${dayOf(state.clock.ticks)}, ${WATCH_NAMES[watchOf(state.clock.ticks)]}.`);
        break;
      }
      case 'log':
        if (NARRATED.has(event.kind)) parts.push(event.text);
        break;
      case 'saveLoaded':
        parts.push('Save loaded.');
        break;
      case 'modeChanged':
        if (event.to === 'title') parts.push('Title screen.');
        break;
      case 'actionRejected':
        parts.push(`That cannot be done: ${event.reason}.`);
        break;
      default:
        break;
    }
  }
  return parts.length === 0 ? null : parts.join(' ');
}
