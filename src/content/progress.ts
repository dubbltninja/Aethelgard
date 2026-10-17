// Content authoring progress (D-090). The real pack is written region by region and domain by domain (PLAN §9.2 U40–U60),
// so for a while a region file names creatures, items, quests, Echoes and NPCs that a later unit authors. A reference
// into a table listed here that does not resolve yet is a *pending* warning ("content not yet authored"), not an error;
// a reference into any other table must resolve. The unit that completes a table removes it from this list in the same
// commit — every reference that still dangles then surfaces as an error, and that unit (with the lead) fixes it.
//
// Only the real pack uses this list (`buildContentPack()` with no tables, `npm run validate`); test and fixture packs are
// always fully resolved.
import type { TableName } from '@schema/contentPack';

export const INCOMPLETE_TABLES: readonly TableName[] = [
  'regions',
  'locations',
  'creatures',
  'items',
  'recipes',
  'quests',
  'dialogues',
  'npcs',
  'companions',
  'echoes',
  'codex',
  'achievements',
  'attunements',
  'modifiers',
  'endings',
  'merchants',
  'encounters',
  'factions',
];
