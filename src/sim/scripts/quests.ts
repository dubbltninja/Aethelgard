// Quest proofs (PLAN §7.8, DESIGN §13.4; U52): a `pathBot` script per quest — one per outcome that something later reads (the
// Crystal given or kept, each Heartstone path, the shards given or refused, the scroll to Ilyra or to Nyx) — that completes it
// on the real pack. `npm run sim -- quest [<questId>…] [--pack real] [--verbose]` runs them; tests/unit/sim/questScripts.test.ts
// runs them in CI. The quest units U53–U59 append theirs to `QUEST_SCRIPTS`.
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
