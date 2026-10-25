// The Tyrant's first words (STORY §5.4, §8.2 what it says by loop, §13 `scene_tyrant_first_words`; §8.1 who it is: a chorus
// with one voice under it, "the hour", speaking costs it, never "I am sorry" to the living). Opened by the Apex's arrival event
// `ev_apex_first_words` (glowlands_nexus/locations.ts; a listed edit) from Loop 2 while it stands unresolved: the arrival scene
// skips the Apex's fixed fight (D-122), and Fight or Listen starts it from here — Listen with `echo_tyrant_speaks`, so the
// communion is open from the first turn (DESIGN §4.11); Leave lets you go, and it is still there when you come back (a shorter
// greeting). The communion's own words are the Unveiled Tyrant's data (glowlands_nexus/creatures.ts); the Resolution's are
// ./endings.ts; the rejection's line is the Fall's (engine `CLOSER_TEXT.fall.rejected`, STORY §8.5). Conventions: this folder's
// index.ts.
//
// STORY gives the Loop 2 scene line for line and the Loop 3 and Loop 5+ lines (tag `story`); the leave, the return and the
// joins are written (tag `written`, listed in the U58 reply and pinned by tests/unit/content/quests/endings.test.ts).
import type { DialogueSceneInput } from '@schema/dialogue';
import { echoLocked, type ChoiceInput } from './common';

const TYRANT = 'cr_chronos_tyrant_unveiled';

/** Fight → Phase 1; Listen → the communion's first Movement, `echo_tyrant_speaks`; Leave → it lets you (STORY §13). */
const fightListenLeave = (): ChoiceInput[] => [
  { id: 'fight', text: 'Fight.', effects: [{ startCombat: 'enc_apex_unveiled' }], next: 'end' },
  { id: 'listen', text: 'Listen.', tags: ['echo'], effects: [{ grantEcho: 'echo_tyrant_speaks' }, { startCombat: 'enc_apex_unveiled' }], next: 'end' },
  { id: 'leave', text: 'Leave.', next: 'lets_you' },
];
const FIGHT_LISTEN_LEAVE = fightListenLeave();

export const dialogues = [
  {
    id: 'scene_tyrant_first_words',
    title: 'It cannot ask',
    entry: [
      // this loop's second arrival: it has said what it had to; the choice again
      { when: { flag: 'flag_scene_done_scene_tyrant_first_words' }, node: 'still_here' },
      // STORY §8.2: Loop 5+, Loop 3–4, Loop 2
      { when: { loop: { min: 5 } }, node: 'count_by_you' },
      { when: { loop: { min: 3 } }, node: 'again' },
      { when: { all: [] }, node: 'whole' },
    ],
    nodes: [
      // ---- Loop 2: the first words (STORY §13) ----
      { id: 'whole', tags: ['story'], speaker: 'narrator', text: 'You arrive whole. The hour held here is one in which no one has been hurt yet.', next: 'held_breath' },
      { id: 'held_breath', tags: ['story'], speaker: 'narrator', text: 'It does not strike. You notice that it is not striking, the way you notice a held breath.', next: 'one_voice' },
      { id: 'one_voice', tags: ['story'], speaker: 'narrator', text: 'Then, under the chorus, one voice. It is tired in a way you do not have a word for.', next: 'crossed' },
      { id: 'crossed', tags: ['story'], speaker: TYRANT, text: 'You have crossed. So. One of you finally crossed.', next: 'finish_it' },
      { id: 'finish_it', tags: ['story'], speaker: TYRANT, text: 'Did you come back to finish it?', next: 'cannot_ask' },
      {
        id: 'cannot_ask',
        tags: ['story'],
        speaker: TYRANT,
        text: 'I hold. If I do not hold, you have seen what comes. I cannot ask. Do you understand that I cannot ask? To ask is to let go of something, and I have nothing in my hands but this.',
        choices: [
          echoLocked('echo_tyrant_name', { id: 'veyran', text: 'Veyran.', next: 'nobody_said' }),
          ...FIGHT_LISTEN_LEAVE,
        ],
      },
      { id: 'nobody_said', tags: ['story'], speaker: TYRANT, text: "...Nobody has said that here. Say it again, or don't. Both will hurt.", choices: FIGHT_LISTEN_LEAVE },
      // ---- Loop 3–4 (STORY §8.2): a check on the verses, by where you stop ----
      { id: 'again', tags: ['story'], speaker: TYRANT, text: 'Again. You carry more of the words each time. Say the ones you have; I will know which are missing by where you stop.', choices: FIGHT_LISTEN_LEAVE },
      // ---- Loop 5+ (STORY §8.2) ----
      {
        id: 'count_by_you',
        tags: ['story'],
        speaker: TYRANT,
        text: 'I have begun to count by you. That is a thing I had forgotten how to do. Do not make me a clock, Wayfinder. Finish it, one way or another, while I still have a way to be grateful.',
        choices: FIGHT_LISTEN_LEAVE,
      },
      // ---- back again this loop ----
      { id: 'still_here', tags: ['written'], speaker: TYRANT, text: 'Still here. So are you. The hour has not moved; it is the one thing I can promise.', choices: FIGHT_LISTEN_LEAVE },
      // ---- Leave: it lets you (STORY §13) ----
      { id: 'lets_you', tags: ['written'], speaker: 'narrator', text: 'You step back from the edge of it. Nothing reaches after you. It lets you go the way it has let everything go but the hour.', next: 'end' },
    ],
  },
] satisfies DialogueSceneInput[];
