// Glowlands & Nexus — the three locations (WORLD §3.5 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates WORLD
// §11.3; state texts WORLD §12.1; legacy text legacy/aethelgard_data.py LOCATION_DEFS, verbatim, with WORLD's `+`
// sentence appended; the Apex lock line and Horde text legacy/echoes_of_aethelgard.py). Encounter notation as U42
// (silverwood_ruins/index.ts): `first: X (100%)` a plain group; `return: X (p%)` = `chance: p, respawn: 'on_return'`;
// the pool is the region's (region.ts). Bosses hold (R10-1).
//
// The Apex road ends here: Plateau → Glowlands → Nexus → Apex (WORLD §3.13). Its two portal edges (WORLD §11.2 kind
// `portal`) are exits, as the engine reads them (before.ts: an arrival from outside Silverwood Before is the way in):
// the Breach-door east of the Nexus and the tear at the Apex, both 0 watches, hidden until their gates hold (the
// Before is unknown in Loop 1). The Apex's "beyond ⟂ ending F" is not a map edge (WORLD §11.2, `gate_unbound_exit`):
// it is the Unveiled Tyrant's communion outcome (creatures.ts). Exits to other regions name their WORLD ids and stay
// pending until those units land (D-090).
//
// D-098 (U34d) made expressible what the U45 reply listed: WORLD §12.1 `ws_infected`'s "The air here is coming apart at the
// seams." is the engine's, added to any infected node's text but the Apex's (whose own Horde text is the legacy one, read
// off `flag_horde_active`); the 50 % Glow Gland is an item `chance`; the Frayed Moments after the fall appear on the
// first entry after it; the orrery's "with the key, item_chronal_dust ×2" is an `onlyIf` effect.
import type { HazardInput, LocationInput } from '@schema/location';

/** The legacy text, legacy/aethelgard_data.py, and WORLD's appended sentence. */
const APEX_BASE =
  'Reality tears here in violent seams. Impossible angles fold into one another, and the air hums with distant, unsettling screams.';
/** WORLD §3.5 "Horde state (legacy, verbatim)": echoes_of_aethelgard.py `display_location`, the Apex while `horde_active`. */
const APEX_HORDE = 'The Apex is collapsing into violent rifts. The air screams with tearing time, and every breath tastes of ash and panic. You must get out now.';
/** The legacy encounter line, `f"You sense danger... {threat_name} approaches!"` with the Tyrant's name (STORY §13 keeps it). */
const TYRANT_APPROACHES = 'You sense danger... The Chronos Tyrant approaches!';


// U34e (D-094): the Glowlands sinkholes (WORLD §2.5): Slow for 1 turn on an ambush. The Nexus's temporal shear stays
// unmodelled (10 % a watch to lose or gain one: net zero, a visible stutter).
const SINKHOLES: Omit<HazardInput, 'id'> = { on: 'ambush', status: { id: 'status_slow', duration: 1, to: 'party' } };

