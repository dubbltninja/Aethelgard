// Inventory and character reducers (PLAN §4.6, §8.1; DESIGN §6.3, §6.7, §7.1, §7.8–7.9): use, equip/unequip, drop,
// allocateStat, unlockAbility, readBook and respec, each with its `legalActions` enumerator. Reducer and enumerator
// share one check per action (`check*` returns the rejection text, or what the reducer needs), so they cannot
// disagree. Also the character post-step hook: the Weaver mark when Corruption reaches its maximum (any source) and
// the stored maxima kept equal to `derive()` outside combat.
//
// Enumeration (PLAN §4.7 limits): `use`/`readBook` one per stack uid; `equip` one per gear uid — weapons and armor
// without a slot (it is implied), trinkets once per trinket slot; `drop` one per distinct itemId, whole stack;
// `allocateStat` three actions while points remain; `unlockAbility` every unlockable tree ability.
import type { Effect } from '@schema/effect';
import type { Item } from '@schema/item';
import { anchorOnTheRim, onTheRim } from '../before';
import { dayOf, evaluate, explain, hasEcho } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { EQUIP_SLOTS, GEAR_SCRIPT, STAT_NAMES, itemScript, syncMaxima } from '../derived';
import { PREP_USE } from '../combat/gear';
import { swapCompanion } from '../combat/companionAi';
import { apply, applyAll, changeLimit, leaveOnGround } from '../effects';
import type { Enumerator } from '../legalActions';
import { RESPEC_GOLD_PER_LEVEL, masteredFor, respecPlan, unlockCostHalf, unlockProblem, type RespecPlan } from '../progression';
import type { Handler } from '../step';
import type { ActionOf } from '../types/actions';
import type { Profile } from '../types/profile';
import type { EquipSlot, Equipment, GameState, ItemInstance } from '../types/state';

/** DESIGN §7.8: 40 stack slots; quest and key items live in the Satchel and do not count. */
export const PACK_SLOTS = 40;
export const SATCHEL_TYPES: readonly Item['type'][] = ['quest', 'key'];
/** DESIGN §6.3 "at any camp fire": safe and wild camps. */
export const RESPEC_REST_KINDS: readonly string[] = ['camp', 'wild'];
/** DESIGN §6.7: with this Echo the first Dark Spellbook read each loop costs no HP. */
export const KORR_MARGINALIA_ECHO = 'echo_korr_marginalia';
/** DESIGN §6.7 / D-017: reaching the Corruption maximum marks you for the Weavers. */
export const WEAVER_MARK = { faction: 'remnants', rep: -10, watches: -4 } as const;
/** Legacy line kept (DESIGN §6.7): the seventh book cannot be read. */
export const SEEN_TOO_MUCH = "I've already seen too much. Better to avoid any furtherance into dark spells before it corrupts the mind.";
/** `player.uses` keys. */
export const USES_RESPEC = 'respec';
export const USES_SPELLBOOKS = 'spellbooksRead';
/** U34e: the corrupting reads alone (the Margins' HP waiver is the first of them). */
export const USES_DARK_SPELLBOOKS = 'darkSpellbooksRead';

export type InventoryActionType = 'use' | 'equip' | 'unequip' | 'drop' | 'allocateStat' | 'unlockAbility' | 'readBook' | 'respec';

// ---- shared helpers ---------------------------------------------------------------------------------------------------

interface Held {
  inst: ItemInstance;
  def: Item;
}

function held(s: GameState, content: ContentPack, uid: string): Held | string {
  const inst = s.player.inventory.find((i) => i.uid === uid);
  if (!inst) return 'You are not carrying that';
  const def = content.items[inst.itemId];
  if (!def) throw new Error(`inventory: unknown item '${inst.itemId}' (${uid})`);
  return { inst, def };
}

/** Satchel items (DESIGN §7.1, §7.8): quest and key items, incl. gear tagged `key` (Chronos Lens). */
export const inSatchel = (def: Item | undefined): boolean => def !== undefined && (SATCHEL_TYPES.includes(def.type) || def.tags.includes('key'));

