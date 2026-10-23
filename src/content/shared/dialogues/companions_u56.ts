// The scenes of Mireya's and Caelum's arcs and their camp conversations (STORY §11.4 the six quests; §13 `scene_caelum_crossing`
// and the one thing Veyran says to Caelum (`scene_ending_mending`'s lines); §7.5 and §7.6 the voices, recruitment, loyalty
// beats and stances; §9.6 how Caelum comes forward; §2.3 verses V and VI; DESIGN §12.1 recruitment, §12.5 loyalty, §12.7 camp
// conversations; BIBLE §3.2: Mireya — herb names, weather, orders, kindness as instruction, no softness; Caelum — old-city
// formal, "Master —", the question he fears, never "sir"). The quests are ../quests/companions_u56.ts; the conventions are this
// folder's index.ts (U52's pattern, D-105, D-109; U54's and U55's files are the model, D-112, D-113). U56.
//
// Who says what, and when (priority bands from ./common.ts; every NPC scene is closed while the Horde runs):
//   Mireya, Lanternreed  scene_mireya_lantern_offer (Loop 1+: her ask; the elders say what the light is, `echo_glowlands_leak`;
//                        then she offers to come — the recruitment, DESIGN §12.1 "stage 1") · scene_mireya_recruit (the ask
//                        again, behind her offers) · scene_mireya_lantern_waiting · scene_mireya_tending (the moss, the root,
//                        the child: steady hands or not) · scene_mireya_light_offer (Loop 2+, loyalty 25; Wen's "No.") ·
//                        scene_mireya_preserve_offer (`echo_breathing_pool`, Loyal) · scene_mireya_lanternreed (nothing pending,
//                        by the arc's state)
//   Mireya, the Pool     scene_mireya_light_waiting (she has gone ahead) · scene_mireya_breathing_pool (Listen: verse VI,
//                        `echo_breathing_pool`; Sallow's name) · scene_mireya_preserve_or_heal (Wen refuses; ask the village;
//                        dam with either fragment, or let it run)
//   Mireya at camp       scene_mireya_camp_1 (a rest) · _2 (loyalty 25) · _3 (loyalty 50, the Pool heard)
//   Caelum, the Before   scene_caelum_errand_offer (the Garret, Last Bell at noon) · scene_caelum_errand_waiting ·
//                        scene_caelum_spire_yard (the Plaza's east terrace: Aulde's verse, `echo_litany_verse_5`; the honest
//                        answer; he joins — the recruitment, D-067.9) · scene_caelum_recruit (turned down, or sent away) ·
//                        scene_caelum_boy_offer (what you know) · scene_caelum_boy_waiting · scene_caelum_crossing (the Silver
//                        Gate, Last Bell after dusk: STORY §13, come or stay) · scene_caelum_garret (nothing pending, by Bell
//                        and state)
//   Caelum, the present  scene_caelum_sin_offer (the Nexus or the Apex, crossed, Loyal) · scene_caelum_sin_waiting ·
//                        scene_caelum_his_masters_sin (the Apex after the communion: the one thing, forgive or cannot) ·
//                        scene_caelum_present (nothing pending)
//   Caelum at camp       scene_caelum_camp_1 (a rest) · _2 (loyalty 25) · _3 (loyalty 50, crossed)
//
// Where the companions stand: their NPC records' `schedule` (D-102; the Glowfen's and the Before's npcs.ts) put Mireya at
// Lanternreed and the Pool while her second and third quests run, and Caelum at the Garret and the Plaza while the errand
// runs, at the Garret and the Silver Gate while the boy's quest runs, and — crossed — at the Nexus and the Apex instead of
// anywhere in the Before (STORY §9.6: "the stair at dusk has no boy on it"). A companion in the party is spoken to at a camp
// (DESIGN §12.7: `campScenes`, one per full rest, +2 loyalty from the engine; no `npcId`).
//
// Bands: `talk` opens the highest band, first in content order on a tie, so the recruit asks come before the quests'
// waiting lines and the "nothing pending" lines come last. STORY gives these scenes their beats and the lines marked
// `story` (§7.5 / §7.6's samples, §11.4's "It's a person", §13's crossing and the Mending's lines to Caelum, §2.3's verses);
// every other line is written (tag `written`, listed in the U56 reply and pinned by tests/unit/content/quests/companions_u56.test.ts).
//
// Not here, by design: the refusals of places STORY §7.5 / §7.6 give them (Mireya: the Glowfen while the sick are untended,
// Mirelings; Caelum: the Shattered Library before his second quest, the Heartstone exploited or destroyed, and the Before
// itself until he crosses) are U34f's `refusesWhen`; "Elder Wen Hostile" and "Lanternreed Bloom also Hastes" have no data
// form (the quest file's header); the Mending's pin scene (`scene_anchor_in_the_conflux`) and the ending scenes are U58's.
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY, echoLocked, loyaltyFor, type ChoiceInput, type NodeInput } from './common';
import { BITTERROOT, GLOW_MOSS } from '../quests/companions_u56';

// ---- Conditions used more than once -----------------------------------------------------------------------------------------

const MIREYA = 'npc_mireya';
const CAELUM = 'npc_caelum';
const WEN = 'npc_elder_wen';
const TAM = 'npc_elder_tam';
const AULDE = 'npc_seraphine_aulde';
const SALLOW = 'npc_imre_sallow';
const TYRANT = 'cr_chronos_tyrant_unveiled';

const AT_LANTERNREED: Condition = { location: 'loc_lanternreed' };
const AT_POOL: Condition = { location: 'loc_breathing_pool' };
const AT_GARRET: Condition = { location: 'loc_apprentices_garret' };
const AT_PLAZA: Condition = { location: 'loc_plaza_of_bells' };
const AT_GATE: Condition = { location: 'loc_silver_gate' };
const AT_NEXUS: Condition = { location: 'loc_chronos_nexus' };
const AT_APEX: Condition = { location: 'loc_temporal_breach_apex' };
/** The Before's echo (D-095): its own day counter, false outside it. */
const IN_THE_BEFORE: Condition = { any: [{ beforeDay: 1 }, { beforeDay: 2 }, { beforeDay: 3 }] };
const LAST_BELL: Condition = { beforeDay: 3 };
/** D-102: the Spire Yard's noon is the echo's own hour. */
const NOON: Condition = { watch: 'day' };

const MIREYA_RECRUITED: Condition = { companion: { id: 'mireya', state: 'recruited' } };
const CAELUM_RECRUITED: Condition = { companion: { id: 'caelum', state: 'recruited' } };
/** DESIGN §12.1: "not Hostile with Remnants" (§11.1: Hostile ≤ −40). */
const REMNANTS_NOT_HOSTILE: Condition = { rep: { faction: 'remnants', min: -39 } };

const stageOf = (quest: `q_${string}`, stage: string): Condition => ({ quest: { id: quest, stage } });
const doneAt = (quest: `q_${string}`, stage: string): Condition => ({ quest: { id: quest, stage, status: 'completed' } });
const completed = (quest: `q_${string}`): Condition => ({ quest: { id: quest, status: 'completed' } });
const notStarted = (quest: `q_${string}`): Condition => ({ not: { quest: { id: quest } } });

