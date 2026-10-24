// The Threshold's models (U68; DESIGN §10.6–10.9, §15.1; D-083) on the real pack, from the state after Loop 2's *Let go*: the
// four places, the Still Shore's people and lines, the Gallery's cards and Archive, the Loom (buy · equip · unpick, the five
// slots, the modifiers and their multipliers, New Game+), the Far Light (the class choice, what is carried, *Step into the light*).
import { describe, expect, test } from 'bun:test';
import {
  PLACE_LABELS,
  endingHints,
  farLightModel,
  galleryModel,
  loomModel,
  marksModel,
  multText,
  placeTabs,
  recordGlyphs,
  shoreModel,
  thresholdHeader,
} from '@ui/screens/thresholdModel';
import { act, goTo, legalFor, mutable, pack, thresholdAt } from './thresholdFixtures';

describe('the four places', () => {
  test('DESIGN §10.8 order, with short labels for the tabs', () => {
    expect(placeTabs().map((t) => [t.id, t.label])).toEqual([
      ['still_shore', 'Still Shore'],
      ['gallery', 'Gallery'],
      ['loom', 'Loom'],
      ['far_light', 'Far Light'],
    ]);
    expect(PLACE_LABELS.far_light).toBe('Far Light');
  });

  test('the header names the place, the loop the Far Light opens and the Resonance', () => {
    const at = thresholdAt();
    const h = thresholdHeader(at.state, pack, at.profile);
    expect(h).toMatchObject({ area: 'still_shore', locationId: 'loc_still_shore', placeName: 'The Still Shore', nextLoop: 3, resonance: 100 });
    expect(h.description).toContain('Black sand');
    expect(thresholdHeader(goTo(at, 'loom').state, pack, at.profile)).toMatchObject({ area: 'loom', placeName: 'The Loom' });
  });
});

describe('the Still Shore', () => {
  test('how you came, the record’s line, the Echoes it gave and who is here', () => {
    const at = thresholdAt();
    const m = shoreModel(at.state, pack, at.profile, legalFor(at));
    expect(m.came).toMatchObject({ kind: 'fall', label: 'The Fall · Let go' });
    expect(m.summary).toBe('Loop 2 · Ranger · Fall (released) · Day 1');
    expect(m.echoes.map((e) => e.name)).toEqual(['The Amulet Remembers']);
    expect(m.echoes[0]?.codexLine).not.toBe('');
    expect(m.canSummary).toBe(true);
    expect(m.lines.map((l) => l.text)).toContain('The Still Shore: grey water, no horizon, a far light.');
    const dask = m.people.find((p) => p.id === 'npc_dask');
    expect(dask).toBeDefined();
    expect(dask?.talk).toMatchObject({ id: 'talk-npc_dask', label: 'Talk to Dask', enabled: true });
    expect(dask?.talk.action).toEqual({ type: 'talk', npcId: 'npc_dask' });
  });

  test('nobody stands in the other places', () => {
    const at = goTo(thresholdAt(), 'loom');
    expect(shoreModel(at.state, pack, at.profile, legalFor(at)).people).toEqual([]);
  });

  test('glimpses of the Tyrant are counted from the Echoes held, and said only when there are some', () => {
    const at = thresholdAt();
    expect(shoreModel(at.state, pack, at.profile, legalFor(at)).glimpses).toBeNull();
    at.profile.echoes.push('echo_tyrant_speaks', 'echo_tyrant_rejected');
    expect(shoreModel(at.state, pack, at.profile, legalFor(at)).glimpses).toBe('You carry 2 glimpses of the Tyrant.');
  });
});

