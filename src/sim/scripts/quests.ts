// Quest proofs (PLAN §7.8, DESIGN §13.4; U52): a `pathBot` script per quest — one per outcome that something later reads (the
// Crystal given or kept, each Heartstone path, the shards given or refused, the scroll to Ilyra or to Nyx) — that completes it
// on the real pack. `npm run sim -- quest [<questId>…] [--pack real] [--verbose]` runs them; tests/unit/sim/questScripts.test.ts
// runs them in CI. The quest units U53–U59 append theirs to `QUEST_SCRIPTS` (U53: the four faction chains, two outcomes
// each, on constructed Loop 2+ profiles that hold the standing Echo opening the chain).
//
// A script starts at the title screen (or a scenario) with a fresh profile, or with `profile`: a constructed profile for a
// Loop 2+ proof (the loop counter and the Echoes an earlier loop would have earned) — the proof is about the quest, not the
// loops before it. It ends with the assertion that the quest is completed at its outcome stage; the proof holds when the
// script ran out (`script_done`) with no engine error. Scripts name content ids only (no uids, no indices). The bot is
// `pathBot` with `examines` on (so a script can search a place: `examine` the location reveals its hidden items) and, in
// explore mode, the head of every policy bot's turn in front of it (`trained`): stat and ability points spent and better gear
// worn as `melee` does, a rest while HP is under 3/4 where there is a bed, a draught under 1/2 where there is none, and at a
// stall `melee`'s shopping (healing stocked, the weapon upgraded; nothing sold) — the character a player would bring, not a
// level-1 body at level 6. It never walks: travel is the script's.
//
// Strength: a Loop 1 proof walks the legacy route in order (STORY §4.1, WORLD §10.8 route T1: the Crystal, the scroll, the
// Heartstone, the Peaks, the Outpost, the shards), so each story gate is met at the level the route brings; a Loop 2+ proof
// starts at the carry-over level of the constructed profile's `bestLevel` (D-067.2). No proof hands play to a policy bot: one
// would take the quests itself.
import type { Action, ContentPack } from '@engine/index';
import type { Condition } from '@schema/condition';
import { pathBot } from '../bots/pathBot';
import { MELEE_TRADE, bestDrink, meleeUnlockRank, notesOf, pickEquip, pickStat, pickTrade, pickUnlock, type Env, type TradeCfg } from '../bots/policy';
import { healthFraction } from '../bots/shared';
import type { Bot } from '../bots/types';
import { runLoop, type RunResult } from '../runner';
import { newProfile, type ScenarioId } from '../scenarios';
import type { ScriptStep } from './types';

export interface QuestScript {
  questId: `q_${string}`;
  /** The stage the quest must be completed at (a decision quest has one script per outcome). */
  outcome: string;
  /** A label (the outcome in words). */
  name: string;
  classId: string;
  seed: string;
  scenario?: ScenarioId;
  /**
   * Loop 2+ proofs: the profile to start from (constructed): its loop counter, the Echoes it holds and the best level reached
   * with the class (the new loop starts at ⌊0.6 × best⌋, D-067.2).
   */
  profile?: { loop: number; echoes?: readonly `echo_${string}`[]; bestLevel?: number };
  steps: ScriptStep[];
  /** Runner step cap (default 6000). */
  maxSteps?: number;
}

export interface QuestProof {
  script: QuestScript;
  completed: boolean;
  /** One line: how it ended. */
  detail: string;
  result: RunResult;
}

// ---- Building blocks ------------------------------------------------------------------------------------------------------

const CLASS = 'ranger';
const done = (questId: `q_${string}`, stage: string): ScriptStep => ({
  assert: { quest: { id: questId, stage, status: 'completed' } },
  message: `${questId} is not completed at stage '${stage}'`,
});
const holds = (when: Condition, message: string): ScriptStep => ({ assert: when, message });
const examineHere: Action = { type: 'examine', target: { kind: 'location' } };
const takeAll: Action = { type: 'takeAll' };
const choose = (choiceId: string): Action => ({ type: 'choose', choiceId });

/** q_echo_crystal up to its decision (Loop 1: search the Library's alcove; with the Echo: the shortcut, the Crystal in sight). */
const crystalToIlyra = (shortcut: boolean): ScriptStep[] => [
  { talk: 'npc_ilyra', pick: [shortcut ? 'third_alcove' : 'yes'] },
  holds({ quest: { id: 'q_echo_crystal', stage: shortcut ? 'take_crystal' : 'reach_library' } }, 'q_echo_crystal did not start where it should'),
  { goto: 'loc_shattered_library' },
  ...(shortcut ? [] : [examineHere]),
  takeAll,
  holds({ quest: { id: 'q_echo_crystal', stage: 'return' } }, 'the Crystal was not taken'),
  { goto: 'loc_whispering_ruins' },
];

/** q_echo_crystal given, and verse I on the next talk. */
const crystalGiven = (shortcut = false): ScriptStep[] => [
  ...crystalToIlyra(shortcut),
  { talk: 'npc_ilyra', pick: ['give'] },
  done('q_echo_crystal', 'given'),
  { talk: 'npc_ilyra', pick: [] }, // scene_ilyra_crystal_deciphered
  holds({ echo: 'echo_litany_verse_1' }, 'verse I was not spoken on the next talk'),
];

/** q_lost_scroll up to its delivery: accept, the Archivist's carrel (a story gate), the scroll. */
const scrollFetched: ScriptStep[] = [
  { talk: 'npc_ilyra', pick: ['yes'] },
  holds({ quest: { id: 'q_lost_scroll', stage: 'descend' } }, 'q_lost_scroll did not start'),
  { goto: 'loc_sunken_archives' },
  { fight: 'melee' },
  holds({ item: { id: 'item_scholars_lost_scroll' } }, 'the Archivist did not drop the scroll'),
  holds({ quest: { id: 'q_lost_scroll', stage: 'deliver' } }, 'q_lost_scroll is not at its delivery'),
];

/** Loop 1, the legacy route's first two quests: the Crystal given, the scroll to Ilyra. */
const crystalAndScroll: ScriptStep[] = [
  ...crystalGiven(),
  ...scrollFetched,
  { goto: 'loc_whispering_ruins' },
  { talk: 'npc_ilyra', pick: [] },
  done('q_lost_scroll', 'to_ilyra'),
];

