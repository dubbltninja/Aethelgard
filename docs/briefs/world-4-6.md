# Brief W-A: WORLD.md §4 NPCs, §5 Creature families, §6 Creatures

Agent type: general-purpose. Deliverable: `/home/claude/aethelgard/docs/world/04-06-npcs-creatures.md`
(create `docs/world/`). Two sibling agents are writing §7–9 and §10–13 into other files at the same time;
the lead merges all three into WORLD.md afterwards. Do NOT edit WORLD.md or any other existing file.
When done, commit only your file per `docs/briefs/COMMIT.md`.

You are the world designer for "Echoes of Aethelgard: The Unraveling", a time-loop web RPG rebuilt from
a Python text RPG. WORLD.md §1–3 (geography, 12 regions, all 73 locations with exits, encounters, NPC
placement, events, map positions) already exist.

## Read first
1. `docs/DECISIONS.md` — CANON, all of it. Critical: D-044 (typed-prefix ids), **D-062 (document
   precedence: STORY owns people/names/roles/Echoes/quests; DESIGN owns systems/numbers/materials/
   item mechanics; WORLD owns places/creatures/NPC ids)**, **D-063 (the Nine are STORY's nine; Corvin
   Dreyl, Ilsabet Rhune, Hadrek the Clockwright, Tobrin Vask are Silverwood people NOT of the Nine)**,
   **D-064 (NPC role reconciliation: Ansel Dray, Hadda Ironvow, Sethe the Unlidded, Elder Wen
   Thistlecourt; Hollis Vane → Hollis Cade; Elder Wren merged into Elder Wen)**, D-046 (Oriel = the
   Drowned Archivist), D-051 (two Tyrants), D-055 (Dark Spellbook drop rule), D-056 (bands), D-059.
