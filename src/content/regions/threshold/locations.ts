// The Threshold — the four locations (WORLD §3.12 blocks; coordinates WORLD §11.1; edges WORLD §11.2; states WORLD §12.1
// `ws_threshold_n`, `ws_threshold_ended`). New locations: the descriptions are WORLD's, character for character. No band
// (WORLD: "none"), no rest, no fights (`safe`), no items to take; every place is `temporallyUnstable` (WORLD §12.3) and tagged
// `threshold` (validator rule 8: reached from the Still Shore, not from the start).
//
// The engine walks the Threshold as places (reducers/threshold.ts: `THRESHOLD_LOCATIONS` maps still_shore, gallery, loom and
// far_light to these ids; `thresholdGo` moves between them for free). The exits are WORLD's walk edges (0 watches: "the
// Threshold has no time"), the map's and the validator's. Two of WORLD's rows are not exits, as the Shattered Library's
// portal is not (U42; D-091): the Shore's "(arrival ⟂)" ("not a usable exit") and the Far Light's "step into the light ⟂" to
// the Whispering Ruins, which is the engine's `newLoop` ("Step into the light", DESIGN §10.8).
//
// Readings (listed in the U48b reply):
//   - loop numbers: at the Threshold the run is already the next loop's (D-082: "the state is already the next loop in
//     threshold mode"), and Loop 1's closers skip the Threshold (D-049), so the first visit is a Loop 3 state. WORLD's
//     "Loop N+" are kept as written (U34c's Dask scene reads `loop ≥ 3` the same way); `ev_shore_first`'s "Loop 1→2 only"
//     (written before D-049) is the first crossing, `loop ≤ 3`;
//   - "after any true ending" (`ws_threshold_ended`: "any true ending recorded in the profile") is any of STORY §12's
//     `echo_ending_a`..`_f`, which the engine grants on reaching each ending;
//   - Dask (home: the Shimmering Pass, U44) is listed on the Shore as well, so `talk` finds him there (U34c's fixture form;
//     his scenes carry the "from Loop 3");
//   - the Loom's station is PLAN §5.3's `craftingStation: 'loom'` (the engine finds the Loom by its place, not this field).
// D-098 (U34d): every arrival at a place — `thresholdGo`, or the Still Shore from an ending — fires its `enter` events (engine
// reducers/threshold.ts `thresholdArrival`; U48b pinned that none fired). WORLD §2.12's Loop 5 and Loop 7 water and the
// Gallery's epilogue paintings are art variants.
import type { Condition } from '@schema/condition';
import type { LocationInput } from '@schema/location';

const REGION = 'region_threshold';

/** WORLD §12.1 `ws_threshold_ended`: any true ending recorded in the profile (STORY §12 `echo_ending_a` .. `_f`). */
const ANY_ENDING: Condition = {
  any: [
    { echo: 'echo_ending_a' },
    { echo: 'echo_ending_b' },
    { echo: 'echo_ending_c' },
    { echo: 'echo_ending_d' },
    { echo: 'echo_ending_e' },
    { echo: 'echo_ending_f' },
  ],
};

