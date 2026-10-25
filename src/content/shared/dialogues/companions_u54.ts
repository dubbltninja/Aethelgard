// The scenes of Ilyra's and Brak's arcs (STORY §11.4; §7.1–§7.2 the arcs, recruitment, loyalty beats, refusals and voices;
// §5.2 and §6.4 the déjà vu lines of Ilyra, Brak and Kaelen; §13 `scene_the_first_drowned` and `scene_braks_brother`; §2.3
// verse I; §10.7 and §12 the deliberate tear; DESIGN §12.1 recruitment, §12.5 loyalty, §12.7 camp conversations, §13.3
// ex. 2 and 5; BIBLE §3.2 the two voices — Ilyra precise, formal under stress, ink and paper; Brak fragments, one dry joke,
// "the Horde", counts things — and §3.3 Kaelen weighing and pricing, Hadda proverbs and commands, Dray dated and precise,
// Borin forge verbs and "speak plain"). The quests are ../quests/companions_u54.ts; the conventions are this folder's
// index.ts (U52's pattern, D-105; U53's, D-109). U54.
//
// Who says what, and when (priority bands from ./common.ts; every NPC scene is closed while the Horde runs):
//   Ilyra   scene_ilyra_deja_vu (Loop 2+, once a loop after the first meeting: §5.2 with the verse-I variant and §6.4 by loop
//           tier) · scene_ilyra_arc (her offers at one table: told here, recruitment, the Voices, the Door of Pages, the
//           deliberate tear — each a choice shown while its own condition holds, so a refusal blocks nothing) ·
//           scene_ilyra_voices_waiting · scene_ilyra_voices_ask (the verse read aloud; the watchword) ·
//           scene_ilyra_danthe_line_waiting · scene_the_first_drowned (no npc: the Archives' carrel event opens it; Oriel
//           speaks as `cr_drowned_archivist`) · scene_ilyra_camp_1…3 (no npc: a full rest with her in the party; priorities
//           3, 2, 1 so they come in order)
//   Dray    scene_dray_keepers_price (the ask, the telling, Ilyra's choice: one table)
//   Brak    scene_brak_deja_vu · scene_brak_arc (his offers at one fire: recruitment, the Ring, the salt, the Apex — the Line
//           told, proved and chosen in it) · scene_brak_scouts_oath_waiting · scene_brak_blood_and_salt_offer (the first
//           offer to a Peaks-refuser) · scene_brak_blood_and_salt_report (the whetstone / "it's fine") · scene_brak_camp_1…3
//   Hadda   scene_hadda_scouts_oath (the Ring: "Brak of the Ironclad"; that night, the other name once; the oath-brother's word)
//   Kaelen  scene_kaelen_deja_vu · scene_kaelen_blood_and_salt_offer ("Don't say that name in here": the quest through him) ·
//           scene_braks_brother (STORY §13: the whetstone, or four gold)
//   Borin   scene_borin_oath (the Outpost done, then a word: `echo_borin_oath`; STORY §12 gives the beat and no line)
//
// Bands: an NPC's offers share one `offer` scene (a hub) because two offers in one band tie by content order, and a refused
// first one would hide the second for the loop; a legacy offer still wins the tie, so the Outpost is offered before Brak
// joins and the scroll before Ilyra does (DESIGN §12.1 "q_lost_scroll accepted"). Blood and Salt's first offer to one who
// refused the Peaks sits in the `report` band on purpose: the legacy Peaks offer otherwise wins every tie, and WORLD §10.8's
// Loop 1 pacifist route needs this quest without the Peaks. The déjà vu scenes are `dejaVu` (a band this unit added to
// common.ts: under every offer and report, above the reminders) and play once a loop, after the legacy greeting.
//
// STORY's lines are verbatim (tag `story`; the stage directions in §13 are narrator lines); the legacy greetings and the
// Archivist's description are the Python's (tag `legacy`); every other line is written (tag `written`, in the speaker's BIBLE
// voice, listed in the U54 reply and pinned by tests/unit/content/quests/companions_u54.test.ts). Camp conversations earn
// their +2 from the engine (reducers/dialogue.ts CAMP_LOYALTY), so no camp scene carries a loyalty effect of its own.
//
// Not here, by design: Ilyra's and Brak's refusals of places (the Veil; the Hollow Choir, Nyx behind him, the Apex after an
// Exploit) are their records' `refusesWhen` (U34f, shared/companions.ts), and Brak's *Named* a trait there; Brak's Apex
// refusal is also a camp line;
// Ilyra leaving after an Exploit is the Heartstone scene's `onEnd` (legacy.ts); the Horde's lines and the portal are U62's;
// `scene_ilyra_portal`'s `flag_ilyra_told` variant is U62's; Nyx's and Dask's side of anything is U55's.
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import { SALT } from '../quests/companions_u54';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY, echoLocked, loyaltyFor, type ChoiceInput, type NodeInput } from './common';

// ---- Lines and conditions used more than once -------------------------------------------------------------------------------

/** STORY §2.3, verse I (The Witness, Oriel Danthe): the canonical text. */
const VERSE_ONE = 'Let it be written as it is done.\nLet the hand fail and the word stand.\nWhat we do here, we do before the stone.';

/** DESIGN §11.1: Neutral is −9..19. */
const REMNANTS_NEUTRAL: Condition = { rep: { faction: 'remnants', min: -9 } };
const IRONCLAD_NEUTRAL: Condition = { rep: { faction: 'ironclad', min: -9 } };
const REMNANTS_TRUSTED: Condition = { rep: { faction: 'remnants', min: 20 } };

const ILYRA_IN_PARTY: Condition = { companion: { id: 'ilyra' } };
const BRAK_IN_PARTY: Condition = { companion: { id: 'brak' } };
const ILYRA_RECRUITED: Condition = { companion: { id: 'ilyra', state: 'recruited' } };
const BRAK_RECRUITED: Condition = { companion: { id: 'brak', state: 'recruited' } };

/** STORY §7.1: she believes the loop — told at the first meeting or here, the watchword said (U52's choice flag), or the Voices. */
const ILYRA_BELIEVES: Condition = {
  any: [{ flag: 'flag_ilyra_told' }, { flag: 'flag_choice_scene_first_meeting_ilyra_watchword' }, { quest: { id: 'q_voices_in_the_stacks', status: 'completed' } }],
};

/** The giver's ask: a yes that starts the quest, a no that goes to the refusal line. */
const offer = (questId: `q_${string}`, yes: string, no: string, afterYes: string, refused: string): ChoiceInput[] => [
  { id: 'yes', text: yes, effects: [{ questStart: questId }], next: afterYes },
  { id: 'no', text: no, next: refused },
];

/** Ilyra's offers (scene_ilyra_arc): each choice's `when`, and together the scene's. */
const ILYRA_TELL_OK: Condition = { all: [FROM_LOOP_2, { quest: { id: 'q_echo_crystal', status: 'completed' } }, { not: ILYRA_RECRUITED }, { not: ILYRA_BELIEVES }] };
const ILYRA_RECRUIT_OK: Condition = {
  all: [
    FROM_LOOP_2,
    REMNANTS_NEUTRAL,
    { not: ILYRA_RECRUITED },
    { not: { flag: 'flag_heartstone_exploited' } },
    ILYRA_BELIEVES,
    { any: [{ flag: 'flag_choice_scene_first_meeting_ilyra_watchword' }, { quest: { id: 'q_echo_crystal', status: 'completed' } }] },
  ],
};
const VOICES_OK: Condition = { all: [FROM_LOOP_2, { quest: { id: 'q_echo_crystal', status: 'completed' } }, { not: { quest: { id: 'q_voices_in_the_stacks' } } }] };
const DANTHE_OK: Condition = {
  all: [FROM_LOOP_2, { loyalty: { companion: 'ilyra', min: 25 } }, { any: [{ echo: 'echo_archive_door' }, { item: { id: 'item_bell_vault_key' } }] }, { not: { quest: { id: 'q_the_danthe_line' } } }],
};
const TEAR_OK: Condition = {
  all: [FROM_LOOP_2, { echo: 'echo_portal_tear' }, REMNANTS_TRUSTED, { not: { quest: { id: 'q_the_keepers_price', stage: 'unbound_hand' } } }, { not: { flag: 'flag_library_portal_open' } }],
};

