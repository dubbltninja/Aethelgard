// The hotkey resolver (PLAN §6.6, §8.3 `hotkeys.test.ts`; DESIGN §16.4; D-066 #13): Shift for panels in combat, WASD
// only on the map, Delete → confirm, nothing while typing, native keys left to the focused control, modal layers.
import { describe, expect, mock, test } from 'bun:test';
import { isTextEntry, nativeKeysOf, type FocusTarget } from '@ui/a11y/focus';
import { keyLabel, legendEntries, normalizeKey, resolveHotkey, type HotkeyLayer, type HotkeyMap, type KeyLike } from '@ui/hooks/hotkeys';
import { HOTKEY_LEVELS, createHotkeyRegistry } from '@ui/hooks/useHotkeys';
import { legendItems } from '@ui/components/KeyLegend';

const run = () => mock(() => undefined);
const out = { inCombat: false, focusInInput: false };
const fight = { inCombat: true, focusInInput: false };

describe('normalizeKey', () => {
  test.each<[KeyLike, string]>([
    [{ key: 'i' }, 'i'],
    [{ key: 'I', shiftKey: true }, 'shift+i'],
    [{ key: 's', ctrlKey: true }, 'ctrl+s'],
    [{ key: 's', metaKey: true }, 'ctrl+s'],
    [{ key: 'S', ctrlKey: true, shiftKey: true }, 'ctrl+shift+s'],
    [{ key: '?', shiftKey: true }, '?'],
    [{ key: ' ' }, 'space'],
    [{ key: 'Spacebar' }, 'space'],
    [{ key: 'Esc' }, 'escape'],
    [{ key: 'Escape' }, 'escape'],
    [{ key: 'ArrowUp' }, 'arrowup'],
    [{ key: 'Up' }, 'arrowup'],
    [{ key: 'Delete' }, 'delete'],
    [{ key: 'Tab', shiftKey: true }, 'shift+tab'],
    [{ key: 'Enter' }, 'enter'],
    [{ key: '1' }, '1'],
    [{ key: 'x', altKey: true }, 'alt+x'],
  ])('%o → %s', (event, key) => {
    expect(normalizeKey(event)).toBe(key);
  });

  test('bare modifiers and dead keys are not hotkeys', () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'Unidentified', '']) expect(normalizeKey({ key })).toBeNull();
  });
});

