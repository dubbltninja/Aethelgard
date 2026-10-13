# PLAN.md — Engineering Plan for *Echoes of Aethelgard: The Unraveling*

Status: v1.1 (U8 revision, 2026-10-13). Owner: technical lead. Branch: `unraveling`.
Canon: `docs/DECISIONS.md` (D-001..D-066). This plan elaborates Part D and must not contradict it; under D-062 it ranks last, so every number, id and rule it restates comes from DECISIONS, STORY, DESIGN or WORLD. Toolchain: **D-065** (offline; no Vite, vitest, ESLint, Prettier, immer, jsdom, Testing Library, `@types/react` or axe-core). Ids: **D-044** and `docs/reviews/REGISTRY-DRAFT.md`.
Siblings: `docs/DESIGN.md` (systems and numbers), `docs/STORY.md` (narrative, quests, Echoes), `docs/WORLD.md` (places, creatures, items, NPCs).

How to use this document: each **unit** (U10–U91, section 9) is a 15–30 minute brief an agent can execute from a fresh context, following `docs/STATUS.md`'s checkpoint protocol. Sections 2–8 are the shared contracts those briefs refer to. Code blocks "compile in spirit": they are the authoritative shape, to be adapted (imports, file splitting), not pasted blindly. When a contract here and a sibling doc disagree, the lead resolves it by appending a decision to `DECISIONS.md` Part E and updating this file; nobody edits a contract silently.

---

## 1. Goals and quality bars

The rebuild is done when every box below is checked. Each item names the command that proves it and the number that passes.

### 1.1 Correctness gates (CI-blocking)

- [ ] **Typecheck** — `npm run typecheck` (`tsc --noEmit`) exits 0 with the strict flag set of 3.2 (D-065). Zero `// @ts-ignore`; `// @ts-expect-error` allowed only in tests with a reason.
- [ ] **Lint** — `npm run lint` (`bun tools/lint.ts`) exits 0: layer import boundaries (2.3), engine purity, no `console` in engine/content, no explicit `any` outside `src/types/`, no `.only`/`debugger`, whitespace and final-newline rules (3.4). `TODO(U##)` markers are allowed only when tied to an open unit.
- [ ] **Format** — no Prettier (D-065): `.editorconfig` plus the lint whitespace rules are the formatter contract.
- [ ] **Unit tests** — `npm test` (`bun test`) exits 0.
- [ ] **Coverage** — `bun test --coverage` with thresholds in `bunfig.toml` (3.5): `src/engine/**` ≥ 85 % lines and ≥ 80 % functions; `src/content/**` and `src/sim/**` ≥ 70 % lines (bun reports lines and functions only; branch coverage is not gated). UI has no coverage threshold (behaviour is covered by Playwright).
- [ ] **Content validation** — `npm run validate` exits 0: every content file parses against its zod schema; every cross-reference resolves (5.19); every location reachable from `loc_whispering_ruins`; every quest has a completable path (proved by sim, 7.8); every ending is referenced by at least one `ending` effect and reached by a scripted bot.
- [ ] **Build** — `npm run build` (`bun tools/build.ts`, esbuild) produces a static `dist/` with **relative asset URLs** (works at any Pages path, D-065), total JS ≤ 600 kB gzipped, no external runtime asset requests (verified by a Playwright test that fails on any network request not to the page origin).
- [ ] **E2E smoke** — `npm run test:e2e -- --grep @smoke` passes on `desktop-chromium` (1280×800) and `mobile-chromium` (390×844).

### 1.2 Simulation gates (release-blocking, run by `npm run sim:balance`)

- [ ] **Bots complete runs** — every bot in {melee, caster, explorer, speedrunner, pacifist, random} finishes ≥ 2,000 steps or a loop without engine errors for every class (30 seeds × 5 classes × 6 bots = 900 runs minimum per batch; the release batch is ≥ 2,000 runs).
- [ ] **Loop 1 completion** — every class's **Escape rate** (Contained Tyrant killed and portal reached, `closer_escape`; D-066 #17) is ≥ 60 % of seeds with the melee *or* caster bot (D-037, DESIGN §19 #1). Clock-expiry closers and FALLEN game-overs are reported separately.
- [ ] **Zero soft-locks** in ≥ 2,000 runs (detector in 7.6: no progress signature change for K = 60 steps; or `legalActions` returns an empty array outside `ending`; or a day counter that does not advance over 400 non-combat steps while no quest stage changes, excluding steps inside Silverwood Before, the Threshold and dialogue).
- [ ] **Coverage of content by sims** — 100 % of quests completed, 100 % of locations visited, 100 % of endings reached (6 true + 2 closers), ≥ 95 % of creatures killed, ≥ 90 % of items obtained, across the union of all runs including scripted `pathBot` runs.
- [ ] **Balance targets** — every row of **DESIGN §19**, the single balance-target table (D-066 #17), is measured per batch and written to `docs/BALANCE.md`. PLAN restates none of the numbers; §7.5 maps each row to a metric.
- [ ] **Determinism** — replaying a recorded (seed, action list) reproduces the identical final state hash in 100 % of 200 sampled runs (7.4), on both bun and in the browser (Playwright replay test, fixture pack only; D-066 #18).

### 1.3 Experience gates (manual, recorded in `docs/REPORT.md`)

- [ ] **Playwright flows** on both viewports: title → class select → first fight → rest → save/load → Heartstone choice → (`loadScenario('pre_tyrant_l13_ranger')`) Tyrant → portal → **Loop 2 Day 1** (no Threshold, D-049) → (`loadScenario('loop2_end')`) Threshold → spend Resonance → new loop → (`loadScenario('ending_a_ready')`) one true ending. Long stretches are skipped with the dev-only scenario loader (4.13), never with recorded traces.
- [ ] **Screenshots** — every screen and panel captured on both viewports into `docs/screenshots/{desktop,mobile}/NN-name.png` and committed.
- [ ] **Accessibility** — the in-repo checks of 8.4 pass on every screen (axe-core is unavailable, D-065): token-contrast test, accessible name/role for every control, keyboard focus-order walk, reduced-motion check; all D-035 criteria in 6.7 pass.
- [ ] **Three fun-review rounds** — each a full human (or lead-agent) playthrough of Loop 1 and one true ending, producing a dated list of findings in `docs/REPORT.md` and a balance/content patch; round 3 has zero "blocker" findings.
- [ ] **Final audit** — the lead re-runs `npm run check` from a clean clone, re-reads D-001..D-066 against the shipped content (checklist in 10.7), and signs `docs/REPORT.md`.

---

## 2. Repository layout

The repo root is the existing `Aethelgard` repository; the Python game moves to `legacy/` (D-039). Everything below is new unless marked *(exists)*.

```
Aethelgard/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # typecheck, lint, test, validate, build, e2e smoke
│       └── pages.yml                  # deploy dist/ to GitHub Pages (main + dispatch)
├── .editorconfig                      # formatter contract (no Prettier, D-065)
├── .gitignore                         # (exists) + node_modules, dist, coverage, playwright-report, test-results
├── .nvmrc                             # 22
├── .npmrc                             # package-lock=false, save-exact=true (3.1)
├── bunfig.toml                        # bun test root, preload, coverage thresholds (3.3)
├── index.html                         # static shell; tools/build.ts copies it to dist/ with relative URLs
├── package.json                       # exact pins, no lockfile (3.1, D-065)
├── playwright.config.ts               # imports from 'playwright/test' (3.6)
├── tsconfig.json                      # app + tests + tools (strict, noEmit)
├── README.md                          # (exists; rewritten in U57) play, develop, deploy
├── docs/
│   ├── DECISIONS.md                   # (exists) canon
│   ├── DESIGN.md  STORY.md  WORLD.md  # being written in parallel
│   ├── PLAN.md                        # this file
│   ├── BIBLE.md  BALANCE.md  REPORT.md  CONTENT.md
│   └── screenshots/{desktop,mobile}/
├── legacy/
│   ├── README.md                      # how to run the original (D-039)
│   ├── echoes_of_aethelgard.py        # moved, unchanged
│   ├── aethelgard_data.py             # moved, unchanged
│   └── web_ui/                        # moved, unchanged
├── public/
│   ├── favicon.svg
│   └── manifest.webmanifest
├── src/
│   ├── main.tsx                       # React root, store bootstrap, audio unlock listener
│   ├── types/                         # in-repo declarations (D-065); the only place `any` is allowed
│   │   ├── react.d.ts                 # React 19 + react-dom/client + jsx-runtime surface we use (3.7)
│   │   ├── bun-test.d.ts              # `bun:test` (no bun-types package offline)
│   │   └── globals.d.ts               # build-time constants: __DEV__, __E2E__, __VERSION__ (esbuild define)
│   ├── engine/                        # LAYER 1 — pure, deterministic, no DOM
│   │   ├── index.ts                   # public surface: step, legalActions, newRun, Rng, types
│   │   ├── types/
│   │   │   ├── state.ts               # GameState and sub-types (4.2)
│   │   │   ├── profile.ts             # Profile (4.3)
│   │   │   ├── actions.ts             # Action union (4.4)
│   │   │   ├── events.ts              # GameEvent union (4.5)
│   │   │   └── ids.ts                 # branded id aliases
│   │   ├── rng.ts                     # xoshiro128**, seedFromString (4.1)
│   │   ├── step.ts                    # step(): dispatch by action.type to reducers (4.6)
│   │   ├── legalActions.ts            # (4.7)
│   │   ├── newRun.ts                  # initial GameState from (seed, classId, profile, content)
│   │   ├── ctx.ts                     # StepCtx: draft, profile draft, rng, events, content
│   │   ├── conditions.ts              # evaluate(cond, state, profile, content) (4.9)
│   │   ├── effects.ts                 # apply(effect, ctx) (4.9)
│   │   ├── reducers/
│   │   │   ├── explore.ts             # move, take, examine, rest, talk, enterPortal
│   │   │   ├── inventory.ts           # use, equip, unequip, drop, allocateStat, unlockAbility
│   │   │   ├── economy.ts             # buy, sell, restock, pricing by rep tier
│   │   │   ├── crafting.ts            # craft, upgrade
│   │   │   ├── dialogue.ts            # talk → scene selection, choose, continue
│   │   │   ├── quests.ts              # stage machine, objectives, journal, shortcuts
│   │   │   ├── combat.ts              # attack/ability/guard/item/flee/companionCommand/setStance
│   │   │   ├── loop.ts                # clock, day/watch advance, horde, loop end, Threshold
│   │   │   ├── threshold.ts           # thresholdSpend, chooseClass, toggleModifier, newLoop
│   │   │   └── meta.ts                # newGame, save (event), load (replace), chooseClass at title
│   │   ├── combat/
│   │   │   ├── damage.ts              # pipeline: power → variance → resist → statuses → guard → shield
│   │   │   ├── statuses.ts            # 18 statuses + rested, tick, interplay table (D-009)
│   │   │   ├── intents.ts             # ordered-pattern pointer, CombatWhen, telegraph, resolution (DESIGN §4.2)
│   │   │   ├── phases.ts              # boss phase OR-triggers in rounds, adds
│   │   │   ├── specials.ts            # SPECIALS const list (scriptId registry) — content mirrors it by test
│   │   │   ├── turnOrder.ts           # initiative from AGI, ties by rng
│   │   │   ├── companionAi.ts         # stance policies
│   │   │   ├── flee.ts
│   │   │   └── rewards.ts             # xp, loot, bestiary, counters
│   │   ├── progression.ts             # xp curve, level-up, AP half-points, resource generation per class
│   │   ├── derived.ts                 # derived stats: ATK, SP, armor, ward, accuracy, evasion, crit (DESIGN §3.2)
│   │   ├── communion.ts               # Resolve 0–8, Movements, questions (DESIGN §4.11)
│   │   ├── before.ts                  # Silverwood Before counter (DESIGN §10.1)
│   │   ├── saves/
│   │   │   ├── saveFile.ts            # SaveFile schema (zod), serialize/deserialize
│   │   │   ├── migrations.ts          # version → migration fn
│   │   │   └── profileFile.ts
│   │   └── util/
│   │       ├── clone.ts               # structuredClone draft + dev-only deepFreeze (4.6)
│   │       ├── hash.ts                # stateHash for determinism tests
│   │       └── math.ts                # clamp, round, pct
│   ├── content/                       # LAYER 2 — data + schemas; never imports engine
│   │   ├── index.ts                   # buildContentPack(): assembles + validates all tables
│   │   ├── validate.ts                # validateContent(pack) → { errors, warnings } (5.19)
│   │   ├── schema/                    # zod schemas + inferred types (section 5)
│   │   │   ├── index.ts  primitives.ts  condition.ts  effect.ts
│   │   │   ├── location.ts  region.ts  creature.ts  item.ts  recipe.ts
│   │   │   ├── ability.ts  class.ts  status.ts  quest.ts  dialogue.ts
│   │   │   ├── npc.ts  companion.ts  echo.ts  codex.ts  achievement.ts
│   │   │   ├── attunement.ts  modifier.ts  ending.ts  merchant.ts  faction.ts
│   │   │   └── contentPack.ts         # ContentPack type + table list
│   │   ├── shared/                    # cross-region tables
│   │   │   ├── classes.ts  affixes.ts  abilities/{ranger,wizard,elf,warden,weaver,items}.ts
│   │   │   ├── statuses.ts  factions.ts  recipes.ts  merchants.ts
│   │   │   ├── companions.ts  echoes.ts  codex/*.ts  achievements.ts
│   │   │   ├── attunements.ts  modifiers.ts  endings.ts
│   │   │   └── quests/{legacy,factions,companions,loop,endings}.ts
│   │   └── regions/                   # file-per-region (10.3)
│   │       ├── silverwood_ruins/{region,locations,creatures,items,npcs,dialogues,quests}.ts
│   │       ├── mistwood_ironclad_reach/…  voidscar/…  aether_kissed_highlands/…  glowlands_nexus/…
│   │       ├── silverwood_before/…  drowned_reach/…  ashen_steppe/…  veil/…
│   │       ├── glowfen/…  skyreach/…  threshold/…
│   │       └── index.ts               # concatenates region tables
│   ├── ui/                            # LAYER 3 — React
│   │   ├── App.tsx                    # mode switch (6.2)
│   │   ├── dev/                       # dev/e2e-only: scenario loader UI hook, ?gallery= component page
│   │   ├── store/
│   │   │   ├── gameStore.ts           # createGameStore(content) (6.1)
│   │   │   ├── useGame.ts             # useSyncExternalStore hooks
│   │   │   ├── persistence.ts         # localStorage slots, export/import, quota handling
│   │   │   └── eventBus.ts
│   │   ├── screens/
│   │   │   ├── TitleScreen.tsx  ClassSelectScreen.tsx  ExploreScreen.tsx
│   │   │   ├── CombatScreen.tsx  DialogueScreen.tsx  ThresholdScreen.tsx
│   │   │   ├── EndingScreen.tsx  RunSummary.tsx
│   │   │   └── threshold/{StillShore,GalleryOfLoops,Loom,FarLight}.tsx
│   │   ├── panels/
│   │   │   ├── InventoryPanel.tsx  EquipmentPanel.tsx  AbilitiesPanel.tsx
│   │   │   ├── QuestJournalPanel.tsx  CodexPanel.tsx  BestiaryPanel.tsx
│   │   │   ├── TimelinePanel.tsx  SettingsPanel.tsx  SavesPanel.tsx
│   │   │   ├── MerchantPanel.tsx  CraftingPanel.tsx  CompanionPanel.tsx
│   │   │   ├── MapPanel.tsx  HelpPanel.tsx
│   │   │   └── PanelHost.tsx          # focus trap, Esc, aria-modal
│   │   ├── components/                # StatusBar, LogPanel, ActionBar, ExitBar, EnemyCard, PartyCard,
│   │   │                              # AbilityBar, IntentBadge, StatusBadge, ClockWidget, Button, Tabs, Dialog…
│   │   ├── art/
│   │   │   ├── Scene.tsx  CreatureSigil.tsx  Icon.tsx  RegionPalette.tsx
│   │   │   ├── layers/{Sky,Horizon,Silhouettes,Particles,Weather}.tsx
│   │   │   ├── shapes/                # silhouette library keyed by string
│   │   │   ├── focal/                 # hand-authored pieces: HeartstoneFocal, TyrantFocal, PortalFocal, …
│   │   │   ├── sigils/                # per-family sigil generators + boss overrides
│   │   │   └── uiRng.ts               # UI-only seeded rng for flourishes (D-032)
│   │   ├── hooks/{useHotkeys,useMediaQuery,useReducedMotion,useFocusTrap,useAnnouncer}.ts
│   │   ├── a11y/{LiveRegion.tsx,SkipLink.tsx,focus.ts}
│   │   └── styles/{tokens.css,base.css,layout.css,components.css,themes.css}
│   ├── audio/
│   │   ├── engine.ts                  # AudioEngine (6.5)
│   │   ├── map.ts                     # GameEvent → SfxId
│   │   ├── synth/{voices,envelopes,noise,sequencer}.ts
│   │   ├── sfx/*.ts                   # the 30 sfx_* voices of DESIGN §18.3
│   │   └── ambient/*.ts               # per-region drones, tyrant theme, threshold theme
│   └── sim/                           # headless; imports engine + content only
│       ├── cli.ts                     # bun entry: run | batch | endings | replay | scenario
│       ├── bots/{types,melee,caster,explorer,speedrunner,pacifist,random,pathBot,shared}.ts
│       ├── scenarios.ts               # loadScenario(id) builders (4.13), shared with e2e
│       ├── runner.ts  batch.ts  worker.ts
│       ├── metrics.ts  softlock.ts  coverage.ts  report.ts
│       └── scripts/endings/{escape,a_vigil,b_mending,c_dawn,d_silence,e_archive,f_unbound}.ts
├── tests/
│   ├── preload.ts                     # bun test preload: soft-assert collector, fixture registry
│   ├── fixtures/                      # miniContent.ts (fixture pack), determinism traces for the fixture pack only
│   ├── unit/
│   │   ├── engine/**                  # mirrors src/engine
│   │   ├── content/**                 # schema, crossrefs, reachability, completability
│   │   ├── tools/**                   # lint rules, build output
│   │   └── ui/<area>/**               # react-dom/server snapshot tests, owned by the unit that builds the area
│   └── e2e/
│       ├── smoke.spec.ts  flows.spec.ts  mobile.spec.ts  a11y.spec.ts
│       ├── screenshots.spec.ts  replay.spec.ts  noNetwork.spec.ts
│       └── helpers/{driver.ts,selectors.ts}
└── tools/
    ├── build.ts                       # esbuild bundle → dist/ (relative URLs), copies index.html + public/ (3.5)
    ├── dev.ts                         # esbuild serve + watch + live reload (3.5)
    ├── lint.ts                        # custom lint rules (3.4)
    ├── link-local-deps.mjs            # offline bootstrap: symlink /opt/npm-tools/node_modules/* → node_modules (3.6)
    ├── serve.mjs                      # static server for dist/ and dist-e2e/ (Playwright webServer, preview)
    ├── coverage-gate.ts               # per-directory coverage bars from coverage/lcov.info (3.3)
    ├── a11y/{contrast.ts,checks.ts}   # in-repo a11y checks used by unit tests and Playwright (8.4)
    ├── validate-content.ts            # npm run validate
    ├── gen-balance.ts                 # batch → docs/BALANCE.md
    ├── content-stats.ts               # counts per table/region for REPORT.md
    ├── new-content.ts                 # scaffolds a location/creature/item/quest file section
    ├── check-ids.ts                   # duplicate/invalid id scan across all tables
    └── move-legacy.sh                 # one-shot git mv of python files (U10)
```

### 2.1 Layer dependency rules (D-031)

| From ↓ may import → | engine | content/schema | content (data) | ui | audio | sim |
|---|---|---|---|---|---|---|
| **engine** | yes | **yes (types & zod only)** | no | no | no | no |
| **content/schema** | no | yes | no | no | no | no |
| **content (data)** | no | yes | yes | no | no | no |
| **ui** | yes | yes | yes (via `buildContentPack`) | yes | yes | no |
| **audio** | types only (`GameEvent`) | no | no | no | yes | no |
| **sim** | yes | yes | yes | no | no | yes |
| **tests** | anything | | | | | |

Clarification of D-031 "the engine never imports concrete content": the engine imports *schemas and inferred types* from `src/content/schema/` (that is the contract, not content) and receives the data as a `ContentPack` argument. Nothing under `src/content/regions/**` or `src/content/shared/**` may be imported by the engine. The engine is also forbidden from `react`, `react-dom`, any DOM global, `Math.random`, `Date.now`, `performance.now`, `crypto` and `localStorage` (3.4).

### 2.2 Path aliases

`@engine/*`, `@content/*`, `@schema/*` (= `src/content/schema/*`), `@ui/*`, `@audio/*`, `@sim/*`, `@tests/*`. Cross-layer imports must use aliases; relative imports only within a layer. Aliases are declared in `tsconfig.json` `paths` and resolved by esbuild (`tools/build.ts` passes `tsconfig`) and by bun (which reads `tsconfig` paths natively). The hard enforcement is the layer rule in `tools/lint.ts`, which resolves every import to a file path first, so it catches relative and alias forms alike.

### 2.3 Enforcement: the layer rule in `tools/lint.ts`

dependency-cruiser is not installed and the npm registry is blocked (D-065), so the layer table of 2.1 is enforced by `tools/lint.ts` rule `layers` (3.4). The rule parses every `import`/`export … from`/dynamic `import()` with the TypeScript compiler API (`ts.preProcessFile`), resolves the specifier against `tsconfig` `paths` and relative directories to a repo path, and checks the (from-layer, to-layer) pair against this matrix:

```ts
// tools/lint.ts (excerpt)
const LAYERS = [
  ['engine', /^src\/engine\//], ['schema', /^src\/content\/schema\//], ['content', /^src\/content\//],
  ['ui', /^src\/ui\//], ['audio', /^src\/audio\//], ['sim', /^src\/sim\//], ['types', /^src\/types\//],
] as const;
const ALLOW: Record<string, string[]> = {
  engine: ['engine', 'schema', 'types'],
  schema: ['schema', 'types'],
  content: ['content', 'schema', 'types'],
  ui: ['ui', 'engine', 'schema', 'content', 'audio', 'types'],
  audio: ['audio', 'types', 'engine/types'],          // engine types only
  sim: ['sim', 'engine', 'schema', 'content', 'types'],
};
// also: no import cycles inside src/engine (DFS over the resolved graph); bare package imports from
// src/engine and src/content are limited to 'zod'.
```

Violations print `file:line rule message` and exit 1. A fixture test (`tests/unit/tools/lint.test.ts`) feeds one known violation per rule and asserts it is reported, so the rule cannot rot silently.

---

## 3. Toolchain and config (D-065)

The npm registry is blocked in the build sandbox (D-065), so the toolchain is exactly what is installed under `/opt/npm-tools/node_modules` plus bun, verified working together on 2026-10-10 and re-checked for this plan on 2026-10-13 (`tsc` 6.0.3 accepts the 3.2 config; `bun test` resolves `tsconfig` paths and fails on a missed coverage threshold; esbuild bundles TSX through `tsconfig` paths; `playwright test` runs from the `playwright` package).

| Tool | Version (exact) | Role |
|---|---|---|
| Node | 22 (`.nvmrc`) | npm, `tsc`, Playwright runner, `tools/*.mjs` |
| bun | 1.4.2 (`/root/.bun/bin/bun`; CI `oven-sh/setup-bun`) | unit tests + coverage, TS scripts (`tools/*.ts`, `src/sim/cli.ts`) |
| esbuild | 0.28.2 | bundler for build and dev (`tools/build.ts`, `tools/dev.ts`) |
| typescript | 6.0.3 | `tsc --noEmit` typecheck; compiler API used by `tools/lint.ts` |
| react / react-dom | 19.2.8 | UI (React 19, not 18) |
| zod | 3.25.76 | content and save schemas |
| playwright | 1.56.0 | e2e; runner imported from `playwright/test` (`@playwright/test` is absent); Chromium from `PLAYWRIGHT_BROWSERS_PATH` |
| @types/node | 26.2.0 | types for `tools/`, sim workers |
| tsx | 4.23.12 | fallback runner for `tools/*.ts` under plain Node (not used by scripts) |

Not available and not used: Vite, vitest, ESLint, Prettier, immer, jsdom, Testing Library, `@types/react`, axe-core, dependency-cruiser. Every role they had is covered below.

### 3.1 `package.json`

```jsonc
{
  "name": "echoes-of-aethelgard",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "bun tools/validate-content.ts && bun tools/build.ts",
    "dev": "bun tools/dev.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "bun tools/lint.ts",
    "test": "bun test && bun tools/coverage-gate.ts",
    "test:e2e": "bun tools/build.ts --e2e && playwright test",
    "validate": "bun tools/validate-content.ts",
    "sim": "bun src/sim/cli.ts run --seeds 20 --bots melee,caster --classes all",
    "sim:balance": "bun src/sim/cli.ts batch --seeds 400 --bots all --classes all --out docs/BALANCE.md",
    "check": "npm run typecheck && npm run lint && npm run validate && npm test && npm run build && npm run test:e2e -- --grep @smoke"
  },
  "dependencies": {
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zod": "3.25.76"
  },
  "devDependencies": {
    "@types/node": "26.2.0",
    "esbuild": "0.28.2",
    "playwright": "1.56.0",
    "tsx": "4.23.12",
    "typescript": "6.0.3"
  }
}
```

- **Exact pins, no lockfile.** A lockfile cannot be generated offline, so none is committed; `.npmrc` sets `package-lock=false` and `save-exact=true`. Exact pins of five direct dev dependencies and three runtime ones keep CI installs reproducible; their transitive closure is small (`scheduler`, `playwright-core`, `undici-types`, `@esbuild/<platform>`).
- **Offline bootstrap.** In the sandbox, `node tools/link-local-deps.mjs` replaces `npm install` (3.6). In GitHub Actions, `npm install` fetches the same exact versions (§11).
- **Script names are the contract** used by STATUS, CI and every unit: `build`, `dev`, `typecheck`, `lint`, `test`, `test:e2e`, `validate`, `sim`, `sim:balance`, `check`. `npm test` runs the unit suite with coverage (thresholds in `bunfig.toml`) and then the per-directory gate.
- **No UI kit, no CSS framework.** The game needs one bespoke look (D-036). Plain CSS with design tokens in `src/ui/styles/tokens.css` (CSS custom properties for colour, spacing, type scale, motion) and `block__element--modifier` class names; esbuild bundles the CSS imported from `src/main.tsx` into one file. Region palettes are CSS variables set by `<RegionPalette/>`.
- **No immer** (D-065 supersedes D-042): `step` clones with `structuredClone` (4.6).

### 3.2 `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"],
    "paths": {
      "@engine/*": ["./src/engine/*"],
      "@content/*": ["./src/content/*"],
      "@schema/*": ["./src/content/schema/*"],
      "@ui/*": ["./src/ui/*"],
      "@audio/*": ["./src/audio/*"],
      "@sim/*": ["./src/sim/*"],
      "@tests/*": ["./tests/*"]
    }
  },
  "include": ["src", "tests", "tools", "playwright.config.ts"]
}
```

The seven strict flags are D-065's. `noUncheckedIndexedAccess` forces a `?? fail(...)` at every `content.items[id]` lookup, which is the discipline that prevents "undefined is not an object" in sims. There is no `baseUrl` (deprecated in TypeScript 6; `paths` are relative to the config). `types: ["node"]` is explicit because the React and `bun:test` types come from `src/types/*.d.ts` (3.7), which `include: ["src"]` picks up. One config covers app, tests and tools; bun and esbuild both read its `paths`.

### 3.3 `bunfig.toml` and the coverage gate

```toml
[test]
root = "tests/unit"
preload = ["./tests/preload.ts"]
coverage = true
coverageReporter = ["text", "lcov"]
coverageDir = "coverage"
coverageSkipTestFiles = true
coverageThreshold = { lines = 0.80, functions = 0.75 }   # global floor; bun fails the run below it
```

bun's thresholds are global, so `tools/coverage-gate.ts` reads `coverage/lcov.info` after `bun test` and enforces the per-directory bars of 1.1: `src/engine/**` ≥ 85 % lines and ≥ 80 % functions; `src/content/**` and `src/sim/**` ≥ 70 % lines. It prints a table and exits 1 on any miss. bun reports lines and functions only; branch coverage is not gated. `tests/preload.ts` installs the soft-assertion collector used by content tests (8.2) and registers the fixture pack.

### 3.4 `tools/lint.ts` rules

A single bun script, no plugins. It walks `src/`, `tests/`, `tools/` (`.ts`, `.tsx`, `.mjs`, `.css`, `.json`, `.md` for whitespace only), parses TS with the compiler API (`ts.createSourceFile`, no type-checking — `tsc` does that), and reports `path:line:col rule message`. Exit 1 on any error; there are no warnings.

| Rule | Scope | Fails on |
|---|---|---|
| `layers` | `src/**` | an import edge not allowed by 2.1 (resolved paths, 2.3); an import cycle inside `src/engine` |
| `engine-purity` | `src/engine/**` | `Math.random`, `Date.now`, `new Date(`, `performance.now`, `crypto`, `setTimeout`, `setInterval`, `localStorage`, `sessionStorage`, `window`, `document`, `navigator`, `globalThis`; imports of `react`, `react-dom`, any package except `zod` |
| `no-console` | `src/engine/**`, `src/content/**` | any `console.*` |
| `no-explicit-any` | everything except `src/types/**` | an `any` keyword in a type position (`AnyKeyword` node) |
| `no-focused-tests` | `tests/**` | `.only(`, `test.only`, `describe.only`, `it.only` |
| `no-debugger` | everywhere | `debugger` statements |
| `no-ts-ignore` | everywhere | `@ts-ignore`; `@ts-expect-error` outside `tests/` or without a reason after it |
| `content-literals` | `src/content/**` | an id string literal whose prefix is not in D-044's list (`/^(region|loc|cr|item|mat|recipe|npc|q|echo|scene|codex|ending|closer|status|affix|att|ach|mod|sfx|screen|ev|flag|fam|pool|gate|ws|tyr|rgr|wiz|elf|wrd|wvr|comp|itm)_/` or a plain id of D-044) in an `id:` property |
| `whitespace` | all text files | tab indentation in TS/CSS, trailing whitespace, CRLF, missing final newline, more than one blank line at EOF |

`.editorconfig` declares the same whitespace rules (2-space indent, LF, final newline, trim trailing whitespace; Markdown keeps trailing spaces off as well) so editors format consistently without Prettier.

### 3.5 `tools/build.ts` and `tools/dev.ts` (esbuild)

```ts
// tools/build.ts (shape) — `bun tools/build.ts [--e2e]`
import * as esbuild from 'esbuild';
const e2e = process.argv.includes('--e2e');
const outdir = e2e ? 'dist-e2e' : 'dist';
const result = await esbuild.build({
  entryPoints: { app: 'src/main.tsx' },          // CSS imported by main.tsx is emitted as app-[hash].css
  bundle: true, format: 'esm', target: 'es2022', platform: 'browser',
  jsx: 'automatic', tsconfig: 'tsconfig.json',
  minify: !e2e, sourcemap: 'linked', metafile: true,
  outdir: `${outdir}/assets`, entryNames: '[name]-[hash]', assetNames: '[name]-[hash]',
  define: {
    'process.env.NODE_ENV': '"production"',
    __DEV__: 'false', __E2E__: String(e2e), __VERSION__: JSON.stringify(pkg.version),
  },
  logLevel: 'info',
});
// then: write `${outdir}/index.html` from ./index.html, injecting <script type="module" src="./assets/app-<hash>.js">
// and <link rel="stylesheet" href="./assets/app-<hash>.css"> — RELATIVE urls, so dist/ works at any Pages path
// (no base path, no VITE_BASE; there is no router, so no 404.html). Copy public/* to ${outdir}/.
// Budget: gzip every .js in metafile outputs; fail if the total > 600 kB (1.1).
```

- `__E2E__` builds (`dist-e2e/`) enable the dev hooks of 4.13 and 8.3 (`?scenario=`, `?gallery=`, `window.__aethelgard`); production builds tree-shake them away because `__E2E__` is the literal `false`.
- `tools/dev.ts`: `esbuild.context({...same options, minify: false, define: { __DEV__: 'true', __E2E__: 'true', … }, outdir: '.dev/assets', banner: { js: "new EventSource('/esbuild').addEventListener('change', () => location.reload());" } })`, then `ctx.watch()` and `ctx.serve({ servedir: '.dev', port: 5173 })`; it writes `.dev/index.html` once. Live reload is esbuild's own change stream; no HMR.
- `tools/serve.mjs` (plain Node, ~30 lines): static file server for `dist/` or `dist-e2e/` used by Playwright's `webServer` and by `npm run build && node tools/serve.mjs dist 4173` for a local preview.

### 3.6 `tools/link-local-deps.mjs` (offline bootstrap)

Plain Node, no dependencies, idempotent. It reads `package.json`, computes the dependency closure from each package's own `dependencies`/`optionalDependencies` (skipping other platforms' `@esbuild/*` and `fsevents`), and for each package symlinks `node_modules/<name>` → `$LOCAL_NPM_TOOLS/<name>` (default `/opt/npm-tools/node_modules`). Today's closure is twelve packages: `react`, `react-dom`, `scheduler`, `zod`, `esbuild`, `@esbuild/linux-x64`, `typescript`, `playwright`, `playwright-core`, `@types/node`, `undici-types`, `tsx`. It then creates `node_modules/.bin/{tsc,esbuild,playwright,tsx}` links and **verifies** each linked `package.json` `version` equals the pin; a mismatch or a missing package exits 1 with the list. `--verify-only` skips the linking and only checks the versions already in `node_modules` (used by CI after `npm install`, §11.1). It never touches the network.

### 3.7 `src/types/` shims, `playwright.config.ts`, other root files

**`src/types/react.d.ts`** — `@types/react` is unavailable (D-065), so the repo declares exactly the React 19 surface it uses, and nothing else (adding an API = adding its declaration in the same commit):
- `react`: `ReactNode`, `ReactElement`, `FC`-free function components (`(props: P) => ReactNode`), `Fragment`, `StrictMode`, `createContext`/`useContext`, `useState`, `useReducer`, `useEffect`, `useLayoutEffect`, `useMemo`, `useCallback`, `useRef` (`RefObject`), `useId`, `useSyncExternalStore`, `memo`, `CSSProperties`, `Key`, and the event types `MouseEvent`, `PointerEvent`, `KeyboardEvent`, `FocusEvent`, `ChangeEvent`, `FormEvent`, `TouchEvent` (React 19 passes `ref` as a prop, so no `forwardRef`).
- `react/jsx-runtime` (`jsx`, `jsxs`, `Fragment`) and the global `JSX` namespace: `Element`, `ElementChildrenAttribute`, `IntrinsicAttributes` (`key`), and `IntrinsicElements` for the HTML and SVG tags the UI uses, typed with shared attribute interfaces (`className`, `id`, `style`, `role`, `tabIndex`, `hidden`, `title`, `aria-*`, `data-*`, event handlers, form attributes; SVG `viewBox`, `d`, `fill`, `stroke*`, `transform`, `x/y/width/height/r/cx/cy/points/opacity`).
- `react-dom/client` (`createRoot`, `Root`) and `react-dom/server` (`renderToStaticMarkup`, `renderToString`, used by snapshot tests in bun).
- `any` is allowed only in `src/types/**` (lint `no-explicit-any`). `tests/unit/tools/types.test.ts` holds `@ts-expect-error` cases (wrong prop type, unknown hook) so the shim stays strict.

**`src/types/bun-test.d.ts`** — `declare module 'bun:test'` with `describe`, `test`/`it` (incl. `.each`, `.skip`, `.todo`), `expect` and the matchers the suite uses (`toBe`, `toEqual`, `toStrictEqual`, `toBeDefined`, `toBeUndefined`, `toBeNull`, `toBeTruthy`, `toBeFalsy`, `toContain`, `toHaveLength`, `toHaveProperty`, `toMatchObject`, `toThrow`, `toBeGreaterThan(OrEqual)`, `toBeLessThan(OrEqual)`, `toBeCloseTo`, `toMatchSnapshot`, `toMatchInlineSnapshot`, `.not`), `beforeAll`/`beforeEach`/`afterEach`/`afterAll`, `mock`, `spyOn`. `src/types/globals.d.ts` declares `__DEV__`, `__E2E__`, `__VERSION__`.

**`playwright.config.ts`**

```ts
import { defineConfig, devices } from 'playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4173/', trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: 'node tools/serve.mjs dist-e2e 4173', url: 'http://127.0.0.1:4173/', reuseExistingServer: !process.env.CI },
});
```

Chromium is found through `PLAYWRIGHT_BROWSERS_PATH` (`/opt/pw-browsers` in the sandbox, set in the shell profile; CI installs it, §11). Only Chromium is used. The a11y checks are in-repo (8.4): `tools/a11y/contrast.ts` (WCAG relative-luminance math over `tokens.css` pairs) and `tools/a11y/checks.ts` (Playwright helpers: every focusable element has an accessible name via `page.getByRole`, focus-order walk with `Tab`, reduced-motion animation scan).

**Other root files:** `.editorconfig` (3.4); `.npmrc` (`package-lock=false`, `save-exact=true`); `.nvmrc` (`22`); `.gitignore` adds `node_modules/`, `dist/`, `dist-e2e/`, `.dev/`, `coverage/`, `playwright-report/`, `test-results/`, `package-lock.json`; `index.html` (static shell: `<div id="root">`, a `<noscript>` line, the title "Echoes of Aethelgard"); `public/{favicon.svg,manifest.webmanifest}`.

---

## 4. Engine contracts (TypeScript)

All types live in `src/engine/types/*` and are re-exported from `src/engine/index.ts`. Ids are plain `string` aliases (not branded) with template-literal prefixes where D-044 fixes one (`type LocationId = `loc_${string}``, `CreatureId = `cr_${string}``, `QuestId = `q_${string}``, `EchoId = `echo_${string}``, `FlagId = `flag_${string}``, …), so content literals need no casts and a wrong prefix is a type error; the validator (5.19) and `noUncheckedIndexedAccess` provide the rest. Everything in `GameState` and `Profile` is JSON-serializable: no `Map`, `Set`, `Date`, `undefined`-bearing arrays, functions or class instances (this is also what makes `structuredClone` cheap and exact).

### 4.0 Decisions this section implements (all recorded in DECISIONS.md)

- **D-041 — `step` takes and returns the Profile.** `step(state, action, content, profile) → { state, profile, events }`. The profile stays a separate object (D-034: survives deleting a run) but Echo grants, codex/bestiary unlocks, achievements and Resonance are written during transitions.
- **D-065 (supersedes D-042) — `structuredClone` drafts, no immer.** `step` deep-copies `state` with `structuredClone`, lets reducers mutate the copy, and returns it; the profile is cloned **lazily**, only when a reducer first asks for `ctx.profileDraft()`. Callers never observe mutation. In dev/test builds (`__DEV__`), `step` deep-freezes the returned objects so a reducer that mutates its *input* fails loudly in tests.
- **D-043 — illegal actions never throw.** `step` returns the same `state` and `profile` references and one `actionRejected` event. Throwing is reserved for programmer errors (missing content id after validation, corrupt state).
- **D-044 — ids carry their type prefix** (`loc_`, `cr_`, `item_`, `q_`, `echo_`, `flag_`, `status_`, `rgr_`/`wiz_`/`elf_`/`wrd_`/`wvr_`, `comp_<companion>_`, `itm_`, …); classes, companions, factions, damage types and stats are plain ids. In data the Echo condition is `{ echo: "echo_litany_verse_1" }`. Appendix A and every sample in this file use the canonical ids of `docs/reviews/REGISTRY-DRAFT.md`.
- **D-066 #14–#16, #18 — enemy AI is DESIGN §4.2's ordered pattern; ability points and mastery are stored in half-points; the clock is stored in ticks (watches); one canonical condition/effect set (4.9); e2e uses `loadScenario(id)` (4.13).**

### 4.1 `Rng` — xoshiro128** (`src/engine/rng.ts`)

```ts
/** Four unsigned 32-bit words. Stored in GameState.rng; never all zero. */
export type RngState = readonly [number, number, number, number];

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

