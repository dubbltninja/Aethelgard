// Glowlands & Nexus — the region record (WORLD §2.5; band DESIGN §6.5; palette DESIGN §17.1; pool WORLD §10.1).
// Legacy region (D-015, PLAN Appendix A.1). `description` is WORLD's theme text, verbatim. No faction holds it (WORLD).
//
// Band: 9–13 is the region's; the Apex's 15–18 is that location's own `levelBand` (DESIGN §6.5 lists it apart).
// Palette: DESIGN §17.1's "Glowlands & Nexus" row (D-062: DESIGN owns numbers; WORLD §2.5 lists a slightly different set
// and adds a chrono gold for the Nexus and the Apex, which DESIGN does not carry and the schema has no per-location slot
// for — the UI unit's). Mapping as U42: bg = sky top, bgAlt = sky bottom, fg = mid, accent = accent, glow = accent.
// Ambient: `ambient_<region>`, DESIGN §18.2's row; the Nexus and the Apex override it (locations.ts).
// Hazards (WORLD §2.5) the schema cannot carry: Glowlands sinkholes (Slow 1 turn on an ambush), the Nexus's temporal
// shear (10 % per watch to lose or gain one watch). "The Apex cannot be rested in" is data (no `rest` there).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_glowlands_nexus',
  name: 'Glowlands & Nexus',
  description:
    'The Aether Road ends in a swamp that glows and an observatory whose dome fell inward. Time buckles. Past and future flicker on cracked stone. Above the observatory, the Apex: reality in violent seams.',
  order: 5,
  levelBand: { min: 9, max: 13 },
  legacy: true,
  palette: { bg: '#0F2A22', bgAlt: '#1F5C44', fg: '#2F7A5A', accent: '#7CFF9E', glow: '#7CFF9E' },
  ambient: 'ambient_glowlands_nexus',
  // WORLD §10.1 `pool_glowlands_nexus`: mireling 30 · toad 25 · spore 20 · crawler 25, "crawler at loc_chronos_nexus
  // only (its weight goes to mireling elsewhere)". The pool has no per-location entries, so the region pool is the
  // pool everywhere but the Nexus (the crawler's 25 moved to the mireling), and the Nexus's share of crawlers in pool
  // rolls is a location encounter there (25 % of the 20 % return rolls = 5 % per return visit; U42's Plaza pattern).
  wanderingPool: [
    { creatureId: 'cr_glowfen_mireling', weight: 55 },
    { creatureId: 'cr_lantern_toad', weight: 25 },
    { creatureId: 'cr_spore_drift', weight: 20 },
  ],
  returnEncounterChance: 0.2,
  codexId: 'codex_region_glowlands_nexus',
  tags: ['legacy', 'aether_road', 'finale'],
} satisfies RegionInput;
