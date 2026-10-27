// U20: explore reducers (PLAN §4.6–4.7, §8.1; DESIGN §2.1, §4.7, §7.8, §8.2, §9.5; D-067.1, D-069.9) on the fixture pack.
import { describe, expect, test } from 'bun:test';
import { buildContentPack, type ContentTables } from '@content/index';
import type { LocationInput } from '@schema/location';
import type { NpcInput } from '@schema/npc';
import {
  APEX_FACE_IT,
  APEX_LOCATION_ID,
  APEX_NOT_YET,
  APEX_PROMPT_SCENE,
  HANDLERS,
  INFECTED_TEXT,
  INVENTORY_SLOTS,
  POST_STEP_HOOKS,
  apply,
  createStep,
  describeLocation,
  enterStartLocation,
  isLegal,
  legalActions,
  makeCtx,
  npcPlacement,
  npcStandsAt,
  npcsAt,
  step,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type ItemInstance,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState as makeFixtureState, play, type ItemSpec, type MakeStateOptions, type StateOverrides } from '@tests/fixtures/helpers';
import { FIXTURE_VERSION, fixturePack, miniContentTables } from '@tests/fixtures/miniContent';

const content = fixturePack();

/** Explore tests walk a calm map: every fixed encounter starts out cleared (arrival fights: U23, reducers/combat.test.ts). */
function makeState(o: StateOverrides = {}, opts: MakeStateOptions = {}): GameState {
  return makeFixtureState(
    {
      ...o,
      patch: (s) => {
        o.patch?.(s);
        for (const loc of Object.values((opts.content ?? content).locations)) {
          if (loc.encounters.length === 0) continue;
          const ls = (s.world.locationStates[loc.id] ??= emptyLocationState());
          for (const enc of loc.encounters) if (!ls.encountersCleared.includes(enc.id)) ls.encountersCleared.push(enc.id);
        }
      },
    },
    opts,
  );
}
const RUINS = 'loc_whispering_ruins';
const LIBRARY = 'loc_shattered_library';
const PLAZA = 'loc_silverwood_plaza';
const GLOWLANDS = 'loc_veridian_glowlands';
const NEXUS = 'loc_chronos_nexus';

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const types = (actions: readonly Action[], type: Action['type']) => actions.filter((a) => a.type === type);
const ground = (s: GameState, at = s.world.currentLocationId): ItemInstance[] => s.world.locationStates[at]?.items ?? [];

/** The fixture pack with some locations patched (built and validated like the real one). */
function packWith(patch: Record<string, Partial<LocationInput>>): ContentPack {
  const tables: ContentTables = {
    ...miniContentTables,
    locations: miniContentTables.locations.map((loc) => (patch[loc.id] ? { ...clone(loc), ...patch[loc.id] } : loc)),
  };
  return buildContentPack(tables, { version: FIXTURE_VERSION });
}

/** A completed fixture quest opens the Apex stair (fixture apexGate: one completed quest). */
const APEX_OPEN = { q_echo_crystal: { status: 'completed' as const, stage: 'crystal_found' } };

