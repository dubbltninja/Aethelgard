// Aether-Kissed Highlands — the region record (WORLD §2.4; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1; codex id
// STORY §14). Legacy region (D-015, PLAN Appendix A.1). `description` is WORLD's theme text, verbatim with its decision
// references (D-013, D-024, D-015) dropped, as the creature files drop them. No faction holds it (WORLD §2.4).
//
// Palette: DESIGN §17.1's "Aether-Kissed Highlands" row (D-062: DESIGN owns numbers; WORLD §2.4 lists a slightly different
// set). Mapping as U42: bg = sky top, bgAlt = sky bottom, fg = mid, accent = accent, glow = accent (aether white).
// Ambient: `ambient_<region>`, DESIGN §18.2's row (WORLD §2.4 writes a richer recipe: the audio unit's).
// Pool: WORLD §10.1 `pool_aether_kissed_highlands`, no conditions.
// Hazards (WORLD §2.4) the schema cannot carry: the Pass's mirage paths (see locations.ts), the Spires' static discharge (Shock
// for 1 turn on entering combat, cosmetic in Loop 1), the gales on the Plateau at dusk (Haste to Skyborn creatures), the
// flickering distant nodes on the map (cosmetic).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_aether_kissed_highlands',
  name: 'Aether-Kissed Highlands',
  description:
    'The Aether Road rises above ground. Crystal-laced rock bends distance; spires hum in a basin; a windswept shelf looks over the whole fractured land. Time is thin here. Dask can exist here. The Skyreach above belongs to the same region in name but is budgeted separately.',
  order: 4,
  levelBand: { min: 6, max: 10 },
  legacy: true,
  palette: { bg: '#1E2A4A', bgAlt: '#7FA8D9', fg: '#6E8FC4', accent: '#E8F3FF', glow: '#E8F3FF' },
  ambient: 'ambient_aether_kissed_highlands',
  wanderingPool: [
    { creatureId: 'cr_moment_moth', weight: 30 },
    { creatureId: 'cr_shimmering_phantom', weight: 25 },
    { creatureId: 'cr_glass_mote', weight: 20 },
    { creatureId: 'cr_steppe_harrier', weight: 15 },
    { creatureId: 'cr_aetherial_weaver', weight: 10 },
  ],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_highlands',
  tags: ['legacy', 'aether_road'],
} satisfies RegionInput;
