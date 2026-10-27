# Brief U9-A: revise STORY.md and write BIBLE.md

Agent type: general-purpose (**Fable** — prose and lore coherence). Deliverables: revised `docs/STORY.md` (edit in
place) and new `docs/BIBLE.md`. Do not edit any other file (a sibling agent is revising WORLD.md right now).
Commit per `docs/briefs/COMMIT.md`: STORY.md as its own commit (checkpoint) once revised, then BIBLE.md.

Tim (the owner) cares most that the game is fun and that the lore makes sense at a high level **and** at a
granular level — who knows what when, names, dates, cause and effect. Write accordingly.

## Inputs
- `docs/DECISIONS.md` — canon through **D-068**. D-066, **D-067**, D-068 were ruled after STORY was written and
  must be applied (level carry-over, Apex *Face it / Not yet*, communion Resolve 0–8 with pressure rule, anchors
  per loop, Silverwood Before costs a day and gives loot once, ending B/D fixes, Caelum's joining, the Conflux
  holds the whole Heartstone, the thirtieth-dawn / Tyrant-strikes / Nyx lore fixes, *Let go* / *Keep the vigil*,
  Threshold quests survive, `echo_tyrant_jailer` needs two sources, Loop 1 keeps only four non-legacy quests
  open, Breach-anchor 0 gold + fragment rules, closers with reasons, Echo catalog adoption).
- `docs/reviews/REVIEW-STORY-WORLD.md` — apply every finding's fix that targets STORY (1–12, 15–16; 13–14 touch
  STORY's Before section too).
- `docs/reviews/REVIEW-CROSS.md` §4 — the **U9 list**: C-03 (S §8.3), C-06, C-07, C-12, C-13 (S §12 additions),
  C-14, C-15, C-16 (drop quest XP), C-19, C-22, C-23, C-28–C-30, C-36–C-39, C-44, C-45, C-49–C-56 (read each).
- `docs/reviews/REGISTRY-DRAFT.md` — apply every rename/action targeting STORY; **§6.2: add the 26 Echoes to
  STORY §12** (with title, source, unlock); §6.3 mappings; §5 (5 class mini-quests to add; 6 stretch quests stay
  optional/marked); §7 codex re-cut to WORLD's eight creature families (C-19); §23 (ids referenced but defined
  nowhere — define the STORY-owned ones or remove the references).
- `docs/DESIGN.md` (revised in U8) §10 (loop/clock/Echo effects), §12 (companions), §4.10 (Tyrant/communion) —
  STORY's numbers must match DESIGN's; `docs/WORLD.md` §3 (gating), §4 (NPC ids/names), §13 (errata that name STORY).

## STORY.md work
1. Apply all of the above with targeted Edits (grep for the affected sections; do not rewrite untouched prose).
2. Keep every legacy line verbatim (lore article, NPC lines, quest names, Heartstone options, Tyrant defeat with
   the "dust,," typo fixed, portal text) — they were preserved in the draft; do not lose them.
3. Re-check §6's "critic's path" and each ending's requirement chain under D-066/D-067 and fix the text.
4. Re-check §11's 44 quests: Loop-1 availability per D-067.17 (mark the four open ones), stage conditions in the
   canonical condition language (DESIGN §13.3), rewards without quest XP where C-16 says so, bot coverage.
5. §15 style guide stays; keep the house voice (concrete nouns, short sentences, grave and strange, no gore).
6. Append `## Changelog (U9)` listing changes by section.

## BIBLE.md — the continuity bible
A reference every writer and checker uses; dense, tabular, no prose padding. Sections:
1. **Canon precedence and how to use this file** (3 lines; D-062).
2. **Timeline** — every dated event: Silverwood's height, the Nine's ritual (the three days of Silverwood Before,
   hour by hour on the last night), the Sundering (Year 0), faction origins, the seven prior Wayfinders (names,
   years, deaths), Nyx's arrival (Year 460), Dask's death (Year 430), Day 1 of the game (Year 500), the Breach
   Clock (Day 30; modifiers), Loop structure. One row per event with source (STORY §, DECISIONS D-#).
3. **People** — one row each: the Nine (name, role, verse, fate, trace in the present, creature origin), the six
   companions, every NPC (registry §4), the prior Wayfinders, the D-063 recast figures. Columns: canonical name,
   id, age/era, faction, what they know on Day 1 of Loop 1, what they can learn/remember by loop tier, where
   they are, voice note (one line), fate per ending (brief).
4. **Who knows what, when** — a matrix: fact (the Tyrant is the jailer; Nyx is of the Nine; the thirtieth dawn;
   the loop; Oriel is the Drowned; Brak/Kaelen; the Litany verses; the Anchor rule; the Amulet) × who can know it ×
   earliest loop/scene it can be learned × the Echo id.
5. **Places** — one row per region and per location (registry §2–3): canonical name, id, old names/aliases, what
   happened there historically, what is there now, gating, `temporallyUnstable`.
6. **Things** — the Litany (full text of nine verses as in STORY §2.3, with verse → Nine member → Echo id), key
   items (Amulet, Echo Crystal, Chronos Lens, Heartstone and its fragments, Breach-anchor and schematic halves,
   Dark Spellbooks, Void Shards, Litany pages, Caelum's token), factions (name, short name, leader, what they
   believe about the Tyrant and why they are wrong, rep tiers).
7. **Terminology and spelling** — D-026 plus every proper noun in the game, canonical spelling, banned variants
   (Aldour→Aulde, Shadow Weavers id `weavers`, etc.).
8. **Rules of the world** — the loop, what persists (D-011 + D-047 + D-067.2), Echoes, the Breach, Silverwood
   Before rules (D-016 + D-067.4/5/10), communion, the Horde, death.
9. **Open continuity risks** — anything you could not reconcile, with a proposed ruling.

Reply in ≤15 lines: what changed in STORY by section, Echo count now in §12, quest count and Loop-1-open list,
BIBLE row counts per section, unresolved items.
