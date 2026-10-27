// The Threshold (`region_threshold`) — a shore inside the Breach where the Wayfinder stands between loops (WORLD §2.12, §3.12;
// D-011, D-012; PLAN §10.3; U48b). The folder follows silverwood_ruins/index.ts (the template and its conventions header); the
// engine that runs it is src/engine/reducers/threshold.ts (U31: the four places, the Loom, the Far Light; U34c: `talk`).
//   region.ts      the region record: no band, no pool, palette, ambient (WORLD §2.12, §10.1; DESIGN §6.5, §17.1)
//   locations.ts   the Still Shore, the Gallery of Loops, the Loom, the Far Light (WORLD §3.12, §11, §12)
//   creatures.ts   empty (no combat)
//   npcs.ts        empty (Dask, on the Shore from Loop 3, is the Highlands')
//   items.ts       empty (no items to take)
export { creatures } from './creatures';
export { items } from './items';
export { locations } from './locations';
export { npcs } from './npcs';
export { region } from './region';
