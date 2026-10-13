# REVIEW-CROSS — cross-document consistency review (U5)

Reviewer: continuity editor, brief `docs/briefs/review-cross.md` (with the U5 updates: WORLD §1–13 complete; STATUS
open questions folded in). Inputs at commit `410ca26`: DECISIONS (X, canon), STORY (S), DESIGN (D), WORLD (W),
PLAN (P). Every id of every prefix was extracted from all five documents by script and compared; WORLD §13's
author errata (04-06 E1–E14, 07-09 A.1/E-1–E-15, 10-12 W1–W14) are folded in and not rediscovered. The companion
file `REGISTRY-DRAFT.md` holds the canonical id for every entity; this file explains the disagreements and rules on
them. Precedence: D-062 (X > S for people/names/dates/events/quests/Echoes/scenes/codex/endings > D for
systems/numbers/abilities/statuses/materials/item mechanics/attunements/achievements > W for places/regions/
creatures/NPC ids/placement > P), D-063 (the Nine), D-064 (NPC roles), D-044 (ids).

## 1. Summary

**State.** The five documents agree on the story spine: the Nine (S §2.2, now also W §4–6), the loop, six endings
plus two closers, 73 locations, the Heartstone choice and its clock deltas, the faction tiers, the ages and dates of
D-025, the nine-verse Litany, the two Tyrants of D-051 and their stats (D and W match to the point). They disagree on
three things, in descending cost:

1. **Loop-closing rules.** DESIGN and PLAN pre-date D-047/D-049/D-054/D-060 and still describe a scripted
   clock-expiry Fall, a Threshold visit after Loop 1, an Amulet that resets, and a 0–100 communion meter. STORY
   predates D-054 (Resolve 0–9) and D-060 (`closer_escape` "Loop 1 only"). These are the four blockers.
2. **Ids.** PLAN uses no prefixes at all (Appendix A, code samples, `{ echo: 'litany_verse_1' }`). DESIGN coined
   its own Echo catalog (≈66 ids, 50 not in STORY), quest ids (`quest_*`, unprefixed legacy ids), `rng_`, `dmg_*`,
   `comp_<companion>` and placeholder NPCs. WORLD added 25 Echoes and a handful of aliases (`shadow_weavers`,
   `aldour`, `anomaly_*`). 231 rename actions are listed in the registry; all are mechanical once the registry is
   accepted.
3. **Numbers owned by DESIGN but restated elsewhere.** PLAN §4.10 has a different combat model (hit, crit, flee,
   initiative, statuses, XP curve, level-up gains, restock); STORY puts its own XP and rep values on quests; WORLD §0
   restates pre-DESIGN creature formulas. DESIGN wins in each case; DESIGN must in turn re-cut its rep budget to
   STORY's quest structure.

**Conflict count: 58** — **4 Blocker · 19 Major · 26 Minor · 9 Nit.**

**Registry sizes** (REGISTRY-DRAFT §0): 12 regions · 73 locations · 38 NPCs (+1 placeholder to remove) · 6
companions · 3 factions · 5 classes · 55 quests (44 + 6 stretch + 5 class quests to add) · 101 Echoes (75 STORY + 26
to add; 81 mapping rows for every non-STORY id: 41 map, 23 add, 14 remove, 3 PLAN/prose) · 85 codex · 20 scenes · 6
endings + 2 closers · 57 creatures + 16 anomaly variants · 100 abilities (75 class, 24 companion, 1 item) · 19
statuses · 12 affixes · 26 materials · 134 items (157 with materials, Chronal Dust counted once) · 30 recipes · 15
attunements · 40 achievements · 6 modifiers · 22 screens · 30 sfx · 32 flags.

**The ten resolutions that matter most** (details below):
1. C-01 Clock expiry runs the Horde (D-060); DESIGN's scripted Fall and `fall_clock` go.
2. C-02/C-06 Loop 1 → Loop 2 skips the Threshold (D-049); `closer_escape` covers every portal flight in every loop.
3. C-03 Communion is D-054's Resolve 0–8 (≥3 pass, ≥6 A, 8 + Echoes + anchor B) with WORLD §6.8's conversions;
   rejection checked at the end of Movements II and III only; opened by `echo_tyrant_speaks`.
4. C-04 Breach-anchor: no gold fee, rep gate waived during `q_the_mending`/`q_iron_silence`, `echo_void_resonance`
   moves from the recipe to the B consent, so ending D needs no Weaver loop; each Heartstone choice yields 2 fragments.
5. C-05 The Amulet never resets (D-047).
6. C-13 STORY §12 stays the Echo catalog: 41 DESIGN/WORLD ids map onto existing STORY Echoes, 26 are added, 14 are
   removed (bestiary and map-memory bookkeeping), per REGISTRY §6.
7. C-17/C-18 PLAN is rewritten to D-044 ids and DESIGN's numbers (XP table, combat formulas, dawn restock, StatName).
8. C-09/C-10 Dask: Loop 2+ only, and only on D-059's flagged locations.
9. C-12 WORLD finishes D-063: "Master of Waters … of the Nine" → Warden of Waters; Aulde ids renamed; Dreyl/Hadrek
   fixes.
10. C-19 Creature lore follows WORLD's eight families; STORY's six creature codex entries are re-cut to match.

---

## 2. Conflicts

Format: **C-nn · Severity · title.** *Where* (doc §, quote). → **Canonical** resolution, with the ruling it rests on.

### Blockers

**C-01 · Blocker · Clock expiry: scripted Fall vs the Horde.**
D §10.2: "Scripted, no fight, ~40 seconds: the sky tears … → Threshold with `closer: "fall_clock"`." D §10.1 table and
§16.6 also forecast a "Fall". P §4.11: "`endLoop('clock')` → closer `fall`". X D-060: "Whenever the Tyrant dies in
combat (any loop) **or the Breach Clock expires**, the legacy node-by-node infection runs and the loop closes by portal
(`closer_escape`) or death (`closer_fall`)." S §4.3 agrees with D-060 (the Horde spreads, Ilyra tears her portal).
→ **D-060.** Expiry starts the Horde from the Apex; closing by the Library portal is `closer_escape`, dying is
`closer_fall` (`reason: "expiry"` when the death follows expiry). Adopt W §13.7 X2 (3-move Horde delay for
expiry-Hordes) so no node is a death trap. D §10.2, §10.1 warnings, §16.6, `ach_the_fall` and P §4.11 are rewritten.