describe('resolveHotkey', () => {
  test('a plain map resolves a key to its binding', () => {
    const map: HotkeyMap = { t: { run: run(), label: 'Talk' } };
    expect(resolveHotkey(map, { key: 't' }, out)?.hotkey.label).toBe('Talk');
    expect(resolveHotkey(map, { key: 'y' }, out)).toBeNull();
  });

  test('panel letters: plain outside a fight; in a fight only with Shift (D-066 #13)', () => {
    const map: HotkeyMap = { i: { run: run(), label: 'Inventory', group: 'panel' } };
    expect(resolveHotkey(map, { key: 'i' }, out)?.hotkey.label).toBe('Inventory');
    expect(resolveHotkey(map, { key: 'I', shiftKey: true }, out)?.hotkey.label).toBe('Inventory');
    expect(resolveHotkey(map, { key: 'i' }, fight)).toBeNull();
    expect(resolveHotkey(map, { key: 'I', shiftKey: true }, fight)?.hotkey.label).toBe('Inventory');
  });

  test('in a fight the combat screen owns C/I/G/F and Shift reaches the panel underneath', () => {
    const layers: HotkeyLayer[] = [
      { id: 'combat', scope: 'Combat', map: { i: { run: run(), label: 'Item', group: 'action' }, c: { run: run(), label: 'Command', group: 'action' } } },
      { id: 'global', scope: 'Anywhere', map: { i: { run: run(), label: 'Inventory', group: 'panel' }, c: { run: run(), label: 'Codex', group: 'panel' } } },
    ];
    expect(resolveHotkey(layers, { key: 'i' }, fight)?.hotkey.label).toBe('Item');
    expect(resolveHotkey(layers, { key: 'I', shiftKey: true }, fight)?.hotkey.label).toBe('Inventory');
    expect(resolveHotkey(layers, { key: 'C', shiftKey: true }, fight)?.hotkey.label).toBe('Codex');
  });

  test('a non-panel binding never answers to its Shift form', () => {
    const map: HotkeyMap = { g: { run: run(), label: 'Guard', group: 'action' } };
    expect(resolveHotkey(map, { key: 'G', shiftKey: true }, fight)).toBeNull();
  });

  test('WASD works only on the map; arrows work everywhere', () => {
    const map: HotkeyMap = {
      w: { run: run(), label: 'North', group: 'map' },
      arrowup: { run: run(), label: 'North', group: 'map' },
    };
    expect(resolveHotkey(map, { key: 'w' }, out)).toBeNull();
    expect(resolveHotkey(map, { key: 'w' }, { ...out, onMap: true })?.hotkey.label).toBe('North');
    expect(resolveHotkey(map, { key: 'ArrowUp' }, out)?.hotkey.label).toBe('North');
  });

  test('Delete always asks first; other keys ask only when their binding says so', () => {
    const map: HotkeyMap = {
      delete: { run: run(), label: 'Drop the Rusty Dagger' },
      f: { run: run(), label: 'Flee', confirm: 'Flee the fight?' },
      e: { run: run(), label: 'Take all' },
    };
    expect(resolveHotkey(map, { key: 'Delete' }, out)?.confirm).toBe('Drop the Rusty Dagger?');
    expect(resolveHotkey(map, { key: 'f' }, out)?.confirm).toBe('Flee the fight?');
    expect(resolveHotkey(map, { key: 'e' }, out)?.confirm).toBeUndefined();
  });

  test('nothing but Escape resolves while a text field has focus', () => {
    const map: HotkeyMap = { t: { run: run(), label: 'Talk' }, escape: { run: run(), label: 'Close' }, '?': { run: run(), label: 'Keys' } };
    const typing = { ...out, focusInInput: true };
    expect(resolveHotkey(map, { key: 't' }, typing)).toBeNull();
    expect(resolveHotkey(map, { key: '?', shiftKey: true }, typing)).toBeNull();
    expect(resolveHotkey(map, { key: 'Escape' }, typing)?.hotkey.label).toBe('Close');
  });

  test('keys the focused control handles natively are left to it', () => {
    const map: HotkeyMap = { enter: { run: run(), label: 'Begin' }, arrowright: { run: run(), label: 'Next' } };
    expect(resolveHotkey(map, { key: 'Enter' }, { ...out, nativeKeys: ['enter', 'space'] })).toBeNull();
    expect(resolveHotkey(map, { key: 'ArrowRight' }, { ...out, nativeKeys: ['space', 'arrowright'] })).toBeNull();
    expect(resolveHotkey(map, { key: 'Enter' }, { ...out, nativeKeys: ['space', 'arrowright'] })?.hotkey.label).toBe('Begin');
  });

  test('`when` false lets the key fall through to the next layer', () => {
    const layers: HotkeyLayer[] = [
      { id: 'a', scope: 'A', map: { r: { run: run(), label: 'Rest', when: () => false } } },
      { id: 'b', scope: 'B', map: { r: { run: run(), label: 'Retreat' } } },
    ];
    expect(resolveHotkey(layers, { key: 'r' }, out)?.hotkey.label).toBe('Retreat');
  });

  test('a modal layer hides every layer below it', () => {
    const layers: HotkeyLayer[] = [
      { id: 'panel', scope: 'Inventory', modal: true, map: { escape: { run: run(), label: 'Close' } } },
      { id: 'screen', scope: 'Explore', map: { t: { run: run(), label: 'Talk' } } },
    ];
    expect(resolveHotkey(layers, { key: 't' }, out)).toBeNull();
    expect(resolveHotkey(layers, { key: 'Escape' }, out)?.layer).toBe('panel');
  });

  test('auto-repeat repeats arrows only', () => {
    const map: HotkeyMap = { arrowdown: { run: run(), label: 'Down' }, '1': { run: run(), label: 'Attack' } };
    expect(resolveHotkey(map, { key: 'ArrowDown', repeat: true }, out)?.hotkey.label).toBe('Down');
    expect(resolveHotkey(map, { key: '1', repeat: true }, out)).toBeNull();
  });
});