describe('the Gallery', () => {
  test('one card per loop, oldest first, each with its outcome in words', () => {
    const at = goTo(thresholdAt(), 'gallery');
    const g = galleryModel(at.state, pack, at.profile);
    expect(g.cards.map((c) => c.loop)).toEqual([1, 2]);
    expect(['escape', 'fall']).toContain(g.cards[0]?.outcome.kind);
    expect(g.cards[1]).toMatchObject({ className: 'Ranger', days: 1, level: 1, echoCount: 1 });
    expect(g.cards[1]?.outcome.label).toBe('The Fall · Let go');
    expect(g.achievements.total).toBe(40);
    expect(g.endings).toMatchObject({ reached: 0, total: 6 });
  });

  test('the Archive groups the Echoes held by kind; a kind with none is left out', () => {
    const at = thresholdAt();
    at.profile.echoes.push('echo_litany_verse_1');
    const g = galleryModel(at.state, pack, at.profile);
    expect(g.archive.total).toBe(103);
    expect(g.archive.held).toBe(at.profile.echoes.length);
    expect(g.archive.groups.length).toBeGreaterThan(0);
    expect(g.archive.groups.every((x) => x.echoes.length > 0)).toBe(true);
    const lore = g.archive.groups.find((x) => x.category === 'lore');
    expect(lore?.label).toBe('Lore');
    expect(lore?.echoes.map((e) => e.id)).toContain('echo_litany_verse_1');
  });

  test('the seven marks show once the quest is known: plain until it has shown them, scratched after', () => {
    const at = thresholdAt();
    expect(marksModel(at.state, at.profile)).toBeNull();
    at.state.quests['q_seven_marks'] = { status: 'active', stage: 'six_known', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] };
    const plain = marksModel(at.state, at.profile);
    expect(plain?.frames).toHaveLength(7);
    expect(plain?.frames.every((f) => !f.marked)).toBe(true);
    at.state.quests['q_seven_marks'].stage = 'marks_seen';
    expect(marksModel(at.state, at.profile)?.frames.every((f) => f.marked)).toBe(true);
    const held = thresholdAt();
    held.profile.echoes.push('echo_seven_wayfinders');
    expect(marksModel(held.state, held.profile)?.frames.every((f) => f.marked)).toBe(true);
  });

  test('ending hints say only what an Echo the profile lacks would fix, and keep the ending’s name back', () => {
    const at = thresholdAt();
    const hints = endingHints(pack, at.profile);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints).toContain('You do not yet hold all nine verses of the Litany.');
    for (const name of Object.values(pack.endings).map((e) => e?.name ?? '')) expect(hints.join(' ')).not.toContain(name);
    at.profile.echoes.push('echo_litany_complete');
    expect(endingHints(pack, at.profile)).not.toContain('You do not yet hold all nine verses of the Litany.');
  });

  test('a record’s key choices become marks with words', () => {
    const at = thresholdAt();
    const record = { ...at.profile.runHistory[1]!, tyrant: 'spared' as const, heartstone: 'stabilized', modifiers: ['mod_glass'] };
    expect(recordGlyphs(record, pack).map((g) => g.text)).toEqual(['Tyrant: Spared', 'Heartstone: Stabilized', 'Glass']);
    expect(recordGlyphs({ ...record, tyrant: 'untouched', heartstone: 'intact', modifiers: [] }, pack)).toEqual([]);
  });
});

