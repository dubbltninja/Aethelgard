// The Threshold screen's views (U68; DESIGN §10.8, §16.3, §16.7) driven through tests/unit/ui/tree.ts on the real pack: the
// Still Shore, the Gallery, the Loom and the Far Light each as a pure view of its model, the tab bar of the four places, and the
// whole screen rendered to markup inside the store. Real clicks, keys and the bottom tab bar are e2e's (tests/e2e/threshold.spec.ts).
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryStorage } from '@engine/index';
import { ThresholdScreen, ThresholdView, FarLightView, GalleryView, LoomView, ShoreView, neighbourPlace, type PlaceBody } from '@ui/screens/ThresholdScreen';
import { farLightModel, galleryModel, loomModel, placeTabs, shoreModel, thresholdHeader } from '@ui/screens/thresholdModel';
import { createGameStore } from '@ui/store/gameStore';
import { GameProvider } from '@ui/store/useGame';
import { all, byName, call, expand, nameOf } from './tree';
import { act, goTo, legalFor, pack, thresholdAt } from './thresholdFixtures';

const noop = (): void => undefined;

describe('ShoreView', () => {
  test('how you came, the Echoes, who is here with a Talk button, the run summary', () => {
    const at = thresholdAt();
    const run = mock((_row: unknown) => undefined);
    const summary = mock(noop);
    const tree = expand(<ShoreView model={shoreModel(at.state, pack, at.profile, legalFor(at))} onRun={run} onSummary={summary} />);
    expect(all(tree, 'h2').map(nameOf)).toEqual(['How you came', 'Echoes gained · 1', 'Who is here', 'What the shore shows']);
    expect(tree.some((n) => n.text === 'The Fall · Let go')).toBe(true);
    call(byName(tree, 'button', 'Talk to Dask'), 'onClick');
    expect(run.mock.calls[0]?.[0]).toMatchObject({ action: { type: 'talk', npcId: 'npc_dask' } });
    call(byName(tree, 'button', 'Run summary'), 'onClick');
    expect(summary).toHaveBeenCalledTimes(1);
  });

  test('an empty shore says so', () => {
    const at = thresholdAt();
    const model = { ...shoreModel(at.state, pack, at.profile, legalFor(at)), people: [], echoes: [], came: null, summary: null, canSummary: false, lines: [] };
    const tree = expand(<ShoreView model={model} onRun={noop} onSummary={noop} />);
    const text = tree.map((n) => n.text).join(' | ');
    expect(text).toContain('No one else is here.');
    expect(text).toContain('No Echo came back with you.');
    expect(tree.some((n) => n.type === 'button' && nameOf(n) === 'Run summary')).toBe(false);
  });
});

describe('GalleryView', () => {
  test('a card per loop with its outcome in words, the Archive in groups, and the two panels one tap away', () => {
    const at = goTo(thresholdAt(), 'gallery');
    const open = mock((_id: string) => undefined);
    const model = galleryModel(at.state, pack, at.profile);
    const tree = expand(<GalleryView model={model} canTimeline canAchievements onOpenPanel={open} />);
    const cards = tree.filter((n) => n.type === 'li' && String(n.props.className) === 'loop-card');
    expect(cards).toHaveLength(2);
    expect(cards[1]?.text).toContain('The Fall · Let go');
    expect(cards[1]?.text).toContain('Ranger');
    expect(all(tree, 'details').length).toBe(model.archive.groups.length);
    call(byName(tree, 'button', 'Loop timeline'), 'onClick');
    call(byName(tree, 'button', 'Achievements: 0 of 40'), 'onClick');
    expect(open.mock.calls.map((c) => c[0])).toEqual(['timeline', 'achievements']);
  });

  test('a panel that cannot open is a disabled button', () => {
    const at = goTo(thresholdAt(), 'gallery');
    const tree = expand(<GalleryView model={galleryModel(at.state, pack, at.profile)} canTimeline={false} canAchievements={false} onOpenPanel={noop} />);
    expect(byName(tree, 'button', 'Loop timeline').props.disabled).toBe(true);
  });

  test('the seven marks appear as seven frames with words', () => {
    const at = goTo(thresholdAt(), 'gallery');
    const mutated = structuredClone(at);
    mutated.state.quests['q_seven_marks'] = { status: 'active', stage: 'marks_seen', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] };
    const tree = expand(<GalleryView model={galleryModel(mutated.state, pack, mutated.profile)} canTimeline canAchievements onOpenPanel={noop} />);
    const frames = tree.filter((n) => n.props.className === 'gallery__frame');
    expect(frames).toHaveLength(7);
    expect(frames[0]?.text).toContain('Frame 1: scratched');
  });
});

