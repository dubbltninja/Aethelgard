// U23: the combat reducer (DESIGN §4.1, §4.7–4.8, §5.7, §6.2; PLAN §4.10–4.11, §8.1): arrival encounters and
// `startCombat`, the turn loop, `attack` (every weapon type) and `guard`, class resources, victory (XP, gold, loot,
// effects, bookkeeping) and defeat (Loop 1 FALLEN vs The Fall), companions, legality — and DESIGN §4.12's worked
// example reproduced number-for-number with scripted rolls.
import { describe, expect, test } from 'bun:test';
import type { Ability } from '@schema/ability';
import type { LocationInput } from '@schema/location';
import {
  APEX_FACE_IT,
  APEX_NOT_YET,
  BASIC_ATTACKS,
  FLAG_TYRANT_DEAD,
  WANDERING_ENCOUNTER_ID,
  applyHit,
  applyStatus,
  applyStatusRows,
  attackEnumerator,
  critChanceOf,
  hitChanceOf,
  basicAttackOf,
  beginCombat,
  combatXpAllowed,
  companionAttackSpec,
  creatureXp,
  currentActor,
  damageRange,
  endOfTurnStatuses,
  findStatus,
  finishPlayerTurn,
  guardEnumerator,
  legalActions,
  moveSpec,
  playerOf,
  resolveHit,
  resolveTick,
  runCombat,
  step,
  weaponTypeOf,
  type Action,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type HitSpec,
  type LocationState,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { round } from '@engine/util/math';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';
import { BRUTE, D, MISTWOOD, SHADE, combatPack, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';

const content = combatPack();
const profile = freshProfile();
const RUINS = 'loc_whispering_ruins';
const LIBRARY = 'loc_shattered_library';
const PLAZA = 'loc_silverwood_plaza';
const NEXUS = 'loc_chronos_nexus';
const APEX = 'loc_temporal_breach_apex';
const TYRANT = 'cr_chronos_tyrant_unveiled';

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });
const emptyLs = (over: Partial<LocationState> = {}): LocationState => ({
  visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
  unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {}, ...over,
});
const state = (o: StateOverrides = {}): GameState => makeState(o, { content });
const spec = (groups: EncounterSpec['groups'], over: Partial<EncounterSpec> = {}): EncounterSpec => ({
  id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [], ...over,
});

/** A landed hit with variance `v` and no crit. */
const HIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(99)];
const MISS = [D.pct(99)];
/** A lone Shade's victory rolls: gold 9 (7–12), then Shadow Ash (80 %): the first spellbook drops without a draw. */
const SHADE_SPOILS = [D.int(9, 7, 12), D.yes];

/** A fight at the player's first turn: setup + the turn loop over scripted draws (d4s first, then any enemy turns). */
function fight(s: GameState, sp: EncounterSpec, draws: readonly number[], prof = profile): GameState {
  const ctx = scriptedCtx(s, draws, content, prof);
  beginCombat(ctx, sp);
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  return ctx.s;
}
/** The player first (d4 4), every enemy last (d4 1). */
const playerFirst = (enemies: number): number[] => [D.d4(4), ...Array.from({ length: enemies }, () => D.d4(1))];
function patched(s: GameState, edit: (c: CombatState, s: GameState) => void): GameState {
  const out = clone(s);
  edit(out.combat as CombatState, out);
  return out;
}
const enemy = (s: GameState, i = 0): Combatant => (s.combat as CombatState).enemies[i] as Combatant;
const me = (s: GameState): Combatant => playerOf(s.combat as CombatState);
function act(s: GameState, action: Action, draws: readonly number[], prof = profile) {
  const out = scriptedStep(s, action, draws, content, prof);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}

// ---- arrival encounters ---------------------------------------------------------------------------------------------

