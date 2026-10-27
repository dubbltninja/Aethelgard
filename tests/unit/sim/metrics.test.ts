// U39: the metrics and the target rows (PLAN §7.5; DESIGN §19, PLAN §1.2). Each row is driven by synthetic runs through its
// pass, fail, thin-sample and "n/a — needs …" paths; the statistics helpers and the summary tables are checked on the way.
import { describe, expect, test } from 'bun:test';
import { TRUE_ENDING_IDS } from '@schema/ending';
import {
  CONTAINED_TYRANT,
  UNVEILED_TYRANT,
  computeMetrics,
  dist,
  isBlockerRun,
  mean,
  median,
  percentile,
  sum,
  targetRow,
  tyrantCells,
  type BatchRun,
  type DeterminismSummary,
  type Metrics,
  type TargetRow,
} from '@sim/metrics';
import { storyPack } from '@tests/fixtures/storyContent';
import { batchRun, blankFight, blankLoop, blankResult, many } from './helpers';

const story = storyPack();
const compute = (runs: readonly BatchRun[], content = story, determinism: DeterminismSummary | null = null): Metrics => computeMetrics({ pack: 'p', content, runs, determinism });
const row = (m: Metrics, id: number | string): TargetRow => m.targets.find((t) => t.row === id) as TargetRow;
const SHADE = 'cr_corrupted_shade';
const ABERRATION = 'cr_temporal_aberration';
const BELL = 'cr_fixture_bell';

describe('statistics', () => {
  test('sum, mean, median (odd, even, empty), percentile (nearest rank), dist', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(mean([])).toBe(0);
    expect(mean([1, 2, 6])).toBe(3);
    expect(median([])).toBe(0);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(percentile([], 90)).toBe(0);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([7], 0)).toBe(7);
    expect(dist([])).toEqual({ n: 0, min: 0, median: 0, p90: 0, max: 0 });
    expect(dist([3, 1, 2])).toEqual({ n: 3, min: 1, median: 2, p90: 3, max: 3 });
  });
});

describe('targetRow folds its checks', () => {
  const ok = (good: boolean | null, text: string): { ok: boolean | null; text: string } => ({ ok: good, text });
  test('pass, fail, partial and n/a', () => {
    expect(targetRow(1, 'x', 't', [ok(true, 'a'), ok(true, 'b')])).toMatchObject({ status: 'pass', pass: true, detail: 'a; b', valueText: '—' });
    expect(targetRow(1, 'x', 't', [ok(true, 'a'), ok(false, 'b')])).toMatchObject({ status: 'fail', pass: false, detail: 'a; FAIL b' });
    expect(targetRow(1, 'x', 't', [ok(true, 'a'), ok(null, 'needs c')])).toMatchObject({ status: 'partial', pass: null, detail: 'a; not measured: needs c' });
    expect(targetRow(1, 'x', 't', [ok(null, 'needs c'), ok(null, 'needs d')])).toMatchObject({ status: 'n/a', pass: null, detail: 'n/a — needs c; needs d', valueText: '—' });
    expect(targetRow(1, 'x', 't', [ok(false, 'a'), ok(null, 'needs c')]).status).toBe('fail');
  });
  test('a value and its text; a thin sample is carried along', () => {
    expect(targetRow(2, 'x', 't', [ok(true, 'a')], { value: 3 })).toMatchObject({ value: 3, valueText: '3' });
    expect(targetRow(2, 'x', 't', [ok(true, 'a')], { value: 2.25 }).valueText).toBe('2.3');
    expect(targetRow(2, 'x', 't', [ok(true, 'a')], { value: 3, valueText: 'three', sample: { n: 1, required: 5 } })).toMatchObject({ valueText: 'three', sample: { n: 1, required: 5 } });
  });
});

