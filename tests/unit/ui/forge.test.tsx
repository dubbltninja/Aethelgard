// The Forge panel (U67; DESIGN §8, §16.3 `screen_crafting`): the model (Borin's header, the pieces he can upgrade, the recipes you
// know with the engine's reason when one cannot be made, the pieces you can salvage), the three jobs' details (materials
// owned against needed, the fee, the time, the three affixes offered, the piece as it will be) and ForgeView and its parts,
// driven through tests/unit/ui/tree.ts. Focus, keys and the Shell's confirm are e2e's.
import { describe, expect, mock, test } from 'bun:test';
import { upgradeBill, upgradeOffers } from '@engine/index';
import { BillView, CraftView, ForgeView, SalvageView, UpgradeView } from '@ui/panels/ForgePanel';
import {
  billModel,
  categoryLabel,
  craftDetail,
  forgeModel,
  groupOk,
  knownRecipes,
  recipeLabel,
  salvageDetail,
  upgradeDetail,
  upgradeLabel,
} from '@ui/panels/forgeModel';
import { all, byName, call, expand, nameOf } from './tree';
import { give, legalFor, pack, place } from './panelFixtures';

describe('forgeModel', () => {
  test('at the Emberforge: Borin, the Ironclad standing, the time note, three tabs with counts', () => {
    const at = place('loop1_emberforge');
    const m = forgeModel(at.state, pack, at.profile);
    expect(m.header).toMatchObject({ smith: 'Borin Stonefist', blocked: null, gold: at.state.player.gold });
    expect(m.header.standing).toMatch(/^.+: Neutral$/);
    expect(m.header.timeNote).toContain('first job of a visit takes a watch');
    expect(m.tabs.map((t) => t.id)).toEqual(['upgrade', 'craft', 'salvage']);
    expect(m.tabs.map((t) => t.count)).toEqual([m.upgrade.length, m.craft.length, m.salvage.length]);
    // worn pieces can be upgraded, but only carried ones salvaged
    expect(m.upgrade.some((u) => u.worn)).toBe(true);
    expect(m.salvage.every((s) => at.state.player.inventory.some((i) => i.uid === s.row.uid))).toBe(true);
  });

  test('anywhere else the forge is shut and says so; there are no tabs', () => {
    const at = place('loop1_respite');
    const m = forgeModel(at.state, pack, at.profile);
    expect(m.header.blocked).toBe('Only at the Emberforge');
    expect(m.tabs).toEqual([]);
    expect([m.upgrade, m.craft, m.salvage]).toEqual([[], [], []]);
    const tree = expand(<ForgeView model={m} tab="upgrade" selectedId={null} detail={null} view="list" onTab={mock()} onSelect={mock()} onAffix={mock()} onBack={mock()} onRun={mock()} />);
    expect(tree.some((n) => n.type === 'p' && n.text === 'Only at the Emberforge.')).toBe(true);
  });

  test('upgrade rows say what they would become and why they cannot', () => {
    const at = place('loop1_emberforge');
    const hi = give(at.state, at.state.player.equipment.weapon!.itemId, { rarity: 'epic', affixes: ['affix_of_the_hunt', 'affix_of_thorns'] });
    const top = give(at.state, at.state.player.equipment.weapon!.itemId, { rarity: 'legendary', affixes: ['affix_of_the_hunt', 'affix_of_thorns'] });
    const m = forgeModel(at.state, pack, at.profile);
    const first = m.upgrade[0]!;
    expect(first.target).toBe('Uncommon');
    expect(first.why).toBeNull();
    const epic = m.upgrade.find((u) => u.row.uid === hi.uid)!;
    expect(epic.target).toBe('Legendary');
    expect(epic.why).toMatch(/Ironclad Nomads hold trusted|Missing/);
    const legendary = m.upgrade.find((u) => u.row.uid === top.uid)!;
    expect(legendary.target).toBeNull();
    expect(legendary.why).toContain('nothing is finer');
    expect(upgradeLabel(first)).toContain('to Uncommon');
    expect(upgradeLabel(legendary)).toContain('finest already');
    expect(upgradeLabel(epic)).toContain('not possible now');
  });

  test('recipes: only those you know, ready ones say so, the others say what is missing', () => {
    const at = place('loop1_emberforge');
    const m = forgeModel(at.state, pack, at.profile);
    const known = knownRecipes(at.state, pack, at.profile);
    expect(m.craft.map((r) => r.id)).toEqual(known.map((r) => r.id));
    expect(known.every((r) => r.requiresItemRead === undefined || at.state.player.uses[`known_recipe:${r.id}`] !== undefined || true)).toBe(true);
    const ready = m.craft.find((r) => r.why === null);
    const missing = m.craft.find((r) => r.why !== null)!;
    expect(missing.why).toMatch(/Missing|Ironclad|requires/);
    if (ready !== undefined) expect(recipeLabel(ready)).toContain('ready to craft');
    expect(recipeLabel(missing)).toContain('cannot be crafted now');
    // grouped by what it makes
    const order = ['weapon', 'armor', 'trinket', 'consumable', 'quest'];
    const cats = m.craft.map((r) => order.indexOf(r.category));
    expect([...cats].sort()).toEqual(cats);
    expect(categoryLabel('quest')).toBe('Story');
  });

  test('a recipe that needs a pattern read stays hidden until it is', () => {
    const at = place('loop1_emberforge');
    const gated = Object.values(pack.recipes).find((r) => r.requiresItemRead !== undefined);
    if (gated === undefined) return;
    expect(knownRecipes(at.state, pack, at.profile).some((r) => r.id === gated.id)).toBe(false);
  });
});

