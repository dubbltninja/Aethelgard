// The scenes of the six legacy quests (STORY §4.1 beats 2–9, §13 `scene_first_meeting_ilyra`, `scene_echo_crystal`,
// `scene_heartstone_choice`; legacy/echoes_of_aethelgard.py `handle_ilyra`, `handle_brak`, `handle_nyx`, `handle_heartstone`
// and the NPCs' greetings in legacy/aethelgard_data.py). The quests are ../quests/legacy.ts; the conventions are this
// folder's index.ts.
//
// Who says what, and when (priority bands from ./common.ts; every NPC scene is closed while the Horde runs):
//   Ilyra   scene_first_meeting_ilyra (offer q_echo_crystal) · scene_ilyra_echo_crystal_waiting · scene_echo_crystal (Give /
//           Keep; Loop 2+ Listen) · scene_ilyra_crystal_deciphered (verse I on the next talk after Give) ·
//           scene_ilyra_lost_scroll_offer · scene_ilyra_lost_scroll_waiting · scene_ilyra_lost_scroll_return (Loop 1: the
//           legacy hand-over; Loop 2+: give it, or keep it for Nyx) · scene_ilyra_conflux (after)
//   Brak    scene_brak_clear_path_offer · _waiting · _report · scene_brak_blighted_outpost_offer · _waiting · _report ·
//           scene_brak_peaks_quiet (after) · scene_brak_twenty_dawns (Loop 1, after a Destroy)
//   Nyx     scene_nyx_void_shards_offer (the kept-Crystal line when it applies) · _waiting · _return (Give / Refuse) ·
//           scene_nyx_void_sings (after Give) · scene_nyx_lost_scroll (Loop 2+: Oriel's scroll read to her)
//   Borin   scene_borin_twenty_dawns (Loop 1, after a Destroy, if Brak has not said it)
//   —       scene_heartstone_choice (opened by the Depths' `ev_depths_choice`, WORLD §3.1)
//
// Not here, by design: the Loop 2+ déjà vu lines, recruitment and refusals (the companion units, U54–U56); the Horde's "Go,
// Wayfinder!" and the portal (U62); Ilyra's six-Spellbook lore paragraph (the portal scene and her idle talk); the legacy
// "Shimmering Pass" lines each of the three says at random once the Pass is visited (no condition reads "visited", and
// content has no randomness); `echo_borin_oath` (Borin after the Outpost: no line in STORY or legacy). STORY marks no
// class-variant line in these scenes (U59 writes them).
import type { DialogueSceneInput } from '@schema/dialogue';
import type { OnlyIf } from '@schema/effect';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY, echoLocked, loyaltyFor, type ChoiceInput } from './common';

// ---- Lines used more than once ---------------------------------------------------------------------------------------------

/** The NPCs' legacy greetings (aethelgard_data.py LOCATION_DEFS "dialogue"); legacy `talk_to_npc` prints them first. */
const ILYRA_GREETING = 'The whispers here are louder each day. The past is trying to speak. Will you help me listen?';
const BRAK_GREETING = 'Magic twists the wilds. We survive by steel and stubbornness. Prove your worth, Wayfinder.';
const NYX_GREETING = 'The void remembers you. Its shards wait in the hollow to the east, where the corruption thickens.';

const CONFLUX_THANKS = 'The Ley Line Conflux will no longer hide from us. Thank you, Wayfinder.';
const VOID_SINGS = 'The void sings through you now. Do not waste its favor.';
const TWENTY_DAWNS = 'Twenty dawns, Wayfinder. Not thirty.';

/** STORY §2.3, verse I (The Witness, Oriel Danthe): the canonical text. */
const VERSE_ONE = 'Let it be written as it is done.\nLet the hand fail and the word stand.\nWhat we do here, we do before the stone.';

/**
 * STORY §6.3 / §12: Resonance, Hunger and Silence held together (across loops; one Heartstone per loop) are the Three Beats,
 * `echo_heartstone_triune`. Checked right after each of the three is granted (D-100: it had no grant).
 */
const THREE_BEATS: OnlyIf = {
  when: { all: [{ echo: 'echo_heartstone_resonance' }, { echo: 'echo_heartstone_hunger' }, { echo: 'echo_heartstone_silence' }] },
  effects: [{ grantEcho: 'echo_heartstone_triune' }],
};

/** DESIGN §13.2: a legacy yes/no prompt is a two-choice node; `yes` starts the quest. */
const yesNo = (questId: `q_${string}`, refused: string): ChoiceInput[] => [
  { id: 'yes', text: 'Yes.', effects: [{ questStart: questId }], next: 'end' },
  { id: 'no', text: 'No.', next: refused },
];

