// U21: inventory and character reducers (PLAN §8.1 "inventory/equipment"): stacking and maxStack, drop, equip/unequip
// incl. two trinkets, class/level/condition requirements, derived stats following gear, bound quest items, readBook
// Corruption 0→6 with its HP cost and the Weaver mark at 6, plus use, allocateStat, unlockAbility, respec and the
// agreement of their legalActions enumerators with step. (`take`/`takeAll` are U20's explore reducers.)
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import type { ItemInput } from '@schema/item';
import {
  HANDLERS,
  POST_STEP_HOOKS,
  apply,
  createStep,
  derive,
  isLegal,
  legalActions,
  step,
  type Action,
  type ActionType,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import { SEEN_TOO_MUCH } from '@engine/reducers/inventory';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState, play, type PlayEntry, type StateOverrides } from '@tests/fixtures/helpers';
import { miniContentTables } from '@tests/fixtures/miniContent';

const fixtureItem = (id: string, name: string, extra: Partial<ItemInput>): ItemInput =>
  ({ id, name, description: 'Fixture.', type: 'trinket', slot: 'trinket', tier: 1, value: 20, art: { icon: 'charm' }, ...extra }) as ItemInput;

const EXTRA_ITEMS: ItemInput[] = [
  fixtureItem('item_wizard_focus', 'Wizard Focus', { stats: { magic: 1 }, requirements: { classIds: ['wizard'] } }),
  fixtureItem('item_veterans_band', "Veteran's Band", { stats: { strength: 1 }, requirements: { level: 5 } }),
  fixtureItem('item_remnant_seal', 'Remnant Seal', { stats: { agility: 1 }, requirements: { when: { rep: { faction: 'remnants', min: 20 } } } }),
  fixtureItem('item_insight_draught', 'Insight Draught', { type: 'consumable', slot: undefined, onUse: [{ xp: 470 }] }),
  fixtureItem('item_ember_flask', 'Ember Flask', { type: 'consumable', slot: undefined, onUse: [{ heal: { hp: 1 } }], usableOutOfCombat: false }),
  fixtureItem('item_wardens_codex', "Warden's Codex", { type: 'tome', slot: undefined, tier: 0, onUse: [{ counter: { name: 'tomes_read', delta: 1 } }] }),
];
const pack = buildContentPack({ ...miniContentTables, items: [...miniContentTables.items, ...EXTRA_ITEMS] }, { version: 'u21-inventory' });

const st = (o: StateOverrides = {}) => makeState(o, { content: pack });
const run = (s: GameState, script: readonly PlayEntry[], profile?: Profile) => play(s, script, { content: pack, ...(profile ? { profile } : {}) });
const uidOf = (s: GameState, itemId: string, nth = 0): string => s.player.inventory.filter((i) => i.itemId === itemId)[nth]!.uid;
const ids = (s: GameState) => s.player.inventory.map((i) => `${i.itemId}×${i.qty}`);
const only = (events: GameEvent[], ...types: GameEvent['t'][]) => events.filter((e) => types.includes(e.t));
const reject = (action: Action, reason?: string): PlayEntry => (reason === undefined ? { reject: action } : { reject: action, reason });

// ---- use -----------------------------------------------------------------------------------------------------------------

