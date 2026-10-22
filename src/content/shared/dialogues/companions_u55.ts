// The scenes of Nyx's and Dask's arcs and their camp conversations (STORY §11.4 the six quests; §13 `scene_dask_introduction`
// and `scene_nyx_unmasking`; §5.2 and §6.4 Nyx's déjà vu; §7.3 and §7.4 the voices, recruitment and stances; §10.7 Dask on
// the Still Shore; §11.2 Nyx's side of `q_unlidded_eye`; DESIGN §12.1 recruitment, §12.5 loyalty, §12.7 camp conversations,
// §12.8 Dask's places; BIBLE §3.2: Nyx — smoke, present tense, stops a word early, "he" of Veyran, no exclamation; Dask — dry,
// kind, a dropped word, never a stutter). The quests are ../quests/companions_u55.ts; the conventions are this folder's
// index.ts (U52's pattern, D-105, D-109).
//
// Who says what, and when (priority bands from ./common.ts; every NPC scene is closed while the Horde runs):
//   Nyx, the Chasm   scene_nyx_deja_vu (payoff, once a loop from Loop 2: STORY §5.2 / §6.4 by tier; "I know what you are,
//                    Nyx" with `echo_nine_voices`) · scene_nyx_walk_with_me, _again (recruit: the shards given at Neutral,
//                    or unmasked; the first ask ahead of her offers, turned down once it waits behind them) · scene_nyx_tears_offer · _waiting · scene_nyx_tears_reading (the Shard read: `echo_shard_
//                    moments`, Weavers +5) · scene_nyx_dark_between_offer · scene_nyx_undo_offer · scene_nyx_chasm (what she
//                    says at the lip when nothing is pending, by the arc's state; the Echo line again)
//   Nyx, elsewhere   scene_nyx_unmasking (Where She Fell by the quest, or opened from the Chasm by the Echo line: keep her
//                    secret / tell the Choir / the plan) · scene_nyx_undo_plan (the Hollow: agree / refuse with the truth /
//                    refuse) · scene_nyx_sanctum_eye (the Sanctum while Sethe's Eye is sought)
//   Nyx at camp      scene_nyx_camp_1 (a rest) · _2 (loyalty 25) · _3 (loyalty 50, unmasked)
//   Dask, the Pass   scene_dask_introduction (STORY §13: the warning; recruit, or the quest) · scene_dask_recruit ·
//                    scene_dask_flickering_man_waiting · scene_dask_flickering_man_sentence (the whole sentence:
//                    `echo_flickering_man`) · scene_dask_last_instant_offer · _waiting · scene_dask_pass (what he says in
//                    the cleft when nothing is pending)
//   Dask, his moments  scene_dask_moment_spires · _plateau · _nexus (each: approach, Listen, a piece of the sentence)
//   Dask, the Shore  scene_dask_shore (Loop 3+: STORY §10.7's line, or a stranger's) · scene_dask_seven_marks_offer ·
//                    _waiting · scene_dask_seven_marks_symptom (`echo_wayfinder_symptom`) · scene_dask_seven_marks_eighth
//                    (the Windward Stair, next loop) · scene_dask_last_instant_choice (the Apex: rest / stay)
//   Dask at camp     scene_dask_camp_1 (a rest) · _2 (loyalty 25) · _3 (loyalty 50)
//
// Where the companions stand: their NPC records' `schedule` (D-102; the Voidscar's and the Highlands' npcs.ts) put Nyx at
// Where She Fell, the Hollow and the Sanctum while the quests that need her there run, and Dask at the Spires, the Plateau
// and the Nexus (his moments), the Windward Stair (the eighth frame) and the Apex (his choice). At the Threshold the run's
// place is still the start location (D-082: the state there is the next loop's), so a Shore scene reads AT_THE_THRESHOLD
// below rather than `{ location: 'loc_still_shore' }`. A companion in the party is spoken to at a camp (DESIGN §12.7:
// `campScenes`, one per full rest, +2 loyalty from the engine; no `npcId`).
//
// Bands: the legacy after-line `scene_nyx_void_sings` (U52, `after`, first in content order) would win every tie, so the
// arc's "nothing pending" lines of both companions ride in the `waiting` band after their waiting scenes (the latest thing
// said wins the band by content order). STORY gives these scenes their beats and the lines marked `story`; every other line
// is written (tag `written`, listed in the U55 reply and pinned by tests/unit/content/quests/companions_u55.test.ts).
//
// Not here, by design: Nyx's refusals (the Emberforge, the Apex before her arc resolves, Silverwood Before) and Dask's
// silence toward Nyx (STORY §7.3, §7.4) have no companion-refusal atom (DESIGN §12.8 restricts Dask only); the Tyrant's
// "one voice quieter" with `echo_dask_rest` is the Tyrant's data (U45's creature); DESIGN §12.5's Dask −30 on the Tyrant's
// death and +3 on sparing it have no hook outside the fight (U58/U62); the ending scenes' Dask lines are U58's.
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { Effect } from '@schema/effect';
import { gameConfig } from '../config';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY, echoLocked, loyaltyFor, type ChoiceInput, type NodeInput } from './common';

// ---- Conditions used more than once -----------------------------------------------------------------------------------------

const NYX = 'npc_nyx';
const DASK = 'npc_dask';

const AT_CHASM: Condition = { location: 'loc_chasm_of_whispers' };
const AT_PASS: Condition = { location: 'loc_shimmering_pass' };
/** D-082: at the Threshold the run's place is still the start location, and Dask never stands there in the world. */
const AT_THE_THRESHOLD: Condition = { location: gameConfig.startLocationId };
const FROM_LOOP_3: Condition = { loop: { min: 3 } };

const NYX_RECRUITED: Condition = { companion: { id: 'nyx', state: 'recruited' } };
const DASK_RECRUITED: Condition = { companion: { id: 'dask', state: 'recruited' } };
/** STORY §7.3: told to the Choir, she leaves the party, Hostile, for the loop (BIBLE §9 #17 names the flag). */
const NYX_HOSTILE: Condition = { flag: 'flag_nyx_hostile' };
const NYX_LOYAL: Condition = { loyalty: { companion: 'nyx', min: 50 } };
const UNMASKED_THIS_LOOP: Condition = { flag: 'flag_scene_done_scene_nyx_unmasking' };
/** DESIGN §11.1: Neutral is −9..19. */
const WEAVERS_NEUTRAL: Condition = { rep: { faction: 'weavers', min: -9 } };
const WEAVERS_TRUSTED: Condition = { rep: { faction: 'weavers', min: 20 } };
/** STORY §7.4, §10.7: he has walked with you in some loop. */
const DASK_KNOWS_YOU: Condition = { any: [{ echo: 'echo_dask_bond' }, { echo: 'echo_flickering_man' }] };

const stageOf = (quest: `q_${string}`, stage: string): Condition => ({ quest: { id: quest, stage } });
const doneAt = (quest: `q_${string}`, stage: string): Condition => ({ quest: { id: quest, stage, status: 'completed' } });

/** The giver's ask: a yes that starts the quest, a no that goes to the refusal line. */
const offer = (questId: `q_${string}`, yes: string, no: string, afterYes: string, refused: string): ChoiceInput[] => [
  { id: 'yes', text: yes, effects: [{ questStart: questId }], next: afterYes },
  { id: 'no', text: no, next: refused },
];

// ---- Nyx: the unmasking's choices (shared by its two decision nodes) ---------------------------------------------------------

/** The quest's advance only while it runs: the scene also opens from the Chasm by the Echo line (the Crystal route). */
const advanceDarkBetween = (stage: 'kept' | 'told'): Effect => ({
  onlyIf: { when: { quest: { id: 'q_the_dark_between', status: 'active' } }, effects: [{ questAdvance: { quest: 'q_the_dark_between', stage } }] },
});

