// The Merchant panel (U67; DESIGN §7.5, §9, §16.3 `screen_merchant`): the model (who trades, how they price you, the stall and
// your pack with the engine's prices, the chosen line with a quantity and the engine's reason when it cannot be done) and
// MerchantView / TradeDetailView, driven through tests/unit/ui/tree.ts. Focus, keys and the Shell are e2e's.
import { describe, expect, mock, test } from 'bun:test';
import { buyPrice, goldValue, packSlotsUsed, repTier, sellPrice, stockEntryFor, tierPriceMult } from '@engine/index';
import { MerchantView, TradeDetailView } from '@ui/panels/MerchantPanel';
import { merchantModel, stallHeader, tradeDetail, tradeLabel } from '@ui/panels/merchantModel';
import { all, byName, call, expand, nameOf } from './tree';
import { give, legalFor, pack, place } from './panelFixtures';

const KAELEN = 'npc_kaelen_stonehand';

describe('merchantModel', () => {
  test('Kaelen’s stall: who, how he prices you, ten lines to buy, your pack to sell', () => {
    const at = place('loop1_respite');
    const m = merchantModel(at.state, pack, at.profile, null, legalFor(at));
    expect(m.merchants).toEqual([{ id: KAELEN, name: 'Kaelen Stonehand' }]);
    expect(m.header).toMatchObject({ id: KAELEN, name: 'Kaelen Stonehand', refusal: null, sells: true, buys: true, role: 'Merchant' });
    expect(m.header!.standing).toMatch(/prices standard/);
    expect(m.buy.length).toBeGreaterThan(5);
    expect(m.tabs.map((t) => [t.id, t.count])).toEqual([
      ['buy', m.buy.length],
      ['sell', m.sell.length],
    ]);
    expect(m.gold).toBe(at.state.player.gold);
    // gear first, then consumables, then materials
    const kinds = m.buy.map((b) => (b.row.isGear ? 0 : b.row.type === 'consumable' ? 1 : 2));
    expect([...kinds].sort()).toEqual(kinds);
  });

  test('every price is the engine’s own: buy by buyPrice, sell at 75% of the worth rounded down', () => {
    const at = place('loop1_respite');
    const m = merchantModel(at.state, pack, at.profile, KAELEN, legalFor(at));
    const merchant = pack.merchants[KAELEN]!;
    const stock = at.state.merchants[KAELEN]!.stock;
    for (const line of m.buy) {
      const inst = stock.find((i) => i.uid === line.row.uid)!;
      expect(line.unit).toBe(buyPrice(at.state, pack, at.profile, merchant, inst));
    }
    for (const line of m.sell) {
      const inst = at.state.player.inventory.find((i) => i.uid === line.row.uid)!;
      expect(line.unit).toBe(sellPrice(pack, merchant, inst));
      expect(line.unit).toBe(Math.floor(0.75 * goldValue(pack.items[inst.itemId]!, inst.rarity, pack)));
    }
    // limited stock shows a count; a line that never runs out shows none
    const limited = m.buy.find((b) => stockEntryFor(at.state, pack, at.profile, merchant, b.row.itemId)?.count !== 'unlimited');
    expect(limited?.stock).not.toBeNull();
  });

  test('standing: a wary people charge more and the header says by how much', () => {
    const at = place('loop1_respite');
    const strict = { ...pack, merchants: { ...pack.merchants, [KAELEN]: { ...pack.merchants[KAELEN]!, repFaction: 'ironclad' as const } } };
    let wary = -1000;
    for (const v of [-100, -75, -60, -50, -40, -30, -20, -10]) {
      const s = structuredClone(at.state);
      s.reputation.ironclad = v;
      if (repTier(v, pack) === 'wary') {
        wary = v;
        break;
      }
    }
    expect(wary).toBeGreaterThan(-1000);
    at.state.reputation.ironclad = wary;
    const merchant = strict.merchants[KAELEN]!;
    const mult = tierPriceMult(at.state, strict, merchant);
    expect(mult).toBeGreaterThan(1);
    const header = stallHeader(at.state, strict, at.profile, merchant);
    expect(header.standing).toMatch(/^Wary with .+: prices \+\d+%\.$/);
    expect(header.refusal).toBeNull();
  });

  test('a hostile people’s merchant will not trade: a sentence and no stall', () => {
    const at = place('loop1_respite');
    const strict = { ...pack, merchants: { ...pack.merchants, [KAELEN]: { ...pack.merchants[KAELEN]!, repFaction: 'ironclad' as const } } };
    at.state.reputation.ironclad = -1000;
    expect(repTier(-1000, pack)).toBe('hostile');
    const m = merchantModel(at.state, strict, at.profile, null, legalFor(at));
    expect(m.header!.refusal).toBe('Kaelen Stonehand will not trade with you');
    expect(m.buy).toEqual([]);
    expect(m.sell).toEqual([]);
    expect(m.tabs).toEqual([]);
    const tree = expand(<MerchantView model={m} tab="buy" selectedId={null} detail={null} view="list" onTab={mock()} onMerchant={mock()} onSelect={mock()} onQty={mock()} onBack={mock()} onRun={mock()} />);
    expect(tree.some((n) => n.type === 'p' && n.text === 'Kaelen Stonehand will not trade with you.')).toBe(true);
    expect(all(tree, 'button').filter((b) => b.props.role === 'tab')).toEqual([]);
  });

  test('nobody to trade with: the panel says so', () => {
    const at = place('loop1_emberforge');
    at.state.world.currentLocationId = 'loc_mistwood_path';
    const m = merchantModel(at.state, pack, at.profile, null, legalFor(at));
    expect(m.header).toBeNull();
    const tree = expand(<MerchantView model={m} tab="buy" selectedId={null} detail={null} view="list" onTab={mock()} onMerchant={mock()} onSelect={mock()} onQty={mock()} onBack={mock()} onRun={mock()} />);
    expect(tree.some((n) => n.text === 'There is no one here to trade with.')).toBe(true);
  });

  test('a merchant who only buys or only sells offers one tab', () => {
    const at = place('loop1_respite');
    const onlySells = { ...pack, merchants: { ...pack.merchants, [KAELEN]: { ...pack.merchants[KAELEN]!, services: ['buy' as const] } } };
    const m = merchantModel(at.state, onlySells, at.profile, null, legalFor(at));
    expect(m.tabs.map((t) => t.id)).toEqual(['buy']);
    expect(m.sell).toEqual([]);
  });
});