describe('use (DESIGN §7.9)', () => {
  test('a consumable is used up and its effects applied; healing stops at the maximum', () => {
    const s = st({ hp: 50, mp: 10 });
    const tonic = uidOf(s, 'item_ley_touched_tonic');
    const once = run(s, [{ type: 'use', uid: tonic }]);
    expect(once.state.player).toMatchObject({ hp: 75, mp: 25 });
    expect(ids(once.state)).toEqual(['item_ley_touched_tonic×1']);
    expect(only(once.events, 'itemLost', 'healed')).toEqual([
      { t: 'itemLost', itemId: 'item_ley_touched_tonic', qty: 1, reason: 'used' },
      { t: 'healed', targetUid: 'player', amount: 25, source: 'item:item_ley_touched_tonic' },
    ]);
    const twice = run(once.state, [{ type: 'use', uid: tonic }]);
    expect(twice.state.player).toMatchObject({ hp: 100, mp: 40 });
    expect(ids(twice.state)).toEqual([]);
    const full = run(st(), [{ type: 'use', uid: tonic }]);
    expect(full.state.player).toMatchObject({ hp: 120, mp: 48 });
  });

  test('an XP item levels up through the wired xp effect', () => {
    const s = st({ items: ['item_insight_draught'] });
    expect(run(s, [{ type: 'use', uid: uidOf(s, 'item_insight_draught') }]).state.player).toMatchObject({ level: 4, statPoints: 3, apHalf: 8, hp: 144 });
  });

  test('only usable, carried, untargeted items', () => {
    const s = st({ items: ['item_dark_spellbook', 'mat_shadow_ash', 'item_ember_flask'] });
    run(s, [
      reject({ type: 'use', uid: uidOf(s, 'item_dark_spellbook') }, 'Read the Dark Spellbook instead'),
      reject({ type: 'use', uid: uidOf(s, 'mat_shadow_ash') }, 'Shadow Ash cannot be used'),
      reject({ type: 'use', uid: uidOf(s, 'item_ember_flask') }, 'Ember Flask can only be used in combat'),
      reject({ type: 'use', uid: s.player.equipment.weapon!.uid }, 'You are not carrying that'),
      reject({ type: 'use', uid: 'i999' }, 'You are not carrying that'),
      reject({ type: 'use', uid: uidOf(s, 'item_ley_touched_tonic'), targetUid: 'c1' }, 'nothing to target'),
    ]);
  });
});

// ---- stacking ------------------------------------------------------------------------------------------------------------

describe('stacking and maxStack (DESIGN §7.8)', () => {
  const give = createStep(
    { ...HANDLERS, interact: (ctx, a) => apply({ giveItem: { item: a.eventId.slice(3).split('~')[0] as `item_${string}`, count: Number(a.eventId.split('~')[1] ?? 150) } }, ctx) },
    POST_STEP_HOOKS,
  );
  const giveAll = (s: GameState, ...itemIds: string[]) => play(s, itemIds.map((id) => ({ type: 'interact' as const, eventId: `ev_${id}` })), { content: pack, step: give }).state;

  test('consumables stack to 10, tomes to 5, materials to 99; gear never stacks', () => {
    const s = giveAll(st({ patch: (x) => void (x.player.inventory = []) }), 'item_glow_moss', 'item_dark_spellbook', 'mat_shadow_ash');
    const qty = (id: string) => s.player.inventory.filter((i) => i.itemId === id).map((i) => i.qty);
    expect(qty('item_glow_moss')).toEqual(Array(15).fill(10));
    expect(qty('item_dark_spellbook')).toEqual(Array(30).fill(5));
    expect(qty('mat_shadow_ash')).toEqual([99, 51]);
    expect(pack.items.item_rusty_dagger!.maxStack).toBe(1);
  });

  test('a gift fills existing stacks in order before opening new ones', () => {
    const s = st({ items: [{ itemId: 'item_ley_touched_tonic', qty: 7 }] });
    expect(ids(giveAll(s, 'item_ley_touched_tonic~4'))).toEqual(['item_ley_touched_tonic×6', 'item_ley_touched_tonic×7']);
    expect(ids(giveAll(s, 'item_ley_touched_tonic~14'))).toEqual(['item_ley_touched_tonic×10', 'item_ley_touched_tonic×10', 'item_ley_touched_tonic×3']);
  });
});

// ---- drop ----------------------------------------------------------------------------------------------------------------

