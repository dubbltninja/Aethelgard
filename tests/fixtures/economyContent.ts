// Economy and crafting fixtures (U34; PLAN §8, §9.1 "later units may append fixtures for their own systems"; D-073 "no
// forge station yet (U34 adds one)"). The combat pack (its Mistwood Path east of the Ruins, its gear and affixes) plus
//   - WORLD's two legacy Mistwood stops, compressed: the Mistwood Path ─E─ loc_wayfarers_respite (Kaelen, `repFaction:
//     'best'`, an inn) ─N─ loc_emberforge (`craftingStation: 'forge'`, Borin, Ironclad), both safe (no wandering rolls);
//   - their stalls, from WORLD §9.2 cut to what the rules need: core lines, a rep-gated (Trusted) Rare piece, a Loop 2+
//     line (Kaelen's heartwood offcut, D-067.6), an 'unlimited' line, a priced-up line (×2, WORLD's Hollis rule, on
//     Borin's stall here) and a theme pool of 3–4 picks;
//   - the DESIGN §8.2 materials the upgrade, salvage and recipe rules name; the Heartstone fragments (D-052, D-066 #10),
//     Lanternreed Salts (`revive`, D-080), a pattern (`unlockRecipe`), the Sky-Whisper Talisman, `affix_of_the_void`;
//   - WORLD §8.2 recipes: the Breach-anchor (story, `anyOf` fragment, Trusted with the Neutral waiver during
//     `q_the_mending`/`q_iron_silence`, `echo_anchor_schema`), a void-forged edge (`flag_shards_refused`, Trusted or
//     `echo_borin_oath`, said as a condition), the Ember Flask (×2 output), the Breachsteel Blade (read pattern);
//   - the Heartstone's three choices as `interact` events in loc_heartstone_depths, below the Ruins (D-017: Stabilize and
//     Destroy give two fragments each, Exploit the Core and none);
//   - the Ironclad and Weaver factions, Borin's Favor and Kaelen's Ledger (U31's records), the Echoes the rules read.
// `beforeEconomyPack()` adds Bellwright Anso's stall (WORLD §9.2; fixture: at the Outer Walks) to the Before pack.
// Both skip `validateContent` (the Echoes have no content source here), like the Horde and Before packs.
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import type { AffixInput } from '@schema/affix';
import type { EchoInput } from '@schema/echo';
import type { FactionInput } from '@schema/faction';
import type { ItemInput } from '@schema/item';
import type { LocationInput } from '@schema/location';
import type { MerchantInput } from '@schema/merchant';
import type { NpcInput } from '@schema/npc';
import type { QuestInput } from '@schema/quest';
import type { RecipeInput } from '@schema/recipe';
import { clone, deepFreeze } from '@engine/util/clone';
import { WALKS, beforeTables } from './beforeContent';
import { MISTWOOD, combatTables } from './combatContent';
import { FIXTURE_VERSION } from './miniContent';
import { thresholdAttunements } from './thresholdContent';

export const FORGE = 'loc_emberforge';
export const RESPITE = 'loc_wayfarers_respite';
export const HEARTSTONE = 'loc_heartstone_depths';
export const BORIN = 'npc_borin_stonefist';
export const KAELEN = 'npc_kaelen_stonehand';
export const TAMSIN = 'npc_tamsin_reed';
export const ANSO = 'npc_bellwright_anso';
export const STABLE = 'item_heartstone_fragment_stable';
export const DEAD = 'item_heartstone_fragment_dead';
export const ANCHOR = 'item_breach_anchor';
export const PATTERN = 'item_pattern_breachsteel_blade';
/** Kaelen's inn (WORLD §9.1: 10 g). */
export const RESPITE_INN = 10;

// ---- places and people ------------------------------------------------------------------------------------------------------

const respite: LocationInput = {
  id: RESPITE,
  regionId: 'region_mistwood_ironclad_reach',
  name: "The Wayfarer's Respite",
  description: 'Fixture: a roadside inn with a trade counter and a fire that never goes out.',
  exits: [
    { dir: 'west', to: MISTWOOD },
    { dir: 'north', to: FORGE },
  ],
  npcs: [KAELEN],
  merchantId: KAELEN,
  rest: { kind: 'inn', cost: RESPITE_INN, text: 'Fixture: a bed over the common room.' },
  safe: true,
  art: { template: 'camp' },
  map: { x: 10, y: 6 },
};