describe('arrival encounters (ARRIVAL_HOOKS)', () => {
  test("a fixed group on the loop's first visit: the fight starts and plays to the player's turn", () => {
    const out = play(state(), [{ type: 'move', to: LIBRARY }], { content });
    const s = out.state;
    expect(s.mode).toBe('combat');
    expect(s.combat).toMatchObject({ encounterId: 'enc_library_shades', locationId: LIBRARY, phase: 'playerTurn' });
    expect(s.combat?.enemies.map((e) => e.name)).toEqual(['Corrupted Shade A', 'Corrupted Shade B']);
    expect(currentActor(s.combat!)?.kind).toBe('player');
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([]);
    expect(legalActions(s, content, profile).map((a) => a.type)).toEqual(['attack', 'attack', 'guard']);
  });

  test('no roll on Retreat or Not yet (DESIGN §4.7)', () => {
    const back = play(state({ locationId: PLAZA, patch: (st) => void (st.world.previousLocationId = LIBRARY) }), [{ type: 'retreat' }], { content });
    expect(back.state.mode).toBe('explore');
    expect(back.state.world.currentLocationId).toBe(LIBRARY);
    const apexOpen = { q_echo_crystal: { status: 'completed' as const, stage: 'crystal_found' } };
    const notYet = play(state({ locationId: NEXUS, quests: apexOpen }), [{ type: 'move', to: APEX }, { type: 'choose', choiceId: APEX_NOT_YET }], { content });
    expect(notYet.state.world.currentLocationId).toBe(NEXUS);
    expect(notYet.state.mode).toBe('explore'); // the Nexus Aberration does not roll
    const faceIt = play(state({ locationId: NEXUS, quests: apexOpen }), [{ type: 'move', to: APEX }, { type: 'choose', choiceId: APEX_FACE_IT }], { content });
    expect(faceIt.state.mode).toBe('explore'); // the fixture's Tyrant is Loop 2+ (`when`)
  });

  test('D-067.1: in Loop 1 the Apex prompt comes first; *Face it* starts the boss fight', () => {
    const pack = combatPack(({ locations }) => {
      const apex = locations.find((l) => l.id === APEX)!;
      apex.encounters = apex.encounters!.map(({ when: _when, ...enc }) => enc); // the fixture's Tyrant, fought in Loop 1 here
    });
    const apexOpen = { q_echo_crystal: { status: 'completed' as const, stage: 'crystal_found' } };
    const prompt = play(makeState({ locationId: NEXUS, quests: apexOpen }, { content: pack }), [{ type: 'move', to: APEX }], { content: pack });
    expect(prompt.state.mode).toBe('dialogue');
    expect(prompt.state.combat).toBeNull();
    const faced = play(prompt.state, [{ type: 'choose', choiceId: APEX_FACE_IT }], { content: pack });
    expect(faced.state.mode).toBe('combat');
    expect(faced.state.combat).toMatchObject({ encounterId: 'enc_apex_tyrant', canFlee: false });
  });

  test('cleared or scattered groups and failing `when` start nothing; Loop 2 meets the Unveiled Tyrant at the Apex', () => {
    expect(play(state({ patch: (st) => void (st.world.locationStates[LIBRARY] = emptyLs({ visited: false, visitCount: 0, itemsSpawned: false, encountersCleared: ['enc_library_shades'] })) }), [{ type: 'move', to: LIBRARY }], { content }).state.mode).toBe('explore');
    expect(play(state({ patch: (st) => void (st.world.locationStates[LIBRARY] = emptyLs({ visited: false, visitCount: 0, itemsSpawned: false, scattered: ['enc_library_shades'] })) }), [{ type: 'move', to: LIBRARY }], { content }).state.mode).toBe('explore');
    const loop2 = play(state({ loop: 2, locationId: NEXUS, echoes: ['echo_apex_resonance'] }), [{ type: 'move', to: APEX }], { content, profile: freshProfile({ loopCounter: 2 }) });
    expect(loop2.state.mode).toBe('combat');
    expect(loop2.state.combat).toMatchObject({ encounterId: 'enc_apex_tyrant', canFlee: false, onFlee: 'hold' });
  });

  const withMistwood = (encounters: NonNullable<LocationInput['encounters']>, safe = true) =>
    combatPack(({ locations }) => {
      const loc = locations.find((l) => l.id === MISTWOOD)!;
      loc.encounters = encounters;
      loc.safe = safe;
      loc.events = [{ id: 'ev_ambush', text: 'Ferns part.', when: { flag: 'flag_ambush' }, effects: [{ startCombat: 'enc_brute_ambush' }] }];
    });
  const visited = (o: StateOverrides = {}) => state({ ...o, patch: (st) => void (st.world.locationStates[MISTWOOD] = emptyLs()) });
  const go = (pack: ReturnType<typeof combatPack>, s: GameState, draws: number[]) => {
    const out = scriptedStep(s, { type: 'move', to: MISTWOOD }, draws, pack, profile);
    expect(out.rejected).toBeNull();
    expect(out.left).toBe(0);
    return out.state;
  };

  test("`first:` groups under 100 % roll on the loop's first visit only (WORLD §3)", () => {
    const pack = withMistwood([{ id: 'enc_mist_first', groups: [{ creatureId: BRUTE }], chance: 0.5 }]);
    expect(go(pack, state(), [D.yes, D.d4(4), D.d4(1)]).combat?.encounterId).toBe('enc_mist_first');
    expect(go(pack, state(), [D.no]).mode).toBe('explore');
    expect(go(pack, visited(), []).mode).toBe('explore'); // a return visit: no roll at all
  });

  test("`respawn: 'on_return'` rolls on later visits; 'daily' comes back the next day; `optionalWhen` lets the party pass", () => {
    const onReturn = withMistwood([{ id: 'enc_mist_return', groups: [{ creatureId: BRUTE }], respawn: 'on_return', once: false }]);
    expect(go(onReturn, state(), []).mode).toBe('explore');
    expect(go(onReturn, visited(), [D.d4(4), D.d4(1)]).combat?.encounterId).toBe('enc_mist_return');
    const daily = withMistwood([{ id: 'enc_mist_daily', groups: [{ creatureId: BRUTE }], respawn: 'daily' }]);
    const clearedToday = state({ day: 2, patch: (st) => void (st.world.locationStates[MISTWOOD] = emptyLs({ encounterClearedDay: { enc_mist_daily: 2 }, encountersCleared: ['enc_mist_daily'] })) });
    expect(go(daily, clearedToday, []).mode).toBe('explore');
    const tomorrow = clone(clearedToday);
    tomorrow.clock.ticks += 4;
    expect(go(daily, tomorrow, [D.d4(4), D.d4(1)]).combat?.encounterId).toBe('enc_mist_daily');
    const bypass = withMistwood([{ id: 'enc_mist_gate', groups: [{ creatureId: BRUTE }], optionalWhen: { flag: 'flag_golem_shortcut' } }]);
    expect(go(bypass, state({ flags: { flag_golem_shortcut: true } }), []).mode).toBe('explore');
    expect(go(bypass, state(), [D.d4(4), D.d4(1)]).mode).toBe('combat');
  });

  test('the wandering pool on a return visit: 1 (70 %) or 2 (30 %) by weight; never on a first visit or a safe node', () => {
    const pack = combatPack();
    const pair = go(pack, visited(), [D.yes, 0.25, 0.25, D.d4(4), D.d4(1), D.d4(1)]);
    expect(pair.combat).toMatchObject({ encounterId: WANDERING_ENCOUNTER_ID, onFlee: 'previous', canFlee: true });
    expect(pair.combat?.enemies.map((e) => e.name)).toEqual(['Wildling Brute A', 'Wildling Brute B']);
    const single = go(pack, visited(), [D.no, 0.75, D.d4(4), D.d4(1)]);
    expect(single.combat?.enemies.map((e) => e.refId)).toEqual([SHADE]);
    expect(go(pack, state(), []).mode).toBe('explore');
    expect(go(withMistwood([]), visited(), []).mode).toBe('explore');
  });

  test('a group a `spawn` effect placed here fights first, and is gone once beaten', () => {
    const s = state({
      patch: (st) => void (st.world.pendingEncounters[MISTWOOD] = [{ id: 'spawn_9', groups: [{ creatureId: SHADE, count: 1 }], once: true, onFlee: 'scatter', label: 'It found you.' }]),
    });
    const fought = go(combatPack(), s, [D.d4(4), D.d4(1)]);
    expect(fought.combat?.encounterId).toBe('spawn_9');
    const won = act(patched(fought, (c) => void (c.enemies[0]!.hp = 1)), { type: 'attack', targetUid: enemy(fought).uid }, [...HIT(), ...SHADE_SPOILS]);
    expect(won.state.mode).toBe('explore');
    expect(won.state.world.pendingEncounters[MISTWOOD]).toBeUndefined();
  });

  test('`startCombat` from a location event (effects path): the post-step hook plays the fight to the player', () => {
    const pack = withMistwood([]);
    const s = go(pack, state({ flags: { flag_ambush: true } }), [D.d4(4), D.d4(1)]);
    expect(s.combat).toMatchObject({ encounterId: 'enc_brute_ambush', phase: 'playerTurn' });
    expect(s.combat?.log[0]?.text).toBe('Something heavy breaks through the ferns.');
  });
});

// ---- the turn loop ------------------------------------------------------------------------------------------------------

describe('the turn loop (DESIGN §4.1)', () => {
  test('faster enemies act before the player\'s first turn (inside the step that started the fight)', () => {
    const ctx = scriptedCtx(state(), [D.d4(1), D.d4(4), ...HIT(1)], content, profile);
    beginCombat(ctx, spec([{ creatureId: 'cr_temporal_aberration', count: 1 }]));
    runCombat(ctx);
    expect(ctx.rng.queue).toEqual([]);
    const s = ctx.s;
    // Aberration AGI 8 + 4 = 12 beats the Ranger's 8 + 1: Flicker Strike (Chrono 1.3·ATK = 29.9) hits for 30
    expect(ofType(ctx.events, 'turnStarted').map((e) => [e.uid === me(s).uid ? 'player' : 'enemy', e.round])).toEqual([['enemy', 1], ['player', 1]]);
    expect(ofType(ctx.events, 'damageDealt')[0]).toMatchObject({ amount: 30, damageType: 'chrono', kind: 'intent', refId: 'aberration_flicker_strike' });
    expect(me(s).hp).toBe(90);
    expect(s.player.hp).toBe(120); // the snapshot is synced back when the fight ends
    expect(s.counters.damageTaken).toBe(30);
    expect(s.combat?.phase).toBe('playerTurn');
  });

  test('every living combatant acts, then the round counter goes up and the order is re-sorted', () => {
    const s = fight(state(), spec([{ creatureId: SHADE, count: 1 }]), playerFirst(1));
    expect(s.combat).toMatchObject({ round: 1, turnIndex: 0, phase: 'playerTurn' });
    const out = act(s, { type: 'attack', targetUid: enemy(s).uid }, [...MISS, ...MISS]);
    expect(out.state.combat).toMatchObject({ round: 2, turnIndex: 0, phase: 'playerTurn' });
    expect(ofType(out.events, 'turnStarted').map((e) => e.round)).toEqual([1, 2]);
    expect(ofType(out.events, 'attackResolved').map((e) => e.hit)).toEqual([false, false]);
    expect(out.state.combat?.log.map((l) => l.text)).toEqual([`${s.player.name} misses Corrupted Shade.`, `Corrupted Shade misses ${s.player.name}.`]);
  });

  test('Guard: halves the next blows until the guarder\'s next turn begins; class resource (+5 universal)', () => {
    const s = patched(fight(state(), spec([{ creatureId: SHADE, count: 1 }]), playerFirst(1)), (c) => void (c.party[0]!.mp = 10));
    const out = act(s, { type: 'guard' }, HIT(1));
    expect(ofType(out.events, 'guarded')).toEqual([{ t: 'guarded', uid: me(s).uid }]);
    expect(ofType(out.events, 'resourceGained')).toEqual([{ t: 'resourceGained', uid: me(s).uid, amount: 5, reason: 'guard' }]);
    expect(ofType(out.events, 'damageDealt')[0]?.amount).toBe(4); // Rake 7 × 0.5 = 3.5 → 4
    expect(me(out.state).guarding).toBe(false); // dropped when the player's turn began again
    expect(me(out.state).mp).toBe(15);
  });

  test('ability cooldowns count down at the end of their owner\'s turn', () => {
    const s = patched(fight(state(), spec([{ creatureId: SHADE, count: 1 }]), playerFirst(1)), (c) => {
      c.cooldowns = { rgr_snare_trap: 2, rgr_smoke_bomb: 1 };
      c.enemies[0]!.cooldowns = { shade_wail: 1 };
    });
    const out = act(s, { type: 'guard' }, MISS);
    expect(out.state.combat?.cooldowns).toEqual({ rgr_snare_trap: 1 });
    expect(enemy(out.state).cooldowns).toEqual({});
  });

  test('an enemy with no damaging move or no target holds still; a fight that cannot settle is a loud error', () => {
    const s = fight(state(), spec([{ creatureId: SHADE, count: 1 }]), playerFirst(1));
    const odd = patched(s, (c) => void (c.enemies[0]!.refId = 'cr_unknown'));
    expect(act(odd, { type: 'guard' }, []).state.combat?.log.at(-1)?.text).toBe('Corrupted Shade holds still.');
    const ctx = scriptedCtx(patched(s, (c) => void (c.party[0]!.fledOrGone = true)), [], content, profile);
    expect(() => runCombat(ctx)).toThrow('the turn loop did not settle');
  });

  test('rejections: not the player\'s turn, an unknown or fallen target', () => {
    const s = fight(state(), spec([{ creatureId: SHADE, count: 2 }]), playerFirst(2));
    expect(scriptedStep(s, { type: 'attack', targetUid: 'c999' }, [], content, profile).rejected).toBe("there is no enemy 'c999' to attack");
    const down = patched(s, (c) => void (c.enemies[0]!.alive = false));
    expect(scriptedStep(down, { type: 'attack', targetUid: enemy(s).uid }, [], content, profile).rejected).toMatch(/no enemy/);
    const waiting = patched(s, (c) => void (c.phase = 'start'));
    expect(scriptedStep(waiting, { type: 'guard' }, [], content, profile).rejected).toBe('it is not your turn');
    expect(legalActions(waiting, content, profile)).toEqual([]);
  });
});