/** Brak's offers (scene_brak_arc). */
const BRAK_RECRUIT_OK: Condition = { all: [{ quest: { id: 'q_clear_path', status: 'completed' } }, IRONCLAD_NEUTRAL, { not: BRAK_RECRUITED }] };
const OATH_OK: Condition = { all: [FROM_LOOP_2, { quest: { id: 'q_blighted_outpost', status: 'completed' } }, { not: { quest: { id: 'q_the_scouts_oath' } } }] };
const SALT_OK: Condition = { not: { quest: { id: 'q_blood_and_salt' } } };
/** STORY's prereq, exactly (DESIGN §13.3 ex. 5's `when`). */
const LINE_OK: Condition = { all: [{ echo: 'echo_brak_death' }, { quest: { id: 'q_blighted_outpost', status: 'completed' } }, { not: { quest: { id: 'q_the_line_he_holds' } } }] };
/** U59 (STORY §11.8 `q_class_ironclad_warden`): the Warden's own ask, Loop 2+, chained from the hub to scene_brak_wall_offer (dialogues/classes.ts). */
const WALL_OK: Condition = { all: [FROM_LOOP_2, { class: 'ironclad_warden' }, { not: { quest: { id: 'q_class_ironclad_warden' } } }] };

/** Blood and Salt's ask, shared by the hub and the Peaks-refuser's first offer. */
const saltAsk = (): NodeInput[] => [
  { id: 'short', tags: ['written'], speaker: 'npc_brak', text: "Camp's short of salt. Kaelen sells it, down at the Respite. Four gold the sack.", next: 'ask_salt' },
  {
    id: 'ask_salt',
    tags: ['written'],
    speaker: 'npc_brak',
    text: "I'm not asking him. Somebody has to carry it. You've got the legs and nobody's name. Will you?",
    choices: offer('q_blood_and_salt', "I'll carry it.", 'Carry it yourself.', 'go_salt', 'wont'),
  },
  { id: 'go_salt', tags: ['written'], speaker: 'npc_brak', text: "Good. Don't tell him who it's for. He'll weigh you for it.", next: 'end' },
  { id: 'wont', tags: ['written'], speaker: 'npc_brak', text: "I won't. That's the point.", next: 'end' },
];

/** A déjà vu scene's entry: STORY §6.4's tiers by loop (5+, 3–4), else Loop 2's §5.2 line. */
const byTier = (tier5: string, tier3: string, loop2: string): DialogueSceneInput['entry'] => [
  { when: { loop: { min: 5 } }, node: tier5 },
  { when: { loop: { min: 3 } }, node: tier3 },
  { when: { all: [] }, node: loop2 },
];

