// The Emberforge (DESIGN §8, §9.6; WORLD §8; PLAN §8.1 "crafting/upgrade"; D-017, D-052, D-066 #10, D-067.6, D-073,
// D-079, D-083). U34. Borin at the forge is the only crafter: `craft`, `upgrade` and `salvage` need a location whose
// `craftingStation` is 'forge', its smith (the location's `merchantId`, if any) standing there and willing (economy.ts
// `merchantRefusal`: Hostile Ironclad). Fees are Borin's and take Borin's Favor (`att_borins_favor`, custom
// `forge_discount` { pct: 0.15 }), rounded; Kaelen's Ledger and faction tiers are shop prices, not forge fees.
//
// craft (DESIGN §8.1/§8.5): the recipe's `requires` (Echoes, flags, Heartstone state …) must hold; a `requiresItemRead`
// recipe must be known this loop (the pattern's `unlockRecipe`, effects.ts `KNOWN_RECIPE`); the Ironclad tier must
// reach `repTier` — `repTierWhileActive.tier` while any of its quests is active (the Breach-anchor is Neutral during
// `q_the_mending`/`q_iron_silence`); story recipes charge no fee (D-066 #10). Inputs come from the pack (never what is
// worn): every `inputs` entry plus one `anyOf` group — the first, in authored order, that the pack can pay (the stable
// or the dead Heartstone fragment, D-052). The output is `output.rarity`, else the item's fixed rarity (Common: WORLD
// §8.2), with its affixes for that rarity; it must fit in the pack once the inputs are spent.
// upgrade (DESIGN §8.3, WORLD §8.3): one rarity up, worn or carried; Legendary is the top. Fee = round(upgradeCostMult
// [to] × gold_value × (1 − Borin's Favor)); materials from Rare: Rare ember ore ×2; Epic ember ore ×3 + 2 of the item's
// tier material (T1 hide/spark, T2 slate core, T3 spire thread/gland glow, T4 Skyreach crystal, T5 heartwood; either
// of a pair, the item's own kind first; a trinket may pay with a second Sky-Whisper Talisman instead, keeping one);
// Legendary ember ore ×5 + Frayed Moment ×2 + one regional rare (Breach glass, Drowned pearl, heartwood, Tyrant shard,
// the first held). Rep: Neutral to Rare, Trusted to Epic and Legendary. Nothing re-rolls; reaching Rare/Epic/Legendary
// fills the new affix slots up to that tier's count (§7.3: 1/2/2), the first chosen by the player (`affixId`) from three
// offered — offers drawn from a stream of the item and its new tier, so the offer the UI shows is the one paid for.
// salvage (DESIGN §8.4): a carried, unbound piece of gear is destroyed for its tier material (Common 1, Uncommon 2,
// Rare 2, Epic/Legendary 3), ember ore (Rare 1, Epic/Legendary 2) and its affixes' material (`AFFIX_SALVAGE`: of the
// Void → a Void Shard); no gold, no time; what does not fit is left on the ground (rewards.ts `placeLoot`).
// Time: the first forge job (craft or upgrade) of a visit costs the recipe's `timeCost` (an upgrade 1 watch), later
// ones nothing (`player.uses['forge:<location>']` holds the visit count of the last job).
// Never soft-locked by poverty (DESIGN §9.6 rule 4): Common → Uncommon needs gold only; story recipes cost nothing.
import type { Item } from '@schema/item';
import { MAX_AFFIXES } from '@schema/item';
import type { Recipe } from '@schema/recipe';
import { evaluate, explain, repTier, type RepTier } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { RARITY_ORDER } from '../derived';
import { KNOWN_RECIPE, addItem } from '../effects';
import type { Enumerator } from '../legalActions';
import { affixPool, rollAffixes } from '../rarity';
import { Rng } from '../rng';
import { ATT_SCRIPT, scriptNumber } from '../runRules';
import type { ActionOf } from '../types/actions';
import type { Profile } from '../types/profile';
import type { FactionId, GameState, ItemInstance, Rarity } from '../types/state';
import { clamp, round } from '../util/math';
import { packRoom, placeLoot } from '../combat/rewards';
import { TIER_RANK, goldValue, merchantPresent, merchantRefusal, spendGold } from './economy';
import { passTime } from './loop';

