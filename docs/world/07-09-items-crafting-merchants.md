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

### 7.7 Trinkets (20)

Slots `trinket_1`/`trinket_2`. "bound" = cannot be sold, dropped or salvaged. Trinkets tagged `key`
also satisfy exit conditions while carried (equipped or not).

| id | Name | Tier | Rarity | Stats and effects | g | Sources | Description |
|---|---|---|---|---|---|---|---|
| `item_glyphbound_lantern` | Glyphbound Lantern | T1 | roll | magic +1; tag `key`: Drowned Reach dark gate (WORLD §3.6) | 30 | `loc_sunken_archives` (appears with `q_lost_scroll`); `q_bell_vault` reward; `npc_kaelen_stonehand` Loop 2+ stock; `recipe_glyphbound_lantern` | A lantern etched with warding glyphs that sharpen focus. *(legacy: magic 1, 30 g)* |
| `item_sky_whisper_talisman` | Sky-Whisper Talisman | T2 | roll | agility +1; tag `key`: Spire-Crown climb, `q_high_mark` pass, Stormcrown bargain | 32 | `loc_sky_whisper_plateau`; `cr_sky_whisper_sentinel` 100% (legacy) | A weathered charm that steadies breath in high winds. *(legacy: agility 1, 32 g)* |
| `item_chronos_lens` | Chronos Lens | T3 | roll | magic +2; max_mp +10; tag `key`: Nexus Breach-door with `echo_litany_verse_1` (Loop 2+) | 120 | `loc_chronos_nexus` | A cracked lens that focuses time's echo. *(legacy: magic 2, mana 10, 120 g)* |
| `item_stabilized_heartstone` | Stabilized Heartstone | — | bound | magic +1; max_mp +15 | 90 | `q_echoing_heartbeat` (Stabilize) | A calm core that hums with the ley lines. *(legacy: passive once, magic 1, mana 15, 90 g)* |
| `item_heartstone_core` | Heartstone Core | — | bound | magic +2; max_mp +25; max_hp −15 | 100 | `q_echoing_heartbeat` (Exploit) | A stolen heartbeat of the world. Power surges, but each pulse hurts. *(legacy: magic 2, mana 25, health −15, 100 g)* |
| `item_bell_shard` | Bell Shard | T2 | roll | agility +1; initiative +2 | 50 | `loc_silverwood_plaza` (Loop 2+, 10% first visit); `loc_plaza_of_bells` (Before Day 3, 100%) | A curved piece of bell-bronze. Tap it and it rings the hour, any hour. |
| `item_oriels_ring` | Oriel's Ring | T2 | fixed U | magic +1; dmg_bonus `ley` +10% | 90 | `q_the_danthe_line` (if taken) | Oriel Danthe's seal-ring. The Door of Pages knew it before it knew Ilyra. |
| `item_choir_mask` | Choir Mask | T3 | fixed R | magic +1; resist `void` | 160 | `q_hollow_choir` reward | A mask of grey thread with no mouth. The Choir sings through it anyway. |
| `item_dasks_scout_badge` | Dask's Scout Badge | T3 | fixed R | agility +1; resist `chrono` | 150 | `q_the_flickering_man` reward | A Wayfinder's tin badge, seventy years tarnished. It flickers when Dask is near. |
| `item_weavers_thread_ring` | Weaver's Thread Ring | T3 | fixed U | max_mp +5; immune to the Unmaking hazard (WORLD §2.9) | 120 | `loc_sanctum_of_threads` (gift at Weavers Trusted) | A loop of grey thread tied by the Thread-Mother. It holds you to yourself. |
| `item_salt_charm` | Salt Charm | T3 | roll | strength +1; `status_poison` and `status_bleed` last 1 turn less | 110 | `loc_grey_salt_pan` (first clear) | A knot of salt crystals in jackal hair. Nomad children wear them to the pans. |
| `item_cinder_heart` | Cinder Heart | T3 | fixed R (`affix_of_embers`) | strength +2; resist `fire` | 200 | `cr_ashmaw` 100% (`loc_herd_grave`) | The coal at the centre of Ashmaw. It beats once a minute. |
| `item_stiltwalkers_boots` | Stilt-walker's Boots | T3 | fixed R | agility +2; immune `status_soaked` | 170 | `q_the_drowned_lantern` reward | Lanternreed boots on cork stilts. You walk over the water, not through it. |
| `item_voidforged_band` | Void-forged Band | T3 | craft | magic +2; dmg_bonus `void` +10% | 150 | `recipe_voidforged_band` only | A ring of Shard-glass set in breach glass. It is heavier than it looks. |
| `item_ley_tuned_charm` | Ley-tuned Charm | T3 | craft | magic +2; mp_regen +2 | 160 | `recipe_ley_tuned_charm` (Heartstone stabilized this loop) | Aetherium in a cage of ley spark. It pulses with the calm core's beat. |
| `item_unlidded_eye` | Unlidded Eye | T4 | fixed R | enemy intents shown one turn early (as `att_foresight`; does not stack with it) | 260 | `q_unlidded_eye` reward | An Aberrant Eye set in silver. It does not close, and neither, after a while, do you. |
| `item_lantern_moth_brooch` | Lantern-Moth Brooch | T4 | fixed R | agility +2; first time each fight HP drops below 30%: `status_regen` (3) | 280 | `cr_lantern_matron` 100% (`loc_matrons_hall`) | A moth of glowing chitin. It wakes when you are close to going out. |
| `item_stormcrown_talon` | Stormcrown Talon | T4 | fixed R (`affix_of_the_gale`) | agility +3; crit +3; dmg_bonus `storm` +10% | 340 | `cr_stormcrown` 100% or bargain (`loc_stormcrowns_perch`) | The oldest Sentinel's talon, given or taken. Static crawls along it. |
| `item_oriels_quill` | Oriel's Quill | T4 | fixed R (`affix_of_ley`) | magic +2; max_mp +10; Ley abilities mp_cost_reduction 10 | 300 | `loc_archives_of_danthe` (Before Day 3, on the desk) | The quill that wrote the Litany. The nib is still wet. |
| `item_archivists_circlet` | Archivist's Circlet | T4 | fixed E (`affix_of_ley`, `affix_of_echoes`) | magic +3; max_mp +10 | 380 | Remnants Sworn: `npc_tamsin_reed` (gift, DESIGN §11.4) | The Keeper's circlet of office. Five hundred years of names press on the brow. |

### 7.8 Consumables (20)

Stack 10. In combat a use is the turn's action (DESIGN §7.9). Thrown items target one enemy unless
noted. Tier = the band where the item is first common.

