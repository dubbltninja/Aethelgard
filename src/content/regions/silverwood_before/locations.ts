// Silverwood Before — the ten locations (WORLD §3.11 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates WORLD §11.3;
// states WORLD §12.1 `ws_before_day_1..3`, `ws_wanted`). New locations: the descriptions are WORLD's, character for character
// (no `+` sentence, no `legacyName`), as play text: the Library's card loses its markdown emphasis and the Conflux loses
// WORLD's editorial parenthesis "(STORY wins, D-067.10: …)". Encounter and event ids follow the Ruins
// (../silverwood_ruins/locations.ts header); the schema's `once` is per loop, so WORLD's "once" and "once per loop" are the
// same field.
//
// The engine runs the Before (src/engine/before.ts, U32; DESIGN §10.1; D-016, D-066.9, D-067.4/5): any arrival from outside
// the region freezes the Breach Clock and starts the echo at First Bell, setting the door flag the Wayfinder came by
// (`flag_entered_before_via_nexus` / `_via_apex`); the Garret's full rest advances the Bell, and on Last Bell resets the echo
// (a fresh echo: Before-local flags, ground drops and cleared fights are forgotten); leaving costs a dawn; a fight pays once
// per loop. So this file only says where things are and on which Bell:
//   - the Bell is DESIGN §13.3's `{ beforeDay: n }`. WORLD writes the gates with the engine's mirror flags
//     (`{flag:"flag_before_day_3"}`); the atom reads the same counter and is not a content flag (rule 2 would warn about a
//     mirror flag nobody sets), so the gates carry the atom;
//   - every edge costs 0 watches (WORLD §11.0); the two doors back are hidden unless the Wayfinder came by them (WORLD §11.3:
//     only that door leads back; the engine charges the dawn on leaving);
//   - day-scripted guards hold (R10-1: "the Before's day-scripted guards (Archives Day 2, Hall Day 3, Conflux)").
//
// Readings (each repeated where it applies; listed in the U48b reply):
//   - a `first:` group under 100 % on a Bell (the Walks' hounds, the Library's and the Corridor's adepts) rolls on every
//     arrival while its Bell holds and until it is fought (`respawn: 'daily'`): the Before's places are visited once per
//     loop, so the engine's first-visit roll would come on First Bell, when the group is not there, and never again; the
//     frozen clock keeps one "day" for the whole visit and each fresh echo forgets the clear;
//   - an item that waits for its Bell or for something the visit itself earns (an Echo granted on arrival, a quest done, a
//     fight won) lies `hidden` with its condition, for `examine` to find: a location item appears only at the loop's first
//     entry (U34d's gap 2), when such a condition cannot yet hold. Items given by people are placed where WORLD puts them,
//     with the gift's condition (the Reach's reading at the Bell-Warden's Deep);
//   - drawing a weapon in the Plaza is an `interact` event that starts the Watch's encounter, which never starts on an
//     arrival; the arrest (non-lethal: wake in the Garret, lose a day) has no field, so losing that fight is a death (gap);
//   - `ev_gate_whole` "once per entry" fires once per echo, guarded by a Before-local flag the fresh echo clears;
//   - `flag_visited_before` (read by the Ruins' Plaza and the Apex, set by nothing in WORLD) is set on arriving through either
//     door: by `ev_gate_whole` and `ev_conflux_well`;
//   - `ev_plaza_crack` (Last Bell at the Plaza) grants `echo_bells_of_silverwood`, STORY §12's only source for it ("The Plaza
//     of Bells on Last Bell");
//   - `ev_conflux_sundering` is not authored: D-083 supersedes it (the echo resets to First Bell in place, at the Garret's
//     Last Bell rest; the engine writes that line).
// Not expressible (the U48b reply): NPC presence by Bell (placements have no condition: each NPC stands at home all three
// days; Caelum on the Plaza on First Bell, young Nyxaria on the Plaza at night and the Nine at the plinths on Last Bell are
// the dialogue units' and the engine's); the Corridor's Last Bell ley-flare (Burn on entry: a region hazard); "noon" for the
// Spire Yard (the Before's clock is frozen, so a watch atom reads the hour of arrival); the anomaly `cr_anomaly_early_hound`
// (anomalies have no region link, D-091 gap 4).
import type { Condition } from '@schema/condition';
import type { LocationInput } from '@schema/location';

