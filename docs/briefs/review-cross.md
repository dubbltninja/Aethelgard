# Brief: cross-document consistency review + canonical id registry

Agent type: general-purpose. Deliverables: `/home/claude/aethelgard/docs/reviews/REVIEW-CROSS.md` and
`/home/claude/aethelgard/docs/reviews/REGISTRY-DRAFT.md` (create `docs/reviews/`). Do not edit any
other file. When done, commit only your two files per `docs/briefs/COMMIT.md`.

You are the continuity editor for "Echoes of Aethelgard: The Unraveling". Four design documents were
written in parallel by different authors and disagree on names, ids, and numbers. Your job is to find
every disagreement and propose the canonical form, and to produce a draft master registry of ids that
revision agents and content engineers will follow.

## Read
- `docs/DECISIONS.md` — CANON, all of it. Especially **D-044** (id convention), **D-062** (document
  precedence: DECISIONS > STORY for people/names/dates/events/quests/Echoes/scenes/codex/endings >
  DESIGN for systems/numbers/abilities/statuses/materials/item mechanics/attunements/achievements >
  WORLD for places/regions/creatures/NPC ids/placement > PLAN), **D-063** (the Nine; recast figures),
  **D-064** (NPC roles), D-045..D-061.
- `docs/STORY.md`, `docs/DESIGN.md`, `docs/PLAN.md` (§4–5 and Appendix A), `docs/WORLD.md` §1–3.
- Ignore `docs/world/*.md` — WORLD §4–13 are being written right now by other agents.
Use grep heavily (`grep -o 'echo_[a-z0-9_]*' docs/X.md | sort -u`, etc.) — be exhaustive, not
impressionistic.

## Produce
### REVIEW-CROSS.md
1. Summary of the state of consistency.
2. **Conflicts**, numbered, each with Severity (Blocker/Major/Minor/Nit), the documents and quotes,
   and the canonical resolution per D-062..D-064. Cover at least: the Nine (WORLD's alternative
   members, D-063), NPC names/roles (D-064), Echo ids (same fact, different ids), item ids, NPC ids,
   quest ids (e.g. `q_herd_of_one` appears outside STORY), creature/boss ids and Tyrant phase ids
   (STORY Movements vs DESIGN `tyr_*`), ability/status ids and prefixes (D-044/D-061: `rgr_` not
   `rng_`), level bands, XP curve, Breach Clock rules and modifiers, Resonance values, rep deltas,
   communion Resolve scale (D-054), Apex gate (D-048), Threshold rule (D-049), Horde (D-060), dates
   and years (Sundering 500 years ago; prior Wayfinder years; Dask 70; Nyx 40; ages), place names and
   spellings (e.g. Aldour/Aulde), faction names, the Litany's verse count and titles, item/quest names.
3. A **numbers and dates table**: each quantity, the value in each document, the canonical value.

### REGISTRY-DRAFT.md
A master registry, one table per id type: regions, locations, NPCs, companions, factions, quests,
Echoes, codex entries, scenes, endings/closers, creatures (ids from WORLD §3), abilities, statuses,
affixes, materials, items, attunements, achievements, modifiers, screens, sfx, damage types, stats.
Columns: canonical id · canonical display name · owner doc · aliases found (other ids/names to replace,
with the doc where each appears) · action (ok / rename-in-X / add-to-owner / remove). For Echoes, map
EVERY `echo_*` id found in DESIGN, WORLD, or PLAN that is not in STORY §12 either to the STORY id with
the same meaning or to "ADD to STORY §12" with a proposed title and source. Also list ids that are
referenced but defined nowhere.

Reply with conflict counts by severity, the ten most important resolutions, and the registry sizes.
