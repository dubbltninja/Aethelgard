# Brief: adversarial review of DESIGN.md

Agent type: general-purpose. Deliverable: `/home/claude/aethelgard/docs/reviews/REVIEW-DESIGN.md`.

---

You are a hostile but fair design reviewer. Your job: find every hole, contradiction, exploit, and unimplementable spec in `/home/claude/aethelgard/docs/DESIGN.md` (the systems design for a time-loop web RPG) and write a findings report. Do not edit DESIGN.md. Write your report to `/home/claude/aethelgard/docs/reviews/REVIEW-DESIGN.md` (create the directory). Do not run git.

Read fully: `/home/claude/aethelgard/docs/DECISIONS.md` (canon; especially Part B and Part E D-041..D-061 which were ruled AFTER DESIGN.md was written — DESIGN must now conform), then `/home/claude/aethelgard/docs/DESIGN.md` (all 20 sections). Skim `/home/claude/aethelgard/docs/STORY.md` §8 (Tyrant/communion), §11 (quest catalog), §12 (Echo catalog) and `/home/claude/aethelgard/docs/PLAN.md` §4–5 (engine contracts, schemas) for cross-document contradictions. Read `/home/claude/aethelgard/echoes_of_aethelgard.py` lines 3030–3310 (legacy combat) to judge whether DESIGN's "what changes" claims are accurate.

Attack on these fronts, with concrete evidence (quote the line or table cell):
1. **Conformance to DECISIONS** — every place DESIGN contradicts D-001..D-061 (id prefixes per D-044 incl. `rgr_` not `rng_`, `wiz_echo_bolt`, communion Resolve 0–8 per D-054, two Tyrant encounters per D-051, Amulet `itm_echo_bolt` per D-047, Apex gate per D-048, restock per D-057, Guard resource per D-053, Horde per D-060, STORY's Echo ids win).
2. **Math and balance** — recompute 6 representative fights by hand (L1 Ranger vs Corrupted Shade; L1 Wizard vs Wildling Brute; L4 Elf vs two Arcane Wisps; L8 Warden vs Stone-Hide Golem; L12 Weaver vs Temporal Aberration; L13 any vs Contained Tyrant phase 1). Check fight lengths vs §19, mana sustainability, any ability's damage-per-MP or per-turn dominating its class, Weaver Blood price / Wizard regen trivializing resources, Guard + regen infinite stall, and whether death-is-reset in Loop 2+ makes the Clock meaningless.
3. **Loop/clock arithmetic** — can a thorough Loop 1 fit in 30 days given travel costs and WORLD.md §3's map? Count a plausible path. Can Clock modifiers push below the minimum time to reach the Apex (soft-lock)? Is Frayed Clock (20 days) survivable?
4. **Progression** — XP curve vs available XP per band; band minimums reached before entering regions? Ability points sufficient for capstones at claimed levels? Mastery (half cost) breakage?
5. **Economy** — gold in vs out per loop; affordability of Breach-anchor and key upgrades; selling loot; "never soft-locked by poverty".
6. **Status/interplay table** — ambiguities (stacking, refresh, tick order), undefined interactions, contradictions, statuses with no source or no counter.
7. **Companions** — stance pseudocode gaps; KO rules; Dask's location rule vs combat elsewhere.
8. **Data model** — can the quest/dialogue/Echo schemas express STORY's 44 quests and 20 scenes (check 5 complex quests)? Missing condition/effect kinds?
9. **UI/UX and accessibility** — undefined states, keyboard conflicts, mobile gaps, D-035 violations.
10. **Internal contradictions** — numbers differing between sections, ids used but undefined, defined but unused.
11. **Unimplementable or vague** — anything an engineer couldn't implement without asking.

Report format: summary paragraph; numbered findings each with **Severity** (Blocker / Major / Minor / Nit), **Where** (section + quote), **Problem**, **Proposed fix** (concrete). Aim for 40–80 findings, Blockers/Majors first. End with "Top 10 fixes to make before any code is written" and a one-line verdict. Reply with counts by severity and the top 10.

---

## Overrides (added 2026-10-10, apply on top of the brief above)

- DECISIONS.md now runs through **D-065**. Also check conformance with **D-062** (document precedence),
  **D-063** (the Nine are STORY's nine; WORLD's Corvin Dreyl, Ilsabet Rhune, Hadrek, Tobrin Vask are
  Silverwood people, not of the Nine), **D-064** (NPC role reconciliation), and **D-065** (npm registry
  is blocked here: the toolchain is esbuild 0.28 + TypeScript 6.0.3 + React 19.2 + zod 3.25 +
  Playwright 1.56 via `playwright/test` + bun 1.4 test runner; no Vite, vitest, ESLint, Prettier,
  immer, jsdom, Testing Library, `@types/react`, axe-core; state updates use `structuredClone`).
- A separate agent is doing the cross-document id/name/number reconciliation
  (`docs/reviews/REVIEW-CROSS.md`); you may note cross-doc issues you find, but focus on your document.
- `docs/world/*.md` are in progress (WORLD §4–13); ignore them.
- **Git:** ignore "Do not run git" above. When your report is complete, commit ONLY your report file
  per `docs/briefs/COMMIT.md`.
