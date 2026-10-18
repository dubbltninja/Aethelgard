// The economy (DESIGN §7.5, §9, §10.7 Kaelen's Ledger, §11.4 tier effects; WORLD §9; PLAN §8.1 "economy"; D-057,
// D-073, D-079, D-083). U34. Buying and selling, prices, stock and its restock; the Emberforge is reducers/crafting.ts.
//
// Where a merchant stands: a merchant is keyed by its NPC id and trades where that NPC stands (explore.ts `npcStandsAt`,
// so `npcOverrides` move it — Tamsin to the Library — or take it away, and an NPC `schedule` places it by condition:
// Tessaly's caravan at the Ironclad Camp, U34d), or, when the NPC is not listed there, at the location that names it in
// `merchantId` unless an override or a schedule puts the NPC elsewhere. Its *home* (for its band and for the Silverwood
// Before rule) is the location naming it in `merchantId`, else the NPC's home.
//
// Prices (DESIGN §9.2): buy = round(gold_value × region_markup × tier_mod × (1 − ledger) × the stock entry's priceMult)
// per unit, where gold_value includes rarity (gear's value scales like its stats, derived.ts `rarityScaled`) and the
// entry is the first core-stock entry for that item whose `when` holds now (Hollis's Void Shards ×2; none for theme
// picks and buy-back). tier_mod by the player's tier with the merchant's faction: Hostile refuses to trade, Wary ×1.15,
// Neutral ×1, Trusted ×0.90, Sworn ×0.80 (`config.tierPriceMult`); `repFaction: 'best'` (Kaelen) takes the best of the
// three tracks and never refuses (a best of Hostile prices as Wary); no faction (Fennick, Anso): ×1, never refuses.
// `refusesWhen` refuses too (Hollis). ledger = the Attunements' `shop_discount_pct` (Kaelen's Ledger 5 %, everywhere)
// + the Echo cuts of `ECHO_LEDGER` at their merchant (`echo_kaelen_ledger`: Kaelen 5 %), at most 10 % in all.
// Sell = floor(sellMult × gold_value) per unit (75 %, any tier; a refusing merchant buys nothing either); quest-bound and
// unsellable items cannot be sold. A purchase needs the gold and room in the pack (DESIGN §7.8).
//
// Stock (DESIGN §9.3–9.4, §11.4; WORLD §9.1–9.2): the core list — every entry whose `when` holds at the restock (rep-
// gated Trusted/Sworn gear, Loop 2+ lines), `count` units ('unlimited': a full stack, or one piece of gear, that a
// purchase never runs down) — plus `rollStock.pick` distinct theme-pool picks, which a Wary (or worse) standing hides
// ("core stock only"). Gear rolls its rarity by band weights in the merchant's home band (unless the entry names one or
// says `rollRarity: false`) and its affixes (rarity.ts). Items the player sells join the stock (buy-back) until the
// next restock. Stock draws use their own stream, `${seed}:${loop}:${merchant}:${day key}`, so a restock never moves the
// run's Rng and the same day always shows the same stall (`rollStock` deterministic by seed, PLAN §8.1).
// Restock (D-057): every dawn, for every merchant already met (DAWN_HOOKS `restockAtDawn`; several dawns in one step
// restock once, at the last); a merchant is met — and stocked — on the step the player arrives where it stands, or it
// arrives where the player stands (`economyPostStep`: `locationEntered` / `npcMoved`, or since U34d any step on which an
// NPC schedule has it standing here); selling to one not met yet stocks it first. Silverwood Before merchants (Anso)
// skip the Breach-Clock dawns: their dawn is each Before day and each Before reset — every `beforeDayAdvanced`
// (entering the echo too) restocks them, keyed by resets and Bell (D-083).
//
// Enumeration (PLAN §4.7): `buy` one per stock uid of each merchant here (qty 1); `sell` one per distinct item id (qty 1).
import type { Item } from '@schema/item';
import type { Merchant, StockEntry } from '@schema/merchant';
import { isBeforeLocation } from '../before';
import { FACTIONS, dayOf, evaluate, hasEcho, repTier, type RepTier } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { GEAR_SCRIPT, rarityScaled, scriptPassives } from '../derived';
import { addItem } from '../effects';
import type { Enumerator } from '../legalActions';
import { lootBand, rollAffixes, rollPiece, type Rolls } from '../rarity';
import { Rng } from '../rng';
import { attunementPct } from '../runRules';
import type { PostStepHook } from '../step';
import type { ActionOf } from '../types/actions';
import type { Profile } from '../types/profile';
import type { GameState, ItemInstance, MerchantState, Rarity } from '../types/state';
import { round } from '../util/math';
import { packRoom } from '../combat/rewards';
import { npcPlacement, npcStandsAt } from './explore';
import type { DawnHook } from './loop';