2. `docs/WORLD.md` §1–3 in full (regions, every location's encounters/NPCs/items/events).
3. `docs/DESIGN.md` §4 (combat: damage types `physical/fire/storm/ley/void/chrono`, 18 statuses with
   ids, interplay, intent format, boss framework incl. phases), §6 (XP formula for kills, level bands),
   §8 (material ids `mat_*` — creature drops must use these), §12 (companions), §19 (balance targets).
4. `docs/STORY.md` §2 (the Nine, the Litany, Silverwood history, prior Wayfinders), §7 (companions),
   §8 (the Tyrant: phases The Holding / The Fracture / The Nine Speak; communion Movements),
   §9 (Silverwood Before), §11 (quest catalog — every creature/NPC a quest names must exist here),
   §16 Q11 (proposed names).

## Write
### §4 Non-companion NPCs
Table: id, name, faction, location id, role (merchant / crafter / quest giver / flavor / companion
anchor), one-line description, two sample lines in the house voice. Define EVERY `npc_*` id used in
WORLD §3: npc_bellwright_anso, npc_borin_stonefist, npc_brak, npc_caelum, npc_dask, npc_elder_tam,
npc_hesper_dunn, npc_ilyra, npc_kaelen_stonehand, npc_ketch, npc_mireya, npc_nyx,
npc_nyxaria_vell_before, npc_old_fennick, npc_oma_varr, npc_oriel_danthe, npc_pellam,
npc_scout_ferrin, npc_sedge_marrow, npc_tamsin_reed, npc_tessaly_varr, npc_tobrin_vask,
npc_veyran_thal, npc_ysmay — plus `npc_hollis_cade` (renamed from npc_hollis_vane), `npc_elder_wen`
(absorbs npc_elder_wren), the D-064 NPCs `npc_ansel_dray`, `npc_hadda_ironvow`, `npc_sethe_unlidded`,
every quest giver named in STORY §11, and the Nine alive in Silverwood Before where STORY §9 needs them
on stage (`npc_maelis_korr`, `npc_haldric_vane`, `npc_durn_hallow`, `npc_seraphine_aulde`,
`npc_imre_sallow`, `npc_tovren_masque` as needed) and the D-063 recast figures that appear on stage
(`npc_corvin_dreyl`, `npc_ilsabet_rhune`, `npc_hadrek`). Mark which NPCs are merchants and the
location of their stall (W-B writes stock tables against these ids). Companion anchors (`npc_ilyra`,
`npc_brak`, `npc_nyx`, `npc_dask`, `npc_mireya`, `npc_caelum`) note their companion id (`ilyra`…).

### §5 Creature families
6–8 families: shared traits, silhouettes, damage-type tendencies, resistances, material drops
(DESIGN `mat_*` ids), and their origin (tie Stone-Hide Golems to Haldric Vane; Aetherial Weavers to
Seraphine Aulde; Glowfen/Mirelings to Imre Sallow; Temporal Aberrations to Tovren Masque — per STORY §2).

### §6 Creatures (57)
Define every creature id used in WORLD §3, exactly these: cr_aetherial_weaver cr_arcane_wisp cr_ashmaw
cr_barrow_light cr_bell_ringer cr_bell_warden cr_brine_lamprey cr_chronos_tyrant_contained
cr_chronos_tyrant_unveiled cr_cinderback cr_circle_adept cr_city_watch_halberdier cr_cloud_ray
cr_corrupted_shade cr_drowned_archivist cr_gale_kite cr_glass_mote cr_glowfen_mireling cr_hollow_lantern
cr_horde_husk cr_hour_leech cr_hourglass_crawler cr_lantern_matron cr_lantern_toad cr_ledger_choir
cr_ley_hound cr_mistwood_prowler cr_moment_moth cr_ninefold_knight cr_null_mouth cr_orrery_knight
cr_pale_diver cr_paradox_wisp cr_redundant_wayfinder cr_reed_stalker cr_rootling cr_salt_jackal
cr_shimmering_phantom cr_sky_whisper_sentinel cr_spire_loom cr_spore_drift cr_starved_shadow
cr_steppe_harrier cr_stone_hide_golem cr_stormcrown cr_stutter_hound cr_temporal_aberration
cr_tide_clerk cr_tyrants_reach cr_unbroken_warden cr_unmade cr_unraveling_tide cr_veil_sentry
cr_vells_umbra cr_void_touched_stalker cr_warding_pillar cr_wildling_brute.
Add more only if STORY §11 requires a creature not listed. Keep all 12 legacy creatures' exact names and
descriptions (from `aethelgard_data.py`); note legacy numbers beside the new ones.

For each creature, a compact block:
- id, name, family, region(s), level, role (fodder / elite / boss / anomaly), XP
- HP, Attack, Defense, Agility, primary damage type
- resistances: weak / resist / immune lists over the six damage types
- **intents**: 3–6 moves; each `move_id` · telegraph (≤12 words, second person, present tense, e.g.
  "It coils, eyes fixed on your throat.") · effect (× Attack, target you/all/ally/self) · status id +
  chance% + duration · optional condition (`ifHpBelow:50`, `everyNthTurn:3`, `ifAllyDown`, `first`)
- loot: gold range; guaranteed drop; chance drops with %; materials with %
- bestiary entry ≤120 words (Wayfinder's Notes or Remnant Archive voice)
- tactics note: how a smart player beats it
Number sanity (DESIGN §19 targets: fodder 3–5 turns, elite 6–9, boss 10–20): fodder HP ≈ 10×level+20,
elite ×2, boss ×6–8; Attack ≈ level+6 at band start; Defense ≈ level/2. Vary silhouettes, behaviors,
and weaknesses so players learn and exploit them. At least 5 anomalies (Loop 2+ / Loop 4+).
**Bosses (≥8)**: both Tyrants (Contained: 3 phases The Holding / The Fracture / The Nine Speak;
Unveiled: 4 phases + communion pseudo-intents keyed to STORY's Movements and D-054's Resolve 0–8), one
per new region (Drowned Reach — Oriel/the First Drowned per D-046; Ashen Steppe; Veil; Glowfen;
Skyreach; Silverwood Before) and one Horde boss for the Fall sequence. Identify them from WORLD §3.
Each boss: 2–4 phases with name, trigger (HP%/turn/event), intents per phase, adds, transition text.
Corrupted Shade loot follows D-055 (first Shade per loop always drops `item_dark_spellbook`; later 50%).

### Appendix to your file
- **Items introduced in §6**: any new `item_*` you reference that is not already in WORLD §3, STORY,
  or DESIGN — id, name, type, tier, one-line description (the lead merges these into §7).
- **Errata for §1–3**: precise fixes you recommend (D-063/D-064 renames, wrong ids), as a list.
- **Open questions (§4–6)**.

House voice: concrete nouns, short sentences, grave and strange, not grim-dark. Write the file in
several appends (Bash heredocs) if large; verify every id above is defined (grep check) before
committing. Reply with counts (NPCs; creatures by family and role; bosses), renames, open questions.