/**
 * Mutable cursor over an immutable RngState. A reducer creates one from the draft at the start of `step`,
 * draws from it freely, and writes `rng.state()` back at the end. Nothing else may hold an Rng.
 */
export class Rng {
  private s0: number; private s1: number; private s2: number; private s3: number;

  constructor(state: RngState) {
    [this.s0, this.s1, this.s2, this.s3] = state;
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }
  static fromSeed(seed: string | number): Rng { return new Rng(seedFromString(String(seed))); }

  state(): RngState { return [this.s0 >>> 0, this.s1 >>> 0, this.s2 >>> 0, this.s3 >>> 0]; }

  /** Uniform uint32 — the one primitive; everything else derives from it. */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 ^= this.s0; this.s3 ^= this.s1; this.s1 ^= this.s2; this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return result;
  }
  /** Float in [0, 1). */
  next(): number { return this.nextU32() / 4294967296; }
  /** Integer in [min, max], inclusive. Throws RangeError if max < min. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError(`int(${min}, ${max})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }
  /** True with probability p (clamped to [0,1]). p >= 1 never draws, p <= 0 never draws — keeps traces stable. */
  chance(p: number): boolean { return p >= 1 ? true : p <= 0 ? false : this.next() < p; }
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError('pick([])');
    return arr[this.int(0, arr.length - 1)] as T;
  }
  /** Fisher–Yates on a copy. */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = this.int(0, i); const t = out[i] as T; out[i] = out[j] as T; out[j] = t; }
    return out;
  }
  weighted<T>(entries: readonly { weight: number; value: T }[]): T {
    const total = entries.reduce((s, e) => s + Math.max(0, e.weight), 0);
    if (total <= 0) throw new RangeError('weighted(): total weight 0');
    let r = this.next() * total;
    for (const e of entries) { r -= Math.max(0, e.weight); if (r < 0) return e.value; }
    return (entries[entries.length - 1] as { value: T }).value;
  }
  /** Independent stream for a sub-system (e.g., merchant restock) without disturbing the main sequence order. */
  fork(label: string): Rng { return new Rng(seedFromString(`${this.nextU32()}:${label}`)); }
}

/** cyrb128-style string hash → 4 words. Deterministic across platforms (uses only imul/xor/shift). */
export function seedFromString(seed: string): RngState {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const s: [number, number, number, number] = [(h1 ^ h2 ^ h3 ^ h4) >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  if ((s[0] | s[1] | s[2] | s[3]) === 0) s[0] = 0x9e3779b9;
  return s;
}
```

Reference vectors for the unit test: `seedFromString('aethelgard')` must produce a fixed tuple recorded in `tests/unit/engine/rng.test.ts` on first run (golden), and `new Rng([1,2,3,4]).nextU32()` must equal the C reference implementation's first output for that state (`0x00000B40`... computed once by the test author with the C code and pinned).

### 4.2 `GameState` (`src/engine/types/state.ts`)

```ts
import type { RngState } from '../rng';

export type Mode = 'title' | 'explore' | 'combat' | 'dialogue' | 'threshold' | 'ending';
export type Watch = 0 | 1 | 2 | 3;                       // dawn, day, dusk, night (DESIGN §10.1) — travel costs one (D-005)
export type StatName = 'strength' | 'magic' | 'agility'; // D-044 plain ids
export type DamageType = 'physical' | 'fire' | 'storm' | 'ley' | 'void' | 'chrono';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type FactionId = 'remnants' | 'weavers' | 'ironclad';
export type Stance = 'aggressive' | 'guarded' | 'support';
export type EquipSlot = 'weapon' | 'armor' | 'trinket1' | 'trinket2';
export type FlagValue = boolean | number | string;

export interface GameMeta {
  seed: string;              // the run seed string (shown in run summary; replay key)
  loop: number;              // 1-based
  version: number;           // GameState schema version (saves migrate on this)
  stepCount: number;         // actions accepted so far (sim metrics, autosave cadence)
  nextUid: number;           // monotonically increasing; source of all instance ids (no randomness, no clock)
  runId: string;             // `${seed}:${loop}` at loop start; used by achievements/runHistory
  modifiers: string[];       // ModifierIds active for this run (copied from profile at newLoop; immutable mid-run)
  playerName: string;
}

export interface Stats { strength: number; magic: number; agility: number }

/** The Breach Clock, stored in ticks (one tick = one watch; D-066 #15). Day/watch are derived. */
export interface ClockState {
  ticks: number;             // 0 = Day 1 Dawn
  limitTicks: number;        // 116 = Day 30 Dawn; never below dayStart(now) + 12 (clock floor, DESIGN §10.1)
  modifiers: { source: string; watches: number }[];   // audit trail shown in the HUD tooltip
  frozen: boolean;           // true inside Silverwood Before
  expired: boolean;          // set at the limit; the expiry Horde runs (DESIGN §10.2)
}

/** Silverwood Before's own counter (DESIGN §10.1, D-066 #9); null outside the Before. */
export interface BeforeState { day: 1 | 2 | 3; resets: number }

export interface ItemInstance {
  uid: string;               // `i${nextUid}`
  itemId: string;
  qty: number;               // stackables only; equipment always 1
  rarity: Rarity;            // rarity IS the upgrade ladder (DESIGN §8.3); no separate upgrade level
  affixes: string[];         // AffixIds (DESIGN §7.3); saves must keep them
  boundQuest?: string;       // set when granted by a quest; cannot be sold/dropped while that quest is active
}

/** Per-loop / per-day usage records (DESIGN §14.1). */
export type Uses = Record<string, { loop?: number; day?: number; count?: number }>;

export interface PlayerState {
  name: string;
  classId: string;
  level: number;
  xp: number;                // xp toward next level (curve in progression.ts; legacy: level*100)
  stats: Stats;
  hp: number; hpMax: number;
  mp: number; mpMax: number;
  gold: number;
  corruption: number;        // 0..6 (D-017)
  inventory: ItemInstance[];
  equipment: { weapon: ItemInstance | null; armor: ItemInstance | null; trinket1: ItemInstance | null; trinket2: ItemInstance | null };
  abilitiesUnlocked: string[];
  apHalf: number;            // unspent ability points in half-points (1 AP = 2; DESIGN §5.1)
  statPoints: number;
  statuses: StatusInstance[];// out-of-combat Poison/Bleed/Curse and status_rested (DESIGN §4.5, §9.5)
  uses: Uses;                // att_second_wind, free inn rest, Remembered Steps, respec once per day …
  stance: Stance;            // the player's stance only affects companion AI defaults; stored here for UI
  passiveBonuses: Partial<Record<StatName | 'hpMax' | 'mpMax', number>>; // from quest-item passives (legacy Amulet +1 MAG etc.)
}

export interface CompanionRunState {
  id: string;
  recruited: boolean;
  loyalty: number;           // 0..100
  hp: number; hpMax: number;
  ko: boolean;               // knocked out this fight/day; recovers on rest
  dead: boolean;             // permadeath only where content says so (Brak at the Apex)
  stance: Stance;
  cooldowns: Record<string, number>; // auto abilities + signature, in the companion's turns; companions have no MP (D-066 #12)
  waitingAt: string | null;  // LocationId where a non-active companion waits (camps); null = travels with party but inactive
  arcFlags: Record<string, FlagValue>;
}

export interface CompanionsState {
  recruited: Record<string, CompanionRunState>;  // keyed by CompanionId; only recruited ones present
  activeId: string | null;
}

export interface LocationState {
  visited: boolean;
  visitCount: number;
  items: ItemInstance[];              // items currently lying here (initial from content on first entry + drops)
  itemsSpawned: boolean;              // content items have been instantiated
  encountersCleared: string[];        // encounter ids beaten with once=true, or respawn pending
  encounterClearedDay: Record<string, number>;   // for respawn: 'daily'
  eventsFired: string[];
  flags: Record<string, FlagValue>;
  unlockedExits: string[];            // LocationIds unlocked by `unlockExit`
  lockedExits: string[];              // LocationIds locked by `lockExit`
  scattered: string[];                // fixed non-boss encounters fled this loop (onFlee 'scatter', DESIGN §4.7)
  encounterHp: Record<string, Record<string, number>>; // fled boss/story-gate encounter → creatureId → HP, until dawn
}

export interface SpawnedEncounter { id: string; groups: { creatureId: string; count: number }[]; once: boolean; onFlee: 'scatter' | 'hold'; label?: string }

export interface WorldState {
  currentLocationId: string;
  previousLocationId: string | null;
  locationStates: Record<string, LocationState>;    // sparse: created on first touch
  discovered: string[];                              // LocationIds known this run (map)
  pendingEncounters: Record<string, SpawnedEncounter[]>; // from `spawn` effects, keyed by LocationId
  npcOverrides: Record<string, { location: string | null }>; // moved/hidden NPCs (Ilyra → portal)
  hordeActive: boolean;
  hordeDelay: number;
  infected: string[];                                // LocationIds (legacy horde spread)
  hordePending: Record<string, number>;
  hordeCause: 'tyrant' | 'expiry' | null;           // expiry Hordes start after a 3-move delay (DESIGN §10.2)
  heartstone: 'intact' | 'stabilized' | 'exploited' | 'destroyed';
  tyrant: 'waiting' | 'defeated' | 'spared' | 'communing';
  gather: Record<string, { day: number; taken: number }>;   // gathering nodes, 1–2 per day (DESIGN §8.2)
  weather?: string;                                  // free-form, content-driven flavor
}

export type QuestStatus = 'inactive' | 'active' | 'completed' | 'failed';
export interface QuestState { status: QuestStatus; stage: string; startedDay: number | null; endedDay: number | null; counters: Record<string, number>; objectivesDone: string[] }

export interface StatusInstance {
  statusId: string; stacks: number; duration: number; sourceUid: string | null;
  tick?: number;             // DoT/Regen amount computed at application from the source's stats (DESIGN §4.5)
  appliedOnOwnTurn: boolean; // skip this turn's decrement (D-066 #4)
  snapshotHp?: number;       // status_rewind
}

export interface Combatant {
  uid: string;                       // `c${nextUid}`
  kind: 'player' | 'companion' | 'enemy';
  refId: string;                     // classId / companionId / creatureId
  name: string;
  level: number;
  hp: number; hpMax: number;
  mp: number; mpMax: number;         // enemies and companions: 0/0 (companions use cooldowns)
  atk: number; sp: number;           // ATK = STR + weapon power; SP = MAG + spell power (DESIGN §3.2)
  armor: number; ward: number; agi: number;
  accuracy: number; evasion: number; crit: number; critMult: number;
  statuses: StatusInstance[];
  guarding: boolean;
  initiative: number;
  resistances: Partial<Record<DamageType, 'weak' | 'neutral' | 'resist' | 'immune'>>;
  phase: number;                     // boss phase index (0 = tyr_movement_1 …)
  pattern: { pointer: number; turnsTaken: number; firedOnce: string[]; phaseEnteredRound: number }; // DESIGN §4.2
  cooldowns: Record<string, number>; // companions' abilities; enemies' move cooldowns if a move declares one
  alive: boolean;
  fledOrGone: boolean;
  isAdd: boolean;                    // summoned by a phase
}

/** Generation = commitment (DESIGN §4.2): computed when the creature finishes its turn, never re-rolled. */
export interface Intent {
  moveId: string;
  targetUid: string | null;          // null for 'all' / 'self'
  projected: [number, number];       // full pipeline with variance bounds, not assuming Guard
  hidden: boolean;                   // "?" chip until the player's turn immediately preceding it
  text: string;                      // telegraph line (WORLD §6 move line)
  tags: string[];                    // effect tags: 'may Weaken', 'Shield', 'heals itself' …
}

/** Communion (DESIGN §4.11, D-054, D-066 #6). */
export interface CommunionState {
  movement: 1 | 2 | 3;
  resolve: number;                   // 0..8, starts at 1
  questionIndex: number;             // within the movement
  answered: string[];                // question ids answered (tyr_q_*)
  usedAnswers: string[];             // Echo/item/answer ids already used this encounter
  lies: number;                      // two lies → rejection
  listened: boolean; supportUsed: boolean;   // once per movement
  clockBonusGranted: boolean;        // +8 watches at Resolve ≥ 4, once per loop
}

export type CombatPhase = 'start' | 'playerTurn' | 'companionTurn' | 'enemyTurn' | 'roundEnd' | 'victory' | 'defeat' | 'fled';

export interface CombatLogEntry { round: number; text: string; kind: 'info' | 'damage' | 'heal' | 'status' | 'intent' | 'phase' | 'system' }

export interface CombatState {
  encounterId: string;
  locationId: string;
  enemies: Combatant[];
  party: Combatant[];                // [player, companion?] — snapshots synced back to player/companion on exit
  turnOrder: string[];               // uids
  turnIndex: number;
  round: number;
  phase: CombatPhase;
  intents: Record<string, Intent>;   // by enemy uid, for the *next* enemy action
  log: CombatLogEntry[];             // capped at 200 entries
  cooldowns: Record<string, number>; // player ability id → turns remaining
  canFlee: boolean;                  // false for bosses and story gates only (D-066 #11)
  onFlee: 'scatter' | 'hold' | 'previous';   // fixed group / boss-gate / wandering (DESIGN §4.7)
  fleeAttempts: number;
  communion: CommunionState | null;
  resourceGainedThisTurn: number;
  onVictory: unknown[];              // Effect[] copied from the encounter (typed as Effect in effects.ts)
  onDefeat: unknown[];
  onFlee: unknown[];
  pendingSelection: { abilityId?: string; itemUid?: string } | null;  // UI-only hint: awaiting target pick
}

export interface DialogueState {
  sceneId: string;
  nodeId: string;
  npcId: string | null;
  visitedNodes: string[];
  choicesTaken: string[];            // choice ids taken this scene (for once=true choices)
  returnMode: 'explore' | 'combat' | 'threshold';
}

export interface MerchantState { stock: ItemInstance[]; lastRestockDay: number; purchasesThisLoop: number }

export interface RunCounters {
  kills: Record<string, number>;
  seen: Record<string, number>;
  damageDealt: number; damageTaken: number;
  damageBySource: Record<string, number>;           // 'basic' | abilityId | 'companion:<id>' | 'status:<id>' | 'item:<id>'
  abilitiesUsed: Record<string, number>;
  itemsCrafted: number; itemsUpgraded: number;
  goldEarned: number; goldSpent: number;
  fights: number; fightsWon: number; fled: number; rests: number; travels: number;
  questsCompleted: number; questsFailed: number;
  echoesGainedThisLoop: number;
  deathsThisLoop: number;                           // 0/1; Loop 1 game over is recorded as a closer
  custom: Record<string, number>;                   // content `counter` effects
}

export interface LogEntry { step: number; text: string; kind: 'narration' | 'event' | 'system' | 'dialogue' | 'combat' }

export interface EndingPending {
  outcome: 'closer_escape' | 'closer_fall' | `ending_${string}`;
  reason?: 'death' | 'expiry' | 'rejected';   // closer_fall only (D-066 #7)
  slideIndex: number;
}

export interface GameState {
  meta: GameMeta;
  clock: ClockState;
  before: BeforeState | null;
  player: PlayerState;
  companions: CompanionsState;
  world: WorldState;
  quests: Record<string, QuestState>;              // sparse; absent = inactive & never started
  flags: Record<string, FlagValue>;
  reputation: Record<FactionId, number>;            // −100..100 (D-014)
  echoesThisLoop: string[];                        // Echo ids granted this loop (also written to profile)
  combat: CombatState | null;
  dialogue: DialogueState | null;
  merchants: Record<string, MerchantState>;
  rng: RngState;
  counters: RunCounters;
  pendingEnding: EndingPending | null;
  mode: Mode;
  recentLog: LogEntry[];                           // last 100 narration/system lines; UI log beyond this comes from events
  threshold: { visited: ('still_shore' | 'gallery' | 'loom' | 'far_light')[]; spentThisVisit: number; pendingClassId: string | null } | null;
}
```

Derived values (never stored outside combat snapshots): ATK, SP, armor, ward, accuracy, evasion, crit, max HP/MP, resource per turn, reputation *tier*, day/watch and dawns left. They are computed by pure selectors in `src/engine/derived.ts` (formulas: DESIGN §3.2) and `src/engine/reducers/loop.ts` (`selectors.ts` re-exports them for UI/sim). Combat snapshots them into `Combatant` at combat start and recomputes on equipment/status change. Storing only primary values keeps saves small and migrations simple.

### 4.3 `Profile` (`src/engine/types/profile.ts`)

```ts
export interface Settings {
  textScale: 1 | 1.25 | 1.5;
  highContrast: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  volumes: { master: number; ambient: number; sfx: number; music: number };   // 0..1
  muted: boolean;
  autosave: boolean;
  showIntentNumbers: boolean;       // show exact telegraphed damage
  confirmFlee: boolean;
  logLength: 50 | 100 | 200;
}

export interface RunRecord {
  runId: string; seed: string; loop: number; classId: string;
  outcome: string;                  // EndingId (`ending_*`) or `closer_escape` / `closer_fall`
  reason?: 'death' | 'expiry' | 'rejected';
  daysUsed: number; level: number; echoesGained: string[]; questsCompleted: string[];
  tyrant: 'defeated' | 'spared' | 'untouched'; heartstone: string; modifiers: string[];
  summary: string;                  // one-line Threshold text
}

export interface Profile {
  version: number;
  profileId: string;                // set by the shell from meta.nextUid-like counter persisted in profile; not a clock
  echoes: string[];
  codexUnlocked: string[];
  bestiary: Record<string, { seen: number; killed: number; spared: number; revealed: 'none' | 'resist' | 'pattern' | 'all'; intentsSeen: string[] }>;
  achievements: Record<string, { loop: number; day: number; runId: string }>;
  resonance: number;
  resonanceEarnedTotal: number;
  attunements: { owned: string[]; equipped: string[] };   // equip cap 5 (DESIGN §10.7, D-011); no ranks
  classMastery: Record<string, { loopsPlayed: number; mastered: string[]; endings: string[]; bestLevel: number; bestDays: number | null }>;
  runHistory: RunRecord[];                 // capped at 200
  settings: Settings;
  modifiers: Record<string, boolean>;      // toggles for the *next* loop (D-021)
  mapKnowledge: string[];                  // LocationIds ever discovered (greyed "remembered" nodes, D-011)
  discoveries: string[];                   // first-time discovery keys that already paid Resonance ('loc:x', 'kill:y', 'item:z', 'echo:e', 'quest:q')
  endingsReached: string[];
  loopCounter: number;                     // endLoop sets max(profile, run) + 1 (DESIGN §10.3)
  newGamePlus: number;                     // how many NG+ starts
  lastClassId: string | null;
}
```

### 4.4 `Action` union (`src/engine/types/actions.ts`)

Every player input is an `Action`. Actions carry *ids*, never indices, so a recorded trace stays valid when the UI reorders lists.

```ts
export type Action =
  // meta / shell-facing
  | { type: 'newGame'; name: string; classId: string; seed?: string }
  | { type: 'chooseClass'; classId: string }              // title (before first explore) and Threshold Far Light
  | { type: 'save'; slot: 1 | 2 | 3 | 'auto' }            // engine emits saveRequested; shell performs IO
  | { type: 'load'; save: unknown }                       // parsed SaveFile supplied by shell; engine validates+migrates
  | { type: 'returnToTitle' }
  // explore
  | { type: 'move'; to: string }                          // adjacent LocationId (UI maps arrow keys via exit.dir)
  | { type: 'examine'; target: { kind: 'item'; uid: string } | { kind: 'npc'; id: string } | { kind: 'exit'; to: string } | { kind: 'location' } }
  | { type: 'take'; uid: string }
  | { type: 'takeAll' }
  | { type: 'rest'; kind: 'short' | 'full' }             // short = 1 watch +30 % HP/MP; full = to next dawn (DESIGN §2.1, §10.1)
  | { type: 'retreat' }                                   // back along the arrival edge, 1 watch, no encounter roll (DESIGN §4.7)
  | { type: 'gather' }                                    // gathering node at this location, 1–2 per day (DESIGN §8.2)
  | { type: 'talk'; npcId: string }
  | { type: 'enterPortal' }                               // Library portal during a Horde → closer_escape
  | { type: 'interact'; eventId: string }                 // content-defined interactable (altar, Heartstone, anchor)
  | { type: 'wait' }                                      // advance one watch in place (only where location.rest or tags has 'waitable')
  // inventory / character
  | { type: 'use'; uid: string; targetUid?: string }
  | { type: 'equip'; uid: string; slot?: EquipSlot }
  | { type: 'unequip'; slot: EquipSlot }
  | { type: 'drop'; uid: string; qty?: number }
  | { type: 'allocateStat'; stat: StatName }
  | { type: 'unlockAbility'; abilityId: string }
  | { type: 'readBook'; uid: string }                     // Dark Spellbooks: corruption + unlocks (D-017)
  | { type: 'respec' }                                    // AP refund at a camp fire, 50 × level gold, once per day (DESIGN §6.3)
  // economy / crafting
  | { type: 'buy'; merchantId: string; uid: string; qty?: number }
  | { type: 'sell'; merchantId: string; uid: string; qty?: number }
  | { type: 'craft'; recipeId: string }
  | { type: 'upgrade'; uid: string }                     // rarity tier-up (DESIGN §8.3)
  | { type: 'salvage'; uid: string }                     // DESIGN §8.4
  // dialogue
  | { type: 'choose'; choiceId: string }
  | { type: 'continue' }                                  // advance a node that has no choices
  | { type: 'acceptQuest'; questId: string }              // used by UI "Accept" buttons when a scene offers a quest without a choice node
  // combat
  | { type: 'attack'; targetUid: string }
  | { type: 'ability'; abilityId: string; targetUid?: string }
  | { type: 'guard' }
  | { type: 'item'; uid: string; targetUid?: string }
  | { type: 'flee' }
  | { type: 'companionCommand'; command: 'signature' | 'focus' | 'hold'; targetUid?: string }
  | { type: 'setStance'; stance: Stance }
  | { type: 'commune'; act: 'toggle' | 'speak' | 'listen' | 'offer' | 'resist'; answerId?: string; itemId?: string } // DESIGN §4.11
  | { type: 'swapCompanion'; companionId: string | null } // at rest locations only
  // loop / threshold
  | { type: 'acknowledgeEnding' }                         // advance ending slides; last slide → threshold or title
  | { type: 'thresholdGo'; to: 'still_shore' | 'gallery' | 'loom' | 'far_light' }
  | { type: 'thresholdSpend'; attunementId: string }     // buy (owned forever)
  | { type: 'thresholdRefund'; attunementId: string }     // only within the same visit (spentThisVisit)
  | { type: 'equipAttunement'; attunementId: string; on: boolean }   // cap 5 equipped (DESIGN §10.7)
  | { type: 'toggleModifier'; modifierId: string }
  | { type: 'newLoop' }                                   // Far Light → Day 1
  | { type: 'newGamePlus' };                              // from ending screen after a true ending (D-021)
```

### 4.5 `GameEvent` union (`src/engine/types/events.ts`)

Events are the engine's only channel to UI, audio and logs. They are *descriptive* (what happened), never *imperative* (no "play sound X"). The audio map (6.5) and log formatter translate them. Every event has `t: string` (type) so UI switch statements are exhaustive.

```ts
export type GameEvent =
  | { t: 'actionRejected'; action: Action; reason: string }
  | { t: 'log'; text: string; kind: LogEntry['kind'] }
  | { t: 'modeChanged'; from: Mode; to: Mode }
  // world & time
  | { t: 'locationEntered'; locationId: string; firstVisit: boolean; regionId: string }
  | { t: 'locationDiscovered'; locationId: string }
  | { t: 'watchAdvanced'; day: number; watch: Watch }
  | { t: 'dayAdvanced'; day: number; daysLeft: number }
  | { t: 'clockWarning'; daysLeft: number }               // emitted at 10, 5, 2, 1 dawns left (DESIGN §10.1)
  | { t: 'clockChanged'; deltaWatches: number; limitTicks: number; floored: boolean }
  | { t: 'clockExpired' }
  | { t: 'beforeDayAdvanced'; day: 1 | 2 | 3; resets: number } | { t: 'beforeReset'; resets: number }
  | { t: 'rested'; locationId: string; hpRestored: number; mpRestored: number }
  | { t: 'eventFired'; locationId: string; eventId: string; text: string }
  | { t: 'exitUnlocked'; from: string; to: string }
  | { t: 'hordeStarted'; cause: 'tyrant' | 'expiry'; delay: number } | { t: 'hordeSpread'; infected: string[] }
  | { t: 'encounterScattered'; locationId: string; encounterId: string }
  | { t: 'npcMoved'; npcId: string; to: string | null }
  // items & economy
  | { t: 'itemTaken'; item: ItemInstance } | { t: 'itemGiven'; item: ItemInstance; source: string }
  | { t: 'itemLost'; itemId: string; qty: number; reason: 'used' | 'sold' | 'dropped' | 'taken' | 'crafted' }
  | { t: 'itemEquipped'; slot: EquipSlot; item: ItemInstance } | { t: 'itemUnequipped'; slot: EquipSlot }
  | { t: 'goldChanged'; delta: number; total: number }
  | { t: 'purchased'; itemId: string; price: number } | { t: 'sold'; itemId: string; price: number }
  | { t: 'crafted'; recipeId: string; item: ItemInstance } | { t: 'upgraded'; item: ItemInstance }
  | { t: 'merchantRestocked'; merchantId: string }
  // character
  | { t: 'xpGained'; amount: number } | { t: 'levelUp'; level: number; statPoints: number; apHalf: number }
  | { t: 'statAllocated'; stat: StatName; value: number }
  | { t: 'abilityUnlocked'; abilityId: string }
  | { t: 'corruptionChanged'; value: number; delta: number }
  | { t: 'reputationChanged'; faction: FactionId; delta: number; value: number; tierBefore: string; tierAfter: string }
  // companions
  | { t: 'companionRecruited'; companionId: string } | { t: 'companionDismissed'; companionId: string }
  | { t: 'companionSwapped'; activeId: string | null }
  | { t: 'loyaltyChanged'; companionId: string; delta: number; value: number }
  | { t: 'companionKo'; companionId: string } | { t: 'companionDied'; companionId: string }
  // combat
  | { t: 'combatStarted'; encounterId: string; enemies: { uid: string; creatureId: string }[]; ambush: boolean }
  | { t: 'turnStarted'; uid: string; round: number }
  | { t: 'intentRevealed'; uid: string; intent: Intent }
  | { t: 'attackResolved'; sourceUid: string; targetUid: string; hit: boolean; crit: boolean }
  | { t: 'damageDealt'; sourceUid: string; targetUid: string; amount: number; damageType: DamageType; mitigated: number; absorbed: number; kind: 'basic' | 'ability' | 'status' | 'item' | 'intent'; refId: string | null }
  | { t: 'healed'; targetUid: string; amount: number; source: string }
  | { t: 'statusApplied'; targetUid: string; statusId: string; stacks: number; duration: number }
  | { t: 'statusExpired'; targetUid: string; statusId: string } | { t: 'statusTicked'; targetUid: string; statusId: string; amount: number }
  | { t: 'interplay'; rule: string; targetUid: string }   // 'storm_on_soaked', 'fire_on_soaked', 'chrono_on_haste', 'void_on_shield'
  | { t: 'guarded'; uid: string } | { t: 'resourceGained'; uid: string; amount: number; reason: string }
  | { t: 'abilityUsed'; uid: string; abilityId: string }
  | { t: 'fleeAttempt'; success: boolean; chance: number }
  | { t: 'combatantDefeated'; uid: string; refId: string } | { t: 'bossPhase'; uid: string; phase: number; text: string }
  | { t: 'addsSummoned'; uids: string[] }
  | { t: 'resolveChanged'; delta: number; value: number; movement: 1 | 2 | 3; reason: string }
  | { t: 'movementEnded'; movement: 1 | 2 | 3; resolve: number } | { t: 'communionRejected'; reason: 'resolve' | 'lies' }
  | { t: 'combatEnded'; result: 'victory' | 'defeat' | 'fled'; rounds: number; xp: number; gold: number; loot: ItemInstance[] }
  | { t: 'playerDied'; loop: number }
  // dialogue & quests
  | { t: 'dialogueStarted'; sceneId: string; npcId: string | null } | { t: 'dialogueNode'; nodeId: string; speaker: string; text: string }
  | { t: 'dialogueEnded'; sceneId: string }
  | { t: 'questStarted'; questId: string } | { t: 'questAdvanced'; questId: string; stage: string; journal: string }
  | { t: 'questObjective'; questId: string; objectiveId: string; done: boolean }
  | { t: 'questCompleted'; questId: string } | { t: 'questFailed'; questId: string }
  | { t: 'heartstoneResolved'; outcome: WorldState['heartstone'] }
  | { t: 'tyrantResolved'; outcome: WorldState['tyrant'] }
  // persistence layer (profile)
  | { t: 'echoGained'; echoId: string; firstEver: boolean } | { t: 'codexUnlocked'; codexId: string }
  | { t: 'bestiaryUpdated'; creatureId: string; field: 'seen' | 'killed' | 'intent' | 'weakness' }
  | { t: 'achievementUnlocked'; achievementId: string } | { t: 'resonanceGained'; amount: number; reason: string; total: number }
  | { t: 'attunementBought'; attunementId: string } | { t: 'attunementEquipped'; attunementId: string; on: boolean }
  | { t: 'modifierToggled'; modifierId: string; on: boolean }
  // loop
  | { t: 'portalEntered' } | { t: 'loopEnded'; loop: number; outcome: EndingPending['outcome']; reason?: EndingPending['reason']; record: RunRecord }
  | { t: 'endingReached'; endingId: string } | { t: 'endingSlide'; endingId: string; index: number; text: string }
  | { t: 'loopStarted'; loop: number; classId: string }
  | { t: 'thresholdEntered'; area: NonNullable<GameState['threshold']>['visited'][number] }
  // shell requests
  | { t: 'saveRequested'; slot: 1 | 2 | 3 | 'auto' } | { t: 'saveLoaded'; version: number; migratedFrom: number | null }
  | { t: 'autosaveCheckpoint'; reason: 'locationEntered' | 'combatEnded' | 'dayAdvanced' | 'questCompleted' | 'rest' };
```

### 4.6 `step` — the only transition (`src/engine/step.ts`)

```ts
import type { ContentPack } from '@schema/contentPack';

export interface StepResult { state: GameState; profile: Profile; events: GameEvent[] }

export interface StepCtx {
  s: GameState;                                         // a structuredClone of the input state: mutate freely
  profileDraft(): Profile;                              // lazily clones the input profile on first call (D-065)
  content: ContentPack;
  rng: Rng;
  events: GameEvent[];
  log(text: string, kind?: LogEntry['kind']): void;   // pushes to s.recentLog (capped) and events
  reject(reason: string): never;                        // throws RejectSignal, caught by step → actionRejected
  uid(prefix: string): string;                          // `${prefix}${s.meta.nextUid++}`
}

/**
 * Pure: same (state, action, content, profile) → same result. Never mutates inputs.
 * Illegal actions return the *same* state/profile references and one `actionRejected` event (D-043).
 */
export function step(state: GameState, action: Action, content: ContentPack, profile: Profile): StepResult {
  const events: GameEvent[] = [];
  const s = structuredClone(state);
  let p: Profile | null = null;                         // cloned only if a reducer touches the profile
  const rng = new Rng(s.rng);
  const ctx = makeCtx(s, () => (p ??= structuredClone(profile)), content, rng, events);
  try {
    dispatch(ctx, action);                              // switch (action.type) → reducers/*.ts
    runPostStepHooks(ctx);                              // quest objective sweep, achievements('step'), clock warnings, mode transitions
    s.rng = rng.state();
    s.meta.stepCount += 1;
  } catch (e) {
    if (e instanceof RejectSignal) return { state, profile, events: [{ t: 'actionRejected', action, reason: e.reason }] };
    throw e;                                            // programmer error: surface loudly
  }
  const out = { state: s, profile: p ?? profile, events };
  if (__DEV__) deepFreeze(out);                         // dev/test only: a reducer that mutates its input fails at once
  return out;
}
```

`structuredClone` replaces immer (D-065 supersedes D-042): the whole `GameState` is JSON-shaped (4.2), so a full clone per step is exact and simple. There is no `configureEngine`/`autoFreeze`; batch sims run with `__DEV__ = false` (no freeze). The per-step budget is re-measured in 7.4 (expected 150–300 µs with the clone, against immer's planned 60 µs; 2,000 runs on 8 workers still finish in ≤ 10 min). If the clone ever dominates, reducers may switch to cloning sub-trees on write, behind the same `step` signature.

Rules for reducers:

1. A reducer receives `ctx` and the narrowed action; it mutates `ctx.s` (and `ctx.profileDraft()` when it writes profile data) and pushes events via helpers in `events.ts` (`emit(ctx, ev)`). It must call `ctx.reject(reason)` before any mutation if the action is illegal, and it must agree with `legalActions` (tested in 8.1).
2. Every random draw goes through `ctx.rng`. No reducer constructs an `Rng`.
3. Quest objectives are not checked inside reducers; `runPostStepHooks` sweeps active quests once per step (cheap: ≤ 44 quests × few objectives) and applies stage transitions, so content never depends on which action advanced a quest.
4. Mode transitions are centralized: reducers set `s.mode` only through `enterMode(ctx, mode)` which emits `modeChanged` and validates the transition table (title→explore, explore↔combat, explore↔dialogue, combat→dialogue (boss talk), explore→ending, combat→ending, ending→threshold|explore|title, threshold→explore, threshold↔dialogue (Dask)).
5. Loop end (`endLoop(outcome, reason?)`, DESIGN §10.3) writes the `RunRecord` to the profile, grants Resonance (first-time discoveries, +10 per closer, D-055), moves `echoesThisLoop` into `profile.echoes`, keeps the Amulet (D-047), sets `profile.loopCounter = max(profile.loopCounter, run loop) + 1`, and sets `pendingEnding`. On the last `acknowledgeEnding`: **Loop 1 → `newRun` straight into Loop 2 Day 1 (`mode: 'explore'`, no Threshold, D-049)**; Loop 2+ → the Threshold (`mode: 'threshold'`). The FALLEN game-over of a Loop 1 non-Horde death is not a loop end: the profile keeps what it gained and the shell returns to the title (D-049).

### 4.7 `legalActions` (`src/engine/legalActions.ts`)

```ts
/**
 * Enumerates every action `step` would accept from this state. Required by bots (policy domain) and by the UI
 * (button enabling / hotkey maps). Must be complete and exact: tests assert that (a) every listed action is accepted,
 * (b) a corpus of generated non-listed actions is rejected. Shell actions `save`/`load`/`newGame` are listed only
 * where the mode allows them (save: explore/threshold; load/newGame: title; returnToTitle: ending/threshold/explore).
 * Parameterized actions are enumerated over concrete ids (every exit, item uid, choice id, affordable ability × target).
 * The list is deterministic in order (stable sort by type then id) so bots that pick "first" are reproducible.
 */
export function legalActions(state: GameState, content: ContentPack, profile: Profile): Action[];

/** Cheap predicate used by the UI for a single button; delegates to the same rules as legalActions. */
export function isLegal(state: GameState, action: Action, content: ContentPack, profile: Profile): boolean;
```

Enumeration limits (so bots and tests stay fast): `drop`/`sell` enumerate one action per distinct `itemId` (not per uid); `examine` enumerates only when the UI asks (`legalActions(..., { includeExamine: true })`); `allocateStat`/`unlockAbility` are listed only when points are available; combat `ability` actions are listed only if affordable and off cooldown, with one entry per valid target.

### 4.8 `ContentPack` (`src/content/schema/contentPack.ts`)

```ts
export interface ContentPack {
  version: string;                                        // content semver, embedded in saves for diagnostics
  regions: Record<string, Region>;
  locations: Record<string, Location>;
  creatures: Record<string, Creature>;
  items: Record<string, Item>;
  recipes: Record<string, Recipe>;
  abilities: Record<string, Ability>;
  classes: Record<string, ClassDef>;
  statuses: Record<string, StatusDef>;
  quests: Record<string, Quest>;
  dialogues: Record<string, DialogueScene>;
  npcs: Record<string, Npc>;
  companions: Record<string, Companion>;
  echoes: Record<string, Echo>;
  codex: Record<string, CodexEntry>;
  achievements: Record<string, Achievement>;
  attunements: Record<string, Attunement>;
  modifiers: Record<string, Modifier>;
  endings: Record<string, Ending>;
  merchants: Record<string, Merchant>;                     // keyed by NPC id (WORLD §9)
  affixes: Record<string, Affix>;
  encounters: Record<string, Encounter>;                   // fixed, wandering-pool and anomaly encounters (WORLD §10)
  factions: Record<FactionId, Faction>;
  config: GameConfig;                                      // tunables (5.16)
  index: ContentIndex;                                     // derived, built by buildContentPack()
}

export interface ContentIndex {
  exitsFrom: Record<string, Location['exits']>;
  locationsByRegion: Record<string, string[]>;
  scenesByNpc: Record<string, string[]>;                   // sorted by priority desc
  questsByGiver: Record<string, string[]>;
  abilitiesByClass: Record<string, string[]>;
  recipesByStation: Record<string, string[]>;
  creatureIds: string[]; itemIds: string[]; questIds: string[]; locationIds: string[]; endingIds: string[];
  startLocationId: string;                                 // config.startLocationId ('loc_whispering_ruins')
}
```

`buildContentPack()` in `src/content/index.ts` parses every table with its zod schema (applying defaults), builds the index, runs `validateContent()` and throws on errors (dev) or returns `{ pack, report }` for tools. The engine never sees unparsed input types.

### 4.9 Conditions and Effects — zod schemas, types, evaluator, applier

D-033 as revised by D-066 #16: **one canonical set**, identical to DESIGN §13.3's table (DESIGN owns the shapes; this section implements them). Object forms are used wherever an atom has more than one field. Every id is a full D-044 id. Unknown keys fail validation (`.strict()`), so typos in content are caught. Literal schema discriminators that are not ids are camelCase (`statusOnHit`, not `status_on_hit`; REVIEW-CROSS C-58).

```ts
// src/content/schema/condition.ts
import { z } from 'zod';
import { PId, ItemId, ClassId, CompanionId, QuestStatus, RangeSchema, StatName, FactionId } from './primitives';

export type Condition =
  | { all: Condition[] } | { any: Condition[] } | { not: Condition }
  | { flag: `flag_${string}` }
  | { echo: `echo_${string}` }
  | { quest: { id: `q_${string}`; stage?: string; status?: 'inactive' | 'active' | 'completed' | 'failed' } }
  | { item: { id: string; count?: number } }                       // inventory + satchel + equipped
  | { rep: { faction: FactionId; min?: number; max?: number } }
  | { loop: Range } | { day: Range } | { level: Range }
  | { watch: 'dawn' | 'day' | 'dusk' | 'night' }
  | { clock: { daysLeft: Range } }                                 // dawns before the limit (ending E: { max: 1 })
  | { beforeDay: 1 | 2 | 3 } | { beforeResets: Range }             // Silverwood Before (DESIGN §10.1)
  | { class: 'ranger' | 'wizard' | 'elf' | 'ironclad_warden' | 'shadow_weaver' }
  | { stat: { name: StatName; min?: number; max?: number } }       // primaries only (D-044)
  | { companion: { id: string; state?: 'active' | 'recruited' | 'ko' } }   // default 'active'
  | { loyalty: { companion: string; min?: number; max?: number } }
  | { corruption: Range }
  | { location: `loc_${string}` }
  | { killed: { id: `cr_${string}`; count?: number; sinceStage?: boolean } }
  | { counter: { name: string; min?: number; max?: number } }      // engine: quests_completed, factions_trusted
  | { resolve: Range }                                             // communion only
  | { modifier: `mod_${string}` };

export type Range = { min?: number; max?: number };
export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionSchema) }).strict(),
    z.object({ any: z.array(ConditionSchema) }).strict(),
    z.object({ not: ConditionSchema }).strict(),
    z.object({ flag: PId('flag_') }).strict(),
    z.object({ echo: PId('echo_') }).strict(),
    z.object({ quest: z.object({ id: PId('q_'), stage: z.string().optional(), status: QuestStatus.optional() }).strict() }).strict(),
    z.object({ item: z.object({ id: ItemId, count: z.number().int().min(1).optional() }).strict() }).strict(),
    z.object({ rep: z.object({ faction: FactionId, min: z.number().optional(), max: z.number().optional() }).strict() }).strict(),
    z.object({ loop: RangeSchema }).strict(), z.object({ day: RangeSchema }).strict(), z.object({ level: RangeSchema }).strict(),
    z.object({ watch: z.enum(['dawn', 'day', 'dusk', 'night']) }).strict(),
    z.object({ clock: z.object({ daysLeft: RangeSchema }).strict() }).strict(),
    z.object({ beforeDay: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).strict(),
    z.object({ beforeResets: RangeSchema }).strict(),
    z.object({ class: ClassId }).strict(),
    z.object({ stat: z.object({ name: StatName, min: z.number().optional(), max: z.number().optional() }).strict() }).strict(),
    z.object({ companion: z.object({ id: CompanionId, state: z.enum(['active', 'recruited', 'ko']).optional() }).strict() }).strict(),
    z.object({ loyalty: z.object({ companion: CompanionId, min: z.number().optional(), max: z.number().optional() }).strict() }).strict(),
    z.object({ corruption: RangeSchema }).strict(),
    z.object({ location: PId('loc_') }).strict(),
    z.object({ killed: z.object({ id: PId('cr_'), count: z.number().int().min(1).optional(), sinceStage: z.boolean().optional() }).strict() }).strict(),
    z.object({ counter: z.object({ name: z.string(), min: z.number().optional(), max: z.number().optional() }).strict() }).strict(),
    z.object({ resolve: RangeSchema }).strict(),
    z.object({ modifier: PId('mod_') }).strict(),
  ]),
);
```

```ts
// src/content/schema/effect.ts
export type Effect =
  | { setFlag: `flag_${string}` } | { clearFlag: `flag_${string}` }
  | { grantEcho: `echo_${string}` }
  | { questStart: `q_${string}` } | { questAdvance: { quest: `q_${string}`; stage: string } } | { questFail: `q_${string}` }
  | { giveItem: { item: string; count?: number; rarity?: Rarity } } | { takeItem: { item: string; count?: number } }
  | { rep: { faction: FactionId; delta: number } } | { loyalty: { companion: string; delta: number } }
  | { gold: number } | { xp: number } | { resonance: number }
  | { heal: { hp?: number | 'full'; mp?: number | 'full' } } | { damage: { hp: number } } | { corruption: number }
  | { clockWatches: number }            // moves the Breach Clock LIMIT by n watches (−10 days = −40), floored (DESIGN §10.1)
  | { passWatches: number }             // time passes (an event's timeCost)
  | { spawn: { creature: `cr_${string}`; location?: `loc_${string}` } }
  | { teleport: `loc_${string}` }
  | { unlockExit: { from: `loc_${string}`; to: `loc_${string}` } }
  | { scatter: { location: `loc_${string}` } }                     // DESIGN §4.7
  | { recruit: string } | { dismiss: string }                      // plain companion ids
  | { startCombat: string } | { startDialogue: string }            // encounter id / dialogue id
  | { endLoop: { closer: 'closer_escape' | 'closer_fall'; reason?: 'death' | 'expiry' | 'rejected' } }
  | { ending: `ending_${string}` }
  | { unlockRecipe: `recipe_${string}` } | { unlockCodex: `codex_${string}` }
  | { counter: { name: string; delta: number } }
  | { resolve: number };                // communion only; clamped 0–8