// ---- basic attacks and resources ------------------------------------------------------------------------------------------

describe('basic attacks by weapon type (DESIGN §5.7)', () => {
  const shadeFight = (o: StateOverrides, mp?: number) => {
    const s = fight(state(o), spec([{ creatureId: SHADE, count: 1 }]), playerFirst(1));
    return mp === undefined ? s : patched(s, (c) => void (c.party[0]!.mp = mp));
  };
  const swing = (s: GameState, draws: number[]) => act(s, { type: 'attack', targetUid: enemy(s).uid }, [...draws, ...MISS]);
  const gains = (events: GameEvent[]) => ofType(events, 'resourceGained').map((e) => [e.reason, e.amount]);

  test('the table: melee, bow, staff, heavy, focus', () => {
    expect(BASIC_ATTACKS.melee.spec).toMatchObject({ type: 'physical', base: 0, coef: 1, stat: 'atk' });
    expect(BASIC_ATTACKS.ranged_bow.spec).toMatchObject({ type: 'physical', coef: 0.9, accuracy: 5, critBonus: 5 });
    expect(BASIC_ATTACKS.magic_staff).toMatchObject({ spec: { type: 'ley', base: 4, coef: 0.8, stat: 'sp', spell: true }, mpOnHit: 3 });
    expect(BASIC_ATTACKS.shield_heavy).toMatchObject({ spec: { coef: 1.1, accuracy: -5 }, gritOnHit: 5, stunChance: 0.1 });
    expect(BASIC_ATTACKS.void_focus).toMatchObject({ spec: { type: 'void', base: 3, coef: 0.7, spell: true }, hpCost: 2, mpOnHit: 4 });
  });

  test('melee (Ranger, Rusty Dagger): 1.0·ATK; Focus +8 on a hit, +12 on a crit', () => {
    const s = shadeFight({}, 20);
    expect(weaponTypeOf(s, content)).toBe('melee');
    const hit = swing(s, HIT());
    expect(ofType(hit.events, 'damageDealt')[0]).toMatchObject({ amount: 13, damageType: 'physical', kind: 'basic', refId: null }); // 14 − armor 1
    expect(gains(hit.events)).toEqual([['basic_hit', 8]]);
    expect(hit.state.counters.damageBySource).toEqual({ basic: 13 });
    const crit = swing(s, [D.pct(0), D.variance(1), D.pct(8)]);
    expect(ofType(crit.events, 'damageDealt')[0]?.amount).toBe(20); // 21 − 1
    expect(gains(crit.events)).toEqual([['basic_crit', 12]]);
    expect(swing(s, MISS).state.combat?.party[0]?.mp).toBe(20);
  });

  test('bare hands fight as melee with ATK = STR', () => {
    const s = shadeFight({ patch: (st) => void (st.player.equipment.weapon = null) });
    expect(basicAttackOf(s, content).weaponType).toBe('melee');
    expect(ofType(swing(s, HIT()).events, 'damageDealt')[0]?.amount).toBe(9);
  });

  test('bow (Elf): 0.9·ATK, +5 accuracy, +5 crit; the Elf gains +6 on a crit and +10 when a blow misses her', () => {
    const s = shadeFight({ classId: 'elf' }, 0);
    const bow = basicAttackOf(s, content).spec;
    expect(hitChanceOf(content, me(s), enemy(s), bow)).toBe(93); // 85 + 5 + 5 − 2
    expect(critChanceOf(content, me(s), bow)).toBe(15); // 5 + 5 + 5
    const crit = act(s, { type: 'attack', targetUid: enemy(s).uid }, [D.pct(92), D.variance(1), D.pct(14), ...MISS]);
    expect(ofType(crit.events, 'damageDealt')[0]?.amount).toBe(14); // 9.9 × 1.5 − 1 = 13.85
    expect(gains(crit.events)).toEqual([['crit', 6], ['dodge', 10]]);
    const miss = act(s, { type: 'attack', targetUid: enemy(s).uid }, [D.pct(93), ...MISS]);
    expect(ofType(miss.events, 'damageDealt')).toEqual([]);
  });

  test('staff (Wizard): Ley 4 + 0.8·SP with spell accuracy, +3 MP on a hit; Wizard regen 3 + ⌊L/4⌋ at each turn start', () => {
    const s = shadeFight({ classId: 'wizard', level: 4 }, 10);
    const out = swing(s, HIT());
    expect(ofType(out.events, 'damageDealt')[0]).toMatchObject({ amount: 18, damageType: 'ley' }); // 13.6 × 1.5 weak − ward 2
    expect(gains(out.events)).toEqual([['weapon:magic_staff', 3], ['turn_start', 4]]);
    expect(me(out.state).mp).toBe(17);
  });

  test('heavy (Warden, Nomad\'s Maul): 1.1·ATK at −5 accuracy, +5 Grit on a hit; Grit +6 when hit, +8 on Guard', () => {
    const s = shadeFight({ classId: 'ironclad_warden' }, 0);
    expect(basicAttackOf(s, content)).toMatchObject({ weaponType: 'shield_heavy', gritOnHit: 5 });
    const out = act(s, { type: 'attack', targetUid: enemy(s).uid }, [D.pct(80), D.variance(1), D.pct(99), D.pct(10), ...HIT()]); // stun roll 10: no (U24)
    expect(ofType(out.events, 'damageDealt').map((e) => e.amount)).toEqual([18, 7]); // 18.7 − 1; Rake 7
    expect(gains(out.events)).toEqual([['weapon:shield_heavy', 5], ['hit_taken', 6]]);
    expect(scriptedStep(s, { type: 'attack', targetUid: enemy(s).uid }, [D.pct(81), ...MISS], content, profile).events.filter((e) => e.t === 'damageDealt')).toEqual([]);
    expect(gains(act(s, { type: 'guard' }, MISS).events)).toEqual([['guard', 8]]);
    // another class with the maul gains no Grit from it
    expect(basicAttackOf(state({ items: [{ itemId: 'item_nomads_maul', equip: true }] }), content).gritOnHit).toBe(0);
  });

  test('focus (Shadow Weaver): Void 3 + 0.7·SP at spell accuracy, costs 2 HP, +4 MP on a hit; never with HP ≤ 2', () => {
    const s = shadeFight({ classId: 'shadow_weaver' }, 0);
    const out = swing(s, HIT());
    expect(ofType(out.events, 'damageDealt')[0]).toMatchObject({ amount: 4, damageType: 'void' }); // 11.4 × 0.5 resist − 2
    expect(me(out.state).hp).toBe(100);
    expect(gains(out.events)).toEqual([['weapon:void_focus', 4]]);
    const thin = patched(s, (c) => void (c.party[0]!.hp = 2));
    expect(attackEnumerator(thin, content, profile, {})).toEqual([]);
    expect(guardEnumerator(thin, content, profile, {})).toEqual([{ type: 'guard' }]);
    expect(scriptedStep(thin, { type: 'attack', targetUid: enemy(s).uid }, [], content, profile).rejected).toBe('Not enough blood');
  });

  test('resources are capped at max MP (the event reports what landed)', () => {
    const s = shadeFight({}, 46);
    expect(gains(swing(s, HIT()).events)).toEqual([['basic_hit', 2]]);
  });
});

