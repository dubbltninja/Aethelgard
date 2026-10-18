// U34: the economy — PLAN §8.1 row "economy" (buy price = value × markup × tier_mod × (1 − ledger), Hostile refuses,
// Kaelen's best tier, sell 75 %, restock at every dawn, buy-back until dawn, `rollStock` deterministic by seed), plus
// rep-gated and Wary stock, 'unlimited' and Loop 2+ lines, the priced-up line, Kaelen's Ledger (Attunement and Echo,
// capped at 10 %), Silverwood Before stalls restocking per Before day, `giveItem` rarity rolls (D-079), the `revive`
// item effect (D-080) and the poverty rule. DESIGN §7.2, §7.5, §9.2–9.6, §10.7, §11.4; WORLD §9; D-057, D-083.
import { describe, expect, test } from 'bun:test';
import {
  LEDGER_CAP,
  RARITY_ORDER,
  buyPrice,
  economyPostStep,
  goldValue,
  isLegal,
  ledgerDiscount,
  legalActions,
  makeCtx,
  merchantHome,
  merchantTier,
  merchantsHere,
  restock,
  sellPrice,
  step,
  stockRng,
  apply,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type ItemInstance,
  type Profile,
} from '@engine/index';
import { buildContentPack } from '@content/index';
import { MAX_AFFIXES } from '@schema/item';
import { clone } from '@engine/util/clone';
import { GARRET, WALKS, WALKS_HOUNDS } from '@tests/fixtures/beforeContent';
import { ANSO, BORIN, FORGE, KAELEN, RESPITE, RESPITE_INN, TAMSIN, beforeEconomyPack, economyPack, economyTables } from '@tests/fixtures/economyContent';
import { FIXTURE_VERSION } from '@tests/fixtures/miniContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { validateContent } from '@content/validate';

const pack = economyPack();
const PLAZA = 'loc_silverwood_plaza';

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);

interface Run {
  s: GameState;
  prof: Profile;
  last: Ev[];
  content: ContentPack;
}
const start = (o: StateOverrides = {}, content: ContentPack = pack, prof?: Profile): Run => {
  const profile = prof ?? freshProfile({ loopCounter: o.loop ?? 1 });
  return { s: makeState(o, { content, profile }), prof: profile, last: [], content };
};
function act(r: Run, action: Action): Run {
  const out = step(r.s, action, r.content, r.prof);
  const rejected = ofType(out.events, 'actionRejected')[0];
  if (rejected) throw new Error(`${JSON.stringify(action)} was rejected: ${rejected.reason}`);
  return { ...r, s: out.state, prof: out.profile, last: out.events };
}
const run = (r: Run, actions: readonly Action[]): Run => actions.reduce(act, r);
function refused(r: Run, action: Action): string {
  const out = step(r.s, action, r.content, r.prof);
  expect(out.state).toBe(r.s);
  return ofType(out.events, 'actionRejected')[0]?.reason ?? '(accepted)';
}
/** The way in to each stall (arriving is what meets a merchant). */
const FROM: Readonly<Record<string, string>> = { [FORGE]: RESPITE, [RESPITE]: FORGE, [PLAZA]: 'loc_shattered_library' };
/** Arrives at `locationId` from its neighbour (one watch), so the post-step hook stocks the merchant there. */
const at = (locationId: string, o: StateOverrides = {}, content: ContentPack = pack, prof?: Profile): Run =>
  act(start({ locationId: FROM[locationId], ...o }, content, prof), { type: 'move', to: locationId });
const stockOf = (r: Run, merchantId: string): ItemInstance[] => r.s.merchants[merchantId]?.stock ?? [];
const firstOf = (r: Run, merchantId: string, itemId: string): ItemInstance => {
  const inst = stockOf(r, merchantId).find((i) => i.itemId === itemId);
  if (!inst) throw new Error(`${merchantId} has no ${itemId}`);
  return inst;
};
const priceAt = (r: Run, merchantId: string, inst: Pick<ItemInstance, 'itemId' | 'rarity'>): number =>
  buyPrice(r.s, r.content, r.prof, r.content.merchants[merchantId]!, { uid: 'x', qty: 1, affixes: [], ...inst });
const glowMoss = { itemId: 'item_glow_moss', rarity: 'common' } as const;