describe('move', () => {
  test('lists the open exits; a hidden road and a locked stair are not listed', () => {
    expect(types(legalActions(makeState(), content, freshProfile()), 'move')).toEqual([{ type: 'move', to: LIBRARY }]);
    expect(types(legalActions(makeState({ locationId: NEXUS }), content, freshProfile()), 'move')).toEqual([{ type: 'move', to: GLOWLANDS }]);
  });

  test('travel: 1 watch, location/previous/visit/discovery updated, first-entry items and events, autosave', () => {
    const out = play(makeState(), [{ type: 'move', to: LIBRARY }]);
    const s = out.state;
    expect(s.world.currentLocationId).toBe(LIBRARY);
    expect(s.world.previousLocationId).toBe(RUINS);
    expect(s.clock.ticks).toBe(1);
    expect(s.counters.travels).toBe(1);
    expect(s.world.discovered).toContain(LIBRARY);
    expect(s.world.locationStates[LIBRARY]).toMatchObject({ visited: true, visitCount: 1, itemsSpawned: true, eventsFired: ['ev_library_shiver'] });
    expect(ground(s).map((i) => i.itemId)).toEqual(['item_echo_crystal']);
    expect(ofType(out.events, 'watchAdvanced')).toEqual([{ t: 'watchAdvanced', day: 1, watch: 1 }]);
    expect(ofType(out.events, 'locationEntered')).toEqual([{ t: 'locationEntered', locationId: LIBRARY, firstVisit: true, regionId: 'region_silverwood_ruins' }]);
    expect(ofType(out.events, 'eventFired').map((e) => [e.locationId, e.eventId])).toEqual([[LIBRARY, 'ev_library_shiver']]);
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([{ t: 'autosaveCheckpoint', reason: 'locationEntered' }]);
  });

  test('a once event fires once per loop; ground items spawn only on the first entry', () => {
    const out = play(makeState(), [{ type: 'move', to: LIBRARY }, { type: 'move', to: RUINS }, { type: 'move', to: LIBRARY }]);
    expect(ofType(out.events, 'eventFired').map((e) => e.eventId)).toEqual(['ev_library_shiver', 'ev_ruins_echo']);
    expect(ground(out.state, LIBRARY)).toHaveLength(1);
    expect(out.state.world.locationStates[LIBRARY]?.visitCount).toBe(2);
  });

  test('travel regen: +5 % max HP and +10 % max MP per watch (DESIGN §3.2)', () => {
    const start = makeState({ hp: 40, mp: 10 });
    const { hpMax, mpMax } = start.player;
    const out = play(start, [{ type: 'move', to: LIBRARY }]);
    expect(out.state.player.hp).toBe(40 + Math.round(hpMax * 0.05));
    expect(out.state.player.mp).toBe(10 + Math.round(mpMax * 0.1));
    expect(ofType(out.events, 'healed')).toEqual([{ t: 'healed', targetUid: 'player', amount: Math.round(hpMax * 0.05), source: 'travel' }]);
  });

  test('a locked exit is rejected with its lockedText and the failing conditions (explain)', () => {
    const out = step(makeState({ locationId: NEXUS }), { type: 'move', to: APEX_LOCATION_ID }, content, freshProfile());
    const reason = (out.events[0] as { reason: string }).reason;
    expect(reason).toContain('The stair up into the Breach will not hold you yet.');
    expect(reason).toContain('Quests completed ≥ 1 (now 0)');
  });

  test('no exit, a hidden road or an unknown id: rejected without leaking', () => {
    for (const to of [GLOWLANDS, NEXUS, 'loc_nowhere']) {
      const out = step(makeState(), { type: 'move', to }, content, freshProfile());
      expect(out.events[0]?.t).toBe('actionRejected');
      expect((out.events[0] as { reason: string }).reason).toMatch(/^there is no way to /);
    }
  });

  test('unlockExit opens a locked exit; a road appears once its gate holds and costs its 2 watches (D-069.9)', () => {
    const unlocked = makeState({
      locationId: NEXUS,
      patch: (s) => {
        s.world.locationStates[NEXUS] = { ...emptyLocationState(), unlockedExits: [APEX_LOCATION_ID] };
      },
    });
    expect(isLegal(unlocked, { type: 'move', to: APEX_LOCATION_ID }, content, freshProfile())).toBe(true);
    const road = makeState({ loop: 2, echoes: ['echo_apex_resonance'] });
    expect(types(legalActions(road, content, freshProfile({ loopCounter: 2 })), 'move')).toEqual([
      { type: 'move', to: NEXUS },
      { type: 'move', to: LIBRARY },
    ]);
    const out = play(road, [{ type: 'move', to: NEXUS }]);
    expect(out.state.clock.ticks).toBe(2);
    expect(ofType(out.events, 'watchAdvanced')).toHaveLength(2);
  });

  test('frozen clock (Silverwood Before): travel costs nothing, no regen', () => {
    const out = play(makeState({ hp: 40, patch: (s) => void (s.clock.frozen = true) }), [{ type: 'move', to: LIBRARY }]);
    expect(out.state.clock.ticks).toBe(0);
    expect(out.state.player.hp).toBe(40);
    expect(ofType(out.events, 'watchAdvanced')).toEqual([]);
  });
});

describe('retreat', () => {
  test('back along the arrival edge for its watch; listed only when there is a way back', () => {
    expect(types(legalActions(makeState(), content, freshProfile()), 'retreat')).toEqual([]);
    const there = play(makeState(), [{ type: 'move', to: LIBRARY }]).state;
    expect(types(legalActions(there, content, freshProfile()), 'retreat')).toEqual([{ type: 'retreat' }]);
    const out = play(there, [{ type: 'retreat' }]);
    expect(out.state.world.currentLocationId).toBe(RUINS);
    expect(out.state.world.previousLocationId).toBe(LIBRARY);
    expect(out.state.clock.ticks).toBe(2);
    expect(out.state.counters.travels).toBe(2);
  });

  test('rejected when the way back is closed (one-way or locked) or the player was placed here', () => {
    const placed = makeState({ locationId: LIBRARY, patch: (s) => void (s.world.previousLocationId = APEX_LOCATION_ID) });
    expect(step(placed, { type: 'retreat' }, content, freshProfile()).events[0]).toMatchObject({ reason: 'there is no way back the way you came' });
  });
});

