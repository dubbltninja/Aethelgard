// The Codex (U66; DESIGN §16.3 `screen_codex`, D-020's four voices): the model (unlocking, locked silhouettes and their
// spoiler-free hints, new marks, filters, related entries, the source line), the read-state store, and CodexView's list and
// entry driven through tests/unit/ui/tree.ts, then the panel in a live store.
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryStorage, type Profile } from '@engine/index';
import type { CodexEntry } from '@schema/codex';
import { PanelHost } from '@ui/panels/PanelHost';
import { CodexView, EntryDetail, VoiceTag } from '@ui/panels/CodexPanel';
import { NO_FILTER, atomKeys, codexModel, codexRow, echoesIn, inlineRuns, isUnlocked, paragraphsOf, rowName, unlockHint, unlockSource } from '@ui/panels/codexModel';
import { createCodexReadStore, requestCodexEntry, resetSharedCodexReadStore, sharedCodexReadStore, takeCodexRequest } from '@ui/store/codexRead';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, fakeEvent, nameOf } from './tree';

const content = fixturePack();
const none: ReadonlySet<string> = new Set();
const profileWith = (codexUnlocked: string[], echoes: string[] = []): Profile => ({ ...freshProfile('c'), codexUnlocked, echoes });

describe('codexModel', () => {
  test('nothing found: every entry is a locked silhouette with no title, a hint and its voice named', () => {
    const model = codexModel(content, freshProfile('c'), none);
    expect(model).toMatchObject({ unlocked: 0, total: 5, unread: 0 });
    expect(model.shown.every((r) => !r.unlocked && r.title === null && r.paragraphs.length === 0)).toBe(true);
    const locked = model.rows.find((r) => r.id === 'codex_tyrant_consent')!;
    expect(locked.hint).toBe('Something you learn in one loop and carry into the next.');
    expect(locked).toMatchObject({ voiceTag: 'WN', voiceLabel: 'Wayfinder’s Notes', categoryLabel: 'The Nine' });
    expect(rowName(locked)).toBe('Locked entry, The Nine, Wayfinder’s Notes');
    expect(model.rows.find((r) => r.id === 'codex_tyrant_holding')?.hint).toBe('Not found yet.');
  });

  test('a found entry shows title, paragraphs, a new mark until it is read, and the Echo it was learned through', () => {
    const profile = profileWith(['codex_tyrant_consent', 'codex_tyrant_holding'], ['echo_tyrant_consent']);
    const unread = codexModel(content, profile, none);
    expect(unread).toMatchObject({ unlocked: 2, unread: 2 });
    const row = unread.rows.find((r) => r.id === 'codex_tyrant_consent')!;
    expect(row).toMatchObject({ title: 'Hour, Go', unlocked: true, isNew: true, hint: null, source: 'Learned through: Consent' });
    expect(rowName(row)).toBe('Hour, Go, Wayfinder’s Notes, new');
    const read = codexModel(content, profile, new Set(['codex_tyrant_consent']));
    expect(read.unread).toBe(1);
    expect(rowName(read.rows.find((r) => r.id === 'codex_tyrant_consent')!)).toBe('Hour, Go, Wayfinder’s Notes');
  });

  test('found entries come first in their category; the filters narrow by category and voice and count what is found', () => {
    const profile = profileWith(['codex_tyrant_alone']);
    const model = codexModel(content, profile, none);
    expect(model.shown[0]?.id).toBe('codex_tyrant_alone');
    expect(model.categories.map((c) => [c.id, c.found, c.total])).toEqual([
      ['all', 1, 5],
      ['the_nine', 1, 5],
    ]);
    expect(model.voices.find((v) => v.id === 'wayfinder_notes')).toMatchObject({ found: 1, total: 2 });
    const wn = codexModel(content, profile, none, { category: 'all', voice: 'wayfinder_notes' });
    expect(wn.shown.map((r) => r.id)).toEqual(['codex_tyrant_alone', 'codex_tyrant_consent']);
    expect(codexModel(content, profile, none, { category: 'places', voice: 'all' }).shown).toEqual([]);
  });

  test('related entries show a title only when they are found; the helpers read conditions and marks', () => {
    const entry: CodexEntry = { ...content.codex.codex_tyrant_holding!, related: ['codex_tyrant_alone', 'codex_tyrant_reflex', 'codex_gone'] };
    const row = codexRow(entry, content, profileWith(['codex_tyrant_holding', 'codex_tyrant_alone']), none);
    expect(row.related).toEqual([
      { id: 'codex_tyrant_alone', title: 'One Voice', unlocked: true },
      { id: 'codex_tyrant_reflex', title: null, unlocked: false },
    ]);
    expect(isUnlocked({ ...entry, unlockedAtStart: true }, freshProfile('c'))).toBe(true);
    expect(atomKeys({ all: [{ echo: 'echo_a' }, { not: { quest: { id: 'q', status: 'active' } } }, { any: [{ corruption: { min: 1 } }] }] } as never)).toEqual(['echo', 'quest', 'corruption']);
    expect(atomKeys(undefined)).toEqual([]);
    expect(echoesIn({ any: [{ echo: 'echo_a' }, { echo: 'echo_a' }, { echo: 'echo_b' }] })).toEqual(['echo_a', 'echo_b']);
    expect(unlockHint({ ...entry, unlockWhen: { all: [{ echo: 'echo_a' }, { location: 'x' }, { item: { id: 'i' } }] } as never })).toBe('Something you learn in one loop and carry into the next. It waits in a place you have not stood.');
    const many = { ...entry, unlockWhen: { all: [{ echo: 'echo_tyrant_jailer' }, { echo: 'echo_tyrant_never_struck' }, { echo: 'echo_thirtieth_dawn' }, { echo: 'echo_seven_wayfinders' }] } } as unknown as CodexEntry;
    expect(unlockSource(many, profileWith([], ['echo_tyrant_jailer', 'echo_tyrant_never_struck', 'echo_thirtieth_dawn', 'echo_seven_wayfinders']), content)).toBe('Learned through: The Jailer, It Never Struck First, The Thirtieth Dawn and 1 more');
    expect(unlockSource(many, freshProfile('c'), content)).toBeNull();
    expect(paragraphsOf('One.\n\n\nTwo. *Em* here.\n\n')).toEqual(['One.', 'Two. *Em* here.']);
    expect(inlineRuns('a *b* c *')).toEqual([
      { text: 'a ', em: false },
      { text: 'b', em: true },
      { text: ' c *', em: false },
    ]);
  });
});

