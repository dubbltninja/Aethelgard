<!-- U80 human summary (hand-written; the generated report starts at "# BALANCE" below and is the merge of seven chunks, see "How this batch was run"). -->
# U80 summary: the first real-content balance batch

**4,835 runs** on the real pack at `14fa34c` (U81a merged): 4,000 main runs (6 bots x 5 classes x 100 seeds, plus 80 more seeds for melee and caster so the
Escape rate has N = 200 per class and bot (400 per class)), 779 pre-Tyrant / communion scenario runs, 48 ending-script runs. 0 engine errors; 248 of 248 sampled runs replay
to the same hash. **Not a green batch**: 3 of 20 DESIGN §19 rows pass (#4, #13 and the Escape rate #1), 15 fail, #18 and the fight-path half of #20 cannot be measured.
That is the expected input for U81b.

## How this batch was run (and one tooling change)

One `sim:balance` run of this size (about 41 min on 2 cores) does not fit a 10-minute shell, so it ran in seven foreground chunks (seed prefixes `balA`..`balE` x 20 seeds
all bots; `balS` 20 seeds melee+caster with `--scenario-seeds 20`; `balT` 80 seeds melee+caster), each written with `--json`, then combined with the new
**`--merge a.json,b.json,…`** option (`mergeBatches` in `src/sim/batch.ts`: runs concatenated, seeds and determinism samples summed, metrics recomputed over the union; no play).
No metric was missing for a counter; the two unmeasurable rows are named below. Reproduce chunk A with
`npm run sim:balance -- --seeds 20 --seed-prefix balA --workers 2 --scenario-seeds 0 --determinism 40 --json a.json --out a.md`, and so on, then `--merge`.
The `Seeds`/`Batch` line in the generated header therefore reads "120 seed(s) `balA:0`…": it is the merged seed list, not one prefix.

## §1.2 gates

| Gate | Result |
| --- | --- |
| Bots complete runs | **FAIL**: 458 of 4,000 main runs stop before 2,000 steps or a loop. 436 are FALLEN stops (the bot died past `maxFallen`: caster 146, explorer 136, melee 132, random 23, speedrunner 20), 33 are combat stalls (below). 0 engine errors. |
| Loop 1 Escape rate >= 60% (melee or caster) | **PASS, barely**: elf 94%, warden 98%, ranger 95% (all melee), wizard 86% (caster), **shadow_weaver 61%** (caster; melee 37%). The caster bot alone fails elf 14%, ranger 30%, warden 51%. |
| Zero soft-locks | **FAIL**: 33 `combat_stall` (round > 60), no other kind. 23 pacifist stalls at `enc_stair_null_mouth`, 6 pacifist at `enc_eye_umbra`, 1 pacifist at `enc_tidewell_clerk_archivist`, 1 pacifist wandering, 1 explorer at `enc_barrows_light_night` (elf, `balA:12`), 1 explorer at `enc_mouth_lanterns` (wizard, `balA:19`). Replays are in "Blockers" below (`npm run sim:replay -- --pack real --bot pacifist --class ranger --seed balA:1 --stop-at ending`). Also 1 scenario crash: `communion_movement_2`, caster ranger `balS:16`, "cannot walk in ending mode" (the scenario script keeps walking after the ending fired). |
| Coverage | **FAIL**: quests 38/49, locations 59/73, endings 8/8 (A-F + both closers), creatures killed 62/73 (seen 65/73), items 116/157, echoes 75/103, abilities 58/107, dialogue choices 183/319. Lists are in "Coverage" below. |
| Determinism | **PASS**: 248/248. |

## The DESIGN §19 rows

| # | Target | Measured | |
| --- | --- | --- | --- |
| 1 | Escape >= 60% per class | worst class 61% (shadow_weaver caster) | pass |
| 2 | no ability > 35% of class damage | elf_ambush 62.9%, rgr_piercing_arrow 46.9% (wrd_crushing_blow 32.5% and wiz_lightning_bolt 29.7% are close) | **fail** |
| 3 | monotone difficulty | 8 violations (Drowned Reach 4-8 is the hardest early band; Highlands 6-10 dies 32%, Steppe 7-11 only 7%) | **fail** |
| 4 | every ending | 6/6 true endings reached (the scripts reach A-F and the closers; `ending_unbound` also by 245 organic runs, mostly the wizard caster) | pass |
| 5 | every quest completed | 38/49 | **fail** |
| 6 | every location | 59/73 | **fail** |
| 7 | zero soft-locks | 33 | **fail** |
| 8 | fight length | fodder single 2 (3-5), pair/triple 4 (5-8), elite 9 (6-9, top edge), regional boss 9 (10-14), Contained Tyrant 13 (12-18) | **fail** (3 bands) |
| 9 | deaths per loop | melee 4.88 (<= 1.0, zero-death 32% vs 55%), caster 6.73 (13% zero-death), explorer 10.38 (<= 1.5), random 7.88 (>= 3 ok) | **fail** |
| 10 | loop duration | explorer Loop 1 36 days (22-26), 670 actions (350-600); speedrunner 33 days (12-16); Loop 3+ speedrunner 163 actions (ok) | **fail** |
| 11 | level at the Apex | explorer median 14 (11-13); speedrunner never reaches the Apex in time to be measured | **fail** |
| 12 | ability usage | ranger 50%, warden 54% (ok); elf 68% (40-60); wizard 25%, weaver 37% (55-80); Blood price 0% of 47,083 Weaver casts (10-30) | **fail** |
| 13 | 0-MP fights <= 15% | worst class 1% | pass |
| 14 | economy | end-of-Loop-1 gold median 596.5 (50-200); gold never below 0; cheapest healing 10 g within two kills in all 40 bands | **fail** (one check) |
| 15 | clock | explorer expiry 6% (10-20); speedrunner expiry 58% (0%) | **fail** |
| 16 | resistance relevance | 1 band off (band 10, 6 encounters only: a thin sample, all other bands inside 15-35%) | **fail** (thin) |
| 17 | companion value | companion fights end 39% faster (20-35) | **fail** (slightly high) |
| 18 | variance sanity | **not measurable**: the +-10% roll is an engine constant, the sim has no fixed-decision roll-replay harness; adding one means an engine hook (outside this unit) | n/a |
| 19 | Contained Tyrant | see D-101 below: L11 solo median rounds 14.5-29.8 (12-18); win rates far under target for 3 of 5 classes; effective HP 643 solo / 770 with a companion (<= 850, ok) | **fail** |
| 20 | Unveiled Tyrant | communion path ok (Resolve >= 3 in 19/19 runs); the fight path (L15-18) is **not measured**: no scenario starts an Unveiled fight (the 238 Unveiled fights seen are all wins, median 11 rounds at L8-12, below 14-20) | partial |

## Top 10 problems, ranked by distance from target

1. **Deaths per loop (#9): 5-10x over target.** explorer 10.4 vs 1.5; melee 4.9 and caster 6.7 vs 1.0. Where they die (main suite, defeat rate per fight): `enc_eye_umbra` 99% (Vell's Umbra, 540 fights, bots arrive at median L5), `enc_perch_stormcrown` 88%, `enc_corridor_husks` 85% (two Horde Husks at L2), `enc_pass_moths` 83% (three Moment Moths, L8, 2,738 fights), `enc_grave_ashmaw` 79%, `enc_depths_crawlers` 64% (elf 99%, ranger 98%, warden 95% but wizard 2%, weaver 1%: a physical-versus-spell split), `enc_ridge_harriers` 62%, `enc_bellmouth_divers` 57%, `enc_plateau_harriers` 55% (3,106 fights), `enc_eyrie_loom_weaver` 55%, `enc_outpost_golems` 54%. Part of this is bot behaviour (bots walk into bosses unleveled and the FALLEN loop reloads), which U81b must separate from tuning: the explorer/speedrunner/melee bots fire abilities in only 0-5% of wizard/weaver combat actions (Completion table) while the caster bot does 83-90%.
2. **Ability usage (#12): Blood price never used (0 of 47,083 Weaver casts vs 10-30%); wizard 25% and weaver 37% vs 55-80%; elf 68% vs <= 60%.** Per-bot: wizard caster 90%, explorer 1%; weaver caster 83%, explorer 5%, melee 5%, speedrunner 0%. 49 of 107 abilities are never used (all of Caelum's, Nyx's `drink/hex/unmaking`, ranger `rgr_apex_predator/exsanguinate/hamstring/killing_shot/pinning_shot/smoke_bomb/snare_trap`, wizard `wiz_immolate/pyre_of_the_nine/skyfall/unmoment`, warden `wrd_iron_silence/last_bastion/oathbound`, elf `elf_final_verse/heart_of_the_grove/veilwalk`).
3. **Damage dominance (#2): `elf_ambush` 62.9% of elf damage, `rgr_piercing_arrow` 46.9% of ranger damage** (target <= 35%). Next: `wrd_crushing_blow` 32.5%, `wiz_lightning_bolt` 29.7%. Weaver is spread but `companion:brak` is 23.7% of its damage (and 17-23% for every class): Brak carries every class.
4. **Clock and pacing (#10, #15, #11): the explorer takes 36 days and 670 actions, reaches the Apex at L14, and expires only 6%; the speedrunner takes 33 days (target 12-16) and 58% of its Loop 1s expire (target 0%).** The speedrunner is no faster than the explorer, so its policy or the route shortcuts do not do what DESIGN §10 assumes; every clock row moves together.
5. **Contained Tyrant (#19, D-101).** Scenario sims (melee or caster bot, 20 seeds per cell): L11 solo wins elf 79%, ranger 80%, wizard 70%, warden 5%, weaver 0% (caster bot; melee bot elf 42%, ranger 35%, wizard 10%, warden 0%); L13 solo wins elf 74%, ranger 20%, warden 20%, weaver 25%, wizard 85%. Median rounds at L11 solo: elf 29.8, ranger 20.3, warden 19, wizard 14.5 (the wizard is the only one near 12-18). With the companion: warden 80% / ranger 65% / wizard 90% win at L11, but elf 10% and weaver 5% (the companion makes the elf and the weaver worse). In full runs (main suite, 367 fights) the Contained Tyrant dies in a median 13 rounds with wins elf 62%, warden 81%, ranger 74% (weaver and wizard rarely arrive: n = 0 and 1).
6. **Economy (#14): end-of-Loop-1 gold median 596.5 vs 50-200** (median 1,391 gold at the Tyrant). 6,581 `item_chronal_dust` and 6,465 `item_ley_touched_tonic` purchases against 3 crafts and 1 `legendary` upgrade: gold has no sink.
7. **Difficulty curve (#3): 8 violations, and the shape is wrong, not just wobbly.** Region deaths per fight: silverwood 6%, mistwood 6%, **drowned_reach 23% (median 7 rounds)**, voidscar 12%, **highlands 32%**, steppe 7% (3 rounds), glowfen 10%, nexus 3%, veil 13%, **skyreach 35%**. The Drowned Reach is lethal exactly at the levels bots hold there: death 41% at L3, 48% at L4, 51% at L5 (flee 7% at L4-5), 25% at L6 (D-110).
8. **Soft-locks (#7): 33 combat stalls**, 31 of them the pacifist bot (it attacks and uses abilities for 60 rounds against `cr_null_mouth` (`enc_stair_null_mouth`) and `cr_vells_umbra`, which it cannot kill; `enc_stair_null_mouth` has a 92% flee rate for everyone else). Either the pacifist needs its flee fallback (bot side, U81b's tooling) or the null mouth needs a kill path.
9. **Fight length (#8): fodder single median 2 rounds vs 3-5 (n = 82,641); fodder pair/triple 4 vs 5-8; regional boss 9 vs 10-14.** Elite is at 9 (the top edge). Outliers the other way: `enc_outpost_golems_gate` median 15 rounds (D-140's Golem pacing, 4,769 fights), `enc_outpost_golems` 14.
10. **Coverage and companion value (#17, #5, #6, G4).** Companions end fights 39% faster (20-35). 11 quests never started or finished, 14 locations never visited (`loc_apprentices_garret`, `loc_archives_of_danthe`, `loc_cistern_gardens`, `loc_conflux_chamber`, `loc_far_light`, `loc_gallery_of_loops`, `loc_grand_library`, `loc_loom`, `loc_ninefold_hall`, `loc_outer_walks`, `loc_plaza_of_bells`, `loc_scholars_corridor`, `loc_silver_gate`, `loc_still_shore`), 41 items and 28 echoes never gained (caelum's whole arc: Caelum was never recruited, 0 recruits), 49 abilities never used. These need `scripts/quests.ts` proofs or a bot that follows quest offers, not number changes.

## Open flags, folded in (one list for U81b)

- **D-101, the Contained Tyrant:** see problem 5. Scenarios and full runs disagree: the scenario bots (equipped with the band's best Common gear) lose where the full-run bots win (warden: scenario L11 solo 0-5%, full runs 81%), so the scenario kit, not the Tyrant alone, is a lever. The D-101 note that the Ranger "drops from 85% at L11 to 25% at L13" persists (80% -> 20% with the caster bot).
- **D-109, the Nexus chain:** the main suite reaches the Nexus at median L11: `enc_nexus_aberration` 1,864 fights, 6% deaths, 20% flee, median 6 rounds; `enc_nexus_crawlers` 78 fights, 5% deaths (weaver 100%, small n). The D-109 failure case (a carry-over L10 start with the starter kit hitting the Aberration and three Husk waves back to back on the Telling stage) is **not covered by any suite**; a scenario would have to start there.
- **D-110, the Drowned Reach at L6:** 25% deaths at L6 over 1,613 fights (flee 53%), against 41-51% at L3-L5 and 19-24% at L7-L9: the reach is a wall for L2-L5 bots and still harsh at L6-L9. Loop 2 specifically is not separated in the fight records.
- **D-089, the Warden vs bosses:** in full runs the Warden is the best class against bosses (Ashmaw 41% win, Stormcrown 22%, Umbra 4%, Lantern Matron 86%, Contained Tyrant 81%), and the 17 Warden pacifist stalls are bot behaviour. In the L11 solo scenario it fails (5% caster bot, 0% melee bot, median 19 rounds) and without Brak it deals the least damage (it is the most companion-dependent class: 80-90% with Brak, 0-20% solo at L11-L13).
- **D-113, Ilyra's loyalty for ending E:** explorer runs that recruit her (77 recruits) average loyalty 7.1, max 33; only the scripted proofs (14 runs) reach 77.5 average, max 85. Without the bond Echo, no organic bot gets near 50. The per-stage +5 vs bond-Echo decision stands open; the data says the +5 alone is far short in any natural play.
- **D-122, the Cairns, Scriptorium and Windward fights:** `enc_cairns_harriers` 291 fights, 2% deaths (not a problem now); `enc_bone_road_cairn_2` 2% deaths (50 fights; the D-122 "1 in 2" was a carried-over L10 start). `enc_scriptorium_choir` 3,986 fights, 35% deaths, 41% flee, median 12 rounds at L5 (elf 28%, ranger 49%, warden 47%): too long and too lethal for band 5. `enc_scriptorium_archivists` 8% deaths, 66% flee. `enc_windward_kites` 889 fights, 39% deaths (weaver 64%, wizard 71%, elf 28%, ranger 17%, warden 9%), 21% flee, L10. `enc_stair_null_mouth` is the pacifist's soft-lock (above).
- **D-137, out-of-band placements:** Vell's Umbra (L16 at the Eye): 540 fights, 1% wins (all classes 0% except 3 warden wins), median level 5 on arrival, so it is a wall rather than a boss at the moment; `cr_stormcrown` 12% wins at median L10; `cr_ashmaw` 21%. Regional bosses win 12-63%, `cr_unraveling_tide` 0/12. The other placements D-137 listed are not separable in fight records (they are content-lint warnings). **"Stutter":** `wiz_stutter` and `comp_caelum_stutter` are both in the never-used list, so a shared name has no measured effect; rename remains a content job.
- **D-138, the L13 button-presser vs the Contained Tyrant:** solo at L13, melee bot wins elf 63%, warden 10%, ranger 5%, weaver 0%, wizard 20%; caster bot elf 74%, warden 20%, ranger 20%, weaver 25%, wizard 85%. A player who only attacks loses it more than 3 times in 4 for four of five classes.
- **D-140, the Golem's pacing and ability rotation:** `enc_outpost_golems_gate` median 15 rounds, 33% deaths (elf 50%, weaver 42%, wizard 42%, ranger 21%, warden 5%), `enc_outpost_golems` 54% deaths and 14 rounds; ability rotation: see problems 2 and 3 (the used set is narrow: one ability carries each class, 49 of 107 are never used).

## Caveats for U81b

- The bots are policy bots: `explorer`, `speedrunner` and `melee` almost never cast for the caster classes (Completion table, "Ability share"), so rows #9, #10, #11 and #15 mix tuning and bot policy; the caster-class numbers are only fair from the `caster` bot. Death counts include FALLEN screens that the runner reloads from the autosave.
- Rows #19 and #20 use the scenario sims, which equip a fixed kit and a fixed companion: they are comparable between batches, not a prediction of play.
- 40 scenario sims were skipped for the ranger ("the Wayfinder fell" in `pre_tyrant_l11_ranger` and `pre_tyrant_l13_ranger` with the companion).
- The generated report below is unedited (header: merged seed list; `Duration` is the sum of the seven chunks).

---

# BALANCE

Generated by `npm run sim:balance` (`tools/gen-balance.ts`); do not edit. Targets are DESIGN §19 and PLAN §1.2; `n/a — needs …` marks a row the pack cannot measure yet, never a pass.

- **Date:** 2026-10-26T19:44:01.648Z
- **Git SHA:** 14fa34c
- **Content version:** 0.1.0
- **Packs:** real
- **Batch:** 200 seed(s) `balA:0`…, bots caster, explorer, melee, pacifist, random, speedrunner, classes all, max 6000 steps and 3 loop(s) per run, 20 scenario seed(s), determinism sample 220
- **Runs:** 4835 (4000 main, 779 scenario, 56 script), 40 scenario sim(s) skipped
- **Duration:** 41m 14s on 2 worker(s); 1533 µs per step (bot, legal actions and step) with `__DEV__` off
- **Blockers:** 34

| Pack | Runs | Pass | Fail | Partial | n/a | Blockers |
| --- | --- | --- | --- | --- | --- | --- |
| real | 4835 | 5 | 19 | 1 | 1 | 34 |

## Targets · real

5 pass, 19 fail, 1 partial, 1 n/a of 26 rows. PARTIAL = every part that could be measured passes; the rest is named in the detail. A thin sample means fewer runs than the spec asks for.

| # | Target | Result | Value | Threshold | Detail |
| --- | --- | --- | --- | --- | --- |
| #1 | Every class finishes Loop 1 | PASS | worst class 61% | every class ≥ 60 % (melee or caster), N ≥ 200 per class | Escape rate by class: elf 94% (melee 94%, caster 14%); ironclad_warden 98% (melee 98%, caster 51%); ranger 95% (melee 95%, caster 30%); shadow_weaver 61% (melee 37%, caster 61%); wizard 86% (melee 51%, caster 86%) |
| #2 | No single ability dominates | FAIL | 62.9% | no ability > 35 % of its class's damage | FAIL largest share elf_ambush 62.9% of elf's damage |
| #3 | Difficulty monotone across regions | FAIL | 8 violation(s) | median rounds and death rate non-decreasing in band order | FAIL 1-4: 2 rounds, 6% deaths; 2-6: 3 rounds, 6% deaths; 4-8: 7 rounds, 23% deaths; 5-8: 6 rounds, 12% deaths; 6-10: 4 rounds, 32% deaths; 7-11: 3 rounds, 7% deaths; 8-12: 6 rounds, 10% deaths; 9-13: 4 rounds, 3% deaths; 10-14: 7 rounds, 13% deaths; 12-15: 5 rounds, 35% deaths — rounds fall 4-8 7 → 5-8 6; death rate falls 4-8 23% → 5-8 12%; rounds fall 5-8 6 → 6-10 4; rounds fall 6-10 4 → 7-11 3; death rate falls 6-10 32% → 7-11 7%; rounds fall 8-12 6 → 9-13 4; death rate falls 8-12 10% → 9-13 3%; rounds fall 10-14 7 → 12-15 5 |
| #4 | Every ending reached | PASS | 6 | each of A–F reached (explorer + scripted suites) | 6/6 reached |
| #5 | Every quest completed | FAIL | 38/49 | every quest completed (union of runs and scripts) | FAIL 38/49; never: q_a_boy_from_a_doomed_city, q_his_masters_sin, q_preserve_or_heal, q_seven_marks, q_stop_the_ritual, q_the_apprentices_errand … +5 |
| #6 | Every location reached | FAIL | 59/73 | every location visited by the explorer runs | FAIL 59/73; never: loc_apprentices_garret, loc_archives_of_danthe, loc_cistern_gardens, loc_conflux_chamber, loc_far_light, loc_gallery_of_loops … +8 |
| #7 | Zero soft-locks | FAIL | 33 | 0 soft-locks in ≥ 2,000 runs | FAIL 33 soft-lock(s) in 4835 run(s) (combat_stall 33) |
| #8 | Fight length by band | FAIL | 3 band(s) out of range | fodder 3–5/5–8, elite 6–9, boss 10–14, Contained Tyrant 12–18, Unveiled 14–20 rounds | FAIL fodder single 2 (3–5, n=82641); FAIL fodder pair/triple 4 (5–8, n=36869); elite 9 (6–9, n=7961); FAIL regional boss 9 (10–14, n=178); Contained Tyrant 13 (12–18, n=367) |
| #9 | Deaths per Loop 1 by bot | FAIL | 3 bot(s) out of range | melee/caster mean ≤ 1.0 and ≥ 55 % zero-death; explorer ≤ 1.5; random ≥ 3 | FAIL melee mean 4.88, 32% zero-death; FAIL caster mean 6.73, 13% zero-death; FAIL explorer mean 10.38; random mean 7.88 |
| #10 | Loop duration | FAIL | 3 measure(s) out of range | explorer Loop 1 350–600 actions, 22–26 days; speedrunner 12–16 days; Loop 3+ (speedrunner) 120–220 actions | FAIL explorer Loop 1 670.5 actions; FAIL explorer Loop 1 36 days; FAIL speedrunner Loop 1 33 days; speedrunner Loop 3+ 163 actions |
| #11 | Level at the Loop 1 Apex | FAIL | explorer 14 | explorer median 11–13; speedrunner ≥ 9 | FAIL explorer median level 14 (n=121) |
| #12 | Ability usage | FAIL | 4 class(es) out of band | ranger/elf/warden 40–60 %, wizard/weaver 55–80 % of combat actions; Blood price 10–30 % of Weaver casts | ranger 50% (40%–60%, 164324 actions); FAIL elf 68% (40%–60%, 152830 actions); ironclad_warden 54% (40%–60%, 180236 actions); FAIL wizard 25% (55%–80%, 116398 actions); FAIL shadow_weaver 37% (55%–80%, 126187 actions); FAIL Blood price 0% of 47083 Weaver casts |
| #13 | Resource health | PASS | worst class 1% | fights ending with 0 MP ≤ 15 % for every class | elf 0% of 38576 fights; ironclad_warden 0% of 40243 fights; ranger 1% of 35098 fights; shadow_weaver 0% of 26466 fights; wizard 0% of 28471 fights |
| #14 | Economy | FAIL | 1 check(s) failing | gold never negative; a healing consumable within two kills at every band; end-of-loop gold median 50–200 | lowest gold held 0; cheapest healing 10 gold within two kills in all 40 band(s); FAIL end-of-Loop-1 gold median 596.5 (n=2086) |
| #15 | Clock | FAIL | explorer 6% | explorer Loop 1 expiry rate 10–20 %; speedrunner 0 % | FAIL explorer expiry 6% of 500 (Heartstone: stabilized 299, intact 65); FAIL speedrunner expiry 58% of 500 |
| #16 | Resistance relevance | FAIL | 1 band(s) out of range | each damage type best in 15–35 % of fodder encounters per band | FAIL band 10-10 (6 encounters): physical 50%, fire 50%, storm 33%, ley 67%, void 17%, chrono 33% |
| #17 | Companion value | FAIL | 39% | fights with a companion end 20–35 % faster at equal level | FAIL 39% faster across 556 level/enemy group(s) |
| #18 | Variance sanity | n/a — needs a fixed-decision roll-replay harness (the ±10 % roll is an engine constant, not a tunable the sim can switch off) | — | the ±10 % roll changes a fight's outcome in < 3 % of replays |  |
| #19 | Contained Tyrant | FAIL | 6 check(s) failing | L11 median 12–18 rounds; melee/caster win ≥ 60 % at L11, ≥ 80 % at L13; effective HP ≤ 850 | FAIL L11 solo median rounds elf 29.8, ironclad_warden 19, ranger 20.3, wizard 14.5; FAIL L11 solo win rate elf 79%, ironclad_warden 5%, ranger 80%, shadow_weaver 0%, wizard 70% (≥ 60%); FAIL L13 solo win rate elf 74%, ironclad_warden 20%, ranger 20%, shadow_weaver 25%, wizard 85% (≥ 80%); effective HP solo 642.8 (damage dealt in won fights); FAIL L11 with a companion median rounds elf 28, ironclad_warden 15.8, ranger 15.5, shadow_weaver 16, wizard 8; FAIL L11 with a companion win rate elf 10%, ironclad_warden 80%, ranger 65%, shadow_weaver 5%, wizard 90% (≥ 60%); FAIL L13 with a companion win rate elf 5%, ironclad_warden 90%, ranger 65%, shadow_weaver 45%, wizard 85% (≥ 80%); effective HP with a companion 769.5 (damage dealt in won fights) |
| #20 | Unveiled Tyrant | PARTIAL | 0 check(s) failing | fight path L15–18: median 14–20 rounds; communion: Resolve ≥ 3 reachable from Loop 2 | Resolve ≥ 3 reached in 19/19 communion run(s) (caster); not measured: needs Unveiled Tyrant fights won at L15–18 (no scenario starts one) |
| G1 | Bots complete runs | FAIL | 458 bad run(s) of 4000 (5 class(es)) | 6 bots × every class: no engine error, ≥ 2,000 steps or a loop; ≥ 900 runs | 0 run(s) with an engine error; FAIL 458 main run(s) ended before 2,000 steps or a loop |
| G2 | Loop 1 completion | PASS | worst class 61% | every class ≥ 60 % (melee or caster), N ≥ 200 per class | Escape rate by class: elf 94% (melee 94%, caster 14%); ironclad_warden 98% (melee 98%, caster 51%); ranger 95% (melee 95%, caster 30%); shadow_weaver 61% (melee 37%, caster 61%); wizard 86% (melee 51%, caster 86%) |
| G3 | Zero soft-locks | FAIL | 33 | 0 soft-locks in ≥ 2,000 runs | FAIL 33 soft-lock(s) in 4835 run(s) (combat_stall 33) |
| G4 | Coverage of content by sims | FAIL | 4 kind(s) short | quests, locations, endings 100 %; creatures killed ≥ 95 %; items obtained ≥ 90 % | FAIL quests completed 38/49 (78%, ≥ 100%); FAIL locations visited 59/73 (81%, ≥ 100%); endings and closers reached 8/8 (100%, ≥ 100%); FAIL creatures killed 62/73 (85%, ≥ 95%); FAIL items obtained 116/157 (74%, ≥ 90%) |
| G5 | Balance targets (DESIGN §19) | FAIL | 3/20 pass, 15 fail, 2 open | every row of the table measured and passing | FAIL 3/20 rows pass, 15 fail |
| G6 | Determinism | PASS | 0 mismatch(es) | 100 % identical final state hashes in 200 sampled runs | 248/248 sampled runs replayed to the same hash |

## Completion · real

Loop 1 outcomes per class and bot. Escape = the Contained Tyrant killed and the portal reached (`closer_escape`); Expiry = the clock ran out; FALLEN = at least one Loop 1 game over (reloaded from the autosave); Closed = Loop 1 reached any closer. Deaths = mean Loop 1 deaths per run, FALLEN screens included.

| Class | Bot | Runs | Escape | Expiry | FALLEN | Closed | Median days | p90 days | Deaths | Zero-death | Level at Apex | Ability share | 0-MP fights | Endings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| elf | caster | 200 | 14% | 65% | 100% | 80% | 26 | 30 | 10.45 | 0% | — | 31% | 0% | — |
| elf | explorer | 100 | 77% | 3% | 97% | 80% | 36 | 38 | 8.70 | 3% | 14 | 76% | 1% | — |
| elf | melee | 200 | 94% | 5% | 61% | 99% | 30 | 38 | 1.39 | 40% | 13 | 93% | 0% | — |
| elf | pacifist | 100 | 34% | 66% | 7% | 100% | 32 | 35 | 0.73 | 31% | — | 6% | 2% | — |
| elf | random | 100 | 12% | 80% | 100% | 92% | 31 | 34 | 9.90 | 0% | — | 49% | 0% | — |
| elf | speedrunner | 100 | 13% | 85% | 100% | 98% | 32 | 35 | 2.44 | 0% | — | 26% | 0% | unbound 1 |
| ironclad_warden | caster | 200 | 51% | 34% | 97% | 84% | 26 | 26 | 7.00 | 3% | — | 7% | 0% | unbound 3 |
| ironclad_warden | explorer | 100 | 88% | 1% | 94% | 89% | 36 | 37 | 5.23 | 6% | 14 | 82% | 1% | — |
| ironclad_warden | melee | 200 | 98% | 1% | 26% | 99% | 20 | 37 | 0.73 | 75% | 13 | 93% | 0% | — |
| ironclad_warden | pacifist | 100 | 24% | 76% | 1% | 100% | 33 | 35 | 0.77 | 24% | — | 8% | 0% | — |
| ironclad_warden | random | 100 | 8% | 92% | 83% | 100% | 32 | 34 | 5.82 | 1% | — | 57% | 0% | — |
| ironclad_warden | speedrunner | 100 | 84% | 15% | 26% | 99% | 38 | 40 | 0.71 | 61% | — | 25% | 0% | — |
| ranger | caster | 200 | 30% | 51% | 100% | 80% | 26 | 26 | 9.18 | 1% | — | 10% | 0% | — |
| ranger | explorer | 100 | 67% | 2% | 99% | 70% | 35.5 | 38 | 10.81 | 1% | 13 | 70% | 1% | — |
| ranger | melee | 200 | 95% | 2% | 58% | 97% | 36 | 38 | 2.23 | 42% | — | 85% | 2% | — |
| ranger | pacifist | 100 | 19% | 81% | 17% | 100% | 33 | 35 | 0.99 | 19% | — | 1% | 0% | — |
| ranger | random | 100 | 18% | 80% | 91% | 98% | 32 | 34 | 7.18 | 3% | — | 52% | 1% | — |
| ranger | speedrunner | 100 | 59% | 39% | 21% | 98% | 38 | 40 | 1.15 | 46% | — | 24% | 0% | — |
| shadow_weaver | caster | 200 | 61% | 28% | 76% | 89% | 26 | 27 | 4.64 | 24% | — | 83% | 0% | unbound 27 |
| shadow_weaver | explorer | 100 | 54% | 13% | 100% | 67% | 36 | 38 | 12.85 | 0% | — | 5% | 0% | — |
| shadow_weaver | melee | 200 | 37% | 31% | 97% | 68% | 30 | 37 | 10.67 | 3% | — | 5% | 0% | — |
| shadow_weaver | pacifist | 100 | 19% | 81% | 28% | 100% | 32.5 | 35 | 1.12 | 15% | — | 0% | 0% | — |
| shadow_weaver | random | 100 | 12% | 82% | 97% | 94% | 32 | 34 | 8.61 | 2% | — | 55% | 1% | — |
| shadow_weaver | speedrunner | 100 | 17% | 75% | 97% | 92% | 32 | 34 | 3.93 | 2% | — | 0% | 0% | — |
| wizard | caster | 200 | 86% | 9% | 63% | 95% | 26 | 27 | 2.37 | 38% | — | 90% | 0% | unbound 188 |
| wizard | explorer | 100 | 46% | 12% | 100% | 58% | 36 | 38 | 14.31 | 0% | 13 | 1% | 0% | — |
| wizard | melee | 200 | 51% | 22% | 98% | 73% | 36 | 38 | 9.36 | 2% | — | 1% | 0% | — |
| wizard | pacifist | 100 | 23% | 76% | 39% | 99% | 33 | 35 | 1.45 | 15% | — | 0% | 0% | — |
| wizard | random | 100 | 11% | 82% | 94% | 93% | 32 | 34 | 7.91 | 1% | — | 56% | 0% | — |
| wizard | speedrunner | 100 | 15% | 78% | 98% | 93% | 32 | 34 | 3.95 | 2% | — | 0% | 0% | — |

## Days used · real

| Bot | Loop | Runs | Min | Median | p90 | Max |
| --- | --- | --- | --- | --- | --- | --- |
| caster | 1 | 854 | 25 | 26 | 27 | 31 |
| explorer | 1 | 364 | 27 | 36 | 38 | 38 |
| melee | 1 | 868 | 20 | 31 | 37 | 38 |
| pacifist | 1 | 499 | 30 | 33 | 35 | 38 |
| random | 1 | 477 | 30 | 32 | 34 | 36 |
| speedrunner | 1 | 480 | 20 | 33 | 39 | 43 |
| caster | 2 | 854 | 1 | 21 | 26 | 31 |
| explorer | 2 | 364 | 1 | 5 | 24 | 37 |
| melee | 2 | 868 | 1 | 30 | 37 | 38 |
| pacifist | 2 | 483 | 1 | 30 | 33 | 40 |
| random | 2 | 477 | 1 | 5 | 29 | 35 |
| speedrunner | 2 | 480 | 1 | 30 | 37 | 43 |
| caster | 3 | 669 | 1 | 10 | 27 | 32 |
| explorer | 3 | 362 | 1 | 6 | 24 | 38 |
| melee | 3 | 868 | 1 | 30 | 37 | 38 |
| pacifist | 3 | 468 | 1 | 30 | 33 | 38 |
| random | 3 | 477 | 1 | 4 | 28 | 35 |
| speedrunner | 3 | 479 | 1 | 30 | 36 | 45 |

## Damage share · real

Share of each class's damage by source across all main-suite runs; the top 10 are listed and any source over 35 % is flagged.

**elf**

| Source | Share | Flag |
| --- | --- | --- |
| elf_ambush | 62.9% | **over 35 %** |
| companion:brak | 19.1% |  |
| basic | 6.6% |  |
| itm_echo_bolt | 5.1% |  |
| elf_twin_strike | 4.6% |  |
| status:status_curse | 0.6% |  |
| companion:dask | 0.3% |  |
| companion:ilyra | 0.2% |  |
| companion:mireya | 0.2% |  |
| companion:nyx | 0.1% |  |

**ironclad_warden**

| Source | Share | Flag |
| --- | --- | --- |
| wrd_crushing_blow | 32.5% |  |
| basic | 18.2% |  |
| companion:brak | 17.3% |  |
| wrd_earthbreaker | 17.3% |  |
| wrd_executioners_arc | 8.3% |  |
| itm_echo_bolt | 2.2% |  |
| companion:nyx | 0.8% |  |
| wrd_mountainfall | 0.8% |  |
| status:status_curse | 0.7% |  |
| companion:dask | 0.7% |  |

**ranger**

| Source | Share | Flag |
| --- | --- | --- |
| rgr_piercing_arrow | 46.9% | **over 35 %** |
| companion:brak | 18.0% |  |
| basic | 18.0% |  |
| rgr_marked_shot | 5.1% |  |
| rgr_whirling_steel | 3.6% |  |
| itm_echo_bolt | 3.1% |  |
| rgr_rend | 1.4% |  |
| companion:nyx | 1.4% |  |
| status:status_curse | 0.8% |  |
| status:status_bleed | 0.5% |  |

**shadow_weaver**

| Source | Share | Flag |
| --- | --- | --- |
| companion:brak | 23.7% |  |
| wvr_void_lance | 21.9% |  |
| basic | 20.7% |  |
| wvr_unravel | 9.4% |  |
| wvr_wither | 8.2% |  |
| itm_echo_bolt | 7.3% |  |
| wvr_siphon | 6.1% |  |
| wvr_hex_of_frailty | 1.6% |  |
| companion:nyx | 0.4% |  |
| affix:affix_of_embers | 0.1% |  |

**wizard**

| Source | Share | Flag |
| --- | --- | --- |
| wiz_lightning_bolt | 29.7% |  |
| basic | 25.4% |  |
| companion:brak | 22.9% |  |
| wiz_fireball | 12.2% |  |
| wiz_flame_wave | 2.9% |  |
| wiz_static_lash | 2.8% |  |
| itm_echo_bolt | 1.1% |  |
| status:status_burn | 1.0% |  |
| wiz_echo_bolt | 0.8% |  |
| status:status_curse | 0.4% |  |

## Region curve · real

Fights of the main suite by region, in level-band order. Median rounds exclude fled fights; the death rate is defeats per fight.

| Region | Band | Fights | Median rounds | Death rate | Flee rate | Damage taken / round |
| --- | --- | --- | --- | --- | --- | --- |
| region_silverwood_ruins | 1–4 | 99098 | 2 | 6% | 24% | 5.4 |
| region_mistwood_ironclad_reach | 2–6 | 57618 | 3 | 6% | 12% | 7.2 |
| region_drowned_reach | 4–8 | 30369 | 7 | 23% | 40% | 11.5 |
| region_voidscar | 5–8 | 13298 | 6 | 12% | 63% | 13.8 |
| region_aether_kissed_highlands | 6–10 | 17622 | 4 | 32% | 13% | 12.3 |
| region_ashen_steppe | 7–11 | 9059 | 3 | 7% | 8% | 12.3 |
| region_glowfen | 8–12 | 1416 | 6 | 10% | 2% | 11.9 |
| region_glowlands_nexus | 9–13 | 8406 | 4 | 3% | 10% | 11.2 |
| region_veil | 10–14 | 5445 | 7 | 13% | 79% | 10.7 |
| region_skyreach | 12–15 | 3267 | 5 | 35% | 27% | 22.7 |

Median rounds by band:

```
silverwood_ruins (1–4)          ######### 2 rounds
mistwood_ironclad_reach (2–6)   ############## 3 rounds
drowned_reach (4–8)             ################################ 7 rounds
voidscar (5–8)                  ########################### 6 rounds
aether_kissed_highlands (6–10)  ################## 4 rounds
ashen_steppe (7–11)             ############## 3 rounds
glowfen (8–12)                  ########################### 6 rounds
glowlands_nexus (9–13)          ################## 4 rounds
veil (10–14)                    ################################ 7 rounds
skyreach (12–15)                ####################### 5 rounds
```

Death rate by band:

```
silverwood_ruins (1–4)          ##### 6%
mistwood_ironclad_reach (2–6)   ###### 6%
drowned_reach (4–8)             ##################### 23%
voidscar (5–8)                  ########### 12%
aether_kissed_highlands (6–10)  ############################# 32%
ashen_steppe (7–11)             ####### 7%
glowfen (8–12)                  ######### 10%
glowlands_nexus (9–13)          ## 3%
veil (10–14)                    ############ 13%
skyreach (12–15)                ################################ 35%
```

## Bosses · real

Every boss fight of the main and scenario suites. Phase = the highest boss phase the fight reached.

| Boss | Fights | Win rate | Median rounds | Highest phase reached |
| --- | --- | --- | --- | --- |
| cr_ashmaw | 100 | 21% | 10 | P1 36, P2 28, P3 36 |
| cr_bell_warden | 6 | 33% | 6 | P1 4, P3 2 |
| cr_chronos_tyrant_contained | 886 | 41% | 14 | P2 179, P3 707 |
| cr_chronos_tyrant_unveiled | 238 | 100% | 11 | P1 238 |
| cr_lantern_matron | 196 | 63% | 10 | P1 15, P2 41, P3 140 |
| cr_stormcrown | 240 | 12% | 6 | P1 124, P2 75, P3 41 |
| cr_unraveling_tide | 12 | 0% | 6 | P1 2, P2 6, P3 4 |
| cr_vells_umbra | 540 | 1% | 7.5 | P1 471, P2 62, P3 7 |

Fight length by band (DESIGN §19 #8) and the pre-Tyrant scenario sims (DESIGN §19 #19, melee and caster; effective HP = damage the party dealt in won fights):

| Band | Target rounds |
| --- | --- |
| fodder single | 3–5 |
| fodder pair/triple | 5–8 |
| elite | 6–9 |
| regional boss | 10–14 |
| Contained Tyrant | 12–18 |
| Unveiled Tyrant | 14–20 |

| Level | Class | Companion | Bot | Runs | Won | Win rate | Median rounds | Median damage dealt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 | elf | solo | caster | 19 | 15 | 79% | 32 | 514 |
| 11 | elf | solo | melee | 19 | 8 | 42% | 27.5 | 510 |
| 11 | elf | yes | caster | 20 | 2 | 10% | 28 | 751.5 |
| 11 | elf | yes | melee | 20 | 0 | 0% | — | — |
| 11 | ironclad_warden | solo | caster | 20 | 1 | 5% | 19 | 555 |
| 11 | ironclad_warden | solo | melee | 20 | 0 | 0% | — | — |
| 11 | ironclad_warden | yes | caster | 20 | 14 | 70% | 19.5 | 842.5 |
| 11 | ironclad_warden | yes | melee | 20 | 16 | 80% | 12 | 739 |
| 11 | ranger | solo | caster | 20 | 16 | 80% | 21.5 | 692 |
| 11 | ranger | solo | melee | 20 | 7 | 35% | 19 | 664 |
| 11 | ranger | yes | caster | 20 | 13 | 65% | 17 | 811 |
| 11 | ranger | yes | melee | 20 | 1 | 5% | 14 | 777 |
| 11 | shadow_weaver | solo | caster | 2 | 0 | 0% | — | — |
| 11 | shadow_weaver | solo | melee | 2 | 0 | 0% | — | — |
| 11 | shadow_weaver | yes | caster | 20 | 1 | 5% | 16 | 735 |
| 11 | shadow_weaver | yes | melee | 20 | 0 | 0% | — | — |
| 11 | wizard | solo | caster | 20 | 14 | 70% | 10 | 644 |
| 11 | wizard | solo | melee | 20 | 2 | 10% | 19 | 602 |
| 11 | wizard | yes | caster | 20 | 18 | 90% | 8 | 766 |
| 11 | wizard | yes | melee | 20 | 0 | 0% | — | — |
| 13 | elf | solo | caster | 19 | 14 | 74% | 30 | 514 |
| 13 | elf | solo | melee | 19 | 12 | 63% | 30 | 511.5 |
| 13 | elf | yes | caster | 20 | 1 | 5% | 30 | 759 |
| 13 | elf | yes | melee | 20 | 1 | 5% | 19 | 788 |
| 13 | ironclad_warden | solo | caster | 20 | 4 | 20% | 22.5 | 641.5 |
| 13 | ironclad_warden | solo | melee | 20 | 2 | 10% | 20 | 692.5 |
| 13 | ironclad_warden | yes | caster | 20 | 14 | 70% | 17.5 | 793 |
| 13 | ironclad_warden | yes | melee | 20 | 18 | 90% | 13 | 795.5 |
| 13 | ranger | solo | caster | 20 | 4 | 20% | 23 | 656.5 |
| 13 | ranger | solo | melee | 20 | 1 | 5% | 16 | 710 |
| 13 | ranger | yes | caster | 20 | 13 | 65% | 15 | 768 |
| 13 | ranger | yes | melee | 20 | 12 | 60% | 14 | 809 |
| 13 | shadow_weaver | solo | caster | 20 | 5 | 25% | 18 | 644 |
| 13 | shadow_weaver | solo | melee | 20 | 0 | 0% | — | — |
| 13 | shadow_weaver | yes | caster | 20 | 9 | 45% | 11 | 747 |
| 13 | shadow_weaver | yes | melee | 20 | 0 | 0% | — | — |
| 13 | wizard | solo | caster | 20 | 17 | 85% | 9 | 680 |
| 13 | wizard | solo | melee | 20 | 4 | 20% | 19 | 588.5 |
| 13 | wizard | yes | caster | 20 | 17 | 85% | 7 | 758 |
| 13 | wizard | yes | melee | 20 | 1 | 5% | 18 | 771 |

## Economy · real

- Median gold at the Contained Tyrant: 1391
- Median gold at the end of Loop 1: 212.5

Most-bought items:

| Item | Purchases |
| --- | --- |
| item_chronal_dust | 6581 |
| item_ley_touched_tonic | 6465 |
| item_brine_draught | 3158 |
| item_glow_moss | 2470 |
| item_mana_bloom | 2095 |
| mat_steppe_salt | 1058 |
| mat_ley_resin | 963 |
| item_antidote_root | 768 |
| item_scribes_robe | 449 |
| item_apprentice_staff | 336 |

Crafts by recipe:

| Recipe | Crafts |
| --- | --- |
| recipe_antidote_root | 3 |
| recipe_glyphbound_lantern | 1 |

Upgrades by the rarity reached:

| Rarity | Upgrades |
| --- | --- |
| rare | 524 |
| uncommon | 430 |
| epic | 58 |
| legendary | 1 |

## Quests · real

| Quest | Started | Completed | Failed | Median days | Completed by |
| --- | --- | --- | --- | --- | --- |
| q_a_boy_from_a_doomed_city | 0 | 0 | 0 | — |  |
| q_bell_vault | 208 | 108 | 0 | 5 | explorer |
| q_blighted_outpost | 2697 | 1932 | 0 | 3 | caster, explorer, melee, speedrunner |
| q_blood_and_salt | 3477 | 24 | 0 | 10 | caster, explorer, melee, random, speedrunner |
| q_bone_road | 1029 | 2 | 0 | 10 | explorer |
| q_class_elf | 472 | 152 | 0 | 6 | caster, explorer, melee, pacifist, random |
| q_class_ironclad_warden | 536 | 8 | 0 | 15 | explorer, speedrunner |
| q_class_ranger | 187 | 83 | 0 | 1 | caster, explorer, melee, pacifist, random |
| q_class_shadow_weaver | 330 | 49 | 0 | 5 | caster, pacifist |
| q_class_wizard | 553 | 310 | 0 | 0 | caster, melee, pacifist, random |
| q_clear_path | 3012 | 2726 | 0 | 2 | caster, explorer, melee, random, speedrunner |
| q_day_of_teeth | 986 | 80 | 0 | 12 | explorer, melee |
| q_echo_crystal | 3976 | 420 | 0 | 3 | explorer |
| q_echoing_heartbeat | 2612 | 2334 | 0 | 2 | caster, explorer, melee, pacifist, random, speedrunner |
| q_high_mark | 2095 | 684 | 0 | 7 | caster, explorer, melee, pacifist |
| q_his_masters_sin | 0 | 0 | 0 | — |  |
| q_hollow_choir | 475 | 475 | 0 | 0 | caster, explorer, pacifist, speedrunner |
| q_iron_silence | 0 | 0 | 0 | — |  |
| q_keepers_ledger | 11 | 6 | 0 | 3 | explorer |
| q_lantern_in_the_reeds | 214 | 157 | 0 | 0 | caster, explorer, melee |
| q_lightless_stair | 997 | 473 | 0 | 3 | caster, explorer, pacifist, speedrunner |
| q_long_archive | 0 | 0 | 0 | — |  |
| q_lost_scroll | 420 | 279 | 0 | 5 | explorer |
| q_preserve_or_heal | 0 | 0 | 0 | — |  |
| q_seven_marks | 0 | 0 | 0 | — |  |
| q_stop_the_ritual | 0 | 0 | 0 | — |  |
| q_tears_of_the_breach | 162 | 25 | 0 | 2 | caster, explorer |
| q_the_apprentices_errand | 0 | 0 | 0 | — |  |
| q_the_danthe_line | 1 | 0 | 0 | — |  |
| q_the_dark_between | 1 | 1 | 0 | 2 | explorer |
| q_the_drowned_lantern | 45 | 24 | 0 | 1 | explorer |
| q_the_first_drowned | 0 | 0 | 0 | — |  |
| q_the_flickering_man | 656 | 30 | 0 | 21 | explorer |
| q_the_keepers_price | 0 | 0 | 0 | — |  |
| q_the_last_instant | 0 | 0 | 0 | — |  |
| q_the_line_he_holds | 17 | 0 | 0 | — |  |
| q_the_mending | 0 | 0 | 0 | — |  |
| q_the_scouts_oath | 1162 | 959 | 0 | 12 | caster, explorer, melee, speedrunner |
| q_the_still_shore | 3340 | 226 | 0 | 0 | random |
| q_the_thirtieth_dawn | 2917 | 1377 | 0 | 3 | caster, explorer, melee, pacifist |
| q_unbound | 219 | 219 | 0 | 0 | caster, speedrunner |
| q_unlidded_eye | 155 | 0 | 0 | — |  |
| q_voices_in_the_stacks | 215 | 4 | 0 | 25.5 | explorer |
| q_void_shards | 3551 | 1973 | 0 | 2 | caster, explorer, melee |
| q_wardens_vigil | 0 | 0 | 0 | — |  |
| q_weavers_dawn | 0 | 0 | 0 | — |  |
| q_what_she_would_undo | 0 | 0 | 0 | — |  |
| q_what_the_crystal_heard | 198 | 27 | 0 | 6 | explorer |
| q_what_the_light_takes | 0 | 0 | 0 | — |  |

## Echoes · real

Runs of the main suite that gained each Echo, and how many gained it in Loop 1.

| Echo | Gained | In Loop 1 |
| --- | --- | --- |
| echo_amulet_memory | 3542 | 0 |
| echo_anchor_half_a | 0 | 0 |
| echo_anchor_half_b | 0 | 0 |
| echo_anchor_mechanic | 0 | 0 |
| echo_anchor_schema | 0 | 0 |
| echo_apex_resonance | 345 | 90 |
| echo_archive_door | 270 | 242 |
| echo_before_route | 0 | 0 |
| echo_bell_vault | 108 | 54 |
| echo_bells_of_silverwood | 0 | 0 |
| echo_borin_oath | 391 | 382 |
| echo_brak_birth_name | 959 | 0 |
| echo_brak_death | 72 | 72 |
| echo_brak_lives | 0 | 0 |
| echo_breach_clock | 1747 | 836 |
| echo_breach_door | 15 | 0 |
| echo_breach_recoil | 18 | 0 |
| echo_breathing_pool | 0 | 0 |
| echo_caelum_bond | 0 | 0 |
| echo_caelum_cannot | 0 | 0 |
| echo_caelum_forgives | 0 | 0 |
| echo_caelum_stayed | 0 | 0 |
| echo_caelum_unanchored | 0 | 0 |
| echo_choir_knows | 3 | 0 |
| echo_crystal_location | 464 | 461 |
| echo_crystal_seeded | 0 | 0 |
| echo_dask_bond | 0 | 0 |
| echo_dask_rest | 0 | 0 |
| echo_day_of_teeth | 1 | 0 |
| echo_dreyl_brand | 676 | 327 |
| echo_emberforge_vein | 15 | 11 |
| echo_ending_a | 0 | 0 |
| echo_ending_b | 0 | 0 |
| echo_ending_c | 0 | 0 |
| echo_ending_d | 0 | 0 |
| echo_ending_e | 0 | 0 |
| echo_ending_f | 219 | 0 |
| echo_eye_of_masque | 117 | 98 |
| echo_flickering_man | 30 | 0 |
| echo_glowfen_dammed | 0 | 0 |
| echo_glowfen_let_run | 0 | 0 |
| echo_glowlands_leak | 214 | 200 |
| echo_hadrek_clockwright | 0 | 0 |
| echo_hallow_said_stop | 0 | 0 |
| echo_hallows_ember | 4 | 0 |
| echo_heartstone_hunger | 899 | 891 |
| echo_heartstone_path | 2337 | 2236 |
| echo_heartstone_resonance | 1338 | 1014 |
| echo_heartstone_silence | 443 | 327 |
| echo_heartstone_triune | 0 | 0 |
| echo_high_mark | 1134 | 981 |
| echo_hollow_path | 3310 | 2817 |
| echo_horde_path | 3542 | 3542 |
| echo_ilyra_bond | 0 | 0 |
| echo_ilyra_cost | 1538 | 0 |
| echo_ilyra_watchword | 4 | 0 |
| echo_iron_that_does_not_wish | 4 | 0 |
| echo_ironclad_oath | 1734 | 1655 |
| echo_ironclad_passwords | 2726 | 2636 |
| echo_kaelen_ledger | 107 | 15 |
| echo_korr_marginalia | 1482 | 0 |
| echo_lightless_stair | 473 | 0 |
| echo_litany_complete | 0 | 0 |
| echo_litany_verse_1 | 424 | 402 |
| echo_litany_verse_2 | 874 | 566 |
| echo_litany_verse_3 | 0 | 0 |
| echo_litany_verse_4 | 4 | 0 |
| echo_litany_verse_5 | 0 | 0 |
| echo_litany_verse_6 | 0 | 0 |
| echo_litany_verse_7 | 0 | 0 |
| echo_litany_verse_8 | 62 | 0 |
| echo_litany_verse_9 | 0 | 0 |
| echo_mireya_bond | 0 | 0 |
| echo_nine_voices | 198 | 0 |
| echo_ninth_verse_unfinished | 27 | 0 |
| echo_nomad_signs | 1445 | 593 |
| echo_nyx_bond | 0 | 0 |
| echo_nyx_is_of_the_nine | 296 | 35 |
| echo_oriel_drowned | 0 | 0 |
| echo_oriel_lineage | 2573 | 1896 |
| echo_portal_tear | 0 | 0 |
| echo_rhune_choice | 3216 | 2899 |
| echo_ritual_inevitable | 0 | 0 |
| echo_seven_wayfinders | 30 | 0 |
| echo_shard_moments | 25 | 0 |
| echo_six_in_the_mass | 106 | 0 |
| echo_sky_oath | 376 | 338 |
| echo_spire_note | 499 | 432 |
| echo_steppe_waystones | 2 | 0 |
| echo_stone_hide_origin | 1229 | 0 |
| echo_thirtieth_dawn | 3475 | 3452 |
| echo_threshold | 226 | 0 |
| echo_tyrant_consent | 0 | 0 |
| echo_tyrant_jailer | 31 | 0 |
| echo_tyrant_name | 58 | 0 |
| echo_tyrant_never_struck | 213 | 29 |
| echo_tyrant_rejected | 0 | 0 |
| echo_tyrant_speaks | 219 | 0 |
| echo_vask_seal | 1844 | 1649 |
| echo_void_resonance | 92 | 35 |
| echo_wayfinder_symptom | 0 | 0 |
| echo_weaver_sign | 1240 | 785 |
| echo_what_she_would_undo | 0 | 0 |

## Companions · real

| Companion | Recruited | Knocked out | Died | Average loyalty |
| --- | --- | --- | --- | --- |
| brak | 2641 | 13 | 72 | 12.0 |
| caelum | 0 | 0 | 0 | 0 |
| dask | 401 | 4 | 0 | 9.2 |
| ilyra | 77 | 6 | 0 | 7.1 |
| mireya | 214 | 4 | 0 | 10.0 |
| nyx | 1168 | 4 | 0 | 0.9 |

## Coverage · real

The union of every run of the pack, scripted `pathBot` proofs included.

| Kind | Reached | Of | Share |
| --- | --- | --- | --- |
| quests completed | 38 | 49 | 77.6% |
| locations visited | 59 | 73 | 80.8% |
| endings reached | 8 | 8 | 100.0% |
| creatures killed | 62 | 73 | 84.9% |
| items obtained | 116 | 157 | 73.9% |
| echoes gained | 75 | 103 | 72.8% |
| codex unlocked | 80 | 90 | 88.9% |
| abilities used | 58 | 107 | 54.2% |
| dialogue choices taken | 183 | 319 | 57.4% |

Never reached (each entry is reached in the next batch or justified here):

- **quests never started** (9): q_a_boy_from_a_doomed_city, q_his_masters_sin, q_preserve_or_heal, q_seven_marks, q_stop_the_ritual, q_the_apprentices_errand, q_the_first_drowned, q_the_last_instant, q_what_the_light_takes
- **quests started, never completed** (2): q_the_line_he_holds, q_unlidded_eye
- **locations never visited** (14): loc_apprentices_garret, loc_archives_of_danthe, loc_cistern_gardens, loc_conflux_chamber, loc_far_light, loc_gallery_of_loops, loc_grand_library, loc_loom, loc_ninefold_hall, loc_outer_walks, loc_plaza_of_bells, loc_scholars_corridor, loc_silver_gate, loc_still_shore
- **creatures never seen** (8): cr_anomaly_early_hound, cr_circle_adept, cr_city_watch_halberdier, cr_hour_leech, cr_ley_hound, cr_ninefold_knight, cr_redundant_wayfinder, cr_unbroken_warden
- **creatures never killed** (11): cr_anomaly_aberration_pair, cr_anomaly_early_hound, cr_chronos_tyrant_unveiled, cr_circle_adept, cr_city_watch_halberdier, cr_hour_leech, cr_ley_hound, cr_ninefold_knight, cr_redundant_wayfinder, cr_unbroken_warden, cr_unraveling_tide
- **items never obtained** (41): item_archivists_circlet, item_breach_anchor_schematic_b, item_breachglass_focus, item_breachsteel_blade, item_breachwarden_mail, item_caelums_anchor_token, item_cinderhorn_plate, item_conflux_robe, item_emberwrought_blade, item_galefeather_bow, item_hallows_hammer, item_heartwood_bow, item_hour_spindle, item_lanternreed_salts, item_ley_tuned_charm, item_ley_tuned_staff, item_ley_tuned_tonic, item_ley_tuned_vestment, item_litany_page_3, item_nomad_sabre, item_oathplate, item_oriels_quill, item_pattern_breachglass_focus, item_pattern_breachsteel_blade, item_pattern_breachwarden_mail, item_pattern_conflux_robe, item_pattern_hallows_hammer, item_pattern_heartwood_bow, item_pattern_sunderforged_plate, item_silverwood_honeycake, item_spireweave_mantle, item_sunderforged_plate, item_unlidded_eye, item_veil_sigil, item_veil_threadmail, item_voidforged_band, item_voidforged_edge, item_voidforged_mail, item_ward_seal, item_warder_plate … +1 more
- **Echoes never gained** (28): echo_anchor_half_a, echo_anchor_half_b, echo_anchor_mechanic, echo_before_route, echo_bells_of_silverwood, echo_brak_lives, echo_breathing_pool, echo_caelum_bond, echo_caelum_cannot, echo_caelum_forgives, echo_caelum_stayed, echo_caelum_unanchored, echo_crystal_seeded, echo_dask_bond, echo_dask_rest, echo_glowfen_dammed, echo_glowfen_let_run, echo_hadrek_clockwright, echo_hallow_said_stop, echo_heartstone_triune, echo_litany_verse_3, echo_litany_verse_5, echo_litany_verse_6, echo_litany_verse_7, echo_mireya_bond, echo_ritual_inevitable, echo_tyrant_rejected, echo_wayfinder_symptom
- **codex entries never unlocked** (10): codex_anchors, codex_breach, codex_caelum, codex_imre_sallow, codex_item_amulet, codex_region_silverwood_before, codex_region_silverwood_ruins, codex_remnants, codex_wayfinder_nature, codex_wayfinder_symptom
- **abilities never used** (49): comp_caelum_chrono_shard, comp_caelum_foresight, comp_caelum_haste, comp_caelum_stutter, comp_dask_between_instants, comp_ilyra_archive_light, comp_mireya_lanternreed_bloom, comp_mireya_spore_cloud, comp_nyx_drink, comp_nyx_hex, comp_nyx_unmaking, elf_final_verse, elf_heart_of_the_grove, elf_moment_between, elf_silverwood_bloom, elf_veilwalk, itm_barrow_light_vial, itm_ember_flask, itm_fenlight_salve, itm_lantern_oil, itm_stillwater_phial, itm_storm_jar, itm_ward_salts, rgr_apex_predator, rgr_exsanguinate, rgr_hamstring, rgr_hunters_eye, rgr_killing_shot, rgr_pinning_shot, rgr_smoke_bomb, rgr_snare_trap, wiz_gale_step, wiz_immolate, wiz_pyre_of_the_nine, wiz_skyfall, wiz_stutter, wiz_unmoment, wrd_iron_silence, wrd_last_bastion, wrd_oathbound … +9 more
- **dialogue choices never taken** (136): scene_anchor_in_the_conflux/only_thing, scene_anchor_in_the_conflux/stole, scene_bell_vault_bells/first_archive, scene_bell_vault_bells/fountain_order, scene_bell_vault_bells/leave, scene_bell_vault_bells/then_archive, scene_brak_arc/apex, scene_brak_arc/colour, scene_brak_arc/come_anyway, scene_brak_arc/nexus, scene_brak_arc/not_now, scene_brak_arc/stay, scene_brak_arc/tell, scene_brak_arc/words, scene_brak_camp_2/leave_it, scene_caelum_boy_offer/show, scene_caelum_boy_offer/tell, scene_caelum_camp_1/ask, scene_caelum_camp_1/verse, scene_caelum_camp_2/back, scene_caelum_camp_2/left, scene_caelum_camp_3/chose, scene_caelum_camp_3/kind, scene_caelum_crossing/come, scene_caelum_crossing/five_hundred, scene_caelum_crossing/stay, scene_caelum_errand_offer/no, scene_caelum_errand_offer/yes, scene_caelum_his_masters_sin/cannot, scene_caelum_his_masters_sin/forgive, scene_caelum_mending_offer/no, scene_caelum_mending_offer/yes, scene_caelum_recruit/come, scene_caelum_recruit/later, scene_caelum_sin_offer/no, scene_caelum_sin_offer/yes, scene_caelum_spire_yard/honest, scene_caelum_spire_yard/later, scene_caelum_spire_yard/lie, scene_caelum_spire_yard/walk … +96 more

## Blockers · real

Every entry is a release blocker; the seed reproduces it. Grouped by suite, bot, class, scenario and kind (the first run of each group is the one to replay):

| Suite | Bot | Class | Scenario | Kind | Runs | First repro |
| --- | --- | --- | --- | --- | --- | --- |
| main | explorer | elf | — | combat_stall | 1 | `npm run sim:replay -- --pack real --bot explorer --class elf --seed balA:12 --stop-at ending --max-steps 6000 --max-loops 3` |
| main | explorer | wizard | — | combat_stall | 1 | `npm run sim:replay -- --pack real --bot explorer --class wizard --seed balA:19 --stop-at ending --max-steps 6000 --max-loops 3` |
| main | pacifist | elf | — | combat_stall | 8 | `npm run sim:replay -- --pack real --bot pacifist --class elf --seed balA:8 --stop-at ending --max-steps 6000 --max-loops 3` |
| main | pacifist | ironclad_warden | — | combat_stall | 17 | `npm run sim:replay -- --pack real --bot pacifist --class ironclad_warden --seed balA:1 --stop-at ending --max-steps 6000 --max-loops 3` |
| main | pacifist | ranger | — | combat_stall | 6 | `npm run sim:replay -- --pack real --bot pacifist --class ranger --seed balA:1 --stop-at ending --max-steps 6000 --max-loops 3` |

In detail (10 of 33):

- **real · explorer · elf · seed `balA:12`** (main, stop: soft_lock)
  - soft-lock at step 1120 (combat_stall): fight enc_barrows_light_night at round 61 (> 60)
  - last actions: attack attack attack attack attack attack ability attack attack attack attack attack attack attack ability attack attack attack attack attack
  - reproduce: `npm run sim:replay -- --pack real --bot explorer --class elf --seed balA:12 --stop-at ending --max-steps 6000 --max-loops 3`
- **real · explorer · wizard · seed `balA:19`** (main, stop: soft_lock)
  - soft-lock at step 939 (combat_stall): fight enc_mouth_lanterns at round 61 (> 60)
  - last actions: attack attack attack attack attack attack attack attack attack attack attack attack attack attack attack attack attack attack attack attack
  - reproduce: `npm run sim:replay -- --pack real --bot explorer --class wizard --seed balA:19 --stop-at ending --max-steps 6000 --max-loops 3`
- **real · pacifist · elf · seed `balA:8`** (main, stop: soft_lock)
  - soft-lock at step 545 (combat_stall): fight enc_stair_null_mouth at round 61 (> 60)
  - last actions: attack ability ability attack attack attack attack attack ability attack ability attack attack ability attack attack attack attack attack attack
  - reproduce: `npm run sim:replay -- --pack real --bot pacifist --class elf --seed balA:8 --stop-at ending --max-steps 6000 --max-loops 3`
- **real · pacifist · elf · seed `balA:10`** (main, stop: soft_lock)
  - soft-lock at step 386 (combat_stall): fight enc_stair_null_mouth at round 61 (> 60)
  - last actions: attack ability ability attack attack ability attack attack ability ability attack attack ability attack ability ability attack ability attack attack
  - reproduce: `npm run sim:replay -- --pack real --bot pacifist --class elf --seed balA:10 --stop-at ending --max-steps 6000 --max-loops 3`
- **real · pacifist · elf · seed `balA:17`** (main, stop: soft_lock)
  - soft-lock at step 368 (combat_stall): fight enc_stair_null_mouth at round 61 (> 60)
  - last actions: attack ability attack attack ability attack attack attack ability ability attack ability attack attack ability ability attack attack ability attack
  - reproduce: `npm run sim:replay -- --pack real --bot pacifist --class elf --seed balA:17 --stop-at ending --max-steps 6000 --max-loops 3`
- **real · pacifist · ironclad_warden · seed `balA:1`** (main, stop: soft_lock)
  - soft-lock at step 589 (combat_stall): fight enc_stair_null_mouth at round 61 (> 60)
  - last actions: ability attack attack attack attack ability attack ability ability ability attack ability attack ability ability attack attack ability attack ability
  - reproduce: `npm run sim:replay -- --pack real --bot pacifist --class ironclad_warden --seed balA:1 --stop-at ending --max-steps 6000 --max-loops 3`
- **real · pacifist · ironclad_warden · seed `balA:14`** (main, stop: soft_lock)
  - soft-lock at step 508 (combat_stall): fight enc_eye_umbra at round 61 (> 60)
  - last actions: ability ability attack ability ability attack ability ability attack attack ability ability ability ability attack attack ability attack attack ability
  - reproduce: `npm run sim:replay -- --pack real --bot pacifist --class ironclad_warden --seed balA:14 --stop-at ending --max-steps 6000 --max-loops 3`
- **real · pacifist · ironclad_warden · seed `balA:17`** (main, stop: soft_lock)
  - soft-lock at step 536 (combat_stall): fight enc_stair_null_mouth at round 61 (> 60)
  - last actions: attack ability ability ability attack ability attack ability ability ability attack ability attack attack ability attack attack attack attack attack
  - reproduce: `npm run sim:replay -- --pack real --bot pacifist --class ironclad_warden --seed balA:17 --stop-at ending --max-steps 6000 --max-loops 3`
- **real · pacifist · ranger · seed `balA:1`** (main, stop: soft_lock)
  - soft-lock at step 476 (combat_stall): fight enc_stair_null_mouth at round 61 (> 60)
  - last actions: attack attack attack ability attack ability attack attack ability ability attack ability attack ability ability attack attack ability attack attack
  - reproduce: `npm run sim:replay -- --pack real --bot pacifist --class ranger --seed balA:1 --stop-at ending --max-steps 6000 --max-loops 3`
- **real · pacifist · ranger · seed `balA:10`** (main, stop: soft_lock)
  - soft-lock at step 519 (combat_stall): fight enc_stair_null_mouth at round 61 (> 60)
  - last actions: attack attack ability ability attack ability attack attack attack attack attack ability attack ability attack attack attack ability attack ability
  - reproduce: `npm run sim:replay -- --pack real --bot pacifist --class ranger --seed balA:10 --stop-at ending --max-steps 6000 --max-loops 3`

- **real · scenario · caster ranger balS:16 communion_movement_2** crashed the job: scenario communion_movement_2: cannot walk in ending mode (ending at loc_chronos_nexus, Day 2, 138 steps)

## Recommendations · real

- Fix the Blockers first: a balance number from a run that errored or soft-locked cannot be trusted.
- Ability elf_ambush deals 63% of elf's damage (over 35 %) — reduce its scale or raise its cooldown.
- Ability rgr_piercing_arrow deals 47% of ranger's damage (over 35 %) — reduce its scale or raise its cooldown.
- Difficulty is not monotone across the level bands — see the Region curve: re-tune the creature stats of the band that dips.
- Fight lengths leave their bands — see Targets #8: scale creature HP (not ATK) to bring the median rounds into range.
- Loop 1 deaths are off — too many for melee/caster (soften the early bands) or too few for random (the game must punish aimless play).
- A class is outside its ability-usage band — a share too low means the abilities cost too much for the MP pool, too high means basic attacks are never worth it.
- Economy is off — see Targets #14: tune kill gold, the cheapest healing price or the quest rewards.
- The clock expires too often or too rarely for the explorer — adjust the number of days a full exploration needs, or the Heartstone clock bonus.
- The Contained Tyrant misses its target — see Bosses: adjust its HP or phase damage until L11 wins ≥ 60 % in 12–18 rounds.
- Some bot did not finish its runs — see Blockers.
- Content is out of reach of the sims — see Coverage for the punch list; add a pathBot script (scripts/quests.ts) for anything a policy bot cannot do.
- 40 scenario sim(s) were skipped on this pack (it, or the class, cannot get through them): pre_tyrant_l11_ranger: the Wayfinder fell | pre_tyrant_l13_ranger: the Wayfinder fell.

<!-- U81b1 re-measure (hand-written, appended; the generated U80 report above is unchanged). -->
# After U81b1: the fair bots, re-measured

**1,016 runs** at `db61c91` (U81b1's bots, no balance change): 600 main runs (6 bots x 5 classes x 20 seeds), 392 pre-Tyrant / communion
scenario runs (10 seeds per cell; 28 more skipped, all `pre_tyrant_l11/l13_ranger` with the companion: "the Wayfinder fell" on the walk,
as in U80), 24 ending-script runs. **0 engine errors, 0 soft-locks, 0 blockers; determinism 40/40.** Three foreground chunks, merged with
`--merge` (U80's method): `balA` 10 seeds all bots; `balB` 10 seeds explorer, random, speedrunner; `balB` 10 seeds melee, caster, pacifist
with `--scenario-seeds 10`. Reproduce chunk 1 with `npm run sim:balance -- --seeds 10 --seed-prefix balA --workers 2 --scenario-seeds 0
--determinism 20 --json a.json --out a.md`. N is 20 per class and bot (U80: 100-200), so every rate below has a wide interval (one run = 5 %).

**Read this first: row #1 changed meaning, not only value.** U80 counted the portal reached with the Tyrant untouched (the expiry Horde
opens Ilyra's portal too, DESIGN §10.2) as an Escape: most of its 94-98 % were that. U81b1 counts it as an expiry (`metrics.ts`), as
DESIGN §19 #1 reads ("kill the Contained Tyrant and reach the portal"). Under the honest count the `melee` bot escapes 0-5 % and the
`caster` 0-25 %, because of their Heartstone policies (PLAN §7.2, kept): `melee` **destroys** it by Day 10 (limit Day 20, Loop 1 ends at a
median Day 21, never at L11 for the Apex) and `caster` **exploits** it (limit Day 25). A 6-seed check with the melee bot stabilizing
instead (not committed): Escape elf 67 %, warden 83 %, ranger 67 %, weaver 67 %, wizard 100 %. The `explorer` (stabilizes) escapes 50-90 %.
Whether #1's bots should keep those choices is a lead decision before U81b2 tunes anything from row #1.

## §1.2 gates (U80 -> after U81b1)

| Gate | U80 | After U81b1 |
| --- | --- | --- |
| Bots complete runs | FAIL: 458 of 4,000 stop early (11 %) | FAIL: 16 of 600 (2.7 %), all FALLEN stops; 0 engine errors |
| Loop 1 Escape >= 60 % (melee or caster) | "PASS" (counted expiry portals) | FAIL under the honest count: worst class 0 % (see above) |
| Zero soft-locks | FAIL: 33 (31 pacifist) | **PASS: 0** in 1,016 runs (pacifist stalls 0) |
| Coverage | quests 38/49, locations 59/73, endings 8/8 | quests **41/49**, locations **73/73**, endings 8/8, creatures killed 68/73, items 120/157 |
| Determinism | 248/248 | 40/40 |

## The DESIGN §19 rows (U80 -> after U81b1)

| # | Target | U80 | After U81b1 | Bot or game? |
| --- | --- | --- | --- | --- |
| 1 | Escape >= 60 % per class | 61 % worst ("pass", see above) | worst 0 %; melee 0-5 %, caster 0-25 %, explorer 50-90 % | bot policy (Heartstone) + metric; then the Tyrant (#19) |
| 2 | no ability > 35 % | elf_ambush 62.9 %, rgr_piercing_arrow 46.9 % | rgr_piercing_arrow 47.3 %, wiz_lightning_bolt 41.8 %, elf_flurry 40.9 % (elf_ambush now 14.5 %) | game: the kit used in full concentrates on these three |
| 3 | monotone difficulty | 8 violations | 7 violations (Drowned Reach 4-8: 17 % deaths, 5 rounds; Skyreach 12-15: 25 %) | game |
| 4 | every ending | 6/6 | 6/6 | pass |
| 5 | every quest | 38/49 | 41/49 (never started: q_his_masters_sin, q_preserve_or_heal, q_the_first_drowned, q_the_last_instant; started, never done: q_seven_marks, q_stop_the_ritual, q_the_line_he_holds, q_what_the_light_takes) | late arcs that need loyalty, bonds or the communion; `scripts/quests.ts` proves them |
| 6 | every location | 59/73 | **73/73** | pass |
| 7 | zero soft-locks | 33 | **0** | pass (thin: 1,016 runs) |
| 8 | fight length | single 2, pair 4, elite 9, boss 9, Tyrant 13 | single 2, pair 4, elite 8, boss 8, Tyrant 13 | game (fodder and bosses die fast to a full kit) |
| 9 | deaths per loop | melee 4.88, caster 6.73, explorer 10.38, random 7.88 | melee **1.56** (47 % zero-death), caster 3.79 (7 %), explorer **3.14**, random 7.87 | partly game: Drowned Reach, Skyreach, the Tyrant retries |
| 10 | loop duration | explorer 36 days / 670 actions; speedrunner 33 days | explorer 32 days / 802 actions; speedrunner 37 days median (min 14); Loop 3+ 503 actions | see the speedrunner below |
| 11 | level at the Apex | explorer 14; speedrunner not measured | explorer 15; speedrunner **10** (>= 9 ok) | explorer: game (XP curve vs days) |
| 12 | ability usage | ranger 50, warden 54, elf 68, wizard 25, weaver 37 %; Blood price 0 % | ranger 69, warden 79, elf 71, wizard 84, weaver 81 %; Blood price **2 %** | game: resources are plentiful (see below) |
| 13 | 0-MP fights <= 15 % | 1 % | 1 % | pass |
| 14 | economy | end-of-Loop-1 gold 596.5 | 1,018 (n = 295; more kills, same lack of sinks) | game |
| 15 | clock | explorer 6 %, speedrunner 58 % | explorer 29 % (stabilized 96/100), speedrunner 56 % | speedrunner: the Tyrant at L9-11 (below) |
| 16 | resistance relevance | 1 band off (band 10, 6 encounters) | same | thin sample |
| 17 | companion value | 39 % | **32 %** | pass |
| 18 | variance sanity | not measurable | not measurable | needs an engine hook |
| 19 | Contained Tyrant (scenarios) | L11 solo wins elf 79, ranger 80, wizard 70, warden 5, weaver 0 % (caster bot) | L11 solo wins elf 100, warden **100**, ranger 20, wizard 80 %; L13 solo elf 88, warden 20, ranger 10, weaver 90, wizard 90 %; with Brak at L11 elf 0, ranger 0, warden 30, weaver 100, wizard 90 %; L11 median rounds elf 27, warden 27, ranger 20.8, wizard 11.5; effective HP 589 solo / 756 with a companion | game: the ranger at L11-13, the elf and ranger with a companion, the round counts |
| 20 | Unveiled Tyrant | communion 19/19, fight path unmeasured | communion 20/20, fight path unmeasured | n/a |

## What the fair bots changed, item by item (brief U81b1)

1. **Every bot plays its class** (`classFight.ts`): Wizard and Weaver ability share under melee / explorer / speedrunner is now 82-87 %
   (U80: 0-5 %). Usage is now **over** #12's bands for every class (69-84 %), with 0-MP fights at 1 %: a bot that spends its pool whenever an
   ability beats a basic attack never runs dry, so the bands read the resource economy (pools, costs, Focus/Grit gain), not the policy.
   A U81b2 finding, not a bot fix.
2. **Blood price** is cast when HP stays comfortable (>= 40 % after the cost and above the telegraphed blows): 2 % of 14,105 Weaver casts
   (explorer 2.7 %, melee 2.8 %, speedrunner 3.4 %, caster 1.0 %). It is rare because the Weaver is almost never short of MP: in a 4-run
   trace only 1 of 368 combat decisions had a damaging spell it could not pay in MP. 10-30 % needs a smaller pool or dearer spells (U81b2).
3. **The speedrunner runs** (fights what it meets, flees >= +3, takes only the gate's quests, stabilizes, short rests): it reaches the Apex
   at **Day 12-21 (median about 15) at L9-10** in every class (traces of 21 runs), inside DESIGN §10's 12-16. It then loses the Contained
   Tyrant at L9-11 and retries after each level up until the clock runs out (deaths 6-15 a loop): wizard 75 % Escape at a median Day 22.5,
   warden 45 %, elf 40 %, weaver 20 %, ranger 0 %. **The best Loop 1 the route allows is about 15 days; what fails is the Tyrant at
   §19 #11's "speedrunner >= 9"** (a game finding for U81b2, with #19's ranger).
4. **Danger**: Vell's Umbra (L16 at the Eye) fought 5 times (U80: 540 fights, 1 % wins); the danger rules leave such fights for later.
5. **Pacifist stalls: 0** (U80: 31).
6. **Quest following**: quests 41/49 and locations 73/73. U81b1's second pass made Caelum recruitable by a policy bot (0 recruits in
   U80's 4,000 runs): the explorer keeps the Before's appointments (the errand's offer at the Garret at noon on Last Bell, the Plaza at
   noon, the Silver Gate after dusk with Caelum at its side) by resting at the Garret, and swaps a companion in when an objective asks for
   it. **Game finding:** the generic quest *Accept* on any talk with Caelum starts `q_the_apprentices_errand` (and `q_a_boy_from_a_doomed_city`)
   on their first stage, which only the offer scene's `questAdvance` leaves; the offer scene then never plays again (`notStarted`), so a
   player who presses Accept strands the quest for the loop. Bots now leave those two to their scene (`acceptable()`); the content or the
   Accept rule needs the fix.
7. **Scenario kits**: the Warden's L11 solo win went from 5 % to 100 % with the typical-player kit (full runs: the Warden is the best class
   at the Tyrant). The kit no longer explains #19; the ranger (20 % / 10 %) and the companion cases (elf and ranger 0 % with Brak at L11) do.
8. **`communion_movement_2`**: no crash (0 errors in 392 scenario runs).

Traces were re-recorded (`db61c91`): they are recorded by the policy bots, whose choices changed.
