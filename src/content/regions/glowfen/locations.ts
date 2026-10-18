// The Glowfen — the eight locations (WORLD §3.9 blocks; coordinates WORLD §11.1; edges WORLD §11.2; state texts WORLD §12.1).
// New locations: the descriptions are WORLD's, character for character (no `+` sentence, no `legacyName`). Encounter notation and
// the ids are the Ruins' (../silverwood_ruins/locations.ts header): `first: X (p%)` is `chance: p` (rolls once, on the first
// visit; a 100 % group stays until cleared or scattered), `return: X (p%)` is `chance: p, respawn: 'on_return'`, "or pool 20 %" is
// the region's wandering pool (region.ts) behind it; the boss holds (R10-1). The schema's `once` is per loop, so WORLD's "once"
// and "once per loop" are the same field.
//
// Readings (each repeated where it applies; listed in the U47 reply):
//   - the pool nodes: the Causeway ("pool(glowfen) 20 %"), the Shallows and the Mangrove ("… or pool 20 %") are the three nodes
//     WORLD gives the pool; Lanternreed ("none (settlement)"), the Pool ("none while Wen lives"), the Barrows and the Gullet
//     (a return group and no pool) and the Hall ("forced boss") name none and are `safe`, and WORLD §10.3's sweep (1.7
//     expected return fights: 0.2 + 0.44 + 0.36 + 0.3 + 0.4) counts exactly that;
//   - the barrow light's share of the pool (WORLD §10.1: "barrow light at dusk/night only", 10 of the pool's 100): D-098 (U34d)
//     a pool entry carries a `when`, so it is the pool's own entry at dusk and night (region.ts; it was a 2 % location encounter
//     ahead of the pool at the Shallows and the Mangrove, 21.6 % in all). Not at the Causeway: WORLD's pool takes "only fodder
//     whose level sits in the band" (§10.1), read per node, and a level-11 light at the band-8 Causeway is the three-level jump
//     rule 11 warns about, so the entry's `when` names the Shallows and the Mangrove;
//   - the Barrows' first visit, "100 %, dusk/night; 40 % by day": two groups, a `chance: 1` one when it is dusk or night and a
//     40 % one by day, each ahead of the 30 % return group. A group at 100 % stays until cleared (the engine's rule), so a
//     daytime first visit that rolls nothing leaves the dusk/night group for a later visit by night at 100 % rather than the
//     return's 30 %. WORLD §10.3 counts the Barrows' first visit at 0.6 (sweep 4.4, through-route +1.6), which is neither;
//   - "item_barrow_light_vial (100 % after cr_barrow_light)" is a hidden item that appears once a light has been killed (the
//     Steppe's den form: `killed` is this loop's, so one vial a loop); the creature's own loot omits it (creatures.ts);
//   - an event whose grant carries a condition ("grants X with Mireya active") is two events with complementary `when`s, the
//     WORLD id on the one that grants and a coined `_plain` id on the one that does not, as the Reach's Names event and the
//     Steppe's. D-098 (U34d) added a per-effect condition (`onlyIf`), but the pair stays: a `once` event that fired without
//     Mireya could not grant when she comes along later in the loop;
//   - the Mangrove's `item_lanternwood_bow` ("Loop 2+, 100 % once, in a root-hollow, if Mireya is active") is hidden, as a
//     root-hollow is, and appears when the location is examined in Loop 2+ with Mireya in the party;
//   - the Hall: the Matron's own loot (creatures.ts) pays the brooch and the resin for the fight; the same two placed here are
//     the bypass's (Mireya active and her lantern carried, Sulis lulled, the Reach's Deep form), so the two never both pay.
//     "Lit" is a state no Condition reads: the bypass reads the lantern carried. `item_mireyas_lantern` is placed here "(Mireya's
//     quest)" for a Wayfinder with Mireya in the party; where the quest hands it over is the quest unit's;
//   - Elder Wen's cleansing (WORLD §3.9, DESIGN §6.7): the Pool is "Rest point: no" and §10.3 counts no rest there, and the
//     cleansing is "one full rest here + item_glow_moss ×3 … free with flag_heartstone_stabilized". So the Pool has a rest
//     that is open only while the cleansing is on offer (Corruption ≥ 6, the state WORLD §2.10 and §12.1 `ws_marked` give
//     it, and the three moss or the stabilized Heartstone), as the Library's nook is open to Ilyra Trusted, and two `rest` events do the cleansing: the paid one takes
//     the moss, the free one does not, and both set Corruption to 0 and `flag_corruption_cleansed`. The rest is a
//     'sanctum' (a camp would let a Wayfinder respec there). An event cannot tell a short rest from a full one, so a short
//     rest cleanses too; the 4 − watch time cost of a full rest is the rest's own;
//   - Elder Wen "sits with the elders at loc_lanternreed" (WORLD §4), and Lanternreed's block lists her, so both blocks list
//     her; her home is the Pool.
//
// The rain every second day, the Shallows' spore-fog and sinking are the places' `hazards` (U34e, D-096; see RAIN below).
// Not expressible yet (listed in the U47 reply): the Gullet's draw beyond its 2-watch haul west; "lit" for Mireya's lantern; Corruption cleansing at a full
// rest only. Exits to other regions name their WORLD ids: the Causeway's north exit is the Glowlands' (U45, resolved).
import type { Condition } from '@schema/condition';
import type { HazardInput, LocationInput } from '@schema/location';

