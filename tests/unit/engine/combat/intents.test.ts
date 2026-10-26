// U25: enemy intents (DESIGN §4.2, §4.8, §4.10; PLAN §4.10 "Intents", §8.1 row "intents"; D-066 #14). The ordered
// pattern (pointer, wrap, branches, repeat, weighted, phaseHold), CombatWhen at generation only, generation = commitment
// (projected range without rng, the "?" chip, tags), targets and Taunt, Stun / interrupt skipping the step, wind-ups,
// summon's max, the non-damaging moves, boss phases ("once in this phase"), and every cadence word of WORLD §6.
// DESIGN §4.12's chips, round by round, are in reducers/combat.test.ts.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import type { CombatWhen, CreatureInput, MoveInput, Step } from '@schema/creature';
import {
  STATUS,
  STUN_RECOVERY_KEY,
  TAG_ALL,
  TAG_WIND_UP,
  WIND_UP_KEY,
  applyHit,
  applyStatus,
  beginCombat,
  compilePattern,
  damageRange,
  evalCombatWhen,
  executeIntent,
  finishPlayerTurn,
  generateIntent,
  intentHitSpec,
  intentTags,
  intentTarget,
  interruptIntent,
  openingIntents,
  patternOf,
  playerOf,
  projectIntent,
  refreshIntents,
  resetPattern,
  runCombat,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type Intent,
  type StatusInstance,
  type TargetRuleId,
  type WhenScope,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { BRUTE, D, SHADE, combatTables, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { FIXTURE_VERSION } from '@tests/fixtures/miniContent';

// ---- the test creatures ---------------------------------------------------------------------------------------------------

const PUP = 'cr_test_pup';
const TYRANT = 'cr_chronos_tyrant_unveiled';
const MIRELING = 'cr_glowfen_mireling';

const MOVES = {
  t_jab: { name: 'Jab', line: 'It jabs.', type: 'physical', power: { coef: 1, stat: 'atk' } },
  t_slam: { name: 'Slam', line: 'It slams.', type: 'physical', power: { coef: 2, stat: 'atk' } },
  t_roar: { name: 'Roar', line: 'It roars.' },
  t_brace: { name: 'Brace', line: 'It braces.', shield: { power: { base: 5, coef: 0.5, stat: 'atk' } } },
  t_mend: { name: 'Mend', line: 'It knits itself.', heal: { power: { base: 10, coef: 0, stat: 'atk' }, target: 'self' } },
  t_sweep: {
    name: 'Sweep', line: 'It sweeps at everyone.', type: 'physical', power: { coef: 1, stat: 'atk' },
    statuses: [{ status: 'status_weaken', chance: 0.5, duration: 2 }],
  },
  t_flurry: { name: 'Flurry', line: 'Three quick cuts.', type: 'physical', power: { coef: 0.5, stat: 'atk', hits: 3 } },
  t_flicker: { name: 'Flicker', line: 'It flickers.', type: 'chrono', power: { coef: 1, stat: 'atk' }, hidden: true },
  t_gather: { name: 'Gather', line: 'It draws back like an arm.', hidden: true, windUp: { turns: 2, then: 't_crash' } },
  t_crash: {
    name: 'Crash', line: 'It falls.', type: 'physical', power: { coef: 3, stat: 'atk' }, hidden: true,
    statuses: [{ status: 'status_stun', duration: 1, when: { playerGuarding: false } }],
  },
  t_call: { name: 'Call', line: 'It calls the pack.', summon: { creatureId: PUP, count: 2, max: 2, hpPct: 0.5 } },
  t_raise: { name: 'Raise', line: 'It raises the fallen.', revive: { hpPct: 0.5 } },
  t_shelter: { name: 'Shelter', line: 'It shelters another.', shieldAlly: { power: { base: 10, coef: 0, stat: 'atk' } } },
  t_purge: { name: 'Purge', line: 'It shakes it off.', cleanseSelf: true },
  t_fade: { name: 'Fade', line: 'It thins.', statuses: [{ status: 'status_phase', duration: 1, target: 'self' }] },
} satisfies Record<string, MoveInput>;
type MoveId = keyof typeof MOVES;

const mv = (move: MoveId, target: TargetRuleId = 'player', when?: CombatWhen): Step => (when ? { move, target, when } : { move, target });
const J = mv('t_jab');
const S = mv('t_slam');

type CreatureId = `cr_${string}`;
const creature = (id: CreatureId, name: string, pattern: Step[], over: Partial<CreatureInput> = {}): CreatureInput => ({
  id, name, description: 'Fixture: an intents test creature.', family: 'fam_wilds', role: 'fodder', level: 3,
  stats: { hp: 60, atk: 10, sp: 10, armor: 0, ward: 0, agi: 1 }, moves: MOVES, pattern, gold: { min: 0, max: 0 }, xp: 10,
  bestiary: { voice: 'wayfinder_notes', summary: 'Fixture.' }, sigil: { base: 'brute' }, ...over,
});

const C = {
  cycle: 'cr_test_cycle', branch: 'cr_test_branch', repeat: 'cr_test_repeat', weighted: 'cr_test_weighted', never: 'cr_test_never',
  flicker: 'cr_test_flicker', gatherer: 'cr_test_gatherer', caller: 'cr_test_caller', raiser: 'cr_test_raiser', boss: 'cr_test_boss',
  flurry: 'cr_test_flurry', brace: 'cr_test_brace', mend: 'cr_test_mend', purge: 'cr_test_purge', shelter: 'cr_test_shelter',
} as const;
const RULES: readonly TargetRuleId[] = ['player', 'companion', 'lowest_hp', 'highest_mag', 'random', 'all', 'self', 'ally', 'marked_first', 'taunter'];
const aim = (rule: TargetRuleId): CreatureId => `cr_test_aim_${rule}`;

/**
 * WORLD §6's cadence words (grep "every", "first", "once" in the creature intent lines and phase lines, copied
 * verbatim) and the patterns they map to (DESIGN §4.2: `everyNthTurn:n` → `everyNth`, "first" → `first`, "once per
 * fight" → `oncePerFight`, `ifAllyPresent` → `allyPresent`, "alternates" → a two-step pattern), with the moves each
 * commits to turn by turn. "**once in this phase**" is the boss test below; "Haste self every turn" (a phase rule, U27)
 * and "Breach Clock −1 watch (once per fight)" (a move effect, U26) are not intent cadences.
 */
interface CadenceRow {
  words: string;
  pattern: Step[];
  expect: string;
  turns?: number;
  allies?: string[];
  draws?: number[];
  before?: (turn: number, foe: Combatant, combat: CombatState, s: GameState) => void;
}
const everyNth = (n: number): Step[] => [{ if: { everyNth: n }, then: [S], else: [J] }];
const markOn = (c: Combatant, on: boolean): void => {
  c.statuses = c.statuses.filter((st) => st.statusId !== STATUS.mark);
  if (on) c.statuses.push(inst(STATUS.mark));
};
const CADENCE: CadenceRow[] = [
  { words: 'everyNthTurn:2', pattern: everyNth(2), expect: 'jab slam jab slam jab slam' },
  { words: 'everyNthTurn:3', pattern: everyNth(3), expect: 'jab jab slam jab jab slam' },
  { words: 'everyNthTurn:4', pattern: everyNth(4), expect: 'jab jab jab slam jab jab' },
  { words: 'everyNthTurn:2 (no wind-up)', pattern: [mv('t_slam', 'player', { everyNth: 2 }), J], expect: 'jab slam jab slam jab slam' },
  { words: 'first', pattern: [mv('t_roar', 'self', { first: true }), J], expect: 'roar jab jab jab', turns: 4 },
  {
    words: 'first; **only** the Archivist at loc_sunken_archives during q_lost_scroll',
    pattern: [mv('t_roar', 'self', { all: [{ first: true }, { flag: 'flag_test_only_here' }] }), J],
    expect: 'roar jab jab',
    turns: 3,
    before: (_turn, _foe, _combat, s) => void (s.flags.flag_test_only_here = true),
  },
  {
    words: 'rewind self 2 · ifHpBelow:50 · once per fight',
    pattern: [{ if: { all: [{ hpBelow: 0.5 }, { oncePerFight: true }] }, then: [mv('t_mend', 'self')], else: [J] }],
    expect: 'jab mend jab jab',
    turns: 4,
    before: (turn, foe) => void (foe.hp = turn >= 2 ? 20 : 60),
  },
  {
    words: 'revives one fallen Drowned ally at 40% HP · ifAllyDown · once per fight',
    pattern: [{ if: { all: [{ allyCountBelow: 1 }, { oncePerFight: true }] }, then: [mv('t_raise', 'self')], else: [J] }],
    expect: 'jab raise jab jab',
    turns: 4,
    allies: [PUP],
    before: (turn, _foe, combat) => void (combat.enemies[1]!.alive = turn < 2),
  },
  { words: 'ifAllyDown · once', pattern: [mv('t_call', 'self', { all: [{ allyCountBelow: 1 }, { oncePerFight: true }] }), J], expect: 'call jab jab', turns: 3 },
  {
    words: 'no action · once, ifHpBelow:15',
    pattern: [mv('t_roar', 'self', { all: [{ oncePerFight: true }, { hpBelow: 0.15 }] }), J],
    expect: 'jab jab roar jab jab',
    turns: 5,
    before: (turn, foe) => void (foe.hp = turn >= 3 ? 5 : 60),
  },
  { words: 'every turn', pattern: [J], expect: 'jab jab jab', turns: 3 },
  {
    words: 'every second turn (alternates with the moves below; it braces because it is resisting the Holding\'s reflex, D-067.12)',
    pattern: [mv('t_brace', 'self'), J],
    expect: 'brace jab brace jab',
    turns: 4,
  },
  { words: 'ifAllyPresent, everyNthTurn:3', pattern: [{ if: { all: [{ allyPresent: true }, { everyNth: 3 }] }, then: [S], else: [J] }], expect: 'jab jab slam jab jab slam', allies: [PUP] },
  {
    words: 'ifTargetHas:mark, everyNthTurn:3',
    pattern: [{ if: { all: [{ targetHas: 'status_mark' }, { everyNth: 3 }] }, then: [S], else: [J] }],
    expect: 'jab jab slam jab jab jab',
    before: (turn, _foe, combat) => markOn(playerOf(combat), turn <= 3),
  },
  {
    words: 'everyNthTurn:2, skipped while it is Marked',
    pattern: [mv('t_fade', 'self', { all: [{ everyNth: 2 }, { not: { selfHas: 'status_mark' } }] }), J],
    expect: 'jab fade jab jab jab fade',
    before: (turn, foe) => markOn(foe, turn === 4),
  },
  {
    words: 'everyNthTurn:3 · otherwise the Phase 1 moves',
    pattern: [{ if: { everyNth: 3 }, then: [mv('t_roar', 'self')], else: [{ weighted: [{ w: 1, step: J }, { w: 1, step: S }] }] }],
    expect: 'jab slam roar jab slam',
    turns: 5,
    draws: [0.1, 0.9, 0.1, 0.9],
  },
];
const cadenceId = (i: number): CreatureId => `cr_test_cadence_${i}`;

const TEST_CREATURES: CreatureInput[] = [
  creature(PUP, 'Test Pup', [J], { stats: { hp: 20, atk: 4, armor: 0, ward: 0, agi: 1 } }),
  creature(C.cycle, 'Test Cycle', [J, S, mv('t_roar', 'self')]),
  creature(C.branch, 'Test Branch', [{ if: { hpBelow: 0.5 }, then: [mv('t_mend', 'self'), mv('t_roar', 'self')], else: [J] }, S]),
  creature(C.repeat, 'Test Repeat', [{ repeat: [J], times: 2 }, S]),
  creature(C.weighted, 'Test Weighted', [{ weighted: [{ w: 1, step: J }, { w: 3, step: S }] }]),
  creature(C.never, 'Test Never', [mv('t_jab', 'player', { roundAtLeast: 99 })]),
  creature(C.flicker, 'Test Flicker', [mv('t_flicker'), J], { stats: { hp: 60, atk: 10, sp: 10, armor: 0, ward: 0, agi: 8 } }),
  creature(C.gatherer, 'Test Gatherer', [mv('t_gather'), J]),
  creature(C.caller, 'Test Caller', [mv('t_call', 'self')]),
  creature(C.raiser, 'Test Raiser', [mv('t_raise', 'self')]),
  creature(C.flurry, 'Test Flurry', [mv('t_flurry')]),
  creature(C.brace, 'Test Brace', [mv('t_brace', 'self')]),
  creature(C.mend, 'Test Mend', [mv('t_mend', 'self')]),
  creature(C.purge, 'Test Purge', [mv('t_purge', 'self')]),
  creature(C.shelter, 'Test Shelter', [mv('t_shelter', 'ally')]),
  creature(C.boss, 'Test Boss', [], {
    role: 'boss', fleeable: false, interruptible: false,
    phases: [
      { id: 'tb_one', name: 'One', pattern: [mv('t_roar', 'self', { first: true }), mv('t_brace', 'self', { oncePerFight: true }), J, { phaseHold: true }] },
      { id: 'tb_two', name: 'Two', enterWhen: [{ hpBelow: 0.5 }], pattern: [mv('t_brace', 'self', { oncePerFight: true }), S] },
    ],
  }),
  ...RULES.map((rule) => creature(aim(rule), `Test Aim ${rule}`, [mv(rule === 'all' ? 't_sweep' : rule === 'self' ? 't_brace' : rule === 'ally' ? 't_shelter' : 't_jab', rule)])),
  ...CADENCE.map((row, i) => creature(cadenceId(i), `Test Cadence ${i}`, row.pattern)),
];

const pack = (() => {
  const t = combatTables();
  return buildContentPack({ ...t, creatures: [...t.creatures, ...TEST_CREATURES] }, { version: FIXTURE_VERSION });
})();

// ---- harness -------------------------------------------------------------------------------------------------------------

const profile = freshProfile();
const ILYRA = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {} };
const withIlyra: StateOverrides = { patch: (st) => void ((st.companions.recruited.ilyra = { ...ILYRA }), (st.companions.activeId = 'ilyra')) };
const spec = (groups: EncounterSpec['groups']): EncounterSpec => ({ id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] });
const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
function inst(statusId: string, over: Partial<StatusInstance> = {}): StatusInstance {
  return { statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over };
}
const one = (...ids: string[]): EncounterSpec['groups'] => ids.map((creatureId) => ({ creatureId, count: 1 }));
const HIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(99)];
const MISS = [D.pct(99)];
const short = (id: string | undefined): string => (id === undefined ? '—' : id.replace(/^(t_|shade_|brute_|mireling_|tyr_)/, ''));

