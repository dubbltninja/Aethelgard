// Class Select (DESIGN §16.3 `screen_class_select`, PLAN §6.3) on the real content pack: five classes with the stats,
// resource, kit and fantasy text the run will actually start with; the local state; the rendered radio group and form,
// and a full Title → Class Select → newGame pass through the store.
import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildContentPack, contentTables, type ContentPack } from '@content/index';
import { memoryStorage, newRun } from '@engine/index';
import {
  beginArgs,
  classOptions,
  classSelectReducer,
  initialClassSelect,
  resourceRuleText,
  type ClassOption,
} from '@ui/screens/classOptions';
import { ClassSelectScreen, ClassSelectView } from '@ui/screens/ClassSelectScreen';
import { ClassSigil } from '@ui/screens/ClassSigil';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { all, byName, call, expand, fakeEvent, nameOf } from './tree';

let content: ContentPack;
let options: ClassOption[];
beforeAll(() => {
  content = buildContentPack(contentTables, { validate: false });
  options = classOptions(content, freshProfile('cs'));
});

describe('classOptions', () => {
  test('five classes in content order, each with fantasy text, title and intro', () => {
    expect(options.map((o) => o.name)).toEqual(['Ranger', 'Wizard', 'Elf', 'Ironclad Warden', 'Shadow Weaver']);
    for (const o of options) {
      expect(o.description.length).toBeGreaterThan(40);
      expect(o.title).not.toBe('');
      expect(o.intro).toMatch(/^As an? /);
    }
  });

  test('the numbers are the ones newRun starts with', () => {
    for (const o of options) {
      const p = newRun('check', o.id, content, freshProfile('cs')).player;
      expect([o.level, o.hp, o.mp, o.gold]).toEqual([p.level, p.hpMax, p.mpMax, p.gold]);
      expect(o.stats).toEqual(p.stats);
    }
    const ranger = options[0]!;
    expect([ranger.hp, ranger.mp, ranger.resourceName]).toEqual([120, 48, 'Focus']);
  });

  test('resource rules read as sentences, the Weaver adds the blood price', () => {
    expect(options[0]!.resourceRules).toEqual(['+8 Focus on a basic hit', '+12 Focus on a basic critical hit', '+5 Focus when you Guard']);
    expect(options[1]!.resourceRules[0]).toBe('+3 Mana at the start of each turn (+1 every 4 levels)');
    expect(options[4]!.resourceRules.at(-1)).toBe('Short of Mana, abilities cost 2 HP per missing point');
    const pct = resourceRuleText({ resource: { name: 'Grit', rules: [{ on: 'hit_taken', pctMax: 5 }, { on: 'guard', amount: 2, pctMax: 1 }] } });
    expect(pct).toEqual(['+5% of max Grit each time you are hit', '+2 and 1% of max Grit when you Guard']);
  });

  test('starting kits name their items; branches list five abilities each by tier', () => {
    expect(options[0]!.kit).toEqual([
      { itemId: 'item_rusty_dagger', name: 'Rusty Dagger', count: 1, equipped: true },
      { itemId: 'item_ley_touched_tonic', name: 'Ley-Touched Tonic', count: 2, equipped: false },
    ]);
    for (const o of options) {
      expect(o.branches).toHaveLength(3);
      for (const b of o.branches) {
        expect(b.abilities.map((a) => a.tier)).toEqual([1, 2, 3, 4, 5]);
      }
    }
  });

  test('mastery shows only once a class has been played', () => {
    expect(options.every((o) => o.mastery === null)).toBe(true);
    const veteran = freshProfile('v');
    veteran.classMastery.elf = { loopsPlayed: 2, mastered: ['elf_a', 'elf_b'], endings: [], bestLevel: 13, bestDays: null };
    const elf = classOptions(content, veteran).find((o) => o.id === 'elf');
    expect(elf?.mastery).toEqual({ loopsPlayed: 2, mastered: 2, bestLevel: 13 });
  });
});

describe('local state', () => {
  test('starts on the last class played, else the first', () => {
    expect(initialClassSelect(options, null).selected).toBe('ranger');
    expect(initialClassSelect(options, 'shadow_weaver').selected).toBe('shadow_weaver');
    expect(initialClassSelect(options, 'gone').selected).toBe('ranger');
    expect(initialClassSelect([], null).selected).toBe('');
  });

  test('select, step with wrap-around, name and seed', () => {
    const order = options.map((o) => o.id);
    let s = initialClassSelect(options, null);
    s = classSelectReducer(s, { type: 'step', by: -1, order });
    expect(s.selected).toBe('shadow_weaver');
    s = classSelectReducer(s, { type: 'step', by: 1, order });
    expect(s.selected).toBe('ranger');
    s = classSelectReducer(s, { type: 'select', classId: 'elf' });
    s = classSelectReducer(s, { type: 'name', value: '  Ann  ' });
    s = classSelectReducer(s, { type: 'seed', value: ' abc ' });
    expect(beginArgs(s)).toEqual({ name: 'Ann', classId: 'elf', seed: 'abc' });
    expect(beginArgs({ ...s, seed: '   ' })).toEqual({ name: 'Ann', classId: 'elf' });
    expect(classSelectReducer(s, { type: 'step', by: 1, order: [] })).toBe(s);
  });
});