/** The location `craftingStation` Borin works at (DESIGN §8: the only forge). */
export const FORGE_STATION = 'forge';
/** DESIGN §8.1: the forge's rep gate is the Ironclad Nomads' tier. */
export const FORGE_FACTION: FactionId = 'ironclad';
export const EMBER_ORE = 'mat_ember_ore';
export const FRAYED_MOMENT = 'mat_frayed_moment';
/** DESIGN §8.3 tier materials (T5: WORLD §8.3, D-066 #22); pairs list the martial kind first, the arcane kind second. */
export const TIER_MATERIALS: Readonly<Record<number, readonly string[]>> = {
  1: ['mat_wildling_hide', 'mat_ley_spark'],
  2: ['mat_slate_core'],
  3: ['mat_spire_thread', 'mat_glow_gland'],
  4: ['mat_skyreach_crystal'],
  5: ['mat_silverwood_heartwood'],
};
/** DESIGN §8.3: Epic → Legendary takes one of these, the first held. */
export const REGIONAL_RARES: readonly string[] = ['mat_breach_glass', 'mat_drowned_pearl', 'mat_silverwood_heartwood', 'mat_tyrant_shard'];
/** WORLD §8.3: a second Sky-Whisper Talisman may stand in for a trinket's Rare → Epic tier material. */
export const TALISMAN_ITEM_ID = 'item_sky_whisper_talisman';
/** DESIGN §8.4: an affix's salvage material (only "of the Void" is named). */
export const AFFIX_SALVAGE: Readonly<Record<string, string>> = { affix_of_the_void: 'item_void_shard' };
/** DESIGN §8.4: units of tier material and of ember ore a salvaged piece yields, by rarity. */
export const SALVAGE_YIELD: Readonly<Record<Rarity, { tier: number; ore: number }>> = {
  common: { tier: 1, ore: 0 },
  uncommon: { tier: 2, ore: 0 },
  rare: { tier: 2, ore: 1 },
  epic: { tier: 3, ore: 2 },
  legendary: { tier: 3, ore: 2 },
};
/** DESIGN §8.3 rep column, by the rarity reached. */
export const UPGRADE_REP: Readonly<Record<Exclude<Rarity, 'common'>, RepTier>> = { uncommon: 'neutral', rare: 'neutral', epic: 'trusted', legendary: 'trusted' };
/** DESIGN §8.3: "filled by player choice from three offered". */
export const UPGRADE_OFFERS = 3;
/** `player.uses` key prefix of the last forge job's visit (+ location id). */
export const USES_FORGE_VISIT = 'forge:';
/** An upgrade's time when it is the visit's first forge job (DESIGN gives none; a recipe's default). */
export const UPGRADE_WATCHES = 1;

type Pr = Readonly<Profile>;

/** `count` of `itemId`; `keep` more must be held besides (worn counts) and stay — the Talisman rule. */
export interface Need {
  itemId: string;
  count: number;
  keep?: number;
}
interface Bill {
  fixed: Need[];
  anyOf: Need[][];
}

const nameOf = (content: ContentPack, itemId: string): string => content.items[itemId]?.name ?? itemId;
const needsText = (content: ContentPack, needs: readonly Need[]): string => needs.map((n) => `${nameOf(content, n.itemId)} ×${n.count}`).join(', ');
const nextRarity = (r: Rarity): Rarity | undefined => RARITY_ORDER[RARITY_ORDER.indexOf(r) + 1];

// ---- the forge ---------------------------------------------------------------------------------------------------------

