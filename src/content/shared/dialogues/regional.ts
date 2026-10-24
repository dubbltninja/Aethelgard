// The scenes of the six regional quests (STORY §11.3; §10.7's figure on the water; §2.3's fourth verse; §11 "Come back when
// you've seen more."; BIBLE §3 the voices: Dray dated, precise, dry, citing years; Hadda proverbs and commands; Borin forge
// verbs and the fire as a person; Elder Wen short, flat refusals; Dask dry, kind, a dropped word; Ysmay no eyes, the thread).
// The quests are ../quests/regional.ts; the conventions are this folder's index.ts (U52's pattern, D-105, D-109).
//
// Who says what, and when (priority bands from ./common.ts; every NPC scene is closed while the Horde runs; a scene with no
// `npcId` is opened by a place — the region's locations.ts names the event):
//   Dray    scene_dray_bell_vault_offer (Loop 1 included: the quest is L1 open) · _waiting · _after
//   place   scene_bell_vault_discovery (the Drowned Stair's `ev_stair_bell`) · scene_bell_vault_bells (the Deep's `ev_deep_bells`:
//           the three bells; Silverwood's order, or `echo_bells_of_silverwood` / `echo_bell_vault` says it; a wrong bell wakes
//           the drowned)
//   Hadda   scene_hadda_bone_road_offer · _waiting · _report (the waystones) · _after
//   Borin   scene_borin_forge_mark (the mark, while the Bone Road runs)
//   place   scene_hallows_cairn_inscription (the Cairns' `ev_hallows_ember_bowl`: verse IV, the ember, the mark)
//   place   scene_hollow_curtain_stair (the Hollow's `ev_hollow_curtain_stair`: put the light out and go down)
//   Ysmay   scene_ysmay_lightless_stair (once a loop, after the stair)
//   Wen     scene_wen_drowned_lantern_offer · _waiting · _report (`flag_lanternreed_trusts`) · _after · scene_wen_idle
//   place   scene_lantern_boat (the Shallows' `ev_shallows_lantern_boat`: the boat raised, the wick packed with Glow Moss)
//   place   scene_plateau_stair (the Plateau's `ev_plateau_stair`: the discovery) · scene_high_mark_look_east (the Stair's
//           `ev_stair_look_east`: the Breach's edge)
//   Dask    scene_dask_high_mark (the other giver, at the Pass from Loop 2)
//   place   scene_far_light_look_back (the Far Light's `ev_far_light_look_back`: look back at the water, or step through)
//
// STORY gives these quests their beats, their first journals and a handful of lines (the figure on the water, §10.7; verse
// IV, §2.3; the Loop 1 refusal, §11); every other line here is written (tag `written`, in the speaker's BIBLE voice, listed in
// the U57 reply and pinned by tests/unit/content/quests/regional.test.ts).
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY, echoLocked, type ChoiceInput } from './common';

// ---- Lines and conditions used more than once ------------------------------------------------------------------------------

/** STORY §11: in Loop 1 the new regions' givers say this. */
const COME_BACK = "Come back when you've seen more.";

const DRAY = 'npc_ansel_dray';
const HADDA = 'npc_hadda_ironvow';
const BORIN = 'npc_borin_stonefist';
const WEN = 'npc_elder_wen';
const DASK = 'npc_dask';
const YSMAY = 'npc_ysmay';

/** STORY §11.3: the Bell Vault's prerequisite. */
const BELL_VAULT_OPEN: Condition = { any: [{ echo: 'echo_archive_door' }, { quest: { id: 'q_lost_scroll', status: 'completed' } }] };
/** U55's reading: Dask's home, where his introduction is played. */
const AT_PASS: Condition = { location: 'loc_shimmering_pass' };

const stageOf = (id: `q_${string}`, stage: string): Condition => ({ quest: { id, stage } });
const active = (id: `q_${string}`): Condition => ({ quest: { id, status: 'active' } });
const completed = (id: `q_${string}`): Condition => ({ quest: { id, status: 'completed' } });
const notStarted = (id: `q_${string}`): Condition => ({ not: { quest: { id } } });

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