describe('tradeDetail', () => {
  const at = place('loop1_respite');
  const ok = legalFor(at);

  test('buy: the card, the unit price, what is left, a total that follows the quantity, and a button that says what it costs', () => {
    const m = merchantModel(at.state, pack, at.profile, KAELEN, ok);
    const stack = m.buy.find((b) => b.stock !== null && b.stock >= 2 && !b.row.isGear)!;
    const one = tradeDetail(at.state, pack, at.profile, KAELEN, 'buy', stack.row.uid, 1, ok)!;
    expect(one).toMatchObject({ mode: 'buy', unit: stack.unit, qty: 1, total: stack.unit, priceLine: `${stack.unit} gold each` });
    expect(one.stockLine).toBe(`${stack.stock} for sale.`);
    expect(one.action).toMatchObject({ id: 'buy', label: `Buy for ${stack.unit} gold`, enabled: true, primary: true });
    expect(one.action.action).toEqual({ type: 'buy', merchantId: KAELEN, uid: stack.row.uid, qty: 1 });
    const two = tradeDetail(at.state, pack, at.profile, KAELEN, 'buy', stack.row.uid, 2, ok)!;
    expect(two).toMatchObject({ qty: 2, total: stack.unit * 2 });
    expect(two.action.label).toBe(`Buy 2 for ${stack.unit * 2} gold`);
    // the stepper never offers more than is for sale
    const lots = tradeDetail(at.state, pack, at.profile, KAELEN, 'buy', stack.row.uid, 99, ok)!;
    expect(lots.qty).toBe(Math.min(stack.stock!, Math.floor(at.state.player.gold / stack.unit)));
    expect(lots.maxQty).toBe(lots.qty);
  });

  test('buying gear shows what it would change; selling does not', () => {
    const m = merchantModel(at.state, pack, at.profile, KAELEN, ok);
    const gear = m.buy.find((b) => b.row.isGear)!;
    const d = tradeDetail(at.state, pack, at.profile, KAELEN, 'buy', gear.row.uid, 1, ok)!;
    expect(d.compare.length).toBeGreaterThan(0);
    const mine = m.sell.find((s) => s.row.isGear)!;
    expect(tradeDetail(at.state, pack, at.profile, KAELEN, 'sell', mine.row.uid, 1, ok)!.compare).toEqual([]);
  });

  test('not enough gold turns Buy off with the engine’s sentence; a full pack too', () => {
    const poor = place('loop1_respite');
    poor.state.player.gold = 1;
    const m = merchantModel(poor.state, pack, poor.profile, KAELEN, legalFor(poor));
    const line = m.buy.find((b) => b.unit > 1)!;
    const d = tradeDetail(poor.state, pack, poor.profile, KAELEN, 'buy', line.row.uid, 1, legalFor(poor))!;
    expect(d.action.enabled).toBe(false);
    expect(d.action.reason).toMatch(/costs \d+ gold; you have 1/);
    expect(line.why).toMatch(/costs/);
    const full = place('loop1_respite');
    const junk = Object.values(pack.items).find((x) => x.type === 'weapon')!.id;
    while (packSlotsUsed(full.state, pack) < 40) give(full.state, junk);
    const fm = merchantModel(full.state, pack, full.profile, KAELEN, legalFor(full));
    const gear = fm.buy.find((b) => b.row.isGear)!;
    const fd = tradeDetail(full.state, pack, full.profile, KAELEN, 'buy', gear.row.uid, 1, legalFor(full))!;
    expect(fd.action.reason).toBe('Your pack is full');
  });

  test('sell: pays 75% and says so; a rare piece asks first; a quest-bound piece will not be bought', () => {
    const own = place('loop1_respite');
    const hide = own.state.player.inventory.find((i) => pack.items[i.itemId]?.name === 'Wildling Hide')!;
    const d = tradeDetail(own.state, pack, own.profile, KAELEN, 'sell', hide.uid, hide.qty, legalFor(own))!;
    expect(d.priceLine).toMatch(/^Pays \d+ gold each \(75% of its worth\)$/);
    expect(d.stockLine).toBe(`You have ${hide.qty}.`);
    expect(d.total).toBe(d.unit * hide.qty);
    expect(d.action.label).toBe(`Sell${hide.qty > 1 ? ` ${hide.qty}` : ''} for ${d.total} gold`);
    expect(d.action.confirm).toBeNull();
    const def = Object.values(pack.items).find((x) => x.type === 'weapon' && x.sellable)!;
    const epic = give(own.state, def.id, { rarity: 'epic' });
    const ed = tradeDetail(own.state, pack, own.profile, KAELEN, 'sell', epic.uid, 1, legalFor(own))!;
    expect(ed.action.confirm).toContain('Epic');
    expect(ed.action.yes).toBe('Sell it');
    const bound = give(own.state, def.id, { boundQuest: 'q_clear_path' });
    own.state.quests.q_clear_path = { status: 'active' } as never;
    const bd = tradeDetail(own.state, pack, own.profile, KAELEN, 'sell', bound.uid, 1, legalFor(own))!;
    expect(bd.action.enabled).toBe(false);
    expect(bd.action.reason).toContain('bound to an active quest');
  });

  test('a line that is not there gives nothing', () => {
    expect(tradeDetail(at.state, pack, at.profile, KAELEN, 'buy', 'i999', 1, ok)).toBeNull();
    expect(tradeDetail(at.state, pack, at.profile, 'npc_nobody', 'buy', 'i1', 1, ok)).toBeNull();
  });

  test('a row reads: name, rarity and kind, how many, the price', () => {
    const m = merchantModel(at.state, pack, at.profile, KAELEN, ok);
    const gear = m.buy.find((b) => b.row.isGear)!;
    expect(tradeLabel(gear, 'buy')).toBe(`${gear.row.name}, ${gear.row.rarityLabel} ${gear.row.typeLabel.toLowerCase()}, ${gear.unit} gold`);
    const stack = m.buy.find((b) => b.stock !== null && b.stock > 1)!;
    expect(tradeLabel(stack, 'buy')).toContain(`${stack.stock} for sale`);
    expect(tradeLabel(stack, 'buy')).toMatch(/\d+ gold each$/);
  });
});

