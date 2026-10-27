// Aether-Kissed Highlands — the three locations (WORLD §3.4 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates WORLD
// §11.3; state table WORLD §12.1; `temporallyUnstable` WORLD §12.3; legacy text legacy/aethelgard_data.py LOCATION_DEFS,
// verbatim, with WORLD's `+` sentence appended). Encounter notation and ids are the Ruins' (../silverwood_ruins/locations.ts
// header): `first: X (100%)` a plain group, `return: X (p%)` = `chance: p, respawn: 'on_return'`, the wandering pool the
// region's (region.ts). Legacy event ids take the `ev_` prefix the schema requires; the schema's `once` is kept per loop, so
// WORLD's "once" and "once per loop" are the same field. The legacy fights are `scatter` (WORLD §10.5: "the legacy Apex-road
// fights (Phantom, Weaver, Sentinel, Mireling, Aberration) are `scatter`"), the schema's default; D-144: a group that drops a
// quest item `regroup`s instead (gone until dawn: the Plateau's Harriers, Steppe Salt).
//
// The Skyreach ascents (WORLD §3.4, §11.2, `gate_thin_air`): the Spires' south exit and the Plateau's south exit climb into
// the Skyreach for 2 watches, behind the Talisman or `echo_high_mark`.
//
// DESIGN §10.5's Echo table makes two of the fixed fights optional: `echo_spire_note` ("Aetherial Weavers at the Spires are
// passive on first visit") and `echo_high_mark` ("Sky-Whisper Sentinels passive"). They are `optionalWhen` on the legacy
// encounter, as U43's Golem shortcut (DESIGN §13.3 #8): while the Echo is held the fight does not start.
//
// The Pass's mirage paths, the Spires' static and the Plateau's dusk gales are the places' `hazards` (U34e, D-094; see
// MIRAGE below). D-098 (U34d) made expressible: the Pass's 50 % Frayed Moment (an item's `chance`), the Spires'
// second shard after the first entry, and Dask's Loop 1 flicker (his NPC `schedule`, npcs.ts).
// Exits to other regions name their WORLD ids and stay pending until those units land (D-090).
import type { Condition } from '@schema/condition';
import type { HazardInput, LocationInput } from '@schema/location';

/** WORLD §11.3 `gate_thin_air`: the climb; without the Talisman the air at the top would tear the breath from you. */
const THIN_AIR: Condition = { any: [{ item: { id: 'item_sky_whisper_talisman' } }, { echo: 'echo_high_mark' }] };


// U34e (D-094): WORLD §2.4's hazards and weather. The Pass's mirage paths: on the first visit, a 25 % chance the chosen
// exit costs an extra watch, unless `echo_flickering_man`. The Spires' static discharge: Shock for 1 turn on entering
// combat ("cosmetic in Loop 1": from Loop 2). The Plateau's dusk gales: Haste to Skyborn creatures at a fight's opening.
const MIRAGE: Omit<HazardInput, 'id'> = {
  on: 'leave',
  firstVisit: true,
  chance: 0.25,
  watches: 1,
  when: { not: { echo: 'echo_flickering_man' } },
  text: 'You walked a path that was not there.',
};
const STATIC: Omit<HazardInput, 'id'> = { on: 'fight', when: { loop: { min: 2 } }, status: { id: 'status_shock', duration: 1, to: 'party' } };
const DUSK_GALE: Omit<HazardInput, 'id'> = { on: 'fight', when: { watch: 'dusk' }, status: { id: 'status_haste', to: 'enemies', creatureTag: 'skyborn' } };