/** A fight in phase 'start': the player first (d4 4), a companion next (d4 4), enemies last (d4 1), unless `d4s` says otherwise. */
function setup(groups: EncounterSpec['groups'], o: StateOverrides = {}, d4s?: number[]) {
  const s = makeState(o, { content: pack });
  const companion = s.companions.activeId !== null ? 1 : 0;
  const n = groups.reduce((k, g) => k + g.count, 0);
  const ctx = scriptedCtx(s, d4s ?? [D.d4(4), ...Array<number>(companion).fill(D.d4(4)), ...Array<number>(n).fill(D.d4(1))], pack, profile);
  const combat = beginCombat(ctx, spec(groups));
  return { ctx, combat, me: combat.party[0] as Combatant, foe: combat.enemies[0] as Combatant };
}
/** The fight played to the player's first turn; `draws` are what the enemies do before it. */
function fightAt(groups: EncounterSpec['groups'], o: StateOverrides = {}, draws: number[] = [], d4s?: number[]) {
  const { ctx } = setup(groups, o, d4s);
  ctx.rng.queue.push(...draws);
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  return { state: ctx.s, events: ctx.events };
}
function act(s: GameState, action: Parameters<typeof scriptedStep>[1], draws: readonly number[]) {
  const out = scriptedStep(s, action, draws, pack, profile);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}