describe('codexRead store', () => {
  const port = () => {
    const data = new Map<string, string>();
    return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  };

  test('marks are per profile, saved, loaded again, and announced once', () => {
    const p = port();
    const store = createCodexReadStore(p);
    const heard = mock(() => undefined);
    const off = store.subscribe(heard);
    expect([...store.read('a')]).toEqual([]);
    store.mark('a', 'e2');
    store.mark('a', 'e1');
    store.mark('a', 'e1'); // nothing changes
    expect(heard.mock.calls).toHaveLength(2);
    off();
    store.mark('a', 'e3');
    expect(heard.mock.calls).toHaveLength(2);
    expect(JSON.parse(p.data.get('aethelgard.codex.read.a')!)).toEqual(['e1', 'e2', 'e3']);
    expect([...store.read('b')]).toEqual([]);
    expect(store.read('a')).toBe(store.read('a')); // stable for useSyncExternalStore
    expect([...createCodexReadStore(p).read('a')]).toEqual(['e1', 'e2', 'e3']);
  });

  test('storage that is missing, broken or full never throws: the marks last for the session', () => {
    const p = port();
    p.data.set('aethelgard.codex.read.a', '{not json');
    expect([...createCodexReadStore(p).read('a')]).toEqual([]);
    p.data.set('aethelgard.codex.read.a', '{"x":1}');
    expect([...createCodexReadStore(p).read('a')]).toEqual([]);
    p.data.set('aethelgard.codex.read.a', JSON.stringify(['ok', 4]));
    expect([...createCodexReadStore(p).read('a')]).toEqual(['ok']);
    const full = createCodexReadStore({ getItem: () => null, setItem: () => void (() => { throw new Error('quota'); })(), removeItem: () => undefined });
    full.mark('a', 'e');
    expect(full.read('a').has('e')).toBe(true);
    const bare = createCodexReadStore(null);
    bare.mark('a', 'e');
    expect(bare.read('a').has('e')).toBe(true);
  });

  test('the shared store can be replaced for a test; a request to open at an entry is taken once', () => {
    const mine = createCodexReadStore(null);
    resetSharedCodexReadStore(mine);
    expect(sharedCodexReadStore()).toBe(mine);
    resetSharedCodexReadStore(null);
    expect(sharedCodexReadStore()).not.toBe(mine);
    resetSharedCodexReadStore(null);
    expect(takeCodexRequest()).toBeNull();
    requestCodexEntry('codex_tyrant_holding');
    expect(takeCodexRequest()).toBe('codex_tyrant_holding');
    expect(takeCodexRequest()).toBeNull();
  });
});