describe('MerchantView', () => {
  const at = place('loop1_respite');
  const ok = legalFor(at);
  const model = merchantModel(at.state, pack, at.profile, KAELEN, ok);
  const line = model.buy.find((b) => b.stock !== null && b.stock >= 2 && !b.row.isGear)!;
  const detail = tradeDetail(at.state, pack, at.profile, KAELEN, 'buy', line.row.uid, 1, ok)!;
  const base = () => ({
    model,
    tab: 'buy' as const,
    selectedId: line.row.uid,
    detail,
    view: 'detail' as const,
    onTab: mock(),
    onMerchant: mock(),
    onSelect: mock(),
    onQty: mock(),
    onBack: mock(),
    onRun: mock(),
  });

  test('the bar, the standing, the tabs with their counts and the stall rows by name', () => {
    const p = base();
    const tree = expand(<MerchantView {...p} />);
    expect(tree.some((n) => n.type === 'span' && n.text === 'Kaelen Stonehand')).toBe(true);
    expect(tree.find((n) => n.props['data-testid'] === 'standing')?.text).toContain('prices');
    const tabs = all(tree, 'button').filter((n) => n.props.role === 'tab');
    expect(tabs.map(nameOf)).toEqual([`Buy, ${model.buy.length}`, `Sell, ${model.sell.length}`]);
    call(tabs[1]!, 'onClick');
    expect(p.onTab).toHaveBeenCalledWith('sell');
    const row = tree.find((n) => n.type === 'button' && n.props['data-item-id'] === line.row.uid)!;
    expect(row.props['aria-current']).toBe('true');
    expect(nameOf(row)).toBe(tradeLabel(line, 'buy'));
    call(row, 'onClick');
    expect(p.onSelect).toHaveBeenCalledWith(line.row.uid);
  });

  test('the line: a quantity stepper that drives onQty, the total, and the Buy button that runs the action', () => {
    const p = base();
    const tree = expand(<MerchantView {...p} />);
    call(byName(tree, 'button', 'More quantity to buy'), 'onClick');
    expect(p.onQty).toHaveBeenCalledWith(2);
    expect(tree.find((n) => n.type === 'p' && n.props.className === 'trade-total')?.text).toBe(`Total: ${detail.total} gold`);
    call(byName(tree, 'button', detail.action.label), 'onClick');
    expect(p.onRun).toHaveBeenCalledWith(detail.action);
    call(byName(tree, 'button', 'Back to the stall'), 'onClick');
    expect(p.onBack).toHaveBeenCalled();
  });

  test('a line with one unit has no stepper; a shut button gives its reason', () => {
    const one = tradeDetail(at.state, pack, at.profile, KAELEN, 'buy', model.buy.find((b) => b.stock === 1 && b.row.isGear)!.row.uid, 1, ok)!;
    const shut = { ...one, action: { ...one.action, enabled: false, reason: 'Your pack is full' } };
    const tree = expand(<TradeDetailView detail={shut} onQty={mock()} onRun={mock()} />);
    expect(all(tree, 'button').some((b) => nameOf(b).includes('quantity'))).toBe(false);
    expect(byName(tree, 'button', one.action.label).props.disabled).toBe(true);
    expect(tree.find((n) => n.props.id === 'buy-why')?.text).toBe('Your pack is full');
  });

  test('the Sell tab lists the pack and says so when nothing will be taken', () => {
    const sell = expand(<MerchantView {...base()} tab="sell" selectedId={null} detail={null} view="list" />);
    expect(sell.find((n) => n.type === 'nav')?.props['aria-label']).toBe('Your pack');
    expect(all(sell, 'button').filter((b) => b.props['data-list-item'] === '')).toHaveLength(model.sell.length);
    const none = expand(<MerchantView {...base()} model={{ ...model, sell: [] }} tab="sell" selectedId={null} detail={null} view="list" />);
    expect(none.some((n) => n.type === 'p' && n.text === 'Nothing in your pack that Kaelen Stonehand will take.')).toBe(true);
  });

  test('two traders in one place: a chip for each', () => {
    const two = { ...model, merchants: [...model.merchants, { id: 'npc_other', name: 'Other' }] };
    const p = base();
    const tree = expand(<MerchantView {...p} model={two} />);
    call(byName(tree, 'button', 'Other'), 'onClick');
    expect(p.onMerchant).toHaveBeenCalledWith('npc_other');
  });
});
