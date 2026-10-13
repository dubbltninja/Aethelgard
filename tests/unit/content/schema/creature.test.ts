// U16: CreatureSchema (PLAN §5.4) — DESIGN §4.12's creatures and both Tyrants (DESIGN §4.10–4.11) parse; CombatWhen,
// pattern steps, phase triggers and communion validate; per-record rules fail with messages that name the problem.
import { describe, expect, test } from 'bun:test';
import type { z } from 'zod';
import {
  COMBAT_WHEN_KEYS,
  CombatWhenSchema,
  CreatureSchema,
  MoveSchema,
  PhaseAddSchema,
  StepSchema,
  TriggerSchema,
  walkSteps,
  type CombatWhen,
  type CombatWhenAtoms,
  type Step,
} from '@schema/creature';
import { corruptedShade, tyrantContained, tyrantUnveiled, wildlingBrute } from './creature.fixtures';

const issues = (schema: z.ZodTypeAny, value: unknown): string[] => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

/** A deep copy of `base` with each `[path, value]` edit applied (`undefined` deletes the key). */
function patched(base: unknown, ...edits: [path: (string | number)[], value: unknown][]): unknown {
  const copy = structuredClone(base);
  for (const [path, value] of edits) {
    let node = copy as Record<string | number, unknown>;
    for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
    const last = path[path.length - 1] as string | number;
    if (value === undefined) delete node[last];
    else node[last] = value;
  }
  return copy;
}

const creatureIssues = (value: unknown) => issues(CreatureSchema, value);
const expectIssue = (value: unknown, path: string, fragment: string) => {
  const found = creatureIssues(value);
  expect(found.some((i) => i.startsWith(`${path}: `) && i.includes(fragment)), `wanted "${path}: …${fragment}…", got ${JSON.stringify(found)}`).toBe(true);
};

describe('DESIGN §4.12 worked-example creatures parse', () => {
  test('Wildling Brute', () => {
    const brute = CreatureSchema.parse(wildlingBrute);
    expect(brute.stats).toEqual({ hp: 64, atk: 11, sp: 0, armor: 3, ward: 0, agi: 3 });
    expect(brute.pattern).toHaveLength(4);
    expect(brute.phases).toEqual([]);
    expect(brute.fleeable).toBe(true);
    expect(brute.moves.brute_maul?.power).toEqual({ base: 0, coef: 1.6, stat: 'atk', hits: 1 });
    expect(brute.moves.brute_root_knit?.statuses[0]).toMatchObject({ status: 'status_regen', duration: 2, target: 'self', power: { base: 3, coef: 0 } });
  });

  test('Corrupted Shade (spell Wail, poison-immune, first-kill spellbook loot)', () => {
    const shade = CreatureSchema.parse(corruptedShade);
    expect(shade.moves.shade_wail).toMatchObject({ type: 'void', spell: true, statuses: [{ status: 'status_weaken', chance: 0.5, duration: 2 }] });
    expect(shade.moves.shade_rake?.spell).toBe(false);
    expect(shade.statusImmunities).toEqual(['status_poison']);
    expect(shade.loot.map((l) => l.chance)).toEqual([1, 0.5, 0.8]);
  });
});