/** Two quests done: the heartbeat has started; down to the Depths, where the choice opens (WORLD's `ev_depths_choice`). */
const heartstoneReached: ScriptStep[] = [
  ...crystalAndScroll,
  holds({ quest: { id: 'q_echoing_heartbeat', stage: 'descend' } }, 'q_echoing_heartbeat did not start after two quests'),
  { goto: 'loc_sunken_archives' },
  { type: 'move', to: 'loc_heartstone_depths' },
  holds({ quest: { id: 'q_echoing_heartbeat', stage: 'choose' } }, 'the Depths did not open the choice'),
];

/** The Heartstone path `choiceId`, then out of the scene. */
const heartstone = (choiceId: 'stabilize' | 'exploit' | 'destroy', stage: string): ScriptStep[] => [
  ...heartstoneReached,
  choose(choiceId),
  { goto: 'loc_sunken_archives' },
  done('q_echoing_heartbeat', stage),
];

/** q_clear_path, accepted and reported (the Brute is a story gate while it runs). */
const clearPath: ScriptStep[] = [
  { goto: 'loc_ironclad_camp' },
  { talk: 'npc_brak', pick: ['yes'] },
  holds({ quest: { id: 'q_clear_path', stage: 'hunt' } }, 'q_clear_path did not start'),
  { rest: 1 }, // the inn: whole for the gate
  { goto: 'loc_barren_peaks' },
  { fight: 'melee' },
  holds({ quest: { id: 'q_clear_path', stage: 'report' } }, 'the Brute is not down'),
  { goto: 'loc_ironclad_camp' },
  { talk: 'npc_brak', pick: [] },
  done('q_clear_path', 'done'),
];

/** Loop 1, the legacy route to the Peaks: the Crystal, the scroll, the Heartstone stabilized, then the Peaks. */
const routeToPeaks: ScriptStep[] = [...heartstone('stabilize', 'done_stabilize'), ...clearPath];

/** q_blighted_outpost accepted (Brak, after the Peaks). */
const outpostAccepted: ScriptStep[] = [
  { talk: 'npc_brak', pick: ['yes'] },
  holds({ quest: { id: 'q_blighted_outpost' } }, 'q_blighted_outpost did not start'),
];

/** Loop 1, the legacy route through the Outpost (the Golems are a story gate while it runs). */
const routeToOutpost: ScriptStep[] = [
  ...routeToPeaks,
  ...outpostAccepted,
  holds({ quest: { id: 'q_blighted_outpost', stage: 'golems' } }, 'q_blighted_outpost did not start at the Golems'),
  { rest: 1 },
  { goto: 'loc_blighted_outpost' },
  { fight: 'melee' },
  holds({ quest: { id: 'q_blighted_outpost', stage: 'cleared' } }, 'the Golems are not down'),
  { goto: 'loc_emberforge' }, // the camp next door: a rest before the road back over the Peaks
  { goto: 'loc_ironclad_camp' },
  { talk: 'npc_brak', pick: [] },
  done('q_blighted_outpost', 'done'),
];

/** q_void_shards up to the shards in hand: accept, the Hollow's loose shard and its Stalkers (one fixed group per arrival). */
const shardsGathered: ScriptStep[] = [
  { goto: 'loc_chasm_of_whispers' },
  { talk: 'npc_nyx', pick: ['yes'] },
  holds({ quest: { id: 'q_void_shards', stage: 'gather' } }, 'q_void_shards did not start'),
  { rest: 1 }, // the cold camp on the lip
  { goto: 'loc_voidscar_hollow' },
  takeAll,
  { goto: 'loc_chasm_of_whispers' },
  { rest: 1 },
  { goto: 'loc_voidscar_hollow' },
  holds({ item: { id: 'item_void_shard', count: 3 } }, 'three Void Shards are not in hand'),
  { goto: 'loc_chasm_of_whispers' },
];

// ---- U53: the faction chains (Loop 2+; the profile holds the standing Echo that opens each chain) ---------------------------

/** q_keepers_ledger up to its decision: the Keeper's ask and the Ledger read, Ilyra's lantern, the case from the Cistern. */
const ledgerFetched: ScriptStep[] = [
  { goto: 'loc_shattered_library' },
  { talk: 'npc_ansel_dray', pick: ['yes'] },
  holds({ all: [{ quest: { id: 'q_keepers_ledger', stage: 'recover_day_count' } }, { echo: 'echo_seven_wayfinders' }] }, 'the Ledger was not read'),
  { goto: 'loc_sunken_archives' },
  takeAll, // Ilyra's lantern: the Reach's dark gate
  { goto: 'loc_cistern_of_names' },
  takeAll,
  holds({ quest: { id: 'q_keepers_ledger', stage: 'choose_copy' } }, 'the day-count was not in the Cistern'),
  { goto: 'loc_lamplighters_rest' }, // the Reach's one dry room: whole for the road back up
  { rest: 1 },
  { goto: 'loc_shattered_library' },
];

/** The Keeper's copy: `choiceId` decides, and the quest completes at `stage`. */
const ledgerCopied = (choiceId: 'whole' | 'verse_one', stage: string): ScriptStep[] => [
  ...ledgerFetched,
  { talk: 'npc_ansel_dray', pick: [choiceId] },
  done('q_keepers_ledger', stage),
  holds({ all: [{ item: { id: 'item_keepers_copy' } }, { not: { item: { id: 'item_pells_day_count' } } }] }, "the Keeper's Copy was not paid, or the case not taken"),
];

/**
 * Brak's two quests with the warder's word (the Scorched Gate opens), the Nexus's Aberration on a visit of its own (a first-visit
 * fight, and the waves follow the arrival that starts the stage without a breath between), Hadda's Telling, the Nexus again.
 */
const axeRecovered: ScriptStep[] = [
  ...clearPath,
  ...outpostAccepted,
  { fight: 'flee' },
  { goto: 'loc_blighted_outpost' }, // the word stills the Golems (the shortcut)
  { goto: 'loc_ironclad_camp' },
  { talk: 'npc_brak', pick: [] },
  done('q_blighted_outpost', 'done'),
  { fight: 'melee' },
  // Nyx's shards too (the Hollow's Stalkers: levels, and their Warrior's Sword one time in four), then to the Nexus the long
  // way through the Highlands (the Sentinel, the Weaver at the Spires): the levels the Nexus asks of a carry-over start; then
  // the Aberration, and the astronomers' cell to rest in after
  ...shardsGathered,
  { talk: 'npc_nyx', pick: ['yes'] },
  done('q_void_shards', 'given'),
  { rest: 1 },
  { goto: 'loc_ironclad_camp' }, // by the Camp and the Peaks, not the Depths (the heartbeat has started: its choice would open on the way)
  { goto: 'loc_sky_whisper_plateau' },
  { goto: 'loc_aetherium_spires' },
  { goto: 'loc_chronos_nexus' },
  takeAll, // the orrery key: the brass knight stands down on the return
  { rest: 1 },
  { goto: 'loc_hearthring' },
  { talk: 'npc_hadda_ironvow', pick: ['yes'] },
  holds({ quest: { id: 'q_day_of_teeth', stage: 'hear_telling' } }, 'q_day_of_teeth did not start'),
  { rest: 1 },
  // the Nexus again: the three waves the stage starts on arrival, then the axe
  { goto: 'loc_chronos_nexus' },
  holds({ all: [{ quest: { id: 'q_day_of_teeth', stage: 'return' } }, { item: { id: 'item_blackreeds_axe' } }, { killed: { id: 'cr_horde_husk', count: 3 } }] }, 'the Horde-echo did not fall, or the axe was not taken'),
  { rest: 1 },
  { goto: 'loc_hearthring' },
];

