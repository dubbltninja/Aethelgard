// The Ashen Steppe — the region record (WORLD §2.8; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1).
// A new region (not legacy). `description` is WORLD's theme text.
//
// Faction: the Ironclad (WORLD §2.8: dominant at Hearthring, the Scorched Gate and Watchfire; the Glowfen traders at the
// Reedmarch are not a faction). Order: WORLD §2's number, 8.
// Palette: DESIGN §17.1 owns the hex values (D-062: DESIGN owns numbers; WORLD §2.8 lists a different set). Mapping onto
// the schema, as for the other regions: bg = sky top, bgAlt = sky bottom, fg = mid elements, accent = accent, glow = accent
// (ash fire). The far/near colours are the UI unit's.
// Ambient: `ambient_<region>`, DESIGN §18.2's row. WORLD §2.8 adds layers (herd lowing; at Hearthring a frame drum and a
// bowed-string drone; at the Cairns intermittent thunder): additive layers on top of the preset, which are the audio
// unit's, not replacement presets (unlike the Nexus), so no location overrides the ambient.
//
// Pool: WORLD §10.1 `pool_ashen_steppe` is jackal 40 · harrier 35 · stalker 25, "reed stalker at loc_watchfire_ridge /
// loc_reedmarch_descent only". The pool has no per-location entries, so the region pool is the pool everywhere without the
// stalker (jackal 40 · harrier 35), and the stalker's 25 % of the pool rolls at those two nodes is a location encounter
// there (locations.ts; the Glowlands' Nexus pattern). The harrier's first region is the Highlands (U44): it is a pending
// reference here until that unit lands (D-090).
//
// Not expressible yet (listed in the U46 reply): the weather and hazards of WORLD §2.8 (ashfall's one-turn Blind at an
// ambush on Days 1-2 of each three-day cycle, the Pan's midday glare, the Cairns' lightning on Soaked characters, the Flats'
// stampede lanes as a place rule: a region hazard has no field, U34d's region-hazards gap) and "the Steppe's ash settles"
// under a destroyed Heartstone (WORLD gives no art variant to patch).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_ashen_steppe',
  name: 'The Ashen Steppe',
  description:
    "The sky is white with ash that never finishes falling. Grass grows grey. The Sundering's fire — Corvin Dreyl's pyre-ward, meant to shield the city, turned outward — burned the plains in a day, and the herds with them. The Nomads came after and made it theirs: hearths in rings of stone, cairns that catch lightning, a hall that burned and was never rebuilt. This is where the Ironclad are a people and not a camp.",
  order: 8,
  levelBand: { min: 7, max: 11 },
  factionId: 'ironclad',
  palette: { bg: '#3A2E2A', bgAlt: '#B08A6A', fg: '#9C7A5F', accent: '#E05A3A', glow: '#E05A3A' },
  ambient: 'ambient_ashen_steppe',
  // WORLD §10.1 `pool_ashen_steppe`: jackal 40 · harrier 35 (· stalker 25 at the Ridge and the Descent only: locations.ts)
  wanderingPool: [
    { creatureId: 'cr_salt_jackal', weight: 40 },
    { creatureId: 'cr_steppe_harrier', weight: 35 },
  ],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_ashen_steppe',
  tags: ['ironclad', 'plains', 'ash'],
} satisfies RegionInput;