const forge: LocationInput = {
  id: FORGE,
  regionId: 'region_mistwood_ironclad_reach',
  name: 'The Emberforge',
  description: 'Fixture: a smithy cut into the hill, its hearth banked but never cold.',
  exits: [{ dir: 'south', to: RESPITE }],
  npcs: [BORIN],
  merchantId: BORIN,
  craftingStation: 'forge',
  safe: true,
  art: { template: 'forge', particles: 'embers' },
  map: { x: 10, y: 4 },
};

const NOT_CHOSEN = { not: { flag: 'flag_heartstone_chosen' } } as const;

/** D-017 / DESIGN §8.5: Stabilize and Destroy give two fragments (D-066 #10); Exploit gives the Core and none. */
const heartstoneDepths: LocationInput = {
  id: HEARTSTONE,
  regionId: 'region_silverwood_ruins',
  name: 'Heartstone Depths',
  legacyName: 'Heartstone Depths',
  description: 'Fixture: the cavern where the Heartstone beats.',
  exits: [{ dir: 'up', to: 'loc_whispering_ruins' }],
  events: [
    {
      id: 'ev_heartstone_stabilize', trigger: 'interact', label: 'Stabilize the Heartstone', when: NOT_CHOSEN, text: 'The beat steadies.',
      effects: [
        { setFlag: 'flag_heartstone_chosen' }, { setFlag: 'flag_heartstone_stabilized' }, { rep: { faction: 'remnants', delta: 15 } },
        { clockWatches: 24 }, { giveItem: { item: STABLE, count: 2 } },
      ],
    },
    {
      id: 'ev_heartstone_destroy', trigger: 'interact', label: 'Destroy the Heartstone', when: NOT_CHOSEN, text: 'The beat stops.',
      effects: [
        { setFlag: 'flag_heartstone_chosen' }, { setFlag: 'flag_heartstone_destroyed' }, { rep: { faction: 'ironclad', delta: 20 } },
        { rep: { faction: 'remnants', delta: -25 } }, { rep: { faction: 'weavers', delta: -10 } }, { clockWatches: -40 },
        { giveItem: { item: DEAD, count: 2 } },
      ],
    },
    {
      id: 'ev_heartstone_exploit', trigger: 'interact', label: 'Take its power', when: NOT_CHOSEN, text: 'You tear its heart out.',
      effects: [
        { setFlag: 'flag_heartstone_chosen' }, { rep: { faction: 'weavers', delta: 15 } }, { rep: { faction: 'remnants', delta: -15 } },
        { clockWatches: -20 }, { giveItem: { item: 'item_heartstone_core' } },
      ],
    },
  ],
  safe: true,
  art: { template: 'cavern' },
  map: { x: 4, y: 9 },
};

const npcs: NpcInput[] = [
  {
    id: BORIN, name: 'Borin Stonefist', description: 'Fixture: the smith of the Emberforge.', factionId: 'ironclad', homeLocationId: FORGE,
    portrait: { sigil: 'anvil' }, roles: ['merchant', 'smith'], merchantId: BORIN,
  },
  {
    id: KAELEN, name: 'Kaelen Stonehand', description: 'Fixture: the keeper of the Respite.', homeLocationId: RESPITE,
    portrait: { sigil: 'tankard' }, roles: ['merchant'], merchantId: KAELEN,
  },
];

