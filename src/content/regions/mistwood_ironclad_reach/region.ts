// Mistwood & the Ironclad Reach — the region record (WORLD §2.2; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1).
// Legacy region (D-015). `description` is WORLD's theme text, verbatim.
//
// Palette: DESIGN §17.1 owns the hex values (D-062: DESIGN owns numbers; WORLD §2.2 lists a slightly different set).
// Mapping onto the schema, as for the Ruins: bg = sky top, bgAlt = sky bottom, fg = mid elements, accent = accent,
// glow = accent (the forge ember). The far/near colours are the UI unit's.
// Ambient: no preset registry exists yet (validator rule 5 warns once one does); the id is the region's own name,
// `ambient_<region>`, and the recipe is DESIGN §18.2's row (WORLD's anvil layer at the Camp and the Emberforge is the
// audio unit's, a per-location layer on top of this preset).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_mistwood_ironclad_reach',
  name: 'Mistwood & the Ironclad Reach',
  description:
    "Fog, glowing bark, crushed herbs; then iron. The Mistwood is where the ruin's magic thins into ordinary wildness and the Nomads have drawn a line with scrap-metal barricades. The Reach climbs north into razor ridges and a palisade that failed, and ends in a canyon that is warm all year because of what runs under it.",
  order: 2,
  levelBand: { min: 2, max: 6 },
  legacy: true,
  factionId: 'ironclad',
  palette: { bg: '#2B3A3A', bgAlt: '#6E8C7A', fg: '#5E7A68', accent: '#D98B3A', glow: '#D98B3A' },
  ambient: 'ambient_mistwood_ironclad_reach',
  // WORLD §10.1 `pool_mistwood_ironclad_reach`. The Peaks' Loop 2+ Stutter Hound (15 %) is a location encounter at
  // loc_barren_peaks (the pool has no per-location or per-loop entries).
  wanderingPool: [
    { creatureId: 'cr_mistwood_prowler', weight: 45 },
    { creatureId: 'cr_rootling', weight: 40 },
    { creatureId: 'cr_wildling_brute', weight: 15 },
  ],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_mistwood_reach',
  tags: ['legacy', 'ironclad'],
} satisfies RegionInput;
