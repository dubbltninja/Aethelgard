// Glowlands & Nexus — the NPCs whose home is in the region (WORLD §4): none. The three NPCs WORLD §3.5 names here are
// at home elsewhere and come and go at runtime, so their records and placement belong to their home regions:
//   npc_mireya  home loc_lanternreed (the Glowfen unit); "flavor only here, gathering" — a static second placement
//               would stand her in two places at once;
//   npc_dask    home loc_shimmering_pass (the Highlands unit); he "can remain" in the Nexus and the Apex by the engine's
//               `temporallyUnstable` rule (D-059, D-068.2) and leaves the party on the Glowlands;
//   npc_brak    home loc_ironclad_camp (U43); he comes to the Apex when the Tyrant falls (engine, WORLD §12.1
//               `ws_brak_at_apex`).
// The export keeps every region folder's shape identical (PLAN §10.3).
import type { NpcInput } from '@schema/npc';

export const npcs = [] satisfies NpcInput[];