/** Why no forge work can happen here (no forge, the smith away or unwilling), or null. */
export function forgeProblem(s: GameState, content: ContentPack, profile: Pr): string | null {
  const loc = content.locations[s.world.currentLocationId];
  if (loc?.craftingStation !== FORGE_STATION) return 'Only at the Emberforge';
  const smith = loc.merchantId === undefined ? undefined : content.merchants[loc.merchantId];
  if (smith === undefined) return null;
  if (!merchantPresent(s, content, smith.id)) return `${content.npcs[smith.npcId]?.name ?? smith.name} is not at the forge`;
  return merchantRefusal(s, content, profile, smith);
}

/** Borin's Favor (DESIGN §10.7): the share taken off Emberforge fees. */
export const forgeDiscount = (s: GameState, content: ContentPack): number => scriptNumber(s.player, content, ATT_SCRIPT.forgeDiscount, 'pct');

/** A forge fee after Borin's Favor, rounded. */
export const forgeFee = (s: GameState, content: ContentPack, base: number): number => round(base * (1 - forgeDiscount(s, content)));

/** True when the Ironclad tier is at least `tier`. */
export const ironcladAtLeast = (s: GameState, content: ContentPack, tier: RepTier): boolean =>
  TIER_RANK[repTier(s.reputation[FORGE_FACTION], content)] >= TIER_RANK[tier];

const visitKey = (s: GameState): string => `${USES_FORGE_VISIT}${s.world.currentLocationId}`;
const visitCount = (s: GameState): number => s.world.locationStates[s.world.currentLocationId]?.visitCount ?? 0;

/** Watches a forge job costs: `first` (the recipe's timeCost) for the visit's first job, then nothing. */
export const forgeWatches = (s: GameState, first: number): number => (s.player.uses[visitKey(s)]?.count === visitCount(s) ? 0 : first);

function finishJob(ctx: StepCtx, watches: number): void {
  const { s } = ctx;
  s.player.uses[visitKey(s)] = { loop: s.meta.loop, count: visitCount(s) };
  passTime(ctx, watches);
}

// ---- the pack -------------------------------------------------------------------------------------------------------------

/** Units of `itemId` in the pack (never what is worn), leaving out `except` (the piece being upgraded). */
export function packCount(s: GameState, itemId: string, except?: string): number {
  let n = 0;
  for (const i of s.player.inventory) if (i.itemId === itemId && i.uid !== except) n += i.qty;
  return n;
}

function heldCount(s: GameState, itemId: string, except?: string): number {
  let n = packCount(s, itemId, except);
  for (const i of Object.values(s.player.equipment)) if (i?.itemId === itemId && i.uid !== except) n += i.qty;
  return n;
}

/** What the pack pays for `bill` (its fixed part plus the first payable alternative), or what is missing. */
function settle(s: GameState, content: ContentPack, bill: Bill, except?: string): { pay: Need[] } | { missing: string } {
  const owed = (needs: readonly Need[]): Need[] => {
    const sum = new Map<string, Need>();
    for (const n of needs) {
      const prev = sum.get(n.itemId);
      sum.set(n.itemId, { itemId: n.itemId, count: (prev?.count ?? 0) + n.count, keep: Math.max(prev?.keep ?? 0, n.keep ?? 0) });
    }
    return [...sum.values()];
  };
  const payable = (needs: readonly Need[]): boolean =>
    owed(needs).every((n) => packCount(s, n.itemId, except) >= n.count && heldCount(s, n.itemId, except) >= n.count + (n.keep ?? 0));
  const short = (needs: readonly Need[]): Need[] =>
    owed(needs)
      .map((n) => ({ itemId: n.itemId, count: Math.max(n.count - packCount(s, n.itemId, except), n.count + (n.keep ?? 0) - heldCount(s, n.itemId, except)) }))
      .filter((n) => n.count > 0);
  if (bill.anyOf.length === 0) return payable(bill.fixed) ? { pay: owed(bill.fixed) } : { missing: `Missing: ${needsText(content, short(bill.fixed))}` };
  for (const group of bill.anyOf) if (payable([...bill.fixed, ...group])) return { pay: owed([...bill.fixed, ...group]) };
  const fixedShort = short(bill.fixed);
  const options = bill.anyOf.map((g) => needsText(content, g)).join(' or ');
  return { missing: `Missing: ${fixedShort.length > 0 ? `${needsText(content, fixedShort)}; and ` : ''}${options}` };
}

