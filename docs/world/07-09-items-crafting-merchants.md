# WORLD §7–9 — Items, Crafting, Merchants

Draft for WORLD.md §7 (items), §8 (crafting), §9 (merchants). Precedence per D-062: DESIGN owns item
mechanics, materials, affixes and economy numbers; WORLD owns placement; STORY owns quest items' story
role. Where this file proposes a number DESIGN lacks, it says so and lists it under Open questions.

## Conventions

- **Ids** (D-044): `item_` for every item type (weapon, armor, trinket, consumable, quest, key,
  recipe, tome); DESIGN §8.2 materials keep `mat_` (plus the legacy `item_void_shard`,
  `item_aetherium_shard`, `item_chronal_dust`). Recipes are `recipe_`. Damage types are the plain ids
  `physical`, `fire`, `storm`, `ley`, `void`, `chrono`. Factions: `remnants`, `weavers`, `ironclad`.
- **Fields** (DESIGN §3.2, §5.1, §7): `power`, `spell_power`, `accuracy`, `crit`, `evasion`,
  `initiative`, `armor`, `ward`, `strength`/`magic`/`agility` (flat bonus), `max_hp`, `max_mp`,
  `mp_regen`, `mp_cost_reduction` (%, legacy `mana_cost_reduction_percent`), `life_steal` (%, legacy
  `life_steal_percent`), `on_hit` (status id, chance, duration), `resist <type>` (one resistance step,
  DESIGN §4.4), `dmg_bonus <type>` (% damage dealt), `immune` (status id), `self_cost_hp`,
  `grants_ability`. Consumables: `heal` (HP), `mp`, `cleanse`, thrown `damage <type>`.
- **Rarity rule.** `roll` = rarity rolled by band weights (DESIGN §7.2) with affixes (§7.3).
  `fixed U/R/E` = always that rarity; listed affixes are fixed, otherwise the tier's affix count is
  rolled. Crafted output is Common (`craft`) and upgrades at the Emberforge (DESIGN §8.3).
  Consumables, materials, quest, key, recipe and tome items have no rarity.
- **Value** (g) is base `gold_value` at Common. Sell = `floor(0.75 × gold_value)`; buy per §9.1.
  Quest items cannot be sold (value shown for reference only).
- **Sources** use `loc_`, `cr_`, `npc_`, `recipe_`, `q_` ids. "pool" = a merchant's theme pool (§9).
  Creature drop chances are this file's proposal unless marked DESIGN or legacy.
- **Class weapon fit** (any class may wield anything, DESIGN §5.7): Ranger — `melee`, `ranged_bow`;
  Wizard — `magic_staff`; Elf — `ranged_bow`, `melee`; Ironclad Warden — `shield_heavy`;
  Shadow Weaver — `void_focus`. Every weapon type has gear at T1–T5.

### Tiers

T1–T4 are DESIGN §7.4. **T5 is proposed here** (OQ-1): capstone gear, band 16–18, crafted from a read
pattern or taken from a Before/Apex boss; reachable from Loop 2 only.

| Tier | Band | Weapon power | Staff/focus power / spell_power | Armor / ward | Trinket stat | Value |
|---|---|---|---|---|---|---|
| T1 | 1–4 | 4–6 | 2 / 1–2 | 2–3 / 0–1 | +1 | 8–40 |
| T2 | 5–8 | 7–10 | 3–4 / 3–4 | 4–6 / 1–2 | +1–2 | 40–110 |
| T3 | 9–13 | 11–14 | 5–6 / 5–7 | 7–9 / 2–3 | +2 | 110–220 |
| T4 | 14–18 | 15–20 | 7–8 / 8–10 | 10–12 / 3–4 | +2–3 | 220–400 |
| T5 *(proposed)* | 16–18 | 21–24 | 9 / 11–13 | 13–15 / 4–5 | +3 | 400–650 |

### Count (budget DESIGN §7.6)

