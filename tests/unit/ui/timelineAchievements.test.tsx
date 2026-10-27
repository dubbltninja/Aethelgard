// The Loop Timeline and the Achievements panel (U68; DESIGN §10.3, §15.2, §16.3) on the real pack: the models (a row per loop of
// the profile with what it learned, the loop under way as the last row, ending hints from the profile alone; the forty badges,
// hidden ones as "???", progress where a count can be read) and their views driven through tests/unit/ui/tree.ts.
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryStorage } from '@engine/index';
import { AchievementsPanel, AchievementsView } from '@ui/panels/AchievementsPanel';
import { achievementRow, achievementsModel, countOf, HIDDEN_NAME, HIDDEN_TEXT } from '@ui/panels/achievementsModel';
import { TimelinePanel, TimelineView } from '@ui/panels/TimelinePanel';
import { timelineModel } from '@ui/panels/timelineModel';
import { createGameStore } from '@ui/store/gameStore';
import { GameProvider } from '@ui/store/useGame';
import { all, nameOf, expand } from './tree';
import { earnedAt, liveAt, mutable, pack, thresholdAt } from './thresholdFixtures';

describe('timelineModel', () => {
  test('at the Threshold: one row per loop of the profile, oldest first, each with its outcome and what it taught', () => {
    const at = thresholdAt();
    const m = timelineModel(at.state, pack, at.profile);
    expect(m.rows.map((r) => r.loop)).toEqual([1, 2]);
    expect(m.rows.every((r) => !r.inProgress && r.outcome !== null)).toBe(true);
    const second = m.rows[1]!;
    expect(second).toMatchObject({ className: 'Ranger', days: 1, axisMax: 30 });
    expect(second.outcome).toEqual({ kind: 'fall', label: 'The Fall · Let go' });
    expect(second.learned.map((e) => e.name)).toEqual(['The Amulet Remembers']);
    expect(m.endings).toBe('Endings reached: 0 of 6');
    expect(m.hints.length).toBeGreaterThan(0);
    expect(m.empty).toBeNull();
  });

  test('in a loop under way the last row is that loop, in progress, with its clock’s length', () => {
    const at = liveAt();
    const m = timelineModel(at.state, pack, at.profile);
    const live = m.rows[m.rows.length - 1]!;
    expect(live).toMatchObject({ inProgress: true, outcome: null, loop: at.state.meta.loop });
    expect(live.axisMax).toBe(Math.round(at.state.clock.limitTicks / 4));
    expect(m.rows.length).toBe(at.profile.runHistory.length + 1);
  });

  test('a profile with no finished loop and no loop under way says so; reaching every ending drops the hints', () => {
    const at = mutable(thresholdAt());
    at.profile.runHistory = [];
    expect(timelineModel(at.state, pack, at.profile).empty).toBe('No loop has ended yet. When one does, it is drawn here.');
    at.profile.endingsReached = Object.values(pack.endings)
      .filter((e) => e?.kind === 'true')
      .map((e) => e!.id);
    const m = timelineModel(at.state, pack, at.profile);
    expect(m.endings).toBe('Endings reached: 6 of 6');
    expect(m.hints).toEqual([]);
  });

  test('a loop’s choices show as marks with words', () => {
    const at = mutable(thresholdAt());
    at.profile.runHistory[1] = { ...at.profile.runHistory[1]!, tyrant: 'defeated', modifiers: ['mod_glass'] };
    const row = timelineModel(at.state, pack, at.profile).rows[1]!;
    expect(row.glyphs.map((g) => g.text)).toEqual(['Tyrant: Struck down', 'Glass']);
  });
});

describe('TimelineView', () => {
  test('rows are a list with a day meter each, the outcome in words, and the Echoes as pins', () => {
    const at = thresholdAt();
    const tree = expand(<TimelineView model={timelineModel(at.state, pack, at.profile)} />);
    const list = tree.find((n) => n.type === 'ol' && n.props['aria-label'] === 'Loops, oldest first')!;
    expect(list.children).toHaveLength(2);
    const meters = tree.filter((n) => n.props.role === 'meter');
    expect(meters.map((m) => m.props['aria-label'])).toEqual(['Loop 1 days', 'Loop 2 days']);
    expect(meters[1]?.props['aria-valuetext']).toBe('Day 1 of 30');
    expect(tree.some((n) => n.props.className === 'timeline__outcome' && n.text === 'The Fall · Let go')).toBe(true);
    expect(tree.some((n) => n.props.className === 'timeline__pin-name' && n.text === 'The Amulet Remembers')).toBe(true);
    expect(all(tree, 'h3').map(nameOf)).toEqual(['Loop 1', 'Loop 2', 'Endings not yet met']);
  });

  test('the loop in progress is marked as such', () => {
    const at = liveAt();
    const tree = expand(<TimelineView model={timelineModel(at.state, pack, at.profile)} />);
    expect(tree.some((n) => n.props.className === 'timeline__outcome' && n.text === 'In progress')).toBe(true);
  });

  test('renders inside the store', () => {
    const at = thresholdAt();
    const store = createGameStore(pack, at.profile, { initialState: at.state, storage: memoryStorage() });
    const html = renderToStaticMarkup(
      <GameProvider value={store}>
        <TimelinePanel />
      </GameProvider>,
    );
    expect(html).toContain('Loop 2');
    expect(html).toContain('Endings reached: 0 of 6');
  });
});

