// U20: the clock part of the loop reducer — PLAN §8.1 row "clock/rest/travel" (ticks arithmetic, 2-watch edges, short
// vs full rest, warnings at 10/5/2/1 dawns left, clockWatches floor, Heartstone ±24/−20/−40, Frayed Clock halving,
// expiry → Horde with a 3-move delay and the Library portal, immediate vs after combat, ending E `daysLeft ≤ 1`), plus
// the frozen clock (Silverwood Before), dawn hooks and out-of-combat status ticks (DESIGN §4.5, §10.1–10.2, PLAN §4.11).
import { describe, expect, test } from 'bun:test';
import { buildContentPack, type ContentTables } from '@content/index';
import type { LocationInput } from '@schema/location';
import {
  DAWN_HOOKS,
  FLAG_CLOCK_EXPIRED,
  HANDLERS,
  POST_STEP_HOOKS,
  RESTED_STATUS,
  advanceTime,
  apply,
  clearEncounterHp,
  clockHook,
  createStep,
  expireGroundLoot,
  dayOf,
  dayStartTick,
  dawnsLeft,
  daysLeft,
  enterMode,
  evaluate,
  fireDawnEvents,
  floorTick,
  lastDawnTick,
  legalActions,
  makeCtx,
  passTime,
  resetDailyUses,
  skipToLastDawn,
  step,
  warningCrossed,
  warningText,
  watchOf,
  watchesToNextDawn,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { fullState } from '../types/handmade';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';
import { FIXTURE_VERSION, fixturePack, miniContentTables } from '@tests/fixtures/miniContent';

const content = fixturePack();
const RUINS = 'loc_whispering_ruins';
const LIBRARY = 'loc_shattered_library';
const GLOWLANDS = 'loc_veridian_glowlands';
const NEXUS = 'loc_chronos_nexus';
const ENDING_E_GATE = { clock: { daysLeft: { max: 1 } } } as const;

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const tick = (day: number, watch = 0) => (day - 1) * 4 + watch;
const full = { type: 'rest', kind: 'full' } as const;
const short = { type: 'rest', kind: 'short' } as const;

function packWith(patch: Record<string, Partial<LocationInput>>): ContentPack {
  const tables: ContentTables = {
    ...miniContentTables,
    locations: miniContentTables.locations.map((loc) => (patch[loc.id] ? { ...clone(loc), ...patch[loc.id] } : loc)),
  };
  return buildContentPack(tables, { version: FIXTURE_VERSION });
}

/** A ctx over a copy of `s`, for driving effects and the clock hook directly. */
const ctxOver = (s: GameState, profile: Profile = freshProfile({ loopCounter: s.meta.loop })) => makeCtx(clone(s), profile, content);

const dot = (statusId: string, tickAmount: number, duration: number, stacks = 1): StatusInstance => ({
  statusId,
  stacks,
  duration,
  sourceUid: null,
  tick: tickAmount,
  appliedOnOwnTurn: false,
});

describe('ticks arithmetic', () => {
  test('day/watch from ticks; dawn boundaries; the floor; the last dawn before the limit', () => {
    expect([dayOf(0), watchOf(0), dayOf(3), watchOf(3), dayOf(4), watchOf(4)]).toEqual([1, 0, 1, 3, 2, 0]);
    expect([dayStartTick(0), dayStartTick(7), dayStartTick(8)]).toEqual([0, 4, 8]);
    expect([watchesToNextDawn(0), watchesToNextDawn(1), watchesToNextDawn(3)]).toEqual([4, 3, 1]);
    expect(floorTick(tick(25, 2), content)).toBe(tick(28)); // current day's dawn + 3 dawns
    expect(lastDawnTick(116)).toBe(112); // Day 29 Dawn: one dawn left
    expect(lastDawnTick(111)).toBe(104); // a limit off the dawn: daysLeft at 104 = ⌊7/4⌋ = 1
    expect(daysLeft({ ticks: 104, limitTicks: 111 })).toBe(1);
    expect(daysLeft({ ticks: 0, limitTicks: 116 })).toBe(29);
  });

  test('travel costs one watch; crossing a dawn emits dayAdvanced with the dawns left', () => {
    const out = play(makeState({ day: 1, watch: 3 }), [{ type: 'move', to: LIBRARY }]);
    expect(out.state.clock.ticks).toBe(4);
    expect(ofType(out.events, 'watchAdvanced')).toEqual([{ t: 'watchAdvanced', day: 2, watch: 0 }]);
    expect(ofType(out.events, 'dayAdvanced')).toEqual([{ t: 'dayAdvanced', day: 2, daysLeft: 28 }]);
  });

  test('2-watch edges cost two watches and can cross a dawn (the remembered road, D-069.9)', () => {
    const s = makeState({ loop: 2, echoes: ['echo_apex_resonance'], day: 3, watch: 3 });
    const out = play(s, [{ type: 'move', to: NEXUS }]);
    expect(out.state.clock.ticks).toBe(tick(4, 1));
    expect(ofType(out.events, 'watchAdvanced').map((e) => [e.day, e.watch])).toEqual([[4, 0], [4, 1]]);
    expect(ofType(out.events, 'dayAdvanced')).toHaveLength(1);
  });

  test('passTime is a no-op while frozen (Silverwood Before) and for 0 watches', () => {
    const ctx = ctxOver(makeState({ patch: (s) => void (s.clock.frozen = true) }));
    expect(passTime(ctx, 3)).toBe(0);
    expect(skipToLastDawn(ctx)).toBe(0);
    expect(ctx.s.clock.ticks).toBe(0);
    const live = ctxOver(makeState());
    expect(passTime(live, 0)).toBe(0);
    expect(passTime(live, 2)).toBe(2);
    expect(live.s.clock.ticks).toBe(2);
  });
});

describe('rest', () => {
  test('short: 1 watch, +30 % HP/MP, rested event, autosave', () => {
    const s = makeState({ hp: 40, mp: 10 });
    const { hpMax, mpMax } = s.player;
    const out = play(s, [short]);
    const hp = Math.min(hpMax, 40 + Math.round(hpMax * 0.3));
    const mp = Math.min(mpMax, 10 + Math.round(mpMax * 0.3));
    expect(out.state.clock.ticks).toBe(1);
    expect([out.state.player.hp, out.state.player.mp]).toEqual([hp, mp]);
    expect(ofType(out.events, 'rested')).toEqual([{ t: 'rested', locationId: RUINS, hpRestored: hp - 40, mpRestored: mp - 10 }]);
    expect(out.state.counters.rests).toBe(1);
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([{ t: 'autosaveCheckpoint', reason: 'rest' }]);
  });

  test('full: to the next dawn with full HP/MP; at dawn it sleeps a whole day', () => {
    const fromDay = play(makeState({ hp: 1, mp: 0, day: 3, watch: 1 }), [full]);
    expect(fromDay.state.clock.ticks).toBe(tick(4));
    expect([fromDay.state.player.hp, fromDay.state.player.mp]).toEqual([fromDay.state.player.hpMax, fromDay.state.player.mpMax]);
    expect(ofType(fromDay.events, 'dayAdvanced')).toEqual([{ t: 'dayAdvanced', day: 4, daysLeft: 26 }]);
    expect(play(makeState({ day: 3 }), [full]).state.clock.ticks).toBe(tick(4));
    expect(play(makeState({ day: 3, watch: 3 }), [full]).state.clock.ticks).toBe(tick(4));
  });

  test('only at a rest spot; both kinds listed there', () => {
    expect(legalActions(makeState(), content, freshProfile()).filter((a) => a.type === 'rest')).toEqual([full, short]);
    expect(step(makeState({ locationId: LIBRARY }), short, content, freshProfile()).events[0]).toMatchObject({ reason: 'there is nowhere to rest here' });
  });

  test('an inn: the full rest costs its price and grants status_rested; too poor → only the short rest', () => {
    const pack = packWith({ [RUINS]: { rest: { kind: 'inn', cost: 10 } } });
    const out = play(makeState({ gold: 30 }, { content: pack }), [full], { content: pack });
    expect(out.state.player.gold).toBe(20);
    expect(out.state.counters.goldSpent).toBe(10);
    expect(ofType(out.events, 'goldChanged')).toEqual([{ t: 'goldChanged', delta: -10, total: 20 }]);
    expect(out.state.player.statuses.map((st) => st.statusId)).toEqual([RESTED_STATUS]);
    const poor = makeState({ gold: 5 }, { content: pack });
    expect(legalActions(poor, pack, freshProfile()).filter((a) => a.type === 'rest')).toEqual([short]);
    expect(step(poor, full, pack, freshProfile()).events[0]).toMatchObject({ reason: 'a bed here costs 10 gold' });
  });

  test('any rest clears the out-of-combat DoTs; only a full rest brings a KO\'d companion round, at 50 % (DESIGN §12.6, U28)', () => {
    const s = makeState({
      patch: (st) => {
        st.player.statuses = [dot('status_poison', 3, 4), dot('status_bleed', 2, 3, 2)];
        st.companions = {
          activeId: 'ilyra',
          recruited: {
            ilyra: { id: 'ilyra', recruited: true, loyalty: 0, hp: 0, hpMax: 80, ko: true, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} },
          },
        };
      },
    });
    const out = play(s, [short]);
    expect(out.state.player.statuses).toEqual([]);
    expect(ofType(out.events, 'statusExpired').map((e) => e.statusId)).toEqual(['status_poison', 'status_bleed']);
    expect(ofType(out.events, 'statusTicked')).toEqual([]);
    expect(out.state.companions.recruited.ilyra).toMatchObject({ ko: true, hp: 0 });
    expect(play(s, [full]).state.companions.recruited.ilyra).toMatchObject({ ko: false, hp: 40 });
  });

  test('`once: false` items respawn when the player rests at their location', () => {
    const pack = packWith({ [GLOWLANDS]: { rest: { kind: 'wild' } } });
    const there = play(makeState({ locationId: LIBRARY }, { content: pack }), [{ type: 'move', to: 'loc_silverwood_plaza' }, { type: 'move', to: GLOWLANDS }], {
      content: pack,
    }).state;
    const moss = there.world.locationStates[GLOWLANDS]!.items[0]!;
    const taken = play(there, [{ type: 'take', uid: moss.uid }], { content: pack }).state;
    expect(taken.world.locationStates[GLOWLANDS]!.items).toEqual([]);
    const rested = play(taken, [short], { content: pack }).state;
    expect(rested.world.locationStates[GLOWLANDS]!.items.map((i) => i.itemId)).toEqual(['item_glow_moss']);
  });

  test('frozen clock: rest heals but no time passes (the Before day is U32)', () => {
    const out = play(makeState({ hp: 10, patch: (s) => void (s.clock.frozen = true) }), [full]);
    expect(out.state.clock.ticks).toBe(0);
    expect(out.state.player.hp).toBe(out.state.player.hpMax);
    expect(ofType(out.events, 'watchAdvanced')).toEqual([]);
  });
});

