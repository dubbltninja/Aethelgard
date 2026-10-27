// U82 (C5, the coverage punch list): nothing in the real pack is out of every player's reach. An item or creature that no
// location, loot table, shelf, recipe, effect, reward, encounter, wandering pool or anomaly table places is a content bug
// (U82 found four: the Archivist's Circlet, the Oathplate, Borin's Hallow's Hammer pattern and the Warder Plate); every quest
// has a proof and every ending a script, so the batch's coverage of them is 100 % by construction; the batch's by-design gaps
// are named with a reason.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { CLOSER_IDS } from '@schema/ending';
import { BY_DESIGN, creatureSources, itemSources, sourcelessCreatures, sourcelessItems } from '@sim/reachability';
import { ENDING_SCRIPTS } from '@sim/scripts/endings/index';
import { QUEST_SCRIPTS } from '@sim/scripts/quests';
import { fixturePack } from '@tests/fixtures/miniContent';

const pack = buildContentPack();

describe('reachability of the real pack', () => {
  test('every item has a source', () => {
    expect(sourcelessItems(pack)).toEqual([]);
  });

  test('every creature can be met', () => {
    expect(sourcelessCreatures(pack)).toEqual([]);
  });

  test('every quest has a proof, every ending and closer a script', () => {
    const proved = new Set(QUEST_SCRIPTS.map((s) => s.questId));
    expect(Object.keys(pack.quests).filter((id) => !proved.has(id as `q_${string}`))).toEqual([]);
    const scripted = new Set(ENDING_SCRIPTS.map((s) => s.endingId));
    expect([...Object.keys(pack.endings), ...CLOSER_IDS].filter((id) => !scripted.has(id))).toEqual([]);
  });

  test('the by-design gaps name real content with a source and a reason', () => {
    const items = itemSources(pack);
    const creatures = creatureSources(pack);
    for (const [kind, gaps] of Object.entries(BY_DESIGN)) {
      for (const [id, reason] of Object.entries(gaps)) {
        expect([kind, id, reason.length > 10]).toEqual([kind, id, true]);
        if (kind === 'items') expect([id, (items.get(id) ?? []).length > 0]).toEqual([id, true]);
        if (kind === 'creatures') expect([id, (creatures.get(id) ?? []).length > 0]).toEqual([id, true]);
        if (kind === 'quests') expect(pack.quests[id]).toBeDefined();
        if (kind === 'locations') expect(pack.locations[id]).toBeDefined();
      }
    }
  });
});

describe('the source finder', () => {
  test('finds shelves, loot, places, recipes and starter kit; a piece nothing gives is reported', () => {
    const fx = fixturePack();
    const sources = itemSources(fx);
    const anyStarter = Object.values(fx.classes)[0]?.starterItems[0]?.itemId;
    if (anyStarter !== undefined) expect(sources.get(anyStarter)?.some((x) => x.startsWith('start:'))).toBe(true);
    const orphan = { ...fx, items: { ...fx.items, item_orphan: { ...(Object.values(fx.items)[0] as (typeof fx.items)[string]), id: 'item_orphan' as const } } };
    expect(sourcelessItems(orphan)).toContain('item_orphan');
    const lonely = { ...fx, creatures: { ...fx.creatures, cr_lonely: { ...(Object.values(fx.creatures)[0] as (typeof fx.creatures)[string]), id: 'cr_lonely' as const, anomaly: undefined } } };
    expect(sourcelessCreatures(lonely)).toContain('cr_lonely');
  });
});