/** Takes `pay` out of the pack (never worn items, never `except`), one `itemLost` per item. */
function consume(ctx: StepCtx, pay: readonly Need[], except?: string): void {
  const inventory = ctx.s.player.inventory;
  for (const n of pay) {
    let left = n.count;
    for (let i = 0; i < inventory.length && left > 0; ) {
      const stack = inventory[i] as ItemInstance;
      if (stack.itemId !== n.itemId || stack.uid === except) {
        i++;
        continue;
      }
      const take = Math.min(left, stack.qty);
      stack.qty -= take;
      left -= take;
      if (stack.qty === 0) inventory.splice(i, 1);
      else i++;
    }
    ctx.emit({ t: 'itemLost', itemId: n.itemId, qty: n.count, reason: 'crafted' });
  }
}

/** The state as it would be once `pay` is spent (for the room check; nothing else is read from it). */
function afterPaying(s: GameState, pay: readonly Need[]): GameState {
  const inventory = s.player.inventory.map((i) => ({ ...i }));
  for (const n of pay) {
    let left = n.count;
    for (const stack of inventory) {
      if (left === 0) break;
      if (stack.itemId !== n.itemId) continue;
      const take = Math.min(left, stack.qty);
      stack.qty -= take;
      left -= take;
    }
  }
  return { ...s, player: { ...s.player, inventory: inventory.filter((i) => i.qty > 0) } };
}

/**
 * The item's tier material ids (DESIGN §8.3), its own kind first: arcane gear (staves, focuses, trinkets) takes the
 * second of a pair first. A bill may name ids the pack lacks (nobody can hold them); salvage yields only known ones.
 */
export function tierMaterials(def: Item): string[] {
  const list = [...(TIER_MATERIALS[clamp(def.tier, 1, 5)] ?? [])];
  const arcane = def.slot === 'trinket' || def.weaponType === 'magic_staff' || def.weaponType === 'void_focus';
  return arcane ? list.reverse() : list;
}

// ---- craft ---------------------------------------------------------------------------------------------------------------

export interface CraftQuote {
  recipe: Recipe;
  output: Item;
  rarity: Rarity;
  fee: number;
  pay: Need[];
  watches: number;
}

/** The Ironclad tier this recipe needs now: `repTierWhileActive` while one of its quests is active (DESIGN §8.5). */
export function recipeTier(s: GameState, recipe: Recipe): RepTier {
  const waiver = recipe.repTierWhileActive;
  return waiver !== undefined && waiver.quests.some((q) => s.quests[q]?.status === 'active') ? waiver.tier : recipe.repTier;
}

/** True when the recipe is known this loop (`unlockRecipe`), as a `requiresItemRead` recipe needs. */
export const recipeKnown = (s: GameState, recipeId: string): boolean => s.player.uses[`${KNOWN_RECIPE}${recipeId}`] !== undefined;

