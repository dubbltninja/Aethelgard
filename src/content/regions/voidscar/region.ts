// The Voidscar — the region record (WORLD §2.3; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1; codex id STORY §14).
// Legacy region (D-015, PLAN Appendix A.1). `description` is WORLD's theme text, verbatim. The Weavers hold it (WORLD §2.3:
// "Shadow Weavers: Nyx at the Chasm; Weaver sentries in the Hollow from Loop 2 if Wary").
//
// Palette: DESIGN §17.1's "The Voidscar" row (D-062: DESIGN owns numbers; WORLD §2.3 lists a slightly different set).
// Mapping as U42: bg = sky top, bgAlt = sky bottom, fg = mid, accent = accent, glow = accent (void violet).
// Ambient: `ambient_<region>`, DESIGN §18.2's row (WORLD §2.3 writes a richer recipe: the audio unit's).
//
// Pool: WORLD §10.1 `pool_voidscar` is the stalker alone; under Weavers Wary the pool becomes sentry 40 · stalker 60. A
// pool has no conditions, so the region pool is the stalker alone and the Wary share is location encounters (locations.ts).
// Hazards (WORLD §2.3) the schema cannot carry: the Void-chill (standing in the Hollow more than two watches without moving
// applies Weaken for 1 turn at the next combat), the chasm's hourly exhale and falling scree (cosmetic).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_voidscar',
  name: 'The Voidscar',
  description:
    'A split in the earth that breathes cold. Below the Plaza the ground simply stops; past the chasm it comes back as obsidian scree and bruised crystal, and the things that live there fray at the edges like smoke. Nyx waits at the lip, where the Weavers meet outsiders.',
  order: 3,
  levelBand: { min: 5, max: 8 },
  legacy: true,
  factionId: 'weavers',
  palette: { bg: '#0B0A14', bgAlt: '#2A1B3D', fg: '#3B2A57', accent: '#7B3FE4', glow: '#7B3FE4' },
  ambient: 'ambient_voidscar',
  wanderingPool: [{ creatureId: 'cr_void_touched_stalker', weight: 100 }],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_voidscar',
  tags: ['legacy', 'weavers', 'void'],
} satisfies RegionInput;
