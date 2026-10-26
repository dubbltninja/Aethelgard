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
