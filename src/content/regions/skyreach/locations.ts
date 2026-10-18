// The Skyreach — the five locations (WORLD §3.10 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates WORLD §11.3; states
// WORLD §12.1 `ws_heartstone_destroyed`, `ws_loop_2`; `temporallyUnstable` WORLD §12.3). New locations: the descriptions are
// WORLD's, character for character (no `+` sentence, no `legacyName`), as play text: the Eyrie loses WORLD's editorial
// parenthesis "(The id was `loc_aldours_eyrie` before U9; D-063's spelling is Aulde.)" and the Perch its "(D-067.12)".
// Encounter notation and the ids are the Ruins' (../silverwood_ruins/locations.ts header): `first: X (p%)` is `chance: p`
// (rolls once, on the first visit; a 100 % group stays until cleared or scattered), `return: X (p%)` is `chance: p,
// respawn: 'on_return'`, "pool(skyreach) 20 %" is the region's wandering pool (region.ts); the boss holds (R10-1). The
// schema's `once` is per loop, so WORLD's "once" and "once per loop" are the same field.
//
// The way in (WORLD §3.10, §11.2, §11.3 `gate_thin_air`): the Highlands' two climbs (the Spires' south exit to the Crown and the
// Plateau's south exit to the Stair) cost 2 watches up and sit behind the Talisman or `echo_high_mark` (U44's exits); the way
// down is open and costs 1. Every Skyreach node is `temporallyUnstable` (D-059: Dask may stand in any of them).
//
// Readings (each repeated where it applies; listed in the U48a reply):
//   - WORLD names no pool at the Spire-Crown, the Roost and the Eyrie ("return: X (p%)" and nothing else), and §10.3's
//     expected return fights (1.1 over the sweep, 0.7 on the Crown's route) count p alone, so those three are `safe` (the
//     schema's "no wandering roll"; the fixed `on_return` groups still roll), as the Steppe's Pan and the Reach's Sluice are.
//     The Perch names none either (a forced boss and nothing else), so it is `safe` as every boss arena that names no pool
//     (D-094). Only the Windward Stair rolls the pool;
//   - "Heartstone destroyed: no encounters" at the Crown and the Eyrie (WORLD §3.10, §12.1: "CR, AE none (dark; looms idle)")
//     is a `when` on their groups; their particles go out (WORLD §2.11 "the Spire-Crown goes dark"), as the Spires' (U44);
//   - DESIGN §10.5's `echo_high_mark` ("Sky-Whisper Sentinels passive", U44's reading at the Plateau) reaches the Roost: with
//     the Echo the Sentinel stays on its ledge and the Kite beside it fights alone. Both forms are groups with complementary
//     `when`s (the Voidscar's group B form), and winning or fleeing either scatters the other;
//   - the Roost's greataxe, "taking it costs Ironclad −10 unless echo_sky_oath": D-098 (U34d) it lies on its ledge as a
//     location item whose `onTake` carries the price, under an `onlyIf` (no oath). U48a's two `interact` events and their
//     coined loop flag are gone: the item is one a loop by itself, and taking it is the theft (the U34d call: cleaner than an
//     interact event, as WORLD's row is an item);
//   - the Eyrie's staff in "a locked case; opens with item_aetherium_prism" lies `hidden` with the Prism as its condition, for
//     `examine` to find — opening the case. D-098 (U34d): any examine with the Prism in the pack opens it (an entry waits for
//     its condition; it no longer needs the Prism at the loop's first visit);
//   - the Eyrie is a free camp, not an inn: WORLD §11.1 and §10.3 (and BIBLE) still write "inn", but DESIGN §9 dropped the
//     Skyreach inn (C-31; DESIGN §9.5 lists the inns, WORLD §4 and §9.3 confirm "none on site"), and nobody keeps one there;
//   - the Perch's bargain: WORLD §3.10/§10.5 give `echo_sky_oath` + the Talisman; WORLD §2.11, STORY's `q_high_mark` and BIBLE
//     say "Loop 2+", so the bypass carries `{loop:{min:2}}` too (the Steppe's Cairns can grant the oath in Loop 1). The fight's
//     loot (creatures.ts) pays the Talon, the feather and the boss's storm-glass; placed here are the bargain's Talon and the
//     three storm-glass WORLD §8.1 lists at the Perch itself ("loc_stormcrowns_perch ×3"). `ev_perch_watch` grants
//     `echo_tyrant_never_struck` on arrival, fight or bargain.
// "Fleeing here costs 10 % HP" on the Stair is the location's `fleeEffects` with a `damage` share of max HP (U34e, D-097).
// Not expressible (the U48a reply): the weather and the storm on Soaked (region.ts);
// `cr_anomaly_still_kite` (anomalies have no region link, D-091 gap 4); the Crown and the Eyrie "dark" have no description
// text in WORLD to vary to; the schematic's "reading it grants `echo_anchor_half_a`" is the item's (U49/U50, `onUse`).
// Exits to other regions name their WORLD ids (the Highlands' two, landed with U44).
import type { Condition } from '@schema/condition';
import type { Effect } from '@schema/effect';
import type { LocationInput } from '@schema/location';

