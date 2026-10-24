// The Ending screen and the Run Summary (U68; DESIGN §10.2, §15.3, §16.3; STORY §10; D-049, D-100) on the real pack: a closer
// (Loop 2's *Let go*) and a true ending (A), the slides in the engine's order with their kinds, the summary with its numbers, the
// buttons that go on, and the view driven through tests/unit/ui/tree.ts.
import { describe, expect, mock, test } from 'bun:test';
import { endingSlides } from '@engine/index';
import { endingModel, endingSlideList } from '@ui/screens/endingModel';
import { EndingView } from '@ui/screens/EndingScreen';
import { RunSummaryView } from '@ui/screens/RunSummary';
import { idWords, lastRecord, outcomeText, runSummaryModel, summarySource, damageSourceName } from '@ui/screens/runSummaryModel';
import { all, byName, call, expand, nameOf } from './tree';
import { act, closerEndingAt, legalFor, mutable, pack, trueEndingAt } from './thresholdFixtures';

describe('outcomeText', () => {
  test('closers and endings in words', () => {
    expect(outcomeText('closer_escape', undefined, pack)).toMatchObject({ kind: 'escape', label: 'The Escape' });
    expect(outcomeText('closer_fall', 'released', pack)).toMatchObject({ kind: 'fall', label: 'The Fall · Let go' });
    expect(outcomeText('closer_fall', 'expiry', pack).label).toBe('The Fall · The thirtieth dawn');
    expect(outcomeText('closer_fall', 'rejected', pack).label).toBe('The Fall · Turned away by the Tyrant');
    expect(outcomeText('closer_fall', 'death', pack).label).toBe('The Fall · Fell in the Breach');
    const a = outcomeText('ending_wardens_vigil', undefined, pack);
    expect(a.kind).toBe('ending');
    expect(a.label).toBe("The Warden's Vigil");
    expect(a.tagline).toBe(pack.endings['ending_wardens_vigil']?.tagline);
    expect(outcomeText('ending_unknown_x', undefined, pack).label).toBe('Unknown x');
    expect(idWords('fam_wildling_kin')).toBe('Wildling kin');
  });
});

describe('the closer’s ending screen', () => {
  test('the slides are exactly the engine’s, in order, the first one a lead-in for the Fall’s reason', () => {
    const at = closerEndingAt();
    expect(at.state.mode).toBe('ending');
    const slides = endingSlideList(at.state, pack, at.profile);
    expect(slides.map((s) => s.text)).toEqual(endingSlides(at.state, pack, at.profile));
    expect(slides[0]).toMatchObject({ kind: 'lead' });
    expect(slides[0]?.text).toContain('You let the day go');
    expect(slides.slice(1).every((s) => s.kind === 'scene' || s.kind === 'epilogue')).toBe(true);
  });

  test('the model: where the loop leads next, the button, no New Game+ after a closer', () => {
    const at = closerEndingAt();
    const m = endingModel(at.state, pack, at.profile, legalFor(at))!;
    expect(m.outcome.label).toBe('The Fall · Let go');
    expect(m.letter).toBeNull();
    expect(m.index).toBe(0);
    expect(m.total).toBeGreaterThanOrEqual(2);
    expect(m.last).toBe(false);
    expect(m.next.label).toBe('Continue');
    expect(m.onward.label).toBe('On to the Threshold');
    expect(m.newGamePlus).toBeNull();
    expect(m.credits).toBe(false);
    expect(m.advance).toMatchObject({ enabled: true, action: { type: 'acknowledgeEnding' } });
  });

  test('the last slide offers the summary; Loop 1 leads to Loop 2 instead of the Threshold', () => {
    let at = closerEndingAt();
    const total = endingModel(at.state, pack, at.profile, legalFor(at))!.total;
    for (let i = 1; i < total; i++) at = act(at, { type: 'acknowledgeEnding' });
    const m = endingModel(at.state, pack, at.profile, legalFor(at))!;
    expect(m.last).toBe(true);
    expect(m.index).toBe(total - 1);
    expect(m.next.label).toBe('See how the loop went');
    const first = mutable(at);
    first.state.meta.loop = 1;
    expect(endingModel(first.state, pack, first.profile, legalFor(first))!.onward.label).toBe('Wake in Loop 2');
  });

  test('going on after the last slide lands on the Still Shore', () => {
    let at = closerEndingAt();
    while (at.state.mode === 'ending') at = act(at, { type: 'acknowledgeEnding' });
    expect(at.state.mode).toBe('threshold');
  });

  test('no pending ending, no model', () => {
    const at = mutable(closerEndingAt());
    at.state.pendingEnding = null;
    expect(endingModel(at.state, pack, at.profile, legalFor(at))).toBeNull();
    expect(endingSlideList(at.state, pack, at.profile)).toEqual([]);
  });
});