const REGION = 'region_silverwood_before';

/** The Bells (WORLD §2.6): First Bell = 1, Second Bell = 2, Last Bell = 3. */
const bell = (...days: (1 | 2 | 3)[]): Condition => (days.length === 1 ? { beforeDay: days[0] as 1 | 2 | 3 } : { any: days.map((d) => ({ beforeDay: d })) });
const SEAL: Condition = { item: { id: 'item_ward_seal' } };
const CAELUM_ACTIVE: Condition = { companion: { id: 'caelum', state: 'active' } };
const WANTED: Condition = { flag: 'flag_wanted_in_silverwood' };
/** WORLD §11.3 `gate_hall_doors`: "the Hall admits apprentices and the sealed; on Last Bell its doors stand open". */
const HALL_DOORS: Condition = { any: [bell(3), SEAL, CAELUM_ACTIVE] };
/** WORLD §11.3 `gate_conflux_stair`: "the stair is warded until Last Bell". */
const CONFLUX_STAIR: Condition = { any: [bell(3), SEAL] };
/** The Plaza Watch's encounter: started only by the drawn blade (`startCombat`), never by an arrival. */
const ONLY_WHEN_STARTED: Condition = { not: { all: [] } };
/** Tobrin Vask's failsafe on Second Bell (WORLD §3.11: "both from Tobrin Vask if `echo_vask_seal`"). */
const TOBRIN_GIVES: Condition = { all: [bell(2), { echo: 'echo_vask_seal' }] };
/** The Warden kneels to the seal with Caelum beside the Wayfinder (WORLD §3.11, §10.5). */
const THE_KNEELING: Condition = { all: [SEAL, CAELUM_ACTIVE] };

