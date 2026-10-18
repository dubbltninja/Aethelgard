// RECIPES (U50) — the 30 recipes of WORLD §8.2, in its order (DESIGN §8.1 format, §8.5 special recipes). Borin Stonefist at the Emberforge
// is the only crafter, so there is no station field. Inputs are WORLD's exact counts; the fee is Borin's before `att_borins_favor`.
//   output       Common unless WORLD says otherwise: every gear output says `rarity: 'common'` (the Bell-Warden's Clapper item is a
//                fixed Rare, so its recipe has to; "the boss copy is Rare"). Consumables stack to the row's count.
//   repTier      WORLD's "Rep" column. The three void-forged recipes say "trusted (or `echo_borin_oath`)": the tier gate stays
//                Neutral and the condition says "Ironclad ≥ Trusted, or the Echo" — the fixture's form (tests/fixtures/economyContent.ts).
//   requires     the row's flag or Echo (the Heartstone flags are per loop); `requiresItemRead` is the pattern a row says "read".
//   story        the Breach-anchor only (D-066 #10): no fee, its Trusted gate drops to Neutral while the Mending or the Iron Silence is
//                the quest being played (DESIGN §8.5), `anyOf` the stable or the dead Heartstone fragment (D-052).
//   timeCost     the default 1: the first craft per visit costs a watch, later ones none (DESIGN §8.1).
import type { Condition } from '@schema/condition';
import type { RecipeInput } from '@schema/recipe';

/** The Void Shards were refused to Nyx this loop, and Borin trusts you (Ironclad Trusted, rep 20) or you remember his oath. */
const VOID_FORGED_GATE: Condition = {
  all: [{ flag: 'flag_shards_refused' }, { any: [{ rep: { faction: 'ironclad', min: 20 } }, { echo: 'echo_borin_oath' }] }],
};
/** Ley-tuned crafting is open only in a loop where the Heartstone was Stabilized (D-017). */
const HEARTSTONE_STABILIZED: Condition = { flag: 'flag_heartstone_stabilized' };