/** Loop 2: the Crystal kept and the shards given (Weavers 30: the curtain opens), a fourth shard from the Scar Shelf, the Sanctum. */
const weaverRouteToSanctum: ScriptStep[] = [
  ...crystalToIlyra(true),
  { talk: 'npc_ilyra', pick: ['keep', 'leave'] },
  done('q_echo_crystal', 'kept'),
  ...shardsGathered,
  { talk: 'npc_nyx', pick: ['yes'] },
  done('q_void_shards', 'given'),
  { rest: 1 },
  { goto: 'loc_scar_shelf' },
  takeAll,
  holds({ item: { id: 'item_void_shard' } }, 'the Shelf had no shard'),
  { goto: 'loc_chasm_of_whispers' },
  { rest: 1 }, // the cold camp again: whole for the Veil
  { fight: 'flee' }, // the Veil's fixed groups scatter when fled (the pacifist's way down, STORY: "yes")
  { goto: 'loc_sanctum_of_threads' },
  { fight: 'melee' },
];

/** q_hollow_choir accepted at the Sanctum, then the rite: `offering` given, `answer` to the eighth verse. */
const choirHeard = (offering: 'shard' | 'verse', answer: 'correct' | 'silent', stage: string): ScriptStep[] => [
  { talk: 'npc_sethe_unlidded', pick: ['yes'] },
  holds({ quest: { id: 'q_hollow_choir', stage: 'torn_thing' } }, 'q_hollow_choir did not start'),
  { talk: 'npc_sethe_unlidded', pick: [offering, answer] },
  done('q_hollow_choir', stage),
  holds({ all: [{ item: { id: 'item_choir_mask' } }, { echo: 'echo_weaver_sign' }] }, 'the mask or the hand-sign was not paid'),
];

/** Loop 3 with the hand-sign (Weavers start 20) and the Hollow's path known: to the Sanctum by the Chasm's camp, fleeing the Veil's groups. */
const signRouteToSanctum: ScriptStep[] = [
  { goto: 'loc_chasm_of_whispers' },
  { rest: 1 },
  { fight: 'flee' },
  { goto: 'loc_sanctum_of_threads' },
  { fight: 'melee' },
];

/** Loop 3 with the hand-sign: the Choir heard (a verse offered, nothing said), then the Eye asked for and taken at the Nexus. */
const eyeTaken: ScriptStep[] = [
  ...signRouteToSanctum,
  ...choirHeard('verse', 'silent', 'silent'),
  { talk: 'npc_sethe_unlidded', pick: ['yes'] },
  holds({ quest: { id: 'q_unlidded_eye', stage: 'lens' } }, 'q_unlidded_eye did not start'),
  { rest: 1 },
  { goto: 'loc_chronos_nexus' }, // the Aberration (first visit) drops the Eye while the quest runs
  holds({ all: [{ quest: { id: 'q_unlidded_eye', stage: 'return' } }, { item: { id: 'item_aberrant_eye' } }] }, 'the Aberration did not drop the Eye'),
  { rest: 1 },
  { goto: 'loc_sanctum_of_threads' },
];

/** Sethe's decision over the Eye, then the Note of Closing on the next talk (Weavers Trusted). */
const eyeDecided = (choiceId: 'warn' | 'look', stage: string): ScriptStep[] => [
  ...eyeTaken,
  { talk: 'npc_sethe_unlidded', pick: [choiceId] },
  done('q_unlidded_eye', stage),
  holds({ item: { id: 'item_unlidded_eye' } }, 'the Unlidded Eye was not paid'),
  { talk: 'npc_sethe_unlidded', pick: ['ask_note'] },
  holds({ echo: 'echo_void_resonance' }, 'the Note of Closing was not granted'),
];

// ---- U54: Ilyra's and Brak's arcs (recruitment proved inside the quest proofs; the camp scenes play through the rests) ------------

/** A bot that passes the time where it stands (for `until`: the Library's second watch). */
const waiter: Bot = { name: 'waiter', choose: (_s, legal) => legal.find((a) => a.type === 'wait') ?? (legal[0] as Action) };

/** A bot that buys `itemId` at the stall here (for `until`: Kaelen's salt), else waits. */
const buyer = (itemId: string): Bot => ({
  name: `buyer:${itemId}`,
  choose: (s, legal) =>
    legal.find((a) => a.type === 'buy' && s.merchants[a.merchantId]?.stock.find((i) => i.uid === a.uid)?.itemId === itemId) ??
    legal.find((a) => a.type === 'wait') ??
    (legal[0] as Action),
});

/** A bot that takes `choiceId` whenever it is offered and otherwise continues (for `until`: a scene an arrival opened). */
const chooser = (choiceId: string): Bot => ({
  name: `chooser:${choiceId}`,
  choose: (_s, legal) =>
    legal.find((a) => a.type === 'choose' && a.choiceId === choiceId) ?? legal.find((a) => a.type === 'continue') ?? legal.find((a) => a.type === 'choose') ?? (legal[0] as Action),
});

const ILYRA_RECRUITED: Condition = { companion: { id: 'ilyra', state: 'recruited' } };
const BRAK_RECRUITED: Condition = { companion: { id: 'brak', state: 'recruited' } };

/** q_voices_in_the_stacks from its offer: the Library's night watch, the verse read aloud, the watchword. */
const voicesHeard: ScriptStep[] = [
  { talk: 'npc_ilyra', pick: ['voices', 'yes'] }, // the hub: the Voices
  holds({ quest: { id: 'q_voices_in_the_stacks', stage: 'stacks' } }, 'q_voices_in_the_stacks did not start'),
  { goto: 'loc_shattered_library' },
  { until: { quest: { id: 'q_voices_in_the_stacks', stage: 'ask' } }, do: waiter, maxSteps: 12 },
  { goto: 'loc_whispering_ruins' },
  { talk: 'npc_ilyra', pick: ['read_aloud', 'what_would'] },
  done('q_voices_in_the_stacks', 'watchword'),
  holds({ echo: 'echo_ilyra_watchword' }, 'the watchword was not granted'),
];

