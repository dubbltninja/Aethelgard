// U26: flee, scatter, hold, and Guard (DESIGN §3.2 `flee%`, §4.1, §4.7; PLAN §4.10 "Flee", §8.1 "turn order & flee &
// guard": the flee formula (+15 per failure), bosses/story gates unfleeable, `scatter` (+2 watches, no XP/loot, node
// passable), `previous`, `hold` + `encounterHp` until dawn; Guard 50 % (Warden 65 %) and +5 resource (Warden +8);
// D-066 #11).
import { describe, expect, test } from 'bun:test';
import {
  FLEE_AUTO_TAG,
  beginCombat,
  fleeChanceIn,
  fleeProblem,
  grantFleeAuto,
  legalActions,
  playerOf,
  runCombat,
  type Action,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';
import { BRUTE, D, MISTWOOD, SHADE, combatPack, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';

const content = combatPack();
const profile = freshProfile();
const LIBRARY = 'loc_shattered_library';
const RUINS = 'loc_whispering_ruins';
const TYRANT = 'cr_chronos_tyrant_unveiled';

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });
const state = (o: StateOverrides = {}): GameState => makeState(o, { content });
const spec = (groups: EncounterSpec['groups'], over: Partial<EncounterSpec> = {}): EncounterSpec => ({
  id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [], ...over,
});
const FLEE: Action = { type: 'flee' };
const MISS = [0.999];

/** A fight at the player's first turn (player d4 4, enemies d4 1); the enemies hold still unless `keepIntents`. */
function fight(s: GameState, sp: EncounterSpec, keepIntents = false): GameState {
  const n = sp.groups.reduce((k, g) => k + g.count, 0);
  const ctx = scriptedCtx(s, [D.d4(4), ...Array.from({ length: n }, () => D.d4(1))], content, profile);
  beginCombat(ctx, sp);
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  if (!keepIntents) (ctx.s.combat as CombatState).intents = {};
  return ctx.s;
}
function patched(s: GameState, edit: (c: CombatState, s: GameState) => void): GameState {
  const out = clone(s);
  edit(out.combat as CombatState, out);
  return out;
}
const me = (s: GameState): Combatant => playerOf(s.combat as CombatState);
function act(s: GameState, action: Action, draws: readonly number[] = []) {
  const out = scriptedStep(s, action, draws, content, profile);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}

describe('flee% and the attempt (DESIGN §3.2, §4.1 `F`)', () => {
  test('clamp(40 + 3·AGI − 2·max enemy AGI, 10, 90) + 15 per failed attempt; a failure wastes the turn', () => {
    // the Library's fixed pair of Shades on the first visit: Ranger AGI 8, Shade AGI 5 → 40 + 24 − 10 = 54
    const s = act(state(), { type: 'move', to: LIBRARY }, [D.d4(4), D.d4(1), D.d4(1)]).state;
    expect(fleeChanceIn(content, s.combat!)).toBe(54);
    expect(legalActions(s, content, profile).filter((a) => a.type === 'flee')).toEqual([FLEE]);
    const failed = act(s, FLEE, [D.pct(54), ...MISS, ...MISS]); // 54 is not < 54; then both Rakes miss
    expect(ofType(failed.events, 'fleeAttempt')).toEqual([{ t: 'fleeAttempt', success: false, chance: 54 }]);
    expect(failed.state.combat).toMatchObject({ fleeAttempts: 1, round: 2, phase: 'playerTurn' });
    expect(fleeChanceIn(content, failed.state.combat!)).toBe(69);
    const fled = act(failed.state, FLEE, [D.pct(68)]);
    expect(ofType(fled.events, 'fleeAttempt')).toEqual([{ t: 'fleeAttempt', success: true, chance: 69 }]);
    expect(ofType(fled.events, 'combatEnded')).toEqual([{ t: 'combatEnded', result: 'fled', rounds: 2, xp: 0, gold: 0, loot: [] }]);
  });

  test('the clamp: never below 10 nor above 90 before failures', () => {
    const slow = fight(state(), spec([{ creatureId: SHADE, count: 1 }]));
    const fast = patched(slow, (c) => void (c.enemies[0]!.agi = 60));
    expect(fleeChanceIn(content, fast.combat!)).toBe(10);
    const nimble = patched(slow, (c) => void (c.party[0]!.agi = 60));
    expect(fleeChanceIn(content, nimble.combat!)).toBe(90);
    expect(fleeChanceIn(content, patched(nimble, (c) => void (c.fleeAttempts = 2)).combat!)).toBe(100);
  });
});

