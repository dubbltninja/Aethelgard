// U39: the BALANCE.md generator (PLAN §7.9) — every section for every pack, every DESIGN §19 row and PLAN §1.2 gate in the
// Targets table, "n/a — needs …" for what a pack cannot measure, the blockers grouped with their repro, and the hints.
import { describe, expect, test } from 'bun:test';
import { resolveConfig, runBatch, type BatchResult } from '@sim/batch';
import { computeMetrics, CONTAINED_TYRANT, type BatchRun, type Metrics, type TargetRow } from '@sim/metrics';
import { BLOCKER_DETAIL_LIMIT, SECTIONS, heading, recommendations, renderBalance } from '@sim/report';
import { storyPack } from '@tests/fixtures/storyContent';
import { dialogueChoiceIds } from '@sim/coverage';
import { batchRun, blankFight, blankLoop, blankResult, many } from './helpers';

const story = storyPack();
const metricsOf = (runs: readonly BatchRun[], pack = 'p'): Metrics => computeMetrics({ pack, content: story, runs, determinism: null });
const bare = (t: TargetRow): TargetRow => {
  const { sample: _sample, ...rest } = t;
  return rest;
};
const batchOf = (over: Partial<BatchResult> = {}): BatchResult => ({
  config: resolveConfig({ packs: ['fixture:story'], seeds: 2, classes: 'all', bots: ['melee', 'caster'] }),
  packs: [{ spec: 'p', contentVersion: 'v1', classes: ['ranger'], jobs: 1 }],
  runs: [],
  skipped: [],
  failures: [],
  determinism: {},
  startedAt: '2026-01-02T03:04:05.000Z',
  durationMs: 65_400,
  contentVersion: 'v1',
  gitSha: 'abc1234',
  workers: 3,
  dev: false,
  runMicrosPerStep: 123.4,
  ...over,
});
const section = (md: string, name: string, pack = 'p'): string => {
  const start = md.indexOf(`${heading(name as never, pack)}\n`);
  if (start < 0) throw new Error(`no section ${name}`);
  const next = md.indexOf('\n## ', start + 1);
  return md.slice(start, next < 0 ? undefined : next);
};

const rich = (): BatchRun[] => [
  ...many(
    6,
    (i) =>
      blankResult({
        bot: i % 2 === 0 ? 'melee' : 'caster',
        classId: 'ranger',
        seed: `s:${i}`,
        endings: i === 5 ? ['ending_unbound'] : [],
        loops: [blankLoop({ outcome: i === 1 ? 'closer_fall' : 'closer_escape', ...(i === 1 ? { reason: 'expiry' as const } : {}), daysUsed: 20 + i, gold: 90 }), blankLoop({ loop: 2, daysUsed: 6 })],
        fights: [
          blankFight({ rounds: 4, damageTaken: 12 }),
          blankFight({ regionId: 'region_glowlands_nexus', rounds: 9, result: i === 0 ? 'defeat' : 'victory' }),
          blankFight({ enemies: [CONTAINED_TYRANT], boss: true, playerLevel: 12, rounds: 15, phase: i % 3, gold: 40 }),
        ],
        combatActions: { ability: 6, attack: 4 },
        damageBySource: { basic: 40, rgr_marked_shot: 50, 'gear:item_x': 10 },
        purchases: { item_glow_moss: 3, item_ley_tonic: 1 },
        craftsByRecipe: { recipe_a: 2 },
        upgradesByRarity: { rare: 1 },
        echoes: ['echo_tyrant_speaks'],
        questsStarted: ['q_echo_crystal'],
        questsCompleted: ['q_echo_crystal'],
        questDays: { q_echo_crystal: 3 },
        companions: { ilyra: { kos: 1, died: i === 0, loyalty: 60 } },
        locationsVisited: ['loc_whispering_ruins'],
      }),
  ),
  ...many(2, (i) => blankResult({ bot: 'pacifist', seed: `p:${i}`, maxResolve: 4 }), { suite: 'scenario', scenario: 'communion_movement_2' }),
  ...many(2, (i) => blankResult({ bot: 'melee', seed: `t:${i}`, fights: [blankFight({ enemies: [CONTAINED_TYRANT], boss: true, result: 'victory', rounds: 14, damageDealt: 700 })] }), { suite: 'scenario', scenario: 'pre_tyrant_l11_ranger' }),
];

