# REPORT.md final sections: DRAFT (U91 part 1)

> **Draft.** These sections are written in a separate file so they don't collide with U84's "U84 fun pass" section in
> `docs/REPORT.md`. In U91 part 2, after U84 merges: fill every **TODO** from the clean-clone audit, then append these
> sections to the end of `docs/REPORT.md` (after the fun pass) and delete this file.

---

## Final audit (U91) — 2026-10-27

**TODO (part 2).** Run from a clean clone of `unraveling` at the merge commit (`node tools/link-local-deps.mjs`,
`E2E_PORT=4410`):

| Gate | Command | Result |
|---|---|---|
| The CI gate | `npm run check` | TODO |
| The full e2e suite | `npm run test:e2e` | TODO (U84a, D-148: 361 passed, 0 failed) |
| Quest proofs | `npm run sim -- quest --pack real` | TODO (U82: 81/81) |
| Ending scripts | `npm run sim:endings` | TODO (U82: 8/8) |
| Pages build from a sub-path | `npm run build`, then serve `dist/` under `/Aethelgard/` and open it in Playwright | TODO: title loads, a new game starts, art and the text chunks load with no 404s |
| Bundle | the `npm run build` output | TODO (D-148: JS 527.9 kB gzip, budget 600 kB) |

### PLAN §10.7 checklist

TODO (part 2): mark each item ✓ / ✗ with its evidence (a test, a proof, a count, or a DECISIONS ruling).

| Item | Evidence (to confirm) | ✓/✗ |
|---|---|---|
| D-001 names preserved | `tests/unit/content/legacy.test.ts` (string equality with `legacy/aethelgard_data.py`) | TODO |
| D-002 both loop closers reachable | `sim:endings` (`closer_escape`, `closer_fall`) | TODO |
| D-005 clock 30 base, warnings, Loop 1 subtle | DESIGN §10.1; clock tests; the U79 playthrough | TODO |
| D-008 five classes × 15 abilities, mastery | rule 13; 75 class abilities in the pack | TODO |
| D-009 intents, statuses, interplay, bands, boss phases, flee rules | rules 11 and 14 (19 statuses); `fleeRules.test`; combat tests | TODO |
| D-010 STORY §12 Echoes, exclusivity, shortcuts, routes | 103 Echoes; rule 16 | TODO |
| D-011 persist/reset field by field | loop reducer tests | TODO |
| D-012 four Threshold areas | the Threshold region; `threshold.spec.ts` | TODO |
| D-013 six companions with arcs and constraints | rule 18; 18 companion quests with proofs | TODO |
| D-014 tiers and gates | faction tests; 4 faction quests | TODO |
| D-015 73 locations in 12 regions | rule 21; `reachability.test` | TODO |
| D-016 Silverwood Before anchors | the Before tests; ending B's script | TODO |
| D-017 every consequence present | quest proofs per outcome | TODO |
| D-018 six endings + closers, epilogues, achievements | rule 15; `endingsText.test`; 40 achievements | TODO |
| D-045 44 quests (+5 class) | 49 quests, 81 proofs | TODO |
| D-020 codex: four voices, ≤ 220 words | 90 entries (85 planned + D-101's additions); rule 17; `codex.voice.test` | TODO |
| D-021 NG+, six modifiers, 40 achievements, run summary | rule 19; 6 modifiers, 40 achievements | TODO |
| D-022–D-026 continuity (BIBLE spot checks) | U91 continuity pass (below) | TODO |
| D-027 credit line | `credits: true` on every true ending; README | TODO |
| D-030–D-040, D-065 engineering | `npm run check`; CI; Pages | TODO |
| D-041–D-066 rulings | each with a test or a content check | TODO |

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

**Known contradictions left: none.** TODO (part 2): re-run the WORLD §6 comparison after U84 merges, in case it touched
creature data.

---

## Summary

*Echoes of Aethelgard: The Unraveling* rebuilds Tim's Python text RPG as a time-loop RPG for the browser. The legacy game is
Loop 1, kept word for word. Around it are thirty days on a Breach Clock, Echoes that persist from loop to loop, the
Threshold between loops, Silverwood Before (the city on its last three days, five hundred years ago), and six true
endings.

**The game, in numbers** (the real pack at U82's merge):

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
- **Tests:** TODO final count (U82 merge: about 4,925 unit tests, plus the coverage gate); e2e TODO (D-148: 361 passed).
- **Bundle:** TODO (D-148: 527.9 kB gzip of a 600 kB budget).

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
- **One fun pass instead of three fun reviews.** U83–U87 became U84: the danger cue, the empowered Blood price, REPORT U79's
  open findings, D-148's layout leftovers and a 45-minute pass that fixed its top five findings.
- **A 1,000-run release batch instead of 2,000.** C5's bar is relaxed: every §19 row passes or carries its D-149/D-151
  ruling. Rows #7 and G3 carry the thin-sample mark.
- **Bot gaps listed, not built.** No bot plays the Horde's Unraveling Tide set piece, the late forge patterns, the
  Voidforged set or the Ward Seal. All of them are reachable by a player (D-151).
- **Accepted, not tuned:**
  - the Drowned Reach and the Highlands stay over-lethal for their bands (the danger cue warns instead);
  - the caster's 47 % death-free loops against a 55 % target;
  - gold of about 900 at the end of Loop 1, with no sink (gold resets at the Threshold);
  - the speedrunner's expiries;
  - the Tyrant's round counts by class;
  - #18 (variance) dropped.
- **U88–U91 became one unit** (this one): continuity, the docs, the screenshots, the audit and the PR.

## Known issues

TODO (part 2): merge the README's list with the U84 fun pass's unfixed findings, and drop anything U84 fixed. From the
rulings so far (README "Known issues"):
- the Drowned Reach (4–8) and the Highlands (5–8) are deadlier for their bands than their neighbours (8 violations of
  §19 #3; D-151);
- end-of-Loop-1 gold is about 923, with nothing big to spend it on;
- the Contained Tyrant takes about 10 rounds for a Wizard and about 25 for an Elf or Warden at L11; the Unveiled about 21;
  the boss samples are thin;
- casters are 47 % death-free in band (target 55 %);
- a full Loop 1 sweep is about 124 trips; a rushed run can expire (the speedrunner bot: 19 %);
- untested by bots: the Loop 4+ creatures, the Unraveling Tide, seven late patterns, the Voidforged set, the Ward Seal;
- Chromium only in CI; 26 WebKit a11y failures predate Codex's playtest (D-140); physical devices are Tim's to test;
- TODO from U84: the status of REPORT U79 #3–#6, #8, #10–#13; D-148's leftovers (a hint at 1280×800, landscape phones,
  WASD only on the map, the key legend hidden under 760 px); the fun pass's list.

## What's next

If Tim continues, in rough order of value:
1. **A gold sink that fits the lore** (D-151 #4): the Ironclad's forge commissions, Remnant archive fees, or Weaver thread.
   Then re-measure #14.
2. **A tuning pass on the Drowned Reach and the Highlands**, measured in band (#3). Elf and Warden damage against the Tyrant
   (#19).
3. **Bots for the corners:** the Horde set piece, the late forge, refusing the shards, the Ward Seal. Then a full 2,000-run
   batch and C5 at its original bar.
4. **Real devices:** iOS Safari and Android Chrome, plus WebKit and Firefox in the e2e matrix (the 26 WebKit a11y failures).
5. **The two remaining fun reviews** PLAN planned (U83/U85), with fresh players.
6. **More loops' worth of content:** the Loop 4+ anomalies are thin, and the Threshold's Gallery could carry more.
