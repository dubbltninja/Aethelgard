// Content assembly (PLAN §5.18): authored tables in, `ContentPack` out. Every table is parsed with its zod schema
// (defaults applied), keyed by id with duplicate detection, indexed, optionally cross-validated, and returned as the
// pack the engine, UI and sim consume. The engine never sees unparsed input types.
//
//   buildContentPack(tables?, options?)  → ContentPack, throws ContentError on any error (dev, build, tests)
//   parseContentPack(tables?, options?)  → { pack, report }, never throws on content errors (tools: validate, REPORT.md)
//
// `tables` defaults to `contentTables`, the authored content (empty until the content units land; each appends its
// imports there). Passing tables replaces them wholesale, so tests build exactly the pack they describe; a missing table
// is empty and a missing `config` is the DESIGN defaults (shared/config.ts).
import { z } from 'zod';
import { AbilitySchema, abilityOwnerKind, type AbilityInput } from '@schema/ability';
import { AchievementSchema, type AchievementInput } from '@schema/achievement';
import { AffixSchema, type AffixInput } from '@schema/affix';
import { AttunementSchema, type AttunementInput } from '@schema/attunement';
import { ClassSchema, type ClassInput } from '@schema/class';
import { CodexSchema, type CodexEntryInput } from '@schema/codex';
import { EchoSchema, type EchoInput } from '@schema/echo';
import { CompanionSchema, type CompanionInput } from '@schema/companion';
import {
  CRAFTING_STATION,
  GameConfigSchema,
  TABLE_NAMES,
  type ContentIndex,
  type ContentIssue,
  type ContentPack,
  type ContentReport,
  type GameConfigInput,
  type TableName,
} from '@schema/contentPack';
import { CreatureSchema, type CreatureInput } from '@schema/creature';
import { DialogueSceneSchema, type DialogueSceneInput } from '@schema/dialogue';
import { EncounterSchema, type EncounterInput } from '@schema/encounter';
import { EndingSchema, type EndingInput } from '@schema/ending';
import { FactionSchema, type FactionInput } from '@schema/faction';
import { ItemSchema, type ItemInput } from '@schema/item';
import { LocationSchema, type LocationInput } from '@schema/location';
import { MerchantSchema, type MerchantInput } from '@schema/merchant';
import { ModifierSchema, type ModifierInput } from '@schema/modifier';
import { NpcSchema, type NpcInput } from '@schema/npc';
import { QuestSchema, type QuestInput } from '@schema/quest';
import { RecipeSchema, type RecipeInput } from '@schema/recipe';
import { RegionSchema, type RegionInput } from '@schema/region';
import { StatusSchema, type StatusInput } from '@schema/status';
import { elfAbilities } from './abilities/elf';
import { itemAbilities } from './abilities/items';
import { rangerAbilities } from './abilities/ranger';
import { wardenAbilities } from './abilities/warden';
import { weaverAbilities } from './abilities/weaver';
import { wizardAbilities } from './abilities/wizard';
import { amuletItems } from './items/amulet';
import { armor } from './items/armor';
import { starterItems } from './items/starter';
import { trinkets } from './items/trinkets';
import { weapons } from './items/weapons';
import * as regionTables from './regions';
import { achievements } from './shared/achievements';
import { affixes } from './shared/affixes';
import { attunements } from './shared/attunements';
import { classes } from './shared/classes';
import { configInput, gameConfig } from './shared/config';
import { echoes } from './shared/echoes';
import { endings } from './shared/endings';
import { factions } from './shared/factions';
import { modifiers } from './shared/modifiers';
import { statuses } from './shared/statuses';
import { INCOMPLETE_TABLES } from './progress';
import { validateContent } from './validate';

export type { ContentIndex, ContentIssue, ContentPack, ContentReport, GameConfig, TableName } from '@schema/contentPack';

/** Content semver, embedded in saves for diagnostics (PLAN §4.8). */
export const CONTENT_VERSION = '0.1.0';

// ---- Tables ----------------------------------------------------------------------------------------------------------

