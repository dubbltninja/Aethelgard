// GameConfig defaults (PLAN §5.16, D-066 #15): every number is DESIGN's, cited next to it. A value changes only after the
// DESIGN table it comes from changes (and tests/unit/content/config.test.ts, which restates the DESIGN values, with it).
// Written out in full on purpose, even where the schema has the same default, so the table reads as DESIGN does.
import { GameConfigSchema, type GameConfig, type GameConfigInput } from '@schema/contentPack';

export const configInput = {
  // WORLD §3.1 / D-047: the Wayfinder wakes in the Whispering Ruins; the Amulet of Echoes is on the neck from Loop 2.
  startLocationId: 'loc_whispering_ruins',
  startItems: [{ itemId: 'item_amulet_of_echoes', fromLoop: 2 }],

  // DESIGN §10.1: Day 30 Dawn = 29 days × 4 watches = tick 116; clock floor = current day + 3 dawns (D-066 #8);
  // warnings at 10/5/2/1 dawns left; §10.2: the Horde starts after a 3-move delay (D-066 #7).
  clock: { baseLimitTicks: 116, floorDawns: 3, warningsDawnsLeft: [10, 5, 2, 1], expiryHordeDelay: 3 },

  // D-048: six completed quests, or (Loop 2+) the Apex Echo.
  apexGate: { any: [{ counter: { name: 'quests_completed', min: 6 } }, { echo: 'echo_apex_resonance' }] },

  // DESIGN §11.1 (D-014): Hostile ≤ −40 · Wary −39..−10 · Neutral −9..19 · Trusted 20..59 · Sworn ≥ 60 (lower bounds;
  // reputation is clamped to [−100, 100]).
  repTiers: { hostile: -100, wary: -39, neutral: -9, trusted: 20, sworn: 60 },
  // DESIGN §9.2 tier_mod: Wary ×1.15 · Neutral ×1.0 · Trusted ×0.90 · Sworn ×0.80 (Hostile refuses to trade).
  tierPriceMult: { wary: 1.15, neutral: 1, trusted: 0.9, sworn: 0.8 },
  // DESIGN §7.5: sell = floor(0.75 × gold_value).
  sellMult: 0.75,

  // DESIGN §7.2: Common 50 · Uncommon 30 · Rare 15 · Epic 4 · Legendary 1; bands ≥ 9 use 35/35/20/8/2; bands ≥ 13 use 25/35/25/12/3.
  rarityWeights: [
    { minBand: 0, weights: { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 } },
    { minBand: 9, weights: { common: 35, uncommon: 35, rare: 20, epic: 8, legendary: 2 } },
    { minBand: 13, weights: { common: 25, uncommon: 35, rare: 25, epic: 12, legendary: 3 } },
  ],
  // DESIGN §7.2 multipliers: ×1.0 · ×1.1 · ×1.25 · ×1.5 · ×1.75.
  rarityStatMult: { common: 1, uncommon: 1.1, rare: 1.25, epic: 1.5, legendary: 1.75 },
  // DESIGN §8.3 gold fee × gold_value: Common→Uncommon 0.50 · Uncommon→Rare 1.00 · Rare→Epic 1.50 · Epic→Legendary 2.00
  // (keyed by the rarity upgraded TO).
  upgradeCostMult: { uncommon: 0.5, rare: 1, epic: 1.5, legendary: 2 },

  // DESIGN §6.1 / D-056: XP to next level, levels 1–19 (total to reach level 20 = 26,900).
  xpToNext: [100, 150, 220, 300, 400, 520, 650, 800, 960, 1140, 1340, 1560, 1800, 2060, 2340, 2640, 2960, 3300, 3660],
  // DESIGN §6.2: fodder XP = round(20 + 8·L + 1.2·L²); elite × 1.8; anomaly × 1.3.
  fodderXp: { a: 20, b: 8, c: 1.2, eliteMult: 1.8, anomalyMult: 1.3 },
  // DESIGN §6.6: creature HP/ATK/SP and XP × (1 + 0.03 · min(loop − 1, 5)).
  loopNudgePct: 0.03,
  loopNudgeCap: 5,

  // DESIGN §3.2: accuracy 85 + ⌊AGI/2⌋ (spells +10); hit% = clamp(accuracy − evasion, 50, 100).
  hitFloor: 50,
  baseAccuracy: 85,
  spellAccuracyBonus: 10,
  // DESIGN §3.2: crit% = 5 + ⌊AGI/2⌋, cap 60; crit_mult 1.5.
  critBase: 5,
  critCap: 60,
  critMult: 1.5,
  // DESIGN §3.2 / §4.1: Guard = 50 % reduction, +5 class resource (Warden +8 comes from the class rules).
  guardValue: 0.5,
  guardResource: 5,
  // DESIGN §3.2: flee% = clamp(40 + 3·AGI − 2·max_enemy_AGI, 10, 90) + 15 per failed attempt; §4.7: a scattered group costs +2 watches.
  flee: { base: 40, perAgi: 3, perEnemyAgi: 2, min: 10, max: 90, perFail: 15, scatterWatches: 2 },

  // DESIGN §9.5 / §10.1: a short rest restores 30 % of max HP and MP. §3.2: travel regen +5 % HP, +10 % MP per watch.
  restShortPct: 0.3,
  travelRegen: { hpPct: 0.05, mpPct: 0.1 },
  // WORLD §3 / §10: return trips roll the region pool at 20 %.
  returnEncounterChance: 0.2,
  // DESIGN §6.6: anomaly chance on entering a node with no fixed encounter: 10 % + 5 %·(loop − 1), cap 30 %.
  anomalyChance: { base: 0.1, perLoop: 0.05, cap: 0.3 },
  // WORLD §10.7 / DESIGN §16.6: entering an infected node costs ⌈max HP / 3⌉ ("⚠ −33% HP").
  hordeDamagePctMaxHp: 1 / 3,

  // DESIGN §10.7 / C-41: at most 5 Attunements equipped. §6.7: Corruption 0–6.
  attunementEquipCap: 5,
  corruptionMax: 6,
  // DESIGN §10.6 / D-055: location +2 · bestiary +3 · codex +1 · quest +5 · ending +50 · closer +10 (first time ever).
  resonance: { location: 2, bestiary: 3, codex: 1, quest: 5, ending: 50, closer: 10 },
  // DESIGN §12.4: attack 0 · debuff/aoe/utility/buff 2 · heal/shield/cleanse 3 (the companion's own turns).
  companionCooldownByKind: { attack: 0, debuff: 2, aoe: 2, utility: 2, buff: 2, heal: 3, shield: 3, cleanse: 3 },
} satisfies GameConfigInput;

/** The parsed defaults: what `buildContentPack()` uses unless a test passes its own `config`. */
export const gameConfig: GameConfig = GameConfigSchema.parse(configInput);