| Type | Here | Budget | Note |
|---|---|---|---|
| weapon | 32 | 30 | 8 melee (4 legacy force two extra), 6 each other type |
| armor | 18 | 18 | |
| trinket | 20 | 20 | |
| consumable | 20 | 16 | +4 from WORLD §3 placements and STORY rewards |
| material | 25 | 21 | DESIGN's 21 + 4 WORLD regional materials (3 WORLD ids aliased) |
| quest | 18 | 14 | STORY §11 reward/required items |
| key | 6 | 6 | |
| recipe | 10 | 10 | 8 patterns + 2 Breach-anchor schematic halves |
| tome | 8 | 4 | WORLD's readable records counted as codex tomes |
| **Total** | **157** | **139** | 26 legacy kept; trim candidates in OQ-6 |

---

## 7. Items

### 7.1 Weapons — `melee` (8)

| id | Name | Tier | Rarity | Stats and effects | g | Sources | Description |
|---|---|---|---|---|---|---|---|
| `item_rusty_dagger` | Rusty Dagger | T1 | roll | power 4 | 8 | Ranger start kit; pool `npc_kaelen_stonehand` | A pitted blade with a faint echo of old magic. *(legacy: damage 4, 8 g)* |
| `item_travelers_sword` | Traveler's Sword | T1 | roll | power 5 | 20 | pool `npc_kaelen_stonehand`; `cr_mistwood_prowler` 10% | A serviceable blade for long roads and sudden fights. *(legacy: damage 5, 20 g)* |
| `item_warriors_sword` | Warrior's Sword | T2 | roll | power 7 | 40 | `cr_void_touched_stalker` 25% (legacy); pool `npc_borin_stonefist` (never Kaelen, legacy) | A balanced blade favored by veteran fighters. *(legacy: damage 7, 40 g)* |
| `item_shadow_kissed_dagger` | Shadow-Kissed Dagger | T2 | fixed U | power 7; on_hit `status_curse` 20% (3); self_cost_hp 2 per hit | 75 | `q_void_shards` (give the Shards to Nyx); never sold | A dagger forged in voidlight. Each strike hungers for its wielder. *(legacy: damage 7, curse 20%/3, 75 g)* |
| `item_nomad_sabre` | Nomad Sabre | T3 | roll | power 12; crit +3 | 150 | `npc_tessaly_varr` stock; `recipe_nomad_sabre` | A curved Steppe blade, salt-pitted, sharpened every night by habit. |
| `item_voidforged_edge` | Void-forged Edge | T3 | craft | power 12; on_hit `status_curse` 20% (3); no self-cost | 180 | `recipe_voidforged_edge` only | The Shards Nyx did not get, beaten flat. It is quiet in the hand. |
| `item_emberwrought_blade` | Emberwrought Blade | T4 | craft | power 17; basic attacks add 15% as `fire`; on_hit `status_burn` 15% (2) | 320 | `recipe_emberwrought_blade` | The Emberforge's own vein runs in the steel. It never quite cools. |
| `item_breachsteel_blade` | Breachsteel Blade | T5 | craft | power 22; crit +5; on_hit `status_slow` 10% (2) | 560 | `recipe_breachsteel_blade` (read `item_pattern_breachsteel_blade`) | Steel quenched in breach glass. Its edge arrives a moment early. |

### 7.2 Weapons — `ranged_bow` (6)

| id | Name | Tier | Rarity | Stats and effects | g | Sources | Description |
|---|---|---|---|---|---|---|---|
| `item_primitive_bow` | Primitive Bow | T1 | roll | power 4 | 15 | Elf start kit; pool `npc_kaelen_stonehand` | A simple hunting bow, crudely fashioned but effective for a quick shot. *(legacy: damage 4, 15 g)* |
| `item_elven_bow` | Elven Bow | T2 | roll | power 8; agility +1 | 70 | pool `npc_kaelen_stonehand`, `npc_old_fennick` | An elegantly carved bow, light as a feather and perfectly balanced, whispering ancient forest secrets. *(legacy: damage 8, +1 AGI, 70 g)* |
| `item_harrier_bow` | Harrier Bow | T3 | roll | power 11; accuracy +5; crit +3 | 140 | `npc_tessaly_varr`, `npc_old_fennick` stock; `recipe_harrier_bow` | Horn and sinew, strung for shooting at birds that dive. |
| `item_lanternwood_bow` | Lanternwood Bow | T3 | fixed R (`affix_of_ley`) | power 13; accuracy +5; basic attacks add 15% as `ley` | 200 | `loc_elder_mangrove` (Loop 2+, once, Mireya active) | Cut from a mangrove that glows. The arrows leave a green line in the air. |
| `item_galefeather_bow` | Galefeather Bow | T4 | craft | power 17; agility +2; initiative +2 | 320 | `recipe_galefeather_bow` | Fletched with Sentinel feathers. It draws easier in a high wind. |
| `item_heartwood_bow` | Heartwood Bow | T5 | craft | power 21; agility +2; dmg_bonus `ley` +10% | 540 | `recipe_heartwood_bow` (read `item_pattern_heartwood_bow`) | Silverwood heartwood from before the Sundering. It remembers being a tree in a city. |

