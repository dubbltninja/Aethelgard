// MERCHANTS (U50) — the eight stalls of WORLD §9 (§9.1 pricing and tiers, §9.2 stock; DESIGN §9.2–9.4, §11.4), in WORLD's order. A
// merchant is keyed by its NPC id (`id` = `npcId`); where it stands and when is the NPCs' and locations' (npcs/, regions/).
//   core       WORLD's "Core" line, with its counts: always on the shelf, refilled at dawn (Anso's dawn is each Before day).
//   pool       WORLD's "Pool" line: `rollStock` picks 3-4 of the named items a day (never more than the pool holds); a Wary standing
//              shows core stock only (the engine's `poolOpen`). Gear rolls its rarity by the band weights.
//   Trusted    a `when: { rep: { faction, min: 20 } }` core entry at `rarity: 'rare'` (the fixture's form, Borin's Ironclad Mail).
//              WORLD names the affix too ("at fixed Rare (affix_of_ley)"), which a stock entry cannot say: the Rare piece rolls its
//              one affix. Closest faithful; listed in the U50 reply. Patterns (`item_pattern_…`) sit in the same gated lines.
//   Sworn      `mat_umbral_thread ×3` (Hollis) and the shardglass are stock; the "gift, once per loop" pieces (the Archivist's Circlet,
//              the Oathplate) are the dialogue's to give: a stock line refills at every dawn, a gift does not.
//   Loop 2+ / Days 1-2   a core entry with a `when` (the schema has none for pool entries): present whenever the condition holds
//              rather than a random pick. Applies to Kaelen's lantern and heartwood, Tamsin's ink, Fennick's heartwood-bow pattern,
//              Anso's Bell Shard and Breachwarden pattern.
//   markup, faction   `regionMarkup` and `repFaction` are §9.1's table (Kaelen 'best', Fennick and Anso none).
// What the schema cannot say (the U50 reply lists each): what a merchant buys by category (§9.1 "Buys": every stall buys anything
// sellable), affix bias in a pool, the quantity of a pooled material (a pick is one unit), a free entry, "free for q_blood_and_salt
// outcome A" (Kaelen's salt), and a flat price (the Veil Sigil is 30 g at Neutral, not at every tier).
import type { Condition } from '@schema/condition';
import type { MerchantInput } from '@schema/merchant';

type Faction = 'remnants' | 'weavers' | 'ironclad';
/** Rep ≥ 20 is Trusted, ≥ 60 Sworn (DESIGN §11.1). */
const trusted = (faction: Faction): Condition => ({ rep: { faction, min: 20 } });
const sworn = (faction: Faction): Condition => ({ rep: { faction, min: 60 } });
const LOOP_2_PLUS: Condition = { loop: { min: 2 } };
const BEFORE_DAYS_1_2: Condition = { any: [{ beforeDay: 1 }, { beforeDay: 2 }] };

