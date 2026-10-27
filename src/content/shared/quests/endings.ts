// The six ending quests (STORY §11.1's table, §11.6 the blocks: `q_wardens_vigil` (A), `q_the_mending` (B), `q_weavers_dawn`
// (C), `q_iron_silence` (D), `q_long_archive` (E), `q_unbound` (F); §10 the endings' requirements and final sequences; DESIGN
// §6.2 "ending quests 600", §4.11 the Resolution, §11 the endings' conditions, §13.3 ex. 11–12). Their scenes are
// ../dialogues/endings.ts; the conventions both follow are ./index.ts and ../dialogues/index.ts (U52's pattern, D-105, D-109,
// D-112–D-115, D-122). The endings' records (requirements, slides) are ../endings.ts (U51); the slides' final text is U62's.
//
// Text: `name` and the first stage's journal are STORY's (tag `story`); the later journals are written (tag `written`, listed in
// the U58 reply); `description` is the giver's ask in one sentence. Every one of the six is Loop 2+; each `availableWhen` /
// `startWhen` is STORY §11.6's prerequisite.
//
// How each ends (the `{ ending }` effect sits on the last choice, after the quest's own `questAdvance` — the ending closes the
// loop in the same step, so the outcome stage is in the record; a Tyrant ending reached without its quest taken still enters
// the quest at its outcome stage: the Resolution is that quest's last stage however you came, a ruling listed in the reply):
//   - A, B, F end in the Tyrant's communion (glowlands_nexus/creatures.ts, the Unveiled Tyrant): the Resolution's outcomes
//     `take_its_place`, `consent_mending`, `pass_beyond` carry the ending (D-081: canon), and the Resolution's words — STORY §13's
//     `scene_ending_vigil`, `_mending`, `_unbound`, opened by `onSpared` — carry the same ending on their own last choice, or
//     go back to the outcomes. `q_unbound` starts from the tear's offer itself (the sweep never runs inside a fight).
//   - C (`scene_ending_dawn`, the Apex's `ev_apex_dawn` arrival): Nyx is given the Core and the hold fails — two waves of Horde
//     Husks (×2, then ×3; glowlands_nexus/creatures.ts' note) started by the choice, the second wave's `onVictory` the ending.
//   - D (`scene_ending_silence`): opened from the Tyrant's data when the quest stands at the Apex with Brak beside you and the
//     anchor in the pack — Phase 2's entry (the fight branch) or the anchor's Offer in communion (the talk branch; STORY's
//     "talk it to Movement II" has no data hook of its own: listed in the reply); "Now." is the ending.
//   - E (`scene_ending_archive`): Ilyra at the Depths (her `schedule`, silverwood_ruins/npcs.ts) once the last dawn is here;
//     *Keep the vigil* is her scene at the Depths while the dawns remain (`scene_ilyra_keep_the_vigil`: the days pass in the
//     scene, D-067.14 — the Depths has no camp for the engine's own action), or the player waits it out.
// `echo_litany_complete` (all nine verses) and `echo_anchor_schema` (both halves) had no grant mechanism (D-100): the offers
// that read them derive them when the parts are held (../dialogues/endings.ts `DERIVE_LITANY`, `DERIVE_SCHEMA`; listed).
import type { EncounterInput } from '@schema/encounter';
import type { QuestInput } from '@schema/quest';
import { FROM_LOOP_2 } from '../dialogues/common';

const AT_APEX = { location: 'loc_temporal_breach_apex' } as const;