/** Pack slots in use (DESIGN §7.8): every inventory stack except Satchel items. */
export function packSlotsUsed(s: GameState, content: ContentPack): number {
  return s.player.inventory.filter((i) => !inSatchel(content.items[i.itemId])).length;
}

/** The equipment slots an item fits (none for non-gear). */
export function slotsFor(def: Item): EquipSlot[] {
  if (def.slot === 'weapon' || def.slot === 'armor') return [def.slot];
  if (def.slot === 'trinket') return ['trinket1', 'trinket2'];
  return [];
}

/** The slot an equip without one uses: the item's own, or the first free trinket slot (else trinket 1). */
function autoSlot(equipment: Equipment, def: Item): EquipSlot {
  const slots = slotsFor(def);
  return slots.find((slot) => equipment[slot] === null) ?? (slots[0] as EquipSlot);
}

const copy = (inst: ItemInstance): ItemInstance => ({ ...inst, affixes: [...inst.affixes] });

function removeOne(ctx: StepCtx, inst: ItemInstance): void {
  const inventory = ctx.s.player.inventory;
  inst.qty -= 1;
  if (inst.qty <= 0) inventory.splice(inventory.indexOf(inst), 1);
  ctx.emit({ t: 'itemLost', itemId: inst.itemId, qty: 1, reason: 'used' });
}

const raisesCorruption = (def: Item): boolean => def.onUse.some((e) => 'corruption' in e && e.corruption > 0);

// ---- checks (one per action; the reducer and the enumerator both call it) ---------------------------------------------

export function checkUse(s: GameState, content: ContentPack, action: ActionOf<'use'>, profile?: Readonly<Profile>): Held | string {
  if (action.targetUid !== undefined) return 'There is nothing to target outside combat';
  const h = held(s, content, action.uid);
  if (typeof h === 'string') return h;
  if (h.def.type === 'tome') return `Read the ${h.def.name} instead`;
  const scripted = USE_SCRIPTS.some((id) => itemScript(h.def, id) !== undefined);
  if (h.def.onUse.length === 0 && !scripted) return `${h.def.name} cannot be used`;
  if (!h.def.usableOutOfCombat) return `${h.def.name} can only be used in combat`;
  const why = useScriptProblem(s, content, profile, h.def);
  return why ?? h;
}

// ---- U34e: item use scripts (D-099, D-101; combat/gear.ts reads what they prepare) ---------------------------------------------

/** The `custom` scripts an out-of-combat `use` carries out (besides the item's `onUse` effects). */
export const USE_SCRIPTS: readonly string[] = [
  GEAR_SCRIPT.cleanse,
  GEAR_SCRIPT.whetstoneStrip,
  GEAR_SCRIPT.remnantInk,
  GEAR_SCRIPT.lanternOilWard,
  GEAR_SCRIPT.keepersCopy,
  GEAR_SCRIPT.scoutsWhistle,
];
/** `player.uses` key prefix of a ward used out of combat (`ward:<itemId>`, day = the Breach-Clock day it holds through). */
export const WARD_USE = 'ward:';
/** The verse Echoes the Keeper's Copy re-reads (STORY §12's Litany, verses 1–9). */
export const VERSE_ECHO_RE = /^echo_litany_verse_\d+$/;
/** Rest kinds that count as a camp for the Scout's Whistle (WORLD §7: "at any camp"). */
export const CAMP_REST_KINDS: readonly string[] = ['camp', 'wild'];

/** The verse Echoes the player holds (this loop or the profile), in order. */
function versesHeld(s: GameState, profile: Readonly<Profile> | undefined, content: ContentPack): string[] {
  return Object.keys(content.echoes)
    .filter((id) => VERSE_ECHO_RE.test(id) && (s.echoesThisLoop.includes(id) || (profile?.echoes.includes(id) ?? false)))
    .sort();
}

