// The six legacy quests (STORY §11.2–§11.3; DESIGN §6.2 tier XP, §11.2 deltas, §13.1 rewards and gates; PLAN Appendix A.5 ids
// and names; legacy/echoes_of_aethelgard.py `handle_ilyra`, `handle_brak`, `handle_nyx`, `check_heartstone_unlock`). Their
// scenes are ../dialogues/legacy.ts; the conventions both follow are in ./index.ts and ../dialogues/index.ts.
//
// Text: `name` and the first stage's journal are the Python `Quest(…)` name and description, verbatim; `description` is the
// giver's legacy offer prompt without its "Accept? (yes/no)" (q_echo_crystal's prompt is a question, so its line is written
// from it); later journals are STORY's stage wording or the legacy line that ends the stage. Stage tags say which.
//
// What each completion pays is `rewards` (DESIGN §6.2's re-rated XP and the unconditional items, rep and Echoes). What only
// one outcome pays rides on the choice or node that picks it (../dialogues/legacy.ts), ending with the `questAdvance` that
// enters the outcome stage.
//
// Readings (listed in the U52 reply):
//   - q_echo_crystal: the 20 gold is paid on Give only (legacy `handle_ilyra`: Keep pays half XP and no gold; DESIGN §13.1
//     "120 XP + 20 gold, or 60 XP if kept"). `echo_crystal_location` ("Take the Crystal once", STORY §12; "both", §11.2) is
//     granted when the Crystal is first held in the quest, which comes before either choice.
//   - q_lost_scroll: Ilyra's reading grants `echo_oriel_lineage` (STORY's "seeded", the U51 record's first source) and
//     `echo_archive_door`; q_the_danthe_line confirms it again. Nyx's reading (Loop 2+) grants the Recoil and verse 8; the
//     engine grants `echo_tyrant_jailer` when a second source is held (echoes.ts).
//   - q_blighted_outpost: "no Stone-Hide Golem remains" is two Golem kills this loop (legacy: no Golem left at the Outpost,
//     however it was cleared). DESIGN §13.3 ex. 8's `speak_warder_word` is the stage `speak_warder_word`, reached by the
//     `echo_stone_hide_origin` shortcut: arriving at the Outpost with the word sets `flag_outpost_golems_stilled` and moves
//     to `cleared` (no scene: a location `interact` event would be the region's; the encounter is already optional there).
//     The Loop 2+ "Vane's sigil noticed" grant of `echo_stone_hide_origin` happens when the Golems are cleared.
//   - q_void_shards: Refuse ends the quest as completed (D-017 makes it a decision with its own consequences; legacy only
//     deferred). Both outcomes pay the tier XP.
//   - q_echoing_heartbeat: starts by itself after two completed quests (legacy `check_heartstone_unlock`); its announcement
//     ("A Distant Pulse": "A deep heartbeat rolls through the ruins, calling you downward.") is its `description` and the
//     `questStarted` toast (a scene opened from the sweep would replace the scene that completed the second quest).
//     `echo_heartstone_path` ("reach the Depths once") is granted on arrival in the Depths during the quest.
//   - The +1 MAG, +15 and +20 max HP are the `statBonus` effect (a C1 addition of U52: no atom could raise a primary or a
//     maximum). The legacy auto-equip of Ironclad Mail and Plate is the player's (no effect equips).
import type { QuestInput } from '@schema/quest';

