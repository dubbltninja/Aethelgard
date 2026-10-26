// What an item looks like in words (DESIGN §7, §17.4; PLAN §6.3), as pure functions of the pack and the state, shared by
// the Inventory, the Merchant and the Forge: its display name with the affixes' suffixes, rarity and type labels, the stats
// at its rarity, each affix and passive in plain words, what it asks of the wearer, its worth, and — for gear — the
// change in the Wayfinder's own numbers if it were worn in place of what is worn now (`derive`, the same function combat
// reads, so a delta is never a guess). Nothing here dispatches or decides legality.
import {
  EQUIP_SLOTS,
  derive,
  explain,
  goldValue,
  itemStats,
  slotsFor,
  type ContentPack,
  type Derived,
  type GameState,
  type ItemInstance,
  type PlayerState,
  type Profile,
} from '@engine/index';
import type { Item, ItemStats, Passive } from '@schema/item';
import type { EquipSlot, Rarity } from '@engine/index';

export const RARITY_LABEL: Readonly<Record<Rarity, string>> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

/** DESIGN §17.4: Common plain, Uncommon dotted, Rare dashed, Epic double, Legendary double with corner marks. */
export type RarityPattern = 'plain' | 'dotted' | 'dashed' | 'double' | 'double-marks';
export const RARITY_PATTERN: Readonly<Record<Rarity, RarityPattern>> = {
  common: 'plain',
  uncommon: 'dotted',
  rare: 'dashed',
  epic: 'double',
  legendary: 'double-marks',
};

export const TYPE_LABEL: Readonly<Record<Item['type'], string>> = {
  weapon: 'Weapon',
  armor: 'Armor',
  trinket: 'Trinket',
  consumable: 'Consumable',
  material: 'Material',
  quest: 'Quest item',
  key: 'Key item',
  recipe: 'Recipe',
  tome: 'Tome',
};

const WEAPON_LABEL: Readonly<Record<NonNullable<Item['weaponType']>, string>> = {
  melee: 'Melee weapon',
  ranged_bow: 'Bow',
  magic_staff: 'Staff',
  shield_heavy: 'Heavy shield',
  void_focus: 'Void focus',
};

export const SLOT_LABEL: Readonly<Record<EquipSlot, string>> = {
  weapon: 'Weapon',
  armor: 'Armor',
  trinket1: 'Trinket 1',
  trinket2: 'Trinket 2',
};

const STAT_LABEL: Readonly<Record<keyof ItemStats, string>> = {
  power: 'Power',
  spellPower: 'Spell power',
  armor: 'Armor',
  ward: 'Ward',
  strength: 'Strength',
  magic: 'Magic',
  agility: 'Agility',
  hpMax: 'Max HP',
  mpMax: 'Max MP',
  hpMaxPct: 'Max HP',
  crit: 'Crit chance',
  accuracy: 'Accuracy',
  evasion: 'Evasion',
  initiative: 'Initiative',
};

export const signed = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);
const cap = (s: string): string => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1));
const humanize = (id: string): string => cap(id.replace(/^(status_|affix_|item_|mat_)/, '').replace(/_/g, ' '));

// ---- names ---------------------------------------------------------------------------------------------------------------

/** "Warrior's Sword of Embers and the Gale": the base name with each affix's suffix appended (DESIGN §7.3). */
export function itemName(def: Pick<Item, 'name'>, affixes: readonly string[], content: ContentPack): string {
  const suffixes = affixes.map((id) => content.affixes[id]?.suffix).filter((s): s is string => s !== undefined);
  if (suffixes.length === 0) return def.name;
  const [first, ...rest] = suffixes;
  return `${def.name} ${[first, ...rest.map((s) => s.replace(/^of\s+/, ''))].join(' and ')}`;
}

/** The pack's name for an instance, or its id when the pack no longer has the item. */
export function instName(content: ContentPack, inst: Pick<ItemInstance, 'itemId' | 'affixes'>): string {
  const def = content.items[inst.itemId];
  return def === undefined ? inst.itemId : itemName(def, inst.affixes, content);
}

