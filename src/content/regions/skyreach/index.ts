// The Skyreach (`region_skyreach`) — the stair into the wind, the Spire-Crown, the Sentinels' roosts, Aulde's Eyrie and the
// Stormcrown's Perch (WORLD §2.11, §3.10; PLAN §10.3; U48a). The folder follows silverwood_ruins/index.ts (the template and its
// conventions header):
//   region.ts      the region record: band, palette, ambient, wandering pool (WORLD §2.11, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the Windward Stair to the Stormcrown's Perch (WORLD §3.10, §11, §12)
//   creatures.ts   the creatures whose first region is this one: the Spire Loom (elite), the Gale Kite, the Cloud Ray and the
//                  regional boss, the Stormcrown (D-090; DESIGN §4.10). The Aetherial Weaver, the Glass Mote and the Sky-Whisper
//                  Sentinel are the Highlands' (U44)
//   npcs.ts        empty: no NPC's home is here (WORLD §4)
//   items.ts       empty until the item units (U49/U50)
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