// ---- victory and defeat ---------------------------------------------------------------------------------------------------

describe('victory (DESIGN §4.1, §6.2)', () => {
  const lastShade = (o: StateOverrides = {}, sp = spec([{ creatureId: SHADE, count: 1 }])) => patched(fight(state(o), sp, playerFirst(1)), (c) => void (c.enemies[0]!.hp = 1));
  const finish = (s: GameState, draws = SHADE_SPOILS, prof = profile) => act(s, { type: 'attack', targetUid: enemy(s).uid }, [...HIT(), ...draws], prof);

  test('XP, gold and loot; creature and encounter effects; back to explore with the snapshot synced; autosave', () => {
    const s = lastShade(
      { locationId: LIBRARY, hp: 60, patch: (st) => void (st.player.statuses = [status('status_poison', { duration: 3, tick: 2 })]) },
      spec([{ creatureId: SHADE, count: 1 }], { id: 'enc_library_shades', onVictory: [{ setFlag: 'flag_won' }] }),
    );
    const out = finish(patched(s, (c) => void (c.party[0]!.mp = 30)));
    const st = out.state;
    expect(st.mode).toBe('explore');
    expect(st.combat).toBeNull();
    expect(st.player).toMatchObject({ hp: 58, mp: 38, xp: 41, gold: 39 }); // the carried Poison ticked 2 at the turn's start (U24)
    expect(st.player.statuses.map((x) => x.statusId)).toEqual(['status_poison']);
    expect(st.player.inventory.filter((i) => ['item_dark_spellbook', 'mat_shadow_ash'].includes(i.itemId)).map((i) => i.itemId)).toEqual(['item_dark_spellbook', 'mat_shadow_ash']);
    expect(st.flags).toMatchObject({ flag_spellbook_dropped: true, flag_won: true });
    expect(st.world.locationStates[LIBRARY]?.encountersCleared).toEqual(['enc_library_shades']);
    expect(st.counters).toMatchObject({ fights: 1, fightsWon: 1, kills: { [SHADE]: 1 }, goldEarned: 9, damageDealt: 13 }); // the hit's amount (overkill counts)
    const ended = ofType(out.events, 'combatEnded')[0];
    expect(ended).toMatchObject({ result: 'victory', rounds: 1, xp: 41, gold: 9 });
    expect(ended?.loot.map((i) => [i.itemId, i.qty])).toEqual([['item_dark_spellbook', 1], ['mat_shadow_ash', 1]]);
    const t = out.events.map((e) => e.t);
    expect(t.slice(t.indexOf('combatantDefeated'))).toEqual([
      'combatantDefeated', 'resourceGained', 'modeChanged', 'itemGiven', 'itemGiven', 'goldChanged', 'xpGained', 'combatEnded', 'autosaveCheckpoint',
    ]);
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([{ t: 'autosaveCheckpoint', reason: 'combatEnded' }]);
    // the cleared group does not come back on the next visit
    expect(play(st, [{ type: 'move', to: RUINS }, { type: 'move', to: LIBRARY }], { content }).state.mode).toBe('explore');
  });

  test('D-055 by data: the first Shade of the loop drops the Dark Spellbook, later ones 50 % (two in one fight)', () => {
    const s = patched(fight(state({ locationId: LIBRARY }), spec([{ creatureId: SHADE, count: 2 }]), playerFirst(2)), (c) => c.enemies.forEach((e) => void (e.hp = 1)));
    const first = act(s, { type: 'attack', targetUid: enemy(s, 0).uid }, [...HIT(), ...MISS]);
    const books = (draw: number) => {
      const out = act(first.state, { type: 'attack', targetUid: enemy(s, 1).uid }, [...HIT(), D.int(9, 7, 12), D.no, D.int(10, 7, 12), draw, D.no]);
      return out.state.player.inventory.find((i) => i.itemId === 'item_dark_spellbook')?.qty;
    };
    expect(books(D.yes)).toBe(2);
    expect(books(D.no)).toBe(1);
  });

  test('a level-up from kill XP refills HP and MP (DESIGN §6.3)', () => {
    const out = finish(lastShade({ hp: 30, patch: (st) => void (st.player.xp = 90) }));
    expect(out.state.player).toMatchObject({ level: 2, xp: 31, hp: 128, hpMax: 128 });
    expect(ofType(out.events, 'levelUp')).toHaveLength(1);
  });

  test("kill XP: the loop nudge (×1.03 in Loop 2), Pacifist's Vow zeroes it", () => {
    expect(creatureXp(state({ loop: 2 }), content, SHADE)).toBe(round(41 * 1.03));
    expect(creatureXp(state(), content, 'cr_nobody')).toBe(0);
    const vow = state({ patch: (st) => void (st.meta.modifiers = ['mod_pacifist']) });
    expect(combatXpAllowed(vow, content)).toBe(false);
    const out = finish(lastShade({ patch: (st) => void (st.meta.modifiers = ['mod_pacifist']) }));
    expect(out.state.player.xp).toBe(0);
    expect(ofType(out.events, 'xpGained')).toEqual([]);
  });

  test('no autosave at the Loop 1 Apex or during a Horde (D-067.1)', () => {
    expect(ofType(finish(lastShade({ locationId: APEX })).events, 'autosaveCheckpoint')).toEqual([]);
    expect(ofType(finish(lastShade({ patch: (st) => void ((st.world.hordeActive = true), (st.world.hordeCause = 'tyrant')) })).events, 'autosaveCheckpoint')).toEqual([]);
  });

  test('a Tyrant that dies sets flag_tyrant_dead (PLAN §4.11, D-069.6)', () => {
    const s = patched(fight(state({ loop: 2, locationId: APEX }), spec([{ creatureId: TYRANT, count: 1 }]), playerFirst(1), freshProfile({ loopCounter: 2 })), (c) => void (c.enemies[0]!.hp = 1));
    const out = act(s, { type: 'attack', targetUid: enemy(s).uid }, HIT(), freshProfile({ loopCounter: 2 })); // no gold roll (0–0), loot certain
    expect(out.state.flags[FLAG_TYRANT_DEAD]).toBe(true);
    expect(out.state.player.inventory.find((i) => i.itemId === 'mat_frayed_moment')?.qty).toBe(3);
  });
});

