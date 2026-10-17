// The regions barrel (PLAN §5.18, §10.3): imports every region folder and concatenates per table. Each region unit
// appends one import line and adds its folder to `REGION_FOLDERS`; nothing else changes. `src/content/index.ts` spreads
// these into `contentTables`. Folder order = WORLD §2 order (also each region record's `order`).
//
// Later units that add `dialogues.ts` / `quests.ts` to the folders (U52–U59) add the matching table here.
import type { CreatureInput } from '@schema/creature';
import type { ItemInput } from '@schema/item';
import type { LocationInput } from '@schema/location';
import type { NpcInput } from '@schema/npc';
import type { RegionInput } from '@schema/region';
import * as glowlandsNexus from './glowlands_nexus';
import * as silverwoodRuins from './silverwood_ruins';

/** What every region folder exports (its index.ts). */
export interface RegionFolder {
  region: RegionInput;
  locations: readonly LocationInput[];
  creatures: readonly CreatureInput[];
  npcs: readonly NpcInput[];
  items: readonly ItemInput[];
}

/** Every authored region, in WORLD §2 order. U42: Silverwood Ruins. */
export const REGION_FOLDERS: readonly RegionFolder[] = [silverwoodRuins, glowlandsNexus];

export const regions: readonly RegionInput[] = REGION_FOLDERS.map((f) => f.region);
export const locations: readonly LocationInput[] = REGION_FOLDERS.flatMap((f) => f.locations);
export const creatures: readonly CreatureInput[] = REGION_FOLDERS.flatMap((f) => f.creatures);
export const npcs: readonly NpcInput[] = REGION_FOLDERS.flatMap((f) => f.npcs);
export const items: readonly ItemInput[] = REGION_FOLDERS.flatMap((f) => f.items);
