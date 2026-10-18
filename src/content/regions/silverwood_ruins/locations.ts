// Silverwood Ruins — the seven locations (WORLD §3.1 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates WORLD
// §11.3; state texts WORLD §12.1; legacy text legacy/aethelgard_data.py LOCATION_DEFS, verbatim, with WORLD's `+`
// sentence appended). Encounter notation from WORLD §3: a `first:` group rolls on the loop's first visit (a 100 % group
// stays until cleared or scattered; a group under 100 % rolls once, DESIGN §4.7); `return:` groups use
// `respawn: 'on_return'`; the wandering pool is the region's (region.ts), rolled by the engine on return visits.
//
// Location items (D-098, U34d): an entry appears at most once a loop, at the first entry (or, `hidden`, the first examine)
// at which its `when` holds, after its `chance`; WORLD's "N %" items carry that chance.
//
// Ids: legacy event ids take the `ev_` prefix the schema requires (`ruins_echo` → `ev_ruins_echo`, as PLAN §5.17);
// encounter ids are `enc_<place>_<group>`. Exits to other regions name their WORLD ids; they are pending until those
// units land (D-090). The Library's Threshold portal is not an exit: the engine's `enterPortal` action is the portal
// (U30), and the Threshold is areas, not walked nodes.
import type { LocationInput } from '@schema/location';

/** WORLD §12.1 `ws_portal_ilyra` / `ws_portal_alone`: the Library's legacy Horde texts. */
const LIBRARY_BASE =
  'Collapsed shelves form jagged ridges of splintered wood and stone. Dust motes swirl in a dim glow, and you can almost hear pages turning on their own.';
const LIBRARY_PORTAL_ILYRA =
  'The Shattered Library. The air here crackles with raw magic, and at its heart, a shimmering, unstable portal tears at the air. Ilyra stands before it, her hands glowing with an intense, straining light, her face etched with fierce concentration as she pours her energy into keeping the portal open. The whispers of the horde grow closer, echoing through the crumbling shelves.';
const LIBRARY_PORTAL_ALONE =
  'A swirling, unstable portal now pulses between the shelves, casting long shadows across the fractured stacks.';
const LIBRARY_SCAR = 'Between two fallen stacks the air is thin and cold, a seam the eye slides off. You came through here once.';

const DEPTHS_BASE =
  'The ground opens into a chamber of raw, pulsing magic. A massive Heartstone sits at the center, each beat sending ripples through the air.';
const DEPTHS_PLINTHS = 'Nine plinths stand around it, eight of them empty.';