/** The bells rung in Silverwood's order: the water drops a level, a day passes in the dark (STORY §11.3; DESIGN §13.3). */
const BELLS_RUNG: ChoiceInput['effects'] = [{ passWatches: 4 }, { questAdvance: { quest: 'q_bell_vault', stage: 'water_drops' } }];

export const dialogues = [
  // ==== Keeper Dray · q_bell_vault =============================================================================================

  // STORY §11.3: "discovery (the flooded stair below the Sunken Archives) or Keeper Dray"; the Plaza fountain's order
  {
    id: 'scene_dray_bell_vault_offer',
    npcId: DRAY,
    title: 'The bell under the stair',
    when: { all: [NOT_IN_HORDE, BELL_VAULT_OPEN, notStarted('q_bell_vault')] },
    priority: SCENE_PRIORITY.offer,
    entry: 'bell',
    nodes: [
      {
        id: 'bell',
        tags: ['written'],
        speaker: DRAY,
        text: 'There is a stair under the Archives that the water took in Year 1, and a bell under the stair that it did not. It rings on the hour. I have timed it; it runs four minutes slow, and has since 309.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: DRAY,
        text: "Silverwood hung three bells: Plaza, Gate, Archive. Ring them as the city rang them and the sluices will answer. Ashcombe's notes say the order is cut on the Plaza fountain. Will you go down?",
        choices: offer('q_bell_vault', 'I will go down.', 'Not now.', 'lanterns', 'refused'),
      },
      {
        id: 'lanterns',
        tags: ['written'],
        speaker: DRAY,
        text: 'Take a lantern. Take two. And count the hours while you are under; the bell will not count them for you.',
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: DRAY, text: 'Then it rings on. It has rung five hundred years without you.', next: 'end' },
    ],
  },
  {
    id: 'scene_dray_bell_vault_waiting',
    npcId: DRAY,
    when: { all: [NOT_IN_HORDE, active('q_bell_vault')] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [
      {
        id: 'waiting',
        tags: ['written'],
        speaker: DRAY,
        text: 'Plaza, Gate, Archive, if the fountain is to be believed. Ashcombe believed it. He never went down.',
        next: 'end',
      },
    ],
  },
  {
    id: 'scene_dray_bell_vault_after',
    npcId: DRAY,
    when: { all: [NOT_IN_HORDE, completed('q_bell_vault')] },
    priority: SCENE_PRIORITY.after,
    entry: 'stopped',
    nodes: [
      {
        id: 'stopped',
        tags: ['written'],
        speaker: DRAY,
        text: 'The bell has stopped. I have the hour of it written down: the first silence under the Archives since Year 1.',
        next: 'end',
      },
    ],
  },

  // The flooded stair's discovery (the Drowned Stair's `ev_stair_bell`): the ringing, and the way down
  {
    id: 'scene_bell_vault_discovery',
    title: 'Something rings on the hour',
    entry: 'ringing',
    nodes: [
      {
        id: 'ringing',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Under the ninth lamp the stair goes on down, and from under the water a bell speaks one low note. It is the hour. Something down there is keeping it.',
        choices: [
          { id: 'follow', text: 'Follow the ringing down.', effects: [{ questStart: 'q_bell_vault' }], next: 'count' },
          { id: 'not_now', text: 'Not now.', next: 'end' },
        ],
      },
      { id: 'count', tags: ['written'], speaker: 'narrator', text: 'You count the lamps as you go. The bell does not ring twice.', next: 'end' },
    ],
  },
  // STORY §11.3 stages 2–3: the three sunken bells, rung in Silverwood's order (Plaza, Gate, Archive; the Plaza fountain wrote
  // it, `echo_bells_of_silverwood` knows it, `echo_bell_vault` remembers it); a wrong bell wakes the drowned. The right order
  // drops the water a level: four watches pass (D-069.5) and the quest ends at `water_drops` (its rewards pay the key, the
  // lantern, `echo_bell_vault` and `echo_archive_door`).
  {
    id: 'scene_bell_vault_bells',
    title: 'The three sunken bells',
    entry: 'bells',
    nodes: [
      {
        id: 'bells',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Three bells hang in the well under the water, each the size of a cart, and a rope runs up from each. Their lips are cut with names: PLAZA. GATE. ARCHIVE.',
        choices: [
          echoLocked('echo_bells_of_silverwood', { id: 'fountain_order', text: 'Ring them as the fountain says: Plaza, Gate, Archive.', effects: BELLS_RUNG, next: 'rung' }),
          echoLocked('echo_bell_vault', { id: 'known_order', text: 'You have rung these before. Plaza, Gate, Archive.', effects: BELLS_RUNG, next: 'rung' }),
          { id: 'first_plaza', text: 'Ring the Plaza bell first.', next: 'plaza_rung' },
          { id: 'first_gate', text: 'Ring the Gate bell first.', next: 'wrong' },
          { id: 'first_archive', text: 'Ring the Archive bell first.', next: 'wrong' },
          { id: 'leave', text: 'Leave them.', next: 'end' },
        ],
      },
      {
        id: 'plaza_rung',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The Plaza bell speaks, and the water takes the note and carries it along the walls. Two ropes left.',
        choices: [
          { id: 'then_gate', text: 'Then the Gate.', effects: BELLS_RUNG, next: 'rung' },
          { id: 'then_archive', text: 'Then the Archive.', next: 'wrong' },
        ],
      },
      {
        id: 'rung',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Gate, then Archive. The third note goes down the well and something under the well opens. The water drops a hand, a step, a level, and does not come back. A day goes by in the dark while it falls.',
        // the Bell-Warden tolls (STORY stage 3); with `echo_rhune_choice` it has already given up the key (the Deep's placement)
        textVariants: [
          {
            when: { echo: 'echo_rhune_choice' },
            text: 'Gate, then Archive. The third note goes down the well and something under the well opens. The water drops a hand, a step, a level, and does not come back. A day goes by in the dark while it falls. In the well the Warden lifts the clapper and tolls the hour once, for the Warden of Waters, by her name.',
          },
        ],
        next: 'end',
      },
      {
        id: 'wrong',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The note goes down the well and does not come back up the same.',
        onEnter: [{ startCombat: 'enc_bell_vault_archivists' }],
        next: 'end',
      },
    ],
  },

  // ==== Hadda Ironvow · q_bone_road ===========================================================================================

  {
    id: 'scene_hadda_bone_road_offer',
    npcId: HADDA,
    title: 'Before the salt-wind',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, notStarted('q_bone_road')] },
    priority: SCENE_PRIORITY.offer,
    entry: 'wind',
    nodes: [
      {
        id: 'wind',
        tags: ['written'],
        speaker: HADDA,
        text: 'The salt-wind comes off the Pan in three days, and the wagons go north before it or they do not go. The Bone Road runs past the cairns, and something has made the cairns its own.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: HADDA,
        text: 'Ride ahead and clear them. A road is cleared by the one in front, not the twenty behind. Will you ride?',
        choices: offer('q_bone_road', 'I will ride.', 'Not now.', 'go', 'refused'),
      },
      {
        id: 'go',
        tags: ['written'],
        speaker: HADDA,
        text: "The Orchard first, then the Cairns. And if Borin at the Emberforge knows your face, carry his mark: Hallow's stone has waited five hundred years for a hand it knows.",
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: HADDA, text: 'Then walk behind the wagons with the goats.', next: 'end' },
    ],
  },
  {
    id: 'scene_hadda_bone_road_waiting',
    npcId: HADDA,
    when: { all: [NOT_IN_HORDE, active('q_bone_road'), { not: stageOf('q_bone_road', 'return') }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['written'], speaker: HADDA, text: "The Orchard, then the Cairns, then Hallow's stone. The wind does not wait for riders who talk.", next: 'end' }],
  },
  // STORY §11.3: Ironclad +10, 40 gold, the Salt-Wind Cloak and `echo_steppe_waystones` (the quest's rewards, paid at `done`)
  {
    id: 'scene_hadda_bone_road_report',
    npcId: HADDA,
    title: 'The waystones',
    when: { all: [NOT_IN_HORDE, stageOf('q_bone_road', 'return')] },
    priority: SCENE_PRIORITY.report,
    entry: 'clear',
    nodes: [
      {
        id: 'clear',
        tags: ['written'],
        speaker: HADDA,
        text: "The road is clear? Then the wagons roll at dawn. Forty in silver, and a rider's cloak; the salt is in it already, and ash slides off it.",
        textVariants: [
          {
            when: { echo: 'echo_iron_that_does_not_wish' },
            text: "The road is clear? Then the wagons roll at dawn. Forty in silver, and a rider's cloak; the salt is in it already, and ash slides off it. And Hallow's stone spoke to you. It has not spoken to us.",
          },
        ],
        next: 'waystones',
      },
      {
        id: 'waystones',
        tags: ['written'],
        speaker: HADDA,
        text: 'And the waystones. Gate, Ridge, Reed: pass each on your left hand and the Steppe is one watch wide. The Nomads do not give that to strangers. You are not one.',
        onEnter: [{ questAdvance: { quest: 'q_bone_road', stage: 'done' } }],
        next: 'end',
      },
    ],
  },
  {
    id: 'scene_hadda_bone_road_after',
    npcId: HADDA,
    when: { all: [NOT_IN_HORDE, completed('q_bone_road')] },
    priority: SCENE_PRIORITY.after,
    entry: 'east',
    nodes: [{ id: 'east', tags: ['written'], speaker: HADDA, text: 'The wagons are north of the Pan. Ride the short road; you paid for it.', next: 'end' }],
  },

  // Borin, at the Emberforge, while the Bone Road runs (WORLD §3.7: the mark is handed over there once the quest is accepted)
  {
    id: 'scene_borin_forge_mark',
    npcId: BORIN,
    title: "Borin's mark",
    when: {
      all: [
        NOT_IN_HORDE,
        active('q_bone_road'),
        { not: stageOf('q_bone_road', 'return') },
        { not: { item: { id: 'item_borins_forge_mark' } } },
      ],
    },
    priority: SCENE_PRIORITY.report,
    entry: 'mark',
    nodes: [
      {
        id: 'mark',
        tags: ['written'],
        speaker: BORIN,
        text: "Hadda's road? Speak plain, then: take this. My mark, struck over Hallow's. Show it to the Cairn, so the stone knows who sent you.",
        next: 'warm',
      },
      {
        id: 'warm',
        tags: ['written'],
        speaker: BORIN,
        text: 'The iron up there is still warm. The fire says so, and she was lit from it. Five hundred years she has wanted that bowl back; she will settle for word of it.',
        onEnter: [{ giveItem: { item: 'item_borins_forge_mark' } }],
        next: 'end',
      },
    ],
  },
  // STORY §11.3 stage 3, the ember-bowl inscription at Hallow's Cairn (the Cairns' `ev_hallows_ember_bowl`): verse IV (STORY
  // §2.3; §12 "Hallow's Cairn (`q_bone_road`)"), `echo_hallows_ember`, and with the forge-mark `echo_iron_that_does_not_wish`
  {
    id: 'scene_hallows_cairn_inscription',
    title: 'The ember-bowl',
    entry: 'bowl',
    nodes: [
      {
        id: 'bowl',
        tags: ['written'],
        speaker: 'narrator',
        text: "The ember-bowl on Hallow's Cairn is iron, and warm, and the hand's width of ash in it has not gone cold in five hundred years. Around the rim, cut deep, the fourth verse.",
        next: 'verse',
      },
      {
        id: 'verse',
        tags: ['story'],
        speaker: 'narrator',
        text: 'Iron that does not wish, hold the heart.\nTake the weight and do not want it.\nWhat the hand would grasp, let the cradle only carry.',
        onEnter: [{ grantEcho: 'echo_litany_verse_4' }, { grantEcho: 'echo_hallows_ember' }],
        next: 'ember',
      },
      {
        id: 'ember',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Hallow carried the fire north and did not set it down. He set it here, in the bowl, and lay down beside it.',
        textVariants: [
          {
            when: { item: { id: 'item_borins_forge_mark' } },
            text: "Hallow carried the fire north and did not set it down. He set it here, in the bowl, and lay down beside it. Borin's mark is warm in your pack, and under it Hallow's own, struck when this iron was still wished for. The bowl knows the hand: the cradle was made of iron that was asked.",
          },
        ],
        onEnter: [
          { onlyIf: { when: { item: { id: 'item_borins_forge_mark' } }, effects: [{ grantEcho: 'echo_iron_that_does_not_wish' }] } },
          { questAdvance: { quest: 'q_bone_road', stage: 'return' } },
        ],
        next: 'end',
      },
    ],
  },

  // ==== The Veil · q_lightless_stair ===========================================================================================

  // The Hollow's curtain (its `ev_hollow_curtain_stair`, Loop 2+): the stair, and the two who keep its seam
  {
    id: 'scene_hollow_curtain_stair',
    title: 'The seam in the curtain',
    entry: 'stair',
    nodes: [
      { id: 'stair', tags: ['story'], speaker: 'narrator', text: 'A stair goes down from the Hollow into the Veil. Nothing lit survives it.', next: 'figures' },
      {
        id: 'figures',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The two figures in grey thread stand either side of the seam and do not look at you. One holds a lantern that is not lit. The other holds nothing, and holds it out.',
        choices: [
          { id: 'go_down', text: 'Put out your light and go down.', effects: [{ questStart: 'q_lightless_stair' }], next: 'dark' },
          { id: 'not_yet', text: 'Not yet.', next: 'end' },
        ],
      },
      {
        id: 'dark',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You put the light out. The seam parts for a thing that carries none, and on the other side the dark goes down in steps.',
        next: 'end',
      },
    ],
  },
  // Ysmay, once a loop, after the stair (STORY: "Reach the Hollow Choir"; the Choir lights the stair thereafter)
  {
    id: 'scene_ysmay_lightless_stair',
    npcId: YSMAY,
    title: 'Whole, and in the dark',
    when: { all: [NOT_IN_HORDE, completed('q_lightless_stair')] },
    priority: SCENE_PRIORITY.payoff,
    repeatable: false,
    entry: 'slack',
    nodes: [
      {
        id: 'slack',
        tags: ['written'],
        speaker: YSMAY,
        text: 'You came down with nothing in your hand. I felt the thread go slack where you did not hold it. Whole, and in the dark; that is rarer than Trusted.',
        next: 'lit',
      },
      {
        id: 'lit',
        tags: ['written'],
        speaker: YSMAY,
        text: 'The Choir will keep a light on the stair for you from now. It will not be a light you can see. Hold the thread anyway.',
        next: 'end',
      },
    ],
  },

  // ==== Elder Wen Thistlecourt · q_the_drowned_lantern =========================================================================

  {
    id: 'scene_wen_drowned_lantern_offer',
    npcId: WEN,
    title: 'The lantern-boat',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, notStarted('q_the_drowned_lantern')] },
    priority: SCENE_PRIORITY.offer,
    entry: 'sank',
    nodes: [
      {
        id: 'sank',
        tags: ['written'],
        speaker: WEN,
        text: 'The lantern-boat sank. The Reed Maze, second night of the rains. Without it the village cannot find the Pool at night, and the Pool is where the sick go.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: WEN,
        text: 'Raise it. Light it. Bring it back lit. Will you?',
        choices: offer('q_the_drowned_lantern', 'I will raise it.', 'No.', 'pulses', 'refused'),
      },
      {
        id: 'pulses',
        tags: ['written'],
        speaker: WEN,
        text: 'Follow the pulses in the reeds, not the Mirelings; the Mirelings follow you. Take moss for the wick.',
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: WEN, text: 'No, then.', next: 'end' },
    ],
  },
  {
    id: 'scene_wen_drowned_lantern_waiting',
    npcId: WEN,
    when: { all: [NOT_IN_HORDE, active('q_the_drowned_lantern'), { not: stageOf('q_the_drowned_lantern', 'return') }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['written'], speaker: WEN, text: 'The pulses. Not the Mirelings. Moss for the wick.', next: 'end' }],
  },
  // STORY §11.3: Glowfen folk Neutral → friendly (`flag_lanternreed_trusts`); the Stilt-walker's Boots are the quest's reward
  {
    id: 'scene_wen_drowned_lantern_report',
    npcId: WEN,
    title: 'Lit',
    when: { all: [NOT_IN_HORDE, stageOf('q_the_drowned_lantern', 'return')] },
    priority: SCENE_PRIORITY.report,
    entry: 'lit',
    nodes: [
      { id: 'lit', tags: ['written'], speaker: WEN, text: 'Lit. Good.', next: 'hands' },
      {
        id: 'hands',
        tags: ['written'],
        speaker: WEN,
        text: 'The boat goes out at dusk with the elders in it. Go where you like in the fen now; no one here will watch your hands again. Take the boots. Cork. You walk over the water, not through it.',
        onEnter: [{ setFlag: 'flag_lanternreed_trusts' }, { questAdvance: { quest: 'q_the_drowned_lantern', stage: 'done' } }],
        next: 'end',
      },
    ],
    companionReactions: [{ companionId: 'mireya', text: 'Mireya: "Sit down. You are wet to the hip, and she will not say thank you twice."' }],
  },
  {
    id: 'scene_wen_drowned_lantern_after',
    npcId: WEN,
    when: { all: [NOT_IN_HORDE, completed('q_the_drowned_lantern')] },
    priority: SCENE_PRIORITY.after,
    entry: 'out',
    nodes: [{ id: 'out', tags: ['written'], speaker: WEN, text: 'The boat is out. Go on.', next: 'end' }],
  },
  idle('scene_wen_idle', WEN, 'Nothing for you. The Pool is for the marked; go in, or go on.'),

  // The Reed Maze (the Shallows' `ev_shallows_lantern_boat`): the boat under the mud, the Mirelings that follow a light
  {
    id: 'scene_lantern_boat',
    title: 'Where the pulses stop',
    entry: 'bow_post',
    nodes: [
      {
        id: 'bow_post',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Where the glow pulses stop, a bow-post stands out of the mud with a ring of lantern-glass still on it. Two Mirelings stand up in the shallows, lit from the throat down. They watch the glass. They do not come closer.',
        choices: [
          {
            id: 'raise',
            text: 'Haul the boat up and pack the wick with Glow Moss.',
            disabledWhen: { not: { item: { id: 'item_glow_moss' } } },
            disabledText: '(You carry no Glow Moss)',
            effects: [{ takeItem: { item: 'item_glow_moss' } }, { questAdvance: { quest: 'q_the_drowned_lantern', stage: 'return' } }],
            next: 'lit',
          },
          { id: 'leave', text: 'Leave it in the mud.', next: 'end' },
        ],
      },
      {
        id: 'lit',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The boat comes up by the bow-post with the mud running off it. The moss takes. The glass fills, and the pulses in the reeds answer it one after another, back toward Lanternreed. The Mirelings turn and follow the light.',
        next: 'end',
      },
    ],
    companionReactions: [{ companionId: 'mireya', when: stageOf('q_the_drowned_lantern', 'return'), text: 'Mireya: "Keep it high. They follow the glass, not you; let them think it is theirs."' }],
  },

  // ==== Skyreach · q_high_mark ================================================================================================

  // The Plateau's stair in the wind (its `ev_plateau_stair`): the discovery, Loop 1 included
  {
    id: 'scene_plateau_stair',
    title: 'The stair in the wind',
    entry: 'markers',
    nodes: [
      { id: 'markers', tags: ['story'], speaker: 'narrator', text: 'Above the plateau the markers point up. The Nomads say the sky can be seen from its edge.', next: 'steps' },
      {
        id: 'steps',
        tags: ['written'],
        speaker: 'narrator',
        text: 'On the southern lip the steps show when a gust crosses them, and not otherwise. Eleven of them, then cloud.',
        choices: [
          { id: 'climb', text: 'Climb when the wind says.', effects: [{ questStart: 'q_high_mark' }], next: 'gust' },
          { id: 'not_now', text: 'Not now.', next: 'end' },
        ],
      },
      { id: 'gust', tags: ['written'], speaker: 'narrator', text: 'You wait for the gust. The first step holds.', next: 'end' },
    ],
  },
  // Dask, the other giver (STORY §11.1 "discovery / Dask"), at the Pass from Loop 2 after his introduction (U55's scene) and
  // before his own first quest is taken: once the Flickering Man is in the journal his arc's lines have the Pass (U55's pins)
  {
    id: 'scene_dask_high_mark',
    npcId: DASK,
    title: 'The High Mark',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, AT_PASS, { flag: 'flag_scene_done_scene_dask_introduction' }, notStarted('q_the_flickering_man'), notStarted('q_high_mark')] },
    priority: SCENE_PRIORITY.offer,
    entry: 'stair',
    nodes: [
      {
        id: 'stair',
        tags: ['written'],
        speaker: DASK,
        text: "There's a stair above the Plateau, cut in the wind. I went up it in 430, before the. Before. From the top you can see the thing's edge, and you can see it move.",
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: DASK,
        text: "Go up and look east from it. Then you'll know what I keep counting. Will you go?",
        choices: offer('q_high_mark', 'I will go up.', 'Later.', 'step', 'refused'),
      },
      {
        id: 'step',
        tags: ['written'],
        speaker: DASK,
        text: "Step when the gust says. If the Talisman's on your neck it'll tell you; if it isn't, the Sentinel will, and not kindly.",
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: DASK, text: "Later, then. It'll still be creeping. That's the one thing it does.", next: 'end' },
    ],
  },
  // STORY §11.3 stage 3 (the Stair's `ev_stair_look_east`): the Breach's edge, a line in the sky, creeping; `echo_breach_clock`
  // and `echo_high_mark` are the quest's rewards, paid at `seen`
  {
    id: 'scene_high_mark_look_east',
    title: 'Look east',
    entry: 'edge',
    nodes: [
      {
        id: 'edge',
        tags: ['written'],
        speaker: 'narrator',
        text: 'East, past the Glowlands and the broken dome, the sky has an edge. It is a line, and it is not where it was when you started counting. It creeps.',
        next: 'spent',
      },
      {
        id: 'spent',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Thirty dawns from the Ruins, the Nomads say. From here you can watch them being spent.',
        onEnter: [{ questAdvance: { quest: 'q_high_mark', stage: 'seen' } }],
        next: 'end',
      },
    ],
    companionReactions: [{ companionId: 'dask', text: 'Dask: "There. That\'s the. That\'s what I count. Thirty, give or take the bits I lose."' }],
  },

  // ==== The Threshold · q_the_still_shore =====================================================================================

  // The Far Light (its `ev_far_light_look_back`, on the quest's Loom stage): STORY §11.3 stage 4, "before stepping through,
  // look back at the water"; §10.7 step 4's figure; the hint of six (`echo_six_in_the_mass`, STORY §12). Either way the quest
  // ends here and pays `echo_threshold` and 5 Resonance.
  {
    id: 'scene_far_light_look_back',
    title: 'Before you step through',
    entry: 'door',
    nodes: [
      {
        id: 'door',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The light is a door, and the door is a morning. Behind you the water has not moved, and it is waiting to be looked at.',
        onEnter: [{ questAdvance: { quest: 'q_the_still_shore', stage: 'far_light' } }],
        choices: [
          { id: 'look_back', text: 'Look back at the water.', next: 'figure' },
          { id: 'step', text: 'Step into the light.', effects: [{ questAdvance: { quest: 'q_the_still_shore', stage: 'done' } }], next: 'end' },
        ],
      },
      { id: 'figure', tags: ['story'], speaker: 'narrator', text: 'Far out on the water, a figure holds something up with both hands. It does not move.', next: 'six' },
      {
        id: 'six',
        tags: ['written'],
        speaker: 'narrator',
        text: 'What it holds is not one thing. It is a mass, and there are shapes in the mass, and you count six of them before the light takes your eyes.',
        onEnter: [{ grantEcho: 'echo_six_in_the_mass' }, { questAdvance: { quest: 'q_the_still_shore', stage: 'done_looked' } }],
        next: 'end',
      },
    ],
  },
] satisfies DialogueSceneInput[];