/**
 * Loop 3 with the watchword and the bond: she believes you at the first meeting, the Crystal by the shortcut and given, the
 * scroll accepted, and she joins (loyalty 25 from `echo_ilyra_bond`).
 */
const ilyraJoinsLoop3: ScriptStep[] = [
  { talk: 'npc_ilyra', pick: ['watchword', 'third_alcove'] },
  holds({ quest: { id: 'q_echo_crystal', stage: 'take_crystal' } }, 'the shortcut did not open the Crystal quest'),
  { goto: 'loc_shattered_library' },
  takeAll,
  { goto: 'loc_whispering_ruins' },
  { talk: 'npc_ilyra', pick: ['give'] },
  done('q_echo_crystal', 'given'),
  { talk: 'npc_ilyra', pick: [] }, // scene_ilyra_crystal_deciphered
  { talk: 'npc_ilyra', pick: ['yes'] }, // the scroll offer wins the tie
  { talk: 'npc_ilyra', pick: ['come'] }, // the hub: she joins
  holds({ all: [ILYRA_RECRUITED, { loyalty: { companion: 'ilyra', min: 25 } }] }, 'Ilyra did not join at the bond loyalty'),
];

/** The scroll from the Archivist's carrel, delivered to Ilyra (a loyalty beat, now that she is in the party). */
const scrollToIlyra: ScriptStep[] = [...scrollFetched, { goto: 'loc_whispering_ruins' }, { talk: 'npc_ilyra', pick: ['give'] }, done('q_lost_scroll', 'to_ilyra')];

/** q_the_danthe_line from its offer: the Door of Pages with her, back to the carrel, Oriel; `choiceId` decides. */
const dantheLine = (choiceId: 'take' | 'leave', stage: string): ScriptStep[] => [
  { talk: 'npc_ilyra', pick: ['door', 'yes'] }, // the hub: the Door of Pages
  holds({ quest: { id: 'q_the_danthe_line', stage: 'door' } }, 'q_the_danthe_line did not start'),
  { goto: 'loc_sunken_archives' },
  takeAll, // the lantern: the Reach's dark gate
  { goto: 'loc_sunken_scriptorium' },
  holds({ all: [{ quest: { id: 'q_the_danthe_line', stage: 'carrel' } }, { echo: 'echo_oriel_lineage' }] }, 'the Door did not open to her seal'),
  { goto: 'loc_lamplighters_rest' },
  { rest: 1 },
  { goto: 'loc_drowned_stair' },
  { type: 'move', to: 'loc_sunken_archives' }, // the carrel's event opens scene_the_first_drowned
  { until: { quest: { id: 'q_the_danthe_line', status: 'completed' } }, do: chooser(choiceId), maxSteps: 30 },
  done('q_the_danthe_line', stage),
  holds({ echo: 'echo_oriel_drowned' }, 'the First Drowned was not met'),
];

/** Loop 3: she joins, the Voices, the scroll, the Door of Pages: Loyal (50) by the Keeper's table. */
const ilyraLoyalLoop3: ScriptStep[] = [...ilyraJoinsLoop3, ...voicesHeard, ...scrollToIlyra, ...dantheLine('take', 'taken'), holds({ loyalty: { companion: 'ilyra', min: 50 } }, 'Ilyra is not Loyal')];

/** The Keeper's table: the Ledger accepted first (it wins the tie), then the telling and `choiceId`. */
const keepersPrice = (choiceId: 'keeper' | 'never', stage: string): ScriptStep[] => [
  ...ilyraLoyalLoop3,
  { goto: 'loc_shattered_library' },
  { talk: 'npc_ansel_dray', pick: ['yes'] }, // q_keepers_ledger: its offer wins the tie
  { talk: 'npc_ansel_dray', pick: ['yes', choiceId] },
  done('q_the_keepers_price', stage),
];

/** Loop 2+: the Peaks and the Outpost (the warder's word), Brak recruited between them. */
const brakJoins: ScriptStep[] = [
  ...clearPath,
  ...outpostAccepted,
  { talk: 'npc_brak', pick: ['come'] }, // the hub: he joins for the Outpost
  holds(BRAK_RECRUITED, 'Brak did not join'),
  { fight: 'flee' },
  { goto: 'loc_blighted_outpost' }, // the word stills the Golems (the shortcut)
  { goto: 'loc_ironclad_camp' },
  { talk: 'npc_brak', pick: [] },
  done('q_blighted_outpost', 'done'),
  { fight: 'melee' },
];

/** Blood and Salt by Kaelen's door (Loop 2+ with the dropped name: the quest opens at Kaelen's), the whetstone to Brak. */
const saltByKaelen: ScriptStep[] = [
  { goto: 'loc_wayfarers_respite' },
  { talk: 'npc_kaelen_stonehand', pick: ['salt'] },
  holds({ quest: { id: 'q_blood_and_salt', stage: 'kaelen' } }, 'the dropped name did not open the quest at Kaelen'),
  { talk: 'npc_kaelen_stonehand', pick: ['brother', 'said_it'] },
  holds({ all: [{ quest: { id: 'q_blood_and_salt', stage: 'to_brak_spoke' } }, { item: { id: 'item_fathers_whetstone' } }, { item: { id: 'mat_steppe_salt' } }] }, 'Kaelen did not give the salt and the whetstone'),
  { goto: 'loc_ironclad_camp' },
  { talk: 'npc_brak', pick: [] },
  done('q_blood_and_salt', 'spoke'),
  holds({ all: [{ echo: 'echo_kaelen_ledger' }, { not: { item: { id: 'item_fathers_whetstone' } } }] }, "the ledger was not granted, or Brak did not take the whetstone"),
];

/** The Line, told after the Outpost: `choiceId` is his. */
const lineHeHolds = (choiceId: 'stay' | 'come_anyway' | 'nexus', stage: string): ScriptStep[] => [
  { goto: 'loc_ironclad_camp' },
  { talk: 'npc_brak', pick: ['apex', 'tell', 'words', choiceId] },
  done('q_the_line_he_holds', stage),
];

// ---- The proofs -------------------------------------------------------------------------------------------------------------

