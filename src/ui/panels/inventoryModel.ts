// What the Inventory and Equipment panel draws (PLAN §6.3 `InventoryPanel`, DESIGN §7.1, §7.8–7.9, §16.3 `screen_inventory`),
// as pure functions of the state and the pack: the four equipment slots (the paper doll, as a list), the pack's stacks with
// the 40-slot counter and type filters, the Satchel (quest and key items, which take no slot), and — for whatever is chosen —
// its card, its comparison with what is worn, and the actions that apply with the engine's own reason when one is off.
// The panel is also reachable in a fight (Shift+I), where every change is off and says so (DESIGN §7.9: items are used from
// the fight's own Item action).
import {
  EQUIP_SLOTS,
  PACK_SLOTS,
  checkDrop,
  checkEquip,
  checkReadBook,
  checkUnequip,
  checkUse,
  goldValue,
  inSatchel,
  packSlotsUsed,
  slotsFor,
  type Action,
  type ContentPack,
  type EquipSlot,
  type GameState,
  type ItemInstance,
  type Profile,
} from '@engine/index';
import type { Item } from '@schema/item';
import {
  RARITY_LABEL,
  SLOT_LABEL,
  compareToWorn,
  itemFacts,
  itemRow,
  type CompareModel,
  type ItemFacts,
  type ItemRowModel,
} from './itemModel';
import { notExploring, panelAction, type PanelAction } from './panelAction';

export type PackFilter = 'all' | 'gear' | 'consumable' | 'material' | 'other';

export const FILTERS: readonly { id: PackFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'gear', label: 'Gear' },
  { id: 'consumable', label: 'Consumables' },
  { id: 'material', label: 'Materials' },
  { id: 'other', label: 'Other' },
];

/** DESIGN §7.8 groups: which filter a type belongs to. */
export function filterOf(type: Item['type']): Exclude<PackFilter, 'all'> {
  if (type === 'weapon' || type === 'armor' || type === 'trinket') return 'gear';
  if (type === 'consumable') return 'consumable';
  if (type === 'material') return 'material';
  return 'other';
}

/** A stack worth at least this in gold (or any Rare-or-better piece) asks before it is dropped. */
export const VALUABLE_GOLD = 50;

export interface SlotRow {
  /** The selection id: `slot:weapon`. */
  id: string;
  slot: EquipSlot;
  label: string;
  item: ItemRowModel | null;
}

export interface InventoryModel {
  slots: SlotRow[];
  /** The pack after the filter. */
  pack: ItemRowModel[];
  satchel: ItemRowModel[];
  filters: { id: PackFilter; label: string; count: number }[];
  used: number;
  max: number;
  full: boolean;
  gold: number;
  /** Why nothing can be changed now (a fight is on); null while exploring. */
  readOnly: string | null;
}

const ORDER: Record<Exclude<PackFilter, 'all'>, number> = { gear: 0, consumable: 1, material: 2, other: 3 };

export const byKind = (a: ItemRowModel, b: ItemRowModel): number => ORDER[filterOf(a.type)] - ORDER[filterOf(b.type)] || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export const slotId = (slot: EquipSlot): string => `slot:${slot}`;

export function inventoryModel(s: GameState, content: ContentPack, filter: PackFilter): InventoryModel {
  const rows: ItemRowModel[] = [];
  const satchel: ItemRowModel[] = [];
  for (const inst of s.player.inventory) {
    const row = itemRow(content, inst);
    (inSatchel(content.items[inst.itemId]) ? satchel : rows).push(row);
  }
  rows.sort(byKind);
  const count = (f: PackFilter): number => (f === 'all' ? rows.length : rows.filter((r) => filterOf(r.type) === f).length);
  const used = packSlotsUsed(s, content);
  return {
    slots: EQUIP_SLOTS.map((slot) => {
      const inst = s.player.equipment[slot];
      return { id: slotId(slot), slot, label: SLOT_LABEL[slot], item: inst === null ? null : itemRow(content, inst) };
    }),
    pack: filter === 'all' ? rows : rows.filter((r) => filterOf(r.type) === filter),
    satchel: satchel.sort(byKind),
    filters: FILTERS.map((f) => ({ ...f, count: count(f.id) })),
    used,
    max: PACK_SLOTS,
    full: used >= PACK_SLOTS,
    gold: s.player.gold,
    readOnly: notExploring(s.mode),
  };
}