export const locations = [
  // ---- The Silver Gate — the Breach-door's far side; the Gate-Captain (WORLD §3.11, §11.3) ----------------------------------
  {
    id: 'loc_silver_gate',
    regionId: REGION,
    name: 'The Silver Gate',
    description:
      'The arch, whole. Silver leaf on the keystone, nine faces newly cut. Guards in blue and white check papers. Beyond the gate the city rises in roofs you have only seen as rubble. Behind you the air shimmers where you came through, and no one looks at it.',
    exits: [
      { dir: 'north', to: 'loc_scholars_corridor', travelWatches: 0 },
      { dir: 'south', to: 'loc_outer_walks', travelWatches: 0 },
      // WORLD §11.3 `gate_breach_door_back`: the way back, only for one who came by it
      { dir: 'west', to: 'loc_chronos_nexus', when: { flag: 'flag_entered_before_via_nexus' }, travelWatches: 0, hidden: true, label: 'the Breach-door' },
    ],
    encounters: [
      // "none (Watch present); on Day 3, cr_city_watch_halberdier ×2 if `flag_wanted_in_silverwood`"
      {
        id: 'enc_silver_gate_halberdiers',
        groups: [{ creatureId: 'cr_city_watch_halberdier', count: 2 }],
        when: { all: [bell(3), WANTED] },
        intro: 'Two of the Watch step out from under the arch. They have your description.',
      },
    ],
    npcs: ['npc_bryn_dunn'],
    events: [
      // "once per entry": once per echo (see the header); arriving here is arriving in the Before
      {
        id: 'ev_gate_whole',
        text: 'The arch is whole. You put a hand on it. It is cool, and it does not remember anything yet.',
        once: false,
        when: { not: { flag: 'flag_before_gate_whole' } },
        effects: [{ setFlag: 'flag_before_gate_whole' }, { setFlag: 'flag_visited_before' }],
      },
    ],
    // WORLD's particles are "dawn dust-gold"; motes is the nearest preset
    art: { template: 'city', horizon: 0.55, silhouettes: ['whole_arch', 'uniformed_guards', 'roofed_skyline'], particles: 'motes', timeOfDay: 'dawn' },
    levelBand: { min: 13, max: 13 },
    map: { x: 64, y: 4 },
    temporallyUnstable: true,
    tags: ['gate', 'breach_door', 'watch'],
  },

  // ---- The Outer Walks — the Ruins to be; the blank tablet; the Circle's hounds (WORLD §3.11) ---------------------------------
  {
    id: 'loc_outer_walks',
    regionId: REGION,
    name: 'The Outer Walks',
    description:
      "Gardens outside the gate where the Ruins will be. The trees are straight and bear no crystals. Stone tablets stand at intervals, newly carved with the names of the Circle's benefactors. One is blank, waiting.",
    exits: [
      { dir: 'north', to: 'loc_silver_gate', travelWatches: 0 },
      { dir: 'east', to: 'loc_apprentices_garret', travelWatches: 0 },
      { dir: 'south', to: 'loc_archives_of_danthe', travelWatches: 0 },
    ],
    items: [{ itemId: 'item_silverwood_honeycake', count: 2 }],
    // "a felled tree by the tablets; once per loop": the engine keeps a Before node's count for the whole loop
    gather: { itemId: 'mat_silverwood_heartwood', perDay: 1 },
    encounters: [
      // "first: cr_ley_hound ×2 (Day 2–3 only, 40%; the Circle's hounds roam when the Archives are sealed)": see the header
      {
        id: 'enc_walks_hounds',
        groups: [{ creatureId: 'cr_ley_hound', count: 2 }],
        chance: 0.4,
        when: bell(2, 3),
        respawn: 'daily',
        intro: 'Two hounds come out between the tablets, heads low, teeth faintly blue.',
      },
    ],
    npcs: ['npc_seraphine_aulde'],
    events: [
      {
        id: 'ev_walks_tablet',
        text: 'The blank tablet stands where you will wake in five hundred years. You do not carve anything on it. You think about it.',
      },
    ],
    // WORLD's particles are "leaves"; pollen is the nearest preset
    art: { template: 'city', horizon: 0.6, silhouettes: ['straight_trees', 'tablet_row', 'garden_wall'], particles: 'pollen', timeOfDay: 'day' },
    levelBand: { min: 13, max: 13 },
    map: { x: 64, y: 6 },
    temporallyUnstable: true,
    tags: ['gardens', 'gathering'],
  },

  // ---- The Scholars' Corridor — the clean wall where the scorch-hand will be (WORLD §3.11) -----------------------------------
  {
    id: 'loc_scholars_corridor',
    regionId: REGION,
    name: "The Scholars' Corridor",
    description:
      'A covered walk between the gate and the Library, lamps every ten paces, scholars in grey passing with armfuls of books. The wall where a scorch-hand will be is clean plaster. On Day 3 the lamps flare blue and the plaster begins to warm.',
    exits: [
      { dir: 'south', to: 'loc_silver_gate', travelWatches: 0 },
      { dir: 'north', to: 'loc_grand_library', travelWatches: 0 },
    ],
    encounters: [
      // "Day 3: … cr_circle_adept ×1 (50%) if `flag_wanted_in_silverwood`" (the ley-flare is a hazard: see the header)
      {
        id: 'enc_scholars_adept',
        groups: [{ creatureId: 'cr_circle_adept' }],
        chance: 0.5,
        when: { all: [bell(3), WANTED] },
        respawn: 'daily',
        intro: 'An adept in grey turns from the warming plaster and sees you.',
      },
    ],
    npcs: ['npc_maelis_korr'],
    events: [
      {
        id: 'ev_corridor_plaster',
        text: 'A scholar leans on the clean wall, hand flat, to shift his books. You see where the scorch will be.',
      },
    ],
    // "lamplight motes (Day 3: blue flare)": motes, then static for the flare
    art: {
      template: 'city',
      horizon: 0.68,
      silhouettes: ['colonnade', 'lamps', 'grey_figures'],
      particles: 'motes',
      timeOfDay: 'day',
      variants: [{ when: bell(3), patch: { particles: 'static' } }],
    },
    levelBand: { min: 13, max: 14 },
    map: { x: 64, y: 2 },
    temporallyUnstable: true,
    tags: ['corridor', 'ley_flare'],
  },

  // ---- The Grand Library of Silverwood — the Crystal in its cradle, unlit (WORLD §3.11; STORY §9.5) --------------------------
  {
    id: 'loc_grand_library',
    regionId: REGION,
    name: 'The Grand Library of Silverwood',
    description:
      "Shelves to the ceiling and a ceiling you cannot see. Ladders on rails. Light through a glass roof. In an alcove behind the eastern stacks a crystal waits in a cradle of stone, unlit, with a card in Oriel Danthe's hand: Do not sing to it.",
    exits: [
      { dir: 'south', to: 'loc_scholars_corridor', travelWatches: 0 },
      { dir: 'east', to: 'loc_plaza_of_bells', travelWatches: 0 },
    ],
    items: [
      // "Day 1–2, in the restricted stacks; requires `item_ward_seal` or `rep remnants ≥ 20` via Oriel's letter" (hidden: header)
      { itemId: 'item_korrs_marginalia', hidden: true, when: { all: [bell(1, 2), { any: [SEAL, { rep: { faction: 'remnants', min: 20 } }] }] } },
      { itemId: 'item_remnant_ink', count: 2 },
    ],
    encounters: [
      // "none Days 1–2; Day 3: cr_circle_adept ×2 (60%)" (see the header)
      {
        id: 'enc_grand_library_adepts',
        groups: [{ creatureId: 'cr_circle_adept', count: 2 }],
        chance: 0.6,
        when: bell(3),
        respawn: 'daily',
        intro: 'Two adepts in grey come down the rail ladders. The stacks are closed today.',
      },
    ],
    // Masque on the glass roof; Oriel is in her Archives
    npcs: ['npc_tovren_masque'],
    events: [
      {
        id: 'ev_library_cradle',
        text: 'The Echo Crystal sits in its cradle, dark. It has not heard the nine voices yet. You could tell it what it will hear.',
      },
      // "Loop 3+ option grants `echo_crystal_seeded`": the option is the player's to take, so it is an `interact` event
      {
        id: 'ev_library_cradle_seed',
        trigger: 'interact',
        label: 'Tell it what it will hear',
        text: 'You tell the dark Crystal the nine voices it will hear. It does not light. It listens.',
        when: { loop: { min: 3 } },
        effects: [{ grantEcho: 'echo_crystal_seeded' }],
      },
    ],
    // "dust in sunlight": motes
    art: { template: 'archive', horizon: 0.7, silhouettes: ['shelf_walls', 'rail_ladders', 'glass_roof_grid'], particles: 'motes', timeOfDay: 'day' },
    levelBand: { min: 14, max: 14 },
    map: { x: 64, y: 0 },
    temporallyUnstable: true,
    tags: ['library', 'crystal'],
  },

  // ---- The Plaza of Bells — the fountains run; Anso's stall; the Watch post; the Spire Yard (WORLD §3.11, §9, §11.5) --------
  {
    id: 'loc_plaza_of_bells',
    regionId: REGION,
    name: 'The Plaza of Bells',
    description:
      "The fountains run. Nine bells hang in a frame above them and ring the hours, and on First Bell they ring all day for the Circle's Conflux and the city dances. A bellwright sells charms from a stall. The air tastes of water and bread, not copper.",
    exits: [
      { dir: 'west', to: 'loc_grand_library', travelWatches: 0 },
      { dir: 'south', to: 'loc_apprentices_garret', travelWatches: 0 },
      { dir: 'east', to: 'loc_ninefold_hall', when: HALL_DOORS, travelWatches: 0, lockedText: 'The Hall admits apprentices and the sealed.' },
    ],
    // "Day 3, after the first toll cracks a bell; 100%" (hidden: header)
    items: [{ itemId: 'item_bell_shard', hidden: true, when: bell(3) }],
    encounters: [
      // "none; drawing a weapon here summons cr_city_watch_halberdier ×2 (non-lethal arrest)": `ev_plaza_blade` starts it
      {
        id: 'enc_bells_watch',
        groups: [{ creatureId: 'cr_city_watch_halberdier', count: 2 }],
        when: ONLY_WHEN_STARTED,
        intro: 'Whistles go up across the fountains. Two of the Watch come at a run.',
      },
    ],
    // Caelum (First Bell) and young Nyxaria (nights) come here from their homes: not placements (see the header)
    npcs: ['npc_bellwright_anso', 'npc_corvin_dreyl'],
    events: [
      { id: 'ev_plaza_dance', text: 'They are dancing. Someone pulls you into it. For a moment you are a person in a city, and nothing else.', when: bell(1) },
      // STORY §12: `echo_bells_of_silverwood` — "The Plaza of Bells on Last Bell" (see the header)
      { id: 'ev_plaza_crack', text: 'The ninth bell cracks on the first toll of Last Bell. No one dances.', when: bell(3), effects: [{ grantEcho: 'echo_bells_of_silverwood' }] },
      // "once, Day 3 noon, during `q_the_apprentices_errand` (STORY §9.1: the Spire Yard; grants `echo_litany_verse_5`)"
      {
        id: 'ev_plaza_spire_yard',
        text: "On the east terrace Aulde reads a boy's message, laughs once, and says to the bells: 'Begin at the ninth.' Verse 5 is in her laugh.",
        when: { all: [bell(3), { quest: { id: 'q_the_apprentices_errand', status: 'active' } }] },
        effects: [{ grantEcho: 'echo_litany_verse_5' }],
      },
      // the drawn blade (WORLD §2.6 hazards, §6.9; `ws_wanted`): every time, while the Watch stands at its post
      {
        id: 'ev_plaza_blade',
        trigger: 'interact',
        label: 'Draw your weapon',
        text: 'Steel comes out in the Plaza of Bells. At the Watch post a whistle goes up.',
        once: false,
        effects: [{ startCombat: 'enc_bells_watch' }],
      },
    ],
    // "water spray (Day 3: none)": rain is the nearest preset to spray
    art: {
      template: 'city',
      horizon: 0.58,
      silhouettes: ['running_fountains', 'bell_frame', 'dancers'],
      particles: 'rain',
      timeOfDay: 'day',
      variants: [{ when: bell(3), patch: { particles: 'none' } }],
    },
    merchantId: 'npc_bellwright_anso',
    levelBand: { min: 13, max: 14 },
    map: { x: 72, y: 0 },
    temporallyUnstable: true,
    tags: ['merchant', 'settlement', 'watch', 'spire_yard'],
  },

  // ---- The Ninefold Hall — the Circle's chapterhouse; Veyran's study; Masque's dome (WORLD §3.11, §11.5; STORY §9) ---------
  {
    id: 'loc_ninefold_hall',
    regionId: REGION,
    name: 'The Ninefold Hall',
    description:
      "The Circle's chapterhouse: a round hall with nine chairs and a floor-map of the ley lines inlaid in silver. The chairs are occupied on First Bell. On Last Bell they are empty, and the Chasm of Whispers will open exactly here.",
    exits: [{ dir: 'west', to: 'loc_plaza_of_bells', travelWatches: 0 }],
    // "item_orrery_key duplicate (Masque's chair, where Hadrek works, Day 1, 100% if `echo_hadrek_clockwright`)" (hidden: header);
    // item_litany_page_3 "is not here (see Archives)"
    items: [{ itemId: 'item_orrery_key', hidden: true, when: { all: [bell(1), { echo: 'echo_hadrek_clockwright' }] } }],
    encounters: [
      // "Day 3: cr_ninefold_knight ×1 (100%) guards the empty hall": a day-scripted guard (R10-1), so it holds
      {
        id: 'enc_hall_knight',
        groups: [{ creatureId: 'cr_ninefold_knight' }],
        when: bell(3),
        fleeable: false,
        onFlee: 'hold',
        intro: 'The nine chairs are empty. Plate with no one in it stands on the floor-map.',
      },
    ],
    npcs: ['npc_veyran_thal', 'npc_nyxaria_vell_before', 'npc_haldric_vane', 'npc_hadrek', 'npc_tobrin_vask'],
    events: [
      {
        id: 'ev_hall_veyran',
        text: "Veyran Thal looks at you the way a man looks at a letter he has not opened. 'You are not from the city,' he says. 'You are not from the year.'",
        when: bell(1),
        effects: [{ grantEcho: 'echo_tyrant_name' }],
      },
      // Veyran's study, the Hall's east closet (STORY §9.5: verse 9's draft)
      {
        id: 'ev_hall_study_draft',
        text: 'In the study, a draft of the ninth verse, crossed out four times. The fifth version is not finished. The ink is still wet.',
        when: bell(2, 3),
        effects: [{ grantEcho: 'echo_litany_verse_9' }],
      },
      // Masque's roof, the Hall's dome: `q_stop_the_ritual`'s final beat; the quest grants `echo_ritual_inevitable` (STORY §12)
      {
        id: 'ev_hall_masque_roof',
        text: "On the dome, Masque has his eye to the glass. 'It fails,' he says without turning. 'I have read it twice. Go and tell him. He will not hear it from me.'",
        when: bell(3),
      },
    ],
    // "silver glints along the floor lines": motes
    art: { template: 'sanctum', horizon: 0.6, silhouettes: ['nine_chairs', 'silver_floor_map', 'domed_roof'], particles: 'motes', timeOfDay: 'day' },
    levelBand: { min: 15, max: 15 },
    map: { x: 80, y: 0 },
    temporallyUnstable: true,
    tags: ['ninefold_circle', 'elite', 'story_gate'],
  },

  // ---- The Apprentices' Garret — the Before's only rest; Caelum (WORLD §3.11; DESIGN §10.1) -----------------------------------
  {
    id: 'loc_apprentices_garret',
    regionId: REGION,
    name: "The Apprentices' Garret",
    description:
      "A long attic over the eastern road where the Circle's apprentices sleep. Cots, slates, a window onto the Plaza. One cot has a book under the pillow and a boy on it who should be asleep and is reading the Litany instead.",
    exits: [
      { dir: 'west', to: 'loc_outer_walks', travelWatches: 0 },
      { dir: 'north', to: 'loc_plaza_of_bells', travelWatches: 0 },
      { dir: 'south', to: 'loc_cistern_gardens', travelWatches: 0 },
    ],
    items: [
      // "Caelum gives it; his quest" — WORLD §7.10: his errand, or `q_the_mending`'s Conflux stage (hidden: header)
      {
        itemId: 'item_caelums_anchor_token',
        hidden: true,
        when: { any: [{ quest: { id: 'q_the_apprentices_errand', status: 'completed' } }, { quest: { id: 'q_the_mending', status: 'active' } }] },
      },
      { itemId: 'item_silverwood_honeycake' },
    ],
    npcs: ['npc_caelum'],
    events: [
      // "grants `echo_litany_verse_2` if not held": a granted Echo is not granted twice (effects.ts)
      {
        id: 'ev_garret_litany',
        text: "Caelum reads aloud without knowing it: 'What is read is owed.' He stops. 'That is not in the copy they gave us.'",
        effects: [{ grantEcho: 'echo_litany_verse_2' }],
      },
    ],
    // "candle motes"; a boy reading when he should be asleep: night
    art: { template: 'city', horizon: 0.66, silhouettes: ['cot_rows', 'bell_window', 'reading_boy'], particles: 'motes', timeOfDay: 'night' },
    // "Rest point: yes (resting here advances the Before's day)": the engine advances the Bell on a full rest (before.ts)
    rest: { kind: 'camp', text: 'You take a spare cot under the eaves. Down the row a boy is still reading.' },
    levelBand: { min: 13, max: 13 },
    map: { x: 72, y: 6 },
    temporallyUnstable: true,
    tags: ['camp', 'settlement', 'companion_anchor'],
  },

  // ---- The Cistern Gardens — the Green Court; the Warden of Waters (WORLD §3.11; D-063) -------------------------------------
  {
    id: 'loc_cistern_gardens',
    regionId: REGION,
    name: 'The Cistern Gardens',
    description:
      "Terraced pools above the undercity's cisterns, green with lilies. Sluice-wheels at each pool. The Warden of Waters walks the terraces on Second Bell with a key on a chain, checking each wheel twice, and does not sleep.",
    exits: [{ dir: 'north', to: 'loc_apprentices_garret', travelWatches: 0 }],
    items: [
      // "Day 2, if `echo_rhune_choice`: Ilsabet gives it" (hidden: header)
      { itemId: 'item_cistern_key', hidden: true, when: { all: [bell(2), { echo: 'echo_rhune_choice' }] } },
      { itemId: 'item_mana_bloom', count: 2 }, // the lilies
    ],
    // "the sluice-wheels' spokes; once per loop"
    gather: { itemId: 'mat_silverwood_heartwood', perDay: 1 },
    npcs: ['npc_ilsabet_rhune', 'npc_imre_sallow'],
    events: [
      {
        id: 'ev_gardens_wheels',
        text: "The Warden of Waters checks a wheel, then checks it again. 'If it fails,' she says to you, or to the wheel, 'I will drown the fire. The city will forgive me or it will not be there to.'",
        when: bell(2),
      },
    ],
    art: { template: 'city', horizon: 0.58, silhouettes: ['terraced_pools', 'sluice_wheels', 'figure_with_key'], particles: 'pollen', timeOfDay: 'day' },
    levelBand: { min: 14, max: 14 },
    map: { x: 72, y: 8 },
    temporallyUnstable: true,
    tags: ['green_court', 'gathering'],
  },

  // ---- The Archives of Danthe — Oriel's dry vaults; the warded stair down (WORLD §3.11, §11.3) -------------------------------
  {
    id: 'loc_archives_of_danthe',
    regionId: REGION,
    name: 'The Archives of Danthe',
    description:
      "The vaults, dry. Shelves straight, tomes bound, a brass rail along every aisle. At a desk by the stair down, a woman with Ilyra's hands writes the Litany of the Conflux in fair copy, because someone should, in case.",
    exits: [
      { dir: 'north', to: 'loc_outer_walks', travelWatches: 0 },
      { dir: 'south', to: 'loc_conflux_chamber', when: CONFLUX_STAIR, travelWatches: 0, lockedText: 'The stair is warded until Last Bell.' },
    ],
    items: [
      // "Oriel gives it: {any:[{echo:"echo_oriel_lineage"},{rep:{faction:"remnants",min:20}}]}" — the Echo is this room's own
      // arrival event's, after the items spawn (hidden: header)
      { itemId: 'item_litany_page_3', hidden: true, when: { any: [{ echo: 'echo_oriel_lineage' }, { rep: { faction: 'remnants', min: 20 } }] } },
      { itemId: 'item_oriels_quill', hidden: true, when: bell(3) }, // "Day 3, left on the desk"
    ],
    encounters: [
      // "Day 2: cr_warding_pillar ×1 (the Circle seals the Archives; 100% if entering without `item_ward_seal`)": a story gate
      {
        id: 'enc_danthe_pillar',
        groups: [{ creatureId: 'cr_warding_pillar' }],
        when: { all: [bell(2), { not: SEAL }] },
        fleeable: false,
        onFlee: 'hold',
        intro: 'A standing stone has been set at the head of the stair. Its sigils wake.',
      },
    ],
    npcs: ['npc_oriel_danthe'],
    events: [
      {
        id: 'ev_archives_oriel',
        text: "She looks up. 'You have my hands,' she says. 'No. Someone with my hands sent you.' She goes back to writing, faster.",
        effects: [{ grantEcho: 'echo_oriel_lineage' }],
      },
    ],
    art: { template: 'archive', horizon: 0.64, silhouettes: ['straight_shelves', 'brass_rails', 'desk_with_lamp', 'stair_down'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 14, max: 15 },
    map: { x: 64, y: 8 },
    temporallyUnstable: true,
    tags: ['archive', 'story_gate'],
  },

  // ---- The Conflux Chamber — the whole Heartstone; the cradle's rim; the Unbroken Warden (WORLD §3.11, §10.5; D-067.4/10) ----
  {
    id: 'loc_conflux_chamber',
    regionId: REGION,
    name: 'The Conflux Chamber',
    description:
      "The chamber of raw, pulsing magic, before it was a wound. Nine plinths around a well of light, and in the well the Heartstone, whole, held in Hallow's iron cradle: iron that does not wish. The cradle's rim is where a hand could set something down. A field-forge by the stair. On Last Bell the Circle stands at the plinths and the warder's masterwork stands at the stair, and it does not let anyone through who is not Nine.",
    exits: [
      { dir: 'north', to: 'loc_archives_of_danthe', travelWatches: 0 },
      // WORLD §11.3 `gate_tyrant_tear_back`: the way back, only for one who came through the tear
      { dir: 'portal', to: 'loc_temporal_breach_apex', when: { flag: 'flag_entered_before_via_apex' }, travelWatches: 0, hidden: true, label: 'through the tear' },
    ],
    // The cradle's rim is the engine's Anchor slot (before.ts: an `anchorable` item dropped here); placing one sets
    // `flag_conflux_anchored`, the Cradle-Pin also `flag_cradle_pin_anchored`. The rest (hidden: header):
    items: [
      { itemId: 'item_ward_seal', hidden: true, when: TOBRIN_GIVES },
      // Second Bell from Tobrin; on Last Bell "on Tobrin's plinth after the Warden fight or the kneeling"
      {
        itemId: 'item_breach_anchor_schematic_b',
        hidden: true,
        when: { any: [TOBRIN_GIVES, { all: [bell(3), { any: [{ killed: { id: 'cr_unbroken_warden' } }, THE_KNEELING] }] }] },
      },
      { itemId: 'item_chronal_dust', count: 3 },
    ],
    // "the cradle's shims, once per loop"
    gather: { itemId: 'mat_silverwood_heartwood', perDay: 2 },
    encounters: [
      // "forced boss (Day 3): cr_unbroken_warden ×1 (adds cr_warding_pillar)" — the adds are its Phase 1's (creatures.ts);
      // "Pacifist bypass: `item_ward_seal` + Caelum active — the Warden recognizes the seal and kneels"
      {
        id: 'enc_conflux_warden',
        groups: [{ creatureId: 'cr_unbroken_warden' }],
        when: bell(3),
        optionalWhen: THE_KNEELING,
        fleeable: false,
        onFlee: 'hold',
        intro: "At the foot of the stair the warder's masterwork turns its head. You are not Nine.",
      },
      // "Days 1–2: cr_warding_pillar ×2 (100%) unless `item_ward_seal`, and only when entering by the Archives stair — arrival
      // through the Apex tear wakes no pillars (W8)": no atom reads the way in; the tear's own door flag stands for it
      {
        id: 'enc_conflux_pillars',
        groups: [{ creatureId: 'cr_warding_pillar', count: 2 }],
        when: { all: [bell(1, 2), { not: SEAL }, { not: { flag: 'flag_entered_before_via_apex' } }] },
        fleeable: false,
        onFlee: 'hold',
        intro: 'Two pillars flank the foot of the stair. Their sigils climb as you come down.',
      },
    ],
    // Hallow at his field-forge, Days 1–2; on Last Bell the Nine at the plinths are not placements (see the header)
    npcs: ['npc_durn_hallow'],
    events: [
      // arriving here through the tear is arriving in the Before (see the header)
      {
        id: 'ev_conflux_well',
        text: 'The Heartstone is whole. It sits in Hallow\'s iron and beats slowly, like something asleep, and nine people are about to reach into it.',
        effects: [{ setFlag: 'flag_visited_before' }],
      },
    ],
    // "rising light streams (Day 3: strobe to white)": motes, then static
    art: {
      template: 'cavern',
      horizon: 0.5,
      silhouettes: ['nine_plinths', 'altar', 'well_of_light', 'towering_warder'],
      particles: 'motes',
      timeOfDay: 'timeless',
      variants: [{ when: bell(3), patch: { particles: 'static' } }],
    },
    // the Anchor slot (PLAN §5.3's station kind); the engine finds the rim by this location's id
    craftingStation: 'anchor',
    levelBand: { min: 16, max: 17 },
    map: { x: 64, y: 10 },
    temporallyUnstable: true,
    tags: ['boss', 'regional_boss', 'conflux', 'anchor_slot', 'tyrant_tear'],
  },
] satisfies LocationInput[];
