// U69 Saves panel: the model (cards, import preview, overwrite question), the pure views, and the container over a live store.
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryStorage, slotKey } from '@engine/index';
import { ImportSection, SlotList, defaultImportSlot } from '@ui/panels/SavesPanel';
import { PanelHost } from '@ui/panels/PanelHost';
import { IMPORT_SLOTS, overwriteQuestion, previewCard, savedAtText, slotCards, slotName, type ImportDraft } from '@ui/panels/savesModel';
import { createGameStore, type SlotInfo } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, fakeEvent, nameOf } from './tree';

const summary = { classId: 'ranger', level: 7, loop: 2, day: 11, watch: 0 as const, locationId: 'loc_x', title: 'Loop 2 · Day 11 · Ironclad Camp', playtimeSteps: 40 };
const ok = (slot: 1 | 2 | 3 | 'auto'): SlotInfo => ({ slot, status: 'ok', summary, savedAt: '2026-10-17T09:05:00.000Z' });
const SLOTS: SlotInfo[] = [ok(1), { slot: 2, status: 'empty' }, { slot: 3, status: 'corrupted', error: 'version: is missing', hasBackup: true }, { slot: 'auto', status: 'corrupted', error: 'bad', hasBackup: false }];
const ctx = { canLoad: true, canSave: (slot: unknown) => slot !== 'auto', className: (id: string) => (id === 'ranger' ? 'Ranger' : id) };

describe('slotCards', () => {
  test('a readable slot says its place, class, level and time, and offers load / save / export / delete', () => {
    const [one] = slotCards(SLOTS, ctx);
    expect(one).toMatchObject({ name: 'Slot 1', headline: 'Loop 2 · Day 11 · Ironclad Camp', load: true, save: true, exportFile: true, exportLabel: 'Export', remove: true, restore: false, overwrites: true });
    expect(one?.facts).toEqual(['Ranger · level 7', 'Saved 17 Oct 2026, 09:05']);
  });

  test('an empty slot offers a save only, and no overwrite question', () => {
    const [, two] = slotCards(SLOTS, ctx);
    expect(two).toMatchObject({ headline: 'Empty', load: false, save: true, exportFile: false, remove: false, restore: false, overwrites: false });
    expect(overwriteQuestion(2, SLOTS[1], 'save')).toBeNull();
    expect(overwriteQuestion(2, undefined, 'import')).toBeNull();
  });

  test('a damaged slot offers restore only with a valid backup, raw export and delete, and never load or save-by-load', () => {
    const [, , three, auto] = slotCards(SLOTS, ctx);
    expect(three).toMatchObject({ headline: 'Damaged: this save cannot be read.', facts: ['version: is missing'], load: false, restore: true, exportLabel: 'Export raw text', exportFile: true, remove: true });
    expect(auto).toMatchObject({ restore: false, save: false, exportFile: true });
  });

  test('loading is off where the game cannot go back to the title (a fight)', () => {
    expect(slotCards(SLOTS, { ...ctx, canLoad: false }).some((c) => c.load)).toBe(false);
  });

  test('the overwrite questions name what is there', () => {
    expect(overwriteQuestion(1, SLOTS[0], 'save')).toBe('Slot 1 holds Loop 2 · Day 11 · Ironclad Camp. Save over it?');
    expect(overwriteQuestion(3, SLOTS[2], 'import')).toBe('Slot 3 holds a damaged save. Replace it with the imported file?');
  });

  test('names, stamps, and the slots a file may go into', () => {
    expect(slotName('auto')).toBe('Autosave');
    expect(slotName(2)).toBe('Slot 2');
    expect(savedAtText('2026-01-05T23:59:00Z')).toBe('5 Jan 2026, 23:59');
    expect(IMPORT_SLOTS).toEqual([1, 2, 3]);
    expect(defaultImportSlot(SLOTS)).toBe(2);
    expect(defaultImportSlot([ok(1), ok(2), ok(3)])).toBe(1);
  });

  test('previewCard words an upgraded file and dropped ids', () => {
    const card = previewCard({ summary, savedAt: '2026-10-17T09:05:00.000Z', migratedFrom: 0, warnings: ["forgot the item 'item_old'"] }, ctx.className);
    expect(card.headline).toBe('Loop 2 · Day 11 · Ironclad Camp');
    expect(card.notes).toEqual(['Written by an older version of the game (v0); it will be upgraded.', "Dropped: forgot the item 'item_old'."]);
    expect(previewCard({ summary, savedAt: 'x', migratedFrom: null, warnings: [] }, ctx.className).notes).toEqual([]);
  });
});

