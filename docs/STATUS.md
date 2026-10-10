# STATUS — The Unraveling rebuild

**Branch:** `unraveling` (never push to `main`). **Last checkpoint:** see `git log`.
**Current phase:** Phase 0 (design docs) — step 3 of 5. No application code exists yet.

This file is the resumption point. Read it first, then `DECISIONS.md` (canon), then the
docs named below. Update this file at every stopping point.

---

## 1. Where things stand

| Item | State | Notes |
|---|---|---|
| Read the whole legacy repo | ✅ done | Findings recorded in `DECISIONS.md` Part A |
| `docs/DECISIONS.md` | ✅ Parts A–E written | D-001..D-061. Part E rules on every open question raised by the four docs. Append-only. |
| `docs/DESIGN.md` (systems) | ✅ complete draft, 20 sections, ~27k words | Written BEFORE Part E; must be revised to conform (see §3 below). Not yet reviewed. |
| `docs/STORY.md` (narrative) | ✅ complete draft, 16 sections, ~28k words | 44 quests, 75 Echoes, 85 codex entries, 20 scenes, the Litany, the Nine, 6 endings. Written before Part E; needs conformance pass. Not yet reviewed. |
| `docs/PLAN.md` (engineering) | ✅ complete draft, 14 sections + Appendix A, ~28k words | Uses an id convention that Part E **overrides** (D-044: typed prefixes are part of ids). Appendix A and code samples must change. Not yet reviewed. |
| `docs/WORLD.md` (world bible) | ⚠️ **incomplete** — §1 Geography, §2 Regions (12), §3 Locations (all 73, with exits/conditions/encounters/events/map positions, §3.13 reachability) | **Missing §4–§13**: NPCs, creature families, creatures (≥50; §3 already references ~58 `cr_*` ids that must be defined), items (≥120; ~59 `item_*` referenced), crafting/recipes, merchants, encounter design + pacifist routes, map data consolidation, world-state variants, open questions. Brief saved at `docs/briefs/world-continuation.md`. |
| Adversarial reviews of each doc | ⏳ not started | Briefs saved at `docs/briefs/review-design.md`, `review-story.md`, `review-plan.md`. A WORLD review brief should be written once WORLD.md is complete (same shape). Reports go to `docs/reviews/REVIEW-<DOC>.md`. |
| Revisions after review | ⏳ not started | Plan: hand each review to a revision agent (or the original writer via SendMessage if still alive — they are not; agents from this session are gone). |
| `docs/BIBLE.md` (continuity bible) | ⏳ not started | Extract from STORY/WORLD/DECISIONS after revisions: names, spellings, dates, who-knows-what-when, place facts, item facts. Then a dedicated continuity-checker pass over all writing. |
| Phase 1+ (code) | ⏳ not started | See `PLAN.md` §9 workstreams. |

Task-list mirror (session widget): #1 done; #2 in progress (WORLD.md tail outstanding); #3–#10 pending.

---

## 2. Agent reports received (facts to carry forward)

**DESIGN.md writer** — key numbers chosen (treat as draft until review): XP per level 100, 150,
220, 300, 400 … 3,660 (cum. 4,100 at L10; 26,900 at L20); base stats per class (Ranger
100/36/10/6/8, Wizard 84/50/6/11/7, Elf 90/44/7/7/10, Warden 116/30/12/5/7, Weaver 90/48/6/10/8;
max HP = base + growth·(L−1) + 2·STR); hit% = clamp(85 + ⌊AGI/2⌋ − ⌊defAGI/2⌋, 50, 100); crit 5 +
⌊AGI/2⌋ at ×1.5; damage variance ×U(0.90, 1.10); Guard 50% (Warden 65%); flee 40 + 3·AGI −
2·maxEnemyAGI; 18 statuses + `status_rested`; 75 abilities (15 × 5); 12 affixes; 139 items by
type (30 weapons, 18 armor, 20 trinkets, 16 consumables, 21 materials, 14 quest, 6 keys, 10
recipes, 4 tomes); clock 4 watches/day, travel 1 watch, short rest 1 watch (+30%), full rest → dawn;
Resonance +2 location / +3 bestiary / +1 codex / +5 quest / +50 ending / +10 closer; 15
Attunements (15–60 each, max 5 equipped); 40 achievements; Loop 1 ≈ 1,250 gold earned.
It proposed the Contained/Unveiled Tyrant split (now D-051) and the two Heartstone fragments
(now D-052).

**STORY.md writer** — the five invented members of the Nine: Haldric Vane (Warder; verse III;
origin of Stone-Hide Golems; Blighted Outpost = "Vane's Watch"), Durn Hallow (Smith; verse IV;
walked out at verse six; died on the Barren Peaks carrying a forge-ember → Emberforge/Ironclad
founding; NOT in the Tyrant), Seraphine Aulde (Spire-builder; verse V; Aetherium Spires and
Aetherial Weavers), Imre Sallow (the Breath; verse VI; Glowlands glow, Mirelings, the Breathing
Pool), Tovren Masque (the Eye; verse VII; Chronos Nexus observatory, Chronos Lens, Temporal
Aberrations). Six in the Tyrant (Thal, Korr, Vane, Aulde, Sallow, Masque); Vell flung forward;
Danthe drowned (= Drowned Archivist, D-046); Hallow walked. Seven prior Wayfinders at years
44/110/178/243/309/371/430 (Dask = 430 = 70 years ago). The ninth Litany verse is unfinished
("I hold—") and is completed differently in endings A and B. Communion = Resolve meter in three
Movements mirroring the three combat phases (now D-054, 0–8). Loop 1→2 skips the Threshold
(now D-049). STORY's ids (`q_*`, `echo_*`, `scene_*`, `codex_*`, `ending_*`) are the reference set.

