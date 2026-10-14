// Rarity and affix rolls (DESIGN §7.2–7.3): a leaf module so the loot spoils (combat/rewards.ts, U27), the `giveItem`
// effect (effects.ts) and merchant stock (reducers/economy.ts, U34) share one implementation without an import cycle.
// The draws take any Rng with the pack (`Rolls`): the run's own stream for loot and gifts, a derived stream for stock.
//
// Rarity: a weapon/armor/trinket whose `rarityRule` is 'rolled' draws one from `config.rarityWeights` for a band — the
// location's level band minimum, else its region's (`lootBand`). Affixes: its `fixedAffixes`, then distinct rolled ones
// that act on its slot (by id order) — Uncommon 50 % one, Rare one, Epic one or two, Legendary two — within §7.3's cap.
import { MAX_AFFIXES, type Item } from '@schema/item';
import type { ContentPack, StepCtx } from './ctx';
import { RARITY_ORDER } from './derived';
import type { Rarity } from './types/state';

/** What a roll reads: an Rng and the pack. */
export type Rolls = Pick<StepCtx, 'rng' | 'content'>;

/** DESIGN §7.3: the chance that Uncommon gear rolls its one affix. */
export const UNCOMMON_AFFIX_CHANCE = 0.5;

/** The band a drop rolls its rarity in: the location's level band minimum, else its region's, else `fallback`. */
export function lootBand(content: ContentPack, locationId: string, fallback: number): number {
  const loc = content.locations[locationId];
  return loc?.levelBand?.min ?? (loc ? content.regions[loc.regionId]?.levelBand.min : undefined) ?? fallback;
}

/** DESIGN §7.2: one weighted draw over the rarity weights of the highest `minBand` ≤ `band`. */
export function rollRarity(ctx: Rolls, band: number): Rarity {
  const rows = ctx.content.config.rarityWeights;
  const row = [...rows].reverse().find((r) => r.minBand <= band) ?? rows[0];
  if (!row) return 'common';
  return ctx.rng.weighted(RARITY_ORDER.map((r) => ({ weight: row.weights[r], value: r })));
}

/** DESIGN §7.3: how many affixes a piece of `rarity` rolls (Uncommon draws its 50 %, Epic draws one or two). */
export function affixCount(ctx: Rolls, rarity: Rarity): number {
  switch (rarity) {
    case 'uncommon':
      return ctx.rng.chance(UNCOMMON_AFFIX_CHANCE) ? 1 : 0;
    case 'rare':
      return 1;
    case 'epic':
      return ctx.rng.int(1, 2);
    case 'legendary':
      return 2;
    default:
      return 0;
  }
}

/** The affixes that can roll on `def`'s slot and are not in `exclude`, by id. */
export function affixPool(content: ContentPack, def: Item, exclude: readonly string[]): string[] {
  const kind = def.slot;
  if (!kind) return [];
  return Object.values(content.affixes)
    .filter((a) => a[kind] !== undefined && !exclude.includes(a.id))
    .map((a) => a.id)
    .sort();
}

/** A piece's affixes: its `fixedAffixes`, then distinct rolled ones that act on its slot (by id order), within §7.3's cap. */
export function rollAffixes(ctx: Rolls, def: Item, rarity: Rarity): string[] {
  const out: string[] = [...def.fixedAffixes];
  if (!def.slot) return out;
  const want = Math.min(affixCount(ctx, rarity), MAX_AFFIXES[rarity] - out.length);
  const pool = affixPool(ctx.content, def, out);
  for (let i = 0; i < want && pool.length > 0; i++) out.push(pool.splice(ctx.rng.int(0, pool.length - 1), 1)[0] as string);
  return out;
}

/**
 * One piece created without a named rarity (a loot row, a `giveItem`, a merchant's stock): gear whose rule is 'rolled'
 * draws its rarity in `band`, then its affixes; anything else keeps its fixed rarity and `fixedAffixes`, drawing nothing.
 */
export function rollPiece(ctx: Rolls, def: Item, band: number): { rarity: Rarity; affixes: string[] } {
  if (def.rarityRule !== 'rolled') return { rarity: def.fixedRarity, affixes: [...def.fixedAffixes] };
  const rarity = rollRarity(ctx, band);
  return { rarity, affixes: rollAffixes(ctx, def, rarity) };
}
