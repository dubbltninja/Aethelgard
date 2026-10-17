// Glowlands & Nexus (`region_glowlands_nexus`) — the Apex road's end and the finale of every loop (WORLD §2.5, §3.5;
// PLAN §10.3; U45). The folder follows silverwood_ruins/index.ts (the template and its conventions header):
//   region.ts      the region record: band, palette, ambient, wandering pool (WORLD §2.5, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the Veridian Glowlands, the Chronos Nexus, the Temporal Breach Apex (WORLD §3.5, §11, §12)
//   creatures.ts   the creatures whose first region is this one, both Chronos Tyrants with the Unveiled's communion,
//                  the Tyrant's Reach and the Horde Husk (D-090, D-091; DESIGN §4.10–4.11)
//   npcs.ts        none: no NPC's home is here (WORLD §4)
//   items.ts       empty until the item units (U49/U50)
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
