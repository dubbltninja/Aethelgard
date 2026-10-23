// The Title screen (DESIGN §16.3 `screen_title`, PLAN §6.3): the menu model, the rendered menu and its choices, the
// wordmark's accessible name, Credits; and the panels the Title opens (Settings, Saves, the `?` keys).
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryStorage } from '@engine/index';
import { CreditsView, TitleMenuView, Wordmark, firstEnabled, titleMenu } from '@ui/screens/TitleScreen';
import { SettingsForm } from '@ui/panels/SettingsPanel';
import { SlotList, savedAtText, slotName } from '@ui/panels/SavesPanel';
import { HelpList } from '@ui/panels/HelpPanel';
import type { HotkeyLayer } from '@ui/hooks/hotkeys';
import { PanelHost } from '@ui/panels/PanelHost';
import { Modal } from '@ui/components/Modal';
import { KeyLegend } from '@ui/components/KeyLegend';
import { Toasts, noticeLifetime } from '@ui/components/Toasts';
import { createGameStore, type SlotInfo } from '@ui/store/gameStore';
import { DEFAULT_SETTINGS, freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, fakeEvent, nameOf } from './tree';

const autosave: SlotInfo = {
  slot: 'auto',
  status: 'ok',
  savedAt: '2026-10-17T09:05:00.000Z',
  summary: { classId: 'ranger', level: 1, loop: 1, day: 1, watch: 0, locationId: 'loc_whispering_ruins', title: 'Loop 1 · Day 1 · Whispering Ruins', playtimeSteps: 1 },
};

describe('menu model', () => {
  test('a first visit: Continue and Load are off and say why; New game is where focus lands', () => {
    const items = titleMenu({ continueSlot: null, anySaved: false, canPersist: true });
    expect(items.map((i) => i.label)).toEqual(['Continue', 'New game', 'Load', 'Settings', 'Lore', 'Credits']);
    expect(items[0]).toMatchObject({ disabled: true, detail: 'No autosave yet' });
    expect(items[2]).toMatchObject({ disabled: true, detail: 'No saves yet' });
    expect(firstEnabled(items)).toBe('new');
  });

  test('with an autosave, Continue resumes it and names where', () => {
    const items = titleMenu({ continueSlot: autosave, anySaved: true, canPersist: true });
    expect(items[0]).toEqual({ id: 'continue', label: 'Continue', detail: 'Loop 1 · Day 1 · Whispering Ruins' });
    expect(items[2]?.disabled).toBeUndefined();
    expect(firstEnabled(items)).toBe('continue');
  });

  test('without storage Continue explains that nothing is kept', () => {
    expect(titleMenu({ continueSlot: null, anySaved: false, canPersist: false })[0]?.detail).toBe('This browser keeps no saves');
    expect(firstEnabled([])).toBeNull();
  });
});