/** Why a scripted use cannot happen now (the Keeper's Copy with no verse held; the Whistle away from a camp), or null. */
function useScriptProblem(s: GameState, content: ContentPack, profile: Readonly<Profile> | undefined, def: Item): string | null {
  if (itemScript(def, GEAR_SCRIPT.keepersCopy) !== undefined && versesHeld(s, profile, content).length === 0) return 'You hold no verse of the Litany to read again';
  const whistle = itemScript(def, GEAR_SCRIPT.scoutsWhistle);
  if (whistle !== undefined) {
    const rest = content.locations[s.world.currentLocationId]?.rest;
    if (!rest || !CAMP_REST_KINDS.includes(rest.kind) || (rest.when !== undefined && profile !== undefined && !evaluate(rest.when, s, profile, content))) return `${def.name} carries only at a camp`;
    const id = typeof whistle.companion === 'string' ? whistle.companion : '';
    const c = s.companions.recruited[id];
    const name = content.companions[id]?.name ?? id;
    if (!c || !c.recruited || c.dead) return `${name} is not one of your companions`;
    if (s.companions.activeId === id) return `${name} is already with you`;
    if (c.ko) return `${name} is down`;
    const active = s.companions.activeId === null ? undefined : s.companions.recruited[s.companions.activeId];
    if (active?.ko) return `${content.companions[active.id]?.name ?? active.id} is down; they cannot be sent away until revived`;
  }
  return null;
}

/** An out-of-combat `use`'s scripts (after its `onUse` effects): see USE_SCRIPTS. */
function applyUseScripts(ctx: StepCtx, def: Item): void {
  const { s, content } = ctx;
  const player = s.player;
  const cleanseIds = itemScript(def, GEAR_SCRIPT.cleanse)?.statuses;
  if (Array.isArray(cleanseIds)) {
    const gone = player.statuses.filter((st) => cleanseIds.includes(st.statusId));
    player.statuses = player.statuses.filter((st) => !gone.includes(st));
    for (const st of gone) ctx.emit({ t: 'statusExpired', targetUid: 'player', statusId: st.statusId });
  }
  const whetstone = itemScript(def, GEAR_SCRIPT.whetstoneStrip);
  if (whetstone !== undefined && typeof whetstone.basicAttacks === 'number') {
    player.uses[`${PREP_USE}${def.id}`] = { loop: s.meta.loop, count: whetstone.basicAttacks };
    ctx.log(`You work the ${def.name} along the edge.`, 'event');
  }
  if (itemScript(def, GEAR_SCRIPT.remnantInk) !== undefined) {
    player.uses[`${PREP_USE}${def.id}`] = { loop: s.meta.loop, count: 1 };
    ctx.log('You write the ward on your skin. It will hold once.', 'event');
  }
  if (itemScript(def, GEAR_SCRIPT.lanternOilWard) !== undefined) {
    player.uses[`${WARD_USE}${def.id}`] = { day: dayOf(s.clock.ticks) };
    ctx.log(`You trim your lamp with the ${def.name}. Nothing in the dark will take your sight before dawn.`, 'event');
  }
  if (itemScript(def, GEAR_SCRIPT.keepersCopy) !== undefined) {
    ctx.log(`You read the ${def.name} again.`, 'event');
    for (const id of versesHeld(s, ctx.profile, content)) {
      const echo = content.echoes[id];
      if (echo) ctx.log(`${echo.name}: ${echo.codexLine}`, 'event');
    }
  }
  const whistle = itemScript(def, GEAR_SCRIPT.scoutsWhistle);
  if (whistle !== undefined && typeof whistle.companion === 'string') {
    ctx.log('One note. Somewhere out past the fire, someone answers it.', 'event');
    swapCompanion(ctx, whistle.companion);
  }
}

/** Lantern Oil's ward (`lantern_oil_ward`): used out of combat today, it keeps `statusId` off the player at an ambush's onset. */
export function wardHolds(s: GameState, content: ContentPack, statusId: string): boolean {
  const today = dayOf(s.clock.ticks);
  for (const [key, use] of Object.entries(s.player.uses)) {
    if (!key.startsWith(WARD_USE) || use.day !== today) continue;
    const def = content.items[key.slice(WARD_USE.length)];
    if (def && itemScript(def, GEAR_SCRIPT.lanternOilWard)?.preventsStatusOnAmbush === statusId) return true;
  }
  return false;
}

