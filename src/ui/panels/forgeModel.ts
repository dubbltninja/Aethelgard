// What the Forge panel draws (PLAN §6.3 `CraftingPanel`, DESIGN §8, §16.3 `screen_crafting`; WORLD §8): Borin's Emberforge as
// three jobs — Upgrade a piece one rarity up (its materials owned against needed, the fee after Borin's Favor, the three
// affixes offered for a new slot and the piece as it will be), Craft from a recipe you know (inputs owned against needed,
// the alternatives of an "either of" bill, the fee, the time, the Ironclad standing it asks), and Salvage a carried piece
// into materials. Every quote is the engine's own (`craftQuote`, `upgradeQuote`, `salvageQuote`, `checkUpgrade`), so the
// panel never invents a rule and an off button carries the engine's reason. Pure functions of the state, the pack and the profile.
import { MAX_AFFIXES } from '@schema/item';
import type { Recipe } from '@schema/recipe';
import {
  FORGE_FACTION,
  UPGRADE_REP,
  checkUpgrade,
  craftQuote,
  evaluate,
  forgeDiscount,
  forgeFee,
  forgeProblem,
  forgeWatches,
  goldValue,
  inSatchel,
  packCount,
  recipeKnown,
  recipeTier,
  repTier,
  salvageQuote,
  upgradeBill,
  upgradeOffers,
  upgradeQuote,
  type Action,
  type Bill,
  type ContentPack,
  type GameState,
  type ItemInstance,
  type Need,
  type Profile,
  type Rarity,
} from '@engine/index';
import type { NeedRowModel } from '../components/items/ItemCard';
import { RARITY_LABEL, itemFacts, itemName, itemRow, type ItemFacts, type ItemRowModel } from './itemModel';
import { panelAction, type PanelAction } from './panelAction';

export type ForgeTab = 'upgrade' | 'craft' | 'salvage';

const cap = (s: string): string => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1));
const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const nextRarity = (r: Rarity): Rarity | undefined => RARITIES[RARITIES.indexOf(r) + 1];
const watchText = (n: number): string => (n === 0 ? 'No time passes (you are already at the forge this visit)' : `Takes ${n} watch${n === 1 ? '' : 'es'}`);

export interface ForgeHeader {
  smith: string;
  /** No forge work can happen: the sentence that says why. */
  blocked: string | null;
  /** "Ironclad Nomads: Trusted". */
  standing: string;
  /** "Borin’s Favor takes 15% off every fee." */
  favor: string | null;
  /** The first job of a visit costs time. */
  timeNote: string;
  gold: number;
}

export interface UpgradeRow {
  row: ItemRowModel;
  worn: boolean;
  /** "Rare" — the rarity it would reach; null at the top or when the piece cannot be upgraded. */
  target: string | null;
  why: string | null;
}

export interface RecipeRow {
  id: string;
  name: string;
  category: Recipe['category'];
  outputName: string;
  /** What is stopping it, in the engine's words; null when it can be done now. */
  why: string | null;
  story: boolean;
}

export interface SalvageRow {
  row: ItemRowModel;
  why: string | null;
}

export interface ForgeModel {
  header: ForgeHeader;
  upgrade: UpgradeRow[];
  craft: RecipeRow[];
  salvage: SalvageRow[];
  tabs: { id: ForgeTab; label: string; count: number | null }[];
}

// ---- bills ----------------------------------------------------------------------------------------------------------------

const nameOf = (content: ContentPack, itemId: string): string => content.items[itemId]?.name ?? itemId;

export function needRows(s: GameState, content: ContentPack, needs: readonly Need[], except?: string): NeedRowModel[] {
  return needs.map((n) => ({ itemId: n.itemId, name: nameOf(content, n.itemId), have: packCount(s, n.itemId, except), need: n.count, keep: n.keep ?? 0 }));
}

export interface BillModel {
  fixed: NeedRowModel[];
  /** "Either of": one group is paid, the first the pack can. Empty when the bill has none. */
  alternatives: NeedRowModel[][];
}

export function billModel(s: GameState, content: ContentPack, bill: Bill, except?: string): BillModel {
  return { fixed: needRows(s, content, bill.fixed, except), alternatives: bill.anyOf.map((g) => needRows(s, content, g, except)) };
}

/** A group of an "either of" bill is in hand. */
export const groupOk = (rows: readonly NeedRowModel[]): boolean => rows.every((n) => n.have >= n.need + n.keep);

// ---- the list ---------------------------------------------------------------------------------------------------------------

