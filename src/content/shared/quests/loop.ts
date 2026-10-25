// The four loop-only quests (STORY §11.1's table, §11.5 the blocks: `q_the_thirtieth_dawn`, `q_what_the_crystal_heard`,
// `q_stop_the_ritual` (Silverwood Before, §9.4), `q_the_first_drowned`; DESIGN §6.2 "loop-only 300", §10.1 the Breach Clock,
// §13.3). Their scenes are ../dialogues/loop.ts; the conventions both follow are ./index.ts and ../dialogues/index.ts (U52's
// pattern, D-105, D-109, D-112–D-115, D-122).
//
// Text: `name` and the first stage's journal are STORY's (tag `story`); the later journals are written (tag `written`, listed
// in the U58 reply); `description` is the giver's ask, or the place's, in one sentence. Every one of the four is Loop 2+.
//
// How each hooks in (each region edit is listed in the U58 reply):
//   - q_the_thirtieth_dawn: Keeper Dray's ask at the Library (STORY's prereq verbatim: `echo_thirtieth_dawn`, `echo_breach_clock`
//     or Loop 2); the count is an interact at the Heartstone Depths (`ev_depths_count_beats`: one watch passes in the counting);
//     the comparison is Dray's report at the Library. `echo_breach_clock` is the quest's reward (STORY §12: "or `q_high_mark`").
//   - q_what_the_crystal_heard: the Amulet's own (`startWhen`): from Loop 2, with `echo_nine_voices` and the Crystal kept this
//     loop (`flag_kept_echo_crystal`, U52). The Crystal to the Chasm; "I know what you are, Nyx" is U55's Echo line at the lip
//     (`flag_named_nyx`, which opens `scene_nyx_unmasking`'s Crystal entry); the unmasking is hers. Weavers −5 and
//     `echo_ninth_verse_unfinished` ride on completion; "Nyx Loyal if you keep it from Sethe" is the unmasking's `safe` choice.
//   - q_stop_the_ritual: the Before's own (`startWhen`: standing in the region with `echo_before_route`, which the entry grants).
//     STORY §9.4's four attempts are four scenes, each once a loop (the scene-done flag is the objective): Veyran in the Hall
//     (talk, First or Second Bell), Hallow at his field-forge (talk, First or Second Bell — the Conflux before Last Bell is
//     reached through the Tyrant's tear) or at the plinths (Last Bell), Oriel's fair copy (an interact at the Archives of Danthe,
//     `ev_archives_fair_copy`), the cradle (an interact at the Conflux, `ev_conflux_cradle`). Any order; the four are not gated
//     one per reset (listed in the reply: a reset-gate would make the quest four whole echoes long, and each attempt's scene
//     tells its own failure). The sixth beat is Masque from the Hall's dome on Last Bell: `ev_hall_masque_roof` opens the scene
//     once the four are done, and the Hall's Ninefold Knight lets that one visitor by (`optionalWhen`). `echo_hallow_said_stop`
//     (attempt 2), `echo_ritual_inevitable` (the dome), verses IV, VII and IX heard (D-112: U58 grants the two Echoes).
//     Resolved, Last Bell holds (engine before.ts `ritualResolved`).
//   - q_the_first_drowned: a discovery at the Archives (`ev_archives_oriel_carrel`, an interact under the east stair, from Loop 2
//     with `echo_oriel_drowned` while the scroll is still hers); the Archivist's fight is already optional with that Echo
//     (silverwood_ruins/locations.ts `optionalWhen`). The scene starts and ends the quest: the ring or the Amulet, the scroll
//     (q_lost_scroll's `recover` stage completes by the item), verse I in her voice, Remnants +5.
import type { QuestInput } from '@schema/quest';
import { FROM_LOOP_2 } from '../dialogues/common';

const RITUAL_SCENES = ['scene_ritual_warn_veyran', 'scene_ritual_keep_hallow', 'scene_ritual_steal_record', 'scene_ritual_break_cradle'] as const;