const REGION = 'region_skyreach';
const WW = 'loc_windward_stair';
const CR = 'loc_spire_crown';
const RS = 'loc_roost_of_sentinels';
const AE = 'loc_auldes_eyrie';
const PE = 'loc_stormcrowns_perch';

/** WORLD §12.1 `ws_heartstone_destroyed`: "CR, AE none (dark; looms idle)". */
const DARK: Condition = { flag: 'flag_heartstone_destroyed' };
const LIT: Condition = { not: DARK };
/** DESIGN §10.5 `echo_high_mark`: "Sky-Whisper Sentinels passive". */
const HIGH_MARK: Condition = { echo: 'echo_high_mark' };
const SKY_OATH: Condition = { echo: 'echo_sky_oath' };
/** WORLD §3.10, §10.5: the Stormcrown's bargain, for the Talisman-bearer with the oath, from Loop 2 (see the header). */
const BARGAIN: Condition = { all: [{ loop: { min: 2 } }, SKY_OATH, { item: { id: 'item_sky_whisper_talisman' } }] };
/** Aulde's locked case "opens with item_aetherium_prism". */
const PRISM: Condition = { item: { id: 'item_aetherium_prism' } };
const AXE = 'item_hearth_iron_greataxe';
/** The Roost's one fixed fight: whichever form is won or fled, the other goes with it. */
const SETTLE_ROOST: Effect[] = [{ scatter: { location: RS } }];

