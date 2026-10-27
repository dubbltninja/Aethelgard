// U37: the soft-lock detector (PLAN §7.6; DESIGN §19 #7) — the progress signature, the stall window, the day-stuck rule
// (and the places it does not count: dialogue, the Threshold, a frozen clock), the combat round limit, hard locks and the
// rejected storm.
import { describe, expect, test } from 'bun:test';
import type { Action, GameState } from '@engine/index';
import { loadScenario } from '@sim/scenarios';
import {
  COMBAT_ROUND_LIMIT,
  DAY_STUCK_STEPS,
  DEFAULT_SOFTLOCK,
  REJECT_MAX,
  STALL_STEPS_POLICY,
  SoftLockDetector,
  hardLock,
  progressSignature,
} from '@sim/softlock';
import { makeState } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';

const edit = (s: GameState, fn: (d: GameState) => void): GameState => {
  const d = structuredClone(s);
  fn(d);
  return d;
};

describe('progressSignature', () => {
  const base = makeState();

  test('equal states sign equal; the log does not count', () => {
    expect(progressSignature(structuredClone(base))).toBe(progressSignature(base));
    const logged = edit(base, (d) => d.recentLog.push({ step: 1, text: 'x', kind: 'system' }));
    expect(progressSignature(logged)).toBe(progressSignature(base));
  });

  const CHANGES: readonly (readonly [string, (d: GameState) => unknown])[] = [
    ['location', (d: GameState) => (d.world.currentLocationId = 'loc_shattered_library')],
    ['clock', (d: GameState) => (d.clock.ticks += 1)],
    ['hp', (d: GameState) => (d.player.hp -= 1)],
    ['gold', (d: GameState) => (d.player.gold += 1)],
    ['level', (d: GameState) => (d.player.level += 1)],
    ['inventory', (d: GameState) => d.player.inventory.pop()],
    ['flags', (d: GameState) => (d.flags['flag_x'] = true)],
    ['quest', (d: GameState) => (d.quests['q_echo_crystal'] = { status: 'active', stage: 'find_crystal', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] })],
    ['mode', (d: GameState) => (d.mode = 'title')],
    ['loop', (d: GameState) => (d.meta.loop = 2)],
    ['echoes', (d: GameState) => d.echoesThisLoop.push('echo_x')],
    ['dialogue node', (d: GameState) => (d.dialogue = { sceneId: 's', nodeId: 'n', npcId: null, visitedNodes: [], choicesTaken: [], returnMode: 'explore' })],
    ['ending slide', (d: GameState) => (d.pendingEnding = { outcome: 'closer_escape', slideIndex: 1 })],
    ['Threshold area', (d: GameState) => (d.threshold = { visited: ['still_shore', 'loom'], spentThisVisit: 0, pendingClassId: null })],
  ];
  test.each(CHANGES)('changes with the %s', (_what, fn) => {
    expect(progressSignature(edit(base, fn))).not.toBe(progressSignature(base));
  });
});