export const locations = [
  // ---- Shimmering Pass — the bent path, Dask's cleft, the Phantom (WORLD §3.4; D-013, D-066.12) ---------------------------------
  {
    id: 'loc_shimmering_pass',
    regionId: 'region_aether_kissed_highlands',
    name: 'Shimmering Pass',
    legacyName: 'Shimmering Pass',
    description:
      'A narrow, winding path cuts between jagged, crystal-laced rock. Residual magic shimmers in the air, bending distance and tricking the eye. A man stands in a cleft of the rock and is not there, and is there again.',
    exits: [
      { dir: 'west', to: 'loc_heartstone_depths' },
      { dir: 'east', to: 'loc_aetherium_spires' },
    ],
    items: [
      { itemId: 'item_chronal_dust' }, // legacy
      // WORLD: "mat_frayed_moment ×1 (50% after killing cr_shimmering_phantom)": hidden (found by examine) once the Phantom has
      // fallen this loop; D-098 (U34d): at its own 50 % (was 100 %, D-091 gap 1; as U43's Peaks hide)
      { itemId: 'mat_frayed_moment', hidden: true, chance: 0.5, when: { killed: { id: 'cr_shimmering_phantom' } } },
    ],
    encounters: [
      // first: the Phantom (100 %, legacy)
      { id: 'enc_pass_phantom', groups: [{ creatureId: 'cr_shimmering_phantom' }], intro: 'The path doubles. One of the two has teeth.' },
      // return: Moment Moths ×3 (30 %), then the pool's 20 %
      {
        id: 'enc_pass_moths',
        groups: [{ creatureId: 'cr_moment_moth', count: 2 }], // U81b2: 2, was 3 (76 % deaths at a median L5 on the road east)
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'Three grey wings settle on the rock, waiting for a bare wrist.',
      },
    ],
    npcs: ['npc_dask'],
    events: [
      { id: 'ev_pass_shimmer', text: 'Light fractures into false paths, then snaps back into focus.' },
      { id: 'ev_pass_flicker', text: "In the cleft a man in a Wayfinder's coat raises a hand. He is gone before it finishes rising." },
      // "Dask shows the true path; the Echo is STORY §12's" (`echo_flickering_man`, from `q_the_flickering_man`)
      {
        id: 'ev_pass_true_path',
        text: 'You remember which path is real. The others fold away ashamed.',
        when: { echo: 'echo_flickering_man' },
      },
    ],
    art: { template: 'peaks', horizon: 0.5, silhouettes: ['crystal_rock_walls', 'doubled_path', 'dasks_cleft'], particles: 'shards', timeOfDay: 'day' },
    // "Dask's hollow, a cleft that is always the same temperature"
    rest: { kind: 'camp', text: "You rest in Dask's hollow, a cleft that is always the same temperature." },
    levelBand: { min: 6, max: 7 },
    hazards: [{ id: 'mirage_paths', ...MIRAGE }], // U34e (D-094)
    map: { x: 8, y: 10 },
    temporallyUnstable: true,
    tags: ['legacy', 'camp', 'companion_anchor', 'mirage'],
  },

  // ---- Aetherium Spires — the humming basin; the Weaver; the climb (WORLD §3.4, §11.3 `gate_thin_air`; §12.1 `ws_loop_3`) --------
  {
    id: 'loc_aetherium_spires',
    regionId: 'region_aether_kissed_highlands',
    name: 'Aetherium Spires',
    legacyName: 'Aetherium Spires',
    description:
      'Colossal crystalline spires rise in a wide basin and hum with raw energy. Ethereal creatures drift between them, trailing pale light. The tallest spire has steps cut into its flank, spiralling up out of sight.',
    exits: [
      { dir: 'west', to: 'loc_shimmering_pass' },
      { dir: 'east', to: 'loc_sky_whisper_plateau' },
      // the climb into the Skyreach: 2 watches up (WORLD §11.2), behind the Talisman or `echo_high_mark`
      { dir: 'south', to: 'loc_spire_crown', when: THIN_AIR, travelWatches: 2 },
    ],
    items: [
      { itemId: 'item_aetherium_shard' }, // legacy; the loop resets it
      // "a second shard appears here with flag_heartstone_stabilized": D-098 (U34d) an entry appears on the first arrival at
      // which its condition holds, so it lies here on the next visit after the stabilizing (D-091 gap 2)
      { itemId: 'item_aetherium_shard', when: { flag: 'flag_heartstone_stabilized' } },
    ],
    encounters: [
      // first: the Weaver (100 %, legacy); `echo_spire_note` makes it passive (DESIGN §10.5)
      {
        id: 'enc_spires_weaver',
        groups: [{ creatureId: 'cr_aetherial_weaver' }],
        optionalWhen: { echo: 'echo_spire_note' },
        intro: 'A strand of light unspools from the nearest spire and turns toward you.',
      },
      // Loop 3+: the Tyrant's Reach (10 %, once per loop), first among the return rolls so its 10 % is WORLD's
      {
        id: 'enc_spires_tyrants_reach',
        groups: [{ creatureId: 'cr_tyrants_reach' }],
        chance: 0.1,
        when: { loop: { min: 3 } },
        respawn: 'on_return',
        intro: 'The air at the foot of a spire stops moving, then reaches.',
      },
      // return: Glass Motes ×2 (30 %), then the pool's 20 %
      {
        id: 'enc_spires_glass_motes',
        groups: [{ creatureId: 'cr_glass_mote', count: 2 }],
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'Two hand-sized chips of crystal lift off the basin floor, spinning.',
      },
    ],
    events: [
      { id: 'ev_spires_hum', text: 'The spires throb in unison, a slow heartbeat of raw arcana.' },
      {
        id: 'ev_spires_tuned',
        text: 'The hum is not random. It is a chord, held for five hundred years, and it is a little flat.',
        when: { echo: 'echo_litany_verse_1' },
      },
    ],
    // WORLD's particles are "pale light trails arcing between spires"; motes is the nearest preset. Heartstone destroyed:
    // "the Spires dim" (WORLD §2.4): the trails stop, as the Depths' (../silverwood_ruins/locations.ts)
    art: {
      template: 'spires',
      horizon: 0.4,
      silhouettes: ['five_spires', 'basin_rim', 'spiral_stair'],
      particles: 'motes',
      timeOfDay: 'dusk',
      variants: [{ when: { flag: 'flag_heartstone_destroyed' }, patch: { particles: 'none' } }],
    },
    levelBand: { min: 7, max: 8 },
    hazards: [{ id: 'spires_static', ...STATIC }], // U34e (D-094)
    map: { x: 16, y: 10 },
    temporallyUnstable: true,
    tags: ['legacy', 'aether_road'],
  },

  // ---- Sky-Whisper Plateau — the markers; the Sentinel; the wind-shelter; the way north and up (WORLD §3.4, §11.3) -----------------
  {
    id: 'loc_sky_whisper_plateau',
    regionId: 'region_aether_kissed_highlands',
    name: 'Sky-Whisper Plateau',
    legacyName: 'Sky-Whisper Plateau',
    description:
      "A windswept, high shelf opens to wide views of the fractured land. Weathered stone markers stand like sentries, and a hard climb leads north to the Blighted Outpost. On the shelf's southern lip a stair has been cut into the wind itself, its steps visible only when a gust crosses them.",
    exits: [
      { dir: 'west', to: 'loc_aetherium_spires' },
      { dir: 'east', to: 'loc_veridian_glowlands' },
      { dir: 'north', to: 'loc_blighted_outpost' },
      // the climb into the Skyreach: 2 watches up (WORLD §11.2), behind the Talisman or `echo_high_mark`
      { dir: 'south', to: 'loc_windward_stair', when: THIN_AIR, travelWatches: 2 },
    ],
    // legacy; "also guaranteed drop from the Sentinel: the second copy is a Trinket upgrade material at Borin's" (creatures.ts)
    items: [{ itemId: 'item_sky_whisper_talisman' }],
    encounters: [
      // first: the Sentinel (100 %, legacy); `echo_high_mark` makes it passive (DESIGN §10.5)
      {
        id: 'enc_plateau_sentinel',
        groups: [{ creatureId: 'cr_sky_whisper_sentinel' }],
        optionalWhen: { echo: 'echo_high_mark' },
        intro: 'A guardian turns on its marker, vanes spread, and the wind turns with it.',
      },
      // return: Steppe Harriers ×2 (25 %), then the pool's 20 %
      {
        id: 'enc_plateau_harriers',
        groups: [{ creatureId: 'cr_steppe_harrier', count: 2 }],
        onFlee: 'regroup', // D-144: drops a quest item; fled, it is back at dawn
        chance: 0.25,
        once: false,
        respawn: 'on_return',
        intro: 'Two shadows drop out of the white sky.',
      },
    ],
    events: [
      { id: 'ev_plateau_gale', text: 'The wind murmurs in broken syllables, as if the sky itself is speaking.' },
      { id: 'ev_plateau_view', text: 'From here you can see the Apex. It is not where it was yesterday.', when: { loop: { min: 2 } } },
      // U57 (STORY §11.3 `q_high_mark`, "discovery (the Windward Stair above the Plateau)"; Loop 1 open): the stair in the wind,
      // until the quest is in the journal; the scene says the line (shared/dialogues/regional.ts)
      {
        id: 'ev_plateau_stair',
        trigger: 'interact',
        label: 'Look up the stair in the wind',
        text: 'Above the plateau the markers point up. The Nomads say the sky can be seen from its edge.',
        once: false,
        when: { not: { quest: { id: 'q_high_mark' } } },
        effects: [{ startDialogue: 'scene_plateau_stair' }],
      },
    ],
    // WORLD's particles are "fast horizontal wind streaks"; ash is the nearest preset (the streaks are the UI unit's)
    art: { template: 'sky', horizon: 0.35, silhouettes: ['standing_markers', 'shelf_edge', 'apex_seams'], particles: 'ash', timeOfDay: 'dusk' },
    // "a wind-shelter among the markers"
    rest: { kind: 'camp', text: 'You rest in a wind-shelter among the markers.' },
    levelBand: { min: 8, max: 10 },
    hazards: [{ id: 'plateau_gale', ...DUSK_GALE }], // U34e (D-094)
    map: { x: 24, y: 10 },
    temporallyUnstable: true,
    tags: ['legacy', 'camp', 'aether_road', 'thin_air'],
  },
] satisfies LocationInput[];