export const locations = [
  // ---- The Still Shore — where a loop ends; Dask from Loop 3 (WORLD §3.12; D-012) --------------------------------------------
  {
    id: 'loc_still_shore',
    regionId: REGION,
    name: 'The Still Shore',
    description:
      'Black sand. Still water that shows no reflection, only what happened. No sky, but a light far out across the water. You arrive here standing, with nothing in your hands, and you remember everything.',
    exits: [
      { dir: 'west', to: 'loc_gallery_of_loops', travelWatches: 0 },
      { dir: 'east', to: 'loc_loom', travelWatches: 0 },
      { dir: 'south', to: 'loc_far_light', travelWatches: 0 },
    ],
    // "npc_dask (from Loop 3; conversation partner, D-012)": see the header
    npcs: ['npc_dask'],
    events: [
      // "once, Loop 1→2 only": the first crossing (see the header)
      { id: 'ev_shore_first', text: 'You are standing on a shore. You were in a library. You were falling. You are standing on a shore.', when: { loop: { max: 3 } } },
      { id: 'ev_shore_silhouette', text: 'Far out, under the water, something very large holds very still.', when: { loop: { min: 5 } } },
      { id: 'ev_shore_shards', text: 'Nearer now. Around the stillness, eight smaller stillnesses. One of them has her eyes.', when: { loop: { min: 7 } } },
    ],
    // WORLD §2.12: "Loop 5 the Tyrant's silhouette in the water; Loop 7 the Nine's shards visible"
    art: {
      template: 'threshold',
      horizon: 0.5,
      silhouettes: ['flat_shore', 'own_shadow', 'far_light'],
      particles: 'none',
      timeOfDay: 'timeless',
      variants: [
        { when: { loop: { min: 5, max: 6 } }, patch: { focal: 'tyrant_silhouette' } },
        { when: { loop: { min: 7 } }, patch: { focal: 'nine_shards' } },
      ],
    },
    safe: true,
    map: { x: 72, y: 14 },
    temporallyUnstable: true,
    tags: ['threshold', 'arrival'],
  },

  // ---- The Gallery of Loops — run history, one painting per loop (WORLD §3.12; D-011) ----------------------------------------
  {
    id: 'loc_gallery_of_loops',
    regionId: REGION,
    name: 'The Gallery of Loops',
    description:
      'A colonnade on the sand with one painting per loop. The paintings are of you. They are not flattering. Beneath each, a plaque with a number of days and a cause. The gallery is as long as it needs to be.',
    exits: [{ dir: 'east', to: 'loc_still_shore', travelWatches: 0 }],
    events: [
      { id: 'ev_gallery_ending', text: 'A new painting, larger than the others. It is not of you. It is of everyone.', when: ANY_ENDING },
      // "once, Loop 3+, while `q_seven_marks` is active (its Gallery stage …)"
      {
        id: 'ev_gallery_marks',
        text: 'Seven frames carry a scratch in the gilt, low on the left, where a hand would rest. The same hand.',
        when: { all: [{ loop: { min: 3 } }, { quest: { id: 'q_seven_marks', status: 'active' } }] },
      },
    ],
    // "after any true ending the Gallery shows the epilogue slides as paintings" (WORLD §2.12)
    art: {
      template: 'threshold',
      horizon: 0.6,
      silhouettes: ['receding_colonnade', 'framed_panels'],
      particles: 'none',
      timeOfDay: 'timeless',
      variants: [{ when: ANY_ENDING, patch: { focal: 'epilogue_paintings' } }],
    },
    safe: true,
    map: { x: 64, y: 14 },
    temporallyUnstable: true,
    tags: ['threshold', 'run_history'],
  },

  // ---- The Loom — Attunements, the five coats, the challenge modifiers (WORLD §3.12; D-008, D-011, D-021) ----------------------
  {
    id: 'loc_loom',
    regionId: REGION,
    name: 'The Loom',
    description:
      'A loom of driftwood strung with threads of light. Each thread is something you learned. Pull them taut and they stay taut when you wake. There is a chair in front of it and five coats on hooks behind.',
    exits: [{ dir: 'west', to: 'loc_still_shore', travelWatches: 0 }],
    events: [{ id: 'ev_loom_first_thread', text: 'You pull a thread. It hums the first note of the Litany.' }],
    // "thread-glints": motes
    art: { template: 'threshold', horizon: 0.6, silhouettes: ['loom_frame', 'light_threads', 'five_coats'], particles: 'motes', timeOfDay: 'timeless' },
    // "Attunement vendor (not a merchant; spends Resonance, D-011)"
    craftingStation: 'loom',
    safe: true,
    map: { x: 80, y: 14 },
    temporallyUnstable: true,
    tags: ['threshold', 'attunements'],
  },

  // ---- The Far Light — the door that is a morning (WORLD §3.12) ----------------------------------------------------------------
  {
    id: 'loc_far_light',
    regionId: REGION,
    name: 'The Far Light',
    description:
      'You walk toward the light across the water and the water holds you. The light is a door, and the door is a morning, and the morning smells of ozone and decay.',
    exits: [{ dir: 'north', to: 'loc_still_shore', travelWatches: 0 }],
    // "every loop": the schema's `once` is per loop
    events: [{ id: 'ev_far_light_step', text: 'You step. Somewhere a woman in faded robes looks up from a cold fire and sees a stranger, again.' }],
    // "light motes converging": motes
    art: { template: 'threshold', horizon: 0.5, silhouettes: ['light_path', 'doorway'], particles: 'motes', timeOfDay: 'timeless' },
    safe: true,
    map: { x: 72, y: 16 },
    temporallyUnstable: true,
    tags: ['threshold', 'far_light'],
  },
] satisfies LocationInput[];