describe('heading', () => {
  test('## <Section> · <pack>', () => {
    expect(heading('Targets', 'fixture:story')).toBe('## Targets · fixture:story');
    expect(SECTIONS).toHaveLength(13);
  });
});

describe('a real batch rendered', () => {
  test('every PLAN §7.9 section for the pack and every DESIGN §19 row and gate in the Targets table', async () => {
    const batch = await runBatch({ packs: ['fixture:story'], seeds: 2, classes: ['ranger'], bots: ['melee', 'explorer', 'caster', 'pacifist'], workers: 1, maxSteps: 400, maxLoops: 2, scenarioSeeds: 1, determinism: 2, scripts: ['tests/fixtures/scripts/endings.ts#FIXTURE_ENDING_SCRIPTS'] });
    const md = renderBalance(batch, [{ pack: 'fixture:story', metrics: computeMetrics({ pack: 'fixture:story', content: story, runs: batch.runs, determinism: batch.determinism['fixture:story'] ?? null }) }]);
    for (const s of SECTIONS) expect(md).toContain(`\n${heading(s, 'fixture:story')}\n`);
    const targets = section(md, 'Targets', 'fixture:story');
    for (let n = 1; n <= 20; n++) expect(targets).toMatch(new RegExp(`\\| #${n} \\|`));
    for (let n = 1; n <= 6; n++) expect(targets).toMatch(new RegExp(`\\| G${n} \\|`));
    expect(targets).toContain('n/a — needs');
    expect(md.indexOf(heading('Targets', 'fixture:story'))).toBeLessThan(md.indexOf(heading('Recommendations', 'fixture:story')));
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
    expect(md).not.toMatch(/\n{3,}/);
    expect(md).toContain('- **Packs:** fixture:story');
    expect(md).toContain('__DEV__` ON (steps are deep-frozen: not a release batch)');
  });

  test('each pack gets all of the sections, in order, and the header table has a row per pack', () => {
    const batch = batchOf({ config: resolveConfig({ packs: ['a', 'b'], seeds: 1, classes: 'all', bots: ['melee'], modifiers: ['mod_x'] }) });
    const md = renderBalance(batch, [{ pack: 'a', metrics: metricsOf([], 'a') }, { pack: 'b', metrics: metricsOf([], 'b') }]);
    const headings = md.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual(['a', 'b'].flatMap((p) => SECTIONS.map((s) => heading(s, p))));
    expect(md).toContain('| a | 0 |');
    expect(md).toContain('| b | 0 |');
    expect(md).toContain('modifiers mod_x');
    expect(md).toContain('**Duration:** 1m 05s on 3 worker(s); 123 µs per step (bot, legal actions and step) with `__DEV__` off');
    expect(md).toContain('- **Git SHA:** abc1234');
    expect(md).toContain('- **Date:** 2026-01-02T03:04:05.000Z');
  });
});

