# Brief U8: apply review fixes to DESIGN.md and PLAN.md

Agent type: general-purpose (Opus). Deliverables: revised `docs/DESIGN.md` and `docs/PLAN.md` (edit in place).
Do not edit any other file. Commit per `docs/briefs/COMMIT.md` — DESIGN.md first as its own commit (checkpoint),
then PLAN.md as its own commit.

## Inputs (read these)
- `docs/DECISIONS.md` — canon through **D-066** (D-066 adopts the U5/U6 rulings; D-065 is the offline toolchain;
  D-044 the id convention; D-062 precedence).
- `docs/reviews/REVIEW-DESIGN-PLAN.md` — every finding; apply its proposed fixes (as ruled in D-066).
- `docs/reviews/REVIEW-CROSS.md` — especially **§4 handoff list for U8** — and `docs/reviews/REGISTRY-DRAFT.md`
  (apply every rename/action whose target doc is DESIGN or PLAN; ids must match the registry exactly).
- `docs/WORLD.md` §6–§9 and §10.8–10.10 only where needed to keep DESIGN's numbers consistent with authored content.

## DESIGN.md changes
- Conform to D-044 ids (e.g. `rgr_` not `rng_`, `wiz_echo_bolt`, `itm_echo_bolt`), registry Echo ids (STORY §12),
  D-051 Tyrant ids, D-054/D-066 communion Resolve 0–8 (phase ids `tyr_movement_1..3`), D-066 numbers (Tyrant
  retune, Wizard regen, Fireball, Burn, status timing, self-costs, clock floor, Ending E gate, Silverwood Before
  counter, Breach-anchor recipe, flee/scatter, companion cooldowns, hotkeys, ordered-pattern intents, half-point
  AP, clock in watches, T5 item tier, boss level = band top + 2, Amulet never resets).
- Fix every other Blocker/Major in REVIEW-DESIGN-PLAN that targets DESIGN. Keep DESIGN §19 as the single
  balance-target table.
- Append `## Changelog (U8)` at the end listing what changed by section.

## PLAN.md changes
- **Rewrite for D-065:** §3 toolchain (exact pinned versions from `/opt/npm-tools/node_modules`: esbuild 0.28.2,
  typescript 6.0.3, react/react-dom 19.2.8, zod 3.25.76, playwright 1.56.0, @types/node 26.2.0, tsx 4.23.12; bun
  1.4.2), `package.json` scripts (`build`, `dev`, `typecheck`, `lint`, `test`, `test:e2e`, `validate`, `sim`,
  `sim:balance`, `check`), `tsconfig` flags, `tools/build.ts`, `tools/dev.ts`, `tools/lint.ts` rules,
  `tools/link-local-deps.mjs`, `src/types/react.d.ts` shim scope, `bunfig.toml` coverage thresholds, Playwright
  config using `playwright/test` with Chromium from `PLAYWRIGHT_BROWSERS_PATH`, in-repo a11y checks; §11 CI and
  Pages YAML (setup-node 22 + `npm install` with exact pins, no lockfile; `oven-sh/setup-bun`; Playwright browser
  install; Pages deploy of `dist/` with relative asset URLs).
- **Contracts (§4–§5):** `step(state, action, content, profile) → {state, profile, events}` (D-041),
  `structuredClone` drafts (D-065 replaces immer), illegal actions never throw (D-043), D-066 ordered-pattern
  intents and OR-list boss triggers, item/stat schema gaps from REVIEW-DESIGN-PLAN (armor/ward split, spell power,
  affixes, `shield_heavy`/`void_focus`, class resources), one canonical Condition/Effect set covering every shape
  used in DESIGN/STORY/WORLD (incl. clock in watches, `daysLeft`, `counter`, `resolve`, `companion`, scatter),
  `loadScenario(id)` dev hook, clock in ticks, AP in half-points.
- **Ids:** Appendix A and all code samples per D-044 and the registry.
- **Work breakdown (§9):** replace the 20-workstream fan-out with an ordered **unit list** sized 15–30 min each
  (matching `docs/STATUS.md` "Checkpoint protocol"), each unit tagged **Opus / Sonnet / ✦ Fable** per the STATUS
  model-routing rules, with dependencies. This list becomes STATUS U11+.
- Append `## Changelog (U8)`.

Use targeted Edit operations, not wholesale rewrites, except where a section must be replaced (PLAN §3, §9, §11).
Keep both documents well-formed Markdown. Reply in ≤15 lines: what changed, anything you could not resolve, and
the unit list's length.