describe('Chronos Tyrants (DESIGN §4.10, §4.11) parse', () => {
  test('Contained: three phases, OR-list trigger, adds, P3 ×1.5', () => {
    const t = CreatureSchema.parse(tyrantContained);
    expect(t.stats).toEqual({ hp: 460, atk: 24, sp: 26, armor: 6, ward: 8, agi: 4 });
    expect(t.phases.map((p) => p.id)).toEqual(['tyr_movement_1', 'tyr_movement_2', 'tyr_movement_3']);
    expect(t.phases[0]?.enterWhen).toEqual([]);
    expect(t.phases[2]?.enterWhen).toEqual([{ hpBelow: 0.33 }, { round: 12 }]);
    expect(t.phases[1]?.adds).toEqual([{ creatureId: 'cr_temporal_aberration', count: 2, countSolo: 1, hpPct: 0.4 }]);
    expect(t.phases[2]?.damageTakenMult).toBe(1.5);
    expect(t.phases[0]?.damageDealtRampPerRound).toBe(0);
    expect(t.pattern).toEqual([]);
    expect(t.moves.tyr_gather).toMatchObject({ hidden: true, windUp: { turns: 2, then: 'tyr_chrono_strike' } });
    expect(t.moves.tyr_chrono_strike?.statuses[0]?.when).toEqual({ playerGuarding: false });
    expect(t.communion).toBeUndefined();
  });

  test('Unveiled: four phases, reinforcing adds, Phase 4 ramp, communion Movements', () => {
    const t = CreatureSchema.parse(tyrantUnveiled);
    expect(t.phases.map((p) => p.id)).toEqual(['tyr_movement_1', 'tyr_movement_2', 'tyr_movement_3', 'tyr_phase_4']);
    expect(t.phases[3]?.enterWhen).toEqual([{ hpBelow: 0.25 }, { round: 20 }]);
    expect(t.phases[3]?.damageDealtRampPerRound).toBe(0.1);
    expect(t.phases[1]?.adds[0]).toEqual({ creatureId: 'cr_tyrants_reach', count: 2, hpPct: 1, reinforce: { maxAlive: 2, total: 5 } });
    const c = t.communion;
    expect(c?.pressMove).toBe('tyr_hour_presses');
    expect(c?.movements.map((m) => m.questions.length)).toEqual([3, 6, 1]);
    expect(c?.movements[0]?.questions[0]?.answers.find((a) => a.lie)).toMatchObject({ resolve: -2, lie: true });
    expect(c?.offers.map((o) => o.resolve)).toEqual([1, 1, 2, -2]);
    expect(c?.outcomes.map((o) => o.minResolve)).toEqual([3, 6, 8]);
    expect(t.moves.tyr_hour_presses?.special).toBe('hour_presses');
  });
});

describe('CombatWhen (DESIGN §4.2)', () => {
  const VALID: { [K in keyof CombatWhenAtoms]: CombatWhen[] } = {
    all: [{ all: [] }, { all: [{ hpBelow: 0.5 }, { echo: 'echo_tyrant_speaks' }] }],
    any: [{ any: [{ selfHas: 'status_phase' }, { targetHasActed: false }] }],
    not: [{ not: { playerGuarding: true } }],
    hpBelow: [{ hpBelow: 0.7 }, { hpBelow: 1 }],
    roundAtLeast: [{ roundAtLeast: 4 }],
    allyCountBelow: [{ allyCountBelow: 2 }],
    allyPresent: [{ allyPresent: true }, { allyPresent: 'cr_tyrants_reach' }],
    targetHas: [{ targetHas: 'status_soaked' }],
    selfHas: [{ selfHas: 'status_shield' }],
    everyNth: [{ everyNth: 3 }],
    first: [{ first: true }],
    oncePerFight: [{ oncePerFight: true }],
    playerGuarding: [{ playerGuarding: false }],
    targetIsBoss: [{ targetIsBoss: true }],
    targetHasActed: [{ targetHasActed: false }],
  };

  test.each(COMBAT_WHEN_KEYS.map((k) => [k]))('%s parses', (key) => {
    for (const sample of VALID[key]) expect(issues(CombatWhenSchema, sample)).toEqual([]);
  });

  test('world Condition atoms are accepted (DESIGN: `if: CombatWhen | Condition`)', () => {
    expect(issues(CombatWhenSchema, { loop: { min: 2 } })).toEqual([]);
    expect(issues(CombatWhenSchema, { any: [{ corruption: { min: 3 } }, { hpBelow: 0.3 }] })).toEqual([]);
    expect(issues(CombatWhenSchema, { flag: 'not_a_flag' })[0]).toContain('flag: expected an id with prefix flag_');
  });

  test('bad atoms fail with the atom named', () => {
    expect(issues(CombatWhenSchema, { hpbelow: 0.5 })[0]).toContain("unknown combat condition atom 'hpbelow'");
    expect(issues(CombatWhenSchema, { hpBelow: 0 })).toEqual(['hpBelow: hpBelow is a fraction of max HP in (0, 1]']);
    expect(issues(CombatWhenSchema, { hpBelow: 1.5 })).toEqual(['hpBelow: hpBelow is a fraction of max HP in (0, 1]']);
    expect(issues(CombatWhenSchema, { everyNth: 1 })[0]).toContain('`everyNth` is ≥ 2');
    expect(issues(CombatWhenSchema, { targetHas: 'mark' })[0]).toContain('targetHas: expected an id with prefix status_');
    expect(issues(CombatWhenSchema, { allyPresent: 'wisp' })).toHaveLength(1);
    expect(issues(CombatWhenSchema, { first: true, everyNth: 2 })[0]).toContain('exactly one key');
  });
});

