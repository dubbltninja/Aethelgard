// U15: RecipeSchema (PLAN §5.6, DESIGN §8.1/§8.5) — three DESIGN recipes incl. recipe_breach_anchor (D-066 #10) parse.
import { describe, expect, test } from 'bun:test';
import { RecipeSchema, type RecipeInput } from '@schema/recipe';

const messages = (value: unknown): string[] => {
  const r = RecipeSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

/** DESIGN §8.5: the story recipe — free, Trusted (Neutral while the Mending / Iron Silence is active), one fragment of either kind. */
const breachAnchor: RecipeInput = {
  id: 'recipe_breach_anchor',
  name: 'Breach-anchor',
  category: 'quest',
  inputs: [
    { itemId: 'item_aetherium_shard', count: 3 },
    { itemId: 'item_void_shard', count: 3 },
    { itemId: 'mat_ember_ore', count: 3 },
    { itemId: 'mat_silverwood_heartwood', count: 1 },
  ],
  anyOf: [[{ itemId: 'item_heartstone_fragment_stable', count: 1 }], [{ itemId: 'item_heartstone_fragment_dead', count: 1 }]],
  output: { itemId: 'item_breach_anchor' },
  gold: 0,
  story: true,
  repTier: 'trusted',
  repTierWhileActive: { quests: ['q_the_mending', 'q_iron_silence'], tier: 'neutral' },
  requires: { echo: 'echo_anchor_schema' },
  tags: ['story'],
};

const voidforgedEdge: RecipeInput = {
  id: 'recipe_voidforged_edge',
  name: 'Void-forged Edge',
  category: 'weapon',
  inputs: [
    { itemId: 'item_void_shard', count: 3 },
    { itemId: 'mat_ember_ore', count: 3 },
    { itemId: 'mat_iron_rivet', count: 2 },
  ],
  output: { itemId: 'item_voidforged_edge' },
  gold: 120,
  repTier: 'trusted',
  requires: { flag: 'flag_shards_refused' },
};

const emberFlask: RecipeInput = {
  id: 'recipe_ember_flask',
  name: 'Ember Flask',
  category: 'consumable',
  inputs: [{ itemId: 'mat_ember_ore' }, { itemId: 'mat_ley_resin' }],
  output: { itemId: 'item_ember_flask', count: 2 },
  gold: 20,
};

describe('RecipeSchema', () => {
  test('recipe_breach_anchor, recipe_voidforged_edge and recipe_ember_flask parse', () => {
    for (const r of [breachAnchor, voidforgedEdge, emberFlask]) expect(messages(r)).toEqual([]);
  });

  test('the Breach-anchor keeps both fragment alternatives and the Neutral override', () => {
    const r = RecipeSchema.parse(breachAnchor);
    expect(r.anyOf).toHaveLength(2);
    expect(r.anyOf.flat().map((x) => x.itemId)).toEqual(['item_heartstone_fragment_stable', 'item_heartstone_fragment_dead']);
    expect(r.gold).toBe(0);
    expect(r.repTier).toBe('trusted');
    expect(r.repTierWhileActive).toEqual({ quests: ['q_the_mending', 'q_iron_silence'], tier: 'neutral' });
  });

  test('defaults: story false, neutral tier, 1 watch, input and output counts 1, no alternatives', () => {
    const r = RecipeSchema.parse(emberFlask);
    expect(r.story).toBe(false);
    expect(r.repTier).toBe('neutral');
    expect(r.timeCost).toBe(1);
    expect(r.inputs.map((i) => i.count)).toEqual([1, 1]);
    expect(r.anyOf).toEqual([]);
    expect(RecipeSchema.parse({ ...voidforgedEdge }).output.count).toBe(1);
  });

  test('bad id prefix fails', () => {
    expect(messages({ ...emberFlask, id: 'ember_flask' })[0]).toContain('expected an id with prefix recipe_');
    expect(messages({ ...emberFlask, id: 'item_ember_flask' })).not.toEqual([]);
    expect(messages({ ...emberFlask, output: { itemId: 'ember_flask' } })).not.toEqual([]);
    expect(messages({ ...emberFlask, inputs: [{ itemId: 'ore' }] })).not.toEqual([]);
  });

  test('missing required fields fail', () => {
    const { gold: _g, ...noGold } = emberFlask as Record<string, unknown>;
    expect(messages(noGold).join()).toContain('gold');
    const { category: _c, ...noCategory } = emberFlask as Record<string, unknown>;
    expect(messages(noCategory).join()).toContain('category');
    expect(messages({ ...emberFlask, inputs: [] })).not.toEqual([]);
    expect(messages({ ...emberFlask, category: 'tool' })).not.toEqual([]);
    expect(messages({ ...emberFlask, station: 'forge' })).not.toEqual([]);
  });

  test('a story recipe charges no fee (D-066 #10)', () => {
    expect(messages({ ...breachAnchor, gold: 50 })).toEqual(['gold: a story recipe charges no fee (gold must be 0, D-066 #10)']);
  });

  test('repTierWhileActive must lower the gate', () => {
    expect(messages({ ...breachAnchor, repTier: 'neutral' })).toEqual(['repTierWhileActive.tier: repTierWhileActive must be lower than repTier (neutral)']);
    expect(messages({ ...breachAnchor, repTierWhileActive: { quests: ['q_the_mending'], tier: 'trusted' } })).not.toEqual([]);
    expect(messages({ ...breachAnchor, repTierWhileActive: { quests: [], tier: 'neutral' } })).not.toEqual([]);
    expect(messages({ ...breachAnchor, repTierWhileActive: { quests: ['the_mending'], tier: 'neutral' } })).not.toEqual([]);
  });

  test('duplicate inputs, empty alternative groups and bad timeCost fail', () => {
    expect(messages({ ...emberFlask, inputs: [{ itemId: 'mat_ember_ore' }, { itemId: 'mat_ember_ore', count: 2 }] })).toEqual([
      'inputs.1.itemId: duplicate input mat_ember_ore; raise its count instead',
    ]);
    expect(messages({ ...breachAnchor, anyOf: [[]] })).not.toEqual([]);
    expect(messages({ ...emberFlask, timeCost: 2 })).not.toEqual([]);
    expect(messages({ ...emberFlask, repTier: 'honored' })).not.toEqual([]);
  });
});
