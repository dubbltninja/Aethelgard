// The Glowfen — the region record (WORLD §2.10; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1).
// A new region (not legacy). `description` is WORLD's theme text.
//
// Faction: none holds it (WORLD: "Glowfen folk (unaligned villagers; the Remnants court their elders; the Weavers buy
// spores). Lanternreed is neutral ground for all three factions"), so the record has no `factionId`. Order: WORLD §2's number, 10.
// Palette: DESIGN §17.1 owns the hex values (D-062: DESIGN owns numbers; WORLD §2.10 lists a different set). Mapping onto the
// schema, as for the other regions: bg = sky top, bgAlt = sky bottom, fg = mid elements, accent = accent, glow = accent
// (lantern yellow-green). The far/near colours are the UI unit's.
// Ambient: `ambient_<region>`, DESIGN §18.2's row. WORLD §2.10 adds layers (a kalimba-like loop at Lanternreed, a slow
// inhale/exhale sweep at the Breathing Pool): additive layers on top of the preset, which are the audio unit's, so no
// location overrides the ambient.
//
// Pool: WORLD §10.1 `pool_glowfen` is mireling 30 · toad 25 · spore 20 · reed stalker 15 · barrow light 10, "barrow light at
// dusk/night only". D-098 (U34d): a pool entry carries a `when`, so the barrow light is in the pool at dusk and night, at the
// nodes that roll the pool and can bear a level-11 creature — the Shallows and the Mangrove, not the band-8 Causeway
// (locations.ts) nor the band-8 Reedmarch Descent, which draws on this pool too (../ashen_steppe/locations.ts
// `wanderingPools`) — and otherwise the first four share the rolls (it was a 2 % location encounter at the Shallows and the
// Mangrove ahead of the pool roll).
//
// Not expressible yet (listed in the U47 reply): the weather and hazards of WORLD §2.10 — rain every second day (Soaked
// region-wide for the day), the Shallows' spore-fog at dawn (Poison for 1 turn at ambush onset), sinking in the Shallows
// (Slow), the Gullet's draw beyond its 2-watch haul west (locations.ts) — a region or place hazard has no field (U34d's
// region-hazards gap); "Horde: infected from the Glowlands by the Causeway" is the engine's spread graph (WORLD §12.2);
// "Loop 3+: the Barrow-Lights speak the names of past Wayfinders" is `ev_barrows_names` (locations.ts) and the Barrow-Light's
// stun turn (creatures.ts).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_glowfen',
  name: 'The Glowfen',
  description:
    "South of the Glowlands the water deepens and the light comes up from under it. Lanternreed stands on stilts over a pool that breathes. The light is Breach-leak — the Aether Road's end bleeding into the swamp — and it is changing the people who live in it. They are kind. They are becoming something.",
  order: 10,
  levelBand: { min: 8, max: 12 },
  palette: { bg: '#14261A', bgAlt: '#3E6E3A', fg: '#4F8A44', accent: '#D9FF66', glow: '#D9FF66' },
  ambient: 'ambient_glowfen',
  // WORLD §10.1 `pool_glowfen`: mireling 30 · toad 25 · spore 20 · reed stalker 15 · barrow light 10 at dusk and night only
  // (D-098; not at the Causeway, see the header)
  wanderingPool: [
    { creatureId: 'cr_glowfen_mireling', weight: 30 },
    { creatureId: 'cr_lantern_toad', weight: 25 },
    { creatureId: 'cr_spore_drift', weight: 20 },
    { creatureId: 'cr_reed_stalker', weight: 15 },
    {
      creatureId: 'cr_barrow_light',
      weight: 10,
      when: {
        all: [{ any: [{ watch: 'dusk' }, { watch: 'night' }] }, { any: [{ location: 'loc_sporelight_shallows' }, { location: 'loc_elder_mangrove' }] }],
      },
    },
  ],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_glowfen',
  tags: ['glowfen', 'swamp', 'breach_leak'],
} satisfies RegionInput;