describe('take / takeAll', () => {
  const atLibrary = () => play(makeState(), [{ type: 'move', to: LIBRARY }]).state;

  test('take moves the instance into the pack and emits itemTaken', () => {
    const s = atLibrary();
    const crystal = ground(s)[0] as ItemInstance;
    expect(types(legalActions(s, content, freshProfile()), 'take')).toEqual([{ type: 'take', uid: crystal.uid }]);
    const out = play(s, [{ type: 'take', uid: crystal.uid }]);
    expect(ground(out.state)).toEqual([]);
    expect(out.state.player.inventory).toContainEqual(crystal);
    expect(ofType(out.events, 'itemTaken')).toEqual([{ t: 'itemTaken', item: crystal }]);
    expect(step(out.state, { type: 'take', uid: crystal.uid }, content, freshProfile()).events[0]).toMatchObject({ reason: 'that is not here' });
  });

  test('stackables merge into a stack of the same item and rarity', () => {
    const s = makeState({ locationId: GLOWLANDS, items: [{ itemId: 'item_glow_moss', qty: 3 }] });
    const ctx = makeCtx(clone(s), freshProfile(), content);
    enterStartLocation(ctx);
    const moss = ground(ctx.s)[0] as ItemInstance;
    const out = play(ctx.s, [{ type: 'take', uid: moss.uid }]);
    expect(out.state.player.inventory.filter((i) => i.itemId === 'item_glow_moss').map((i) => i.qty)).toEqual([4]);
  });

  test(`a full pack (${INVENTORY_SLOTS} slots) blocks new stacks; Satchel items (quest, key) and merges still fit`, () => {
    const s = makeState({ items: packFiller(), locationId: GLOWLANDS });
    const ctx = makeCtx(clone(s), freshProfile(), content);
    enterStartLocation(ctx);
    const full = ctx.s;
    const moss = ground(full)[0] as ItemInstance;
    expect(types(legalActions(full, content, freshProfile()), 'take')).toEqual([]);
    expect(types(legalActions(full, content, freshProfile()), 'takeAll')).toEqual([]);
    expect(step(full, { type: 'take', uid: moss.uid }, content, freshProfile()).events[0]).toMatchObject({ reason: `your pack is full (${INVENTORY_SLOTS} slots)` });
    // the Echo Crystal is a quest item: it goes to the Satchel
    const library = play(makeState({ items: packFiller() }), [{ type: 'move', to: LIBRARY }]).state;
    expect(types(legalActions(library, content, freshProfile()), 'take')).toHaveLength(1);
  });

  test('takeAll takes everything that fits and is rejected when nothing does', () => {
    const s = makeState({
      locationId: LIBRARY,
      patch: (st) => {
        st.world.locationStates[LIBRARY] = {
          ...emptyLocationState(),
          itemsSpawned: true,
          items: [
            { uid: 'i90', itemId: 'mat_shadow_ash', qty: 2, rarity: 'common', affixes: [] },
            { uid: 'i91', itemId: 'item_echo_crystal', qty: 1, rarity: 'common', affixes: [] },
          ],
        };
      },
    });
    const out = play(s, [{ type: 'takeAll' }]);
    expect(ground(out.state)).toEqual([]);
    expect(ofType(out.events, 'itemTaken').map((e) => e.item.uid)).toEqual(['i90', 'i91']);
    expect(step(out.state, { type: 'takeAll' }, content, freshProfile()).events[0]).toMatchObject({ reason: 'there is nothing here you can carry' });
  });
});