**Cross-doc id conflicts flagged by the DESIGN writer (must be merged before content files):**
same facts given different Echo ids — STORY `echo_tyrant_speaks` / `echo_nyx_is_of_the_nine` /
`echo_seven_wayfinders` / `echo_thirtieth_dawn` / `echo_flickering_man` vs DESIGN
`echo_tyrant_name` / `echo_nyx_is_nyxaria` vs WORLD `echo_tyrant_true_name` / `echo_nyx_true_name`
/ `echo_breach_failing`. Ruling: **STORY's ids win**; DESIGN and WORLD adopt them.

**Noticed in WORLD.md §1–3 (fix during continuation/revision):** `loc_aldours_eyrie` kept its id
after the name was corrected to "Aulde's Eyrie" → rename to `loc_auldes_eyrie` (nothing
implemented yet, so renaming is free). WORLD mentions "Tobrin" (holder of the second half of the
Breach-anchor schematic in Silverwood Before) — STORY's Eye of the Nine is **Tovren Masque**;
reconcile to Tovren. WORLD's `echo_sky_oath` / STORY's Echo list: check it exists in STORY §12 or
add it.

---

## 3. Known conformance work (Part E was ruled after the drafts)

Apply these during the revision pass:

- **All docs:** id convention D-044 (typed prefixes; abilities `rgr_/wiz_/elf_/wrd_/wvr_`; legacy
  spells `wiz_echo_bolt`, `wiz_fireball`, `wiz_lightning_bolt`; Amulet grants `itm_echo_bolt`;
  companions plain ids `ilyra`…`caelum`; Echo conditions use the full id `{ echo: "echo_x" }`).
- **DESIGN:** Ranger prefix `rgr_` (draft used `rng_`, D-061); communion Resolve 0–8 (D-054, replaces
  0–100); two Tyrant creature ids (D-051); Apex gate data form (D-048); Guard +5 universal (D-053);
  restock at dawn (D-057); Horde triggers (D-060); Dark Spellbook drop rule (D-055); adopt STORY's
  Echo ids; phase ids `tyr_movement_1..3` to match STORY's Movements.
- **STORY:** confirm the Threshold skip (D-049) and Loop 1 death rule; D-048 Apex gate wording;
  D-052 Mireya's dam accepts either fragment; D-060 Horde triggers in Loop 2+; Dask only in
  `temporallyUnstable` locations (D-059 list); check every `echo_*` used in §11/§13 is in §12.
- **PLAN:** replace proposed D-044 text and **Appendix A** with prefixed ids; `{ echo: 'echo_litany_verse_1' }`
  in all samples; XP curve and level bands from DESIGN (D-056); restock (D-057); Playwright `^1.49`,
  `VITE_BASE` default `/Aethelgard/` (D-058); camp dialogue overlay (D-059); `temporallyUnstable`
  location flag; Horde model (D-060); Apex gate counter form (D-048); add a dev "scenario loader"
  workstream if the reviewer agrees it is needed for Playwright boss/ending flows.
- **WORLD:** finish §4–13; adopt D-051 ids (already partially applied in §1–3), D-052 fragments,
  D-055, D-059 flag list, D-057 restock; rename `loc_aldours_eyrie`; Tobrin → Tovren.

---

## 4. Next actions, in order

1. Run `docs/briefs/world-continuation.md` as an agent → WORLD.md §4–13. Commit/push.
2. Run the three review briefs in parallel (`review-design.md`, `review-story.md`,
   `review-plan.md`); write a `review-world.md` brief modelled on them and run it. Commit the
   reports under `docs/reviews/`.
3. Run a **cross-document consistency** reviewer (ids, numbers, names, dates across all five
   docs; produce `docs/reviews/REVIEW-CROSS.md`).
4. Revision agents: one per doc, input = the doc + its review + DECISIONS Part E + the cross
   review; output = revised doc + a short changelog appended to `DECISIONS.md` Part E if any
   ruling was needed. Commit/push after each.
5. Write `docs/BIBLE.md` (continuity bible) from the revised docs; run a continuity checker
   over STORY/WORLD/DESIGN text; fix. Commit/push.
6. Mark Phase 0 done in the task list. Begin Phase 1 per `PLAN.md` §9 (W1 scaffold + tooling + CI,
   then W2/W7 engine core + schemas), moving the Python game to `legacy/` (D-039).

## 5. Working rules (from the brief)

- Unattended, maximum effort; never stop to ask questions; record decisions in `DECISIONS.md`.
- Use many parallel subagents with precise briefs; the lead integrates and resolves conflicts.
- Commit and push small and often to `unraveling`; never push to `main`.
- Quality bars and deliverables: see `PLAN.md` §1 and the original brief (summarized in
  `DECISIONS.md` Part B/D).