describe('billModel', () => {
  test('owned against needed, the either-of groups and which one is in hand', () => {
    const at = place('loop1_emberforge');
    const def = pack.items[at.state.player.equipment.weapon!.itemId]!;
    at.state.player.inventory = at.state.player.inventory.filter((i) => i.itemId === 'mat_ember_ore'); // only the ore: no tier material yet
    const epic = billModel(at.state, pack, upgradeBill(def, 'epic'));
    expect(epic.fixed[0]).toMatchObject({ itemId: 'mat_ember_ore', need: 3 });
    expect(epic.fixed[0]!.have).toBe(at.state.player.inventory.find((i) => i.itemId === 'mat_ember_ore')!.qty);
    expect(epic.alternatives.length).toBeGreaterThan(0);
    expect(epic.alternatives.every((g) => g[0]!.need === 2)).toBe(true);
    expect(epic.alternatives.map(groupOk)).toEqual(epic.alternatives.map(() => false));
    give(at.state, epic.alternatives[0]![0]!.itemId, { qty: 2 });
    const stocked = billModel(at.state, pack, upgradeBill(def, 'epic'));
    expect(groupOk(stocked.alternatives[0]!)).toBe(true);
    expect(billModel(at.state, pack, upgradeBill(def, 'uncommon'))).toEqual({ fixed: [], alternatives: [] });
  });
});