describe('the fixture', () => {
  test('a forge station and two stalls; only the Echoes without a content source fail validation', () => {
    expect(pack.locations[FORGE]?.craftingStation).toBe('forge');
    expect(Object.keys(pack.merchants).sort()).toEqual([BORIN, KAELEN, TAMSIN]);
    expect(validateContent(pack).errors.map((e) => `${e.rule} ${e.id}`)).toEqual([
      'rule-16 echo_anchor_schema',
      'rule-16 echo_borin_oath',
      'rule-16 echo_kaelen_ledger',
    ]);
  });
});

describe('buy price = value × markup × tier_mod × (1 − ledger) (DESIGN §9.2)', () => {
  test('tier_mod by the merchant faction: Wary ×1.15, Neutral ×1, Trusted ×0.90, Sworn ×0.80', () => {
    const price = (ironclad: number) => priceAt(at(FORGE, { reputation: { ironclad } }), BORIN, glowMoss);
    expect([price(-20), price(0), price(20), price(60)]).toEqual([12, 10, 9, 8]); // 11.5 rounds half up
  });

  test('gold_value includes rarity (gear scales like its stats); the region markup multiplies (Anso ×1.2)', () => {
    const r = at(FORGE);
    const sword = pack.items.item_warriors_sword!;
    expect(RARITY_ORDER.map((rarity) => goldValue(sword, rarity, pack))).toEqual([40, 44, 50, 60, 70]);
    expect(priceAt(r, BORIN, { itemId: 'item_warriors_sword', rarity: 'rare' })).toBe(50);
    const before = beforeEconomyPack();
    const s = makeState({ locationId: WALKS }, { content: before });
    expect(buyPrice(s, before, freshProfile(), before.merchants[ANSO]!, { uid: 'x', qty: 1, affixes: [], ...glowMoss })).toBe(12);
  });

  test("a stock entry's priceMult (WORLD's expensive Void Shards, ×2)", () => {
    const r = at(FORGE);
    expect(priceAt(r, BORIN, { itemId: 'item_void_shard', rarity: 'common' })).toBe(40);
    const shard = firstOf(r, BORIN, 'item_void_shard');
    const out = act({ ...r, s: { ...clone(r.s), player: { ...clone(r.s.player), gold: 100 } } }, { type: 'buy', merchantId: BORIN, uid: shard.uid, qty: 2 });
    expect(out.s.player.gold).toBe(20);
    expect(ofType(out.last, 'purchased')).toEqual([{ t: 'purchased', itemId: 'item_void_shard', price: 80 }]);
  });

  test("Kaelen's Ledger: −5 % everywhere; echo_kaelen_ledger −5 % more at Kaelen only; never above 10 %", () => {
    const ledger = { patch: (s: GameState) => void (s.player.attunements = ['att_kaelens_ledger']) };
    const bloom = { itemId: 'item_mana_bloom', rarity: 'common' } as const;
    const plain = at(RESPITE);
    expect(priceAt(plain, KAELEN, bloom)).toBe(25);
    const att = at(RESPITE, ledger);
    expect(priceAt(att, KAELEN, bloom)).toBe(24); // 23.75
    expect(priceAt(at(FORGE, ledger), BORIN, { itemId: 'item_ember_flask', rarity: 'common' })).toBe(14); // 15 × 0.95 = 14.25
    const echoed = freshProfile({ echoes: ['echo_kaelen_ledger'] });
    expect(priceAt(at(RESPITE, {}, pack, echoed), KAELEN, bloom)).toBe(24);
    expect(ledgerDiscount(at(FORGE, {}, pack, echoed).s, pack, echoed, BORIN)).toBe(0);
    const both = at(RESPITE, ledger, pack, echoed);
    expect(ledgerDiscount(both.s, pack, echoed, KAELEN)).toBeCloseTo(0.1);
    expect(priceAt(both, KAELEN, bloom)).toBe(23); // 22.5
    // a richer (fixture) ledger still stops at the cap
    const tables = economyTables();
    const rich = buildContentPack(
      { ...tables, attunements: [...tables.attunements, { id: 'att_fixture_haggler', name: 'Haggler', description: 'Fixture.', cost: 5, icon: 'coin', effects: [{ kind: 'shop_discount_pct', pct: 0.2 }] }] },
      { version: FIXTURE_VERSION, validate: false },
    );
    const s = makeState({ locationId: RESPITE, patch: (st) => void (st.player.attunements = ['att_kaelens_ledger', 'att_fixture_haggler']) }, { content: rich });
    expect(ledgerDiscount(s, rich, echoed, KAELEN)).toBe(LEDGER_CAP);
  });
});

