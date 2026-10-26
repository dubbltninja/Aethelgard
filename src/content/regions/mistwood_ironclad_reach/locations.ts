// Mistwood & the Ironclad Reach — the six locations (WORLD §3.2 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates
// WORLD §11.3; state texts WORLD §12.1; legacy text legacy/aethelgard_data.py LOCATION_DEFS, verbatim, with WORLD's `+`
// sentence appended). Encounter notation and the ids are the Ruins' (../silverwood_ruins/locations.ts header): `first: X (p%)`
// is `chance: p` (rolls once, on the first visit; a 100 % group stays until cleared or scattered), `return:` groups use
// `respawn: 'on_return'`, the wandering pool is the region's (region.ts) and is suppressed at the three settlements
// (`safe: true`: WORLD gives the Respite, the Camp and the Emberforge no fights). Legacy event ids take the `ev_` prefix
// the schema requires (`respite_breath` → `ev_respite_breath`); the schema's `once` is kept per loop, so WORLD's "once" and
// "once per loop" are the same field.
//
// Story gates (WORLD R10-1, §10.4, §10.5): a legacy kill quest's target is two encounters in order: the gate, which holds
// (`fleeable: false, onFlee: 'hold'`) while its quest is active, then the plain legacy group at 100 % that a flight
// scatters. The gate's victory scatters the plain group, so one kill is paid once whichever way the quest stands.
//
// Exits to other regions name their WORLD ids; they are pending until those units land (D-090).
import type { Condition } from '@schema/condition';
import type { LocationInput } from '@schema/location';

const CAMP_LEGACY =
  'Canvas tents and scrap-metal barricades form a rough circle. Smoke and hot iron fill the air, punctuated by the clatter of tools. A gap in the barricade faces north, watched by two scouts who do not blink.';
/** WORLD §3.2 State (after Brak's two quests) / §12.1 `ws_camp_doubled`. */
const CAMP_DOUBLED = 'The circle has doubled. New tents. A second fire. Someone has painted a bull on the barricade in ash.';

/** WORLD §3.2 `ev_forge_pulse`: the text by Heartstone state. */
const PULSE_STATES: Condition = { any: [{ flag: 'flag_heartstone_stabilized' }, { flag: 'flag_heartstone_exploited' }, { flag: 'flag_heartstone_destroyed' }] };

const BRUTE_INTRO = 'At the end of the path worn into the scree, roots and bone rise to meet you.';
const GOLEM_INTRO = 'Two slate figures stand in the drag furrows, turned to face outward.';

/**
 * WORLD §3.2/§12.1: "Horde: cr_horde_husk ×2 if infected and Brak is absent". Brak is absent after a Tyrant-kill Horde when both
 * his quests are done (he is at the Apex, `ws_brak_at_apex`), or whenever he was kept away (`flag_brak_kept_away`, he waits at
 * Hearthring). An expiry Horde does not move him.
 */
const BRAK_ABSENT: Condition = {
  any: [
    { flag: 'flag_brak_kept_away' },
    { all: [{ quest: { id: 'q_clear_path', status: 'completed' } }, { quest: { id: 'q_blighted_outpost', status: 'completed' } }, { not: { flag: 'flag_clock_expired' } }] },
  ],
};
/**
 * D-098 (U34d): the `infected` atom reads the Horde's infected set for the node the Wayfinder stands on (the spread runs before
 * the encounter roll). It replaces U43's reading by move count (`horde_moves` ≥ 8, or ≥ 10 after an expiry), which ran early
 * for a player lashed on the way.
 */
const CAMP_INFECTED: Condition = { infected: true };

/** U62b: `counters.custom` — arrivals at the Emberforge this loop (`echo_emberforge_vein` on the third). */
const EMBERFORGE_VISITS = 'emberforge_visits';