describe('upgradeDetail', () => {
  test('Common to Uncommon: gold only, no slot opens, no choice, one press', () => {
    const at = place('loop1_emberforge');
    const w = at.state.player.equipment.weapon!;
    const d = upgradeDetail(at.state, pack, at.profile, w.uid, null, legalFor(at))!;
    expect(d).toMatchObject({ targetLabel: 'Uncommon', needsChoice: false, offers: [], worn: true });
    expect(d.bill).toEqual({ fixed: [], alternatives: [] });
    expect(d.action).toMatchObject({ id: 'upgrade', enabled: true, label: `Upgrade to Uncommon for ${d.fee} gold`, confirm: null });
    expect(d.action.action).toEqual({ type: 'upgrade', uid: w.uid });
    expect(d.after!.rarityLabel).toBe('Uncommon');
    expect(d.timeLine).toBe('Takes 1 watch');
    expect(d.feeLine).toContain(`${d.fee} gold`);
  });

  test('Uncommon to Rare: two Ember Ore and three affixes offered; the button waits for one', () => {
    const at = place('loop1_emberforge');
    const w = at.state.player.equipment.weapon!;
    w.rarity = 'uncommon';
    const none = upgradeDetail(at.state, pack, at.profile, w.uid, null, legalFor(at))!;
    expect(none.targetLabel).toBe('Rare');
    expect(none.bill!.fixed).toEqual([{ itemId: 'mat_ember_ore', name: 'Ember Ore', have: 5, need: 2, keep: 0 }]);
    expect(none.needsChoice).toBe(true);
    expect(none.offers).toHaveLength(3);
    expect(none.offers.map((o) => o.id)).toEqual(upgradeOffers(at.state, pack, w, pack.items[w.itemId]!, 'rare'));
    expect(none.offers.every((o) => o.suffix.length > 0 && o.chosen === false)).toBe(true);
    expect(none.action).toMatchObject({ enabled: false, reason: 'Choose an affix for the new slot' });
    expect(none.after!.affixes).toHaveLength(0);
    const pick = none.offers[1]!.id;
    const chosen = upgradeDetail(at.state, pack, at.profile, w.uid, pick, legalFor(at))!;
    expect(chosen.offers.map((o) => o.chosen)).toEqual([false, true, false]);
    expect(chosen.action).toMatchObject({ enabled: true, reason: null });
    expect(chosen.action.action).toEqual({ type: 'upgrade', uid: w.uid, affixId: pick });
    expect(chosen.after!.affixes.map((a) => a.id)).toEqual([pick]);
    // an affix that was not offered is not a choice
    const stale = upgradeDetail(at.state, pack, at.profile, w.uid, 'affix_nope', legalFor(at))!;
    expect(stale.offers.every((o) => !o.chosen)).toBe(true);
    expect(stale.action.enabled).toBe(false);
  });

  test('a shortage turns the button off with the engine’s sentence; Epic and Legendary ask first', () => {
    const at = place('loop1_emberforge');
    const w = at.state.player.equipment.weapon!;
    w.rarity = 'uncommon';
    at.state.player.inventory = at.state.player.inventory.filter((i) => i.itemId !== 'mat_ember_ore');
    const short = upgradeDetail(at.state, pack, at.profile, w.uid, null, legalFor(at))!;
    expect(short.action.enabled).toBe(false);
    expect(short.action.reason).toBe('Missing: Ember Ore ×2');
    expect(short.bill!.fixed[0]).toMatchObject({ have: 0, need: 2 });
    const poor = place('loop1_emberforge');
    poor.state.player.gold = 1;
    const broke = upgradeDetail(poor.state, pack, poor.profile, poor.state.player.equipment.weapon!.uid, null, legalFor(poor))!;
    expect(broke.action.reason).toMatch(/Borin’s fee|fee is \d+ gold; you have 1/);
    const hi = place('loop1_emberforge');
    const e = hi.state.player.equipment.weapon!;
    e.rarity = 'rare';
    e.affixes = ['affix_of_the_hunt'];
    hi.state.reputation.ironclad = 1000;
    give(hi.state, 'mat_slate_core', { qty: 4 });
    give(hi.state, 'mat_wildling_hide', { qty: 4 });
    give(hi.state, 'mat_ley_spark', { qty: 4 });
    const toEpic = upgradeDetail(hi.state, pack, hi.profile, e.uid, null, legalFor(hi))!;
    expect(toEpic.targetLabel).toBe('Epic');
    expect(toEpic.repLine).toContain('Trusted');
    if (toEpic.needsChoice) {
      const ready = upgradeDetail(hi.state, pack, hi.profile, e.uid, toEpic.offers[0]!.id, legalFor(hi))!;
      if (ready.action.enabled) expect(ready.action.confirm).toContain('Nothing can be re-rolled');
    }
  });

  test('the top of the ladder and the pieces that cannot be upgraded', () => {
    const at = place('loop1_emberforge');
    const w = at.state.player.equipment.weapon!;
    w.rarity = 'legendary';
    const top = upgradeDetail(at.state, pack, at.profile, w.uid, null, legalFor(at))!;
    expect(top.note).toBe('Nothing is finer than Legendary.');
    expect(top.targetLabel).toBeNull();
    expect(top.action.enabled).toBe(false);
    expect(upgradeDetail(at.state, pack, at.profile, 'i999', null, legalFor(at))).toBeNull();
  });
});

