// Cross-reference and semantic validation (PLAN §5.19, U19; the C1 contract freeze). `validateContent(pack, options)` takes
// the assembled `ContentPack` (every table already parsed by its zod schema) and returns `{ errors, warnings }`; each issue
// names its rule (`rule-07`), table, id, dotted path and a readable message. Every numbered rule of §5.19 is one named
// function below, listed in `RULES`.
//
// Two modes (the lead's strict-mode ruling):
//   strict: false (default; tests, the fixture pack, `buildContentPack`)  runs every referential and semantic rule and skips
//           the completeness-count rules ("the full game has 15 abilities per class, 8 endings, 6 companions …"), which
//           cannot hold for a small pack.
//   strict: true  (`tools/validate-content.ts`, the release gate)         runs everything. With `pending: true` a failed
//           completeness rule is a warning "pending — content not yet authored" instead of an error, which is how the CLI
//           treats the real pack while it has no locations.
//
// Content must not import the engine or the UI: the UI-side registries of rules 4 and 5 (art keys, ambient presets) are
// passed in through `options.registries` by the caller that can see them; without them those two rules have nothing to check.
// This file imports only the schema layer (never `./index`, which imports this file as its default validator).
import { ABILITY_ID_RE, TIER_LEVELS, abilityOwnerKind, isScriptedAbility, tierCostHalf } from '@schema/ability';
import { CODEX_BODY_MAX_WORDS, wordCount } from '@schema/codex';
import { TABLE_NAMES, type ContentIssue, type ContentPack, type ContentReport, type TableName } from '@schema/contentPack';
import { BOSS_PHASES, walkSteps } from '@schema/creature';
import { COMBAT_SCOPE_EFFECTS } from '@schema/effect';
import { ENGINE_GRANTED_ECHOES } from '@schema/echo';
import { CLOSER_IDS, TRUE_ENDING_IDS } from '@schema/ending';
import { EQUIPMENT_TYPES, ITEM_SOURCE_RE } from '@schema/item';
import type { Exit, Location } from '@schema/location';
import { REQUIRED_MODIFIERS } from '@schema/modifier';
import { ClassId, CompanionId } from '@schema/primitives';
import { SPECIAL_INFO, specialsFor, type SpecialScope } from '@schema/specials';
import { CANONICAL_STATUSES } from '@schema/status';

// ---- Public API ------------------------------------------------------------------------------------------------------

/** Registries owned by the UI/audio layers (PLAN §5.19 rules 4–5); content cannot import them, so a caller passes them in. */
export interface ValidateRegistries {
  /** `src/ui/art/registry.ts` ART_REGISTRY.silhouettes. */
  silhouettes?: readonly string[];
  /** ART_REGISTRY.focal. */
  focal?: readonly string[];
  /** ART_REGISTRY.sigilBases. */
  sigilBases?: readonly string[];
  /** ART_REGISTRY.icons (item icons). */
  icons?: readonly string[];
  /** `src/audio/ambient/registry.ts` preset ids. */
  ambient?: readonly string[];
}

export interface ValidateOptions {
  /** Also run the completeness-count rules (release gate). Default false. */
  strict?: boolean;
  /** With `strict`: completeness failures are warnings ("pending — content not yet authored"), not errors. */
  pending?: boolean;
  /** Rules 4 and 5 (warnings); each registry is checked only when given. */
  registries?: ValidateRegistries;
  /**
   * Tables still being authored (D-090; the real pack passes `INCOMPLETE_TABLES` from src/content/progress.ts): a reference
   * into one of them that does not resolve is a pending warning ("content not yet authored"), not an error.
   */
  incompleteTables?: readonly TableName[];
}

export interface RuleInfo {
  /** `rule-NN`, as it appears in `ContentIssue.rule`. */
  rule: string;
  title: string;
  /** True when part of the rule is a completeness count (runs only with `strict`). */
  counts: boolean;
}

/** Expected game-wide counts (PLAN §5.19 rule 21; D-015, D-045, D-069.1 and the registry), checked in strict mode. */
export const EXPECTED_COUNTS = {
  regions: 12,
  locations: 73,
  /** D-045, legacy six included; class mini-quests and stretch quests are counted apart. */
  quests: 44,
  classQuests: 5,
  codexMin: 85,
  /** STORY §12: 103 after D-069.1 (PLAN's 101 predates it). */
  echoes: 103,
  /** Non-anomaly creatures; the 16 anomaly variants are counted apart. */
  creatures: 57,
  anomalies: 16,
  itemsMin: 120,
  achievements: 40,
  classAbilities: 75,
  companionAbilities: 24,
  itemAbilities: 1,
  endings: 8,
  factions: 3,
  attunements: 15,
  companions: 6,
  classes: 5,
  abilitiesPerClass: 15,
  statuses: 19,
} as const;

/** DESIGN §10.7: the fifteen Attunements. */
export const ATTUNEMENT_IDS = [
  'att_steady_hand',
  'att_deep_well',
  'att_full_purse',
  'att_old_road',
  'att_foresight',
  'att_quick_study',
  'att_keen_eye',
  'att_light_step',
  'att_steady_hours',
  'att_borins_favor',
  'att_kaelens_ledger',
  'att_remembered_steps',
  'att_echo_sense',
  'att_companions_trust',
  'att_second_wind',
] as const;

/** Appendix A (D-001, D-044): legacy ids with their legacy names, exactly. */
export const LEGACY_LOCATIONS: Readonly<Record<string, { name: string; region: string }>> = {
  loc_whispering_ruins: { name: 'Whispering Ruins', region: 'region_silverwood_ruins' },
  loc_crumbling_archway: { name: 'Crumbling Archway', region: 'region_silverwood_ruins' },
  loc_darkened_corridor: { name: 'Darkened Corridor', region: 'region_silverwood_ruins' },
  loc_shattered_library: { name: 'Shattered Library', region: 'region_silverwood_ruins' },
  loc_silverwood_plaza: { name: 'Silverwood Plaza', region: 'region_silverwood_ruins' },
  loc_sunken_archives: { name: 'Sunken Archives', region: 'region_silverwood_ruins' },
  loc_heartstone_depths: { name: 'Heartstone Depths', region: 'region_silverwood_ruins' },
  loc_mistwood_path: { name: 'Mistwood Path', region: 'region_mistwood_ironclad_reach' },
  loc_wayfarers_respite: { name: "The Wayfarer's Respite", region: 'region_mistwood_ironclad_reach' },
  loc_ironclad_camp: { name: 'Ironclad Camp', region: 'region_mistwood_ironclad_reach' },
  loc_barren_peaks: { name: 'Barren Peaks', region: 'region_mistwood_ironclad_reach' },
  loc_blighted_outpost: { name: 'Blighted Outpost', region: 'region_mistwood_ironclad_reach' },
  loc_emberforge: { name: 'The Emberforge', region: 'region_mistwood_ironclad_reach' },
  loc_chasm_of_whispers: { name: 'Chasm of Whispers', region: 'region_voidscar' },
  loc_voidscar_hollow: { name: 'Voidscar Hollow', region: 'region_voidscar' },
  loc_shimmering_pass: { name: 'Shimmering Pass', region: 'region_aether_kissed_highlands' },
  loc_aetherium_spires: { name: 'Aetherium Spires', region: 'region_aether_kissed_highlands' },
  loc_sky_whisper_plateau: { name: 'Sky-Whisper Plateau', region: 'region_aether_kissed_highlands' },
  loc_veridian_glowlands: { name: 'Veridian Glowlands', region: 'region_glowlands_nexus' },
  loc_chronos_nexus: { name: 'The Chronos Nexus', region: 'region_glowlands_nexus' },
  loc_temporal_breach_apex: { name: 'The Temporal Breach Apex', region: 'region_glowlands_nexus' },
};

/** The legacy Tyrant became two records (D-051); only the Loop 1 form must carry the legacy name. */
export const LEGACY_CREATURES: Readonly<Record<string, string>> = {
  cr_corrupted_shade: 'Corrupted Shade',
  cr_wildling_brute: 'Wildling Brute',
  cr_arcane_wisp: 'Arcane Wisp',
  cr_drowned_archivist: 'Drowned Archivist',
  cr_void_touched_stalker: 'Void-Touched Stalker',
  cr_stone_hide_golem: 'Stone-Hide Golem',
  cr_shimmering_phantom: 'Shimmering Phantom',
  cr_aetherial_weaver: 'Aetherial Weaver',
  cr_sky_whisper_sentinel: 'Sky-Whisper Sentinel',
  cr_glowfen_mireling: 'Glowfen Mireling',
  cr_temporal_aberration: 'Temporal Aberration',
  cr_chronos_tyrant_contained: 'The Chronos Tyrant',
};
/** Appendix A.3: the Loop 2+ form exists, and may repeat the legacy name. */
export const LEGACY_UNVEILED_TYRANT = { id: 'cr_chronos_tyrant_unveiled', name: 'The Chronos Tyrant' } as const;

export const LEGACY_ITEMS: Readonly<Record<string, string>> = {
  item_rusty_dagger: 'Rusty Dagger',
  item_amulet_of_echoes: 'Amulet of Echoes',
  item_ley_touched_tonic: 'Ley-Touched Tonic',
  item_ironclad_mail: 'Ironclad Mail',
  item_echo_crystal: 'Echo Crystal',
  item_dark_spellbook: 'Dark Spellbook',
  item_mana_bloom: 'Mana Bloom',
  item_scholars_lost_scroll: "Scholar's Lost Scroll",
  item_void_shard: 'Void Shard',
  item_shadow_kissed_dagger: 'Shadow-Kissed Dagger',
  item_ironclad_plate_armor: 'Ironclad Plate Armor',
  item_stabilized_heartstone: 'Stabilized Heartstone',
  item_heartstone_core: 'Heartstone Core',
  item_chronal_dust: 'Chronal Dust',
  item_glow_moss: 'Glow Moss',
  item_aetherium_shard: 'Aetherium Shard',
  item_sky_whisper_talisman: 'Sky-Whisper Talisman',
  item_chronos_lens: 'Chronos Lens',
  item_travelers_sword: "Traveler's Sword",
  item_primitive_bow: 'Primitive Bow',
  item_elven_bow: 'Elven Bow',
  item_apprentice_staff: 'Apprentice Staff',
  item_necromancer_staff: 'Necromancer Staff',
  item_warriors_sword: "Warrior's Sword",
  item_wildling_hide_armor: 'Wildling Hide Armor',
  item_glyphbound_lantern: 'Glyphbound Lantern',
};

export const LEGACY_NPCS: Readonly<Record<string, string>> = {
  npc_ilyra: 'Ilyra',
  npc_brak: 'Brak',
  npc_nyx: 'Nyx',
  npc_kaelen_stonehand: 'Kaelen Stonehand',
  npc_borin_stonefist: 'Borin Stonefist',
};

/** `name` is the quest's (preserved) name; `legacyId` is the Python id (`q_` + legacyId = the new id). */
export const LEGACY_QUESTS: Readonly<Record<string, { name: string; legacyId: string }>> = {
  q_echo_crystal: { name: 'Echoes in the Library', legacyId: 'echo_crystal' },
  q_lost_scroll: { name: "The Scholar's Lost Scroll", legacyId: 'lost_scroll' },
  q_clear_path: { name: 'Clear the Barren Peaks', legacyId: 'clear_path' },
  q_blighted_outpost: { name: 'The Blighted Outpost', legacyId: 'blighted_outpost' },
  q_void_shards: { name: 'Whispers of the Void', legacyId: 'void_shards' },
  q_echoing_heartbeat: { name: 'The Echoing Heartbeat', legacyId: 'echoing_heartbeat' },
};

