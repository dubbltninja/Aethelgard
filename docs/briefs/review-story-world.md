# Brief U7: combined adversarial review of STORY.md + WORLD.md (blockers and majors only)

Agent type: general-purpose (Opus). Deliverable: `/home/claude/aethelgard/docs/reviews/REVIEW-STORY-WORLD.md`.
Do not edit any other file. Commit only your report per `docs/briefs/COMMIT.md`.

You are a hostile but fair narrative designer, quest designer, and world/encounter reviewer. Tim (the owner)
cares most that the finished game is **fun, playable, interesting**, has **a good internal balance of usable
items**, and has **lore that makes sense at a high level and at a granular level** (who knows what when,
names, dates, cause and effect). Review with those priorities.

This consolidates the older briefs `review-story.md` and `review-world.md` (read both for the full list of
attack fronts; their "Overrides" sections apply), with a tighter scope:
- **At most 30 findings, only Blocker or Major.** Skip nits, style, and anything already settled.
- **Already settled — do not re-report:** every ruling in DECISIONS.md D-001..**D-066**, and every id/name/number
  conflict already listed in `docs/reviews/REVIEW-CROSS.md` and `docs/reviews/REGISTRY-DRAFT.md` (those renames
  will be applied in U9). If a settled ruling *creates* a new story or world problem, that IS in scope.
- Priorities, in order:
  1. **Ending reachability & soft-locks** — trace each of the six endings from Day 1 of some loop under D-066's
     rules (Breach-anchor changes, clock floor, Silverwood Before counter, flee/scatter); circular or
     mutually-exclusive requirements; quests that can fail unrecoverably and block an ending.
  2. **Lore coherence, granular** — causality and who-knows-what-when (Nyx's 40 years, Dask's 70, the Nine's
     fates vs creature origins in WORLD §5–6, Silverwood Before rules vs Anchors, the Tyrant's Loop-1 silence,
     Oriel as the Drowned Archivist, Litany verses vs Nine's roles), and contradictions between STORY's
     narrative and WORLD's location/NPC/creature/item text.
  3. **Fun & pacing** — Loop 1 as a 60–90 min RPG, Loop 2 reveal, Loops 3+ brisk; dead stretches; repetitive
     quest shapes (too many fetch/kill); is the reveal over-explained? Are choices meaningful?
  4. **Item & creature balance** — items that dominate their slot or are useless; tiers vs level bands; loot
     flooding/starving the economy; creatures whose resistances make a class useless; recompute 4 fights
     (one fodder per band start, two regional bosses) with DESIGN's formulas vs DESIGN §19.
  5. **Quest catalog completability** — dangling requirements, false pacifist claims.
- Read efficiently: DECISIONS.md (fully, esp. D-045..D-066); STORY.md §2, §4–§12 (grep/offset; skim §13–14);
  WORLD.md §2 (region summaries), §3 for gating (grep exits/conditions), §4–§9 (grep stat lines/tables),
  §10.6–10.10, §12–13; REVIEW-CROSS.md §1–2 headings and §4 handoffs (to avoid duplicates).

Format: summary (≤8 lines); findings numbered with **Severity**, **Where** (doc §, short quote), **Problem**,
**Proposed fix** (concrete text/number/rule). End with "Three strongest moments to protect", "Three biggest fun
risks", and "Rulings the lead should record" (numbered one-liners). Reply with counts and the rulings list.