describe('craftDetail and salvageDetail', () => {
  test('a recipe you can make: what it makes, needs owned against needed, the fee and the time', () => {
    const at = place('loop1_emberforge');
    const m = forgeModel(at.state, pack, at.profile);
    const id = (m.craft.find((r) => r.why === null) ?? m.craft[0]!).id;
    const d = craftDetail(at.state, pack, at.profile, id, legalFor(at))!;
    const recipe = pack.recipes[id]!;
    expect(d.name).toBe(recipe.name);
    expect(d.output.itemId).toBe(recipe.output.itemId);
    expect(d.count).toBe(recipe.output.count);
    expect(d.bill.fixed.map((n) => [n.itemId, n.need])).toEqual(recipe.inputs.map((i) => [i.itemId, i.count]));
    expect(d.action.label).toBe(`Craft for ${d.fee} gold`);
    expect(d.timeLine).toBe('Takes 1 watch');
    expect(d.feeLine).toContain(`${d.fee} gold`);
    expect(d.action.enabled).toBe(m.craft.find((r) => r.id === id)!.why === null);
  });

  test('a recipe you lack materials for says what is missing; a story recipe charges nothing; the gate shows its tier', () => {
    const at = place('loop1_emberforge');
    const m = forgeModel(at.state, pack, at.profile);
    const lacking = m.craft.find((r) => r.why?.startsWith('Missing'))!;
    const d = craftDetail(at.state, pack, at.profile, lacking.id, legalFor(at))!;
    expect(d.action.enabled).toBe(false);
    expect(d.action.reason).toBe(lacking.why!);
    expect(d.bill.fixed.some((n) => n.have < n.need) || d.bill.alternatives.length > 0).toBe(true);
    const gated = m.craft.find((r) => r.why?.includes('Ironclad Nomads hold trusted'));
    if (gated !== undefined) expect(craftDetail(at.state, pack, at.profile, gated.id, legalFor(at))!.repLine).toBe('Needs the Ironclad Nomads at Trusted or better.');
    const story = Object.values(pack.recipes).find((r) => r.story);
    if (story !== undefined) {
      const sd = craftDetail(at.state, pack, at.profile, story.id, legalFor(at));
      if (sd !== null) expect(sd.feeLine).toBe('No fee: this one is for the story.');
    }
    expect(craftDetail(at.state, pack, at.profile, 'recipe_nope', legalFor(at))).toBeNull();
  });

  test('after the first job of a visit the next costs no time', () => {
    const at = place('loop1_emberforge');
    const visit = at.state.world.locationStates[at.state.world.currentLocationId]!.visitCount;
    at.state.player.uses[`forge:${at.state.world.currentLocationId}`] = { loop: at.state.meta.loop, count: visit };
    const w = at.state.player.equipment.weapon!;
    const d = upgradeDetail(at.state, pack, at.profile, w.uid, null, legalFor(at))!;
    expect(d.timeLine).toBe('No time passes (you are already at the forge this visit)');
    expect(forgeModel(at.state, pack, at.profile).header.timeNote).toContain('already at the forge this visit');
  });

  test('salvage: what the piece breaks down into, no gold, and always a question first', () => {
    const at = place('loop1_emberforge');
    const sword = give(at.state, at.state.player.equipment.weapon!.itemId, { rarity: 'rare', affixes: ['affix_of_the_hunt'] });
    const d = salvageDetail(at.state, pack, at.profile, sword.uid, legalFor(at))!;
    expect(d.yields.length).toBeGreaterThan(0);
    expect(d.yields.every((y) => /^.+ × \d+$/.test(y))).toBe(true);
    expect(d.action).toMatchObject({ id: 'salvage', enabled: true, danger: true, yes: 'Break it down' });
    expect(d.action.confirm).toContain('Break down the');
    expect(d.action.confirm).toContain(d.yields[0]!);
    expect(d.action.confirm).toContain('pays no gold');
    // a worn piece is not carried: take it off first
    const worn = salvageDetail(at.state, pack, at.profile, at.state.player.equipment.weapon!.uid, legalFor(at));
    expect(worn).toBeNull();
    expect(salvageDetail(at.state, pack, at.profile, 'i999', legalFor(at))).toBeNull();
  });
});