describe('warnings at 10/5/2/1 dawns left (DESIGN §10.1)', () => {
  test('full rests from Day 19: one warning at each threshold, then expiry at Day 30 Dawn', () => {
    const s = makeState({ day: 19 }); // 11 dawns left
    const out = play(s, Array.from({ length: 11 }, () => full));
    expect(ofType(out.events, 'clockWarning').map((e) => e.daysLeft)).toEqual([10, 5, 2, 1]);
    expect(out.state.clock.ticks).toBe(116);
    expect(out.state.clock.expired).toBe(true);
  });

  test('Loop 2+ logs the callout; Loop 1 leaves it to NPC/ambient lines', () => {
    const loop2 = play(makeState({ loop: 2, day: 19 }), [full]);
    expect(loop2.state.recentLog.map((l) => l.text)).toContain('Ten dawns remain.');
    const loop1 = play(makeState({ day: 19 }), [full]);
    expect(loop1.state.recentLog.map((l) => l.text)).not.toContain('Ten dawns remain.');
    expect([warningText(10), warningText(5), warningText(2), warningText(1)]).toEqual(['Ten dawns remain.', 'Five dawns.', 'Two dawns.', 'One dawn.']);
  });

  test('warnings count whole days to the limit: travel inside Day 19 does not warn, the Day 20 dawn does', () => {
    expect([dawnsLeft({ ticks: 72, limitTicks: 116 }), dawnsLeft({ ticks: 73, limitTicks: 116 }), dawnsLeft({ ticks: 76, limitTicks: 116 })]).toEqual([11, 11, 10]);
    const walk = play(makeState({ day: 19, locationId: GLOWLANDS }), [{ type: 'wait' }, { type: 'wait' }, { type: 'wait' }]);
    expect(ofType(walk.events, 'clockWarning')).toEqual([]);
    expect(ofType(play(walk.state, [{ type: 'wait' }]).events, 'clockWarning')).toEqual([{ t: 'clockWarning', daysLeft: 10 }]);
  });

  test('crossing several thresholds at once announces only the most urgent; no warning upward or past the limit', () => {
    expect(warningCrossed(12, 2, [10, 5, 2, 1])).toBe(2);
    expect(warningCrossed(11, 10, [10, 5, 2, 1])).toBe(10);
    expect(warningCrossed(10, 9, [10, 5, 2, 1])).toBeNull();
    expect(warningCrossed(4, 10, [10, 5, 2, 1])).toBeNull();
    expect(warningCrossed(1, 0, [10, 5, 2, 1])).toBeNull();
  });
});