export function craftQuote(s: GameState, content: ContentPack, profile: Pr, recipeId: string): CraftQuote | string {
  const forge = forgeProblem(s, content, profile);
  if (forge !== null) return forge;
  const recipe = content.recipes[recipeId];
  if (!recipe) return `There is no recipe '${recipeId}'`;
  if (recipe.requires !== undefined && !evaluate(recipe.requires, s, profile, content)) {
    const unmet = explain(recipe.requires, s, profile, content).parts.filter((p) => !p.ok);
    return `${recipe.name} requires: ${unmet.map((p) => p.text).join('; ')}`;
  }
  if (recipe.requiresItemRead !== undefined && !recipeKnown(s, recipe.id)) return `Read the ${nameOf(content, recipe.requiresItemRead)} first`;
  const tier = recipeTier(s, recipe);
  if (!ironcladAtLeast(s, content, tier)) return `Borin forges the ${recipe.name} only for those the Ironclad Nomads hold ${tier}`;
  const bill: Bill = {
    fixed: recipe.inputs.map((i) => ({ itemId: i.itemId, count: i.count })),
    anyOf: recipe.anyOf.map((g) => g.map((i) => ({ itemId: i.itemId, count: i.count }))),
  };
  const settled = settle(s, content, bill);
  if ('missing' in settled) return settled.missing;
  const fee = recipe.story ? 0 : forgeFee(s, content, recipe.gold);
  if (s.player.gold < fee) return `Borin's fee is ${fee} gold; you have ${s.player.gold}`;
  const output = content.items[recipe.output.itemId];
  if (!output) throw new Error(`crafting: unknown item '${recipe.output.itemId}'`);
  const rarity = recipe.output.rarity ?? output.fixedRarity;
  if (packRoom(afterPaying(s, settled.pay), content, output, rarity, recipe.output.count) < recipe.output.count) return 'Your pack is full';
  return { recipe, output, rarity, fee, pay: settled.pay, watches: forgeWatches(s, recipe.timeCost) };
}

/** Crafts (DESIGN §8.1): fee, inputs, the output into the pack, the visit's time; `crafted`. */
export function craftHandler(ctx: StepCtx, a: ActionOf<'craft'>): void {
  const q = craftQuote(ctx.s, ctx.content, ctx.profile, a.recipeId);
  if (typeof q === 'string') return ctx.reject(q);
  const { s } = ctx;
  spendGold(ctx, q.fee);
  consume(ctx, q.pay);
  const count = q.recipe.output.count;
  let made: ItemInstance;
  if (q.output.stackable) made = { ...(addItem(ctx, q.output.id, count, q.rarity)[0] as ItemInstance), qty: count };
  else {
    const pieces: ItemInstance[] = [];
    for (let i = 0; i < count; i++) pieces.push({ uid: ctx.uid('i'), itemId: q.output.id, qty: 1, rarity: q.rarity, affixes: rollAffixes(ctx, q.output, q.rarity) });
    s.player.inventory.push(...pieces);
    made = { ...(pieces[0] as ItemInstance), qty: count };
  }
  s.counters.itemsCrafted += 1;
  ctx.emit({ t: 'crafted', recipeId: q.recipe.id, item: { ...made, affixes: [...made.affixes] } });
  ctx.log(`Borin forges the ${q.output.name}${count > 1 ? ` ×${count}` : ''}.`, 'event');
  finishJob(ctx, q.watches);
}

// ---- upgrade ---------------------------------------------------------------------------------------------------------------

export interface UpgradeQuote {
  inst: ItemInstance;
  def: Item;
  target: Rarity;
  fee: number;
  pay: Need[];
  /** New affix slots the tier-up opens (DESIGN §7.3 counts), filled from `offers`. */
  newSlots: number;
  offers: string[];
  watches: number;
}

/** The piece with this uid, carried or worn. */
function findPiece(s: GameState, uid: string): ItemInstance | undefined {
  return s.player.inventory.find((i) => i.uid === uid) ?? Object.values(s.player.equipment).find((i) => i?.uid === uid) ?? undefined;
}

/** DESIGN §8.3 materials for reaching `target`. */
function upgradeBill(def: Item, target: Rarity): Bill {
  const ore = (count: number): Need => ({ itemId: EMBER_ORE, count });
  switch (target) {
    case 'rare':
      return { fixed: [ore(2)], anyOf: [] };
    case 'epic': {
      const groups: Need[][] = tierMaterials(def).map((id) => [{ itemId: id, count: 2 }]);
      if (def.slot === 'trinket') groups.push([{ itemId: TALISMAN_ITEM_ID, count: 1, keep: 1 }]);
      return { fixed: [ore(3)], anyOf: groups };
    }
    case 'legendary':
      return { fixed: [ore(5), { itemId: FRAYED_MOMENT, count: 2 }], anyOf: REGIONAL_RARES.map((id) => [{ itemId: id, count: 1 }]) };
    default:
      return { fixed: [], anyOf: [] };
  }
}