describe('CodexView', () => {
  const profile = profileWith(['codex_tyrant_holding', 'codex_tyrant_reflex', 'codex_tyrant_alone'], []);
  const model = codexModel(content, profile, new Set(['codex_tyrant_alone']));
  const base = { model, filter: NO_FILTER, selectedId: null, view: 'list' as const, onFilter: () => undefined, onSelect: () => undefined, onBack: () => undefined };

  test('the count, a named button per entry (locked ones as silhouettes), and picking one selects it', () => {
    const onSelect = mock((_id: string) => undefined);
    const tree = expand(<CodexView {...base} onSelect={onSelect} />);
    expect(renderToStaticMarkup(<CodexView {...base} />)).toContain('3 of 5 entries found, 2 new.');
    const first = byName(tree, 'button', 'The Holding, Remnant Archive, new');
    expect(first.props['data-codex-id']).toBe('codex_tyrant_holding');
    const chosen = all(tree, 'button').filter((b) => b.props['aria-current'] === 'true');
    expect(chosen).toHaveLength(1); // with nothing picked, the first entry shown is the open one
    expect(chosen[0]?.props['data-autofocus']).toBe('');
    expect(all(tree, 'button').filter((b) => b.props['data-autofocus'] === '')).toHaveLength(1);
    call(byName(tree, 'button', 'One Voice, Wayfinder’s Notes'), 'onClick');
    expect(onSelect.mock.calls).toEqual([['codex_tyrant_alone']]);
    const lockedItems = all(tree, 'button').filter((b) => nameOf(b).startsWith('Locked entry'));
    expect(lockedItems).toHaveLength(2);
    expect(lockedItems[0]?.props['data-voice']).toBeDefined();
  });

  test('category and voice are labelled selects that keep the other filter', () => {
    const onFilter = mock((_f: unknown) => undefined);
    const tree = expand(<CodexView {...base} filter={{ category: 'all', voice: 'weaver_fragment' }} onFilter={onFilter} />);
    const category = byName(tree, 'select', /^Category/);
    call(category, 'onChange', fakeEvent({ value: 'the_nine' }));
    expect(onFilter.mock.calls[0]).toEqual([{ category: 'the_nine', voice: 'weaver_fragment' }]);
    const voice = byName(tree, 'select', /^Voice/);
    call(voice, 'onChange', fakeEvent({ value: 'ironclad_telling' }));
    expect(onFilter.mock.calls[1]).toEqual([{ category: 'all', voice: 'ironclad_telling' }]);
    expect(all(tree, 'option').map(nameOf)).toContain('The Nine (3/5)');
  });

  test('an empty filter says so; a phone detail view has a Back button that goes back', () => {
    const empty = codexModel(content, profile, none, { category: 'places', voice: 'all' });
    expect(renderToStaticMarkup(<CodexView {...base} model={empty} filter={{ category: 'places', voice: 'all' }} />)).toContain('No entry matches');
    const onBack = mock(() => undefined);
    call(byName(expand(<CodexView {...base} view="detail" onBack={onBack} />), 'button', 'Back to entries'), 'onClick');
    expect(onBack.mock.calls).toHaveLength(1);
  });

  test('an entry reads in its voice: byline, date, emphasis, source; the See also buttons open found entries only', () => {
    const row = {
      ...codexRow(content.codex.codex_tyrant_holding!, content, profile, none),
      date: 'Year 3',
      paragraphs: ['It says *hold* twice.', 'Second.'],
      source: 'Learned through: Consent',
      related: [
        { id: 'codex_tyrant_alone', title: 'One Voice', unlocked: true },
        { id: 'codex_tyrant_consent', title: null, unlocked: false },
      ],
    };
    const onSelect = mock((_id: string) => undefined);
    const tree = expand(<EntryDetail row={row} onSelect={onSelect} />);
    const html = renderToStaticMarkup(<EntryDetail row={row} onSelect={onSelect} />);
    expect(html).toContain('data-voice="remnant_archive"');
    expect(html).toContain('Remnant Archive · The Nine');
    expect(html).toContain('<em>hold</em>');
    expect(html).toContain('Year 3');
    expect(html).toContain('Learned through: Consent');
    expect(html).toContain('Locked entry');
    call(byName(tree, 'button', 'One Voice'), 'onClick');
    expect(onSelect.mock.calls).toEqual([['codex_tyrant_alone']]);
    expect(all(tree, 'button')).toHaveLength(1);
  });

  test('a locked entry is bars and a hint, never its text', () => {
    const row = codexRow(content.codex.codex_tyrant_consent!, content, freshProfile('c'), none);
    const html = renderToStaticMarkup(<EntryDetail row={row} onSelect={() => undefined} />);
    expect(html).toContain('silhouette');
    expect(html).toContain('Something you learn in one loop');
    expect(html).not.toContain('Hour, Go');
    expect(html).not.toContain('Fixture');
    expect(renderToStaticMarkup(<VoiceTag row={row} />)).toContain('WN');
  });
});

describe('CodexPanel in a live store', () => {
  test('opened from a request it shows that entry and marks it read', () => {
    const mine = createCodexReadStore(null);
    resetSharedCodexReadStore(mine);
    const profile = profileWith(['codex_tyrant_holding', 'codex_tyrant_alone']);
    const store = createGameStore(content, profile, { storage: memoryStorage() });
    requestCodexEntry('codex_tyrant_alone');
    const html = renderToStaticMarkup(
      <GameProvider value={store}>
        <PanelHost id="codex" onClose={() => undefined} />
      </GameProvider>,
    );
    expect(html).toContain('data-view="detail"');
    expect(html).toContain('Fixture: the chorus quiets; Veyran speaks alone.');
    expect(html).toContain('2 of 5 entries found, 2 new.'); // the mark lands after the first paint (an effect)
    resetSharedCodexReadStore(null);
  });
});