export const quests = [
  // ---- The Thirtieth Dawn (STORY §11.5; giver Keeper Dray, Loop 2+) ---------------------------------------------------------
  {
    id: 'q_the_thirtieth_dawn',
    name: 'The Thirtieth Dawn',
    description: "Keeper Dray asks you to count the Heartstone's beats for one watch and set the count against his water-clock.",
    category: 'loop',
    botHint: 'explorer',
    giverNpcId: 'npc_ansel_dray',
    factionId: 'remnants',
    availableWhen: { any: [{ echo: 'echo_thirtieth_dawn' }, { echo: 'echo_breach_clock' }, { loop: { min: 2 } }] },
    stages: [
      {
        id: 'drift',
        tags: ['story'],
        journal: "Dray's water-clock and the Heartstone's pulse are drifting apart. Measure the drift.",
        objectives: [{ id: 'obj_depths', text: 'Go down to the Heartstone Depths', when: { location: 'loc_heartstone_depths' }, hintLocationId: 'loc_heartstone_depths' }],
        next: 'count',
      },
      {
        id: 'count',
        tags: ['written'],
        journal: "Count the Heartstone's beats for one watch in the Depths. Keep still; the stone does not.",
        // scene_depths_count_beats (ev_depths_count_beats): one watch passes → compare
        next: 'compare',
      },
      {
        id: 'compare',
        tags: ['written'],
        journal: 'Carry the count to the Library. Dray will set it against the water-clock; the difference is the days you have.',
        objectives: [{ id: 'obj_library', text: 'Bring the count to Keeper Dray at the Shattered Library', when: { location: 'loc_shattered_library' }, hintLocationId: 'loc_shattered_library' }],
        // scene_dray_thirtieth_dawn_report → done
        next: 'done',
      },
      {
        id: 'done',
        tags: ['written'],
        journal: 'The number is the days remaining. Dray has written it in the margin, and the Breach Clock shows every hour it loses or gains.',
        outcome: 'complete',
      },
    ],
    // DESIGN §6.2 loop-only 300; STORY: `echo_breach_clock`
    rewards: { xp: 300, echoes: ['echo_breach_clock'] },
  },

  // ---- What the Crystal Heard (STORY §11.5; the Amulet's own, Loop 2+ with `echo_nine_voices` and the Crystal kept) ---------
  {
    id: 'q_what_the_crystal_heard',
    name: 'What the Crystal Heard',
    description: 'The Crystal holds nine voices, and the Amulet knows one of them is in the Chasm.',
    category: 'loop',
    botHint: 'explorer',
    startWhen: { all: [FROM_LOOP_2, { echo: 'echo_nine_voices' }, { flag: 'flag_kept_echo_crystal' }] },
    stages: [
      {
        id: 'nine_voices',
        tags: ['story'],
        journal: 'Nine voices. One of them is in the Chasm. Make her hear herself.',
        objectives: [
          {
            id: 'obj_chasm',
            text: 'Bring the Echo Crystal to the Chasm of Whispers',
            when: { all: [{ location: 'loc_chasm_of_whispers' }, { item: { id: 'item_echo_crystal' } }] },
            hintLocationId: 'loc_chasm_of_whispers',
          },
        ],
        next: 'listen',
      },
      {
        id: 'listen',
        tags: ['written'],
        journal: 'Say it to her face at the lip of the Chasm, the Crystal in your hand: you know what she is. Then let the eighth voice speak.',
        // U55's Echo line "I know what you are, Nyx" sets the flag and opens scene_nyx_unmasking's Crystal entry
        objectives: [{ id: 'obj_named', text: 'Tell Nyx you know what she is', when: { flag: 'flag_named_nyx' }, hintLocationId: 'loc_chasm_of_whispers' }],
        next: 'heard',
      },
      {
        id: 'heard',
        tags: ['written'],
        journal: 'She heard the eighth verse in her own voice. The ninth voice on the Crystal has not finished its verse. Nyx is angry, and the Choir does not know.',
        outcome: 'complete',
      },
    ],
    // DESIGN §6.2 loop-only 300; STORY: Weavers −5 (she is angry), `echo_ninth_verse_unfinished` (a source of `echo_tyrant_jailer`)
    rewards: { xp: 300, rep: [{ faction: 'weavers', delta: -5 }], echoes: ['echo_ninth_verse_unfinished'] },
  },

  // ---- Stop the Ritual (STORY §9.4, §11.5; Silverwood Before's own, Loop 2+ with `echo_before_route`) ----------------------------
  {
    id: 'q_stop_the_ritual',
    name: 'Stop the Ritual',
    description: 'You are three days before the Sundering, and the Nine are alive. Try to stop them.',
    category: 'loop',
    botHint: 'explorer',
    startWhen: { all: [FROM_LOOP_2, { region: 'region_silverwood_before' }, { echo: 'echo_before_route' }] },
    stages: [
      {
        id: 'try',
        tags: ['story'],
        journal: 'You are three days before the Sundering. Try.',
        objectives: [
          { id: 'obj_warn', text: 'Warn Veyran in the Ninefold Hall', when: { flag: `flag_scene_done_${RITUAL_SCENES[0]}` }, hintLocationId: 'loc_ninefold_hall' },
          { id: 'obj_hallow', text: 'Keep Hallow in the circle', when: { flag: `flag_scene_done_${RITUAL_SCENES[1]}` }, hintLocationId: 'loc_conflux_chamber' },
          { id: 'obj_record', text: "Take Oriel's record from the Archives of Danthe", when: { flag: `flag_scene_done_${RITUAL_SCENES[2]}` }, hintLocationId: 'loc_archives_of_danthe' },
          { id: 'obj_cradle', text: "Break Hallow's cradle in the Conflux Chamber", when: { flag: `flag_scene_done_${RITUAL_SCENES[3]}` }, hintLocationId: 'loc_conflux_chamber' },
        ],
        next: 'masque',
      },
      {
        id: 'masque',
        tags: ['written'],
        journal: 'Four times, four ways, and the ninth bell still cracks. On Last Bell go up to the Hall. Masque is on the dome, and he has read it twice.',
        // scene_masque_roof (ev_hall_masque_roof, Last Bell) → inevitable
        next: 'inevitable',
      },
      {
        id: 'inevitable',
        tags: ['written'],
        journal: 'It was always going to fail, and they were always going to do it. You see it from the far side now. Last Bell holds.',
        outcome: 'complete',
      },
    ],
    // DESIGN §6.2 loop-only 300; STORY: 15 Resonance (the Echoes ride on the attempts and the dome)
    rewards: { xp: 300, resonance: 15 },
  },

  // ---- The First Drowned (STORY §11.5, §13 Oriel's carrel; a discovery at the Sunken Archives, Loop 2+ with `echo_oriel_drowned`) --
  {
    id: 'q_the_first_drowned',
    name: 'The First Drowned',
    description: 'The Drowned Archivist in the carrel under the east stair is Oriel Danthe, and she can be spoken to.',
    category: 'loop',
    botHint: 'pacifist',
    factionId: 'remnants',
    availableWhen: { all: [FROM_LOOP_2, { echo: 'echo_oriel_drowned' }] },
    stages: [
      {
        id: 'carrel',
        tags: ['story'],
        journal: 'The Drowned Archivist guarding the scroll is Oriel Danthe. Show her the seal, or the Amulet.',
        // scene_oriel_carrel_again decides: the ring or the Amulet → given
        next: 'given',
      },
      {
        id: 'given',
        tags: ['written'],
        journal: 'She gave up the scroll without rising, and the first verse in her own voice. Nobody drew. Tell them the ink still holds.',
        outcome: 'complete',
      },
    ],
    // DESIGN §6.2 loop-only 300; STORY: Remnants +5; verse I rides on the scene (granted only if not held)
    rewards: { xp: 300, rep: [{ faction: 'remnants', delta: 5 }] },
  },
] satisfies QuestInput[];

/** The four attempts' scene ids, in STORY §9.4's order (the objectives read their done flags). */
export const RITUAL_ATTEMPT_SCENES = RITUAL_SCENES;
