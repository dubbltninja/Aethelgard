// The Ashen Steppe — the nine locations (WORLD §3.7 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates WORLD §11.3;
// state texts WORLD §12.1). New locations: the descriptions are WORLD's, character for character (no `+` sentence, no
// `legacyName`). Encounter notation and the ids are the Ruins' (../silverwood_ruins/locations.ts header): `first: X (p%)` is
// `chance: p` (rolls once, on the first visit; a 100 % group stays until cleared or scattered), `return: X (p%)` is
// `chance: p, respawn: 'on_return'`, "or pool 20 %" is the region's wandering pool (region.ts) behind it; the boss holds
// (R10-1). The schema's `once` is per loop, so WORLD's "once" and "once per loop" are the same field.
//
// Readings (each repeated where it applies; listed in the U46 reply):
//   - the Flats' "cr_cinderback ×1 (60 %) or cr_salt_jackal ×3 (40 %)" is two rolls (U43's reading of a second spawn): the
//     engine runs the first group whose roll succeeds, so the jackals' own roll is 0.4 / (1 − 0.6) = 1. A chance of 1 would be
//     a standing group, so it is 0.999 (the 0.1 % is the cost of the form);
//   - WORLD names no pool on the Grey Salt Pan ("return: cr_salt_jackal ×2 (40 %)" and nothing else), and §10.3's expected
//     return fights (1.9 over the sweep) count the Pan's 40 % alone, so the Pan is `safe` (the schema's "no wandering roll";
//     the fixed `on_return` group still rolls), as the Black Sluice and the Bellmouth are (the Reach). The Scorched Gate and
//     Hearthring are `safe` as WORLD says "none (watched)" / "none (settlement)", and the Herd-Grave ("forced boss" and no
//     pool; §10.3's sweep counts no return fight there) as the Reach's Deep is;
//   - the Reed Stalker's 25 % of the pool at Watchfire Ridge and the Reedmarch Descent ("reed stalker at … only", WORLD §10.1)
//     is a pool entry with a `location` condition (D-098, U34d: pool entries carry a `when`; it was a 5 % location encounter
//     ahead of the pool, 24 % in all). The Descent's "pool(steppe) 10 % / pool(glowfen) 10 %" is its `wanderingPools` (D-098:
//     one return roll at 20 %, then either pool by its share; the Glowfen half had no field);
//   - an event whose grant carries a condition ("grants X with {item …}") is two events with complementary `when`s, the WORLD
//     id on the one that grants and a coined `_plain` id on the one that does not, as the Reach's Names event. D-098 (U34d)
//     added a per-effect condition (`onlyIf`), but the pair stays: a `once` event that fired without the condition could not
//     grant on a later visit (Hallow's Cairn is `q_bone_road`'s stage with the forge-mark in the pack);
//   - an item WORLD gives a chance ("50 %") carries it as its `chance` (D-098; it lay hidden at 100 %), and "100 % after
//     clearing" is a hidden item that appears once the pack has been killed;
//   - the Scorched Gate's Horde husks: D-098 (U34d) the `infected` atom reads the node's infection (it was read by move count,
//     7 or later of a Tyrant-kill Horde, 9 after an expiry, as the Camp's, U43). Unlike the Camp the Gate has no Brak clause
//     (WORLD §12.1: "SG: husk ×2");
//   - the Herd-Grave: Ashmaw's own loot (creatures.ts) pays the heart, the horn and the ore for the fight; the Pyre Ledger
//     placed here is the bypass's (the player breaks the brand-stone, `echo_dreyl_brand`, and the fight is then skipped: the
//     Reach's Deep form), so the two never both pay.
//
// Exits to other regions name their WORLD ids and stay pending until those units land (D-090). The waystone road (WORLD §11.2
// `road`) is an exit of `kind: 'road'` with its gate on both ends, direction `path` (the schema's repeatable direction: the
// Gate already has a south exit and the Descent a north one).
//
// Not expressible yet (listed in the U46 reply): the Pan's midday glare, the Cairns' lightning on Soaked characters at night,
// the Flats' stampede lanes and ashfall's Blind at an ambush (region.ts), the ambush flag (an encounter's `ambush` is only
// passed on to the `combatStarted` event, so Watchfire's and the Cairns' harriers are plain groups).
import type { Condition } from '@schema/condition';
import type { HazardInput, LocationInput } from '@schema/location';