export const locations = [
  // ---- Whispering Ruins — the start of every loop (WORLD §3.1; STORY §4.1 beat 1) ----------------------------------------
  {
    id: 'loc_whispering_ruins',
    regionId: 'region_silverwood_ruins',
    name: 'Whispering Ruins',
    legacyName: 'Whispering Ruins',
    description:
      'The air smells of ozone and decay, and a chill wind carries faint whispers. Twisted trees reach into a twilight sky, their branches dotted with glowing crystals. Broken stone tablets litter the ground, etched with worn sigils. A cold fire burns in a ring of tablets where a woman in faded robes keeps watch.',
    exits: [
      { dir: 'north', to: 'loc_crumbling_archway' },
      { dir: 'east', to: 'loc_mistwood_path' },
      { dir: 'south', to: 'loc_sunken_archives' },
    ],
    // Day 1 of Loop 1 only: from Loop 2 the Amulet is already on the neck (config.startItems, D-047).
    items: [{ itemId: 'item_amulet_of_echoes', when: { loop: { max: 1 } } }],
    encounters: [
      // WORLD §3.1 `ev_redundant_stand` (Loop 4+): replaces the pool roll at 10 %. WORLD adds "if the player died here in
      // an earlier loop" (profile lastDeathLocation): no Condition atom reads the profile's death place, so that clause is
      // not expressed (listed in the U42 reply).
      {
        id: 'enc_ruins_redundant_stand',
        groups: [{ creatureId: 'cr_redundant_wayfinder' }],
        chance: 0.1,
        when: { loop: { min: 4 } },
        respawn: 'on_return',
        intro: 'Someone is standing where you fell. They are wearing what you wore.',
      },
    ],
    npcs: ['npc_ilyra'],
    events: [
      { id: 'ev_ruins_echo', text: 'A low, resonant hum vibrates under your skin, as if the stones are breathing.' },
      { id: 'ev_ruins_return', text: 'You know this smell. You have stood here before, and the stones know it too.', when: { loop: { min: 2 } } },
      // "fires on Day 29 at dusk" = the last dusk before the limit (WORLD §12.1 `ws_forecast`), read against the clock so
      // Heartstone modifiers move it; it fires when the Wayfinder stands here at that watch.
      {
        id: 'ev_ruins_thirtieth',
        text: 'The crystals in the trees go dark one by one. Somewhere east, something lets go.',
        when: { all: [{ watch: 'dusk' }, { clock: { daysLeft: { max: 0 } } }] },
      },
    ],
    art: { template: 'ruins', horizon: 0.62, silhouettes: ['crystal_tree', 'tablet_row', 'half_arch'], particles: 'motes', timeOfDay: 'dusk' },
    rest: { kind: 'camp', text: 'You make camp beneath the twisted trees. The whispers keep you company.' },
    levelBand: { min: 1, max: 2 },
    map: { x: 0, y: 6 },
    tags: ['legacy', 'start', 'remnants', 'camp'],
  },

  // ---- Crumbling Archway (WORLD §3.1) -----------------------------------------------------------------------------------------
  {
    id: 'loc_crumbling_archway',
    regionId: 'region_silverwood_ruins',
    name: 'Crumbling Archway',
    legacyName: 'Crumbling Archway',
    description:
      'A monumental arch of cracked marble towers over you. The stone is warm, as if it remembers a brighter age. Vines twitch with borrowed life. The keystone bears nine small carved faces, eight of them worn smooth.',
    exits: [
      { dir: 'south', to: 'loc_whispering_ruins' },
      { dir: 'north', to: 'loc_darkened_corridor' },
    ],
    // WORLD: Loop 2+, 30 % on first visit, under the ninth face, with echo_nine_voices. D-098 (U34d): the item's own
    // `chance`, rolled once a loop at the first entry where the condition holds (was hidden at 100 %, D-091 gap 1).
    items: [{ itemId: 'item_remnant_wax_seal', chance: 0.3, when: { all: [{ loop: { min: 2 } }, { echo: 'echo_nine_voices' }] } }],
    encounters: [
      { id: 'enc_archway_prowler', groups: [{ creatureId: 'cr_mistwood_prowler' }], chance: 0.4, intro: 'The fog under the arch has eyes in it.' },
    ],
    events: [
      { id: 'ev_archway_whisper', text: "A whisper slips through the archway: 'Wayfinder... follow.'" },
      {
        id: 'ev_archway_faces',
        text: 'You count the faces on the keystone. Nine. The ninth is unworn, as if cut yesterday.',
        when: { echo: 'echo_nine_voices' },
      },
    ],
    art: { template: 'ruins', horizon: 0.55, silhouettes: ['great_arch', 'vine_curtain', 'fallen_capital'], particles: 'pollen', timeOfDay: 'dusk' },
    levelBand: { min: 1, max: 2 },
    map: { x: 0, y: 4 },
    tags: ['legacy'],
  },

  // ---- Darkened Corridor — the first fight; the Horde's set piece (WORLD §3.1, §10.5, §12.2) -------------------------------
  {
    id: 'loc_darkened_corridor',
    regionId: 'region_silverwood_ruins',
    name: 'Darkened Corridor',
    legacyName: 'Darkened Corridor',
    description:
      'The corridor is slick with moisture, and faint fungi cling to the ceiling. Every footstep sends ripples of pale light across the stones. A growl echoes ahead. Scorch marks climb one wall in the shape of a hand.',
    exits: [
      { dir: 'south', to: 'loc_crumbling_archway' },
      { dir: 'north', to: 'loc_shattered_library' },
    ],
    // Horde state: a fleeing scribe's tonic (WORLD §3.1). D-098 (U34d): an item appears on the first entry at which its
    // condition holds, so it lies here on any entry during a Horde, once a loop (was: only if the first entry was one).
    items: [{ itemId: 'item_ley_touched_tonic', when: { flag: 'flag_horde_active' } }],
    encounters: [
      // Horde (WORLD §12.2 `tide: { at: loc_darkened_corridor, afterMoves: 14 }`): the Tide blocks the way after move 14.
      // The engine counts the moves since the Horde began in `horde_moves` (HORDE_MOVES_COUNTER, D-091). Horde fights
      // hold (R10-1).
      {
        id: 'enc_corridor_tide',
        groups: [{ creatureId: 'cr_unraveling_tide' }],
        when: { all: [{ flag: 'flag_horde_active' }, { counter: { name: 'horde_moves', min: 15 } }] },
        once: false,
        fleeable: false,
        onFlee: 'hold',
        intro: 'The corridor is full of water that is not water. It is moving the wrong way.',
      },
      {
        id: 'enc_corridor_husks',
        groups: [{ creatureId: 'cr_horde_husk', count: 2 }],
        when: { flag: 'flag_horde_active' },
        fleeable: false,
        onFlee: 'hold',
        intro: 'Two shapes come apart and together in the doorway ahead.',
      },
      // legacy: the Corrupted Shade (100 %, first visit; drops a Dark Spellbook, D-055)
      { id: 'enc_corridor_shade', groups: [{ creatureId: 'cr_corrupted_shade' }], intro: 'The growl ahead was never a growl. Something steps out of the wall.' },
    ],
    events: [
      { id: 'ev_corridor_hand', text: 'The scorch-hand on the wall is at the height of your own. You do not put yours in it.' },
      { id: 'ev_corridor_growl', text: 'The growl ahead stops when you stop. It starts when you start.' },
    ],
    // WORLD's particles are "pale ripple rings at the floor"; the nearest preset is motes (the ring effect is the UI unit's).
    art: { template: 'cavern', horizon: 0.7, silhouettes: ['converging_walls', 'fungal_ceiling', 'far_doorway'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 2, max: 3 },
    map: { x: 0, y: 2 },
    tags: ['legacy', 'horde_tide'],
  },

  // ---- Shattered Library — the Crystal, Dray's camp, the portal (WORLD §3.1, §12.1; STORY §4.1 beats 3, 15) -------------
  {
    id: 'loc_shattered_library',
    regionId: 'region_silverwood_ruins',
    name: 'Shattered Library',
    legacyName: 'Shattered Library',
    description: `${LIBRARY_BASE} In an alcove behind the fallen stacks, something small and bright waits in a cradle of stone.`,
    // First match wins: the two legacy portal states (WORLD §12.1 ws_portal_ilyra / ws_portal_alone), then the scar.
    descriptionVariants: [
      { when: { all: [{ flag: 'flag_library_portal_open' }, { not: { companion: { id: 'ilyra', state: 'active' } } }] }, text: LIBRARY_PORTAL_ILYRA },
      { when: { all: [{ flag: 'flag_library_portal_open' }, { companion: { id: 'ilyra', state: 'active' } }] }, text: `${LIBRARY_BASE} ${LIBRARY_PORTAL_ALONE}` },
      { when: { all: [{ loop: { min: 2 } }, { not: { flag: 'flag_horde_active' } }] }, text: `${LIBRARY_BASE} ${LIBRARY_SCAR}` },
    ],
    exits: [
      { dir: 'south', to: 'loc_darkened_corridor' },
      { dir: 'east', to: 'loc_silverwood_plaza' },
    ],
    items: [
      // the alcove: `hidden` is the search sub-step (examine); echo_crystal_location skips it (D-010). D-098 (U34d): an
      // entry now waits for its condition, so the skipped search would add a second Crystal once the Echo is earned in
      // this very loop (by taking the first): it needs the Crystal not carried and its quest not done
      { itemId: 'item_echo_crystal', hidden: true, when: { not: { echo: 'echo_crystal_location' } } },
      {
        itemId: 'item_echo_crystal',
        when: {
          all: [
            { echo: 'echo_crystal_location' },
            { not: { item: { id: 'item_echo_crystal' } } },
            { not: { quest: { id: 'q_echo_crystal', status: 'completed' } } },
          ],
        },
      },
      { itemId: 'item_korrs_marginalia', when: { all: [{ loop: { min: 2 } }, { corruption: { min: 1 } }] } },
    ],
    encounters: [
      // legacy: the Arcane Wisp (100 %, first visit); none while Ilyra holds the stacks (Horde)
      {
        id: 'enc_library_wisp',
        groups: [{ creatureId: 'cr_arcane_wisp' }],
        when: { not: { flag: 'flag_horde_active' } },
        intro: 'Light knots itself between two shelves and turns toward you.',
      },
    ],
    // Ilyra (Horde) and Tamsin (Loop 2+, Plaza infected) move here at runtime: engine npcOverrides, not placement.
    npcs: ['npc_ansel_dray'],
    events: [
      { id: 'ev_library_shiver', text: 'A cold gust rattles the shelves, and you smell old ink and rain.' },
      { id: 'ev_library_pages', text: "A page turns itself on a shelf that no longer exists. You read one word before it is gone: 'Conflux.'" },
      {
        id: 'ev_library_seam',
        text: 'The seam in the air widens a hair when you look at it. It knows you.',
        when: { all: [{ loop: { min: 2 } }, { not: { flag: 'flag_horde_active' } }] },
      },
    ],
    art: {
      template: 'archive',
      horizon: 0.66,
      silhouettes: ['shelf_ridge', 'leaning_ladder', 'alcove_arch'],
      particles: 'motes',
      timeOfDay: 'timeless',
      // portal state: a vertical violet tear replaces the light shaft
      variants: [{ when: { flag: 'flag_library_portal_open' }, patch: { focal: 'library_portal', particles: 'shards' } }],
    },
    // Loop 2+ with Ilyra Trusted (loyalty ≥ 75, DESIGN §12.5): her reading-nook.
    rest: {
      kind: 'camp',
      when: { all: [{ loop: { min: 2 } }, { loyalty: { companion: 'ilyra', min: 75 } }] },
      text: 'Ilyra clears a nook between two standing shelves and sets her lamp where the dust is thinnest.',
    },
    levelBand: { min: 2, max: 3 },
    map: { x: 0, y: 0 },
    tags: ['legacy', 'portal', 'remnants'],
  },

  // ---- Silverwood Plaza — Tamsin's stall; the Horde's slow edge (WORLD §3.1, §9, §10.7) -----------------------------------
  {
    id: 'loc_silverwood_plaza',
    regionId: 'region_silverwood_ruins',
    name: 'Silverwood Plaza',
    legacyName: 'Silverwood Plaza',
    description:
      "Once the heart of Silverwood, this plaza is now a cratered ring of marble. Broken fountains seep shimmering mist, and the air tastes of copper. A Remnant scribe has set a table on the fountain's rim and weighs ink against salt.",
    exits: [
      { dir: 'west', to: 'loc_shattered_library' },
      { dir: 'south', to: 'loc_mistwood_path' },
      { dir: 'east', to: 'loc_chasm_of_whispers' },
    ],
    // WORLD: Loop 2+, 10 % per first visit. D-098 (U34d): the item's own `chance`, rolled at the loop's first entry (was
    // hidden at 100 % from Loop 2, D-091 gap 1).
    items: [{ itemId: 'item_bell_shard', chance: 0.1, when: { loop: { min: 2 } } }],
    encounters: [
      // legacy: the Arcane Wisp (100 %, first visit)
      { id: 'enc_plaza_wisp', groups: [{ creatureId: 'cr_arcane_wisp' }], intro: "A knot of light lifts off the fountain's rim." },
      // Loop 2+: 25 % of the pool's 20 % return rolls are a Paradox Wisp = 5 % per return visit, ahead of the pool roll.
      {
        id: 'enc_plaza_paradox_wisp',
        groups: [{ creatureId: 'cr_paradox_wisp' }],
        chance: 0.05,
        when: { loop: { min: 2 } },
        once: false,
        respawn: 'on_return',
        intro: 'A wisp is waiting at the fountain. It was waiting before you arrived.',
      },
    ],
    npcs: ['npc_tamsin_reed'],
    events: [
      { id: 'ev_plaza_surge', text: 'Wild magic surges. A chorus of distant bells rings out, then fades.' },
      {
        id: 'ev_plaza_bells_before',
        text: 'You have heard these bells with their roofs on. The memory is not yours yet. Then it is.',
        when: { flag: 'flag_visited_before' },
      },
    ],
    // WORLD's particles are "shimmering mist low to the ground"; motes is the nearest preset.
    art: { template: 'city', horizon: 0.58, silhouettes: ['fountain_ring', 'cratered_rim', 'standing_column'], particles: 'motes', timeOfDay: 'dusk' },
    merchantId: 'npc_tamsin_reed',
    levelBand: { min: 2, max: 4 },
    map: { x: 8, y: 0 },
    tags: ['legacy', 'merchant', 'remnants'],
  },

  // ---- Sunken Archives — Oriel's carrel; the door to the Drowned Reach (WORLD §3.1, §3.6; D-046) ---------------------------
  {
    id: 'loc_sunken_archives',
    regionId: 'region_silverwood_ruins',
    name: 'Sunken Archives',
    legacyName: 'Sunken Archives',
    description:
      'Half-buried vaults dip beneath brackish water, with shelves sagging under soaked tomes. A slow drip marks time, and the ley lines glow through the flood. A stair descends into the water to the west, its lower steps lit by something that is not the ley.',
    exits: [
      { dir: 'north', to: 'loc_whispering_ruins' },
      // WORLD §11.3 `gate_depths_descent` (legacy: the quest opens the Depths; Loop 2+: you know the way down). WORLD's
      // `stage:"accepted"` means "in the journal, accepted or later" (WORLD §3), which is the schema's `quest` with no
      // stage and no status (active or completed).
      {
        dir: 'south',
        to: 'loc_heartstone_depths',
        when: { any: [{ quest: { id: 'q_echoing_heartbeat' } }, { echo: 'echo_heartstone_path' }] },
        // the legacy refusal line (echoes_of_aethelgard.py `is_exit_locked` fallthrough)
        lockedText: 'A sealed passage blocks your way. Something deeper must call you first.',
      },
      { dir: 'west', to: 'loc_drowned_stair' },
    ],
    // Ilyra's lamp on the top step from Day 1, every loop (W7: a Loop 1 pacifist can reach Lamplighters' Rest).
    // The Scholar's Lost Scroll is the Archivist's quest drop here (creatures.ts, WORLD §6.3).
    items: [{ itemId: 'item_glyphbound_lantern' }],
    encounters: [
      // legacy rule: the Archivist stands here on every visit while q_lost_scroll is active; a story gate (R10-1: hold).
      // Loop 2+ `q_the_first_drowned` (echo_oriel_drowned): speak instead of fighting — the fight is bypassed.
      {
        id: 'enc_archives_archivist',
        groups: [{ creatureId: 'cr_drowned_archivist' }],
        when: { quest: { id: 'q_lost_scroll', status: 'active' } },
        optionalWhen: { echo: 'echo_oriel_drowned' },
        once: false,
        fleeable: false,
        onFlee: 'hold',
        intro: 'In the carrel under the east stair a sodden figure clutches a scroll and turns her back to you.',
      },
    ],
    events: [
      { id: 'ev_archives_murmur', text: 'A submerged page unfurls, whispering of the Ley Line Conflux.' },
      { id: 'ev_archives_lamp', text: 'On the top step of the drowned stair sits a lantern etched with glyphs. The water below it is black, not dark.' },
    ],
    // WORLD's particles are "slow rising bubbles with ley-green light under the waterline"; motes is the nearest preset.
    art: { template: 'archive', horizon: 0.6, silhouettes: ['submerged_shelves', 'vault_arch', 'stair_head'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 2, max: 4 },
    map: { x: 0, y: 8 },
    tags: ['legacy', 'remnants'],
  },

  // ---- Heartstone Depths — the Conflux; the choice that gates endings B, C, D, E (WORLD §3.1, §12.1; STORY §4.1 beat 9) ---
  {
    id: 'loc_heartstone_depths',
    regionId: 'region_silverwood_ruins',
    name: 'Heartstone Depths',
    legacyName: 'Heartstone Depths',
    description: `${DEPTHS_BASE} ${DEPTHS_PLINTHS}`,
    // WORLD §3.1 state texts, appended after the choice this loop (flags per WORLD §12.1).
    descriptionVariants: [
      { when: { flag: 'flag_heartstone_stabilized' }, text: `${DEPTHS_BASE} ${DEPTHS_PLINTHS} The beat is slow and even now. The plinths are warm.` },
      { when: { flag: 'flag_heartstone_exploited' }, text: `${DEPTHS_BASE} ${DEPTHS_PLINTHS} The Heartstone is a socket of dark glass. Things flicker in and out of the cavity.` },
      { when: { flag: 'flag_heartstone_destroyed' }, text: `${DEPTHS_BASE} ${DEPTHS_PLINTHS} There is no light here but your own. The stone does not beat.` },
    ],
    exits: [
      { dir: 'north', to: 'loc_sunken_archives' },
      { dir: 'east', to: 'loc_shimmering_pass' },
      // WORLD §11.3 `gate_cistern_crack_in`: a flooded crack behind the ninth plinth into the Reach's dark (W6)
      {
        dir: 'west',
        to: 'loc_cistern_of_names',
        when: {
          all: [
            { item: { id: 'item_glyphbound_lantern' } },
            { any: [{ item: { id: 'item_cistern_key' } }, { flag: 'flag_heartstone_destroyed' }, { echo: 'echo_archive_door' }] },
          ],
        },
        lockedText: 'Behind the ninth plinth the rock is cracked and the crack is full of water. Beyond it is a dark that your light does not enter.',
      },
    ],
    // Anchors (D-016, D-067.4) are placed by the engine (before.ts), not here.
    encounters: [
      // exploited state (Loop 2+ band 6–8): return visits
      { id: 'enc_depths_crawlers', groups: [{ creatureId: 'cr_hourglass_crawler', count: 2 }], chance: 0.5, when: { flag: 'flag_heartstone_exploited' }, once: false, respawn: 'on_return' },
      {
        id: 'enc_depths_unmade',
        groups: [{ creatureId: 'cr_unmade' }],
        chance: 0.25,
        when: { all: [{ flag: 'flag_heartstone_exploited' }, { loop: { min: 3 } }] },
        once: false,
        respawn: 'on_return',
      },
      // destroyed state (E12): Shades, three of them
      { id: 'enc_depths_shades', groups: [{ creatureId: 'cr_corrupted_shade', count: 3 }], chance: 0.4, when: { flag: 'flag_heartstone_destroyed' }, once: false, respawn: 'on_return' },
    ],
    events: [
      { id: 'ev_heartstone_thrum', text: 'The Heartstone answers your presence with a tremor that shakes dust from the ceiling.' },
      {
        id: 'ev_depths_plinths',
        text: 'Eight plinths, empty. The ninth holds something that should not have survived five hundred years.',
        when: { flag: 'flag_conflux_anchored' },
      },
      // the legacy choice prompt: fires on every entry while the quest is open and opens the choice scene (STORY §4.1 beat 9)
      {
        id: 'ev_depths_choice',
        text: 'The relic throbs with unstable power. You sense three paths: soothe it, seize it, or shatter it.',
        once: false,
        when: { quest: { id: 'q_echoing_heartbeat', status: 'active' } },
        effects: [{ startDialogue: 'scene_heartstone_choice' }],
      },
    ],
    art: {
      template: 'cavern',
      horizon: 0.5,
      silhouettes: ['heartstone_ovoid', 'plinth_ring', 'stalactite_fringe'],
      particles: 'motes',
      focal: 'heartstone',
      timeOfDay: 'timeless',
      // concentric pulse rings from the centre: calm slow rings / jittering sparks / no particles (WORLD §3.1)
      variants: [
        { when: { flag: 'flag_heartstone_stabilized' }, patch: { focal: 'heartstone_stabilized' } },
        { when: { flag: 'flag_heartstone_exploited' }, patch: { focal: 'heartstone_exploited', particles: 'static' } },
        { when: { flag: 'flag_heartstone_destroyed' }, patch: { focal: 'heartstone_destroyed', particles: 'none' } },
      ],
    },
    levelBand: { min: 3, max: 4 },
    map: { x: 0, y: 10 },
    tags: ['legacy', 'conflux', 'heartstone'],
  },
] satisfies LocationInput[];