| id | Name | Tier | Effect | g | Sources | Description |
|---|---|---|---|---|---|---|
| `item_ley_touched_tonic` | Ley-Touched Tonic | T1 | heal 25; mp 15 | 12 | Ranger/Wizard/Warden/Weaver start kits; `npc_kaelen_stonehand` core; `loc_mistwood_path`; `loc_darkened_corridor` (Horde); `cr_wildling_brute` 60%, `cr_arcane_wisp` (legacy) | A swirling vial that smells like rain on stone. Restores health and mana. *(legacy: health 25, mana 15, 12 g)* |
| `item_glow_moss` | Glow Moss | T1 | heal 20; mp 5 | 10 | Elf start kit; every merchant core (§9); `loc_veridian_glowlands`, `loc_lantern_causeway`, `loc_reedmarch_descent` ×2; `cr_glowfen_mireling` (legacy) | Bioluminescent moss steeped in swamp magic. It soothes wounds. *(legacy: health 20, mana 5, 10 g)* |
| `item_mana_bloom` | Mana Bloom | T1 | heal 10; mp 30 | 25 | Wizard start kit; `npc_kaelen_stonehand` core; `loc_cistern_gardens` ×2; `cr_drowned_archivist` (legacy) | A rare blossom steeped in ley mist. It brings cool clarity. *(legacy: health 10, mana 30, 25 g)* |
| `item_antidote_root` | Antidote Root | T1 | cleanse `status_poison`, `status_bleed` | 8 | `npc_kaelen_stonehand`, `npc_old_fennick`, `npc_sedge_marrow` core; `loc_lanternreed` ×2; `recipe_antidote_root` | A bitter knuckle of root. Chew, spit, keep walking. |
| `item_chronal_dust` | Chronal Dust | T2 | mp 25 (also a material, §8.1) | 18 | `cr_shimmering_phantom`, `cr_temporal_aberration` 100% (DESIGN); `loc_shimmering_pass`; `loc_conflux_chamber` ×3 (WORLD's `mat_conflux_dust`); `npc_tamsin_reed` core | Fine grains that glitter with frozen time. It sharpens the mind. *(legacy: mana 25, 18 g)* |
| `item_ward_salts` | Ward Salts | T2 | self or ally: `status_shield` 20 | 20 | `npc_borin_stonefist`, `npc_tessaly_varr` core; `recipe_ward_salts` | Steppe salt and shade ash in a twist of paper. Scatter it and the air hardens. |
| `item_ember_flask` | Ember Flask | T2 | thrown: `fire` 25; `status_burn` 100% (2) | 22 | `npc_borin_stonefist` stock; `recipe_ember_flask` | Ember ore ground into resin. Don't hold it long. |
| `item_storm_jar` | Storm Jar | T2 | thrown: `storm` 20; `status_shock` 100% (2) | 22 | `loc_stormgate_cairns`; `npc_tessaly_varr` stock; `recipe_stormjar` | A sealed jar with a captured spark inside. It ticks against the glass. |
| `item_brine_draught` | Brine Draught | T2 | heal 35; cleanse `status_soaked` | 18 | `loc_drowned_stair`; `npc_sedge_marrow` core | Salt water boiled with kelp. It tastes like drowning and works anyway. |
| `item_lantern_oil` | Lantern Oil | T2 | thrown: `fire` 15; `status_burn` 100% (2). Out of combat: no Blind on ambush until next dawn | 12 | `loc_lamplighters_rest` ×2; `npc_sedge_marrow` core | Lamplighters' oil, rendered from something that lived in the dark. It burns clean. |
| `item_hearth_broth` | Hearth Broth | T2 | heal 30; mp 20; cleanse `status_weaken` | 16 | `loc_hearthring` ×2; `npc_tessaly_varr` core | Bone broth from the Hearthring pot, which has not gone out in a hundred years. |
| `item_nomad_hardtack` | Nomad Hardtack | T2 | out of combat only: heal 40 | 10 | `loc_scorched_gate` ×2; `npc_tessaly_varr` core | Salted biscuit hard enough to drive a tent peg. Soak it first. |
| `item_whetstone_strip` | Whetstone Strip | T3 | out of combat: next 3 basic attacks power +3 (this fight) | 15 | `loc_watchfire_ridge`; `npc_tessaly_varr`, `npc_borin_stonefist` stock | A strip of Nomad grit-stone. Ten strokes a side. |
| `item_lanternreed_salts` | Lanternreed Salts | T3 | revive a KO'd companion at 30% HP (in or out of combat) | 35 | `npc_old_fennick` core | Smelling-salts of crushed reed and glow gland. They wake what should be sleeping. |
| `item_fenlight_salve` | Fenlight Salve | T3 | heal 50; `status_regen` (3) | 28 | `q_lantern_in_the_reeds` reward ×3; `npc_old_fennick` stock | Green salve that glows faintly on the skin. The wound closes from the edges in. |
| `item_barrow_light_vial` | Barrow-Light Vial | T3 | thrown: `ley` 30; `status_blind` 50% (2) | 30 | `cr_barrow_light` 100% (`loc_firefly_barrows`) | A barrow-light caught in glass. Uncork it at something you dislike. |
| `item_stillwater_phial` | Stillwater Phial | T3 | cleanse all negative statuses; mp 30 | 40 | `loc_breathing_pool`; `npc_old_fennick` stock | Water from the Breathing Pool, perfectly still even when shaken. |
| `item_ley_tuned_tonic` | Ley-tuned Tonic | T3 | heal 50; mp 40 | 40 | `recipe_ley_tuned_tonic` (Heartstone stabilized this loop) | The old tonic, brewed against the calm core. It smells like rain on warm stone. |
| `item_silverwood_honeycake` | Silverwood Honeycake | T4 | heal 80; mp 20 | 30 | `loc_outer_walks` ×2, `loc_apprentices_garret` ×1; `npc_bellwright_anso` core | First Bell honeycake from a city that is about to end. It is very good. |
| `item_remnant_ink` | Remnant Ink | T4 | out of combat: `status_shield` 30 at the start of the next fight | 25 | `loc_grand_library` ×2 (Before); `npc_tamsin_reed` stock (Loop 2+) | Archive ink, five hundred years fresh. A ward written on the skin holds once. |

### 7.9 Materials

Materials are tabulated once, in §8.1 (25 entries: DESIGN §8.2's 21 plus four WORLD regional
materials; `item_chronal_dust` is counted as a consumable above).

### 7.10 Quest items (18)

Bound, unsellable, live in the Satchel (DESIGN §7.1). Story role per STORY; this table gives the
mechanical hook.

| id | Name | Use and effects | g (ref) | Sources | Description |
|---|---|---|---|---|---|
| `item_amulet_of_echoes` | Amulet of Echoes | slotless passive magic +1; grants_ability `itm_echo_bolt` (D-047); enables *Listen* (Loop 2+); exempt from the reset (D-047) | 60 | `loc_whispering_ruins` (Day 1, every loop) | A faintly glowing amulet tied to the Great Sundering. Enhances magical affinity. *(legacy: quest_item, magic 1, 60 g)* |
| `item_echo_crystal` | Echo Crystal | `q_echo_crystal` objective; give to Ilyra or keep (D-017) | 70 | `loc_shattered_library` alcove | A crystal that seems to hold voices from the past. *(legacy: quest_item, 70 g)* |
| `item_scholars_lost_scroll` | Scholar's Lost Scroll | `q_lost_scroll` objective; deliver to Ilyra | 45 | `loc_sunken_archives` (while `q_lost_scroll` is accepted) | A waterlogged scroll sealed with Remnant wax. The ink still holds secrets. *(legacy: quest_item, 45 g)* |
| `item_heartstone_fragment_stable` | Heartstone Fragment (stable) | `recipe_breach_anchor` input (seals: ending B route); `q_preserve_or_heal` dam | — | `q_echoing_heartbeat` Stabilize ×2 (count proposed, OQ-4) | A warm chip of the calm core. It beats in time with the ley. |
| `item_heartstone_fragment_dead` | Heartstone Fragment (dead) | `recipe_breach_anchor` input (cuts: ending D route); `q_preserve_or_heal` dam ("permanently and darkly", D-052) | — | `q_echoing_heartbeat` Destroy ×2 (OQ-4) | Grey stone that was a heartbeat. It is cold in a way stone is not. |
| `item_breach_anchor` | Breach-anchor | driven at the Apex: a stable-fragment anchor seals (ending B), a dead-fragment anchor cuts (ending D) (DESIGN §8.5); counts toward communion Resolve 8 (D-054) | — | `recipe_breach_anchor` | Iron, Aetherium and a Shard that remembers closing. It is heavier on one end than the other, and the heavy end changes. |
| `item_caelums_anchor_token` | Hallow's Cradle-Pin | placed on the Conflux altar (`loc_conflux_chamber`): sets `cradle_pin_anchored`; then lies in `loc_heartstone_depths` every loop (Anchor, D-016) | — | `npc_caelum` gives it (`loc_apprentices_garret`, his errand); `q_the_mending` stage 3 | A forge-pin from the cradle's rim, Hallow's mark on the head. Caelum has carried it for three days that never end. |
| `item_litany_page_1` | Litany Page (the Witness) | read: grants `echo_litany_verse_1` if not held (ruling, Errata E-9) | — | `loc_sunken_scriptorium` lectern | A leaf of Oriel's record, swollen with water. The first verse is legible. |
| `item_litany_page_2` | Litany Page (the Dark Between) | read: grants `echo_litany_verse_8` if not held | — | `loc_where_she_fell` glass case (Weavers ≥ 20 or `echo_nyx_true_name`) | A page Nyxaria kept under glass. Her own verse, in another woman's hand. |
| `item_litany_page_3` | Litany Page (the Warding) | read: grants `echo_litany_verse_3` if not held; can be anchored (then in `loc_heartstone_depths` every loop) | — | `npc_oriel_danthe` gives it (`loc_archives_of_danthe`, `echo_oriel_lineage` or Remnants ≥ 20) | A clean page, ink still drying, from the night before. Oriel hands it over without asking why. |
| `item_keepers_copy` | Keeper's Copy | out of combat: re-read any verse Echo held (codex replay; refreshes communion answers) | — | `q_keepers_ledger` reward | The Remnants' copy of the Litany you gave them, bound in grey. |
| `item_scouts_whistle` | Scout's Whistle | at any camp: call Brak to the active slot | — | `q_the_scouts_oath` reward | A bone whistle cut with an Ironclad mark. One note, and Brak comes. |
| `item_aberrant_eye` | Aberrant Eye | `q_unlidded_eye` stage 2 objective | — | `cr_temporal_aberration` 100% while `q_unlidded_eye` is active (`loc_chronos_nexus`) | It looks between moments, and it is still looking. |
| `item_pells_day_count` | Pell Ashcombe's Day-Count | `q_keepers_ledger` stage 2 objective | — | `loc_cistern_of_names` while `q_keepers_ledger` is active | Thirty strokes in a waterproof case. The last one is pressed hard. |
| `item_fathers_whetstone` | Father's Whetstone | `q_blood_and_salt` outcome A: carry from Kaelen to Brak (Brak gains *Named*, STORY §7.2) | — | `npc_kaelen_stonehand` (outcome A) | An old whetstone, never oiled. Both brothers learned on it. |
| `item_borins_forge_mark` | Borin's Forge-Mark | carried at Hallow's Cairn during `q_bone_road`: grants `echo_iron_that_does_not_wish` (STORY §12) | — | `npc_borin_stonefist` (dialogue; proposed: given when `q_bone_road` is accepted, OQ-10) | An iron tag stamped with Borin's mark. Hallow's mark is under it, worn almost flat. |
| `item_mireyas_lantern` | Mireya's Lantern | lit, with Mireya active: pacifist bypass of `cr_lantern_matron` (WORLD §3.9) | — | `loc_matrons_hall` (Mireya's arc, STORY §7.5) | A reed lantern with a moth-shaped flame. It burns the colour her people used to be. |
| `item_remnant_wax_seal` | Remnant Wax Seal | while carried: `npc_tamsin_reed` and `npc_sedge_marrow` offer stock as if Remnants were one tier higher (stock only, not prices) | — | `loc_crumbling_archway` (Loop 2+, 30% first visit, `echo_nine_voices`) | Remnant wax pressed with nine faces. One has been scratched out. |

