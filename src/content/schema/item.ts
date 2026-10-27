// ItemSchema (PLAN §5.5, DESIGN §7). Nine item types; equipment has a slot, a tier and (for rolled gear) a rarity rolled
// by band weights. Unit conventions: `*Pct` / `pct` fields and chances are fractions (0.1 = 10 %, like `Pct`); flat
// stats are whole points (DESIGN §3.2: `crit` 5 = +5 crit chance, `accuracy`/`evasion`/`initiative` likewise).
// The parsed `Item` has every type-dependent default resolved (rarityRule, stackable, maxStack, upgradeable,
// sellable, droppable), so engine code never re-derives them.
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { Effects } from './effect';
import { Base, ClassId, CodexId, DamageType, Id, ItemId, Pct, PId, Rarity, Resistance, StatusId, Text } from './primitives';

export const PassiveSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('resist'), damageType: DamageType, level: Resistance }).strict(),
  z.object({ kind: z.literal('statusOnHit'), status: StatusId, chance: Pct, duration: z.number().int().default(2) }).strict(),
  /** Legacy staffs: 0.10, 0.20 (DESIGN §5.1). */
  z.object({ kind: z.literal('mpCostReduction'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('lifeSteal'), pct: z.number() }).strict(),
  /** Shadow-Kissed Dagger: `chance` to Curse the target on hit; each such hit costs the wielder `damage` HP. */
  z.object({ kind: z.literal('curse'), chance: Pct, damage: z.number() }).strict(),
  z.object({ kind: z.literal('regen'), hp: z.number().default(0), mp: z.number().default(0) }).strict(),
  /** affix_of_the_wellspring: class resource generation +pct. */
  z.object({ kind: z.literal('resourceGain'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('statusImmunity'), status: StatusId }).strict(),
  z.object({ kind: z.literal('damageBonus'), damageType: DamageType.optional(), pct: z.number() }).strict(),
  /** affix_of_the_warden: Guard reduces `pct` (the resulting reduction, e.g. 0.60) instead of 0.50. */
  z.object({ kind: z.literal('guardValue'), pct: z.number() }).strict(),
  /** Amulet of Echoes → itm_echo_bolt (D-047). */
  z.object({ kind: z.literal('grantAbility'), abilityId: PId('itm_') }).strict(),
  z.object({ kind: z.literal('custom'), scriptId: Id, params: z.record(z.unknown()).default({}) }).strict(),
]);
export type Passive = z.output<typeof PassiveSchema>;

/** DESIGN §3.2 / §7.4 vocabulary. Rarity scales power/spellPower/armor/ward. */
export const ItemStatsSchema = z
  .object({
    power: z.number().default(0),
    spellPower: z.number().default(0),
    armor: z.number().default(0),
    ward: z.number().default(0),
    strength: z.number().default(0),
    magic: z.number().default(0),
    agility: z.number().default(0),
    hpMax: z.number().default(0),
    mpMax: z.number().default(0),
    /** Fraction of max HP (0.08 = +8 %). */
    hpMaxPct: z.number().default(0),
    crit: z.number().default(0),
    accuracy: z.number().default(0),
    evasion: z.number().default(0),
    initiative: z.number().default(0),
  })
  .strict();
export type ItemStats = z.output<typeof ItemStatsSchema>;

export const ITEM_TYPES = ['weapon', 'armor', 'trinket', 'consumable', 'material', 'quest', 'key', 'recipe', 'tome'] as const;
export const ItemType = z.enum(ITEM_TYPES);
export const EQUIPMENT_TYPES = ['weapon', 'armor', 'trinket'] as const;
export const WeaponType = z.enum(['melee', 'ranged_bow', 'magic_staff', 'shield_heavy', 'void_focus']);
export const ArmorClass = z.enum(['light', 'medium', 'heavy']);