const merchants: MerchantInput[] = [
  {
    id: BORIN, npcId: BORIN, name: 'The Emberforge', repFaction: 'ironclad', services: ['buy', 'sell', 'upgrade'],
    stock: [
      { itemId: 'mat_iron_rivet', count: 5 },
      { itemId: 'item_glow_moss', count: 3 },
      { itemId: 'item_ember_flask', count: 2 },
      { itemId: 'item_void_shard', count: 2, priceMult: 2 },
      { itemId: 'item_ironclad_mail', rarity: 'rare', when: { rep: { faction: 'ironclad', min: 20 } } },
    ],
    rollStock: { pool: ['item_travelers_sword', 'item_nomads_maul', 'item_warriors_sword', 'item_ironclad_mail'], pick: { min: 3, max: 4 } },
  },
  {
    id: KAELEN, npcId: KAELEN, name: "The Wayfarer's Respite", repFaction: 'best',
    stock: [
      { itemId: 'item_ley_touched_tonic', count: 3 },
      { itemId: 'item_mana_bloom', count: 1 },
      { itemId: 'item_glow_moss', count: 3 },
      { itemId: 'mat_ley_resin', count: 'unlimited' },
      { itemId: 'mat_silverwood_heartwood', count: 1, when: { loop: { min: 2 } } },
    ],
    rollStock: {
      pool: ['item_rusty_dagger', 'item_travelers_sword', 'item_primitive_bow', 'item_apprentice_staff', 'item_wildling_hide_armor', 'item_ironclad_mail'],
      pick: { min: 3, max: 4 },
    },
  },
];

// ---- items --------------------------------------------------------------------------------------------------------------------

const mat = (id: ItemInput['id'], name: string, tier: number, value: number, extra: Partial<ItemInput> = {}): ItemInput => ({
  id, name, type: 'material', tier, value, description: `Fixture: ${name}.`, art: { icon: id.slice(4) }, ...extra,
});

const items: ItemInput[] = [
  mat('mat_ember_ore', 'Ember Ore', 2, 15),
  mat('mat_slate_core', 'Slate Core', 2, 12),
  mat('mat_ley_resin', 'Ley Resin', 1, 5),
  mat('mat_spire_thread', 'Spire Thread', 3, 15),
  mat('mat_glow_gland', 'Glow Gland', 3, 10),
  mat('mat_drowned_pearl', 'Drowned Pearl', 3, 25),
  mat('mat_skyreach_crystal', 'Skyreach Crystal', 4, 30),
  mat('mat_breach_glass', 'Breach Glass', 4, 30),
  mat('mat_silverwood_heartwood', 'Silverwood Heartwood', 5, 40),
  mat('mat_tyrant_shard', 'Tyrant Shard', 5, 120, { maxStack: 9 }),
  mat('item_aetherium_shard', 'Aetherium Shard', 3, 28, { legacyName: 'Aetherium Shard' }),
  mat('item_void_shard', 'Void Shard', 2, 20, { legacyName: 'Void Shard' }),
  {
    id: STABLE, name: 'Stable Heartstone Fragment', type: 'quest', tier: 0, value: 0, description: 'Fixture: a sliver of the quieted Heartstone.',
    art: { icon: 'fragment' },
  },
  {
    id: DEAD, name: 'Dead Heartstone Fragment', type: 'quest', tier: 0, value: 0, description: 'Fixture: a cold, grey sliver.', art: { icon: 'fragment' },
  },
  {
    id: PATTERN, name: 'Pattern: Breachsteel Blade', type: 'recipe', tier: 0, value: 40, description: 'Fixture: a smith’s drawing, annotated.',
    onUse: [{ unlockRecipe: 'recipe_breachsteel_blade' }], art: { icon: 'pattern' },
  },
  {
    id: 'item_lanternreed_salts', name: 'Lanternreed Salts', type: 'consumable', tier: 2, value: 30,
    description: 'Fixture: smelling salts that wake the fallen.', onUse: [{ revive: 0.3 }], art: { icon: 'salts' },
  },
  {
    id: 'item_warriors_sword', name: "Warrior's Sword", legacyName: "Warrior's Sword", type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 2,
    description: 'A well-balanced blade.', stats: { power: 7 }, value: 40, art: { icon: 'sword' },
  },
  {
    id: 'item_voidforged_edge', name: 'Voidforged Edge', type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 3,
    description: 'Fixture: black steel that drinks the light.', stats: { power: 12 }, passives: [{ kind: 'statusOnHit', status: 'status_curse', chance: 0.2, duration: 3 }],
    value: 150, art: { icon: 'sword' },
  },
  {
    id: 'item_breachsteel_blade', name: 'Breachsteel Blade', type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 5,
    description: 'Fixture: a blade forged from the edge of time.', stats: { power: 22 }, value: 500, art: { icon: 'sword' },
  },
  {
    id: 'item_sky_whisper_talisman', name: 'Sky-Whisper Talisman', legacyName: 'Sky-Whisper Talisman', type: 'trinket', slot: 'trinket', tier: 2,
    description: 'A feather-light charm that hums with high winds.', stats: { agility: 1 }, value: 32, art: { icon: 'talisman' }, tags: ['key'], anchorable: true,
  },
];