describe('LoomView', () => {
  test('Resonance and the five slots; weave, equip and unequip send the engine’s actions', () => {
    let at = goTo(thresholdAt(), 'loom');
    const run = mock((_row: unknown) => undefined);
    let tree = expand(<LoomView model={loomModel(at.state, pack, at.profile, legalFor(at))} onRun={run} />);
    expect(tree.find((n) => n.props['data-testid'] === 'loom-resonance')?.props['aria-label']).toBe('Resonance 100');
    expect(tree.filter((n) => n.props.className === 'loom__slot')).toHaveLength(5);
    call(byName(tree, 'button', 'Weave Steady Hand (20)'), 'onClick');
    expect(run.mock.calls[0]?.[0]).toMatchObject({ action: { type: 'thresholdSpend', attunementId: 'att_steady_hand' } });
    at = act(at, { type: 'thresholdSpend', attunementId: 'att_steady_hand' });
    tree = expand(<LoomView model={loomModel(at.state, pack, at.profile, legalFor(at))} onRun={run} />);
    call(byName(tree, 'button', 'Equip Steady Hand'), 'onClick');
    expect(run.mock.calls[1]?.[0]).toMatchObject({ action: { type: 'equipAttunement', attunementId: 'att_steady_hand', on: true } });
    call(byName(tree, 'button', 'Unpick Steady Hand'), 'onClick');
    expect(run.mock.calls[2]?.[0]).toMatchObject({ action: { type: 'thresholdRefund', attunementId: 'att_steady_hand' } });
  });

  test('a button that is off carries its reason beside it', () => {
    const at = structuredClone(goTo(thresholdAt(), 'loom'));
    at.profile.resonance = 5;
    const tree = expand(<LoomView model={loomModel(at.state, pack, at.profile, legalFor(at))} onRun={noop} />);
    const buy = byName(tree, 'button', 'Weave Steady Hand (20)');
    expect(buy.props.disabled).toBe(true);
    expect(buy.props['aria-describedby']).toBe('buy-att_steady_hand-why');
    expect(tree.find((n) => n.props.id === 'buy-att_steady_hand-why')?.text).toBe('Steady Hand costs 20 Resonance; you have 5');
  });

  test('each modifier is a toggle button that says what it multiplies and whether it is on', () => {
    const at = goTo(thresholdAt(), 'loom');
    const run = mock((_row: unknown) => undefined);
    const tree = expand(<LoomView model={loomModel(at.state, pack, at.profile, legalFor(at))} onRun={run} />);
    const glass = byName(tree, 'button', 'Glass, ×1.5 Resonance');
    expect(glass.props['aria-pressed']).toBe(false);
    expect(glass.text).toBe('Off');
    call(glass, 'onClick');
    expect(run.mock.calls[0]?.[0]).toMatchObject({ action: { type: 'toggleModifier', modifierId: 'mod_glass' } });
    const on = act(at, { type: 'toggleModifier', modifierId: 'mod_glass' });
    const tree2 = expand(<LoomView model={loomModel(on.state, pack, on.profile, legalFor(on))} onRun={noop} />);
    expect(byName(tree2, 'button', 'Glass, ×1.5 Resonance').props['aria-pressed']).toBe(true);
    expect(tree2.find((n) => n.props['data-testid'] === 'loom-multiplier')?.text).toBe('All together: ×1.5');
  });

  test('Iron Loop says its slots stay empty; New Game+ shows only after an ending', () => {
    const at = structuredClone(goTo(thresholdAt(), 'loom'));
    const none = expand(<LoomView model={loomModel(at.state, pack, at.profile, legalFor(at))} onRun={noop} />);
    expect(none.some((n) => n.text.includes('New Game+') && n.type === 'h2')).toBe(false);
    at.profile.endingsReached.push('ending_unbound');
    at.profile.modifiers['mod_iron_loop'] = true;
    const tree = expand(<LoomView model={loomModel(at.state, pack, at.profile, legalFor(at))} onRun={noop} />);
    expect(tree.some((n) => n.type === 'h2' && nameOf(n) === 'New Game+')).toBe(true);
    expect(tree.some((n) => n.props.role === 'note' && n.text.includes('Iron Loop is on'))).toBe(true);
    expect(byName(tree, 'button', 'Begin New Game+').props.disabled).toBe(false);
  });
});