export function typeLine(def: Item): string {
  const base = def.weaponType !== undefined ? WEAPON_LABEL[def.weaponType] : def.armorClass !== undefined ? `${cap(def.armorClass)} armor` : TYPE_LABEL[def.type];
  return def.tier > 0 && def.slot !== undefined ? `${base} · Tier ${def.tier}` : base;
}

// ---- stats, affixes, passives, in words ------------------------------------------------------------------------------------

export interface StatLine {
  key: keyof ItemStats;
  label: string;
  value: number;
  /** "+4 Power", "+8% Max HP", "−1 Ward". */
  text: string;
}

export function statLines(stats: Readonly<ItemStats>): StatLine[] {
  const out: StatLine[] = [];
  for (const key of Object.keys(STAT_LABEL) as (keyof ItemStats)[]) {
    const value = stats[key];
    if (value === 0) continue;
    const pct = key === 'hpMaxPct';
    const amount = pct ? `${value < 0 ? '−' : '+'}${Math.round(Math.abs(value) * 100)}%` : signed(value);
    out.push({ key, label: STAT_LABEL[key], value, text: `${amount} ${STAT_LABEL[key]}` });
  }
  return out;
}

const pct = (n: number): string => `${Math.round(n * 100)}%`;
const statusName = (content: ContentPack, id: string): string => content.statuses[id]?.name ?? humanize(id);
const damageName = (type: string | undefined): string => (type === undefined ? 'all' : cap(type));

/** A `custom` passive's script, said plainly (the scripts the engine knows; any other is named by its id). */
function scriptLine(scriptId: string, params: Record<string, unknown>, content: ContentPack): string {
  const num = (k: string): number => (typeof params[k] === 'number' ? (params[k] as number) : 0);
  const str = (k: string): string => (typeof params[k] === 'string' ? (params[k] as string) : '');
  const list = (k: string): string => (Array.isArray(params[k]) ? (params[k] as unknown[]).map((x) => statusName(content, String(x))).join(', ') : '');
  switch (scriptId) {
    case 'basic_attack_rider':
      return `Basic attacks add ${pct(num('pct'))} of their damage as ${damageName(str('damageType'))}.`;
    case 'damage_vs_status':
      return `+${pct(num('pct'))} damage against a target that is ${statusName(content, str('status'))}.`;
    case 'reflect_melee':
      return `Reflects ${pct(num('pct'))} of melee damage taken as ${damageName(str('damageType'))}.`;
    case 'basic_stun_chance':
      return `Basic attacks have at least a ${pct(num('chance'))} chance to Stun.`;
    case 'status_duration_reduction':
      return `${list('statuses')} last ${num('turns')} fewer turn${num('turns') === 1 ? '' : 's'} on you.`;
    case 'low_hp_status':
      return `Once a fight, below ${pct(num('below'))} HP you gain ${statusName(content, str('status'))} for ${num('duration')} turns.`;
    case 'foresight':
      return 'Shows what enemies will do after their next move.';
    case 'ability_mp_cost_reduction':
      return `${damageName(str('damageType'))} abilities cost ${pct(num('pct'))} less MP.`;
    case 'hazard_immunity':
      return `The ${str('hazard')} hazard passes you by.`;
    case 'cleanse':
      return `Using it removes ${list('statuses')}.`;
    case 'whetstone_strip':
      return `The next fight's first ${num('basicAttacks')} basic attacks hit +${num('power')} harder.`;
    case 'remnant_ink':
      return `The next fight opens with a ${num('amount')}-point Shield.`;
    case 'lantern_oil_ward':
      return `Until dawn, nothing in the dark takes your sight (${statusName(content, str('preventsStatusOnAmbush'))} cannot start an ambush).`;
    case 'keepers_copy':
      return 'Reads the verses of the Litany you hold again.';
    case 'scouts_whistle':
      return 'At a camp, calls a waiting companion to your side.';
    case 'remnant_wax_seal':
      return 'Carried, the named merchants stock as if you stood higher with their people.';
    case 'counts_as_spellbook':
      return 'Counts as one Dark Spellbook read, with no HP or Corruption cost.';
    case 'kill_xp':
      return `+${pct(num('pct'))} XP from kills.`;
    case 'travel_regen':
      return `Each watch of travel restores ${pct(num('hpPct'))} HP and ${pct(num('mpPct'))} MP.`;
    case 'crit':
      return `+${num('amount')} crit chance.`;
    case 'forge_discount':
      return `Emberforge fees ${pct(num('pct'))} lower.`;
    case 'loyalty_gain':
      return `Companion loyalty gains ${pct(num('pct'))} larger.`;
    case 'second_wind':
      return 'Once a day, a Second Wind in a fight.';
    case 'free_inn_rest':
      return 'One inn rest each loop is free.';
    case 'reveal_resistances':
      return 'Shows an enemy’s resistances at once.';
    case 'remembered_steps':
      return 'Remembers the way back along roads you have walked.';
    default:
      return humanize(scriptId);
  }
}