export const locations = [
  // ---- The Windward Stair — steps cut into moving air; the High Mark (WORLD §3.10; STORY's "the Wind Stair / the High Mark") -
  {
    id: WW,
    regionId: REGION,
    name: 'The Windward Stair',
    description:
      "Steps cut into moving air. They hold your weight when a gust crosses them and not otherwise. The Talisman at your throat tells you when to step. Below, the Plateau's markers look like teeth.",
    exits: [
      // the way down: open, one watch (WORLD §11.2 cost_ba 1, gate_ba open)
      { dir: 'north', to: 'loc_sky_whisper_plateau' },
      { dir: 'west', to: CR },
      { dir: 'south', to: AE },
    ],
    items: [{ itemId: 'mat_gale_feather' }],
    // "gathering: mat_skyreach_crystal ×1" (DESIGN §8.2 "Skyreach gathering")
    gather: { itemId: 'mat_skyreach_crystal', perDay: 1 },
    // "Falls: fleeing on the Stair costs 10 % HP" (WORLD §2.11, §3.10), any fight fled here (U34e, D-097)
    fleeEffects: [{ damage: { pctMax: 0.1 } }],
    encounters: [
      // first: Gale Kites ×2 (60 %); return: the pool at 20 %. "Fleeing here costs 10 % HP": `fleeEffects` below
      {
        id: 'enc_windward_kites',
        groups: [{ creatureId: 'cr_gale_kite', count: 2 }],
        chance: 0.6,
        intro: 'Two diamonds of wind turn edge-on above the steps and drop toward you.',
      },
    ],
    events: [
      {
        id: 'ev_stair_breath',
        text: 'You breathe when the Talisman says. You step when the wind says. For eleven steps you are not falling.',
        effects: [{ grantEcho: 'echo_high_mark' }],
      },
    ],
    // WORLD's particles are "fast wind lines"; ash is the nearest preset, U44's reading of the Plateau's wind streaks
    art: { template: 'sky', horizon: 0.3, silhouettes: ['stair_outline_in_wind_streaks', 'plateau_far_below'], particles: 'ash', timeOfDay: 'day' },
    levelBand: { min: 12, max: 12 },
    map: { x: 24, y: 12 },
    temporallyUnstable: true,
    tags: ['thin_air', 'high_mark', 'skyreach_gate'],
  },

  // ---- The Spire-Crown — the disc at the tallest Spire's top; the nine threads; the Prism (WORLD §3.10, §12.1) --------------
  {
    id: CR,
    regionId: REGION,
    name: 'The Spire-Crown',
    description:
      'The top of the tallest Spire is a flat crystal disc you could land a ship on. The hum here is a note you can lean against. Threads of pale light leave the disc in nine directions. Eight go dark before the horizon.',
    exits: [
      // the way down to the Spires: open, one watch
      { dir: 'north', to: 'loc_aetherium_spires' },
      { dir: 'east', to: WW },
      { dir: 'south', to: RS },
    ],
    items: [
      { itemId: 'item_aetherium_shard', count: 2 },
      // "(100%, Loop 2+)" (WORLD §12.1 `ws_loop_2`: "CR prism"): the key to Aulde's case at the Eyrie
      { itemId: 'item_aetherium_prism', when: { loop: { min: 2 } } },
    ],
    gather: { itemId: 'mat_skyreach_crystal', perDay: 1 },
    encounters: [
      // first: Aetherial Weavers ×2 and a Glass Mote (100 %); dark with a destroyed Heartstone (see the header)
      {
        id: 'enc_crown_weavers',
        groups: [
          { creatureId: 'cr_aetherial_weaver', count: 2 },
          { creatureId: 'cr_glass_mote', count: 1 },
        ],
        when: LIT,
        intro: 'Two cords of light lift off the disc. A chip of crystal spins up between them.',
      },
      // return: Glass Motes ×3 (35 %); no pool (see the header)
      {
        id: 'enc_crown_motes',
        groups: [{ creatureId: 'cr_glass_mote', count: 3 }],
        chance: 0.35,
        once: false,
        respawn: 'on_return',
        when: LIT,
        intro: 'Three chips of crystal lift off the disc, spinning on the hum.',
      },
    ],
    safe: true,
    events: [
      {
        id: 'ev_crown_threads',
        text: 'Nine threads of light. One for each of them. The one that still runs goes east, to the Apex, and it is taut.',
        effects: [{ grantEcho: 'echo_spire_note' }],
      },
    ],
    // WORLD's particles are "light threads with slow pulse"; motes is the nearest preset (U44's Spires). Dark: they go out
    art: {
      template: 'spires',
      horizon: 0.35,
      silhouettes: ['crystal_disc', 'nine_light_rays', 'cloud_floor'],
      particles: 'motes',
      timeOfDay: 'day',
      variants: [{ when: DARK, patch: { particles: 'none' } }],
    },
    levelBand: { min: 13, max: 13 },
    map: { x: 16, y: 12 },
    temporallyUnstable: true,
    tags: ['spire', 'nine_threads'],
  },

  // ---- Roost of the Sentinels — the ledges; the Nomads' sky-burials; the greataxe (WORLD §3.10; BIBLE) -----------------------
  {
    id: RS,
    regionId: REGION,
    name: 'Roost of the Sentinels',
    description:
      'A cliff face honeycombed with ledges where the Sentinels wait between watches. Nomad bones lie on the high ledges, placed carefully, with their steel. The Sentinels do not touch the bones. They were asked not to.',
    exits: [
      { dir: 'north', to: CR },
      { dir: 'east', to: AE },
      { dir: 'west', to: PE },
    ],
    items: [
      { itemId: 'mat_gale_feather', count: 2 },
      // "item_hearth_iron_greataxe (on a sky-burial ledge; taking it costs Ironclad −10 unless echo_sky_oath)": D-098 (U34d)
      // the price is the item's `onTake` (see the header)
      { itemId: AXE, onTake: [{ onlyIf: { when: { not: SKY_OATH }, effects: [{ rep: { faction: 'ironclad', delta: -10 } }] } }] },
    ],
    encounters: [
      // first: a Sentinel and a Gale Kite (100 %); with `echo_high_mark` the Sentinel is passive and the Kite comes alone
      {
        id: 'enc_roost_sentinel_kite',
        groups: [
          { creatureId: 'cr_sky_whisper_sentinel', count: 1 },
          { creatureId: 'cr_gale_kite', count: 1 },
        ],
        when: { not: HIGH_MARK },
        onVictory: SETTLE_ROOST,
        onFleeEffects: SETTLE_ROOST,
        intro: 'A Sentinel unfolds from its ledge, and a kite peels off the cliff beside it.',
      },
      {
        id: 'enc_roost_kite',
        groups: [{ creatureId: 'cr_gale_kite', count: 1 }],
        when: HIGH_MARK,
        onVictory: SETTLE_ROOST,
        onFleeEffects: SETTLE_ROOST,
        intro: 'The Sentinel on its ledge lets you pass. The kite beside it does not.',
      },
      // return: Cloud Rays ×2 (35 %); no pool (see the header)
      {
        id: 'enc_roost_cloud_rays',
        groups: [{ creatureId: 'cr_cloud_ray', count: 2 }],
        chance: 0.35,
        once: false,
        respawn: 'on_return',
        intro: 'Two flat gliders slide along the ledges, trailing cloud.',
      },
    ],
    safe: true,
    events: [
      { id: 'ev_roost_bones', text: 'The bones on the ledges wear Nomad steel. The Sentinels guard them as if they were eggs.' },
    ],
    // WORLD's particles are "feathers and grit"; ash is the nearest preset to grit
    art: { template: 'peaks', horizon: 0.4, silhouettes: ['honeycombed_cliff', 'perched_sentinel_shapes', 'laid_out_bones'], particles: 'ash', timeOfDay: 'day' },
    levelBand: { min: 13, max: 14 },
    map: { x: 16, y: 14 },
    temporallyUnstable: true,
    tags: ['sky_burial', 'roost'],
  },

  // ---- Aulde's Eyrie — the workshop; the looms; her notes and schematic half A; the only rest (WORLD §3.10, §10.4) -------------
  {
    id: AE,
    regionId: REGION,
    name: "Aulde's Eyrie",
    description:
      "A workshop of glass and brass set into the cliff. Looms run on their own, weaving light into cord. Drawings cover every wall: the Spires as a harp; the Apex as a knot; a device with two halves. The hand is a woman's, and sure.",
    exits: [
      { dir: 'north', to: WW },
      { dir: 'west', to: RS },
    ],
    items: [
      { itemId: 'item_auldes_spire_notes' },
      // "half the schematic — reading it grants its own persistent Echo, echo_anchor_half_a" (the item's: see the header)
      { itemId: 'item_breach_anchor_schematic_a' },
      // "locked case; opens with item_aetherium_prism" (see the header)
      { itemId: 'item_spire_builders_staff', hidden: true, when: PRISM },
    ],
    encounters: [
      // first: the Spire Loom and an Aetherial Weaver (100 %); the looms idle with a destroyed Heartstone (see the header). The
      // elite guards the region's only rest, and scatters (WORLD §10.4)
      {
        id: 'enc_eyrie_loom_weaver',
        groups: [
          { creatureId: 'cr_spire_loom', count: 1 },
          { creatureId: 'cr_aetherial_weaver', count: 1 },
        ],
        when: LIT,
        intro: "The nearest loom's shuttles quicken. A cord of light pulls loose and turns toward you.",
      },
      // return: the Spire Loom (25 %); no pool (see the header)
      {
        id: 'enc_eyrie_loom',
        groups: [{ creatureId: 'cr_spire_loom', count: 1 }],
        chance: 0.25,
        once: false,
        respawn: 'on_return',
        when: LIT,
        intro: 'A loom you had not noticed starts to run.',
      },
    ],
    safe: true,
    // "npc_dask (can remain)": the engine's rule (D-059, `temporallyUnstable`), not a placement (npcs.ts)
    events: [
      {
        id: 'ev_eyrie_weavers',
        text: 'A loom finishes a cord of light and lets it go. It drifts out the window toward the Spires, spinning, and you know what an Aetherial Weaver is.',
        effects: [{ grantEcho: 'echo_spire_note' }],
      },
    ],
    // WORLD's particles are "light-cord filaments"; motes is the nearest preset. The looms idle with the Heartstone dark
    art: {
      template: 'archive',
      horizon: 0.55,
      silhouettes: ['looms', 'wall_drawings', 'cliff_window'],
      particles: 'motes',
      timeOfDay: 'day',
      variants: [{ when: DARK, patch: { particles: 'none' } }],
    },
    // "Rest point: yes (the workshop's inner room is windless)": a camp (see the header)
    rest: { kind: 'camp', text: "You rest in the workshop's inner room, where there is no wind." },
    levelBand: { min: 14, max: 14 },
    map: { x: 24, y: 14 },
    temporallyUnstable: true,
    tags: ['camp', 'workshop', 'elite'],
  },

  // ---- The Stormcrown's Perch — the regional boss; the bargain (WORLD §3.10, §6.5, §10.5; D-067.12) ---------------------------
  {
    id: PE,
    regionId: REGION,
    name: "The Stormcrown's Perch",
    description:
      'A single pinnacle above everything, ringed with lightning that never grounds. On it the first Sentinel, made before the others, with a crown of storm-glass and five hundred years of watching the Apex. It knows the thing in the Apex does not strike what keeps its distance.',
    exits: [{ dir: 'east', to: RS }],
    // The fight's loot (the Talon, the feather, the storm-glass) is the Stormcrown's (creatures.ts). Placed here: the bargain's
    // Talon ("100 % after boss or bargain") and WORLD §8.1's three storm-glass at the Perch (see the header)
    items: [
      { itemId: 'item_stormcrown_talon', when: BARGAIN },
      { itemId: 'mat_storm_glass', count: 3 },
    ],
    encounters: [
      // the forced boss (WORLD §10.5): without the bargain; with it the Stormcrown yields and the encounter is skipped
      // (`optionalWhen`, the Grave's and the Deep's form). Bosses hold (R10-1); the kite is the Stormcrown's own (Phase 1)
      {
        id: 'enc_perch_stormcrown',
        groups: [{ creatureId: 'cr_stormcrown' }],
        optionalWhen: BARGAIN,
        fleeable: false,
        onFlee: 'hold',
        intro: 'The ring of lightning closes behind you. On the pinnacle the crowned shape spreads its vanes.',
      },
    ],
    safe: true,
    events: [
      {
        id: 'ev_perch_watch',
        text: "The Stormcrown does not look at you. It looks east. 'It does not strike what keeps its distance,' it says. 'Seven came. Seven came close.'",
        effects: [{ grantEcho: 'echo_tyrant_never_struck' }],
      },
    ],
    // WORLD's particles are "lightning arcs"; static is the nearest preset. The storm comes at dusk (WORLD §2.11)
    art: { template: 'peaks', horizon: 0.25, silhouettes: ['pinnacle', 'crowned_sentinel', 'ring_of_lightning'], particles: 'static', timeOfDay: 'dusk' },
    levelBand: { min: 15, max: 15 },
    map: { x: 8, y: 14 },
    temporallyUnstable: true,
    tags: ['boss', 'regional_boss'],
  },
] satisfies LocationInput[];
