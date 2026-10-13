// U17: GameConfig (PLAN §5.16) — the defaults in src/content/shared/config.ts equal DESIGN's tables. The expected values
// below are restated from DESIGN (section cited on each test), not imported, so a drive-by edit of the config fails here.
import { describe, expect, test } from 'bun:test';
import { repTier } from '@engine/conditions';
import type { ContentPack } from '@engine/ctx';
import { COMPANION_KIND_COOLDOWN } from '@schema/ability';
import { GameConfigSchema, type GameConfigInput } from '@schema/contentPack';
import { configInput, gameConfig } from '@content/shared/config';

const issues = (value: unknown): string[] => {
  const r = GameConfigSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
/** The one issue a value produces, as `path: message`. */
const only = (value: unknown): string => {
  const found = issues(value);
  expect(found, JSON.stringify(found)).toHaveLength(1);
  return found[0] ?? '';
};
const packWith = (config: typeof gameConfig) => ({ config }) as unknown as ContentPack;

describe('GameConfig defaults vs DESIGN', () => {
  test('DESIGN §10.1: Day 30 Dawn = tick 116, floor 3 dawns, warnings at 10/5/2/1 dawns left; §10.2: 3-move Horde delay', () => {
    expect(gameConfig.clock).toEqual({ baseLimitTicks: 116, floorDawns: 3, warningsDawnsLeft: [10, 5, 2, 1], expiryHordeDelay: 3 });
    expect(gameConfig.clock.baseLimitTicks).toBe((30 - 1) * 4);
  });

  test('DESIGN §6.1 / D-056: the XP curve and its cumulative column', () => {
    expect(gameConfig.xpToNext).toEqual([100, 150, 220, 300, 400, 520, 650, 800, 960, 1140, 1340, 1560, 1800, 2060, 2340, 2640, 2960, 3300, 3660]);
    const total: number[] = [0];
    for (const xp of gameConfig.xpToNext) total.push((total.at(-1) ?? 0) + xp);
    // "Total XP to reach" for levels 1–20 (DESIGN §6.1 table): level 20 = 26,900.
    expect(total).toEqual([0, 100, 250, 470, 770, 1170, 1690, 2340, 3140, 4100, 5240, 6580, 8140, 9940, 12000, 14340, 16980, 19940, 23240, 26900]);
  });

  test('DESIGN §6.2: fodder XP = round(20 + 8L + 1.2L²); elite ×1.8 (Golem L6 = 200); anomaly ×1.3', () => {
    const { a, b, c, eliteMult, anomalyMult } = gameConfig.fodderXp;
    const fodder = (level: number) => Math.round(a + b * level + c * level * level);
    const table: Record<number, number> = { 1: 29, 2: 41, 4: 71, 6: 111, 8: 161, 10: 220, 12: 289, 14: 367, 16: 455, 18: 553 };
    for (const [level, xp] of Object.entries(table)) expect(fodder(Number(level)), `L${level}`).toBe(xp);
    expect(Math.round(fodder(6) * eliteMult)).toBe(200);
    expect(anomalyMult).toBe(1.3);
  });

  test('DESIGN §11.1 (D-014): reputation tiers, via the engine classifier at every boundary', () => {
    const tier = (rep: number) => repTier(rep, packWith(gameConfig));
    const boundaries: [number, string][] = [
      [-100, 'hostile'], [-40, 'hostile'], [-39, 'wary'], [-10, 'wary'], [-9, 'neutral'], [0, 'neutral'], [19, 'neutral'],
      [20, 'trusted'], [59, 'trusted'], [60, 'sworn'], [100, 'sworn'],
    ];
    for (const [rep, expected] of boundaries) expect(tier(rep), `rep ${rep}`).toBe(expected);
  });

  test('DESIGN §9.2 / §7.5: tier price multipliers and the 75 % sell rate', () => {
    expect(gameConfig.tierPriceMult).toEqual({ wary: 1.15, neutral: 1, trusted: 0.9, sworn: 0.8 });
    expect(gameConfig.sellMult).toBe(0.75);
    expect(Math.floor(gameConfig.sellMult * 33)).toBe(24);
  });

  test('DESIGN §7.2: rarity weights by band (50/30/15/4/1; ≥9 35/35/20/8/2; ≥13 25/35/25/12/3) and stat multipliers', () => {
    const bands = gameConfig.rarityWeights.map((w) => [w.minBand, Object.values(w.weights)]);
    expect(bands).toEqual([[0, [50, 30, 15, 4, 1]], [9, [35, 35, 20, 8, 2]], [13, [25, 35, 25, 12, 3]]]);
    for (const w of gameConfig.rarityWeights) expect(Object.values(w.weights).reduce((x, y) => x + y, 0)).toBe(100);
    expect(gameConfig.rarityWeights[0]?.weights).toEqual({ common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 });
    expect(gameConfig.rarityStatMult).toEqual({ common: 1, uncommon: 1.1, rare: 1.25, epic: 1.5, legendary: 1.75 });
  });

  test('DESIGN §8.3: upgrade gold fee × gold_value, keyed by the rarity upgraded to', () => {
    expect(gameConfig.upgradeCostMult).toEqual({ uncommon: 0.5, rare: 1, epic: 1.5, legendary: 2 });
  });

  test('DESIGN §3.2: accuracy 85 (+10 for spells), hit floor 50, crit 5 % capped at 60 % for ×1.5, Guard 50 % for +5 resource', () => {
    expect(gameConfig).toMatchObject({
      baseAccuracy: 85, spellAccuracyBonus: 10, hitFloor: 50, critBase: 5, critCap: 60, critMult: 1.5, guardValue: 0.5, guardResource: 5,
    });
  });

  test('DESIGN §3.2 / §4.7: flee% = clamp(40 + 3·AGI − 2·enemyAGI, 10, 90) + 15 per failure; a scattered group costs 2 more watches', () => {
    expect(gameConfig.flee).toEqual({ base: 40, perAgi: 3, perEnemyAgi: 2, min: 10, max: 90, perFail: 15, scatterWatches: 2 });
  });

  test('DESIGN §3.2 / §9.5: travel regen +5 % HP and +10 % MP per watch; short rest +30 %', () => {
    expect(gameConfig.travelRegen).toEqual({ hpPct: 0.05, mpPct: 0.1 });
    expect(gameConfig.restShortPct).toBe(0.3);
  });

  test('DESIGN §6.6: loop nudge +3 % per loop capped at +15 %; anomalies 10 % + 5 %/loop capped at 30 %', () => {
    const nudge = (loop: number) => 1 + gameConfig.loopNudgePct * Math.min(loop - 1, gameConfig.loopNudgeCap);
    expect([1, 2, 3, 6, 9].map((l) => Number(nudge(l).toFixed(2)))).toEqual([1, 1.03, 1.06, 1.15, 1.15]);
    const { base, perLoop, cap } = gameConfig.anomalyChance;
    const chance = (loop: number) => Number(Math.min(cap, base + perLoop * (loop - 1)).toFixed(2));
    expect([1, 2, 3, 4, 5, 6, 9].map(chance)).toEqual([0.1, 0.15, 0.2, 0.25, 0.3, 0.3, 0.3]);
  });

  test('DESIGN §10.6 / D-055: Resonance per first-time event', () => {
    expect(gameConfig.resonance).toEqual({ location: 2, bestiary: 3, codex: 1, quest: 5, ending: 50, closer: 10 });
  });

  test('DESIGN §12.4: companion cooldown by kind — and it matches the ability schema', () => {
    expect(gameConfig.companionCooldownByKind).toEqual({ attack: 0, debuff: 2, aoe: 2, utility: 2, buff: 2, heal: 3, shield: 3, cleanse: 3 });
    expect(gameConfig.companionCooldownByKind).toEqual(COMPANION_KIND_COOLDOWN);
  });

  test('DESIGN §10.7 / §6.7 / WORLD §10.7: equip cap 5, Corruption 0–6, Horde entry costs a third of max HP, 20 % return encounters', () => {
    expect(gameConfig.attunementEquipCap).toBe(5);
    expect(gameConfig.corruptionMax).toBe(6);
    expect(Math.ceil(100 * gameConfig.hordeDamagePctMaxHp)).toBe(34);
    expect(gameConfig.returnEncounterChance).toBe(0.2);
  });

  test('D-048 apex gate, D-047 Amulet from Loop 2, start at the Whispering Ruins', () => {
    expect(gameConfig.apexGate).toEqual({ any: [{ counter: { name: 'quests_completed', min: 6 } }, { echo: 'echo_apex_resonance' }] });
    expect(gameConfig.startItems).toEqual([{ itemId: 'item_amulet_of_echoes', fromLoop: 2 }]);
    expect(gameConfig.startLocationId).toBe('loc_whispering_ruins');
  });
});

describe('GameConfigSchema', () => {
  test('the explicit table and the schema defaults agree: omitting every defaulted field changes nothing', () => {
    const required: GameConfigInput = {
      startLocationId: configInput.startLocationId,
      startItems: configInput.startItems,
      apexGate: configInput.apexGate,
      repTiers: configInput.repTiers,
      tierPriceMult: configInput.tierPriceMult,
      rarityWeights: configInput.rarityWeights,
      rarityStatMult: configInput.rarityStatMult,
      upgradeCostMult: configInput.upgradeCostMult,
      xpToNext: configInput.xpToNext,
      fodderXp: { a: 20, b: 8, c: 1.2 },
      companionCooldownByKind: configInput.companionCooldownByKind,
    };
    expect(GameConfigSchema.parse(required)).toEqual(gameConfig);
  });

  test('the parsed config is what the input describes (no field dropped or invented)', () => {
    expect(Object.keys(gameConfig).sort()).toEqual(Object.keys(configInput).sort());
  });

  test('invalid tables are rejected with readable paths', () => {
    expect(issues({ ...configInput, repTiers: { ...configInput.repTiers, wary: 30 } })).toContain('repTiers: tier lower bounds must increase: hostile < wary < neutral < trusted < sworn');
    expect(only({ ...configInput, xpToNext: configInput.xpToNext.slice(1) })).toMatch(/^xpToNext: /);
    expect(issues({ ...configInput, xpToNext: [...configInput.xpToNext.slice(0, 5), 1, ...configInput.xpToNext.slice(6)] })).toEqual([
      'xpToNext.5: the XP curve must increase with level (DESIGN §6.1)',
    ]);
    expect(only({ ...configInput, startLocationId: 'whispering_ruins' })).toMatch(/^startLocationId: expected an id with prefix loc_/);
    expect(issues({ ...configInput, clock: { warningsDawnsLeft: [5, 10] } })).toEqual(['clock.warningsDawnsLeft.1: warnings must be listed from most to fewest dawns left']);
    expect(issues({ ...configInput, critBase: 70 })).toEqual(['critBase: critBase must be ≤ critCap']);
    expect(issues({ ...configInput, flee: { min: 95 } })).toEqual(['flee.min: flee min must be ≤ max']);
    expect(issues({ ...configInput, rarityWeights: [{ minBand: 3, weights: configInput.rarityWeights[0]!.weights }] })).toEqual(['rarityWeights.0.minBand: the first rarity band starts at 0']);
    expect(issues({ ...configInput, rarityWeights: [configInput.rarityWeights[1], configInput.rarityWeights[0]] })).toEqual([
      'rarityWeights.0.minBand: the first rarity band starts at 0',
      'rarityWeights.1.minBand: rarity bands must be in ascending minBand order',
    ]);
    expect(only({ ...configInput, tierPriceMult: { ...configInput.tierPriceMult, sworn: 0 } })).toMatch(/^tierPriceMult\.sworn: /);
    expect(issues({ ...configInput, companionCooldownByKind: { attack: 0 } })).toHaveLength(7);
    expect(only({ ...configInput, hordeDamage: 0.5 })).toContain('Unrecognized key');
    expect(only({ ...configInput, apexGate: { counter: 'quests_completed' } })).toMatch(/^apexGate\.counter/);
  });

  test('tunables can be overridden per field (tests and Frayed-Clock-style experiments)', () => {
    const custom = GameConfigSchema.parse({ ...configInput, clock: { baseLimitTicks: 80 }, flee: { base: 55 } });
    expect(custom.clock).toEqual({ baseLimitTicks: 80, floorDawns: 3, warningsDawnsLeft: [10, 5, 2, 1], expiryHordeDelay: 3 });
    expect(custom.flee).toMatchObject({ base: 55, perAgi: 3 });
  });
});
