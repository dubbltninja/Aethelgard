// The pieces the Journal, Codex and Bestiary share (U66): Tabs (ARIA tabs, roving focus, ←/→/Home/End), MasterDetail, the
// list-navigation helper, the focus helper's query; and the quest rings on the map (D-107).
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '@engine/index';
import { Icon, type IconKind } from '@ui/art/Icon';
import { MasterDetail } from '@ui/components/lore/MasterDetail';
import { Tabs, tabId, tabKeyTarget, tabPanelId } from '@ui/components/lore/Tabs';
import { NARROW_QUERY } from '@ui/components/lore/useLoreFocus';
import { neighbour } from '@ui/hooks/useListNav';
import { MapView } from '@ui/panels/MapPanel';
import { buildMap, nodeLabel, questHints } from '@ui/panels/mapModel';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, fakeEvent, nameOf } from './tree';

const content = fixturePack();

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Active', count: 2 },
    { id: 'b', label: 'Done', count: 0 },
    { id: 'c', label: 'People', count: null },
  ];

  test('tabKeyTarget: arrows wrap, Home and End jump, other keys do nothing', () => {
    expect(tabKeyTarget(tabs, 'a', 'ArrowRight')).toBe('b');
    expect(tabKeyTarget(tabs, 'c', 'ArrowRight')).toBe('a');
    expect(tabKeyTarget(tabs, 'a', 'ArrowLeft')).toBe('c');
    expect(tabKeyTarget(tabs, 'b', 'Home')).toBe('a');
    expect(tabKeyTarget(tabs, 'a', 'End')).toBe('c');
    expect(tabKeyTarget(tabs, 'a', 'x')).toBeNull();
    expect(tabKeyTarget(tabs, 'nope', 'Home')).toBeNull();
    expect(tabKeyTarget([], 'a', 'Home')).toBeNull();
  });

  test('a tablist of named tabs: counts are read with the label, only the selected one is in the tab order', () => {
    const onSelect = mock((_id: string) => undefined);
    const tree = expand(<Tabs tabs={tabs} active="b" label="Sections" idPrefix="x" onSelect={onSelect} />);
    expect(all(tree, 'div')[0]?.props.role).toBe('tablist');
    expect(all(tree, 'div')[0]?.props['aria-label']).toBe('Sections');
    const buttons = all(tree, 'button');
    expect(buttons.map(nameOf)).toEqual(['Active, 2', 'Done, 0', 'People']);
    expect(buttons.map((b) => b.props.tabIndex)).toEqual([-1, 0, -1]);
    expect(buttons.map((b) => b.props['aria-selected'])).toEqual([false, true, false]);
    expect(buttons[1]?.props.id).toBe(tabId('x', 'b'));
    expect(buttons[1]?.props['aria-controls']).toBe(tabPanelId('x'));
    call(buttons[0]!, 'onClick');
    expect(onSelect.mock.calls).toEqual([['a']]);
  });

  test('an arrow key selects the neighbour and moves focus to it; other keys are left alone', () => {
    const onSelect = mock((_id: string) => undefined);
    const tree = expand(<Tabs tabs={tabs} active="a" label="Sections" idPrefix="x" onSelect={onSelect} />);
    const focused: string[] = [];
    const target = { id: tabId('x', 'b'), focus: () => focused.push('b') };
    const event = (key: string) => {
      const e = fakeEvent();
      return Object.assign(e, { key, currentTarget: { parentElement: { querySelector: (sel: string) => (sel === `[id="${target.id}"]` ? target : null) } } });
    };
    const right = event('ArrowRight');
    call(all(tree, 'button')[0]!, 'onKeyDown', right);
    expect(right.prevented()).toBe(true);
    expect(onSelect.mock.calls).toEqual([['b']]);
    expect(focused).toEqual(['b']);
    const other = event('q');
    call(all(tree, 'button')[0]!, 'onKeyDown', other);
    expect(other.prevented()).toBe(false);
    expect(onSelect.mock.calls).toHaveLength(1);
  });
});