// ---- the chosen thing ---------------------------------------------------------------------------------------------------

export type Picked =
  | { kind: 'slot'; slot: EquipSlot; inst: ItemInstance | null }
  | { kind: 'item'; inst: ItemInstance; slot: EquipSlot | null };

/** The selection id (`slot:weapon` or an item uid) as what it names now, or null when it names nothing any more. */
export function resolveSelection(s: GameState, selected: string | null): Picked | null {
  if (selected === null) return null;
  if (selected.startsWith('slot:')) {
    const slot = EQUIP_SLOTS.find((x) => slotId(x) === selected);
    return slot === undefined ? null : { kind: 'slot', slot, inst: s.player.equipment[slot] };
  }
  const worn = EQUIP_SLOTS.find((slot) => s.player.equipment[slot]?.uid === selected);
  if (worn !== undefined) return { kind: 'item', inst: s.player.equipment[worn] as ItemInstance, slot: worn };
  const inst = s.player.inventory.find((i) => i.uid === selected);
  return inst === undefined ? null : { kind: 'item', inst, slot: null };
}

/** What the panel opens on: the weapon slot. */
export const DEFAULT_SELECTION = slotId('weapon');

export interface InventoryDetail {
  /** The id of the row it belongs to (the slot's, or the item's uid). */
  id: string;
  /** Empty slot: its label and a sentence; otherwise the item's facts. */
  slotLabel: string | null;
  wornIn: EquipSlot | null;
  facts: ItemFacts | null;
  compare: CompareModel[];
  actions: PanelAction[];
  note: string | null;
}

const raisesCorruption = (def: Item): boolean => def.onUse.some((e) => 'corruption' in e && e.corruption > 0);

/** "Drop 3 × Hide, worth 24 gold?" — the question a drop of something that matters asks, or null for a trifle. */
export function dropQuestion(def: Item, inst: ItemInstance, qty: number, content: ContentPack): string | null {
  const worth = goldValue(def, inst.rarity, content) * qty;
  const named = qty > 1 ? `${qty} × ${def.name}` : def.name;
  if (inst.boundQuest !== undefined) return `${named} was given to you for a quest. Drop it anyway? It stays on the ground until the next dawn.`;
  const precious = (def.slot !== undefined && inst.rarity !== 'common' && inst.rarity !== 'uncommon') || worth >= VALUABLE_GOLD || def.tags.includes('key');
  if (!precious) return null;
  return `Drop ${named}${def.slot !== undefined ? ` (${RARITY_LABEL[inst.rarity]})` : ''}, worth ${worth} gold? It stays on the ground until the next dawn.`;
}

/** The Delete key's question: it always asks, whatever the item. */
export function deleteQuestion(def: Item, inst: ItemInstance, content: ContentPack): string {
  return dropQuestion(def, inst, inst.qty, content) ?? `Drop ${inst.qty > 1 ? `${inst.qty} × ${def.name}` : def.name}? It stays on the ground until the next dawn.`;
}

const problemOf = (r: unknown): string | null => (typeof r === 'string' ? r : null);