const isEquipment = (type: (typeof ITEM_TYPES)[number]): type is (typeof EQUIPMENT_TYPES)[number] =>
  (EQUIPMENT_TYPES as readonly string[]).includes(type);

/** DESIGN §7.3: Uncommon up to 1 affix, Rare 1, Epic up to 2, Legendary 2; Common none. */
export const MAX_AFFIXES: Record<z.infer<typeof Rarity>, number> = { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 2 };

/** `drop:cr_…`, `merchant:npc_…`, `craft:recipe_…`, `quest:q_…`, `loc:loc_…` (PLAN §5.5). */
export const ITEM_SOURCE_RE = /^(?:drop:cr_|merchant:npc_|craft:recipe_|quest:q_|loc:loc_)[a-z0-9_]+$/;

const ItemObject = Base.extend({
  id: ItemId,
  name: Text,
  description: Text,
  type: ItemType,
  /** Required for weapon/armor/trinket and equal to the type; quest/key items with passives are slotless. */
  slot: z.enum(EQUIPMENT_TYPES).optional(),
  weaponType: WeaponType.optional(),
  armorClass: ArmorClass.optional(),
  /** T1–T5 (D-066 #22); 0 for gear-less types. */
  tier: z.number().int().min(0).max(5).default(1),
  /** Default: 'rolled' for weapon/armor/trinket, 'fixed' for every other type (which may not say 'rolled'). */
  rarityRule: z.enum(['rolled', 'fixed']).optional(),
  fixedRarity: Rarity.default('common'),
  stats: ItemStatsSchema.default({}),
  /** One step toward immune per entry (DESIGN §4.4). */
  resistSteps: z.array(DamageType).default([]),
  /** Fixed-rarity drops (WORLD "fixed R (affix_of_the_void)"). */
  fixedAffixes: z.array(PId('affix_')).default([]),
  passives: z.array(PassiveSchema).default([]),
  /** Consumables, tomes and recipe items: `heal`, `corruption`, `unlockRecipe` … */
  onUse: Effects,
  usableInCombat: z.boolean().default(true),
  usableOutOfCombat: z.boolean().default(true),
  consumeOnUse: z.boolean().default(true),
  /** Default: consumable | material | tome (DESIGN §7.8). Gear never stacks. */
  stackable: z.boolean().optional(),
  /** Default by type (DESIGN §7.8): consumable 10, material 99, tome 5, everything else 1. */
  maxStack: z.number().int().min(1).optional(),
  value: z.number().int().min(0),
  /** Default: false for quest items (bound), true otherwise. */
  sellable: z.boolean().optional(),
  /** Default: false for quest items (bound), true otherwise. */
  droppable: z.boolean().optional(),
  /** Rarity tier-up (DESIGN §8.3). Default: weapon | armor | trinket. */
  upgradeable: z.boolean().optional(),
  /** May be placed as an Anchor in the Silverwood Before Conflux (D-016, D-067.4). Anchors last one loop. */
  anchorable: z.boolean().default(false),
  requirements: z
    .object({ classIds: z.array(ClassId).optional(), level: z.number().int().optional(), when: ConditionSchema.optional() })
    .strict()
    .optional(),
  /** Validated by prefix: see ITEM_SOURCE_RE. */
  sources: z.array(z.string()).default([]),
  art: z.object({ icon: z.string(), major: z.boolean().default(false), accent: z.string().optional() }).strict(),
  codexId: CodexId.optional(),
  legacyName: z.string().optional(),
}).strict();

const defaultStackable = (type: (typeof ITEM_TYPES)[number]): boolean => type === 'consumable' || type === 'material' || type === 'tome';
/** DESIGN §7.8: consumables stack to 10, tomes to 5, anything else that stacks (materials) to 99. */
const defaultMaxStack = (type: (typeof ITEM_TYPES)[number]): number => (type === 'consumable' ? 10 : type === 'tome' ? 5 : 99);