const fightOf = (s: GameState): CombatState => s.combat as CombatState;
const foeOf = (s: GameState, i = 0): Combatant => fightOf(s).enemies[i] as Combatant;
const meOf = (s: GameState): Combatant => playerOf(fightOf(s));
const intentOf = (s: GameState, i = 0): Intent | undefined => fightOf(s).intents[foeOf(s, i).uid];
const guard = { type: 'guard' } as const;

/**
 * The moves creature `id` commits to over `turns` turns by the generation rules alone: per turn, `before`, then its
 * intent for that turn (round = turn), then the turn passes (`turnsTaken` + 1). Exactly `draws` are consumed.
 */
function plan(id: string, turns: number, o: Pick<CadenceRow, 'allies' | 'draws' | 'before'> & { state?: StateOverrides } = {}): string[] {
  const { ctx, combat, foe } = setup(one(id, ...(o.allies ?? [])), o.state);
  ctx.rng.queue.push(...(o.draws ?? []));
  const out: string[] = [];
  for (let turn = 1; turn <= turns; turn++) {
    combat.round = turn;
    o.before?.(turn, foe, combat, ctx.s);
    generateIntent(ctx, combat, foe);
    out.push(short(combat.intents[foe.uid]?.moveId));
    foe.pattern.turnsTaken += 1;
  }
  expect(ctx.rng.queue).toEqual([]);
  return out;
}
const words = (s: string): string[] => s.split(' ');

// ---- the program ---------------------------------------------------------------------------------------------------------

describe('the ordered pattern (DESIGN §4.2)', () => {
  test('compiles to moves, branches, jumps, picks and holds; `repeat` unrolls with step-scoped keys; cached per pattern', () => {
    const brute = pack.creatures[BRUTE]!.pattern;
    const prog = compilePattern(brute);
    expect(prog).toEqual([
      { op: 'move', key: '0', move: 'brute_strike', target: 'player' },
      { op: 'move', key: '1', move: 'brute_strike', target: 'player' },
      { op: 'move', key: '2', move: 'brute_maul', target: 'player' },
      { op: 'branch', key: '3', cond: { hpBelow: 0.5 }, else: 6 },
      { op: 'move', key: '3.then.0', move: 'brute_root_knit', target: 'self' },
      { op: 'jump', to: 7 },
      { op: 'move', key: '3.else.0', move: 'brute_strike', target: 'player' },
    ]);
    expect(compilePattern(brute)).toBe(prog);
    const mixed = compilePattern([{ weighted: [{ w: 1, step: J }, { w: 3, step: { repeat: [S], times: 2 } }] }, { if: { first: true }, then: [J] }, { phaseHold: true }]);
    expect(mixed).toEqual([
      { op: 'pick', options: [{ w: 1, to: 1 }, { w: 3, to: 3 }] },
      { op: 'move', key: '0.weighted.0', move: 't_jab', target: 'player' },
      { op: 'jump', to: 6 },
      { op: 'move', key: '0.weighted.1.repeat.0', move: 't_slam', target: 'player' },
      { op: 'move', key: '0.weighted.1.repeat.0', move: 't_slam', target: 'player' },
      { op: 'jump', to: 6 },
      { op: 'branch', key: '1', cond: { first: true }, else: 8 },
      { op: 'move', key: '1.then.0', move: 't_jab', target: 'player' },
      { op: 'hold', key: '2' },
    ]);
  });

  test('the pointer advances one step per turn and wraps (the §4.12 patterns, branch both ways)', () => {
    expect(plan(SHADE, 6)).toEqual(words('rake wail rake rake wail rake'));
    expect(plan(SHADE, 6, { before: (turn, foe) => void (foe.hp = turn >= 3 ? 17 : 36) })).toEqual(words('rake wail fade rake wail fade'));
    expect(plan(BRUTE, 8)).toEqual(words('strike strike maul strike strike strike maul strike'));
    expect(plan(BRUTE, 4, { before: (turn, foe) => void (foe.hp = turn === 4 ? 20 : 64) })).toEqual(words('strike strike maul root_knit'));
    const { ctx, combat, foe } = setup(one(C.cycle));
    const pointers = [1, 2, 3, 1, 2].map(() => (generateIntent(ctx, combat, foe), foe.pattern.pointer));
    expect(pointers).toEqual([1, 2, 3, 1, 2]);
  });

  test('a step whose `when` is false is skipped and the walk goes on (the Mireling: Breathe In first, Glow Burst every 3rd)', () => {
    expect(plan(MIRELING, 7)).toEqual(words('breathe_in spit glow_burst spit drag spit drag'));
  });

  test('a then/else block runs to completion before the pointer continues; `repeat`; one draw per `weighted`; nothing eligible holds', () => {
    expect(plan(C.branch, 4)).toEqual(words('jab slam jab slam'));
    // hurt on turn 1 only: the block it entered (Mend, Roar) still runs to its end
    expect(plan(C.branch, 4, { before: (turn, foe) => void (foe.hp = turn === 1 ? 20 : 60) })).toEqual(words('mend roar slam jab'));
    expect(plan(C.repeat, 6)).toEqual(words('jab jab slam jab jab slam'));
    expect(plan(C.weighted, 3, { draws: [0.1, 0.5, 0.9] })).toEqual(words('jab slam slam')); // weights 1 : 3
    const { ctx, combat, foe } = setup(one(C.never));
    expect(generateIntent(ctx, combat, foe)).toBeNull();
    expect(combat.intents).toEqual({});
    expect(foe.pattern.pointer).toBe(0);
  });
});

// ---- CombatWhen ------------------------------------------------------------------------------------------------------------

