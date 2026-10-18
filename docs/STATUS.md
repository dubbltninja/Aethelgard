# STATUS — The Unraveling rebuild

**Branch:** `unraveling` (never push to `main`). Remote: `https://github.com/dubbltninja/Aethelgard.git`.
**Current phase:** Phase 1 (implementation). Engine complete (C2 + U34b/c/d); sim harness complete; all world data except most quests/dialogue and the codex; legacy quests + dialogue pattern (U52); UI foundation (U63: store, Shell, Title, Class Select) — 3,318 tests. Next: U34e, U60 (✦), U53 (✦), U64 (see §4). Unit list: PLAN §9.2.

This file is the resumption point. Read it first, then `DECISIONS.md` (canon, D-001..D-109), then
the docs named below. It is updated at every stopping point and before/after every agent round.

---

## ⚑ Checkpoint protocol (adopted 2026-10-12 — follow this every session)

Usage windows end mid-turn and kill in-flight work. Therefore:

- Work in **units** from the queue below. One unit ≈ 15–30 min, ends with commit + push + this file updated.
- **Max 1–2 agents at a time.** Never fan out 4+ agents in one turn.
- Use **lower effort / cheaper model** for mechanical units (merges, data entry, conversions); max effort only for
  design rulings, engine/combat logic, and reviews.
- Before starting a unit: mark it `▶ in progress` here and push. After: mark `✅`, note the commit, push.
- A session prompt like "continue from STATUS.md, do 2–3 units" = do exactly that, then stop with a one-line report.
- **Tim's reporting preference (2026-10-13):** at the end of every prompt, list the **next four** units (with model and
  dependencies), not two.
- Agents commit their own deliverable (docs/briefs/COMMIT.md).
- **✦ Fable reminder (Tim asked for this, 2026-10-13).** Units marked **✦ Fable** in the queue benefit most from
  Fable 5.1 (prose quality, lore coherence, fun judgment). **Before starting a ✦ unit, the lead must tell Tim in its
  reply: "Next unit is a ✦ Fable unit — consider switching with /model claude-fable-5-1 before the next prompt."**
  ✦ units: U9 (STORY/WORLD revision + BIBLE), every quest-dialogue / scene / codex writing unit in Phase 2,
  the three fun-review rounds, and the final lore + fun audit. Switch back to Opus afterwards.
- **Model routing (adopted 2026-10-13).** Main session stays on Opus; the lead sets each agent's `model`:
  - **Opus:** engine/combat/loop logic, all prose (dialogue, codex, scenes, quest text), balance analysis and
    tuning decisions, reviews, continuity checks, fun reviews, final audit, and the *first* instance of any
    repeated pattern (first region data file, first screen, first test suite).
  - **Sonnet:** transcribing designed content into data files (locations, creatures, items, recipes, merchant
    stock) once the schema + first example exist; replicating an established screen/component pattern;
    writing tests from stated rules; Playwright scripts; CSS/layout; README/CONTENT docs; merges; running sims.
  - Every Sonnet unit is followed by automated gates (typecheck, schema + cross-ref validation, tests, sims) and
    an Opus spot-review before it is marked ✅.
  - Optional: switch the session to Fable for the dialogue/codex writing units and the final fun/lore review.

### Unit queue (Phase 0 → Phase 1)