export const quests = [
  // ---- The Warden's Vigil — A (STORY §11.6; giver Dask, `echo_litany_complete`) ---------------------------------------------
  {
    id: 'q_wardens_vigil',
    name: "The Warden's Vigil",
    description: 'Dask says someone who knows all nine verses could take the Tyrant\'s place. Go to the Apex and see if it is you.',
    category: 'ending',
    botHint: 'pacifist',
    giverNpcId: 'npc_dask',
    availableWhen: { all: [FROM_LOOP_2, { echo: 'echo_litany_complete' }] },
    stages: [
      {
        id: 'go_and_see',
        tags: ['story'],
        journal: "You know all nine verses. Dask says someone who knows them could take his place. Go and see if it's you.",
        objectives: [{ id: 'obj_apex', text: 'Reach the Temporal Breach Apex', when: AT_APEX, hintLocationId: 'loc_temporal_breach_apex' }],
        next: 'communion',
      },
      {
        id: 'communion',
        tags: ['written'],
        journal: 'Carry the communion to the end of the Nine Speak with the words whole and Resolve of six or more. Then, if you are sure, step in.',
        // scene_ending_vigil (the Resolution's words), or the Resolution's `take_its_place` → stepped_in
        next: 'stepped_in',
      },
      { id: 'stepped_in', tags: ['written'], journal: 'You said the ninth verse, and you hold. It is heavier than it looks. It is lighter than it was.', outcome: 'complete' },
    ],
    // DESIGN §6.2 ending quests 600; STORY: `ending_wardens_vigil` (the ending is the reward)
    rewards: { xp: 600 },
  },

  // ---- The Mending — B (STORY §11.6; givers Borin and Caelum; the Before first, then the forge, then the Apex, D-067.8) ---------
  {
    id: 'q_the_mending',
    name: 'The Mending',
    description: "Close the Breach from both ends: Hallow's cradle-pin on the rim in the Before, and a Breach-anchor from Borin's fire for the Apex.",
    category: 'ending',
    botHint: 'pacifist',
    giverNpcId: 'npc_caelum',
    companionId: 'caelum',
    availableWhen: {
      all: [
        FROM_LOOP_2,
        { echo: 'echo_anchor_mechanic' },
        { echo: 'echo_heartstone_resonance' },
        { echo: 'echo_void_resonance' },
        { echo: 'echo_litany_complete' },
        { echo: 'echo_anchor_schema' },
      ],
    },
    stages: [
      {
        id: 'both_ends',
        tags: ['story'],
        journal: "Both ends. A pin for the cradle in the Before; an anchor for the Apex from Borin's fire.",
        objectives: [
          { id: 'obj_pin', text: "Carry Hallow's Cradle-Pin (Caelum's, from the Garret)", when: { item: { id: 'item_caelums_anchor_token' } }, hintLocationId: 'loc_apprentices_garret' },
          // U62b (STORY §7.6 B, §12 `echo_caelum_stayed`): after a loop in which he stayed, the pin may go down without him
          {
            id: 'obj_conflux',
            text: 'Go down to the Conflux Chamber with Caelum',
            when: { all: [{ location: 'loc_conflux_chamber' }, { any: [{ companion: { id: 'caelum', state: 'active' } }, { echo: 'echo_caelum_stayed' }] }] },
            hintLocationId: 'loc_conflux_chamber',
          },
        ],
        next: 'anchor_the_conflux',
      },
      {
        // the engine's Anchor: the pin set down on the cradle's rim (before.ts) sets the flag
        id: 'anchor_the_conflux',
        tags: ['written'],
        journal: "Set Hallow's Cradle-Pin down on the cradle's rim, with Caelum beside you. What is set down there is set down in every instant at once.",
        objectives: [{ id: 'obj_rim', text: "Set the Cradle-Pin on the cradle's rim", when: { flag: 'flag_cradle_pin_anchored' }, hintLocationId: 'loc_conflux_chamber' }],
        next: 'crossing',
      },
      {
        id: 'crossing',
        tags: ['written'],
        journal: 'The pin is on the rim, and Caelum has something to say about it. Then let him cross if he will, and go home by the door: the pin will be lying in the Depths.',
        // scene_anchor_in_the_conflux (ev_conflux_pin): Breach Clock +3 days → forge
        next: 'forge',
      },
      {
        id: 'forge',
        tags: ['written'],
        journal: "Forge the Breach-anchor at the Emberforge: Aetherium Shards, a Heartstone fragment, Void Shards, ember ore and heartwood. Borin's fire knows iron that does not wish.",
        objectives: [{ id: 'obj_anchor', text: 'Forge the Breach-anchor', when: { item: { id: 'item_breach_anchor' } }, hintLocationId: 'loc_emberforge' }],
        next: 'apex',
      },
      {
        id: 'apex',
        tags: ['written'],
        journal: 'Both ends are ready. To the Apex: the communion to Resolve eight, with Dask or Caelum in Support if you have them; then his consent, and the anchor driven in.',
        // scene_ending_mending, or the Resolution's `consent_mending` → mended
        next: 'mended',
      },
      { id: 'mended', tags: ['written'], journal: 'Hour, go. The Breach is closed from both ends, and for the first time there is a thirty-first day.', outcome: 'complete' },
    ],
    // DESIGN §6.2 ending quests 600; STORY: `ending_mending`
    rewards: { xp: 600 },
  },

  // ---- The Weaver's Dawn — C (STORY §11.6; giver Nyx; Weavers Sworn, the Core, Nyx Loyal and agreed, the Tyrant alive) --------
  {
    id: 'q_weavers_dawn',
    name: "The Weaver's Dawn",
    description: 'Nyx is ready to look at his face. Take the Heartstone Core to the Apex with her and tear the hold open.',
    category: 'ending',
    botHint: 'melee',
    giverNpcId: 'npc_nyx',
    factionId: 'weavers',
    companionId: 'nyx',
    availableWhen: {
      all: [
        FROM_LOOP_2,
        { rep: { faction: 'weavers', min: 60 } },
        { flag: 'flag_heartstone_exploited' },
        { item: { id: 'item_heartstone_core' } },
        { loyalty: { companion: 'nyx', min: 50 } },
        { quest: { id: 'q_what_she_would_undo', stage: 'agreed' } },
        { not: { flag: 'flag_tyrant_dead' } },
      ],
    },
    // D-067.13: the door to the past exists only while he holds it
    failWhen: { flag: 'flag_tyrant_dead' },
    stages: [
      {
        id: 'his_face',
        tags: ['story'],
        journal: 'Nyx is ready to look at his face. Take the Core to the Apex, and do not be quick.',
        objectives: [
          { id: 'obj_core', text: 'Carry the Heartstone Core', when: { item: { id: 'item_heartstone_core' } }, hintLocationId: 'loc_heartstone_depths' },
          { id: 'obj_nyx', text: 'Nyx beside you', when: { companion: { id: 'nyx', state: 'active' } }, hintLocationId: 'loc_chasm_of_whispers' },
        ],
        next: 'apex',
      },
      {
        id: 'apex',
        tags: ['written'],
        journal: 'To the Apex with the Core and Nyx beside you. The hold will fail as she works; hold the floor while it does.',
        // ev_apex_dawn → scene_ending_dawn: the Core given, two waves, the ending
        next: 'dawn',
      },
      { id: 'dawn', tags: ['written'], journal: 'She went back to stop them, and it failed as it fails, and the circle closed with one more in it.', outcome: 'complete' },
    ],
    // DESIGN §6.2 ending quests 600; STORY: `ending_weavers_dawn`
    rewards: { xp: 600 },
  },

  // ---- The Iron Silence — D (STORY §11.6; giver Hadda Ironvow; Ironclad Sworn, the Heartstone destroyed, the iron, the design) --
  {
    id: 'q_iron_silence',
    name: 'The Iron Silence',
    description: 'Hadda Ironvow wants the ley line cut under the Apex, and Borin can forge the iron that cuts it.',
    category: 'ending',
    botHint: 'melee',
    giverNpcId: 'npc_hadda_ironvow',
    factionId: 'ironclad',
    availableWhen: {
      all: [FROM_LOOP_2, { rep: { faction: 'ironclad', min: 60 } }, { flag: 'flag_heartstone_destroyed' }, { echo: 'echo_iron_that_does_not_wish' }, { echo: 'echo_anchor_schema' }],
    },
    stages: [
      {
        id: 'cut_the_line',
        tags: ['story'],
        journal: 'Hadda wants the line cut under the Apex. Borin can forge the thing that cuts it.',
        objectives: [{ id: 'obj_anchor', text: 'Forge the Breach-anchor at the Emberforge (a dead fragment will do)', when: { item: { id: 'item_breach_anchor' } }, hintLocationId: 'loc_emberforge' }],
        next: 'apex',
      },
      {
        id: 'apex',
        tags: ['written'],
        journal: 'The iron is forged. Take Brak to the Apex; fight the thing to its fracture or talk it to the Nine, then drive the anchor and let him swing.',
        objectives: [{ id: 'obj_brak', text: 'Brak at your shoulder', when: { companion: { id: 'brak', state: 'active' } }, optional: true, hintLocationId: 'loc_ironclad_camp' }],
        // scene_ending_silence (the Tyrant's Phase 2, or the anchor shown in communion) → silence
        next: 'silence',
      },
      { id: 'silence', tags: ['written'], journal: 'The line is cut. The Breach closed like a mouth with nothing to say, and the world is quiet.', outcome: 'complete' },
    ],
    // DESIGN §6.2 ending quests 600; STORY: `ending_iron_silence`
    rewards: { xp: 600 },
  },

  // ---- The Long Archive — E (STORY §11.6; giver Keeper Dray; Remnants Sworn, stabilized, Corruption < 6 or cleansed, Ilyra the Keeper) --
  {
    id: 'q_long_archive',
    name: 'The Long Archive',
    description: 'Keeper Dray asks you to set the Stabilized Heartstone back in its cradle on the last dawn before the thirtieth, with Ilyra.',
    category: 'ending',
    botHint: 'pacifist',
    giverNpcId: 'npc_ansel_dray',
    factionId: 'remnants',
    availableWhen: {
      all: [
        FROM_LOOP_2,
        { rep: { faction: 'remnants', min: 60 } },
        { flag: 'flag_heartstone_stabilized' },
        { echo: 'echo_heartstone_resonance' },
        { any: [{ not: { corruption: { min: 6 } } }, { flag: 'flag_corruption_cleansed' }] },
        { companion: { id: 'ilyra', state: 'recruited' } },
        { quest: { id: 'q_the_keepers_price', stage: 'keeper' } },
      ],
    },
    stages: [
      {
        id: 'last_dawn',
        tags: ['story'],
        journal: 'Set the Stabilized Heartstone back in its cradle on the last dawn before the thirtieth. Ilyra will do the rest.',
        // D-066.8: the last dawn before collapse, however the limit moved; Ilyra's vigil at the Depths skips there (D-067.14)
        objectives: [
          {
            id: 'obj_dawn',
            text: 'Stand in the Heartstone Depths on the last dawn, Ilyra with you',
            when: { all: [{ location: 'loc_heartstone_depths' }, { clock: { daysLeft: { max: 1 } } }, { companion: { id: 'ilyra', state: 'active' } }] },
            hintLocationId: 'loc_heartstone_depths',
          },
        ],
        next: 'archive',
      },
      {
        id: 'archive',
        tags: ['written'],
        journal: 'The last dawn. Ilyra is here, and the Stabilized Heartstone is in your hands. Let her set it, and choose whether you stay.',
        // scene_ending_archive → remembered
        next: 'remembered',
      },
      { id: 'remembered', tags: ['written'], journal: 'The thirtieth dawn came up and went down and came up again as the first. Nothing unravelled. Ilyra remembers.', outcome: 'complete' },
    ],
    // DESIGN §6.2 ending quests 600; STORY: `ending_long_archive`
    rewards: { xp: 600 },
  },

  // ---- The Unbound — F (STORY §11.6; the Tyrant's own offer, Loop 2+, spared, at the Apex) ---------------------------------------
  {
    id: 'q_unbound',
    name: 'The Unbound',
    description: 'The Tyrant, spared, has opened the tear. Nothing is stopping you from stepping past it, into somewhere that is not Aethelgard.',
    category: 'ending',
    botHint: 'speedrunner',
    // started by the Resolution's own words (scene_ending_unbound) or its `pass_beyond`: the sweep never runs inside a fight
    availableWhen: { all: [FROM_LOOP_2, { flag: 'flag_tyrant_spared' }, AT_APEX] },
    // the offer stands only at the tear: walking away from the Apex declines it
    failWhen: { not: AT_APEX },
    stages: [
      {
        id: 'tear_open',
        tags: ['story'],
        journal: 'The tear is open. Nothing is stopping you.',
        // scene_ending_unbound's step through, or the Resolution's `pass_beyond` → gone
        next: 'gone',
      },
      { id: 'gone', tags: ['written'], journal: 'You stepped past it, into the Breach, toward somewhere that is not Aethelgard. You remember all of it.', outcome: 'complete' },
    ],
    // DESIGN §6.2 ending quests 600; STORY: `ending_unbound`
    rewards: { xp: 600 },
  },
] satisfies QuestInput[];