/** One passive, said plainly. */
export function passiveLine(p: Passive, content: ContentPack): string {
  switch (p.kind) {
    case 'resist':
      return `${cap(p.level)} to ${damageName(p.damageType)} damage.`;
    case 'statusOnHit':
      return `${pct(p.chance)} chance on hit to apply ${statusName(content, p.status)} (${p.duration}).`;
    case 'mpCostReduction':
      return `Abilities cost ${pct(p.pct)} less MP.`;
    case 'lifeSteal':
      return `Heals you for ${pct(p.pct)} of the damage you deal.`;
    case 'curse':
      return `${pct(p.chance)} chance on hit to Curse the target; each such hit costs you ${p.damage} HP.`;
    case 'regen':
      return `Restores ${[p.hp > 0 ? `${p.hp} HP` : null, p.mp > 0 ? `${p.mp} MP` : null].filter((x) => x !== null).join(' and ')} each turn.`;
    case 'resourceGain':
      return `Class resource generation ${signed(Math.round(p.pct * 100))}%.`;
    case 'statusImmunity':
      return `Immune to ${statusName(content, p.status)}.`;
    case 'damageBonus':
      return `${signed(Math.round(p.pct * 100))}% ${damageName(p.damageType)} damage dealt.`;
    case 'guardValue':
      return `Guard reduces damage by ${pct(p.pct)}.`;
    case 'grantAbility':
      return `Grants the ability ${content.abilities[p.abilityId]?.name ?? humanize(p.abilityId)}.`;
    case 'custom':
      return scriptLine(p.scriptId, p.params, content);
  }
}

export interface AffixRow {
  id: string;
  suffix: string;
  /** The affix's effect on this kind of gear, as authored (DESIGN §7.3). */
  text: string;
}

/** The affix rows of a piece of gear, in instance order; an affix the pack lacks is skipped. */
export function affixRows(def: Item, affixes: readonly string[], content: ContentPack): AffixRow[] {
  const out: AffixRow[] = [];
  for (const id of affixes) {
    const affix = content.affixes[id];
    if (affix === undefined) continue;
    const effect = def.slot === undefined ? undefined : affix[def.slot];
    out.push({ id, suffix: affix.suffix, text: effect?.text ?? '' });
  }
  return out;
}

/** The item's own passives and resist steps in words (affixes are listed apart, by `affixRows`). */
export function ownPassiveLines(def: Item, content: ContentPack): string[] {
  const lines = def.passives.map((p) => passiveLine(p, content));
  for (const type of def.resistSteps) lines.push(`One step toward immune to ${damageName(type)} damage.`);
  return lines;
}

/** What using or reading it does, from its `onUse` effects (the ones with numbers; the description tells the rest). */
export function useLines(def: Item, content: ContentPack): string[] {
  const out: string[] = [];
  for (const e of def.onUse) {
    if ('heal' in e) {
      const { hp, mp } = e.heal;
      if (hp !== undefined) out.push(hp === 'full' ? 'Restores all HP.' : `Restores ${hp} HP.`);
      if (mp !== undefined) out.push(mp === 'full' ? 'Restores all MP.' : `Restores ${mp} MP.`);
    } else if ('revive' in e) {
      out.push(`Revives a companion with ${pct(e.revive)} of their maximum HP.`);
    } else if ('damage' in e) {
      const hp = (e.damage as { hp?: number }).hp;
      if (typeof hp === 'number') out.push(`Costs ${hp} HP.`);
    } else if ('corruption' in e && typeof e.corruption === 'number') {
      out.push(`${e.corruption >= 0 ? 'Raises' : 'Lowers'} Corruption by ${Math.abs(e.corruption)}.`);
    }
  }
  // a consumable's cleansing and prepared effects are scripts on its passives
  for (const p of def.passives) {
    if (p.kind === 'custom') out.push(scriptLine(p.scriptId, p.params, content));
    if (p.kind === 'grantAbility' && def.type === 'consumable') {
      const ability = content.abilities[p.abilityId];
      if (ability !== undefined) out.push(ability.description);
    }
  }
  return out;
}

