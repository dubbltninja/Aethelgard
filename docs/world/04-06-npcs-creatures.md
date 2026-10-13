# WORLD.md §4–6 — NPCs, creature families, creatures (draft for merge)

Brief W-A. The lead merges this file into `docs/WORLD.md` after §3. It follows DECISIONS (canon),
STORY for people, names, roles, quests and Echoes, and DESIGN for numbers (D-062). Where it adds a
fact, the fact is new WORLD canon unless the lead overrules it (open questions at the end).

### Conventions for §4–6

- **Ids** per D-044. Companions are plain (`ilyra`, `brak`, `nyx`, `dask`, `mireya`, `caelum`);
  factions are `remnants`, `weavers`, `ironclad`; damage types are `physical`, `fire`, `storm`, `ley`,
  `void`, `chrono`. Statuses are written by suffix in creature blocks: `bleed` means `status_bleed`
  (all 18 D-009 ids: bleed burn shock soaked slow haste stun weaken armor_break mark curse shield
  regen taunt phase rewind poison blind).
- **Silverwood Before days.** Day 1 / 2 / 3 = First / Second / Last Bell (WORLD §2.6) = STORY's
  Day −3 / −2 / −1.
- **Stat line.** `HP · ATK · DEF armor/ward · AGI · primary type`. ATK doubles as SP for creatures
  unless an SP is given (only the Tyrants have one). Levels are fixed (D-009, no scaling); the loop
  nudge of DESIGN §6.6 applies on top.
- **Intent line.** `move_id` · "telegraph" · effect · status chance% duration · condition.
  Effect `1.2× you` = 1.2 × ATK to one target by DESIGN's `player` rule (Taunt and Phase apply);
  `all` = player and companion; `self`; `ally` = the lowest-HP ally. Type is the primary type unless
  named. Shield and heal amounts are × ATK; `regen 0.3×/3` heals 0.3 × ATK per tick for 3 turns.
