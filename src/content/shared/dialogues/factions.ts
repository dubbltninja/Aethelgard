// The scenes of the four faction chain quests (STORY §11.2; §5.2 Keeper Dray's lines; §5.6 the ending proposals; §11
// "Come back when you've seen more."; DESIGN §11.3, §11.5, §12.5, §13.3 ex. 4; BIBLE §3 the givers' voices: Dray dated,
// precise, dry, citing years; Hadda proverbs and commands; Sethe Choir cadence, repeated phrases). The quests are
// ../quests/factions.ts; the conventions are this folder's index.ts (U52's pattern, D-105).
//
// Who says what, and when (priority bands from ./common.ts; every NPC scene is closed while the Horde runs):
//   Dray    scene_dray_keepers_ledger_offer (the ask, then the Ledger read: `echo_seven_wayfinders`; with `echo_thirtieth_dawn`
//           the pattern aloud) · scene_dray_keepers_ledger_waiting · scene_dray_keepers_ledger_copy (the whole Litany / verse
//           one) · scene_dray_keepers_ledger_after · scene_dray_idle (Loop 1: STORY's refusal; else a line)
//   Hadda   scene_hadda_day_of_teeth_offer (the Telling of Year 178) · _waiting · _return (the truth, with `echo_tyrant_jailer`
//           / a monster) · _after · scene_hadda_idle
//   Sethe   scene_sethe_hollow_choir_offer · scene_sethe_hollow_choir_rite (a Shard or a verse offered; the Choir sings the
//           eighth verse wrong: correct them with `echo_litany_verse_8`, or say nothing) · scene_sethe_hollow_choir_after ·
//           scene_sethe_unlidded_eye_offer · _waiting · _return (warn Nyx / let Sethe look) · _after ·
//           scene_sethe_void_resonance (DESIGN §13.3 ex. 4: the Note of Closing, at Trusted, after the Eye) · scene_sethe_idle
//
// STORY gives these quests their beats and a handful of lines (the journals, the ending proposals, Dray's two lines in §5.2,
// Ilyra's "The ink is not ours to lock away", the Shards' one note); every other line here is written (tag `written`, in the
// speaker's BIBLE voice, listed in the U53 reply and pinned by tests/unit/content/quests/factions.test.ts). The eighth verse
// as the Choir sings it wrong is written from STORY §2.3's verse VIII: the last line turned around (the Taken's reading).
//
// Not here, by design: Nyx's own side of `q_unlidded_eye` (her Sanctum lines, her leaving for a day, her Wary waking in the
// loops after `echo_choir_knows`) and Brak's refusal to enter the Choir are the companion units' (U54–U56); Hadda keeping
// the Nomads from the Apex is read from `echo_day_of_teeth` by the Horde and ending D (U58, U62); Dray's `q_bell_vault`,
// `q_the_keepers_price`, `q_the_thirtieth_dawn` and `q_long_archive` scenes are U57's, U54's and U58's.
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY, echoLocked, loyaltyFor, type ChoiceInput } from './common';

// ---- Lines and conditions used more than once -------------------------------------------------------------------------------

/** STORY §11: in Loop 1 the new regions' givers say this. */
const COME_BACK = "Come back when you've seen more.";

/** STORY §2.8 / §5.2 (D-067.11): Dray's one line, said with `echo_thirtieth_dawn` held. */
const THIRTY_EVERY_TIME = 'Thirty, every time. And every time, someone like you was taken before it came.';
/** STORY §5.2: Pell Ashcombe's notes produced with `echo_thirtieth_dawn` or `echo_breach_clock`. */
const HE_COUNTED_THIRTY = 'He counted thirty. Nobody understood why.';

const REMNANTS_TRUSTED: Condition = { rep: { faction: 'remnants', min: 20 } };
const IRONCLAD_TRUSTED: Condition = { rep: { faction: 'ironclad', min: 20 } };
const WEAVERS_TRUSTED: Condition = { rep: { faction: 'weavers', min: 20 } };
/** STORY §11.2: the Sanctum door's bar is the Choir's only standing. */
const WEAVERS_NOT_WARY: Condition = { rep: { faction: 'weavers', min: -9 } };

/** Any verse of the Litany held (STORY §2.3: nine verses, `echo_litany_verse_1` .. `_9`). */
const ANY_VERSE: Condition = { any: Array.from({ length: 9 }, (_, i) => ({ echo: `echo_litany_verse_${i + 1}` as const })) };