describe('standing (DESIGN §9.2, §11.4)', () => {
  test('Hostile refuses: no buying, no selling, nothing enumerated', () => {
    const r = at(FORGE, { reputation: { ironclad: -40 }, gold: 100, items: ['item_glow_moss'] });
    const moss = firstOf(r, BORIN, 'item_glow_moss');
    expect(refused(r, { type: 'buy', merchantId: BORIN, uid: moss.uid })).toBe('Borin Stonefist will not trade with you');
    const mine = r.s.player.inventory.find((i) => i.itemId === 'item_glow_moss')!;
    expect(refused(r, { type: 'sell', merchantId: BORIN, uid: mine.uid })).toBe('Borin Stonefist will not trade with you');
    expect(legalActions(r.s, pack, r.prof).filter((a) => a.type === 'buy' || a.type === 'sell')).toEqual([]);
  });

  test("Kaelen takes the best of the three tiers and never refuses (a best of Hostile prices as Wary)", () => {
    const tier = (reputation: StateOverrides['reputation']) => {
      const r = at(RESPITE, { reputation });
      return [merchantTier(r.s, pack, pack.merchants[KAELEN]!), priceAt(r, KAELEN, glowMoss)];
    };
    expect(tier({ remnants: 60, weavers: -50, ironclad: 0 })).toEqual(['sworn', 8]);
    expect(tier({ remnants: -10, weavers: 25, ironclad: -45 })).toEqual(['trusted', 9]);
    expect(tier({ remnants: -60, weavers: -60, ironclad: -60 })).toEqual(['wary', 12]);
    const hostile = at(RESPITE, { reputation: { remnants: -60, weavers: -60, ironclad: -60 }, gold: 50 });
    const moss = firstOf(hostile, KAELEN, 'item_glow_moss');
    expect(act(hostile, { type: 'buy', merchantId: KAELEN, uid: moss.uid }).s.player.gold).toBe(38);
  });

  test('Wary sees core stock only; Trusted adds the faction Rare piece (WORLD §9.1, rep-gated stock)', () => {
    const wary = at(FORGE, { reputation: { ironclad: -20 } });
    expect(stockOf(wary, BORIN).map((i) => i.itemId)).toEqual(['mat_iron_rivet', 'item_glow_moss', 'item_ember_flask', 'item_void_shard']);
    const neutral = at(FORGE);
    expect(stockOf(neutral, BORIN).length).toBeGreaterThanOrEqual(4 + 3);
    expect(stockOf(neutral, BORIN).some((i) => i.itemId === 'item_ironclad_mail' && i.rarity === 'rare' && i.uid === stockOf(neutral, BORIN)[4]?.uid)).toBe(false);
    const trusted = at(FORGE, { reputation: { ironclad: 20 } });
    const mail = stockOf(trusted, BORIN)[4]!;
    expect(mail).toMatchObject({ itemId: 'item_ironclad_mail', rarity: 'rare' });
    expect(mail.affixes).toHaveLength(MAX_AFFIXES.rare);
  });

  test('a Loop 2+ line (Kaelen’s heartwood offcut, D-067.6) and a theme pool of 3–4 picks', () => {
    const loop1 = at(RESPITE);
    expect(stockOf(loop1, KAELEN).some((i) => i.itemId === 'mat_silverwood_heartwood')).toBe(false);
    const loop2 = at(RESPITE, { loop: 2 });
    expect(firstOf(loop2, KAELEN, 'mat_silverwood_heartwood').qty).toBe(1);
    const core = new Set<string>(pack.merchants[KAELEN]!.stock.map((e) => e.itemId));
    const picks = stockOf(loop1, KAELEN).filter((i) => !core.has(i.itemId));
    expect(picks.length).toBeGreaterThanOrEqual(3);
    expect(picks.length).toBeLessThanOrEqual(4);
    expect(new Set(picks.map((i) => i.itemId)).size).toBe(picks.length);
  });
});