describe('gather', () => {
  test('one unit per action, perDay a day; the day resets at dawn (DESIGN §8.2)', () => {
    const s = makeState({ locationId: GLOWLANDS });
    expect(types(legalActions(s, content, freshProfile()), 'gather')).toEqual([{ type: 'gather' }]);
    const once = play(s, [{ type: 'gather' }]);
    expect(once.state.world.gather[GLOWLANDS]).toEqual({ day: 1, taken: 1 });
    expect(once.state.player.inventory.find((i) => i.itemId === 'item_glow_moss')?.qty).toBe(1);
    expect(ofType(once.events, 'itemGiven').map((e) => [e.item.itemId, e.item.qty, e.source])).toEqual([['item_glow_moss', 1, `gather:${GLOWLANDS}`]]);
    expect(once.state.clock.ticks).toBe(0);
    expect(types(legalActions(once.state, content, freshProfile()), 'gather')).toEqual([]);
    expect(step(once.state, { type: 'gather' }, content, freshProfile()).events[0]).toMatchObject({ reason: 'you have gathered all there is here today' });
    const tomorrow = play(once.state, [{ type: 'wait' }, { type: 'wait' }, { type: 'wait' }, { type: 'wait' }, { type: 'gather' }]);
    expect(tomorrow.state.world.gather[GLOWLANDS]).toEqual({ day: 2, taken: 1 });
  });

  test('nothing to gather elsewhere', () => {
    expect(step(makeState(), { type: 'gather' }, content, freshProfile()).events[0]).toMatchObject({ reason: 'there is nothing to gather here' });
  });

  test('U34d (D-098 item 2): several nodes at one place — each named by its item, each with its own perDay and record', () => {
    const SPARK = 'mat_ley_spark';
    const two = packWith({ [GLOWLANDS]: { gather: [{ itemId: 'item_glow_moss', perDay: 1 }, { itemId: SPARK, perDay: 2 }] } });
    const s = makeState({ locationId: GLOWLANDS }, { content: two });
    const legal = (st: GameState) => types(legalActions(st, two, freshProfile()), 'gather');
    expect(legal(s)).toEqual([{ type: 'gather', itemId: 'item_glow_moss' }, { type: 'gather', itemId: SPARK }]);
    expect(step(s, { type: 'gather' }, two, freshProfile()).events[0]).toMatchObject({ reason: 'name what to gather here' });
    expect(step(s, { type: 'gather', itemId: 'mat_shadow_ash' }, two, freshProfile()).events[0]).toMatchObject({ reason: 'there is no mat_shadow_ash to gather here' });
    const moss = play(s, [{ type: 'gather', itemId: 'item_glow_moss' }], { content: two });
    expect(legal(moss.state)).toEqual([{ type: 'gather', itemId: SPARK }]);
    expect(step(moss.state, { type: 'gather', itemId: 'item_glow_moss' }, two, freshProfile()).events[0]).toMatchObject({ reason: 'you have gathered all there is here today' });
    const out = play(moss.state, [{ type: 'gather', itemId: SPARK }, { type: 'gather', itemId: SPARK }], { content: two });
    // the first node keeps the location's own key (saves from before U34d read on); the others are `<location>:<item>`
    expect(out.state.world.gather).toEqual({ [GLOWLANDS]: { day: 1, taken: 1 }, [`${GLOWLANDS}:${SPARK}`]: { day: 1, taken: 2 } });
    expect(ofType(out.events, 'itemGiven').map((e) => [e.item.itemId, e.source])).toEqual([[SPARK, `gather:${GLOWLANDS}`], [SPARK, `gather:${GLOWLANDS}`]]);
    expect(legal(out.state)).toEqual([]);
    // one node: the action names nothing
    expect(step(makeState({ locationId: GLOWLANDS }), { type: 'gather', itemId: 'item_glow_moss' }, content, freshProfile()).events[0]).toMatchObject({
      reason: 'there is only one thing to gather here',
    });
  });
});

