// The Quest journal (U66; DESIGN §13.1, §12.5, §16.3 `screen_quest_log`): the model (groups, objectives with their hints,
// rewards, faction tiers, companion loyalty) and JournalView's tabs, list, detail and People tab, driven through
// tests/unit/ui/tree.ts. The panel's focus and keys are e2e's (tests/e2e/dialogue.spec.ts).
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryStorage, type GameState } from '@engine/index';
import { PanelHost } from '@ui/panels/PanelHost';
import { QuestDetail, JournalView, StandingView } from '@ui/panels/JournalPanel';
import { EMPTY_TEXT, LOYALTY_MILESTONES, companionStandings, factionStandings, firstTab, journalModel, questLine, questRow, rowsOf } from '@ui/panels/journalModel';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, nameOf } from './tree';

const content = fixturePack();

function started(): GameState {
  const store = createGameStore(content, freshProfile('j'), { storage: null });
  store.shell.newGame('Ann', 'ranger', 'jrnl');
  return store.getState();
}

function withQuest(): GameState {
  const store = createGameStore(content, freshProfile('j'), { storage: null });
  store.shell.newGame('Ann', 'ranger', 'jrnl');
  store.dispatch({ type: 'talk', npcId: 'npc_ilyra' });
  store.dispatch({ type: 'choose', choiceId: 'yes' });
  return store.getState();
}

const edit = (state: GameState, fn: (s: GameState) => void): GameState => {
  const s = structuredClone(state);
  fn(s);
  return s;
};