describe('a true ending', () => {
  test('a true ending: its letter, its credits on the last slide, its epilogues labelled, New Game+ offered', () => {
    let at = trueEndingAt();
    const outcome = at.state.pendingEnding!.outcome;
    expect(outcome.startsWith('ending_')).toBe(true);
    const slides = endingSlideList(at.state, pack, at.profile);
    expect(slides.map((s) => s.text)).toEqual(endingSlides(at.state, pack, at.profile));
    expect(slides.some((s) => s.kind === 'epilogue')).toBe(true);
    expect(slides.filter((s) => s.kind === 'epilogue').every((s) => s.label?.startsWith('Epilogue'))).toBe(true);
    const first = endingModel(at.state, pack, at.profile, legalFor(at))!;
    expect(first.letter).toBe(`Ending ${pack.endings[outcome]!.letter}`);
    expect(first.outcome.kind).toBe('ending');
    expect(first.credits).toBe(false);
    for (let i = 1; i < first.total; i++) at = act(at, { type: 'acknowledgeEnding' });
    const last = endingModel(at.state, pack, at.profile, legalFor(at))!;
    expect(last.credits).toBe(true);
    expect(last.newGamePlus).toMatchObject({ id: 'new-game-plus', danger: true, enabled: true });
    expect(last.newGamePlus?.confirm).toContain('You keep every Echo');
  });
});