export function checkEquip(s: GameState, content: ContentPack, profile: Readonly<Profile>, action: ActionOf<'equip'>): Held | string {
  const h = held(s, content, action.uid);
  if (typeof h === 'string') return h;
  const { def } = h;
  const slots = slotsFor(def);
  if (slots.length === 0) return `${def.name} cannot be equipped`;
  if (action.slot !== undefined && !slots.includes(action.slot)) return `${def.name} does not fit the ${action.slot} slot`;
  const req = def.requirements;
  const player = s.player;
  if (req?.classIds && !(req.classIds as readonly string[]).includes(player.classId)) {
    return `Only a ${req.classIds.map((id) => content.classes[id]?.name ?? id).join(' or ')} can use ${def.name}`;
  }
  if (req?.level !== undefined && player.level < req.level) return `${def.name} requires level ${req.level}`;
  if (req?.when && !evaluate(req.when, s, profile, content)) {
    const unmet = explain(req.when, s, profile, content).parts.filter((p) => !p.ok);
    return `${def.name} requires: ${unmet.map((p) => p.text).join('; ')}`;
  }
  return h;
}

export function checkUnequip(s: GameState, content: ContentPack, action: ActionOf<'unequip'>): ItemInstance | string {
  if (!EQUIP_SLOTS.includes(action.slot)) return `There is no '${String(action.slot)}' slot`;
  const inst = s.player.equipment[action.slot];
  if (!inst) return 'Nothing is equipped there';
  if (!inSatchel(content.items[inst.itemId]) && packSlotsUsed(s, content) >= PACK_SLOTS) return 'Your pack is full';
  return inst;
}

export function checkDrop(s: GameState, content: ContentPack, action: ActionOf<'drop'>): Held | string {
  const h = held(s, content, action.uid);
  if (typeof h === 'string') return h;
  const { inst, def } = h;
  const rim = onTheRim(s, def); // U32: an anchorable item set down in the Conflux goes on the cradle's rim, bound or not (before.ts)
  if (!def.droppable && !rim) return `${def.name} cannot be dropped`;
  if (inst.boundQuest !== undefined && s.quests[inst.boundQuest]?.status === 'active' && !rim) return `${def.name} is bound to an active quest`;
  if (action.qty !== undefined && (!Number.isInteger(action.qty) || action.qty < 1 || action.qty > inst.qty)) {
    return `You cannot drop ${action.qty} of ${inst.qty}`;
  }
  return h;
}

export function checkAllocate(s: GameState, action: ActionOf<'allocateStat'>): string | null {
  if (!STAT_NAMES.includes(action.stat)) return `Unknown stat '${String(action.stat)}'`;
  if (s.player.statPoints < 1) return 'No stat points to spend';
  return null;
}

export function checkReadBook(s: GameState, content: ContentPack, action: ActionOf<'readBook'>): Held | string {
  const h = held(s, content, action.uid);
  if (typeof h === 'string') return h;
  if (h.def.type !== 'tome') return `${h.def.name} is not a book`;
  if (raisesCorruption(h.def) && s.player.corruption >= content.config.corruptionMax) return SEEN_TOO_MUCH;
  return h;
}

export function checkRespec(s: GameState, content: ContentPack, profile: Readonly<Profile>): { plan: RespecPlan; cost: number } | string {
  const rest = content.locations[s.world.currentLocationId]?.rest;
  if (!rest || !RESPEC_REST_KINDS.includes(rest.kind) || (rest.when !== undefined && !evaluate(rest.when, s, profile, content))) {
    return 'You can only rethink your path at a camp fire';
  }
  if (s.player.uses[USES_RESPEC]?.day === dayOf(s.clock.ticks)) return 'You have already rethought your path today';
  const plan = respecPlan(s, content, profile);
  if (plan.refundHalf === 0) return 'There are no ability points to refund';
  const cost = RESPEC_GOLD_PER_LEVEL * s.player.level;
  if (s.player.gold < cost) return `Rethinking your path costs ${cost} gold`;
  return { plan, cost };
}

// ---- reducers ---------------------------------------------------------------------------------------------------------