export const locations = [
  // ---- Veridian Glowlands — the swamp that glows; Dask cannot stay (WORLD §3.5; D-068.2) -----------------------------------
  {
    id: 'loc_veridian_glowlands',
    regionId: 'region_glowlands_nexus',
    name: 'Veridian Glowlands',
    legacyName: 'Veridian Glowlands',
    description:
      'A swampy basin packed with bioluminescent flora. The soil glows green, and humid air clings as amphibious shapes slip through the reeds. A causeway of lashed reeds runs south into deeper water, lit by lanterns no one is tending.',
    exits: [
      { dir: 'west', to: 'loc_sky_whisper_plateau' },
      { dir: 'east', to: 'loc_chronos_nexus' },
      { dir: 'north', to: 'loc_reedmarch_descent' },
      { dir: 'south', to: 'loc_lantern_causeway' },
    ],
    items: [
      { itemId: 'item_glow_moss' }, // legacy
      // WORLD: ×1 (50 %). D-098 (U34d): its own `chance`, once a loop (was hidden at 100 %, D-091 gap 1).
      { itemId: 'mat_glow_gland', chance: 0.5 },
    ],
    encounters: [
      // legacy: the Glowfen Mireling (100 %, first visit); `scatter` (WORLD §10.5: never a story gate)
      { id: 'enc_glowlands_mireling', groups: [{ creatureId: 'cr_glowfen_mireling' }], intro: 'Something man-high rises out of the reeds, glowing from the throat down.' },
      // return: a Lantern Toad and a Spore Drift together, 30 %; else the region pool at 20 %
      {
        id: 'enc_glowlands_toad_spore',
        groups: [{ creatureId: 'cr_lantern_toad' }, { creatureId: 'cr_spore_drift' }],
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'A lantern bobs low over the water where no one holds one. Beside it the air turns sweet.',
      },
    ],
    // npc_mireya gathers here as flavor; her home and record are Lanternreed's (npcs.ts).
    events: [
      { id: 'ev_glowlands_pulse', text: 'The glow brightens in waves, like the basin is breathing.' },
      {
        id: 'ev_glowlands_leak',
        text: "The light under the water is the same colour as the Apex's seams. You had not noticed before.",
        when: { loop: { min: 2 } },
      },
    ],
    // WORLD's particles are "green glow pulses rising from the ground"; spores is the nearest preset.
    art: { template: 'swamp', horizon: 0.6, silhouettes: ['reed_clumps', 'bent_lantern_trees', 'causeway_line'], particles: 'spores', timeOfDay: 'dusk' },
    levelBand: { min: 9, max: 10 },
    hazards: [{ id: 'glowlands_sinkholes', ...SINKHOLES }], // U34e (D-094)
    map: { x: 32, y: 10 },
    tags: ['legacy'],
  },

  // ---- The Chronos Nexus — the observatory; the Breach-door; the camp before the Apex (WORLD §3.5, §11.3) -----------------
  {
    id: 'loc_chronos_nexus',
    regionId: 'region_glowlands_nexus',
    name: 'The Chronos Nexus',
    legacyName: 'The Chronos Nexus',
    description:
      'A ruined observatory sits beneath a shattered dome. Time buckles here, and echoes of past and future flicker across cracked stone. Set into the east wall is a door with no handle, and the stone around it is new.',
    exits: [
      { dir: 'west', to: 'loc_veridian_glowlands' },
      // WORLD §11.3 `gate_apex` (D-048's data form, one form for all loops; = config.apexGate) with the legacy refusal
      // line (echoes_of_aethelgard.py `move_player`, Nexus → Apex while `count_completed_quests() < 6`)
      {
        dir: 'north',
        to: 'loc_temporal_breach_apex',
        when: { any: [{ counter: { name: 'quests_completed', min: 6 } }, { echo: 'echo_apex_resonance' }] },
        lockedText: "I can't help but feeling I need to go back and see what else needs done first.",
      },
      // WORLD §11.3 `gate_breach_door` (D-016): the door with no handle, into Silverwood Before; the engine sets
      // `flag_entered_before_via_nexus` on the way in and charges the dawn on the way back (before.ts, D-067.5)
      {
        dir: 'east',
        to: 'loc_silver_gate',
        // U62b (STORY §12 `echo_breach_door`: "Route to Silverwood Before"): once the door has opened for you, you know it
        // without the glass
        when: { any: [{ all: [{ loop: { min: 2 } }, { item: { id: 'item_chronos_lens' } }, { echo: 'echo_litany_verse_1' }] }, { all: [{ loop: { min: 2 } }, { echo: 'echo_breach_door' }] }] },
        travelWatches: 0,
        hidden: true,
        label: 'the Breach-door',
      },
    ],
    items: [
      { itemId: 'item_chronos_lens' }, // legacy
      // Loop 2+, 100 % on the first visit, in the orrery's base (Hadrek's duplicate in the Before is the other copy)
      { itemId: 'item_orrery_key', when: { loop: { min: 2 } } },
    ],
    encounters: [
      // legacy: the Temporal Aberration (100 %, first visit); the elite one step from the finale (WORLD §10.4); `scatter`.
      // It is the Aberrant Eye's only source (`q_unlidded_eye`), but every road to the Apex runs through the Nexus, so it keeps
      // `scatter` (U81c's Apex-road exemption to D-143, the contentRules test): fled, the Eye waits for the next loop.
      { id: 'enc_nexus_aberration', groups: [{ creatureId: 'cr_temporal_aberration' }], intro: 'By the orrery something flickers between where it stood and where it will stand.' },
      // Loop 4+ (WORLD §12.1 `ws_loop_4`): the Hour Leech, 15 % — first among the return rolls so its 15 % is WORLD's
      {
        id: 'enc_nexus_hour_leech',
        groups: [{ creatureId: 'cr_hour_leech' }],
        chance: 0.15,
        when: { loop: { min: 4 } },
        once: false,
        respawn: 'on_return',
        intro: 'Something grey and ringed like a clock-face lies fastened to the floor where the hours pool.',
      },
      // return: Hourglass Crawlers ×2 (35 %), or the Orrery Knight (20 %, only while the key is untaken), or the pool
      {
        id: 'enc_nexus_crawlers',
        groups: [{ creatureId: 'cr_hourglass_crawler', count: 2 }],
        chance: 0.35,
        once: false,
        respawn: 'on_return',
        intro: 'Sand runs uphill across the floor, toward two small bodies of glass.',
      },
      {
        id: 'enc_nexus_orrery_knight',
        groups: [{ creatureId: 'cr_orrery_knight' }],
        chance: 0.2,
        when: { not: { item: { id: 'item_orrery_key' } } },
        once: false,
        respawn: 'on_return',
        intro: "The brass knight at the orrery's foot turns the rings in its chest toward you.",
      },
      // the pool's crawler, at the Nexus only (region.ts): 25 % of the pool's 20 % return rolls = 5 % per return visit
      {
        id: 'enc_nexus_pool_crawler',
        groups: [{ creatureId: 'cr_hourglass_crawler' }],
        chance: 0.05,
        once: false,
        respawn: 'on_return',
        intro: 'One small body of glass crawls out from under the orrery, its sand running the wrong way.',
      },
    ],
    // npc_dask can remain here (`temporallyUnstable`, D-059): the engine's rule, not a placement (npcs.ts).
    // The Horde-echo and hold-failing waves of Horde Husks (q_day_of_teeth, q_weavers_dawn) are their quests' fights.
    events: [
      { id: 'ev_nexus_echo', text: 'A future voice overlaps your own, warning of a choice already made.' },
      {
        id: 'ev_nexus_door',
        text: 'The door with no handle warms when the Lens is near it. Through the stone you hear bells.',
        when: { item: { id: 'item_chronos_lens' } },
      },
      // U62b (STORY §12 `echo_breach_door`: "Nexus with Lens + verse 1"): the door opens, and is remembered
      {
        id: 'ev_nexus_breach_door',
        text: 'The first verse is in your mouth before you mean it. The door with no handle hears it, and the stone around it gives like a held breath let go. You will know this door again, Lens or no Lens.',
        when: { all: [{ loop: { min: 2 } }, { item: { id: 'item_chronos_lens' } }, { echo: 'echo_litany_verse_1' }, { not: { echo: 'echo_breach_door' } }] },
        effects: [{ grantEcho: 'echo_breach_door' }],
      },
      { id: 'ev_nexus_moor', text: 'A brass plate on the orrery reads: H. MOOR, CLOCKWRIGHT TO THE CIRCLE. It has been polished recently.' },
      // once per loop, with the Lens or the key; STORY §12 "discovery at the Nexus with Lens". WORLD's second grant,
      // `item_chronal_dust` ×2 "with the key", is D-098's (U34d) per-effect condition (see the header).
      {
        id: 'ev_nexus_orrery',
        text: 'Through the Lens the housing goes clear: on a cradle of hair-springs lies an eyepiece of black glass, and through it the Apex is on the far side of something. The key turns.',
        when: { any: [{ item: { id: 'item_chronos_lens' } }, { item: { id: 'item_orrery_key' } }] },
        effects: [
          { grantEcho: 'echo_eye_of_masque' },
          { onlyIf: { when: { item: { id: 'item_orrery_key' } }, effects: [{ giveItem: { item: 'item_chronal_dust', count: 2 } }] } },
        ],
      },
    ],
    // WORLD's particles are "slow clock-tick flashes (afterimages of the scene offset in time)"; static is the nearest
    // preset. "The time-of-day indicator flickers between watches" (WORLD §2.5): timeless.
    art: { template: 'observatory', horizon: 0.55, silhouettes: ['broken_dome_ribs', 'orrery_rings', 'handleless_door'], particles: 'static', timeOfDay: 'timeless' },
    // WORLD §2.5 / DESIGN §18.2: the Nexus replaces the swamp's pulses with ticking
    ambient: 'ambient_chronos_nexus',
    // "the astronomers' cell, where time is honest"
    rest: { kind: 'camp', text: "You rest in the astronomers' cell, where time is honest." },
    levelBand: { min: 11, max: 13 },
    map: { x: 40, y: 10 },
    temporallyUnstable: true,
    tags: ['legacy', 'camp', 'breach_door'],
  },

  // ---- The Temporal Breach Apex — both Tyrants; the Horde's source (WORLD §3.5, §6.8, §10.5, §12.1; D-048, D-051, D-060) --
  {
    id: 'loc_temporal_breach_apex',
    regionId: 'region_glowlands_nexus',
    name: 'The Temporal Breach Apex',
    legacyName: 'The Temporal Breach Apex',
    description: `${APEX_BASE} At the center, something holds very still, the way a hand holds a wound closed.`,
    // the Apex is the Horde's source, infected the moment the Horde starts: the legacy Horde text replaces the description
    descriptionVariants: [{ when: { flag: 'flag_horde_active' }, text: APEX_HORDE }],
    exits: [
      { dir: 'south', to: 'loc_chronos_nexus' },
      // WORLD §11.3 `gate_tyrant_tear`: "the Tyrant opens a way through itself" once spared (the engine sets
      // `flag_tyrant_spared` and, on the way through, `flag_entered_before_via_apex`)
      {
        dir: 'portal',
        to: 'loc_conflux_chamber',
        when: { all: [{ loop: { min: 2 } }, { flag: 'flag_tyrant_spared' }] },
        travelWatches: 0,
        hidden: true,
        label: 'through the tear',
      },
    ],
    // WORLD: none fixed; after either Tyrant falls, three Frayed Moments lie here. D-098 (U34d): an entry waits for its
    // condition, and the Wayfinder is standing here when it comes true (the fight is here, and the Horde makes a return
    // costly), so they lie `hidden` for the examine after the fall (the Peaks' and the Pass's form; was D-091 gap 2).
    items: [{ itemId: 'mat_frayed_moment', count: 3, hidden: true, when: { flag: 'flag_tyrant_dead' } }],
    encounters: [
      // Loop 1 (D-051): the Contained Tyrant, present until defeated this loop (legacy rule). The engine opens the
      // Face it / Not yet prompt after the enter events (D-067.1, reducers/explore.ts) and starts this fight on Face it.
      {
        id: 'enc_apex_contained',
        groups: [{ creatureId: 'cr_chronos_tyrant_contained' }],
        when: { loop: { max: 1 } },
        fleeable: false,
        onFlee: 'hold',
        intro: TYRANT_APPROACHES,
      },
      // Loop 2+ (D-051): the Unveiled Tyrant. It speaks first and never strikes first (its Phase 1 pattern speaks until
      // it is hurt; communion opens on the first turn with Listen or `echo_tyrant_speaks`, U29). U58: STORY §13's
      // `scene_tyrant_first_words` (Fight / Listen / Leave) opens on arrival (`ev_apex_first_words` below) and starts this
      // fight on Fight or Listen (an arrival scene skips the fixed fight, D-122); it opens here by itself only when no scene
      // is due (the Horde up; the tear's return).
      {
        id: 'enc_apex_unveiled',
        groups: [{ creatureId: 'cr_chronos_tyrant_unveiled' }],
        when: { loop: { min: 2 } },
        fleeable: false,
        onFlee: 'hold',
        intro: TYRANT_APPROACHES,
      },
    ],
    // npc_brak arrives when the Tyrant falls and npc_dask can remain: the engine's (horde.ts, D-059), not placements.
    events: [
      // legacy; PLAN Appendix A.5 `apex_first_entry` → `echo_apex_resonance` ("Stand at the Apex once", STORY §12)
      { id: 'ev_apex_rend', text: 'The breach flashes, and the world stutters as if deciding what to become.', effects: [{ grantEcho: 'echo_apex_resonance' }] },
      { id: 'ev_apex_watched', text: 'Something at the center turns toward you. It has done this seven times before.', when: { loop: { min: 2 } } },
      {
        id: 'ev_apex_names',
        text: 'In the mass, for an instant, a face you know from a painting in a hall that no longer exists.',
        when: { flag: 'flag_visited_before' },
      },
      // U58 (STORY §5.4, §8.2, §13 `scene_tyrant_first_words`): from Loop 2, while it stands unresolved, it speaks before anything
      // is struck — every arrival (Leave lets you go, and it is still there when you come back). Not for the Weaver's Dawn, which
      // has its own arrival (below).
      {
        id: 'ev_apex_first_words',
        text: 'It does not strike. You notice that it is not striking, the way you notice a held breath.',
        once: false,
        when: {
          all: [
            { loop: { min: 2 } },
            { not: { flag: 'flag_tyrant_spared' } },
            { not: { flag: 'flag_tyrant_dead' } },
            { not: { flag: 'flag_horde_active' } },
            { not: { quest: { id: 'q_weavers_dawn', stage: 'apex' } } },
          ],
        },
        effects: [{ startDialogue: 'scene_tyrant_first_words' }],
      },
      // U58 (STORY §10.3, §11.6 C, §13 `scene_ending_dawn`): the Weaver's Dawn's arrival, the Core in hand and Nyx beside you
      {
        id: 'ev_apex_dawn',
        text: 'Nyx walks past you to the edge of the mass, and does not stop walking until she is under it.',
        once: false,
        when: { all: [{ quest: { id: 'q_weavers_dawn', stage: 'apex' } }, { not: { flag: 'flag_tyrant_dead' } }, { not: { flag: 'flag_horde_active' } }] },
        effects: [{ startDialogue: 'scene_ending_dawn' }],
      },
    ],
    // WORLD: horizon none (abstract; "at the Apex there is no sky"): the breach template draws none, so the schema
    // default stands. Particles: "seams of white that stutter open and shut".
    art: { template: 'breach', silhouettes: ['folded_planes', 'tyrant_cleft', 'stair_fragments'], particles: 'shards', timeOfDay: 'timeless' },
    // WORLD §2.5 / DESIGN §18.2: "a chorus of detuned saw drones with a 7 s stutter gate"
    ambient: 'ambient_temporal_breach_apex',
    // Rest: no ("The Apex cannot be rested in"). No wandering pool here: WORLD's Encounters line names none.
    safe: true,
    levelBand: { min: 15, max: 18 },
    map: { x: 40, y: 8 },
    temporallyUnstable: true,
    // `apex`: the Tyrants' level is not a regional boss's band top + 2 (validator rule 11)
    tags: ['legacy', 'apex', 'horde_source'],
  },
] satisfies LocationInput[];