export const LEGACY_CLASSES: readonly string[] = ['ranger', 'wizard', 'elf'];

// ---- Plumbing ----------------------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
type Path = readonly (string | number)[];
type Tri = 'T' | 'F' | 'U';

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const hasOwn = (record: object, key: unknown): boolean => typeof key === 'string' && Object.hasOwn(record, key);
const quote = (s: unknown): string => `'${String(s)}'`;
/** Key-order-insensitive JSON, so two authored gates compare by value. */
function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  if (isObj(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canon(value[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
const same = (a: unknown, b: unknown): boolean => canon(a) === canon(b);

const PENDING = 'pending — content not yet authored: ';
/** A reference into a table still being authored (D-090). Starts with the same mark as PENDING, so tools group both. */
const PENDING_REF = 'pending — content not yet authored (reference): ';

class Validation {
  readonly errors: ContentIssue[] = [];
  readonly warnings: ContentIssue[] = [];
  readonly strict: boolean;
  readonly pending: boolean;
  private scanned: Scan | null = null;

  constructor(
    readonly pack: ContentPack,
    readonly options: ValidateOptions,
  ) {
    this.strict = options.strict === true;
    this.pending = options.pending === true;
  }

  error(rule: string, table: string, id: string, path: string, message: string): void {
    this.errors.push({ table, id, path, message, rule });
  }

  warn(rule: string, table: string, id: string, path: string, message: string): void {
    this.warnings.push({ table, id, path, message, rule });
  }

  /** A completeness-count failure: skipped unless strict; pending (a warning) while the pack has no content yet. */
  count(rule: string, table: string, id: string, path: string, message: string): void {
    if (!this.strict) return;
    if (this.pending) this.warn(rule, table, id, path, PENDING + message);
    else this.error(rule, table, id, path, message);
  }

  has(table: TableName, id: unknown): boolean {
    return hasOwn(this.pack[table], id);
  }

  /** An id reference that must resolve in `to`: reports `<what> '<target>' not found in <to>`. */
  need(rule: string, table: string, id: string, path: string, to: TableName, target: unknown, what: string): boolean {
    if (typeof target !== 'string') return true;
    if (hasOwn(this.pack[to], target)) return true;
    const message = `${what} ${quote(target)} not found in ${to}`;
    if (this.options.incompleteTables?.includes(to)) this.warn(rule, table, id, path, `${PENDING_REF}${message}`);
    else this.error(rule, table, id, path, message);
    return false;
  }

  /** Everything the one tree walk over the pack collects (flags, Echoes, unlocks …); also emits rules 2 and 11 findings. */
  get scan(): Scan {
    this.scanned ??= runScan(this);
    return this.scanned;
  }
}

interface Scan {
  flagsSet: Set<string>;
  flagsRead: Map<string, { table: string; id: string; path: string }>;
  echoGrants: Set<string>;
  echoUsed: Set<string>;
  codexUnlocked: Set<string>;
  /** Targets of `{ ending }` effects. */
  endingTargets: Set<string>;
  /** Closers named by `{ endLoop }` effects. */
  closersUsed: Set<string>;
  /** `<quest>/<stage>` named by `{ questAdvance }` effects. */
  advanceTargets: Set<string>;
  /** `<from>><to>` named by `{ unlockExit }` effects. */
  unlockedExits: Set<string>;
}

/** Engine-written flags (C-58): never set by content. */
const ENGINE_FLAG = /^flag_(?:choice|scene_done)_/;

// ---- The tree walk: rules 2 and 11 (combat scope), and the facts rules 9, 15, 16, 17 read -------------------------------

/** Property names whose value is a Condition (or, for `opensWith`, a list of them). */
const CONDITION_FIELDS = new Set([
  'when', 'failWhen', 'startWhen', 'availableWhen', 'advanceWhen', 'unlockWhen', 'skipWhen', 'optionalWhen', 'disabledWhen',
  'refusesWhen', 'gate', 'requires', 'opensWith', 'if', 'apexGate',
]);
/** Property names whose value is an Effect list. */
const EFFECT_FIELDS = new Set(['effects', 'onEnter', 'onExit', 'onFail', 'onVictory', 'onDefeat', 'onFleeEffects', 'onUse', 'onGrant', 'onEnd', 'outOfCombat']);
/** Free-form payloads that are never walked. */
const OPAQUE_FIELDS = new Set(['patch', 'params']);

function whereOf(path: Path): { table: string; id: string; path: string } {
  const [table = '?', ...rest] = path.map(String);
  if (table === 'config') return { table, id: '-', path: rest.join('.') };
  const [id = '-', ...tail] = rest;
  return { table, id, path: tail.join('.') };
}

/** Combat-scope effect atoms are legal only in `moves[].effects` and `phases[].onEnter` (D-069.9). */
function inCombatData(path: Path): boolean {
  if (path[0] !== 'creatures') return false;
  return (path[2] === 'moves' && path[4] === 'effects') || (path[2] === 'phases' && path[4] === 'onEnter');
}

function runScan(v: Validation): Scan {
  const { pack } = v;
  const scan: Scan = {
    flagsSet: new Set(),
    flagsRead: new Map(),
    echoGrants: new Set(),
    echoUsed: new Set(),
    codexUnlocked: new Set(),
    endingTargets: new Set(),
    closersUsed: new Set(),
    advanceTargets: new Set(),
    unlockedExits: new Set(),
  };
  const encounterIds = new Set<string>(Object.keys(pack.encounters));
  for (const loc of Object.values(pack.locations)) for (const e of loc.encounters) encounterIds.add(e.id);

  const ref = (path: Path, to: TableName, target: unknown, what: string): boolean => {
    const w = whereOf(path);
    return v.need('rule-02', w.table, w.id, w.path, to, target, what);
  };

  const visitCondition = (c: unknown, path: Path): void => {
    if (!isObj(c)) return;
    const keys = Object.keys(c);
    if (keys.length !== 1) return;
    const key = keys[0] as string;
    const value = c[key];
    const at = [...path, key];
    switch (key) {
      case 'all':
      case 'any':
        asArray(value).forEach((child, i) => visitCondition(child, [...at, i]));
        break;
      case 'not':
        visitCondition(value, at);
        break;
      case 'flag':
        if (typeof value === 'string' && !scan.flagsRead.has(value)) scan.flagsRead.set(value, whereOf(at));
        break;
      case 'echo':
        if (typeof value === 'string') scan.echoUsed.add(value);
        ref(at, 'echoes', value, 'condition echo');
        break;
      case 'quest':
        if (isObj(value)) {
          if (ref([...at, 'id'], 'quests', value.id, 'condition quest') && typeof value.stage === 'string') {
            const quest = pack.quests[value.id as string];
            if (quest && !quest.stages.some((s) => s.id === value.stage)) {
              const w = whereOf([...at, 'stage']);
              v.error('rule-02', w.table, w.id, w.path, `condition quest ${quote(value.id)} has no stage ${quote(value.stage)}`);
            }
          }
        }
        break;
      case 'item':
        if (isObj(value)) ref([...at, 'id'], 'items', value.id, 'condition item');
        break;
      case 'class':
        ref(at, 'classes', value, 'condition class');
        break;
      case 'companion':
        if (isObj(value)) ref([...at, 'id'], 'companions', value.id, 'condition companion');
        break;
      case 'loyalty':
        if (isObj(value)) ref([...at, 'companion'], 'companions', value.companion, 'condition loyalty companion');
        break;
      case 'rep':
        if (isObj(value)) ref([...at, 'faction'], 'factions', value.faction, 'condition rep faction');
        break;
      case 'location':
        ref(at, 'locations', value, 'condition location');
        break;
      case 'killed':
        if (isObj(value)) ref([...at, 'id'], 'creatures', value.id, 'condition killed');
        break;
      case 'modifier':
        ref(at, 'modifiers', value, 'condition modifier');
        break;
      // CombatWhen atoms that carry ids (DESIGN §4.2)
      case 'allyPresent':
        if (typeof value === 'string') ref(at, 'creatures', value, 'condition allyPresent');
        break;
      case 'targetHas':
      case 'selfHas':
        ref(at, 'statuses', value, `condition ${key}`);
        break;
      default:
        break;
    }
  };

  const visitEffect = (e: unknown, path: Path): void => {
    if (!isObj(e)) return;
    const keys = Object.keys(e);
    if (keys.length !== 1) return;
    const key = keys[0] as string;
    const value = e[key];
    const at = [...path, key];
    switch (key) {
      case 'setFlag':
        if (typeof value === 'string') scan.flagsSet.add(value);
        break;
      case 'grantEcho':
        if (typeof value === 'string') scan.echoGrants.add(value);
        ref(at, 'echoes', value, 'effect grantEcho');
        break;
      case 'questStart':
      case 'questFail':
        ref(at, 'quests', value, `effect ${key}`);
        break;
      case 'questAdvance':
        if (isObj(value)) {
          if (ref([...at, 'quest'], 'quests', value.quest, 'effect questAdvance') && typeof value.stage === 'string') {
            scan.advanceTargets.add(`${String(value.quest)}/${value.stage}`);
            const quest = pack.quests[value.quest as string];
            if (quest && !quest.stages.some((s) => s.id === value.stage)) {
              const w = whereOf([...at, 'stage']);
              v.error('rule-02', w.table, w.id, w.path, `effect questAdvance: ${quote(value.quest)} has no stage ${quote(value.stage)}`);
            }
          }
        }
        break;
      case 'giveItem':
      case 'takeItem':
        if (isObj(value)) ref([...at, 'item'], 'items', value.item, `effect ${key}`);
        break;
      case 'rep':
        if (isObj(value)) ref([...at, 'faction'], 'factions', value.faction, 'effect rep faction');
        break;
      case 'loyalty':
        if (isObj(value)) ref([...at, 'companion'], 'companions', value.companion, 'effect loyalty companion');
        break;
      case 'spawn':
        if (isObj(value)) {
          ref([...at, 'creature'], 'creatures', value.creature, 'effect spawn');
          if (value.location !== undefined) ref([...at, 'location'], 'locations', value.location, 'effect spawn location');
        }
        break;
      case 'teleport':
        ref(at, 'locations', value, 'effect teleport');
        break;
      case 'unlockExit':
        if (isObj(value)) {
          const okFrom = ref([...at, 'from'], 'locations', value.from, 'effect unlockExit from');
          const okTo = ref([...at, 'to'], 'locations', value.to, 'effect unlockExit to');
          if (okFrom && okTo) {
            scan.unlockedExits.add(`${String(value.from)}>${String(value.to)}`);
            const from = pack.locations[value.from as string];
            if (from && !from.exits.some((x) => x.to === value.to)) {
              const w = whereOf(at);
              v.error('rule-02', w.table, w.id, w.path, `effect unlockExit: ${String(value.from)} has no exit to ${String(value.to)} to unlock`);
            }
          }
        }
        break;
      case 'scatter':
        if (isObj(value)) ref([...at, 'location'], 'locations', value.location, 'effect scatter');
        break;
      case 'recruit':
      case 'dismiss':
        ref(at, 'companions', value, `effect ${key}`);
        break;
      case 'startCombat':
        if (typeof value === 'string' && !encounterIds.has(value)) {
          const w = whereOf(at);
          v.error('rule-02', w.table, w.id, w.path, `effect startCombat encounter ${quote(value)} not found (location encounters or the encounters table)`);
        }
        break;
      case 'startDialogue':
        ref(at, 'dialogues', value, 'effect startDialogue');
        break;
      case 'ending':
        if (typeof value === 'string') scan.endingTargets.add(value);
        ref(at, 'endings', value, 'effect ending');
        break;
      case 'endLoop':
        if (isObj(value) && typeof value.closer === 'string') scan.closersUsed.add(value.closer);
        break;
      case 'unlockRecipe':
        ref(at, 'recipes', value, 'effect unlockRecipe');
        break;
      case 'unlockCodex':
        if (typeof value === 'string') scan.codexUnlocked.add(value);
        ref(at, 'codex', value, 'effect unlockCodex');
        break;
      default:
        break;
    }
    if ((COMBAT_SCOPE_EFFECTS as readonly string[]).includes(key)) {
      const w = whereOf(at);
      if (!inCombatData(at)) {
        v.error('rule-11', w.table, w.id, w.path, `combat-scope effect '${key}' is legal only in a creature move's effects or a phase's onEnter (D-069.9)`);
      } else if (key === 'surviveRounds') {
        const creature = pack.creatures[String(at[1])];
        if (!(at[2] === 'phases' && at[3] === 0 && creature?.role === 'boss')) {
          v.error('rule-11', w.table, w.id, w.path, "'surviveRounds' is legal only in a boss's first phase");
        } else if (!isObj(value) || typeof value.rounds !== 'number' || value.rounds < 1) {
          v.error('rule-11', w.table, w.id, w.path, "'surviveRounds' needs rounds >= 1");
        }
      }
    }
  };

  const visit = (node: unknown, path: Path): void => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => visit(child, [...path, i]));
      return;
    }
    if (!isObj(node)) return;
    for (const [key, value] of Object.entries(node)) {
      const at = [...path, key];
      if (OPAQUE_FIELDS.has(key)) continue;
      const endingRequirements = key === 'requirements' && path[0] === 'endings' && path.length === 2;
      if (CONDITION_FIELDS.has(key) || endingRequirements) {
        if (Array.isArray(value)) value.forEach((c, i) => visitCondition(c, [...at, i]));
        else visitCondition(value, at);
        // a condition list or tree has no nested records, so there is nothing else to walk
      } else if (EFFECT_FIELDS.has(key) && !(key === 'effects' && path[0] === 'attunements') && Array.isArray(value)) {
        value.forEach((e, i) => visitEffect(e, [...at, i]));
      } else {
        visit(value, at);
      }
    }
  };

  for (const table of TABLE_NAMES) {
    for (const [id, record] of Object.entries(pack[table])) visit(record, [table, id]);
  }
  // The tunables name content (start items, the Apex Echo) that only a pack with a world has to contain.
  if (Object.keys(pack.locations).length > 0) visit(pack.config, ['config']);
  return scan;
}

// ---- Three-valued condition evaluation (rules 8 and 9) -----------------------------------------------------------------

const and = (parts: Tri[]): Tri => (parts.includes('F') ? 'F' : parts.every((p) => p === 'T') ? 'T' : 'U');
const or = (parts: Tri[]): Tri => (parts.includes('T') ? 'T' : parts.every((p) => p === 'F') ? 'F' : 'U');
const inRange = (range: unknown, n: number): Tri => {
  if (!isObj(range)) return 'U';
  const { min, max } = range;
  return (typeof min === 'number' && n < min) || (typeof max === 'number' && n > max) ? 'F' : 'T';
};

/** Evaluates a Condition where `atom` decides the leaves ('U' = unknown). Combinators are exact. */
function evalCondition(c: unknown, atom: (key: string, value: unknown) => Tri): Tri {
  if (!isObj(c)) return 'U';
  const keys = Object.keys(c);
  const key = keys[0];
  if (keys.length !== 1 || key === undefined) return 'U';
  const value = c[key];
  if (key === 'all') return and(asArray(value).map((x) => evalCondition(x, atom)));
  if (key === 'any') return or(asArray(value).map((x) => evalCondition(x, atom)));
  if (key === 'not') {
    const inner = evalCondition(value, atom);
    return inner === 'T' ? 'F' : inner === 'F' ? 'T' : 'U';
  }
  return atom(key, value);
}

const UNKNOWN_LEAVES = (): Tri => 'U';

/**
 * The synthetic Loop 1 state of PLAN §5.19 rule 8: loop = 1, no Echoes, no challenge modifiers, outside the Before and outside
 * Communion. Everything the player can still earn in play (flags, quests, items, kills, level …) stays unknown, so an exit
 * is blocked only when no Loop 1 can satisfy it.
 */
function loopOneLeaf(key: string, value: unknown): Tri {
  switch (key) {
    case 'echo':
    case 'beforeDay':
    case 'beforeResets':
    case 'resolve':
    case 'modifier':
      return 'F';
    case 'loop':
      return inRange(value, 1);
    default:
      return 'U';
  }
}

// ---- Location graph ----------------------------------------------------------------------------------------------------

type Mode = 'any' | 'loop1';

/** True when `exit` can be taken from `from` (hidden exits need a `when` or an `unlockExit` effect to ever appear). */
function passable(v: Validation, from: Location, exit: Exit, mode: Mode): boolean {
  if (!v.has('locations', exit.to)) return false;
  if (exit.hidden && exit.when === undefined && !v.scan.unlockedExits.has(`${from.id}>${exit.to}`)) return false;
  if (mode === 'loop1') {
    if (exit.when !== undefined && evalCondition(exit.when, loopOneLeaf) === 'F') return false;
    if (exit.kind === 'road' && exit.gate !== undefined && evalCondition(exit.gate, loopOneLeaf) === 'F') return false;
  }
  return true;
}

function reach(v: Validation, start: string, mode: Mode): Set<string> {
  const seen = new Set<string>();
  if (!v.has('locations', start)) return seen;
  const queue = [start];
  seen.add(start);
  for (let i = 0; i < queue.length; i++) {
    const loc = v.pack.locations[queue[i] as string];
    if (!loc) continue;
    for (const exit of loc.exits) {
      if (!seen.has(exit.to) && passable(v, loc, exit, mode)) {
        seen.add(exit.to);
        queue.push(exit.to);
      }
    }
  }
  return seen;
}

/** The effective level band of a location (its own override, else its region's). */
function bandOf(v: Validation, loc: Location): { min: number; max: number } | undefined {
  return loc.levelBand ?? v.pack.regions[loc.regionId]?.levelBand;
}

// ---- Rule 1: every id reference resolves -------------------------------------------------------------------------------

function rule01(v: Validation): void {
  const { pack } = v;
  const R = 'rule-01';
  const need = (table: string, id: string, path: string, to: TableName, target: unknown, what: string): boolean =>
    v.need(R, table, id, path, to, target, what);

  for (const region of Object.values(pack.regions)) {
    region.wanderingPool.forEach((w, i) => need('regions', region.id, `wanderingPool.${i}.creatureId`, 'creatures', w.creatureId, 'wandering creature'));
    if (region.codexId !== undefined) need('regions', region.id, 'codexId', 'codex', region.codexId, 'codexId');
    if (region.factionId !== undefined) need('regions', region.id, 'factionId', 'factions', region.factionId, 'factionId');
  }

  for (const loc of Object.values(pack.locations)) {
    const t = 'locations';
    need(t, loc.id, 'regionId', 'regions', loc.regionId, 'regionId');
    loc.npcs.forEach((n, i) => need(t, loc.id, `npcs.${i}`, 'npcs', n, 'npc'));
    if (loc.merchantId !== undefined) {
      need(t, loc.id, 'merchantId', 'npcs', loc.merchantId, 'merchantId');
      need(t, loc.id, 'merchantId', 'merchants', loc.merchantId, 'merchantId');
    }
    loc.items.forEach((it, i) => need(t, loc.id, `items.${i}.itemId`, 'items', it.itemId, 'item'));
    if (loc.gather) need(t, loc.id, 'gather.itemId', 'items', loc.gather.itemId, 'gather item');
    loc.encounters.forEach((enc, i) =>
      enc.groups.forEach((g, j) => need(t, loc.id, `encounters.${i}.groups.${j}.creatureId`, 'creatures', g.creatureId, `encounter ${enc.id} creature`)),
    );
    loc.exits.forEach((exit, i) => need(t, loc.id, `exits.${i}.to`, 'locations', exit.to, `exit ${quote(exit.dir)} →`));
  }

  for (const enc of Object.values(pack.encounters)) {
    enc.groups.forEach((g, j) => need('encounters', enc.id, `groups.${j}.creatureId`, 'creatures', g.creatureId, 'creature'));
  }

  for (const c of Object.values(pack.creatures)) {
    const t = 'creatures';
    c.loot.forEach((l, i) => need(t, c.id, `loot.${i}.itemId`, 'items', l.itemId, 'loot item'));
    c.statusImmunities.forEach((s, i) => need(t, c.id, `statusImmunities.${i}`, 'statuses', s, 'status immunity'));
    if (c.bestiary.codexId !== undefined) need(t, c.id, 'bestiary.codexId', 'codex', c.bestiary.codexId, 'bestiary codexId');
    const moves = new Set(Object.keys(c.moves));
    for (const [moveId, move] of Object.entries(c.moves)) {
      move.statuses.forEach((s, i) => need(t, c.id, `moves.${moveId}.statuses.${i}.status`, 'statuses', s.status, `move ${moveId} status`));
      if (move.summon) need(t, c.id, `moves.${moveId}.summon.creatureId`, 'creatures', move.summon.creatureId, `move ${moveId} summon`);
      if (move.windUp && !moves.has(move.windUp.then)) v.error(R, t, c.id, `moves.${moveId}.windUp.then`, `windUp.then move ${quote(move.windUp.then)} not found in moves`);
    }
    const checkPattern = (steps: Parameters<typeof walkSteps>[0], path: string): void =>
      walkSteps(steps, [], (step, p) => {
        if ('move' in step && !moves.has(step.move)) {
          v.error(R, t, c.id, `${path}.${p.join('.')}.move`, `pattern step move ${quote(step.move)} not found in moves`);
        }
      });
    checkPattern(c.pattern, 'pattern');
    c.phases.forEach((ph, i) => {
      checkPattern(ph.pattern, `phases.${i}.pattern`);
      ph.adds.forEach((a, j) => need(t, c.id, `phases.${i}.adds.${j}.creatureId`, 'creatures', a.creatureId, `phase ${ph.id} add`));
    });
    if (c.communion) {
      if (!moves.has(c.communion.pressMove)) v.error(R, t, c.id, 'communion.pressMove', `pressMove ${quote(c.communion.pressMove)} not found in moves`);
      c.communion.offers.forEach((o, i) => need(t, c.id, `communion.offers.${i}.itemId`, 'items', o.itemId, 'communion offer'));
      const phases = new Set(c.phases.map((p) => p.id));
      c.communion.movements.forEach((m, i) => {
        if (!phases.has(m.id)) v.error(R, t, c.id, `communion.movements.${i}.id`, `Movement ${quote(m.id)} has no matching phase`);
      });
    }
  }

  for (const item of Object.values(pack.items)) {
    const t = 'items';
    item.requirements?.classIds?.forEach((cls, i) => need(t, item.id, `requirements.classIds.${i}`, 'classes', cls, 'required class'));
    if (item.codexId !== undefined) need(t, item.id, 'codexId', 'codex', item.codexId, 'codexId');
    item.fixedAffixes.forEach((a, i) => need(t, item.id, `fixedAffixes.${i}`, 'affixes', a, 'fixed affix'));
    item.passives.forEach((p, i) => passiveRefs(v, t, item.id, `passives.${i}`, p));
    item.sources.forEach((s, i) => {
      if (!ITEM_SOURCE_RE.test(s)) return;
      const [kind, target = ''] = s.split(':');
      const to: TableName = kind === 'drop' ? 'creatures' : kind === 'merchant' ? 'merchants' : kind === 'craft' ? 'recipes' : kind === 'quest' ? 'quests' : 'locations';
      need(t, item.id, `sources.${i}`, to, target, `source ${quote(s)} →`);
    });
  }

  for (const affix of Object.values(pack.affixes)) {
    for (const slot of ['weapon', 'armor', 'trinket'] as const) {
      affix[slot]?.passives.forEach((p, i) => passiveRefs(v, 'affixes', affix.id, `${slot}.passives.${i}`, p));
    }
  }

  for (const r of Object.values(pack.recipes)) {
    const t = 'recipes';
    r.inputs.forEach((x, i) => need(t, r.id, `inputs.${i}.itemId`, 'items', x.itemId, 'input'));
    r.anyOf.forEach((group, i) => group.forEach((x, j) => need(t, r.id, `anyOf.${i}.${j}.itemId`, 'items', x.itemId, 'alternative input')));
    need(t, r.id, 'output.itemId', 'items', r.output.itemId, 'output');
    if (r.requiresItemRead !== undefined) need(t, r.id, 'requiresItemRead', 'items', r.requiresItemRead, 'requiresItemRead');
    r.repTierWhileActive?.quests.forEach((q, i) => need(t, r.id, `repTierWhileActive.quests.${i}`, 'quests', q, 'quest'));
  }

  for (const a of Object.values(pack.abilities)) {
    const t = 'abilities';
    const kind = abilityOwnerKind(a.id);
    if (kind === 'class') {
      if (need(t, a.id, 'ownerId', 'classes', a.ownerId, 'owner class') && a.branch !== undefined) {
        const cls = pack.classes[a.ownerId];
        if (cls && !cls.branches.some((b) => b.id === a.branch)) {
          v.error(R, t, a.id, 'branch', `branch ${quote(a.branch)} is not a branch of ${a.ownerId} (${cls.branches.map((b) => b.id).join(', ')})`);
        }
      }
    } else if (kind === 'companion') need(t, a.id, 'ownerId', 'companions', a.ownerId, 'owner companion');
    else if (kind === 'item') need(t, a.id, 'ownerId', 'items', a.ownerId, 'granting item');
    a.statuses.forEach((s, i) => need(t, a.id, `statuses.${i}.status`, 'statuses', s.status, 'status'));
  }

  for (const cls of Object.values(pack.classes)) {
    const t = 'classes';
    cls.starterItems.forEach((s, i) => need(t, cls.id, `starterItems.${i}.itemId`, 'items', s.itemId, 'starter item'));
    cls.startingAbilities.forEach((a, i) => {
      if (need(t, cls.id, `startingAbilities.${i}`, 'abilities', a, 'starting ability') && pack.abilities[a]?.ownerId !== cls.id) {
        v.error(R, t, cls.id, `startingAbilities.${i}`, `starting ability ${quote(a)} belongs to ${String(pack.abilities[a]?.ownerId)}, not ${cls.id}`);
      }
    });
    if (cls.uniqueQuestId !== undefined) need(t, cls.id, 'uniqueQuestId', 'quests', cls.uniqueQuestId, 'uniqueQuestId');
  }

  for (const q of Object.values(pack.quests)) {
    const t = 'quests';
    if (q.giverNpcId !== undefined) need(t, q.id, 'giverNpcId', 'npcs', q.giverNpcId, 'giverNpcId');
    if (q.companionId !== undefined) need(t, q.id, 'companionId', 'companions', q.companionId, 'companionId');
    if (q.factionId !== undefined) need(t, q.id, 'factionId', 'factions', q.factionId, 'factionId');
    if (q.classId !== undefined) need(t, q.id, 'classId', 'classes', q.classId, 'classId');
    const stages = new Set(q.stages.map((s) => s.id));
    const stage = (path: string, id: unknown, what: string): void => {
      if (typeof id === 'string' && !stages.has(id)) v.error(R, t, q.id, path, `${what} ${quote(id)} is not a stage of ${q.id}`);
    };
    stage('firstStage', q.firstStage, 'firstStage');
    q.stages.forEach((s, i) => {
      if (typeof s.next === 'string') stage(`stages.${i}.next`, s.next, 'next');
      else s.next?.forEach((b, j) => stage(`stages.${i}.next.${j}.to`, b.to, 'branch target'));
      stage(`stages.${i}.onTimeoutTo`, s.onTimeoutTo, 'onTimeoutTo');
      s.objectives.forEach((o, j) => {
        if (o.hintLocationId !== undefined) need(t, q.id, `stages.${i}.objectives.${j}.hintLocationId`, 'locations', o.hintLocationId, 'hintLocationId');
      });
    });
    q.shortcuts.forEach((s, i) => {
      stage(`shortcuts.${i}.skipTo`, s.skipTo, 'skipTo');
      need(t, q.id, `shortcuts.${i}.echo`, 'echoes', s.echo, 'shortcut echo');
    });
    q.rewards.items.forEach((it, i) => need(t, q.id, `rewards.items.${i}.itemId`, 'items', it.itemId, 'reward item'));
    q.rewards.rep.forEach((r, i) => need(t, q.id, `rewards.rep.${i}.faction`, 'factions', r.faction, 'reward faction'));
    q.rewards.echoes.forEach((e, i) => need(t, q.id, `rewards.echoes.${i}`, 'echoes', e, 'reward echo'));
  }

  for (const scene of Object.values(pack.dialogues)) {
    const t = 'dialogues';
    if (scene.npcId !== undefined) need(t, scene.id, 'npcId', 'npcs', scene.npcId, 'npcId');
    const nodes = new Set(scene.nodes.map((n) => n.id));
    const target = (path: string, to: string): void => {
      if (to !== 'end' && !nodes.has(to)) v.error(R, t, scene.id, path, `${quote(to)} is not a node of ${scene.id} (or 'end')`);
    };
    if (typeof scene.entry === 'string') target('entry', scene.entry);
    else scene.entry.forEach((e, i) => target(`entry.${i}.node`, e.node));
    scene.nodes.forEach((node, i) => {
      if (node.next !== undefined) target(`nodes.${i}.next`, node.next);
      node.choices.forEach((ch, j) => {
        target(`nodes.${i}.choices.${j}.next`, ch.next);
        if (ch.echoHint !== undefined) need(t, scene.id, `nodes.${i}.choices.${j}.echoHint`, 'echoes', ch.echoHint, 'echoHint');
      });
    });
    scene.companionReactions.forEach((r, i) => need(t, scene.id, `companionReactions.${i}.companionId`, 'companions', r.companionId, 'reaction companion'));
  }

  for (const npc of Object.values(pack.npcs)) {
    const t = 'npcs';
    need(t, npc.id, 'homeLocationId', 'locations', npc.homeLocationId, 'homeLocationId');
    if (npc.merchantId !== undefined) need(t, npc.id, 'merchantId', 'merchants', npc.merchantId, 'merchantId');
    if (npc.companionId !== undefined && need(t, npc.id, 'companionId', 'companions', npc.companionId, 'companionId')) {
      if (pack.companions[npc.companionId]?.npcId !== npc.id) v.error(R, t, npc.id, 'companionId', `companion ${npc.companionId} does not point back at ${npc.id} (companion.npcId)`);
    }
    if (npc.factionId !== 'neutral') need(t, npc.id, 'factionId', 'factions', npc.factionId, 'factionId');
  }

  for (const c of Object.values(pack.companions)) {
    const t = 'companions';
    if (need(t, c.id, 'npcId', 'npcs', c.npcId, 'npcId') && pack.npcs[c.npcId]?.companionId !== c.id) {
      v.error(R, t, c.id, 'npcId', `${c.npcId} does not point back at companion ${c.id} (npc.companionId)`);
    }
    c.abilities.forEach((a, i) => {
      if (need(t, c.id, `abilities.${i}`, 'abilities', a, 'ability') && pack.abilities[a]?.ownerId !== c.id) {
        v.error('rule-18', t, c.id, `abilities.${i}`, `ability ${quote(a)} has ownerId ${String(pack.abilities[a]?.ownerId)}, expected ${c.id}`);
      }
    });
    if (need(t, c.id, 'signature.abilityId', 'abilities', c.signature.abilityId, 'signature ability') && pack.abilities[c.signature.abilityId]?.ownerId !== c.id) {
      v.error('rule-18', t, c.id, 'signature.abilityId', `signature ability ${quote(c.signature.abilityId)} has ownerId ${String(pack.abilities[c.signature.abilityId]?.ownerId)}, expected ${c.id}`);
    }
    c.arcQuestIds.forEach((q, i) => need(t, c.id, `arcQuestIds.${i}`, 'quests', q, 'arc quest'));
    c.campScenes.forEach((s, i) => need(t, c.id, `campScenes.${i}`, 'dialogues', s, 'camp scene'));
    c.statusImmunities.forEach((s, i) => need(t, c.id, `statusImmunities.${i}`, 'statuses', s, 'status immunity'));
    c.banter.forEach((b, i) => {
      if (b.locationId !== undefined) need(t, c.id, `banter.${i}.locationId`, 'locations', b.locationId, 'banter location');
      if (b.regionId !== undefined) need(t, c.id, `banter.${i}.regionId`, 'regions', b.regionId, 'banter region');
    });
  }

  for (const m of Object.values(pack.merchants)) {
    const t = 'merchants';
    need(t, m.id, 'npcId', 'npcs', m.npcId, 'npcId');
    m.stock.forEach((s, i) => need(t, m.id, `stock.${i}.itemId`, 'items', s.itemId, 'stock item'));
    m.rollStock?.pool.forEach((p, i) => need(t, m.id, `rollStock.pool.${i}`, 'items', p, 'rolled stock item'));
    if (m.repFaction !== undefined && m.repFaction !== 'best') need(t, m.id, 'repFaction', 'factions', m.repFaction, 'repFaction');
  }

  for (const e of Object.values(pack.endings)) {
    if (e.achievementId !== undefined) need('endings', e.id, 'achievementId', 'achievements', e.achievementId, 'achievementId');
  }
  for (const m of Object.values(pack.modifiers)) {
    if (m.achievementId !== undefined) need('modifiers', m.id, 'achievementId', 'achievements', m.achievementId, 'achievementId');
  }
  for (const c of Object.values(pack.codex)) c.related.forEach((r, i) => need('codex', c.id, `related.${i}`, 'codex', r, 'related entry'));
  for (const e of Object.values(pack.echoes)) {
    e.exclusiveWith.forEach((o, i) => need('echoes', e.id, `exclusiveWith.${i}`, 'echoes', o, 'exclusiveWith'));
    e.requiredForEndings.forEach((o, i) => need('echoes', e.id, `requiredForEndings.${i}`, 'endings', o, 'requiredForEndings'));
  }
  for (const a of Object.values(pack.attunements)) {
    a.effects.forEach((fx, i) => {
      if (fx.kind === 'start_item') need('attunements', a.id, `effects.${i}.itemId`, 'items', fx.itemId, 'start item');
      if (fx.kind === 'reveal_region') need('attunements', a.id, `effects.${i}.regionId`, 'regions', fx.regionId, 'revealed region');
    });
  }

  if (Object.keys(pack.locations).length > 0) {
    pack.config.startItems.forEach((s, i) => need('config', '-', `startItems.${i}.itemId`, 'items', s.itemId, 'start item'));
  }
}

function passiveRefs(v: Validation, table: string, id: string, path: string, passive: { kind: string } & Obj): void {
  const R = 'rule-01';
  if (passive.kind === 'statusOnHit' || passive.kind === 'statusImmunity') v.need(R, table, id, `${path}.status`, 'statuses', passive.status, `${passive.kind} status`);
  if (passive.kind === 'grantAbility') v.need(R, table, id, `${path}.abilityId`, 'abilities', passive.abilityId, 'granted ability');
}

// ---- Rule 2: ids inside Conditions and Effects (the tree walk) -------------------------------------------------------------

function rule02(v: Validation): void {
  const { scan } = v;
  // Flags are free (warning only): a flag that is read but that nothing sets, and that the engine does not write itself.
  for (const [flag, where] of scan.flagsRead) {
    if (!scan.flagsSet.has(flag) && !ENGINE_FLAG.test(flag)) {
      v.warn('rule-02', where.table, where.id, where.path, `flag ${quote(flag)} is tested but no setFlag effect anywhere sets it`);
    }
  }
}

// ---- Rule 3: specials --------------------------------------------------------------------------------------------------------

function rule03(v: Validation): void {
  const check = (table: string, id: string, path: string, special: string | undefined, scope: SpecialScope): void => {
    if (special === undefined) return;
    const info = (SPECIAL_INFO as Record<string, { scopes: readonly SpecialScope[] } | undefined>)[special];
    if (info === undefined) {
      // Status hooks (burn, shock …) live in the engine's statuses.ts; only the shared registry is checked here.
      if (scope !== 'status') v.error('rule-03', table, id, path, `special ${quote(special)} is not in SPECIALS (src/content/schema/specials.ts)`);
    } else if (!info.scopes.includes(scope)) {
      v.error('rule-03', table, id, path, `special ${quote(special)} is not usable on ${scope} (allowed: ${specialsFor(scope).join(', ')})`);
    }
  };
  for (const a of Object.values(v.pack.abilities)) check('abilities', a.id, 'special', a.special, 'ability');
  for (const s of Object.values(v.pack.statuses)) check('statuses', s.id, 'special', s.special, 'status');
  for (const c of Object.values(v.pack.creatures)) {
    for (const [moveId, move] of Object.entries(c.moves)) check('creatures', c.id, `moves.${moveId}.special`, move.special, 'move');
  }
}

// ---- Rules 4 and 5: art keys and ambient presets (warnings; registries supplied by the caller) -----------------------------

function rule04(v: Validation): void {
  const reg = v.options.registries;
  if (!reg) return;
  const check = (table: string, id: string, path: string, key: string | undefined, known: readonly string[] | undefined, what: string): void => {
    if (key !== undefined && known && !known.includes(key)) v.warn('rule-04', table, id, path, `${what} ${quote(key)} is not in the art registry (falls back to the default)`);
  };
  for (const loc of Object.values(v.pack.locations)) {
    loc.art.silhouettes.forEach((s, i) => check('locations', loc.id, `art.silhouettes.${i}`, s, reg.silhouettes, 'silhouette'));
    check('locations', loc.id, 'art.focal', loc.art.focal, reg.focal, 'focal piece');
  }
  for (const c of Object.values(v.pack.creatures)) check('creatures', c.id, 'sigil.base', c.sigil.base, reg.sigilBases, 'sigil base');
  for (const i of Object.values(v.pack.items)) check('items', i.id, 'art.icon', i.art.icon, reg.icons, 'icon');
}

function rule05(v: Validation): void {
  const known = v.options.registries?.ambient;
  if (!known) return;
  const check = (table: string, id: string, ambient: string | undefined): void => {
    if (ambient !== undefined && !known.includes(ambient)) v.warn('rule-05', table, id, 'ambient', `ambient preset ${quote(ambient)} is not in the audio registry`);
  };
  for (const r of Object.values(v.pack.regions)) check('regions', r.id, r.ambient);
  for (const l of Object.values(v.pack.locations)) check('locations', l.id, l.ambient);
}

// ---- Rule 6: ids -----------------------------------------------------------------------------------------------------------

const PLAIN_ID = /^[a-z][a-z0-9_]*$/;
const TABLE_ID: Record<TableName, RegExp> = {
  regions: /^region_[a-z0-9_]+$/,
  locations: /^loc_[a-z0-9_]+$/,
  creatures: /^cr_[a-z0-9_]+$/,
  items: /^(?:item|mat)_[a-z0-9_]+$/,
  recipes: /^recipe_[a-z0-9_]+$/,
  abilities: ABILITY_ID_RE,
  classes: PLAIN_ID,
  statuses: /^status_[a-z0-9_]+$/,
  quests: /^q_[a-z0-9_]+$/,
  dialogues: /^scene_[a-z0-9_]+$/,
  npcs: /^npc_[a-z0-9_]+$/,
  companions: PLAIN_ID,
  echoes: /^echo_[a-z0-9_]+$/,
  codex: /^codex_[a-z0-9_]+$/,
  achievements: /^ach_[a-z0-9_]+$/,
  attunements: /^att_[a-z0-9_]+$/,
  modifiers: /^mod_[a-z0-9_]+$/,
  endings: /^(?:ending|closer)_[a-z0-9_]+$/,
  merchants: /^npc_[a-z0-9_]+$/,
  affixes: /^affix_[a-z0-9_]+$/,
  encounters: PLAIN_ID,
  factions: PLAIN_ID,
};

function rule06(v: Validation): void {
  const { pack } = v;
  for (const table of TABLE_NAMES) {
    for (const [key, record] of Object.entries(pack[table])) {
      const id = (record as { id: string }).id;
      if (id !== key) v.error('rule-06', table, key, 'id', `record is filed under ${quote(key)} but its id is ${quote(id)}`);
      if (!TABLE_ID[table].test(id)) v.error('rule-06', table, key, 'id', `id ${quote(id)} does not match the D-044 shape for ${table}`);
    }
  }
  // Nested ids (dialogue nodes/choices, quest stages, communion answers, …) are looked up by key in the engine, so an
  // Object.prototype name there would break lookups (U35, D-085). Walk every record for nested `id`/`choiceId`/`answerId`.
  for (const table of TABLE_NAMES) {
    for (const [key, record] of Object.entries(pack[table])) reservedNestedIds(v, table, key, record, '');
  }
  // Encounter ids are global: `startCombat` resolves them across location encounters and the encounters table.
  const seen = new Map<string, string>();
  for (const enc of Object.values(pack.encounters)) seen.set(enc.id, `encounters.${enc.id}`);
  for (const loc of Object.values(pack.locations)) {
    loc.encounters.forEach((enc, i) => {
      const first = seen.get(enc.id);
      if (first !== undefined) v.error('rule-06', 'locations', loc.id, `encounters.${i}.id`, `encounter id ${quote(enc.id)} is already used by ${first}`);
      else seen.set(enc.id, `locations.${loc.id}`);
    });
  }
}

/** Reports nested id-like fields whose value names an Object.prototype member (rule 6). */
function reservedNestedIds(v: Validation, table: TableName, key: string, value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((x, i) => reservedNestedIds(v, table, key, x, `${path}${path ? '.' : ''}${i}`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [k, x] of Object.entries(value as Record<string, unknown>)) {
    const at = `${path}${path ? '.' : ''}${k}`;
    if (path !== '' && (k === 'id' || k === 'choiceId' || k === 'answerId') && typeof x === 'string' && x in Object.prototype) {
      v.error('rule-06', table, key, at, `${quote(x)} is reserved (it names an Object.prototype member)`);
    }
    reservedNestedIds(v, table, key, x, at);
  }
}

// ---- Rule 7: exits -----------------------------------------------------------------------------------------------------------

function rule07(v: Validation): void {
  const { pack } = v;
  const R = 'rule-07';
  for (const loc of Object.values(pack.locations)) {
    const dirs = new Set<string>();
    loc.exits.forEach((exit, i) => {
      const at = `exits.${i}`;
      const label = `exit ${quote(exit.dir)} → ${exit.to}`;
      if (exit.to === loc.id) v.error(R, 'locations', loc.id, at, `${label}: an exit cannot lead to its own location`);
      if (exit.dir !== 'path') {
        if (dirs.has(exit.dir)) v.error(R, 'locations', loc.id, at, `${label}: direction ${quote(exit.dir)} is used by two exits (use 'path' for extra routes)`);
        dirs.add(exit.dir);
      }
      if (exit.kind === 'road' && exit.gate === undefined) v.error(R, 'locations', loc.id, at, `${label}: a road needs a gate (D-069.9)`);
      if (exit.kind !== 'road' && exit.gate !== undefined) v.error(R, 'locations', loc.id, at, `${label}: gate is only for kind 'road'`);

      const to = pack.locations[exit.to];
      if (!to || exit.to === loc.id || exit.oneWay) return;
      const backs = to.exits.filter((x) => x.to === loc.id);
      const match = backs.find((x) => x.kind === exit.kind && (exit.kind !== 'road' || same(x.gate, exit.gate)));
      if (match) return;
      if (backs.length > 0) {
        const other = backs[0] as Exit;
        v.error(
          R, 'locations', loc.id, at,
          exit.kind === 'road'
            ? `${label}: the reverse exit on ${to.id} must be a road with the same gate`
            : `${label}: the reverse exit on ${to.id} is a ${other.kind}, expected a plain exit`,
        );
      } else if (!reach(v, to.id, 'any').has(loc.id) && !to.tags.includes('one_way_ok')) {
        v.error(R, 'locations', loc.id, at, `${label}: ${to.id} has no way back to ${loc.id} (add a reverse exit, mark the exit oneWay, or tag the destination one_way_ok)`);
      } else {
        v.warn(R, 'locations', loc.id, at, `${label}: ${to.id} has no reverse exit`);
      }
    });
  }
}

// ---- Rule 8: reachability ----------------------------------------------------------------------------------------------------

function rule08(v: Validation): void {
  const { pack } = v;
  const R = 'rule-08';
  const locations = Object.values(pack.locations);
  if (locations.length === 0) return; // nothing to reach; the counts rule (21) reports the missing world
  const start = pack.config.startLocationId;
  if (!v.has('locations', start)) {
    v.error(R, 'config', '-', 'startLocationId', `start location ${quote(start)} not found in locations`);
    return;
  }

  // Hidden exits that nothing can reveal.
  for (const loc of locations) {
    loc.exits.forEach((exit, i) => {
      if (exit.hidden && exit.when === undefined && !v.scan.unlockedExits.has(`${loc.id}>${exit.to}`)) {
        v.warn(R, 'locations', loc.id, `exits.${i}`, `exit ${quote(exit.dir)} → ${exit.to} is hidden with no \`when\` and no unlockExit effect: it can never appear`);
      }
    });
  }

  const gated = (loc: Location): boolean => pack.regions[loc.regionId]?.unlockWhen !== undefined;
  const fromStart = reach(v, start, 'any');
  for (const loc of locations) {
    if (fromStart.has(loc.id) || loc.tags.includes('threshold')) continue;
    if (gated(loc)) {
      // An unlockWhen region is entered some other way (Loop 2+); it still needs a door in.
      const door = locations.some((o) => o.id !== loc.id && o.exits.some((x) => x.to === loc.id));
      if (!door) v.warn(R, 'locations', loc.id, '', `region ${loc.regionId} is gated (unlockWhen) and this location has no exit leading to it`);
      continue;
    }
    v.error(R, 'locations', loc.id, '', `unreachable from the start location ${start} (conditions treated as satisfiable)`);
  }

  // Threshold locations are reached from the Still Shore.
  const thresholds = locations.filter((l) => l.tags.includes('threshold'));
  if (thresholds.length > 0) {
    if (!v.has('locations', 'loc_still_shore')) {
      v.error(R, 'locations', thresholds[0]?.id ?? '-', '', "Threshold locations exist but 'loc_still_shore' does not");
    } else {
      const fromShore = reach(v, 'loc_still_shore', 'any');
      for (const loc of thresholds) {
        if (!fromShore.has(loc.id)) v.error(R, 'locations', loc.id, '', 'Threshold location unreachable from loc_still_shore');
      }
    }
  }

  // Loop 1: every legacy location is reachable with conditions evaluated against a synthetic Loop 1 state.
  const loopOne = reach(v, start, 'loop1');
  for (const loc of locations) {
    const legacy = loc.legacyName !== undefined || hasOwn(LEGACY_LOCATIONS, loc.id);
    if (legacy && !loopOne.has(loc.id)) {
      v.error(R, 'locations', loc.id, '', `legacy location unreachable in Loop 1 (loop = 1, no Echoes) from ${start}`);
    }
  }
}

// ---- Rule 9: quest graph -----------------------------------------------------------------------------------------------------

function rule09(v: Validation): void {
  const R = 'rule-09';
  for (const q of Object.values(v.pack.quests)) {
    const stages = new Map(q.stages.map((s) => [s.id, s] as const));
    const first = q.firstStage ?? q.stages[0]?.id;
    if (first === undefined || !stages.has(first)) {
      v.error(R, 'quests', q.id, 'firstStage', `firstStage ${quote(first)} is not a stage`);
      continue;
    }
    const roots = new Set<string>([first]);
    for (const s of q.shortcuts) roots.add(s.skipTo);
    for (const key of v.scan.advanceTargets) if (key.startsWith(`${q.id}/`)) roots.add(key.slice(q.id.length + 1));
    const seen = new Set<string>();
    const queue = [...roots].filter((id) => stages.has(id));
    queue.forEach((id) => seen.add(id));
    for (let i = 0; i < queue.length; i++) {
      const s = stages.get(queue[i] as string);
      if (!s) continue;
      const out = [...(typeof s.next === 'string' ? [s.next] : (s.next ?? []).map((b) => b.to)), ...(s.onTimeoutTo !== undefined ? [s.onTimeoutTo] : [])];
      for (const to of out) {
        if (stages.has(to) && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    q.stages.forEach((s, i) => {
      if (!seen.has(s.id)) v.error(R, 'quests', q.id, `stages.${i}`, `stage ${quote(s.id)} is unreachable from ${quote(first)}`);
      if (s.outcome !== undefined && s.next !== undefined) v.error(R, 'quests', q.id, `stages.${i}.next`, `stage ${quote(s.id)} has both an outcome and a next`);
      if (s.outcome === undefined && s.next === undefined) {
        v.warn(R, 'quests', q.id, `stages.${i}`, `stage ${quote(s.id)} has neither next nor outcome: reaching it leaves the quest unfinished`);
      }
      if (Array.isArray(s.next) && s.next.every((b) => evalCondition(b.when, UNKNOWN_LEAVES) === 'F')) {
        v.error(R, 'quests', q.id, `stages.${i}.next`, `stage ${quote(s.id)}: every branch condition is never true`);
      }
    });
    if (!q.stages.some((s) => s.outcome === 'complete' && seen.has(s.id))) {
      v.error(R, 'quests', q.id, 'stages', "no reachable terminal stage with outcome 'complete'");
    }
  }
}

// ---- Rule 10: dialogue graph -------------------------------------------------------------------------------------------------

function rule10(v: Validation): void {
  const { pack } = v;
  const R = 'rule-10';
  const specials = new Set(['narrator', 'player', 'companion']);
  for (const scene of Object.values(pack.dialogues)) {
    const nodes = new Map(scene.nodes.map((n) => [n.id, n] as const));
    const roots = typeof scene.entry === 'string' ? [scene.entry] : scene.entry.map((e) => e.node);
    const seen = new Set<string>();
    const queue = roots.filter((id) => nodes.has(id));
    queue.forEach((id) => seen.add(id));
    for (let i = 0; i < queue.length; i++) {
      const node = nodes.get(queue[i] as string);
      if (!node) continue;
      const out = [...node.choices.map((c) => c.next), ...(node.next !== undefined ? [node.next] : [])];
      for (const to of out) {
        if (to !== 'end' && nodes.has(to) && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    scene.nodes.forEach((node, i) => {
      const at = `nodes.${i}`;
      if (!seen.has(node.id)) v.error(R, 'dialogues', scene.id, at, `node ${quote(node.id)} is unreachable from the scene's entry`);
      if (node.choices.length === 0 && node.next === undefined) v.error(R, 'dialogues', scene.id, at, `node ${quote(node.id)} has no choices and no next`);
      const hotkeys = node.choices.map((c) => c.hotkey).filter((k): k is string => k !== undefined);
      if (new Set(hotkeys).size !== hotkeys.length) v.error(R, 'dialogues', scene.id, at, `node ${quote(node.id)} reuses a choice hotkey`);
      const speaker = node.speaker;
      if (!specials.has(speaker) && !v.has('npcs', speaker) && !v.has('companions', speaker) && !v.has('creatures', speaker)) {
        v.error(R, 'dialogues', scene.id, `${at}.speaker`, `speaker ${quote(speaker)} is not an npc, companion or creature id (or narrator/player/companion)`);
      }
    });
    // A cycle of choice-less nodes is a scene that can never end or ask the player anything.
    const state = new Map<string, 'active' | 'done'>();
    const dfs = (id: string): boolean => {
      const node = nodes.get(id);
      if (!node || node.choices.length > 0 || node.next === undefined || node.next === 'end') return false;
      state.set(id, 'active');
      const next = node.next;
      const seenNext = state.get(next);
      const cyclic = seenNext === 'active' || (seenNext === undefined && dfs(next));
      state.set(id, 'done');
      return cyclic;
    };
    for (const node of scene.nodes) {
      if (!state.has(node.id) && dfs(node.id)) {
        v.error(R, 'dialogues', scene.id, '', `node ${quote(node.id)} is part of a cycle of choice-less nodes (an infinite continue)`);
        break;
      }
    }
  }
}

// ---- Rule 11: creatures ------------------------------------------------------------------------------------------------------

function rule11(v: Validation): void {
  const { pack } = v;
  const R = 'rule-11';
  for (const c of Object.values(pack.creatures)) {
    if (c.role === 'boss') {
      if (c.phases.length < BOSS_PHASES.min || c.phases.length > BOSS_PHASES.max) {
        v.error(R, 'creatures', c.id, 'phases', `a boss has ${BOSS_PHASES.min}–${BOSS_PHASES.max} phases; got ${c.phases.length}`);
      }
      if (c.fleeable) v.error(R, 'creatures', c.id, 'fleeable', 'a boss is not fleeable');
    }
    let lastHp = 1;
    c.phases.forEach((ph, i) => {
      if (ph.pattern.length === 0) v.error(R, 'creatures', c.id, `phases.${i}.pattern`, `phase ${quote(ph.id)} has an empty pattern`);
      for (const trigger of ph.enterWhen) {
        if ('hpBelow' in trigger) {
          if (trigger.hpBelow >= lastHp) v.error(R, 'creatures', c.id, `phases.${i}.enterWhen`, `hpBelow ${trigger.hpBelow} is not below the previous phase's ${lastHp}`);
          lastHp = trigger.hpBelow;
        }
      }
    });
    if (c.phases.length === 0 && c.pattern.length === 0) v.error(R, 'creatures', c.id, 'pattern', 'no pattern and no phases');
  }

  // Placement: a non-boss sits within its band ± 2; a regional boss sits 2 levels above the band's top (D-066 #21).
  const warnLevel = (c: { id: string; role: string; level: number }, band: { min: number; max: number }, where: string): void => {
    if (c.role === 'boss') return;
    if (c.level < band.min - 2 || c.level > band.max + 2) {
      v.warn(R, 'creatures', c.id, 'level', `level ${c.level} is outside the ${band.min}–${band.max} band of ${where} by more than 2`);
    }
  };
  for (const loc of Object.values(pack.locations)) {
    const band = bandOf(v, loc);
    if (!band) continue;
    for (const enc of loc.encounters) {
      for (const g of enc.groups) {
        const c = pack.creatures[g.creatureId];
        if (!c) continue;
        if (c.role === 'boss') {
          if (!loc.tags.includes('apex') && c.level !== band.max + 2) {
            v.warn(R, 'creatures', c.id, 'level', `regional boss at ${loc.id} is level ${c.level}; the band tops at ${band.max}, so expected ${band.max + 2} (D-066 #21)`);
          }
        } else warnLevel(c, band, loc.id);
      }
    }
  }
  for (const region of Object.values(pack.regions)) {
    for (const w of region.wanderingPool) {
      const c = pack.creatures[w.creatureId];
      if (c) warnLevel(c, region.levelBand, region.id);
    }
  }
}

// ---- Rule 12: items ----------------------------------------------------------------------------------------------------------

function rule12(v: Validation): void {
  const R = 'rule-12';
  for (const item of Object.values(v.pack.items)) {
    const gear = (EQUIPMENT_TYPES as readonly string[]).includes(item.type);
    const err = (path: string, message: string): void => v.error(R, 'items', item.id, path, message);
    if (gear && item.slot !== item.type) err('slot', `a ${item.type} needs slot '${item.type}'`);
    if (!gear && item.slot !== undefined) err('slot', `a ${item.type} has no equipment slot`);
    if (item.weaponType !== undefined && item.type !== 'weapon') err('weaponType', 'weaponType is only for weapons');
    if (item.type === 'weapon' && item.weaponType === undefined) err('weaponType', 'a weapon needs a weaponType');
    if (item.type === 'consumable' && item.onUse.length === 0) err('onUse', 'a consumable needs onUse effects');
    if (item.sellable && item.value <= 0) err('value', 'a sellable item needs value > 0');
    if (item.rarityRule === 'rolled' && !gear) err('rarityRule', "only weapon, armor and trinket roll a rarity (rarityRule 'rolled')");
  }
}

// ---- Rule 13: abilities ------------------------------------------------------------------------------------------------------

function rule13(v: Validation): void {
  const { pack } = v;
  const R = 'rule-13';
  const slots = new Map<string, string>();
  const tiersIn = new Map<string, Set<number>>();
  for (const a of Object.values(pack.abilities)) {
    const err = (path: string, message: string): void => v.error(R, 'abilities', a.id, path, message);
    const doesSomething = a.power !== undefined || a.heal !== undefined || a.shield !== undefined || a.statuses.length > 0 || a.special !== undefined || isScriptedAbility(a.id);
    if (!doesSomething) err('', 'does nothing: needs power, heal, shield, statuses or a special (or an engine script, SCRIPTED_ABILITIES)');
    if (abilityOwnerKind(a.id) !== 'class') continue;
    if (a.tier === undefined || a.branch === undefined) continue; // the schema already requires both
    const gate = TIER_LEVELS[a.tier - 1];
    if (a.levelReq !== gate) err('levelReq', `tier ${a.tier} unlocks at level ${String(gate)}, not ${a.levelReq}`);
    if (a.costHalf !== tierCostHalf(a.tier)) err('costHalf', `tier ${a.tier} costs ${tierCostHalf(a.tier)} half-points, not ${a.costHalf}`);
    if (a.mp <= 0 && a.special !== 'resource_convert' && a.id !== 'wvr_blood_pact') err('mp', 'costs no MP and is not a resource converter');
    const slot = `${a.ownerId}/${a.branch}/${a.tier}`;
    const taken = slots.get(slot);
    if (taken !== undefined) err('tier', `${taken} already fills ${a.ownerId} ${a.branch} tier ${a.tier}`);
    else slots.set(slot, a.id);
    const key = `${a.ownerId}/${a.branch}`;
    if (!tiersIn.has(key)) tiersIn.set(key, new Set());
    tiersIn.get(key)?.add(a.tier);
  }
  // DESIGN §5.1: tier 3 needs two abilities already unlocked in the branch, tier 4 three, the capstone all four — so every lower tier must exist.
  for (const a of Object.values(pack.abilities)) {
    if (abilityOwnerKind(a.id) !== 'class' || a.tier === undefined || a.branch === undefined || a.tier < 3) continue;
    const have = tiersIn.get(`${a.ownerId}/${a.branch}`) ?? new Set<number>();
    const missing = [1, 2, 3, 4].filter((t) => t < (a.tier as number) && !have.has(t));
    if (missing.length > 0) {
      v.error(R, 'abilities', a.id, 'tier', `tier ${a.tier} needs the tier ${missing.join(', ')} ability of ${a.ownerId} ${a.branch} to exist (DESIGN §5.1 prerequisites)`);
    }
  }

  // D-047: the Amulet grants itm_echo_bolt.
  const bolt = pack.abilities.itm_echo_bolt;
  const amulet = pack.items.item_amulet_of_echoes;
  if (bolt && bolt.ownerId !== 'item_amulet_of_echoes') v.error(R, 'abilities', bolt.id, 'ownerId', "itm_echo_bolt is granted by 'item_amulet_of_echoes' (D-047)");
  if (bolt && amulet && !amulet.passives.some((p) => p.kind === 'grantAbility' && p.abilityId === 'itm_echo_bolt')) {
    v.error(R, 'items', amulet.id, 'passives', "item_amulet_of_echoes does not grant 'itm_echo_bolt' (D-047)");
  }
  if (!bolt) v.count(R, 'abilities', 'itm_echo_bolt', '', "'itm_echo_bolt' does not exist (D-047)");
  if (!amulet) v.count(R, 'items', 'item_amulet_of_echoes', '', "'item_amulet_of_echoes' does not exist (D-047)");

  // Completeness (D-008): five classes, each 3 branches × 5 tiers = 15 abilities.
  for (const classId of ClassId.options) {
    const cls = pack.classes[classId];
    if (!cls) {
      v.count(R, 'classes', classId, '', `class ${quote(classId)} does not exist`);
      continue;
    }
    const mine = Object.values(pack.abilities).filter((a) => abilityOwnerKind(a.id) === 'class' && a.ownerId === classId);
    if (mine.length !== EXPECTED_COUNTS.abilitiesPerClass) {
      v.count(R, 'classes', classId, '', `${mine.length} abilities; expected ${EXPECTED_COUNTS.abilitiesPerClass} (3 branches × 5 tiers, D-008)`);
    }
    for (const b of cls.branches) {
      const tiers = new Set(mine.filter((a) => a.branch === b.id).map((a) => a.tier));
      const missing = [1, 2, 3, 4, 5].filter((t) => !tiers.has(t));
      if (missing.length > 0) v.count(R, 'classes', classId, `branches.${b.id}`, `branch ${quote(b.id)} lacks tier ${missing.join(', ')}`);
    }
  }
}

// ---- Rule 14: statuses -------------------------------------------------------------------------------------------------------

function rule14(v: Validation): void {
  for (const s of Object.values(v.pack.statuses)) {
    if (s.stackable && s.maxStacks <= 1) v.error('rule-14', 'statuses', s.id, 'maxStacks', 'a stackable status needs maxStacks > 1');
  }
  for (const id of CANONICAL_STATUSES) {
    if (!v.has('statuses', id)) v.count('rule-14', 'statuses', id, '', `canonical status ${quote(id)} is missing`);
  }
}

// ---- Rule 15: endings --------------------------------------------------------------------------------------------------------

/** True when a Condition tree mentions an `echo` or `flag` atom. */
function mentionsEchoOrFlag(c: unknown): boolean {
  if (!isObj(c)) return false;
  const key = Object.keys(c)[0];
  if (key === 'echo' || key === 'flag') return true;
  if (key === 'all' || key === 'any') return asArray(c[key]).some(mentionsEchoOrFlag);
  if (key === 'not') return mentionsEchoOrFlag(c.not);
  return false;
}

function rule15(v: Validation): void {
  const { pack, scan } = v;
  const R = 'rule-15';
  for (const id of [...TRUE_ENDING_IDS, ...CLOSER_IDS]) {
    if (!v.has('endings', id)) v.count(R, 'endings', id, '', `ending record ${quote(id)} is missing`);
  }
  for (const e of Object.values(pack.endings)) {
    if (e.kind !== 'true') continue;
    if (!mentionsEchoOrFlag(e.requirements)) v.error(R, 'endings', e.id, 'requirements', 'a true ending must require at least one echo or flag');
    // Closers are produced by the engine (death, expiry) or by an endLoop effect; only true endings need an `ending` effect.
    if (!scan.endingTargets.has(e.id)) v.error(R, 'endings', e.id, '', `no { ending: '${e.id}' } effect anywhere in content: the ending cannot be reached`);
  }
}

// ---- Rule 16: echoes ---------------------------------------------------------------------------------------------------------

function rule16(v: Validation): void {
  const { pack, scan } = v;
  const R = 'rule-16';
  const granted = new Set([...scan.echoGrants, ...ENGINE_GRANTED_ECHOES]);
  const gating = new Set(scan.echoUsed);
  for (const q of Object.values(pack.quests)) {
    for (const id of q.rewards.echoes) granted.add(id);
    for (const s of q.shortcuts) gating.add(s.echo);
  }
  for (const scene of Object.values(pack.dialogues)) {
    for (const node of scene.nodes) for (const choice of node.choices) if (choice.echoHint !== undefined) gating.add(choice.echoHint);
  }
  for (const e of Object.values(pack.echoes)) {
    if (!granted.has(e.id)) v.error(R, 'echoes', e.id, '', 'no grantEcho effect and no quest reward grants this Echo');
    if (!gating.has(e.id)) v.warn(R, 'echoes', e.id, '', 'this Echo gates nothing: no condition, shortcut, choice or ending reads it');
    e.exclusiveWith.forEach((other, i) => {
      const o = pack.echoes[other];
      if (o && !o.exclusiveWith.includes(e.id)) v.error(R, 'echoes', e.id, `exclusiveWith.${i}`, `exclusiveWith is not symmetric: ${other} does not list ${e.id}`);
    });
    for (const endingId of e.requiredForEndings) {
      const ending = pack.endings[endingId];
      if (ending && !conditionMentionsEcho(ending.requirements, e.id)) {
        v.error(R, 'echoes', e.id, 'requiredForEndings', `${endingId} lists this Echo as required but its requirements never read ${e.id}`);
      }
    }
  }
}

function conditionMentionsEcho(c: unknown, echo: string): boolean {
  if (!isObj(c)) return false;
  const key = Object.keys(c)[0];
  if (key === 'echo') return c.echo === echo;
  if (key === 'all' || key === 'any') return asArray(c[key]).some((x) => conditionMentionsEcho(x, echo));
  if (key === 'not') return conditionMentionsEcho(c.not, echo);
  return false;
}

// ---- Rule 17: codex ----------------------------------------------------------------------------------------------------------

function rule17(v: Validation): void {
  const { pack, scan } = v;
  const R = 'rule-17';
  const entries = Object.values(pack.codex);
  for (const c of entries) {
    const words = wordCount(c.body);
    if (words > CODEX_BODY_MAX_WORDS) v.error(R, 'codex', c.id, 'body', `body is ${words} words; the limit is ${CODEX_BODY_MAX_WORDS} (D-020)`);
    if (!c.unlockedAtStart && c.unlockWhen === undefined && !scan.codexUnlocked.has(c.id)) {
      v.error(R, 'codex', c.id, '', 'unreachable lore: not unlockedAtStart, no unlockWhen, and no unlockCodex effect targets it');
    }
  }
  if (entries.length > 0) {
    const perVoice = new Map<string, number>();
    for (const c of entries) perVoice.set(c.voice, (perVoice.get(c.voice) ?? 0) + 1);
    for (const voice of ['remnant_archive', 'ironclad_telling', 'weaver_fragment', 'wayfinder_notes']) {
      const n = perVoice.get(voice) ?? 0;
      if (n / entries.length < 0.1) {
        v.warn(R, 'codex', '-', '', `voice ${quote(voice)} has ${n} of ${entries.length} entries (${Math.round((100 * n) / entries.length)}%), under 10%`);
      }
    }
  }
}

// ---- Rule 18: companions -----------------------------------------------------------------------------------------------------

function rule18(v: Validation): void {
  const { pack } = v;
  const R = 'rule-18';
  for (const id of CompanionId.options) {
    if (!v.has('companions', id)) v.count(R, 'companions', id, '', `companion ${quote(id)} is missing (D-013: six)`);
  }
  for (const c of Object.values(pack.companions)) {
    // ownerId = the companion for every ability in `abilities[]` and the signature is checked with the references (rule 1).
    if (c.arcQuestIds.length < 3) v.count(R, 'companions', c.id, 'arcQuestIds', `${c.arcQuestIds.length} arc quests; at least 3 are required`);
    const arcs = c.arcQuestIds.map((q) => pack.quests[q]).filter((q) => q !== undefined);
    const terminals = arcs.flatMap((q) => q.stages.filter((s) => s.outcome !== undefined));
    const branching = arcs.some((q) => q.stages.filter((s) => s.outcome !== undefined).length >= 2);
    const outcomes = new Set(terminals.map((s) => s.outcome));
    if (!branching && outcomes.size < 2) v.count(R, 'companions', c.id, 'arcQuestIds', 'the arc quests have fewer than two distinct terminal outcomes');
  }
}

// ---- Rule 19: modifiers and attunements --------------------------------------------------------------------------------------

function rule19(v: Validation): void {
  const { pack } = v;
  const R = 'rule-19';
  for (const id of REQUIRED_MODIFIERS) {
    if (!v.has('modifiers', id)) v.count(R, 'modifiers', id, '', `required modifier ${quote(id)} is missing`);
  }
  for (const id of ATTUNEMENT_IDS) {
    if (!v.has('attunements', id)) v.count(R, 'attunements', id, '', `attunement ${quote(id)} (DESIGN §10.7) is missing`);
  }
  for (const a of Object.values(pack.attunements)) {
    if (!(ATTUNEMENT_IDS as readonly string[]).includes(a.id)) v.count(R, 'attunements', a.id, '', `${quote(a.id)} is not one of the fifteen Attunements of DESIGN §10.7`);
  }
  if (pack.config.attunementEquipCap !== 5) v.error(R, 'config', '-', 'attunementEquipCap', `attunementEquipCap is ${pack.config.attunementEquipCap}; it must be 5 (C-41)`);
}

// ---- Rule 20: merchants ------------------------------------------------------------------------------------------------------

function rule20(v: Validation): void {
  const { pack } = v;
  const R = 'rule-20';
  for (const loc of Object.values(pack.locations)) {
    if (loc.merchantId === undefined) continue;
    const npc = pack.npcs[loc.merchantId];
    if (!loc.npcs.includes(loc.merchantId)) v.error(R, 'locations', loc.id, 'merchantId', `merchant ${loc.merchantId} is not among the npcs at ${loc.id}`);
    if (npc && !npc.roles.includes('merchant')) v.error(R, 'locations', loc.id, 'merchantId', `${loc.merchantId} does not have the 'merchant' role`);
  }
  for (const m of Object.values(pack.merchants)) {
    const npc = pack.npcs[m.npcId];
    if (npc && !npc.roles.includes('merchant')) v.error(R, 'merchants', m.id, 'npcId', `${m.npcId} does not have the 'merchant' role`);
    const stocked = [...m.stock.map((s, i) => ({ id: s.itemId, path: `stock.${i}.itemId` })), ...(m.rollStock?.pool ?? []).map((id, i) => ({ id, path: `rollStock.pool.${i}` }))];
    for (const s of stocked) {
      const item = pack.items[s.id];
      if (!item) continue;
      if (item.type === 'quest') v.error(R, 'merchants', m.id, s.path, `${s.id} is a quest item and cannot be stocked`);
      else if (!item.sellable) v.error(R, 'merchants', m.id, s.path, `${s.id} is not sellable`);
    }
  }
}

// ---- Rule 21: counts ---------------------------------------------------------------------------------------------------------

function rule21(v: Validation): void {
  const { pack } = v;
  const R = 'rule-21';
  const check = (table: string, what: string, actual: number, wanted: number, atLeast = false): void => {
    if (atLeast ? actual < wanted : actual !== wanted) v.count(R, table, '-', '', `${actual} ${what}; expected ${atLeast ? 'at least ' : ''}${wanted}`);
  };
  const n = (table: TableName): number => Object.keys(pack[table]).length;
  const quests = Object.values(pack.quests);
  const creatures = Object.values(pack.creatures);
  const abilities = Object.values(pack.abilities);
  check('regions', 'regions', n('regions'), EXPECTED_COUNTS.regions);
  check('locations', 'locations', n('locations'), EXPECTED_COUNTS.locations);
  check('quests', 'story quests (D-045, legacy six included)', quests.filter((q) => q.category !== 'class' && q.category !== 'stretch').length, EXPECTED_COUNTS.quests);
  check('quests', 'class mini-quests', quests.filter((q) => q.category === 'class').length, EXPECTED_COUNTS.classQuests);
  check('codex', 'codex entries', n('codex'), EXPECTED_COUNTS.codexMin, true);
  check('echoes', 'echoes', n('echoes'), EXPECTED_COUNTS.echoes);
  check('creatures', 'creatures (anomaly variants apart)', creatures.filter((c) => c.role !== 'anomaly').length, EXPECTED_COUNTS.creatures);
  check('creatures', 'anomaly variants', creatures.filter((c) => c.role === 'anomaly').length, EXPECTED_COUNTS.anomalies);
  check('items', 'items', n('items'), EXPECTED_COUNTS.itemsMin, true);
  check('achievements', 'achievements', n('achievements'), EXPECTED_COUNTS.achievements);
  check('abilities', 'class abilities', abilities.filter((a) => abilityOwnerKind(a.id) === 'class').length, EXPECTED_COUNTS.classAbilities);
  check('abilities', 'companion abilities', abilities.filter((a) => abilityOwnerKind(a.id) === 'companion').length, EXPECTED_COUNTS.companionAbilities);
  check('abilities', 'item abilities', abilities.filter((a) => abilityOwnerKind(a.id) === 'item').length, EXPECTED_COUNTS.itemAbilities);
  check('endings', 'ending records', n('endings'), EXPECTED_COUNTS.endings);
  check('factions', 'factions', n('factions'), EXPECTED_COUNTS.factions);
  check('attunements', 'attunements', n('attunements'), EXPECTED_COUNTS.attunements);
  check('companions', 'companions', n('companions'), EXPECTED_COUNTS.companions);
  check('classes', 'classes', n('classes'), EXPECTED_COUNTS.classes);
  check('statuses', 'statuses', n('statuses'), EXPECTED_COUNTS.statuses);
}

// ---- Rule 22: legacy preservation --------------------------------------------------------------------------------------------

function rule22(v: Validation): void {
  const { pack } = v;
  const R = 'rule-22';

  /** Every record carrying a legacy name must be the Appendix A id for that name; every Appendix A id must carry its name. */
  const legacyNames = (
    table: TableName,
    records: Record<string, { id: string; legacyName?: string | undefined }>,
    expected: Readonly<Record<string, string>>,
    extra: (id: string) => string | undefined = () => undefined,
  ): void => {
    for (const rec of Object.values(records)) {
      const want = expected[rec.id] ?? extra(rec.id);
      if (rec.legacyName !== undefined && want === undefined) {
        const owner = Object.entries(expected).find(([, name]) => name === rec.legacyName)?.[0];
        v.error(R, table, rec.id, 'legacyName', owner === undefined ? `legacyName ${quote(rec.legacyName)} is not a legacy name in Appendix A` : `legacyName ${quote(rec.legacyName)} belongs to ${owner} in Appendix A, not ${rec.id}`);
      } else if (rec.legacyName !== undefined && want !== undefined && rec.legacyName !== want) {
        v.error(R, table, rec.id, 'legacyName', `legacyName is ${quote(rec.legacyName)}; Appendix A says ${quote(want)} (D-001: nothing renamed)`);
      }
    }
    for (const [id, name] of Object.entries(expected)) {
      const rec = records[id];
      if (!rec) v.count(R, table, id, '', `legacy ${table.slice(0, -1)} ${quote(id)} (${quote(name)}) does not exist (Appendix A)`);
      else if (rec.legacyName === undefined) v.count(R, table, id, 'legacyName', `legacyName is missing; Appendix A says ${quote(name)}`);
    }
  };

  legacyNames('locations', pack.locations, Object.fromEntries(Object.entries(LEGACY_LOCATIONS).map(([id, l]) => [id, l.name])));
  for (const loc of Object.values(pack.locations)) {
    const want = LEGACY_LOCATIONS[loc.id];
    if (want && loc.regionId !== want.region) v.error(R, 'locations', loc.id, 'regionId', `legacy location belongs to ${want.region} (Appendix A.2), not ${loc.regionId}`);
  }
  legacyNames('creatures', pack.creatures, LEGACY_CREATURES, (id) => (id === LEGACY_UNVEILED_TYRANT.id ? LEGACY_UNVEILED_TYRANT.name : undefined));
  if (!v.has('creatures', LEGACY_UNVEILED_TYRANT.id)) v.count(R, 'creatures', LEGACY_UNVEILED_TYRANT.id, '', `legacy creature ${quote(LEGACY_UNVEILED_TYRANT.id)} (the Loop 2+ Tyrant) does not exist (Appendix A.3)`);
  legacyNames('items', pack.items, LEGACY_ITEMS);
  legacyNames('npcs', pack.npcs, LEGACY_NPCS);

  for (const [id, legacy] of Object.entries(LEGACY_QUESTS)) {
    const q = pack.quests[id];
    if (!q) {
      v.count(R, 'quests', id, '', `legacy quest ${quote(id)} (${quote(legacy.name)}) does not exist (Appendix A.5)`);
      continue;
    }
    if (q.name !== legacy.name) v.error(R, 'quests', id, 'name', `legacy quest is named ${quote(q.name)}; Appendix A says ${quote(legacy.name)}`);
    if (q.legacyId === undefined) v.count(R, 'quests', id, 'legacyId', `legacyId is missing; Appendix A says ${quote(legacy.legacyId)}`);
  }
  for (const q of Object.values(pack.quests)) {
    if (q.legacyId === undefined) continue;
    const owner = Object.entries(LEGACY_QUESTS).find(([, l]) => l.legacyId === q.legacyId)?.[0];
    if (owner !== q.id) v.error(R, 'quests', q.id, 'legacyId', owner === undefined ? `legacyId ${quote(q.legacyId)} is not a legacy quest in Appendix A` : `legacyId ${quote(q.legacyId)} belongs to ${owner} in Appendix A, not ${q.id}`);
  }

  for (const cls of LEGACY_CLASSES) {
    const rec = pack.classes[cls];
    if (!rec) v.count(R, 'classes', cls, '', `legacy class ${quote(cls)} does not exist (Appendix A.5)`);
    else if (!rec.legacy) v.error(R, 'classes', cls, 'legacy', `${cls} is a legacy class: legacy must be true`);
  }
  for (const rec of Object.values(pack.classes)) {
    if (rec.legacy && !LEGACY_CLASSES.includes(rec.id)) v.error(R, 'classes', rec.id, 'legacy', `${rec.id} is not a legacy class (Appendix A.5): legacy must be false`);
  }
}

// ---- Driver -----------------------------------------------------------------------------------------------------------------

/** Every PLAN §5.19 rule, in order. `run` reports through the validation it is given. */
const RULE_TABLE: readonly (RuleInfo & { run: (v: Validation) => void })[] = [
  { rule: 'rule-01', title: 'every id reference resolves', counts: false, run: rule01 },
  { rule: 'rule-02', title: 'ids inside Conditions and Effects resolve (flags warn)', counts: false, run: rule02 },
  { rule: 'rule-03', title: 'specials exist in the engine registry', counts: false, run: rule03 },
  { rule: 'rule-04', title: 'art keys exist in the UI registries (warning)', counts: false, run: rule04 },
  { rule: 'rule-05', title: 'ambient presets exist in the audio registry (warning)', counts: false, run: rule05 },
  { rule: 'rule-06', title: 'ids are unique and well formed', counts: false, run: rule06 },
  { rule: 'rule-07', title: 'exits: no self exit, reverse exits, unique directions, roads', counts: false, run: rule07 },
  { rule: 'rule-08', title: 'reachability from the start, Threshold, Loop 1 legacy', counts: false, run: rule08 },
  { rule: 'rule-09', title: 'quest graph', counts: false, run: rule09 },
  { rule: 'rule-10', title: 'dialogue graph', counts: false, run: rule10 },
  { rule: 'rule-11', title: 'creatures: bosses, phases, combat-scope effects, level bands', counts: false, run: rule11 },
  { rule: 'rule-12', title: 'items', counts: false, run: rule12 },
  { rule: 'rule-13', title: 'abilities: tiers, costs, 15 per class, itm_echo_bolt', counts: true, run: rule13 },
  { rule: 'rule-14', title: 'statuses: all 19, stacking', counts: true, run: rule14 },
  { rule: 'rule-15', title: 'endings: all 8 records, requirements, ending effects', counts: true, run: rule15 },
  { rule: 'rule-16', title: 'echoes: granted, gating, exclusiveWith symmetric', counts: false, run: rule16 },
  { rule: 'rule-17', title: 'codex: length, reachable, voices', counts: false, run: rule17 },
  { rule: 'rule-18', title: 'companions: six, three arc quests, two outcomes', counts: true, run: rule18 },
  { rule: 'rule-19', title: 'modifiers and the fifteen attunements', counts: true, run: rule19 },
  { rule: 'rule-20', title: 'merchants', counts: false, run: rule20 },
  { rule: 'rule-21', title: 'game-wide counts', counts: true, run: rule21 },
  { rule: 'rule-22', title: 'legacy preservation (Appendix A)', counts: true, run: rule22 },
];

export const RULES: readonly RuleInfo[] = RULE_TABLE.map(({ rule, title, counts }) => ({ rule, title, counts }));

const ruleNumber = (rule: string): number => Number(/(\d+)$/.exec(rule)?.[1] ?? 99);

/**
 * PLAN §5.19: cross-reference and semantic validation of an assembled pack. Never throws on content problems; the report
 * lists every one, grouped by rule (stable order within a rule). See the file header for `strict` and `pending`.
 */
export function validateContent(pack: ContentPack, options: ValidateOptions = {}): ContentReport {
  const v = new Validation(pack, options);
  for (const rule of RULE_TABLE) rule.run(v);
  const order = (a: ContentIssue, b: ContentIssue): number => ruleNumber(a.rule) - ruleNumber(b.rule);
  return { errors: v.errors.sort(order), warnings: v.warnings.sort(order) };
}