/** DESIGN §9.2: the ledger discount never exceeds 10 % (Attunement + Echo, additive). */
export const LEDGER_CAP = 0.1;
/**
 * DESIGN §9.2 / §10.5: Echo price cuts at one merchant (keyed by Echo; the engine reads them, content grants them).
 * `echo_kaelen_ledger` (STORY `q_blood_and_salt`): Kaelen's prices −5 % for good.
 */
export const ECHO_LEDGER: Readonly<Record<string, { merchantId: string; pct: number }>> = {
  echo_kaelen_ledger: { merchantId: 'npc_kaelen_stonehand', pct: 0.05 },
};
/** Tiers in order; a stock gate or price row compares ranks. */
export const TIER_RANK: Readonly<Record<RepTier, number>> = { hostile: 0, wary: 1, neutral: 2, trusted: 3, sworn: 4 };

type Pr = Readonly<Profile>;

const merchantName = (content: ContentPack, m: Merchant): string => content.npcs[m.npcId]?.name ?? m.name;
const copy = (i: ItemInstance): ItemInstance => ({ ...i, affixes: [...i.affixes] });

function needItem(content: ContentPack, itemId: string): Item {
  const def = content.items[itemId];
  if (!def) throw new Error(`economy: unknown item '${itemId}'`);
  return def;
}

// ---- where merchants stand ---------------------------------------------------------------------------------------------

/** The merchant's home location: the one naming it in `merchantId`, else its NPC's home. */
export function merchantHome(content: ContentPack, merchantId: string): string | undefined {
  for (const loc of Object.values(content.locations)) if (loc.merchantId === merchantId) return loc.id;
  const m = content.merchants[merchantId];
  return m ? content.npcs[m.npcId]?.homeLocationId : undefined;
}

/** Silverwood Before merchants (Anso) restock each Before day instead of each dawn (WORLD §9.1). */
export const isBeforeMerchant = (content: ContentPack, merchantId: string): boolean => {
  const home = merchantHome(content, merchantId);
  return home !== undefined && isBeforeLocation(content, home);
};

/** True while the merchant trades at the player's location (see the file header). */
export function merchantPresent(s: GameState, content: ContentPack, profile: Pr, merchantId: string): boolean {
  const m = content.merchants[merchantId];
  if (!m) return false;
  const here = s.world.currentLocationId;
  if (npcStandsAt(s, content, profile, m.npcId, here)) return true;
  // the stall's own location, unless an override or a schedule (U34d: Tessaly's caravan) puts the NPC somewhere
  return content.locations[here]?.merchantId === merchantId && npcPlacement(s, content, profile, m.npcId) === null;
}

/** The merchants trading where the player stands, by id. */
export function merchantsHere(s: GameState, content: ContentPack, profile: Pr): string[] {
  return Object.keys(content.merchants)
    .filter((id) => merchantPresent(s, content, profile, id))
    .sort();
}

// ---- standing and prices -----------------------------------------------------------------------------------------------

/** The tier that prices this merchant: its faction's, the best of three for 'best' (never below Wary); null = none. */
export function merchantTier(s: GameState, content: ContentPack, m: Merchant): RepTier | null {
  if (m.repFaction === undefined) return null;
  if (m.repFaction !== 'best') return repTier(s.reputation[m.repFaction], content);
  let best: RepTier = 'wary';
  for (const f of FACTIONS) {
    const t = repTier(s.reputation[f], content);
    if (TIER_RANK[t] > TIER_RANK[best]) best = t;
  }
  return best;
}

/** Why the merchant will not trade (a Hostile faction tier, `refusesWhen`), or null. Kaelen never refuses. */
export function merchantRefusal(s: GameState, content: ContentPack, profile: Pr, m: Merchant): string | null {
  const hostile = m.repFaction !== undefined && m.repFaction !== 'best' && merchantTier(s, content, m) === 'hostile';
  if (hostile || (m.refusesWhen !== undefined && evaluate(m.refusesWhen, s, profile, content))) {
    return `${merchantName(content, m)} will not trade with you`;
  }
  return null;
}