export const locations = [
  // ---- Mistwood Path — the fog, the herbs, the Nomads' cairns (WORLD §3.2; DESIGN §8.2 "Mistwood gathering") -----------------
  {
    id: 'loc_mistwood_path',
    regionId: 'region_mistwood_ironclad_reach',
    name: 'Mistwood Path',
    legacyName: 'Mistwood Path',
    description:
      "A winding trail threads through fog-laden trees. The bark glows faintly, and the air smells of crushed herbs. Shadows drift between the trunks. Cairns of scrap iron mark the Nomads' side of the path.",
    exits: [
      { dir: 'west', to: 'loc_whispering_ruins' },
      { dir: 'east', to: 'loc_ironclad_camp' },
      { dir: 'north', to: 'loc_silverwood_plaza' },
      { dir: 'south', to: 'loc_wayfarers_respite' },
    ],
    // WORLD: "mat_rootbone ×1, mat_ley_resin ×1" from the glowing bark. D-098 (U34d): a location gathers from several
    // nodes, so the bark gives both (the Ley Resin was not gatherable here, U43's reading).
    items: [{ itemId: 'item_ley_touched_tonic' }],
    gather: [
      { itemId: 'mat_rootbone', perDay: 1 },
      { itemId: 'mat_ley_resin', perDay: 1 },
    ],
    encounters: [
      // first: Prowlers ×2 (50 %) or Rootlings ×3 (30 %). The engine runs the first group whose roll succeeds, so the
      // second group's own roll is 0.3 / (1 − 0.5) = 0.6, which makes 30 % overall (WORLD §10.3: 0.8 fights on the first visit).
      // Heartstone destroyed: "no encounters (Nomad patrol present)".
      {
        id: 'enc_mistwood_prowlers',
        groups: [{ creatureId: 'cr_mistwood_prowler', count: 2 }],
        chance: 0.5,
        when: { not: { flag: 'flag_heartstone_destroyed' } },
        intro: 'Two shapes pace you through the fog, one on each side of the trail.',
      },
      {
        id: 'enc_mistwood_rootlings',
        groups: [{ creatureId: 'cr_rootling', count: 3 }],
        chance: 0.6,
        when: { not: { flag: 'flag_heartstone_destroyed' } },
        intro: 'Three knee-high tangles of root unfold from the loam beside the trail.',
      },
    ],
    events: [
      { id: 'ev_mistwood_herbs', text: 'You crush a leaf without meaning to. The smell is clean. Nothing here has been clean in a long time.' },
      { id: 'ev_mistwood_shapes', text: 'A shape between the trunks keeps your pace for ten steps, then is a tree.' },
      // U59 (STORY §11.8 `q_class_ranger` stages 1–2): read the ground while the Ranger's quest asks it; the scene reads the marks
      // and sets the snare (shared/dialogues/classes.ts)
      {
        id: 'ev_mistwood_read_ground',
        trigger: 'interact',
        label: 'Read the ground',
        text: 'Boot prints at the edge of the trail, one pair, light. Something with four feet walked over them.',
        once: false,
        when: { any: [{ quest: { id: 'q_class_ranger', stage: 'read_ground' } }, { quest: { id: 'q_class_ranger', stage: 'snare' } }] },
        effects: [{ startDialogue: 'scene_mistwood_read_ground' }],
      },
    ],
    // WORLD's particles are "fog drift (horizontal, slow)"; the nearest preset is spores (the horizontal drift is the UI unit's).
    art: { template: 'forest', horizon: 0.64, silhouettes: ['bark_seam_trunks', 'fog_band', 'scrap_cairn'], particles: 'spores', timeOfDay: 'dusk' },
    levelBand: { min: 2, max: 3 },
    map: { x: 8, y: 6 },
    tags: ['legacy', 'gathering'],
  },

  // ---- The Wayfarer's Respite — neutral ground; Kaelen's wagon (WORLD §3.2, §9; D-014) --------------------------------------
  {
    id: 'loc_wayfarers_respite',
    regionId: 'region_mistwood_ironclad_reach',
    name: "The Wayfarer's Respite",
    legacyName: "The Wayfarer's Respite",
    description:
      "A rare pocket of calm between mana-scarred cliffs. A silver-tinged stream winds through smooth stones, and a distant hum never quite fades. A trader's wagon with its wheels chocked has become a shop and, by the look of the bedroll, a home.",
    exits: [{ dir: 'north', to: 'loc_mistwood_path' }],
    // "none, ever (neutral ground, D-014)". In a Horde the Respite is infected like any node but "goes quiet": no fights spawn.
    safe: true,
    npcs: ['npc_kaelen_stonehand'],
    events: [
      { id: 'ev_respite_breath', text: "The stream's soft rush quiets the chaos in your thoughts." },
      {
        id: 'ev_respite_brother',
        text: 'Kaelen looks east toward the camp for a long moment, then does not.',
        when: { quest: { id: 'q_clear_path', status: 'completed' } },
      },
    ],
    art: { template: 'camp', horizon: 0.6, silhouettes: ['cliff_walls', 'awning_wagon', 'stream_curve'], particles: 'motes', timeOfDay: 'dusk' },
    // the inn: DESIGN §9.5 (full rest 10 gold, `status_rested`); WORLD §9.1 lists Kaelen's Inn at 10 g
    rest: { kind: 'inn', cost: 10 },
    merchantId: 'npc_kaelen_stonehand',
    levelBand: { min: 2, max: 3 },
    map: { x: 8, y: 8 },
    tags: ['legacy', 'merchant', 'settlement', 'neutral'],
  },

  // ---- Ironclad Camp — Brak; the Peaks gate; the Horde's Camp (WORLD §3.2, §12.1 `ws_camp_doubled`, `ws_caravan`) ------------
  {
    id: 'loc_ironclad_camp',
    regionId: 'region_mistwood_ironclad_reach',
    name: 'Ironclad Camp',
    legacyName: 'Ironclad Camp',
    description: CAMP_LEGACY,
    // WORLD §3.2 State (after Brak's two quests): the legacy text, the gap sentence, then the doubled circle
    descriptionVariants: [
      {
        when: { all: [{ quest: { id: 'q_clear_path', status: 'completed' } }, { quest: { id: 'q_blighted_outpost', status: 'completed' } }] },
        text: `${CAMP_LEGACY} ${CAMP_DOUBLED}`,
      },
    ],
    exits: [
      { dir: 'west', to: 'loc_mistwood_path' },
      // WORLD §11.3 `gate_peaks_pass` (legacy: Brak's job opens the pass; Loop 2+: you know the scouts' challenge words).
      // "accepted" is "in the journal, accepted or later" (WORLD §3): the schema's `quest` with no stage and no status.
      {
        dir: 'north',
        to: 'loc_barren_peaks',
        when: { any: [{ quest: { id: 'q_clear_path' } }, { echo: 'echo_ironclad_passwords' }] },
        // the legacy refusal line (echoes_of_aethelgard.py `move_player`)
        lockedText: 'I should talk to Brak before going this way.',
      },
    ],
    // Tessaly's caravan (`flag_hearthring_caravan`, WORLD §9.1 / `ws_caravan`): D-098 (U34d) her NPC schedule
    // (../ashen_steppe/npcs.ts) stands her here as well as at Hearthring, and her stall trades where she stands.
    encounters: [
      // Horde (WORLD §3.2, §10.5, §12.1): cr_horde_husk ×2 when the Camp is infected and Brak is absent. Horde fights hold (R10-1).
      {
        id: 'enc_camp_husks',
        groups: [{ creatureId: 'cr_horde_husk', count: 2 }],
        when: { all: [{ flag: 'flag_horde_active' }, BRAK_ABSENT, CAMP_INFECTED] },
        fleeable: false,
        onFlee: 'hold',
        intro: 'Two shapes stand where the scouts stood, coming apart and together.',
      },
    ],
    safe: true,
    npcs: ['npc_brak'], // Brak leaves in the Horde or waits at Hearthring when kept away: engine npcOverrides (horde.ts)
    events: [
      { id: 'ev_camp_clamor', text: 'Hammer strikes ring out like a steady heartbeat.' },
      { id: 'ev_camp_bull', text: "The ash bull on the barricade is Hearthring's sign. Someone here is homesick.", when: { flag: 'flag_hearthring_caravan' } },
      // U59 (STORY §11.8 `q_class_ironclad_warden` stage 2): the gap in the barricade, the night the Warden holds it; the scene starts
      // the first of three waves (shared/dialogues/classes.ts, shared/quests/classes.ts)
      {
        id: 'ev_camp_barricade_gap',
        trigger: 'interact',
        label: 'Take the gap in the barricade',
        text: 'The gap in the barricade faces north. Nothing is in it.',
        once: false,
        when: { quest: { id: 'q_class_ironclad_warden', stage: 'hold' } },
        effects: [{ startDialogue: 'scene_camp_barricade_night' }],
      },
    ],
    art: { template: 'camp', horizon: 0.6, silhouettes: ['tent_peaks', 'barricade_spikes', 'smoke_column'], particles: 'embers', timeOfDay: 'dusk' },
    // WORLD §11.1 / §10.3: an inn (Camp rest points: WY inn, IC inn, EF camp); the fee is DESIGN §9.5's
    rest: { kind: 'inn', cost: 10 },
    levelBand: { min: 3, max: 4 },
    map: { x: 16, y: 6 },
    tags: ['legacy', 'ironclad', 'settlement', 'companion_anchor'],
  },

  // ---- Barren Peaks — the Brute's den; the Loop 2+ hound (WORLD §3.2, §10.5) -----------------------------------------------
  {
    id: 'loc_barren_peaks',
    regionId: 'region_mistwood_ironclad_reach',
    name: 'Barren Peaks',
    legacyName: 'Barren Peaks',
    description:
      'Razor-edged ridges scrape the sky as the wind howls through broken stone. Higher up, the air tastes of dust and iron. Something large has worn a path through the scree, back and forth, for years.',
    exits: [
      { dir: 'south', to: 'loc_ironclad_camp' },
      { dir: 'east', to: 'loc_blighted_outpost' },
    ],
    // WORLD: "mat_wildling_hide ×1 (60 % after the Brute is slain, in its den)". Hidden (found by examine) once the Brute has
    // fallen this loop; D-098 (U34d): at its own 60 %, rolled at that examine (was 100 %, D-091 gap 1).
    items: [{ itemId: 'mat_wildling_hide', hidden: true, chance: 0.6, when: { killed: { id: 'cr_wildling_brute' } } }],
    encounters: [
      // legacy: the Wildling Brute (100 %, first visit); a story gate while `q_clear_path` is active (R10-1, §10.5)
      {
        id: 'enc_peaks_brute_gate',
        groups: [{ creatureId: 'cr_wildling_brute' }],
        when: { quest: { id: 'q_clear_path', status: 'active' } },
        fleeable: false,
        onFlee: 'hold',
        onVictory: [{ scatter: { location: 'loc_barren_peaks' } }],
        intro: BRUTE_INTRO,
      },
      // without the quest (Loop 2+ by the passwords) the same Brute is a plain scatter node
      { id: 'enc_peaks_brute', groups: [{ creatureId: 'cr_wildling_brute' }], intro: BRUTE_INTRO },
      // return: Loop 2+ 15 % Stutter Hound, ahead of the pool's 20 % roll
      {
        id: 'enc_peaks_stutter_hound',
        groups: [{ creatureId: 'cr_stutter_hound' }],
        chance: 0.15,
        when: { loop: { min: 2 } },
        once: false,
        respawn: 'on_return',
        intro: 'A grey hound on the ridge bites at nothing, then bites again.',
      },
    ],
    events: [
      { id: 'ev_peaks_gale', text: 'A cutting gale whips through the peaks, carrying flecks of stone.' },
      // "after killing cr_wildling_brute": it fires on the first entry after the kill
      {
        id: 'ev_peaks_den',
        text: "The Brute's den is a nest of roots and old steel. Nomad steel. It has been eating patrols.",
        when: { killed: { id: 'cr_wildling_brute' } },
      },
    ],
    art: { template: 'peaks', horizon: 0.45, silhouettes: ['blade_ridges', 'worn_switchback', 'standing_stone'], particles: 'ash', timeOfDay: 'dusk' },
    levelBand: { min: 3, max: 5 },
    map: { x: 16, y: 4 },
    tags: ['legacy', 'story_gate'],
  },

  // ---- Blighted Outpost — Vane's Watch; the Golem pair; the scorched gate (WORLD §3.2, §10.4, §11.3) -------------------------
  {
    id: 'loc_blighted_outpost',
    regionId: 'region_mistwood_ironclad_reach',
    name: 'Blighted Outpost',
    legacyName: 'Blighted Outpost',
    description:
      'Splintered palisades jut from the rock like broken teeth. The ground is scarred with drag marks and heavy footprints. A burned gate in the east wall still bears an iron bull, and beyond it the land goes grey.',
    exits: [
      { dir: 'west', to: 'loc_barren_peaks' },
      { dir: 'south', to: 'loc_sky_whisper_plateau' },
      { dir: 'north', to: 'loc_emberforge' },
      // WORLD §11.3 `gate_scorched_gate`: the Nomad watch admits those Brak vouches for, or those who know the trail-signs
      // (eastbound only; the Steppe is open from the south)
      {
        dir: 'east',
        to: 'loc_scorched_gate',
        when: { any: [{ quest: { id: 'q_blighted_outpost', status: 'completed' } }, { echo: 'echo_nomad_signs' }] },
      },
    ],
    items: [
      // WORLD: "mat_slate_core ×1 (100 % after both Golems fall)": hidden (examine) once two Golems have fallen this loop
      { itemId: 'mat_slate_core', hidden: true, when: { killed: { id: 'cr_stone_hide_golem', count: 2 } } },
      // ev_outpost_seal, Loop 2+ with echo_vask_seal: "the seal opens a slot under the burned gate's sill", Tobrin's failsafe
      // copy (100 %, once per loop; D-067.6)
      { itemId: 'item_breach_anchor_schematic_b', hidden: true, when: { all: [{ loop: { min: 2 } }, { echo: 'echo_vask_seal' }] } },
    ],
    encounters: [
      // legacy: two Stone-Hide Golems (100 %, one group of two); a story gate while `q_blighted_outpost` is active
      {
        id: 'enc_outpost_golems_gate',
        groups: [{ creatureId: 'cr_stone_hide_golem', count: 2 }],
        when: { quest: { id: 'q_blighted_outpost', status: 'active' } },
        // DESIGN §13.3 #8, the Golem shortcut: a word stills them and the encounter becomes optional
        optionalWhen: { echo: 'echo_stone_hide_origin' },
        fleeable: false,
        onFlee: 'hold',
        onVictory: [{ scatter: { location: 'loc_blighted_outpost' } }],
        intro: GOLEM_INTRO,
      },
      // from the Plateau without the quest the pair is a scatter node (§10.4). The word stills these too (U34e, D-105: DESIGN
      // §13.3 #8 "stills the Blighted Outpost Golems"; without it the pair fought whenever the Echo skipped the gate)
      {
        id: 'enc_outpost_golems',
        groups: [{ creatureId: 'cr_stone_hide_golem', count: 2 }],
        optionalWhen: { echo: 'echo_stone_hide_origin' },
        intro: GOLEM_INTRO,
      },
      // return: a Warding Pillar (30 %, "it was always there, dormant"), ahead of the pool's 20 % roll
      {
        id: 'enc_outpost_pillar',
        groups: [{ creatureId: 'cr_warding_pillar' }],
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'A standing stone beside the gate, cut with a ring and a bar, begins to hum.',
      },
    ],
    events: [
      { id: 'ev_outpost_ash', text: 'Stone scrapes stone as something massive shifts in the dark.' },
      // "after killing cr_stone_hide_golem": it fires on the first entry after the kill
      {
        id: 'ev_outpost_seal',
        text: "Each golem bears the same mark on its brow: a square inside a circle. A warder's seal.",
        when: { killed: { id: 'cr_stone_hide_golem' } },
        effects: [{ grantEcho: 'echo_vask_seal' }],
      },
    ],
    art: { template: 'ruins', horizon: 0.58, silhouettes: ['palisade_teeth', 'burned_gate_bull', 'drag_furrows'], particles: 'ash', timeOfDay: 'dusk' },
    levelBand: { min: 4, max: 6 },
    map: { x: 24, y: 4 },
    tags: ['legacy', 'story_gate', 'vanes_watch'],
  },

  // ---- The Emberforge — Borin's forge; the hearth (WORLD §3.2, §8, §9) -------------------------------------------------------
  {
    id: 'loc_emberforge',
    regionId: 'region_mistwood_ironclad_reach',
    name: 'The Emberforge',
    legacyName: 'The Emberforge',
    description:
      'A sheltered canyon opens into a warm cavern, its walls veined with ember-bright stone. Heat breathes up from below, and a hammer rings through the glow. The veins in the wall pulse in time with something far to the south-west.',
    exits: [{ dir: 'south', to: 'loc_blighted_outpost' }],
    // Loop 2+, if `echo_vask_seal`: Borin "found it in the slag" (100 %, once). The Breach-anchor itself is forged here for
    // 0 gold at Neutral while q_the_mending or q_iron_silence is active (D-066.10, §8.2): the recipe unit's.
    items: [{ itemId: 'item_tobrins_warding_primer', when: { all: [{ loop: { min: 2 } }, { echo: 'echo_vask_seal' }] } }],
    // "none. Horde: none (the heat holds them off one extra move)": the extra move is the engine's slow edge BO → EF
    safe: true,
    npcs: ['npc_borin_stonefist'],
    events: [
      // U62b (STORY §12 `echo_emberforge_vein`: "The Emberforge's third visit in one loop (the fire shows you where the ore runs)"):
      // the visits are counted by these three (`emberforge_visits`, this loop), latest first so one arrival fires one of them
      {
        id: 'ev_forge_vein_shown',
        text: 'Third time down the canyon mouth, and the fire knows you. The veins in the wall brighten where the ore runs nearest, like a hand pointing.',
        when: { counter: { name: EMBERFORGE_VISITS, min: 2 } },
        effects: [{ counter: { name: EMBERFORGE_VISITS, delta: 1 } }, { grantEcho: 'echo_emberforge_vein' }],
      },
      {
        id: 'ev_forge_regular',
        text: 'Borin lifts his hammer an inch by way of greeting. Twice is a habit, in the Reach.',
        when: { counter: { name: EMBERFORGE_VISITS, min: 1, max: 1 } },
        effects: [{ counter: { name: EMBERFORGE_VISITS, delta: 1 } }],
      },
      { id: 'ev_emberforge_heat', text: 'The forge heat wraps around you like a heavy cloak.', effects: [{ counter: { name: EMBERFORGE_VISITS, delta: 1 } }] },
      // WORLD §8 `mat_ember_ore`: "Emberforge vein 3/loop (8 with `echo_emberforge_vein`)"; once a loop, whichever applies
      {
        id: 'ev_forge_vein',
        trigger: 'interact',
        label: 'Work the ember vein',
        text: 'You prise ore out of the warm wall where Borin points. Three lumps come loose before the vein goes dull.',
        when: { all: [{ not: { echo: 'echo_emberforge_vein' } }, { not: { flag: 'flag_ember_vein_worked' } }] },
        effects: [{ setFlag: 'flag_ember_vein_worked' }, { giveItem: { item: 'mat_ember_ore', count: 3 } }],
      },
      {
        id: 'ev_forge_vein_known',
        trigger: 'interact',
        label: 'Work the ember vein',
        text: 'You know where the ore runs now. You follow the bright seams through the wall and take eight lumps before the vein goes dull.',
        when: { all: [{ echo: 'echo_emberforge_vein' }, { not: { flag: 'flag_ember_vein_worked' } }] },
        effects: [{ setFlag: 'flag_ember_vein_worked' }, { giveItem: { item: 'mat_ember_ore', count: 8 } }],
      },
      // WORLD: one event whose text varies by Heartstone state (stabilized "slow and sure"; exploited "wrong"; destroyed
      // "The veins are cold. Borin does not look up."). An event has one text, so each state is its own event; the three
      // states' ids are coined (`ev_forge_pulse_<state>`).
      {
        id: 'ev_forge_pulse',
        text: "Borin rests his hammer and listens. 'Heartstone's beating fast tonight,' he says, to no one.",
        when: { not: PULSE_STATES },
      },
      {
        id: 'ev_forge_pulse_stabilized',
        text: "Borin rests his hammer and listens. 'Heartstone's beating slow and sure tonight,' he says, to no one.",
        when: { flag: 'flag_heartstone_stabilized' },
      },
      {
        id: 'ev_forge_pulse_exploited',
        text: "Borin rests his hammer and listens. 'Heartstone's beating wrong tonight,' he says, to no one.",
        when: { flag: 'flag_heartstone_exploited' },
      },
      { id: 'ev_forge_pulse_destroyed', text: 'The veins are cold. Borin does not look up.', when: { flag: 'flag_heartstone_destroyed' } },
    ],
    // WORLD §3.2: horizon 0.52 (cavern); the forge hearth is DESIGN §17.2's hand-authored Emberforge piece
    art: {
      template: 'cavern',
      horizon: 0.52,
      silhouettes: ['anvil_bellows', 'ember_veined_walls', 'canyon_mouth'],
      particles: 'embers',
      focal: 'emberforge',
      timeOfDay: 'timeless',
    },
    // the forge hearth: a free camp (WORLD §11.1 rest `camp`, §9.1 "free forge hearth")
    rest: { kind: 'camp' },
    merchantId: 'npc_borin_stonefist',
    craftingStation: 'forge',
    levelBand: { min: 4, max: 6 },
    map: { x: 24, y: 2 },
    tags: ['legacy', 'ironclad', 'settlement', 'smith', 'forge'],
  },
] satisfies LocationInput[];