describe('the sections from data', () => {
  const md = renderBalance(batchOf({ runs: rich() }), [{ pack: 'p', metrics: metricsOf(rich()) }]);

  test('Targets: the count line, PASS/FAIL/PARTIAL, and a thin-sample note', () => {
    const t = section(md, 'Targets');
    expect(t).toMatch(/\d+ pass, \d+ fail, \d+ partial, \d+ n\/a of 26 rows/);
    expect(t).toContain(`| #7 | Zero soft-locks | PASS (thin sample: ${rich().length} of 2000) |`);
    expect(t).toContain('| #2 | No single ability dominates | FAIL | 50.0% |');
    expect(t).toMatch(/\| #14 \| Economy \| (PASS|PARTIAL|FAIL)/);
  });

  test('Completion, Days used, Damage share', () => {
    const c = section(md, 'Completion');
    expect(c).toContain('| ranger | caster | 3 |');
    expect(c).toContain('| ranger | melee | 3 |');
    expect(c).toContain('unbound 1');
    expect(section(md, 'Days used')).toContain('| melee | 1 | 3 |');
    const d = section(md, 'Damage share');
    expect(d).toContain('**ranger**');
    expect(d).toContain('| rgr_marked_shot | 50.0% | **over 35 %** |');
    expect(d).toContain('| gear:item_x | 10.0% |  |');
  });

  test('Region curve (with bars), Bosses (with the pre-Tyrant cells), Economy, Quests, Echoes, Companions', () => {
    const r = section(md, 'Region curve');
    expect(r).toContain('| region_silverwood_ruins | 1–4 | 12 |');
    expect(r).toMatch(/silverwood_ruins \(1–4\) +#+ [\d.]+ rounds/);
    expect(r).toMatch(/glowlands_nexus \(9–13\) +#+ \d+(\.\d)? rounds/);
    const b = section(md, 'Bosses');
    expect(b).toContain(`| ${CONTAINED_TYRANT} | 8 |`);
    expect(b).toContain('P1 ');
    expect(b).toContain('| fodder single | 3–5 |');
    expect(b).toContain('| 11 | ranger | solo | melee | 2 | 2 | 100% | 14 | 700 |');
    const e = section(md, 'Economy');
    expect(e).toContain('- Median gold at the Contained Tyrant: 40');
    expect(e).toContain('| item_glow_moss | 18 |');
    expect(e).toContain('| recipe_a | 12 |');
    expect(e).toContain('| rare | 6 |');
    expect(section(md, 'Quests')).toContain('| q_echo_crystal | 6 | 6 | 0 | 3 | caster, melee |');
    expect(section(md, 'Echoes')).toContain('| echo_tyrant_speaks | 6 | 0 |');
    expect(section(md, 'Companions')).toContain('| ilyra | 6 | 6 | 1 | 60 |');
  });

  test('Coverage lists what was never reached; a fully reached pack says so', () => {
    const cov = section(md, 'Coverage');
    expect(cov).toContain('| quests completed | 1 | 7 | 14.3% |');
    expect(cov).toContain('| dialogue choices taken | 0 | 20 | 0.0% |');
    expect(cov).toContain('Never reached');
    expect(cov).toMatch(/- \*\*quests never started\*\* \(6\): q_clear_path/);
    const ids = (t: Record<string, unknown>): string[] => Object.keys(t);
    const all = blankResult({ bot: 'explorer', questsStarted: ids(story.quests), questsCompleted: ids(story.quests), locationsVisited: ids(story.locations), endings: ids(story.endings), closers: ['closer_escape', 'closer_fall'], creaturesKilled: Object.fromEntries(ids(story.creatures).map((id) => [id, 1])), creaturesSeen: ids(story.creatures), itemsObtained: ids(story.items), echoes: ids(story.echoes), codexUnlocked: ids(story.codex), abilitiesUsed: Object.fromEntries(ids(story.abilities).map((id) => [id, 1])), choicesTaken: dialogueChoiceIds(story) });
    const full = renderBalance(batchOf(), [{ pack: 'p', metrics: metricsOf([batchRun(all)]) }]);
    expect(section(full, 'Coverage')).toContain('Nothing is left unreached.');
    // a long never list is cut at 40 ids
    const many50 = { ...story, quests: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`q_${String(i).padStart(2, '0')}`, Object.values(story.quests)[0] as never])) };
    const longMd = renderBalance(batchOf(), [{ pack: 'p', metrics: computeMetrics({ pack: 'p', content: many50, runs: [], determinism: null }) }]);
    expect(section(longMd, 'Coverage')).toContain('… +10 more');
  });
});

describe('empty sections', () => {
  const md = renderBalance(batchOf(), [{ pack: 'p', metrics: metricsOf([]) }]);
  test('say so instead of printing an empty table', () => {
    expect(section(md, 'Damage share')).toContain('_No damage was dealt._');
    expect(section(md, 'Region curve')).toContain('_No region fought._');
    expect(section(md, 'Completion')).toContain('_None._');
    expect(section(md, 'Days used')).toContain('_None._');
    expect(section(md, 'Blockers')).toContain('None: 0 run(s), 0 engine errors, 0 soft-locks, 0 failed ending proofs.');
  });

  test('n/a rows read "n/a — needs …" in the Result column', () => {
    const row = section(md, 'Targets').split('\n').find((l) => l.startsWith('| #1 |')) ?? '';
    expect(row).toContain('| n/a — needs melee or caster runs |');
    expect(row.endsWith('|  |')).toBe(true);
  });

  test('cells are escaped: a pipe and a newline cannot break the table', () => {
    const m = { ...metricsOf([]), quests: { 'q|a\nb': { started: 1, completed: 0, failed: 0, medianDaysToComplete: null, completedByBots: [] } } };
    const out = renderBalance(batchOf(), [{ pack: 'p', metrics: m }]);
    expect(section(out, 'Quests')).toContain('| q\\|a b | 1 | 0 | 0 | — |  |');
  });
});

