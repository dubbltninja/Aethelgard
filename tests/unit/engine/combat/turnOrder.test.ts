// U23: combat setup and turn order (DESIGN §4.1 Setup/Round, §3.2 initiative, §4.8 slots, §6.6 nudge, §9.5 Rested;
// PLAN §8.1 "turn order"): the snapshot, initiative AGI + d4 rolled once in a fixed order, the per-round re-sort with
// ties player → companion → slot, and the encounter lookups behind arrival fights and `startCombat`.
import { describe, expect, test } from 'bun:test';
import {
  COMBAT_LOG_CAP,
  INITIATIVE_DIE,
  allCombatants,
  beginCombat,
  combatLog,
  combatantByUid,
  currentActor,
  effectiveInitiative,
  encounterSpec,
  findEncounter,
  isActive,
  loopNudge,
  playerOf,
  sortTurnOrder,
  spawnedSpec,
  startEncounterById,
  startRound,
  type CombatState,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type StatusInstance,
} from '@engine/index';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';
import { BRUTE, D, MISTWOOD, SHADE, combatPack, scriptedCtx } from '@tests/fixtures/combatContent';

const content = combatPack();
const LIBRARY = 'loc_shattered_library';
const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });

const spec = (groups: EncounterSpec['groups'], over: Partial<EncounterSpec> = {}): EncounterSpec => ({
  id: 'enc_test',
  groups,
  fleeable: true,
  onFlee: 'scatter',
  ambush: false,
  onVictory: [],
  onDefeat: [],
  onFleeEffects: [],
  ...over,
});
const state = (o: StateOverrides = {}): GameState => makeState(o, { content });
const ILYRA = {
  id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {},
};

/** beginCombat over scripted d4s; returns the ctx (state, events, unused draws). */
function begin(s: GameState, sp: EncounterSpec, draws: readonly number[]) {
  const ctx = scriptedCtx(s, draws, content, freshProfile({ loopCounter: s.meta.loop }));
  const combat = beginCombat(ctx, sp);
  return { ctx, combat };
}