describe('content items: chance, a late `when`, onTake (U34d, D-098 item 2)', () => {
  const SPARK = 'mat_ley_spark';
  const look = { type: 'examine', target: { kind: 'location' } } as const;
  const has = (s: GameState, itemId = SPARK): boolean => ground(s).some((i) => i.itemId === itemId);
  const flagsAt = (s: GameState, at = LIBRARY) => s.world.locationStates[at]?.flags ?? {};

  test('`chance` is rolled on the run Rng once a loop, at the first arrival where the entry is ready; a miss waits for the next loop', () => {
    const chancy = packWith({ [LIBRARY]: { items: [{ itemId: 'item_echo_crystal' }, { itemId: SPARK, chance: 0.5 }] } });
    const enter = (seed: string) => play(makeState({ seed }, { content: chancy }), [{ type: 'move', to: LIBRARY }], { content: chancy }).state;
    const seeds = Array.from({ length: 16 }, (_, i) => `u34d-chance-${i}`);
    const rolls = seeds.map((seed) => has(enter(seed)));
    expect(rolls).toContain(true);
    expect(rolls).toContain(false);
    expect(seeds.map((seed) => has(enter(seed)))).toEqual(rolls); // the same seed, the same roll
    const missSeed = seeds[rolls.indexOf(false)] as string;
    const missed = enter(missSeed);
    expect(flagsAt(missed)).toMatchObject({ 'item:0': 'placed', 'item:1': 'missed' });
    expect(has(missed, 'item_echo_crystal')).toBe(true);
    // the miss is the loop's try: coming back does not roll again
    const back = play(missed, [{ type: 'move', to: RUINS }, { type: 'move', to: LIBRARY }], { content: chancy }).state;
    expect([has(back), back.rng]).toEqual([false, missed.rng]);
    expect(flagsAt(enter(seeds[rolls.indexOf(true)] as string))['item:1']).toBe('placed');
    // a chance of 1 (the default) draws nothing; the 50 % entry draws once
    const start = makeState({ seed: missSeed });
    expect(play(start, [{ type: 'move', to: LIBRARY }]).state.rng).toEqual(start.rng);
    expect(missed.rng).not.toEqual(start.rng);
  });

  test('an entry whose `when` turns true later appears on a later arrival — or, hidden, on a later examine', () => {
    const night = packWith({
      [LIBRARY]: { items: [{ itemId: 'item_echo_crystal' }, { itemId: SPARK, when: { watch: 'night' } }, { itemId: 'mat_shadow_ash', hidden: true, when: { watch: 'night' } }] },
    });
    const day = play(makeState({}, { content: night }), [{ type: 'move', to: LIBRARY }, look], { content: night });
    expect(ground(day.state).map((i) => i.itemId)).toEqual(['item_echo_crystal']); // watch 1: day
    expect(ofType(day.events, 'log').map((e) => e.text)).not.toContain('Looking closer, you find something.');
    expect(flagsAt(day.state)['item:1']).toBeUndefined(); // not tried: its `when` did not hold
    const later = play(day.state, [{ type: 'move', to: RUINS }, { type: 'move', to: LIBRARY }], { content: night });
    expect(later.state.clock.ticks).toBe(3); // night
    expect(ground(later.state).map((i) => i.itemId)).toEqual(['item_echo_crystal', SPARK]);
    const found = play(later.state, [look, look], { content: night });
    expect(ground(found.state).map((i) => i.itemId)).toEqual(['item_echo_crystal', SPARK, 'mat_shadow_ash']);
    expect(ofType(found.events, 'log').filter((e) => e.text === 'Looking closer, you find something.')).toHaveLength(1);
  });

  test('`onTake` effects apply as a piece is picked up, once per piece (source take:<item>); dropping and retaking pays nothing', () => {
    const ARMOR = 'item_wildling_hide_armor';
    const paid = packWith({ [LIBRARY]: { items: [{ itemId: ARMOR, count: 2, onTake: [{ gold: 5 }] }] } });
    const at = play(makeState({ gold: 0 }, { content: paid }), [{ type: 'move', to: LIBRARY }], { content: paid }).state;
    const [a, b] = ground(at) as [ItemInstance, ItemInstance];
    expect(flagsAt(at)).toMatchObject({ [`take:${a.uid}`]: 0, [`take:${b.uid}`]: 0 });
    const one = play(at, [{ type: 'take', uid: a.uid }], { content: paid });
    expect(one.state.player.gold).toBe(5);
    expect(ofType(one.events, 'goldChanged')).toEqual([{ t: 'goldChanged', delta: 5, total: 5 }]);
    expect(flagsAt(one.state)[`take:${a.uid}`]).toBeUndefined();
    const again = play(one.state, [{ type: 'drop', uid: a.uid }, { type: 'take', uid: a.uid }, { type: 'takeAll' }], { content: paid });
    expect(again.state.player.gold).toBe(10); // the second piece once; the first not again
    expect(ground(again.state)).toEqual([]);
  });

  test('a location state from before U34d (itemsSpawned, no tries recorded) counts what it placed as tried', () => {
    const pack = packWith({ [LIBRARY]: { items: [{ itemId: 'item_echo_crystal' }, { itemId: SPARK, hidden: true }] } });
    const old = (hiddenRevealed: boolean) =>
      makeState(
        { patch: (s) => void (s.world.locationStates[LIBRARY] = { ...emptyLocationState(), visited: true, visitCount: 1, itemsSpawned: true, flags: hiddenRevealed ? { hiddenRevealed } : {} }) },
        { content: pack },
      );
    const unrevealed = play(old(false), [{ type: 'move', to: LIBRARY }, look], { content: pack }).state;
    expect(ground(unrevealed).map((i) => i.itemId)).toEqual([SPARK]); // the Crystal was placed (and taken) before; the spark was never found
    expect(flagsAt(unrevealed)).toMatchObject({ 'items:v2': true, 'item:0': 'placed', 'item:1': 'placed' });
    expect(ground(play(old(true), [{ type: 'move', to: LIBRARY }, look], { content: pack }).state)).toEqual([]);
  });
});

describe('wait', () => {
  test('one watch where the location allows it (waitable, or a rest spot); not while the clock is frozen', () => {
    const out = play(makeState({ locationId: GLOWLANDS }), [{ type: 'wait' }]);
    expect(out.state.clock.ticks).toBe(1);
    expect(out.state.recentLog.at(-1)?.text).toBe('You wait. It is day.');
    expect(types(legalActions(makeState(), content, freshProfile()), 'wait')).toEqual([{ type: 'wait' }]); // the Ruins camp
    expect(step(makeState({ locationId: LIBRARY }), { type: 'wait' }, content, freshProfile()).events[0]).toMatchObject({ reason: 'this is no place to wait' });
    const frozen = makeState({ locationId: GLOWLANDS, patch: (s) => void (s.clock.frozen = true) });
    expect(types(legalActions(frozen, content, freshProfile()), 'wait')).toEqual([]);
    expect(step(frozen, { type: 'wait' }, content, freshProfile()).events[0]).toMatchObject({ reason: 'time does not pass here' });
  });
});

