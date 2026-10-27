// What the Merchant panel draws (PLAN §6.3 `MerchantPanel`, DESIGN §7.5, §9, §16.3 `screen_merchant`): who trades here, how
// they price you (the standing with their people as a percent, Kaelen's Ledger and the Echo cuts), their stock to buy and
// your pack to sell, and for the chosen line the unit price, the quantity and the total, with the engine's reason when it
// cannot be done (not enough gold, a full pack, a bound item). A merchant who refuses says so and shows no stall. Prices are
// the engine's (`buyPrice`, `sellPrice`), never recomputed here. Pure functions of the state, the pack and the profile.
import {
  buyPrice,
  checkBuy,
  checkSell,
  inSatchel,
  ledgerDiscount,
  merchantRefusal,
  merchantTier,
  merchantsHere,
  sellPrice,
  stockEntryFor,
  tierPriceMult,
  type Action,
  type ContentPack,
  type GameState,
  type ItemInstance,
  type Profile,
} from '@engine/index';
import type { Merchant } from '@schema/merchant';
import { byKind } from './inventoryModel';
import { RARITY_LABEL, compareToWorn, itemFacts, itemRow, type CompareModel, type ItemFacts, type ItemRowModel } from './itemModel';
import { panelAction, type PanelAction } from './panelAction';

export type TradeTab = 'buy' | 'sell';

const cap = (s: string): string => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1));
const percent = (mult: number): string => `${mult >= 1 ? '+' : '−'}${Math.round(Math.abs(mult - 1) * 100)}%`;

export interface StallHeader {
  id: string;
  name: string;
  /** The merchant will not trade: the sentence that says so. */
  refusal: string | null;
  /** "Wary with the Ironclad Nomads: prices +15%". */
  standing: string;
  /** "Kaelen’s Ledger and your Echoes take 5% off everything." */
  ledger: string | null;
  sells: boolean;
  buys: boolean;
  /** One-line shop description from the NPC (their role), when there is one. */
  role: string | null;
}

export interface TradeRow {
  row: ItemRowModel;
  /** Units for sale, or null for a line that never runs out. */
  stock: number | null;
  unit: number;
  /** The line cannot be bought/sold now at all (reason in `why`). */
  why: string | null;
}

export interface MerchantModel {
  merchants: { id: string; name: string }[];
  header: StallHeader | null;
  buy: TradeRow[];
  sell: TradeRow[];
  gold: number;
  packUsed: number;
  /** Only the services this merchant offers, none when it refuses. */
  tabs: { id: TradeTab; label: string; count: number | null }[];
}

export function stallHeader(s: GameState, content: ContentPack, profile: Readonly<Profile>, m: Merchant): StallHeader {
  const tier = merchantTier(s, content, m);
  const mult = tierPriceMult(s, content, m);
  const who = m.repFaction === undefined ? null : m.repFaction === 'best' ? 'your best standing' : (content.factions[m.repFaction]?.shortName ?? m.repFaction);
  const standing =
    tier === null || who === null
      ? 'Fixed prices.'
      : m.repFaction === 'best'
        ? `${cap(tier)} at best: prices ${mult === 1 ? 'standard' : percent(mult)}.`
        : `${cap(tier)} with ${who}: prices ${mult === 1 ? 'standard' : percent(mult)}.`;
  const cut = ledgerDiscount(s, content, profile, m.id);
  const npc = content.npcs[m.npcId];
  return {
    id: m.id,
    name: npc?.name ?? m.name,
    refusal: merchantRefusal(s, content, profile, m),
    standing,
    ledger: cut > 0 ? `A ${Math.round(cut * 100)}% discount comes off everything you buy here.` : null,
    sells: m.services.includes('buy'),
    buys: m.services.includes('sell'),
    role: npc?.roles[0] === undefined ? null : cap(npc.roles[0]),
  };
}

function stockRows(s: GameState, content: ContentPack, profile: Readonly<Profile>, m: Merchant, isLegal: (a: Action) => boolean): TradeRow[] {
  const stock = s.merchants[m.id]?.stock ?? [];
  return stock
    .map((inst): TradeRow => {
      const a: Action = { type: 'buy', merchantId: m.id, uid: inst.uid };
      const r = checkBuy(s, content, profile, a);
      const unlimited = stockEntryFor(s, content, profile, m, inst.itemId)?.count === 'unlimited';
      return {
        row: itemRow(content, inst),
        stock: unlimited ? null : inst.qty,
        unit: buyPrice(s, content, profile, m, inst),
        why: typeof r === 'string' && !isLegal(a) ? r : null,
      };
    })
    .sort((a, b) => byKind(a.row, b.row));
}

function sellRows(s: GameState, content: ContentPack, profile: Readonly<Profile>, m: Merchant): TradeRow[] {
  return s.player.inventory
    .filter((inst) => !inSatchel(content.items[inst.itemId]))
    .map((inst): TradeRow => {
      const r = checkSell(s, content, profile, { type: 'sell', merchantId: m.id, uid: inst.uid });
      return { row: itemRow(content, inst), stock: inst.qty, unit: sellPrice(content, m, inst), why: typeof r === 'string' ? r : null };
    })
    .sort((a, b) => byKind(a.row, b.row));
}