describe('Blockers', () => {
  const errorRun = (i: number, n: number): BatchRun =>
    batchRun(blankResult({ bot: 'melee', seed: `e:${i}`, stopReason: 'error', errors: Array.from({ length: n }, (_, k) => ({ step: k + 1, message: `bad\nthing ${k}`, ...(k === 0 ? { action: { type: 'wait' as const } } : {}) })), trace: [{ type: 'wait' }] }), { repro: `repro e:${i}` });
  const runs: BatchRun[] = [
    ...Array.from({ length: BLOCKER_DETAIL_LIMIT + 2 }, (_, i) => errorRun(i, i === 0 ? 7 : 1)),
    batchRun(blankResult({ bot: 'caster', classId: 'wizard', seed: 'k:0', stopReason: 'soft_lock', softLock: { detected: true, rule: 'combat_stall', step: 162, detail: 'fight at round 61', lastActions: [{ type: 'wait' }, { type: 'attack', targetId: 'x' } as never] } }), { repro: 'repro k' }),
    batchRun(blankResult({ bot: 'caster', classId: 'wizard', seed: 'k:1', softLock: { detected: true } }), { repro: 'repro k1', suite: 'scenario', scenario: 'pre_tyrant_l11_ranger' }),
    batchRun(blankResult({ bot: 'pathBot' }), { suite: 'script', script: 'ending_x#0', proof: { reached: false, detail: 'script_assert: nope' }, repro: 'repro proof' }),
  ];
  const batch = batchOf({
    runs,
    failures: [{ pack: 'p', suite: 'scenario', what: 'melee elf bal:0', message: 'scenario boom' }, { pack: 'other', suite: 'main', what: 'w', message: 'elsewhere' }],
    determinism: { p: { sampled: 5, mismatches: [{ pack: 'p', bot: 'melee', classId: 'ranger', seed: 'd:0', expected: 'aa', rerun: 'bb', replay: 'cc', repro: 'repro d' }] } },
  });
  const md = renderBalance(batch, [{ pack: 'p', metrics: metricsOf(runs, 'p') }]);
  const b = section(md, 'Blockers');

  test('a table by suite, bot, class, scenario and kind, with the first repro of each group', () => {
    expect(b).toContain('| main | melee | ranger | — | error | 12 | `repro e:0` |');
    expect(b).toContain('| main | caster | wizard | — | combat_stall | 1 | `repro k` |');
    expect(b).toContain('| scenario | caster | wizard | pre_tyrant_l11_ranger | soft-lock | 1 | `repro k1` |');
    expect(b).toContain('| script | pathBot | ranger | — | ending proof | 1 | `repro proof` |');
  });

  test('the first ten in detail: errors (five shown, the rest counted), soft-locks, failed proofs, the repro', () => {
    expect(b).toContain(`In detail (${BLOCKER_DETAIL_LIMIT} of 15):`);
    expect(b).toContain('  - error at step 1: bad thing 0 — {"type":"wait"}');
    expect(b).toContain('  - … 2 more error(s)');
    expect(b).toContain('  - reproduce: `repro e:0`');
    expect(b).toContain('(main, stop: error, trace kept)');
  });

  test('crashed jobs of this pack and determinism mismatches are listed; another pack\'s crash is not', () => {
    expect(b).toContain('- **p · scenario · melee elf bal:0** crashed the job: scenario boom');
    expect(b).not.toContain('elsewhere');
    expect(b).toContain('- **determinism mismatch** p · melee · ranger · seed `d:0`: run aa, re-run bb, replay cc — reproduce: `repro d`');
  });

  test('a soft-lock without a step or rule, and the proof failure of a script, read sensibly (all blockers beyond the limit are in the table)', () => {
    const few = batchOf({ runs: runs.slice(-3) });
    const f = section(renderBalance(few, [{ pack: 'p', metrics: metricsOf(runs.slice(-3)) }]), 'Blockers');
    expect(f).toContain('soft-lock at step 162 (combat_stall): fight at round 61');
    expect(f).toContain('last actions: wait attack');
    expect(f).toContain('soft-lock at step ? (unknown): ');
    expect(f).toContain('last actions: ');
    expect(f).toContain('ending proof failed: ending_x#0: script_assert: nope');
    expect(f).toContain('scenario pre_tyrant_l11_ranger (scenario, stop: max_steps)');
  });

  test('none: the sampled replays are counted when the check ran', () => {
    const clean = renderBalance(batchOf({ determinism: { p: { sampled: 7, mismatches: [] } }, config: resolveConfig({ packs: ['p'], seeds: 1, classes: 'all', bots: ['melee'], determinism: 7 }) }), [{ pack: 'p', metrics: metricsOf([]) }]);
    expect(section(clean, 'Blockers')).toContain(', 7 sampled run(s) replayed to the same hash.');
    const off = renderBalance(batchOf({ determinism: { p: { sampled: 0, mismatches: [] } }, config: resolveConfig({ packs: ['p'], seeds: 1, classes: 'all', bots: ['melee'], determinism: 0 }) }), [{ pack: 'p', metrics: metricsOf([]) }]);
    expect(section(off, 'Blockers')).not.toContain('sampled');
  });

  test('the header counts the blockers of the whole batch', () => {
    expect(md).toContain('- **Blockers:** 18'); // 15 blocking runs, 2 crashed jobs (any pack), 1 determinism mismatch
  });
});

