// The four faction chain quests (STORY §11.2 `q_keepers_ledger`, `q_day_of_teeth`, `q_hollow_choir`, `q_unlidded_eye`; DESIGN
// §6.2 tier XP "faction chain 150/250/400", §11.3 the chain deltas, §11.5 the cross-faction costs, §10.1 the Day of Teeth's
// clock, §13.3 ex. 4; BIBLE §3 the givers). Their scenes are ../dialogues/factions.ts; the conventions both follow are in
// ./index.ts and ../dialogues/index.ts (U52's pattern, D-105).
//
// Text: `name` and the first stage's journal are STORY's (tag `story`); the later journals are written (tag `written`, listed
// in the U53 reply); `description` is the giver's ask in one sentence. Every one of the four is Loop 2+ (D-067.17) and
// behind its faction standing: DESIGN §11.4 "chain quests 2–3" at Trusted (`q_hollow_choir`, Weavers 2, is STORY's
// exception: Weavers ≥ −9, the Sanctum door's own bar).
//
// What each completion pays is `rewards`: the tier XP (chain 2 = 250, chain 3 = 400), the item every outcome earns, the
// Echo every outcome grants, and DESIGN §11.5's cross-faction costs (−5 for a chain's second quest, −8 for its third, to
// each of the two other factions). What only one outcome pays — DESIGN §11.3's chain delta per choice, the flag, the Echo,
// the clock — rides on the choice in ../dialogues/factions.ts, ending with the `questAdvance` that enters the outcome stage.
//
// Readings (listed in the U53 reply):
//   - q_keepers_ledger: the Ledger is read in the offer scene itself, right after the Keeper's ask is taken (`echo_seven_
//     wayfinders` on that node; with `echo_thirtieth_dawn` held he reads the pattern aloud, D-067.11, and the engine counts
//     the pair as a source of `echo_tyrant_jailer`, echoes.ts). Pell Ashcombe's Day-Count lies in the Cistern of Names while
//     the quest is active (WORLD §9's placement; the Reach's locations.ts carries it). The Keeper keeps the case either way.
//   - q_day_of_teeth: the Telling is the offer scene; stage 1 then waits for the Nexus. The Horde-echo is three table
//     encounters (`encounters` below), one Husk each, chained by `onVictory` so the waves follow without a step between
//     them; the stage that fights them starts the first (a quest's `onEnter` may start a fight: the sweep is the first
//     post-step hook and never runs mid-fight, reducers/quests.ts). Blackreed's Axe is put in the hand when the last wave
//     falls (`recover_axe`'s onEnter) and Hadda hands it back: the quest's reward is the axe already carried (WORLD §8).
//   - q_hollow_choir: the offering and the Choir's eighth verse are one scene (stage `offered` is passed through in it).
//     The verse offering is open to any `echo_litany_verse_*` held and takes nothing (STORY: "it is not lost").
//   - q_unlidded_eye: the Nexus Aberration is a first-visit fight (WORLD §3.5), so a loop that already killed it would have
//     no Eye to take: accepting the quest then places a second one at the Nexus (`spawn`, the `onlyIf`). The Eye is the
//     Aberration's quest drop (the Nexus unit's creatures.ts, WORLD §7.10). Sethe keeps the Aberrant Eye either way and
//     the Unlidded Eye is every completion's reward. `echo_void_resonance` is her payoff scene (DESIGN §13.3 ex. 4).
import type { EncounterInput } from '@schema/encounter';
import type { QuestInput } from '@schema/quest';
import { FROM_LOOP_2 } from '../dialogues/common';