describe('what a successful flee does (DESIGN §4.7, D-066 #11)', () => {
  test('scatter (fixed non-boss groups, the default): 3 watches in all, no XP or loot, the party falls back (D-143), the node stays passable for the loop', () => {
    const s = act(state(), { type: 'move', to: LIBRARY }, [D.d4(4), D.d4(1), D.d4(1)]).state;
    const ticks = s.clock.ticks;
    const out = act(s, FLEE, [D.pct(0)]);
    const after = out.state;
    expect(after.mode).toBe('explore');
    expect(after.combat).toBeNull();
    expect(after.world.currentLocationId).toBe(RUINS); // D-143: back the way it came, not left standing at the Library
    expect(after.world.previousLocationId).toBe(LIBRARY);
    expect(ofType(out.events, 'locationEntered').map((e) => e.locationId)).toEqual([RUINS]);
    expect(after.clock.ticks).toBe(ticks + 3);
    expect(after.world.locationStates[LIBRARY]?.scattered).toEqual(['enc_library_shades']);
    expect(ofType(out.events, 'encounterScattered')).toEqual([{ t: 'encounterScattered', locationId: LIBRARY, encounterId: 'enc_library_shades' }]);
    expect(after.player.xp).toBe(0);
    expect(after.counters).toMatchObject({ fled: 1, fightsWon: 0, kills: {} });
    // one checkpoint per step: the arrival's (the fall back), as a `previous` flee has always had
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([{ t: 'autosaveCheckpoint', reason: 'locationEntered' }]);
    // the group does not gather again this loop: the party walks back in and passes (D-037's pacifist reachability)
    const back = play(after, [{ type: 'move', to: LIBRARY }], { content });
    expect(back.state.mode).toBe('explore');
    expect(back.state.world.currentLocationId).toBe(LIBRARY);
  });

  test('scatter with no previous node (or the previous node is this one): the party stays where it is', () => {
    for (const prev of [null, MISTWOOD]) {
      const s0 = state({ locationId: MISTWOOD, patch: (st) => void (st.world.previousLocationId = prev) });
      const out = act(fight(s0, spec([{ creatureId: BRUTE, count: 1 }])), FLEE, [D.pct(0)]);
      expect(out.state.world.currentLocationId).toBe(MISTWOOD);
      expect(ofType(out.events, 'locationEntered')).toEqual([]);
      expect(out.state.world.locationStates[MISTWOOD]?.scattered).toEqual(['enc_test']);
    }
  });

  test('previous (wandering and return encounters): 1 watch, placed at the previous node with no encounter roll there; the encounter is gone', () => {
    // at the Mistwood Path, having come from the Library (whose Shades have not been met yet)
    const s0 = state({ locationId: MISTWOOD, patch: (st) => void (st.world.previousLocationId = LIBRARY) });
    const s = fight(s0, spec([{ creatureId: BRUTE, count: 1 }], { id: 'wandering', onFlee: 'previous' }));
    const out = act(s, FLEE, [D.pct(0)]);
    expect(out.state.mode).toBe('explore');
    expect(out.state.world.currentLocationId).toBe(LIBRARY);
    expect(out.state.world.previousLocationId).toBe(MISTWOOD);
    expect(out.state.clock.ticks).toBe(s.clock.ticks + 1);
    expect(ofType(out.events, 'combatStarted')).toEqual([]); // the Library's fixed group did not roll on this arrival
    expect(ofType(out.events, 'locationEntered').map((e) => e.locationId)).toEqual([LIBRARY]);
    expect(out.state.world.locationStates[MISTWOOD]?.scattered ?? []).toEqual([]);
  });

  test('hold: the group keeps its HP until dawn and the party steps back; the next fight with it resumes at that HP', () => {
    const s0 = state({ locationId: MISTWOOD, patch: (st) => void (st.world.previousLocationId = RUINS) });
    const holdSpec = spec([{ creatureId: BRUTE, count: 1 }], { id: 'enc_hold', onFlee: 'hold' });
    const s = patched(fight(s0, holdSpec), (c) => void (c.enemies[0]!.hp = 30));
    const out = act(s, FLEE, [D.pct(0)]);
    expect(out.state.world.currentLocationId).toBe(RUINS);
    expect(out.state.world.locationStates[MISTWOOD]?.encounterHp).toEqual({ enc_hold: { [BRUTE]: 30 } });
    const again = patched(out.state, () => {});
    again.world.currentLocationId = MISTWOOD;
    const resumed = fight(again, holdSpec);
    expect((resumed.combat as CombatState).enemies[0]).toMatchObject({ hp: 30, hpMax: 64 });
    // a full rest at the Ruins' camp reaches dawn: the held HP is gone
    const rested = play(out.state, [{ type: 'rest', kind: 'full' }], { content });
    expect(rested.state.world.locationStates[MISTWOOD]?.encounterHp).toEqual({});
  });

  test('D-143: every mode falls back to the previous node — previous, scatter and hold alike', () => {
    for (const onFlee of ['previous', 'scatter', 'hold'] as const) {
      const s0 = state({ locationId: MISTWOOD, patch: (st) => void (st.world.previousLocationId = RUINS) });
      const s = fight(s0, spec([{ creatureId: BRUTE, count: 1 }], { id: `enc_${onFlee}`, onFlee }));
      const out = act(s, FLEE, [D.pct(0)]);
      expect([onFlee, out.state.world.currentLocationId, out.state.world.previousLocationId]).toEqual([onFlee, RUINS, MISTWOOD]);
      expect([onFlee, out.state.clock.ticks - s.clock.ticks]).toEqual([onFlee, onFlee === 'scatter' ? 3 : 1]);
      expect(ofType(out.events, 'combatStarted')).toEqual([]); // no roll on the arrival
    }
  });

  test('a spawned group that scatters is gone; the encounter\'s onFleeEffects apply', () => {
    const s0 = state({
      patch: (st) => void (st.world.pendingEncounters[RUINS] = [{ id: 'spawn_1', groups: [{ creatureId: SHADE, count: 1 }], once: true, onFlee: 'scatter' }]),
    });
    const s = fight(s0, spec([{ creatureId: SHADE, count: 1 }], { id: 'spawn_1', onFleeEffects: [{ setFlag: 'flag_ran' }] }));
    const out = act(s, FLEE, [D.pct(0)]);
    expect(out.state.world.pendingEncounters[RUINS]).toBeUndefined();
    expect(out.state.flags.flag_ran).toBe(true);
    expect(ofType(out.events, 'encounterScattered')).toEqual([]);
  });
});