describe('defeat (DESIGN §4.7, D-049, D-066 #7)', () => {
  const dying = (o: StateOverrides, sp = spec([{ creatureId: SHADE, count: 1 }], { onDefeat: [{ setFlag: 'flag_fell' }] }), prof = profile) =>
    patched(fight(state(o), sp, playerFirst(1), prof), (c) => void (c.party[0]!.hp = 1));
  const die = (s: GameState, prof = profile) => act(s, { type: 'guard' }, HIT(), prof);

  test('Loop 1: FALLEN — the fight stays on screen in phase defeat, nothing is legal, the shell takes over', () => {
    const out = die(dying({}));
    const s = out.state;
    expect(s.mode).toBe('combat');
    expect(s.combat?.phase).toBe('defeat');
    expect(s.player.hp).toBe(0);
    expect(s.counters.deathsThisLoop).toBe(1);
    expect(s.flags.flag_fell).toBe(true);
    expect(ofType(out.events, 'playerDied')).toEqual([{ t: 'playerDied', loop: 1 }]);
    expect(ofType(out.events, 'combatEnded')).toEqual([{ t: 'combatEnded', result: 'defeat', rounds: 1, xp: 0, gold: 0, loot: [] }]);
    expect(legalActions(s, content, profile)).toEqual([]);
    expect(scriptedStep(s, { type: 'guard' }, [], content, profile).rejected).toBe('you have fallen');
  });

  test('Loop 2+: The Fall — closer_fall (death); in an expiry Horde, reason expiry (any loop)', () => {
    const loop2 = freshProfile({ loopCounter: 2 });
    const fall = die(dying({ loop: 2 }, undefined, loop2), loop2).state;
    expect(fall.mode).toBe('ending');
    expect(fall.combat).toBeNull();
    expect(fall.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'death', slideIndex: 0 });
    const expiry = die(dying({ patch: (st) => void ((st.world.hordeActive = true), (st.world.hordeCause = 'expiry')) })).state;
    expect(expiry.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'expiry', slideIndex: 0 });
    const tyrantHorde = die(dying({ patch: (st) => void ((st.world.hordeActive = true), (st.world.hordeCause = 'tyrant')) })).state;
    expect(tyrantHorde.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'death', slideIndex: 0 });
  });
});

// ---- companions -------------------------------------------------------------------------------------------------------------

describe('companions in the fight (placeholders until U28)', () => {
  const ILYRA = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {} };
  const withIlyra = () => fight(state({ patch: (st) => void ((st.companions.recruited.ilyra = { ...ILYRA }), (st.companions.activeId = 'ilyra')) }), spec([{ creatureId: SHADE, count: 1 }]), [D.d4(4), D.d4(4), D.d4(1)]);

  test('the companion strikes the leftmost enemy with its attack ability on its own turn', () => {
    expect(companionAttackSpec(content, 'ilyra')).toEqual({ source: 'comp_ilyra_ley_dart', type: 'ley', base: 0, coef: 1, stat: 'sp' });
    expect(companionAttackSpec(content, 'nobody')).toEqual({ source: 'basic', type: 'physical', base: 0, coef: 1, stat: 'atk' });
    const s = withIlyra();
    const out = act(s, { type: 'guard' }, [...HIT(), ...MISS]);
    expect(ofType(out.events, 'damageDealt')[0]).toMatchObject({ amount: 13, damageType: 'ley', kind: 'ability', refId: 'comp_ilyra_ley_dart' }); // 10 × 1.5 − 2
    expect(out.state.counters.damageBySource).toEqual({ 'companion:ilyra': 13 });
  });

  test('a knocked-out companion leaves the fight without ending it, and stays KO afterwards', () => {
    const s = withIlyra();
    const ctx = scriptedCtx(s, HIT(), content, profile);
    const combat = ctx.s.combat as CombatState;
    const ilyra = combat.party[1]!;
    ilyra.hp = 3;
    const rake = moveSpec('shade_rake', content.creatures[SHADE]!.moves.shade_rake!)!;
    applyHit(ctx, combat, combat.enemies[0]!, ilyra, rake, resolveHit(ctx, combat.enemies[0]!, ilyra, rake), 'intent');
    expect(ilyra.alive).toBe(false);
    expect(ofType(ctx.events, 'companionKo')).toEqual([{ t: 'companionKo', companionId: 'ilyra' }]);
    expect(ctx.s.combat).not.toBeNull();
    const won = act(patched(ctx.s, (c) => void (c.enemies[0]!.hp = 1)), { type: 'attack', targetUid: enemy(s).uid }, [...HIT(), ...SHADE_SPOILS]);
    expect(won.state.companions.recruited.ilyra).toMatchObject({ hp: 0, ko: true });
    expect(moveSpec('shade_fade', content.creatures[SHADE]!.moves.shade_fade!)).toBeNull();
  });
});

// ---- legality ---------------------------------------------------------------------------------------------------------------

describe('legalActions ⇔ step in combat', () => {
  test('every listed action is accepted; outside the player\'s turn and outside combat nothing is listed', () => {
    const s = play(state(), [{ type: 'move', to: LIBRARY }], { content }).state;
    const listed = legalActions(s, content, profile).filter((a) => a.type === 'attack' || a.type === 'guard');
    expect(listed).toHaveLength(3);
    for (const a of listed) expect(step(s, a, content, profile).events.find((e) => e.t === 'actionRejected')).toBeUndefined();
    expect(attackEnumerator(state(), content, profile, {})).toEqual([]);
    expect(guardEnumerator(state(), content, profile, {})).toEqual([]);
  });
});

// ---- DESIGN §4.12 -----------------------------------------------------------------------------------------------------------