describe('examine', () => {
  test('listed only on request: the location, visible exits, items and NPCs here', () => {
    const s = makeState();
    expect(types(legalActions(s, content, freshProfile()), 'examine')).toEqual([]);
    const listed = types(legalActions(s, content, freshProfile(), { includeExamine: true }), 'examine');
    expect(listed).toContainEqual({ type: 'examine', target: { kind: 'location' } });
    expect(listed).toContainEqual({ type: 'examine', target: { kind: 'exit', to: LIBRARY } });
    expect(listed).toContainEqual({ type: 'examine', target: { kind: 'npc', id: 'npc_ilyra' } });
    expect(listed).toContainEqual({ type: 'examine', target: { kind: 'item', uid: s.player.inventory[0]!.uid } });
    expect(listed).not.toContainEqual({ type: 'examine', target: { kind: 'exit', to: NEXUS } });
  });

  test('narration only; a locked exit explains itself; no time passes', () => {
    const out = play(makeState({ locationId: NEXUS }), [
      { type: 'examine', target: { kind: 'location' } },
      { type: 'examine', target: { kind: 'exit', to: APEX_LOCATION_ID } },
      { type: 'examine', target: { kind: 'exit', to: GLOWLANDS } },
    ]);
    const lines = ofType(out.events, 'log').map((e) => e.text);
    expect(lines[0]).toMatch(/^A ruined observatory/);
    expect(lines[1]).toContain('Quests completed ≥ 1');
    expect(lines[2]).toBe('Veridian Glowlands: 1 watch to Veridian Glowlands.');
    expect(out.state.clock.ticks).toBe(0);
    expect(step(makeState(), { type: 'examine', target: { kind: 'npc', id: 'npc_tamsin_reed' } }, content, freshProfile()).events[0]).toMatchObject({
      t: 'actionRejected',
    });
  });

  test('examining the location reveals its hidden items, once', () => {
    const pack = packWith({ [LIBRARY]: { items: [{ itemId: 'item_echo_crystal' }, { itemId: 'mat_ley_spark', hidden: true }] } });
    const at = play(makeState({}, { content: pack }), [{ type: 'move', to: LIBRARY }], { content: pack }).state;
    expect(ground(at).map((i) => i.itemId)).toEqual(['item_echo_crystal']);
    const look = { type: 'examine', target: { kind: 'location' } } as const;
    const out = play(at, [look, look], { content: pack });
    expect(ground(out.state).map((i) => i.itemId)).toEqual(['item_echo_crystal', 'mat_ley_spark']);
  });

  test("U34d (D-098 item 6): an infected node's text gains WORLD's line; the Apex keeps its own", () => {
    const look = { type: 'examine', target: { kind: 'location' } } as const;
    const sick = makeState({ locationId: GLOWLANDS, patch: (s) => void s.world.infected.push(GLOWLANDS, APEX_LOCATION_ID) });
    expect(ofType(play(sick, [look]).events, 'log')[0]?.text).toBe(`${content.locations[GLOWLANDS]?.description} ${INFECTED_TEXT}`);
    expect(ofType(play(makeState({ locationId: GLOWLANDS }), [look]).events, 'log')[0]?.text).toBe(content.locations[GLOWLANDS]?.description);
    const apex = content.locations[APEX_LOCATION_ID]!;
    expect(describeLocation(sick, content, freshProfile(), apex)).not.toContain(INFECTED_TEXT);
  });
});

describe('where NPCs stand: schedules (U34d, D-098 item 1)', () => {
  /** Ilyra: at the Library and the Plaza at night, nowhere at dusk; at the Ruins (her placement) otherwise. */
  const schedule: NpcInput['schedule'] = [
    { when: { watch: 'night' }, at: [LIBRARY, PLAZA] },
    { when: { watch: 'dusk' }, at: [] },
  ];
  const pack = buildContentPack(
    { ...miniContentTables, npcs: miniContentTables.npcs.map((n) => (n.id === 'npc_ilyra' ? { ...clone(n), schedule } : n)) },
    { version: FIXTURE_VERSION },
  );
  const at = (watch: 0 | 1 | 2 | 3, patch?: (s: GameState) => void) => makeState({ watch, ...(patch ? { patch } : {}) }, { content: pack });
  const here = (s: GameState, loc: string) => npcsAt(s, pack, freshProfile(), loc);

  test('no entry holds: the placement; the first entry that holds wins; `at: []` is nowhere', () => {
    expect([here(at(0), RUINS), here(at(0), LIBRARY), npcPlacement(at(0), pack, freshProfile(), 'npc_ilyra')]).toEqual([['npc_ilyra'], [], null]);
    expect([here(at(2), RUINS), here(at(2), LIBRARY), npcPlacement(at(2), pack, freshProfile(), 'npc_ilyra')]).toEqual([[], [], []]);
    expect([here(at(3), RUINS), here(at(3), LIBRARY), here(at(3), PLAZA)]).toEqual([[], ['npc_ilyra'], ['npc_tamsin_reed', 'npc_ilyra']]);
    expect(npcStandsAt(at(3), pack, freshProfile(), 'npc_ilyra', PLAZA)).toBe(true);
    // examine follows presence
    const examinable = (s: GameState) => types(legalActions(s, pack, freshProfile(), { includeExamine: true }), 'examine').some((a) => a.type === 'examine' && a.target.kind === 'npc');
    expect([examinable(at(0)), examinable(at(3))]).toEqual([true, false]);
  });

  test('an engine override wins over the schedule', () => {
    const moved = at(3, (s) => void (s.world.npcOverrides.npc_ilyra = { location: NEXUS }));
    expect([here(moved, LIBRARY), here(moved, NEXUS), here(moved, RUINS)]).toEqual([[], ['npc_ilyra'], []]);
    const gone = at(0, (s) => void (s.world.npcOverrides.npc_ilyra = { location: null }));
    expect(here(gone, RUINS)).toEqual([]);
  });
});

