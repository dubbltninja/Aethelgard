# Brief U9-B: revise WORLD.md

Agent type: general-purpose (**Fable**). Deliverable: revised `docs/WORLD.md` (edit in place). Do not edit any
other file (a sibling agent is revising STORY.md and writing BIBLE.md right now). Commit per
`docs/briefs/COMMIT.md` twice: a checkpoint after §1–6 are done, then the final.

## Inputs
- `docs/DECISIONS.md` — canon through **D-068**; apply D-063/D-064 (recast figures, NPC renames), D-066 (clock
  floor, Silverwood Before counter, Breach-anchor recipe: 0 gold, 3 ember ore, Neutral gate during ending quests,
  2 fragments per Heartstone choice, flee/scatter rule, boss level = band top + 2, T5 tier, Dask flag), **D-067**
  (anchors per loop + `anchorable` tag, Silverwood Before costs a day / loot once per loop, schematic half B also at
  Vane's Watch, heartwood from Golems and Kaelen, ending D requires Brak active, Conflux holds the whole Heartstone,
  STORY's Before places → events on WORLD nodes, Shadow Weaver viability: Vell's Umbra resists not immune, Drowned
  lose "weak ley", regional boss HP = 12 × expected physical damage per round at band top with +2 levels raising
  attack/accuracy/XP not HP, Apex *Face it / Not yet* and no autosave there), D-068 (Steppe road, Dask).
- `docs/reviews/REVIEW-STORY-WORLD.md` — apply findings that target WORLD (2, 6, 11, 13, 14, 17, 18, 19; read all).
- `docs/reviews/REVIEW-CROSS.md` §4 U9 list items that target WORLD, and `docs/reviews/REGISTRY-DRAFT.md`: apply
  every rename/action targeting WORLD (NPC ids/names §4, Echo id mappings §6.3, creature/anomaly ids §10, item ids
  §15, flags §22, §23 "referenced but defined nowhere" — define WORLD-owned ones such as `loc_veil_sanctum` or fix
  the references). Rename `loc_aldours_eyrie` → `loc_auldes_eyrie`.
- `docs/DESIGN.md` (revised in U8): §4 statuses/intent format, §6.6 bands, §7 item fields incl. T5, §8 materials and
  the Breach-anchor recipe, §19 targets — WORLD's numbers must match DESIGN's formulas.
- WORLD §13 (its authors' own errata E1–E14, A.2, W1–W14 and open questions): apply the errata; resolve the open
  questions per DECISIONS where ruled, otherwise choose and note it.

## Work
1. Retune every **regional boss** per D-067.20 (show the arithmetic in one line each) and both Tyrants per DESIGN
   §4.10 (Contained: 460 HP etc.). Re-check fodder/elite numbers against DESIGN §19 at band start.
2. Apply the Shadow Weaver fixes (D-067.18) in creature resistances; `itm_echo_bolt` consequences in §6 tactics notes.
3. Mark `anchorable` items; add the `temporallyUnstable` flag to every node row in §11.1 per D-059; add the
   Loop-1 *Face it / Not yet* note at the Apex; the 3-move Horde delay on expiry (§12.2); scatter rule in §10.0.
4. Recipes/merchants: Breach-anchor per D-066.10; heartwood sources; fragments ×2; T5 confirmed.
5. Ids: everything per the registry; faction id `weavers`; Echo ids = STORY §12 (plus the 26 additions listed in
   REGISTRY §6.2 — use those ids exactly).
6. Replace §13 with a short `## 13. Changelog (U9) and remaining open questions` — keep only what is still open.
7. Keep every legacy string verbatim. House voice.

Reply in ≤12 lines: boss retune table (id → old HP → new HP), count of renames applied, remaining open questions.
