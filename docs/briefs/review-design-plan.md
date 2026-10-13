# Brief U6: combined adversarial review of DESIGN.md + PLAN.md (blockers and majors only)

Agent type: general-purpose (Opus). Deliverable: `/home/claude/aethelgard/docs/reviews/REVIEW-DESIGN-PLAN.md`.
Do not edit any other file. Commit only your report per `docs/briefs/COMMIT.md`.

This consolidates the two older briefs `review-design.md` and `review-plan.md` (read both for the full list
of attack fronts, and their "Overrides" sections), but with a tighter scope to save usage:

- Report **at most 30 findings total**, only **Blocker** or **Major** severity — things that would cause a
  wrong game, an unbuildable system, a broken balance, or rework later. Skip nits and style.
- Cover both documents: DESIGN.md (systems, numbers, balance math, status/interplay rules, loop/clock,
  economy, data model, UI/a11y) and PLAN.md (engine contracts, zod schemas, layout, tests, sim harness,
  CI/Pages, work breakdown).
- PLAN.md predates D-044 (typed-prefix ids) and **D-065 (offline toolchain: esbuild 0.28, TypeScript 6.0.3,
  React 19.2 with an in-repo type shim, zod 3.25, Playwright 1.56 via `playwright/test`, bun 1.4 test
  runner + coverage; no Vite/vitest/ESLint/Prettier/immer/jsdom/@types/react/axe; `structuredClone`
  instead of immer)**. Do not list every place PLAN must change for these — summarize them as ONE finding
  ("PLAN rewrite for D-044/D-065") with a checklist of the sections affected. Spend your findings on real
  design/contract problems instead.
- Do the hand-computed fight checks from `review-design.md` front 2, but report results compactly in one
  table (fight, turns to kill each way, verdict vs DESIGN §19).
- `docs/WORLD.md` is now complete (§1–13, incl. creatures §6 with HP/attack numbers and the map §11). Use it
  to check DESIGN's numbers against actual creature stats and the clock against WORLD §10.8's Loop 1 timing.
- Also read `docs/STATUS.md` "Open questions from U1/U2" and U3 notes; where a finding overlaps one of them,
  give a concrete recommended ruling.

Read efficiently: DECISIONS.md fully; DESIGN.md fully; PLAN.md §1, §3–5, §7–9, §11, Appendix A; WORLD.md
§6 creature stat lines (grep), §10.8–10.10; legacy combat `echoes_of_aethelgard.py` 3175–3305.

Format: summary (≤8 lines); findings numbered, each with **Severity**, **Where** (doc §, short quote),
**Problem**, **Proposed fix** (a concrete number, rule, or code shape). End with "Rulings the lead should
record in DECISIONS.md" (a numbered list of one-line proposed decisions). Reply with counts and that list.
