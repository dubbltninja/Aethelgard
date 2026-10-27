# Brief: adversarial review of STORY.md

Agent type: general-purpose. Deliverable: `/home/claude/aethelgard/docs/reviews/REVIEW-STORY.md`.

---

You are a hostile but fair narrative/continuity reviewer and a veteran quest designer. Find every plot hole, contradiction, pacing problem, unreachable quest, dead-end choice, and tonal slip in `/home/claude/aethelgard/docs/STORY.md` and write a findings report. Do not edit STORY.md. Write to `/home/claude/aethelgard/docs/reviews/REVIEW-STORY.md` (create the directory if missing). Do not run git.

Read fully: `/home/claude/aethelgard/docs/DECISIONS.md` (canon; Part B vision, Part C continuity, Part E D-041..D-061 ruled AFTER STORY.md — STORY must conform), then `/home/claude/aethelgard/docs/STORY.md` (all 16 sections). Read the legacy text it must preserve: `/home/claude/aethelgard/echoes_of_aethelgard.py` lines 107–141 (lore article) and 2180–3030 (all NPC dialogue, quest text, Heartstone, Tyrant defeat, portal ending), and `/home/claude/aethelgard/aethelgard_data.py`. Skim `/home/claude/aethelgard/docs/WORLD.md` §3 (locations and gating) and `/home/claude/aethelgard/docs/DESIGN.md` §10–§12 for cross-document contradictions.

Attack on these fronts, with evidence (quote lines):
1. **Legacy fidelity** — every legacy line/quest/choice altered, dropped, or misquoted; misspelled legacy names.
2. **Canon conformance** — contradictions with DECISIONS (dates; Brak/Kaelen brothers; the Nine's fixed names/roles; six endings' requirements D-018; D-045 44 quests; D-046 Oriel; D-047 Amulet; D-048 Apex gate; D-049 Threshold skip; D-050 Hallow; D-051 two Tyrants; D-054 Resolve 0–8; D-059 Dask only in unstable locations; D-060 Horde triggers).
3. **Causality and time logic** — does the loop hold together? Who knows what, when? Nyx's 40 years; Dask's 70; Silverwood Before rules (time-locked echo; Anchors; Caelum forward) — paradoxes? The Tyrant's silence in Loop 1 in every scene?
4. **Ending reachability** — for each of six endings trace the exact chain from Day 1 of some loop; impossible/circular/mutually exclusive requirements; is the §6 "critic's path" feasible in the claimed loops within 30-day clocks (one watch per edge, four per day)?
5. **Quest catalog** — dangling ids; unmeetable stage conditions; unrecoverable failures that block an ending; journal text over 40 words; missing bot coverage; false pacifist claims; absurd rewards for band.
6. **Choice consequences** — any choice still without consequence; contradictions with D-017.
7. **Pacing** — Loop 1 as a 60–90 min RPG, Loop 2 the reveal, Loops 3+ 20–30 min: supported? Reveal over-explained or under-signposted? Dead stretches?
8. **Tone and voice** — style-guide violations in §13 scenes and §14 codex samples; intents >12 words; codex samples >220 words.
9. **Companions** — recruitment vs gating conflicts; arcs depending on mutually exclusive states; Dask in a non-unstable location; epilogue table gaps.
10. **Internal contradictions** — the Nine's roles vs Litany verses, Wayfinder years vs table, Echo ids used in §11/§13 but absent from §12.
11. **Fun** — three things most likely to bore/confuse; three strongest moments to protect.

Report format: summary; numbered findings with **Severity**, **Where**, **Problem**, **Proposed fix**. 40–80 findings. End with "Top 10 fixes before any content is written" and a verdict. Reply with counts by severity and the top 10.

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