// STORY §13 / §11.4: keep her secret → Weavers +10, Nyx Loyal (DESIGN §12.5: not telling the Choir what she is is her value);
// tell the Choir → Weavers −20, `echo_choir_knows`, Nyx Hostile this loop (she leaves the party).
const KEEP_SECRET: ChoiceInput = {
  id: 'safe',
  text: "Your secret's safe.",
  effects: [{ rep: { faction: 'weavers', delta: 10 } }, ...loyaltyFor(['nyx']), advanceDarkBetween('kept')],
  next: 'kept',
};
const TELL_CHOIR: ChoiceInput = {
  id: 'choir',
  text: 'The Choir should know.',
  effects: [
    { rep: { faction: 'weavers', delta: -20 } },
    { grantEcho: 'echo_choir_knows' },
    { setFlag: 'flag_nyx_hostile' },
    ...loyaltyFor([], ['nyx']),
    { dismiss: 'nyx' },
    advanceDarkBetween('told'),
  ],
  next: 'told',
};
// STORY §13: "What's the plan?" opens `q_what_she_would_undo` — which asks Nyx Loyal (§11.4), so the line is greyed until then
const ASK_PLAN: ChoiceInput = {
  id: 'plan',
  text: "What's the plan?",
  when: { all: [NYX_RECRUITED, NYX_LOYAL] },
  disabledText: '(She will not say it to you yet)',
  once: true,
  effects: [{ questStart: 'q_what_she_would_undo' }],
  next: 'plan_later',
};

/** D-010 / DESIGN §12.7: the Echo-triggered truth, spoken at the Chasm; it opens the unmasking and sets the achievement's flag. */
const I_KNOW_WHAT_YOU_ARE: ChoiceInput = echoLocked('echo_nine_voices', {
  id: 'i_know',
  text: 'I know what you are, Nyx.',
  when: { all: [{ not: UNMASKED_THIS_LOOP }, { not: NYX_HOSTILE }] },
  effects: [{ setFlag: 'flag_named_nyx' }, { startDialogue: 'scene_nyx_unmasking' }],
  next: 'end',
});
const NOTHING_MORE: ChoiceInput = { id: 'nothing', text: 'Nothing more.', next: 'end' };

/** Dask's rule, said on recruitment (DESIGN §12.8, STORY §13 "he explains the rule"). */
const DASK_RULE = "I'll come. Mind the rule, though: I'm only anywhere the hour's loose. Walk me somewhere it holds steady and I go, and I don't choose where. I come back when it slips again.";

/** One of his moments: he stands mid-word; Listen; a piece of the sentence; he goes. */
const moment = (place: 'spires' | 'plateau' | 'nexus', locationId: `loc_${string}`, there: string, piece: string, gone: string): DialogueSceneInput => ({
  id: `scene_dask_moment_${place}`,
  npcId: DASK,
  title: 'Mid-word',
  when: { all: [NOT_IN_HORDE, { location: locationId }, stageOf('q_the_flickering_man', place)] },
  priority: SCENE_PRIORITY.decision,
  repeatable: false,
  entry: 'there',
  nodes: [
    { id: 'there', tags: ['written'], speaker: 'narrator', text: there, choices: [{ id: 'listen', text: 'Listen.', next: 'piece' }] },
    { id: 'piece', tags: ['story'], speaker: DASK, text: piece, next: 'gone' },
    { id: 'gone', tags: ['written'], speaker: 'narrator', text: gone, next: 'end' },
  ],
});

/** A camp conversation (DESIGN §12.7): no `npcId`, opened by a full rest with the companion standing in the party. */
const camp = (id: `scene_${string}`, title: string, when: Condition, priority: number, entry: string, nodes: NodeInput[]): DialogueSceneInput => ({
  id,
  title,
  when,
  priority,
  repeatable: false,
  entry,
  nodes,
});

/** DESIGN §12.1: Nyx's recruitment at the lip — two scenes, one purpose: the first ask outranks her offers; turned down once a loop, it waits behind them. */
const walkWithMe = (id: `scene_${string}`, priority: number, turnedDown: Condition, firstAsk: boolean): DialogueSceneInput => ({
  id,
  npcId: NYX,
  title: 'Walk with me',
  when: {
    all: [
      NOT_IN_HORDE,
      AT_CHASM,
      { not: NYX_RECRUITED },
      { not: NYX_HOSTILE },
      turnedDown,
      { any: [{ all: [stageOf('q_void_shards', 'given'), WEAVERS_NEUTRAL] }, { all: [{ echo: 'echo_nyx_is_of_the_nine' }, UNMASKED_THIS_LOOP] }] },
    ],
  },
  priority,
  entry: [
    { when: { echo: 'echo_choir_knows' }, node: 'watched' },
    { when: UNMASKED_THIS_LOOP, node: 'known' },
    // DESIGN §12.5: the bond Echo (she started this loop at 25); STORY §6.4: nobody remembers, the void does
    { when: { echo: 'echo_nyx_bond' }, node: 'before' },
    { when: { all: [] }, node: 'owed' },
  ],
  nodes: [
    { id: 'owed', tags: ['written'], speaker: NYX, text: 'You gave the dark what it was owed. Walk with me a while; it listens better when there are two of us.', next: 'ask' },
    { id: 'known', tags: ['written'], speaker: NYX, text: 'You know what I am and you came back down to the lip. Walk with me. I would rather be watched by you than by the Choir.', next: 'ask' },
    { id: 'watched', tags: ['written'], speaker: NYX, text: 'The Choir looks at me now the way I look at the seam. Someone showed them. Walk with me anyway; I have nowhere left that is only mine.', next: 'ask' },
    { id: 'before', tags: ['written'], speaker: NYX, text: 'You have walked beside me before. I do not remember it; the void does, and it has stopped flinching when you breathe. Walk with me.', next: 'ask' },
    {
      id: 'ask',
      tags: ['written'],
      speaker: 'narrator',
      text: 'She does not hold out a hand. She waits.',
      choices: [
        {
          id: 'yes',
          text: 'Walk with me.',
          effects: [{ recruit: 'nyx' }, { onlyIf: { when: { echo: 'echo_choir_knows' }, effects: loyaltyFor([], ['nyx']) } }],
          next: 'joins',
        },
        { id: 'no', text: 'Not yet.', oncePerLoop: firstAsk, next: 'stays' },
      ],
    },
    { id: 'joins', tags: ['written'], speaker: NYX, text: 'Then the void walks with you. Do not thank it. It is not a compliment.', next: 'end' },
    { id: 'stays', tags: ['written'], speaker: NYX, text: 'Then I keep the lip. It has kept me forty years; it can keep me another day.', next: 'end' },
  ],
});

