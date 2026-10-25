// The scenes of the six ending quests (STORY §11.6; §10 the final sequences; §13's `scene_anchor_in_the_conflux`,
// `scene_ending_vigil`, `_mending`, `_dawn`, `_silence`, `_archive`, `_unbound`, line for line; §5.6 how each path is named;
// §8.1 Veyran's psychology; BIBLE §3 the voices: the Tyrant a chorus with one voice under it, "the hour", brief, no apology
// to the living but once; Dask dry, kind, a dropped word; Caelum "Master —", the question he fears; Nyx present tense, "he"
// of Veyran; Brak fragments, one joke; Hadda proverbs and commands; Borin forge verbs, the fire a person; Dray dated and
// dry; Ilyra paper and ink, more formal under stress). The quests are ../quests/endings.ts; the conventions are this folder's
// index.ts (U52's pattern, D-105, D-109).
//
// Who says what, and when (priority bands from ./common.ts; every NPC scene is closed while the Horde runs; a scene with no
// `npcId` is opened by a place or by the Tyrant's data — each hook a listed edit):
//   Dask     scene_dask_wardens_vigil_offer (the Pass; the `report` band: an ending's offer outranks a standing side-offer) · _after
//   Caelum   scene_caelum_mending_offer (the Garret, Before; ahead of his own second quest, which waits for the pin)
//   place    scene_anchor_in_the_conflux (the Conflux's `ev_conflux_pin`, the pin on the rim: Breach Clock +3 days)
//   Borin    scene_borin_anchor (the Emberforge while B or D stands at the forge: "iron that does not wish")
//   Nyx      scene_nyx_weavers_dawn_offer (the Chasm) · place scene_ending_dawn (the Apex's `ev_apex_dawn`: the Core, two waves)
//   Hadda    scene_hadda_iron_silence_offer (Hearthring) · Tyrant scene_ending_silence (Phase 2's entry, or the anchor shown)
//   Dray     scene_dray_long_archive_offer (the Library) · Ilyra scene_ilyra_keep_the_vigil (the Depths, while dawns remain) ·
//            scene_ending_archive (the Depths on the last dawn)
//   Tyrant   scene_ending_mending · scene_ending_vigil · scene_ending_unbound (the Resolution's words, opened by `onSpared`;
//            the last choice is the ending, or the way back to the Resolution's outcomes)
//
// Two Echoes STORY derives from others had no grant (D-100): `echo_litany_complete` (all nine verses) and `echo_anchor_schema`
// (both halves of the design). The offers that read them derive them on entry when the parts are held (DERIVE_LITANY,
// DERIVE_SCHEMA), so the quests' STORY prerequisites can be met.
//
// STORY §13 gives these scenes most of their lines (tag `story`); the offers, the vigil's days and the joins between are written
// (tag `written`, in the speaker's BIBLE voice, listed in the U58 reply and pinned by tests/unit/content/quests/endings.test.ts).
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { Effect } from '@schema/effect';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY, type ChoiceInput } from './common';

const DASK = 'npc_dask';
const CAELUM = 'npc_caelum';
const BORIN = 'npc_borin_stonefist';
const NYX = 'npc_nyx';
const HADDA = 'npc_hadda_ironvow';
const DRAY = 'npc_ansel_dray';
const ILYRA = 'npc_ilyra';
const BRAK = 'npc_brak';
const TYRANT = 'cr_chronos_tyrant_unveiled';

const VIGIL = 'q_wardens_vigil';
const MENDING = 'q_the_mending';
const DAWN = 'q_weavers_dawn';
const SILENCE = 'q_iron_silence';
const ARCHIVE = 'q_long_archive';
const UNBOUND = 'q_unbound';

const stageOf = (id: `q_${string}`, stage: string): Condition => ({ quest: { id, stage } });
const active = (id: `q_${string}`): Condition => ({ quest: { id, status: 'active' } });
const completed = (id: `q_${string}`): Condition => ({ quest: { id, status: 'completed' } });
const notStarted = (id: `q_${string}`): Condition => ({ not: { quest: { id } } });
const activeCompanion = (id: 'ilyra' | 'brak' | 'nyx' | 'dask' | 'caelum'): Condition => ({ companion: { id, state: 'active' } });

// ---- Two derived Echoes (D-100's gap) --------------------------------------------------------------------------------------------