describe('beginCombat: the snapshot (DESIGN §4.1 Setup, §3.2)', () => {
  test('player, companion and enemies; Rested baked in and consumed; carried DoTs move onto the Combatant', () => {
    const s = state({
      level: 4,
      patch: (st) => {
        st.player.statuses = [status('status_rested', { duration: 1 }), status('status_poison', { duration: 4, tick: 2 })];
        st.companions.recruited.ilyra = { ...ILYRA };
        st.companions.activeId = 'ilyra';
      },
    });
    const { ctx, combat } = begin(s, spec([{ creatureId: SHADE, count: 2 }], { intro: 'A growl.' }), [D.d4(2), D.d4(4), D.d4(3), D.d4(1)]);
    expect(ctx.rng.queue).toEqual([]);
    const [player, ilyra] = combat.party;
    // Ranger L4: STR 10 + Rusty Dagger 4; AGI 8 → accuracy 85 + 4 + 5 (Rested), crit 9, initiative 8 + 2 (Rested) + d4 2
    expect(player).toMatchObject({ kind: 'player', refId: 'ranger', level: 4, hp: 144, hpMax: 144, mp: 57, mpMax: 57, atk: 14, sp: 6, agi: 8, accuracy: 94, evasion: 4, crit: 9, critMult: 1.5, initiative: 12 });
    expect(player?.statuses.map((st) => st.statusId)).toEqual(['status_poison']);
    expect(ctx.s.player.statuses).toEqual([]);
    // Ilyra at the player's level 4 (DESIGN §12.3): HP 80 + 6·3 (her full 80 moves up with it), ATK 6 + 0.5·3, SP 10 + 3,
    // armor/ward +1, AGI 7 fixed
    expect(ilyra).toMatchObject({ kind: 'companion', refId: 'ilyra', level: 4, hp: 98, hpMax: 98, mp: 0, atk: 7.5, sp: 13, armor: 2, ward: 4, agi: 7, accuracy: 88, evasion: 3, crit: 8, initiative: 11 });
    // Corrupted Shade: accuracy 85 + 2, evasion 2, crit 5 + 2, initiative AGI 5 + d4
    expect(combat.enemies.map((e) => [e.name, e.hp, e.atk, e.accuracy, e.evasion, e.crit, e.initiative])).toEqual([
      ['Corrupted Shade A', 36, 7, 87, 2, 7, 8],
      ['Corrupted Shade B', 36, 7, 87, 2, 7, 6],
    ]);
    expect(combat.enemies[0]?.resistances).toEqual({ ley: 'weak', fire: 'weak', void: 'resist' });
    expect(combat).toMatchObject({ encounterId: 'enc_test', locationId: 'loc_whispering_ruins', round: 1, turnIndex: 0, phase: 'start', canFlee: true, onFlee: 'scatter', communion: null });
    expect(combat.turnOrder).toEqual([player?.uid, ilyra?.uid, combat.enemies[0]?.uid, combat.enemies[1]?.uid]);
    expect(ctx.s.combat).toBe(combat);
    expect(ctx.s.mode).toBe('combat');
    expect(ctx.s.counters.fights).toBe(1);
    expect(ctx.s.counters.seen).toEqual({ [SHADE]: 2 });
    expect(ctx.events.map((e) => e.t)).toEqual(['statusExpired', 'modeChanged', 'combatStarted', 'log']);
    expect(ofType(ctx.events, 'combatStarted')[0]).toEqual({
      t: 'combatStarted',
      encounterId: 'enc_test',
      enemies: combat.enemies.map((e) => ({ uid: e.uid, creatureId: SHADE })),
      ambush: false,
    });
    expect(combat.log).toEqual([{ round: 1, text: 'A growl.', kind: 'system' }]);
  });

  test('a KO\'d, dead or absent companion stays out; ambush is passed on', () => {
    const ko = state({ patch: (st) => void ((st.companions.recruited.ilyra = { ...ILYRA, ko: true }), (st.companions.activeId = 'ilyra')) });
    const { ctx, combat } = begin(ko, spec([{ creatureId: SHADE, count: 1 }], { ambush: true }), [D.d4(1), D.d4(1)]);
    expect(combat.party).toHaveLength(1);
    expect(ofType(ctx.events, 'combatStarted')[0]?.ambush).toBe(true);
  });

  test('loop variety nudge (DESIGN §6.6): HP and ATK/SP × (1 + 0.03·min(loop − 1, 5))', () => {
    expect(loopNudge(state(), content)).toBe(1);
    expect(loopNudge(state({ loop: 2 }), content)).toBeCloseTo(1.03);
    expect(loopNudge(state({ loop: 9 }), content)).toBeCloseTo(1.15);
    const { combat } = begin(state({ loop: 2 }), spec([{ creatureId: SHADE, count: 1 }]), [D.d4(1), D.d4(1)]);
    expect(combat.enemies[0]).toMatchObject({ hp: 37, hpMax: 37 });
    expect(combat.enemies[0]?.atk).toBeCloseTo(7.21);
    expect(combat.enemies[0]?.sp).toBeCloseTo(7.21);
  });

  test('a fled boss keeps its HP until dawn (LocationState.encounterHp); bosses and story gates cannot be fled', () => {
    const held = state({
      patch: (st) => {
        st.world.locationStates.loc_whispering_ruins = {
          visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
          unlockedExits: [], lockedExits: [], scattered: [], encounterHp: { enc_test: { [SHADE]: 20 } },
        };
      },
    });
    expect(begin(held, spec([{ creatureId: SHADE, count: 1 }]), [D.d4(1), D.d4(1)]).combat.enemies[0]?.hp).toBe(20);
    expect(begin(state(), spec([{ creatureId: 'cr_chronos_tyrant_unveiled', count: 1 }]), [D.d4(1), D.d4(1)]).combat.canFlee).toBe(false);
    expect(begin(state(), spec([{ creatureId: SHADE, count: 1 }], { fleeable: false, onFlee: 'hold' }), [D.d4(1), D.d4(1)]).combat).toMatchObject({ canFlee: false, onFlee: 'hold' });
  });

  test('started from a dialogue (a `startCombat` choice), the scene closes', () => {
    const s = state({ mode: 'dialogue', patch: (st) => void (st.dialogue = { sceneId: 'scene_first_meeting_ilyra', nodeId: 'greet', npcId: 'npc_ilyra', visitedNodes: ['greet'], choicesTaken: [], returnMode: 'explore' }) });
    const { ctx } = begin(s, spec([{ creatureId: BRUTE, count: 1 }]), [D.d4(1), D.d4(1)]);
    expect(ctx.s.dialogue).toBeNull();
    expect(ctx.s.mode).toBe('combat');
    expect(ctx.events.slice(0, 2)).toEqual([
      { t: 'dialogueEnded', sceneId: 'scene_first_meeting_ilyra' },
      { t: 'modeChanged', from: 'dialogue', to: 'combat' },
    ]);
  });

  test('programmer errors: 0 or 4+ enemies, an unknown creature, a fight already running', () => {
    expect(() => begin(state(), spec([{ creatureId: SHADE, count: 2 }, { creatureId: BRUTE, count: 2 }]), [])).toThrow('DESIGN §4.8');
    expect(() => begin(state(), spec([]), [])).toThrow('DESIGN §4.8');
    expect(() => begin(state(), spec([{ creatureId: 'cr_nobody', count: 1 }]), [])).toThrow("unknown creature 'cr_nobody'");
    const { ctx } = begin(state(), spec([{ creatureId: SHADE, count: 1 }]), [D.d4(1), D.d4(1)]);
    expect(() => beginCombat(ctx, spec([{ creatureId: SHADE, count: 1 }]))).toThrow('already in progress');
  });
});