describe('clockWatches: floor, Heartstone, Frayed Clock (DESIGN §10.1, D-066 #8)', () => {
  const change = (s: GameState, watches: number, profile?: Profile) => {
    const ctx = ctxOver(s, profile);
    apply({ clockWatches: watches }, ctx, { source: 'choice:test' });
    clockHook(ctx);
    return ctx;
  };

  test('Heartstone Stabilize +24 / Exploit −20 / Destroy −40 watches, recorded in clock.modifiers', () => {
    expect(change(makeState(), 24).s.clock).toMatchObject({ limitTicks: 140, modifiers: [{ source: 'choice:test', watches: 24 }] });
    expect(change(makeState(), -20).s.clock.limitTicks).toBe(96);
    expect(change(makeState(), -40).s.clock.limitTicks).toBe(76);
    expect(daysLeft(change(makeState(), -40).s.clock)).toBe(19);
  });

  test('the floor: never below the current day + 3 dawns; a reduction stops at it', () => {
    const late = change(makeState({ day: 25, watch: 2 }), -40);
    expect(late.s.clock.limitTicks).toBe(tick(28));
    expect(ofType(late.events, 'clockChanged')).toEqual([{ t: 'clockChanged', deltaWatches: tick(28) - 116, limitTicks: tick(28), floored: true }]);
    expect(change(makeState({ day: 27 }), -4).s.clock.limitTicks).toBe(116); // already inside the floor: no change
  });

  test('a cut that jumps several thresholds warns once, with the most urgent', () => {
    const ctx = change(makeState({ day: 19 }), -40); // 11 dawns → floored at Day 22 Dawn: 3 dawns
    expect(daysLeft(ctx.s.clock)).toBe(3);
    expect(ofType(ctx.events, 'clockWarning')).toEqual([{ t: 'clockWarning', daysLeft: 5 }]);
  });

  test('Frayed Clock: base 80 ticks, other modifiers halved toward zero', () => {
    const profile = freshProfile({ modifiers: { mod_frayed_clock: true } });
    const s = makeState({}, { profile });
    expect(s.clock.limitTicks).toBe(80);
    expect(change(s, 24, profile).s.clock.limitTicks).toBe(92);
    expect(change(s, -40, profile).s.clock.limitTicks).toBe(60);
    expect(change(s, -5, profile).s.clock.limitTicks).toBe(78);
  });
});