/** DESIGN §7.3 row (the combat pack has the Gale, Iron, Vigor and Echoes). */
const affixOfTheVoid: AffixInput = {
  id: 'affix_of_the_void', suffix: 'of the Void',
  weapon: { text: '15% chance on hit to apply Curse (3)', passives: [{ kind: 'statusOnHit', status: 'status_curse', chance: 0.15, duration: 3 }] },
  armor: { text: 'one step vs Void', resistSteps: ['void'] },
  trinket: { text: '+10% Void damage dealt', passives: [{ kind: 'damageBonus', damageType: 'void', pct: 0.1 }] },
};

// ---- recipes and the quests that waive the anchor's gate ------------------------------------------------------------------------

const recipes: RecipeInput[] = [
  {
    id: 'recipe_breach_anchor', name: 'Breach-anchor', category: 'quest', story: true, gold: 0,
    inputs: [
      { itemId: 'item_aetherium_shard', count: 3 }, { itemId: 'item_void_shard', count: 3 }, { itemId: 'mat_ember_ore', count: 3 },
      { itemId: 'mat_silverwood_heartwood', count: 1 },
    ],
    anyOf: [[{ itemId: STABLE, count: 1 }], [{ itemId: DEAD, count: 1 }]],
    output: { itemId: ANCHOR },
    repTier: 'trusted',
    repTierWhileActive: { quests: ['q_the_mending', 'q_iron_silence'], tier: 'neutral' },
    requires: { echo: 'echo_anchor_schema' },
  },
  {
    id: 'recipe_voidforged_edge', name: 'Voidforged Edge', category: 'weapon', gold: 120,
    inputs: [{ itemId: 'item_void_shard', count: 3 }, { itemId: 'mat_ember_ore', count: 3 }, { itemId: 'mat_iron_rivet', count: 2 }],
    output: { itemId: 'item_voidforged_edge' },
    // "trusted (or echo_borin_oath)" said as a condition: the tier gate stays Neutral
    requires: { all: [{ flag: 'flag_shards_refused' }, { any: [{ rep: { faction: 'ironclad', min: 20 } }, { echo: 'echo_borin_oath' }] }] },
  },
  {
    id: 'recipe_ember_flask', name: 'Ember Flask', category: 'consumable', gold: 20,
    inputs: [{ itemId: 'mat_ember_ore', count: 1 }, { itemId: 'mat_ley_resin', count: 1 }],
    output: { itemId: 'item_ember_flask', count: 2 },
  },
  {
    id: 'recipe_breachsteel_blade', name: 'Breachsteel Blade', category: 'weapon', gold: 280,
    inputs: [
      { itemId: 'mat_ember_ore', count: 5 }, { itemId: 'mat_breach_glass', count: 2 }, { itemId: 'mat_frayed_moment', count: 2 },
      { itemId: 'mat_silverwood_heartwood', count: 1 },
    ],
    output: { itemId: 'item_breachsteel_blade' },
    requiresItemRead: PATTERN,
  },
];

const anchorQuest = (id: QuestInput['id'], name: string): QuestInput => ({
  id, name, description: `Fixture: ${name}.`, category: 'ending', botHint: 'explorer',
  stages: [
    { id: 'forge', journal: 'Fixture: have Borin forge the anchor.', objectives: [{ id: 'obj_anchor', text: 'Forge the Breach-anchor', when: { item: { id: ANCHOR } } }], next: 'done' },
    { id: 'done', journal: 'Fixture: the anchor is forged.', outcome: 'complete' },
  ],
});

const echo = (id: EchoInput['id'], name: string): EchoInput => ({ id, name, codexLine: `Fixture: ${name}.`, category: 'lore', obtainedBy: ['fixture'] });