describe('journalModel', () => {
  test('no quest yet: empty groups, the Active tab, every faction still listed', () => {
    const model = journalModel(started(), content);
    expect([model.active, model.completed, model.failed]).toEqual([[], [], []]);
    expect(model.tabs.map((t) => [t.id, t.label, t.count])).toEqual([
      ['active', 'Active', 0],
      ['completed', 'Completed', 0],
      ['failed', 'Failed', 0],
      ['standing', 'People', null],
    ]);
    expect(firstTab(model)).toBe('active');
    expect(model.factions.map((f) => f.id)).toEqual(['remnants']);
    expect(model.companions).toEqual([]);
  });

  test('an accepted quest: its blurb, the stage’s journal text, objectives with the place a hint names, what it pays, who gave it', () => {
    const model = journalModel(withQuest(), content);
    expect(model.active).toHaveLength(1);
    const q = model.active[0]!;
    expect(q).toMatchObject({
      id: 'q_echo_crystal',
      name: 'Echoes in the Library',
      status: 'active',
      category: 'Main road',
      giver: 'Ilyra',
      rewardsLabel: 'Reward',
      progress: '0 of 2 done',
    });
    expect(q.journal).toContain('Retrieve the Echo Crystal');
    expect(q.objectives[0]).toMatchObject({ id: 'obj_reach_library', done: false, where: 'Shattered Library' });
    expect(q.objectives[1]).toMatchObject({ id: 'obj_take_crystal', where: null });
    expect(q.rewards).toEqual(['120 XP', '20 gold']);
    expect(q.days).toMatch(/^Started on Day \d+$/);
    expect(model.tabs[0]).toMatchObject({ count: 1 });
    expect(questLine(q)).toBe('Echoes in the Library, 0 of 2 done');
    expect(rowsOf(model, 'active')).toBe(model.active);
    expect(rowsOf(model, 'standing')).toEqual([]);
  });

  test('a finished quest reads "Earned" with its ending text; a failed one pays nothing; the first tab follows what exists', () => {
    const base = withQuest();
    const done = edit(base, (s) => {
      Object.assign(s.quests.q_echo_crystal!, { status: 'completed', stage: 'crystal_found', endedDay: 4 });
    });
    const model = journalModel(done, content);
    expect(model.active).toEqual([]);
    expect(model.completed[0]?.rewardsLabel).toBe('Earned');
    expect(model.completed[0]?.journal).toContain('Ilyra is waiting');
    expect(model.completed[0]?.days).toBe('Finished on Day 4');
    expect(model.completed[0]?.objectives).toEqual([]);
    expect(firstTab(model)).toBe('completed');
    const failed = edit(base, (s) => {
      Object.assign(s.quests.q_echo_crystal!, { status: 'failed', endedDay: null });
    });
    const f = journalModel(failed, content);
    expect(f.failed[0]).toMatchObject({ rewardsLabel: null, rewards: [], days: 'Failed' });
    expect(firstTab(f)).toBe('failed');
  });

  test('questRow reads a quest the pack no longer has without throwing', () => {
    const row = questRow({ questId: 'q_gone', name: 'Gone', description: 'd', status: 'active', stage: 's', journal: 'j', objectives: [{ id: 'o', text: 't', done: false, optional: true }], history: [], startedDay: null, endedDay: null }, content);
    expect(row).toMatchObject({ category: '', giver: null, rewards: [], progress: null, days: '' });
    expect(row.objectives[0]).toMatchObject({ optional: true, where: null });
  });

  test('faction standing: tier, its line, how far to the next tier, the meter percent', () => {
    const s = edit(started(), (x) => {
      x.reputation.remnants = 30;
    });
    const [f] = factionStandings(s, content);
    expect(f).toMatchObject({ id: 'remnants', value: 30, tier: 'trusted', tierLabel: 'Trusted', line: 'They show you the margins.', percent: 65 });
    expect(f?.next).toMatch(/^Sworn at \d+ \(\d+ more\)$/);
    const hostile = factionStandings(edit(started(), (x) => void (x.reputation.remnants = -100)), content)[0]!;
    expect(hostile).toMatchObject({ tier: 'hostile', percent: 0 });
    const sworn = factionStandings(edit(started(), (x) => void (x.reputation.remnants = 100)), content)[0]!;
    expect(sworn).toMatchObject({ tier: 'sworn', next: null, percent: 100 });
  });

  test('companion standing: where they are and the next loyalty milestone', () => {
    const run = (over: object) =>
      edit(started(), (x) => {
        x.companions.recruited.ilyra = { id: 'ilyra', recruited: true, loyalty: 30, ko: false, dead: false, waitingAt: null, ...over } as unknown as GameState['companions']['recruited'][string];
      });
    expect(companionStandings(started(), content)).toEqual([]);
    const withYou = companionStandings(edit(run({}), (x) => void (x.companions.activeId = 'ilyra')), content)[0]!;
    expect(withYou).toMatchObject({ name: 'Ilyra', loyalty: 30, state: 'with you', next: `At 50: ${LOYALTY_MILESTONES[1]!.text}` });
    expect(companionStandings(run({ waitingAt: 'loc_shattered_library' }), content)[0]?.state).toBe('waiting');
    expect(companionStandings(run({}), content)[0]?.state).toBe('not with you');
    expect(companionStandings(run({ ko: true }), content)[0]?.state).toBe('knocked out');
    expect(companionStandings(run({ dead: true }), content)[0]?.state).toBe('fallen');
    expect(companionStandings(run({ loyalty: 100 }), content)[0]?.next).toBeNull();
    expect(companionStandings(run({ recruited: false }), content)).toEqual([]);
  });
});

