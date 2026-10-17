// Silverwood Ruins — item records. Empty by design (D-090): item placements are references in locations.ts and
// creatures.ts, and the item records belong to the item units (U49/U50); the Amulet already lives in
// src/content/items/amulet.ts. The export keeps every region folder's shape identical (PLAN §10.3).
import type { ItemInput } from '@schema/item';

export const items = [] satisfies ItemInput[];