- **Pattern.** Unconditioned moves cycle top to bottom. A conditioned move replaces the next cycled
  move when its condition holds at intent generation (first match wins, top to bottom). This maps
  directly to DESIGN §4.2 `pattern` steps. Conditions: `first` (opening intent), `ifHpBelow:n`,
  `everyNthTurn:n` (the creature's own turns n, 2n …), `ifAllyDown` (an ally died this fight),
  `ifAllyPresent`, `ifTargetHas:<status>`, `ifSelfHas:<status>`, `round:n`, `onDeath` (resolves when
  it dies, before loot). `hidden` follows DESIGN §4.2 (a "?" chip until the player's preceding turn).
- **Loot.** Gold range; guaranteed drops (100%); chance drops with %. `†` marks a material that WORLD
  §3/§7 defines and DESIGN §8.2 does not (see Appendix A).
- **XP** (DESIGN §6.2): fodder `round(20 + 8L + 1.2L²)`, elite ×1.8, anomaly ×1.3 of its base,
  bosses hand-set (400–1,200 regional; Tyrants 900 / 1,600).
- **Number rules** (DESIGN §6.5): fodder HP ≈ 10L + 20 (±20% by silhouette), elite ×2; ATK ≈ 5 + 1.5L;
  DEF total ≈ L/2 split between armor and ward by silhouette; gold `[3+2L, 6+3L]`, elite ×2, boss ×5.
  Boss HP is set for DESIGN §19's 10–14 turns, which lands at ×3.5–4.5 fodder HP at the boss's level,
  the same ratio as DESIGN's two Tyrants (×3.6 and ×4.5). See open question Q1.
- **Tags.** `breach-born`: Poison immune; −25% HP for the loop if the Heartstone was destroyed
  (D-017). `construct`: Poison and Bleed immune; WORLD §2.4 extends the −25% to ley-made constructs.
  `skyborn`: gains Haste in gales (WORLD §2.4, §2.11). `drowned`: re-applies Soaked to itself at the
  start of each of its turns (so Storm hits it ×1.5 and spreads Shock; Fire is halved and never Burns).
- **Legacy creatures** keep their exact names and descriptions from `aethelgard_data.py`; legacy
  numbers are shown in italics beside the new ones.
- **Voice.** Bestiary entries are in Wayfinder's Notes (first person, terse) or Remnant Archive
  (dated, measured) voice, 40–90 words.

---

## 4. Non-companion NPCs (and companion anchors)

38 NPC ids. Every `npc_*` used in WORLD §3 is defined here, with the D-064 renames applied
(`npc_hollis_vane` → `npc_hollis_cade`; `npc_elder_wren` merged into `npc_elder_wen`). Faction `—`
means no reputation faction. Roles: **merchant** (stall location in bold; W-B writes stock against
these ids), **crafter**, **quest giver**, **flavor**, **companion anchor** (companion id given).

| id | Name | Faction | Location | Role | Description | Sample lines |
|---|---|---|---|---|---|---|
| `npc_ilyra` | Ilyra | remnants | loc_whispering_ruins (Horde: loc_shattered_library) | companion anchor `ilyra`; quest giver (q_echo_crystal, q_lost_scroll, Ilyra arc) | Remnant scholar, ~30, in faded robes by a cold fire. Oriel Danthe's descendant; she does not know it. | "The whispers are louder each day, Wayfinder. You hear them too, I think?" / "Ink remembers what hands forget. That is the whole of my faith." |
| `npc_brak` | Brak | ironclad | loc_ironclad_camp (arc: loc_hearthring) | companion anchor `brak`; quest giver (q_clear_path, q_blighted_outpost, Brak arc) | Ironclad scout, ~40; laid down the name Stonehand at the oath. Kaelen's brother. | "Peaks first. Then the Outpost. Then we talk." / "Two golems. One of you. I like the odds less than you do." |
| `npc_nyx` | Nyx (Nyxaria Vell) | weavers | loc_chasm_of_whispers (Loop 2+ scenes: loc_sanctum_of_threads, loc_where_she_fell) | companion anchor `nyx`; quest giver (q_void_shards, Nyx arc, q_weavers_dawn) | Leader of the Shadow Weavers for thirty years; eyes of quiet starlight. Of the Nine, flung forward. | "Three shards. The void remembers where it was torn." / "He is still holding it. Ask what he is holding it against." |
| `npc_dask` | Dask, the Flickering Man | — | loc_shimmering_pass (may remain in any `temporallyUnstable` location, D-059) | companion anchor `dask`; quest giver (Dask arc, q_high_mark, q_wardens_vigil) | The seventh Wayfinder, Year 430, scattered across moments by a chrono-strike. | "Hells of a road, this. I walked it seventy years ago. Or — tomorrow." / "Don't strike it first. It never strikes first." |
| `npc_mireya` | Mireya of Lanternreed | — (Glowfen folk) | loc_lanternreed (gathering, flavor only: loc_veridian_glowlands) | companion anchor `mireya`; quest giver (Mireya arc) | Herbalist with light under the skin of her own wrists. | "Sit *down*. Feverfew, then water, then you tell me where you've been." / "Rain by dusk. Bring the moss in before it drinks the light." |
| `npc_caelum` | Caelum Vesper | — (Circle apprentice) | loc_apprentices_garret (Day 1: loc_plaza_of_bells; Day 3 dusk: the Archive stair) | companion anchor `caelum`; quest giver (Caelum arc) | Veyran's errand-boy, ~16, unanchored by the Breach's first breath. The only one in the Before who remembers you. | "Master Thal says the Holding is a kindness to the hour. Is it?" / "You were here yesterday. No one else remembers. Why do I?" |
| `npc_kaelen_stonehand` | Kaelen Stonehand | — (neutral ground) | **stall: loc_wayfarers_respite** | merchant (DESIGN `npc_kaelen`); quest giver (q_blood_and_salt, with Brak) | Trader, ~44; left the Nomads and kept the name. Has not spoken to Brak in years. | "Tonic's three. Fair weight. The road east is not." / "My brother? I sell salt, Wayfinder, not news." |
| `npc_borin_stonefist` | Borin Stonefist | ironclad | **stall: loc_emberforge** | crafter (the only one, DESIGN §8) and merchant (forge goods); quest giver (q_the_mending stage) | Ironclad smith, ~55, keeping a fire he suspects is older than the Nomads. | "Speak plain. What do you want tempered?" / "The fire's older than us. She doesn't like being asked how old." |
| `npc_tamsin_reed` | Scribe Tamsin Reed | remnants | **stall: loc_silverwood_plaza** (Loop 2+, Plaza infected: loc_shattered_library) | merchant (DESIGN `npc_remnant_archivist`); flavor | Remnant scribe who weighs ink against salt on the fountain's rim. | "Ink by the dram, salt by the cup. The Keeper sets the rate, not me." / "Year 500. I write it at the top of every page so I don't forget." |
| `npc_ansel_dray` | Keeper Ansel Dray | remnants | loc_shattered_library (reading-room camp; Loop 1+) | quest giver (q_keepers_ledger, q_bell_vault, q_the_keepers_price, q_the_thirtieth_dawn, q_long_archive) | Remnant Keeper, ~70; keeps the Ledger of Wayfinders and has read Pell Ashcombe's notes. | "Seven names. Years 44, 110, 178, 243, 309, 371, 430. I keep a line ruled for the eighth." / "Ashcombe counted to thirty. I have checked his arithmetic every year since I was twelve." |
| `npc_sedge_marrow` | Sedge Marrow | remnants | **stall: loc_lamplighters_rest** | merchant (diver gear, lamp oil, brine draughts; buys drowned vellum) | Remnant diver who outfits the lamplighters, and sells to Weavers too, and says so. | "Vellum from the Hall? Dry it slow or it curls. Four for it." / "The dead don't like the dark either. Buy oil." |
| `npc_pellam` | Pellam | remnants | loc_lamplighters_rest | flavor (rest keeper; Remnant Archive voice) | Lamplighter; keeps the lamps on every ninth step lit and counts the bell. | "The bell rang twice last night. It never rings twice." / "Ninth-step lamp went out at the third watch. Relit. Note the hour." |
| `npc_scout_ferrin` | Scout Ferrin | ironclad | loc_scorched_gate | flavor; teaches the trail-signs (`echo_nomad_signs`, Ironclad ≥ Neutral) | Gate scout: a brazier, a horn, a smaller gate inside a burned one. | "Two notes means friend. One means run. Learn it." / "Grass is grey to the edge of the world. Mind the herd-paths." |
| `npc_hadda_ironvow` | Hadda Ironvow | ironclad | loc_hearthring (STORY's Ring of Wagons) | quest giver (q_bone_road, q_day_of_teeth, q_iron_silence) | Clan-mother and warchief of the Steppe, ~50. Wants the Day of Teeth avenged. | "Steel sings louder than fear. Sing, then." / "Twenty held it a day. I have two hundred. Tell me why I wait." |
| `npc_oma_varr` | Oma Varr | ironclad | loc_hearthring | flavor; teller (`ev_hearthring_fire`, Brak's lineage) | The Steppe's old teller; knew the Stonehand brothers as boys. | "That fire was lit from the last ember of the Burned Hall. Sit. You smell of the Breach." / "Two boys. One kept the name, one kept the road. Both kept the sulk." |
| `npc_tessaly_varr` | Tessaly Varr | ironclad | **stall: loc_hearthring**; caravan stall at loc_ironclad_camp after `flag_hearthring_caravan` | merchant (DESIGN `npc_ironclad_quartermaster`) | Caravan master and quartermaster; Oma's granddaughter. | "Rivets by the fist, salt by the sack. Coin first." / "The wagons roll at the salt-wind. You're on them or you're not." |
| `npc_ketch` | Ketch | ironclad | loc_hearthring | flavor (skald; Ironclad Telling codex) | Skald with a frame drum; sings the Day of Teeth. | "Twenty stood where the floor was the sky. Count them home with me." / "I know a verse about two brothers. You won't like the end." |
| `npc_sethe_unlidded` | Sethe the Unlidded | weavers | loc_sanctum_of_threads (STORY's Hollow Choir) | quest giver (q_hollow_choir, q_unlidded_eye) | Weaver lieutenant who cut away her eyelids to keep watch between moments. Wants to see what Nyx has seen. | "Bring one thing torn from a moment. Bring it, bring it torn." / "Nyx looks at the seam. I want to look where she looks." |
| `npc_ysmay` | Ysmay, the Thread-Mother | weavers | loc_sanctum_of_threads | quest giver (Veil regional errands); flavor; gives `item_weavers_thread_ring` at Trusted | Ritual elder of the Hollow Choir; no eyes; holds the thread all the others are tied to. | "You are knotted. Someone has tied you to the same day eight times." / "Hold the thread. If it pulls, you are still here." |
| `npc_hollis_cade` | Hollis Cade | weavers | **stall: loc_sanctum_of_threads** | merchant (DESIGN `npc_veil_vendor`; Weavers ≥ Neutral or Corruption ≥ 3) | Weaver quartermaster in grey thread. Renamed from Hollis Vane (D-064). | "A Spellbook, uncharred. Fifteen of your blood to read it, more of your gold to own it." / "We sell the thread. The dark is free." |
| `npc_elder_wen` | Elder Wen Thistlecourt | — (Glowfen folk) | loc_breathing_pool (sits with the elders at loc_lanternreed) | quest giver (q_the_drowned_lantern); cleanses Corruption (D-017). Absorbs `npc_elder_wren` | Glowfen elder at the reed mat by the Pool. Would keep the glow, whatever it costs. | "No." / "Hands in the light. Six breaths. Then go." |
| `npc_elder_tam` | Elder Tam | — (Glowfen folk) | loc_lanternreed | flavor (the Mangrove speaks in his voice, `ev_mangrove_answer`) | Eldest of Lanternreed, so far into the glow that the tree answers for him. | "Not yet." / "The pool breathes. We breathe with it. Lately it breathes for us." |
| `npc_old_fennick` | Old Fennick | — (Glowfen folk) | **stall: loc_lanternreed** | merchant (DESIGN `npc_mireya_stall`) | Stall-keeper on the stilts; trades moss for Nomad salt through the Reedmarch baskets. | "Moss is three a bundle. The salts are dear; the light goes into them." / "Never met a Nomad. Good salt, though." |
| `npc_hesper_dunn` | Gate-Captain Hesper Dunn | — (Silverwood Watch) | loc_silver_gate (Days 1–3) | flavor; gatekeeper (issues the visitor's pass that keeps `flag_wanted_in_silverwood` off); quest giver pending (Q8) | Gate-captain under Captain Corvin Dreyl. Takes the Wayfinder for a foreign scholar. | "Papers. Scholar? From where? No — don't tell me. I'd have to write it down." / "Blades sheathed in the Plaza. Captain Dreyl's order, not mine." |
| `npc_bellwright_anso` | Anso the Bellwright | — (Silverwood) | **stall: loc_plaza_of_bells** | merchant (charms, bell-bronze, honeycake) | Casts the Plaza's nine bells and sells charms beneath them. | "Bell-charm, scholar? Rung once on First Bell, it keeps the luck all year." / "The ninth bell is flat. I told them. Nobody listens to a bellwright." |
| `npc_veyran_thal` | Archmagus Veyran Thal | — (Ninefold Circle) | loc_ninefold_hall (Days 1–2); loc_conflux_chamber (Day 3, non-interactive) | flavor; q_stop_the_ritual attempt 1; `ev_hall_veyran` grants `echo_tyrant_name` | Leader of the Nine, whole. Kind to apprentices, certain a mind large enough can hold anything. | "You are not from the city. You are not from the year." / "The Holding is a kindness to the hour. We keep it still and look at it. That is all." |
| `npc_nyxaria_vell_before` | Nyxaria Vell (young) | — (Ninefold Circle) | loc_ninefold_hall (Days 1–2); loc_plaza_of_bells (nights) | flavor; Nyx-arc scenes | Youngest of the Nine, ~30, eyes still ordinary. The only one who looks at you twice. | "You're from the far side of something. I can see the seam on you." / "There is a dark between one moment and the next. Nobody else wants to talk about it." |
| `npc_oriel_danthe` | Oriel Danthe | — (Ninefold Circle) | loc_archives_of_danthe (Days 1–3) | flavor; gives `item_litany_page_3`; `ev_archives_oriel` grants `echo_oriel_lineage` | The Circle's archivist, writing the Litany in fair copy in case. Ilyra's hands. | "You have my hands. No. Someone with my hands sent you." / "Let it be written as it is done. Pass me the blotter." |
| `npc_maelis_korr` | Maelis Korr | — (Ninefold Circle) | loc_scholars_corridor (Days 1–2, lecturing at the clean wall) | flavor (Corruption beats; `echo_korr_marginalia`) | Author of the Dark Spellbooks; annotates an uncharred workbook while his students listen. | "What is read is owed. Read it twice and you owe it twice." / "Margins are where the honest work is. Mind the ink." |
| `npc_haldric_vane` | Haldric Vane | — (Ninefold Circle) | loc_ninefold_hall (Days 1–2, golem sigils on the floor-map) | flavor (`echo_stone_hide_origin` beat) | The Warder. Trusts stone over people. | "Stone does not tire of an order. That is the whole of its virtue." / "Keep the line and hold the gate. I wrote that for them, not for us." |
| `npc_durn_hallow` | Durn Hallow | — (Ninefold Circle) | loc_conflux_chamber (Days 1–2, at a field-forge by the stair) | flavor; q_stop_the_ritual attempt 2 (`echo_hallow_said_stop`) | The Circle's smith, fitting the iron cradle. The one who will say "Stop." | "Iron that does not wish. That's what I made. Don't ask it to want things." / "Held is not the same as holding. Nobody hears the difference but me." |
| `npc_seraphine_aulde` | Seraphine Aulde | — (Ninefold Circle) | loc_outer_walks (Days 1–2, tuning the Spires from the east terrace) | flavor (`echo_spire_note` beat) | The Spire-builder. Loves one note above all others. | "Listen. East. That is the note. Everything else is tuning." / "Rise, lines. Not yet. Tomorrow." |
| `npc_imre_sallow` | Imre Sallow | — (Ninefold Circle) | loc_cistern_gardens (Days 1–2, the Green Court beds) | flavor (`echo_breathing_pool` beat) | Life-mage and gardener; agreed only if the overflow went to living things. | "Green takes what stone cannot. I made them promise." / "Seedlings, not soldiers. Hold this one by the root." |
| `npc_tovren_masque` | Tovren Masque | — (Ninefold Circle) | loc_grand_library (on the glass roof, Days 1–3) | flavor; q_stop_the_ritual final beat (`echo_ritual_inevitable`) | Astronomer. Has read the sky twice, and it said no. | "It fails. I have read it twice. I will read it again because he asked." / "You see it too now. From the far side." |
| `npc_tobrin_vask` | Tobrin Vask | — (Silverwood; not of the Nine, D-063) | loc_ninefold_hall (Day 2); loc_conflux_chamber (Day 2: gives `item_ward_seal` with `echo_vask_seal`) | flavor; Breach-anchor schematic B | Haldric Vane's apprentice ward-engineer; keeps the failsafe's second half. | "Master Vane says a ward is a promise stone makes for you. I check the promises." / "Take the seal. If it goes wrong, someone should be able to open the door." |
| `npc_corvin_dreyl` | Captain Corvin Dreyl | — (Silverwood Watch; not of the Nine, D-063) | loc_plaza_of_bells (Days 1–3, the Watch post) | flavor; arrests (`flag_wanted_in_silverwood`); trace of `echo_dreyl_brand` | Captain of the Silverwood Watch. His pyre-ward, built to Vane's design, will turn outward and burn the Steppe. | "Blades sheathed in the Plaza. I will not ask twice. I will have you carried." / "The ward rings the city. Nothing crosses it that it doesn't burn." |
| `npc_ilsabet_rhune` | Ilsabet Rhune, Warden of Waters | — (Silverwood civic office; not of the Nine, D-063) | loc_cistern_gardens (Day 2) | flavor; gives `item_cistern_key` (with `echo_rhune_choice`) | Checks every sluice-wheel twice and does not sleep. Will open the cisterns to drown the Conflux's fire. | "If it fails, I will drown the fire. The city will forgive me or it will not be there to." / "You will need this where you are going. I will not." |
| `npc_hadrek` | Hadrek the Clockwright | — (Silverwood; not of the Nine, D-063) | loc_ninefold_hall (Day 1, servicing the floor-map from Masque's empty chair) | flavor; `item_orrery_key` duplicate (with `echo_hadrek_clockwright`) | Tovren Masque's orrery-maker. | "Every gear in the Nexus orrery is mine. The sky is his. I only make it turn." / "His chair. He's on the roof again. Sit if you like. He won't." |

**Merchants (8) and stalls.** Kaelen Stonehand (loc_wayfarers_respite), Borin Stonefist
(loc_emberforge; also the crafter), Tamsin Reed (loc_silverwood_plaza), Sedge Marrow
(loc_lamplighters_rest), Tessaly Varr (loc_hearthring; caravan at loc_ironclad_camp after
`flag_hearthring_caravan`), Hollis Cade (loc_sanctum_of_threads), Old Fennick (loc_lanternreed),
Anso the Bellwright (loc_plaza_of_bells). DESIGN §9.4 placeholders map: `npc_kaelen` →
`npc_kaelen_stonehand`; `npc_ironclad_quartermaster` → `npc_tessaly_varr`; `npc_remnant_archivist` →
`npc_tamsin_reed`; `npc_veil_vendor` → `npc_hollis_cade`; `npc_mireya_stall` → `npc_old_fennick`;
`npc_skyreach_trader` → no WORLD merchant exists (Q7).

**STORY §11 givers → ids.** Ilyra `npc_ilyra`; Keeper Ansel Dray `npc_ansel_dray`; Brak `npc_brak`;
Hadda Ironvow `npc_hadda_ironvow`; Nyx `npc_nyx`; Sethe `npc_sethe_unlidded`; Elder Wen
`npc_elder_wen`; Dask `npc_dask`; Kaelen `npc_kaelen_stonehand`; Mireya `npc_mireya`; Caelum
`npc_caelum`; Borin `npc_borin_stonefist`; "the Tyrant" (q_unbound) is `cr_chronos_tyrant_unveiled`
in communion, not an NPC. "auto", "discovery" and "self (Amulet)" need no NPC.

---

## 5. Creature families

Eight families, plus Mortals (people, not a family). Each family has one origin in the Ninefold
Circle or the Sundering (STORY §2.2), one silhouette rule (matching DESIGN §17's sigil shapes), and
one lesson for the player. DESIGN §8.2's material "families" are kin inside these: `shade`,
`void_touched` → Hollowed; `wildling` → Wilds; `drowned` → Drowned; `golem` → Wards; `wisp`,
`aetherial`, `sentinel` → Spireborn; `mireling` → Green; `phantom`, `aberration` → Watch-wardens;
`chronos_tyrant_*` → Unravelled.

| Family id | Name | Origin | Silhouette | Deals | Weak / resist tendency | Materials | Lesson |
|---|---|---|---|---|---|---|---|
| `fam_hollowed` | The Hollowed | **Maelis Korr** (the Lesson: his students paid the debt and are still paying — Shades) and **Nyxaria Vell** (the dark between she named, which the Stalkers, Mouths and her Umbra came out of) | Teardrop sigil; smeared outlines; pieces missing, as if erased | void; curse, weaken, blind | weak **ley** (Ley lifts Curse ×1.25), Shades also weak fire; resist void, wraiths resist physical; tag breach-born | `mat_shadow_ash`, `item_void_shard`, `mat_breach_glass`, `mat_umbral_thread`† | Clean the Curse and the big hit never comes. |
| `fam_wilds` | The Wilds | No maker. Beasts and growths bent by the ley-wash; on the Steppe, what **Corvin Dreyl's** pyre-ward burned and branded; in the Before, the Circle's bred hounds | Triangle sigil; four legs or none, heads low | physical; bleed, slow; Steppe kin fire | Mistwood kin weak **fire**; Steppe (ash-born) kin resist fire, weak **storm**; living (Poison works) | `mat_wildling_hide`, `mat_rootbone`, `mat_steppe_salt`, `mat_ember_ore`, `mat_cinder_horn`† | Watch the wind-up; Guard the heavy. |
| `fam_drowned` | The Drowned | **Ilsabet Rhune** opening the cisterns on the last day; the scholars who stayed with the shelves; **Oriel Danthe**, the First Drowned (D-046) | Circle sigil cut by a waterline; hunched, robed, dripping | physical, storm, ley; soaked, slow, mark | tag drowned (always Soaked: **storm** ×1.5 and spreads Shock, fire ×0.5); weak **ley** (the clean current loosens the binding); resist fire; breach-born | `mat_sodden_vellum`, `mat_drowned_pearl`, `mat_bell_bronze`† | Bring Storm. Kill the reader first, or it reads them back. |
| `fam_wards` | Wards | **Haldric Vane** ("Stone, stand where flesh would fall") | Hexagon sigil; slate and iron, ring-and-bar sigil on the chest | physical; armor break, stun | resist **fire, ley, void, chrono** ("magic skitters off"); neutral physical and storm; tag construct; Harden re-arms | `mat_slate_core`, `mat_iron_rivet`, `mat_silverwood_heartwood`, `mat_conflux_dust`† | Break the armor, then hit it with something plain. |
| `fam_spireborn` | Spireborn | **Seraphine Aulde** (loom-strands carrying her one note; her Sentinels and their spotters) | Rhombus sigil; threads of light, vanes, glass | ley; skyborn kin storm; shock, slow, mark | resist **ley**; skyborn kin resist storm; weak **void** (unspins them), glass kin weak physical, skyborn kin weak chrono (strips Haste); tag construct; skyborn | `mat_ley_spark`, `item_aetherium_shard`, `mat_spire_thread`, `mat_gale_feather`, `mat_skyreach_crystal`, `mat_storm_glass`† | Kill the loom, not the cord; cut the tether before the dive. |
| `fam_green` | The Green | **Imre Sallow** (the Breath: "Let what lives carry what does not" — the overflow leaking into the Glowlands and Glowfen) | Circle sigil lit from inside; soft, swollen, glowing at throat and wrist | ley, physical; poison, blind, regen | weak **fire**, weak **void** (Void strips Regen); resist ley; Poison immune (they carry it) | `mat_glow_gland`, `item_glow_moss`, `mat_glow_spore`†, `mat_lantern_resin`† | Take the Regen away first. |
| `fam_watch_wardens` | Watch-wardens | **Tovren Masque** (the Eye: wardens set to keep the observatory's hours; the hours broke and they keep all of them, out of order) | Spiral sigil; doubled outlines, after-images | chrono; slow, rewind, haste, phase; hidden intents | resist **chrono**; weak **void** (Void consumes Rewind ×1.25); breach-born | `item_chronal_dust`, `mat_frayed_moment` | Guard the "?"; Void after it rewinds. |
| `fam_unravelled` | The Unravelled | **Veyran Thal's** Holding failing: the Tyrant itself (with Korr, Vane, Aulde, Sallow and Masque surfacing in it) and what spills when the hold slips — the Horde, the Day of Teeth | Broken circle with a spiral through it; parts of every other family, flickering | chrono, void | resist **chrono, void**; weak **ley** (DESIGN §4.10); many intents hidden ("no next moment"); breach-born | `mat_frayed_moment`, `mat_tyrant_shard` (Unveiled only), `mat_breach_glass` | Ley gives them an order to fall apart in. |
| *(Mortals)* | People | Silverwood's Watch and the Circle's adepts (the Before); Weaver sentries (the Veil) | No sigil; a portrait | physical, ley, fire, void | neutral; can be Stunned, Bled and Poisoned; often yield or call help | none (coin, kit) | They can be avoided. Often they should be. |

**Family counts (57).** Hollowed 6 · Wilds 8 · Drowned 7 · Wards 4 · Spireborn 9 · Green 6 ·
Watch-wardens 7 · Unravelled 7 · Mortals 3.