### 7.3 Weapons — `magic_staff` (6)

| id | Name | Tier | Rarity | Stats and effects | g | Sources | Description |
|---|---|---|---|---|---|---|---|
| `item_apprentice_staff` | Apprentice Staff | T1 | roll | power 2; spell_power 1; mp_cost_reduction 10 | 30 | Wizard start kit; pool `npc_tamsin_reed` | A basic wooden staff, suitable for channeling nascent magical energies. *(legacy: damage 2, magic 1, mana_cost_reduction_percent 10, 30 g)* |
| `item_necromancer_staff` | Necromancer Staff | T2 | roll | power 4; spell_power 3; mp_cost_reduction 20; life_steal 5 | 100 | pool `npc_tamsin_reed`, `npc_kaelen_stonehand`; `cr_drowned_archivist` 5% | A staff of dark, polished bone, pulsating with forbidden power and a faint, chilling aura. *(legacy: damage 4, magic 3, 20%, life_steal_percent 5, 100 g)* |
| `item_scriptorium_staff` | Scriptorium Staff | T3 | roll | power 5; spell_power 6; mp_cost_reduction 10; max_mp +5 | 150 | `npc_sedge_marrow`, `npc_tamsin_reed` stock; `recipe_scriptorium_staff` | A Remnant reading-rod, wrapped in drowned vellum. The ink still moves under the wax. |
| `item_ley_tuned_staff` | Ley-tuned Staff | T3 | craft | power 6; spell_power 7; mp_cost_reduction 15; dmg_bonus `ley` +10% | 200 | `recipe_ley_tuned_staff` (Heartstone stabilized this loop) | Tuned to the calm Heartstone. It hums one note and holds it. |
| `item_spire_builders_staff` | Spire-Builder's Staff | T4 | fixed R | power 8; spell_power 10; mp_cost_reduction 15; dmg_bonus `storm` +10% | 380 | `loc_aldours_eyrie` (locked case; opens with `item_aetherium_prism`) | Seraphine Aulde's tuning staff. Strike it and the spires answer. |
| `item_hour_spindle` | Hour Spindle | T5 | craft | power 9; spell_power 13; mp_cost_reduction 20; on_hit `status_slow` 10% (2) | 580 | `recipe_hour_spindle` (read `item_pattern_hour_spindle`) | A spindle wound with frayed moments. Time catches on it like wool. |

### 7.4 Weapons — `shield_heavy` (6)

| id | Name | Tier | Rarity | Stats and effects | g | Sources | Description |
|---|---|---|---|---|---|---|---|
| `item_nomads_maul` | Nomad's Maul | T1 | roll | power 5; accuracy −5 | 18 | Ironclad Warden start kit (DESIGN §5.5); pool `npc_borin_stonefist` | A Nomad training maul. The haft is older than the head. |
| `item_ironclad_hammer` | Ironclad Hammer | T2 | roll | power 8; accuracy −5 | 55 | `npc_borin_stonefist`, `npc_tessaly_varr` stock | Riveted iron on ash. Borin makes ten a season and sells nine. |
| `item_bell_clapper` | Bell-Warden's Clapper | T3 | fixed R (`affix_of_moments`) | power 12; accuracy −5; heavy Stun chance 20% (base 10%) | 170 | `cr_bell_warden` 100% (`loc_bell_wardens_deep`); `recipe_bell_clapper` (Common) | The tongue of the bell that drowned a city. It still wants to ring. |
| `item_blackreeds_axe` | Blackreed's Axe | T3 | fixed R (`affix_of_iron`) | power 14; accuracy −5; on_hit `status_armor_break` 30% (3) | 220 | `q_day_of_teeth` (Loop 2+) | Corwen Blackreed held the Nexus a day with this. The notches are a count. |
| `item_hearth_iron_greataxe` | Hearth-Iron Greataxe | T4 | fixed R | power 19; accuracy −5; on_hit `status_armor_break` 15% (3) | 360 | `loc_roost_of_sentinels` (sky-burial ledge; Ironclad −10 unless `echo_sky_oath`) | Left on a sky-burial ledge with its owner. Taking it is a theft, or an inheritance. |
| `item_hallows_hammer` | Hallow's Hammer | T5 | craft | power 23; accuracy −5; strength +2; on_hit `status_armor_break` 25% (3); resist `chrono` | 600 | `recipe_hallows_hammer` (read `item_pattern_hallows_hammer`) | Forged to Durn Hallow's pattern. Iron that does not wish, struck into a head. |

