// Silverwood Before — the region record (WORLD §2.6; band DESIGN §6.5; palette DESIGN §17.1; pools WORLD §10.1; codex id
// STORY §14). A new region (not legacy, PLAN Appendix A.1). `description` is WORLD's theme text with its decision reference
// dropped, as the other regions drop theirs.
//
// Faction: none. WORLD §2.6: "None of the three exist yet"; the City Watch and the Ninefold Circle are the Before's own
// hostiles (the Watch's halberdiers, the Circle's adepts and wardens), not reputation tracks.
// Palette: DESIGN §17.1's "Silverwood Before" row (D-062: DESIGN owns numbers; WORLD §2.6 lists a different, warmer set).
// Mapping as U42: bg = sky top, bgAlt = sky bottom, fg = mid elements, accent = accent, glow = accent (pre-Sundering gold).
// Ambient: `ambient_<region>`, DESIGN §18.2's row ("the living city"). WORLD §2.6's day-by-day bell schedule (festive peals,
// single tolls, the 60 Hz hum) is the audio unit's layering on top of the preset, read off the Before's day.
// Pool: none (WORLD §10.1: "the Before is day-scripted"), so no return roll is ever made here (`returnEncounterChance` 0).
// `unlockWhen` is PLAN §5.2's own example for this region (Loop 2+; the doors in are the Nexus's and the Apex's exits, whose
// gates say the rest). The engine runs the region by its id (before.ts: the frozen Breach Clock, the Day 1–3 counter, the
// fresh echo on every entry and reset, the door flags, once-per-loop spoils, the Anchors).
//
// Hazards WORLD §2.6 names that the schema cannot carry (listed in the U48b reply): the Corridor's Day 3 ley-flare (Burn on
// entry; a region-hazards gap, U34e). The Watch's non-lethal arrest (wake in the Garret, lose a day) is D-098's (see locations.ts).
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_silverwood_before',
  name: 'Silverwood Before',
  description:
    'Dawn light on silver roofs. Bells. A city that does not know it has three days left. Everything the ruin only remembers is here in colour: the Grand Library with its roof on, the Plaza fountains running, the gate guarded by people in uniform. The Nine are in their Hall. Oriel Danthe is alive in her Archives. The echo repeats the same three days each time the Wayfinder enters.',
  order: 6,
  levelBand: { min: 13, max: 17 },
  palette: { bg: '#2B2E5A', bgAlt: '#E0C27A', fg: '#C9B47A', accent: '#FFF4D0', glow: '#FFF4D0' },
  ambient: 'ambient_silverwood_before',
  wanderingPool: [],
  returnEncounterChance: 0,
  codexId: 'codex_region_silverwood_before',
  unlockWhen: { loop: { min: 2 } },
  tags: ['before', 'time_locked', 'day_scripted'],
} satisfies RegionInput;