describe('buying and selling', () => {
  test('a purchase pays, moves the units, counts; the pack and the purse must allow it', () => {
    const r = at(RESPITE, { gold: 30 });
    const tonic = firstOf(r, KAELEN, 'item_ley_touched_tonic');
    const out = act(r, { type: 'buy', merchantId: KAELEN, uid: tonic.uid, qty: 2 });
    expect(out.s.player.gold).toBe(6);
    expect(firstOf(out, KAELEN, 'item_ley_touched_tonic').qty).toBe(1);
    expect(out.s.player.inventory.filter((i) => i.itemId === 'item_ley_touched_tonic').reduce((n, i) => n + i.qty, 0)).toBe(2 + 2); // + the Ranger's two
    expect(out.s.merchants[KAELEN]?.purchasesThisLoop).toBe(1);
    expect(out.s.counters.goldSpent).toBe(24);
    expect(ofType(out.last, 'goldChanged')).toEqual([{ t: 'goldChanged', delta: -24, total: 6 }]);
    expect(refused(out, { type: 'buy', merchantId: KAELEN, uid: tonic.uid, qty: 2 })).toBe('Kaelen Stonehand has 1 Ley-Touched Tonic');
    expect(refused(out, { type: 'buy', merchantId: KAELEN, uid: firstOf(out, KAELEN, 'item_mana_bloom').uid })).toBe('The Mana Bloom costs 25 gold; you have 6');
    expect(refused(out, { type: 'buy', merchantId: KAELEN, uid: 'i9999' })).toBe('Kaelen Stonehand has no such item');
    expect(refused(out, { type: 'buy', merchantId: BORIN, uid: tonic.uid })).toBe('Borin Stonefist is not here');
    expect(refused(out, { type: 'buy', merchantId: 'npc_nobody', uid: tonic.uid })).toBe("There is no merchant 'npc_nobody'");
    const full = at(RESPITE, { gold: 500, patch: (s) => void (s.player.inventory = Array.from({ length: 40 }, (_, i) => ({ uid: `f${i}`, itemId: 'item_rusty_dagger', qty: 1, rarity: 'common' as const, affixes: [] }))) });
    const gear = stockOf(full, KAELEN).find((i) => !pack.items[i.itemId]!.stackable)!;
    expect(refused(full, { type: 'buy', merchantId: KAELEN, uid: gear.uid })).toBe('Your pack is full');
  });

  test('gear keeps its piece; an unlimited line never runs down', () => {
    const r = at(RESPITE, { gold: 500 });
    const gear = stockOf(r, KAELEN).find((i) => !pack.items[i.itemId]!.stackable)!;
    const out = act(r, { type: 'buy', merchantId: KAELEN, uid: gear.uid });
    expect(out.s.player.inventory.at(-1)).toEqual(gear);
    expect(stockOf(out, KAELEN).some((i) => i.uid === gear.uid)).toBe(false);
    const resin = firstOf(r, KAELEN, 'mat_ley_resin');
    expect(resin.qty).toBe(99);
    const bought = act(r, { type: 'buy', merchantId: KAELEN, uid: resin.uid, qty: 10 });
    expect(firstOf(bought, KAELEN, 'mat_ley_resin').qty).toBe(99);
    expect(bought.s.player.gold).toBe(450);
  });

  test('sell 75 % (rounded down, any tier); quest relics and bound items are refused', () => {
    const r = at(FORGE, { reputation: { ironclad: 60 }, items: [{ itemId: 'item_warriors_sword', rarity: 'rare' }, 'item_echo_crystal', { itemId: 'item_glow_moss', qty: 3 }] });
    const sword = r.s.player.inventory.find((i) => i.itemId === 'item_warriors_sword')!;
    expect(sellPrice(pack, pack.merchants[BORIN]!, sword)).toBe(37); // floor(0.75 × 50)
    const out = act(r, { type: 'sell', merchantId: BORIN, uid: sword.uid });
    expect(out.s.player.gold - r.s.player.gold).toBe(37);
    expect(ofType(out.last, 'sold')).toEqual([{ t: 'sold', itemId: 'item_warriors_sword', price: 37 }]);
    expect(ofType(out.last, 'itemLost')).toEqual([{ t: 'itemLost', itemId: 'item_warriors_sword', qty: 1, reason: 'sold' }]);
    const moss = r.s.player.inventory.find((i) => i.itemId === 'item_glow_moss')!;
    const two = act(r, { type: 'sell', merchantId: BORIN, uid: moss.uid, qty: 2 });
    expect(two.s.player.gold - r.s.player.gold).toBe(14);
    expect(two.s.player.inventory.find((i) => i.uid === moss.uid)?.qty).toBe(1);
    const crystal = r.s.player.inventory.find((i) => i.itemId === 'item_echo_crystal')!;
    expect(refused(r, { type: 'sell', merchantId: BORIN, uid: crystal.uid })).toBe('Borin Stonefist will not buy the Echo Crystal');
    const bound = at(FORGE, { quests: { q_echo_crystal: 'find_crystal' }, items: ['item_warriors_sword'] });
    const s = clone(bound.s);
    s.player.inventory.at(-1)!.boundQuest = 'q_echo_crystal';
    expect(refused({ ...bound, s }, { type: 'sell', merchantId: BORIN, uid: s.player.inventory.at(-1)!.uid })).toBe("Warrior's Sword is bound to an active quest");
    expect(refused(r, { type: 'sell', merchantId: BORIN, uid: moss.uid, qty: 4 })).toBe('You have 3 Glow Moss');
    expect(refused(r, { type: 'sell', merchantId: BORIN, uid: 'i9999' })).toBe('You are not carrying that');
  });

  test('buy-back until dawn: what you sold stays in that stall until its next restock', () => {
    const r = at(RESPITE, { gold: 20, items: [{ itemId: 'item_warriors_sword', rarity: 'rare' }, { itemId: 'item_glow_moss', qty: 2 }] });
    const sword = r.s.player.inventory.find((i) => i.itemId === 'item_warriors_sword')!;
    const moss = r.s.player.inventory.find((i) => i.itemId === 'item_glow_moss')!;
    const sold = run(r, [{ type: 'sell', merchantId: KAELEN, uid: sword.uid }, { type: 'sell', merchantId: KAELEN, uid: moss.uid, qty: 2 }]);
    expect(stockOf(sold, KAELEN).find((i) => i.uid === sword.uid)).toEqual(sword);
    expect(firstOf(sold, KAELEN, 'item_glow_moss').qty).toBe(5); // merged into the core stack
    const back = act(sold, { type: 'buy', merchantId: KAELEN, uid: sword.uid });
    expect(back.s.player.inventory.some((i) => i.uid === sword.uid)).toBe(true);
    expect(back.s.player.gold).toBe(20 + 37 + 14 - 50);
    const slept = act(sold, { type: 'rest', kind: 'full' });
    expect(stockOf(slept, KAELEN).some((i) => i.uid === sword.uid)).toBe(false);
    expect(firstOf(slept, KAELEN, 'item_glow_moss').qty).toBe(3);
  });

  test('a merchant is met by arriving (or by it arriving): standing about does not stock it', () => {
    const idle = act(start({ locationId: FORGE }), { type: 'examine', target: { kind: 'location' } });
    expect(idle.s.merchants[BORIN]).toBeUndefined();
    const ctx = makeCtx(clone(idle.s), idle.prof, pack);
    ctx.emit({ t: 'npcMoved', npcId: BORIN, to: FORGE });
    economyPostStep(ctx);
    expect(ofType(ctx.events, 'merchantRestocked')).toEqual([{ t: 'merchantRestocked', merchantId: BORIN }]);
  });

  test('selling to a stall not met yet stocks it first', () => {
    const r = start({ locationId: FORGE, items: ['item_warriors_sword'] });
    expect(r.s.merchants[BORIN]).toBeUndefined();
    const out = act(r, { type: 'sell', merchantId: BORIN, uid: r.s.player.inventory.at(-1)!.uid });
    expect(stockOf(out, BORIN).at(-1)?.itemId).toBe('item_warriors_sword');
  });
});