describe('ClassSelectView', () => {
  const handlers = () => ({
    onSelect: mock((_id: string) => undefined),
    onName: mock((_v: string) => undefined),
    onSeed: mock((_v: string) => undefined),
    onBegin: mock(() => undefined),
    onBack: mock(() => undefined),
  });

  test('five named radios in one group, the selected one checked and focused first; Begin names the class', () => {
    const h = handlers();
    const state = { selected: 'wizard', name: '', seed: '' };
    const tree = expand(<ClassSelectView options={options} state={state} {...h} />);
    const radios = all(tree, 'input').filter((i) => i.props.type === 'radio');
    expect(radios.map(nameOf)).toEqual(['Ranger', 'Wizard', 'Elf', 'Ironclad Warden', 'Shadow Weaver']);
    expect(radios.filter((r) => r.props.checked).map(nameOf)).toEqual(['Wizard']);
    expect(radios.filter((r) => r.props['data-autofocus'] === '').map(nameOf)).toEqual(['Wizard']);
    expect(new Set(radios.map((r) => r.props.name))).toEqual(new Set(['class']));
    expect(byName(tree, 'button', 'Begin as Wizard').props.type).toBe('submit');
    expect(all(tree, 'legend').map((l) => l.text)).toEqual(['Class']);
    const html = renderToStaticMarkup(<ClassSelectView options={options} state={state} {...h} />);
    expect(html).toContain('self-taught ley-caster');
    expect(html).toContain('Starting kit');
    expect(html).toContain('Apprentice Staff (equipped)');
    expect(html).not.toMatch(/tabindex="[1-9]/);
  });

  test('every control has a name, and they come in visual order: back, classes, name, seed, begin', () => {
    const tree = expand(<ClassSelectView options={options} state={{ selected: 'ranger', name: '', seed: '' }} {...handlers()} />);
    const controls = tree.filter((n) => n.type === 'button' || n.type === 'input' || n.type === 'summary');
    expect(controls.every((c) => nameOf(c) !== '')).toBe(true);
    expect(controls.map(nameOf)).toEqual([
      'Back to title',
      'Ranger',
      'Wizard',
      'Elf',
      'Ironclad Warden',
      'Shadow Weaver',
      'Name',
      'Seed (optional)',
      'Seed',
      'Begin as Ranger',
    ]);
  });

  test('handlers: tap a class, type a name and seed, submit, go back', () => {
    const h = handlers();
    const tree = expand(<ClassSelectView options={options} state={{ selected: 'ranger', name: '', seed: '' }} {...h} />);
    call(byName(tree, 'input', 'Elf'), 'onChange');
    call(byName(tree, 'input', 'Name'), 'onChange', fakeEvent({ value: 'Ann' }));
    call(byName(tree, 'input', 'Seed'), 'onChange', fakeEvent({ value: 'xyz' }));
    const submit = fakeEvent();
    call(all(tree, 'form')[0]!, 'onSubmit', submit);
    call(byName(tree, 'button', 'Back to title'), 'onClick');
    expect(h.onSelect.mock.calls).toEqual([['elf']]);
    expect(h.onName.mock.calls).toEqual([['Ann']]);
    expect(h.onSeed.mock.calls).toEqual([['xyz']]);
    expect(submit.prevented()).toBe(true);
    expect(h.onBegin).toHaveBeenCalledTimes(1);
    expect(h.onBack).toHaveBeenCalledTimes(1);
  });

  test('a mastery badge appears on a played class; sigils are decorative', () => {
    const veteran = options.map((o) => (o.id === 'elf' ? { ...o, mastery: { loopsPlayed: 1, mastered: 0, bestLevel: 9 } } : o));
    const html = renderToStaticMarkup(<ClassSelectView options={veteran} state={{ selected: 'elf', name: '', seed: '' }} {...handlers()} />);
    expect(html).toContain('Played 1 loop, best level 9');
    expect(renderToStaticMarkup(<ClassSigil classId="nobody" />)).toContain('aria-hidden="true"');
  });

  test('the container renders inside a store, and the begin path reaches explore', () => {
    const store = createGameStore(content, freshProfile('cs'), { storage: memoryStorage(), rethrow: false });
    const html = renderToStaticMarkup(
      <GameProvider value={store}>
        <ClassSelectScreen onBack={() => undefined} />
      </GameProvider>,
    );
    expect(html).toContain('data-screen="class-select"');
    const args = beginArgs({ selected: 'ironclad_warden', name: 'Brakka', seed: 'u63' });
    expect(store.shell.newGame(args.name, args.classId, args.seed)).toEqual({ ok: true });
    expect(store.getState()).toMatchObject({ mode: 'explore', player: { classId: 'ironclad_warden', name: 'Brakka' }, meta: { seed: 'u63' } });
    expect(store.getState().world.currentLocationId).toBe(content.config.startLocationId);
  });
});