**C-02 · Blocker · The Threshold after Loop 1.**
D §10.2 "In Loop 1 this is the alternate route to Loop 2 … → Threshold"; P §4.11 "`enterPortal` … → closer `escape` →
Threshold"; P §1.2 gate "every class finishes Loop 1 (reaches the Threshold by portal)"; P §1.3 Playwright "Tyrant →
portal → Threshold"; D `ach_the_escape` "reach the Threshold by the portal". X D-049: "The Loop 1 → Loop 2 transition
skips the Threshold"; S §4.2 agrees.
→ **D-049.** Loop 1 closers wake the player in the Whispering Ruins; the Gallery shows Loop 1 retroactively. P's
completion gate becomes "reaches Loop 2"; the e2e flow visits the Threshold at the end of Loop 2.

**C-03 · Blocker · Communion scale, thresholds and rejection.**
D §4.11: "`resolve` (0–100) … each Litany verse Echo +25 … `resolve ≥ 100` → … `tyr_stillness`"; S §8.3: "a
**Resolve** meter (0–9) … Reaching the end with Resolve ≥ 6 unlocks the outcome branches; below 3 the Tyrant rejects
you", with "Let you pass (always)". X D-054: "integer, 0–8 … ≥3 the Tyrant lets you pass (F possible); ≥6 it
consents to release or replacement (A); 8 with `echo_void_resonance`, `echo_heartstone_resonance` and the
Breach-anchor in hand enables the Mending (B)." W §6.8 implements D-054 and proposes conversions (W §13.5 Q4).
→ **D-054**, with W §6.8's numbers adopted into D §4.11: Speak = the matching Echo answers (+1, Hallow's silence +2,
`echo_ritual_inevitable` +2, a lie −2); Listen +1 once per Movement; Offer Lens +1, Stabilized Heartstone +1,
Breach-anchor +2 (sets `flag_anchor_offered`), Heartstone Core −2; Support stance (Dask, Caelum) +1 once per
Movement; "tired" +1 below 30% HP or in Phase 4; Tyrant damage × (1 − Resolve/16). Rejection is checked at the end of
Movements II and III only (STATUS open question; Movement I cannot reach 3 without a perfect run), or on two lies.
`tyr_stillness` and `echo_tyrant_communion` are removed. S §8.3 "0–9" → "0–8"; "Let you pass" requires ≥3.

**C-04 · Blocker · Breach-anchor gates can lock endings B and D.**
D §8.5 `recipe_breach_anchor`: "300 | trusted | `echo_anchor_schema`, `echo_void_resonance`"; D §9.6 rule 5 says no
ending requires gold; X D-018 B needs "Trusted with at least two factions" (not Ironclad specifically); D ending
**D** needs the anchor (X D-018) but X lists no Weaver condition, while the recipe's `echo_void_resonance` is "obtainable
only by having been Trusted with the Weavers in some loop". S `q_the_mending` adds `echo_iron_that_does_not_wish`
(Borin). W §13.6 OQ2–OQ4.
→ Fee **0**; rep gate **Neutral** while `q_the_mending` or `q_iron_silence` is active (W OQ2). Recipe requires
`echo_anchor_schema` (new, REGISTRY 6.2: read both schematic halves in one loop) and the quest stage requires S's
`echo_iron_that_does_not_wish`. `echo_void_resonance` leaves the recipe: it is checked at the B consent (D-054 already
requires it), so a dead-fragment anchor for D needs no Weaver loop. Each Heartstone choice yields **two** fragments
(W OQ4; see C-14) so Mireya's dam (D-052) and the anchor fit in one loop.

### Major

**C-05 · Major · The Amulet resets in DESIGN.**
D §10.3: "Discard … inventory (including the Amulet — it is re-collected on Day 1)". X D-047: "the single exception
to D-011's inventory reset: the Amulet returns on the Wayfinder's neck at Day 1 of every loop from Loop 2"; S §4.2; P
§4.11 already conforms. → **D-047.** D §10.3 and `resetInvariant.test.ts` list the Amulet as kept; it grants
`itm_echo_bolt` (add to D §5.7, REGISTRY §11).

**C-06 · Major · `closer_escape` is "Loop 1 only" in STORY.**
S §10.7: "`closer_escape` — The Escape (Loop 1 only)"; "`closer_fall` … Reasons: `death`, `expiry`, `rejected`,
`portal`". X D-060: the Horde loop "closes by portal (`closer_escape`) or death (`closer_fall`)" in any loop; W
`g_library_portal` (Loop 2+) "ends the loop (`closer_escape`)". D uses `fall_clock`/`fall_death`; P `escape`,
`fall`, `loop1_death`. → **D-060**: `closer_escape` = any portal flight; `closer_fall` + `reason` ∈ `death` |
`expiry` | `rejected`. Loop 1 death is the FALLEN screen recorded as `closer_fall`/`death` (D-049). REGISTRY §9.

**C-07 · Major · Communion is opened by different Echoes.**
D §4.11 "Available … when the player holds `echo_tyrant_jailer`"; S §8.3 "with `echo_tyrant_speaks` (or the moment the
player chooses *Listen*)"; W §3.5 "with `echo_tyrant_true_name` or `echo_litany_verse_1`". → **S** (Echoes and scenes,
D-062): `echo_tyrant_speaks` or the first Listen; from Loop 2 the Tyrant never attacks first (W §13.4 W5). D also gives
`echo_tyrant_jailer` free at "Loop 2 start" — drop; S's sources stand.

**C-08 · Major · `echo_void_resonance` source.**
D §10.5: "Nyx teaches it at the Veil sanctum when Weavers ≥ Trusted and (Heartstone exploited this loop or Weavers
Sworn) … `exclusiveWith: echo_heartstone_resonance` in the same loop unless Sworn"; D §13.3 example uses
`loc_veil_sanctum` and `flag: "heartstone_exploited"`. S §12: "Weavers Trusted in some loop: Nyx
(`q_what_she_would_undo` refused-with-truth) or Sethe (`q_unlidded_eye`)"; X D-018 matches S. → **S/D-018.** The
Exploit condition and the exclusivity go (they would force B players through a C-leaning loop).