/** WORLD §10.1: "barrow light at dusk/night only"; §3.9: the Barrows' first group is "100 %, dusk/night; 40 % by day". */
const DUSK_OR_NIGHT: Condition = { any: [{ watch: 'dusk' }, { watch: 'night' }] };
/** WORLD §3.9: "with Mireya active". */
const MIREYA_ACTIVE: Condition = { companion: { id: 'mireya' } };
/** WORLD §3.9 Hall: "with Mireya active and `item_mireyas_lantern` lit, Sulis is lulled" (lit: see the header). */
const SULIS_LULLED: Condition = { all: [MIREYA_ACTIVE, { item: { id: 'item_mireyas_lantern' } }] };
/** WORLD §12.1 `ws_marked`: Corruption ≥ 6 ("Marked for the Weavers", DESIGN §6.7), the state the Pool cleanses (§2.10). */
const MARKED: Condition = { corruption: { min: 6 } };
/** WORLD §3.9 Pool: the paid cleansing, "one full rest here + `item_glow_moss` ×3"; free with `flag_heartstone_stabilized`. */
const CLEANSE_PAID: Condition = {
  all: [MARKED, { item: { id: 'item_glow_moss', count: 3 } }, { not: { flag: 'flag_heartstone_stabilized' } }],
};
const CLEANSE_FREE: Condition = { all: [MARKED, { flag: 'flag_heartstone_stabilized' }] };
const CLEANSED = [{ corruption: -6 }, { setFlag: 'flag_corruption_cleansed' }] as const;
const POOL_CLEANSE_TEXT = 'Wen puts your hands in the light. Something in you lets go of a book. It takes six breaths.';


// U34e (D-096): WORLD §2.10's weather and hazards. Rain every second day, Soaked region-wide for the day: every fight on
// an even day opens with everyone Soaked. The Shallows: spore-fog at dawn (Poison for 1 turn at an ambush's onset) and
// sinking (Slow at every fight there; WORLD gives no duration, so the status's own). The Gullet's draw is its 2-watch
// exit west (loc_pale_gullet), nothing more.
const RAIN: Omit<HazardInput, 'id'> = { on: 'fight', cycle: { every: 2, days: [2] }, status: { id: 'status_soaked', to: 'all' } };
const SPORE_FOG: Omit<HazardInput, 'id'> = { on: 'ambush', when: { watch: 'dawn' }, status: { id: 'status_poison', duration: 1, to: 'party' } };
const SINKING: Omit<HazardInput, 'id'> = { on: 'fight', status: { id: 'status_slow', to: 'party' } };

