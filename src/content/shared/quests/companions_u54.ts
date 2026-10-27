// Ilyra's and Brak's arcs: the six companion quests (STORY §11.4 `q_voices_in_the_stacks`, `q_the_danthe_line`,
// `q_the_keepers_price`, `q_the_scouts_oath`, `q_blood_and_salt`, `q_the_line_he_holds`; §7.1–§7.2 the arcs; DESIGN §6.2 tier
// XP "companion arc 150/250/400", §11.3 the arc deltas, §12.5 loyalty "personal quest stage completed +5", §13.3 ex. 5;
// BIBLE §3.2 the two). Their scenes are ../dialogues/companions_u54.ts; the conventions both follow are in ./index.ts and
// ../dialogues/index.ts (U52's pattern, D-105; U53's, D-109). U54.
//
// Text: `name` and the first stage's journal are STORY's (tag `story`); the later journals are written (tag `written`, listed in
// the U54 reply); `description` is the giver's ask in one sentence. Ilyra's three and Brak's first and third are Loop 2+
// (D-067.17); `q_blood_and_salt` is open in Loop 1. Arc stage 2 needs loyalty 25, stage 3 loyalty 50 (DESIGN §12.5; the
// `availableWhen`s), and loyalty implies recruitment (a `loyalty` condition is false for a companion not in the roster).
//
// Loyalty (DESIGN §12.5 "personal quest stage completed +5"): every stage that is not an outcome pays `stageDone()` on its
// `onExit`, so a stage passed by its objective and one passed by a scene's `questAdvance` pay the same way — except
// `q_the_line_he_holds`'s decision, whose three choices carry DESIGN §13.3 ex. 5's effects verbatim (the +5 among them). The
// loyalty a scene's choice earns beyond that (DESIGN §12.5 "aligned +3": the Litany read aloud, the salt carried, the truth
// told) rides on the choice (../dialogues/companions_u54.ts, `loyaltyFor`).
//
// What each completion pays is `rewards`: the tier XP (arc 1 = 150, arc 2 = 250, arc 3 = 400) and the rep, items and Echoes
// every outcome earns. What only one outcome pays — the ring, Remnants ±, the whetstone, Ironclad +10, the Keeper's Echo,
// `flag_brak_kept_away`, `echo_brak_lives` — rides on the choice, ending with the `questAdvance` that enters the outcome stage.
//
// Readings (listed in the U54 reply):
//   - q_voices_in_the_stacks: "past the second watch" is the Library at night (`{ watch: 'night' }`: dawn, day, dusk, night);
//     the Library's rest needs Ilyra Trusted (regions/silverwood_ruins), so the stage is waited through (`wait` is legal
//     there). The whispers resolving into verse I grants `echo_litany_verse_1` (idempotent in a loop that holds it).
//   - q_the_danthe_line: "after `q_bell_vault`" is STORY's own Prereq line, `echo_archive_door` or the Bell-Vault Key (both
//     are that quest's); U57's quest id is not read, so nothing dangles. The Door of Pages (the Sunken Scriptorium) grants
//     `echo_oriel_lineage` on entry (regions/drowned_reach `ev_scriptorium_hand`); the carrel stage confirms it. Ilyra must
//     stand in the party at the Door and at the carrel (`{ companion: { id: 'ilyra' } }`): the First Drowned speaks to her
//     hands. The Archives' `enter` event `ev_archives_first_drowned` opens `scene_the_first_drowned` (regions/silverwood_ruins).
//   - q_the_keepers_price: the ask, the telling and the choice are one conversation at Dray's table (the stages `telling` and
//     `choose` are passed through in it, as U53's `offered`); the telling grants `echo_ilyra_cost` (STORY §12 "or Keeper
//     Dray"). "Never again" is read through the stage (`{ quest: { id, stage: 'unbound_hand' } }`): the deliberate tear
//     (`scene_ilyra_portal_tear`) is closed for the loop.
//   - q_the_scouts_oath: "two Steppe ambushes" are two `spawn`s placed on accepting — a Salt Jackal beyond the Scorched Gate,
//     a Steppe Harrier on the Ash-Wind Flats — met in order on the ride east (a spawned group is fought on arrival before
//     the node's own roll). Accepting recruits Brak if he is not in the roster (STORY: "ride with him"); the Ring's scene needs
//     him in the party. The caravan (WORLD §12.1 `ws_caravan`: `flag_hearthring_caravan`, "the dawn after" both quests) is
//     set on completion. `echo_ironclad_oath` is the engine's at a loop's end (echoes.ts); the Ring's scene reads it.
//   - q_blood_and_salt: the salt is `mat_steppe_salt` (WORLD §9 "Respite salt", 4 g at Kaelen's; the Salt Pan's gathering is
//     "earned"). With `echo_brak_birth_name` the quest opens at `kaelen` however it starts (the `shortcuts` entry: DESIGN
//     §11.6 "starts at stage 2"); Kaelen then gives the salt if none is carried. `scene_braks_brother` decides A or B; Brak's
//     report at the Camp ends it. Named (STORY §7.2) has no engine form: it is read through the stage `spoke`.
//   - q_the_line_he_holds: told, proved and chosen in one conversation (the stages `proof` and `choose` are passed through).
//     STORY's "fails if Brak dies (`flag_brak_dead`)" has no engine flag: a Tyrant killed while the quest still runs
//     (`flag_tyrant_dead`) is his death at the Apex (horde.ts `brakComesToApex`: both legacy quests done, which the
//     quest requires, and neither outcome A nor C yet). Outcome A also sends him from the party (`dismiss`): STORY "stays
//     at the Ring of Wagons; you lose his aid at the Apex". Ironclad is +10 on every outcome (STORY, DESIGN §11.2; §11.3's
//     "+15" for an arc's third quest is the contradiction the reply lists).
import type { Effect } from '@schema/effect';
import type { QuestInput } from '@schema/quest';
import { FROM_LOOP_2 } from '../dialogues/common';