**C-09 · Major · Dask recruitable in Loop 1.**
D §12.1 `comp_dask`: "Loop 2+, or Loop 1 with Chronos Lens equipped". S §4.4: "glimpsed in the Shimmering Pass in
Loop 1 but not spoken to until Loop 2 … the same rule that governs the Tyrant's speech (D-004)". → **S.** Loop 2+.

**C-10 · Major · Where Dask may stand.**
D §12.8: `allowedRegions = ["region_highlands", "region_glowlands_nexus", "loc_temporal_breach_apex",
"region_threshold", "region_silverwood_before", "region_skyreach"]`. X D-059 flags "every location in Aether-Kissed
Highlands, Skyreach, The Chronos Nexus, The Temporal Breach Apex, all of Silverwood Before, all of the Threshold, plus
any Horde-infected location"; W §12.3 implements it (Veridian Glowlands unflagged; W X8). S §3.3: "the Highlands,
Nexus, Apex, Threshold". → **D-059**: D §12.8 reads the `temporallyUnstable` flag instead of a region list; Dask drops
out on the Glowlands and returns at the Nexus unless the lead amends D-059 (W X8).

**C-11 · Major · Who cleanses Corruption, and where.**
X D-017 "unless cleansed at Lanternreed"; D §6.7 "cleansed at Lanternreed (Mireya: one full rest + Glow Moss ×3 …
sets `flag_cleansed_lanternreed`)"; `ach_cleansed` "Lanternreed Light". X D-064: "Glowfen elder who cleanses
Corruption at the Breathing Pool: **Elder Wen Thistlecourt**"; W §4 `npc_elder_wen` at `loc_breathing_pool`. → **D-064**
(later than D-017): Elder Wen at `loc_breathing_pool`; D's cost (one full rest + Glow Moss ×3) stands; flag
`flag_corruption_cleansed`; `echo_lanternreed_cleanse` removed.