describe('SlotList view', () => {
  test('every action is a named button that reports its slot', () => {
    const done: string[] = [];
    const tree = expand(
      <SlotList
        cards={slotCards(SLOTS, ctx)}
        onLoad={(s) => done.push(`load ${s}`)}
        onSave={(s) => done.push(`save ${s}`)}
        onRestore={(s) => done.push(`restore ${s}`)}
        onExport={(s) => done.push(`export ${s}`)}
        onDelete={(s) => done.push(`delete ${s}`)}
      />,
    );
    call(byName(tree, 'button', 'Load slot 1'), 'onClick');
    call(byName(tree, 'button', 'Save to slot 2'), 'onClick');
    call(byName(tree, 'button', 'Restore the backup of slot 3'), 'onClick');
    call(byName(tree, 'button', 'Export raw text of slot 3'), 'onClick');
    call(byName(tree, 'button', 'Export of slot 1'), 'onClick');
    call(byName(tree, 'button', 'Delete slot 3'), 'onClick');
    expect(done).toEqual(['load 1', 'save 2', 'restore 3', 'export 3', 'export 1', 'delete 3']);
    expect(all(tree, 'button').map(nameOf)).not.toContain('Restore the backup of autosave');
    expect(all(tree, 'li').map((li) => li.props['data-status'])).toEqual(['ok', 'empty', 'corrupted', 'corrupted']);
  });
});

describe('ImportSection view', () => {
  const base = { target: 2 as const, className: ctx.className, onPick: () => undefined, onTarget: () => undefined, onImport: () => undefined, onCancel: () => undefined };

  test('with no file chosen it offers the picker and nothing else', () => {
    const html = renderToStaticMarkup(<ImportSection {...base} draft={{ status: 'none' }} />);
    expect(html).toContain('Choose a save file');
    expect(html).not.toContain('Import into');
    expect(html).toContain('type="file"');
  });

  test('a refused file says which and why, as an alert', () => {
    const tree = expand(<ImportSection {...base} draft={{ status: 'refused', fileName: 'bad.json', error: 'Save file is not valid JSON (x)' }} />);
    const alert = all(tree, 'p').find((p) => p.props.role === 'alert');
    expect(alert?.text).toBe('bad.json was not imported. Save file is not valid JSON (x)');
  });

  test('a good file shows its card, the slot choice, and imports on confirm', () => {
    const picked: unknown[] = [];
    const imported = mock(() => undefined);
    const cancel = mock(() => undefined);
    const draft: ImportDraft = { status: 'ready', fileName: 'run.json', text: '{}', preview: { summary, savedAt: '2026-10-17T09:05:00.000Z', migratedFrom: null, warnings: [] } };
    const tree = expand(<ImportSection {...base} draft={draft} onTarget={(s) => picked.push(s)} onImport={imported} onCancel={cancel} />);
    expect(all(tree, 'p').map((p) => p.text)).toContain('Loop 2 · Day 11 · Ironclad Camp');
    expect(byName(tree, 'input', 'Slot 2').props.checked).toBe(true);
    call(byName(tree, 'input', 'Slot 3'), 'onChange');
    expect(picked).toEqual([3]);
    call(byName(tree, 'button', 'Import into slot 2'), 'onClick');
    call(byName(tree, 'button', 'Cancel'), 'onClick');
    expect(imported).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(all(tree, 'input').every((i) => nameOf(i) !== '')).toBe(true);
    void fakeEvent;
  });
});

describe('SavesPanel in a live store', () => {
  const content = fixturePack();
  const render = (store: ReturnType<typeof createGameStore>): string =>
    renderToStaticMarkup(
      <GameProvider value={store}>
        <PanelHost id="saves" onClose={() => undefined} />
      </GameProvider>,
    );

  test('lists the slots with their summaries, a damaged one with its restore, and the import block', () => {
    const storage = memoryStorage();
    const store = createGameStore(content, freshProfile('p'), { storage, now: () => '2026-10-17T09:05:00.000Z' });
    store.shell.newGame('Ann', 'ranger');
    store.shell.save(1);
    store.shell.save(1);
    storage.setItem(slotKey(1), '{"kind":');
    store.shell.deleteSlot(3);
    const html = render(store);
    expect(html).toContain('data-status="corrupted"');
    expect(html).toContain('Restore the backup of slot 1');
    expect(html).toContain('Export raw text of slot 1');
    expect(html).toContain('Autosave');
    expect(html).toContain('Import a save file');
  });

  test('without any storage it says so instead of listing slots', () => {
    const html = render(createGameStore(content, freshProfile('p'), { storage: null }));
    expect(html).toContain('gives the game no storage');
    expect(html).not.toContain('slot-list');
  });
});