export const quests = [
  // ---- Echoes in the Library — Remnants 1 (STORY §11.2; giver Ilyra, Whispering Ruins) -----------------------------------
  {
    id: 'q_echo_crystal',
    legacyId: 'echo_crystal',
    name: 'Echoes in the Library',
    description: 'Ilyra asks you to recover an Echo Crystal.',
    category: 'legacy',
    botHint: 'explorer',
    giverNpcId: 'npc_ilyra',
    factionId: 'remnants',
    stages: [
      {
        id: 'reach_library',
        tags: ['legacy'],
        journal: 'Retrieve the Echo Crystal from the Shattered Library to the north of Whispering Ruins.',
        objectives: [{ id: 'obj_library', text: 'Reach the Shattered Library', when: { location: 'loc_shattered_library' }, hintLocationId: 'loc_shattered_library' }],
        // legacy asks only for the Crystal: one already carried moves the quest straight on
        advanceWhen: { any: [{ location: 'loc_shattered_library' }, { item: { id: 'item_echo_crystal' } }] },
        next: 'take_crystal',
      },
      {
        id: 'take_crystal',
        tags: ['story'],
        journal: 'Take the Crystal from the third alcove behind the fallen shelf.',
        objectives: [{ id: 'obj_crystal', text: 'Take the Echo Crystal', when: { item: { id: 'item_echo_crystal' } }, hintLocationId: 'loc_shattered_library' }],
        next: 'return',
      },
      {
        id: 'return',
        tags: ['story'],
        journal: 'Return to Ilyra and choose.',
        onEnter: [{ grantEcho: 'echo_crystal_location' }],
        // scene_echo_crystal decides: Give → given, Keep → kept
        next: 'given',
      },
      { id: 'given', tags: ['legacy'], journal: 'Ilyra cradles the crystal, whispering a prayer.', outcome: 'complete' },
      { id: 'kept', tags: ['legacy'], journal: 'You tuck the crystal away, its whispers now yours alone.', outcome: 'complete' },
    ],
    // DESIGN §6.2: 120 XP, 60 if kept (the legacy halving); Give adds the other 60 and the 20 gold
    rewards: { xp: 60 },
    shortcuts: [{ echo: 'echo_crystal_location', skipTo: 'take_crystal', text: 'Third alcove, behind the fallen shelf.' }],
  },

  // ---- The Scholar's Lost Scroll — Remnants 2 (STORY §11.2; giver Ilyra after q_echo_crystal) ------------------------------
  {
    id: 'q_lost_scroll',
    legacyId: 'lost_scroll',
    name: "The Scholar's Lost Scroll",
    description: 'Ilyra asks you to recover her lost scroll from the Sunken Archives.',
    category: 'legacy',
    botHint: 'melee',
    giverNpcId: 'npc_ilyra',
    factionId: 'remnants',
    availableWhen: { quest: { id: 'q_echo_crystal', status: 'completed' } },
    stages: [
      {
        id: 'descend',
        tags: ['legacy'],
        journal: 'Retrieve the lost scroll from the Sunken Archives beneath the Whispering Ruins.',
        objectives: [{ id: 'obj_archives', text: 'Descend to the Sunken Archives', when: { location: 'loc_sunken_archives' }, hintLocationId: 'loc_sunken_archives' }],
        advanceWhen: { any: [{ location: 'loc_sunken_archives' }, { item: { id: 'item_scholars_lost_scroll' } }] },
        next: 'recover',
      },
      {
        id: 'recover',
        tags: ['story'],
        journal: "Recover the Scholar's Lost Scroll from the Drowned Archivist's carrel.",
        // the Archivist's quest drop at the Archives (../../regions/silverwood_ruins/creatures.ts); Loop 2+ q_the_first_drowned
        objectives: [{ id: 'obj_scroll', text: "Recover the Scholar's Lost Scroll", when: { item: { id: 'item_scholars_lost_scroll' } }, hintLocationId: 'loc_sunken_archives' }],
        next: 'deliver',
      },
      {
        id: 'deliver',
        tags: ['story'],
        journal: 'Bring it to Ilyra.',
        // scene_ilyra_lost_scroll_return → to_ilyra; from Loop 2, scene_nyx_lost_scroll → to_nyx
        next: 'to_ilyra',
      },
      { id: 'to_ilyra', tags: ['legacy'], journal: "You gain insight and the Remnants' deeper trust.", outcome: 'complete' },
      { id: 'to_nyx', tags: ['written'], journal: "You read Oriel's scroll to Nyx.", outcome: 'complete' },
    ],
    rewards: { xp: 150 },
  },

  // ---- Clear the Barren Peaks — Ironclad 1 (STORY §11.2; giver Brak, Ironclad Camp) ----------------------------------------
  {
    id: 'q_clear_path',
    legacyId: 'clear_path',
    name: 'Clear the Barren Peaks',
    description: 'Brak asks you to clear the monsters in the Barren Peaks to the north.',
    category: 'legacy',
    botHint: 'melee',
    giverNpcId: 'npc_brak',
    factionId: 'ironclad',
    stages: [
      {
        id: 'hunt',
        tags: ['legacy'],
        journal: 'Defeat the Wildling Brute prowling the Barren Peaks north of Ironclad Camp.',
        // DESIGN §13.3 ex. 9: the legacy flag `defeated_wildling`
        objectives: [{ id: 'obj_brute', text: 'Defeat the Wildling Brute', when: { killed: { id: 'cr_wildling_brute', count: 1, sinceStage: true } }, hintLocationId: 'loc_barren_peaks' }],
        next: 'report',
      },
      // scene_brak_clear_path_report → done
      { id: 'report', tags: ['story'], journal: 'Report to Brak.', next: 'done' },
      { id: 'done', tags: ['legacy'], journal: 'Brak hands you Ironclad Mail.', outcome: 'complete' },
    ],
    // DESIGN §6.2 120 XP; §11.2 Ironclad +10; STORY §12 "q_clear_path complete once" → the scouts' challenge words
    rewards: { xp: 120, items: [{ itemId: 'item_ironclad_mail' }], rep: [{ faction: 'ironclad', delta: 10 }], echoes: ['echo_ironclad_passwords'] },
  },

  // ---- The Blighted Outpost — Ironclad 2 (STORY §11.2; giver Brak after q_clear_path) --------------------------------------
  {
    id: 'q_blighted_outpost',
    legacyId: 'blighted_outpost',
    name: 'The Blighted Outpost',
    description: 'Brak growls about the Blighted Outpost east of the Barren Peaks.',
    category: 'legacy',
    botHint: 'melee',
    giverNpcId: 'npc_brak',
    factionId: 'ironclad',
    availableWhen: { quest: { id: 'q_clear_path', status: 'completed' } },
    stages: [
      {
        id: 'golems',
        tags: ['legacy'],
        journal: 'Clear the Stone-Hide Golems from the Blighted Outpost east of the Barren Peaks.',
        objectives: [{ id: 'obj_golems', text: 'Clear the Stone-Hide Golems', when: { killed: { id: 'cr_stone_hide_golem', count: 2 } }, hintLocationId: 'loc_blighted_outpost' }],
        next: 'cleared',
      },
      {
        // DESIGN §13.3 ex. 8 (the warder's word): opened by the echo_stone_hide_origin shortcut; Pacifist's Vow relies on it
        id: 'speak_warder_word',
        tags: ['written'],
        journal: "Go to the Blighted Outpost and speak the warder's word.",
        objectives: [{ id: 'obj_word', text: "Speak the warder's word at the Blighted Outpost", when: { location: 'loc_blighted_outpost' }, hintLocationId: 'loc_blighted_outpost' }],
        onExit: [{ setFlag: 'flag_outpost_golems_stilled' }],
        next: 'cleared',
      },
      {
        id: 'cleared',
        tags: ['story'],
        journal: 'Report to Brak.',
        // STORY §11.2: from Loop 2 the Amulet reads Vane's sigil on the golems (echo_stone_hide_origin)
        onEnter: [{ onlyIf: { when: { loop: { min: 2 } }, effects: [{ grantEcho: 'echo_stone_hide_origin' }] } }],
        // scene_brak_blighted_outpost_report → done
        next: 'done',
      },
      { id: 'done', tags: ['legacy'], journal: 'Brak clasps your forearm and hands over Ironclad Plate Armor.', outcome: 'complete' },
    ],
    // DESIGN §6.2 220 XP; §11.2 Ironclad +15, Weavers −3 (the +15 max HP rides on Brak's report: a statBonus)
    rewards: {
      xp: 220,
      items: [{ itemId: 'item_ironclad_plate_armor' }],
      rep: [
        { faction: 'ironclad', delta: 15 },
        { faction: 'weavers', delta: -3 },
      ],
    },
    shortcuts: [{ echo: 'echo_stone_hide_origin', skipTo: 'speak_warder_word', text: "You know the warder's word that stills Vane's golems." }],
  },

  // ---- Whispers of the Void — Weavers 1 (STORY §11.2; giver Nyx, Chasm of Whispers) ---------------------------------------
  {
    id: 'q_void_shards',
    legacyId: 'void_shards',
    name: 'Whispers of the Void',
    description: 'Nyx offers a pact: gather three Void Shards to the east.',
    category: 'legacy',
    botHint: 'melee',
    giverNpcId: 'npc_nyx',
    factionId: 'weavers',
    stages: [
      {
        id: 'gather',
        tags: ['legacy'],
        journal: 'Collect three Void Shards from the corrupted creatures in the Voidscar Hollow east of the Chasm of Whispers.',
        objectives: [{ id: 'obj_shards', text: 'Collect three Void Shards', when: { item: { id: 'item_void_shard', count: 3 } }, hintLocationId: 'loc_voidscar_hollow' }],
        next: 'return',
      },
      {
        id: 'return',
        tags: ['written'],
        journal: 'Return to Nyx with the three shards.',
        // scene_nyx_void_shards_return: Give → given, Refuse → refused
        next: 'given',
      },
      { id: 'given', tags: ['legacy'], journal: 'The void sings through you now. Do not waste its favor.', outcome: 'complete' },
      { id: 'refused', tags: ['legacy'], journal: 'Then keep their whispers, for now.', outcome: 'complete' },
    ],
    // DESIGN §6.2 260 XP, either way; the Shadow-Kissed Dagger is Give's
    rewards: { xp: 260 },
  },

  // ---- The Echoing Heartbeat — Silverwood Ruins pivot (STORY §11.3; automatic after two completed quests) ---------------
  {
    id: 'q_echoing_heartbeat',
    legacyId: 'echoing_heartbeat',
    name: 'The Echoing Heartbeat',
    description: 'A deep heartbeat rolls through the ruins, calling you downward.',
    category: 'legacy',
    botHint: 'explorer',
    // legacy `check_heartstone_unlock`: "A Distant Pulse" once two quests are completed
    startWhen: { counter: { name: 'quests_completed', min: 2 } },
    stages: [
      {
        id: 'descend',
        tags: ['legacy'],
        journal: 'Follow the pulsing call beneath the Whispering Ruins to the hidden Heartstone.',
        objectives: [{ id: 'obj_depths', text: 'Reach the Heartstone Depths', when: { location: 'loc_heartstone_depths' }, hintLocationId: 'loc_heartstone_depths' }],
        next: 'choose',
      },
      {
        id: 'choose',
        tags: ['story'],
        journal: 'In the Depths, choose.',
        // STORY §12: "Reach Heartstone Depths once" → from Loop 2 the Depths open without the pulse
        onEnter: [{ grantEcho: 'echo_heartstone_path' }],
        // scene_heartstone_choice (opened by ev_depths_choice) decides; "Wait" leaves the quest here
        next: 'done_stabilize',
      },
      { id: 'done_stabilize', tags: ['legacy'], journal: 'The chamber calms, and the Heartstone settles into a steady rhythm.', outcome: 'complete' },
      { id: 'done_exploit', tags: ['legacy'], journal: 'You wrench the Heartstone free. The world shudders, and power floods your veins.', outcome: 'complete' },
      { id: 'done_destroy', tags: ['legacy'], journal: 'The Heartstone cracks. Silence follows, and your body hardens against the loss.', outcome: 'complete' },
    ],
    rewards: { xp: 400 },
  },
] satisfies QuestInput[];