export const quests = [
  // ---- The Keeper's Ledger — Remnants 3 (STORY §11.2; giver Keeper Ansel Dray, Shattered Library reading-room) --------------
  {
    id: 'q_keepers_ledger',
    name: "The Keeper's Ledger",
    description: "Keeper Dray asks you to hear the Ledger read and to fetch Pell Ashcombe's day-count.",
    category: 'faction',
    botHint: 'explorer',
    giverNpcId: 'npc_ansel_dray',
    factionId: 'remnants',
    availableWhen: { all: [FROM_LOOP_2, { rep: { faction: 'remnants', min: 20 } }] },
    stages: [
      {
        // scene_dray_keepers_ledger_offer reads the Ledger and moves on
        id: 'hear_ledger',
        tags: ['story'],
        journal: 'Keeper Dray keeps the Ledger of Wayfinders. He wants the eighth entry written before it is needed.',
        next: 'recover_day_count',
      },
      {
        id: 'recover_day_count',
        tags: ['written'],
        journal: "Recover Pell Ashcombe's day-count from the Cistern of Names, under the Drowned Reach.",
        objectives: [{ id: 'obj_day_count', text: "Recover Pell Ashcombe's Day-Count", when: { item: { id: 'item_pells_day_count' } }, hintLocationId: 'loc_cistern_of_names' }],
        next: 'choose_copy',
      },
      {
        id: 'choose_copy',
        tags: ['written'],
        journal: 'Bring the day-count to Keeper Dray and choose what the Remnants may copy.',
        // scene_dray_keepers_ledger_copy decides: the whole Litany → whole, verse one → verse_one
        next: 'whole',
      },
      { id: 'whole', tags: ['written'], journal: 'The Remnants hold the whole Litany you carry.', outcome: 'complete' },
      { id: 'verse_one', tags: ['written'], journal: 'The Remnants copy verse one and no more.', outcome: 'complete' },
    ],
    // DESIGN §6.2 chain 3: 400 XP; STORY: the Keeper's Copy; DESIGN §11.5: −8 to the other two
    rewards: {
      xp: 400,
      items: [{ itemId: 'item_keepers_copy' }],
      rep: [
        { faction: 'weavers', delta: -8 },
        { faction: 'ironclad', delta: -8 },
      ],
    },
  },

  // ---- The Day of Teeth — Ironclad 3 (STORY §11.2; giver Hadda Ironvow, Hearthring) ------------------------------------------
  {
    id: 'q_day_of_teeth',
    name: 'The Day of Teeth',
    description: "Hadda Ironvow asks you to bring Corwen Blackreed's axe back from the Nexus.",
    category: 'faction',
    botHint: 'melee',
    giverNpcId: 'npc_hadda_ironvow',
    factionId: 'ironclad',
    availableWhen: { all: [FROM_LOOP_2, { rep: { faction: 'ironclad', min: 20 } }] },
    stages: [
      {
        // the Telling is scene_hadda_day_of_teeth_offer; the stage waits for the Nexus
        id: 'hear_telling',
        tags: ['story'],
        journal: "Hadda wants Corwen Blackreed's axe back from the Nexus, where twenty held a horde for a day.",
        objectives: [{ id: 'obj_nexus', text: 'Reach the Chronos Nexus', when: { location: 'loc_chronos_nexus' }, hintLocationId: 'loc_chronos_nexus' }],
        next: 'horde_echo',
      },
      {
        // three waves of one Husk, chained by their onVictory (encounters below)
        id: 'horde_echo',
        tags: ['written'],
        journal: 'Fight through the Horde-echo of Year 178: three waves of the Unravelled.',
        onEnter: [{ startCombat: 'enc_day_of_teeth_wave_1' }],
        objectives: [{ id: 'obj_waves', text: 'Fight through the three waves', when: { killed: { id: 'cr_horde_husk', count: 3, sinceStage: true } }, hintLocationId: 'loc_chronos_nexus' }],
        next: 'recover_axe',
      },
      {
        id: 'recover_axe',
        tags: ['written'],
        journal: "Blackreed's axe lies where the day left it. Take it up.",
        onEnter: [{ giveItem: { item: 'item_blackreeds_axe' } }],
        objectives: [{ id: 'obj_axe', text: "Recover Blackreed's Axe", when: { item: { id: 'item_blackreeds_axe' } }, hintLocationId: 'loc_chronos_nexus' }],
        next: 'return',
      },
      {
        id: 'return',
        tags: ['written'],
        journal: 'Take the axe back to Hadda at Hearthring. She will ask what the Tyrant is.',
        // scene_hadda_day_of_teeth_return decides: the truth → told_truth, a monster → told_monster
        next: 'told_truth',
      },
      { id: 'told_truth', tags: ['written'], journal: 'You told Hadda the truth. She will keep the Nomads from the Apex.', outcome: 'complete' },
      { id: 'told_monster', tags: ['written'], journal: 'You told Hadda it is a monster. Her scouts ride east tonight.', outcome: 'complete' },
    ],
    // DESIGN §6.2 chain 3: 400 XP; the axe is carried already (recover_axe); DESIGN §11.5: −8 to the other two
    rewards: {
      xp: 400,
      rep: [
        { faction: 'remnants', delta: -8 },
        { faction: 'weavers', delta: -8 },
      ],
    },
  },

  // ---- The Hollow Choir — Weavers 2 (STORY §11.2; giver Sethe the Unlidded, Sanctum of Threads) ----------------------------
  {
    id: 'q_hollow_choir',
    name: 'The Hollow Choir',
    description: 'Sethe the Unlidded will let you hear the Choir for one thing torn from a moment.',
    category: 'faction',
    botHint: 'explorer',
    giverNpcId: 'npc_sethe_unlidded',
    factionId: 'weavers',
    // STORY: Weavers ≥ −9 (the Sanctum door's bar), Loop 2+
    availableWhen: { all: [FROM_LOOP_2, { rep: { faction: 'weavers', min: -9 } }] },
    stages: [
      {
        // scene_sethe_hollow_choir_rite takes the offering
        id: 'torn_thing',
        tags: ['story'],
        journal: 'Sethe will let you hear the Choir if you bring one thing torn from a moment. A Shard, or a memory.',
        next: 'offered',
      },
      {
        // the same scene sings the eighth verse and asks
        id: 'offered',
        tags: ['written'],
        journal: 'The Choir takes up the thread. Hear the eighth verse.',
        next: 'corrected',
      },
      { id: 'corrected', tags: ['written'], journal: 'You corrected the Choir. Sethe suspects Nyx.', outcome: 'complete' },
      { id: 'silent', tags: ['written'], journal: 'You let the Choir sing the eighth verse wrong.', outcome: 'complete' },
    ],
    // DESIGN §6.2 chain 2: 250 XP; STORY: the Choir Mask and the hand-sign either way; DESIGN §11.5: −5 to the other two
    rewards: {
      xp: 250,
      items: [{ itemId: 'item_choir_mask' }],
      rep: [
        { faction: 'remnants', delta: -5 },
        { faction: 'ironclad', delta: -5 },
      ],
      echoes: ['echo_weaver_sign'],
    },
  },

  // ---- The Unlidded Eye — Weavers 3 (STORY §11.2; giver Sethe after q_hollow_choir) ------------------------------------------
  {
    id: 'q_unlidded_eye',
    name: 'The Unlidded Eye',
    description: 'Sethe asks for the eye of a thing that looks between moments.',
    category: 'faction',
    botHint: 'melee',
    giverNpcId: 'npc_sethe_unlidded',
    factionId: 'weavers',
    availableWhen: { all: [{ quest: { id: 'q_hollow_choir', status: 'completed' } }, { rep: { faction: 'weavers', min: 20 } }] },
    stages: [
      {
        id: 'lens',
        tags: ['story'],
        journal: 'Sethe wants to see what Nyx has seen. Bring the lens of a thing that looks between moments.',
        // the Nexus Aberration is a first-visit fight: a loop that already killed it gets a second one to hunt
        onEnter: [{ onlyIf: { when: { killed: { id: 'cr_temporal_aberration' } }, effects: [{ spawn: { creature: 'cr_temporal_aberration', location: 'loc_chronos_nexus' } }] } }],
        objectives: [{ id: 'obj_aberration', text: 'Kill a Temporal Aberration at the Nexus', when: { killed: { id: 'cr_temporal_aberration', count: 1, sinceStage: true } }, hintLocationId: 'loc_chronos_nexus' }],
        next: 'take_eye',
      },
      {
        // the Eye is the Aberration's quest drop while the quest is active (WORLD §7.10)
        id: 'take_eye',
        tags: ['written'],
        journal: 'Take the Aberrant Eye while it is still looking.',
        objectives: [{ id: 'obj_eye', text: 'Take an Aberrant Eye', when: { item: { id: 'item_aberrant_eye' } }, hintLocationId: 'loc_chronos_nexus' }],
        next: 'return',
      },
      {
        id: 'return',
        tags: ['written'],
        journal: 'Bring the Eye to Sethe at the Sanctum of Threads. Decide whether Nyx should hear of it first.',
        // scene_sethe_unlidded_eye_return decides: warn Nyx → warned, let Sethe look → looked
        next: 'warned',
      },
      { id: 'warned', tags: ['written'], journal: 'You warned Nyx. She left the Sanctum for a day.', outcome: 'complete' },
      { id: 'looked', tags: ['written'], journal: 'Sethe looked through the Eye at Nyx and saw the seam.', outcome: 'complete' },
    ],
    // DESIGN §6.2 chain 3: 400 XP; STORY: the Unlidded Eye; DESIGN §11.5: −8 to the other two
    rewards: {
      xp: 400,
      items: [{ itemId: 'item_unlidded_eye' }],
      rep: [
        { faction: 'remnants', delta: -8 },
        { faction: 'ironclad', delta: -8 },
      ],
    },
  },
] satisfies QuestInput[];

