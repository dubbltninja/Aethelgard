// Mistwood & the Ironclad Reach (`region_mistwood_ironclad_reach`) — the second region folder, in the shape the Silverwood
// Ruins set (PLAN §10.3, D-091); the conventions header in ../silverwood_ruins/index.ts applies unchanged.
//
//   region.ts      the region record: band, palette, ambient, wandering pool (WORLD §2.2, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the six locations with their exits, items, encounters, events, art, rest (WORLD §3.2, §11, §12)
//   creatures.ts   the creatures whose FIRST region in WORLD §6's Regions column is Mistwood & the Reach (D-090): the
//                  Wildling Brute, the Rootling, the Stone-Hide Golem, the Warding Pillar, the Stutter Hound
//   npcs.ts        the NPCs whose home location is here (WORLD §4): Kaelen Stonehand, Brak (`companionId`), Borin Stonefist
//   items.ts       empty until the item units (U49/U50) land; placements are references (D-090)
//
// Readings specific to this region (each is commented where it is used):
//   - A legacy kill quest's target (the Brute at the Peaks, the Golems at the Outpost) is two encounters: the story gate
//     (`fleeable: false, onFlee: 'hold'` while the quest is active, WORLD R10-1) first, then the plain 100 % legacy group
//     that a flight scatters (WORLD §10.4, §10.5). The gate's victory scatters the plain group so one kill pays once.
//   - Settlements (the Respite, the Camp, the Emberforge) are `safe: true`: WORLD gives them no encounters.
//   - Events say `once`, which the engine keeps per loop (`eventsFired` lives in the loop's location state), so WORLD's
//     "once" and "once per loop" coincide.
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
