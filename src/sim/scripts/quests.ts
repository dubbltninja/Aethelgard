// Quest proofs (PLAN §7.8, DESIGN §13.4; U52): a `pathBot` script per quest — one per outcome that something later reads (the
// Crystal given or kept, each Heartstone path, the shards given or refused, the scroll to Ilyra or to Nyx) — that completes it
// on the real pack. `npm run sim -- quest [<questId>…] [--pack real] [--verbose]` runs them; tests/unit/sim/questScripts.test.ts
// runs them in CI. The quest units U53–U59 append theirs to `QUEST_SCRIPTS` (U53: the four faction chains, two outcomes
// each, on constructed Loop 2+ profiles that hold the standing Echo opening the chain; U55: Nyx's and Dask's arcs, every
// outcome, with the companion recruited on the way — the bond Echo starts them at 25; U56: Mireya's and Caelum's alike,
// Caelum's inside the Before by the Nexus door).
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
import { dayOf, type Action, type ContentPack, type GameState } from '@engine/index';
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
  { talk: 'npc_ilyra', pick: ['give', 'no'] }, // U84 (REPORT U79 #4): the scroll is asked for in the same talk; taken on its own talk below
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

/** U55: from Loop 2 Nyx's first talk of a loop is her déjà vu (STORY §5.2, the payoff band); "Nothing more." clears it. */
const nyxDejaVu: ScriptStep = { talk: 'npc_nyx', pick: ['nothing'] };

/**
 * q_void_shards up to the shards in hand: accept, the Hollow's loose shard and its Stalkers (one fixed group per arrival).
 * `loop2`: the déjà vu is cleared before the legacy offer (U55).
 */
const shardsGathered = (loop2 = false): ScriptStep[] => [
  { goto: 'loc_chasm_of_whispers' },
  ...(loop2 ? [nyxDejaVu] : []),
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
  ...shardsGathered(true),
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
  ...shardsGathered(true),
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
  { talk: 'npc_ilyra', pick: ['give', 'no'] }, // U84: the scroll's ask in the same talk, taken on its own talk below
  done('q_echo_crystal', 'given'),
  { talk: 'npc_ilyra', pick: [] }, // scene_ilyra_crystal_deciphered
  { talk: 'npc_ilyra', pick: ['yes'] }, // the scroll offer wins the tie
  { talk: 'npc_ilyra', pick: ['come'] }, // the hub: she joins
  holds({ all: [ILYRA_RECRUITED, { loyalty: { companion: 'ilyra', min: 25 } }] }, 'Ilyra did not join at the bond loyalty'),
];

/** The scroll (accepted already) from the Archivist's carrel, delivered to Ilyra (a loyalty beat, now that she is in the party). */
const scrollToIlyra: ScriptStep[] = [...scrollFetched.slice(1), { goto: 'loc_whispering_ruins' }, { talk: 'npc_ilyra', pick: ['give'] }, done('q_lost_scroll', 'to_ilyra')];

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