describe('JournalView', () => {
  const model = journalModel(withQuest(), content);
  const props = { model, tab: 'active' as const, selectedId: null, view: 'list' as const, onTab: () => undefined, onSelect: () => undefined, onBack: () => undefined };

  test('four named tabs with counts; the active one is selected; a tab press asks for that tab', () => {
    const onTab = mock((_t: string) => undefined);
    const tree = expand(<JournalView {...props} onTab={onTab} />);
    expect(all(tree, 'button').filter((b) => b.props.role === 'tab').map(nameOf)).toEqual(['Active, 1', 'Completed, 0', 'Failed, 0', 'People']);
    expect(byName(tree, 'button', 'Active, 1').props['aria-selected']).toBe(true);
    call(byName(tree, 'button', 'People'), 'onClick');
    expect(onTab.mock.calls).toEqual([['standing']]);
  });

  test('the list names each quest with its progress; picking one selects it; the detail shows the first by default', () => {
    const onSelect = mock((_id: string) => undefined);
    const tree = expand(<JournalView {...props} onSelect={onSelect} />);
    const item = byName(tree, 'button', 'Echoes in the Library, 0 of 2 done');
    expect(item.props['aria-current']).toBe('true');
    call(item, 'onClick');
    expect(onSelect.mock.calls).toEqual([['q_echo_crystal']]);
    expect(all(tree, 'h3').map(nameOf)).toContain('Echoes in the Library');
    const back = byName(tree, 'button', 'Back to quests');
    expect(back).toBeDefined();
  });

  test('the back button goes back; an empty tab says so; the tab panel is wired to its tab', () => {
    const onBack = mock(() => undefined);
    const tree = expand(<JournalView {...props} view="detail" onBack={onBack} />);
    call(byName(tree, 'button', 'Back to quests'), 'onClick');
    expect(onBack.mock.calls).toHaveLength(1);
    const empty = renderToStaticMarkup(<JournalView {...props} tab="failed" />);
    expect(empty).toContain(EMPTY_TEXT.failed);
    expect(empty).toContain('role="tabpanel"');
    expect(empty).toContain('aria-labelledby="journal-tab-failed"');
    expect(renderToStaticMarkup(<JournalView {...props} tab="completed" />)).toContain(EMPTY_TEXT.completed);
    expect(renderToStaticMarkup(<JournalView {...props} />)).toContain('data-view="list"');
  });

  test('the quest detail: where it stands, objectives with to-do words and the hint, rewards, history', () => {
    const q = model.active[0]!;
    const html = renderToStaticMarkup(<QuestDetail row={{ ...q, history: [{ stage: 'a', journal: 'Earlier text.' }] }} />);
    expect(html).toContain('Where it stands');
    expect(html).toContain('To do: ');
    expect(html).toContain('near Shattered Library');
    expect(html).toContain('120 XP');
    expect(html).toContain('Earlier in this quest (1)');
    expect(html).toContain('from Ilyra');
    const done = renderToStaticMarkup(<QuestDetail row={{ ...q, status: 'completed', rewardsLabel: 'Earned', objectives: [{ id: 'o', text: 'Done thing', done: true, optional: true, where: null }] }} />);
    expect(done).toContain('How it ended');
    expect(done).toContain('Done: ');
    expect(done).toContain('(optional)');
    expect(renderToStaticMarkup(<QuestDetail row={{ ...q, status: 'failed', rewardsLabel: null, objectives: [], progress: null, giver: null, days: '' }} />)).toContain('How it failed');
  });

  test('the People tab: a labelled meter per faction and companion, and a line for an empty party', () => {
    const s = edit(withQuest(), (x) => {
      x.reputation.remnants = 30;
      x.companions.recruited.ilyra = { id: 'ilyra', recruited: true, loyalty: 100, ko: false, dead: false, waitingAt: null } as unknown as GameState['companions']['recruited'][string];
    });
    const m = journalModel(s, content);
    const tree = expand(<StandingView model={m} />);
    const meters = all(tree, 'div').filter((d) => d.props.role === 'meter');
    expect(meters.map((x) => x.props['aria-label'])).toEqual(['Remnants of Aethelgard standing', 'Ilyra loyalty']);
    expect(meters[0]?.props['aria-valuetext']).toBe('Trusted · 30');
    expect(renderToStaticMarkup(<StandingView model={m} />)).toContain('A full bond.');
    expect(renderToStaticMarkup(<StandingView model={journalModel(started(), content)} />)).toContain('No one travels with you yet.');
    expect(renderToStaticMarkup(<JournalView {...props} model={m} tab="standing" />)).toContain('Factions');
  });
});

describe('PanelHost', () => {
  test('the journal renders in the shared modal from a live store, on the tab that has quests', () => {
    const store = createGameStore(content, freshProfile('p'), { initialState: withQuest(), storage: memoryStorage() });
    const html = renderToStaticMarkup(
      <GameProvider value={store}>
        <PanelHost id="journal" onClose={() => undefined} />
      </GameProvider>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Echoes in the Library');
    expect(html).toContain('aria-selected="true"');
    const empty = createGameStore(content, freshProfile('p'), { initialState: started(), storage: null });
    expect(
      renderToStaticMarkup(
        <GameProvider value={empty}>
          <PanelHost id="journal" onClose={() => undefined} />
        </GameProvider>,
      ),
    ).toContain(EMPTY_TEXT.active);
  });
});