describe('MasterDetail and list navigation', () => {
  test('a list column, a detail column with a Back button, and the view that shows', () => {
    const onBack = mock(() => undefined);
    const props = { list: <p>list</p>, detail: <p>detail</p>, listLabel: 'Quests', backLabel: 'Back to quests', onBack };
    const tree = expand(<MasterDetail {...props} view="detail" />);
    expect(all(tree, 'nav')[0]?.props['aria-label']).toBe('Quests');
    call(byName(tree, 'button', 'Back to quests'), 'onClick');
    expect(onBack.mock.calls).toHaveLength(1);
    expect(renderToStaticMarkup(<MasterDetail {...props} view="detail" />)).toContain('data-view="detail"');
    const wired = renderToStaticMarkup(<MasterDetail {...props} view="list" panel={{ id: 'p', labelledBy: 't' }} />);
    expect(wired).toContain('role="tabpanel"');
    expect(wired).toContain('aria-labelledby="t"');
    expect(renderToStaticMarkup(<MasterDetail {...props} view="list" />)).not.toContain('role="tabpanel"');
  });

  test('neighbour: the next and previous item wrap; from outside the list the first or the last; an empty list has none', () => {
    const items = ['a', 'b', 'c'];
    expect(neighbour(items, 'a', 1)).toBe('b');
    expect(neighbour(items, 'c', 1)).toBe('a');
    expect(neighbour(items, 'a', -1)).toBe('c');
    expect(neighbour(items, null, 1)).toBe('a');
    expect(neighbour(items, null, -1)).toBe('c');
    expect(neighbour(items, 'z', 1)).toBe('a');
    expect(neighbour([], 'a', 1)).toBeNull();
  });

  test('the narrow-screen query is the 760 px breakpoint of lore.css', () => {
    expect(NARROW_QUERY).toBe('(max-width: 759.98px)');
  });

  test('the four new icons draw', () => {
    for (const kind of ['quest', 'journal', 'codex', 'bestiary'] as IconKind[]) expect(renderToStaticMarkup(<Icon kind={kind} />)).toContain('<svg');
  });
});

function withQuest(): { state: GameState; profile: ReturnType<typeof freshProfile> } {
  const store = createGameStore(content, freshProfile('l'), { storage: null });
  store.shell.newGame('Ann', 'ranger', 'lore');
  store.dispatch({ type: 'talk', npcId: 'npc_ilyra' });
  store.dispatch({ type: 'choose', choiceId: 'yes' });
  return { state: store.getState(), profile: store.getProfile() };
}

describe('quest rings (D-107)', () => {
  test('an active quest’s open objective with a place hint rings that place, once per quest', () => {
    const { state } = withQuest();
    expect([...questHints(state, content)]).toEqual([['loc_shattered_library', ['Echoes in the Library']]]);
    const done = structuredClone(state);
    done.quests.q_echo_crystal!.objectivesDone.push('obj_reach_library');
    expect([...questHints(done, content)]).toEqual([]);
    const over = structuredClone(state);
    over.quests.q_echo_crystal!.status = 'completed';
    expect([...questHints(over, content)]).toEqual([]);
  });

  test('before any quest nothing is ringed; after it the node carries the quest and says so in its name', () => {
    const fresh = createGameStore(content, freshProfile('l'), { storage: null });
    fresh.shell.newGame('Ann', 'ranger', 'lore');
    expect(buildMap(fresh.getState(), content, fresh.getProfile()).nodes.every((n) => n.quests.length === 0)).toBe(true);
    const { state, profile } = withQuest();
    const map = buildMap(state, content, profile);
    const library = map.nodes.find((n) => n.id === 'loc_shattered_library')!;
    expect(library.quests).toEqual(['Echoes in the Library']);
    expect(nodeLabel(library)).toContain('quest: Echoes in the Library');
    const html = renderToStaticMarkup(<MapView model={map} selected={null} preview={null} route={null} onNode={() => undefined} onGo={() => undefined} onCenter={() => undefined} />);
    expect(html).toContain('map-node--quest');
    expect(html).toContain('A quest points here');
    expect(map.nodes.filter((n) => n.quests.length > 0)).toHaveLength(1);
  });
});