const LANTERN = 'q_lantern_in_the_reeds';
const LIGHT = 'q_what_the_light_takes';
const PRESERVE = 'q_preserve_or_heal';
const ERRAND = 'q_the_apprentices_errand';
const BOY = 'q_a_boy_from_a_doomed_city';
const SIN = 'q_his_masters_sin';

/** STORY §9.6: crossed this loop (the Echo alone is the profile's, any loop). */
const CROSSED: Condition = doneAt(BOY, 'crossed');
const MOSS_AND_ROOT: Condition = { all: [{ item: { id: GLOW_MOSS, count: 3 } }, { item: { id: BITTERROOT, count: 2 } }] };
const STABLE_FRAGMENT: Condition = { item: { id: 'item_heartstone_fragment_stable' } };
const DEAD_FRAGMENT: Condition = { item: { id: 'item_heartstone_fragment_dead' } };

/** The giver's ask: a yes that starts the quest, a no that goes to the refusal line. */
const offer = (questId: `q_${string}`, yes: string, no: string, afterYes: string, refused: string): ChoiceInput[] => [
  { id: 'yes', text: yes, effects: [{ questStart: questId }], next: afterYes },
  { id: 'no', text: no, next: refused },
];

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

/** The recruit choice and its refusal (one object: the lint reads a top-level object literal with an `id` as a content record). */
const RECRUIT = {
  mireya: { id: 'come', text: 'Come, then.', effects: [{ recruit: 'mireya' }], next: 'joins' },
  caelum: { id: 'come', text: 'Come with me.', effects: [{ recruit: 'caelum' }], next: 'good' },
} satisfies Record<string, ChoiceInput>;

