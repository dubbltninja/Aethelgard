// Aether-Kissed Highlands (`region_aether_kissed_highlands`) — the Aether Road above ground: the Pass, the Spires, the Plateau
// (WORLD §2.4, §3.4; PLAN §10.3; U44). The folder follows silverwood_ruins/index.ts (the template and its conventions header):
//   region.ts      the region record: band, palette, ambient, wandering pool (WORLD §2.4, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the Shimmering Pass, the Aetherium Spires, the Sky-Whisper Plateau (WORLD §3.4, §11, §12)
//   creatures.ts   the creatures whose first region is this one: the Shimmering Phantom, the Moment Moth, the Glass Mote, the
//                  Aetherial Weaver, the Sky-Whisper Sentinel and the Steppe Harrier (D-090)
//   npcs.ts        Dask, whose home is the Pass (WORLD §4)
//   items.ts       empty until the item units (U49/U50)
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