describe('a held quest-drop group (D-143, DESIGN §4.7)', () => {
  /** The Library's pair of Shades as a quest-drop group (`hold`), at `chance`. */
  const heldPack = (chance = 1) =>
    combatPack(({ locations }) => {
      const lib = locations.find((l) => l.id === LIBRARY)!;
      lib.encounters = lib.encounters!.map((e) => ({ ...e, onFlee: 'hold' as const, chance }));
    });
  const INIT = [D.d4(4), D.d4(1), D.d4(1)];
  const enter = (pack: ReturnType<typeof heldPack>, s: GameState, draws: readonly number[]) => {
    const out = scriptedStep(s, { type: 'move', to: LIBRARY }, draws, pack, profile);
    expect(out.rejected).toBeNull();
    expect(out.left).toBe(0);
    return out;
  };
  const flee = (pack: ReturnType<typeof heldPack>, s: GameState) => {
    const out = scriptedStep(s, FLEE, [D.pct(0)], pack, profile);
    expect(out.rejected).toBeNull();
    return out;
  };

  test('it falls back, keeps each wound until dawn and re-fires on the next arrival showing the stored HP; at dawn it is whole', () => {
    const pack = heldPack();
    const s0 = makeState({}, { content: pack });
    const met = enter(pack, s0, INIT).state;
    expect(met.combat).toMatchObject({ encounterId: 'enc_library_shades', onFlee: 'hold' });
    const wounded = patched(met, (c) => {
      c.enemies[0]!.hp = 7;
      c.enemies[1]!.hp = 11;
    });
    const out = flee(pack, wounded);
    expect(out.state.world.currentLocationId).toBe(RUINS);
    expect(out.state.clock.ticks).toBe(met.clock.ticks + 1); // a hold costs the one watch, not a scatter's three
    expect(out.state.world.locationStates[LIBRARY]).toMatchObject({ scattered: [], encounterHp: { enc_library_shades: { [SHADE]: 7, [`${SHADE}#2`]: 11 } } });
    expect(ofType(out.events, 'encounterScattered')).toEqual([]);
    // back in: the same pair, wounded as it was left
    const again = enter(pack, out.state, INIT).state;
    expect(again.combat?.encounterId).toBe('enc_library_shades');
    expect(again.combat?.enemies.map((e) => e.hp)).toEqual([7, 11]);
    // flee again, rest to dawn at the Ruins: the wounds are gone and the pair stands whole on the next arrival
    const fledAgain = flee(pack, again).state;
    const rested = play(fledAgain, [{ type: 'rest', kind: 'full' }], { content: pack, profile });
    expect(rested.state.world.locationStates[LIBRARY]?.encounterHp).toEqual({});
    const fresh = enter(pack, rested.state, INIT).state;
    expect(fresh.combat?.enemies.map((e) => e.hp)).toEqual(fresh.combat?.enemies.map((e) => e.hpMax));
  });

  test('a creature felled before the flight stands again whole (its drop was never taken); a win clears the held HP', () => {
    const pack = heldPack();
    const met = enter(pack, makeState({}, { content: pack }), INIT).state;
    const oneDown = patched(met, (c) => {
      c.enemies[0]!.hp = 0;
      c.enemies[0]!.alive = false;
      c.enemies[1]!.hp = 9;
    });
    const out = flee(pack, oneDown);
    expect(out.state.world.locationStates[LIBRARY]?.encounterHp).toEqual({ enc_library_shades: { [`${SHADE}#2`]: 9 } });
    const again = enter(pack, out.state, INIT).state;
    const [first, second] = again.combat!.enemies;
    expect([first!.hp, second!.hp]).toEqual([first!.hpMax, 9]);
  });

  test('a held group skips its first-visit rule and its chance: a 50 % first-visit group re-fires on the next arrival without a roll', () => {
    const pack = heldPack(0.5);
    const met = enter(pack, makeState({}, { content: pack }), [D.yes, ...INIT]).state;
    const out = flee(pack, patched(met, (c) => void (c.enemies[0]!.hp = 5)));
    const again = enter(pack, out.state, INIT).state; // no chance draw
    expect(again.combat?.enemies[0]?.hp).toBe(5);
    // after dawn the group's own rule is back: a later visit does not roll a first-visit group
    const rested = play(flee(pack, again).state, [{ type: 'rest', kind: 'full' }], { content: pack, profile });
    const later = scriptedStep(rested.state, { type: 'move', to: LIBRARY }, [], pack, profile);
    expect(later.rejected).toBeNull();
    expect(later.state.mode).toBe('explore');
  });
});

