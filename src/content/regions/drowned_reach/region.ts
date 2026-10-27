// The Drowned Reach — the region record (WORLD §2.7; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1).
// A new region (not legacy). `description` is WORLD's theme text, with the decision reference dropped.
//
// Faction: the Remnants (WORLD §2.7: divers and lamplighters at Lamplighters' Rest; the Weavers only buy vellum from
// Sedge). Order: WORLD §2's number, 7.
// Palette: DESIGN §17.1 owns the hex values (D-062: DESIGN owns numbers; WORLD §2.7 lists a slightly different set).
// Mapping onto the schema, as for the other regions: bg = sky top, bgAlt = sky bottom, fg = mid elements, accent = accent,
// glow = accent (ley through water). The far/near colours are the UI unit's.
// Ambient: `ambient_<region>`, DESIGN §18.2's row. WORLD §2.7 adds two layers (the muffled bell, louder nearer the
// Bellmouth; paper-rustle granulars at the Scriptorium): additive layers on top of the preset, which are the audio
// unit's, not replacement presets (unlike the Nexus), so no location overrides the ambient.
//
// WORLD §2.7's dark gate is data (the Drowned Stair's two exits need `item_glyphbound_lantern`, locations.ts) and so are
// its water rules (the Black Sluice walkway at night). Not expressible yet (listed in the U46 reply): "Soaked is applied on
// entering any Drowned Reach location" and "Soaked on every entry (Storm +50 % both ways; Fire -50 %)" (a region hazard
// has no field; U34d's region-hazards gap), the lamprey ambushes at the Sluice (an encounter's `ambush` flag exists but
// the engine only passes it on to the `combatStarted` event, so the Sluice's groups are plain groups), the `drowned` tag (re-applies Soaked each
// turn: engine gap 5) and "the Reach goes lamp-dark" under a destroyed Heartstone (no art spec to patch: WORLD gives no
// variant).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_drowned_reach',
  name: 'The Drowned Reach',
  description:
    "The undercity of Silverwood, under black water. Stairs that go down into lamplight. Shelves that go down further. On the last day of the old world the Warden of Waters, Ilsabet Rhune — a civic office, not a seat of the Nine — opened the cisterns to drown the Conflux's fire. The water never left. Lamps still burn where a few Remnant divers keep them. The dead keep filing.",
  order: 7,
  levelBand: { min: 4, max: 8 },
  factionId: 'remnants',
  palette: { bg: '#0D1B2A', bgAlt: '#1F4E6E', fg: '#2C6A8A', accent: '#8FD3E8', glow: '#8FD3E8' },
  ambient: 'ambient_drowned_reach',
  // WORLD §10.1 `pool_drowned_reach`: lamprey 35 · diver 30 · clerk 20 · archivist 15, no conditions.
  wanderingPool: [
    { creatureId: 'cr_brine_lamprey', weight: 35 },
    { creatureId: 'cr_pale_diver', weight: 30 },
    { creatureId: 'cr_tide_clerk', weight: 20 },
    { creatureId: 'cr_drowned_archivist', weight: 15 },
  ],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_drowned_reach',
  tags: ['remnants', 'undercity', 'dark'],
} satisfies RegionInput;