describe('CombatWhen (DESIGN §4.2; U16 atoms)', () => {
  test('every atom, combinators and world Condition atoms', () => {
    const { ctx, combat, me, foe } = setup(one(BRUTE, SHADE), withIlyra);
    const shade = combat.enemies[1]!;
    const ev = (w: CombatWhen, over: Partial<WhenScope> = {}): boolean => evalCombatWhen(ctx, combat, w, { self: foe, target: me, turn: 1, round: 1, ...over });
    foe.hp = 31;
    expect(ev({ hpBelow: 0.5 })).toBe(true);
    foe.hp = 32;
    expect(ev({ hpBelow: 0.5 })).toBe(false);
    expect([ev({ roundAtLeast: 4 }, { round: 3 }), ev({ roundAtLeast: 4 }, { round: 4 })]).toEqual([false, true]);
    expect([ev({ allyCountBelow: 2 }), ev({ allyCountBelow: 1 }), ev({ allyPresent: true }), ev({ allyPresent: SHADE }), ev({ allyPresent: BRUTE })]).toEqual([true, false, true, true, false]);
    shade.alive = false;
    expect([ev({ allyCountBelow: 1 }), ev({ allyPresent: true })]).toEqual([true, false]);
    me.statuses.push(inst(STATUS.mark));
    foe.statuses.push(inst(STATUS.shield, { tick: 5 }));
    expect([ev({ targetHas: STATUS.mark }), ev({ targetHas: STATUS.mark }, { target: null }), ev({ selfHas: STATUS.shield }), ev({ selfHas: STATUS.mark })]).toEqual([true, false, true, false]);
    expect([3, 4, 6].map((turn) => ev({ everyNth: 3 }, { turn }))).toEqual([true, false, true]);
    expect([1, 2].map((turn) => ev({ first: true }, { turn }))).toEqual([true, false]);
    foe.pattern.firedOnce.push('0:3');
    expect([ev({ oncePerFight: true }), ev({ oncePerFight: true }, { onceKey: '0:2' }), ev({ oncePerFight: true }, { onceKey: '0:3' })]).toEqual([true, true, false]);
    expect(ev({ playerGuarding: true })).toBe(false);
    me.guarding = true;
    expect([ev({ playerGuarding: true }), ev({ playerGuarding: false })]).toEqual([true, false]);
    expect([ev({ targetIsBoss: false }), ev({ targetIsBoss: true }), ev({ targetIsBoss: false }, { target: null })]).toEqual([true, false, true]);
    expect(ev({ targetHasActed: false })).toBe(true);
    me.pattern.turnsTaken = 1;
    expect([ev({ targetHasActed: true }), ev({ targetHasActed: true }, { target: null })]).toEqual([true, false]);
    expect([ev({ all: [{ first: true }, { selfHas: STATUS.shield }] }), ev({ any: [{ first: true }, { everyNth: 2 }] }, { turn: 3 }), ev({ not: { first: true } })]).toEqual([true, false, false]);
    expect(ev({ flag: 'flag_test_cw' })).toBe(false);
    ctx.s.flags.flag_test_cw = true;
    expect([ev({ flag: 'flag_test_cw' }), ev({ loop: { min: 2 } }), ev({ all: [{ first: true }, { flag: 'flag_test_cw' }] })]).toEqual([true, false, true]);
    const boss = setup(one(TYRANT), { loop: 2 });
    expect(evalCombatWhen(boss.ctx, boss.combat, { targetIsBoss: true }, { self: boss.me, target: boss.foe, turn: 1, round: 1 })).toBe(true);
  });

  test('evaluated when the intent is generated, never later: a stored intent survives the condition flipping', () => {
    const { ctx, combat, foe } = setup(one(SHADE));
    foe.pattern.pointer = 2; // the branch {hp < 70 %: Fade | Rake}
    generateIntent(ctx, combat, foe);
    expect(combat.intents[foe.uid]?.moveId).toBe('shade_rake');
    foe.hp = 10;
    refreshIntents(ctx, combat);
    expect(combat.intents[foe.uid]?.moveId).toBe('shade_rake');
    generateIntent(ctx, combat, foe); // the next generation reads the new HP: a lap later it would Fade
    expect(combat.intents[foe.uid]?.moveId).toBe('shade_rake');
    expect(plan(SHADE, 3, { before: (turn, f) => void (f.hp = turn === 3 ? 10 : 36) })).toEqual(words('rake wail fade'));
  });
});

// ---- generation = commitment -------------------------------------------------------------------------------------------------

describe('generation = commitment (DESIGN §4.2)', () => {
  test('the stored intent: move, target, the pipeline range at the variance bounds (no rng, not assuming Guard), "?" flag, line, tags; the event carries a copy', () => {
    const { ctx, combat, me, foe } = setup(one(C.cycle));
    openingIntents(ctx, combat);
    expect(ctx.rng.queue).toEqual([]); // nothing drawn: a draw would have thrown
    const intent = combat.intents[foe.uid]!;
    const jab = intentHitSpec('t_jab', pack.creatures[C.cycle]!.moves.t_jab!, false)!;
    const range = damageRange(ctx, foe, me, jab);
    expect(intent).toEqual({ moveId: 't_jab', targetUid: me.uid, projected: range, hidden: false, text: 'It jabs.', tags: [] });
    expect(range).toEqual([Math.max(1, Math.round(9 - me.armor)), Math.max(1, Math.round(11 - me.armor))]);
    me.guarding = true;
    expect(projectIntent(ctx, combat, foe, intent)).toEqual(range);
    expect(projectIntent(ctx, combat, foe, intent, { guard: true })).toEqual(damageRange(ctx, foe, me, jab, { guard: true }));
    const events = ofType(ctx.events, 'intentRevealed');
    expect(events).toEqual([{ t: 'intentRevealed', uid: foe.uid, intent }]);
    intent.tags.push('changed');
    expect(events[0]?.intent.tags).toEqual([]);
    openingIntents(ctx, combat); // an enemy that already has one keeps it
    expect(ofType(ctx.events, 'intentRevealed')).toHaveLength(1);
  });

  test('multi-hit moves project hits × the per-hit range; non-damaging moves project [0, 0]; area intents aim at nobody, tag ALL and project against the player', () => {
    const flurry = setup(one(C.flurry));
    generateIntent(flurry.ctx, flurry.combat, flurry.foe);
    const per = damageRange(flurry.ctx, flurry.foe, flurry.me, intentHitSpec('t_flurry', pack.creatures[C.flurry]!.moves.t_flurry!, false)!);
    expect(flurry.combat.intents[flurry.foe.uid]?.projected).toEqual([per[0] * 3, per[1] * 3]);
    const brace = setup(one(C.brace));
    expect(generateIntent(brace.ctx, brace.combat, brace.foe)).toMatchObject({ moveId: 't_brace', targetUid: null, projected: [0, 0], tags: ['Shield'] });
    const sweep = setup(one(aim('all')), withIlyra);
    const all = generateIntent(sweep.ctx, sweep.combat, sweep.foe)!;
    expect(all).toMatchObject({ moveId: 't_sweep', targetUid: null, tags: [TAG_ALL, 'may Weaken'] });
    expect(all.projected).toEqual(damageRange(sweep.ctx, sweep.foe, sweep.me, intentHitSpec('t_sweep', pack.creatures[aim('all')]!.moves.t_sweep!, true)!));
    expect(intentTarget(sweep.combat, sweep.foe, all)).toBeNull();
  });

  test('effect tags (DESIGN §4.2 Display): may/for sure, itself, allies, Shield, heals, cleanses, summons, revives, winding up', () => {
    const tags = (m: MoveId) => intentTags(pack, pack.creatures[C.cycle]!.moves[m]!);
    expect([tags('t_sweep'), tags('t_crash'), tags('t_fade'), tags('t_brace'), tags('t_mend'), tags('t_shelter'), tags('t_purge'), tags('t_call'), tags('t_raise'), tags('t_gather'), tags('t_jab')]).toEqual([
      ['may Weaken'], ['Stun'], ['shrouds itself'], ['Shield'], ['heals itself'], ['shields an ally'], ['cleanses itself'], ['summons'], ['revives an ally'], [TAG_WIND_UP], [],
    ]);
    const shade = pack.creatures[SHADE]!.moves;
    expect([intentTags(pack, shade.shade_wail!), intentTags(pack, shade.shade_fade!), intentTags(pack, pack.creatures[BRUTE]!.moves.brute_root_knit!)]).toEqual([['may Weaken'], ['shrouds itself'], ['heals itself']]);
  });
});