| # | Unit | Mode | State |
|---|---|---|---|
| U1 | WORLD §4–6 (NPCs, creatures) — brief `briefs/world-4-6.md` | 1 agent | ✅ 536d11f — 38 NPCs, 8 families, 57 creatures (9 bosses) |
| U2 | WORLD §7–9 (items, crafting, merchants) — brief `briefs/world-7-9.md` | 1 agent | ✅ df57ae4 — 157 items, 30 recipes, 8 merchants |
| U3 | WORLD §10–12 (encounters, map, variants) — brief `briefs/world-10-13.md` | 1 agent | ✅ fa12115 — 73 nodes/92 edges, Loop 1 timing fits (Apex Day 22) |
| U4 | Merge docs/world/* into WORLD.md + dangling-id grep | lead, low effort | ✅ merged §4–13 (4,269 lines); docs/world/ removed (in git history) |
| U5 | Cross-doc review + id registry — brief `briefs/review-cross.md` | 1 agent | ✅ c3f6b91 — 58 conflicts, REGISTRY-DRAFT (231 renames) |
| U6 | Combined review of DESIGN + PLAN (blockers/majors, ≤30) — brief `briefs/review-design-plan.md` | 1 agent | ✅ bea5aea — 3 blockers, 19 majors; rulings adopted as D-066 |
| U7 | Combined review of STORY + WORLD (blockers/majors, ≤30) — brief `briefs/review-story-world.md` | 1 agent | ✅ f6d3be9 — 1 blocker, 18 majors; rulings adopted as D-067 |
| U8 | Apply review/registry fixes to DESIGN + PLAN (incl. D-065 rewrite) — brief `briefs/revise-design-plan.md` | 1 agent | ✅ 773861e DESIGN, eebb823 PLAN — conform to D-044..D-066; PLAN §9 = unit list U11–U91 |
| U9 | Apply fixes to STORY + WORLD (REVIEW-STORY-WORLD, REVIEW-CROSS §4 U9 handoff, registry renames, D-066/D-067/D-068); write BIBLE.md | 2 agents (Fable) | ✅ STORY 1f76fdd, BIBLE 74641cb, WORLD 4e9f8e3; leftovers ruled in D-069 |
| U9.5 | DESIGN/PLAN touch-ups from D-069 (§4.11 press formula, §12.1 Ilyra Loop 2+, §11.3 line, Listen lash, new effect kinds + `road` edges + `passWatches`, `flag_tyrant_dead`, class quests Loop 2+); re-run the owner-id grep | 1 agent, **Sonnet** | ✅ 918f5bd (spot-reviewed) |
| U10 | Scaffold: move Python to legacy/, package.json, tsconfig, link-local-deps, build/dev/lint scripts, React type shim, CI + Pages workflows, hello-world page builds | Opus agent | ✅ 97f9a34, 0b8639e, 7f0d932 — `npm run check` green offline incl. e2e smoke (desktop+mobile, /Aethelgard/) |
| U11–U12 | Engine types (PLAN §4.2–4.5) → Rng xoshiro128** + util (hash, clone/deepFreeze) + first engine tests — brief `briefs/u11-u12.md` | 1 agent, Opus | ✅ 640cf45, 6c8ddd5 — 106 tests, src/engine 100% lines; D-071 |
| U13–U14 | step/ctx/RejectSignal/dispatch + legalActions skeleton + newRun → Condition/Effect zod + evaluate/explain/apply — brief `briefs/u13-u14.md` | 1 agent, Opus | ✅ 18e5831, db1c888 — 329 tests, engine+content 100% lines; deviations → D-072 |
| U15 | Schemas: region, location, encounter, item, affix, recipe, status — brief `briefs/u15.md` | Sonnet | ✅ a19b4dc (spot-reviewed; lead added `anchorable`) |
| U16 | Schemas: creature, ability, class, companion, specials — brief `briefs/u16.md` | Opus | ✅ 2108d18 — 477 tests total; D-072 |
| U17 | Remaining schemas + buildContentPack + GameConfig — brief `briefs/u17.md` | Sonnet | ✅ 86ea0a2 (spot-reviewed: XP table, sell ratio vs DESIGN) — 561 tests |
| U18 | Fixture pack + test helpers — brief `briefs/u18.md` | Opus | ✅ 20575d6 — fixture pack (2 regions, 6 locs, 4 creatures incl. 3-phase communion boss), helpers; 577 tests |
| U19 | validateContent rules 1–22 + CLI (C1 contract freeze) — brief `briefs/u19.md` | Sonnet | ✅ bbbae0d (spot-reviewed) — **C1 contract freeze**; 716 tests; D-073 |
| U20 | Explore & time reducers — brief `briefs/u20.md` | Opus | ✅ 948f0bb — explore/time reducers, Apex prompt, clock hooks; D-074 |
| U21 | Derived stats, progression, inventory — brief `briefs/u21.md` | Opus | ✅ d49d451 — derived/progression/inventory; DESIGN §3.3 values exact; 862 tests |
| U22 | Saves: serialize/migrate/storage keys/round-trips — brief `briefs/u22.md` | Sonnet | ✅ 2a15731 (spot-reviewed: keys per DESIGN §14.1) — 50 round-trips |
| U23 | Combat core: initiative, turn loop, basic attacks, damage pipeline — brief `briefs/u23.md` | Opus | ✅ a432c77 — §4.12 worked example matches in scope; 1065 tests; D-075 (**Loop 1 defeat → title follow-up for U30**) |
| U24 | Statuses + interplay + timing — brief `briefs/u24.md` | Opus | ✅ 8fbce81 — 19 statuses + 18 interplay rows; 1132 tests; D-076 (DESIGN §4.12 corrected) |
| U25 | Enemy intents — brief `briefs/u25.md` | Opus | ✅ 6c62235 — intents, cadence words, worked example end-to-end; 1179 tests; D-077 |
| U26 | Player abilities, class resources, Guard, combat items, flee/scatter, specials — brief `briefs/u26.md` | Opus | ✅ 35cba4f — 1249 tests; §4.12 exact; D-078 (**~25 abilities unscripted → U26b**) |
| U27 | Boss phases, adds, Rewind cap; rewards, loot, bestiary — brief `briefs/u27.md` | Opus | ✅ 1da1fe4 — phases/adds/Rewind/rewards/loot/bestiary; 3-phase Tyrant fought end to end; 1282 tests; D-079 |
| U26b | Combat leftovers: script the ~25 remaining DESIGN §5 abilities (list in `abilities.ts` header) + completeness test; Crushing Blow accuracy; `affix_of_echoes`; phase `onEnter` area damage shape; ground-loot dawn expiry (D-078, D-079) | Opus | ✅ 2ca8623 — all 75 abilities data-or-scripted, completeness test; D-080 |
| U28 | Companions in combat — brief `briefs/u28.md` | Opus | ✅ 9d65492 — stances/cooldowns/signature/KO/Dask; 1359 tests; D-080 |
| U29 | Communion engine — brief `briefs/u29.md` | Opus | ✅ 3dbf7c5 — communion to F/A/B; 1388 tests; D-081 |
| U30 | Horde, portal, closers, endLoop/reset, Loop 1→2, Loop 1 defeat→title — brief `briefs/u30.md` | Opus | ✅ 4876abf — Horde/portal/closers/reset, Loop 1→2 through `step`, Loop 1 defeat→title; 1427 tests; D-082 |
| U31 | Threshold: Attunements, modifiers, class change, NG+ — brief `briefs/u31.md` | Opus | ✅ b6b9238 — Loom, modifiers, class change, NG+; D-083 |
| U32 | Silverwood Before counter; loop-start Echo effects — brief `briefs/u32.md` | Opus | ✅ cf45c9b — Before rules, Anchors, Echo grants/loop-start effects; 1487 tests; D-083 |
| U33 | Quests + dialogue reducers — brief `briefs/u33.md` | Opus | ✅ dcf1d10 — quest stage machine, dialogue, recruitment, camp scenes; D-084 |
| U34 | Economy + crafting — brief `briefs/u34.md` | Opus | ✅ 06a4c51 — merchants, pricing, restock, Emberforge craft/upgrade/salvage, Breach-anchor; 1579 tests; D-084 |
| U35 | legalActions completeness + isLegal + property test — **C2 engine** — brief `briefs/u35.md` | Opus | ✅ 8c760c8 — **C2 engine**: 623 states, legal ⇔ accepted; D-085 |
| U40 | Shared content I: classes, statuses, affixes, Ranger + Wizard abilities — brief `briefs/u40.md` | Opus | ✅ 649f0e3 — 5 classes, 19 statuses, 12 affixes, Ranger+Wizard trees = DESIGN; D-085 |
| U34b | Affix/passive combat effects: `basic_attack_rider`, `damage_vs_status`, `reflect_melee`; passives `statusOnHit`, `regen`, `lifeSteal`, `curse` in combat (D-085) | Opus | ✅ e903c9d (+ lead fix e518bca: elites only from fodder) — gear passives, affix scripts, Foresight, Horde Rising; D-087 |
| U36 | loadScenario builders — brief `briefs/u36.md` | Sonnet | ✅ 9f79ad7 (spot-reviewed) — 13 scenarios × 9 packs, dev-only; 1790 tests |
| U37 | Sim runner, random + melee bots, soft-lock detector — brief `briefs/u37.md` | Opus | ✅ e1083e8 (spot-checked) — `npm run sim`; 0 errors / 0 soft-locks over 420k random steps; melee Loop 1 closer 840/840; 1906 tests; bot purity lint added by lead; D-086 |
| U38 | Bots: caster, explorer, speedrunner, pacifist, `pathBot` (PLAN §7.2, §7.8) — brief `briefs/u38.md` | Sonnet | ✅ d67199f (spot-reviewed) — 720/720 Loop 1 closers, 9 fixture ending scripts; 2137 tests; D-087 |
| U41 | Shared content II: Elf, Warden, Weaver abilities; 6 companions + 24 companion abilities; `itm_echo_bolt` — brief `briefs/u41.md` | Sonnet | ✅ 5c87139 (spot-reviewed) — 75 class abilities + Echo Bolt + Amulet registered; companions authored, registered at U56 (D-088); D-089 |
| U39 | Batch runner (workers, `__DEV__` off — D-086), metrics, coverage, BALANCE.md generator — brief `briefs/u39.md` | Sonnet | ✅ 549dfe8 (spot-reviewed) — `npm run sim:balance`; 108 µs/step; 2323 tests; D-089 |
| U34c | Companion signature scripts (Lanternreed Bloom 30 % heal, Archive Light reveal) + `talk` at the Threshold (D-084) — brief `briefs/u34c.md` | Opus | ✅ 0d30d4c (+ lead: D-091) |
| U42 | Region data: Silverwood Ruins (first region file; adds the Amulet's `sources`) — brief `briefs/u42.md` | ✦ Fable (Tim) | ✅ fd079c0 + lead 8e95f0b (shared2 pins, `horde_moves`, engine flags) — 7 locations, 7 creatures, 3 NPCs; the region pattern (D-091) |
| U45 | Region data: Glowlands & Nexus + the Apex, both Tyrants, `cr_horde_husk` — brief `briefs/u45.md` | Opus | ✅ 98ac100 — 3 locations, 11 creatures, communion; Tyrant sims not meaningful until gear exists (D-092) |
| U43 | Region data: Mistwood & the Ironclad Reach — brief `briefs/u43.md` | Sonnet | ✅ 23a869b, merged a3272d2 (spot-reviewed) — 6 locations, 5 creatures, 3 NPCs; 2506 tests |
| U44 | Region data: The Voidscar + Aether-Kissed Highlands — brief `briefs/u44.md` | Sonnet | ✅ 44928b3 (spot-reviewed) — 5 locations, 8 creatures, Nyx, Dask; Apex reachable; D-094 |
| U46 | Region data: The Drowned Reach + The Ashen Steppe — brief `briefs/u46.md` | Sonnet | ✅ b5da198, merged d3520de (spot-reviewed) — 17 locations, 10 creatures, 7 NPCs; 2711 tests; D-094 |
| U47 | Region data: The Glowfen + The Veil — brief `briefs/u47.md` | Sonnet | ✅ 480047f, merged db8d1fd (spot-reviewed) — 16 locations, 6 creatures, 7 NPCs; 2902 tests; D-096 |
| U48b | Region data: Silverwood Before + The Threshold — brief `briefs/u48b.md` | Opus (Tim, D-093) | ✅ 8879f95 — 14 locations, 5 creatures, 16 NPCs; Before + Threshold mechanics proven; D-095 |
| U48a | Region data: The Skyreach — brief `briefs/u48a.md` | Opus (Tim, D-093) | ✅ f2a7263, merged f66b184 — 5 locations, 4 creatures; **all 12 regions / 73 locations done**, regions+locations off INCOMPLETE_TABLES (D-097) |
| U49 | Items I: weapons, armor, trinkets T1–T5 (WORLD §7) — brief `briefs/u49.md` | Sonnet | ✅ 3732c2b, merged abd8777 (spot-reviewed) — 70 gear; 2985 tests; D-099 |
| U51 | Echo catalog, achievements, attunements, modifiers, ending/closer records, factions (data) — brief `briefs/u51.md` | Sonnet | ✅ c27b972 (spot-reviewed) — 103 Echoes, 40 achievements, 15 attunements, 6 modifiers, 8 ending records, 3 factions; 3033 tests; D-100 |
| U50 | Items II: consumables, materials, quest/key/recipe/tome items, 30 recipes, 8 merchants; Tyrant scenarios get band gear — brief `briefs/u50.md` | Sonnet | ✅ 60cba5c, merged d6c88ce (spot-reviewed) — 157 items, 30 recipes, 8 merchants; first Tyrant numbers (D-101); 3120 tests |
| U34d | World-state expressiveness: NPC schedules, location-item chance/late spawns, event/pool conditions, Threshold arrivals (D-098) — brief `briefs/u34d.md` | Opus | ✅ 42be256 — schedules, item chance, onlyIf, pools, arrest; 3153 tests; D-102 |
| U52 | Legacy quests + their dialogues (first quest/dialogue file) — brief `briefs/u52.md` | Opus | ✅ ddc6c52 — 6 quests, 23 scenes, 13 quest proofs on the real pack; 3318 tests; D-105 |
| U63 | UI foundation: store, App, Shell, hotkeys, tokens/themes, Title + Class Select — brief `briefs/u63.md` | Opus | ✅ 6501262 — store, Shell, hotkeys, themes, Title, Class Select; 3268 tests; e2e 11; D-104 |
| U60 | Codex I: people, the Nine, Wayfinders, factions, history — brief `briefs/u60.md` | ✦ Fable | ✅ dede08c — 42 entries (+3 new people); real-pack sims clean; D-108 |
| U53 | Faction chain quests + dialogue — brief `briefs/u53.md` | ✦ Fable | ✅ c60c778 (resumed after the usage cutoff) — 4 quests, 19 scenes, 8 proofs; 3445 tests; D-109 |
| U64 | Explore screen + node map + bars + HUD + `?scenario=` hook — brief `briefs/u64.md` | Opus | ✅ 937c84c — playable exploring in the browser; 3389 tests; e2e explore 8/8; D-107 |
| U34e | Combat expressiveness: Heartstone effects, item custom passives, creature mechanics, scenario bug, hazards, anomalies — brief `briefs/u34e.md` | Opus | ▶ resumed after the usage cutoff (items 1–2 committed; `wip/u34e`) |
| U38–U91 (excl. U40) | Implementation units — the ordered list with Opus/Sonnet/✦ Fable tags lives in **PLAN.md §9.2** (remaining after U35–U37, U40 — U38/U39/U41 copied above). Copy the next few here as they start. | — | ⏳ |


### Open questions from U1/U2 (resolve in U8/U9 — record rulings in DECISIONS)
- Boss HP ≈3.5–4.5× fodder (DESIGN §19 turn targets) instead of brief's 6–8×; Attack = 5 + 1.5·L (DESIGN). Likely accept.
- Drowned Reach boss = Bell-Warden; Oriel = unique Drowned Archivist in Sunken Archives (not a boss).
- Communion: STORY's opening Echo `echo_tyrant_speaks`; "reject if Resolve < 3 at any Movement end" makes Movement I demand perfection — soften.
- Breach-anchor 300 g fee + Ironclad-Trusted gate can block ending B → proposal: fee 0, rep gate waived while `q_the_mending`/`q_iron_silence` active.
- Each Heartstone choice should yield 2 fragments (Mireya's dam + anchor in one loop).
- No Skyreach merchant; Ironclad Camp has no Loop-1 vendor; orrery key target undefined; Borin's forge-mark has no source.
- Item tier T5 (band 16–18) proposed by W-B — DESIGN only had T1–T4. Item count 157 vs 139 budget (trim list in §7–9 OQ6; optional).
- Litany pages kept as quest items granting verse Echoes (page1→v1, page2→v8, page3→v3) — STORY §12 must add sources.
- Engine needs effect kinds: summon, revive, riposte (creature intents).
- Hesper Dunn has no STORY quest; Sedge called "crafter" but DESIGN says Borin is the only crafter.
- U3: forced fights limited to bosses/story gates only with a proposed "scatter" rule (fled fixed groups
  scatter for the loop, +2 watches, no XP/loot) — needs DESIGN §4.7 acceptance. Heartstone **Destroy** (−10 days)
  makes the thorough Loop 1 miss the Day 20 limit; Ending E fails under Frayed Clock — proposals in WORLD §10.10.
  Proposed 3-move Horde delay for clock-expiry Hordes. Lamplighters' Rest unreachable for pacifists in Loop 1.
  8 gate Echoes missing from STORY §12. Dask on Glowlands conflicts D-059 vs DESIGN §12.8.
- U4 dangling id: `loc_veil_sanctum` is referenced in STORY/DESIGN but not defined in WORLD.

(Reviews were consolidated from 5 agents to 3 to save usage; the brief's "separate reviewer agents attack each
document" is still met because each doc is attacked by a reviewer who did not write it.)

---

## 0. If you are resuming after a cutoff

1. `git status` / `git log --oneline -15`. Agents commit their own deliverables (docs/briefs/COMMIT.md),
   so finished work is on the remote even if the lead was cut off.
2. Check which round-1 deliverables exist (table in §2). For any that are missing or truncated
   (no final "Open questions" section), re-run its brief from `docs/briefs/`.
3. Uncommitted files under `docs/world/` or `docs/reviews/` are partial agent output: inspect, then
   either commit them (if complete) or delete and re-run the brief.
4. Continue with §4 "Next actions".

---

## 1. Where things stand

| Item | State | Notes |
|---|---|---|
| Read the whole legacy repo | ✅ done | Findings in `DECISIONS.md` Part A |
| `docs/DECISIONS.md` | ✅ D-001..D-085 | Part E rules on open questions; D-062 doc precedence; D-063 the Nine; D-064 NPC roles; **D-065 offline toolchain** |
| `docs/DESIGN.md` (systems) | ✅ revised U8 | conforms to D-044..D-066; U9.5 touch-ups pending |
| `docs/STORY.md` (narrative) | ✅ revised U9 | 44 quests (+5 class, +6 optional), 103 Echoes, 87 codex, 21 scenes, Litany, the Nine, 6 endings |
| `docs/PLAN.md` (engineering) | ✅ revised U8 | D-065 toolchain; §9 = unit list U11–U91 |
| `docs/WORLD.md` | ✅ revised U9 | bosses retuned (D-067.20), ids per registry/STORY; §13 = changelog + still-open |
| Reviews | ⏳ round 1 in flight | see §2 |
| `docs/BIBLE.md` | ✅ 74641cb | timeline 44 rows, people, who-knows-what (23 facts), places (85), things, terminology, rules, 18 open risks |
| Phase 1+ (code) | ▶ scaffold done (U10) | next: U35–U38 — see PLAN §9.2 |

### Environment facts (verified 2026-10-10)
- **npm registry is blocked** by egress policy (proxy 403; no DNS). Do not retry or route around it.
- Locally available in `/opt/npm-tools/node_modules` and smoke-tested together: esbuild 0.28.2
  (bundled React 19 + zod into 254 KB), TypeScript 6.0.3, React/react-dom 19.2.8, zod 3.25.76,
  Playwright 1.56.0 (`playwright/test` runner; Chromium at `/opt/pw-browsers`), @types/node 26.2.0,
  tsx 4.23. bun 1.4.2 at `/root/.bun/bin/bun` (`bun test --coverage` works).
- Missing: Vite, vitest, ESLint, Prettier, immer, jsdom, Testing Library, @types/react, axe-core.

---

## 2. Round 1 (launched 2026-10-10 ~23:40 ET) — 7 parallel agents

| Agent | Brief | Deliverable | State |
|---|---|---|---|
| W-A NPCs + creatures | `briefs/world-4-6.md` | `docs/world/04-06-npcs-creatures.md` | running |
| W-B items + crafting + merchants | `briefs/world-7-9.md` | `docs/world/07-09-items-crafting-merchants.md` | running |
| W-C encounters + map + variants | `briefs/world-10-13.md` | `docs/world/10-13-encounters-map-variants.md` | running |
| Review DESIGN | `briefs/review-design.md` (+Overrides) | `docs/reviews/REVIEW-DESIGN.md` | running |
| Review STORY | `briefs/review-story.md` (+Overrides) | `docs/reviews/REVIEW-STORY.md` | running |
| Review PLAN | `briefs/review-plan.md` (+Overrides) | `docs/reviews/REVIEW-PLAN.md` | running |
| Cross-doc consistency + registry | `briefs/review-cross.md` | `docs/reviews/REVIEW-CROSS.md`, `docs/reviews/REGISTRY-DRAFT.md` | running |

---

## 3. Facts carried forward from agent reports

**DESIGN writer** — key numbers (draft until revised): XP per level 100, 150, 220, 300, 400 … 3,660
(cum. 4,100 at L10; 26,900 at L20); class base stats (Ranger 100/36/10/6/8, Wizard 84/50/6/11/7, Elf
90/44/7/7/10, Warden 116/30/12/5/7, Weaver 90/48/6/10/8; max HP = base + growth·(L−1) + 2·STR);
hit% = clamp(85 + ⌊AGI/2⌋ − ⌊defAGI/2⌋, 50, 100); crit 5 + ⌊AGI/2⌋ at ×1.5; variance ×U(0.90,1.10);
Guard 50% (Warden 65%); flee 40 + 3·AGI − 2·maxEnemyAGI; 18 statuses + `status_rested`; 75 abilities;
12 affixes; 139 items (30 weapons, 18 armor, 20 trinkets, 16 consumables, 21 materials, 14 quest,
6 keys, 10 recipes, 4 tomes); clock 4 watches/day; Resonance +2 location / +3 bestiary / +1 codex /
+5 quest / +50 ending / +10 closer; 15 Attunements; 40 achievements; Loop 1 ≈ 1,250 gold.

**STORY writer** — the Nine (STORY §2, canon per D-063): Veyran Thal, Nyxaria Vell, Oriel Danthe,
Maelis Korr, Haldric Vane (Warder; Golems; "Vane's Watch"), Durn Hallow (Smith; walked out at verse
six; Emberforge/Ironclad founding; not in the Tyrant), Seraphine Aulde (Spire-builder; Aetherial
Weavers), Imre Sallow (the Breath; Glowlands glow, Mirelings, Breathing Pool), Tovren Masque (the Eye;
Nexus observatory, Chronos Lens, Temporal Aberrations). Six in the Tyrant; Vell flung forward; Danthe
drowned (= Drowned Archivist); Hallow walked. Prior Wayfinders: years 44/110/178/243/309/371/430 (Dask
= 430). Ninth Litany verse unfinished ("I hold—"), completed differently in endings A and B.

**Cross-doc conflicts known before round 1** (the cross-doc agent is resolving all of them):
- WORLD §3 invented alternative Nine members — ruled by D-063 (recast as Silverwood people).
- NPC role overlaps (Ansel Dray/Tamsin, Hadda Ironvow/Oma Varr, Sethe/Ysmay, Wen/Wren) — D-064.
- Echo ids: STORY 75, DESIGN 90 (≈65 not in STORY), WORLD 37 (25 not in STORY). STORY §12 is the
  catalog (D-062); needed extras get added to it.
- Items: 90 distinct `item_*` ids across docs (WORLD 57, DESIGN 44, STORY 8).
- `loc_aldours_eyrie` should become `loc_auldes_eyrie`. `q_herd_of_one` exists outside STORY.
- (Correction to an earlier note: "Tobrin Vask" is a separate Silverwood person, not a misspelling of
  Tovren Masque — see D-063.)

---

## 4. Next actions, in order

1. **U34e** (Opus; combat expressiveness + unread passives + `world.heartstone` + scenario bug + anomalies; D-098/D-099/
   D-101/D-105) · **U60** (✦ Fable; Codex I; clears the real-pack sim blockers; rewrites U51's Echo codex lines, D-100) ·
   **U53** (✦ Fable; faction chain quests, copying U52's conventions) · **U64** (Opus; Explore screen + node map; adds the
   `?scenario=` boot hook, D-104). Independent — can run together (D-103 backups); Tim decides how many at once.
2. Then U54–U59 (✦), U61–U62 (✦), U65+ (UI screens).
3. Balance once companions register (U56): Tyrant sims (D-101).

## 4b. Dev quickstart

`node tools/link-local-deps.mjs` (offline: symlinks /opt/npm-tools packages) → `npm run check` (typecheck, lint,
unit tests + coverage gate, validate, build, e2e smoke). `npm run dev` for a live server. Python original: `legacy/`.

## 5. Working rules (from the brief)

- Unattended, maximum effort; never stop to ask questions; record decisions in `DECISIONS.md`.
- Many parallel subagents with precise briefs saved in `docs/briefs/`; the lead integrates.
- Agents commit only their own files (docs/briefs/COMMIT.md). Commit/push small and often to
  `unraveling`; never push to `main`.
- Quality bars and deliverables: original brief (summarized in `DECISIONS.md`) and `PLAN.md` §1.