export const EffectSchema: z.ZodType<Effect> = z.lazy(() => z.union([ /* one strict object per variant, same pattern as ConditionSchema */ ]));
export const Effects = z.array(EffectSchema).default([]);
```

The previous draft's extra atoms (`visited`, `gold`, `eventFired`, `exitUnlocked`, `equipped`, `ability`, `attunement`, `endingReached`, `hordeActive`, `heartstone`, `tyrant`, `hpPct`, `locationFlag`, `codex`, `achievement`, `always`/`never`; effects `questComplete`, `lockExit`, `applyStatus`, `setLocationFlag`, `npc`, `reveal`, `horde`, `heartstone`, `tyrant`, `restock`, `swapCompanion`, `log`, `if`, `random`, `learnAbility`, `abilityPoints`, `statPoints`, `stat`, `achievement`) are **withdrawn**: they are either flags/counters by another name or engine behaviour. A content unit that needs a new atom proposes it as a DESIGN §13.3 change first (lead ruling), then adds it here.

```ts
// src/engine/conditions.ts
/** Pure, side-effect free, no rng. Reads state + profile + content (for rep tiers, item lookups). */
export function evaluate(cond: Condition, state: GameState, profile: Profile, content: ContentPack): boolean;
/** For UI "why can't I" tooltips and the Threshold eligibility panel. */
export function explain(cond: Condition, state: GameState, profile: Profile, content: ContentPack): { ok: boolean; parts: { text: string; ok: boolean }[] };

// src/engine/effects.ts
/** Applies effects in order. May call into reducers (startCombat, startDialogue, endLoop). */
export function apply(effect: Effect, ctx: StepCtx): void;
export function applyAll(effects: readonly Effect[], ctx: StepCtx): void;
```

Semantics the evaluator must honour: `{ item }` counts inventory, satchel **and equipped**; `{ killed }` reads `counters.kills` (this loop), and with `sinceStage` only kills after the quest's current stage began; `{ quest: { id } }` with neither `stage` nor `status` means *active or completed*; `{ loop: { min: 2 } }` is the standard Loop 2+ gate; `{ clock: { daysLeft } }` = `floor((limitTicks − ticks) / 4)`; `{ counter: { name: 'quests_completed' } }` and `'factions_trusted'` are maintained by the engine (D-048, D-018); `{ resolve }` is false outside communion. The **Apex gate** is D-048's data form exactly: `{ any: [{ counter: { name: 'quests_completed', min: 6 } }, { echo: 'echo_apex_resonance' }] }`.

### 4.10 Combat — implement DESIGN exactly

PLAN's earlier formula list is withdrawn (D-066 #15, REVIEW-DESIGN-PLAN F17). The combat units implement **DESIGN §3.2 (derived values), §4.1–4.8 (turns, intents, pipeline, types, statuses, interplay, Guard/flee/death, targeting), §5.1 (ability rules, half-point AP, self-costs), §5.2–5.7 (class resources and abilities) and §6.1–6.4 (XP, sources, points, mastery)** with the numbers written there; tunables live in `GameConfig` (5.16) with DESIGN's values as defaults, and only BALANCE units change them, by a DESIGN edit first. Engine-shape notes that DESIGN leaves to engineering:

- **Rolls.** Every percentage is one `rng.int(0, 99) < chance` draw; variance is one `rng.next()` mapped to `[0.90, 1.10]`; draw order per hit is fixed (hit → variance → crit → status chances in listed order) and documented in `damage.ts` so replays stay stable.
- **Pipeline.** `damage.ts` exposes `resolveHit(ctx, attacker, target, spec) → HitResult` with every intermediate step recorded (`steps: { name, value }[]`) for the expandable combat log (DESIGN §16.5). DoT ticks use `resolveTick` (resistance step only, no armor/ward/Guard/variance/crit; Poison ignores resistance).
- **Intents.** `intents.ts` walks the creature's `pattern` with a persistent pointer (`Combatant.pattern`), evaluates `CombatWhen` at generation, skips steps whose `when` is false, honours `oncePerFight`/`everyNth`/`first`/`allyPresent`, and stores the committed `Intent` (4.2). Weighted steps draw one `rng` value at generation. Stun cancels and advances; interrupt/Stagger cancels and advances; Taunt retargets at generation and execution.
- **Phases.** `phases.ts` evaluates each phase's `enterWhen` OR-list after every damage event and at round end; round triggers read `CombatState.round`; entering a phase resets the pointer, applies `onEnter`, spawns adds (`countSolo` when no companion), and never goes backwards. Boss Rewind is capped at 10 % max HP; Void or Ley damage removes Rewind.
- **Status timing.** `StatusInstance.appliedOnOwnTurn` makes the end-of-turn decrement skip once (D-066 #4).
- **Self-costs.** `legalActions` omits an ability whose total HP cost ≥ current HP; the UI shows "Not enough blood" from `explain()`.
- **Resources.** `ClassSchema.resource.rules` (5.7) drives generation (`basic_hit`, `crit`, `guard`, `hit_taken`, `dodge`, `taunt`, `turn_start`); Wizard `turn_start` amount = `3 + floor(level/4)`.
- **Companions.** No MP; `CompanionRunState.cooldowns` per ability (attack 0, debuff/aoe/utility/buff 2, heal/shield/cleanse 3; signature per content).
- **Flee.** DESIGN §4.7: `canFlee=false` only for bosses/story gates; success applies `onFlee` (`previous` → move back; `scatter` → +2 watches, no XP/loot, `LocationState.scattered`, party stays at the node; `hold` → encounter keeps `encounterHp` until dawn).
- **XP and levels.** DESIGN §6.1's table (D-056) is `GameConfig.xpToNext`; level-up applies class growth (DESIGN §3.3), +1 stat point, +2 half-AP, full HP/MP. Mastery halves costs in half-points (DESIGN §6.4).
- **Communion.** `communion.ts` implements DESIGN §4.11 over `CombatState.communion`; question ids and answer Echoes come from content (`CommunionSpec`, 5.4).

### 4.11 Loop and clock contract

DESIGN §10.1–10.3 is the specification; this is the engine shape.

- **Time.** `clock.ticks` advances by one per travel (an exit's `watches` may be 2, e.g. the Skyreach ascent) and by `passWatches` effects; a full rest moves to the next dawn tick; crossing a dawn emits `dayAdvanced`, restocks merchants (D-057), resets per-day `uses`, clears `encounterHp`, and ticks out-of-combat statuses per watch. `clockWarning` fires at 10/5/2/1 dawns before `limitTicks`.
- **Limit changes.** `clockWatches` effects change `limitTicks`, clamped to `≥ dayStartTick(ticks) + 12` (the floor) and recorded in `clock.modifiers`; `mod_frayed_clock` sets the base to 80 ticks and halves other modifiers toward zero.
- **Expiry.** When `ticks ≥ limitTicks`: `clock.expired = true`, `flag_clock_expired` is set, the Horde starts from `loc_temporal_breach_apex` with `hordeCause: 'expiry'` and a **3-move delay** (`hordeDelay = 3`), and the Library portal opens. If a fight is in progress, expiry is applied when it ends. There is no scripted Fall and no `fall_clock` (D-066 #7).
- **Silverwood Before.** On entering `region_silverwood_before`: `clock.frozen = true`, `before = { day: 1, resets }`; Before edges cost 0; a full rest at the Garret advances `before.day`; resting on Day 3 runs the Last Bell reset (unless `q_stop_the_ritual` is resolved): `resets += 1`, Before-local flags/ground items/encounters reset, Echoes/inventory/anchors persist. Leaving sets `before = null`, `frozen = false`.
- **Closers.** `enterPortal` is legal only when `world.hordeActive && currentLocationId === 'loc_shattered_library'` → `endLoop({ closer: 'closer_escape' })`. Death while `hordeActive` → `closer_fall` with reason `expiry` (expiry Horde) or `death` (Tyrant Horde). Death in Loop 2+ outside a Horde → `closer_fall`/`death`. Communion rejection + leave → `closer_fall`/`rejected`. Loop 1 death outside a Horde → FALLEN game-over (shell returns to title; the profile keeps Echoes/codex; D-049).
- **Next loop.** Loop 1 closers go **straight to Loop 2 Day 1** (no Threshold; D-049); Loop 2+ closers and endings go to the Threshold. `newLoop` = `newRun({ seed: `${profile.profileId}:${profile.loopCounter}`, classId, profile, content })`: applies equipped Attunements, modifiers, mastery, map memory (greyed), starts at `loc_whispering_ruins` Day 1 Dawn with the **Amulet of Echoes on the Wayfinder from Loop 2** (D-047).

### 4.12 Saves

```ts
export const SAVE_VERSION = 1;   // D-058: saves are disposable until the first full-screen integration checkpoint
export interface SaveFile { kind: 'run'; version: number; seed: string; contentVersion: string; profileLoopAtSave: number;
  savedStep: number; summary: SaveSummary; state: GameState }
export interface SaveSummary { classId: string; level: number; loop: number; day: number; watch: Watch; locationId: string; title: string; playtimeSteps: number }
export const SaveFileSchema: z.ZodType<SaveFile>;          // zod; `state` validated structurally (GameStateSchema in saves/saveFile.ts)
export function serialize(state: GameState, profile: Profile, content: ContentPack): SaveFile;
export function deserialize(json: unknown, content: ContentPack): { state: GameState; migratedFrom: number | null } | { error: string };
export const migrations: Record<number, (old: unknown) => unknown>;   // v→v+1, applied in order until SAVE_VERSION
export interface ProfileFile { kind: 'profile'; version: number; profile: Profile }
```

Storage keys follow DESIGN §14.1: `aethelgard.run.slot1|slot2|slot3`, `aethelgard.run.auto`, `aethelgard.profile`, plus `aethelgard.settings.mirror` (settings duplicated so a corrupt profile still restores accessibility settings) and the two-phase `.tmp`/`.bak` writes of DESIGN §14.4. Autosave at `autosaveCheckpoint` events when `settings.autosave`. Export = `Blob` download; import = file input → `deserialize` → `load` action. Loading a run whose `profileLoopAtSave` is older than `profile.loopCounter` is allowed; the next `endLoop` sets `loopCounter = max(profile, run) + 1` so the counter never rewinds. The state must round-trip: `deserialize(serialize(s)).state` deep-equals `s` (tested with sim snapshots).

### 4.13 `loadScenario(id)` — dev/e2e only (D-066 #18)

```ts
// src/sim/scenarios.ts — shared by the sim CLI, unit tests and e2e builds
export type ScenarioId = 'loop1_day1' | 'pre_tyrant_l11_ranger' | 'pre_tyrant_l13_ranger' | 'combat_tyrant_contained_p2'
  | 'loop2_day1' | 'loop2_end' | 'communion_movement_2' | 'ending_a_ready' | 'ending_b_ready' | 'before_day_3'
  | 'combat_bell_warden_p2' | 'expiry_minus_1';
export function loadScenario(id: ScenarioId, content: ContentPack, opts?: { classId?: string; level?: number }): { state: GameState; profile: Profile };
```

Each scenario is built from `makeState` builders keyed by **content ids** (location, quest stages, flags, Echoes, inventory, level), never from recorded action traces, so content edits do not break it; a unit test asserts every scenario passes `GameStateSchema` and has a non-empty `legalActions`. In `__E2E__` builds the shell reads `?scenario=<id>` (and `&class=`, `&level=`) and boots from it; `window.__aethelgard = { dispatch, state, scenario }` exists only in those builds. Recorded traces are kept only for the determinism-parity test on the fixture pack (7.4, 8.1).

---

## 5. Content schemas (zod)

All schemas live in `src/content/schema/*.ts`, one file per table, each exporting `XSchema`, `type X = z.output<typeof XSchema>` and `type XInput = z.input<typeof XSchema>`. Content files are authored as `export const locations = [ ... ] satisfies LocationInput[]` so authors get completion and errors in the editor while defaults stay in the schema. Every table entry has `id`, `tags: string[]` (free-form; the validator only warns on tags not in `docs/CONTENT.md`'s registry) and an optional `notes?: string` for author commentary that never reaches the UI.

### 5.1 Primitives (`primitives.ts`)

```ts
import { z } from 'zod';
export const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'lowercase snake_case id');
/** D-044 typed id: the prefix is part of the id. */
export const PId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}[a-z0-9_]+$`), `id with prefix ${prefix}`);
export const ItemId = z.string().regex(/^(item|mat)_[a-z0-9_]+$/);
export const ClassId = z.enum(['ranger', 'wizard', 'elf', 'ironclad_warden', 'shadow_weaver']);
export const CompanionId = z.enum(['ilyra', 'brak', 'nyx', 'dask', 'mireya', 'caelum']);
export const QuestStatus = z.enum(['inactive', 'active', 'completed', 'failed']);
export const Text = z.string().min(1);
export const Tags = z.array(z.string()).default([]);
export const RangeSchema = z.object({ min: z.number().optional(), max: z.number().optional() }).strict();
export const StatName = z.enum(['strength', 'magic', 'agility']);
export const DamageType = z.enum(['physical', 'fire', 'storm', 'ley', 'void', 'chrono']);
export const Resistance = z.enum(['weak', 'neutral', 'resist', 'immune']);
export const Rarity = z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']);
export const FactionId = z.enum(['remnants', 'weavers', 'ironclad']);
export const Voice = z.enum(['remnant_archive', 'ironclad_telling', 'weaver_fragment', 'wayfinder_notes']);
export const Stance = z.enum(['aggressive', 'guarded', 'support']);
export const Pct = z.number().min(0).max(1);
export const Base = z.object({ id: Id, tags: Tags, notes: z.string().optional() });
/** Text with conditional variants; the first matching variant wins, else `text`. */
export const VariantText = z.object({ text: Text, variants: z.array(z.object({ when: ConditionSchema, text: Text }).strict()).default([]) });
```

### 5.2 `RegionSchema`

```ts
export const RegionSchema = Base.extend({
  name: Text,
  description: Text,
  order: z.number().int(),                               // map/codex ordering
  levelBand: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }).strict(),
  legacy: z.boolean().default(false),                    // one of the five legacy regions (D-015)
  factionId: FactionId.optional(),
  palette: z.object({                                    // CSS colors; applied by <RegionPalette/>
    bg: z.string(), bgAlt: z.string(), fg: z.string(), accent: z.string(), glow: z.string(), danger: z.string().optional(),
  }).strict(),
  ambient: Id,                                           // ambient preset id in src/audio/ambient (validated against a registry list)
  wanderingPool: z.array(z.object({ creatureId: Id, weight: z.number().positive().default(1) }).strict()).default([]),
  returnEncounterChance: Pct.default(0.2),
  codexId: Id.optional(),
  unlockWhen: ConditionSchema.optional(),                // e.g. Silverwood Before: { loop: { min: 2 } }
});
```