describe('FarLightView', () => {
  test('a pressed button for the chosen class, a tap for another; the class’s detail; Step into the light', () => {
    const at = goTo(thresholdAt(), 'far_light');
    const run = mock((_row: unknown) => undefined);
    const tree = expand(<FarLightView model={farLightModel(at.state, pack, at.profile, legalFor(at))} onRun={run} />);
    const buttons = tree.filter((n) => n.type === 'button' && String(n.props.className) === 'class-pick');
    expect(buttons).toHaveLength(5);
    expect(buttons.filter((b) => b.props['aria-pressed'] === true)).toHaveLength(1);
    expect(buttons.find((b) => b.props['data-class'] === 'ranger')?.text).toContain('Chosen · the class you just played');
    const other = buttons.find((b) => b.props['data-class'] !== 'ranger')!;
    call(other, 'onClick');
    expect(run.mock.calls[0]?.[0]).toMatchObject({ action: { type: 'chooseClass', classId: other.props['data-class'] } });
    expect(tree.some((n) => n.type === 'h3' && nameOf(n) === 'Starting kit')).toBe(true);
    call(byName(tree, 'button', 'Step into the light: begin Loop 3'), 'onClick');
    expect(run.mock.calls[1]?.[0]).toMatchObject({ action: { type: 'newLoop' } });
  });

  test('what is carried is written out', () => {
    let at = goTo(thresholdAt(), 'loom');
    at = act(at, { type: 'toggleModifier', modifierId: 'mod_glass' });
    at = goTo(at, 'far_light');
    const tree = expand(<FarLightView model={farLightModel(at.state, pack, at.profile, legalFor(at))} onRun={noop} />);
    const dl = tree.find((n) => n.type === 'dl' && n.props['aria-label'] === 'Carried into the next loop')!;
    expect(dl.text).toContain('None woven in');
    expect(dl.text).toContain('Glass (×1.5)');
  });
});

describe('ThresholdView and the screen', () => {
  const body = (at: ReturnType<typeof thresholdAt>): PlaceBody => ({ area: 'still_shore', model: shoreModel(at.state, pack, at.profile, legalFor(at)) });

  test('the four places are a tablist; the current one is selected; picking one reports it', () => {
    const at = thresholdAt();
    const go = mock((_a: string) => undefined);
    const tree = expand(
      <ThresholdView
        header={thresholdHeader(at.state, pack, at.profile)}
        tabs={placeTabs()}
        body={body(at)}
        scene={null}
        reducedMotion
        onGo={go}
        onRun={noop}
        onSummary={noop}
        onOpenPanel={noop}
        canOpenPanel={() => true}
      />,
    );
    expect(all(tree, 'h1').map(nameOf)).toEqual(['The Still Shore']);
    const tabs = tree.filter((n) => n.props.role === 'tab');
    expect(tabs.map(nameOf)).toEqual(['Still Shore', 'Gallery', 'Loom', 'Far Light']);
    expect(tabs.map((t) => t.props['aria-selected'])).toEqual([true, false, false, false]);
    expect(tree.find((n) => n.props.role === 'tabpanel')?.props['aria-labelledby']).toBe('threshold-tab-still_shore');
    call(byName(tree, 'button', 'Loom'), 'onClick');
    expect(go.mock.calls[0]?.[0]).toBe('loom');
    expect(tree.find((n) => n.props['data-screen'] === 'threshold')).toBeDefined();
  });

  test('←/→ stop at the ends of the row', () => {
    const tabs = placeTabs();
    expect(neighbourPlace(tabs, 'still_shore', -1)).toBeNull();
    expect(neighbourPlace(tabs, 'still_shore', 1)).toBe('gallery');
    expect(neighbourPlace(tabs, 'far_light', 1)).toBeNull();
    expect(neighbourPlace(tabs, 'far_light', -1)).toBe('loom');
  });

  test('the whole screen renders inside the store, one h1, a tabpanel, and no control without a name', () => {
    const at = thresholdAt();
    const store = createGameStore(pack, at.profile, { initialState: at.state, storage: memoryStorage() });
    const html = renderToStaticMarkup(
      <GameProvider value={store}>
        <ThresholdScreen />
      </GameProvider>,
    );
    expect(html).toContain('data-screen="threshold"');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('Talk to Dask');
    expect(html).toContain('The Threshold · before Loop 3');
  });
});