/** The Horde-echo's intro lines (written; listed in the U53 reply). */
export const WAVE_INTROS = [
  'The hold slips, the way it slipped in Year 178. Something with no next moment comes out of the broken hour.',
  'Another comes out of the day, flickering.',
  "The last of the day's teeth. Behind it, on the floor, iron.",
] as const;

/**
 * q_day_of_teeth's three waves (STORY §11.2 "three waves of Unravelled: cr_horde_husk"): one Husk each, a story gate that
 * holds (R10-1, the Peaks' Brute form), each wave's `onVictory` starting the next so no step passes between them; the stage
 * `horde_echo` starts the first. Table encounters are global ids (PLAN §5.19 rule 6), started by `startCombat` wherever the
 * Wayfinder stands — here, the Nexus (the stage is entered on arriving there).
 */
export const encounters = [
  {
    id: 'enc_day_of_teeth_wave_1',
    groups: [{ creatureId: 'cr_horde_husk' }],
    fleeable: false,
    onFlee: 'hold',
    intro: WAVE_INTROS[0],
    onVictory: [{ startCombat: 'enc_day_of_teeth_wave_2' }],
  },
  {
    id: 'enc_day_of_teeth_wave_2',
    groups: [{ creatureId: 'cr_horde_husk' }],
    fleeable: false,
    onFlee: 'hold',
    intro: WAVE_INTROS[1],
    onVictory: [{ startCombat: 'enc_day_of_teeth_wave_3' }],
  },
  {
    id: 'enc_day_of_teeth_wave_3',
    groups: [{ creatureId: 'cr_horde_husk' }],
    fleeable: false,
    onFlee: 'hold',
    intro: WAVE_INTROS[2],
  },
] satisfies EncounterInput[];