const VERSES = ['echo_litany_verse_1', 'echo_litany_verse_2', 'echo_litany_verse_3', 'echo_litany_verse_4', 'echo_litany_verse_5', 'echo_litany_verse_6', 'echo_litany_verse_7', 'echo_litany_verse_8', 'echo_litany_verse_9'] as const;
/** All nine verses held (STORY §12 `echo_litany_complete`: "derived: all nine verses held"). */
const NINE_VERSES: Condition = { all: VERSES.map((echo) => ({ echo })) };
/** The whole Litany known, by the Echo or by its nine parts. */
export const LITANY_KNOWN: Condition = { any: [{ echo: 'echo_litany_complete' }, NINE_VERSES] };
/** Grants `echo_litany_complete` when the nine are held (idempotent: a held Echo is not granted twice). */
export const DERIVE_LITANY: Effect = { onlyIf: { when: NINE_VERSES, effects: [{ grantEcho: 'echo_litany_complete' }] } };
/** Both halves of the Breach-anchor's design (STORY §6.3, D-067.6: "holding both, from any loops, grants `echo_anchor_schema`"). */
const BOTH_HALVES: Condition = { all: [{ echo: 'echo_anchor_half_a' }, { echo: 'echo_anchor_half_b' }] };
export const SCHEMA_KNOWN: Condition = { any: [{ echo: 'echo_anchor_schema' }, BOTH_HALVES] };
export const DERIVE_SCHEMA: Effect = { onlyIf: { when: BOTH_HALVES, effects: [{ grantEcho: 'echo_anchor_schema' }] } };

/** The giver's ask: a yes that starts the quest, a no that goes to the refusal line. */
const offer = (questId: `q_${string}`, yes: string, no: string, afterYes: string, refused: string): ChoiceInput[] => [
  { id: 'yes', text: yes, effects: [{ questStart: questId }], next: afterYes },
  { id: 'no', text: no, next: refused },
];

// ---- The Mending's requirements, as the offer reads them (STORY §11.6 B; the Resolution's are the Tyrant's data) ----------------
const MENDING_PREREQS: Condition[] = [{ echo: 'echo_anchor_mechanic' }, { echo: 'echo_heartstone_resonance' }, { echo: 'echo_void_resonance' }, LITANY_KNOWN, SCHEMA_KNOWN];

/**
 * The Resolution scenes' way back: the scene ends and the outcomes are on offer again (STORY §13 "return to Movement III
 * options"). In each of the three the way back sorts before the ending's choice by id (legal actions sort by canonical JSON),
 * so a bot that clicks the first choice (the sim's scenarios, pathBot on the road) reaches the Resolution, not an ending.
 */
const BACK_TO_THE_RESOLUTION = 'end';

