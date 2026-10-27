// U82 (D-149 #5): buy what you need. Before U82 the fighting bots stocked three healing draughts and upgraded the weapon at the
// forge, and nothing else: end-of-Loop-1 gold sat at a median of 1,286 (DESIGN §19 #14's band is 50–200) with DESIGN §9's sinks
// untouched — gear on the shelves (the Cinderhorn Plate, the Veil Threadmail), Borin's patterns and the recipes they teach, the
// rest of the gear at the upgrade bench, the inns. A player who has the gold and a reason spends it. The rows, in order:
//   inn        hurt (HP < 80 % or MP < 50 %) at an inn whose night is affordable, while the clock allows (not once the Apex is due,
//              `apexDue`): the full rest (10 g and the Rested buff), not only the < 50 % rest every bot already takes;
//   pattern    a Borin's Pattern carried and not yet read: read it (`use`, unlockRecipe);
//   forge      at the Emberforge, a recipe whose piece beats what that slot holds (scoreEquipment at the output's rarity), when the
//              fee leaves RESERVE; then the upgrade bench for every worn piece, the weapon first, when the fee leaves RESERVE;
//              neither ever spends an item a quest still asks for (`questReserved`: the Void Shards, the ember ore of the anchor);
//   shelf      the gear upgrade on a merchant's shelf with the biggest gain, when its price leaves RESERVE; then a pattern whose
//              recipe makes such an upgrade, when it leaves PATTERN_RESERVE;
//   stock      a mana draught for an MP class up to MANA_STOCK (healing up to the bot's own stock is the bot's row, before this).
// Pure readers of (state, legal, content, profile); deterministic; no notes needed (every row checks what is carried or worn).
import { apexDue, allOf, healAmount, healthFraction, itemOf, manaFraction, scoreEquipment } from './shared';
import { KNOWN_RECIPE, buyPrice, craftQuote, upgradeQuote, type Action, type ContentPack, type GameState, type ItemInstance, type Profile } from '@engine/index';
import { wantedItems } from './questFollow';

export const SHOPPING = {
  /** Gold always kept back for draughts and inns. */
  reserve: 40,
  /** A pattern is bought only with this much left over (the recipe's fee and materials are still to come). */
  patternReserve: 150,
  /** Rest at an inn below these shares. */
  innHpBelow: 0.8,
  innMpBelow: 0.5,
  /** Mana draughts carried by a class with an MP pool. */
  manaStock: 2,
} as const;

type Equip = 'weapon' | 'armor' | 'trinket';
const WORN_ORDER = ['weapon', 'armor', 'trinket1', 'trinket2'] as const;

/** What the worn piece in `slot` is worth (a trinket: the weaker of the two; an empty slot: 0). */
export function wornScore(s: GameState, content: ContentPack, slot: Equip): number {
  const score = (i: ItemInstance | null): number => (i === null ? 0 : scoreEquipment(content, i, s.player.classId));
  if (slot === 'trinket') return Math.min(score(s.player.equipment.trinket1), score(s.player.equipment.trinket2));
  return score(s.player.equipment[slot]);
}

/** How much a piece would add over what its slot holds (≤ 0: no upgrade; −Infinity: the class cannot wear it). */
export function gearGain(s: GameState, content: ContentPack, piece: Pick<ItemInstance, 'itemId' | 'rarity' | 'affixes'>): number {
  const slot = content.items[piece.itemId]?.slot;
  if (slot === undefined) return Number.NEGATIVE_INFINITY;
  // the same piece carried already counts as worn (bought once, it is equipped by the head's row)
  const carried = s.player.inventory.some((i) => i.itemId === piece.itemId);
  if (carried) return Number.NEGATIVE_INFINITY;
  return scoreEquipment(content, piece, s.player.classId) - wornScore(s, content, slot as Equip);
}

/** Items a quest that is not completed still asks the player to hold (never spent at the forge). */
export function questReserved(s: GameState, content: ContentPack): Set<string> {
  const out = new Set<string>();
  for (const [questId, quest] of Object.entries(content.quests)) {
    if (s.quests[questId]?.status === 'completed' || s.quests[questId]?.status === 'failed') continue;
    for (const stage of quest.stages) {
      for (const o of stage.objectives) wantedItems(o.when, out);
      if (stage.advanceWhen !== undefined) wantedItems(stage.advanceWhen, out);
      if (Array.isArray(stage.next)) for (const b of stage.next) wantedItems(b.when, out);
    }
  }
  return out;
}