/** Out-of-combat consumable use (DESIGN §7.9): free; consumed first, then its onUse effects (heals clamp at max). */
function useItem(ctx: StepCtx, action: ActionOf<'use'>): void {
  const h = checkUse(ctx.s, ctx.content, action, ctx.profile);
  if (typeof h === 'string') return ctx.reject(h);
  if (h.def.consumeOnUse) removeOne(ctx, h.inst);
  applyAll(h.def.onUse, ctx, { source: `item:${h.def.id}` });
  applyUseScripts(ctx, h.def); // U34e: cleanse, Whetstone, Ink, Lantern Oil, Keeper's Copy, Scout's Whistle
}

/** Equip into the given or implied slot; whatever was there goes back to the pack where the new piece was. */
function equip(ctx: StepCtx, action: ActionOf<'equip'>): void {
  const h = checkEquip(ctx.s, ctx.content, ctx.profile, action);
  if (typeof h === 'string') return ctx.reject(h);
  const player = ctx.s.player;
  const slot = action.slot ?? autoSlot(player.equipment, h.def);
  const index = player.inventory.indexOf(h.inst);
  const previous = player.equipment[slot];
  if (previous) {
    player.inventory.splice(index, 1, previous);
    ctx.emit({ t: 'itemUnequipped', slot });
  } else player.inventory.splice(index, 1);
  player.equipment[slot] = h.inst;
  ctx.emit({ t: 'itemEquipped', slot, item: copy(h.inst) });
  syncMaxima(player, ctx.content);
}

function unequip(ctx: StepCtx, action: ActionOf<'unequip'>): void {
  const inst = checkUnequip(ctx.s, ctx.content, action);
  if (typeof inst === 'string') return ctx.reject(inst);
  const player = ctx.s.player;
  player.equipment[action.slot] = null;
  player.inventory.push(inst);
  ctx.emit({ t: 'itemUnequipped', slot: action.slot });
  syncMaxima(player, ctx.content);
}

/** Drops onto the current node's ground (DESIGN §7.8: it stays there until the next dawn). */
function drop(ctx: StepCtx, action: ActionOf<'drop'>): void {
  const h = checkDrop(ctx.s, ctx.content, action);
  if (typeof h === 'string') return ctx.reject(h);
  const { s } = ctx;
  const { inst } = h;
  const qty = action.qty ?? inst.qty;
  const here = s.world.currentLocationId;
  if (qty === inst.qty) {
    s.player.inventory.splice(s.player.inventory.indexOf(inst), 1);
    leaveOnGround(ctx, here, inst);
  } else {
    inst.qty -= qty;
    leaveOnGround(ctx, here, { ...copy(inst), uid: ctx.uid('i'), qty });
  }
  ctx.emit({ t: 'itemLost', itemId: inst.itemId, qty, reason: 'dropped' });
  if (onTheRim(s, h.def)) anchorOnTheRim(ctx); // U32: an Anchor (before.ts)
}

/** DESIGN §6.3: +1 to a primary per unspent point (not respeccable inside a loop). */
function allocateStat(ctx: StepCtx, action: ActionOf<'allocateStat'>): void {
  const why = checkAllocate(ctx.s, action);
  if (why) return ctx.reject(why);
  const player = ctx.s.player;
  player.stats[action.stat] += 1;
  player.statPoints -= 1;
  ctx.emit({ t: 'statAllocated', stat: action.stat, value: player.stats[action.stat] });
  syncMaxima(player, ctx.content);
}

/** DESIGN §5.1 / §6.4: tier gates, branch prerequisites, half-point cost (halved when mastered). */
function unlockAbility(ctx: StepCtx, action: ActionOf<'unlockAbility'>): void {
  const why = unlockProblem(ctx.s, ctx.content, ctx.profile, action.abilityId);
  if (why) return ctx.reject(why);
  const player = ctx.s.player;
  const ability = ctx.content.abilities[action.abilityId] as NonNullable<ContentPack['abilities'][string]>;
  player.apHalf -= unlockCostHalf(ability, masteredFor(ctx.profile, player.classId));
  player.abilitiesUnlocked.push(action.abilityId);
  ctx.emit({ t: 'abilityUnlocked', abilityId: action.abilityId });
}