describe('recommendations', () => {
  const failing = (m: Metrics, ids: (number | string)[]): Metrics => ({ ...m, targets: m.targets.map((t) => (ids.includes(t.row) ? { ...bare(t), status: 'fail' as const } : bare(t))) });
  const base = metricsOf([]);

  test('nothing to say when every measured row passes', () => {
    const quiet: Metrics = { ...base, targets: base.targets.map((t) => ({ ...bare(t), status: 'n/a' as const })) };
    expect(recommendations(batchOf(), 'p', quiet)).toEqual(['No automatic hints: every row that could be measured passes.']);
  });

  test('a hint for each failing row that has one, and for the damage table', () => {
    const m = failing({ ...base, damageShareByClass: { ranger: { rgr_marked_shot: 0.6, basic: 0.5, 'gear:x': 0.9, other: 0.1 } } }, [1, 3, 8, 9, 12, 13, 14, 15, 19, 'G1', 'G4']);
    const out = recommendations(batchOf(), 'p', m).join('\n');
    expect(out).toContain("Ability rgr_marked_shot deals 60% of ranger's damage (over 35 %)");
    expect(out).toContain("Basic attacks deal 50% of ranger's damage");
    expect(out).not.toContain('gear:x');
    for (const needle of ['Escape rate is under 60 %', 'not monotone', 'Fight lengths leave', 'Loop 1 deaths are off', 'ability-usage band', '0 MP too often', 'Economy is off', 'clock expires', 'Contained Tyrant misses', 'Some bot did not finish', 'out of reach of the sims']) {
      expect(out).toContain(needle);
    }
  });

  test('thin samples, skipped scenario sims (this pack only) and blockers first', () => {
    const m = metricsOf(rich());
    const batch = batchOf({
      skipped: [
        { pack: 'p', suite: 'scenario', what: 'a', reason: 'scenario pre_tyrant_l11_ranger: unavailable: no Apex' },
        { pack: 'p', suite: 'scenario', what: 'b', reason: 'scenario pre_tyrant_l11_ranger: unavailable: no Apex' },
        { pack: 'q', suite: 'scenario', what: 'c', reason: 'scenario x: elsewhere' },
      ],
      failures: [{ pack: 'p', suite: 'main', what: 'w', message: 'm' }],
    });
    const out = recommendations(batch, 'p', m);
    expect(out[0]).toBe('- Fix the Blockers first: a balance number from a run that errored or soft-locked cannot be trusted.');
    expect(out.join('\n')).toContain(`Row #7 (Zero soft-locks) rests on ${rich().length} run(s); the release batch needs 2000`);
    expect(out.join('\n')).toContain('Row G1 (Bots complete runs) rests on 6 run(s); the release batch needs 900');
    const skipped = out.find((l) => l.includes('scenario sim(s) were skipped')) ?? '';
    expect(skipped).toContain('2 scenario sim(s) were skipped on this pack');
    expect(skipped).toContain('pre_tyrant_l11_ranger: unavailable: no Apex.');
    expect(skipped).not.toContain('elsewhere');
  });
});
