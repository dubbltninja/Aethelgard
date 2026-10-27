// The Threshold — the region record (WORLD §2.12; DESIGN §6.5 "— · no combat"; palette DESIGN §17.1; codex id STORY §14). A new
// region (PLAN Appendix A.1: the twelfth, counted in the 73-location budget, D-015). `description` is WORLD's theme text with its
// decision reference dropped.
//
// Band: WORLD and DESIGN give none ("none (no combat)", "—"). The schema needs one (min ≥ 1), so it is the whole level range,
// 1–20, which no placement reads (there are no fights here); the four locations carry no band of their own.
// Faction: none. Palette: DESIGN §17.1's "The Threshold" row (D-062; WORLD §2.12 lists a different set), mapped as U42: bg =
// sky top, bgAlt = sky bottom, fg = mid, accent = accent, glow = accent (the far light). Ambient: `ambient_<region>`, DESIGN
// §18.2's row ("the still shore"); WORLD §2.12's Loom music box (as many notes as Echoes) and the Tyrant's double thump are the
// audio unit's layers. Pool: none (WORLD §10.1: "the Threshold has no combat").
//
// The engine runs the Threshold as four places, not walked nodes (reducers/threshold.ts, U31: `THRESHOLD_LOCATIONS` names
// these ids; `thresholdGo` walks between them; the Loom's and the Far Light's actions; `talk` with whoever stands at the place,
// U34c). The locations are the places' records: what is said there, who stands there, the art.
import type { RegionInput } from '@schema/region';

export const region = {
  id: 'region_threshold',
  name: 'The Threshold',
  description:
    'A shore of black sand under no sky, inside the Breach. The water is still and shows loops instead of reflections. There is no hunger, no clock, no wind. The Wayfinder arrives here when a loop ends and leaves by the Far Light.',
  order: 12,
  levelBand: { min: 1, max: 20 },
  palette: { bg: '#05060C', bgAlt: '#1A2140', fg: '#283055', accent: '#B8C7FF', glow: '#B8C7FF' },
  ambient: 'ambient_threshold',
  wanderingPool: [],
  returnEncounterChance: 0,
  codexId: 'codex_region_threshold',
  tags: ['threshold', 'no_combat', 'no_time'],
} satisfies RegionInput;