describe('the table has every row', () => {
  test('DESIGN §19 rows 1–20 and the gates G1–G6, in order', () => {
    const m = compute([]);
    expect(m.targets.map((t) => t.row)).toEqual([...Array.from({ length: 20 }, (_, i) => i + 1), 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
    expect(m.runs).toBe(0);
    // an empty batch measures nothing: no row passes by default
    expect(m.targets.filter((t) => t.status === 'pass').map((t) => t.row)).toEqual(['G3', 7].reverse().filter((r) => r === 7 || r === 'G3'));
  });
});

describe('row 1 and G2: the Escape rate', () => {
  const escapes = (n: number, total: number, classId: string, bot: string): BatchRun[] =>
    many(total, (i) => blankResult({ classId, bot, seed: `s:${i}`, loops: [blankLoop(i < n ? { outcome: 'closer_escape' } : { outcome: 'closer_fall', reason: 'expiry' })] }));

  test('n/a without melee or caster runs', () => {
    const r = row(compute(many(3, (i) => blankResult({ bot: 'explorer', seed: `s:${i}` }))), 1);
    expect(r).toMatchObject({ status: 'n/a', detail: 'n/a — needs melee or caster runs' });
  });

  test('the better of the two bots counts per class; the worst class is the value; a thin sample is marked', () => {
    const m = compute([...escapes(3, 10, 'ranger', 'melee'), ...escapes(7, 10, 'ranger', 'caster'), ...escapes(5, 10, 'wizard', 'melee')]);
    expect(row(m, 1)).toMatchObject({ status: 'fail', valueText: 'worst class 50%', sample: { n: 10, required: 200 } });
    expect(row(m, 1).detail).toContain('ranger 70% (melee 30%, caster 70%)');
    expect(row(m, 'G2')).toMatchObject({ status: 'fail', name: 'Loop 1 completion' });
  });

  test('passes at 60 % and has no thin-sample mark at N ≥ 200', () => {
    const m = compute(escapes(120, 200, 'ranger', 'melee'));
    expect(row(m, 1)).toMatchObject({ status: 'pass', value: 0.6 });
    expect(row(m, 1).sample).toBeUndefined();
  });
});

describe('row 2: no ability dominates its class', () => {
  const dmg = (damageBySource: Record<string, number>): BatchRun[] => [batchRun(blankResult({ damageBySource }))];
  test('n/a without damage, and without a single ability cast', () => {
    expect(row(compute([batchRun(blankResult())]), 2)).toMatchObject({ status: 'n/a' });
    expect(row(compute(dmg({ basic: 90, 'gear:item_x': 10 })), 2)).toMatchObject({ status: 'n/a', detail: 'n/a — needs runs that cast abilities' });
  });
  test('the largest ability share against 35 %', () => {
    expect(row(compute(dmg({ rgr_marked_shot: 30, basic: 70 })), 2)).toMatchObject({ status: 'pass', valueText: '30.0%' });
    const bad = row(compute(dmg({ rgr_marked_shot: 60, basic: 40 })), 2);
    expect(bad).toMatchObject({ status: 'fail', valueText: '60.0%' });
    expect(bad.detail).toContain("rgr_marked_shot 60.0% of ranger's damage");
  });
});

describe('row 3: difficulty is monotone across the bands', () => {
  const fights = (regionId: string, n: number, rounds: number, defeats = 0): ReturnType<typeof blankFight>[] =>
    // U82: row 3 is measured inside the band (D-149): the player stands at a level the region's band holds
    Array.from({ length: n }, (_, i) => blankFight({ regionId, rounds, result: i < defeats ? 'defeat' : 'victory', playerLevel: story.regions[regionId]?.levelBand.min ?? 3 }));
  const run = (...groups: ReturnType<typeof blankFight>[][]): BatchRun[] => [batchRun(blankResult({ fights: groups.flat() }))];

  test('n/a with fewer than two bands that have enough fights', () => {
    expect(row(compute(run(fights('region_silverwood_ruins', 9, 4))), 3).detail).toBe('n/a — needs in-band fights in at least 2 level bands (5+ each; found 1)');
    expect(row(compute(run(fights('region_silverwood_ruins', 9, 4), fights('region_glowlands_nexus', 2, 9))), 3).status).toBe('n/a');
    expect(row(compute(run([blankFight({ regionId: 'region_nowhere' })])), 3).status).toBe('n/a');
  });
  test('non-decreasing rounds and death rate pass', () => {
    const m = compute(run(fights('region_silverwood_ruins', 6, 4, 0), fights('region_mistwood_ironclad_reach', 6, 5, 1), fights('region_glowlands_nexus', 6, 9, 2)));
    expect(row(m, 3)).toMatchObject({ status: 'pass', valueText: '0 violation(s) in band' });
  });
  test('U82: fights outside the place\'s band do not count (a dip there is a band-entry death, D-149)', () => {
    const under = (n: number, rounds: number, defeats: number): ReturnType<typeof blankFight>[] =>
      Array.from({ length: n }, (_, i) => blankFight({ regionId: 'region_glowlands_nexus', rounds, result: i < defeats ? 'defeat' : 'victory', playerLevel: 3 }));
    const m = compute(run(fights('region_silverwood_ruins', 6, 4, 0), fights('region_mistwood_ironclad_reach', 6, 5, 1), fights('region_glowlands_nexus', 6, 9, 2), under(12, 2, 0)));
    expect(row(m, 3)).toMatchObject({ status: 'pass' });
    expect(row(m, 3).detail).toContain('all fights: 2 violation(s)');
  });
  test('a dip in either is a violation', () => {
    const m = compute(run(fights('region_silverwood_ruins', 6, 6, 3), fights('region_glowlands_nexus', 6, 5, 0)));
    expect(row(m, 3)).toMatchObject({ status: 'fail', value: 2 });
    expect(row(m, 3).detail).toContain('rounds fall 1-4 6 → 9-13 5');
    expect(row(m, 3).detail).toContain('death rate falls 1-4 50% → 9-13 0%');
  });
});

describe('row 4: every ending reached', () => {
  const six = { ...story, endings: Object.fromEntries(TRUE_ENDING_IDS.map((id) => [id, story.endings['ending_unbound'] as never])) };
  test('n/a when the pack defines fewer than the six true endings', () => {
    const r = row(compute([batchRun(blankResult({ bot: 'explorer', endings: ['ending_unbound'] }))]), 4);
    expect(r.status).toBe('n/a');
    expect(r.detail).toContain('it defines 3; 1 of them reached');
  });
  test('explorer runs and scripts count; another bot\'s ending is named but does not', () => {
    const all = [...TRUE_ENDING_IDS];
    const ok = compute([batchRun(blankResult({ bot: 'explorer', endings: all.slice(0, 4) })), batchRun(blankResult({ bot: 'pathBot', endings: all.slice(4) }), { suite: 'script' })], six);
    expect(row(ok, 4)).toMatchObject({ status: 'pass', value: 6 });
    const missing = compute([batchRun(blankResult({ bot: 'explorer', endings: all.slice(0, 5) })), batchRun(blankResult({ bot: 'caster', endings: [all[5] as string] }))], six);
    expect(row(missing, 4)).toMatchObject({ status: 'fail', value: 5 });
    expect(row(missing, 4).detail).toContain('missing ending_unbound (ending_unbound reached only by other bots)');
    const nobody = compute([batchRun(blankResult({ bot: 'explorer' }))], six);
    expect(row(nobody, 4).detail).toContain('missing ending_iron_silence');
  });
});

const idsOf = (t: Record<string, unknown>): string[] => Object.keys(t);
const everything = blankResult({
  bot: 'explorer',
  questsStarted: idsOf(story.quests),
  questsCompleted: idsOf(story.quests),
  locationsVisited: idsOf(story.locations),
  endings: idsOf(story.endings),
  closers: ['closer_escape', 'closer_fall'],
  creaturesKilled: Object.fromEntries(idsOf(story.creatures).map((id) => [id, 1])),
  creaturesSeen: idsOf(story.creatures),
  itemsObtained: idsOf(story.items),
});

describe('rows 5 and 6 and the coverage gate G4', () => {
  const ids = idsOf;
  test('full coverage passes every one', () => {
    const m = compute([batchRun(everything)]);
    expect(row(m, 5)).toMatchObject({ status: 'pass', valueText: '7/7' });
    expect(row(m, 6)).toMatchObject({ status: 'pass', valueText: '7/7' });
    expect(row(m, 'G4')).toMatchObject({ status: 'pass', value: 0 });
  });
  test('a shortfall fails with the first of the never list, and the rest counted', () => {
    const m = compute([batchRun(blankResult({ bot: 'explorer', locationsVisited: ['loc_whispering_ruins'], questsCompleted: ['q_echo_crystal'], questsStarted: ['q_echo_crystal'] }))]);
    expect(row(m, 5).status).toBe('fail');
    expect(row(m, 5).detail).toContain('1/7; never: q_clear_path');
    expect(row(compute([batchRun(blankResult({ bot: 'explorer' }))]), 5).detail).toContain('… +1'); // seven quests: six are listed, the seventh is counted
    expect(row(m, 6)).toMatchObject({ status: 'fail', valueText: '1/7' });
    expect(row(m, 'G4')).toMatchObject({ status: 'fail' });
    expect(row(m, 'G4').detail).toContain('FAIL quests completed 1/7');
  });
  test('U82: a by-design gap (reachability.ts BY_DESIGN) leaves the denominator while unreached, and is named', () => {
    const leech = { ...(story.creatures[SHADE] as (typeof story.creatures)[string]), id: 'cr_hour_leech' as const };
    const pack = { ...story, creatures: { ...story.creatures, cr_hour_leech: leech } };
    const m = compute([batchRun(everything)], pack);
    expect(row(m, 'G4').detail).toContain(`creatures killed ${idsOf(story.creatures).length}/${idsOf(story.creatures).length} (100%, ≥ 95%; by design: cr_hour_leech)`);
    const killed = compute([batchRun({ ...everything, creaturesKilled: { ...everything.creaturesKilled, cr_hour_leech: 1 } })], pack);
    expect(row(killed, 'G4').detail).toContain(`creatures killed ${idsOf(pack.creatures).length}/${idsOf(pack.creatures).length} (100%`);
  });
  test('row 6 needs explorer runs; an empty pack has nothing to cover', () => {
    expect(row(compute([batchRun(blankResult({ bot: 'melee', locationsVisited: ids(story.locations) }))]), 6)).toMatchObject({ status: 'n/a', detail: 'n/a — needs explorer runs' });
    const empty = compute([batchRun(blankResult({ bot: 'explorer' }))], { ...story, quests: {}, locations: {} });
    expect(row(empty, 5).status).toBe('n/a');
    expect(row(empty, 'G4').detail).not.toContain('quests completed');
  });
});

describe('rows 7 and G3: soft-locks', () => {
  test('zero passes with a thin-sample mark; any fails and names the rule', () => {
    expect(row(compute([batchRun(blankResult())]), 7)).toMatchObject({ status: 'pass', sample: { n: 1, required: 2000 } });
    const m = compute([batchRun(blankResult({ softLock: { detected: true, rule: 'stall', step: 9 } })), batchRun(blankResult({ softLock: { detected: true, step: 3 } })), batchRun(blankResult())]);
    expect(row(m, 7)).toMatchObject({ status: 'fail', value: 2 });
    expect(row(m, 7).detail).toBe('FAIL 2 soft-lock(s) in 3 run(s) (stall 1, unknown 1)');
    expect(row(m, 'G3').status).toBe('fail');
  });
});

describe('row 8: fight length by band', () => {
  // U82: fodder, elite and boss lengths are measured at level parity (D-149): the player stands at the strongest foe's level
  const level = (enemies: string[]): number => Math.max(1, ...enemies.map((e) => story.creatures[e]?.level ?? 1));
  const won = (enemies: string[], rounds: number, over: Partial<ReturnType<typeof blankFight>> = {}): ReturnType<typeof blankFight> =>
    blankFight({ enemies, rounds, playerLevel: level(enemies), boss: enemies.some((e) => e === BELL || e === CONTAINED_TYRANT || e === UNVEILED_TYRANT), ...over });
  const fights = (...fs: ReturnType<typeof blankFight>[]): BatchRun[] => [batchRun(blankResult({ fights: fs }))];

  test('n/a without a finished fight; defeats, fled fights, communion and anomalies are not measured', () => {
    expect(row(compute(fights(won([SHADE], 4, { result: 'defeat' }), won([SHADE], 4, { result: 'fled' }), won([UNVEILED_TYRANT], 4, { communion: true }), won(['cr_unknown'], 4))), 8).status).toBe('n/a');
  });
  test('every band in range passes', () => {
    const m = compute(fights(won([SHADE], 4), won([SHADE, SHADE], 6), won([ABERRATION], 7), won([BELL], 12), won([CONTAINED_TYRANT], 15), won([UNVEILED_TYRANT], 16)));
    expect(row(m, 8)).toMatchObject({ status: 'pass', valueText: '0 band(s) out of range' });
    expect(row(m, 8).detail).toContain('Contained Tyrant 15 (12–18, n=1)');
  });
  test('a band out of range fails and the others are still reported; scenario fights count', () => {
    const m = compute([batchRun(blankResult({ fights: [won([SHADE], 9), won([SHADE, SHADE], 6)] })), batchRun(blankResult({ fights: [won([CONTAINED_TYRANT], 25)] }), { suite: 'scenario', scenario: 'pre_tyrant_l11_ranger' })]);
    expect(row(m, 8)).toMatchObject({ status: 'fail', value: 2 });
    expect(row(m, 8).detail).toContain('FAIL fodder single 9 (3–5, n=1');
    expect(row(m, 8).detail).toContain('FAIL Contained Tyrant 25');
  });
  test('U82: a fodder fight far over the foe is not at parity and does not count (DESIGN §6.6)', () => {
    const m = compute(fights(won([SHADE], 4), won([SHADE], 1, { playerLevel: 9 }), won([SHADE], 1, { playerLevel: 9 })));
    expect(row(m, 8).detail).toContain('fodder single 4 (3–5, n=1; every win 1, n=3)');
  });
});

describe('row 9: Loop 1 deaths by bot', () => {
  // U82: each death is a Loop 1 defeat in a fight inside the place's band (row 9 counts those for melee, caster, explorer)
  const bot = (name: string, deaths: number[]): BatchRun[] =>
    deaths.map((d, i) => batchRun(blankResult({ bot: name, seed: `s:${i}`, loops: [blankLoop({ deaths: d })], fights: Array.from({ length: d }, () => blankFight({ loop: 1, result: 'defeat' })) })));
  test('n/a with no runs', () => {
    expect(row(compute([]), 9).status).toBe('n/a');
  });
  test('inside every range', () => {
    const m = compute([...bot('melee', [0, 0, 1]), ...bot('caster', [0, 0, 0, 2]), ...bot('explorer', [1, 2]), ...bot('random', [3, 5])]);
    expect(row(m, 9)).toMatchObject({ status: 'pass', value: 0 });
  });
  test('outside: too deadly for melee (and too few zero-death), too safe for random', () => {
    const m = compute([...bot('melee', [2, 2, 0]), ...bot('explorer', [3]), ...bot('random', [1])]);
    expect(row(m, 9).status).toBe('fail');
    expect(row(m, 9).detail).toContain('FAIL melee mean 1.33, 33% zero-death');
    expect(row(m, 9).detail).toContain('FAIL explorer mean 3.00');
    expect(row(m, 9).detail).toContain('FAIL random mean 1.00');
  });
  test('U82: a death in a place above the player\'s band does not count for melee (every death is in the detail)', () => {
    const out = blankFight({ loop: 1, result: 'defeat', regionId: 'region_glowlands_nexus', playerLevel: 3 });
    const m = compute([batchRun(blankResult({ bot: 'melee', loops: [blankLoop({ deaths: 2 })], fights: [out, out] })), ...bot('caster', [0]), ...bot('explorer', [0]), ...bot('random', [3])]);
    expect(row(m, 9).status).toBe('pass');
    expect(row(m, 9).detail).toContain('melee mean 0.00, 100% zero-death (every death: 2.00, 0%)');
  });
  test('a run whose Loop 1 never ended counts all its deaths; deaths of a loop that did not start at 1 count none', () => {
    const m = compute([batchRun(blankResult({ bot: 'random', deaths: 4 })), batchRun(blankResult({ bot: 'random', deaths: 9, loops: [blankLoop({ loop: 2, deaths: 9 })] }))]);
    expect(row(m, 9).detail).toContain('random mean 2.00');
  });
});

describe('row 10: loop duration', () => {
  const loops = (bot: string, ls: ReturnType<typeof blankLoop>[], n = 3): BatchRun[] => many(n, (i) => blankResult({ bot, seed: `s:${i}`, loops: ls }));
  test('n/a without explorer or speedrunner loops', () => {
    expect(row(compute(loops('melee', [blankLoop()])), 10).status).toBe('n/a');
  });
  test('in range', () => {
    const m = compute([...loops('explorer', [blankLoop({ steps: 450, daysUsed: 24 })]), ...loops('speedrunner', [blankLoop({ daysUsed: 14 }), blankLoop({ loop: 3, steps: 150 })])]);
    expect(row(m, 10)).toMatchObject({ status: 'pass', value: 0 });
  });
  test('out of range', () => {
    const m = compute([...loops('explorer', [blankLoop({ steps: 100, daysUsed: 30 })]), ...loops('speedrunner', [blankLoop({ daysUsed: 30 }), blankLoop({ loop: 4, steps: 50 })])]);
    expect(row(m, 10)).toMatchObject({ status: 'fail', value: 4 });
  });
});

describe('row 11: level at the Loop 1 Apex', () => {
  const apex = (bot: string, level: number, n = 3): BatchRun[] => many(n, (i) => blankResult({ bot, seed: `s:${i}`, fights: [blankFight({ enemies: [CONTAINED_TYRANT], boss: true, playerLevel: level })] }));
  test('n/a when no explorer or speedrunner reaches the Apex', () => {
    expect(row(compute([batchRun(blankResult({ bot: 'explorer' }))]), 11).status).toBe('n/a');
  });
  test('explorer 11–13 and speedrunner ≥ 9 pass; outside fails', () => {
    expect(row(compute([...apex('explorer', 12), ...apex('speedrunner', 9)]), 11)).toMatchObject({ status: 'pass', value: 12, valueText: 'explorer 12' });
    expect(row(compute([...apex('explorer', 10), ...apex('speedrunner', 8)]), 11).status).toBe('fail');
  });
});

describe('row 12: ability usage', () => {
  const classRuns = (classId: string, abilities: number, basics: number, extra: Partial<ReturnType<typeof blankResult>> = {}): BatchRun[] =>
    [batchRun(blankResult({ classId, bot: 'melee', combatActions: { ability: abilities, attack: basics }, ...extra }))];
  test('n/a without fighting runs', () => {
    expect(row(compute([]), 12).status).toBe('n/a');
  });
  test('inside every band, Blood price included', () => {
    const m = compute([
      ...classRuns('ranger', 50, 50),
      ...classRuns('elf', 45, 55),
      ...classRuns('ironclad_warden', 55, 45),
      ...classRuns('wizard', 60, 40),
      ...classRuns('shadow_weaver', 70, 30, { bloodCasts: 14 }),
    ]);
    expect(row(m, 12)).toMatchObject({ status: 'pass', value: 0 });
    expect(row(m, 12).detail).toContain('Blood price 20% of 70 Weaver casts');
  });
  test('outside a band fails', () => {
    const m = compute([...classRuns('ranger', 90, 10), ...classRuns('wizard', 10, 90), ...classRuns('shadow_weaver', 60, 40, { bloodCasts: 0 })]);
    expect(row(m, 12)).toMatchObject({ status: 'fail', value: 3 });
    expect(row(m, 12).detail).toContain('FAIL ranger 90%');
    expect(row(m, 12).detail).toContain('FAIL Blood price 0% of 60 Weaver casts');
  });
});

describe('row 13: fights that end with 0 MP', () => {
  const fightsOf = (classId: string, zero: number, total: number): BatchRun[] => [
    batchRun(blankResult({ classId, bot: 'caster', fights: Array.from({ length: total }, (_, i) => blankFight({ endMp: i < zero ? 0 : 5 })) })),
  ];
  test('n/a with no MP pool', () => {
    expect(row(compute([batchRun(blankResult({ bot: 'melee', fights: [blankFight({ mpMax: 0, endMp: 0 })] }))]), 13).status).toBe('n/a');
  });
  test('≤ 15 % per class', () => {
    expect(row(compute([...fightsOf('ranger', 1, 10), ...fightsOf('wizard', 0, 10)]), 13)).toMatchObject({ status: 'pass', valueText: 'worst class 10%' });
    expect(row(compute([...fightsOf('ranger', 3, 10)]), 13)).toMatchObject({ status: 'fail' });
  });
});

describe('row 14: economy', () => {
  const closed = (gold: number, minGold = 0): BatchRun[] => many(3, (i) => blankResult({ bot: 'melee', seed: `s:${i}`, minGold, loops: [blankLoop({ gold })] }));
  test('gold never negative, a cheap potion, 50–200 gold at the end of Loop 1', () => {
    const m = compute(closed(100));
    expect(row(m, 14)).toMatchObject({ status: 'pass', value: 0 });
    expect(row(m, 14).detail).toContain('cheapest healing 10 gold within two kills in all 3 band(s)');
  });
  test('negative gold, a rich or a poor end of loop fail', () => {
    expect(row(compute(closed(100, -5)), 14).detail).toContain('FAIL lowest gold held -5');
    expect(row(compute(closed(500)), 14).detail).toContain('FAIL end-of-Loop-1 gold median 500');
  });
  test('a potion that costs more than two kills fails; no healing merchant, no fodder, no runs are n/a', () => {
    const tamsin = story.merchants['npc_tamsin_reed'] as NonNullable<(typeof story.merchants)[string]>;
    const dear = { ...story, merchants: { npc_tamsin_reed: { ...tamsin, regionMarkup: 50 } } };
    expect(row(compute(closed(100), dear), 14).detail).toContain('two kills fall short in band(s)');
    expect(row(compute(closed(100), { ...story, merchants: {} }), 14).detail).toContain('needs a merchant that sells a healing consumable');
    const noFodder = { ...story, regions: Object.fromEntries(Object.entries(story.regions).map(([id, r]) => [id, { ...r, wanderingPool: [] }])), locations: Object.fromEntries(Object.entries(story.locations).map(([id, l]) => [id, { ...l, encounters: [] }])) };
    expect(row(compute(closed(100), noFodder), 14).detail).toContain('needs fodder encounters to price a kill');
    const none = row(compute([]), 14);
    expect(none.detail).toContain('needs runs');
    expect(none.detail).toContain('needs melee/caster/explorer runs that close Loop 1');
  });
});

describe('row 15: the clock', () => {
  const loop1 = (bot: string, outcomes: ('expiry' | 'escape')[], heartstone = 'intact'): BatchRun[] =>
    outcomes.map((o, i) => batchRun(blankResult({ bot, seed: `s:${i}`, loops: [blankLoop(o === 'expiry' ? { outcome: 'closer_fall', reason: 'expiry', heartstone } : { outcome: 'closer_escape', heartstone })] })));
  test('n/a without explorer or speedrunner runs', () => {
    expect(row(compute([]), 15).status).toBe('n/a');
  });
  test('explorer 10–20 % expiry and speedrunner 0 % pass, with the Heartstone choices logged', () => {
    const m = compute([...loop1('explorer', ['expiry', ...Array<'escape'>(7)]), ...loop1('explorer', ['escape'], 'stabilized'), ...loop1('speedrunner', ['escape', 'escape'])]);
    expect(row(m, 15)).toMatchObject({ status: 'pass', value: 1 / 9 });
    expect(row(m, 15).detail).toContain('Heartstone: intact 8, stabilized 1');
  });
  test('too often or a speedrunner that expires fails', () => {
    const m = compute([...loop1('explorer', ['expiry', 'expiry', 'escape']), ...loop1('speedrunner', ['expiry'])]);
    expect(row(m, 15).status).toBe('fail');
    expect(row(compute([batchRun(blankResult({ bot: 'explorer' }))]), 15).detail).toContain('none logged');
  });
});

describe('row 16: resistance relevance', () => {
  const types = ['physical', 'fire', 'storm', 'ley', 'void', 'chrono'] as const;
  const shade = story.creatures[SHADE] as NonNullable<(typeof story.creatures)[string]>;
  const withEncounters = (weakTo: (i: number) => (typeof types)[number] | null, n: number): typeof story => {
    const creatures = { ...story.creatures };
    const pool: { creatureId: `cr_${string}`; weight: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = weakTo(i);
      creatures[`cr_res_${i}`] = { ...shade, id: `cr_res_${i}`, role: 'fodder', resistances: t === null ? {} : { [t]: 'weak' } } as never;
      pool.push({ creatureId: `cr_res_${i}`, weight: 1 });
    }
    const region = story.regions['region_silverwood_ruins'] as NonNullable<(typeof story.regions)[string]>;
    return { ...story, creatures, regions: { ...story.regions, region_silverwood_ruins: { ...region, wanderingPool: pool } } };
  };
  test('n/a without a band of six fodder encounters', () => {
    expect(row(compute([], story), 16).detail).toContain('needs a level band with 6+ fodder encounters');
  });
  test('each type best in 15–35 % passes; one type everywhere fails', () => {
    expect(row(compute([], withEncounters((i) => types[i % 6] as (typeof types)[number], 12)), 16)).toMatchObject({ status: 'pass', value: 0 });
    const m = compute([], withEncounters(() => 'fire', 12));
    expect(row(m, 16).status).toBe('fail');
    expect(row(m, 16).detail).toContain('fire 100%');
  });
  test('an encounter without a weakness has no best type', () => {
    const m = compute([], withEncounters((i) => (i < 6 ? null : types[i % 6]) as (typeof types)[number] | null, 12));
    expect(row(m, 16).status).toBe('fail'); // half the encounters credit nobody, so the shares fall short of 15 %
  });
});

describe('row 17: companion value', () => {
  const fights = (companion: boolean, rounds: number, n = 4): ReturnType<typeof blankFight>[] => Array.from({ length: n }, () => blankFight({ companion, rounds }));
  test('n/a without fights on both sides at one level against the same enemies', () => {
    expect(row(compute([batchRun(blankResult({ fights: fights(false, 6) }))]), 17).status).toBe('n/a');
  });
  test('20–35 % faster passes; slower fails', () => {
    const fast = compute([batchRun(blankResult({ fights: [...fights(false, 10), ...fights(true, 7)] }))]);
    expect(row(fast, 17)).toMatchObject({ status: 'pass', valueText: '30%' });
    const slow = compute([batchRun(blankResult({ fights: [...fights(false, 10), ...fights(true, 10)] }))]);
    expect(row(slow, 17)).toMatchObject({ status: 'fail', valueText: '0%' });
  });
  test('boss fights, defeats and different enemies are not compared', () => {
    const m = compute([batchRun(blankResult({ fights: [...fights(false, 10), ...fights(true, 5).map((f) => ({ ...f, enemies: [ABERRATION] })), blankFight({ boss: true, companion: true }), blankFight({ result: 'defeat', companion: true })] }))]);
    expect(row(m, 17).status).toBe('n/a');
  });
});

describe('row 18: variance sanity', () => {
  test('always n/a, saying what it needs', () => {
    expect(row(compute([]), 18).detail).toContain('needs a fixed-decision roll-replay harness');
  });
});

describe('rows 19 and 20: the Tyrant scenario sims', () => {
  const scen = (level: 11 | 13, classId: string, bot: string, wins: number, total: number, over: { companion?: boolean; rounds?: number; dealt?: number } = {}): BatchRun[] =>
    many(
      total,
      (i) =>
        blankResult({
          classId,
          bot,
          seed: `s:${i}`,
          fights: [blankFight({ enemies: [CONTAINED_TYRANT], boss: true, result: i < wins ? 'victory' : 'defeat', rounds: over.rounds ?? 15, damageDealt: over.dealt ?? 600 })],
        }),
      { suite: 'scenario', scenario: level === 11 ? 'pre_tyrant_l11_ranger' : 'pre_tyrant_l13_ranger', ...(over.companion === true ? { companionId: 'ilyra' } : {}) },
    );

  test('cells: runs, wins, win rate, median rounds and damage of won fights', () => {
    const cells = tyrantCells([...scen(11, 'ranger', 'melee', 3, 4), ...scen(13, 'ranger', 'caster', 0, 2, { companion: true }), batchRun(blankResult(), { suite: 'scenario', scenario: 'communion_movement_2' })]);
    expect(cells).toEqual([
      { level: 11, classId: 'ranger', companion: false, bot: 'melee', runs: 4, wins: 3, winRate: 0.75, medianRounds: 15, medianDamageDealt: 600 },
      { level: 13, classId: 'ranger', companion: true, bot: 'caster', runs: 2, wins: 0, winRate: 0, medianRounds: null, medianDamageDealt: null },
    ]);
  });
  test('n/a without pre-Tyrant runs; says what each variant needs', () => {
    const r = row(compute([]), 19);
    expect(r.status).toBe('n/a');
    expect(r.detail).toContain('a pack that places the Contained Tyrant at the Apex');
    expect(r.detail).toContain('a companion in the pack');
  });
  test('rounds, win rates and effective HP, solo and with a companion', () => {
    const good = compute([...scen(11, 'ranger', 'melee', 8, 10), ...scen(13, 'ranger', 'melee', 9, 10), ...scen(11, 'ranger', 'melee', 7, 10, { companion: true }), ...scen(13, 'ranger', 'caster', 9, 10, { companion: true })]);
    expect(row(good, 19)).toMatchObject({ status: 'pass', value: 0 });
    const bad = compute([...scen(11, 'ranger', 'melee', 1, 10, { rounds: 30, dealt: 1200 }), ...scen(13, 'ranger', 'melee', 1, 10, { dealt: 1200 })]);
    expect(row(bad, 19)).toMatchObject({ status: 'fail' });
    expect(row(bad, 19).detail).toContain('FAIL L11 solo median rounds ranger 30');
    expect(row(bad, 19).detail).toContain('FAIL effective HP solo 1200');
    const unwon = compute(scen(11, 'ranger', 'pacifist', 0, 3));
    expect(row(unwon, 19).status).toBe('n/a');
    expect(row(unwon, 19).detail).toContain('needs won Tyrant fights at L11 solo');
    expect(row(unwon, 19).detail).toContain('needs melee or caster runs at L13 solo');
    expect(row(unwon, 19).detail).toContain('needs won Tyrant fights solo (effective HP)');
  });
  test('row 20: the communion reaches Resolve 3; the fight path needs a scenario', () => {
    const comm = (resolve: number): BatchRun[] => many(2, (i) => blankResult({ bot: 'pacifist', seed: `s:${i}`, maxResolve: resolve }), { suite: 'scenario', scenario: 'communion_movement_2' });
    expect(row(compute(comm(5)), 20)).toMatchObject({ status: 'partial' });
    expect(row(compute(comm(5)), 20).detail).toContain('Resolve ≥ 3 reached in 2/2 communion run(s) (pacifist)');
    expect(row(compute(comm(1)), 20).status).toBe('fail');
    expect(row(compute([]), 20).status).toBe('n/a');
    const path = (rounds: number): BatchRun[] => [batchRun(blankResult({ fights: [blankFight({ enemies: [UNVEILED_TYRANT], boss: true, playerLevel: 16, rounds })] }))];
    expect(row(compute([...path(16), ...comm(4)]), 20)).toMatchObject({ status: 'pass' });
    expect(row(compute(path(30)), 20).status).toBe('fail');
  });
});

describe('gates G1, G5 and G6', () => {
  const allBots = ['melee', 'caster', 'explorer', 'speedrunner', 'pacifist', 'random'];
  const long = (bot: string, i: number, over: Partial<ReturnType<typeof blankResult>> = {}): BatchRun => batchRun(blankResult({ bot, seed: `s:${i}`, steps: 2500, ...over }));
  test('G1: all six bots, no error, every run finished', () => {
    const m = compute(allBots.map((b, i) => long(b, i)));
    expect(row(m, 'G1')).toMatchObject({ status: 'pass', value: 0, sample: { n: 6, required: 900 } });
  });
  test('G1: errors and early stops fail; missing bots make it partial', () => {
    const bad = compute([long('melee', 0, { errors: [{ step: 1, message: 'x' }] }), long('caster', 1, { steps: 50 }), long('explorer', 2, { steps: 50, loops: [blankLoop()] })]);
    expect(row(bad, 'G1')).toMatchObject({ status: 'fail', value: 2 });
    expect(row(compute([long('melee', 0)]), 'G1')).toMatchObject({ status: 'partial' });
    expect(row(compute([long('melee', 0)]), 'G1').detail).toContain('not run: caster, explorer, speedrunner, pacifist, random');
  });
  test('G5 sums the rows: fail when one fails, partial when the rest is open', () => {
    // nine explorers cover everything and one of them runs out of days (row 15 wants 10–20 %): nothing fails, much is open
    const m = compute(many(9, (i) => ({ ...everything, seed: `s:${i}`, loops: [blankLoop({ steps: 450, daysUsed: 24, ...(i === 0 ? { outcome: 'closer_fall', reason: 'expiry' as const } : {}) })] })));
    expect(row(m, 'G5')).toMatchObject({ status: 'partial' });
    expect(row(m, 'G5').detail).toContain('row(s) the pack cannot fully measure yet');
    expect(row(compute([]), 'G5').status).toBe('fail'); // an unplayed pack covers none of its quests
    expect(row(compute([batchRun(blankResult({ damageBySource: { rgr_marked_shot: 90, basic: 10 } }))]), 'G5').status).toBe('fail');
  });
  test('G6: replays against the hashes; n/a when not run', () => {
    expect(row(compute([]), 'G6').detail).toContain('needs the determinism check');
    expect(row(compute([], story, { sampled: 0, mismatches: [] }), 'G6').status).toBe('n/a');
    expect(row(compute([], story, { sampled: 5, mismatches: [] }), 'G6')).toMatchObject({ status: 'pass', sample: { n: 5, required: 200 } });
    const mismatch = { pack: 'p', bot: 'melee', classId: 'ranger', seed: 's', expected: 'a', rerun: 'b', replay: 'c', repro: 'r' };
    expect(row(compute([], story, { sampled: 200, mismatches: [mismatch] }), 'G6')).toMatchObject({ status: 'fail', value: 1 });
    expect(row(compute([], story, { sampled: 200, mismatches: [] }), 'G6').sample).toBeUndefined();
  });
});

describe('the summary tables', () => {
  const runs = (): BatchRun[] => [
    ...many(
      4,
      (i) =>
        blankResult({
          bot: 'melee',
          classId: 'ranger',
          seed: `s:${i}`,
          fallen: i === 0 ? 1 : 0,
          endings: i === 3 ? ['ending_unbound'] : [],
          loops: [blankLoop(i === 1 ? { outcome: 'closer_fall', reason: 'expiry', daysUsed: 28, deaths: 2, gold: 80 } : { daysUsed: 20 + i }), blankLoop({ loop: 2, daysUsed: 5 })],
          fights: [blankFight({ enemies: [CONTAINED_TYRANT], boss: true, playerLevel: 12, gold: 40, phase: i % 2 }), blankFight({ mpMax: 20, endMp: 0 })],
          combatActions: { ability: 3, attack: 1 },
          echoes: ['echo_tyrant_speaks'],
          questsStarted: ['q_echo_crystal'],
          questsCompleted: i < 3 ? ['q_echo_crystal'] : [],
          questDays: i < 3 ? { q_echo_crystal: i + 1 } : {},
          questsFailed: i === 2 ? ['q_echo_crystal'] : [],
          purchases: { item_glow_moss: 2 },
          craftsByRecipe: { recipe_a: 1 },
          upgradesByRarity: { rare: 1 },
          companions: { ilyra: { kos: 1, died: i === 0, loyalty: 40 + i } },
          damageBySource: { basic: 10, rgr_marked_shot: 30 },
        }),
    ),
    batchRun(blankResult({ bot: 'melee', classId: 'ranger', errors: [{ step: 3, message: 'boom' }], softLock: { detected: true, rule: 'stall' } }), { repro: 'cmd' }),
    batchRun(blankResult({ bot: 'pathBot', classId: 'ranger' }), { suite: 'script', script: 'ending_x#0', proof: { reached: false, detail: 'script_assert: nope' } }),
    batchRun(blankResult({ bot: 'pathBot' }), { suite: 'script', script: 'ending_y#1', proof: { reached: true, detail: 'ok' } }),
  ];

  test('per class and bot: rates, days, deaths, Apex level, ability share, 0-MP fights', () => {
    const x = compute(runs()).byClassBot['ranger:melee'];
    expect(x).toMatchObject({ runs: 5, endings: { ending_unbound: 1 } });
    expect(x?.loop1EscapeRate).toBeCloseTo(3 / 5);
    expect(x?.loop1ExpiryRate).toBeCloseTo(1 / 5);
    expect(x?.loop1FallenRate).toBeCloseTo(1 / 5);
    expect(x?.loop1ClosedRate).toBeCloseTo(4 / 5);
    expect(x?.medianDaysLoop1).toBe(22.5);
    expect(x?.p90Days).toBe(28);
    expect(x?.deaths).toBeCloseTo(2 / 5);
    expect(x?.zeroDeathShare).toBeCloseTo(4 / 5);
    expect(x?.medianLevelAtApex).toBe(12);
    expect(x?.abilityActionShare).toBeCloseTo(0.75);
    expect(x?.zeroMpFightShare).toBeCloseTo(0.5);
    const none = compute([batchRun(blankResult())]).byClassBot['ranger:melee'];
    expect(none).toMatchObject({ medianDaysLoop1: null, p90Days: null, medianLevelAtApex: null, abilityActionShare: null, zeroMpFightShare: null });
  });

  test('days by bot and loop, the damage share, the region curve, the bosses', () => {
    const m = compute(runs());
    expect(m.daysByBotLoop.find((d) => d.bot === 'melee' && d.loop === 2)?.dist).toEqual({ n: 4, min: 5, median: 5, p90: 5, max: 5 });
    expect(m.damageShareByClass['ranger']).toEqual({ rgr_marked_shot: 0.75, basic: 0.25 });
    expect(m.regionCurve).toHaveLength(1);
    expect(m.regionCurve[0]).toMatchObject({ regionId: 'region_silverwood_ruins', levelBand: [1, 4], fights: 8 });
    expect(m.regionCurve[0]?.avgDamageTakenPerRound).toBe(2.5);
    expect(m.bossStats[CONTAINED_TYRANT]).toMatchObject({ fights: 4, winRate: 1, medianRounds: 4, phaseReached: { 0: 2, 1: 2 } });
  });

  test('economy, quests, Echoes, companions', () => {
    const m = compute(runs());
    expect(m.economy).toMatchObject({ medianGoldAtApex: 40, medianGoldEndOfLoop1: 100, purchases: { item_glow_moss: 8 }, craftsByRecipe: { recipe_a: 4 }, upgradesByRarity: { rare: 4 } });
    expect(m.quests['q_echo_crystal']).toEqual({ started: 4, completed: 3, failed: 1, medianDaysToComplete: 2, completedByBots: ['melee'] });
    expect(m.quests['q_clear_path']).toEqual({ started: 0, completed: 0, failed: 0, medianDaysToComplete: null, completedByBots: [] });
    expect(m.echoes['echo_tyrant_speaks']).toEqual({ gained: 4, firstLoopGained: 0 });
    expect(m.companions['ilyra']).toEqual({ recruited: 4, kos: 4, deaths: 1, avgLoyalty: 41.5 });
    expect(m.companions['brak']).toEqual({ recruited: 0, kos: 0, deaths: 0, avgLoyalty: 0 });
  });

  test('the Echoes a run gained in Loop 1: from the loop record, or all of them when no loop ended', () => {
    const m = compute([
      batchRun(blankResult({ echoes: ['echo_tyrant_speaks'], loops: [blankLoop({ echoesGained: ['echo_tyrant_speaks'] })] })),
      batchRun(blankResult({ echoes: ['echo_tyrant_speaks'] })),
      batchRun(blankResult({ echoes: ['echo_tyrant_speaks'], loops: [blankLoop({ loop: 2 })] })),
    ]);
    expect(m.echoes['echo_tyrant_speaks']).toEqual({ gained: 3, firstLoopGained: 2 });
  });

  test('blockers: errors, soft-locks and failed ending proofs, with their repro; passing proofs are no blocker', () => {
    const m = compute(runs());
    expect(m.blockers).toHaveLength(2);
    expect(m.blockers[0]).toMatchObject({ bot: 'melee', suite: 'main', repro: 'cmd', hasTrace: false });
    expect(m.blockers[1]).toMatchObject({ bot: 'pathBot', suite: 'script', proofFailure: 'ending_x#0: script_assert: nope' });
    expect(m.softLocks).toHaveLength(1);
    expect(m.errors).toHaveLength(1);
    expect(runs().filter(isBlockerRun)).toHaveLength(2);
    expect(m.coverage.quests.total).toBe(7);
    expect(m.runs).toBe(runs().length);
  });
});
