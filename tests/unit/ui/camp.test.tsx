// The Camp panel (U67; DESIGN §2.1, §10.2, §12; D-059, D-067.14): the model (the two rests with their time and what they restore,
// the conversation a full rest will bring, who travels with you, the respec, and *Keep the vigil* / *Let go* from the second
// loop, each behind its question) and CampView, driven through tests/unit/ui/tree.ts. Opening the panel and resting are e2e's.
import { describe, expect, mock, test } from 'bun:test';
import { loadScenario } from '@sim/scenarios';
import { CampView } from '@ui/panels/CampPanel';
import { campModel } from '@ui/panels/campModel';
import { exploreModelPanelRow } from './campFixtures';
import { all, byName, call, expand, nameOf } from './tree';
import { legalFor, pack, place } from './panelFixtures';

describe('campModel', () => {
  test('a camp fire: both rests with their time and what they restore; the vitals; no loop actions in Loop 1', () => {
    const at = place('loop1_emberforge');
    const m = campModel(at.state, pack, at.profile, legalFor(at))!;
    expect(m.placeName).toBe('The Emberforge');
    expect(m.kind).toBe('Camp fire');
    expect(m.vitals).toMatchObject({ hp: at.state.player.hp, hpMax: at.state.player.hpMax, gold: at.state.player.gold });
    expect(m.rests.map((r) => [r.id, r.label, r.enabled])).toEqual([
      ['rest-short', 'Short rest', true],
      ['rest-full', 'Full rest', true],
    ]);
    expect(m.rests[0]!.action).toEqual({ type: 'rest', kind: 'short' });
    expect(m.rests[1]!.action).toEqual({ type: 'rest', kind: 'full' });
    expect(m.restNotes[0]).toMatch(/^1 watch, until .+\. Restores 30% of your HP and MP\.$/);
    expect(m.restNotes[1]).toMatch(/^Sleep until Day \d+ · Dawn\. Restores all of your HP and MP\.$/);
    expect(m.loop).toBeNull();
    expect(m.readOnly).toBeNull();
    expect(m.respec.available).toBe(true);
    expect(m.respec.text).toMatch(/^You can rethink your path here for \d+ gold and take back [\d.]+ ability points\.$/);
  });

  test('an inn: a bed with its price and the Rested status; respec is a camp fire’s', () => {
    const at = place('loop1_respite');
    const m = campModel(at.state, pack, at.profile, legalFor(at))!;
    expect(m.kind).toBe('Inn');
    expect(m.rests[1]).toMatchObject({ label: 'Take a bed', enabled: true });
    expect(m.restNotes[1]).toContain('A bed costs 10 gold');
    expect(m.restNotes[1]).toContain('You wake Rested');
    expect(m.respec.available).toBe(false);
    expect(m.respec.text).toBe('You can only rethink your path at a camp fire: rest at a place marked Camp or Wild camp.');
  });

  test('a bed you cannot pay for is off with the price; a running Horde says run', () => {
    const at = place('loop1_respite');
    at.state.player.gold = 3;
    const m = campModel(at.state, pack, at.profile, legalFor(at))!;
    expect(m.rests[1]!.enabled).toBe(false);
    expect(m.rests[1]!.reason).toBe('A bed here costs 10 gold.');
    expect(m.rests[0]!.enabled).toBe(true);
    const horde = place('loop1_emberforge');
    horde.state.world.hordeActive = true;
    const h = campModel(horde.state, pack, horde.profile, legalFor(horde))!;
    expect(h.rests.map((r) => r.reason)).toEqual(['No time for that. You must run!', 'No time for that. You must run!']);
  });

  test('where there is no rest spot there is no camp', () => {
    const at = place('loop1_emberforge');
    at.state.world.currentLocationId = 'loc_mistwood_path';
    expect(campModel(at.state, pack, at.profile, legalFor(at))).toBeNull();
  });

  test('in a fight everything is off and the panel says why', () => {
    const at = place('loop1_emberforge');
    at.state.mode = 'combat';
    const m = campModel(at.state, pack, at.profile, legalFor(at))!;
    expect(m.readOnly).toMatch(/Not in a fight/);
    expect(m.rests.every((r) => !r.enabled && r.reason === m.readOnly)).toBe(true);
  });

  test('from Loop 2 at a camp fire: Keep the vigil and Let go, each behind its question; Let go is the dangerous one', () => {
    const at = place('loop1_emberforge');
    at.state.meta.loop = 2;
    const m = campModel(at.state, pack, at.profile, legalFor(at))!;
    expect(m.loop).not.toBeNull();
    expect(m.loop!.vigil).toMatchObject({ id: 'vigil', label: 'Keep the vigil', yes: 'Keep the vigil' });
    expect(m.loop!.vigil.confirm).toBe('Keep the vigil? The days pass until the last dawn.');
    expect(m.loop!.letGo).toMatchObject({ id: 'let-go', label: 'Let go', danger: true, yes: 'Let go', enabled: true });
    expect(m.loop!.letGo.confirm).toBe('Let go? This loop ends here, at once, and earns no Resonance.');
    expect(m.loop!.letGo.action).toEqual({ type: 'letGo' });
    // not at an inn: the Amulet only answers at a camp fire
    const inn = place('loop1_respite');
    inn.state.meta.loop = 2;
    expect(campModel(inn.state, pack, inn.profile, legalFor(inn))!.loop).toBeNull();
    // a running Horde: shown, shut, with the engine’s sentence
    const horde = place('loop1_emberforge');
    horde.state.meta.loop = 2;
    horde.state.world.hordeActive = true;
    const hm = campModel(horde.state, pack, horde.profile, legalFor(horde))!;
    expect(hm.loop!.letGo).toMatchObject({ enabled: false, reason: 'No time for that. You must run!', confirm: null });
  });

  test('company: alone, a companion with something to say, and who could travel with you', () => {
    const lone = place('loop1_emberforge');
    const m = campModel(lone.state, pack, lone.profile, legalFor(lone))!;
    expect(m.withYou).toBe('You travel alone.');
    expect(m.conversation).toBeNull();
    expect(m.swaps).toEqual([]);

    const withCompanion = Object.values(pack.companions).find((c) => c.campScenes.length > 0)!;
    const { state, profile } = loadScenario('loop1_emberforge', pack, { companionId: withCompanion.id });
    const at = { state, profile };
    const c = campModel(at.state, pack, at.profile, legalFor(at))!;
    const name = pack.npcs[withCompanion.npcId]?.name ?? withCompanion.name;
    expect(c.withYou).toBe(`${name} travels with you.`);
    expect(c.conversation === `${name} has something to say. It comes after a full rest.` || c.conversation === `${name} has nothing more to say tonight.`).toBe(true);
    expect(c.swaps.map((s) => s.id)).toContain('swap-alone');
    expect(c.swaps.find((s) => s.id === 'swap-alone')).toMatchObject({ label: 'Go on alone', action: { type: 'swapCompanion', companionId: null } });
    // the conversation is never named, only promised
    expect(c.conversation).not.toContain('scene_');
  });
});