**C-12 · Major · WORLD §1–3 still carries the alternative Nine in places (D-063).**
W §2.7: "the Master of Waters, Ilsabet Rhune **of the Nine**, opened the cisterns"; §3.6 `ev_tidewell_ledger` "the
Master of Waters"; §3.6 Bell-Warden "a Master's chain of office"; §3.11 `loc_cistern_gardens` and `ev_gardens_wheels`
"The Master of Waters"; §3.11 "NPCs: none (Ilsabet Rhune appears as an event figure only)" while §4 defines
`npc_ilsabet_rhune`; §3.11 `npc_hesper_dunn` "Watch-Captain; quest giver" (she is Dreyl's gate-captain); §3.11
"Hadrek's chair" (it is Masque's); §7.13 `item_dreyls_pyre_ledger` "The Watch-Captain's record" (Dreyl is Captain);
`echo_aldour_weavers` (§3.10). STORY §2.2 and W §4–6 already conform; D names only Korr. → **D-063**, applying W
§13.2 E3–E7 verbatim; `echo_aldour_weavers` maps to S's `echo_spire_note` (D-063 allows it: S has the equivalent).

**C-13 · Major · DESIGN and WORLD Echo catalogs diverge from STORY §12.**
S §12 has 75 Echoes; D §10.5 ≈66 ids of which 50 are not in S; W uses 25 not in S (8 of them gate Echoes, W §13.4 W3).
Same fact, different ids: `echo_nyx_is_nyxaria`/`echo_nyx_true_name` = `echo_nyx_is_of_the_nine`;
`echo_tyrant_true_name` = `echo_tyrant_name`; `echo_wayfinder_lineage` = `echo_seven_wayfinders`; `echo_dask_name` =
`echo_flickering_man`; `echo_conflux_ritual_fails` = `echo_ritual_inevitable`; `echo_anchor_principle`/`_rule` =
`echo_anchor_mechanic`; `echo_golem_warder` = `echo_stone_hide_origin`; `echo_maelis_hand` = `echo_korr_marginalia`;
`echo_brak_saved` = `echo_brak_lives`; `echo_kaelen_brother` = `echo_brak_birth_name`; `echo_fall_witnessed` =
`echo_thirtieth_dawn`; `echo_the_loop` = `echo_amulet_memory`; `echo_drowned_sluice`/`echo_cistern_crack` =
`echo_archive_door`; `echo_skyreach_song`/`echo_breath_of_heights` = `echo_high_mark`; ending records = `echo_ending_a..f`.
→ **D-062**: REGISTRY §6.3 maps every one (41 map, 26 ids added to S §12 with proposed title/source/effect, 14
removed: bestiary-reveal Echoes become bestiary rules, map-reveal Echoes become map memory, duplicates of
Attunements go). Lean option for the lead: the five `*_bond` Echoes and three gate-convenience Echoes could be engine
rules instead (−8).

**C-14 · Major · One Heartstone fragment, two consumers.**
X D-052: one fragment feeds either `recipe_breach_anchor` or Mireya's dam; S `q_preserve_or_heal` and `q_the_mending`
can fall in the same loop (B/E loops need both). S §16 Q8 still describes the dam as needing "a Stabilized
Heartstone". → Each Stabilize/Destroy yields `item_heartstone_fragment_stable`/`_dead` ×2 (W OQ4; STATUS); S §16 Q8 and
`q_preserve_or_heal` text adopt D-052 (either fragment).

**C-15 · Major · Class mini-quests exist only as DESIGN ids.**
X D-008: "Classes also change a handful of dialogue lines and one unique mini-quest each." D §10.9:
`quest_class_ranger` … `quest_class_weaver`. S §11 has none; X D-045 counts 44 without them. → S §11 adds
`q_class_ranger`, `q_class_wizard`, `q_class_elf`, `q_class_ironclad_warden`, `q_class_shadow_weaver` outside the 44
(D-045 unaffected); D renames.

**C-16 · Major · Quest XP and reputation budget.**
S puts XP on quests (`q_echo_crystal` 60, `q_lost_scroll` 70, `q_clear_path` 50, `q_blighted_outpost` 80,
`q_void_shards` 90, `q_keepers_ledger` 180, `q_hollow_choir` 160, `q_unlidded_eye` 240, `q_day_of_teeth` 260); D §6.2:
legacy 120/150/120/220/260 (+ heartbeat 400), "faction chain 150/250/400; companion arc 150/250/400; regional
200–350; loop-only 300; ending quests 600". Rep: S `q_lost_scroll` "to Nyx: Weavers +15, Remnants −15" (absent in D
§11.2); D `lost_scroll` and `blighted_outpost` "Weavers −3" (absent in S); D §11.3 budgets "+10 / +15 / +20" for
**three new** chain quests per faction and "Ilyra 3 × +5", but S has **one** new chain quest per faction (e.g.
`q_keepers_ledger` +25/+10) and companion arcs at +5/+10/+15. → **D owns magnitudes, S owns which choices exist**
(D-062). S quest blocks drop XP numbers (D §6.2 tiers apply); D §11.2 adds S's choices (scroll-to-Nyx) and D §11.3 is
re-cut to S §11's structure, re-checking that Sworn (60) is reachable for each faction in one loop.

**C-17 · Major · PLAN uses no D-044 ids.**
P Appendix A (regions `highlands`, locations `whispering_ruins`, creatures `corrupted_shade`, items `rusty_dagger`,
NPCs `kaelen`/`borin`, classes `warden`/`weaver`, quests `echo_crystal`/`lost_scroll`, endings `vigil`, closers
`escape`/`fall`/`loop1_death`, merchants `respite_trade`, Echoes `crystal_location`), §5.8 statuses `'bleed'…`, §13 Q1
"`{ echo: 'litany_verse_1' }`", §4.2 `StatName = 'str' | 'mag' | 'agi'`. X D-044 overrides P ("PLAN.md … must be
revised to this"). → **D-044**; every row of REGISTRY gives P's replacement. Companion id ≠ NPC id (`ilyra` /
`npc_ilyra`). Merchants keyed by NPC id (W §9).

**C-18 · Major · PLAN's combat and progression model differs from DESIGN's.**
P §4.10: hit `clamp(70 + 2·atkAgi − 1.5·defAgi, 25, 97)`, spells always hit; crit `clamp(5 + 0.5·agi + weaponCrit, 5,
50)`; flee `clamp(50 + 2·agi − 4·maxEnemyAgi − 15·fleeAttempts, 5, 95)`; initiative `agi + rng.int(0,3)`, haste +4 /
slow −4; mitigation `def` and `magicResist`; `armor_break` ×1.25 physical; `mark` +20 hit and crits ignore def; `curse`
outgoing ×0.85; extra interplays "fire on bleed → +1 burn", "physical on shock → +10 hit"; Wizard "+5 MP per turn
start"; XP `100 + 25·(level−1)`, level-up "+10 hpMax, +5 mpMax"; `restockEveryDays: 3`. D §3.2/§4/§5/§6: hit
`clamp(accuracy − evasion, 50, 100)` with accuracy `85 + ⌊AGI/2⌋` (+10 spells); crit `5 + ⌊AGI/2⌋`, cap 60; flee
`clamp(40 + 3·AGI − 2·maxEnemyAGI, 10, 90) + 15·failed` (P **subtracts** per attempt, D **adds**); initiative AGI + d4
rolled once, Haste +5 / Slow −5; armor/ward flat; Armor Break +15%; Mark +15% and cannot miss; Curse DoT and heals ×0.5;
Wizard 10% max MP per turn; DESIGN XP table; class growth per D §3.3; restock every dawn. X D-056/D-057 already rule.
→ **D** everywhere; P §4.10/§5.16 `GameConfig` carry D's tables. P's two extra interplays are dropped unless D adopts
them.

**C-19 · Major · Creature lore: STORY codex vs WORLD families.**
S §14 `codex_creatures_vanes_wards` "Golems **and Sentinels**: built to guard"; `codex_creatures_leywarped` "Shades,
Wisps, Brutes: wild magic on living shapes"; `codex_creatures_breachborn` "Phantoms, Aberrations, the Unravelled". S
§2.2 itself: "Korr's students became Corrupted Shades … Masque's watch-wardens flicker as Temporal Aberrations". W §5:
eight families with one maker each — Shades are Hollowed (Korr/Vell), Sentinels and Wisps are Spireborn (Aulde),
Phantoms and Aberrations are Watch-wardens (Masque), Brutes are Wilds. D §8.2 has eleven material "families". → **W**
(creatures, D-062) and S §2.2 agree; S's six creature codex entries are re-cut to W's eight families
(`codex_creatures_<family>`, S count 85 → 87 or two other entries merged); D §8.2 families stay as material kin under
W §5's mapping.

**C-20 · Major · Breach Clock modifiers and warnings.**
D §10.1 table: "Anchor the Conflux (`quest_anchor_the_conflux`) +3 days"; "Tyrant communion reaching resolve ≥ 50 …
+2 days"; S `q_day_of_teeth` "she sends scouts east; **Clock −2**" (not in D); P §4.11 `clockWarning` "at 10/5/3/1 days
left" vs D warnings on Days 20/25/28/29. W §10.10: a Loop 1 Destroy (limit 20) makes the thorough Loop 1 miss the
Apex; Ending E fails under Frayed Clock. → D owns the table: Anchor +3 attaches to `q_the_mending` stage
`anchor_the_conflux`; add S's −2 for `q_day_of_teeth`; communion +2 at Resolve ≥ 4; P's warnings follow D's days. W
§10.10's two proposals (a Loop 1 Destroy warning line; a `{clock:{daysLeft}}` atom for E) go to U8 with a lead ruling.

**C-21 · Major · Fled fixed encounters (pacifist completability).**
D §4.7: on flee "the encounter remains at the node with its current HP … until the next dawn". W §10 R10-1/X1:
per-encounter `onFlee: scatter|hold` — "pacifist play is impossible past any 100% fixed group" otherwise. X D-037
requires every quest/location reachable by bots including `pacifist`. → Adopt W's `scatter` (forfeit XP/loot, +2
watches) into D §4.7 for non-boss fixed groups; bosses and story gates stay `hold`.

**C-22 · Major · STORY quest level bands vs region bands.**
S §11 bands are "proposals for WORLD.md": `q_hollow_choir` 7–10 and `q_lightless_stair` 7–10 in the Veil (10–14);
`q_high_mark` 9–12 in the Skyreach (12–15); `q_bone_road` 5–8 on the Steppe (7–11); `q_tears_of_the_breach` 4–8 into
the Veil; `q_lantern_in_the_reeds`/`q_the_drowned_lantern` 7–10 in the Glowfen (8–12). X D-056 fixes region bands. →
**D-056.** S quest bands are replaced by the band of the region where each stage happens (W §10 confirms fights).