describe('initiative and order (DESIGN §4.1, §3.2)', () => {
  test('AGI + d4, drawn once in the order player, companion, enemies by slot', () => {
    expect(INITIATIVE_DIE).toBe(4);
    const { combat, ctx } = begin(state(), spec([{ creatureId: BRUTE, count: 1 }, { creatureId: SHADE, count: 1 }]), [D.d4(4), D.d4(1), D.d4(2)]);
    expect([playerOf(combat).initiative, ...combat.enemies.map((e) => e.initiative)]).toEqual([12, 4, 7]);
    expect(ctx.rng.queue).toEqual([]);
    // later rounds re-sort without re-rolling
    startRound(combat, content);
    expect(ctx.rng.queue).toEqual([]);
    expect(combat.turnOrder.map((uid) => combatantByUid(combat, uid)?.name)).toEqual([ctx.s.player.name, 'Corrupted Shade', 'Wildling Brute']);
  });

  test('ties: player → companion → enemies by slot', () => {
    const s = state({ patch: (st) => void ((st.companions.recruited.ilyra = { ...ILYRA }), (st.companions.activeId = 'ilyra')) });
    // player 8+1, Ilyra 7+2, Shades 5+4, Brute 3+... (lower)
    const { combat } = begin(s, spec([{ creatureId: SHADE, count: 2 }, { creatureId: BRUTE, count: 1 }]), [D.d4(1), D.d4(2), D.d4(4), D.d4(4), D.d4(4)]);
    expect(combat.turnOrder.map((uid) => combatantByUid(combat, uid)?.name)).toEqual([s.player.name, 'Ilyra', 'Corrupted Shade A', 'Corrupted Shade B', 'Wildling Brute']);
  });

  test('re-sorted each round with live statuses (Haste +5, Slow −5); the down and the fled are skipped', () => {
    const { combat } = begin(state(), spec([{ creatureId: SHADE, count: 2 }, { creatureId: BRUTE, count: 1 }]), [D.d4(4), D.d4(1), D.d4(2), D.d4(4)]);
    const [a, b, brute] = combat.enemies;
    expect(combat.turnOrder.map((uid) => combatantByUid(combat, uid)?.refId)).toEqual(['ranger', SHADE, BRUTE, SHADE]);
    b!.statuses.push(status('status_haste'));
    playerOf(combat).statuses.push(status('status_slow'));
    expect(effectiveInitiative(b!, content)).toBe(12);
    expect(effectiveInitiative(playerOf(combat), content)).toBe(7);
    startRound(combat, content);
    expect(combat.turnOrder).toEqual([b!.uid, playerOf(combat).uid, brute!.uid, a!.uid]);
    a!.alive = false;
    brute!.fledOrGone = true;
    startRound(combat, content);
    expect(combat.turnOrder).toEqual([b!.uid, playerOf(combat).uid]);
    expect(isActive(a!)).toBe(false);
    expect(sortTurnOrder(combat, content)).toEqual(combat.turnOrder);
  });

  test('currentActor walks the order; lookups', () => {
    const { combat } = begin(state(), spec([{ creatureId: SHADE, count: 1 }]), [D.d4(4), D.d4(1)]);
    expect(currentActor(combat)?.kind).toBe('player');
    combat.turnIndex = 1;
    expect(currentActor(combat)?.kind).toBe('enemy');
    combat.turnIndex = 2;
    expect(currentActor(combat)).toBeUndefined();
    expect(allCombatants(combat).map((c) => c.kind)).toEqual(['player', 'enemy']);
    expect(combatantByUid(combat, 'nobody')).toBeUndefined();
    const broken = { ...combat, party: combat.enemies } as CombatState;
    expect(() => playerOf(broken)).toThrow('party[0] is not the player');
  });

  test('the fight log is capped', () => {
    const { combat } = begin(state(), spec([{ creatureId: SHADE, count: 1 }]), [D.d4(4), D.d4(1)]);
    for (let i = 0; i < COMBAT_LOG_CAP + 5; i++) combatLog(combat, `line ${i}`);
    expect(combat.log).toHaveLength(COMBAT_LOG_CAP);
    expect(combat.log[0]).toEqual({ round: 1, text: 'line 5', kind: 'info' });
  });
});