describe('restock (D-057, DESIGN §9.3)', () => {
  test('a stall is stocked when first met and restocked at every dawn: core refilled, picks re-rolled, the run Rng untouched', () => {
    const r = at(RESPITE, { gold: 100 });
    expect(r.s.rng).toEqual(start({ locationId: RESPITE }).s.rng);
    expect(ofType(r.last, 'merchantRestocked')).toEqual([{ t: 'merchantRestocked', merchantId: KAELEN }]);
    expect(r.s.merchants[KAELEN]?.lastRestockDay).toBe(1);
    const moss = firstOf(r, KAELEN, 'item_glow_moss');
    const bought = act(r, { type: 'buy', merchantId: KAELEN, uid: moss.uid, qty: 3 });
    expect(stockOf(bought, KAELEN).some((i) => i.itemId === 'item_glow_moss')).toBe(false);
    const slept = act(bought, { type: 'rest', kind: 'full' });
    expect(slept.s.player.gold).toBe(100 - 30 - RESPITE_INN);
    expect(ofType(slept.last, 'merchantRestocked')).toEqual([{ t: 'merchantRestocked', merchantId: KAELEN }]);
    expect(slept.s.merchants[KAELEN]).toMatchObject({ lastRestockDay: 2, purchasesThisLoop: 1 });
    expect(firstOf(slept, KAELEN, 'item_glow_moss').qty).toBe(3);
  });

  test('every stall already met restocks at dawn, wherever the Wayfinder sleeps; several dawns restock once', () => {
    const r = run(at(FORGE, { gold: 100 }), [{ type: 'move', to: RESPITE }]);
    expect(Object.keys(r.s.merchants).sort()).toEqual([BORIN, KAELEN]);
    const slept = act(r, { type: 'rest', kind: 'full' });
    expect(ofType(slept.last, 'merchantRestocked').map((e) => e.merchantId)).toEqual([BORIN, KAELEN]);
    expect(slept.s.merchants[BORIN]?.lastRestockDay).toBe(2);
    const ctx = makeCtx(clone(slept.s), slept.prof, pack);
    ctx.s.clock.ticks += 8; // two dawns crossed in one step (the dawn hooks run per dayAdvanced)
    restock(ctx, BORIN);
    expect(ctx.s.merchants[BORIN]?.lastRestockDay).toBe(4);
  });

  test('rollStock is deterministic by seed and day: same seed, same stall; another seed or day, another draw', () => {
    const pick = (seed: string, day = 1) => stockOf(at(FORGE, { seed, day }), BORIN).map((i) => `${i.itemId}:${i.rarity}:${i.affixes.join('+')}`);
    expect(pick('alpha')).toEqual(pick('alpha'));
    const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map((s) => pick(s).join('|'));
    expect(new Set(seeds).size).toBeGreaterThan(1);
    const days = [1, 2, 3, 4, 5].map((d) => pick('alpha', d).join('|'));
    expect(new Set(days).size).toBeGreaterThan(1);
    const s = at(FORGE, { seed: 'alpha' }).s;
    expect(stockRng(s, pack, BORIN).state()).toEqual(stockRng(clone(s), pack, BORIN).state());
  });

  test('Silverwood Before stalls restock each Before day and each reset, not at the Breach-Clock dawns (D-083)', () => {
    const before = beforeEconomyPack();
    const NEXUS = 'loc_chronos_nexus';
    const cleared = (st: GameState) =>
      void (st.world.locationStates[NEXUS] = {
        visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: ['enc_nexus_aberration'], encounterClearedDay: {},
        eventsFired: [], flags: {}, unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
      });
    const enter = run(start({ loop: 2, locationId: NEXUS, patch: cleared }, before), [{ type: 'move', to: 'loc_silver_gate' }, { type: 'move', to: WALKS }]);
    const day1 = stockOf(enter, ANSO);
    expect(day1.length).toBeGreaterThan(0);
    const bell2 = run(enter, [{ type: 'move', to: GARRET }, { type: 'rest', kind: 'full' }]);
    expect(ofType(bell2.last, 'beforeDayAdvanced')).toEqual([{ t: 'beforeDayAdvanced', day: 2, resets: 0 }]);
    expect(ofType(bell2.last, 'merchantRestocked')).toEqual([{ t: 'merchantRestocked', merchantId: ANSO }]);
    expect(stockOf(bell2, ANSO).map((i) => i.uid)).not.toEqual(day1.map((i) => i.uid));
    // leaving takes a Breach-Clock dawn: no restock for the Before stall
    const calm = clone(bell2.s);
    calm.world.locationStates[WALKS]!.encountersCleared.push(WALKS_HOUNDS); // Second Bell's hounds, beaten
    const left = run({ ...bell2, s: calm }, [{ type: 'move', to: WALKS }, { type: 'move', to: 'loc_silver_gate' }, { type: 'move', to: NEXUS }]);
    expect(ofType(left.last, 'dayAdvanced')).toHaveLength(1);
    expect(ofType(left.last, 'merchantRestocked')).toEqual([]);
    // coming back is a fresh echo at First Bell: the same stall as the first First Bell
    const again = run(left, [{ type: 'move', to: 'loc_silver_gate' }]);
    expect(ofType(again.last, 'merchantRestocked')).toEqual([{ t: 'merchantRestocked', merchantId: ANSO }]);
    const sig = (stock: ItemInstance[]) => stock.map((i) => `${i.itemId}:${i.rarity}:${i.qty}`);
    expect(sig(stockOf(again, ANSO))).toEqual(sig(day1));
  });
});

