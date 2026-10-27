# Brief: adversarial review of WORLD.md (round 2 — run after §4–13 are merged)

Agent type: general-purpose. Deliverable: `/home/claude/aethelgard/docs/reviews/REVIEW-WORLD.md`.
Do not edit WORLD.md or any other file. When done, commit only your report per `docs/briefs/COMMIT.md`.

You are a hostile but fair world/level/encounter reviewer. Find every hole, contradiction, unreachable
place, broken encounter, mis-tuned creature, dangling id, and economy break in
`docs/WORLD.md` (all 13 sections) and write a findings report.

## Read
- `docs/DECISIONS.md` — CANON (through D-065; especially D-044, D-051, D-052, D-055, D-056, D-059,
  D-060, D-062..D-064).
- `docs/WORLD.md` in full.
- `docs/reviews/REVIEW-CROSS.md` and `docs/reviews/REGISTRY-DRAFT.md` (the canonical id registry);
  `docs/DESIGN.md` §4–§10 and §19 (combat math, items, crafting, economy, clock, balance targets);
  `docs/STORY.md` §4–§11 (loops, companions, endings, quest catalog).
- `aethelgard_data.py` (legacy locations, items, enemies — must be preserved exactly).

## Attack on these fronts (quote evidence)
1. **Legacy fidelity** — legacy names, descriptions, exits, gating, enemies, items dropped or altered.
2. **Graph** — asymmetric exits, unreachable nodes, gate conditions that can never be true, gates that
   create soft-locks (e.g., a quest item behind a gate that needs that quest), Silverwood Before and
   Threshold access, Horde spread correctness, coordinates overlapping.
3. **Creatures** — recompute 8 fights by hand with DESIGN's formulas (fodder at band start, an elite,
   two regional bosses, both Tyrants phase 1) against §19 targets; intents with impossible effects or
   missing telegraphs; statuses referenced that DESIGN does not define; damage-type/resistance
   patterns that make one class useless; loot tables that flood or starve the economy.
4. **Items and crafting** — dangling ids; recipes with unobtainable inputs; tiers inconsistent with
   level bands; any item that dominates its slot; the Breach-anchor path for endings B and D (D-052);
   the void-forged line; merchant stock vs "never soft-locked by poverty".
5. **Pacifist and clock** — check §10's pacifist routes against §3 encounter data; check the Loop 1
   timing table against DESIGN §10's clock rules; is Frayed Clock (20 days) survivable?
6. **Cross-doc** — every id must match the registry; flag every mismatch with STORY/DESIGN.
7. **Voice** — style violations; telegraphs > 12 words; bestiary entries > 120 words.

Report: summary; numbered findings with **Severity** (Blocker/Major/Minor/Nit), **Where**,
**Problem**, **Proposed fix**. 40–80 findings. End with "Top 10 fixes before content data is written"
and a verdict. Reply with counts by severity and the top 10.
