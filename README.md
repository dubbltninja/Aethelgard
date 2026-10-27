# Echoes of Aethelgard: The Unraveling

A time-loop RPG for the browser. You are the eighth Wayfinder. You wake in the Whispering Ruins of Silverwood with an
amulet you don't remember picking up, and thirty dawns before the Breach tears open. Seven Wayfinders came before you, and
none of them saw the thirtieth dawn. When the clock runs out, or you fall, or you step through Ilyra's portal, the world
resets to the first morning. You keep what you learned. Those **Echoes** open doors: answers you couldn't have known,
routes you couldn't have found, and in the end the question of what the Chronos Tyrant really is and whether you should
kill it at all.

It's a rebuild of the original Python text RPG (still playable, in [`legacy/`](legacy/README.md)). The legacy quests,
names and lines are kept word for word as Loop 1, and the loops after it are new. It has five classes, six companions with
their own arcs, 12 regions and 73 places, turn-based fights with telegraphed intents, 49 quests, 103 Echoes, a 90-entry
codex, and six endings plus the two loop closers. Everything runs client-side, with no server and no account. Your saves
stay in your browser.

<!-- U91 part 2: SCREENSHOTS. Regenerate docs/screenshots/{desktop,mobile}/*.webp from the current build (the @screens spec)
     and put 3–4 of them here (suggested: explore, a fight, dialogue, a phone view). -->
> **Screenshots:** *to be added after the final build (U91 part 2).*

## Play

- **In the browser:** <https://dubbltninja.github.io/Aethelgard/>. It goes live once `main` deploys (see
  [Deploy](#deploy)).
- **Locally:** `npm run dev` (needs Node 22 and bun 1.4.2; see [Develop](#develop)). Or build with `npm run build` and
  serve `dist/` with any static file server. The build uses relative URLs, so it works from any sub-path:

  ```bash
  npm run build
  node tools/serve.mjs dist 4173 --base /Aethelgard/   # or: npm run preview
  # open http://localhost:4173/Aethelgard/
  ```

The game works on desktop and on phones (portrait and landscape). On a phone the actions sit in a pinned bar at the bottom.

### Controls

Everything works by mouse or touch. Press **?** in the game for the full key list of the current screen.

| Where | Keys |
|---|---|
| Anywhere | **?** all keys · **Ctrl+S** save to the autosave slot · **Ctrl+L** saves · **Ctrl+M** mute · **Esc** close / back |
| Panels | **I** inventory · **K** abilities · **Q** journal · **C** codex · **B** bestiary · **M** map · **L** loop timeline (in a fight, hold **Shift**) |
| Exploring | **Arrow keys** move around the compass pad, **Enter** travels · **1–9** the place's actions · **E** take everything · **R** short rest · **Shift+R** full rest · **W A S D** move on the map when it has focus |
| Combat | **1** attack · **2–9** abilities in the order shown · **G** guard · **F** flee · **I** use an item · **C** command your companion · **← / →** change target |
| Dialogue | **1–9** pick an answer · **↑ / ↓** move between answers · **Enter** or **Space** continue |

## Develop

The toolchain is TypeScript, React 19, zod, esbuild, bun 1.4.2 (tests, sims, tools) and Playwright (Chromium). The exact
versions are pinned in `package.json`, and there's no lockfile.

```bash
npm install                      # with network (CI does this)
node tools/link-local-deps.mjs   # offline: links the pinned packages from /opt/npm-tools instead
npm run dev                      # dev server with rebuild on change
npm run check                    # the CI gate: typecheck, lint, validate, unit tests + coverage gate, build, e2e smoke
```

| Command | What it does |
|---|---|
| `npm run typecheck` / `npm run lint` | `tsc --noEmit`; the repo's own lint rules (`tools/lint.ts`: engine purity, content literals, …) |
| `npm run validate` | builds the content pack and runs every cross-reference and semantic rule (`src/content/validate.ts`) |
| `npm test` | `bun test` (about 4,900 unit tests) and the coverage gate |
| `npm run test:e2e` | an e2e build, then the full Playwright suite (`E2E_PORT` sets the port; `--grep @smoke` for the smoke set) |
| `npm run sim -- --bot melee --class ranger --seeds 20 --pack real` | bots play seeded runs and report errors and soft-locks |
| `npm run sim -- quest [<questId>…] --pack real` | the quest proofs: a scripted path that completes each quest outcome |
| `npm run sim:endings` | plays every ending's script (8/8) |
| `npm run sim:balance` | the balance batch, written to `docs/BALANCE.md` |
| `npm run sim:replay` / `bun tools/record-traces.ts` | replays or re-records the committed traces (`tests/fixtures/traces/`) |

**Determinism.** The engine is a pure reducer: `step(state, action, ctx) → state + events`, and every random draw comes from
a seeded RNG. A run replays exactly from its seed and actions. Committed traces are checked in bun and in the browser, and
the batch checks determinism on every run. If a change moves a trace hash, re-record the trace in the same commit and say
why.

### Project layout

```
src/
  engine/     the rules: a pure, deterministic reducer (combat, travel, the clock, loops, saves); no DOM, no Math.random
  content/    every authored table: schema/ (zod), regions/<region_id>/, shared/ (classes, quests, dialogues, codex,
              Echoes, endings), items/, abilities/; validate.ts is the release gate
  ui/         React screens, panels, art (backdrops, sprites, sigils), the store, hotkeys, a11y
  audio/      synthesized Web Audio: 30 SFX, region beds, the Tyrant's theme (no audio files)
  sim/        bots, quest proofs, ending scripts, the batch runner and BALANCE.md generator
tests/        unit/ (bun), e2e/ (Playwright), fixtures/ (small content packs, traces, golden saves)
tools/        build, dev server, lint, validate, coverage gate, trace recorder, offline dep linker, art helpers
public/art/   painted scenes, sprites and portraits (webp)
docs/         the design set (BIBLE, STORY, WORLD, DESIGN, PLAN), DECISIONS, BALANCE, REPORT, CONTENT.md
legacy/       the original Python game
```

To add a place, creature, quest or ending, see **[docs/CONTENT.md](docs/CONTENT.md)**. The canon is in `docs/BIBLE.md`
(names, timeline, who knows what), and the rulings are in `docs/DECISIONS.md`.

## Deploy

GitHub Pages builds from `main` (`.github/workflows/pages.yml`): `npm run build`, then upload `dist/` and deploy. Running
the workflow by hand on any other branch builds the artifact but never deploys it. CI (`.github/workflows/ci.yml`) runs
the same gates as `npm run check` on every push and pull request.

**One-time setup:** in the repository's **Settings → Pages → Source**, choose **GitHub Actions**.

## Known issues

These are trade-offs from the wrap-up (D-150) and the last balance rulings (D-149, D-151). They are accepted for this
release.

- **Some places hit harder than their level band says.** The Drowned Reach (levels 4–8) and the Aether-Kissed Highlands
  (5–8) are deadlier for their band than the Ashen Steppe next door (8 violations of the "difficulty rises steadily" target;
  D-151). The game warns you before you walk somewhere above your level, so come back later if a road looks dangerous.
  <!-- U91 part 2: confirm the wording against U84's danger cue ("Dangerous (L8+)" / "Deadly (L12+)"). -->
- **Gold piles up.** A thorough Loop 1 ends with about 900 gold and not much left to buy. Gold resets at the Threshold, so it
  costs nothing in later loops. A gold sink is on the list below.
- **Fights against the Contained Tyrant vary in length by class.** At level 11 a Wizard takes about 10 rounds, while an Elf or
  an Ironclad Warden takes about 25. Fights against the Unveiled Tyrant run about 21 rounds. The samples for the Unveiled
  Tyrant and the regional bosses are small (D-149 #6).
- **Casters die more on the way in.** In the batch, 47 % of the caster bot's Loop 1s were death-free inside the level band,
  against a 55 % target (a small sample; D-151).
- **One loop can't show you everything.** A full sweep of Loop 1 is about 124 trips, against a 30-day clock. That's
  deliberate: the loop is the premise (D-149 #3). A rushed run that heads straight for the Apex under-levelled can still run
  out of time.
- **Less-tested corners.** The bots don't reach a few things, though a player can: the Loop 4+ creatures (the Hour Leech,
  the Redundant Wayfinder), the Unraveling Tide set piece in a Horde, seven late forge patterns, the Voidforged set (refuse
  the shards, then Ironclad 20) and the Ward Seal (D-151). Their content is validated, but no bot has played them through.
- **Tested in Chromium only.** The automated suite runs Chromium. Firefox, Safari and real phones have been checked by hand
  only in part (D-140).
- The 1,000-run release batch replaced the planned 2,000, and the three fun reviews became one fun pass (D-150).

<!-- U91 part 2: KNOWN ISSUES FROM U84. Add the fun pass's unfixed findings (REPORT.md, "U84 fun pass") and the status of
     REPORT U79's open findings (#3–#6, #8, #10–#13) and D-148's layout leftovers once U84 merges. Remove any item above
     that U84 fixed (e.g. Blood price usage). -->
> **From the final fun pass:** *to be added once U84 merges (U91 part 2).*

## What's next

If development continues, these are the obvious next steps (REPORT.md has the full list):

- a gold sink that fits the lore, so Loop 1's surplus means something;
- a tuning pass on the Drowned Reach and the Highlands, and on Elf and Warden damage against the Tyrant;
- bots that play the Horde set piece and the late forge, to cover the last untested corners;
- testing on real phones and in Safari and Firefox.

## Credits

- **A game by Tim Dibert.** Design direction, playtesting, and every approval.
- **Art:** the scene backdrops, sprites and portraits were made with Grok Imagine and approved by Tim.
- **Audio:** all sound is synthesized live with the Web Audio API. There are no recorded samples.
- **The original game:** *Echoes of Aethelgard*, the Python text RPG in [`legacy/`](legacy/README.md), whose story, names
  and lines are Loop 1.
- Built with the help of AI agents (Claude, plus one Codex playtest). The record of who did what is in `docs/DECISIONS.md`
  and `docs/STATUS.md`.