/** The authored input of every table (`z.input`: defaults not yet applied). */
export interface ContentTables {
  regions: readonly RegionInput[];
  locations: readonly LocationInput[];
  creatures: readonly CreatureInput[];
  items: readonly ItemInput[];
  recipes: readonly RecipeInput[];
  abilities: readonly AbilityInput[];
  classes: readonly ClassInput[];
  statuses: readonly StatusInput[];
  quests: readonly QuestInput[];
  dialogues: readonly DialogueSceneInput[];
  npcs: readonly NpcInput[];
  companions: readonly CompanionInput[];
  echoes: readonly EchoInput[];
  codex: readonly CodexEntryInput[];
  achievements: readonly AchievementInput[];
  attunements: readonly AttunementInput[];
  modifiers: readonly ModifierInput[];
  endings: readonly EndingInput[];
  merchants: readonly MerchantInput[];
  affixes: readonly AffixInput[];
  encounters: readonly EncounterInput[];
  factions: readonly FactionInput[];
  config: GameConfigInput;
}

/**
 * The authored content. Each content unit appends its tables here (PLAN §5.18: regions/index.ts concatenates the
 * per-region tables, shared/*.ts supply the global ones). U40: classes, statuses, affixes, the Ranger and Wizard trees,
 * and the starting kits' item records (items/starter.ts, until the item units own them). U41: the Elf, Warden and Weaver
 * trees, the Amulet of Echoes and its Echo Bolt. The six companions and their 24 abilities (shared/companions.ts,
 * abilities/companions.ts) are authored but NOT listed here until the unit that lands the last NPC/quest/scene they
 * reference registers them (D-088, planned U56). U42+: the region folders' tables arrive through regions/index.ts (one
 * import line per region there; nothing changes here), with their references into tables still being authored pending
 * under D-090. U51: the 103 Echoes, 40 achievements, 15 Attunements, six modifiers, the eight ending and closer records and
 * the three factions (shared/{echoes,achievements,attunements,modifiers,endings,factions}.ts).
 */
export const contentTables: ContentTables = {
  regions: [...regionTables.regions],
  locations: [...regionTables.locations],
  creatures: [...regionTables.creatures],
  items: [...starterItems, ...amuletItems, ...weapons, ...armor, ...trinkets, ...regionTables.items],
  recipes: [],
  abilities: [...rangerAbilities, ...wizardAbilities, ...elfAbilities, ...wardenAbilities, ...weaverAbilities, ...itemAbilities],
  classes: [...classes],
  statuses: [...statuses],
  quests: [],
  dialogues: [],
  npcs: [...regionTables.npcs],
  companions: [],
  echoes: [...echoes],
  codex: [],
  achievements: [...achievements],
  attunements: [...attunements],
  modifiers: [...modifiers],
  endings: [...endings],
  merchants: [],
  affixes: [...affixes],
  encounters: [],
  factions: [...factions],
  config: configInput,
};

// ---- Errors and reports ----------------------------------------------------------------------------------------------

export function formatIssue(issue: ContentIssue): string {
  const where = issue.path === '' ? `${issue.table}.${issue.id}` : `${issue.table}.${issue.id}.${issue.path}`;
  return `${issue.rule}: ${where}: ${issue.message}`;
}

/** Thrown by `buildContentPack` when the report has errors; `report` has all of them. */
export class ContentError extends Error {
  constructor(readonly report: ContentReport) {
    const shown = report.errors.slice(0, 10).map(formatIssue);
    const more = report.errors.length > shown.length ? `\n  … and ${report.errors.length - shown.length} more` : '';
    super(`content has ${report.errors.length} error(s):\n  ${shown.join('\n  ')}${more}`);
    this.name = 'ContentError';
  }
}

export interface BuildOptions {
  /** Default `CONTENT_VERSION`. */
  version?: string;
  /**
   * Cross-reference and semantic validation (PLAN §5.19). Runs on the assembled pack only when every table parsed cleanly
   * (cross-reference errors against records that failed to parse are noise). Omitted: `validateContent` (non-strict, U19);
   * `false`: skipped (a deliberately partial pack in a test).
   */
  validate?: ((pack: ContentPack) => ContentReport) | false;
  /** Tables still being authored (D-090). Default: `INCOMPLETE_TABLES` for the authored `contentTables`, none otherwise. */
  incompleteTables?: readonly TableName[];
}