describe('who cannot flee (DESIGN §4.7, §3.2, §4.11)', () => {
  test('bosses and story gates (fleeable: false — the encounter or a creature in it); a Slowed player; communion', () => {
    const gate = fight(state(), spec([{ creatureId: SHADE, count: 1 }], { fleeable: false }));
    expect(fleeProblem(content, gate.combat!)).toBe('There is no fleeing from this fight');
    expect(legalActions(gate, content, profile).some((a) => a.type === 'flee')).toBe(false);
    expect(scriptedStep(gate, FLEE, [], content, profile).rejected).toBe('There is no fleeing from this fight');
    const boss = fight(state(), spec([{ creatureId: TYRANT, count: 1 }]));
    expect(boss.combat!.canFlee).toBe(false);
    const open = fight(state(), spec([{ creatureId: SHADE, count: 1 }]));
    const slowed = patched(open, (c) => void c.party[0]!.statuses.push(status('status_slow')));
    expect(fleeProblem(content, slowed.combat!)).toBe('You are slowed and cannot flee');
    const communing = patched(open, (c) => {
      c.communion = { movement: 1, resolve: 1, questionIndex: 0, answered: [], usedAnswers: [], lies: 0, listened: false, supportUsed: false, clockBonusGranted: false };
    });
    expect(fleeProblem(content, communing.combat!)).toBe('There is no fleeing from this');
    expect(fleeProblem(content, open.combat!)).toBeNull();
  });

  test('Smoke Bomb: every enemy Blinded, and the next flee succeeds without a roll (chance 100), once', () => {
    const s = fight(state({ abilities: ['rgr_smoke_bomb'] }), spec([{ creatureId: SHADE, count: 2 }]));
    const bombed = act(s, { type: 'ability', abilityId: 'rgr_smoke_bomb' });
    for (const e of bombed.state.combat!.enemies) expect(e.statuses.map((st) => st.statusId)).toEqual(['status_blind']);
    expect(me(bombed.state).pattern.firedOnce).toEqual([FLEE_AUTO_TAG, 'used:rgr_smoke_bomb', 'last_ability:rgr_smoke_bomb']); // + U26b's used-this-fight tag, U34e's last ability
    expect(fleeChanceIn(content, bombed.state.combat!)).toBe(100);
    const out = act(patched(bombed.state, (c) => void (c.intents = {})), FLEE); // no draw
    expect(ofType(out.events, 'fleeAttempt')).toEqual([{ t: 'fleeAttempt', success: true, chance: 100 }]);
    const c = clone(s.combat!);
    grantFleeAuto(playerOf(c));
    grantFleeAuto(playerOf(c));
    expect(playerOf(c).pattern.firedOnce).toEqual([FLEE_AUTO_TAG]);
  });

  test('Veilwalk: Phase on player and companion, Mark and Taunt removed from both, and the sure flee', () => {
    const s0 = state({
      classId: 'elf',
      abilities: ['elf_veilwalk'],
      patch: (st) => {
        st.companions.recruited.ilyra = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} };
        st.companions.activeId = 'ilyra';
      },
    });
    const ctx = scriptedCtx(s0, [D.d4(4), D.d4(3), D.d4(1)], content, profile);
    beginCombat(ctx, spec([{ creatureId: SHADE, count: 1 }]));
    runCombat(ctx);
    const s = patched(ctx.s, (c) => {
      c.intents = {};
      c.party[0]!.statuses.push(status('status_mark'));
      c.party[1]!.statuses.push(status('status_mark'));
    });
    const out = act(s, { type: 'ability', abilityId: 'elf_veilwalk' }, MISS); // Ilyra's own dart misses
    const party = out.state.combat!.party;
    expect(ofType(out.events, 'statusApplied').map((e) => [e.targetUid, e.statusId])).toEqual(party.map((p) => [p.uid, 'status_phase']));
    // the Elf's Phase (cast on her own turn) skips that turn's countdown; Ilyra's runs out at the end of her turn (D-066 #4)
    expect(party.map((p) => p.statuses.map((st) => st.statusId))).toEqual([['status_phase'], []]);
    expect(fleeChanceIn(content, out.state.combat!)).toBe(100);
  });
});