describe('the Loom', () => {
  const atLoom = () => goTo(thresholdAt(), 'loom');

  test('fifteen Attunements with their costs, five empty slots, six modifiers, no New Game+ before an ending', () => {
    const at = atLoom();
    const m = loomModel(at.state, pack, at.profile, legalFor(at));
    expect(m).toMatchObject({ resonance: 100, cap: 5, ironLoop: false, newGamePlus: null, totalText: 'No modifiers: ×1.0' });
    expect(m.attunements).toHaveLength(15);
    expect(m.slots).toEqual([null, null, null, null, null]);
    expect(m.modifiers.map((x) => [x.id, x.multText])).toEqual([
      ['mod_iron_loop', '×1.25'],
      ['mod_frayed_clock', '×1.25'],
      ['mod_mute_ley', '×1.25'],
      ['mod_horde_rising', '×1.25'],
      ['mod_glass', '×1.5'],
      ['mod_pacifist', '×1.5'],
    ]);
    const hand = m.attunements.find((a) => a.id === 'att_steady_hand')!;
    expect(hand).toMatchObject({ cost: 20, state: 'available', stateText: 'Costs 20' });
    expect(hand.buy).toMatchObject({ id: 'buy-att_steady_hand', enabled: true, label: 'Weave Steady Hand (20)' });
    expect(hand.buy?.action).toEqual({ type: 'thresholdSpend', attunementId: 'att_steady_hand' });
    expect(hand.equip).toBeNull();
  });

  test('one that costs more than you have is off with the engine’s words; one that needs an Echo says so', () => {
    const at = atLoom();
    at.profile.resonance = 10;
    const m = loomModel(at.state, pack, at.profile, legalFor(at));
    const hand = m.attunements.find((a) => a.id === 'att_steady_hand')!;
    expect(hand.state).toBe('short');
    expect(hand.stateText).toBe('Costs 20; you have 10');
    expect(hand.buy).toMatchObject({ enabled: false, reason: 'Steady Hand costs 20 Resonance; you have 10' });
    const hours = m.attunements.find((a) => a.id === 'att_steady_hours')!;
    const rich = atLoom();
    const m2 = loomModel(rich.state, pack, rich.profile, legalFor(rich));
    const hours2 = m2.attunements.find((a) => a.id === 'att_steady_hours')!;
    expect(hours.buy?.enabled).toBe(false);
    expect(hours2.state).toBe('locked');
    expect(hours2.needs).not.toBeNull();
    expect(hours2.stateText.startsWith('Needs ')).toBe(true);
  });

  test('buy → owned and unpickable this visit → equip → in a slot; the cap of five holds', () => {
    let at = atLoom();
    at = act(at, { type: 'thresholdSpend', attunementId: 'att_steady_hand' });
    let m = loomModel(at.state, pack, at.profile, legalFor(at));
    expect(m.resonance).toBe(80);
    expect(m.spentThisVisit).toBe(20);
    const hand = m.attunements.find((a) => a.id === 'att_steady_hand')!;
    expect(hand).toMatchObject({ state: 'owned', stateText: 'Owned', buy: null });
    expect(hand.equip).toMatchObject({ id: 'equip-att_steady_hand', enabled: true });
    expect(hand.unpick).toMatchObject({ id: 'unpick-att_steady_hand', enabled: true });
    at = act(at, { type: 'equipAttunement', attunementId: 'att_steady_hand', on: true });
    m = loomModel(at.state, pack, at.profile, legalFor(at));
    expect(m.slots[0]).toEqual({ id: 'att_steady_hand', name: 'Steady Hand' });
    expect(m.attunements.find((a) => a.id === 'att_steady_hand')).toMatchObject({ state: 'equipped', stateText: 'Equipped' });
    expect(m.attunements.find((a) => a.id === 'att_steady_hand')?.equip).toMatchObject({ id: 'unequip-att_steady_hand', label: 'Unequip Steady Hand' });

    // five equipped: the sixth owned one cannot go in
    at = mutable(at);
    at.profile.resonance = 400;
    for (const id of ['att_deep_well', 'att_full_purse', 'att_old_road', 'att_quick_study', 'att_keen_eye']) {
      at = act(at, { type: 'thresholdSpend', attunementId: id });
      if (id !== 'att_keen_eye') at = act(at, { type: 'equipAttunement', attunementId: id, on: true });
    }
    m = loomModel(at.state, pack, at.profile, legalFor(at));
    expect(m.slots.every((s) => s !== null)).toBe(true);
    const sixth = m.attunements.find((a) => a.id === 'att_keen_eye')!;
    expect(sixth.equip).toMatchObject({ enabled: false, reason: 'at most 5 Attunements can be equipped' });
  });

  test('an Attunement bought on an earlier visit cannot be unpicked', () => {
    let at = atLoom();
    at = act(at, { type: 'thresholdSpend', attunementId: 'att_steady_hand' });
    at = mutable(at);
    at.state.threshold!.spentThisVisit = 0; // a later visit: the Threshold’s record starts afresh
    const m = loomModel(at.state, pack, at.profile, legalFor(at));
    expect(m.attunements.find((a) => a.id === 'att_steady_hand')?.unpick).toBeNull();
  });

  test('modifiers toggle and multiply: ×1.25 · ×1.5 = ×1.875; Iron Loop warns that the slots stay empty', () => {
    let at = atLoom();
    at = act(at, { type: 'toggleModifier', modifierId: 'mod_frayed_clock' });
    let m = loomModel(at.state, pack, at.profile, legalFor(at));
    expect(m.modifiers.find((x) => x.id === 'mod_frayed_clock')).toMatchObject({ on: true });
    expect(m.modifiers.find((x) => x.id === 'mod_frayed_clock')?.toggle.label).toBe('Turn off Frayed Clock');
    expect(m.totalText).toBe('All together: ×1.25');
    at = act(at, { type: 'toggleModifier', modifierId: 'mod_glass' });
    at = act(at, { type: 'toggleModifier', modifierId: 'mod_iron_loop' });
    m = loomModel(at.state, pack, at.profile, legalFor(at));
    expect(m.ironLoop).toBe(true);
    expect(m.totalMultiplier).toBeCloseTo(1.25 * 1.5 * 1.25, 5);
    expect(multText(1.5)).toBe('×1.5');
    expect(multText(2)).toBe('×2.0');
  });

  test('the toggles are off away from the Loom, with the engine’s words', () => {
    const at = thresholdAt();
    const m = loomModel(at.state, pack, at.profile, legalFor(at));
    expect(m.modifiers.every((x) => !x.toggle.enabled && x.toggle.reason === 'that is done at the Loom')).toBe(true);
    expect(m.attunements.find((a) => a.id === 'att_steady_hand')?.buy).toMatchObject({ enabled: false, reason: 'that is done at the Loom' });
  });

  test('New Game+ appears once an ending has been reached, behind its question', () => {
    const at = atLoom();
    at.profile.endingsReached.push('ending_wardens_vigil');
    const m = loomModel(at.state, pack, at.profile, legalFor(at));
    expect(m.newGamePlus).toMatchObject({ id: 'new-game-plus', danger: true, enabled: true, yes: 'Begin New Game+' });
    expect(m.newGamePlus?.confirm).toContain('You keep every Echo');
    expect(m.newGamePlus?.action).toEqual({ type: 'newGamePlus' });
  });
});

