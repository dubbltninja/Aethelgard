// Content authoring progress (D-090). The real pack is written region by region and domain by domain (PLAN §9.2 U40–U60),
// so for a while a region file names creatures, items, quests, Echoes and NPCs that a later unit authors. A reference
// into a table listed here that does not resolve yet is a *pending* warning ("content not yet authored"), not an error;
// a reference into any other table must resolve. The unit that completes a table removes it from this list in the same
// commit — every reference that still dangles then surfaces as an error, and that unit (with the lead) fixes it.
//
// Only the real pack uses this list (`buildContentPack()` with no tables, `npm run validate`); test and fixture packs are
// always fully resolved.
import type { TableName } from '@schema/contentPack';

// U48a (2026-10-17): `regions` and `locations` are complete — all 12 regions and 73 locations, every one reachable.
// U51 (2026-10-17): `echoes`, `achievements`, `attunements`, `modifiers`, `endings` and `factions` are complete.
// U50 (2026-10-17): `items` (157), `recipes` (30) and `merchants` (8) are complete.
// U34e (2026-10-18): `creatures` is complete — WORLD §6's 57 plus §10.2's 16 anomaly variants.
// D-111 (2026-10-21): `companions` is complete — the six records are registered (their arcs and camp scenes stay pending).
// U59 (2026-10-25): `quests` is complete — D-045's 44 (U52–U58) and STORY §11.8's five class mini-quests; no reference into it
// was pending when the list was cut.
export const INCOMPLETE_TABLES: readonly TableName[] = [
  'dialogues',
  'npcs',
  'codex',
  'encounters',
];
