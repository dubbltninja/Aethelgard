// The Ashen Steppe (`region_ashen_steppe`) — the Nomads' plains under falling ash (WORLD §2.8, §3.7; PLAN §10.3; U46).
// The folder follows silverwood_ruins/index.ts (the template and its conventions header):
//   region.ts      the region record: band, palette, ambient, wandering pool (WORLD §2.8, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the Scorched Gate to the Herd-Grave (WORLD §3.7, §11, §12)
//   creatures.ts   the creatures whose first region is this one: the Salt Jackal, the Cinderback, the Reed Stalker and the
//                  regional boss Ashmaw (D-090; DESIGN §4.10). The Steppe Harrier's first region is the Highlands (U44)
//   npcs.ts        Scout Ferrin, Hadda Ironvow, Oma Varr, Tessaly Varr and Ketch (WORLD §4)
//   items.ts       empty until the item units (U49/U50)
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