export const locations = [
  // ---- The Lantern Causeway — the reed road; the lanterns that have no oil (WORLD §3.9, §12.1) ---------------------------------
  {
    id: 'loc_lantern_causeway',
    regionId: 'region_glowfen',
    name: 'The Lantern Causeway',
    description:
      'A road of lashed reeds a hand above the water, lit by lanterns on poles. The lanterns have no oil. The light comes up from the water and the glass only shapes it. Frogs the size of dogs watch from the reeds.',
    exits: [
      { dir: 'north', to: 'loc_veridian_glowlands' },
      { dir: 'south', to: 'loc_lanternreed' },
      { dir: 'east', to: 'loc_sporelight_shallows' },
    ],
    items: [{ itemId: 'item_glow_moss' }],
    encounters: [
      // first: Lantern Toads ×2 (50 %)
      {
        id: 'enc_causeway_toads',
        groups: [{ creatureId: 'cr_lantern_toad', count: 2 }],
        chance: 0.5,
        intro: 'Two throat-sacs light up in the reeds ahead, like lanterns on poles that nobody hung.',
      },
      // return: the pool at 20 % (its dusk-and-night barrow light leaves this node out: see the header)
    ],
    events: [{ id: 'ev_causeway_light', text: 'You lift a lantern. It is empty. The light stays where the lantern was.' }],
    art: { template: 'swamp', horizon: 0.6, silhouettes: ['reed_road', 'lantern_poles_in_perspective', 'frog_shapes'], particles: 'motes', timeOfDay: 'dusk' },
    levelBand: { min: 8, max: 8 },
    hazards: [{ id: 'glowfen_rain', ...RAIN }], // U34e (D-096)
    map: { x: 32, y: 12 },
    tags: ['entrance', 'causeway'],
  },

  // ---- Lanternreed — the village on stilts; the inn; Fennick's stall (WORLD §3.9, §9, §10.3) ------------------------------------
  {
    id: 'loc_lanternreed',
    regionId: 'region_glowfen',
    name: 'Lanternreed',
    description:
      'A village on stilts over a pool that rises and falls like a chest. Houses of reed and lantern-glass. Everyone here has a little light under the skin at the wrists and throat. They are kind to strangers and they do not go out at night any more.',
    exits: [
      { dir: 'north', to: 'loc_lantern_causeway' },
      { dir: 'east', to: 'loc_elder_mangrove' },
      { dir: 'south', to: 'loc_breathing_pool' },
    ],
    items: [{ itemId: 'item_antidote_root', count: 2 }],
    // "Encounters: none (settlement)"
    safe: true,
    npcs: ['npc_elder_tam', 'npc_elder_wen', 'npc_old_fennick', 'npc_mireya'],
    events: [
      // once per loop
      {
        id: 'ev_lanternreed_wrists',
        text: "A child shows you her wrists. The light under the skin pulses with the pool. 'Mam says it means we're chosen,' she says. Mireya, behind her, says nothing.",
      },
    ],
    art: { template: 'swamp', horizon: 0.58, silhouettes: ['stilt_houses', 'walkways', 'breathing_pool_rim'], particles: 'motes', timeOfDay: 'dusk' },
    // the inn: DESIGN §9.5 (full rest 10 gold); "LN inn" (WORLD §10.3)
    rest: { kind: 'inn', cost: 10 },
    merchantId: 'npc_old_fennick',
    levelBand: { min: 8, max: 9 },
    hazards: [{ id: 'glowfen_rain', ...RAIN }], // U34e (D-096)
    map: { x: 32, y: 14 },
    tags: ['inn', 'merchant', 'settlement', 'glowfen', 'companion_anchor'],
  },

  // ---- Sporelight Shallows — the fungal shelves; the light-dust (WORLD §3.9, §12.1) ---------------------------------------------
  {
    id: 'loc_sporelight_shallows',
    regionId: 'region_glowfen',
    name: 'Sporelight Shallows',
    description:
      'Knee-deep water over soft mud. Fungal shelves grow on every stump and shed light-dust when the wind moves. Breathing it is sweet, then it is not.',
    exits: [
      { dir: 'west', to: 'loc_lantern_causeway' },
      { dir: 'south', to: 'loc_elder_mangrove' },
    ],
    items: [{ itemId: 'mat_glow_gland', count: 3 }],
    encounters: [
      // first: Spore Drifts ×2 (70 %)
      {
        id: 'enc_shallows_spore_drifts',
        groups: [{ creatureId: 'cr_spore_drift', count: 2 }],
        chance: 0.7,
        intro: 'The light-dust above the water thickens and drifts toward you against the wind.',
      },
      // return: Glowfen Mirelings ×2 (30 %), then the pool at 20 % (with its dusk-and-night barrow light, D-098: see the header)
      {
        id: 'enc_shallows_mirelings',
        groups: [{ creatureId: 'cr_glowfen_mireling', count: 2 }],
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'Two shapes stand up out of the knee-deep water, glowing from the throat down.',
      },
    ],
    events: [{ id: 'ev_shallows_sweet', text: 'The air is sweet. You hold your breath too late and the shallows tilt.' }],
    art: { template: 'swamp', horizon: 0.62, silhouettes: ['stumps_with_fungal_shelves', 'mist_layer'], particles: 'spores', timeOfDay: 'dusk' },
    levelBand: { min: 9, max: 9 },
    // U34e (D-096)
    hazards: [{ id: 'glowfen_rain', ...RAIN }, { id: 'spore_fog', ...SPORE_FOG }, { id: 'shallows_sinking', ...SINKING }],
    map: { x: 40, y: 12 },
    tags: ['shallows', 'spores'],
  },

  // ---- The Elder Mangrove — the tree that answers; the root-hall (WORLD §3.9, §12.1) -----------------------------------------------
  {
    id: 'loc_elder_mangrove',
    regionId: 'region_glowfen',
    name: 'The Elder Mangrove',
    description:
      'One tree, old as the Sundering, its roots a hall. Light pools in the hollows of the roots like water. The elders used to meet here. They stopped when the tree began to answer.',
    exits: [
      { dir: 'north', to: 'loc_sporelight_shallows' },
      { dir: 'west', to: 'loc_lanternreed' },
      { dir: 'south', to: 'loc_firefly_barrows' },
      { dir: 'east', to: 'loc_pale_gullet' },
    ],
    items: [
      { itemId: 'mat_ley_resin', count: 2 },
      // "Loop 2+, 100 % once, in a root-hollow, if Mireya is active"
      { itemId: 'item_lanternwood_bow', hidden: true, when: { all: [{ loop: { min: 2 } }, MIREYA_ACTIVE] } },
    ],
    encounters: [
      // first: a Reed Stalker and a Glowfen Mireling (60 %)
      {
        id: 'enc_mangrove_stalker_mireling',
        groups: [{ creatureId: 'cr_reed_stalker' }, { creatureId: 'cr_glowfen_mireling' }],
        chance: 0.6,
        intro: 'The reeds go still. One of them is watching you, and something webbed rises beside it.',
      },
      // return: a Barrow-Light (20 %), then the pool at 20 % (with its dusk-and-night barrow light, D-098: see the header)
      {
        id: 'enc_mangrove_barrow_light',
        groups: [{ creatureId: 'cr_barrow_light' }],
        chance: 0.2,
        once: false,
        respawn: 'on_return',
        intro: 'A light comes down the roots, pacing. It has been waiting for someone to pass.',
      },
    ],
    events: [
      // once; "grants `echo_glowlands_leak` with Mireya active"
      {
        id: 'ev_mangrove_answer',
        text: "You ask the tree nothing. It answers anyway, in Elder Tam's voice: 'Not yet.'",
        when: MIREYA_ACTIVE,
        effects: [{ grantEcho: 'echo_glowlands_leak' }],
      },
      {
        id: 'ev_mangrove_answer_plain',
        text: "You ask the tree nothing. It answers anyway, in Elder Tam's voice: 'Not yet.'",
        when: { not: MIREYA_ACTIVE },
      },
    ],
    art: { template: 'swamp', horizon: 0.5, silhouettes: ['vast_root_hall', 'hanging_moss', 'light_pools'], particles: 'fireflies', timeOfDay: 'dusk' },
    levelBand: { min: 10, max: 10 },
    hazards: [{ id: 'glowfen_rain', ...RAIN }], // U34e (D-096)
    map: { x: 40, y: 14 },
    tags: ['mangrove', 'tree'],
  },

  // ---- The Breathing Pool — the well of light; Elder Wen's mat; the cleansing (WORLD §3.9, DESIGN §6.7) --------------------------
  {
    id: 'loc_breathing_pool',
    regionId: 'region_glowfen',
    name: 'The Breathing Pool',
    description:
      "Below Lanternreed the pool's source: a well of light that inhales for six heartbeats and exhales for six. Elder Wen keeps a reed mat at the edge. People who sit there come away lighter, or less.",
    exits: [
      { dir: 'north', to: 'loc_lanternreed' },
      { dir: 'east', to: 'loc_firefly_barrows' },
    ],
    items: [{ itemId: 'item_stillwater_phial' }],
    // "Encounters: none while Wen lives"
    safe: true,
    npcs: ['npc_elder_wen'],
    events: [
      // "fires on cleansing": a rest while the cleansing is on offer (see the header)
      { id: 'ev_pool_cleanse', text: POOL_CLEANSE_TEXT, trigger: 'rest', once: false, when: CLEANSE_PAID, effects: [{ takeItem: { item: 'item_glow_moss', count: 3 } }, ...CLEANSED] },
      // "free with `flag_heartstone_stabilized`"
      { id: 'ev_pool_cleanse_free', text: POOL_CLEANSE_TEXT, trigger: 'rest', once: false, when: CLEANSE_FREE, effects: [...CLEANSED] },
    ],
    art: { template: 'swamp', horizon: 0.6, silhouettes: ['round_well_of_light', 'reed_mat', 'seated_elder'], particles: 'motes', timeOfDay: 'dusk' },
    // "Rest point: no": open only while the cleansing is on offer (see the header)
    rest: { kind: 'sanctum', when: { any: [CLEANSE_PAID, CLEANSE_FREE] } },
    levelBand: { min: 9, max: 10 },
    hazards: [{ id: 'glowfen_rain', ...RAIN }], // U34e (D-096)
    map: { x: 32, y: 16 },
    tags: ['pool', 'elder', 'cleansing'],
  },

  // ---- Firefly Barrows — the mounds; the lights that keep watch (WORLD §3.9, §12.1) ---------------------------------------------
  {
    id: 'loc_firefly_barrows',
    regionId: 'region_glowfen',
    name: 'Firefly Barrows',
    description:
      "Low mounds in the water where the Glowfen bury their dead. The dead do not stay dark. Each barrow leaks a slow light that gathers at dusk into a shape and walks the mound's edge, keeping watch over itself.",
    exits: [
      { dir: 'west', to: 'loc_breathing_pool' },
      { dir: 'north', to: 'loc_elder_mangrove' },
      { dir: 'east', to: 'loc_matrons_hall' },
    ],
    items: [
      // "100 % after cr_barrow_light"
      { itemId: 'item_barrow_light_vial', hidden: true, when: { killed: { id: 'cr_barrow_light' } } },
      { itemId: 'mat_ley_resin' },
    ],
    encounters: [
      // first: a Barrow-Light (100 % at dusk and night; 40 % by day)
      {
        id: 'enc_barrows_light_night',
        groups: [{ creatureId: 'cr_barrow_light' }],
        when: DUSK_OR_NIGHT,
        intro: "At the mound's edge a light gathers into a shape and turns to face you.",
      },
      {
        id: 'enc_barrows_light_day',
        groups: [{ creatureId: 'cr_barrow_light' }],
        chance: 0.4,
        when: { not: DUSK_OR_NIGHT },
        intro: 'Even by day a pale light leaks from the mound and walks its edge toward you.',
      },
      // return: a Barrow-Light (30 %), and no pool (see the header)
      {
        id: 'enc_barrows_light_return',
        groups: [{ creatureId: 'cr_barrow_light' }],
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'The light on the barrow has gathered again, and it is walking toward you.',
      },
    ],
    safe: true,
    events: [
      // once, Loop 3+; grants `echo_seven_wayfinders` if not already held (a repeated grant is a no-op)
      {
        id: 'ev_barrows_names',
        text: "The lights speak names as they walk. Seven of them are Wayfinders'. The eighth is yours, and it has not been spoken yet.",
        when: { loop: { min: 3 } },
        effects: [{ grantEcho: 'echo_seven_wayfinders' }],
      },
    ],
    art: { template: 'swamp', horizon: 0.58, silhouettes: ['low_mounds', 'walking_light_figures'], particles: 'fireflies', timeOfDay: 'dusk' },
    levelBand: { min: 11, max: 11 },
    hazards: [{ id: 'glowfen_rain', ...RAIN }], // U34e (D-096)
    map: { x: 40, y: 16 },
    tags: ['barrows', 'graves'],
  },

  // ---- The Pale Gullet — the throat of pale roots; the haul west (WORLD §3.9, §11.2) -------------------------------------------------
  {
    id: 'loc_pale_gullet',
    regionId: 'region_glowfen',
    name: 'The Pale Gullet',
    description:
      'The swamp narrows into a throat of pale roots and the water runs fast and downhill. The light here is white, not green. The current wants you to go on. Leaving the Gullet west, upstream to the Mangrove, costs two watches of hauling against it.',
    exits: [
      // WORLD §3.9 and §11.2: "(costs 2 watches)"
      { dir: 'west', to: 'loc_elder_mangrove', travelWatches: 2 },
      { dir: 'south', to: 'loc_matrons_hall' },
    ],
    items: [{ itemId: 'mat_glow_gland', count: 2 }],
    encounters: [
      // first: Glowfen Mirelings ×3 (100 %; a scatter node, WORLD §10.4)
      {
        id: 'enc_gullet_mirelings',
        groups: [{ creatureId: 'cr_glowfen_mireling', count: 3 }],
        intro: 'Three Mirelings stand in the fast water ahead, lit white, and the current at your back wants you to go on.',
      },
      // return: Reed Stalkers ×2 (40 %), and no pool (see the header)
      {
        id: 'enc_gullet_stalkers',
        groups: [{ creatureId: 'cr_reed_stalker', count: 2 }],
        chance: 0.4,
        once: false,
        respawn: 'on_return',
        intro: 'Two grey-green waders step out of the pale roots, all neck and patience.',
      },
    ],
    safe: true,
    events: [{ id: 'ev_gullet_white', text: 'The light turns white. Lantern-glass would not shape this. Nothing would.' }],
    art: { template: 'swamp', horizon: 0.55, silhouettes: ['converging_pale_roots', 'fast_water'], particles: 'motes', timeOfDay: 'dusk' },
    levelBand: { min: 11, max: 12 },
    hazards: [{ id: 'glowfen_rain', ...RAIN }], // U34e (D-096)
    map: { x: 48, y: 14 },
    tags: ['gullet', 'current'],
  },

  // ---- Hall of the Lantern Matron — Sulis; the regional boss (WORLD §3.9, §6.6, §10.5) ---------------------------------------------
  {
    id: 'loc_matrons_hall',
    regionId: 'region_glowfen',
    name: 'Hall of the Lantern Matron',
    description:
      "A cavern under the swamp where the Breach-light pools thickest. On an island of roots sits what was Elder Mother Sulis of Lanternreed: vast, patient, her back a hill of lanterns that were once her children's names. She remembers all of them. She wants more.",
    exits: [
      { dir: 'north', to: 'loc_pale_gullet' },
      { dir: 'west', to: 'loc_firefly_barrows' },
    ],
    items: [
      // "(Mireya's quest)": see the header
      { itemId: 'item_mireyas_lantern', when: MIREYA_ACTIVE },
      // "100 % after boss", "after boss": the Matron's own loot pays these for the fight; placed here for the bypass (see the header)
      { itemId: 'item_lantern_moth_brooch', when: SULIS_LULLED },
      { itemId: 'mat_ley_resin', count: 4, when: SULIS_LULLED },
    ],
    encounters: [
      // the forced boss (WORLD §10.5): without Mireya active and her lit lantern; with both Sulis is lulled and the encounter is
      // skipped (`optionalWhen`). Bosses hold (R10-1); the toads are the Matron's own Calls (creatures.ts).
      {
        id: 'enc_hall_matron',
        groups: [{ creatureId: 'cr_lantern_matron' }],
        optionalWhen: SULIS_LULLED,
        fleeable: false,
        onFlee: 'hold',
        intro: 'The root island moves. The lanterns on her back brighten, one by one, and she hums.',
      },
    ],
    safe: true,
    events: [{ id: 'ev_hall_names', text: 'The lanterns on her back have names scratched in the glass. Mireya reads one and stops reading.' }],
    art: { template: 'cavern', horizon: 0.45, silhouettes: ['root_island', 'mountainous_seated_figure_hung_with_lanterns'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 12, max: 12 },
    hazards: [{ id: 'glowfen_rain', ...RAIN }], // U34e (D-096)
    map: { x: 48, y: 16 },
    tags: ['boss', 'regional_boss', 'cul_de_sac'],
  },
] satisfies LocationInput[];
