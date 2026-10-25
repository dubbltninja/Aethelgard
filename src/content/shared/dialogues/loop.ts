// The scenes of the four loop-only quests (STORY §11.5; §9.4 the ritual's four attempts and Masque's line; §13 Oriel's carrel;
// §2.3's verses; BIBLE §3 the voices: Dray dated, precise, dry, citing years; Veyran kind, certain, a mind large enough to
// hold anything; Hallow forge-plain, "held is not the same as holding"; Oriel a voice like a page turning; Masque has read it
// twice). The quests are ../quests/loop.ts; the conventions are this folder's index.ts (U52's pattern, D-105, D-109).
//
// Who says what, and when (priority bands from ./common.ts; every NPC scene is closed while the Horde runs; a scene with no
// `npcId` is opened by a place — the region's locations.ts names the event, each a listed edit):
//   Dray     scene_dray_thirtieth_dawn_offer (the `offer` band, behind Dray's standing Ledger and Keeper's Price offers; a refusal steps aside for the loop) ·
//            _waiting · _report (the count against the water) · _after
//   place    scene_depths_count_beats (the Depths' `ev_depths_count_beats`: one watch counting)
//   Veyran   scene_ritual_warn_veyran (the Hall, First or Second Bell; attempt 1)
//   Hallow   scene_ritual_keep_hallow (his field-forge, or the plinths on Last Bell; attempt 2: `echo_hallow_said_stop`, verse IV)
//   place    scene_ritual_steal_record (the Archives' `ev_archives_fair_copy`; attempt 3) · scene_ritual_break_cradle (the
//            Conflux's `ev_conflux_cradle`; attempt 4) · scene_masque_roof (the Hall's `ev_hall_masque_roof`, Last Bell, once
//            the four are done: `echo_ritual_inevitable`, verse VII)
//   place    scene_oriel_carrel_again (the Archives' `ev_archives_oriel_carrel`: the ring or the Amulet; the scroll; verse I)
//
// STORY gives these quests their beats, their first journals and a handful of lines (Veyran's "Now I know", Hallow's iron,
// Masque's "You see it too now", Oriel's "Let it be written", verses I, IV, VII); every other line is written (tag `written`,
// in the speaker's BIBLE voice, listed in the U58 reply and pinned by tests/unit/content/quests/loop.test.ts).
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY, type ChoiceInput } from './common';

const DRAY = 'npc_ansel_dray';
const VEYRAN = 'npc_veyran_thal';
const HALLOW = 'npc_durn_hallow';
const ORIEL = 'cr_drowned_archivist';
const MASQUE = 'npc_tovren_masque';

const DAWN = 'q_the_thirtieth_dawn';
const RITUAL = 'q_stop_the_ritual';
const DROWNED = 'q_the_first_drowned';

const stageOf = (id: `q_${string}`, stage: string): Condition => ({ quest: { id, stage } });
const active = (id: `q_${string}`): Condition => ({ quest: { id, status: 'active' } });
const completed = (id: `q_${string}`): Condition => ({ quest: { id, status: 'completed' } });
const notStarted = (id: `q_${string}`): Condition => ({ not: { quest: { id } } });

/** STORY §2.3's verses, as the regional and companion files carry them (verse I: companions_u54.ts; verse IV: regional.ts). */
const VERSE_ONE = 'Let it be written as it is done.\nLet the hand fail and the word stand.\nWhat we do here, we do before the stone.';
const VERSE_FOUR = 'Iron that does not wish, hold the heart.\nTake the weight and do not want it.\nWhat the hand would grasp, let the cradle only carry.';
const VERSE_SEVEN = 'Read the sky before it is written.\nSee the hour from its far side.\nTell us true, and we will not turn away.';

/** The giver's ask: a yes that starts the quest, a no that goes to the refusal line (once a loop: the refusal steps aside). */
const offer = (questId: `q_${string}`, yes: string, no: string, afterYes: string, refused: string): ChoiceInput[] => [
  { id: 'yes', text: yes, effects: [{ questStart: questId }], next: afterYes },
  { id: 'no', text: no, oncePerLoop: true, next: refused },
];

/** An attempt of the ritual: the quest at `try`, the scene not yet played this loop (its done flag is the objective). */
const attempt = (sceneId: string, more: Condition[] = []): Condition => ({ all: [NOT_IN_HORDE, stageOf(RITUAL, 'try'), { not: { flag: `flag_scene_done_${sceneId}` } }, ...more] });