describe('pattern steps', () => {
  const steps: Step[] = [
    { move: 'm', target: 'player' },
    { move: 'm', target: 'lowest_hp', when: { everyNth: 2 } },
    { if: { hpBelow: 0.5 }, then: [{ move: 'm', target: 'self' }] },
    { weighted: [{ w: 2, step: { move: 'm', target: 'random' } }, { w: 1, step: { repeat: [{ move: 'm', target: 'all' }], times: 2 } }] },
    { repeat: [{ move: 'm', target: 'player' }], times: 3 },
    { phaseHold: true },
  ];

  test('every step kind parses', () => {
    for (const s of steps) expect(issues(StepSchema, s)).toEqual([]);
  });

  test('a step needs exactly one kind key; errors keep the nested path', () => {
    expect(issues(StepSchema, { target: 'player' })[0]).toContain('a pattern step has exactly one of move, if, weighted, repeat, phaseHold; got keys target');
    expect(issues(StepSchema, { move: 'm', target: 'player', repeat: [] })[0]).toContain('got move and repeat');
    expect(issues(StepSchema, 'strike')[0]).toContain('a pattern step is an object');
    expect(issues(StepSchema, { if: { hpBelow: 0.5 }, then: [{ move: 'm', target: 'boss' }] })[0]).toMatch(/^then\.0\.target: /);
    expect(issues(StepSchema, { if: { hpBelow: 0.5 }, then: [] })[0]).toMatch(/^then: /);
    expect(issues(StepSchema, { weighted: [{ w: 0, step: { move: 'm', target: 'player' } }] })[0]).toMatch(/^weighted\.0\.w: /);
    expect(issues(StepSchema, { repeat: [{ move: 'm', target: 'player' }], times: 0 })[0]).toMatch(/^times: /);
  });

  test('walkSteps visits nested steps with their paths', () => {
    const seen: string[] = [];
    walkSteps(steps, ['pattern'], (s, p) => {
      if ('move' in s) seen.push(p.join('.'));
    });
    expect(seen).toEqual(['pattern.0', 'pattern.1', 'pattern.2.then.0', 'pattern.3.weighted.0.step', 'pattern.3.weighted.1.step.repeat.0', 'pattern.4.repeat.0']);
  });
});

describe('phase triggers (OR-list atoms)', () => {
  test('valid triggers parse', () => {
    for (const t of [{ hpBelow: 0.66 }, { round: 12 }, { event: 'addsDead' }, { event: 'communionMovementEnd' }, { resolveAtLeast: 8 }]) {
      expect(issues(TriggerSchema, t)).toEqual([]);
    }
  });

  test('out-of-range triggers fail', () => {
    expect(issues(TriggerSchema, { hpBelow: 1.2 })).toEqual(['hpBelow: hpBelow is a fraction of max HP in (0, 1)']);
    expect(issues(TriggerSchema, { hpBelow: 0 })).toEqual(['hpBelow: hpBelow is a fraction of max HP in (0, 1)']);
    expect(issues(TriggerSchema, { round: 0 })).toEqual(['round: round triggers count rounds from 1']);
    expect(issues(TriggerSchema, { resolveAtLeast: 9 })).toEqual(['resolveAtLeast: Resolve is an integer 0–8 (D-054)']);
    expect(issues(TriggerSchema, { resolveAtLeast: -1 })).toEqual(['resolveAtLeast: Resolve is an integer 0–8 (D-054)']);
    expect(issues(TriggerSchema, { event: 'bossDead' })).toHaveLength(1);
    expect(issues(TriggerSchema, { hp: 0.5 })[0]).toContain("unknown phase trigger atom 'hp'");
  });
});