export const dialogues = [
  // ==== Mireya at Lanternreed ====================================================================================================

  // STORY §11.4 stage 1 / §7.5: her ask (Loop 1 open, D-067.17); the elders say it plainly; she is recruitable after stage 1 and
  // says so herself. With `echo_glowlands_leak` the Echo line skips the telling (the quest opens at the gathering, its shortcut).
  {
    id: 'scene_mireya_lantern_offer',
    npcId: MIREYA,
    title: 'Steady hands',
    when: { all: [NOT_IN_HORDE, AT_LANTERNREED, notStarted(LANTERN)] },
    priority: SCENE_PRIORITY.offer,
    entry: 'knees',
    nodes: [
      { id: 'knees', tags: ['story'], speaker: MIREYA, text: 'Glow Moss for the wound, bitterroot for the fever, and sit down, I can see your knees.', next: 'three' },
      {
        id: 'three',
        tags: ['written'],
        speaker: MIREYA,
        text: 'Three of us are sick with the shining. Not fever-sick; the light has got into them and wants out through the skin. I need three Glow Moss, two bitterroot, and a pair of hands that do not shake. Yours look steady enough.',
        choices: [
          { id: 'yes', text: "I'll bring them.", effects: [{ questStart: LANTERN }], next: 'elders' },
          echoLocked('echo_glowlands_leak', { id: 'known', text: 'I know what the light is. Tell me what you need.', effects: [{ questStart: LANTERN }], next: 'hands' }),
          { id: 'no', text: 'Not now.', next: 'refused' },
        ],
      },
      {
        // STORY §11.4: "the elders say it plainly: the glow is the Breach, and the Apex is failing on its own"
        id: 'elders',
        tags: ['written'],
        speaker: TAM,
        text: 'The glow is the Breach. It leaks, and we drink it. The Apex is failing on its own; it never needed a hand.',
        onEnter: [{ grantEcho: 'echo_glowlands_leak' }, { questAdvance: { quest: LANTERN, stage: 'gather' } }],
        next: 'hands',
      },
      {
        id: 'hands',
        tags: ['written'],
        speaker: MIREYA,
        text: 'There. Now you know what we are. I am coming with you for the moss; you would bring me parsnip and call it bitterroot.',
        choices: [RECRUIT.mireya, { id: 'alone', text: "I'll manage alone.", next: 'stays' }],
      },
      { id: 'joins', tags: ['written'], speaker: MIREYA, text: 'Good. Rain by dusk; we go now and we come back dry. Do not touch the shelves that glow blue.', next: 'end' },
      {
        id: 'stays',
        tags: ['written'],
        speaker: MIREYA,
        text: 'Then three moss, two roots, and back before the rain. The Shallows grow both, if you can hold your breath; Fennick sells both, if you cannot.',
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: MIREYA, text: 'Then keep your hands in your pockets. The sick will keep too; that is what the shining does, it keeps them.', next: 'end' },
    ],
  },
  // DESIGN §12.1 / STORY §7.5: after stage 1, not Hostile with the Remnants; the ask again, ahead of her waiting lines
  {
    id: 'scene_mireya_recruit',
    npcId: MIREYA,
    title: 'Her basket',
    when: { all: [NOT_IN_HORDE, AT_LANTERNREED, { not: MIREYA_RECRUITED }, REMNANTS_NOT_HOSTILE, { quest: { id: LANTERN } }, { not: stageOf(LANTERN, 'sick') }] },
    priority: SCENE_PRIORITY.waiting,
    entry: [
      // DESIGN §12.5: the bond Echo (she starts this loop at 25); nobody remembers a loop, her hands do
      { when: { echo: 'echo_mireya_bond' }, node: 'before' },
      { when: completed(LANTERN), node: 'after' },
      { when: { all: [] }, node: 'gather' },
    ],
    nodes: [
      { id: 'before', tags: ['written'], speaker: MIREYA, text: 'I do not know you. My hands do; they went to your pack for the salve before I thought. Come on, then.', next: 'ask' },
      { id: 'gather', tags: ['written'], speaker: MIREYA, text: 'Still here, still short of hands. I am coming with you for the moss; nobody finds bitterroot by looking for it.', next: 'ask' },
      {
        id: 'after',
        tags: ['written'],
        speaker: MIREYA,
        text: "The fever's broken and the village is kind to you now, which it is not to many. Take me east when you go. I want to see where the light comes from, and Wen will not tell me.",
        next: 'ask',
      },
      { id: 'ask', tags: ['written'], speaker: 'narrator', text: 'She has her basket already.', choices: [RECRUIT.mireya, { id: 'later', text: 'Later.', next: 'stays' }] },
      { id: 'joins', tags: ['written'], speaker: MIREYA, text: 'Good. Boots on; the Causeway floods by dusk.', next: 'end' },
      { id: 'stays', tags: ['written'], speaker: MIREYA, text: 'Then I will be here, picking moss in the rain.', next: 'end' },
    ],
  },
  {
    id: 'scene_mireya_lantern_waiting',
    npcId: MIREYA,
    when: { all: [NOT_IN_HORDE, AT_LANTERNREED, { any: [stageOf(LANTERN, 'gather'), stageOf(LANTERN, 'tend')] }] },
    priority: SCENE_PRIORITY.waiting,
    entry: [
      { when: stageOf(LANTERN, 'tend'), node: 'bring' },
      { when: { all: [] }, node: 'short' },
    ],
    nodes: [
      { id: 'bring', tags: ['written'], speaker: MIREYA, text: 'You had three moss and two roots and now you have fewer. Fetch them again; the sick do not get better on good intentions.', next: 'end' },
      { id: 'short', tags: ['written'], speaker: MIREYA, text: 'Three moss, two bitterroot. The Shallows grow both under the shelves, and Fennick sells both at a price. Go on; the light does not wait.', next: 'end' },
    ],
  },
  // STORY §11.4 stage 3 / §7.5 "healing the changed without flinching": the moss and the root taken; the child; steady hands (+3)
  // or not (−10); Fenlight Salve ×3 is the quest's reward.
  {
    id: 'scene_mireya_tending',
    npcId: MIREYA,
    title: 'The shining',
    when: { all: [NOT_IN_HORDE, AT_LANTERNREED, stageOf(LANTERN, 'tend'), MOSS_AND_ROOT] },
    priority: SCENE_PRIORITY.decision,
    entry: 'sit',
    nodes: [
      {
        id: 'sit',
        tags: ['written'],
        speaker: MIREYA,
        text: 'Good. Moss here, root here, hands here. Sit her up for me.',
        onEnter: [{ takeItem: { item: GLOW_MOSS, count: 3 } }, { takeItem: { item: BITTERROOT, count: 2 } }],
        next: 'child',
      },
      {
        id: 'child',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The girl is nine and lit from the throat down. Mireya chews the root and spits it into the moss and binds it on, and the light under the skin pulls back from it like a tide. Then the girl opens her eyes, and they are Mireling-green, and she smiles.',
        next: 'stars',
      },
      {
        id: 'stars',
        tags: ['written'],
        speaker: 'narrator',
        text: "'I can see the stars,' she says. 'Under the water. There's so many.'",
        choices: [
          { id: 'hold', text: "Hold her still. Don't let go.", effects: [...loyaltyFor(['mireya']), { questAdvance: { quest: LANTERN, stage: 'tended' } }], next: 'steady' },
          { id: 'back', text: "I can't look at that.", effects: [...loyaltyFor([], ['mireya']), { questAdvance: { quest: LANTERN, stage: 'tended' } }], next: 'flinch' },
        ],
      },
      {
        id: 'steady',
        tags: ['written'],
        speaker: MIREYA,
        text: "That's it. Steady. She will see in the dark now, and she will never be cold, and in a year she will not be anyone's daughter. Hold her anyway. Salve's on the shelf; take three, you earned them.",
        next: 'end',
      },
      {
        id: 'flinch',
        tags: ['written'],
        speaker: MIREYA,
        text: "Then look at the wall and hold her hand where you cannot see it. She was a person last spring. She is a person now. Salve's on the shelf; take it and think about that.",
        next: 'end',
      },
    ],
  },

  // ---- q_what_the_light_takes: the offer (Loop 2+, loyalty 25); Wen's "No." ----------------------------------------------------
  {
    id: 'scene_mireya_light_offer',
    npcId: MIREYA,
    title: 'Where the glow is born',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, AT_LANTERNREED, completed(LANTERN), { loyalty: { companion: 'mireya', min: 25 } }, notStarted(LIGHT)] },
    priority: SCENE_PRIORITY.offer,
    entry: 'born',
    nodes: [
      {
        id: 'born',
        tags: ['written'],
        speaker: MIREYA,
        text: 'The Pool is where the glow is born. Below the village, where the water breathes. Wen keeps her mat at the edge and nobody goes past the mat.',
        next: 'anyway',
      },
      { id: 'anyway', tags: ['written'], speaker: WEN, text: 'No.', next: 'going' },
      {
        id: 'going',
        tags: ['written'],
        speaker: MIREYA,
        text: "I am going anyway. I want to know what it is before it finishes with us. The lantern-boat's way, through the Maze; that is how the village used to go, before Wen. Come with me.",
        choices: offer(LIGHT, "I'll come.", 'Not now.', 'maze', 'refused'),
      },
      { id: 'maze', tags: ['written'], speaker: MIREYA, text: 'The Shallows first. Hold your breath where the dust is thick, and follow the pulses; they go the right way.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: MIREYA, text: 'Then I go alone, and Wen can say no to the water.', next: 'end' },
    ],
  },
  {
    id: 'scene_mireya_light_waiting',
    npcId: MIREYA,
    when: { all: [NOT_IN_HORDE, { any: [AT_LANTERNREED, AT_POOL] }, { any: [stageOf(LIGHT, 'forbidden'), stageOf(LIGHT, 'pool')] }] },
    priority: SCENE_PRIORITY.waiting,
    entry: [
      { when: stageOf(LIGHT, 'pool'), node: 'ahead' },
      { when: { all: [] }, node: 'maze_first' },
    ],
    nodes: [
      { id: 'maze_first', tags: ['written'], speaker: MIREYA, text: "The Maze first, the lantern-boat's way. I am not sneaking past Wen's mat with you watching.", next: 'end' },
      { id: 'ahead', tags: ['written'], speaker: MIREYA, text: 'I have gone ahead to the Pool. Come down when you can breathe again.', next: 'end' },
    ],
  },
  // STORY §11.4 stage 3: Listen — Sallow's verse, breathing (`echo_litany_verse_6`); "It's a person" (`echo_breathing_pool`);
  // §7.5 "bringing Imre Sallow's name back from the Breathing Pool" (+3).
  {
    id: 'scene_mireya_breathing_pool',
    npcId: MIREYA,
    title: 'What the light takes',
    when: { all: [NOT_IN_HORDE, AT_POOL, stageOf(LIGHT, 'listen'), { companion: { id: 'mireya' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'edge',
    nodes: [
      {
        id: 'edge',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The well of light inhales for six heartbeats and exhales for six. Mireya kneels at the edge with her sleeves pushed up, and the light under her forearms keeps the same time.',
        choices: [{ id: 'listen', text: 'Listen.', next: 'verse' }],
      },
      {
        id: 'verse',
        tags: ['story'],
        speaker: SALLOW,
        text: 'Green, take what the stone cannot. Breathe in what burns; breathe out what grows. Let what lives carry what does not.',
        onEnter: [{ grantEcho: 'echo_litany_verse_6' }],
        next: 'person',
      },
      { id: 'person', tags: ['story'], speaker: MIREYA, text: "It's a person. It's been a person the whole time.", next: 'name' },
      {
        id: 'name',
        tags: ['written'],
        speaker: MIREYA,
        text: 'It is breathing. It has been breathing into us for five hundred years and we called it holy. Who was she? Did she have a name, where you come from?',
        onEnter: [{ grantEcho: 'echo_breathing_pool' }],
        choices: [
          {
            id: 'sallow',
            text: 'Imre Sallow. A healer, and a gardener. She agreed to it only if the overflow went to living things.',
            effects: [...loyaltyFor(['mireya']), { questAdvance: { quest: LIGHT, stage: 'heard' } }],
            next: 'carry',
          },
          { id: 'nothing', text: 'Does it matter what she was called?', effects: [{ questAdvance: { quest: LIGHT, stage: 'heard' } }], next: 'matters' },
        ],
      },
      { id: 'carry', tags: ['written'], speaker: MIREYA, text: 'Imre Sallow. Then that is who the fen has been carrying. I will take it up to the village and say it at the mat, and Wen can sit on it.', next: 'end' },
      {
        id: 'matters',
        tags: ['written'],
        speaker: MIREYA,
        text: 'It matters to me. Keep it, then. I will take the breath up to the village and call it what we have always called it, and know better.',
        next: 'end',
      },
    ],
  },

  // ---- q_preserve_or_heal: the offer (Loyal, `echo_breathing_pool`); the choice at the Pool ------------------------------------
  {
    id: 'scene_mireya_preserve_offer',
    npcId: MIREYA,
    title: 'Preserve or heal',
    when: { all: [NOT_IN_HORDE, AT_LANTERNREED, { echo: 'echo_breathing_pool' }, { loyalty: { companion: 'mireya', min: 50 } }, notStarted(PRESERVE)] },
    priority: SCENE_PRIORITY.offer,
    entry: 'leak',
    nodes: [
      {
        id: 'leak',
        tags: ['written'],
        speaker: MIREYA,
        text: 'I have thought about it since the Pool. The leak can be dammed. A piece of the Heartstone in the well, stable or dead, and the breath stops; the changed stop changing, and some of them sicken for it. Or we let it run, and the fen becomes whatever it is becoming.',
        next: 'yours',
      },
      {
        id: 'yours',
        tags: ['written'],
        speaker: MIREYA,
        text: 'I will stand by either. Wen will not; she has already said no to a thing nobody has asked her. Come down to the Pool and choose. It is yours; I have had my hands in it too long to see it.',
        choices: offer(PRESERVE, "I'll choose at the Pool.", 'Not yet.', 'down', 'refused'),
      },
      { id: 'down', tags: ['written'], speaker: MIREYA, text: 'Bring the fragment if you mean to dam it. The well does not take promises.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: MIREYA, text: 'Then it runs a while longer. It has run five hundred years; it can wait on you.', next: 'end' },
    ],
  },
  // STORY §11.4 stage 2 / §7.5: Wen refuses; "letting Lanternreed decide for itself" (+3); dam with either fragment (D-052: the
  // dead one dams "permanently and darkly", its own outcome) → `echo_glowfen_dammed`, or let it run → `echo_glowfen_let_run`.
  // "Mireya accepts either and never says you chose right."
  {
    id: 'scene_mireya_preserve_or_heal',
    npcId: MIREYA,
    title: 'Stone in the well',
    when: { all: [NOT_IN_HORDE, AT_POOL, stageOf(PRESERVE, 'choose')] },
    priority: SCENE_PRIORITY.decision,
    entry: 'mat',
    nodes: [
      { id: 'mat', tags: ['written'], speaker: WEN, text: 'No. The glow stays. Whatever it costs.', next: 'fen' },
      {
        id: 'fen',
        tags: ['written'],
        speaker: MIREYA,
        text: 'She has said no to it for forty years and it has gone on leaking. Nothing here keeps. It changes, or it is eaten, and that is the only choice the fen has ever offered anyone.',
        choices: [
          { id: 'ask_them', text: "It's their water. Ask Lanternreed.", effects: loyaltyFor(['mireya']), next: 'village' },
          { id: 'mine', text: "I'll decide.", next: 'choice' },
        ],
      },
      {
        id: 'village',
        tags: ['written'],
        speaker: 'narrator',
        text: 'She goes up the ladder and comes back with the answer the village gave, which is three answers. The girl with the green eyes wants the stars. Her mother wants her daughter. Elder Tam said not yet.',
        next: 'choice',
      },
      {
        id: 'choice',
        tags: ['written'],
        speaker: MIREYA,
        text: 'Then say it. Stone in the well, or hands off.',
        choices: [
          {
            id: 'dam',
            text: 'Dam it with the stable fragment.',
            disabledWhen: { not: STABLE_FRAGMENT },
            disabledText: '(You carry no stable Heartstone fragment)',
            effects: [{ takeItem: { item: 'item_heartstone_fragment_stable' } }, { grantEcho: 'echo_glowfen_dammed' }, { questAdvance: { quest: PRESERVE, stage: 'dammed' } }],
            next: 'slower',
          },
          {
            id: 'dam_dead',
            text: 'Dam it with the dead fragment.',
            disabledWhen: { not: DEAD_FRAGMENT },
            disabledText: '(You carry no dead Heartstone fragment)',
            effects: [{ takeItem: { item: 'item_heartstone_fragment_dead' } }, { grantEcho: 'echo_glowfen_dammed' }, { questAdvance: { quest: PRESERVE, stage: 'dammed_dark' } }],
            next: 'dark',
          },
          { id: 'run', text: 'Let it run.', effects: [{ grantEcho: 'echo_glowfen_let_run' }, { questAdvance: { quest: PRESERVE, stage: 'let_run' } }], next: 'runs' },
        ],
      },
      {
        id: 'slower',
        tags: ['written'],
        speaker: 'narrator',
        text: "The fragment goes into the light and the light closes over it, and the Pool breathes slower, and slower. Wen does not get up. The glow in Mireya's forearms dims by a shade, and she watches it go.",
        next: 'either_sicken',
      },
      {
        id: 'dark',
        tags: ['written'],
        speaker: 'narrator',
        text: "The dead stone goes in and the light goes with it, all at once, the way a lamp goes. The Pool is water. Wen says something in the dark that is not a word. Mireya's arms are only arms.",
        next: 'either_sicken',
      },
      {
        id: 'runs',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You take your hands off it. The Pool breathes in, and out, and the light climbs a little higher up the stilts than it did yesterday. Somewhere above, the girl with green eyes laughs.',
        next: 'either_bright',
      },
      {
        id: 'either_sicken',
        tags: ['written'],
        speaker: MIREYA,
        text: 'Done, then. Some of them will sicken; I will sit with them. Do not ask me if it was right. I said I would stand by it, and I am standing.',
        next: 'end',
      },
      {
        id: 'either_bright',
        tags: ['written'],
        speaker: MIREYA,
        text: "Done, then. They will be bright, and kind, and not quite anyone's. Do not ask me if it was right. I said I would stand by it, and I am standing.",
        next: 'end',
      },
    ],
  },

  // ---- What she says when nothing is pending (the arc's state, latest first) --------------------------------------------------
  {
    id: 'scene_mireya_lanternreed',
    npcId: MIREYA,
    when: { all: [NOT_IN_HORDE, { any: [AT_LANTERNREED, AT_POOL] }] },
    priority: SCENE_PRIORITY.waiting,
    entry: [
      { when: doneAt(PRESERVE, 'dammed_dark'), node: 'went_dark' },
      { when: doneAt(PRESERVE, 'dammed'), node: 'fading' },
      { when: doneAt(PRESERVE, 'let_run'), node: 'brighter' },
      { when: completed(LIGHT), node: 'breath' },
      { when: completed(LANTERN), node: 'fever' },
      { when: { all: [] }, node: 'grandmother' },
    ],
    nodes: [
      { id: 'went_dark', tags: ['written'], speaker: MIREYA, text: 'We light real lanterns now. Oil, and wicks. The children think it is a game.', next: 'end' },
      { id: 'fading', tags: ['written'], speaker: MIREYA, text: 'It is fading. Slow. Tam says it is the weather. Let him.', next: 'end' },
      { id: 'brighter', tags: ['written'], speaker: MIREYA, text: 'Rain by dusk, and the water brighter every night. Tam has stopped saying not yet.', next: 'end' },
      { id: 'breath', tags: ['written'], speaker: MIREYA, text: 'I keep hearing her when the Pool breathes. Imre. Sit down; you are standing like the news is bad.', next: 'end' },
      { id: 'fever', tags: ['written'], speaker: MIREYA, text: 'The three are up and walking. The girl walks at night now; she says it is easier.', next: 'end' },
      // STORY §7.5's sample
      { id: 'grandmother', tags: ['story'], speaker: MIREYA, text: 'My grandmother glowed at the end. We said it was holiness. It was the water.', next: 'end' },
    ],
  },

  // ==== Mireya at camp (DESIGN §12.7; the companion record's campScenes) ========================================================

  camp('scene_mireya_camp_1', 'Sit down', { companion: { id: 'mireya' } }, 1, 'knee', [
    {
      id: 'knee',
      tags: ['written'],
      speaker: 'mireya',
      text: 'Sit down; I can see you favouring the left knee. No, there. Ask me whatever you have been not asking since the Causeway; I would rather it than the fire.',
      choices: [
        { id: 'hurt', text: 'Does it hurt? The light.', next: 'hurts' },
        { id: 'why', text: 'Why come with me?', next: 'moss' },
      ],
    },
    {
      id: 'hurts',
      tags: ['written'],
      speaker: 'mireya',
      text: 'No. That is the worst of it. It is warm, and it is kind, and my grandmother went into it smiling. Pain I could treat. Comfort I do not have a herb for.',
      next: 'end',
    },
    {
      id: 'moss',
      tags: ['written'],
      speaker: 'mireya',
      text: 'Because the moss grows better where you have been; I have no idea why and I want to. And because Wen said no to it, and I am tired of her saying no for all of us.',
      next: 'end',
    },
  ]),
  camp('scene_mireya_camp_2', 'What the fen does', { all: [{ companion: { id: 'mireya' } }, { loyalty: { companion: 'mireya', min: 25 } }] }, 2, 'preserve', [
    // STORY §7.5's sample, said whole
    {
      id: 'preserve',
      tags: ['story'],
      speaker: 'mireya',
      text: "You keep saying preserve. The fen doesn't preserve anything. It changes it or it eats it.",
      choices: [
        { id: 'into', text: 'What does it change you into?', next: 'tuesday' },
        { id: 'eaten', text: 'What has it eaten?', next: 'slowly' },
      ],
    },
    {
      id: 'tuesday',
      tags: ['written'],
      speaker: 'mireya',
      text: "Something that sees in the dark and does not feel the cold and forgets its mother's face in about a year. The elders call it chosen. I call it Tuesday. Go to sleep; the rain will be in by the second watch.",
      next: 'end',
    },
    {
      id: 'slowly',
      tags: ['written'],
      speaker: 'mireya',
      text: "My grandmother. Two of the lantern-boat's crew, before it sank. Sulis, who was a mother to half the village and is a hall full of lanterns now. It does not eat quickly. That is the kindness, and I hate it.",
      next: 'end',
    },
  ]),
  camp('scene_mireya_camp_3', 'Her overflow', { all: [{ companion: { id: 'mireya' } }, { loyalty: { companion: 'mireya', min: 50 } }, completed(LIGHT)] }, 3, 'person', [
    {
      id: 'person',
      tags: ['written'],
      speaker: 'mireya',
      text: 'It was a person. I keep coming back to that, nights. A healer, and she said yes to a thing only if the overflow went to living things, and we are the living things. I have been her overflow since I was born.',
      choices: [
        { id: 'stop', text: 'Would you stop it, if you could?', next: 'leaks' },
        { id: 'wen', text: 'What does Wen know?', next: 'mat' },
      ],
    },
    {
      // STORY §7.5's stance: doesn't care what it is; cares what it leaks; backs the Mending once the leak would stop
      id: 'leaks',
      tags: ['written'],
      speaker: 'mireya',
      text: 'I do not care what it is. I care what it leaks, and who it leaks into. If stopping the Breach stops the leak, then yes, and I will grieve the light after. Ask me what it is again and I will put you to bed.',
      next: 'end',
    },
    {
      id: 'mat',
      tags: ['written'],
      speaker: 'mireya',
      text: 'Wen knows what Tam knows and says less. She has cleansed people at that mat for forty years; she thinks the light is a gift because it has only ever been kind to her. She never asked it its name. I did. Go to sleep.',
      next: 'end',
    },
  ]),

  // ==== Caelum in Silverwood Before ==============================================================================================

  // STORY §11.4 stage 1 / §7.6: the noon message, on Last Bell at noon (D-102's hour), at the Garret where his schedule has him
  {
    id: 'scene_caelum_errand_offer',
    npcId: CAELUM,
    title: 'The noon message',
    when: { all: [NOT_IN_HORDE, AT_GARRET, LAST_BELL, NOON, { echo: 'echo_before_route' }, notStarted(ERRAND)] },
    priority: SCENE_PRIORITY.offer,
    entry: 'message',
    nodes: [
      {
        id: 'message',
        tags: ['written'],
        speaker: CAELUM,
        text: "Master Thal has given me a message for the Spire Yard, for Mistress Aulde, and told me to walk, not run. I have never been told to walk before. Will you walk with me? I'd rather not carry it alone, and I don't know why.",
        choices: [
          { id: 'yes', text: "I'll walk with you.", effects: [{ questStart: ERRAND }, { questAdvance: { quest: ERRAND, stage: 'cross' } }], next: 'walk' },
          { id: 'no', text: 'Not now.', next: 'refused' },
        ],
      },
      {
        id: 'walk',
        tags: ['written'],
        speaker: CAELUM,
        text: "Across the Plaza, east, to the terrace. She'll be tuning; she is always tuning. Don't speak to her before she has read it, she doesn't like that.",
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: CAELUM, text: "Then I'll walk it alone, and walk slowly, as he said. If you change your mind, the Yard is the east terrace.", next: 'end' },
    ],
  },
  {
    id: 'scene_caelum_errand_waiting',
    npcId: CAELUM,
    when: { all: [NOT_IN_HORDE, { any: [AT_GARRET, AT_PLAZA] }, stageOf(ERRAND, 'cross')] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'terrace',
    nodes: [{ id: 'terrace', tags: ['written'], speaker: CAELUM, text: "The east terrace. Walk; I'm not to run with it. He said walk twice, which he never does.", next: 'end' }],
  },
  // STORY §11.4 stage 3 / §7.6: Aulde has read it and laughed (`ev_plaza_spire_yard` on arrival); her verse for the boy
  // (`echo_litany_verse_5`); "not lying to him about the city" (+3 / −10); he joins (D-067.9) — the recruitment.
  {
    id: 'scene_caelum_spire_yard',
    npcId: CAELUM,
    title: 'Begin at the ninth bell',
    when: { all: [NOT_IN_HORDE, AT_PLAZA, stageOf(ERRAND, 'spire_yard')] },
    priority: SCENE_PRIORITY.decision,
    entry: 'read',
    nodes: [
      {
        id: 'read',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Aulde has read it. She is still laughing, one note, with the paper against her chest; then she turns to the Spires, and the boy, and sings it to him as if he had asked.',
        next: 'verse',
      },
      {
        id: 'verse',
        tags: ['story'],
        speaker: AULDE,
        text: 'Rise, lines, and be lifted. Sing the one note the world was tuned to. Let the sky hear what the ground has always known.',
        onEnter: [{ grantEcho: 'echo_litany_verse_5' }],
        next: 'begin',
      },
      {
        id: 'begin',
        tags: ['written'],
        speaker: CAELUM,
        text: "Begin at the ninth bell. That's all it said; I read it upside down on the stair, I'm not proud. She laughed. Why would she laugh at begin? You look like someone who knows what it begins.",
        choices: [
          { id: 'honest', text: 'The ritual. It begins at dusk, at the ninth bell, and it fails.', effects: loyaltyFor(['caelum']), next: 'fails' },
          { id: 'lie', text: 'A joke between masters. Nothing more.', effects: loyaltyFor([], ['caelum']), next: 'joke' },
        ],
      },
      { id: 'fails', tags: ['written'], speaker: CAELUM, text: 'Fails. ...Thank you for not telling me it goes well. Everyone here tells me things go well.', next: 'until_dusk' },
      { id: 'joke', tags: ['written'], speaker: CAELUM, text: 'A joke. Yes. Masters have those. ...You looked at the Spires when you said it, not at me.', next: 'until_dusk' },
      {
        id: 'until_dusk',
        tags: ['written'],
        speaker: CAELUM,
        text: "I've a second message at dusk, up the Archive stair, and until then nobody will look for me. Let me walk with you. I'm Chrono-trained; Master Thal says I can buy a moment, which is a thing you look like you need.",
        choices: [
          { id: 'walk', text: 'Walk with me, then.', effects: [{ recruit: 'caelum' }, { questAdvance: { quest: ERRAND, stage: 'joined' } }], next: 'joined' },
          { id: 'later', text: 'Deliver the dusk one first.', effects: [{ questAdvance: { quest: ERRAND, stage: 'joined' } }], next: 'later' },
        ],
      },
      { id: 'joined', tags: ['written'], speaker: CAELUM, text: "Then I'm yours till the bell. Don't let me run.", next: 'end' },
      { id: 'later', tags: ['written'], speaker: CAELUM, text: "At dusk, then. I'll be on the stair, three steps up, where I always am; you'll know me by the message.", next: 'end' },
    ],
  },
  // DESIGN §12.1 / D-067.9: after the errand, inside the Before, turned down or sent away (not once he has chosen to stay)
  {
    id: 'scene_caelum_recruit',
    npcId: CAELUM,
    title: 'Till the bell',
    when: { all: [NOT_IN_HORDE, IN_THE_BEFORE, completed(ERRAND), { not: CAELUM_RECRUITED }, { not: doneAt(BOY, 'stayed') }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'nobodys',
    nodes: [
      {
        id: 'nobodys',
        tags: ['written'],
        speaker: CAELUM,
        text: "Still here, still nobody's till the bell. Take me with you; I've the stair at dusk and nothing before it, and I've never seen past the Walks.",
        // DESIGN §12.5: the bond Echo (he starts this loop at 25); D-067.4: he is remade with the Before and remembers no loop
        textVariants: [
          {
            when: { echo: 'echo_caelum_bond' },
            text: "Still here, still nobody's till the bell. You stand as if you expect me beside you; I don't know why, and I'd like to. Take me with you; I've the stair at dusk and nothing before it.",
          },
        ],
        choices: [RECRUIT.caelum, { id: 'later', text: 'Later.', next: 'end' }],
      },
      { id: 'good', tags: ['written'], speaker: CAELUM, text: 'Good. Which way is past the Walks?', next: 'end' },
    ],
  },

  // ---- q_a_boy_from_a_doomed_city: what you know; the Silver Gate after dusk on Last Bell; the crossing (STORY §13) -----------
  {
    id: 'scene_caelum_boy_offer',
    npcId: CAELUM,
    title: 'What you know',
    when: { all: [NOT_IN_HORDE, IN_THE_BEFORE, completed(ERRAND), notStarted(BOY), { any: [{ not: { quest: { id: 'q_the_mending' } } }, { flag: 'flag_cradle_pin_anchored' }] }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'door',
    nodes: [
      {
        id: 'door',
        tags: ['written'],
        speaker: CAELUM,
        text: "You came in by a door nobody looks at, with Breach-eyes, and you know things; you knew what begin meant. What's on the far side of that door? Tell me, or show me. I'd rather be shown.",
        // STORY §9.6: he alone remembers the player between resets
        textVariants: [
          {
            when: { beforeResets: { min: 1 } },
            text: "You were here before the bells went back. I remember it; nobody else does. Master Korr looked at me as if I'd said the sky was green. You know what's on the far side of the door you came in by. Tell me, or show me; I'd rather be shown.",
          },
        ],
        choices: [
          { id: 'show', text: "I'll show you. The Silver Gate, on Last Bell, after dusk.", effects: [{ questStart: BOY }, { questAdvance: { quest: BOY, stage: 'door' } }], next: 'after_dusk' },
          { id: 'tell', text: "There's nothing there you'd want to see.", next: 'not_no' },
        ],
      },
      { id: 'after_dusk', tags: ['written'], speaker: CAELUM, text: "After dusk. When I have the second message, then. ...I've never been through the Gate the wrong way. Nobody has.", next: 'end' },
      { id: 'not_no', tags: ['written'], speaker: CAELUM, text: "That's not no. I'll ask again; I remember the asking even when you don't.", next: 'end' },
    ],
  },
  {
    id: 'scene_caelum_boy_waiting',
    npcId: CAELUM,
    when: { all: [NOT_IN_HORDE, IN_THE_BEFORE, stageOf(BOY, 'door')] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'gate',
    nodes: [{ id: 'gate', tags: ['written'], speaker: CAELUM, text: "Last Bell, after dusk, at the Gate. I'll have the message by then. I'll walk, I promise; I'm not to run with it.", next: 'end' }],
  },
  // STORY §13 `scene_caelum_crossing`, line for line; §7.6 "letting him see the Shattered Library" (+3 at the glimpse).
  // Come → `echo_caelum_unanchored` (he walks out beside you: the Gate's door); stay → `echo_caelum_stayed`, he leaves the party.
  {
    id: 'scene_caelum_crossing',
    npcId: CAELUM,
    title: 'Nobody delivered the message',
    when: { all: [NOT_IN_HORDE, AT_GATE, stageOf(BOY, 'glimpse'), { companion: { id: 'caelum' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'library',
    nodes: [
      {
        id: 'library',
        tags: ['story'],
        speaker: 'narrator',
        text: 'Through the door the Shattered Library: collapsed shelves, dust motes, pages turning on their own.',
        onEnter: loyaltyFor(['caelum']),
        next: 'carrel',
      },
      {
        id: 'carrel',
        tags: ['story'],
        speaker: CAELUM,
        text: "That's the Library. That's— the reading room is under that. Master Korr's carrel.",
        choices: [{ id: 'five_hundred', text: "It's five hundred years from now. It's what's left.", next: 'city' }],
      },
      { id: 'city', tags: ['story'], speaker: CAELUM, text: "And the Circle? And the city? ...You don't have to say. Your face says.", next: 'nobody' },
      {
        id: 'nobody',
        tags: ['story'],
        speaker: CAELUM,
        text: "If I go with you, nobody delivers the message. Nobody ever delivered it, did they. That's why he came up the stair looking for me and the Breach was already—",
        next: 'come',
      },
      {
        id: 'come',
        tags: ['story'],
        speaker: CAELUM,
        text: "I'll come. Not because I'm brave. Because I'd like to be somewhere the bells aren't about to ring.",
        choices: [
          { id: 'come', text: 'Come.', effects: [{ grantEcho: 'echo_caelum_unanchored' }, { questAdvance: { quest: BOY, stage: 'crossed' } }], next: 'through' },
          { id: 'stay', text: "Stay. It's your city.", effects: [{ grantEcho: 'echo_caelum_stayed' }, { dismiss: 'caelum' }, { questAdvance: { quest: BOY, stage: 'stayed' } }], next: 'it_is' },
        ],
      },
      {
        id: 'through',
        tags: ['written'],
        speaker: 'narrator',
        text: 'He takes the message in both hands and steps up to the door beside you, and does not look back at the bells.',
        next: 'end',
      },
      { id: 'it_is', tags: ['story'], speaker: CAELUM, text: 'It is. Thank you for asking.', next: 'end' },
    ],
  },

  // ---- What he says in the Before when nothing is pending (by Bell and state) -------------------------------------------------
  {
    id: 'scene_caelum_garret',
    npcId: CAELUM,
    when: { all: [NOT_IN_HORDE, IN_THE_BEFORE] },
    priority: SCENE_PRIORITY.idle,
    entry: [
      { when: doneAt(BOY, 'stayed'), node: 'staying' },
      { when: completed(ERRAND), node: 'dusk_message' },
      { when: LAST_BELL, node: 'noon_message' },
      { when: { beforeResets: { min: 1 } }, node: 'again' },
      { when: { all: [] }, node: 'holding' },
    ],
    nodes: [
      { id: 'staying', tags: ['written'], speaker: CAELUM, text: "I'm staying. Don't ask twice; I'd say yes the second time, and then who'd be on the stair.", next: 'end' },
      { id: 'dusk_message', tags: ['written'], speaker: CAELUM, text: "The dusk message at the ninth bell, up the Archive stair. I'll be three steps up. I'm always three steps up.", next: 'end' },
      {
        id: 'noon_message',
        tags: ['written'],
        speaker: CAELUM,
        text: "Master Thal has a message for the Yard at noon. Find me at the Garret then, if you're still in the city; I'd like the company.",
        next: 'end',
      },
      { id: 'again', tags: ['written'], speaker: CAELUM, text: 'You were here before the bells went back. You stood just there. Nobody else kept it. Why did I?', next: 'end' },
      // STORY §7.6's sample
      { id: 'holding', tags: ['story'], speaker: CAELUM, text: "Master Thal says the Holding is a kindness to the hour. Is it? You look like someone who's seen the hour afterward.", next: 'end' },
    ],
  },

  // ==== Caelum in the present (crossed; the Nexus and the Apex, his schedule) ====================================================

  // STORY §11.4 stage 1 / §7.6 "letting him speak to the Tyrant" (+3): the ask, Loyal, once he has crossed this loop
  {
    id: 'scene_caelum_sin_offer',
    npcId: CAELUM,
    title: 'Master Thal',
    when: { all: [NOT_IN_HORDE, { any: [AT_NEXUS, AT_APEX] }, { echo: 'echo_caelum_unanchored' }, CROSSED, { loyalty: { companion: 'caelum', min: 50 } }, notStarted(SIN)] },
    priority: SCENE_PRIORITY.offer,
    entry: 'in_it',
    nodes: [
      {
        id: 'in_it',
        tags: ['written'],
        speaker: CAELUM,
        text: "Master Thal is in that. I worked it out on the Glowlands, from the way the light leans. He's been holding it since the stair, and he never— he doesn't know I didn't deliver it. I want to tell him. I want to speak to him, when it speaks.",
        next: 'let_me',
      },
      {
        id: 'let_me',
        tags: ['written'],
        speaker: CAELUM,
        text: "Let me. When the Nine ask through him, let me answer the one that's mine; Master Masque taught me the far side, I can answer that. And after, if he'll say anything to me, let me hear it.",
        choices: [
          { id: 'yes', text: 'Speak to him.', effects: [...loyaltyFor(['caelum']), { questStart: SIN }], next: 'shoulder' },
          { id: 'no', text: 'Not yet.', next: 'refused' },
        ],
      },
      { id: 'shoulder', tags: ['written'], speaker: CAELUM, text: "Thank you. I'll stand at your shoulder and I won't run.", next: 'end' },
      { id: 'refused', tags: ['written'], speaker: CAELUM, text: "Then I'll stand behind you and say nothing, as I did on the stair.", next: 'end' },
    ],
  },
  {
    id: 'scene_caelum_sin_waiting',
    npcId: CAELUM,
    when: { all: [NOT_IN_HORDE, { any: [AT_NEXUS, AT_APEX] }, stageOf(SIN, 'let_him')] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'support',
    nodes: [{ id: 'support', tags: ['written'], speaker: CAELUM, text: "Support, if you'll have me there. I can buy you a moment in the hour; it's the errand, it's what I'm for.", next: 'end' }],
  },
  // STORY §11.4 stage 3 / §8.1: the one thing he will not say to the living (§13 `scene_ending_mending`'s lines to Caelum);
  // forgives → `echo_caelum_forgives`, cannot → `echo_caelum_cannot` (REVIEW #3: no second test)
  {
    id: 'scene_caelum_his_masters_sin',
    npcId: CAELUM,
    title: "His masters' sin",
    when: { all: [NOT_IN_HORDE, AT_APEX, stageOf(SIN, 'sorry'), { companion: { id: 'caelum' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'quiet',
    nodes: [
      {
        id: 'quiet',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The chorus has gone under. What is left looks at the boy for a long moment, the way a man looks at a door he forgot he left open. A sound comes out of it that was once a laugh.',
        next: 'did_you',
      },
      { id: 'did_you', tags: ['story'], speaker: TYRANT, text: 'Caelum. The message. Did you—', next: 'nobody_did' },
      { id: 'nobody_did', tags: ['story'], speaker: CAELUM, text: 'No. Nobody did.', next: 'sorry' },
      {
        id: 'sorry',
        tags: ['story'],
        speaker: TYRANT,
        text: 'Good. It said begin. I am sorry, boy. I say it to you because you are the only one here I am allowed to say it to.',
        next: 'say_back',
      },
      {
        id: 'say_back',
        tags: ['written'],
        speaker: CAELUM,
        text: "He said it. He's never— Master Thal doesn't say that. ...I don't know what I say back. Tell me what you'd say.",
        choices: [
          { id: 'forgive', text: 'Forgive him. He held the door five hundred years for a boy on a stair.', next: 'forgives' },
          { id: 'cannot', text: "You don't have to forgive him.", next: 'cannot' },
        ],
      },
      {
        id: 'forgives',
        tags: ['written'],
        speaker: CAELUM,
        text: '...I forgive you, Master Thal. For the stair, and the message, and the hour. Put it down when you can.',
        onEnter: [{ grantEcho: 'echo_caelum_forgives' }, { questAdvance: { quest: SIN, stage: 'forgiven' } }],
        next: 'heard',
      },
      { id: 'heard', tags: ['written'], speaker: TYRANT, text: '...The hour hears it. I had not thought it would. Go on, Caelum. The stair is not the same stair.', next: 'end' },
      {
        id: 'cannot',
        tags: ['story'],
        speaker: CAELUM,
        text: "I don't forgive you, Master Thal.",
        onEnter: [{ grantEcho: 'echo_caelum_cannot' }, { questAdvance: { quest: SIN, stage: 'cannot' } }],
        next: 'to_my_face',
      },
      { id: 'to_my_face', tags: ['written'], speaker: TYRANT, text: 'No. I did not think you would. That you said it to my face is more than the hour has given me.', next: 'end' },
    ],
  },
  // ---- What he says in the present when nothing is pending ----------------------------------------------------------------------
  {
    id: 'scene_caelum_present',
    npcId: CAELUM,
    when: { all: [NOT_IN_HORDE, { any: [AT_NEXUS, AT_APEX] }, CROSSED] },
    priority: SCENE_PRIORITY.idle,
    entry: [
      { when: doneAt(SIN, 'forgiven'), node: 'he_heard' },
      { when: doneAt(SIN, 'cannot'), node: 'said_it' },
      { when: { all: [] }, node: 'older' },
    ],
    nodes: [
      {
        id: 'older',
        tags: ['written'],
        speaker: CAELUM,
        text: "It's all older than my city. The stones, the dome, you. I keep waiting to be frightened and I'm only tired, which Master Masque says is the same thing arriving late.",
        next: 'end',
      },
      { id: 'he_heard', tags: ['written'], speaker: CAELUM, text: "He heard me. I don't know what that's worth to a man who can't put anything down. Something, I think.", next: 'end' },
      {
        id: 'said_it',
        tags: ['written'],
        speaker: CAELUM,
        text: "I said it to his face. I'd say it again. ...I'd like him to be allowed to stop, all the same. Both are true; Master Masque says that's most things.",
        next: 'end',
      },
    ],
  },

  // ==== Caelum at camp (DESIGN §12.7; the Garret's cot, then wherever he is) =====================================================

  camp('scene_caelum_camp_1', 'A question he is afraid of', { companion: { id: 'caelum' } }, 1, 'cot', [
    {
      id: 'cot',
      tags: ['written'],
      speaker: 'caelum',
      text: "I don't sleep much; I read. Master Thal says the Litany should be in me like my own name by the Conflux. ...May I ask you something I'm afraid of? You needn't answer.",
      choices: [
        { id: 'ask', text: 'Ask.', next: 'goes_well' },
        { id: 'verse', text: 'Read me a verse instead.', next: 'ninth' },
      ],
    },
    {
      id: 'goes_well',
      tags: ['written'],
      speaker: 'caelum',
      text: "Does it go well? The Conflux. Everyone says it goes well and nobody says it the way people say things that go well. You don't have to answer. Your not answering is an answer; I'm not slow.",
      next: 'end',
    },
    {
      id: 'ninth',
      tags: ['written'],
      speaker: 'caelum',
      text: "Which? I have all but the ninth; he keeps that in his study and says it isn't finished. Go to sleep and I'll read quietly. I always do.",
      next: 'end',
    },
  ]),
  camp('scene_caelum_camp_2', 'Older than my city', { all: [{ companion: { id: 'caelum' } }, { loyalty: { companion: 'caelum', min: 25 } }] }, 2, 'pack', [
    // STORY §7.6's sample, said whole
    {
      id: 'pack',
      tags: ['story'],
      speaker: 'caelum',
      text: "Everything in your pack is older than my city. That isn't possible. I'm holding it.",
      choices: [
        { id: 'left', text: "It's what's left of it.", next: 'wall' },
        { id: 'back', text: 'Put it back.', next: 'buckle' },
      ],
    },
    {
      id: 'wall',
      tags: ['written'],
      speaker: 'caelum',
      text: "What's left. ...I'd thought the city was the kind of thing that stays. Master Vane builds for a thousand years; he says so at dinner. Is his wall there? Don't tell me. Tell me.",
      next: 'end',
    },
    {
      id: 'buckle',
      tags: ['written'],
      speaker: 'caelum',
      text: "Put back. Yes. ...It had a maker's mark on it, the one on the buckle. Anso's. He's across the Plaza now, selling charms. He'll be dead a long time where you come from, and I've just held his buckle.",
      next: 'end',
    },
  ]),
  camp('scene_caelum_camp_3', 'Allowed to stop', { all: [{ companion: { id: 'caelum' } }, { loyalty: { companion: 'caelum', min: 50 } }, CROSSED] }, 3, 'teacher', [
    {
      // STORY §7.6's stance: it is his teacher; he wants it allowed to stop
      id: 'teacher',
      tags: ['written'],
      speaker: 'caelum',
      text: "Master Thal is in that thing. It's him; I know his voice under a chorus the way you'd know your father's under a crowd. He's been holding since I was on the stair. I want him allowed to stop. Is that a terrible thing to want for a teacher?",
      choices: [
        { id: 'kind', text: "It's the kindest thing you could want.", next: 'finish' },
        { id: 'chose', text: 'He chose to hold it.', next: 'not_angry' },
      ],
    },
    {
      id: 'finish',
      tags: ['written'],
      speaker: 'caelum',
      text: "Then I'll want it, and say so to his face if the hour lets me. He never let me finish a sentence in the Hall. He'll let me finish this one.",
      next: 'end',
    },
    {
      id: 'not_angry',
      tags: ['written'],
      speaker: 'caelum',
      text: "He chose. He also sent a boy up a stair with a message he knew nobody would read, because he didn't want the boy in the room. I worked that out on the Glowlands. I'm not angry. I'm trying not to be.",
      next: 'end',
    },
  ]),
] satisfies DialogueSceneInput[];
