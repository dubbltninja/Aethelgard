// Keys U64 adds to the foundation (PLAN §6.6, DESIGN §16.4): a panel's own content keys (`inPanel`) are reached above
// the panel's modal Esc layer even though the Modal registers after its children; WASD on the map only; the map's
// arrow keys and the Explore screen's resolve by where focus is; the Shell's panel letters come from PANEL_KEYS.
import { describe, expect, test } from 'bun:test';
import { resolveHotkey, type HotkeyLayer, type HotkeyMap } from '@ui/hooks/hotkeys';
import { HOTKEY_LEVELS, createHotkeyRegistry } from '@ui/hooks/useHotkeys';
import { PANEL_COMPONENTS } from '@ui/panels/PanelHost';
import { PANEL_KEYS, legalPanels } from '@ui/panels/panels';
import { ARROW_DIRS, DIR_LABELS, DIR_ORDER } from '@ui/screens/exploreModel';

const bind = (label: string, when?: () => boolean): HotkeyMap[string] => ({ run: () => undefined, label, ...(when === undefined ? {} : { when }) });

describe('a panel’s content keys (the map in the Map panel)', () => {
  test('inPanel sits between the panel and a dialog', () => {
    expect(HOTKEY_LEVELS.inPanel).toBeGreaterThan(HOTKEY_LEVELS.panel);
    expect(HOTKEY_LEVELS.inPanel).toBeLessThan(HOTKEY_LEVELS.dialog);
  });

  test('registered before the modal Esc layer (a child effect runs first), the map’s keys still resolve; the screen’s do not', () => {
    const registry = createHotkeyRegistry();
    const screen: HotkeyLayer = { id: 'screen', scope: 'Explore', map: { arrowup: bind('Choose a way on'), t: bind('Talk') } };
    const map: HotkeyLayer = { id: 'map', scope: 'Map', map: { arrowup: bind('Select the way north'), w: bind('Select the way north') } };
    const esc: HotkeyLayer = { id: 'modal', scope: 'Map', map: { escape: bind('Close') }, modal: true };
    registry.register('screen', 'screen', () => screen);
    registry.register('map', 'inPanel', () => map); // the child
    registry.register('modal', 'panel', () => esc); // the Modal, its parent, last
    const layers = registry.layers();
    expect(layers.map((l) => l.id)).toEqual(['map', 'modal', 'screen']);
    const ctx = { inCombat: false, focusInInput: false, onMap: true };
    expect(resolveHotkey(layers, { key: 'ArrowUp' }, ctx)?.layer).toBe('map');
    expect(resolveHotkey(layers, { key: 'w' }, ctx)?.layer).toBe('map');
    expect(resolveHotkey(layers, { key: 'Escape' }, ctx)?.layer).toBe('modal');
    expect(resolveHotkey(layers, { key: 't' }, ctx)).toBeNull(); // the screen is behind the modal
    // WASD only with focus on the map
    expect(resolveHotkey(layers, { key: 'w' }, { ...ctx, onMap: false })).toBeNull();
  });

  test('docked on the screen: arrows go to the map when it has focus, to the exits otherwise', () => {
    let inMap = false;
    const screen: HotkeyLayer = { id: 'screen', scope: 'Explore', map: { arrowup: bind('Choose a way on', () => !inMap) } };
    const docked: HotkeyLayer = { id: 'docked', scope: 'Map', map: { arrowup: bind('Select the way north', () => inMap) } };
    const layers = [screen, docked]; // the screen registers after its child map, so it is searched first
    expect(resolveHotkey(layers, { key: 'ArrowUp' }, { inCombat: false, focusInInput: false })?.layer).toBe('screen');
    inMap = true;
    expect(resolveHotkey(layers, { key: 'ArrowUp' }, { inCombat: false, focusInInput: false, onMap: true })?.layer).toBe('docked');
  });
});

describe('panel letters and directions', () => {
  test('M opens the Map, which is registered and legal while exploring (not in a fight)', () => {
    expect(PANEL_KEYS.map).toBe('m');
    expect(PANEL_COMPONENTS.map).toBeDefined();
    expect(legalPanels('explore')).toContain('map');
    expect(legalPanels('combat')).not.toContain('map');
  });

  test('arrow keys map to the four compass exits; every direction has a label and an order', () => {
    expect(ARROW_DIRS).toEqual({ arrowup: 'north', arrowdown: 'south', arrowleft: 'west', arrowright: 'east' });
    expect(DIR_ORDER).toHaveLength(Object.keys(DIR_LABELS).length);
  });
});
