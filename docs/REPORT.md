# REPORT.md — experience gates, playthroughs and fun reviews

The record of PLAN §1.3's experience gates: the integration checkpoint, the hand playthroughs, the three fun-review rounds
and the final audit. Each section is dated. Findings are numbered and carried to the unit that fixes them.

---

## U79 integration checkpoint — 2026-10-26

**Saves.**
- **Versions.** `SAVE_VERSION` and `PROFILE_VERSION` are 1, and `migrations` and `profileMigrations` are empty. A test fails if
  a version is bumped without its migration step.
- **Unversioned files.** A file with no `version` loads as v1 if it fits v1 exactly (strict schema, state version, content
  check), with `migratedFrom` = `UNVERSIONED` (0). Otherwise it is refused, with a message that it predates the frozen
  format, naming the bad fields. Profiles follow the same rule.
- **Future versions** are refused without throwing, in `deserialize`, the profile and `load` (as `actionRejected`), with
  "written by a newer version of the game … update the game".
- **Golden files** in `tests/unit/engine/saves/golden/`: a Loop 1 mid-run (Ranger L8), a Loop 2 run (L10, day 22) and its
  profile (10 Echoes, 20 codex). They are loaded, round-tripped and resumed in `checkpoint.test.ts`, and **never
  re-recorded**.

**Traces.**
- 24 in `tests/fixtures/traces/`:
  - 18 on the fixture packs: the melee, caster, random, explorer, speedrunner and pacifist bots, plus the `loop2_day1` and
    `loop2_end` scenarios;
  - 6 on the real pack: 400-action Loop 1 runs for the five classes, and one Loop 2 run from `loop2_day1`.
- **Gates.** In bun, `traces.test.ts`; its header holds the rule: re-record in the same commit as the change that moves a
  hash, with the reason. In the browser, `replay.spec.ts` replays the 6 real-pack traces on both projects.
- **Re-record** with `bun tools/record-traces.ts [--pack P | names]`.
- PLAN/D-066 #18 allowed committed traces on the fixture packs only. The browser build carries only the real pack, so
  real-pack traces were added too; fixture parity stays in bun.

**Hand playthrough** (desktop 1280×800, an `--e2e --real-art` build, Playwright plus screenshots):
- **Loop 1:**
  - the Amulet; Ilyra's Echo Crystal; the first fight, a Mistwood Prowler at the Archway;
  - the Corridor, the Library, the crystal (*give*), the Lost Scroll (the Drowned Archivist), the Echoing Heartbeat;
  - the Heartstone *Stabilize* (clock 116 → 140, L5, day 3); saved to slot 1.
- **The Tyrant:** `?scenario=pre_tyrant_l13_ranger` lost twice at L13, so the run was won at `&level=20`. Then Brak's stand,
  the Horde run to the Library, the portal, two closer slides, the Run Summary and *Wake in Loop 2*.
- **Loop 2:**
  - the waking scene and Echo-locked answers, two fights, a save to slot 2;
  - reload + Continue (the state deep-equals the pre-save state);
  - Load slot 2, the Library, another reload + Continue.
- No console or page errors. **Blockers: none.**
- Worked well: the art, class select, combat readability (intent chips, the Guard preview, phases, the victory card), the
  quest flow, the Heartstone's clock change, the Horde map hatch, the closer slides and summary, saves.

**Findings for the fun review / fixes** (numbered for reference):
1. Up to four toasts stack at the top right on desktop. They cover the HUD clock chip, the map and the narration lines in
   dialogue (the Heartstone's "You sense three paths…", Brak's "Don't look back"). This is wider than D-139's note.
