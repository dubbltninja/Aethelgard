# BIBLE.md — Echoes of Aethelgard: The Unraveling — continuity bible

*The reference every writer and checker uses. Dense, tabular, no prose padding. Built in U9 from
DECISIONS (through D-068), STORY (U9), DESIGN (U8), WORLD (U9 in progress), REVIEW-CROSS §3 and
REGISTRY-DRAFT. Sources are given per row as STORY §, WORLD §, DESIGN § or D-###.*

## 1. Canon precedence and how to use this file

1. **D-062 precedence.** DECISIONS > STORY (people, names, dates, events, the Nine, quests `q_*`, Echoes `echo_*`, scenes, codex, endings) > DESIGN (systems and numbers) > WORLD (places, map, creatures `cr_*`, NPC ids `npc_*`, placement) > PLAN. STORY §12 is the Echo catalog; an Echo another document needs is added there, never invented elsewhere.
2. **This file restates; it does not rule.** Every row cites its source. If a row disagrees with its source, the source wins and the row is wrong; if two sources disagree, §9 lists it with a proposed ruling, and the lead records the ruling in DECISIONS before anyone edits.
3. **How to use it.** Checking a name or spelling: §7. A date or "who was where when": §2, §3. Whether a character can know a fact at a given point: §4 (fact × knower × earliest loop/scene × Echo). A place: §5. An item, verse or faction: §6. A rule of the loop, the clock, the Before or communion: §8.

---

## 2. Timeline

Years are "of the Sundering" (Remnant count; D-025). Year 0 is the Sundering. Day 1 of the game is Year 500. Silverwood Before's three days are **First Bell / Second Bell / Last Bell** (WORLD §2.6; STORY's older "Day −3 / −2 / −1"; data `flag_before_day_1..3`; C-53).