describe('drop', () => {
  test('a whole stack goes to the ground here, same instance', () => {
    const s = st();
    const tonic = s.player.inventory[0]!;
    const out = run(s, [{ type: 'drop', uid: tonic.uid }]);
    expect(out.state.player.inventory).toEqual([]);
    expect(out.state.world.locationStates.loc_whispering_ruins!.items).toContainEqual(tonic);
    expect(only(out.events, 'itemLost')).toEqual([{ t: 'itemLost', itemId: 'item_ley_touched_tonic', qty: 2, reason: 'dropped' }]);
  });

  test('part of a stack splits off with a new uid', () => {
    const s = st({ locationId: 'loc_shattered_library' });
    const tonic = s.player.inventory[0]!;
    const out = run(s, [{ type: 'drop', uid: tonic.uid, qty: 1 }]);
    expect(out.state.player.inventory).toEqual([{ ...tonic, qty: 1 }]);
    const ground = out.state.world.locationStates.loc_shattered_library!.items;
    expect(ground).toContainEqual({ ...tonic, qty: 1, uid: `i${s.meta.nextUid}` });
    run(s, [reject({ type: 'drop', uid: tonic.uid, qty: 0 }), reject({ type: 'drop', uid: tonic.uid, qty: 3 }), reject({ type: 'drop', uid: tonic.uid, qty: 1.5 })]);
  });

  test('quest items and items bound to an active quest cannot be dropped', () => {
    const s = st({
      items: ['item_echo_crystal', 'mat_shadow_ash'],
      quests: { q_echo_crystal: 'find_crystal' },
      patch: (x) => void (x.player.inventory[2]!.boundQuest = 'q_echo_crystal'),
    });
    run(s, [
      reject({ type: 'drop', uid: uidOf(s, 'item_echo_crystal') }, 'Echo Crystal cannot be dropped'),
      reject({ type: 'drop', uid: uidOf(s, 'mat_shadow_ash') }, 'Shadow Ash is bound to an active quest'),
      reject({ type: 'drop', uid: 'i999' }, 'You are not carrying that'),
    ]);
    s.quests.q_echo_crystal!.status = 'completed';
    run(s, [{ type: 'drop', uid: uidOf(s, 'mat_shadow_ash') }]);
  });
});

// ---- equip / unequip -------------------------------------------------------------------------------------------------------

