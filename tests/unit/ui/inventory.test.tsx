// Inventory and Equipment (U67; DESIGN §7, §16.3 `screen_inventory`): the shared item words (rarity, affixes, passives,
// requirements, comparison with what is worn), the panel's model (slots, pack, Satchel, filters, the chosen piece and its
// actions with the engine's reasons, the question before a drop that matters) and InventoryView / ItemCard / ItemIcon,
// driven through tests/unit/ui/tree.ts. The panel's focus, keys and the Shell's confirm are e2e's (tests/e2e/inventory.spec.ts).
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { derive, isLegal } from '@engine/index';
import { ItemIcon } from '@ui/art/ItemIcon';
import { ActionButtons, CompareList, ItemCard, NeedList, QtyStepper } from '@ui/components/items/ItemCard';
import { InventoryView, DetailView } from '@ui/panels/InventoryPanel';
import {
  DEFAULT_SELECTION,
  FILTERS,
  deleteQuestion,
  dropQuestion,
  filterOf,
  inventoryDetail,
  inventoryModel,
  resolveSelection,
  slotLabel,
  slotId,
} from '@ui/panels/inventoryModel';
import {
  RARITY_LABEL,
  RARITY_PATTERN,
  affixRows,
  compareToWorn,
  deltaRows,
  instName,
  itemFacts,
  itemName,
  itemRow,
  rowLabel,
  signed,
  typeLine,
  useLines,
} from '@ui/panels/itemModel';
import { notExploring, panelAction } from '@ui/panels/panelAction';
import { all, byName, call, expand, nameOf } from './tree';
import { find, give, legalFor, pack, place } from './panelFixtures';

const named = (state: ReturnType<typeof place>['state'], name: string) => {
  const inst = state.player.inventory.find((i) => pack.items[i.itemId]?.name === name);
  if (inst === undefined) throw new Error(`no ${name} in the pack`);
  return inst;
};