describe('encounter lookups (`startCombat`, PLAN §5.19 rule 6)', () => {
  test('the table first, then here, then any location', () => {
    expect(findEncounter(content, 'enc_brute_ambush', LIBRARY)).toMatchObject({ enc: { id: 'enc_brute_ambush' }, locationId: null });
    expect(findEncounter(content, 'enc_library_shades', LIBRARY)).toMatchObject({ locationId: LIBRARY });
    expect(findEncounter(content, 'enc_nexus_aberration', LIBRARY)).toMatchObject({ locationId: 'loc_chronos_nexus' });
    expect(findEncounter(content, 'enc_nowhere', LIBRARY)).toBeUndefined();
  });

  test('encounterSpec / spawnedSpec carry what a fight needs', () => {
    const enc = findEncounter(content, 'enc_library_shades', LIBRARY)!.enc;
    expect(encounterSpec(enc)).toEqual({
      id: 'enc_library_shades', groups: [{ creatureId: SHADE, count: 2 }], fleeable: true, onFlee: 'scatter', ambush: false,
      intro: 'A growl echoes between the stacks.', onVictory: [], onDefeat: [], onFleeEffects: [],
    });
    expect(spawnedSpec({ id: 'spawn_1', groups: [{ creatureId: BRUTE, count: 1 }], once: true, onFlee: 'scatter', label: 'It found you.' })).toMatchObject({ id: 'spawn_1', intro: 'It found you.', fleeable: true });
    expect(spawnedSpec({ id: 'spawn_2', groups: [{ creatureId: BRUTE, count: 1 }], once: true, onFlee: 'hold' }).intro).toBeUndefined();
  });

  test('startEncounterById starts the encounter here; an unknown id is a programmer error', () => {
    const ctx = scriptedCtx(state(), [D.d4(1), D.d4(1)], content, freshProfile());
    startEncounterById(ctx, 'enc_brute_ambush');
    expect(ctx.s.combat?.enemies.map((e) => e.refId)).toEqual([BRUTE]);
    expect(() => startEncounterById(scriptedCtx(state(), [], content, freshProfile()), 'enc_nowhere')).toThrow("unknown encounter 'enc_nowhere'");
  });
});

describe('travelling into a fight', () => {
  test("this step's watches tick the out-of-combat DoTs before the fight takes them over (DESIGN §4.5)", () => {
    const s = state({
      hp: 100,
      patch: (st) => {
        st.player.statuses = [status('status_poison', { duration: 4, tick: 3 })];
        st.world.locationStates[MISTWOOD] = {
          visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
          unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
        };
      },
    });
    const out = play(s, [{ type: 'move', to: MISTWOOD }], { content });
    const types = out.events.map((e) => e.t);
    expect(types.indexOf('statusTicked')).toBeLessThan(types.indexOf('combatStarted'));
    // (the fight's own start-of-turn ticks, U24, come after `combatStarted`)
    expect(ofType(out.events.slice(0, types.indexOf('combatStarted')), 'statusTicked')).toEqual([{ t: 'statusTicked', targetUid: 'player', statusId: 'status_poison', amount: 3 }]);
    const poison = out.state.combat ? playerOf(out.state.combat).statuses : out.state.player.statuses;
    expect(poison.map((st) => [st.statusId, st.duration])).toEqual([['status_poison', 3]]);
  });
});