/** DESIGN §12.5 "personal quest stage completed". */
export const LOYALTY_STAGE = 6; // U81b2 (D-113): +6, was +5 (Ilyra's nine stages reached about 46 in one loop, four short of Loyal 50 for ending E)

type CompanionId = 'ilyra' | 'brak';

/** The +5 a companion's arc stage pays when it is passed (on the stage's `onExit`). */
export const stageDone = (companion: CompanionId): Effect[] => [{ loyalty: { companion, delta: LOYALTY_STAGE } }];

/** The Salt Pan's and Kaelen's salt (WORLD §9 "Respite salt"). */
export const SALT = 'mat_steppe_salt';

export const quests = [
  // ---- Voices in the Stacks — Ilyra 1 (STORY §11.4; giver Ilyra, Whispering Ruins; Loop 2+ after q_echo_crystal) ----------
  {
    id: 'q_voices_in_the_stacks',
    name: 'Voices in the Stacks',
    description: 'Ilyra asks you to wait with her in the Shattered Library past the second watch.',
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_ilyra',
    factionId: 'remnants',
    companionId: 'ilyra',
    availableWhen: { all: [FROM_LOOP_2, { quest: { id: 'q_echo_crystal', status: 'completed' } }] },
    stages: [
      {
        id: 'stacks',
        tags: ['story'],
        journal: 'Ilyra hears the Library at night in a voice like her own. Wait with her past the second watch.',
        objectives: [{ id: 'obj_library', text: 'Go to the Shattered Library', when: { location: 'loc_shattered_library' }, hintLocationId: 'loc_shattered_library' }],
        onExit: stageDone('ilyra'),
        next: 'second_watch',
      },
      {
        id: 'second_watch',
        tags: ['written'],
        journal: 'Wait in the Shattered Library past the second watch. What speaks there speaks at night.',
        objectives: [
          { id: 'obj_night', text: 'Wait at the Library past the second watch', when: { all: [{ location: 'loc_shattered_library' }, { watch: 'night' }] }, hintLocationId: 'loc_shattered_library' },
        ],
        onExit: stageDone('ilyra'),
        next: 'ask',
      },
      {
        // the whispers resolve into verse I, looped; scene_ilyra_voices_ask decides
        id: 'ask',
        tags: ['written'],
        journal: 'The whispers settled into one verse, looped, in her own voice. Ask Ilyra what she would say to someone who claimed to know her.',
        onEnter: [{ grantEcho: 'echo_litany_verse_1' }],
        onExit: stageDone('ilyra'),
        next: 'watchword',
      },
      { id: 'watchword', tags: ['written'], journal: 'The ink still holds. Ilyra has said it aloud once, to you.', outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 1: 150 XP; STORY: Remnants +5 and the watchword, usable from the next loop
    rewards: { xp: 150, rep: [{ faction: 'remnants', delta: 5 }], echoes: ['echo_ilyra_watchword'] },
  },

  // ---- The Danthe Line — Ilyra 2 (STORY §11.4; giver Ilyra; the Drowned Reach, then the Sunken Archives) ---------------------
  {
    id: 'q_the_danthe_line',
    name: 'The Danthe Line',
    description: "Ilyra wants to try the Remnants' seal on the Door of Pages.",
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_ilyra',
    factionId: 'remnants',
    companionId: 'ilyra',
    availableWhen: { all: [FROM_LOOP_2, { loyalty: { companion: 'ilyra', min: 25 } }, { any: [{ echo: 'echo_archive_door' }, { item: { id: 'item_bell_vault_key' } }] }] },
    stages: [
      {
        id: 'door',
        tags: ['story'],
        journal: "The Door of Pages opens only to Oriel's seal. Ilyra wears the Remnants' seal. Try it.",
        objectives: [
          { id: 'obj_door', text: 'Bring Ilyra to the Door of Pages', when: { all: [{ location: 'loc_sunken_scriptorium' }, { companion: { id: 'ilyra' } }] }, hintLocationId: 'loc_sunken_scriptorium' },
        ],
        onExit: stageDone('ilyra'),
        next: 'carrel',
      },
      {
        // the Archives' enter event opens scene_the_first_drowned while this stage runs and Ilyra stands in the party
        id: 'carrel',
        tags: ['written'],
        journal: "The Door opened to her seal; Oriel Danthe's hand is on every shelf. Take Ilyra back to the carrel under the east stair of the Sunken Archives.",
        onEnter: [{ grantEcho: 'echo_oriel_lineage' }],
        onExit: stageDone('ilyra'),
        next: 'oriel',
      },
      {
        // passed through inside the scene: Oriel has spoken; Ilyra answers her
        id: 'oriel',
        tags: ['written'],
        journal: "Oriel Danthe knows Ilyra's hands. Let Ilyra answer her.",
        onExit: stageDone('ilyra'),
        next: 'taken',
      },
      { id: 'taken', tags: ['written'], journal: "Ilyra took Oriel's ring, and the line that comes with it, openly.", outcome: 'complete' },
      { id: 'left', tags: ['written'], journal: "Ilyra left the ring where it lay. A dead woman has no claim on her hands.", outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 2: 250 XP; STORY: the First Drowned met either way
    rewards: { xp: 250, echoes: ['echo_oriel_drowned'] },
  },

  // ---- The Keeper's Price — Ilyra 3 (STORY §11.4; giver Keeper Dray with Ilyra present, Shattered Library) -------------------
  {
    id: 'q_the_keepers_price',
    name: "The Keeper's Price",
    description: 'Keeper Dray wants Ilyra to hear from him what tearing a portal costs.',
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_ansel_dray',
    factionId: 'remnants',
    companionId: 'ilyra',
    availableWhen: {
      all: [FROM_LOOP_2, { loyalty: { companion: 'ilyra', min: 50 } }, { any: [{ echo: 'echo_ilyra_cost' }, { quest: { id: 'q_keepers_ledger', status: 'completed' } }] }],
    },
    stages: [
      {
        id: 'hear_him',
        tags: ['story'],
        journal: 'Dray knows what tearing a portal costs the one who tears it. He wants Ilyra to hear it from him.',
        onExit: stageDone('ilyra'),
        next: 'telling',
      },
      {
        // scene_dray_keepers_price passes through telling and choose
        id: 'telling',
        tags: ['written'],
        journal: "Each portal costs years she will not get back. The Keeper's way costs everything and keeps everything.",
        onExit: stageDone('ilyra'),
        next: 'choose',
      },
      {
        id: 'choose',
        tags: ['written'],
        journal: 'Ilyra chooses: the Keeper who remembers, or never again.',
        onExit: stageDone('ilyra'),
        next: 'keeper',
      },
      { id: 'keeper', tags: ['written'], journal: 'Ilyra will be the Keeper who remembers. With the Remnants Trusted she can open the Library portal on purpose.', outcome: 'complete' },
      { id: 'unbound_hand', tags: ['written'], journal: 'Ilyra has sworn never to tear a portal again. Not this loop.', outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 3: 400 XP; Remnants +15 and the Keeper's Echo ride on the choice
    rewards: { xp: 400 },
  },

  // ---- The Scout's Oath — Brak 1 (STORY §11.4; giver Brak after q_blighted_outpost, Loop 2+; the Ashen Steppe) ---------------
  {
    id: 'q_the_scouts_oath',
    name: "The Scout's Oath",
    description: 'Brak asks you to ride with him across the Steppe to the Ring of Wagons.',
    category: 'companion',
    botHint: 'melee',
    giverNpcId: 'npc_brak',
    factionId: 'ironclad',
    companionId: 'brak',
    availableWhen: { all: [FROM_LOOP_2, { quest: { id: 'q_blighted_outpost', status: 'completed' } }] },
    stages: [
      {
        // the two ambushes, placed on the road east (a spawned group is fought on arrival)
        id: 'ride',
        tags: ['story'],
        journal: 'Brak must report to the Ring of Wagons. Ride with him across the Steppe.',
        onEnter: [{ spawn: { creature: 'cr_salt_jackal', location: 'loc_scorched_gate' } }, { spawn: { creature: 'cr_steppe_harrier', location: 'loc_ash_wind_flats' } }],
        objectives: [{ id: 'obj_gate', text: 'Ride east through the Scorched Gate', when: { location: 'loc_scorched_gate' }, hintLocationId: 'loc_scorched_gate' }],
        onExit: stageDone('brak'),
        next: 'flats',
      },
      {
        id: 'flats',
        tags: ['written'],
        journal: 'The Ash-Wind Flats: herd-paths, grey ash, things that bite. Hearthring is east over them.',
        objectives: [{ id: 'obj_flats', text: 'Cross the Ash-Wind Flats', when: { location: 'loc_ash_wind_flats' }, hintLocationId: 'loc_ash_wind_flats' }],
        onExit: stageDone('brak'),
        next: 'ring',
      },
      {
        id: 'ring',
        tags: ['written'],
        journal: 'Hearthring, the Ring of Wagons. Bring Brak to the fire; the clan-mother has his report to hear.',
        objectives: [{ id: 'obj_ring', text: 'Reach Hearthring', when: { location: 'loc_hearthring' }, hintLocationId: 'loc_hearthring' }],
        onExit: stageDone('brak'),
        next: 'oath',
      },
      {
        // scene_hadda_scouts_oath: Hadda names him; that night, the other name once
        id: 'oath',
        tags: ['written'],
        journal: 'Hadda Ironvow has the word for him. Stand with Brak at the fire, and stay the night.',
        onExit: stageDone('brak'),
        next: 'named',
      },
      {
        id: 'named',
        tags: ['written'],
        journal: 'Brak said the name once, in the dark: Stonehand. The Ring has his report, and you have his whistle.',
        onEnter: [{ setFlag: 'flag_hearthring_caravan' }],
        outcome: 'complete',
      },
    ],
    // DESIGN §6.2 arc 1: 150 XP; STORY: the whistle, Ironclad +5, the dropped name
    rewards: { xp: 150, items: [{ itemId: 'item_scouts_whistle' }], rep: [{ faction: 'ironclad', delta: 5 }], echoes: ['echo_brak_birth_name'] },
  },

  // ---- Blood and Salt — Brak 2 (STORY §11.4; giver Brak, or Kaelen with the dropped name; Loop 1 open, D-067.17) ------------
  {
    id: 'q_blood_and_salt',
    name: 'Blood and Salt',
    description: 'Brak needs salt for the camp and will not ask Kaelen for it. Carry it.',
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_brak',
    factionId: 'ironclad',
    companionId: 'brak',
    stages: [
      {
        id: 'salt',
        tags: ['story'],
        journal: 'Kaelen sells salt. Brak needs salt for the camp and will not ask. Carry it.',
        objectives: [{ id: 'obj_salt', text: 'Buy or earn a sack of Steppe salt', when: { item: { id: SALT } }, hintLocationId: 'loc_wayfarers_respite' }],
        // a sack already carried moves the quest straight on
        advanceWhen: { item: { id: SALT } },
        onExit: stageDone('brak'),
        next: 'kaelen',
      },
      {
        // scene_braks_brother decides: the name said → to_brak_spoke; no word → to_brak_refused
        id: 'kaelen',
        tags: ['written'],
        journal: 'Take the salt to Kaelen at the Respite. He will want to know who it is for.',
        onExit: stageDone('brak'),
        next: 'to_brak_spoke',
      },
      {
        id: 'to_brak_spoke',
        tags: ['written'],
        journal: "Kaelen gave the salt free, and their father's whetstone with it. Bring both to Brak at the Camp.",
        onExit: stageDone('brak'),
        next: 'spoke',
      },
      {
        id: 'to_brak_refused',
        tags: ['written'],
        journal: 'Kaelen sold the salt and sent no word with it. Bring it to Brak at the Camp.',
        onExit: stageDone('brak'),
        next: 'fine',
      },
      { id: 'spoke', tags: ['written'], journal: "The brothers will speak. Brak has their father's whetstone, and it needs oiling.", outcome: 'complete' },
      { id: 'fine', tags: ['written'], journal: 'Brak has the salt and no word from his brother. He says it is fine.', outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 2: 250 XP; STORY: Kaelen keeps a better account of you either way; the whetstone and Ironclad +10 are A's
    rewards: { xp: 250, echoes: ['echo_kaelen_ledger'] },
    shortcuts: [{ echo: 'echo_brak_birth_name', skipTo: 'kaelen', text: 'Kaelen knows who the salt is for.' }],
  },

  // ---- The Line He Holds — Brak 3 (STORY §11.4; giver Brak; needs echo_brak_death and the Outpost done) ---------------------
  {
    id: 'q_the_line_he_holds',
    name: 'The Line He Holds',
    description: 'Tell Brak how he dies at the Apex, and let him choose.',
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_brak',
    factionId: 'ironclad',
    companionId: 'brak',
    // STORY's prereq, exactly (DESIGN §13.3 ex. 5's `when`)
    availableWhen: { all: [{ echo: 'echo_brak_death' }, { quest: { id: 'q_blighted_outpost', status: 'completed' } }] },
    // STORY "Fails if Brak dies": the Tyrant killed while he has not been kept away or sent to the Nexus (see the header)
    failWhen: { flag: 'flag_tyrant_dead' },
    stages: [
      {
        // scene_brak_line_he_holds passes through proof and choose
        id: 'tell',
        tags: ['story'],
        journal: 'You know how Brak dies. Tell him.',
        onExit: stageDone('brak'),
        next: 'proof',
      },
      {
        id: 'proof',
        tags: ['written'],
        journal: "He does not believe it. Name the colour of the Apex floor, or the words he said there.",
        onExit: stageDone('brak'),
        next: 'choose',
      },
      {
        // DESIGN §13.3 ex. 5: the +5 of this stage rides on the choices
        id: 'choose',
        tags: ['written'],
        journal: 'He believes you. He remembers it anyway, in his shoulders. Let him choose.',
        next: 'kept_away',
      },
      { id: 'kept_away', tags: ['written'], journal: 'Brak stays at the Ring of Wagons. He lives, and you go to the Apex without him.', outcome: 'complete' },
      { id: 'comes_anyway', tags: ['written'], journal: 'Brak comes anyway, to see it. If the Tyrant falls, he dies as before.', outcome: 'complete' },
      { id: 'holds_nexus', tags: ['written'], journal: "Brak holds the line at the Nexus instead, with Kaelen's salt, where the Horde is thinner. He lives.", outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 3: 400 XP; Ironclad +10 rides on each choice (DESIGN §13.3 ex. 5)
    rewards: { xp: 400 },
  },
] satisfies QuestInput[];