describe('SoftLockDetector', () => {
  test('defaults follow PLAN §7.6', () => {
    expect(DEFAULT_SOFTLOCK).toEqual({ stallSteps: 60, dayStuckSteps: 400, combatRounds: 60, rejectWindow: 50, rejectMax: 30 });
    expect(new SoftLockDetector().opts.stallSteps).toBe(STALL_STEPS_POLICY);
    expect(new SoftLockDetector({ stallSteps: 200 }).opts.stallSteps).toBe(200);
  });

  test('stall: the same signature K times in a row', () => {
    const s = makeState();
    const d = new SoftLockDetector({ stallSteps: 5 });
    for (let i = 1; i < 5; i++) expect(d.observe(s, i)).toBeNull();
    const hit = d.observe(s, 5);
    expect(hit).toMatchObject({ rule: 'stall', step: 5, signature: progressSignature(s) });
    expect(hit?.detail).toContain('5 steps');
  });

  test('stall: any change starts the count again', () => {
    const s = makeState();
    const other = edit(s, (x) => (x.player.gold += 1));
    const d = new SoftLockDetector({ stallSteps: 3 });
    for (let i = 0; i < 20; i++) expect(d.observe(i % 2 === 0 ? s : other, i)).toBeNull();
  });

  test('day stuck: the same day for N world steps with no quest stage change', () => {
    const s = makeState();
    const d = new SoftLockDetector({ dayStuckSteps: 10 });
    let hit = null;
    for (let i = 0; i < 11 && hit === null; i++) hit = d.observe(edit(s, (x) => (x.player.gold = i)), i); // gold differs: no stall
    expect(hit).toMatchObject({ rule: 'day_stuck' });
    expect(hit?.detail).toContain('Day 1');
  });

  test('day stuck: a new day, a quest stage or a new loop resets it; menus, fights and a frozen clock do not count', () => {
    const s = makeState();
    const run = (states: (i: number) => GameState, n: number): ReturnType<SoftLockDetector['observe']> => {
      const d = new SoftLockDetector({ dayStuckSteps: 10, stallSteps: 1000 });
      let hit = null;
      for (let i = 0; i < n && hit === null; i++) hit = d.observe(states(i), i);
      return hit;
    };
    expect(run((i) => edit(s, (x) => ((x.player.gold = i), (x.clock.ticks = 4 * Math.floor(i / 5)))), 30)).toBeNull();
    expect(
      run(
        (i) =>
          edit(s, (x) => {
            x.player.gold = i;
            x.quests['q_echo_crystal'] = { status: 'active', stage: Math.floor(i / 5) % 2 === 0 ? 'find_crystal' : 'crystal_found', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] };
          }),
        30,
      ),
    ).toBeNull();
    expect(run((i) => edit(s, (x) => ((x.player.gold = i), (x.meta.runId = `r${Math.floor(i / 5)}`))), 30)).toBeNull();
    expect(run((i) => edit(s, (x) => ((x.player.gold = i), (x.mode = 'threshold'))), 30)).toBeNull();
    expect(run((i) => edit(s, (x) => ((x.player.gold = i), (x.mode = 'dialogue'))), 30)).toBeNull();
    expect(run((i) => edit(s, (x) => ((x.player.gold = i), (x.clock.frozen = true))), 30)).toBeNull();
    expect(run((i) => edit(s, (x) => ((x.player.gold = i), (x.before = { day: 1, resets: 0 }))), 30)).toBeNull();
    expect(DAY_STUCK_STEPS).toBe(400);
  });

  test(`combat stall: a fight past round ${COMBAT_ROUND_LIMIT}`, () => {
    const { state } = loadScenario('first_fight', fixturePack());
    const d = new SoftLockDetector();
    expect(d.observe(state, 1)).toBeNull();
    const long = edit(state, (x) => ((x.combat as NonNullable<GameState['combat']>).round = COMBAT_ROUND_LIMIT + 1));
    expect(d.observe(long, 2)).toMatchObject({ rule: 'combat_stall', step: 2 });
  });

  test('hard lock: nothing legal outside the ending screens, or only the shell in explore', () => {
    const s = makeState();
    expect(hardLock(s, [])).toContain('no legal action');
    expect(hardLock(edit(s, (x) => (x.mode = 'ending')), [])).toBeNull();
    const shell: Action[] = [{ type: 'returnToTitle' }, { type: 'save', slot: 1 }];
    expect(hardLock(s, shell)).toContain('only returnToTitle/save');
    expect(hardLock(edit(s, (x) => (x.mode = 'threshold')), shell)).toBeNull();
    expect(hardLock(s, [{ type: 'wait' }])).toBeNull();
    expect(new SoftLockDetector().checkLegal(s, [], 7)).toMatchObject({ rule: 'hard_lock', step: 7 });
    expect(new SoftLockDetector().checkLegal(s, [{ type: 'wait' }], 7)).toBeNull();
  });

  test(`rejected storm: more than ${REJECT_MAX} rejections in a window of 50`, () => {
    const d = new SoftLockDetector();
    for (let i = 0; i < REJECT_MAX; i++) expect(d.observeRejection(true)).toBe(false);
    expect(d.observeRejection(true)).toBe(true);
    const calm = new SoftLockDetector();
    for (let i = 0; i < 500; i++) expect(calm.observeRejection(i % 2 === 0)).toBe(false); // 25 in any 50
  });
});