export const QUEST_SCRIPTS: readonly QuestScript[] = [
  // ---- q_echo_crystal ----
  { questId: 'q_echo_crystal', outcome: 'given', name: 'the Crystal given (Loop 1), verse I next talk', classId: CLASS, seed: 'quest:crystal:give', steps: crystalGiven() },
  {
    questId: 'q_echo_crystal',
    outcome: 'kept',
    name: 'the Crystal kept (Loop 1)',
    classId: CLASS,
    seed: 'quest:crystal:keep',
    steps: [...crystalToIlyra(false), { talk: 'npc_ilyra', pick: ['keep'] }, done('q_echo_crystal', 'kept'), holds({ flag: 'flag_kept_echo_crystal' }, 'the keep flag is not set')],
  },
  {
    questId: 'q_echo_crystal',
    outcome: 'kept',
    name: 'Loop 2: the alcove shortcut, kept, Listen (verse I and the nine voices)',
    classId: CLASS,
    seed: 'quest:crystal:listen',
    profile: { loop: 2, echoes: ['echo_crystal_location'] },
    steps: [
      ...crystalToIlyra(true),
      { talk: 'npc_ilyra', pick: ['keep', 'listen'] },
      done('q_echo_crystal', 'kept'),
      holds({ all: [{ echo: 'echo_litany_verse_1' }, { echo: 'echo_nine_voices' }] }, 'Listen did not give verse I and the nine voices'),
    ],
  },
  // ---- q_lost_scroll ----
  { questId: 'q_lost_scroll', outcome: 'to_ilyra', name: 'the scroll to Ilyra (Loop 1)', classId: CLASS, seed: 'quest:scroll:ilyra', steps: crystalAndScroll },
  {
    questId: 'q_lost_scroll',
    outcome: 'to_nyx',
    name: 'Loop 2: the scroll read to Nyx',
    classId: CLASS,
    seed: 'quest:scroll:nyx',
    profile: { loop: 2, echoes: ['echo_crystal_location'], bestLevel: 5 },
    steps: [
      ...crystalGiven(true),
      ...scrollFetched,
      { goto: 'loc_chasm_of_whispers' },
      { talk: 'npc_nyx', pick: ['read'] },
      done('q_lost_scroll', 'to_nyx'),
      holds({ all: [{ echo: 'echo_breach_recoil' }, { echo: 'echo_litany_verse_8' }] }, "Nyx's reading did not give the Recoil and verse 8"),
    ],
  },
  // ---- q_echoing_heartbeat (two quests done first: the Crystal and the scroll) ----
  { questId: 'q_echoing_heartbeat', outcome: 'done_stabilize', name: 'Stabilize', classId: CLASS, seed: 'quest:heartstone:stabilize', steps: heartstone('stabilize', 'done_stabilize') },
  { questId: 'q_echoing_heartbeat', outcome: 'done_exploit', name: 'Exploit', classId: CLASS, seed: 'quest:heartstone:exploit', steps: heartstone('exploit', 'done_exploit') },
  { questId: 'q_echoing_heartbeat', outcome: 'done_destroy', name: 'Destroy', classId: CLASS, seed: 'quest:heartstone:destroy', steps: heartstone('destroy', 'done_destroy') },
  // ---- q_clear_path ----
  { questId: 'q_clear_path', outcome: 'done', name: 'the Brute killed, Brak paid (Loop 1, after the Heartstone)', classId: CLASS, seed: 'quest:peaks', steps: routeToPeaks },
  // ---- q_blighted_outpost ----
  {
    questId: 'q_blighted_outpost',
    outcome: 'done',
    name: 'the Golems killed, Brak paid (Loop 1, after the Peaks)',
    classId: CLASS,
    seed: 'quest:outpost',
    steps: routeToOutpost,
  },
  {
    questId: 'q_blighted_outpost',
    outcome: 'done',
    name: "Loop 3: the warder's word (no Golem killed)",
    classId: CLASS,
    seed: 'quest:outpost:word',
    profile: { loop: 3, echoes: ['echo_stone_hide_origin'], bestLevel: 11 },
    steps: [
      ...clearPath,
      ...outpostAccepted,
      holds({ quest: { id: 'q_blighted_outpost', stage: 'speak_warder_word' } }, "the warder's word did not open the quest further on"),
      { fight: 'flee' },
      { goto: 'loc_blighted_outpost' },
      holds({ all: [{ quest: { id: 'q_blighted_outpost', stage: 'cleared' } }, { flag: 'flag_outpost_golems_stilled' }] }, 'the word did not still the Golems'),
      { goto: 'loc_ironclad_camp' },
      { talk: 'npc_brak', pick: [] },
      done('q_blighted_outpost', 'done'),
      holds({ not: { killed: { id: 'cr_stone_hide_golem' } } }, 'a Golem was killed'),
    ],
  },
  // ---- q_void_shards (Loop 1, after the Outpost: WORLD §10.8's order) ----
  {
    questId: 'q_void_shards',
    outcome: 'given',
    name: 'the shards given (Loop 1, after the Outpost)',
    classId: CLASS,
    seed: 'quest:shards:give:alt1', // the Hollow's Stalkers beat a level-7 melee ranger about one seed in five (a balance note): a seed that wins
    steps: [...routeToOutpost, ...shardsGathered, { talk: 'npc_nyx', pick: ['yes'] }, done('q_void_shards', 'given'), holds({ item: { id: 'item_shadow_kissed_dagger' } }, 'no Shadow-Kissed Dagger')],
  },
  {
    questId: 'q_void_shards',
    outcome: 'refused',
    name: 'the shards refused (Loop 1, after the Outpost)',
    classId: CLASS,
    seed: 'quest:shards:refuse',
    steps: [
      ...routeToOutpost,
      ...shardsGathered,
      { talk: 'npc_nyx', pick: ['no'] },
      done('q_void_shards', 'refused'),
      holds({ all: [{ flag: 'flag_shards_refused' }, { item: { id: 'item_void_shard', count: 3 } }] }, 'the shards were not kept'),
    ],
  },
  // ---- U53 · q_keepers_ledger (Loop 2+, Remnants Trusted: the watchword starts them at 20) ----
  {
    questId: 'q_keepers_ledger',
    outcome: 'whole',
    name: 'Loop 2: the whole Litany copied; the thirtieth dawn read with the Ledger (the Jailer, with the Recoil)',
    classId: CLASS,
    seed: 'quest:ledger:whole:e', // since U34e's hazards and anomalies, a level-6 ranger dies on the Drowned route in 4 of 5 seeds (D-110 balance flag): a seed that wins
    profile: { loop: 2, echoes: ['echo_ilyra_watchword', 'echo_thirtieth_dawn', 'echo_breach_recoil'], bestLevel: 10 },
    steps: [...ledgerCopied('whole', 'whole'), holds({ all: [{ flag: 'flag_remnants_hold_litany' }, { echo: 'echo_tyrant_jailer' }] }, 'the flag or the Jailer is missing')],
  },
  {
    questId: 'q_keepers_ledger',
    outcome: 'verse_one',
    name: 'Loop 2: verse one only',
    classId: CLASS,
    seed: 'quest:ledger:verse',
    profile: { loop: 2, echoes: ['echo_ilyra_watchword'], bestLevel: 10 },
    steps: [...ledgerCopied('verse_one', 'verse_one'), holds({ not: { flag: 'flag_remnants_hold_litany' } }, 'the flag was set')],
  },
  // ---- U53 · q_day_of_teeth (Loop 2+, Ironclad Trusted: the oath starts them at 20) ----
  {
    questId: 'q_day_of_teeth',
    outcome: 'told_truth',
    name: 'Loop 3: the axe from the Horde-echo; the truth told with the Jailer',
    seed: 'quest:teeth:truth:b', // the Aberration at level 11 and the three waves behind it beat a carry-over Warden about two seeds in three (a balance note): a seed that wins
    classId: 'ironclad_warden',
    profile: { loop: 3, echoes: ['echo_ironclad_oath', 'echo_stone_hide_origin', 'echo_tyrant_jailer'], bestLevel: 17 },
    steps: [...axeRecovered, { talk: 'npc_hadda_ironvow', pick: ['truth'] }, done('q_day_of_teeth', 'told_truth'), holds({ echo: 'echo_day_of_teeth' }, 'the Day of Teeth was not granted')],
  },
  {
    questId: 'q_day_of_teeth',
    outcome: 'told_monster',
    name: 'Loop 3: the axe from the Horde-echo; a monster (the scouts ride east)',
    classId: 'ironclad_warden',
    seed: 'quest:teeth:monster',
    profile: { loop: 3, echoes: ['echo_ironclad_oath', 'echo_stone_hide_origin'], bestLevel: 17 },
    steps: [...axeRecovered, { talk: 'npc_hadda_ironvow', pick: ['monster'] }, done('q_day_of_teeth', 'told_monster'), holds({ not: { echo: 'echo_day_of_teeth' } }, 'the Day of Teeth was granted')],
  },
  // ---- U53 · q_hollow_choir (Loop 2+, Weavers not Wary; the Sanctum behind the curtain) ----
  {
    questId: 'q_hollow_choir',
    outcome: 'silent',
    name: 'Loop 2: the Weaver route (Crystal kept, shards given), a Shard offered, nothing said',
    classId: CLASS,
    seed: 'quest:choir:shard',
    profile: { loop: 2, echoes: ['echo_crystal_location'], bestLevel: 17 },
    steps: [...weaverRouteToSanctum, ...choirHeard('shard', 'silent', 'silent')],
  },
  {
    questId: 'q_hollow_choir',
    outcome: 'corrected',
    name: 'Loop 3: with the hand-sign, a verse offered, the Choir corrected (verse 8)',
    classId: CLASS,
    seed: 'quest:choir:correct',
    profile: { loop: 3, echoes: ['echo_weaver_sign', 'echo_hollow_path', 'echo_litany_verse_8'], bestLevel: 17 },
    steps: [...signRouteToSanctum, ...choirHeard('verse', 'correct', 'corrected')],
  },
  // ---- U53 · q_unlidded_eye (after the Choir, Weavers Trusted) ----
  {
    questId: 'q_unlidded_eye',
    outcome: 'looked',
    name: 'Loop 3: the Eye from the Nexus; Sethe looks (the Choir knows); the Note of Closing',
    classId: 'ironclad_warden',
    seed: 'quest:eye:look:a', // the Aberration at level 11 beats a carry-over Warden about one seed in two (a balance note): a seed that wins
    profile: { loop: 3, echoes: ['echo_weaver_sign', 'echo_hollow_path', 'echo_heartstone_path', 'echo_litany_verse_1'], bestLevel: 17 },
    steps: [...eyeDecided('look', 'looked'), holds({ echo: 'echo_choir_knows' }, 'the Choir does not know')],
  },
  {
    questId: 'q_unlidded_eye',
    outcome: 'warned',
    name: 'Loop 3: the Eye from the Nexus; Nyx warned first; the Note of Closing',
    classId: 'ironclad_warden',
    seed: 'quest:eye:warn:a', // as above
    profile: { loop: 3, echoes: ['echo_weaver_sign', 'echo_hollow_path', 'echo_heartstone_path', 'echo_litany_verse_1'], bestLevel: 17 },
    steps: [...eyeDecided('warn', 'warned'), holds({ not: { echo: 'echo_choir_knows' } }, 'the Choir knows')],
  },
  // ---- U54 · q_voices_in_the_stacks (Loop 2+, after the Crystal; she joins after it: "Ilyra recruitable") ----
  {
    questId: 'q_voices_in_the_stacks',
    outcome: 'watchword',
    name: 'Loop 2: the Library at night, the verse read aloud, the watchword; then she joins',
    classId: CLASS,
    seed: 'quest:voices',
    profile: { loop: 2, echoes: ['echo_crystal_location'], bestLevel: 5 },
    steps: [
      ...crystalGiven(true),
      { talk: 'npc_ilyra', pick: ['yes'] }, // the scroll offer wins the tie
      ...voicesHeard,
      { talk: 'npc_ilyra', pick: ['come'] }, // the hub: she believes you now
      holds(ILYRA_RECRUITED, 'Ilyra did not join after the Voices'),
    ],
  },
  // ---- U54 · q_the_danthe_line (Loop 3 with the watchword, the Door of Pages known and the bond) ----
  {
    questId: 'q_the_danthe_line',
    outcome: 'taken',
    name: "Loop 3: she joins at the watchword; the Door of Pages, Oriel's carrel, the ring taken",
    classId: CLASS,
    seed: 'quest:danthe:ring',
    profile: { loop: 3, echoes: ['echo_ilyra_watchword', 'echo_crystal_location', 'echo_archive_door', 'echo_ilyra_bond'], bestLevel: 17 },
    steps: [...ilyraJoinsLoop3, ...dantheLine('take', 'taken'), holds({ all: [{ item: { id: 'item_oriels_ring' } }, { echo: 'echo_oriel_lineage' }] }, "Oriel's Ring or the lineage is missing")],
  },
  {
    questId: 'q_the_danthe_line',
    outcome: 'left',
    name: "Loop 3: she joins at the watchword; the Door of Pages, Oriel's carrel, the ring left",
    classId: CLASS,
    seed: 'quest:danthe:left',
    profile: { loop: 3, echoes: ['echo_ilyra_watchword', 'echo_crystal_location', 'echo_archive_door', 'echo_ilyra_bond'], bestLevel: 17 },
    steps: [...ilyraJoinsLoop3, ...dantheLine('leave', 'left'), holds({ not: { item: { id: 'item_oriels_ring' } } }, "Oriel's Ring was taken")],
  },
  // ---- U54 · q_the_keepers_price (Loop 3: Loyal by the Voices, the scroll and the Door; the cost known) ----
  {
    questId: 'q_the_keepers_price',
    outcome: 'keeper',
    name: "Loop 3: Loyal by her arc; the Keeper's way (the Library portal hers to open)",
    classId: CLASS,
    seed: 'quest:keeper:keeper',
    profile: { loop: 3, echoes: ['echo_ilyra_watchword', 'echo_crystal_location', 'echo_archive_door', 'echo_ilyra_bond', 'echo_ilyra_cost'], bestLevel: 17 },
    steps: [...keepersPrice('keeper', 'keeper'), holds({ echo: 'echo_portal_tear' }, "the Keeper's Echo was not granted")],
  },
  {
    questId: 'q_the_keepers_price',
    outcome: 'unbound_hand',
    name: 'Loop 3: Loyal by her arc; never again',
    classId: CLASS,
    seed: 'quest:keeper:never',
    profile: { loop: 3, echoes: ['echo_ilyra_watchword', 'echo_crystal_location', 'echo_archive_door', 'echo_ilyra_bond', 'echo_ilyra_cost'], bestLevel: 17 },
    steps: [...keepersPrice('never', 'unbound_hand'), holds({ not: { echo: 'echo_portal_tear' } }, "the Keeper's Echo was granted")],
  },
  // ---- U54 · q_the_scouts_oath (Loop 3 with the oath: the Peaks, the Outpost, Brak joins, the ride east) ----
  {
    questId: 'q_the_scouts_oath',
    outcome: 'named',
    name: 'Loop 3: Brak joins for the Outpost; the ride east, two ambushes, the Ring; the name said once',
    classId: 'ironclad_warden',
    seed: 'quest:oath',
    profile: { loop: 3, echoes: ['echo_ironclad_oath', 'echo_stone_hide_origin'], bestLevel: 17 },
    steps: [
      ...brakJoins,
      { talk: 'npc_brak', pick: ['ring', 'yes'] }, // the hub: the Ring
      holds({ quest: { id: 'q_the_scouts_oath', stage: 'ride' } }, 'q_the_scouts_oath did not start'),
      { rest: 1 },
      { goto: 'loc_scorched_gate' }, // the jackal
      { goto: 'loc_ash_wind_flats' }, // the harrier
      { goto: 'loc_hearthring' },
      holds({ quest: { id: 'q_the_scouts_oath', stage: 'oath' } }, 'the ride did not reach the Ring'),
      { talk: 'npc_hadda_ironvow', pick: ['word'] },
      done('q_the_scouts_oath', 'named'),
      holds({ all: [{ item: { id: 'item_scouts_whistle' } }, { echo: 'echo_brak_birth_name' }, { flag: 'flag_hearthring_caravan' }] }, 'the whistle, the name or the caravan is missing'),
    ],
  },
  // ---- U54 · q_blood_and_salt (Loop 1 from Brak, the Peaks refused; Loop 3 from Kaelen with the dropped name) ----
  {
    questId: 'q_blood_and_salt',
    outcome: 'fine',
    name: 'Loop 1: the Peaks refused, the salt bought, no word from Kaelen',
    classId: CLASS,
    seed: 'quest:salt:fine',
    steps: [
      ...heartstone('stabilize', 'done_stabilize'),
      { goto: 'loc_ironclad_camp' },
      { talk: 'npc_brak', pick: ['no'] }, // the Peaks refused
      { talk: 'npc_brak', pick: ['yes'] }, // the first offer outranks the Peaks offer
      holds({ quest: { id: 'q_blood_and_salt', stage: 'salt' } }, 'q_blood_and_salt did not start'),
      { goto: 'loc_wayfarers_respite' },
      { until: { item: { id: 'mat_steppe_salt' } }, do: buyer('mat_steppe_salt'), maxSteps: 6 },
      holds({ quest: { id: 'q_blood_and_salt', stage: 'kaelen' } }, 'the salt did not move the quest on'),
      { talk: 'npc_kaelen_stonehand', pick: ['brother', 'only_salt'] },
      { goto: 'loc_ironclad_camp' },
      { talk: 'npc_brak', pick: [] },
      done('q_blood_and_salt', 'fine'),
      holds({ all: [{ echo: 'echo_kaelen_ledger' }, { not: { item: { id: 'mat_steppe_salt' } } }] }, 'the ledger was not granted, or the salt not taken'),
    ],
  },
  {
    questId: 'q_blood_and_salt',
    outcome: 'spoke',
    name: "Loop 3: by Kaelen's door with the dropped name; the whetstone to Brak",
    classId: CLASS,
    seed: 'quest:salt:spoke',
    profile: { loop: 3, echoes: ['echo_brak_birth_name'], bestLevel: 5 },
    steps: saltByKaelen,
  },
  // ---- U54 · q_the_line_he_holds (Loop 3 with his death known: the Peaks, the Outpost, then the truth) ----
  {
    questId: 'q_the_line_he_holds',
    outcome: 'kept_away',
    name: 'Loop 3: told and proved; he stays at the Ring (and leaves the party)',
    classId: 'ironclad_warden',
    seed: 'quest:line:stay',
    profile: { loop: 3, echoes: ['echo_brak_death', 'echo_stone_hide_origin'], bestLevel: 17 },
    steps: [...brakJoins, ...lineHeHolds('stay', 'kept_away'), holds({ all: [{ flag: 'flag_brak_kept_away' }, { not: BRAK_RECRUITED }] }, 'he was not kept away')],
  },
  {
    questId: 'q_the_line_he_holds',
    outcome: 'comes_anyway',
    name: 'Loop 3: told and proved; he comes anyway',
    classId: 'ironclad_warden',
    seed: 'quest:line:come',
    profile: { loop: 3, echoes: ['echo_brak_death', 'echo_stone_hide_origin'], bestLevel: 17 },
    steps: [...brakJoins, ...lineHeHolds('come_anyway', 'comes_anyway'), holds({ all: [{ not: { flag: 'flag_brak_kept_away' } }, BRAK_RECRUITED] }, 'he did not stay in the party')],
  },
  {
    questId: 'q_the_line_he_holds',
    outcome: 'holds_nexus',
    name: "Loop 3: Blood and Salt by Kaelen's door first; told and proved; he holds the Nexus and lives",
    classId: 'ironclad_warden',
    seed: 'quest:line:nexus',
    profile: { loop: 3, echoes: ['echo_brak_death', 'echo_stone_hide_origin', 'echo_brak_birth_name'], bestLevel: 17 },
    steps: [...brakJoins, ...saltByKaelen, ...lineHeHolds('nexus', 'holds_nexus'), holds({ all: [{ echo: 'echo_brak_lives' }, BRAK_RECRUITED] }, 'the Nexus line was not granted')],
  },
];

