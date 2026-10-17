// The Glowfen (`region_glowfen`) — the swamp south of the Glowlands, where Lanternreed stands on stilts over a pool that breathes
// and the light that comes up from under it is changing the people (WORLD §2.10, §3.9; PLAN §10.3; U47). The folder follows
// silverwood_ruins/index.ts (the template and its conventions header):
//   region.ts      the region record: band, palette, ambient, wandering pool (WORLD §2.10, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the Lantern Causeway to the Hall of the Lantern Matron (WORLD §3.9, §11, §12)
//   creatures.ts   the creatures whose first region is this one: the Barrow-Light and the regional boss, the Lantern Matron
//                  (D-090; DESIGN §4.10). The Glowfen Mireling, the Lantern Toad and the Spore Drift are the Glowlands' (first
//                  region), the Reed Stalker the Steppe's
//   npcs.ts        Mireya (the companion anchor), Elder Wen, Elder Tam and Old Fennick (WORLD §4)
//   items.ts       empty until the item units (U49/U50)
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
