// Silverwood Ruins (`region_silverwood_ruins`) — the first region folder and the template for the others (PLAN §10.3).
//
// Layout, one file per table, each exporting one `satisfies <Input>[]` array (the region file exports one record):
//   region.ts      the region record: band, palette, ambient, wandering pool (WORLD §2.x, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the region's locations with their exits, items, encounters, events, art, rest (WORLD §3.x, §11, §12)
//   creatures.ts   the creatures whose FIRST region in WORLD §6's Regions column is this region (D-090)
//   npcs.ts        the NPCs whose home location is in this region (WORLD §4); companion NPCs carry `companionId`
//   items.ts       empty until the item units (U49/U50) land; placements are references (D-090)
//   index.ts       this file: re-exports; src/content/regions/index.ts concatenates every folder per table
// Later units add `dialogues.ts` and `quests.ts` here (U52–U59) and one line each in the barrel.
//
// Conventions every region copies (D-085 pattern; the per-file headers have the detail):
//   - Text the documents give is verbatim: legacy lines from legacy/aethelgard_data.py (D-001), WORLD's `+` sentence
//     appended, WORLD's event texts, telegraphs and bestiary entries. Words the documents do not give (an intro line, a
//     rest text, a creature `description` where no legacy line exists) are short, in the BIBLE's voice, and listed in
//     the unit's reply so the lead can check them.
//   - Ids exactly as WORLD/STORY spell them; references into tables a later unit authors are left dangling on purpose
//     (pending under D-090, surfaced by `npm run validate`); nothing is coined without being listed in the reply.
//   - Legacy event ids take the `ev_` prefix (`ruins_echo` → `ev_ruins_echo`, PLAN §5.17); encounter ids are
//     `enc_<place>_<group>`; boss phase ids `<creature>_<phase>`.
//   - WORLD's encounter notation maps to EncounterSchema: `first: X (100%)` = a plain group (stays until cleared or
//     scattered); `first: X (p%)` = `chance: p` (rolls once, on the first visit); `return: X (p%)` = `chance: p,
//     respawn: 'on_return'`; `pool p%` is the region record's wandering pool; story gates and Horde fights are
//     `fleeable: false, onFlee: 'hold'` (R10-1). WORLD's `stage:"accepted"` is the schema's `quest` with no stage
//     (in the journal); "accepted and not completed" is `status: 'active'`.
//   - A creature's `pattern` lists WORLD's conditioned intents first (in priority order), then the unconditioned cycle.
//   - `description` is play text, `tags` are role notes; `legacyName` on every legacy record (validator rule 22).
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