// ---- targets and Taunt ---------------------------------------------------------------------------------------------------

describe('targets (DESIGN §4.8) and Taunt (§4.2)', () => {
  const target = (rule: TargetRuleId, edit: (x: ReturnType<typeof setup>) => void = () => {}, o: StateOverrides = withIlyra, draws: number[] = []) => {
    const x = setup(one(aim(rule)), o);
    edit(x);
    x.ctx.rng.queue.push(...draws);
    const intent = generateIntent(x.ctx, x.combat, x.foe);
    expect(x.ctx.rng.queue).toEqual([]);
    const uid = intent?.targetUid ?? null;
    return uid === null ? null : x.combat.party.find((c) => c.uid === uid)?.kind ?? x.combat.enemies.find((c) => c.uid === uid)?.refId;
  };

  test('player, companion (else the player), lowest_hp, highest_mag, random 60/40 (one draw, only with two to choose), marked_first, taunter, self, all', () => {
    expect([target('player'), target('companion'), target('companion', () => {}, {})]).toEqual(['player', 'companion', 'player']);
    expect([target('lowest_hp'), target('lowest_hp', (x) => void (x.combat.party[1]!.hp = 10))]).toEqual(['player', 'companion']);
    expect([target('highest_mag'), target('highest_mag', (x) => void (x.me.sp = 50))]).toEqual(['companion', 'player']); // Ilyra SP 10 > the Ranger's 6
    expect([target('random', () => {}, withIlyra, [0.59]), target('random', () => {}, withIlyra, [0.6]), target('random', () => {}, {})]).toEqual(['player', 'companion', 'player']);
    expect([target('marked_first'), target('marked_first', (x) => void x.combat.party[1]!.statuses.push(inst(STATUS.mark)))]).toEqual(['player', 'companion']);
    expect([target('taunter'), target('taunter', (x) => void x.foe.statuses.push(inst(STATUS.taunt, { sourceUid: x.combat.party[1]!.uid })))]).toEqual(['player', 'companion']);
    expect([target('self'), target('all')]).toEqual([null, null]);
  });

  test('ally: the most hurt other ally, else itself', () => {
    const alone = setup(one(C.shelter));
    expect(generateIntent(alone.ctx, alone.combat, alone.foe)?.targetUid).toBeNull();
    const pair = setup(one(C.shelter, BRUTE, SHADE));
    pair.combat.enemies[2]!.hp = 5;
    expect(generateIntent(pair.ctx, pair.combat, pair.foe)?.targetUid).toBe(pair.combat.enemies[2]!.uid);
  });

  test('Taunt retargets every single-target rule at generation (no draw for random) and at execution', () => {
    expect(target('companion', (x) => void x.foe.statuses.push(inst(STATUS.taunt, { sourceUid: x.me.uid })))).toBe('player');
    expect(target('random', (x) => void x.foe.statuses.push(inst(STATUS.taunt, { sourceUid: x.me.uid })))).toBe('player');
    expect(target('all', (x) => void x.foe.statuses.push(inst(STATUS.taunt, { sourceUid: x.me.uid })))).toBeNull(); // AoE stays AoE
    const { state } = fightAt(one(C.cycle), withIlyra);
    expect(intentOf(state)?.targetUid).toBe(meOf(state).uid);
    const ilyra = fightOf(state).party[1]!;
    const taunted = clone(state);
    foeOf(taunted).statuses.push(inst(STATUS.taunt, { sourceUid: ilyra.uid }));
    const out = act(taunted, guard, [...MISS, ...HIT()]); // Ilyra's strike misses; the Jab goes to Ilyra, not the Ranger
    expect(ofType(out.events, 'attackResolved').map((e) => e.targetUid)).toEqual([foeOf(state).uid, ilyra.uid]);
  });

  test('a dead target: the intent retargets to the rule\'s next valid pick (the player); the chip follows at the player\'s turn', () => {
    const { state } = fightAt(one(aim('companion')), withIlyra);
    const ilyra = fightOf(state).party[1]!;
    expect(intentOf(state)?.targetUid).toBe(ilyra.uid);
    const down = clone(state);
    fightOf(down).party[1]!.alive = false;
    const out = act(down, guard, HIT());
    expect(ofType(out.events, 'attackResolved').map((e) => e.targetUid)).toEqual([meOf(state).uid]);
    // re-aimed at the start of the player's turn (here: refreshed by hand, the chip still pointing at the fallen)
    const ctx = scriptedCtx(down, [], pack, profile);
    refreshIntents(ctx, fightOf(ctx.s));
    expect(intentOf(ctx.s)?.targetUid).toBe(meOf(state).uid);
    expect(ofType(ctx.events, 'intentRevealed')).toHaveLength(1);
  });
});

// ---- hidden ------------------------------------------------------------------------------------------------------------------

describe('hidden intents (DESIGN §4.2 "?")', () => {
  test('a "?" intent is revealed at the start of the player turn immediately preceding it', () => {
    const { state, events } = fightAt(one(C.flicker), {}, [], [D.d4(4), D.d4(1)]); // the Ranger 12, the Flicker 9: the player first
    const revealed = ofType(events, 'intentRevealed');
    expect(revealed.map((e) => [e.intent.moveId, e.intent.hidden])).toEqual([['t_flicker', true], ['t_flicker', false]]);
    expect(intentOf(state)?.hidden).toBe(false);
    expect(fightOf(state).log.at(-1)).toMatchObject({ text: "Test Flicker's intent clears: Flicker.", kind: 'intent' });
  });

  test('a faster creature\'s opening "?" strikes unseen; later ones are revealed while it will act before the player again — not while a player turn comes first', () => {
    const { state, events } = fightAt(one(C.flicker), {}, HIT(), [D.d4(1), D.d4(4)]); // the Flicker 12 acts first
    expect(ofType(events, 'intentRevealed').map((e) => [e.intent.moveId, e.intent.hidden])).toEqual([['t_flicker', true], ['t_jab', false]]);
    expect(ofType(events, 'damageDealt')[0]).toMatchObject({ refId: 't_flicker', damageType: 'chrono' });
    // a hidden intent of a creature now Slowed behind the player stays hidden: a player turn comes before it
    const ctx = scriptedCtx(state, [], pack, profile);
    const combat = fightOf(ctx.s);
    const foe = combat.enemies[0]!;
    Object.assign(combat.intents[foe.uid]!, { hidden: true });
    foe.statuses.push(inst(STATUS.slow, { duration: 2 })); // 12 − 5 = 7 < the Ranger's 9
    refreshIntents(ctx, combat);
    expect(combat.intents[foe.uid]?.hidden).toBe(true);
    foe.statuses = [];
    refreshIntents(ctx, combat);
    expect(combat.intents[foe.uid]?.hidden).toBe(false);
  });
});