/** WORLD §11.3 `gate_steppe_road`: the Waystone Order. */
const WAYSTONES: Condition = { echo: 'echo_steppe_waystones' };
/** WORLD §11.3 `gate_herd_grave`: `q_bone_road` accepted (in the journal) or the trail-signs. */
const GRAVE_OPEN: Condition = { any: [{ quest: { id: 'q_bone_road' } }, { echo: 'echo_nomad_signs' }] };
const GRAVE_LOCKED = 'The clan does not let strangers wake the Herd.';

/** D-098 (U34d): the Gate stands in the Horde's infected set (the `infected` atom; it was read by move count, see the header). */
const GATE_INFECTED: Condition = { infected: true };


// U34e (D-094): WORLD §2.8's weather and hazards. Ashfall: Blind for 1 turn at an ambush's onset on Days 1–2 of each
// three-day cycle, everywhere, until a destroyed Heartstone lets the ash settle. The Pan's salt glare by day: −10
// accuracy for everyone. The Cairns: lightning, 5 Storm to a Soaked combatant each round ("per watch": a watch never
// passes in a fight, and Soaked lives only in one), and the dry lightning at night: Shock on a Soaked combatant, at
// random (half the time). The Flats' stampede lanes are the Cinderback's guarded miss (creatures.ts).
const ASHFALL: Omit<HazardInput, 'id'> = {
  on: 'ambush',
  cycle: { every: 3, days: [1, 2] },
  when: { not: { flag: 'flag_heartstone_destroyed' } },
  status: { id: 'status_blind', duration: 1, to: 'party' },
};
const SALT_GLARE: Omit<HazardInput, 'id'> = { on: 'fight', when: { watch: 'day' }, accuracy: { amount: -10 } };
const CAIRNS_LIGHTNING: Omit<HazardInput, 'id'> = { on: 'round', strike: { type: 'storm', amount: 5, onlyIf: 'status_soaked' } };
const DRY_LIGHTNING: Omit<HazardInput, 'id'> = {
  on: 'round',
  when: { watch: 'night' },
  chance: 0.5,
  status: { id: 'status_shock', to: 'all', onlyIf: 'status_soaked' },
};