function header(s: GameState, content: ContentPack, profile: Readonly<Profile>): ForgeHeader {
  const loc = content.locations[s.world.currentLocationId];
  const smith = loc?.merchantId === undefined ? undefined : content.merchants[loc.merchantId];
  const favor = forgeDiscount(s, content);
  const factionName = content.factions[FORGE_FACTION]?.shortName ?? 'Ironclad Nomads';
  return {
    smith: (smith === undefined ? undefined : content.npcs[smith.npcId]?.name) ?? 'Borin',
    blocked: forgeProblem(s, content, profile),
    standing: `${factionName}: ${cap(repTier(s.reputation[FORGE_FACTION], content))}`,
    favor: favor > 0 ? `Borin’s Favor takes ${Math.round(favor * 100)}% off every fee.` : null,
    timeNote: forgeWatches(s, 1) === 0 ? 'You are already at the forge this visit: more jobs take no time.' : 'The first job of a visit takes a watch; later ones are free.',
    gold: s.player.gold,
  };
}

const CATEGORY_ORDER: Readonly<Record<Recipe['category'], number>> = { weapon: 0, armor: 1, trinket: 2, consumable: 3, quest: 4 };
const CATEGORY_LABEL: Readonly<Record<Recipe['category'], string>> = { weapon: 'Weapon', armor: 'Armor', trinket: 'Trinket', consumable: 'Consumable', quest: 'Story' };
export const categoryLabel = (c: Recipe['category']): string => CATEGORY_LABEL[c];