describe('the Run Summary', () => {
  test('from the ending screen: the loop’s facts, its numbers, its Echoes and the Resonance with the multiplier', () => {
    const at = closerEndingAt();
    const source = summarySource(at.state, at.profile)!;
    expect(source.run).not.toBeNull();
    const m = runSummaryModel(source, pack);
    expect(m.heading).toBe('Loop 2 · Ranger');
    expect(m.outcome.label).toBe('The Fall · Let go');
    expect(m.facts.map((f) => f.key)).toEqual(['loop', 'class', 'days', 'level', 'quests']);
    expect(m.facts.find((f) => f.key === 'days')?.value).toBe('Day 1, dawn');
    expect(m.facts.find((f) => f.key === 'quests')?.value).toBe('0');
    expect(m.combat.find((f) => f.key === 'kills')?.value).toBe('None');
    for (const key of ['fights', 'dealt', 'taken', 'gold']) expect(m.combat.map((f) => f.key)).toContain(key);
    expect(m.echoes.map((e) => e.name)).toEqual(['The Amulet Remembers']);
    expect(m.resonance).toEqual({ base: 0, multiplier: 1, bonus: 0, total: 0 });
    expect(m.legacy).toBe(0);
    expect(m.choices.map((c) => c.key)).toEqual(['tyrant', 'heartstone']);
    expect(m.choices[0]?.value).toBe('Never faced');
    expect(m.credit).toBe('A game by Tim Dibert');
    expect(m.seed).toBe(at.profile.runHistory.at(-1)?.seed);
  });

  test('with kills, damage and modifiers: kills by family, the top damage sources with their share, Resonance × multiplier', () => {
    const at = mutable(closerEndingAt());
    const creature = Object.values(pack.creatures)[0]!;
    at.state.counters.kills = { [creature.id]: 3 };
    at.state.counters.damageBySource = { basic: 60, status: 0, 'status:poison': 20, 'companion:ilyra': 20 };
    at.state.counters.damageDealt = 100;
    at.state.counters.goldEarned = 10;
    at.state.counters.resonance = 40;
    at.profile.runHistory[at.profile.runHistory.length - 1] = { ...at.profile.runHistory.at(-1)!, modifiers: ['mod_glass', 'mod_pacifist'] };
    const m = runSummaryModel(summarySource(at.state, at.profile)!, pack);
    expect(m.combat.find((f) => f.key === 'kills')?.value).toMatch(/^3 \(/);
    expect(m.damageTop[0]).toEqual({ source: 'Basic attacks', amount: 60, share: 60 });
    expect(m.damageTop.map((d) => d.source)).toContain('Poison (over time)');
    expect(m.resonance).toEqual({ base: 40, multiplier: 2.25, bonus: 50, total: 90 });
    expect(m.legacy).toBe(Math.round((10 * 5 + 100 / 2 + at.state.player.xp) / 2)); // halved on a loss
    expect(m.choices.find((c) => c.key === 'modifiers')?.value).toBe(`${pack.modifiers['mod_glass']!.name}, ${pack.modifiers['mod_pacifist']!.name}`);
  });

  test('from the Still Shore only the record is left: no numbers that were never kept', () => {
    const at = act(closerEndingAt(), { type: 'acknowledgeEnding' });
    let state = at;
    while (state.state.mode === 'ending') state = act(state, { type: 'acknowledgeEnding' });
    const source = summarySource(state.state, state.profile)!;
    expect(source.run).toBeNull();
    const m = runSummaryModel(source, pack);
    expect(m.combat).toEqual([]);
    expect(m.resonance).toBeNull();
    expect(m.legacy).toBeNull();
    expect(m.facts.find((f) => f.key === 'days')?.value).toBe('Day 1');
    expect(m.echoes).toHaveLength(1);
  });

  test('a profile with no finished loop has no summary', () => {
    const at = mutable(closerEndingAt());
    at.profile.runHistory = [];
    expect(lastRecord(at.profile)).toBeNull();
    expect(summarySource(at.state, at.profile)).toBeNull();
  });

  test('damage sources read as names', () => {
    expect(damageSourceName('basic', pack)).toBe('Basic attacks');
    expect(damageSourceName('status:bleed', pack)).toBe('Bleed (over time)');
    expect(damageSourceName('companion:brak', pack)).toBe('Brak');
    const ability = Object.values(pack.abilities)[0]!;
    expect(damageSourceName(ability.id, pack)).toBe(ability.name);
    expect(damageSourceName('item:nothing_here', pack)).toBe('Nothing here');
  });
});

describe('EndingView', () => {
  const setup = () => {
    const at = closerEndingAt();
    return { at, model: endingModel(at.state, pack, at.profile, legalFor(at))! };
  };
  const summaryOf = (at: ReturnType<typeof closerEndingAt>) => runSummaryModel(summarySource(at.state, at.profile)!, pack);
  const props = { scene: null, reducedMotion: true, onNext: () => undefined, onBack: () => undefined, onRun: () => undefined };

  test('slides: one heading, the slide’s words, its place in the sequence, and Continue (focused first)', () => {
    const { at, model } = setup();
    const next = mock(() => undefined);
    const tree = expand(<EndingView {...props} phase="slides" model={model} summary={summaryOf(at)} onNext={next} />);
    expect(all(tree, 'h1').map(nameOf)).toEqual(['The Fall · Let go']);
    expect(tree.find((n) => n.props.className === 'ending__text')?.text).toBe(model.slide.text);
    const button = byName(tree, 'button', 'Continue');
    expect(button.props['data-autofocus']).toBe('');
    expect(tree.find((n) => n.props.className === 'ending__progress')?.props['aria-label']).toBe(`Slide 1 of ${model.total}`);
    call(button, 'onClick');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('the summary step: the Run Summary, the way on, a way back; no New Game+ after a closer', () => {
    const { at, model } = setup();
    const run = mock((_row: unknown) => undefined);
    const back = mock(() => undefined);
    const tree = expand(<EndingView {...props} phase="summary" model={model} summary={summaryOf(at)} onRun={run} onBack={back} />);
    expect(all(tree, 'h2').map(nameOf)).toContain('Loop 2 · Ranger');
    expect(tree.some((n) => n.type === 'h3' && nameOf(n) === 'Echoes gained · 1')).toBe(true);
    call(byName(tree, 'button', 'On to the Threshold'), 'onClick');
    expect(run.mock.calls[0]?.[0]).toMatchObject({ action: { type: 'acknowledgeEnding' }, label: 'On to the Threshold' });
    call(byName(tree, 'button', 'Back to the ending'), 'onClick');
    expect(back).toHaveBeenCalledTimes(1);
    expect(tree.some((n) => nameOf(n) === 'Begin New Game+')).toBe(false);
  });

  test('after a true ending the summary offers New Game+ behind its question', () => {
    let at = trueEndingAt();
    const total = endingModel(at.state, pack, at.profile, legalFor(at))!.total;
    for (let i = 1; i < total; i++) at = act(at, { type: 'acknowledgeEnding' });
    const model = endingModel(at.state, pack, at.profile, legalFor(at))!;
    const run = mock((_row: unknown) => undefined);
    const tree = expand(<EndingView {...props} phase="summary" model={model} summary={summaryOf(at)} onRun={run} />);
    call(byName(tree, 'button', 'Begin New Game+'), 'onClick');
    expect(run.mock.calls[0]?.[0]).toMatchObject({ action: { type: 'newGamePlus' } });
    expect((run.mock.calls[0]?.[0] as { confirm: string }).confirm).toContain('New Game+');
  });
});

describe('RunSummaryView', () => {
  test('headings, facts as definition lists, and nothing without a name', () => {
    const at = closerEndingAt();
    const m = runSummaryModel(summarySource(at.state, at.profile)!, pack);
    const tree = expand(<RunSummaryView model={m} />);
    expect(all(tree, 'h2').map(nameOf)).toEqual(['Loop 2 · Ranger']);
    for (const h of ['The loop', 'Fights and coin', 'Echoes gained · 1', 'Resonance earned']) expect(all(tree, 'h3').map(nameOf)).toContain(h);
    const facts = tree.find((n) => n.type === 'dl' && n.props['aria-label'] === 'The loop')!;
    expect(facts.text).toContain('Level reached');
    expect(tree.find((n) => n.props['data-testid'] === 'summary-resonance')?.text).toBe('0');
    expect(tree.find((n) => n.props.className === 'summary__credit')?.text).toBe('A game by Tim Dibert');
  });

  test('without a run’s numbers the fights and the Resonance sections are left out', () => {
    const at = closerEndingAt();
    let s = at;
    while (s.state.mode === 'ending') s = act(s, { type: 'acknowledgeEnding' });
    const tree = expand(<RunSummaryView model={runSummaryModel(summarySource(s.state, s.profile)!, pack)} />);
    expect(all(tree, 'h3').map(nameOf)).not.toContain('Fights and coin');
    expect(all(tree, 'h3').map(nameOf)).not.toContain('Resonance earned');
  });
});