const stockItem = (s: GameState, a: Extract<Action, { type: 'buy' }>): ItemInstance | undefined => s.merchants[a.merchantId]?.stock.find((i) => i.uid === a.uid);

/** The unit price of a listed `buy` (the engine's `buyPrice`, what `checkBuy` charges). */
function priceOf(s: GameState, content: ContentPack, profile: Profile, a: Extract<Action, { type: 'buy' }>): number {
  const inst = stockItem(s, a);
  const m = content.merchants[a.merchantId];
  return inst === undefined || m === undefined ? Number.POSITIVE_INFINITY : buyPrice(s, content, profile, m, inst);
}

/** Is the recipe a pattern teaches known this loop (`player.uses['recipe:<id>']`)? */
const recipeKnown = (s: GameState, recipeId: string): boolean => s.player.uses[`${KNOWN_RECIPE}${recipeId}`] !== undefined;

/** The recipe a pattern item teaches, if any. */
function patternRecipe(content: ContentPack, itemId: string): string | undefined {
  const def = content.items[itemId];
  if (def?.type !== 'recipe') return undefined;
  for (const e of def.onUse) if ('unlockRecipe' in e) return e.unlockRecipe;
  return undefined;
}

/** The inn row: a paid full rest when hurt and the clock allows. */
export function innRest(s: GameState, legal: readonly Action[], content: ContentPack): Action | undefined {
  const rest = content.locations[s.world.currentLocationId]?.rest;
  if (rest?.kind !== 'inn' || apexDue(s)) return undefined;
  if (healthFraction(s) >= SHOPPING.innHpBelow && manaFraction(s) >= SHOPPING.innMpBelow) return undefined;
  if (s.player.gold < (rest.cost ?? 0) + SHOPPING.reserve) return undefined;
  return legal.find((a) => a.type === 'rest' && a.kind === 'full');
}

/** The forge rows: a recipe that makes an upgrade, then the upgrade bench (worn pieces, the weapon first). */
export function forgeWork(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile): Action | undefined {
  const crafts = allOf(legal, 'craft');
  const upgrades = allOf(legal, 'upgrade');
  if (crafts.length === 0 && upgrades.length === 0) return undefined;
  const reserved = questReserved(s, content);
  const spares = (pay: readonly { itemId: string }[]): boolean => pay.every((p) => !reserved.has(p.itemId));
  const gold = s.player.gold;
  let best: { a: Action; gain: number } | undefined;
  for (const a of crafts) {
    const q = craftQuote(s, content, profile, a.recipeId);
    if (typeof q === 'string' || q.output.slot === undefined || gold < q.fee + SHOPPING.reserve || !spares(q.pay)) continue;
    const gain = gearGain(s, content, { itemId: q.output.id, rarity: q.rarity, affixes: [] });
    if (gain > 0 && (best === undefined || gain > best.gain)) best = { a, gain };
  }
  if (best !== undefined) return best.a;
  for (const slot of WORN_ORDER) {
    const worn = s.player.equipment[slot];
    if (worn === null) continue;
    const up = upgrades.find((a) => a.uid === worn.uid);
    const q = up === undefined ? undefined : upgradeQuote(s, content, profile, worn.uid);
    if (up !== undefined && q !== undefined && typeof q !== 'string' && gold >= q.fee + SHOPPING.reserve && spares(q.pay)) return up;
  }
  return undefined;
}

/** The shelf rows: the best gear upgrade on sale, then a pattern for one. */
export function shelfBuy(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile): Action | undefined {
  const buys = allOf(legal, 'buy');
  if (buys.length === 0) return undefined;
  const gold = s.player.gold;
  let best: { a: Action; gain: number } | undefined;
  for (const a of buys) {
    const inst = stockItem(s, a);
    if (inst === undefined || content.items[inst.itemId]?.slot === undefined || gold < priceOf(s, content, profile, a) + SHOPPING.reserve) continue;
    const gain = gearGain(s, content, inst);
    if (gain > 0 && (best === undefined || gain > best.gain)) best = { a, gain };
  }
  if (best !== undefined) return best.a;
  for (const a of buys) {
    const inst = stockItem(s, a);
    const recipeId = inst === undefined ? undefined : patternRecipe(content, inst.itemId);
    const recipe = recipeId === undefined ? undefined : content.recipes[recipeId];
    if (inst === undefined || recipe === undefined || recipeKnown(s, recipe.id) || s.player.inventory.some((i) => i.itemId === inst.itemId)) continue;
    if (gold < priceOf(s, content, profile, a) + recipe.gold + SHOPPING.patternReserve) continue;
    if (gearGain(s, content, { itemId: recipe.output.itemId, rarity: recipe.output.rarity ?? 'common', affixes: [] }) > 0) return a;
  }
  return undefined;
}