/**
 * DESIGN §13.3 ex. 4, exactly: Sethe's void resonance is a choice `when` — Weavers Trusted, the Eye's quest done, in the
 * Sanctum.
 */
const SETHE_RESONANCE: Condition = {
  all: [{ rep: { faction: 'weavers', min: 20 } }, { quest: { id: 'q_unlidded_eye', status: 'completed' } }, { location: 'loc_sanctum_of_threads' }],
};

/** The giver's ask: a yes that starts the quest, a no that goes to the refusal line. */
const offer = (questId: `q_${string}`, yes: string, no: string, afterYes: string, refused: string): ChoiceInput[] => [
  { id: 'yes', text: yes, effects: [{ questStart: questId }], next: afterYes },
  { id: 'no', text: no, next: refused },
];

/** Loop 1: STORY's line for every new giver; Loop 2+: a line of the giver's own while nothing else applies (the idle band). */
const idle = (id: `scene_${string}`, npcId: `npc_${string}`, later: string): DialogueSceneInput => ({
  id,
  npcId,
  when: { all: [NOT_IN_HORDE] },
  priority: SCENE_PRIORITY.idle,
  entry: [
    { when: FROM_LOOP_2, node: 'later' },
    { when: { all: [] }, node: 'come_back' },
  ],
  nodes: [
    { id: 'come_back', tags: ['story'], speaker: npcId, text: COME_BACK, next: 'end' },
    { id: 'later', tags: ['written'], speaker: npcId, text: later, next: 'end' },
  ],
});

