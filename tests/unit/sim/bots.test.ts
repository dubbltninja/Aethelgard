// U37: the bot interface's shared helpers (PLAN §7.1), the `random` bot's weights (PLAN §7.2 + U37's menu damping) and
// the `melee` bot's policy rows (PLAN §7.2), each on a state built for it. A bot is a pure function of
// (state, legal, content, memory, ctx): these tests hand it legal lists from `legalActions` (or a few hand-made ones).
import { describe, expect, test } from 'bun:test';
import {
  APEX_LOCATION_ID,
  PORTAL_LOCATION_ID,
  legalActions,
  playerOf,
  step,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import { APEX_MARGIN, MELEE, meleeBot } from '@sim/bots/melee';
import { RANDOM_STALL_STEPS, RANDOM_WEIGHTS, randomBot, weightOf } from '@sim/bots/random';
import {
  SHELL_ACTIONS,
  abilityOf,
  actionKey,
  allOf,
  bestAffordableAbility,
  bfsPath,
  botRng,
  canReachApex,
  enemyWeakness,
  expectedDamage,
  firstOf,
  foesOf,
  healAmount,
  healingCarried,
  healthFraction,
  isShellAction,
  itemOf,
  levelBand,
  locationThreat,
  manaFraction,
  nearestUnvisited,
  nearestWhere,
  primaryStat,
  questHints,
  questSignature,
  restAvailable,
  routes,
  scoreEquipment,
  targetOf,
  visitedThisLoop,
} from '@sim/bots/shared';
import type { Bot, BotContext, BotMemory } from '@sim/bots/types';
import { loadScenario } from '@sim/scenarios';
import { companionPack } from '@tests/fixtures/companionContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { hordePack } from '@tests/fixtures/hordeContent';
import { fixturePack } from '@tests/fixtures/miniContent';
import { thresholdPack } from '@tests/fixtures/thresholdContent';

const content = fixturePack();
const profile = freshProfile();
const RUINS = 'loc_whispering_ruins';
const LIBRARY = 'loc_shattered_library';
const PLAZA = 'loc_silverwood_plaza';
const TONIC = 'item_ley_touched_tonic';

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
const edit = (s: GameState, fn: (d: GameState) => void): GameState => {
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

// ---- shared ------------------------------------------------------------------------------------------------------------------

describe('shared: actions and the bot stream', () => {
  test('actionKey ignores key order; the shell actions are the four of PLAN §7.2', () => {
    expect(actionKey({ type: 'move', to: 'x' })).toBe(actionKey(JSON.parse('{"to":"x","type":"move"}') as Action));
    expect([...SHELL_ACTIONS].sort()).toEqual(['load', 'newGame', 'returnToTitle', 'save']);
    expect(isShellAction({ type: 'save', slot: 1 })).toBe(true);
    expect(isShellAction({ type: 'wait' })).toBe(false);
  });

  test('firstOf / allOf / targetOf', () => {
    const legal: Action[] = [{ type: 'wait' }, { type: 'move', to: 'a' }, { type: 'move', to: 'b' }, { type: 'attack', targetUid: 'c1' }];
    expect(firstOf(legal, 'move')).toEqual({ type: 'move', to: 'a' });
    expect(allOf(legal, 'move')).toHaveLength(2);
    expect(firstOf(legal, 'rest')).toBeUndefined();
    expect(targetOf({ type: 'attack', targetUid: 'c1' })).toBe('c1');
    expect(targetOf({ type: 'ability', abilityId: 'x' })).toBeUndefined();
    expect(targetOf({ type: 'wait' })).toBeUndefined();
  });

  test('botRng: seeded, kept in memory, reproducible', () => {
    const m: BotMemory = {};
    const a = botRng(m, 'seed');
    expect(botRng(m, 'other')).toBe(a);
    const draws = [a.next(), a.next()];
    const b = botRng({}, 'seed');
    expect([b.next(), b.next()]).toEqual(draws);
  });
});

describe('shared: the player', () => {
  test('health and mana fractions, in and out of a fight', () => {
    const s = makeState({ hp: 60, mp: 12 });
    expect(healthFraction(s)).toBeCloseTo(60 / s.player.hpMax);
    expect(manaFraction(s)).toBeCloseTo(12 / s.player.mpMax);
    expect(manaFraction(edit(s, (d) => (d.player.mpMax = 0)))).toBe(1);
    expect(healthFraction(edit(s, (d) => (d.player.hpMax = 0)))).toBe(0);
    const { state: f } = loadScenario('first_fight', content);
    const hurt = edit(f, (d) => (playerOf(d.combat as NonNullable<GameState['combat']>).hp = 30));
    expect(healthFraction(hurt)).toBeCloseTo(30 / playerOf(f.combat as NonNullable<GameState['combat']>).hpMax);
    expect(manaFraction(hurt)).toBe(1);
  });

  test('healing consumables', () => {
    expect(healAmount(content, TONIC)).toBe(25);
    expect(healAmount(content, 'item_rusty_dagger')).toBe(0);
    expect(healAmount(content, 'item_nope')).toBe(0);
    expect(healingCarried(makeState(), content)).toBe(2);
    expect(healingCarried(makeState({ items: [{ itemId: TONIC, qty: 3 }] }), content)).toBe(5);
  });

  test('itemOf finds the pack, the gear, the ground and the stalls', () => {
    const s = edit(makeState(), (d) => {
      d.world.locationStates[RUINS] = locState({ items: [{ uid: 'g1', itemId: TONIC, qty: 1, rarity: 'common', affixes: [] }] });
      d.merchants['npc_x'] = { stock: [{ uid: 'm1', itemId: 'item_glow_moss', qty: 1, rarity: 'common', affixes: [] }], lastRestockDay: 1, purchasesThisLoop: 0 };
    });
    expect(itemOf(s, 'i1')?.itemId).toBe('item_rusty_dagger');
    expect(itemOf(s, 'i2')?.itemId).toBe(TONIC);
    expect(itemOf(s, 'g1')?.itemId).toBe(TONIC);
    expect(itemOf(s, 'm1')?.itemId).toBe('item_glow_moss');
    expect(itemOf(s, 'zz')).toBeUndefined();
  });

  test('primary stat and equipment scores', () => {
    expect(primaryStat(content, 'ranger')).toBe('strength');
    expect(primaryStat(content, 'wizard')).toBe('magic');
    expect(primaryStat(content, 'nobody')).toBe('strength');
    const h = hordePack();
    expect(primaryStat(h, 'elf')).toBe('agility');
    const dagger = { itemId: 'item_rusty_dagger', rarity: 'common' as const, affixes: [] };
    const sword = { itemId: 'item_travelers_sword', rarity: 'common' as const, affixes: [] };
    expect(scoreEquipment(h, sword, 'ranger')).toBeGreaterThan(scoreEquipment(h, dagger, 'ranger'));
    expect(scoreEquipment(h, { ...sword, rarity: 'rare' }, 'ranger')).toBeGreaterThan(scoreEquipment(h, sword, 'ranger'));
    expect(scoreEquipment(h, { ...sword, affixes: ['affix_x'] }, 'ranger')).toBe(scoreEquipment(h, sword, 'ranger') + 1);
    const lens = { itemId: 'item_chronos_lens', rarity: 'common' as const, affixes: [] };
    expect(scoreEquipment(h, lens, 'wizard')).toBeGreaterThan(scoreEquipment(h, lens, 'ranger'));
    expect(scoreEquipment(h, { itemId: TONIC, rarity: 'common', affixes: [] }, 'ranger')).toBe(Number.NEGATIVE_INFINITY);
    const picky = { ...h, items: { ...h.items, item_travelers_sword: { ...(h.items['item_travelers_sword'] as NonNullable<ContentPack['items'][string]>), requirements: { classIds: ['wizard' as const] } } } };
    expect(scoreEquipment(picky, sword, 'ranger')).toBe(Number.NEGATIVE_INFINITY);
    expect(scoreEquipment(picky, sword, 'wizard')).toBeGreaterThan(0);
  });
});

describe('shared: the map', () => {
  const s = makeState();

  test('bfsPath and routes over open exits', () => {
    expect(bfsPath(s, content, profile, RUINS, PLAZA)).toEqual([LIBRARY, PLAZA]);
    expect(bfsPath(s, content, profile, RUINS, RUINS)).toEqual([]);
    expect(bfsPath(s, content, profile, RUINS, APEX_LOCATION_ID)).toBeNull(); // the Nexus stair is locked (apexGate)
    expect(bfsPath(s, content, profile, RUINS, APEX_LOCATION_ID, { allowLocked: true })).toEqual([
      LIBRARY,
      PLAZA,
      'loc_veridian_glowlands',
      'loc_chronos_nexus',
      APEX_LOCATION_ID,
    ]);
    expect(bfsPath(s, content, profile, RUINS, PLAZA, { avoid: (id) => id === LIBRARY })).toBeNull();
    expect(bfsPath(s, content, profile, RUINS, LIBRARY, { avoid: (id) => id === LIBRARY })).toEqual([LIBRARY]); // the goal itself
    const all = routes(s, content, profile, RUINS);
    expect([...all.keys()]).toEqual([LIBRARY, PLAZA, 'loc_veridian_glowlands', 'loc_chronos_nexus']);
  });

  test('Silverwood Before is never walked through', () => {
    const { state, profile: p } = loadScenario('loop2_day1', companionPack());
    expect(state.meta.loop).toBe(2);
    const all = routes(state, companionPack(), p, state.world.currentLocationId);
    for (const id of all.keys()) expect(companionPack().locations[id]?.regionId).not.toBe('region_silverwood_before');
  });

  test('level bands: the location, else its region', () => {
    expect(levelBand(content, LIBRARY)).toEqual({ min: 2, max: 3 });
    const h = hordePack();
    expect(levelBand(h, 'loc_mistwood_path')).toEqual(h.regions[h.locations['loc_mistwood_path']?.regionId ?? '']?.levelBand);
    expect(levelBand(content, 'loc_nowhere')).toBeUndefined();
  });

  test('nearest unvisited / nearest where', () => {
    expect(visitedThisLoop(s, RUINS)).toBe(false); // makeState does not arrive
    const here = edit(s, (d) => (d.world.locationStates[LIBRARY] = locState({ visited: true, visitCount: 1 })));
    expect(nearestUnvisited(s, content, profile)).toEqual({ id: LIBRARY, path: [LIBRARY] });
    expect(nearestUnvisited(here, content, profile)).toEqual({ id: PLAZA, path: [LIBRARY, PLAZA] });
    expect(nearestUnvisited(s, content, profile, (id) => id === 'loc_nowhere')).toBeNull();
    expect(nearestWhere(s, content, profile, (id) => id === RUINS)).toEqual({ id: RUINS, path: [] });
    expect(nearestWhere(s, content, profile, (id) => id === PLAZA)).toEqual({ id: PLAZA, path: [LIBRARY, PLAZA] });
    expect(nearestWhere(s, content, profile, () => false)).toBeNull();
  });

  test('rest spots, quest hints, the quest signature, the Apex', () => {
    expect(restAvailable(s, content, profile, RUINS)).toBe(true);
    expect(restAvailable(s, content, profile, LIBRARY)).toBe(false);
    expect(restAvailable(edit(s, (d) => (d.world.hordeActive = true)), content, profile, RUINS)).toBe(false);
    const questing = makeState({ quests: { q_echo_crystal: 'find_crystal' } });
    expect(questHints(questing, content)).toEqual([LIBRARY]);
    expect(questHints(s, content)).toEqual([]);
    expect(questSignature(questing)).not.toBe(questSignature(s));
    expect(canReachApex(s, content, profile)).toBe(false);
    const gateOpen = makeState({ quests: { q_echo_crystal: { status: 'completed', stage: 'crystal_found' } } });
    expect(canReachApex(gateOpen, content, profile)).toBe(true);
    expect(canReachApex(gateOpen, content, profile, { avoid: (id) => id === 'loc_chronos_nexus' })).toBe(false);
  });

  test('location threat: the strongest fight it would start now', () => {
    expect(locationThreat(s, content, profile, LIBRARY)).toBe(2);
    const cleared = edit(s, (d) => (d.world.locationStates[LIBRARY] = locState({ encountersCleared: ['enc_library_shades'] })));
    expect(locationThreat(cleared, content, profile, LIBRARY)).toBe(0);
    expect(locationThreat(s, content, profile, APEX_LOCATION_ID)).toBe(0); // the fixture's Tyrant waits for Loop 2
    expect(locationThreat(makeState({ loop: 2 }, { profile: freshProfile({ loopCounter: 2 }) }), content, profile, APEX_LOCATION_ID)).toBe(18);
    expect(locationThreat(s, hordePack(), profile, APEX_LOCATION_ID)).toBe(14); // the Contained Tyrant
    expect(locationThreat(s, content, profile, 'loc_nowhere')).toBe(0);
  });
});

describe('shared: combat', () => {
  test('weaknesses, foes, damage estimates, the best ability', () => {
    expect(enemyWeakness(content, 'cr_corrupted_shade')).toEqual(['fire', 'ley']);
    expect(enemyWeakness(content, 'cr_nope')).toEqual([]);
    const { state, profile: p } = loadScenario('first_fight', content);
    const combat = state.combat as NonNullable<GameState['combat']>;
    const me = playerOf(combat);
    expect(foesOf(state).map((f) => f.refId)).toEqual(['cr_corrupted_shade', 'cr_corrupted_shade']);
    expect(foesOf(makeState())).toEqual([]);
    expect(expectedDamage(content, me, { type: 'attack', targetUid: 'x' }, 2)).toBe(me.atk);
    expect(expectedDamage(content, me, { type: 'guard' }, 2)).toBe(0);
    const legal = legalActions(state, content, p);
    expect(bestAffordableAbility(state, content, legal)).toBeNull(); // Level 1, no abilities yet
    expect(bestAffordableAbility(makeState(), content, legal)).toBeNull(); // not in a fight
    const h = hordePack();
    const { state: big, profile: bp } = loadScenario('pre_tyrant_l13_ranger', h);
    const fought = step(big, { type: 'choose', choiceId: 'face_it' }, h, bp).state;
    const bl = legalActions(fought, h, bp);
    const best = bestAffordableAbility(fought, h, bl) as Action;
    expect(best.type).toBe('ability');
    const bme = playerOf(fought.combat as NonNullable<GameState['combat']>);
    for (const a of bl) if (a.type === 'ability') expect(expectedDamage(h, bme, a, 1)).toBeLessThanOrEqual(expectedDamage(h, bme, best, 1));
    expect(abilityOf(h, best)?.power).toBeDefined();
    expect(bestAffordableAbility(fought, h, bl, () => false)).toBeNull();
    const area = Object.values(h.abilities).find((a) => a.target === 'all_enemies' && a.power !== undefined) as NonNullable<ContentPack['abilities'][string]>;
    const one = expectedDamage(h, bme, { type: 'ability', abilityId: area.id }, 1);
    expect(expectedDamage(h, bme, { type: 'ability', abilityId: area.id }, 3)).toBeCloseTo(3 * one);
    const bolt = h.abilities['itm_echo_bolt'];
    if (bolt?.power?.maxOf !== undefined) expect(expectedDamage(h, bme, { type: 'ability', abilityId: 'itm_echo_bolt', targetUid: 'x' }, 1)).toBeGreaterThan(0);
  });
});

// ---- random ------------------------------------------------------------------------------------------------------------------

describe('random bot', () => {
  test('weights: PLAN §7.2 plus the menu damping', () => {
    expect(RANDOM_WEIGHTS).toMatchObject({ drop: 0.1, sell: 0.3, flee: 0.3, save: 0, load: 0, returnToTitle: 0, newGame: 0 });
    for (const t of ['setStance', 'toggleModifier', 'equipAttunement', 'thresholdRefund', 'chooseClass', 'letGo', 'keepVigil'] as const) {
      expect(RANDOM_WEIGHTS[t]).toBeLessThan(1);
    }
    expect(weightOf({ type: 'move', to: 'x' })).toBe(1);
    expect(weightOf({ type: 'examine', target: { kind: 'location' } })).toBe(0);
    expect(randomBot().stallSteps).toBe(RANDOM_STALL_STEPS);
    expect(RANDOM_STALL_STEPS).toBe(200);
  });

  test('never picks a shell action while a game action is listed; deterministic per seed', () => {
    const bot = randomBot();
    const s = makeState();
    const legal = legalActions(s, content, profile);
    expect(legal.some(isShellAction)).toBe(true);
    const run = (seed: string): string[] => {
      const memory = bot.init?.(seed) ?? {};
      return Array.from({ length: 300 }, () => actionKey(bot.choose(s, legal, content, memory, { ...ctxOf(), rngSeed: seed })));
    };
    const a = run('s1');
    for (const k of a) expect(isShellAction(JSON.parse(k) as Action)).toBe(false);
    expect(run('s1')).toEqual(a);
    expect(run('s2')).not.toEqual(a);
    expect(new Set(a).size).toBeGreaterThan(5);
  });

  test('when everything weighs 0 it falls back to the game actions, then to anything', () => {
    const bot = randomBot();
    const s = makeState();
    const zero: Action[] = [{ type: 'examine', target: { kind: 'location' } }, { type: 'save', slot: 1 }];
    expect(bot.choose(s, zero, content, {}, ctxOf()).type).toBe('examine');
    const shell: Action[] = [{ type: 'save', slot: 1 }];
    expect(bot.choose(s, shell, content, {}, ctxOf())).toEqual({ type: 'save', slot: 1 });
  });
});

// ---- melee -------------------------------------------------------------------------------------------------------------------

describe('melee bot: explore', () => {
  const bot = meleeBot();

  test('character first: stat points to STR, then the cheapest Steel ability', () => {
    expect(bot.preferredClasses).toEqual(['ranger', 'ironclad_warden']);
    expect(pick(bot, makeState({ patch: (d) => (d.player.statPoints = 1) }))).toEqual({ type: 'allocateStat', stat: 'strength' });
    expect(pick(bot, makeState())).toEqual({ type: 'unlockAbility', abilityId: 'rgr_rend' }); // steel before hunt's Marked Shot
  });

  test('better gear goes on; everything on the ground is taken', () => {
    const h = hordePack();
    const s = makeState({ items: ['item_travelers_sword'], patch: (d) => (d.player.apHalf = 0) }, { content: h });
    expect(pick(bot, s, h)).toMatchObject({ type: 'equip' });
    const worse = makeState({ items: ['item_rusty_dagger'], patch: (d) => (d.player.apHalf = 0) }, { content: h });
    expect(pick(bot, worse, h).type).not.toBe('equip');
    const ground = edit(makeState({ patch: (d) => (d.player.apHalf = 0) }), (d) => {
      d.world.locationStates[RUINS] = locState({ visited: true, visitCount: 1, items: [{ uid: 'g1', itemId: TONIC, qty: 1, rarity: 'common', affixes: [] }] });
    });
    expect(pick(bot, ground)).toEqual({ type: 'takeAll' });
  });

  test('hurt: a bed here; else a draught below 35 %; else the walk to the nearest bed', () => {
    const base = { patch: (d: GameState) => (d.player.apHalf = 0) };
    expect(pick(bot, makeState({ ...base, hp: 40 }))).toEqual({ type: 'rest', kind: 'full' });
    expect(pick(bot, makeState({ ...base, hp: 120, mp: 5 }))).toEqual({ type: 'rest', kind: 'full' });
    expect(pick(bot, makeState({ ...base, hp: 30, locationId: LIBRARY }))).toEqual({ type: 'use', uid: 'i2' });
    expect(pick(bot, makeState({ ...base, hp: 55, locationId: LIBRARY }))).toEqual({ type: 'move', to: RUINS }); // 46 %
  });

  test('talks to each NPC once per quest state, then goes where the quest points', () => {
    const memory: BotMemory = {};
    const s = makeState({ patch: (d) => (d.player.apHalf = 0) });
    expect(pick(bot, s, content, profile, memory)).toEqual({ type: 'talk', npcId: 'npc_ilyra' });
    expect(pick(bot, s, content, profile, memory)).toEqual({ type: 'move', to: LIBRARY }); // talked: the nearest unvisited
    const questing = edit(s, (d) => (d.quests['q_echo_crystal'] = { status: 'active', stage: 'find_crystal', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] }));
    expect(pick(bot, questing, content, profile, memory)).toEqual({ type: 'talk', npcId: 'npc_ilyra' }); // a new quest state
    expect(pick(bot, questing, content, profile, memory)).toEqual({ type: 'move', to: LIBRARY }); // the hint
  });

  test('stays out of places above its band and where it fell; passes the time at a bed', () => {
    const memory: BotMemory = {};
    const visited = (d: GameState): void => {
      d.player.apHalf = 0;
      for (const id of [RUINS, LIBRARY, PLAZA]) {
        d.world.locationStates[id] = locState({ visited: true, visitCount: 1 });
      }
    };
    const s = makeState({ patch: visited, locationId: PLAZA });
    expect(pick(bot, s, content, profile, memory)).toEqual({ type: 'move', to: LIBRARY }); // Glowlands (9–10) is too far above Level 1: back to a bed
    const atCamp = makeState({ patch: visited });
    const m2: BotMemory = {};
    pick(bot, atCamp, content, profile, m2); // talk to Ilyra
    expect(pick(bot, atCamp, content, profile, m2)).toEqual({ type: 'rest', kind: 'full' });
    // a death at the Library (the fight began there) is remembered across the reload: the unvisited Library is skipped
    const fresh = makeState({ patch: (d) => (d.player.apHalf = 0) });
    const m3: BotMemory = {};
    pick(bot, fresh, content, profile, m3); // talk
    const died: GameEvent[] = [
      { t: 'locationEntered', locationId: LIBRARY, firstVisit: true, regionId: 'region_silverwood_ruins' },
      { t: 'combatStarted', encounterId: 'enc_library_shades', enemies: [], ambush: false },
      { t: 'playerDied', loop: 1 },
    ];
    expect(pick(bot, fresh, content, profile, m3, died)).toEqual({ type: 'rest', kind: 'full' });
  });

  test('the portal when it opens; in a Horde, straight for it', () => {
    const horde = makeState({ locationId: PLAZA, patch: (d) => ((d.world.hordeActive = true), (d.world.hordeCause = 'expiry'), (d.player.apHalf = 0)) });
    expect(pick(bot, horde)).toEqual({ type: 'move', to: PORTAL_LOCATION_ID });
    const there = makeState({ locationId: PORTAL_LOCATION_ID, patch: (d) => ((d.world.hordeActive = true), (d.world.hordeCause = 'expiry')) });
    expect(pick(bot, there)).toEqual({ type: 'enterPortal' });
  });

  test('the Apex when ready; never before', () => {
    const open = (level: number) =>
      makeState(
        { level, locationId: 'loc_chronos_nexus', quests: { q_echo_crystal: { status: 'completed', stage: 'crystal_found' } }, patch: (d) => ((d.player.apHalf = 0), (d.player.statPoints = 0)) },
        { content: hordePack() },
      );
    const visitAll = (s: GameState): GameState =>
      edit(s, (d) => {
        for (const id of Object.keys(hordePack().locations)) {
          d.world.locationStates[id] = locState({ visited: true, visitCount: 1, encountersCleared: id === 'loc_chronos_nexus' ? ['enc_nexus_aberration'] : [] });
        }
      });
    expect(pick(bot, visitAll(open(14 - APEX_MARGIN)), hordePack())).toEqual({ type: 'move', to: APEX_LOCATION_ID });
    expect(pick(bot, visitAll(open(14 - APEX_MARGIN - 1)), hordePack())).not.toEqual({ type: 'move', to: APEX_LOCATION_ID });
  });

  test('the merchant: buys healing when flush, sells materials and spare gear when poor', () => {
    // arrive at the Plaza so Tamsin's stall is stocked (tonics, glow moss, dust, a lantern, a staff)
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
    const flush = arrive(100, []);
    const buy = pick(bot, flush);
    expect(buy).toMatchObject({ type: 'buy', merchantId: 'npc_tamsin_reed' });
    expect(itemOf(flush, (buy as Extract<Action, { type: 'buy' }>).uid)?.itemId).toBe(TONIC); // 25 HP beats glow moss's 20
    expect(pick(bot, arrive(100, [TONIC]))).not.toMatchObject({ type: 'buy' }); // three carried already
    const poor = arrive(0, ['mat_shadow_ash', 'item_rusty_dagger']);
    const sell = pick(bot, poor);
    expect(sell).toMatchObject({ type: 'sell' });
    expect(itemOf(poor, (sell as Extract<Action, { type: 'sell' }>).uid)?.itemId).toBe('mat_shadow_ash');
    const spare = arrive(0, ['item_rusty_dagger']);
    expect(itemOf(spare, (pick(bot, spare) as Extract<Action, { type: 'sell' }>).uid)?.itemId).toBe('item_rusty_dagger');
  });
});

describe('melee bot: combat', () => {
  const bot = meleeBot();
  const { state: fight, profile: fp } = loadScenario('first_fight', content);
  const me = (s: GameState) => playerOf(s.combat as NonNullable<GameState['combat']>);
  const withHp = (hp: number, fn: (d: GameState) => void = () => {}) =>
    edit(fight, (d) => {
      me(d).hp = hp;
      fn(d);
    });

  test('full health: strikes the weakest foe', () => {
    const s = edit(fight, (d) => ((d.combat as NonNullable<GameState['combat']>).enemies[1] as { hp: number }).hp = 10);
    const target = (s.combat as NonNullable<GameState['combat']>).enemies[1]?.uid;
    expect(pick(bot, s, content, fp)).toEqual({ type: 'attack', targetUid: target as string });
  });

  test('below 30 %: the biggest heal; below 25 % without one: Guard', () => {
    expect(pick(bot, withHp(30), content, fp)).toEqual({ type: 'item', uid: 'i2' });
    const dry = withHp(25, (d) => (d.player.inventory = []));
    expect(pick(bot, dry, content, fp)).toEqual({ type: 'guard' });
  });

  test('flees only with the companion down, under 20 %, from a fleeable fight', () => {
    const legal: Action[] = [{ type: 'flee' }, { type: 'guard' }, { type: 'attack', targetUid: 'c6' }];
    const down = withHp(10, (d) => {
      const c = d.combat as NonNullable<GameState['combat']>;
      c.party.push({ ...structuredClone(me(d)), uid: 'cx', kind: 'companion', refId: 'brak', alive: false });
      d.player.inventory = [];
    });
    expect(bot.choose(down, legal, content, {}, ctxOf(fp))).toEqual({ type: 'flee' });
    const standing = withHp(10, (d) => (d.player.inventory = []));
    expect(bot.choose(standing, legal, content, {}, ctxOf(fp))).toEqual({ type: 'guard' });
  });

  test('a class ability beats a basic attack: a setup (Venom Coat) first, else a physical strike (U81b1)', () => {
    const h = hordePack();
    const { state, profile: p } = loadScenario('pre_tyrant_l13_ranger', h);
    const s = step(state, { type: 'choose', choiceId: 'face_it' }, h, p).state;
    const a = pick(bot, s, h, p);
    expect(a.type).toBe('ability');
    const ab = h.abilities[(a as Extract<Action, { type: 'ability' }>).abilityId];
    if (ab?.power !== undefined) expect(ab.damageType).toBe('physical');
    else expect(ab?.statuses.length).toBeGreaterThan(0);
  });

  test('with no draught left, Field Dressing before Guard', () => {
    const h = hordePack();
    const { state, profile: p } = loadScenario('pre_tyrant_l13_ranger', h);
    const s = edit(step(state, { type: 'choose', choiceId: 'face_it' }, h, p).state, (d) => {
      me(d).hp = 20;
      d.player.inventory = d.player.inventory.filter((i) => healAmount(h, i.itemId) === 0);
    });
    expect(pick(bot, s, h, p)).toMatchObject({ type: 'ability', abilityId: 'rgr_field_dressing' });
  });
});

describe('melee bot: dialogue, the Threshold, endings', () => {
  const bot = meleeBot();

  test('the Apex prompt: Face it when ready, Not yet when not', () => {
    const h = hordePack();
    const { state, profile: p } = loadScenario('pre_tyrant_l13_ranger', h);
    expect(pick(bot, state, h, p)).toEqual({ type: 'choose', choiceId: 'face_it' });
    const weak = edit(state, (d) => (d.player.level = 5));
    expect(pick(bot, weak, h, p)).toEqual({ type: 'choose', choiceId: 'not_yet' });
  });

  test('choices: questStart > Ironclad rep > first; untaken first; the Heartstone stabilized (D-146)', () => {
    const s = makeState({ patch: (d) => (d.player.apHalf = 0) });
    const talked = step(s, { type: 'talk', npcId: 'npc_ilyra' }, content, profile).state;
    expect(pick(bot, talked)).toEqual({ type: 'acceptQuest', questId: 'q_echo_crystal' }); // every quest is accepted
    const choices = legalActions(talked, content, profile).filter((a) => a.type === 'choose');
    expect(bot.choose(talked, choices, content, {}, ctxOf())).toEqual({ type: 'choose', choiceId: 'yes' }); // questStart
    const scene = {
      id: 'scene_test',
      nodes: [
        {
          id: 'n',
          choices: [
            { id: 'plain', effects: [] },
            { id: 'iron', effects: [{ rep: { faction: 'ironclad', delta: 5 } }] },
            { id: 'destroy_it', effects: [] },
            { id: 'stabilize_it', effects: [] },
          ],
        },
      ],
    };
    const c2 = { ...content, dialogues: { ...content.dialogues, scene_test: scene } } as unknown as ContentPack;
    const at = (day: number, taken: string[] = []) =>
      makeState({ day, mode: 'dialogue', patch: (d) => (d.dialogue = { sceneId: 'scene_test', nodeId: 'n', npcId: null, visitedNodes: ['n'], choicesTaken: taken, returnMode: 'explore' }) });
    const legal = (ids: string[]): Action[] => ids.map((choiceId) => ({ type: 'choose', choiceId }));
    expect(bot.choose(at(5), legal(['plain', 'iron']), c2, {}, ctxOf())).toEqual({ type: 'choose', choiceId: 'iron' });
    expect(bot.choose(at(5), legal(['plain', 'stabilize_it']), c2, {}, ctxOf())).toEqual({ type: 'choose', choiceId: 'stabilize_it' });
    // D-146 ruling 1 (U81b2): the Heartstone is stabilized on any day (SIM_HEARTSTONE plays Destroy by Day 10 or Exploit instead)
    expect(bot.choose(at(5), legal(['iron', 'destroy_it', 'stabilize_it']), c2, {}, ctxOf())).toEqual({ type: 'choose', choiceId: 'stabilize_it' });
    expect(bot.choose(at(12), legal(['iron', 'destroy_it', 'stabilize_it']), c2, {}, ctxOf())).toEqual({ type: 'choose', choiceId: 'stabilize_it' });
    expect(bot.choose(at(5, ['n:iron']), legal(['plain', 'iron']), c2, {}, ctxOf())).toEqual({ type: 'choose', choiceId: 'iron' }); // 2 − 1 > 0
    expect(bot.choose(at(5, ['n:plain']), legal(['plain', 'destroy_it']), c2, {}, ctxOf())).toEqual({ type: 'choose', choiceId: 'plain' }); // −1 > −3
    expect(bot.choose(at(5), [{ type: 'acceptQuest', questId: 'q_echo_crystal' }, ...legal(['plain'])], c2, {}, ctxOf())).toEqual({ type: 'acceptQuest', questId: 'q_echo_crystal' });
    expect(bot.choose(at(5), [{ type: 'continue' }], c2, {}, ctxOf())).toEqual({ type: 'continue' });
  });

  test('the Threshold: the cheapest Attunement while Resonance ≥ 10, wear it, then the next loop', () => {
    const t = thresholdPack();
    let { state: s, profile: p } = loadScenario('loop2_end', t);
    expect(s.mode).toBe('threshold');
    const memory: BotMemory = {};
    const seen: string[] = [];
    for (let i = 0; i < 40 && s.mode === 'threshold'; i++) {
      const a = pick(bot, s, t, p, memory);
      seen.push(a.type);
      const out = step(s, a, t, p);
      s = out.state;
      p = out.profile;
    }
    expect(seen[0]).toBe('thresholdGo');
    expect(seen).toContain('thresholdSpend');
    expect(seen).toContain('equipAttunement');
    expect(seen.at(-1)).toBe('newLoop');
    expect(p.resonance).toBeLessThan(MELEE.thresholdKeepResonance + Math.min(...Object.values(t.attunements).map((a) => a.cost)));
    expect(p.attunements.equipped.length).toBeGreaterThan(0);
    expect(p.attunements.equipped.length).toBeLessThanOrEqual(MELEE.attunementSlots);
    expect(s.mode).toBe('explore');
  });

  test('ending screens are acknowledged; anything else falls back to a game action', () => {
    const s = makeState({ mode: 'ending', patch: (d) => (d.pendingEnding = { outcome: 'closer_escape', slideIndex: 0 }) });
    expect(pick(bot, s)).toEqual({ type: 'acknowledgeEnding' });
    const title = makeState({ mode: 'title' });
    expect(bot.choose(title, [{ type: 'save', slot: 1 }, { type: 'wait' }], content, {}, ctxOf())).toEqual({ type: 'wait' });
    expect(bot.choose(title, [{ type: 'newGame', name: 'W', classId: 'ranger' }], content, {}, ctxOf()).type).toBe('newGame');
  });
});