export const dialogues = [
  // ==== Keeper Dray · q_the_thirtieth_dawn ====================================================================================

  // STORY §11.5: the water-clock and the pulse drifting apart. The `offer` band: Dray's standing Ledger offer (U53's, first in
  // content order) and the Keeper's Price (U54's) win the tie while they stand (D-113's rule; listed in the reply), and this
  // one comes up once they are taken or out of reach; a refusal once a loop steps it aside
  {
    id: 'scene_dray_thirtieth_dawn_offer',
    npcId: DRAY,
    title: 'The drift',
    when: { all: [NOT_IN_HORDE, { any: [{ echo: 'echo_thirtieth_dawn' }, { echo: 'echo_breach_clock' }, FROM_LOOP_2] }, notStarted(DAWN), { not: { flag: 'flag_choice_scene_dray_thirtieth_dawn_offer_no' } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'ashcombe',
    nodes: [
      {
        id: 'ashcombe',
        tags: ['written'],
        speaker: DRAY,
        text: "Pell Ashcombe set a water-clock in the Scriptorium in 309 and timed the Heartstone's pulse against it. Thirty, he wrote, from the first dawn. Nobody understood what the thirty was.",
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: DRAY,
        text: 'I have run his clock again. The stone and the water are drifting apart, and I want to know by how much. Go down to the Depths and count the beats for one watch. One watch, no more. Will you count?',
        choices: offer(DAWN, 'I will count.', 'Not now.', 'agree', 'refused'),
      },
      {
        id: 'agree',
        tags: ['written'],
        speaker: DRAY,
        text: 'I count by the water. You count by the stone. We will see which of us the hour agrees with.',
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: DRAY, text: 'Then it drifts uncounted. It has managed five hundred years of that; it will manage one more.', next: 'end' },
    ],
  },
  {
    id: 'scene_dray_thirtieth_dawn_waiting',
    npcId: DRAY,
    when: { all: [NOT_IN_HORDE, active(DAWN), { not: stageOf(DAWN, 'compare') }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['written'], speaker: DRAY, text: 'One watch at the Depths, counting. Do not round. Ashcombe rounded, in 309, and lost a day he never found again.', next: 'end' }],
  },
  // STORY §11.5 stage 3: "Compare at the Library: the number is the days remaining"; `echo_breach_clock` is the quest's reward
  {
    id: 'scene_dray_thirtieth_dawn_report',
    npcId: DRAY,
    title: 'The count against the water',
    when: { all: [NOT_IN_HORDE, stageOf(DAWN, 'compare')] },
    priority: SCENE_PRIORITY.report,
    entry: 'number',
    nodes: [
      { id: 'number', tags: ['written'], speaker: DRAY, text: 'Give me the number. No; do not tell me what you make of it. The number.', next: 'margin' },
      {
        id: 'margin',
        tags: ['written'],
        speaker: DRAY,
        text: 'Set against the water, that is the count of dawns the hour has left. Not thirty from today. Thirty from the first, less what the stone has already spent. I am writing it in the margin, where Ashcombe wrote his.',
        next: 'clock',
      },
      {
        id: 'clock',
        tags: ['written'],
        speaker: DRAY,
        text: 'You will see it now wherever you are: the Breach keeps a clock, and the clock keeps you. Every hour it loses or gains, you will feel in your teeth. I am sorry for that. I would rather know.',
        onEnter: [{ questAdvance: { quest: DAWN, stage: 'done' } }],
        next: 'end',
      },
    ],
    companionReactions: [{ companionId: 'ilyra', text: 'Ilyra: "Thirty. He wrote it on the Ledger\'s first page in a hand I know, Wayfinder, and I never once asked what it counted."' }],
  },
  {
    id: 'scene_dray_thirtieth_dawn_after',
    npcId: DRAY,
    when: { all: [NOT_IN_HORDE, completed(DAWN)] },
    priority: SCENE_PRIORITY.after,
    entry: 'margin',
    nodes: [{ id: 'margin', tags: ['written'], speaker: DRAY, text: 'The margin has the number in it now. I have checked it twice since you went. It is not getting larger.', next: 'end' }],
  },
  // The Depths (its `ev_depths_count_beats`, while the quest stands at `count`): one watch in the counting
  {
    id: 'scene_depths_count_beats',
    title: 'One watch, counting',
    entry: 'still',
    nodes: [
      {
        id: 'still',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You stand still by the ninth plinth and count. The stone beats slow, then slower, then not quite where you expect it. The lamp burns down a finger while you keep the tally.',
        onEnter: [{ passWatches: 1 }],
        next: 'number',
      },
      {
        id: 'number',
        tags: ['written'],
        speaker: 'narrator',
        text: 'A watch has gone by in the counting. You have a number, and it is smaller than the one the water would give.',
        onEnter: [{ questAdvance: { quest: DAWN, stage: 'compare' } }],
        next: 'end',
      },
    ],
  },

  // ==== Silverwood Before · q_stop_the_ritual (STORY §9.4) ===================================================================

  // Attempt 1 — warn Veyran (the Hall, First or Second Bell: his schedule). STORY: "He listens courteously. 'You have seen it
  // fail. Then you have seen the version in which I did not know. Now I know.' He begins the ritual anyway." Verse IX heard.
  {
    id: 'scene_ritual_warn_veyran',
    npcId: VEYRAN,
    title: 'Now I know',
    when: attempt('scene_ritual_warn_veyran'),
    priority: SCENE_PRIORITY.decision,
    repeatable: false,
    entry: 'letter',
    nodes: [
      {
        id: 'letter',
        tags: ['written'],
        speaker: VEYRAN,
        text: 'You again. The one who is not from the year. Sit; the chair is Hadrek\'s, and he will not mind. You have the look of someone carrying a letter they do not want to hand over. Hand it over.',
        choices: [
          { id: 'warn', text: 'The ritual fails. The Heartstone bursts its cradle at the ninth verse. I have seen it.', next: 'courteous' },
          { id: 'not_yet', text: 'Not yet.', next: 'end' },
        ],
      },
      {
        id: 'courteous',
        tags: ['written'],
        speaker: 'narrator',
        text: 'He listens the whole way through, as a man listens to an apprentice who has worked very hard on something wrong. He does not interrupt once.',
        next: 'know',
      },
      {
        id: 'know',
        tags: ['story'],
        speaker: VEYRAN,
        text: 'You have seen it fail. Then you have seen the version in which I did not know. Now I know.',
        next: 'draft',
      },
      {
        id: 'draft',
        tags: ['written'],
        speaker: VEYRAN,
        text: 'The Holding is a kindness to the hour. A mind that knows where the stone cracks can hold the crack shut. Here: the ninth, as I will say it. Hour, stay. Be as you are, and do not become. I hold you. You see that the last line is mine to carry. Nobody else will have to.',
        onEnter: [{ grantEcho: 'echo_litany_verse_9' }],
        next: 'anyway',
      },
      {
        id: 'anyway',
        tags: ['written'],
        speaker: 'narrator',
        text: 'He begins it anyway, at dusk on Last Bell, certain that knowing is the difference. It is not. It fails identically, and the bell cracks on the first toll, and you are three days before it again.',
        next: 'end',
      },
    ],
  },
  // Attempt 2 — keep Hallow in the circle (his field-forge, First or Second Bell; the plinths, Last Bell). STORY: "He stays. The
  // sixth verse cracks the stone. Nothing changes except that Hallow dies in the tear instead of on the Peaks, and the Ironclad
  // never exist." `echo_hallow_said_stop`; verse IV heard.
  {
    id: 'scene_ritual_keep_hallow',
    npcId: HALLOW,
    title: 'Held is not holding',
    when: attempt('scene_ritual_keep_hallow'),
    priority: SCENE_PRIORITY.decision,
    repeatable: false,
    entry: 'cradle',
    nodes: [
      {
        id: 'cradle',
        tags: ['written'],
        speaker: HALLOW,
        text: "Mind the quench. You're standing where the water goes. If you've come to ask about the cradle, it's iron, it's fitted, and it doesn't want anything, which is more than I can say for the rest of them.",
        choices: [
          { id: 'stay', text: 'When the stone cracks at the sixth verse, you will say stop and walk out. Stay in the circle instead.', next: 'how' },
          { id: 'not_yet', text: 'Not yet.', next: 'end' },
        ],
      },
      {
        id: 'how',
        tags: ['written'],
        speaker: HALLOW,
        text: "...How do you know what I'll say. No. Don't tell me; you've got the Breach in your eyes and I've seen what it does to a man who looks too long. I'll stay. You've asked, and nobody asks a smith anything but the price.",
        next: 'verse',
      },
      { id: 'verse', tags: ['story'], speaker: HALLOW, text: VERSE_FOUR, onEnter: [{ grantEcho: 'echo_litany_verse_4' }], next: 'stays' },
      {
        id: 'stays',
        tags: ['written'],
        speaker: 'narrator',
        text: 'He stays. At dusk on Last Bell the sixth verse cracks the stone with a sound like a tooth breaking, and he says stop, and Veyran says it holds, and this time Hallow does not climb the stair. Nine stand at the ninth verse. The tear takes him with the rest.',
        next: 'hollow',
      },
      {
        id: 'hollow',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Nothing changes but this: no ember is carried north, no cairn is raised on the Steppe, and the Ironclad never exist. You wake three days before it with his stop still in your ears and a hollow where a people was, and the echo fills the hollow back in as if it had never emptied.',
        onEnter: [{ grantEcho: 'echo_hallow_said_stop' }],
        next: 'end',
      },
    ],
  },
  // Attempt 3 — steal the Litany (the Archives' `ev_archives_fair_copy`). STORY: "Oriel's record is taken; the Nine speak it from
  // memory. The Crystal records the player's footsteps leaving."
  {
    id: 'scene_ritual_steal_record',
    title: 'The fair copy',
    entry: 'desk',
    nodes: [
      {
        id: 'desk',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The fair copy lies on the desk by the stair, nine verses in a hand you know from another woman, the ink of the last line not yet dry. Nobody is watching it. Someone should, in case.',
        choices: [
          { id: 'take', text: 'Take the record.', next: 'memory' },
          { id: 'leave', text: 'Leave it.', next: 'end' },
        ],
      },
      {
        id: 'memory',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You take it. At dusk on Last Bell the Nine go down the stair without it and speak the Litany from memory, every word, because they wrote it. Oriel sets the Crystal on its stand with empty hands.',
        next: 'footsteps',
      },
      {
        id: 'footsteps',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The Crystal records nine voices, as it always does, and one thing more that it never did before: your footsteps, leaving. Five hundred years from now someone will hold it up and hear you go.',
        next: 'end',
      },
    ],
  },
  // Attempt 4 — break the cradle (the Conflux's `ev_conflux_cradle`). STORY: "Hallow's iron holds. 'Iron that does not wish.' It
  // cannot be broken by wanting to."
  {
    id: 'scene_ritual_break_cradle',
    title: 'Iron that does not wish',
    entry: 'iron',
    nodes: [
      {
        id: 'iron',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The cradle is nine bands of iron around the Heartstone, pinned at the rim. With the cradle broken there is no ritual: the stone cannot be held, so it cannot be asked to stay.',
        choices: [
          { id: 'break', text: 'Break it.', next: 'holds' },
          { id: 'leave', text: 'Leave it.', next: 'end' },
        ],
      },
      {
        id: 'holds',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You put your whole weight on the bands, and your blade in the pin-seam, and then your shoulder, and then everything you want in the world. Hallow\'s iron holds. The pin does not shine. It does not even warm.',
        next: 'wish',
      },
      { id: 'wish', tags: ['story'], speaker: 'narrator', text: 'Iron that does not wish.', next: 'wanting' },
      {
        id: 'wanting',
        tags: ['written'],
        speaker: 'narrator',
        text: 'It cannot be broken by wanting to. That is the whole of what it was made for. At dusk on Last Bell the Nine take their places around iron that has not noticed you, and it fails as it fails.',
        next: 'end',
      },
    ],
  },
  // The sixth beat (the Hall's `ev_hall_masque_roof`, Last Bell, the four attempts done). STORY §9.4: Masque, from the dome: "You
  // see it too now. From the far side. It was always going to fail, and we were always going to do it." → `echo_ritual_inevitable`;
  // verse VII heard.
  {
    id: 'scene_masque_roof',
    title: 'From the far side',
    entry: 'dome',
    nodes: [
      {
        id: 'dome',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The ladder to the dome is iron and cold. Masque lies on his back on the glass with the Lens to his eye, and the sky through the glass has an edge to it that the city below cannot see yet.',
        next: 'four',
      },
      {
        id: 'four',
        tags: ['written'],
        speaker: MASQUE,
        text: 'Four times. I counted. The warning, the smith, the record, the iron. You did them well; I would have done them in the same order, if I had thought any of them worth the breath.',
        next: 'too',
      },
      {
        id: 'too',
        tags: ['story'],
        speaker: MASQUE,
        text: 'You see it too now. From the far side. It was always going to fail, and we were always going to do it.',
        next: 'verse',
      },
      { id: 'verse', tags: ['story'], speaker: MASQUE, text: VERSE_SEVEN, onEnter: [{ grantEcho: 'echo_litany_verse_7' }], next: 'read' },
      {
        id: 'read',
        tags: ['written'],
        speaker: MASQUE,
        text: 'I have read it twice. I will read it again tonight because he asked, and it will say the same, and I will go down the stair and take my place and say my verse. Not because I am brave. Because what is seen is already so.',
        onEnter: [{ grantEcho: 'echo_ritual_inevitable' }, { questAdvance: { quest: RITUAL, stage: 'inevitable' } }],
        next: 'end',
      },
    ],
    companionReactions: [{ companionId: 'caelum', text: 'Caelum: "Master Masque never comes down. I used to think it was the stars he wanted. It was the distance."' }],
  },

  // ==== The Sunken Archives · q_the_first_drowned (STORY §11.5, §13 scene_the_first_drowned's Oriel) ========================

  // The carrel under the east stair (the Archives' `ev_archives_oriel_carrel`, Loop 2+ with `echo_oriel_drowned` while the scroll
  // is hers): approach without drawing; the ring, or the Amulet; she gives the scroll and verse I in her own voice
  {
    id: 'scene_oriel_carrel_again',
    title: "Oriel's carrel",
    entry: 'reading',
    nodes: [
      {
        id: 'reading',
        tags: ['written'],
        speaker: 'narrator',
        text: 'In the carrel under the east stair the Archivist has not turned her back. She is reading, as she was. You know her name now, and whose hands she has.',
        choices: [
          { id: 'approach', text: 'Approach without drawing.', effects: [{ questStart: DROWNED }], next: 'ink' },
          { id: 'leave', text: 'Leave her to her reading.', next: 'end' },
        ],
      },
      {
        id: 'ink',
        tags: ['written'],
        speaker: 'narrator',
        text: 'She lifts her head. Her eyes are ink. She looks at your empty hands, and at your face, and at your hands.',
        choices: [
          {
            id: 'ring',
            text: "Show her Oriel's Ring.",
            when: { item: { id: 'item_oriels_ring' } },
            next: 'mine',
          },
          { id: 'listen', text: 'Hold up the Amulet and Listen.', when: FROM_LOOP_2, tags: ['echo'], next: 'verse' },
          { id: 'leave', text: 'Leave her to her reading.', next: 'end' },
        ],
      },
      {
        id: 'mine',
        tags: ['written'],
        speaker: ORIEL,
        text: 'Mine. You have my ring, so you have walked with my hands, or they sent you. Let it be written as it is done. Take the scroll; I have read it enough. Tell them the ink still holds.',
        onEnter: [{ giveItem: { item: 'item_scholars_lost_scroll' } }, { grantEcho: 'echo_litany_verse_1' }, { questAdvance: { quest: DROWNED, stage: 'given' } }],
        next: 'end',
      },
      {
        id: 'verse',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You hold the Amulet to the water, and she speaks the first verse into it in a voice like a page turning, and the Amulet carries it up to you whole.',
        next: 'verse_one',
      },
      {
        id: 'verse_one',
        tags: ['story'],
        speaker: ORIEL,
        text: VERSE_ONE,
        onEnter: [{ grantEcho: 'echo_litany_verse_1' }],
        next: 'enough',
      },
      {
        id: 'enough',
        tags: ['written'],
        speaker: ORIEL,
        text: 'That is the first of them, and it is mine, and nobody drew. Take the scroll. I have read it enough. Tell them the ink still holds.',
        onEnter: [{ giveItem: { item: 'item_scholars_lost_scroll' } }, { questAdvance: { quest: DROWNED, stage: 'given' } }],
        next: 'end',
      },
    ],
    companionReactions: [{ companionId: 'ilyra', text: 'Ilyra: "She knew the ring before she knew my face. Wayfinder, I think she has been waiting for someone to hold it right."' }],
  },
] satisfies DialogueSceneInput[];