### 5.3 `LocationSchema`

```ts
export const Dir = z.enum(['north', 'south', 'east', 'west', 'up', 'down', 'in', 'out', 'portal', 'path']);

export const ExitSchema = z.object({
  dir: Dir,
  to: Id,
  label: z.string().optional(),                 // "a hard climb north" (falls back to destination name)
  when: ConditionSchema.optional(),             // unmet → locked (shown with lockedText) unless hidden
  lockedText: z.string().optional(),            // legacy: "I should talk to Brak before going this way."
  hidden: z.boolean().default(false),           // not displayed until `when` is true (Echo routes, D-010)
  travelWatches: z.number().int().min(0).max(8).default(1),
  oneWay: z.boolean().default(false),
  dangerText: z.string().optional(),            // shown when the destination is horde-infected
}).strict();

export const EncounterGroupSchema = z.object({ creatureId: Id, count: z.number().int().min(1).max(3).default(1) }).strict();

export const EncounterSchema = Base.extend({
  groups: z.array(EncounterGroupSchema).min(1),
  chance: Pct.default(1),
  when: ConditionSchema.optional(),
  once: z.boolean().default(true),              // cleared for the loop after victory
  respawn: z.enum(['never', 'daily', 'on_return']).default('never'),
  fleeable: z.boolean().default(true),          // false only for bosses and story gates (D-066 #11)
  onFlee: z.enum(['scatter', 'hold', 'previous']).default('scatter'),   // fixed groups scatter; wandering → previous (DESIGN §4.7)
  ambush: z.boolean().default(false),
  intro: z.string().optional(),
  onVictory: Effects, onDefeat: Effects, onFlee: Effects,
  elite: z.boolean().default(false),            // Horde Rising modifier upgrades non-elites
});

export const LocationItemSchema = z.object({
  itemId: Id, count: z.number().int().min(1).default(1), when: ConditionSchema.optional(),
  rarity: Rarity.optional(), hidden: z.boolean().default(false), once: z.boolean().default(true),   // once=false respawns each loop day? no: respawns on `rest` here
}).strict();

export const LocationEventSchema = Base.extend({
  text: Text,
  once: z.boolean().default(true),
  when: ConditionSchema.optional(),
  trigger: z.enum(['enter', 'rest', 'dawn', 'leave', 'interact']).default('enter'),
  label: z.string().optional(),                 // for trigger 'interact': the button text ("Touch the Heartstone")
  effects: Effects,
});

export const LocationArtSchema = z.object({
  template: z.enum(['ruins', 'forest', 'cavern', 'swamp', 'peaks', 'spires', 'void', 'observatory', 'breach', 'camp', 'forge', 'shore', 'city', 'archive', 'steppe', 'sky', 'threshold', 'undercity', 'sanctum', 'custom']),
  horizon: Pct.default(0.6),
  silhouettes: z.array(z.string()).default([]),  // keys from src/ui/art/shapes registry; validator warns on unknown
  particles: z.enum(['none', 'motes', 'embers', 'spores', 'ash', 'static', 'shards', 'rain', 'fireflies', 'snow', 'pollen']).default('none'),
  focal: z.string().optional(),                  // key in src/ui/art/focal registry (hand-authored piece)
  timeOfDay: z.enum(['dawn', 'day', 'dusk', 'night', 'timeless']).default('dusk'),
  variants: z.array(z.object({ when: ConditionSchema, patch: z.record(z.unknown()) }).strict()).default([]),  // e.g. Depths go dark
}).strict();

export const LocationSchema = Base.extend({
  regionId: Id,
  name: Text,
  description: Text,
  descriptionVariants: z.array(z.object({ when: ConditionSchema, text: Text }).strict()).default([]),
  exits: z.array(ExitSchema).default([]),
  items: z.array(LocationItemSchema).default([]),
  encounters: z.array(EncounterSchema).default([]),
  npcs: z.array(Id).default([]),
  events: z.array(LocationEventSchema).default([]),
  art: LocationArtSchema,
  ambient: Id.optional(),                        // overrides region ambient
  rest: z.object({
    kind: z.enum(['camp', 'inn', 'sanctum', 'wild']),
    cost: z.number().int().min(0).default(0),
    healPct: Pct.default(1),
    companionSwap: z.boolean().default(true),
    when: ConditionSchema.optional(),
    text: z.string().optional(),
    ambushChance: Pct.default(0),                // wild camps
  }).strict().optional(),
  merchantId: Id.optional(),
  craftingStation: z.enum(['forge', 'alchemy', 'loom', 'anchor']).optional(),
  levelBand: z.object({ min: z.number().int(), max: z.number().int() }).strict().optional(),   // overrides region
  map: z.object({ x: z.number(), y: z.number() }).strict(),
  safe: z.boolean().default(false),              // no wandering encounters
  temporallyUnstable: z.boolean().default(false), // D-059 static flag (Dask); Horde infection adds it at runtime
  gather: z.object({ itemId: ItemId, perDay: z.number().int().min(1).max(2) }).strict().optional(),   // DESIGN §8.2
  waitable: z.boolean().default(false),          // `wait` action allowed
  legacyName: z.string().optional(),             // original Python name, for Appendix A / BIBLE cross-check
});
```

### 5.4 `CreatureSchema`

DESIGN §4.2's ordered pattern is the AI model (D-066 #14); PLAN's earlier weighted-random `IntentSchema` is withdrawn. A creature has a `moves` table and a `pattern` of steps that reference moves; WORLD §6's cadence words map one-to-one onto `CombatWhen` (`everyNthTurn:n` → `everyNth`, "first" → `first`, "once per fight" → `oncePerFight`, `ifAllyPresent` → `allyPresent`, "alternates" → a two-step pattern).

```ts
export const StatusApplySchema = z.object({
  status: PId('status_'), chance: Pct.default(1), stacks: z.number().int().min(1).default(1), duration: z.number().int().min(1).default(2),
  target: z.enum(['target', 'self', 'all_enemies', 'all_allies', 'ally']).default('target'),
}).strict();

export const TargetRule = z.enum(['player', 'companion', 'lowest_hp', 'highest_mag', 'random', 'all', 'self', 'ally', 'marked_first', 'taunter']);

/** Combat-only predicates, evaluated when the intent is generated (DESIGN §4.2). */
export type CombatWhen =
  | { all: CombatWhen[] } | { any: CombatWhen[] } | { not: CombatWhen }
  | { hpBelow: number } | { roundAtLeast: number } | { allyCountBelow: number } | { allyPresent: true | string }
  | { targetHas: string } | { selfHas: string } | { everyNth: number } | { first: true } | { oncePerFight: true }
  | { playerGuarding: boolean };
export const CombatWhenSchema: z.ZodType<CombatWhen> = z.lazy(() => z.union([ /* one strict object per variant */ ]));

export const PowerSchema = z.object({ base: z.number().default(0), coef: z.number().min(0), stat: z.enum(['atk', 'sp']), hits: z.number().int().min(1).default(1) }).strict();

export const MoveSchema = z.object({
  name: Text,
  line: Text,                                    // WORLD §6 telegraph line ("The hour draws tight, then lashes at you.")
  type: DamageType.optional(),                   // absent = non-damaging
  power: PowerSchema.optional(),
  statuses: z.array(StatusApplySchema).default([]),
  hidden: z.boolean().default(false),            // "?" chip (DESIGN §4.2)
  windUp: z.object({ turns: z.number().int().min(1).max(3), then: Id }).strict().optional(),   // tyr_gather → tyr_chrono_strike
  summon: z.object({ creatureId: PId('cr_'), count: z.number().int().min(1), max: z.number().int().min(1), hpPct: Pct.default(1) }).strict().optional(),
  revive: z.object({ hpPct: Pct }).strict().optional(),
  riposte: z.object({ power: PowerSchema, turns: z.number().int().min(1) }).strict().optional(),
  shieldAlly: z.object({ power: PowerSchema }).strict().optional(),
  shield: z.object({ power: PowerSchema }).strict().optional(),     // self shield (tyr_brace, tyr_aulde_sings)
  heal: z.object({ power: PowerSchema, target: z.enum(['self', 'ally', 'lowest_ally']) }).strict().optional(),
  cleanseSelf: z.boolean().default(false),
  leaveCombat: z.boolean().default(false),       // reach_withdraw
  special: PId('').optional(),                   // engine-coded scriptId, validated against SPECIALS (src/engine/combat/specials.ts)
}).strict();

export type Step =
  | { move: string; target: z.infer<typeof TargetRule>; when?: CombatWhen }
  | { if: CombatWhen; then: Step[]; else?: Step[] }
  | { weighted: { w: number; step: Step }[] }
  | { repeat: Step[]; times: number }
  | { phaseHold: true };
export const StepSchema: z.ZodType<Step> = z.lazy(() => z.union([ /* strict objects as above */ ]));

export const TriggerSchema = z.union([
  z.object({ hpBelow: Pct }).strict(), z.object({ round: z.number().int().min(1) }).strict(),
  z.object({ event: z.enum(['addsDead', 'communionMovementEnd']) }).strict(), z.object({ resolveAtLeast: z.number().int().min(0).max(8) }).strict(),
]);

export const PhaseSchema = z.object({
  id: Id,                                        // tyr_movement_1..3, tyr_phase_4 for the Tyrants
  name: Text,
  enterWhen: z.array(TriggerSchema).default([]), // OR-list; the first phase has none
  pattern: z.array(StepSchema).min(1),
  adds: z.array(z.object({ creatureId: PId('cr_'), count: z.number().int().min(1), countSolo: z.number().int().min(0).optional(), hpPct: Pct.default(1) }).strict()).default([]),
  onEnter: Effects,
  line: z.string().optional(),                   // transition line (WORLD §6.8)
  damageTakenMult: z.number().positive().default(1),   // Contained P3 ×1.5 (provisional)
}).strict();

export const CommunionSpecSchema = z.object({      // DESIGN §4.11
  opensWith: z.array(ConditionSchema).min(1),     // any-of: { echo: 'echo_tyrant_speaks' } …
  movements: z.array(z.object({
    id: z.enum(['tyr_movement_1', 'tyr_movement_2', 'tyr_movement_3']),
    questions: z.array(z.object({ id: PId('tyr_q_'), line: Text,
      answers: z.array(z.object({ id: Id, when: ConditionSchema, resolve: z.number().int(), lie: z.boolean().default(false), text: Text }).strict()) }).strict()),
  }).strict()).length(3),
  offers: z.array(z.object({ itemId: Id, resolve: z.number().int(), effects: Effects }).strict()),
  pressMove: Id,                                  // tyr_hour_presses
  outcomes: z.array(z.object({ minResolve: z.number().int(), when: ConditionSchema.optional(), choiceId: Id, effects: Effects }).strict()),
}).strict();

export const CreatureSchema = Base.extend({
  id: PId('cr_'),
  name: Text,
  description: Text,
  family: PId('fam_'),                           // WORLD §5's eight families
  materialKin: z.string().optional(),            // DESIGN §8.2 loot family
  role: z.enum(['fodder', 'elite', 'boss', 'anomaly', 'add']),
  level: z.number().int().min(1).max(20),
  stats: z.object({ hp: z.number().int().min(1), atk: z.number().min(0), sp: z.number().min(0).default(0),
                    armor: z.number().min(0), ward: z.number().min(0), agi: z.number().min(0) }).strict(),
  tags: Tags,                                    // 'breach_born' (poison-immune), 'construct', …
  resistances: z.record(DamageType, Resistance).default({}),
  statusImmunities: z.array(PId('status_')).default([]),
  tauntImmune: z.boolean().default(false),
  interruptible: z.boolean().default(true),      // Stagger allowed on bosses
  moves: z.record(Id, MoveSchema),
  pattern: z.array(StepSchema).min(1),           // non-boss creatures; bosses use phases[].pattern
  phases: z.array(PhaseSchema).default([]),      // bosses: 2–4 (validator enforces for role 'boss')
  communion: CommunionSpecSchema.optional(),     // cr_chronos_tyrant_unveiled only
  fleeable: z.boolean().default(true),           // false for bosses and story gates (validator enforces for 'boss')
  loot: z.array(z.object({ itemId: Id, chance: Pct.default(1), count: z.number().int().min(1).default(1), rarity: Rarity.optional(), when: ConditionSchema.optional() }).strict()).default([]),
  gold: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }).strict(),
  xp: z.number().int().min(0),
  bestiary: z.object({ voice: Voice, summary: Text, tactics: z.string().optional(), codexId: PId('codex_').optional(),
                       reveals: z.array(z.object({ kills: z.number().int().min(1), reveal: z.enum(['resist', 'pattern', 'all']) }).strict()).default([]) }).strict(),
  sigil: z.object({ base: z.string(), accent: z.string().optional(), details: z.array(z.string()).default([]) }).strict(),
  onDefeat: Effects,
  legacyName: z.string().optional(),
});
```

The validator checks every `step.move` exists in `moves`, every `windUp.then` exists, boss phases are ordered and their `enterWhen` triggers are monotone, and the first-kill Dark Spellbook rule (D-055) is expressed as `loot` on `cr_corrupted_shade` with `{ when: { not: { flag: 'flag_spellbook_dropped' } } }` at 100 % plus a 50 % row.

### 5.5 `ItemSchema`

```ts
export const PassiveSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('resist'), damageType: DamageType, level: Resistance }).strict(),
  z.object({ kind: z.literal('statusOnHit'), status: PId('status_'), chance: Pct, duration: z.number().int().default(2) }).strict(),
  z.object({ kind: z.literal('mpCostReduction'), pct: z.number() }).strict(),        // legacy staffs: 10 %, 20 % (DESIGN §5.1)
  z.object({ kind: z.literal('lifeSteal'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('curse'), chance: Pct, damage: z.number() }).strict(),  // Shadow-Kissed Dagger
  z.object({ kind: z.literal('regen'), hp: z.number().default(0), mp: z.number().default(0) }).strict(),
  z.object({ kind: z.literal('resourceGain'), pct: z.number() }).strict(),          // affix_of_the_wellspring
  z.object({ kind: z.literal('statusImmunity'), status: PId('status_') }).strict(),
  z.object({ kind: z.literal('damageBonus'), damageType: DamageType.optional(), pct: z.number() }).strict(),
  z.object({ kind: z.literal('guardValue'), pct: z.number() }).strict(),            // affix_of_the_warden
  z.object({ kind: z.literal('grantAbility'), abilityId: PId('itm_') }).strict(),   // Amulet → itm_echo_bolt (D-047)
  z.object({ kind: z.literal('custom'), scriptId: Id, params: z.record(z.unknown()).default({}) }).strict(),
]);

export const ItemSchema = Base.extend({
  name: Text,
  description: Text,
  id: ItemId,
  type: z.enum(['weapon', 'armor', 'trinket', 'consumable', 'material', 'quest', 'key', 'recipe', 'tome']),   // DESIGN §7.1's nine
  slot: z.enum(['weapon', 'armor', 'trinket']).optional(),            // required for weapon/armor/trinket (validator)
  weaponType: z.enum(['melee', 'ranged_bow', 'magic_staff', 'shield_heavy', 'void_focus']).optional(),   // DESIGN §5.7
  armorClass: z.enum(['light', 'medium', 'heavy']).optional(),
  tier: z.number().int().min(0).max(5).default(1),                    // T1–T5 (D-066 #22)
  rarityRule: z.enum(['rolled', 'fixed']).default('rolled'),           // consumables/quest/material/key/book are forced 'fixed'
  fixedRarity: Rarity.default('common'),
  stats: z.object({                                                    // DESIGN §3.2 / §7.4 vocabulary; rarity scales power/spellPower/armor/ward
    power: z.number().default(0), spellPower: z.number().default(0), armor: z.number().default(0), ward: z.number().default(0),
    strength: z.number().default(0), magic: z.number().default(0), agility: z.number().default(0),
    hpMax: z.number().default(0), mpMax: z.number().default(0), hpMaxPct: z.number().default(0),
    crit: z.number().default(0), accuracy: z.number().default(0), initiative: z.number().default(0),
  }).strict().default({}),
  resistSteps: z.array(DamageType).default([]),                         // one step toward immune per entry (DESIGN §4.4)
  fixedAffixes: z.array(PId('affix_')).default([]),                     // fixed-rarity drops (WORLD "fixed R (affix_of_the_void)")
  passives: z.array(PassiveSchema).default([]),
  onUse: Effects,                                                       // consumables; `heal`, `applyStatus`, `corruption`…
  usableInCombat: z.boolean().default(true),
  usableOutOfCombat: z.boolean().default(true),
  consumeOnUse: z.boolean().default(true),
  stackable: z.boolean().optional(),                                    // default: type ∈ consumable|material
  maxStack: z.number().int().min(1).default(99),
  value: z.number().int().min(0),
  sellable: z.boolean().default(true),
  droppable: z.boolean().default(true),
  upgradeable: z.boolean().optional(),                                  // rarity tier-up (DESIGN §8.3); default: weapon|armor|trinket
  requirements: z.object({ classIds: z.array(Id).optional(), level: z.number().int().optional(), when: ConditionSchema.optional() }).strict().optional(),
  sources: z.array(z.string()).default([]),                             // 'drop:cr_corrupted_shade' | 'merchant:npc_kaelen_stonehand' | 'craft:recipe_voidforged_edge' | 'quest:q_lost_scroll' | 'loc:loc_shattered_library' — validated by prefix
  art: z.object({ icon: z.string(), major: z.boolean().default(false), accent: z.string().optional() }).strict(),
  codexId: Id.optional(),
  legacyName: z.string().optional(),
});
```

### 5.6 `RecipeSchema`

```ts
// DESIGN §8.1; Borin at the Emberforge is the only crafter, so there is no station field.
export const RecipeSchema = Base.extend({
  id: PId('recipe_'),
  name: Text,
  inputs: z.array(z.object({ itemId: ItemId, count: z.number().int().min(1).default(1) }).strict()).min(1),
  anyOf: z.array(z.array(z.object({ itemId: ItemId, count: z.number().int().min(1) }).strict())).default([]),   // e.g. stable OR dead fragment (D-052)
  output: z.object({ itemId: ItemId, count: z.number().int().min(1).default(1), rarity: Rarity.optional() }).strict(),
  gold: z.number().int().min(0),                 // Borin's fee before att_borins_favor; story recipes 0 (D-066 #10)
  story: z.boolean().default(false),             // validator: story ⇒ gold === 0
  repTier: z.enum(['neutral', 'trusted', 'sworn']).default('neutral'),           // Ironclad tier
  repTierWhileActive: z.object({ quests: z.array(PId('q_')), tier: z.enum(['neutral', 'trusted']) }).strict().optional(),  // anchor: Neutral during q_the_mending / q_iron_silence
  requires: ConditionSchema.optional(),          // Echoes, flags, Heartstone state …
  requiresItemRead: ItemId.optional(),           // a recipe/pattern item read this loop
  timeCost: z.union([z.literal(0), z.literal(1)]).default(1),   // first craft per visit 1 watch, later 0
  category: z.enum(['weapon', 'armor', 'trinket', 'consumable', 'quest']),
});
```

### 5.7 `AbilitySchema` and `ClassSchema`

```ts
export const AbilitySchema = Base.extend({
  id: z.string().regex(/^(rgr|wiz|elf|wrd|wvr|comp_[a-z]+|itm)_[a-z0-9_]+$/),   // D-044 / D-061 prefixes
  ownerId: z.string(),                            // classId, companionId, or an item id for itm_ abilities
  branch: Id.optional(),                          // class abilities only (validator)
  tier: z.number().int().min(1).max(5).optional(),
  kind: z.enum(['attack', 'debuff', 'aoe', 'heal', 'shield', 'cleanse', 'buff', 'utility', 'signature']).optional(),   // companions (cooldown by kind)
  name: Text,
  description: Text,
  mp: z.number().int().min(0).default(0),
  selfCost: z.object({ hpPctMax: z.number().optional(), hpPctCur: z.number().optional(), hpPerHit: z.number().optional() }).strict().optional(),   // never kills; requires HP > cost (D-066 #5)
  target: z.enum(['enemy', 'all_enemies', 'self', 'ally', 'self_or_ally', 'party']),
  damageType: DamageType.optional(),
  spell: z.boolean().default(false),              // +10 accuracy (DESIGN §3.2)
  power: z.object({ base: z.number().default(0), coef: z.number(), stat: z.enum(['atk', 'sp']), hits: z.number().int().min(1).default(1),
                    perHitCrit: z.boolean().default(true), maxOf: z.object({ base: z.number(), coef: z.number(), stat: z.enum(['atk', 'sp']) }).strict().optional(),   // itm_echo_bolt: max(0.9·ATK, 4 + 0.8·SP)
                    ignoresArmor: z.boolean().default(false) }).strict().optional(),
  bonuses: z.array(z.object({ when: CombatWhenSchema, mult: z.number() }).strict()).default([]),   // ×1.25 vs Marked, ×1.5 if acting before the target …
  heal: z.object({ base: z.number(), coef: z.number(), stat: z.enum(['atk', 'sp', 'maxStrAgi']), target: z.enum(['self', 'ally', 'party']).default('self') }).strict().optional(),
  shield: z.object({ base: z.number(), coef: z.number(), stat: z.enum(['atk', 'sp']), turns: z.number().int().default(3) }).strict().optional(),
  statuses: z.array(StatusApplySchema).default([]),
  onKill: z.object({ refundMp: z.number().optional(), refundHp: z.literal('spent').optional() }).strict().optional(),
  interrupt: z.boolean().default(false),
  cooldown: z.number().int().min(0).default(0),
  costHalf: z.number().int().min(2).default(2),   // half-points: T1–T4 = 2, capstone = 4; mastery halves (DESIGN §5.1, §6.4)
  levelReq: z.number().int().min(1).default(1),   // tier gates 1/4/8/12/16 + branch prerequisites (validator)
  special: Id.optional(),                         // engine hook from SPECIALS registry: 'rewind', 'phase', 'taunt', 'cleanse', 'trap', 'mark_execute', 'chain', 'counter_stance', 'drain', 'unmaking'
  outOfCombat: Effects,                           // usable outside combat (field medicine, trap setting) — if non-empty, legal in explore
  flavor: z.string().optional(),
  corruptionReq: z.number().int().min(0).max(6).optional(),   // Weaver/Wizard corruption-gated abilities (D-017)
});

export const ClassSchema = Base.extend({
  name: Text,
  title: Text,                                    // "hunter of the wilds between settlements"
  description: Text,
  intro: Text,                                    // class-select blurb (legacy intros preserved for Ranger/Wizard/Elf)
  baseStats: z.object({ hp: z.number().int(), mp: z.number().int(), strength: z.number().int(), magic: z.number().int(), agility: z.number().int() }).strict(),
  growth: z.object({ hp: z.number().int(), mp: z.number().int() }).strict(),   // DESIGN §3.3; +1 stat point and +2 half-AP per level are global
  resource: z.object({
    name: Text,                                   // Focus / Mana / Mana / Grit / Mana
    rules: z.array(z.object({
      on: z.enum(['basic_hit', 'crit', 'guard', 'hit_taken', 'dodge', 'taunt', 'turn_start']),
      amount: z.number().optional(), pctMax: z.number().optional(),
      perLevel: z.object({ every: z.number().int(), add: z.number() }).strict().optional(),   // Wizard 3 + ⌊level/4⌋
    }).strict()),
    bloodPrice: z.object({ hpPerMp: z.number() }).strict().optional(),   // Shadow Weaver: 2 HP per missing MP
  }).strict(),
  branches: z.array(z.object({ id: Id, name: Text, description: Text }).strict()).length(3),
  starterItems: z.array(z.object({ itemId: Id, equip: z.boolean().default(false), count: z.number().int().default(1) }).strict()),
  startingAbilities: z.array(Id).default([]),
  startingGold: z.number().int().default(30),
  uniqueQuestId: PId('q_class_').optional(),     // D-008: one class mini-quest (q_class_<class>)
  dialogueTag: Id,                                // used by `{ class: id }` conditions and text tokens
  sigil: z.string(),
  legacy: z.boolean().default(false),
});
```

### 5.8 `StatusSchema`

```ts
export const CANONICAL_STATUSES = ['status_bleed', 'status_burn', 'status_shock', 'status_soaked', 'status_slow', 'status_haste', 'status_stun',
  'status_weaken', 'status_armor_break', 'status_mark', 'status_curse', 'status_shield', 'status_regen', 'status_taunt', 'status_phase',
  'status_rewind', 'status_poison', 'status_blind', 'status_rested'] as const;   // DESIGN §4.5: 18 + rested

export const StatusSchema = Base.extend({
  name: Text,
  description: Text,
  kind: z.enum(['buff', 'debuff', 'neutral']),
  stackable: z.boolean().default(false),
  maxStacks: z.number().int().min(1).default(1),
  defaultDuration: z.number().int().min(1).default(2),
  tick: z.object({
    timing: z.enum(['turn_start', 'turn_end']).default('turn_start'),
    damage: z.object({ base: z.number(), coef: z.number(), stat: z.enum(['atk', 'sp']), perStack: z.boolean().default(false),
                       type: DamageType.optional() }).strict().optional(),   // computed at application from the source; resistance step only (D-066 #4); no type = untyped (Poison)
    heal: z.object({ flat: z.number().default(0), pctMaxHp: z.number().default(0) }).strict().optional(),
  }).strict().optional(),
  modifiers: z.object({
    outgoingPct: z.number().default(0), incomingPct: z.number().default(0), healingPct: z.number().default(0),
    armorWardZero: z.boolean().default(false), agiFlat: z.number().default(0), initiativeFlat: z.number().default(0),
    accuracyFlat: z.number().default(0), evasionFlat: z.number().default(0), critFlat: z.number().default(0),
    skipTurn: z.boolean().default(false), untargetable: z.boolean().default(false), forcedTargetUidFromSource: z.boolean().default(false),
    absorbFlat: z.number().default(0),         // shield: uses StatusInstance.power when set
    blockActions: z.array(z.enum(['ability', 'item', 'flee', 'guard'])).default([]),
  }).strict().default({}),
  expiresOn: z.array(z.enum(['hit_taken', 'turn', 'ability_used'])).default(['turn']),
  color: z.string(),
  icon: z.string(),
  special: Id.optional(),                        // 'rewind' (restore hp to value at application), 'phase', 'taunt' logic in statuses.ts
});
```

### 5.9 `QuestSchema`

```ts
export const ObjectiveSchema = Base.extend({
  text: Text,                                    // journal line: "Recover the Echo Crystal from the Shattered Library"
  when: ConditionSchema,                         // satisfied when true
  optional: z.boolean().default(false),
  hidden: z.boolean().default(false),            // revealed when done
  hintLocationId: Id.optional(),                 // map marker
});

export const QuestStageSchema = Base.extend({
  journal: Text,                                 // current-stage journal text
  objectives: z.array(ObjectiveSchema).default([]),
  advanceWhen: ConditionSchema.optional(),       // default: all non-optional objectives done
  next: z.union([Id, z.array(z.object({ when: ConditionSchema, to: Id }).strict())]).optional(),  // absent → terminal unless outcome set
  outcome: z.enum(['complete', 'fail']).optional(),   // reaching this stage ends the quest
  onEnter: Effects,
  onExit: Effects,
  timeLimitDays: z.number().int().optional(),    // auto-fail (or `onTimeout` stage) after N days in this stage
  onTimeoutTo: Id.optional(),
});

export const QuestSchema = Base.extend({
  id: PId('q_'),                                 // STORY §11 ids (q_echo_crystal …, q_class_<class>)
  name: Text,
  description: Text,                             // journal header blurb
  category: z.enum(['legacy', 'faction', 'companion', 'regional', 'loop', 'ending', 'class', 'stretch']),   // DESIGN §13.1
  botHint: z.enum(['melee', 'caster', 'explorer', 'speedrunner', 'pacifist']),   // which bot must complete it (DESIGN §13.4)
  failWhen: ConditionSchema.optional(), onFail: Effects,
  giverNpcId: Id.optional(),
  factionId: FactionId.optional(),
  companionId: Id.optional(),
  classId: Id.optional(),
  startWhen: ConditionSchema.optional(),         // auto-start sweep (e.g. legacy q_echoing_heartbeat: 2 quests completed)
  availableWhen: ConditionSchema.optional(),     // can be offered (dialogue uses `questStart` effect)
  stages: z.array(QuestStageSchema).min(1),
  firstStage: Id.optional(),                     // default stages[0].id
  rewards: z.object({ xp: z.number().int().default(0), gold: z.number().int().default(0), items: z.array(z.object({ itemId: Id, count: z.number().int().default(1) }).strict()).default([]), rep: z.array(z.object({ faction: FactionId, delta: z.number() }).strict()).default([]), echoes: z.array(Id).default([]), resonance: z.number().int().default(0) }).strict().default({}),
  shortcuts: z.array(z.object({ echo: Id, skipTo: Id, text: Text }).strict()).default([]),   // D-010 Echo shortcuts
  repeatablePerLoop: z.boolean().default(true),  // all quests reset per loop (D-011); false = once per profile (loop-only reveals)
  hiddenUntilStarted: z.boolean().default(true),
  countsForApex: z.boolean().default(true),      // contributes to the engine counter quests_completed (D-048)
  legacyId: z.string().optional(),               // the Python id, for Appendix A cross-checks
});
```

### 5.10 `DialogueSchema`

```ts
export const DialogueChoiceSchema = Base.extend({
  text: Text,
  when: ConditionSchema.optional(),              // hidden when false (use `disabledText` to show greyed instead)
  disabledText: z.string().optional(),
  effects: Effects,
  next: z.union([Id, z.literal('end')]),
  echoHint: Id.optional(),                       // UI marks the choice with the Echo sigil (D-010 "I know what you are, Nyx")
  once: z.boolean().default(false),              // per scene visit
  oncePerLoop: z.boolean().default(false),       // writes flag `flag_choice_<sceneId>_<choiceId>` (C-58)
  disabledWhen: ConditionSchema.optional(),      // shown greyed with reason ("(You do not yet know this)")
  tags: z.array(z.enum(['echo', 'class', 'faction', 'companion'])).default([]),   // UI glyph (DESIGN §13.2)
  hotkey: z.string().regex(/^[1-9]$/).optional(),
});

export const DialogueNodeSchema = Base.extend({
  speaker: z.union([Id, z.literal('narrator'), z.literal('player'), z.literal('companion')]),
  text: Text,
  textVariants: z.array(z.object({ when: ConditionSchema, text: Text }).strict()).default([]),
  choices: z.array(DialogueChoiceSchema).default([]),
  next: z.union([Id, z.literal('end')]).optional(),   // required when choices is empty (validator)
  onEnter: Effects,
  mood: z.enum(['neutral', 'warm', 'grim', 'urgent', 'afraid', 'wry', 'cold']).default('neutral'),
  art: z.string().optional(),                    // optional focal art key for the dialogue backdrop
});

export const DialogueSceneSchema = Base.extend({
  npcId: Id.optional(),                          // scene is offered by `talk` to this NPC (if absent: started only via startDialogue)
  title: z.string().optional(),
  when: ConditionSchema.optional(),              // availability
  priority: z.number().int().default(0),         // highest available wins on `talk`
  repeatable: z.boolean().default(true),         // false → flag `flag_scene_done_<scene>` set at end (C-58)
  entry: z.union([Id, z.array(z.object({ when: ConditionSchema, node: Id }).strict())]),   // first match, else first node
  nodes: z.array(DialogueNodeSchema).min(1),
  onEnd: Effects,
  companionReactions: z.array(z.object({ companionId: Id, when: ConditionSchema.optional(), text: Text, loyalty: z.number().default(0) }).strict()).default([]),
});
```

### 5.11 `NpcSchema`, `CompanionSchema`