export const locations = [
  // ---- The Scorched Gate — a gate within a gate; Ferrin; the Horde's husks (WORLD §3.7, §12.1) -------------------------------
  {
    id: 'loc_scorched_gate',
    regionId: 'region_ashen_steppe',
    name: 'The Scorched Gate',
    description:
      "The Outpost's east gate burned and was never rebuilt, so the Nomads built a smaller one inside its frame. Two scouts, a brazier, a horn. Beyond the gate the grass is grey to the horizon and the sky is white with falling ash.",
    exits: [
      { dir: 'west', to: 'loc_blighted_outpost' },
      { dir: 'east', to: 'loc_ash_wind_flats' },
      { dir: 'north', to: 'loc_bone_orchard' },
      { dir: 'south', to: 'loc_watchfire_ridge' },
      // WORLD §11.2/§11.3 `gate_steppe_road` (kind `road`): the Waystone Order's cairn-marked road past the Ridge, one watch
      { dir: 'path', label: 'the waystone road', to: 'loc_reedmarch_descent', kind: 'road', gate: WAYSTONES },
    ],
    items: [{ itemId: 'item_nomad_hardtack', count: 2 }],
    // "gathering: mat_ember_ore ×1 (a slag-heap by the brazier, DESIGN §8.2 'Ashen Steppe gathering')"
    gather: { itemId: 'mat_ember_ore', perDay: 1 },
    encounters: [
      // "none (watched)"; Horde (WORLD §10.5, §12.1): cr_horde_husk ×2 when the Gate is infected. Horde fights hold (R10-1).
      {
        id: 'enc_gate_husks',
        groups: [{ creatureId: 'cr_horde_husk', count: 2 }],
        when: { all: [{ flag: 'flag_horde_active' }, GATE_INFECTED] },
        fleeable: false,
        onFlee: 'hold',
        intro: 'Two shapes stand in the smaller gate, coming apart and together.',
      },
    ],
    safe: true,
    npcs: ['npc_scout_ferrin'],
    events: [
      {
        id: 'ev_gate_horn',
        text: "Ferrin blows two notes on the horn. Far off, two notes answer. 'Hearthring knows you're coming,' he says.",
      },
    ],
    art: { template: 'steppe', horizon: 0.58, silhouettes: ['gate_within_a_gate', 'brazier', 'two_leaning_scouts'], particles: 'ash', timeOfDay: 'day' },
    levelBand: { min: 7, max: 7 },
    hazards: [{ id: 'ashfall', ...ASHFALL }], // U34e (D-094)
    map: { x: 32, y: 4 },
    tags: ['gate', 'ironclad', 'watched'],
  },

  // ---- Ash-Wind Flats — the herd-paths; the first Cinderback (WORLD §3.7, §10.4) -----------------------------------------------
  {
    id: 'loc_ash_wind_flats',
    regionId: 'region_ashen_steppe',
    name: 'Ash-Wind Flats',
    description:
      'Flat grey land under a flat white sky. The wind comes from the east and never stops. Herd-paths cross the ash in straight lines. When the ground shakes, you are on one.',
    exits: [
      { dir: 'west', to: 'loc_scorched_gate' },
      { dir: 'east', to: 'loc_hearthring' },
      { dir: 'north', to: 'loc_grey_salt_pan' },
    ],
    // WORLD: ×1 (50 %): its `chance` (D-098, U34d; it lay hidden at 100 % for want of the field)
    items: [{ itemId: 'mat_cinder_horn', chance: 0.5 }],
    encounters: [
      // first: a Cinderback (60 %, telegraphed stampede: Guard on the first turn avoids the opening charge) or Salt Jackals ×3 (40 %)
      {
        id: 'enc_flats_cinderback',
        groups: [{ creatureId: 'cr_cinderback' }],
        chance: 0.6,
        intro: 'A herd-path runs straight through here, and something is on it.',
      },
      // the other 40 %: the second roll is 0.4 / (1 − 0.6) = 1, written 0.999 (see the header)
      {
        id: 'enc_flats_jackals',
        groups: [{ creatureId: 'cr_salt_jackal', count: 3 }],
        chance: 0.999,
        intro: 'Three salt-white shapes get up out of the ash and fan out.',
      },
      // return: Steppe Harriers ×2 (30 %), else the pool at 20 %
      {
        id: 'enc_flats_harriers',
        groups: [{ creatureId: 'cr_steppe_harrier', count: 2 }],
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'Two grey wings fold out of the white sky.',
      },
    ],
    events: [
      {
        id: 'ev_flats_shake',
        text: 'The ground shakes. You step off the herd-path. Something the size of a house passes where you stood, burning.',
      },
    ],
    art: { template: 'steppe', horizon: 0.5, silhouettes: ['flat_horizon_line', 'lone_dead_tree', 'distant_burning_shape'], particles: 'ash', timeOfDay: 'day' },
    levelBand: { min: 7, max: 8 },
    hazards: [{ id: 'ashfall', ...ASHFALL }], // U34e (D-094)
    map: { x: 40, y: 4 },
    tags: ['herd_paths', 'elite'],
  },

  // ---- Hearthring — the fire that has not gone out; the clan-mother; the quartermaster (WORLD §3.7, §9) ----------------------
  {
    id: 'loc_hearthring',
    regionId: 'region_ashen_steppe',
    name: 'Hearthring',
    description:
      "A ring of standing stones with a fire in the middle that has not gone out in four hundred years. Hide tents lean on the stones. Children, dogs, a forge-wagon, a bull's skull on a pole. The clan-mother sits with her back to the fire and her eyes on the gate.",
    exits: [
      { dir: 'west', to: 'loc_ash_wind_flats' },
      { dir: 'north', to: 'loc_stormgate_cairns' },
      // WORLD §11.3 `gate_herd_grave` (hearthring → herd_grave only): "the clan does not let strangers wake the Herd"
      { dir: 'south', to: 'loc_herd_grave', when: GRAVE_OPEN, lockedText: GRAVE_LOCKED },
    ],
    items: [{ itemId: 'item_hearth_broth', count: 2 }],
    // "none (settlement)"
    safe: true,
    npcs: ['npc_hadda_ironvow', 'npc_oma_varr', 'npc_tessaly_varr', 'npc_ketch'],
    events: [
      {
        id: 'ev_hearthring_fire',
        text: "Oma Varr does not look up. 'That fire was lit from the last ember of the Burned Hall,' she says. 'Sit. You smell of the Breach.'",
      },
      {
        id: 'ev_hearthring_brothers',
        text: 'Ketch sings a verse about two brothers and a name laid down. He stops when he sees your face.',
        when: { quest: { id: 'q_clear_path', status: 'completed' } },
      },
    ],
    art: { template: 'camp', horizon: 0.56, silhouettes: ['ring_of_stones', 'central_fire', 'hide_tents', 'skull_pole'], particles: 'embers', timeOfDay: 'dusk' },
    // WORLD §11.1: a camp (HR camp, WF camp), and the quartermaster's stall (WORLD §9)
    rest: { kind: 'camp' },
    merchantId: 'npc_tessaly_varr',
    levelBand: { min: 8, max: 8 },
    hazards: [{ id: 'ashfall', ...ASHFALL }], // U34e (D-094)
    map: { x: 48, y: 4 },
    tags: ['camp', 'merchant', 'settlement', 'ironclad'],
  },

  // ---- The Bone Orchard — the petrified herds; Dreyl's brand (WORLD §3.7) ---------------------------------------------------
  {
    id: 'loc_bone_orchard',
    regionId: 'region_ashen_steppe',
    name: 'The Bone Orchard',
    description:
      'The herds died standing. Five hundred years of ash have made them stone: rows of bison in mid-stride, calcined white, mouths open. Grey grass grows between the legs. Some of the shapes are warm.',
    exits: [
      { dir: 'south', to: 'loc_scorched_gate' },
      { dir: 'east', to: 'loc_grey_salt_pan' },
    ],
    items: [
      { itemId: 'mat_cinder_horn', count: 2 },
      { itemId: 'mat_iron_rivet' },
    ],
    encounters: [
      // first: a Cinderback (50 %; one of the warm shapes)
      {
        id: 'enc_orchard_cinderback',
        groups: [{ creatureId: 'cr_cinderback' }],
        chance: 0.5,
        intro: 'One of the warm shapes turns its head.',
      },
      // return: Salt Jackals ×2 (35 %), else the pool at 20 %
      {
        id: 'enc_orchard_jackals',
        groups: [{ creatureId: 'cr_salt_jackal', count: 2 }],
        chance: 0.35,
        once: false,
        respawn: 'on_return',
        intro: 'Two salt-white shapes slip out between the stone legs.',
      },
    ],
    events: [
      {
        id: 'ev_orchard_brand',
        text: "Each stone beast carries the same scorch on its flank: a flame inside a ring. Dreyl's brand. He warded them, and the ward burned.",
        effects: [{ grantEcho: 'echo_dreyl_brand' }],
      },
    ],
    art: { template: 'steppe', horizon: 0.52, silhouettes: ['rows_of_petrified_bison', 'grey_grass_tufts', 'single_warm_red_glow'], particles: 'ash', timeOfDay: 'day' },
    levelBand: { min: 8, max: 9 },
    hazards: [{ id: 'ashfall', ...ASHFALL }], // U34e (D-094)
    map: { x: 32, y: 2 },
    tags: ['brand', 'elite'],
  },

  // ---- Grey Salt Pan — the white-out; the jackal den (WORLD §3.7) -------------------------------------------------------------
  {
    id: 'loc_grey_salt_pan',
    regionId: 'region_ashen_steppe',
    name: 'Grey Salt Pan',
    description:
      'A dry lake of salt, perfectly flat, perfectly white under the grey. At midday the glare erases the horizon. Jackals the colour of the salt run in packs and are not seen until they are heard.',
    exits: [
      { dir: 'west', to: 'loc_bone_orchard' },
      { dir: 'east', to: 'loc_stormgate_cairns' },
      { dir: 'south', to: 'loc_ash_wind_flats' },
    ],
    // "item_salt_charm ×1 (first visit, in a jackal den, 100% after clearing)": hidden until the pack has been killed
    items: [{ itemId: 'item_salt_charm', hidden: true, when: { killed: { id: 'cr_salt_jackal' } } }],
    // "gathering: mat_steppe_salt ×2"
    gather: { itemId: 'mat_steppe_salt', perDay: 2 },
    encounters: [
      // first: Salt Jackals ×3 (100 %, a scatter node)
      {
        id: 'enc_pan_jackals',
        groups: [{ creatureId: 'cr_salt_jackal', count: 3 }],
        intro: 'You hear them laugh before you see anything at all.',
      },
      // return: Salt Jackals ×2 (40 %), and no pool (see the header)
      {
        id: 'enc_pan_jackals_return',
        groups: [{ creatureId: 'cr_salt_jackal', count: 2 }],
        chance: 0.4,
        once: false,
        respawn: 'on_return',
        intro: 'The white to one side of you laughs.',
      },
    ],
    safe: true,
    events: [
      {
        id: 'ev_pan_glare',
        text: 'At noon the Pan has no edges. You walk toward a shape for an hour. It is a man-high cairn, and it is behind you.',
      },
    ],
    art: { template: 'steppe', horizon: 0.5, silhouettes: ['salt_cracks', 'lone_cairn', 'jackal_shapes'], particles: 'motes', timeOfDay: 'day' },
    levelBand: { min: 9, max: 9 },
    hazards: [{ id: 'ashfall', ...ASHFALL }, { id: 'salt_glare', ...SALT_GLARE }], // U34e (D-094)
    map: { x: 40, y: 2 },
    tags: ['salt', 'gathering', 'glare'],
  },

  // ---- Stormgate Cairns — the lightning field; Hallow's Cairn (WORLD §3.7; STORY's Hallow's Cairn, C-37) ----------------------
  {
    id: 'loc_stormgate_cairns',
    regionId: 'region_ashen_steppe',
    name: 'Stormgate Cairns',
    description:
      'A field of cairns built of iron-dark stone, each taller than a man, each capped with a spike. Dry lightning walks between them at night. The Nomads built them to pull the storms down out of the sky and away from the herds. It works.',
    exits: [
      { dir: 'west', to: 'loc_grey_salt_pan' },
      { dir: 'south', to: 'loc_hearthring' },
    ],
    items: [
      { itemId: 'mat_storm_glass', count: 2 },
      { itemId: 'item_storm_jar' },
    ],
    encounters: [
      // first: Steppe Harriers ×2 (60 %); return: the pool at 20 %
      {
        id: 'enc_cairns_harriers',
        groups: [{ creatureId: 'cr_steppe_harrier', count: 2 }],
        chance: 0.6,
        intro: 'Two shadows drop out of the low cloud between the spikes.',
      },
    ],
    events: [
      // grants `echo_sky_oath` with `{item:"item_sky_whisper_talisman"}`: the grant is its own event (see the header)
      {
        id: 'ev_cairns_strike',
        text: 'Lightning takes a cairn two paces from you. The spike glows. The stone beneath it is glass now, and in the glass a face you half know.',
        when: { item: { id: 'item_sky_whisper_talisman' } },
        effects: [{ grantEcho: 'echo_sky_oath' }],
      },
      {
        id: 'ev_cairns_strike_plain',
        text: 'Lightning takes a cairn two paces from you. The spike glows. The stone beneath it is glass now, and in the glass a face you half know.',
        when: { not: { item: { id: 'item_sky_whisper_talisman' } } },
      },
      // STORY's Hallow's Cairn (`q_bone_road` stage 3): `echo_iron_that_does_not_wish` with Borin's forge-mark in the pack
      {
        id: 'ev_hallows_cairn',
        text: "One cairn stands apart, older than the rest and capped with a hammer-head instead of a spike. Under the ash the iron is still warm. Hallow's Cairn: the smith died here with the ember still lit, after crossing the Peaks north.",
        when: { item: { id: 'item_borins_forge_mark' } },
        effects: [{ grantEcho: 'echo_iron_that_does_not_wish' }],
      },
      {
        id: 'ev_hallows_cairn_plain',
        text: "One cairn stands apart, older than the rest and capped with a hammer-head instead of a spike. Under the ash the iron is still warm. Hallow's Cairn: the smith died here with the ember still lit, after crossing the Peaks north.",
        when: { not: { item: { id: 'item_borins_forge_mark' } } },
      },
    ],
    art: { template: 'steppe', horizon: 0.48, silhouettes: ['cairns_with_spikes', 'lightning_fork', 'low_cloud'], particles: 'shards', timeOfDay: 'dusk' },
    levelBand: { min: 9, max: 10 },
    // U34e (D-094)
    hazards: [{ id: 'ashfall', ...ASHFALL }, { id: 'cairns_lightning', ...CAIRNS_LIGHTNING }, { id: 'cairns_dry_lightning', ...DRY_LIGHTNING }],
    map: { x: 48, y: 2 },
    tags: ['cairns', 'lightning', 'hallows_cairn'],
  },

  // ---- Watchfire Ridge — the signal fire; the Apex as a white stain; the second camp (WORLD §3.7) ---------------------------
  {
    id: 'loc_watchfire_ridge',
    regionId: 'region_ashen_steppe',
    name: 'Watchfire Ridge',
    description:
      'A spine of black rock above the Flats with a fire on it that the Nomads keep for signalling. From here the Glowlands are a green stain to the south and the Apex is a white one to the east. The sentries take turns not looking at it.',
    exits: [
      { dir: 'north', to: 'loc_scorched_gate' },
      { dir: 'south', to: 'loc_reedmarch_descent' },
    ],
    items: [{ itemId: 'item_whetstone_strip' }],
    encounters: [
      // first: Steppe Harriers ×2 (40 %)
      {
        id: 'enc_ridge_harriers',
        groups: [{ creatureId: 'cr_steppe_harrier', count: 2 }],
        chance: 0.4,
        intro: 'The sentries look up all at once. Two harriers are already coming down.',
      },
      // return: the pool at 20 %, whose Reed Stalker share ("at loc_watchfire_ridge / loc_reedmarch_descent only") is the
      // pool entry's own `when` (D-098, U34d; region.ts — it was a 5 % group here ahead of the pool, see the header)
    ],
    events: [
      {
        id: 'ev_ridge_apex',
        text: "A sentry hands you a glass. Through it the Apex seams move like breathing. 'Faster than last season,' she says.",
        effects: [{ grantEcho: 'echo_breach_clock' }],
      },
    ],
    art: { template: 'steppe', horizon: 0.4, silhouettes: ['ridge_spine', 'watchfire', 'distant_green_and_white_smears'], particles: 'embers', timeOfDay: 'dusk' },
    // the watchfire: a free rest (WORLD §11.1 rest `camp`)
    rest: { kind: 'camp' },
    levelBand: { min: 7, max: 8 },
    hazards: [{ id: 'ashfall', ...ASHFALL }], // U34e (D-094)
    map: { x: 32, y: 6 },
    tags: ['camp', 'signal'],
  },

  // ---- Reedmarch Descent — the trade baskets; the Glowlands' door; the waystone road (WORLD §3.7, §11.3) -------------------
  {
    id: 'loc_reedmarch_descent',
    regionId: 'region_ashen_steppe',
    name: 'Reedmarch Descent',
    description:
      'The ridge breaks into terraces that go down into reeds. Grey gives way to green in three steps. Glowfen traders leave baskets of moss here for Nomad salt and never meet them.',
    exits: [
      { dir: 'north', to: 'loc_watchfire_ridge' },
      { dir: 'path', label: 'the waystone road', to: 'loc_scorched_gate', kind: 'road', gate: WAYSTONES },
      { dir: 'south', to: 'loc_veridian_glowlands' },
    ],
    items: [{ itemId: 'item_glow_moss', count: 2 }],
    encounters: [
      // first: a Reed Stalker (40 %)
      {
        id: 'enc_reedmarch_stalker',
        groups: [{ creatureId: 'cr_reed_stalker' }],
        chance: 0.4,
        intro: 'The reeds stop moving. One of them is watching you.',
      },
      // return: "pool(steppe) 10 % / pool(glowfen) 10 %" (D-098, U34d: `wanderingPools` below; the Steppe pool's Reed Stalker
      // entry holds here, region.ts — it was a 5 % group here ahead of the Steppe pool alone, see the header)
    ],
    wanderingPools: [
      { regionId: 'region_ashen_steppe', chance: 0.1 },
      { regionId: 'region_glowfen', chance: 0.1 },
    ],
    events: [
      {
        id: 'ev_reedmarch_baskets',
        text: 'Moss in one basket, salt in the other. Two peoples who have never spoken, keeping a bargain for a hundred years.',
      },
    ],
    art: { template: 'steppe', horizon: 0.55, silhouettes: ['terraced_steps', 'reed_line', 'two_baskets'], particles: 'ash', timeOfDay: 'day' },
    levelBand: { min: 8, max: 8 },
    hazards: [{ id: 'ashfall', ...ASHFALL }], // U34e (D-094)
    map: { x: 32, y: 8 },
    tags: ['trade', 'glowfen_door'],
  },

  // ---- The Herd-Grave — the regional boss; the brand-stone (WORLD §3.7, §6.2, §10.5) -------------------------------------------
  {
    id: 'loc_herd_grave',
    regionId: 'region_ashen_steppe',
    name: 'The Herd-Grave',
    description:
      'A bowl in the Steppe where the ash lies deepest. Under it, the herd that did not turn to stone. It burned, and kept burning, and learned to move as one. The Nomads call it Ashmaw and leave it the first calf of every spring. The bowl is warm to stand in.',
    exits: [{ dir: 'north', to: 'loc_hearthring' }],
    // The fight's loot (heart, horn, ore, ledger) is Ashmaw's (creatures.ts). Placed here: the bypass's share, "with
    // `echo_dreyl_brand` the player may break the brand-stone … no fight, reduced loot" — the Pyre Ledger alone. With the Echo
    // the fight is skipped (below), so nothing is paid twice.
    items: [{ itemId: 'item_dreyls_pyre_ledger', when: { echo: 'echo_dreyl_brand' } }],
    encounters: [
      // the forced boss (WORLD §10.5): without `echo_dreyl_brand`; with it the player breaks the brand-stone and the
      // encounter is skipped (`optionalWhen`, the Golem shortcut's and the Deep's form). Bosses hold (R10-1); the adds are
      // Ashmaw's own (creatures.ts, Phase 1).
      {
        id: 'enc_grave_ashmaw',
        groups: [{ creatureId: 'cr_ashmaw' }],
        optionalWhen: { echo: 'echo_dreyl_brand' },
        fleeable: false,
        onFlee: 'hold',
        intro: 'The ash in the bowl lifts, and settles, and something under it turns over.',
      },
    ],
    safe: true,
    events: [{ id: 'ev_grave_breath', text: 'The ash in the bowl rises and falls. Slowly. It is breathing.' }],
    art: { template: 'steppe', horizon: 0.5, silhouettes: ['ash_bowl_rim', 'half_buried_horns', 'vast_dark_shape_under_ash'], particles: 'embers', timeOfDay: 'dusk' },
    levelBand: { min: 11, max: 11 },
    hazards: [{ id: 'ashfall', ...ASHFALL }], // U34e (D-094)
    map: { x: 48, y: 6 },
    tags: ['boss', 'regional_boss'],
  },
] satisfies LocationInput[];