describe('equip / unequip (DESIGN §7.1)', () => {
  test('a new weapon swaps with the old one, which takes its place in the pack', () => {
    const s = st({ items: ['item_apprentice_staff', 'mat_iron_rivet'] });
    const [dagger, staff] = [s.player.equipment.weapon!, s.player.inventory[1]!];
    const out = run(s, [{ type: 'equip', uid: staff.uid }]);
    expect(out.state.player.equipment.weapon).toEqual(staff);
    expect(out.state.player.inventory.map((i) => i.uid)).toEqual([s.player.inventory[0]!.uid, dagger.uid, s.player.inventory[2]!.uid]);
    expect(only(out.events, 'itemEquipped', 'itemUnequipped')).toEqual([
      { t: 'itemUnequipped', slot: 'weapon' },
      { t: 'itemEquipped', slot: 'weapon', item: staff },
    ]);
    expect(derive(out.state.player, pack)).toMatchObject({ atk: 12, sp: 7, mpCostReduction: 0.1 });
  });

  test('armor into an empty slot; derived armor/ward follow', () => {
    const s = st({ items: ['item_ironclad_mail'] });
    const out = run(s, [{ type: 'equip', uid: uidOf(s, 'item_ironclad_mail'), slot: 'armor' }]);
    expect(out.state.player.equipment.armor?.itemId).toBe('item_ironclad_mail');
    expect(derive(out.state.player, pack)).toMatchObject({ armor: 4, ward: 1 });
    expect(only(out.events, 'itemUnequipped')).toEqual([]);
  });

  test('two trinket slots: first free slot, then a swap into trinket 1 unless a slot is named', () => {
    const s = st({ items: ['item_glyphbound_lantern', 'item_chronos_lens', 'item_heartstone_core'] });
    const [lantern, lens, core] = ['item_glyphbound_lantern', 'item_chronos_lens', 'item_heartstone_core'].map((id) => uidOf(s, id));
    const out = run(s, [
      { type: 'equip', uid: lantern! },
      { type: 'equip', uid: lens! },
      { type: 'equip', uid: core! },
    ]);
    const eq = out.state.player.equipment;
    expect([eq.trinket1?.uid, eq.trinket2?.uid]).toEqual([core, lens]);
    expect(ids(out.state)).toEqual(['item_ley_touched_tonic×2', 'item_glyphbound_lantern×1']);
    const named = run(out.state, [{ type: 'equip', uid: lantern!, slot: 'trinket2' }]).state.player.equipment;
    expect([named.trinket1?.uid, named.trinket2?.uid]).toEqual([core, lantern]);
  });

  test('slots must fit', () => {
    const s = st({ items: ['item_wildling_hide_armor', 'item_glyphbound_lantern'] });
    run(s, [
      reject({ type: 'equip', uid: uidOf(s, 'item_wildling_hide_armor'), slot: 'weapon' }, 'Wildling Hide Armor does not fit the weapon slot'),
      reject({ type: 'equip', uid: uidOf(s, 'item_glyphbound_lantern'), slot: 'armor' }, 'does not fit the armor slot'),
      reject({ type: 'equip', uid: uidOf(s, 'item_ley_touched_tonic') }, 'Ley-Touched Tonic cannot be equipped'),
      reject({ type: 'equip', uid: 'i999' }, 'You are not carrying that'),
    ]);
  });

  test('class, level and condition requirements', () => {
    const items = ['item_wizard_focus', 'item_veterans_band', 'item_remnant_seal'];
    const s = st({ items });
    const [focus, band, seal] = items.map((id) => uidOf(s, id));
    run(s, [
      reject({ type: 'equip', uid: focus! }, 'Only a Wizard can use Wizard Focus'),
      reject({ type: 'equip', uid: band! }, "Veteran's Band requires level 5"),
      reject({ type: 'equip', uid: seal! }, 'Remnant Seal requires: '),
    ]);
    const w = st({ classId: 'wizard', level: 5, items, reputation: { remnants: 20 } });
    run(w, [
      { type: 'equip', uid: uidOf(w, 'item_wizard_focus') },
      { type: 'equip', uid: uidOf(w, 'item_veterans_band') },
      { type: 'equip', uid: uidOf(w, 'item_remnant_seal'), slot: 'trinket1' },
    ]);
  });

  test('derived maxima follow gear: the Heartstone Core (−15 max HP, +25 max MP, +2 MAG); a round trip is neutral', () => {
    const s = st({ hp: 60, items: ['item_heartstone_core'] });
    const on = run(s, [{ type: 'equip', uid: uidOf(s, 'item_heartstone_core') }]);
    expect(on.state.player).toMatchObject({ hp: 45, hpMax: 105, mp: 77, mpMax: 77 });
    const off = run(on.state, [{ type: 'unequip', slot: 'trinket1' }]);
    expect(off.state.player).toMatchObject({ hp: 60, hpMax: 120, mp: 48, mpMax: 48 });
    expect(only(off.events, 'itemUnequipped')).toEqual([{ t: 'itemUnequipped', slot: 'trinket1' }]);
    expect(ids(off.state)).toEqual(['item_ley_touched_tonic×2', 'item_heartstone_core×1']);
  });

  test('unequip needs an occupied slot and room in the pack (Satchel items need none)', () => {
    const full = st({
      items: [{ itemId: 'item_glyphbound_lantern', equip: true }, ...Array.from({ length: 39 }, () => 'mat_shadow_ash')],
    });
    run(full, [
      reject({ type: 'unequip', slot: 'armor' }, 'Nothing is equipped there'),
      reject({ type: 'unequip', slot: 'belt' as 'armor' }, "There is no 'belt' slot"),
      reject({ type: 'unequip', slot: 'weapon' }, 'Your pack is full'),
      { type: 'unequip', slot: 'trinket1' },
    ]);
    run(st(), [{ type: 'unequip', slot: 'weapon' }]);
  });
});

// ---- allocateStat / unlockAbility ----------------------------------------------------------------------------------------------

