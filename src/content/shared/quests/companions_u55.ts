// The six companion arc quests of Nyx and Dask (STORY §11.4 `q_tears_of_the_breach`, `q_the_dark_between`,
// `q_what_she_would_undo`, `q_the_flickering_man`, `q_seven_marks`, `q_the_last_instant`; §7.3, §7.4 the arcs; DESIGN §6.2
// "companion arc 150/250/400", §12.5 loyalty — +5 per arc stage completed, stage 2 at 25, stage 3 at 50 — §12.8 Dask;
// D-067.15 Threshold quests; D-111 the companions are registered). Their scenes are ../dialogues/companions_u55.ts; the
// conventions both follow are ./index.ts and ../dialogues/index.ts (U52's pattern, D-105, D-109).
//
// Text: `name` and the first stage's journal are STORY's (tag `story`); the later journals are written (tag `written`,
// listed in the U55 reply); `description` is the giver's ask in one sentence. Every quest is Loop 2+ (D-067.17): Nyx's
// first by `FROM_LOOP_2`, the rest by the Echo or the Loop 3+ Threshold they need.
//
// Loyalty (DESIGN §12.5 "personal quest stage completed +5"): every stage pays +5 to its companion — a stage that is left
// in `onExit`, an outcome stage in `onEnter` — so a three-stage arc quest is +15 and the five-stage first Dask quest +25
// (a `loyalty` effect changes a recruited companion only). Stage 2 of each arc asks loyalty ≥ 25 (`availableWhen`),
// stage 3 ≥ 50 ("Loyal"). What one outcome pays (rep, Echoes, flags, the aligned/against loyalty) rides on the choice.
//
// Readings (listed in the U55 reply):
//   - q_tears_of_the_breach: "Bring one to the Chasm's edge at night" is two objectives on the first stage — a Void
//     Shard carried, and standing at the Chasm at night — then the reading is her scene; the one Shard STORY pays is the
//     quest's reward (the one held is not taken).
//   - q_the_dark_between: Nyx goes ahead to Where She Fell while the quest runs (her NPC `schedule`, the Voidscar's
//     npcs.ts), so the unmasking is a `talk` there; the second stage is the arrival (`ev_fell_names` is the crater's own
//     event); the quest is offered after her first quest or with `echo_nine_voices`, as STORY says.
//   - q_what_she_would_undo: she waits at the Hollow while it runs (schedule); the plan and the answer are one scene.
//   - q_the_flickering_man: his other three stand at the Spires, the Plateau and the Nexus while it runs (his schedule), in
//     STORY's order (stages 2–4), each a `talk`; the stage objective is the moment's scene done (`flag_scene_done_`, C-58).
//   - q_seven_marks: it starts on the Still Shore (Loop 3+, `echo_threshold`); "Dask loyalty ≥ 25" cannot be read at the
//     Threshold (the state there is the next loop's, D-082), so it is `echo_dask_bond` (DESIGN §12.5: the bond Echo is
//     loyalty 25 at a loop's edge) or `echo_flickering_man` (his arc's first Echo). The Gallery's `ev_gallery_marks`
//     advances it (the Threshold's locations.ts); the symptom talk on the Shore; the eighth frame at the Windward Stair
//     (the High Mark, BIBLE §7) in the next loop, where he stands while the stage runs. Once per profile (D-067.15).
//   - q_the_last_instant: "in Movement III, ask" — the communion's answers carry no effects, so the asking is the
//     communion carried through Movement III with Dask beside you (`flag_tyrant_spared`, the engine's mark of its end);
//     he then stands at the Apex (schedule) for his choice.
import type { QuestInput } from '@schema/quest';
import { FROM_LOOP_2 } from '../dialogues/common';

/** DESIGN §12.5: a personal quest stage completed. */
const STAGE_LOYALTY = 5;
const nyxStage = [{ loyalty: { companion: 'nyx' as const, delta: STAGE_LOYALTY } }];
const daskStage = [{ loyalty: { companion: 'dask' as const, delta: STAGE_LOYALTY } }];

