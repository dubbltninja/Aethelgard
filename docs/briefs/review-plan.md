# Brief: adversarial review of PLAN.md

Agent type: general-purpose. Deliverable: `/home/claude/aethelgard/docs/reviews/REVIEW-PLAN.md`.

---

You are a hostile but fair principal engineer reviewing `/home/claude/aethelgard/docs/PLAN.md`, the engineering plan for rebuilding a Python text RPG as a TypeScript/Vite/React time-loop web RPG. Find every contract gap, type error in spirit, unimplementable schema, missing workstream, dependency cycle, and ignored risk. Do not edit PLAN.md. Write to `/home/claude/aethelgard/docs/reviews/REVIEW-PLAN.md` (create the directory if missing). Do not run git. Read-only shell (node --version, npm view <pkg> version) is allowed.

Read fully: `/home/claude/aethelgard/docs/DECISIONS.md` (canon; **Part D** D-030..D-040 and **Part E** D-041..D-061 — D-044 OVERRIDES PLAN's proposed id convention: typed prefixes ARE part of ids, e.g. `loc_whispering_ruins`, `{ echo: "echo_litany_verse_1" }`, abilities `rgr_/wiz_/elf_/wrd_/wvr_`), then `/home/claude/aethelgard/docs/PLAN.md` (all sections + Appendix A). Then `/home/claude/aethelgard/docs/DESIGN.md` §3–§5, §10, §13, §14 and `/home/claude/aethelgard/docs/STORY.md` §11 (6 complex quests), §13 (4 scenes) to test whether PLAN's zod schemas and Condition/Effect unions can express them. Read `/home/claude/aethelgard/docs/WORLD.md` §2–3 to test `LocationSchema`.

Attack on these fronts, with evidence:
1. **Conformance to DECISIONS** — every contradiction with Part D/E; every place Appendix A or code samples must change for D-044.
2. **Engine contracts** — missing fields needed by DESIGN (Breach Clock watches, Corruption, class resource, companion KO/loyalty/stance, intents, boss phase, communion Resolve, merchant stock, discovered map, achievement counters, modifiers, class mastery, autosave); state vs profile ownership; serializability (Sets/Maps/undefined); determinism leaks (Date.now, Math.random, key order, floats); illegal-action handling; pending UI events like level-up choices.
3. **Content schemas** — missing fields per DESIGN/STORY/WORLD; optionality errors; missing cross-ref rules; does `Condition`/`Effect` cover D-033 plus what STORY §11 / WORLD §3 actually use (`{counter:…}`, `{killed:…}`, `{companion:…}`, `{corruption:…}`, `{day:…}`, `{loop:…}`, `{resolve:…}`); boss phases/intents expressible; location `descriptionVariants`/world-state variants; communion in dialogue.
4. **Repository layout and dependency rules** — enforceability, circularity, test placement, generated balance data, legacy move.
5. **Toolchain** — nonexistent/conflicting versions (check npm); eslint 9 flat + typescript-eslint + react plugins; vitest 2 + @testing-library/react + jsdom/happy-dom; Playwright with pre-installed Chromium at `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`); Vite base; immer; scripts that won't work (`check`, worker_threads under tsx).
6. **Simulation harness** — bot policies implementable from `legalActions` + observation? metrics for every quality bar; soft-lock detector false positives; determinism of parallel runs; BALANCE.md before/after.
7. **Testing plan** — realistic coverage; missing classes (migration, export/import, quota, reduced-motion, keyboard-only, axe); Playwright reaching a boss fight quickly — is a dev scenario loader specified?
8. **Work breakdown** — missing workstreams (scenario loader, content linting, screenshot pipeline, legacy README), cycles, file collisions, briefs lacking acceptance criteria, integration order blocking parallelism.
9. **CI/Pages YAML** — errors, permissions/concurrency, browser caching, Node version, base path, artifact path, main-only deploy.
10. **Risk register** — missed risks (content volume vs authoring token budget; schema churn; inline SVG bundle size; localStorage 5MB; Safari AudioContext; Pages 404 on deep links; agents inventing ids).

Report format: summary; numbered findings with **Severity**, **Where**, **Problem**, **Proposed fix** (code if needed). 40–80 findings. End with "Top 10 fixes before scaffolding" and a verdict. Reply with counts by severity and the top 10.

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
- PLAN-specific: PLAN.md was written assuming Vite/vitest/ESLint/immer/React 18. Review what must
  change under D-065 (scripts, configs, CI YAML, test plan, a11y checks without axe, React type shim,
  offline `tools/link-local-deps.mjs` bootstrap, CI `npm install` without a lockfile + `setup-bun`),
  and flag anything in the plan that cannot be built with the local toolchain.