describe('DESIGN §4.12 worked example — Ranger L4 vs Wildling Brute + Corrupted Shade', () => {
  /** Ranger L4: STR 12, MAG 6, AGI 9; Traveler's Sword (Uncommon, power 6) and Wildling Hide Armor; 148 HP, 57 MP. */
  const ranger = (): GameState =>
    state({
      level: 4,
      items: [{ itemId: 'item_travelers_sword', rarity: 'uncommon', equip: true }, { itemId: 'item_wildling_hide_armor', equip: true }],
      patch: (st) => {
        Object.assign(st.player, { stats: { strength: 12, magic: 6, agility: 9 }, statPoints: 0, hpMax: 148, hp: 148, mpMax: 57, mp: 57 });
        st.world.locationStates[MISTWOOD] = emptyLs(); // a return visit: the legacy wandering pool rolls
      },
    });
  /**
   * Mistwood Path, a return encounter: pool roll (100 % in the fixture), a pair (30 %: yes), Brute then Shade by weight,
   * then the d4s Ranger 2, Brute 1, Shade 3 (the example's).
   */
  const opening = (): { s: GameState; events: GameEvent[] } => {
    const out = act(ranger(), { type: 'move', to: MISTWOOD }, [D.yes, 0.25, 0.75, D.d4(2), D.d4(1), D.d4(3)]);
    return { s: out.state, events: out.events };
  };
  const pick = (s: GameState) => ({ c: s.combat as CombatState, ranger: me(s), brute: enemy(s, 0), shade: enemy(s, 1) });
  const read = (s: GameState) => ({ s, content });
  const moveOf = (creature: string, move: string): HitSpec => moveSpec(move, content.creatures[creature]!.moves[move]!)!;
  /** An ability row as a hit (U26 owns ability resolution; the numbers are the pipeline's). */
  const abilityHit = (id: string, target?: Combatant): HitSpec => {
    const a = content.abilities[id] as Ability;
    const p = a.power!;
    const hit: HitSpec = { source: id, type: a.damageType!, base: p.base, coef: p.coef, stat: p.stat, ignoresArmor: p.ignoresArmor };
    const mults = a.bonuses.filter((b) => 'targetHas' in b.when && target?.statuses.some((st) => st.statusId === (b.when as { targetHas: string }).targetHas)).map((b) => ({ name: id, mult: b.mult }));
    return mults.length > 0 ? { ...hit, mults } : hit;
  };
  const hitWith = (s: GameState, draws: number[], attacker: Combatant, target: Combatant, sp: HitSpec) => {
    const ctx = scriptedCtx(s, draws, content, profile);
    const r = resolveHit(ctx, attacker, target, sp);
    expect(ctx.rng.queue).toEqual([]);
    return r;
  };
  const W = (c: Combatant, edit: Partial<Combatant>): Combatant => ({ ...clone(c), ...edit });

  test('setup: the snapshot, initiative 11 / 8 / 4, order Ranger → Shade → Brute every round, opening chips 4–6 and 8–10', () => {
    const { s, events } = opening();
    const { c, ranger, brute, shade } = pick(s);
    expect(ranger).toMatchObject({ hp: 148, hpMax: 148, mp: 57, mpMax: 57, atk: 18, armor: 2, ward: 1, accuracy: 89, evasion: 4, crit: 9, critMult: 1.5, initiative: 11 });
    expect(brute).toMatchObject({ name: 'Wildling Brute', level: 4, hp: 64, atk: 11, armor: 3, ward: 0, accuracy: 86, evasion: 1, crit: 6, initiative: 4 });
    expect(shade).toMatchObject({ name: 'Corrupted Shade', level: 2, hp: 36, atk: 7, sp: 7, armor: 1, ward: 2, accuracy: 87, evasion: 2, initiative: 8 });
    expect(c.turnOrder).toEqual([ranger.uid, shade.uid, brute.uid]);
    expect(c).toMatchObject({ encounterId: WANDERING_ENCOUNTER_ID, onFlee: 'previous', round: 1, phase: 'playerTurn' });
    expect(ofType(events, 'combatStarted')[0]?.enemies.map((e) => e.creatureId)).toEqual([BRUTE, SHADE]);
    // opening intents (generation is U25; the numbers are the pipeline's): Shade Rake → Ranger 4–6, Brute Strike → 8–10
    expect(damageRange(read(s), shade, ranger, moveOf(SHADE, 'shade_rake'))).toEqual([4, 6]);
    expect(damageRange(read(s), brute, ranger, moveOf(BRUTE, 'brute_strike'))).toEqual([8, 10]);
  });

  test('round 1: Rake misses (90 vs 83); Strike hits (37 vs 82) 11 × 1.07 − 2 = 9.77 → 10; next chip Wail 5–6', () => {
    const { s } = opening();
    const { ranger, brute, shade } = pick(s);
    const rake = hitWith(s, [D.pct(90)], shade, ranger, moveOf(SHADE, 'shade_rake'));
    expect(rake).toMatchObject({ hit: false, hitChance: 83 });
    const strike = hitWith(s, [D.pct(37), D.variance(1.07), D.pct(80)], brute, ranger, moveOf(BRUTE, 'brute_strike'));
    expect(strike).toMatchObject({ hit: true, crit: false, hitChance: 82, critChance: 6, amount: 10 });
    expect(strike.steps.find((x) => x.name === 'variance')?.value).toBeCloseTo(11.77);
    expect(strike.steps.find((x) => x.name === 'flat')?.value).toBeCloseTo(9.77);
    expect(damageRange(read(s), shade, ranger, moveOf(SHADE, 'shade_wail'))).toEqual([5, 6]);
  });

  test('round 2: Marked Shot 1.1 × 18 × 1.03 − 1 = 19.39 → 19 (Shade 36 → 17); Wail 6.3 × 1.02 − 1 → 5; Strike 10.78 − 2 → 9; next Maul 14–17', () => {
    const { s } = opening();
    const { ranger, brute, shade } = pick(s);
    const marked = hitWith(s, [D.pct(50), D.variance(1.03), D.pct(50)], ranger, shade, abilityHit('rgr_marked_shot'));
    expect(marked).toMatchObject({ hitChance: 87, crit: false, amount: 19 });
    expect(marked.steps.find((x) => x.name === 'variance')?.value).toBeCloseTo(20.394);
    const hurt = W(ranger, { hp: 138 });
    const wail = hitWith(s, [D.pct(50), D.variance(1.02), D.pct(50)], shade, hurt, moveOf(SHADE, 'shade_wail'));
    expect(wail).toMatchObject({ hitChance: 93, amount: 5 });
    const strike = hitWith(s, [D.pct(10), D.variance(0.98), D.pct(50)], brute, hurt, moveOf(BRUTE, 'brute_strike'));
    expect(strike.amount).toBe(9);
    expect([148 - 10, 138 - 5, 133 - 9]).toEqual([138, 133, 124]);
    expect(damageRange(read(s), brute, ranger, moveOf(BRUTE, 'brute_maul'))).toEqual([14, 17]);
  });

  test('round 3: Guard (+5 Focus → 48; preview "7–9"); Maul on the Guard: 17.6 × 1.05 − 2 = 16.48 × 0.5 = 8.24 → 8', () => {
    const { s } = opening();
    const r3 = patched(s, (c) => {
      c.round = 3;
      Object.assign(c.party[0]!, { hp: 124, mp: 43, statuses: [status('status_weaken', { duration: 1 })] });
      Object.assign(c.enemies[1]!, { hp: 17, statuses: [status('status_mark', { duration: 2 })] });
    });
    expect(damageRange(read(r3), enemy(r3, 0), me(r3), moveOf(BRUTE, 'brute_maul'), { guard: true })).toEqual([7, 9]);
    // the enemies' round-3 moves are Fade and Maul (U25); the placeholders here both miss
    const out = act(r3, { type: 'guard' }, [D.pct(99), D.pct(99)]);
    expect(ofType(out.events, 'resourceGained')).toEqual([{ t: 'resourceGained', uid: me(r3).uid, amount: 5, reason: 'guard' }]);
    expect(me(out.state).mp).toBe(48);
    const maul = hitWith(r3, [D.pct(20), D.variance(1.05), D.pct(50)], enemy(r3, 0), W(me(r3), { guarding: true }), moveOf(BRUTE, 'brute_maul'));
    expect(maul.amount).toBe(8);
    expect(maul.steps.find((x) => x.name === 'flat')?.value).toBeCloseTo(16.48);
    expect(maul.steps.find((x) => x.name === 'guard')?.value).toBeCloseTo(8.24);
  });

  test('round 4: Rend while Weakened 18 × 0.98 × 0.75 − 3 = 10.23 → 10 (Brute 64 → 54); Bleed tick 5, Poison tick 4; Rake 7 × 0.90 − 2 → 4; Strike misses (88 vs 82)', () => {
    const { s } = opening();
    const { ranger, brute, shade } = pick(s);
    const weak = W(ranger, { hp: 116, statuses: [status('status_weaken', { duration: 1 })] });
    const rend = hitWith(s, [D.pct(60), D.variance(0.98), D.pct(50)], weak, brute, abilityHit('rgr_rend'));
    expect(rend).toMatchObject({ hitChance: 88, amount: 10 });
    expect(rend.steps.find((x) => x.name === 'status')?.value).toBeCloseTo(13.23);
    // ticks are computed at application from the source's ATK (DESIGN §4.5; applying them is U24)
    const bleed = content.statuses.status_bleed!.tick!.damage!;
    const poison = content.statuses.status_poison!.tick!.damage!;
    expect(round(bleed.base + bleed.coef * ranger.atk)).toBe(5);
    expect(round(poison.base + poison.coef * ranger.atk)).toBe(4);
    expect(resolveTick(brute, 5, bleed.type).amount + resolveTick(brute, 4).amount).toBe(9);
    expect(hitWith(s, [D.pct(50), D.variance(0.9), D.pct(50)], shade, weak, moveOf(SHADE, 'shade_rake')).amount).toBe(4);
    expect(hitWith(s, [D.pct(88)], brute, weak, moveOf(BRUTE, 'brute_strike'))).toMatchObject({ hit: false, hitChance: 82 });
  });

  test('round 5 through the reducer: the sword crits the Marked Shade (07 < 9) 18 × 1.02 × 1.5 × 1.15 − 1 = 30.67 → 31, Focus +12 → 52; Strike 11 × 0.91 − 2 → 8 (112 → 104)', () => {
    const { s } = opening();
    const r5 = patched(s, (c) => {
      c.round = 5;
      Object.assign(c.party[0]!, { hp: 112, mp: 40 });
      Object.assign(c.enemies[0]!, { hp: 45 });
      Object.assign(c.enemies[1]!, { hp: 17, statuses: [status('status_mark', { duration: 1 })] });
    });
    // Marked: cannot miss, so no hit roll; then variance 1.02, crit 07; the Brute: hit 10, variance 0.91, no crit
    const out = act(r5, { type: 'attack', targetUid: enemy(r5, 1).uid }, [D.variance(1.02), D.pct(7), D.pct(10), D.variance(0.91), D.pct(50)]);
    const dealt = ofType(out.events, 'damageDealt');
    expect(dealt.map((e) => [e.amount, e.kind])).toEqual([[31, 'basic'], [8, 'intent']]);
    expect(ofType(out.events, 'attackResolved')[0]).toMatchObject({ hit: true, crit: true });
    expect(ofType(out.events, 'combatantDefeated').map((e) => e.refId)).toEqual([SHADE]);
    expect(ofType(out.events, 'resourceGained')).toEqual([{ t: 'resourceGained', uid: me(r5).uid, amount: 12, reason: 'basic_crit' }]);
    expect(me(out.state)).toMatchObject({ hp: 104, mp: 52 });
    expect(enemy(out.state, 1)).toMatchObject({ hp: 0, alive: false, statuses: [] });
    expect(out.state.combat?.intents[enemy(r5, 1).uid]).toBeUndefined();
    expect(out.state.combat).toMatchObject({ round: 6, phase: 'playerTurn' });
  });

  test('round 6: Piercing Arrow 1.5 × 18 × 1.04, ignoring armor → 28 (Brute 36 → 8)', () => {
    const { s } = opening();
    const { ranger, brute } = pick(s);
    const arrow = hitWith(s, [D.pct(30), D.variance(1.04), D.pct(50)], ranger, W(brute, { hp: 36 }), abilityHit('rgr_piercing_arrow', brute));
    expect(arrow.amount).toBe(28);
    expect(arrow.steps.find((x) => x.name === 'flat')?.value).toBeCloseTo(28.08);
  });

  test('outcome: XP 71 + 41 = 112; gold 14 + 9 = 23; loot Tonic (60 % yes), Hide Armor (25 % no), Wildling Hide (80 % yes), Dark Spellbook (first Shade: 100 %), Shadow Ash (80 % yes)', () => {
    const { s } = opening();
    // the Shade fell in round 5; the Brute (8 HP) bleeds out in the example (U24) — here the sword finishes it
    const end = patched(s, (c) => {
      c.round = 6;
      Object.assign(c.party[0]!, { hp: 104, mp: 40 });
      Object.assign(c.enemies[0]!, { hp: 8 });
      Object.assign(c.enemies[1]!, { hp: 0, alive: false });
    });
    const out = act(end, { type: 'attack', targetUid: enemy(end, 0).uid }, [
      ...HIT(),
      D.int(14, 11, 18), D.yes, D.no, D.yes, // Brute: gold 14; Tonic yes, Hide Armor no, Wildling Hide yes
      D.int(9, 7, 12), D.yes, // Shade: gold 9; the first Shade's spellbook without a draw; Shadow Ash yes
    ]);
    const ended = ofType(out.events, 'combatEnded')[0]!;
    expect(ended).toMatchObject({ result: 'victory', xp: 112, gold: 23, rounds: 6 });
    expect(ended.loot.map((i) => i.itemId).sort()).toEqual(['item_dark_spellbook', 'item_ley_touched_tonic', 'mat_shadow_ash', 'mat_wildling_hide']);
    expect(out.state.player).toMatchObject({ xp: 112, level: 4, hp: 104, hpMax: 148 });
    expect(out.state.flags.flag_spellbook_dropped).toBe(true);
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([{ t: 'autosaveCheckpoint', reason: 'combatEnded' }]);
  });

  // ---- the status parts (U24), through the status rules and the turn loop ----

  /** The Ranger's ability turn (ability resolution is U26): its MP, the pipeline hit, its status rows, `extra`, then the turn loop. */
  const abilityTurn = (s: GameState, id: string, targetIndex: number, draws: number[], extra: (ctx: ReturnType<typeof scriptedCtx>, c: CombatState) => void = () => {}) => {
    const ctx = scriptedCtx(s, draws, content, profile);
    const c = ctx.s.combat as CombatState;
    const ranger = playerOf(c);
    const target = c.enemies[targetIndex]!;
    ranger.mp -= (content.abilities[id] as Ability).mp;
    const sp = abilityHit(id, target);
    const r = resolveHit(ctx, ranger, target, sp);
    applyHit(ctx, c, ranger, target, sp, r, 'ability');
    if (r.hit) applyStatusRows(ctx, c, ranger, target, (content.abilities[id] as Ability).statuses);
    extra(ctx, c);
    finishPlayerTurn(ctx, c, ranger);
    expect(ctx.rng.queue).toEqual([]);
    return { state: ctx.s, events: ctx.events };
  };
  /**
   * The start of round 4 by the status rules: the Shade's round-3 Fade puts Phase (1) on it during its own turn, whose
   * countdown skips it (D-066 #4); Wail's Weaken (round 2) and Marked Shot's Mark (round 2) have one turn left.
   */
  const round4 = (): GameState => {
    const { s } = opening();
    const ctx = scriptedCtx(patched(s, (c) => Object.assign(c, { round: 3, phase: 'enemyTurn', turnIndex: 1 })), [], content, profile);
    const c = ctx.s.combat as CombatState;
    const shade = c.enemies[1]!;
    expect(applyStatusRows(ctx, c, shade, null, content.creatures[SHADE]!.moves.shade_fade!.statuses).map((r) => r.outcome)).toEqual(['applied']);
    expect(findStatus(shade, 'status_phase')).toMatchObject({ duration: 1, appliedOnOwnTurn: true });
    endOfTurnStatuses(ctx, c, shade);
    expect(findStatus(shade, 'status_phase')).toMatchObject({ duration: 1, appliedOnOwnTurn: false });
    expect(ofType(ctx.events, 'statusExpired')).toEqual([]);
    return patched(ctx.s, (cc) => {
      Object.assign(cc, { round: 4, phase: 'playerTurn', turnIndex: 0 });
      Object.assign(cc.party[0]!, { hp: 116, mp: 48, statuses: [status('status_weaken', { duration: 1, sourceUid: cc.enemies[1]!.uid })] });
      cc.enemies[1]!.hp = 17;
      cc.enemies[1]!.statuses.push(status('status_mark', { duration: 1, sourceUid: cc.party[0]!.uid }));
    });
  };
  /** Round 4: Rend → the Brute (Weakened: 10) with Venom Coat's Poison; the Shade's Rake 4; the Brute ticks 9 and misses. */
  const playRound4 = () =>
    abilityTurn(round4(), 'rgr_rend', 0, [D.pct(60), D.variance(0.98), D.pct(50), D.pct(50), D.variance(0.9), D.pct(50), D.pct(88)], (ctx, c) =>
      void applyStatus(ctx, c, playerOf(c), c.enemies[0]!, 'status_poison', { duration: 4 }),
    );

  test('U24: Venom Coat → Poison on the Shade prints "Immune" (breach-born); Wail\'s Weaken (32 < 50) lasts 2 turns, expiring at the end of the Ranger\'s round-4 turn', () => {
    const { s } = opening();
    const ctx = scriptedCtx(s, [], content, profile);
    const c = ctx.s.combat as CombatState;
    const [ranger, shade] = [playerOf(c), c.enemies[1]!];
    // round 2, Marked Shot: Venom Coat tries Poison
    expect(applyStatus(ctx, c, ranger, shade, 'status_poison', { duration: 4 }).outcome).toBe('immune');
    expect(c.log.at(-1)?.text).toBe('Corrupted Shade: Immune to Poison.');
    expect(ofType(ctx.events, 'statusApplied')).toEqual([]);
    // the Shade's round-2 Wail: one roll after the hit's draws; 32 < 50 Weakens, a 50 would not
    Object.assign(c, { round: 2, phase: 'enemyTurn', turnIndex: 1 });
    const wail = content.creatures[SHADE]!.moves.shade_wail!.statuses;
    ctx.rng.queue.push(D.pct(50), D.pct(32));
    expect(applyStatusRows(ctx, c, shade, ranger, wail).map((r) => r.outcome)).toEqual(['failed']);
    expect(applyStatusRows(ctx, c, shade, ranger, wail).map((r) => r.outcome)).toEqual(['applied']);
    expect(findStatus(ranger, 'status_weaken')).toEqual({ statusId: 'status_weaken', stacks: 1, duration: 2, sourceUid: shade.uid, appliedOnOwnTurn: false });
    // rounds 3 and 4 through the turn loop (the Ranger guards; the placeholder enemies miss)
    const r3 = patched(ctx.s, (cc) => Object.assign(cc, { round: 3, phase: 'playerTurn', turnIndex: 0 }));
    const after3 = act(r3, { type: 'guard' }, [...MISS, ...MISS]);
    expect(findStatus(me(after3.state), 'status_weaken')?.duration).toBe(1);
    const after4 = act(after3.state, { type: 'guard' }, [...MISS, ...MISS]);
    const ev = after4.events;
    expect(ofType(ev, 'statusExpired')).toEqual([{ t: 'statusExpired', targetUid: ranger.uid, statusId: 'status_weaken' }]);
    expect(ev.findIndex((e) => e.t === 'statusExpired')).toBeLessThan(ev.findIndex((e) => e.t === 'turnStarted' && e.uid === shade.uid));
    expect(after4.state.combat?.round).toBe(5);
  });

  test("U24: the Shade's Phase (Fade, round 3) skips that turn's countdown, survives the Ranger's round-4 turn and expires at the end of the Shade's round-4 turn", () => {
    const s4 = round4();
    const shadeUid = enemy(s4, 1).uid;
    const { events } = playRound4();
    const at = (pred: (e: GameEvent) => boolean) => events.findIndex(pred);
    const shadeTurn = at((e) => e.t === 'turnStarted' && e.uid === shadeUid);
    const shadeRake = at((e) => e.t === 'attackResolved' && e.sourceUid === shadeUid);
    const phaseGone = at((e) => e.t === 'statusExpired' && e.targetUid === shadeUid && e.statusId === 'status_phase');
    const bruteTurn = at((e) => e.t === 'turnStarted' && e.uid === enemy(s4, 0).uid);
    expect(shadeTurn).toBeGreaterThan(0); // the Ranger's Rend went to the Brute: the Phase was there, unused
    expect([shadeTurn < shadeRake, shadeRake < phaseGone, phaseGone < bruteTurn]).toEqual([true, true, true]);
    // §4.5's turns-of-the-afflicted rule also ends Marked Shot's Mark (3, round 2) here; DESIGN's round 5 still reads
    // "Marked" (a DESIGN inconsistency reported by U24) — the round-5 blow below rolls to hit and deals 27, not 31.
    expect(ofType(events, 'statusExpired').filter((e) => e.targetUid === shadeUid).map((e) => e.statusId)).toEqual(['status_phase', 'status_mark']);
  });

  test('U24: Brute start-of-turn ticks Bleed 5 + Poison 4 = 9 in rounds 4, 5 and 6 (54 → 45 → 36; 8 → dies before acting in round 6)', () => {
    const r4 = playRound4();
    const bruteUid = enemy(r4.state, 0).uid;
    const ticks = (ev: GameEvent[]) => ofType(ev, 'statusTicked').filter((e) => e.targetUid === bruteUid).map((e) => [e.statusId, e.amount]);
    expect(findStatus(enemy(r4.state, 0), 'status_bleed')).toMatchObject({ tick: 5, stacks: 1, duration: 2 }); // round(1 + 0.2·18), 3 turns
    expect(findStatus(enemy(r4.state, 0), 'status_poison')).toMatchObject({ tick: 4, duration: 3 }); // round(1 + 0.15·18), 4 turns
    expect(ticks(r4.events)).toEqual([['status_bleed', 5], ['status_poison', 4]]);
    expect(ofType(r4.events, 'damageDealt').map((e) => e.amount)).toEqual([10, 4]); // Rend 10.23; Rake 4.3
    expect(ofType(r4.events, 'attackResolved').at(-1)).toMatchObject({ sourceUid: bruteUid, hit: false }); // 88 vs 82
    expect([enemy(r4.state, 0).hp, me(r4.state).hp, me(r4.state).mp]).toEqual([45, 112, 40]);
    // round 5: the sword on the Shade (no longer Marked: hit roll 50; crit 07 < 9): 18 × 1.02 × 1.5 − 1 = 26.54 → 27 ≥ 17
    const r5 = act(r4.state, { type: 'attack', targetUid: enemy(r4.state, 1).uid }, [D.pct(50), D.variance(1.02), D.pct(7), D.pct(10), D.variance(0.91), D.pct(50)]);
    expect(ofType(r5.events, 'damageDealt').map((e) => e.amount)).toEqual([27, 8]);
    expect(ticks(r5.events)).toEqual([['status_bleed', 5], ['status_poison', 4]]);
    expect([enemy(r5.state, 0).hp, enemy(r5.state, 1).alive, me(r5.state).hp, me(r5.state).mp]).toEqual([36, false, 104, 52]);
    // round 6: Piercing Arrow 28 (36 → 8); the Brute's third Bleed tick and its Poison: 9 ≥ 8 — it never swings
    const r6 = abilityTurn(r5.state, 'rgr_piercing_arrow', 0, [
      D.pct(30), D.variance(1.04), D.pct(50),
      D.int(14, 11, 18), D.yes, D.no, D.yes, // Brute: gold 14; Tonic yes, Hide Armor no, Wildling Hide yes
      D.int(9, 7, 12), D.yes, // Shade: gold 9; spellbook without a draw; Shadow Ash yes
    ]);
    expect(ticks(r6.events)).toEqual([['status_bleed', 5], ['status_poison', 4]]);
    expect(ofType(r6.events, 'attackResolved').map((e) => e.sourceUid)).toEqual([me(r5.state).uid]);
    expect(ofType(r6.events, 'combatantDefeated').map((e) => e.uid)).toEqual([bruteUid]);
    expect(r6.state.mode).toBe('explore');
    expect(r6.state.player).toMatchObject({ hp: 104, hpMax: 148, mp: 40, mpMax: 57, xp: 112 });
    expect(ofType(r6.events, 'combatEnded')[0]).toMatchObject({ result: 'victory', rounds: 6, xp: 112, gold: 23 });
    expect(r6.state.counters.damageBySource).toMatchObject({ 'status:status_bleed': 15, 'status:status_poison': 12 });
  });

  test('U24: "The Brute bleeds out before it can swing" — in the fight log, and the fight goes on while the Shade stands', () => {
    const s = patched(playRound4().state, (c) => void (c.enemies[0]!.hp = 8));
    const out = act(s, { type: 'guard' }, MISS); // round 5: the Shade's Rake misses; the Brute's ticks (9 ≥ 8) kill it before it acts
    expect(out.state.combat).toMatchObject({ round: 6, phase: 'playerTurn' });
    expect(enemy(out.state, 0)).toMatchObject({ alive: false, hp: 0 });
    expect(out.state.combat?.log.map((l) => l.text)).toContain('Wildling Brute bleeds out before it can act.');
  });

  // Pending on later units, with the exact values DESIGN §4.12 prints:
  test.todo('U25: intents Wail → Ranger 5–6 "may Weaken" (r1), Fade "shrouds itself" on hp 47 % < 70 % (r2), Maul 14–17 (r2), Strike 8–10 (r3), Rake 4–6 (r3, r4), Maul 14–17 (r5)');
  test.todo('U26: ability costs Venom Coat 6 → 51, Marked Shot 8 → 43, Rend 8 → 40, Piercing Arrow 12 → 40 (final 104/148 HP, 40/57 MP)');
  test.todo('U27: bestiary — Corrupted Shade kills 1 (resistances now shown), Wildling Brute kills 1');
});