/** DESIGN §9.2 tier_mod (1 with no faction). */
export function tierPriceMult(s: GameState, content: ContentPack, m: Merchant): number {
  const tier = merchantTier(s, content, m);
  if (tier === null || tier === 'neutral') return 1;
  return content.config.tierPriceMult[tier === 'hostile' ? 'wary' : tier];
}

/** DESIGN §9.2 ledger_discount at this merchant: Kaelen's Ledger (Attunement) + Echo cuts here, at most 10 %. */
export function ledgerDiscount(s: GameState, content: ContentPack, profile: Pr, merchantId: string): number {
  let pct = attunementPct(s.player, content, 'shop_discount_pct');
  for (const [echo, cut] of Object.entries(ECHO_LEDGER)) if (cut.merchantId === merchantId && hasEcho(s, profile, echo)) pct += cut.pct;
  return Math.min(LEDGER_CAP, Math.max(0, pct));
}

/** DESIGN §7.2/§7.5: an item's gold_value at `rarity` — gear scales like its stats; other items have no rarity. */
export function goldValue(def: Item, rarity: Rarity, content: ContentPack): number {
  return def.slot === undefined ? def.value : rarityScaled(def.value, rarity, content.config.rarityStatMult);
}

/** The first core-stock entry for `itemId` whose `when` holds now (its priceMult, 'unlimited'); none for pool picks. */
export function stockEntryFor(s: GameState, content: ContentPack, profile: Pr, m: Merchant, itemId: string): StockEntry | undefined {
  return m.stock.find((e) => e.itemId === itemId && (e.when === undefined || evaluate(e.when, s, profile, content)));
}

/** DESIGN §9.2: the price of one unit of `inst` at this merchant. */
export function buyPrice(s: GameState, content: ContentPack, profile: Pr, m: Merchant, inst: ItemInstance): number {
  const def = needItem(content, inst.itemId);
  const entry = stockEntryFor(s, content, profile, m, inst.itemId);
  const ledger = ledgerDiscount(s, content, profile, m.id);
  return round(goldValue(def, inst.rarity, content) * m.regionMarkup * tierPriceMult(s, content, m) * (1 - ledger) * (entry?.priceMult ?? 1));
}

/** DESIGN §7.5: what this merchant pays for one unit (75 %, rounded down, whatever the tier). */
export function sellPrice(content: ContentPack, m: Merchant, inst: ItemInstance): number {
  return Math.floor(m.sellMult * goldValue(needItem(content, inst.itemId), inst.rarity, content));
}

// ---- gold ---------------------------------------------------------------------------------------------------------------

/** Pays `n` gold (the caller checked it is there): goldChanged and the spent counter. Nothing for 0. */
export function spendGold(ctx: StepCtx, n: number): void {
  if (n <= 0) return;
  const { player, counters } = ctx.s;
  player.gold -= n;
  counters.goldSpent += n;
  ctx.emit({ t: 'goldChanged', delta: -n, total: player.gold });
}

function earnGold(ctx: StepCtx, n: number): void {
  if (n <= 0) return;
  const { player, counters } = ctx.s;
  player.gold += n;
  counters.goldEarned += n;
  ctx.emit({ t: 'goldChanged', delta: n, total: player.gold });
}

// ---- stock ---------------------------------------------------------------------------------------------------------------

/** The restock key: the Breach-Clock day, or inside the Before its resets and Bell (the echo repeats its stalls). */
export function stockKey(s: GameState, content: ContentPack, merchantId: string): string {
  if (s.before !== null && isBeforeMerchant(content, merchantId)) return `before:${s.before.resets}:${s.before.day}`;
  return `day:${dayOf(s.clock.ticks)}`;
}

/** The stream a merchant's stock is drawn from (independent of the run's Rng). */
export const stockRng = (s: GameState, content: ContentPack, merchantId: string): Rng =>
  Rng.fromSeed(`${s.meta.seed}:${s.meta.loop}:${merchantId}:${stockKey(s, content, merchantId)}`);