/** Up to three affixes offered for a tier-up's new slot: a stream of the piece and its new tier (stable for the UI). */
export function upgradeOffers(s: GameState, content: ContentPack, inst: ItemInstance, def: Item, target: Rarity): string[] {
  const rng = Rng.fromSeed(`${s.meta.seed}:${s.meta.loop}:${inst.uid}:${target}`);
  return rng.shuffle(affixPool(content, def, inst.affixes)).slice(0, UPGRADE_OFFERS);
}

export function upgradeQuote(s: GameState, content: ContentPack, profile: Pr, uid: string): UpgradeQuote | string {
  const forge = forgeProblem(s, content, profile);
  if (forge !== null) return forge;
  const inst = findPiece(s, uid);
  if (!inst) return 'You are not carrying that';
  const def = content.items[inst.itemId];
  if (!def) throw new Error(`crafting: unknown item '${inst.itemId}'`);
  if (!def.upgradeable) return `The ${def.name} cannot be upgraded`;
  const target = nextRarity(inst.rarity);
  if (target === undefined || target === 'common') return `The ${def.name} is Legendary; nothing is finer`;
  const tier = UPGRADE_REP[target];
  if (!ironcladAtLeast(s, content, tier)) return `Borin takes work to ${target} only for those the Ironclad Nomads hold ${tier}`;
  const settled = settle(s, content, upgradeBill(def, target), inst.uid);
  if ('missing' in settled) return settled.missing;
  const fee = forgeFee(s, content, content.config.upgradeCostMult[target] * goldValue(def, inst.rarity, content));
  if (s.player.gold < fee) return `Borin's fee is ${fee} gold; you have ${s.player.gold}`;
  const newSlots = target === 'uncommon' ? 0 : Math.max(0, MAX_AFFIXES[target] - inst.affixes.length);
  const offers = newSlots > 0 ? upgradeOffers(s, content, inst, def, target) : [];
  return { inst, def, target, fee, pay: settled.pay, newSlots: Math.min(newSlots, offers.length), offers, watches: forgeWatches(s, UPGRADE_WATCHES) };
}

/** The quote, with the action's affix choice checked: required (one of the offers) exactly when a slot opens. */
export function checkUpgrade(s: GameState, content: ContentPack, profile: Pr, a: ActionOf<'upgrade'>): UpgradeQuote | string {
  const q = upgradeQuote(s, content, profile, a.uid);
  if (typeof q === 'string') return q;
  if (q.newSlots === 0) return a.affixId === undefined ? q : `No affix slot opens on the ${q.def.name} at ${q.target}`;
  if (a.affixId === undefined) return `Choose an affix for the new slot: ${q.offers.join(', ')}`;
  return q.offers.includes(a.affixId) ? q : `'${a.affixId}' is not one of the affixes offered (${q.offers.join(', ')})`;
}

/** Upgrades (DESIGN §8.3): fee, materials, one rarity up, new slots filled (the chosen affix first); `upgraded`. */
export function upgradeHandler(ctx: StepCtx, a: ActionOf<'upgrade'>): void {
  const q = checkUpgrade(ctx.s, ctx.content, ctx.profile, a);
  if (typeof q === 'string') return ctx.reject(q);
  spendGold(ctx, q.fee);
  consume(ctx, q.pay, q.inst.uid);
  q.inst.rarity = q.target;
  if (a.affixId !== undefined) {
    const fill = [a.affixId, ...q.offers.filter((id) => id !== a.affixId)].slice(0, q.newSlots);
    q.inst.affixes.push(...fill);
  }
  ctx.s.counters.itemsUpgraded += 1;
  ctx.emit({ t: 'upgraded', item: { ...q.inst, affixes: [...q.inst.affixes] } });
  ctx.log(`Borin works the ${q.def.name}: it is ${q.target} now.`, 'event');
  finishJob(ctx, q.watches);
}

// ---- salvage -----------------------------------------------------------------------------------------------------------------

