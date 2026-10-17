// Silverwood Before (`region_silverwood_before`) — the capital three days before it fell, repeating (WORLD §2.6, §3.11; STORY
// §9; PLAN §10.3; U48b). The folder follows silverwood_ruins/index.ts (the template and its conventions header); the engine
// that runs it is src/engine/before.ts (U32: the frozen clock, the three Bells, the fresh echo, the doors, the Anchors).
//   region.ts      the region record: band, palette, ambient, no wandering pool (WORLD §2.6, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the Silver Gate to the Conflux Chamber, by Bell (WORLD §3.11, §11, §12)
//   creatures.ts   the creatures whose first region is this one: the Ley Hound, the Ninefold Knight, the regional boss the
//                  Unbroken Warden, and two Mortals, the City Watch Halberdier and the Circle Adept (D-090; DESIGN §4.10)
//   npcs.ts        Caelum, the Nine and the six who were not of the Nine (WORLD §4)
//   items.ts       empty until the item units (U49/U50)
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
