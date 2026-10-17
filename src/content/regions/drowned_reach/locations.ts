// The Drowned Reach — the eight locations (WORLD §3.6 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates WORLD
// §11.3; state texts WORLD §12.1). New locations: the descriptions are WORLD's, character for character (no `+` sentence,
// no `legacyName`). Encounter notation and the ids are the Ruins' (../silverwood_ruins/locations.ts header): `first: X (p%)`
// is `chance: p` (rolls once, on the first visit; a 100 % group stays until cleared or scattered), `return: X (p%)` is
// `chance: p, respawn: 'on_return'`, "or pool 20 %" is the region's wandering pool (region.ts) behind it; the boss holds
// (R10-1). The schema's `once` is per loop, so WORLD's "once" and "once per loop" are the same field.
//
// Readings (each repeated where it applies; listed in the U46 reply):
//   - the dark gate (WORLD §3.6, `gate_drowned_dark`): the Stair's two exits other than east need the Glyphbound Lantern in
//     every loop. The Depths ↔ Cistern crack (`gate_cistern_crack`) is the Cistern's east exit;
//   - WORLD names no pool on the Black Sluice and the Bellmouth ("return: X (p%)" and nothing else), and §10.3's expected
//     return fights (2.0 over the sweep) count p alone, so those two are `safe` (the schema's "no wandering roll"; the
//     fixed `on_return` groups still roll), as the Apex is (U45);
//   - an event whose grant carries a condition ("grants X with {rep…}") is two events with complementary `when`s, the
//     WORLD id on the one that grants and a coined `_plain` id on the one that does not (an event's effects carry no
//     per-effect condition: U34d's gap);
//   - an item WORLD gives a chance ("40 %", "30 %, caught in a grate") is placed `hidden` at 100 % (a location item has
//     no chance field: U34d's gap 1, as the Ruins' wax seal);
//   - the Bell-Warden's Deep: the Warden's own loot (creatures.ts) pays the key, the clapper and the Hydromancy for the
//     fight; the key and the Hydromancy placed here are the bypass's (the Warden surrenders them to one who says the Warden
//     of Waters' name, `echo_rhune_choice`, and the fight is then skipped, so the two never both pay).
//
// Not expressible yet (listed in the U46 reply): the Soaked-on-entry rule and the lamp-dark/Lanterns-only state (region.ts).
// Exits to other regions name their WORLD ids and stay pending until those units land (D-090).
import type { Condition } from '@schema/condition';
import type { LocationInput } from '@schema/location';

/** WORLD §11.3 `gate_drowned_dark`: no Echo alternative. */
const LANTERN: Condition = { item: { id: 'item_glyphbound_lantern' } };
const DARK_LOCKED = 'The dark past the lamps is not ordinary dark. Without the glyph-etched lantern you will not go into it.';
/** WORLD §11.3 `gate_cistern_crack`. */
const CRACK_OPEN: Condition = { any: [{ item: { id: 'item_cistern_key' } }, { flag: 'flag_heartstone_destroyed' }, { echo: 'echo_archive_door' }] };
/** WORLD §11.3 `gate_sluice_walkway`: at night the water rises over the walkway, both ways. */
const WALKWAY_OPEN: Condition = { any: [{ item: { id: 'item_cistern_key' } }, { not: { watch: 'night' } }] };
const WALKWAY_LOCKED = 'The water has risen over the walkway. It will fall again by morning.';

