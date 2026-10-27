// U69 tab bar and Menu panel (DESIGN §16.1; D-107's open question): the five tabs, which one is current, which are off, what the
// Menu holds, and the pure views' handlers.
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MenuList } from '@ui/panels/MenuPanel';
import { menuEntries, tabBarItems, tabOfPanel } from '@ui/panels/menuModel';
import { PANEL_COMPONENTS } from '@ui/panels/PanelHost';
import { legalPanels, type PanelId } from '@ui/panels/panels';
import { TabBarView } from '@ui/components/TabBar';
import { all, byName, call, expand, nameOf } from './tree';

const everything = (): boolean => true;
const nothing = (): boolean => false;

describe('tabBarItems', () => {
  test('five tabs in DESIGN §16.1 order, Explore current when nothing is open', () => {
    const tabs = tabBarItems(everything, null);
    expect(tabs.map((t) => t.label)).toEqual(['Explore', 'Journal', 'Pack', 'Map', 'Menu']);
    expect(tabs.map((t) => t.panel)).toEqual([null, 'journal', 'inventory', 'map', 'menu']);
    expect(tabs.filter((t) => t.current).map((t) => t.id)).toEqual(['explore']);
    expect(tabs.some((t) => t.disabled)).toBe(false);
  });

  test('the open panel decides the current tab; scene panels leave Explore current', () => {
    const current = (p: PanelId | null): string => tabBarItems(everything, p).find((t) => t.current)!.id;
    expect(current('journal')).toBe('journal');
    expect(current('inventory')).toBe('pack');
    expect(current('equipment')).toBe('pack');
    expect(current('map')).toBe('map');
    for (const p of ['codex', 'bestiary', 'abilities', 'timeline', 'achievements', 'saves', 'settings', 'help', 'menu'] as const) expect(current(p)).toBe('menu');
    for (const p of ['merchant', 'crafting', 'camp', 'companion'] as const) expect(current(p)).toBe('explore');
    expect(tabOfPanel(null)).toBe('explore');
  });

  test('a tab whose panel cannot open is off; Explore never is', () => {
    const tabs = tabBarItems((p) => p !== 'journal', null);
    expect(tabs.filter((t) => t.disabled).map((t) => t.id)).toEqual(['journal']);
    expect(tabBarItems(nothing, null).filter((t) => t.disabled).map((t) => t.id)).toEqual(['journal', 'pack', 'map', 'menu']);
  });

  test('every panel a tab or a menu row opens has a component and is allowed on the Explore screen', () => {
    for (const tab of tabBarItems(everything, null)) {
      if (tab.panel === null) continue;
      expect(PANEL_COMPONENTS[tab.panel]).toBeDefined();
      expect(legalPanels('explore')).toContain(tab.panel);
    }
    for (const entry of menuEntries(everything, true)) {
      if (entry.id === 'title') continue;
      expect(PANEL_COMPONENTS[entry.id]).toBeDefined();
      expect(legalPanels('explore')).toContain(entry.id);
    }
  });
});

describe('TabBarView', () => {
  test('a named nav of five buttons; the current one says so; each reports its tab', () => {
    const chosen: string[] = [];
    const tabs = tabBarItems(everything, 'map');
    const tree = expand(<TabBarView tabs={tabs} onChoose={(t) => chosen.push(t.id)} />);
    expect(all(tree, 'nav').map((n) => n.props['aria-label'])).toEqual(['Game menu']);
    expect(all(tree, 'button').map(nameOf)).toEqual(['Explore', 'Journal', 'Pack', 'Map', 'Menu']);
    expect(all(tree, 'button').filter((b) => b.props['aria-current'] === 'page').map(nameOf)).toEqual(['Map']);
    const focus = mock(() => undefined);
    for (const name of ['Explore', 'Journal', 'Pack', 'Map', 'Menu']) call(byName(tree, 'button', name), 'onClick', { currentTarget: { focus } });
    expect(focus).toHaveBeenCalledTimes(5);
    expect(chosen).toEqual(['explore', 'journal', 'pack', 'map', 'menu']);
  });

  test('a disabled tab is a disabled button', () => {
    const tree = expand(<TabBarView tabs={tabBarItems((p) => p !== 'map', null)} onChoose={() => undefined} />);
    expect(byName(tree, 'button', 'Map').props.disabled).toBe(true);
    expect(byName(tree, 'button', 'Journal').props.disabled).toBe(false);
  });
});

describe('the Menu', () => {
  test('lists what the Shell can open, then Return to title only where the game may leave', () => {
    expect(menuEntries(everything, true).map((e) => e.label)).toEqual(['Abilities', 'Codex', 'Bestiary', 'Loop timeline', 'Achievements', 'Saves', 'Settings', 'Keys', 'Return to title']);
    expect(menuEntries((p) => p === 'saves' || p === 'settings', false).map((e) => e.id)).toEqual(['saves', 'settings']);
    expect(menuEntries(nothing, false)).toEqual([]);
  });

  test('every row is a named button; the first takes focus; a row reports its entry', () => {
    const chose = mock((_id: string) => undefined);
    const entries = menuEntries(everything, true);
    const tree = expand(<MenuList entries={entries} onChoose={(e) => chose(e.id)} />);
    const buttons = all(tree, 'button');
    expect(buttons).toHaveLength(entries.length);
    expect(buttons[0]?.props['data-autofocus']).toBe('');
    expect(buttons.slice(1).every((b) => b.props['data-autofocus'] === undefined)).toBe(true);
    expect(buttons.every((b) => nameOf(b) !== '')).toBe(true);
    call(byName(tree, 'button', /^Codex/), 'onClick');
    call(byName(tree, 'button', /^Return to title/), 'onClick');
    expect(chose.mock.calls.map((c) => c[0])).toEqual(['codex', 'title']);
    expect(renderToStaticMarkup(<MenuList entries={entries} onChoose={() => undefined} />)).toContain('aria-label="More of the game"');
  });
});