describe('itemModel: the words', () => {
  test('consumables explain numerical heals and thrown ability effects, as well as flavor', () => {
    expect(useLines(pack.items.item_ley_touched_tonic!, pack)).toEqual(['Restores 25 HP.', 'Restores 15 MP.']);
    expect(useLines(pack.items.item_lanternreed_salts!, pack)).toContain('Revives a companion with 30% of their maximum HP.');
    for (const id of ['item_ember_flask', 'item_storm_jar']) {
      const def = pack.items[id]!;
      const grant = def.passives.find((p) => p.kind === 'grantAbility');
      if (grant?.kind !== 'grantAbility') throw new Error('expected a thrown ability');
      expect(useLines(def, pack)).toContain(pack.abilities[grant.abilityId]!.description);
      expect(useLines(def, pack).join(' ')).toMatch(/\d+/);
    }
  });

  test('rarity: five words, five frame patterns, none of them colour', () => {
    expect(Object.values(RARITY_LABEL)).toEqual(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']);
    expect(new Set(Object.values(RARITY_PATTERN)).size).toBe(5);
    expect(signed(3)).toBe('+3');
    expect(signed(-2)).toBe('−2');
  });

  test('a name carries its affixes’ suffixes; an unknown affix is skipped', () => {
    const at = place('loop1_respite');
    const sword = named(at.state, "Traveler's Sword");
    const def = pack.items[sword.itemId]!;
    expect(itemName(def, [], pack)).toBe("Traveler's Sword");
    expect(itemName(def, ['affix_of_the_hunt'], pack)).toBe("Traveler's Sword of the Hunt");
    expect(itemName(def, ['affix_nope'], pack)).toBe("Traveler's Sword");
    expect(instName(pack, { itemId: sword.itemId, affixes: ['affix_of_the_hunt'] })).toBe("Traveler's Sword of the Hunt");
    expect(typeLine(def)).toMatch(/Melee weapon/);
    expect(affixRows(def, ['affix_of_the_hunt', 'affix_nope'], pack).map((a) => [a.id, a.suffix])).toEqual([['affix_of_the_hunt', 'of the Hunt']]);
  });

  test('a card for gear: stats at its rarity, affixes in words, what it asks, its worth', () => {
    const at = place('loop1_respite');
    const sword = give(at.state, named(at.state, "Traveler's Sword").itemId, { rarity: 'rare', affixes: ['affix_of_the_hunt', 'affix_of_thorns'] });
    const facts = itemFacts(pack, sword, { state: at.state, profile: at.profile })!;
    expect(facts.isGear).toBe(true);
    expect(facts.rarityLabel).toBe('Rare');
    expect(facts.name).toContain('of the Hunt');
    expect(facts.affixes.map((a) => a.suffix)).toEqual(['of the Hunt', 'of Thorns']);
    expect(facts.affixes.every((a) => a.text.length > 0)).toBe(true);
    expect(facts.stats.length).toBeGreaterThan(0);
    expect(facts.value).toBeGreaterThan(0);
    expect(facts.satchel).toBe(false);
    const common = itemFacts(pack, { ...sword, rarity: 'common', affixes: [] })!;
    expect(common.affixes).toEqual([]);
    // a rarer piece is worth more and says more
    expect(facts.value).toBeGreaterThan(common.value);
    expect(itemFacts(pack, { ...sword, itemId: 'item_no_such_thing' })).toBeNull();
  });

  test('a card for a consumable: no rarity word, what it does, and the stack', () => {
    const at = place('loop1_respite');
    const tonic = at.state.player.inventory.find((i) => pack.items[i.itemId]?.type === 'consumable')!;
    const facts = itemFacts(pack, tonic, { state: at.state, profile: at.profile })!;
    expect(facts.isGear).toBe(false);
    expect(facts.rarityLabel).toBe('');
    expect(facts.effects.length).toBeGreaterThan(0);
    expect(facts.qty).toBe(tonic.qty);
  });

  test('compare to worn: the change in the Wayfinder’s numbers, from derive itself', () => {
    const at = place('loop1_respite');
    const robe = find(at.state, 'item_scribes_robe');
    const [c] = compareToWorn(at.state, pack, robe);
    expect(c).toMatchObject({ slotLabel: 'Armor', wornName: null });
    const before = derive(at.state.player, pack);
    const worn = structuredClone(at.state.player);
    worn.inventory = worn.inventory.filter((i) => i.uid !== robe.uid);
    worn.equipment.armor = robe;
    const after = derive(worn, pack);
    expect(deltaRows(before, after).map((r) => r.text)).toEqual(c!.rows.map((r) => r.text));
    expect(c!.rows.every((r) => r.delta !== 0)).toBe(true);
    expect(deltaRows(before, before)).toEqual([]);
  });

  test('a row: icon word, qty, bound flag; its label reads as a sentence', () => {
    const at = place('loop1_respite');
    const hide = named(at.state, 'Wildling Hide');
    const row = itemRow(pack, hide);
    expect(row).toMatchObject({ name: 'Wildling Hide', isGear: false, rarityLabel: '' });
    expect(rowLabel(row)).toContain('Wildling Hide');
    expect(rowLabel(row, ['bound to a quest', null])).toContain('bound to a quest');
    const robe = itemRow(pack, find(at.state, 'item_scribes_robe'));
    expect(rowLabel(robe)).toContain('Common');
  });
});

describe('inventoryModel', () => {
  test('the paper doll is four slots; the pack is counted against forty; filters count by kind', () => {
    const at = place('loop1_respite');
    const m = inventoryModel(at.state, pack, 'all');
    expect(m.slots.map((s) => [s.slot, s.label])).toEqual([
      ['weapon', 'Weapon'],
      ['armor', 'Armor'],
      ['trinket1', 'Trinket 1'],
      ['trinket2', 'Trinket 2'],
    ]);
    expect(m.slots[0]!.item).not.toBeNull();
    expect(m.max).toBe(40);
    expect(m.used).toBe(m.pack.length);
    expect(m.full).toBe(false);
    expect(m.readOnly).toBeNull();
    expect(m.filters.map((f) => f.id)).toEqual(FILTERS.map((f) => f.id));
    expect(m.filters[0]).toMatchObject({ id: 'all', count: m.pack.length });
    const gear = inventoryModel(at.state, pack, 'gear');
    expect(gear.pack.length).toBe(m.filters.find((f) => f.id === 'gear')!.count);
    expect(gear.pack.every((r) => r.isGear)).toBe(true);
    expect(filterOf('weapon')).toBe('gear');
    expect(filterOf('consumable')).toBe('consumable');
    expect(filterOf('material')).toBe('material');
    expect(filterOf('quest')).toBe('other');
    // gear first, then consumables, then materials, each by name
    const kinds = m.pack.map((r) => filterOf(r.type));
    expect([...kinds].sort((a, b) => ['gear', 'consumable', 'material', 'other'].indexOf(a) - ['gear', 'consumable', 'material', 'other'].indexOf(b))).toEqual(kinds);
  });

  test('quest and key items live in the Satchel and take no slot', () => {
    const at = place('loop1_respite');
    const quest = Object.values(pack.items).find((d) => d.type === 'quest');
    expect(quest).toBeDefined();
    const used = inventoryModel(at.state, pack, 'all').used;
    give(at.state, quest!.id);
    const m = inventoryModel(at.state, pack, 'all');
    expect(m.satchel.map((r) => r.itemId)).toContain(quest!.id);
    expect(m.pack.some((r) => r.itemId === quest!.id)).toBe(false);
    expect(m.used).toBe(used);
  });

  test('in a fight everything is read-only and says so', () => {
    const at = place('loop1_respite');
    at.state.mode = 'combat';
    const m = inventoryModel(at.state, pack, 'all');
    expect(m.readOnly).toBe(notExploring('combat'));
    expect(m.readOnly).toMatch(/Item action/);
    const robe = find(at.state, 'item_scribes_robe');
    const d = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, robe.uid)!, legalFor(at));
    expect(d.actions.every((a) => !a.enabled && a.reason === notExploring('combat'))).toBe(true);
  });

  test('selection: a slot id, a worn piece, a pack piece, and nothing for a stale id', () => {
    const at = place('loop1_respite');
    const weapon = at.state.player.equipment.weapon!;
    expect(DEFAULT_SELECTION).toBe(slotId('weapon'));
    expect(resolveSelection(at.state, DEFAULT_SELECTION)).toMatchObject({ kind: 'slot', slot: 'weapon' });
    expect(resolveSelection(at.state, weapon.uid)).toMatchObject({ kind: 'item', slot: 'weapon' });
    expect(resolveSelection(at.state, slotId('armor'))).toMatchObject({ kind: 'slot', inst: null });
    const robe = find(at.state, 'item_scribes_robe');
    expect(resolveSelection(at.state, robe.uid)).toMatchObject({ kind: 'item', slot: null });
    expect(resolveSelection(at.state, 'i999')).toBeNull();
    expect(resolveSelection(at.state, 'slot:nowhere')).toBeNull();
    expect(resolveSelection(at.state, null)).toBeNull();
  });

  test('an empty slot says what to do; a worn piece offers Take off', () => {
    const at = place('loop1_respite');
    const empty = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, slotId('armor'))!, legalFor(at));
    expect(empty.facts).toBeNull();
    expect(empty.note).toContain('Nothing is worn in the armor slot');
    expect(empty.actions).toEqual([]);
    const worn = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, at.state.player.equipment.weapon!.uid)!, legalFor(at));
    expect(worn.wornIn).toBe('weapon');
    expect(worn.actions.map((a) => a.id)).toEqual(['unequip']);
    expect(worn.actions[0]).toMatchObject({ label: 'Take off', enabled: true });
    expect(worn.note).toBe('Worn in the weapon slot.');
  });

  test('a piece in the pack: Wear for its slot with the comparison, Drop; a trinket may go in either slot', () => {
    const at = place('loop1_respite');
    const robe = find(at.state, 'item_scribes_robe');
    const d = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, robe.uid)!, legalFor(at));
    expect(d.actions.map((a) => [a.id, a.label, a.enabled])).toEqual([
      ['equip-armor', 'Wear', true],
      ['drop', 'Drop', true],
    ]);
    expect(d.actions[0]!.action).toEqual({ type: 'equip', uid: robe.uid });
    expect(d.compare).toHaveLength(1);
    const trinket = Object.values(pack.items).find((x) => x.type === 'trinket')!;
    const t = give(at.state, trinket.id);
    const td = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, t.uid)!, legalFor(at));
    expect(td.actions.filter((a) => a.id.startsWith('equip-')).map((a) => a.label)).toEqual(['Wear as trinket 1', 'Wear as trinket 2']);
    expect(td.compare).toHaveLength(2);
  });

  test('a requirement not met turns Wear off with the engine’s own reason', () => {
    const at = place('loop1_respite');
    const robe = find(at.state, 'item_scribes_robe');
    // the same pack, with the Robe asking for Level 9 (no shipped armor asks for a level yet)
    const strict = { ...pack, items: { ...pack.items, item_scribes_robe: { ...pack.items.item_scribes_robe!, requirements: { level: 9 } } } };
    const legal = (a: Parameters<ReturnType<typeof legalFor>>[0]) => isLegal(at.state, a, strict, at.profile);
    const d = inventoryDetail(at.state, strict, at.profile, resolveSelection(at.state, robe.uid)!, legal);
    const wear = d.actions.find((a) => a.id.startsWith('equip'))!;
    expect(wear.enabled).toBe(false);
    expect(wear.reason).toMatch(/level/i);
    expect(d.facts!.requirements).toEqual([{ text: 'Level 9', met: false }]);
    const tree = expand(<ItemCard facts={d.facts!} />);
    expect(tree.some((n) => n.type === 'li' && n.text.includes('Level 9 (not met)'))).toBe(true);
  });

  test('Use for a potion; a stack drops by one or all, and a trifle drops without a question', () => {
    const at = place('loop1_respite');
    const tonic = at.state.player.inventory.find((i) => pack.items[i.itemId]?.type === 'consumable' && i.qty > 1)!;
    const d = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, tonic.uid)!, legalFor(at));
    expect(d.actions.map((a) => a.id)).toEqual(['use', 'drop', 'drop-one']);
    expect(d.actions[1]!.label).toBe(`Drop all ${tonic.qty}`);
    expect(d.actions[2]!.action).toEqual({ type: 'drop', uid: tonic.uid, qty: 1 });
    const hide = named(at.state, 'Wildling Hide');
    const hd = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, hide.uid)!, legalFor(at));
    expect(hd.actions.find((a) => a.id === 'use')).toBeUndefined();
    expect(hd.actions.find((a) => a.id === 'drop')!.confirm).toBeNull();
  });

  test('dropping something that matters asks first; Delete always asks', () => {
    const at = place('loop1_respite');
    const def = pack.items[named(at.state, "Traveler's Sword").itemId]!;
    const rare = give(at.state, def.id, { rarity: 'epic' });
    const q = dropQuestion(def, rare, 1, pack);
    expect(q).toContain('Epic');
    expect(q).toContain('stays on the ground until the next dawn');
    const common = named(at.state, "Traveler's Sword");
    expect(dropQuestion(def, common, 1, pack)).toBeNull();
    expect(deleteQuestion(def, common, pack)).toContain('Drop Traveler');
    const bound = give(at.state, def.id, { boundQuest: 'q_clear_path' });
    expect(dropQuestion(def, bound, 1, pack)).toContain('given to you for a quest');
    const d = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, rare.uid)!, legalFor(at));
    expect(d.actions.find((a) => a.id === 'drop')!.confirm).toBe(q);
    // a big stack of valuables asks too
    const gold = Object.values(pack.items).find((x) => x.type === 'material' && x.value >= 10)!;
    const stack = give(at.state, gold.id, { qty: 12 });
    expect(dropQuestion(gold, stack, 12, pack)).toContain(`${gold.name}`);
  });

  test('reading a tome that raises Corruption asks, with the cost in HP and the Corruption it reaches', () => {
    const at = place('loop1_respite');
    const tome = Object.values(pack.items).find((d) => d.type === 'tome' && d.onUse.some((e) => 'corruption' in e));
    if (tome === undefined) return;
    const inst = give(at.state, tome.id);
    const d = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, inst.uid)!, legalFor(at));
    const read = d.actions.find((a) => a.id === 'read')!;
    expect(read.label).toBe('Read');
    if (read.enabled) expect(read.confirm).toMatch(/Corruption from \d+ to \d+/);
  });

  test('slot labels read as a sentence', () => {
    const at = place('loop1_respite');
    const m = inventoryModel(at.state, pack, 'all');
    expect(slotLabel(m.slots[1]!)).toBe('Armor: empty');
    expect(slotLabel(m.slots[0]!)).toMatch(/^Weapon: .+, Common /);
  });
});

