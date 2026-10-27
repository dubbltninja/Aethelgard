# CONTENT.md: adding to the game

How to add a location, a creature, a quest or an ending, and what checks it. It grows out of PLAN §10.3–10.4. The canon
behind every line is `docs/BIBLE.md`. Where documents disagree, D-062's precedence applies: STORY owns scenes, Echoes and
names, WORLD owns places and creatures, and DESIGN owns rules and numbers.

## How content is built

Content is plain TypeScript data, with no engine code in it:

```
src/content/
  schema/            zod schemas: one per table (location.ts, creature.ts, quest.ts, ending.ts …), plus conditions and effects
  regions/<region>/  region.ts, locations.ts, creatures.ts, npcs.ts, items.ts, index.ts (one folder per region; barrel in regions/index.ts)
  shared/            classes, companions, quests/<category>.ts, dialogues/<category>.ts, codex/<category>.ts, echoes.ts,
                     endings.ts, achievements, statuses, merchants, recipes, modifiers, attunements, config.ts
  items/  abilities/ items and abilities by kind
  tables.ts          every authored table, gathered
  index.ts           buildContentPack(): parse every table with its schema, index by id, validate
  validate.ts        validateContent(): the 22 cross-reference and semantic rules (PLAN §5.19)
```

Each record is written as `{ … } satisfies XInput`, so the type checker catches a misspelled field before the schema does.
Ids are lowercase `snake_case` with their type prefix (`loc_`, `cr_`, `q_`, `item_`, `echo_`, `codex_`, `ending_` …). They
must be unique across the whole pack and stable forever, because saves store them: renaming an id is a migration (D-044).

The engine, the UI and the sims only ever see the parsed `ContentPack`. The production build moves long prose (codex
bodies, dialogue text, ending slides and epilogues) into lazily loaded JSON chunks (`src/content/prose.ts`). You don't need
to do anything for that. Just never make the engine compare or log a line of prose.

## What checks it

| Check | Command | What it catches |
|---|---|---|
| Schemas | `npm run typecheck`, then any build or test | wrong fields, wrong types, unknown enum values |
| The validator | `npm run validate` (strict, the release gate) | the 22 rules of `validate.ts`: every id reference resolves (also inside conditions and effects); exits have their reverse and unique directions; every location is reachable from the start (the 21 legacy places in Loop 1); quest and dialogue graphs are sound (no dangling `next`, every node reachable); bosses have 2–4 phases; creature levels sit in their band; items, echoes (granted somewhere, gating something, `exclusiveWith` symmetric), codex (≤ 220 words, reachable, the four voices), companions, endings (all 8), merchants and the game-wide counts |
| Content tests | `npm test` (`tests/unit/content/**`) | the shipped content against the docs: each region's locations and creatures against WORLD's blocks (`regions/worldDoc.ts` reads WORLD.md), legacy text word for word against `legacy/aethelgard_data.py`, pinned "written" lines, STORY §15.1's banned words, flee rules, balance pins |
| Reachability | `tests/unit/sim/reachability.test.ts` | every item has a source, every creature can be met, every quest has a proof, every ending a script. Anything else must be listed in `BY_DESIGN` (`src/sim/reachability.ts`) with a reason |
| Quest proofs | `npm run sim -- quest [<questId>…] --pack real` (CI: `questScripts.test.ts`) | a scripted path completes each quest outcome on the real pack |
| Ending scripts | `npm run sim:endings` (CI: `endings.reachable.test.ts`) | all 8 endings and closers are reached by play |
| Bots | `npm run sim -- --bots all --classes all --seeds 20 --pack real` | engine errors and soft-locks (a run where nothing legal makes progress) |
| Balance | `npm run sim:balance` | the DESIGN §19 targets, written to `docs/BALANCE.md` |
| Traces | `bun test tests/unit/sim/traces.test.ts` | a change that alters play moves the real-pack trace hashes. Re-record with `bun tools/record-traces.ts` **in the same commit**, and say why |

A content change is done when `npm run check` is green, the proofs and ending scripts still pass, and any doc it departs from
(WORLD, STORY, DESIGN) is edited in the same commit.

## Writing rules

- **Words.** Concrete nouns, short sentences, grave and strange, no gore (STORY §15). Narration is second person, present
  tense. NPC lines carry the speaker on the node, not in the text.
- **Names and terms** follow BIBLE §7 exactly: *Wayfinder*, *the Breach*, *ley lines*, *Heartstone*, *the Still Shore* (never
  "the Shore" alone), *Captain Corvin Dreyl* (never "Watch-Captain"). Dates are "Year N" of the Sundering. The Sundering is
  Year 0, and Day 1 of the game is Year 500. Check the timeline in BIBLE §2 and who knows what in BIBLE §4 before an NPC
  says something.