export interface RequirementLine {
  text: string;
  met: boolean;
}

/** What the item asks of its wearer: the class, the level and any condition, each with whether it is met now. */
export function requirementLines(def: Item, state: GameState, profile: Readonly<Profile>, content: ContentPack): RequirementLine[] {
  const req = def.requirements;
  if (req === undefined) return [];
  const out: RequirementLine[] = [];
  if (req.classIds !== undefined) {
    const names = req.classIds.map((id) => content.classes[id]?.name ?? id).join(' or ');
    out.push({ text: `Only a ${names}`, met: (req.classIds as readonly string[]).includes(state.player.classId) });
  }
  if (req.level !== undefined) out.push({ text: `Level ${req.level}`, met: state.player.level >= req.level });
  if (req.when !== undefined) for (const part of explain(req.when, state, profile, content).parts) out.push({ text: part.text, met: part.ok });
  return out;
}

// ---- the whole card --------------------------------------------------------------------------------------------------------

export interface ItemFacts {
  itemId: string;
  name: string;
  rarity: Rarity;
  rarityLabel: string;
  icon: string;
  major: boolean;
  type: Item['type'];
  typeLine: string;
  /** Gear or not (rarity and affixes matter only for gear). */
  isGear: boolean;
  description: string;
  stats: StatLine[];
  affixes: AffixRow[];
  passives: string[];
  /** Numbers on use ("Restores 30 HP."). */
  effects: string[];
  requirements: RequirementLine[];
  /** One unit's worth at its rarity. */
  value: number;
  qty: number;
  bound: boolean;
  /** Quest and key items live in the Satchel. */
  satchel: boolean;
}

/** An instance as the card shows it. `state` and `profile` are only for the requirements; pass null to leave them out. */
export function itemFacts(content: ContentPack, inst: ItemInstance, ctx: { state: GameState; profile: Readonly<Profile> } | null = null): ItemFacts | null {
  const def = content.items[inst.itemId];
  if (def === undefined) return null;
  const isGear = def.slot !== undefined;
  return {
    itemId: def.id,
    name: itemName(def, inst.affixes, content),
    rarity: inst.rarity,
    rarityLabel: isGear ? RARITY_LABEL[inst.rarity] : '',
    icon: def.art.icon,
    major: def.art.major,
    type: def.type,
    typeLine: typeLine(def),
    isGear,
    description: def.description,
    stats: statLines(itemStats(def, inst.rarity, content)),
    affixes: affixRows(def, inst.affixes, content),
    passives: ownPassiveLines(def, content),
    effects: useLines(def, content),
    requirements: ctx === null ? [] : requirementLines(def, ctx.state, ctx.profile, content),
    value: goldValue(def, inst.rarity, content),
    qty: inst.qty,
    bound: inst.boundQuest !== undefined,
    satchel: def.type === 'quest' || def.type === 'key' || def.tags.includes('key'),
  };
}

// ---- comparison with what is worn ------------------------------------------------------------------------------------------

export interface DeltaRow {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  /** "Attack 12 → 14 (+2)". */
  text: string;
}

const DELTA_FIELDS: readonly { key: keyof Derived; label: string }[] = [
  { key: 'hpMax', label: 'Max HP' },
  { key: 'mpMax', label: 'Max MP' },
  { key: 'atk', label: 'Attack' },
  { key: 'sp', label: 'Spell power' },
  { key: 'armor', label: 'Armor' },
  { key: 'ward', label: 'Ward' },
  { key: 'strength', label: 'Strength' },
  { key: 'magic', label: 'Magic' },
  { key: 'agility', label: 'Agility' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'evasion', label: 'Evasion' },
  { key: 'crit', label: 'Crit chance' },
  { key: 'initiative', label: 'Initiative' },
];