/**
 * U34e (D-101; WORLD §7.10 `item_remnant_wax_seal`): the state a merchant's STOCK reads — while the player carries a
 * `remnant_wax_seal` naming this merchant, its faction's standing counts as `tiersHigher` tiers higher (the lower bound of
 * that tier); prices and refusal read the real standing. Unchanged (the same object) otherwise.
 */
export function stockView(s: GameState, content: ContentPack, merchantId: string): GameState {
  let view = s;
  for (const { params } of scriptPassives(s.player, content, GEAR_SCRIPT.remnantWaxSeal)) {
    const { faction, tiersHigher, merchants } = params;
    if (!FACTIONS.includes(faction as (typeof FACTIONS)[number]) || typeof tiersHigher !== 'number' || tiersHigher < 1) continue;
    if (Array.isArray(merchants) && !merchants.includes(merchantId)) continue;
    const f = faction as (typeof FACTIONS)[number];
    const t = content.config.repTiers;
    const floors: readonly number[] = [t.hostile, t.wary, t.neutral, t.trusted, t.sworn];
    const rank = TIER_RANK[repTier(view.reputation[f], content)];
    const floor = floors[Math.min(floors.length - 1, rank + tiersHigher)] ?? view.reputation[f];
    if (floor > view.reputation[f]) view = { ...view, reputation: { ...view.reputation, [f]: floor } };
  }
  return view;
}

/** True when the merchant shows its theme pool: no faction, or Neutral or better (WORLD §9.1: Wary sees core only). */
export function poolOpen(s: GameState, content: ContentPack, m: Merchant): boolean {
  const tier = merchantTier(s, content, m);
  return tier === null || TIER_RANK[tier] >= TIER_RANK.neutral;
}

/** Regenerates a merchant's stock now (see the file header); keeps its purchase count; `merchantRestocked`. */
export function restock(ctx: StepCtx, merchantId: string): void {
  const { s, content } = ctx;
  const view = stockView(s, content, merchantId); // U34e: the Remnant Wax Seal (stock only)
  const m = content.merchants[merchantId];
  if (!m) return; // a save from a build that had this merchant: nothing to stock
  const rolls: Rolls = { rng: stockRng(s, content, merchantId), content };
  const band = lootBand(content, merchantHome(content, merchantId) ?? s.world.currentLocationId, s.player.level);
  const stock: ItemInstance[] = [];
  const piece = (def: Item, rarity: Rarity, affixes: string[], qty = 1): void => {
    stock.push({ uid: ctx.uid('i'), itemId: def.id, qty, rarity, affixes });
  };
  const add = (def: Item, count: number, named: Rarity | undefined, roll: boolean): void => {
    if (def.stackable) {
      for (let left = count; left > 0; left -= def.maxStack) piece(def, def.fixedRarity, [...def.fixedAffixes], Math.min(left, def.maxStack));
      return;
    }
    for (let i = 0; i < count; i++) {
      if (named !== undefined) piece(def, named, rollAffixes(rolls, def, named));
      else if (roll) {
        const p = rollPiece(rolls, def, band);
        piece(def, p.rarity, p.affixes);
      } else piece(def, def.fixedRarity, [...def.fixedAffixes]);
    }
  };
  for (const entry of m.stock) {
    if (entry.when !== undefined && !evaluate(entry.when, view, ctx.profile, content)) continue;
    const def = needItem(content, entry.itemId);
    const count = entry.count === 'unlimited' ? (def.stackable ? def.maxStack : 1) : entry.count;
    add(def, count, entry.rarity, entry.rollRarity);
  }
  if (m.rollStock && poolOpen(view, content, m)) {
    const { pool, pick } = m.rollStock;
    const n = rolls.rng.int(pick.min, pick.max);
    for (const id of rolls.rng.shuffle(pool).slice(0, n)) add(needItem(content, id), 1, undefined, true);
  }
  const prev: MerchantState | undefined = s.merchants[merchantId];
  s.merchants[merchantId] = { stock, lastRestockDay: dayOf(s.clock.ticks), purchasesThisLoop: prev?.purchasesThisLoop ?? 0 };
  ctx.emit({ t: 'merchantRestocked', merchantId });
}