// ---- Stun, interrupt ---------------------------------------------------------------------------------------------------------

describe('Stun and interrupt skip the step (DESIGN §4.2)', () => {
  test('replacement feedback respects a hidden next intent', () => {
    const { ctx, combat, foe } = setup(one(C.flicker));
    openingIntents(ctx, combat);
    combat.intents[foe.uid]!.hidden = false;
    foe.pattern.pointer = 0;
    expect(interruptIntent(ctx, combat, foe)).toBe(true);
    expect(combat.intents[foe.uid]?.hidden).toBe(true);
    expect(combat.log.at(-1)?.text).toBe('Test Flicker still acts: next is an unrevealed move.');
  });

  test('an interrupt explicitly names the replacement even when the pattern chooses the same move again', () => {
    const { ctx, combat, foe } = setup(one(C.cycle));
    openingIntents(ctx, combat);
    foe.pattern.pointer = 0;
    expect(interruptIntent(ctx, combat, foe)).toBe(true);
    expect(combat.intents[foe.uid]?.moveId).toBe('t_jab');
    expect(combat.log.at(-1)?.text).toBe('Test Cycle still acts: next is Jab.');
  });

  const stunned = (duration: number) => {
    const { state } = fightAt(one(C.cycle)); // opening Jab; the pointer is on Slam
    const ctx = scriptedCtx(state, [], pack, profile);
    const combat = fightOf(ctx.s);
    const foe = combat.enemies[0]!;
    applyStatus(ctx, combat, playerOf(combat), foe, STATUS.stun, { duration });
    expect(combat.intents).toEqual({});
    finishPlayerTurn(ctx, combat, playerOf(combat)); // its turn: lost, no draw
    expect(ctx.rng.queue).toEqual([]);
    return { ctx, combat, foe };
  };

  test('Stun: the intent is cancelled and the turn lost; then a fresh intent from the next step — the stunned Jab is skipped, not replayed', () => {
    const { ctx, combat, foe } = stunned(1);
    expect(combat.log.map((l) => l.text)).toContain('Test Cycle is stunned and loses the turn.');
    expect(combat.intents[foe.uid]?.moveId).toBe('t_slam');
    expect(foe.pattern).toMatchObject({ pointer: 2, turnsTaken: 1 });
    const next = act(ctx.s, guard, HIT());
    expect(ofType(next.events, 'damageDealt')[0]).toMatchObject({ refId: 't_slam' });
    expect(intentOf(next.state)?.moveId).toBe('t_roar');
  });

  test('a longer Stun: no intent while it stays stunned (the pointer holds), then the next step', () => {
    const { ctx, combat, foe } = stunned(2);
    expect(combat.intents).toEqual({});
    expect(foe.pattern.pointer).toBe(1);
    const next = act(ctx.s, guard, []); // stunned again: no draw
    expect(intentOf(next.state)?.moveId).toBe('t_slam');
    expect(foeOf(next.state).cooldowns).toEqual({ [STUN_RECOVERY_KEY]: 2 });
  });

  test('interrupt: cancels and generates from the next step at once (the creature still acts); refused when not interruptible or nothing is committed', () => {
    const { ctx, combat, foe } = setup(one(C.cycle));
    openingIntents(ctx, combat);
    expect(interruptIntent(ctx, combat, foe)).toBe(true);
    expect(combat.intents[foe.uid]?.moveId).toBe('t_slam');
    expect(combat.log.map((l) => l.text)).toContain("Test Cycle's Jab is interrupted.");
    expect(combat.log.at(-1)?.text).toBe('Test Cycle still acts: next is Slam.');
    expect(ofType(ctx.events, 'intentRevealed').map((e) => e.intent.moveId)).toEqual(['t_jab', 't_slam']);
    delete combat.intents[foe.uid];
    expect(interruptIntent(ctx, combat, foe)).toBe(false);
    const boss = setup(one(C.boss));
    openingIntents(boss.ctx, boss.combat);
    expect(interruptIntent(boss.ctx, boss.combat, boss.foe)).toBe(false);
    expect(boss.combat.intents[boss.foe.uid]?.moveId).toBe('t_roar');
    expect(boss.combat.log.at(-1)?.text).toBe('Test Boss cannot be staggered.');
    const tyrant = setup(one(TYRANT), { loop: 2 });
    openingIntents(tyrant.ctx, tyrant.combat);
    expect(interruptIntent(tyrant.ctx, tyrant.combat, tyrant.foe)).toBe(true); // Stagger
    expect(tyrant.combat.log.map((l) => l.text)).toContain('The Chronos Tyrant staggers: Speak is lost.');
    expect(tyrant.combat.log.at(-1)?.text).toBe('The Chronos Tyrant still acts: next is Time Lash.');
    expect(tyrant.combat.intents[tyrant.foe.uid]?.moveId).toBe('tyr_time_lash');
  });
});

// ---- wind-ups ------------------------------------------------------------------------------------------------------------------