/** The rows of `derive` that differ between two derivations (a change of 0 is left out). */
export function deltaRows(before: Derived, after: Derived): DeltaRow[] {
  const out: DeltaRow[] = [];
  for (const { key, label } of DELTA_FIELDS) {
    const a = before[key] as number;
    const b = after[key] as number;
    if (a === b) continue;
    out.push({ key, label, before: a, after: b, delta: b - a, text: `${label} ${a} → ${b} (${signed(b - a)})` });
  }
  return out;
}

export interface CompareModel {
  slot: EquipSlot;
  slotLabel: string;
  /** What is worn there now, or null for an empty slot. */
  wornName: string | null;
  rows: DeltaRow[];
}

/** The Wayfinder with `candidate` in `slot` (null: the slot emptied). */
function withSlot(player: PlayerState, slot: EquipSlot, candidate: ItemInstance | null): PlayerState {
  return { ...player, equipment: { ...player.equipment, [slot]: candidate } };
}

/**
 * If `inst` were worn instead of what is worn now: one comparison per slot it fits (a trinket has two). An item that is
 * already worn compares against the slot empty (what taking it off would cost).
 */
export function compareToWorn(state: GameState, content: ContentPack, inst: ItemInstance): CompareModel[] {
  const def = content.items[inst.itemId];
  if (def === undefined || def.slot === undefined) return [];
  const player = state.player;
  const base = derive(player, content);
  const wornAt = EQUIP_SLOTS.find((slot) => player.equipment[slot]?.uid === inst.uid);
  if (wornAt !== undefined) {
    return [{ slot: wornAt, slotLabel: SLOT_LABEL[wornAt], wornName: instName(content, inst), rows: deltaRows(base, derive(withSlot(player, wornAt, null), content)) }];
  }
  return slotsFor(def).map((slot) => {
    const worn = player.equipment[slot];
    return {
      slot,
      slotLabel: SLOT_LABEL[slot],
      wornName: worn === null ? null : instName(content, worn),
      rows: deltaRows(base, derive(withSlot(player, slot, inst), content)),
    };
  });
}

// ---- rows for lists --------------------------------------------------------------------------------------------------------

export interface ItemRowModel {
  uid: string;
  itemId: string;
  name: string;
  qty: number;
  rarity: Rarity;
  /** "" for non-gear (no rarity). */
  rarityLabel: string;
  type: Item['type'];
  typeLabel: string;
  icon: string;
  major: boolean;
  affixCount: number;
  bound: boolean;
  isGear: boolean;
}

export function itemRow(content: ContentPack, inst: ItemInstance): ItemRowModel {
  const def = content.items[inst.itemId];
  const isGear = def?.slot !== undefined;
  return {
    uid: inst.uid,
    itemId: inst.itemId,
    name: def === undefined ? inst.itemId : itemName(def, inst.affixes, content),
    qty: inst.qty,
    rarity: inst.rarity,
    rarityLabel: isGear ? RARITY_LABEL[inst.rarity] : '',
    type: def?.type ?? 'material',
    typeLabel: def === undefined ? '' : typeLine(def),
    icon: def?.art.icon ?? 'item',
    major: def?.art.major ?? false,
    affixCount: inst.affixes.length,
    bound: inst.boundQuest !== undefined,
    isGear,
  };
}

/** The accessible name of a list row: "Warrior's Sword of Embers, Rare weapon, 2 affixes". */
export function rowLabel(row: ItemRowModel, extra: readonly (string | null | undefined)[] = []): string {
  const parts = [
    row.qty > 1 ? `${row.name} × ${row.qty}` : row.name,
    row.isGear ? `${row.rarityLabel} ${row.typeLabel.toLowerCase()}` : row.typeLabel.toLowerCase(),
    ...extra.filter((x): x is string => x !== null && x !== undefined && x !== ''),
  ];
  return parts.join(', ');
}

/** "1 gold" / "12 gold". */
export const goldText = (n: number): string => `${n} gold`;
