// Where content can come from (U82, the C5 coverage punch list; PLAN §7.7, §1.2 "Coverage of content by sims"). The batch's
// "never" lists say what the bots did not reach; this says what *nothing* places — no location, loot table, shelf, recipe,
// effect, quest reward, encounter, wandering pool or anomaly table. Such an item or creature is a content bug (an authored
// piece no player can meet), not a bot gap, and `tests/unit/sim/reachability.test.ts` fails on it. The by-design exceptions
// of the batch (Loop 4+ only, an ending-only piece …) are listed in `BY_DESIGN` with their reason, so a new unreachable piece
// cannot hide among them.
//
// Pure: a pack in, maps out. A source is a string `<kind>:<id>` (the same vocabulary as an item's authored `sources`).
import type { ContentPack } from '@engine/index';

/** Calls `visit` on every plain object in `value` (depth first). */
function walk(value: unknown, visit: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const v of value) walk(v, visit);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const o = value as Record<string, unknown>;
  visit(o);
  for (const v of Object.values(o)) walk(v, visit);
}

const add = (into: Map<string, string[]>, id: string, source: string): void => {
  const list = into.get(id) ?? [];
  if (!list.includes(source)) list.push(source);
  into.set(id, list);
};

/** Every source that can put each item in the player's hands. */
export function itemSources(content: ContentPack): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const loc of Object.values(content.locations)) {
    for (const it of loc.items) add(out, it.itemId, `loc:${loc.id}`);
    for (const g of loc.gather ?? []) add(out, g.itemId, `gather:${loc.id}`);
  }
  for (const c of Object.values(content.creatures)) for (const l of c.loot) add(out, l.itemId, `drop:${c.id}`);
  for (const m of Object.values(content.merchants)) {
    for (const e of m.stock) add(out, e.itemId, `merchant:${m.npcId}`);
    for (const id of m.rollStock?.pool ?? []) add(out, id, `merchant:${m.npcId}`);
  }
  for (const r of Object.values(content.recipes)) add(out, r.output.itemId, `craft:${r.id}`);
  for (const cls of Object.values(content.classes)) for (const it of cls.starterItems) add(out, it.itemId, `start:${cls.id}`);
  for (const it of content.config.startItems) add(out, it.itemId, 'start:config');
  for (const q of Object.values(content.quests)) for (const it of q.rewards?.items ?? []) add(out, it.itemId, `quest:${q.id}`);
  // `giveItem` effects anywhere (dialogue, events, quests, encounters, attunements, echoes …) and Attunements' start items
  walk(content, (o) => {
    const give = o['giveItem'] as { item?: unknown } | undefined;
    if (give !== undefined && typeof give.item === 'string') add(out, give.item, 'effect');
    if (o['kind'] === 'start_item' && typeof o['itemId'] === 'string') add(out, o['itemId'], 'start:attunement');
  });
  return out;
}

/** Every source that can put each creature in a fight. */
export function creatureSources(content: ContentPack): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const loc of Object.values(content.locations)) {
    for (const enc of loc.encounters) for (const g of enc.groups) add(out, g.creatureId, `enc:${enc.id}`);
  }
  for (const r of Object.values(content.regions)) for (const w of r.wanderingPool) add(out, w.creatureId, `wander:${r.id}`);
  for (const c of Object.values(content.creatures)) {
    if (c.anomaly !== undefined) add(out, c.id, `anomaly:${c.anomaly.region}`);
    walk(c, (o) => {
      const summon = o['summon'] as { creatureId?: unknown } | undefined;
      if (summon !== undefined && typeof summon.creatureId === 'string') add(out, summon.creatureId, `summon:${c.id}`);
    });
  }
  // `spawn` effects anywhere (`startCombat` names an encounter, counted above)
  walk(content, (o) => {
    const spawn = o['spawn'] as { creature?: unknown } | undefined;
    if (spawn !== undefined && typeof spawn.creature === 'string') add(out, spawn.creature, 'effect:spawn');
  });
  return out;
}

/** Item ids nothing in the pack can give the player. */
export const sourcelessItems = (content: ContentPack): string[] => {
  const sources = itemSources(content);
  return Object.keys(content.items).filter((id) => (sources.get(id) ?? []).length === 0).sort();
};

/** Creature ids nothing in the pack can put in a fight. */
export const sourcelessCreatures = (content: ContentPack): string[] => {
  const sources = creatureSources(content);
  return Object.keys(content.creatures).filter((id) => (sources.get(id) ?? []).length === 0).sort();
};

/**
 * The batch's by-design gaps (U82, docs/BALANCE.md "After U82"): content a player reaches but the 3-loop batch does not, each
 * with its reason. Kept short on purpose; `reachability.test.ts` checks every id exists, has a source, and that the reason is
 * not empty.
 */
export const BY_DESIGN: Readonly<Record<'quests' | 'locations' | 'endings' | 'creatures' | 'items', Readonly<Record<string, string>>>> = {
  quests: {},
  locations: {},
  endings: {},
  creatures: {
    cr_hour_leech: 'Loop 4+ only (WORLD §12.1 ws_loop_4 at the Nexus); the batch plays three loops',
    cr_redundant_wayfinder: 'Loop 4+ only (WORLD §6.8, §12.1 ws_loop_4 in the Ruins); the batch plays three loops',
  },
  items: {},
};
