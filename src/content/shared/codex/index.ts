// The codex (STORY §14: 87 entries in four voices, D-020; PLAN §5.12). This barrel concatenates the codex files; the content
// index registers `codex` (one line there, nothing else changes). U60 (Codex I) wrote the history, the Nine, the Wayfinders,
// the factions and the people: nine.ts, history.ts, people.ts. U61 (Codex II) wrote the rest of §14.1: places and regions
// (places.ts), the eight creature families (creatures.ts), the rules of the ley (magic.ts), the items (items.ts) and the loop
// (loops.ts). With Codex II every §14.1 id exists and `codex` is off INCOMPLETE_TABLES (progress.ts).
import type { CodexEntryInput } from '@schema/codex';
import { creaturesCodex } from './creatures';
import { historyCodex } from './history';
import { itemsCodex } from './items';
import { loopsCodex } from './loops';
import { magicCodex } from './magic';
import { nineCodex } from './nine';
import { peopleCodex } from './people';
import { placesCodex } from './places';

export { historyCodex, litanyCodex } from './history';
export { nineCodex } from './nine';
export { peopleCodex } from './people';
export { placesCodex } from './places';
export { creaturesCodex } from './creatures';
export { magicCodex } from './magic';
export { itemsCodex } from './items';
export { anyEcho, loopsCodex } from './loops';

/** Codex I: the 42 entries of U60 (STORY §14.1's 39 rows of these kinds plus the three of D-101). */
export const codexI = [...nineCodex, ...historyCodex, ...peopleCodex] satisfies CodexEntryInput[];

/** Codex II: the 48 entries of U61 (STORY §14.1's places, regions, creatures, items, magic and loop rows). */
export const codexII = [...placesCodex, ...creaturesCodex, ...magicCodex, ...itemsCodex, ...loopsCodex] satisfies CodexEntryInput[];

/** Every authored codex entry: STORY §14's 87. */
export const codex = [...codexI, ...codexII] satisfies CodexEntryInput[];