/** The Keeper's table: the Ledger accepted first (from Dray's hub while both offers stand, U34f), then the telling and `choiceId`. */
export const keepersPrice = (choiceId: 'keeper' | 'never', stage: string): ScriptStep[] => [
  ...ilyraLoyalLoop3,
  { goto: 'loc_shattered_library' },
  { talk: 'npc_ansel_dray', pick: ['ledger', 'yes'] }, // scene_dray_offers → q_keepers_ledger's offer
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

// ---- U55: Nyx's and Dask's arcs (Loop 2+; the bond Echo starts the companion at 25, DESIGN §12.5) -------------------------------

/** A bot that passes time in place (`wait`, else a short rest): for an `until` that waits for a watch. (U54 has a plain `waiter`.) */
const restingWaiter: Bot = {
  name: 'waiter',
  choose: (_s, legal) => legal.find((a) => a.type === 'wait') ?? legal.find((a) => a.type === 'rest' && a.kind === 'short') ?? (legal[0] as Action),
};
/** Pass time here until `when` holds (a watch, at most a day). */
const waitFor = (when: Condition): ScriptStep => ({ until: when, do: restingWaiter, maxSteps: 12 });
/**
 * Before a `talk` at a camp: a `goto` of the place one stands in walks through the camp conversation a rest just opened
 * (a full rest with a companion in the party opens one, DESIGN §12.7 — `trained` rests when HP is low, and a `talk` would
 * take the open scene for its own).
 */
const settle = (locationId: `loc_${string}`): ScriptStep => ({ goto: locationId });

/**
 * Loop 2 with the bond: the Crystal kept, the shards given (Weavers +30), Nyx walking beside you from the lip, her first
 * quest taken, a fourth Shard from the Scar Shelf, the reading at the Chasm's edge at night.
 */
const nyxShardRead: ScriptStep[] = [
  ...crystalToIlyra(true),
  { talk: 'npc_ilyra', pick: ['keep', 'leave'] },
  done('q_echo_crystal', 'kept'),
  ...shardsGathered(true),
  { talk: 'npc_nyx', pick: ['yes'] },
  done('q_void_shards', 'given'),
  settle('loc_chasm_of_whispers'),
  { talk: 'npc_nyx', pick: ['yes'] }, // scene_nyx_walk_with_me (ahead of her offers)
  holds({ all: [{ companion: { id: 'nyx' } }, { loyalty: { companion: 'nyx', min: 25 } }] }, 'Nyx was not recruited at the bond start'),
  settle('loc_chasm_of_whispers'),
  { talk: 'npc_nyx', pick: ['yes'] }, // scene_nyx_tears_offer
  holds({ quest: { id: 'q_tears_of_the_breach', stage: 'shard_at_night' } }, 'q_tears_of_the_breach did not start'),
  { rest: 1 },
  { goto: 'loc_scar_shelf' },
  takeAll,
  holds({ item: { id: 'item_void_shard' } }, 'the Shelf had no shard'),
  { goto: 'loc_chasm_of_whispers' },
  waitFor({ watch: 'night' }),
  holds({ quest: { id: 'q_tears_of_the_breach', stage: 'read' } }, 'the night at the edge with a Shard did not open the reading'),
  settle('loc_chasm_of_whispers'),
  { talk: 'npc_nyx', pick: ['whose'] },
  done('q_tears_of_the_breach', 'unanswered'),
  holds({ all: [{ echo: 'echo_shard_moments' }, { item: { id: 'item_void_shard' } }] }, 'the Shard moments or the Shard were not paid'),
];

/** Then her second quest: she goes ahead; the Veil by the Stair and the Orchard, fleeing what can be fled; the crater. */
const nyxAtTheCrater: ScriptStep[] = [
  ...nyxShardRead,
  { rest: 1 },
  settle('loc_chasm_of_whispers'),
  { talk: 'npc_nyx', pick: ['yes'] }, // scene_nyx_dark_between_offer
  holds({ quest: { id: 'q_the_dark_between', stage: 'asked_in' } }, 'q_the_dark_between did not start'),
  { fight: 'flee' },
  { goto: 'loc_where_she_fell' },
  holds({ quest: { id: 'q_the_dark_between', stage: 'names' } }, 'the names on the rim did not open the unmasking'),
];

/** The unmasking at the crater, decided by `choiceId`. */
const nyxUnmasked = (choiceId: 'safe' | 'choir', stage: string): ScriptStep[] => [
  ...nyxAtTheCrater,
  { talk: 'npc_nyx', pick: ['nine', 'tyrant', choiceId] },
  done('q_the_dark_between', stage),
  holds({ all: [{ echo: 'echo_nyx_is_of_the_nine' }, { echo: 'echo_litany_verse_8' }, { echo: 'echo_tyrant_name' }] }, 'the unmasking did not grant its Echoes'),
];

/** Her secret kept (Loyal: 25 + the stages + the choice), her third quest from the lip, the plan at the Hollow, `answer`ed. */
const nyxPlanAnswered = (answer: 'agreed' | 'truth' | 'refused', stage: string): ScriptStep[] => [
  ...nyxUnmasked('safe', 'kept'),
  holds({ loyalty: { companion: 'nyx', min: 50 } }, 'Nyx is not Loyal after her second quest'),
  { goto: 'loc_chasm_of_whispers' },
  { talk: 'npc_nyx', pick: ['yes'] }, // scene_nyx_undo_offer
  holds({ quest: { id: 'q_what_she_would_undo', stage: 'plan' } }, 'q_what_she_would_undo did not start'),
  { goto: 'loc_voidscar_hollow' },
  { talk: 'npc_nyx', pick: [answer] },
  done('q_what_she_would_undo', stage),
  holds({ echo: 'echo_what_she_would_undo' }, 'her plan was not heard'),
];

/** Loop 2's road east: the Crystal, the scroll (Ilyra asks first from Loop 2: given), the heartbeat, the Heartstone `choiceId` (U56: either fragment for Mireya's dam). */
const loop2RoadEastBy = (choiceId: 'stabilize' | 'exploit' | 'destroy', stage: string): ScriptStep[] => [
  ...crystalGiven(),
  ...scrollFetched,
  { goto: 'loc_whispering_ruins' },
  { talk: 'npc_ilyra', pick: ['give'] },
  done('q_lost_scroll', 'to_ilyra'),
  holds({ quest: { id: 'q_echoing_heartbeat', stage: 'descend' } }, 'q_echoing_heartbeat did not start after two quests'),
  { goto: 'loc_sunken_archives' },
  { type: 'move', to: 'loc_heartstone_depths' },
  holds({ quest: { id: 'q_echoing_heartbeat', stage: 'choose' } }, 'the Depths did not open the choice'),
  choose(choiceId),
  done('q_echoing_heartbeat', stage),
];
/** Loop 2's road east with the Heartstone stabilized. */
const loop2RoadEast: ScriptStep[] = loop2RoadEastBy('stabilize', 'done_stabilize');

/**
 * Loop 2: the Highlands by the Depths (the legacy road east); Dask met at the Pass — recruited, his first quest taken — his
 * three moments, the whole sentence back at the Pass.
 */
const daskSentence: ScriptStep[] = [
  ...loop2RoadEast,
  { fight: 'flee' },
  { goto: 'loc_shimmering_pass' },
  { talk: 'npc_dask', pick: ['who', 'what_do_i_do', 'come', 'where'] }, // scene_dask_introduction
  holds({ all: [{ companion: { id: 'dask' } }, { quest: { id: 'q_the_flickering_man', stage: 'spires' } }] }, 'Dask was not recruited, or his quest did not start'),
  { goto: 'loc_aetherium_spires' },
  { talk: 'npc_dask', pick: ['listen'] },
  holds({ quest: { id: 'q_the_flickering_man', stage: 'plateau' } }, 'the Spires moment did not count'),
  { goto: 'loc_sky_whisper_plateau' },
  { talk: 'npc_dask', pick: ['listen'] },
  holds({ quest: { id: 'q_the_flickering_man', stage: 'nexus' } }, 'the Plateau moment did not count'),
  { goto: 'loc_chronos_nexus' },
  { talk: 'npc_dask', pick: ['listen'] },
  holds({ quest: { id: 'q_the_flickering_man', stage: 'sentence' } }, 'the Nexus moment did not count'),
  { goto: 'loc_shimmering_pass' },
  { talk: 'npc_dask', pick: [] }, // scene_dask_flickering_man_sentence
  done('q_the_flickering_man', 'heard'),
  holds({ all: [{ echo: 'echo_flickering_man' }, { item: { id: 'item_dasks_scout_badge' } }] }, 'the whole sentence or the badge was not paid'),
];

/**
 * U58: a `talk` step entered while a scene is open adopts it (pathBot.ts): the Tyrant's first words on arriving at the Apex
 * (`scene_tyrant_first_words`; Fight, Listen or Leave), and the Resolution's words once it is spared (`scene_ending_vigil` /
 * `_mending` / `_unbound`: the ending itself, or the way back to the outcomes).
 */
const firstWords = (pick: 'fight' | 'listen' | 'leave'): ScriptStep => ({ talk: 'cr_chronos_tyrant_unveiled', pick: [pick] });
const resolutionWords = (...picks: string[]): ScriptStep => ({ talk: 'cr_chronos_tyrant_unveiled', pick: picks });

/** One turn of the Tyrant's communion: Commune, Listen, the best honest answer of the question, else Resist; the Resolution's `outcome`. */
const communing = (outcome: string): Bot => ({
  name: 'communing',
  choose: (state, legal, content) => {
    const commune = legal.filter((a): a is Extract<Action, { type: 'commune' }> => a.type === 'commune');
    const pick = (act: Extract<Action, { type: 'commune' }>['act']) => commune.find((a) => a.act === act);
    const resolution = commune.find((a) => a.act === 'speak' && a.answerId === outcome);
    if (resolution !== undefined && state.flags['flag_tyrant_spared'] === true) return resolution;
    const toggle = pick('toggle') ?? pick('listen');
    if (toggle !== undefined) return toggle;
    const boss = state.combat?.enemies.find((e) => e.alive && content.creatures[e.refId]?.communion !== undefined);
    const spec = boss === undefined ? undefined : content.creatures[boss.refId]?.communion;
    const gain = (answerId: string | undefined): number => {
      for (const m of spec?.movements ?? []) for (const q of m.questions) for (const ans of q.answers) if (ans.id === answerId) return ans.lie ? -99 : ans.resolve;
      return -99;
    };
    const speak = commune.filter((a) => a.act === 'speak').sort((a, b) => gain(b.answerId) - gain(a.answerId))[0];
    if (speak !== undefined && gain(speak.answerId) >= 0) return speak;
    return pick('resist') ?? legal.find((a) => a.type === 'guard') ?? (legal[0] as Action);
  },
});

/** U81a (D-123): the communion opened (Commune, else Listen), then the Breach-anchor offered as soon as it is listed; Guard meanwhile. */
const anchorShown: Bot = {
  name: 'anchor-shown',
  choose: (_s, legal) => {
    const commune = legal.filter((a): a is Extract<Action, { type: 'commune' }> => a.type === 'commune');
    return (
      commune.find((a) => a.act === 'offer' && a.itemId === 'item_breach_anchor') ??
      commune.find((a) => a.act === 'toggle') ??
      commune.find((a) => a.act === 'listen') ??
      legal.find((a) => a.type === 'continue') ??
      legal.find((a) => a.type === 'guard') ??
      (legal[0] as Action)
    );
  },
};

/**
 * Loop 3 with the bond and the verses: Dask's sentence (loyalty 25 + 25: Loyal), his third quest taken at the Pass, Support
 * stance, the loose way to the Apex, the communion carried through Movement III with every answer held, the tear left open
 * (`pass_into_before`), then his choice at the Apex.
 */
const daskAtTheApex: ScriptStep[] = [
  ...daskSentence,
  holds({ loyalty: { companion: 'dask', min: 50 } }, 'Dask is not Loyal after his first quest'),
  settle('loc_shimmering_pass'),
  { talk: 'npc_dask', pick: ['yes'] }, // scene_dask_last_instant_offer
  holds({ quest: { id: 'q_the_last_instant', stage: 'ask_it' } }, 'q_the_last_instant did not start'),
  settle('loc_shimmering_pass'),
  { type: 'setStance', stance: 'support' },
  { rest: 1 },
  { goto: 'loc_aetherium_spires' },
  { goto: 'loc_chronos_nexus' },
  { rest: 1 },
  // the step onto the Apex is an exact move: its first words open on arrival (U58), Listen starts the Unveiled Tyrant's fight
  // with the communion open, and a `goto` would play it; the Resolution's words (U58) are turned back to the outcomes
  { type: 'move', to: 'loc_temporal_breach_apex' },
  firstWords('listen'),
  { until: { flag: 'flag_tyrant_spared' }, do: communing('pass_into_before'), maxSteps: 120 },
  resolutionWords('hold', 'turn_back'),
  { until: { not: { quest: { id: 'q_the_last_instant', stage: 'ask_it' } } }, do: communing('pass_into_before'), maxSteps: 4 },
  holds({ quest: { id: 'q_the_last_instant', stage: 'gathered' } }, 'the communion did not carry the ask'),
];

// ---- U56: Mireya's and Caelum's arcs (Loop 2+; the bond Echo starts the companion at 25, DESIGN §12.5) ---------------------------

const MIREYA_RECRUITED: Condition = { companion: { id: 'mireya', state: 'recruited' } };
const CAELUM_RECRUITED: Condition = { companion: { id: 'caelum', state: 'recruited' } };
/** The echo's own hour inside the Before (D-102): a short rest at the Garret passes one watch. */
const shortRest: Action = { type: 'rest', kind: 'short' };

/**
 * Loop 2: the road east (the Heartstone stabilized), the Glowfen by the Glowlands (fights fled where they can be); Mireya's first quest from her stall — the elders' telling,
 * her ask (she joins), the moss and the root from Fennick, the tending with steady hands.
 */
const mireyaTended: ScriptStep[] = [
  ...loop2RoadEast,
  { fight: 'flee' },
  { goto: 'loc_lanternreed' },
  { talk: 'npc_mireya', pick: ['yes', 'come'] }, // scene_mireya_lantern_offer: the elders; she comes
  holds({ all: [MIREYA_RECRUITED, { quest: { id: 'q_lantern_in_the_reeds', stage: 'gather' } }, { echo: 'echo_glowlands_leak' }] }, 'Mireya was not recruited after stage 1, or the elders did not speak'),
  { until: { item: { id: 'item_glow_moss', count: 3 } }, do: buyer('item_glow_moss'), maxSteps: 12 },
  { until: { item: { id: 'item_antidote_root', count: 2 } }, do: buyer('item_antidote_root'), maxSteps: 12 },
  { until: { quest: { id: 'q_lantern_in_the_reeds', stage: 'tend' } }, do: waiter, maxSteps: 2 },
  settle('loc_lanternreed'),
  { talk: 'npc_mireya', pick: ['hold'] }, // scene_mireya_tending
  done('q_lantern_in_the_reeds', 'tended'),
  holds({ all: [{ flag: 'flag_lanternreed_trusts' }, { item: { id: 'item_fenlight_salve', count: 3 } }] }, 'Lanternreed does not trust you, or the salve was not paid'),
];

/** Then her second quest (Loop 2, loyalty 25 with the bond): the Maze, the Pool, the Listen, her name. */
const mireyaHeard: ScriptStep[] = [
  ...mireyaTended,
  holds({ loyalty: { companion: 'mireya', min: 25 } }, 'Mireya is not at 25 after her first quest'),
  settle('loc_lanternreed'),
  { talk: 'npc_mireya', pick: ['yes'] }, // scene_mireya_light_offer
  holds({ quest: { id: 'q_what_the_light_takes', stage: 'forbidden' } }, 'q_what_the_light_takes did not start'),
  { goto: 'loc_sporelight_shallows' },
  holds({ quest: { id: 'q_what_the_light_takes', stage: 'pool' } }, 'the Reed Maze did not count'),
  { goto: 'loc_breathing_pool' },
  holds({ quest: { id: 'q_what_the_light_takes', stage: 'listen' } }, 'the Pool was not reached'),
  settle('loc_breathing_pool'),
  { talk: 'npc_mireya', pick: ['listen', 'sallow'] }, // scene_mireya_breathing_pool
  done('q_what_the_light_takes', 'heard'),
  holds({ all: [{ echo: 'echo_breathing_pool' }, { echo: 'echo_litany_verse_6' }] }, 'the Pool did not grant its Echoes'),
];

/** Her third (Loyal after the Pool): the ask at Lanternreed, the village asked, the choice at the Pool (`road`: the Heartstone's fragments, D-052). */
const mireyaChose = (choiceId: 'dam' | 'dam_dead' | 'run', stage: string, road: ScriptStep[] = loop2RoadEast): ScriptStep[] => [
  ...road,
  ...mireyaHeard.slice(loop2RoadEast.length),
  holds({ loyalty: { companion: 'mireya', min: 50 } }, 'Mireya is not Loyal after her second quest'),
  { goto: 'loc_lanternreed' },
  { talk: 'npc_mireya', pick: ['yes'] }, // scene_mireya_preserve_offer
  holds({ quest: { id: 'q_preserve_or_heal', stage: 'dam_or_run' } }, 'q_preserve_or_heal did not start'),
  { goto: 'loc_breathing_pool' },
  holds({ quest: { id: 'q_preserve_or_heal', stage: 'choose' } }, 'the Pool did not open the choice'),
  settle('loc_breathing_pool'),
  { talk: 'npc_mireya', pick: ['ask_them', choiceId] }, // scene_mireya_preserve_or_heal
  done('q_preserve_or_heal', stage),
];

/**
 * Loop 2's road east, then into the Before by the Nexus door (the Lens from the orrery, verse I held), to the Garret: Last Bell at noon (two
 * nights, one doze), the noon message taken, the Plaza at noon (Aulde's laugh on arrival), the honest answer, he joins.
 */
const caelumJoined: ScriptStep[] = [
  ...loop2RoadEast,
  { fight: 'flee' },
  { goto: 'loc_chronos_nexus' },
  takeAll,
  holds({ item: { id: 'item_chronos_lens' } }, 'the Lens was not at the Nexus'),
  { type: 'move', to: 'loc_silver_gate' },
  holds({ all: [{ beforeDay: 1 }, { echo: 'echo_before_route' }] }, 'the Breach-door did not open First Bell'),
  // the Before is never walked through by a `goto` (bots/shared.ts `routes`): one edge at a time, each a `goto` so a fight
  // fled back the way you came (the early hound, the Circle's hounds) is walked up to again
  { goto: 'loc_outer_walks' },
  { goto: 'loc_apprentices_garret' },
  { rest: 2 },
  holds({ beforeDay: 3 }, 'two nights at the Garret did not bring Last Bell'),
  shortRest,
  holds({ watch: 'day' }, 'a doze at the Garret did not bring noon'),
  { talk: 'npc_caelum', pick: ['yes'] }, // scene_caelum_errand_offer
  holds({ quest: { id: 'q_the_apprentices_errand', stage: 'cross' } }, 'q_the_apprentices_errand did not start'),
  { goto: 'loc_plaza_of_bells' },
  holds({ all: [{ quest: { id: 'q_the_apprentices_errand', stage: 'spire_yard' } }, { echo: 'echo_litany_verse_5' }] }, 'the Plaza at noon did not reach the Yard, or Aulde did not laugh'),
  { talk: 'npc_caelum', pick: ['honest', 'walk'] }, // scene_caelum_spire_yard
  done('q_the_apprentices_errand', 'joined'),
  holds(CAELUM_RECRUITED, 'Caelum did not join'),
];

/** Then the boy's quest: what you know; dusk at the Garret; the Gate; the crossing, `choiceId`. */
const caelumAtTheDoor = (choiceId: 'come' | 'stay', stage: string): ScriptStep[] => [
  ...caelumJoined,
  { goto: 'loc_apprentices_garret' },
  { talk: 'npc_caelum', pick: ['show'] }, // scene_caelum_boy_offer
  holds({ quest: { id: 'q_a_boy_from_a_doomed_city', stage: 'door' } }, 'q_a_boy_from_a_doomed_city did not start'),
  shortRest,
  holds({ watch: 'dusk' }, 'a second doze did not bring dusk'),
  { goto: 'loc_outer_walks' },
  { goto: 'loc_silver_gate' },
  holds({ quest: { id: 'q_a_boy_from_a_doomed_city', stage: 'glimpse' } }, 'the Gate after dusk did not open the door'),
  { talk: 'npc_caelum', pick: ['five_hundred', choiceId] }, // scene_caelum_crossing
  done('q_a_boy_from_a_doomed_city', stage),
];

/**
 * Loop 3 with the bond and the verses: crossed (Loyal: 25 + the stages + the beats), out through the door to the Nexus, his
 * third quest taken there, Support stance, the Apex, the communion carried through with him beside you (Masque's question
 * his), the tear left open, then the one thing at the Apex.
 */
const caelumAtTheApex: ScriptStep[] = [
  ...caelumAtTheDoor('come', 'crossed'),
  { type: 'move', to: 'loc_chronos_nexus' },
  holds({ all: [CAELUM_RECRUITED, { echo: 'echo_caelum_unanchored' }, { not: { beforeDay: 3 } }] }, 'Caelum did not come through the door'),
  holds({ loyalty: { companion: 'caelum', min: 50 } }, 'Caelum is not Loyal after crossing'),
  settle('loc_chronos_nexus'),
  { talk: 'npc_caelum', pick: ['yes'] }, // scene_caelum_sin_offer
  holds({ quest: { id: 'q_his_masters_sin', stage: 'let_him' } }, 'q_his_masters_sin did not start'),
  settle('loc_chronos_nexus'),
  { type: 'setStance', stance: 'support' },
  { rest: 1 },
  settle('loc_chronos_nexus'), // the camp conversation the rest opened
  // the step onto the Apex is an exact move: its first words open on arrival (U58), Listen starts the Unveiled Tyrant's fight
  // with the communion open, and a `goto` would play it; the Resolution's words (U58) are turned back to the outcomes
  { type: 'move', to: 'loc_temporal_breach_apex' },
  firstWords('listen'),
  { until: { flag: 'flag_tyrant_spared' }, do: communing('pass_into_before'), maxSteps: 120 },
  resolutionWords('hold', 'turn_back'),
  { until: { not: { quest: { id: 'q_his_masters_sin', stage: 'let_him' } } }, do: communing('pass_into_before'), maxSteps: 4 },
  holds({ quest: { id: 'q_his_masters_sin', stage: 'sorry' } }, 'the communion did not carry him to the one thing'),
];

/** U56: the communion's answers for `q_his_masters_sin` (U55's list, verse V the Yard's and verse VI the Pool's held too), with verse I for the door and the bond. */
export const SIN_ECHOES: readonly `echo_${string}`[] = ['echo_litany_verse_1', 'echo_caelum_bond', 'echo_tyrant_speaks', 'echo_apex_resonance', 'echo_tyrant_jailer', 'echo_thirtieth_dawn', 'echo_seven_wayfinders', 'echo_tyrant_never_struck', 'echo_litany_verse_2', 'echo_litany_verse_3', 'echo_litany_verse_4', 'echo_litany_verse_6', 'echo_litany_verse_7', 'echo_hallow_said_stop', 'echo_ritual_inevitable'];

// ---- The proofs -------------------------------------------------------------------------------------------------------------


// ---- U57: the regional quests (Loop 2 unless the quest is Loop 1 open; the hooks are the regions' events) ----------------------

/** An interact event's button (a place's `trigger: 'interact'` event the quest asks for). */
const interact = (eventId: `ev_${string}`): Action => ({ type: 'interact', eventId });
const goOn: Action = { type: 'continue' };

/**
 * Loop 2 with the Door of Pages known and the Warden of Waters' name (`echo_rhune_choice`: the Deep's boss gives up the key
 * without a fight): Ilyra's lantern from the Archives, the flooded stair's bell (the discovery: follow the ringing down), the
 * Reach's dry room, the Scriptorium's guard, the Deep.
 */
const bellVaultReached: ScriptStep[] = [
  { goto: 'loc_sunken_archives' },
  takeAll, // Ilyra's lantern: the Reach's dark gate
  { goto: 'loc_drowned_stair' },
  interact('ev_stair_bell'),
  choose('follow'),
  holds({ quest: { id: 'q_bell_vault', stage: 'flooded_stair' } }, 'the flooded stair did not start q_bell_vault'),
  { goto: 'loc_lamplighters_rest' },
  { rest: 1 },
  { fight: 'flee' }, // the Scriptorium's guard scatters when fled (D-110: the Reach at a carry-over start); the Deep's Warden is bypassed
  { goto: 'loc_bell_wardens_deep' },
  holds({ quest: { id: 'q_bell_vault', stage: 'ring_bells' } }, 'the Deep was not reached'),
  interact('ev_deep_bells'),
];

/** The bells rung in Silverwood's order by `picks` (the puzzle, or an Echo's line): the water drops, the Vault's rewards. */
const bellsRung = (picks: readonly string[]): ScriptStep[] => [
  ...bellVaultReached,
  ...picks.map(choose),
  done('q_bell_vault', 'water_drops'),
  holds({ all: [{ echo: 'echo_bell_vault' }, { echo: 'echo_archive_door' }, { item: { id: 'item_bell_vault_key' } }, { item: { id: 'item_glyphbound_lantern', count: 2 } }] }, 'the Vault did not pay'),
];

/**
 * Loop 2 with the scouts' words and the trail-signs (the Peaks and the Scorched Gate open): the Camp, the Peaks, the Outpost (its Golems), Hearthring;
 * Hadda's ask; then (`withMark`) back to the Emberforge for Borin's mark; the Orchard (the first ambush on arrival), the Cairns
 * (the second), the ember-bowl there, Hadda's waystones.
 */
const boneRoad = (withMark: boolean): ScriptStep[] => [
  { fight: 'flee' }, // the road's fights fled where they can be (the Flats at a carry-over start, D-110); the ambushes hold and are fought
  { goto: 'loc_ironclad_camp' },
  { rest: 1 },
  { goto: 'loc_blighted_outpost' }, // the Golems
  { goto: 'loc_emberforge' }, // the camp next door: whole for the Steppe
  { rest: 1 },
  { goto: 'loc_hearthring' },
  { talk: 'npc_hadda_ironvow', pick: ['yes'] }, // scene_hadda_bone_road_offer
  holds({ quest: { id: 'q_bone_road', stage: 'ride_ahead' } }, 'q_bone_road did not start'),
  ...(withMark
    ? [
        { goto: 'loc_emberforge' },
        { talk: 'npc_borin_stonefist', pick: [] }, // scene_borin_forge_mark
        holds({ item: { id: 'item_borins_forge_mark' } }, 'Borin did not hand over the mark'),
        { rest: 1 },
      ]
    : [{ rest: 1 }]),
  { goto: 'loc_bone_orchard' }, // the first ambush: the stage starts it on arrival
  holds({ all: [{ quest: { id: 'q_bone_road', stage: 'storm_cairn' } }, { killed: { id: 'cr_wildling_brute', count: 2 } }] }, 'the Brutes did not fall at the Orchard'),
  { goto: 'loc_hearthring' },
  { rest: 1 },
  { goto: 'loc_stormgate_cairns' }, // the second
  holds({ all: [{ quest: { id: 'q_bone_road', stage: 'read_inscription' } }, { killed: { id: 'cr_void_touched_stalker', count: 2 } }] }, 'the Stalkers did not fall at the Cairns'),
  interact('ev_hallows_ember_bowl'),
  goOn, // the bowl, the verse, the ember
  goOn,
  holds(
    {
      all: [
        { quest: { id: 'q_bone_road', stage: 'return' } },
        { echo: 'echo_litany_verse_4' },
        { echo: 'echo_hallows_ember' },
        withMark ? { echo: 'echo_iron_that_does_not_wish' } : { not: { echo: 'echo_iron_that_does_not_wish' } },
      ],
    },
    'the inscription was not read as it should be',
  ),
  { goto: 'loc_hearthring' },
  { talk: 'npc_hadda_ironvow', pick: [] }, // scene_hadda_bone_road_report
  done('q_bone_road', 'done'),
  holds({ all: [{ echo: 'echo_steppe_waystones' }, { item: { id: 'item_salt_wind_cloak' } }] }, 'Hadda did not pay'),
];

/**
 * Loop 2 with the Hollow's path (the bridge opens without Nyx's pact): the Hollow's Stalkers, the seam in the curtain (the
 * discovery: put the light out and go down), the Mouth, the Stair, the Choir; Ysmay after.
 */
const lightlessStair: ScriptStep[] = [
  { goto: 'loc_chasm_of_whispers' },
  { rest: 1 }, // the cold camp on the lip
  { goto: 'loc_voidscar_hollow' },
  interact('ev_hollow_curtain_stair'),
  goOn,
  choose('go_down'),
  holds({ quest: { id: 'q_lightless_stair', stage: 'descend' } }, "the Hollow's curtain did not start q_lightless_stair"),
  { fight: 'flee' }, // the Veil's groups scatter when fled; Blind sits on the first turn here
  { goto: 'loc_stair_of_unmaking' },
  holds({ quest: { id: 'q_lightless_stair', stage: 'halfway' } }, 'the Stair was not reached'),
  { goto: 'loc_sanctum_of_threads' },
  done('q_lightless_stair', 'choir'),
  holds({ echo: 'echo_lightless_stair' }, 'the Choir did not light the stair'),
  { fight: 'melee' },
  { talk: 'npc_ysmay', pick: [] }, // scene_ysmay_lightless_stair
  holds({ flag: 'flag_scene_done_scene_ysmay_lightless_stair' }, 'Ysmay did not speak'),
];

/**
 * Loop 2 (an elf: two Glow Moss in the kit) with the Heartstone's path: the Depths, the Highlands, the Glowlands (its moss), the
 * Glowfen; Wen's ask at Lanternreed, the Shallows' boat raised, the report.
 */
const drownedLantern: ScriptStep[] = [
  { fight: 'flee' },
  { goto: 'loc_veridian_glowlands' },
  takeAll, // the legacy Glow Moss
  { goto: 'loc_lanternreed' },
  { talk: 'npc_elder_wen', pick: ['yes'] }, // scene_wen_drowned_lantern_offer
  holds({ quest: { id: 'q_the_drowned_lantern', stage: 'reed_maze' } }, 'q_the_drowned_lantern did not start'),
  { rest: 1 },
  { goto: 'loc_sporelight_shallows' },
  holds({ quest: { id: 'q_the_drowned_lantern', stage: 'raise_boat' } }, 'the Reed Maze was not reached'),
  holds({ item: { id: 'item_glow_moss' } }, 'no Glow Moss for the wick'),
  interact('ev_shallows_lantern_boat'),
  choose('raise'),
  holds({ quest: { id: 'q_the_drowned_lantern', stage: 'return' } }, 'the boat was not raised'),
  { goto: 'loc_lanternreed' },
  { talk: 'npc_elder_wen', pick: [] }, // scene_wen_drowned_lantern_report
  done('q_the_drowned_lantern', 'done'),
  holds({ all: [{ flag: 'flag_lanternreed_trusts' }, { item: { id: 'item_stiltwalkers_boots' } }] }, 'Wen did not pay, or Lanternreed does not trust you'),
];

/** The Plateau's stair (the discovery), the Sentinel, the climb, the look east. */
const highMarkClimbed: ScriptStep[] = [
  { goto: 'loc_sky_whisper_plateau' },
  { fight: 'melee' },
  takeAll, // the Talisman: the thin air
  interact('ev_plateau_stair'),
  goOn,
  choose('climb'),
  holds({ quest: { id: 'q_high_mark', stage: 'markers' } }, 'the stair in the wind did not start q_high_mark'),
  { rest: 1 }, // the wind-shelter
  { fight: 'flee' }, // the Stair's Gale Kites (band 12) scatter when fled, at 10 % HP
  { goto: 'loc_windward_stair' },
  holds({ quest: { id: 'q_high_mark', stage: 'look_east' } }, 'the Stair was not climbed'),
  interact('ev_stair_look_east'),
  goOn,
  done('q_high_mark', 'seen'),
  holds({ all: [{ echo: 'echo_breach_clock' }, { echo: 'echo_high_mark' }, { item: { id: 'item_sky_whisper_cloak' } }] }, 'the High Mark did not pay'),
];

/** Loop 2 with the Heartstone's path: the Depths, the Pass (Dask's introduction, then his High Mark), the Plateau, the Stair. */
const highMarkByDask: ScriptStep[] = [
  { fight: 'melee' },
  { goto: 'loc_shimmering_pass' },
  { talk: 'npc_dask', pick: ['who', 'what_do_i_do', 'come', 'later'] }, // scene_dask_introduction: he joins
  { talk: 'npc_dask', pick: ['yes'] }, // scene_dask_high_mark
  holds({ quest: { id: 'q_high_mark', stage: 'markers' } }, 'Dask did not start q_high_mark'),
  { goto: 'loc_sky_whisper_plateau' },
  takeAll,
  { rest: 1 },
  { fight: 'flee' },
  { goto: 'loc_windward_stair' },
  holds({ quest: { id: 'q_high_mark', stage: 'look_east' } }, 'the Stair was not climbed'),
  interact('ev_stair_look_east'),
  goOn,
  done('q_high_mark', 'seen'),
  holds({ all: [{ echo: 'echo_breach_clock' }, { echo: 'echo_high_mark' }] }, 'the High Mark did not pay'),
];

/** Loop 2's first Fall: the Shore starts the quest; the Gallery, the Loom, the Far Light's scene, `choiceId` there. */
const stillShore = (choiceId: 'look_back' | 'step', stage: string): ScriptStep[] => [
  { loopEnd: 'portal' },
  holds({ quest: { id: 'q_the_still_shore', stage: 'walk' } }, 'the Shore did not start q_the_still_shore'),
  { type: 'thresholdGo', to: 'gallery' },
  holds({ quest: { id: 'q_the_still_shore', stage: 'gallery' } }, 'the Gallery did not count'),
  { type: 'thresholdGo', to: 'loom' },
  holds({ quest: { id: 'q_the_still_shore', stage: 'loom' } }, 'the Loom did not count'),
  { type: 'thresholdGo', to: 'far_light' },
  choose(choiceId),
  ...(choiceId === 'look_back' ? [goOn] : []), // the figure, then the six
  done('q_the_still_shore', stage),
  holds({ echo: 'echo_threshold' }, 'the Shore did not pay its Echo'),
];


// ---- U58: the loop-only quests (Loop 2+; the Amulet's, the Before's and the Archives' hooks are the regions' events) ----------------

/** Loop 2: Dray's count — the ask at the Library, one watch at the Depths, the number against the water. */
const thirtiethDawn: ScriptStep[] = [
  { goto: 'loc_shattered_library' },
  { talk: 'npc_ansel_dray', pick: ['yes'] },
  holds({ quest: { id: 'q_the_thirtieth_dawn', stage: 'drift' } }, 'q_the_thirtieth_dawn did not start'),
  { goto: 'loc_heartstone_depths' },
  holds({ quest: { id: 'q_the_thirtieth_dawn', stage: 'count' } }, 'the Depths did not open the count'),
  interact('ev_depths_count_beats'),
  goOn,
  holds({ quest: { id: 'q_the_thirtieth_dawn', stage: 'compare' } }, 'the watch of counting did not pass'),
  { goto: 'loc_shattered_library' },
  { talk: 'npc_ansel_dray', pick: [] },
  done('q_the_thirtieth_dawn', 'done'),
  holds({ echo: 'echo_breach_clock' }, 'the Breach Clock was not made explicit'),
];

/** Loop 2 with the Nine Voices: the Crystal kept (the Amulet starts the quest), then to the lip and the Echo line; the Crystal route of the unmasking. */
const crystalHeard = (choiceId: 'safe' | 'choir'): ScriptStep[] => [
  ...crystalToIlyra(true),
  { talk: 'npc_ilyra', pick: ['keep', 'leave'] },
  done('q_echo_crystal', 'kept'),
  holds({ quest: { id: 'q_what_the_crystal_heard', stage: 'nine_voices' } }, 'the Amulet did not start q_what_the_crystal_heard'),
  { goto: 'loc_chasm_of_whispers' },
  holds({ quest: { id: 'q_what_the_crystal_heard', stage: 'listen' } }, 'the Chasm with the Crystal did not count'),
  { talk: 'npc_nyx', pick: ['i_know', 'nine', 'tyrant', choiceId] }, // the déjà vu's Echo line opens scene_nyx_unmasking's Crystal entry
  done('q_what_the_crystal_heard', 'heard'),
  holds({ all: [{ echo: 'echo_nyx_is_of_the_nine' }, { echo: 'echo_ninth_verse_unfinished' }, { echo: 'echo_litany_verse_8' }] }, 'the unmasking or the unfinished verse was not granted'),
];

/** Loop 2 with the First Drowned met: the Crystal given, the scroll asked for, the carrel approached without drawing; `choiceId` is the ring or the Amulet. */
const firstDrowned = (choiceId: 'listen' | 'ring'): ScriptStep[] => [
  ...crystalGiven(true),
  { talk: 'npc_ilyra', pick: ['yes'] }, // the scroll offer wins the tie
  holds({ quest: { id: 'q_lost_scroll', stage: 'descend' } }, 'q_lost_scroll did not start'),
  { goto: 'loc_sunken_archives' },
  holds({ all: [{ quest: { id: 'q_lost_scroll', stage: 'recover' } }, { not: { killed: { id: 'cr_drowned_archivist' } } }] }, 'the Archivist fought, or the scroll stage did not open'),
  interact('ev_archives_oriel_carrel'),
  choose('approach'),
  holds({ quest: { id: 'q_the_first_drowned', stage: 'carrel' } }, 'the carrel did not start q_the_first_drowned'),
  choose(choiceId),
  ...(choiceId === 'listen' ? [goOn, goOn] : []), // her voice, the verse, then the scroll
  done('q_the_first_drowned', 'given'),
  holds({ all: [{ item: { id: 'item_scholars_lost_scroll' } }, { echo: 'echo_litany_verse_1' }, { quest: { id: 'q_lost_scroll', stage: 'deliver' } }] }, 'the scroll or the verse was not given'),
];


// ---- U58: Stop the Ritual and the six ending quests -----------------------------------------------------------------------------

const APEX = 'loc_temporal_breach_apex';
/** The Tyrant's fight is reached by an exact move (its first words open on arrival; a `goto` would play them), Listen chosen. */
const toTheTyrant = (pick: 'fight' | 'listen' = 'listen'): ScriptStep[] => [{ type: 'move', to: APEX }, firstWords(pick)];
/** The Resolution reached with `outcome` on offer (the communion played by `communing`), its words then adopted with `picks`. */
const spared = (outcome: string, ...picks: string[]): ScriptStep[] => [{ until: { flag: 'flag_tyrant_spared' }, do: communing(outcome), maxSteps: 160 }, resolutionWords(...picks)];

/** A bot that sleeps the day through where it stands (a full rest, else a short one, else waits). */
const fullRester: Bot = {
  name: 'rester',
  choose: (_s, legal) => legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? legal.find((a) => a.type === 'rest' && a.kind === 'short') ?? legal.find((a) => a.type === 'wait') ?? legal.find((a) => a.type === 'continue') ?? (legal[0] as Action),
};

/** A bot that only strikes: a basic attack on any enemy, else an aimed ability, else any, else Guard (the hold's failing, where melee's rows stall). */
const brawler: Bot = {
  name: 'brawler',
  choose: (_s, legal) =>
    legal.find((a) => a.type === 'attack') ??
    legal.find((a) => a.type === 'ability' && 'targetUid' in a && !a.abilityId.startsWith('itm_')) ??
    legal.find((a) => a.type === 'ability' && !a.abilityId.startsWith('itm_')) ??
    legal.find((a) => a.type === 'guard') ??
    legal.find((a) => a.type === 'continue') ??
    (legal[0] as Action),
};

/** A bot that keeps Ilyra's vigil at the Depths (her scene's one enabled "Keep the vigil" choice), talking to her between. */
const vigilKeeper: Bot = {
  name: 'vigil',
  choose: (s, legal) => {
    if (s.mode === 'dialogue') {
      return legal.find((a) => a.type === 'choose' && a.choiceId !== 'not_now') ?? legal.find((a) => a.type === 'continue') ?? legal.find((a) => a.type === 'choose') ?? (legal[0] as Action);
    }
    return legal.find((a) => a.type === 'talk' && a.npcId === 'npc_ilyra') ?? legal.find((a) => a.type === 'wait') ?? (legal[0] as Action);
  },
};

/**
 * Loop 3 with Caelum's bond and the words for the communion: the four attempts of q_stop_the_ritual in the order the city
 * allows — the fair copy on Last Bell (the stair is open), then Caelum beside you after the reset lets you into the Hall on
 * First Bell (Veyran), then out by the Gate and in again by the Tyrant's tear (the Conflux before Last Bell: Hallow, the
 * cradle), two rests to Last Bell, and Masque on the dome (the Knight lets the fourth failure by).
 */
const stopTheRitual: ScriptStep[] = [
  ...caelumJoined, // Last Bell noon, Caelum beside you (U56)
  holds({ quest: { id: 'q_stop_the_ritual', stage: 'try' } }, 'the Before did not start q_stop_the_ritual'),
  { goto: 'loc_apprentices_garret' },
  { goto: 'loc_outer_walks' },
  { goto: 'loc_archives_of_danthe' },
  interact('ev_archives_fair_copy'),
  choose('take'),
  goOn,
  goOn,
  holds({ flag: 'flag_scene_done_scene_ritual_steal_record' }, 'the record was not taken'),
  { goto: 'loc_outer_walks' },
  { goto: 'loc_apprentices_garret' },
  { rest: 1 }, // Last Bell's reset: First Bell again, Caelum still beside you
  holds({ beforeDay: 1 }, 'Last Bell did not reset'),
  settle('loc_apprentices_garret'),
  { goto: 'loc_plaza_of_bells' },
  { goto: 'loc_ninefold_hall' }, // the doors admit the apprentice's companion
  { talk: 'npc_veyran_thal', pick: ['warn'] },
  holds({ all: [{ flag: 'flag_scene_done_scene_ritual_warn_veyran' }, { echo: 'echo_litany_verse_9' }] }, 'Veyran was not warned'),
  // out by the Gate, and in again by the tear: the Conflux on First Bell
  { goto: 'loc_plaza_of_bells' },
  { goto: 'loc_grand_library' },
  { goto: 'loc_scholars_corridor' },
  { goto: 'loc_silver_gate' },
  { type: 'move', to: 'loc_chronos_nexus' },
  settle('loc_chronos_nexus'),
  { type: 'setStance', stance: 'support' },
  { rest: 1 },
  settle('loc_chronos_nexus'),
  ...toTheTyrant(),
  ...spared('pass_into_before', 'hold', 'turn_back'),
  { type: 'commune', act: 'speak', answerId: 'pass_into_before' }, // the outcome: the tear opens
  { type: 'move', to: 'loc_conflux_chamber' },
  holds({ all: [{ beforeDay: 1 }, { location: 'loc_conflux_chamber' }] }, 'the tear did not open onto the Conflux'),
  { talk: 'npc_durn_hallow', pick: ['stay'] },
  holds({ all: [{ flag: 'flag_scene_done_scene_ritual_keep_hallow' }, { echo: 'echo_hallow_said_stop' }, { echo: 'echo_litany_verse_4' }] }, 'Hallow did not stay'),
  interact('ev_conflux_cradle'),
  choose('break'),
  goOn,
  goOn,
  goOn,
  holds({ quest: { id: 'q_stop_the_ritual', stage: 'masque' } }, 'the four attempts did not bring the sixth beat'),
  { goto: 'loc_archives_of_danthe' },
  { goto: 'loc_outer_walks' },
  { goto: 'loc_apprentices_garret' },
  { until: { beforeDay: 3 }, do: fullRester, maxSteps: 6 }, // to Last Bell (a rest more would reset the echo)
  settle('loc_apprentices_garret'),
  { goto: 'loc_plaza_of_bells' },
  { type: 'move', to: 'loc_ninefold_hall' }, // the dome's scene opens on arrival
  { until: { quest: { id: 'q_stop_the_ritual', status: 'completed' } }, do: chooser('none'), maxSteps: 12 },
  done('q_stop_the_ritual', 'inevitable'),
  holds({ all: [{ echo: 'echo_ritual_inevitable' }, { echo: 'echo_litany_verse_7' }] }, 'Masque did not say it'),
];

/** Loop 2's road east, then the Highlands by the Depths, Dask met at the Pass (recruited, his first quest taken: U55's intro picks). */
const daskMet: ScriptStep[] = [...loop2RoadEast, { fight: 'flee' }, { goto: 'loc_shimmering_pass' }, { talk: 'npc_dask', pick: ['who', 'what_do_i_do', 'come', 'where'] }, holds({ companion: { id: 'dask' } }, 'Dask was not recruited')];

/** From the Pass with a companion in Support: the Spires, the Nexus (a rest, the camp conversation), the Tyrant. */
const passToTheTyrant: ScriptStep[] = [
  { type: 'setStance', stance: 'support' },
  { goto: 'loc_aetherium_spires' },
  { goto: 'loc_chronos_nexus' },
  { rest: 1 },
  settle('loc_chronos_nexus'),
  ...toTheTyrant(),
];

/** A: Loop 4 with every verse: Dask's ask at the Pass, the Apex, the communion to the Resolution past six, the ninth said. */
export const wardensVigil: ScriptStep[] = [
  ...daskMet,
  { talk: 'npc_dask', pick: ['yes'] }, // scene_dask_wardens_vigil_offer (ahead of his arc's lines)
  holds({ all: [{ quest: { id: 'q_wardens_vigil', stage: 'go_and_see' } }, { echo: 'echo_litany_complete' }] }, 'q_wardens_vigil did not start, or the Litany was not derived'),
  ...passToTheTyrant,
  holds({ quest: { id: 'q_wardens_vigil', stage: 'communion' } }, 'the Apex did not count'),
  ...spared('take_its_place', 'understand', 'say_it'),
  done('q_wardens_vigil', 'stepped_in'),
];

/** F: Loop 2 with the Tyrant's Echo: the road east, the Apex, the communion to the Resolution (silence at the gaps), the tear stepped through. */
export const unbound: ScriptStep[] = [
  ...loop2RoadEast,
  { fight: 'flee' },
  { goto: 'loc_shimmering_pass' },
  { goto: 'loc_aetherium_spires' },
  { goto: 'loc_chronos_nexus' },
  { rest: 1 },
  ...toTheTyrant(),
  ...spared('pass_beyond', 'hold', 'walk_through'),
  done('q_unbound', 'gone'),
  holds({ flag: 'flag_refused_all_paths' }, 'every other path was not refused'),
];

/** C: Loop 2 with the Weaver sign and Nyx's bond: her arc to the plan agreed (Weavers Sworn on the way), the Heartstone exploited, her ask, the Apex. */
export const weaversDawn: ScriptStep[] = [
  ...nyxPlanAnswered('agreed', 'agreed'),
  { fight: 'flee' },
  { goto: 'loc_sunken_archives' },
  { type: 'move', to: 'loc_heartstone_depths' }, // two quests done: the heartbeat's choice opens on arrival (an exact move: a goto would take its first choice)
  choose('exploit'),
  holds({ all: [{ item: { id: 'item_heartstone_core' } }, { flag: 'flag_heartstone_exploited' }] }, 'the Core was not taken'),
  { goto: 'loc_chasm_of_whispers' },
  holds({ all: [{ rep: { faction: 'weavers', min: 60 } }, { companion: { id: 'nyx', state: 'active' } }] }, 'Weavers are not Sworn, or Nyx is not beside you'),
  { talk: 'npc_nyx', pick: ['yes'] }, // scene_nyx_weavers_dawn_offer
  holds({ quest: { id: 'q_weavers_dawn', stage: 'apex' } }, 'q_weavers_dawn did not start at its Apex stage'),
  // the Core costs five dawns (STORY §13): no rest on the way — the Nexus must be reached before the thirtieth
  { fight: 'melee' },
  { goto: 'loc_chronos_nexus' },
  holds({ not: { flag: 'flag_clock_expired' } }, 'the thirtieth dawn came first'),
  { type: 'move', to: APEX }, // ev_apex_dawn → scene_ending_dawn
  { talk: 'npc_nyx', pick: ['give'] },
  { until: { quest: { id: 'q_weavers_dawn', status: 'completed' } }, do: brawler, maxSteps: 80 }, // the hold's failing: two waves, then the ending
  done('q_weavers_dawn', 'dawn'),
];

/** E: Loop 3 with Ilyra's bond and her arc behind you (the Keeper), the Heartstone stabilized, Dray's ask, the vigil at the Depths. */
export const longArchive: ScriptStep[] = [
  // Ilyra's arc as U54 plays it, the Heartstone stabilized as soon as the heartbeat starts (before any road might cross the Depths)
  ...ilyraJoinsLoop3,
  ...voicesHeard,
  ...scrollToIlyra,
  { goto: 'loc_sunken_archives' },
  { type: 'move', to: 'loc_heartstone_depths' }, // two quests done: the heartbeat's choice (an exact move: a goto would take its first choice)
  choose('stabilize'),
  holds({ all: [{ flag: 'flag_heartstone_stabilized' }, { echo: 'echo_heartstone_resonance' }] }, 'the Heartstone was not stabilized'),
  { goto: 'loc_whispering_ruins' },
  ...dantheLine('take', 'taken'),
  holds({ loyalty: { companion: 'ilyra', min: 50 } }, 'Ilyra is not Loyal'),
  { goto: 'loc_shattered_library' },
  { talk: 'npc_ansel_dray', pick: ['ledger', 'yes'] }, // scene_dray_offers → q_keepers_ledger's offer
  { talk: 'npc_ansel_dray', pick: ['yes', 'keeper'] },
  done('q_the_keepers_price', 'keeper'),
  holds({ rep: { faction: 'remnants', min: 60 } }, 'the Remnants are not Sworn'),
  { talk: 'npc_ansel_dray', pick: ['yes'] }, // scene_dray_long_archive_offer
  holds({ quest: { id: 'q_long_archive', stage: 'last_dawn' } }, 'q_long_archive did not start'),
  { goto: 'loc_heartstone_depths' },
  // her vigil: the dawns pass in the scene, which closes on "This is the last dawn."
  { until: { all: [{ quest: { id: 'q_long_archive', stage: 'archive' } }, { flag: 'flag_scene_done_scene_ilyra_keep_the_vigil' }] }, do: vigilKeeper, maxSteps: 40 },
  { talk: 'npc_ilyra', pick: ['yes', 'stay'] }, // scene_ending_archive
  done('q_long_archive', 'remembered'),
];

/** The Echoes ending D's Loop 3 brings (the oath, the iron, both halves of the design, Brak's survival, the roads). */
export const IRON_SILENCE_ECHOES: readonly `echo_${string}`[] = ['echo_ironclad_oath', 'echo_stone_hide_origin', 'echo_tyrant_jailer', 'echo_iron_that_does_not_wish', 'echo_anchor_half_a', 'echo_anchor_half_b', 'echo_brak_lives', 'echo_tyrant_speaks', 'echo_apex_resonance', 'echo_high_mark', 'echo_hollow_path', 'echo_steppe_waystones', 'echo_heartstone_path', 'echo_crystal_location'];

/**
 * D (U81a, D-123: ending D by play). Loop 3 with the oath, the iron and both halves of the design: two quick quests for the
 * heartbeat (the Crystal kept; the Peaks, after which Brak joins, and the Outpost by the warder's word). Then the anchor's bill
 * gathered BEFORE the stone is broken — the Destroy's ten dawns are the clock's price, and what a returning Wayfinder knows is
 * where the iron's makings lie: Kaelen's offcut of heartwood at the Respite, the Hollow's three Void Shards (one loose, two from
 * its Stalkers), arrivals fought, not fled. Then the Heartstone destroyed (a dead fragment, Ironclad Sworn; nineteen dawns left),
 * the Spires and their Crown on the road east (three Aetherium Shards), Hadda's ask at Hearthring (the design derived from both
 * halves), the Gate's ore and Borin's vein, the forge (the Neutral gate while the quest runs), the Nexus, and the Apex with Brak:
 * the Tyrant heard and shown the iron (`scene_ending_silence`), "Now." Day 13 of the twenty the Destroy leaves (U58 gathered
 * the makings after Hadda's ask and fled every arrival: 22–25 days).
 */
export const ironSilence: ScriptStep[] = [
  ...crystalToIlyra(true),
  { talk: 'npc_ilyra', pick: ['keep', 'leave'] },
  done('q_echo_crystal', 'kept'),
  ...clearPath,
  ...outpostAccepted,
  { talk: 'npc_brak', pick: ['come'] },
  holds(BRAK_RECRUITED, 'Brak did not join'),
  { fight: 'flee' },
  { goto: 'loc_blighted_outpost' }, // the word stills the Golems (the shortcut): the Outpost's standing
  { goto: 'loc_ironclad_camp' },
  { talk: 'npc_brak', pick: [] },
  done('q_blighted_outpost', 'done'),
  // the makings first, while the stone still beats
  { fight: 'melee' },
  { goto: 'loc_wayfarers_respite' },
  { until: { item: { id: 'mat_silverwood_heartwood' } }, do: buyer('mat_silverwood_heartwood'), maxSteps: 4 },
  { goto: 'loc_voidscar_hollow' },
  takeAll,
  { until: { item: { id: 'item_void_shard', count: 3 } }, do: 'melee', maxSteps: 60 },
  holds({ all: [{ item: { id: 'item_void_shard', count: 3 } }, { item: { id: 'mat_silverwood_heartwood' } }] }, 'the Hollow did not give three Void Shards, or Kaelen no heartwood'),
  { goto: 'loc_sunken_archives' },
  { type: 'move', to: 'loc_heartstone_depths' },
  { until: { flag: 'flag_heartstone_destroyed' }, do: chooser('destroy'), maxSteps: 4 },
  holds({ all: [{ flag: 'flag_heartstone_destroyed' }, { item: { id: 'item_heartstone_fragment_dead' } }] }, 'the Heartstone was not destroyed'),
  // the road east: the Spires, the Crown's two shards
  { goto: 'loc_aetherium_spires' },
  takeAll,
  { goto: 'loc_spire_crown' },
  takeAll,
  holds({ item: { id: 'item_aetherium_shard', count: 3 } }, 'the Spires and the Crown did not give three Aetherium Shards'),
  { goto: 'loc_hearthring' },
  holds({ all: [{ rep: { faction: 'ironclad', min: 60 } }, { not: { flag: 'flag_clock_expired' } }] }, 'the Ironclad are not Sworn, or the thirtieth dawn came first'),
  { talk: 'npc_hadda_ironvow', pick: ['yes'] }, // scene_hadda_iron_silence_offer
  holds({ all: [{ quest: { id: 'q_iron_silence', stage: 'cut_the_line' } }, { echo: 'echo_anchor_schema' }] }, 'q_iron_silence did not start, or the design was not derived'),
  { goto: 'loc_scorched_gate' },
  { type: 'gather' }, // the slag-heap's ore, on the way back west
  { goto: 'loc_emberforge' },
  interact('ev_forge_vein'), // Borin's vein: three more
  holds({ item: { id: 'mat_ember_ore', count: 3 } }, 'the ore for the anchor is short'),
  { type: 'craft', recipeId: 'recipe_breach_anchor' },
  holds({ quest: { id: 'q_iron_silence', stage: 'apex' } }, 'the Breach-anchor was not forged'),
  { goto: 'loc_chronos_nexus' },
  holds({ all: [{ companion: { id: 'brak', state: 'active' } }, { not: { flag: 'flag_clock_expired' } }] }, 'Brak is not beside you, or the thirtieth dawn came first'),
  // the talk branch (STORY §11.6 D): the Tyrant heard, then shown the iron
  { type: 'move', to: APEX },
  firstWords('listen'),
  { until: { flag: 'flag_anchor_offered' }, do: anchorShown, maxSteps: 40 },
  { talk: 'cr_chronos_tyrant_unveiled', pick: ['now'] }, // scene_ending_silence → "Now."
  done('q_iron_silence', 'silence'),
];

// ---- U59: the five class mini-quests (Loop 2+, each played by its class; the hooks are the givers' scenes and the regions' events) ----

/** Loop 2, a Ranger: Kaelen's ask at the Respite, the ground read at the Path (the marks, the snare, one watch), the runner home. */
const unmarkedTrail: ScriptStep[] = [
  { fight: 'flee' }, // the Path's Prowlers, where they roll (the quest is pacifist)
  { goto: 'loc_wayfarers_respite' },
  { talk: 'npc_kaelen_stonehand', pick: ['yes'] }, // scene_kaelen_unmarked_trail_offer
  holds({ quest: { id: 'q_class_ranger', stage: 'read_ground' } }, 'q_class_ranger did not start'),
  { goto: 'loc_mistwood_path' },
  interact('ev_mistwood_read_ground'),
  choose('read_marks'),
  goOn,
  holds({ quest: { id: 'q_class_ranger', stage: 'snare' } }, 'the marks did not move the quest on'),
  choose('snare'),
  goOn,
  goOn,
  holds({ quest: { id: 'q_class_ranger', stage: 'bring_home' } }, 'the snare did not take'),
  { goto: 'loc_wayfarers_respite' },
  { talk: 'npc_kaelen_stonehand', pick: [] }, // scene_kaelen_unmarked_trail_report
  done('q_class_ranger', 'home'),
  holds({ all: [{ echo: 'echo_kaelen_ledger' }, { item: { id: 'item_harrier_bow' } }] }, 'the ledger or the bow was not paid'),
];

/** Loop 2, a Wizard: Tamsin's page at the Plaza, the night waited for at the Chasm's camp, the page read by ley-light; copied or burned. */
const seventhPage = (choiceId: 'copy' | 'burn'): ScriptStep[] => [
  { fight: 'flee' }, // the Plaza's Wisp scatters when fled (the quest is pacifist)
  { goto: 'loc_silverwood_plaza' },
  { talk: 'npc_tamsin_reed', pick: ['yes'] }, // scene_tamsin_seventh_page_offer
  holds({ quest: { id: 'q_class_wizard', stage: 'ley_light' } }, 'q_class_wizard did not start'),
  { goto: 'loc_chasm_of_whispers' }, // the cold camp on the lip: a dawn, then dusk, then the Plaza by night
  { rest: 1 },
  waitFor({ watch: 'dusk' }),
  { fight: 'melee' }, // a return roll at the Plaza is fought: a flight costs three watches (combat/flee.ts) and the night
  { goto: 'loc_silverwood_plaza' },
  holds({ all: [{ watch: 'night' }, { quest: { id: 'q_class_wizard', stage: 'read' } }] }, 'the fountain at night did not open the reading'),
  interact('ev_plaza_ley_light'),
  goOn,
  goOn,
  choose(choiceId),
  goOn,
  done('q_class_wizard', choiceId === 'copy' ? 'copied' : 'burned'),
  holds({ item: { id: 'item_scriptorium_staff' } }, 'the staff was not paid'),
  ...(choiceId === 'copy'
    ? [holds({ all: [{ echo: 'echo_korr_marginalia' }, { corruption: { min: 1 } }] }, 'the margins were not read, or the copy cost nothing')]
    : [holds({ rep: { faction: 'remnants', min: 5 } }, 'the burning did not pay the Remnants')]),
];

/** Loop 2, an Elf: the whisper followed from the Archway, a dawn at Ilyra's fire, the Plaza reached at dusk, the buried duel; drawn, or let pass. */
const bladesong = (choiceId: 'draw' | 'still'): ScriptStep[] => [
  { fight: 'melee' },
  { goto: 'loc_crumbling_archway' },
  interact('ev_archway_follow'),
  choose('follow'),
  goOn,
  holds({ quest: { id: 'q_class_elf', stage: 'follow' } }, 'the whisper did not start q_class_elf'),
  { goto: 'loc_whispering_ruins' },
  { rest: 1 }, // to dawn: the Path by day, the Plaza at dusk
  { goto: 'loc_silverwood_plaza' },
  holds({ all: [{ watch: 'dusk' }, { quest: { id: 'q_class_elf', stage: 'duel' } }] }, 'the Plaza at dusk did not open the duelling-ground'),
  interact('ev_plaza_duelling_ground'),
  goOn,
  choose(choiceId),
  ...(choiceId === 'draw' ? [{ fight: 'melee' } as ScriptStep] : [goOn, goOn]),
  done('q_class_elf', choiceId === 'draw' ? 'won' : 'passed'),
  holds({ item: { id: 'item_elven_bow' } }, 'the bow was not paid'),
];

/** Loop 2, a Warden: the Peaks accepted (the legacy offer wins the tie), Brak's hub to the wall, the night at the gap (three waves), the plate to Borin. */
const wallThatHolds: ScriptStep[] = [
  { fight: 'melee' },
  { goto: 'loc_ironclad_camp' },
  { talk: 'npc_brak', pick: ['yes'] }, // scene_brak_clear_path_offer (first in content order)
  holds({ quest: { id: 'q_clear_path', stage: 'hunt' } }, 'q_clear_path did not start'),
  { talk: 'npc_brak', pick: ['wall', 'yes'] }, // scene_brak_arc → scene_brak_wall_offer
  holds({ quest: { id: 'q_class_ironclad_warden', stage: 'be_a_wall' } }, 'q_class_ironclad_warden did not start'),
  { rest: 1 }, // the inn, to dawn and whole
  waitFor({ watch: 'night' }),
  holds({ quest: { id: 'q_class_ironclad_warden', stage: 'hold' } }, 'the Camp at night did not open the gap'),
  interact('ev_camp_barricade_gap'),
  choose('take'),
  { fight: 'melee' }, // the three waves, chained
  holds({ quest: { id: 'q_class_ironclad_warden', stage: 'dawn' } }, 'the gap did not hold through the three waves'),
  { rest: 1 },
  { fight: 'flee' }, // the Peaks' Brute holds (the gate while q_clear_path runs); the Outpost's Golems are fled
  { goto: 'loc_emberforge' },
  { talk: 'npc_borin_stonefist', pick: [] }, // scene_borin_wall_tempered
  done('q_class_ironclad_warden', 'tempered'),
  holds({ item: { id: 'item_ironclad_hammer' } }, 'the hammer was not paid'),
];

/** Loop 2, a Shadow Weaver: the shards' pact (the legacy offer wins the tie, and opens the bridge), Nyx's ask, the Hollow at night, the seam; the Shard left or taken. */
const unlitThread = (choiceId: 'leave' | 'take'): ScriptStep[] => [
  { fight: 'flee' }, // the Plaza's Wisp on the way scatters when fled (the quest is pacifist)
  { goto: 'loc_chasm_of_whispers' },
  nyxDejaVu,
  { talk: 'npc_nyx', pick: ['yes'] }, // scene_nyx_void_shards_offer
  holds({ quest: { id: 'q_void_shards', stage: 'gather' } }, 'q_void_shards did not start'),
  { talk: 'npc_nyx', pick: ['yes'] }, // scene_nyx_unlit_thread_offer
  holds({ quest: { id: 'q_class_shadow_weaver', stage: 'seam' } }, 'q_class_shadow_weaver did not start'),
  { rest: 1 }, // the cold camp on the lip: a dawn, then night
  waitFor({ watch: 'night' }),
  // the Hollow's first group fights on arrival (dawn) and scatters when fled, which costs three watches (combat/flee.ts): night
  { goto: 'loc_voidscar_hollow' },
  holds({ all: [{ watch: 'night' }, { quest: { id: 'q_class_shadow_weaver', stage: 'hex' } }] }, 'the Hollow at night did not open the seam'),
  interact('ev_hollow_feel_seam'),
  goOn,
  choose('hex'),
  goOn,
  choose(choiceId),
  goOn,
  holds({ quest: { id: 'q_class_shadow_weaver', stage: choiceId === 'leave' ? 'return' : 'return_took' } }, 'the seam did not send you back'),
  { goto: 'loc_chasm_of_whispers' },
  { talk: 'npc_nyx', pick: [] }, // scene_nyx_unlit_thread_report
  done('q_class_shadow_weaver', choiceId === 'leave' ? 'one_of_us' : 'remembered'),
  holds({ item: { id: 'item_chasmglass_focus' } }, 'the lens was not paid'),
];

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
    seed: 'quest:shards:give:alt1:u84:1', // U84 re-seed: the wilds go quiet after a fight (DESIGN §10.1) // the Hollow's Stalkers beat a level-7 melee ranger about one seed in five (a balance note): a seed that wins
    steps: [...routeToOutpost, ...shardsGathered(), { talk: 'npc_nyx', pick: ['yes'] }, done('q_void_shards', 'given'), holds({ item: { id: 'item_shadow_kissed_dagger' } }, 'no Shadow-Kissed Dagger')],
  },
  {
    questId: 'q_void_shards',
    outcome: 'refused',
    name: 'the shards refused (Loop 1, after the Outpost)',
    classId: CLASS,
    seed: 'quest:shards:refuse',
    steps: [
      ...routeToOutpost,
      ...shardsGathered(),
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
    // since U34e's hazards and anomalies, a level-6 ranger dies on the Drowned route in 4 of 5 seeds (D-110 balance flag): a seed
    // that wins (U81b1: re-seeded, the class-aware fight moved which seeds win; D-145)
    seed: 'quest:ledger:whole:e:i',
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
    seed: 'quest:teeth:truth:b:f', // U81b1: re-seeded (the class-aware fight) // the Aberration at level 11 and the three waves behind it beat a carry-over Warden about two seeds in three (a balance note): a seed that wins
    classId: 'ironclad_warden',
    profile: { loop: 3, echoes: ['echo_ironclad_oath', 'echo_stone_hide_origin', 'echo_tyrant_jailer'], bestLevel: 17 },
    steps: [...axeRecovered, { talk: 'npc_hadda_ironvow', pick: ['truth'] }, done('q_day_of_teeth', 'told_truth'), holds({ echo: 'echo_day_of_teeth' }, 'the Day of Teeth was not granted')],
  },
  {
    questId: 'q_day_of_teeth',
    outcome: 'told_monster',
    name: 'Loop 3: the axe from the Horde-echo; a monster (the scouts ride east)',
    classId: 'ironclad_warden',
    seed: 'quest:teeth:monster:f', // U81b1: re-seeded (the class-aware fight)
    profile: { loop: 3, echoes: ['echo_ironclad_oath', 'echo_stone_hide_origin'], bestLevel: 17 },
    steps: [...axeRecovered, { talk: 'npc_hadda_ironvow', pick: ['monster'] }, done('q_day_of_teeth', 'told_monster'), holds({ not: { echo: 'echo_day_of_teeth' } }, 'the Day of Teeth was granted')],
  },
  // ---- U53 · q_hollow_choir (Loop 2+, Weavers not Wary; the Sanctum behind the curtain) ----
  {
    questId: 'q_hollow_choir',
    outcome: 'silent',
    name: 'Loop 2: the Weaver route (Crystal kept, shards given), a Shard offered, nothing said',
    classId: CLASS,
    seed: 'quest:choir:shard:i:b2a', // U81b2 re-seed (cooldowns, the Tyrant, the lethal fights retuned); // U81b1: re-seeded (the class-aware fight)
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
    seed: 'quest:eye:look:a:h', // U81b1: re-seeded (the class-aware fight) // the Aberration at level 11 beats a carry-over Warden about one seed in two (a balance note): a seed that wins
    profile: { loop: 3, echoes: ['echo_weaver_sign', 'echo_hollow_path', 'echo_heartstone_path', 'echo_litany_verse_1'], bestLevel: 17 },
    steps: [...eyeDecided('look', 'looked'), holds({ echo: 'echo_choir_knows' }, 'the Choir does not know')],
  },
  {
    questId: 'q_unlidded_eye',
    outcome: 'warned',
    name: 'Loop 3: the Eye from the Nexus; Nyx warned first; the Note of Closing',
    classId: 'ironclad_warden',
    seed: 'quest:eye:warn:a:8:g', // U81b1: re-seeded (the class-aware fight) // as above; U81c re-seed: a flight now falls back and a quest-drop group regroups at dawn (D-143, D-144)
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
  // ---- U55 · q_tears_of_the_breach (Loop 2, the bond; the shards given, Nyx recruited at the lip) ----
  {
    questId: 'q_tears_of_the_breach',
    outcome: 'unanswered',
    name: 'Loop 2: Nyx recruited at the lip; a Shard read at the edge at night',
    classId: CLASS,
    seed: 'quest:tears',
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_nyx_bond'], bestLevel: 17 },
    steps: nyxShardRead,
  },
  // ---- U55 · q_the_dark_between (after the reading, Nyx at 25; the Veil fled through) ----
  {
    questId: 'q_the_dark_between',
    outcome: 'kept',
    name: 'Loop 2: Where She Fell; her secret kept',
    classId: CLASS,
    seed: 'quest:dark:kept',
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_nyx_bond'], bestLevel: 17 },
    steps: [...nyxUnmasked('safe', 'kept'), holds({ all: [{ companion: { id: 'nyx' } }, { not: { flag: 'flag_nyx_hostile' } }] }, 'Nyx did not stay')],
  },
  {
    questId: 'q_the_dark_between',
    outcome: 'told',
    name: 'Loop 2: Where She Fell; the Choir told (she leaves, Hostile)',
    classId: CLASS,
    seed: 'quest:dark:told:a', // the Hollow's Stalkers beat a level-10 ranger about one seed in five (D-105's balance note): a seed that wins
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_nyx_bond'], bestLevel: 17 },
    steps: [
      ...nyxUnmasked('choir', 'told'),
      holds({ all: [{ echo: 'echo_choir_knows' }, { flag: 'flag_nyx_hostile' }, { not: { companion: { id: 'nyx', state: 'recruited' } } }] }, 'the Choir does not know, or Nyx did not leave'),
    ],
  },
  // ---- U55 · q_what_she_would_undo (Nyx Loyal after her second quest; the plan at the Hollow) ----
  {
    questId: 'q_what_she_would_undo',
    outcome: 'agreed',
    name: 'Loop 2: the plan at the Hollow, agreed (the path to C)',
    classId: CLASS,
    seed: 'quest:undo:agreed:g:b2a', // U81b2 re-seed (cooldowns, the Tyrant, the lethal fights retuned); // U81b1: re-seeded (the class-aware fight)
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_nyx_bond'], bestLevel: 17 },
    steps: nyxPlanAnswered('agreed', 'agreed'),
  },
  {
    questId: 'q_what_she_would_undo',
    outcome: 'refused_truth',
    name: 'Loop 3: the plan refused with the truth (Weavers Trusted: the Note of Closing)',
    classId: CLASS,
    seed: 'quest:undo:truth',
    profile: { loop: 3, echoes: ['echo_crystal_location', 'echo_nyx_bond', 'echo_ritual_inevitable'], bestLevel: 17 },
    steps: [...nyxPlanAnswered('truth', 'refused_truth'), holds({ echo: 'echo_void_resonance' }, 'the Note of Closing was not given')],
  },
  {
    questId: 'q_what_she_would_undo',
    outcome: 'refused',
    name: 'Loop 2: the plan refused flatly',
    classId: CLASS,
    seed: 'quest:undo:refused',
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_nyx_bond'], bestLevel: 17 },
    steps: nyxPlanAnswered('refused', 'refused'),
  },
  // ---- U55 · q_the_flickering_man (Loop 2: Dask met, recruited; his four selves) ----
  {
    questId: 'q_the_flickering_man',
    outcome: 'heard',
    name: 'Loop 2: Dask recruited at the Pass; the four of him; the whole sentence',
    classId: CLASS,
    seed: 'quest:flicker',
    profile: { loop: 2, bestLevel: 17 },
    steps: daskSentence,
  },
  // ---- U55 · q_seven_marks (Loop 3's Threshold with the Echoes: the Gallery, the symptom on the Shore; the High Mark next loop) ----
  {
    questId: 'q_seven_marks',
    outcome: 'eighth_blank',
    name: 'Loop 3 → 4: the marks in the Gallery, the symptom on the Shore, the eighth frame at the Windward Stair',
    classId: CLASS,
    seed: 'quest:marks:u84:1', // U84 re-seed: the wilds go quiet after a fight (DESIGN §10.1)
    profile: { loop: 3, echoes: ['echo_threshold', 'echo_flickering_man', 'echo_high_mark'], bestLevel: 17 },
    steps: [
      { loopEnd: 'portal' },
      { talk: 'npc_dask', pick: ['yes'] }, // scene_dask_seven_marks_offer, on the Shore
      holds({ quest: { id: 'q_seven_marks', stage: 'six_known' } }, 'q_seven_marks did not start on the Shore'),
      { type: 'thresholdGo', to: 'gallery' },
      holds({ all: [{ quest: { id: 'q_seven_marks', stage: 'marks_seen' } }, { echo: 'echo_seven_wayfinders' }] }, 'the Gallery did not show the marks'),
      { type: 'thresholdGo', to: 'still_shore' },
      { talk: 'npc_dask', pick: [] }, // scene_dask_seven_marks_symptom
      holds({ all: [{ quest: { id: 'q_seven_marks', stage: 'high_mark' } }, { echo: 'echo_wayfinder_symptom' }] }, 'the symptom was not said'),
      { type: 'thresholdGo', to: 'far_light' },
      { type: 'newLoop' },
      holds({ all: [{ loop: { min: 4 } }, { quest: { id: 'q_seven_marks', stage: 'high_mark' } }] }, 'the quest did not survive the Far Light'),
      ...loop2RoadEast,
      { fight: 'flee' },
      { goto: 'loc_shimmering_pass' },
      { talk: 'npc_dask', pick: ['who', 'what_do_i_do', 'come', 'later'] },
      holds({ companion: { id: 'dask' } }, 'Dask was not recruited'),
      { goto: 'loc_windward_stair' },
      { talk: 'npc_dask', pick: [] }, // scene_dask_seven_marks_eighth
      done('q_seven_marks', 'eighth_blank'),
    ],
  },
  // ---- U55 · q_the_last_instant (Loop 3: Dask Loyal; the communion through Movement III; his choice at the Apex) ----
  {
    questId: 'q_the_last_instant',
    outcome: 'rests',
    name: 'Loop 3: the communion carried through; Dask rests',
    classId: CLASS,
    seed: 'quest:instant:rest:5:b2a', // U81b2 re-seed (cooldowns, the Tyrant, the lethal fights retuned); // U81c re-seed: a flight now falls back and a quest-drop group regroups at dawn (D-143, D-144)
    profile: {
      loop: 3,
      echoes: ['echo_flickering_man', 'echo_dask_bond', 'echo_tyrant_speaks', 'echo_apex_resonance', 'echo_tyrant_jailer', 'echo_thirtieth_dawn', 'echo_seven_wayfinders', 'echo_tyrant_never_struck', 'echo_litany_verse_2', 'echo_litany_verse_3', 'echo_litany_verse_4', 'echo_litany_verse_5', 'echo_litany_verse_6', 'echo_litany_verse_7', 'echo_hallow_said_stop', 'echo_ritual_inevitable'],
      bestLevel: 17,
    },
    steps: [
      ...daskAtTheApex,
      { talk: 'npc_dask', pick: ['rest'] },
      done('q_the_last_instant', 'rests'),
      holds({ all: [{ echo: 'echo_dask_rest' }, { not: { companion: { id: 'dask', state: 'recruited' } } }] }, 'Dask did not rest'),
    ],
  },
  {
    questId: 'q_the_last_instant',
    outcome: 'stays',
    name: "Loop 3: the communion carried through; Dask stays until it's done",
    classId: CLASS,
    seed: 'quest:instant:stay:f:b2a:u84:1', // U84 re-seed: the wilds go quiet after a fight (DESIGN §10.1) // U81b2 re-seed (cooldowns, the Tyrant, the lethal fights retuned); // U81b1: re-seeded (the class-aware fight)
    profile: {
      loop: 3,
      echoes: ['echo_flickering_man', 'echo_dask_bond', 'echo_tyrant_speaks', 'echo_apex_resonance', 'echo_tyrant_jailer', 'echo_thirtieth_dawn', 'echo_seven_wayfinders', 'echo_tyrant_never_struck', 'echo_litany_verse_2', 'echo_litany_verse_3', 'echo_litany_verse_4', 'echo_litany_verse_5', 'echo_litany_verse_6', 'echo_litany_verse_7', 'echo_hallow_said_stop', 'echo_ritual_inevitable'],
      bestLevel: 17,
    },
    steps: [
      ...daskAtTheApex,
      { talk: 'npc_dask', pick: ['stay'] },
      done('q_the_last_instant', 'stays'),
      holds({ all: [{ flag: 'flag_dask_anchor' }, { companion: { id: 'dask' } }] }, 'Dask did not stay'),
    ],
  },
  // ---- U56 · q_lantern_in_the_reeds (Loop 2: the Glowfen; the elders; Mireya joins; the moss, the root, the child) ----
  {
    questId: 'q_lantern_in_the_reeds',
    outcome: 'tended',
    name: 'Loop 2: Mireya recruited after stage 1; the sick tended with steady hands',
    classId: CLASS,
    seed: 'quest:lantern:2', // U81c re-seed: a flight now falls back and a quest-drop group regroups at dawn (D-143, D-144)
    profile: { loop: 2, bestLevel: 17 },
    steps: mireyaTended,
  },
  // ---- U56 · q_what_the_light_takes (Loop 2 with the bond: Mireya at 25; the Maze, the Pool, Sallow's name) ----
  {
    questId: 'q_what_the_light_takes',
    outcome: 'heard',
    name: "Loop 2: the Breathing Pool by the Reed Maze; Sallow's verse; her name brought back",
    classId: CLASS,
    seed: 'quest:light',
    profile: { loop: 2, echoes: ['echo_mireya_bond'], bestLevel: 17 },
    steps: mireyaHeard,
  },
  // ---- U56 · q_preserve_or_heal (Loop 2, Mireya Loyal; a fragment from the Heartstone; the village asked; the choice) ----
  {
    questId: 'q_preserve_or_heal',
    outcome: 'dammed',
    name: 'Loop 2: the Heartstone stabilized; the leak dammed with the stable fragment',
    classId: CLASS,
    seed: 'quest:preserve:dam',
    profile: { loop: 2, echoes: ['echo_mireya_bond'], bestLevel: 17 },
    steps: [...mireyaChose('dam', 'dammed'), holds({ all: [{ echo: 'echo_glowfen_dammed' }, { item: { id: 'item_heartstone_fragment_stable' } }] }, 'the dam took no Echo, or both fragments')],
  },
  {
    questId: 'q_preserve_or_heal',
    outcome: 'dammed_dark',
    name: 'Loop 2: the Heartstone destroyed; the leak dammed with the dead fragment, the fen dark',
    classId: CLASS,
    seed: 'quest:preserve:dark',
    profile: { loop: 2, echoes: ['echo_mireya_bond'], bestLevel: 17 },
    steps: [...mireyaChose('dam_dead', 'dammed_dark', loop2RoadEastBy('destroy', 'done_destroy')), holds({ echo: 'echo_glowfen_dammed' }, 'the dark dam took no Echo')],
  },
  {
    questId: 'q_preserve_or_heal',
    outcome: 'let_run',
    name: 'Loop 2: the leak let run',
    classId: CLASS,
    seed: 'quest:preserve:run',
    profile: { loop: 2, echoes: ['echo_mireya_bond'], bestLevel: 17 },
    steps: [...mireyaChose('run', 'let_run'), holds({ echo: 'echo_glowfen_let_run' }, 'letting it run took no Echo')],
  },
  // ---- U56 · q_the_apprentices_errand (Loop 2 by the Nexus door: Last Bell at noon; the Yard; he joins) ----
  {
    questId: 'q_the_apprentices_errand',
    outcome: 'joined',
    name: "Loop 2: the noon message walked to the Spire Yard on Last Bell; Aulde's verse; Caelum joins",
    classId: CLASS,
    seed: 'quest:errand',
    profile: { loop: 2, echoes: ['echo_litany_verse_1'], bestLevel: 17 },
    steps: caelumJoined,
  },
  // ---- U56 · q_a_boy_from_a_doomed_city (after the errand: the Gate after dusk; he comes, or stays) ----
  {
    questId: 'q_a_boy_from_a_doomed_city',
    outcome: 'crossed',
    name: 'Loop 2: the Breach-door from the Before side; he comes, and walks out beside you to the Nexus',
    classId: CLASS,
    seed: 'quest:boy:come:b2a', // U81b2 re-seed (cooldowns, the Tyrant, the lethal fights retuned);
    profile: { loop: 2, echoes: ['echo_litany_verse_1'], bestLevel: 17 },
    steps: [
      ...caelumAtTheDoor('come', 'crossed'),
      { type: 'move', to: 'loc_chronos_nexus' },
      holds({ all: [CAELUM_RECRUITED, { echo: 'echo_caelum_unanchored' }, { location: 'loc_chronos_nexus' }] }, 'Caelum did not come through the door'),
    ],
  },
  {
    questId: 'q_a_boy_from_a_doomed_city',
    outcome: 'stayed',
    name: 'Loop 2: the Breach-door from the Before side; he stays with his city',
    classId: CLASS,
    seed: 'quest:boy:stay',
    profile: { loop: 2, echoes: ['echo_litany_verse_1'], bestLevel: 17 },
    steps: [...caelumAtTheDoor('stay', 'stayed'), holds({ all: [{ echo: 'echo_caelum_stayed' }, { not: CAELUM_RECRUITED }] }, 'Caelum did not stay')],
  },
  // ---- U56 · q_his_masters_sin (Loop 3: crossed and Loyal; the communion with him beside you; the one thing) ----
  {
    questId: 'q_his_masters_sin',
    outcome: 'forgiven',
    name: 'Loop 3: Caelum crossed, Loyal; the communion carried through; he forgives',
    classId: CLASS,
    seed: 'quest:sin:forgive',
    profile: { loop: 3, echoes: SIN_ECHOES, bestLevel: 17 },
    steps: [...caelumAtTheApex, { talk: 'npc_caelum', pick: ['forgive'] }, done('q_his_masters_sin', 'forgiven'), holds({ echo: 'echo_caelum_forgives' }, 'he did not forgive')],
  },
  {
    questId: 'q_his_masters_sin',
    outcome: 'cannot',
    name: 'Loop 3: Caelum crossed, Loyal; the communion carried through; he cannot forgive',
    classId: CLASS,
    seed: 'quest:sin:cannot',
    profile: { loop: 3, echoes: SIN_ECHOES, bestLevel: 17 },
    steps: [...caelumAtTheApex, { talk: 'npc_caelum', pick: ['cannot'] }, done('q_his_masters_sin', 'cannot'), holds({ echo: 'echo_caelum_cannot' }, 'he did not say it')],
  },
  // ---- U57 · q_bell_vault (Loop 2: the Door of Pages known, the Warden's name; the puzzle, or the fountain's order) ----
  {
    questId: 'q_bell_vault',
    outcome: 'water_drops',
    name: 'Loop 2: the flooded stair, the Deep by the Warden of Waters\' name, the bells rung Plaza, Gate, Archive',
    classId: CLASS,
    seed: 'quest:bells',
    profile: { loop: 2, echoes: ['echo_archive_door', 'echo_rhune_choice'], bestLevel: 17 },
    steps: bellsRung(['first_plaza', 'then_gate']),
  },
  {
    questId: 'q_bell_vault',
    outcome: 'water_drops',
    name: 'Loop 2: the same, with the Plaza fountain\'s order known (echo_bells_of_silverwood)',
    classId: CLASS,
    seed: 'quest:bells:fountain',
    profile: { loop: 2, echoes: ['echo_archive_door', 'echo_rhune_choice', 'echo_bells_of_silverwood'], bestLevel: 17 },
    steps: bellsRung(['fountain_order']),
  },
  // ---- U57 · q_bone_road (Loop 2 with the trail-signs: Hearthring, Borin's mark, the two ambushes, the ember-bowl) ----
  {
    questId: 'q_bone_road',
    outcome: 'done',
    name: 'Loop 2: Hadda\'s ask, Borin\'s mark, the Cairns and the Pan cleared, verse IV and the iron that does not wish, the waystones',
    classId: CLASS,
    seed: 'quest:bone:mark:1:6', // U81c re-seed: a flight now falls back and a quest-drop group regroups at dawn (D-143, D-144). A seed that wins: two Stalkers at the Cairns beat a carry-over L10 ranger about half the time (the balance unit)
    profile: { loop: 2, echoes: ['echo_ironclad_passwords', 'echo_nomad_signs'], bestLevel: 17 },
    steps: boneRoad(true),
  },
  {
    questId: 'q_bone_road',
    outcome: 'done',
    name: 'Loop 2: the same without Borin\'s mark (the ember, verse IV; not the iron)',
    classId: CLASS,
    seed: 'quest:bone:plain:b2a:u84:2', // U84 re-seed: the wilds go quiet after a fight (DESIGN §10.1) // U81b2 re-seed (cooldowns, the Tyrant, the lethal fights retuned);
    profile: { loop: 2, echoes: ['echo_ironclad_passwords', 'echo_nomad_signs'], bestLevel: 17 },
    steps: boneRoad(false),
  },
  // ---- U57 · q_lightless_stair (Loop 2 with the Hollow's path: the curtain, the dark, the Choir) ----
  {
    questId: 'q_lightless_stair',
    outcome: 'choir',
    name: 'Loop 2: the curtain\'s stair taken without a light, the Mouth and the Stair fled, the Choir reached; Ysmay',
    classId: CLASS,
    seed: 'quest:lightless:b2a', // U81b2 re-seed (cooldowns, the Tyrant, the lethal fights retuned);
    profile: { loop: 2, echoes: ['echo_hollow_path'], bestLevel: 17 },
    steps: lightlessStair,
  },
  // ---- U57 · q_the_drowned_lantern (Loop 2, an elf: the Glowfen by the Depths and the Highlands; the boat raised) ----
  {
    questId: 'q_the_drowned_lantern',
    outcome: 'done',
    name: 'Loop 2: Wen\'s ask, the Reed Maze, the boat raised and lit with Glow Moss, Lanternreed\'s trust',
    classId: 'elf',
    seed: 'quest:drowned_lantern',
    profile: { loop: 2, echoes: ['echo_heartstone_path'], bestLevel: 17 },
    steps: drownedLantern,
  },
  // ---- U57 · q_high_mark (Loop 1 open: the legacy route to the Outpost, then the Plateau's stair; Loop 2: Dask gives it) ----
  {
    questId: 'q_high_mark',
    outcome: 'seen',
    name: 'Loop 1: the legacy route through the Outpost, the stair in the wind found on the Plateau, the Breach\'s edge seen',
    classId: CLASS,
    seed: 'quest:highmark',
    steps: [...routeToOutpost, { rest: 1 }, ...highMarkClimbed],
  },
  {
    questId: 'q_high_mark',
    outcome: 'seen',
    name: 'Loop 2: Dask at the Pass gives the High Mark; the climb with him; the edge seen',
    classId: CLASS,
    seed: 'quest:highmark:dask',
    profile: { loop: 2, echoes: ['echo_heartstone_path'], bestLevel: 17 },
    steps: highMarkByDask,
  },
  // ---- U57 · q_the_still_shore (Loop 2's first Fall: the four places; look back, or step through) ----
  {
    questId: 'q_the_still_shore',
    outcome: 'done_looked',
    name: 'Loop 2 → the Shore: the Gallery, the Loom, the Far Light; looking back at the water (the figure, the six)',
    classId: CLASS,
    seed: 'quest:shore:look',
    profile: { loop: 2, bestLevel: 17 },
    steps: [...stillShore('look_back', 'done_looked'), holds({ echo: 'echo_six_in_the_mass' }, 'the figure was not seen')],
  },
  {
    questId: 'q_the_still_shore',
    outcome: 'done',
    name: 'Loop 2 → the Shore: the same, stepping into the light without looking back',
    classId: CLASS,
    seed: 'quest:shore:step',
    profile: { loop: 2, bestLevel: 17 },
    steps: [...stillShore('step', 'done'), holds({ not: { echo: 'echo_six_in_the_mass' } }, 'the figure was seen without looking')],
  },
  // ---- U58 · q_the_thirtieth_dawn (Loop 2: Dray's count against the water) ----
  {
    questId: 'q_the_thirtieth_dawn',
    outcome: 'done',
    name: "Loop 2: Dray's ask, one watch at the Depths, the number against the water-clock",
    classId: CLASS,
    seed: 'quest:dawn',
    profile: { loop: 2, echoes: ['echo_heartstone_path'], bestLevel: 10 }, // the Depths' passage opens to the Echo
    steps: thirtiethDawn,
  },
  // ---- U58 · q_what_the_crystal_heard (Loop 2 with the Nine Voices; the Crystal kept; the Crystal route of the unmasking) ----
  {
    questId: 'q_what_the_crystal_heard',
    outcome: 'heard',
    name: 'Loop 2: the Crystal kept, the Echo line at the lip, the eighth voice in her own; her secret kept (Loyal)',
    classId: CLASS,
    seed: 'quest:crystal_heard:safe',
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_nine_voices'], bestLevel: 10 },
    steps: [...crystalHeard('safe'), holds({ not: { flag: 'flag_nyx_hostile' } }, 'Nyx turned Hostile')],
  },
  {
    questId: 'q_what_the_crystal_heard',
    outcome: 'heard',
    name: 'Loop 2: the same, the Choir told',
    classId: CLASS,
    seed: 'quest:crystal_heard:choir',
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_nine_voices'], bestLevel: 10 },
    steps: [...crystalHeard('choir'), holds({ flag: 'flag_nyx_hostile' }, 'Nyx did not turn Hostile')],
  },
  // ---- U58 · q_the_first_drowned (Loop 2 with the First Drowned met: the carrel without drawing) ----
  {
    questId: 'q_the_first_drowned',
    outcome: 'given',
    name: 'Loop 2: the scroll asked for, the carrel approached without drawing, the Amulet held up; verse I in her voice',
    classId: CLASS,
    seed: 'quest:drowned:listen',
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_oriel_drowned'], bestLevel: 10 },
    steps: firstDrowned('listen'),
  },
  // ---- U58 · q_stop_the_ritual (Loop 3 with Caelum's bond: the four attempts, the dome) ----
  {
    questId: 'q_stop_the_ritual',
    outcome: 'inevitable',
    name: 'Loop 3: the fair copy, Veyran warned, Hallow kept and the cradle (by the tear), Masque on the dome',
    classId: CLASS,
    seed: 'quest:ritual',
    profile: { loop: 3, echoes: SIN_ECHOES.filter((e) => e !== 'echo_litany_verse_4' && e !== 'echo_litany_verse_7' && e !== 'echo_hallow_said_stop' && e !== 'echo_ritual_inevitable'), bestLevel: 17 },
    steps: stopTheRitual,
  },
  // ---- U58 · the ending quests ----
  {
    questId: 'q_wardens_vigil',
    outcome: 'stepped_in',
    name: "Loop 4 with every verse: Dask's ask, the communion past six, the ninth said (ending A)",
    classId: CLASS,
    seed: 'quest:vigil',
    profile: { loop: 4, echoes: [...SIN_ECHOES.filter((e) => e !== 'echo_caelum_bond'), 'echo_dask_bond', 'echo_litany_verse_5', 'echo_litany_verse_8', 'echo_litany_verse_9'], bestLevel: 17 },
    steps: wardensVigil,
  },
  {
    questId: 'q_the_mending',
    outcome: 'mended',
    name: "the Resolution with the Mending on offer (the sim's ending_b_ready): the words, then consent (ending B)",
    classId: CLASS,
    seed: 'quest:mending',
    scenario: 'ending_b_ready',
    steps: [{ type: 'commune', act: 'speak', answerId: 'consent_mending' }, done('q_the_mending', 'mended'), holds({ echo: 'echo_tyrant_consent' }, 'consent was not granted')],
  },
  {
    questId: 'q_weavers_dawn',
    outcome: 'dawn',
    name: "Loop 2 with the sign and Nyx's bond: her arc, the Heartstone exploited, her ask, the Apex and the hold's failing (ending C)",
    classId: CLASS,
    seed: 'quest:dawn:c:4:u9:u84:35', // U84 re-seed: the wilds go quiet after a fight (DESIGN §10.1) // U81b2 re-seed (cooldowns, the Tyrant, the lethal fights retuned); // U81c re-seed: a flight now falls back and a quest-drop group regroups at dawn (D-143, D-144)
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_nyx_bond', 'echo_weaver_sign', 'echo_apex_resonance'], bestLevel: 20 },
    steps: weaversDawn,
  },
  {
    questId: 'q_iron_silence',
    outcome: 'silence',
    name: "Loop 3 with the oath, the iron and the design: the makings first, the Heartstone destroyed, Hadda's ask, the forge, the Apex with Brak (ending D)",
    classId: 'ironclad_warden',
    seed: 'quest:silence',
    profile: { loop: 3, echoes: IRON_SILENCE_ECHOES, bestLevel: 20 },
    steps: ironSilence,
  },
  {
    questId: 'q_long_archive',
    outcome: 'remembered',
    name: "Loop 3 with Ilyra's bond: the Keeper, the Heartstone stabilized, Dray's ask, the vigil to the last dawn (ending E)",
    classId: CLASS,
    seed: 'quest:archive',
    profile: { loop: 3, echoes: ['echo_ilyra_watchword', 'echo_crystal_location', 'echo_archive_door', 'echo_ilyra_bond', 'echo_ilyra_cost'], bestLevel: 17 },
    steps: longArchive,
  },
  {
    questId: 'q_unbound',
    outcome: 'gone',
    name: 'Loop 2 with the Tyrant\'s Echo: the road east, the communion with silence at the gaps, the tear stepped through (ending F)',
    classId: CLASS,
    seed: 'quest:unbound',
    profile: { loop: 2, echoes: ['echo_tyrant_speaks', 'echo_apex_resonance'], bestLevel: 17 },
    steps: unbound,
  },
  // ---- U59 · the class mini-quests (Loop 2, each by its class; STORY §11.8) ----
  {
    questId: 'q_class_ranger',
    outcome: 'home',
    name: "Loop 2, a Ranger: Kaelen's salt-runner, the ground read, the snare at the drag-line, the runner home; the ledger",
    classId: 'ranger',
    seed: 'quest:class:ranger',
    profile: { loop: 2, bestLevel: 17 },
    steps: unmarkedTrail,
  },
  {
    questId: 'q_class_wizard',
    outcome: 'copied',
    name: "Loop 2, a Wizard: Tamsin's page read by ley-light at night; Korr's hand copied (Corruption +1, the margins)",
    classId: 'wizard',
    seed: 'quest:class:wizard:copy',
    profile: { loop: 2, bestLevel: 17 },
    steps: seventhPage('copy'),
  },
  {
    questId: 'q_class_wizard',
    outcome: 'burned',
    name: 'Loop 2, a Wizard: the same, the page burned on the rim (Remnants +5)',
    classId: 'wizard',
    seed: 'quest:class:wizard:burn',
    profile: { loop: 2, bestLevel: 17 },
    steps: seventhPage('burn'),
  },
  {
    questId: 'q_class_elf',
    outcome: 'won',
    name: "Loop 2, an Elf: the Archway's whisper followed to the Plaza at dusk, the buried duel drawn and won (Bladesong)",
    classId: 'elf',
    seed: 'quest:class:elf:draw',
    profile: { loop: 2, bestLevel: 17 },
    steps: bladesong('draw'),
  },
  {
    questId: 'q_class_elf',
    outcome: 'passed',
    name: 'Loop 2, an Elf: the same, standing still and letting it pass (Shadowstep)',
    classId: 'elf',
    seed: 'quest:class:elf:still',
    profile: { loop: 2, bestLevel: 17 },
    steps: bladesong('still'),
  },
  {
    questId: 'q_class_ironclad_warden',
    outcome: 'tempered',
    name: "Loop 2, a Warden: Brak's gap held through three waves at night, the plate tempered by Borin",
    classId: 'ironclad_warden',
    seed: 'quest:class:warden',
    profile: { loop: 2, bestLevel: 17 },
    steps: wallThatHolds,
  },
  {
    questId: 'q_class_shadow_weaver',
    outcome: 'one_of_us',
    name: "Loop 2, a Shadow Weaver: the seam at the Hollow at night, a Stalker hexed onto its pack, the Shard left; the line she says to no one else",
    classId: 'shadow_weaver',
    seed: 'quest:class:weaver:leave',
    profile: { loop: 2, bestLevel: 17 },
    steps: unlitThread('leave'),
  },
  {
    questId: 'q_class_shadow_weaver',
    outcome: 'remembered',
    name: 'Loop 2, a Shadow Weaver: the same, the Shard taken (no line, no +5)',
    classId: 'shadow_weaver',
    seed: 'quest:class:weaver:take:37:u84:38', // U84 re-seed: the wilds go quiet after a fight (DESIGN §10.1) // U81c re-seed: a flight now falls back and a quest-drop group regroups at dawn (D-143, D-144)
    profile: { loop: 2, bestLevel: 17 },
    steps: unlitThread('take'),
  },
];

// ---- Running a proof --------------------------------------------------------------------------------------------------------

/** Rest when HP is under this share and a bed is here (a full rest where listed, else a short one). */
export const TRAINED_REST_BELOW = 0.75;
/** With no bed here, drink the best healing draught carried under this share. */
export const TRAINED_DRINK_BELOW = 0.5;
/** `melee`'s trade rows, except that nothing is ever sold (a quest's materials — the Void Shards — stay in the pack). */
export const TRAINED_TRADE: TradeCfg = { ...MELEE_TRADE, sellBelowGold: 0, shop: false }; // U82: the proofs keep U81's shopping (no gear, no forge work)
/** U81a (D-123): while the anchor is to be forged (`q_the_mending`, `q_iron_silence` active), no upgrade spends its ember ore. */
const ANCHOR_QUESTS: readonly string[] = ['q_the_mending', 'q_iron_silence'];
const tradeFor = (s: GameState): TradeCfg => (ANCHOR_QUESTS.some((q) => s.quests[q]?.status === 'active') ? { ...TRAINED_TRADE, upgrade: false } : TRAINED_TRADE);

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
        // U81c (D-144): while a fled group is away for the day, no sleeping to the dawn that brings it back
        const today = dayOf(state.clock.ticks);
        const away = Object.values(state.world.locationStates).some((ls) => Object.values(ls.encounterClearedDay).some((d) => d === today));
        const full = legal.find((a) => a.type === 'rest' && a.kind === 'full');
        const short = legal.find((a) => a.type === 'rest' && a.kind === 'short');
        const rest = away ? short : (full ?? short);
        const mend = hp < TRAINED_REST_BELOW ? (rest ?? (hp < TRAINED_DRINK_BELOW ? bestDrink(env) : undefined)) : undefined;
        const own = pickStat(legal, 'strength') ?? pickUnlock(env, meleeUnlockRank) ?? pickEquip(env) ?? mend ?? pickTrade(env, tradeFor(state));
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