describe('expiry → the Horde (DESIGN §10.2, D-066 #7)', () => {
  test('reaching the limit: expired, flag, clockExpired, Horde from the Apex after a 3-move delay, portal open', () => {
    const out = play(makeState({ day: 29, watch: 3 }), [{ type: 'wait' }]);
    const s = out.state;
    expect(s.clock).toMatchObject({ ticks: 116, expired: true });
    expect(s.flags[FLAG_CLOCK_EXPIRED]).toBe(true);
    expect(s.world).toMatchObject({ hordeActive: true, hordeCause: 'expiry', hordeDelay: 3 });
    expect(ofType(out.events, 'clockExpired')).toHaveLength(1);
    expect(ofType(out.events, 'hordeStarted')).toEqual([{ t: 'hordeStarted', cause: 'expiry', delay: 3 }]);
    const again = play(s, [{ type: 'wait' }]);
    expect(ofType(again.events, 'clockExpired')).toEqual([]);
  });

  test('a Horde already running (the Tyrant died) keeps its cause', () => {
    const s = makeState({ day: 29, watch: 3, patch: (st) => Object.assign(st.world, { hordeActive: true, hordeCause: 'tyrant', hordeDelay: 0 }) });
    const out = play(s, [{ type: 'wait' }]);
    expect(out.state.clock.expired).toBe(true);
    expect(out.state.world.hordeCause).toBe('tyrant');
    expect(ofType(out.events, 'hordeStarted')).toEqual([]);
  });

  test('during a fight expiry waits; the first step after the fight applies it', () => {
    const standIn = createStep(
      {
        ...HANDLERS,
        guard: (ctx) => advanceTime(ctx, 1), // time passes mid-fight (a content passWatches)
        flee: (ctx) => {
          ctx.s.combat = null;
          enterMode(ctx, 'explore');
        },
      },
      POST_STEP_HOOKS,
    );
    const inFight = makeState({
      day: 29,
      watch: 3,
      mode: 'combat',
      patch: (s) => {
        s.combat = clone(fullState().combat);
      },
    });
    const profile = freshProfile();
    const during = standIn(inFight, { type: 'guard' }, content, profile);
    expect(during.state.clock.ticks).toBe(116);
    expect(during.state.clock.expired).toBe(false);
    const after = standIn(during.state, { type: 'flee' }, content, profile);
    expect(after.state.clock.expired).toBe(true);
    expect(ofType(after.events, 'hordeStarted')).toEqual([{ t: 'hordeStarted', cause: 'expiry', delay: 3 }]);
  });

  test('never outside play (ending, threshold)', () => {
    const ctx = ctxOver(makeState({ mode: 'ending', patch: (s) => void (s.clock.ticks = 120) }));
    clockHook(ctx);
    expect(ctx.s.clock.expired).toBe(false);
  });
});