### 7.5 Weapons — `void_focus` (6)

| id | Name | Tier | Rarity | Stats and effects | g | Sources | Description |
|---|---|---|---|---|---|---|---|
| `item_cracked_void_focus` | Cracked Void Focus | T1 | roll | power 2; spell_power 2 | 20 | Shadow Weaver start kit (DESIGN §5.6); pool `npc_kaelen_stonehand` | A palm of black glass with a split down it. Light goes in and does not come back. |
| `item_chasmglass_focus` | Chasmglass Focus | T2 | roll | power 3; spell_power 4 | 60 | pool `npc_kaelen_stonehand`; `cr_void_touched_stalker` 10% | Glass from the Chasm's lip, ground to a lens. It is always cold. |
| `item_hollow_lantern_focus` | Hollow Lantern Focus | T3 | roll | power 5; spell_power 6; immune `status_blind` on the first turn of an ambush (Voidglass Gallery rule, WORLD §2.9) | 160 | `npc_hollis_cade` stock; `cr_hollow_lantern` 10%; `recipe_hollow_lantern_focus` | A Hollow Lantern's empty cage. You see by what it does not show. |
| `item_umbral_mirror` | Umbral Mirror | T4 | fixed R (`affix_of_the_void`) | power 7; spell_power 9; on_hit `status_curse` 15% (3) | 340 | `cr_vells_umbra` 100% (`loc_eye_of_the_scar`) | Vell's Umbra wore this face. The mirror keeps it. |
| `item_nyxs_shardglass` | Nyx's Shardglass | T4 | fixed E (`affix_of_the_void`, `affix_of_the_wellspring`) | power 7; spell_power 10; life_steal 5; dmg_bonus `void` +10% | 400 | Weavers Sworn: `loc_where_she_fell` glass case (WORLD's `item_nyxarias_quiet`); `npc_hollis_cade` Sworn stock | Nyxaria Vell ground this from her own first Shard. She calls it her quiet. |
| `item_breachglass_focus` | Breachglass Focus | T5 | craft | power 9; spell_power 12; life_steal 5; dmg_bonus `void` +15% | 570 | `recipe_breachglass_focus` (read `item_pattern_breachglass_focus`) | A lens cut from the Breach itself. Look through it and the wrong stars line up. |

### 7.6 Armor (18)

Weights: **light** (ward-leaning, evasion), **medium** (balanced), **heavy** (armor-leaning, low ward).
Slot `armor` for all.

