# STATUS — The Unraveling rebuild

**Branch:** `unraveling` (never push to `main`). Remote: `https://github.com/dubbltninja/Aethelgard.git`.
**Current phase:** Phase 0 (design docs). Round-1 launch was cancelled; work now proceeds in small units (see protocol). No application code exists yet.

This file is the resumption point. Read it first, then `DECISIONS.md` (canon, D-001..D-065), then
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
| U5 | Cross-doc review + id registry — brief `briefs/review-cross.md` | 1 agent | ▶ in progress |
| U6 | Combined review of DESIGN + PLAN (blockers/majors, ≤30) — brief `briefs/review-design-plan.md` | 1 agent | ▶ in progress |
| U7 | Combined review of STORY + WORLD (blockers only, ≤30 findings) | 1 agent | ⏳ |
| U8 | Apply review/registry fixes to DESIGN + PLAN (incl. D-065 toolchain rewrite of PLAN §3/§11) | 1 agent | ⏳ |
| U9 | Apply fixes to STORY + WORLD; write BIBLE.md (continuity facts) | 1 agent | ⏳ ✦ Fable |
| U10 | Scaffold: move Python to legacy/, package.json, tsconfig, link-local-deps, build/dev/lint scripts, React type shim, CI + Pages workflows, hello-world page builds | lead | ⏳ |
| U11+ | Phase 2 units — to be listed from revised PLAN §9 (engine core, combat, content per region, UI screens, art, audio, sim, tests) | — | ⏳ |


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
| `docs/DECISIONS.md` | ✅ D-001..D-065 | Part E rules on open questions; D-062 doc precedence; D-063 the Nine; D-064 NPC roles; **D-065 offline toolchain** |
| `docs/DESIGN.md` (systems) | ✅ draft (20 sections) | Pre-dates Part E → needs conformance revision after review |
| `docs/STORY.md` (narrative) | ✅ draft (16 sections) | 44 quests, 75 Echoes, 85 codex, 20 scenes, Litany, the Nine, 6 endings |
| `docs/PLAN.md` (engineering) | ✅ draft (13 sections + App. A) | Must be rewritten for D-044 ids and **D-065 toolchain** (no Vite/vitest/ESLint/immer) |
| `docs/WORLD.md` | ✅ complete draft, §1–13 | §13 collects errata + open questions from the three authors |
| Reviews | ⏳ round 1 in flight | see §2 |
| `docs/BIBLE.md` | ⏳ | after revisions |
| Phase 1+ (code) | ⏳ | after revisions; toolchain verified (D-065) |

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

1. **When round 1 returns:** commit anything uncommitted; merge `docs/world/04-06…`, `07-09…`,
   `10-13…` into `WORLD.md` as §4–§12 plus a combined §13 (open questions + errata), then delete
   `docs/world/` (or keep as history). Run a dangling-id grep across all docs. Commit/push.
2. **Round 2 (parallel):** revision agents for DESIGN, STORY, PLAN — inputs: their review +
   REVIEW-CROSS + REGISTRY-DRAFT + DECISIONS; STORY adds needed Echoes to §12; PLAN is rewritten for
   D-065 (scripts, configs, CI, tests) and D-044 ids. Plus `briefs/review-world.md` on the merged
   WORLD.md. Write the three revision briefs into `docs/briefs/` before launching.
3. **Round 3 (parallel):** WORLD revision (REVIEW-WORLD + registry + revised STORY/DESIGN);
   `docs/BIBLE.md` continuity bible (from revised STORY + DECISIONS + registry); **W1 scaffold**
   (tooling per revised PLAN + D-065, move Python game to `legacy/`, CI + Pages workflows).
4. **Round 4:** dedicated continuity checker over all writing vs BIBLE; fix. Then Phase 2 fan-out per
   revised PLAN §9 (engine core, combat, content per region, quests/dialogue, codex, UI, art, audio,
   tests, sim).

## 5. Working rules (from the brief)

- Unattended, maximum effort; never stop to ask questions; record decisions in `DECISIONS.md`.
- Many parallel subagents with precise briefs saved in `docs/briefs/`; the lead integrates.
- Agents commit only their own files (docs/briefs/COMMIT.md). Commit/push small and often to
  `unraveling`; never push to `main`.
- Quality bars and deliverables: original brief (summarized in `DECISIONS.md`) and `PLAN.md` §1.