describe('ending E: the last dawn before collapse (daysLeft ≤ 1)', () => {
  test('skipToLastDawn lands on the gate; the dawn before it is closed; Frayed Clock too', () => {
    const ctx = ctxOver(makeState());
    expect(skipToLastDawn(ctx)).toBe(112);
    clockHook(ctx);
    expect(ctx.s.clock.ticks).toBe(112);
    expect(evaluate(ENDING_E_GATE, ctx.s, freshProfile(), content)).toBe(true);
    expect(ofType(ctx.events, 'clockWarning')).toEqual([{ t: 'clockWarning', daysLeft: 1 }]);
    expect(ctx.s.clock.expired).toBe(false);
    expect(evaluate(ENDING_E_GATE, makeState({ day: 28 }), freshProfile(), content)).toBe(false);
    expect(skipToLastDawn(ctx)).toBe(0);
    const profile = freshProfile({ modifiers: { mod_frayed_clock: true } });
    const frayed = ctxOver(makeState({}, { profile }), profile);
    skipToLastDawn(frayed);
    expect(frayed.s.clock.ticks).toBe(76);
    expect(evaluate(ENDING_E_GATE, frayed.s, profile, content)).toBe(true);
  });
});

describe('dawn hooks', () => {
  test('per-day uses reset, per-loop uses kept; fled-boss HP cleared', () => {
    const s = makeState({
      day: 2,
      watch: 2,
      patch: (st) => {
        st.player.uses = { respec: { day: 2 }, att_old_road: { loop: 1 }, att_second_wind: { loop: 1, count: 1 } };
        st.world.locationStates[NEXUS] = { ...emptyLs(), encounterHp: { enc_nexus_aberration: { c7: 120 } } };
      },
    });
    const out = play(s, [full]);
    expect(out.state.player.uses).toEqual({ att_old_road: { loop: 1 }, att_second_wind: { loop: 1, count: 1 } });
    expect(out.state.world.locationStates[NEXUS]?.encounterHp).toEqual({});
    expect(DAWN_HOOKS).toEqual([resetDailyUses, clearEncounterHp, fireDawnEvents, expireGroundLoot]); // + U26b
  });

  test('`dawn` events of the location the player wakes in fire at each dawn', () => {
    const pack = packWith({
      [RUINS]: {
        events: [
          { id: 'ev_ruins_echo', text: 'A low hum.' },
          { id: 'ev_ruins_dawn', trigger: 'dawn', once: false, text: 'Grey light finds the tablets.', effects: [{ counter: { name: 'dawns_seen', delta: 1 } }] },
        ],
      },
    });
    const out = play(makeState({}, { content: pack }), [full, full], { content: pack });
    expect(ofType(out.events, 'eventFired').map((e) => e.eventId)).toEqual(['ev_ruins_dawn', 'ev_ruins_dawn']);
    expect(out.state.counters.custom.dawns_seen).toBe(2);
  });
});

