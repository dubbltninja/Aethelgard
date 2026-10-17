// The Veil — the region record (WORLD §2.9; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1).
// A new region (not legacy). `description` is WORLD's theme text.
//
// Faction: the Shadow Weavers (WORLD §2.9: dominant, the Sanctum). Order: WORLD §2's number, 9.
// Palette: DESIGN §17.1 owns the hex values (D-062: DESIGN owns numbers; WORLD §2.9 lists a different set). Mapping onto the
// schema, as for the other regions: bg = sky top, bgAlt = sky bottom, fg = mid elements, accent = accent, glow = accent
// (sanctum light). The far/near colours are the UI unit's.
// Ambient: `ambient_<region>`, DESIGN §18.2's row. WORLD §2.9 adds layers (a women's-choir pad at the Sanctum, a single held
// sine at Where She Fell): additive layers on top of the preset, which are the audio unit's, not replacement presets (unlike
// the Nexus), so no location overrides the ambient.
//
// Pool: WORLD §10.1 `pool_veil` is lantern 40 · null mouth 35 · sentry 25, and "Weavers ≤ Wary: sentry 50". The pool has no
// conditions in the schema, so the region pool is WORLD's row and the Wary shift (the sentry's weight 25 → 50: 25 extra of the
// Wary pool's 125, a fifth of the pool's 20 % return rolls) is a Wary-gated location encounter at 4 % ahead of the pool roll
// at the three nodes that roll the pool and are not the Mouth (locations.ts; the Voidscar's pattern).
//
// Not expressible yet (listed in the U47 reply): the weather and hazards of WORLD §2.9 (Unmaking: 5 % of max HP a watch spent in
// the Null Orchard or the Eye without `item_weavers_thread_ring`, restored on leaving the Veil; Blind on the first turn of an
// ambush in the Gallery unless `item_hollow_lantern_focus`: a region or place hazard has no field, U34d's region-hazards gap)
// and "Heartstone exploited: Where She Fell glows" beyond a patch of glints (locations.ts).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_veil',
  name: 'The Veil',
  description:
    'Past the Hollow the scar goes down and the dark goes up. Here the Void is not a threat but a medium: the Weavers walk in it, weave in it, build in it. Glass that is not glass. Trees that are the absence of trees. At the end of the Veil, a crater of starlight where Nyxaria Vell struck the present forty years ago.',
  order: 9,
  levelBand: { min: 10, max: 14 },
  factionId: 'weavers',
  palette: { bg: '#120A1E', bgAlt: '#3A1F52', fg: '#4B2C6E', accent: '#C86BFF', glow: '#C86BFF' },
  ambient: 'ambient_veil',
  // WORLD §10.1 `pool_veil`: hollow lantern 40 · null mouth 35 · veil sentry 25 (Wary: sentry 50: locations.ts)
  wanderingPool: [
    { creatureId: 'cr_hollow_lantern', weight: 40 },
    { creatureId: 'cr_null_mouth', weight: 35 },
    { creatureId: 'cr_veil_sentry', weight: 25 },
  ],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_veil',
  tags: ['weavers', 'void', 'scar'],
} satisfies RegionInput;