describe('TitleMenuView', () => {
  const items = titleMenu({ continueSlot: null, anySaved: false, canPersist: true });

  test('renders a named nav of real buttons; off items are disabled and described', () => {
    const html = renderToStaticMarkup(<TitleMenuView items={items} onChoose={() => undefined} version="2.0.0" />);
    expect(html).toContain('<nav class="title-menu" aria-label="Main menu">');
    expect(html.match(/<button type="button"/g)).toHaveLength(6);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-describedby="title-menu-continue-detail"');
    expect(html).toContain('Version 2.0.0');
    const tree = expand(<TitleMenuView items={items} onChoose={() => undefined} version="2" />);
    expect(byName(tree, 'button', 'New game').props['data-autofocus']).toBe('');
    expect(byName(tree, 'button', /^Continue/).props.disabled).toBe(true);
  });

  test('choosing an item reports its id', () => {
    const chose = mock((_id: string) => undefined);
    const tree = expand(<TitleMenuView items={items} onChoose={chose} version="2" />);
    for (const label of ['New game', 'Settings', 'Lore', 'Credits']) call(byName(tree, 'button', label), 'onClick');
    expect(chose.mock.calls.map((c) => c[0])).toEqual(['new', 'settings', 'lore', 'credits']);
  });

  test('the wordmark reads as the full title; its after-images are hidden from assistive tech', () => {
    const [h1] = all(expand(<Wordmark />), 'h1');
    expect(nameOf(h1!)).toBe('Echoes of Aethelgard: The Unraveling');
    expect(renderToStaticMarkup(<Wordmark />).match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  test('Credits names the author and goes back', () => {
    const back = mock(() => undefined);
    const tree = expand(<CreditsView onBack={back} />);
    expect(renderToStaticMarkup(<CreditsView onBack={back} />)).toContain('A game by Tim Dibert.');
    call(byName(tree, 'button', 'Back to title'), 'onClick');
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('Title in a live store', () => {
  test('a saved autosave turns Continue on in the rendered title', () => {
    const storage = memoryStorage();
    const content = fixturePack();
    const first = createGameStore(content, freshProfile('t'), { storage });
    first.shell.newGame('Ann', 'ranger');
    const again = createGameStore(content, first.getProfile(), { storage });
    const html = renderToStaticMarkup(
      <GameProvider value={again}>
        <PanelHost id="saves" onClose={() => undefined} />
      </GameProvider>,
    );
    expect(html).toContain('Autosave');
    expect(html).toContain('Load autosave');
    expect(again.shell.continueSlot()).not.toBeNull();
  });
});

describe('panels', () => {
  test('SettingsForm: text size, motion, high contrast and autosave, each a labelled control', () => {
    const changes: unknown[] = [];
    const tree = expand(<SettingsForm settings={DEFAULT_SETTINGS} onChange={(p) => changes.push(p)} />);
    const inputs = all(tree, 'input');
    expect(inputs.every((i) => nameOf(i) !== '')).toBe(true);
    expect(all(tree, 'legend').map((l) => l.text)).toEqual(['Text size', 'Motion', 'Display and saving']);
    call(byName(tree, 'input', '150%'), 'onChange');
    call(byName(tree, 'input', 'Reduce motion'), 'onChange');
    call(byName(tree, 'input', 'High contrast'), 'onChange');
    call(byName(tree, 'input', 'Autosave at each checkpoint'), 'onChange');
    expect(changes).toEqual([{ textScale: 1.5 }, { reducedMotion: 'on' }, { highContrast: true }, { autosave: false }]);
    const form = all(tree, 'form')[0]!;
    const submit = fakeEvent();
    call(form, 'onSubmit', submit);
    expect(submit.prevented()).toBe(true);
  });

  test('SlotList: what each slot offers', () => {
    const slots: SlotInfo[] = [
      { slot: 1, status: 'empty' },
      { slot: 2, status: 'corrupted', error: 'bad', hasBackup: true },
      { slot: 3, status: 'corrupted', error: 'bad', hasBackup: false },
      autosave,
    ];
    const done: string[] = [];
    const tree = expand(
      <SlotList
        slots={slots}
        canLoad
        canSave={(slot) => slot === 1}
        onLoad={(s) => done.push(`load ${s}`)}
        onSave={(s) => done.push(`save ${s}`)}
        onRestore={(s) => done.push(`restore ${s}`)}
        onDelete={(s) => done.push(`delete ${s}`)}
      />,
    );
    call(byName(tree, 'button', 'Save to slot 1'), 'onClick');
    call(byName(tree, 'button', 'Restore the backup of slot 2'), 'onClick');
    call(byName(tree, 'button', 'Delete slot 3'), 'onClick');
    call(byName(tree, 'button', 'Load autosave'), 'onClick');
    expect(done).toEqual(['save 1', 'restore 2', 'delete 3', 'load auto']);
    expect(all(tree, 'button').map(nameOf)).not.toContain('Restore the backup of slot 3');
    expect(renderToStaticMarkup(<SlotList slots={slots} canLoad={false} canSave={() => false} onLoad={() => undefined} onSave={() => undefined} onRestore={() => undefined} onDelete={() => undefined} />)).not.toContain('>Load<');
    expect(slotName('auto')).toBe('Autosave');
    expect(savedAtText('2026-10-07T09:05:00.000Z')).toBe('7 Oct 2026, 09:05');
    expect(savedAtText('whenever')).toBe('whenever');
  });

  test('HelpList renders every active map with its keys; KeyLegend shows the top ones', () => {
    const layers: HotkeyLayer[] = [
      { id: 'title', scope: 'Title', map: { arrowup: { run: () => undefined, label: 'Move' }, arrowdown: { run: () => undefined, label: 'Move' } } },
      { id: 'global', scope: 'Anywhere', map: { '?': { run: () => undefined, label: 'All keys' } } },
    ];
    const help = renderToStaticMarkup(<HelpList layers={layers} />);
    expect(help).toContain('<h3 id="help-title" class="help-list__scope">Title</h3>');
    expect(help).toContain('<kbd>↑</kbd>');
    expect(help).toContain(' or ');
    expect(renderToStaticMarkup(<HelpList layers={[]} />)).toContain('No keys are active here.');
    const legend = renderToStaticMarkup(<KeyLegend layers={layers} />);
    expect(legend).toContain('aria-label="Keys you can press"');
    expect(legend).toContain('All keys');
    expect(renderToStaticMarkup(<KeyLegend layers={[]} />)).toBe('');
  });

  test('Modal: a named dialog with aria-modal and a Close button; Toasts are dismissable', () => {
    const html = renderToStaticMarkup(
      <Modal title="Saves" onClose={() => undefined}>
        <p>body</p>
      </Modal>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Close saves"');
    expect(renderToStaticMarkup(<Modal title="Sure?" role="alertdialog" hideClose onClose={() => undefined} />)).not.toContain('Close');
    const dismissed: number[] = [];
    const notices = [
      { id: 1, text: 'Saved to slot 1.', tone: 'success' as const },
      { id: 2, text: 'Storage is full.', tone: 'error' as const },
    ];
    const tree = expand(<Toasts notices={notices} onDismiss={(id) => dismissed.push(id)} />);
    call(byName(tree, 'button', 'Dismiss: Storage is full.'), 'onClick');
    expect(dismissed).toEqual([2]);
    expect(noticeLifetime(notices[1]!)).toBeGreaterThan(noticeLifetime(notices[0]!));
    expect(renderToStaticMarkup(<PanelHost id="inventory" onClose={() => undefined} />)).toBe('');
  });
});
