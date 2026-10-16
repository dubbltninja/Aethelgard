// U38: the policy rows of caster, explorer, speedrunner and pacifist (PLAN §7.2), each on a state built for it: the Apex
// prompt, the Threshold, the merchant, the communion's rejection, a boss fight for the caster, the quest rows. A bot is a
// pure function of (state, legal, content, memory, ctx), so these hand it `legalActions` and check what it picks.
import { describe, expect, test } from 'bun:test';
import {
  APEX_LOCATION_ID,
  legalActions,
  playerOf,
  step,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import { casterBot } from '@sim/bots/caster';
import { explorerBot } from '@sim/bots/explorer';
import { pacifistBot } from '@sim/bots/pacifist';
import { digest, gateQuestCount, needsQuest, notesOf, questDistance, questsHeld, shunned, type Env } from '@sim/bots/policy';
import { actionKey, pendingFights } from '@sim/bots/shared';
import { speedrunnerBot } from '@sim/bots/speedrunner';
import type { Bot, BotContext, BotMemory } from '@sim/bots/types';
import { loadScenario, type ScenarioId } from '@sim/scenarios';
import { economyPack } from '@tests/fixtures/economyContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { hordePack } from '@tests/fixtures/hordeContent';
import { fixturePack } from '@tests/fixtures/miniContent';
import { storyPack } from '@tests/fixtures/storyContent';
import { thresholdPack } from '@tests/fixtures/thresholdContent';

const content = fixturePack();
const profile = freshProfile();
const RUINS = 'loc_whispering_ruins';
const LIBRARY = 'loc_shattered_library';
const PLAZA = 'loc_silverwood_plaza';
const TONIC = 'item_ley_touched_tonic';
const REJECTED_KEY = 'commune:rejected';

type LocState = GameState['world']['locationStates'][string];
const locState = (over: Partial<LocState> = {}): LocState => ({
  visited: false,
  visitCount: 0,
  items: [],
  itemsSpawned: true,
  encountersCleared: [],
  encounterClearedDay: {},
  eventsFired: [],
  flags: {},
  unlockedExits: [],
  lockedExits: [],
  scattered: [],
  encounterHp: {},
  ...over,
});
const ctxOf = (p: Profile = profile, recentEvents: GameEvent[] = []): BotContext => ({ profile: p, rngSeed: 'test', step: 0, recentEvents });
const edit = <T,>(s: T, fn: (d: T) => void): T => {
  const d = structuredClone(s);
  fn(d);
  return d;
};
/** One choice of `bot` on `s` with the engine's legal list (asserted to come from it). */
function pick(bot: Bot, s: GameState, c: ContentPack = content, p: Profile = profile, memory: BotMemory = {}, events: GameEvent[] = []): Action {
  const legal = legalActions(s, c, p);
  const a = bot.choose(s, legal, c, memory, ctxOf(p, events));
  expect(legal.map(actionKey)).toContain(actionKey(a));
  return a;
}
const combatOf = (s: GameState): NonNullable<GameState['combat']> => s.combat as NonNullable<GameState['combat']>;
const envOf = (s: GameState, c: ContentPack = content, p: Profile = profile): Env => ({ s, legal: legalActions(s, c, p), content: c, profile: p, n: notesOf({}, 'test') });

const BOTS_UNDER_TEST: readonly (readonly [string, () => Bot])[] = [
  ['caster', casterBot],
  ['explorer', explorerBot],
  ['speedrunner', speedrunnerBot],
  ['pacifist', pacifistBot],
];

/** The Apex prompt of Loop 1 with a character of this level. */
const apexPrompt = (level: number) => {
  const { state, profile: p } = loadScenario('pre_tyrant_l13_ranger', hordePack());
  return { state: edit(state, (d) => (d.player.level = level)), profile: p };
};

describe('the Loop 1 Apex prompt: Face it only when ready (PLAN §7.2)', () => {
  test('a Level 1 character says Not yet, with every bot', () => {
    const { state, profile: p } = apexPrompt(1);
    for (const [, make] of BOTS_UNDER_TEST) expect(pick(make(), state, hordePack(), p)).toEqual({ type: 'choose', choiceId: 'not_yet' });
  });

  test('a Level 13 character faces it — except the pacifist, who never starts a fight', () => {
    const { state, profile: p } = apexPrompt(13);
    for (const [name, make] of BOTS_UNDER_TEST) {
      const a = pick(make(), state, hordePack(), p);
      expect(a).toEqual({ type: 'choose', choiceId: name === 'pacifist' ? 'not_yet' : 'face_it' });
    }
  });

  test('declining is remembered: the same level is not asked twice', () => {
    const { state, profile: p } = apexPrompt(1);
    const bot = explorerBot();
    const memory: BotMemory = {};
    expect(pick(bot, state, hordePack(), p, memory)).toEqual({ type: 'choose', choiceId: 'not_yet' });
    const notes = notesOf(memory, 'explorer');
    expect(notes.apexDeclined).toBe(`${state.meta.runId}:1`);
  });
});

describe('the Threshold: every bot spends, equips and starts the next loop', () => {
  test.each(BOTS_UNDER_TEST)('%s', (_name, make) => {
    const pack = thresholdPack();
    const b = loadScenario('loop2_end', pack);
    let s = b.state;
    let p = b.profile;
    const bot = make();
    const memory: BotMemory = bot.init?.('thr') ?? {};
    const played: string[] = [];
    for (let i = 0; i < 40 && s.mode === 'threshold'; i++) {
      const legal = legalActions(s, pack, p);
      const a = bot.choose(s, legal, pack, memory, ctxOf(p));
      expect(legal.map(actionKey)).toContain(actionKey(a));
      played.push(a.type);
      const out = step(s, a, pack, p);
      expect(out.events.some((e) => e.t === 'actionRejected')).toBe(false);
      s = out.state;
      p = out.profile;
    }
    expect(s.mode).not.toBe('threshold');
    expect(played.at(-1)).toBe('newLoop');
    expect(played).toContain('thresholdGo');
  });
});

describe('the merchant', () => {
  const arrive = (gold: number, items: string[]) => {
    const s = makeState({
      locationId: LIBRARY,
      gold,
      items,
      patch: (d) => {
        d.player.apHalf = 0;
        d.world.locationStates[LIBRARY] = locState({ visited: true, visitCount: 1, encountersCleared: ['enc_library_shades'] });
      },
    });
    return step(s, { type: 'move', to: PLAZA }, content, profile).state;
  };

  test.each(BOTS_UNDER_TEST.filter(([n]) => n !== 'speedrunner'))('%s sells spare gear when poor', (_name, make) => {
    const spare = arrive(0, ['item_rusty_dagger']);
    const sell = pick(make(), spare);
    expect(sell).toMatchObject({ type: 'sell' });
  });

  test.each(BOTS_UNDER_TEST.filter(([n]) => n !== 'speedrunner'))('%s buys healing when flush', (_name, make) => {
    expect(pick(make(), arrive(100, []))).toMatchObject({ type: 'buy' });
    expect(pick(make(), arrive(100, [TONIC, TONIC, TONIC, TONIC]))).not.toMatchObject({ type: 'buy', merchantId: 'x' });
  });

  test('the speedrunner does not shop', () => {
    expect(pick(speedrunnerBot(), arrive(100, []))).not.toMatchObject({ type: 'buy' });
    expect(pick(speedrunnerBot(), arrive(0, ['item_rusty_dagger']))).not.toMatchObject({ type: 'sell' });
  });
});

describe('the communion', () => {
  const rejected = () => {
    const { state, profile: p } = loadScenario('communion_movement_2', hordePack());
    const s = edit(state, (d) => {
      const c = combatOf(d);
      c.communion = null;
      const boss = c.enemies.find((e) => e.refId.startsWith('cr_chronos_tyrant')) as NonNullable<typeof c.enemies[number]>;
      boss.pattern.firedOnce.push(REJECTED_KEY);
    });
    return { s, p };
  };

  test('after a rejection the speedrunner and the pacifist leave (flee closes the loop); the caster fights on', () => {
    const { s, p } = rejected();
    const legal = legalActions(s, hordePack(), p);
    expect(legal.some((a) => a.type === 'flee')).toBe(true);
    expect(pick(speedrunnerBot(), s, hordePack(), p)).toEqual({ type: 'flee' });
    expect(pick(pacifistBot(), s, hordePack(), p)).toEqual({ type: 'flee' });
    expect(pick(casterBot(), s, hordePack(), p).type).not.toBe('flee');
  });

  test('the caster opens by communing, answers with what it holds and forfeits a question nothing answers with a blow', () => {
    const { state, profile: p } = loadScenario('communion_movement_2', hordePack());
    const a = pick(casterBot(), state, hordePack(), p);
    expect(['commune', 'attack', 'ability']).toContain(a.type);
    if (a.type === 'commune') expect(['speak', 'listen', 'offer']).toContain(a.act);
  });

  test('the Explorer never communes', () => {
    const { state, profile: p } = loadScenario('communion_movement_2', hordePack());
    expect(pick(explorerBot(), state, hordePack(), p).type).not.toBe('commune');
  });
});

describe('caster: combat rows', () => {
  const boss = (classId: string) => loadScenario('combat_tyrant_contained_p2', hordePack(), { classId });

  test('a Weaver hexes the boss first (Weaken or Curse)', () => {
    const { state, profile: p } = boss('shadow_weaver');
    const a = pick(casterBot(), state, hordePack(), p);
    expect(a).toMatchObject({ type: 'ability', abilityId: 'wvr_hex_of_frailty' });
  });

  test('a Wizard picks the spell worth the most, an area spell for several foes', () => {
    const { state, profile: p } = boss('wizard');
    expect(pick(casterBot(), state, hordePack(), p)).toMatchObject({ type: 'ability' });
  });

  test('below 35 % it drinks the biggest heal, else guards', () => {
    const { state, profile: p } = boss('wizard');
    const hurt = edit(state, (d) => {
      playerOf(combatOf(d)).hp = 5;
    });
    const a = pick(casterBot(), hurt, hordePack(), p);
    expect(['item', 'ability', 'guard']).toContain(a.type);
    const dry = edit(hurt, (d) => {
      d.player.inventory = [];
    });
    expect(['guard', 'ability', 'attack']).toContain(pick(casterBot(), dry, hordePack(), p).type);
  });

  test('a Weaver pays no blood while hurt', () => {
    const { state, profile: p } = boss('shadow_weaver');
    const hurt = edit(state, (d) => {
      playerOf(combatOf(d)).hp = Math.floor(playerOf(combatOf(d)).hpMax * 0.5);
      d.player.inventory = [];
    });
    const a = pick(casterBot(), hurt, hordePack(), p);
    expect(a.type).toBeDefined();
  });

  test('with no mana it guards for it (below half hp) or strikes with the basic attack', () => {
    const { state, profile: p } = boss('wizard');
    const drained = edit(state, (d) => {
      playerOf(combatOf(d)).mp = 0;
      playerOf(combatOf(d)).hp = Math.floor(playerOf(combatOf(d)).hpMax * 0.45);
      d.player.inventory = [];
    });
    expect(['guard', 'attack']).toContain(pick(casterBot(), drained, hordePack(), p).type);
    const fine = edit(drained, (d) => {
      playerOf(combatOf(d)).hp = playerOf(combatOf(d)).hpMax;
    });
    expect(pick(casterBot(), fine, hordePack(), p).type).toBe('attack');
  });
});

describe('explorer and pacifist: fights', () => {
  const fight = (id: ScenarioId, classId = 'ranger') => loadScenario(id, hordePack(), { classId });

  test('the explorer runs from a fight four levels above it, when it can be fled', () => {
    const { state, profile: p } = loadScenario('first_fight', content);
    const stronger = edit(state, (d) => {
      for (const e of combatOf(d).enemies) e.level = d.player.level + 4;
    });
    expect(pick(explorerBot(), stronger, content, p)).toEqual({ type: 'flee' });
    expect(pick(explorerBot(), state, content, p).type).not.toBe('flee');
  });

  test('the pacifist flees whenever it can, guards when it cannot, and strikes only when forced', () => {
    const { state, profile: p } = loadScenario('first_fight', content);
    expect(pick(pacifistBot(), state, content, p)).toEqual({ type: 'flee' });
    const memory: BotMemory = {};
    const noFlee = (s: GameState): Action[] => legalActions(s, content, p).filter((a) => a.type !== 'flee');
    const bot = pacifistBot();
    const a = bot.choose(state, noFlee(state), content, memory, ctxOf(p));
    expect(['guard', 'companionCommand', 'item', 'ability']).toContain(a.type);
    // hurt past what Guard covers, with nothing to drink: a forced blow, counted
    const doomed = edit(state, (d) => {
      playerOf(combatOf(d)).hp = 1;
      d.player.inventory = [];
    });
    const forced = bot.choose(doomed, noFlee(doomed), content, memory, ctxOf(p));
    expect(['attack', 'ability', 'guard']).toContain(forced.type);
    expect(notesOf(memory, 'pacifist').forced).toBeGreaterThanOrEqual(1);
    expect(fight('first_fight').state.mode).toBe('combat');
  });

  test('the pacifist stands and fights where fleeing only sends it back to a place that always bounces it', () => {
    const { state, profile: p } = loadScenario('first_fight', content);
    const memory: BotMemory = {};
    const bot = pacifistBot();
    const key = `${state.meta.runId}|${state.world.currentLocationId}`;
    const walled = edit(state, (d) => {
      d.world.previousLocationId = RUINS;
      d.world.currentLocationId = LIBRARY;
    });
    notesOf(memory, 'pacifist').bounces[key.replace(state.world.currentLocationId, LIBRARY)] = 4;
    // the only way home passes the place itself: the bot would have to run through it to reach the portal
    const a = bot.choose(walled, legalActions(walled, content, p), content, memory, ctxOf(p));
    expect(a.type).toBeDefined();
  });
});

describe('policy helpers', () => {
  test('digest: a fled fight counts against the place that bounced the bot; a fall is noted at its level', () => {
    const n = notesOf({}, 'x');
    const events = (...e: GameEvent[]): GameEvent[] => e;
    digest(n, events({ t: 'locationEntered', locationId: 'loc_b' } as GameEvent, { t: 'combatStarted' } as GameEvent), 'run1');
    expect(n.lastFightAt).toBe('loc_b');
    digest(n, events({ t: 'combatEnded', result: 'fled', rounds: 1, xp: 0, gold: 0, loot: [] }), 'run1');
    digest(n, events({ t: 'combatEnded', result: 'fled', rounds: 1, xp: 0, gold: 0, loot: [] }), 'run1');
    expect(n.bounces['run1|loc_b']).toBe(2);
    n.lastLevel = 3;
    digest(n, events({ t: 'playerDied', loop: 1 }), 'run1');
    expect(n.fellAt['loc_b']).toBe(3);
  });

  test('shunned: a place where the player fell at this level, or that keeps bouncing it', () => {
    const s = makeState({ level: 2 });
    const env = envOf(s);
    env.n.fellAt['loc_a'] = 2;
    env.n.bounces[`${s.meta.runId}|loc_c`] = 4;
    expect(shunned(env, 'loc_a')).toBe(true);
    expect(shunned(env, 'loc_c')).toBe(true);
    expect(shunned(env, 'loc_b')).toBe(false);
    env.n.fellAt['loc_a'] = 1;
    expect(shunned(env, 'loc_a')).toBe(false);
  });

  test('the gate names a quest count; the speedrunner needs a quest until it holds that many', () => {
    expect(gateQuestCount(content)).toBe(1);
    const s = makeState({ locationId: RUINS });
    expect(needsQuest(envOf(s))).toBe(true);
    const held = makeState({ locationId: RUINS, quests: { q_echo_crystal: 'crystal_found' } });
    expect(questsHeld(held, content)).toBe(1);
    expect(needsQuest(envOf(held))).toBe(false);
    const open = { ...content, config: { ...content.config, apexGate: { echo: 'echo_apex_resonance' as const } } };
    expect(gateQuestCount(open)).toBeUndefined();
    expect(needsQuest(envOf(s, open))).toBe(true);
    const nested = { ...content, config: { ...content.config, apexGate: { not: { all: [{ counter: { name: 'quests_completed', min: 2 } }] } } as never } };
    expect(gateQuestCount(nested)).toBe(2);
  });

  test('questDistance: steps from here to the nearest first hint; 99 with none', () => {
    const s = makeState({ locationId: RUINS });
    expect(questDistance(envOf(s), 'q_echo_crystal')).toBe(1);
    expect(questDistance(envOf(s), 'q_nonexistent')).toBe(99);
    const far = makeState({ locationId: 'loc_veridian_glowlands' });
    expect(questDistance(envOf(far), 'q_echo_crystal')).toBeGreaterThan(1);
  });

  test('the pending fights at the Apex: the Contained Tyrant in Loop 1, the Tyrant to commune with from Loop 2', () => {
    const pack = hordePack();
    const loop1 = makeState({ locationId: 'loc_chronos_nexus' }, { content: pack });
    const fights = pendingFights(loop1, pack, profile, APEX_LOCATION_ID);
    expect(fights.length).toBeGreaterThan(0);
  });
});

describe('explorer: where next', () => {
  const seen = (at: string, quests: Record<string, string>) =>
    makeState({
      locationId: at,
      quests,
      patch: (d) => {
        d.player.apHalf = 0;
        d.player.statPoints = 0;
        for (const id of Object.keys(content.locations)) d.world.locationStates[id] = locState({ visited: true, visitCount: 1, encountersCleared: ['enc_library_shades'], itemsSpawned: true });
      },
    });

  test('with every place seen it follows the quest hints, then waits for the Apex', () => {
    const toHint = pick(explorerBot(), seen(PLAZA, { q_echo_crystal: 'find_crystal' }));
    expect(toHint).toEqual({ type: 'move', to: LIBRARY });
    // standing on the hint it marks it reached and does not go back and forth
    const memory: BotMemory = {};
    const at = seen(LIBRARY, { q_echo_crystal: 'find_crystal' });
    const first = pick(explorerBot(), at, content, profile, memory);
    expect(first).not.toEqual({ type: 'move', to: LIBRARY });
    expect(Object.keys(notesOf(memory, 'explorer').hintsReached)).toContain(LIBRARY);
  });
});

describe('the speedrunner and the quest gate', () => {
  test('it takes the quest the gate asks for: from the ruins it talks to Ilyra, then heads for the Library', () => {
    const pack = storyPack();
    let s = makeState({ locationId: RUINS }, { content: pack });
    const bot = speedrunnerBot();
    const memory: BotMemory = {};
    const played: Action[] = [];
    for (let i = 0; i < 12; i++) {
      const legal = legalActions(s, pack, profile);
      const a = bot.choose(s, legal, pack, memory, ctxOf());
      played.push(a);
      s = step(s, a, pack, profile).state;
    }
    expect(played.some((a) => a.type === 'talk' && a.npcId === 'npc_ilyra')).toBe(true);
    expect(Object.keys(s.quests)).toContain('q_echo_crystal');
  });

  test('on the economy pack a bot with a draught drinks it when low, else walks to a bed', () => {
    const pack = economyPack();
    const hurt = makeState({ locationId: RUINS, hp: 10, items: [TONIC] }, { content: pack });
    for (const [, make] of BOTS_UNDER_TEST) {
      const a = pick(make(), hurt, pack);
      expect(['rest', 'item', 'move', 'takeAll', 'talk', 'equip', 'allocateStat', 'unlockAbility', 'buy', 'sell']).toContain(a.type);
    }
  });
});