describe('wind-up moves (`windUp`, tyr_gather → tyr_chrono_strike)', () => {
  const wound = () => {
    const { state } = fightAt(one(C.gatherer));
    expect(intentOf(state)).toMatchObject({ moveId: 't_gather', hidden: false, projected: [0, 0], tags: [TAG_WIND_UP] }); // revealed at the player's turn
    const one1 = act(state, guard, []); // Gather: no hit, no draw
    expect(foeOf(one1.state).cooldowns).toEqual({ [`${WIND_UP_KEY}t_gather`]: 2 });
    expect(intentOf(one1.state)).toMatchObject({ moveId: 't_gather', targetUid: meOf(state).uid, tags: [TAG_WIND_UP] });
    expect(fightOf(one1.state).log.map((l) => l.text)).toContain('Test Gatherer: It draws back like an arm.');
    const two = act(one1.state, guard, []);
    expect(foeOf(two.state).cooldowns).toEqual({ [`${WIND_UP_KEY}t_gather`]: 1 });
    return { start: state, mid: one1.state, ready: two.state };
  };

  test('the creature winds up for `turns` turns (the pointer holds), then `then` lands on the same target; its Stun row reads Guard when it lands', () => {
    const { start, ready } = wound();
    const crash = intentOf(ready)!;
    const spec = intentHitSpec('t_crash', pack.creatures[C.gatherer]!.moves.t_crash!, false)!;
    expect(crash).toMatchObject({ moveId: 't_crash', targetUid: meOf(start).uid, hidden: false, projected: damageRange({ s: ready, content: pack }, foeOf(ready), meOf(ready), spec) });
    const guarded = act(ready, guard, HIT());
    expect(ofType(guarded.events, 'damageDealt')[0]).toMatchObject({ refId: 't_crash' });
    expect(ofType(guarded.events, 'statusApplied')).toEqual([]); // Stun only unless the player Guarded
    expect(foeOf(guarded.state).cooldowns).toEqual({});
    expect(intentOf(guarded.state)?.moveId).toBe('t_jab'); // back on the pattern, past the Gather step
    const open = act(ready, { type: 'attack', targetUid: foeOf(ready).uid }, [...MISS, ...HIT(), ...MISS]); // the Ranger misses; Crash Stuns; the next Jab
    expect(ofType(open.events, 'statusApplied')).toEqual([{ t: 'statusApplied', targetUid: meOf(ready).uid, statusId: STATUS.stun, stacks: 1, duration: 1 }]);
    expect(fightOf(open.state).log.map((l) => l.text)).toContain(`${meOf(ready).name} is stunned and loses the turn.`);
  });

  test('Stun and interrupt break a wind-up: the pattern resumes from the next step', () => {
    const { mid } = wound();
    const ctx = scriptedCtx(mid, [], pack, profile);
    const combat = fightOf(ctx.s);
    applyStatus(ctx, combat, playerOf(combat), combat.enemies[0]!, STATUS.stun, { duration: 1 });
    finishPlayerTurn(ctx, combat, playerOf(combat));
    expect(combat.enemies[0]!.cooldowns).toEqual({ [STUN_RECOVERY_KEY]: 2 });
    expect(combat.intents[combat.enemies[0]!.uid]?.moveId).toBe('t_jab');
    const i = scriptedCtx(mid, [], pack, profile);
    expect(interruptIntent(i, fightOf(i.s), foeOf(i.s))).toBe(true);
    expect([foeOf(i.s).cooldowns, intentOf(i.s)?.moveId]).toEqual([{}, 't_jab']);
    // a cancelled intent (here: deleted by hand) also breaks it, and the creature holds still
    const h = scriptedCtx(mid, [], pack, profile);
    delete fightOf(h.s).intents[foeOf(h.s).uid];
    expect(executeIntent(h, fightOf(h.s), foeOf(h.s), applyHit)).toBeNull();
    expect([foeOf(h.s).cooldowns, fightOf(h.s).log.at(-1)?.text]).toEqual([{}, 'Test Gatherer holds still.']);
    // a countdown for a move the creature does not have is dropped, and the pattern goes on
    foeOf(h.s).cooldowns[`${WIND_UP_KEY}t_nothing`] = 2;
    expect([generateIntent(h, fightOf(h.s), foeOf(h.s))?.moveId, foeOf(h.s).cooldowns]).toEqual(['t_jab', {}]);
  });
});

// ---- execution -----------------------------------------------------------------------------------------------------------------

describe('execution (DESIGN §4.1 "Enemy turn", §4.2, §4.8)', () => {
  test('an area intent hits every living party member in party order, each with its own Guard; Phase does not stop it; rows per struck target', () => {
    const { state } = fightAt(one(aim('all')), withIlyra);
    const s = clone(state);
    fightOf(s).party[1]!.statuses.push(inst(STATUS.phase, { duration: 2 })); // outlasts Ilyra's own turn
    const [me, ilyra] = [meOf(s), fightOf(s).party[1]!];
    // the Ranger guards; Ilyra's strike misses; Sweep: Ranger hit + Weaken roll 10 (yes), Ilyra hit + roll 90 (no)
    const out = act(s, guard, [...MISS, ...HIT(), D.pct(10), ...HIT(), D.pct(90)]);
    const dealt = ofType(out.events, 'damageDealt');
    expect(dealt.map((e) => e.targetUid)).toEqual([me.uid, ilyra.uid]);
    expect(dealt.map((e) => e.amount)).toEqual([Math.round((10 - me.armor) * 0.5), 10 - ilyra.armor]); // variance 1.0: the Ranger's halved
    expect(ofType(out.events, 'statusApplied').map((e) => [e.targetUid, e.statusId])).toEqual([[me.uid, STATUS.weaken]]);
    expect(fightOf(out.state).party[1]!.statuses.map((st) => st.statusId)).toContain(STATUS.phase); // not consumed
  });

  test('a single-target attack on a Phased target misses and consumes the Phase (DESIGN §4.2)', () => {
    const { state } = fightAt(one(C.cycle));
    const s = clone(state);
    meOf(s).statuses.push(inst(STATUS.phase, { duration: 2 })); // outlasts the Ranger's own turn
    const out = act(s, guard, []); // hit% 0: no roll
    expect(ofType(out.events, 'attackResolved')).toEqual([{ t: 'attackResolved', sourceUid: foeOf(s).uid, targetUid: meOf(s).uid, hit: false, crit: false }]);
    expect(meOf(out.state).statuses).toEqual([]);
  });

  test('`power.hits` resolves each hit; it stops when the target falls', () => {
    const { state } = fightAt(one(C.flurry));
    const s = clone(state);
    Object.assign(meOf(s), { hp: 4, armor: 0 });
    const out = act(s, guard, [...HIT(), ...HIT()]); // 5 × 0.5 (Guard) = 2.5 → 3 each: 4 → 1 → 0
    expect(ofType(out.events, 'damageDealt').map((e) => e.amount)).toEqual([3, 3]);
    expect(out.state.combat?.phase).toBe('defeat');
  });

  test('self and ally moves: Shield (5 + 0.5·ATK), heal (variance draw), cleanse (debuffs only), an ally\'s Shield, a self status', () => {
    const run = (id: string, edit: (x: ReturnType<typeof setup>) => void = () => {}, draws: number[] = [], extra: string[] = []) => {
      const x = setup(one(id, ...extra));
      edit(x);
      openingIntents(x.ctx, x.combat);
      x.ctx.rng.queue.push(...draws);
      const played = executeIntent(x.ctx, x.combat, x.foe, applyHit);
      expect(x.ctx.rng.queue).toEqual([]);
      return { ...x, played };
    };
    const brace = run(C.brace);
    expect(brace.foe.statuses).toEqual([{ statusId: STATUS.shield, stacks: 1, duration: 3, sourceUid: brace.foe.uid, appliedOnOwnTurn: false, tick: 10 }]);
    expect(brace.combat.log.map((l) => l.text)).toContain('Test Brace: It braces.');
    const mend = run(C.mend, (x) => void (x.foe.hp = 30), [D.variance(1)]);
    expect(mend.foe.hp).toBe(40);
    expect(ofType(mend.ctx.events, 'healed')).toEqual([{ t: 'healed', targetUid: mend.foe.uid, amount: 10, source: 't_mend' }]);
    const purge = run(C.purge, (x) => void x.foe.statuses.push(inst(STATUS.weaken), inst(STATUS.shield, { tick: 4 }), inst(STATUS.mark)));
    expect(purge.foe.statuses.map((st) => st.statusId)).toEqual([STATUS.shield]);
    const shelter = run(C.shelter, (x) => void (x.combat.enemies[1]!.hp = 10), [], [BRUTE]);
    expect(shelter.played?.targetUid).toBe(shelter.combat.enemies[1]!.uid);
    expect(shelter.combat.enemies[1]!.statuses).toMatchObject([{ statusId: STATUS.shield, tick: 10 }]);
    const fade = run(SHADE, (x) => void (x.foe.pattern.pointer = 2, x.foe.hp = 10));
    expect(fade.played?.moveId).toBe('shade_fade');
    expect(fade.foe.statuses).toMatchObject([{ statusId: STATUS.phase, duration: 1 }]);
  });

  test('summon respects `max` (of that creature alive) and the three-enemy cap; adds get their first intent', () => {
    const x = setup(one(C.caller));
    openingIntents(x.ctx, x.combat);
    x.ctx.rng.queue.push(D.d4(2), D.d4(3)); // the adds' initiative
    executeIntent(x.ctx, x.combat, x.foe, applyHit);
    const pups = x.combat.enemies.slice(1);
    expect(pups.map((p) => [p.name, p.hp, p.hpMax, p.isAdd, p.initiative])).toEqual([['Test Pup', 10, 20, true, 3], ['Test Pup B', 10, 20, true, 4]]);
    expect(ofType(x.ctx.events, 'addsSummoned')).toEqual([{ t: 'addsSummoned', uids: pups.map((p) => p.uid) }]);
    expect(pups.map((p) => x.combat.intents[p.uid]?.moveId)).toEqual(['t_jab', 't_jab']);
    expect(x.ctx.s.counters.seen[PUP]).toBe(2);
    generateIntent(x.ctx, x.combat, x.foe);
    executeIntent(x.ctx, x.combat, x.foe, applyHit); // two alive = max: nothing
    expect([x.combat.enemies.length, x.combat.log.at(-1)?.text]).toEqual([3, "Nothing answers Test Caller's call."]);
    pups[0]!.alive = false;
    generateIntent(x.ctx, x.combat, x.foe);
    x.ctx.rng.queue.push(D.d4(1));
    executeIntent(x.ctx, x.combat, x.foe, applyHit); // one alive: room for one more (max 2, and 3 enemies alive at most)
    expect(x.combat.enemies.map((e) => e.name)).toEqual(['Test Caller', 'Test Pup', 'Test Pup B', 'Test Pup C']);
    expect(x.ctx.rng.queue).toEqual([]);
    const full = setup(one(C.caller, BRUTE, SHADE));
    openingIntents(full.ctx, full.combat);
    executeIntent(full.ctx, full.combat, full.foe, applyHit); // three enemies alive already
    expect(full.combat.enemies).toHaveLength(3);
  });

  test('revive: the first fallen ally stands up at hpPct with a new intent; nobody down → nothing', () => {
    const x = setup(one(C.raiser, BRUTE));
    const brute = x.combat.enemies[1]!;
    openingIntents(x.ctx, x.combat);
    Object.assign(brute, { alive: false, hp: 0, statuses: [inst(STATUS.bleed)] });
    delete x.combat.intents[brute.uid];
    executeIntent(x.ctx, x.combat, x.foe, applyHit);
    expect(brute).toMatchObject({ alive: true, hp: 32, statuses: [] });
    expect(x.combat.intents[brute.uid]?.moveId).toBe('brute_strike');
    generateIntent(x.ctx, x.combat, x.foe);
    executeIntent(x.ctx, x.combat, x.foe, applyHit);
    expect(x.combat.log.at(-1)?.text).toBe('Test Raiser calls, but no one is down.');
  });

  test('an unknown creature or move holds still; a creature with nothing to target or that is down gets no intent', () => {
    const { ctx, combat, foe } = setup(one(C.cycle));
    combat.intents[foe.uid] = { moveId: 't_nothing', targetUid: null, projected: [0, 0], hidden: false, text: '', tags: [] };
    expect(executeIntent(ctx, combat, foe, applyHit)).toBeNull();
    expect(combat.log.at(-1)?.text).toBe('Test Cycle holds still.');
    playerOf(combat).alive = false;
    expect(generateIntent(ctx, combat, foe)).toBeNull();
    expect(projectIntent(ctx, combat, foe, { moveId: 't_jab', targetUid: null, tags: [] })).toEqual([0, 0]);
    foe.refId = 'cr_unknown';
    playerOf(combat).alive = true;
    expect([generateIntent(ctx, combat, foe), patternOf(pack, foe)]).toEqual([null, []]);
  });
});