/** Loop 1 only: the destroyed Heartstone's new count said aloud (DESIGN §10.1, WORLD §10.10 #1); whoever is met first says it. */
const dawnCount = (otherScene: `scene_${string}`) => ({
  all: [NOT_IN_HORDE, { loop: { max: 1 } }, { flag: 'flag_heartstone_destroyed' as const }, { not: { flag: `flag_scene_done_${otherScene}` as const } }],
});

export const dialogues = [
  // ==== Ilyra · q_echo_crystal ===============================================================================================

  // STORY §13: the game's first conversation, and from Loop 2 the loop's.
  {
    id: 'scene_first_meeting_ilyra',
    npcId: 'npc_ilyra',
    title: 'The whispers are louder',
    when: { all: [NOT_IN_HORDE, { not: { quest: { id: 'q_echo_crystal' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: [
      { when: FROM_LOOP_2, node: 'greeting_again' },
      { when: { all: [] }, node: 'greeting' },
    ],
    nodes: [
      { id: 'greeting', tags: ['legacy'], speaker: 'npc_ilyra', text: ILYRA_GREETING, next: 'ask' },
      { id: 'greeting_again', tags: ['legacy'], speaker: 'npc_ilyra', text: ILYRA_GREETING, next: 'smudge' },
      { id: 'smudge', tags: ['story'], speaker: 'narrator', text: 'She has a smudge of ink on her thumb. You remember the smudge.', next: 'ask' },
      {
        id: 'ask',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'Accept her request to recover an Echo Crystal?',
        choices: [
          ...yesNo('q_echo_crystal', 'refused'),
          // Loop 2+: she is kind and does not believe you (STORY §5.1); U54 reads the flag (scene_ilyra_portal, her arc)
          { id: 'done_this_before', text: "Ilyra, I've done this before.", when: FROM_LOOP_2, oncePerLoop: true, effects: [{ setFlag: 'flag_ilyra_told' }], next: 'told' },
          // the watchword (q_voices_in_the_stacks, usable the loop after): she believes you; recruitment is U54's, which reads
          // this choice's flag `flag_choice_scene_first_meeting_ilyra_watchword`
          echoLocked('echo_ilyra_watchword', {
            id: 'watchword',
            text: 'The ink still holds.',
            oncePerLoop: true,
            effects: [{ rep: { faction: 'remnants', delta: 10 } }],
            next: 'believed',
          }),
          // the shortcut (D-010): the quest's `shortcuts` open it at take_crystal when the Echo is held
          echoLocked('echo_crystal_location', { id: 'third_alcove', text: 'Third alcove, behind the fallen shelf.', effects: [{ questStart: 'q_echo_crystal' }], next: 'end' }),
        ],
      },
      { id: 'refused', tags: ['legacy'], speaker: 'narrator', text: 'Ilyra nods, her eyes shadowed with disappointment.', next: 'end' },
      {
        id: 'told',
        tags: ['story'],
        speaker: 'npc_ilyra',
        text: "Then you'll know I say yes to that with a smile and don't believe a word. Help me listen anyway.",
        next: 'ask',
      },
      {
        id: 'believed',
        tags: ['story'],
        speaker: 'npc_ilyra',
        text: '...I have never said that aloud. Sit down. Tell me everything, and tell me quickly, because if you know that you know how little time we have.',
        next: 'ask',
      },
    ],
  },
  {
    id: 'scene_ilyra_echo_crystal_waiting',
    npcId: 'npc_ilyra',
    when: { all: [NOT_IN_HORDE, { any: [{ quest: { id: 'q_echo_crystal', stage: 'reach_library' } }, { quest: { id: 'q_echo_crystal', stage: 'take_crystal' } }] }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['legacy'], speaker: 'npc_ilyra', text: 'The Shattered Library still holds what we need. Be cautious.', next: 'end' }],
  },
  // STORY §13: the first choice with a cost (DESIGN §11.2: Give Remnants +15; Keep Weavers +10, Remnants −10).
  {
    id: 'scene_echo_crystal',
    npcId: 'npc_ilyra',
    title: 'The Crystal choice',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_echo_crystal', stage: 'return' } }, { item: { id: 'item_echo_crystal' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'ask',
    nodes: [
      {
        id: 'ask',
        tags: ['legacy'],
        speaker: 'npc_ilyra',
        text: 'You found it. Will you share its truth with the Remnants?',
        choices: [
          {
            id: 'give',
            text: 'Give the Echo Crystal to Ilyra.',
            effects: [
              { takeItem: { item: 'item_echo_crystal' } },
              { rep: { faction: 'remnants', delta: 15 } },
              { setFlag: 'flag_crystal_given' },
              ...loyaltyFor(['ilyra'], ['nyx']),
              // the legacy reward on Give: the other half of DESIGN §6.2's 120 XP, and the gold
              { xp: 60 },
              { gold: 20 },
              { questAdvance: { quest: 'q_echo_crystal', stage: 'given' } },
            ],
            next: 'given',
          },
          {
            id: 'keep',
            text: 'Keep it for yourself.',
            effects: [
              { rep: { faction: 'weavers', delta: 10 } },
              { rep: { faction: 'remnants', delta: -10 } },
              { setFlag: 'flag_kept_echo_crystal' },
              ...loyaltyFor(['nyx'], ['ilyra']),
              { questAdvance: { quest: 'q_echo_crystal', stage: 'kept' } },
            ],
            next: 'kept',
          },
        ],
      },
      { id: 'given', tags: ['legacy'], speaker: 'narrator', text: 'Ilyra cradles the crystal, whispering a prayer.', next: 'given_trust' },
      // U84 (REPORT U79 #4): the scroll is offered as soon as its condition holds (the crystal quest done), not on a later talk
      { id: 'given_trust', tags: ['legacy'], speaker: 'narrator', text: "You gain the Remnants' trust.", next: 'scroll_ask' },
      { id: 'scroll_ask', tags: ['legacy'], speaker: 'narrator', text: 'Ilyra asks you to recover her lost scroll from the Sunken Archives. Accept?', choices: yesNo('q_lost_scroll', 'scroll_refused') },
      { id: 'scroll_refused', tags: ['legacy'], speaker: 'narrator', text: 'Ilyra presses the request no further, but her concern lingers.', next: 'end' },
      { id: 'kept', tags: ['legacy'], speaker: 'narrator', text: 'You tuck the crystal away, its whispers now yours alone.', next: 'kept_stirs' },
      {
        id: 'kept_stirs',
        tags: ['legacy'],
        speaker: 'narrator',
        text: "The Shadow Weavers' influence stirs within you.",
        // Loop 2+ (STORY §13, new): the Amulet and the Crystal agree, and the Crystal can be heard
        textVariants: [
          // U62 (STORY §12 `echo_crystal_seeded`): told in the Before what it would hear, it knows your voice before you Listen
          {
            when: { echo: 'echo_crystal_seeded' },
            text: "The Shadow Weavers' influence stirs within you. The Crystal is warm against the Amulet before you touch it: it knows your voice. You told it, in a library that still had a roof, what it would hear.",
          },
          {
            when: FROM_LOOP_2,
            text: "The Shadow Weavers' influence stirs within you. The Crystal is cold against the Amulet, and then it is not: two things that remember, agreeing.",
          },
        ],
        // Loop 1: no choice is shown, so *Continue* ends the scene
        choices: [
          {
            id: 'listen',
            text: 'Listen.',
            // U62b (STORY §5.1, §12 `echo_amulet_memory`: "Listen action"): the Amulet's, which wakes with you in Loop 2
            when: { all: [FROM_LOOP_2, { echo: 'echo_amulet_memory' }] },
            tags: ['echo'],
            // DESIGN §11.2 / D-017: verse 1 and the nine voices at once
            effects: [{ grantEcho: 'echo_litany_verse_1' }, { grantEcho: 'echo_nine_voices' }],
            next: 'verse',
          },
          { id: 'leave', text: 'Leave it be.', when: FROM_LOOP_2, next: 'end' },
        ],
      },
      { id: 'verse', tags: ['story'], speaker: 'narrator', text: VERSE_ONE, next: 'end' },
    ],
  },
  // D-017 / STORY §11.2: Give → Ilyra deciphers the Crystal, and verse I is spoken on the next talk.
  {
    id: 'scene_ilyra_crystal_deciphered',
    npcId: 'npc_ilyra',
    when: { all: [NOT_IN_HORDE, { flag: 'flag_crystal_given' }] },
    priority: SCENE_PRIORITY.payoff,
    repeatable: false,
    entry: 'listened',
    nodes: [
      { id: 'listened', tags: ['written'], speaker: 'npc_ilyra', text: 'I listened to it all night. One voice is clearer than the others. She is reading something aloud.', next: 'verse' },
      { id: 'verse', tags: ['story'], speaker: 'npc_ilyra', text: VERSE_ONE, onEnter: [{ grantEcho: 'echo_litany_verse_1' }], next: 'end' },
    ],
  },

  // ==== Ilyra · q_lost_scroll ================================================================================================

  {
    id: 'scene_ilyra_lost_scroll_offer',
    npcId: 'npc_ilyra',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_echo_crystal', status: 'completed' } }, { not: { quest: { id: 'q_lost_scroll' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'greeting',
    nodes: [
      { id: 'greeting', tags: ['legacy'], speaker: 'npc_ilyra', text: ILYRA_GREETING, next: 'ask' },
      {
        id: 'ask',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'Ilyra asks you to recover her lost scroll from the Sunken Archives. Accept?',
        choices: yesNo('q_lost_scroll', 'refused'),
      },
      { id: 'refused', tags: ['legacy'], speaker: 'narrator', text: 'Ilyra presses the request no further, but her concern lingers.', next: 'end' },
    ],
  },
  {
    id: 'scene_ilyra_lost_scroll_waiting',
    npcId: 'npc_ilyra',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_lost_scroll', status: 'active' } }, { not: { quest: { id: 'q_lost_scroll', stage: 'deliver' } } }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['legacy'], speaker: 'npc_ilyra', text: 'The Sunken Archives are treacherous. The scroll must still be there.', next: 'end' }],
  },
  // Loop 1: the legacy hand-over (no prompt). Loop 2+: the scroll may go to Nyx instead (STORY §11.2), so Ilyra asks first.
  // DESIGN §11.2: Remnants +10, Weavers −3, +1 MAG and a Mana Bloom.
  {
    id: 'scene_ilyra_lost_scroll_return',
    npcId: 'npc_ilyra',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_lost_scroll', stage: 'deliver' } }, { item: { id: 'item_scholars_lost_scroll' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: [
      { when: FROM_LOOP_2, node: 'ask' },
      { when: { all: [] }, node: 'thanks' },
    ],
    nodes: [
      {
        id: 'ask',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Ilyra sees the Remnant wax on the scroll.',
        choices: [
          { id: 'give', text: 'Give her the scroll.', next: 'thanks' },
          { id: 'not_yet', text: 'Not yet.', next: 'end' },
        ],
      },
      {
        id: 'thanks',
        tags: ['legacy'],
        speaker: 'npc_ilyra',
        text: CONFLUX_THANKS,
        onEnter: [
          { takeItem: { item: 'item_scholars_lost_scroll' } },
          { statBonus: { stat: 'magic', delta: 1 } },
          { giveItem: { item: 'item_mana_bloom' } },
          { rep: { faction: 'remnants', delta: 10 } },
          { rep: { faction: 'weavers', delta: -3 } },
          // STORY §11.2: the Danthe line seeded (q_the_danthe_line confirms it) and the Door of Pages
          { grantEcho: 'echo_oriel_lineage' },
          { grantEcho: 'echo_archive_door' },
          // STORY §7.1: giving her the scroll is one of Ilyra's loyalty beats
          ...loyaltyFor(['ilyra']),
          { questAdvance: { quest: 'q_lost_scroll', stage: 'to_ilyra' } },
        ],
        next: 'unseals',
      },
      {
        id: 'unseals',
        tags: ['legacy'],
        speaker: 'narrator',
        text:
          "Ilyra unseals the scroll, her eyes widening with a mix of awe and terror as the ancient ink stirs and shifts. 'It speaks of a desperate ritual at the Conflux,' she whispers, her voice trembling. 'Rival mages, not merely seeking power, but to command time itself, to transcend the natural order. Their ambition tore a hole in reality, a Temporal Breach, and the Sundering was merely its catastrophic echo. This scroll... it warns that the Breach was never truly closed, only contained by something ancient and terrible.'",
        next: 'trust',
      },
      { id: 'trust', tags: ['legacy'], speaker: 'narrator', text: "You gain insight and the Remnants' deeper trust.", next: 'end' },
    ],
  },
  {
    id: 'scene_ilyra_conflux',
    npcId: 'npc_ilyra',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_lost_scroll', stage: 'to_ilyra' } }] },
    priority: SCENE_PRIORITY.after,
    entry: 'thanks',
    nodes: [{ id: 'thanks', tags: ['legacy'], speaker: 'npc_ilyra', text: CONFLUX_THANKS, next: 'end' }],
  },

  // ==== Brak · q_clear_path ==================================================================================================

  {
    id: 'scene_brak_clear_path_offer',
    npcId: 'npc_brak',
    when: { all: [NOT_IN_HORDE, { not: { quest: { id: 'q_clear_path' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'greeting',
    nodes: [
      { id: 'greeting', tags: ['legacy'], speaker: 'npc_brak', text: BRAK_GREETING, next: 'ask' },
      {
        id: 'ask',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'Brak asks you to clear the monsters in the Barren Peaks to the north. Accept?',
        choices: yesNo('q_clear_path', 'refused'),
      },
      { id: 'refused', tags: ['legacy'], speaker: 'narrator', text: 'Brak grunts, unimpressed.', next: 'end' },
    ],
  },
  {
    id: 'scene_brak_clear_path_waiting',
    npcId: 'npc_brak',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_clear_path', stage: 'hunt' } }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['legacy'], speaker: 'npc_brak', text: 'The brute still prowls the peaks. Finish it.', next: 'end' }],
  },
  // DESIGN §11.2: Ironclad +10 and the Mail are the quest's rewards; DESIGN §12.5: Brak values the Ironclad quests.
  {
    id: 'scene_brak_clear_path_report',
    npcId: 'npc_brak',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_clear_path', stage: 'report' } }] },
    priority: SCENE_PRIORITY.report,
    entry: 'mail',
    nodes: [
      {
        id: 'mail',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'Brak hands you Ironclad Mail.',
        onEnter: [...loyaltyFor(['brak']), { questAdvance: { quest: 'q_clear_path', stage: 'done' } }],
        next: 'end',
      },
    ],
  },

  // ==== Brak · q_blighted_outpost ============================================================================================

  {
    id: 'scene_brak_blighted_outpost_offer',
    npcId: 'npc_brak',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_clear_path', status: 'completed' } }, { not: { quest: { id: 'q_blighted_outpost' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'greeting',
    nodes: [
      { id: 'greeting', tags: ['legacy'], speaker: 'npc_brak', text: BRAK_GREETING, next: 'ask' },
      {
        id: 'ask',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'Brak growls about the Blighted Outpost east of the Barren Peaks. Clear it out?',
        choices: yesNo('q_blighted_outpost', 'refused'),
      },
      { id: 'refused', tags: ['legacy'], speaker: 'narrator', text: 'Brak spits into the fire, unimpressed.', next: 'end' },
    ],
  },
  {
    id: 'scene_brak_blighted_outpost_waiting',
    npcId: 'npc_brak',
    when: {
      all: [NOT_IN_HORDE, { any: [{ quest: { id: 'q_blighted_outpost', stage: 'golems' } }, { quest: { id: 'q_blighted_outpost', stage: 'speak_warder_word' } }] }],
    },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['legacy'], speaker: 'npc_brak', text: 'The outpost still crawls with stone-hide beasts. Finish the job.', next: 'end' }],
  },
  // DESIGN §11.2: Ironclad +15, Weavers −3 and the Plate are the quest's rewards; +15 max HP and a full heal are legacy.
  {
    id: 'scene_brak_blighted_outpost_report',
    npcId: 'npc_brak',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_blighted_outpost', stage: 'cleared' } }] },
    priority: SCENE_PRIORITY.report,
    entry: 'plate',
    nodes: [
      {
        id: 'plate',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'Brak clasps your forearm and hands over Ironclad Plate Armor.',
        onEnter: [
          { statBonus: { stat: 'hpMax', delta: 15 } },
          { heal: { hp: 'full' } },
          ...loyaltyFor(['brak']),
          { questAdvance: { quest: 'q_blighted_outpost', stage: 'done' } },
        ],
        next: 'tougher',
      },
      { id: 'tougher', tags: ['legacy'], speaker: 'narrator', text: 'Your body feels tougher after the ordeal.', next: 'end' },
    ],
  },
  {
    id: 'scene_brak_peaks_quiet',
    npcId: 'npc_brak',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_blighted_outpost', status: 'completed' } }] },
    priority: SCENE_PRIORITY.after,
    entry: 'quiet',
    nodes: [{ id: 'quiet', tags: ['legacy'], speaker: 'npc_brak', text: 'The peaks sing quieter now. You did well, Wayfinder.', next: 'end' }],
  },

  // ==== Nyx · q_void_shards ==================================================================================================

  {
    id: 'scene_nyx_void_shards_offer',
    npcId: 'npc_nyx',
    when: { all: [NOT_IN_HORDE, { not: { quest: { id: 'q_void_shards' } } }] },
    priority: SCENE_PRIORITY.offer,
    entry: [
      { when: { flag: 'flag_kept_echo_crystal' }, node: 'greeting_kept' },
      { when: { all: [] }, node: 'greeting' },
    ],
    nodes: [
      { id: 'greeting', tags: ['legacy'], speaker: 'npc_nyx', text: NYX_GREETING, next: 'ask' },
      { id: 'greeting_kept', tags: ['legacy'], speaker: 'npc_nyx', text: NYX_GREETING, next: 'kept' },
      { id: 'kept', tags: ['legacy'], speaker: 'npc_nyx', text: 'The echo you kept drew me here. The void has tasted you already. Its shards lie to the east.', next: 'ask' },
      {
        id: 'ask',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'Nyx offers a pact: gather three Void Shards to the east. Accept?',
        choices: yesNo('q_void_shards', 'refused'),
      },
      { id: 'refused', tags: ['legacy'], speaker: 'narrator', text: "Nyx fades back into the chasm's shadow.", next: 'end' },
    ],
  },
  {
    id: 'scene_nyx_void_shards_waiting',
    npcId: 'npc_nyx',
    when: {
      all: [
        NOT_IN_HORDE,
        { any: [{ quest: { id: 'q_void_shards', stage: 'gather' } }, { all: [{ quest: { id: 'q_void_shards', stage: 'return' } }, { not: { item: { id: 'item_void_shard', count: 3 } } }] }] },
      ],
    },
    priority: SCENE_PRIORITY.waiting,
    entry: 'waiting',
    nodes: [{ id: 'waiting', tags: ['legacy'], speaker: 'npc_nyx', text: 'The void still hungers. The shards are to the east.', next: 'end' }],
  },
  // D-017 / DESIGN §11.2: Give Weavers +20 and the Dagger; Refuse Ironclad +5, Weavers −20 (Nyx turns Wary), the shards kept for
  // the void-forged recipes (`flag_shards_refused`). DESIGN §12.5: refusing costs Nyx 15.
  {
    id: 'scene_nyx_void_shards_return',
    npcId: 'npc_nyx',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_void_shards', stage: 'return' } }, { item: { id: 'item_void_shard', count: 3 } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'hand',
    nodes: [
      {
        id: 'hand',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'Nyx extends a gloved hand for the shards. Give them?',
        choices: [
          {
            id: 'yes',
            text: 'Yes.',
            effects: [
              { takeItem: { item: 'item_void_shard', count: 3 } },
              { rep: { faction: 'weavers', delta: 20 } },
              { giveItem: { item: 'item_shadow_kissed_dagger' } },
              ...loyaltyFor(['nyx']),
              { questAdvance: { quest: 'q_void_shards', stage: 'given' } },
            ],
            next: 'sings',
          },
          {
            id: 'no',
            text: 'No.',
            effects: [
              { rep: { faction: 'ironclad', delta: 5 } },
              { rep: { faction: 'weavers', delta: -20 } },
              { setFlag: 'flag_shards_refused' },
              { loyalty: { companion: 'nyx', delta: -15 } },
              { questAdvance: { quest: 'q_void_shards', stage: 'refused' } },
            ],
            next: 'whispers',
          },
        ],
      },
      { id: 'sings', tags: ['legacy'], speaker: 'npc_nyx', text: VOID_SINGS, next: 'tears' },
      {
        id: 'tears',
        tags: ['legacy'],
        speaker: 'narrator',
        text:
          "Nyx smiles, her voice like smoke: 'These Void Shards... they are tears from the Temporal Breach itself, Wayfinder. Fragments of raw, unmaking energy. The Sundering was not a tragedy, but an opportunity - a glimpse into the true chaos that lies beyond. The Shadow Weavers will not merely seize its chaos, we will become its ultimate power, bending time and reality to our will!'",
        next: 'warning',
      },
      // STORY §4.1 beat 8 (D-067.13): the only warning anyone gives in Loop 1
      { id: 'warning', tags: ['story'], speaker: 'npc_nyx', text: 'When you reach the Apex, do not be quick. A dead door is a wall.', next: 'end' },
      { id: 'whispers', tags: ['legacy'], speaker: 'npc_nyx', text: 'Then keep their whispers, for now.', next: 'end' },
    ],
  },
  {
    id: 'scene_nyx_void_sings',
    npcId: 'npc_nyx',
    when: { all: [NOT_IN_HORDE, { quest: { id: 'q_void_shards', stage: 'given' } }] },
    priority: SCENE_PRIORITY.after,
    entry: 'sings',
    nodes: [{ id: 'sings', tags: ['legacy'], speaker: 'npc_nyx', text: VOID_SINGS, next: 'end' }],
  },
  // STORY §11.2 / §5.5 source 3 (Loop 2+): Oriel's scroll read to Nyx. DESIGN §11.2: Weavers +15, Remnants −15; the Recoil and
  // verse 8. It is against Ilyra's value (STORY §7.1: giving her the scroll).
  {
    id: 'scene_nyx_lost_scroll',
    npcId: 'npc_nyx',
    when: { all: [NOT_IN_HORDE, FROM_LOOP_2, { quest: { id: 'q_lost_scroll', stage: 'deliver' } }, { item: { id: 'item_scholars_lost_scroll' } }] },
    priority: SCENE_PRIORITY.decision,
    entry: 'wax',
    nodes: [
      {
        id: 'wax',
        tags: ['written'],
        speaker: 'narrator',
        text: "Nyx's eyes go to the Remnant wax on the scroll.",
        choices: [
          {
            id: 'read',
            text: 'Read it to her.',
            effects: [
              { takeItem: { item: 'item_scholars_lost_scroll' } },
              { rep: { faction: 'weavers', delta: 15 } },
              { rep: { faction: 'remnants', delta: -15 } },
              { grantEcho: 'echo_breach_recoil' },
              { grantEcho: 'echo_litany_verse_8' },
              ...loyaltyFor([], ['ilyra']),
              { questAdvance: { quest: 'q_lost_scroll', stage: 'to_nyx' } },
            ],
            next: 'holding',
          },
          { id: 'not_now', text: 'Not now.', next: 'end' },
        ],
      },
      { id: 'holding', tags: ['story'], speaker: 'npc_nyx', text: 'He is holding it. He has been holding it since I fell.', next: 'end' },
    ],
  },

  // ==== q_echoing_heartbeat ==================================================================================================

  // STORY §13; legacy `handle_heartstone`. DESIGN §11.2, §10.1 and §13.3 ex. 1 own the numbers: Stabilize Clock +6 days (24
  // watches), Remnants +15; Exploit Clock −5 days, Weavers +15, Remnants −15; Destroy Clock −10 days (floored), Ironclad +20,
  // Remnants −25, Weavers −10, +20 max HP (legacy). The three Echoes are exclusive per loop; holding all three, across loops,
  // is the Three Beats. DESIGN §12.5: Ilyra values Stabilize, Nyx Exploit, Brak Destroy.
  {
    id: 'scene_heartstone_choice',
    title: 'Soothe, seize, or shatter',
    entry: 'pulse',
    nodes: [
      {
        id: 'pulse',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'The relic throbs with unstable power. You sense three paths: soothe it, seize it, or shatter it.',
        choices: [
          {
            id: 'stabilize',
            text: 'Stabilize the Heartstone and align it with the ley lines.',
            effects: [
              { setFlag: 'flag_heartstone_stabilized' },
              { heartstone: 'stabilized' }, // U34e (D-105): world.heartstone, which the engine reads
              { clockWatches: 24 },
              { rep: { faction: 'remnants', delta: 15 } },
              { grantEcho: 'echo_heartstone_resonance' },
              { giveItem: { item: 'item_stabilized_heartstone' } },
              { giveItem: { item: 'item_heartstone_fragment_stable', count: 2 } },
              ...loyaltyFor(['ilyra'], ['nyx', 'brak']),
              { onlyIf: THREE_BEATS },
              { questAdvance: { quest: 'q_echoing_heartbeat', stage: 'done_stabilize' } },
            ],
            next: 'calms',
          },
          {
            id: 'exploit',
            text: 'Exploit its power and claim it for yourself.',
            effects: [
              { setFlag: 'flag_heartstone_exploited' },
              { heartstone: 'exploited' }, // U34e (D-105): world.heartstone, which the engine reads
              { clockWatches: -20 },
              { rep: { faction: 'weavers', delta: 15 } },
              { rep: { faction: 'remnants', delta: -15 } },
              { grantEcho: 'echo_heartstone_hunger' },
              { giveItem: { item: 'item_heartstone_core' } },
              ...loyaltyFor(['nyx'], ['ilyra', 'brak']),
              { onlyIf: THREE_BEATS },
              { questAdvance: { quest: 'q_echoing_heartbeat', stage: 'done_exploit' } },
            ],
            next: 'wrench',
          },
          {
            id: 'destroy',
            text: 'Destroy it, ending its pulse forever.',
            // DESIGN §13.3 ex. 1, in its order, then the legacy +20 max HP and full heal
            effects: [
              { setFlag: 'flag_heartstone_destroyed' },
              { heartstone: 'destroyed' }, // U34e (D-105): world.heartstone, which the engine reads
              { clockWatches: -40 },
              { rep: { faction: 'ironclad', delta: 20 } },
              { rep: { faction: 'remnants', delta: -25 } },
              { rep: { faction: 'weavers', delta: -10 } },
              { grantEcho: 'echo_heartstone_silence' },
              { giveItem: { item: 'item_heartstone_fragment_dead', count: 2 } },
              { setFlag: 'flag_ley_cost_up' },
              { setFlag: 'flag_breach_born_weakened' },
              { statBonus: { stat: 'hpMax', delta: 20 } },
              { heal: { hp: 'full' } },
              ...loyaltyFor(['brak'], ['ilyra', 'nyx']),
              { onlyIf: THREE_BEATS },
              { questAdvance: { quest: 'q_echoing_heartbeat', stage: 'done_destroy' } },
            ],
            next: 'cracks',
          },
          // legacy "(or press Enter to wait)": nothing happens; the prompt returns on the next entry
          { id: 'wait', text: 'Wait.', next: 'waiting' },
        ],
      },
      { id: 'calms', tags: ['legacy'], speaker: 'narrator', text: 'The chamber calms, and the Heartstone settles into a steady rhythm.', next: 'fragment' },
      { id: 'fragment', tags: ['legacy'], speaker: 'narrator', text: 'You carry a harmonic fragment of its power.', next: 'leans' },
      {
        id: 'leans',
        tags: ['story'],
        speaker: 'narrator',
        text: 'Far to the east, something that has been bracing for five hundred years leans, very slightly, on you. The thirtieth dawn moves six days off.',
        next: 'end',
      },
      { id: 'wrench', tags: ['legacy'], speaker: 'narrator', text: 'You wrench the Heartstone free. The world shudders, and power floods your veins.', next: 'teeth' },
      { id: 'teeth', tags: ['story'], speaker: 'narrator', text: 'Each pulse hurts. Five days fall off the count like teeth.', next: 'end' },
      { id: 'cracks', tags: ['legacy'], speaker: 'narrator', text: 'The Heartstone cracks. Silence follows, and your body hardens against the loss.', next: 'dark' },
      {
        id: 'dark',
        tags: ['story'],
        speaker: 'narrator',
        text: 'The Depths go dark. Ten dawns are gone. Every Breach-born thing in Aethelgard is a quarter less than it was. So is the thing holding the door.',
        next: 'end',
      },
      { id: 'waiting', tags: ['legacy'], speaker: 'narrator', text: 'The Heartstone continues its slow, waiting beat.', next: 'end' },
    ],
    // STORY §13: what the companion in the party says (a companion may not voice a node until U56 registers them, D-088)
    companionReactions: [
      { companionId: 'ilyra', when: { flag: 'flag_heartstone_stabilized' }, text: 'Ilyra: "It\'s keeping time with something. Can you hear it? It\'s keeping time."' },
      // U54 (STORY §7.1 refusals): she will not help exploit the Heartstone, and leaves the party for the loop (`onEnd` below; written)
      { companionId: 'ilyra', when: { flag: 'flag_heartstone_exploited' }, text: 'Ilyra: "No. Not with my hands near it. Find me when it is quiet again, Wayfinder; it will not be this loop."' },
      { companionId: 'nyx', when: { flag: 'flag_heartstone_exploited' }, text: 'Nyx: "Good. Now it has to hold without its anchor. Now we\'ll see what it is."' },
      { companionId: 'brak', when: { flag: 'flag_heartstone_destroyed' }, text: 'Brak: "That\'s the kind of quiet I don\'t trust."' },
    ],
    // U54: an Exploit sends Ilyra from the party for the loop (her recruitment scene will not have her back in it)
    onEnd: [{ onlyIf: { when: { all: [{ flag: 'flag_heartstone_exploited' }, { companion: { id: 'ilyra', state: 'recruited' } }] }, effects: [{ dismiss: 'ilyra' }] } }],
  },
  {
    id: 'scene_brak_twenty_dawns',
    npcId: 'npc_brak',
    when: dawnCount('scene_borin_twenty_dawns'),
    priority: SCENE_PRIORITY.payoff,
    repeatable: false,
    entry: 'count',
    nodes: [{ id: 'count', tags: ['story'], speaker: 'npc_brak', text: TWENTY_DAWNS, next: 'end' }],
  },
  {
    id: 'scene_borin_twenty_dawns',
    npcId: 'npc_borin_stonefist',
    when: dawnCount('scene_brak_twenty_dawns'),
    priority: SCENE_PRIORITY.payoff,
    repeatable: false,
    entry: 'count',
    nodes: [{ id: 'count', tags: ['story'], speaker: 'npc_borin_stonefist', text: TWENTY_DAWNS, next: 'end' }],
  },
] satisfies DialogueSceneInput[];