export const merchants = [
  {
    // DESIGN `npc_kaelen`: neutral ground, the best of the three tiers, never refuses; buys anything non-quest at 75%
    id: 'npc_kaelen_stonehand',
    npcId: 'npc_kaelen_stonehand',
    name: "The Wayfarer's Respite",
    regionMarkup: 1.0,
    repFaction: 'best',
    stock: [
      { itemId: 'item_ley_touched_tonic', count: 3 },
      { itemId: 'item_mana_bloom', count: 1 },
      { itemId: 'item_antidote_root', count: 2 },
      { itemId: 'item_glow_moss', count: 3 },
      { itemId: 'mat_steppe_salt', count: 2 },
      { itemId: 'mat_ley_resin', count: 3 },
      // the Glyphbound Lantern is the Drowned Reach's dark-gate key: always Common, so it is never a roll away (WORLD §3.6)
      { itemId: 'item_glyphbound_lantern', count: 1, rarity: 'common', when: LOOP_2_PLUS },
      // "a cartwright's offcut, older than the cart" (D-067.6: heartwood is never Before-only)
      { itemId: 'mat_silverwood_heartwood', count: 1, when: LOOP_2_PLUS },
    ],
    // WORLD §9.2's Pool line: its explicit list. The rule before it ("any T1-T2 weapon or armor that is not quest-locked, except the
    // Warrior's Sword and the Shadow-Kissed Dagger") would also admit the Scrap Harness and the Diver's Coat, whose own Sources (WORLD
    // §7) never name Kaelen: two places against one, so the list wins (U34e, D-101; pinned in tests/unit/content/items/economy.test.ts)
    rollStock: {
      pool: [
        'item_rusty_dagger',
        'item_travelers_sword',
        'item_primitive_bow',
        'item_elven_bow',
        'item_apprentice_staff',
        'item_necromancer_staff',
        'item_nomads_maul',
        'item_ironclad_hammer',
        'item_cracked_void_focus',
        'item_chasmglass_focus',
        'item_wildling_hide_armor',
        'item_scribes_robe',
        'item_ironclad_mail',
        'item_steppe_lamellar',
      ],
      pick: { min: 3, max: 4 },
    },
  },
  {
    // DESIGN `npc_remnant_archivist`: the Remnant stall (absent while the Plaza is Horde-infected, at the Library from Loop 2)
    id: 'npc_tamsin_reed',
    npcId: 'npc_tamsin_reed',
    name: 'Silverwood Plaza',
    regionMarkup: 1.0,
    repFaction: 'remnants',
    stock: [
      { itemId: 'item_glow_moss', count: 3 },
      { itemId: 'item_ley_touched_tonic', count: 2 },
      { itemId: 'item_chronal_dust', count: 2 },
      { itemId: 'item_remnant_ink', count: 2, when: LOOP_2_PLUS },
      // Trusted: the Remnant Ley gear of DESIGN §11.4 (WORLD: fixed Rare, affix_of_ley)
      { itemId: 'item_scriptorium_staff', count: 1, rarity: 'rare', when: trusted('remnants') },
      { itemId: 'item_pattern_conflux_robe', count: 1, when: trusted('remnants') },
    ],
    // staves T1-T3 and the robe; WORLD's "rolled trinkets with affix_of_ley / affix_of_echoes bias" names no item
    rollStock: { pool: ['item_apprentice_staff', 'item_necromancer_staff', 'item_scriptorium_staff', 'item_scribes_robe'], pick: { min: 3, max: 4 } },
  },
  {
    // the crafter (the Emberforge, WORLD §8) and, with Tessaly, DESIGN's `npc_ironclad_quartermaster`; upgrades are his service
    id: 'npc_borin_stonefist',
    npcId: 'npc_borin_stonefist',
    name: 'The Emberforge',
    regionMarkup: 1.0,
    repFaction: 'ironclad',
    services: ['buy', 'sell', 'upgrade'],
    stock: [
      { itemId: 'mat_iron_rivet', count: 5 },
      { itemId: 'item_ward_salts', count: 2 },
      { itemId: 'mat_steppe_salt', count: 2 },
      { itemId: 'item_glow_moss', count: 3 },
      { itemId: 'item_ley_touched_tonic', count: 2 },
      { itemId: 'item_ember_flask', count: 2 },
      // Trusted: WORLD "item_ironclad_hammer at fixed Rare (affix_of_iron)"
      { itemId: 'item_ironclad_hammer', count: 1, rarity: 'rare', when: trusted('ironclad') },
    ],
    // heavy weapons and medium/heavy armor T1-T3 (WORLD: with an affix_of_iron / affix_of_the_warden bias) and the whetstone strip
    rollStock: {
      pool: [
        'item_nomads_maul',
        'item_ironclad_hammer',
        'item_warriors_sword',
        'item_scrap_harness',
        'item_ironclad_mail',
        'item_steppe_lamellar',
        'item_whetstone_strip',
      ],
      pick: { min: 3, max: 4 },
    },
  },
  {
    // Drowned Reach: diver gear made off-screen, no crafting UI
    id: 'npc_sedge_marrow',
    npcId: 'npc_sedge_marrow',
    name: "Lamplighters' Rest",
    regionMarkup: 1.1,
    repFaction: 'remnants',
    stock: [
      { itemId: 'item_glow_moss', count: 3 },
      { itemId: 'item_brine_draught', count: 3 },
      { itemId: 'item_lantern_oil', count: 3 },
      { itemId: 'item_antidote_root', count: 2 },
      { itemId: 'item_ley_touched_tonic', count: 2 },
      // Trusted: WORLD "item_divers_coat at fixed Rare (affix_of_vigor)"
      { itemId: 'item_divers_coat', count: 1, rarity: 'rare', when: trusted('remnants') },
    ],
    // WORLD lists the pearl ×1 and the vellum ×2: a pooled material is one unit when it is picked
    rollStock: {
      pool: ['item_divers_coat', 'item_scriptorium_staff', 'item_scribes_robe', 'item_wildling_hide_armor', 'mat_drowned_pearl', 'mat_sodden_vellum'],
      pick: { min: 3, max: 4 },
    },
  },
  {
    // the Hearthring, and the caravan at the Ironclad Camp after `flag_hearthring_caravan` (core only; the NPC's schedule moves her)
    id: 'npc_tessaly_varr',
    npcId: 'npc_tessaly_varr',
    name: 'Hearthring',
    regionMarkup: 1.0,
    repFaction: 'ironclad',
    stock: [
      { itemId: 'item_glow_moss', count: 3 },
      { itemId: 'item_nomad_hardtack', count: 3 },
      { itemId: 'item_hearth_broth', count: 2 },
      { itemId: 'item_ward_salts', count: 2 },
      { itemId: 'item_storm_jar', count: 2 },
      { itemId: 'mat_steppe_salt', count: 3 },
      { itemId: 'mat_iron_rivet', count: 3 },
      { itemId: 'mat_ember_ore', count: 3 },
      // Trusted: DESIGN §11.4's Ironclad plate (WORLD: fixed Rare, affix_of_the_warden)
      { itemId: 'item_cinderhorn_plate', count: 1, rarity: 'rare', when: trusted('ironclad') },
      { itemId: 'item_pattern_sunderforged_plate', count: 1, when: trusted('ironclad') },
    ],
    rollStock: {
      pool: ['item_nomad_sabre', 'item_harrier_bow', 'item_ironclad_hammer', 'item_steppe_lamellar', 'item_cinderhorn_plate', 'item_whetstone_strip'],
      pick: { min: 3, max: 4 },
    },
  },
  {
    // DESIGN `npc_mireya_stall`: belongs to no faction (x1.0, never refuses)
    id: 'npc_old_fennick',
    npcId: 'npc_old_fennick',
    name: 'Lanternreed',
    regionMarkup: 1.1,
    stock: [
      { itemId: 'item_glow_moss', count: 5 },
      { itemId: 'item_antidote_root', count: 3 },
      { itemId: 'item_lanternreed_salts', count: 1 },
      { itemId: 'item_fenlight_salve', count: 2 },
      { itemId: 'item_pattern_heartwood_bow', count: 1, when: LOOP_2_PLUS },
    ],
    // light armor and bows T2-T3, and the herbs
    rollStock: {
      pool: ['item_elven_bow', 'item_harrier_bow', 'item_scribes_robe', 'item_divers_coat', 'item_stillwater_phial', 'item_fenlight_salve'],
      pick: { min: 3, max: 4 },
    },
  },
  {
    // DESIGN `npc_veil_vendor` (formerly WORLD's npc_hollis_vane, D-064). Trades only if Weavers >= Neutral or Corruption >= 3 (DESIGN §9.4)
    id: 'npc_hollis_cade',
    npcId: 'npc_hollis_cade',
    name: 'Sanctum of Threads',
    regionMarkup: 1.2,
    repFaction: 'weavers',
    refusesWhen: { not: { any: [{ rep: { faction: 'weavers', min: -9 } }, { corruption: { min: 3 } }] } },
    stock: [
      { itemId: 'item_dark_spellbook', count: 1 },
      // "expensive": priced at 2x gold_value (DESIGN §9 in U8)
      { itemId: 'item_void_shard', count: 2, priceMult: 2 },
      { itemId: 'item_glow_moss', count: 3 },
      { itemId: 'item_ley_touched_tonic', count: 3 },
      { itemId: 'item_chronal_dust', count: 2 },
      // "30 g flat, the Veil tithe": 30 g at Neutral (value 30 x markup 1.2 x 5/6); the tier mods still apply
      { itemId: 'item_veil_sigil', count: 1, priceMult: 5 / 6 },
      // Trusted: DESIGN §11.4's Weaver focus (WORLD: fixed Rare, affix_of_the_void)
      { itemId: 'item_veil_threadmail', count: 1, when: trusted('weavers') },
      { itemId: 'item_hollow_lantern_focus', count: 1, rarity: 'rare', when: trusted('weavers') },
      { itemId: 'item_pattern_breachglass_focus', count: 1, when: trusted('weavers') },
      // Sworn: "if not taken from loc_where_she_fell this loop" is read as "not carried"; and the Weavers' thread
      { itemId: 'item_nyxs_shardglass', count: 1, when: { all: [sworn('weavers'), { not: { item: { id: 'item_nyxs_shardglass' } } }] } },
      { itemId: 'mat_umbral_thread', count: 3, when: sworn('weavers') },
    ],
    // void focuses; WORLD's "affix_of_the_void gear: rolled armor/trinkets" names no item
    rollStock: { pool: ['item_chasmglass_focus', 'item_hollow_lantern_focus', 'item_cracked_void_focus'], pick: { min: 3, max: 4 } },
  },
  {
    // Silverwood Before: belongs to no faction; restocks at each Before day (an engine rule)
    id: 'npc_bellwright_anso',
    npcId: 'npc_bellwright_anso',
    name: 'Plaza of Bells',
    regionMarkup: 1.2,
    stock: [
      { itemId: 'item_silverwood_honeycake', count: 3 },
      { itemId: 'item_mana_bloom', count: 2 },
      { itemId: 'item_ley_touched_tonic', count: 3 },
      { itemId: 'item_glow_moss', count: 3 },
      // Days 1-2: the Bell Shard (a rolled charm) and the pacifist route's pattern
      { itemId: 'item_bell_shard', count: 1, when: BEFORE_DAYS_1_2 },
      { itemId: 'item_pattern_breachwarden_mail', count: 1, when: BEFORE_DAYS_1_2 },
    ],
    // "rolled T3-T4 trinkets": the one rolled, non-key trinket of those tiers is the Salt Charm (WORLD's affix bias unsaid)
    rollStock: { pool: ['item_salt_charm'], pick: { min: 0, max: 1 } },
  },
] satisfies MerchantInput[];