describe('the Far Light', () => {
  const atLight = () => goTo(thresholdAt(), 'far_light');

  test('five classes, the one just played chosen, the others one tap away; mastery badges from the profile', () => {
    const at = atLight();
    const m = farLightModel(at.state, pack, at.profile, legalFor(at));
    expect(m.nextLoop).toBe(3);
    expect(m.choices).toHaveLength(5);
    const ranger = m.choices.find((c) => c.id === 'ranger')!;
    expect(ranger).toMatchObject({ chosen: true, justPlayed: true });
    expect(ranger.mastery.loops).toBe(2);
    expect(ranger.mastery.total).toBe(15);
    expect(ranger.pick.enabled).toBe(false);
    const wizard = m.choices.find((c) => c.id !== 'ranger')!;
    expect(wizard).toMatchObject({ chosen: false, justPlayed: false });
    expect(wizard.pick).toMatchObject({ enabled: true, label: `Wake as ${wizard.name}` });
    expect(wizard.pick.action).toEqual({ type: 'chooseClass', classId: wizard.id });
    expect(m.detail?.id).toBe('ranger');
    expect(m.begin).toMatchObject({ id: 'begin-loop', enabled: true, primary: true, label: 'Step into the light: begin Loop 3' });
    expect(m.begin.action).toEqual({ type: 'newLoop' });
  });

  test('choosing another class moves the choice and the kit preview; choosing the played class again undoes it', () => {
    let at = atLight();
    const other = Object.keys(pack.classes).find((id) => id !== 'ranger')!;
    at = act(at, { type: 'chooseClass', classId: other });
    let m = farLightModel(at.state, pack, at.profile, legalFor(at));
    expect(m.choices.find((c) => c.id === other)?.chosen).toBe(true);
    expect(m.choices.find((c) => c.id === 'ranger')).toMatchObject({ chosen: false, justPlayed: true });
    expect(m.detail?.id).toBe(other);
    at = act(at, { type: 'chooseClass', classId: 'ranger' });
    m = farLightModel(at.state, pack, at.profile, legalFor(at));
    expect(m.choices.find((c) => c.id === 'ranger')?.chosen).toBe(true);
  });

  test('what the loop carries: the equipped Attunements and the modifiers; Iron Loop keeps the Attunements on the loom', () => {
    let at = goTo(thresholdAt(), 'loom');
    at = act(at, { type: 'thresholdSpend', attunementId: 'att_steady_hand' });
    at = act(at, { type: 'equipAttunement', attunementId: 'att_steady_hand', on: true });
    at = act(at, { type: 'toggleModifier', modifierId: 'mod_glass' });
    at = goTo(at, 'far_light');
    let m = farLightModel(at.state, pack, at.profile, legalFor(at));
    expect(m).toMatchObject({ carried: ['Steady Hand'], idle: [], modifiers: ['Glass'], multText: '×1.5', ironLoop: false });
    at = goTo(at, 'loom');
    at = act(at, { type: 'toggleModifier', modifierId: 'mod_iron_loop' });
    at = goTo(at, 'far_light');
    m = farLightModel(at.state, pack, at.profile, legalFor(at));
    expect(m).toMatchObject({ carried: [], idle: ['Steady Hand'], ironLoop: true });
  });

  test('away from the Far Light the beginning is off and says where to go', () => {
    const at = thresholdAt();
    const m = farLightModel(at.state, pack, at.profile, legalFor(at));
    expect(m.begin).toMatchObject({ enabled: false, reason: 'that is done at the Far Light' });
  });
});