export const dialogues = [
  // ==== Dask · q_wardens_vigil (A) ==============================================================================================

  // STORY §5.6 "A · Warden's Vigil — Dask: 'Someone could take his place. Someone who knew the words.'"; §11.6 the ask
  {
    id: 'scene_dask_wardens_vigil_offer',
    npcId: DASK,
    title: 'Someone who knew the words',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, LITANY_KNOWN, notStarted(VIGIL), { flag: 'flag_scene_done_scene_dask_introduction' }] },
    priority: SCENE_PRIORITY.report,
    entry: 'nine',
    nodes: [
      {
        id: 'nine',
        tags: ['written'],
        speaker: DASK,
        text: "You've got all nine. I can hear it on you; the words sit different in a person when there's no gap in them. I had six, the day I. Six, and a good guess at the seventh.",
        onEnter: [DERIVE_LITANY],
        next: 'place',
      },
      {
        id: 'place',
        tags: ['written'],
        speaker: DASK,
        text: "Someone could take his place. Someone who knew the words. I worked that out a second before the hold noticed me, and I've had seventy years to wish I hadn't. It's a door that wants a man in it, and it's been the same man five hundred years.",
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: DASK,
        text: "Go to the Apex. Talk him down to the Nine Speak, and when he asks what you'll do, say the ninth. Or don't; I'd understand don't. But go and see if it's you. Will you?",
        choices: offer(VIGIL, 'I will go and see.', 'Not yet.', 'go', 'refused'),
      },
      {
        id: 'go',
        tags: ['written'],
        speaker: DASK,
        text: "Keep your Resolve up past six; he won't hand it to anyone who's shaking. And if it is you, hells of a road, Wayfinder. I'll be in the Pass. I'll count the bells.",
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: DASK, text: "Fair. It's a lot of door. The words'll keep; they've kept this long.", next: 'end' },
    ],
  },
  {
    id: 'scene_dask_wardens_vigil_waiting',
    npcId: DASK,
    when: { all: [NOT_IN_HORDE, active(VIGIL)] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['written'], speaker: DASK, text: "The Apex. Past six, then the ninth. I'd come, but I'd only skip at the wrong. At the wrong moment.", next: 'end' }],
  },

  // ==== Caelum and Borin · q_the_mending (B) =====================================================================================

  // STORY §11.6 B, §5.6 "the Tyrant: 'Both ends. It must be closed from both ends.'": Caelum at the Garret, once he knows the
  // chamber (his errand done); the `report` band, so it comes before his second quest's offer, which waits for the pin (U56)
  {
    id: 'scene_caelum_mending_offer',
    npcId: CAELUM,
    title: 'Both ends',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, ...MENDING_PREREQS, completed('q_the_apprentices_errand'), notStarted(MENDING)] },
    priority: SCENE_PRIORITY.report,
    entry: 'chamber',
    nodes: [
      {
        id: 'chamber',
        tags: ['written'],
        speaker: CAELUM,
        text: "You said he stands there after. In the chamber, where the stone is, for five hundred years. I've been thinking about what you set on the rim, and how it was still there when the city wasn't.",
        onEnter: [DERIVE_LITANY, DERIVE_SCHEMA],
        next: 'pin',
      },
      {
        id: 'pin',
        tags: ['written'],
        speaker: CAELUM,
        text: "Master Hallow forged a second pin for the cradle this morning, and nobody will give him the hour to fit it. If a pin were set on the rim, it would be there after. Under him. Master Thal could put the weight down on it. Both ends: the pin here, and iron there, from your smith with the warm fire.",
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: CAELUM,
        text: "I'll take the pin. I'd rather borrow from Master Hallow than from any of them; he's the only one who'd understand. Will you carry it down with me, and then go and forge the other end?",
        choices: offer(MENDING, 'Both ends. Yes.', 'Not yet.', 'borrow', 'refused'),
      },
      {
        id: 'borrow',
        tags: ['written'],
        speaker: CAELUM,
        text: "It's on my cot, under the Litany. Take it; I'm not meant to have it. The stair opens on Last Bell, or to the ward seal, and the chamber will let us down if I'm with you.",
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: CAELUM, text: "Then he stands there a while longer. He's used to it. I'm not sure that's a comfort.", next: 'end' },
    ],
  },
  // STORY §13 `scene_anchor_in_the_conflux`, line for line (the Conflux's `ev_conflux_pin`, once the pin is on the rim with Caelum
  // beside you); Breach Clock +3 days (DESIGN §10.1); the pin lies in the Depths on return (the engine's Anchor, before.ts)
  {
    id: 'scene_anchor_in_the_conflux',
    title: 'Iron that does not wish',
    entry: 'whole',
    nodes: [
      {
        id: 'whole',
        tags: ['story'],
        speaker: 'narrator',
        text: "The Heartstone is whole. It is beautiful, which nobody told you. It beats slow and even in Hallow's iron like a thing asleep.",
        next: 'forged',
      },
      {
        id: 'forged',
        tags: ['story'],
        speaker: CAELUM,
        text: 'Master Hallow forged the pin in the Yard this morning. He says the cradle wants a second pin and nobody will give him the hour. So I took it.',
        choices: [{ id: 'stole', text: 'You stole from Hallow?', next: 'borrowed' }],
      },
      {
        id: 'borrowed',
        tags: ['story'],
        speaker: CAELUM,
        text: "I borrowed from the only one of them who'd understand. It isn't for the stone. It's for the thing that stands here after. You said he stands here after.",
        next: 'still',
      },
      {
        id: 'still',
        tags: ['story'],
        speaker: 'narrator',
        text: 'The pin does not move. It does not shine. Iron that does not wish.',
        next: 'here',
      },
      {
        id: 'here',
        tags: ['story'],
        speaker: CAELUM,
        text: "Will it still be here? When the city's gone?",
        choices: [{ id: 'only_thing', text: "It'll be the only thing that is.", next: 'steadies' }],
      },
      {
        id: 'steadies',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Far ahead of you, at the other end of five hundred years, something that has been bracing leans a little of its weight on the pin, and the hour steadies by three days.',
        onEnter: [{ clockWatches: 12 }, { questAdvance: { quest: MENDING, stage: 'forge' } }],
        next: 'end',
      },
    ],
  },
  // STORY §5.6 "Borin, with `echo_iron_that_does_not_wish`: 'Hallow's note says iron that does not wish. I can make that.'";
  // §11.6 B stage 3 / D stage 2: the Breach-anchor's recipe (its gate and cost are the recipe's, ../recipes.ts, D-066.10)
  {
    id: 'scene_borin_anchor',
    npcId: BORIN,
    title: 'Iron that does not wish',
    when: { all: [NOT_IN_HORDE, { any: [stageOf(MENDING, 'forge'), stageOf(SILENCE, 'cut_the_line')] }, { not: { item: { id: 'item_breach_anchor' } } }] },
    priority: SCENE_PRIORITY.report,
    entry: [
      { when: { echo: 'echo_iron_that_does_not_wish' }, node: 'note' },
      { when: { all: [] }, node: 'not_yet' },
    ],
    nodes: [
      {
        id: 'note',
        tags: ['written'],
        speaker: BORIN,
        text: "Hallow's note says iron that does not wish. I can make that. Speak plain: you want an anchor for the Breach, and you want it from my fire, because she was lit from his.",
        onEnter: [DERIVE_SCHEMA],
        next: 'recipe',
      },
      {
        id: 'recipe',
        tags: ['written'],
        speaker: BORIN,
        text: 'Three Aetherium Shards for the draw. A piece of the Heartstone, stable or dead, for the heart. Three Void Shards so it does not want anything. Ember ore, and one length of heartwood to quench in. No fee; she would not take one for this. Bring them to the anvil and I will temper it while you watch.',
        next: 'end',
      },
      {
        id: 'not_yet',
        tags: ['written'],
        speaker: BORIN,
        text: "An anchor for the Breach. I can draw the iron. I cannot make it not want; that was Hallow's, and his note is on a cairn on the Steppe with my mark over it. Read the bowl at Hallow's Cairn, then speak to me again.",
        next: 'end',
      },
    ],
  },

  // ==== Nyx · q_weavers_dawn (C) =================================================================================================

  // STORY §5.6 "C · Weaver's Dawn — Nyx, Trusted: 'Open it all the way, and I will go back and stop them.'"; §11.6 the ask
  {
    id: 'scene_nyx_weavers_dawn_offer',
    npcId: NYX,
    title: 'His face',
    when: {
      all: [
        NOT_IN_HORDE,
        FROM_LOOP_2,
        { rep: { faction: 'weavers', min: 60 } },
        { flag: 'flag_heartstone_exploited' },
        { item: { id: 'item_heartstone_core' } },
        { loyalty: { companion: 'nyx', min: 50 } },
        stageOf('q_what_she_would_undo', 'agreed'),
        { not: { flag: 'flag_tyrant_dead' } },
        notStarted(DAWN),
      ],
    },
    priority: SCENE_PRIORITY.report,
    entry: 'forty',
    nodes: [
      {
        id: 'forty',
        tags: ['written'],
        speaker: NYX,
        text: 'Forty years I have not gone to look at his face. I am going now. You have the Core in your pack; I can feel it from here, the way you feel a tooth.',
        next: 'open',
      },
      {
        id: 'open',
        tags: ['written'],
        speaker: NYX,
        text: 'Open it all the way, and I will go back and stop them. The door to the past is there because he holds it. The Core pries it; killing him slams it. So he lives, and we are not quick, and I do what I should have done at the sixth verse.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: NYX,
        text: 'Walk in beside me. Hold the floor while I work. Will you?',
        choices: offer(DAWN, 'I will walk in beside you.', 'Not yet.', 'beside', 'refused'),
      },
      { id: 'beside', tags: ['written'], speaker: NYX, text: 'Then we go slow, and we go now. The void remembers what it was before it was named. So do I.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: NYX, text: 'Not yet. He has heard that before, from me, for forty years.', next: 'end' },
    ],
  },
  // STORY §13 `scene_ending_dawn`, line for line (the Apex's `ev_apex_dawn`): give her the Core → §10.3's sequence (two waves,
  // then the ending from the second's `onVictory`); refuse → she is Hostile, the loop goes on, the quest fails
  {
    id: 'scene_ending_dawn',
    title: 'His face',
    entry: 'edge',
    nodes: [
      {
        id: 'edge',
        tags: ['story'],
        speaker: 'narrator',
        text: 'Nyx walks to the edge of the mass and looks up, for the first time in forty years, at his face.',
        next: 'me',
      },
      { id: 'me', tags: ['story'], speaker: NYX, text: "Veyran. It's me. I'm going to fix it.", next: 'name' },
      { id: 'name', tags: ['story'], speaker: 'narrator', text: 'The chorus says her name in eight voices, and then in his.', next: 'will_not' },
      { id: 'will_not', tags: ['story'], speaker: TYRANT, text: 'Nyxaria. It will not—', next: 'speak' },
      {
        id: 'speak',
        tags: ['story'],
        speaker: NYX,
        text: "You don't know that. You held. I'm going to speak. Give me the Core. Give me your hand.",
        choices: [
          { id: 'seen', text: "It was always going to fail. I've seen it.", when: { echo: 'echo_ritual_inevitable' }, tags: ['echo'], next: 'version' },
          { id: 'give', text: 'Give her the Core.', effects: [{ startCombat: 'enc_weavers_dawn_wave_1' }], next: 'end' },
          {
            id: 'refuse',
            text: 'Refuse.',
            effects: [{ setFlag: 'flag_nyx_hostile' }, { loyalty: { companion: 'nyx', delta: -100 } }, { dismiss: 'nyx' }, { questFail: DAWN }],
            next: 'refused',
          },
        ],
      },
      {
        id: 'version',
        tags: ['story'],
        speaker: NYX,
        text: "Then you've seen the version where I wasn't there.",
        choices: [
          { id: 'give', text: 'Give her the Core.', effects: [{ startCombat: 'enc_weavers_dawn_wave_1' }], next: 'end' },
          {
            id: 'refuse',
            text: 'Refuse.',
            effects: [{ setFlag: 'flag_nyx_hostile' }, { loyalty: { companion: 'nyx', delta: -100 } }, { dismiss: 'nyx' }, { questFail: DAWN }],
            next: 'refused',
          },
        ],
      },
      {
        id: 'refused',
        tags: ['written'],
        speaker: NYX,
        text: 'No. Then you are one more who looked at him and kept the thing in your hand. Go. The void remembers who was in the room.',
        next: 'end',
      },
    ],
  },

  // ==== Hadda · q_iron_silence (D) ===============================================================================================

  // STORY §5.6 "D · Iron Silence — Hadda Ironvow: 'Cut the line under it. No ley, no Breach, no Tyrant.'"; §11.6 the ask
  {
    id: 'scene_hadda_iron_silence_offer',
    npcId: HADDA,
    title: 'Cut the line',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, { rep: { faction: 'ironclad', min: 60 } }, { flag: 'flag_heartstone_destroyed' }, { echo: 'echo_iron_that_does_not_wish' }, SCHEMA_KNOWN, notStarted(SILENCE)] },
    priority: SCENE_PRIORITY.report,
    entry: 'dark',
    nodes: [
      {
        id: 'dark',
        tags: ['written'],
        speaker: HADDA,
        text: 'The stone is dark and the fen is dim and every Breach-born thing on the Steppe is a quarter less than it was. You did that. Now hear what the Telling never says, because nobody ever had the iron for it.',
        onEnter: [DERIVE_SCHEMA],
        next: 'line',
      },
      {
        id: 'line',
        tags: ['written'],
        speaker: HADDA,
        text: 'Cut the line under it. No ley, no Breach, no Tyrant. A road is cut where it is narrowest, and the line is narrowest under the Apex, where it feeds the thing that holds the door. Borin has the design and the fire. You have the hands.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: HADDA,
        text: 'Forge the anchor. Take Brak; this is the one loop he is allowed, and he has earned the door. Drive it in and let him swing. Will you cut it?',
        choices: offer(SILENCE, 'I will cut it.', 'Not now.', 'swing', 'refused'),
      },
      {
        id: 'swing',
        tags: ['written'],
        speaker: HADDA,
        text: 'Then the Steppe will have weather and nothing else, and we will keep the oath anyway, because an oath is not for the thing it was sworn against. Go.',
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: HADDA, text: 'Then it hums on under us. A rider who will not cut the road walks it twice.', next: 'end' },
    ],
  },
  {
    id: 'scene_hadda_iron_silence_waiting',
    npcId: HADDA,
    when: { all: [NOT_IN_HORDE, active(SILENCE)] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['written'], speaker: HADDA, text: 'The iron from Borin, Brak at your shoulder, the Apex. The line does not cut itself.', next: 'end' }],
  },
  // STORY §13 `scene_ending_silence`, line for line (opened by the Tyrant's data: Phase 2's entry, or the anchor shown in
  // communion, while the quest stands at the Apex with Brak beside you); "Now." → §10.4's sequence; "Wait." → his line, back to the fight
  {
    id: 'scene_ending_silence',
    title: 'Quiet',
    entry: 'that',
    nodes: [
      { id: 'that', tags: ['story'], speaker: BRAK, text: "That's it? That's the thing I was going to die for?", next: 'iron' },
      { id: 'iron', tags: ['story'], speaker: TYRANT, text: 'Iron that does not wish. He made that for me once. I see what it is for now.', next: 'man' },
      { id: 'man', tags: ['story'], speaker: BRAK, text: "You're a man.", next: 'was' },
      { id: 'was', tags: ['story'], speaker: TYRANT, text: 'I was. Set it well, scout. I would like it to be quick, and I have forgotten how quick feels.', next: 'word' },
      {
        id: 'word',
        tags: ['story'],
        speaker: BRAK,
        text: "Say the word. I'll swing.",
        choices: [
          { id: 'wait', text: 'Wait.', next: 'long' },
          { id: 'now', text: 'Now.', effects: [{ questAdvance: { quest: SILENCE, stage: 'silence' } }, { ending: 'ending_iron_silence' }], next: 'end' },
        ],
      },
      { id: 'long', tags: ['story'], speaker: BRAK, text: "Don't make me stand here long. I've stood in this door before, I think.", next: 'end' },
    ],
  },

  // ==== Dray and Ilyra · q_long_archive (E) ======================================================================================

  // STORY §5.6 "E · Long Archive — Keeper Dray: 'If the hour must be held, let it be held well. Let someone remember.'"; §11.6 the ask
  {
    id: 'scene_dray_long_archive_offer',
    npcId: DRAY,
    title: 'Let someone remember',
    when: {
      all: [
        NOT_IN_HORDE,
        FROM_LOOP_2,
        { rep: { faction: 'remnants', min: 60 } },
        { flag: 'flag_heartstone_stabilized' },
        { echo: 'echo_heartstone_resonance' },
        { any: [{ not: { corruption: { min: 6 } } }, { flag: 'flag_corruption_cleansed' }] },
        { companion: { id: 'ilyra', state: 'recruited' } },
        stageOf('q_the_keepers_price', 'keeper'),
        notStarted(ARCHIVE),
      ],
    },
    priority: SCENE_PRIORITY.report,
    entry: 'held_well',
    nodes: [
      {
        id: 'held_well',
        tags: ['written'],
        speaker: DRAY,
        text: 'If the hour must be held, let it be held well. Let someone remember. Ashcombe wrote that in 309, under the thirty, and nobody read it as an instruction until this year.',
        next: 'stone',
      },
      {
        id: 'stone',
        tags: ['written'],
        speaker: DRAY,
        text: 'The stone beats even now; you did that. Set the Stabilized Heartstone back in its cradle on the last dawn before the thirtieth, with the Keeper beside you, and the beat will climb the line to him and he will rest. Not sleep. Rest. The thirtieth will come up and go down and come up again as the first, and she will remember all of it.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: DRAY,
        text: 'It is not a mending. It is a ring, thirty days long, and one person awake in it. I have thought about it for a long time, and I would rather that than the sky. Will you do it?',
        choices: offer(ARCHIVE, 'I will.', 'Not yet.', 'dawn', 'refused'),
      },
      {
        id: 'dawn',
        tags: ['written'],
        speaker: DRAY,
        text: 'The last dawn, not the thirtieth; the day before. Ilyra knows the hour. If you would rather not wait for it, she will keep the vigil with you in the Depths, and the days will go by like pages.',
        next: 'end',
      },
      { id: 'refused', tags: ['written'], speaker: DRAY, text: 'Then the thirty is a count, and not a ring. I will write down that you were asked.', next: 'end' },
    ],
  },
  // D-067.14 *Keep the vigil*: Ilyra at the Depths while dawns remain (her `schedule`); the days pass in the scene, by the Echo
  // of the clock (no engine action fits: the Depths has no camp) — never past the last dawn (the choices read the dawns left)
  {
    id: 'scene_ilyra_keep_the_vigil',
    npcId: ILYRA,
    title: 'Keep the vigil',
    when: { all: [NOT_IN_HORDE, stageOf(ARCHIVE, 'last_dawn'), { location: 'loc_heartstone_depths' }, { not: { clock: { daysLeft: { max: 1 } } } }] },
    priority: SCENE_PRIORITY.report,
    entry: 'vigil',
    nodes: [
      {
        id: 'vigil',
        tags: ['written'],
        speaker: ILYRA,
        text: 'It is not the last dawn yet, Wayfinder. We could wait here for it. I have waited in worse rooms, with less to listen to.',
        textVariants: [
          { when: { clock: { daysLeft: { max: 3 } } }, text: 'Close now. Two more dawns, perhaps three. Sit with me; the stone keeps better time than the sky does.' },
          { when: { clock: { daysLeft: { max: 10 } } }, text: 'The days are going by like pages turned in another room. I have been counting them on the plinths. Keep the vigil a little longer.' },
        ],
        choices: [
          // the days pass in whole dawns, never past the last: ten at a time while there are more than ten left, then five, then one
          { id: 'ten_days', text: 'Keep the vigil.', when: { clock: { daysLeft: { min: 11 } } }, effects: [{ passWatches: 40 }], next: 'vigil' },
          { id: 'five_days', text: 'Keep the vigil.', when: { clock: { daysLeft: { min: 6, max: 10 } } }, effects: [{ passWatches: 20 }], next: 'vigil' },
          { id: 'one_day', text: 'Keep the vigil.', when: { clock: { daysLeft: { min: 2, max: 5 } } }, effects: [{ passWatches: 4 }], next: 'vigil' },
          { id: 'last_dawn', text: 'This is the last dawn.', when: { clock: { daysLeft: { max: 1 } } }, next: 'here' },
          { id: 'not_now', text: 'Not now.', next: 'end' },
        ],
      },
      { id: 'here', tags: ['written'], speaker: ILYRA, text: 'Here it is. The last one before the one that does not come. Give me the stone when you are ready, Wayfinder.', next: 'end' },
    ],
  },
  // STORY §13 `scene_ending_archive`, line for line (Ilyra at the Depths on the last dawn): stay, or leave — either way §10.5's sequence
  {
    id: 'scene_ending_archive',
    npcId: ILYRA,
    title: 'The thirty-first day',
    when: { all: [NOT_IN_HORDE, stageOf(ARCHIVE, 'archive'), { location: 'loc_heartstone_depths' }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'sets',
    nodes: [
      {
        id: 'sets',
        tags: ['story'],
        speaker: 'narrator',
        text: "Ilyra sets the Stabilized Heartstone into the cradle's broken rim. It takes the rhythm like a hand taking a hand.",
        next: 'time',
      },
      { id: 'time', tags: ['story'], speaker: ILYRA, text: "There. It's keeping time with him now. He'll rest. Not sleep; rest.", next: 'dawns' },
      { id: 'dawns', tags: ['story'], speaker: 'narrator', text: 'The thirtieth dawn comes up. Nothing tears. It goes down. The first dawn comes up.', next: 'remember' },
      {
        id: 'remember',
        tags: ['story'],
        speaker: ILYRA,
        text: 'I remember. Oh. I remember all of it. You in the Ruins, me saying— every time. Is this what it\'s been like for you?',
        choices: [{ id: 'yes', text: 'Yes.', next: 'kinder' }],
      },
      {
        id: 'kinder',
        tags: ['story'],
        speaker: ILYRA,
        text: "Then I'll be kinder about it than the world was to you. Go or stay. I'll know which you chose, and I'll be kind about that too.",
        choices: [
          { id: 'stay', text: 'Stay.', effects: [{ questAdvance: { quest: ARCHIVE, stage: 'remembered' } }, { ending: 'ending_long_archive' }], next: 'end' },
          { id: 'leave', text: 'Leave.', effects: [{ questAdvance: { quest: ARCHIVE, stage: 'remembered' } }, { ending: 'ending_long_archive' }], next: 'end' },
        ],
      },
    ],
  },

  // ==== The Resolution's words (A, B, F) — opened by the Unveiled Tyrant's `onSpared` ================================================

  // STORY §13 `scene_ending_vigil`, line for line (Resolve ≥ 6 with the whole Litany): "I'm sure." is the ending; "Not yet." goes
  // back to the Resolution's outcomes
  {
    id: 'scene_ending_vigil',
    title: 'I hold you',
    entry: 'nine',
    nodes: [
      { id: 'nine', tags: ['story'], speaker: TYRANT, text: 'You have all nine. You could say them. You understand that whoever says the ninth must stay in it.', choices: [{ id: 'understand', text: 'I understand.', next: 'only_thing' }] },
      { id: 'only_thing', tags: ['story'], speaker: TYRANT, text: 'Then I will ask you the only thing I have ever been able to ask. Are you sure.', next: 'ilyra' },
      // the companions' interjections (speaker: the companion id, so the engine skips the absent)
      { id: 'ilyra', tags: ['story'], speaker: 'ilyra', text: "There's another way. There's always—", next: 'ilyra_stays' },
      { id: 'ilyra_stays', tags: ['story'], speaker: 'ilyra', text: "I'll write it down. All of it. I'll write it so it stays.", next: 'dask' },
      { id: 'dask', tags: ['story'], speaker: 'dask', text: "Should've been me. Glad it isn't. Both true.", next: 'sure' },
      {
        id: 'sure',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The mass waits. For the first time since you crossed, nothing in it is moving.',
        choices: [
          { id: 'not_yet', text: 'Not yet.', next: 'not_yet' },
          { id: 'say_it', text: "I'm sure.", effects: [{ questAdvance: { quest: VIGIL, stage: 'stepped_in' } }, { ending: 'ending_wardens_vigil' }], next: 'end' },
        ],
      },
      { id: 'not_yet', tags: ['written'], speaker: TYRANT, text: 'Then not yet. The hour can hold that too. Say what you will do.', next: BACK_TO_THE_RESOLUTION },
    ],
  },
  // STORY §13 `scene_ending_mending`, line for line (Resolve 8 with the Breach-anchor and the rest): with Caelum beside you he
  // answers for the pin; without him you do. Drive the anchor → consent (`echo_tyrant_consent`), the ending; hesitate → his line,
  // back to the Resolution's outcomes. Ilyra's oath and Dask's staying colour the close (STORY §11.6: they gate nothing).
  {
    id: 'scene_ending_mending',
    title: 'Hour, go',
    entry: [
      { when: activeCompanion('caelum'), node: 'both_ends_caelum' },
      { when: { all: [] }, node: 'both_ends' },
    ],
    nodes: [
      { id: 'both_ends_caelum', tags: ['story'], speaker: TYRANT, text: 'Both ends. You found the other end. Who set the pin?', next: 'i_did' },
      { id: 'i_did', tags: ['story'], speaker: CAELUM, text: "I did, Master Thal. I borrowed it from Master Hallow. I'm sorry; I never gave it back.", next: 'laugh' },
      { id: 'laugh', tags: ['written'], speaker: 'narrator', text: 'A sound comes out of the mass that was once a laugh.', next: 'message' },
      { id: 'message', tags: ['story'], speaker: TYRANT, text: 'Caelum. The message. Did you—', next: 'nobody' },
      { id: 'nobody', tags: ['story'], speaker: CAELUM, text: 'No. Nobody did.', next: 'sorry' },
      {
        id: 'sorry',
        tags: ['story'],
        speaker: TYRANT,
        text: 'Good. It said begin. I am sorry, boy. I say it to you because you are the only one here I am allowed to say it to.',
        next: 'forgiving',
      },
      {
        id: 'forgiving',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Caelum does not answer that. He does not need to; he has already said what he had to say to this face, and it heard him.',
        textVariants: [
          {
            when: { echo: 'echo_caelum_cannot' },
            text: "Caelum: 'I don't forgive you, Master Thal.' The Tyrant: 'No. Set it anyway. That is the only kind of forgiving I was ever going to get.'",
          },
        ],
        next: 'will_you',
      },
      {
        id: 'both_ends',
        tags: ['story'],
        speaker: TYRANT,
        text: 'Both ends. You found the other end. Who set the pin?',
        choices: [{ id: 'a_boy', text: 'A boy who borrowed it. He stayed.', next: 'twice' }],
      },
      { id: 'twice', tags: ['story'], speaker: TYRANT, text: '...Then it was set twice. Once by him and once by you, telling me.', next: 'will_you' },
      {
        id: 'will_you',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The Breach-anchor is in your hands, cold, and under the floor the line it was made for hums.',
        choices: [{ id: 'let_go', text: 'Will you let it go?', next: 'drive_it' }],
      },
      { id: 'drive_it', tags: ['story'], speaker: TYRANT, text: 'Drive it in, and I will say the word I have not been able to say.', next: 'anchor' },
      {
        id: 'anchor',
        tags: ['written'],
        speaker: 'narrator',
        text: 'There is a seam in the Apex floor the width of the anchor. It has been there five hundred years, waiting to be the width of something.',
        choices: [
          { id: 'hesitate', text: 'Hesitate.', next: 'watch' },
          { id: 'set_it', text: 'Drive the anchor.', effects: [{ grantEcho: 'echo_tyrant_consent' }, { questAdvance: { quest: MENDING, stage: 'mended' } }, { ending: 'ending_mending' }], next: 'end' },
        ],
      },
      { id: 'watch', tags: ['story'], speaker: TYRANT, text: 'Take the watch you need. I have had many.', next: BACK_TO_THE_RESOLUTION },
    ],
    companionReactions: [
      // STORY §10.2 step 1: "Ilyra, if present and sworn off tearing"; "Dask, if present and staying"
      { companionId: 'ilyra', when: stageOf('q_the_keepers_price', 'unbound_hand'), text: 'Ilyra: "I didn\'t open a door this time. I want you to know that."' },
      { companionId: 'dask', when: { flag: 'flag_dask_anchor' }, text: 'Dask: "Still here. Told you I would be."' },
      { companionId: 'caelum', when: { echo: 'echo_caelum_forgives' }, text: 'Caelum: "Master Thal. It\'s done. You can put it down."' },
    ],
  },
  // STORY §13 `scene_ending_unbound`, line for line (the Resolution with neither the Vigil nor the Mending on offer): the tear,
  // onto the city or out of the world. Step through → F (`flag_refused_all_paths`); turn back → the Resolution's outcomes
  {
    id: 'scene_ending_unbound',
    title: 'Not my world',
    entry: 'quiet',
    nodes: [
      {
        id: 'quiet',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The chorus has gone under. What is left looks at you with a face that has been a face for five hundred years and has not been looked at.',
        onEnter: [{ questStart: UNBOUND }],
        next: 'city',
      },
      {
        id: 'city',
        tags: ['written'],
        speaker: TYRANT,
        text: 'I can open the hour behind me. It opens onto the city, three days before, where I am a man who has not done this yet. Walk in, if you want to see it. I cannot.',
        next: 'or_go',
      },
      {
        id: 'or_go',
        tags: ['story'],
        speaker: TYRANT,
        text: 'Or go. The tear is open. I will not stop you. I have never been able to stop anyone.',
        choices: [{ id: 'hold', text: "You'll hold?", next: 'until' }],
      },
      { id: 'until', tags: ['story'], speaker: TYRANT, text: 'Until the thirtieth dawn. Then I will not. You know what comes. You will not be here for it. That is a kind of answer.', next: 'fair' },
      { id: 'fair', tags: ['story'], speaker: 'dask', text: "Fair. I'd have gone too, if I'd had the neck for it.", next: 'tear' },
      {
        id: 'tear',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Past the mass the tear stands open on nothing you have a name for. The air that comes through it is still.',
        choices: [
          { id: 'turn_back', text: 'Turn back.', next: 'turned' },
          { id: 'walk_through', text: 'Step through.', effects: [{ setFlag: 'flag_refused_all_paths' }, { questAdvance: { quest: UNBOUND, stage: 'gone' } }, { ending: 'ending_unbound' }], next: 'end' },
        ],
      },
      { id: 'turned', tags: ['written'], speaker: TYRANT, text: 'Then say what you will do. I have the hour.', next: BACK_TO_THE_RESOLUTION },
    ],
  },
] satisfies DialogueSceneInput[];

/** The nodes of the three Resolution scenes whose last choice is an ending (tests read them). */
export const RESOLUTION_ENDINGS: readonly [sceneId: string, nodeId: string, choiceId: string, endingId: string][] = [
  ['scene_ending_vigil', 'sure', 'say_it', 'ending_wardens_vigil'],
  ['scene_ending_mending', 'anchor', 'set_it', 'ending_mending'],
  ['scene_ending_unbound', 'tear', 'walk_through', 'ending_unbound'],
];