/** The recipes you may see: read (when a pattern must be read) and with their conditions met. */
export function knownRecipes(s: GameState, content: ContentPack, profile: Readonly<Profile>): Recipe[] {
  return Object.values(content.recipes)
    .filter((r) => (r.requiresItemRead === undefined || recipeKnown(s, r.id)) && (r.requires === undefined || evaluate(r.requires, s, profile, content)))
    .sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function forgeModel(s: GameState, content: ContentPack, profile: Readonly<Profile>): ForgeModel {
  const head = header(s, content, profile);
  const open = head.blocked === null;
  const pieces: { inst: ItemInstance; worn: boolean }[] = [
    ...Object.values(s.player.equipment)
      .filter((i): i is ItemInstance => i !== null)
      .map((inst) => ({ inst, worn: true })),
    ...s.player.inventory.filter((i) => content.items[i.itemId]?.slot !== undefined).map((inst) => ({ inst, worn: false })),
  ];
  const upgrade: UpgradeRow[] = open
    ? pieces
        .filter(({ inst }) => content.items[inst.itemId]?.upgradeable === true)
        .map(({ inst, worn }) => {
          const q = upgradeQuote(s, content, profile, inst.uid);
          const target = nextRarity(inst.rarity);
          return { row: itemRow(content, inst), worn, target: target === undefined ? null : RARITY_LABEL[target], why: typeof q === 'string' ? q : null };
        })
    : [];
  const craft: RecipeRow[] = open
    ? knownRecipes(s, content, profile).map((r) => {
        const q = craftQuote(s, content, profile, r.id);
        return { id: r.id, name: r.name, category: r.category, outputName: nameOf(content, r.output.itemId), why: typeof q === 'string' ? q : null, story: r.story };
      })
    : [];
  const salvage: SalvageRow[] = open
    ? s.player.inventory
        .filter((i) => content.items[i.itemId]?.slot !== undefined && !inSatchel(content.items[i.itemId]))
        .map((inst) => {
          const q = salvageQuote(s, content, profile, inst.uid);
          return { row: itemRow(content, inst), why: typeof q === 'string' ? q : null };
        })
    : [];
  return {
    header: head,
    upgrade,
    craft,
    salvage,
    tabs: open
      ? [
          { id: 'upgrade', label: 'Upgrade', count: upgrade.length },
          { id: 'craft', label: 'Craft', count: craft.length },
          { id: 'salvage', label: 'Salvage', count: salvage.length },
        ]
      : [],
  };
}

// ---- upgrade ------------------------------------------------------------------------------------------------------------------

export interface AffixOffer {
  id: string;
  suffix: string;
  text: string;
  chosen: boolean;
}

export interface UpgradeDetail {
  uid: string;
  facts: ItemFacts;
  worn: boolean;
  /** The piece as it will be (null at the top). */
  after: ItemFacts | null;
  target: Rarity | null;
  targetLabel: string | null;
  bill: BillModel | null;
  fee: number | null;
  feeLine: string | null;
  repLine: string | null;
  timeLine: string | null;
  offers: AffixOffer[];
  /** A new affix slot opens and one of the offers must be chosen. */
  needsChoice: boolean;
  action: PanelAction;
  /** Said when nothing can be done at all (top of the ladder, cannot be upgraded). */
  note: string | null;
}

export function upgradeDetail(
  s: GameState,
  content: ContentPack,
  profile: Readonly<Profile>,
  uid: string,
  affixId: string | null,
  isLegal: (a: Action) => boolean,
): UpgradeDetail | null {
  const inst = s.player.inventory.find((i) => i.uid === uid) ?? Object.values(s.player.equipment).find((i) => i?.uid === uid) ?? undefined;
  const def = inst === undefined ? undefined : content.items[inst.itemId];
  if (inst === undefined || def === undefined) return null;
  const facts = itemFacts(content, inst, { state: s, profile });
  if (facts === null) return null;
  const worn = !s.player.inventory.some((i) => i.uid === uid);
  const target = nextRarity(inst.rarity);
  const dud = (note: string, problem: string): UpgradeDetail => ({
    uid,
    facts,
    worn,
    after: null,
    target: null,
    targetLabel: null,
    bill: null,
    fee: null,
    feeLine: null,
    repLine: null,
    timeLine: null,
    offers: [],
    needsChoice: false,
    action: panelAction('upgrade', 'Upgrade', { type: 'upgrade', uid }, isLegal, problem),
    note,
  });
  if (!def.upgradeable) return dud(`The ${def.name} cannot be upgraded.`, `The ${def.name} cannot be upgraded`);
  if (target === undefined || target === 'common') return dud('Nothing is finer than Legendary.', `The ${def.name} is Legendary; nothing is finer`);

  const quote = upgradeQuote(s, content, profile, uid);
  // the engine's rule (crafting.ts upgradeQuote): reaching Uncommon opens no slot; Rare and up fill to their count
  const newSlots = target === 'uncommon' ? 0 : Math.max(0, MAX_AFFIXES[target] - inst.affixes.length);
  const offerIds = newSlots > 0 ? upgradeOffers(s, content, inst, def, target) : [];
  const needsChoice = newSlots > 0 && offerIds.length > 0;
  const chosen = needsChoice && affixId !== null && offerIds.includes(affixId) ? affixId : null;
  const offers: AffixOffer[] = offerIds.map((id) => {
    const affix = content.affixes[id];
    const effect = affix === undefined || def.slot === undefined ? undefined : affix[def.slot];
    return { id, suffix: affix?.suffix ?? id, text: effect?.text ?? '', chosen: id === chosen };
  });
  const after = itemFacts(content, { ...inst, rarity: target, affixes: chosen === null ? [...inst.affixes] : [...inst.affixes, chosen] }, { state: s, profile });
  const fee = forgeFee(s, content, content.config.upgradeCostMult[target] * goldValue(def, inst.rarity, content));

  let problem: string | null = null;
  let acting: Action = { type: 'upgrade', uid };
  if (typeof quote === 'string') problem = quote;
  else if (needsChoice && chosen === null) problem = 'Choose an affix for the new slot';
  else {
    acting = chosen === null ? { type: 'upgrade', uid } : { type: 'upgrade', uid, affixId: chosen };
    const checked = checkUpgrade(s, content, profile, acting as Extract<Action, { type: 'upgrade' }>);
    if (typeof checked === 'string') problem = checked;
  }
  const watches = forgeWatches(s, 1);
  const rep = UPGRADE_REP[target];
  const label = `Upgrade to ${RARITY_LABEL[target]} for ${fee} gold`;
  return {
    uid,
    facts,
    worn,
    after,
    target,
    targetLabel: RARITY_LABEL[target],
    bill: billModel(s, content, upgradeBill(def, target), uid),
    fee,
    feeLine: `Borin’s fee: ${fee} gold${forgeDiscount(s, content) > 0 ? ' (after Borin’s Favor)' : ''}. You have ${s.player.gold}.`,
    repLine: `Work to ${RARITY_LABEL[target]} needs the Ironclad Nomads at ${cap(rep)} or better.`,
    timeLine: watchText(watches),
    offers,
    needsChoice,
    action: panelAction('upgrade', label, acting, isLegal, problem, {
      primary: true,
      confirm: target === 'epic' || target === 'legendary' ? `Upgrade the ${itemName(def, inst.affixes, content)} to ${RARITY_LABEL[target]} for ${fee} gold and the materials listed? Nothing can be re-rolled afterwards.` : null,
      yes: 'Upgrade',
    }),
    note: null,
  };
}

// ---- craft ----------------------------------------------------------------------------------------------------------------------

export interface CraftDetail {
  id: string;
  name: string;
  category: string;
  story: boolean;
  output: ItemFacts;
  count: number;
  /** Gear gets its affixes when it is forged. */
  rollsAffixes: boolean;
  bill: BillModel;
  fee: number;
  feeLine: string;
  repLine: string | null;
  timeLine: string;
  action: PanelAction;
}

export function craftDetail(s: GameState, content: ContentPack, profile: Readonly<Profile>, recipeId: string, isLegal: (a: Action) => boolean): CraftDetail | null {
  const recipe = content.recipes[recipeId];
  const def = recipe === undefined ? undefined : content.items[recipe.output.itemId];
  if (recipe === undefined || def === undefined) return null;
  const rarity = recipe.output.rarity ?? def.fixedRarity;
  const output = itemFacts(content, { uid: 'preview', itemId: def.id, qty: recipe.output.count, rarity, affixes: [] }, null);
  if (output === null) return null;
  const quote = craftQuote(s, content, profile, recipeId);
  const fee = recipe.story ? 0 : forgeFee(s, content, recipe.gold);
  const tier = recipeTier(s, recipe);
  const bill: Bill = {
    fixed: recipe.inputs.map((i) => ({ itemId: i.itemId, count: i.count })),
    anyOf: recipe.anyOf.map((g) => g.map((i) => ({ itemId: i.itemId, count: i.count }))),
  };
  const watches = forgeWatches(s, recipe.timeCost);
  const rolls = def.slot !== undefined && MAX_AFFIXES[rarity] > 0;
  return {
    id: recipe.id,
    name: recipe.name,
    category: CATEGORY_LABEL[recipe.category],
    story: recipe.story,
    output,
    count: recipe.output.count,
    rollsAffixes: rolls,
    bill: billModel(s, content, bill),
    fee,
    feeLine: recipe.story ? 'No fee: this one is for the story.' : `Borin’s fee: ${fee} gold${forgeDiscount(s, content) > 0 ? ' (after Borin’s Favor)' : ''}. You have ${s.player.gold}.`,
    repLine: tier === 'neutral' ? null : `Needs the Ironclad Nomads at ${cap(tier)} or better.`,
    timeLine: watchText(watches),
    action: panelAction('craft', `Craft for ${fee} gold`, { type: 'craft', recipeId }, isLegal, typeof quote === 'string' ? quote : null, { primary: true }),
  };
}

// ---- salvage ---------------------------------------------------------------------------------------------------------------------

export interface SalvageDetail {
  uid: string;
  facts: ItemFacts;
  /** What it breaks down into: "Wildling Hide × 1". */
  yields: string[];
  action: PanelAction;
}

export function salvageDetail(s: GameState, content: ContentPack, profile: Readonly<Profile>, uid: string, isLegal: (a: Action) => boolean): SalvageDetail | null {
  const inst = s.player.inventory.find((i) => i.uid === uid);
  const def = inst === undefined ? undefined : content.items[inst.itemId];
  if (inst === undefined || def === undefined) return null;
  const facts = itemFacts(content, inst, { state: s, profile });
  if (facts === null) return null;
  const quote = salvageQuote(s, content, profile, uid);
  const yields = typeof quote === 'string' ? [] : quote.yields.map((y) => `${nameOf(content, y.itemId)} × ${y.count}`);
  return {
    uid,
    facts,
    yields,
    action: panelAction('salvage', 'Salvage', { type: 'salvage', uid }, isLegal, typeof quote === 'string' ? quote : null, {
      danger: true,
      confirm: `Break down the ${facts.name} (${RARITY_LABEL[inst.rarity]})? ${yields.length === 0 ? '' : `You get ${yields.join(', ')}. `}The piece is destroyed and pays no gold.`,
      yes: 'Break it down',
    }),
  };
}

/** The accessible name of an upgrade row: "Short Bow, Common bow, worn, can be Uncommon". */
export function upgradeLabel(u: UpgradeRow): string {
  const base = `${u.row.name}, ${u.row.rarityLabel} ${u.row.typeLabel.toLowerCase()}${u.worn ? ', worn' : ''}`;
  return u.target === null ? `${base}, finest already` : `${base}, to ${u.target}${u.why === null ? '' : ', not possible now'}`;
}

export function recipeLabel(r: RecipeRow): string {
  return `${r.name}, ${categoryLabel(r.category).toLowerCase()}${r.why === null ? ', ready to craft' : ', cannot be crafted now'}`;
}