export const recipes = [
  // ---- the Breach-anchor and the void-forged line (DESIGN §8.5) --------------------------------------------------------------------
  {
    id: 'recipe_breach_anchor',
    name: 'Breach-anchor',
    category: 'quest',
    story: true,
    gold: 0,
    inputs: [
      { itemId: 'item_aetherium_shard', count: 3 },
      { itemId: 'item_void_shard', count: 3 },
      { itemId: 'mat_ember_ore', count: 3 },
      { itemId: 'mat_silverwood_heartwood', count: 1 },
    ],
    anyOf: [[{ itemId: 'item_heartstone_fragment_stable', count: 1 }], [{ itemId: 'item_heartstone_fragment_dead', count: 1 }]],
    output: { itemId: 'item_breach_anchor' },
    repTier: 'trusted',
    repTierWhileActive: { quests: ['q_the_mending', 'q_iron_silence'], tier: 'neutral' },
    requires: { echo: 'echo_anchor_schema' },
  },
  {
    id: 'recipe_voidforged_edge',
    name: 'Void-forged Edge',
    category: 'weapon',
    gold: 120,
    inputs: [
      { itemId: 'item_void_shard', count: 3 },
      { itemId: 'mat_ember_ore', count: 3 },
      { itemId: 'mat_iron_rivet', count: 2 },
    ],
    output: { itemId: 'item_voidforged_edge', rarity: 'common' },
    requires: VOID_FORGED_GATE,
  },
  {
    id: 'recipe_voidforged_mail',
    name: 'Void-forged Mail',
    category: 'armor',
    gold: 150,
    inputs: [
      { itemId: 'item_void_shard', count: 4 },
      { itemId: 'mat_slate_core', count: 2 },
      { itemId: 'mat_ember_ore', count: 3 },
    ],
    output: { itemId: 'item_voidforged_mail', rarity: 'common' },
    requires: VOID_FORGED_GATE,
  },
  {
    id: 'recipe_voidforged_band',
    name: 'Void-forged Band',
    category: 'trinket',
    gold: 90,
    inputs: [
      { itemId: 'item_void_shard', count: 2 },
      { itemId: 'mat_breach_glass', count: 1 },
    ],
    output: { itemId: 'item_voidforged_band', rarity: 'common' },
    requires: VOID_FORGED_GATE,
  },
  // ---- the Ley-tuned line (D-017) -----------------------------------------------------------------------------------------------
  {
    id: 'recipe_ley_tuned_staff',
    name: 'Ley-tuned Staff',
    category: 'weapon',
    gold: 140,
    inputs: [
      { itemId: 'mat_ley_spark', count: 3 },
      { itemId: 'item_aetherium_shard', count: 1 },
      { itemId: 'mat_ley_resin', count: 2 },
    ],
    output: { itemId: 'item_ley_tuned_staff', rarity: 'common' },
    requires: HEARTSTONE_STABILIZED,
  },
  {
    id: 'recipe_ley_tuned_vestment',
    name: 'Ley-tuned Vestment',
    category: 'armor',
    gold: 160,
    inputs: [
      { itemId: 'mat_ley_spark', count: 2 },
      { itemId: 'item_aetherium_shard', count: 1 },
      { itemId: 'mat_ley_resin', count: 3 },
      { itemId: 'mat_spire_thread', count: 1 },
    ],
    output: { itemId: 'item_ley_tuned_vestment', rarity: 'common' },
    requires: HEARTSTONE_STABILIZED,
  },
  {
    id: 'recipe_ley_tuned_charm',
    name: 'Ley-tuned Charm',
    category: 'trinket',
    gold: 120,
    inputs: [
      { itemId: 'mat_ley_spark', count: 2 },
      { itemId: 'item_aetherium_shard', count: 2 },
    ],
    output: { itemId: 'item_ley_tuned_charm', rarity: 'common' },
    requires: HEARTSTONE_STABILIZED,
  },
  {
    id: 'recipe_ley_tuned_tonic',
    name: 'Ley-tuned Tonic',
    category: 'consumable',
    gold: 80,
    inputs: [
      { itemId: 'mat_ley_spark', count: 1 },
      { itemId: 'mat_ley_resin', count: 1 },
      { itemId: 'item_glow_moss', count: 1 },
    ],
    output: { itemId: 'item_ley_tuned_tonic', count: 3 },
    requires: HEARTSTONE_STABILIZED,
  },
  // ---- throwables and tonics (DESIGN §8.5) -------------------------------------------------------------------------------------------
  {
    id: 'recipe_storm_jar',
    name: 'Storm Jar',
    category: 'consumable',
    gold: 25,
    inputs: [
      { itemId: 'mat_ley_spark', count: 2 },
      { itemId: 'mat_iron_rivet', count: 1 },
    ],
    output: { itemId: 'item_storm_jar', count: 2 },
  },
  {
    id: 'recipe_ember_flask',
    name: 'Ember Flask',
    category: 'consumable',
    gold: 20,
    inputs: [
      { itemId: 'mat_ember_ore', count: 1 },
      { itemId: 'mat_ley_resin', count: 1 },
    ],
    output: { itemId: 'item_ember_flask', count: 2 },
  },
  {
    id: 'recipe_antidote_root',
    name: 'Antidote Root',
    category: 'consumable',
    gold: 15,
    inputs: [
      { itemId: 'mat_rootbone', count: 1 },
      { itemId: 'mat_ley_resin', count: 1 },
    ],
    output: { itemId: 'item_antidote_root', count: 3 },
  },
  {
    id: 'recipe_ward_salts',
    name: 'Ward Salts',
    category: 'consumable',
    gold: 30,
    inputs: [
      { itemId: 'mat_steppe_salt', count: 2 },
      { itemId: 'mat_shadow_ash', count: 1 },
    ],
    output: { itemId: 'item_ward_salts', count: 2 },
  },
  // ---- Loop-1 crafts: one per weapon type at T3, and the gate lantern (§9.6) ---------------------------------------------------------
  {
    // a gate item: no fee, so the Drowned Reach's dark gate never waits on gold (WORLD §9.6 rule 5)
    id: 'recipe_glyphbound_lantern',
    name: 'Glyphbound Lantern',
    category: 'trinket',
    gold: 0,
    inputs: [
      { itemId: 'mat_ley_spark', count: 2 },
      { itemId: 'mat_iron_rivet', count: 1 },
    ],
    output: { itemId: 'item_glyphbound_lantern', rarity: 'common' },
  },
  {
    id: 'recipe_nomad_sabre',
    name: 'Nomad Sabre',
    category: 'weapon',
    gold: 70,
    inputs: [
      { itemId: 'mat_ember_ore', count: 2 },
      { itemId: 'mat_cinder_horn', count: 2 },
      { itemId: 'mat_iron_rivet', count: 2 },
    ],
    output: { itemId: 'item_nomad_sabre', rarity: 'common' },
  },
  {
    id: 'recipe_harrier_bow',
    name: 'Harrier Bow',
    category: 'weapon',
    gold: 70,
    inputs: [
      { itemId: 'mat_gale_feather', count: 2 },
      { itemId: 'mat_rootbone', count: 2 },
      { itemId: 'mat_storm_glass', count: 1 },
    ],
    output: { itemId: 'item_harrier_bow', rarity: 'common' },
  },
  {
    id: 'recipe_scriptorium_staff',
    name: 'Scriptorium Staff',
    category: 'weapon',
    gold: 70,
    inputs: [
      { itemId: 'mat_sodden_vellum', count: 3 },
      { itemId: 'mat_ley_spark', count: 2 },
      { itemId: 'mat_rootbone', count: 1 },
    ],
    output: { itemId: 'item_scriptorium_staff', rarity: 'common' },
  },
  {
    // "Common; the boss copy is Rare": the item is a fixed Rare (affix_of_moments), so the recipe overrides it (U49 flagged this)
    id: 'recipe_bell_clapper',
    name: "Bell-Warden's Clapper",
    category: 'weapon',
    gold: 80,
    inputs: [
      { itemId: 'mat_bell_bronze', count: 3 },
      { itemId: 'mat_iron_rivet', count: 2 },
      { itemId: 'mat_ember_ore', count: 2 },
    ],
    output: { itemId: 'item_bell_clapper', rarity: 'common' },
  },
  {
    id: 'recipe_hollow_lantern_focus',
    name: 'Hollow Lantern Focus',
    category: 'weapon',
    gold: 80,
    inputs: [
      { itemId: 'mat_umbral_thread', count: 1 },
      { itemId: 'mat_glow_gland', count: 2 },
      { itemId: 'mat_shadow_ash', count: 2 },
    ],
    output: { itemId: 'item_hollow_lantern_focus', rarity: 'common' },
  },
  // ---- T3-T4 crafts ------------------------------------------------------------------------------------------------------------
  {
    id: 'recipe_cinderhorn_plate',
    name: 'Cinderhorn Plate',
    category: 'armor',
    gold: 100,
    inputs: [
      { itemId: 'mat_cinder_horn', count: 3 },
      { itemId: 'mat_iron_rivet', count: 3 },
      { itemId: 'mat_slate_core', count: 1 },
    ],
    output: { itemId: 'item_cinderhorn_plate', rarity: 'common' },
  },
  {
    id: 'recipe_emberwrought_blade',
    name: 'Emberwrought Blade',
    category: 'weapon',
    gold: 160,
    inputs: [
      { itemId: 'mat_ember_ore', count: 4 },
      { itemId: 'mat_cinder_horn', count: 2 },
      { itemId: 'mat_slate_core', count: 2 },
    ],
    output: { itemId: 'item_emberwrought_blade', rarity: 'common' },
    repTier: 'trusted',
  },
  {
    id: 'recipe_galefeather_bow',
    name: 'Galefeather Bow',
    category: 'weapon',
    gold: 160,
    inputs: [
      { itemId: 'mat_gale_feather', count: 4 },
      { itemId: 'mat_skyreach_crystal', count: 1 },
      { itemId: 'mat_storm_glass', count: 2 },
    ],
    output: { itemId: 'item_galefeather_bow', rarity: 'common' },
  },
  {
    id: 'recipe_spireweave_mantle',
    name: 'Spireweave Mantle',
    category: 'armor',
    gold: 160,
    inputs: [
      { itemId: 'mat_spire_thread', count: 3 },
      { itemId: 'mat_gale_feather', count: 2 },
      { itemId: 'mat_ley_resin', count: 2 },
    ],
    output: { itemId: 'item_spireweave_mantle', rarity: 'common' },
  },
  // ---- T5 capstones: each needs a read pattern (Borin's Patterns, WORLD §7.12) -----------------------------------------------------
  {
    id: 'recipe_breachsteel_blade',
    name: 'Breachsteel Blade',
    category: 'weapon',
    gold: 280,
    inputs: [
      { itemId: 'mat_ember_ore', count: 5 },
      { itemId: 'mat_breach_glass', count: 2 },
      { itemId: 'mat_frayed_moment', count: 2 },
      { itemId: 'mat_silverwood_heartwood', count: 1 },
    ],
    output: { itemId: 'item_breachsteel_blade', rarity: 'common' },
    requiresItemRead: 'item_pattern_breachsteel_blade',
  },
  {
    id: 'recipe_heartwood_bow',
    name: 'Heartwood Bow',
    category: 'weapon',
    gold: 260,
    inputs: [
      { itemId: 'mat_silverwood_heartwood', count: 2 },
      { itemId: 'mat_gale_feather', count: 3 },
      { itemId: 'mat_frayed_moment', count: 1 },
    ],
    output: { itemId: 'item_heartwood_bow', rarity: 'common' },
    requiresItemRead: 'item_pattern_heartwood_bow',
  },
  {
    id: 'recipe_hour_spindle',
    name: 'Hour Spindle',
    category: 'weapon',
    gold: 280,
    inputs: [
      { itemId: 'mat_silverwood_heartwood', count: 1 },
      { itemId: 'mat_frayed_moment', count: 3 },
      { itemId: 'item_chronal_dust', count: 2 },
      { itemId: 'item_aetherium_shard', count: 1 },
    ],
    output: { itemId: 'item_hour_spindle', rarity: 'common' },
    requiresItemRead: 'item_pattern_hour_spindle',
  },
  {
    // read the pattern, and Hallow's ember must be in you (Borin gives the pattern with `echo_hallows_ember`)
    id: 'recipe_hallows_hammer',
    name: "Hallow's Hammer",
    category: 'weapon',
    gold: 300,
    inputs: [
      { itemId: 'mat_ember_ore', count: 6 },
      { itemId: 'mat_iron_rivet', count: 4 },
      { itemId: 'mat_cinder_horn', count: 2 },
      { itemId: 'mat_silverwood_heartwood', count: 1 },
    ],
    output: { itemId: 'item_hallows_hammer', rarity: 'common' },
    repTier: 'trusted',
    requires: { echo: 'echo_hallows_ember' },
    requiresItemRead: 'item_pattern_hallows_hammer',
  },
  {
    id: 'recipe_breachglass_focus',
    name: 'Breachglass Focus',
    category: 'weapon',
    gold: 280,
    inputs: [
      { itemId: 'mat_breach_glass', count: 3 },
      { itemId: 'mat_umbral_thread', count: 2 },
      { itemId: 'item_void_shard', count: 2 },
    ],
    output: { itemId: 'item_breachglass_focus', rarity: 'common' },
    requiresItemRead: 'item_pattern_breachglass_focus',
  },
  {
    id: 'recipe_conflux_robe',
    name: 'Conflux Robe',
    category: 'armor',
    gold: 260,
    inputs: [
      { itemId: 'mat_silverwood_heartwood', count: 1 },
      { itemId: 'mat_spire_thread', count: 3 },
      { itemId: 'mat_drowned_pearl', count: 2 },
      { itemId: 'item_aetherium_shard', count: 1 },
    ],
    output: { itemId: 'item_conflux_robe', rarity: 'common' },
    requiresItemRead: 'item_pattern_conflux_robe',
  },
  {
    id: 'recipe_sunderforged_plate',
    name: 'Sunderforged Plate',
    category: 'armor',
    gold: 300,
    inputs: [
      { itemId: 'mat_ember_ore', count: 6 },
      { itemId: 'mat_slate_core', count: 3 },
      { itemId: 'mat_breach_glass', count: 2 },
      { itemId: 'mat_silverwood_heartwood', count: 1 },
    ],
    output: { itemId: 'item_sunderforged_plate', rarity: 'common' },
    repTier: 'trusted',
    requiresItemRead: 'item_pattern_sunderforged_plate',
  },
  {
    id: 'recipe_breachwarden_mail',
    name: 'Breachwarden Mail',
    category: 'armor',
    gold: 280,
    inputs: [
      { itemId: 'mat_iron_rivet', count: 4 },
      { itemId: 'mat_breach_glass', count: 2 },
      { itemId: 'mat_frayed_moment', count: 2 },
      { itemId: 'mat_bell_bronze', count: 2 },
    ],
    output: { itemId: 'item_breachwarden_mail', rarity: 'common' },
    requiresItemRead: 'item_pattern_breachwarden_mail',
  },
] satisfies RecipeInput[];