**C-23 · Major · Echo titles and sources for shared ids.**
Same id, different title (14: e.g. `echo_breach_clock` S "The Breach Clock" / D "The Thirtieth Dawn";
`echo_ilyra_watchword` S "The Ink Still Holds" / D "Ilyra's Watchword") and different sources that change gating:
`echo_ilyra_watchword` S "`q_voices_in_the_stacks`" vs D "Loop 1 portal scene"; `echo_breach_clock` S
"`q_the_thirtieth_dawn`; or `q_high_mark`" vs D "The Fall, or Dask"; `echo_litany_complete` S "Hold all nine" vs D "…
and `echo_tyrant_name`"; `echo_crystal_location` S "Take the Crystal once" vs D "complete `echo_crystal` once". →
**S** for titles and sources; D keeps the mechanical effects (rep starts, discounts) where S is silent. W's extra
sources (Litany pages 1/2/3 → verses 1/8/3, `ev_garret_litany` → verse 2, `ev_hall_veyran` → `echo_tyrant_name`,
`item_warder_plate` → `echo_stone_hide_origin`, `ev_ridge_apex` → `echo_breach_clock`) are added to S §12.

### Minor

**C-24 · Minor · Apex gate wording.** P §13 Q3: `{ counter: { name: 'legacy_quests_completed', min: 6 } }, { echo:
'apex_path' }`. X D-048: `quests_completed` and `echo_apex_resonance`; W `g_apex` conforms; D `ach_six_quests`
"complete 6 quests in Loop 1" conforms. The `counter` atom is used by D-048 but absent from X D-033 and P §4.9. →
D-048; add `counter` to the condition language.

**C-25 · Minor · Level bands in PLAN.** P §13 Q8 proposes Ruins 1–3 … Before 8–10. → D-056 (P text withdrawn).

**C-26 · Minor · Restock.** P `restockEveryDays: 3` / §13 Q7 vs X D-057 "every dawn". → D-057.

**C-27 · Minor · DESIGN id deviations (mechanical).** `rng_*` ×15 (X D-061 → `rgr_`); `fireball`, `lightning_bolt`,
`echo_bolt` (→ `wiz_*`, D-044); `dmg_*`; companion ids `comp_ilyra` etc. (→ plain ids; `comp_` is for companion
abilities); `quest_*` and unprefixed legacy quest ids; region ids `region_mistwood_ironclad`, `region_highlands`,
`region_the_veil` (W §13.4 W14); creature ids `chronos_tyrant_*`, `nine_shard`, `wildling_brute`; `key_sluice`;
codex `codex_the_nine`, `codex_wayfinders`, `codex_sundering`; `ach_first_loop`; `npc_*` merchant placeholders;
`screen_gallery`/`screen_loom`/`screen_far_light` vs §16.3's `screen_threshold_*`; `recipe_stormjar` vs
`item_storm_jar`. → REGISTRY rows.

**C-28 · Minor · WORLD id deviations.** Faction `shadow_weavers` (W §0, §3 rep conditions; E10); `npc_hollis_vane`,
`npc_elder_wren` (§3, E1/E2); `q_herd_of_one` (§3.7, W2); `mat_glow_spore`, `mat_lantern_resin`, `mat_conflux_dust`,
`item_gale_feather`, `item_nyxarias_quiet` (W §13.3 A.1); `anomaly_*` (§10.2) and `g_*` gates (§11.3) use prefixes
outside D-044. → REGISTRY; `anomaly_*` → `cr_anomaly_*`; `g_*` → `gate_*`; record `fam_`, `pool_`, `gate_`, `ws_` in
D-044.

**C-29 · Minor · Aldour vs Aulde.** W ids `loc_aldours_eyrie` (17×), `item_aldours_spire_notes`, `echo_aldour_weavers`;
display names already "Aulde's". W §13.2 E4 recommends renaming, W §13.3 E-12 keeps ids stable. STATUS: "should become
`loc_auldes_eyrie`". → Rename (ids are unshipped; D-063's spelling). REGISTRY §3, §15.

**C-30 · Minor · D-064 placements missing in WORLD §3.** §3.7 `loc_hearthring` "npc_oma_varr (clan-mother, quest
giver)"; Ansel Dray absent from `loc_shattered_library`; Sethe absent from `loc_sanctum_of_threads`. W §4 is already
correct. → Apply W §13.2 E8.

**C-31 · Minor · Merchants.** D §9.4 places an Ironclad quartermaster at the Camp from Loop 1, a Remnant archivist
stall at the Library, a Skyreach outpost and a 20 g Skyreach inn; W: the Camp sells nothing until
`flag_hearthring_caravan` (Borin carries core stock, E-1), Tamsin at the Plaza (E-4), no Skyreach merchant (OQ8). → W
placement (D-062). D §9 adopts W §9's eight merchants; drop the Skyreach merchant and inn unless W §4 adds one first.

**C-32 · Minor · Creature number rules.** W §0: "fodder HP ≈ 10×level + 20, elite ×2, boss ×6–8; Attack ≈ level + 6 …
Defense ≈ level/2"; W §4–6 conventions use "10L + 20" and "DEF total ≈ L/2". D §6.5: "`hp ≈ 22 + 9·L` ± 20%; ATK
`≈ 5 + 1.5·L`; armor `≈ L/3` … Regional bosses sit 2 levels above their band's top". W's six regional bosses all sit
**one** level above (Bell-Warden L9 for 4–8, Ashmaw L12 for 7–11, Lantern Matron L13 for 8–12, Vell's Umbra L15 for
10–14, Stormcrown L16 for 12–15, Unbroken Warden L18 for 13–17). Boss HP ×3.5–4.5 (W Q1; D's Tyrants ×3.6/×4.5;
STATUS "likely accept"). → D's formulas; boss HP ×3.5–4.5 recorded in D §6.5; W §0 fixed (E13). Boss level: D's +2
stands by precedence; recommend U8 amend D to +1, since W's bosses were tuned to D §19's 10–14 turns at +1.