// ---- Running a proof --------------------------------------------------------------------------------------------------------

/** Rest when HP is under this share and a bed is here (a full rest where listed, else a short one). */
export const TRAINED_REST_BELOW = 0.75;
/** With no bed here, drink the best healing draught carried under this share. */
export const TRAINED_DRINK_BELOW = 0.5;
/** `melee`'s trade rows, except that nothing is ever sold (a quest's materials — the Void Shards — stay in the pack). */
export const TRAINED_TRADE: TradeCfg = { ...MELEE_TRADE, sellBelowGold: 0 };

/**
 * `bot` with `melee`'s character rows in front, in explore mode only (the head of every policy bot's turn, policy.ts `head`):
 * a stat point (STR), an ability point (melee's ranks), better gear, a rest while HP is under TRAINED_REST_BELOW (or, with no
 * bed here, a draught under TRAINED_DRINK_BELOW), then the stall (TRAINED_TRADE). The script's own steps never see these turns.
 */
export function trained(bot: Bot): Bot {
  return {
    ...bot,
    examines: true,
    choose(state, legal, content, memory, ctx) {
      if (state.mode === 'explore') {
        const env: Env = { s: state, legal, content, profile: ctx.profile, n: notesOf(memory, 'trained') };
        const hp = healthFraction(state);
        const rest = legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? legal.find((a) => a.type === 'rest' && a.kind === 'short');
        const mend = hp < TRAINED_REST_BELOW ? (rest ?? (hp < TRAINED_DRINK_BELOW ? bestDrink(env) : undefined)) : undefined;
        const own = pickStat(legal, 'strength') ?? pickUnlock(env, meleeUnlockRank) ?? pickEquip(env) ?? mend ?? pickTrade(env, TRAINED_TRADE);
        if (own !== undefined) return own;
      }
      return bot.choose(state, legal, content, memory, ctx);
    },
  };
}