export const locations = [
  // ---- The Drowned Stair — the Archives' stair goes down under the water; the dark gate (WORLD §3.6, §11.3) ------------------
  {
    id: 'loc_drowned_stair',
    regionId: 'region_drowned_reach',
    name: 'The Drowned Stair',
    description:
      'The stair goes down under the water and keeps going. Lamps burn on every ninth step, under the surface, without wavering. The dark below the lamps is not the dark of a cellar. It looks back.',
    exits: [
      { dir: 'east', to: 'loc_sunken_archives' },
      { dir: 'west', to: 'loc_tidewell_hall', when: LANTERN, lockedText: DARK_LOCKED },
      { dir: 'south', to: 'loc_cistern_of_names', when: LANTERN, lockedText: DARK_LOCKED },
    ],
    items: [{ itemId: 'item_brine_draught' }],
    encounters: [
      // first: Brine Lampreys ×2 (60 %); return: the pool at 20 %
      {
        id: 'enc_stair_lampreys',
        groups: [{ creatureId: 'cr_brine_lamprey', count: 2 }],
        chance: 0.6,
        intro: 'Two pale shapes uncoil from the lamp-posts under the water.',
      },
    ],
    events: [{ id: 'ev_stair_lamps', text: 'The lamps under the water do not flicker. Someone tends them.' }],
    art: { template: 'undercity', horizon: 0.7, silhouettes: ['descending_stair', 'lamp_posts_under_waterline', 'vaulted_ceiling'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 4, max: 4 },
    map: { x: -8, y: 8 },
    tags: ['dark_gate'],
  },

  // ---- Tidewell Hall — the guildhall with the water at chest height; the first Echo of the Warden's choice (WORLD §3.6) ------
  {
    id: 'loc_tidewell_hall',
    regionId: 'region_drowned_reach',
    name: 'Tidewell Hall',
    description:
      'A guildhall with the water at chest height. Long tables stand in rows, their benches tucked in. Ledgers float open at the same page. A clerk in a drowned coat walks the rows, checking names.',
    exits: [
      { dir: 'east', to: 'loc_drowned_stair' },
      { dir: 'south', to: 'loc_lamplighters_rest' },
    ],
    items: [{ itemId: 'mat_sodden_vellum', count: 2 }],
    encounters: [
      // first: a Tide Clerk and a Drowned Archivist (100 %)
      {
        id: 'enc_tidewell_clerk_archivist',
        groups: [{ creatureId: 'cr_tide_clerk' }, { creatureId: 'cr_drowned_archivist' }],
        intro: 'A clerk in a drowned coat looks up from the ledger. Beside it a reader keeps its place with a wet finger.',
      },
      // return: a Tide Clerk (30 %), else the pool at 20 %
      {
        id: 'enc_tidewell_clerk',
        groups: [{ creatureId: 'cr_tide_clerk' }],
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'A pen scratches in the next row. Then it stops, at your name.',
      },
    ],
    events: [
      {
        id: 'ev_tidewell_ledger',
        text: "A ledger lists the drowned by street. The last entry is in a different hand: 'and the Warden of Waters, by her own choice.'",
        effects: [{ grantEcho: 'echo_rhune_choice' }],
      },
    ],
    art: { template: 'undercity', horizon: 0.62, silhouettes: ['table_rows_at_waterline', 'hanging_guild_banners', 'clerks_desk_on_dais'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 4, max: 5 },
    map: { x: -16, y: 8 },
    tags: ['ledger'],
  },

  // ---- The Cistern of Names — the wall of names; the crack to the Depths (WORLD §3.6, §11.3) -------------------------------
  {
    id: 'loc_cistern_of_names',
    regionId: 'region_drowned_reach',
    name: 'The Cistern of Names',
    description:
      'A round cistern with a walkway at its rim. Every stone of the wall bears a name cut deep. Water pours in from a crack in the east wall and the names nearest it have been worn away to nothing.',
    exits: [
      { dir: 'north', to: 'loc_drowned_stair' },
      // WORLD §11.3 `gate_cistern_crack`: the key, or the Heartstone destroyed, or the Archive's door
      { dir: 'east', to: 'loc_heartstone_depths', when: CRACK_OPEN },
      { dir: 'south', to: 'loc_black_sluice' },
      { dir: 'west', to: 'loc_lamplighters_rest' },
    ],
    // WORLD: ×1 (40 %). A location item has no chance field (U34d's gap 1): it lies hidden, as the Ruins' wax seal.
    items: [{ itemId: 'mat_drowned_pearl', hidden: true }],
    encounters: [
      // first: Pale Divers ×2 (70 %); return: the pool at 20 %
      {
        id: 'enc_cistern_divers',
        groups: [{ creatureId: 'cr_pale_diver', count: 2 }],
        chance: 0.7,
        intro: 'Two pale figures stand on the rim, each holding a lamp that has not been lit in a hundred years.',
      },
    ],
    events: [
      // grants `echo_oriel_lineage` with `{rep:{faction:"remnants",min:20}}`: the grant is its own event (see the header)
      {
        id: 'ev_cistern_names',
        text: 'You find a name you know on the wall. DANTHE. Below it, smaller: and her daughter.',
        when: { rep: { faction: 'remnants', min: 20 } },
        effects: [{ grantEcho: 'echo_oriel_lineage' }],
      },
      {
        id: 'ev_cistern_names_plain',
        text: 'You find a name you know on the wall. DANTHE. Below it, smaller: and her daughter.',
        when: { not: { rep: { faction: 'remnants', min: 20 } } },
      },
    ],
    art: { template: 'undercity', horizon: 0.55, silhouettes: ['round_wall_of_names', 'rim_walkway', 'pouring_crack'], particles: 'rain', timeOfDay: 'timeless' },
    levelBand: { min: 5, max: 5 },
    map: { x: -8, y: 10 },
    tags: ['names', 'crack'],
  },

  // ---- Lamplighters' Rest — the dry room above the waterline; Sedge's stall; the only rest (WORLD §3.6, §9) -------------------
  {
    id: 'loc_lamplighters_rest',
    regionId: 'region_drowned_reach',
    name: "Lamplighters' Rest",
    description:
      'A dry room above the waterline, reached by a ladder. Lamps hang from every hook. Oil in jars, nets drying, a kettle. Two Remnants live here and keep the lamps below lit, because the dead do not like the dark either.',
    exits: [
      { dir: 'north', to: 'loc_tidewell_hall' },
      { dir: 'east', to: 'loc_cistern_of_names' },
      { dir: 'west', to: 'loc_sunken_scriptorium' },
      { dir: 'south', to: 'loc_bellmouth' },
    ],
    items: [{ itemId: 'item_lantern_oil', count: 2 }],
    // "none (settlement)"
    safe: true,
    npcs: ['npc_sedge_marrow', 'npc_pellam'],
    events: [
      {
        id: 'ev_rest_kettle',
        text: "Pellam pours you something hot without asking. 'The bell rang twice last night,' he says. 'It never rings twice.'",
      },
    ],
    art: { template: 'camp', horizon: 0.66, silhouettes: ['hanging_lamps_in_a_row', 'ladder_down', 'drying_nets'], particles: 'motes', timeOfDay: 'timeless' },
    // the camp: a free rest (WORLD §11.1 rest `camp`)
    rest: { kind: 'camp' },
    merchantId: 'npc_sedge_marrow',
    levelBand: { min: 5, max: 5 },
    map: { x: -16, y: 10 },
    tags: ['camp', 'merchant', 'settlement', 'remnants'],
  },

  // ---- The Sunken Scriptorium — the lectern; the first Litany page; the elite guard (WORLD §3.6, §10.4) ----------------------
  {
    id: 'loc_sunken_scriptorium',
    regionId: 'region_drowned_reach',
    name: 'The Sunken Scriptorium',
    description:
      'Desks in tiers, like a theatre, all facing one lectern. The water here is clear as glass and the ink in the open books has not run. At the lectern a stack of pages bound in Remnant wax is still being written, by no one.',
    exits: [
      { dir: 'east', to: 'loc_lamplighters_rest' },
      { dir: 'south', to: 'loc_bell_wardens_deep' },
    ],
    items: [
      { itemId: 'item_litany_page_1' }, // the lectern, 100 %
      // Loop 2+ or `echo_oriel_lineage`
      { itemId: 'item_oriels_ledger', when: { any: [{ loop: { min: 2 } }, { echo: 'echo_oriel_lineage' }] } },
      { itemId: 'mat_sodden_vellum', count: 2 },
    ],
    encounters: [
      // first: a Ledger Choir and two Drowned Archivists (100 %; the elite guard, a scatter node)
      {
        id: 'enc_scriptorium_choir',
        groups: [{ creatureId: 'cr_ledger_choir' }, { creatureId: 'cr_drowned_archivist', count: 2 }],
        intro: 'Around the lectern the drowned stand in a ring and read one name aloud.',
      },
      // Loop 3+ (WORLD §12.1 `ws_loop_3`): the Unmade, 20 % — first among the return rolls so its 20 % is WORLD's
      {
        id: 'enc_scriptorium_unmade',
        groups: [{ creatureId: 'cr_unmade' }],
        chance: 0.2,
        when: { loop: { min: 3 } },
        once: false,
        respawn: 'on_return',
        intro: 'Between two desks the air has been rubbed out. Something steps from the blank.',
      },
      // return: two Drowned Archivists (30 %), else the pool at 20 %
      {
        id: 'enc_scriptorium_archivists',
        groups: [{ creatureId: 'cr_drowned_archivist', count: 2 }],
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'Two readers look up from the nearest desk, a finger on the line.',
      },
    ],
    events: [
      {
        id: 'ev_scriptorium_hand',
        text: "The hand on the pages is Oriel Danthe's. You know it from a scroll you carried to a woman with the same hand.",
        effects: [{ grantEcho: 'echo_oriel_lineage' }],
      },
    ],
    art: { template: 'archive', horizon: 0.6, silhouettes: ['tiered_desks', 'lectern_pool_of_light', 'tall_shelves'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 6, max: 7 },
    map: { x: -24, y: 10 },
    tags: ['scriptorium', 'elite'],
  },

  // ---- The Black Sluice — the channel; the night gate; the lampreys (WORLD §3.6, §11.3) ---------------------------------------
  {
    id: 'loc_black_sluice',
    regionId: 'region_drowned_reach',
    name: 'The Black Sluice',
    description:
      'A channel of fast black water between iron grates. The current pulls toward the west. Pale shapes with too many mouths wait in the eddies where the grates have rusted through.',
    exits: [
      { dir: 'north', to: 'loc_cistern_of_names' },
      // WORLD §11.3 `gate_sluice_walkway`, both directions (W1)
      { dir: 'west', to: 'loc_bellmouth', when: WALKWAY_OPEN, lockedText: WALKWAY_LOCKED },
    ],
    // WORLD: ×1 (30 %, caught in a grate): hidden, at 100 % (see the header)
    items: [{ itemId: 'mat_bell_bronze', hidden: true }],
    encounters: [
      // first: Brine Lampreys ×3 (100 %)
      {
        id: 'enc_sluice_lampreys',
        groups: [{ creatureId: 'cr_brine_lamprey', count: 3 }],
        intro: 'Three pale shapes uncurl from the eddies where the grates have rusted through.',
      },
      // return: Brine Lampreys ×2 (40 %), and no pool (see the header)
      {
        id: 'enc_sluice_lampreys_return',
        groups: [{ creatureId: 'cr_brine_lamprey', count: 2 }],
        chance: 0.4,
        once: false,
        respawn: 'on_return',
        intro: 'The eddies by the grates are not empty.',
      },
    ],
    safe: true,
    events: [
      // DESIGN §9: "Drowned Reach sluice draining 1 watch" — the pull costs a watch (an event's time cost, D-069.5)
      { id: 'ev_sluice_pull', text: 'The current wants you west. Something in the west wants you too.', effects: [{ passWatches: 1 }] },
    ],
    art: { template: 'undercity', horizon: 0.64, silhouettes: ['iron_grates', 'channel_walls', 'far_gate'], particles: 'rain', timeOfDay: 'timeless' },
    levelBand: { min: 6, max: 6 },
    map: { x: -8, y: 12 },
    tags: ['sluice', 'night_gate'],
  },

  // ---- The Bellmouth — the fallen bell-tower; the Bell-Ringer (WORLD §3.6, §10.4) -------------------------------------------
  {
    id: 'loc_bellmouth',
    regionId: 'region_drowned_reach',
    name: 'The Bellmouth',
    description:
      'The channel opens into a flooded bell tower lying on its side. The great bell fills the far end like a shell. Something lives inside it. When the water moves, the bell speaks one low note and the drowned stand up.',
    exits: [
      { dir: 'east', to: 'loc_black_sluice', when: WALKWAY_OPEN, lockedText: WALKWAY_LOCKED },
      { dir: 'north', to: 'loc_lamplighters_rest' },
      { dir: 'west', to: 'loc_bell_wardens_deep' },
    ],
    items: [{ itemId: 'mat_bell_bronze', count: 2 }],
    encounters: [
      // first: a Bell-Ringer and a Drowned Archivist (100 %; the elite, a scatter node)
      {
        id: 'enc_bellmouth_ringer',
        groups: [{ creatureId: 'cr_bell_ringer' }, { creatureId: 'cr_drowned_archivist' }],
        intro: 'Something inside the bell takes up its rope. Beside the shell a reader opens a book.',
      },
      // return: Pale Divers ×2 (35 %), and no pool (see the header)
      {
        id: 'enc_bellmouth_divers',
        groups: [{ creatureId: 'cr_pale_diver', count: 2 }],
        chance: 0.35,
        once: false,
        respawn: 'on_return',
        intro: 'Two pale divers rise from the flooded tower, lamps in their hands.',
      },
    ],
    safe: true,
    events: [
      {
        id: 'ev_bellmouth_note',
        text: 'The bell speaks. The note is the first note of the Litany. You did not know the Litany had notes.',
        when: { echo: 'echo_litany_verse_1' },
      },
    ],
    art: { template: 'undercity', horizon: 0.52, silhouettes: ['fallen_tower_ribs', 'great_bell_on_its_side', 'standing_drowned_figures'], particles: 'static', timeOfDay: 'timeless' },
    levelBand: { min: 7, max: 7 },
    map: { x: -16, y: 12 },
    tags: ['bell', 'elite'],
  },

  // ---- The Bell-Warden's Deep — the regional boss; the key (WORLD §3.6, §6.3, §10.5) -----------------------------------------
  {
    id: 'loc_bell_wardens_deep',
    regionId: 'region_drowned_reach',
    name: "The Bell-Warden's Deep",
    description:
      "Under the bell the floor drops into a well of black water lit from far below. The Warden sits in it with the bell's clapper across its knees, a drowned giant in the Warden of Waters' chain of office, and waits for the hour it was told to ring.",
    exits: [
      { dir: 'east', to: 'loc_bellmouth' },
      { dir: 'north', to: 'loc_sunken_scriptorium' },
    ],
    // The fight's loot (key, clapper, Hydromancy) is the Warden's (creatures.ts). Placed here: the bypass's share, "the
    // Warden surrenders the key to one who says the Warden of Waters' name" (`echo_rhune_choice`), and the Hydromancy
    // that goes with a clear without a fight. With the Echo the fight is skipped (below), so nothing is paid twice.
    items: [
      { itemId: 'item_cistern_key', when: { echo: 'echo_rhune_choice' } },
      { itemId: 'item_rhunes_hydromancy', when: { echo: 'echo_rhune_choice' } },
    ],
    encounters: [
      // the forced boss (WORLD §10.5): without `echo_rhune_choice`; with it the player says the Warden of Waters' name and
      // the encounter is skipped (`optionalWhen`, the Golem shortcut's form). Bosses hold (R10-1); the adds are the
      // Warden's own calls (creatures.ts).
      {
        id: 'enc_deep_bell_warden',
        groups: [{ creatureId: 'cr_bell_warden' }],
        optionalWhen: { echo: 'echo_rhune_choice' },
        fleeable: false,
        onFlee: 'hold',
        intro: 'In the well the drowned giant shifts its grip on the clapper.',
      },
    ],
    events: [{ id: 'ev_deep_hour', text: "The Warden lifts its head. 'Is it the hour?' it asks, in the voice of a city." }],
    art: { template: 'cavern', horizon: 0.45, silhouettes: ['well', 'seated_giant_with_clapper', 'hanging_chains'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 8, max: 8 },
    map: { x: -24, y: 12 },
    tags: ['boss', 'regional_boss'],
  },
] satisfies LocationInput[];