export const dialogues = [
  // ==== Keeper Dray · q_keepers_ledger =======================================================================================

  // The ask, then the Ledger read (STORY §11.2 stage 1: seven names, seven years → `echo_seven_wayfinders`). With
  // `echo_thirtieth_dawn` he reads the pattern aloud (STORY §5.2, D-067.11); the engine then counts the pair as a source of
  // `echo_tyrant_jailer` (echoes.ts).
  {
    id: 'scene_dray_keepers_ledger_offer',
    npcId: 'npc_ansel_dray',
    title: 'The eighth line',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, REMNANTS_TRUSTED, { not: { quest: { id: 'q_keepers_ledger' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'ledger',
    nodes: [
      {
        id: 'ledger',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'The Ledger of Wayfinders. Seven entries, Year 44 to Year 430. The eighth line is ruled and empty, and I would rather write it before it is needed than after.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'Help me fill it. Hear the seven read, and fetch me the one count that was never entered. Will you?',
        choices: offer('q_keepers_ledger', 'Read them.', 'Not now.', 'reads', 'refused'),
      },
      {
        id: 'reads',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'Sael Orrin, 44. Hesper Vayle, 110. Corwen Blackreed, 178. Ysolde Marr, 243. Pell Ashcombe, 309. Rook Tallis, 371. Dask, 430. Every one at the Apex, or near enough.',
        // with the thirtieth dawn behind you, the pattern (STORY §5.2; the Loop 2+ variant appends STORY's sentence)
        textVariants: [
          {
            when: { echo: 'echo_thirtieth_dawn' },
            text: `Sael Orrin, 44. Hesper Vayle, 110. Corwen Blackreed, 178. Ysolde Marr, 243. Pell Ashcombe, 309. Rook Tallis, 371. Dask, 430. Every one at the Apex, or near enough. ${THIRTY_EVERY_TIME}`,
          },
        ],
        onEnter: [{ grantEcho: 'echo_seven_wayfinders' }],
        next: 'cistern',
      },
      {
        id: 'cistern',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'Ashcombe counted the days, and his count went down with the divers. The Cistern of Names, under the Reach. Bring me the case.',
        onEnter: [{ questAdvance: { quest: 'q_keepers_ledger', stage: 'recover_day_count' } }],
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: 'npc_ansel_dray', text: 'Then the line stays empty. It has waited seventy years. It can wait for you.', next: 'end' },
    ],
  },
  {
    id: 'scene_dray_keepers_ledger_waiting',
    npcId: 'npc_ansel_dray',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_keepers_ledger', stage: 'recover_day_count' } }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [
      {
        id: 'waiting',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: "The Cistern is south of the Drowned Stair, past the ninth lamp. Take Ilyra's lantern from the Archives; the dark there is not ordinary.",
        next: 'end',
      },
    ],
  },
  // STORY §11.2 stage 3: what the Remnants may copy. DESIGN §11.3: the whole Litany Remnants +25 (the path to Sworn), verse 1
  // only +10. STORY §7.1: Ilyra's loyalty beat is standing with her against the Keeper (she wants the Litany used).
  {
    id: 'scene_dray_keepers_ledger_copy',
    npcId: 'npc_ansel_dray',
    title: 'What the Remnants may copy',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_keepers_ledger', stage: 'choose_copy' } }, { item: { id: 'item_pells_day_count' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'case',
    nodes: [
      {
        id: 'case',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: "Thirty strokes in a waterproof case. Ashcombe's hand; I know it from his notes.",
        // STORY §5.2: with the thirtieth dawn or the Breach Clock known, he produces the notes (the variant appends the line)
        textVariants: [
          {
            when: { any: [{ echo: 'echo_thirtieth_dawn' }, { echo: 'echo_breach_clock' }] },
            text: `Thirty strokes in a waterproof case. Ashcombe's hand; I know it from his notes. ${HE_COUNTED_THIRTY}`,
          },
        ],
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'Now the Ledger asks a copy of you. What you carry of the Litany, every verse of it, entered and kept dry. Or the first verse alone.',
        choices: [
          {
            id: 'whole',
            text: 'Copy all of it.',
            effects: [
              { takeItem: { item: 'item_pells_day_count' } },
              { rep: { faction: 'remnants', delta: 25 } },
              { setFlag: 'flag_remnants_hold_litany' },
              ...loyaltyFor([], ['ilyra']),
              { questAdvance: { quest: 'q_keepers_ledger', stage: 'whole' } },
            ],
            next: 'entered',
          },
          {
            id: 'verse_one',
            text: 'Verse one. The rest stays with me.',
            effects: [
              { takeItem: { item: 'item_pells_day_count' } },
              { rep: { faction: 'remnants', delta: 10 } },
              ...loyaltyFor(['ilyra']),
              { questAdvance: { quest: 'q_keepers_ledger', stage: 'verse_one' } },
            ],
            next: 'one_verse',
          },
        ],
      },
      { id: 'entered', tags: ['written'], speaker: 'npc_ansel_dray', text: 'Entered. Year 500, the eighth hand. Now hear what I would do with it.', next: 'held_well' },
      // STORY §5.6: Keeper Dray names ending E
      { id: 'held_well', tags: ['story'], speaker: 'npc_ansel_dray', text: 'If the hour must be held, let it be held well. Let someone remember.', next: 'end' },
      {
        id: 'one_verse',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: "One verse. Ilyra's argument, in your mouth. So be it; the Archive has kept less and lasted.",
        next: 'end',
      },
    ],
    // STORY §11.2: Ilyra approves of verse one only (a companion may not voice a node until U56 registers them, D-088)
    companionReactions: [{ companionId: 'ilyra', when: { quest: { id: 'q_keepers_ledger', stage: 'verse_one' } }, text: 'Ilyra: "The ink is not ours to lock away."' }],
  },
  {
    id: 'scene_dray_keepers_ledger_after',
    npcId: 'npc_ansel_dray',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_keepers_ledger', status: 'completed' } }] },
    priority: SCENE_PRIORITY.after,
    entry: 'pencil',
    nodes: [{ id: 'pencil', tags: ['written'], speaker: 'npc_ansel_dray', text: 'The eighth line is written in pencil. I will ink it when I know how it ends.', next: 'end' }],
  },
  idle('scene_dray_idle', 'npc_ansel_dray', "Seven names in this book, and none of them knew me. Earn the Remnants' trust, Wayfinder, and I will read them to you."),

  // ==== Hadda Ironvow · q_day_of_teeth ========================================================================================

  // STORY §11.2 stage 1: the Telling of Year 178 (BIBLE §2: twenty held the Nexus a day; Corwen died in the horde he let out).
  {
    id: 'scene_hadda_day_of_teeth_offer',
    npcId: 'npc_hadda_ironvow',
    title: 'The Telling of Year 178',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, IRONCLAD_TRUSTED, { not: { quest: { id: 'q_day_of_teeth' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'telling',
    nodes: [
      {
        id: 'telling',
        tags: ['written'],
        speaker: 'npc_hadda_ironvow',
        text: 'Year 178. Corwen Blackreed went east with twenty of us and put an axe in the thing at the Apex. For one day the Nexus was teeth.',
        next: 'twenty',
      },
      {
        id: 'twenty',
        tags: ['written'],
        speaker: 'npc_hadda_ironvow',
        text: 'Twenty held it with steel. Corwen died in what he let out, and his axe is still there. Steel remembers what the hand forgets.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: 'npc_hadda_ironvow',
        text: "Bring me Blackreed's axe. Go through what is left of that day to get it. Will you?",
        choices: offer('q_day_of_teeth', 'I will bring it.', 'Not yet.', 'go', 'refused'),
      },
      { id: 'go', tags: ['written'], speaker: 'npc_hadda_ironvow', text: 'The Nexus. East past the Glowlands, where the dome broke. Sing louder than it.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: 'npc_hadda_ironvow', text: 'Then sit by the fire with the children. The axe has waited; so can I.', next: 'end' },
    ],
  },
  {
    id: 'scene_hadda_day_of_teeth_waiting',
    npcId: 'npc_hadda_ironvow',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_day_of_teeth', status: 'active' } }, { not: { quest: { id: 'q_day_of_teeth', stage: 'return' } } }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['written'], speaker: 'npc_hadda_ironvow', text: 'The Nexus, Wayfinder. Twenty went. Come back with the axe or do not come back.', next: 'end' }],
  },
  // STORY §11.2 stage 4: she asks what the Tyrant is. The truth (needs `echo_tyrant_jailer`): Ironclad +25, `echo_day_of_teeth`,
  // she names ending D and keeps the Nomads from the Apex. A monster: Ironclad +25, her scouts thin the hold: Clock −2 days
  // (DESIGN §10.1: −8 watches). DESIGN §12.5: Brak values the Ironclad quests.
  {
    id: 'scene_hadda_day_of_teeth_return',
    npcId: 'npc_hadda_ironvow',
    title: 'What the thing at the Apex is',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_day_of_teeth', stage: 'return' } }, { item: { id: 'item_blackreeds_axe' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'axe',
    nodes: [
      {
        id: 'axe',
        tags: ['written'],
        speaker: 'npc_hadda_ironvow',
        text: "Blackreed's axe. The notches are a count; he cut one for each of ours it took. Keep it. It has a day left in it.",
        next: 'what',
      },
      {
        id: 'what',
        tags: ['written'],
        speaker: 'npc_hadda_ironvow',
        text: 'Now tell me, you who have stood in front of it. What is the thing at the Apex?',
        choices: [
          echoLocked('echo_tyrant_jailer', {
            id: 'truth',
            text: 'A man. He is holding the Breach shut, and has been since the Sundering.',
            effects: [
              { rep: { faction: 'ironclad', delta: 25 } },
              { grantEcho: 'echo_day_of_teeth' },
              ...loyaltyFor(['brak']),
              { questAdvance: { quest: 'q_day_of_teeth', stage: 'told_truth' } },
            ],
            next: 'a_door',
          }),
          {
            id: 'monster',
            text: 'A monster. It must be killed properly.',
            effects: [
              { rep: { faction: 'ironclad', delta: 25 } },
              { clockWatches: -8 },
              ...loyaltyFor(['brak']),
              { questAdvance: { quest: 'q_day_of_teeth', stage: 'told_monster' } },
            ],
            next: 'scouts',
          },
        ],
      },
      {
        id: 'a_door',
        tags: ['written'],
        speaker: 'npc_hadda_ironvow',
        text: 'A man in a door. Then Corwen put his axe in the door, and the door let go for a day.',
        next: 'kept_back',
      },
      {
        id: 'kept_back',
        tags: ['written'],
        speaker: 'npc_hadda_ironvow',
        text: 'I will keep my people off the Apex road. Give me a line to hold instead, and I will tell you where I would cut.',
        next: 'cut_the_line',
      },
      // STORY §5.6: Hadda names ending D
      { id: 'cut_the_line', tags: ['story'], speaker: 'npc_hadda_ironvow', text: 'Cut the line under it. No ley, no Breach, no Tyrant.', next: 'end' },
      { id: 'scouts', tags: ['written'], speaker: 'npc_hadda_ironvow', text: 'Then it dies properly. My scouts ride east tonight to find how it bleeds.', next: 'thinned' },
      {
        id: 'thinned',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Far to the east, the hold thins where the scouts cut at it. Two dawns come off the count.',
        next: 'end',
      },
    ],
  },
  {
    id: 'scene_hadda_day_of_teeth_after',
    npcId: 'npc_hadda_ironvow',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_day_of_teeth', status: 'completed' } }] },
    priority: SCENE_PRIORITY.after,
    entry: [
      { when: { quest: { id: 'q_day_of_teeth', stage: 'told_truth' } }, node: 'west' },
      { when: { all: [] }, node: 'horns' },
    ],
    nodes: [
      { id: 'west', tags: ['written'], speaker: 'npc_hadda_ironvow', text: 'The axe sits well on you. My riders stay west of the Glowlands; that was the bargain.', next: 'end' },
      { id: 'horns', tags: ['written'], speaker: 'npc_hadda_ironvow', text: 'My scouts are east. If they find where it bleeds, you will hear the horns.', next: 'end' },
    ],
  },
  idle('scene_hadda_idle', 'npc_hadda_ironvow', 'The fire does not know you yet. Carry iron for us before you ask it anything.'),

  // ==== Sethe the Unlidded · q_hollow_choir ===================================================================================

  {
    id: 'scene_sethe_hollow_choir_offer',
    npcId: 'npc_sethe_unlidded',
    title: 'One thing torn',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, WEAVERS_NOT_WARY, { not: { quest: { id: 'q_hollow_choir' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'whole',
    nodes: [
      {
        id: 'whole',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'You came down the stair and you are still whole. The Choir sings for the torn. Bring one thing torn from a moment and you may hear it.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'A Shard, torn from the night it fell out of. Or a memory the Amulet tore loose. Bring it torn, or do not bring it. Will you?',
        choices: offer('q_hollow_choir', 'I will bring it.', 'No.', 'where', 'refused'),
      },
      {
        id: 'where',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'The Shards are in the Hollow, in the things that feed there. The verses are in you, if you have listened. Come back torn.',
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: 'npc_sethe_unlidded', text: 'Then stay whole. Stay whole and stay deaf.', next: 'end' },
    ],
  },
  // STORY §11.2 stages 2–3: the offering (a Void Shard, or Listen with the Amulet and offer a verse: it is not lost), then the
  // Choir sings the eighth verse wrong. Correct them (needs `echo_litany_verse_8`): Weavers +15, Sethe suspects Nyx. Say
  // nothing: Weavers +10. The hand-sign is the quest's reward either way.
  {
    id: 'scene_sethe_hollow_choir_rite',
    npcId: 'npc_sethe_unlidded',
    title: 'The eighth verse, sung wrong',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_hollow_choir', stage: 'torn_thing' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'offering',
    nodes: [
      {
        id: 'offering',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'Show me what you tore.',
        choices: [
          {
            id: 'shard',
            text: 'Offer a Void Shard.',
            when: { item: { id: 'item_void_shard' } },
            effects: [{ takeItem: { item: 'item_void_shard' } }, { questAdvance: { quest: 'q_hollow_choir', stage: 'offered' } }],
            next: 'takes_shard',
          },
          {
            // an Echo line open to any verse held, so it is built by hand rather than with echoLocked (one Echo): greyed until one is
            id: 'verse',
            text: 'Listen with the Amulet, and offer a verse.',
            when: FROM_LOOP_2,
            disabledWhen: { not: ANY_VERSE },
            disabledText: '(You hold no verse to offer)',
            tags: ['echo'],
            effects: [{ questAdvance: { quest: 'q_hollow_choir', stage: 'offered' } }],
            next: 'takes_verse',
          },
          { id: 'not_yet', text: 'Not yet.', next: 'end' },
        ],
      },
      { id: 'takes_shard', tags: ['written'], speaker: 'npc_sethe_unlidded', text: 'A second of the last night, still bleeding. Yes. Sit in the web. Sit, and hear it.', next: 'sings' },
      {
        id: 'takes_verse',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'You hum it and the threads hum back. A verse, torn loose and kept. Keep it; the Choir only needs to hear it. Sit.',
        next: 'sings',
      },
      { id: 'sings', tags: ['written'], speaker: 'narrator', text: 'Nine Weavers take up the thread, and the hall sings the eighth verse.', next: 'verse_wrong' },
      {
        // STORY §2.3 verse VIII, as the Choir has sung it for four hundred years: the last line turned around
        id: 'verse_wrong',
        tags: ['written'],
        speaker: 'narrator',
        text: 'There is a dark between one moment and the next.\nWe name it, and it enters us.\nOpen, and enter.',
        next: 'heard',
      },
      {
        id: 'heard',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'That is the verse. Four hundred years we have sung it. You hear it, you hear it. Say what you hear.',
        choices: [
          echoLocked('echo_litany_verse_8', {
            id: 'correct',
            text: 'You have the last line backwards. Open, and be entered.',
            effects: [{ rep: { faction: 'weavers', delta: 15 } }, { questAdvance: { quest: 'q_hollow_choir', stage: 'corrected' } }],
            next: 'backwards',
          }),
          {
            id: 'silent',
            text: 'Say nothing.',
            effects: [{ rep: { faction: 'weavers', delta: 10 } }, { questAdvance: { quest: 'q_hollow_choir', stage: 'silent' } }],
            next: 'ours',
          },
        ],
      },
      { id: 'backwards', tags: ['written'], speaker: 'npc_sethe_unlidded', text: 'Backwards. Four hundred years, backwards. Who sang you the right way round? Not us.', next: 'not_nyx' },
      {
        id: 'not_nyx',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'Not us, and not Nyx. Nyx has heard us sing it every night for thirty years and said nothing. Said nothing.',
        next: 'sign',
      },
      { id: 'ours', tags: ['written'], speaker: 'npc_sethe_unlidded', text: 'You hear it. You hear it and you keep it. Then you are a little ours.', next: 'sign' },
      {
        id: 'sign',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'The hand-sign. Two fingers across the mouth, the way the mask has none. The curtain knows it; now it knows you.',
        next: 'end',
      },
    ],
  },
  // until the Eye's quest is done too: then its own after-line speaks (the two share the band; content order would decide)
  {
    id: 'scene_sethe_hollow_choir_after',
    npcId: 'npc_sethe_unlidded',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_hollow_choir', status: 'completed' } }, { not: { quest: { id: 'q_unlidded_eye', status: 'completed' } } }] },
    priority: SCENE_PRIORITY.after,
    entry: 'mask',
    nodes: [{ id: 'mask', tags: ['written'], speaker: 'npc_sethe_unlidded', text: 'The mask has no mouth. Wear it, wear it, and the Choir will sing through it.', next: 'end' }],
  },

  // ==== Sethe the Unlidded · q_unlidded_eye ===================================================================================

  {
    id: 'scene_sethe_unlidded_eye_offer',
    npcId: 'npc_sethe_unlidded',
    title: 'Where Nyx looks',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_hollow_choir', status: 'completed' } }, WEAVERS_TRUSTED, { not: { quest: { id: 'q_unlidded_eye' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'seam',
    nodes: [
      {
        id: 'seam',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'Nyx looks at the seam between one moment and the next. I cut my lids away to look where she looks, and still I see less than she does.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: "Masque's wardens at the Nexus look between moments. Bring me the eye of one, and I will see what she sees. Will you?",
        choices: offer('q_unlidded_eye', 'I will bring it.', 'No.', 'wardens', 'refused'),
      },
      {
        id: 'wardens',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'The Nexus. The wardens keep broken hours there, and one of them is looking at you already.',
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: 'npc_sethe_unlidded', text: 'Then I will keep looking with these. Keep looking, keep looking.', next: 'end' },
    ],
  },
  {
    id: 'scene_sethe_unlidded_eye_waiting',
    npcId: 'npc_sethe_unlidded',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_unlidded_eye', status: 'active' } }, { not: { quest: { id: 'q_unlidded_eye', stage: 'return' } } }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [
      {
        id: 'waiting',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'The Nexus, under the broken dome. Kill a warden and take its eye while it is still looking.',
        next: 'end',
      },
    ],
  },
  // STORY §11.2 stage 3: Sethe looks through the Eye at Nyx. Warn Nyx first: she leaves the Sanctum for a day, Weavers +10,
  // Nyx Loyal. Let Sethe look: Weavers +20, `echo_choir_knows`, Nyx Wary (DESIGN §12.5: against her value, not telling the
  // Choir what she is). The Unlidded Eye is the quest's reward either way.
  {
    id: 'scene_sethe_unlidded_eye_return',
    npcId: 'npc_sethe_unlidded',
    title: 'The Eye on Nyx',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_unlidded_eye', stage: 'return' } }, { item: { id: 'item_aberrant_eye' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'eye',
    nodes: [
      {
        id: 'eye',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'Still looking. Still looking at the second it died in. Hold it up; Nyx is in the web tonight, and I will look where she looks.',
        choices: [
          {
            id: 'warn',
            text: 'Warn Nyx first.',
            effects: [
              { takeItem: { item: 'item_aberrant_eye' } },
              { rep: { faction: 'weavers', delta: 10 } },
              ...loyaltyFor(['nyx']),
              { questAdvance: { quest: 'q_unlidded_eye', stage: 'warned' } },
            ],
            next: 'gone',
          },
          {
            id: 'look',
            text: 'Let Sethe look.',
            effects: [
              { takeItem: { item: 'item_aberrant_eye' } },
              { rep: { faction: 'weavers', delta: 20 } },
              { grantEcho: 'echo_choir_knows' },
              ...loyaltyFor([], ['nyx']),
              { questAdvance: { quest: 'q_unlidded_eye', stage: 'looked' } },
            ],
            next: 'seam_seen',
          },
        ],
      },
      {
        id: 'gone',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You find Nyx first. She listens, and does not thank you, and is gone from the Sanctum for a day.',
        next: 'set_in_silver',
      },
      {
        id: 'seam_seen',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'There. There, on her, a seam. She is stitched to the night it opened. She was there, and she sings our verse wrong on purpose.',
        next: 'set_in_silver',
      },
      {
        id: 'set_in_silver',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'The eye goes in silver, and the silver goes to you. It will not close, and after a while neither will you.',
        next: 'end',
      },
    ],
  },
  {
    id: 'scene_sethe_unlidded_eye_after',
    npcId: 'npc_sethe_unlidded',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_unlidded_eye', status: 'completed' } }] },
    priority: SCENE_PRIORITY.after,
    entry: [
      { when: { quest: { id: 'q_unlidded_eye', stage: 'looked' } }, node: 'look_too' },
      { when: { all: [] }, node: 'came_back' },
    ],
    nodes: [
      { id: 'look_too', tags: ['written'], speaker: 'npc_sethe_unlidded', text: 'Nyx looks at the seam. Now I look too, and she knows I look.', next: 'end' },
      { id: 'came_back', tags: ['written'], speaker: 'npc_sethe_unlidded', text: 'Nyx came back. She looks at me now the way she looks at the seam.', next: 'end' },
    ],
  },
  // DESIGN §13.3 ex. 4 / STORY §11.2 "Either: at Weavers Trusted, echo_void_resonance is granted by Nyx or by Sethe": the Note
  // of Closing, on a talk after the Eye, offered until it is asked (the scene closes for good once the Echo is held).
  {
    id: 'scene_sethe_void_resonance',
    npcId: 'npc_sethe_unlidded',
    title: 'The one note',
    when: { all: [NOT_IN_HORDE, SETHE_RESONANCE, { not: { echo: 'echo_void_resonance' } }] },
    priority: SCENE_PRIORITY.payoff,
    entry: 'listen',
    nodes: [
      {
        id: 'listen',
        tags: ['written'],
        speaker: 'npc_sethe_unlidded',
        text: 'You hold the Shards the way I do now, close to the ear. Ask me what they sing. Ask.',
        choices: [
          { id: 'ask_note', text: 'What do the Shards sing?', when: SETHE_RESONANCE, effects: [{ grantEcho: 'echo_void_resonance' }], next: 'one_note' },
          { id: 'later', text: 'Later.', next: 'end' },
        ],
      },
      // STORY §11.2's words, given as her line
      { id: 'one_note', tags: ['written'], speaker: 'npc_sethe_unlidded', text: 'The Shards sing one note; it is the note of the tear closing, not opening.', next: 'end' },
    ],
  },
  idle('scene_sethe_idle', 'npc_sethe_unlidded', 'The thread does not part for the Wary. Mend what you are to us, and come down the stair again.'),
] satisfies DialogueSceneInput[];