2. At 1280×800 the combat actions are below the fold, and the first-fight callout sits on top of them.
3. The first fight was a Prowler, not the Shade with forced intents (D-121; U81a). It acted before its intent could be read.
4. Ilyra offers the Lost Scroll only on a second talk (cf. D-140's revisit cues).
5. The Echo Crystal stays hidden until *Look around*, while the journal says "take the crystal".
6. Walking back through exits re-triggers fights: about 35% HP at L2 from the Library to the Ruins. It feels grindy.
7. The Contained Tyrant at L13 won twice. Ability keys lost with the Tyrant at 7/460 in round 11. Healing below 45% lost
   worse, with 170 HP left in round 21. Potions heal 25–50 per turn against about 55 incoming per round. → U81b (D-138).
8. The FALLEN text at the Apex says "This loop is over" but offers to load a slot or the autosave (D-049).
9. The combat key legend lists `I` twice (Use an item / Inventory).
10. In scenarios only, the Run Summary says "The Heartstone: Intact". `pre_tyrant_*` sets `q_echoing_heartbeat`
    `done_destroy` without `flag_heartstone_destroyed` (`src/sim/scenarios.ts`).
11. No autosave after a dialogue outcome. After the Heartstone choice and level-up the autosave was still at the Archives
    (L4), so closing the tab loses the choice. This matches DESIGN §14.2's triggers; consider autosaving at quest
    completion.
12. Loading a slot mid-run does not ask to confirm.
13. Respec says "only at a camp fire" while you stand at a place tagged Camp; you must open the Camp screen first.

**Gates:** `npm run check` green (4,761 unit tests, the coverage gate, smoke 10/10); full e2e 343 passed, 15 skipped; replay
parity in bun and in the browser.

---

## U84 fun pass — 2026-10-27

**How it was played.** An `--e2e --real-art` build, driven by hand-written Playwright steps with screenshots after each beat, as a
first-time player: desktop 1280×800 (Ranger) and a phone 390×844 (Shadow Weaver), plus the phone turned to 844×390.
- **Loop 1, the first hour:** class select; Ilyra's quest; the Amulet; the Archway; the Corridor's Shade (the first fight);
  the Library's Wisp; the Crystal; the walk back south; *Give*; the Lost Scroll.
- **A boss and a death:** `?scenario=pre_tyrant_l13_ranger` (*Face it*), won at L13 with abilities (≈11 rounds; phases at
  rounds 1, 6 and 8); lost at L13 with plain attacks only (round 15, Phase 3), which is the death and the Apex FALLEN screen.
- **The long Tyrant (D-149 #6):** the Contained Tyrant at L13, 6 seeds per class with the melee bot (`runLoop` on the
  scenario): elf 20–30 rounds, warden 13–22, weaver 15–20, ranger 10–14, wizard 7–10.

**What was fun** (2026-10-27):
- The first fight now teaches. The Shade is the first fight (the Archway's Prowler waits for Loop 2), you act first, the
  Wail chip is read before it lands, Guard visibly halves the Rake. The hint sits beside the intent, not on the controls.
- The first hour flows: the Crystal lies on the Library floor while the journal asks for it; Ilyra offers the Scroll in the
  same talk; **0 fights on the 3-step walk back** (U79: ~35 % HP).
- The Tyrant reads as a final boss: three phase banners with their lines, the segmented HP bar, Remember's rewind as a threat.
- The Blood price toggle is clear on the phone sheet: "On · +25 %", the cost in red HP.

**What dragged:**
- **The elf's and warden's Tyrant (D-149 #6).** 20–30 rounds against the wizard's 7–10. The brief's "last 15 % faster" was
  tried (×1.5 below 15 % HP): it saved about **one** round (elf 25 → 24 median), because the length is the whole fight
  (armor 6 / ward 8, Brace shields, Remember's +46 HP), not a tail. **Ruled: not a slog to fix with a rule** — the three phase
  banners and the Phase 3 round-12 trigger already pace it; the class spread is §19 #19's, accepted in D-149. Reverted; known
  issue.
- Remember rewinding +46 HP late in Phase 3 reads as lost progress (known issue).

**What confused:**
1. A full ability bar (13 tiles in five branches) at 1280×800 pushed the Tyrant's HP bar below the fold of its card. **Fixed:**
   on a wide screen up to 900 px tall the stage shrinks when the bar has four or more branches.
2. The pad's danger cue truncated to "Dangerous…", losing the level. **Fixed:** the cue's type is smaller so "Dangerous (L2+)"
   fits the slot.
3. Landscape phone (844×390): the hint (three lines) and a 210 px stage left no room for the card or the log. **Fixed:** on
   short screens the hint is one line (title, the start of its words, its buttons) and the stage is a strip.
4. At 1280×800 a hint shrank the docked map (D-148). **Fixed:** in explore the hint lies over the top of the log's cell, under
   its heading, instead of taking a row. (Tried in a fight too: it hid the log's lines you click to read a hit, so a fight keeps
   U84a's reserved row, and on short screens the hint is one line.)
5. The Apex FALLEN said "This loop is over" while offering loads (U79 #8). **Fixed:** the words follow the offer.
- Known issues (not fixed): at Level 1 every exit from the Ruins reads "Dangerous (L2+)" (the rule is the brief's; it is loud in
  the first hour); four queued toasts ("Achievement: First Steps" +4) sit over the stage as the first fight opens; a new
  character enters the first fight without a class ability unless the AP toast was heeded; the hint covers the log's only
  line at the start of the first fight on desktop.

**U84's other fixes, for the record:** the danger cue on the pad and the map (D-149 #1); the empowered Blood price (D-149 #4);
U79 #3, #4, #5, #6 ("the wilds go quiet": 2 travels after any fight), #8, #11 (autosave on quest completion and after a
flag-setting choice, written when the scene closes), #12 (load confirms mid-run), #13 (the place card says "Camp" only where
the fire is usable; respec's refusal names the way).

---

## Final audit (U91) — 2026-10-27

From a clean clone of `unraveling` at `2b3b53d` (U82, U84 and U91 part 1 merged), with `node tools/link-local-deps.mjs` and
`E2E_PORT=4410`. Everything passed:

| Gate | Command | Result |
|---|---|---|
| The CI gate | `npm run check` | **green**: typecheck, lint, validate, 4,944 unit tests (0 failed) and the coverage gate, build, smoke 10/10 |
| The full e2e suite | `npm run test:e2e` | **361 passed, 0 failed**, 47 skipped (the `@screens` captures and the per-project skips), 11.0 min, desktop and mobile Chromium |
| Quest proofs | `npm run sim -- quest --pack real` | **81/81** |
| Ending scripts | `npm run sim:endings` | **8/8**: the six true endings and both closers, every slide shown |
| Pages build from a sub-path | `npm run build`, then `node tools/serve.mjs dist 4410 --base /Aethelgard/`, opened in Playwright (Chromium, 1280×800) | **pass**: the title, New game, class select, explore with the painted backdrop, then Ilyra's dialogue with its words from the lazy chunk. Everything (the JS, the CSS, the scene, sprite and portrait art, and 3 text chunks) loaded from under `/Aethelgard/`, with 0 responses ≥ 400 and 0 console or page errors |
| Bundle | the `npm run build` output | **JS 529.5 kB gzip** (budget 600 kB); the text: 15 chunks, 75.0 kB gzip, loaded on first use |

### PLAN §10.7 checklist

Each item with its evidence. Every test named is in the green clean-clone run above.

| Item | Evidence | ✓/✗ |
|---|---|---|
| D-001 names preserved | `tests/unit/content/legacy.test.ts` (string equality with `legacy/aethelgard_data.py`) | ✓ |
| D-002 both loop closers reachable | `sim:endings` (`closer_escape`, `closer_fall`) | ✓ |
| D-005 clock 30 base, warnings, Loop 1 subtle | `newRun.test` (Day 1 Dawn, the base clock); `loop.test`, `explore.test`; Borin's and the NPCs' lines; the U79 playthrough | ✓ |
| D-008 five classes × 15 abilities, mastery | rule 13; 75 class abilities in the pack | ✓ |
| D-009 intents, statuses, interplay, bands, boss phases, flee rules | rules 11 and 14 (19 statuses); `fleeRules.test`; combat tests | ✓ |
| D-010 STORY §12 Echoes, exclusivity, shortcuts, routes | 103 Echoes; rule 16 | ✓ |
| D-011 persist/reset field by field | `reducers/loop.test.ts` and `threshold.test.ts` (the carry-over level, what resets); `newRun.test` (the Amulet from Loop 2, D-047) | ✓ |
| D-012 four Threshold areas | the Still Shore, the Gallery of Loops, the Loom, the Far Light (`regions/threshold`); `threshold.spec.ts` | ✓ |
| D-013 six companions with arcs and constraints | rule 18; 18 companion quests with proofs | ✓ |
| D-014 tiers and gates | faction tests; 4 faction quests | ✓ |
| D-015 73 locations in 12 regions | rule 21; `reachability.test` | ✓ |
| D-016 Silverwood Before anchors | `before.test.ts` (20 tests); `silverwood_before.test.ts`; ending B's and Caelum's proofs | ✓ |
| D-017 every consequence present | quest proofs per outcome | ✓ |
| D-018 six endings + closers, epilogues, achievements | rule 15; `endingsText.test`; 40 achievements | ✓ |
| D-045 44 quests (+5 class) | 49 quests, 81 proofs | ✓ |
| D-020 codex: four voices, ≤ 220 words | 90 entries (85 planned plus D-101's additions); rule 17; `codex.voice.test`; unlocks by `unlockWhen` (`codexUnlock.test`) | ✓ |
| D-021 NG+, six modifiers, 40 achievements, run summary | rule 19; 6 modifiers, 40 achievements | ✓ |
| D-022–D-026 continuity (BIBLE spot checks) | the continuity pass below, re-run after U84's merge: no WORLD §6 differences | ✓ |
| D-027 credit line | `credits: true` on every true ending; README | ✓ |
| D-030–D-040, D-065 engineering | `npm run check`; CI; Pages | ✓ |
| D-041–D-066 rulings | each one's test or content check is in the suite (e.g. D-043 `legalActions.property.test`, D-044 rule 6, D-049 the FALLEN screen (`combatScreen.test`), D-054 `communion.test`, D-060 `horde.test`) | ✓ |

### Continuity (U88, done in part 1)

Checked against `docs/BIBLE.md`:
- **Terminology** (§7): every banned form, grepped across `src/content/**`;
- **names**: every full name of the Nine, the companions and the NPCs;
- **dates** (§2): every "Year N" in shipped text against the timeline and the Ledger of Seven;
- **ages and spans**: Dask's seventy years, Nyx's forty, "five hundred years";
- **WORLD §6**: every creature's level, XP, stat line and move coefficients against the shipped numbers, by script.

Fixed:
- **STORY §7.6:** Caelum's signature is *Skipped Beat* (U81b2 renamed it from *Stutter*, which stays the Wizard's spell).
- **WORLD §6:** brought in line with U81b2's retune (the old values are struck through, as WORLD does elsewhere):
  - the Drowned Reach's Tide Clerk, Pale Diver, Brine Lamprey, Ledger Choir and Bell-Ringer, ATK −2;
  - Pale Diver Hold Under 1.1×, Ledger Choir Amend 0.9×, Null Mouth Gape 1.2×, Starved Shadow Feed 0.8× and Barrow-Light
    Gather 0.5×;
  - the Stone-Hide Golem 90 / 12 / armor 3;
  - Vell's Umbra L15;
  - the Contained Tyrant's Fracture (1 Aberration, none solo) and its Unraveling (0.8·SP);
  - the Shimmering Pass's Moths ×2;
  - the Orrery Knight's XP, 589 (DESIGN §6.2's rounding, which the engine uses).
- **Shipped text** (with the tests that pin it):
  - Keeper Dray's bell lines said the water took the Archive stair "in Year 1"; the flood was the night of the Sundering,
    so they now say Year 0;
  - "the Shore" alone, in two Echo codex lines and a `q_seven_marks` journal, is now "the Still Shore";
  - "Watch-Captain", in Dreyl's codex entry and his Pyre Ledger's description (and WORLD §9's item row), is now "the
    Captain" / "Captain Dreyl".
- **Tests that pinned the old divergences** were updated: the Drowned stats' "−2" offset, the Pass's Moth count and the
  Orrery Knight's 588.

Not changed:
- "Brak Stonehand" in the Apex arrival line is the legacy narration at his death, which BIBLE §7 allows.
- WORLD §6's 16 `cr_anomaly_*` variants are documented in its anomaly table (§12), not in the creature rows; their numbers
  were not compared.

**Known contradictions left: none.** The WORLD §6 comparison was re-run on the merged code after U84: no differences.

---

## Summary

*Echoes of Aethelgard: The Unraveling* rebuilds Tim's Python text RPG as a time-loop RPG for the browser. The legacy game is
Loop 1, kept word for word. Around it are thirty days on a Breach Clock, Echoes that persist from loop to loop, the
Threshold between loops, Silverwood Before (the city on its last three days, five hundred years ago), and six true
endings.

**The game, in numbers** (the real pack at `2b3b53d`, after U84):

| | |
|---|---|
| World | 12 regions, 73 locations; 38 NPCs, 8 merchants, 3 factions |
| Fights | 73 creatures (33 fodder, 9 elite, 22 anomaly incl. 16 variants, 9 bosses), 12 encounter tables, 19 statuses |
| Characters | 5 classes × 15 abilities, 6 companions (24 companion abilities), 8 Amulet/item abilities; 15 attunements |
| Story | 49 quests (6 legacy, 6 regional, 4 faction, 18 companion, 5 class, 4 loop, 6 ending); 228 dialogue scenes; 103 Echoes; 90 codex entries |
| Endings | 6 true endings + 2 loop closers; 40 achievements; 6 run modifiers (New Game+) |
| Items | 157 items, 31 recipes, 12 affixes |
| Art | 77 painted backdrops (with `@sm` copies), 67 sprites, 38 portraits, title art: Grok Imagine, approved by Tim |
| Audio | 30 synthesized SFX, region beds, the Threshold drone, the Tyrant's theme (Web Audio, no samples) |

**Engineering:**
- **Engine:** a pure, deterministic reducer, with a seeded RNG and replayable traces (24 committed, checked in bun and in
  the browser).
- **Saves:** frozen at v1 with golden files, plus migration tables (D-142).
- **Content:** zod-validated, with 22 cross-reference rules.
- **UI:** React, with an in-repo a11y check on every screen, a fixed movement pad, and one-screen layouts on desktop and
  phones (D-148).
- **Tests:** 4,944 unit tests plus the coverage gate; 361 e2e (desktop and mobile Chromium), with in-repo a11y checks on
  every screen; 81 quest proofs; 8 ending scripts.
- **Bundle:** JS 529.5 kB gzip of a 600 kB budget, plus 75.0 kB of lazily loaded text.

**Balance** (U82's release batch; BALANCE.md "After U82"):
- **Runs:** 1,499 (990 main, 420 scenario, 8 ending scripts, 81 quest proofs).
- **Health:** 0 engine errors, 0 soft-locks, determinism 200/200.
- **Coverage:** quests 49/49, locations 73/73, endings 8/8, creatures 70/71 (two are Loop 4+ by design), items 146/157.
- **Gates:** Loop 1 Escape is at least 97 % for every class. 8 of DESIGN §19's 20 rows pass outright, and every other row
  carries a ruling (D-149, D-151).

## Decisions worth knowing

- **The premise** (D-002–D-005, D-010, D-011): the Wayfinder loops because the Amulet keeps the shear from taking them. The
  Tyrant is Veyran Thal, holding the Breach shut: the jailer, not the villain (D-004). Echoes are the only progress that
  persists, along with the codex, achievements and Resonance; everything else resets.
- **Loop 1 is the legacy game** (D-001, D-039, D-049, D-067.17): the six legacy quests, names and lines are kept verbatim
  and tested against `legacy/`. A Loop 1 death outside a Horde is the FALLEN screen, with a reload.
- **Document precedence** (D-062): STORY owns scenes, Echoes and names, WORLD owns places and creatures, and DESIGN owns
  rules and numbers. BIBLE.md is the continuity index.
- **Ids are forever** (D-044): typed prefixes are part of the id, and renaming one is a save migration. Saves are frozen at
  v1 with golden files (D-142).
- **Determinism everywhere** (D-032, D-041–D-043): `step` is pure, illegal actions never throw, and every draw comes from
  the run's RNG. That is what makes the bots, the traces and the 1,000-run batches possible.
- **An offline toolchain** (D-065): the npm registry was blocked, so pinned packages are linked from a local store. CI
  installs the same pins, with no lockfile.
- **Proofs, not hopes** (PLAN §7.8; D-123, D-151): every quest outcome has a scripted proof, and every ending a script.
  `reachability.test` fails on any item, creature, quest or ending with no source, proof or script.
- **Painted art under code overlays** (D-124, D-128): Grok Imagine backdrops, sprites and portraits, listed in build-time
  manifests, with the code-drawn scenes as a fallback.
- **Long prose loads lazily** (D-115, D-131): codex bodies, dialogue and ending text are in JSON chunks, so the bundle stays
  under budget.
- **Flee rules** (D-143, D-144): every flee falls back to the previous place, and a group that drops a quest item regroups
  at dawn, so no quest can be lost to a flight.
- **Layout from Tim's play** (D-147, D-148): a fixed compass pad, combat controls that never move, and no page scroll on
  phones or desktop.
- **Agents in worktrees** (D-092, D-103): each unit works in its own worktree, backs up to `wip/<unit>`, and the lead
  merges.

## The D-150 trade-offs

Tim asked to wrap up on 2026-10-27, so the plan was compressed (D-150):
- **One fun pass instead of three fun reviews.** U83–U87 became U84 (D-152): the danger cue, the empowered Blood price, REPORT
  U79's open findings, D-148's layout leftovers, and a short pass that fixed its top five findings.
- **A 1,000-run release batch instead of 2,000.** C5's bar is relaxed: every §19 row passes or carries its D-149/D-151
  ruling. Rows #7 and G3 carry the thin-sample mark.
- **Bot gaps listed, not built.** No bot plays the Horde's Unraveling Tide set piece, the late forge patterns, the
  Voidforged set or the Ward Seal. All of them are reachable by a player (D-151).
- **Accepted, not tuned:**
  - the Drowned Reach and the Highlands stay over-lethal for their bands (the danger cue warns instead: "Dangerous" from
    2 levels above the party, "Deadly" from 4, D-152);
  - the caster's 47 % death-free loops against a 55 % target;
  - gold of about 900 at the end of Loop 1, with no sink (gold resets at the Threshold);
  - the speedrunner's expiries;
  - the Tyrant's round counts by class (a "last 15 % faster" trial saved about one round and was reverted, D-152);
  - the Blood price share is unmeasured under the new rule, because the bots don't use the toggle;
  - #18 (variance) dropped.
- **U88–U91 became one unit** (this one): continuity, the docs, the screenshots, the audit and the PR.

## Known issues

The release's known issues, which the README also lists:
- **Band difficulty:** the Drowned Reach (4–8) and the Highlands (5–8) are deadlier for their bands than their neighbours
  (8 violations of §19 #3; D-151). The danger cue warns the player.
- **Gold:** about 923 at the end of Loop 1, with nothing big to spend it on; it resets at the Threshold (D-151 #4).
- **The Tyrant's length by class:** at L13 the wizard takes 7–10 rounds and the elf 20–30. It comes from class damage, not
  a slog (D-152). *Remember*'s late +46 HP reads as lost progress. The Unveiled takes about 21 rounds; the boss samples are
  thin.
- **Casters** are 47 % death-free in band (target 55 %; D-151).
- **A full sweep of Loop 1** is about 124 trips; a rushed run can expire (the speedrunner bot: 19 %).
- **Unmeasured:** the Blood price share under the empowered rule, since the bots don't toggle it (D-152).
- **Untested by bots:** the Loop 4+ creatures, the Unraveling Tide, seven late forge patterns, the Voidforged set and the
  Ward Seal (D-151).
- **The first fight** (the U84 fun pass): four queued toasts sit over the stage as it opens, and on desktop the hint covers the
  log's only line. A new character can enter it without a class ability if the ability-point notice went unheeded.
- **Developer scenarios only:** `pre_tyrant_*`'s Run Summary says "The Heartstone: Intact" (REPORT U79 #10).
- **Browsers and devices:** Chromium only in CI. The 26 WebKit a11y failures predate Codex's playtest (D-140). Physical
  devices are Tim's to test.

## What's next

If Tim continues, in rough order of value:
1. **A gold sink that fits the lore** (D-151 #4): the Ironclad's forge commissions, Remnant archive fees, or Weaver thread.
   Then re-measure #14.
2. **A tuning pass on the Drowned Reach and the Highlands**, measured in band (#3). Elf and Warden damage against the Tyrant
   (#19).
3. **Bots for the corners:** the Horde set piece, the late forge, refusing the shards, the Ward Seal. Then a full 2,000-run
   batch and C5 at its original bar.
4. **Real devices:** iOS Safari and Android Chrome, plus WebKit and Firefox in the e2e matrix (the 26 WebKit a11y failures).
   Teach the bots the Blood toggle and measure its share (D-152).
5. **The first fight's noise:** hold achievement toasts until the fight ends, and prompt for the ability point before the
   Corridor.
6. **The two remaining fun reviews** PLAN planned (U83/U85), with fresh players.
7. **More loops' worth of content:** the Loop 4+ anomalies are thin, and the Threshold's Gallery could carry more.
