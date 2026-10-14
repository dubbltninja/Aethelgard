// U32: Silverwood Before — PLAN §8.1 row "Silverwood Before" (entering freezes the Breach Clock and sets Day 1; Garret
// rest advances the day; Day 3 rest resets (resets + 1) unless `q_stop_the_ritual` is resolved; what resets vs persists;
// `beforeDay` / `beforeResets` conditions), plus the doors (one way back, the flags), the return's Breach-Clock day,
// loot and XP once per loop, the gathering count, Anchors (only `anchorable` items, in the Conflux, lying in the Depths
// for the loop) and `echo_before_route` / `echo_anchor_mechanic`. DESIGN §10.1, §13.3; STORY §9; WORLD §3.11, §11.3;
// PLAN §4.11; D-066 #9, D-067.4/.5.
import { describe, expect, test } from 'bun:test';
import {
  BEFORE_RESETS_COUNTER,
  BEFORE_RETURN_WATCHES,
  BEFORE_TEXT,
  ECHO_ANCHOR_MECHANIC,
  ECHO_BEFORE_ROUTE,
  FLAG_CONFLUX_ANCHORED,
  FLAG_CRADLE_PIN_ANCHORED,
  FLAG_ENTERED_VIA_APEX,
  FLAG_ENTERED_VIA_NEXUS,
  anchorsInDepths,
  beforeDayFlag,
  claimBeforeSpoils,
  evaluate,
  isLegal,
  legalActions,
  makeCtx,
  step,
  type Action,
  type CombatState,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { ARCHIVES, CONFLUX, CONFLUX_WARDEN, CRADLE_PIN, DEPTHS, GARRET, GATE, TALISMAN, WALKS, WALKS_HOUNDS, beforePack } from '@tests/fixtures/beforeContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';

const pack = beforePack();
const NEXUS = 'loc_chronos_nexus';
const APEX = 'loc_temporal_breach_apex';
const MARK = { statusId: 'status_mark', stacks: 1, duration: 3, sourceUid: null, appliedOnOwnTurn: false };

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
const logs = (events: readonly Ev[]) => ofType(events, 'log').map((e) => e.text);

interface Run {
  s: GameState;
  prof: Profile;
  last: Ev[];
}
function act(r: Run, action: Action): Run {
  const out = step(r.s, action, pack, r.prof);
  const rejected = ofType(out.events, 'actionRejected')[0];
  if (rejected) throw new Error(`${JSON.stringify(action)} was rejected: ${rejected.reason}`);
  return { s: out.state, prof: out.profile, last: out.events };
}
const run = (r: Run, actions: readonly Action[]): Run => actions.reduce(act, r);
function refused(r: Run, action: Action): string {
  const out = step(r.s, action, pack, r.prof);
  expect(out.state).toBe(r.s);
  return ofType(out.events, 'actionRejected')[0]?.reason ?? '(accepted)';
}
function patch(r: Run, fn: (s: GameState) => void): Run {
  const s = clone(r.s);
  fn(s);
  return { ...r, s };
}
const move = (to: string): Action => ({ type: 'move', to });
const FULL: Action = { type: 'rest', kind: 'full' };
const SHORT: Action = { type: 'rest', kind: 'short' };
const cond = (r: Run, c: Parameters<typeof evaluate>[0]) => evaluate(c, r.s, r.prof, pack);

/** Loop 2, level 14, at the Nexus on Day 5 at dawn (ticks 16), its Aberration already beaten. */
function atNexus(o: StateOverrides = {}): Run {
  const prof = freshProfile({ loopCounter: 2 });
  const s = makeState(
    {
      loop: 2,
      level: 14,
      locationId: NEXUS,
      day: 5,
      ...o,
      patch: (st) => {
        st.world.locationStates[NEXUS] = { ...emptyLocation(), visited: true, visitCount: 1, itemsSpawned: true, encountersCleared: ['enc_nexus_aberration'] };
        o.patch?.(st);
      },
    },
    { content: pack, profile: prof },
  );
  return { s, prof, last: [] };
}
const emptyLocation = () => ({
  visited: false, visitCount: 0, items: [], itemsSpawned: false, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
  unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
});
/** Through the Breach-door to the Silver Gate. */
const enter = (o: StateOverrides = {}): Run => act(atNexus(o), move(GATE));
/** Gate → Walks → Garret. */
const toGarret = (r: Run): Run => run(r, [move(WALKS), move(GARRET)]);
/** Wins the fight in progress: the enemy at 1 HP and Marked, one attack. */
function win(r: Run): Run {
  expect(r.s.mode).toBe('combat');
  const marked = patch(r, (s) => {
    const foe = (s.combat as CombatState).enemies[0]!;
    foe.hp = 1;
    foe.statuses.push({ ...MARK });
  });
  return act(marked, { type: 'attack', targetUid: (marked.s.combat as CombatState).enemies[0]!.uid });
}

/** Loop 2 at the Apex with the Tyrant spared (its fight over) and the Nexus quiet. */
const atApex = (o: StateOverrides = {}) =>
  atNexus({
    locationId: APEX,
    flags: { flag_tyrant_spared: true },
    ...o,
    patch: (s) => {
      s.world.tyrant = 'spared';
      s.world.locationStates[APEX] = { ...emptyLocation(), visited: true, visitCount: 1, itemsSpawned: true, encountersCleared: ['enc_apex_tyrant'], eventsFired: ['ev_apex_first_entry'] };
      o.patch?.(s);
    },
  });

describe('entering: the Breach Clock freezes, the echo starts at First Bell', () => {
  test('Day 1, the day flag, the door flag, echo_before_route, beforeDayAdvanced; the Breach Clock does not move', () => {
    const r = enter();
    expect(r.s.before).toEqual({ day: 1, resets: 0 });
    expect(r.s.clock.frozen).toBe(true);
    expect(r.s.clock.ticks).toBe(16);
    expect(r.s.flags[beforeDayFlag(1)]).toBe(true);
    expect(r.s.flags[FLAG_ENTERED_VIA_NEXUS]).toBe(true);
    expect(r.s.flags[FLAG_ENTERED_VIA_APEX]).toBeUndefined();
    expect(r.s.echoesThisLoop).toContain(ECHO_BEFORE_ROUTE);
    expect(ofType(r.last, 'beforeDayAdvanced')).toEqual([{ t: 'beforeDayAdvanced', day: 1, resets: 0 }]);
    expect(logs(r.last)).toContain(BEFORE_TEXT.enter);
    // the day is set before the arrival's events and hooks run
    expect(r.last.findIndex((e) => e.t === 'beforeDayAdvanced')).toBeLessThan(r.last.findIndex((e) => e.t === 'eventFired'));
  });

  test('edges inside cost no watch; waiting is refused while time stands still', () => {
    const r = run(enter(), [move(WALKS), move(ARCHIVES), move(WALKS), move(GARRET)]);
    expect(r.s.clock.ticks).toBe(16);
    expect(ofType(r.last, 'watchAdvanced')).toEqual([]);
    expect(refused(r, { type: 'wait' })).toContain('time does not pass here');
    expect(legalActions(r.s, pack, r.prof).some((a) => a.type === 'wait' || a.type === 'keepVigil')).toBe(false);
  });

  test('beforeDay / beforeResets conditions read the counter; both are false outside the Before', () => {
    const outside = atNexus();
    expect(cond(outside, { beforeDay: 1 })).toBe(false);
    expect(cond(outside, { beforeResets: { min: 0 } })).toBe(false);
    const r = enter();
    expect(cond(r, { beforeDay: 1 })).toBe(true);
    expect(cond(r, { beforeDay: 2 })).toBe(false);
    expect(cond(r, { beforeResets: { max: 0 } })).toBe(true);
    expect(cond(r, { flag: 'flag_before_day_1' })).toBe(true);
  });
});

describe('the days: a full rest at the Garret advances the Before day; Last Bell resets', () => {
  test('First → Second → Last Bell, with the flags mirrored and the event; a short rest changes nothing', () => {
    const r0 = toGarret(enter());
    const short = act(r0, SHORT);
    expect(short.s.before?.day).toBe(1);
    const r2 = act(short, FULL);
    expect(r2.s.before).toEqual({ day: 2, resets: 0 });
    expect(r2.s.flags[beforeDayFlag(2)]).toBe(true);
    expect(r2.s.flags[beforeDayFlag(1)]).toBeUndefined();
    expect(ofType(r2.last, 'beforeDayAdvanced')).toEqual([{ t: 'beforeDayAdvanced', day: 2, resets: 0 }]);
    const r3 = act(r2, FULL);
    expect(r3.s.before?.day).toBe(3);
    expect(cond(r3, { beforeDay: 3 })).toBe(true);
    expect(logs(r3.last)).toContain(BEFORE_TEXT.day[3]);
    expect(r3.s.clock.ticks).toBe(16); // the Breach Clock never moved
  });

  test('a full rest on Last Bell brings its dusk: the echo resets to First Bell (resets + 1)', () => {
    const r = run(toGarret(enter()), [FULL, FULL, FULL]);
    expect(r.s.before).toEqual({ day: 1, resets: 1 });
    expect(r.s.flags[beforeDayFlag(1)]).toBe(true);
    expect(r.s.flags[beforeDayFlag(3)]).toBeUndefined();
    expect(r.s.counters.custom[BEFORE_RESETS_COUNTER]).toBe(1);
    expect(ofType(r.last, 'beforeReset')).toEqual([{ t: 'beforeReset', resets: 1 }]);
    expect(logs(r.last)).toContain(BEFORE_TEXT.reset);
    expect(cond(r, { beforeResets: { min: 1 } })).toBe(true);
    const twice = run(r, [FULL, FULL, FULL]);
    expect(twice.s.before).toEqual({ day: 1, resets: 2 });
  });

  test('once q_stop_the_ritual is resolved (completed or failed), Last Bell holds', () => {
    for (const status of ['completed', 'failed'] as const) {
      const r = run(toGarret(enter({ quests: { q_stop_the_ritual: { status, stage: 'inevitable' } } })), [FULL, FULL, FULL]);
      expect(r.s.before).toEqual({ day: 3, resets: 0 });
      expect(ofType(r.last, 'beforeReset')).toEqual([]);
      expect(logs(r.last)).toContain(BEFORE_TEXT.holds);
    }
    // an attempt still running does not stop it
    const running = run(toGarret(enter({ quests: { q_stop_the_ritual: 'attempt' } })), [FULL, FULL, FULL]);
    expect(running.s.before?.resets).toBe(1);
  });
});

describe('what resets and what persists (DESIGN §10.1)', () => {
  test('Before-local flags, the Wayfinder\'s leavings and the enemies reset; Echoes, inventory, quests and anchors persist', () => {
    const r0 = patch(toGarret(enter({ items: ['item_glow_moss', TALISMAN], quests: { q_stop_the_ritual: 'attempt' } })), (s) => {
      s.flags.flag_wanted_in_silverwood = true;
      s.flags.flag_before_hall_open = true;
      s.flags[FLAG_CONFLUX_ANCHORED] = true;
      s.flags.flag_tyrant_spared = true;
      s.world.locationStates[WALKS]!.encountersCleared.push(WALKS_HOUNDS);
      s.world.locationStates[WALKS]!.scattered.push('enc_other');
      s.world.pendingEncounters[ARCHIVES] = [{ id: 'spawn_1', groups: [{ creatureId: 'cr_glowfen_mireling', count: 1 }], once: true, onFlee: 'scatter' }];
    });
    const moss = r0.s.player.inventory.find((i) => i.itemId === 'item_glow_moss')!;
    const dropped = act(r0, { type: 'drop', uid: moss.uid });
    expect(dropped.s.world.locationStates[GARRET]!.items.map((i) => i.itemId)).toContain('item_glow_moss');
    const r = run(dropped, [FULL, FULL, FULL]);
    expect(r.s.before?.resets).toBe(1);
    // reset
    expect(r.s.flags.flag_wanted_in_silverwood).toBeUndefined();
    expect(r.s.flags.flag_before_hall_open).toBeUndefined();
    expect(r.s.world.locationStates[GARRET]!.items.map((i) => i.itemId)).not.toContain('item_glow_moss');
    expect(Object.keys(r.s.world.locationStates[GARRET]!.flags).filter((k) => k.startsWith('ground:'))).toEqual([]);
    expect(r.s.world.locationStates[WALKS]!.encountersCleared).toEqual([]);
    expect(r.s.world.locationStates[WALKS]!.scattered).toEqual([]);
    expect(r.s.world.pendingEncounters[ARCHIVES]).toBeUndefined();
    // persist
    expect(r.s.flags[FLAG_CONFLUX_ANCHORED]).toBe(true);
    expect(r.s.flags.flag_tyrant_spared).toBe(true);
    expect(r.s.flags[FLAG_ENTERED_VIA_NEXUS]).toBe(true);
    expect(r.s.echoesThisLoop).toContain(ECHO_BEFORE_ROUTE);
    expect(r.s.player.inventory.map((i) => i.itemId)).toContain(TALISMAN);
    expect(r.s.quests.q_stop_the_ritual?.status).toBe('active');
    // the Garret's own content items and events are the loop's: they do not come back
    expect(r.s.world.locationStates[GARRET]!.eventsFired).toContain('ev_garret_litany');
  });

  test('the enemies stand again after a reset — and pay nothing the second time (XP and loot once per loop)', () => {
    const day2 = act(toGarret(enter()), FULL);
    const fight = act(day2, move(WALKS));
    expect(fight.s.combat?.encounterId).toBe(WALKS_HOUNDS);
    const won = win(fight);
    const first = ofType(won.last, 'combatEnded')[0]!;
    expect(first.result).toBe('victory');
    expect(first.xp).toBeGreaterThan(0);
    expect(first.gold).toBeGreaterThan(0);
    expect(won.s.world.locationStates[WALKS]!.encountersCleared).toContain(WALKS_HOUNDS);
    // Last Bell, its dusk, First Bell, Second Bell: the hounds are back
    const again = run(won, [move(GARRET), FULL, FULL, FULL]);
    expect(again.s.before).toEqual({ day: 2, resets: 1 });
    const refight = act(again, move(WALKS));
    expect(refight.s.combat?.encounterId).toBe(WALKS_HOUNDS);
    const xpBefore = refight.s.player.xp;
    const goldBefore = refight.s.player.gold;
    const rewon = win(refight);
    const second = ofType(rewon.last, 'combatEnded')[0]!;
    expect(second).toMatchObject({ result: 'victory', xp: 0, gold: 0, loot: [] });
    expect(rewon.s.player.gold).toBe(goldBefore);
    expect(rewon.s.player.xp).toBe(xpBefore);
  });

  test('claimBeforeSpoils: always outside the Before; inside, the first win of each encounter in the loop', () => {
    const r = enter();
    const ctx = makeCtx(clone(r.s), r.prof, pack);
    expect(claimBeforeSpoils(ctx, NEXUS, 'enc_nexus_aberration')).toBe(true);
    expect(claimBeforeSpoils(ctx, NEXUS, 'enc_nexus_aberration')).toBe(true);
    expect(claimBeforeSpoils(ctx, CONFLUX, CONFLUX_WARDEN)).toBe(true);
    expect(claimBeforeSpoils(ctx, CONFLUX, CONFLUX_WARDEN)).toBe(false);
    expect(claimBeforeSpoils(ctx, WALKS, CONFLUX_WARDEN)).toBe(true);
  });
});

describe('leaving: the door takes a dawn (D-067.5)', () => {
  test('back through the Breach-door: the clock runs again, 4 watches pass with their dawn, the Before flags clear', () => {
    const inside = act(run(toGarret(enter()), [FULL]), move(WALKS)); // Second Bell: the hounds
    const r = run(win(inside), [move(GATE), move(NEXUS)]);
    expect(r.s.before).toBeNull();
    expect(r.s.clock.frozen).toBe(false);
    expect(r.s.clock.ticks).toBe(16 + BEFORE_RETURN_WATCHES);
    expect(ofType(r.last, 'watchAdvanced')).toHaveLength(BEFORE_RETURN_WATCHES);
    expect(ofType(r.last, 'dayAdvanced').map((e) => e.day)).toEqual([6]);
    for (const id of [beforeDayFlag(1), beforeDayFlag(2), beforeDayFlag(3), FLAG_ENTERED_VIA_NEXUS, FLAG_ENTERED_VIA_APEX]) expect(r.s.flags[id]).toBeUndefined();
    expect(logs(r.last)).toContain(BEFORE_TEXT.leave);
    expect(r.s.world.currentLocationId).toBe(NEXUS);
  });

  test('the return can cross the limit: expiry follows in the present', () => {
    const r = act(enter({ patch: (s) => void (s.clock.limitTicks = 18) }), move(NEXUS));
    expect(r.s.clock.ticks).toBe(20);
    expect(r.s.clock.expired).toBe(true);
    expect(ofType(r.last, 'clockExpired')).toHaveLength(1);
  });

  test('re-entering restarts at First Bell; resets, taken loot, the gathering count and the paid fights carry over', () => {
    let r = run(toGarret(enter()), [FULL, FULL, FULL]); // one reset
    r = act(r, move(WALKS));
    const bloom = r.s.world.locationStates[WALKS]!.items.find((i) => i.itemId === 'item_mana_bloom')!;
    r = run(r, [{ type: 'take', uid: bloom.uid }, { type: 'gather' }]);
    expect(refused(r, { type: 'gather' })).toContain('gathered all');
    r = run(r, [move(GATE), move(NEXUS)]); // a day passes in the present
    expect(r.s.clock.ticks).toBe(20);
    r = act(r, move(GATE));
    expect(r.s.before).toEqual({ day: 1, resets: 1 });
    r = act(r, move(WALKS));
    expect(r.s.world.locationStates[WALKS]!.items.map((i) => i.itemId)).not.toContain('item_mana_bloom');
    expect(isLegal(r.s, { type: 'gather' }, pack, r.prof)).toBe(false);
  });
});

describe('the doors (WORLD §11.3): only the one you came by leads back', () => {
  test('through the tear: the Apex door flag; the Breach-door at the Gate stays shut; back through the tear costs the day', () => {
    const inside = act(atApex(), move(CONFLUX));
    expect(inside.s.flags[FLAG_ENTERED_VIA_APEX]).toBe(true);
    expect(inside.s.flags[FLAG_ENTERED_VIA_NEXUS]).toBeUndefined();
    expect(inside.s.before).toEqual({ day: 1, resets: 0 });
    expect(inside.s.combat).toBeNull(); // the tear wakes no pillars (fixture: the Warden stands only on Last Bell)
    const atGate = run(inside, [move(ARCHIVES), move(WALKS), move(GATE)]);
    expect(isLegal(atGate.s, move(NEXUS), pack, atGate.prof)).toBe(false);
    expect(refused(atGate, move(NEXUS))).toContain('closed');
    const back = act(inside, move(APEX));
    expect(back.s.before).toBeNull();
    expect(back.s.clock.ticks).toBe(16 + BEFORE_RETURN_WATCHES);
    expect(back.s.flags[FLAG_ENTERED_VIA_APEX]).toBeUndefined();
  });

  test('and the Breach-door way round: the tear is shut from the Conflux', () => {
    const r = run(enter(), [move(WALKS), move(GARRET), FULL, FULL, move(WALKS), move(ARCHIVES)]);
    const atConflux = act(r, move(CONFLUX)); // the stair opens on Last Bell
    expect(atConflux.s.combat?.encounterId).toBe(CONFLUX_WARDEN);
    const won = win(atConflux);
    expect(isLegal(won.s, move(APEX), pack, won.prof)).toBe(false);
  });
});

describe('Anchors (D-016, D-067.4; STORY §9.3)', () => {
  const pinned = () =>
    act(
      atApex({ items: [TALISMAN, CRADLE_PIN, 'item_glow_moss'], echoes: ['echo_heartstone_path'] }),
      move(CONFLUX),
    );
  const uidOf = (r: Run, itemId: string) => r.s.player.inventory.find((i) => i.itemId === itemId)!.uid;

  test('in the Conflux an anchorable item set down goes on the rim — a quest item too — and lies in the Depths', () => {
    const r = pinned();
    const drops = legalActions(r.s, pack, r.prof).flatMap((a) => (a.type === 'drop' ? [r.s.player.inventory.find((i) => i.uid === a.uid)?.itemId] : []));
    expect(drops).toContain(CRADLE_PIN);
    expect(isLegal(r.s, { type: 'drop', uid: uidOf(r, CRADLE_PIN) }, pack, r.prof)).toBe(true);
    const talisman = act(r, { type: 'drop', uid: uidOf(r, TALISMAN) });
    expect(talisman.s.flags[FLAG_CONFLUX_ANCHORED]).toBe(true);
    expect(talisman.s.flags[FLAG_CRADLE_PIN_ANCHORED]).toBeUndefined();
    expect(talisman.s.world.locationStates[CONFLUX]!.items.map((i) => i.itemId)).not.toContain(TALISMAN);
    expect(talisman.s.world.locationStates[DEPTHS]!.items.map((i) => i.itemId)).toEqual([TALISMAN]);
    expect(anchorsInDepths(talisman.s)).toHaveLength(1);
    expect(logs(talisman.last)).toContain(BEFORE_TEXT.anchor('Sky-Whisper Talisman'));
    const pin = act(talisman, { type: 'drop', uid: uidOf(talisman, CRADLE_PIN) });
    expect(pin.s.flags[FLAG_CRADLE_PIN_ANCHORED]).toBe(true);
    expect(anchorsInDepths(pin.s)).toHaveLength(2);
    // a thing that is not anchorable just lies on the floor
    const moss = act(pin, { type: 'drop', uid: uidOf(pin, 'item_glow_moss') });
    expect(moss.s.world.locationStates[CONFLUX]!.items.map((i) => i.itemId)).toContain('item_glow_moss');
    expect(anchorsInDepths(moss.s)).toHaveLength(2);
  });

  test('only on the rim: elsewhere in the Before a bound item cannot be set down, and a talisman dropped there is no Anchor', () => {
    const r = act(pinned(), move(ARCHIVES));
    expect(refused(r, { type: 'drop', uid: uidOf(r, CRADLE_PIN) })).toContain('cannot be dropped');
    expect(isLegal(r.s, { type: 'drop', uid: uidOf(r, CRADLE_PIN) }, pack, r.prof)).toBe(false);
    const dropped = act(r, { type: 'drop', uid: uidOf(r, TALISMAN) });
    expect(dropped.s.world.locationStates[ARCHIVES]!.items.map((i) => i.itemId)).toContain(TALISMAN);
    expect(dropped.s.flags[FLAG_CONFLUX_ANCHORED]).toBeUndefined();
  });

  test('back in the present the Anchors lie in the Depths past the dawn; finding them grants echo_anchor_mechanic once', () => {
    let r = pinned();
    r = run(r, [
      { type: 'drop', uid: uidOf(r, TALISMAN) },
      { type: 'drop', uid: uidOf(r, CRADLE_PIN) },
    ]);
    r = run(r, [move(APEX), move(NEXUS)]); // the door took a dawn (Day 6)
    expect(r.s.clock.ticks).toBeGreaterThanOrEqual(20);
    r = act(r, move(DEPTHS));
    expect(r.s.echoesThisLoop).toContain(ECHO_ANCHOR_MECHANIC);
    expect(logs(r.last)).toContain(BEFORE_TEXT.found('Sky-Whisper Talisman'));
    expect(logs(r.last)).toContain(BEFORE_TEXT.found("Hallow's Cradle-Pin"));
    expect(r.s.world.locationStates[DEPTHS]!.items.map((i) => i.itemId).sort()).toEqual([CRADLE_PIN, TALISMAN].sort());
    const twice = run(r, [move(NEXUS), move(DEPTHS)]);
    expect(logs(twice.last).filter((l) => l.startsWith('On the ninth plinth'))).toEqual([]);
    const taken = act(twice, { type: 'take', uid: twice.s.world.locationStates[DEPTHS]!.items.find((i) => i.itemId === TALISMAN)!.uid });
    expect(taken.s.player.inventory.map((i) => i.itemId)).toContain(TALISMAN);
    expect(anchorsInDepths(taken.s)).toHaveLength(1);
  });

  test('no Anchor, no discovery', () => {
    const r = act(atNexus({ echoes: ['echo_heartstone_path'] }), move(DEPTHS));
    expect(r.s.echoesThisLoop).not.toContain(ECHO_ANCHOR_MECHANIC);
  });
});