```ts
export const NpcSchema = Base.extend({
  id: PId('npc_'),                               // WORLD §4 ids (D-064); names/roles from STORY
  name: Text,
  description: Text,
  factionId: z.union([FactionId, z.literal('neutral')]).default('neutral'),   // Kaelen = neutral (D-014)
  homeLocationId: Id,
  portrait: z.object({ sigil: z.string(), accent: z.string().optional() }).strict(),
  roles: z.array(z.enum(['questgiver', 'merchant', 'smith', 'healer', 'companion', 'lore', 'keeper'])).default([]),
  merchantId: PId('npc_').optional(),           // merchants are keyed by their NPC id (WORLD §9)
  companionId: CompanionId.optional(),           // plain companion id; NPC id stays npc_<name>
  barks: z.array(z.object({ when: ConditionSchema.optional(), text: Text }).strict()).default([]),   // one random bark shown on `examine`/idle
  legacyName: z.string().optional(),
  age: z.number().int().optional(),              // BIBLE cross-check (D-025)
});

export const CompanionSchema = Base.extend({
  id: CompanionId,                               // plain id (D-044)
  npcId: PId('npc_'),
  name: Text,
  role: z.enum(['bruiser', 'caster', 'support', 'skirmisher']),
  damageType: DamageType.default('physical'),
  stats: z.object({ hp: z.number().int(), atk: z.number(), sp: z.number(), agi: z.number(), armor: z.number(), ward: z.number() }).strict(),   // L1 (DESIGN §12.3)
  perLevel: z.object({ hp: z.number(), atk: z.number(), sp: z.number() }).strict(),   // armor/ward +1 per 4 levels and fixed AGI are engine rules
  abilities: z.array(PId('comp_')).length(3),    // auto abilities; cooldown by `kind` (DESIGN §12.4); no MP
  signature: z.object({ abilityId: PId('comp_'), cooldown: z.number().int().min(1) }).strict(),
  stances: z.record(Stance, z.object({
    guardBelowHpPct: Pct.default(0.3), healAllyBelowPct: Pct.default(0.4), preferStatuses: z.boolean().default(false),
    targetRule: z.enum(['lowest_hp', 'highest_threat', 'player_target', 'random']).default('lowest_hp'), abilityWeight: Pct.default(0.6),
  }).strict()).default({}),
  startingLoyalty: z.number().int().default(0),    // 25 with the matching *_bond Echo (DESIGN §12.5)
  requiresTemporallyUnstable: z.boolean().default(false),   // Dask: active only where location.temporallyUnstable || infected (D-059)
  constraintText: z.string().optional(),           // "Dask flickers and cannot follow."
  deathRule: z.enum(['ko', 'permadeath_scripted']).default('ko'),
  arcQuestIds: z.array(Id).min(1),                 // ≥ 3 after content lands (validator warns < 3)
  banter: z.array(z.object({ when: ConditionSchema.optional(), locationId: Id.optional(), regionId: Id.optional(), text: Text, loyalty: z.number().default(0) }).strict()).default([]),
  campScenes: z.array(Id).default([]),             // dialogue scene ids offered at rest
  portrait: z.object({ sigil: z.string(), accent: z.string().optional() }).strict(),
});
```

### 5.12 `EchoSchema`, `CodexSchema`

```ts
// STORY §12 is the catalog (D-062); mechanical effects follow DESIGN §10.4–10.5.
export const EchoSchema = Base.extend({
  id: PId('echo_'),
  name: Text,
  codexLine: Text,                                 // ≤ 40 words, Wayfinder's Notes voice
  description: z.string().optional(),
  category: z.enum(['lore', 'route', 'shortcut', 'dialogue', 'ending', 'character', 'secret']),
  exclusiveWith: z.array(Id).default([]),          // cannot both be gained in one loop (D-010)
  onGrant: Effects,                                // e.g. unlockCodex, reveal
  resonance: z.number().int().default(5),          // first-time Resonance
  obtainedBy: z.array(z.string()).min(1),          // documentation: 'dialogue:nyx_truth:choice_know' | 'quest:…' | 'event:…' — validator cross-checks that some content grants it
  timelineGroup: z.string().optional(),            // Loop Timeline grouping label
  requiredForEndings: z.array(Id).default([]),     // documentation + validator (ending requirements reference this echo)
});

export const CodexSchema = Base.extend({
  title: Text,
  voice: Voice,
  category: z.enum(['history', 'the_nine', 'wayfinders', 'factions', 'people', 'places', 'creatures', 'magic', 'items', 'loops']),
  body: Text,                                      // validator: ≤ 220 words (D-020)
  unlockWhen: ConditionSchema.optional(),          // absent → unlocked by explicit `unlockCodex` effect only
  unlockedAtStart: z.boolean().default(false),
  related: z.array(Id).default([]),
  order: z.number().int().default(0),
  date: z.string().optional(),                     // Remnant Archive dating ("Year 412 of the Sundering")
});
```

### 5.13 `AchievementSchema`, `AttunementSchema`, `ModifierSchema`

```ts
export const AchievementSchema = Base.extend({
  name: Text,
  description: Text,
  hidden: z.boolean().default(false),
  when: ConditionSchema,
  checkpoints: z.array(z.enum(['step', 'combat_end', 'day_end', 'loop_end', 'ending'])).default(['loop_end', 'ending']),
  resonance: z.number().int().default(10),
  icon: z.string(),
});

export const AttunementEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start_gold'), amount: z.number().int() }).strict(),
  z.object({ kind: z.literal('start_item'), itemId: Id, count: z.number().int().default(1) }).strict(),
  z.object({ kind: z.literal('stat'), stat: StatName, amount: z.number().int() }).strict(),
  z.object({ kind: z.literal('hp_max_pct'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('clock_watches'), watches: z.number().int() }).strict(),
  z.object({ kind: z.literal('xp_pct'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('shop_discount_pct'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('ability_points'), amount: z.number().int() }).strict(),
  z.object({ kind: z.literal('reveal_region'), regionId: Id }).strict(),
  z.object({ kind: z.literal('loyalty_start'), amount: z.number().int() }).strict(),
  z.object({ kind: z.literal('rest_heal_pct'), pct: z.number() }).strict(),
  z.object({ kind: z.literal('flee_pct'), pct: z.number() }).strict(),
]);

export const AttunementSchema = Base.extend({
  id: PId('att_'),
  name: Text,
  description: Text,
  cost: z.number().int().min(1),                            // Resonance (DESIGN §10.7); owned forever, no ranks
  effects: z.array(AttunementEffectSchema).min(1),
  requires: ConditionSchema.optional(),                     // att_steady_hours requires echo_breach_clock
  icon: z.string(),
});
// The cap that keeps Attunements a convenience is the equip cap of 5 (DESIGN §10.7, REVIEW-CROSS C-41), enforced by the
// engine (`equipAttunement`) and checked by the validator against config.attunementEquipCap; there is no power budget.

export const ModifierRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('disable_attunements') }).strict(),
  z.object({ kind: z.literal('clock_base_watches'), watches: z.number().int().min(20), halveOthers: z.boolean() }).strict(),   // Frayed Clock: 80, true
  z.object({ kind: z.literal('disable_echo_shortcuts') }).strict(),
  z.object({ kind: z.literal('elite_chance'), pct: Pct }).strict(),
  z.object({ kind: z.literal('damage_multiplier'), outgoing: z.number(), incoming: z.number() }).strict(),
  z.object({ kind: z.literal('xp_sources'), allow: z.array(z.enum(['combat', 'quest', 'discovery'])) }).strict(),
  z.object({ kind: z.literal('custom'), scriptId: Id }).strict(),
]);

export const ModifierSchema = Base.extend({ name: Text, description: Text, rules: z.array(ModifierRuleSchema).min(1), achievementId: Id.optional(), icon: z.string() });
export const REQUIRED_MODIFIERS = ['mod_iron_loop', 'mod_frayed_clock', 'mod_mute_ley', 'mod_horde_rising', 'mod_glass', 'mod_pacifist'] as const;   // D-021, DESIGN §15.1
```

### 5.14 `EndingSchema`

```ts
export const EndingSchema = Base.extend({
  id: z.enum(['ending_wardens_vigil', 'ending_mending', 'ending_weavers_dawn', 'ending_iron_silence', 'ending_long_archive', 'ending_unbound',
              'closer_escape', 'closer_fall']),
  letter: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).optional(),
  kind: z.enum(['true', 'closer']),
  reasons: z.array(z.enum(['death', 'expiry', 'rejected'])).default([]),   // closer_fall only (D-066 #7)
  name: Text,                                      // "The Warden's Vigil"
  tagline: Text,
  requirements: ConditionSchema,                   // documentation + Threshold eligibility panel + validator (must be satisfiable per pathBot)
  requirementTexts: z.array(z.object({ when: ConditionSchema, text: Text }).strict()).default([]),   // human-readable "what you still need"
  sequence: z.array(z.object({ text: Text, art: z.string().optional(), sfx: z.string().optional(), mood: z.string().optional() }).strict()).min(1),
  epilogues: z.array(z.object({ subject: Id, when: ConditionSchema.optional(), text: Text }).strict()).default([]),   // per companion / faction / place
  achievementId: Id.optional(),
  resonance: z.number().int().default(0),
  // Flow is fixed by the engine, not data: Loop 1 closers → Loop 2 Day 1 (D-049); every other closer and every true
  // ending → (sequence, epilogues) → Threshold, where New Game+ is offered after a true ending (DESIGN §2.2).
  credits: z.boolean().default(false),             // show "a game by Tim Dibert" roll (D-027)
});
```

### 5.15 `MerchantSchema`, `FactionSchema`

```ts
export const MerchantSchema = Base.extend({
  id: PId('npc_'),                                         // keyed by the NPC id (WORLD §9; REGISTRY §23)
  npcId: PId('npc_'),
  name: Text,
  stock: z.array(z.object({ itemId: Id, count: z.union([z.number().int().min(1), z.literal('unlimited')]).default(1), when: ConditionSchema.optional(), priceMult: z.number().positive().default(1), rarity: Rarity.optional(), rollRarity: z.boolean().default(true) }).strict()).min(1),
  rollStock: z.object({ pool: z.array(Id), pick: z.object({ min: z.number().int(), max: z.number().int() }).strict() }).strict().optional(),   // legacy Kaelen: 3–4 random gear
  // restock: every dawn (D-057), core refilled + 3–4 theme picks re-rolled; Anso restocks each Before day (engine rule)
  regionMarkup: z.number().positive().default(1),           // DESIGN §9.2 per merchant
  sellMult: z.number().positive().default(0.75),           // legacy 75 % (DESIGN §7.5)
  repFaction: FactionId.optional(),                        // tier_mod: Hostile refuses / Wary ×1.15 / Neutral ×1 / Trusted ×0.90 / Sworn ×0.80 (DESIGN §9.2); Kaelen uses the best tier
  refusesWhen: ConditionSchema.optional(),
  services: z.array(z.enum(['buy', 'sell', 'upgrade', 'cleanse', 'identify'])).default(['buy', 'sell']),
});

export const FactionSchema = z.object({
  id: FactionId, name: Text, shortName: Text, description: Text, color: z.string(),
  tierTexts: z.record(z.enum(['hostile', 'wary', 'neutral', 'trusted', 'sworn']), Text),
}).strict();
```

### 5.16 `GameConfig` (tunables, `config.ts`)

Defaults are DESIGN's numbers (D-066 #15); a value changes only after the DESIGN table it comes from changes.

```ts
export const GameConfigSchema = z.object({
  startLocationId: PId('loc_'),                               // 'loc_whispering_ruins'
  startItems: z.array(z.object({ itemId: ItemId, fromLoop: z.number().int().default(1) }).strict()),   // Amulet: on the neck from Loop 2 (D-047)
  clock: z.object({ baseLimitTicks: z.number().int().default(116), floorDawns: z.number().int().default(3),
                    warningsDawnsLeft: z.array(z.number().int()).default([10, 5, 2, 1]), expiryHordeDelay: z.number().int().default(3) }).strict(),   // DESIGN §10.1–10.2
  apexGate: ConditionSchema,                                  // D-048 exactly: { any: [{ counter: { name: 'quests_completed', min: 6 } }, { echo: 'echo_apex_resonance' }] }
  repTiers: z.object({ hostile: z.number(), wary: z.number(), neutral: z.number(), trusted: z.number(), sworn: z.number() }).strict(),  // ≤−40, −39..−10, −9..19, 20..59, ≥60 (D-014)
  tierPriceMult: z.object({ wary: z.number(), neutral: z.number(), trusted: z.number(), sworn: z.number() }).strict(),   // 1.15 / 1.0 / 0.90 / 0.80; hostile refuses (DESIGN §9.2)
  sellMult: z.number().default(0.75),
  rarityWeights: z.array(z.object({ minBand: z.number().int(), weights: z.record(Rarity, z.number()) }).strict()),   // 50/30/15/4/1; ≥9: 35/35/20/8/2; ≥13: 25/35/25/12/3 (DESIGN §7.2)
  rarityStatMult: z.record(Rarity, z.number()),               // 1.0/1.1/1.25/1.5/1.75
  upgradeCostMult: z.record(Rarity, z.number()),              // common→uncommon 0.5, →rare 1.0, →epic 1.5, →legendary 2.0 (DESIGN §8.3)
  xpToNext: z.array(z.number().int()).length(19),             // DESIGN §6.1 table (D-056): 100, 150, 220, 300, 400 … 3,660
  fodderXp: z.object({ a: z.number(), b: z.number(), c: z.number() }).strict(),   // round(20 + 8L + 1.2L²); elite ×1.8; anomaly ×1.3
  loopNudgePct: z.number().default(0.03), loopNudgeCap: z.number().int().default(5),   // DESIGN §6.6
  hitFloor: z.number().default(50), baseAccuracy: z.number().default(85), spellAccuracyBonus: z.number().default(10),
  critBase: z.number().default(5), critCap: z.number().default(60), critMult: z.number().default(1.5),
  guardValue: z.number().default(0.5), guardResource: z.number().default(5),
  flee: z.object({ base: z.number().default(40), perAgi: z.number().default(3), perEnemyAgi: z.number().default(2), min: z.number().default(10), max: z.number().default(90), perFail: z.number().default(15), scatterWatches: z.number().int().default(2) }).strict(),
  restShortPct: Pct.default(0.3), travelRegen: z.object({ hpPct: Pct.default(0.05), mpPct: Pct.default(0.1) }).strict(),
  returnEncounterChance: Pct.default(0.2),
  anomalyChance: z.object({ base: Pct.default(0.1), perLoop: Pct.default(0.05), cap: Pct.default(0.3) }).strict(),
  hordeDamagePctMaxHp: Pct.default(1 / 3),
  attunementEquipCap: z.number().int().default(5),
  corruptionMax: z.number().int().default(6),
  resonance: z.object({ location: z.number().int().default(2), bestiary: z.number().int().default(3), codex: z.number().int().default(1), quest: z.number().int().default(5), ending: z.number().int().default(50), closer: z.number().int().default(10) }).strict(),   // DESIGN §10.6, D-055
  companionCooldownByKind: z.record(z.string(), z.number().int()),   // attack 0, debuff/aoe/utility/buff 2, heal/shield/cleanse 3
}).strict();
```

### 5.17 Authoring example (one legacy location, to fix the style)

```ts
// src/content/regions/silverwood_ruins/locations.ts
import type { LocationInput } from '@schema/location';
export const locations = [
  {
    id: 'loc_whispering_ruins', regionId: 'region_silverwood_ruins', name: 'Whispering Ruins', legacyName: 'Whispering Ruins',
    description: 'The air smells of ozone and decay, and a chill wind carries faint whispers. Twisted trees reach into a twilight sky, their branches dotted with glowing crystals. Broken stone tablets litter the ground, etched with worn sigils.',
    descriptionVariants: [{ when: { loop: { min: 2 } }, text: 'The whispers are the same. The sky is the same. You have stood here before, and the stones know it.' }],
    exits: [
      { dir: 'north', to: 'loc_crumbling_archway' },
      { dir: 'east', to: 'loc_mistwood_path' },
      { dir: 'south', to: 'loc_sunken_archives' },
    ],
    items: [{ itemId: 'item_amulet_of_echoes', when: { loop: { max: 1 } } }],   // from Loop 2 it is already on the neck (D-047)
    npcs: ['npc_ilyra'],
    events: [{ id: 'ev_ruins_echo', text: 'A low, resonant hum vibrates under your skin, as if the stones are breathing.' }],
    art: { template: 'ruins', silhouettes: ['dead_tree', 'tablet', 'arch_broken'], particles: 'motes', timeOfDay: 'dusk' },
    rest: { kind: 'camp', text: 'You make camp beneath the twisted trees. The whispers keep you company.' },
    map: { x: 0, y: 6 },
    safe: true,
    tags: ['start', 'legacy', 'remnants'],
  },
] satisfies LocationInput[];
```

### 5.18 Table assembly

`src/content/regions/index.ts` imports every region folder and concatenates per table; `src/content/shared/*` supply the global tables; `src/content/index.ts` builds the pack:

```ts
export function buildContentPack(): ContentPack {
  const raw = { regions, locations, creatures, items, recipes, abilities, classes, statuses, quests, dialogues, npcs, companions, echoes, codex, achievements, attunements, modifiers, endings, merchants, affixes, factions, config };
  const parsed = parseTables(raw);            // zod parse each table → Record<id, X>; duplicate ids → error
  const index = buildIndex(parsed);
  const report = validateContent({ ...parsed, index, version: CONTENT_VERSION });
  if (report.errors.length) throw new ContentError(report);
  return { ...parsed, index, version: CONTENT_VERSION };
}
```

### 5.19 Cross-reference and semantic validation (`validateContent()`)

Returns `{ errors: Issue[]; warnings: Issue[] }` with `Issue = { table, id, path, message, rule }`. Errors fail the build; warnings print in `npm run validate` and are counted in REPORT.md.

**Referential integrity (errors)**

