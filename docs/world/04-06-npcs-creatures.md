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

---

## 6. Creatures (57)

Exactly the 57 ids WORLD §3 uses. STORY §11 needs no others: its "Unravelled" (q_day_of_teeth) are
`cr_horde_husk`, its "Aberrant Eye" comes from `cr_temporal_aberration`, and DESIGN §4.10's
`nine_shard` adds are `cr_tyrants_reach`. Roles: 33 fodder · 9 elite · 6 anomaly · 9 boss.

| id | Name | Family | Role | L | Regions | XP |
|---|---|---|---|---|---|---|
| `cr_aetherial_weaver` | Aetherial Weaver | Spireborn | fodder | 8 | Highlands, Skyreach | 161 |
| `cr_arcane_wisp` | Arcane Wisp | Spireborn | fodder | 2 | Silverwood Ruins | 41 |
| `cr_ashmaw` | Ashmaw | Wilds | **boss** | 12 | Ashen Steppe | 650 |
| `cr_barrow_light` | Barrow-Light | Green | fodder | 11 | Glowfen | 253 |
| `cr_bell_ringer` | Bell-Ringer | Drowned | elite | 7 | Drowned Reach | 243 |
| `cr_bell_warden` | The Bell-Warden | Drowned | **boss** | 9 | Drowned Reach | 450 |
| `cr_brine_lamprey` | Brine Lamprey | Drowned | fodder | 5 | Drowned Reach | 90 |
| `cr_chronos_tyrant_contained` | The Chronos Tyrant (Contained) | Unravelled | **boss** | 14 | Apex, Loop 1 | 900 |
| `cr_chronos_tyrant_unveiled` | The Chronos Tyrant (Unveiled) | Unravelled | **boss** | 18 | Apex, Loop 2+ | 1,600 |
| `cr_cinderback` | Cinderback | Wilds | elite | 8 | Ashen Steppe | 290 |
| `cr_circle_adept` | Circle Adept | Mortal | fodder | 14 | Silverwood Before | 367 |
| `cr_city_watch_halberdier` | City Watch Halberdier | Mortal | fodder | 13 | Silverwood Before | 327 |
| `cr_cloud_ray` | Cloud Ray | Spireborn | fodder | 13 | Skyreach | 327 |
| `cr_corrupted_shade` | Corrupted Shade | Hollowed | fodder | 2 | Silverwood Ruins | 41 |
| `cr_drowned_archivist` | Drowned Archivist | Drowned | fodder | 4 | Silverwood Ruins, Drowned Reach | 71 |
| `cr_gale_kite` | Gale Kite | Spireborn | fodder | 12 | Skyreach | 289 |
| `cr_glass_mote` | Glass Mote | Spireborn | fodder | 8 | Highlands, Skyreach | 161 |
| `cr_glowfen_mireling` | Glowfen Mireling | Green | fodder | 9 | Glowlands, Glowfen | 189 |
| `cr_hollow_lantern` | Hollow Lantern | Hollowed | fodder | 10 | Veil | 220 |
| `cr_horde_husk` | Horde Husk | Unravelled | fodder | 12 | Horde (any infected node) | 289 |
| `cr_hour_leech` | Hour Leech | Watch-wardens | anomaly (Loop 4+) | 12 | Chronos Nexus | 376 |
| `cr_hourglass_crawler` | Hourglass Crawler | Watch-wardens | fodder | 11 | Nexus, Depths (exploited) | 253 |
| `cr_lantern_matron` | The Lantern Matron | Green | **boss** | 13 | Glowfen | 700 |
| `cr_lantern_toad` | Lantern Toad | Green | fodder | 8 | Glowlands, Glowfen | 161 |
| `cr_ledger_choir` | Ledger Choir | Drowned | elite | 7 | Drowned Reach | 243 |
| `cr_ley_hound` | Ley Hound | Wilds | fodder | 13 | Silverwood Before | 327 |
| `cr_mistwood_prowler` | Mistwood Prowler | Wilds | fodder | 2 | Silverwood Ruins, Mistwood | 41 |
| `cr_moment_moth` | Moment Moth | Watch-wardens | fodder | 6 | Highlands | 111 |
| `cr_ninefold_knight` | Ninefold Knight | Wards | elite | 15 | Silverwood Before | 738 |
| `cr_null_mouth` | Null Mouth | Hollowed | fodder | 12 | Veil | 289 |
| `cr_orrery_knight` | Orrery Knight | Watch-wardens | elite | 13 | Chronos Nexus | 588 |
| `cr_pale_diver` | Pale Diver | Drowned | fodder | 6 | Drowned Reach | 111 |
| `cr_paradox_wisp` | Paradox Wisp | Spireborn | anomaly (Loop 2+) | 4 | Silverwood Ruins | 92 |
| `cr_redundant_wayfinder` | Redundant Wayfinder | Unravelled | anomaly (Loop 4+) | 12 | Silverwood Ruins, Veil | 676 |
| `cr_reed_stalker` | Reed Stalker | Green | fodder | 9 | Ashen Steppe, Glowfen | 189 |
| `cr_rootling` | Rootling | Wilds | fodder | 2 | Mistwood | 41 |
| `cr_salt_jackal` | Salt Jackal | Wilds | fodder | 7 | Ashen Steppe | 135 |
| `cr_shimmering_phantom` | Shimmering Phantom | Watch-wardens | fodder | 6 | Highlands | 111 |
| `cr_sky_whisper_sentinel` | Sky-Whisper Sentinel | Spireborn | fodder | 9 | Highlands, Skyreach | 189 |
| `cr_spire_loom` | Spire Loom | Spireborn | elite | 14 | Skyreach | 661 |
| `cr_spore_drift` | Spore Drift | Green | fodder | 9 | Glowlands, Glowfen | 189 |
| `cr_starved_shadow` | Starved Shadow | Hollowed | elite | 12 | Veil | 520 |
| `cr_steppe_harrier` | Steppe Harrier | Wilds | fodder | 8 | Highlands, Ashen Steppe | 161 |
| `cr_stone_hide_golem` | Stone-Hide Golem | Wards | elite | 6 | Mistwood & Reach | 200 |
| `cr_stormcrown` | The Stormcrown | Spireborn | **boss** | 16 | Skyreach | 950 |
| `cr_stutter_hound` | Stutter Hound | Watch-wardens | anomaly (Loop 2+) | 5 | Mistwood & Reach | 117 |
| `cr_temporal_aberration` | Temporal Aberration | Watch-wardens | elite | 12 | Nexus; Contained Tyrant add | 520 |
| `cr_tide_clerk` | Tide Clerk | Drowned | fodder | 5 | Drowned Reach | 90 |
| `cr_tyrants_reach` | Tyrant's Reach | Unravelled | anomaly (Loop 3+) | 9 | Highlands; Unveiled Tyrant add | 246 |
| `cr_unbroken_warden` | The Unbroken Warden | Wards | **boss** | 18 | Silverwood Before | 1,100 |
| `cr_unmade` | The Unmade | Unravelled | anomaly (Loop 3+) | 13 | Depths (exploited), Drowned Reach | 425 |
| `cr_unraveling_tide` | The Unraveling Tide | Unravelled | **boss** (Horde) | 14 | Horde: loc_darkened_corridor | 500 |
| `cr_veil_sentry` | Veil Sentry | Mortal | fodder | 10 | Voidscar, Veil | 220 |
| `cr_vells_umbra` | Vell's Umbra | Hollowed | **boss** | 15 | Veil | 800 |
| `cr_void_touched_stalker` | Void-Touched Stalker | Hollowed | fodder | 6 | Voidscar, Veil | 111 |
| `cr_warding_pillar` | Warding Pillar | Wards | fodder | 6 | Mistwood & Reach, Silverwood Before | 111 |
| `cr_wildling_brute` | Wildling Brute | Wilds | fodder | 4 | Mistwood & Reach | 71 |

### 6.1 The Hollowed

#### `cr_corrupted_shade` — Corrupted Shade
**Hollowed (Shade) · L2 fodder · XP 41** · loc_darkened_corridor; Depths (destroyed state); pools ·
*legacy: HP 30 · dmg 8 · def 2 · agi 4 · XP 35*
- **Stats:** HP 36 · ATK 7 · DEF 1/2 · AGI 5 · void · breach-born (DESIGN §4.12 numbers)
- **Resist:** weak ley, fire · resist void · immune poison
- **Intents:**
  - `shade_rake` · "It drags long fingers through the air toward you." · 1.0× physical you
  - `shade_wail` · "Its mouth opens wider than its face." · 0.9× you · weaken 50% 2
  - `shade_fade` · "It thins until the wall shows through." · phase self 1 · ifHpBelow:70
- **Loot:** 7–12 g · `item_dark_spellbook`: the first Corrupted Shade killed each loop 100%, every later
  Shade 50% (D-055) · `mat_shadow_ash` 80%
- **Legacy description:** "A smeared silhouette of a once-noble mage, warped by wild magic."
- **Bestiary** (Remnant Archive): Year 212. Shades keep to corridors and stairs, the places students
  walked between lectures. Each carries a Dark Spellbook, or the memory of one. Maelis Korr taught
  that knowledge is a debt; these are the students who paid in full and are still being billed. Do
  not read what one drops in the room where it fell.
- **Tactics:** Hit hard before 70%; when it Fades, use an area or Chrono hit (Phase stops neither)
  or spend the turn Guarding. Ley or fire ends it fastest.

#### `cr_starved_shadow` — Starved Shadow
**Hollowed (Shade) · L12 elite · XP 520** · loc_voidglass_gallery
- **Stats:** HP 280 · ATK 23 · DEF 2/6 · AGI 9 · void · breach-born
- **Resist:** weak fire, ley · resist void, physical · immune poison
- **Intents:**
  - `starved_snuff` · "It leans over the light you carry and inhales." · 0.6× all · blind 60% 2 · first
  - `starved_gnaw` · "It folds around your arm, mouth first." · 1.3× you · curse 50% 3
  - `starved_feed` · "It swallows the dark it made and swells." · heal self 1.5× · ifTargetHas:blind
  - `starved_hunger` · "It goes thin and fast toward the brightest thing here." · 1.8× highest-MAG target · everyNthTurn:4