describe('allocateStat and unlockAbility (DESIGN §5.1, §6.3)', () => {
  test('+1 to a primary per point; derived maxima follow', () => {
    const out = run(st({ level: 3 }), [
      { type: 'allocateStat', stat: 'strength' },
      { type: 'allocateStat', stat: 'magic' },
      reject({ type: 'allocateStat', stat: 'agility' }, 'No stat points to spend'),
      reject({ type: 'allocateStat', stat: 'luck' as 'agility' }, "Unknown stat 'luck'"),
    ]);
    expect(out.state.player).toMatchObject({ stats: { strength: 11, magic: 7, agility: 8 }, statPoints: 0, hp: 138, hpMax: 138, mp: 56, mpMax: 56 });
    expect(only(out.events, 'statAllocated')).toEqual([
      { t: 'statAllocated', stat: 'strength', value: 11 },
      { t: 'statAllocated', stat: 'magic', value: 7 },
    ]);
  });

  test('unlocks spend half-points; mastered ones cost half', () => {
    const out = run(st(), [
      { type: 'unlockAbility', abilityId: 'rgr_rend' },
      reject({ type: 'unlockAbility', abilityId: 'rgr_marked_shot' }, 'Not enough ability points'),
      reject({ type: 'unlockAbility', abilityId: 'rgr_piercing_arrow' }, 'requires level 4'),
    ]);
    expect(out.state.player).toMatchObject({ apHalf: 0, abilitiesUnlocked: ['rgr_rend'] });
    expect(only(out.events, 'abilityUnlocked')).toEqual([{ t: 'abilityUnlocked', abilityId: 'rgr_rend' }]);
    const mastered = freshProfile({ classMastery: { ranger: { loopsPlayed: 2, mastered: ['rgr_rend', 'rgr_marked_shot'], endings: [], bestLevel: 3, bestDays: null } } });
    const both = run(st(), [{ type: 'unlockAbility', abilityId: 'rgr_rend' }, { type: 'unlockAbility', abilityId: 'rgr_marked_shot' }], mastered);
    expect(both.state.player).toMatchObject({ apHalf: 0, abilitiesUnlocked: ['rgr_rend', 'rgr_marked_shot'] });
    expect(both.profile).toEqual(mastered);
  });
});

// ---- readBook ------------------------------------------------------------------------------------------------------------

describe('readBook: Corruption 0→6 (DESIGN §6.7, D-017, D-055)', () => {
  const books = (o: StateOverrides = {}) => st({ ...o, items: [{ itemId: 'item_dark_spellbook', qty: 5 }, { itemId: 'item_dark_spellbook', qty: 2 }] });

  test('−15 HP and +1 Corruption per read; the Weaver mark at 6; the seventh cannot be read', () => {
    const s = books();
    const [a, b] = [uidOf(s, 'item_dark_spellbook'), uidOf(s, 'item_dark_spellbook', 1)];
    const five = run(s, Array.from({ length: 5 }, () => ({ type: 'readBook' as const, uid: a })));
    expect(five.state.player).toMatchObject({ hp: 45, hpMax: 120, corruption: 5 });
    expect(five.state.reputation.remnants).toBe(0);
    const six = run(five.state, [{ type: 'readBook', uid: b }]);
    expect(six.state.player).toMatchObject({ hp: 18, hpMax: 108, corruption: 6, uses: { spellbooksRead: { loop: 1, count: 6 } } });
    expect(six.state.reputation.remnants).toBe(-10);
    expect(six.state.clock).toMatchObject({ limitTicks: 112, modifiers: [{ source: 'corruption', watches: -4 }] });
    expect(only(six.events, 'itemLost', 'corruptionChanged', 'reputationChanged', 'clockChanged')).toEqual([
      { t: 'itemLost', itemId: 'item_dark_spellbook', qty: 1, reason: 'used' },
      { t: 'corruptionChanged', value: 6, delta: 1 },
      { t: 'reputationChanged', faction: 'remnants', delta: -10, value: -10, tierBefore: 'neutral', tierAfter: 'wary' },
      { t: 'clockChanged', deltaWatches: -4, limitTicks: 112, floored: false },
    ]);
    run(six.state, [reject({ type: 'readBook', uid: b }, SEEN_TOO_MUCH)]);
    expect(ids(six.state)).toEqual(['item_ley_touched_tonic×2', 'item_dark_spellbook×1']);
  });

  test('reading never kills (HP floors at 1); a Wizard gains +1 SP per point', () => {
    const s = books({ classId: 'wizard', hp: 20 });
    const out = run(s, Array.from({ length: 3 }, () => ({ type: 'readBook' as const, uid: uidOf(s, 'item_dark_spellbook') })));
    expect(out.state.player).toMatchObject({ hp: 1, corruption: 3 });
    expect(derive(out.state.player, pack).sp).toBe(12 + 3);
  });

  test('echo_korr_marginalia: the first corrupting read of the loop costs no HP', () => {
    const s = books();
    const uid = uidOf(s, 'item_dark_spellbook');
    const profile = freshProfile({ echoes: ['echo_korr_marginalia'] });
    expect(run(s, [{ type: 'readBook', uid }], profile).state.player).toMatchObject({ hp: 120, corruption: 1 });
    expect(run(s, [{ type: 'readBook', uid }, { type: 'readBook', uid }], profile).state.player).toMatchObject({ hp: 105, corruption: 2 });
  });

  test('a tome without Corruption reads at the maximum; only tomes are read', () => {
    const s = st({ corruption: 6, items: ['item_wardens_codex'] });
    const out = run(s, [
      { type: 'readBook', uid: uidOf(s, 'item_wardens_codex') },
      reject({ type: 'readBook', uid: uidOf(s, 'item_ley_touched_tonic') }, 'Ley-Touched Tonic is not a book'),
      reject({ type: 'readBook', uid: 'i999' }, 'You are not carrying that'),
    ]);
    expect(out.state.counters.custom).toEqual({ tomes_read: 1 });
    expect(out.state.reputation.remnants).toBe(0);
  });

  test('the mark follows any source of Corruption, once per rise to the maximum', () => {
    const corrupt = createStep(
      { ...HANDLERS, interact: (ctx, a) => apply({ corruption: a.eventId === 'ev_up' ? 6 : -6 }, ctx) },
      POST_STEP_HOOKS,
    );
    const out = play(
      st(),
      ['ev_up', 'ev_up', 'ev_down', 'ev_up'].map((eventId) => ({ type: 'interact' as const, eventId })),
      { content: pack, step: corrupt },
    );
    expect(out.state.reputation.remnants).toBe(-20);
    expect(out.state.clock.limitTicks).toBe(108);
    expect(out.state.player).toMatchObject({ corruption: 6, hpMax: 108, hp: 108 });
  });
});