/** The hold's failing (written; listed in the U58 reply). */
export const DAWN_WAVE_INTROS = [
  'The hold slips under her hands. Two things with no next moment come out of the broken hour, flickering, and look for something to end.',
  'The mass is open to the bone now. Two more come out of the hour she is holding apart, and she does not look up from the work.',
] as const;

/**
 * q_weavers_dawn's two waves (STORY §10.3 step 2 "two waves of the hold's failing (Horde Husks)"): two Husks each — the
 * creatures file's note said ×2 then ×3, which a Loop-2 party (STORY §6.2: C is a two-loop ending) does not survive without a
 * breath between (listed in the reply) — story gates that hold, the first started by the scene's choice, the second by the
 * first's `onVictory`, and the ending by the second's: no step passes between the Core given and the tear (the Day of Teeth's
 * wave form, ./factions.ts).
 */
export const encounters = [
  {
    id: 'enc_weavers_dawn_wave_1',
    groups: [{ creatureId: 'cr_horde_husk', count: 2 }],
    fleeable: false,
    onFlee: 'hold',
    intro: DAWN_WAVE_INTROS[0],
    onVictory: [{ startCombat: 'enc_weavers_dawn_wave_2' }],
  },
  {
    id: 'enc_weavers_dawn_wave_2',
    groups: [{ creatureId: 'cr_horde_husk', count: 2 }],
    fleeable: false,
    onFlee: 'hold',
    intro: DAWN_WAVE_INTROS[1],
    onVictory: [{ questAdvance: { quest: 'q_weavers_dawn', stage: 'dawn' } }, { ending: 'ending_weavers_dawn' }],
  },
] satisfies EncounterInput[];