describe('enumeration (PLAN §4.7)', () => {
  test('buy: one per stock uid of each merchant here; sell: one per distinct item id; every listed action is accepted', () => {
    const r = at(RESPITE, { gold: 1000, items: [{ itemId: 'item_glow_moss', qty: 2 }, 'item_rusty_dagger', 'item_rusty_dagger', 'item_echo_crystal'] });
    const legal = legalActions(r.s, pack, r.prof);
    const buys = legal.filter((a) => a.type === 'buy');
    expect(buys.length).toBe(stockOf(r, KAELEN).length);
    const sells = legal.filter((a): a is Extract<Action, { type: 'sell' }> => a.type === 'sell');
    const ids = sells.map((a) => r.s.player.inventory.find((i) => i.uid === a.uid)!.itemId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('item_echo_crystal');
    expect(ids).toContain('item_rusty_dagger');
    for (const a of [...buys, ...sells]) {
      expect(isLegal(r.s, a, pack, r.prof)).toBe(true);
      expect(ofType(step(r.s, a, pack, r.prof).events, 'actionRejected')).toEqual([]);
    }
    expect(legalActions(start({ locationId: 'loc_whispering_ruins' }).s, pack, freshProfile()).filter((a) => a.type === 'buy' || a.type === 'sell')).toEqual([]);
  });

  test('a merchant moved away by an override does not trade at home; one moved in does', () => {
    const r = at(PLAZA);
    expect(r.s.merchants[TAMSIN]).toBeDefined();
    const moved = clone(r.s);
    moved.world.npcOverrides[TAMSIN] = { location: 'loc_shattered_library' };
    expect(legalActions(moved, pack, r.prof).filter((a) => a.type === 'buy')).toEqual([]);
    moved.world.currentLocationId = 'loc_shattered_library';
    expect(legalActions(moved, pack, r.prof).filter((a) => a.type === 'buy').length).toBeGreaterThan(0);
  });
});

describe('giveItem rolls rarity for rollable gear (D-079)', () => {
  test('each piece draws its rarity in the band where the Wayfinder stands, then its affixes; a named rarity draws nothing', () => {
    const s = makeState({ locationId: 'loc_chronos_nexus', seed: 'rolls' }, { content: pack });
    const ctx = makeCtx(clone(s), freshProfile(), pack);
    apply({ giveItem: { item: 'item_warriors_sword', count: 6 } }, ctx, { source: 'quest:q_x' });
    const swords = ctx.s.player.inventory.filter((i) => i.itemId === 'item_warriors_sword');
    expect(swords).toHaveLength(6);
    expect(ofType(ctx.events, 'itemGiven').map((e) => [e.item.uid, e.source])).toEqual(swords.map((i) => [i.uid, 'quest:q_x']));
    for (const sword of swords) expect(sword.affixes.length).toBeLessThanOrEqual(MAX_AFFIXES[sword.rarity]);
    expect(new Set(swords.map((i) => i.rarity)).size).toBeGreaterThan(1);
    expect(ctx.rng.state()).not.toEqual(s.rng);
    const named = makeCtx(clone(s), freshProfile(), pack);
    apply({ giveItem: { item: 'item_warriors_sword', rarity: 'epic' } }, named);
    expect(named.s.player.inventory.at(-1)).toMatchObject({ rarity: 'epic', affixes: [] });
    expect(named.rng.state()).toEqual(s.rng);
    const fixed = makeCtx(clone(s), freshProfile(), pack);
    apply({ giveItem: { item: 'item_heartstone_core' } }, fixed);
    expect(fixed.s.player.inventory.at(-1)).toMatchObject({ rarity: 'common', affixes: [] });
    expect(fixed.rng.state()).toEqual(s.rng);
  });
});

describe('the revive effect (D-080: Lanternreed Salts)', () => {
  test('out of a fight the knocked-out companion comes round at 30 %', () => {
    const r = start({
      locationId: RESPITE,
      items: ['item_lanternreed_salts'],
      patch: (s) =>
        void (s.companions = {
          activeId: 'ilyra',
          recruited: { ilyra: { id: 'ilyra', recruited: true, loyalty: 0, hp: 0, hpMax: 80, ko: true, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} } },
        }),
    });
    const salts = r.s.player.inventory.at(-1)!;
    const out = act(r, { type: 'use', uid: salts.uid });
    expect(out.s.companions.recruited.ilyra).toMatchObject({ ko: false });
    expect(out.s.companions.recruited.ilyra!.hp).toBe(Math.round(out.s.companions.recruited.ilyra!.hpMax * 0.3));
    expect(out.s.player.inventory.some((i) => i.uid === salts.uid)).toBe(false);
  });
});