// ---- respec --------------------------------------------------------------------------------------------------------------

describe('respec (DESIGN §6.3)', () => {
  const learned = (o: StateOverrides = {}) =>
    st({ level: 3, gold: 200, abilities: ['rgr_rend', 'rgr_marked_shot'], patch: (x) => void (x.player.apHalf = 2), ...o });

  test('at a camp fire, 50 × level gold, once per day: every bought AP comes back', () => {
    const out = run(learned(), [{ type: 'respec' }]);
    expect(out.state.player).toMatchObject({ gold: 50, apHalf: 6, abilitiesUnlocked: [], uses: { respec: { day: 1 } } });
    expect(out.state.counters.goldSpent).toBe(150);
    expect(only(out.events, 'goldChanged')).toEqual([{ t: 'goldChanged', delta: -150, total: 50 }]);
    const again = run(out.state, [{ type: 'unlockAbility', abilityId: 'rgr_rend' }, reject({ type: 'respec' }, 'already rethought your path today')]);
    const dayTwo = clone(again.state);
    dayTwo.clock.ticks = 4;
    run(dayTwo, [reject({ type: 'respec' }, 'costs 150 gold')]);
    dayTwo.player.gold = 150;
    expect(run(dayTwo, [{ type: 'respec' }]).state.player).toMatchObject({ gold: 0, apHalf: 6, uses: { respec: { day: 2 } } });
  });

  test('mastered abilities refund what they cost', () => {
    const profile = freshProfile({ classMastery: { ranger: { loopsPlayed: 1, mastered: ['rgr_rend'], endings: [], bestLevel: 3, bestDays: null } } });
    expect(run(learned(), [{ type: 'respec' }], profile).state.player.apHalf).toBe(5);
  });

  test('not away from a camp, not without gold, not with nothing to refund', () => {
    run(learned({ locationId: 'loc_shattered_library' }), [reject({ type: 'respec' }, 'only rethink your path at a camp fire')]);
    run(learned({ gold: 149 }), [reject({ type: 'respec' }, 'Rethinking your path costs 150 gold')]);
    run(st({ gold: 500 }), [reject({ type: 'respec' }, 'no ability points to refund')]);
  });
});