1. Every `Id` reference resolves: `exit.to`, `location.regionId`, `location.npcs[]`, `location.merchantId`, `encounter.groups[].creatureId`, `items[].itemId`, `creature.loot[].itemId`, every `pattern` step's `move` ⊂ the creature's `moves`, `phases[].adds[].creatureId`, `communion` question/answer/outcome ids, `item.requirements.classIds`, `recipe.inputs/output.itemId`, `ability.ownerId` ∈ classes ∪ companions, `ability.branch` ∈ owner branches, `ability.prerequisites`, `ability.statuses[].status`, `class.starterItems`, `class.startingAbilities`, `class.uniqueQuestId`, `quest.giverNpcId`, `quest.companionId`, `quest.stages[].next` targets ∈ stage ids, `quest.firstStage`, `quest.shortcuts[].skipTo`, `objective.hintLocationId`, `scene.npcId`, `node.next`/`choice.next` ∈ node ids or `'end'`, `scene.entry` nodes, `choice.echoHint`, `npc.homeLocationId`, `npc.merchantId`, `npc.companionId`, `companion.npcId`, `companion.abilities[]`, `companion.signature.abilityId` ∈ companion abilities, `companion.arcQuestIds`, `companion.campScenes`, `merchant.npcId`, `merchant.stock[].itemId`, `ending.achievementId`, `modifier.achievementId`, `region.wanderingPool[].creatureId`, `region.codexId`, `codex.related[]`, `echo.exclusiveWith[]`, `echo.requiredForEndings[]`, `attunement.effects[*].itemId/regionId`, every id's D-044 prefix (`content-literals` lint rule, 3.4).
2. Every id referenced *inside Conditions and Effects* (the canonical set of 4.9), recursively: `flag` (warning only; flags are free), `echo` (must be in STORY §12's catalog as loaded), `quest`+`stage`, `item`, `class`, `companion`, `loyalty.companion`, `location`, `killed.id`, `modifier`, `ending`, `unlockCodex`, `unlockRecipe`, `questStart/Advance/Fail`, `giveItem/takeItem`, `spawn.creature`, `teleport`, `unlockExit` from→to (the exit must exist on `from`, possibly `hidden`), `scatter.location`, `recruit/dismiss`, `startCombat`, `startDialogue`.
3. `special` values exist in the engine's `SPECIALS` list (`src/engine/combat/specials.ts`, owned by the combat unit). Content cannot import the engine, so the schema keeps a copy (`src/content/schema/specials.ts`); `tests/unit/content/specials.test.ts` asserts the two lists are equal.
4. Art keys (`silhouettes`, `focal`, `sigil.base/custom`, `art.icon`) exist in registries exported by `src/ui/art/registry.ts` — checked as **warnings** by a UI-side test (content must not import ui), so unknown keys fall back to defaults at runtime.
5. Ambient preset ids exist in `src/audio/ambient/registry.ts` — same mechanism as art (warning).

**Structural rules (errors)**

6. Duplicate ids within a table; ids not matching `Id`.
7. Exits: no exit to self; every non-`oneWay` exit has a reverse exit on the destination (warning if missing; error if the destination has *no* way back and is not tagged `one_way_ok`); directions unique per location.
8. Reachability: BFS from `config.startLocationId` over exits treating all `when` as satisfiable reaches every location whose region has no `unlockWhen` and that is not tagged `threshold`; Threshold locations are reachable from `still_shore`. Also a *Loop-1 reachability* pass with conditions evaluated against a synthetic Loop-1 state (loop = 1, no echoes) must reach every legacy location.
9. Quest graph: `firstStage` exists; every stage reachable from it; at least one terminal stage with `outcome: 'complete'`; no stage both `outcome` and `next`; branches' `when` not all `never`; `objectives` ids unique.
10. Dialogue graph: every node reachable from some entry; nodes without choices have `next`; no infinite `continue` cycles without a choice (cycle detection on `next` edges ignoring choice edges); `choice.hotkey` unique per node; speaker ids resolve to NPC/companion ids.
11. Creatures: `role: 'boss'` ⇒ `phases.length` 2–4 and `fleeable: false`; every phase's `pattern` non-empty; `hpBelow` triggers strictly decreasing across phases; `summon`/`adds` creatures resolve; regional bosses at band top + 2 (D-066 #21, warning); `level` within region band ± 2 wherever a non-boss is placed (warning).
12. Items: slot required for equipment types; `weaponType` only for weapons; `onUse` non-empty for consumables; value > 0 for sellable items; `rarityRule: 'rolled'` only for weapon/armor/trinket.
13. Abilities: per class exactly 3 branches × 5 tiers = 15 abilities (D-008); tier gates 1/4/8/12/16; `costHalf` 2 (T1–T4) or 4 (capstone); MP > 0 unless the ability is a resource converter (`wvr_blood_pact`); power or heal or shield or statuses or special non-empty; `itm_echo_bolt` exists and is granted by `item_amulet_of_echoes` (D-047).
14. Statuses: all 19 `CANONICAL_STATUSES` present (18 + `status_rested`); stackable ⇒ maxStacks > 1.
15. Endings: the six true endings and the two closers (`closer_escape`, `closer_fall`) are present; every true ending's `requirements` references at least one echo or flag; every ending id is the target of at least one `{ ending }` effect somewhere in content.
16. Echoes: every echo id appears in at least one `grantEcho` effect or `quest.rewards.echoes` (error), and in at least one condition or DESIGN §10.5 effect (warning: an Echo that gates nothing); `exclusiveWith` symmetric.
17. Codex: `body` ≤ 220 words; every entry either `unlockedAtStart`, has `unlockWhen`, or is the target of an `unlockCodex` effect (error otherwise: unreachable lore); voices distribution reported (warning if any voice < 10 % of entries).
18. Companions: 6 present (D-013), each with ≥ 3 `arcQuestIds` and at least two distinct terminal outcomes among those quests (warning until content lands, error at release gate `--strict`); each `abilities[]` has `ownerId` = companion id.
19. Modifiers: `REQUIRED_MODIFIERS` present. Attunements: exactly the 15 of DESIGN §10.7; `config.attunementEquipCap` = 5.
20. Merchants: every `merchantId` on a location has an NPC at that location with `roles` ⊇ `['merchant']`; stock items sellable; no quest-type items in stock.
21. Counts vs D-015/D-045/D-020 and the registry (reported, errors only with `--strict` at the release gate): locations = 73 (21 legacy + 52 new); quests = 44 (D-045, incl. the 6 legacy) + 5 class mini-quests (+ any built stretch quests); codex ≥ 85; echoes = STORY §12's catalog (101 after U9); creatures = 57 + 16 anomaly variants; items ≥ 120 (WORLD authors 157); achievements = 40; abilities = 75 class + 24 companion + 1 item; endings = 8 records (6 true + 2 closers).
22. Legacy preservation: the 21 legacy locations, 12 creatures, 26 items, 5 NPCs, 6 quests and 3 classes exist with their `legacyName`/`legacyId` set exactly as in Appendix A (D-001 "nothing renamed").

**Semantic rules proved by simulation (tests, section 8.2)**: quest completability, ending reachability, no soft-locks. The validator only checks structure; the sim proves dynamics.

---

## 6. UI architecture

### 6.1 Store: `useGame()` over `useSyncExternalStore` (no redux, no router)

One store instance per app, created in `main.tsx` with the content pack and the loaded profile. It owns the current `GameState`, the `Profile`, an event bus, and the shell (persistence). React subscribes through `useSyncExternalStore`; selectors keep re-renders scoped.

```ts
// src/ui/store/gameStore.ts
export interface GameStore {
  getState(): GameState;
  getProfile(): Profile;
  getContent(): ContentPack;
  getLegal(): Action[];                                   // memoized per state reference
  subscribe(listener: () => void): () => void;            // state or profile changed
  onEvents(listener: (events: GameEvent[], state: GameState) => void): () => void;
  dispatch(action: Action): GameEvent[];                  // step() → set state/profile → persist profile → autosave checkpoints → notify
  shell: {
    newGame(name: string, classId: string, seed?: string): void;
    save(slot: 1 | 2 | 3 | 'auto'): { ok: boolean; error?: string };
    load(slot: 1 | 2 | 3 | 'auto'): { ok: boolean; error?: string };
    listSlots(): (SaveSummary & { slot: 1 | 2 | 3 | 'auto'; savedAt: string })[];
    deleteSlot(slot: 1 | 2 | 3 | 'auto'): void;
    exportSave(): string; importSave(json: string): { ok: boolean; error?: string };
    exportProfile(): string; importProfile(json: string): { ok: boolean; error?: string };
    resetProfile(): void;
    updateSettings(patch: Partial<Settings>): void;        // writes profile.settings immediately (not an engine action)
  };
}
export function createGameStore(content: ContentPack, initialProfile: Profile): GameStore;

// src/ui/store/useGame.ts
export function useGame<T>(selector: (s: GameState) => T, isEqual?: (a: T, b: T) => boolean): T;
export function useProfile<T>(selector: (p: Profile) => T): T;
export function useContent(): ContentPack;
export function useDispatch(): (a: Action) => void;
export function useLegal(): Action[];
export function useIsLegal(action: Action): boolean;
export function useGameEvents(handler: (events: GameEvent[], state: GameState) => void): void;  // effect-scoped subscription (audio, toasts, announcer)
```

`dispatch` wraps `step`; when `step` emits `saveRequested` the store calls `shell.save`; when it emits `autosaveCheckpoint` and `settings.autosave` is on, the store writes the autosave slot (throttled to one write per checkpoint type per step). The store catches engine exceptions, logs them with the action and a state hash, shows a recoverable error toast ("The Breach stuttered — your last action was undone") and keeps the previous state; in dev it rethrows. Settings changes go directly to the profile (they are not gameplay) and mirror to `aethelgard.v1.settings.mirror`.

### 6.2 Routing by `state.mode`

```tsx
// src/ui/App.tsx
export function App() {
  const mode = useGame((s) => s.mode);
  return (
    <Shell>                                    {/* StatusBar, PanelHost, LiveRegion, Toasts, HotkeyHelp */}
      {mode === 'title' && <TitleScreen />}    {/* includes ClassSelect as a sub-view before the first dispatch of newGame */}
      {mode === 'explore' && <ExploreScreen />}
      {mode === 'combat' && <CombatScreen />}
      {mode === 'dialogue' && <DialogueScreen />}
      {mode === 'threshold' && <ThresholdScreen />}
      {mode === 'ending' && <EndingScreen />}
    </Shell>
  );
}
```

No router library: there is exactly one page and the game's own mode is the route. Panels (inventory, journal…) are overlay state local to `Shell` (`activePanel`), not engine state, so opening the inventory never changes `GameState` and never appears in a replay trace. Deep links are unnecessary, so there is no `404.html`; e2e builds additionally read `?scenario=` and `?gallery=` (4.13, 8.3).

### 6.3 Screen components (mapping to DESIGN.md screens)

| Mode / overlay | Component | Children (in `src/ui/components` unless noted) |
|---|---|---|
| title | `TitleScreen` | `TitleArt` (art/focal), menu: New Game / Continue (autosave) / Load / Settings / Lore (codex `history` entries unlocked at start) / Credits ("a game by Tim Dibert") |
| title → class | `ClassSelectScreen` | `ClassCard` ×5 (sigil, fantasy, branches, resource rule, mastery badge from profile), `NameInput`, seed field (advanced, collapsed) |
| explore | `ExploreScreen` | `SceneHeader` (region + location name, day/watch, Breach Clock from Loop 2), `art/Scene`, `LocationText` (description + variants + fired events), `NpcRow`, `ItemRow`, `ExitBar` (buttons with dir + destination, locked state + lockedText, danger tint when infected), `ActionBar` (Rest / Talk / Take all / Merchant / Craft / Interact / Wait / Enter portal — only legal ones enabled), `LogPanel` (aria-live), `CompanionChip`, `MapPanel` (docked on desktop ≥ 1100px, overlay otherwise) |
| combat | `CombatScreen` | `EnemyRow` → `EnemyCard` (sigil, hp bar, statuses, `IntentBadge` with move name, projected range, target arrow, "?" when hidden, phase segments for bosses, target selection), `CommunionBar` (Speak/Listen/Offer/Resist, Resolve pips 0–8, Movement and question count; DESIGN §4.11), `PartyRow` → `PartyCard` (player, companion with stance selector), `TurnOrderStrip`, `AbilityBar` (basic attack, abilities grouped by branch with cost/cooldown, Guard, Item, Flee, Companion command), `TargetPicker` (modal when an ability needs a target and more than one is valid), `CombatLog` |
| dialogue | `DialogueScreen` | `SpeakerPortrait` (npc sigil, mood), `DialogueText` (typewriter unless reduced motion), `ChoiceList` (numbered, Echo sigil on `echoHint`, disabled with `disabledText`), `CompanionReaction` toast |
| threshold | `ThresholdScreen` | tabs/areas `StillShore` (run summary: `RunSummary`, Echoes gained, Resonance earned), `GalleryOfLoops` (run history table, achievements, endings seen with eligibility hints via `explain()`), `Loom` (attunement grid: owned / equipped / cost, buy/refund, five equip slots), `FarLight` (class picker reuse, modifier toggles, "Step into the light" → `newLoop`); Dask conversation hooks via `DialogueScreen` overlay |
| ending | `EndingScreen` | `EndingSlides` (sequence, Space/Enter/click to advance, skip after first), `Epilogues` (cards), `Credits`, actions: Continue (Loop 1 closers → Loop 2 Day 1; otherwise → Threshold) / New Game+ (after a true ending, at the Threshold) / Return to title; `RunSummary` |
| panels | `PanelHost` + `InventoryPanel`, `EquipmentPanel`, `AbilitiesPanel` (3-branch tree, unlock with points, mastery discount shown), `QuestJournalPanel` (active/completed/failed, stage journal, objectives with ✓, map hint), `CodexPanel` (categories, voice tag, locked entries as "???" with hint), `BestiaryPanel` (seen/killed, known weaknesses, intents seen), `TimelinePanel` (Loop Timeline: loops × Echoes × key choices), `SettingsPanel` (D-035 toggles, volumes, autosave, export/import profile), `SavesPanel` (3 slots + autosave: save/load/delete/export/import, summaries), `MerchantPanel` (buy/sell tabs, rep tier pricing, restock day), `CraftingPanel` (station recipes, inputs owned/needed, upgrade tab at forge), `CompanionPanel` (loyalty, stance, signature, swap at rest), `MapPanel` (SVG graph: nodes by `map.x/y`, edges from exits, states: current / visited / remembered (greyed, from profile) / infected / quest hint), `HelpPanel` (hotkeys per screen) |

All panels are reachable in every mode where they make sense (`legalPanels(mode)`): in combat only Inventory (read-only), Bestiary, Help, Settings; in dialogue only Help/Settings; in title only Settings/Saves/Codex.

### 6.4 Art component API (`src/ui/art`)

```tsx
export interface SceneProps { location: Location; region: Region; state: { horde: boolean; heartstone: WorldState['heartstone']; watch: Watch; loop: number }; reducedMotion: boolean; seed: string; className?: string }
export function Scene(props: SceneProps): JSX.Element;               // <svg viewBox="0 0 1200 500" role="img" aria-label={location.name}> layers: Sky → Horizon → Silhouettes → Focal → Particles → Weather
export function CreatureSigil(props: { creatureId: string; size: 'sm' | 'md' | 'lg'; state?: 'idle' | 'telegraph' | 'hit' | 'ko'; reducedMotion?: boolean }): JSX.Element;
export function NpcSigil(props: { npcId: string; mood?: string; size?: 'sm' | 'md' }): JSX.Element;
export function Icon(props: { kind: IconKind; size?: number; title?: string }): JSX.Element;   // IconKind: 'hp' | 'mp' | 'gold' | 'day' | 'clock' | 'echo' | 'resonance' | damage types | status ids | item icons | ui glyphs
export function RegionPalette(props: { regionId: string; children: ReactNode }): JSX.Element;   // sets --region-bg/--region-fg/--region-accent/--region-glow on a wrapper
export const ART_REGISTRY: { silhouettes: string[]; focal: string[]; sigilBases: string[]; icons: string[] };   // validated against content (5.19 rule 4)
```

Rules: all SVG is inline React; no `<img>`, no data URIs over 2 kB (keeps bundle ≤ 600 kB; measured by a build-size test). Deterministic placement uses `uiRng(seed)` (a second xoshiro instance in `src/ui/art/uiRng.ts`, never the engine's). Animation uses CSS `@keyframes` with `prefers-reduced-motion` and the `reducedMotion` prop both disabling it (D-035). Each template exposes 3–5 parameters (horizon, density, hue shift, fog) so 73 locations look distinct from ~20 templates; hand-authored focal pieces for: Heartstone (4 states), the Tyrant (phases), the portal, the Threshold shore, the Breach-door, the Emberforge anvil, Silverwood Before skyline, the Loom.

### 6.5 Audio engine API (`src/audio`)

```ts
export type Bus = 'master' | 'ambient' | 'sfx' | 'music';
export interface AudioEngine {
  /** Create the AudioContext on the first user gesture; safe to call repeatedly. */
  unlock(): Promise<boolean>;
  isUnlocked(): boolean;
  play(sfx: SfxId, opts?: { velocity?: number; pan?: number }): void;
  setAmbient(presetId: string | null, opts?: { crossfadeMs?: number }): void;     // region drones; null = silence
  setTheme(theme: 'tyrant' | 'threshold' | 'ending' | null): void;                // layered over ambient
  pulse(kind: 'clock_warning' | 'heartstone' | 'low_hp'): void;                    // the "pulse" D-035 disables under reduced motion
  setVolume(bus: Bus, value: number): void;                                        // 0..1, persisted via settings
  setMuted(muted: boolean): void;
  setReducedMotion(on: boolean): void;                                             // disables pulse/LFO wobble, keeps discrete sfx
  suspend(): void; resume(): void;                                                 // page visibility
  dispose(): void;
}
export function createAudioEngine(): AudioEngine;
// src/audio/map.ts
export function eventsToSfx(events: GameEvent[]): { sfx: SfxId; velocity?: number }[];   // pure mapping; e.g. damageDealt(fire) → a `sfx_*` id from DESIGN §18.3 (D-044 prefix); clockWarning → pulse
export const SFX_IDS = [...] as const;   // the 30 `sfx_*` ids of DESIGN §18.3 / REGISTRY §21  export const AMBIENT_REGISTRY = [...] as const;
```

Wiring: `useGameEvents` in `Shell` → `eventsToSfx` → `audio.play`; `locationEntered` → `setAmbient(region.ambient)`; `combatStarted` with a boss → `setTheme('tyrant')`; `modeChanged` to threshold → `setTheme('threshold')`. The engine never knows audio exists. All synthesis is procedural (oscillators, noise, biquad filters, envelopes) — zero audio files (D-036). A `tests/unit/ui/audio.map.test.ts` asserts every `GameEvent` type is either mapped or explicitly listed as silent.

### 6.6 Keyboard: one `useHotkeys` with a per-screen map

```ts
export type HotkeyMap = Record<string, { run: () => void; label: string; when?: () => boolean }>;   // keys: 'i', 'shift+i', 'arrowup', '1'..'9', 'escape', '?', 'space', 'enter'
export function useHotkeys(map: HotkeyMap, opts?: { enabled?: boolean; scope?: string }): void;
```

The maps implement **DESIGN §16.4** (D-035, D-066 #13). Global (Shell, outside combat): `I` inventory, `Q` quests, `C` codex, `B` bestiary, `M` map, `L` timeline, `H` HUD detail, `Esc` close panel / back, `?` keybind overlay, `Ctrl+S` save to autosave slot, `Ctrl+L` opens Saves panel (never auto-loads). Explore: `WASD`/arrows = exits by `dir` on the map (WASD works **only** on the map), `T` talk, `R` rest (`Shift+R` full rest), `E` take all, `1–9` ActionBar items in displayed order. Lists (inventory, journal, merchant) use arrows only; `Delete` drops the selected item after a confirm dialog; `Tab` switches merchant Buy/Sell. Combat: `1` basic attack, `2–9` abilities in displayed order, `G` guard, `I` item, `C` companion command, `F` flee, `Tab` cycle target, `Enter` confirm target, `Space` log; **panel hotkeys need Shift while a fight is on screen** (`Shift+I`, `Shift+C`, `Shift+B`, `Shift+M`, `Shift+Q`, `Shift+L`). Dialogue: `1–9` choices, `Space/Enter` continue. Threshold/Ending: `Space/Enter` advance, `1–4` areas. Hotkeys are disabled while a text input has focus; the `HelpPanel` renders from the active maps (single source of truth). Numbers are generated from displayed order and the UI stores the mapping so screen readers announce "1: Echo Bolt, 10 mana".

### 6.7 Accessibility — acceptance criteria (D-035)

- Every interactive element is a `<button>`, `<a>`, or input; none are `div onClick`. Tab order follows visual order; focus is trapped inside open panels (`useFocusTrap`) and restored on close.
- Visible focus ring: `:focus-visible` outline ≥ 2 px, contrast ≥ 3:1 against both light and dark surfaces (tokens `--focus-ring`).
- All text ≥ 4.5:1 contrast in the default theme; high-contrast theme ≥ 7:1 and removes translucent overlays; verified by the in-repo token test (`tools/a11y/contrast.ts`) that computes contrast for every `--text-*`/`--surface-*` pair in both themes (axe-core is unavailable, D-065).
- Text scale 1 / 1.25 / 1.5 via `html { font-size }`; layouts must not overflow horizontally at 1.5 on 390 px (Playwright asserts `scrollWidth <= clientWidth`).
- `prefers-reduced-motion` or the setting: no CSS animations, no typewriter, no audio pulse; transitions ≤ 100 ms.
- Log and combat log: `aria-live="polite"` region (`LiveRegion`) receives one concatenated sentence per step (not per event) to avoid chatter; combat damage is announced as "You hit the Corrupted Shade for 12. It readies a claw strike at you for 8."
- Images: every `Scene`/sigil `<svg role="img" aria-label>`; decorative layers `aria-hidden`.
- Touch targets ≥ 44 × 44 px (CSS `min-height: 44px` on `.btn` under the mobile breakpoint, asserted by Playwright bounding-box checks on the ActionBar and AbilityBar).
- Color is never the only signal: statuses have icon + text, intents have text, factions have names.
- `lang="en"`, page `<title>` updates with mode and location (screen reader context).

### 6.8 Mobile layout (CSS grid + container queries; bottom tab bar under 760 px)

Desktop (≥ 760 px) explore grid: `"scene scene map" / "text text map" / "actions actions log"` with the map column collapsing under 1100 px. Combat grid: enemies top, party middle, abilities bottom, log right column (desktop) or as a tab (mobile). Under 760 px every screen is single-column; the `BottomTabBar` (Scene · Actions · Log · Map · Menu) switches which region is visible so no screen needs vertical scrolling beyond one section; the tab bar is `position: sticky; bottom: 0` with `env(safe-area-inset-bottom)` padding; `100dvh` for the root. Component-level responsiveness uses `@container` queries on panel roots so the same `AbilityBar` reflows to two rows inside a narrow container. Breakpoint and tab bar presence are the only viewport-dependent behaviors; Playwright's `mobile-chromium` project asserts the tab bar exists and that each tab reveals its region.

---

## 7. Simulation harness (`src/sim`)

Headless. Imports `@engine` and `@content` only. Runs under **bun** (`bun src/sim/cli.ts`, D-065); the same code runs in the browser for the replay test (no runtime-specific APIs outside `batch.ts`/`worker.ts`/`cli.ts`; workers use `node:worker_threads`, which bun implements).

### 7.1 Bot interface

```ts
export interface BotMemory { [key: string]: unknown }     // per-run scratch (bots type their own view)
export interface BotContext { profile: Profile; rngSeed: string; step: number; recentEvents: GameEvent[] }
export interface Bot {
  readonly name: string;
  init?(seed: string): BotMemory;
  choose(state: GameState, legal: Action[], content: ContentPack, memory: BotMemory, ctx: BotContext): Action;
  /** Optional: which class this bot prefers when the runner picks 'auto'. */
  preferredClasses?: string[];
}
```

Bots are deterministic: any randomness they need comes from their own `Rng` seeded from `ctx.rngSeed` (never `Math.random`; `tools/lint.ts` applies the `engine-purity` ban on `Math.random`/`Date.now` to `src/sim/bots/**` too). Bots may only return actions from `legal`; the runner asserts this and counts a violation as a bot bug (`errors[]`).

Shared helpers (`bots/shared.ts`): `bfsPath(state, content, from, to, { allowLocked })`, `nearestUnvisited(state, content, filter)`, `scoreEquipment(item, classId)`, `healthFraction`, `bestAffordableAbility(state, content, filter)`, `enemyWeakness(creature)`, `questHints(state, content)` (stage `hintLocationId`s), `canReachApex(state, content)`.

### 7.2 The six bots

**melee** (classes: ranger, warden; Steel/Breaker branches)
- Combat: if hp < 30 % and a healing consumable exists → `item`; else if hp < 25 % and no heal → `guard`; else highest `power.base + scale·stat` affordable physical ability off cooldown, else `attack`. Target: lowest-hp enemy, or the one with `weak` to physical. Never flees unless a companion is KO and hp < 20 % and `canFlee`.
- Explore: BFS to the nearest location with an active quest hint; if none, nearest unvisited location whose level band ≤ player level + 2; otherwise toward the Apex when `canReachApex`. Takes all items; equips when `scoreEquipment` improves; rests at the nearest rest location when hp < 50 % or mp < 30 %.
- Talks to every NPC with an available scene on first meeting; chooses dialogue options by priority: `questStart` effects > rep gains for Ironclad > first option. Accepts every quest.
- Spends stat points on STR; unlocks the cheapest Steel/Breaker ability it qualifies for.
- Economy: sells `material`/duplicate gear when gold < 20; buys healing consumables up to 3 when gold ≥ 40; upgrades the weapon at the forge when gold ≥ cost + 30.
- Heartstone: *destroy* (Ironclad lean) **only when the day at the Heartstone ≤ 10**, otherwise stabilize (a later Destroy makes a thorough Loop 1 miss the Apex, WORLD §10.8; REVIEW-DESIGN-PLAN F20). Tyrant: fights. Portal: enters when legal. Loop 2+: same policy; never communes. Threshold: buys the cheapest attunement until Resonance < 10, equips up to 5; keeps class.

**caster** (classes: wizard, weaver; Pyre/Storm or Hex/Drain)
- Combat: prefers the damage type the target is `weak` to and never one it is `immune` to; applies `soaked` then storm when the combo is available; uses `hex`/`weaken` on bosses first; keeps mp ≥ cost of one attack spell, else `attack`/`guard`; heals at hp < 35 %. Weaver: uses `bloodPrice` abilities only when hp > 60 %.
- Explore like melee but prefers the Shadow Weavers' / Remnants' quest hints; reads Dark Spellbooks up to corruption 4 (never 6).
- Stats → MAG; buys Mana Bloom/Chronal Dust; Heartstone: *exploit*; Echo Crystal: keep. Loop 2+: `commune` with every held answer Echo (Speak > Listen > Offer), spares the Tyrant if Resolve ≥ 3 at the end of Movement III, else fights.

**explorer**
- Goal: visit every reachable location before day 26, then the Apex. Always picks the nearest unvisited location; backtracks via BFS; opens every panel-equivalent action (`examine` each item/NPC once; `readBook`; `interact` every event). Talks every NPC on every visit until no new scene appears. Fights like melee (class auto: ranger/elf) but flees from encounters ≥ level + 4.
- Rests whenever at a rest location with hp < 70 %. Takes every exit including hidden ones once discovered. Heartstone: stabilize. Picks dialogue choices it has never taken (`choicesTaken` memory across the run) to maximize scene coverage.

**speedrunner**
- Goal: minimal days to the Apex and a loop end. Precomputes the shortest path through unlocked exits; uses Echo shortcuts and `reveal`ed routes (Breach-door) when available; flees every fleeable fight; fights only gate encounters (bosses, `once` encounters blocking a quest needed for `apexUnlock`). Completes exactly the quests required by `config.apexGate` (D-048) choosing the shortest by hint distance. Uses no rests unless hp < 25 %. Loop 2+: targets the ending with the fewest unmet requirement parts (via `explain()`) — this yields the "fewest loops to each ending" metric.

**pacifist**
- Never `attack`/`ability` (damage) unless `canFlee` is false and no `guard` would survive (estimated from telegraphed intent numbers); uses `guard`, `item`, companion commands; flees at first opportunity. Progresses only quests whose objectives contain no `killed` condition; XP from discovery/quests; chooses Pacifist's Vow in loop 2+ when available. Fled fixed groups scatter (DESIGN §4.7), so every location stays reachable. Heartstone: stabilize; Tyrant: commune → spare; targets endings F then A then E. Measures: which quests are completable without kills (reported in BALANCE.md).

**random**
- Uniform over `legal` with weights: `drop` 0.1, `sell` 0.3, `save` 0, `load` 0, `returnToTitle` 0, `newGame` 0 (shell actions excluded), `flee` 0.3, everything else 1. Baseline for soft-lock and crash detection; its coverage numbers calibrate the others.

**pathBot** (scripted; 7.8) is the seventh, used for proofs, not statistics.

### 7.3 Runner

```ts
export interface RunConfig {
  seed: string; classId: string | 'auto'; bot: Bot;
  maxSteps?: number;             // default 6000
  maxLoops?: number;             // default 3 (stop at the Threshold of loop maxLoops)
  stopAt?: 'loop_end' | 'ending' | 'max_steps';   // default 'ending' with maxLoops as the cap
  profile?: Profile;             // carried across runs for multi-loop knowledge (default: fresh)
  modifiers?: string[];
  record?: boolean;              // keep the full action trace (memory!)
  scenario?: ScenarioId;         // start from loadScenario(id) instead of newGame (4.13): Tyrant L11/L13 sims, communion
}
export interface FightRecord { encounterId: string; regionId: string; playerLevel: number; rounds: number; result: 'victory' | 'defeat' | 'fled'; damageTaken: number; enemies: string[]; boss: boolean }
export interface LoopRecord { loop: number; classId: string; daysUsed: number; outcome: string; reason?: string; level: number; questsCompleted: string[]; echoesGained: string[]; heartstone: string; tyrant: string }
export interface RunResult {
  seed: string; classId: string; bot: string; steps: number; durationMs: number;
  loops: LoopRecord[]; endings: string[]; closers: string[]; deaths: number;
  damageBySource: Record<string, number>; abilitiesUsed: Record<string, number>; itemsCrafted: number;
  questsCompleted: string[]; questsStarted: string[]; questsFailed: string[];
  locationsVisited: string[]; creaturesKilled: Record<string, number>; creaturesSeen: string[]; itemsObtained: string[];
  codexUnlocked: string[]; achievements: string[]; echoes: string[];
  fights: FightRecord[];
  softLock: { detected: boolean; step?: number; signature?: string; lastActions?: Action[]; locationId?: string; mode?: Mode } ;
  errors: { step: number; message: string; stack?: string; action?: Action; stateHash?: string }[];
  rejected: number;              // actionRejected count (bot/legal mismatch indicator)
  finalStateHash: string;
  trace?: Action[];
}
export function runLoop(cfg: RunConfig, content: ContentPack): RunResult;
```

The runner loop: `legal = legalActions(state, content, profile)`; if `legal.length === 0 && mode !== 'ending'` → hard lock error; `action = bot.choose(...)`; assert `legal` contains a structurally equal action; `{ state, profile, events } = step(...)`; feed `events` to metrics; update soft-lock detector; stop on `endingReached`/`loopEnded` per `stopAt`. Exceptions from `step` are caught, recorded with `stateHash` and the last 20 actions, and end the run (an engine exception is always a release blocker).

### 7.4 Batch runner (worker_threads) and determinism check

```ts
export interface BatchConfig { seeds: number | string[]; classes: string[] | 'all'; bots: string[] | 'all'; workers?: number; maxSteps?: number; maxLoops?: number; modifiers?: string[]; out?: string }
export interface BatchResult { config: BatchConfig; results: RunResult[]; startedAt: string; durationMs: number; contentVersion: string; gitSha: string }
export async function runBatch(cfg: BatchConfig): Promise<BatchResult>;   // Promise.all over a worker pool; each worker builds its own ContentPack once
```

`worker.ts` receives `{ seed, classId, botName, …}` messages and returns `RunResult` without the trace (traces are kept only for failures: on error or soft-lock the worker re-runs the same seed with `record: true` and attaches the trace, which is deterministic by construction). Seeds are `${batchSeed}:${i}` strings. Worker count defaults to `os.availableParallelism() - 1`. Budget (re-measured for `structuredClone`, D-065): expect 150–300 µs/step; 2,000 runs × ≤ 6,000 steps × 300 µs ≈ 60 CPU-minutes, ≈ 7.5 minutes on 8 workers — inside the 10-minute CI budget. `tests/unit/engine/perf.test.ts` fails if the median step on the fixture pack exceeds 400 µs.

Determinism: the batch re-runs 200 sampled seeds with `record: true` (traces held in memory, never committed) through `step` and compares `finalStateHash` (`hash.ts`: FNV-1a over a canonical JSON with sorted keys); any mismatch is a release blocker. The Playwright `replay.spec.ts` replays the committed **fixture-pack** traces (`tests/fixtures/traces/*.json`, the only recorded traces in the repo, D-066 #18) in the e2e build and compares hashes, proving bun/browser parity (guards against `Math.imul`/sort-stability assumptions).

### 7.5 Metrics schema (`metrics.ts`)

```ts
export interface Metrics {
  runs: number; byClassBot: Record<string, { runs: number; loop1EscapeRate: number; loop1ExpiryRate: number; loop1FallenRate: number; endings: Record<string, number>; medianDaysLoop1: number; p90Days: number; deaths: number; medianLevelAtApex: number; abilityActionShare: number; zeroMpFightShare: number }>;
  damageShareByClass: Record<string, Record<string, number>>;   // class → source → share of total (flag > 0.35)
  regionCurve: { regionId: string; levelBand: [number, number]; fights: number; medianRounds: number; deathRate: number; fleeRate: number; avgDamageTakenPerRound: number }[];
  bossStats: Record<string, { fights: number; winRate: number; medianRounds: number; phaseReached: Record<number, number> }>;
  coverage: Coverage;
  softLocks: RunResult['softLock'][]; errors: RunResult['errors'];
  economy: { medianGoldAtApex: number; purchases: Record<string, number>; craftsByRecipe: Record<string, number>; upgradesByRarity: Record<string, number> };
  quests: Record<string, { started: number; completed: number; failed: number; medianDaysToComplete: number; completedByBots: string[] }>;
  echoes: Record<string, { gained: number; firstLoopGained: number }>;
  companions: Record<string, { recruited: number; kos: number; deaths: number; avgLoyalty: number }>;
  targets: { row: number; name: string; pass: boolean; value: number; threshold: string; detail?: string }[];   // one per DESIGN §19 row (the single target table), plus the 1.2 gates
}
```

### 7.6 Soft-lock detector (`softlock.ts`)

Progress signature per step = hash of `(mode, world.currentLocationId, clock.ticks, before?.day, quest stages, inventory itemId multiset, player.hp, player.level, Object.keys(flags).length, combat?.round, dialogue?.nodeId, echoesThisLoop.length)`. Detector rules:

1. **Stall**: identical signature for K consecutive accepted steps (K = 60 for policy bots, matching DESIGN §19 #7; 200 for `random`, which legitimately dithers) → soft-lock.
2. **Hard lock**: `legalActions` empty while `mode !== 'ending'`, or only `returnToTitle`/`save` legal in `explore` → immediate.
3. **Day stuck**: the derived day unchanged for 400 non-combat steps with no quest stage change → soft-lock (catches "can travel but nothing ever changes" at zero-watch exits). Steps inside Silverwood Before (frozen clock), at the Threshold and in dialogue are excluded from the count.
4. **Combat stall**: combat round > 60 → soft-lock (immortal enemy / zero-damage loop).
5. **Rejected storm**: > 30 `actionRejected` in a window of 50 → bot/legal mismatch (reported as an error, not a soft-lock).

Each detection stores the signature, location, mode, the last 20 actions and the trace (re-run with recording) for triage in `docs/BALANCE.md` → "Blockers".

### 7.7 Coverage report (`coverage.ts`)

```ts
export interface Coverage {
  quests: { total: number; completed: string[]; neverStarted: string[]; startedNeverCompleted: string[] };
  locations: { total: number; visited: string[]; never: string[] };
  endings: { total: number; reached: string[]; never: string[] };
  creatures: { total: number; seen: string[]; killed: string[]; neverSeen: string[] };
  items: { total: number; obtained: string[]; never: string[] };
  echoes: { total: number; gained: string[]; never: string[] };
  codex: { total: number; unlocked: string[]; never: string[] };
  abilities: { total: number; used: string[]; neverUsed: string[] };
  dialogueChoices: { total: number; taken: string[]; never: string[] };
}
```

The "never" lists are the content team's punch list: each entry must either be reached in the next batch or justified in BALANCE.md (e.g., a secret requiring a specific pathBot).

### 7.8 Scripted bots: `pathBot` proofs for endings and quests

```ts
export type ScriptStep =
  | Action                                                           // exact action
  | { goto: string }                                                 // BFS travel to a location (fights with `fight` policy on the way)
  | { fight: 'melee' | 'caster' | 'flee' }                           // policy for encounters until combat ends
  | { talk: string; pick: string[] }                                 // talk to npc, take these choice ids in order (continue otherwise)
  | { until: Condition; do: Bot | 'explorer' | 'melee'; maxSteps?: number }   // delegate until condition holds
  | { assert: Condition; message: string }                           // proof checkpoint
  | { rest: number }                                                 // rest N times
  | { loopEnd: 'portal' | 'clock' | 'death' };                       // drive the loop to its end by that route
export function pathBot(script: ScriptStep[]): Bot;
export interface EndingScript { endingId: string; classId: string; loops: ScriptStep[][]; seed: string }   // one script per loop
```

`src/sim/scripts/endings/*.ts` hold one `EndingScript` per ending (A–F plus `closer_escape`, `closer_fall`). Long prefixes start from `loadScenario` (4.13) where the proof is about the ending, not the route. `npm run sim:endings` runs each and asserts `endingReached` matches; `tests/unit/content/endings.reachable.test.ts` runs them in CI (budget ≤ 60 s total). Each quest also gets a minimal proof: `scripts/quests.ts` maps `questId → ScriptStep[]` for quests the policy bots do not complete organically (the batch coverage decides which ones need a script; the test asserts the union of batch + scripts completes 100 %). Scripts reference content ids only (no indices), so they survive text edits; when content restructures a quest, the unit that changes it updates the script in the same commit.

### 7.9 `docs/BALANCE.md` generator (`report.ts`, `tools/gen-balance.ts`)

Produces a Markdown report with: header (date, git SHA, content version, batch config, duration), **Targets** table (every DESIGN §19 row and every 1.2 gate: pass/fail, value, threshold), **Completion** by class × bot, **Days used** distribution per loop, **Damage share** per class (top 10 sources, flag > 35 %), **Region curve** table and an ASCII/Mermaid bar chart of median rounds and death rate ordered by level band, **Bosses** (phase reach, win rate), **Economy**, **Quests** (completion, median days, which bots), **Echoes** (gain rates), **Companions**, **Coverage** (with "never" lists), **Blockers** (soft-locks and errors with seed, class, bot, last actions, reproduction command `npm run sim:replay -- --seed … --bot … --class …`), and **Recommendations** (auto-generated hints: "ability X over 35 % for wizard — reduce scale or raise cooldown"). The report is regenerated by `npm run sim:balance` and committed; its Targets section is what the release gate reads.

---

## 8. Testing plan

Test files mirror source paths: `src/engine/combat/damage.ts` → `tests/unit/engine/combat/damage.test.ts`. Engine tests use a **fixture pack** (`tests/fixtures/miniContent.ts`: 2 regions, 6 locations, 4 creatures incl. one 3-phase boss, 12 items, 2 classes with 6 abilities, all 19 statuses, 3 quests, 2 scenes, 2 endings, a communion spec) so engine tests never break when real content changes; content tests use the real pack. A `makeState(overrides)` builder and `play(state, actions[])` helper (runs `step` sequentially, asserting no `actionRejected` unless expected) keep tests short.

### 8.1 Engine unit test matrix

| Area | File(s) | Cases (minimum) |
|---|---|---|
| RNG | `rng.test.ts` | golden vectors for `seedFromString`, xoshiro reference outputs, `int` bounds inclusive over 10k draws, `chance(0)`/`chance(1)` never draw, `shuffle` is a permutation, `fork` independence, state round-trip through JSON |
| step contract | `step.test.ts` | purity (inputs deep-equal before/after; outputs deep-frozen under `__DEV__`; profile not cloned when untouched), illegal action → same references + `actionRejected`, `stepCount` increments only on accept, rng advances only on accept, events order stable |
| legalActions | `legalActions.test.ts` | for 300 states sampled from recorded traces: every legal action accepted; 200 generated illegal actions (bad ids, wrong mode) rejected; deterministic order; `isLegal` ≡ membership |
| newRun | `newRun.test.ts` | Loop 1 starts at `loc_whispering_ruins`, tick 0, class base stats (DESIGN §3.3) and starter items, Amulet on the neck from Loop 2 (D-047), equipped attunements applied, modifiers applied (Frayed Clock → 80 ticks), mastery halves half-point costs, map memory greyed, reputation reset |
| damage pipeline | `combat/damage.test.ts` | DESIGN §4.3's eleven steps in order: base + coef·ATK/SP, variance bounds, crit, resistance (immune → 0), interplay, status modifiers, flat armor/ward, Guard, Shield, min 1 / max hpMax; Rewind-cap on bosses; DoT ticks take resistance only; Glass ×2 both ways; DESIGN §4.12 worked example reproduced number-for-number |
| statuses (18 + rested) | `combat/statuses.test.ts` | one `describe` per canonical status (DESIGN §4.5 table): apply/stack cap/duration/expiry; **a status applied during its holder's own turn skips that turn's decrement** (D-066 #4); Burn tick `1 + 0.2·SP`; Rewind removed by Void or Ley; out-of-combat Poison/Bleed/Curse tick per watch and clear on rest |
| interplay | `combat/interplay.test.ts` | table-driven over DESIGN §4.6's 18 rows; non-matching pairs unchanged (the earlier draft's fire×bleed and physical×shock rules do not exist) |
| intents | `combat/intents.test.ts` | ordered pattern pointer advances one step per turn and wraps; `CombatWhen` (`everyNth`, `first`, `oncePerFight`, `allyPresent`, `hpBelow`, `roundAtLeast`) evaluated at generation only; generation = commitment (projected range, hidden chip); stun/interrupt skip the step; Taunt retargets; wind-up moves; `summon` respects `max` |
| boss phases | `combat/phases.test.ts` | `enterWhen` OR-lists (hpBelow, round counted in rounds, event); `countSolo` adds; `tyr_remember` once per phase; pattern swap; phases never go backwards; `bossPhase` event once per phase; the fixture Tyrant fight runs to completion with a scripted player |
| turn order & flee & guard | `combat/turnOrder.test.ts`, `flee.test.ts` | initiative AGI + d4 rolled once, re-sorted each round, ties player → companion → slot; flee formula (+15 per failure), bosses/story gates unfleeable, `scatter` (+2 watches, no XP/loot, node passable), `previous`, `hold` + `encounterHp` until dawn; Guard 50 % (Warden 65 %) and +5 resource (Warden +8) |
| companion AI | `combat/companionAi.test.ts` | DESIGN §4.9 `companionAct` per stance with cooldown readiness (no MP); signature costs the player's action (D-053); KO handling; Dask leaves on unflagged nodes and returns on flagged/infected ones (D-059) |
| xp/levels/resources | `progression.test.ts` | DESIGN §6.1 table values, multi-level-up from one grant, level-up refills, class growth, per-class resource rules (Ranger 8/12/5, Wizard `3 + ⌊L/4⌋`, Elf 10/6/5, Warden 6/8/4, Weaver Blood price), self-cost availability ("Not enough blood"), tier gates, half-point costs and mastery |
| inventory/equipment | `reducers/inventory.test.ts` | stacking, maxStack, take/drop/takeAll, equip/unequip slots incl. two trinkets, class requirements, derived stats update, boundQuest items undroppable, `readBook` corruption 0→6 with HP cost and Weaver mark at 6 |
| crafting/upgrade | `reducers/crafting.test.ts` | recipe inputs consumed (incl. `anyOf` fragment), Ironclad tier gate and the Neutral override while `q_the_mending`/`q_iron_silence` is active, story recipes cost 0, upgrade cost by rarity with materials (DESIGN §8.3), affix slot added on tier-up, Legendary not upgradeable, salvage yields, Heartstone choice gives 2 fragments |
| economy | `reducers/economy.test.ts` | buy price = value × markup × tier_mod × (1 − ledger) (DESIGN §9.2), Hostile refuses, Kaelen best tier, sell 75 %, restock at every dawn (D-057), buy-back until dawn, `rollStock` deterministic by seed |
| clock/rest/travel | `reducers/loop.test.ts` | ticks arithmetic, 2-watch edges, short vs full rest, warnings at 10/5/2/1 dawns left, `clockWatches` floor (current day + 3 dawns), Heartstone ±24/−20/−40 watches, Frayed Clock halving, expiry → Horde with 3-move delay and Library portal (immediate vs after combat), Ending E `daysLeft ≤ 1` |
| horde | `reducers/horde.test.ts` | Tyrant defeat and clock expiry both start the Horde at the Apex (expiry with a 3-move delay), spread per move with the Mistwood→Plaza delay, infected entry damage = ⅓ hpMax, Ilyra at the Library portal, Brak removed from camp, portal → `closer_escape`, death → `closer_fall` (`death`/`expiry`) |
| loop reset & profile | `reducers/threshold.test.ts` | `endLoop` writes RunRecord, moves Echoes, pays Resonance (incl. +10 per closer), resets per DESIGN §10.3, **keeps the Amulet**; Loop 1 closers → Loop 2 Day 1 with no Threshold; Loop 2+ → Threshold; attunement buy/refund within visit, equip cap 5; modifier toggles affect the *next* loop only; `loopCounter = max + 1` after loading an older run; `newGamePlus`; Loop 1 non-Horde death → title with Echoes kept |
| echoes | `echoes.test.ts` | grant idempotent, `firstEver` flag, `exclusiveWith` blocks the second within a loop and allows it next loop, shortcuts skip quest stages, routes (hidden exits) appear, rep starts and bond loyalty starts apply at loop start |
| communion | `communion.test.ts` | Resolve starts at 1 and clamps 0–8; opens with `echo_tyrant_speaks` or Listen; answers +1/+2/−2; Listen and Support once per Movement; Offer values; rejection only at the end of Movements II/III or on a second lie; +8 watches once at Resolve ≥ 4; outcomes F ≥ 3 / A ≥ 6 / B = 8 with D-054's requirements; no Movement in Phase 4 |
| Silverwood Before | `before.test.ts` | entering freezes the Breach Clock and sets Day 1; Garret rest advances the day; Day 3 rest resets (resets + 1) unless `q_stop_the_ritual` resolved; what resets vs persists; `beforeDay`/`beforeResets` conditions |
| quests | `reducers/quests.test.ts` | stage machine: objectives sweep, optional/hidden, `advanceWhen`, branching `next` by condition, `outcome` complete/fail, rewards applied once, `timeLimitDays`, `startWhen` auto-start, shortcuts, journal events, counters |
| dialogue | `reducers/dialogue.test.ts` | scene selection by `when`+`priority`, `entry` matching, variants, choice `when`/`disabledText`/`once`/`oncePerLoop`, `continue` on no-choice nodes, `onEnter`/`onEnd` effects, startDialogue from combat and return mode, companion reactions |
| conditions/effects | `conditions.test.ts`, `effects.test.ts` | every canonical Condition atom (4.9) true/false; `explain()` parts; every Effect atom observable result + event; `clockWatches` floor; `passWatches`; `teleport` triggers location entry; `startCombat` from dialogue; the D-048 Apex gate in Loop 1 and Loop 2+ |
| saves/migrations | `saves/*.test.ts` | round-trip equality for 50 sim snapshots; schema rejects tampered files with a readable error; migration chain v0→v1 fixture; profile file round-trip; settings mirror |
| determinism | `determinism.test.ts` | 20 recorded **fixture-pack** traces (`tests/fixtures/traces/`, the only committed traces, D-066 #18) replay to identical `finalStateHash`; two runs with the same seed but different `recentLog` lengths (UI setting) produce the same gameplay hash (log excluded from hash) |

### 8.2 Content tests (`tests/unit/content`)

- `schema.test.ts`: `buildContentPack()` succeeds; every table parses; snapshot of counts (locations/quests/codex/…) against D-015/D-045/D-020 minimums (soft until the release gate: bun has no `expect.soft`, so `tests/preload.ts` provides `soft(name, fn)`, which collects failures and reports them in one summary without failing until `RELEASE_GATE=1`).
- `crossrefs.test.ts`: `validateContent()` returns zero errors; warnings printed; specific regression asserts for every validator rule using mutated copies of the pack (each rule has at least one failing example to prove the validator catches it).
- `reachability.test.ts`: BFS reachability of all 73 locations (rule 8), Loop-1 reachability of the 21 legacy locations, every region has an entry exit from another region.
- `quests.completable.test.ts`: for each quest, either a policy bot completes it in the recorded batch fixture (`tests/fixtures/coverage.json`, refreshed by `sim:balance`) or a `scripts/quests.ts` script completes it now (runs with a 10 s budget per quest).
- `endings.reachable.test.ts`: runs the 8 `EndingScript`s (A–F, `closer_escape`, `closer_fall`) → `endingReached`; also asserts each true ending's `requirements` condition is **false** at Loop 1 start (nobody can stumble into an ending) and **true** at the script's final state.
- `legacy.test.ts`: Appendix A mapping — every legacy name present with identical text for the 21 location descriptions, 12 creature descriptions and 26 item descriptions (string-equality against `legacy/aethelgard_data.py` parsed by a tiny regex extractor in `tools/legacy-extract.ts`); the six legacy quests exist with their ids and names.
- `codex.voice.test.ts`: word counts ≤ 220; banned-word list (purple prose guard from DESIGN.md: "very", "suddenly", "incredibly", "unimaginable" …) produces warnings; four voices all present.
- `balance.static.test.ts`: static sanity — no creature with `xp` 0 except adds, every region's creature levels within band ± 2, every class's 15 abilities have unique names, consumables heal ≤ 60 % of level-band hp.

### 8.3 UI tests

jsdom and Testing Library are unavailable (D-065), so UI behaviour is tested in two layers:

**bun + `react-dom/server`** (`tests/unit/ui/<area>/`, owned by the unit that builds that area): components are pure functions of props, so `renderToStaticMarkup(<EnemyCard … />)` snapshots (`toMatchSnapshot`) check structure and text, and the pure helpers each component uses are unit-tested directly:

- `routing.test.tsx`: each `mode` renders its screen's root landmark.
- `exitBar.test.tsx`: exits come from `legalActions` only; a locked exit renders its `lockedText`.
- `abilityBar.test.tsx`: tiles mirror legal actions; disabled reasons ("Needs 12 MP", "Cooldown 2", "Not enough blood"); number labels follow displayed order.
- `enemyCard.test.tsx`: intent chip text, projected range, "?" for hidden, status chips with icon + text, boss phase segments.
- `dialogue.test.tsx`: choices numbered; Echo glyph on `tags: ['echo']`; disabled choice text.
- `hotkeys.test.ts`: the pure `resolveHotkey(map, event, { inCombat, focusInInput })` — Shift required for panels in combat, WASD only on the map, Delete → confirm, disabled in inputs.
- `audio.map.test.ts`: exhaustiveness over `GameEvent['t']`.
- `art.registry.test.ts`: every art key used by content exists in `ART_REGISTRY` (warn-level mirror of validator rule 4); every creature family has a sigil generator.

**Playwright** (`tests/e2e`, against the `dist-e2e/` build served by `tools/serve.mjs`), both projects unless noted:

- `gallery.spec.ts`: the `?gallery=<component>` page (e2e builds only) mounts each panel/component with fixture props; tests click, type and use hotkeys through accessible names: panels open/close and return focus; Inventory/Equipment/Crafting/Merchant dispatch the right actions and show tier prices; Saves panel save/load/delete/export/import (invalid JSON → message); Settings text scale changes `html` font-size, high contrast toggles `data-theme`, reduced motion reaches the audio engine; the live region announces one sentence per dispatch.
- `smoke.spec.ts` `@smoke`: the page loads from a **sub-path** (`/Aethelgard/` and `/`) thanks to relative URLs, no console errors, New Game → class → first location rendered; in-repo a11y checks (8.4) on title and explore.
- `flows.spec.ts`: the 1.3 flow with a `GameDriver` that drives the UI via accessible names (never CSS internals): title → class → move north (fight the Corrupted Shade in the Darkened Corridor through UI buttons) → return and rest → save to slot 1 → reload page → load slot 1 → state restored; then `?scenario=pre_tyrant_l13_ranger` → Tyrant fight → portal → **Loop 2 Day 1** (no Threshold); `?scenario=loop2_end` → Threshold: summary visible, spend Resonance, equip an Attunement, Far Light → Loop 3 Day 1; `?scenario=ending_a_ready` → ending screen → credits contain "a game by Tim Dibert". Scenarios come from `loadScenario` (4.13); there is no `dispatchTrace` and no recorded trace in e2e except `replay.spec.ts`.
- `mobile.spec.ts` (mobile project): bottom tab bar present; each tab reveals its region; no horizontal scroll at text scale 1.5; touch targets ≥ 44 px on ActionBar/AbilityBar/ExitBar.
- `a11y.spec.ts`: the in-repo checks of 8.4 on every screen and panel (title, class, explore, combat, dialogue, threshold ×4, ending, each panel; reached via scenarios) plus a keyboard-only fight (Tab/Enter/numbers only).
- `screenshots.spec.ts` `@screens`: deterministic seed, reduced motion on, captures `docs/screenshots/{desktop,mobile}/NN-<screen>.png`; run before each fun-review round and at release.
- `replay.spec.ts`: replays the fixture-pack traces through the real store and compares `finalStateHash` with the bun value (determinism parity).
- `noNetwork.spec.ts`: `page.route('**/*')` fails any request whose origin differs from the page's; play 50 steps; assert zero.
- `persistence.spec.ts`: autosave appears after a location change; quota exhaustion is simulated (`page.addInitScript` overriding `setItem` to throw) → the quota message appears and export still works.

Build-time switches are esbuild `define` constants (`__DEV__`, `__E2E__`), never `import.meta.env` or `VITE_*` variables.

### 8.4 Accessibility checks (in-repo; axe-core is unavailable, D-065)

- **Contrast** — `tools/a11y/contrast.ts` parses `src/ui/styles/tokens.css`, computes WCAG relative luminance for every text/surface and glyph/surface token pair in both themes, and `tests/unit/tools/contrast.test.ts` asserts ≥ 4.5:1 for text, ≥ 3:1 for UI glyphs and the focus ring, ≥ 7:1 in high contrast.
- **Names and roles** — `checks.ts` `assertAccessibleControls(page)`: every element matched by `button, a[href], input, select, textarea, [tabindex]` resolves through `page.getByRole(role, { name })` with a non-empty name; HP bars are `role="meter"` with `aria-valuenow`; the log is a live region; map nodes are buttons with names and states.
- **Focus order** — `walkFocus(page)` presses `Tab` up to 200 times, records `document.activeElement` names, asserts every focusable element is reached once, focus never lands on `body` mid-walk, visible focus ring present (computed `outline-width ≥ 2px`), and modals trap focus and restore it on `Esc`.
- **Motion** — with `reducedMotion: 'reduce'` emulated, `document.getAnimations()` returns no animation longer than 150 ms.
- **Targets** — bounding boxes ≥ 44 × 44 px for ActionBar/AbilityBar/ExitBar buttons on the mobile project.

These run in `a11y.spec.ts` on every screen and panel; any failure blocks CI.

---

## 9. Work breakdown — ordered unit list

The 20-workstream fan-out of the first draft is withdrawn: usage windows end mid-turn, so work proceeds in **units** of 15–30 minutes under `docs/STATUS.md`'s checkpoint protocol (one unit = brief → deliverable → gates → commit + push → STATUS updated; at most 1–2 agents at a time). This list **becomes STATUS U11+**; U10 (scaffold) is already queued in STATUS and is specified by §2, §3 and §11.

### 9.1 How a unit runs

- **Model routing** (STATUS, adopted 2026-10-13). **Opus**: engine/combat/loop logic, balance analysis and tuning, reviews, continuity checks, fun-review fixes, the final audit, and the *first* instance of any repeated pattern (first schema, first region file, first screen, first test suite). **Sonnet**: transcribing designed content into data once the schema and first example exist, replicating an established screen/component pattern, tests from stated rules, Playwright scripts, CSS/layout, docs, merges, running sims. **✦ Fable**: quest dialogue, scenes, codex, the three fun-review rounds and the final lore/fun audit — the lead tells Tim "Next unit is a ✦ Fable unit — consider switching with /model claude-fable-5-1" before starting one.
- **Gates.** Every unit ends with `npm run typecheck && npm run lint && npm test` (and `npm run validate` once content exists). Every Sonnet unit is followed by an Opus spot-review before it is marked ✅ (STATUS).
- **Ownership.** A unit writes only the paths in its *Owns* column, plus its own tests under the mirrored `tests/` path. Shared barrel files (`src/engine/index.ts`, `src/content/index.ts`, `src/content/regions/index.ts`, `src/engine/types/*`) are edited only by the unit that owns them, or by later units that append an export line (append-only). UI component tests live in `tests/unit/ui/<area>/`, owned by the unit that builds that area. The fixture pack `tests/fixtures/miniContent.ts` is owned by U18; later units may append fixtures for their own systems.
- **Briefs.** The lead writes each unit's brief into `docs/briefs/u<NN>.md` from the row below (inputs = the cited sections; outputs = *Owns*; acceptance = *Done when*) and commits it before launching.
- **Contract freeze.** After U19 (checkpoint C1) the §4/§5 types change only through a DECISIONS entry and the owning unit.

### 9.2 Units

| # | Unit | Model | Needs | Owns | Done when |
|---|---|---|---|---|---|
| U10 | Scaffold (STATUS): move Python to `legacy/` (+ `legacy/README.md`), `package.json`, `.npmrc`, `.editorconfig`, `tsconfig.json`, `bunfig.toml`, `tools/{link-local-deps.mjs,build.ts,dev.ts,serve.mjs,lint.ts,coverage-gate.ts}`, `src/types/*.d.ts`, `playwright.config.ts`, CI + Pages workflows, hello-world page | lead (Opus) | — | root files, `tools/` (except `a11y/`, `validate-content.ts`), `src/types/`, `src/main.tsx` stub, `.github/`, `legacy/` | `npm run check` green on the hello page offline; `dist/` works from a sub-path; lint fixture test catches one violation per rule |
| U11 | Engine types: `GameState`, `Profile`, `Action`, `GameEvent`, typed ids (4.2–4.5) | Opus | U10 | `src/engine/types/**` | types compile; `GameStateSchema` stub round-trips a hand-made state |
| U12 | `Rng` (xoshiro128**), `hash.ts`, `clone.ts` (structuredClone + deepFreeze), first engine test suite | Opus | U11 | `src/engine/rng.ts`, `src/engine/util/**` | golden vectors, bounds, JSON round-trip tests pass |
| U13 | `step`/`ctx`/`RejectSignal`/dispatch skeleton, `legalActions` skeleton, minimal `newRun` (4.6–4.7) | Opus | U12 | `src/engine/{step,ctx,legalActions,newRun}.ts`, `src/engine/index.ts` | purity, reject-returns-same-refs, lazy profile clone tests pass |
| U14 | Schema primitives + canonical Condition/Effect zod + `evaluate`/`explain`/`apply` (4.9) | Opus | U13 | `src/content/schema/{primitives,condition,effect}.ts`, `src/engine/{conditions,effects}.ts` | every atom true/false + observable-effect tests; DESIGN §13.3 examples parse |
| U15 | Schemas: region, location, encounter, item, affix, recipe, status (5.2–5.3, 5.5–5.6, 5.8) | Sonnet | U14 | those `src/content/schema/*.ts` | DESIGN §7.7 legacy items and one WORLD location parse |
| U16 | Schemas: creature (moves/pattern/phases/communion), ability, class, companion; `specials.ts` mirror (5.4, 5.7, 5.11) | Opus | U14 | those schema files, `src/content/schema/specials.ts` | DESIGN §4.12 creatures, both Tyrants from DESIGN §4.10 and three ability rows parse |
| U17 | Schemas: quest, dialogue, npc, echo, codex, achievement, attunement, modifier, ending, merchant, faction, `GameConfig`; `buildContentPack` (5.9–5.18) | Sonnet | U15, U16 | remaining schema files, `src/content/index.ts`, `src/content/shared/config.ts` | an empty pack builds; GameConfig defaults equal DESIGN's tables |
| U18 | Fixture pack `miniContent.ts` (2 regions, 6 locations, 4 creatures incl. a 3-phase boss with communion, 19 statuses, 2 classes) + `makeState`/`play` helpers + `tests/preload.ts` | Opus | U17 | `tests/fixtures/**`, `tests/preload.ts` | fixture pack builds; helpers used by one test |
| U19 | `validateContent()` rules 1–22 + `tools/validate-content.ts` (5.19) — **C1 contract freeze** | Sonnet | U18 | `src/content/validate.ts`, `tools/validate-content.ts`, `tests/unit/content/crossrefs.test.ts` | each rule has a failing mutated-pack example; fixture pack validates |
| U20 | Explore & time: move, retreat, take, gather, wait, rest short/full, clock ticks/warnings/floor, dawn hooks (restock trigger, uses reset, encounterHp clear) | Opus | U19 | `src/engine/reducers/explore.ts`, `src/engine/reducers/loop.ts` (clock part) | `loop.test.ts` clock/rest/travel rows of 8.1 pass |
| U21 | Character: `derived.ts`, `progression.ts` (XP table, level-up, half-point AP, mastery), inventory reducers (use/equip/drop/stat/unlock/readBook/respec) | Opus | U19 | `src/engine/{derived,progression}.ts`, `src/engine/reducers/inventory.ts` | DESIGN §3.3 reference values reproduced; inventory and progression rows pass |
| U22 | Saves: serialize/deserialize, migrations, `profileLoopAtSave`, storage keys, round-trip tests (4.12) | Sonnet | U21 | `src/engine/saves/**` | 50 snapshot round-trips; tampered-file errors readable |
| U23 | Combat core: combat state, snapshot, initiative, turn loop, basic attacks by weapon type, damage pipeline (DESIGN §4.1, §4.3, §5.7) | Opus | U21 | `src/engine/combat/{damage,turnOrder}.ts`, `src/engine/reducers/combat.ts` | DESIGN §4.12 worked example reproduced number-for-number |
| U24 | Statuses + interplay + status timing + DoT rule (DESIGN §4.5–4.6) | Opus | U23 | `src/engine/combat/statuses.ts` | statuses + interplay rows pass |
| U25 | Enemy intents: pattern pointer, `CombatWhen`, commitment, projected ranges, hidden, stun/interrupt/taunt (DESIGN §4.2) | Opus | U24 | `src/engine/combat/intents.ts` | intents rows pass; WORLD cadence words covered |
| U26 | Player abilities & resources: ability resolution (multi-hit, bonuses, self-costs, onKill), class resource rules, Guard, combat items, flee/scatter/hold, `specials.ts` | Opus | U25 | `src/engine/combat/{abilities,flee,specials}.ts` | ability, resource, flee rows pass; mirror test vs schema `specials.ts` green |
| U27 | Boss phases, adds, Rewind cap, Stagger; combat end, rewards, loot (D-055 rule), bestiary reveals | Opus | U26 | `src/engine/combat/{phases,rewards}.ts` | phases rows pass; fixture boss fight completes |
| U28 | Companions: `companionAct` stances, cooldowns, signature command, KO/revive, Dask flag rule | Opus | U27 | `src/engine/combat/companionAi.ts`, companion parts of `reducers/combat.ts` | companion AI rows pass |
| U29 | Communion engine (DESIGN §4.11) | Opus | U28 | `src/engine/communion.ts` | `communion.test.ts` passes on the fixture spec |
| U30 | Horde (Tyrant + expiry, 3-move delay), portal, closers, `endLoop`, reset, Loop 1 → Loop 2, Resonance, profile writes | Opus | U29, U20 | `src/engine/reducers/loop.ts` (loop-end part), `src/engine/horde.ts` | horde and loop-reset rows pass |
| U31 | Threshold: areas, attunement buy/refund/equip (cap 5), modifiers, Far Light class change, New Game+ | Opus | U30 | `src/engine/reducers/threshold.ts` | threshold rows pass |
| U32 | Silverwood Before counter; loop-start Echo effects (rep starts, bond loyalty, shortcuts, routes) | Opus | U30 | `src/engine/before.ts`, `src/engine/echoes.ts` | `before.test.ts`, `echoes.test.ts` pass |
| U33 | Quests + dialogue reducers: stage machine, objectives sweep, shortcuts, scene selection, choices, companion reactions | Opus | U19 | `src/engine/reducers/{quests,dialogue}.ts` | quests and dialogue rows pass |
| U34 | Economy + crafting: merchants, dawn restock, DESIGN §9.2 pricing, craft/upgrade/salvage, story recipes, fragments ×2 | Opus | U21 | `src/engine/reducers/{economy,crafting}.ts` | economy and crafting rows pass |
| U35 | `legalActions` completeness + `isLegal` + legal/step agreement property test over fixture states | Opus | U31–U34 | `src/engine/legalActions.ts` | property test: 300 states, every legal accepted, 200 illegal rejected — **C2 engine** |
| U36 | `loadScenario` builders (4.13) on the fixture pack | Sonnet | U35 | `src/sim/scenarios.ts` | every scenario validates and has legal actions |
| U37 | Sim runner, bot interface, `random` + `melee` bots, soft-lock detector (7.1–7.3, 7.6) | Opus | U36 | `src/sim/{runner,softlock,cli}.ts`, `src/sim/bots/{types,shared,random,melee}.ts` | fixture pack: `random` 5,000 steps, zero errors |
| U38 | Bots: caster, explorer, speedrunner, pacifist, `pathBot` (7.2, 7.8) | Sonnet | U37 | `src/sim/bots/*` (rest) | each bot completes a fixture loop |
| U39 | Batch runner (workers), metrics, coverage, `BALANCE.md` generator mapping DESIGN §19 rows (7.4–7.9) | Sonnet | U38 | `src/sim/{batch,worker,metrics,coverage,report}.ts`, `tools/gen-balance.ts` | fixture batch writes a BALANCE.md with every §19 row |
| U40 | Shared content I: classes, Ranger + Wizard abilities, statuses, affixes (DESIGN §3.3, §4.5, §5.2–5.3, §7.3) | Opus | U19 | `src/content/shared/{classes,statuses,affixes}.ts`, `abilities/{ranger,wizard}.ts` | validates; ability numbers equal DESIGN |
| U41 | Shared content II: Elf, Warden, Weaver abilities; 6 companions + 24 companion abilities; `itm_echo_bolt` (DESIGN §5.4–5.7, §12) | Sonnet | U40 | `abilities/{elf,warden,weaver,items}.ts`, `companions.ts` | validates; counts 75 + 24 + 1 |
| U42 | Region data: Silverwood Ruins (legacy; first region file — locations, encounters, creatures, item placement, NPCs; WORLD §3, §4, §6, §10–11) | Opus | U41 | `src/content/regions/silverwood_ruins/**` | validates; legacy text equals Appendix A sources |
| U43 | Region data: Mistwood & the Ironclad Reach | Sonnet | U42 | `regions/mistwood_ironclad_reach/**` | validates; reachability from the Ruins |
| U44 | Region data: The Voidscar + Aether-Kissed Highlands | Sonnet | U42 | `regions/{voidscar,aether_kissed_highlands}/**` | validates |
| U45 | Region data: Glowlands & Nexus + the Apex, incl. both Tyrants (phases, moves, communion spec, `cr_tyrants_reach`) | Opus | U42 | `regions/glowlands_nexus/**` | validates; Tyrant numbers equal DESIGN §4.10 |
| U46 | Region data: The Drowned Reach + The Ashen Steppe | Sonnet | U42 | `regions/{drowned_reach,ashen_steppe}/**` | validates |
| U47 | Region data: The Glowfen + The Veil | Sonnet | U42 | `regions/{glowfen,veil}/**` | validates |
| U48 | Region data: The Skyreach + Silverwood Before + The Threshold | Sonnet | U42 | `regions/{skyreach,silverwood_before,threshold}/**` | validates; all 73 locations reachable |
| U49 | Items I: weapons, armor, trinkets T1–T5 (WORLD §7) | Sonnet | U42 | `src/content/shared/items/{weapons,armor,trinkets}.ts` | validates; legacy items equal DESIGN §7.7 |
| U50 | Items II: consumables, materials, quest/key/recipe/tome items, 30 recipes, 8 merchants (WORLD §7–9) | Sonnet | U49 | `items/{consumables,materials,quest}.ts`, `recipes.ts`, `merchants.ts` | validates; item count ≥ 120 |
| U51 | Echo catalog (STORY §12, 101), achievements (40), attunements (15), modifiers (6), ending/closer records — data only | Sonnet | U48 | `src/content/shared/{echoes,achievements,attunements,modifiers,endings}.ts` | validates; every Echo granted somewhere (rule 16 warnings listed) — **C3a data** |
| U52 | Legacy quests + their dialogues (6 quests, legacy lines verbatim) — first quest/dialogue file | Opus | U51, U33 | `src/content/shared/quests/legacy.ts`, legacy dialogues | validates; `pathBot` completes all six |
| U53 | Faction chain quests (`q_keepers_ledger`, `q_day_of_teeth`, `q_hollow_choir`, `q_unlidded_eye`) + dialogue | ✦ Fable | U52 | `quests/factions.ts`, their dialogues | validates; scripts complete them |
| U54 | Companion arcs: Ilyra + Brak (6 quests) + camp scenes | ✦ Fable | U52 | `quests/companions_ilyra_brak.ts`, dialogues | validates; scripts complete them |
| U55 | Companion arcs: Nyx + Dask (6 quests) + camp scenes | ✦ Fable | U52 | `quests/companions_nyx_dask.ts`, dialogues | same |
| U56 | Companion arcs: Mireya + Caelum (6 quests) + camp scenes | ✦ Fable | U52 | `quests/companions_mireya_caelum.ts`, dialogues | same |
| U57 | Regional quests (7) + their dialogue | ✦ Fable | U52 | `quests/regional.ts`, dialogues | same |
| U58 | Loop-only (4) + ending quests (6) + communion questions/answers + Tyrant lines (STORY §8) | ✦ Fable | U52, U29 | `quests/{loop,endings}.ts`, Tyrant dialogue | validates; all 8 ending scripts pass — **C3 content** |
| U59 | Class mini-quests (5) + class-variant dialogue lines (D-008) | ✦ Fable | U52 | `quests/class.ts` | validates; each class completes its quest |
| U60 | Codex I: history, the Nine, Wayfinders, factions, people (≈43 entries) | ✦ Fable | U51 | `src/content/shared/codex/{history,nine,people}.ts` | ≤ 220 words each; voices balanced |
| U61 | Codex II: places, creatures (eight families), magic, items, loops (≈42 entries) | ✦ Fable | U60 | `codex/{places,creatures,magic,loops}.ts` | 85 total; every entry reachable |
| U62 | Scenes (20) + ending sequences and epilogues (STORY §10, §13) | ✦ Fable | U58 | `src/content/shared/scenes.ts`, ending records' text | validates; ending scripts show all slides |
| U63 | UI foundation: store (`useSyncExternalStore`), `ui/App.tsx`, Shell, hotkey resolver, tokens/themes, Title + Class Select (first screens) | Opus | U35, U41 | `src/ui/{store,App.tsx,hooks,a11y,styles}/**`, those screens | hotkeys/routing tests pass; title → class works in `dist-e2e` |
| U64 | Explore screen + illustrated node map + ExitBar/ActionBar + HUD clock chip | Opus | U63, U42 | `ExploreScreen.tsx`, `MapPanel.tsx`, `components/{ExitBar,ActionBar,ClockWidget,StatusBar}` | snapshot tests; travel by keyboard and tap |
| U65 | Combat screen: enemy cards, intent chips, ability bar, companion card, pipeline log, communion bar | Opus | U64, U29 | `CombatScreen.tsx`, combat components | snapshot tests; fixture fight playable in the browser |
| U66 | Dialogue screen + Quest Journal + Codex + Bestiary panels | Sonnet | U65 | those screens/panels | snapshot + gallery tests |
| U67 | Inventory/Equipment, Abilities tree, Merchant, Forge, Camp panels | Sonnet | U65 | those panels | snapshot + gallery tests |
| U68 | Threshold (4 screens), Run Summary, Ending, Loop Timeline, Achievements | Sonnet | U65 | those screens | snapshot + gallery tests |
| U69 | Saves + Settings panels, persistence (slots, `.tmp`/`.bak`, export/import), mobile layout and tab bar | Sonnet | U65 | `store/persistence.ts`, those panels, `styles/layout.css` | persistence spec passes; no horizontal scroll at 1.5× |
| U70 | Onboarding callouts, Breach overlay/infection map layer, toasts, live-region phrasing | Sonnet | U66–U69 | `components/{Callout,Toasts}`, overlay layer | Loop 1 onboarding plays per DESIGN §16.8 — **C4 playable** |
| U71 | Art system: parametric SVG scene layers, region palettes, first templates (DESIGN §17.1–17.2) | Opus | U64 | `src/ui/art/{Scene,layers,RegionPalette}/**` | Ruins scenes render; reduced-motion respected |
| U72 | Scene data for all 73 locations + focal pieces (Heartstone, Tyrant, portal) | Sonnet | U71, U48 | `src/ui/art/{shapes,focal}/**`, art fields | every location renders without fallback warnings |
| U73 | Creature sigils (8 families + bosses), item icons, damage/status glyphs (DESIGN §17.3–17.5) | Sonnet | U71 | `src/ui/art/{sigils,icons}/**` | art registry test green |
| U74 | Audio engine + 30 SFX (DESIGN §18.1, §18.3, §18.5) | Opus | U63 | `src/audio/{engine,map,synth,sfx}/**` | event-map exhaustiveness test; mute/volume work |
| U75 | Ambient per region + Threshold drone + Tyrant theme (DESIGN §18.2, §18.4) | Sonnet | U74 | `src/audio/ambient/**` | each region plays its preset |
| U76 | Content tests: schema counts, reachability, legacy text, codex voice, static balance (8.2) | Sonnet | U62 | `tests/unit/content/**` | all pass on the real pack |
| U77 | Playwright: smoke, flows (scenarios), mobile, noNetwork, persistence, replay (8.3) | Sonnet | U70, U36 | `tests/e2e/{smoke,flows,mobile,noNetwork,persistence,replay}.spec.ts`, `helpers/**` | green on both projects |
| U78 | In-repo a11y checks (`tools/a11y/*`), `a11y.spec.ts`, `gallery.spec.ts`, `screenshots.spec.ts` (8.4) | Sonnet | U77 | `tools/a11y/**`, those specs | zero a11y failures on every screen |
| U79 | Integration checkpoint: full game in the browser, saves frozen at `version: 1` (D-058), fixture traces recorded | Opus | U72–U78 | `tests/fixtures/traces/**`, `docs/REPORT.md` (section) | `npm run check` green; Loop 1 → Loop 2 by hand in `dist/` |
| U80 | First real-content balance batch (2,000 runs) → `BALANCE.md` | Sonnet | U79 | `docs/BALANCE.md` | report committed |
| U81 | Balance analysis + tuning against DESIGN §19 (incl. #19 Contained Tyrant at L11/L13); DESIGN edits first, then data | Opus | U80 | DESIGN numbers, affected content | every §19 row passes or has a ruling in DECISIONS |
| U82 | Soft-lock / coverage punch list (never-reached content, bot mismatches) | Opus | U81 | affected content/engine | zero soft-locks in 2,000 runs; coverage 100 % quests/locations/endings — **C5 verified** |
| U83 | Fun review round 1 (fresh agent plays Loop 1 + one ending) → findings in REPORT.md | ✦ Fable | U82 | `docs/REPORT.md` (round 1) | dated findings list |
| U84 | Fixes from round 1 | Opus | U83 | as needed | blockers fixed; gates green |
| U85 | Fun review round 2 | ✦ Fable | U84 | `docs/REPORT.md` (round 2) | findings list |
| U86 | Fixes from round 2 | Opus | U85 | as needed | blockers fixed |
| U87 | Fun review round 3 | ✦ Fable | U86 | `docs/REPORT.md` (round 3) | zero blocker findings |
| U88 | Continuity check of all shipped text against `docs/BIBLE.md` | Opus | U87 | content text fixes | zero contradictions listed |
| U89 | Docs: README (play/develop/deploy), `docs/CONTENT.md`, REPORT.md sections (why no Vite, D-065) | Sonnet | U88 | `README.md`, `docs/CONTENT.md` | docs reviewed by the lead |
| U90 | Screenshots on both viewports; Pages deploy verified via dispatch | Sonnet | U89 | `docs/screenshots/**` | screenshots committed; preview URL loads |
| U91 | Final lore + fun audit and the 10.7 checklist; PR `unraveling` → `main` with REPORT.md | ✦ Fable + lead | U90 | `docs/REPORT.md` (final) | PR opened — **C6 release** |

**81 units (U11–U91)** after the U10 scaffold: Opus 37, Sonnet 30, ✦ Fable 13, and U91 (✦ Fable with the lead).

### 9.3 Checkpoints

| Checkpoint | After | Proof |
|---|---|---|
| C1 contract freeze | U19 | `npm run check` green on the fixture pack; schemas and types of §4/§5 exist as code |
| C2 engine | U35 | fixture pack: legal/step property test and `random` 5,000-step run (U37) green; engine coverage ≥ 85 % lines |
| C3 content | U58 (data C3a at U51) | `npm run validate` zero errors; all 73 locations reachable; all 8 ending scripts pass |
| C4 playable | U70 | Loop 1 playable end to end in `dist-e2e`; smoke + mobile specs pass |
| C5 verified | U82 | every DESIGN §19 row and every 1.2 gate passes in BALANCE.md |
| C6 release | U91 | PR from `unraveling` to `main` with REPORT.md; Tim merges → Pages live |

A unit that turns CI red is reverted, not fixed forward, unless the fix is a one-liner (D-038).

---

## 10. Conventions

### 10.1 Naming

- **Files**: engine/content/sim modules `camelCase.ts`; React components `PascalCase.tsx` (one component per file, named export matching the file); CSS `kebab-case.css`; content region folders and files `snake_case` matching region ids; tests `<module>.test.ts(x)`; e2e `<topic>.spec.ts`.
- **Types**: `PascalCase`; zod schemas `XSchema`; inferred `X` and `XInput`; unions discriminated by `type` (actions), `t` (events), `kind` (content sub-unions).
- **Ids** (D-044): lowercase `snake_case`, ASCII, unique across the whole content pack, stable forever (renaming an id is a migration). **Type prefixes are part of the id** (`region_`, `loc_`, `cr_`, `item_`/`mat_`, `recipe_`, `npc_`, `q_`, `echo_`, `scene_`, `codex_`, `ending_`, `closer_`, `status_`, `affix_`, `att_`, `ach_`, `mod_`, `sfx_`, `screen_`, `ev_`, `flag_`, ability prefixes `rgr_`/`wiz_`/`elf_`/`wrd_`/`wvr_`/`comp_<companion>_`/`itm_`; WORLD's `fam_`, `pool_`, `gate_`, `ws_` per REGISTRY); classes, companions, factions, damage types and stats are plain ids. `echo.x` in prose means `echo_x`. The canonical id of every entity is in `docs/reviews/REGISTRY-DRAFT.md` (BIBLE.md later). Choice ids are unique within their node; node ids within their scene; stage/objective ids within their quest. Schema discriminator literals that are not ids are camelCase.
- **Terminology** in all player-facing text follows D-026 exactly (`Wayfinder`, `the Breach`, `ley lines`, `Heartstone`, `the Nine`, `Echo` capitalized when persisted knowledge…). A `tools/check-terms.ts` grep (part of `npm run validate` warnings) flags `Leyline`, `heart stone`, `Wayfarer` used for the player, `Nine Rival Mages` outside the legacy lore article, etc.
- **Text style** (D-020): concrete nouns, short sentences, no purple prose; present tense second person for narration ("You step through…"); NPC lines in quotes with the speaker in the node, not in the text.

### 10.2 Content ids for the legacy game

Appendix A is the canonical mapping (consistent with REGISTRY-DRAFT). Content authors never invent a new id for a legacy thing; the `check-ids` tool (U19) errors if a `legacyName` appears with a different id than Appendix A.

### 10.3 File-per-region content layout

Each region folder exports five arrays plus two written by the quest/dialogue units (U52–U59):

```
src/content/regions/<region_id>/
  region.ts       export const region = {...} satisfies RegionInput
  locations.ts    export const locations = [...] satisfies LocationInput[]
  creatures.ts    export const creatures = [...] satisfies CreatureInput[]
  items.ts        export const items = [...] satisfies ItemInput[]
  npcs.ts         export const npcs = [...] satisfies NpcInput[]
  dialogues.ts    export const dialogues = [...] satisfies DialogueSceneInput[]   (U52–U59)
  quests.ts       export const quests = [...] satisfies QuestInput[]              (U57; regional quests only)
  index.ts        re-exports all seven (template from U42; identical in every folder)
```

Cross-region references are allowed by id (an item defined in `silverwood_ruins/items.ts` may drop in the Veil). Items/creatures that belong to no region (class starters, global consumables) live in `src/content/shared/`.

### 10.4 How to add content (becomes `docs/CONTENT.md`)

**A location**: 1) pick the region folder; 2) run `bun tools/new-content.ts location <id>` to append a typed stub; 3) fill `name`, `description` (2–4 sentences, legacy register), `exits` (add the reverse exit on the neighbor), `map` coordinates (region grid documented in WORLD.md), `art` (template + 2–4 silhouettes + particles), optional `rest`/`merchantId`/`craftingStation`/`npcs`/`items`/`encounters`/`events`; 4) `npm run validate`; 5) if the location should be discoverable by bots, make sure some exit chain from the start reaches it without an impossible condition; 6) add a codex entry if it is a named place (STORY's voice rules).

**A creature**: stub with `new-content.ts creature <id>`; set `level` inside the region band; give ≥ 2 `moves` with distinct telegraph lines (one should apply a status or exploit an interplay) and an ordered `pattern` (DESIGN §4.2); set `resistances` (at least one `weak` so every class has an answer); `loot` with chances; `bestiary` voice text; `sigil.base`; bosses: `role: 'boss'`, `fleeable: false`, 2–4 `phases` with OR-list `enterWhen` and decreasing `hpBelow`.

**An item**: type/slot/tier; `stats` for equipment; `onUse` effects for consumables (`heal`, `applyStatus`…); `sources` for the report; `value` consistent with tier (table in BALANCE.md); `art.icon` from the registry; quest items `type: 'quest'`, `sellable: false`, `droppable: false`.

**A quest**: in `shared/quests/<category>.ts` or the region's `quests.ts`; stages with `journal` text and `objectives` as Conditions; terminal stage with `outcome`; rewards; hook the start into a dialogue choice (`questStart`) or `startWhen`; add a `pathBot` script in `src/sim/scripts/quests.ts` if no policy bot will complete it; run `npm run validate` and `bun src/sim/cli.ts quest <id>` to prove it.

**A dialogue scene**: `npcId`, `when`, `priority`; `entry` conditions for returning players; nodes with `speaker`; choices with `effects` and `next`; use `echoHint` and `tags: ['echo']` for Echo-unlocked lines; use `oncePerLoop` for consequence choices; end with `'end'`; use conditional `textVariants` rather than duplicate nodes.

**An Echo**: only if STORY §12 lists it (D-062: STORY is the catalog); in `shared/echoes.ts` with `codexLine`, `category`, `obtainedBy`; grant it with `grantEcho` in exactly the places listed in `obtainedBy`; gate at least one thing with `{ echo }`; add `exclusiveWith` pairs symmetrically.

**A codex entry**: pick the voice; ≤ 220 words; `unlockWhen` or an `unlockCodex` effect; `related` ids.

### 10.5 Commit messages and branches

- Conventional Commits with the unit as scope: `feat(u47): add the Veil locations and creatures`, `fix(u24): shock interplay applied twice`, `test(u24): status expiry matrix`, `content(u54): Brak arc stages 2–3`, `docs(u89): CONTENT.md`, `chore(u10): link local deps`. Body explains *why*; reference D-### when a decision is implemented. Any attribution trailers required by the tooling go after a blank line at the end.
- The only long-lived branch is `unraveling` (D-038). Agents commit their own deliverable on `unraveling` with explicit paths (`docs/briefs/COMMIT.md`) and push at the end of every unit. Nobody pushes to `main`; nobody force-pushes `unraveling`; nobody rewrites history after a tag.
- Small commits: a content region in 2–4 commits, an engine subsystem in 3–8 commits. CI must be green at every push to `unraveling` (red → revert).

### 10.6 Definition of done (per unit)

1. All files in the unit's *Owns* exist at the stated paths; nothing outside *Owns* was modified (verified with `git diff --stat`).
2. `npm run typecheck && npm run lint && npm test` green locally; for content: `npm run validate` zero errors; for UI: relevant Playwright specs green.
3. The *Done when* column answered with a command and its result in the report; STATUS updated with the commit.
4. No `TODO` without a `(U##)` owner; no `@ts-ignore`; no `any` outside `src/types/`.
5. New public functions have a one-paragraph doc comment; content entries have `tags`.
6. The report is filed in the standard format; proposed shared-file edits are provided as diffs.

### 10.7 Final-audit checklist (lead, C6)

D-001 names preserved (legacy test) · D-002 loop closers both reachable · D-005 clock 30 base, warnings, Loop 1 subtle · D-008 five classes × 15 abilities, mastery · D-009 intents, 18 statuses, interplay, fixed bands, boss phases, flee rules · D-010 STORY §12 Echoes, exclusivity, shortcuts, routes · D-011 persist/reset lists field by field · D-012 four Threshold areas · D-013 six companions with arcs and constraints · D-014 tiers and gates · D-015 73 locations in 12 regions · D-016 Silverwood Before anchors · D-017 every consequence present · D-018 six endings + closers, epilogues, achievements · D-045 44 quests (+5 class) · D-020 85 codex entries, four voices, ≤ 220 words · D-021 NG+, six modifiers, 40 achievements, run summary · D-022–D-026 continuity (BIBLE.md spot checks) · D-027 credit line · D-030–D-040 and D-065 engineering (this plan's gates) · D-041–D-066 rulings (each with a test or a content check).

---

## 11. CI and deployment

CI installs from the public registry (GitHub Actions has network), with the same exact pins the sandbox links offline (D-065): there is **no lockfile**, so the steps use `npm install` (not `npm ci`) and no `cache: npm`; bun comes from `oven-sh/setup-bun`; Playwright's Chromium is installed for the exact `playwright` version in `node_modules`. Builds use relative asset URLs, so there is no base-path variable.

### 11.1 `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: typecheck · lint · test · validate · build · e2e smoke
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      CI: true
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Node 22
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc          # 22; no `cache: npm` — there is no lockfile to key on

      - name: Bun 1.4.2
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2

      - name: Install (exact pins, no lockfile)
        run: npm install --no-audit --no-fund --no-package-lock

      - name: Verify pinned versions
        run: node tools/link-local-deps.mjs --verify-only   # same version check as the offline bootstrap, no linking

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Unit tests + coverage gate
        run: npm test

      - name: Validate content
        run: npm run validate

      - name: Build (dist/, relative URLs, size budget)
        run: npm run build

      - name: Playwright version
        id: pw
        run: echo "version=$(node -p "require('playwright/package.json').version")" >> "$GITHUB_OUTPUT"

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: pw-${{ runner.os }}-${{ steps.pw.outputs.version }}-chromium

      - name: Install Chromium
        run: npx playwright install --with-deps chromium

      - name: E2E smoke (builds dist-e2e/, serves it statically)
        run: npm run test:e2e -- --grep @smoke

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
          retention-days: 7

  e2e-full:
    name: e2e full (both viewports, a11y)
    needs: verify
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/unraveling' || github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 40
    env:
      CI: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      - run: npm install --no-audit --no-fund --no-package-lock
      - id: pw
        run: echo "version=$(node -p "require('playwright/package.json').version")" >> "$GITHUB_OUTPUT"
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: pw-${{ runner.os }}-${{ steps.pw.outputs.version }}-chromium
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e -- --grep-invert @screens
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-full
          path: playwright-report/
          retention-days: 7

  sim:
    name: balance batch (nightly / dispatch)
    if: github.event_name == 'workflow_dispatch'
    needs: verify
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      - run: npm install --no-audit --no-fund --no-package-lock
      - run: npm run sim:balance
      - uses: actions/upload-artifact@v4
        with:
          name: balance
          path: docs/BALANCE.md
```

The sandbox cannot reach the registry, so locally the same sequence is `node tools/link-local-deps.mjs && npm run check` (11.3). `tools/link-local-deps.mjs --verify-only` only compares `node_modules/*/package.json` versions with the pins and exits 1 on a mismatch, so CI fails loudly if the registry ever serves something else.

### 11.2 `.github/workflows/pages.yml`

```yaml
name: Pages

on:
  push:
    branches: [main]
  workflow_dispatch:            # dispatch on `unraveling` builds the artifact; only `main` deploys

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      - run: npm install --no-audit --no-fund --no-package-lock
      - run: npm run build                     # validate + esbuild → dist/ with relative asset URLs
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`dist/index.html` references `./assets/app-<hash>.js` and `./assets/app-<hash>.css`, so the same artifact works at `https://dubbltninja.github.io/Aethelgard/`, at any other repository name, and from a local static server; there is no router, so no `404.html` is needed. Repository setting required once (Tim): Settings → Pages → Source = **GitHub Actions**. The README documents this and the resulting URL.

### 11.3 Local equivalence

| CI step | Local (sandbox, offline) |
|---|---|
| `npm install` | `node tools/link-local-deps.mjs` (symlinks the pinned packages from `/opt/npm-tools/node_modules`) |
| `oven-sh/setup-bun` | `/root/.bun/bin/bun` on `PATH` |
| `npx playwright install chromium` | `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (already installed) |
| everything else | identical `npm run` scripts; `npm run check` runs the CI `verify` job end to end |

---

## 12. Risk register

| # | Risk | Likelihood / impact | Mitigation | Owner |
|---|---|---|---|---|
| 1 | **Content volume vs schema churn** — WORLD/STORY need a field the schemas lack after C1 | High / High | Contract freeze at C1 (U19) with explicit extension points: optional fields, `tags`, `notes`, `special` hooks, `textVariants`; additive optional fields only, by the owning unit; a DECISIONS entry per breaking change; new condition/effect atoms go through DESIGN §13.3 first | Lead, U14–U19 |
| 2 | **Nondeterminism leaks** (`Math.random`, `Date`, object-key order, unstable sorts) break replay and sims | Medium / High | `tools/lint.ts` `engine-purity` in engine and sim bots; all draws via `ctx.rng`; canonical-JSON hash; determinism gate; bun/browser parity Playwright test on fixture traces; stable sorts with explicit comparators | U12, U37 |
| 3 | **localStorage quota / corruption** | Low / High | Save size test (< 300 kB per slot), capped logs; two-phase `.tmp`/`.bak` writes (DESIGN §14.4); quota error → toast + export; settings mirror; zod-validated reads with fallback | U22, U69 |
| 4 | **Bundle size** with inline SVG and ~3,000 dialogue lines exceeds 600 kB gzipped | Medium / Medium | `tools/build.ts` fails the build over budget; esbuild `splitting` for Threshold/ending/art focal pieces if needed (same origin, relative URLs); text stored once | U10, U71 |
| 5 | **Playwright flakiness** | High / Medium | `loadScenario` instead of long UI walks or recorded traces (D-066 #18); reduced motion forced; accessible-name selectors only; auto-waiting `expect`; retries 1 in CI; Chromium only; trace on failure | U77, U78 |
| 6 | **Inconsistent ids across units** | Medium / Medium | D-044 typed ids with template-literal types; REGISTRY-DRAFT as the canonical list; `content-literals` lint rule; `check-ids` and validator cross-refs fail the build | U19, every content unit |
| 7 | **Engine exception in the browser** corrupts or ends a run | Medium / High | Store keeps the previous state on throw, shows a recoverable toast, offers export; autosave at checkpoints; sims catch most before merge; exceptions are release blockers | U63, U37 |
| 8 | **Balance targets unmet late** (a class cannot finish Loop 1; Tyrant too long; a quest never completes) | High / Medium | DESIGN §19 as the single target table; Tyrant scenario sims at L11/L13 (§19 #19) from U45; batch on every content unit from C3; tunables centralized in `GameConfig`; BALANCE.md recommendations; three fun-review rounds | U39, U81 |
| 9 | **Sibling docs contradict contracts** | Medium / Medium | D-062 precedence; the lead reads each revised doc against §4/§5 and records DECISIONS entries; schema enums are the only hard edges | Lead |
| 10 | **`structuredClone` per step too slow** for 2,000-run batches | Medium / Low | Expected 150–300 µs/step (≈ 7.5 min on 8 workers); `perf.test.ts` gate at 400 µs median; fallback: copy-on-write of touched sub-trees behind the same `step` signature | U13, U39 |
| 11 | **Accessibility regressions** from many UI units | High / Medium | Shared primitives (`Button`, `Dialog`, `Tabs`, `PanelHost`) own focus/aria; in-repo a11y checks on every screen (8.4); contrast token test; keyboard-only fight; `div onClick` lint grep | U63, U78 |
| 12 | **Offline toolchain drift** — CI's `npm install` (no lockfile) resolves something the sandbox never tested, or a needed package is missing locally | Low / Medium | Exact pins; `link-local-deps.mjs --verify-only` in CI; no new dependency without a DECISIONS entry and a local copy in `/opt/npm-tools` | U10 |
| 13 | **React type shim gaps** — a component needs an API `src/types/react.d.ts` does not declare | Medium / Low | Shim grows with the API in the same commit; `types.test.ts` keeps it strict; `any` confined to `src/types/` | U10, U63 |
| 14 | Legacy texts drift during authoring (D-001) | Medium / Low | `legacy.test.ts` string-equality against `legacy/aethelgard_data.py` | U42–U48, U76 |
| 15 | bun `worker_threads` differences | Low / Low | Workers use only `postMessage`/`on('message')`; `--workers 1` runs in-process | U39 |

---

## 13. Open questions for the lead

The first draft's questions are answered by DECISIONS: D-041 (`step` with profile), D-065 (`structuredClone`, not immer; offline toolchain; React 19; Playwright 1.56 pinned exactly), D-043, D-044 (typed ids), D-048 (Apex gate), D-047 (Amulet Echo Bolt), D-053 (companions scale with player level), D-049 (Loop 1 death and the Threshold), D-057 (dawn restock), D-056 (XP curve and bands), D-058 (save versioning, fun reviewers), D-059 (camp scenes; Dask's per-location flag), D-060 (the Horde after Loop 1), D-066 (the U5/U6 rulings). Still open:

1. **Dask on the Veridian Glowlands** (D-059 leaves it unflagged; WORLD X8). The engine follows the flag; amend D-059 if Dask should walk the whole Apex road.
2. **Steppe road** (`echo_steppe_waystones`, REVIEW-CROSS C-46): DESIGN §10.1 accepts WORLD X3's conditional road; the lead confirms or drops the Echo.
3. **Coverage of branches.** bun reports lines and functions only; branch coverage is not gated. Accept, or add a branch gate later if a coverage tool becomes available offline.
4. **Fixture traces** for the determinism test are recorded at U79 and must be re-recorded only when the fixture pack changes; confirm that the real pack is never used for committed traces (D-066 #18).

---

## Appendix A — Canonical ids for legacy content (D-001, D-044)

Ids follow D-044 and `docs/reviews/REGISTRY-DRAFT.md` (typed prefixes are part of the id). Legacy *names* are kept exactly (D-001); only ids carry prefixes. Rebalanced item numbers are DESIGN §7.7's; legacy stats below are the authoring baseline only.

### A.1 Regions

| id | name | legacy | D-015 count |
|---|---|---|---|
| `region_silverwood_ruins` | Silverwood Ruins | yes | 7 |
| `region_mistwood_ironclad_reach` | Mistwood & the Ironclad Reach | yes | 6 |
| `region_voidscar` | The Voidscar | yes | 2 |
| `region_aether_kissed_highlands` | Aether-Kissed Highlands | yes | 3 |
| `region_glowlands_nexus` | Glowlands & Nexus | yes | 3 |
| `region_silverwood_before` | Silverwood Before | new | 10 |
| `region_drowned_reach` | The Drowned Reach | new | 8 |
| `region_ashen_steppe` | The Ashen Steppe | new | 9 |
| `region_veil` | The Veil | new | 8 |
| `region_glowfen` | The Glowfen | new | 8 |
| `region_skyreach` | The Skyreach | new | 5 |
| `region_threshold` | The Threshold | new | 4 |

### A.2 Locations (21 legacy)

| id | legacyName | region |
|---|---|---|
| `loc_whispering_ruins` | Whispering Ruins | `region_silverwood_ruins` |
| `loc_crumbling_archway` | Crumbling Archway | `region_silverwood_ruins` |
| `loc_darkened_corridor` | Darkened Corridor | `region_silverwood_ruins` |
| `loc_shattered_library` | Shattered Library | `region_silverwood_ruins` |
| `loc_silverwood_plaza` | Silverwood Plaza | `region_silverwood_ruins` |
| `loc_sunken_archives` | Sunken Archives | `region_silverwood_ruins` |
| `loc_heartstone_depths` | Heartstone Depths | `region_silverwood_ruins` |
| `loc_mistwood_path` | Mistwood Path | `region_mistwood_ironclad_reach` |
| `loc_wayfarers_respite` | The Wayfarer's Respite | `region_mistwood_ironclad_reach` |
| `loc_ironclad_camp` | Ironclad Camp | `region_mistwood_ironclad_reach` |
| `loc_barren_peaks` | Barren Peaks | `region_mistwood_ironclad_reach` |
| `loc_blighted_outpost` | Blighted Outpost | `region_mistwood_ironclad_reach` |
| `loc_emberforge` | The Emberforge | `region_mistwood_ironclad_reach` |
| `loc_chasm_of_whispers` | Chasm of Whispers | `region_voidscar` |
| `loc_voidscar_hollow` | Voidscar Hollow | `region_voidscar` |
| `loc_shimmering_pass` | Shimmering Pass | `region_aether_kissed_highlands` |
| `loc_aetherium_spires` | Aetherium Spires | `region_aether_kissed_highlands` |
| `loc_sky_whisper_plateau` | Sky-Whisper Plateau | `region_aether_kissed_highlands` |
| `loc_veridian_glowlands` | Veridian Glowlands | `region_glowlands_nexus` |
| `loc_chronos_nexus` | The Chronos Nexus | `region_glowlands_nexus` |
| `loc_temporal_breach_apex` | The Temporal Breach Apex | `region_glowlands_nexus` |

Threshold locations: `loc_still_shore`, `loc_gallery_of_loops`, `loc_loom`, `loc_far_light`. Legacy exit graph (must be preserved exactly, with the legacy locks expressed as `when` + `lockedText`; WORLD §11 adds the new edges): Whispering Ruins N→Crumbling Archway, E→Mistwood Path, S→Sunken Archives; Crumbling Archway N→Darkened Corridor; Darkened Corridor N→Shattered Library; Shattered Library E→Silverwood Plaza; Silverwood Plaza S→Mistwood Path, E→Chasm of Whispers; Chasm E→Voidscar Hollow (locked until Nyx spoken to); Mistwood Path E→Ironclad Camp, S→Wayfarer's Respite; Ironclad Camp N→Barren Peaks (locked until Brak spoken to); Barren Peaks E→Blighted Outpost; Blighted Outpost S→Sky-Whisper Plateau, N→Emberforge; Sunken Archives S→Heartstone Depths; Heartstone Depths E→Shimmering Pass; Shimmering Pass E→Aetherium Spires; Spires E→Plateau; Plateau E→Veridian Glowlands; Glowlands E→Chronos Nexus; Nexus N→Apex (locked by the D-048 Apex gate, `config.apexGate`); all with reverse exits.

### A.3 Creatures (12 legacy)

`cr_corrupted_shade`, `cr_wildling_brute`, `cr_arcane_wisp`, `cr_drowned_archivist`, `cr_void_touched_stalker`, `cr_stone_hide_golem`, `cr_shimmering_phantom`, `cr_aetherial_weaver`, `cr_sky_whisper_sentinel`, `cr_glowfen_mireling`, `cr_temporal_aberration`, and the legacy "The Chronos Tyrant", split by D-051 into `cr_chronos_tyrant_contained` (Loop 1) and `cr_chronos_tyrant_unveiled` (Loop 2+). Legacy stats (hp/dmg/def/agi/xp) are the authoring baseline only (DESIGN §6.5 and WORLD §6 set the new numbers): Shade 30/8/2/4/35, Brute 45/10/3/3/40, Wisp 25/6/1/6/30, Archivist 35/7/2/4/45, Stalker 40/9/2/6/55, Golem 50/12/5/2/85, Phantom 32/7/2/7/45, Weaver 38/8/3/5/55, Sentinel 42/9/3/5/60, Mireling 36/7/2/4/50, Aberration 55/12/4/6/85, Tyrant 126/14/5/4/180. Legacy loot: Shade→Dark Spellbook (D-055: first Shade each loop 100 %, later 50 %); Brute→Ley-Touched Tonic (+ Wildling Hide Armor); Wisp→Tonic; Archivist→Mana Bloom; Stalker→Void Shard (+ Warrior's Sword); Phantom→Chronal Dust; Weaver→Aetherium Shard; Sentinel→Sky-Whisper Talisman; Mireling→Glow Moss; Aberration→Chronal Dust.

### A.4 Items (26 legacy)

| id | legacyName | type (DESIGN §7.7) |
|---|---|---|
| `item_rusty_dagger` | Rusty Dagger | weapon `melee` |
| `item_amulet_of_echoes` | Amulet of Echoes | quest (bound, slotless; never reset, grants `itm_echo_bolt`, D-047) |
| `item_ley_touched_tonic` | Ley-Touched Tonic | consumable |
| `item_ironclad_mail` | Ironclad Mail | armor |
| `item_echo_crystal` | Echo Crystal | quest |
| `item_dark_spellbook` | Dark Spellbook | tome |
| `item_mana_bloom` | Mana Bloom | consumable |
| `item_scholars_lost_scroll` | Scholar's Lost Scroll | quest |
| `item_void_shard` | Void Shard | material |
| `item_shadow_kissed_dagger` | Shadow-Kissed Dagger | weapon `melee` |
| `item_ironclad_plate_armor` | Ironclad Plate Armor | armor |
| `item_stabilized_heartstone` | Stabilized Heartstone | trinket (bound) |
| `item_heartstone_core` | Heartstone Core | trinket (bound) |
| `item_chronal_dust` | Chronal Dust | consumable (also a material) |
| `item_glow_moss` | Glow Moss | consumable |
| `item_aetherium_shard` | Aetherium Shard | material |
| `item_sky_whisper_talisman` | Sky-Whisper Talisman | trinket + key |
| `item_chronos_lens` | Chronos Lens | trinket + key |
| `item_travelers_sword` | Traveler's Sword | weapon `melee` |
| `item_primitive_bow` | Primitive Bow | weapon `ranged_bow` |
| `item_elven_bow` | Elven Bow | weapon `ranged_bow` |
| `item_apprentice_staff` | Apprentice Staff | weapon `magic_staff` |
| `item_necromancer_staff` | Necromancer Staff | weapon `magic_staff` |
| `item_warriors_sword` | Warrior's Sword | weapon `melee` |
| `item_wildling_hide_armor` | Wildling Hide Armor | armor |
| `item_glyphbound_lantern` | Glyphbound Lantern | trinket |

### A.5 NPCs, companions, classes, factions, quests, merchants

- NPCs (WORLD §4 ids, D-064): `npc_ilyra` (Remnants, `loc_whispering_ruins`), `npc_brak` (Ironclad, `loc_ironclad_camp`), `npc_nyx` (Weavers, `loc_chasm_of_whispers`), `npc_kaelen_stonehand` (neutral, `loc_wayfarers_respite`), `npc_borin_stonefist` (Ironclad, `loc_emberforge`). New: `npc_dask`, `npc_mireya`, `npc_caelum`, and the rest of WORLD §4.
- Companions (plain ids; companion id ≠ NPC id): `ilyra`, `brak`, `nyx`, `dask`, `mireya`, `caelum`; each NPC record carries `companionId`.
- Classes: `ranger`, `wizard`, `elf`, `ironclad_warden`, `shadow_weaver`. Branches: ranger `hunt|steel|wildcraft`; wizard `pyre|storm|chronomancy`; elf `bladesong|leyweave|shadowstep`; ironclad_warden `bulwark|breaker|iron_will`; shadow_weaver `hex|drain|unmaking`. Ability prefixes `rgr_`, `wiz_`, `elf_`, `wrd_`, `wvr_` (D-061); legacy spells `wiz_echo_bolt`, `wiz_fireball`, `wiz_lightning_bolt`.
- Factions: `remnants`, `weavers`, `ironclad`.
- Legacy quests (names preserved, ids prefixed): `q_echo_crystal` "Echoes in the Library", `q_lost_scroll` "The Scholar's Lost Scroll", `q_clear_path` "Clear the Barren Peaks", `q_blighted_outpost` "The Blighted Outpost", `q_void_shards` "Whispers of the Void", `q_echoing_heartbeat` "The Echoing Heartbeat".
- Merchants are keyed by NPC id (WORLD §9): `npc_kaelen_stonehand`, `npc_borin_stonefist` (buy/sell/upgrade), plus WORLD's other six.
- Legacy flags → new state: `kept_echo_crystal` → `flag_kept_echo_crystal`; `heartstone_outcome` → `world.heartstone`; `chronos_tyrant_defeated` → `world.tyrant = 'defeated'`; `defeated_wildling` → `{ killed: { id: 'cr_wildling_brute' } }`; `ilyra_at_portal` → `world.npcOverrides.npc_ilyra.location = 'loc_shattered_library'` + `flag_portal_open`; `heartstone_unlocked` → quest `q_echoing_heartbeat` active; `apex_first_entry` → location flag + `echo_apex_resonance` grant; `spellbooks_read_count` → `player.corruption`.
- Endings: `ending_wardens_vigil` (A), `ending_mending` (B), `ending_weavers_dawn` (C), `ending_iron_silence` (D), `ending_long_archive` (E), `ending_unbound` (F); closers `closer_escape` and `closer_fall` (reason `death` | `expiry` | `rejected`). There is no `loop1_death` closer: a Loop 1 non-Horde death is the FALLEN game-over (D-049).
- Statuses: the 19 canonical `status_*` ids in §5.8. Damage types: `physical|fire|storm|ley|void|chrono`. Stats: `strength|magic|agility`.

### A.6 Echo ids referenced by DECISIONS.md (must exist)

`echo_crystal_location`, `echo_ilyra_watchword`, `echo_litany_verse_1`, `echo_litany_complete`, `echo_nine_voices`, `echo_heartstone_resonance`, `echo_void_resonance`, `echo_brak_death`, `echo_apex_resonance` (D-048), `echo_tyrant_speaks`, `echo_tyrant_consent` (D-054). The full catalog is STORY §12 (101 after U9, REGISTRY §6); content units never invent Echo ids.

---

## Changelog (U8)

Revision U8 (2026-10-13) applies D-065, D-066, `docs/reviews/REVIEW-DESIGN-PLAN.md` findings 2, 3 and 14–22, REVIEW-CROSS §4's U8 list and every REGISTRY-DRAFT action that targets PLAN.

- **Header / §1:** canon D-001..D-066; gates rewritten for D-065 (`tsc` strict flags, `tools/lint.ts`, `.editorconfig` instead of Prettier, `bun test` + `bunfig.toml` thresholds + per-directory gate, relative-URL build); Loop 1 completion = Escape rate; soft-lock K = 60 with Before/Threshold/dialogue excluded; balance targets = DESIGN §19; e2e flow uses `loadScenario`; in-repo a11y checks.
- **§2:** tree updated (no Vite/ESLint/Prettier/dependency-cruiser configs; `src/types/` shims; `tools/{build,dev,lint,link-local-deps,serve,coverage-gate,a11y}`; `src/ui/App.tsx`; `derived.ts`, `communion.ts`, `before.ts`, `specials.ts`, `clone.ts`, `scenarios.ts`); §2.3 layer rule moves into `tools/lint.ts`.
- **§3 (replaced):** exact pins (esbuild 0.28.2, typescript 6.0.3, react/react-dom 19.2.8, zod 3.25.76, playwright 1.56.0, @types/node 26.2.0, tsx 4.23.12; bun 1.4.2); scripts `build/dev/typecheck/lint/test/test:e2e/validate/sim/sim:balance/check`; `tsconfig` (verified with tsc 6.0.3); `bunfig.toml`; lint rules; esbuild build/dev; offline bootstrap; React/bun type shims; `playwright.config.ts` from `playwright/test`.
- **§4:** typed D-044 ids; D-041/D-043/D-065 (`structuredClone`, lazy profile clone, dev deep-freeze; no immer/`configureEngine`); `GameState` gains `clock` (ticks), `before`, `player.statuses`/`uses`/`apHalf`, item `affixes` (no `upgrade`), combatant `atk/sp/armor/ward`, ordered-pattern state, committed `Intent`, `CommunionState`, scatter/encounterHp/gather, closer outcome + reason; `Profile` attunements owned/equipped, bestiary `revealed`, mastery `bestLevel`, `loopCounter`; new actions (`rest` kinds, `retreat`, `gather`, `respec`, `salvage`, `commune`, `equipAttunement`) and events; §4.9 one canonical condition/effect set (= DESIGN §13.3); §4.10 replaced by "implement DESIGN exactly" + engine-shape notes; §4.11 clock/Horde/Before/closers per DESIGN §10 and D-049/D-060; §4.12 saves `version 1`, `profileLoopAtSave`, DESIGN keys; new §4.13 `loadScenario`.
- **§5:** primitives with `PId`, `strength/magic/agility`, `neutral` resistance; creature schema rebuilt on `moves` + `pattern` + OR-trigger phases + communion spec + `fam_*` + armor/ward/SP; item schema (nine types, five weapon types, power/spellPower/armor/ward stats, camelCase passives, Amulet `grantAbility`); recipe schema per DESIGN §8.1 (story recipes 0 gold, Neutral override); ability schema (`coef·atk|sp`, multi-hit, bonuses, self-costs, onKill, half-point cost) and class resource rules; 19 statuses with `status_` ids; quest `botHint`; companion schema without MP, D-059 flag; attunements without ranks (equip cap 5); modifier/ending/merchant ids and DESIGN prices; `GameConfig` defaults from DESIGN; validator rules updated (moves/pattern, specials mirror, counts per D-045 and the registry).
- **§6:** `src/ui/App.tsx`; no `404.html`; communion bar; keyboard map = DESIGN §16.4 with Shift-panels in combat; contrast via in-repo token test; `sfx_*` ids; music bus.
- **§7:** bun runtime; melee bot Destroys only at day ≤ 10; caster/pacifist use communion; scenario starts; budget re-measured for `structuredClone`; fixture-pack-only committed traces; metrics map DESIGN §19.
- **§8:** test matrix rewritten to DESIGN rules (status timing, interplay table, ordered intents, OR phases, scatter, communion, Before, clock floor, Horde delay, Amulet kept); soft-assert collector replaces `expect.soft`; UI tests = `react-dom/server` snapshots in bun + Playwright `?gallery=`; esbuild `define` replaces `import.meta.env`; §8.4 in-repo a11y checks.
- **§9 (replaced):** ordered unit list U11–U91 (81 units: Opus 37, Sonnet 30, ✦ Fable 13, plus U91 ✦ Fable with the lead) with dependencies, owned paths and done-when; checkpoints C1–C6; ownership collisions of the old map resolved (derived.ts → U21, specials mirror, legacy README → U10, UI tests per area, communion → U29/U58, Before → U32, expiry Horde → U30, shims/lint → U10, scenarios → U36).
- **§10:** D-044 id rule; unit-scoped commits and done-definition; audit checklist updated to D-045/D-065/D-066.
- **§11 (replaced):** CI with setup-node 22 + `npm install` (exact pins, no lockfile, no npm cache), `oven-sh/setup-bun`, version check, Playwright Chromium install keyed on `playwright/package.json`, smoke + full e2e + dispatch sim; Pages deploys `dist/` (relative URLs) from `main`; local equivalence table.
- **§12–§13:** risks updated (structuredClone cost, offline drift, type-shim gaps); open questions reduced to four.
- **Appendix A:** every id per D-044 / REGISTRY-DRAFT; Tyrant split (D-051); closers without `loop1_death`; Echo list per D-044/D-048/D-054.

*End of PLAN.md v1.1.*