export interface SalvageQuote {
  inst: ItemInstance;
  def: Item;
  yields: Need[];
}

export function salvageQuote(s: GameState, content: ContentPack, profile: Pr, uid: string): SalvageQuote | string {
  const forge = forgeProblem(s, content, profile);
  if (forge !== null) return forge;
  const inst = s.player.inventory.find((i) => i.uid === uid);
  if (!inst) return Object.values(s.player.equipment).some((i) => i?.uid === uid) ? 'Take it off first' : 'You are not carrying that';
  const def = content.items[inst.itemId];
  if (!def) throw new Error(`crafting: unknown item '${inst.itemId}'`);
  if (def.slot === undefined) return `Only weapons, armor and trinkets can be salvaged`;
  if (!def.droppable || (inst.boundQuest !== undefined && s.quests[inst.boundQuest]?.status === 'active')) return `The ${def.name} is bound to you`;
  const y = SALVAGE_YIELD[inst.rarity];
  const yields: Need[] = [];
  const tierMat = tierMaterials(def).find((id) => content.items[id] !== undefined);
  if (tierMat !== undefined) yields.push({ itemId: tierMat, count: y.tier });
  if (y.ore > 0 && content.items[EMBER_ORE] !== undefined) yields.push({ itemId: EMBER_ORE, count: y.ore });
  for (const affix of inst.affixes) {
    const mat = AFFIX_SALVAGE[affix];
    if (mat !== undefined && content.items[mat] !== undefined) yields.push({ itemId: mat, count: 1 });
  }
  return { inst, def, yields };
}

/** Salvages (DESIGN §8.4): the piece is destroyed; its materials go to the pack (the rest on the ground). No time. */
export function salvageHandler(ctx: StepCtx, a: ActionOf<'salvage'>): void {
  const q = salvageQuote(ctx.s, ctx.content, ctx.profile, a.uid);
  if (typeof q === 'string') return ctx.reject(q);
  const { s } = ctx;
  s.player.inventory.splice(s.player.inventory.indexOf(q.inst), 1);
  ctx.emit({ t: 'itemLost', itemId: q.def.id, qty: 1, reason: 'crafted' });
  ctx.log(`Borin breaks down the ${q.def.name}.`, 'event');
  for (const y of q.yields) {
    const def = ctx.content.items[y.itemId] as Item;
    placeLoot(ctx, s.world.currentLocationId, y.itemId, y.count, def.fixedRarity, def.fixedAffixes, `salvage:${q.def.id}`);
  }
}

// ---- enumerators (PLAN §4.7) --------------------------------------------------------------------------------------------------

export const craftEnumerator: Enumerator<'craft'> = (s, content, profile) => {
  if (forgeProblem(s, content, profile) !== null) return [];
  return Object.keys(content.recipes)
    .filter((recipeId) => typeof craftQuote(s, content, profile, recipeId) !== 'string')
    .map((recipeId) => ({ type: 'craft', recipeId }));
};

export const upgradeEnumerator: Enumerator<'upgrade'> = (s, content, profile) => {
  if (forgeProblem(s, content, profile) !== null) return [];
  const out: ActionOf<'upgrade'>[] = [];
  const pieces = [...s.player.inventory, ...Object.values(s.player.equipment).filter((i): i is ItemInstance => i !== null)];
  for (const inst of pieces) {
    const q = upgradeQuote(s, content, profile, inst.uid);
    if (typeof q === 'string') continue;
    if (q.newSlots === 0) out.push({ type: 'upgrade', uid: inst.uid });
    else for (const affixId of q.offers) out.push({ type: 'upgrade', uid: inst.uid, affixId });
  }
  return out;
};

export const salvageEnumerator: Enumerator<'salvage'> = (s, content, profile) => {
  if (forgeProblem(s, content, profile) !== null) return [];
  return s.player.inventory
    .filter((i) => typeof salvageQuote(s, content, profile, i.uid) !== 'string')
    .map((i) => ({ type: 'salvage', uid: i.uid }));
};
