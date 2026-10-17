// The Drowned Reach (`region_drowned_reach`) — the undercity of Silverwood under black water (WORLD §2.7, §3.6; PLAN §10.3;
// U46). The folder follows silverwood_ruins/index.ts (the template and its conventions header):
//   region.ts      the region record: band, palette, ambient, wandering pool (WORLD §2.7, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the Drowned Stair to the Bell-Warden's Deep (WORLD §3.6, §11, §12)
//   creatures.ts   the creatures whose first region is this one: the Tide Clerk, the Pale Diver, the Brine Lamprey, the
//                  Ledger Choir, the Bell-Ringer and the regional boss the Bell-Warden (D-090; DESIGN §4.10)
//   npcs.ts        Sedge Marrow and Pellam, at home in Lamplighters' Rest (WORLD §4)
//   items.ts       empty until the item units (U49/U50)
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