/** The constructed profile of a Loop 2+ proof. */
function profileOf(script: QuestScript): ReturnType<typeof newProfile> | undefined {
  if (script.profile === undefined) return undefined;
  const p = newProfile(script.seed);
  const { loop, echoes = [], bestLevel } = script.profile;
  const mastery = bestLevel === undefined ? {} : { [script.classId]: { loopsPlayed: loop - 1, mastered: [], endings: [], bestLevel, bestDays: null } };
  return { ...p, loopCounter: loop, echoes: [...echoes], classMastery: mastery };
}

/** Plays one proof on `content`: completed when the script ran out (every assertion held) with no engine error. */
export function runQuestScript(script: QuestScript, content: ContentPack): QuestProof {
  const bot = trained(pathBot(script.steps));
  const profile = profileOf(script);
  const result = runLoop(
    {
      seed: script.seed,
      classId: script.classId,
      bot,
      stopAt: 'max_steps',
      maxSteps: script.maxSteps ?? 6000,
      onFallen: 'stop',
      ...(profile === undefined ? {} : { profile }),
      ...(script.scenario === undefined ? {} : { scenario: script.scenario }),
    },
    content,
  );
  const clean = result.errors.length === 0;
  const completed = result.stopReason === 'script_done' && clean;
  const detail = completed
    ? `${script.questId} ${script.outcome} in ${result.steps} steps (level ${result.final.level}, day ${result.final.day})`
    : result.stopReason === 'script_assert'
      ? `script_assert: ${result.stopMessage ?? ''}`
      : `${result.stopReason}${clean ? '' : `: ${result.errors[0]?.message ?? ''}`} (final ${result.final.mode} at ${result.final.locationId}, level ${result.final.level}, day ${result.final.day})`;
  return { script, completed, detail, result };
}