describe('CampView', () => {
  const at = place('loop1_emberforge');
  at.state.meta.loop = 2;
  const model = campModel(at.state, pack, at.profile, legalFor(at))!;
  const mk = () => ({ model, onRun: mock(), onOpenAbilities: mock(), canOpenAbilities: true });

  test('Rest first: each rest a named button with its time beside it; Full rest runs the action', () => {
    const p = mk();
    const tree = expand(<CampView {...p} />);
    expect(tree.find((n) => n.props.id === 'camp-rest')?.props['data-autofocus']).toBe('');
    const full = byName(tree, 'button', 'Full rest');
    expect(full.props.disabled).toBe(false);
    call(full, 'onClick');
    expect(p.onRun).toHaveBeenCalledWith(model.rests[1]);
    expect(tree.some((n) => n.type === 'p' && n.props.className === 'camp-rest__note' && n.text === model.restNotes[0])).toBe(true);
    expect(tree.some((n) => n.type === 'span' && n.text === 'HP ' + model.vitals.hp + ' / ' + model.vitals.hpMax)).toBe(true);
  });

  test('Your path: the respec words and a button that opens Abilities; it is off when the panel cannot open', () => {
    const p = mk();
    const tree = expand(<CampView {...p} />);
    expect(tree.find((n) => n.props['data-testid'] === 'camp-respec')?.text).toBe(model.respec.text);
    call(byName(tree, 'button', 'Open Abilities'), 'onClick');
    expect(p.onOpenAbilities).toHaveBeenCalled();
    const shut = expand(<CampView {...p} canOpenAbilities={false} />);
    expect(byName(shut, 'button', 'Open Abilities').props.disabled).toBe(true);
  });

  test('The Amulet: both loop actions are buttons; Let go runs the action whose question the container asks', () => {
    const p = mk();
    const tree = expand(<CampView {...p} />);
    const names = all(tree, 'button').map(nameOf);
    expect(names).toContain('Keep the vigil');
    call(byName(tree, 'button', 'Let go'), 'onClick');
    expect(p.onRun).toHaveBeenCalledWith(model.loop!.letGo);
    expect(model.loop!.letGo.confirm).not.toBeNull();
  });

  test('Loop 1: no Amulet section; a fight: a status line and every rest off', () => {
    const one = place('loop1_emberforge');
    const m1 = campModel(one.state, pack, one.profile, legalFor(one))!;
    const tree = expand(<CampView {...mk()} model={m1} />);
    expect(tree.find((n) => n.props.id === 'camp-loop')).toBeUndefined();
    const fight = place('loop1_emberforge');
    fight.state.mode = 'combat';
    const m2 = campModel(fight.state, pack, fight.profile, legalFor(fight))!;
    const t2 = expand(<CampView {...mk()} model={m2} />);
    expect(t2.find((n) => n.type === 'p' && n.props.role === 'status')?.text).toMatch(/Not in a fight/);
    expect(byName(t2, 'button', 'Full rest').props.disabled).toBe(true);
  });
});

test('the Explore screen offers the Camp wherever there is a rest spot, and only then', () => {
  const at = place('loop1_emberforge');
  expect(exploreModelPanelRow(at.state, 'camp')).toMatchObject({ id: 'camp', panel: 'camp', label: 'Camp' });
  expect(exploreModelPanelRow(place('loop1_respite').state, 'camp')).toMatchObject({ label: 'The inn' });
  const path = place('loop1_emberforge');
  path.state.world.currentLocationId = 'loc_mistwood_path';
  expect(exploreModelPanelRow(path.state, 'camp')).toBeUndefined();
  expect(exploreModelPanelRow(at.state, 'forge')).toMatchObject({ panel: 'crafting', label: 'Use the forge' });
  expect(exploreModelPanelRow(at.state, 'merchant')).toMatchObject({ panel: 'merchant', label: 'Trade with Borin Stonefist' });
});