/** DAWN_HOOKS (D-057): every merchant already met restocks at the step's last dawn; the Before's keep their own days. */
export const restockAtDawn: DawnHook = (ctx, day) => {
  const { s, content } = ctx;
  if (day !== dayOf(s.clock.ticks)) return;
  for (const id of Object.keys(s.merchants).sort()) if (!isBeforeMerchant(content, id)) restock(ctx, id);
};

/**
 * Post-step hook: a Before day or reset (`beforeDayAdvanced`) restocks the Before's merchants already met; then, on a
 * step that brought the player and a merchant together (an arrival here, an NPC moved here), any merchant here with no
 * stock yet is met and stocked.
 */
export const economyPostStep: PostStepHook = (ctx) => {
  const { s, content } = ctx;
  if (s.before !== null && ctx.events.some((e) => e.t === 'beforeDayAdvanced')) {
    for (const id of Object.keys(s.merchants).sort()) if (isBeforeMerchant(content, id)) restock(ctx, id);
  }
  if (s.mode !== 'explore' && s.mode !== 'dialogue') return;
  const here = s.world.currentLocationId;
  const arrived = ctx.events.some((e) => (e.t === 'locationEntered' && e.locationId === here) || (e.t === 'npcMoved' && e.to === here));
  // U34d: an NPC schedule (Tessaly's caravan) brings its merchant with no arrival and no `npcMoved`: it is met as it comes
  const scheduledHere = (id: string): boolean => {
    const npcId = content.merchants[id]?.npcId;
    return npcId !== undefined && s.world.npcOverrides[npcId] === undefined && npcPlacement(s, content, ctx.profile, npcId) !== null;
  };
  for (const id of merchantsHere(s, content, ctx.profile)) if (s.merchants[id] === undefined && (arrived || scheduledHere(id))) restock(ctx, id);
};

// ---- checks (the reducer and the enumerator share them) -----------------------------------------------------------------

/** A merchant the player can trade with here for `service`, or why not. */
function tradingWith(s: GameState, content: ContentPack, profile: Pr, merchantId: string, service: 'buy' | 'sell'): Merchant | string {
  const m = content.merchants[merchantId];
  if (!m) return `There is no merchant '${merchantId}'`;
  if (!m.services.includes(service)) return `${merchantName(content, m)} does not ${service === 'buy' ? 'sell' : 'buy'} anything`;
  if (!merchantPresent(s, content, profile, merchantId)) return `${merchantName(content, m)} is not here`;
  return merchantRefusal(s, content, profile, m) ?? m;
}

export interface Deal {
  merchant: Merchant;
  inst: ItemInstance;
  def: Item;
  qty: number;
  unit: number;
  total: number;
}

const badQty = (qty: number, max: number): boolean => !Number.isInteger(qty) || qty < 1 || qty > max;

export function checkBuy(s: GameState, content: ContentPack, profile: Pr, a: ActionOf<'buy'>): Deal | string {
  const m = tradingWith(s, content, profile, a.merchantId, 'buy');
  if (typeof m === 'string') return m;
  const inst = s.merchants[m.id]?.stock.find((i) => i.uid === a.uid);
  if (!inst) return `${merchantName(content, m)} has no such item`;
  const def = needItem(content, inst.itemId);
  const qty = a.qty ?? 1;
  if (badQty(qty, inst.qty)) return `${merchantName(content, m)} has ${inst.qty} ${def.name}`;
  const unit = buyPrice(s, content, profile, m, inst);
  const total = unit * qty;
  if (s.player.gold < total) return `The ${def.name} costs ${total} gold; you have ${s.player.gold}`;
  if (packRoom(s, content, def, inst.rarity, qty) < qty) return 'Your pack is full';
  return { merchant: m, inst, def, qty, unit, total };
}

export function checkSell(s: GameState, content: ContentPack, profile: Pr, a: ActionOf<'sell'>): Deal | string {
  const m = tradingWith(s, content, profile, a.merchantId, 'sell');
  if (typeof m === 'string') return m;
  const inst = s.player.inventory.find((i) => i.uid === a.uid);
  if (!inst) return 'You are not carrying that';
  const def = needItem(content, inst.itemId);
  if (!def.sellable) return `${merchantName(content, m)} will not buy the ${def.name}`;
  if (inst.boundQuest !== undefined && s.quests[inst.boundQuest]?.status === 'active') return `${def.name} is bound to an active quest`;
  const qty = a.qty ?? 1;
  if (badQty(qty, inst.qty)) return `You have ${inst.qty} ${def.name}`;
  const unit = sellPrice(content, m, inst);
  return { merchant: m, inst, def, qty, unit, total: unit * qty };
}

