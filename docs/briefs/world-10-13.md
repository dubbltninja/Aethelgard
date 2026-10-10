# Brief W-C: WORLD.md §10 Encounter design, §11 Map data, §12 World-state variants

Agent type: general-purpose. Deliverable: `/home/claude/aethelgard/docs/world/10-13-encounters-map-variants.md`
(create `docs/world/`). Two sibling agents are writing §4–6 (NPCs, creatures) and §7–9 (items,
crafting, merchants) into other files at the same time; the lead merges everything into WORLD.md.
Do NOT edit WORLD.md or any other existing file. When done, commit only your file per
`docs/briefs/COMMIT.md`.

You are the level designer for "Echoes of Aethelgard: The Unraveling", a time-loop web RPG rebuilt
from a Python text RPG.

## Read first
1. `docs/DECISIONS.md` — CANON, all of it. Critical: D-005 (Breach Clock: watches), D-015/D-016
   (regions, Silverwood Before), D-017 (Heartstone consequences on areas), D-044 (ids), D-048 (Apex
   gate), D-049, D-051, D-056 (bands), D-059 (`temporallyUnstable` list), D-060 (Horde), D-062..D-064.
2. `docs/WORLD.md` §1–3 in full: every location's exits (+ conditions), encounters (creatures, counts,
   chances, first-visit vs return), rest points, merchants, map positions, §3.13 reachability.
3. `docs/DESIGN.md` §2 (core loop), §6.6 (bands, no-scaling rule, loop anomaly nudge), §10 (clock:
   4 watches/day, travel 1 watch, rests, base Day 30, modifiers), §16 (UI: the illustrated node map,
   fog/"remembered" states, Horde display), §17 (art direction palettes), §19 (balance targets).
4. `docs/STORY.md` §4–6 (Loop 1 walkthrough, Loop 2, critic's path) and §11 (which quests need which
   locations), so encounter pacing and pacifist routes support the story.
5. `echoes_of_aethelgard.py` lines 146–192 (legacy MINIMAP_LAYOUT/EDGES — legacy coordinates must be
   preserved exactly) and 2922–2951 (legacy Horde spread rule incl. the Mistwood→Plaza 2-turn delay).

## Write
### §10 Encounter design per region
For each of the 12 regions: expected fights per traversal (first visit / return), elite placement,
rest-point spacing, watches to cross, the Horde's path through it, and a **pacifist route**: which
nodes are reachable without forced combat; mark every forced-combat node and justify it (forced fights
only for bosses and story gates). A pacifist must reach every settlement and the Apex approach.
Include a **Loop 1 timing table**: a plausible thorough Loop 1 route (all 6 legacy quests + Heartstone
+ Apex) with watch counts per leg, total days, and slack against the Day 30 limit; and a focused
Loop 3+ route to each ending's key locations. Flag any region where the clock math fails.

### §11 Map data
- Full node table for all 73 locations: id, name, region, x, y (legacy coordinates exactly as in
  MINIMAP_LAYOUT; new nodes consistent with §3's positions — consolidate them, fix overlaps, keep
  x spacing 8 / y spacing 2 conventions), `temporallyUnstable`, rest, merchant, settlement.
- Full undirected edge list with direction labels both ways and gate condition ids.
- Region bounding boxes and label anchors; the Threshold drawn as a separate inset.
- Rendering notes for fog / adjacent "??" / visited / remembered-from-earlier-loop / infected /
  quest-ready states, and how locked edges render (legacy used a red "x").
Present tables in a machine-friendly form (pipe tables with stable column order) — engineers will
convert them to data directly.

### §12 World-state variants
Table of location states that change text, encounters, or exits, with trigger conditions (D-033
style): Horde infection (and its spread rule), Heartstone stabilized / exploited / destroyed (the
Depths unstable or dark), Shattered Library portal, Ironclad Camp after Brak's quests / Brak absent,
Loop ≥ 2 anomalies, Silverwood Before Day 1/2/3, the Threshold after N loops, ending-specific states.
Also the full `temporallyUnstable` list per D-059.

### Appendix to your file
- **Errata for §1–3** (exits that don't match both ways, overlapping coordinates, unreachable nodes,
  gate conditions using non-canonical ids per D-062).
- **Open questions (§10–12)**.

Verify before committing: 73 nodes, every edge symmetric, every node reachable from
`loc_whispering_ruins` under some condition set (write a small script in the scratchpad if useful).
Reply with node/edge counts, the Loop 1 timing result, pacifist findings, and open questions.