export interface BuildResult {
  /** On errors this holds what parsed (failed records are absent): for diagnostics only, do not run the game on it. */
  pack: ContentPack;
  report: ContentReport;
}

// ---- Parsing ---------------------------------------------------------------------------------------------------------

type Parsed<S extends z.ZodTypeAny> = Record<string, z.output<S>>;

/** Ids that would shadow `Object.prototype` members in a plain record (`content.classes['constructor']`). */
const RESERVED = (id: string): boolean => id in Object.prototype;

function parseRows<S extends z.ZodTypeAny>(table: TableName, schema: S, rows: readonly unknown[], report: ContentReport): Parsed<S> {
  const out: Record<string, z.output<S>> = {};
  rows.forEach((row, index) => {
    const rawId = typeof row === 'object' && row !== null && typeof (row as { id?: unknown }).id === 'string' ? (row as { id: string }).id : `#${index}`;
    const result = schema.safeParse(row);
    if (!result.success) {
      for (const issue of result.error.issues) {
        report.errors.push({ table, id: rawId, path: issue.path.join('.'), message: issue.message, rule: 'schema' });
      }
      return;
    }
    const record = result.data as z.output<S> & { id: string };
    if (RESERVED(record.id)) {
      report.errors.push({ table, id: record.id, path: 'id', message: `'${record.id}' is reserved (it names an Object.prototype member)`, rule: 'rule-06' });
    } else if (Object.hasOwn(out, record.id)) {
      report.errors.push({ table, id: record.id, path: 'id', message: `duplicate id '${record.id}' (record #${index}; ids are unique within a table)`, rule: 'rule-06' });
    } else {
      out[record.id] = record;
    }
  });
  return out;
}

export function buildIndex(pack: Omit<ContentPack, 'index' | 'version'>): ContentIndex {
  const exitsFrom: ContentIndex['exitsFrom'] = {};
  const locationsByRegion: ContentIndex['locationsByRegion'] = {};
  for (const region of Object.values(pack.regions)) locationsByRegion[region.id] = [];
  for (const loc of Object.values(pack.locations)) {
    exitsFrom[loc.id] = loc.exits;
    (locationsByRegion[loc.regionId] ??= []).push(loc.id);
  }

  const scenes: Record<string, { id: string; priority: number }[]> = {};
  for (const scene of Object.values(pack.dialogues)) {
    if (scene.npcId !== undefined) (scenes[scene.npcId] ??= []).push({ id: scene.id, priority: scene.priority });
  }
  const scenesByNpc: ContentIndex['scenesByNpc'] = {};
  for (const [npc, list] of Object.entries(scenes)) scenesByNpc[npc] = list.sort((a, b) => b.priority - a.priority).map((s) => s.id);

  const questsByGiver: ContentIndex['questsByGiver'] = {};
  for (const quest of Object.values(pack.quests)) {
    if (quest.giverNpcId !== undefined) (questsByGiver[quest.giverNpcId] ??= []).push(quest.id);
  }

  const abilitiesByClass: ContentIndex['abilitiesByClass'] = {};
  for (const cls of Object.values(pack.classes)) abilitiesByClass[cls.id] = [];
  for (const ability of Object.values(pack.abilities)) {
    if (abilityOwnerKind(ability.id) === 'class') (abilitiesByClass[ability.ownerId] ??= []).push(ability.id);
  }

  return {
    exitsFrom,
    locationsByRegion,
    scenesByNpc,
    questsByGiver,
    abilitiesByClass,
    recipesByStation: { [CRAFTING_STATION]: Object.keys(pack.recipes) },
    creatureIds: Object.keys(pack.creatures),
    itemIds: Object.keys(pack.items),
    questIds: Object.keys(pack.quests),
    locationIds: Object.keys(pack.locations),
    endingIds: Object.keys(pack.endings),
    startLocationId: pack.config.startLocationId,
  };
}