describe('Loop 1 Apex: Face it / Not yet (D-067.1)', () => {
  const atNexus = () => makeState({ locationId: NEXUS, quests: APEX_OPEN });

  test('arrival plays the enter events, then opens the prompt: dialogue mode, no autosave, nothing started', () => {
    const out = play(atNexus(), [{ type: 'move', to: APEX_LOCATION_ID }]);
    const s = out.state;
    expect(s.mode).toBe('dialogue');
    expect(s.dialogue).toMatchObject({ sceneId: APEX_PROMPT_SCENE, npcId: null, returnMode: 'explore' });
    expect(out.events.map((e) => e.t)).toContain('eventFired'); // ev_apex_first_entry
    expect(ofType(out.events, 'dialogueStarted')).toEqual([{ t: 'dialogueStarted', sceneId: APEX_PROMPT_SCENE, npcId: null }]);
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([]);
    expect(legalActions(s, content, freshProfile())).toEqual([
      { type: 'choose', choiceId: APEX_FACE_IT },
      { type: 'choose', choiceId: APEX_NOT_YET },
    ]);
  });

  test('Not yet: back to the previous node at no watch cost; the next entry asks again', () => {
    const arrived = play(atNexus(), [{ type: 'move', to: APEX_LOCATION_ID }]);
    const out = play(arrived.state, [{ type: 'choose', choiceId: APEX_NOT_YET }], { profile: arrived.profile });
    expect(out.state.mode).toBe('explore');
    expect(out.state.dialogue).toBeNull();
    expect(out.state.world.currentLocationId).toBe(NEXUS);
    expect(out.state.clock.ticks).toBe(arrived.state.clock.ticks);
    expect(ofType(out.events, 'dialogueEnded')).toEqual([{ t: 'dialogueEnded', sceneId: APEX_PROMPT_SCENE }]);
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([{ t: 'autosaveCheckpoint', reason: 'locationEntered' }]);
    const again = play(out.state, [{ type: 'move', to: APEX_LOCATION_ID }], { profile: out.profile });
    expect(again.state.mode).toBe('dialogue');
    expect(ofType(again.events, 'eventFired')).toEqual([]); // ev_apex_first_entry is once
  });

  test('Face it: explore mode at the Apex (the encounter hook starts the fight, U23)', () => {
    const arrived = play(atNexus(), [{ type: 'move', to: APEX_LOCATION_ID }]);
    const out = play(arrived.state, [{ type: 'choose', choiceId: APEX_FACE_IT }], { profile: arrived.profile });
    expect(out.state.mode).toBe('explore');
    expect(out.state.world.currentLocationId).toBe(APEX_LOCATION_ID);
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([]);
  });

  test('other choices are rejected; outside the prompt `choose` is the dialogue reducer (U33)', () => {
    const arrived = play(atNexus(), [{ type: 'move', to: APEX_LOCATION_ID }]).state;
    expect(step(arrived, { type: 'choose', choiceId: 'yes' }, content, freshProfile()).events[0]).toMatchObject({ reason: "'yes' is not a choice here" });
    expect(step(arrived, { type: 'continue' }, content, freshProfile()).events[0]).toMatchObject({ t: 'actionRejected' });
    const dialogue = makeState({ mode: 'dialogue' });
    expect(step(dialogue, { type: 'choose', choiceId: 'yes' }, content, freshProfile()).events[0]).toMatchObject({ reason: 'there is no conversation to answer' });
    expect(legalActions(dialogue, content, freshProfile())).toEqual([]);
  });

  test('Loop 2+, a Horde or a resolved Tyrant: no prompt', () => {
    const loop2 = play(makeState({ loop: 2, locationId: NEXUS, echoes: ['echo_apex_resonance'] }), [{ type: 'move', to: APEX_LOCATION_ID }]);
    expect(loop2.state.mode).toBe('explore');
    const horde = play(makeState({ locationId: NEXUS, quests: APEX_OPEN, patch: (s) => void (s.world.hordeActive = true) }), [
      { type: 'move', to: APEX_LOCATION_ID },
    ]);
    expect(horde.state.mode).toBe('explore');
  });
});