**C-33 · Minor · Contained Tyrant thresholds.** S §8.4: Phase 2 "65–31%", Phase 3 "≤30%", "Damage taken ×1.5"; D
§4.10: "<66%", "<33% or turn 14", no damage-taken multiplier; W §6.8 uses D's thresholds and keeps ×1.5. → D's
thresholds; ×1.5 kept provisionally pending sims (W Q5).

**C-34 · Minor · Tyrant phase ids.** X D-054 ties communion Movements to combat phases (`tyr_movement_1..3`); X D-051
names the Contained phases "The Holding / The Fracture / The Nine Speak"; D §4.10 names the Unveiled phases "Lament /
The Nine Surface / Chrono-Strike / The Hold Fails" and D §20 Q10 asks for renaming; D `tyr_stillness`. → Phases 1–3 of
both Tyrants use `tyr_movement_1..3` (D-051 names; "Lament" etc. as Unveiled subtitles); Unveiled Phase 4 =
`tyr_phase_4`; `tyr_stillness` removed. W's moves (`tyr_brace`, `tyr_korr_burns`, …) adopted by D §4.10 (they implement
S §8.4). REGISTRY §10.3.

**C-35 · Minor · Unveiled Phase 2 adds.** D §4.10: "spawn 2× `nine_shard` (each casts one dead mage's spell; 90 HP)";
W §6.8: 2× `cr_tyrants_reach`, "one more each time one dies, max 2 alive and 5 in total". → W id and spawn rule
(creatures, W); D owns the HP.

**C-36 · Minor · Oriel's carrel.** S §13 `scene_the_first_drowned` "Oriel's carrel, Drowned Reach" and §12
`echo_oriel_drowned` "discovery at Oriel's carrel"; S §11.1 `q_the_first_drowned` region "Sunken Archives"; X D-046
"guards the Scholar's Lost Scroll … the First Drowned"; W `cr_drowned_archivist` "in the carrel under the east stair"
of `loc_sunken_archives`. → The carrel is in `loc_sunken_archives` (D-046); S §13 header fixed. The Drowned Reach
boss stays the Bell-Warden (STATUS; W Q3).

**C-37 · Minor · STORY place names and Hallow's death.** S place names map to W nodes per W §11.5; two are unmapped:
"Nyx's Cell" (S `q_the_dark_between`, "a wall of nine names, eight crossed out") → `loc_where_she_fell` + an event
(proposal); "the Bell Vault" → `loc_bell_wardens_deep`. S §2.2 says Hallow "died on the Barren Peaks carrying a
forge-ember north" yet his trace is "Hallow's Cairn on the Ashen Steppe" and the codex says the Cairn is "where the
smith died with the ember still lit". → He died at the Cairn (`loc_stormgate_cairns`, `ev_hallows_cairn`) after
crossing the Peaks; S §2.2's fate line is fixed.

**C-38 · Minor · `q_lightless_stair` start.** S: "at the bottom of the Chasm", and `q_hollow_choir` follows without
Weavers Trusted; W has no Chasm→Veil edge and gates the curtain at Trusted. → W §13.4 W12: start at the Hollow's
curtain; `g_veil_curtain` (→ `gate_veil_curtain`) also accepts `q_lightless_stair` accepted.

**C-39 · Minor · Caelum's crossing.** W §2.6: "Caelum can be brought forward once `item_caelums_anchor_token` has
been anchored"; D §12.1: Caelum needs `echo_anchor_principle` + `echo_caelum_unanchored`; S §9.6: he crosses by his
own choice in `q_a_boy_from_a_doomed_city` (`echo_caelum_unanchored`). → **S**; anchoring the token sets
`flag_cradle_pin_anchored` for B only (W E-5).

**C-40 · Minor · Dark Spellbook drops.** D §4.12 worked example "Shade → Dark Spellbook (50%: yes)" and D §20 Q7; X
D-055: "The first Corrupted Shade killed each loop always drops a Dark Spellbook; later Shades 50%"; W conforms. →
D-055.

**C-41 · Minor · Attunement cap.** D §10.7: "at most 5 equipped"; P §5.13/§5.16 `attunementPowerCap: 12` over a
`powerBudget` sum. → D (equip cap 5); P's validator checks the equip cap.

**C-42 · Minor · Materials owned by DESIGN but introduced by WORLD.** W §8.1 adds `mat_bell_bronze`,
`mat_cinder_horn`, `mat_storm_glass`, `mat_umbral_thread`; D §8.2 lacks them and also lacks gathering nodes W must
place (E-11). → D §8.2 adopts the four (W E-10); W places the proposed gathering nodes.

