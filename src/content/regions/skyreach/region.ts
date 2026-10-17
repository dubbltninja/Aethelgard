// The Skyreach — the region record (WORLD §2.11; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1).
// A new region (not legacy, PLAN Appendix A.1). `description` is WORLD's theme text, verbatim.
//
// Faction: none (WORLD §2.11: "None. Nomad sky-burials on the Roost. Remnants want Aulde's notes."). Order: WORLD §2's
// number, 11.
// Palette: DESIGN §17.1 owns the hex values (D-062: DESIGN owns numbers; WORLD §2.11 lists a different set). Mapping onto
// the schema, as for the other regions: bg = sky top, bgAlt = sky bottom, fg = mid elements, accent = accent, glow = accent
// (sun on stone). The far/near colours are the UI unit's.
// Ambient: `ambient_<region>`, DESIGN §18.2's row. WORLD §2.11 adds layers (aeolian tones; a loom-click and brass resonance at
// the Eyrie; thunder and a hawk-like cry at the Perch): additive layers on the preset, the audio unit's, so no location
// overrides the ambient.
//
// Pool: WORLD §10.1 `pool_skyreach`, no conditions. The Sky-Whisper Sentinel (L9) sits three levels under the band (§10.1 says
// "only fodder whose level sits in the band"): the pool is WORLD's, so validator rule 11 warns about it (listed in the reply).
// Only the Windward Stair rolls it: WORLD names no pool at the other four places (locations.ts).
//
// Not expressible yet (listed in the U48a reply; U34d's region-hazards gap): the weather of WORLD §2.11 (the gale by default:
// ranged −10 %, Haste to Skyborn creatures; the storm at dusk: Storm +25 % for everyone, lightning on Soaked characters; the
// still dawn) and the hazards (the thin air is the two climbs' gate, the Highlands' exits; the Stair's falls are its
// encounter's: locations.ts).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_skyreach',
  name: 'The Skyreach',
  description:
    'Above the Plateau the wind has edges. A stair cut into the rock climbs to the crown of the tallest Spire and the roosts of the Sentinels, and to an eyrie of glass and brass where Seraphine Aulde, spire-builder of the Nine, tuned the Spires to feed the ritual. Her looms still run. Nothing up here has forgotten its orders.',
  order: 11,
  levelBand: { min: 12, max: 15 },
  palette: { bg: '#0E1C3A', bgAlt: '#9FC0E8', fg: '#7F9FD0', accent: '#FFE9A8', glow: '#FFE9A8' },
  ambient: 'ambient_skyreach',
  // WORLD §10.1 `pool_skyreach`
  wanderingPool: [
    { creatureId: 'cr_gale_kite', weight: 50 },
    { creatureId: 'cr_cloud_ray', weight: 40 },
    { creatureId: 'cr_sky_whisper_sentinel', weight: 10 },
  ],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_skyreach',
  tags: ['sky', 'thin_air', 'spireborn'],
} satisfies RegionInput;