export const ItemSchema = ItemObject.superRefine((item, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const gear = isEquipment(item.type);

  if (gear && item.slot !== item.type) issue(['slot'], `a ${item.type} needs slot: '${item.type}'`);
  if (!gear && item.slot !== undefined) issue(['slot'], `a ${item.type} item has no equipment slot`);
  if (item.type === 'weapon' && item.weaponType === undefined) issue(['weaponType'], 'a weapon needs a weaponType (DESIGN §5.7)');
  if (item.type !== 'weapon' && item.weaponType !== undefined) issue(['weaponType'], 'weaponType is only for weapons');
  if (item.type !== 'armor' && item.armorClass !== undefined) issue(['armorClass'], 'armorClass is only for armor');
  if (!gear && item.rarityRule === 'rolled') issue(['rarityRule'], `only weapon/armor/trinket roll a rarity; a ${item.type} is 'fixed' (DESIGN §7.2)`);
  if (gear && item.stackable === true) issue(['stackable'], 'gear never stacks (each piece has rarity and affixes)');
  if (!gear && item.upgradeable === true) issue(['upgradeable'], 'only weapon/armor/trinket can be upgraded (DESIGN §8.3)');
  if (item.type === 'consumable' && item.onUse.length === 0) issue(['onUse'], 'a consumable needs at least one onUse effect');
  if (item.type === 'quest' && item.sellable === true) issue(['sellable'], 'quest items are bound: they cannot be sold (DESIGN §7.5)');
  if (item.type === 'quest' && item.droppable === true) issue(['droppable'], 'quest items are bound: they cannot be dropped (DESIGN §7.1)');
  const sellable = item.sellable ?? item.type !== 'quest';
  if (sellable && item.value <= 0) issue(['value'], 'a sellable item needs value > 0');

  if (!gear && item.fixedAffixes.length > 0) issue(['fixedAffixes'], 'only weapon/armor/trinket carry affixes');
  if (new Set(item.fixedAffixes).size !== item.fixedAffixes.length) issue(['fixedAffixes'], 'an item never carries the same affix twice');
  const rule = item.rarityRule ?? (gear ? 'rolled' : 'fixed');
  if (gear && rule === 'fixed' && item.fixedAffixes.length > MAX_AFFIXES[item.fixedRarity]) {
    issue(['fixedAffixes'], `a ${item.fixedRarity} item carries at most ${MAX_AFFIXES[item.fixedRarity]} affix(es) (DESIGN §7.3)`);
  }
  if (gear && rule === 'rolled' && item.fixedAffixes.length > MAX_AFFIXES.legendary) {
    issue(['fixedAffixes'], `at most ${MAX_AFFIXES.legendary} affixes (DESIGN §7.3)`);
  }
  if (item.maxStack !== undefined && item.maxStack > 1 && (item.stackable ?? defaultStackable(item.type)) === false) {
    issue(['maxStack'], 'maxStack > 1 on a non-stackable item');
  }
  item.sources.forEach((s, i) => {
    if (!ITEM_SOURCE_RE.test(s)) {
      issue(['sources', i], `source '${s}' must be drop:cr_… | merchant:npc_… | craft:recipe_… | quest:q_… | loc:loc_…`);
    }
  });
}).transform((item) => {
  const gear = isEquipment(item.type);
  const stackable = item.stackable ?? defaultStackable(item.type);
  return {
    ...item,
    rarityRule: item.rarityRule ?? (gear ? ('rolled' as const) : ('fixed' as const)),
    stackable,
    maxStack: item.maxStack ?? (stackable ? defaultMaxStack(item.type) : 1),
    sellable: item.sellable ?? item.type !== 'quest',
    droppable: item.droppable ?? item.type !== 'quest',
    upgradeable: item.upgradeable ?? gear,
  };
});

export type Item = z.output<typeof ItemSchema>;
export type ItemInput = z.input<typeof ItemSchema>;