describe('achievementsModel', () => {
  test('forty rows in the pack’s order; hidden ones are ??? until earned', () => {
    const at = thresholdAt();
    const m = achievementsModel(at.state, pack, at.profile);
    expect(m.total).toBe(40);
    // U81a: the engine awards them now; the scenario earned a few on its way (none of them hidden)
    expect(m.earned).toBe(earnedAt(at));
    expect(Object.keys(at.profile.achievements).sort()).toEqual(['ach_first_steps', 'ach_loop_two', 'ach_the_fall']);
    const hidden = m.rows.filter((r) => r.hidden && !r.earned);
    expect(hidden.length).toBeGreaterThan(0);
    expect(m.rows.find((r) => r.id === 'ach_loop_two')).toMatchObject({ hidden: true, earned: true, name: 'Day One, Again' });
    expect(hidden.every((r) => r.name === HIDDEN_NAME && r.description === HIDDEN_TEXT && r.progress === null)).toBe(true);
    expect(m.rows.filter((r) => !r.hidden).every((r) => r.name !== HIDDEN_NAME)).toBe(true);
  });

  test('earned ones show their name and the loop and day they came, even hidden ones', () => {
    const at = mutable(thresholdAt());
    const secret = Object.values(pack.achievements).find((a) => a?.hidden === true && at.profile.achievements[a.id] === undefined)!;
    const before = earnedAt(at);
    at.profile.achievements[secret.id] = { loop: 3, day: 5, runId: 'r' };
    const m = achievementsModel(at.state, pack, at.profile);
    expect(m.earned).toBe(before + 1);
    const row = m.rows.find((r) => r.id === secret.id)!;
    expect(row).toMatchObject({ earned: true, name: secret.name, when: 'Loop 3, Day 5', progress: null });
  });

  test('progress is drawn from the profile where a count can be read: Every Door counts the ending Echoes', () => {
    const at = mutable(thresholdAt());
    const door = pack.achievements['ach_all_endings']!;
    at.profile.echoes.push('echo_ending_a', 'echo_ending_b');
    const row = achievementRow(door, at.state, at.profile, pack);
    expect(row.progress).toEqual({ have: 2, need: 6, unit: '' });
  });

  test('countOf: profile tallies are read, per-run counters only while a loop is under way, other tallies are not guessed', () => {
    const at = mutable(thresholdAt());
    expect(countOf({ counter: { name: 'tally_closer_escape', min: 3 } }, at.state, at.profile, pack)).toEqual({ have: 0, need: 3, unit: '' });
    expect(countOf({ counter: { name: 'tally_classes_finished', min: 5 } }, at.state, at.profile, pack)).toEqual({ have: 1, need: 5, unit: '' });
    expect(countOf({ counter: { name: 'tally_new_game_plus', min: 2 } }, at.state, { ...at.profile, newGamePlus: 1 }, pack)).toEqual({ have: 1, need: 2, unit: '' });
    expect(countOf({ counter: { name: 'tally_kills', min: 9 } }, at.state, at.profile, pack)).toBeNull();
    expect(countOf({ counter: { name: 'quests_completed', min: 6 } }, at.state, at.profile, pack)).toBeNull(); // the Threshold has no loop to count
    const live = liveAt();
    expect(countOf({ counter: { name: 'quests_completed', min: 6 } }, live.state, live.profile, pack)).toEqual({ have: 0, need: 6, unit: 'this loop' });
    expect(countOf({ all: [{ loop: { max: 1 } }, { counter: { name: 'quests_completed', min: 6 } }] }, live.state, live.profile, pack)).toEqual({ have: 0, need: 6, unit: 'this loop' });
    expect(countOf({ counter: { name: 'quests_completed', min: 1 } }, live.state, live.profile, pack)).toBeNull(); // a single thing is not a count
    expect(countOf({ flag: 'flag_x' }, live.state, live.profile, pack)).toBeNull();
  });
});

describe('AchievementsView', () => {
  test('a list of forty badges with the status in words, hidden ones as ???', () => {
    const at = thresholdAt();
    const tree = expand(<AchievementsView model={achievementsModel(at.state, pack, at.profile)} />);
    const list = tree.find((n) => n.type === 'ul' && n.props['aria-label'] === 'Achievements')!;
    expect(list.children).toHaveLength(40);
    expect(tree.find((n) => n.props['data-testid'] === 'achievements-count')?.text).toBe(`${earnedAt(at)} of 40 earned`);
    expect(all(tree, 'h3').some((n) => nameOf(n) === HIDDEN_NAME)).toBe(true);
    expect(tree.filter((n) => n.props.className === 'badge__status').some((n) => n.text === 'Hidden')).toBe(true);
  });

  test('an earned badge says Earned with its loop and day; progress is a meter with a value text', () => {
    const at = mutable(thresholdAt());
    const first = Object.values(pack.achievements)[0]!;
    at.profile.achievements[first.id] = { loop: 2, day: 1, runId: 'r' };
    at.profile.echoes.push('echo_ending_a');
    const tree = expand(<AchievementsView model={achievementsModel(at.state, pack, at.profile)} />);
    expect(tree.some((n) => n.props.className === 'badge__status' && n.text === 'Earned · Loop 2, Day 1')).toBe(true);
    const meters = tree.filter((n) => n.props.role === 'meter');
    expect(meters.length).toBeGreaterThan(0);
    expect(meters.every((m) => typeof m.props['aria-valuetext'] === 'string' && typeof m.props['aria-label'] === 'string')).toBe(true);
  });

  test('renders inside the store', () => {
    const at = thresholdAt();
    const store = createGameStore(pack, at.profile, { initialState: at.state, storage: memoryStorage() });
    const html = renderToStaticMarkup(
      <GameProvider value={store}>
        <AchievementsPanel />
      </GameProvider>,
    );
    expect(html).toContain(`${earnedAt(at)} of 40 earned`);
  });
});