describe('InventoryView, DetailView and the shared card', () => {
  const at = place('loop1_respite');
  const model = inventoryModel(at.state, pack, 'all');
  const robe = find(at.state, 'item_scribes_robe');
  const detail = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, robe.uid)!, legalFor(at));
  const props = (patch: Partial<Parameters<typeof InventoryView>[0]> = {}) => ({
    model,
    filter: 'all' as const,
    selectedId: robe.uid,
    detail,
    view: 'detail' as const,
    onFilter: mock(),
    onSelect: mock(),
    onBack: mock(),
    onRun: mock(),
    ...patch,
  });

  test('the list: Worn, Pack with its counter, filters as pressed buttons; each row is one named button', () => {
    const p = props();
    const tree = expand(<InventoryView {...p} />);
    expect(tree.find((n) => n.type === 'span' && n.text === `Pack ${model.used} / 40`)).toBeDefined();
    const weapon = all(tree, 'button').find((n) => nameOf(n).startsWith('Weapon: '))!;
    expect(weapon.props['data-item-id']).toBe('slot:weapon');
    expect(nameOf(byName(tree, 'button', 'Armor: empty'))).toBe('Armor: empty');
    const gearChip = byName(tree, 'button', /^Gear, \d+$/);
    expect(gearChip.props['aria-pressed']).toBe(false);
    call(gearChip, 'onClick');
    expect(p.onFilter).toHaveBeenCalledWith('gear');
    const robeRow = tree.find((n) => n.type === 'button' && n.props['data-item-id'] === robe.uid)!;
    expect(robeRow.props['aria-current']).toBe('true');
    call(robeRow, 'onClick');
    expect(p.onSelect).toHaveBeenCalledWith(robe.uid);
  });

  test('the pressed filter is marked, and an empty filter says so', () => {
    const empty = { ...model, pack: [] };
    const tree = expand(<InventoryView {...props({ model: empty, filter: 'material' })} />);
    expect(byName(tree, 'button', /^Materials, \d+$/).props['aria-pressed']).toBe(true);
    expect(tree.some((n) => n.text === 'Nothing of that kind in your pack.')).toBe(true);
    const bare = expand(<InventoryView {...props({ model: empty, filter: 'all' })} />);
    expect(bare.some((n) => n.text === 'Your pack is empty.')).toBe(true);
  });

  test('the detail: the card, the actions each with its reason, the comparison; Wear runs the engine action', () => {
    const p = props();
    const tree = expand(<InventoryView {...p} />);
    expect(tree.find((n) => n.type === 'h3' && n.props.id === 'inv-detail-heading')?.text).toContain("Scribe's Robe");
    const wear = byName(tree, 'button', 'Wear');
    call(wear, 'onClick');
    expect(p.onRun).toHaveBeenCalledWith(detail.actions[0]);
    expect(tree.some((n) => n.text === 'Compared with what you wear')).toBe(true);
    const back = byName(tree, 'button', 'Back to the list');
    call(back, 'onClick');
    expect(p.onBack).toHaveBeenCalled();
    expect(tree.find((n) => n.props['data-view'] === 'detail')).toBeDefined();
  });

  test('a shut button says why beside it and is described by it', () => {
    const shut = panelAction('equip-armor', 'Wear', { type: 'equip', uid: robe.uid }, () => false, 'Needs Level 5');
    const tree = expand(<ActionButtons actions={[shut]} onRun={() => undefined} />);
    const b = byName(tree, 'button', 'Wear');
    expect(b.props.disabled).toBe(true);
    expect(b.props['aria-describedby']).toBe('equip-armor-why');
    expect(tree.find((n) => n.props.id === 'equip-armor-why')?.text).toBe('Needs Level 5');
  });

  test('an empty slot: its name and a sentence, no buttons', () => {
    const slot = inventoryDetail(at.state, pack, at.profile, resolveSelection(at.state, slotId('trinket1'))!, legalFor(at));
    const tree = expand(<DetailView detail={slot} onRun={() => undefined} />);
    expect(tree.find((n) => n.type === 'h3')?.text).toBe('Trinket 1: empty');
    expect(all(tree, 'button')).toEqual([]);
  });

  test('ItemCard: rarity written as a word beside the icon, affixes and requirements listed', () => {
    const sword = give(at.state, named(at.state, "Traveler's Sword").itemId, { rarity: 'rare', affixes: ['affix_of_the_hunt'] });
    const facts = itemFacts(pack, sword, { state: at.state, profile: at.profile })!;
    const tree = expand(<ItemCard facts={facts} />);
    expect(tree.find((n) => n.props.className === 'rarity-tag')?.text).toBe('Rare');
    expect(tree.find((n) => n.type === 'section' && n.props['aria-label'] === 'Affixes')).toBeDefined();
    expect(tree.find((n) => n.type === 'ul' && n.props['aria-label'] === 'Stats')).toBeDefined();
    expect(tree.some((n) => n.type === 'p' && /^Worth \d+ gold/.test(n.text))).toBe(true);
  });

  test('CompareList names the slot it replaces and marks up and down with arrows as well as words', () => {
    const c = compareToWorn(at.state, pack, robe);
    const tree = expand(<CompareList compare={c} />);
    expect(tree.some((n) => n.text.startsWith('Armor: empty'))).toBe(true);
    expect(tree.filter((n) => n.type === 'li' && n.props['data-direction'] !== undefined).length).toBe(c[0]!.rows.length);
    expect(expand(<CompareList compare={[]} />)).toEqual([]);
    const none = expand(<CompareList compare={[{ ...c[0]!, rows: [] }]} />);
    expect(none.some((n) => n.text === 'No change to your numbers.')).toBe(true);
  });

  test('QtyStepper: fewer, more and all, each named and limited', () => {
    const changes: number[] = [];
    const tree = expand(<QtyStepper label="Quantity to buy" value={2} max={5} onChange={(n) => changes.push(n)} />);
    call(byName(tree, 'button', 'Fewer quantity to buy'), 'onClick');
    call(byName(tree, 'button', 'More quantity to buy'), 'onClick');
    call(byName(tree, 'button', 'All 5'), 'onClick');
    expect(changes).toEqual([1, 3, 5]);
    const low = expand(<QtyStepper label="Quantity" value={1} max={1} onChange={() => undefined} />);
    expect(byName(low, 'button', 'Fewer quantity').props.disabled).toBe(true);
    expect(byName(low, 'button', 'More quantity').props.disabled).toBe(true);
    expect(all(low, 'button').some((b) => nameOf(b).startsWith('All'))).toBe(false);
  });

  test('NeedList: a ✓ or ✗ and the numbers, and the words for a screen reader', () => {
    const tree = expand(
      <NeedList
        label="Materials"
        needs={[
          { itemId: 'a', name: 'Ember Ore', have: 3, need: 2, keep: 0 },
          { itemId: 'b', name: 'Slate Core', have: 1, need: 2, keep: 0 },
          { itemId: 'c', name: 'Sky-Whisper Talisman', have: 2, need: 1, keep: 1 },
        ]}
      />,
    );
    const items = all(tree, 'li');
    expect(items.map((n) => n.props['data-ok'])).toEqual(['true', 'false', 'true']);
    expect(items[0]!.text).toContain('3 of 2');
    expect(items[1]!.text).toContain('not enough');
    expect(items[2]!.text).toContain('and keep 1');
    expect(expand(<NeedList label="x" needs={[]} />)).toEqual([]);
  });

  test('ItemIcon: a rarity frame per pattern, affix marks only on gear, a name only when asked', () => {
    const html = (rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary', extra = {}) =>
      renderToStaticMarkup(<ItemIcon icon="sword" type="weapon" rarity={rarity} affixes={2} {...extra} />);
    expect(html('common')).toContain('data-rarity="common"');
    expect(html('uncommon')).toContain('stroke-dasharray="0.1 4.2"');
    expect(html('rare')).toContain('stroke-dasharray="7 4"');
    expect(html('epic')).toContain('item-icon__frame--inner');
    expect(html('legendary')).toContain('item-icon__corners');
    expect(html('rare')).toContain('item-icon__affix');
    expect(html('rare')).toContain('aria-hidden="true"');
    expect(html('rare', { title: 'A Rare sword' })).toContain('aria-label="A Rare sword"');
    const potion = renderToStaticMarkup(<ItemIcon icon="potion" type="consumable" rarity="epic" affixes={2} />);
    expect(potion).toContain('data-rarity="common"');
    expect(potion).not.toContain('item-icon__affix');
    // an unknown icon word falls back to its type's glyph
    expect(renderToStaticMarkup(<ItemIcon icon="no-such-icon" type="armor" rarity="common" />)).toContain('data-glyph=');
  });
});