/**
 * Reads a tome (DESIGN §6.7, §7.1): consumed, then its onUse effects (Dark Spellbook: −15 HP, +1 Corruption). A
 * corrupting book cannot be read at the maximum; with `echo_korr_marginalia` the first corrupting read of the loop
 * skips its HP cost. Reaching the maximum triggers the Weaver mark (post-step hook, whatever raised Corruption).
 * U34e (D-101; WORLD §7.10 `item_dark_spellbook`, `item_korrs_marginalia`): every Dark Spellbook read — and Korr's
 * Marginalia, which counts as one (`counts_as_spellbook`) — counts toward `spellbooksRead`; the third in a loop grants
 * `echo_litany_verse_2` ("the margins assemble it"), and a Dark Spellbook read with the Amulet from Loop 2 grants
 * `echo_korr_marginalia`. The HP waiver counts only corrupting reads (`darkSpellbooksRead`).
 */
function readBook(ctx: StepCtx, action: ActionOf<'readBook'>): void {
  const h = checkReadBook(ctx.s, ctx.content, action);
  if (typeof h === 'string') return ctx.reject(h);
  const { s } = ctx;
  let effects: readonly Effect[] = h.def.onUse;
  const dark = raisesCorruption(h.def);
  if (dark) {
    const read = s.player.uses[USES_DARK_SPELLBOOKS]?.count ?? 0;
    if (read === 0 && hasEcho(s, ctx.profile, KORR_MARGINALIA_ECHO)) effects = effects.filter((e) => !('damage' in e));
    s.player.uses[USES_DARK_SPELLBOOKS] = { loop: s.meta.loop, count: read + 1 };
  }
  const counted = dark || itemScript(h.def, GEAR_SCRIPT.countsAsSpellbook) !== undefined;
  const total = (s.player.uses[USES_SPELLBOOKS]?.count ?? 0) + (counted ? 1 : 0);
  if (counted) s.player.uses[USES_SPELLBOOKS] = { loop: s.meta.loop, count: total };
  if (h.def.consumeOnUse) removeOne(ctx, h.inst);
  ctx.log(`You read the ${h.def.name}.`, 'event');
  applyAll(effects, ctx, { source: `item:${h.def.id}` });
  if (counted && total >= SPELLBOOKS_FOR_VERSE && ctx.content.echoes[SPELLBOOK_VERSE_ECHO] !== undefined) apply({ grantEcho: SPELLBOOK_VERSE_ECHO }, ctx, { source: `item:${h.def.id}` });
  if (dark && s.meta.loop >= 2 && carriesAmulet(s) && ctx.content.echoes[KORR_MARGINALIA_ECHO] !== undefined) apply({ grantEcho: KORR_MARGINALIA_ECHO }, ctx, { source: `item:${h.def.id}` });
}

/** WORLD §7.10: three Dark Spellbooks read in one loop assemble the second verse. */
export const SPELLBOOKS_FOR_VERSE = 3;
export const SPELLBOOK_VERSE_ECHO = 'echo_litany_verse_2';
/** D-047: the Amulet of Echoes (carried or worn) — "read with the Amulet" (STORY §12 `echo_korr_marginalia`; = loop.ts AMULET_ITEM_ID). */
const AMULET = 'item_amulet_of_echoes';
const carriesAmulet = (s: GameState): boolean =>
  s.player.inventory.some((i) => i.itemId === AMULET) || Object.values(s.player.equipment).some((i) => i?.itemId === AMULET);

/** DESIGN §6.3: at a camp fire, 50 × level gold, once per day: every bought ability's AP comes back. */
function respec(ctx: StepCtx): void {
  const r = checkRespec(ctx.s, ctx.content, ctx.profile);
  if (typeof r === 'string') return ctx.reject(r);
  const { s } = ctx;
  const player = s.player;
  player.gold -= r.cost;
  s.counters.goldSpent += r.cost;
  ctx.emit({ t: 'goldChanged', delta: -r.cost, total: player.gold });
  player.apHalf += r.plan.refundHalf;
  player.abilitiesUnlocked = r.plan.keep;
  player.uses[USES_RESPEC] = { day: dayOf(s.clock.ticks) };
  ctx.log(`You let ${r.plan.refunded.length} abilities go and recover ${r.plan.refundHalf / 2} ability points.`, 'event');
}