### 7.11 Keys (6)

Keys live in the Satchel and satisfy `{item:…}` exit conditions. Never sold, never required gold
(§9.6 rule 5). Trinkets with a `key` tag (Glyphbound Lantern, Sky-Whisper Talisman, Chronos Lens) are
counted under trinkets.

| id | Name | Opens | Sources | Description |
|---|---|---|---|---|
| `item_cistern_key` | Cistern Key | `loc_black_sluice` → `loc_bellmouth` at night; the flooded crack `loc_heartstone_depths` ↔ `loc_cistern_of_names` (DESIGN's `key_sluice`) | `cr_bell_warden` 100% or surrender with `echo_rhune_choice` (`loc_bell_wardens_deep`); `loc_cistern_gardens` (Before Day 2, `echo_rhune_choice`) | The Master of Waters' key on a green chain. It turns every sluice in the city. |
| `item_bell_vault_key` | Bell-Vault Key | the Bell Vault; satisfies `q_the_danthe_line`'s prerequisite (Door of Pages) | `q_bell_vault` reward | A bronze key shaped like a bell's tongue. It hums when the hour turns. |
| `item_orrery_key` | Orrery Key | the orrery housing in `loc_chronos_nexus` (contents for WORLD §10, OQ-9); while untaken, `cr_orrery_knight` can spawn | `loc_chronos_nexus` (Loop 2+, first visit); `loc_ninefold_hall` (Before Day 1, `echo_hadrek_clockwright`) | Hadrek's winding key, nine teeth on the bit. Each tooth is a different length of hour. |
| `item_aetherium_prism` | Aetherium Prism | Aulde's locked case in `loc_aldours_eyrie` (`item_spire_builders_staff`) | `loc_spire_crown` (Loop 2+, 100%) | A spire-tip cut into a prism. Light through it comes out as a note. |
| `item_ward_seal` | Ward Seal | `loc_plaza_of_bells` → `loc_ninefold_hall` and `loc_archives_of_danthe` → `loc_conflux_chamber` before Day 3; no `cr_warding_pillar`; Korr's stacks; pacifist bypass of `cr_unbroken_warden` with Caelum | `npc_tobrin_vask` (`loc_conflux_chamber`, Before Day 2, `echo_vask_seal`) | A warder's seal: a square inside a circle. The golems in the Outpost bear the same mark. |
| `item_veil_sigil` | Veil Sigil | while carried, `cr_veil_sentry` encounters at `loc_veil_mouth` are skipped when Weavers are Wary (not Hostile); never required | `npc_hollis_cade` (30 g — DESIGN §9.1's "Veil tithe"; Weavers ≥ Neutral); `npc_sethe_unlidded` free at Weavers Trusted | A disc of black glass threaded on grey cord. The sentries count it instead of you. |

### 7.12 Recipe items (10)

Read (consumed) to unlock a Borin recipe for the loop (`requiresItemRead`, DESIGN §8.1). Sellable
except the two schematic halves (bound).

| id | Name | Unlocks | g | Sources |
|---|---|---|---|---|
| `item_breach_anchor_schematic_a` | Breach-anchor Schematic (first half) | with half B read in the same loop: `echo_anchor_schema` → `recipe_breach_anchor` (Errata E-14) | — | `loc_aldours_eyrie` 100% (Aulde's notes) |
| `item_breach_anchor_schematic_b` | Breach-anchor Schematic (second half) | as above | — | `loc_conflux_chamber` (Before Day 3, Tobrin's plinth, after or bypassing `cr_unbroken_warden`) |
| `item_pattern_breachsteel_blade` | Borin's Pattern: Breachsteel Blade | `recipe_breachsteel_blade` | 90 | `cr_ninefold_knight` 100% first kill (`loc_ninefold_hall`, Day 3) |
| `item_pattern_heartwood_bow` | Borin's Pattern: Heartwood Bow | `recipe_heartwood_bow` | 90 | `cr_stormcrown` 100% or bargain; `npc_old_fennick` stock (Loop 2+) |
| `item_pattern_hour_spindle` | Borin's Pattern: Hour Spindle | `recipe_hour_spindle` | 90 | `cr_orrery_knight` 100% (`loc_chronos_nexus`) |
| `item_pattern_hallows_hammer` | Borin's Pattern: Hallow's Hammer | `recipe_hallows_hammer` | 90 | `npc_borin_stonefist` gives it with `echo_hallows_ember` |
| `item_pattern_breachglass_focus` | Borin's Pattern: Breachglass Focus | `recipe_breachglass_focus` | 90 | `npc_hollis_cade` stock (Weavers Trusted) |
| `item_pattern_conflux_robe` | Borin's Pattern: Conflux Robe | `recipe_conflux_robe` | 90 | `npc_tamsin_reed` stock (Remnants Trusted) |
| `item_pattern_sunderforged_plate` | Borin's Pattern: Sunderforged Plate | `recipe_sunderforged_plate` | 90 | `npc_tessaly_varr` stock (Ironclad Trusted) |
| `item_pattern_breachwarden_mail` | Borin's Pattern: Breachwarden Mail | `recipe_breachwarden_mail` | 90 | `cr_unbroken_warden` 100%; `npc_bellwright_anso` stock (Before Days 1–2; pacifist route) |

### 7.13 Tomes (8)

Read out of combat (consumed); stack 5. Dark Spellbooks add Corruption (DESIGN §6.7); the others
unlock their codex entry (ids per STORY §14) and any Echo listed.

| id | Name | Read effect | g | Sources | Description |
|---|---|---|---|---|---|
| `item_dark_spellbook` | Dark Spellbook | −15 HP (current); +1 Corruption; 3 in one loop → `echo_litany_verse_2`; with the Amulet (Loop 2+) → `echo_korr_marginalia` | 8 | `cr_corrupted_shade` first kill per loop 100%, later 50% (D-055); Shadow Weaver start kit; `npc_hollis_cade` core | A charred tome of corrupted secrets. Reading its forbidden pages unlocks new magical abilities, but at a cost to your vitality. *(legacy: consumable, health −15, 8 g)* |
| `item_korrs_marginalia` | Korr's Marginalia | codex (Maelis Korr); counts as one Dark Spellbook toward `echo_litany_verse_2`, with no HP or Corruption cost | 30 | `loc_shattered_library` (Loop 2+, Corruption ≥ 1); `loc_grand_library` (Before Days 1–2, `item_ward_seal` or Remnants ≥ 20) | Maelis Korr's notes to himself, in the margins of a book he had not yet burned. |
| `item_warder_plate` | Warder Plate | grants `echo_golem_warder` (DESIGN §10.5; needs `q_blighted_outpost` complete) | 20 | `loc_blighted_outpost` (after both `cr_stone_hide_golem` fall) | A slate plate from a golem's brow, cut with a square inside a circle. |
| `item_tobrins_warding_primer` | Tobrin's Warding Primer | codex (Tobrin Vask) | 30 | `loc_emberforge` (Loop 2+, once, `echo_vask_seal`; Borin found it in the slag) | An apprentice's primer of ward-sigils. Someone corrected every page in red. |
| `item_oriels_ledger` | Oriel's Ledger | codex (Oriel Danthe) | 30 | `loc_sunken_scriptorium` (Loop 2+ or `echo_oriel_lineage`) | The Circle's archivist's own accounts. The last entry is a list of nine names. |
| `item_rhunes_hydromancy` | Rhune's Hydromancy | codex (Ilsabet Rhune) | 30 | `loc_bell_wardens_deep` (first clear) | The Warden of Waters' sluice tables. One page is a drowning, worked out to the hour. |
| `item_dreyls_pyre_ledger` | Dreyl's Pyre Ledger | codex (Corvin Dreyl) | 30 | `loc_herd_grave` (first clear) | The Watch-Captain's record of the pyre-ward. The last column is headed "outward". |
| `item_aldours_spire_notes` | Aulde's Spire Notes | codex (Seraphine Aulde) | 30 | `loc_aldours_eyrie` 100% | Tuning notes for nine spires, and one line in a different ink: *begin*. |

---

## 8. Crafting at the Emberforge

Borin Stonefist (`npc_borin_stonefist`, `loc_emberforge`) is the only crafter (DESIGN §8). Recipe
format, time cost (first craft per visit 1 watch, later 0), upgrades (§8.3) and salvage (§8.4) are
DESIGN's and are not restated here. Fees take `att_borins_favor` (−15%). The only rep gate is
the Ironclad tier (DESIGN §8.1 `repTier`).

### 8.1 Materials (25 + Chronal Dust)

DESIGN §8.2's ids, stacks and family sources, plus four WORLD regional materials (marked **W**).
Values and tiers are proposals (DESIGN gives values only for legacy items). "Gathering" = 1–2 per
visit per day, reset at dawn (DESIGN §8.2); nodes marked *(proposed)* need WORLD placement.

| id | Name | Tier | Stack | g | Sources (family → creatures; locations; vendors) | Used in |
|---|---|---|---|---|---|---|
| `mat_shadow_ash` | Shadow Ash | T1 | 99 | 4 | `shade` 80%: `cr_corrupted_shade`, `cr_starved_shadow`; `loc_voidglass_gallery` ×2 | ward salts, hollow lantern focus |
| `mat_wildling_hide` | Wildling Hide | T1 | 99 | 5 | `wildling` 80%: `cr_wildling_brute`; `loc_barren_peaks` 60% | T1 Rare→Epic upgrades |
| `mat_rootbone` | Rootbone | T1 | 99 | 4 | `wildling` 40%, `cr_rootling`; gathering `loc_mistwood_path` *(proposed)* | antidote root, harrier bow, scriptorium staff |
| `mat_ley_spark` | Ley Spark | T1 | 99 | 6 | `wisp` 80%: `cr_arcane_wisp`, `cr_paradox_wisp` | Ley-tuned line, storm jar, glyphbound lantern, scriptorium staff; T1 upgrades |
| `mat_ley_resin` | Ley Resin | T1 | 99 | 5 | gathering `loc_mistwood_path` *(proposed)*; `loc_elder_mangrove` ×2, `loc_firefly_barrows` ×1, `loc_matrons_hall` ×4 (WORLD's `mat_lantern_resin`); `npc_kaelen_stonehand` | Ley-tuned line, ember flask, antidote root, spireweave mantle |
| `mat_iron_rivet` | Iron Rivet | T1 | 99 | 3 | `golem` 60%: `cr_stone_hide_golem`; `loc_bone_orchard`; `npc_borin_stonefist`, `npc_tessaly_varr` | void-forged edge, many T3–T5 recipes |
| `mat_steppe_salt` | Steppe Salt | T2 | 99 | 4 | gathering `loc_grey_salt_pan` *(proposed)*; `npc_tessaly_varr`, `npc_borin_stonefist`, `npc_kaelen_stonehand` (STORY's "Respite salt") | ward salts |
| `mat_sodden_vellum` | Sodden Vellum | T2 | 99 | 8 | `drowned` 80%: `cr_drowned_archivist`, `cr_tide_clerk`; `loc_tidewell_hall` ×2, `loc_sunken_scriptorium` ×2 | scriptorium staff |
| `item_void_shard` | Void Shard | T2 | 99 | 20 | `void_touched` 100%: `cr_void_touched_stalker`; `loc_voidscar_hollow`, `loc_scar_shelf`, `loc_null_orchard`; `q_tears_of_the_breach`; `npc_hollis_cade` | void-forged line, Breach-anchor, breachglass focus; `q_void_shards` objective. *(legacy desc: "A shard of condensed shadow that promises power." 20 g)* |
| `mat_slate_core` | Slate Core | T2 | 99 | 12 | `golem` 100%: `cr_stone_hide_golem`; `loc_blighted_outpost` | void-forged mail, cinderhorn plate, emberwrought blade, sunderforged plate; T2 upgrades |
| `mat_ember_ore` | Ember Ore | T2 | 99 | 15 | Emberforge vein 3/loop (8 with `echo_emberforge_vein`); Ashen Steppe gathering `loc_scorched_gate` *(proposed)*; `npc_tessaly_varr` ×3 (proposed) | every upgrade from Uncommon; Breach-anchor; Ironclad recipes |
| `mat_bell_bronze` **W** | Bell Bronze | T2 | 99 | 12 | `cr_bell_ringer`; `loc_black_sluice` 30%, `loc_bellmouth` ×2 | bell clapper, breachwarden mail |
| `mat_cinder_horn` **W** | Cinder Horn | T3 | 99 | 14 | `cr_cinderback`; `loc_ash_wind_flats` 50%, `loc_bone_orchard` ×2, `loc_herd_grave` ×3 | nomad sabre, cinderhorn plate, emberwrought blade, hallow's hammer |
| `mat_frayed_moment` | Frayed Moment | T3 | 99 | 18 | `aberration` 80%, `phantom` 30%: `cr_temporal_aberration`, `cr_shimmering_phantom`, `cr_hourglass_crawler`; `loc_shimmering_pass` 50%; `loc_temporal_breach_apex` ×3 (after the Tyrant falls) | T5 recipes; Epic→Legendary upgrades |
| `item_aetherium_shard` | Aetherium Shard | T3 | 99 | 28 | `aetherial` 100%: `cr_aetherial_weaver`; `loc_aetherium_spires` (+1 with `flag_heartstone_stabilized`), `loc_spire_crown` ×2 | Breach-anchor, Ley-tuned line, hour spindle, conflux robe. *(legacy desc: "A sliver from a humming spire, warm with raw energy." 28 g)* |
| `mat_spire_thread` | Spire Thread | T3 | 99 | 15 | `aetherial` 70%: `cr_aetherial_weaver`, `cr_spire_loom` | Ley-tuned vestment, spireweave mantle, conflux robe; T3 upgrades |
| `mat_gale_feather` | Gale Feather | T3 | 99 | 12 | `sentinel` 80%: `cr_sky_whisper_sentinel`, `cr_gale_kite`; `loc_windward_stair`, `loc_roost_of_sentinels` ×2, `loc_stormcrowns_perch` (WORLD's `item_gale_feather`) | harrier bow, galefeather bow, spireweave mantle, heartwood bow |
| `mat_glow_gland` | Glow Gland | T3 | 99 | 10 | `mireling` 70%: `cr_glowfen_mireling`, `cr_spore_drift`; `loc_pale_gullet` ×2; `loc_veridian_glowlands` 50%, `loc_sporelight_shallows` ×3 (WORLD's `mat_glow_spore`) | hollow lantern focus; T3 upgrades |
| `mat_storm_glass` **W** | Storm Glass | T3 | 99 | 16 | `cr_steppe_harrier` 30%; `loc_stormgate_cairns` ×2, `loc_stormcrowns_perch` ×3 | harrier bow, galefeather bow |
| `mat_drowned_pearl` | Drowned Pearl | T3 | 99 | 25 | `loc_cistern_of_names` 40%; `npc_sedge_marrow` ×1 | conflux robe; Legendary upgrades |
| `mat_breach_glass` | Breach Glass | T4 | 99 | 30 | `loc_scar_shelf` ×1, `loc_voidglass_gallery` ×2, `loc_null_orchard` ×1; `nine_shard` adds (DESIGN) | void-forged band, T5 recipes; Legendary upgrades |
| `mat_umbral_thread` **W** | Umbral Thread | T4 | 99 | 22 | `cr_vells_umbra`, `cr_null_mouth` 30%; `loc_stair_of_unmaking` ×2, `loc_eye_of_the_scar` ×3; `npc_hollis_cade` (Weavers Sworn: WORLD's "void-forged thread") | hollow lantern focus, breachglass focus |
| `mat_skyreach_crystal` | Skyreach Crystal | T4 | 99 | 30 | Skyreach gathering `loc_windward_stair`, `loc_spire_crown` *(proposed)* | galefeather bow; T4 upgrades |
| `mat_silverwood_heartwood` | Silverwood Heartwood | T5 | 99 | 40 | Silverwood Before gathering `loc_cistern_gardens`, `loc_outer_walks` *(proposed)* | Breach-anchor, T5 recipes; Legendary upgrades; proposed T5 Rare→Epic material (OQ-1) |
| `mat_tyrant_shard` | Tyrant Shard | T5 | 9 | 120 | `cr_chronos_tyrant_unveiled` on kill (Loop 2+), 1 per phase; `loc_temporal_breach_apex` ×1 after the fall | Legendary upgrades only (OQ-5) |
| `item_chronal_dust` | Chronal Dust | T2 | 10 | 18 | see §7.8 | hour spindle |

### 8.2 Recipes (30)

Inputs are exact counts. Rep = Ironclad tier (DESIGN §8.1). Output is Common unless noted. Fee before
`att_borins_favor`. Recipes that need a read pattern name it in `Requires` (`requiresItemRead`).

| id | Output | Inputs | Gold | Rep | Requires |
|---|---|---|---|---|---|
| `recipe_breach_anchor` | `item_breach_anchor` | `item_aetherium_shard` ×3; **one of** `item_heartstone_fragment_stable` ×1 **or** `item_heartstone_fragment_dead` ×1; `item_void_shard` ×3; `mat_ember_ore` ×5; `mat_silverwood_heartwood` ×1 | 300 (OQ-2) | trusted (OQ-2) | `echo_anchor_schema`, `echo_void_resonance` (DESIGN §8.5 exact); STORY's `q_the_mending`/`q_iron_silence` also gate Borin's offer on `echo_iron_that_does_not_wish` (OQ-3) |
| `recipe_voidforged_edge` | `item_voidforged_edge` | `item_void_shard` ×3, `mat_ember_ore` ×3, `mat_iron_rivet` ×2 | 120 | trusted (or `echo_borin_oath`) | `flag_shards_refused` this loop |
| `recipe_voidforged_mail` | `item_voidforged_mail` | `item_void_shard` ×4, `mat_slate_core` ×2, `mat_ember_ore` ×3 | 150 | trusted (or `echo_borin_oath`) | `flag_shards_refused` |
| `recipe_voidforged_band` | `item_voidforged_band` | `item_void_shard` ×2, `mat_breach_glass` ×1 | 90 | trusted (or `echo_borin_oath`) | `flag_shards_refused` |
| `recipe_ley_tuned_staff` | `item_ley_tuned_staff` | `mat_ley_spark` ×3, `item_aetherium_shard` ×1, `mat_ley_resin` ×2 | 140 | neutral | `flag_heartstone_stabilized` this loop (D-017) |
| `recipe_ley_tuned_vestment` | `item_ley_tuned_vestment` | `mat_ley_spark` ×2, `item_aetherium_shard` ×1, `mat_ley_resin` ×3, `mat_spire_thread` ×1 | 160 | neutral | `flag_heartstone_stabilized` |
| `recipe_ley_tuned_charm` | `item_ley_tuned_charm` | `mat_ley_spark` ×2, `item_aetherium_shard` ×2 | 120 | neutral | `flag_heartstone_stabilized` |
| `recipe_ley_tuned_tonic` | `item_ley_tuned_tonic` ×3 | `mat_ley_spark` ×1, `mat_ley_resin` ×1, `item_glow_moss` ×1 | 80 | neutral | `flag_heartstone_stabilized` |
| `recipe_stormjar` | `item_storm_jar` ×2 | `mat_ley_spark` ×2, `mat_iron_rivet` ×1 | 25 | neutral | — |
| `recipe_ember_flask` | `item_ember_flask` ×2 | `mat_ember_ore` ×1, `mat_ley_resin` ×1 | 20 | neutral | — |
| `recipe_antidote_root` | `item_antidote_root` ×3 | `mat_rootbone` ×1, `mat_ley_resin` ×1 | 15 | neutral | — |
| `recipe_ward_salts` | `item_ward_salts` ×2 | `mat_steppe_salt` ×2, `mat_shadow_ash` ×1 | 30 | neutral | — |
| `recipe_glyphbound_lantern` | `item_glyphbound_lantern` | `mat_ley_spark` ×2, `mat_iron_rivet` ×1 | 0 (gate item, §9.6) | neutral | — |
| `recipe_nomad_sabre` | `item_nomad_sabre` | `mat_ember_ore` ×2, `mat_cinder_horn` ×2, `mat_iron_rivet` ×2 | 70 | neutral | — |
| `recipe_harrier_bow` | `item_harrier_bow` | `mat_gale_feather` ×2, `mat_rootbone` ×2, `mat_storm_glass` ×1 | 70 | neutral | — |
| `recipe_scriptorium_staff` | `item_scriptorium_staff` | `mat_sodden_vellum` ×3, `mat_ley_spark` ×2, `mat_rootbone` ×1 | 70 | neutral | — |
| `recipe_bell_clapper` | `item_bell_clapper` (Common; the boss copy is Rare) | `mat_bell_bronze` ×3, `mat_iron_rivet` ×2, `mat_ember_ore` ×2 | 80 | neutral | — |
| `recipe_hollow_lantern_focus` | `item_hollow_lantern_focus` | `mat_umbral_thread` ×1, `mat_glow_gland` ×2, `mat_shadow_ash` ×2 | 80 | neutral | — |
| `recipe_cinderhorn_plate` | `item_cinderhorn_plate` | `mat_cinder_horn` ×3, `mat_iron_rivet` ×3, `mat_slate_core` ×1 | 100 | neutral | — |
| `recipe_emberwrought_blade` | `item_emberwrought_blade` | `mat_ember_ore` ×4, `mat_cinder_horn` ×2, `mat_slate_core` ×2 | 160 | trusted | — |
| `recipe_galefeather_bow` | `item_galefeather_bow` | `mat_gale_feather` ×4, `mat_skyreach_crystal` ×1, `mat_storm_glass` ×2 | 160 | neutral | — |
| `recipe_spireweave_mantle` | `item_spireweave_mantle` | `mat_spire_thread` ×3, `mat_gale_feather` ×2, `mat_ley_resin` ×2 | 160 | neutral | — |
| `recipe_breachsteel_blade` | `item_breachsteel_blade` | `mat_ember_ore` ×5, `mat_breach_glass` ×2, `mat_frayed_moment` ×2, `mat_silverwood_heartwood` ×1 | 280 | neutral | read `item_pattern_breachsteel_blade` |
| `recipe_heartwood_bow` | `item_heartwood_bow` | `mat_silverwood_heartwood` ×2, `mat_gale_feather` ×3, `mat_frayed_moment` ×1 | 260 | neutral | read `item_pattern_heartwood_bow` |
| `recipe_hour_spindle` | `item_hour_spindle` | `mat_silverwood_heartwood` ×1, `mat_frayed_moment` ×3, `item_chronal_dust` ×2, `item_aetherium_shard` ×1 | 280 | neutral | read `item_pattern_hour_spindle` |
| `recipe_hallows_hammer` | `item_hallows_hammer` | `mat_ember_ore` ×6, `mat_iron_rivet` ×4, `mat_cinder_horn` ×2, `mat_silverwood_heartwood` ×1 | 300 | trusted | read `item_pattern_hallows_hammer`; `echo_hallows_ember` |
| `recipe_breachglass_focus` | `item_breachglass_focus` | `mat_breach_glass` ×3, `mat_umbral_thread` ×2, `item_void_shard` ×2 | 280 | neutral | read `item_pattern_breachglass_focus` |
| `recipe_conflux_robe` | `item_conflux_robe` | `mat_silverwood_heartwood` ×1, `mat_spire_thread` ×3, `mat_drowned_pearl` ×2, `item_aetherium_shard` ×1 | 260 | neutral | read `item_pattern_conflux_robe` |
| `recipe_sunderforged_plate` | `item_sunderforged_plate` | `mat_ember_ore` ×6, `mat_slate_core` ×3, `mat_breach_glass` ×2, `mat_silverwood_heartwood` ×1 | 300 | trusted | read `item_pattern_sunderforged_plate` |
| `recipe_breachwarden_mail` | `item_breachwarden_mail` | `mat_iron_rivet` ×4, `mat_breach_glass` ×2, `mat_frayed_moment` ×2, `mat_bell_bronze` ×2 | 280 | neutral | read `item_pattern_breachwarden_mail` |

**Coverage.** Each weapon type has a Loop-1 craft path at T3 (sabre, harrier bow, scriptorium staff,
bell clapper, hollow lantern focus) and a T5 capstone; melee and bow add a T4 craft. Ley-tuned crafting
(D-017) is the four `recipe_ley_tuned_*`. The void-forged line is the three `recipe_voidforged_*`, open
only in a loop where the Shards were refused. The Breach-anchor is DESIGN §8.5 verbatim; the Apex
behaviour depends on the fragment used (stable seals → B; dead cuts → D; Exploit yields no fragment).

### 8.3 Upgrades and salvage

Use DESIGN §8.3 (fees 0.5/1.0/1.5/2.0 × `gold_value`; Ember Ore and tier materials from Rare) and
§8.4 (salvage yields) unchanged. Two additions, both proposals: **T5 Rare→Epic tier material** =
`mat_silverwood_heartwood` ×2 (OQ-1); a **second Sky-Whisper Talisman** may stand in for the tier
material in any trinket's Rare→Epic upgrade (WORLD §3.4's "Trinket upgrade material").

---

## 9. Merchants

### 9.1 Pricing, tiers, restock

- **Buy** = `round(gold_value × region_markup × tier_mod × (1 − ledger_discount))` (DESIGN §9.2).
  **Sell** = `floor(0.75 × gold_value)` at any merchant that buys that category.
- **tier_mod** by the merchant's faction tier (D-014, DESIGN §9.2/§11.4): Hostile refuses to trade ·
  Wary ×1.15, core stock only · Neutral ×1.0, core + theme pool · Trusted ×0.90, + faction Rare gear ·
  Sworn ×0.80, + signature item. Kaelen uses the player's best tier and never refuses. Fennick and Anso
  belong to no faction: ×1.0, never refuse.
- **ledger_discount**: `att_kaelens_ledger` 5% everywhere; `echo_kaelen_ledger` +5% at Kaelen (max 10%).
- **Restock at dawn** (D-057, DESIGN §9.3): core quantities refill to the listed count; 3–4 theme-pool
  picks re-roll (rarity by band weights). Items the player sold stay for buy-back until dawn.
  Anso's "dawn" is each Before day (and each Before reset).

| Merchant | Location | Band | Faction | region_markup | Inn | Buys |
|---|---|---|---|---|---|---|
| `npc_kaelen_stonehand` | `loc_wayfarers_respite` | 2–3 | none (best of three) | 1.0 (DESIGN) | 10 g | anything non-quest |
| `npc_tamsin_reed` | `loc_silverwood_plaza` | 2–4 | `remnants` | 1.0 (DESIGN "archive stall") | — | tomes, recipes, trinkets, staves, consumables |
| `npc_borin_stonefist` | `loc_emberforge` | 4–6 | `ironclad` | 1.0 *(proposed)* | — (free forge hearth) | weapons, armor, materials |
| `npc_sedge_marrow` | `loc_lamplighters_rest` | 5 | `remnants` | 1.1 *(proposed)* | — | materials, consumables, armor |
| `npc_tessaly_varr` | `loc_hearthring`; caravan at `loc_ironclad_camp` after `flag_hearthring_caravan` | 8 (3–4) | `ironclad` | 1.0 (DESIGN Ironclad Camp; Hearthring proposed) | 10 g | weapons, armor, materials, consumables |
| `npc_old_fennick` | `loc_lanternreed` | 8–9 | none | 1.1 (DESIGN Lanternreed) | 10 g | consumables, materials, light armor, bows |
| `npc_hollis_cade` | `loc_sanctum_of_threads` | 11 | `weavers` | 1.2 (DESIGN Veil sanctum) | 10 g | weapons, trinkets, tomes, materials |
| `npc_bellwright_anso` | `loc_plaza_of_bells` (Before) | 13–14 | none | 1.2 *(proposed)* | — | trinkets, consumables |

### 9.2 Stock

Quantities are core counts per dawn. "Pool" lists the theme pool the 3–4 daily picks are drawn from.

**`npc_kaelen_stonehand` — The Wayfarer's Respite** (neutral ground; DESIGN `npc_kaelen`)

| Section | Stock |
|---|---|
| Core | `item_ley_touched_tonic` ×3, `item_mana_bloom` ×1, `item_antidote_root` ×2 (DESIGN); `item_glow_moss` ×3; `mat_steppe_salt` ×2 ("Respite salt", 4 g; free for `q_blood_and_salt` outcome A); `mat_ley_resin` ×3; Loop 2+: `item_glyphbound_lantern` ×1 (WORLD §3.6) |
| Pool | any T1–T2 weapon or armor that is not quest-locked, **except** `item_warriors_sword` and `item_shadow_kissed_dagger` (legacy exclusion): `item_rusty_dagger`, `item_travelers_sword`, `item_primitive_bow`, `item_elven_bow`, `item_apprentice_staff`, `item_necromancer_staff`, `item_nomads_maul`, `item_ironclad_hammer`, `item_cracked_void_focus`, `item_chasmglass_focus`, `item_wildling_hide_armor`, `item_scribes_robe`, `item_ironclad_mail`, `item_steppe_lamellar` |
| Rep-gated | none (never refuses) |

**`npc_tamsin_reed` — Silverwood Plaza** (Remnant stall; DESIGN `npc_remnant_archivist`; absent while the
Plaza is Horde-infected, at the Library instead from Loop 2)

| Section | Stock |
|---|---|
| Core | `item_glow_moss` ×3, `item_ley_touched_tonic` ×2, `item_chronal_dust` ×2 (DESIGN); Loop 2+: `item_remnant_ink` ×2 |
| Pool | staves T1–T3 (`item_apprentice_staff`, `item_necromancer_staff`, `item_scriptorium_staff`), `item_scribes_robe`, rolled trinkets with `affix_of_ley`/`affix_of_echoes` bias |
| Trusted | `item_scriptorium_staff` at fixed Rare (`affix_of_ley`) — the Remnant Ley gear of DESIGN §11.4; `item_pattern_conflux_robe` |
| Sworn | `item_archivists_circlet` (gift, once per loop) |
| Note | `item_remnant_wax_seal` carried: stock as if one tier higher (prices unchanged) |

**`npc_borin_stonefist` — The Emberforge** (crafter, §8; with Tessaly covers DESIGN's
`npc_ironclad_quartermaster`)

| Section | Stock |
|---|---|
| Core | `mat_iron_rivet` ×5, `item_ward_salts` ×2 (DESIGN quartermaster); `mat_steppe_salt` ×2; `item_glow_moss` ×3; `item_ley_touched_tonic` ×2; `item_ember_flask` ×2 |
| Pool | heavy weapons and medium/heavy armor T1–T3 with `affix_of_iron`/`affix_of_the_warden` bias: `item_nomads_maul`, `item_ironclad_hammer`, `item_warriors_sword`, `item_scrap_harness`, `item_ironclad_mail`, `item_steppe_lamellar`, `item_whetstone_strip` |
| Trusted | `item_ironclad_hammer` at fixed Rare (`affix_of_iron`); Ironclad-trusted recipes (§8.2) |
| Free | Ember vein: `mat_ember_ore` 3 per loop (8 with `echo_emberforge_vein`); `item_borins_forge_mark` (OQ-10); `item_pattern_hallows_hammer` with `echo_hallows_ember`; Loop 2+ `item_tobrins_warding_primer` |

**`npc_sedge_marrow` — Lamplighters' Rest** (Drowned Reach; diver gear made off-screen, no crafting UI)

| Section | Stock |
|---|---|
| Core | `item_glow_moss` ×3, `item_brine_draught` ×3, `item_lantern_oil` ×3, `item_antidote_root` ×2, `item_ley_touched_tonic` ×2 |
| Pool | `item_divers_coat`, `item_scriptorium_staff`, `item_scribes_robe`, `item_wildling_hide_armor`, `mat_drowned_pearl` ×1, `mat_sodden_vellum` ×2 |
| Trusted | `item_divers_coat` at fixed Rare (`affix_of_vigor`) |

**`npc_tessaly_varr` — Hearthring** (and the caravan at Ironclad Camp: core only)

| Section | Stock |
|---|---|
| Core | `item_glow_moss` ×3, `item_nomad_hardtack` ×3, `item_hearth_broth` ×2, `item_ward_salts` ×2, `item_storm_jar` ×2, `mat_steppe_salt` ×3 (DESIGN), `mat_iron_rivet` ×3, `mat_ember_ore` ×3 *(proposed)* |
| Pool | T2–T3: `item_nomad_sabre`, `item_harrier_bow`, `item_ironclad_hammer`, `item_steppe_lamellar`, `item_cinderhorn_plate`, `item_whetstone_strip` |
| Trusted | `item_cinderhorn_plate` at fixed Rare (`affix_of_the_warden`) — DESIGN §11.4's Ironclad plate; `item_pattern_sunderforged_plate` |
| Sworn | `item_oathplate` (gift, once per loop) |

**`npc_old_fennick` — Lanternreed** (DESIGN `npc_mireya_stall`)

| Section | Stock |
|---|---|
| Core | `item_glow_moss` ×5, `item_antidote_root` ×3, `item_lanternreed_salts` ×1 (DESIGN); `item_fenlight_salve` ×2 |
| Pool | light armor and bows T2–T3: `item_elven_bow`, `item_harrier_bow`, `item_scribes_robe`, `item_divers_coat`; herbs: `item_stillwater_phial`, `item_fenlight_salve`; Loop 2+: `item_pattern_heartwood_bow` |

**`npc_hollis_cade` — Sanctum of Threads** (DESIGN `npc_veil_vendor`; WORLD's `npc_hollis_vane`, D-064).
Trades only if Weavers ≥ Neutral **or** Corruption ≥ 3 (DESIGN §9.4).

| Section | Stock |
|---|---|
| Core | `item_dark_spellbook` ×1, `item_void_shard` ×2 (DESIGN "expensive": priced at 2× `gold_value`, proposed), `item_glow_moss` ×3, `item_ley_touched_tonic` ×3, `item_chronal_dust` ×2, `item_veil_sigil` ×1 (30 g flat, the Veil tithe) |
| Pool | void focuses and `affix_of_the_void` gear: `item_chasmglass_focus`, `item_hollow_lantern_focus`, `item_cracked_void_focus`, rolled armor/trinkets with `affix_of_the_void` |
| Trusted | `item_veil_threadmail`; `item_hollow_lantern_focus` at fixed Rare (`affix_of_the_void`) — DESIGN §11.4's Weaver focus; `item_pattern_breachglass_focus` |
| Sworn | `item_nyxs_shardglass` (if not taken from `loc_where_she_fell` this loop); `mat_umbral_thread` ×3 |

**`npc_bellwright_anso` — Plaza of Bells** (Silverwood Before)

| Section | Stock |
|---|---|
| Core | `item_silverwood_honeycake` ×3, `item_mana_bloom` ×2, `item_ley_touched_tonic` ×3, `item_glow_moss` ×3 |
| Pool | charms: `item_bell_shard` (Days 1–2), rolled T3–T4 trinkets (`affix_of_moments`, `affix_of_echoes` bias); Days 1–2: `item_pattern_breachwarden_mail` |

### 9.3 Coverage by band

| Band (region) | Affordable healing (cheapest) | Nearest merchants | Rest |
|---|---|---|---|
| 1–4 Silverwood Ruins | Glow Moss 10 g, Tonic 12 g | Kaelen, Tamsin | Ilyra's fire, free |
| 2–6 Mistwood & Reach | Glow Moss 10 g | Kaelen, Borin, Tessaly caravan | Respite inn, camp, forge hearth |
| 4–8 Drowned Reach | Glow Moss 10 g, Brine 18 g | Sedge | Lamplighters' Rest |
| 5–8 Voidscar | Glow Moss 10 g (Borin/Kaelen, one region west) | Borin, Kaelen | Chasm camp |
| 6–10 Highlands | none on site; Chronal Dust drops | Kaelen (via Shimmering Pass) | Dask's hollow, Plateau shelter |
| 7–11 Ashen Steppe | Hardtack 10 g, Glow Moss 10 g | Tessaly | Hearthring, Watchfire Ridge |
| 8–12 Glowfen | Glow Moss 10 g, Fenlight Salve 31 g | Fennick | Lanternreed |
| 9–13 Glowlands & Nexus | Glow Moss 10 g (Fennick, adjacent) | Fennick | astronomers' cell |
| 10–14 Veil | Glow Moss 12 g (Hollis ×1.2) | Hollis (gated); Fennick/Kaelen fallback | Sanctum |
| 12–15 Skyreach | none on site (OQ-8) | Hollis, Fennick, Anso | Aulde's Eyrie |
| 13–17 Silverwood Before | Glow Moss 12 g, Honeycake 36 g | Anso | Apprentices' Garret |
| 15–18 Apex | none (prepare in the Nexus/Before) | — | cannot rest |

**Weapon path per class** (best non-gated source per tier; L2 = Loop 2+):

| Class | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| Ranger (melee/bow) | Rusty Dagger (start) | Warrior's Sword (Borin) / Elven Bow (Kaelen) | Nomad Sabre, Harrier Bow (Tessaly; recipes) | Emberwrought Blade, Galefeather Bow (recipes) | Breachsteel Blade, Heartwood Bow (L2 patterns) |
| Wizard (staff) | Apprentice Staff (start) | Necromancer Staff (Tamsin/Kaelen) | Scriptorium Staff (Tamsin/Sedge; recipe) | Spire-Builder's Staff (L2, prism) | Hour Spindle (L2 pattern) |
| Elf (bow/melee) | Primitive Bow (start) | Elven Bow (Kaelen/Fennick) | Harrier Bow (Tessaly/Fennick; recipe) | Galefeather Bow (recipe) | Heartwood Bow (L2 pattern) |
| Ironclad Warden (heavy) | Nomad's Maul (start) | Ironclad Hammer (Borin/Tessaly) | Bell-Warden's Clapper (boss; recipe) | Hearth-Iron Greataxe (Roost) | Hallow's Hammer (L2 pattern) |
| Shadow Weaver (focus) | Cracked Void Focus (start) | Chasmglass Focus (Kaelen) | Hollow Lantern Focus (Hollis; recipe) | Umbral Mirror (Veil boss) | Breachglass Focus (L2 pattern) |

Between tiers, Borin's Common→Uncommon upgrade is gold-only (DESIGN §8.3), so every class has an
upgrade step affordable from kill gold alone.

### 9.4 Never soft-locked by poverty (DESIGN §9.6)

1. Glow Moss (10 g base) is core stock at every merchant; fodder gold `3 + 2L` makes it affordable
   within two kills at every band (12 g at ×1.2 markups is still two kills from L2).
2. Kaelen buys anything non-quest at 75% and never refuses; Fennick and Anso never refuse.
3. Gate items cost nothing: the Glyphbound Lantern is placed, a `q_bell_vault` reward, Kaelen stock
   from Loop 2 and a 0-fee recipe; every key comes from a place, drop or quest; the Veil Sigil is
   optional.
4. `q_blood_and_salt`'s salt is 4 g or free (STORY). The Breach-anchor's 300 g fee is the one conflict
   with rule 5 (OQ-2).

---

## Appendix A — Errata for WORLD §1–3 and id aliases

### A.1 Aliases (doc → canonical id)

| Alias (where) | Canonical | Why |
|---|---|---|
| `item_gale_feather` (WORLD `loc_stormcrowns_perch`) | `mat_gale_feather` | DESIGN §8.2 owns materials |
| `mat_glow_spore` (WORLD `loc_veridian_glowlands`, `loc_sporelight_shallows`) | `mat_glow_gland` | same glowing swamp matter; DESIGN id |
| `mat_lantern_resin` (WORLD Glowfen ×3 locations) | `mat_ley_resin` | same resin; DESIGN id |
| `mat_conflux_dust` (WORLD `loc_conflux_chamber`) | `item_chronal_dust` | frozen-time grains; legacy id |
| `item_nyxarias_quiet` (WORLD `loc_where_she_fell`) | `item_nyxs_shardglass` | DESIGN's Weavers Sworn signature focus; WORLD placement kept |
| `key_sluice` (DESIGN §10.5 `echo_drowned_sluice`) | `item_cistern_key` | WORLD's key already opens the Black Sluice; D-044 prefix |
| "Hallow's Cradle-Pin" (STORY §9.3, §11 `q_the_mending`) | `item_caelums_anchor_token` | one object; WORLD id, STORY name |
| "Stabilized Heartstone" as forge input (STORY `q_the_mending` stage 2) | `item_heartstone_fragment_stable` | D-052; the trinket stays equipped |
| "Respite salt" (STORY `q_blood_and_salt`) | `mat_steppe_salt` | Kaelen's salt is Steppe salt |
| STORY reward names | `item_keepers_copy`, `item_blackreeds_axe`, `item_choir_mask`, `item_unlidded_eye`, `item_bell_vault_key`, `item_salt_wind_cloak`, `item_stiltwalkers_boots`, `item_sky_whisper_cloak`, `item_oriels_ring`, `item_scouts_whistle`, `item_dasks_scout_badge`, `item_fenlight_salve`, `item_aberrant_eye`, `item_pells_day_count`, `item_fathers_whetstone`, `item_borins_forge_mark` | ids assigned here |
| STORY quest objectives `{item:"echo_crystal"}`, `{item:"void_shard"}` | `item_echo_crystal`, `item_void_shard` | D-044 full ids |
| DESIGN merchant placeholders `npc_kaelen`, `npc_ironclad_quartermaster`, `npc_remnant_archivist`, `npc_veil_vendor`, `npc_mireya_stall`, `npc_skyreach_trader` | `npc_kaelen_stonehand`; `npc_borin_stonefist` + `npc_tessaly_varr`; `npc_tamsin_reed`; `npc_hollis_cade`; `npc_old_fennick`; none (OQ-8) | D-064 |
| WORLD `npc_hollis_vane`, `npc_elder_wren` | `npc_hollis_cade`, `npc_elder_wen` | D-064 |
| WORLD faction id `shadow_weavers` (conditions in §3.8) | `weavers` | D-044 |
| DESIGN §10.5 `quest_blighted_outpost`, `quest_two_brothers`, `quest_anchor_the_conflux` | `q_blighted_outpost`, `q_blood_and_salt`, none (see E-14) | STORY §11 owns quest ids |
| DESIGN damage ids `dmg_*` (§4.4) | `physical`, `fire`, … | D-044 plain ids |

### A.2 Errata

| # | Where | Finding | Ruling here |
|---|---|---|---|
| E-1 | WORLD §3.2 `loc_ironclad_camp` | Merchant: no, but DESIGN §9.4 puts the Ironclad quartermaster there | Borin carries the quartermaster core; Tessaly's caravan adds core stock at the Camp after `flag_hearthring_caravan` |
| E-2 | WORLD §3.6 `loc_lamplighters_rest` | Sedge is "merchant/crafter"; DESIGN §8: Borin is the only crafter | Sedge sells finished diver gear; no crafting UI |
| E-3 | WORLD §3.10 | No Skyreach merchant, yet DESIGN §9.2/§9.4/§9.5 price a Skyreach outpost and a 20 g inn | OQ-8 |
| E-4 | WORLD §3.1 `loc_shattered_library` | DESIGN's Remnant archivist stall is at the Library; WORLD's Remnant stall is Tamsin at the Plaza | Tamsin at the Plaza (WORLD placement wins); she visits the Library when the Plaza is infected |
| E-5 | WORLD §2.6 | "Caelum can be brought forward once `item_caelums_anchor_token` has been anchored" contradicts STORY §9.6 (he crosses by his own choice in `q_a_boy_from_a_doomed_city`) | STORY wins; anchoring the token sets `cradle_pin_anchored` for ending B only |
| E-6 | WORLD §3.8 | `item_hollow_lantern_focus` is referenced (Gallery Blind rule) but never placed | Sources defined in §7.5 |
| E-7 | WORLD §3.5 | `item_orrery_key` has a placement but no lock | OQ-9 |
| E-8 | WORLD §3.4 | Second Sky-Whisper Talisman "is a Trinket upgrade material" — not in DESIGN §8.3 | Accepted as a stand-in for the tier material (§8.3 here) |
| E-9 | WORLD §3.6/§3.8/§3.11 | Physical `item_litany_page_1..3` vs STORY §12 treating verses as Echoes | Kept as quest items that grant a verse Echo on reading (1 → verse 1, 2 → verse 8, 3 → verse 3); STORY §12 must list them as extra sources, or the pages are removed |
| E-10 | WORLD §3 Items (several) | Seven new `mat_*` ids not in DESIGN §8.2 | Three aliased (A.1); four kept as regional materials (`mat_bell_bronze`, `mat_cinder_horn`, `mat_storm_glass`, `mat_umbral_thread`) — DESIGN §8.2 to adopt |
| E-11 | WORLD §3.7 `loc_herd_grave`; §3.10 | Several gathering sources DESIGN names (Steppe ember ore, Skyreach crystal, Before heartwood, Mistwood rootbone/resin, Steppe salt) have no WORLD node | Nodes proposed in §8.1; WORLD to place |
| E-12 | WORLD §3.11 `loc_aldours_eyrie` | Id spells "aldour" after D-063's Aulde | Ids stay stable (`loc_aldours_eyrie`, `item_aldours_spire_notes`); display name "Aulde's" |
| E-13 | DESIGN §10.5 | `echo_anchor_schema`, `echo_borin_oath`, `echo_emberforge_vein`, `echo_kaelen_ledger` are not in STORY §12 | STORY §12 to add them (D-062) |
| E-14 | DESIGN §10.5 | `echo_anchor_schema`'s source `quest_anchor_the_conflux` does not exist | Proposed source: read both schematic halves (`item_breach_anchor_schematic_a`, Aulde's Eyrie; `_b`, Conflux chamber) in one loop |
| E-15 | DESIGN §7.4 | Tiers stop at T4; this file needs T5 | OQ-1 |

---

## Appendix B — Open questions (§7–9)

1. **T5 tier.** Adopt the T5 row (band 16–18; power 21–24; staff/focus 9/11–13; armor 13–15/4–5;
   trinket +3; value 400–650) into DESIGN §7.4, and `mat_silverwood_heartwood` ×2 as the T5 Rare→Epic
   material in §8.3?
2. **Breach-anchor gates.** DESIGN §8.5's 300 g fee breaks §9.6 rule 5 ("no ending requires gold"),
   and its Ironclad `trusted` gate can block ending B for a player Trusted with Remnants and Weavers
   only. Recommend: fee 0 and rep `neutral` while `q_the_mending` or `q_iron_silence` is active.
3. **Anchor Echo gates.** DESIGN requires `echo_anchor_schema` + `echo_void_resonance`; STORY adds
   `echo_iron_that_does_not_wish` (Borin's dialogue). Keep both layers (recipe = DESIGN, quest stage =
   STORY), or fold STORY's Echo into `requiresEcho`?
4. **Fragment count.** Mireya's dam and the Breach-anchor each consume a fragment. Proposed: Stabilize
   and Destroy each yield ×2 so both are possible in one loop. STORY to confirm.
5. **Tyrant Shards** drop only when the Tyrant dies, which closes the loop (D-060); they are usable only
   during the Horde window. No recipe here needs them. DESIGN may drop them from §8.3.
6. **Budget.** 157 items vs 139. Trim candidates if the lead wants the budget exact: fold
   `item_pells_day_count`, `item_aberrant_eye`, `item_fathers_whetstone` into quest flags (−3); merge
   `item_nomad_hardtack` into `item_hearth_broth` and `item_lantern_oil` into `item_ember_flask` (−2);
   treat `item_tobrins_warding_primer`, `item_oriels_ledger`, `item_rhunes_hydromancy`,
   `item_dreyls_pyre_ledger` as codex events instead of tomes (−4); alias the four regional
   materials (−4).
7. **New markups.** Emberforge 1.0, Lamplighters' Rest 1.1, Hearthring 1.0, Plaza of Bells 1.2, and
   Void Shards at 2× at Hollis — DESIGN §9.2 to adopt or replace.
8. **Skyreach merchant.** WORLD places none. Either flag one (e.g. at `loc_windward_stair`, DESIGN's
   core: Storm Jar ×2, Skyreach Crystal ×1, Glow Moss ×3; pool T3–T4 `affix_of_the_gale` gear) or
   remove the Skyreach markup and 20 g inn from DESIGN §9.
9. **`item_orrery_key`.** What does the orrery housing hold? Suggest the Nexus-side source of
   `echo_eye_of_masque` or a Chrono trinket; WORLD §10 to decide.
10. **`item_borins_forge_mark`.** STORY needs it in inventory at Hallow's Cairn but names no source.
    Proposed: Borin hands it over when `q_bone_road` is accepted.
11. **Currency in Silverwood Before.** Does Anso take present-day gold? Proposed yes (coin is coin to
    a bellwright on First Bell); otherwise his stock becomes barter for materials.