/** Mana draughts for a class with an MP pool, up to MANA_STOCK. */
export function manaBuy(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile): Action | undefined {
  if (s.player.mpMax <= 0 || content.classes[s.player.classId]?.resource.bloodPrice !== undefined) return undefined;
  const restores = (itemId: string): number => {
    const def = content.items[itemId];
    if (def?.type !== 'consumable' || healAmount(content, itemId) > 0) return 0;
    let mp = 0;
    for (const e of def.onUse) if ('heal' in e && typeof e.heal.mp === 'number') mp = Math.max(mp, e.heal.mp);
    return mp;
  };
  const carried = s.player.inventory.filter((i) => restores(i.itemId) > 0).reduce((n, i) => n + i.qty, 0);
  if (carried >= SHOPPING.manaStock) return undefined;
  return allOf(legal, 'buy')
    .map((a) => ({ a, mp: restores(stockItem(s, a)?.itemId ?? ''), price: priceOf(s, content, profile, a) }))
    .filter((x) => x.mp > 0 && s.player.gold >= x.price + SHOPPING.reserve)
    .sort((x, y) => y.mp - x.mp || x.price - y.price)[0]?.a;
}

/** A pattern carried and not yet read: read it. */
export function readPattern(s: GameState, legal: readonly Action[], content: ContentPack): Action | undefined {
  return allOf(legal, 'use').find((a) => {
    const recipeId = patternRecipe(content, itemOf(s, a.uid)?.itemId ?? '');
    return recipeId !== undefined && !recipeKnown(s, recipeId);
  });
}

/** Every U82 row in order (see the header); undefined when nothing is worth buying here. */
export function shop(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile): Action | undefined {
  return innRest(s, legal, content) ?? readPattern(s, legal, content) ?? forgeWork(s, legal, content, profile) ?? shelfBuy(s, legal, content, profile) ?? manaBuy(s, legal, content, profile);
}

// ---- the explorer's collection (U82: coverage of DESIGN §9's shelves and recipes) ---------------------------------------------

/** Gold the explorer keeps back when it buys or forges a piece only to have held it. */
export const COLLECT_RESERVE = 100;

/** Notes every item id the player has held (pack or gear) into `seen`. */
export function noteHeld(s: GameState, seen: Set<string>): void {
  for (const i of s.player.inventory) seen.add(i.itemId);
  for (const i of Object.values(s.player.equipment)) if (i !== null) seen.add(i.itemId);
}

/**
 * The explorer opens every panel (PLAN §7.2): one of each thing on a shelf it has never held, and at the forge each recipe whose
 * piece it has never held, cheapest first, while COLLECT_RESERVE stays in the purse (never spending what a quest asks for).
 */
export function collectNew(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile, seen: ReadonlySet<string>): Action | undefined {
  const gold = s.player.gold;
  const reserved = questReserved(s, content);
  const forge = allOf(legal, 'craft')
    .flatMap((a) => {
      const q = craftQuote(s, content, profile, a.recipeId);
      return typeof q === 'string' || seen.has(q.output.id) || gold < q.fee + COLLECT_RESERVE || q.pay.some((p) => reserved.has(p.itemId)) ? [] : [{ a: a as Action, cost: q.fee }];
    })
    .sort((x, y) => x.cost - y.cost)[0];
  if (forge !== undefined) return forge.a;
  return allOf(legal, 'buy')
    .flatMap((a) => {
      const inst = stockItem(s, a);
      const price = priceOf(s, content, profile, a);
      return inst === undefined || seen.has(inst.itemId) || gold < price + COLLECT_RESERVE ? [] : [{ a: a as Action, cost: price }];
    })
    .sort((x, y) => x.cost - y.cost)[0]?.a;
}
