// ContentPack (PLAN §4.8) and GameConfig (PLAN §5.16). The pack is what the engine, UI and sim see: every table parsed
// by its zod schema, keyed by id, plus a derived `index` and the tunables in `config`. `buildContentPack()` in
// src/content/index.ts is the only producer; the engine never sees unparsed input types (PLAN §4.8).
// GameConfig's schema lives here (schema layer: src/content/shared may not be imported by schemas); the default VALUES
// are src/content/shared/config.ts, each cited to the DESIGN table it mirrors (D-066 #15: a value changes only after the
// DESIGN table it comes from changes).
import { z } from 'zod';
import type { Ability } from './ability';
import type { Achievement } from './achievement';
import type { Affix } from './affix';
import type { Attunement } from './attunement';
import type { Class as ClassDef } from './class';
import type { CodexEntry } from './codex';
import type { Companion } from './companion';
import { ConditionSchema } from './condition';
import type { Creature } from './creature';
import type { DialogueScene } from './dialogue';
import type { Echo } from './echo';
import type { Encounter } from './encounter';
import type { Ending } from './ending';
import type { Faction } from './faction';
import type { Item } from './item';
import type { Location } from './location';
import type { Merchant } from './merchant';
import type { Modifier } from './modifier';
import type { Npc } from './npc';
import { ItemId, LocationId, Pct, type FactionId } from './primitives';
import type { Quest } from './quest';
import type { Recipe } from './recipe';
import type { Region } from './region';
import type { Status as StatusDef } from './status';

const int = z.number().int();
const custom = z.ZodIssueCode.custom;

/** One value per rarity tier (exhaustive, unlike `z.record(Rarity, …)` which zod 3 types as Partial). */
const perRarity = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ common: value, uncommon: value, rare: value, epic: value, legendary: value }).strict();

// ---- GameConfig ------------------------------------------------------------------------------------------------------