export function merchantModel(s: GameState, content: ContentPack, profile: Readonly<Profile>, merchantId: string | null, isLegal: (a: Action) => boolean): MerchantModel {
  const here = merchantsHere(s, content, profile);
  const id = merchantId !== null && here.includes(merchantId) ? merchantId : (here[0] ?? null);
  const m = id === null ? undefined : content.merchants[id];
  const header = m === undefined ? null : stallHeader(s, content, profile, m);
  const open = m !== undefined && header !== null && header.refusal === null;
  const buy = open && header.sells ? stockRows(s, content, profile, m, isLegal) : [];
  const sell = open && header.buys ? sellRows(s, content, profile, m) : [];
  return {
    merchants: here.map((x) => ({ id: x, name: content.npcs[content.merchants[x]?.npcId ?? '']?.name ?? x })),
    header,
    buy,
    sell,
    gold: s.player.gold,
    packUsed: s.player.inventory.filter((i) => !inSatchel(content.items[i.itemId])).length,
    tabs: [
      ...(open && header.sells ? [{ id: 'buy' as const, label: 'Buy', count: buy.length }] : []),
      ...(open && header.buys ? [{ id: 'sell' as const, label: 'Sell', count: sell.length }] : []),
    ],
  };
}

// ---- the chosen line ------------------------------------------------------------------------------------------------------

export interface TradeDetail {
  mode: TradeTab;
  uid: string;
  facts: ItemFacts;
  compare: CompareModel[];
  /** Price of one unit. */
  unit: number;
  qty: number;
  /** Most the stepper allows (stock, or what you can pay for, at least 1). */
  maxQty: number;
  total: number;
  /** "15 gold each" / "Sells for 12 gold each (75% of its worth)". */
  priceLine: string;
  stockLine: string;
  action: PanelAction;
  /** The line is not for sale / will not be bought: why. */
  why: string | null;
}

/** The instance on a stall's shelf or in the pack, by uid. */
function lineInst(s: GameState, merchantId: string, mode: TradeTab, uid: string): ItemInstance | undefined {
  return mode === 'buy' ? s.merchants[merchantId]?.stock.find((i) => i.uid === uid) : s.player.inventory.find((i) => i.uid === uid);
}

export function tradeDetail(
  s: GameState,
  content: ContentPack,
  profile: Readonly<Profile>,
  merchantId: string,
  mode: TradeTab,
  uid: string,
  qtyWanted: number,
  isLegal: (a: Action) => boolean,
): TradeDetail | null {
  const m = content.merchants[merchantId];
  const inst = lineInst(s, merchantId, mode, uid);
  if (m === undefined || inst === undefined) return null;
  const facts = itemFacts(content, inst, { state: s, profile });
  if (facts === null) return null;
  const unit = mode === 'buy' ? buyPrice(s, content, profile, m, inst) : sellPrice(content, m, inst);
  const unlimited = mode === 'buy' && stockEntryFor(s, content, profile, m, inst.itemId)?.count === 'unlimited';
  const affordable = mode === 'buy' && unit > 0 ? Math.floor(s.player.gold / unit) : inst.qty;
  const maxQty = Math.max(1, Math.min(inst.qty, affordable));
  const qty = Math.max(1, Math.min(maxQty, qtyWanted));
  const probe: Action = mode === 'buy' ? { type: 'buy', merchantId, uid, qty } : { type: 'sell', merchantId, uid, qty };
  const r = mode === 'buy' ? checkBuy(s, content, profile, probe as Extract<Action, { type: 'buy' }>) : checkSell(s, content, profile, probe as Extract<Action, { type: 'sell' }>);
  const problem = typeof r === 'string' ? r : null;
  const total = unit * qty;
  const verb = mode === 'buy' ? 'Buy' : 'Sell';
  const label = `${verb}${qty > 1 ? ` ${qty}` : ''} for ${total} gold`;
  const action = panelAction(mode, label, probe, isLegal, problem, {
    primary: true,
    confirm: mode === 'sell' && facts.isGear && (inst.rarity === 'epic' || inst.rarity === 'legendary') ? `Sell the ${facts.name} (${RARITY_LABEL[inst.rarity]}) for ${total} gold?` : null,
    ...(mode === 'sell' ? { yes: 'Sell it' } : {}),
  });
  return {
    mode,
    uid,
    facts,
    compare: mode === 'buy' && facts.isGear ? compareToWorn(s, content, inst) : [],
    unit,
    qty,
    maxQty,
    total,
    priceLine: mode === 'buy' ? `${unit} gold each` : `Pays ${unit} gold each (${Math.round(m.sellMult * 100)}% of its worth)`,
    stockLine: mode === 'buy' ? (unlimited ? 'Always in stock.' : `${inst.qty} for sale.`) : `You have ${inst.qty}.`,
    action,
    why: problem,
  };
}

/** The accessible name of a stall row: "Short Bow, Common bow, 14 gold". */
export function tradeLabel(t: TradeRow, mode: TradeTab): string {
  const base = t.row.isGear ? `${t.row.name}, ${t.row.rarityLabel} ${t.row.typeLabel.toLowerCase()}` : t.row.name;
  const qty = t.stock === null ? ', always in stock' : t.stock > 1 ? `, ${t.stock} ${mode === 'buy' ? 'for sale' : 'owned'}` : '';
  return `${base}${qty}, ${t.why !== null && mode === 'sell' ? 'will not be bought' : `${t.unit} gold${t.row.qty > 1 || t.stock === null ? ' each' : ''}`}`;
}
