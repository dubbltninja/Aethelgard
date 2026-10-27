# REGISTRY-DRAFT — canonical ids for *Echoes of Aethelgard: The Unraveling*

Draft master registry from the U5 cross-document review (`docs/reviews/REVIEW-CROSS.md`). Revision agents (U8/U9)
and content engineers use these ids verbatim. Rules: D-044 (lowercase snake_case, typed prefixes are part of the id),
D-062 (owner document wins), D-063 (the Nine), D-064 (NPC roles). Extracted by script from DECISIONS (X), STORY (S),
DESIGN (D), WORLD (W) and PLAN (P) at commit `410ca26`; hand-reviewed.

**Columns.** *owner (seen in)*: the D-062 owner, then every document where the canonical id string already occurs.
*aliases*: other ids or names for the same thing, with where they occur; each must be replaced by the canonical id
(names may stay as prose where the action says so). *action*: `ok` · `rename-in-X` (X adopts the canonical id) ·
`add-to-X` (owner must define it) · `ADD to S §12` (new Echo) · `remove`. A "—" in *seen in* means the id is new here.

**Prefix additions proposed for D-044** (used by W, not in D-044's list): `fam_` (creature families), `pool_`
(wandering pools), `gate_` (map gates; W writes `g_`), `ws_` (world-state variants), `anomaly_` → fold into `cr_`
(see §10.2). Creature move ids stay scoped to their creature (W §6), except the Tyrant's `tyr_*`, which D-054 uses.


## 0. Sizes

| table | rows |
|---|---|
| Plain ids (5 classes, 6 companions, 3 factions, 6 damage types, 3 stats) | 23 |
| Regions | 12 |
| Locations | 73 |
| NPCs (incl. 1 placeholder to remove) | 39 |
| Quests (44 + 6 stretch + 5 class to add) | 55 |
| Echoes in STORY §12 | 75 |
| Echoes to ADD to STORY §12 | 26 |
| Non-STORY Echo ids mapped (rows; some rows group several ids) | 81 |
| Codex (85 + 1 to remove) | 86 |
| Scenes (20 + 2 refs) | 22 |
| Endings + closers | 8 |
| Creatures | 57 |
| Anomaly variants | 16 |
| Tyrant phase/move rows | 8 |
| Abilities (75 + 24 + 1) | 100 |
| Statuses | 19 |
| Affixes | 12 |
| Materials | 26 |
| Items (W §7 + 2 shards) | 134 |
| Recipes | 30 |
| Attunements | 15 |
| Achievements | 40 |
| Modifiers | 6 |
| Screens | 22 |
| SFX | 30 |
| Flags | 32 |

## 1. Plain (unprefixed) ids — classes, companions, factions, damage types, stats


### 1.1 Plain ids

Companion id ≠ NPC id: the NPC record is `npc_<name>` (W §4) and carries `companion: "<id>"`. Neutral ground (Kaelen's Respite) is not a faction (D-014). Sub-ids: class branches stay as D §5 (`hunt`, `steel`, … P A.5 agrees).

| type | id | display name | owner | aliases to replace (where) | action |
|---|---|---|---|---|---|
| class | `ranger` | Ranger | X D-044, D (§5) | — | ok |
| class | `wizard` | Wizard | X D-044, D (§5) | — | ok |
| class | `elf` | Elf | X D-044, D (§5) | — | ok |
| class | `ironclad_warden` | Ironclad Warden | X D-044, D (§5) | `warden` (P A.5); `quest_class_warden` (D §10.9) | rename-in-P,D |
| class | `shadow_weaver` | Shadow Weaver | X D-044, D (§5) | `weaver` (P A.5); `quest_class_weaver` (D §10.9) | rename-in-P,D |
| companion | `ilyra` | Ilyra | X D-044; S names | `comp_ilyra` (D §12.1, §12.8) | rename-in-D (`comp_` is reserved for companion abilities, D-044) |
| companion | `brak` | Brak | X D-044; S names | `comp_brak` (D §12.1, §12.8) | rename-in-D (`comp_` is reserved for companion abilities, D-044) |
| companion | `nyx` | Nyx | X D-044; S names | `comp_nyx` (D §12.1, §12.8) | rename-in-D (`comp_` is reserved for companion abilities, D-044) |
| companion | `dask` | Dask | X D-044; S names | `comp_dask` (D §12.1, §12.8) | rename-in-D (`comp_` is reserved for companion abilities, D-044) |
| companion | `mireya` | Mireya of Lanternreed | X D-044; S names | `comp_mireya` (D §12.1, §12.8) | rename-in-D (`comp_` is reserved for companion abilities, D-044) |
| companion | `caelum` | Caelum Vesper | X D-044; S names | `comp_caelum` (D §12.1, §12.8) | rename-in-D (`comp_` is reserved for companion abilities, D-044) |
| faction | `remnants` | Remnants of Aethelgard | X D-044, D-026 | — | ok |
| faction | `weavers` | Shadow Weavers | X D-044, D-026 | `shadow_weavers` (W §0 Conventions, §3.3/§3.8 rep conditions) | rename-in-W (E10) |
| faction | `ironclad` | Ironclad Nomads | X D-044, D-026 | — | ok |
| damage type | `physical` | Physical | X D-009/D-044; D §4.4 | `dmg_physical` (D §4.4) | rename-in-D |
| damage type | `fire` | Fire | X D-009/D-044; D §4.4 | `dmg_fire` (D §4.4) | rename-in-D |
| damage type | `storm` | Storm | X D-009/D-044; D §4.4 | `dmg_storm` (D §4.4) | rename-in-D |
| damage type | `ley` | Ley | X D-009/D-044; D §4.4 | `dmg_ley` (D §4.4) | rename-in-D |
| damage type | `void` | Void | X D-009/D-044; D §4.4 | `dmg_void` (D §4.4) | rename-in-D |
| damage type | `chrono` | Chrono | X D-009/D-044; D §4.4 | `dmg_chrono` (D §4.4) | rename-in-D |
| stat | `strength` | Strength (STR) | X D-044; D §3.1 | `str` (P §4.2 StatName) | rename-in-P |
| stat | `magic` | Magic (MAG) | X D-044; D §3.1 | `mag` (P §4.2 StatName) | rename-in-P |
| stat | `agility` | Agility (AGI) | X D-044; D §3.1 | `agi` (P §4.2 StatName) | rename-in-P |

### 2. Regions (12)

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `region_silverwood_ruins` | Silverwood Ruins | W (DW) | `silverwood_ruins` (P A.1) | rename-in-P |
| `region_mistwood_ironclad_reach` | Mistwood & the Ironclad Reach | W (W) | `region_mistwood_ironclad` (D §6.5); `mistwood_reach` (P A.1); `codex_region_mistwood_reach` is a codex id, ok | rename-in-D,P |
| `region_voidscar` | The Voidscar | W (DW) | `voidscar` (P A.1) | rename-in-P |
| `region_aether_kissed_highlands` | Aether-Kissed Highlands | W (W) | `region_highlands` (D §6.5, §12.8); `highlands` (P A.1) | rename-in-D,P |
| `region_glowlands_nexus` | Glowlands & Nexus | W (DW) | `glowlands_nexus` (P A.1) | rename-in-P |
| `region_silverwood_before` | Silverwood Before | W (DW) | `silverwood_before` (P A.1) | rename-in-P |
| `region_drowned_reach` | The Drowned Reach | W (DW) | `drowned_reach` (P A.1) | rename-in-P |
| `region_ashen_steppe` | The Ashen Steppe | W (DW) | `ashen_steppe` (P A.1) | rename-in-P |
| `region_veil` | The Veil | W (W) | `region_the_veil` (D §6.5); `veil` (P A.1) | rename-in-D,P |
| `region_glowfen` | The Glowfen | W (DW) | `glowfen` (P A.1) | rename-in-P |
| `region_skyreach` | The Skyreach | W (DW) | `skyreach` (P A.1) | rename-in-P |
| `region_threshold` | The Threshold | W (DW) | `threshold` (P A.1) | rename-in-P |

### 3. Locations (73)

Region column drops the `region_` prefix for width. Other STORY place names (Spire Yard, the Archive stair) are descriptive, not nodes.

| id | display name | region | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|---|
| `loc_whispering_ruins` | Whispering Ruins | silverwood_ruins | W (DW) | `whispering_ruins` (P A.2) | rename-in-P |
| `loc_crumbling_archway` | Crumbling Archway | silverwood_ruins | W (W) | `crumbling_archway` (P A.2) | rename-in-P |
| `loc_darkened_corridor` | Darkened Corridor | silverwood_ruins | W (W) | `darkened_corridor` (P A.2) | rename-in-P |
| `loc_shattered_library` | Shattered Library | silverwood_ruins | W (W) | `shattered_library` (P A.2) | rename-in-P |
| `loc_silverwood_plaza` | Silverwood Plaza | silverwood_ruins | W (W) | `silverwood_plaza` (P A.2) | rename-in-P |
| `loc_sunken_archives` | Sunken Archives | silverwood_ruins | W (DW) | `sunken_archives` (P A.2); "Oriel's carrel" (S §13 scene_the_first_drowned says "Drowned Reach")  | rename-in-S: the carrel is in the Sunken Archives (D-046, W cr_drowned_archivist) |
| `loc_heartstone_depths` | Heartstone Depths | silverwood_ruins | W (DW) | `heartstone_depths` (P A.2); "the Conflux" (present) (S, D-023) | ok |
| `loc_mistwood_path` | Mistwood Path | mistwood_ironclad_reach | W (DW) | `mistwood_path` (P A.2) | rename-in-P |
| `loc_wayfarers_respite` | The Wayfarer's Respite | mistwood_ironclad_reach | W (W) | `wayfarers_respite` (P A.2) | rename-in-P |
| `loc_ironclad_camp` | Ironclad Camp | mistwood_ironclad_reach | W (DW) | `ironclad_camp` (P A.2) | rename-in-P |
| `loc_barren_peaks` | Barren Peaks | mistwood_ironclad_reach | W (DW) | `barren_peaks` (P A.2) | rename-in-P |
| `loc_blighted_outpost` | Blighted Outpost | mistwood_ironclad_reach | W (DW) | `blighted_outpost` (P A.2); "Vane's Watch" (S codex_place_blighted_outpost; old name) | ok |
| `loc_emberforge` | The Emberforge | mistwood_ironclad_reach | W (W) | `emberforge` (P A.2) | rename-in-P |
| `loc_chasm_of_whispers` | Chasm of Whispers | voidscar | W (W) | `chasm_of_whispers` (P A.2) | rename-in-P |
| `loc_voidscar_hollow` | Voidscar Hollow | voidscar | W (W) | `voidscar_hollow` (P A.2) | rename-in-P |
| `loc_shimmering_pass` | Shimmering Pass | aether_kissed_highlands | W (W) | `shimmering_pass` (P A.2) | rename-in-P |
| `loc_aetherium_spires` | Aetherium Spires | aether_kissed_highlands | W (W) | `aetherium_spires` (P A.2) | rename-in-P |
| `loc_sky_whisper_plateau` | Sky-Whisper Plateau | aether_kissed_highlands | W (W) | `sky_whisper_plateau` (P A.2) | rename-in-P |
| `loc_veridian_glowlands` | Veridian Glowlands | glowlands_nexus | W (W) | `veridian_glowlands` (P A.2) | rename-in-P |
| `loc_chronos_nexus` | The Chronos Nexus | glowlands_nexus | W (W) | `chronos_nexus` (P A.2) | rename-in-P |
| `loc_temporal_breach_apex` | The Temporal Breach Apex | glowlands_nexus | W (DW) | `temporal_breach_apex` (P A.2) | rename-in-P |
| `loc_drowned_stair` | The Drowned Stair | drowned_reach | W (W) | — | ok |
| `loc_tidewell_hall` | Tidewell Hall | drowned_reach | W (W) | — | ok |
| `loc_cistern_of_names` | The Cistern of Names | drowned_reach | W (W) | — | ok |
| `loc_lamplighters_rest` | Lamplighters' Rest | drowned_reach | W (W) | — | ok |
| `loc_sunken_scriptorium` | The Sunken Scriptorium | drowned_reach | W (W) | "the Door of Pages" (S echo_archive_door, q_the_danthe_line) | ok |
| `loc_black_sluice` | The Black Sluice | drowned_reach | W (W) | — | ok |
| `loc_bellmouth` | The Bellmouth | drowned_reach | W (W) | — | ok |
| `loc_bell_wardens_deep` | The Bell-Warden's Deep | drowned_reach | W (W) | "the Bell Vault" (S q_bell_vault) | ok |
| `loc_scorched_gate` | The Scorched Gate | ashen_steppe | W (W) | — | ok |
| `loc_ash_wind_flats` | Ash-Wind Flats | ashen_steppe | W (W) | — | ok |
| `loc_hearthring` | Hearthring | ashen_steppe | W (W) | "the Ring of Wagons" (S §3.3, §11, codex_place_ring_of_wagons) | ok (S place-name → W id, W §11.5) |
| `loc_bone_orchard` | The Bone Orchard | ashen_steppe | W (W) | — | ok |
| `loc_grey_salt_pan` | Grey Salt Pan | ashen_steppe | W (W) | — | ok |
| `loc_stormgate_cairns` | Stormgate Cairns | ashen_steppe | W (W) | "Hallow's Cairn" (S q_bone_road, codex_place_hallows_cairn) — as `ev_hallows_cairn` | add-to-W: `ev_hallows_cairn` (W §11.5 X7) |
| `loc_watchfire_ridge` | Watchfire Ridge | ashen_steppe | W (W) | — | ok |
| `loc_reedmarch_descent` | Reedmarch Descent | ashen_steppe | W (W) | — | ok |
| `loc_herd_grave` | The Herd-Grave | ashen_steppe | W (W) | — | ok |
| `loc_veil_mouth` | The Veil Mouth | veil | W (W) | — | ok |
| `loc_stair_of_unmaking` | Stair of Unmaking | veil | W (W) | "the Lightless Stair" (S q_lightless_stair; starts at the Hollow's curtain, W §13.4 W12) | ok |
| `loc_sanctum_of_threads` | Sanctum of Threads | veil | W (W) | `loc_veil_sanctum` (D §13.3 ex. 4); "the Hollow Choir" (S §3.3, §11, codex_place_hollow_choir) | rename-in-D; S keeps "Hollow Choir" as the Weavers' name for the sanctum |
| `loc_scar_shelf` | The Scar Shelf | veil | W (W) | — | ok |
| `loc_voidglass_gallery` | Voidglass Gallery | veil | W (W) | — | ok |
| `loc_null_orchard` | The Null Orchard | veil | W (W) | — | ok |
| `loc_eye_of_the_scar` | Eye of the Scar | veil | W (W) | — | ok |
| `loc_where_she_fell` | Where She Fell | veil | W (W) | "Nyx's Cell" (S q_the_dark_between, codex_region_veil) — proposed | add the "wall of nine names" as an event here (U9) |
| `loc_lantern_causeway` | The Lantern Causeway | glowfen | W (W) | — | ok |
| `loc_lanternreed` | Lanternreed | glowfen | W (W) | — | ok |
| `loc_sporelight_shallows` | Sporelight Shallows | glowfen | W (W) | "the Reed Maze" (S q_lantern_in_the_reeds, q_the_drowned_lantern) | ok |
| `loc_elder_mangrove` | The Elder Mangrove | glowfen | W (W) | — | ok |
| `loc_breathing_pool` | The Breathing Pool | glowfen | W (W) | — | ok |
| `loc_firefly_barrows` | Firefly Barrows | glowfen | W (W) | — | ok |
| `loc_pale_gullet` | The Pale Gullet | glowfen | W (W) | — | ok |
| `loc_matrons_hall` | Hall of the Lantern Matron | glowfen | W (W) | — | ok |
| `loc_windward_stair` | The Windward Stair | skyreach | W (W) | "the Wind Stair" / "the High Mark" (S q_high_mark) | ok |
| `loc_spire_crown` | The Spire-Crown | skyreach | W (W) | — | ok |
| `loc_roost_of_sentinels` | Roost of the Sentinels | skyreach | W (W) | — | ok |
| `loc_auldes_eyrie` | Aulde's Eyrie | skyreach | W (W) | `loc_aldours_eyrie` (W §2.11, §3.10, §6.5, §7, §11, §12.3 — 17×) | rename-in-W (D-063; W §13.2 E4 over E-12) |
| `loc_stormcrowns_perch` | The Stormcrown's Perch | skyreach | W (W) | — | ok |
| `loc_silver_gate` | The Silver Gate | silverwood_before | W (W) | — | ok |
| `loc_outer_walks` | The Outer Walks | silverwood_before | W (W) | — | ok |
| `loc_scholars_corridor` | The Scholars' Corridor | silverwood_before | W (W) | — | ok |
| `loc_grand_library` | The Grand Library of Silverwood | silverwood_before | W (W) | — | ok |
| `loc_plaza_of_bells` | The Plaza of Bells | silverwood_before | W (W) | — | ok |
| `loc_ninefold_hall` | The Ninefold Hall | silverwood_before | W (W) | — | ok |
| `loc_apprentices_garret` | The Apprentices' Garret | silverwood_before | W (W) | — | ok |
| `loc_cistern_gardens` | The Cistern Gardens | silverwood_before | W (W) | — | ok |
| `loc_archives_of_danthe` | The Archives of Danthe | silverwood_before | W (W) | — | ok |
| `loc_conflux_chamber` | The Conflux Chamber | silverwood_before | W (W) | "the Conflux" (Before) (S §9) | ok |
| `loc_still_shore` | The Still Shore | threshold | W (W) | `still_shore` (P A.2) | rename-in-P |
| `loc_gallery_of_loops` | The Gallery of Loops | threshold | W (W) | `gallery_of_loops` (P A.2) | rename-in-P |
| `loc_loom` | The Loom | threshold | W (W) | `the_loom` (P A.2) | rename-in-P |
| `loc_far_light` | The Far Light | threshold | W (W) | `far_light` (P A.2) | rename-in-P |

### 4. NPCs (38 + 1 placeholder)

W §4 owns ids and placement; S owns names and roles (D-062, D-064). Merchants (8): Kaelen, Borin, Tamsin, Sedge, Tessaly, Hollis, Fennick, Anso. Borin is the only crafter (D §8); Sedge sells finished gear.

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `npc_ilyra` | Ilyra | W id · S name (W) | `ilyra` used as NPC id (P A.5 "companion id = npc id") | rename-in-P (NPC `npc_ilyra`, companion `ilyra`) |
| `npc_brak` | Brak | W id · S name (W) | `brak` as NPC id (P A.5) | rename-in-P |
| `npc_nyx` | Nyx (Nyxaria Vell) | W id · S name (W) | `nyx` as NPC id (P A.5) | rename-in-P |
| `npc_dask` | Dask, the Flickering Man | W id · S name (W) | `dask` as NPC id (P A.5) | rename-in-P |
| `npc_mireya` | Mireya of Lanternreed | W id · S name (W) | `mireya` as NPC id (P A.5) | rename-in-P |
| `npc_caelum` | Caelum Vesper | W id · S name (W) | `caelum` as NPC id (P A.5) | rename-in-P |
| `npc_kaelen_stonehand` | Kaelen Stonehand | W id · S name (XW) | `npc_kaelen` (D §9.4, X D-064); `kaelen` (P A.5) | rename-in-D,P |
| `npc_borin_stonefist` | Borin Stonefist | W id · S name (W) | `borin` (P A.5); half of `npc_ironclad_quartermaster` (D §9.4) | rename-in-D,P |
| `npc_tamsin_reed` | Scribe Tamsin Reed | W id · S name (XW) | `npc_remnant_archivist` (D §9.4, X D-064) | rename-in-D (stall at the Plaza, W §13.3 E-4) |
| `npc_ansel_dray` | Keeper Ansel Dray | W id · S name (XW) | "Keeper Dray" (S); W §3 lacks placement | add-to-W §3.1 loc_shattered_library NPCs (W §13.2 E8) |
| `npc_sedge_marrow` | Sedge Marrow | W id · S name (W) | — | ok |
| `npc_pellam` | Pellam | W id · S name (W) | — | ok |
| `npc_scout_ferrin` | Scout Ferrin | W id · S name (W) | — | ok |
| `npc_hadda_ironvow` | Hadda Ironvow | W id · S name (XW) | `npc_oma_varr` as clan-mother (W §3.7 loc_hearthring) | rename-in-W §3.7 (E8) |
| `npc_oma_varr` | Oma Varr | W id · S name (W) | — | ok |
| `npc_tessaly_varr` | Tessaly Varr | W id · S name (W) | `npc_ironclad_quartermaster` (D §9.4, X D-064) | rename-in-D |
| `npc_ketch` | Ketch | W id · S name (W) | — | ok |
| `npc_sethe_unlidded` | Sethe the Unlidded | W id · S name (XW) | — (W §3.8 lacks placement) | add-to-W §3.8 loc_sanctum_of_threads (E8) |
| `npc_ysmay` | Ysmay, the Thread-Mother | W id · S name (XW) | — | ok |
| `npc_hollis_cade` | Hollis Cade | W id · S name (XW) | `npc_hollis_vane` (W §3.8 ×6, X D-064); `npc_veil_vendor` (D §9.4) | rename-in-W,D |
| `npc_elder_wen` | Elder Wen Thistlecourt | W id · S name (XW) | `npc_elder_wren` / "Elder Wren" (W §2.10, §3.9 ×6, X D-064) | rename-in-W |
| `npc_elder_tam` | Elder Tam | W id · S name (W) | — | ok |
| `npc_old_fennick` | Old Fennick | W id · S name (W) | `npc_mireya_stall` (D §9.4, X D-064) | rename-in-D |
| `npc_hesper_dunn` | Gate-Captain Hesper Dunn | W id · S name (W) | "Watch-Captain; quest giver" (W §3.11); first name repeats Hesper Vayle (S §2.8) | rename display name in W (S owns names; W §13.5 Q8); role gatekeeper |
| `npc_bellwright_anso` | Anso the Bellwright | W id · S name (W) | — | ok |
| `npc_veyran_thal` | Archmagus Veyran Thal | W id · S name (W) | — | ok |
| `npc_nyxaria_vell_before` | Nyxaria Vell (young) | W id · S name (W) | — | ok |
| `npc_oriel_danthe` | Oriel Danthe | W id · S name (W) | — | ok |
| `npc_maelis_korr` | Maelis Korr | W id · S name (W) | — | ok |
| `npc_haldric_vane` | Haldric Vane | W id · S name (W) | — | ok |
| `npc_durn_hallow` | Durn Hallow | W id · S name (W) | — | ok |
| `npc_seraphine_aulde` | Seraphine Aulde | W id · S name (W) | — | ok |
| `npc_imre_sallow` | Imre Sallow | W id · S name (W) | — | ok |
| `npc_tovren_masque` | Tovren Masque | W id · S name (W) | — | ok |
| `npc_tobrin_vask` | Tobrin Vask | W id · S name (W) | — | ok |
| `npc_corvin_dreyl` | Captain Corvin Dreyl | W id · S name (W) | "Watch-Captain" (W item_dreyls_pyre_ledger) | rename-in-W → "Captain of the Silverwood Watch" (D-063) |
| `npc_ilsabet_rhune` | Ilsabet Rhune, Warden of Waters | W id · S name (W) | "Master of Waters, Ilsabet Rhune of the Nine" (W §2.7, §3.6, §3.11) | rename-in-W → "Warden of Waters", not of the Nine (D-063, E3) |
| `npc_hadrek` | Hadrek the Clockwright | W id · S name (W) | "Hadrek's chair" (W §3.11) | rename-in-W → "Masque's chair, where Hadrek works" (E6) |
| `npc_skyreach_trader` | (merchant placeholder) | D §9.4 (DX) | — | remove from D §9 (no W merchant; W §13.6 OQ8). If wanted, add to W §4 first |

### 5. Quests (44 + 6 stretch + 5 class)

S §11.1 is the catalog (D-045: 44 total, legacy six inside). Stage ids are S's. D §6.2/§11 quest numbering ("chain quest 2") follows S §11.1 categories.

| id | name | category | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|---|
| `q_echo_crystal` | Echoes in the Library | Remnants 1 (legacy) | S (SW) | `echo_crystal` (D §6.2, §10.5, §12.1, ach; P A.5) | rename-in-D,P |
| `q_lost_scroll` | The Scholar's Lost Scroll | Remnants 2 (legacy) | S (SW) | `lost_scroll` (D §6.2, §11.2, §12.1; P A.5) | rename-in-D,P |
| `q_keepers_ledger` | The Keeper's Ledger | Remnants 3 | S (XSW) | "Remnant chain quest 3" (D §10.5 echo_ilyra_keeper) | rename-in-D |
| `q_clear_path` | Clear the Barren Peaks | Ironclad 1 (legacy) | S (SW) | `clear_path` (D §6.2, §11.2, §12.1; P A.5) | rename-in-D,P |
| `q_blighted_outpost` | The Blighted Outpost | Ironclad 2 (legacy) | S (SW) | `blighted_outpost` (D §6.2, §11.2; P A.5); `quest_blighted_outpost` (D §10.5) | rename-in-D,P |
| `q_day_of_teeth` | The Day of Teeth | Ironclad 3 | S (SW) | "Ironclad chain quest 3" (D §10.5) | rename-in-D |
| `q_void_shards` | Whispers of the Void | Weavers 1 (legacy) | S (SW) | `void_shards` (D §6.2, §12.1; P A.5) | rename-in-D,P |
| `q_hollow_choir` | The Hollow Choir | Weavers 2 | S (SW) | "Weaver chain quest 2" (D §10.5 echo_veil_password) | rename-in-D |
| `q_unlidded_eye` | The Unlidded Eye | Weavers 3 | S (XSW) | — | ok |
| `q_echoing_heartbeat` | The Echoing Heartbeat | Regional: Silverwood Ruins (legacy) | S (SW) | `echoing_heartbeat` (D §6.2; P A.5) | rename-in-D,P |
| `q_bell_vault` | The Bell Vault | Regional: Drowned Reach | S (SW) | — | ok |
| `q_bone_road` | The Bone Road | Regional: Ashen Steppe | S (SW) | `q_herd_of_one` (W §3.7 loc_hearthring exit; W §13.4 W2) | rename-in-W |
| `q_lightless_stair` | The Lightless Stair | Regional: The Veil | S (SW) | — | ok |
| `q_the_drowned_lantern` | The Drowned Lantern | Regional: The Glowfen | S (SW) | — | ok |
| `q_high_mark` | The High Mark | Regional: Skyreach | S (SW) | — | ok |
| `q_the_still_shore` | The Still Shore | Regional: Threshold | S (S) | — | ok |
| `q_voices_in_the_stacks` | Voices in the Stacks | Ilyra 1 | S (S) | — | ok |
| `q_the_danthe_line` | The Danthe Line | Ilyra 2 | S (SW) | — | ok |
| `q_the_keepers_price` | The Keeper's Price | Ilyra 3 | S (SW) | — | ok |
| `q_the_scouts_oath` | The Scout's Oath | Brak 1 | S (SW) | — | ok |
| `q_blood_and_salt` | Blood and Salt | Brak 2 | S (SW) | `quest_two_brothers` (D §10.5, §11.6, ach_two_brothers) | rename-in-D |
| `q_the_line_he_holds` | The Line He Holds | Brak 3 | S (SW) | — | ok |
| `q_tears_of_the_breach` | Tears of the Breach | Nyx 1 | S (SW) | — | ok |
| `q_the_dark_between` | The Dark Between | Nyx 2 | S (S) | — | ok |
| `q_what_she_would_undo` | What She Would Undo | Nyx 3 | S (S) | — | ok |
| `q_the_flickering_man` | The Flickering Man | Dask 1 | S (SW) | — | ok |
| `q_seven_marks` | Seven Marks | Dask 2 | S (S) | — | ok |
| `q_the_last_instant` | The Last Instant | Dask 3 | S (S) | — | ok |
| `q_lantern_in_the_reeds` | Lantern in the Reeds | Mireya 1 | S (SW) | `quest_lanternreed_light` (D §10.5, §12.1) | rename-in-D |
| `q_what_the_light_takes` | What the Light Takes | Mireya 2 | S (S) | — | ok |
| `q_preserve_or_heal` | Preserve or Heal | Mireya 3 | S (SW) | — | ok |
| `q_the_apprentices_errand` | The Apprentice's Errand | Caelum 1 | S (S) | — | ok |
| `q_a_boy_from_a_doomed_city` | A Boy from a Doomed City | Caelum 2 | S (SW) | — | ok |
| `q_his_masters_sin` | His Masters' Sin | Caelum 3 | S (S) | — | ok |
| `q_the_thirtieth_dawn` | The Thirtieth Dawn | Loop-only | S (SW) | — | ok |
| `q_what_the_crystal_heard` | What the Crystal Heard | Loop-only | S (S) | — | ok |
| `q_stop_the_ritual` | Stop the Ritual | Loop-only (Silverwood Before) | S (SW) | `quest_stop_the_ritual` (D §10.5) | rename-in-D |
| `q_the_first_drowned` | The First Drowned | Loop-only | S (SW) | — | ok |
| `q_wardens_vigil` | The Warden's Vigil | Ending A | S (SW) | — | ok |
| `q_the_mending` | The Mending | Ending B | S (SW) | `quest_anchor_the_conflux` (D §10.1, §10.5; W §13.3) = its Before stage | rename-in-D (stage `anchor_the_conflux`) |
| `q_weavers_dawn` | The Weaver's Dawn | Ending C | S (SW) | — | ok |
| `q_iron_silence` | The Iron Silence | Ending D | S (SW) | — | ok |
| `q_long_archive` | The Long Archive | Ending E | S (SW) | — | ok |
| `q_unbound` | The Unbound | Ending F | S (SW) | — | ok |
| `q_korrs_margins` | Korr's Margins | stretch (S §11.7) | S (S) | — | ok — optional stretch, not scope (D-045) |
| `q_vanes_watch` | Vane's Watch | stretch (S §11.7) | S (S) | — | ok — optional stretch, not scope (D-045) |
| `q_the_one_note` | The One Note | stretch (S §11.7) | S (S) | — | ok — optional stretch, not scope (D-045) |
| `q_masques_eye` | Masque's Eye | stretch (S §11.7) | S (S) | — | ok — optional stretch, not scope (D-045) |
| `q_the_respite_ledger` | The Respite Ledger | stretch (S §11.7) | S (S) | — | ok — optional stretch, not scope (D-045) |
| `q_the_unravelled` | The Unravelled | stretch (S §11.7) | S (S) | — | ok — optional stretch, not scope (D-045) |
| `q_class_ranger` | (S to name) | class (D-008) | S (—) | `quest_class_ranger` (D §10.9) | add-to-S §11 (one per class, D-008; outside the 44) · rename-in-D |
| `q_class_wizard` | (S to name) | class (D-008) | S (—) | `quest_class_wizard` (D §10.9) | add-to-S §11 (one per class, D-008; outside the 44) · rename-in-D |
| `q_class_elf` | (S to name) | class (D-008) | S (—) | `quest_class_elf` (D §10.9) | add-to-S §11 (one per class, D-008; outside the 44) · rename-in-D |
| `q_class_ironclad_warden` | (S to name) | class (D-008) | S (—) | `quest_class_warden` (D §10.9) | add-to-S §11 (one per class, D-008; outside the 44) · rename-in-D |
| `q_class_shadow_weaver` | (S to name) | class (D-008) | S (—) | `quest_class_weaver` (D §10.9) | add-to-S §11 (one per class, D-008; outside the 44) · rename-in-D |

### 6.1 Echo catalog — STORY §12 (75)

STORY §12 is the catalog (D-062). Titles are STORY's; DESIGN §10.5 titles are replaced. `dask_anchor` in the `echo_dask_rest` row is a flag: `flag_dask_anchor`.

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `echo_litany_verse_1` | The Witness | S (XSDW) | D §10.5 title "Litany, First Verse"; W `item_litany_page_1` adds a source | ok; rename aliases / add sources |
| `echo_litany_verse_2` | The Lesson | S (SDW) | `echo_litany_verse_n` (D §10.5); W `ev_garret_litany` adds a source | ok; rename aliases / add sources |
| `echo_litany_verse_3` | The Warding | S (SW) | W `item_litany_page_3` adds a source | ok; rename aliases / add sources |
| `echo_litany_verse_4` | The Cradle | S (S) | — | ok |
| `echo_litany_verse_5` | The Spire | S (S) | — | ok |
| `echo_litany_verse_6` | The Breath | S (S) | — | ok |
| `echo_litany_verse_7` | The Eye | S (S) | — | ok |
| `echo_litany_verse_8` | The Dark Between | S (SW) | W `item_litany_page_2` adds a source | ok; rename aliases / add sources |
| `echo_litany_verse_9` | The Holding | S (S) | — | ok |
| `echo_litany_complete` | The Litany of the Conflux | S (SDW) | D §10.5 also demands `echo_tyrant_name` — drop that (S: the nine verses) | ok; rename aliases / add sources |
| `echo_heartstone_resonance` | Resonance | S (XSDW) | D title "The Heartstone Steadied" | ok; rename aliases / add sources |
| `echo_heartstone_hunger` | Hunger | S (SD) | D title "The Heartstone Taken" | ok; rename aliases / add sources |
| `echo_heartstone_silence` | Silence | S (SD) | D title "The Heartstone Broken" | ok; rename aliases / add sources |
| `echo_heartstone_triune` | The Three Beats | S (S) | — | ok |
| `echo_void_resonance` | The Note of Closing | S (XSDW) | D title "Void Resonance"; D source (Veil sanctum, Exploit/Sworn, exclusive with resonance) → S source | ok; rename aliases / add sources |
| `echo_nine_voices` | Nine Voices | S (SDW) | D title "Nine Voices in the Crystal" | ok; rename aliases / add sources |
| `echo_ninth_verse_unfinished` | The Unfinished Verse | S (S) | — | ok |
| `echo_nyx_is_of_the_nine` | Nyxaria Vell | S (SDW) | `echo_nyx_is_nyxaria` (D §10.5, ach); `echo_nyx_true_name` (W §2.3, §2.9, §3.8) | ok; rename aliases / add sources |
| `echo_breach_recoil` | The Recoil | S (S) | — | ok |
| `echo_what_she_would_undo` | Her Plan | S (S) | `echo_nyx_motive` (D §10.5) | ok; rename aliases / add sources |
| `echo_shard_moments` | Shards Are Moments | S (S) | — | ok |
| `echo_choir_knows` | The Choir Knows | S (S) | — | ok |
| `echo_ilyra_watchword` | The Ink Still Holds | S (SDW) | D title "Ilyra's Watchword", D source "Loop 1 portal scene" → S source (q_voices_in_the_stacks) | ok; rename aliases / add sources |
| `echo_crystal_location` | The Third Alcove | S (SDW) | D title "The Alcove Behind the Shelves" | ok; rename aliases / add sources |
| `echo_oriel_lineage` | The Danthe Line | S (SDW) | D title "Ilyra of Oriel's Line"; `echo_oriel_hand` (W loc_sunken_scriptorium); `echo_archway_whisper` (D) | ok; rename aliases / add sources |
| `echo_oriel_drowned` | The First Drowned | S (SW) | `echo_drowned_archivist_truth` (D §10.5) | ok; rename aliases / add sources |
| `echo_archive_door` | The Door of Pages | S (S) | `echo_drowned_sluice` (D §10.5); `echo_cistern_crack` (W §3.1/§3.6 gate) | ok; rename aliases / add sources |
| `echo_ilyra_cost` | What the Door Costs | S (S) | — | ok |
| `echo_brak_death` | Brak Stonehand | S (SDW) | D title "Brak Stonehand Falls" | ok; rename aliases / add sources |
| `echo_brak_birth_name` | The Dropped Name | S (S) | `echo_kaelen_brother` (D §10.5, §11.6) | ok; rename aliases / add sources |
| `echo_brak_lives` | The Line at the Nexus | S (S) | `echo_brak_saved` (D §10.5, §12.5) | ok; rename aliases / add sources |
| `echo_day_of_teeth` | The Day of Teeth | S (S) | `echo_iron_silence_cost` (D §10.5) | ok; rename aliases / add sources |
| `echo_hallows_ember` | Hallow's Ember | S (SW) | — | ok |
| `echo_iron_that_does_not_wish` | Iron That Does Not Wish | S (SW) | — | ok |
| `echo_hallow_said_stop` | Stop | S (SW) | — | ok |
| `echo_tyrant_speaks` | It Speaks | S (SDW) | W §3.5 Apex gate used `echo_tyrant_true_name`/verse 1 → this (W E9) | ok; rename aliases / add sources |
| `echo_tyrant_name` | Veyran Thal | S (SDW) | `echo_tyrant_true_name` (W §3.11 ev_hall_veyran) | ok; rename aliases / add sources |
| `echo_tyrant_jailer` | The Jailer | S (SDW) | D title "The Jailer, Not the Master"; D source "Loop 2 start" → S sources | ok; rename aliases / add sources |
| `echo_six_in_the_mass` | Six | S (S) | `echo_tyrant_phases` (D §10.5) | ok; rename aliases / add sources |
| `echo_tyrant_consent` | Consent | S (SW) | — | ok |
| `echo_tyrant_rejected` | Rejected | S (SW) | — | ok |
| `echo_breach_clock` | The Breach Clock | S (SD) | D title "The Thirtieth Dawn"; `echo_breach_failing` (W loc_watchfire_ridge ev_ridge_apex) adds a source | ok; rename aliases / add sources |
| `echo_thirtieth_dawn` | It Happened Anyway | S (SDW) | `echo_fall_witnessed` (D §10.2, §10.5) | ok; rename aliases / add sources |
| `echo_amulet_memory` | The Amulet Remembers | S (SD) | `echo_the_loop` (D §10.2, §10.5, §14 example) | ok; rename aliases / add sources |
| `echo_breach_door` | The Breach-Door | S (SD) | D title "The Door in the Nexus" | ok; rename aliases / add sources |
| `echo_apex_resonance` | The Way Up | S (XSW) | — | ok |
| `echo_threshold` | The Still Shore | S (S) | — | ok |
| `echo_flickering_man` | The Flickering Man | S (SD) | `echo_dask_name` (D §10.5, §12.1); `echo_pass_true_path` (W §2.4 hazard) | ok; rename aliases / add sources |
| `echo_seven_wayfinders` | Seven Marks | S (SDW) | `echo_wayfinder_lineage` (D §4.11, §10.5; W loc_* ev Loop 3+) | ok; rename aliases / add sources |
| `echo_wayfinder_symptom` | A Symptom | S (S) | — | ok |
| `echo_dask_rest` | One Instant | S (S) | — | ok |
| `echo_before_route` | Three Days Before | S (S) | — | ok |
| `echo_ritual_inevitable` | Always Going to Fail | S (SW) | `echo_conflux_ritual_fails` (D §10.5) | ok; rename aliases / add sources |
| `echo_caelum_unanchored` | The Boy on the Stair | S (SD) | D title "Caelum Can Come Forward"; S title wins | ok; rename aliases / add sources |
| `echo_caelum_stayed` | He Stayed | S (S) | — | ok |
| `echo_caelum_forgives` | Forgiven | S (S) | — | ok |
| `echo_caelum_cannot` | He Cannot | S (S) | — | ok |
| `echo_anchor_mechanic` | What the Chamber Keeps | S (SW) | `echo_anchor_principle` (D §10.5); `echo_anchor_rule` (W §2.6) | ok; rename aliases / add sources |
| `echo_bells_of_silverwood` | The Bells | S (S) | `echo_plaza_bells` (D §10.5) | ok; rename aliases / add sources |
| `echo_stone_hide_origin` | Vane's Wards | S (SW) | `echo_golem_warder` (D §10.5; W item_warder_plate) | ok; rename aliases / add sources |
| `echo_spire_note` | The One Note | S (SW) | `echo_spire_builder` (D); `echo_aldour_weavers`/`echo_aulde_weavers` (W §3.10 ev_eyrie_weavers, X D-063); `echo_nine_threads` (W loc_spire_crown) | ok; rename aliases / add sources |
| `echo_breathing_pool` | Sallow's Breath | S (SW) | — | ok |
| `echo_eye_of_masque` | The Far Side | S (SW) | — | ok |
| `echo_korr_marginalia` | The Margins | S (SW) | `echo_maelis_hand` (D §6.7, §10.5) | ok; rename aliases / add sources |
| `echo_glowfen_dammed` | Mireya's Choice | S (S) | — | ok |
| `echo_glowfen_let_run` | Mireya's Choice | S (S) | — | ok |
| `echo_high_mark` | Regional marks | S (S) | `echo_skyreach_song` (D §10.1, §10.5); `echo_breath_of_heights` (W §2.11 thin-air gate) | ok; rename aliases / add sources |
| `echo_bell_vault` | Regional marks | S (S) | — | ok |
| `echo_lightless_stair` | Regional marks | S (S) | — | ok |
| `echo_ending_a` | Witnessed | S (S) | — | ok |
| `echo_ending_b` | Witnessed | S (S range row) | — | ok |
| `echo_ending_c` | Witnessed | S (S range row) | — | ok |
| `echo_ending_d` | Witnessed | S (S range row) | — | ok |
| `echo_ending_e` | Witnessed | S (S range row) | — | ok |
| `echo_ending_f` | Witnessed | S (S) | — | ok |

### 6.2 Echoes to ADD to STORY §12 (26)

Each is needed by DESIGN or WORLD and has no STORY equivalent. U9 writes the codex line and confirms the source. Lean option (lead): the five `*_bond` Echoes and the three gate-convenience Echoes (`echo_heartstone_path`, `echo_hollow_path`, `echo_ironclad_passwords`) could instead be engine rules (loyalty memory; remembered gate edges in map memory) — see REVIEW-CROSS C-13.

| proposed id | proposed title | needed by | proposed source | effect |
|---|---|---|---|---|
| `echo_kaelen_ledger` | Kaelen's Ledger | D §9.2, §10.5; W §9.1 | `q_blood_and_salt` complete | Kaelen −5% (D) |
| `echo_anchor_schema` | The Anchor's Design | D §8.5; W §7.12 | read `item_breach_anchor_schematic_a` and `_b` in one loop (W E-14) | unlocks `recipe_breach_anchor` |
| `echo_borin_oath` | Borin's Oath | D §8.5; W §8.2 | `q_blighted_outpost` complete + talk to Borin | void-forged recipes without Trusted |
| `echo_emberforge_vein` | The Ember Vein | D §8.2; W §8.1 | Emberforge event, third visit in one loop | ember ore 8/loop |
| `echo_glowlands_leak` | The Glow Is the Breach | D §10.5; W `echo_breach_leak` | `q_lantern_in_the_reeds` stage 1; or the Glowfen elders (W §2.10) | Mireya dialogue; q_lantern_in_the_reeds skips to stage 2 |
| `echo_weaver_sign` | The Weavers' Hand-Sign | D §10.5, §11.6; W `echo_veil_watchword`, D `echo_veil_password` | Weavers ≥ Trusted at a loop's end; or `q_hollow_choir` complete | Weavers start 20; opens `gate_veil_curtain` |
| `echo_ironclad_oath` | Oath-Brother | D §10.5, §11.6 | Ironclad ≥ Trusted at a loop's end | Ironclad start 20 |
| `echo_ironclad_passwords` | The Scouts' Challenge | W §3.2 gate | `q_clear_path` complete once | Barren Peaks pass open |
| `echo_nomad_signs` | Trail-Signs | W §3.7, §4 | Scout Ferrin at loc_scorched_gate (Ironclad ≥ Neutral) | Scorched Gate + Herd Grave gates |
| `echo_heartstone_path` | The Way Down | W §3.1 gate | reach Heartstone Depths once | Depths open without q_echoing_heartbeat (Loop 2+) |
| `echo_hollow_path` | The Bridge Holds | W §3.3 gate | cross the Chasm bridge once | Voidscar Hollow open without q_void_shards |
| `echo_portal_tear` | The Door She Can Open | W §3.1, §11.3 | `q_the_keepers_price` complete with Remnants ≥ Trusted | Ilyra opens the Library portal deliberately (Loop 2+) |
| `echo_steppe_waystones` | The Waystone Order | D §10.1, §10.5; W §10.10, X3 | `q_bone_road` complete | Steppe crossing road (only if W X3 road is accepted; else remove) |
| `echo_horde_path` | How the Unraveling Spreads | D §10.5, §16.6 | witness the Horde once | infection forecast on the map |
| `echo_rhune_choice` | By Her Own Choice | W §3.6, §3.11 | W `ev_tidewell_ledger` (loc_tidewell_hall); or Before Day 2 at loc_cistern_gardens | Bell-Warden surrenders the Cistern Key |
| `echo_dreyl_brand` | Dreyl's Brand | W §3.7 | W `ev_orchard_brand` (loc_bone_orchard) | answers the Steppe beasts; Ashbrand recipe |
| `echo_sky_oath` | The Sky-Oath | W §2.11, §3.10 | W Skyreach event (Loop 2+) | Stormcrown bargain |
| `echo_tyrant_never_struck` | It Never Strikes First | W §3.10 | Stormcrown bargain (W loc_stormcrowns_perch) | communion Movement I answer (proposed) |
| `echo_vask_seal` | Vask's Seal | X D-063; W §3.2, §3.11 | W `ev_outpost_seal` (loc_blighted_outpost) or Tobrin Vask, Before Day 2 | `item_ward_seal`; schematic half B |
| `echo_hadrek_clockwright` | The Clockwright's Key | W §3.11 | Hadrek, Before Day 1 (loc_ninefold_hall) | duplicate `item_orrery_key` |
| `echo_crystal_seeded` | The Seeded Crystal | W §3.11 (claims S; S lacks it) | W `ev_library_cradle` (loc_grand_library, Loop 3+) | S to define the effect or W drops it |
| `echo_nyx_bond` | A Bond Remembered (Nyx) | D `echo_nyx_trusted` §10.5, §12.5 | Nyx loyalty ≥ 50 at a loop's end | Nyx starts loyalty 25 |
| `echo_ilyra_bond` | A Bond Remembered (Ilyra) | D §10.5, §12.5 | Ilyra loyalty ≥ 50 at a loop's end | starts loyalty 25 |
| `echo_dask_bond` | A Bond Remembered (Dask) | D §10.5 | as above | as above |
| `echo_mireya_bond` | A Bond Remembered (Mireya) | D §10.5 | as above | as above |
| `echo_caelum_bond` | A Bond Remembered (Caelum) | D §10.5 | as above | as above |

### 6.3 Every non-STORY Echo id → STORY id or ADD

Complete list of `echo_*` ids in DESIGN, WORLD and PLAN that are not in STORY §12 (grep of all five docs). `echo_crystal` (S, D, W, P) is the legacy quest/item id, not an Echo: see §5 and §15.

| id found | in | canonical | action |
|---|---|---|---|
| `echo_the_loop` | D | `echo_amulet_memory` | map |
| `echo_litany_verse_n` | D | `echo_litany_verse_2 … echo_litany_verse_9` | map (nine verses, S §2.3) |
| `echo_nyx_is_nyxaria` | D | `echo_nyx_is_of_the_nine` | map |
| `echo_nyx_motive` | D | `echo_what_she_would_undo` | map |
| `echo_tyrant_communion` | D | — | remove (D-054 discrete Resolve has no gain multiplier) |
| `echo_tyrant_phases` | D | `echo_six_in_the_mass` | map (hidden-intent reveal moves to it) |
| `echo_brak_saved` | D | `echo_brak_lives` | map |
| `echo_kaelen_brother` | D | `echo_brak_birth_name` | map |
| `echo_kaelen_ledger` | D W | `echo_kaelen_ledger` | ADD to S §12 |
| `echo_fall_witnessed` | D | `echo_thirtieth_dawn` | map |
| `echo_wayfinder_lineage` | D W | `echo_seven_wayfinders` | map |
| `echo_dask_name` | D | `echo_flickering_man` | map |
| `echo_maelis_hand` | D | `echo_korr_marginalia` | map (keeps D §6.7 effect) |
| `echo_golem_warder` | D W | `echo_stone_hide_origin` | map; `item_warder_plate` becomes a source |
| `echo_spire_builder` | D | `echo_spire_note` | map |
| `echo_glowlands_leak` | D | `echo_glowlands_leak` | ADD to S §12 |
| `echo_lanternreed_cleanse` | D | — | remove (Elder Wen always cleanses, D-064) |
| `echo_veil_password` | D | `echo_weaver_sign` | map (ADD) |
| `echo_steppe_waystones` | D W | `echo_steppe_waystones` | ADD to S §12 if W X3 road accepted, else remove |
| `echo_drowned_sluice` | D W | `echo_archive_door` | map |
| `echo_skyreach_song` | D W | `echo_high_mark` | map |
| `echo_anchor_principle` | D | `echo_anchor_mechanic` | map (Caelum's first talk becomes a second source) |
| `echo_anchor_schema` | D W | `echo_anchor_schema` | ADD to S §12 |
| `echo_conflux_ritual_fails` | D | `echo_ritual_inevitable` | map |
| `echo_ilyra_keeper` | D | — | remove (E is gated by D-018 terms + `echo_heartstone_resonance`) |
| `echo_iron_silence_cost` | D | `echo_day_of_teeth` | map |
| `echo_unbound_door` | D | — | remove (F = Resolve ≥ 3 + refusal, D-054) |
| `echo_phantom_moments` | D | — | remove → bestiary reveal at kill ×3 (bestiary persists, D-011) |
| `echo_aberration_rewind` | D | — | remove → bestiary reveal at kill ×2 |
| `echo_mireling_glow` | D | — | remove → bestiary reveal |
| `echo_golem_slate` | D | — | remove → bestiary reveal |
| `echo_stalker_eyes` | D | — | remove → bestiary reveal |
| `echo_horde_path` | D | `echo_horde_path` | ADD to S §12 |
| `echo_borin_oath` | D W | `echo_borin_oath` | ADD to S §12 |
| `echo_emberforge_vein` | D W | `echo_emberforge_vein` | ADD to S §12 |
| `echo_respite_spring` | D | — | remove (duplicates `att_old_road`) |
| `echo_archway_whisper` | D | `echo_oriel_lineage` | map (dialogue condition only) |
| `echo_plaza_bells` | D | `echo_bells_of_silverwood` | map |
| `echo_nexus_future_voice` | D | — | remove (Timeline hints read the profile) |
| `echo_first_wayfinder` | D | — | remove (grave event unlocks `codex_seven_wayfinders` only) |
| `echo_weaver_sanctum` | D | — | remove (map memory, D-011) |
| `echo_glowfen_lanternreed` | D | — | remove (map memory, D-011) |
| `echo_drowned_archivist_truth` | D | `echo_oriel_drowned` | map |
| `echo_weaver_sign` | D | `echo_weaver_sign` | ADD to S §12 |
| `echo_ironclad_oath` | D | `echo_ironclad_oath` | ADD to S §12 |
| `echo_nyx_trusted` | D | `echo_nyx_bond` | ADD to S §12 (renamed for the bond family) |
| `echo_ilyra_bond / _dask_ / _mireya_ / _caelum_bond` | D | same ids | ADD to S §12 |
| `echo_vigil_kept` | D | `echo_ending_a` | map |
| `echo_mending_done` | D | `echo_ending_b` | map |
| `echo_weavers_dawn` | D | `echo_ending_c` | map |
| `echo_iron_silence` | D | `echo_ending_d` | map |
| `echo_long_archive` | D | `echo_ending_e` | map |
| `echo_unbound` | D | `echo_ending_f` | map |
| `echo_aldour_weavers` | W X | `echo_spire_note` | map (D-063 allows: S has an equivalent) |
| `echo_aulde_weavers` | X W | `echo_spire_note` | map |
| `echo_anchor_rule` | W | `echo_anchor_mechanic` | map (W E9) |
| `echo_breach_failing` | W | `echo_breach_clock` | map (W event adds a source) |
| `echo_breach_leak` | W | `echo_glowlands_leak` | map (ADD) |
| `echo_breath_of_heights` | W | `echo_high_mark` | map |
| `echo_cistern_crack` | W | `echo_archive_door` | map (one Echo for both remembered ways into the Reach) |
| `echo_crystal_seeded` | W | `echo_crystal_seeded` | ADD to S §12 (W says S has it; S does not) |
| `echo_dreyl_brand` | W | `echo_dreyl_brand` | ADD to S §12 |
| `echo_hadrek_clockwright` | W | `echo_hadrek_clockwright` | ADD to S §12 |
| `echo_heartstone_path` | W | `echo_heartstone_path` | ADD to S §12 |
| `echo_hollow_path` | W | `echo_hollow_path` | ADD to S §12 |
| `echo_ironclad_passwords` | W | `echo_ironclad_passwords` | ADD to S §12 |
| `echo_nine_threads` | W | `echo_spire_note` | map |
| `echo_nomad_signs` | W | `echo_nomad_signs` | ADD to S §12 |
| `echo_nyx_true_name` | W | `echo_nyx_is_of_the_nine` | map (W E9) |
| `echo_oriel_hand` | W | `echo_oriel_lineage` | map |
| `echo_pass_true_path` | W | `echo_flickering_man` | map (Dask shows the true path) |
| `echo_portal_tear` | W | `echo_portal_tear` | ADD to S §12 |
| `echo_rhune_choice` | W | `echo_rhune_choice` | ADD to S §12 |
| `echo_sky_oath` | W | `echo_sky_oath` | ADD to S §12 |
| `echo_tyrant_never_struck` | W | `echo_tyrant_never_struck` | ADD to S §12 |
| `echo_tyrant_true_name` | W | `echo_tyrant_name (§3.11) / echo_tyrant_speaks (§3.5 Apex gate)` | map (W E9) |
| `echo_vask_seal` | X W | `echo_vask_seal` | ADD to S §12 (D-063 keeps it) |
| `echo_veil_watchword` | W | `echo_weaver_sign` | map (ADD) |
| `crystal_location`, `ilyra_watchword`, `litany_verse_1`, `litany_complete`, `nine_voices`, `heartstone_resonance`, `void_resonance`, `brak_death` | P A.6 | `same names with `echo_`` | rename-in-P (D-044) |
| `apex_path` | P §13 Q3, A.6 | `echo_apex_resonance` | rename-in-P (D-048) |
| `echo.crystal_location`, `echo.ilyra_watchword`, `echo.litany_verse_1`, `echo.brak_death` (dot form) | X D-010/D-016/D-017, S, D | `echo_*` | prose only; data uses `echo_*` (D-044) |

### 7. Codex entries (85)

S §14 is the catalog. D/W references resolve to these ids (aliases column). Creature codex rows conflict with W §5 family taxonomy (W owns creatures); proposal: one codex entry per W family.

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `codex_nine_overview` | The Ninefold Circle | S (S) | `codex_the_nine` (D §10.5 echo_nyx_is_nyxaria) | rename-in-D |
| `codex_veyran_thal` | Veyran Thal | S (S) | — | ok |
| `codex_nyxaria_vell` | Nyxaria Vell | S (S) | — | ok |
| `codex_oriel_danthe` | Oriel Danthe | S (S) | — | ok |
| `codex_maelis_korr` | Maelis Korr | S (SD) | — | ok |
| `codex_haldric_vane` | Haldric Vane | S (S) | — | ok |
| `codex_durn_hallow` | Durn Hallow | S (S) | — | ok |
| `codex_seraphine_aulde` | Seraphine Aulde | S (S) | — | ok |
| `codex_imre_sallow` | Imre Sallow | S (S) | — | ok |
| `codex_tovren_masque` | Tovren Masque | S (S) | — | ok |
| `codex_tyrant_naming` | On the Naming of the Tyrant | S (S) | — | ok |
| `codex_tyrant_holding` | The Holding | S (S) | — | ok |
| `codex_tyrant_six` | Six in the Mass | S (S) | — | ok |
| `codex_wayfinder_nature` | On Wayfinders | S (S) | — | ok |
| `codex_wayfinder_symptom` | The Fever Theory | S (S) | — | ok |
| `codex_seven_wayfinders` | The Ledger of Seven | S (S) | `codex_wayfinders` (D §10.5) | rename-in-D |
| `codex_dask` | The Flickering Man | S (S) | — | ok |
| `codex_region_silverwood_ruins` | The Ruins of Silverwood | S (S) | — | ok |
| `codex_region_mistwood_reach` | Mistwood and the Ironclad Reach | S (S) | — | ok |
| `codex_region_voidscar` | The Voidscar | S (S) | — | ok |
| `codex_region_highlands` | The Aether-Kissed Highlands | S (S) | — | ok |
| `codex_region_glowlands_nexus` | The Glowlands and the Nexus | S (S) | — | ok |
| `codex_region_silverwood_before` | Silverwood, Three Days Before | S (S) | — | ok |
| `codex_region_drowned_reach` | The Drowned Reach | S (S) | — | ok |
| `codex_region_ashen_steppe` | The Ashen Steppe | S (S) | — | ok |
| `codex_region_veil` | The Veil | S (S) | — | ok |
| `codex_region_glowfen` | The Glowfen | S (S) | — | ok |
| `codex_region_skyreach` | The Skyreach | S (S) | — | ok |
| `codex_region_threshold` | The Threshold | S (S) | — | ok |
| `codex_remnants` | The Remnants of Aethelgard | S (S) | — | ok |
| `codex_remnant_seal` | The Seal of the Remnants | S (S) | — | ok |
| `codex_weavers` | The Shadow Weavers | S (S) | — | ok |
| `codex_weaver_choir` | The Hollow Choir | S (S) | — | ok |
| `codex_ironclad` | The Ironclad Nomads | S (S) | — | ok |
| `codex_ironclad_oath` | The Oath and the Ember | S (S) | — | ok |
| `codex_creatures_leywarped` | Ley-Warped Things | S (S) | Shades, Wisps, Brutes (S) vs W families Hollowed / Spireborn / Wilds | rename-in-S: re-cut to W §5 families (`codex_creatures_<fam>` ×8; S count 85 → 87) |
| `codex_creatures_vanes_wards` | Vane's Wards | S (S) | Golems **and Sentinels** (S) vs W: Sentinels are Spireborn (Aulde) | rename-in-S: re-cut to W §5 families (`codex_creatures_<fam>` ×8; S count 85 → 87) |
| `codex_creatures_auldes_strands` | Aulde's Strands | S (S) | Weavers (S) vs W Spireborn (also Wisps, Sentinels) | rename-in-S: re-cut to W §5 families (`codex_creatures_<fam>` ×8; S count 85 → 87) |
| `codex_creatures_breachborn` | Breach-Born | S (S) | Phantoms, Aberrations, Unravelled (S) vs W Watch-wardens (Masque) + Unravelled | rename-in-S: re-cut to W §5 families (`codex_creatures_<fam>` ×8; S count 85 → 87) |
| `codex_creatures_drowned_and_fen` | The Drowned and the Fen | S (S) | Archivists + Mirelings (S) vs W Drowned / Green (two families) | rename-in-S: re-cut to W §5 families (`codex_creatures_<fam>` ×8; S count 85 → 87) |
| `codex_creatures_void_touched` | Void-Touched | S (S) | Stalkers (S) vs W Hollowed | rename-in-S: re-cut to W §5 families (`codex_creatures_<fam>` ×8; S count 85 → 87) |
| `codex_litany_1` | The Litany, Verse 1 | S (S) | — | ok |
| `codex_litany_2` | The Litany, Verse 2 | S (—) | — | ok |
| `codex_litany_3` | The Litany, Verse 3 | S (—) | — | ok |
| `codex_litany_4` | The Litany, Verse 4 | S (—) | — | ok |
| `codex_litany_5` | The Litany, Verse 5 | S (—) | — | ok |
| `codex_litany_6` | The Litany, Verse 6 | S (—) | — | ok |
| `codex_litany_7` | The Litany, Verse 7 | S (—) | — | ok |
| `codex_litany_8` | The Litany, Verse 8 | S (—) | — | ok |
| `codex_litany_9` | The Litany, Verse 9 | S (S) | — | ok |
| `codex_item_amulet` | The Amulet of Echoes | S (S) | — | ok |
| `codex_item_echo_crystal` | The Echo Crystal | S (S) | — | ok |
| `codex_item_lost_scroll` | The Scholar's Lost Scroll | S (S) | — | ok |
| `codex_item_dark_spellbook` | The Dark Spellbooks | S (S) | — | ok |
| `codex_item_chronos_lens` | The Chronos Lens | S (S) | — | ok |
| `codex_item_heartstone` | The Heartstone | S (S) | — | ok |
| `codex_item_void_shard` | Void Shards | S (S) | — | ok |
| `codex_item_breach_anchor` | The Breach-Anchor | S (S) | — | ok |
| `codex_breach` | The Temporal Breach | S (S) | `codex_sundering` (D §14.1 profile example) | rename-in-D |
| `codex_breach_clock` | The Thirtieth Dawn | S (S) | — | ok |
| `codex_loop` | On Returning | S (S) | — | ok |
| `codex_echoes` | Echoes | S (S) | — | ok |
| `codex_threshold_shore` | The Still Shore | S (S) | — | ok |
| `codex_anchors` | What the Chamber Keeps | S (S) | — | ok |
| `codex_place_shattered_library` | The Shattered Library | S (S) | — | ok |
| `codex_place_silverwood_plaza` | Silverwood Plaza | S (S) | — | ok |
| `codex_place_sunken_archives` | The Sunken Archives | S (S) | — | ok |
| `codex_place_heartstone_depths` | Heartstone Depths | S (S) | — | ok |
| `codex_place_chasm_of_whispers` | The Chasm of Whispers | S (S) | — | ok |
| `codex_place_emberforge` | The Emberforge | S (S) | — | ok |
| `codex_place_blighted_outpost` | Vane's Watch | S (S) | — | ok |
| `codex_place_chronos_nexus` | The Chronos Nexus | S (S) | — | ok |
| `codex_place_aetherium_spires` | The Aetherium Spires | S (S) | — | ok |
| `codex_place_wayfarers_respite` | The Wayfarer's Respite | S (S) | — | ok |
| `codex_place_lanternreed` | Lanternreed | S (S) | — | ok |
| `codex_place_ring_of_wagons` | The Ring of Wagons | S (S) | — | ok |
| `codex_place_hollow_choir` | The Hollow Choir | S (S) | — | ok |
| `codex_place_hallows_cairn` | Hallow's Cairn | S (S) | — | ok |
| `codex_place_high_mark` | The High Mark | S (S) | — | ok |
| `codex_ilyra` | Ilyra | S (S) | — | ok |
| `codex_brak_and_kaelen` | The Stonehand Brothers | S (S) | — | ok |
| `codex_borin` | Borin Stonefist | S (S) | — | ok |
| `codex_mireya` | Mireya of Lanternreed | S (S) | — | ok |
| `codex_caelum` | Caelum Vesper | S (S) | — | ok |
| `codex_present_leaders` | Dray, Ironvow, Sethe, Thistlecourt | S (S) | — | ok |
| `codex_void_resonance` | — | D §13.3 example (D) | — | remove (the Echo carries its own codex line, D-010) |

### 8. Scenes (20)

Nit: ending scenes use short tags (`scene_ending_vigil`, `_dawn`, `_silence`, `_archive`) while ending ids are `ending_wardens_vigil` etc.; acceptable, or align in U9.

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `scene_first_meeting_ilyra` | The whispers are louder | S (S) | — | ok |
| `scene_heartstone_choice` | Soothe, seize, or shatter | S (S) | — | ok |
| `scene_tyrant_defeat` | Witness the unraveling | S (S) | — | ok |
| `scene_braks_stand` | Brak Stonehand | S (S) | — | ok |
| `scene_ilyra_portal` | The Last Threshold | S (S) | — | ok |
| `scene_waking_loop_2` | The Amulet is warm | S (S) | — | ok |
| `scene_dask_introduction` | The Flickering Man | S (S) | — | ok |
| `scene_nyx_unmasking` | Nyxaria Vell | S (S) | — | ok |
| `scene_tyrant_first_words` | It cannot ask | S (S) | — | ok |
| `scene_braks_brother` | Blood and salt | S (S) | — | ok |
| `scene_anchor_in_the_conflux` | Iron that does not wish | S (S) | — | ok |
| `scene_caelum_crossing` | Nobody delivered the message | S (S) | — | ok |
| `scene_the_first_drowned` | Oriel's carrel | S (S) | — | ok |
| `scene_clock_expiry` | The thirtieth dawn | S (S) | — | ok |
| `scene_ending_vigil` | I hold you | S (S) | — | ok |
| `scene_ending_mending` | Hour, go | S (S) | — | ok |
| `scene_ending_dawn` | His face | S (S) | — | ok |
| `scene_ending_silence` | Quiet | S (S) | — | ok |
| `scene_ending_archive` | The thirty-first day | S (S) | — | ok |
| `scene_ending_unbound` | Not my world | S (S) | — | ok |
| `scene_echo_crystal` | The Crystal choice | S (S §4.1 beat 4 only) | — | add-to-S §13 or rename to a dialogue node of `q_echo_crystal` |
| `scene_done:<id>` | (flag string) | P §5.10 | — | rename-in-P → `flag_scene_done_<scene>` (D-044 `flag_`) |

### 9. Endings and loop-closers

Closer reasons: `closer_escape` (portal, any loop; D-060) and `closer_fall` with `reason` ∈ `death` | `expiry` | `rejected`. Loop 1 death is the FALLEN screen (D-049), recorded as `closer_fall`/`death` with no Threshold. S §10.7's fourth reason `portal` (Loop 2+) becomes `closer_escape`.

| id | name | letter | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|---|
| `ending_wardens_vigil` | The Warden's Vigil | A | S/X (SW) | `vigil` (P A.5); "A" (D); record Echo `echo_vigil_kept` (D §10.5) | rename-in-P,D |
| `ending_mending` | The Mending | B | S/X (SDW) | `mending` (P A.5); `echo_mending_done` (D) | rename-in-P,D |
| `ending_weavers_dawn` | The Weaver's Dawn | C | S/X (SW) | `weavers_dawn` (P A.5); `echo_weavers_dawn` (D) | rename-in-P,D |
| `ending_iron_silence` | The Iron Silence | D | S/X (SW) | `iron_silence` (P A.5); `echo_iron_silence` (D) | rename-in-P,D |
| `ending_long_archive` | The Long Archive | E | S/X (SW) | `long_archive` (P A.5); `echo_long_archive` (D) | rename-in-P,D |
| `ending_unbound` | The Unbound | F | S/X (SW) | `unbound` (P A.5); `echo_unbound` (D) | rename-in-P,D |
| `closer_escape` | The Escape | — | S/X (XSW) | `escape` (P A.5, §4.11) | rename-in-P; used for every portal flight in any loop (D-060) |
| `closer_fall` | The Fall | — | S/X (XSW) | `fall`, `loop1_death` (P A.5, §4.11); `fall_clock`, `fall_death` (D §4.7, §10.2) | rename-in-P,D → `closer_fall` + `reason` (`death`/`expiry`/`rejected`) |

### 10.1 Creatures (57)

Families `fam_<family>` (W §5). D §8.2 material families map: `shade`,`void_touched`→hollowed; `wildling`→wilds; `drowned`→drowned; `golem`→wards; `wisp`,`aetherial`,`sentinel`→spireborn; `mireling`→green; `phantom`,`aberration`→watch_wardens.

| id | display name | family | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|---|
| `cr_corrupted_shade` | Corrupted Shade | hollowed | W (W) | `corrupted_shade` (P A.3); `corrupted_shade` (D §4.12) | rename-in-D |
| `cr_starved_shadow` | Starved Shadow | hollowed | W (W) | — | ok |
| `cr_hollow_lantern` | Hollow Lantern | hollowed | W (W) | — | ok |
| `cr_null_mouth` | Null Mouth | hollowed | W (W) | — | ok |
| `cr_void_touched_stalker` | Void-Touched Stalker | hollowed | W (W) | `void_touched_stalker` (P A.3) | rename-in-P |
| `cr_vells_umbra` | Vell's Umbra (boss) | hollowed | W (W) | — | ok |
| `cr_wildling_brute` | Wildling Brute | wilds | W (W) | `wildling_brute` (P A.3); `wildling_brute` (D §4.12, §14 ex.); `{killed:"wildling_brute"}` (S q_clear_path) | rename-in-D,S |
| `cr_rootling` | Rootling | wilds | W (W) | — | ok |
| `cr_mistwood_prowler` | Mistwood Prowler | wilds | W (W) | — | ok |
| `cr_salt_jackal` | Salt Jackal | wilds | W (W) | — | ok |
| `cr_steppe_harrier` | Steppe Harrier | wilds | W (W) | — | ok |
| `cr_cinderback` | Cinderback | wilds | W (W) | — | ok |
| `cr_ashmaw` | Ashmaw (boss) | wilds | W (W) | — | ok |
| `cr_ley_hound` | Ley Hound | wilds | W (W) | — | ok |
| `cr_drowned_archivist` | Drowned Archivist | drowned | W (W) | `drowned_archivist` (P A.3); "the First Drowned" (S; D-046 Oriel variant, flag not a new id) | ok |
| `cr_tide_clerk` | Tide Clerk | drowned | W (W) | — | ok |
| `cr_pale_diver` | Pale Diver | drowned | W (W) | — | ok |
| `cr_brine_lamprey` | Brine Lamprey | drowned | W (W) | — | ok |
| `cr_ledger_choir` | Ledger Choir | drowned | W (W) | — | ok |
| `cr_bell_ringer` | Bell-Ringer | drowned | W (W) | — | ok |
| `cr_bell_warden` | The Bell-Warden (boss) | drowned | W (W) | — | ok |
| `cr_stone_hide_golem` | Stone-Hide Golem | wards | W (W) | `stone_hide_golem` (P A.3) | rename-in-P |
| `cr_warding_pillar` | Warding Pillar | wards | W (W) | — | ok |
| `cr_ninefold_knight` | Ninefold Knight | wards | W (W) | — | ok |
| `cr_unbroken_warden` | The Unbroken Warden (boss) | wards | W (W) | — | ok |
| `cr_arcane_wisp` | Arcane Wisp | spireborn | W (W) | `arcane_wisp` (P A.3) | rename-in-P |
| `cr_paradox_wisp` | Paradox Wisp (anomaly) | spireborn | W (W) | — | ok |
| `cr_glass_mote` | Glass Mote | spireborn | W (W) | — | ok |
| `cr_aetherial_weaver` | Aetherial Weaver | spireborn | W (W) | `aetherial_weaver` (P A.3) | rename-in-P |
| `cr_spire_loom` | Spire Loom | spireborn | W (W) | — | ok |
| `cr_sky_whisper_sentinel` | Sky-Whisper Sentinel | spireborn | W (W) | `sky_whisper_sentinel` (P A.3) | rename-in-P |
| `cr_gale_kite` | Gale Kite | spireborn | W (W) | — | ok |
| `cr_cloud_ray` | Cloud Ray | spireborn | W (W) | — | ok |
| `cr_stormcrown` | The Stormcrown (boss) | spireborn | W (W) | — | ok |
| `cr_glowfen_mireling` | Glowfen Mireling | green | W (W) | `glowfen_mireling` (P A.3) | rename-in-P |
| `cr_lantern_toad` | Lantern Toad | green | W (W) | — | ok |
| `cr_spore_drift` | Spore Drift | green | W (W) | — | ok |
| `cr_reed_stalker` | Reed Stalker | green | W (W) | — | ok |
| `cr_barrow_light` | Barrow-Light | green | W (W) | — | ok |
| `cr_lantern_matron` | The Lantern Matron (boss) | green | W (W) | — | ok |
| `cr_temporal_aberration` | Temporal Aberration | watch_wardens | W (W) | `temporal_aberration` (P A.3, D §4.10) | rename-in-P,D |
| `cr_shimmering_phantom` | Shimmering Phantom | watch_wardens | W (W) | `shimmering_phantom` (P A.3) | rename-in-P |
| `cr_moment_moth` | Moment Moth | watch_wardens | W (W) | — | ok |
| `cr_hourglass_crawler` | Hourglass Crawler | watch_wardens | W (W) | — | ok |
| `cr_orrery_knight` | Orrery Knight | watch_wardens | W (W) | — | ok |
| `cr_stutter_hound` | Stutter Hound (anomaly) | watch_wardens | W (W) | — | ok |
| `cr_hour_leech` | Hour Leech (anomaly) | watch_wardens | W (W) | — | ok |
| `cr_horde_husk` | Horde Husk | unravelled | W (W) | "Unravelled" (S q_day_of_teeth, §8.6) | ok (S family word; W id) |
| `cr_unraveling_tide` | The Unraveling Tide (Horde boss) | unravelled | W (W) | — | ok |
| `cr_unmade` | The Unmade (anomaly) | unravelled | W (W) | — | ok |
| `cr_redundant_wayfinder` | Redundant Wayfinder (anomaly) | unravelled | W (W) | — | ok |
| `cr_tyrants_reach` | Tyrant's Reach (anomaly) | unravelled | W (W) | `nine_shard` (D §4.10, §8.2) | rename-in-D (W §13.2 E14) |
| `cr_chronos_tyrant_contained` | The Chronos Tyrant, Contained (boss, Loop 1) | unravelled | W (XW) | `chronos_tyrant_contained` (D §4.10); `chronos_tyrant` (P A.3, legacy single id) | rename-in-D,P (D-051 split) |
| `cr_chronos_tyrant_unveiled` | The Chronos Tyrant, Unveiled (boss, Loop 2+) | unravelled | W (XW) | `chronos_tyrant_unveiled` (D §4.10); `chronos_tyrant` (P A.3) | rename-in-D,P |
| `cr_city_watch_halberdier` | City Watch Halberdier | mortal | W (W) | — | ok |
| `cr_circle_adept` | Circle Adept | mortal | W (W) | — | ok |
| `cr_veil_sentry` | Veil Sentry | mortal | W (W) | — | ok |

### 10.2 Anomaly variants (16)

W §6 also has six anomaly *creatures* (`cr_paradox_wisp`, `cr_stutter_hound`, `cr_hour_leech`, `cr_unmade`, `cr_redundant_wayfinder`, `cr_tyrants_reach`); these 16 are variants of existing creatures. Region column values in W §10.2 drop `region_`: write full ids in data.

| id | twist | base | aliases | action |
|---|---|---|---|---|
| `cr_anomaly_echoed_shade` | Repeats its previous intent; both are shown. | cr_corrupted_shade | `anomaly_echoed_shade` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_split_wisp` | At half HP it splits into two wisps at 40%. | cr_arcane_wisp | `anomaly_split_wisp` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_frayed_brute` | Permanent Haste; telegraphs two intents. | cr_wildling_brute | `anomaly_frayed_brute` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_rootbound_pack` | Three rootlings share one HP pool. | cr_rootling ×3 | `anomaly_rootbound_pack` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_phase_stalker` | Phased on even turns; Void damage still lands. | cr_void_touched_stalker | `anomaly_phase_stalker` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_tethered_stalkers` | Damage to one is split between both. | cr_void_touched_stalker ×2 | `anomaly_tethered_stalkers` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_doubled_phantom` | Fights beside its past self (a 50% HP copy). | cr_shimmering_phantom | `anomaly_doubled_phantom` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_flat_chord_weaver` | Its Shock chains to you and your companion. | cr_aetherial_weaver | `anomaly_flat_chord_weaver` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_aberration_pair` | Two Aberrations share one Rewind (Nexus only). | cr_temporal_aberration ×2 | `anomaly_aberration_pair` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_late_mireling` | Acts every other turn; each act hits twice. | cr_glowfen_mireling | `anomaly_late_mireling` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_unfiled_archivist` | Rewinds a wounded ally instead of attacking. | cr_drowned_archivist | `anomaly_unfiled_archivist` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_one_herd` | Three jackals act on one initiative. | cr_salt_jackal ×3 | `anomaly_one_herd` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_unlit_lantern` | Intent hidden until it takes damage. | cr_hollow_lantern | `anomaly_unlit_lantern` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_seeding_toad` | Adds one Spore Drift each turn (max 2). | cr_lantern_toad | `anomaly_seeding_toad` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_still_kite` | Ignores the gale; strikes twice at dawn. | cr_gale_kite | `anomaly_still_kite` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |
| `cr_anomaly_early_hound` | Roams on First Bell, out of its day. | cr_ley_hound | `anomaly_early_hound` (W §10.2); `anomaly_*` (D §6.6) | rename-in-W,D (D-044 has no `anomaly_` prefix) |

### 10.3 Tyrant phases, movements and moves

| id | meaning | owner | aliases | action |
|---|---|---|---|---|
| `tyr_movement_1` | Movement I — The Holding / Phase 1 (both Tyrants) | X D-054; W | "Lament" (D §4.10 Unveiled P1) | ok; Unveiled P1 display name "Lament" may stay as subtitle |
| `tyr_movement_2` | Movement II — The Fracture / Phase 2 | X D-054; W | "The Nine Surface" (D Unveiled P2) | ok |
| `tyr_movement_3` | Movement III — The Nine Speak / Phase 3 | X D-054; W | "Chrono-Strike" (D Unveiled P3) | ok |
| `tyr_phase_4` | The Hold Fails (Unveiled only) | D §4.10, W | unnamed id in D/W | add id (D-051: Unveiled has 4 phases; communion has 3 Movements) |
| `tyr_shear`, `tyr_time_lash`, `tyr_grasp`, `tyr_remember`, `tyr_chrono_strike`, `tyr_unraveling` | shared moves | D §4.10 + W §6.8 | — | ok |
| `tyr_brace`, `tyr_korr_burns`, `tyr_vane_closes`, `tyr_gather`, `tyr_aulde_sings`, `tyr_sallow_breathes`, `tyr_speak`, `tyr_hour_presses` | W moves | W §6.8 | — | D §4.10 adopt (they implement S §8.4) |
| `tyr_q_why`, `_hour`, `_before`, `_korr`, `_vane`, `_aulde`, `_sallow`, `_masque`, `_hallow`, `_choice` | communion questions | W §6.8 (S §8.3 beats) | — | ok |
| `tyr_stillness` | terminal communion phase | D §4.11 | — | remove → Movement III outcome (D-054) |

### 11. Abilities (75 class + 24 companion + 1 item)

Basic-attack kinds (`melee`, `ranged_bow`, `magic_staff`, `shield_heavy`, `void_focus`, D §5.7) are weapon types, not ability ids. Creature moves are scoped to their creature (W §6 move ids such as `choir_verse`).

| id | name | class · branch tier | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|---|
| `rgr_marked_shot` | Marked Shot | ranger · Hunt T1 | D (—) | `rng_marked_shot` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_piercing_arrow` | Piercing Arrow | ranger · Hunt T2 | D (—) | `rng_piercing_arrow` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_hunters_eye` | Hunter's Eye | ranger · Hunt T3 | D (—) | `rng_hunters_eye` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_pinning_shot` | Pinning Shot | ranger · Hunt T4 | D (—) | `rng_pinning_shot` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_killing_shot` | Killing Shot | ranger · Hunt T5 | D (—) | `rng_killing_shot` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_rend` | Rend | ranger · Steel T1 | D (—) | `rng_rend` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_riposte_stance` | Riposte Stance | ranger · Steel T2 | D (—) | `rng_riposte_stance` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_hamstring` | Hamstring | ranger · Steel T3 | D (—) | `rng_hamstring` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_whirling_steel` | Whirling Steel | ranger · Steel T4 | D (—) | `rng_whirling_steel` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_exsanguinate` | Exsanguinate | ranger · Steel T5 | D (—) | `rng_exsanguinate` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_venom_coat` | Venom Coat | ranger · Wildcraft T1 | D (—) | `rng_venom_coat` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_field_dressing` | Field Dressing | ranger · Wildcraft T2 | D (—) | `rng_field_dressing` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_snare_trap` | Snare Trap | ranger · Wildcraft T3 | D (—) | `rng_snare_trap` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_smoke_bomb` | Smoke Bomb | ranger · Wildcraft T4 | D (—) | `rng_smoke_bomb` (D §5.2, §4) | rename-in-D (D-061) |
| `rgr_apex_predator` | Apex Predator | ranger · Wildcraft T5 | D (—) | `rng_apex_predator` (D §5.2, §4) | rename-in-D (D-061) |
| `wiz_fireball` | Fireball | wizard · Pyre T1 | D (X) | `fireball` (D §5.3) | rename-in-D (D-044) |
| `wiz_cinder_shield` | Cinder Shield | wizard · Pyre T2 | D (D) | — | ok |
| `wiz_flame_wave` | Flame Wave | wizard · Pyre T3 | D (D) | — | ok |
| `wiz_immolate` | Immolate | wizard · Pyre T4 | D (D) | — | ok |
| `wiz_pyre_of_the_nine` | Pyre of the Nine | wizard · Pyre T5 | D (D) | — | ok |
| `wiz_static_lash` | Static Lash | wizard · Storm T1 | D (D) | — | ok |
| `wiz_lightning_bolt` | Lightning Bolt | wizard · Storm T2 | D (X) | `lightning_bolt` (D §5.3) | rename-in-D (D-044) |
| `wiz_gale_step` | Gale Step | wizard · Storm T3 | D (D) | — | ok |
| `wiz_chain_tempest` | Chain Tempest | wizard · Storm T4 | D (D) | — | ok |
| `wiz_skyfall` | Skyfall | wizard · Storm T5 | D (D) | — | ok |
| `wiz_echo_bolt` | Echo Bolt | wizard · Chronomancy T1 | D (X) | `echo_bolt` (D §5.3) | rename-in-D (D-044) |
| `wiz_temporal_drag` | Temporal Drag | wizard · Chronomancy T2 | D (D) | — | ok |
| `wiz_rewind` | Rewind | wizard · Chronomancy T3 | D (D) | — | ok |
| `wiz_stutter` | Stutter | wizard · Chronomancy T4 | D (D) | — | ok |
| `wiz_unmoment` | Unmoment | wizard · Chronomancy T5 | D (D) | — | ok |
| `elf_twin_strike` | Twin Strike | elf · Bladesong T1 | D (D) | — | ok |
| `elf_dancers_guard` | Dancer's Guard | elf · Bladesong T2 | D (D) | — | ok |
| `elf_flurry` | Flurry | elf · Bladesong T3 | D (D) | — | ok |
| `elf_crescendo` | Crescendo | elf · Bladesong T4 | D (D) | — | ok |
| `elf_final_verse` | Final Verse | elf · Bladesong T5 | D (D) | — | ok |
| `elf_ley_mend` | Ley Mend | elf · Leyweave T1 | D (D) | — | ok |
| `elf_barkskin` | Barkskin | elf · Leyweave T2 | D (D) | — | ok |
| `elf_thornlash` | Thornlash | elf · Leyweave T3 | D (D) | — | ok |
| `elf_silverwood_bloom` | Silverwood Bloom | elf · Leyweave T4 | D (D) | — | ok |
| `elf_heart_of_the_grove` | Heart of the Grove | elf · Leyweave T5 | D (D) | — | ok |
| `elf_shadowstep` | Shadowstep | elf · Shadowstep T1 | D (D) | — | ok |
| `elf_ambush` | Ambush | elf · Shadowstep T2 | D (D) | — | ok |
| `elf_blink_strike` | Blink Strike | elf · Shadowstep T3 | D (D) | — | ok |
| `elf_veilwalk` | Veilwalk | elf · Shadowstep T4 | D (D) | — | ok |
| `elf_moment_between` | The Moment Between | elf · Shadowstep T5 | D (D) | — | ok |
| `wrd_iron_guard` | Iron Guard | ironclad_warden · Bulwark T1 | D (D) | — | ok |
| `wrd_challenge` | Challenge | ironclad_warden · Bulwark T2 | D (D) | — | ok |
| `wrd_shield_wall` | Shield Wall | ironclad_warden · Bulwark T3 | D (D) | — | ok |
| `wrd_unbroken` | Unbroken | ironclad_warden · Bulwark T4 | D (D) | — | ok |
| `wrd_last_bastion` | Last Bastion | ironclad_warden · Bulwark T5 | D (D) | — | ok |
| `wrd_crushing_blow` | Crushing Blow | ironclad_warden · Breaker T1 | D (D) | — | ok |
| `wrd_concussive_slam` | Concussive Slam | ironclad_warden · Breaker T2 | D (D) | — | ok |
| `wrd_earthbreaker` | Earthbreaker | ironclad_warden · Breaker T3 | D (D) | — | ok |
| `wrd_executioners_arc` | Executioner's Arc | ironclad_warden · Breaker T4 | D (D) | — | ok |
| `wrd_mountainfall` | Mountainfall | ironclad_warden · Breaker T5 | D (D) | — | ok |
| `wrd_steady_breath` | Steady Breath | ironclad_warden · Iron Will T1 | D (D) | — | ok |
| `wrd_null_plate` | Null Plate | ironclad_warden · Iron Will T2 | D (D) | — | ok |
| `wrd_spellbreaker` | Spellbreaker | ironclad_warden · Iron Will T3 | D (D) | — | ok |
| `wrd_oathbound` | Oathbound | ironclad_warden · Iron Will T4 | D (D) | — | ok |
| `wrd_iron_silence` | Iron Silence | ironclad_warden · Iron Will T5 | D (D) | — | ok |
| `wvr_hex_of_frailty` | Hex of Frailty | shadow_weaver · Hex T1 | D (D) | — | ok |
| `wvr_mark_of_the_void` | Mark of the Void | shadow_weaver · Hex T2 | D (D) | — | ok |
| `wvr_wither` | Wither | shadow_weaver · Hex T3 | D (D) | — | ok |
| `wvr_doom_sigil` | Doom Sigil | shadow_weaver · Hex T4 | D (D) | — | ok |
| `wvr_ninefold_hex` | Ninefold Hex | shadow_weaver · Hex T5 | D (D) | — | ok |
| `wvr_siphon` | Siphon | shadow_weaver · Drain T1 | D (D) | — | ok |
| `wvr_blood_pact` | Blood Pact | shadow_weaver · Drain T2 | D (D) | — | ok |
| `wvr_leech_veil` | Leech Veil | shadow_weaver · Drain T3 | D (D) | — | ok |
| `wvr_soul_tether` | Soul Tether | shadow_weaver · Drain T4 | D (D) | — | ok |
| `wvr_feast_of_moments` | Feast of Moments | shadow_weaver · Drain T5 | D (D) | — | ok |
| `wvr_void_lance` | Void Lance | shadow_weaver · Unmaking T1 | D (D) | — | ok |
| `wvr_unravel` | Unravel | shadow_weaver · Unmaking T2 | D (D) | — | ok |
| `wvr_breach_echo` | Breach Echo | shadow_weaver · Unmaking T3 | D (D) | — | ok |
| `wvr_collapse` | Collapse | shadow_weaver · Unmaking T4 | D (D) | — | ok |
| `wvr_unmaking_word` | The Unmaking Word | shadow_weaver · Unmaking T5 | D (D) | — | ok |
| `comp_ilyra_ley_dart` | Ley Dart | Ilyra · attack | D (D) | — | ok |
| `comp_ilyra_ward` | Ward | Ilyra · shield | D (D) | — | ok |
| `comp_ilyra_mend` | Mend | Ilyra · heal | D (D) | — | ok |
| `comp_ilyra_archive_light` | Archive Light | Ilyra · signature, CD 4 | D (D) | — | ok |
| `comp_brak_axe` | Axe | Brak · attack | D (D) | — | ok |
| `comp_brak_cleave` | Cleave | Brak · aoe | D (D) | — | ok |
| `comp_brak_shieldbreak` | Shieldbreak | Brak · debuff | D (D) | — | ok |
| `comp_brak_hold_the_line` | Hold The Line | Brak · signature, CD 4 | D (D) | — | ok |
| `comp_nyx_void_needle` | Void Needle | Nyx · attack | D (D) | — | ok |
| `comp_nyx_hex` | Hex | Nyx · debuff | D (D) | — | ok |
| `comp_nyx_drink` | Drink | Nyx · heal (self) | D (D) | — | ok |
| `comp_nyx_unmaking` | Unmaking | Nyx · signature, CD 4 | D (D) | — | ok |
| `comp_dask_flicker_strike` | Flicker Strike | Dask · attack | D (D) | — | ok |
| `comp_dask_stall` | Stall | Dask · debuff | D (D) | — | ok |
| `comp_dask_glimpse` | Glimpse | Dask · utility | D (D) | — | ok |
| `comp_dask_between_instants` | Between Instants | Dask · signature, CD 5 | D (D) | — | ok |
| `comp_mireya_glowsalve` | Glowsalve | Mireya · heal | D (D) | — | ok |
| `comp_mireya_spore_cloud` | Spore Cloud | Mireya · debuff | D (D) | — | ok |
| `comp_mireya_lantern_light` | Lantern Light | Mireya · attack | D (D) | — | ok |
| `comp_mireya_lanternreed_bloom` | Lanternreed Bloom | Mireya · signature, CD 5 | D (D) | — | ok |
| `comp_caelum_chrono_shard` | Chrono Shard | Caelum · attack | D (D) | — | ok |
| `comp_caelum_haste` | Haste | Caelum · buff | D (D) | — | ok |
| `comp_caelum_foresight` | Foresight | Caelum · shield | D (D) | — | ok |
| `comp_caelum_stutter` | Stutter | Caelum · signature, CD 4 | D (D) | — | ok |
| `itm_echo_bolt` | Echo Bolt (Amulet) | item · Amulet of Echoes | X D-047 (XW) | — | add-to-D §5.7 (10 MP, Ley, ≈0.9× basic) |

### 12. Statuses (18 + rested)

P's `status_on_hit` / `status_immunity` are effect-kind literals in a zod schema, not status ids: rename to camelCase (`statusOnHit`, `statusImmunity`) so grep for `status_` stays clean.

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `status_bleed` | Bleed | D (DW) | `bleed` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_burn` | Burn | D (DW) | `burn` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_shock` | Shock | D (DW) | `shock` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_soaked` | Soaked | D (DW) | `soaked` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_slow` | Slow | D (DW) | `slow` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_haste` | Haste | D (D) | `haste` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_stun` | Stun | D (D) | `stun` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_weaken` | Weaken | D (DW) | `weaken` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_armor_break` | Armor Break | D (DW) | `armor_break` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_mark` | Mark | D (D) | `mark` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_curse` | Curse | D (DW) | `curse` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_shield` | Shield | D (DW) | `shield` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_regen` | Regen | D (DW) | `regen` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_taunt` | Taunt | D (D) | `taunt` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_phase` | Phase | D (D) | `phase` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_rewind` | Rewind | D (D) | `rewind` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_poison` | Poison | D (DW) | `poison` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_blind` | Blind | D (DW) | `blind` (P §5.8 CANONICAL_STATUSES; W creature-block shorthand) | rename-in-P (W shorthand is prose-only) |
| `status_rested` | Rested | D (D) | — | ok (D §4.5 note; 19th status, camp buff) |

### 13. Affixes (12)

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `affix_of_embers` | of Embers | D (DW) | — | ok |
| `affix_of_the_gale` | of the Gale | D (DW) | — | ok |
| `affix_of_ley` | of the Ley | D (DW) | — | ok |
| `affix_of_the_void` | of the Void | D (DW) | — | ok |
| `affix_of_moments` | of Moments | D (DW) | — | ok |
| `affix_of_iron` | of Iron | D (DW) | — | ok |
| `affix_of_the_hunt` | of the Hunt | D (D) | — | ok |
| `affix_of_vigor` | of Vigor | D (DW) | — | ok |
| `affix_of_the_wellspring` | of the Wellspring | D (DW) | — | ok |
| `affix_of_thorns` | of Thorns | D (D) | — | ok |
| `affix_of_the_warden` | of the Warden | D (DW) | — | ok |
| `affix_of_echoes` | of Echoes | D (DW) | — | ok |

### 14. Materials (22 DESIGN + 4 WORLD regional)

D owns `mat_*` (D-062). Three legacy items double as materials and keep `item_` ids. Tier T5 is a W proposal (D §7.4 stops at T4).

| id | name | tier | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|---|
| `mat_shadow_ash` | Shadow Ash | T1 | D (DW) | — | ok |
| `mat_wildling_hide` | Wildling Hide | T1 | D (DW) | — | ok |
| `mat_rootbone` | Rootbone | T1 | D (DW) | — | ok |
| `mat_ley_spark` | Ley Spark | T1 | D (DW) | — | ok |
| `mat_ley_resin` | Ley Resin | T1 | D (DW) | `mat_lantern_resin` (W Glowfen ×3) | rename-in-W |
| `mat_iron_rivet` | Iron Rivet | T1 | D (DW) | — | ok |
| `mat_steppe_salt` | Steppe Salt | T2 | D (DW) | "Respite salt" (S q_blood_and_salt) | ok (name) |
| `mat_sodden_vellum` | Sodden Vellum | T2 | D (DW) | — | ok |
| `item_void_shard` | Void Shard | T2 | D (DW) | `void_shard` (P A.4); `{item:"void_shard"}` (S q_void_shards) | rename-in-S |
| `mat_slate_core` | Slate Core | T2 | D (DW) | — | ok |
| `mat_ember_ore` | Ember Ore | T2 | D (DW) | — | ok |
| `mat_bell_bronze` | Bell Bronze | T2 | D (W proposes) (W) | — | add-to-D §8.2 (W §13.3 E-10) |
| `mat_cinder_horn` | Cinder Horn | T3 | D (W proposes) (W) | — | add-to-D §8.2 (W §13.3 E-10) |
| `mat_frayed_moment` | Frayed Moment | T3 | D (DW) | — | ok |
| `item_aetherium_shard` | Aetherium Shard | T3 | D (DW) | `aetherium_shard` (P A.4) | rename-in-P |
| `mat_spire_thread` | Spire Thread | T3 | D (DW) | — | ok |
| `mat_gale_feather` | Gale Feather | T3 | D (DW) | `item_gale_feather` (W loc_stormcrowns_perch) | rename-in-W |
| `mat_glow_gland` | Glow Gland | T3 | D (DW) | `mat_glow_spore` (W loc_veridian_glowlands, loc_sporelight_shallows) | rename-in-W |
| `mat_storm_glass` | Storm Glass | T3 | D (W proposes) (W) | — | add-to-D §8.2 (W §13.3 E-10) |
| `mat_drowned_pearl` | Drowned Pearl | T3 | D (DW) | — | ok |
| `mat_breach_glass` | Breach Glass | T4 | D (DW) | "`nine_shard` adds" source (D §8.2) | rename source to `cr_tyrants_reach` in D |
| `mat_umbral_thread` | Umbral Thread | T4 | D (W proposes) (W) | — | add-to-D §8.2 (W §13.3 E-10) |
| `mat_skyreach_crystal` | Skyreach Crystal | T4 | D (DW) | — | ok |
| `mat_silverwood_heartwood` | Silverwood Heartwood | T5 | D (DW) | — | ok |
| `mat_tyrant_shard` | Tyrant Shard | T5 | D (DW) | `chronos_tyrant_*` source (D §8.2) | rename source in D |
| `item_chronal_dust` | Chronal Dust | T2 | D (DW) | `mat_conflux_dust` (W loc_conflux_chamber); `chronal_dust` (P A.4) | rename-in-W,P |

### 15. Items

W §7 (132 rows) + the two legacy shard materials. With the 22 `mat_*` and 4 regional materials this is W's 157 (D budget 139; trim list W §13.6 OQ6). Every `item_*` in D also occurs in W. Names: W's, except quest items whose story role S names (W §13.3).

| id | name | type (W §7) | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|---|
| `item_rusty_dagger` | Rusty Dagger | weapon melee | D mech · W place (DW) | `rusty_dagger` (P A.4) | rename-in-P |
| `item_travelers_sword` | Traveler's Sword | weapon melee | D mech · W place (DW) | `travelers_sword` (P A.4) | rename-in-P |
| `item_warriors_sword` | Warrior's Sword | weapon melee | D mech · W place (DW) | `warriors_sword` (P A.4) | rename-in-P |
| `item_shadow_kissed_dagger` | Shadow-Kissed Dagger | weapon melee | D mech · W place (DW) | `shadow_kissed_dagger` (P A.4) | rename-in-P |
| `item_nomad_sabre` | Nomad Sabre | weapon melee | D mech · W place (W) | — | ok |
| `item_voidforged_edge` | Void-forged Edge | weapon melee | D mech · W place (DW) | — | ok |
| `item_emberwrought_blade` | Emberwrought Blade | weapon melee | D mech · W place (W) | — | ok |
| `item_breachsteel_blade` | Breachsteel Blade | weapon melee | D mech · W place (W) | — | ok |
| `item_primitive_bow` | Primitive Bow | weapon ranged_bow | D mech · W place (DW) | `primitive_bow` (P A.4) | rename-in-P |
| `item_elven_bow` | Elven Bow | weapon ranged_bow | D mech · W place (DW) | `elven_bow` (P A.4) | rename-in-P |
| `item_harrier_bow` | Harrier Bow | weapon ranged_bow | D mech · W place (W) | — | ok |
| `item_lanternwood_bow` | Lanternwood Bow | weapon ranged_bow | D mech · W place (W) | — | ok |
| `item_galefeather_bow` | Galefeather Bow | weapon ranged_bow | D mech · W place (W) | — | ok |
| `item_heartwood_bow` | Heartwood Bow | weapon ranged_bow | D mech · W place (W) | — | ok |
| `item_apprentice_staff` | Apprentice Staff | weapon magic_staff | D mech · W place (DW) | `apprentice_staff` (P A.4) | rename-in-P |
| `item_necromancer_staff` | Necromancer Staff | weapon magic_staff | D mech · W place (DW) | `necromancer_staff` (P A.4) | rename-in-P |
| `item_scriptorium_staff` | Scriptorium Staff | weapon magic_staff | D mech · W place (W) | — | ok |
| `item_ley_tuned_staff` | Ley-tuned Staff | weapon magic_staff | D mech · W place (W) | — | ok |
| `item_spire_builders_staff` | Spire-Builder's Staff | weapon magic_staff | D mech · W place (W) | — | ok |
| `item_hour_spindle` | Hour Spindle | weapon magic_staff | D mech · W place (W) | — | ok |
| `item_nomads_maul` | Nomad's Maul | weapon shield_heavy | D mech · W place (DW) | — | ok |
| `item_ironclad_hammer` | Ironclad Hammer | weapon shield_heavy | D mech · W place (W) | — | ok |
| `item_bell_clapper` | Bell-Warden's Clapper | weapon shield_heavy | D mech · W place (W) | — | ok |
| `item_blackreeds_axe` | Blackreed's Axe | weapon shield_heavy | D mech · W place (W) | "Blackreed's Axe" (S q_day_of_teeth) | ok |
| `item_hearth_iron_greataxe` | Hearth-Iron Greataxe | weapon shield_heavy | D mech · W place (W) | — | ok |
| `item_hallows_hammer` | Hallow's Hammer | weapon shield_heavy | D mech · W place (W) | — | ok |
| `item_cracked_void_focus` | Cracked Void Focus | weapon void_focus | D mech · W place (DW) | — | ok |
| `item_chasmglass_focus` | Chasmglass Focus | weapon void_focus | D mech · W place (W) | — | ok |
| `item_hollow_lantern_focus` | Hollow Lantern Focus | weapon void_focus | D mech · W place (W) | — | ok |
| `item_umbral_mirror` | Umbral Mirror | weapon void_focus | D mech · W place (W) | — | ok |
| `item_nyxs_shardglass` | Nyx's Shardglass | weapon void_focus | D mech · W place (DW) | `item_nyxarias_quiet` (W loc_where_she_fell) | rename-in-W |
| `item_breachglass_focus` | Breachglass Focus | weapon void_focus | D mech · W place (W) | — | ok |
| `item_wildling_hide_armor` | Wildling Hide Armor | armor | D mech · W place (DW) | `wildling_hide_armor` (P A.4) | rename-in-P |
| `item_scribes_robe` | Scribe's Robe | armor | D mech · W place (W) | — | ok |
| `item_ironclad_mail` | Ironclad Mail | armor | D mech · W place (DW) | `ironclad_mail` (P A.4) | rename-in-P |
| `item_scrap_harness` | Scrap Harness | armor | D mech · W place (DW) | — | ok |
| `item_salt_wind_cloak` | Salt-Wind Cloak | armor | D mech · W place (W) | — | ok |
| `item_divers_coat` | Diver's Coat | armor | D mech · W place (W) | — | ok |
| `item_steppe_lamellar` | Steppe Lamellar | armor | D mech · W place (W) | — | ok |
| `item_ironclad_plate_armor` | Ironclad Plate Armor | armor | D mech · W place (DW) | `ironclad_plate_armor` (P A.4) | rename-in-P |
| `item_sky_whisper_cloak` | Sky-Whisper Cloak | armor | D mech · W place (W) | — | ok |
| `item_ley_tuned_vestment` | Ley-tuned Vestment | armor | D mech · W place (W) | — | ok |
| `item_veil_threadmail` | Veil Threadmail | armor | D mech · W place (W) | — | ok |
| `item_voidforged_mail` | Void-forged Mail | armor | D mech · W place (DW) | — | ok |
| `item_cinderhorn_plate` | Cinderhorn Plate | armor | D mech · W place (W) | — | ok |
| `item_spireweave_mantle` | Spireweave Mantle | armor | D mech · W place (W) | — | ok |
| `item_oathplate` | Oathplate | armor | D mech · W place (DW) | — | ok |
| `item_conflux_robe` | Conflux Robe | armor | D mech · W place (W) | — | ok |
| `item_breachwarden_mail` | Breachwarden Mail | armor | D mech · W place (W) | — | ok |
| `item_sunderforged_plate` | Sunderforged Plate | armor | D mech · W place (W) | — | ok |
| `item_glyphbound_lantern` | Glyphbound Lantern | trinkets | D mech · W place (DW) | `glyphbound_lantern` (P A.4) | rename-in-P |
| `item_sky_whisper_talisman` | Sky-Whisper Talisman | trinkets | D mech · W place (DW) | `sky_whisper_talisman` (P A.4) | rename-in-P |
| `item_chronos_lens` | Chronos Lens | trinkets | D mech · W place (DW) | `chronos_lens` (P A.4) | rename-in-P |
| `item_stabilized_heartstone` | Stabilized Heartstone | trinkets | D mech · W place (DW) | `stabilized_heartstone` (P A.4) | rename-in-P |
| `item_heartstone_core` | Heartstone Core | trinkets | D mech · W place (DW) | `heartstone_core` (P A.4) | rename-in-P |
| `item_bell_shard` | Bell Shard | trinkets | D mech · W place (W) | — | ok |
| `item_oriels_ring` | Oriel's Ring | trinkets | D mech · W place (W) | — | ok |
| `item_choir_mask` | Choir Mask | trinkets | D mech · W place (W) | "Choir Mask" (S q_hollow_choir) | ok |
| `item_dasks_scout_badge` | Dask's Scout Badge | trinkets | D mech · W place (W) | — | ok |
| `item_weavers_thread_ring` | Weaver's Thread Ring | trinkets | D mech · W place (W) | — | ok |
| `item_salt_charm` | Salt Charm | trinkets | D mech · W place (W) | — | ok |
| `item_cinder_heart` | Cinder Heart | trinkets | D mech · W place (W) | — | ok |
| `item_stiltwalkers_boots` | Stilt-walker's Boots | trinkets | D mech · W place (W) | — | ok |
| `item_voidforged_band` | Void-forged Band | trinkets | D mech · W place (DW) | — | ok |
| `item_ley_tuned_charm` | Ley-tuned Charm | trinkets | D mech · W place (W) | — | ok |
| `item_unlidded_eye` | Unlidded Eye | trinkets | D mech · W place (W) | "Unlidded Eye" (S q_unlidded_eye) | ok |
| `item_lantern_moth_brooch` | Lantern-Moth Brooch | trinkets | D mech · W place (W) | — | ok |
| `item_stormcrown_talon` | Stormcrown Talon | trinkets | D mech · W place (W) | — | ok |
| `item_oriels_quill` | Oriel's Quill | trinkets | D mech · W place (W) | — | ok |
| `item_archivists_circlet` | Archivist's Circlet | trinkets | D mech · W place (DW) | — | ok |
| `item_ley_touched_tonic` | Ley-Touched Tonic | consumables | D mech · W place (DW) | `ley_touched_tonic` (P A.4) | rename-in-P |
| `item_glow_moss` | Glow Moss | consumables | D mech · W place (DW) | `glow_moss` (P A.4) | rename-in-P |
| `item_mana_bloom` | Mana Bloom | consumables | D mech · W place (DW) | `mana_bloom` (P A.4) | rename-in-P |
| `item_antidote_root` | Antidote Root | consumables | D mech · W place (DW) | — | ok |
| `item_chronal_dust` | Chronal Dust | consumables | D mech · W place (DW) | `mat_conflux_dust` (W loc_conflux_chamber); `chronal_dust` (P A.4) | rename-in-W,P |
| `item_ward_salts` | Ward Salts | consumables | D mech · W place (DW) | — | ok |
| `item_ember_flask` | Ember Flask | consumables | D mech · W place (DW) | — | ok |
| `item_storm_jar` | Storm Jar | consumables | D mech · W place (DW) | — | ok |
| `item_brine_draught` | Brine Draught | consumables | D mech · W place (W) | — | ok |
| `item_lantern_oil` | Lantern Oil | consumables | D mech · W place (W) | — | ok |
| `item_hearth_broth` | Hearth Broth | consumables | D mech · W place (W) | — | ok |
| `item_nomad_hardtack` | Nomad Hardtack | consumables | D mech · W place (W) | — | ok |
| `item_whetstone_strip` | Whetstone Strip | consumables | D mech · W place (W) | — | ok |
| `item_lanternreed_salts` | Lanternreed Salts | consumables | D mech · W place (DW) | — | ok |
| `item_fenlight_salve` | Fenlight Salve | consumables | D mech · W place (W) | — | ok |
| `item_barrow_light_vial` | Barrow-Light Vial | consumables | D mech · W place (W) | — | ok |
| `item_stillwater_phial` | Stillwater Phial | consumables | D mech · W place (W) | — | ok |
| `item_ley_tuned_tonic` | Ley-tuned Tonic | consumables | D mech · W place (W) | — | ok |
| `item_silverwood_honeycake` | Silverwood Honeycake | consumables | D mech · W place (W) | — | ok |
| `item_remnant_ink` | Remnant Ink | consumables | D mech · W place (W) | — | ok |
| `item_amulet_of_echoes` | Amulet of Echoes | quest | D mech · W place (DW) | `amulet_of_echoes` (P A.4) | rename-in-P |
| `item_echo_crystal` | Echo Crystal | quest | D mech · W place (DW) | `echo_crystal` (P A.4); `{item:"echo_crystal"}` (S q_echo_crystal) | rename-in-S |
| `item_scholars_lost_scroll` | Scholar's Lost Scroll | quest | D mech · W place (DW) | `scholars_lost_scroll` (P A.4) | rename-in-P |
| `item_heartstone_fragment_stable` | Heartstone Fragment (stable) | quest | D mech · W place (XDW) | "Stabilized Heartstone" as forge input (S q_the_mending stage 2) | rename-in-S (D-052) |
| `item_heartstone_fragment_dead` | Heartstone Fragment (dead) | quest | D mech · W place (XDW) | — | ok |
| `item_breach_anchor` | Breach-anchor | quest | D mech · W place (DW) | `{item:"breach_anchor"}` (S §10.2, §10.4) | rename-in-S |
| `item_caelums_anchor_token` | Hallow's Cradle-Pin | quest | D mech · W place (W) | "Hallow's Cradle-Pin" (S §9.3, q_the_mending) = W display name | ok (W §13.3: W id, S name); fix W §2.6 "Caelum crosses once the token is anchored" → S §9.6 (E-5) |
| `item_litany_page_1` | Litany Page (the Witness) | quest | D mech · W place (W) | — | S §12 adds as source of verse 1 (W E-9) |
| `item_litany_page_2` | Litany Page (the Dark Between) | quest | D mech · W place (W) | — | S §12 adds as source of verse 8 |
| `item_litany_page_3` | Litany Page (the Warding) | quest | D mech · W place (W) | — | S §12 adds as source of verse 3 |
| `item_keepers_copy` | Keeper's Copy | quest | D mech · W place (W) | "Keeper's Copy" (S q_keepers_ledger) | ok |
| `item_scouts_whistle` | Scout's Whistle | quest | D mech · W place (W) | — | ok |
| `item_aberrant_eye` | Aberrant Eye | quest | D mech · W place (W) | — | ok |
| `item_pells_day_count` | Pell Ashcombe's Day-Count | quest | D mech · W place (W) | — | ok |
| `item_fathers_whetstone` | Father's Whetstone | quest | D mech · W place (W) | — | ok |
| `item_borins_forge_mark` | Borin's Forge-Mark | quest | D mech · W place (W) | "Borin's forge-mark" (S q_bone_road); no source anywhere | add source (W §13.6 OQ10: Borin gives it when q_bone_road is accepted) |
| `item_mireyas_lantern` | Mireya's Lantern | quest | D mech · W place (W) | — | ok |
| `item_remnant_wax_seal` | Remnant Wax Seal | quest | D mech · W place (W) | — | ok |
| `item_cistern_key` | Cistern Key | keys | D mech · W place (W) | `key_sluice` (D §10.5 echo_drowned_sluice); "Drowned sluice key" (D §7.6) | rename-in-D |
| `item_bell_vault_key` | Bell-Vault Key | keys | D mech · W place (W) | — | ok |
| `item_orrery_key` | Orrery Key | keys | D mech · W place (W) | — | define its lock (W §13.6 OQ9) or remove |
| `item_aetherium_prism` | Aetherium Prism | keys | D mech · W place (W) | — | ok |
| `item_ward_seal` | Ward Seal | keys | D mech · W place (XW) | — | ok (D-063) |
| `item_veil_sigil` | Veil Sigil | keys | D mech · W place (W) | — | ok |
| `item_breach_anchor_schematic_a` | Breach-anchor Schematic (first half) | recipe | D mech · W place (W) | — | ok |
| `item_breach_anchor_schematic_b` | Breach-anchor Schematic (second half) | recipe | D mech · W place (W) | — | ok |
| `item_pattern_breachsteel_blade` | Borin's Pattern: Breachsteel Blade | recipe | D mech · W place (W) | — | ok |
| `item_pattern_heartwood_bow` | Borin's Pattern: Heartwood Bow | recipe | D mech · W place (W) | — | ok |
| `item_pattern_hour_spindle` | Borin's Pattern: Hour Spindle | recipe | D mech · W place (W) | — | ok |
| `item_pattern_hallows_hammer` | Borin's Pattern: Hallow's Hammer | recipe | D mech · W place (W) | — | ok |
| `item_pattern_breachglass_focus` | Borin's Pattern: Breachglass Focus | recipe | D mech · W place (W) | — | ok |
| `item_pattern_conflux_robe` | Borin's Pattern: Conflux Robe | recipe | D mech · W place (W) | — | ok |
| `item_pattern_sunderforged_plate` | Borin's Pattern: Sunderforged Plate | recipe | D mech · W place (W) | — | ok |
| `item_pattern_breachwarden_mail` | Borin's Pattern: Breachwarden Mail | recipe | D mech · W place (W) | — | ok |
| `item_dark_spellbook` | Dark Spellbook | tomes | D mech · W place (DW) | `dark_spellbook` (P A.4) | rename-in-P |
| `item_korrs_marginalia` | Korr's Marginalia | tomes | D mech · W place (W) | — | ok |
| `item_warder_plate` | Warder Plate | tomes | D mech · W place (DW) | — | grants `echo_stone_hide_origin` (was `echo_golem_warder`) |
| `item_tobrins_warding_primer` | Tobrin's Warding Primer | tomes | D mech · W place (W) | — | ok |
| `item_oriels_ledger` | Oriel's Ledger | tomes | D mech · W place (W) | — | ok |
| `item_rhunes_hydromancy` | Rhune's Hydromancy | tomes | D mech · W place (W) | — | ok |
| `item_dreyls_pyre_ledger` | Dreyl's Pyre Ledger | tomes | D mech · W place (W) | — | ok |
| `item_auldes_spire_notes` | Aulde's Spire Notes | tomes | D mech · W place (W) | `item_aldours_spire_notes` (W §3.10, §7.13) | rename-in-W (with loc_auldes_eyrie) |
| `item_void_shard` | Void Shard | material (legacy) | D mech · W place (DW) | `void_shard` (P A.4); `{item:"void_shard"}` (S q_void_shards) | rename-in-S |
| `item_aetherium_shard` | Aetherium Shard | material (legacy) | D mech · W place (DW) | `aetherium_shard` (P A.4) | rename-in-P |

### 16. Recipes (30)

`recipe_breach_anchor` gates: see REVIEW-CROSS C-04 (fee 0; Neutral during the quest; requires `echo_anchor_schema`; `echo_void_resonance` moves to the B consent).

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `recipe_breach_anchor` | item_breach_anchor | D rules · W list (XDW) | — | ok |
| `recipe_voidforged_edge` | item_voidforged_edge | D rules · W list (DW) | — | ok |
| `recipe_voidforged_mail` | item_voidforged_mail | D rules · W list (DW) | — | ok |
| `recipe_voidforged_band` | item_voidforged_band | D rules · W list (DW) | — | ok |
| `recipe_ley_tuned_staff` | item_ley_tuned_staff | D rules · W list (W) | — | ok |
| `recipe_ley_tuned_vestment` | item_ley_tuned_vestment | D rules · W list (W) | — | ok |
| `recipe_ley_tuned_charm` | item_ley_tuned_charm | D rules · W list (W) | — | ok |
| `recipe_ley_tuned_tonic` | item_ley_tuned_tonic ×3 | D rules · W list (W) | — | ok |
| `recipe_storm_jar` | item_storm_jar ×2 | D/W (DW as `recipe_stormjar`) | `recipe_stormjar` (D §8.5, W §8.2) | rename-in-D,W (match `item_storm_jar`) |
| `recipe_ember_flask` | item_ember_flask ×2 | D rules · W list (DW) | — | ok |
| `recipe_antidote_root` | item_antidote_root ×3 | D rules · W list (DW) | — | ok |
| `recipe_ward_salts` | item_ward_salts ×2 | D rules · W list (DW) | — | ok |
| `recipe_glyphbound_lantern` | item_glyphbound_lantern | D rules · W list (W) | — | ok |
| `recipe_nomad_sabre` | item_nomad_sabre | D rules · W list (W) | — | ok |
| `recipe_harrier_bow` | item_harrier_bow | D rules · W list (W) | — | ok |
| `recipe_scriptorium_staff` | item_scriptorium_staff | D rules · W list (W) | — | ok |
| `recipe_bell_clapper` | item_bell_clapper (Common; the boss copy is Rare) | D rules · W list (W) | — | ok |
| `recipe_hollow_lantern_focus` | item_hollow_lantern_focus | D rules · W list (W) | — | ok |
| `recipe_cinderhorn_plate` | item_cinderhorn_plate | D rules · W list (W) | — | ok |
| `recipe_emberwrought_blade` | item_emberwrought_blade | D rules · W list (W) | — | ok |
| `recipe_galefeather_bow` | item_galefeather_bow | D rules · W list (W) | — | ok |
| `recipe_spireweave_mantle` | item_spireweave_mantle | D rules · W list (W) | — | ok |
| `recipe_breachsteel_blade` | item_breachsteel_blade | D rules · W list (W) | — | ok |
| `recipe_heartwood_bow` | item_heartwood_bow | D rules · W list (W) | — | ok |
| `recipe_hour_spindle` | item_hour_spindle | D rules · W list (W) | — | ok |
| `recipe_hallows_hammer` | item_hallows_hammer | D rules · W list (W) | — | ok |
| `recipe_breachglass_focus` | item_breachglass_focus | D rules · W list (W) | — | ok |
| `recipe_conflux_robe` | item_conflux_robe | D rules · W list (W) | — | ok |
| `recipe_sunderforged_plate` | item_sunderforged_plate | D rules · W list (W) | — | ok |
| `recipe_breachwarden_mail` | item_breachwarden_mail | D rules · W list (W) | — | ok |

### 17. Attunements (15)

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `att_steady_hand` | Steady Hand | D (D) | — | ok |
| `att_deep_well` | Deep Well | D (D) | — | ok |
| `att_full_purse` | Full Purse | D (D) | — | ok |
| `att_old_road` | Old Road | D (D) | — | ok |
| `att_foresight` | Foresight | D (DW) | — | ok |
| `att_quick_study` | Quick Study | D (D) | — | ok |
| `att_keen_eye` | Keen Eye | D (D) | — | ok |
| `att_light_step` | Light Step | D (D) | — | ok |
| `att_steady_hours` | Steady Hours | D (D) | — | ok |
| `att_borins_favor` | Borin's Favor | D (DW) | — | ok |
| `att_kaelens_ledger` | Kaelen's Ledger | D (DW) | — | ok |
| `att_remembered_steps` | Remembered Steps | D (D) | — | ok |
| `att_echo_sense` | Echo-Sense | D (D) | — | ok |
| `att_companions_trust` | Companion's Trust | D (D) | — | ok |
| `att_second_wind` | Second Wind | D (D) | — | ok |

### 18. Achievements (40)

Conditions that cite non-canonical ids or contradict DECISIONS are fixed in the action column.

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `ach_first_steps` | First Steps | D (D) | — | ok |
| `ach_echo_in_the_library` | Echoes in the Library | D (D) | condition "complete `echo_crystal`" | fix condition → `q_echo_crystal` |
| `ach_six_quests` | The Apex Opens | D (D) | — | ok |
| `ach_the_escape` | The Escape | D (D) | condition "reach the Threshold by the portal" | fix → "close a loop by the portal" (D-049: Loop 1 skips the Threshold) |
| `ach_the_fall` | The Thirtieth Dawn | D (D) | condition "reach the Threshold by clock expiry" | fix → "see the thirtieth dawn" (D-060: expiry runs the Horde) |
| `ach_loop_two` | Day One, Again | D (D) | `ach_first_loop` (D §14.1 profile example) | rename-in-D |
| `ach_i_know_what_you_are` | I Know What You Are | D (D) | condition `echo_nyx_is_nyxaria` | fix → `echo_nyx_is_of_the_nine` |
| `ach_brak_lives` | Stonehand Lives | D (D) | — | ok |
| `ach_two_brothers` | The Brothers Stonehand | D (D) | condition `quest_two_brothers` | fix condition → `q_blood_and_salt` |
| `ach_vigil` | The Warden's Vigil | D (D) | — | ok |
| `ach_mending` | The Mending | D (D) | — | ok |
| `ach_weavers_dawn` | The Weaver's Dawn | D (D) | — | ok |
| `ach_iron_silence` | The Iron Silence | D (D) | — | ok |
| `ach_long_archive` | The Long Archive | D (D) | — | ok |
| `ach_unbound` | The Unbound | D (D) | — | ok |
| `ach_all_endings` | Every Door | D (D) | — | ok |
| `ach_commune` | It Listens | D (D) | condition "reach resolve 100" | fix → Resolve 8 (D-054) |
| `ach_speedrun` | Before the Tenth Dawn | D (D) | — | ok |
| `ach_untouched` | Untouched | D (D) | — | ok |
| `ach_sworn_remnant` | Sworn to the Remnants | D (D) | — | ok |
| `ach_sworn_weaver` | Sworn to the Weavers | D (D) | — | ok |
| `ach_sworn_ironclad` | Sworn to the Ironclad | D (D) | — | ok |
| `ach_two_oaths` | Two Oaths | D (D) | — | ok |
| `ach_mastery_any` | Mastered | D (D) | — | ok |
| `ach_five_classes` | Every Life | D (D) | — | ok |
| `ach_capstone_trio` | Three Capstones | D (D) | — | ok |
| `ach_bestiary_full` | The Whole Horde | D (D) | — | ok |
| `ach_codex_full` | The Long Reading | D (D) | — | ok |
| `ach_all_echoes` | Nothing Forgotten | D (D) | — | ok |
| `ach_cartographer` | Cartographer | D (D) | — | ok |
| `ach_legendary` | Legend-Forged | D (D) | — | ok |
| `ach_breach_anchor` | The Anchor | D (D) | — | ok |
| `ach_voidforged` | Void-Forged | D (D) | — | ok |
| `ach_corrupted` | Marked | D (D) | — | ok |
| `ach_cleansed` | Lanternreed Light | D (D) | condition "cleanse Corruption" (at Lanternreed) | fix place → Elder Wen at loc_breathing_pool (D-064) |
| `ach_pacifist_loop` | The Vow Kept | D (D) | — | ok |
| `ach_glass_boss` | Glass Cannon | D (D) | — | ok |
| `ach_iron_frayed` | Bare and Hurried | D (D) | — | ok |
| `ach_bond_any` | A Bond Kept | D (D) | — | ok |
| `ach_ng_plus` | The Ring Turns | D (D) | — | ok |

### 19. Challenge modifiers (6)

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `mod_iron_loop` | Iron Loop | D (D) | — | ok |
| `mod_frayed_clock` | Frayed Clock | D (DW) | — | ok |
| `mod_mute_ley` | Mute Ley | D (D) | — | ok |
| `mod_horde_rising` | Horde Rising | D (DW) | — | ok |
| `mod_glass` | Glass | D (D) | — | ok |
| `mod_pacifist` | Pacifist's Vow | D (D) | "Pacifist's Vow" (X D-021) | ok |

### 20. Screens (22)

P §6.3 maps components to these screens by name; P uses no `screen_` ids (ok).

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `screen_title` | Title | D (D) | — | ok |
| `screen_class_select` | Class Select | D (D) | — | ok |
| `screen_explore` | Explore/Map | D (D) | — | ok |
| `screen_combat` | Combat | D (D) | — | ok |
| `screen_dialogue` | Dialogue | D (D) | — | ok |
| `screen_inventory` | Inventory & Equipment | D (D) | — | ok |
| `screen_quest_log` | Quest Log | D (D) | — | ok |
| `screen_codex` | Codex | D (D) | — | ok |
| `screen_bestiary` | Bestiary | D (D) | — | ok |
| `screen_loop_timeline` | Loop Timeline | D (D) | — | ok |
| `screen_merchant` | Merchant | D (D) | — | ok |
| `screen_forge` | Forge | D (D) | — | ok |
| `screen_camp` | Camp | D (D) | — | ok |
| `screen_settings` | Settings | D (D) | — | ok |
| `screen_saves` | Save Slots | D (D) | — | ok |
| `screen_achievements` | Achievements | D (D) | — | ok |
| `screen_run_summary` | Run Summary | D (D) | — | ok |
| `screen_ending` | Ending | D (D) | — | ok |
| `screen_threshold_shore` | Still Shore | D §10.8 (D) | `screen_threshold_*` (D §16.3) | ok |
| `screen_threshold_gallery` | Gallery of Loops | D §10.8 | `screen_gallery` (D §10.8) | rename-in-D (one `screen_threshold_*` family) |
| `screen_threshold_loom` | The Loom | D §10.8 | `screen_loom` (D §10.8) | rename-in-D |
| `screen_threshold_far_light` | The Far Light | D §10.8 | `screen_far_light` (D §10.8) | rename-in-D |

### 21. SFX (30)

| id | display name | owner (seen in) | aliases to replace (where) | action |
|---|---|---|---|---|
| `sfx_ui_tick` | 2 ms click: square 2 kHz, decay 20 ms | D (D) | — | ok |
| `sfx_ui_confirm` | sine 660→880 Hz glide 60 ms | D (D) | — | ok |
| `sfx_ui_back` | sine 440→330 Hz 60 ms | D (D) | — | ok |
| `sfx_ui_error` | square 220 Hz, 2 pulses × 40 ms | D (D) | — | ok |
| `sfx_travel` | footsteps: 3× filtered noise taps 80 ms apart, lowpass 400 | D (D) | — | ok |
| `sfx_rest_dawn` | rising sine 110→440 over 1.2 s + pink wash | D (D) | — | ok |
| `sfx_hit_physical` | noise burst 30 ms + sine 150 Hz thump 80 ms | D (D) | — | ok |
| `sfx_hit_fire` | noise bandpass 1.5 kHz 200 ms + sine 90 Hz sweep down | D (D) | — | ok |
| `sfx_hit_storm` | white noise 15 ms crack + sine 4 kHz→200 Hz 120 ms | D (D) | — | ok |
| `sfx_hit_ley` | triangle 523 Hz + 784 Hz, 300 ms, slow release | D (D) | — | ok |
| `sfx_hit_void` | sine 60 Hz + reversed envelope noise 250 ms, lowpass 300 | D (D) | — | ok |
| `sfx_hit_chrono` | three stuttered sine 880 Hz blips 40 ms each, descending | D (D) | — | ok |
| `sfx_crit` | layered `sfx_hit_*` + sine 1.2 kHz ping 150 ms | D (D) | — | ok |
| `sfx_miss` | noise whoosh bandpass 2 kHz 120 ms, pan across | D (D) | — | ok |
| `sfx_guard` | metallic: square 330 + 495 Hz 60 ms through highpass 500 | D (D) | — | ok |
| `sfx_shield_up` | triangle 440 Hz arpeggio 3 notes 50 ms each | D (D) | — | ok |
| `sfx_shield_break` | glass: noise bandpass 5 kHz 90 ms + descending sine | D (D) | — | ok |
| `sfx_status_apply` | short sine 660 Hz 40 ms + status-specific tail (Burn crackle, Bleed drip 2 kHz tick, Shock buzz) | D (D) | — | ok |
| `sfx_heal` | sine 523→659→784 Hz 200 ms | D (D) | — | ok |
| `sfx_level_up` | triad chord sine (262, 330, 392) 800 ms + sparkle noise | D (D) | — | ok |
| `sfx_echo_gain` | bell: sine 1047 Hz with 3 partials, decay 2 s, slight reverb | D (D) | — | ok |
| `sfx_resonance` | soft sine 880 Hz 80 ms ×n per unit | D (D) | — | ok |
| `sfx_intent_flip` | two-note square 440→523 Hz 40 ms (when a creature changes plan) | D (D) | — | ok |
| `sfx_clock_warning` | low bell sine 220 Hz with 110 Hz sub, 1.5 s; Day 28+ adds detune | D (D) | — | ok |
| `sfx_breach_tear` | long noise sweep 2 s lowpass 200→4 kHz + sine 30 Hz | D (D) | — | ok |
| `sfx_forge_hammer` | noise 20 ms + sine 200 Hz 60 ms, ring sine 1.8 kHz 300 ms | D (D) | — | ok |
| `sfx_coin` | two sine clicks 2.2 kHz / 3.1 kHz 30 ms | D (D) | — | ok |
| `sfx_combat_start` | low drum: sine 55 Hz 200 ms + noise snap | D (D) | — | ok |
| `sfx_victory` | ascending triangle 330-440-550 Hz 500 ms | D (D) | — | ok |
| `sfx_ko` | descending sine 330→110 Hz 400 ms | D (D) | — | ok |

### 22. Flags (W/D ids found, plus unprefixed flags to convert)

W §13.7 X4 also proposes `flag_heartstone_exploited`, `flag_brak_kept_away`, `flag_clock_expired` (present above).

| id | seen in | aliases to replace | action |
|---|---|---|---|
| `flag_anchor_offered` | DW | — | ok |
| `flag_before_day_1` | W | — | ok |
| `flag_before_day_2` | W | — | ok |
| `flag_before_day_3` | W | — | ok |
| `flag_brak_kept_away` | W | — | ok |
| `flag_corruption_cleansed` | — | `flag_cleansed_lanternreed` (D §6.7) | rename-in-D (cleansing is Elder Wen's at the Breathing Pool, D-064) |
| `flag_clock_expired` | W | — | ok |
| `flag_entered_before_via_apex` | W | — | ok |
| `flag_entered_before_via_nexus` | W | — | ok |
| `flag_hearthring_caravan` | W | — | ok |
| `flag_heartstone_destroyed` | W | `heartstone_destroyed` (S) | rename aliases |
| `flag_heartstone_exploited` | W | `heartstone_exploited` (S, D §13.3) | rename aliases |
| `flag_heartstone_stabilized` | W | `heartstone_stabilized` (S) | rename aliases |
| `flag_horde_active` | W | — | ok |
| `flag_library_portal_open` | W | `portal_open` (P A.5) | rename aliases |
| `flag_refused_all_paths` | W | — | ok |
| `flag_shards_refused` | DW | — | ok |
| `flag_tyrant_spared` | W | `tyrant_spared` (S §10, D §13.3) | rename aliases |
| `flag_visited_before` | W | — | ok |
| `flag_wanted_in_silverwood` | W | — | ok |
| `flag_kept_echo_crystal` | — | `kept_echo_crystal` (S q_echo_crystal; P A.5) | add (rename-in-S/D/P) |
| `flag_crystal_given` | — | `crystal_given` (S q_echo_crystal) | add (rename-in-S/D/P) |
| `flag_cradle_pin_anchored` | — | `cradle_pin_anchored` (S §10.2, W §13.3 E-5) | add (rename-in-S/D/P) |
| `flag_conflux_anchored` | — | `conflux_anchored` (S) | add (rename-in-S/D/P) |
| `flag_remnants_hold_litany` | — | `remnants_hold_litany` (S q_keepers_ledger) | add (rename-in-S/D/P) |
| `flag_brak_dead` | — | `brak_dead` (D §13.1) | add (rename-in-S/D/P) |
| `flag_dask_anchor` | — | `dask_anchor` (S §11.4, §12) | add (rename-in-S/D/P) |
| `flag_ilyra_told` | — | `ilyra_told` (S) | add (rename-in-S/D/P) |
| `flag_lanternreed_trusts` | — | `lanternreed_trusts` (S) | add (rename-in-S/D/P) |
| `flag_chose_<vigil/mending/dawn/silence/archive>` | — | `chose_*` (S §10) | add (rename-in-S/D/P) |
| `flag_wildling_defeated` | — | `defeated_wildling` (P A.5) → prefer `{killed:"cr_wildling_brute"}` | add (rename-in-S/D/P) |
| `flag_scene_done_<scene>` | — | `scene_done:<id>` (P §5.10) | add (rename-in-S/D/P) |

## 23. Referenced but defined nowhere (or defined only by a non-owner)

| id / construct | referenced in | resolution |
|---|---|---|
| `loc_veil_sanctum` | D §13.3 example 4 | `loc_sanctum_of_threads` |
| `loc_auldes_eyrie`, `item_auldes_spire_notes` | W §13.2 E4 only (proposal) | adopt; rename `loc_aldours_eyrie` / `item_aldours_spire_notes` in W |
| `npc_skyreach_trader` | D §9.2/§9.4, X D-064 | no W NPC: remove from D (or W §4 adds one first) |
| `npc_kaelen`, `npc_ironclad_quartermaster`, `npc_remnant_archivist`, `npc_veil_vendor`, `npc_mireya_stall` | D §9.4, X D-064 | W §4 ids (table 4) |
| `respite_trade`, `emberforge_smith` (merchant ids) | P A.5 | merchants are keyed by NPC id (W §9): `npc_kaelen_stonehand`, `npc_borin_stonefist` |
| `q_herd_of_one` | W §3.7 | `q_bone_road` |
| `quest_two_brothers`, `quest_lanternreed_light`, `quest_anchor_the_conflux`, `quest_stop_the_ritual`, `quest_blighted_outpost` | D §10.1, §10.5, §11.6, §12.1 | `q_blood_and_salt`, `q_lantern_in_the_reeds`, `q_the_mending` (stage), `q_stop_the_ritual`, `q_blighted_outpost` |
| `quest_class_ranger` … `quest_class_weaver` | D §10.9 (D-008 requires them) | S §11 adds `q_class_<class>` ×5 |
| `codex_the_nine`, `codex_wayfinders`, `codex_sundering`, `codex_void_resonance` | D §10.5, §13.3, §14.1 | `codex_nine_overview`, `codex_seven_wayfinders`, `codex_breach`, remove |
| `scene_echo_crystal` | S §4.1 | add to S §13 or make it a `q_echo_crystal` dialogue node |
| `echo_crystal_seeded` | W §3.11 ("STORY.md") | S §12 lacks it: ADD (table 6.2) |
| `echo_litany_verse_n` | D §10.5 | `echo_litany_verse_2..9` |
| 8 W gate Echoes + 10 other W Echoes | W §2–3 | table 6.3 |
| `ach_first_loop` | D §14.1 example | `ach_loop_two` |
| `key_sluice` | D §10.5 | `item_cistern_key` |
| `nine_shard` | D §4.10, §8.2 | `cr_tyrants_reach` |
| `anomaly_*` | D §6.6 (pattern); W §10.2 (16 ids, prefix not in D-044) | `cr_anomaly_*` (table 10.2) |
| `tyr_stillness` | D §4.11 | remove (Movement III outcome) |
| Unveiled Phase 4 | D §4.10, W §6.8 (no id) | `tyr_phase_4` |
| `dask_anchor` | S §11.4, §12 | `flag_dask_anchor` |
| `item_orrery_key` (no lock) | W §3.5, §7.11 | W §13.6 OQ9: define the lock or remove |
| `item_borins_forge_mark` (no source) | S q_bone_road; W §7.10 | Borin gives it when `q_bone_road` is accepted (W OQ10) |
| `ev_hallows_cairn` | W §11.5 (proposed) | add to W §3.7 `loc_stormgate_cairns` |
| "Nyx's Cell" | S q_the_dark_between, codex_region_veil | `loc_where_she_fell` + an event (U9) |
| `mat_bell_bronze`, `mat_cinder_horn`, `mat_storm_glass`, `mat_umbral_thread` | W §3, §8.1 | D §8.2 adopts (D owns `mat_*`) |
| `mat_glow_spore`, `mat_lantern_resin`, `mat_conflux_dust`, `item_gale_feather`, `item_nyxarias_quiet` | W §3 | aliases (tables 14, 15) |
| `{ counter: { name, min } }` condition atom | X D-048; W §11.3 `gate_apex`; P §5.16 | add to D-033 / P §4.9 (DECISIONS already uses it) |
| `{ watch: … }`, `{ clock: { daysLeft } }` atoms | W §11.3, §13.7 X4 | DESIGN/PLAN decide (W proposal) |
| `g_*` gate ids | W §11.3 | `gate_*` (D-044 style prefix; record in D-044) |