describe('the revive effect in a fight', () => {
  test('the downed companion stands again at 30 % of its max HP, statuses cleared; with no one down, a line', () => {
    const ilyra = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {} };
    const s = makeState({ locationId: 'loc_shattered_library', patch: (st) => void (st.companions = { activeId: 'ilyra', recruited: { ilyra } }) }, { content: pack });
    const ctx = makeCtx(clone(s), freshProfile(), pack);
    apply({ startCombat: 'enc_library_shades' }, ctx);
    const comp = ctx.s.combat!.party.find((c) => c.kind === 'companion')!;
    Object.assign(comp, { alive: false, hp: 0, statuses: [{ statusId: 'status_bleed', stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false }] });
    apply({ revive: 0.3 }, ctx, { source: 'item:item_lanternreed_salts' });
    expect(comp).toMatchObject({ alive: true, hp: Math.round(comp.hpMax * 0.3), statuses: [] });
    expect(ofType(ctx.events, 'healed').at(-1)).toMatchObject({ targetUid: comp.uid, source: 'item:item_lanternreed_salts' });
    const logged = ctx.events.length;
    apply({ revive: 0.3 }, ctx);
    expect(ofType(ctx.events.slice(logged), 'log').map((e) => e.text)).toEqual(['No one here needs bringing round.']);
  });
});