// ---- `npm run sim -- quest` ---------------------------------------------------------------------------------------------------

/**
 * `npm run sim -- quest [<questId>…] [--pack <spec>] [--verbose]` (src/sim/cli.ts): runs the quest proofs (all, or those of the
 * named quests) on the pack (default `real`; any spec the CLI's `--pack` takes) and prints one line each. Exit 0 = every proof
 * completed; 1 = one failed; 2 = a usage error.
 */
export async function questMain(argv: readonly string[], write: (line: string) => void, loadPack: (spec: string) => Promise<ContentPack>): Promise<number> {
  const ids: string[] = [];
  let packSpec = 'real';
  let verbose = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--verbose') verbose = true;
    else if (arg === '--pack') packSpec = argv[++i] ?? '';
    else if (arg.startsWith('--')) {
      write(`sim quest: unknown option ${arg}`);
      return 2;
    } else ids.push(arg);
  }
  const unknown = ids.filter((id) => !QUEST_SCRIPTS.some((s) => s.questId === id));
  if (unknown.length > 0) {
    write(`sim quest: no script for ${unknown.join(', ')} (scripted: ${[...new Set(QUEST_SCRIPTS.map((s) => s.questId))].join(', ')})`);
    return 2;
  }
  const scripts = ids.length === 0 ? QUEST_SCRIPTS : QUEST_SCRIPTS.filter((s) => ids.includes(s.questId));
  let content: ContentPack;
  try {
    content = await loadPack(packSpec);
  } catch (e) {
    write(`sim quest: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  let failed = 0;
  for (const script of scripts) {
    const proof = runQuestScript(script, content);
    if (!proof.completed) failed += 1;
    write(`${proof.completed ? 'ok  ' : 'FAIL'} ${script.questId} · ${script.name} — ${proof.detail}`);
    if (verbose && !proof.completed) for (const e of proof.result.errors.slice(0, 3)) write(`       error @${e.step}: ${e.message}`);
  }
  write(`sim quest: ${scripts.length - failed}/${scripts.length} proof(s) completed`);
  return failed === 0 ? 0 : 1;
}