export const GameConfigSchema = z
  .object({
    /** 'loc_whispering_ruins'. */
    startLocationId: LocationId,
    /** Amulet of Echoes: on the neck from Loop 2 (D-047). */
    startItems: z.array(z.object({ itemId: ItemId, fromLoop: int.min(1).default(1) }).strict()),
    /** DESIGN §10.1–10.2. Limits are in watches (ticks); 4 per day. */
    clock: z
      .object({
        baseLimitTicks: int.min(1).default(116),
        floorDawns: int.min(0).default(3),
        /** Dawns before the limit at which a warning fires (DESIGN §10.1 table). */
        warningsDawnsLeft: z.array(int.min(1)).default([10, 5, 2, 1]),
        /** Moves between clock expiry and the Horde's first infection (DESIGN §10.2). */
        expiryHordeDelay: int.min(0).default(3),
      })
      .strict()
      .default({}),
    /** D-048 exactly: `{ any: [{ counter: { name: 'quests_completed', min: 6 } }, { echo: 'echo_apex_resonance' }] }`. */
    apexGate: ConditionSchema,
    /** Lower bound of each reputation tier: ≤−40 hostile, −39..−10 wary, −9..19 neutral, 20..59 trusted, ≥60 sworn (D-014). */
    repTiers: z.object({ hostile: z.number(), wary: z.number(), neutral: z.number(), trusted: z.number(), sworn: z.number() }).strict(),
    /** DESIGN §9.2 `tier_mod`: 1.15 / 1.0 / 0.90 / 0.80; Hostile refuses to trade. */
    tierPriceMult: z
      .object({ wary: z.number().positive(), neutral: z.number().positive(), trusted: z.number().positive(), sworn: z.number().positive() })
      .strict(),
    /** DESIGN §7.5: sell = floor(0.75 × gold_value). */
    sellMult: z.number().positive().default(0.75),
    /** Relative weights by band; the last entry whose `minBand` ≤ the band applies (DESIGN §7.2). */
    rarityWeights: z.array(z.object({ minBand: int.min(0), weights: perRarity(z.number().min(0)) }).strict()).min(1),
    /** DESIGN §7.2. */
    rarityStatMult: perRarity(z.number().positive()),
    /** Gold-fee multiple of `gold_value`, keyed by the rarity being upgraded TO (DESIGN §8.3; common is never a target). */
    upgradeCostMult: z.object({ uncommon: z.number().min(0), rare: z.number().min(0), epic: z.number().min(0), legendary: z.number().min(0) }).strict(),
    /** DESIGN §6.1 / D-056: XP to go from level n to n+1, n = 1..19. */
    xpToNext: z.array(int.min(1)).length(19),
    /** DESIGN §6.2: round(a + b·L + c·L²); elites ×eliteMult; anomalies ×anomalyMult. */
    fodderXp: z
      .object({ a: z.number(), b: z.number(), c: z.number(), eliteMult: z.number().positive().default(1.8), anomalyMult: z.number().positive().default(1.3) })
      .strict(),
    /** DESIGN §6.6: creature stats and XP × (1 + loopNudgePct × min(loop − 1, loopNudgeCap)). */
    loopNudgePct: z.number().min(0).default(0.03),
    loopNudgeCap: int.min(0).default(5),
    /** DESIGN §3.2: hit% = clamp(accuracy − evasion, hitFloor, 100); accuracy = baseAccuracy + ⌊AGI/2⌋ (+ spellAccuracyBonus for spells). */
    hitFloor: z.number().min(0).max(100).default(50),
    baseAccuracy: z.number().default(85),
    spellAccuracyBonus: z.number().default(10),
    /** DESIGN §3.2: crit% = critBase + ⌊AGI/2⌋, capped; crit_mult 1.5. */
    critBase: z.number().min(0).default(5),
    critCap: z.number().min(0).max(100).default(60),
    critMult: z.number().positive().default(1.5),
    /** DESIGN §3.2 / §4.7: Guard halves direct damage; +5 class resource (class rules override, e.g. Warden +8). */
    guardValue: Pct.default(0.5),
    guardResource: z.number().default(5),
    /** DESIGN §3.2: flee% = clamp(base + perAgi·AGI − perEnemyAgi·maxEnemyAGI, min, max) + perFail·failures; DESIGN §4.7 scatter +2 watches. */
    flee: z
      .object({
        base: z.number().default(40),
        perAgi: z.number().default(3),
        perEnemyAgi: z.number().default(2),
        min: z.number().default(10),
        max: z.number().default(90),
        perFail: z.number().default(15),
        scatterWatches: int.min(0).default(2),
      })
      .strict()
      .default({}),
    /** DESIGN §9.5 / §10.1: a short rest restores 30 % of max HP and MP. */
    restShortPct: Pct.default(0.3),
    /** DESIGN §3.2: per watch travelled, +5 % max HP and +10 % max MP. */
    travelRegen: z.object({ hpPct: Pct.default(0.05), mpPct: Pct.default(0.1) }).strict().default({}),
    /** WORLD §10: return-trip encounter chance (RegionSchema default). */
    returnEncounterChance: Pct.default(0.2),
    /** DESIGN §6.6: anomaly spawn chance 10 % + 5 %·(loop − 1), cap 30 %. */
    anomalyChance: z.object({ base: Pct.default(0.1), perLoop: Pct.default(0.05), cap: Pct.default(0.3) }).strict().default({}),
    /** WORLD §10.7: entering an infected node costs ⌈max HP / 3⌉. */
    hordeDamagePctMaxHp: Pct.default(1 / 3),
    /** DESIGN §10.7, C-41. */
    attunementEquipCap: int.min(1).default(5),
    /** DESIGN §6.7. */
    corruptionMax: int.min(1).default(6),
    /** DESIGN §10.6 / D-055: Resonance for each first-time event. */
    resonance: z
      .object({
        location: int.min(0).default(2),
        bestiary: int.min(0).default(3),
        codex: int.min(0).default(1),
        quest: int.min(0).default(5),
        ending: int.min(0).default(50),
        closer: int.min(0).default(10),
      })
      .strict()
      .default({}),
    /** DESIGN §12.4: companion auto-ability cooldown by kind, in the companion's own turns. */
    companionCooldownByKind: z
      .object({ attack: int.min(0), debuff: int.min(0), aoe: int.min(0), utility: int.min(0), buff: int.min(0), heal: int.min(0), shield: int.min(0), cleanse: int.min(0) })
      .strict(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
    const t = c.repTiers;
    if (!(t.hostile < t.wary && t.wary < t.neutral && t.neutral < t.trusted && t.trusted < t.sworn)) {
      issue(['repTiers'], 'tier lower bounds must increase: hostile < wary < neutral < trusted < sworn');
    }
    c.rarityWeights.forEach((w, i) => {
      if (i === 0 && w.minBand !== 0) issue(['rarityWeights', 0, 'minBand'], 'the first rarity band starts at 0');
      if (i > 0 && w.minBand <= (c.rarityWeights[i - 1]?.minBand ?? 0)) issue(['rarityWeights', i, 'minBand'], 'rarity bands must be in ascending minBand order');
      if (Object.values(w.weights).every((x) => x === 0)) issue(['rarityWeights', i, 'weights'], 'at least one rarity needs a positive weight');
    });
    c.xpToNext.forEach((xp, i) => {
      if (i > 0 && xp <= (c.xpToNext[i - 1] ?? 0)) issue(['xpToNext', i], 'the XP curve must increase with level (DESIGN §6.1)');
    });
    c.clock.warningsDawnsLeft.forEach((d, i) => {
      if (i > 0 && d >= (c.clock.warningsDawnsLeft[i - 1] ?? 0)) issue(['clock', 'warningsDawnsLeft', i], 'warnings must be listed from most to fewest dawns left');
    });
    if (c.critBase > c.critCap) issue(['critBase'], 'critBase must be ≤ critCap');
    if (c.flee.min > c.flee.max) issue(['flee', 'min'], 'flee min must be ≤ max');
    if (c.anomalyChance.base > c.anomalyChance.cap) issue(['anomalyChance', 'base'], 'anomaly base chance must be ≤ cap');
  });

export type GameConfig = z.output<typeof GameConfigSchema>;
export type GameConfigInput = z.input<typeof GameConfigSchema>;

// ---- Content index ---------------------------------------------------------------------------------------------------

/** The only crafting station (Borin at the Emberforge, DESIGN §8): the key of `ContentIndex.recipesByStation`. */
export const CRAFTING_STATION = 'emberforge';

/** Derived lookups, built once by `buildContentPack()` (PLAN §4.8). Lists keep the authored (input) order. */
export interface ContentIndex {
  exitsFrom: Record<string, Location['exits']>;
  locationsByRegion: Record<string, string[]>;
  /** Scene ids offered by `talk`, sorted by priority desc (ties: authored order). */
  scenesByNpc: Record<string, string[]>;
  questsByGiver: Record<string, string[]>;
  /** Class abilities only (rgr_|wiz_|elf_|wrd_|wvr_), keyed by class id. */
  abilitiesByClass: Record<string, string[]>;
  /** Single station today: every recipe under `'emberforge'`. */
  recipesByStation: Record<string, string[]>;
  creatureIds: string[];
  itemIds: string[];
  questIds: string[];
  locationIds: string[];
  endingIds: string[];
  /** config.startLocationId ('loc_whispering_ruins'). */
  startLocationId: string;
}

// ---- ContentPack -----------------------------------------------------------------------------------------------------

/** Table names, in the order `buildContentPack()` parses and reports them. `config` is the one non-table member. */
export const TABLE_NAMES = [
  'regions',
  'locations',
  'creatures',
  'items',
  'recipes',
  'abilities',
  'classes',
  'statuses',
  'quests',
  'dialogues',
  'npcs',
  'companions',
  'echoes',
  'codex',
  'achievements',
  'attunements',
  'modifiers',
  'endings',
  'merchants',
  'affixes',
  'encounters',
  'factions',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export interface ContentPack {
  /** Content semver, embedded in saves for diagnostics. */
  version: string;
  regions: Record<string, Region>;
  locations: Record<string, Location>;
  creatures: Record<string, Creature>;
  items: Record<string, Item>;
  recipes: Record<string, Recipe>;
  abilities: Record<string, Ability>;
  classes: Record<string, ClassDef>;
  statuses: Record<string, StatusDef>;
  quests: Record<string, Quest>;
  dialogues: Record<string, DialogueScene>;
  npcs: Record<string, Npc>;
  companions: Record<string, Companion>;
  echoes: Record<string, Echo>;
  codex: Record<string, CodexEntry>;
  achievements: Record<string, Achievement>;
  attunements: Record<string, Attunement>;
  modifiers: Record<string, Modifier>;
  endings: Record<string, Ending>;
  /** Keyed by NPC id (WORLD §9). */
  merchants: Record<string, Merchant>;
  affixes: Record<string, Affix>;
  /** Fixed, wandering-pool and anomaly encounters (WORLD §10). */
  encounters: Record<string, Encounter>;
  /** Partial so an empty pack is a valid pack; the release gate requires all three. */
  factions: Partial<Record<z.infer<typeof FactionId>, Faction>>;
  /** Tunables (PLAN §5.16). */
  config: GameConfig;
  /** Derived, built by `buildContentPack()`. */
  index: ContentIndex;
}

// ---- Validation report (shared by buildContentPack and validateContent, PLAN §5.19) -----------------------------------

/** `rule` is `rule-NN` for PLAN §5.19's numbered rules, `schema` for a zod failure on one record. */
export interface ContentIssue {
  table: string;
  /** The record id, or `#<index>` for a record without a usable id, or `-` for a pack-level issue. */
  id: string;
  /** Dotted path inside the record ('' for the record itself). */
  path: string;
  message: string;
  rule: string;
}

export interface ContentReport {
  errors: ContentIssue[];
  warnings: ContentIssue[];
}