- **Tags on text nodes.** `legacy` means the words are the Python game's, verbatim. `story` means they are STORY's,
  verbatim. `written` means they are new words, and the quest and dialogue tests pin those exactly. If you change a written
  line, update its pin in the same commit. The pin is how the lead reviews new prose.

## A location

1. **Pick the region folder** (`src/content/regions/<region_id>/locations.ts`) and add a record:
   - `id`, `regionId`, `name`, and a `description` of 2–4 sentences;
   - `map: { x, y }` on the region grid (WORLD §2);
   - `art`: the scene template, 2–4 silhouettes, particles, and an optional focal piece (WORLD §3's art spec;
     `src/ui/art/Scene.tsx` draws them when there is no painting);
   - `exits`: `{ dir, to, when?, lockedText?, hidden? }`. An unmet `when` shows the exit locked, unless it is hidden. **Add the reverse exit on the neighbour** (rule 7). A hidden exit needs a
     `when` or an `unlockExit` effect somewhere, or it can never appear;
   - optional: `items`, `encounters`, `npcs`, `events`, `rest`, `merchantId`, `craftingStation`, `levelBand` (else the
     region's), `safe`, `temporallyUnstable`, `hazards`, `gather`, `descriptionVariants`.
2. **Encounters** are `{ id, groups: [{ creatureId, count }], chance, once, respawn, onFlee }`. If a fixed group drops an
   item a quest objective needs, it must be `onFlee: 'regroup'` (D-144; `fleeRules.test` enforces it). The unfleeable
   bosses use `hold`, and everything else uses `scatter`.
3. **WORLD §3** gets the place's block (the region tests compare against it).
4. Add a **codex entry** if it's a named place (see below), and a **painted backdrop** if one is wanted:
   `public/art/scenes/<locationId>.webp` plus `@sm` (docs/ART.md §1). Art is made with Grok Imagine and approved by Tim
   before it ships. Until then, the scene falls back to the region's painted backdrop and its palette.
5. `npm run validate`, then `bun test tests/unit/content/regions/<region> tests/unit/content/reachability.test.ts`.

## A creature

1. In the folder of the creature's **first region** (D-090), add to `creatures.ts`:
   - `id`, `name`, `description`, `family` (`fam_*`), `role` (`fodder` · `elite` · `anomaly` · `boss`), and a `level`
     inside the band of the places it appears;
   - `stats: { hp, atk, sp, armor, ward, agi }` (DESIGN §6.5 gives the ranges by band and role);
   - `xp`: DESIGN §6.2's formula: fodder `round(20 + 8L + 1.2L²)`, elite × 1.8, anomaly × 1.3 of the rounded fodder value.
     Bosses are hand-set. A test checks it;
   - `resistances`, with at least one `weak`, so every class has an answer, plus `statusImmunities` and `tags`;
   - `moves`: at least 2, each with its own telegraph `line` (one should apply a status or set up an interplay);
   - `pattern`: an ordered list of steps with optional `when` (`first`, `everyNth`, `hpBelow`, `allyPresent`,
     `targetHas` …; DESIGN §4.2);
   - bosses: `role: 'boss'`, unfleeable, 2–4 `phases`, each with its own pattern, OR-list triggers and decreasing
     `hpBelow` (rule 11);
   - `loot` with chances, `bestiary` (`summary`, `tactics`, `codexId`) and `sigil`.
2. Place it: in a location's `encounters`, a region's wandering pool (`region.ts`), or a boss's `adds`.
3. Add its row and block to **WORLD §6**. The region tests read the stat line (`HP · ATK · DEF armor/ward · AGI`), the
   level, the XP and the intents from there. If you retune a creature, retune WORLD in the same commit: write the new value
   with the old one struck through (`ATK 10 (~~12~~, U81b2)`), as WORLD does.
4. Optional sprite: `public/art/sprites/<creatureId>.webp` (docs/ART-2.md). Without one, the stage draws its sigil.
5. `npm run validate`, then run the region's tests, and a bot batch if it's in a place bots walk.

## A quest

1. **Pick the file** by category: `src/content/shared/quests/<category>.ts` (`legacy`, `regional`, `faction`, `companion`,
   `class`, `loop`, `ending`).
2. **The record:**
   - `id`, `name`, `description`, `category`, and the giver (`giverNpcId`) or the owner (`factionId`, `companionId`,
     `classId`);
   - `availableWhen` and `startWhen` (Conditions), and `hiddenUntilStarted`;
   - `stages`: each with `journal` text (40 words at most, STORY §11) and `objectives`, or `advanceWhen`, as Conditions. Branch with
     `next: [{ when, to }]` and use `onEnter` / `onExit` effects. A terminal stage carries `outcome: 'complete' | 'fail'`;
   - `rewards` (`xp`, `gold`, `items`, `rep`, `echoes`, `resonance`), and Echo `shortcuts` (`{ echo, skipTo, text }`) for
     returning players;
   - `countsForApex` (whether it counts toward the six quests that open the Apex) and `repeatablePerLoop`.
3. **Start it** from a dialogue choice (a `questStart` effect in `src/content/shared/dialogues/<category>.ts`) or with
   `startWhen`. If an offer scene starts it, it must not also get the generic *Accept*, or the quest strands (D-146;
   `genericAccept.test`).
4. **Prove it:** add a script to `QUEST_SCRIPTS` in `src/sim/scripts/quests.ts`, one per outcome that something later
   reads. A Loop 2+ proof starts from a constructed profile that holds the Echoes an earlier loop would have earned. Run
   `npm run sim -- quest <questId> --pack real --verbose`. `reachability.test` fails while a quest has no proof.
5. Pin its `written` journal and dialogue lines in the category's quest test, and run `bun test tests/unit/content/quests`.

## An ending

The six true endings (A–F) and the two loop closers are a closed set. The `EndingRecordId` enum and `TRUE_ENDING_IDS` in
`src/content/schema/ending.ts` list them, and rule 15 requires all 8. Changing an existing ending is a content edit. Adding a
seventh is a contract change: it needs a DECISIONS entry first.

1. **The record** goes in `src/content/shared/endings.ts`:
   - `id`, `letter`, `kind: 'true'`, `name`, `tagline`;
   - `requirements`: a Condition, usually Echoes, flags, loyalty, standing and a communion Resolve;
   - `requirementTexts`: what the Threshold says is still missing;
   - `sequence`: the closing slides, and `epilogues`: per subject (companions, factions, the Wayfinder), each with an
     optional `when`;
   - `achievementId`, `resonance`, and `credits: true` (every true ending closes with "a game by Tim Dibert", D-027).
2. **Reach it** with an `ending: <endingId>` effect on a dialogue choice, usually in `src/content/shared/dialogues/endings.ts`
   at the Apex or the Threshold. Closers use `endLoop: { closer, reason }`.
3. **Echoes:** when an ending plays, the engine grants `echo_ending_<letter>` (`src/engine/reducers/loop.ts`), so a new
   letter needs its Echo record in `echoes.ts`. Check BIBLE §3 for each companion's fate per ending.
4. **Prove it:** add an `EndingScript` in `src/sim/scripts/endings/index.ts`, reusing the quest proofs' routes. Then
   `npm run sim:endings` must print 8/8. `endingsText.test` pins the slides' and epilogues' words.

## Codex entries and unlocks

Entries live in `src/content/shared/codex/<category>.ts`. Each has a `voice` (`remnant_archive`, `ironclad_telling`,
`weaver_fragment`, `wayfinder_notes`), a `body` of ≤ 220 words, `related` ids and an `order`. An entry unlocks in one of
three ways:

- **`unlockWhen`:** a Condition. At the end of every step, the engine's codex pass (`src/engine/codexUnlock.ts`) re-checks
  the locked entries whose condition reads something that step changed. That covers `echo`, `location`, `region`, `killed`,
  `quest`, `companion`, `corruption`, `flag` and `item`, so prefer those atoms (any other atom is evaluated every step);
- an **`unlockCodex` effect** on a choice, an event or a quest stage;
- **`unlockedAtStart: true`**.

An entry that can't unlock any of these ways is an error ("unreachable lore", rule 17). A creature's `bestiary.codexId`
links its bestiary page to the family's codex entry. Unlocks persist across loops, because they're on the profile.

## Echoes

Add an Echo only if STORY §12 lists it, since STORY is the catalog (D-062). It goes in `src/content/shared/echoes.ts` with a
`codexLine` (the player's own voice), a `category` and `obtainedBy`. Grant it with `grantEcho` in exactly the places
`obtainedBy` names, and gate at least one thing with `{ echo }` (rule 16). Declare `exclusiveWith` on both sides.

## Before you commit

```bash
npm run validate
npm test
npm run sim -- quest --pack real          # if you touched a quest, its scenes or anything on its route
npm run sim:endings                       # if you touched an ending, the communion or the Apex
bun tools/record-traces.ts                # only if traces.test says a real-pack hash moved; say why in the commit
npm run check                             # the CI gate
```