export const dialogues = [
  // ==== Nyx at the Chasm of Whispers ============================================================================================

  // STORY §5.2 / §6.4: the first talk of a loop from Loop 2 — by tier; with `echo_nine_voices` the line that opens the unmasking.
  {
    id: 'scene_nyx_deja_vu',
    npcId: NYX,
    title: 'Something has crossed you',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, AT_CHASM, { not: NYX_HOSTILE }] },
    priority: SCENE_PRIORITY.payoff,
    repeatable: false,
    entry: [
      { when: { loop: { min: 5 } }, node: 'how_many' },
      { when: { all: [FROM_LOOP_3, { echo: 'echo_nyx_is_of_the_nine' }] }, node: 'true_name' },
      { when: { all: [] }, node: 'crossed' },
    ],
    nodes: [
      { id: 'crossed', tags: ['story'], speaker: NYX, text: 'You are standing differently. Something has crossed you.', next: 'stirs' },
      {
        id: 'stirs',
        tags: ['story'],
        speaker: NYX,
        text: 'The void stirs when you breathe. It knows you. I would like to know why.',
        choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE],
      },
      {
        id: 'true_name',
        tags: ['story'],
        speaker: NYX,
        text: "You have heard my true name. Don't deny it; you flinched when the Choir sang it wrong.",
        choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE],
      },
      {
        id: 'how_many',
        tags: ['story'],
        speaker: NYX,
        text: 'How many times, Wayfinder? Do not lie to me. I have counted forty years of this day and I can feel that you have counted more.',
        choices: [{ id: 'more', text: 'More than I can count.', next: 'both_old' }, I_KNOW_WHAT_YOU_ARE, NOTHING_MORE],
      },
      { id: 'both_old', tags: ['written'], speaker: NYX, text: 'Then we are both old in this day. Sit a while. The void remembers you; let it remember you resting.', next: 'end' },
    ],
  },

  // DESIGN §12.1 / STORY §7.3: after the shards are given at Weavers ≥ Neutral (any loop); or, unmasked, even with the shards
  // refused and the Weavers Wary. With `echo_choir_knows` she joins Wary (DESIGN §12.5's against-value cost; STORY §12). The
  // ask comes before her quest offers (the report band) until it is turned down once a loop; from then it waits behind them.
  walkWithMe('scene_nyx_walk_with_me', SCENE_PRIORITY.report, { not: { flag: 'flag_choice_scene_nyx_walk_with_me_no' } }, true),
  walkWithMe('scene_nyx_walk_with_me_again', SCENE_PRIORITY.waiting, { flag: 'flag_choice_scene_nyx_walk_with_me_no' }, false),

  // ---- q_tears_of_the_breach ------------------------------------------------------------------------------------------------
  {
    id: 'scene_nyx_tears_offer',
    npcId: NYX,
    title: 'Read a Shard',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, AT_CHASM, { not: NYX_HOSTILE }, stageOf('q_void_shards', 'given'), { not: { quest: { id: 'q_tears_of_the_breach' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'ear',
    nodes: [
      {
        id: 'ear',
        tags: ['written'],
        speaker: NYX,
        text: 'Three Shards, and you handed them over without once holding one to your ear. I will teach you to read one. Bring a Shard to the edge, at night, when the Chasm breathes slowest.',
        // STORY §12: `echo_shard_moments` is Shard-reading flavour
        textVariants: [{ when: { echo: 'echo_shard_moments' }, text: 'You hold your hands like someone who has read one. Bring a Shard to the edge, at night, when the Chasm breathes slowest, and we will see if the dark remembers you.' }],
        choices: offer('q_tears_of_the_breach', 'I will bring one.', 'Not yet.', 'where', 'refused'),
      },
      { id: 'where', tags: ['written'], speaker: NYX, text: 'The Stalkers in the Hollow carry them. So does the Shelf, if you can bear the Shelf. Come at night. By day the Chasm only breathes.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: NYX, text: 'Then keep your ears shut a while longer. The void is patient. It remembers.', next: 'end' },
    ],
  },
  {
    id: 'scene_nyx_tears_waiting',
    npcId: NYX,
    when: { all: [NOT_IN_HORDE, AT_CHASM, stageOf('q_tears_of_the_breach', 'shard_at_night')] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'night',
    nodes: [{ id: 'night', tags: ['written'], speaker: NYX, text: 'Night, Wayfinder, and a Shard in your hand. The Chasm breathes slowest then, and you can hear what is caught in it.', next: 'end' }],
  },
  // STORY §11.4 stages 2–3: hold the Shard while she speaks; a stair, a boy, a bell; ask whose moment it is; she does not answer.
  // Weavers +5; `echo_shard_moments`. The Shard held is not taken; the quest pays one.
  {
    id: 'scene_nyx_tears_reading',
    npcId: NYX,
    title: 'A torn moment',
    when: { all: [NOT_IN_HORDE, AT_CHASM, stageOf('q_tears_of_the_breach', 'read')] },
    priority: SCENE_PRIORITY.decision,
    entry: 'hold',
    nodes: [
      { id: 'hold', tags: ['written'], speaker: NYX, text: 'Hold it. Not to the light; to the ear. Now I speak, and you do not.', next: 'moment' },
      {
        id: 'moment',
        tags: ['written'],
        speaker: 'narrator',
        text: 'A stair. A boy on the third step, looking up. A bell that has not finished ringing. Then the Shard is a shard again, cold in your palm.',
        next: 'torn',
      },
      {
        id: 'torn',
        tags: ['written'],
        speaker: NYX,
        text: 'A moment, torn out of a night and kept. Every one of them is. The Choir calls them tears; they are not wrong, and they are not right.',
        onEnter: [{ grantEcho: 'echo_shard_moments' }],
        choices: [
          {
            id: 'whose',
            text: 'Whose moment is it?',
            effects: [{ rep: { faction: 'weavers', delta: 5 } }, { questAdvance: { quest: 'q_tears_of_the_breach', stage: 'unanswered' } }],
            next: 'no_answer',
          },
        ],
      },
      { id: 'no_answer', tags: ['written'], speaker: 'narrator', text: 'She does not answer. She looks at the Shard in your hand the way you would look at a door you shut yourself.', next: 'keep' },
      { id: 'keep', tags: ['written'], speaker: NYX, text: 'Keep that one. The void remembers where it was torn. Now so do you.', next: 'end' },
    ],
  },

  // ---- q_the_dark_between: the offer (she goes ahead to Where She Fell while it runs; her NPC schedule) ---------------------------
  {
    id: 'scene_nyx_dark_between_offer',
    npcId: NYX,
    title: 'A place no one enters',
    when: {
      all: [
        NOT_IN_HORDE,
        FROM_LOOP_2,
        AT_CHASM,
        { not: NYX_HOSTILE },
        { any: [{ quest: { id: 'q_tears_of_the_breach', status: 'completed' } }, { echo: 'echo_nine_voices' }] },
        { loyalty: { companion: 'nyx', min: 25 } },
        { not: { quest: { id: 'q_the_dark_between' } } },
      ],
    },
    priority: SCENE_PRIORITY.offer,
    entry: 'place',
    nodes: [
      {
        id: 'place',
        tags: ['written'],
        speaker: NYX,
        text: 'There is a place in the Veil I keep. No one enters it. The Weavers think it is warded, and it is, but not against them. I would like you to see it.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: NYX,
        text: 'Past the Orchard, north, where the glass is. I will go ahead. Come alone, or with whoever you trust more than the Choir.',
        choices: offer('q_the_dark_between', 'I will come.', 'Not yet.', 'ahead', 'refused'),
      },
      { id: 'ahead', tags: ['written'], speaker: NYX, text: 'Then I am already there.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: NYX, text: 'The glass keeps. So do I.', next: 'end' },
    ],
  },
  // STORY §13: the game's best twist, by either route — at Where She Fell by the quest (Sethe listening at the rim), or opened
  // from the Chasm by "I know what you are, Nyx" (the Crystal route; the quest's advance then waits for the quest).
  // `echo_nyx_is_of_the_nine`, `echo_litany_verse_8`; `echo_tyrant_name` when asked.
  {
    id: 'scene_nyx_unmasking',
    npcId: NYX,
    title: 'Nyxaria Vell',
    when: { all: [NOT_IN_HORDE, { location: 'loc_where_she_fell' }, stageOf('q_the_dark_between', 'names')] },
    priority: SCENE_PRIORITY.decision,
    entry: [
      { when: { location: 'loc_where_she_fell' }, node: 'crater' },
      { when: { all: [] }, node: 'listen' },
    ],
    nodes: [
      {
        id: 'crater',
        tags: ['story'],
        speaker: 'narrator',
        text: 'A crater of starlight glass with the print of a body in it. On the rim, nine names in chalk. Eight are crossed out. The ninth has been written and rubbed out and written again.',
        next: 'stop',
      },
      { id: 'listen', tags: ['story'], speaker: 'narrator', text: 'You hold the Crystal up and Listen, and the eighth voice fills the Chasm, and it is hers.', next: 'stop' },
      {
        id: 'stop',
        tags: ['story'],
        speaker: NYX,
        text: "Stop it. Stop it. ...There. Now you've heard it, and I can't un-say it, and you can't un-hear it. I was there.",
        choices: [{ id: 'nine', text: "You're one of the Nine.", next: 'vell' }],
      },
      {
        id: 'vell',
        tags: ['story'],
        speaker: NYX,
        text: 'Nyxaria Vell. Theorist of the Void. Eighth verse. "Open, and be entered." It did. I was the only one who\'d named the dark, so the dark took me by the name and threw me forward. Five hundred years. I came down in the Veil with nothing on and my teeth still humming, and I crawled to the Hollow.',
        onEnter: [{ grantEcho: 'echo_nyx_is_of_the_nine' }, { grantEcho: 'echo_litany_verse_8' }],
        choices: [{ id: 'tyrant', text: 'The Tyrant—', next: 'veyran' }],
      },
      {
        id: 'veyran',
        tags: ['story'],
        speaker: NYX,
        text: 'Is Veyran. Yes. He stepped in. He is holding it, Wayfinder, he has been holding it since I fell, and I have not gone to look at his face in forty years because I am a coward, and because I have a plan, and the plan is better than looking.',
        onEnter: [{ grantEcho: 'echo_tyrant_name' }],
        choices: [KEEP_SECRET, TELL_CHOIR, ASK_PLAN],
      },
      { id: 'plan_later', tags: ['written'], speaker: NYX, text: 'Not on the rim. Walk with me to the Hollow, where I came in, and I will say it where only the dark listens.', next: 'decide' },
      { id: 'decide', tags: ['written'], speaker: 'narrator', text: 'She waits for what you will do with her name.', choices: [KEEP_SECRET, TELL_CHOIR] },
      { id: 'kept', tags: ['written'], speaker: NYX, text: 'Then it is yours to keep, and mine to go on carrying. The void remembers you, Wayfinder. Tonight that is a compliment.', next: 'end' },
      {
        id: 'told',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Sethe steps in from the rim, lidless, and does not look at you. She looks at the seam on Nyx, and finds it, and sings one note. Nyx is gone from your side before it ends.',
        // the Crystal route: said at the Chasm, with the Choir a stair away
        textVariants: [{ when: { not: { location: 'loc_where_she_fell' } }, text: 'You will carry it down the stair to the Choir, and she knows it. She does not stop you. She is gone from your side before you reach the Hollow.' }],
        next: 'end',
      },
    ],
  },

  // ---- q_what_she_would_undo: the offer at the Chasm; the plan at the Hollow (her schedule) ---------------------------------------
  {
    id: 'scene_nyx_undo_offer',
    npcId: NYX,
    title: 'What she would undo',
    when: { all: [NOT_IN_HORDE, AT_CHASM, { not: NYX_HOSTILE }, { echo: 'echo_nyx_is_of_the_nine' }, NYX_LOYAL, { not: { quest: { id: 'q_what_she_would_undo' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'go_back',
    nodes: [
      {
        id: 'go_back',
        tags: ['written'],
        speaker: NYX,
        text: 'I want to go back. Not to the night; to the verse. To stand at the stone where I stood and say what Hallow said, and this time give them the reason.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: NYX,
        text: 'He has to be alive for it. The door is him. Come to the Hollow, where I came in, and I will show you the shape of it.',
        choices: offer('q_what_she_would_undo', 'Show me.', 'Not now.', 'hollow', 'refused'),
      },
      { id: 'hollow', tags: ['written'], speaker: NYX, text: 'The Hollow. Where the dark is thinnest, because it has already been through once.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: NYX, text: 'Then I keep carrying it. I am used to the weight.', next: 'end' },
    ],
  },
  // STORY §11.4 stages 2–3 and §7.3: the rule the plan rests on (D-067.13), `echo_what_she_would_undo`; then agree (Weavers +15,
  // the path to C), refuse with the truth (`echo_ritual_inevitable`: she breaks, then thanks you; at Weavers Trusted the Note of
  // Closing, `echo_void_resonance`), or refuse flatly (Weavers −10).
  {
    id: 'scene_nyx_undo_plan',
    npcId: NYX,
    title: 'The door is him',
    when: { all: [NOT_IN_HORDE, { location: 'loc_voidscar_hollow' }, stageOf('q_what_she_would_undo', 'plan')] },
    priority: SCENE_PRIORITY.decision,
    entry: 'door',
    nodes: [
      {
        id: 'door',
        tags: ['written'],
        speaker: NYX,
        text: 'Hear the rule first, because the whole of it rests there. The door to the past is him. It exists while he holds it, and not one breath longer.',
        onEnter: [{ grantEcho: 'echo_what_she_would_undo' }, { questAdvance: { quest: 'q_what_she_would_undo', stage: 'heard' } }],
        next: 'core',
      },
      {
        id: 'core',
        tags: ['written'],
        speaker: NYX,
        text: 'The Heartstone Core pries it wide. Kill him and it slams shut, and there is no past to go back to; only the dark he was holding out.',
        next: 'sixth',
      },
      {
        id: 'sixth',
        tags: ['written'],
        speaker: NYX,
        text: 'I go through. I stand at the stone at the sixth verse and I say what Hallow said, stop, with the reason he did not have. Then there is no Breach, no Tyrant, no you. Will you stand beside me?',
        choices: [
          {
            id: 'agreed',
            text: 'I will stand beside you.',
            effects: [{ rep: { faction: 'weavers', delta: 15 } }, ...loyaltyFor(['nyx']), { questAdvance: { quest: 'q_what_she_would_undo', stage: 'agreed' } }],
            next: 'agreed',
          },
          // STORY §13 (scene_ending_dawn) gives the Wayfinder's words for the truth
          echoLocked('echo_ritual_inevitable', {
            id: 'truth',
            text: "It was always going to fail. I've seen it.",
            effects: [
              { onlyIf: { when: WEAVERS_TRUSTED, effects: [{ grantEcho: 'echo_void_resonance' }] } },
              { questAdvance: { quest: 'q_what_she_would_undo', stage: 'refused_truth' } },
            ],
            next: 'breaks',
          }),
          {
            id: 'refused',
            text: 'No.',
            effects: [{ rep: { faction: 'weavers', delta: -10 } }, ...loyaltyFor([], ['nyx']), { questAdvance: { quest: 'q_what_she_would_undo', stage: 'refused' } }],
            next: 'flat',
          },
        ],
      },
      {
        id: 'agreed',
        tags: ['written'],
        speaker: NYX,
        text: 'Then we need the Core in your hand, the Choir sworn to us, and him alive when we reach the Apex. Do not be quick there. I have waited forty years for a door; I can wait for you.',
        next: 'end',
      },
      {
        id: 'breaks',
        tags: ['written'],
        speaker: 'narrator',
        text: 'She does not believe you. Then she does. She sits down on the scree with a Shard still in her hand, and for a while the Hollow is the only thing that breathes.',
        next: 'thanks',
      },
      {
        id: 'thanks',
        tags: ['written'],
        speaker: NYX,
        text: '...Thank you. No one has told me that in forty years. No one could.',
        // STORY §7.3: at Weavers Trusted she gives the Note of Closing anyway, "so that someone closes it who knows what it is"
        textVariants: [
          {
            when: WEAVERS_TRUSTED,
            text: '...Thank you. No one has told me that in forty years. No one could. Take the note, then. The Shards sing one note; it is the tear closing, not opening. Let someone close it who knows what it is.',
          },
        ],
        next: 'end',
      },
      {
        id: 'flat',
        tags: ['written'],
        speaker: NYX,
        text: 'No. ...Then I asked the wrong Wayfinder. There will be another. There is always another; that is the one thing I know about this day.',
        next: 'end',
      },
    ],
  },

  // ---- Nyx's side of q_unlidded_eye (D-109): her line in the Sanctum while Sethe's Eye is sought (her schedule puts her there) --
  {
    id: 'scene_nyx_sanctum_eye',
    npcId: NYX,
    when: { all: [NOT_IN_HORDE, { location: 'loc_sanctum_of_threads' }, { quest: { id: 'q_unlidded_eye', status: 'active' } }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'seam',
    nodes: [
      {
        id: 'seam',
        tags: ['written'],
        speaker: NYX,
        text: 'Sethe wants the eye of a warden, so she can look where I look. Let her. The seam is there; I have never pretended it was not. What she will not see is what is on the far side of it.',
        next: 'end',
      },
    ],
  },

  // ---- What she says at the lip when nothing is pending (the arc's state, latest first); the Echo line again --------------------
  {
    id: 'scene_nyx_chasm',
    npcId: NYX,
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, AT_CHASM] },
    priority: SCENE_PRIORITY.waiting,
    entry: [
      { when: NYX_HOSTILE, node: 'hostile' },
      { when: doneAt('q_what_she_would_undo', 'agreed'), node: 'undo_agreed' },
      { when: doneAt('q_what_she_would_undo', 'refused_truth'), node: 'undo_truth' },
      { when: doneAt('q_what_she_would_undo', 'refused'), node: 'undo_refused' },
      { when: doneAt('q_the_dark_between', 'kept'), node: 'dark_kept' },
      { when: doneAt('q_unlidded_eye', 'looked'), node: 'eye_looked' },
      { when: doneAt('q_unlidded_eye', 'warned'), node: 'eye_warned' },
      { when: { quest: { id: 'q_tears_of_the_breach', status: 'completed' } }, node: 'tears_done' },
      { when: { all: [] }, node: 'stirs' },
    ],
    nodes: [
      { id: 'hostile', tags: ['written'], speaker: NYX, text: 'You told them. Go down the stair, then; they will be glad of you. I will not.', next: 'end' },
      {
        id: 'undo_agreed',
        tags: ['written'],
        speaker: NYX,
        text: 'We go to the Apex together, and not before the Core is in your hand. I have waited forty years; I can wait for a stone.',
        choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE],
      },
      {
        id: 'undo_truth',
        tags: ['written'],
        speaker: NYX,
        text: 'I keep thinking about the version where I was not there. Go on, Wayfinder. I am still deciding what to do with my hands.',
        choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE],
      },
      { id: 'undo_refused', tags: ['written'], speaker: NYX, text: 'You said no. The void remembers that too.', choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE] },
      { id: 'dark_kept', tags: ['written'], speaker: NYX, text: 'The glass keeps my name. So do you. That is two more than I meant.', choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE] },
      {
        id: 'eye_looked',
        tags: ['written'],
        speaker: NYX,
        text: 'The Choir looks at me now. You let them. Do not ask me to be sorry in a way you can use.',
        choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE],
      },
      {
        id: 'eye_warned',
        tags: ['written'],
        speaker: NYX,
        text: 'You came to me first. I did not thank you. I am not going to; take it from the fact that I came back.',
        choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE],
      },
      {
        id: 'tears_done',
        tags: ['written'],
        speaker: NYX,
        text: 'You have read one Shard. Do not read them all. Some of those seconds are mine.',
        choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE],
      },
      {
        id: 'stirs',
        tags: ['story'],
        speaker: NYX,
        text: 'The void stirs when you breathe. It knows you. I would like to know why.',
        choices: [I_KNOW_WHAT_YOU_ARE, NOTHING_MORE],
      },
    ],
  },

  // ==== Nyx at camp (DESIGN §12.7; the companion record's campScenes) ===========================================================

  camp('scene_nyx_camp_1', 'She does not sleep', { companion: { id: 'nyx' } }, 1, 'awake', [
    {
      id: 'awake',
      tags: ['written'],
      speaker: 'nyx',
      text: 'I do not sleep. Do not let it trouble you; the dark sleeps for me, and it is a light sleeper. Ask what you are going to ask.',
      choices: [
        { id: 'why_walk', text: 'Why do you walk with me?', next: 'why' },
        { id: 'what_hear', text: 'What do you hear, when the void stirs?', next: 'hear' },
      ],
    },
    {
      id: 'why',
      tags: ['written'],
      speaker: 'nyx',
      text: 'Because the void remembers you, and it does not remember many. Because you go east, and I have not gone east in forty years. One of those is the reason. I have not decided which.',
      next: 'end',
    },
    {
      id: 'hear',
      tags: ['written'],
      speaker: 'nyx',
      text: 'A night. Always the same night, in pieces, and one of the pieces is a boy on a stair. I have told the Choir what they could bear. You, I think, can bear a little more. Not tonight.',
      next: 'end',
    },
  ]),
  camp('scene_nyx_camp_2', 'What they could bear', { all: [{ companion: { id: 'nyx' } }, { loyalty: { companion: 'nyx', min: 25 } }] }, 2, 'bear', [
    // STORY §7.3's sample, said whole
    { id: 'bear', tags: ['story'], speaker: 'nyx', text: 'I have told the Choir what they could bear. You, I think, can bear a little more.', next: 'eleven' },
    {
      id: 'eleven',
      tags: ['written'],
      speaker: 'nyx',
      text: 'They hold eleven thousand Shards and call them tears, and sing the eighth verse wrong every night, and I let them. A people need a wrong thing to be sure of. I gave them one. What I kept is worse.',
      choices: [
        { id: 'what_kept', text: 'What did you keep?', next: 'kept' },
        { id: 'why_let', text: 'Why let them be wrong?', next: 'let' },
      ],
    },
    {
      id: 'kept',
      tags: ['written'],
      speaker: 'nyx',
      text: 'That the far side of the tear is not power. It is a room with nine chairs and one of them pushed back. Sleep, Wayfinder. I will watch the fire; it is the one thing out here that is honest.',
      // after the unmasking she says who pushed the chair back
      textVariants: [
        {
          when: { echo: 'echo_nyx_is_of_the_nine' },
          text: 'That the far side of the tear is not power. It is a room with nine chairs and one of them pushed back. Mine. Sleep, Wayfinder. I will watch the fire; it is the one thing out here that is honest.',
        },
      ],
      next: 'end',
    },
    {
      id: 'let',
      tags: ['written'],
      speaker: 'nyx',
      text: 'Because the right thing has no handle on it. You cannot carry it down a stair, or sing it in a hall, or sell it to the Remnants for thread. Wrong things keep. I know; I have kept one for forty years.',
      next: 'end',
    },
  ]),
  camp(
    'scene_nyx_camp_3',
    'His face',
    { all: [{ companion: { id: 'nyx' } }, { loyalty: { companion: 'nyx', min: 50 } }, { echo: 'echo_nyx_is_of_the_nine' }] },
    3,
    'there',
    [
      // STORY §7.3's sample and her stance on the Tyrant, said whole
      { id: 'there', tags: ['story'], speaker: 'nyx', text: 'I was there. Do not ask me to be sorry in a way you can use.', next: 'ready' },
      {
        id: 'ready',
        tags: ['story'],
        speaker: 'nyx',
        text: 'I am not ready to see his face. I was never ready. That is why I am here and he is there.',
        choices: [
          { id: 'go_look', text: 'Come to the Apex and look.', next: 'look' },
          { id: 'stay', text: 'Then stay here, and let me look for you.', next: 'for_me' },
        ],
      },
      {
        id: 'look',
        tags: ['written'],
        speaker: 'nyx',
        text: 'When I have a reason to stand in front of him that is better than looking. Not before. He held the door for me; the least I owe him is a plan.',
        // STORY §12: `echo_what_she_would_undo`, her plan heard
        textVariants: [
          {
            when: { echo: 'echo_what_she_would_undo' },
            text: 'When I have a reason to stand in front of him that is better than looking. Not before. He held the door for me; the least I owe him is a plan. You have heard it. When the Core is in your hand, we go.',
          },
        ],
        next: 'end',
      },
      {
        id: 'for_me',
        tags: ['written'],
        speaker: 'nyx',
        text: 'Tell me if he is tired. No. Do not tell me. I know he is tired; I have known for forty years, and I sat on the lip of a hole and let him be.',
        next: 'end',
      },
    ],
  ),

  // ==== Dask at the Shimmering Pass ===============================================================================================

  // STORY §13: the first conversation; the warning only (D-067.16); "Come with me." recruits him (he explains the rule),
  // "Where are the other three of you?" starts `q_the_flickering_man`.
  {
    id: 'scene_dask_introduction',
    npcId: DASK,
    title: 'The Flickering Man',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, AT_PASS] },
    priority: SCENE_PRIORITY.offer,
    repeatable: false,
    entry: 'fractures',
    nodes: [
      { id: 'fractures', tags: ['story'], speaker: 'narrator', text: 'Light fractures into false paths, then snaps back into focus.', next: 'still_there' },
      { id: 'still_there', tags: ['story'], speaker: 'narrator', text: 'This time, when the light snaps back, he is still there.', next: 'see_me' },
      {
        id: 'see_me',
        tags: ['story'],
        speaker: DASK,
        text: "You can see me. You can— don't move, I lose you when you move. Seventy years. You're the first one who looked back.",
        choices: [{ id: 'who', text: 'Who are you?', next: 'scout' }],
      },
      {
        id: 'scout',
        tags: ['story'],
        speaker: DASK,
        text: "Dask. Scout. Was. Seventh of your lot, if the Remnants still count. You've got a thing round your neck that remembers; I'd have killed for that. Did, in a way.",
        next: 'skip',
      },
      {
        id: 'skip',
        tags: ['story'],
        speaker: DASK,
        text: "Listen, because I skip. Don't kill it. It knows my name. I'd tell you the rest but I'm in four places, mid-word, and this is the one that's talking.",
        choices: [{ id: 'what_do_i_do', text: 'Then what do I do?', next: 'not_what_i_did' }],
      },
      {
        id: 'not_what_i_did',
        tags: ['story'],
        speaker: DASK,
        text: 'Not what I did. Not what I nearly did either. Find the other three of me. One of them knows the end of the sentence.',
        choices: [
          { id: 'come', text: 'Come with me.', effects: [{ recruit: 'dask' }], next: 'rule' },
          { id: 'where', text: 'Where are the other three of you?', effects: [{ questStart: 'q_the_flickering_man' }], next: 'four' },
        ],
      },
      {
        id: 'rule',
        tags: ['written'],
        speaker: DASK,
        text: DASK_RULE,
        choices: [
          { id: 'where', text: 'Where are the other three of you?', effects: [{ questStart: 'q_the_flickering_man' }], next: 'four' },
          { id: 'later', text: 'Later.', next: 'end' },
        ],
      },
      {
        id: 'four',
        tags: ['written'],
        speaker: DASK,
        text: "The Spires. The Plateau, where the wind keeps the time. The Nexus, under the dome. Go up to each and stand still, and listen. I'm mid-word in all of them.",
        next: 'end',
      },
    ],
  },
  // DESIGN §12.1: Loop 2+, after the introduction, no quest needed
  {
    id: 'scene_dask_recruit',
    npcId: DASK,
    title: 'Company on the road',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, AT_PASS, { flag: 'flag_scene_done_scene_dask_introduction' }, { not: DASK_RECRUITED }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'still_here',
    nodes: [
      {
        id: 'still_here',
        tags: ['written'],
        speaker: DASK,
        text: "Still here. Still four of me; this one's the talker. You'll want company on that road, and I'd like to see where it goes for once.",
        choices: [
          { id: 'come', text: 'Come with me.', effects: [{ recruit: 'dask' }], next: 'rule' },
          { id: 'later', text: 'Later.', next: 'end' },
        ],
      },
      { id: 'rule', tags: ['written'], speaker: DASK, text: DASK_RULE, next: 'end' },
    ],
  },

  // ---- q_the_flickering_man: his three moments (STORY §11.4 stages 2–4; the pieces are STORY §13's whole sentence) -----------------
  moment(
    'spires',
    'loc_aetherium_spires',
    'He is here too, in the hum between the Spires, with one hand up. His mouth is in the middle of a word.',
    "It isn't guarding the door. It is the door.",
    'The word ends and so does he. The hand is still up when he goes.',
  ),
  moment(
    'plateau',
    'loc_sky_whisper_plateau',
    'On the Plateau the wind keeps the time, and he keeps the wind: a man in old leathers, half turned, mid-word.',
    "It's a man, or it was, holding a sentence shut with his teeth.",
    'The gust crosses and takes the rest of him with it. The markers go on ticking.',
  ),
  moment(
    'nexus',
    'loc_chronos_nexus',
    'Under the broken dome he stands where the orrery would show the Apex, facing it, a word already on its way out.',
    'I worked that out a second before the hold noticed me.',
    'The dome flickers between one tick and the next, and when it settles he is not in it.',
  ),
  {
    id: 'scene_dask_flickering_man_waiting',
    npcId: DASK,
    when: { all: [NOT_IN_HORDE, AT_PASS, { any: [stageOf('q_the_flickering_man', 'spires'), stageOf('q_the_flickering_man', 'plateau'), stageOf('q_the_flickering_man', 'nexus')] }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'warm',
    nodes: [
      {
        id: 'warm',
        tags: ['written'],
        speaker: DASK,
        text: "Three more of me out there, mid-word. Go and stand still in front of them. I'll keep this bit of the sentence warm.",
        next: 'end',
      },
    ],
  },
  // STORY §11.4 stage 5 and §13: the sentence, then the whole of it (said only once all four are found); `echo_flickering_man`
  {
    id: 'scene_dask_flickering_man_sentence',
    npcId: DASK,
    title: 'The whole sentence',
    when: { all: [NOT_IN_HORDE, AT_PASS, stageOf('q_the_flickering_man', 'sentence')] },
    priority: SCENE_PRIORITY.report,
    entry: 'all_four',
    nodes: [
      {
        id: 'all_four',
        tags: ['written'],
        speaker: DASK,
        text: "You found them. All four, then. Hells. Hold still; I've got the whole of it now and I don't know how long I've got it for.",
        next: 'the_sentence',
      },
      { id: 'the_sentence', tags: ['story'], speaker: DASK, text: "Don't kill it; it's the only thing holding the door, and I think it knows my name.", next: 'whole' },
      {
        id: 'whole',
        tags: ['story'],
        speaker: DASK,
        text: "It isn't guarding the door. It is the door. It's a man, or it was, holding a sentence shut with his teeth. I worked that out a second before the hold noticed me. Someone could take his place. Someone who knew the words. Not me; I'm not anywhere long enough.",
        onEnter: [{ grantEcho: 'echo_flickering_man' }, { questAdvance: { quest: 'q_the_flickering_man', stage: 'heard' } }],
        next: 'badge',
      },
      {
        id: 'badge',
        tags: ['written'],
        speaker: DASK,
        text: "Take the badge. Scout's. It kept me pointed at the right hour once; it'll do the same for you, and the Pass won't lie to you about the path again.",
        next: 'end',
      },
    ],
  },

  // ---- q_the_last_instant: the ask at the Pass; his choice at the Apex (his schedule) ---------------------------------------------
  {
    id: 'scene_dask_last_instant_offer',
    npcId: DASK,
    title: 'One instant',
    when: { all: [NOT_IN_HORDE, AT_PASS, { echo: 'echo_tyrant_speaks' }, { loyalty: { companion: 'dask', min: 50 } }, { not: { quest: { id: 'q_the_last_instant' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'gather',
    nodes: [
      {
        id: 'gather',
        tags: ['written'],
        speaker: DASK,
        text: "It spoke to you. It's known my name seventy years; I think it could gather me. One instant, all of me in it, the way a hand closes.",
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: DASK,
        text: "I can't ask it. Asking's letting go of something, and I'm not holding anything. You are. Ask it for me, at the end, when it's listening. Will you?",
        choices: offer('q_the_last_instant', 'I will ask it.', 'Not yet.', 'see_the_door', 'refused'),
      },
      {
        id: 'see_the_door',
        tags: ['written'],
        speaker: DASK,
        text: "Then let's go and see the door. I'd like to be there when you ask. I'd like to be anywhere, properly, once.",
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: DASK, text: "Fair. It's a lot to ask for a man who's mostly elsewhere.", next: 'end' },
    ],
  },
  {
    id: 'scene_dask_last_instant_waiting',
    npcId: DASK,
    when: { all: [NOT_IN_HORDE, AT_PASS, stageOf('q_the_last_instant', 'ask_it')] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'loose_way',
    nodes: [
      {
        id: 'loose_way',
        tags: ['written'],
        speaker: DASK,
        text: "The Apex. Walk me there the loose way, by the Spires, or I'll drop out on the swamp and meet you under the dome.",
        next: 'end',
      },
    ],
  },
  // STORY §11.4 stage 3 / §7.4: A — he rests (`echo_dask_rest`); B — he stays "until it's done" (`flag_dask_anchor`, D-067.8)
  {
    id: 'scene_dask_last_instant_choice',
    npcId: DASK,
    title: 'The last instant',
    when: { all: [NOT_IN_HORDE, { location: 'loc_temporal_breach_apex' }, stageOf('q_the_last_instant', 'gathered')] },
    priority: SCENE_PRIORITY.decision,
    entry: 'said_yes',
    nodes: [
      {
        id: 'said_yes',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The chorus has gone quiet. Under it, the one voice said yes, the way it says everything: as if it cost a day.',
        next: 'one_thing',
      },
      {
        id: 'one_thing',
        tags: ['written'],
        speaker: DASK,
        text: "It can do it. I felt it start; every bit of me leaned the same way for once. So. Rest, and be one thing for about a second, and then nothing. Or stay, flickering, till it's done. Your call, or mine?",
        choices: [
          {
            id: 'rest',
            text: "Rest. You've earned the one second.",
            effects: [{ grantEcho: 'echo_dask_rest' }, { dismiss: 'dask' }, { questAdvance: { quest: 'q_the_last_instant', stage: 'rests' } }],
            next: 'afternoon',
          },
          {
            id: 'stay',
            text: "Stay. Until it's done.",
            effects: [{ setFlag: 'flag_dask_anchor' }, { questAdvance: { quest: 'q_the_last_instant', stage: 'stays' } }],
            next: 'until',
          },
        ],
      },
      // STORY §7.4's sample, his last words
      { id: 'afternoon', tags: ['story'], speaker: DASK, text: "Seventy years. Felt like an afternoon. A long one. Don't do what I did. Don't do what I nearly did either.", next: 'gathered' },
      { id: 'gathered', tags: ['written'], speaker: 'narrator', text: 'Then he is in one place, and the hour closes on it like a hand. The chorus is one voice quieter.', next: 'end' },
      { id: 'until', tags: ['written'], speaker: DASK, text: "Until it's done, then. I'll be about. Not anywhere, but about.", next: 'end' },
    ],
  },

  // ---- What he says in the cleft when nothing is pending -------------------------------------------------------------------------
  {
    id: 'scene_dask_pass',
    npcId: DASK,
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, AT_PASS] },
    priority: SCENE_PRIORITY.waiting,
    entry: [
      { when: doneAt('q_the_last_instant', 'stays'), node: 'about' },
      { when: { quest: { id: 'q_the_flickering_man', status: 'completed' } }, node: 'met_them' },
      { when: { all: [] }, node: 'same_temperature' },
    ],
    nodes: [
      { id: 'about', tags: ['written'], speaker: DASK, text: "Still about. Told you. The door's holding and so am I, which is one more than I expected.", next: 'end' },
      { id: 'met_them', tags: ['written'], speaker: DASK, text: "Four of me and you've met the lot. That's more than I managed. Don't kill it, mind. I know I said. I'll keep saying.", next: 'end' },
      {
        id: 'same_temperature',
        tags: ['written'],
        speaker: DASK,
        text: "Cleft's always the same temperature. Seventy years and I've never once been cold in it. That's the one thing I'd keep.",
        next: 'end',
      },
    ],
  },

  // ==== Dask on the Still Shore (Loop 3+; WORLD §3.12; STORY §10.7) ===============================================================

  {
    id: 'scene_dask_shore',
    npcId: DASK,
    when: { all: [NOT_IN_HORDE, FROM_LOOP_3, AT_THE_THRESHOLD] },
    priority: SCENE_PRIORITY.idle,
    entry: [
      { when: { echo: 'echo_wayfinder_symptom' }, node: 'eighth_kept' },
      { when: DASK_KNOWS_YOU, node: 'nicer' },
      { when: { all: [] }, node: 'stranger' },
    ],
    nodes: [
      { id: 'eighth_kept', tags: ['written'], speaker: DASK, text: "Eighth frame's still empty, last I looked. Good. Keep it that way as long as you can stand to.", next: 'end' },
      // STORY §10.7: at the water's edge
      { id: 'nicer', tags: ['story'], speaker: DASK, text: 'So this is where you go. Huh. Nicer than mine.', next: 'end' },
      {
        id: 'stranger',
        tags: ['written'],
        speaker: DASK,
        text: "You're new. Or I am; hard to tell on this sand. Stand still a minute. The water shows what happened, if you can stand to watch it.",
        next: 'end',
      },
    ],
  },
  // ---- q_seven_marks: the offer on the Shore; the Gallery (its event); the symptom on the Shore; the eighth frame at the Stair ----
  {
    id: 'scene_dask_seven_marks_offer',
    npcId: DASK,
    title: 'Seven marks',
    when: {
      all: [NOT_IN_HORDE, FROM_LOOP_3, AT_THE_THRESHOLD, { echo: 'echo_threshold' }, DASK_KNOWS_YOU, { not: { echo: 'echo_wayfinder_symptom' } }, { not: { quest: { id: 'q_seven_marks' } } }],
    },
    priority: SCENE_PRIORITY.offer,
    entry: 'frames',
    nodes: [
      {
        id: 'frames',
        tags: ['written'],
        speaker: DASK,
        text: "There's a hall of paintings down the sand. Every one of them's you. Seven have a scratch in the gilt, low on the left, where a hand rests. I know where six came from.",
        next: 'seventh',
      },
      {
        id: 'seventh',
        tags: ['written'],
        speaker: DASK,
        text: "The seventh's mine. Year 430; I'd just worked out what it was and I wanted somebody to know I'd been. Go and look at them. Then come and tell me what you make of the eighth. Will you?",
        choices: offer('q_seven_marks', 'I will look.', 'Not now.', 'low_left', 'refused'),
      },
      { id: 'low_left', tags: ['written'], speaker: DASK, text: "Low on the left. Don't hurry; the hall's as long as it needs to be.", next: 'end' },
      { id: 'refused', tags: ['written'], speaker: DASK, text: "They'll keep. Paint keeps better than people.", next: 'end' },
    ],
  },
  {
    id: 'scene_dask_seven_marks_waiting',
    npcId: DASK,
    when: { all: [NOT_IN_HORDE, AT_THE_THRESHOLD, stageOf('q_seven_marks', 'six_known')] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'count',
    nodes: [{ id: 'count', tags: ['written'], speaker: DASK, text: 'Down the sand, west. Seven scratches. Count them for me; I never could get past my own.', next: 'end' }],
  },
  // STORY §11.4 / the codex's "We're not chosen. We're a symptom." said on the sand: `echo_wayfinder_symptom`
  {
    id: 'scene_dask_seven_marks_symptom',
    npcId: DASK,
    title: 'A symptom',
    when: { all: [NOT_IN_HORDE, AT_THE_THRESHOLD, stageOf('q_seven_marks', 'marks_seen')] },
    priority: SCENE_PRIORITY.report,
    entry: 'eighth',
    nodes: [
      {
        id: 'eighth',
        tags: ['written'],
        speaker: DASK,
        text: "Seven, and the eighth frame's clean. You saw it. Seven of us walked up to that door, and every one of us thought we'd been sent.",
        next: 'symptom',
      },
      {
        id: 'symptom',
        tags: ['written'],
        speaker: DASK,
        text: "We weren't. We're not chosen. We're a symptom. The hold weakens and the land runs a fever, and the fever's a person with the lines in them. Nothing picked us. Nothing's that organised.",
        onEnter: [{ grantEcho: 'echo_wayfinder_symptom' }, { questAdvance: { quest: 'q_seven_marks', stage: 'high_mark' } }],
        next: 'freeing',
      },
      {
        id: 'freeing',
        tags: ['written'],
        speaker: DASK,
        text: "That's the freeing part, if you want it. Nobody's waiting on you to be what they meant. Come up to the High Mark with me next time round, where the wind keeps the stair, and I'll show you what I'd cut for the eighth.",
        next: 'end',
      },
    ],
  },
  {
    id: 'scene_dask_seven_marks_eighth',
    npcId: DASK,
    title: 'The eighth frame',
    when: { all: [NOT_IN_HORDE, { location: 'loc_windward_stair' }, stageOf('q_seven_marks', 'high_mark')] },
    priority: SCENE_PRIORITY.decision,
    entry: 'knife',
    nodes: [
      {
        id: 'knife',
        tags: ['written'],
        speaker: 'narrator',
        text: "He has a scout's knife out and the rock in front of him, and the wind decides where his hand goes. He cuts four lines. A frame, the size of a hand, with nothing in it.",
        next: 'blank',
      },
      {
        id: 'blank',
        tags: ['written'],
        speaker: DASK,
        text: "Eighth. That's yours, or it's nobody's. I'm not putting a mark in it; you'll do that or you won't. Either way it's the first one that's a choice.",
        onEnter: [{ questAdvance: { quest: 'q_seven_marks', stage: 'eighth_blank' } }],
        next: 'end',
      },
    ],
  },

  // ==== Dask at camp (DESIGN §12.7, §12.8: the Pass, the Nexus) =================================================================

  camp('scene_dask_camp_1', 'The fire does the sleeping', { companion: { id: 'dask' } }, 1, 'no_sleep', [
    {
      id: 'no_sleep',
      tags: ['written'],
      speaker: 'dask',
      text: "I don't sleep. Haven't since 430. I sit, and the fire does the sleeping, and about once a watch I'm somewhere else for the length of a word. Ask; I'm here for a bit.",
      choices: [
        { id: 'four_places', text: "What's it like, being in four places?", next: 'four' },
        { id: 'wayfinder', text: 'What was it like, being a Wayfinder?', next: 'pull' },
      ],
    },
    {
      id: 'four',
      tags: ['written'],
      speaker: 'dask',
      text: "Like being interrupted. By yourself, mostly. You start a thing and another of you's already at the end of it, and neither of you gets the middle. I've had seventy years of middles.",
      next: 'end',
    },
    {
      id: 'pull',
      tags: ['written'],
      speaker: 'dask',
      text: "Like a hand in the small of the back. Hearthring to the Ruins, the Ruins to the east, east to the door. I thought it was a calling. It was a direction. There's a difference, and I found it out late.",
      next: 'end',
    },
  ]),
  camp('scene_dask_camp_2', 'The thing round your neck', { all: [{ companion: { id: 'dask' } }, { loyalty: { companion: 'dask', min: 25 } }] }, 2, 'remembers', [
    // STORY §7.4's sample, said whole
    {
      id: 'remembers',
      tags: ['story'],
      speaker: 'dask',
      text: "You've got a thing round your neck that remembers. I'd have killed for that. Did, in a way.",
      choices: [
        { id: 'what_did', text: 'What did you do?', next: 'reflex' },
        { id: 'nearly_did', text: 'What did you nearly do?', next: 'nearly' },
      ],
    },
    {
      id: 'reflex',
      tags: ['written'],
      speaker: 'dask',
      text: "Walked up to it and started talking. I'd worked out what it was, see, and I wanted to tell it I knew. It's got a reflex, like a knee. That's all it was. A reflex, and seventy years.",
      next: 'end',
    },
    {
      id: 'nearly',
      tags: ['written'],
      speaker: 'dask',
      text: "What I nearly did was worse. I had my hand on my knife and I thought, a man could end this. I didn't know what this was yet. Nearly's the only thing that saved it, and nearly's not a thing I'd lean on twice.",
      next: 'end',
    },
  ]),
  camp('scene_dask_camp_3', 'Someone who knew the words', { all: [{ companion: { id: 'dask' } }, { loyalty: { companion: 'dask', min: 50 } }] }, 3, 'ashamed', [
    {
      id: 'ashamed',
      tags: ['written'],
      speaker: 'dask',
      text: "Somebody could take his place. I've said it to three of you; you're the one that stood still for it. It should be me. I know the words. I'm not anywhere long enough to say them, and I'm ashamed of that, if you want the truth.",
      // STORY §7.4: he will not speak to Nyx until she has admitted what she is in his hearing
      textVariants: [
        {
          when: { echo: 'echo_nyx_is_of_the_nine' },
          text: "Somebody could take his place. I've said it to three of you; you're the one that stood still for it. It should be me. I know the words. I'm not anywhere long enough to say them, and I'm ashamed of that, if you want the truth. The Weaver woman knows them too. She hasn't said so where I can hear; till she does I've nothing to say to her.",
        },
      ],
      choices: [
        { id: 'not_shame', text: "It's not a thing to be ashamed of.", next: 'kind' },
        { id: 'who_then', text: 'Then who?', next: 'who' },
      ],
    },
    {
      id: 'kind',
      tags: ['written'],
      speaker: 'dask',
      text: "Kind of you. Wrong, but kind. Seven of us went up that road and one of us had the sense to stop and ask, and it still wasn't enough. Get some sleep. I'll be here, mostly.",
      next: 'end',
    },
    {
      id: 'who',
      tags: ['written'],
      speaker: 'dask',
      text: "Someone who knew the words and had the neck for the door. That's a short list, and you're standing on it. Don't look like that. I didn't say you had to. I said you could, which is the thing nobody said to me.",
      next: 'end',
    },
  ]),
] satisfies DialogueSceneInput[];