export function inventoryDetail(
  s: GameState,
  content: ContentPack,
  profile: Readonly<Profile>,
  picked: Picked,
  isLegal: (a: Action) => boolean,
): InventoryDetail {
  const gate = notExploring(s.mode);
  if (picked.kind === 'slot' && picked.inst === null) {
    return {
      id: slotId(picked.slot),
      slotLabel: SLOT_LABEL[picked.slot],
      wornIn: null,
      facts: null,
      compare: [],
      actions: [],
      note: `Nothing is worn in the ${SLOT_LABEL[picked.slot].toLowerCase()} slot. Choose a piece in your pack to wear it here.`,
    };
  }
  const inst = picked.inst as ItemInstance;
  const def = content.items[inst.itemId];
  const facts = itemFacts(content, inst, { state: s, profile });
  if (def === undefined || facts === null) {
    return { id: inst.uid, slotLabel: null, wornIn: picked.kind === 'slot' ? picked.slot : picked.slot, facts: null, compare: [], actions: [], note: 'This item is not in the game’s world any more.' };
  }
  const worn = picked.slot;
  const actions: PanelAction[] = [];
  if (worn !== null) {
    const a: Action = { type: 'unequip', slot: worn };
    actions.push(panelAction('unequip', 'Take off', a, isLegal, gate ?? problemOf(checkUnequip(s, content, { type: 'unequip', slot: worn })), { primary: true }));
  } else {
    const slots = slotsFor(def);
    for (const slot of slots) {
      const a: Action = def.slot === 'trinket' ? { type: 'equip', uid: inst.uid, slot } : { type: 'equip', uid: inst.uid };
      const label = slots.length > 1 ? `Wear as ${SLOT_LABEL[slot].toLowerCase()}` : 'Wear';
      actions.push(panelAction(`equip-${slot}`, label, a, isLegal, gate ?? problemOf(checkEquip(s, content, profile, { type: 'equip', uid: inst.uid, slot })), { primary: slot === slots[0] }));
    }
    if (def.type === 'tome') {
      const a: Action = { type: 'readBook', uid: inst.uid };
      const corrupting = raisesCorruption(def);
      const cost = def.onUse.map((e) => ('damage' in e ? (e.damage as { hp?: number }).hp : undefined)).find((n) => typeof n === 'number');
      const next = Math.min(content.config.corruptionMax, s.player.corruption + 1);
      const confirm = corrupting
        ? `Read the ${def.name}? ${cost === undefined ? '' : `It costs ${cost} HP. `}It raises your Corruption from ${s.player.corruption} to ${next} (of ${content.config.corruptionMax}), and that cannot be undone.`
        : null;
      actions.push(panelAction('read', 'Read', a, isLegal, gate ?? problemOf(checkReadBook(s, content, a)), { confirm, yes: 'Read it', primary: true }));
    } else if (def.type === 'consumable' || def.onUse.length > 0 || def.passives.some((p) => p.kind === 'custom')) {
      const a: Action = { type: 'use', uid: inst.uid };
      if (def.type !== 'material') actions.push(panelAction('use', 'Use', a, isLegal, gate ?? problemOf(checkUse(s, content, a, profile)), { primary: true }));
    }
    const dropAll: Action = { type: 'drop', uid: inst.uid };
    actions.push(
      panelAction('drop', inst.qty > 1 ? `Drop all ${inst.qty}` : 'Drop', dropAll, isLegal, gate ?? problemOf(checkDrop(s, content, dropAll)), {
        confirm: dropQuestion(def, inst, inst.qty, content),
        yes: 'Drop it',
      }),
    );
    if (inst.qty > 1) {
      const one: Action = { type: 'drop', uid: inst.uid, qty: 1 };
      actions.push(panelAction('drop-one', 'Drop one', one, isLegal, gate ?? problemOf(checkDrop(s, content, one)), { confirm: dropQuestion(def, inst, 1, content), yes: 'Drop it' }));
    }
  }
  return {
    id: inst.uid,
    slotLabel: worn === null ? null : SLOT_LABEL[worn],
    wornIn: worn,
    facts,
    compare: def.slot !== undefined ? compareToWorn(s, content, inst) : [],
    actions,
    note: worn !== null ? `Worn in the ${SLOT_LABEL[worn].toLowerCase()} slot.` : null,
  };
}

/** The accessible name of a slot row: "Trinket 2: empty" or "Weapon: Short Bow, Common bow, worn". */
export function slotLabel(row: SlotRow): string {
  return row.item === null ? `${row.label}: empty` : `${row.label}: ${row.item.name}, ${row.item.rarityLabel} ${row.item.typeLabel.toLowerCase()}`;
}