describe('Guard (DESIGN §4.7): 50 % after flat reduction, Warden 65 % with Iron Guard; +5 resource, Warden +8', () => {
  test("the Ranger's Guard halves the Strike (11 → 6) and gives +5 Focus; the Warden's gives +8 Grit (and +6 for the hit)", () => {
    const ranger = fight(state({ mp: 10 }), spec([{ creatureId: BRUTE, count: 1 }]), true);
    const r = act(ranger, { type: 'guard' }, [D.pct(0), D.variance(1), D.pct(99)]);
    expect(ofType(r.events, 'damageDealt').map((e) => e.amount)).toEqual([6]); // 11 × 0.5 = 5.5 → 6
    expect(ofType(r.events, 'resourceGained').map((e) => [e.reason, e.amount])).toEqual([['guard', 5]]);
    const warden = fight(state({ classId: 'ironclad_warden', mp: 10 }), spec([{ creatureId: BRUTE, count: 1 }]), true);
    const w = act(warden, { type: 'guard' }, [D.pct(0), D.variance(1), D.pct(99)]);
    expect(ofType(w.events, 'resourceGained').map((e) => [e.reason, e.amount])).toEqual([['guard', 8], ['hit_taken', 6]]);
    expect(ofType(w.events, 'damageDealt').map((e) => e.amount)).toEqual([6]);
  });
});