const factions: FactionInput[] = [
  {
    id: 'ironclad', name: 'Ironclad Nomads', shortName: 'Ironclad', description: 'Fixture: the caravans of the Reach.', color: '#b5651d',
    tierTexts: { hostile: 'Fixture: hostile.', wary: 'Fixture: wary.', neutral: 'Fixture: neutral.', trusted: 'Fixture: trusted.', sworn: 'Fixture: sworn.' },
  },
  {
    id: 'weavers', name: 'Shadow Weavers', shortName: 'Weavers', description: 'Fixture: the hooded.', color: '#5b2a86',
    tierTexts: { hostile: 'Fixture: hostile.', wary: 'Fixture: wary.', neutral: 'Fixture: neutral.', trusted: 'Fixture: trusted.', sworn: 'Fixture: sworn.' },
  },
];

// ---- assembly -----------------------------------------------------------------------------------------------------------------------

export function economyTables(): ContentTables {
  const base = combatTables((t) => {
    for (const loc of t.locations) {
      if (loc.id === MISTWOOD) loc.exits = [...(loc.exits ?? []), { dir: 'east', to: RESPITE }];
      if (loc.id === 'loc_whispering_ruins') loc.exits = [...(loc.exits ?? []), { dir: 'down', to: HEARTSTONE }];
    }
    t.locations.push(clone(respite), clone(forge), clone(heartstoneDepths));
  });
  return {
    ...base,
    items: [...base.items, ...items],
    affixes: [...base.affixes, affixOfTheVoid],
    recipes: [...base.recipes, ...recipes],
    quests: [...base.quests, anchorQuest('q_the_mending', 'The Mending'), anchorQuest('q_iron_silence', 'Iron Silence')],
    echoes: [...base.echoes, echo('echo_anchor_schema', "The Anchor's Design"), echo('echo_borin_oath', "Borin's Oath"), echo('echo_kaelen_ledger', "Kaelen's Ledger")],
    npcs: [...base.npcs, ...npcs],
    merchants: [...base.merchants, ...merchants],
    factions: [...base.factions, ...factions],
    attunements: thresholdAttunements.filter((a) => a.id === 'att_borins_favor' || a.id === 'att_kaelens_ledger'),
  };
}

let cached: ContentPack | null = null;

/** The economy pack (cached, frozen; parsed by every schema, cross-reference validation skipped — see the header). */
export function economyPack(): ContentPack {
  cached ??= deepFreeze(buildContentPack(economyTables(), { version: FIXTURE_VERSION, validate: false }));
  return cached;
}

/** WORLD §9.2 `npc_bellwright_anso` (no faction, ×1.2), standing at the Outer Walks in the fixture's compressed Before. */
export function beforeEconomyTables(): ContentTables {
  const base = beforeTables();
  return {
    ...base,
    locations: base.locations.map((loc) => (loc.id === WALKS ? { ...clone(loc), npcs: [...(loc.npcs ?? []), ANSO], merchantId: ANSO } : loc)),
    npcs: [
      ...base.npcs,
      { id: ANSO, name: 'Bellwright Anso', description: 'Fixture: the bell-maker of the Plaza of Bells.', homeLocationId: WALKS, portrait: { sigil: 'bell' }, roles: ['merchant'], merchantId: ANSO },
    ],
    merchants: [
      ...base.merchants,
      {
        id: ANSO, npcId: ANSO, name: 'Plaza of Bells', regionMarkup: 1.2,
        stock: [{ itemId: 'item_mana_bloom', count: 2 }, { itemId: 'item_ley_touched_tonic', count: 3 }, { itemId: 'item_glow_moss', count: 3 }],
        rollStock: { pool: ['item_glyphbound_lantern', 'item_apprentice_staff', 'item_rusty_dagger', 'item_wildling_hide_armor'], pick: { min: 1, max: 2 } },
      },
    ],
  };
}

let cachedBefore: ContentPack | null = null;

/** The Before pack with Anso's stall (cached, frozen, unvalidated like the Before pack). */
export function beforeEconomyPack(): ContentPack {
  cachedBefore ??= deepFreeze(buildContentPack(beforeEconomyTables(), { version: FIXTURE_VERSION, validate: false }));
  return cachedBefore;
}