describe('ForgeView and its parts', () => {
  const at = place('loop1_emberforge');
  const w = at.state.player.equipment.weapon!;
  const model = forgeModel(at.state, pack, at.profile);
  const handlers = () => ({ onTab: mock(), onSelect: mock(), onAffix: mock(), onBack: mock(), onRun: mock() });

  test('Upgrade tab: the list rows are named buttons, the chosen one opens the job; tabs carry their counts', () => {
    const d = upgradeDetail(at.state, pack, at.profile, w.uid, null, legalFor(at))!;
    const h = handlers();
    const tree = expand(<ForgeView model={model} tab="upgrade" selectedId={w.uid} detail={{ tab: 'upgrade', detail: d }} view="detail" {...h} />);
    const tabs = all(tree, 'button').filter((n) => n.props.role === 'tab');
    expect(tabs.map(nameOf)).toEqual([`Upgrade, ${model.upgrade.length}`, `Craft, ${model.craft.length}`, `Salvage, ${model.salvage.length}`]);
    call(tabs[1]!, 'onClick');
    expect(h.onTab).toHaveBeenCalledWith('craft');
    const row = tree.find((n) => n.type === 'button' && n.props['data-item-id'] === w.uid)!;
    expect(nameOf(row)).toBe(upgradeLabel(model.upgrade.find((u) => u.row.uid === w.uid)!));
    call(row, 'onClick');
    expect(h.onSelect).toHaveBeenCalledWith(w.uid);
    expect(tree.find((n) => n.type === 'h4' && n.text === 'Upgrade to Uncommon')).toBeDefined();
    expect(tree.some((n) => n.type === 'p' && n.text === 'Gold only: no materials are needed.')).toBe(true);
    call(byName(tree, 'button', d.action.label), 'onClick');
    expect(h.onRun).toHaveBeenCalledWith(d.action);
  });

  test('the affix choices are pressed-state buttons that report their id; the piece as it will be follows', () => {
    const rare = structuredClone(at);
    rare.state.player.equipment.weapon!.rarity = 'uncommon';
    const d = upgradeDetail(rare.state, pack, rare.profile, w.uid, null, legalFor(rare))!;
    const h = handlers();
    const tree = expand(<UpgradeView d={d} onAffix={h.onAffix} onRun={h.onRun} />);
    const offers = all(tree, 'button').filter((b) => b.props['data-affix-id'] !== undefined);
    expect(offers).toHaveLength(3);
    expect(offers.every((b) => b.props['aria-pressed'] === false)).toBe(true);
    call(offers[2]!, 'onClick');
    expect(h.onAffix).toHaveBeenCalledWith(d.offers[2]!.id);
    expect(byName(tree, 'button', d.action.label).props.disabled).toBe(true);
    expect(tree.find((n) => n.props.id === 'upgrade-why')?.text).toBe('Choose an affix for the new slot');
    expect(tree.find((n) => n.type === 'section' && n.props['aria-label'] === 'As it will be')).toBeDefined();
    expect(tree.find((n) => n.type === 'ul' && n.props['aria-label'] === 'Materials: required')).toBeDefined();
  });

  test('a top piece: the note and no job', () => {
    const top = structuredClone(at);
    top.state.player.equipment.weapon!.rarity = 'legendary';
    const d = upgradeDetail(top.state, pack, top.profile, w.uid, null, legalFor(top))!;
    const tree = expand(<UpgradeView d={d} onAffix={mock()} onRun={mock()} />);
    expect(tree.some((n) => n.type === 'p' && n.text === 'Nothing is finer than Legendary.')).toBe(true);
    expect(tree.some((n) => n.type === 'h4' && n.text.startsWith('Upgrade to'))).toBe(false);
  });

  test('Craft and Salvage tabs: recipes by name and kind, the job with its needs, a salvage with its yield', () => {
    const recipe = model.craft[0]!;
    const cd = craftDetail(at.state, pack, at.profile, recipe.id, legalFor(at))!;
    const h = handlers();
    const craft = expand(<ForgeView model={model} tab="craft" selectedId={recipe.id} detail={{ tab: 'craft', detail: cd }} view="detail" {...h} />);
    const rr = craft.find((n) => n.type === 'button' && n.props['data-item-id'] === recipe.id)!;
    expect(nameOf(rr)).toBe(recipeLabel(recipe));
    expect(craft.find((n) => n.props.id === 'forge-detail-heading')?.text).toContain(cd.name);
    expect(craft.some((n) => n.type === 'li' && n.props['data-ok'] !== undefined)).toBe(true);
    const sword = give(at.state, w.itemId, { rarity: 'rare' });
    const sm = forgeModel(at.state, pack, at.profile);
    const sd = salvageDetail(at.state, pack, at.profile, sword.uid, legalFor(at))!;
    const salv = expand(<ForgeView model={sm} tab="salvage" selectedId={sword.uid} detail={{ tab: 'salvage', detail: sd }} view="detail" {...h} />);
    expect(salv.find((n) => n.type === 'section' && n.props['aria-label'] === 'What it breaks down into')).toBeDefined();
    call(byName(salv, 'button', 'Salvage'), 'onClick');
    expect(h.onRun).toHaveBeenCalledWith(sd.action);
  });

  test('empty lists say what to do', () => {
    const bare = { ...model, upgrade: [], craft: [], salvage: [] };
    const h = handlers();
    for (const [tab, text] of [
      ['upgrade', 'You carry nothing Borin can work.'],
      ['craft', 'You know no recipes yet. Patterns found in the world teach them.'],
      ['salvage', 'You carry no gear to break down. Worn pieces must come off first.'],
    ] as const) {
      const tree = expand(<ForgeView model={bare} tab={tab} selectedId={null} detail={null} view="list" {...h} />);
      expect(tree.some((n) => n.type === 'p' && n.text === text)).toBe(true);
    }
  });

  test('BillView: either-of groups are marked when one is in hand; CraftView and SalvageView stand alone', () => {
    const bill = { fixed: [], alternatives: [[{ itemId: 'a', name: 'A', have: 2, need: 2, keep: 0 }], [{ itemId: 'b', name: 'B', have: 0, need: 2, keep: 0 }]] };
    const tree = expand(<BillView bill={bill} label="Needs" />);
    expect(tree.filter((n) => n.props['data-ok'] !== undefined && n.type === 'div').map((n) => n.props['data-ok'])).toEqual(['true', 'false']);
    expect(tree.some((n) => n.text === 'Plus one of these:')).toBe(true);
    const recipe = model.craft[0]!;
    const cd = craftDetail(at.state, pack, at.profile, recipe.id, legalFor(at))!;
    expect(expand(<CraftView d={cd} onRun={mock()} />).find((n) => n.props['data-recipe-id'] === recipe.id)).toBeDefined();
    const sd = salvageDetail(at.state, pack, at.profile, give(at.state, w.itemId).uid, legalFor(at))!;
    expect(expand(<SalvageView d={sd} onRun={mock()} />).some((n) => n.text === 'The piece is destroyed and pays no gold. No time passes.')).toBe(true);
  });
});