| When | Event | Source |
|---|---|---|
| Long before Year 0 | Silverwood is the capital of Aethelgard and the seat of its mages: the Plaza and its nine bells, the Library and the Archive beneath it, the Conflux under the Archive where every ley line meets in the Heartstone. The Circle rules its learning; "the Nine" is only how many stood in the Conflux on the last night. | STORY §2.1, D-023 |
| Before Year 0 | Vane sets golems to guard the northern ley-knot (Vane's Watch, now the Blighted Outpost). Aulde raises the Aetherium Spires as tuning forks and keeps a workshop in the Skyreach (Aulde's Eyrie). Masque builds the observatory at the Nexus; Hadrek makes its orrery. Sallow keeps the Green Court. Dreyl's pyre-ward rings the city, built to Vane's design. Oriel keeps the Archives of Danthe. Hallow forges "iron that does not wish": the Heartstone's cradle. | STORY §2.2, §9; WORLD §2.11, §4; D-063 |
| Before Year 0 (the Veil) | The lesser mages who will become the Weavers have not yet gone down; the Voidscar does not exist until the Sundering opens it where the Ninefold Hall stood. | WORLD §3.11 `loc_ninefold_hall`; STORY §2.7 |
| Year 0, First Bell (Day 1) | Festival; the bells ring all day for the Conflux; the city dances. Veyran lectures in the Hall ("the Holding is a kindness to the hour"); the nine chairs are full; Hadrek services the floor-map from Masque's chair. Caelum is on the Plaza and reads the Litany in the Garret at night. Nyxaria walks the Plaza at night and looks at the Wayfinder twice. | WORLD §3.11, §12.1; STORY §9.2 |
| Year 0, Second Bell (Day 2) | Overcast; single tolls. The Circle seals the Archives (a Warding Pillar guards the stair without Tobrin's seal). Ilsabet Rhune walks the Cistern Gardens checking every sluice-wheel twice and gives the cistern key (`echo_rhune_choice`). Tobrin Vask keeps the failsafe in the Conflux Chamber: the ward seal and the schematic's second half (`echo_vask_seal`, `echo_anchor_half_b`). Hallow fits the cradle at his field-forge by the stair. Veyran's draft of the ninth verse's last line lies in his study in the Hall (`ev_hall_study_draft`, Second and Last Bell). | WORLD §3.11, §4, §12.1; STORY §9.1–9.5; D-067.6 |
| Year 0, Last Bell (Day 3), morning | No birds; a 60 Hz hum. Hallow forges a second cradle-pin in the Yard "this morning" and nobody gives him the hour to fit it. | STORY `scene_anchor_in_the_conflux` |
| Last Bell, noon | Veyran sends Caelum to the Spire Yard (the east terrace of the Plaza of Bells) with a message. Aulde reads it and laughs: *begin at the ninth bell*. She sings her verse for the boy (`echo_litany_verse_5`). | STORY §7.6, `q_the_apprentices_errand`; D-067.9; REVIEW #12 |
| Last Bell, first toll | The ninth bell cracks on the first toll. | WORLD `ev_plaza_crack` |
| Last Bell, dusk, the ninth bell | The Circle descends the Archive stair to the Conflux. Oriel sets the Echo Crystal on its stand and takes her place with ink and the record. Veyran sends Caelum up the stair with a second message for the Spire Yard; Caelum is three steps up when the first verse begins. He never delivers it. The Heartstone's beat is slow and even. | STORY §2.4 |
| Verse 1 (Oriel) | The Crystal wakes; this is why it holds nine voices. | STORY §2.4 |
| Verses 2–3 (Korr; Vane) | The northern ley-knot answers; the golems of Vane's Watch turn to face outward. The Heartstone brightens. | STORY §2.4 |
| Verse 4 (Hallow) | The cradle takes the stone's weight; the chamber sings a low note the Plaza bells ring back. The city thinks it is a festival (`echo_bells_of_silverwood`). | STORY §2.4 |
| Verse 5 (Aulde) | The Spires answer with her note; the sky over Silverwood goes silver-white. Children are lifted onto shoulders. | STORY §2.4 |
| Verse 6 (Sallow) | The Green takes the overflow. The first hairline crack opens in the Heartstone "with a sound like a tooth breaking". Hallow: "Stop." Veyran: "It holds." Hallow: "It is *held*. That is not the same." He steps out of the circle, takes an ember from the brazier in his bare hand, and climbs the stair. Eight remain. | STORY §2.4; D-050 |
| Verse 7 (Masque) | Reading the sky through the Lens by the Nexus-link in the chamber wall: "It fails. I can see the hour from the far side and in it we are not here." Veyran: "Then we read it again." It says the same. | STORY §2.4 |
| Verse 8 (Nyxaria) | She names the dark between. A seam opens above the stone, black, without depth. Its first breath goes up the stair and touches the boy on the third step: Caelum is unanchored. She feels the recoil begin in her teeth and does not say so. | STORY §2.4, §9.6; D-067.9 |
| Verse 9, line 1 (Veyran): "Hour, stay." | The Heartstone bursts its cradle. The seam widens into the Breach. The recoil, finding the one mind that named the dark, throws Nyxaria Vell forward five hundred years. Veyran to Oriel: "Carry it out!" She runs with the record. | STORY §2.4 |
| Verse 9, line 2: "Be as you are, and do not become." | The Breach begins to swallow the chamber. Veyran understands what it will do if nothing stands in it. He steps in. | STORY §2.4, §2.5 |
| Verse 9, line 3: "I hold you. I hold you. I hold—" | He is still speaking it. Korr, Vane, Aulde, Sallow and Masque are pulled into the tear with him: six in the mass. | STORY §2.2, §2.4 |
| The same night, within the hour | The shear runs out along the ley lines. The towers fold "into impossible angles". Ilsabet Rhune opens the cisterns to drown the Conflux's fire; the Archive floods; Oriel drowns in her carrel with the record sealed in her wax; the water never leaves (the Drowned Reach). The Plaza craters. The Spires crack and keep humming. The golems lock into their last order. The Green drinks the light. Masque's dome shatters. Dreyl's pyre-ward turns outward and burns the plains and the herds in a day (the Ashen Steppe; Ashmaw). The Ninefold Hall becomes the Chasm of Whispers. | STORY §2.6; WORLD §2.7, §2.8, §3.11; D-063 |
| By dawn, Year 0 | The Breach "closes" to a scar at what is now the Apex, because a man is standing in it. The Sundering "was merely its catastrophic echo" **[legacy]**. | STORY §2.6, D-004 |
| Year 0 + 2 days | Hallow, having crossed the Barren Peaks with the ember in a clay bowl, dies on the ash with the coal still red. His forge-hands raise a cairn over him (Hallow's Cairn, Stormgate Cairns) and carry the ember north. | STORY §2.2, §2.6, codex; C-37 |
| Years 0–44 | Oriel's junior keepers dig the Archive out, take her seal, begin the count of years and the Ledger of Wayfinders: the Remnants. The city guard and Hallow's forge-hands relight the ember in a warm canyon, the Emberforge, and have never let it go out: the Ironclad. Silverwood's lesser mages go down into the Voidscar where the void is thin and find Void Shards: the Weavers. | STORY §2.7; D-014 |
| Year 44 | **Sael Orrin**, first Wayfinder, goes to the Apex alone, strikes the Tyrant and is unmade by the Holding's reflex. Keeper Avel Dray, second of that name, enters "the Chronos Tyrant" in the Ledger. The Ironclad adopt the name within a generation; the Weavers never (they say "the Keeper of the Gate"). | STORY §2.8, codex `codex_tyrant_naming`; D-067.12 |
| ~Year 100 | Hearthring's fire is lit "from the last ember of the Burned Hall"; it has not gone out "in four hundred years". | WORLD `loc_hearthring`, `npc_oma_varr` |
| Year 110 | **Hesper Vayle**, second Wayfinder, a healer, reaches the Apex and will not strike; sits down before the Tyrant and dies of the shear, unspoken to. | STORY §2.8 |
| Year 178 | **Corwen Blackreed**, third, brings twenty Nomads; wounds the Tyrant; the hold slips for one day: **the Day of Teeth**. Twenty hold the Nexus with steel; Corwen dies in the horde he let out. His axe stays in the Nexus. | STORY §2.7, §2.8, `q_day_of_teeth` |
| Year 243 | **Ysolde Marr**, fourth, a Shadow Weaver, tries to take the Tyrant's power into herself; the Breach takes her. The Weavers call her the Taken, and the Choir has sung the eighth verse wrong for four hundred years. | STORY §2.7, §2.8, `codex_weaver_choir` |
| Year 309 | **Pell Ashcombe**, fifth, a scholar, first counts the days; his notes name "the thirtieth dawn". Dies at the Apex of the shear on it without fighting. The shear takes him and the drift re-steadies; the world goes on. | STORY §2.8; D-067.11 |
| Year 371–372 | **Rook Tallis**, sixth, a hunter, turns back at the Apex; the pull brings him back a year later; dies in the Nexus under the broken dome. | STORY §2.8 |
| Year 430 | **Dask**, seventh, Ironclad-trained scout of Hearthring, sees what the Tyrant is and tries to speak to it; the Holding's reflex, which Veyran cannot yet hold back, scatters him across moments: the Flickering Man, in four places in the Highlands, mid-word. | STORY §2.8, §7.4; D-013, D-025, D-067.12 |
| Year 442 | Ansel Dray, aged twelve, begins checking Ashcombe's arithmetic; he has done so every year since. | WORLD `npc_ansel_dray` (Dray ~70 in Year 500) |
| Year 460 | **Nyxaria Vell** comes down in the Veil at Where She Fell, ~30 years old, with starlight in her eyes, and crawls to the Voidscar Hollow. The first note on the crater's rim: "Year 460 of the Sundering. It worked. It worked and I am alone." She tells the Weavers what the Shards are. | STORY §2.5; WORLD `loc_where_she_fell`; D-006, D-025, D-067.13 |
| ~Year 470 | Nyx leads the Shadow Weavers ("for thirty years" at Year 500). The Weavers buy Ashcombe's notes from a Remnant diver; that is how she knows "thirty". | WORLD `npc_nyx`; C-51; D-067.13 |
| Year 498 | A Keeper's hand adds to the Ledger's naming entry: "the reasoning contains an assumption. The entry has not been amended." | STORY `codex_tyrant_naming` |
| Year 500, Day 1, dawn | The eighth Wayfinder wakes in the Whispering Ruins with "an inexplicable pull" and picks up the Amulet of Echoes among the tablets. Ilyra: "The whispers here are louder each day." | STORY §4.1; D-003, D-005 |
| Year 500, Day 1 → Day 30 | The Heartstone's pulse and the Apex's flicker drift apart a little more each day. The thirtieth dawn is when they fall fully out of phase and the hold breaks on its own. Seven times before, the shear took the Wayfinder first and re-steadied the hold; the Amulet keeps the eighth out of its reach, so this time the dawn comes. | STORY §3.2, §2.8; D-005, D-067.11 |
| Breach Clock | Base limit Day 30 Dawn (116 watches; 4 watches per day). Modifiers (DESIGN §10.1 owns): Stabilize +6 d · Exploit −5 d · Destroy −10 d · `q_the_mending` stage `anchor_the_conflux` +3 d · `q_day_of_teeth` (monster answer) −2 d · Corruption 6 −1 d · first communion Resolve ≥ 4 in a loop +2 d · `att_steady_hours` +1 d · Frayed Clock: base 20, others halved. **Floor:** never earlier than the current day + 3 dawns (D-066.8). Each return from Silverwood Before −1 d of *time* (the door takes a dawn, D-067.5; the Before's own clock is frozen inside, D-066.9). | DESIGN §10.1; D-005, D-017, D-066.8/9, D-067.5 |
| Loop structure | **Loop 1** = the legacy game; closers `closer_escape` (portal after the Tyrant's death or after expiry) and `closer_fall` (`death` in a Horde; `expiry`) both wake the player in Loop 2 Day 1 with no Threshold (D-049, D-066.7); a non-Horde Loop 1 death is the FALLEN screen (reload). **Loop 2+**: every closer and ending passes the Threshold; `closer_fall` reasons `death` / `expiry` / `rejected` / `released` (D-060, D-067.14). Each loop starts at level ⌊0.6 × best level⌋, cap 10 (D-067.2). Endings A–F all from Loop 2; the Mending needs ≥ 4 loops (D-010, D-018). | STORY §4–6, §10.7 |

---

## 3. People

Columns: canonical name · id · age/era · faction · what they know on Day 1 of Loop 1 · what they can learn or half-remember by loop tier · where · voice (one line) · fate per ending (brief; the full companion table is STORY §7.7).

### 3.1 The Ninefold Circle (D-006, D-063; STORY §2.2)

| # | Name | ids | Role · verse | Fate · trace in the present | Creature origin (WORLD §5) | Where met | Voice |
|---|---|---|---|---|---|---|---|
| 1 | **Veyran Thal**, Archmagus | `npc_veyran_thal` (Before); `cr_chronos_tyrant_contained` (Loop 1) / `cr_chronos_tyrant_unveiled` (Loop 2+) | Leader · IX The Holding | Stepped into the tear at the ninth verse; still speaking its third line; the Tyrant's core. Six in the mass. | The Unravelled (the Tyrant; the Horde; Tyrant's Reach) | Ninefold Hall Days 1–2, Conflux Last Bell; the Apex | A chorus with one voice under it; "the hour"; never "I am sorry" to the living (once, to Caelum) |
| 2 | **Nyxaria Vell** ("Nyx") | `npc_nyx` (present), `npc_nyxaria_vell_before` | Theorist of the Void · VIII The Dark Between | Thrown forward 500 years by the recoil; landed Year 460 at Where She Fell; leads the Weavers. ~70 now, looks 50. | The Hollowed (Stalkers, Null Mouths, Vell's Umbra: what came out of the dark she named) | Chasm of Whispers; Sanctum of Threads; Where She Fell; the Hall and the Plaza at night (Before) | Smoke; present tense; stops a word early; "he", never "it", of Veyran |
| 3 | **Oriel Danthe** | `npc_oriel_danthe` (Before); `cr_drowned_archivist` (the First Drowned, D-046) | Archivist, the Witness · I | Ran with the record; drowned in her carrel; bound to her pages. Her seal is the Remnants' seal; Ilyra is her descendant. | The Drowned (she is the first) | Archives of Danthe (Before); the carrel under the east stair of the Sunken Archives | "Let it be written as it is done"; a voice like a page turning |
| 4 | **Maelis Korr** | `npc_maelis_korr` | Author of the Dark Spellbooks, the Lesson · II | Pulled into the tear; his hand still writes in the margins. | The Hollowed (Shades: his students, still paying) | Scholars' Corridor Days 1–2 | "What is read is owed" |
| 5 | **Haldric Vane** | `npc_haldric_vane` | The Warder · III The Warding | Pulled into the tear; his golems hold his last order: *guard*. Vane's Watch = the Blighted Outpost. | Wards (Stone-Hide Golems, Warding Pillars, the Ninefold Knight, the Unbroken Warden) | Ninefold Hall Days 1–2 | "Stone does not tire of an order" |
| 6 | **Durn Hallow** | `npc_durn_hallow` | The Smith; forged the cradle · IV The Cradle | Said "Stop" at the sixth verse and walked out (D-050); died two days later on the ash with the ember lit: Hallow's Cairn. The Ironclad's fire, proverb and founding. | none (his iron does not wish) | Conflux Chamber field-forge Days 1–2 | "Iron that does not wish"; "Held is not the same as holding" |
| 7 | **Seraphine Aulde** | `npc_seraphine_aulde` | Spire-builder, the Resonant · V The Spire | Pulled into the tear; the Spires hum her one note. Her Eyrie holds schematic half A. | Spireborn (Aetherial Weavers, Wisps, Sentinels, the Stormcrown) | The Spire Yard (Plaza of Bells, east terrace) at Last Bell noon; WORLD also places her on the Outer Walks' terrace Days 1–2 (§9 risk) | "Listen. East. That is the note." |
| 8 | **Imre Sallow** | `npc_imre_sallow` | Life-mage, the Breath · VI | Pulled into the tear; the Glowlands and Glowfen glow because her breath still leaks (the Breathing Pool). | The Green (Mirelings, the Lantern Matron) | Cistern Gardens (Green Court) Days 1–2 | "Green takes what stone cannot" |
| 9 | **Tovren Masque** | `npc_tovren_masque` | Astronomer, the Eye · VII | Saw the failure and said so; pulled into the tear, still looking. The Nexus, the Lens. | Watch-wardens (Phantoms, Aberrations, Orrery Knights) | Grand Library glass roof Days 1–3 (WORLD §4); the Hall's dome on Last Bell for `echo_ritual_inevitable` (STORY §9.4; §9 risk) | "It fails. I have read it twice." |

**Who is in the Tyrant:** Thal (core), Korr, Vane, Aulde, Sallow, Masque. Vell was flung forward; Danthe drowned; Hallow walked. Eight stood at the ninth verse; the Crystal holds nine voices because all nine verses were spoken (D-050).

### 3.2 Companions (D-013; STORY §7; DESIGN §12)

| Name | companion id · NPC id | Age · faction | Knows on Day 1, Loop 1 | Learns / half-remembers by tier (STORY §6.4; nobody remembers, D-011) | Where | Voice | Fate A / B / C / D / E / F |
|---|---|---|---|---|---|---|---|
| **Ilyra** | `ilyra` · `npc_ilyra` | ~30 · Remnants | The whispers are louder each day; the Crystal is in the Library; her scroll is in the Archives. Not that she descends from Oriel. Not the loop. | Tier 2: dreamed of a library on fire and a door. 3–4: "almost said *you made it*". 5+: knows she will hold a door till her hands burn and asks to be told why. Loop 2+: believes the loop at once with `echo_ilyra_watchword`. Ending E: remembers every loop. | Whispering Ruins; the Shattered Library during a Horde | Precise, formal under stress; ink and paper | Writes the eighth name; never tears again / keeps the Archive dry / unravelled holding a door / hears nothing again / becomes the Keeper / holds the portal, you go |
| **Brak** | `brak` · `npc_brak` | ~40 · Ironclad; born Brak Stonehand (D-022) | Magic twists the wilds; the Peaks and the Outpost need clearing; the east "feels wrong". Will not name his brother. | 2: axe hand aches. 3–4: dreamed of a door that wasn't a door. 5+: "Do I die? Don't answer." Dies at the Apex in any loop the Tyrant falls in combat unless kept away (D-017); never in ending D (D-067.7). | Ironclad Camp; Hearthring for his arc | Fragments; one dry joke; "the Horde" | Names a wagon-child Stonehand / speaks to his brother / dies holding a line / lives, hates the quiet / lives the same thirty days / lives; holds the Nexus a day |
| **Nyx** | `nyx` · `npc_nyx` | ~70 (looks 50) · Weavers, leader ~30 years | Everything in §3.1 row 2; that Veyran holds the door; "thirty" from Ashcombe's notes; what the Shards are. Tells no one. Loop 1: one warning only ("A dead door is a wall"). | 2: "the void stirs when you breathe". 3–4: knows you have heard her true name. 5+: "How many times, Wayfinder?" Unmasked from Loop 2 (`q_the_dark_between` / `q_what_the_crystal_heard`). | Chasm of Whispers; Sanctum; Where She Fell | Present tense; no exclamation; "the void remembers" | Weeps once; leads honestly / freed from her hope, grows old / becomes a shard / ages 500 years, sleeps / keeps her secret forever / goes to the Apex and looks at his face |
| **Dask** | `dask` · `npc_dask` | Died Year 430; seventh Wayfinder · none (Ironclad-trained) | That the Tyrant is the door and knows his name; what a Wayfinder is; the seven marks. Has never seen a loop. | Loop 2+: audible; first scene gives only the warning (D-067.16); whole sentence after `q_the_flickering_man`. Stands on the Still Shore from Loop 3 (WORLD §2.12). | Shimmering Pass; only `temporallyUnstable` nodes (Highlands, Skyreach, Nexus, Apex, Before, Threshold, infected nodes); drops out on the Glowlands (D-068.2) | Dry, kind, a dropped word, never a stutter | Rests / rests or fades content / scattered again / gone / stays in the Pass, the Keeper's confidant / "fair" |
| **Mireya of Lanternreed** | `mireya` · `npc_mireya` | ~30s · Glowfen folk (not a faction) | Her people's skin shines; the sick need Glow Moss and bitterroot; the elders say the glow is the Breach (`echo_glowlands_leak`). | No déjà vu tiers written; loyalty resets. | Lanternreed; gathers on the Glowlands' edge | Herb-names, weather, orders ("sit *down*") | Tends the fen as chosen / grieves the light / unravelled / lights real lanterns / the same glow every thirty days / waves from the stilts |
| **Caelum Vesper** | `caelum` · `npc_caelum` | ~16 · Circle apprentice (Year 0) | Master Thal's lessons; the Litany by heart; nothing of the present. | The only one in the Before who remembers the player **between resets within a loop** (unanchored at the eighth verse); joins inside the Before after the noon errand; crosses by choice (`echo_caelum_unanchored`, D-067.9); remade with the Before each loop (D-067.4). | Garret; the Plaza on First Bell; the Archive stair at Last Bell's dusk | Old-city formal; "Master —"; the question he fears; never "sir" | Apprentices to Borin / sets the pin, grows up / dies on the stair / loses his gift, forges / the same three days forever / comes if asked |

### 3.3 Present-day NPCs (WORLD §4 ids; STORY names and roles, D-064)

| Name | id | Age · faction · role | Knows on Day 1 | Can learn by tier | Where | Voice | Fate per ending |
|---|---|---|---|---|---|---|---|
| **Kaelen Stonehand** | `npc_kaelen_stonehand` | ~44 · neutral ground · merchant; `q_blood_and_salt` | Brak is his brother and gave their father's name back; sells salt, not news | 2: sets out what you want before you ask. 3–4: you keep nearly saying his brother's name. 5+: "put it on the counter and I'll weigh it" | The Wayfarer's Respite | Merchant's economy; weighs and prices | Trades; in B crosses to the camp; C unravelled; E same market day |
| **Borin Stonefist** | `npc_borin_stonefist` | ~55 · Ironclad · the only crafter; `q_the_mending` forge stage | Keeps a fire he suspects is older than the Nomads | 2: hammer slipped. 3–4: "I've forged you something before." 5+: the forge holds Hallow's note near you | The Emberforge (works through the night) | Forge verbs; "Speak plain"; the fire is a person | Forges; in B lets the fire out one night on purpose and relights it; D his fire is the only fire now |
| **Keeper Ansel Dray** | `npc_ansel_dray` | ~70 · Remnants · Keeper; `q_keepers_ledger`, `q_the_keepers_price`, `q_the_thirtieth_dawn`, `q_long_archive`; also offers `q_bell_vault` | The Ledger (seven names, seven years); Ashcombe counted thirty; not what the count is of | Loop 2+ with `echo_thirtieth_dawn`: "Thirty, every time. And every time, someone like you was taken before it came." Wants the loop made deliberate (E) | Shattered Library reading-room camp | Dated, precise, dry; cites years | E: founds the Keeper's order with Ilyra |
| **Scribe Tamsin Reed** | `npc_tamsin_reed` | Remnants · merchant; `q_class_wizard` | Writes "Year 500" at the top of every page | — | Silverwood Plaza (the Library when the Plaza is infected) | Ink by the dram, salt by the cup | — |
| **Sedge Marrow** | `npc_sedge_marrow` | Remnants · merchant (diver gear; buys drowned vellum; sells to Weavers too) | A Remnant diver sold Ashcombe's notes to the Weavers; he may be the one (§9) | — | Lamplighters' Rest | "Dry it slow or it curls" | — |
| **Pellam** | `npc_pellam` | Remnants · rest keeper | Keeps the ninth-step lamps lit; the bell rang twice last night | — | Lamplighters' Rest | Counts the bell | — |
| **Scout Ferrin** | `npc_scout_ferrin` | Ironclad · gate scout; teaches `echo_nomad_signs` | Two notes means friend | — | The Scorched Gate | Short orders | — |
| **Hadda Ironvow** | `npc_hadda_ironvow` | ~50 · Ironclad clan-mother and warchief; `q_bone_road`, `q_day_of_teeth`, `q_iron_silence` | The Day of Teeth; twenty held it a day; she has two hundred | Loop 2+: the truth if told with `echo_tyrant_jailer` (then keeps the Nomads from the Apex) | Hearthring (STORY's Ring of Wagons) | Proverbs and commands | A: sends an axe-head to the Apex yearly; D: first chief of a confederation |
| **Oma Varr** | `npc_oma_varr` | Ironclad · teller | Knew the Stonehand brothers as boys; Hearthring's fire came from the Burned Hall | — | Hearthring | "Sit. You smell of the Breach." | — |
| **Tessaly Varr** | `npc_tessaly_varr` | Ironclad · caravan master, quartermaster (DESIGN's `npc_ironclad_quartermaster`) | — | — | Hearthring; caravan stall at the Camp after `flag_hearthring_caravan` | Rivets by the fist | — |
| **Ketch** | `npc_ketch` | Ironclad · skald (Ironclad Telling) | Sings the Day of Teeth; knows a verse about two brothers | — | Hearthring | Frame drum | — |
| **Sethe the Unlidded** | `npc_sethe_unlidded` | Weavers · lieutenant; `q_hollow_choir`, `q_unlidded_eye` | Cut away her eyelids to watch between moments; wants to see what Nyx has seen | Learns Nyx's seam if let look (`echo_choir_knows`) | Sanctum of Threads (STORY's Hollow Choir) | Choir cadence, repeated phrases | — |
| **Ysmay, the Thread-Mother** | `npc_ysmay` | Weavers · ritual elder; Veil errands; gives the Thread Ring at Trusted | Holds the one thread; "someone has tied you to the same day eight times" | Feels the loop as knots | Sanctum of Threads | No eyes; the thread | — |
| **Hollis Cade** | `npc_hollis_cade` | Weavers · quartermaster (was `npc_hollis_vane`, D-064) | — | — | Sanctum of Threads | "We sell the thread. The dark is free." | — |
| **Elder Wen Thistlecourt** | `npc_elder_wen` | Glowfen folk · elder; `q_the_drowned_lantern`; cleanses Corruption at the Pool (absorbs "Elder Wren") | The old ways; would keep the glow whatever it costs | — | The Breathing Pool; sits with the elders at Lanternreed | "No." / short flat refusals | Hostile if the leak is dammed |
| **Elder Tam** | `npc_elder_tam` | Glowfen folk · eldest; the Mangrove answers in his voice | "Lately it breathes for us" | — | Lanternreed | "Not yet." | — |
| **Old Fennick** | `npc_old_fennick` | Glowfen folk · merchant (DESIGN's `npc_mireya_stall`) | Trades moss for Nomad salt through the Reedmarch baskets; never met a Nomad | — | Lanternreed | Moss is three a bundle | — |

### 3.4 People of Silverwood Before who are not of the Nine (D-063; WORLD §4)

| Name | id | Office | Knows / does | Where, when | Trace in the present | Echo |
|---|---|---|---|---|---|---|
| **Captain Corvin Dreyl** | `npc_corvin_dreyl` | Captain of the Silverwood Watch | Blades sheathed in the Plaza; arrests (`flag_wanted_in_silverwood`); his pyre-ward, to Vane's design, will turn outward | The Watch post, Plaza of Bells, Days 1–3 | The Ashen Steppe's burned plains; the brand on its beasts; Ashmaw; the Ashbrand recipe | `echo_dreyl_brand` (Bone Orchard, `ev_orchard_brand`) |
| **Ilsabet Rhune**, Warden of Waters | `npc_ilsabet_rhune` | Civic office (not "Master of Waters of the Nine") | Checks every wheel twice; does not sleep; will open the cisterns to drown the Conflux's fire; gives the Cistern Key | Cistern Gardens, Second Bell | The Drowned Reach; the Bell-Warden in her chain of office; the Cistern Key | `echo_rhune_choice` (Tidewell Hall ledger or Second Bell) |
| **Hadrek the Clockwright** | `npc_hadrek` | Masque's orrery-maker | Every gear in the Nexus orrery is his; sits in Masque's empty chair | Ninefold Hall, First Bell | The Nexus orrery and its key | `echo_hadrek_clockwright` (a second Orrery Key) |
| **Tobrin Vask** | `npc_tobrin_vask` | Vane's apprentice ward-engineer | Keeps the failsafe: the ward seal and the schematic's second half; "if it goes wrong, someone should be able to open the door" | Ninefold Hall and Conflux Chamber, Second Bell | A copy under Vane's Watch (`ev_outpost_seal`) | `echo_vask_seal`, `echo_anchor_half_b` |
| **Gate-Captain Bryn Dunn** | `npc_bryn_dunn` (renamed from `npc_hesper_dunn` per C-52, STORY §3.3) | Gate-captain under Dreyl; gatekeeper | Issues the visitor's pass; takes the Wayfinder for a foreign scholar | The Silver Gate, Days 1–3 | — | — |
| **Anso the Bellwright** | `npc_bellwright_anso` | Casts the nine bells; sells charms | "The ninth bell is flat. I told them." | Plaza of Bells stall | The Plaza's "chorus of distant bells"; bell-bronze | — |

### 3.5 The seven prior Wayfinders (STORY §2.8; the Ledger of Seven)

| # | Name | Year | Class / temperament | Death | Mark / trace |
|---|---|---|---|---|---|
| 1 | Sael Orrin | 44 | Silverwood-blooded duelist (Elf); proud | Cut at the Tyrant; unmade by the Holding's reflex. His death got the Tyrant its name. | A buried duelling-ground under the Plaza (`q_class_elf`); the Gallery's first frame |
| 2 | Hesper Vayle | 110 | Wandering healer (Ranger, Wildcraft); gentle | Would not strike; sat down; died of the shear, unspoken to | second frame |
| 3 | Corwen Blackreed | 178 | Ironclad warrior; stubborn | Wounded the Tyrant; the Day of Teeth; died in the horde he let out | Blackreed's Axe in the Nexus |
| 4 | Ysolde Marr | 243 | Shadow Weaver; hungry | Tried to take the Tyrant's power; the Breach took her: "the Taken" | the Choir's wrong eighth verse |
| 5 | Pell Ashcombe | 309 | Scholar (Wizard); careful | First to count the days; "the thirtieth dawn"; died at the Apex of the shear | Pell Ashcombe's Day-Count (`item_pells_day_count`, Cistern of Names); his notes, bought by the Weavers |
| 6 | Rook Tallis | 371 (died 372) | Hunter (Ranger); wary | Turned back; the pull brought him back a year later; died in the Nexus | his grave, which Dask knew |
| 7 | Dask | 430 | Ironclad-trained scout turned loner (Ironclad Warden); dry | Tried to speak to it; the reflex scattered him across moments | the Flickering Man; the seventh frame; the eighth he leaves blank |

Gaps: 44, 66, 68, 65, 66, 62, 59, then 70 to Year 500: roughly one per lifetime (D-007's "60–80" read loosely; C-50). The player is the eighth. Keeper lineage: a Keeper Dray held the Ledger before Year 44 (Avel was "second of that name"); Ansel Dray holds it now.

---

## 4. Who knows what, when

"Who can know" is the character's knowledge in the fiction. "Earliest" is the first loop and scene in which the **player** can learn it. The Echo is what persists. NPCs never remember loops (D-011); only Caelum remembers resets within a loop, and only Ilyra in ending E remembers everything.

| Fact | Who can know it (in the fiction) | Earliest for the player | Echo |
|---|---|---|---|
| **The Tyrant is the jailer**: it holds the Breach shut; killing it removes the containment | Veyran (always; cannot say it to the uncrossed, D-004); Nyx (since Year 460; tells no one); Dask (since Year 430); the Stormcrown ("it does not strike what keeps its distance"); Keeper Dray half-knows (the Ledger's pattern) | Loop 2: any **two** of Dask's whole sentence (`q_the_flickering_man`), the Tyrant's first words (*Listen* at the Apex), Nyx reading Oriel's scroll, the Crystal's unfinished ninth voice, the thirtieth dawn + Dray's Ledger (D-067.16). Dask's first scene gives only "Don't kill it. It knows my name." | `echo_tyrant_jailer` (sources: `echo_flickering_man`, `echo_tyrant_speaks`, `echo_breach_recoil`, `echo_ninth_verse_unfinished`, `echo_thirtieth_dawn` + `echo_seven_wayfinders`) |
| **The Tyrant is Veyran Thal** | Veyran; Nyx; Dask (knows it is "a man"); the Nine in the Before (Veyran whole) | Loop 2: ask its name with `echo_nine_voices` or Dask's testimony; or Veyran in the Hall (Before) | `echo_tyrant_name` |
| **The Tyrant never strikes first; its strikes are the Holding's reflex** | Veyran; the Stormcrown; Dask (learned it a second too late) | Loop 2: the Apex ("It does not strike"); the Stormcrown's bargain (Loop 2+) | `echo_tyrant_never_struck`; STORY §2.5 |
| **Nyx is Nyxaria Vell of the Nine** | Nyx; Veyran; young Nyxaria does not recognise herself in a description (Before); Dask will not speak to her until she admits it; Sethe suspects, then knows if let look | Loop 2: `scene_nyx_unmasking` via `q_the_dark_between` (Where She Fell), `q_what_the_crystal_heard` (the Crystal kept + *Listen*), the crater's dated notes (`ev_fell_notes`), or scroll to Nyx | `echo_nyx_is_of_the_nine`; `echo_litany_verse_8`; `echo_breach_recoil`; `echo_choir_knows` if told |
| **The thirtieth dawn** (the drift breaks the hold on Day 30 whether or not the Tyrant is touched) | Pell Ashcombe (Year 309); Keeper Dray (the count, not its meaning); Nyx (from Ashcombe's notes); Veyran | Loop 1 expiry (`scene_clock_expiry`); Loop 2 `q_the_thirtieth_dawn`, `q_high_mark`, Watchfire Ridge | `echo_thirtieth_dawn`; `echo_breach_clock` |
| **Why it comes now**: the shear took every earlier Wayfinder and re-steadied the hold; the Amulet keeps this one out of reach | Dray works it out from the Ledger with the eighth Wayfinder's report; Veyran knows | Loop 2+: Dray with `echo_thirtieth_dawn` (`q_keepers_ledger`) | (carried by `echo_seven_wayfinders` + `echo_thirtieth_dawn`; codex `codex_breach_clock`) |
| **The loop** (the Wayfinder returns to Day 1 with memory) | Only the Wayfinder; Caelum remembers resets inside the Before; Ilyra believes it with the watchword; Ysmay feels the knots; Ilyra remembers all in E | Loop 2 waking (`scene_waking_loop_2`) | `echo_amulet_memory`; `echo_ilyra_watchword` (earned Loop 2, used Loop 3+) |
| **Wayfinders are a symptom**, not chosen; seven before; all died at or near the Apex | Dask; Dray (the Ledger); the Tyrant from Loop 3 | Loop 2: `q_seven_marks`; the Ledger; the Tyrant | `echo_seven_wayfinders`; `echo_wayfinder_symptom` |
| **Oriel is the Drowned Archivist** (the First Drowned) and **Ilyra descends from her** | Oriel (she knows Ilyra's hands); Ilyra does not know on Day 1 | Loop 2: `q_the_danthe_line` (Door of Pages → the carrel) or Oriel's carrel discovery; or Oriel in the Before | `echo_oriel_drowned`; `echo_oriel_lineage` |
| **Brak was born Stonehand; Kaelen is his brother** | Brak; Kaelen; Oma Varr; Ketch; the narration at his death | Loop 1: the legacy line "Brak Stonehand" at the Apex; Loop 2: `q_the_scouts_oath` (he says it once) | `echo_brak_birth_name`; `echo_brak_death` (Loop 1 if he dies) |
| **Brak dies at the Apex when the Tyrant falls** | Brak half-feels it by tier 5 | Loop 1 ending (`echo_brak_death`); watch `scene_braks_stand` Loop 2+ | `echo_brak_death`; `echo_brak_lives` (outcome C) |
| **The Litany, verses I–IX** (text §6.1) | The Nine; Oriel's record; the Crystal; the Choir (VIII, wrong); Caelum by heart | I: Loop 1 (give the Crystal; next talk). VIII: Loop 2 (Nyx). II–VII, IX: Loop 2+ present-day sources; all together in the Before (Loop 3 at the earliest by the Nexus door) | `echo_litany_verse_1..9`; `echo_litany_complete` |
| **The ritual was always going to fail; it cannot be stopped** | Masque (he read it twice); Veyran now | Loop 3+: `q_stop_the_ritual`, fourth attempt | `echo_ritual_inevitable` |
| **Hallow said stop and walked out** | Hallow; the Nine; the Ironclad's telling (as a proverb) | Loop 2: Hallow's Cairn; Loop 3+: the Before, verse 6 | `echo_hallow_said_stop`; `echo_hallows_ember`; `echo_litany_verse_4` |
| **The Anchor rule**: things set on the cradle's rim in the Before are in the Depths in the present, this loop | Caelum (after you show him); nobody else | Loop 3+: leave the Sky-Whisper Talisman on the rim; find it in the Depths | `echo_anchor_mechanic`; flags `flag_conflux_anchored`, `flag_cradle_pin_anchored` (per loop, D-067.4) |
| **The Amulet remembers** (holds memory across shear; never resets) | The Wayfinder; Dask (jealous); Oriel's card in the Grand Library hints | Loop 2 waking | `echo_amulet_memory` (D-003, D-047) |
| **The Shards are torn moments** of the last night | Nyx; the Choir half-knows ("tears from the Breach") | Loop 1: Nyx's legacy speech; Loop 2: `q_tears_of_the_breach` | `echo_shard_moments` |
| **The Glow is the Breach** (Sallow's breath leaking) | The Glowfen elders; Mireya suspects | Loop 1: Lanternreed (`q_lantern_in_the_reeds` stage 1); Loop 2: the Breathing Pool | `echo_glowlands_leak`; `echo_breathing_pool`; `echo_litany_verse_6` |
| **The door to the past exists only while Veyran holds it**; the Core pries it, killing him slams it | Nyx (it is her whole plan); Veyran | Loop 1: one line ("A dead door is a wall"); Loop 2: `q_what_she_would_undo` | `echo_what_she_would_undo` |
| **The Breach-anchor's design** (two halves) | Aulde (half A, her Eyrie); Tobrin Vask (half B; a copy under Vane's Watch) | Loop 2: Vane's Watch (`ev_outpost_seal`) and the Skyreach; Loop 3+: Tobrin, Second Bell | `echo_anchor_half_a`, `echo_anchor_half_b` → `echo_anchor_schema`; `echo_vask_seal` |
| **Silverwood Before exists and how to reach it** | Veyran (the tear); the Nexus door is Masque's | Loop 2: the Nexus with the Lens + verse 1; or the Apex with the Tyrant spared (Resolve ≥ 3) | `echo_breach_door`; `echo_before_route` |
| **Caelum can come forward** | Caelum, once shown | Loop 3+: `q_a_boy_from_a_doomed_city` | `echo_caelum_unanchored` / `echo_caelum_stayed` |
| **The six endings** (named) | A: Dask. B: the Tyrant and Borin. C: Nyx. D: Hadda. E: Dray. F: the Tyrant | All named in Loop 2 (STORY §5.6) | `echo_ending_a..f` when reached |

---

## 5. Places

Region bands are DESIGN §6.5 (D-056). `tU` = `temporallyUnstable` (D-059; WORLD §12.3); every infected node counts while infected. Gates are WORLD §11.3. Old names are STORY's or the pre-Sundering names.

### 5.1 Regions (12)

| Region | id | Band | Then (Year 0) | Now (Year 500) | Faction | Gate in |
|---|---|---|---|---|---|---|
| Silverwood Ruins | `region_silverwood_ruins` | 1–4 | The capital: Plaza, Library, Archive, Conflux | The ruin-field; "the Whispering Ruins" colloquially (D-023); Remnant ground | Remnants | start |
| Mistwood & the Ironclad Reach | `region_mistwood_ironclad_reach` | 2–6 | Wild woods; Vane's Watch on the northern ley-knot; a warm canyon | Fog and iron; the Nomads' nearest camp; the Emberforge | Ironclad; the Respite neutral (D-014) | open |
| The Voidscar | `region_voidscar` | 5–8 | The Ninefold Hall | A split that breathes cold; the Weavers meet outsiders here | Weavers | open |
| Aether-Kissed Highlands | `region_aether_kissed_highlands` | 6–10 | The Aether Road; Aulde's Spires | Distance bends; Dask flickers in the Pass | none | open; `tU` all |
| Glowlands & Nexus | `region_glowlands_nexus` | 9–13 (Apex 15–18) | Masque's observatory; Sallow's overflow | The glowing swamp, the broken dome, the Apex | none | Apex gate `g_apex` |
| Silverwood Before | `region_silverwood_before` | 13–17 | The city, three days from the end | A time-locked echo (D-016) | City Watch; the Circle (hostile on Last Bell) | `g_breach_door` (Lens + verse 1, Loop 2+) / `g_tyrant_tear` (spared); `tU` all |
| The Drowned Reach | `region_drowned_reach` | 4–8 | The undercity: guildhall, cisterns, scriptorium, bell tower | Under black water since Ilsabet opened the cisterns; lamplighters keep lamps lit | Remnants (divers) | `g_drowned_dark` (Glyphbound Lantern); crack from the Depths |
| The Ashen Steppe | `region_ashen_steppe` | 7–11 | Plains and herds; Dreyl's ward burned them in a day | Ash that never finishes falling; the Nomads as a people | Ironclad | `g_scorched_gate` (Outpost done or `echo_nomad_signs`); the south road is open |
| The Veil | `region_veil` | 10–14 | Did not exist | The scar's deeps; the Weavers' sanctum; Where She Fell | Weavers | `g_veil_curtain` (Weavers ≥ 20, `echo_weaver_sign`, or `q_lightless_stair` accepted) |
| The Glowfen | `region_glowfen` | 8–12 | Fen south of the Green Court's overflow | Lanternreed on stilts over a pool that breathes; a people becoming something | Glowfen folk (not a faction); neutral ground | open via the Glowlands causeway |
| The Skyreach | `region_skyreach` | 12–15 | Aulde's eyrie and her Sentinels' roosts | Looms still running; the Stormcrown watching the Apex | none | `g_thin_air` (Talisman or `echo_high_mark`); `tU` all |
| The Threshold | `region_threshold` | none | — | A shore inside the Breach between loops (D-012) | none | by a loop ending, Loop 2+ (D-049); `tU` all |

### 5.2 Locations (73)

| Name | id | Region | Aliases / old names | Then | Now | Gating · notes | tU |
|---|---|---|---|---|---|---|---|
| Whispering Ruins | `loc_whispering_ruins` | Ruins | the outskirts; colloquially the whole ruin | The Outer Walks' gardens (`loc_outer_walks`) | Start of every loop; the Amulet in Loop 1; Ilyra's cold fire | camp | no |
| Crumbling Archway | `loc_crumbling_archway` | Ruins | the Silver Gate (`loc_silver_gate`) | The city gate, nine faces newly cut | "Wayfinder... follow"; eight faces worn smooth; speaks in Oriel's voice with her lineage | — | no |
| Darkened Corridor | `loc_darkened_corridor` | Ruins | the Scholars' Corridor | Lamps every ten paces | A scorch-hand on the wall; the first Shade (a Spellbook) | — | no |
| Shattered Library | `loc_shattered_library` | Ruins | the Grand Library | Oriel's Crystal in its cradle, unlit | The Crystal in the third alcove; Dray's reading-room camp; the portal scar from Loop 2; the escape in any Horde | cond. rest; `g_library_portal` out (one-way) | no |
| Silverwood Plaza | `loc_silverwood_plaza` | Ruins | the Plaza of Bells | Fountains, nine bells, the Watch post | A cratered ring; mist; copper; Tamsin's stall; the slow Horde edge | — | no |
| Sunken Archives | `loc_sunken_archives` | Ruins | the Archives of Danthe | Oriel's dry vaults | Flooded; the Drowned Archivist (Oriel) in the carrel under the east stair; the Scholar's Lost Scroll; a stair down west | — | no |
| Heartstone Depths | `loc_heartstone_depths` | Ruins | the Conflux (present); the Conflux Chamber | The Heartstone whole in Hallow's cradle | The Heartstone, cracked, beating; the broken rim; Anchors from the Before appear here; three states after the choice | `g_depths_descent` (`q_echoing_heartbeat` accepted or `echo_heartstone_path`); crack to the Cistern of Names | no |
| Mistwood Path | `loc_mistwood_path` | Mistwood | — | Woods | Fog; glowing bark; scrap-iron cairns; the Horde's slow edge to the Plaza | — | no |
| The Wayfarer's Respite | `loc_wayfarers_respite` | Mistwood | — | — | Kaelen's wagon-shop; neutral ground; "steel and salt" | inn; merchant | no |
| Ironclad Camp | `loc_ironclad_camp` | Mistwood | — | — | Brak; tents and barricades; Tessaly's caravan later; Brak absent in a Loop 1 Horde (he is at the Apex) | inn; `g_peaks_pass` out | no |
| Barren Peaks | `loc_barren_peaks` | Mistwood | — | — | The Wildling Brute's worn path; Hallow crossed here with the ember | `g_peaks_pass` (`q_clear_path` accepted or `echo_ironclad_passwords`) | no |
| Blighted Outpost | `loc_blighted_outpost` | Mistwood | Vane's Watch | A ley-watch; Vane's garrison | Two Stone-Hide Golems; Vane's seal on their brows (`ev_outpost_seal`: `echo_vask_seal`, `echo_anchor_half_b`, Loop 2+); the warder's word stills them; the burned east gate with an iron bull | `g_scorched_gate` out | no |
| The Emberforge | `loc_emberforge` | Mistwood | — | A warm canyon | Hallow's ember, never out; Borin; the only forge; the Breach-anchor is made here | camp; merchant/crafter | no |
| Chasm of Whispers | `loc_chasm_of_whispers` | Voidscar | the Ninefold Hall's site | The Circle's chapterhouse | A rift breathing cold; Nyx at the lip; a rope bridge to glass | camp; `g_chasm_bridge` out | no |
| Voidscar Hollow | `loc_voidscar_hollow` | Voidscar | "the Hollow"; where Nyx crawled to | — | Obsidian scree; Void-Touched Stalkers; the Shards; the curtain of dark to the Veil (`ev_hollow_curtain`) | `g_chasm_bridge` (`q_void_shards` accepted or `echo_hollow_path`); `g_veil_curtain` out | no |
| Shimmering Pass | `loc_shimmering_pass` | Highlands | — | The Aether Road | Light fractures; Dask glimpsed in Loop 1, audible from Loop 2; mirage paths | camp | yes |
| Aetherium Spires | `loc_aetherium_spires` | Highlands | — | Aulde's tuning forks | Humming spires; Aetherial Weavers; Aetherium Shards; steps up the tallest spire; `echo_spire_note` | `g_thin_air` out | yes |
| Sky-Whisper Plateau | `loc_sky_whisper_plateau` | Highlands | — | — | Stone markers; the Sky-Whisper Talisman; a stair cut into the wind | camp; `g_thin_air` out | yes |
| Veridian Glowlands | `loc_veridian_glowlands` | Glowlands | — | Sallow's overflow | Glowing swamp; Mirelings; the reed causeway south; Dask drops out here (D-068.2) | — | **no** |
| The Chronos Nexus | `loc_chronos_nexus` | Glowlands | Masque's observatory | The observatory | Broken dome; the Chronos Lens; the orrery; Rook's and Corwen's deaths; the Breach-door in the east wall (`g_breach_door`); Brak's stand can be watched from here | camp; `g_apex` out; `g_breach_door` out | yes |
| The Temporal Breach Apex | `loc_temporal_breach_apex` | Glowlands | the scar | The tear's far end | The Tyrant, holding; the Horde begins here; communion; the tear into the Conflux when spared (`g_tyrant_tear`); endings A, B, C, D, F; Loop 1 *Face it / Not yet*; cannot be rested in; no autosave in Loop 1 (D-067.1) | `g_apex` (6 quests or `echo_apex_resonance`); `g_unbound_exit` | yes |
| The Drowned Stair | `loc_drowned_stair` | Drowned Reach | — | A stair of the undercity | Lamps on every ninth step under water; the dark below "looks back" | `g_drowned_dark` out (Glyphbound Lantern) | no |
| Tidewell Hall | `loc_tidewell_hall` | Drowned Reach | — | A guildhall | Water at chest height; ledgers at the same page; a clerk checking names; Rhune's ledger (`ev_tidewell_ledger` → `echo_rhune_choice`) | — | no |
| The Cistern of Names | `loc_cistern_of_names` | Drowned Reach | — | A cistern | Every stone a name; the crack to the Depths; Ashcombe's Day-Count | `g_cistern_crack` (Cistern Key, Heartstone destroyed, or `echo_archive_door`) | no |
| Lamplighters' Rest | `loc_lamplighters_rest` | Drowned Reach | — | — | A dry room above the water; Sedge and Pellam; lamps | camp; merchant | no |
| The Sunken Scriptorium | `loc_sunken_scriptorium` | Drowned Reach | the Door of Pages | The scriptorium | Clear water, ink unrun; pages in Remnant wax still being written; Oriel's hand → `echo_oriel_lineage`; Litany Page 1 nearby in the Reach | the Door opens to Oriel's seal (Ilyra's) | no |
| The Black Sluice | `loc_black_sluice` | Drowned Reach | — | A sluice channel | Fast black water; Lampreys; impassable at night without the Cistern Key | `g_sluice_walkway` | no |
| The Bellmouth | `loc_bellmouth` | Drowned Reach | — | The bell tower | Lying on its side; the great bell; one low note and the drowned stand up | — | no |
| The Bell-Warden's Deep | `loc_bell_wardens_deep` | Drowned Reach | the Bell Vault (STORY) | Under the bell | The Bell-Warden, a drowned giant in the Warden of Waters' chain, with the clapper; the three sunken bells; `q_bell_vault`; surrenders the Cistern Key with `echo_rhune_choice` | regional boss | no |
| The Scorched Gate | `loc_scorched_gate` | Steppe | — | The Outpost's east gate | A smaller gate inside the burned frame; Scout Ferrin; the trail-signs | `g_scorched_gate` in; the short road with `echo_steppe_waystones` | no |
| Ash-Wind Flats | `loc_ash_wind_flats` | Steppe | — | Plains | Grey flat land; herd-paths; Cinderback stampedes | — | no |
| Hearthring | `loc_hearthring` | Steppe | the Ring of Wagons (STORY) | — | Standing stones; a fire four hundred years old; Hadda, Oma, Tessaly, Ketch; Brak's home; where he waits if kept away | camp; merchant; `g_herd_grave` out | no |
| The Bone Orchard | `loc_bone_orchard` | Steppe | — | Herds | Bison turned to stone mid-stride; Dreyl's brand (`ev_orchard_brand` → `echo_dreyl_brand`) | — | no |
| Grey Salt Pan | `loc_grey_salt_pan` | Steppe | — | A lake | Salt; glare; jackals; Steppe salt gathering (Kaelen's "Respite salt") | — | no |
| Stormgate Cairns | `loc_stormgate_cairns` | Steppe | Hallow's Cairn (STORY) | Where Hallow died, two days past the Peaks | Iron-dark cairns that pull lightning; the ember-bowl inscription (`ev_hallows_cairn` → `echo_hallows_ember`, `echo_litany_verse_4`, `echo_iron_that_does_not_wish` with Borin's mark) | — | no |
| Watchfire Ridge | `loc_watchfire_ridge` | Steppe | — | — | A signal fire; the Apex visible as a white stain (`ev_ridge_apex` → `echo_breach_clock`) | camp | no |
| Reedmarch Descent | `loc_reedmarch_descent` | Steppe | — | — | Terraces down into reeds; moss-for-salt baskets; the Horde's way in from the Glowlands | — | no |
| The Herd-Grave | `loc_herd_grave` | Steppe | — | The herd that burned and kept burning | Ashmaw; the first calf of every spring | `g_herd_grave` (`q_bone_road` accepted or `echo_nomad_signs`); regional boss | no |
| The Veil Mouth | `loc_veil_mouth` | Veil | — | — | Black glass; wrong stars; two Weavers counting you in | `g_veil_curtain` | no |
| Stair of Unmaking | `loc_stair_of_unmaking` | Veil | the Lightless Stair (STORY) | — | Each step less there; the thread along the wall; descend without light (`q_lightless_stair`) | `g_sanctum_door` out (Weavers ≥ −9) | no |
| Sanctum of Threads | `loc_sanctum_of_threads` | Veil | the Hollow Choir (STORY); DESIGN's `loc_veil_sanctum` | — | A hall woven, not built; Sethe, Ysmay, Hollis; the Choir sings VIII wrong; Nyx's rite (1 watch) | inn; merchant | no |
| The Scar Shelf | `loc_scar_shelf` | Veil | — | — | Obsidian sheets; the Hollow and the Veil seen at once, not meeting where they should | `g_veil_curtain` | no |
| Voidglass Gallery | `loc_voidglass_gallery` | Veil | — | — | Black glass that shows nothing; your reflection does not follow | Blind on entry without the Hollow Lantern Focus | no |
| The Null Orchard | `loc_null_orchard` | Veil | — | Trees | Tree-shaped absences; fruit-shaped holes; Unmaking hazard without the Thread Ring | — | no |
| Eye of the Scar | `loc_eye_of_the_scar` | Veil | — | — | The scar's deepest point; a shadow with her shape, waiting forty years; Vell's Umbra | regional boss | no |
| Where She Fell | `loc_where_she_fell` | Veil | "Nyx's Cell" (STORY draft) | — | A crater of starlight glass, forty years old; the body-print; dated notes (`ev_fell_notes` → `echo_nyx_is_of_the_nine`); nine chalked names, eight crossed out (`ev_fell_names`; `scene_nyx_unmasking`); Litany Page 2; `ev_fell_resonance` → `echo_void_resonance` at Weavers ≥ 20 | warded; no encounters | no |
| The Lantern Causeway | `loc_lantern_causeway` | Glowfen | — | — | Reed road; lanterns with no oil; the Horde's way in | — | no |
| Lanternreed | `loc_lanternreed` | Glowfen | — | — | Stilt-village over a breathing pool; Mireya, Elder Tam, Old Fennick; the elders; neutral ground | inn; merchant | no |
| Sporelight Shallows | `loc_sporelight_shallows` | Glowfen | the Reed Maze (STORY) | — | Fungal shelves; light-dust; Glow Moss and bitterroot; the lantern-boat | — | no |
| The Elder Mangrove | `loc_elder_mangrove` | Glowfen | — | — | One tree old as the Sundering; it answers in Elder Tam's voice | — | no |
| The Breathing Pool | `loc_breathing_pool` | Glowfen | Sallow's station | The overflow's end | A well of light that inhales six heartbeats and exhales six; Elder Wen's mat; Corruption cleansed here (D-064); `echo_breathing_pool`, `echo_litany_verse_6`; the dam or the letting-run | — | no |
| Firefly Barrows | `loc_firefly_barrows` | Glowfen | — | — | Mounds of the Glowfen dead that leak light; Barrow-Lights speak past Wayfinders' names from Loop 3 | — | no |
| The Pale Gullet | `loc_pale_gullet` | Glowfen | — | — | White light; the current pulls to the Matron's Hall; leaving west costs two watches | — | no |
| Hall of the Lantern Matron | `loc_matrons_hall` | Glowfen | — | — | Elder Mother Sulis, become the Matron; Mireya's Lantern passes her | regional boss | no |
| The Windward Stair | `loc_windward_stair` | Skyreach | the Wind Stair / the High Mark (STORY) | — | Steps cut into moving air; the High Mark looks east at the Breach's seam (`q_high_mark`) | `g_thin_air` (Talisman or `echo_high_mark`); ascent 2 watches | yes |
| The Spire-Crown | `loc_spire_crown` | Skyreach | — | The tallest Spire's top | A crystal disc; threads of light in nine directions, eight gone dark | — | yes |
| Roost of the Sentinels | `loc_roost_of_sentinels` | Skyreach | — | — | Ledges; Nomad sky-burials the Sentinels do not touch | — | yes |
| Aulde's Eyrie | `loc_auldes_eyrie` | Skyreach | `loc_aldours_eyrie` (old id, C-29) | Aulde's workshop | Looms weaving light; her drawings; Aulde's Spire Notes; schematic half A (`echo_anchor_half_a`); the Spire-Builder's Staff | inn | yes |
| The Stormcrown's Perch | `loc_stormcrowns_perch` | Skyreach | — | — | The first Sentinel, five hundred years watching the Apex; bargain from Loop 2 (`echo_sky_oath`, `echo_tyrant_never_struck`) | regional boss or bargain | yes |
| The Silver Gate | `loc_silver_gate` | Before | the Crumbling Archway | The gate, whole; papers checked | Arrival from the Nexus door (Day 1 morning); Gate-Captain Bryn Dunn | `g_breach_door` in; `g_breach_door_back` out | yes |
| The Outer Walks | `loc_outer_walks` | Before | the Whispering Ruins | Gardens; benefactors' tablets, one blank | Aulde tunes the Spires from the east terrace Days 1–2 (WORLD §4) | — | yes |
| The Scholars' Corridor | `loc_scholars_corridor` | Before | the Darkened Corridor | A covered walk; Korr lecturing at the clean wall | Ley-flare on Last Bell where the scorch-hand will be | — | yes |
| The Grand Library of Silverwood | `loc_grand_library` | Before | the Shattered Library | Glass roof; the Crystal unlit in its cradle with Oriel's card; Masque on the roof | `ev_library_cradle` (Loop 3+) → `echo_crystal_seeded`; Korr's marginalia | — | yes |
| The Plaza of Bells | `loc_plaza_of_bells` | Before | Silverwood Plaza; the Spire Yard = its east terrace (D-067.10) | Fountains running; nine bells; the Watch post; Anso's stall; the dance on First Bell | The ninth bell cracks on Last Bell; the noon errand ends here | `g_hall_doors` out (Last Bell, ward seal, or Caelum active); merchant | yes |
| The Ninefold Hall | `loc_ninefold_hall` | Before | the Hall of the Circle (STORY); the Chasm's site | Nine chairs; the silver floor-map; Veyran, Vane, Hadrek, Tobrin | Veyran's study draft of IX (`ev_hall_study_draft`, Days 2–3); Masque's roof event on the dome (`ev_hall_masque_roof`, Last Bell); `ev_hall_veyran` → `echo_tyrant_name`; the Ninefold Knight on Last Bell | `g_hall_doors` | yes |
| The Apprentices' Garret | `loc_apprentices_garret` | Before | — | Where the apprentices sleep; Caelum reading the Litany | The Before's only full rest (advances the day); the chalk wall (`ev_garret_litany` → verse 2) | camp | yes |
| The Cistern Gardens | `loc_cistern_gardens` | Before | the Green Court (Sallow); above the cisterns | Terraced pools; Sallow's seedlings; Ilsabet on Second Bell | The Cistern Key (`echo_rhune_choice`); `echo_breathing_pool` beat | — | yes |
| The Archives of Danthe | `loc_archives_of_danthe` | Before | the Sunken Archives; "the Archive" | Dry vaults; Oriel writing the fair copy; the warded stair down | Litany Page 3 (anchorable); `ev_archives_oriel` → `echo_oriel_lineage`; Warding Pillar on Second Bell without the seal | `g_conflux_stair` out (Last Bell or ward seal) | yes |
| The Conflux Chamber | `loc_conflux_chamber` | Before | the Conflux; Hallow's Forge = his field-forge by the stair; "the Archive stair" leads here | The whole Heartstone in Hallow's cradle (D-067.10); Hallow fitting it Days 1–2; Tobrin Second Bell; the Nine at the plinths on Last Bell; the Unbroken Warden at the stair | The Anchor slot is the cradle's rim; `ev_conflux_sundering` at Last Bell's dusk returns the player | `g_conflux_stair`; `g_tyrant_tear_back` | yes |
| The Still Shore | `loc_still_shore` | Threshold | — | — | Black sand; still water that shows what happened; the far figure holding something up; Dask from Loop 3 | arrival | yes |
| The Gallery of Loops | `loc_gallery_of_loops` | Threshold | — | — | One painting per loop; the seven Wayfinders' frames; the eighth blank | — | yes |
| The Loom | `loc_loom` | Threshold | — | — | Attunements; challenge modifiers; New Game+ | — | yes |
| The Far Light | `loc_far_light` | Threshold | — | — | Class choice; "the morning smells of ozone and decay" | `g_far_light` → Day 1 | yes |

---

## 6. Things

### 6.1 The Litany of the Conflux (STORY §2.3; canonical text)

| Verse | Title · speaker | Text | Echo | Present-day sources (any one) |
|---|---|---|---|---|
| I | The Witness · Oriel Danthe | Let it be written as it is done. / Let the hand fail and the word stand. / What we do here, we do before the stone. | `echo_litany_verse_1` | Give the Crystal (Ilyra's next talk); keep it and *Listen* (Loop 2+); `q_the_first_drowned`; Litany Page 1 |
| II | The Lesson · Maelis Korr | What is read is owed. / We have read, and we have paid, and we are not done paying. / Let the debt be carried into the hour. | `echo_litany_verse_2` | Three Dark Spellbooks in one loop; the Garret's chalk wall; the Conflux on Last Bell |
| III | The Warding · Haldric Vane | Stone, stand where flesh would fall. / Keep the line and hold the gate. / Meet what comes without fear, for you have none. | `echo_litany_verse_3` | The Outpost's sigil-stones; Litany Page 3 (Oriel's gift); the Before |
| IV | The Cradle · Durn Hallow | Iron that does not wish, hold the heart. / Take the weight and do not want it. / What the hand would grasp, let the cradle only carry. | `echo_litany_verse_4` | Hallow's Cairn (`q_bone_road`); the Before |
| V | The Spire · Seraphine Aulde | Rise, lines, and be lifted. / Sing the one note the world was tuned to. / Let the sky hear what the ground has always known. | `echo_litany_verse_5` | `q_the_apprentices_errand`; the Spires with an Aetherium Shard |
| VI | The Breath · Imre Sallow | Green, take what the stone cannot. / Breathe in what burns; breathe out what grows. / Let what lives carry what does not. | `echo_litany_verse_6` | `q_what_the_light_takes` (the Breathing Pool); the Before |
| VII | The Eye · Tovren Masque | Read the sky before it is written. / See the hour from its far side. / Tell us true, and we will not turn away. | `echo_litany_verse_7` | The Nexus through the Lens at dawn; the Before |
| VIII | The Dark Between · Nyxaria Vell | There is a dark between one moment and the next. / We name it, and so we may enter it. / Open, and be entered. | `echo_litany_verse_8` | `scene_nyx_unmasking`; scroll to Nyx; Litany Page 2 (Where She Fell). The Choir sings it wrong |
| IX | The Holding · Veyran Thal | Hour, stay. / Be as you are, and do not become. / I hold you. I hold you. I hold— | `echo_litany_verse_9` | The Tyrant, Movement III (Resolve ≥ 6); Nyx when Loyal; Veyran's study draft (Before, `ev_hall_study_draft`) |
| all nine | The Litany of the Conflux | — | `echo_litany_complete` | Hold all nine (no other condition, REGISTRY §6.1) |

The ninth verse has no last line. In the Warden's Vigil the Wayfinder supplies it ("—I hold you."); in the Mending Veyran answers it with "Hour, *go*."

### 6.2 Key items

| Item | id | What it is | Where / how | Rules |
|---|---|---|---|---|
| Amulet of Echoes | `item_amulet_of_echoes` | "Tied to the Great Sundering"; holds memory across shear; the reason the Wayfinder loops (D-003) | The first room, Loop 1; on the neck at Day 1 of every later loop (D-047) | Never resets (D-066.19); grants `itm_echo_bolt` to every class; the *Listen* action from Loop 2; shields its bearer from the shear, so the hold cannot feed (D-067.11) |
| Echo Crystal | `item_echo_crystal` | Oriel's recording stand; holds nine voices, the ninth unfinished | The Shattered Library's third alcove (unlit in its cradle in the Before) | Give (Remnants +15, verse 1 next talk) or keep (Weavers +10, Remnants −10; *Listen* from Loop 2 → verse 1 + `echo_nine_voices`); `echo_crystal_seeded` (Loop 3+ in the Before) makes the Library's *Listen* yield nine voices either way |
| Scholar's Lost Scroll | `item_scholars_lost_scroll` | Oriel's record of the ritual in her wax | The Drowned Archivist's carrel, Sunken Archives | To Ilyra (lineage seed, `echo_archive_door`) or, from Loop 2, to Nyx (`echo_breach_recoil`, verse 8; a jailer source) |
| Chronos Lens | `item_chronos_lens` | Masque's lens; focuses time's echo | The Nexus | With verse 1 opens the Breach-door (D-016); Offer +1 in communion; verse 7 at dawn |
| The Heartstone | (world object; `item_stabilized_heartstone`, `item_heartstone_core`) | The Conflux's living core; anchors Veyran's hold; its pulse drifts from the Apex's flicker | Heartstone Depths; whole in the cradle in the Before | Stabilize / Exploit / Destroy once per loop (D-017); each choice leaves **two** fragments (D-066.10) |
| Heartstone fragments | `item_heartstone_fragment_stable` ×2 / `item_heartstone_fragment_dead` ×2 | Pieces of the stone | From Stabilize / Destroy | Feed the Breach-anchor and Mireya's dam in one loop (D-052); the dead fragment dams "permanently and darkly" |
| Breach-anchor | `item_breach_anchor` | Iron that does not wish, for the Apex floor | `recipe_breach_anchor` at the Emberforge: Aetherium Shards, one fragment, Void Shards, ember ore ×3, Silverwood heartwood (Before, Stone-Hide Golems, Kaelen from Loop 2); 0 gold; Ironclad gate Neutral while `q_the_mending` / `q_iron_silence` is active; needs `echo_anchor_schema` and Borin's `echo_iron_that_does_not_wish` (D-066.10, D-067.6) | Offer +2 in communion (not consumed, D-067.3); driven into the Apex in B (consent) and D (the ley cut) |
| Breach-anchor schematic, halves A and B | `item_breach_anchor_schematic_a` (Aulde's Eyrie) / `_b` (Tobrin, Second Bell; copy under Vane's Watch) | Aulde's device with two halves | Each half grants a persistent Echo (`echo_anchor_half_a` / `_b`); both from any loops → `echo_anchor_schema` (D-067.6) | — |
| Hallow's Cradle-Pin | `item_caelums_anchor_token` (WORLD id; STORY name) | The second pin Hallow forged on Last Bell morning and never fitted | Caelum borrows it; set on the cradle's rim (`scene_anchor_in_the_conflux`) | Anchorable; `flag_cradle_pin_anchored` this loop only (D-067.4); lies in the Depths on return; +3 days |
| Sky-Whisper Talisman | `item_sky_whisper_talisman` | Wind-kin pass | Sky-Whisper Plateau | Opens the Skyreach stair; anchorable: the Anchor discovery (`echo_anchor_mechanic`) |
| Dark Spellbooks | `item_dark_spellbook` | Korr's workbooks; his hand in every margin | First Corrupted Shade each loop always; later 50% (D-055); Hollis sells one | −15 HP and +1 Corruption per read, 0–6; three in a loop assemble verse 2; `echo_korr_marginalia` makes the first read free |
| Void Shards | `item_void_shard` | Tears from the Breach; each a torn second of the last night | Voidscar Hollow's Stalkers; the Choir has eleven thousand | Three to Nyx (Weavers +20, Shadow-Kissed Dagger) or kept (void-forged gear, Ironclad +5, Weavers −20); the anchor's third part; "Four is a sentence you did not mean to say" |
| Litany pages 1 / 2 / 3 | `item_litany_page_1` (verse 1, the Drowned Reach) / `_2` (verse 8, Where She Fell, Nyxaria's own) / `_3` (verse 3, Oriel's gift in the Before; anchorable) | Physical pages that grant their verse on reading (WORLD E-9) | as listed | — |
| Caelum's message | (prop) | The dusk message, never delivered; the noon one said *begin at the ninth bell* | In his hand when he crosses | — |
| Ward Seal | `item_ward_seal` | Tobrin's seal | Second Bell (`echo_vask_seal`) | Opens the Hall and the Conflux stair before Last Bell |
| Cistern Key | `item_cistern_key` | Ilsabet's key | Second Bell (`echo_rhune_choice`) or the Bell-Warden's surrender | The Sluice at night; the crack between the Depths and the Cistern |
| Keeper's Copy · Pell Ashcombe's Day-Count · Blackreed's Axe · Oriel's Ring · Father's Whetstone · Borin's Forge-Mark · Scout's Whistle · Choir Mask · Unlidded Eye · Aberrant Eye · Mireya's Lantern | `item_keepers_copy` · `item_pells_day_count` · `item_blackreeds_axe` · `item_oriels_ring` · `item_fathers_whetstone` · `item_borins_forge_mark` · `item_scouts_whistle` · `item_choir_mask` · `item_unlidded_eye` · `item_aberrant_eye` · `item_mireyas_lantern` | STORY quest rewards and keys (WORLD §7.10 ids) | per STORY §11 | Borin gives the forge-mark when `q_bone_road` is accepted (C-45) |

### 6.3 Factions (D-014; STORY §2.7, §3.4)

| Faction | Short | id | Origin | Leader(s) | What they believe about the Tyrant | Why they are wrong | Rep tiers (−100..100) |
|---|---|---|---|---|---|---|---|
| Remnants of Aethelgard | the Remnants | `remnants` | Oriel's junior keepers who dug out the Archive; her seal; the count of years; the Ledger | Keeper Ansel Dray; Ilyra is their strongest Ley-hand | A thing born of or guarding the Breach; the Breach is a wound to be studied and held closed | Right that it contains the Breach; wrong that it is a *thing*; wrong that holding is healing (ending E makes the hold permanent and calls it peace) | Hostile ≤ −40 · Wary −39..−10 · Neutral −9..19 · Trusted 20..59 · Sworn ≥ 60; start Echoes: `echo_ilyra_watchword` → 20 |
| Shadow Weavers | the Weavers | `weavers` (never `shadow_weavers`) | Silverwood's lesser mages who went down into the Voidscar; the Hollow Choir in the Veil; Ysolde the Taken | Nyx (Nyxaria Vell), ~30 years; Sethe; Ysmay | "The Keeper of the Gate": a gatekeeper hoarding the Breach's power; the Breach is an opportunity | Right that it can be entered and the Shards are its tears; wrong that power waits on the far side (Nyx knows and lets them believe it); ending C opens the gate and finds the same failure | `echo_weaver_sign` → 20 |
| Ironclad Nomads | the Ironclad / Nomads | `ironclad` | The city guard and Hallow's forge-hands who carried the ember north; the oath; dropped family names (D-022); the Day of Teeth | Hadda Ironvow (Hearthring); Brak and Borin at the Reach | A monster; magic is the disease; kill it *properly* and the land heals | Right that steel holds a line and the ley can be cut (D works); wrong that killing it saves anyone; wrong about where their own fire came from | `echo_ironclad_oath` → 20 |
| Glowfen folk | — | not a faction (`flag_lanternreed_trusts`) | Fen people changed by Sallow's leak | Elder Wen, Elder Tam | Do not care what it is; care what it leaks | — | — |
| Neutral ground | — | — | Kaelen's Respite; Lanternreed | — | — | — | — |

---

## 7. Terminology and spelling

D-026 plus every proper noun. Left column is canonical; right column is what to replace.

| Canonical | Banned / replaced |
|---|---|
| Wayfinder; the eighth Wayfinder | wayfinder, Way-finder |
| the Breach / the Temporal Breach; the Breach Clock; the thirtieth dawn | the Rift, the Tear (except "the tear" lowercase for the Apex's opening) |
| the Sundering / the Great Sundering; Year N "of the Sundering" | Year N AS |
| ley lines (two words, lowercase); ley-sense; ley-knot | leylines, Ley Lines |
| the Conflux / the Ley Line Conflux (present: Heartstone Depths; Before: the Conflux Chamber) | the Confluence |
| Heartstone (one word, capitalized); Heartstone Core; Stabilized Heartstone; Heartstone fragment (stable / dead) | Heart Stone, heartstone |
| the Nine / the Ninefold Circle; the Circle | the Nine Rival Mages (legacy lore phrase; keep only in legacy quotes), the Cabal |
| Veyran Thal (Archmagus); "the Holding" | Veyran Thall, Thal the Tyrant |
| Nyxaria Vell; Nyx | Nyxaria Vel, Nix |
| Oriel Danthe; the First Drowned; the Archives of Danthe | Oriel Dante |
| Maelis Korr; Haldric Vane; Durn Hallow; Seraphine **Aulde**; Imre Sallow; Tovren Masque | **Aldour** (every id: `loc_auldes_eyrie`, `item_auldes_spire_notes`; `echo_aldour_weavers` → `echo_spire_note`) |
| the Chronos Tyrant / the Tyrant; the Contained (Loop 1) / Unveiled (Loop 2+) Tyrant | the Chrono Tyrant; "the Tyrant" as a proper villain's name in Weaver mouths (they say "the Keeper of the Gate") |
| Echo (capitalized when it means persisted knowledge); `echo_*` ids | Echos; `echo.x` (prose only, never data) |
| the Threshold: the Still Shore, the Gallery of Loops, the Loom, the Far Light | the Shore (alone) |
| Resonance; Attunement; Corruption (0–6); Resolve (0–8) | "resolve 0–100", "Resolve 0–9" |
| Remnants of Aethelgard / the Remnants (`remnants`) | the Remnant |
| the Shadow Weavers / the Weavers (`weavers`) | `shadow_weavers` (id) |
| the Ironclad Nomads / the Ironclad / the Nomads (`ironclad`) | the Iron-Clad |
| "the Horde" (Brak, the Nomads); "the unraveling" (the Remnants); Unravelled (creature family); Horde Husk; the Unraveling Tide | the Hoard; Unraveled (creature) |
| Silverwood; the Whispering Ruins (outskirts and, colloquially, the whole ruin-field); Silverwood Plaza; the Shattered Library; the Sunken Archives; Heartstone Depths; the Crumbling Archway; the Darkened Corridor | Silverwood Ruins (as a place; it is the region) |
| Silverwood Before; First Bell / Second Bell / Last Bell (`flag_before_day_1..3`); the Plaza of Bells; the Ninefold Hall; the Apprentices' Garret; the Cistern Gardens; the Conflux Chamber; the Silver Gate; the Outer Walks; the Scholars' Corridor; the Grand Library of Silverwood | "Day −3 / −2 / −1" (STORY's older form; prose only) |
| Vane's Watch = the Blighted Outpost; the Spire Yard = the Plaza of Bells' east terrace; Hallow's Forge = his field-forge in the Conflux Chamber; Veyran's study and Masque's roof = the Ninefold Hall (events) | treating these as separate nodes |
| Hallow's Cairn = `loc_stormgate_cairns` (`ev_hallows_cairn`); the Ring of Wagons = Hearthring; the Hollow Choir = the Sanctum of Threads; the Bell Vault = the Bell-Warden's Deep; the Reed Maze = Sporelight Shallows; the Wind Stair / the High Mark = the Windward Stair; the Lightless Stair = the Stair of Unmaking; the Door of Pages = the Sunken Scriptorium; "Nyx's Cell" = Where She Fell | — |
| Where She Fell (the crater, Year 460) | "the Hollow" as her landing place |
| the Day of Teeth (Year 178); Corwen Blackreed; Blackreed's Axe | the Day of Tooth |
| Brak (formally "Brak of the Ironclad"); Brak Stonehand only at his death and in `echo_brak_death`'s title; Kaelen Stonehand | Brak Stonehand in dialogue |
| Keeper Ansel Dray (`npc_ansel_dray`); Keeper Avel Dray (Year 44) | Keeper Drey |
| Hadda Ironvow (`npc_hadda_ironvow`); Oma Varr; Tessaly Varr; Ketch; Scout Ferrin | Oma Varr as clan-mother |
| Sethe the Unlidded (`npc_sethe_unlidded`); Ysmay, the Thread-Mother; Hollis Cade (`npc_hollis_cade`) | Hollis Vane |
| Elder Wen Thistlecourt (`npc_elder_wen`); Elder Tam; Old Fennick; Mireya of Lanternreed | Elder Wren |
| Scribe Tamsin Reed; Sedge Marrow; Pellam | — |
| Captain Corvin Dreyl (Captain of the Silverwood Watch); Ilsabet Rhune, Warden of Waters; Hadrek the Clockwright; Tobrin Vask | "of the Nine" for any of them; "Master of Waters"; "Watch-Captain" |
| Gate-Captain Bryn Dunn (`npc_bryn_dunn`) | Hesper Dunn, `npc_hesper_dunn` (C-52) |
| Anso the Bellwright | — |
| Caelum Vesper; "Master Thal"; the noon message / the dusk message | "the message" without saying which |
| Dask, the Flickering Man; the Shimmering Pass | Dask the Flicker |
| Pell Ashcombe's Day-Count; "the thirtieth dawn" | Pel Ashcombe |
| Sael Orrin; Hesper Vayle; Ysolde Marr (the Taken); Rook Tallis | — |
| creatures: Corrupted Shade, Wildling Brute, Arcane Wisp, Drowned Archivist, Void-Touched Stalker, Stone-Hide Golem, Shimmering Phantom, Aetherial Weaver, Sky-Whisper Sentinel, Glowfen Mireling, Temporal Aberration (legacy names kept); families: the Hollowed, the Wilds, the Drowned, Wards, Spireborn, the Green, Watch-wardens, the Unravelled | Stonehide Golem; Glowfen Mireling as "Mireling" alone in codex titles |
| Dark Spellbook(s); Void Shard(s); Aetherium Shard(s); the Chronos Lens; the Echo Crystal; the Amulet of Echoes; the Breach-anchor (hyphen); Hallow's Cradle-Pin | Breach Anchor; cradle pin |
| the Litany of the Conflux; verses I–IX by title (The Witness, The Lesson, The Warding, The Cradle, The Spire, The Breath, The Eye, The Dark Between, The Holding) | numbered without titles in prose |
| communion; Movement I/II/III (`tyr_movement_1..3`); *Speak / Listen / Offer / Resist*; *Face it / Not yet*; *Let go*; *Keep the vigil* | "the talk fight" |
| closers: `closer_escape` (the Escape), `closer_fall` (the Fall; reasons `death` / `expiry` / `rejected` / `released`) | `fall_clock`, `fall_death`, `loop1_death`, reason `portal` |
| endings: A The Warden's Vigil, B The Mending, C The Weaver's Dawn, D The Iron Silence, E The Long Archive, F The Unbound (`ending_wardens_vigil`, `ending_mending`, `ending_weavers_dawn`, `ending_iron_silence`, `ending_long_archive`, `ending_unbound`) | — |
| "a game by Tim Dibert" (every ending screen, D-027) | — |

Style: STORY §15 (concrete nouns, short sentences, grave and strange, no gore; the banned-word list there applies to every new line in every document).

---

## 8. Rules of the world

| Rule | Statement | Source |
|---|---|---|
| **The loop** | Stepping through Ilyra's portal, dying from Loop 2, the Breach Clock expiring, or *Let go* returns the Wayfinder to Day 1 Dawn in the Whispering Ruins with memory intact. Loop 1's closers go straight to Loop 2 (no Threshold); from Loop 2 every closer and ending passes the Threshold. | D-002, D-049, D-066.7, D-067.14 |
| **What persists** | Echoes, codex, bestiary, map memory, achievements, class mastery, Resonance, Attunements, run history, quests started at the Threshold (D-067.15), and the Amulet of Echoes (D-047). | D-011, D-047, D-067.15 |
| **What resets** | Level (to ⌊0.6 × best level⌋, cap 10, with that level's ability points, D-067.2), stats, HP/MP, inventory, gold, Corruption, quests, flags, world state, companions and loyalty, faction reputation (start Echoes restore 20), merchant stock, the clock. Anchors reset too: they last one loop. | D-011, D-067.2, D-067.4 |
| **Echoes** | A discrete persistent fact with id, title, codex line and effects (dialogue, shortcut, route, ending eligibility, rep start, communion answer). STORY §12 is the catalog (103). Some are exclusive within a loop (the three Heartstone beats; lineage vs recoil; dammed vs let-run; Caelum unanchored vs stayed; forgives vs cannot). `echo_tyrant_jailer` needs two of five sources. | D-010, D-066.20, D-067.16; STORY §6.3, §12 |
| **The Breach Clock** | 30 days, four watches each; travel 1 watch, combat 0, short rest 1, full rest to the next dawn. Modifiers and floor per §2's "Breach Clock" row. Expiry starts the Horde from the Apex after three moves; the Library portal opens; reaching it is `closer_escape`, dying is `closer_fall` (`expiry`). Subtle in Loop 1 (NPC lines), explicit from Loop 2. | D-005, D-017, D-060, D-066.7/8; DESIGN §10.1–10.2 |
| **The Horde** | Runs whenever either Tyrant dies in combat (any loop) or the clock expires; node-by-node infection along the ley lines; crossing an infected node costs a third of max HP; infected nodes are `temporallyUnstable` while infected. Endings A, B, D, E never trigger it; C unravels the present by script. Brak dies at the Apex in a post-kill Horde unless kept away or redirected (`q_the_line_he_holds`). | D-060, D-017, D-059; STORY §8.6 |
| **Death** | Loop 1 outside a Horde: the FALLEN screen, reload (Echoes gained are still kept). Loop 1 inside a Horde, and any death from Loop 2: `closer_fall` (`death`). Companions are KO'd, not killed, except Brak at the Apex. | D-049, D-066.7; DESIGN §12.6 |
| **Silverwood Before** | Reached from Loop 2 by the Nexus door (Lens + verse 1) or the Apex tear (Tyrant spared, Resolve ≥ 3). A time-locked echo of First / Second / Last Bell, repeating; the Breach Clock is frozen inside and the Before keeps its own day counter, restarted on entry; resting at the Garret advances the day; Last Bell's dusk resets it to First Bell (one `q_stop_the_ritual` attempt per reset). Each return to the present costs one Breach-Clock day. Loot and XP in the Before are granted once per loop. Nothing changed there propagates except Anchors: only `anchorable` items (the Sky-Whisper Talisman, Hallow's Cradle-Pin, Litany Page 3) set on the cradle's rim appear in Heartstone Depths, this loop only. The ritual cannot be stopped. Caelum remembers resets; he joins after the noon errand and crosses by choice; the pin is set before he crosses. | D-016, D-066.9, D-067.4/5/9/10 |
| **Communion** | Against the Unveiled Tyrant from Loop 2, opened by `echo_tyrant_speaks` or the first *Listen*; it never attacks first. Resolve 0–8, starts 1. The hour presses for 8% max HP × (1 − Resolve/8) and cannot kill while Resolve ≥ 3. Speak +1 (Hallow's silence +2, Masque with `echo_ritual_inevitable` +2, honest "to kill you" +1, a lie −2, a second lie ends it); Listen +1 once per Movement (the next press unsoftened); Offer (never consumed): Lens +1, Stabilized Heartstone +1, Breach-anchor +2, Core −2; Support stance (Dask, Caelum) +1 once per Movement; below 30% HP every gain +1 more; attacking forfeits the question; first Resolve ≥ 4 in a loop: +2 days. Rejection only at the end of Movements II and III (Resolve < 3) or on a second lie: combat at Phase 2, or leave as `closer_fall` (`rejected`), next communion from Movement II. End of Movement III: Resolve ≥ 3 pass (the Before; F with `flag_refused_all_paths`); ≥ 6 with `echo_litany_complete` → A; 8 with `echo_litany_complete`, `echo_heartstone_resonance`, `echo_void_resonance`, `echo_anchor_mechanic`, the anchor, Trusted ×2, `flag_conflux_anchored`, `flag_cradle_pin_anchored` → B. | D-054, D-066.6, D-067.3; DESIGN §4.11; STORY §8.3 |
| **The Tyrant's strikes** | The Holding's reflex, not Veyran's will; from Loop 2 he holds it back from one who has crossed. Two Tyrant definitions: Contained (Loop 1, three phases, level-11 party) and Unveiled (Loop 2+, four phases). Killing either, in any loop, is the Horde and never a true ending. | D-051, D-067.12; DESIGN §4.10 |
| **The Apex** | Loop 1: six completed quests; *Face it / Not yet*; no autosave there or in a Horde. Loop 2+: `echo_apex_resonance` or six quests. Cannot be rested in; cannot be fled. | D-048, D-067.1 |
| **Dask** | Only on `temporallyUnstable` nodes; drops out on the Glowlands, rejoins at the Nexus; audible and recruitable from Loop 2 only. | D-059, D-066.12, D-068.2, C-09 |
| **Loop 1 scope** | The six legacy quests plus `q_blood_and_salt`, `q_bell_vault`, `q_lantern_in_the_reeds`, `q_high_mark`; everything else Loop 2+ (class mini-quests included). New regions are walkable in Loop 1; their givers say "Come back when you've seen more." | D-067.17; STORY §11 |
| **Who can be told what** | The Tyrant speaks only to one who has crossed the Breach (D-004); Dask can be heard only by the same (STORY §4.4); Oriel speaks to Ilyra's hands; Caelum remembers only within a loop; Ilyra believes the loop only with the watchword (earned in Loop 2, used from Loop 3) or in ending E. | D-004; STORY §4.4, §5.1, §7.6, §10.5 |
| **Companions** | One active, swapped at camps; stances; no MP, cooldowns; loyalty 0–100 resets per loop (bond Echoes start at 25); arc stage 2 at 25, stage 3 at 50 ("Loyal"); Trusted rider at 75. | D-013, D-053, D-066.12; DESIGN §12 |
| **Reputation** | Three tracks −100..100; tiers in §6.3; cross-faction costs −3/−5/−8 per chain quest; Sworn in one loop needs the chain plus most legacy choices; Loop 1 can reach Sworn with no faction (the Weaver chain opens in Loop 2). | D-014; DESIGN §11 |
| **Anchorable / Offer** | Only tagged items can be anchored; Offer never consumes an item. | D-067.3/4 |

---

## 9. Open continuity risks

| # | Risk | Where | Proposed ruling |
|---|---|---|---|
| 1 | **Schematic-half Echo ids.** STORY §12 adds `echo_anchor_half_a` and `echo_anchor_half_b` (REVIEW #2's ids) beside REGISTRY §6.2's 26 (which has only `echo_anchor_schema` and `echo_vask_seal`); the U9 WORLD brief told WORLD to use "those ids exactly". | STORY §12; WORLD §7.12, §3.2, §3.11 | Adopt STORY's two ids (D-062: Echoes are STORY's); `echo_vask_seal` stays the ward-seal Echo; Tobrin's gift and `ev_outpost_seal` grant both `echo_vask_seal` and `echo_anchor_half_b`. Record in D-069. |
| 2 | **Communion pressure numbers.** DESIGN §4.11 still reads `tyr_hour_presses` = 0.6·SP × (1 − Resolve/16) and makes Listen's cost a full `tyr_time_lash`; D-067.3 and STORY §8.3 say 8% max HP × (1 − Resolve/8), no kill at Resolve ≥ 3, Listen = the next press unsoftened. | DESIGN §4.11; WORLD §6.8 | DESIGN and WORLD adopt D-067.3 in their next pass. |
| 3 | **Masque's place in the Before.** WORLD §4 puts him on the Grand Library's glass roof Days 1–3; REVIEW #11 / D-067.10 put `echo_ritual_inevitable` on the Ninefold Hall's dome (`ev_hall_masque_roof`, Last Bell). | WORLD §4, §3.11; STORY §9.4 | He is on the Library roof on First and Second Bell and on the Hall's dome on Last Bell, reading the sky for the rite; `ev_hall_masque_roof` fires there. |
| 4 | **Aulde's place and the Spire Yard.** WORLD §4 has Aulde tuning the Spires from the Outer Walks' east terrace Days 1–2; STORY (per REVIEW #11) sets the Spire Yard on the Plaza of Bells' east terrace at Last Bell noon. | WORLD §4; STORY §7.6, §9.1 | Aulde works from the Outer Walks on First and Second Bell and comes to the Plaza's east terrace on Last Bell at noon to read the message; the errand ends on the Plaza. WORLD adds the Last Bell placement. |
| 5 | **Ilyra in Loop 1.** DESIGN §12.1 lists her recruitment as a Loop 1 condition; STORY §7.1 keeps her unrecruitable in Loop 1 (she must be at the Library for the legacy portal). | DESIGN §12.1; STORY §7.1 | STORY's rule (scenes are STORY's, D-062): Loop 2+. DESIGN adds "Loop 2+". |
| 6 | **Clock effects STORY dropped.** `q_preserve_or_heal`'s ±2 days and `q_bell_vault`'s −1 are not in DESIGN §10.1's table; STORY now has no clock effect on the dam and treats the Vault's day as time passing (`passWatches` 4), which DESIGN's `timeCost` list lacks. | DESIGN §10.1; STORY §11.3, §11.4 | DESIGN adds "Bell Vault descent: 4 watches pass" to its timeCost list; the dam stays clock-neutral. |
| 7 | **Gate-Captain's name.** STORY renames WORLD's `npc_hesper_dunn` display name to Bryn Dunn (C-52, S owns names); the id stays. | WORLD §4, §3.11 | WORLD adopts the display name in its next pass. |
| 8 | **New WORLD events STORY references.** `ev_fell_names` (the chalked names at Where She Fell), `ev_hollow_curtain`, `ev_hall_study_draft`, `ev_hall_masque_roof`, `ev_archives_oriel`, `ev_ridge_apex`, `ev_garret_litany`, `ev_tidewell_ledger`, `ev_orchard_brand`, `ev_library_cradle`, `ev_hallows_cairn`. | STORY §9, §11, §12 | WORLD defines any it lacks (`ev_fell_names` is new; the rest were proposed in REVIEW #11 / WORLD §13). |
| 9 | **`echo_crystal_seeded`'s effect.** REGISTRY left it for STORY to define; STORY §12 now says: from the next loop the Library's *Listen* yields `echo_nine_voices` whether or not the Crystal was kept. | STORY §12; WORLD `ev_library_cradle`; DESIGN §10.5 | DESIGN §10.5 records the effect as an S (shortcut). |
| 10 | **Class mini-quests are Loop 2+.** D-008 gives each class a mini-quest; STORY makes all five `{ loop: { min: 2 } }` to keep Loop 1 at the legacy size (D-067.17). | STORY §11.8 | Confirm, or open one (the Ranger's, in Mistwood) in Loop 1. |
| 11 | **`flag_tyrant_dead`.** STORY's ending-C block uses it ("the Tyrant alive"); REGISTRY §22 has no such flag. | STORY §10.3; WORLD `ws_horde` | Define `flag_tyrant_dead`, set when either Tyrant is killed (the same trigger as `ws_horde`'s kill branch). |
| 12 | **DESIGN §6.1's "focused Loop 3+ reaches 15–17"** was withdrawn by REVIEW #5 (adopted as D-067.2) but may still stand in DESIGN. | DESIGN §6.1 | DESIGN replaces it with "a focused Loop 3+ starts at ≤ 10 and reaches 12–14". |
| 13 | **Two old fires.** Hallow's ember (Year 0, the Emberforge, never out) and Hearthring's fire ("four hundred years", lit "from the last ember of the Burned Hall"). Not a contradiction, but writers conflate them. | STORY §2.7; WORLD `loc_hearthring` | Hearthring's fire was lit from the Emberforge's ember when the Nomads first ranged the Steppe (~Year 100); the Burned Hall is the Steppe hall that burned and was never rebuilt. Record in WORLD. |
| 14 | **Who sold Ashcombe's notes.** D-067.13 says "a Remnant diver"; Sedge Marrow is the Remnant diver who "sells to Weavers too, and says so". | WORLD §4; STORY §2.5 | Make it Sedge, one line in his stall dialogue from Loop 2 ("Ashcombe's hand? Sold it years back. Weaver paid in thread."). |
| 15 | **Wayfinder cadence vs D-007.** Gaps of 44 and 70 years fall outside "60–80". | D-007; STORY §2.8 | BIBLE states "roughly one per lifetime"; no id or date changes. |
| 16 | **Brak's arc rep.** STORY now uses DESIGN §11.2's +10 for `q_blood_and_salt` and telling the truth, and +5 for the oath; DESIGN §11.3's "+5 / +10 / +15" per arc stage is a budget, not a per-quest rule. | DESIGN §11.2–11.3; STORY §11.4 | DESIGN's magnitudes stand; no change needed unless DESIGN wants +15 on `q_the_line_he_holds`. |
| 17 | **Nyx's "Hostile" and the C requirement.** STORY's C block requires Nyx active and loyalty ≥ 50; a Nyx made Hostile by telling Sethe leaves the party for the loop, which the block covers implicitly (she cannot be active). | STORY §7.3, §10.3 | No change; note that `flag_nyx_hostile` is the implementation flag if one is needed. |
| 18 | **Sworn in Loop 1.** DESIGN §11.3 says "In Loop 1 only the Weavers can [reach Sworn] (via `q_hollow_choir`)"; D-067.17 moved `q_hollow_choir` to Loop 2, so no faction reaches Sworn in Loop 1 (Weaver legacy choices max +45). | DESIGN §11.3; STORY §11.1 | DESIGN §11.3's sentence becomes "In Loop 1 no faction reaches Sworn, which is intended." |