export const dialogues = [
  // ==== Ilyra · déjà vu (STORY §5.2, §6.4) ==================================================================================

  {
    id: 'scene_ilyra_deja_vu',
    npcId: 'npc_ilyra',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, { flag: 'flag_scene_done_scene_first_meeting_ilyra' }] },
    priority: SCENE_PRIORITY.dejaVu,
    repeatable: false,
    entry: byTier('tier5', 'tier3', 'hands'),
    nodes: [
      {
        id: 'hands',
        tags: ['story'],
        speaker: 'npc_ilyra',
        text: 'You keep looking at my hands. Is something wrong with them?',
        // STORY §5.2: with verse I held, the hummed line follows
        textVariants: [
          {
            when: { echo: 'echo_litany_verse_1' },
            text: 'You keep looking at my hands. Is something wrong with them? You hummed something just now. Where did you hear that? I have never... I think I have always known it.',
          },
        ],
        next: 'dream',
      },
      { id: 'dream', tags: ['story'], speaker: 'npc_ilyra', text: 'I dreamed of a library on fire and a door I was holding. I never dream.', next: 'end' },
      { id: 'tier3', tags: ['story'], speaker: 'npc_ilyra', text: 'When you walked in I almost said you made it. Made it from where?', next: 'end' },
      {
        id: 'tier5',
        tags: ['story'],
        speaker: 'npc_ilyra',
        text: "I know your name before you say it. I know you'll go east. I know I'll hold something open until my hands burn and I know you'll step through and I don't know why I know it, and I would like you to tell me, please, this time.",
        choices: [
          { id: 'tell', text: "I'll tell you. All of it.", effects: [{ setFlag: 'flag_ilyra_told' }], next: 'held_to_it' },
          { id: 'later', text: 'Not here. Not yet.', next: 'end' },
        ],
      },
      { id: 'held_to_it', tags: ['written'], speaker: 'npc_ilyra', text: 'Then I will hold you to it, and I will try to hold you to it gently.', next: 'end' },
    ],
  },

  // ==== Ilyra · her offers: recruitment, the Voices, the Door of Pages, the deliberate tear (one table, so a refusal blocks nothing) ==

  // DESIGN §12.1 / STORY §7.1 recruitment: Loop 2+, after the Crystal (or at once with the watchword said), Remnants ≥ Neutral,
  // and she believes you (told at the first meeting or here, the watchword, the Voices); never in a loop that exploited the
  // Heartstone (STORY §7.1 refusals). The scroll offer wins the tie: "q_lost_scroll accepted" (DESIGN §12.1). The tear:
  // STORY §10.7 / §12 `echo_portal_tear` at Remnants Trusted unless she swore off it this loop; opening it sets
  // `flag_library_portal_open` (horde.ts: `enterPortal` at the Library → `closer_escape`).
  {
    id: 'scene_ilyra_arc',
    npcId: 'npc_ilyra',
    title: 'Ilyra',
    when: { all: [NOT_IN_HORDE, { any: [ILYRA_TELL_OK, ILYRA_RECRUIT_OK, VOICES_OK, DANTHE_OK, TEAR_OK] }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'hub',
    nodes: [
      {
        id: 'hub',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'Yes, Wayfinder? Ask. I have ink enough for one more answer tonight.',
        choices: [
          { id: 'tell', text: "Ilyra, I've done this before.", when: ILYRA_TELL_OK, effects: [{ setFlag: 'flag_ilyra_told' }], next: 'again' },
          { id: 'come', text: 'Come with me.', when: ILYRA_RECRUIT_OK, effects: [{ recruit: 'ilyra' }], next: 'joins' },
          { id: 'voices', text: 'About the voice in the Library.', when: VOICES_OK, next: 'night' },
          { id: 'door', text: 'About the Door of Pages.', when: DANTHE_OK, next: 'seal' },
          { id: 'tear', text: 'Open the Library.', when: TEAR_OK, next: 'thin' },
          { id: 'nothing', text: 'Nothing. The whispers.', next: 'end' },
        ],
      },
      // told here: she half believes it, and the ask follows (recruitment)
      {
        id: 'again',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: '...Then say it again when it is true, and I will know it. I think I half know it now.',
        choices: [
          { id: 'come', text: 'Come with me.', when: ILYRA_RECRUIT_OK, effects: [{ recruit: 'ilyra' }], next: 'joins' },
          { id: 'not_yet', text: 'Not yet.', next: 'stays' },
        ],
      },
      { id: 'joins', tags: ['written'], speaker: 'npc_ilyra', text: 'Then I will bring ink. Something should be written down as it is done.', next: 'end' },
      { id: 'stays', tags: ['written'], speaker: 'npc_ilyra', text: 'Then I will be here, with the ink, until you change your mind.', next: 'end' },
      // q_voices_in_the_stacks
      {
        id: 'night',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'At night the Library speaks. One voice, over and over, and it is mine, Wayfinder. I have never set foot in there after dark.',
        next: 'ask_voices',
      },
      {
        id: 'ask_voices',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'Wait with me there past the second watch. I want to hear what it says when it thinks no one is listening. Will you?',
        choices: offer('q_voices_in_the_stacks', "I'll wait with you.", 'Not tonight.', 'go_voices', 'refused_voices'),
      },
      { id: 'go_voices', tags: ['written'], speaker: 'npc_ilyra', text: 'Be in the stacks when the night watch comes, and do not light the lamp. I will find you; I know the shelves blind.', next: 'end' },
      { id: 'refused_voices', tags: ['written'], speaker: 'npc_ilyra', text: 'Then it can go on talking to itself. It has had five hundred years of practice.', next: 'end' },
      // q_the_danthe_line
      {
        id: 'seal',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: "The Keeper says the Door of Pages opens to one seal, and no one living carries it. This is the Remnants' seal. I have worn it since I was twelve.",
        next: 'ask_door',
      },
      {
        id: 'ask_door',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'Come down to the Reach with me and let me try it on the door. If it opens, I want to know why. Will you?',
        choices: offer('q_the_danthe_line', "We'll try it.", 'Not yet.', 'go_door', 'refused_door'),
      },
      { id: 'go_door', tags: ['written'], speaker: 'npc_ilyra', text: 'Below the Archives, past the lamps. Keep the lantern lit; I will keep the seal dry.', next: 'end' },
      { id: 'refused_door', tags: ['written'], speaker: 'npc_ilyra', text: 'Then the door keeps its secret a little longer. It is good at that.', next: 'end' },
      // the deliberate tear
      {
        id: 'thin',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'I know where the Library is thin now. I can open it on purpose, Wayfinder, if you need to go. It will cost what it costs.',
        choices: [
          { id: 'open', text: 'Open it.', effects: [{ setFlag: 'flag_library_portal_open' }], next: 'opens' },
          { id: 'not_now', text: 'Not now.', next: 'end' },
        ],
      },
      { id: 'opens', tags: ['written'], speaker: 'npc_ilyra', text: 'Then go to the Library. I will be there before you, and I will hold it until you step through.', next: 'end' },
    ],
  },

  // ==== Ilyra · q_voices_in_the_stacks =======================================================================================

  {
    id: 'scene_ilyra_voices_waiting',
    npcId: 'npc_ilyra',
    when: { all: [NOT_IN_HORDE, { any: [{ quest: { id: 'q_voices_in_the_stacks', stage: 'stacks' } }, { quest: { id: 'q_voices_in_the_stacks', stage: 'second_watch' } }] }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['written'], speaker: 'npc_ilyra', text: 'The stacks, after dark. Wait through the night watch; it does not speak to anyone in a hurry.', next: 'end' }],
  },
  // STORY §11.4 stage 3: the whispers were verse I, looped, in her voice; the question, and her watchword. STORY §7.1: letting
  // her read the Litany aloud is a loyalty beat (+3, once a loop).
  {
    id: 'scene_ilyra_voices_ask',
    npcId: 'npc_ilyra',
    title: 'The ink still holds',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_voices_in_the_stacks', stage: 'ask' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'heard',
    nodes: [
      {
        id: 'heard',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'I sat where you sat. The stone kept it: one verse, over and over, in a voice I know in the dark. It is mine, and older than I am.',
        choices: [
          { id: 'read_aloud', text: 'Read it to me.', oncePerLoop: true, effects: loyaltyFor(['ilyra']), next: 'verse' },
          { id: 'go_on', text: 'Go on.', next: 'question' },
        ],
      },
      { id: 'verse', tags: ['story'], speaker: 'npc_ilyra', text: VERSE_ONE, next: 'question' },
      {
        id: 'question',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'Say it, then. You have been carrying a question since the Ruins.',
        choices: [
          { id: 'what_would', text: 'What would you say to someone who claimed to know you?', effects: [{ questAdvance: { quest: 'q_voices_in_the_stacks', stage: 'watchword' } }], next: 'answer' },
          { id: 'not_yet', text: 'Nothing yet.', next: 'end' },
        ],
      },
      {
        id: 'answer',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: '...The ink still holds. Nobody has heard me say it. If you ever come to me with those words, Wayfinder, I will believe whatever follows them.',
        next: 'end',
      },
    ],
  },

  // ==== Ilyra · q_the_danthe_line ============================================================================================

  {
    id: 'scene_ilyra_danthe_line_waiting',
    npcId: 'npc_ilyra',
    when: { all: [NOT_IN_HORDE, { any: [{ quest: { id: 'q_the_danthe_line', stage: 'door' } }, { quest: { id: 'q_the_danthe_line', stage: 'carrel' } }] }] },
    priority: SCENE_PRIORITY.waiting,
    entry: [
      { when: { quest: { id: 'q_the_danthe_line', stage: 'carrel' } }, node: 'carrel' },
      { when: { all: [] }, node: 'door' },
    ],
    nodes: [
      { id: 'door', tags: ['written'], speaker: 'npc_ilyra', text: "The Scriptorium, west of the Lamplighters' Rest. Take me to the door; I will not try the seal without you.", next: 'end' },
      { id: 'carrel', tags: ['written'], speaker: 'npc_ilyra', text: 'The carrel under the east stair, where the Archivist reads. Take me there. I think she is waiting.', next: 'end' },
    ],
  },
  // STORY §13: Oriel's carrel. No npc: the Archives' enter event opens it while the quest stands at `carrel` and Ilyra is in the
  // party. Oriel speaks as the Drowned Archivist. Ilyra: the ring (Remnants +10, Oriel's Ring, the lineage openly) or leaves it
  // (Remnants −5, the Unbound Hand, read through the stage `left`); the Wayfinder may Listen for verse I in Oriel's voice.
  // The First Drowned is met either way (`echo_oriel_drowned`), and the scroll changes hands if `q_lost_scroll` is open.
  {
    id: 'scene_the_first_drowned',
    title: "Oriel's carrel",
    when: { all: [{ quest: { id: 'q_the_danthe_line', stage: 'carrel' } }, ILYRA_IN_PARTY] },
    priority: SCENE_PRIORITY.decision,
    entry: 'sodden',
    nodes: [
      { id: 'sodden', tags: ['legacy'], speaker: 'narrator', text: 'A sodden scholar bound to drowned pages, still guarding secrets.', next: 'reading' },
      { id: 'reading', tags: ['story'], speaker: 'narrator', text: 'She does not rise. She is reading.', next: 'seal_up' },
      { id: 'seal_up', tags: ['written'], speaker: 'narrator', text: 'Ilyra holds up the seal.', next: 'ours' },
      { id: 'ours', tags: ['story'], speaker: 'npc_ilyra', text: 'This is ours. This is— whose is it?', next: 'lifts' },
      {
        id: 'lifts',
        tags: ['story'],
        speaker: 'narrator',
        text: 'The Archivist lifts her head. Her eyes are ink. She looks at the seal, and at Ilyra\'s face, and at the seal.',
        next: 'voice',
      },
      { id: 'voice', tags: ['written'], speaker: 'narrator', text: 'When she speaks it is a voice like a page turning.', next: 'written' },
      {
        id: 'written',
        tags: ['story'],
        speaker: 'cr_drowned_archivist',
        text: 'Let it be written as it is done. You have my hands. Who taught you to hold a pen like that?',
        onEnter: [{ grantEcho: 'echo_oriel_drowned' }, { questAdvance: { quest: 'q_the_danthe_line', stage: 'oriel' } }],
        next: 'nobody',
      },
      { id: 'nobody', tags: ['story'], speaker: 'npc_ilyra', text: 'Nobody. I always—', next: 'scroll' },
      {
        id: 'scroll',
        tags: ['story'],
        speaker: 'cr_drowned_archivist',
        text: 'Yes. Take the scroll. I have read it enough. Tell them the ink still holds. Tell them.',
        // STORY: q_lost_scroll stage 2 if open — the scroll is hers to give
        onEnter: [{ onlyIf: { when: { quest: { id: 'q_lost_scroll', stage: 'recover' } }, effects: [{ giveItem: { item: 'item_scholars_lost_scroll' } }] } }],
        next: 'ring',
      },
      {
        id: 'ring',
        tags: ['written'],
        speaker: 'narrator',
        text: "On the carrel, by the scroll, a seal-ring. The Archivist's hand has slipped off it.",
        choices: [
          { id: 'listen', text: 'Listen.', when: FROM_LOOP_2, once: true, tags: ['echo'], next: 'listened' },
          {
            id: 'take',
            text: 'Take the ring.',
            effects: [{ giveItem: { item: 'item_oriels_ring' } }, { rep: { faction: 'remnants', delta: 10 } }, { questAdvance: { quest: 'q_the_danthe_line', stage: 'taken' } }],
            next: 'took',
          },
          { id: 'leave', text: 'Leave it.', effects: [{ rep: { faction: 'remnants', delta: -5 } }, { questAdvance: { quest: 'q_the_danthe_line', stage: 'left' } }], next: 'left' },
        ],
      },
      { id: 'listened', tags: ['written'], speaker: 'narrator', text: 'You hold the Amulet to the water, and the verse comes up through it in her voice.', next: 'verse' },
      { id: 'verse', tags: ['story'], speaker: 'narrator', text: VERSE_ONE, onEnter: [{ grantEcho: 'echo_litany_verse_1' }], next: 'ring' },
      { id: 'took', tags: ['written'], speaker: 'npc_ilyra', text: 'It fits. Of course it fits. Then I am hers, and I will carry it where she cannot.', next: 'end' },
      {
        id: 'left',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'No. She can keep her ring and her claim. I hold a pen the way I hold it; nobody taught me, and nobody owns it.',
        next: 'end',
      },
    ],
  },

  // ==== Keeper Dray · q_the_keepers_price ====================================================================================

  // U34f (D-113 "Dray's tie"): while both of Dray's offers stand — U53's Ledger (`scene_dray_keepers_ledger_offer`, the
  // `offer` band, first in content order) and Ilyra's table below — a refused Ledger would win every talk and hide the
  // Keeper's Price. So, while both stand, this hub (the `report` band, as Blood and Salt's Peaks-refuser offer) lets the
  // player pick either; each opens its own scene, and a refusal in either brings the hub back on the next talk.
  {
    id: 'scene_dray_offers',
    npcId: 'npc_ansel_dray',
    title: 'Two pages',
    when: {
      all: [
        NOT_IN_HORDE,
        FROM_LOOP_2,
        // scene_dray_keepers_ledger_offer's own `when` (dialogues/factions.ts)
        REMNANTS_TRUSTED,
        { not: { quest: { id: 'q_keepers_ledger' } } },
        // scene_dray_keepers_price's (below)
        { loyalty: { companion: 'ilyra', min: 50 } },
        ILYRA_IN_PARTY,
        { echo: 'echo_ilyra_cost' },
        { not: { quest: { id: 'q_the_keepers_price' } } },
      ],
    },
    priority: SCENE_PRIORITY.report,
    entry: 'pages',
    nodes: [
      {
        id: 'pages',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'Two pages open on my table tonight: the empty line in the Ledger, and what Ilyra should hear from me. Which first?',
        choices: [
          { id: 'ledger', text: 'The empty line.', effects: [{ startDialogue: 'scene_dray_keepers_ledger_offer' }], next: 'end' },
          { id: 'ilyra', text: 'What Ilyra should hear.', effects: [{ startDialogue: 'scene_dray_keepers_price' }], next: 'end' },
          { id: 'neither', text: 'Neither, tonight.', next: 'end' },
        ],
      },
    ],
  },

  // STORY §11.4: the ask, the telling and Ilyra's choice at one table (Ilyra Loyal and in the party; the cost known or the
  // Ledger done). Keeper: Remnants +15, the Keeper's Echo at Trusted (checked after the +15). Never again: the oath, read
  // through the stage. The telling grants `echo_ilyra_cost` (STORY §12 "or Keeper Dray").
  {
    id: 'scene_dray_keepers_price',
    npcId: 'npc_ansel_dray',
    title: "The Keeper's price",
    when: {
      all: [
        NOT_IN_HORDE,
        FROM_LOOP_2,
        { loyalty: { companion: 'ilyra', min: 50 } },
        ILYRA_IN_PARTY,
        { any: [{ echo: 'echo_ilyra_cost' }, { quest: { id: 'q_keepers_ledger', status: 'completed' } }] },
        { not: { quest: { id: 'q_the_keepers_price' } } },
      ],
    },
    priority: SCENE_PRIORITY.offer,
    entry: 'both',
    nodes: [
      {
        id: 'both',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: "Sit, both of you. Ilyra, you will tear the Library open one day; every strong Ley-hand in my book did. I know what it costs. You do not.",
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'Let her hear it from me, Wayfinder, before she learns it from her hands. Will you?',
        choices: offer('q_the_keepers_price', 'Tell her.', 'Not now.', 'years', 'refused'),
      },
      {
        id: 'years',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'Every Ley-hand who tore that portal is in my book: the year she tore it, the year she died. Each one costs years she will not get back.',
        onEnter: [{ grantEcho: 'echo_ilyra_cost' }, { questAdvance: { quest: 'q_the_keepers_price', stage: 'telling' } }],
        next: 'keeper_way',
      },
      {
        id: 'keeper_way',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: "There is another way. The Keeper's. It costs everything and keeps everything: a Keeper remembers every day of every year, and tears nothing.",
        next: 'ilyra',
      },
      { id: 'ilyra', tags: ['story'], speaker: 'npc_ilyra', text: "I don't want to hold the door forever. I want to understand why it needs holding.", next: 'choose' },
      {
        id: 'choose',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'Then understand it from inside, or swear off it. The eighth line is yours to fill either way, Ilyra. Choose.',
        onEnter: [{ questAdvance: { quest: 'q_the_keepers_price', stage: 'choose' } }],
        choices: [
          {
            id: 'keeper',
            text: "Let her take the Keeper's way.",
            effects: [
              { rep: { faction: 'remnants', delta: 15 } },
              { onlyIf: { when: REMNANTS_TRUSTED, effects: [{ grantEcho: 'echo_portal_tear' }] } },
              { questAdvance: { quest: 'q_the_keepers_price', stage: 'keeper' } },
            ],
            next: 'remembers',
          },
          { id: 'never', text: 'Let her swear it: never again.', effects: [{ questAdvance: { quest: 'q_the_keepers_price', stage: 'unbound_hand' } }], next: 'sworn' },
        ],
      },
      {
        id: 'remembers',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'Then I will be the one who remembers. Write it in pencil, Keeper; I will ink it myself when I know how it ends.',
        next: 'thin',
      },
      {
        id: 'thin',
        tags: ['written'],
        speaker: 'npc_ansel_dray',
        text: 'Good. Then I will show you where the Library is thin, and you will open it only on purpose, and only once you are sure.',
        textVariants: [{ when: { not: REMNANTS_TRUSTED }, text: 'Good. When the Remnants trust you as I do, I will show you where the Library is thin. Not before.' }],
        next: 'end',
      },
      {
        id: 'sworn',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'Never again. Not this loop; not while there is another way. If the day comes, Wayfinder, I will stand beside you with my hands at my sides.',
        next: 'unbound',
      },
      { id: 'unbound', tags: ['written'], speaker: 'npc_ansel_dray', text: 'An unbound hand. The Archive has had Keepers; it has not had one of those. I will write that down too.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: 'npc_ansel_dray', text: 'Then she will learn it the way the others did. I will keep the page ruled.', next: 'end' },
    ],
  },

  // ==== Ilyra · camp conversations (DESIGN §12.7; STORY §7.1 voice) ===========================================================

  {
    id: 'scene_ilyra_camp_1',
    title: 'The ninth copy',
    when: ILYRA_IN_PARTY,
    priority: 3,
    repeatable: false,
    entry: 'copies',
    nodes: [
      {
        id: 'copies',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Ilyra copies a page by the fire, her lips moving with the lines.',
        // STORY §12 `echo_ilyra_bond`: a bond remembered
        textVariants: [{ when: { echo: 'echo_ilyra_bond' }, text: 'Ilyra copies a page by the fire, her lips moving with the lines. She sits as if she had sat at this fire with you before.' }],
        next: 'ninth',
      },
      {
        id: 'ninth',
        tags: ['story'],
        speaker: 'npc_ilyra',
        text: 'I have copied this page nine times and the ninth copy is different. The ink is correcting me.',
        choices: [
          { id: 'what_page', text: 'What is the page?', next: 'page' },
          { id: 'sleep', text: 'Sleep, Ilyra.', next: 'sleep' },
        ],
      },
      {
        id: 'page',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: "Oriel Danthe's record of the Conflux, the part we have. The ninth copy says Witness where the eighth said Watcher. I did not change it.",
        next: 'keep',
      },
      { id: 'keep', tags: ['written'], speaker: 'npc_ilyra', text: 'I will keep both. The Archive keeps everything, and one of them is a lie I cannot find yet.', next: 'end' },
      { id: 'sleep', tags: ['written'], speaker: 'npc_ilyra', text: 'I will, when the ink dries. Go on. The whispers keep me company; they always have.', next: 'end' },
    ],
  },
  {
    id: 'scene_ilyra_camp_2',
    title: 'A hand on the lid',
    when: { all: [ILYRA_IN_PARTY, { loyalty: { companion: 'ilyra', min: 25 } }] },
    priority: 2,
    repeatable: false,
    entry: 'lid',
    nodes: [
      {
        id: 'lid',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'The Remnants say the thing at the Apex is a wound with a lid on it. I said it too. Now I think it is a hand on the lid.',
        choices: [
          { id: 'what_then', text: 'What would you do with it?', next: 'held' },
          { id: 'sleep', text: 'Sleep on it.', next: 'end' },
        ],
      },
      {
        id: 'held',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'Hold it better. Not kill it; nothing we have killed here has stayed dead. Hold it so that it does not hurt. I do not know yet what that means.',
        next: 'hands',
      },
      {
        id: 'hands',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: 'My hands know something I do not. When I am near the Library they ache. I would like to understand why, before they decide for me.',
        next: 'end',
      },
    ],
  },
  {
    id: 'scene_ilyra_camp_3',
    title: 'The shape of what was said',
    when: { all: [ILYRA_IN_PARTY, { loyalty: { companion: 'ilyra', min: 50 } }] },
    priority: 1,
    repeatable: false,
    entry: 'listen',
    nodes: [
      {
        id: 'listen',
        tags: ['story'],
        speaker: 'npc_ilyra',
        text: 'Listen. Not with your ears. The stone keeps the shape of what was said in front of it.',
        choices: [
          { id: 'listen', text: 'Listen.', next: 'shape' },
          { id: 'later', text: 'Later.', next: 'end' },
        ],
      },
      {
        id: 'shape',
        tags: ['written'],
        speaker: 'npc_ilyra',
        text: "There. Under the fire's noise. Someone said a verse here once, and the stones are still saying it back, slower each year.",
        textVariants: [
          {
            when: { echo: 'echo_oriel_lineage' },
            text: "There. Under the fire's noise. Someone said a verse here once, and the stones are still saying it back. I know the voice now; I was born with it.",
          },
        ],
        next: 'enough',
      },
      { id: 'enough', tags: ['written'], speaker: 'npc_ilyra', text: 'That is enough for tonight. Sleep, Wayfinder. I will listen a little longer; it is what I am for.', next: 'end' },
    ],
  },

  // ==== Brak · déjà vu (STORY §5.2, §6.4) ===================================================================================

  {
    id: 'scene_brak_deja_vu',
    npcId: 'npc_brak',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, { flag: 'flag_scene_done_scene_brak_clear_path_offer' }] },
    priority: SCENE_PRIORITY.dejaVu,
    repeatable: false,
    entry: byTier('tier5', 'tier3', 'fire'),
    nodes: [
      { id: 'fire', tags: ['story'], speaker: 'npc_brak', text: "You walk into my camp like you've sat at this fire before. Have we met?", next: 'ache' },
      { id: 'ache', tags: ['story'], speaker: 'npc_brak', text: "My axe hand aches when you're about. Old wound I don't remember getting.", next: 'end' },
      {
        id: 'tier3',
        tags: ['story'],
        speaker: 'npc_brak',
        text: "Had a dream I was standing in a door that wasn't a door, telling someone to run. Woke up angry and couldn't say at who.",
        next: 'end',
      },
      { id: 'tier5', tags: ['story'], speaker: 'npc_brak', text: "Tell me straight. Do I die? ...Don't answer. I saw your face. Stonehand's boys never could keep a face.", next: 'end' },
    ],
  },

  // ==== Brak · his offers: recruitment, the Ring, the salt, the Apex (one fire, so a refusal blocks nothing) =====================

  // DESIGN §12.1 / STORY §7.2 recruitment: after q_clear_path in any loop, Ironclad ≥ Neutral; the Outpost offer wins the tie,
  // so he joins for the Outpost. The Oath (Loop 2+, the Outpost done) recruits him on accepting if he is not in the roster.
  // Blood and Salt is here from the Peaks on (its first offer to a Peaks-refuser is scene_brak_blood_and_salt_offer, below).
  // The Line (STORY §11.4 / §7.2): told, proved, chosen; telling him the truth is a loyalty beat (+3); the three choices carry
  // DESIGN §13.3 ex. 5's effects (A verbatim, then the leave-taking and the advance); C needs Blood and Salt's A, greyed without.
  {
    id: 'scene_brak_arc',
    npcId: 'npc_brak',
    title: 'Brak',
    when: { all: [NOT_IN_HORDE, { any: [BRAK_RECRUIT_OK, OATH_OK, SALT_OK, LINE_OK] }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'hub',
    nodes: [
      {
        id: 'hub',
        tags: ['written'],
        speaker: 'npc_brak',
        text: '...What.',
        choices: [
          { id: 'come', text: 'Come with me.', when: BRAK_RECRUIT_OK, effects: [{ recruit: 'brak' }], next: 'packed' },
          { id: 'ring', text: 'About the Ring of Wagons.', when: OATH_OK, next: 'season' },
          { id: 'salt', text: 'About the salt.', when: SALT_OK, next: 'short' },
          { id: 'apex', text: 'About the Apex.', when: LINE_OK, next: 'look' },
          // U59: the Warden's quest (the hub's `when` is unchanged: his own offer scene opens by `talk` when the hub does not)
          { id: 'wall', text: 'About the barricade.', when: WALL_OK, tags: ['class'], effects: [{ startDialogue: 'scene_brak_wall_offer' }], next: 'end' },
          { id: 'nothing', text: 'Nothing.', next: 'end' },
        ],
      },
      // recruitment
      { id: 'packed', tags: ['written'], speaker: 'npc_brak', text: "Peaks are quiet. The Outpost won't be. Two golems, and you. I'm coming. Don't argue; I've packed.", next: 'front' },
      { id: 'front', tags: ['written'], speaker: 'npc_brak', text: 'Good. Steel in front, you behind. Try not to glow at anything that bites.', next: 'end' },
      // q_the_scouts_oath
      { id: 'season', tags: ['written'], speaker: 'npc_brak', text: "Camp reports to the Ring every season. Season's up. Two days of ash east, and things on it that bite.", next: 'ask_ring' },
      {
        id: 'ask_ring',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "Ride with me. I'd sooner have you at my back than the wind. Will you?",
        choices: [
          { id: 'yes', text: "I'll ride with you.", effects: [{ recruit: 'brak' }, { questStart: 'q_the_scouts_oath' }], next: 'dawn' },
          { id: 'no', text: 'Not this season.', next: 'alone' },
        ],
      },
      { id: 'dawn', tags: ['written'], speaker: 'npc_brak', text: "Dawn, then. Off-foot back on the ash; it slides. If a jackal gets up, it's not alone.", next: 'end' },
      { id: 'alone', tags: ['written'], speaker: 'npc_brak', text: 'Then I ride alone. Faster, anyway. Quieter.', next: 'end' },
      // q_blood_and_salt
      ...saltAsk(),
      // q_the_line_he_holds
      {
        id: 'look',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "You've got that look again. Like you've watched me do something stupid and can't decide whether to say so.",
        choices: [
          { id: 'tell', text: "You die at the Apex. I've watched it.", effects: [...loyaltyFor(['brak']), { questStart: 'q_the_line_he_holds' }], next: 'no_i_would' },
          { id: 'not_now', text: 'Not now.', next: 'end' },
        ],
      },
      { id: 'no_i_would', tags: ['written'], speaker: 'npc_brak', text: "...No. I'd remember dying. ...Say it again.", next: 'shoulders' },
      {
        id: 'shoulders',
        tags: ['written'],
        speaker: 'narrator',
        text: 'He does not believe it. His shoulders do; they have set themselves the way scouts are taught, the off-foot back.',
        next: 'prove',
      },
      {
        id: 'prove',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "Prove it. What colour's the floor up there? Or tell me what I said. I'd have said something.",
        onEnter: [{ questAdvance: { quest: 'q_the_line_he_holds', stage: 'proof' } }],
        choices: [
          { id: 'colour', text: 'No colour. There is no floor up there, only seams folding under your feet.', effects: [{ questAdvance: { quest: 'q_the_line_he_holds', stage: 'choose' } }], next: 'believes' },
          { id: 'words', text: "You said: go. I'll hold them back as long as I can. Don't look back.", effects: [{ questAdvance: { quest: 'q_the_line_he_holds', stage: 'choose' } }], next: 'believes' },
        ],
      },
      { id: 'believes', tags: ['written'], speaker: 'npc_brak', text: "...That's what I'd say. That's exactly what I'd say. All right. All right, then.", next: 'choose' },
      {
        id: 'choose',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "Then it's mine to choose. Tell me what you'd have me do, and I'll tell you what I'll do.",
        choices: [
          {
            id: 'stay',
            text: 'Stay at the Ring. Live.',
            effects: [
              { setFlag: 'flag_brak_kept_away' },
              { loyalty: { companion: 'brak', delta: 5 } },
              { rep: { faction: 'ironclad', delta: 10 } },
              { dismiss: 'brak' },
              { questAdvance: { quest: 'q_the_line_he_holds', stage: 'kept_away' } },
            ],
            next: 'ring_fire',
          },
          {
            id: 'come_anyway',
            text: 'Come anyway. See it.',
            effects: [{ loyalty: { companion: 'brak', delta: 5 } }, { rep: { faction: 'ironclad', delta: 10 } }, { questAdvance: { quest: 'q_the_line_he_holds', stage: 'comes_anyway' } }],
            next: 'see',
          },
          {
            id: 'nexus',
            text: 'Hold the Nexus instead. The Horde is thinner there.',
            disabledWhen: { not: { quest: { id: 'q_blood_and_salt', stage: 'spoke' } } },
            disabledText: "(He would need his brother's salt, and his brother's word)",
            effects: [
              { loyalty: { companion: 'brak', delta: 5 } },
              { rep: { faction: 'ironclad', delta: 10 } },
              { grantEcho: 'echo_brak_lives' },
              { questAdvance: { quest: 'q_the_line_he_holds', stage: 'holds_nexus' } },
            ],
            next: 'nexus_line',
          },
        ],
      },
      {
        id: 'ring_fire',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "The Ring. I'll sit at Hadda's fire and hate every hour of it. Go on without me, Wayfinder. Don't look back; I said that already, apparently.",
        next: 'end',
      },
      { id: 'see', tags: ['written'], speaker: 'npc_brak', text: "I'm coming anyway. To see it. If it goes the way you say, it goes the way you say. One of them runs out.", next: 'end' },
      {
        id: 'nexus_line',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "The Nexus, then. Kaelen's salt in my pack and his whetstone on my axe. The Horde's thinner there; I'll hold it where it can be held.",
        next: 'end',
      },
    ],
  },

  // ==== Brak · q_the_scouts_oath =============================================================================================

  {
    id: 'scene_brak_scouts_oath_waiting',
    npcId: 'npc_brak',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_the_scouts_oath', status: 'active' } }, { not: { quest: { id: 'q_the_scouts_oath', stage: 'oath' } } }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['written'], speaker: 'npc_brak', text: 'East. The Gate, the Flats, the Ring. Stop talking to me here and ride.', next: 'end' }],
  },
  // STORY §11.4 stage 3 / §7.2: Hadda calls him "Brak of the Ironclad"; that night he says the other name once. The oath-brother's
  // word (STORY §12 `echo_ironclad_oath`: the engine grants it at a loop's end with the Ironclad Trusted; the Echo is read here).
  {
    id: 'scene_hadda_scouts_oath',
    npcId: 'npc_hadda_ironvow',
    title: 'Brak of the Ironclad',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_the_scouts_oath', stage: 'oath' } }, BRAK_IN_PARTY] },
    priority: SCENE_PRIORITY.report,
    entry: 'names',
    nodes: [
      {
        id: 'names',
        tags: ['written'],
        speaker: 'npc_hadda_ironvow',
        text: 'Brak of the Ironclad. Sit. You rode the Flats with a stranger at your back and lost nothing; the fire will hear your report.',
        next: 'report',
      },
      {
        id: 'report',
        tags: ['written'],
        speaker: 'narrator',
        text: 'He reports: the Peaks, the Outpost, the count of the dead, in fragments. Hadda hears it to the end and nods once.',
        next: 'night',
      },
      {
        id: 'night',
        tags: ['written'],
        speaker: 'narrator',
        text: 'That night the fire burns low. Brak sits with his back to a stone and his axe across his knees, and says the other name once.',
        next: 'name',
      },
      { id: 'name', tags: ['written'], speaker: 'npc_brak', text: 'Stonehand.', next: 'word' },
      {
        id: 'word',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "Don't say it back. Say it once and you give it away; that's the oath. Your word now, Wayfinder. Oath-brother's. You don't repeat it either.",
        textVariants: [
          {
            when: { echo: 'echo_ironclad_oath' },
            text: "Don't say it back. Say it once and you give it away; that's the oath. Your word now, Wayfinder. Oath-brother's. I'd swear you've given it to me before.",
          },
        ],
        choices: [
          { id: 'word', text: 'You have my word.', effects: [...loyaltyFor(['brak']), { questAdvance: { quest: 'q_the_scouts_oath', stage: 'named' } }], next: 'kept' },
          { id: 'keep', text: 'I keep my word to myself.', effects: [{ questAdvance: { quest: 'q_the_scouts_oath', stage: 'named' } }], next: 'kept_quiet' },
        ],
      },
      { id: 'kept', tags: ['written'], speaker: 'npc_brak', text: "Then that's two of us holding it. Here. The whistle. One note at any fire, and I come.", next: 'end' },
      { id: 'kept_quiet', tags: ['written'], speaker: 'npc_brak', text: 'Fair. A word kept is a word kept. Here. The whistle, anyway. One note at any fire, and I come.', next: 'end' },
    ],
  },

  // ==== Brak and Kaelen · q_blood_and_salt ===================================================================================

  // Loop 1 open (D-067.17). The first offer to one who has heard the Peaks offer and never taken it (WORLD §10.8's pacifist
  // route): the `report` band outranks the legacy Peaks offer, which otherwise wins every tie; one refusal (`oncePerLoop`)
  // sends the offer to the hub above, which the Peaks offer then outranks until the Peaks are taken.
  {
    id: 'scene_brak_blood_and_salt_offer',
    npcId: 'npc_brak',
    title: 'Salt for the camp',
    when: {
      all: [
        NOT_IN_HORDE,
        { flag: 'flag_scene_done_scene_brak_clear_path_offer' },
        { not: { quest: { id: 'q_clear_path' } } },
        { not: { quest: { id: 'q_blood_and_salt' } } },
        { not: { flag: 'flag_choice_scene_brak_blood_and_salt_offer_no' } },
      ],
    },
    priority: SCENE_PRIORITY.report,
    entry: 'short',
    nodes: saltAsk().map((n) => (n.id === 'ask_salt' ? { ...n, choices: n.choices?.map((c) => (c.id === 'no' ? { ...c, oncePerLoop: true } : c)) } : n)),
  },
  // STORY §5.2 / §11.4: with the dropped name, Kaelen gives the quest (the shortcut opens it at `kaelen`).
  {
    id: 'scene_kaelen_blood_and_salt_offer',
    npcId: 'npc_kaelen_stonehand',
    title: "Don't say that name",
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, { echo: 'echo_brak_birth_name' }, { not: { quest: { id: 'q_blood_and_salt' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'nearly',
    nodes: [
      { id: 'nearly', tags: ['written'], speaker: 'narrator', text: 'He sees you look at the salt sacks, and then at him, and he knows what you nearly said.', next: 'name' },
      { id: 'name', tags: ['story'], speaker: 'npc_kaelen_stonehand', text: "Don't say that name in here.", next: 'ask' },
      {
        id: 'ask',
        tags: ['written'],
        speaker: 'npc_kaelen_stonehand',
        text: 'Whatever he needs, it goes on the counter at the price on the board. Say what it is.',
        choices: [
          { id: 'salt', text: 'Your brother needs salt for the camp.', effects: [{ questStart: 'q_blood_and_salt' }], next: 'sack' },
          { id: 'nothing', text: 'Nothing. Salt for the road.', next: 'end' },
        ],
      },
      { id: 'sack', tags: ['written'], speaker: 'npc_kaelen_stonehand', text: "Then it's a sack of salt, and we'll see about the price.", next: 'end' },
    ],
  },
  // STORY §13 "Blood and salt" (Brak absent; this is why it works). With the dropped name: the whetstone, the salt free (given
  // if none is carried) → A. Without: four gold, no messages → B. Carrying the salt to him is a loyalty beat (STORY §7.2).
  {
    id: 'scene_braks_brother',
    npcId: 'npc_kaelen_stonehand',
    title: 'Blood and salt',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_blood_and_salt', stage: 'kaelen' } }, { any: [{ item: { id: SALT } }, { echo: 'echo_brak_birth_name' }] }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'greeting',
    nodes: [
      { id: 'greeting', tags: ['legacy'], speaker: 'npc_kaelen_stonehand', text: 'Steel and salt are all that keep you breathing out here.', next: 'sack' },
      {
        id: 'sack',
        tags: ['story'],
        speaker: 'npc_kaelen_stonehand',
        text: "You've got a sack of mine over your shoulder and a look I don't like. Who's it for.",
        textVariants: [{ when: { not: { item: { id: SALT } } }, text: "You've got a look I don't like. Who's it for." }],
        choices: [
          { id: 'brother', text: 'Your brother.', next: 'dont_have' },
          { id: 'later', text: 'Nobody. Not yet.', next: 'end' },
        ],
      },
      { id: 'dont_have', tags: ['story'], speaker: 'npc_kaelen_stonehand', text: "I don't have—", next: 'hands' },
      { id: 'hands', tags: ['story'], speaker: 'narrator', text: 'He puts both hands flat on the counter.', next: 'coat' },
      {
        id: 'coat',
        tags: ['story'],
        speaker: 'npc_kaelen_stonehand',
        text: 'He took the oath. You take the oath, you give the name back. He gave my name back, Wayfinder. Our father\'s. Like it was a coat.',
        choices: [
          echoLocked('echo_brak_birth_name', {
            id: 'said_it',
            text: 'He said it once. At the Ring, in the dark. Stonehand.',
            effects: [
              { onlyIf: { when: { not: { item: { id: SALT } } }, effects: [{ giveItem: { item: SALT } }] } },
              { giveItem: { item: 'item_fathers_whetstone' } },
              ...loyaltyFor(['brak']),
              { questAdvance: { quest: 'q_blood_and_salt', stage: 'to_brak_spoke' } },
            ],
            next: 'did_he',
          }),
          {
            id: 'only_salt',
            text: 'I only carry the salt.',
            effects: [...loyaltyFor(['brak']), { questAdvance: { quest: 'q_blood_and_salt', stage: 'to_brak_refused' } }],
            next: 'four_gold',
          },
        ],
      },
      { id: 'did_he', tags: ['story'], speaker: 'npc_kaelen_stonehand', text: '...Did he.', next: 'free' },
      {
        id: 'free',
        tags: ['story'],
        speaker: 'npc_kaelen_stonehand',
        text: "Salt's free. Take the whetstone too. It was Father's. Tell him— tell him it needs oiling, he never oiled anything.",
        next: 'end',
      },
      { id: 'four_gold', tags: ['story'], speaker: 'npc_kaelen_stonehand', text: "Salt's four gold. Don't come back with messages.", next: 'end' },
    ],
  },
  // STORY §7.2 outcomes: A, they will speak, the whetstone to Brak, Ironclad +10 (Named is read through the stage); B, nothing,
  // and he says it is fine.
  {
    id: 'scene_brak_blood_and_salt_report',
    npcId: 'npc_brak',
    when: { all: [NOT_IN_HORDE, { any: [{ quest: { id: 'q_blood_and_salt', stage: 'to_brak_spoke' } }, { quest: { id: 'q_blood_and_salt', stage: 'to_brak_refused' } }] }] },
    priority: SCENE_PRIORITY.report,
    entry: [
      { when: { quest: { id: 'q_blood_and_salt', stage: 'to_brak_spoke' } }, node: 'stone' },
      { when: { all: [] }, node: 'sack' },
    ],
    nodes: [
      {
        id: 'stone',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You set the sack down, and the whetstone on top of it. Brak looks at the stone a long time before he looks at you.',
        next: 'fathers',
      },
      { id: 'fathers', tags: ['written'], speaker: 'npc_brak', text: "That's Father's. He kept it. ...Needs oiling. He'd say that. He'd say I never oiled anything.", next: 'market' },
      {
        id: 'market',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "Tell him— no. I'll tell him. Market day. I'll stand at his counter and find the name for it.",
        onEnter: [
          { takeItem: { item: SALT } },
          { takeItem: { item: 'item_fathers_whetstone' } },
          { rep: { faction: 'ironclad', delta: 10 } },
          { questAdvance: { quest: 'q_blood_and_salt', stage: 'spoke' } },
        ],
        next: 'end',
      },
      { id: 'sack', tags: ['written'], speaker: 'narrator', text: 'You set the sack down. Brak counts it with his eyes and does not ask.', next: 'fine' },
      {
        id: 'fine',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "Good. Camp's short. ...He say anything? No. He wouldn't. It's fine.",
        onEnter: [{ takeItem: { item: SALT } }, { questAdvance: { quest: 'q_blood_and_salt', stage: 'fine' } }],
        next: 'not',
      },
      { id: 'not', tags: ['written'], speaker: 'narrator', text: 'It is not.', next: 'end' },
    ],
  },

  // ==== Brak · camp conversations (DESIGN §12.7; STORY §7.2 voice and stance) ==================================================

  {
    id: 'scene_brak_camp_1',
    title: 'Steel and stubbornness',
    when: BRAK_IN_PARTY,
    priority: 3,
    repeatable: false,
    entry: 'sharpens',
    nodes: [
      { id: 'sharpens', tags: ['written'], speaker: 'narrator', text: 'Brak sharpens the chipped axe by the fire. It is not getting sharper.', next: 'steel' },
      {
        id: 'steel',
        tags: ['story'],
        speaker: 'npc_brak',
        text: "Steel and stubbornness. One of them runs out. Make sure it's the steel.",
        choices: [
          { id: 'and_me', text: 'And me?', next: 'glow' },
          { id: 'sleep', text: 'Sleep, Brak.', next: 'watch' },
        ],
      },
      { id: 'glow', tags: ['story'], speaker: 'npc_brak', text: "I don't trust anything that glows. You glow a little, Wayfinder. I'm making an exception.", next: 'watch' },
      { id: 'watch', tags: ['written'], speaker: 'npc_brak', text: "I'll take the first watch. Scouts don't sleep first. Scouts don't sleep much.", next: 'end' },
    ],
  },
  {
    id: 'scene_brak_camp_2',
    title: 'Somebody has to',
    when: { all: [BRAK_IN_PARTY, { loyalty: { companion: 'brak', min: 25 } }] },
    priority: 2,
    repeatable: false,
    entry: 'salt',
    nodes: [
      {
        id: 'salt',
        tags: ['story'],
        speaker: 'npc_brak',
        text: 'My brother sells salt to people who are going to die anyway. Somebody has to.',
        textVariants: [
          { when: { echo: 'echo_brak_birth_name' }, text: "My brother sells salt to people who are going to die anyway. Somebody has to. You know his name. Mine, once. Don't use it." },
        ],
        choices: [
          { id: 'why', text: 'Why did you give the name back?', next: 'oath' },
          { id: 'leave_it', text: "I'll leave it.", next: 'end' },
        ],
      },
      {
        id: 'oath',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "The oath takes it. You come to the fire with nothing; the clan gives you a name that's only yours. He left before the fire. Kept Father's.",
        next: 'coat',
      },
      { id: 'coat', tags: ['written'], speaker: 'npc_brak', text: "He says I gave it back like a coat. Maybe. It was warm. It wasn't mine.", next: 'end' },
    ],
  },
  // STORY §7.2 stance: kill it; Loop 2+ hearing what it is, the man in the door; after an Exploit, the refusal (voiced here: the
  // Apex itself has no hook for it, see the header).
  {
    id: 'scene_brak_camp_3',
    title: 'A man in a door',
    when: { all: [BRAK_IN_PARTY, { loyalty: { companion: 'brak', min: 50 } }] },
    priority: 1,
    repeatable: false,
    entry: [
      { when: { flag: 'flag_heartstone_exploited' }, node: 'pack' },
      { when: { echo: 'echo_tyrant_jailer' }, node: 'man' },
      { when: { all: [] }, node: 'word' },
    ],
    nodes: [
      {
        id: 'word',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "The thing at the Apex. Everyone's got a word for it. The Remnants say wound. The Weavers say gate. We say kill it.",
        next: 'kill',
      },
      {
        id: 'kill',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "Kill it, then. Properly, with the hand that's for it. If it bleeds it dies; if it dies the Horde dies with it. That's the Telling.",
        next: 'end',
      },
      { id: 'man', tags: ['story'], speaker: 'npc_brak', text: "Then it's a man standing in a door. I've done that. You don't shoot the man. You find out what's behind him.", next: 'behind' },
      {
        id: 'behind',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "Whatever's behind him, it's worse than him. That's what a door's for. I'll hold the one I'm given and let you look.",
        next: 'end',
      },
      { id: 'pack', tags: ['story'], speaker: 'npc_brak', text: "That thing's in your pack hurting you and you want me to hold a line?", next: 'nexus_far' },
      {
        id: 'nexus_far',
        tags: ['written'],
        speaker: 'npc_brak',
        text: "I'll walk as far as the Nexus. I won't walk into the Apex behind that. Find somebody who glows more than you do.",
        next: 'end',
      },
    ],
  },

  // ==== Kaelen · déjà vu (STORY §5.2, §6.4) ==================================================================================

  {
    id: 'scene_kaelen_deja_vu',
    npcId: 'npc_kaelen_stonehand',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2] },
    priority: SCENE_PRIORITY.dejaVu,
    repeatable: false,
    entry: byTier('tier5', 'tier3', 'look'),
    nodes: [
      {
        id: 'look',
        tags: ['story'],
        speaker: 'npc_kaelen_stonehand',
        text: "You've got a look like a man who's already bought what he came for.",
        // STORY §12 `echo_kaelen_ledger`: he keeps a better account of you, for good
        textVariants: [
          {
            when: { echo: 'echo_kaelen_ledger' },
            text: "You've got a look like a man who's already bought what he came for. The ledger says you're good for it, and I don't remember writing that.",
          },
        ],
        next: 'end',
      },
      {
        id: 'tier3',
        tags: ['story'],
        speaker: 'npc_kaelen_stonehand',
        text: "You keep nearly saying my brother's name. Everyone who comes from the camp does. You do it like you've heard how it ends.",
        next: 'end',
      },
      { id: 'tier5', tags: ['story'], speaker: 'npc_kaelen_stonehand', text: "Salt. Steel. Whatever it is you're carrying between us this time, put it on the counter and I'll weigh it.", next: 'end' },
    ],
  },

  // ==== Borin · the Outpost done, then a word (STORY §12 `echo_borin_oath`; D-105 left it open) =============================

  {
    id: 'scene_borin_oath',
    npcId: 'npc_borin_stonefist',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_blighted_outpost', status: 'completed' } }, { not: { echo: 'echo_borin_oath' } }] },
    priority: SCENE_PRIORITY.payoff,
    repeatable: false,
    entry: 'measure',
    nodes: [
      { id: 'measure', tags: ['written'], speaker: 'npc_borin_stonefist', text: "Brak says you held the Outpost. The fire's taken your measure, then; she doesn't take it twice.", next: 'oath' },
      {
        id: 'oath',
        tags: ['written'],
        speaker: 'npc_borin_stonefist',
        text: "Speak plain, after this: the void-forged work is yours without the clan's say. That's my oath, not theirs. Don't make me regret it.",
        onEnter: [{ grantEcho: 'echo_borin_oath' }],
        next: 'end',
      },
    ],
  },
] satisfies DialogueSceneInput[];
