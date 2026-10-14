// U27: boss phases (DESIGN §4.10; PLAN §4.10 "Phases", §8.1 row "boss phases"; D-066 #1/#14, D-068.3, D-069.9, D-072):
// the opening phase and `skipWhen`, `enterWhen` OR-lists (hpBelow after a damage event, round counted in rounds at round
// end, the `addsDead` event, communion triggers), adds with `countSolo` and reinforcements, Remember once per phase, the
// pattern swap, phases never going backwards, `bossPhase` once per phase, the phase damage rows, Stagger, `surviveRounds`
// and `leaveCombat` — and the fixture's 3-phase Tyrant fought to the end through the real reducer with a seeded rng.
import { describe, expect, test } from 'bun:test';
import {
  addsDown,
  applyHit,
  beginCombat,
  checkPhases,
  creatureXp,
  damageRange,
  enterPhase,
  executeIntent,
  generateIntent,
  interruptIntent,
  legalActions,
  moveSpec,
  phaseEntered,
  phaseEvent,
  phaseMults,
  phasesOf,
  playerOf,
  runCombat,
  step,
  survivalRounds,
  triggerHolds,
  type Action,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type HitResult,
  type HitSpec,
  type Profile,
  type StepCtx,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { stateHash } from '@engine/util/hash';
import { ABERRATION, BELL, CONTAINED, D, RUNNER, SHADE, TIDE, combatPack, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';

const content = combatPack();
const profile = freshProfile();
const loop2 = freshProfile({ loopCounter: 2 });
const TYRANT = 'cr_chronos_tyrant_unveiled';
const APEX = 'loc_temporal_breach_apex';

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const state = (o: StateOverrides = {}): GameState => makeState(o, { content });
const spec = (creatureId: string, over: Partial<EncounterSpec> = {}): EncounterSpec => ({
  id: 'enc_boss', groups: [{ creatureId, count: 1 }], fleeable: false, onFlee: 'hold', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [], ...over,
});
const ILYRA = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {} };
const withIlyra = (st: GameState): void => {
  st.companions.recruited.ilyra = { ...ILYRA };
  st.companions.activeId = 'ilyra';
};

/** A fight at the player's first turn (beginCombat + the turn loop) over scripted draws, all of them used. */
function open(s: GameState, sp: EncounterSpec, draws: readonly number[], prof: Profile = profile): StepCtx & { rng: { queue: number[] } } {
  const ctx = scriptedCtx(s, draws, content, prof);
  beginCombat(ctx, sp);
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  return ctx;
}
/** A fresh context over the state so far. */
const at = (ctx: StepCtx, draws: readonly number[] = [], prof: Profile = profile) => scriptedCtx(ctx.s, draws, content, prof);
const C = (ctx: { s: GameState }): CombatState => ctx.s.combat as CombatState;
const boss = (ctx: { s: GameState }): Combatant => C(ctx).enemies[0] as Combatant;

/** A blow of exactly `amount` (no draws): DESIGN §4.10 reads the HP after the damage event. */
const blow = (amount: number): HitResult => ({
  hit: true, phased: false, crit: false, immune: false, hitChance: 100, critChance: 0, variance: 1, amount, absorbed: 0, shieldBroken: false, mitigated: 0, steps: [],
});
const SWORD: HitSpec = { source: 'basic', type: 'physical', base: 0, coef: 1, stat: 'atk' };
const strike = (ctx: StepCtx, target: Combatant, amount: number): void => applyHit(ctx, C(ctx), playerOf(C(ctx)), target, SWORD, blow(amount), 'basic');
function act(s: GameState, action: Action, draws: readonly number[], prof: Profile = profile) {
  const out = scriptedStep(s, action, draws, content, prof);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}

/** The Contained Tyrant at the player's first turn (the Ranger acts first: 8 + 4 against 4 + 1). */
const contained = (o: StateOverrides = {}, draws: number[] = [D.d4(4), D.d4(1)]) => open(state(o), spec(CONTAINED), draws);
const FRACTURE_LINE = 'The mass splits along old seams. Things that were people surface and do not sink back.';
const NINE_SPEAK_LINE = 'It stops guarding itself. Every wound you give it is answered by a voice.';

describe('the opening phase (DESIGN §4.10, D-072 skipWhen)', () => {
  test('a boss opens in its first phase: `bossPhase` with the phase name, the pattern from its first step, the entry recorded', () => {
    const ctx = contained();
    const b = boss(ctx);
    expect(b).toMatchObject({ phase: 0, pattern: { pointer: 1, firedOnce: ['phase:0'], phaseEnteredRound: 1 } });
    expect(ofType(ctx.events, 'bossPhase')).toEqual([{ t: 'bossPhase', uid: b.uid, phase: 0, text: 'The Holding' }]);
    expect(C(ctx).intents[b.uid]).toMatchObject({ moveId: 'tyr_brace', tags: ['Shield'] });
    expect(C(ctx).log.find((l) => l.kind === 'phase')?.text).toBe('The Holding');
    expect(phasesOf(content, b).map((p) => p.id)).toEqual(['tyr_movement_1', 'tyr_movement_2', 'tyr_movement_3']);
    expect(phasesOf(content, playerOf(C(ctx)))).toEqual([]);
  });

  test('`skipWhen` opens the fight past a phase ("it does not toll"): a full entry — its line, its adds (1 solo, at 50 %), all in round 1', () => {
    const stable = open(state({ flags: { flag_heartstone_stabilized: true } }), spec(BELL), [D.d4(4), D.d4(1), D.d4(1)]);
    const c = C(stable);
    const [bell, shade] = c.enemies as [Combatant, Combatant];
    expect(bell).toMatchObject({ phase: 1, pattern: { firedOnce: ['phase:1'] } });
    expect(phaseEntered(bell, 0)).toBe(false);
    expect(ofType(stable.events, 'bossPhase')).toEqual([{ t: 'bossPhase', uid: bell.uid, phase: 1, text: 'The water in the well begins to rise.' }]);
    expect(shade).toMatchObject({ refId: SHADE, name: 'Corrupted Shade', isAdd: true, hp: 18, hpMax: 36 });
    expect(c.turnOrder).toEqual([playerOf(c).uid, shade.uid, bell.uid]);
    expect([c.intents[bell.uid]?.moveId, c.intents[shade.uid]?.moveId]).toEqual(['bell_toll', 'shade_rake']);
    // without the flag: the first phase, no adds
    const plain = open(state(), spec(BELL), [D.d4(4), D.d4(1)]);
    expect(C(plain).enemies.map((e) => [e.refId, e.phase])).toEqual([[BELL, 0]]);
    expect(C(plain).intents[boss(plain).uid]?.moveId).toBe('bell_ask');
  });
});

describe('enterWhen (D-066 #14: an OR-list; triggers after every damage event and at round end)', () => {
  test('hpBelow, after the damage event: 304 → 303 (< 66 %) enters The Fracture — its line, 1 Aberration at 40 % solo, the pattern restarts', () => {
    const ctx = at(contained(), [D.d4(1)]);
    const b = boss(ctx);
    b.hp = 304;
    strike(ctx, b, 1);
    expect(ctx.rng.queue).toEqual([]);
    expect(b).toMatchObject({ hp: 303, phase: 1, pattern: { pointer: 1, phaseEnteredRound: 1, firedOnce: ['phase:0', 'phase:1'] } });
    expect(ofType(ctx.events, 'bossPhase')).toEqual([{ t: 'bossPhase', uid: b.uid, phase: 1, text: FRACTURE_LINE }]);
    const add = C(ctx).enemies[1] as Combatant;
    expect(add).toMatchObject({ refId: ABERRATION, name: 'Temporal Aberration', isAdd: true, hp: 112, hpMax: 280, alive: true });
    expect(ofType(ctx.events, 'addsSummoned')).toEqual([{ t: 'addsSummoned', uids: [add.uid] }]);
    expect(C(ctx).intents[b.uid]?.moveId).toBe('tyr_korr_burns'); // the intent is reset onto the new pattern
    expect(C(ctx).intents[add.uid]?.moveId).toBe('aberration_rewind'); // the add's own first intent (it is below 50 %)
    expect(ctx.s.counters.seen[ABERRATION]).toBe(1);
    // phases never go backwards: healed above 66 % and struck again, it stays in The Fracture (no second event)
    b.hp = 460;
    strike(ctx, b, 1);
    expect(b.phase).toBe(1);
    expect(ofType(ctx.events, 'bossPhase')).toHaveLength(1);
  });

  test('countSolo: with an active companion the Fracture brings 2 Aberrations ("… B"); a knocked-out companion counts as solo', () => {
    const duo = at(contained({ patch: withIlyra }, [D.d4(4), D.d4(4), D.d4(1)]), [D.d4(1), D.d4(1)]);
    boss(duo).hp = 300;
    strike(duo, boss(duo), 1);
    expect(C(duo).enemies.slice(1).map((e) => [e.name, e.hp])).toEqual([['Temporal Aberration', 112], ['Temporal Aberration B', 112]]);
    const ko = at(contained({ patch: withIlyra }, [D.d4(4), D.d4(4), D.d4(1)]), [D.d4(1)]);
    C(ko).party[1]!.alive = false;
    boss(ko).hp = 300;
    strike(ko, boss(ko), 1);
    expect(C(ko).enemies).toHaveLength(2);
  });

  test('one blow across two thresholds enters both phases in order (both lines, the Fracture\'s add), landing in The Nine Speak', () => {
    const ctx = at(contained(), [D.d4(1)]);
    const b = boss(ctx);
    b.hp = 304;
    strike(ctx, b, 160); // 144 < 33 % of 460
    expect(ofType(ctx.events, 'bossPhase').map((e) => [e.phase, e.text])).toEqual([[1, FRACTURE_LINE], [2, NINE_SPEAK_LINE]]);
    expect(C(ctx).enemies.map((e) => e.refId)).toEqual([CONTAINED, ABERRATION]);
    expect(C(ctx).intents[b.uid]?.moveId).toBe('tyr_remember');
  });

  test('round 12 OR hpBelow 0.33: counted in rounds, checked when a round ends — the end of round 11 opens round 12 in The Nine Speak at 43 %', () => {
    const fracture = at(contained(), [D.d4(1)]);
    enterPhase(fracture, C(fracture), boss(fracture), 1);
    boss(fracture).hp = 200;
    const endOf = (round: number) => {
      const ctx = at(fracture);
      Object.assign(C(ctx), { round, turnIndex: C(ctx).turnOrder.length });
      runCombat(ctx);
      expect(ctx.rng.queue).toEqual([]);
      return ctx;
    };
    const r11 = endOf(10);
    expect([C(r11).round, boss(r11).phase]).toEqual([11, 1]);
    const r12 = endOf(11);
    expect(C(r12)).toMatchObject({ round: 12, phase: 'playerTurn' });
    expect(boss(r12)).toMatchObject({ phase: 2, pattern: { phaseEnteredRound: 12 } });
    expect(ofType(r12.events, 'bossPhase')).toEqual([{ t: 'bossPhase', uid: boss(r12).uid, phase: 2, text: NINE_SPEAK_LINE }]);
    expect(C(r12).intents[boss(r12).uid]?.moveId).toBe('tyr_remember');
  });

  test('the other atoms: `addsDead` needs an add to have fought; `communionMovementEnd` only when reported; `resolveAtLeast` reads the communion', () => {
    const ctx = contained();
    const [c, b] = [C(ctx), boss(ctx)];
    expect(addsDown(c)).toBe(false);
    expect(triggerHolds(c, b, { event: 'addsDead' })).toBe(false);
    expect(triggerHolds(c, b, { event: 'communionMovementEnd' })).toBe(false);
    expect(triggerHolds(c, b, { event: 'communionMovementEnd' }, 'communionMovementEnd')).toBe(true);
    expect(triggerHolds(c, b, { resolveAtLeast: 4 })).toBe(false);
    c.communion = { movement: 2, resolve: 4, questionIndex: 0, answered: [], usedAnswers: [], lies: 0, listened: false, supportUsed: false, clockBonusGranted: false };
    expect(triggerHolds(c, b, { resolveAtLeast: 4 })).toBe(true);
    expect(triggerHolds(c, b, { resolveAtLeast: 5 })).toBe(false);
    expect(triggerHolds(c, b, { round: 1 })).toBe(true);
    // a reported event with no phase listening changes nothing; nothing is checked while the player is down
    phaseEvent(ctx, c, 'communionMovementEnd');
    expect(b.phase).toBe(0);
    b.hp = 10;
    playerOf(c).alive = false;
    checkPhases(ctx, c);
    expect(b.phase).toBe(0);
  });
});

describe('adds, reinforcements and onEnter (the fixture Bell)', () => {
  test('reinforce: each fallen add is replaced at once (keeping 1 standing solo) until 3 have fought; then `addsDead` enters The Hour — flag, the party\'s Shield stripped, ×2 taken', () => {
    const ctx = at(open(state({ flags: { flag_heartstone_stabilized: true } }), spec(BELL), [D.d4(4), D.d4(1), D.d4(1)]), [D.d4(1), D.d4(1)]);
    const c = C(ctx);
    const [bell, me] = [boss(ctx), playerOf(c)];
    me.statuses.push({ statusId: 'status_shield', stacks: 1, duration: 3, sourceUid: me.uid, appliedOnOwnTurn: false, tick: 10 });
    const before = damageRange(ctx, me, bell, SWORD);
    const shades = () => c.enemies.filter((e) => e.refId === SHADE);
    const standing = () => shades().filter((e) => e.alive);
    strike(ctx, standing()[0]!, 18);
    expect(shades().map((e) => [e.name, e.alive])).toEqual([['Corrupted Shade', false], ['Corrupted Shade B', true]]);
    expect(bell.phase).toBe(1);
    strike(ctx, standing()[0]!, 18);
    expect(shades().map((e) => e.name)).toEqual(['Corrupted Shade', 'Corrupted Shade B', 'Corrupted Shade C']);
    expect(bell.phase).toBe(1);
    strike(ctx, standing()[0]!, 18); // the third and last: no replacement, so the adds are dead
    expect(ctx.rng.queue).toEqual([]);
    expect(shades()).toHaveLength(3);
    expect(addsDown(c)).toBe(true);
    expect(bell.phase).toBe(2);
    expect(ofType(ctx.events, 'addsSummoned')).toHaveLength(2);
    expect(ctx.s.flags.flag_bell_hour).toBe(true);
    expect(me.statuses).toEqual([]);
    expect(ofType(ctx.events, 'statusExpired')).toEqual([{ t: 'statusExpired', targetUid: me.uid, statusId: 'status_shield' }]);
    expect(phaseMults(ctx, me, bell)).toEqual([{ name: 'phase damage taken', value: 2 }]);
    expect(before).toEqual([13, 15]); // ATK 14 × 0.9 / × 1.1, no armor
    expect(damageRange(ctx, me, bell, SWORD)).toEqual([25, 31]);
  });

  test('with a companion the row opens with 2 and keeps 2 standing (max 2 alive), until 3 in all', () => {
    const ctx = at(open(state({ flags: { flag_heartstone_stabilized: true }, patch: withIlyra }), spec(BELL), [D.d4(4), D.d4(4), D.d4(1), D.d4(1), D.d4(1)]), [D.d4(1)]);
    const c = C(ctx);
    const standing = () => c.enemies.filter((e) => e.refId === SHADE && e.alive);
    expect(standing()).toHaveLength(2);
    strike(ctx, standing()[0]!, 18);
    expect(standing().map((e) => e.name)).toEqual(['Corrupted Shade B', 'Corrupted Shade C']);
    strike(ctx, standing()[0]!, 18);
    expect(standing().map((e) => e.name)).toEqual(['Corrupted Shade C']);
    expect(boss(ctx).phase).toBe(1);
  });
});

describe('Remember once per phase, the pattern swap, the damage rows, Stagger (D-066 #1, D-068.3, D-072)', () => {
  test('The Fracture plays Remember once (its 6th step), not on the next lap; The Nine Speak opens with its own, then Unraveling every turn', () => {
    const ctx = at(contained(), [D.d4(1)]);
    const [c, b] = [C(ctx), boss(ctx)];
    const next = (n: number) => Array.from({ length: n }, () => generateIntent(ctx, c, b)?.moveId);
    enterPhase(ctx, c, b, 1);
    expect([c.intents[b.uid]?.moveId, ...next(11)]).toEqual([
      'tyr_korr_burns', 'tyr_vane_closes', 'tyr_gather', 'tyr_aulde_sings', 'tyr_sallow_breathes', 'tyr_remember',
      'tyr_korr_burns', 'tyr_vane_closes', 'tyr_gather', 'tyr_aulde_sings', 'tyr_sallow_breathes', 'tyr_korr_burns',
    ]);
    enterPhase(ctx, c, b, 2);
    expect([c.intents[b.uid]?.moveId, ...next(3)]).toEqual(['tyr_remember', 'tyr_unraveling', 'tyr_unraveling', 'tyr_unraveling']);
    expect(c.intents[b.uid]?.tags).toEqual(['ALL', 'Armor Break']);
  });

  test('damage taken: The Nine Speak takes ×1.5 (provisional, D-068.3); 7–9 becomes 13–17 against armor 6', () => {
    const ctx = contained();
    const [b, me] = [boss(ctx), playerOf(C(ctx))];
    expect(phaseMults(ctx, me, b)).toEqual([]);
    expect(damageRange(ctx, me, b, SWORD)).toEqual([7, 9]);
    b.phase = 2;
    expect(phaseMults(ctx, me, b)).toEqual([{ name: 'phase damage taken', value: 1.5 }]);
    expect(damageRange(ctx, me, b, SWORD)).toEqual([13, 17]);
  });

  test('damageDealtRampPerRound: the fixture Tyrant\'s Chrono-Strike phase deals +10 % per round spent in it (none in the round of entry)', () => {
    const ctx = at(open(state({ loop: 2, locationId: APEX }), spec(TYRANT), [D.d4(4), D.d4(1)], loop2), [D.yes], loop2);
    const [c, b, me] = [C(ctx), boss(ctx), playerOf(C(ctx))];
    const lash = moveSpec('tyr_time_lash', content.creatures[TYRANT]!.moves.tyr_time_lash!)!;
    const base = damageRange(ctx, b, me, lash);
    enterPhase(ctx, c, b, 2);
    expect(ctx.rng.queue).toEqual([]);
    expect(phaseMults(ctx, b, me)).toEqual([]);
    c.round = 3;
    expect(phaseMults(ctx, b, me)[0]?.value).toBeCloseTo(1.2);
    const ramped = damageRange(ctx, b, me, lash);
    expect(ramped[1]).toBeGreaterThan(base[1]);
    expect(phaseMults(ctx, me, b)).toEqual([]); // the ramp is the boss's outgoing damage only
  });

  test('Stagger (DESIGN §4.2): the Contained Tyrant is interruptible — its committed intent is lost, the next one comes from the next step', () => {
    const ctx = at(contained(), [D.yes]);
    expect(interruptIntent(ctx, C(ctx), boss(ctx))).toBe(true);
    expect(C(ctx).log.at(-1)?.text).toBe('The Chronos Tyrant staggers: Brace is lost.');
    expect(C(ctx).intents[boss(ctx).uid]?.moveId).toBe('tyr_grasp');
  });
});

describe('surviveRounds and leaveCombat (D-069.9)', () => {
  const tide = () => open(state(), spec(TIDE, { onVictory: [{ setFlag: 'flag_outlasted' }] }), [D.d4(4), D.d4(1)]).s;
  const WASH = [D.pct(0), D.variance(1), D.pct(99)];

  test('ending round 3 with the party standing wins the fight: no XP, no gold, no loot; the encounter\'s onVictory; the line', () => {
    const s0 = tide();
    expect(C({ s: s0 }).log.map((l) => l.text)).toContain('Hold out for 3 rounds.');
    expect(survivalRounds(content, C({ s: s0 }))).toEqual({ rounds: 3, line: 'The Tide passes.' });
    const r1 = act(s0, { type: 'guard' }, WASH);
    expect(r1.state.combat).toMatchObject({ round: 2, phase: 'playerTurn' });
    const r2 = act(r1.state, { type: 'guard' }, WASH);
    const r3 = act(r2.state, { type: 'guard' }, WASH);
    expect(r3.state.mode).toBe('explore');
    expect(ofType(r3.events, 'combatEnded')).toEqual([{ t: 'combatEnded', result: 'victory', rounds: 3, xp: 0, gold: 0, loot: [] }]);
    expect(ofType(r3.events, 'log').map((e) => e.text)).toContain('The Tide passes.');
    expect(r3.state.flags.flag_outlasted).toBe(true);
    expect(r3.state.player).toMatchObject({ xp: 0, gold: s0.player.gold });
    expect(r3.state.counters).toMatchObject({ fightsWon: 1, kills: {} });
    expect(r3.profile.bestiary[TIDE]).toMatchObject({ seen: 1, killed: 0 });
  });

  test('a first phase that was skipped never arms survival; a non-boss has none', () => {
    const ctx = contained();
    expect(survivalRounds(content, C(ctx))).toBeNull();
    const c = clone(tide().combat as CombatState);
    c.enemies[0]!.pattern.firedOnce = [];
    expect(survivalRounds(content, c)).toBeNull();
  });

  test('leaveCombat on entering a phase: hurt below half, the Tide withdraws — the fight is won with nothing for it (not a kill)', () => {
    const s0 = tide();
    (s0.combat as CombatState).enemies[0]!.hp = 151;
    const out = act(s0, { type: 'attack', targetUid: (s0.combat as CombatState).enemies[0]!.uid }, [D.pct(0), D.variance(1), D.pct(99)]);
    expect(ofType(out.events, 'bossPhase').map((e) => e.text)).toEqual(['Ebbing']);
    expect(ofType(out.events, 'combatEnded')).toEqual([{ t: 'combatEnded', result: 'victory', rounds: 1, xp: 0, gold: 0, loot: [] }]);
    expect(out.state.counters.kills).toEqual({});
    expect(ofType(out.events, 'combatantDefeated')).toEqual([]);
  });

  test('a move with leaveCombat: the Runner jabs, then runs — out of the fight, no XP, no loot, not a kill; the effect form too', () => {
    const s0 = open(state(), spec(RUNNER, { fleeable: true, onFlee: 'scatter' }), [D.d4(4), D.d4(1)]).s;
    const r1 = act(s0, { type: 'guard' }, [D.pct(0), D.variance(1), D.pct(99)]);
    expect((r1.state.combat as CombatState).intents[(r1.state.combat as CombatState).enemies[0]!.uid]).toMatchObject({ moveId: 'runner_flee', targetUid: null });
    const r2 = act(r1.state, { type: 'guard' }, []);
    expect(ofType(r2.events, 'combatEnded')).toEqual([{ t: 'combatEnded', result: 'victory', rounds: 2, xp: 0, gold: 0, loot: [] }]);
    expect(r2.state.counters.kills).toEqual({});
    expect(r2.state.player.inventory.some((i) => i.itemId === 'mat_shadow_ash')).toBe(false);
    // `{ leaveCombat: true }` in a move's effects
    const ctx = at(open(state(), spec(RUNNER), [D.d4(4), D.d4(1)]));
    const c = C(ctx);
    const runner = boss(ctx);
    c.intents[runner.uid] = { moveId: 'runner_vanish', targetUid: null, projected: [0, 0], hidden: false, text: '', tags: [] };
    executeIntent(ctx, c, runner, applyHit);
    expect(runner).toMatchObject({ alive: true, fledOrGone: true, statuses: [] });
    expect(c.intents[runner.uid]).toBeUndefined();
    expect(c.log.at(-1)?.text).toBe('Fixture Runner withdraws from the fight.');
  });
});

// ---- the fixture Tyrant, end to end --------------------------------------------------------------------------------------------

/**
 * A scripted player against the fixture's 3-phase Tyrant (Loop 2, the Apex), through `step` with the run's seeded rng:
 * a level-18 Ranger whose fight snapshot is buffed to 4000 HP and ATK 90. Each turn: the Amulet's Echo Bolt while the
 * Tyrant holds a Rewind; Guard against a committed Chrono-Strike; the add first; else the Tyrant.
 */
function tyrantFight() {
  let prof = loop2;
  const s0 = state({ loop: 2, level: 18, locationId: 'loc_chronos_nexus', echoes: ['echo_apex_resonance'] });
  let out = step(s0, { type: 'move', to: APEX }, content, prof);
  const events: GameEvent[] = [...out.events];
  let s = clone(out.state);
  prof = out.profile;
  Object.assign(playerOf(s.combat as CombatState), { hp: 4000, hpMax: 4000, atk: 90 });
  let steps = 0;
  for (; s.mode === 'combat' && steps < 100; steps++) {
    const c = s.combat as CombatState;
    const legal = legalActions(s, content, prof);
    const b = c.enemies[0] as Combatant;
    const add = c.enemies.find((e) => e.isAdd && e.alive);
    const pick = (want: (a: Action) => boolean) => legal.find(want);
    const action =
      (b.statuses.some((x) => x.statusId === 'status_rewind') ? pick((a) => a.type === 'ability' && a.abilityId === 'itm_echo_bolt' && a.targetUid === b.uid) : undefined) ??
      (c.intents[b.uid]?.moveId === 'tyr_chrono_strike' ? pick((a) => a.type === 'guard') : undefined) ??
      pick((a) => a.type === 'attack' && a.targetUid === (add ?? b).uid);
    if (!action) throw new Error(`no action at step ${steps}`);
    out = step(s, action, content, prof);
    expect(ofType(out.events, 'actionRejected')).toEqual([]);
    events.push(...out.events);
    s = out.state;
    prof = out.profile;
  }
  return { s, prof, events, steps };
}

describe('the fixture 3-phase Tyrant, fought to the end (PLAN §8.1 "the fixture Tyrant fight runs to completion")', () => {
  test('Lament → The Nine Surface (its add, Remember) → Chrono-Strike (wind-ups, the ramp) → dead: phases once each in order, the Rewind cap, the spoils, the bestiary', () => {
    const { s, prof, events, steps } = tyrantFight();
    expect(s.mode).toBe('explore');
    expect(steps).toBeLessThan(100);
    const tyrantUid = ofType(events, 'combatStarted')[0]!.enemies[0]!.uid;
    expect(ofType(events, 'bossPhase').map((e) => [e.uid, e.phase])).toEqual([[tyrantUid, 0], [tyrantUid, 1], [tyrantUid, 2]]);
    expect(ofType(events, 'addsSummoned')).toHaveLength(1); // solo: one Aberration
    const revealed = ofType(events, 'intentRevealed').filter((e) => e.uid === tyrantUid).map((e) => e.intent.moveId);
    for (const id of ['tyr_speak', 'tyr_remember', 'tyr_gather', 'tyr_chrono_strike']) expect(revealed).toContain(id);
    // Remember's Rewind: Ley unravels it, and whatever runs its course restores at most 10 % of the Tyrant's max HP
    expect(ofType(events, 'interplay').some((e) => e.rule === 'rewind_consumed' && e.targetUid === tyrantUid)).toBe(true);
    const cap = Math.round(0.1 * Math.round(900 * 1.03));
    for (const e of ofType(events, 'healed').filter((x) => x.source === 'status_rewind' && x.targetUid === tyrantUid)) expect(e.amount).toBeLessThanOrEqual(cap);
    // the spoils: both kills' XP (× 1.03 in Loop 2), the Tyrant's Frayed Moments, flag_tyrant_dead
    const ended = ofType(events, 'combatEnded')[0]!;
    const xp = creatureXp(s, content, TYRANT) + creatureXp(s, content, ABERRATION);
    expect(ended).toMatchObject({ result: 'victory', xp });
    expect(xp).toBe(1648 + 536);
    expect(ended.loot.find((i) => i.itemId === 'mat_frayed_moment' && i.qty === 3)).toBeDefined();
    expect(s.flags.flag_tyrant_dead).toBe(true);
    expect(s.counters.kills).toEqual({ [TYRANT]: 1, [ABERRATION]: 1 });
    // the bestiary: two first entries (+3 each), resistances shown, what was seen
    expect(prof.bestiary[TYRANT]).toMatchObject({ seen: 1, killed: 1, revealed: 'resist' });
    expect(prof.bestiary[ABERRATION]).toMatchObject({ seen: 1, killed: 1, revealed: 'resist' });
    for (const id of ['tyr_speak', 'tyr_chrono_strike']) expect(prof.bestiary[TYRANT]?.intentsSeen).toContain(id);
    expect(prof.resonance).toBe(6);
    expect(prof.discoveries).toEqual([`kill:${ABERRATION}`, `kill:${TYRANT}`]);
    // seeded: the same fight again is the same fight
    expect(stateHash(tyrantFight().s)).toBe(stateHash(s));
  });
});