| id | Name | Weight | Tier | Rarity | Stats and effects | g | Sources | Description |
|---|---|---|---|---|---|---|---|---|
| `item_wildling_hide_armor` | Wildling Hide Armor | light | T1 | roll | armor 2; ward 1 | 25 | `cr_wildling_brute` 50% (legacy); pool `npc_kaelen_stonehand` | Crude but tough armor made from Mistwood hides. Smells faintly of damp earth. *(legacy: defense 2, 25 g)* |
| `item_scribes_robe` | Scribe's Robe | light | T1 | roll | armor 2; ward 1; max_mp +5 | 22 | pool `npc_tamsin_reed`, `npc_kaelen_stonehand` | Remnant grey, ink at the cuffs. It was made for sitting still. |
| `item_ironclad_mail` | Ironclad Mail | medium | T1–2 | roll | armor 4; ward 1 | 40 | `q_clear_path` reward (legacy); pool `npc_borin_stonefist` | Patchwork armor of riveted plates, worn by the nomads. Provides solid protection. *(legacy: defense 4, 40 g)* |
| `item_scrap_harness` | Scrap Harness | heavy | T1 | roll | armor 2; ward 0 | 12 | Ironclad Warden start kit (DESIGN §5.5); pool `npc_borin_stonefist` | Offcuts from Borin's floor, buckled together. It will do until it won't. |
| `item_salt_wind_cloak` | Salt-Wind Cloak | light | T2 | fixed U | armor 4; ward 2; evasion +5; resist `fire` | 95 | `q_bone_road` reward | A Nomad rider's cloak, stiff with salt. Ash slides off it. |
| `item_divers_coat` | Diver's Coat | light | T2 | roll | armor 4; ward 2; max_hp +10; `status_soaked` lasts 1 turn less | 85 | `npc_sedge_marrow` stock | Oilskin over fine rings, made by Sedge for the Remnants who go down. |
| `item_steppe_lamellar` | Steppe Lamellar | medium | T2 | roll | armor 5; ward 1 | 80 | `npc_tessaly_varr`, `npc_borin_stonefist` stock | Horn scales laced in rows. It rattles like dry reeds. |
| `item_ironclad_plate_armor` | Ironclad Plate Armor | heavy | T2 | fixed U | armor 6; ward −2 | 65 | `q_blighted_outpost` reward (legacy) | A heavy cuirass of layered steel. Strong against blades, weak to magic. *(legacy: defense 6, 65 g)* |
| `item_sky_whisper_cloak` | Sky-Whisper Cloak | light | T3 | fixed R (`affix_of_the_gale`) | armor 7; ward 3; agility +1; resist `storm` | 190 | `q_high_mark` reward | Woven from the plateau's marker-cloth. The wind goes around you. |
| `item_ley_tuned_vestment` | Ley-tuned Vestment | light | T3 | craft | armor 7; ward 3; max_mp +10; mp_regen +2 | 210 | `recipe_ley_tuned_vestment` (Heartstone stabilized this loop) | Thread soaked in the calm core's light. It is warm in the dark. |
| `item_veil_threadmail` | Veil Threadmail | medium | T3 | roll | armor 8; ward 2; evasion +5 | 180 | `npc_hollis_cade` stock (Weavers Trusted) | Grey thread over black links. The Weavers' sentries wear it to stand still unseen. |
| `item_voidforged_mail` | Void-forged Mail | medium | T3 | craft | armor 8; ward 3; resist `void` | 210 | `recipe_voidforged_mail` only | Shard-black rings. Void strikes slide off it like water off slate. |
| `item_cinderhorn_plate` | Cinderhorn Plate | heavy | T3 | craft | armor 9; ward 1; Guard reduces 55% | 200 | `recipe_cinderhorn_plate`; pool `npc_tessaly_varr` | Cinderback horn riveted over iron. It smells of a fire that went out. |
| `item_spireweave_mantle` | Spireweave Mantle | light | T4 | craft | armor 10; ward 4; max_mp +10; initiative +1 | 320 | `recipe_spireweave_mantle` | Spire thread and gale feathers. It lifts at the hem when no wind blows. |
| `item_oathplate` | Oathplate | heavy | T4 | fixed E (`affix_of_the_warden`, `affix_of_vigor`) | armor 12; ward 2; max_hp +10% | 380 | Ironclad Sworn: `npc_tessaly_varr` (gift, DESIGN §11.4) | Plate given to the sworn. Each rivet is a name the wearer promised to keep. |
| `item_conflux_robe` | Conflux Robe | light | T5 | craft | armor 13; ward 5; max_mp +20; resist `ley` | 560 | `recipe_conflux_robe` (read `item_pattern_conflux_robe`) | Cut to the pattern the Nine wore on the ritual night. Without the stains. |
| `item_breachwarden_mail` | Breachwarden Mail | medium | T5 | craft | armor 14; ward 4; initiative +1; resist `chrono` | 580 | `recipe_breachwarden_mail` (read `item_pattern_breachwarden_mail`) | Mail for standing where the hours fall apart. Each ring is a little out of step. |
| `item_sunderforged_plate` | Sunderforged Plate | heavy | T5 | craft | armor 15; ward 3; max_hp +10%; resist `void` | 620 | `recipe_sunderforged_plate` (read `item_pattern_sunderforged_plate`) | Plate forged with breach glass in the quench. It has already survived the end once. |