// ---- reducers -------------------------------------------------------------------------------------------------------------

/** Buys (DESIGN §9.2): pays, moves the units into the pack (gear keeps its piece), an 'unlimited' line never runs down. */
export function buyHandler(ctx: StepCtx, a: ActionOf<'buy'>): void {
  const d = checkBuy(ctx.s, ctx.content, ctx.profile, a);
  if (typeof d === 'string') return ctx.reject(d);
  const { s, content } = ctx;
  const { merchant: m, inst, def, qty, total } = d;
  const state = s.merchants[m.id] as MerchantState;
  const unlimited = stockEntryFor(s, content, ctx.profile, m, def.id)?.count === 'unlimited';
  spendGold(ctx, total);
  if (def.stackable) {
    if (!unlimited) {
      inst.qty -= qty;
      if (inst.qty === 0) state.stock.splice(state.stock.indexOf(inst), 1);
    }
    addItem(ctx, def.id, qty, inst.rarity);
  } else {
    state.stock.splice(state.stock.indexOf(inst), 1);
    s.player.inventory.push(inst);
    if (unlimited) state.stock.push({ ...copy(inst), uid: ctx.uid('i') });
  }
  state.purchasesThisLoop += 1;
  ctx.emit({ t: 'purchased', itemId: def.id, price: total });
  ctx.log(`You buy ${def.name}${qty > 1 ? ` ×${qty}` : ''} for ${total} gold.`, 'event');
}

/** Sells (DESIGN §7.5): paid at once; the units join the merchant's stock for buy-back until its next restock. */
export function sellHandler(ctx: StepCtx, a: ActionOf<'sell'>): void {
  const d = checkSell(ctx.s, ctx.content, ctx.profile, a);
  if (typeof d === 'string') return ctx.reject(d);
  const { s } = ctx;
  const { merchant: m, inst, def, qty, total } = d;
  if (s.merchants[m.id] === undefined) restock(ctx, m.id);
  const stock = (s.merchants[m.id] as MerchantState).stock;
  const inventory = s.player.inventory;
  let sold: ItemInstance;
  if (qty === inst.qty) {
    inventory.splice(inventory.indexOf(inst), 1);
    sold = inst;
  } else {
    inst.qty -= qty;
    sold = { ...copy(inst), uid: ctx.uid('i'), qty };
  }
  const stack = def.stackable ? stock.find((i) => i.itemId === sold.itemId && i.rarity === sold.rarity && i.qty + sold.qty <= def.maxStack) : undefined;
  if (stack) stack.qty += sold.qty;
  else stock.push(sold);
  earnGold(ctx, total);
  ctx.emit({ t: 'itemLost', itemId: def.id, qty, reason: 'sold' });
  ctx.emit({ t: 'sold', itemId: def.id, price: total });
  ctx.log(`You sell ${def.name}${qty > 1 ? ` ×${qty}` : ''} for ${total} gold.`, 'event');
}

// ---- enumerators (PLAN §4.7) --------------------------------------------------------------------------------------------

export const buyEnumerator: Enumerator<'buy'> = (s, content, profile) => {
  const out: ActionOf<'buy'>[] = [];
  for (const merchantId of merchantsHere(s, content, profile)) {
    for (const inst of s.merchants[merchantId]?.stock ?? []) {
      const a: ActionOf<'buy'> = { type: 'buy', merchantId, uid: inst.uid };
      if (typeof checkBuy(s, content, profile, a) !== 'string') out.push(a);
    }
  }
  return out;
};

export const sellEnumerator: Enumerator<'sell'> = (s, content, profile) => {
  const out: ActionOf<'sell'>[] = [];
  for (const merchantId of merchantsHere(s, content, profile)) {
    const seen = new Set<string>();
    for (const inst of s.player.inventory) {
      if (seen.has(inst.itemId)) continue;
      const a: ActionOf<'sell'> = { type: 'sell', merchantId, uid: inst.uid };
      if (typeof checkSell(s, content, profile, a) === 'string') continue;
      seen.add(inst.itemId);
      out.push(a);
    }
  }
  return out;
};
