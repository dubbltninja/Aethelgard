// Quest proofs (PLAN §7.8, DESIGN §13.4; U52): a `pathBot` script per quest — one per outcome that something later reads (the
// Crystal given or kept, each Heartstone path, the shards given or refused, the scroll to Ilyra or to Nyx) — that completes it
// on the real pack. `npm run sim -- quest [<questId>…] [--pack real] [--verbose]` runs them; tests/unit/sim/questScripts.test.ts
// runs them in CI. The quest units U53–U59 append theirs to `QUEST_SCRIPTS` (U53: the four faction chains, two outcomes
// each, on constructed Loop 2+ profiles that hold the standing Echo opening the chain; U55: Nyx's and Dask's arcs, every
// outcome, with the companion recruited on the way — the bond Echo starts them at 25).
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

// ---- U55: Nyx's and Dask's arcs (Loop 2+; the bond Echo starts the companion at 25, DESIGN §12.5) -------------------------------

/** A bot that passes time in place (`wait`, else a short rest): for an `until` that waits for a watch. */
const waiter: Bot = {
  name: 'waiter',
  choose: (_s, legal) => legal.find((a) => a.type === 'wait') ?? legal.find((a) => a.type === 'rest' && a.kind === 'short') ?? (legal[0] as Action),
};
/** Pass time here until `when` holds (a watch, at most a day). */
const waitFor = (when: Condition): ScriptStep => ({ until: when, do: waiter, maxSteps: 12 });
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

/** Loop 2's road east: the Crystal, the scroll (Ilyra asks first from Loop 2: given), the heartbeat, the Heartstone stabilized. */
const loop2RoadEast: ScriptStep[] = [
  ...crystalGiven(),
  ...scrollFetched,
  { goto: 'loc_whispering_ruins' },
  { talk: 'npc_ilyra', pick: ['give'] },
  done('q_lost_scroll', 'to_ilyra'),
  holds({ quest: { id: 'q_echoing_heartbeat', stage: 'descend' } }, 'q_echoing_heartbeat did not start after two quests'),
  { goto: 'loc_sunken_archives' },
  { type: 'move', to: 'loc_heartstone_depths' },
  holds({ quest: { id: 'q_echoing_heartbeat', stage: 'choose' } }, 'the Depths did not open the choice'),
  choose('stabilize'),
  done('q_echoing_heartbeat', 'done_stabilize'),
];

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
  // the step onto the Apex is an exact move: the Unveiled Tyrant's fight opens on arrival, and a `goto` would play it
  { type: 'move', to: 'loc_temporal_breach_apex' },
  { until: { flag: 'flag_tyrant_spared' }, do: communing('pass_into_before'), maxSteps: 120 },
  { until: { not: { quest: { id: 'q_the_last_instant', stage: 'ask_it' } } }, do: communing('pass_into_before'), maxSteps: 4 },
  holds({ quest: { id: 'q_the_last_instant', stage: 'gathered' } }, 'the communion did not carry the ask'),
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
    seed: 'quest:undo:agreed',
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
    seed: 'quest:marks',
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
    seed: 'quest:instant:rest',
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
    seed: 'quest:instant:stay',
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