describe('arrival pipeline', () => {
  test('enterStartLocation: the loop start spawns Day-1 items and fires enter events (the Loop 1 Amulet)', () => {
    const ctx = makeCtx(clone(makeState()), freshProfile(), content);
    enterStartLocation(ctx);
    expect(ground(ctx.s).map((i) => i.itemId)).toEqual(['item_amulet_of_echoes']);
    expect(ctx.s.world.previousLocationId).toBeNull();
    expect(ctx.events.map((e) => e.t)).toEqual(['locationEntered', 'eventFired', 'log', 'autosaveCheckpoint']);
    const loop2 = makeCtx(clone(makeState({ loop: 2 })), freshProfile({ loopCounter: 2 }), content);
    enterStartLocation(loop2);
    expect(ground(loop2.s)).toEqual([]); // the Amulet is on the neck from Loop 2 (D-047)
  });

  test('a content teleport gets the same arrival (post-step hook)', () => {
    const teleportStep = createStep({ ...HANDLERS, setStance: (ctx) => apply({ teleport: LIBRARY }, ctx) }, POST_STEP_HOOKS);
    const out = teleportStep(makeState(), { type: 'setStance', stance: 'support' }, content, freshProfile());
    expect(out.state.world.currentLocationId).toBe(LIBRARY);
    expect(ground(out.state).map((i) => i.itemId)).toEqual(['item_echo_crystal']);
    expect(ofType(out.events, 'eventFired').map((e) => e.eventId)).toEqual(['ev_library_shiver']);
  });

  test('an enter event that teleports hands the arrival over to the destination', () => {
    const pack = packWith({
      [PLAZA]: { events: [{ id: 'ev_plaza_pull', text: 'The fountain pulls you under.', effects: [{ teleport: LIBRARY }] }] },
    });
    const out = play(makeState({ locationId: LIBRARY }, { content: pack }), [{ type: 'move', to: PLAZA }], { content: pack });
    expect(out.state.world.currentLocationId).toBe(LIBRARY);
    expect(ofType(out.events, 'eventFired').map((e) => e.eventId)).toEqual(['ev_plaza_pull', 'ev_library_shiver']);
    expect(ground(out.state, PLAZA)).toEqual([]);
  });
});

describe('legal ⇒ accepted (U20 types, a few fixture states)', () => {
  const states: [string, GameState, Profile][] = [
    ['start', makeState(), freshProfile()],
    ['library', play(makeState(), [{ type: 'move', to: LIBRARY }]).state, freshProfile()],
    ['glowlands', makeState({ locationId: GLOWLANDS, hp: 20 }), freshProfile()],
    ['nexus, gate open', makeState({ locationId: NEXUS, quests: APEX_OPEN }), freshProfile()],
    ['apex prompt', play(makeState({ locationId: NEXUS, quests: APEX_OPEN }), [{ type: 'move', to: APEX_LOCATION_ID }]).state, freshProfile()],
    ['loop 2 road', makeState({ loop: 2, echoes: ['echo_apex_resonance'] }), freshProfile({ loopCounter: 2 })],
  ];
  const mine = new Set(['move', 'retreat', 'take', 'takeAll', 'gather', 'wait', 'rest', 'examine', 'choose']);
  for (const [name, s, profile] of states) {
    test(name, () => {
      const listed = legalActions(s, content, profile, { includeExamine: true }).filter((a) => mine.has(a.type));
      expect(listed.length).toBeGreaterThan(0);
      for (const action of listed) {
        const out = step(s, action, content, profile);
        expect({ action, rejected: out.events.find((e) => e.t === 'actionRejected') }).toEqual({ action, rejected: undefined });
      }
    });
  }
});

// ---- helpers ----------------------------------------------------------------------------------------------------------

function emptyLocationState(): NonNullable<GameState['world']['locationStates'][string]> {
  return {
    visited: false,
    visitCount: 0,
    items: [],
    itemsSpawned: false,
    encountersCleared: [],
    encounterClearedDay: {},
    eventsFired: [],
    flags: {},
    unlockedExits: [],
    lockedExits: [],
    scattered: [],
    encounterHp: {},
  };
}

/** Enough single gear pieces that, with the ranger's tonic stack, the pack's 40 slots are full. */
function packFiller(): ItemSpec[] {
  return Array.from({ length: INVENTORY_SLOTS - 1 }, () => ({ itemId: 'item_wildling_hide_armor' }));
}