describe('where a merchant stands', () => {
  test("its home is the location naming it, else its NPC's home; an NPC listed there trades without the location naming it", () => {
    expect(merchantHome(pack, KAELEN)).toBe(RESPITE);
    expect(merchantHome(pack, 'npc_nobody')).toBeUndefined();
    const tables = economyTables();
    const loose = buildContentPack(
      { ...tables, locations: tables.locations.map((l) => (l.id === RESPITE ? { ...clone(l), merchantId: undefined } : l)) },
      { version: FIXTURE_VERSION, validate: false },
    );
    expect(merchantHome(loose, KAELEN)).toBe(RESPITE);
    const r = at(RESPITE, {}, loose);
    expect(stockOf(r, KAELEN).length).toBeGreaterThan(0);
  });

  test('U34d (D-098 item 1): an NPC schedule moves the stall — away from home while it holds, met (and stocked) where it comes', () => {
    const GLOWLANDS = 'loc_veridian_glowlands';
    const tables = economyTables();
    // Tamsin's stall goes out to the Glowlands at night (a caravan's shape: no arrival, no npcMoved)
    const caravan = buildContentPack(
      { ...tables, npcs: tables.npcs.map((n) => (n.id === TAMSIN ? { ...clone(n), schedule: [{ when: { watch: 'night' }, at: [GLOWLANDS] }] } : n)) },
      { version: FIXTURE_VERSION, validate: false }, // the fixture's Echoes without a content source (see 'the fixture')
    );
    const buys = (r: Run) => legalActions(r.s, caravan, r.prof).filter((a) => a.type === 'buy');
    const dusk = start({ locationId: GLOWLANDS, watch: 2 }, caravan);
    expect([merchantsHere(dusk.s, caravan, dusk.prof), dusk.s.merchants[TAMSIN]]).toEqual([[], undefined]);
    const night = act(dusk, { type: 'wait' });
    expect(merchantsHere(night.s, caravan, night.prof)).toEqual([TAMSIN]);
    expect(ofType(night.last, 'merchantRestocked')).toEqual([{ t: 'merchantRestocked', merchantId: TAMSIN }]);
    expect(buys(night).length).toBeGreaterThan(0);
    // her own stall is empty at night and open by day
    expect(merchantsHere(start({ locationId: PLAZA, watch: 3 }, caravan).s, caravan, freshProfile())).toEqual([]);
    expect(merchantsHere(start({ locationId: PLAZA, watch: 1 }, caravan).s, caravan, freshProfile())).toEqual([TAMSIN]);
    expect(refused({ ...night, s: { ...night.s, world: { ...night.s.world, currentLocationId: PLAZA } } }, { type: 'buy', merchantId: TAMSIN, uid: stockOf(night, TAMSIN)[0]!.uid })).toContain('is not here');
  });
});

describe('never soft-locked by poverty (DESIGN §9.6)', () => {
  test('penniless and Hostile everywhere: Kaelen still buys at 75 %, and Glow Moss is two kills away at every band', () => {
    const r = at(RESPITE, { gold: 0, reputation: { remnants: -100, weavers: -100, ironclad: -100 }, items: ['item_rusty_dagger'] });
    const dagger = r.s.player.inventory.at(-1)!;
    const out = act(r, { type: 'sell', merchantId: KAELEN, uid: dagger.uid });
    expect(out.s.player.gold).toBe(6); // floor(0.75 × 8)
    const neutral = at(RESPITE, { gold: 0 });
    const moss = priceAt(neutral, KAELEN, glowMoss);
    for (let level = 1; level <= 20; level++) expect(2 * (3 + 2 * level)).toBeGreaterThanOrEqual(moss);
    expect(out.s.player.gold).toBeGreaterThanOrEqual(0);
  });
});
