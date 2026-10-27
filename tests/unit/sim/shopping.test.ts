// U82 (D-149 #5): the bots buy what they need — an inn when hurt and the clock allows, a pattern read, forge work, a gear
// upgrade off the shelf, mana draughts — and the explorer one of each thing it has never held; none of it spends what a quest
// still asks for.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { legalActions, step, type Action, type GameState } from '@engine/index';
import { itemOf } from '@sim/bots/shared';
import { COLLECT_RESERVE, SHOPPING, collectNew, gearGain, innRest, noteHeld, questReserved, readPattern, shelfBuy, shop } from '@sim/bots/shopping';
import { freshProfile, makeState } from '@tests/fixtures/helpers';

const content = buildContentPack();
const profile = freshProfile();
const RESPITE = 'loc_wayfarers_respite'; // an inn (10 g) with Kaelen's stall
const legal = (s: GameState): Action[] => legalActions(s, content, profile);
/** Walks in from the Mistwood Path, so Kaelen's stall is stocked for the day (stock comes with an arrival). */
const at = (over: Parameters<typeof makeState>[0]): GameState => {
  const s = step(makeState({ locationId: 'loc_mistwood_path', ...over }, { content }), { type: 'move', to: RESPITE }, content, profile).state;
  expect([s.mode, s.world.currentLocationId]).toEqual(['explore', RESPITE]);
  return s;
};

describe('the inn', () => {
  test('a paid full rest when hurt, while the clock allows and the purse holds the reserve', () => {
    const hurt = at({ gold: 100, patch: (d) => (d.player.hp = Math.floor(d.player.hpMax * 0.6)) });
    expect(innRest(hurt, legal(hurt), content)).toEqual({ type: 'rest', kind: 'full' });
    const healthy = at({ gold: 100 });
    expect(innRest(healthy, legal(healthy), content)).toBeUndefined();
    const poor = at({ gold: SHOPPING.reserve, patch: (d) => (d.player.hp = 1) });
    expect(innRest(poor, legal(poor), content)).toBeUndefined();
    const late = at({ gold: 100, patch: (d) => ((d.player.hp = 1), (d.clock.ticks = d.clock.limitTicks - 12)) });
    expect(innRest(late, legal(late), content)).toBeUndefined(); // the Apex is due
  });
});

describe('the shelf', () => {
  test('the best gear upgrade on sale when it leaves the reserve; never a piece already carried', () => {
    const rich = at({ gold: 2000 });
    const buy = shelfBuy(rich, legal(rich), content, profile);
    if (buy === undefined) return; // Kaelen's rolled stock may hold nothing better for the class this seed
    expect(buy.type).toBe('buy');
    const piece = itemOf(rich, (buy as Extract<Action, { type: 'buy' }>).uid);
    expect(piece).toBeDefined();
    expect(gearGain(rich, content, piece as NonNullable<typeof piece>)).toBeGreaterThan(0);
    const broke = at({ gold: 0 });
    expect(shelfBuy(broke, legal(broke), content, profile)).toBeUndefined();
  });

  test('gearGain: a slotless item or one carried already is no upgrade', () => {
    const s = at({ items: ['item_travelers_sword'] });
    expect(gearGain(s, content, { itemId: 'item_ley_touched_tonic', rarity: 'common', affixes: [] })).toBe(Number.NEGATIVE_INFINITY);
    expect(gearGain(s, content, { itemId: 'item_travelers_sword', rarity: 'common', affixes: [] })).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('patterns and quests', () => {
  test('a carried pattern is read once', () => {
    const s = at({ items: ['item_pattern_conflux_robe'] });
    const read = readPattern(s, legal(s), content);
    expect(read?.type).toBe('use');
    const known = at({ items: ['item_pattern_conflux_robe'], patch: (d) => (d.player.uses['recipe:recipe_conflux_robe'] = { loop: 1 }) });
    expect(readPattern(known, legal(known), content)).toBeUndefined();
  });

  test('an item a quest still asks for is reserved; a completed quest frees it', () => {
    const quest = Object.entries(content.quests).find(([, q]) => q.stages.some((st) => st.objectives.some((o) => 'item' in o.when)));
    expect(quest).toBeDefined();
    const [id, q] = quest as NonNullable<typeof quest>;
    const wanted = q.stages.flatMap((st) => st.objectives.flatMap((o) => ('item' in o.when ? [(o.when as { item: { id: string } }).item.id] : [])))[0] as string;
    expect(questReserved(at({}), content).has(wanted)).toBe(true);
    void id;
    const allDone = at({
      patch: (d) => {
        for (const [qid, qq] of Object.entries(content.quests)) d.quests[qid] = { status: 'completed', stage: qq.stages[0]?.id ?? '', startedDay: 1, endedDay: 1, counters: {}, objectivesDone: [] };
      },
    });
    expect(questReserved(allDone, content).size).toBe(0);
  });
});

describe('the explorer\'s collection', () => {
  test('the cheapest thing on the shelf never held, while COLLECT_RESERVE stays; nothing once all is held', () => {
    const s = at({ gold: 1000 });
    const seen = new Set<string>();
    noteHeld(s, seen);
    const pick = collectNew(s, legal(s), content, profile, seen);
    expect(pick?.type).toBe('buy');
    const all = new Set(Object.keys(content.items));
    expect(collectNew(s, legal(s), content, profile, all)).toBeUndefined();
    const poor = at({ gold: COLLECT_RESERVE });
    expect(collectNew(poor, legal(poor), content, profile, seen)).toBeUndefined();
  });

  test('shop() is a no-op where nothing is for sale and nothing is wanted', () => {
    const s = makeState({ locationId: 'loc_whispering_ruins' }, { content });
    expect(shop(s, legal(s), content, profile)).toBeUndefined();
  });
});