// ---- boss phases --------------------------------------------------------------------------------------------------------------

describe('boss phases read the active phase\'s pattern (DESIGN §4.10)', () => {
  test('phaseHold holds until the phase changes; `resetPattern` restarts on the new pattern; "**once in this phase**" (oncePerFight is step-scoped)', () => {
    const { ctx, combat, foe } = setup(one(C.boss));
    const next = (): string => {
      combat.round = foe.pattern.turnsTaken + 1;
      generateIntent(ctx, combat, foe);
      foe.pattern.turnsTaken += 1;
      return short(combat.intents[foe.uid]?.moveId);
    };
    expect([next(), next(), next(), next(), next()]).toEqual(words('roar brace jab — —'));
    expect(foe.pattern.pointer).toBe(3); // on the hold
    foe.phase = 1;
    expect(short(resetPattern(ctx, combat, foe)?.moveId)).toBe('brace');
    foe.pattern.turnsTaken += 1;
    expect([next(), next(), next()]).toEqual(words('slam slam slam'));
    expect(foe.pattern.firedOnce).toEqual(['0:1', '1:0']);
    expect(foe.pattern.phaseEnteredRound).toBe(5);
  });

  test('the fixture Tyrant: Movement I opens with Speak (first), then its rotation; Movement II reads `everyNth 3`, else one weighted draw', () => {
    expect(plan(TYRANT, 5, { state: { loop: 2 } })).toEqual(words('speak time_lash grasp shear time_lash'));
    const { ctx, combat, foe } = setup(one(TYRANT), { loop: 2 });
    foe.phase = 1;
    foe.pattern.turnsTaken = 2;
    expect(resetPattern(ctx, combat, foe)?.moveId).toBe('tyr_remember'); // its 3rd turn
    foe.pattern.turnsTaken = 3;
    ctx.rng.queue.push(0.99);
    expect(generateIntent(ctx, combat, foe)).toMatchObject({ moveId: 'tyr_shear', targetUid: null, tags: [TAG_ALL] });
    expect(ctx.rng.queue).toEqual([]);
  });
});

// ---- WORLD §6 cadence words -------------------------------------------------------------------------------------------------

describe('WORLD §6 cadence words (DESIGN §4.2 mapping)', () => {
  CADENCE.forEach((row, i) => {
    test(`"${row.words}"`, () => {
      expect(plan(cadenceId(i), row.turns ?? 6, row)).toEqual(words(row.expect));
    });
  });

  test('the gated rows fall back without their gate: no flag → no opening roar; no ally → no slam; nobody marked → no slam', () => {
    const at = (words: string) => CADENCE.findIndex((r) => r.words.startsWith(words));
    expect(plan(cadenceId(at('first; **only**')), 3)).toEqual(['jab', 'jab', 'jab']);
    expect(plan(cadenceId(at('ifAllyPresent')), 3)).toEqual(['jab', 'jab', 'jab']);
    expect(plan(cadenceId(at('ifTargetHas:mark')), 3)).toEqual(['jab', 'jab', 'jab']);
  });
});