// ---- legalActions agreement ----------------------------------------------------------------------------------------------

const MINE: readonly ActionType[] = ['use', 'equip', 'unequip', 'drop', 'allocateStat', 'unlockAbility', 'readBook', 'respec'];

describe('legalActions for the inventory actions (PLAN §4.7)', () => {
  const rich = () =>
    st({
      level: 4,
      gold: 500,
      abilities: ['rgr_rend'],
      items: [
        { itemId: 'item_dark_spellbook', qty: 2 },
        'item_wildling_hide_armor',
        'item_glyphbound_lantern',
        'item_wizard_focus',
        'item_echo_crystal',
        'item_ember_flask',
        'mat_shadow_ash',
        'mat_shadow_ash',
      ],
      patch: (x) => void (x.player.apHalf = 6),
    });

  test('exactly the expected actions, each accepted by step', () => {
    const s = rich();
    const profile = freshProfile();
    const legal = legalActions(s, pack, profile).filter((a) => MINE.includes(a.type));
    const u = (id: string) => uidOf(s, id);
    expect(legal).toEqual([
      { type: 'allocateStat', stat: 'agility' },
      { type: 'allocateStat', stat: 'magic' },
      { type: 'allocateStat', stat: 'strength' },
      ...[
        { type: 'drop', uid: u('item_ley_touched_tonic') },
        { type: 'drop', uid: u('item_dark_spellbook') },
        { type: 'drop', uid: u('item_wildling_hide_armor') },
        { type: 'drop', uid: u('item_glyphbound_lantern') },
        { type: 'drop', uid: u('item_wizard_focus') },
        { type: 'drop', uid: u('item_ember_flask') },
        { type: 'drop', uid: u('mat_shadow_ash') },
      ].sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1)),
      { type: 'equip', slot: 'trinket1', uid: u('item_glyphbound_lantern') },
      { type: 'equip', slot: 'trinket2', uid: u('item_glyphbound_lantern') },
      { type: 'equip', uid: u('item_wildling_hide_armor') },
      { type: 'readBook', uid: u('item_dark_spellbook') },
      { type: 'respec' },
      { type: 'unequip', slot: 'weapon' },
      { type: 'unlockAbility', abilityId: 'rgr_marked_shot' },
      { type: 'unlockAbility', abilityId: 'rgr_piercing_arrow' },
      { type: 'use', uid: u('item_ley_touched_tonic') },
    ]);
    for (const action of legal) {
      expect(isLegal(s, action, pack, profile)).toBe(true);
      const out = step(s, action, pack, profile);
      expect(out.events.find((e) => e.t === 'actionRejected')).toBeUndefined();
    }
  });

  test('non-listed actions are rejected and not legal', () => {
    const s = rich();
    const profile = freshProfile();
    const u = (id: string) => uidOf(s, id);
    const illegal: Action[] = [
      { type: 'drop', uid: u('item_echo_crystal') },
      { type: 'equip', uid: u('item_wizard_focus') },
      { type: 'use', uid: u('item_dark_spellbook') },
      { type: 'use', uid: u('item_ember_flask') },
      { type: 'readBook', uid: u('item_ley_touched_tonic') },
      { type: 'unlockAbility', abilityId: 'wiz_fireball' },
      { type: 'unlockAbility', abilityId: 'rgr_rend' },
      { type: 'unequip', slot: 'armor' },
    ];
    for (const action of illegal) {
      expect(isLegal(s, action, pack, profile)).toBe(false);
      expect(step(s, action, pack, profile).events[0]!.t).toBe('actionRejected');
    }
  });

  test('nothing to offer: no points, nothing carried, nothing equipped, no gold', () => {
    const s = st({ gold: 0, patch: (x) => void Object.assign(x.player, { inventory: [], apHalf: 0, equipment: { weapon: null, armor: null, trinket1: null, trinket2: null } }) });
    expect(legalActions(s, pack, freshProfile()).filter((a) => MINE.includes(a.type))).toEqual([]);
  });
});
