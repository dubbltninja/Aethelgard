// The authored content tables (PLAN §5.18), split out of index.ts by U62a so the build can replace this one module: the
// production and e2e builds (tools/build.ts) swap it for a generated copy whose long prose — codex bodies, dialogue node
// text, ending slides and epilogues — is a reference into lazily loaded text chunks (prose.ts, D-131). The engine, the sims,
// the validator and the tests import this file as written, with every word in it.
import type { AbilityInput } from '@schema/ability';
import type { AchievementInput } from '@schema/achievement';
import type { AffixInput } from '@schema/affix';
import type { AttunementInput } from '@schema/attunement';
import type { ClassInput } from '@schema/class';
import type { CodexEntryInput } from '@schema/codex';
import type { CompanionInput } from '@schema/companion';
import type { GameConfigInput } from '@schema/contentPack';
import type { CreatureInput } from '@schema/creature';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { EchoInput } from '@schema/echo';
import type { EncounterInput } from '@schema/encounter';
import type { EndingInput } from '@schema/ending';
import type { FactionInput } from '@schema/faction';
import type { ItemInput } from '@schema/item';
import type { LocationInput } from '@schema/location';
import type { MerchantInput } from '@schema/merchant';
import type { ModifierInput } from '@schema/modifier';
import type { NpcInput } from '@schema/npc';
import type { QuestInput } from '@schema/quest';
import type { RecipeInput } from '@schema/recipe';
import type { RegionInput } from '@schema/region';
import type { StatusInput } from '@schema/status';
import { elfAbilities } from './abilities/elf';
import { companionAbilities } from './abilities/companions';
import { consumableAbilities } from './abilities/consumables';
import { itemAbilities } from './abilities/items';
import { rangerAbilities } from './abilities/ranger';
import { wardenAbilities } from './abilities/warden';
import { weaverAbilities } from './abilities/weaver';
import { wizardAbilities } from './abilities/wizard';
import { armor } from './items/armor';
import { consumables } from './items/consumables';
import { materials } from './items/materials';
import { questTableItems } from './items/quest';
import { trinkets } from './items/trinkets';
import { weapons } from './items/weapons';
import * as regionTables from './regions';
import { achievements } from './shared/achievements';
import { affixes } from './shared/affixes';
import { attunements } from './shared/attunements';
import { classes } from './shared/classes';
import { companions } from './shared/companions';
import { codex } from './shared/codex';
import { dialogues } from './shared/dialogues';
import { echoes } from './shared/echoes';
import { endings } from './shared/endings';
import { factions } from './shared/factions';
import { merchants } from './shared/merchants';
import { modifiers } from './shared/modifiers';
import { encounters as questEncounters, quests } from './shared/quests';
import { recipes } from './shared/recipes';
import { statuses } from './shared/statuses';
import { configInput } from './shared/config';

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
 * and the starting kits' item records. U41: the Elf, Warden and Weaver trees, the Amulet of Echoes and its Echo Bolt. U49: the
 * weapons, armor and trinkets. U50: the consumables, materials, quest/key/recipe/tome items, the 30 recipes, the eight merchants and
 * the seven abilities the consumables unleash (`items`, `recipes` and `merchants` leave INCOMPLETE_TABLES). The six companions and their 24 abilities (shared/companions.ts,
 * abilities/companions.ts) are registered since D-111 (their arc quests and camp scenes are pending references until
 * U54–U56 author them, D-090). U42+: the region folders' tables arrive through regions/index.ts (one
 * import line per region there; nothing changes here), with their references into tables still being authored pending
 * under D-090. U51: the 103 Echoes, 40 achievements, 15 Attunements, six modifiers, the eight ending and closer records and
 * the three factions (shared/{echoes,achievements,attunements,modifiers,endings,factions}.ts). U52: the six legacy quests and their
 * scenes (shared/quests/, shared/dialogues/: one file per quest unit, spread by each folder's index.ts). U60: Codex I, the 42
 * history, Nine, Wayfinder, faction and people entries (shared/codex/, one barrel; U61 appends Codex II there and completes `codex`).
 */
export const contentTables: ContentTables = {
  regions: [...regionTables.regions],
  locations: [...regionTables.locations],
  creatures: [...regionTables.creatures],
  items: [...weapons, ...armor, ...trinkets, ...consumables, ...materials, ...questTableItems, ...regionTables.items],
  recipes: [...recipes],
  abilities: [
    ...rangerAbilities,
    ...wizardAbilities,
    ...elfAbilities,
    ...wardenAbilities,
    ...weaverAbilities,
    ...itemAbilities,
    ...consumableAbilities,
    ...companionAbilities,
  ],
  classes: [...classes],
  statuses: [...statuses],
  quests: [...quests],
  dialogues: [...dialogues],
  npcs: [...regionTables.npcs],
  companions: [...companions],
  echoes: [...echoes],
  codex: [...codex],
  achievements: [...achievements],
  attunements: [...attunements],
  modifiers: [...modifiers],
  endings: [...endings],
  merchants: [...merchants],
  affixes: [...affixes],
  encounters: [...questEncounters], // U53: the fights a quest starts itself (shared/quests/index.ts)
  factions: [...factions],
  config: configInput,
};