export const inventoryHandlers: { readonly [K in InventoryActionType]: Handler<K> } = {
  use: useItem,
  equip,
  unequip,
  drop,
  allocateStat,
  unlockAbility,
  readBook,
  respec,
};

// ---- enumerators (PLAN §4.7) ------------------------------------------------------------------------------------------

const ok = (r: unknown): boolean => typeof r !== 'string' && r !== null;

export const inventoryEnumerators: { readonly [K in InventoryActionType]: Enumerator<K> } = {
  use: (s, content, profile) =>
    s.player.inventory.map((i): ActionOf<'use'> => ({ type: 'use', uid: i.uid })).filter((a) => ok(checkUse(s, content, a, profile))),
  equip: (s, content, profile) => {
    const out: ActionOf<'equip'>[] = [];
    for (const inst of s.player.inventory) {
      const def = content.items[inst.itemId];
      if (!def || def.slot === undefined) continue;
      const candidates: ActionOf<'equip'>[] =
        def.slot === 'trinket' ? slotsFor(def).map((slot) => ({ type: 'equip', uid: inst.uid, slot })) : [{ type: 'equip', uid: inst.uid }];
      for (const a of candidates) if (ok(checkEquip(s, content, profile, a))) out.push(a);
    }
    return out;
  },
  unequip: (s, content) =>
    EQUIP_SLOTS.map((slot): ActionOf<'unequip'> => ({ type: 'unequip', slot })).filter((a) => ok(checkUnequip(s, content, a))),
  drop: (s, content) => {
    const seen = new Set<string>();
    const out: ActionOf<'drop'>[] = [];
    for (const inst of s.player.inventory) {
      if (seen.has(inst.itemId)) continue;
      const a: ActionOf<'drop'> = { type: 'drop', uid: inst.uid };
      if (!ok(checkDrop(s, content, a))) continue;
      seen.add(inst.itemId);
      out.push(a);
    }
    return out;
  },
  allocateStat: (s) => (s.player.statPoints > 0 ? STAT_NAMES.map((stat) => ({ type: 'allocateStat', stat })) : []),
  unlockAbility: (s, content, profile) =>
    (content.index.abilitiesByClass[s.player.classId] ?? [])
      .filter((id) => unlockProblem(s, content, profile, id) === null)
      .map((abilityId) => ({ type: 'unlockAbility', abilityId })),
  readBook: (s, content) =>
    s.player.inventory.map((i): ActionOf<'readBook'> => ({ type: 'readBook', uid: i.uid })).filter((a) => ok(checkReadBook(s, content, a))),
  respec: (s, content, profile) => (ok(checkRespec(s, content, profile)) ? [{ type: 'respec' }] : []),
};

// ---- post-step hook ---------------------------------------------------------------------------------------------------

/** DESIGN §6.7 "Marked for the Weavers": Remnants −10 and the Breach Clock −4 watches (subject to the floor). */
export function markForWeavers(ctx: StepCtx): void {
  apply({ rep: { faction: WEAVER_MARK.faction, delta: WEAVER_MARK.rep } }, ctx, { source: 'corruption' });
  changeLimit(ctx, WEAVER_MARK.watches, 'corruption');
  ctx.log('You are Marked for the Weavers.', 'event');
}

/**
 * Runs after every accepted action (PLAN §4.6 post-step hooks): one Weaver mark per rise of Corruption to its maximum
 * this step (whatever caused it), then — outside combat, where the Combatant snapshot owns the numbers — the stored
 * maxima re-derived (picking up the Amulet, an upgraded or lost piece of gear, a level, Corruption …).
 */
export function characterPostStep(ctx: StepCtx): void {
  const { s, content } = ctx;
  const max = content.config.corruptionMax;
  let marks = 0;
  for (const e of ctx.events) if (e.t === 'corruptionChanged' && e.value >= max && e.value - e.delta < max) marks += 1;
  for (let i = 0; i < marks; i++) markForWeavers(ctx);
  if (s.combat === null && content.classes[s.player.classId]) syncMaxima(s.player, content);
}
