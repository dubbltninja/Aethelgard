// The codex (STORY §14: 87 entries in four voices, D-020; PLAN §5.12). This barrel concatenates the codex files; the content
// index registers `codex` (one line there, nothing else changes). U60 (Codex I) wrote the history, the Nine, the Wayfinders,
// the factions and the people: nine.ts, history.ts, people.ts. U61 (Codex II) appends its files here: places, regions,
// creatures, items, magic and the loop. `codex` leaves INCOMPLETE_TABLES (progress.ts) with U61, when every §14.1 id exists.
import type { CodexEntryInput } from '@schema/codex';
import { historyCodex } from './history';
import { nineCodex } from './nine';
import { peopleCodex } from './people';

export { historyCodex, litanyCodex } from './history';
export { nineCodex } from './nine';
export { peopleCodex } from './people';

/** Codex I: the 42 entries of U60 (STORY §14.1's 39 rows of these kinds plus the three of D-101). */
export const codexI = [...nineCodex, ...historyCodex, ...peopleCodex] satisfies CodexEntryInput[];

/** Every authored codex entry (Codex I; U61 appends Codex II). */
export const codex = [...codexI] satisfies CodexEntryInput[];