/** Parses every table, builds the index, runs the optional validator. Never throws on content errors. */
export function parseContentPack(tables: Partial<ContentTables> = contentTables, options: BuildOptions = {}): BuildResult {
  const report: ContentReport = { errors: [], warnings: [] };
  const rows = <K extends TableName>(name: K): readonly unknown[] => tables[name] ?? [];

  const configResult = GameConfigSchema.safeParse(tables.config ?? configInput);
  let config = gameConfig;
  if (configResult.success) config = configResult.data;
  else {
    for (const issue of configResult.error.issues) report.errors.push({ table: 'config', id: '-', path: issue.path.join('.'), message: issue.message, rule: 'schema' });
  }

  const parsed = {
    regions: parseRows('regions', RegionSchema, rows('regions'), report),
    locations: parseRows('locations', LocationSchema, rows('locations'), report),
    creatures: parseRows('creatures', CreatureSchema, rows('creatures'), report),
    items: parseRows('items', ItemSchema, rows('items'), report),
    recipes: parseRows('recipes', RecipeSchema, rows('recipes'), report),
    abilities: parseRows('abilities', AbilitySchema, rows('abilities'), report),
    classes: parseRows('classes', ClassSchema, rows('classes'), report),
    statuses: parseRows('statuses', StatusSchema, rows('statuses'), report),
    quests: parseRows('quests', QuestSchema, rows('quests'), report),
    dialogues: parseRows('dialogues', DialogueSceneSchema, rows('dialogues'), report),
    npcs: parseRows('npcs', NpcSchema, rows('npcs'), report),
    companions: parseRows('companions', CompanionSchema, rows('companions'), report),
    echoes: parseRows('echoes', EchoSchema, rows('echoes'), report),
    codex: parseRows('codex', CodexSchema, rows('codex'), report),
    achievements: parseRows('achievements', AchievementSchema, rows('achievements'), report),
    attunements: parseRows('attunements', AttunementSchema, rows('attunements'), report),
    modifiers: parseRows('modifiers', ModifierSchema, rows('modifiers'), report),
    endings: parseRows('endings', EndingSchema, rows('endings'), report),
    merchants: parseRows('merchants', MerchantSchema, rows('merchants'), report),
    affixes: parseRows('affixes', AffixSchema, rows('affixes'), report),
    encounters: parseRows('encounters', EncounterSchema, rows('encounters'), report),
    factions: parseRows('factions', FactionSchema, rows('factions'), report),
  } satisfies Record<TableName, unknown>;

  const body: Omit<ContentPack, 'index' | 'version'> = { ...parsed, config };
  const pack: ContentPack = { ...body, index: buildIndex(body), version: options.version ?? CONTENT_VERSION };

  // The authored content is still being written (D-090): references into its incomplete tables are pending, not errors.
  const incompleteTables = options.incompleteTables ?? (tables === contentTables ? INCOMPLETE_TABLES : []);
  const validate = options.validate === false ? undefined : (options.validate ?? ((p: ContentPack) => validateContent(p, { incompleteTables })));
  if (validate && report.errors.length === 0) {
    const extra = validate(pack);
    report.errors.push(...extra.errors);
    report.warnings.push(...extra.warnings);
  }
  return { pack, report };
}

/** The pack, or a `ContentError` carrying the full report. */
export function buildContentPack(tables: Partial<ContentTables> = contentTables, options: BuildOptions = {}): ContentPack {
  const { pack, report } = parseContentPack(tables, options);
  if (report.errors.length > 0) throw new ContentError(report);
  return pack;
}

// ---- Typed lookups ---------------------------------------------------------------------------------------------------

/** The record type of a table: `Item` for 'items', `Quest` for 'quests' … */
export type TableRecord<K extends TableName> = NonNullable<ContentPack[K][keyof ContentPack[K]]>;

/** Own-property lookup (never reaches `Object.prototype`); undefined when the id is not in the table. */
export function lookup<K extends TableName>(pack: ContentPack, table: K, id: string): TableRecord<K> | undefined {
  const records = pack[table] as Record<string, TableRecord<K>>;
  return Object.hasOwn(records, id) ? records[id] : undefined;
}

/** Like `lookup`, but a missing id is a programmer error (the validator guarantees references resolve). */
export function need<K extends TableName>(pack: ContentPack, table: K, id: string): TableRecord<K> {
  const record = lookup(pack, table, id);
  if (record === undefined) throw new Error(`content: unknown ${table} id '${id}'`);
  return record;
}

export { TABLE_NAMES };