**C-43 · Minor · Item tiers and budget.** W uses T5 (band 16–18); D §7.4 stops at T4 (band 14–18). W 157 items vs D
139. → D §7.4 adopts T5 (W OQ1) since the Before (13–17) and Apex (15–18) need it; the budget is a floor ("target
≥120"), so 157 stands unless the lead trims (W OQ6).

**C-44 · Minor · Litany verse sources and the verse count.** All documents agree on nine verses (D: "STORY fixes the
count (nine …)"; S §2.3; W's pages). D's `echo_litany_verse_n` placeholder and "each held verse +25" (0–100 scale)
are superseded (C-03). W's physical Litany pages are kept as quest items that grant verses (E-9). → S §12 lists the W
sources (C-23).

**C-45 · Minor · Borin's forge-mark and the orrery key.** S `q_bone_road` needs `item_borins_forge_mark` in inventory
(no source anywhere); `item_orrery_key` is placed (W §3.5, §3.11 duplicate) but opens nothing. → Borin gives the mark
when `q_bone_road` is accepted (W OQ10); W §10 defines the orrery lock or removes the key (W OQ9).

**C-46 · Minor · Skyreach / Scorched Gate / Steppe crossing Echo.** D §10.1 "Ashen Steppe crossing 4 watches (2 with
`echo_steppe_waystones`)" has no single W edge (W X3). → Add the Echo only if U8 accepts W's conditional road; else
remove it from D.

**C-47 · Minor · Codex references to non-existent entries.** D §6.7 "`codex_maelis_korr` unlocks" at Corruption 1 vs
S "`echo_korr_marginalia` or Corruption ≥ 3"; D §10.5 `codex_the_nine` (→ `codex_nine_overview`), `codex_wayfinders`
(→ `codex_seven_wayfinders`); D §13.3 `codex_void_resonance` (none: the Echo carries its codex line). → S thresholds;
REGISTRY §7.

**C-48 · Minor · Achievement conditions.** D §15.2: `ach_echo_in_the_library` "complete `echo_crystal`";
`ach_two_brothers` "`quest_two_brothers`"; `ach_i_know_what_you_are` "`echo_nyx_is_nyxaria`"; `ach_commune` "reach
resolve 100"; `ach_the_escape`/`ach_the_fall` "reach the Threshold by …" (C-01, C-02); `ach_cleansed` "Lanternreed
Light" (C-11). → REGISTRY §18 rewrites.

**C-49 · Minor · `scene_echo_crystal` undefined.** S §4.1 beat 4 names `scene_echo_crystal`; S §13's 20 scenes do not
include it. → Add to S §13 or make it a `q_echo_crystal` dialogue node.

### Nits

**C-50 · Nit · Wayfinder cadence.** X D-007 "roughly one per 60–80 years"; S §2.8 gaps are 44 (Sundering → Sael
Orrin), 66, 68, 65, 66, 62, 59, then 70 to the present. → BIBLE states "roughly one per lifetime" or S nudges Year 44
and 430; no id impact.

**C-51 · Nit · Nyx's present age.** W §4 gives young Nyxaria "~30" in the Before; she has lived 40 years in the
present (X D-025, S "arrived Year 460") — about 70 now. W `npc_nyx`: "Leader of the Shadow Weavers for thirty years".
Neither S nor W gives her present age. → BIBLE records ≈70 and "leader since ≈Year 470".

**C-52 · Nit · Hesper.** W `npc_hesper_dunn` repeats the first name of the second Wayfinder, Hesper Vayle (S §2.8; W
Q8). → Rename the gate-captain in U9 (S owns names).

**C-53 · Nit · Silverwood Before day names.** S "Day −3 / −2 / −1"; W "Day 1/2/3 = First/Second/Last Bell" (W maps
them). → Data uses `flag_before_day_1..3`; prose may use either; BIBLE lists the mapping.

**C-54 · Nit · Heartstone verbs.** S `scene_heartstone_choice` "Soothe, seize, or shatter" vs the legacy/X D-017 verbs
Stabilize / Exploit / Destroy. → Data and UI buttons use the legacy verbs; S's title line may stay.

**C-55 · Nit · Dot-form Echo ids.** X D-010/D-016/D-017 and S use `echo.crystal_location`, `echo.litany_verse_1`. →
Prose only (D-044); data uses `echo_*`.

**C-56 · Nit · Scene and codex id stems.** `scene_ending_vigil`/`_dawn`/`_silence`/`_archive` vs `ending_wardens_vigil`
etc.; `codex_region_mistwood_reach`/`codex_region_highlands` vs `region_mistwood_ironclad_reach`/
`region_aether_kissed_highlands`. → Acceptable; align in U9 if convenient.

**C-57 · Nit · Quest-count note in DESIGN.** D §20 Q2 "44 total or 44 new (+6 legacy = 50, +5 class mini-quests = 55)".
→ X D-045 rules 44 total; class quests are additional (C-15).

**C-58 · Nit · Schema literals that look like ids.** P §5.5 `kind: 'status_on_hit'`, `'status_immunity'`; P §5.10
`scene_done:<id>`. → camelCase literals; `flag_scene_done_<scene>`.

---

## 3. Numbers and dates

"—" = the document does not state it. **Canonical** follows D-062 unless a DECISIONS entry rules.

| Quantity | DECISIONS | STORY | DESIGN | WORLD | PLAN | Canonical |
|---|---|---|---|---|---|---|
| Sundering before Day 1 | 500 years (D-025) | Year 500 | — | Year 500 | — | 500 years; "Year 500 of the Sundering" |
| Prior Wayfinders | ≥7, one per 60–80 y (D-007) | 7: Years 44, 110, 178, 243, 309, 371, 430 | — | same (Ansel's line) | — | S's seven years (C-50) |
| Dask's death | 70 years ago (D-025) | Year 430 | — | Year 430, "seventy years ago" | — | Year 430 |
| Nyx in the present | 40 years (D-025) | arrived Year 460 | — | Year 460; leader 30 years | — | arrived Year 460 |
| Day of Teeth | — | Year 178 (Corwen Blackreed) | — | — | — | Year 178 |
| Ages: Ilyra / Brak / Kaelen / Borin | ~30 / ~40 / ~44 / ~55 | same | — | same | — | as D-025 |
| Ages: Ansel Dray / Hadda / Caelum / young Nyxaria | — | ~70 / ~50 / ~16 / — | — | ~70 / ~50 / ~16 / ~30 | — | S/W values; Nyx now ≈70 (C-51) |
| Silverwood Before | last 3 days (D-016) | Day −3, −2, −1 | — | Day 1–3 = First/Second/Last Bell | — | 3 days; flags `flag_before_day_1..3` |
| Breach Clock base | Day 30 (D-005, D-025) | "thirtieth dawn"; Day 1 of 30 | Day 30 Dawn, 116 ticks | 30 | `clockLimitDays` | 30 days |
| Watches per day | 4 (quarter-day) | — | 4 | 4 | 4 | 4 |
| Thorough Loop 1 length | 22–26 days | — | 22–26 | Apex Day 22 (§10.8) | 22–26 | 22–26 |
| Clock: Stabilize / Exploit / Destroy | +6 / −5 / −10 | "±days" | +6 / −5 / −10 | same | — | +6 / −5 / −10 |
| Clock: other modifiers | — | `q_day_of_teeth` −2 | Anchor +3; Corruption 6 −1; communion +2 (resolve ≥ 50); `att_steady_hours` +1 | — | — | D's list + S's −2; communion at Resolve ≥ 4 (C-20) |
| Frayed Clock | 20-day loops (D-021) | — | 20; other modifiers halved | 20 (§10.10) | — | 20 |
| Clock warnings | — | — | Days 20, 25, 28, 29 | — | 10/5/3/1 days left | D (C-20) |
| Rep range / tiers | −100..100; ≤−40 / −39..−10 / −9..19 / 20..59 / ≥60 | — | same | gates at 20 and −9 | — | D-014 |
| Heartstone rep: Stabilize | Remnants +15 | +15 | +15 | — | — | +15 |
| Heartstone rep: Exploit | Weavers +15, Remnants −15 | — | same | — | — | same |
| Heartstone rep: Destroy | Ironclad +20, Remnants −25, Weavers −10 | — | same | — | — | same |
| Crystal give / keep | Remnants +15 / Weavers +10, Remnants −10 | same | same | — | — | same |
| Shards give / refuse | Weavers +20 / Ironclad +5, Nyx Wary | same | +20 / Ironclad +5, Weavers −20 | — | — | D (−20 realises "Wary") |
| `q_lost_scroll` | — | to Ilyra Remnants +10; to Nyx Weavers +15, Remnants −15 | Remnants +10, Weavers −3 | — | — | S's branches, D's magnitudes (C-16) |
| `q_clear_path` / `q_blighted_outpost` | — | Ironclad +10 / +15 | +10 / +15 (and Weavers −3) | — | — | D |
| Corruption 6 | Remnants −10; locks E | — | same; max HP −10%; clock −1 | — | — | D |
| Corruption max / spellbook cost | 0–6; −15 HP (Part A) | — | 0–6; −15 HP, +1 | same | hp −15, corruption +1 | 6; −15 HP, +1 |
| Spellbook drop | first Shade 100%, later 50% (D-055) | — | 50% | per D-055 | — | D-055 |
| Communion Resolve | 0–8; ≥3 / ≥6 / 8 (D-054) | 0–9; ≥6 unlock, <3 reject | 0–100; ≥100 | 0–8 | — | D-054 (C-03) |
| Contained Tyrant | Loop 1, level 12–13 party, 3 phases (D-051) | 3 phases at 65% / 30% | 540 HP, ATK 24, SP 26, 66% / 33% or turn 14, XP 900 | L14, same stats | legacy 126/14/5/4/180 | D numbers, D-051 names |
| Unveiled Tyrant | band 15–18, 4 phases (D-051) | 3 phases | 900 HP, ATK 32, SP 36, 75/50/25% or turn 20, XP 1,600 | L18, same | — | D |
| Loop 1 level at the Apex | 12–13 (D-051) | — | 12–13 | 12–13 | "levels 6–10 reachable" | 12–13 |
| XP to next level | D's table (D-056) | — | 100, 150, 220, 300, 400 … 3,660 (26,900 at 20) | uses D | 100 + 25·(L−1) | D-056 |
| Level-up gains | — | — | class growth (D §3.3), +1 stat, 1 AP | — | +10 HP, +5 MP | D |
| Region bands | D's table (D-056) | quest bands differ (C-22) | Ruins 1–4 … Apex 15–18 | same as D | Ruins 1–3 … Before 8–10 | D-056 |
| Fodder HP / ATK / DEF | — | — | 22 + 9L ±20%; 5 + 1.5L; armor L/3 | §0 10L + 20; L + 6; L/2 (§4–6 uses D's ATK) | legacy stats | D (C-32) |
| Boss HP / level | — | — | Tyrants ×3.6 / ×4.5; band top + 2 | ×3.5–4.5; band top + 1 | — | ×3.5–4.5; +2 (recommend +1) |
| Fodder XP | — | — | round(20 + 8L + 1.2L²); elite ×1.8; anomaly ×1.3 | same | — | D |
| Quest XP | — | 50–260 per quest | legacy 120/150/120/220/260/400; tiers 150/250/400; ending 600 | — | — | D (C-16) |
| Hit / crit / flee / initiative | — | — | see C-18 | uses D | see C-18 | D |
| Guard | halves damage (D-009); +5 resource all classes (D-053) | — | 50% (Warden 65%, affix 60%); +5, Warden +8 | — | ×0.5; Warden +8 | D |
| Resonance | +10 per closer (D-055) | — | +2 location, +3 bestiary, +1 codex, +5 quest, +50 ending, +10 closer | — | — | D |
| Attunements | capped (D-011) | — | 15; 5 equipped; 440 total | — | power cap 12 | D (C-41) |
| Merchant restock | every dawn (D-057) | — | every dawn | every dawn | every 3 days | dawn |
| Breach-anchor fee / gate | — | — | 300 g; Ironclad Trusted | proposes 0; Neutral during quest | — | 0; Neutral during quest (C-04) |
| Heartstone fragments per choice | one fragment, either kind (D-052) | — | 1 | proposes 2 | — | 2 (C-14) |
| Apex gate | 6 quests (L1); + `echo_apex_resonance` (L2+) (D-048) | six quests; Echo shortcut | `ach_six_quests` | `g_apex` per D-048 | `legacy_quests_completed`, `apex_path` | D-048 |
| Quests | 44 total (D-045) | 44 + 6 stretch | 44 or 55 (Q2) | — | — | 44 + 5 class quests outside the count |
| Echoes | ~60 (D-010) | 75 | ≥66 | +25 | ~60 (W10) | 75 + 26 = 101 (REGISTRY §6) |
| Codex | 80+ (D-020) | 85 | — | — | 80+ | 85 (87 if C-19 re-cut) |
| Items | — | — | 139 (target ≥120) | 157 | — | 157 (C-43) |
| Item tiers | — | — | T1–T4 | T1–T5 | — | T1–T5 |
| Achievements | ~40 (D-021) | — | 40 | — | ~40 | 40 |
| Locations / creatures | 73 (D-015) / — | — | 73 | 73 / 57 | — | 73 / 57 |

---

## 4. Hand-off to the revision units

- **U8 (DESIGN + PLAN):** C-01–C-11, C-13 (D §10.5 → REGISTRY §6), C-15–C-18, C-20, C-21, C-24–C-27, C-31–C-35,
  C-40–C-43, C-46–C-48, C-58. PLAN is rewritten to D-044 and D-065 in the same pass.
- **U9 (STORY + WORLD + BIBLE):** C-03 (S §8.3), C-06, C-07, C-12, C-13 (S §12 additions), C-14, C-15, C-16 (drop
  quest XP), C-19, C-22, C-23, C-28–C-30, C-36–C-39, C-44, C-45, C-49–C-56. BIBLE takes §3's canonical column.
- **Lead rulings still needed:** boss level +1 vs +2 (C-32); Dask on the Glowlands (C-10); the lean Echo option (C-13);
  the Steppe road (C-46); W §10.10's Destroy warning and `{clock}` atom (C-20).