- **Loot:** 54–84 g · `mat_shadow_ash` ×2 100% · `mat_breach_glass` 30% · `item_dark_spellbook` 25%
- **Bestiary** (Wayfinder's Notes): Blind on the first turn, every time, unless I carry the Hollow
  Lantern focus. It does not want me. It wants my light. While I'm blind it eats, and grows. Fire
  makes it flinch. Ley makes it remember it was a student. I don't know which is crueller.
- **Tactics:** Bring `item_hollow_lantern_focus` or a Blind cleanse so Feed never triggers; burst it
  with fire or ley; Guard on its fourth turn, especially as a caster.

#### `cr_hollow_lantern` — Hollow Lantern
**Hollowed (Void) · L10 fodder · XP 220** · loc_veil_mouth, loc_voidglass_gallery; Vell's Umbra add;
Depths (destroyed state, see Errata E12)
- **Stats:** HP 110 · ATK 20 · DEF 0/5 · AGI 8 · void · breach-born
- **Resist:** weak physical, ley · resist void, fire · immune poison
- **Intents:**
  - `lantern_gutter` · "Its glass goes black. Your light bends toward it." · 0.8× you · blind 40% 2
  - `lantern_drink` · "It drinks the light out of your wounds." · 1.0× you · heals self for 50% of damage dealt
  - `lantern_shelter` · "It draws its dark around another." · shield ally 1.2× · ifAllyPresent
- **Loot:** 23–36 g · `mat_shadow_ash` 60% · `mat_breach_glass` 25% · `item_hollow_lantern_focus` 10%
  (as W-B §7; it is also craftable)
- **Bestiary** (Wayfinder's Notes): The Weavers carry lanterns that hold dark the way ours hold flame.
  A few got loose. They float at the Veil Mouth and wait for anything bright. Break the glass and the
  dark goes back where it came from, which is everywhere.
- **Tactics:** Plain steel breaks the glass. Kill it before it Shelters something bigger.

#### `cr_null_mouth` — Null Mouth
**Hollowed (Void) · L12 fodder · XP 289** · loc_stair_of_unmaking, loc_null_orchard
- **Stats:** HP 140 · ATK 23 · DEF 3/4 · AGI 4 · void · breach-born
- **Resist:** weak ley, chrono · resist void, physical · immune poison
- **Intents:**
  - `null_bite` · "Its edge opens toward your shield arm." · 1.2× you (Void: destroys Shield)
  - `null_unmake` · "It swallows something of yours you were relying on." · 0.5× you · strips your shield, regen, haste, rewind
  - `null_gape` · "It opens wide enough to step into." · 1.6× you · weaken 50% 2 · everyNthTurn:3
  - `null_fill` · "It closes on nothing and is briefly less hungry." · regen self 0.4×/3 · ifHpBelow:40
- **Loot:** 27–42 g · `mat_breach_glass` 40% · `item_void_shard` 25% · `mat_umbral_thread`† 30%
- **Bestiary** (Remnant Archive): Year 488, the Null Orchard. A mouth with no head attached, roughly
  round, roughly a man's height. It eats what holds you together for the length of a fight: wards,
  regrowth, borrowed speed. It does not eat flesh. The Weavers call it the orchard's gardener. We did
  not ask what it prunes.
- **Tactics:** Do not pre-buff. Cast shields and regen after Unmake, not before. Chrono hits it hard.

#### `cr_void_touched_stalker` — Void-Touched Stalker
**Hollowed (Void) · L6 fodder · XP 111** · loc_voidscar_hollow (the legacy three), loc_scar_shelf;
q_bone_road ambushes · *legacy: HP 40 · dmg 9 · def 2 · agi 6 · XP 55*
- **Stats:** HP 76 · ATK 14 · DEF 2/2 · AGI 8 · void · breach-born
- **Resist:** weak ley · resist void · immune poison
- **Intents:**
  - `stalker_circle` · "It slips out of sight between two moments." · phase self 1 · first
  - `stalker_lunge` · "Cold starlight narrows on your throat." · 1.1× physical you · bleed 40% 3
  - `stalker_starbite` · "Its eyes flare; the cold reaches you first." · 0.9× you · curse 40% 3
  - `stalker_pounce` · "It crouches low, all its weight on the back legs." · 1.5× physical you · ifTargetHas:curse
- **Loot:** 15–24 g · `item_void_shard` 100% (legacy; DESIGN §8.2) · `item_warriors_sword` 25% (legacy bonus) ·
  `item_chasmglass_focus` 10% (W-B §7)
- **Legacy description:** "A predator born of corrupted ley echoes, eyes like cold stars."
- **Bestiary** (Wayfinder's Notes): Three in the Hollow, always three. They open by vanishing, so my
  first swing hits air. Wait it out. The pounce only comes after the cold gets into me. Clean the
  Curse with Ley and the pounce never comes. Each one carries a shard behind the eyes. Nyx wants them.
  So does Borin.
- **Tactics:** Guard or buff on turn one; answer every Curse with a Ley hit (removes it, ×1.25).

#### `cr_vells_umbra` — Vell's Umbra (boss)
**Hollowed (Void) · L15 boss · XP 800** · loc_eye_of_the_scar (forced; adds `cr_hollow_lantern`)
- **Stats:** HP 600 · ATK 27 · DEF 2/8 · AGI 9 · void · breach-born · cannot be fled
- **Resist:** weak ley, fire · resist physical · immune void · status immune: poison, blind, curse;
  Stagger allowed
- **Phase 1 — Her Shape** (100–60%; skipped, fight opens in Phase 2, if `{killed:"cr_vells_umbra"}` in
  any earlier loop, WORLD §2.9):
  - `umbra_her_hand` · "A woman's hand of shadow reaches for your face." · 1.0× you · curse 50% 3
  - `umbra_name_the_dark` · "It says a word you almost hear. The room dims." · blind 60% 2 all · everyNthTurn:3
  - `umbra_open` · "'Open,' it mouths, 'and be entered.'" · hidden · 1.6× you · ifTargetHas:blind
  - *Transition (<60%):* "The shadow lets go of the floor. It is the whole room now, and it has stopped waiting."
- **Phase 2 — The Dark Between** (<60%; onEnter: 2× `cr_hollow_lantern` at full HP):
  - `umbra_between` · "It steps into the gap between your heartbeats." · 0.8× all · phase self 1
  - `umbra_unname` · "It takes back something it never gave you." · 0.6× you · weaken 100% 2 · strips your shield
  - `umbra_her_hand` (as Phase 1)
  - *Transition (<25%):* "'Forty years,' says a voice that is almost Nyx's. 'I have been patient forty years.'"
- **Phase 3 — Forty Years** (<25%; Haste self every turn):
  - `umbra_fall` · "It falls toward you from very far away." · hidden · 2.2× all · everyNthTurn:3
  - `umbra_cling` · "It pulls a lantern into itself and darkens." · heal self 2.0× · ifAllyPresent (consumes one lantern)
  - `umbra_her_hand` (as Phase 1)
- **Pacifist:** with Nyx active and `echo_nyx_is_of_the_nine` (WORLD's `echo_nyx_true_name`, Errata E9)
  she calls it back into herself (WORLD §3.8).
- **Loot:** 165–255 g · `item_umbral_mirror` 100% · `mat_umbral_thread`† ×3 100% · `mat_breach_glass` ×2
  100% · `item_void_shard` ×2 60%
- **Bestiary** (Wayfinder's Notes): A shadow no one casts, with Nyx's shoulders and her way of
  standing. When Nyxaria Vell fell out of the year, her shadow stayed behind at the Eye. For forty
  years it has learned her shape from memory and got it slightly wrong. It wants her back. It will
  settle for something warm. When Nyx stands beside me and says her own name, it goes to her like a dog.
- **Tactics:** Ley twice per Curse. Keep a Blind cleanse for the Open combo. Kill the lanterns before
  25% or it eats them. In Phase 3, Guard every third turn; Chrono strips its Haste for a turn.

### 6.2 The Wilds

#### `cr_wildling_brute` — Wildling Brute
**Wilds · L4 fodder · XP 71** · loc_barren_peaks (q_clear_path target); q_bone_road ambushes ·
*legacy: HP 45 · dmg 10 · def 3 · agi 3 · XP 40*
- **Stats:** HP 64 · ATK 11 · DEF 3/0 · AGI 3 · physical (DESIGN §4.12 numbers and pattern)
- **Resist:** weak fire · resist — · immune —
- **Intents:**
  - `brute_strike` · "It lifts a root-knotted arm over you." · 1.0× you
  - `brute_maul` · "Bone grinds as it winds back both arms." · 1.6× you · everyNthTurn:3
  - `brute_root_knit` · "Roots crawl back over its wounds." · regen self 3/turn, 2 turns · ifHpBelow:50
- **Loot:** 11–18 g · `item_ley_touched_tonic` 60% · `item_wildling_hide_armor` 25% (legacy 50%) ·
  `mat_wildling_hide` 80% · `mat_rootbone` 40%
- **Legacy description:** "A hulking creature grown from twisted roots and bone."
- **Bestiary** (Wayfinder's Notes): Roots and bone, grown into a shape that walks. It swings twice and
  then winds up; the third one is the one to Guard. Below half it lets roots crawl over its wounds.
  Brak says the Peaks were quiet before the Brute. Brak says a lot of things were quiet before.
- **Tactics:** Guard the Maul. Fire is weak; Void strips the knit-Regen; Bleed and Poison both work.

#### `cr_rootling` — Rootling
**Wilds · L2 fodder · XP 41** · loc_mistwood_path (×3)
- **Stats:** HP 30 · ATK 7 · DEF 2/0 · AGI 4 · physical
- **Resist:** weak fire · resist — · immune —
- **Intents:**
  - `rootling_trip` · "Roots slide toward your ankles." · 0.7× you · slow 40% 2
  - `rootling_jab` · "It whips a sharpened root at your shin." · 1.0× you · bleed 25% 2
  - `rootling_burrow` · "It sinks into the loam, leaving a twitching mound." · shield self 1.0× · ifAllyDown
- **Loot:** 7–12 g · `mat_rootbone` 50% · `mat_ley_resin` 20%
- **Bestiary** (Wayfinder's Notes): Knee-high. They come in threes. Ilyra thinks a Rootling is what a
  Wildling Brute is before it gets its bones. When one dies the others dig in, so kill them evenly,
  or burn them all at once.
- **Tactics:** Area damage; fire.

#### `cr_mistwood_prowler` — Mistwood Prowler
**Wilds · L2 fodder · XP 41** · loc_crumbling_archway, loc_mistwood_path
- **Stats:** HP 38 · ATK 9 · DEF 1/1 · AGI 8 · physical
- **Resist:** weak fire · resist — · immune —
- **Intents:**
  - `prowler_from_fog` · "The fog thickens on your left. It is not fog." · 1.3× you · first
  - `prowler_rake` · "Bark-patterned flanks ripple as it circles you." · 0.9× you · bleed 30% 3
  - `prowler_fade` · "It steps back into the fog and is gone." · phase self 1 · everyNthTurn:3
- **Loot:** 7–12 g · `mat_wildling_hide` 40% · `mat_ley_resin` 30% · `item_travelers_sword` 10% (W-B §7)
- **Bestiary** (Remnant Archive): Year 471. A lean grey cat with bark-light patterning along the
  flanks. It hunts the Archway at dusk and will follow a scholar a mile without closing. Lanterns do
  not deter it. Noise does. Remnants who walk the Archway walk in pairs, and talk.
- **Tactics:** Guard the opening; hold your heavy hit for the turn after it Fades.

#### `cr_salt_jackal` — Salt Jackal
**Wilds (Steppe) · L7 fodder · XP 135** · loc_ash_wind_flats, loc_grey_salt_pan, loc_bone_orchard (×2–3);
Ashmaw add
- **Stats:** HP 74 · ATK 15 · DEF 2/1 · AGI 10 · physical
- **Resist:** weak storm · resist fire · immune —
- **Intents:**
  - `jackal_harry` · "The pack laughs together and spreads around you." · 0.6× you · mark 100% 2 · first
  - `jackal_snap` · "A salt-white shape darts in low at your heel." · 0.9× you · bleed 30% 3
  - `jackal_pull_down` · "They all look at the same leg." · 1.4× you · ifTargetHas:mark
  - `jackal_scatter` · "It yelps and runs for the glare." · leaves combat (no loot) · ifHpBelow:25
- **Loot:** 17–27 g · `mat_steppe_salt` 60% · `mat_wildling_hide` 40%
- **Bestiary** (Wayfinder's Notes): I hear them before I see them, and at noon on the Pan I don't
  see them at all. One marks me; the rest go for whatever is marked. Kill the first one that laughs.
  Hurt one badly and it runs into the white, which is fine, because I wasn't going to find it.
- **Tactics:** Clear Mark or Guard when the pack converges; Storm across the pack.

#### `cr_steppe_harrier` — Steppe Harrier
**Wilds (Steppe) · L8 fodder · XP 161** · loc_sky_whisper_plateau, loc_ash_wind_flats,
loc_stormgate_cairns, loc_watchfire_ridge (×2) · skyborn
- **Stats:** HP 88 · ATK 17 · DEF 1/2 · AGI 12 · physical
- **Resist:** weak chrono · resist fire · immune —
- **Intents:**
  - `harrier_stoop` · "A shadow drops out of the white sky at you." · 1.3× you · first
  - `harrier_rake` · "Talons open as it skims past your eyes." · 0.8× you · blind 30% 1
  - `harrier_climb` · "It beats upward into the wind and hangs there." · haste self 2 · everyNthTurn:3
  - `harrier_dive` · "It folds its wings above you." · 1.5× you · ifSelfHas:haste
- **Loot:** 19–30 g · `mat_gale_feather` 50% · `mat_steppe_salt` 20%
- **Bestiary** (Remnant Archive): Year 497. The grey hawk of the Steppe, wingspan of a tall man,
  hunting in pairs along the ash-paths and up onto the Plateau when the gales come. It climbs, it
  hangs, it drops. The Nomads shout "up" and raise shields. Its feathers fetch good salt.
- **Tactics:** A Chrono hit strips the Haste and cancels the dive; otherwise Guard after it climbs.

#### `cr_cinderback` — Cinderback
**Wilds (Steppe) · L8 elite · XP 290** · loc_ash_wind_flats (60%), loc_bone_orchard (50%)
- **Stats:** HP 200 · ATK 17 · DEF 5/2 · AGI 3 · physical (fire on Stampede and Shake)
- **Resist:** weak storm · resist fire · immune burn
- **Intents:**
  - `cinder_stampede` · "The ground shakes. It lowers a burning head at you." · 2.0× fire you · burn 60% 3 · first · misses entirely if you Guard (WORLD §3.7)
  - `cinder_hook` · "It swings a horn wreathed in coals." · 1.1× you · armor_break 30% 2
  - `cinder_shake` · "It shakes, and ash pours off its back." · 0.5× fire all · blind 40% 1
  - `cinder_rekindle` · "The coals along its spine flare white." · shield self 1.0× · ifHpBelow:50
  - `cinder_paw` · "It backs off, pawing the ash, eyes on you." · 1.8× fire you · burn 60% 3 · everyNthTurn:4
- **Loot:** 38–60 g · `mat_cinder_horn`† 100% · `mat_ember_ore` 40% · `mat_wildling_hide` 60%
- **Bestiary** (Wayfinder's Notes): The herds died standing, most of them. Some of the stone bison in
  the Orchard are warm. A Cinderback is a bull of the old herds that never finished burning: ash for
  a hide, coals along the spine. It charges once to say hello. Guard, and it goes past. Lightning
  makes it shy. Fire feeds it.
- **Tactics:** Guard turn one, and every fourth turn; Storm Jars from the Cairns.

#### `cr_ashmaw` — Ashmaw (boss)
**Wilds (Steppe) · L12 boss · XP 650** · loc_herd_grave (forced; adds `cr_salt_jackal`)
- **Stats:** HP 520 · ATK 23 · DEF 6/3 · AGI 4 · fire (physical on Shoulder and Gore) · cannot be fled
- **Resist:** weak storm · immune fire · status immune: burn, stun; Stagger allowed
- **Phase 1 — The Herd Sleeps** (100–70%; onEnter: 2× `cr_salt_jackal`, "They come for the leavings."):
  - `ashmaw_breathe` · "The ash in the bowl rises and falls toward you." · 0.7× all · blind 40% 1
  - `ashmaw_shoulder` · "A hill of ash turns over. A shoulder comes at you." · 1.3× physical you · slow 40% 2
  - `ashmaw_low` · "Something under the ash lows with a hundred throats." · weaken 60% 2 all · everyNthTurn:3
  - *Transition (<70%):* "The ash slides off. Under it, a hundred backs, burning, turn the same way at once."
- **Phase 2 — The Herd Wakes** (<70%):
  - `ashmaw_paw` · "The bowl shakes. Every burning head lowers at you." · hidden wind-up, then `ashmaw_stampede` 2.2× you · burn 80% 3 · everyNthTurn:3
  - `ashmaw_gore` · "Horns in a row, like a fence, coming." · 1.2× physical all
  - `ashmaw_breathe` (as Phase 1)
  - *Transition (<35%):* "The brand on its flank, a flame inside a ring, burns brighter than the rest. Dreyl's mark."
- **Phase 3 — One Animal** (<35%; its armor is 0 for the rest of the fight):
  - `ashmaw_brand_flare` · "The ring-brand flares. The air between you catches." · 1.0× all · burn 100% 3
  - `ashmaw_stampede` · everyNthTurn:2 (no wind-up)
  - `ashmaw_grief` · "It stops. It lows for the calves that were not left." · no action · once, ifHpBelow:15
- **Pacifist:** `echo_dreyl_brand` + breaking the brand-stone (Oma's errand): Ashmaw lies down (WORLD §3.7).
- **Loot:** 135–210 g · `item_cinder_heart` 100% · `mat_cinder_horn`† ×3 100% · `mat_ember_ore` ×3 100%
- **Bestiary** (Remnant Archive): Year 9, a Nomad report, copied. The herd in the deep bowl did not
  turn to stone. Corvin Dreyl's pyre-ward was built to shield the city; in the Sundering it faced
  outward, burned the plains in a day, and branded what it burned. This herd burned and kept burning,
  and learned to move as one. The Nomads call it Ashmaw and leave it the first calf of every spring.
- **Tactics:** Kill the jackals first. Storm Jars and Storm abilities. Guard every Stampede. In Phase 3
  its armor is gone: spend everything physical.

#### `cr_ley_hound` — Ley Hound
**Wilds · L13 fodder · XP 327** · loc_outer_walks (×2, Days 2–3)
- **Stats:** HP 150 · ATK 24 · DEF 3/4 · AGI 11 · physical (ley on Snap)
- **Resist:** weak chrono · resist ley · immune —
- **Intents:**
  - `hound_bay` · "It lifts its head and bays. The other one answers." · haste self and ally 2 · first
  - `hound_bite` · "Jaws lit faintly blue close on your forearm." · 1.1× you · bleed 40% 3
  - `hound_ley_snap` · "Blue light runs down its spine into its teeth." · 1.2× ley you · shock 30% 2
  - `hound_track` · "It puts its nose to your shadow and stays there." · mark 100% 3 · ifAllyPresent
- **Loot:** 29–45 g · `mat_ley_spark` 50% · `mat_wildling_hide` 40%
- **Bestiary** (Wayfinder's Notes): Silverwood's hounds, bred on the ley and handled by the Circle's
  adepts, let loose on the Walks once the Archives are sealed. They hunt in pairs and bay to speed each
  other. Strip the speed with a Chrono hit and they are only dogs. Large, blue-toothed dogs.
- **Tactics:** Open with Chrono on the hasted one; split them with a Taunt.

### 6.3 The Drowned

All Drowned carry the `drowned` tag: Soaked re-applied at the start of each of their turns.

#### `cr_drowned_archivist` — Drowned Archivist
**Drowned · L4 fodder · XP 71** · loc_sunken_archives (q_lost_scroll), loc_tidewell_hall,
loc_sunken_scriptorium (×2), loc_bellmouth · *legacy: HP 35 · dmg 7 · def 2 · agi 4 · XP 45*
- **Stats:** HP 58 · ATK 11 · DEF 1/3 · AGI 4 · ley · breach-born, drowned
- **Resist:** weak ley · resist fire · immune poison
- **Intents:**
  - `first_drowned_turns` · "She clutches the scroll and turns her back to you." · no action · first; **only** the Archivist at loc_sunken_archives during q_lost_scroll (Oriel's echo, the First Drowned, D-046)
  - `archivist_page_cut` · "A sodden page lifts from its book, edge first." · 1.0× physical you · bleed 30% 2
  - `archivist_recite` · "It reads aloud. The water around you listens." · 0.9× you · soaked 100% 3
  - `archivist_bind` · "It closes its book on your shadow." · 0.6× you · slow 50% 2 · everyNthTurn:3
- **Loot:** 11–18 g · `item_mana_bloom` 60% (legacy) · `mat_sodden_vellum` 80% · `item_necromancer_staff` 5% (W-B §7) ·
  at loc_sunken_archives
  the quest drop is `item_scholars_lost_scroll` (WORLD §3.1)
- **Legacy description:** "A sodden scholar bound to drowned pages, still guarding secrets."
- **Bestiary** (Remnant Archive): Year 61. The scholars who stayed with the shelves when the ley-water
  rose are still with them. They read to the water and guard what they were last carrying. One, in the
  carrel under the east stair, guards a scroll sealed in Danthe wax and turns her back before she
  fights. The Keeper asks that no one record her name until we are sure.
- **Tactics:** Storm (always Soaked) or Ley; never fire. From Loop 2, `q_the_first_drowned` avoids the fight.

#### `cr_tide_clerk` — Tide Clerk
**Drowned · L5 fodder · XP 90** · loc_tidewell_hall
- **Stats:** HP 70 · ATK 12 · DEF 2/2 · AGI 5 · physical · breach-born, drowned
- **Resist:** weak ley · resist fire · immune poison
- **Intents:**
  - `clerk_check_name` · "It runs a wet finger down the ledger to your name." · mark 100% 3 · first
  - `clerk_stamp` · "It brings the ledger down like a seal." · 1.2× you · stun 15% 1 · ifTargetHas:mark
  - `clerk_strike_out` · "It draws a line through something with its pen." · 0.9× you · weaken 40% 2
- **Loot:** 13–21 g · `mat_sodden_vellum` 70% · `item_remnant_ink` 20%
- **Bestiary** (Wayfinder's Notes): A clerk in a coat that has been underwater five hundred years,
  walking the benches of Tidewell Hall, checking the drowned against the ledger. When it finds my name
  it marks it, and then it stamps. The ledger's last line is in a different hand. I read it later.
- **Tactics:** Clear the Mark and it never Stamps; Storm.

#### `cr_pale_diver` — Pale Diver
**Drowned · L6 fodder · XP 111** · loc_cistern_of_names (×2), loc_bellmouth (×2, return)
- **Stats:** HP 80 · ATK 14 · DEF 1/3 · AGI 7 · physical · breach-born, drowned
- **Resist:** weak ley · resist fire · immune poison
- **Intents:**
  - `diver_grapple` · "Pale hands close on your belt and pull downward." · 0.9× you · slow 60% 2
  - `diver_hold_under` · "It wraps around you and the water closes over." · 1.4× you · soaked 100% 3 · ifTargetHas:slow
  - `diver_rise` · "It sinks out of reach and rises behind you." · phase self 1 · everyNthTurn:3
- **Loot:** 15–24 g · `mat_drowned_pearl` 30% · `item_lantern_oil` 25% · `mat_sodden_vellum` 30%
- **Bestiary** (Remnant Archive): Year 140 to the present. Remnant divers lost in the Cistern of
  Names: eleven, by the Lamplighters' count. Pellam believes the pale ones at the rim are ours, not the
  city's. They still carry their lamps. They still dive. They want company on the way down.
- **Tactics:** Cleanse Slow at once and Hold Under never fires.

#### `cr_brine_lamprey` — Brine Lamprey
**Drowned · L5 fodder · XP 90** · loc_drowned_stair (×2), loc_black_sluice (×2–3); Bell-Warden add
- **Stats:** HP 56 · ATK 12 · DEF 0/1 · AGI 9 · physical · breach-born, drowned
- **Resist:** weak — (Soaked does the work) · resist fire · immune poison
- **Intents:**
  - `lamprey_latch` · "A pale shape with too many mouths finds your calf." · 0.8× you · bleed 50% 3
  - `lamprey_drink` · "It pulses as it drinks." · 0.6× you · heals self for 100% of damage dealt · ifTargetHas:bleed
  - `lamprey_eddy` · "It vanishes into an eddy by the rusted grate." · phase self 1 · ifHpBelow:50
- **Loot:** 13–21 g · `mat_drowned_pearl` 10% · `item_brine_draught` 15%
- **Bestiary** (Wayfinder's Notes): Pale, eel-long, too many mouths, all of them round. They wait
  where the grates have rusted and come in threes. They don't hit hard. They hold on. One Storm through
  the water and every one of them jumps at once.
- **Tactics:** Storm on one Shocks the rest (interplay 1); cleanse Bleed to stop the Drink.

#### `cr_ledger_choir` — Ledger Choir
**Drowned · L7 elite · XP 243** · loc_sunken_scriptorium (with 2× `cr_drowned_archivist`)
- **Stats:** HP 180 · ATK 15 · DEF 2/4 · AGI 4 · ley · breach-born, drowned
- **Resist:** weak ley · resist fire · immune poison
- **Intents:**
  - `choir_intone` · "Many wet voices read one name together." · 0.8× all · weaken 40% 2
  - `choir_amend` · "The pages turn back. An ally's wound closes." · heal ally 1.5× · ifAllyPresent
  - `choir_reinscribe` · "They read a fallen name back into the book." · revives one fallen Drowned ally at 40% HP · ifAllyDown · once per fight
  - `choir_verse` · "The voices find a note under the water." · 1.4× you · soaked 100% 3 · everyNthTurn:3
- **Loot:** 34–54 g · `mat_sodden_vellum` ×2 100% · `mat_drowned_pearl` 40% · `item_remnant_ink` 50%
- **Bestiary** (Remnant Archive): Year 302. In the Scriptorium the desks face one lectern, and around
  it the drowned stand in a ring and read: the names of the drowned, by street, written as they are
  read. Kill a reader and the Choir reads it back in. Silence the Choir first. In the margin, in
  Ashcombe's hand: "Ley breaks the binding."
- **Tactics:** Focus the Choir (or Stagger the Reinscribe); Storm area damage hits all three ×1.5.

#### `cr_bell_ringer` — Bell-Ringer
**Drowned · L7 elite · XP 243** · loc_bellmouth (with `cr_drowned_archivist`)
- **Stats:** HP 180 · ATK 15 · DEF 4/2 · AGI 3 · storm (physical on Rope) · breach-born, drowned
- **Resist:** weak ley, void · resist fire · immune poison
- **Intents:**
  - `ringer_low_note` · "The great bell speaks one low note. The water shivers." · 0.7× all · shock 40% 2
  - `ringer_stand_them_up` · "The note goes on. Something drowned stands up again." · revives one fallen ally at 50% HP · ifAllyDown · once per fight
  - `ringer_rope` · "A rope of drowned hair swings out of the bell's mouth." · 1.2× physical you · stun 20% 1
  - `ringer_shell` · "It draws back into the bell. Bronze closes." · shield self 1.5× · ifHpBelow:50
- **Loot:** 34–54 g · `mat_bell_bronze`† ×2 100% · `mat_drowned_pearl` 30% · `item_bell_shard` 20%
- **Bestiary** (Wayfinder's Notes): A bell lies on its side in a flooded tower and something lives in
  it. I never saw it whole: a rope, a pale hand, a shape that rings. When it rings, the drowned stand
  up. Void cracks the bronze it hides behind. Kill the archivist first, or it rises on the next note.
- **Tactics:** Its Low Note is Storm, and you are Soaked down here: Guard it. Void breaks the Shell.

#### `cr_bell_warden` — The Bell-Warden (boss)
**Drowned · L9 boss · XP 450** · loc_bell_wardens_deep (forced; adds `cr_brine_lamprey`) · the Drowned
Reach's regional boss
- **Stats:** HP 420 · ATK 18 · DEF 5/4 · AGI 3 · physical (storm on the tolls) · breach-born, drowned ·
  cannot be fled
- **Resist:** weak ley · resist fire · status immune: poison, stun; Stagger allowed
- **Phase 1 — Is It the Hour?** (100–65%; skipped if `flag_heartstone_stabilized`: "it does not toll"):
  - `warden_ask` · "It lifts its head. 'Is it the hour?'" · no action · first (with `echo_rhune_choice`, answering with the Warden of Waters' name ends the fight peacefully, WORLD §3.6)
  - `warden_toll` · "It strikes the clapper on its knee. The water jumps." · 0.8× storm all · soaked 100% 3
  - `warden_clapper` · "The clapper rises from its knees toward you." · 1.4× you · armor_break 40% 2
  - `warden_call` · "It hums. Something in the black water answers." · summons 1 `cr_brine_lamprey` (max 2) · everyNthTurn:3
  - *Transition (<65%):* "The Warden stands. The chain of office swings. The water in the well begins to rise."
- **Phase 2 — The Water Rises** (<65%; every combatant is Soaked at the start of each round):
  - `warden_undertow` · "The well pulls at your legs like a tide." · 1.0× all · slow 50% 2
  - `warden_lift` · "It lifts the clapper high. The water goes still." · hidden wind-up, then `warden_great_toll` 1.8× storm all · everyNthTurn:3
  - `warden_clapper` (as Phase 1)
  - *Transition (<25%):* "'It is the hour,' it says, in the voice of a city. 'She said I would know.'"
- **Phase 3 — The Hour** (<25%):
  - `warden_ring_the_city` · "It rings for everyone who drowned, all at once." · 1.2× storm all · everyNthTurn:2
  - `warden_clapper` (as Phase 1)
- **Loot:** 105–165 g · `item_cistern_key` 100% · `item_bell_clapper` 100% · `item_rhunes_hydromancy`
  100% (first clear) · `mat_drowned_pearl` ×2 100% · `mat_bell_bronze`† ×3 100%
- **Bestiary** (Remnant Archive): Year 500, from the Tidewell ledger. On the last day the Warden of
  Waters, Ilsabet Rhune, sent the bell-ringers' guild to the great bell under the cisterns, to ring
  when she opened them. They rang. The water came. They did not leave the ropes. What sits in the Deep
  is the guild, grown together around the clapper, wearing the chain she hung on it. It waits to be
  told the hour. It will take her name instead.
- **Tactics:** Guard every Great Toll (you are Soaked: Storm ×1.5). Ley is its weakness; Storm hits it
  ×1.5 too, and Shocks the lampreys. Kill lampreys as they come.

### 6.4 Wards

#### `cr_stone_hide_golem` — Stone-Hide Golem
**Wards · L6 elite · XP 200** · loc_blighted_outpost (×2; q_blighted_outpost target) ·
*legacy: HP 50 · dmg 12 · def 5 · agi 2 · XP 85 · magic resistance 80%*
- **Stats:** HP 130 (DESIGN §6.5 Mistwood elite) · ATK 14 · DEF 6/4 · AGI 2 · physical · construct
- **Resist:** weak — · resist fire, ley, void, chrono · immune poison, bleed
- **Intents:**
  - `golem_slam` · "Slate fists rise together over your head." · 1.2× you · stun 20% 1
  - `golem_grind` · "It leans its weight into you, iron on bone." · 0.9× you · armor_break 40% 2
  - `golem_harden` · "Grit rains from its seams as the slate locks shut." · removes its Armor Break; shield self 1.0× · ifSelfHas:armor_break
  - `golem_cover` · "It steps in front of the other one." · shield ally 1.0× · ifAllyPresent and the ally is below 50%
- **Loot:** 30–48 g · `mat_slate_core` 100% · `mat_iron_rivet` 60%
- **Legacy description:** "A hulking construct of slate and iron. Magic skitters off its hide."
- **Bestiary** (Remnant Archive): Year 30. The golems at the northern ley-knot, once Vane's Watch,
  turned outward at the third verse on the night of the Sundering and have faced outward since.
  Haldric Vane built them to shrug off the ritual's backlash, which is why magic skitters off them.
  Their sigil is a ring with a bar through it. They guard. No one told them what from.
- **Tactics:** Armor Break, then plain steel; it Hardens the turn after, so break it again on the
  following turn. Storm on Soaked is the caster's road. Poison does nothing.

#### `cr_warding_pillar` — Warding Pillar
**Wards · L6 fodder · XP 111** · loc_blighted_outpost (return 30%); loc_archives_of_danthe (Day 2),
loc_conflux_chamber (×2, Days 1–2); Unbroken Warden add
- **Stats:** HP 90 · ATK 14 · DEF 6/6 · AGI 1 · ley · construct
- **Resist:** weak storm · resist fire, ley, void, chrono · immune poison, bleed, stun
- **Intents:**
  - `pillar_hum` · "The pillar hums. Your feet grow heavy on the stone." · slow 60% 2 all
  - `pillar_ward` · "Sigils climb the pillar and leap to its ally." · shield ally = 10% of that ally's max HP · ifAllyPresent
  - `pillar_discharge` · "Light gathers at the pillar's iron cap." · 0.8× all · everyNthTurn:3
  - `pillar_seal` · "The sigils close. The pillar goes still." · ends the fight, no loot · round:6, only if it is the last enemy
- **Loot:** 15–24 g · `mat_slate_core` 30% · `mat_conflux_dust`† 30% (Silverwood Before only)
- **Bestiary** (Wayfinder's Notes): A standing stone cut with Vane's ring-and-bar. At the Outpost it
  was there all along, dormant, and woke when the golems fell. In the Before they guard the Archives'
  door and the Conflux stair. Alone, it slows me and waits. Beside something bigger, it shields it.
  Lightning likes its cap.
- **Tactics:** Its threat is the Ward it gives a boss, which scales with the boss; break pillars first.
  `item_ward_seal` makes the Before's pillars stand aside (WORLD §3.11).

#### `cr_ninefold_knight` — Ninefold Knight
**Wards · L15 elite · XP 738** · loc_ninefold_hall (Day 3)
- **Stats:** HP 340 · ATK 27 · DEF 8/5 · AGI 5 · physical · construct
- **Resist:** weak storm · resist fire, ley, void, chrono · immune poison, bleed
- **Intents:**
  - `knight_shield_up` · "Its nine-sided shield comes up. The floor-map glows." · shield self 1.5× · first
  - `knight_cleave` · "The blade comes level with your ribs." · 1.3× you · bleed 40% 3
  - `knight_bash` · "It drives the shield's rim at your jaw." · 0.9× you · stun 30% 1 · ifSelfHas:shield
  - `knight_verse` · "It speaks one line of a verse it does not understand." · weaken 60% 2, armor_break 40% 2 on you · everyNthTurn:3
- **Loot:** 66–102 g · `mat_slate_core` ×2 100% · `mat_silverwood_heartwood` 40% · `mat_iron_rivet` 60% ·
  `item_pattern_breachsteel_blade` 100% on the first kill (W-B §7)
- **Bestiary** (Wayfinder's Notes): On Last Bell the Ninefold Hall is empty except for this: plate on
  no one, a shield with nine sides, Vane's sigil on the breast. It bashes only from behind the shield.
  One Void hit takes the shield away. Then strike where the sigil is.
- **Tactics:** Void destroys its Shield outright (interplay 4); without a Shield it cannot Bash.

#### `cr_unbroken_warden` — The Unbroken Warden (boss)
**Wards · L18 boss · XP 1,100** · loc_conflux_chamber (Day 3, forced; adds `cr_warding_pillar`) ·
Silverwood Before's regional boss
- **Stats:** HP 720 · ATK 32 · DEF 10/6 · AGI 4 · physical · construct · cannot be fled
- **Resist:** weak storm · resist fire, ley, void, chrono · status immune: poison, bleed, stun, slow;
  Stagger allowed
- **Phase 1 — Keep the Line** (100–65%; onEnter: 2× `cr_warding_pillar`):
  - `uw_hold_the_gate` · "It plants itself on the stair. The pillars brighten." · shield self 1.5× · first
  - `uw_stone_stand` · "A fist of slate and silver drops toward you." · 1.2× you · armor_break 40% 3
  - `uw_sweep` · "Its arm sweeps the full width of the stair." · 0.9× all
  - *Transition (<65%):* "The sigil turns from blue to white. Vane's voice, out of the stone: 'Meet what comes without fear.'"
- **Phase 2 — Without Fear** (<65%):
  - `uw_meet_what_comes` · "It sets its feet and waits for you to strike." · riposte: 1.0× you if you deal Physical damage to it before its next turn, else nothing · everyNthTurn:2
  - `uw_raise` · "It raises both arms. The stair darkens beneath them." · hidden wind-up, then `uw_gate_slam` 1.8× you · stun 50% 1 · everyNthTurn:3
  - `uw_stone_stand` (as Phase 1)
  - *Transition (<30%):* "Stone sheds from it like bark. Under the slate, silver. It moves fast now."
- **Phase 3 — The Last Order** (<30%; armor 0; Haste self every turn):
  - `uw_break` · "Silver and stone come down together." · 1.5× you
  - `uw_last_order` · "'Not Nine,' it says. 'Not Nine. Not Nine.'" · 1.0× all · weaken 50% 2 · everyNthTurn:3
  - `uw_sweep` (as Phase 1)
- **Pacifist:** `item_ward_seal` + Caelum active: it kneels; Anchors may be placed (WORLD §3.11).
- **Loot:** 195–300 g · `mat_silverwood_heartwood` ×2 100% · `mat_slate_core` ×3 100% · `mat_conflux_dust`†
  ×2 100% · `item_pattern_breachwarden_mail` 100% (W-B §7) · (`item_breach_anchor_schematic_b` lies on
  Tobrin's plinth afterward, WORLD §3.11)
- **Bestiary** (Wayfinder's Notes): Haldric Vane's masterwork at the Conflux stair. It lets the Nine
  through and no one else. The third verse is cut into its chest: Stone, stand where flesh would fall.
  The golems at the Outpost are its rough drafts. Tobrin Vask kept a seal it kneels to. With the seal
  and Caelum, it kneels. Without them, it doesn't.
- **Tactics:** Break the pillars before its Shield cycles. In Phase 2 cast or Guard on Meet What Comes
  turns; Guard every Gate Slam. Storm throughout; Chrono strips the Phase 3 Haste for a turn.

### 6.5 Spireborn

#### `cr_arcane_wisp` — Arcane Wisp
**Spireborn (Wisp) · L2 fodder · XP 41** · loc_shattered_library, loc_silverwood_plaza ·
*legacy: HP 25 · dmg 6 · def 1 · agi 6 · XP 30*
- **Stats:** HP 34 · ATK 8 · DEF 0/2 · AGI 7 · ley · construct
- **Resist:** weak void · resist ley · immune poison
- **Intents:**
  - `wisp_crackle` · "It knots tighter, spitting blue sparks at you." · 1.0× you
  - `wisp_arc` · "A thread of light jumps from it to you and holds." · 0.7× storm you · shock 40% 2
  - `wisp_flare` · "It swells, bright enough to show your bones." · 0.5× all · blind 30% 1 · everyNthTurn:3
- **Loot:** 7–12 g · `item_ley_touched_tonic` 60% (legacy) · `mat_ley_spark` 80%
- **Legacy description:** "A floating knot of feral magic crackling with unstable energy."
- **Bestiary** (Remnant Archive): Year 9. Wisps are loose ends. When Seraphine Aulde's Spires cracked,
  the strands they spun came unwound and drifted west along the Aether Road to where the line rises
  under the ruin. They knot around ley-light: lanterns, crystals, the Plaza fountains. They are not
  malicious. They burn the hand that grasps them and come apart for a sharp blade.
- **Tactics:** Steel or Void. Echo Bolt is Ley and it resists: a lesson the first room teaches.

#### `cr_paradox_wisp` — Paradox Wisp (anomaly)
**Spireborn (Wisp) · L4 anomaly, Loop 2+ · XP 92** · loc_silverwood_plaza (25% of pool rolls, WORLD §3.1)
- **Stats:** HP 50 · ATK 11 · DEF 0/3 · AGI 9 · ley · construct
- **Resist:** weak void · resist ley, chrono · immune poison
- **Intents:**
  - `paradox_before` · "It is already where you are aiming." · phase self 1 · first
  - `paradox_mirror` · "It flickers into the shape of your last spell." · 1.0× you, using the damage type of the ability you used last
  - `paradox_knot` · "Two of it, briefly. Then one." · 0.8× chrono you · rewind self 2 · ifHpBelow:50
- **Loot:** 11–18 g · `mat_ley_spark` 100% (anomaly guaranteed material) · `mat_frayed_moment` 30%
- **Bestiary** (Wayfinder's Notes): Loop 2. A wisp at the Plaza that was there before I arrived, in
  both senses. It throws back the last spell I cast. So I cast the cheap one last. Void it while it is
  rewinding. It is the first thing I have killed that I think remembered me.
- **Tactics:** End your turn on a weak or Void ability; Void consumes its Rewind ×1.25.

#### `cr_glass_mote` — Glass Mote
**Spireborn · L8 fodder · XP 161** · loc_aetherium_spires (×2 return), loc_spire_crown
- **Stats:** HP 84 · ATK 17 · DEF 3/3 · AGI 9 · physical (ley on Refract) · construct
- **Resist:** weak physical, void · resist ley · immune poison, bleed
- **Intents:**
  - `mote_spin` · "It spins, edges out, toward your face." · 1.0× you · bleed 40% 3
  - `mote_refract` · "Light enters it and leaves it pointed at you." · 1.1× ley you
  - `mote_shatter` · "Cracks race through it. It is going to burst." · 1.2× all · onDeath
- **Loot:** 19–30 g · `item_aetherium_shard` 30% · `mat_skyreach_crystal` 15%
- **Bestiary** (Remnant Archive): Year 455. Chips of the Spires' crystal, hand-sized, spinning on the
  hum. They gather where a Weaver works and cut whatever comes near the loom. Struck hard, they burst.
  Survey teams carry shields for the motes and nothing for the Weavers, which tells you which they fear.
- **Tactics:** Guard the turn after you bring one low, or kill it while your companion is out of range.

#### `cr_aetherial_weaver` — Aetherial Weaver
**Spireborn (Aetherial) · L8 fodder · XP 161** · loc_aetherium_spires (100% first), loc_spire_crown
(×2), loc_aldours_eyrie · *legacy: HP 38 · dmg 8 · def 3 · agi 5 · XP 55*
- **Stats:** HP 96 · ATK 17 · DEF 2/4 · AGI 7 · ley · construct (−25% HP if the Heartstone was destroyed)
- **Resist:** weak void · resist ley · immune poison
- **Intents:**
  - `weaver_strand` · "It draws a strand of light out of the air at you." · 1.0× you · slow 30% 2
  - `weaver_bind` · "Strands loop your wrists and pull tight." · 0.8× you · weaken 50% 2
  - `weaver_web` · "It spreads strands between the spires and plucks one." · 0.7× all · shock 30% 2 · everyNthTurn:3
  - `weaver_mend` · "It spins light over its own torn edges." · shield self 1.2× · ifHpBelow:50
- **Loot:** 19–30 g · `item_aetherium_shard` 100% (legacy) · `mat_spire_thread` 70%
- **Legacy description:** "A luminous entity spinning strands of raw magic between the spires."
- **Bestiary** (Wayfinder's Notes): A loom in the Eyrie finished a cord of light and let it go, and it
  drifted out of the window toward the Spires, spinning. That is an Aetherial Weaver. Seraphine Aulde
  made them to carry her note from spire to spire. They still do. They bind before they hurt. Void
  unspins them; their own light doesn't.
- **Tactics:** Void, or steel; cleanse Weaken before your big turn.

#### `cr_spire_loom` — Spire Loom
**Spireborn (Aetherial) · L14 elite · XP 661** · loc_aldours_eyrie (with a Weaver; return 25%)
- **Stats:** HP 320 · ATK 26 · DEF 6/6 · AGI 2 · ley (physical on Shuttle) · construct
- **Resist:** weak void · resist ley, storm · immune poison, bleed, stun
- **Intents:**
  - `loom_weave` · "The shuttles fly. A cord of light lengthens toward the window." · summons 1 `cr_aetherial_weaver` (max 2) · everyNthTurn:3
  - `loom_shuttle` · "A shuttle leaves the frame at the height of your head." · 1.3× physical you · stun 20% 1
  - `loom_warp` · "The warp threads tighten across the room." · 0.8× all · slow 50% 2
  - `loom_rethread` · "It rethreads itself. The broken threads take up again." · shield self 1.5× · ifHpBelow:50
- **Loot:** 62–96 g · `mat_spire_thread` ×3 100% · `item_aetherium_shard` ×2 100% · `mat_skyreach_crystal` 40%
- **Bestiary** (Wayfinder's Notes): Aulde's looms still run. Brass frames, glass shuttles, no weaver.
  They make Aetherial Weavers the way a spider makes thread, one every few breaths if I let them. Kill
  the loom, not the cord. With the Heartstone dark they stop, and her notes are just lying there.
- **Tactics:** Ignore the Weavers it makes; Void the loom. Heartstone destroyed: no fight (WORLD §3.10).

#### `cr_sky_whisper_sentinel` — Sky-Whisper Sentinel
**Spireborn (Sentinel) · L9 fodder · XP 189** · loc_sky_whisper_plateau (100% first),
loc_roost_of_sentinels · skyborn · *legacy: HP 42 · dmg 9 · def 3 · agi 5 · XP 60*
- **Stats:** HP 110 · ATK 18 · DEF 3/3 · AGI 8 · storm · construct
- **Resist:** weak chrono, void · resist storm · immune poison
- **Intents:**
  - `sentinel_cutting_gust` · "The wind around it sharpens and turns toward you." · 1.0× you · bleed 30% 2
  - `sentinel_gale_wall` · "It spreads its vanes. The gale doubles." · 0.6× all · blind 30% 1
  - `sentinel_ride_the_wind` · "It lifts on a gust and hangs above you." · haste self 2 · everyNthTurn:3
  - `sentinel_dive` · "It folds its vanes and drops." · 1.5× physical you · ifSelfHas:haste
- **Loot:** 21–33 g · `item_sky_whisper_talisman` 100% (legacy; a second copy is a trinket upgrade
  material, WORLD §3.4) · `mat_gale_feather` 80%
- **Legacy description:** "A wind-hardened guardian that strikes with cutting gusts."
- **Bestiary** (Remnant Archive): Year 120. The Sentinels of the Plateau keep watch to the east.
  Seraphine Aulde set them to guard the Spires' outer markers; they have extended the order to
  everything in sight. The Nomads leave their dead on the Roost because the Sentinels let no bird near.
  Each carries a talisman of wind-cut stone. Wearing one, you can breathe above the Plateau.
- **Tactics:** A Chrono hit on its rise strips the Haste and cancels the Dive.

#### `cr_gale_kite` — Gale Kite
**Spireborn (Sentinel) · L12 fodder · XP 289** · loc_windward_stair (×2), loc_roost_of_sentinels;
Stormcrown add · skyborn
- **Stats:** HP 128 · ATK 23 · DEF 2/3 · AGI 13 · physical (storm on Tether) · construct
- **Resist:** weak physical, chrono · resist storm · immune poison
- **Intents:**
  - `kite_tether` · "It hooks a line of wind to you and pulls." · 0.8× storm you · mark 100% 2 · first
  - `kite_slice` · "It turns edge-on and comes at you like a thrown blade." · 1.1× you · bleed 40% 3
  - `kite_swoop` · "It drops out of the sun down its line." · 1.4× you · ifTargetHas:mark
  - `kite_updraft` · "It catches a gust, and the gust catches you." · 0.6× storm you · slow 50% 2 · everyNthTurn:3
- **Loot:** 27–42 g · `mat_gale_feather` 70% · `mat_storm_glass`† 20%
- **Bestiary** (Wayfinder's Notes): Diamond-shaped, wide as my arms, with a tail of wind. Aulde built
  them as spotters for the Sentinels. They tether me with a line of air and swoop down it. Clear the
  Mark and they swoop at nothing. On the Stair, running costs a tenth of my blood. I don't run.
- **Tactics:** Clear Mark; plain steel through the paper-thin frame.

#### `cr_cloud_ray` — Cloud Ray
**Spireborn (Sentinel) · L13 fodder · XP 327** · loc_roost_of_sentinels (×2, return) · skyborn
- **Stats:** HP 160 · ATK 24 · DEF 3/4 · AGI 7 · storm · construct
- **Resist:** weak void · resist storm · immune poison
- **Intents:**
  - `ray_mist_over` · "It glides over you, trailing cloud." · soaked 100% 3 all
  - `ray_discharge` · "Its underside flickers white." · 1.1× you · shock 40% 2 (×1.5 if you are Soaked)
  - `ray_wingbeat` · "One slow wingbeat, wide as the ledge." · 0.8× physical all · slow 30% 2
- **Loot:** 29–45 g · `mat_skyreach_crystal` 30% · `mat_storm_glass`† 40%
- **Bestiary** (Remnant Archive): Year 497, from a Nomad sky-burial report. Flat gliders the width of
  a wagon, drifting along the Roost's ledges. They carry their own cloud, lay it on you, then light
  it. The Nomads watch the underside: when it goes white, they crouch behind their shields.
- **Tactics:** Its pattern is fixed: Mist, Discharge, Wingbeat. Guard every Discharge.

#### `cr_stormcrown` — The Stormcrown (boss)
**Spireborn (Sentinel) · L16 boss · XP 950** · loc_stormcrowns_perch (forced unless bargained; adds
`cr_gale_kite`) · the Skyreach's regional boss · skyborn
- **Stats:** HP 640 · ATK 29 · DEF 6/8 · AGI 9 · storm (physical on Talon) · construct · cannot be fled
- **Resist:** weak chrono · resist storm, ley · status immune: shock, blind, poison; Stagger allowed
- **Phase 1 — The Watch** (100–70%; onEnter: 1× `cr_gale_kite`):
  - `crown_regard` · "It turns from the east and looks at you, once." · mark 100% 3 · first
  - `crown_gale` · "The ring of lightning tightens around the pinnacle." · 0.9× all
  - `crown_talon` · "A talon of storm-glass opens over you." · 1.3× physical you · bleed 50% 3
  - *Transition (<70%):* "'Seven came,' it says. 'Seven struck.' The sky over the Perch goes black."
- **Phase 2 — The Storm Comes Down** (<70%):
  - `crown_rain` · "Cloud pours off its crown and over you." · soaked 100% 3 all · everyNthTurn:3
  - `crown_call_lightning` · "The crown goes white. Everything on the Perch holds still." · hidden · 2.0× you · shock 100% 2 · the turn after `crown_rain`
  - `crown_call_kite` · "It cries once. A kite peels off the ledges." · summons 1 `cr_gale_kite` · ifAllyDown (max 1 alive)
  - `crown_gale` (as Phase 1)
  - *Transition (<30%):* "It spreads its vanes across the whole sky. 'You are the eighth,' it says. 'Strike, then.'"
- **Phase 3 — Seven Struck** (<30%; Haste self every turn):
  - `crown_seven` · "It names seven Wayfinders, one strike for each." · 7 hits × 0.3× you · everyNthTurn:2
  - `crown_talon` (as Phase 1)
- **Pacifist:** `echo_sky_oath` + `item_sky_whisper_talisman`: it yields the Talon and
  `echo_tyrant_never_struck` (WORLD §3.10).
- **Loot:** 175–270 g · `item_stormcrown_talon` 100% · `item_gale_feather` 100% · `mat_storm_glass`† ×3
  100% · `mat_skyreach_crystal` ×2 100%
- **Bestiary** (Remnant Archive): Year 500. The first Sentinel, made by Seraphine Aulde before the
  others, with a crown of storm-glass. It has watched the Apex for five hundred years and keeps one
  fact the Remnants never recorded: the thing in the Apex has never once struck first. Seven Wayfinders
  came. Seven struck. It will fight the eighth if the eighth insists.
- **Tactics:** Guard every Call Lightning (you will be Soaked). Physical and Chrono; it resists Storm
  and Ley. Kill the kite to keep Mark off you. Chrono strips its Phase 3 Haste.

### 6.6 The Green

#### `cr_glowfen_mireling` — Glowfen Mireling
**Green (Mireling) · L9 fodder · XP 189** · loc_veridian_glowlands (100% first), loc_sporelight_shallows,
loc_elder_mangrove, loc_pale_gullet (×3) · *legacy: HP 36 · dmg 7 · def 2 · agi 4 · XP 50*
- **Stats:** HP 110 · ATK 18 · DEF 2/3 · AGI 6 · ley (physical on Drag)
- **Resist:** weak fire, void · resist ley · immune poison
- **Intents:**
  - `mireling_breathe_in` · "The Mireling breathes in." · regen self 0.3×/3 · first
  - `mireling_spit` · "Its throat glows. It spits light at you." · 0.9× you · poison 50% 4
  - `mireling_drag` · "Webbed hands close on your ankle under the water." · 1.1× physical you · slow 40% 2
  - `mireling_glow_burst` · "Green light swells under its skin until it hurts to look." · 0.6× all · blind 30% 1 · everyNthTurn:3
- **Loot:** 21–33 g · `item_glow_moss` 60% (legacy) · `mat_glow_gland` 70%
- **Legacy description:** "An amphibious creature wreathed in eerie green light."
- **Bestiary** (Wayfinder's Notes): Frog-backed, man-high, glowing from the throat down. It breathes
  in before it fights: that is its Regen. Void takes the Regen away; fire takes the rest. Mireya won't
  say what they were. She says "not yet," the way Elder Tam does. They follow lit boats and never touch them.
- **Tactics:** Void first (strips Regen, interplay 14), then fire. A lit party passes them in the Reed
  Maze (q_the_drowned_lantern).

#### `cr_lantern_toad` — Lantern Toad
**Green · L8 fodder · XP 161** · loc_veridian_glowlands, loc_lantern_causeway (×2); Lantern Matron add
- **Stats:** HP 96 · ATK 17 · DEF 3/2 · AGI 4 · physical
- **Resist:** weak fire, void · resist ley · immune poison
- **Intents:**
  - `toad_lure` · "Its throat-sac lights like a lantern on a pole." · blind 50% 2 · first
  - `toad_tongue` · "A tongue the length of a reed snaps out." · 1.0× you · slow 30% 2
  - `toad_swallow_light` · "It gulps, and the light goes into it." · shield self 1.0× · ifTargetHas:blind
  - `toad_flop` · "It gathers itself, heavy, over your feet." · 1.3× you · everyNthTurn:3
- **Loot:** 19–30 g · `mat_glow_gland` 50% · `mat_glow_spore`† 30%
- **Bestiary** (Remnant Archive): Year 488. The lantern-toad of the Causeway: dog-sized, its
  throat-sac lit by Breach-leak. It lures with the light and strikes whatever comes to look.
  Lanternreed children call them night-lamps and are taught not to follow them. The Matron in the Hall
  keeps them the way a village keeps geese.
- **Tactics:** Cleanse Blind and it never Shields; fire.

#### `cr_spore_drift` — Spore Drift
**Green · L9 fodder · XP 189** · loc_veridian_glowlands, loc_sporelight_shallows (×2)
- **Stats:** HP 96 · ATK 18 · DEF 0/4 · AGI 5 · ley
- **Resist:** weak fire, storm · resist physical · immune poison, bleed
- **Intents:**
  - `spore_sweet_air` · "The air around it turns sweet." · 0.3× all · poison 70% 4
  - `spore_settle` · "It settles on you like warm dust." · 0.8× you · weaken 40% 2
  - `spore_bloom` · "Light-dust blooms from it in a slow ring." · blind 40% 1 all · everyNthTurn:3
  - `spore_burst` · "It bursts, sweetly." · 0.8× all · poison 100% 4 · onDeath
- **Loot:** 21–33 g · `mat_glow_spore`† 70% · `item_antidote_root` 20%
- **Bestiary** (Wayfinder's Notes): A cloud that drifts against the wind. Breathing it is sweet, then
  it is not. A blade mostly hits air. Fire takes it in one breath. If I must kill it close, I kill it
  last, and I have the antidote root out first: it bursts when it dies.
- **Tactics:** Fire or Storm from range; carry antidote root; kill it after its neighbours.

#### `cr_reed_stalker` — Reed Stalker
**Green · L9 fodder · XP 189** · loc_reedmarch_descent, loc_elder_mangrove, loc_pale_gullet (×2)
- **Stats:** HP 112 · ATK 18 · DEF 3/2 · AGI 10 · physical
- **Resist:** weak fire · resist ley · immune poison
- **Intents:**
  - `reed_still` · "The reeds stop moving. One of them is watching you." · phase self 1 · first
  - `reed_spear` · "A beak like a reed-knife darts at your eye." · 1.2× you · blind 30% 1
  - `reed_twice` · "It cocks its head twice." · 2 hits × 0.7× you · bleed 30% 2 · everyNthTurn:3
  - `reed_wade` · "It steps back into the reeds, slow and patient." · regen self 0.3×/3 · ifHpBelow:50
- **Loot:** 21–33 g · `mat_lantern_resin`† 40% · `mat_glow_gland` 30%
- **Bestiary** (Remnant Archive): Year 490. A grey-green wader twice a man's height, all neck and
  patience. It stands in the reeds at the Reedmarch where Glowfen baskets meet Nomad salt, and has
  never taken either. It takes the people who come for them. The Glowfen say it was a fisherman's
  heron once. It still fishes.
- **Tactics:** Hold the opener until its Phase drops; fire; Guard the double strike.

#### `cr_barrow_light` — Barrow-Light
**Green · L11 fodder · XP 253** · loc_firefly_barrows (dusk and night 100%, day 40%), loc_elder_mangrove
- **Stats:** HP 120 · ATK 21 · DEF 0/6 · AGI 8 · ley
- **Resist:** weak void · resist ley, physical · immune poison, bleed
- **Intents:**
  - `barrow_keep_watch` · "The light paces the mound's edge and turns to you." · mark 100% 3 · first
  - `barrow_cold_glow` · "It brightens, and the warmth leaves your hands." · 1.1× you · weaken 40% 2
  - `barrow_say_a_name` · "It speaks a name. You turn before you can stop." · 0.5× you · stun 30% 1 · everyNthTurn:3
  - `barrow_gather` · "More light leaks out of the mound into it." · heal self 1.0× · ifHpBelow:40
- **Loot:** 25–39 g · `item_barrow_light_vial` (the first one killed at loc_firefly_barrows, 100%, WORLD
  §3.9) · `mat_lantern_resin`† 40% · `mat_glow_gland` 30%
- **Bestiary** (Wayfinder's Notes): The Glowfen bury their dead in the water and the dead do not stay
  dark. At dusk the light leaks out and walks the edge of its own barrow, keeping watch over itself.
  It is not angry. It is on watch. In the third loop they began to say names. Seven were Wayfinders'.
  I waited for the eighth.
- **Tactics:** Void; from Loop 3 the named turn is the Stun turn, so Guard it.

#### `cr_lantern_matron` — The Lantern Matron (boss)
**Green · L13 boss · XP 700** · loc_matrons_hall (forced; adds `cr_lantern_toad`) · the Glowfen's
regional boss · Elder Mother Sulis of Lanternreed
- **Stats:** HP 560 · ATK 24 · DEF 4/6 · AGI 2 · ley (physical on Reach and Embrace) · cannot be fled
- **Resist:** weak void, fire · resist ley · status immune: poison, blind, stun; Stagger allowed
- **Phase 1 — Lullaby** (100–65%):
  - `matron_hum` · "She hums the tune every Lanternreed mother hums." · 0.4× all · slow 60% 2
  - `matron_lantern_light` · "The lanterns on her back brighten one by one." · shield self 1.2× and regen self 0.3×/3
  - `matron_call` · "She clicks her tongue. Something wet climbs onto the roots." · summons 1 `cr_lantern_toad` (max 2) · everyNthTurn:3
  - `matron_reach` · "An arm as long as a boat reaches for you, gently." · 1.2× physical you · slow 40% 2
  - *Transition (<65%):* "She looks at you properly for the first time. 'You have a name,' she says. 'Let me keep it.'"
- **Phase 2 — Counting the Names** (<65%):
  - `matron_name_you` · "She says a name. It is almost yours." · 0.5× you · curse 100% 3, mark 100% 3
  - `matron_embrace` · "Both arms open around you, warm, and close." · 1.6× physical you · poison 60% 4
  - `matron_drink` · "She lifts a toad to her mouth. Its light goes out." · heal self 1.5× · ifAllyPresent (consumes the toad)
  - *Transition (<30%):* "The lanterns on her back crack. The names scratched in the glass go dark. She stops humming."
- **Phase 3 — She Wants More** (<30%; her Regen and Shield end and cannot be reapplied):
  - `matron_flood` · "The Breach-light under the Hall rises through her and out." · 1.1× all · blind 50% 1 · everyNthTurn:2
  - `matron_embrace` (as Phase 2)
- **Pacifist:** Mireya active and `item_mireyas_lantern` lit: Sulis is lulled (WORLD §3.9, Mireya's "preserve" branch).
- **Loot:** 145–225 g · `item_lantern_moth_brooch` 100% · `mat_lantern_resin`† ×4 100% · `mat_glow_gland` ×3 100%
- **Bestiary** (Remnant Archive): Year 431. Elder Mother Sulis of Lanternreed went down into the cavern
  under the swamp, where the light pools thickest, to bring back the children who had followed it.
  She brought none back. She stayed, and the light grew her. Her back is a hill of lanterns, each
  scratched with a name. She remembers all of them. Lanternreed does not speak of her. Mireya does, once.
- **Tactics:** Kill the toads before she drinks them. Void strips her Shield and Regen. A Ley hit lifts
  her Curse from you. Guard the Flood.

### 6.7 Watch-wardens

#### `cr_temporal_aberration` — Temporal Aberration
**Watch-wardens (Aberration) · L12 elite · XP 520** · loc_chronos_nexus (100% first; q_unlidded_eye
target); Contained Tyrant Phase 2 add (at 60% HP) · *legacy: HP 55 · dmg 12 · def 4 · agi 6 · XP 85*
- **Stats:** HP 280 · ATK 23 · DEF 4/4 · AGI 8 · chrono · breach-born
- **Resist:** weak void · resist chrono · immune poison
- **Intents:**
  - `aberration_flicker_strike` · "It flickers. The blow is already on its way." · hidden · 1.3× you
  - `aberration_past_blow` · "Something it did a moment ago arrives now." · 1.0× you · slow 40% 2
  - `aberration_future_blow` · "It strikes at a moment that has not happened." · hidden · 0.8× all · everyNthTurn:3
  - `aberration_rewind` · "Its wounds run backward into it." · rewind self 2 · ifHpBelow:50 · once per fight
- **Loot:** 54–84 g · `item_chronal_dust` 100% (legacy) · `mat_frayed_moment` 80% · `item_aberrant_eye`
  100% while `q_unlidded_eye` is active (Appendix A)
- **Legacy description:** "A warped being that flickers between past and future strikes."
- **Bestiary** (Remnant Archive): Year 302. Tovren Masque built watch-wardens to keep the observatory's
  hours while he read the sky. When the dome fell the hours broke, and the wardens kept them anyway,
  all of them, out of order. An Aberration strikes from a moment that has not arrived, or one already
  gone. Its eye sees between moments. The Weavers pay well for one.
- **Tactics:** Guard the "?" turns. Hit it with Void while Rewind is on it (consumes it, ×1.25).

#### `cr_shimmering_phantom` — Shimmering Phantom
**Watch-wardens (Phantom) · L6 fodder · XP 111** · loc_shimmering_pass (100% first) ·
*legacy: HP 32 · dmg 7 · def 2 · agi 7 · XP 45*
- **Stats:** HP 72 · ATK 14 · DEF 1/3 · AGI 10 · chrono · breach-born
- **Resist:** weak void · resist chrono · immune poison
- **Intents:**
  - `phantom_flicker` · "The Phantom flickers; it will strike where you were." · 1.1× you
  - `phantom_mirage` · "Two of it stand on the path. One is lying." · phase self 1 · everyNthTurn:3
  - `phantom_teeth` · "The mirage opens a mouth with real teeth in it." · 1.3× physical you · bleed 40% 2 · ifSelfHas:phase
- **Loot:** 15–24 g · `item_chronal_dust` 100% (legacy) · `mat_frayed_moment` 30%
- **Legacy description:** "A mirage given teeth, flickering between moments."
- **Bestiary** (Wayfinder's Notes): The Pass bends distance and the Phantom bends with it. It strikes
  where I was a breath ago, so stepping aside does nothing; Guarding does. When there are two of it,
  the one with teeth is the one that is Phased. Dask says it was the same Phantom seventy years ago.
  He says it like a compliment.
- **Tactics:** Chrono ignores Phase; otherwise Guard the Teeth turn.

#### `cr_moment_moth` — Moment Moth
**Watch-wardens · L6 fodder · XP 111** · loc_shimmering_pass (×3, return)
- **Stats:** HP 54 · ATK 14 · DEF 0/2 · AGI 11 · chrono · breach-born
- **Resist:** weak fire, void · resist chrono · immune poison
- **Intents:**
  - `moth_flutter` · "Grey wings blur the air between you and the path." · 0.6× you · slow 40% 2
  - `moth_eat_a_second` · "It lands on your wrist. Something is missing." · 0.8× you · strips your haste · stun 10% 1
  - `moth_swarm` · "The others turn toward you all at once." · 0.5× all · ifAllyPresent, everyNthTurn:3
- **Loot:** 15–24 g · `item_chronal_dust` 30% · `mat_frayed_moment` 20%
- **Bestiary** (Remnant Archive): Year 460. Grey moths of the Pass, in threes, that settle on bare skin
  and take a second or two. Surveyors return reporting watches shorter than their count. Lantern-light
  does not draw them. A ticking watch does. Burn them.
- **Tactics:** Area fire; do not spend a Haste before they are down.

#### `cr_hourglass_crawler` — Hourglass Crawler
**Watch-wardens · L11 fodder · XP 253** · loc_chronos_nexus (×2), loc_heartstone_depths (exploited, ×2)
- **Stats:** HP 130 · ATK 21 · DEF 5/3 · AGI 3 · chrono (physical on Pincer) · breach-born
- **Resist:** weak void, storm · resist chrono · immune poison
- **Intents:**
  - `crawler_sand` · "Sand runs from its body across your boots." · 0.7× you · slow 60% 2
  - `crawler_pincer` · "Glass pincers close at the back of your knee." · 1.2× physical you · armor_break 30% 2
  - `crawler_turn_over` · "It rolls onto its back. The sand runs the other way." · rewind self 2 · ifHpBelow:50
  - `crawler_dig_in` · "It digs into its own sand." · shield self 1.0× · everyNthTurn:4
- **Loot:** 25–39 g · `item_chronal_dust` 50% · `mat_frayed_moment` 40%
- **Bestiary** (Wayfinder's Notes): Hand-long, glass in the middle, sand inside. It slows me with the
  sand and then pinches. Hurt, it rolls over and the sand runs back up, and so does its health. Void it
  then and the rewind breaks. In the Depths, with the Heartstone torn out, they crawl from the socket in pairs.
- **Tactics:** Void during Rewind; Storm cracks the glass.

#### `cr_orrery_knight` — Orrery Knight
**Watch-wardens · L13 elite · XP 588** · loc_chronos_nexus (20%, only while `item_orrery_key` is untaken)
- **Stats:** HP 300 · ATK 24 · DEF 6/5 · AGI 5 · chrono (physical on Epicycle) · construct
- **Resist:** weak void, storm · resist chrono, fire · immune poison, bleed
- **Intents:**
  - `orrery_align` · "The rings in its chest turn into a line pointing at you." · mark 100% 3 · first
  - `orrery_epicycle` · "A brass ring swings out on its arm and around." · 1.1× physical all
  - `orrery_conjunction` · "Every ring stops. The line is complete." · 1.8× you · ifTargetHas:mark, everyNthTurn:3
  - `orrery_retrograde` · "The rings run backward. So does the dent you made." · rewind self 2 · ifHpBelow:50
- **Loot:** 58–90 g · `item_chronal_dust` ×2 100% · `mat_frayed_moment` 80% · `mat_iron_rivet` 40% ·
  `item_pattern_hour_spindle` 100% (W-B §7)
- **Bestiary** (Remnant Archive): Year 377. A brass knight with an orrery for a chest, standing over
  the observatory's great orrery like a nurse. Hadrek the Clockwright's mark is on its heel. It aligns
  its rings on one target and strikes when the line is complete. It guards the key in the orrery's foot
  and nothing else.
- **Tactics:** Clear Mark and the Conjunction has no target; Void during Retrograde; Storm on the brass.

#### `cr_stutter_hound` — Stutter Hound (anomaly)
**Watch-wardens · L5 anomaly, Loop 2+ · XP 117** · loc_barren_peaks (15%)
- **Stats:** HP 70 · ATK 12 · DEF 2/2 · AGI 12 · chrono · breach-born
- **Resist:** weak void · resist chrono · immune poison
- **Intents:**
  - `stutter_bite` · "It bites. It bites again, the same bite." · 2 hits × 0.6× you · bleed 30% 2
  - `stutter_skip` · "It is behind you. It was never in between." · phase self 1 · everyNthTurn:3
  - `stutter_echo` · "It does the last thing again, exactly." · repeats its previous move · ifHpBelow:50
- **Loot:** 13–21 g · `mat_frayed_moment` 100% (anomaly guaranteed material) · `item_chronal_dust` 40%
- **Bestiary** (Wayfinder's Notes): Loop 2, the Barren Peaks. A grey hound that does everything twice:
  one bite and the same bite a heartbeat late, like a word caught in a throat. It was not here in
  Loop 1. I think it came in with me. Void hits it where the second bite comes from.
- **Tactics:** Guard the turn after a Bite (the Echo repeats it); Void.

#### `cr_hour_leech` — Hour Leech (anomaly)
**Watch-wardens · L12 anomaly, Loop 4+ · XP 376** · loc_chronos_nexus (15%)
- **Stats:** HP 150 · ATK 23 · DEF 2/5 · AGI 6 · chrono · breach-born
- **Resist:** weak void · resist chrono · immune poison
- **Intents:**
  - `leech_attach` · "It fastens to the end of your shadow that touches tomorrow." · 0.8× you · slow 50% 2 · first
  - `leech_drink_hour` · "It swells. Somewhere, a watch goes missing." · 1.0× you · heals self for 50% of damage · Breach Clock −1 watch (once per fight) · everyNthTurn:3
  - `leech_coil` · "It coils back into the moment it came from." · rewind self 2 · ifHpBelow:50
- **Loot:** 27–42 g · `mat_frayed_moment` ×2 100% · `item_chronal_dust` 60%
- **Bestiary** (Wayfinder's Notes): Loop 4. A leech as long as my arm, grey, ringed like a clock-face.
  It does not drink blood. It drinks the hour. If it lives to its third turn, the Breach Clock is a
  watch lighter. Kill it in two turns or pay later. Pell Ashcombe counted the days. I wonder if one of
  these ever counted him.
- **Tactics:** Burst it before its third turn; Void through the Coil.

### 6.8 The Unravelled

#### `cr_horde_husk` — Horde Husk
**Unravelled · L12 fodder · XP 289** · any Horde-infected node (loc_darkened_corridor ×2,
loc_ironclad_camp ×2, loc_scorched_gate ×2); `cr_unraveling_tide` add; q_day_of_teeth's "Unravelled"
(three waves of one husk each at the Nexus)
- **Stats:** HP 140 · ATK 23 · DEF 3/3 · AGI 6 · chrono (physical on Claw, void on Come Apart) · breach-born
- **Resist:** weak ley · resist chrono, void · immune poison
- **Intents** (all hidden: "it has no next moment", STORY §8.6):
  - `husk_claw` · "Its next moment is not there. Neither is its face." · hidden · 1.1× physical you
  - `husk_flicker` · "It is three creatures for a moment, then one." · hidden · 0.8× all
  - `husk_come_apart` · "It comes apart toward you." · hidden · 1.4× void you · ifHpBelow:30
- **Loot:** 27–42 g · `mat_frayed_moment` 50%
- **Bestiary** (Wayfinder's Notes): Brak calls it the Horde; the Remnants say the unraveling. A husk is
  what is left of anything, from any family, once the hold slips: a golem's shoulder, a Shade's mouth,
  a Mireling's light, flickering, with no next moment, so nothing tells me what it will do. Ley gives
  it an order to fall apart in.
- **Tactics:** Ley; Guard when one drops below a third (Come Apart).

#### `cr_unraveling_tide` — The Unraveling Tide (Horde boss)
**Unravelled · L14 boss · XP 500 (kill only)** · loc_darkened_corridor, Horde state, when more than 14
moves have passed since the Tyrant fell (WORLD §3.1); the Escape/Fall sequence's boss
- **Stats:** HP 480 · ATK 26 · DEF 2/6 · AGI 1 · chrono · breach-born · cannot be fled
- **Resist:** weak ley · resist chrono, void · status immune: stun, slow, poison, bleed, burn; Stagger allowed
- **Win condition:** kill it, **or** be standing at the end of round 10: "The Tide passes. It had
  somewhere else to be." The fight ends, the way to the Library opens, no loot and no XP.
- **Phase 1 — The Edge** (rounds 1–3):
  - `tide_wash` · "Moments wash over your boots, cold and out of order." · 0.8× all · slow 50% 2
  - `tide_take` · "Something in the wave takes what you were holding onto." · 0.6× void you · strips your shield, regen, haste, rewind
  - `tide_shape` · "A shape climbs out of the wave." · summons 1 `cr_horde_husk` (max 2) · everyNthTurn:3
  - *Transition (round 4 or <66%):* "The Tide pulls back to gather. The corridor walls go with it, then return."
- **Phase 2 — The Undertow** (round 4 or <66%):
  - `tide_pull` · "The floor tilts toward the wave." · 1.2× you · slow 60% 2
  - `tide_rise` · "The wave rises to the ceiling and hangs there." · hidden wind-up, then `tide_crest` 1.8× all · everyNthTurn:3
  - `tide_wash` (as Phase 1)
  - *Transition (round 8 or <33%):* "The Tide is thinner here. Through it: the Library, and a violet light."
- **Phase 3 — It Passes** (round 8 or <33%):
  - `tide_crest` · "It breaks over you on its way somewhere else." · 1.6× all · everyNthTurn:2 (no wind-up)
  - `tide_wash` (as Phase 1)
- **Loot (kill only):** 155–240 g · `mat_frayed_moment` ×4 100% · `item_chronal_dust` ×2 100%
- **Bestiary** (Wayfinder's Notes): When the Tyrant falls, this comes down the ley lines ahead of
  everything else. Not a creature: the edge of the unraveling, a wave of loose moments with husks in it.
  If I dawdle after the Apex it fills the Corridor between me and the Library. I don't have to kill
  it. I have to still be standing when it moves on.
- **Tactics:** Guard every Crest; Ley throughout; kill the husks it lifts. Survival is a win.

#### `cr_unmade` — The Unmade (anomaly)
**Unravelled · L13 anomaly, Loop 3+ · XP 425** · loc_heartstone_depths (exploited, 25%),
loc_sunken_scriptorium (20%)
- **Stats:** HP 160 · ATK 24 · DEF 0/6 · AGI 7 · void (chrono on Absence) · breach-born
- **Resist:** weak ley · resist chrono, void · immune poison
- **Intents:**
  - `unmade_undo` · "Your last wound on it was never made." · rewind self 2 · everyNthTurn:2, skipped while it is Marked
  - `unmade_erase` · "It touches your shadow. Part of the outline is gone." · 1.0× you · weaken 50% 2
  - `unmade_absence` · "Where it stands, the room is missing." · 0.8× chrono all · blind 30% 1
- **Loot:** 29–45 g · `mat_frayed_moment` 100% (anomaly guaranteed) · `mat_breach_glass` 50% · `mat_shadow_ash` 30%
- **Bestiary** (Wayfinder's Notes): Loop 3, the Scriptorium, in a carrel no one sat at: a shape cut out
  of the room. Not a shadow; there is no light down there to cast one. Something the unraveling began
  to remove and did not finish. It undoes the wounds I give it. Marked, it can't. The Remnants have no
  entry for it. This is the entry.
- **Tactics:** Mark it first; Void consumes the Undo; Ley is weak.

#### `cr_redundant_wayfinder` — Redundant Wayfinder (anomaly)
**Unravelled · L12 anomaly (elite stats), Loop 4+ · XP 676** · loc_whispering_ruins (10%, replacing
the pool roll, only where the player died in an earlier loop; `ev_redundant_stand`), loc_voidglass_gallery
(`ev_gallery_reflection`)
- **Stats:** HP 260 · ATK 23 · DEF 4/4 · AGI 9 · the player's class type (Ranger physical, Wizard fire,
  Elf physical, Warden physical, Weaver void) · breach-born
- **Resist:** weak ley · resist the player's class type · immune poison
- **Intents:**
  - `redundant_recognize` · "It looks at you the way you look at a mirror." · no action · first
  - `redundant_your_move` · "It lifts its weapon the way you lift yours." · 1.2× you · the class's status (Ranger bleed 40% 3 · Wizard burn 40% 3 · Elf phase self 1 · Warden armor_break 40% 2 · Weaver curse 40% 3)
  - `redundant_your_guard` · "It braces exactly as you would." · Guards (halves damage until its next turn) · ifHpBelow:50
  - `redundant_leave` · "It turns and walks to where you died." · leaves combat, no loot · round:3, only if it has taken no damage
- **Loot:** 54–84 g · `mat_frayed_moment` ×2 100% · the player's class starter weapon 30%
- **Bestiary** (Wayfinder's Notes): Loop 4. Standing where I died in Loop 2, wearing what I wore. Not a
  ghost: a Wayfinder the Breach made twice and only needed once. It waited for me to strike. When I
  didn't, it walked to the place I fell and lay down there. The time I did strike, it fought exactly as
  I do. Badly, at first.
- **Tactics:** Leave it be (it goes on round 3), or fight it with the type your class does *not* use; Ley.

#### `cr_tyrants_reach` — Tyrant's Reach (anomaly)
**Unravelled · L9 anomaly, Loop 3+ · XP 246** · loc_aetherium_spires (10%, once per loop);
`cr_chronos_tyrant_unveiled` Phase 2 add (DESIGN §4.10's `nine_shard`, 90 HP kept)
- **Stats:** HP 90 · ATK 18 · DEF 3/5 · AGI 5 · chrono · breach-born
- **Resist:** weak ley · resist chrono, void · immune poison
- **Bound mage** (rolled on spawn; at the Apex no repeats among the five): Korr · Vane · Aulde · Sallow · Masque.
- **Intents:**
  - `reach_grasp` · "A skeletal limb surfaces out of the air, reaching." · 1.0× you · slow 40% 2
  - `reach_dead_spell` · everyNthTurn:2 · by bound mage: **Korr** "Something that was a scholar burns." 1.2× fire you, burn 60% 3 · **Vane** "Stone-grey hands close on your left." 1.2× physical you, armor_break 50% 2 · **Aulde** "A single note rises; the mass brightens." shield ally (the Tyrant) or self 1.5× · **Sallow** "Green breath leaks from the limb toward you." regen ally 0.4×/3, poison 50% 4 on you · **Masque** "An eye opens in the limb and reads you." rewind ally 2, mark 100% 2 on you
  - `reach_withdraw` · "The limb sinks back toward the east." · leaves combat · round:4, Spires only
- **Loot:** 21–33 g · `mat_frayed_moment` 100% (anomaly guaranteed) · `mat_breach_glass` 40% ·
  `item_aetherium_shard` 50% (Spires only)
- **Bestiary** (Wayfinder's Notes): Loop 3, the Spires. An arm came out of the air, bone and crystal,
  and reached for the Spires' note like a man reaching for a rail in the dark. It struck me once with
  something not its own: Korr's fire. At the Apex the Tyrant puts out two at a time. Each is one of the
  five who stood with him. They are not attacking. They are what he is made of, coming loose.
- **Tactics:** At the Apex kill Aulde and Sallow reaches first (they heal and shield the Tyrant); Ley.

#### `cr_chronos_tyrant_contained` — The Chronos Tyrant, Contained (boss, Loop 1)
**Unravelled · L14 boss (hand-tuned for a level 12–13 party, D-051) · XP 900** ·
loc_temporal_breach_apex, Loop 1 · *legacy "The Chronos Tyrant": HP 126 · dmg 14 · def 5 · agi 4 ·
XP 180 · magic resistance 30% · scaled to player level +1*
- **Stats** (DESIGN §4.10): HP 540 · ATK 24 · SP 26 · DEF 6/8 · AGI 4 · chrono · breach-born ·
  cannot be fled · cannot speak (D-004; Loop 1 voices are "a chorus of countless dying moments")
- **Resist:** weak ley · resist chrono, void · status immune: stun, slow, poison, bleed; Taunt ignored;
  Stagger allowed
- **Legacy description:** "A towering, amorphous figure of rippling time. Skeletal limbs and crystalline
  shards surface and vanish within its shifting mass."
- **Phase 1 — The Holding** (100–66%; STORY §8.4: it does not want to fight you):
  - `tyr_brace` · "The Tyrant braces the hour against you." · shield self 1.0× SP · every second turn (alternates with the moves below)
  - `tyr_grasp` · "A skeletal limb surfaces, reaching." · 1.2× ATK physical you · slow 100% 2
  - `tyr_shear` · "Time thickens around your feet." · 1.0× SP all
  - `tyr_time_lash` · "The hour draws tight, then lashes at you." · 1.3× SP you
  - *Transition (<66%):* "The mass splits along old seams. Things that were people surface and do not sink back." onEnter: 2× `cr_temporal_aberration` at 60% HP.
- **Phase 2 — The Fracture** (<66%; the five strike once per rotation, STORY §8.4):
  - `tyr_korr_burns` · "Something that was a scholar burns." · 1.0× SP fire you · burn 60% 3
  - `tyr_vane_closes` · "Stone-grey hands close on your left." · 1.1× ATK physical you · armor_break 60% 3
  - `tyr_gather` · "The hour draws back like an arm. It will fall." · hidden 2-turn wind-up, then `tyr_chrono_strike` 2.0× SP you · stun 100% 1 unless you Guarded ("the strike that scattered Dask")
  - `tyr_aulde_sings` · "One clear note rises. Light settles over the mass." · shield self 1.5× SP
  - `tyr_sallow_breathes` · "Green breath leaks from the mass toward you." · 0.6× SP ley you · poison 70% 4; regen self 0.4× SP/3
  - `tyr_remember` · "An eye opens in the mass and looks back a moment." · rewind self 2 (Masque) · everyNthTurn:3
  - *Transition (<33% or round 14):* "It stops guarding itself. Every wound you give it is answered by a voice."
- **Phase 3 — The Nine Speak** (<33% or round 14; takes ×1.5 damage, STORY §8.4; no more Brace):
  - `tyr_unraveling` · "The Tyrant stops guarding itself. Everything here comes loose." · 1.1× SP all · armor_break 100% 2
  - `tyr_remember` · everyNthTurn:3
- **Loot:** none (legacy); `mat_frayed_moment` ×3 lie at the Apex afterwards (WORLD §3.5). The Horde
  begins (D-060).
- **Bestiary** (Remnant Archive): Year 44. The Remnants named it the Chronos Tyrant after the first
  Wayfinder, Sael Orrin, died before it: a towering mass of rippling time at the Apex, limbs and crystal
  surfacing and sinking. It has never left the Apex. Scholars reasoned that whatever stands at the
  heart of the Breach must be its cause. A later hand adds: it braces before it strikes, like something
  that would rather not.
- **Tactics:** Ley throughout. Guard every Chrono-Strike wind-up. Void after Remember (consumes Rewind).
  The Aberrations can be ignored if your damage is high; their Slow cannot.

#### `cr_chronos_tyrant_unveiled` — The Chronos Tyrant, Unveiled (boss, Loop 2+)
**Unravelled · L18 boss · XP 1,600** · loc_temporal_breach_apex, Loop 2+ · Veyran Thal, holding
- **Stats** (DESIGN §4.10): HP 900 · ATK 32 · SP 36 · DEF 8/10 · AGI 4 · chrono · breach-born · cannot be fled
- **Resist:** weak ley · resist chrono, void · status immune: stun, slow, poison, bleed; Taunt ignored;
  Stagger allowed
- **Opening:** it does not attack first. With `echo_tyrant_speaks` (WORLD §3.5's condition, Errata E9) the
  fight begins only when the player attacks; communion is open from the first turn.
- **Phase 1 — Lament** (100–75%; ↔ Movement I):
  - `tyr_speak` · "It speaks: 'You have crossed. So.'" · no action · first (later loops: STORY §8.2 lines)
  - `tyr_time_lash`, `tyr_grasp`, `tyr_shear` (as Contained, with these stats)
  - *Transition (<75%):* "'Then you came to finish it.' The mass opens. Two of the five reach out."
- **Phase 2 — The Nine Surface** (<75%; ↔ Movement II; onEnter: 2× `cr_tyrants_reach`, mages rolled
  without repeat; one more each time one dies, max 2 alive and 5 in total):
  - `tyr_remember` · everyNthTurn:3 · otherwise the Phase 1 moves
  - *Transition (<50%):* "'I hold,' it says. 'If I do not hold, you have seen what comes.'"
- **Phase 3 — Chrono-Strike** (<50%; ↔ Movement III):
  - `tyr_gather` → `tyr_chrono_strike` · everyNthTurn:3 · otherwise the Phase 1 moves
  - *Transition (<25% or round 20):* "The hold fails. The chorus stops pretending to be one voice."
- **Phase 4 — The Hold Fails** (<25% or round 20):
  - `tyr_unraveling` · every turn · its outgoing damage +10% per round in this phase (uncapped, DESIGN)
  - at 10% HP, once: "'If you finish this, run,' says the voice under the chorus. 'I mean that kindly.'"
- **Communion** (STORY §8.3 beats, D-054 Resolve 0–8). Opens with `echo_tyrant_speaks` or the first
  *Listen*; from Loop 2 the player may also switch at any phase transition and start at Movement II
  (STORY §8.4). The Commune toggle swaps the bar for Speak / Listen / Offer / Resist (DESIGN §4.11).
  While communing, the Tyrant's intent alternates a question (pseudo-intent, no damage) with
  `tyr_hour_presses` · "The hour leans on you while it waits." · 0.6× SP you × (1 − Resolve/16).

| Movement | Pseudo-intents (question chip) | Answers |
|---|---|---|
| `tyr_movement_1` · I — The Holding | `tyr_q_why` "It asks why you have come." · `tyr_q_hour` "It asks what day this is, for you." · `tyr_q_before` "It asks who came before you." | `echo_tyrant_jailer` +1; the honest "to kill you" +1; a lie −2 · `echo_thirtieth_dawn` +1 · `echo_seven_wayfinders` +1 |
| `tyr_movement_2` · II — The Fracture | `tyr_q_korr` "'What is read is owed. What have you read?'" · `tyr_q_vane` "'Who guards the gate now?'" · `tyr_q_aulde` "'What note does the sky hold?'" · `tyr_q_sallow` "'What lives, that carries what does not?'" · `tyr_q_masque` "'Tell me what you saw from the far side.'" · `tyr_q_hallow` "The chorus leaves a gap where a sixth voice should be." | verse 2 or `echo_korr_marginalia` +1 (Corruption ≥ 3 also +1 here, −1 at the next asker) · verse 3 or `echo_stone_hide_origin` +1 · verse 5 or `echo_spire_note` +1 · verse 6 or `echo_breathing_pool` +1 (automatic with Mireya active) · verse 7 or `echo_eye_of_masque` +1, `echo_ritual_inevitable` +2 · `echo_hallow_said_stop` +2 |
| `tyr_movement_3` · III — The Nine Speak | `tyr_q_choice` "The chorus stops. One voice asks what you will do." | Resolve ≥ 3: let you pass (Silverwood Before, or ending F) · ≥ 6 with `echo_litany_complete`: take its place (A) · 8 with `echo_void_resonance`, `echo_heartstone_resonance` and `item_breach_anchor` (STORY adds `echo_anchor_mechanic` and Caelum's cradle-pin): the Mending (B, `echo_tyrant_consent`) |

  Resolve caps at 8. Other actions (proposed conversion of DESIGN §4.11's 0–100 values; DESIGN to
  confirm, Q4): **Listen** +1 once per Movement, and its next intent becomes a full-strength
  `tyr_time_lash`; **Offer** `item_chronos_lens` +1, `item_stabilized_heartstone` +1,
  `item_breach_anchor` +2 (sets `flag_anchor_offered`), `item_heartstone_core` −2; **Resist** = Guard,
  +0; a companion in Support stance, Dask or Caelum only, +1 once per Movement. Below 30% Tyrant HP or
  in Phase 4, every gain is +1 more ("it is tired"). **Rejection** (STORY §8.5): Resolve < 3 at a
  Movement's end, or two lies: "Then you are the fifth to come for me with a blade in your mouth. Go and
  get a real one." Combat resumes at Phase 2; leaving instead is `closer_fall` (reason `rejected`) and
  grants `echo_tyrant_rejected`. Attacking during communion is allowed; a kill ends in the Horde.
- **Loot:** `mat_tyrant_shard` 1 per phase cleared (DESIGN §8.2; max 4) · `mat_frayed_moment` ×3. A kill
  triggers the Horde and the Escape (D-060), never a true ending.
- **Bestiary** (Wayfinder's Notes): Loop 2. It spoke. "You have crossed. So." A chorus, with one voice
  under it like a bass line. Veyran Thal stepped into the tear to hold it, and he is still holding it:
  five of the Nine surface through him, the hour does not move, and he cannot ask for help. Kill it
  and the unraveling comes. Talk to it and it listens, verse by verse. It falls silent where I am missing words.
- **Tactics:** Fight: Ley, kill Aulde and Sallow reaches first, Guard every Chrono-Strike, finish
  before Phase 4's ramp. Commune: bring the verses and the trace Echoes, Dask or Caelum in Support.

### 6.9 Mortals

#### `cr_city_watch_halberdier` — City Watch Halberdier
**Mortal · L13 fodder · XP 327** · loc_silver_gate (Day 3, ×2, if `flag_wanted_in_silverwood`),
loc_plaza_of_bells (×2 when a weapon is drawn)
- **Stats:** HP 150 · ATK 24 · DEF 6/2 · AGI 6 · physical · **non-lethal**: its damage cannot take you
  below 1 HP; at 1 HP you are arrested (wake in the Garret, lose a day, WORLD §2.6)
- **Resist:** neutral to all · statuses work normally
- **Intents:**
  - `watch_halt` · "'Halt.' The halberd comes level with your chest." · 0.6× you · slow 60% 2 · first
  - `watch_hook` · "The hook of the halberd reaches for your knee." · 1.0× you · stun 25% 1
  - `watch_haft` · "It reverses the halberd and drives the haft." · 1.2× you
  - `watch_whistle` · "A whistle. Boots on stone, coming." · summons 1 `cr_city_watch_halberdier` · ifAllyDown · once
- **Loot:** 29–45 g · `item_silverwood_honeycake` 30% · beating them sets `flag_wanted_in_silverwood`
- **Bestiary** (Wayfinder's Notes): Blue and white, halberds, whistles. They do not want to kill me.
  They want me carried to a cell, and in the end they manage it. Losing costs a day in the Garret, not
  a loop. Winning makes the Before notice me. Sheathe the blade in the Plaza.
- **Tactics:** Don't draw in the Plaza. If it starts, Stun one and flee before the whistle.

#### `cr_circle_adept` — Circle Adept
**Mortal · L14 fodder · XP 367** · loc_scholars_corridor (50% if wanted), loc_grand_library (×2, Day 3)
- **Stats:** HP 150 · ATK 26 · DEF 2/6 · AGI 7 · ley (fire on Pyre)
- **Resist:** weak physical · resist ley · statuses work normally
- **Intents:**
  - `adept_ley_dart` · "An adept in grey draws a line of blue in the air." · 1.0× you
  - `adept_ward` · "They speak a phrase from the Warding. Light hardens over them." · shield self or ally 1.2× · ifAllyPresent
  - `adept_pyre` · "A scholar's hand lights at the fingertips." · 1.2× fire you · burn 50% 3 · everyNthTurn:3
  - `adept_seal` · "'The Archives are sealed,' they say, and mean you." · 0.5× you · stun 30% 1 · everyNthTurn:4
- **Loot:** 31–48 g · `item_remnant_ink` 40% · `item_mana_bloom` 30% · `mat_silverwood_heartwood` 15%
- **Bestiary** (Wayfinder's Notes): Grey robes, ink on the cuffs: the Circle's students. On Last Bell
  the Circle closes the Library and sets them on the stacks. They are not soldiers. They are frightened
  scholars with a great deal of training. One of them will be a Shade in a corridor in a few hours. I
  try not to think about which.
- **Tactics:** Steel through the robes; Stagger the Pyre.

#### `cr_veil_sentry` — Veil Sentry
**Mortal (Weaver) · L10 fodder · XP 220** · loc_voidscar_hollow (joins group B, Loop 2+, Weavers Wary or
Hostile), loc_veil_mouth (×2, every visit, Weavers Wary or Hostile)
- **Stats:** HP 120 · ATK 20 · DEF 2/5 · AGI 9 · void
- **Resist:** resist void · statuses work normally
- **Intents:**
  - `sentry_count` · "'One,' she says. The thread at your wrist tightens." · 0.6× you · slow 50% 2 · first
  - `sentry_thread_cut` · "A grey thread snaps taut across your path." · 1.1× you · bleed 40% 3
  - `sentry_unsee` · "She steps sideways out of being seen." · phase self 1 · everyNthTurn:3
  - `sentry_call_the_choir` · "She hums one note. The dark answers." · 0.4× all · curse 60% 3 · ifAllyDown
  - `sentry_withdraw` · "She cuts her own thread and is gone." · leaves combat · ifHpBelow:25
- **Loot:** 23–36 g · `mat_umbral_thread`† 40% · `item_void_shard` 15%
- **Bestiary** (Wayfinder's Notes): Two Weavers in grey thread at the Veil Mouth, counting. When the
  Weavers trust me they count me in. When they don't, they count me out, with thread. They fight like
  people who would rather be elsewhere: careful, quick, gone when hurt.
- **Tactics:** Ley after the Choir's Curse; let the wounded one go. Better: be Neutral with the Weavers.

---

## Appendix A — Items and materials introduced or sourced in §6

| id | Name | Type | Tier | Note |
|---|---|---|---|---|
| `item_aberrant_eye` | Aberrant Eye | quest | — (band 9–13) | A Temporal Aberration's eye, still looking a moment ahead. Drops 100% from `cr_temporal_aberration` while `q_unlidded_eye` is active (STORY names it; W-B's §7 also defines it under the same id). |

Drop sources this file shares with W-B's §7 (same rates): `item_hollow_lantern_focus` 10%,
`item_chasmglass_focus` 10%, `item_travelers_sword` 10%, `item_necromancer_staff` 5%, the three Borin
patterns on the Ninefold Knight, Orrery Knight and Unbroken Warden. Sources assigned here:
`item_dark_spellbook` (D-055 rule on `cr_corrupted_shade`; 25% on `cr_starved_shadow`),
`item_wildling_hide_armor` 25% on `cr_wildling_brute` (DESIGN §4.12; W-B lists the legacy 50%).

Materials used as drops that DESIGN §8.2 does not list (marked †; WORLD §3 places them, W-B defines
them): `mat_cinder_horn`, `mat_bell_bronze`, `mat_umbral_thread`, `mat_storm_glass`, `mat_conflux_dust`,
`mat_glow_spore`, `mat_lantern_resin`. DESIGN owns `mat_*` (D-062) and should add them to §8.2.

## Appendix B — Errata for WORLD §1–3

- **E1** `npc_hollis_vane` → `npc_hollis_cade` (§3.8 loc_sanctum_of_threads band line and NPCs) (D-064).
- **E2** `npc_elder_wren` → `npc_elder_wen`, "Elder Wren"/"Wren" → "Elder Wen"/"Wen" (§2.10 Changes;
  §3.9 loc_lanternreed NPCs; loc_breathing_pool description, encounters "while Wren lives", NPCs, and
  `ev_pool_cleanse`) (D-064).
- **E3** Ilsabet Rhune is Silverwood's **Warden of Waters**, not of the Nine (D-063): §2.7 "the Master
  of Waters, Ilsabet Rhune of the Nine" → "the Warden of Waters, Ilsabet Rhune"; §3.6 `ev_tidewell_ledger`
  "the Master of Waters" → "the Warden of Waters"; loc_bell_wardens_deep "a Master's chain of office" →
  "the Warden of Waters' chain of office", "the Master's name" → "the Warden's name"; §3.11
  loc_cistern_gardens description and `ev_gardens_wheels` "The Master of Waters" → "The Warden of
  Waters"; its NPCs "none (event figure only)" → `npc_ilsabet_rhune` (Day 2).
- **E4** Aulde ids (D-063 spirit): `loc_aldours_eyrie` → `loc_auldes_eyrie`, `item_aldours_spire_notes`
  → `item_auldes_spire_notes` while ids are still unshipped (recommendation; the lead decides).
- **E5** §3.11 loc_silver_gate: Hesper Dunn "Watch-Captain; quest giver" → "Gate-Captain under Captain
  Corvin Dreyl; gatekeeper". loc_plaza_of_bells NPCs add `npc_corvin_dreyl` (Days 1–3). §2.8 may add
  "Corvin Dreyl, Captain of the Silverwood Watch" at first mention (D-063).
- **E6** §3.11 loc_ninefold_hall: "Hadrek's chair" → "Masque's chair, where Hadrek works"; NPCs add
  `npc_hadrek` (Day 1) and `npc_haldric_vane` (Days 1–2) (D-063).
- **E7** The Nine on stage (STORY §9.2): `npc_maelis_korr` → loc_scholars_corridor; `npc_durn_hallow` →
  loc_conflux_chamber (Days 1–2); `npc_seraphine_aulde` → loc_outer_walks; `npc_imre_sallow` →
  loc_cistern_gardens; `npc_tovren_masque` → loc_grand_library (replaces "none (Oriel is in her
  Archives)"). loc_conflux_chamber Day 3 "the Nine" → all nine ids, non-interactive (`npc_durn_hallow`
  leaves at the sixth verse, D-050).
- **E8** D-064 placements: add `npc_ansel_dray` to loc_shattered_library (reading-room camp, Loop 1+);
  loc_hearthring "npc_oma_varr (clan-mother, quest giver)" → `npc_hadda_ironvow` (clan-mother, quest
  giver) + `npc_oma_varr` (teller); add `npc_sethe_unlidded` to loc_sanctum_of_threads. STORY's "Ring of
  Wagons" is loc_hearthring and "the Hollow Choir" is loc_sanctum_of_threads (STORY Q11 ratification).
- **E9** Echo ids to STORY §12 (D-062): `echo_nyx_true_name` → `echo_nyx_is_of_the_nine` (§2.3, §2.9,
  §3.8 ×3); `echo_tyrant_true_name` → `echo_tyrant_name` (§3.11 `ev_hall_veyran`) and, in §3.5's Apex
  encounter line, "with `echo_tyrant_true_name` or `echo_litany_verse_1`" → "with `echo_tyrant_speaks`"
  (STORY §8.3); `echo_anchor_rule` → `echo_anchor_mechanic` (§2.6); `echo_aldour_weavers` →
  `echo_aulde_weavers` (D-063). WORLD-only Echoes this file relies on and STORY §12 must add:
  `echo_rhune_choice`, `echo_dreyl_brand`, `echo_sky_oath`, `echo_tyrant_never_struck`, `echo_vask_seal`,
  `echo_hadrek_clockwright`, `echo_nomad_signs`.
- **E10** Faction id `shadow_weavers` → `weavers` (D-044): §0 Conventions and every `rep` condition in
  §3 (loc_voidscar_hollow east exit, loc_stair_of_unmaking east exit, loc_where_she_fell ×2).
- **E11** §3.5 Apex items: "(After the Tyrant falls: mat_frayed_moment ×3, mat_tyrant_shard ×1.)" →
  `mat_frayed_moment` ×3 after either Tyrant; `mat_tyrant_shard` only from the Unveiled Tyrant, one per
  phase cleared (DESIGN §8.2); none in Loop 1.
- **E12** §3.1 loc_heartstone_depths, destroyed state: `cr_hollow_lantern` (L10) in a band 3–4 node →
  `cr_corrupted_shade` ×3, or give the destroyed state its own band 8–10 as the exploited state has 6–8.
- **E13** §0 Conventions "boss ×6–8" and "Attack ≈ level + 6" → DESIGN §6.5's "ATK ≈ 5 + 1.5L" and
  boss ×3.5–4.5 (Q1, Q2).
- **E14** Name mapping for other docs: STORY q_day_of_teeth "Unravelled" = `cr_horde_husk`; DESIGN §4.10
  `nine_shard` = `cr_tyrants_reach`; DESIGN §4.10 `temporal_aberration` = `cr_temporal_aberration`;
  DESIGN's unprefixed creature ids (`wildling_brute`, `corrupted_shade`, `chronos_tyrant_*`) take `cr_`.

## Appendix C — Open questions (§4–6)

- **Q1 Boss HP.** The brief and WORLD §0 say boss HP ×6–8 fodder. At ×6 the L9 Bell-Warden has 660 HP
  against roughly 31 party damage a turn at level 8: about 21 turns, past DESIGN §19's 10–14. DESIGN's
  own Tyrants sit at ×3.6 and ×4.5, so regional bosses here use ×3.5–4.5 (420–720 HP). Confirm.
- **Q2 Attack.** DESIGN §6.5's ATK ≈ 5 + 1.5L (it matches DESIGN's Brute, Shade and both Tyrants) is
  used instead of "level + 6", which gives 19 rather than 24 at L13. Confirm, and fix WORLD §0 (E13).
- **Q3 Drowned Reach boss.** The brief names "Oriel / the First Drowned". WORLD §3.6 makes
  `cr_bell_warden` the Reach's forced boss, and D-046 places Oriel as the Archivist in the Sunken
  Archives (Silverwood Ruins). Kept: Bell-Warden as the boss; the First Drowned as the unique Archivist
  (free first turn, `q_the_first_drowned` bypass). If Oriel should be a boss fight, add a two-phase
  Loop 2+ variant at loc_sunken_archives for players without `echo_oriel_drowned`.
- **Q4 Communion.** (a) Opening Echo: STORY says `echo_tyrant_speaks` (or Listen), DESIGN §4.11 says
  `echo_tyrant_jailer`; STORY used. (b) The 0–8 conversions (Listen +1, Offer ±1/+2, Support +1, damage ×
  (1 − Resolve/16)) are proposals for DESIGN under D-054. (c) STORY §8.5 rejects at "Resolve < 3 at any
  Movement's end", but Movement I can only reach 3 with a perfect run; suggest checking at the end of
  Movements II and III only.
- **Q5 Contained Tyrant.** Thresholds follow DESIGN (66% / 33% or round 14), not STORY's 65% / 30%.
  STORY's Phase 3 "damage taken ×1.5" is included; drop it if the sim shows fights under 12 turns.
- **Q6 Cross-band reuse.** One id, one level (D-009) makes some placements easy: `cr_aetherial_weaver`
  L8 at the Spire-Crown and Eyrie (13–14), `cr_void_touched_stalker` L6 on the Scar Shelf (10),
  `cr_drowned_archivist` L4 in the Scriptorium (6–7), `cr_warding_pillar` L6 in the Before, Brutes and
  Stalkers in STORY's q_bone_road on the Steppe (7–11). Accept them as escorts, or let §10 swap them.
  `cr_horde_husk` (L12) in q_day_of_teeth (band 8–11) is read as one husk per wave.
- **Q7 Skyreach merchant.** DESIGN §9.4's `npc_skyreach_trader` has no WORLD NPC; §3.10 has no merchant.
  Drop it, or add a Nomad sky-burial keeper at loc_windward_stair.
- **Q8 Hesper Dunn.** WORLD calls her a quest giver; STORY §11 gives her no quest, and her first name
  repeats Hesper Vayle, the second Wayfinder (STORY §2.8). She is a gatekeeper here; rename her if the
  echo is unwanted.
- **Q9 Sedge Marrow.** WORLD calls Sedge a crafter; DESIGN §8 makes Borin the only one. Sedge sells
  finished diver gear here.
- **Q10 Anomaly variants.** DESIGN §6.6 also wants ≥16 `anomaly_*` twists on existing creatures. This
  file defines six anomaly creatures; the `anomaly_*` modifiers belong to §10 or the lead.
- **Q11 Ironclad Camp vendor.** DESIGN §9.4 has a quartermaster at the Camp from Loop 1; WORLD has only
  Tessaly's caravan after `flag_hearthring_caravan`. Until it arrives the Camp sells nothing.
- **Q12 Engine effect kinds.** These blocks use effects beyond DESIGN §4.2's step list: summon, revive,
  leave combat, multi-hit, strip buffs, heal-on-damage, riposte, round-limited survival win, clock
  effect. DESIGN/PLAN should confirm each as a supported ability effect.