describe('invalid creatures fail with clear messages', () => {
  test('a pattern step referencing an unknown move id', () => {
    expectIssue(patched(wildlingBrute, [['pattern', 1], { move: 'brute_bite', target: 'player' }]), 'pattern.1.move', "pattern references unknown move 'brute_bite'");
    const nested = patched(tyrantUnveiled, [['phases', 1, 'pattern', 0, 'else', 0, 'weighted', 2, 'step', 'move'], 'tyr_sheer']);
    expectIssue(nested, 'phases.1.pattern.0.else.0.weighted.2.step.move', "unknown move 'tyr_sheer'");
  });

  test('a phase trigger out of range', () => {
    expectIssue(patched(tyrantContained, [['phases', 1, 'enterWhen'], [{ hpBelow: 1.2 }]]), 'phases.1.enterWhen.0.hpBelow', 'fraction of max HP in (0, 1)');
    expectIssue(patched(tyrantContained, [['phases', 2, 'enterWhen', 1], { round: 0 }]), 'phases.2.enterWhen.1.round', 'count rounds from 1');
    expectIssue(patched(tyrantContained, [['phases', 2, 'enterWhen', 1], { resolveAtLeast: 9 }]), 'phases.2.enterWhen.1.resolveAtLeast', 'Resolve is an integer 0–8');
  });

  test('Resolve outside 0–8', () => {
    expectIssue(patched(tyrantUnveiled, [['communion', 'outcomes', 2, 'minResolve'], 9]), 'communion.outcomes.2.minResolve', 'Resolve is an integer 0–8 (D-054)');
    expectIssue(patched(tyrantUnveiled, [['communion', 'outcomes', 0, 'minResolve'], -1]), 'communion.outcomes.0.minResolve', 'Resolve is an integer 0–8 (D-054)');
    expect(creatureIssues(patched(tyrantUnveiled, [['communion', 'movements', 1, 'questions', 5, 'answers', 0, 'resolve'], 9]))).toHaveLength(1);
  });

  test('phase order: first phase untriggered, later phases triggered, thresholds monotone, ids unique', () => {
    expectIssue(patched(tyrantContained, [['phases', 0, 'enterWhen'], [{ round: 1 }]]), 'phases.0.enterWhen', 'has no enterWhen triggers');
    expectIssue(patched(tyrantContained, [['phases', 1, 'enterWhen'], []]), 'phases.1.enterWhen', 'needs at least one enterWhen trigger');
    expectIssue(patched(tyrantContained, [['phases', 2, 'enterWhen', 0], { hpBelow: 0.7 }]), 'phases.2.enterWhen', 'hpBelow triggers must strictly decrease');
    expectIssue(patched(tyrantUnveiled, [['phases', 2, 'enterWhen'], [{ hpBelow: 0.5 }, { round: 25 }]]), 'phases.3.enterWhen', 'round triggers must strictly increase');
    expectIssue(patched(tyrantContained, [['phases', 2, 'enterWhen'], [{ hpBelow: 0.3 }, { hpBelow: 0.2 }]]), 'phases.2.enterWhen', 'at most one hpBelow');
    expectIssue(patched(tyrantContained, [['phases', 2, 'enterWhen'], [{ round: 3 }, { round: 4 }]]), 'phases.2.enterWhen', 'at most one round');
    expectIssue(patched(tyrantContained, [['phases', 2, 'id'], 'tyr_movement_2']), 'phases.2.id', "duplicate phase id 'tyr_movement_2'");
  });

  test('boss rules: 2–4 phases, not fleeable; only bosses have phases; pattern xor phases', () => {
    const contained = tyrantContained as { phases: unknown[] };
    expectIssue(patched(tyrantContained, [['phases'], contained.phases.slice(0, 1)]), 'phases', 'a boss has 2–4 phases; got 1');
    expectIssue(patched(tyrantUnveiled, [['phases', 4], { ...(tyrantUnveiled.phases[3] as object), id: 'tyr_phase_5', enterWhen: [{ hpBelow: 0.1 }] }]), 'phases', 'got 5');
    expectIssue(patched(tyrantContained, [['fleeable'], true]), 'fleeable', 'bosses cannot be fled');
    expectIssue(patched(wildlingBrute, [['phases'], contained.phases]), 'phases', "only bosses have phases (role is 'fodder')");
    expectIssue(patched(tyrantContained, [['pattern'], [{ move: 'tyr_grasp', target: 'player' }]]), 'pattern', 'leave `pattern` empty');
    expectIssue(patched(wildlingBrute, [['pattern'], []]), 'pattern', 'needs a pattern with at least one step');
    expectIssue(patched(wildlingBrute, [['moves'], {}], [['pattern'], []]), 'moves', 'at least one move');
    expectIssue(patched(wildlingBrute, [['pattern', 0], { phaseHold: true }]), 'pattern.0', '`phaseHold` is only meaningful inside a boss phase');
  });

  test('wind-ups, press move and communion structure', () => {
    expectIssue(patched(tyrantContained, [['moves', 'tyr_gather', 'windUp', 'then'], 'tyr_chrono_smite']), 'moves.tyr_gather.windUp.then', "unknown move 'tyr_chrono_smite'");
    expectIssue(patched(tyrantContained, [['moves', 'tyr_gather', 'windUp', 'then'], 'tyr_gather']), 'moves.tyr_gather.windUp.then', 'winds up into itself');
    expectIssue(patched(tyrantUnveiled, [['communion', 'pressMove'], 'tyr_hour_pushes']), 'communion.pressMove', "unknown move 'tyr_hour_pushes'");
    expectIssue(patched(tyrantContained, [['communion'], tyrantUnveiled.communion], [['phases', 2, 'id'], 'tyr_nine_speak']), 'communion', 'missing phase(s) tyr_movement_3');
    const swapped = patched(tyrantUnveiled, [['communion', 'movements', 0, 'id'], 'tyr_movement_2'], [['communion', 'movements', 1, 'id'], 'tyr_movement_1']);
    expectIssue(swapped, 'communion.movements.0.id', 'Movement 1 must be tyr_movement_1');
    expectIssue(patched(tyrantUnveiled, [['communion', 'movements'], tyrantUnveiled.communion.movements.slice(0, 2)]), 'communion.movements', 'exactly three Movements');
    expectIssue(patched(tyrantUnveiled, [['communion', 'movements', 2, 'questions', 0, 'id'], 'tyr_q_why']), 'communion.movements.2.questions.0.id', 'duplicate question id tyr_q_why');
    expectIssue(patched(tyrantUnveiled, [['communion', 'movements', 0, 'questions', 0, 'answers', 1, 'id'], 'jailer']), 'communion.movements.0.questions.0.answers.1.id', 'duplicate answer id');
    expectIssue(patched(tyrantUnveiled, [['communion', 'offers', 1, 'itemId'], 'item_chronos_lens']), 'communion.offers.1.itemId', 'offered once');
    expectIssue(patched(tyrantUnveiled, [['communion', 'outcomes', 1, 'choiceId'], 'let_pass']), 'communion.outcomes.1.choiceId', 'duplicate outcome choiceId');
    expectIssue(patched(tyrantUnveiled, [['communion', 'movements', 0, 'questions', 0, 'id'], 'q_why']), 'communion.movements.0.questions.0.id', 'prefix tyr_q_');
    expectIssue(patched(tyrantUnveiled, [['communion', 'opensWith'], []]), 'communion.opensWith', '');
  });

  test('combat-scope effects stay in combat data (D-069.9)', () => {
    expectIssue(patched(wildlingBrute, [['onDefeat'], [{ leaveCombat: true }]]), 'onDefeat.0', "'leaveCombat' is a combat-scope effect");
    expectIssue(patched(tyrantUnveiled, [['communion', 'outcomes', 0, 'effects'], [{ multiHit: { hits: 2 } }]]), 'communion.outcomes.0.effects.0', 'combat-scope');
    expectIssue(patched(tyrantUnveiled, [['communion', 'offers', 0, 'effects'], [{ stripBuffs: { kinds: ['shield'] } }]]), 'communion.offers.0.effects.0', 'combat-scope');
    expectIssue(patched(wildlingBrute, [['moves', 'brute_maul', 'effects'], [{ surviveRounds: { rounds: 3 } }]]), 'moves.brute_maul.effects.0', 'not in a move');
    expectIssue(patched(tyrantContained, [['phases', 1, 'onEnter'], [{ surviveRounds: { rounds: 10 } }]]), 'phases.1.onEnter.0', 'only legal in a boss’s first phase');
    // The Unraveling Tide shape: survival in the first phase is fine; other combat atoms are fine in moves and onEnter.
    const tide = patched(tyrantContained, [['phases', 0, 'onEnter'], [{ surviveRounds: { rounds: 10, line: 'The Tide passes.' } }]], [['moves', 'tyr_grasp', 'effects'], [{ healOnDamage: { pct: 0.5 } }]]);
    expect(creatureIssues(tide)).toEqual([]);
  });

  test('moves: power needs a type, summon bounds, specials by scope', () => {
    expect(issues(MoveSchema, { name: 'Bite', line: 'It bites.', power: { coef: 1, stat: 'atk' } })).toEqual(['type: a move with power needs a damage type (absent type = non-damaging)']);
    expect(issues(MoveSchema, { name: 'Call', line: 'It calls.', summon: { creatureId: 'cr_horde_husk', count: 2, max: 1 } })).toEqual(['summon.max: summon.max must be ≥ summon.count']);
    expect(issues(MoveSchema, { name: 'X', line: 'x', special: 'hour_presses' })).toEqual([]);
    expect(issues(MoveSchema, { name: 'X', line: 'x', special: 'mark_execute' })[0]).toContain("special 'mark_execute' is not usable on a move");
    expect(issues(MoveSchema, { name: 'X', line: 'x', special: 'explode' })[0]).toContain('unknown special "explode" for a move');
    expect(issues(MoveSchema, { name: 'X', line: 'x', windUp: { turns: 4, then: 'y' } })[0]).toMatch(/^windUp\.turns: /);
    expect(issues(MoveSchema, { name: 'X', line: 'x', statuses: [{ status: 'status_stun', when: { hpbelow: 1 } }] })[0]).toContain("statuses.0.when.hpbelow: unknown combat condition atom 'hpbelow'");
    expect(issues(MoveSchema, { name: 'X', line: 'x', damage: 3 })[0]).toContain('Unrecognized key');
  });

  test('adds: countSolo and reinforce bounds', () => {
    expect(issues(PhaseAddSchema, { creatureId: 'cr_horde_husk', count: 1, countSolo: 2 })).toEqual(['countSolo: countSolo must be ≤ count']);
    expect(issues(PhaseAddSchema, { creatureId: 'cr_horde_husk', count: 2, reinforce: { maxAlive: 1, total: 1 } })).toEqual([
      'reinforce.maxAlive: reinforce.maxAlive must be ≥ count',
      'reinforce.total: reinforce.total must be ≥ count',
    ]);
  });

  test('ids, prefixes, strictness, gold', () => {
    expectIssue(patched(wildlingBrute, [['id'], 'wildling_brute']), 'id', 'prefix cr_');
    expectIssue(patched(wildlingBrute, [['family'], 'wilds']), 'family', 'prefix fam_');
    expectIssue(patched(wildlingBrute, [['loot', 0, 'itemId'], 'tonic']), 'loot.0.itemId', 'item_ or mat_');
    expectIssue(patched(wildlingBrute, [['hp'], 64]), '', 'Unrecognized key');
    expectIssue(patched(wildlingBrute, [['gold'], { min: 20, max: 10 }]), 'gold', 'gold.min must be ≤ gold.max');
    expectIssue(patched(wildlingBrute, [['resistances'], { holy: 'weak' }]), 'resistances.holy', '');
  });

  test('malformed nested data reports issues instead of throwing', () => {
    const broken = patched(
      tyrantContained,
      [['phases', 1, 'pattern', 0], { if: { hpBelow: 0.5 }, then: 'tyr_grasp' }],
      [['phases', 2, 'enterWhen', 1], 'round 12'],
      [['phases', 2, 'onEnter'], [null]],
      [['phases', 1, 'pattern', 1], { weighted: 'no' }],
      [['phases', 1, 'pattern', 2], { repeat: 'no', times: 1 }],
      [['phases', 1, 'pattern', 3], { weighted: [7] }],
    );
    expect(() => CreatureSchema.safeParse(broken)).not.toThrow();
    expect(creatureIssues(broken).length).toBeGreaterThanOrEqual(5);
  });
});