describe('out-of-combat statuses (DESIGN §4.5)', () => {
  test('Poison/Bleed/Curse tick once per watch (Bleed per stack), count down and expire; never below 1 HP', () => {
    const s = makeState({
      locationId: GLOWLANDS,
      hp: 50,
      patch: (st) => void (st.player.statuses = [dot('status_poison', 3, 2), dot('status_bleed', 2, 1, 2)]),
    });
    const one = play(s, [{ type: 'wait' }]);
    expect(one.state.player.hp).toBe(50 - 3 - 4);
    expect(ofType(one.events, 'statusTicked')).toEqual([
      { t: 'statusTicked', targetUid: 'player', statusId: 'status_poison', amount: 3 },
      { t: 'statusTicked', targetUid: 'player', statusId: 'status_bleed', amount: 4 },
    ]);
    expect(ofType(one.events, 'statusExpired').map((e) => e.statusId)).toEqual(['status_bleed']);
    const two = play(one.state, [{ type: 'wait' }]);
    expect(two.state.player.statuses).toEqual([]);
    expect(two.state.counters.damageTaken).toBe(10);
    const nearlyDead = play(makeState({ locationId: GLOWLANDS, hp: 2, patch: (st) => void (st.player.statuses = [dot('status_curse', 9, 3)]) }), [{ type: 'wait' }]);
    expect(nearlyDead.state.player.hp).toBe(1);
  });

  test('a two-watch skip ticks twice; other statuses (status_rested) are left alone', () => {
    const s = makeState({
      loop: 2,
      echoes: ['echo_apex_resonance'],
      hp: 50,
      patch: (st) => {
        st.player.statuses = [dot('status_poison', 1, 4), { statusId: RESTED_STATUS, stacks: 1, duration: 1, sourceUid: null, appliedOnOwnTurn: false }];
        st.world.locationStates[NEXUS] = { ...emptyLs(), encountersCleared: ['enc_nexus_aberration'] }; // no arrival fight (U23)
      },
    });
    const out = play(s, [{ type: 'move', to: NEXUS }]);
    expect(ofType(out.events, 'statusTicked')).toHaveLength(2);
    expect(out.state.player.statuses.map((st) => [st.statusId, st.duration])).toEqual([
      ['status_poison', 2],
      [RESTED_STATUS, 1],
    ]);
  });
});

function emptyLs(): NonNullable<GameState['world']['locationStates'][string]> {
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
