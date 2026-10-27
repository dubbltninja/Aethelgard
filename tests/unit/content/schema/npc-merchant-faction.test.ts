// U17: NpcSchema (PLAN §5.11), MerchantSchema and FactionSchema (PLAN §5.15) — WORLD §4/§9 records parse; rules bite.
import { describe, expect, test } from 'bun:test';
import { FactionSchema } from '@schema/faction';
import { MerchantSchema } from '@schema/merchant';
import { NpcSchema } from '@schema/npc';
import { factionRemnants, merchantKaelen, npcIlyra, npcKaelen } from '../examples';

const issuesOf = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } } }, value: unknown): string[] => {
  const r = schema.safeParse(value);
  return r.success ? [] : (r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`);
};
const expectIssue = (schema: Parameters<typeof issuesOf>[0], value: unknown, path: string, fragment: string) => {
  const found = issuesOf(schema, value);
  expect(found.some((i) => i.startsWith(`${path}: `) && i.includes(fragment)), `wanted "${path}: …${fragment}…", got ${JSON.stringify(found)}`).toBe(true);
};

describe('NpcSchema', () => {
  test('WORLD §4 Ilyra and Kaelen parse; faction defaults to neutral (D-014)', () => {
    const ilyra = NpcSchema.parse(npcIlyra);
    expect(ilyra).toMatchObject({ factionId: 'remnants', companionId: 'ilyra', roles: ['questgiver', 'companion', 'lore'], age: 30 });
    expect(ilyra.barks).toHaveLength(2);
    const kaelen = NpcSchema.parse(npcKaelen);
    expect(kaelen).toMatchObject({ factionId: 'neutral', merchantId: 'npc_kaelen_stonehand', portrait: { sigil: 'scales', accent: '#c9a227' } });
  });

  test('ids carry their prefix; companion id is the plain id; roles are a closed set', () => {
    expectIssue(NpcSchema, { ...npcIlyra, id: 'ilyra' }, 'id', 'npc_');
    expectIssue(NpcSchema, { ...npcIlyra, homeLocationId: 'whispering_ruins' }, 'homeLocationId', 'loc_');
    expectIssue(NpcSchema, { ...npcIlyra, companionId: 'npc_ilyra' }, 'companionId', 'Invalid enum value');
    expectIssue(NpcSchema, { ...npcIlyra, roles: ['wizard'] }, 'roles.0', 'Invalid enum value');
    expectIssue(NpcSchema, { ...npcIlyra, factionId: 'nomads' }, 'factionId', '');
    expectIssue(NpcSchema, { ...npcIlyra, portrait: {} }, 'portrait.sigil', 'Required');
    expectIssue(NpcSchema, { ...npcIlyra, titles: [] }, '', 'Unrecognized key');
  });

  test("a merchant NPC is keyed by its own id (WORLD §9); roles do not repeat", () => {
    expectIssue(NpcSchema, { ...npcKaelen, merchantId: 'npc_tamsin_reed' }, 'merchantId', "must be 'npc_kaelen_stonehand'");
    expectIssue(NpcSchema, { ...npcIlyra, roles: ['lore', 'lore'] }, 'roles.1', 'duplicate role');
  });
});

describe('MerchantSchema', () => {
  test('WORLD §9 Kaelen parses: core stock, rolled pool, best-of-three tier, defaults', () => {
    const m = MerchantSchema.parse(merchantKaelen);
    expect(m.id).toBe(m.npcId);
    expect(m).toMatchObject({ regionMarkup: 1, sellMult: 0.75, repFaction: 'best', services: ['buy', 'sell'], rollStock: { pick: { min: 3, max: 4 } } });
    expect(m.stock[0]).toEqual({ itemId: 'item_ley_touched_tonic', count: 3, priceMult: 1, rollRarity: true });
    expect(m.stock.at(-1)).toMatchObject({ itemId: 'item_glyphbound_lantern', when: { loop: { min: 2 } } });
  });

  test('counts are positive or "unlimited"; markups and multipliers are positive', () => {
    const stock = (entry: Record<string, unknown>) => ({ ...merchantKaelen, stock: [{ itemId: 'item_glow_moss', ...entry }] });
    expect(MerchantSchema.parse(stock({ count: 'unlimited' })).stock[0]?.count).toBe('unlimited');
    expect(MerchantSchema.parse(stock({})).stock[0]?.count).toBe(1);
    expectIssue(MerchantSchema, stock({ count: 0 }), 'stock.0.count', '');
    expectIssue(MerchantSchema, stock({ count: 'many' }), 'stock.0.count', '');
    expectIssue(MerchantSchema, stock({ priceMult: 0 }), 'stock.0.priceMult', '');
    expectIssue(MerchantSchema, stock({ itemId: 'glow_moss' }), 'stock.0.itemId', 'item_ or mat_');
    expectIssue(MerchantSchema, { ...merchantKaelen, regionMarkup: -1 }, 'regionMarkup', '');
    expectIssue(MerchantSchema, { ...merchantKaelen, stock: [] }, 'stock', 'at least 1');
  });

  test('keyed by the NPC id: id = npcId; rep faction is a faction or "best"; pick min ≤ max; services unique', () => {
    expectIssue(MerchantSchema, { ...merchantKaelen, npcId: 'npc_tamsin_reed' }, 'npcId', 'must equal id');
    expect(MerchantSchema.safeParse({ ...merchantKaelen, repFaction: 'ironclad' }).success).toBe(true);
    expect(MerchantSchema.safeParse({ ...merchantKaelen, repFaction: undefined }).success).toBe(true);
    expectIssue(MerchantSchema, { ...merchantKaelen, repFaction: 'nomads' }, 'repFaction', '');
    expectIssue(MerchantSchema, { ...merchantKaelen, rollStock: { pool: ['item_rusty_dagger'], pick: { min: 5, max: 4 } } }, 'rollStock.pick', 'min must be ≤ max');
    expectIssue(MerchantSchema, { ...merchantKaelen, services: ['buy', 'buy'] }, 'services.1', 'duplicate service');
    expectIssue(MerchantSchema, { ...merchantKaelen, services: ['barter'] }, 'services.0', 'Invalid enum value');
  });

  test('the same item twice is a typo unless the entries are conditional variants', () => {
    const tonic = { itemId: 'item_ley_touched_tonic' };
    expectIssue(MerchantSchema, { ...merchantKaelen, stock: [tonic, tonic] }, 'stock.1.itemId', 'stocked twice');
    expect(MerchantSchema.safeParse({ ...merchantKaelen, stock: [tonic, { ...tonic, when: { flag: 'flag_x' }, priceMult: 0.5 }] }).success).toBe(true);
  });
});

describe('FactionSchema', () => {
  test('the Remnants parse; every tier needs a line', () => {
    expect(FactionSchema.parse(factionRemnants)).toMatchObject({ id: 'remnants', shortName: 'Remnants', tierTexts: { sworn: 'They have ruled a line for you.' } });
    const { sworn: _sworn, ...short } = factionRemnants.tierTexts;
    expectIssue(FactionSchema, { ...factionRemnants, tierTexts: short }, 'tierTexts.sworn', 'Required');
    expectIssue(FactionSchema, { ...factionRemnants, id: 'nomads' }, 'id', 'Invalid enum value');
    expectIssue(FactionSchema, { ...factionRemnants, tierTexts: { ...factionRemnants.tierTexts, exalted: 'x' } }, 'tierTexts', 'Unrecognized key');
  });
});