describe('legend', () => {
  test('keyLabel writes keys the way the legend shows them', () => {
    expect(keyLabel('shift+i')).toBe('Shift+I');
    expect(keyLabel('ctrl+s')).toBe('Ctrl+S');
    expect(keyLabel('arrowup')).toBe('↑');
    expect(keyLabel('escape')).toBe('Esc');
    expect(keyLabel('?')).toBe('?');
    expect(keyLabel('pageup')).toBe('Pageup');
  });

  test('legendEntries groups keys that share a label and skips hidden or inactive ones', () => {
    const map: HotkeyMap = {
      arrowup: { run: run(), label: 'Move', group: 'menu' },
      arrowdown: { run: run(), label: 'Move', group: 'menu' },
      x: { run: run(), label: 'Secret', hidden: true },
      y: { run: run(), label: 'Off', when: () => false },
      enter: { run: run(), label: 'Choose' },
    };
    expect(legendEntries(map)).toEqual([
      { keys: ['arrowup', 'arrowdown'], label: 'Move', group: 'menu' },
      { keys: ['enter'], label: 'Choose' },
    ]);
  });

  test('legendItems merges layers top first, stops after a modal one, and caps the count', () => {
    const layers: HotkeyLayer[] = [
      { id: 'screen', scope: 'Title', map: { enter: { run: run(), label: 'Choose' } } },
      { id: 'global', scope: 'Anywhere', map: { '?': { run: run(), label: 'All keys' }, enter: { run: run(), label: 'Choose' } } },
    ];
    expect(legendItems(layers)).toEqual([
      { keys: ['enter'], label: 'Choose' },
      { keys: ['?'], label: 'All keys' },
    ]);
    expect(legendItems([{ ...layers[0]!, modal: true }, layers[1]!])).toEqual([{ keys: ['enter'], label: 'Choose' }]);
    expect(legendItems(layers, 1)).toHaveLength(1);
  });
});

describe('registry', () => {
  test('layers come out dialog > panel > screen > global, later registrations first within a level', () => {
    const registry = createHotkeyRegistry();
    const layer = (id: string): (() => HotkeyLayer) => () => ({ id, scope: id, map: {} });
    const seen = mock(() => undefined);
    registry.subscribe(seen);
    registry.register('g', 'global', layer('g'));
    registry.register('s1', 'screen', layer('s1'));
    const offPanel = registry.register('p', 'panel', layer('p'));
    registry.register('s2', 'screen', layer('s2'));
    expect(registry.layers().map((l) => l.id)).toEqual(['p', 's2', 's1', 'g']);
    const before = registry.version();
    offPanel();
    expect(registry.layers().map((l) => l.id)).toEqual(['s2', 's1', 'g']);
    expect(registry.version()).toBeGreaterThan(before);
    registry.touch();
    expect(seen).toHaveBeenCalledTimes(6);
    expect(HOTKEY_LEVELS.dialog).toBeGreaterThan(HOTKEY_LEVELS.panel);
  });
});

describe('focus targets', () => {
  const el = (tagName: string, attrs: Record<string, string> = {}, editable = false): FocusTarget => ({
    tagName: tagName.toUpperCase(),
    getAttribute: (name) => attrs[name] ?? null,
    isContentEditable: editable,
  });

  test('text entry: text-like inputs, textareas and contenteditable', () => {
    expect(isTextEntry(el('input'))).toBe(true);
    expect(isTextEntry(el('input', { type: 'search' }))).toBe(true);
    expect(isTextEntry(el('textarea'))).toBe(true);
    expect(isTextEntry(el('div', {}, true))).toBe(true);
    expect(isTextEntry(el('input', { type: 'radio' }))).toBe(false);
    expect(isTextEntry(el('button'))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });

  test('native keys per control', () => {
    expect(nativeKeysOf(el('button'))).toEqual(['enter', 'space']);
    expect(nativeKeysOf(el('a', { href: '#x' }))).toEqual(['enter', 'space']);
    expect(nativeKeysOf(el('a'))).toEqual([]);
    expect(nativeKeysOf(el('input', { type: 'radio' }))).toContain('arrowleft');
    expect(nativeKeysOf(el('input', { type: 'checkbox' }))).toEqual(['space']);
    expect(nativeKeysOf(el('input', { type: 'range' }))).toContain('home');
    expect(nativeKeysOf(el('input', { type: 'submit' }))).toEqual(['enter', 'space']);
    expect(nativeKeysOf(el('select'))).toContain('arrowdown');
    expect(nativeKeysOf(el('div', { role: 'tab' }))).toContain('arrowright');
    expect(nativeKeysOf(el('div'))).toEqual([]);
    expect(nativeKeysOf(undefined)).toEqual([]);
  });
});