/** C-58: the engine's flag once a scene has ended this loop. */
const sceneDone = (sceneId: `scene_${string}`) => ({ flag: `flag_scene_done_${sceneId}` as const });

export const quests = [
  // ---- Tears of the Breach — Nyx 1 (STORY §11.4; giver Nyx at the Chasm, after the shards are given) -------------------------
  {
    id: 'q_tears_of_the_breach',
    name: 'Tears of the Breach',
    description: "Nyx will teach you to read a Void Shard at the Chasm's edge at night.",
    category: 'companion',
    botHint: 'pacifist',
    giverNpcId: 'npc_nyx',
    factionId: 'weavers',
    companionId: 'nyx',
    availableWhen: { all: [FROM_LOOP_2, { quest: { id: 'q_void_shards', stage: 'given' } }] },
    stages: [
      {
        id: 'shard_at_night',
        tags: ['story'],
        journal: "Nyx will teach you to read a Shard. Bring one to the Chasm's edge at night.",
        objectives: [
          { id: 'obj_shard', text: 'Carry a Void Shard', when: { item: { id: 'item_void_shard' } }, hintLocationId: 'loc_voidscar_hollow' },
          { id: 'obj_edge', text: "Stand at the Chasm's edge at night", when: { all: [{ location: 'loc_chasm_of_whispers' }, { watch: 'night' }] }, hintLocationId: 'loc_chasm_of_whispers' },
        ],
        onExit: nyxStage,
        next: 'read',
      },
      {
        // scene_nyx_tears_reading: the moment, then the ask
        id: 'read',
        tags: ['written'],
        journal: 'Hold the Shard while she speaks. Nyx waits at the lip of the Chasm.',
        onExit: nyxStage,
        next: 'unanswered',
      },
      { id: 'unanswered', tags: ['written'], journal: 'A stair, a boy, a bell. You asked whose moment it is. She did not answer.', onEnter: nyxStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 1: 150 XP; STORY: one Void Shard
    rewards: { xp: 150, items: [{ itemId: 'item_void_shard' }] },
  },

  // ---- The Dark Between — Nyx 2 (STORY §11.4; giver Nyx; Where She Fell) ------------------------------------------------------
  {
    id: 'q_the_dark_between',
    name: 'The Dark Between',
    description: 'Nyx has asked you into the place in the Veil she keeps.',
    category: 'companion',
    botHint: 'pacifist',
    giverNpcId: 'npc_nyx',
    factionId: 'weavers',
    companionId: 'nyx',
    availableWhen: {
      all: [FROM_LOOP_2, { any: [{ quest: { id: 'q_tears_of_the_breach', status: 'completed' } }, { echo: 'echo_nine_voices' }] }, { loyalty: { companion: 'nyx', min: 25 } }],
    },
    stages: [
      {
        id: 'asked_in',
        tags: ['story'],
        journal: 'Nyx keeps a place in the Veil no one enters. She has asked you in.',
        objectives: [{ id: 'obj_crater', text: 'Reach Where She Fell, in the Veil', when: { location: 'loc_where_she_fell' }, hintLocationId: 'loc_where_she_fell' }],
        onExit: nyxStage,
        next: 'names',
      },
      {
        // scene_nyx_unmasking decides: keep her secret → kept, tell the Choir → told
        id: 'names',
        tags: ['written'],
        journal: 'Nine names in chalk on the rim, eight crossed out. Ask her whose the ninth is.',
        onExit: nyxStage,
        next: 'kept',
      },
      { id: 'kept', tags: ['written'], journal: 'You keep her name from the Choir. The glass keeps it too.', onEnter: nyxStage, outcome: 'complete' },
      { id: 'told', tags: ['written'], journal: 'You told the Choir what she is. She is gone from your side for the loop.', onEnter: nyxStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 2: 250 XP
    rewards: { xp: 250 },
  },

  // ---- What She Would Undo — Nyx 3 (STORY §11.4; giver Nyx; the Hollow) --------------------------------------------------------
  {
    id: 'q_what_she_would_undo',
    name: 'What She Would Undo',
    description: 'Nyx asks for help going back to the sixth verse, with the Breach open and Veyran alive to hold the door.',
    category: 'companion',
    botHint: 'pacifist',
    giverNpcId: 'npc_nyx',
    factionId: 'weavers',
    companionId: 'nyx',
    availableWhen: { all: [{ echo: 'echo_nyx_is_of_the_nine' }, { loyalty: { companion: 'nyx', min: 50 } }] },
    stages: [
      {
        // scene_nyx_undo_plan at the Hollow passes through `heard` and decides
        id: 'plan',
        tags: ['story'],
        journal: 'Nyx wants to go back to the sixth verse and say what Hallow said, with a reason. She needs the Breach open, Veyran alive to hold the door, and a Wayfinder beside her.',
        onExit: nyxStage,
        next: 'heard',
      },
      {
        id: 'heard',
        tags: ['written'],
        journal: 'The door to the past is him. The Core pries it wide; killing him slams it shut. Answer her.',
        onExit: nyxStage,
        next: 'agreed',
      },
      { id: 'agreed', tags: ['written'], journal: 'You will stand beside her at the stone. The Weavers have their dawn to work for.', onEnter: nyxStage, outcome: 'complete' },
      { id: 'refused_truth', tags: ['written'], journal: 'You told her it was always going to fail. She did not believe you, and then she did.', onEnter: nyxStage, outcome: 'complete' },
      { id: 'refused', tags: ['written'], journal: 'You refused her. She will ask another Wayfinder, some other day.', onEnter: nyxStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 3: 400 XP
    rewards: { xp: 400 },
  },

  // ---- The Flickering Man — Dask 1 (STORY §11.4; giver Dask at the Shimmering Pass, Loop 2+) -----------------------------------
  {
    id: 'q_the_flickering_man',
    name: 'The Flickering Man',
    description: 'Dask is in four places at once; find the other three and hear the end of his sentence.',
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_dask',
    companionId: 'dask',
    availableWhen: FROM_LOOP_2,
    stages: [
      {
        id: 'spires',
        tags: ['story'],
        journal: 'Dask is in four places at once, mid-sentence. Find the other three and hear the whole sentence.',
        objectives: [{ id: 'obj_spires', text: 'Find him at the Aetherium Spires and listen', when: sceneDone('scene_dask_moment_spires'), hintLocationId: 'loc_aetherium_spires' }],
        onExit: daskStage,
        next: 'plateau',
      },
      {
        id: 'plateau',
        tags: ['written'],
        journal: 'Another of him stands on the Sky-Whisper Plateau, mid-word, where the wind keeps the time.',
        objectives: [{ id: 'obj_plateau', text: 'Find him on the Sky-Whisper Plateau and listen', when: sceneDone('scene_dask_moment_plateau'), hintLocationId: 'loc_sky_whisper_plateau' }],
        onExit: daskStage,
        next: 'nexus',
      },
      {
        id: 'nexus',
        tags: ['written'],
        journal: 'The third of him is at the Chronos Nexus, under the broken dome, a step from the door.',
        objectives: [{ id: 'obj_nexus', text: 'Find him at the Chronos Nexus and listen', when: sceneDone('scene_dask_moment_nexus'), hintLocationId: 'loc_chronos_nexus' }],
        onExit: daskStage,
        next: 'sentence',
      },
      {
        // scene_dask_flickering_man_sentence at the Pass says the whole of it
        id: 'sentence',
        tags: ['written'],
        journal: 'You have heard three of him. Go back to the Pass; the one that talks can finish the sentence now.',
        onExit: daskStage,
        next: 'heard',
      },
      { id: 'heard', tags: ['written'], journal: 'It is the door, and it knows his name. Someone who knew the words could take its place.', onEnter: daskStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 1: 150 XP; STORY: Dask's Scout Badge
    rewards: { xp: 150, items: [{ itemId: 'item_dasks_scout_badge' }] },
  },

  // ---- Seven Marks — Dask 2 (STORY §11.4; giver Dask on the Still Shore, Loop 3+; the High Mark next loop) --------------------
  {
    id: 'q_seven_marks',
    name: 'Seven Marks',
    description: 'Dask knows where six of the seven Wayfinders left their marks; the seventh is his.',
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_dask',
    companionId: 'dask',
    availableWhen: { all: [{ loop: { min: 3 } }, { echo: 'echo_threshold' }, { any: [{ echo: 'echo_dask_bond' }, { echo: 'echo_flickering_man' }] }] },
    // D-067.15: started at the Threshold, it belongs to the profile and survives the Far Light
    repeatablePerLoop: false,
    stages: [
      {
        // the Gallery's `ev_gallery_marks` advances it (the Threshold's locations.ts)
        id: 'six_known',
        tags: ['story'],
        journal: 'Seven Wayfinders left marks. Dask knows where six are. The seventh is his.',
        onExit: daskStage,
        next: 'marks_seen',
      },
      {
        // scene_dask_seven_marks_symptom on the Shore
        id: 'marks_seen',
        tags: ['written'],
        journal: 'Seven frames, one scratch each, low on the left. Tell Dask on the Shore what you saw.',
        onExit: daskStage,
        next: 'high_mark',
      },
      {
        // scene_dask_seven_marks_eighth at the Windward Stair
        id: 'high_mark',
        tags: ['written'],
        journal: 'The eighth frame has no mark. Climb to the High Mark, the Windward Stair, and let Dask show you what he would cut.',
        onExit: daskStage,
        next: 'eighth_blank',
      },
      { id: 'eighth_blank', tags: ['written'], journal: 'At the High Mark Dask cut the outline of an eighth frame and left it empty.', onEnter: daskStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 2: 250 XP; STORY: 10 Resonance
    rewards: { xp: 250, resonance: 10 },
  },

  // ---- The Last Instant — Dask 3 (STORY §11.4; giver Dask; the Apex, in communion) ----------------------------------------------
  {
    id: 'q_the_last_instant',
    name: 'The Last Instant',
    description: 'Dask has asked you to ask the Tyrant to gather him into one instant.',
    category: 'companion',
    botHint: 'pacifist',
    giverNpcId: 'npc_dask',
    companionId: 'dask',
    availableWhen: { all: [{ echo: 'echo_tyrant_speaks' }, { loyalty: { companion: 'dask', min: 50 } }] },
    stages: [
      {
        id: 'ask_it',
        tags: ['story'],
        journal: 'The Tyrant can gather Dask into one instant. He has asked you to ask it.',
        objectives: [
          { id: 'obj_communion', text: 'Carry the communion through to its end', when: { flag: 'flag_tyrant_spared' }, hintLocationId: 'loc_temporal_breach_apex' },
          { id: 'obj_dask', text: 'Dask at your shoulder when you ask', when: { companion: { id: 'dask' } }, hintLocationId: 'loc_temporal_breach_apex' },
        ],
        onExit: daskStage,
        next: 'gathered',
      },
      {
        // scene_dask_last_instant_choice at the Apex decides: rest → rests, stay → stays
        id: 'gathered',
        tags: ['written'],
        journal: 'It can gather him; it has said so. Ask Dask, at the Apex, what he wants.',
        onExit: daskStage,
        next: 'rests',
      },
      { id: 'rests', tags: ['written'], journal: 'Dask rests. One instant, then none. The chorus is one voice quieter.', onEnter: daskStage, outcome: 'complete' },
      { id: 'stays', tags: ['written'], journal: "Dask stays, flickering, until it is done.", onEnter: daskStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 3: 400 XP
    rewards: { xp: 400 },
  },
] satisfies QuestInput[];
