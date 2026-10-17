// Silverwood Ruins — the region record (WORLD §2.1; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1).
// Legacy region (D-015). `description` is WORLD's theme text, verbatim.
//
// Palette: DESIGN §17.1 owns the hex values (D-062: DESIGN owns numbers; WORLD §2.1 lists a slightly different set).
// Mapping onto the schema: bg = sky top, bgAlt = sky bottom, fg = mid elements, accent = accent, glow = accent (the
// crystal glow). The far/near colours are the UI unit's.
// Ambient: no preset registry exists yet (validator rule 5 warns once one does); the id is the region's own name,
// `ambient_<region>`, and the recipe is DESIGN §18.2's row.
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_silverwood_ruins',
  name: 'Silverwood Ruins',
  description:
    'The capital, five hundred years dead. Marble under moss. Crystals growing where lanterns hung. Everything here is a little louder than it should be: the stones hum, pages turn themselves, the fountains breathe mist.',
  order: 1,
  levelBand: { min: 1, max: 4 },
  legacy: true,
  factionId: 'remnants',
  palette: { bg: '#1B1F3B', bgAlt: '#4A3F6B', fg: '#5B5380', accent: '#9FD8FF', glow: '#9FD8FF' },
  ambient: 'ambient_silverwood_ruins',
  // WORLD §10.1 `pool_silverwood_ruins`. The Plaza's Loop 2+ Paradox Wisp (25 % of pool rolls) is a location
  // encounter at loc_silverwood_plaza (the pool has no per-location or per-loop entries).
  wanderingPool: [
    { creatureId: 'cr_corrupted_shade', weight: 35 },
    { creatureId: 'cr_arcane_wisp', weight: 35 },
    { creatureId: 'cr_mistwood_prowler', weight: 20 },
    { creatureId: 'cr_drowned_archivist', weight: 10 },
  ],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_silverwood_ruins',
  tags: ['legacy', 'remnants', 'start'],
} satisfies RegionInput;
