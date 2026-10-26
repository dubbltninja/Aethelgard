# Decisions Log — Echoes of Aethelgard: The Unraveling

This file records every significant decision made during the rebuild, with the reasoning.
It is the master brief for all design, writing, and engineering work. Later documents
(DESIGN.md, STORY.md, WORLD.md, PLAN.md, BIBLE.md) elaborate on these decisions and must
not contradict them. If a later document needs to override something here, the override is
recorded here first.

Format: `D-###` id, date, decision, rationale. Entries are append-only; superseded entries
are marked, never deleted.

---

## Part A — Reading of the existing game (facts, not decisions)

What the repo contains as of commit `e7f64b3` ("added a browser-based frontend UI"):

- **Files**: `echoes_of_aethelgard.py` (4,624 lines: engine, UI, quests, dialogue, web
  server), `aethelgard_data.py` (856 lines: items, enemies, locations), `web_ui/`
  (thin browser wrapper that polls a Python HTTP server and renders terminal output).
- **World**: 21 locations in one connected graph. Start: Whispering Ruins. Finale: The
  Temporal Breach Apex.
- **Enemies**: 12 (Corrupted Shade, Wildling Brute, Arcane Wisp, Drowned Archivist,
  Void-Touched Stalker, Stone-Hide Golem, Shimmering Phantom, Aetherial Weaver,
  Sky-Whisper Sentinel, Glowfen Mireling, Temporal Aberration, The Chronos Tyrant).
  Enemies basic-attack only. They scale to player level (±1; Tyrant = level+1).
- **NPCs**: Ilyra (Remnants of Aethelgard, Whispering Ruins), Brak (Ironclad Nomads,
  Ironclad Camp), Nyx (Shadow Weavers, Chasm of Whispers), Kaelen Stonehand (trader,
  The Wayfarer's Respite), Borin Stonefist (Ironclad blacksmith, The Emberforge).
- **Quests** (6): Echoes in the Library (Echo Crystal), The Scholar's Lost Scroll,
  Clear the Barren Peaks (Wildling Brute), The Blighted Outpost (Stone-Hide Golems),
  Whispers of the Void (3 Void Shards), The Echoing Heartbeat (Heartstone choice:
  stabilize / exploit / destroy). Apex unlocks at 6 completed quests.
- **Classes** (3): Ranger (+2 STR, Rusty Dagger), Wizard (+2 MAG, Apprentice Staff),
  Elf (+2 AGI, Primitive Bow). Base stats: HP 100, MP 50, STR 8, MAG 7, AGI 6, 30 gold.
- **Spells** (3): Echo Bolt (10 MP, 5 + 2×MAG), Fireball (unlocked by reading 3 Dark
  Spellbooks), Lightning Bolt (6 spellbooks). Each spellbook costs 15 HP.
- **Items**: 26 definitions; rarity tiers Common/Uncommon/Rare/Epic/Legendary
  (×1.0/1.1/1.25/1.5/1.75); forge upgrades at the Emberforge; merchant restocks every 5
  moves.
- **Choices with no consequence**: Heartstone outcome (only a stat bauble), keeping the
  Echo Crystal (one extra Nyx line), faction help (no reputation). One ending ("ESCAPE").
- **Endgame**: Killing the Tyrant triggers the Horde (infection spreads node by node from
  the Apex), Brak dies holding the line, Ilyra holds a portal open in the Shattered
  Library, player enters → "The Last Threshold" text → score screen.
- **Lore article** (in-game): Great Sundering ~500 years ago; Rival Mages at the Ley Line
  Conflux (= Heartstone Depths) tried to command time; tore the Temporal Breach; Silverwood
  (capital) ruined; three factions; the Wayfinder is born with ley-sense; the Tyrant was
  "barely containing the full unraveling"; killing it shatters containment.
- **Credit line**: "a game by Tim Dibert".

Confirmed playtest problems (from the brief, verified in code):

- Echo Bolt at MAG 9 + staff deals ~25 vs melee ~12; nearly every fight is 2–3 casts.
- Classes are +2 to one stat and a starter weapon; nothing else differs.
- Enemies have one action (attack); no abilities, statuses, or phases.
- Tyrant (126 HP ×1.15 per level, 14 dmg) at level 2 vs a 100 HP / 50 MP player: not
  winnable without luck; scaling means levels never feel like progress.
- Quests, dialogue, and world logic are hardcoded in Python conditionals.

Continuity wrinkles found in the source (resolved in Part C):

- Lore says "Silverwood became the Whispering Ruins", but `Silverwood Plaza` is a separate
  location described as "Once the heart of Silverwood".
- The Tyrant-defeat text calls Brak "Brak Stonehand"; the trader is "Kaelen Stonehand".
- Lore names a region "Aether-Kissed Highlands" that no location uses.
- Kaelen's `faction` field is "Wayfarer's Respite", which is a place, not a faction.
- The spell/Dark Spellbook unlock is the only "ability progression" and it is class-agnostic.
- Dark Spellbooks are described as "corrupting", but reading six has no story consequence
  except one Ilyra line.

---

## Part B — Vision and creative decisions

### D-001 · Title and framing
**Decision.** The rebuilt game is *Echoes of Aethelgard: The Unraveling*. The existing
story, mechanics, names, factions, and locations are preserved as **Loop 1** and extended.
Nothing from the original is renamed; new content is added around it.
**Why.** The brief: "Keep the existing tone, names, factions, and locations; extend them,
don't replace them."

### D-002 · The loop
**Decision.** Stepping through Ilyra's portal does not lead "beyond". The portal is a tear
in the Temporal Breach; the Breach throws the Wayfinder back to the moment they first set
foot in the Whispering Ruins, Day 1, with memories intact. This is the end of Loop 1 and
the start of the real game. Every subsequent loop ends by one of: entering a portal into
the Breach, death (from Loop 2 onward), the Breach Clock expiring, or reaching a true
ending.
**Why.** The brief's vision. Death-as-reset from Loop 2 fixes "unwinnable fights = wasted
run" and is the genre convention (Hades, Outer Wilds). Loop 1 keeps classic game-over so
the original experience survives intact and the loop reveal lands as a twist.

### D-003 · Why the Wayfinder loops and others did not
**Decision.** Two unique conditions coincide for the first time: (1) the Wayfinder carries
the **Amulet of Echoes** (picked up in the first room in the original game), which holds
memory across temporal shear; (2) **Ilyra** is the first Remnant in centuries strong enough
to tear a portal, because she descends from **Oriel Danthe**, the archivist of the Nine
(see D-006). Earlier Wayfinders reached the Apex and died — killed by the Tyrant or
consumed by the unraveling with no portal to flee through.
**Why.** The lore calls Wayfinders "rare individuals"; we need a reason this one is special
that uses existing objects (the Amulet is literally the first item). Also seeds the Dask
companion (D-013).

### D-004 · The twist (confirmed from lore): the Tyrant is the jailer
**Decision.** The Chronos Tyrant is not the Breach's master. It is **Archmagus Veyran Thal**,
leader of the Nine Rival Mages, fused with the failing ritual at the instant the Breach
opened. He stepped into the tear and *held it*. He has been holding it for five hundred
years, existing at every instant of the ritual simultaneously, in agony. The "skeletal
limbs and crystalline shards" that surface in its mass are the other mages caught in the
ritual with him. Remnant scholars named it "Tyrant" because it tyrannizes *time* — it holds
one moment forever — and because they assumed anything at the heart of the Breach must be
its cause. Killing it removes the only containment. The Tyrant knows this and cannot say
so in Loop 1 (it cannot speak to anyone who has not crossed the Breach). From Loop 2 it
can speak to the Wayfinder.
**Why.** The in-game lore already says "a powerful entity born from or guarding the Breach
... barely containing the full unraveling" and "Upon defeating the Chronos Tyrant, its
fragile containment shatters." We make it literal and give it a face and a tragedy.

### D-005 · Why now: the Breach Clock
**Decision.** Veyran's hold is failing. Within one loop, if nothing changes, containment
collapses on its own around **Day 30** ("the thirtieth dawn") — the unraveling happens
even if the Tyrant is never touched. The ley network, sensing the failure, produced a
Wayfinder: Wayfinders are the world's immune response, born when containment weakens,
pulled toward the Ruins. Each loop has a visible day counter (subtle in Loop 1, explicit
"Breach Clock" from Loop 2). Travel between locations costs a quarter-day ("watch");
resting at a camp advances to the next dawn. A normal, thorough Loop 1 uses ~22–26 days.
Choices change the clock (see D-017).
**Why.** Gives the loop a mechanical shape, creates meaningful urgency without punishing
exploration, explains Wayfinders, and makes the Heartstone choice matter. Also provides a
second loop-closer in Loop 1 for players who dawdle (they still reach Loop 2).

### D-006 · The Nine Rival Mages (named)
**Decision.** The cabal is **the Ninefold Circle** ("the Nine"). Nine members, all named in
the codex. Fixed names:
1. **Veyran Thal** — Archmagus, leader; became the Tyrant's core.
2. **Nyxaria Vell** — called **Nyx**; theorist of the Void; flung 500 years forward by the
   Breach's recoil at the instant of failure. She is the Nyx the player meets. She has
   lived ~40 years in the present. Her "quiet starlight" eyes are Breach-touch.
3. **Oriel Danthe** — the Circle's archivist; recorded the ritual as the *Litany of the
   Conflux*; Ilyra's ancestor. Died in the Sundering; her records survive in the Sunken
   Archives (the Scholar's Lost Scroll is one of them).
4. **Maelis Korr** — wrote the Dark Spellbooks the player finds; his hand is in all of them.
5–9. Named and characterized in WORLD.md/STORY.md by the writing team; constraints: each
   has a role in the ritual, a surviving trace in the present (a location, item, or
   creature), and a codex entry. One of them must be the origin of the Stone-Hide Golems
   (a warder), one the origin of the Aetherial Weavers (a spire-builder).
**Why.** The brief asks for codex coverage of "the Rival Mages, the Tyrant's origin". Giving
Nyx a true identity converts a flat quest-giver into the game's best twist and justifies
everything she knows (Void Shards as "tears from the Breach").

### D-007 · The Wayfinder's nature
**Decision.** Wayfinders are born when the Breach's containment weakens; the ley network
produces them the way a body produces fever. They can sense ley currents, read echoes, and
survive temporal shear that kills others. There have been at least seven Wayfinders since
the Sundering, roughly one per 60–80 years, each drawn to the Ruins, each dead at or near
the Apex. The player is the eighth. The Tyrant has watched all of them. Wayfinders are
not chosen by anyone; they are a symptom. A Wayfinder who takes the Tyrant's place would
end the symptom (ending A). If the Breach is sealed, no more Wayfinders are born (B, D).
**Why.** Brief: codex must cover "the nature of Wayfinders". A mechanical, slightly cold
explanation fits the setting's tone (ambition, cost, consequence) better than prophecy.

### D-008 · Classes (five)
**Decision.** Keep Ranger, Wizard, Elf by name; add **Ironclad Warden** and **Shadow
Weaver**. Each class has a 3-branch ability tree with **15 abilities** (45+ required
minimum met with margin). Class fantasies:
- **Ranger** — hunter of the wilds between settlements. Branches: *Hunt* (ranged, marks,
  crits), *Steel* (melee, bleeds, counters), *Wildcraft* (traps, poisons, field medicine).
  Resource: Mana, generated on basic attacks (Focus).
- **Wizard** — self-taught ley-caster. Branches: *Pyre* (fire, burn), *Storm* (lightning,
  shock, chain), *Chronomancy* (slow, rewind, haste). Resource: Mana, large pool,
  regenerates per turn.
- **Elf** — a Silverwood-blooded ley-duelist (the Elves of Aethelgard are the old
  Silverwood bloodlines, long-lived, ley-sensitive; this reframes "Elf" from race-as-class
  into a cultural fighting tradition). Branches: *Bladesong* (fast multi-hits, evasion),
  *Leyweave* (nature/ley support, regen, shields), *Shadowstep* (phase, repositioning,
  first-strike). Resource: Mana, generated on dodges and crits.
- **Ironclad Warden** — the Nomads' wall. Branches: *Bulwark* (guard, taunt, shields),
  *Breaker* (armor break, stuns, heavy hits), *Iron Will* (anti-magic, resist, cleanse).
  Resource: Mana generated when hit or when guarding (Grit).
- **Shadow Weaver** — void-touched. Branches: *Hex* (curses, weaken), *Drain* (life steal,
  self-heal), *Unmaking* (void burst, high-risk self-damage). Resource: Mana, may also
  spend HP as mana (Blood price).
Class can be changed between loops at the Threshold (the Wayfinder re-manifests), with
per-class mastery tracked. Classes also change a handful of dialogue lines and one unique
mini-quest each.
**Why.** Brief: ability trees, 12+ abilities each, two new classes. Different resource
generation gives class identity without a second resource bar. Changing class between
loops rewards replay and makes "every class is viable" testable in one save.

### D-009 · Combat model
**Decision.** Turn-based, player + up to one active companion vs 1–3 enemies. Each
combatant has an **initiative** from Agility. Each turn: 1 action (ability, basic attack,
guard, item, flee, or companion command). Enemies **telegraph intents** for their next
action (type, target, number). Six **damage types**: Physical, Fire, Storm, Ley, Void,
Chrono. Resistances per creature (−50% weak / 0 / +50% resist / immune). **Status
effects** (first set): Bleed, Burn, Shock, Soaked, Slow, Haste, Stun, Weaken, Armor Break,
Mark, Curse, Shield, Regen, Taunt, Phase, Rewind, Poison, Blind. Interplay rules are a
small fixed table (e.g., Storm on Soaked = +50% and spreads Shock; Fire on Soaked removes
Soaked and deals −50%; Chrono on Haste removes it; Void on Shield breaks the shield).
**Guard** halves incoming damage and generates class resource. **Enemies do not scale with
player level**; each region has a fixed level band; elites and bosses are hand-tuned.
**Bosses** have 2–4 phases with triggers at HP thresholds or turn counts, phase-specific
intent patterns, and adds. Flee chance derives from Agility; bosses cannot be fled.
**Why.** Fixes every combat complaint in the brief. Fixed level bands make leveling feel
like progress and make regions legible ("this is a level 8 area").

### D-010 · Echoes (knowledge that persists)
**Decision.** An **Echo** is a discrete fact the Wayfinder has learned, with an id, a codex
line, and effects. Echoes persist across loops and are shown in the Loop Timeline and
Codex. ~60 Echoes at launch. Effects: unlock dialogue options ("I know what you are,
Nyx"), **shortcuts** (skip fetch-steps you already know the answer to; e.g., with
`echo.crystal_location` you can go straight to the alcove, and with
`echo.ilyra_watchword` Ilyra believes you about the loop on first meeting), **routes**
(new exits open when you know the way: the Breach-door in the Chronos Nexus opens with
`echo.litany_verse_1` + the Chronos Lens), and **ending eligibility**.
Some Echoes are mutually exclusive within one loop (siding with Nyx vs Ilyra at a key
moment reveals different truths), so the true ending requires at least three loops.
**Why.** Brief: "Knowledge carries across loops as 'Echoes' that unlock dialogue,
shortcuts, and new routes." Making them discrete flags keeps them testable and data-driven.

### D-011 · What persists vs resets
**Decision.** Persists: Echoes, codex, bestiary, map knowledge (greyed "remembered"
nodes), achievements, class mastery, **Resonance** (meta-currency earned from first-time
discoveries), **Attunements** (small permanent bonuses bought with Resonance at the
Threshold; capped so they are a convenience, not a power creep), run history. Resets:
level, stats, HP/MP, inventory, gold, quests, world state, companions, faction reputation
(Echoes let you regain it quickly). Abilities previously unlocked cost half as many points
to re-unlock (mastery).
**Why.** A true loop needs real resets or choices lose weight; but re-grinding five times
is tedious. Shortcuts + mastery + Attunements keep Loop 3+ brisk (target: a focused loop
in 20–30 minutes of play).

### D-012 · The Threshold
**Decision.** Between loops the Wayfinder stands in **the Threshold**, a liminal shore
inside the Breach: run summary, Echoes gained, Resonance to spend, class choice, and
(later) conversation with Dask and glimpses of the Tyrant. It has 4 "locations": the
Still Shore, the Gallery of Loops (run history), the Loom (Attunements), the Far Light
(exit to Day 1).
**Why.** Gives the loop a place and a ritual; houses New Game+, achievements, and the
run summary screen the brief requires.

### D-013 · Companions (six)
**Decision.** Recruitable companions, one active at a time, swapped at camps. They act
automatically per a stance (Aggressive / Guarded / Support) and have one player-triggered
signature ability with a cooldown. Each has a personal arc with 3+ quests and at least
two outcomes.
1. **Ilyra** — Remnant scholar; support/Ley caster. Arc: the cost of preservation; her
   lineage from Oriel; she can tear the portal because of it.
2. **Brak** — Ironclad scout; bruiser. Arc: he dies at the Apex in every loop where the
   Tyrant falls; saving him needs an Echo and a choice. Brother of Kaelen (D-022).
3. **Nyx** — Shadow Weaver; Void caster. Arc: she is Nyxaria Vell of the Nine; she wants
   the Breach fully open so she can go *back* and stop the ritual — sympathetic motive,
   catastrophic means.
4. **Dask** — "the Flickering Man": the seventh Wayfinder (died ~70 years ago at the
   Apex, scattered across moments by the Tyrant's chrono-strike; exists as a phantom
   between instants). Found in the Shimmering Pass. Knows about Wayfinders and that
   killing the Tyrant is wrong, but has never seen a loop. Can only remain in locations
   with temporal instability (Highlands, Nexus, Apex, Threshold, Silverwood Before).
5. **Mireya of Lanternreed** — Glowfen herbalist; nature/glow healer. Arc: the Glowlands'
   light is Breach-leak; her people are changing; she must choose what to preserve.
6. **Caelum Vesper** — apprentice to the Nine in pre-Sundering Silverwood; met in
   Silverwood Before; can be brought forward because the Breach unanchors him. Chrono
   caster. Arc: a boy from a doomed city learning his masters' sin.
**Why.** Brief names Ilyra, Brak, Nyx "plus new ones". Dask carries loop exposition and
the Wayfinder lineage; Mireya anchors the Glowfen region; Caelum anchors Silverwood
Before and the ending work there.

### D-014 · Factions and reputation
**Decision.** Three factions with reputation −100..+100 and tiers Hostile (≤−40), Wary
(−39..−10), Neutral (−9..19), Trusted (20..59), Sworn (≥60): **Remnants of Aethelgard**,
**Shadow Weavers**, **Ironclad Nomads**. Helping one often costs another a little. Tiers
gate merchant prices, unique gear, companion loyalty scenes, and ending eligibility.
Kaelen's Wayfarer's Respite is **neutral ground**, not a faction (fixes the data wrinkle).
**Why.** Brief requires faction reputation for exactly these three.

### D-015 · Regions and locations (73 total)
**Decision.** The existing 21 locations are grouped into five legacy regions and six new
regions are added:
- Legacy: **Silverwood Ruins** (7), **Mistwood & the Ironclad Reach** (6), **The Voidscar**
  (2), **Aether-Kissed Highlands** (3), **Glowlands & Nexus** (3).
- New: **Silverwood Before** (10; pre-Sundering, through the Breach), **The Drowned Reach**
  (8; flooded undercity beneath the Sunken Archives), **The Ashen Steppe** (9; the Nomads'
  wider range), **The Veil** (8; Voidscar deeps and the Shadow Weavers' sanctum), **The
  Glowfen** (8; the bioluminescent swamp beyond Veridian), **The Skyreach** (5; above the
  plateau), **The Threshold** (4).
Total 73 ≥ 60. Each location has: id, region, name, description, exits (with optional
conditions), level band, art spec, ambient audio spec, items, encounters, NPCs, events.
**Why.** Brief minimums; each new region ties to a faction, a companion, or an ending.

### D-016 · Silverwood Before (time-travel rules)
**Decision.** Reachable from Loop 2 via the Breach-door in the Chronos Nexus (needs
Chronos Lens + `echo.litany_verse_1`) or through the Apex if the Tyrant is spared. It is a
*time-locked echo*: the last three days before the Sundering, repeating. Changes made there
do not propagate to the present **except** through **Anchors**: objects placed in the
Conflux chamber survive the Sundering and appear in Heartstone Depths. Caelum can be
brought forward because the Breach unanchors him. You cannot stop the ritual (attempting
it is a quest with a tragic, informative failure that yields a key Echo).
**Why.** Bounded time travel avoids paradox spaghetti while enabling puzzles and the
Mending ending.

### D-017 · Every existing choice gains consequences
**Decision.**
- **Heartstone — Stabilize**: Breach Clock +6 days this loop; Remnants +15; Echo
  `heartstone_resonance` (persists; required for endings B and E); unlocks Ley-tuned
  crafting.
- **Heartstone — Exploit**: large power item (Heartstone Core), Clock −5 days, Shadow
  Weavers +15, Remnants −15; Heartstone Depths becomes unstable (new encounters); required
  for ending C.
- **Heartstone — Destroy**: Clock −10 days; all Breach-born creatures −25% HP this loop;
  Ironclad +20, Remnants −25, Weavers −10; Ley abilities cost +25% MP this loop; required
  for ending D; the Depths go dark (new area state).
- **Echo Crystal — Give to Ilyra**: Remnants +15; Ilyra deciphers it → Echo
  `litany_verse_1` on the *next* conversation.
- **Echo Crystal — Keep**: Weavers +10, Remnants −10; from Loop 2, the Amulet lets you
  hear the Crystal yourself → `litany_verse_1` immediately plus `nine_voices` (hearing nine
  voices, a clue to Nyx).
- **Void Shards — Give to Nyx**: Weavers +20; Shadow-Kissed Dagger.
- **Void Shards — Refuse**: Keep shards as crafting material (void-forged gear at the
  Emberforge, Ironclad +5); Nyx turns Wary.
- **Reading Dark Spellbooks**: each read adds **Corruption** (0–6). Corruption unlocks
  Wizard/Weaver bonuses and dialogue, costs HP, and at 6 marks you for the Weavers
  (Remnants −10) and locks ending E unless cleansed at Lanternreed.
- **Brak's quests**: skipping them in a loop means Brak is not at the Apex (he lives, you
  lose his aid). Completing them and *telling him the truth* with `echo.brak_death` lets
  you keep him away from the Apex (he survives).
- **Factions helped/ignored**: reputation tiers gate everything above.
**Why.** Brief: "Every existing choice must gain consequences."

### D-018 · Endings (six true endings + two loop-closers)
**Decision.** Loop-closers (not endings, but recorded): **The Escape** (Loop 1 classic:
kill Tyrant, flee through portal → Loop 2) and **The Fall** (clock expires or death in
Loop 2+ → Threshold). True endings, all reachable from Loop 2+, each with a distinct final
sequence, epilogue slides per companion/faction, and an achievement:
- **A · The Warden's Vigil** — spare the Tyrant, learn the Litany, take Veyran's place.
  The Nine are released. Aethelgard is saved; the Wayfinder is gone. Requires:
  `litany_complete`, Tyrant spared, choose to step in. Bittersweet.
- **B · The Mending** (true ending) — seal the Breach from both ends: anchor the Conflux
  in Silverwood Before (with Caelum), forge the Breach-anchor at the Emberforge (Aetherium
  + stabilized Heartstone fragment + Void Shard resonance), close the Apex with the
  Tyrant's consent. The Nine are freed to die; time flows forward. Requires:
  `heartstone_resonance`, `litany_complete`, `void_resonance` (Nyx's knowledge, obtainable
  only by having been Trusted with the Weavers in *some* loop), the Breach-anchor, Trusted
  with at least two factions, Tyrant spared.
- **C · The Weaver's Dawn** — help Nyx open the Breach fully and go back with her. The
  present unravels. You witness the ritual from inside; it was always going to fail; Nyx
  becomes one of the shards; the Tyrant that forms has *your* face among the Nine's. Dark.
  Requires: Weavers Sworn, Heartstone exploited, Nyx alive and loyal.
- **D · The Iron Silence** — destroy the Heartstone, drive the Breach-anchor into the Apex
  to cut the ley. Magic dies; the Tyrant dies without unraveling; no more Wayfinders; the
  Nomads inherit a mundane world. Requires: Ironclad Sworn, Heartstone destroyed, the
  Breach-anchor, Brak alive.
- **E · The Long Archive** — the Remnants' way: stabilize the loop deliberately. The
  stabilized Heartstone's resonance soothes the Tyrant; Ilyra becomes the Keeper who
  remembers every loop; Aethelgard becomes a conscious time-ring, safe and unchanging; you
  may leave. Requires: Remnants Sworn, Heartstone stabilized, Corruption < 6, Ilyra alive.
- **F · The Unbound** — walk away. From Loop 2, at the Apex with the Tyrant spared, step
  through the Breach to somewhere that is not Aethelgard. Cold epilogue; everyone else's
  fate reported in one line each. Requires: Tyrant spared and refusing every other path.
**Why.** Brief: "at least five distinct endings driven by real choices." Six, plus the two
loop-closers, each tied to the fate of the Tyrant, the Heartstone, and a faction.

### D-019 · Quests (target 44)
**Decision.** The six legacy quests keep their ids, names, and essential beats. New quests:
faction chains (3 per faction = 9), companion arcs (3 per companion = 18), regional quests
(≥1 per new region = 7), loop-only quests (require Echoes; 4), ending quests (6). Quests
are data: stages with objectives (conditions), on-complete effects, journal text per stage,
and optional branching. Every quest must be completable by at least one bot strategy.
**Why.** Brief minimum 40.

### D-020 · Codex and voice
**Decision.** 80+ codex entries in four in-world voices, each tagged: **Remnant Archive**
(measured, precise, dated), **Ironclad Telling** (oral, blunt, proverb-laden), **Weaver
Fragment** (lyrical, elliptical, dangerous), **Wayfinder's Notes** (the player's own terse
observations, first person). Rules: concrete nouns, no purple prose, short sentences, the
existing descriptive register ("The air smells of ozone and decay"). Every entry ≤ 220
words. Entries unlock by discovery, Echoes, or reading.
**Why.** Brief: 80+ entries in a consistent voice. Four voices with hard rules are easier
to keep consistent than one vague tone.

### D-021 · Replay layer
**Decision.** **New Game+** = a fresh save that starts with all Echoes and codex of a
completed save (any true ending) and loop counter continuing. **Challenge modifiers**
(toggle at the Threshold): Iron Loop (no Attunements), Frayed Clock (20-day loops),
Mute Ley (no Echo shortcuts), Horde Rising (elites everywhere), Glass (double damage
both ways), Pacifist's Vow (XP only from quests and discovery). **Achievements**: ~40.
**Run summary** after every loop and ending.
**Why.** Brief scope item 7.

---

## Part C — Continuity resolutions

### D-022 · Brak and Kaelen Stonehand
**Decision.** Brak and Kaelen are brothers. Ironclad scouts drop family names when they
take the oath (the Nomads use clan-names), so Brak is "Brak" and, formally, "Brak of the
Ironclad". Kaelen kept the name and left the Nomads to trade at the Respite; the brothers
have not spoken in years. The one existing line "Brak Stonehand" is kept as the narrator
using his birth name at the moment of his death, which is deliberate. A quest explores this.

### D-023 · Silverwood and the Whispering Ruins
**Decision.** Silverwood was the capital. Its entire ruin-field — Whispering Ruins,
Crumbling Archway, Darkened Corridor, Shattered Library, Silverwood Plaza, Sunken
Archives, Heartstone Depths — is "the ruins of Silverwood". **Whispering Ruins** is the
name of the outskirts where the Wayfinder arrives and, colloquially, of the whole ruin.
Silverwood Plaza is the old civic heart. The lore line "Silverwood became the Whispering
Ruins" stands as colloquial truth.

### D-024 · Aether-Kissed Highlands
**Decision.** This is the region name for Shimmering Pass, Aetherium Spires, and
Sky-Whisper Plateau (and the new Skyreach above them).

### D-025 · Dates and durations
**Decision.** The Great Sundering happened **500 years** before Day 1 (exactly, in-world:
the Remnants count years from it: "Year 500 of the Sundering"). Silverwood Before is the
last three days before it. Dask died 70 years ago. Nyx arrived in the present 40 years
ago. A loop's clock is 30 days base. Ilyra is ~30. Brak ~40, Kaelen ~44. Borin ~55.

### D-026 · Terminology
**Decision.** Canonical spellings: *Wayfinder*, *the Breach* / *the Temporal Breach*,
*the Sundering* / *the Great Sundering*, *ley lines* (two words, lowercase), *the Conflux*
/ *the Ley Line Conflux*, *Heartstone* (one word, capitalized), *the Nine* / *the
Ninefold Circle*, *Echo* (capitalized when meaning persisted knowledge), *the Threshold*,
*the Breach Clock*, *Resonance*, *Attunement*, *Corruption*. Factions: *the Remnants*
(short) / *Remnants of Aethelgard*, *the Shadow Weavers* / *Weavers*, *the Ironclad
Nomads* / *the Ironclad* / *Nomads*. "The Horde" is what Brak calls the unraveling's
creatures; the Remnants call it "the unraveling".

### D-027 · Author credit
**Decision.** Keep "a game by Tim Dibert" in the credits and ending screens.

---

## Part D — Engineering decisions

### D-030 · Stack
**Decision.** TypeScript (strict), Vite, **React 18** for UI, **zod** for content schemas,
**vitest** for unit tests, **Playwright** for UI tests, **ESLint** (typescript-eslint) +
Prettier. No backend. No external runtime assets. Minimal dependencies otherwise.
**Why.** React is the most reliable choice for many agents working in parallel on UI;
zod gives validated data files with inferred types for free; vitest/Playwright are the
standard pairing with Vite.

### D-031 · Architecture
**Decision.** Three layers with one-way dependencies:
1. `src/engine/` — pure, deterministic, no DOM. `GameState` is a plain serializable
   object. `step(state, action, rng) → { state, events }` is the only mutation path.
   Combat, loop, quests, dialogue, economy, crafting, saves all live here.
2. `src/content/` — data files (TypeScript modules exporting plain objects, validated by
   zod schemas in `src/content/schema/`) plus a `validateContent()` that runs in tests and
   at build. Content never imports the engine; the engine never imports concrete content
   (it receives a `ContentPack`).
3. `src/ui/` — React. Subscribes to a store wrapping the engine. All screens are
   components; art is inline SVG components in `src/ui/art/`; audio in `src/audio/`
   (Web Audio procedural synthesis).
Also: `src/sim/` — headless bots and simulation harness (imports engine + content, no UI).
`tests/` — unit + e2e. `legacy/` — the Python game, untouched except for its own README.
**Why.** Headless simulation and strong tests require a pure engine; data-driven content
is a brief requirement; separation lets agents work in parallel without collisions.

### D-032 · Determinism and RNG
**Decision.** `xoshiro128**` seeded PRNG stored in `GameState.rng` (four 32-bit words).
Every random draw goes through `rng.next()` in the engine; UI never draws random numbers
that affect state (visual flourishes use a separate seed). A run is reproducible from
(seed, action list).
**Why.** Brief: deterministic seeded RNG; also makes bugs from simulations reproducible.

### D-033 · Content condition/effect language
**Decision.** Conditions are JSON objects: `{ all: [...] }`, `{ any: [...] }`,
`{ not: ... }`, `{ flag: "id" }`, `{ echo: "id" }`, `{ quest: "id", stage: "x" }`,
`{ item: "id", count: n }`, `{ rep: { faction, min, max } }`, `{ loop: { min, max } }`,
`{ day: { min, max } }`, `{ class: "id" }`, `{ companion: "id", state }`,
`{ stat: { name, min } }`, `{ corruption: { min, max } }`, `{ location: "id" }`,
`{ killed: "enemyId", count }`. Effects mirror them: setFlag, grantEcho, questAdvance,
giveItem, takeItem, rep, gold, xp, heal, damage, clock, spawn, teleport, recruit,
dismiss, unlockExit, startCombat, startDialogue, endLoop(reason), ending(id). Both are
zod-validated and interpreted by one evaluator in the engine.
**Why.** Keeps 44 quests and hundreds of dialogue nodes in data, testable without code.

### D-034 · Saves
**Decision.** Save = `{ version, seed, state }` JSON. Three manual slots + one autosave in
`localStorage`, each with a summary. Export downloads the JSON; import reads a file and
validates with zod. A **profile** (persistent layer: Echoes, codex, achievements,
Resonance, settings) is stored separately so it survives deleting a run. Migrations keyed
by `version`.
**Why.** Brief: save slots, localStorage plus export/import.

### D-035 · Accessibility and input
**Decision.** Every interactive element reachable by keyboard; a visible focus ring;
screen-level shortcuts (numbers for actions, arrows/WASD for map, I/Q/C/B/M/Esc for
panels); `prefers-reduced-motion` disables animation and the audio "pulse"; a high-contrast
toggle; text scale setting; minimum 4.5:1 contrast on all text; ARIA live region for the
log. Mobile: single-column layout with a bottom tab bar; touch targets ≥ 44px.
**Why.** Brief scope item 2.

### D-036 · Art and audio
**Decision.** All art is inline SVG/CSS generated from a small set of parametric
components per region (palette, horizon, silhouettes, particles) plus hand-authored
focal pieces for key places and bosses. Creature portraits are stylized SVG sigils with
animated details. Audio is Web Audio synthesis: per-region ambient drones, combat
percussion, UI ticks, a Tyrant theme; a single `AudioEngine` with master/ambient/sfx
volume and mute, started on first user gesture.
**Why.** Brief: original SVG/CSS art, procedural Web Audio, no external assets.

### D-037 · Simulation and balance process
**Decision.** Bots: `melee`, `caster`, `explorer`, `speedrunner`, `pacifist`, plus
`random` as a baseline. Each bot is a policy over engine observations. The harness runs
N seeded loops per (class × bot) and records: completion, loop reached, ending, deaths,
days used, damage dealt by source, abilities used, items crafted, quests completed,
locations visited, soft-lock detection (no legal progress-making action for K steps).
Targets written to BALANCE.md: every class finishes Loop 1 ≥ 60% with the melee or caster
bot; no single ability > 35% of total damage for any class in aggregate; difficulty curve
monotone across regions (median fight length and death rate rise smoothly); every ending
reached; every quest completed; every location reached; zero soft-locks in 2,000+ runs.
**Why.** Brief quality bars.

### D-038 · Branching, commits, and CI
**Decision.** All work on branch `unraveling`. Small commits, pushed often. Never push to
`main`. CI (`.github/workflows/ci.yml`): typecheck, lint, unit tests, content validation,
build, Playwright smoke. Pages workflow (`.github/workflows/pages.yml`) deploys `dist/` on
push to `main` and on manual dispatch (so the PR description can link the preview
procedure; actual URL goes live when Tim merges). Vite `base` = `/Aethelgard/`.
**Why.** Brief.

### D-039 · Legacy
**Decision.** Move `echoes_of_aethelgard.py`, `aethelgard_data.py`, `web_ui/` to `legacy/`
with a short `legacy/README.md` explaining how to run the original. No behavior changes.

### D-040 · Documentation set
**Decision.** `docs/DESIGN.md` (systems), `docs/STORY.md` (plot, loops, endings, quests,
dialogue beats), `docs/WORLD.md` (regions, locations, creatures, items), `docs/PLAN.md`
(work breakdown, briefs, integration order), `docs/BIBLE.md` (continuity bible: names,
dates, facts, who-knows-what-when), `docs/BALANCE.md`, `docs/REPORT.md`, `docs/CONTENT.md`
(how to add content), this file.

---

## Part E — Decisions added during the build

(Appended as the work proceeds.)

### D-041 · `step` takes and returns the Profile (adopted from PLAN §4.0)
**Decision.** `step(state, action, content, profile) → { state, profile, events }`. The profile is a
separate object (survives deleting a run) but Echo grants, codex/bestiary unlocks, achievements and
Resonance are written during engine transitions, so it is an input and output of `step`.

### D-042 · immer for state transitions (adopted)
**Decision.** `step` is the only place `produce` is called on `GameState`/`Profile`; reducers receive
drafts. One dependency (immer) is accepted for correctness and readability.

### D-043 · Illegal actions never throw (adopted)
**Decision.** `step` returns the same `state`/`profile` references and one `actionRejected` event.
Throwing is reserved for programmer errors (missing content id after validation, corrupt state).

### D-044 · Id convention — typed prefixes ARE part of the id (overrides PLAN's proposal)
**Decision.** All ids are lowercase `snake_case`, ASCII, unique across the whole content pack, stable
forever. Type prefixes are part of the id string and are used in data, prose, and code:
`region_`, `loc_`, `cr_` (creatures), `item_` (all items incl. quest/key/recipe/tome; materials may use
`mat_`), `recipe_`, `npc_`, `q_`, `echo_`, `scene_`, `codex_`, `ending_`, `closer_`, `status_`,
`affix_`, `att_` (attunements), `ach_`, `mod_`, `sfx_`, `screen_`, `ev_` (location events), `flag_`.
Abilities are prefixed by class: `rgr_` (Ranger), `wiz_`, `elf_`, `wrd_` (Warden), `wvr_` (Weaver);
companion abilities `comp_<companion>_<name>`; item-granted abilities `itm_`. Plain (unprefixed) ids:
classes (`ranger`, `wizard`, `elf`, `ironclad_warden`, `shadow_weaver`), companions (`ilyra`, `brak`,
`nyx`, `dask`, `mireya`, `caelum`), factions (`remnants`, `weavers`, `ironclad`), damage types
(`physical`, `fire`, `storm`, `ley`, `void`, `chrono`), stats (`strength`, `magic`, `agility`).
In data the Echo condition is `{ echo: "echo_litany_verse_1" }` (full id). `echo.x` in older prose
means `echo_x`. The legacy spell ids are `wiz_echo_bolt`, `wiz_fireball`, `wiz_lightning_bolt`.
**Why.** Three of four docs already use prefixes; they make grep unambiguous and dialogue effects
self-describing. PLAN.md (Appendix A, D-044 text, code samples) must be revised to this.

### D-045 · Quest count
**Decision.** 44 quests total, the six legacy quests counted inside their faction/regional categories
(STORY §11). Meets the brief's ≥40. STORY's six stretch quests are optional, not scope.

### D-046 · Oriel Danthe is the Drowned Archivist
**Decision.** The Drowned Archivist that guards the Scholar's Lost Scroll is Oriel's echo, "the First
Drowned", revealed from Loop 2. Elaborates D-006 ("died in the Sundering").

### D-047 · The Amulet of Echoes is exempt from the reset
**Decision.** The single exception to D-011's inventory reset: the Amulet returns on the Wayfinder's
neck at Day 1 of every loop from Loop 2 (the "Amulet warm" cue). It also grants the basic ley attack
`itm_echo_bolt` (10 MP, Ley, ≈0.9× basic attack) to every class so Loop 1 still "feels" like the
original; the Wizard's `wiz_echo_bolt` is the real spell.

### D-048 · Apex gate
**Decision.** Loop 1: six completed quests (legacy rule). Loop 2+: `echo_apex_resonance` (granted the
first time the Wayfinder reaches the Apex) OR six completed quests. Data form:
`{ any: [ { counter: { name: "quests_completed", min: 6 } }, { echo: "echo_apex_resonance" } ] }`.

### D-049 · Threshold and Loop 1 death
**Decision.** The Loop 1 → Loop 2 transition skips the Threshold: the portal text plays, then the
Wayfinder wakes in the Whispering Ruins (the twist). Every later loop-closer passes through the
Threshold. Loop 1 death is the classic FALLEN game-over to the title (reload a save); Echoes and codex
gained during that Loop 1 are still written to the profile (the Amulet remembers).

### D-050 · Durn Hallow walked out
**Decision.** Hallow left the chamber at the sixth verse; eight stood at the ninth; the Echo Crystal
still holds nine voices because all nine verses were spoken. Hallow's walk is the Ironclad founding
story and the sixth question of communion.

### D-051 · Two Tyrant encounters
**Decision.** `cr_chronos_tyrant_contained` (Loop 1; hand-tuned for a level 12–13 party; 3 phases:
The Holding / The Fracture / The Nine Speak) and `cr_chronos_tyrant_unveiled` (Loop 2+; band 15–18;
4 phases plus the communion path). Loop 1 XP is not raised.

### D-052 · Heartstone fragments and the Breach-anchor
**Decision.** `recipe_breach_anchor` accepts either `item_heartstone_fragment_stable` (from Stabilize)
or `item_heartstone_fragment_dead` (from Destroy). Mireya's dam quest accepts either fragment with
different epilogue text (the dead fragment dams "permanently and darkly").

### D-053 · One-action turns
**Decision.** The companion signature ability costs the player's action. Guard generates +5 class
resource for every class (the Warden's Grit gets more, per DESIGN). Companions scale with player level.

### D-054 · Communion scoring
**Decision.** Communion uses a discrete **Resolve** meter (integer, 0–8) across three Movements that
mirror the combat phases (`tyr_movement_1..3`); STORY owns the beats and questions, DESIGN owns the
numbers and replaces its 0–100 meter with this one. Thresholds: ≥3 the Tyrant lets you pass (F
possible); ≥6 it consents to release or replacement (A); 8 with `echo_void_resonance`,
`echo_heartstone_resonance` and the Breach-anchor in hand enables the Mending (B).

### D-055 · Dark Spellbooks and Resonance
**Decision.** The first Corrupted Shade killed each loop always drops a Dark Spellbook; later Shades
50%. Loop-closers award +10 Resonance (an addition to D-011's discovery-only rule).

### D-056 · Level bands and XP curve
**Decision.** DESIGN's band table is canon (Silverwood Ruins 1–4, Mistwood & Ironclad Reach 2–6,
Drowned Reach 4–8, Voidscar 5–8, Aether-Kissed Highlands 6–10, Ashen Steppe 7–11, The Glowfen 8–12,
Glowlands & Nexus 9–13, The Veil 10–14, Skyreach 12–15, Silverwood Before 13–17, Apex 15–18 from
Loop 2). DESIGN's XP curve (per-level 100, 150, 220, 300, 400 … 3,660) is canon. PLAN's alternatives
are withdrawn.

### D-057 · Merchant restock and economy cadence
**Decision.** Merchants restock at every dawn (DESIGN). Legacy "every 5 moves" is gone.

### D-058 · Tooling details
**Decision.** Playwright pinned `^1.49` (floats within 1.x). Vite `base` from `VITE_BASE`, default
`/Aethelgard/`. Saves are disposable until the first full-screen integration checkpoint; from then,
save `version: 1` and migrations. Fun reviews are played by fresh agents (three rounds) and the lead
fixes the findings; Tim is not required to play.

### D-059 · Camp scenes and Dask's constraint
**Decision.** Companion camp conversations are dialogue overlays triggered on `rest`. Temporal
instability is a per-location flag (`temporallyUnstable: true`) set in WORLD.md for: every location
in Aether-Kissed Highlands, Skyreach, The Chronos Nexus, The Temporal Breach Apex, all of Silverwood
Before, all of the Threshold, plus any Horde-infected location while infected. Dask can only remain
in flagged locations.

### D-060 · The Horde after Loop 1
**Decision.** Whenever the Tyrant dies in combat (any loop) or the Breach Clock expires, the legacy
node-by-node infection runs and the loop closes by portal (`closer_escape`) or death (`closer_fall`).
Endings A, B, D and E never trigger the Horde. Ending C unravels the present as part of its final
sequence (scripted, not the infection system).

### D-061 · Ranger ability prefix
**Decision.** Ranger abilities use `rgr_` (DESIGN's draft `rng_` collides with the `Rng` PRNG type).

### D-062 · Document precedence for conflicts
**Decision.** When the same fact has different ids, names, or numbers across documents, the owner
document wins and the others adopt its form: **DECISIONS** (everything it states) > **STORY** (people
and their names/roles, dates, events, the Nine, quests `q_*`, Echoes `echo_*`, scenes, codex, endings)
> **DESIGN** (systems and numbers: stats, formulas, abilities, statuses, affixes, materials `mat_*`,
item mechanical fields, Attunements, achievements, modifiers, economy) > **WORLD** (places, map,
regions, encounters, creatures `cr_*`, item and NPC placement, NPC ids `npc_*`) > **PLAN**
(engineering). Echo ids: STORY §12 is the catalog; an Echo that DESIGN or WORLD needs and STORY lacks
is added to STORY §12 (not invented elsewhere). NPC ids: WORLD's ids; NPC names/roles: STORY's.

### D-063 · The Ninefold Circle is STORY's nine; WORLD's extra figures are not of the Nine
**Decision.** The Nine are exactly: Veyran Thal, Nyxaria Vell, Oriel Danthe, Maelis Korr, Haldric
Vane, Durn Hallow, Seraphine Aulde, Imre Sallow, Tovren Masque (STORY §2). Figures that WORLD §3
described as "of the Nine" are recast as Silverwood people who are NOT of the Nine:
- **Corvin Dreyl** — Captain of the Silverwood Watch; his pyre-ward (built to Haldric Vane's design)
  turned outward in the Sundering.
- **Ilsabet Rhune** — Silverwood's Warden of Waters (a civic office); she opened the cisterns to drown
  the Conflux's fire.
- **Hadrek the Clockwright** — Tovren Masque's orrery-maker.
- **Tobrin Vask** — Haldric Vane's apprentice ward-engineer; in Silverwood Before he keeps the second
  half of the Breach-anchor schematic (`echo_vask_seal`, `item_ward_seal` stand).
WORLD's `echo_aldour_weavers` becomes `echo_aulde_weavers` unless STORY §12 already has an equivalent.

### D-064 · NPC role reconciliation (STORY names win for STORY roles)
**Decision.**
- Remnant Keeper and faction-chain giver (`q_keepers_ledger`): **Keeper Ansel Dray** (`npc_ansel_dray`).
  WORLD's Scribe Tamsin Reed (`npc_tamsin_reed`) stays: a Remnant scribe-merchant at the Plaza.
- Ironclad clan-mother of the Ashen Steppe: **Hadda Ironvow** (`npc_hadda_ironvow`). WORLD's Oma Varr
  stays as the Steppe's old teller who knew the Stonehand brothers; Tessaly Varr stays (caravan master).
- Weaver keeper at the Veil and chain-giver (`q_unlidded_eye`): **Sethe the Unlidded**
  (`npc_sethe_unlidded`). WORLD's Ysmay (`npc_ysmay`) stays as the Thread-Mother, ritual elder of the
  Hollow Choir; she may give Veil regional quests.
- Glowfen elder who cleanses Corruption at the Breathing Pool: **Elder Wen Thistlecourt**
  (`npc_elder_wen`); WORLD's "Elder Wren" (`npc_elder_wren`) is merged into her. Elder Tam stays.
- WORLD's `npc_hollis_vane` is renamed **Hollis Cade** (`npc_hollis_cade`) to avoid implying kinship
  with Haldric Vane.
- DESIGN's placeholder NPC ids adopt WORLD's: `npc_kaelen` → `npc_kaelen_stonehand`; DESIGN's
  `npc_mireya_stall`, `npc_remnant_archivist`, `npc_skyreach_trader`, `npc_veil_vendor`,
  `npc_ironclad_quartermaster` map to the WORLD merchant at that place (WORLD §4/§9 define them).

### D-065 · Toolchain under a blocked npm registry (supersedes parts of D-030, D-042, D-058)
**Context.** This session's egress policy denies `registry.npmjs.org` (proxy 403 on CONNECT; direct
DNS unavailable). Per policy we do not route around it. These packages are installed locally under
`/opt/npm-tools/node_modules` and verified working together: **esbuild 0.28.2**, **TypeScript 6.0.3**,
**React 19.2.8** + react-dom, **zod 3.25.76**, **Playwright 1.56.0** (runner via `playwright/test`,
Chromium in `/opt/pw-browsers`), **@types/node 26.2.0**, **tsx 4.23**, and **bun 1.4.2** (test runner
with coverage). Not available: Vite, vitest, ESLint, Prettier, immer, jsdom, Testing Library,
`@types/react`, axe-core.
**Decision.**
- **Build/dev:** esbuild via `tools/build.ts` and `tools/dev.ts` (serve + watch + reload), producing a
  static `dist/` with relative asset URLs (works at any Pages path; no deep links, so no 404 issue).
  Vite is not used. esbuild is the transformer Vite itself uses; the app has no Vite-specific code.
- **Typecheck:** `tsc --noEmit` with strict flags (strict, noUncheckedIndexedAccess, noUnusedLocals,
  noUnusedParameters, noImplicitReturns, noFallthroughCasesInSwitch, noImplicitOverride).
- **Lint:** `tools/lint.ts` (custom rules: layer import boundaries, no `Math.random`/`Date.now`/DOM in
  `src/engine`, no `console` in `src/engine`/`src/content`, no explicit `any` outside shims, no
  `.only`/`debugger`, whitespace/final newline) plus the tsc flags above.
- **Unit tests + coverage:** `bun test` with coverage thresholds in `bunfig.toml`.
- **E2E:** Playwright 1.56 via `playwright/test`; a11y checks implemented in-repo (contrast, names,
  focus) since axe-core is unavailable.
- **Schemas:** zod 3 (available) as planned.
- **State updates:** `step` deep-copies with `structuredClone` and mutates the copy (no immer); D-042
  is superseded. Callers never observe mutation.
- **React 19** (not 18). Types: in-repo declarations `src/types/react.d.ts` (hooks, JSX runtime,
  intrinsic elements, events) because `@types/react` is unavailable; `src/types/bun-test.d.ts`
  likewise for `bun:test` if `bun-types` is absent.
- **Dependencies:** `package.json` pins exact versions of the packages above. Locally,
  `tools/link-local-deps.mjs` symlinks them from `/opt/npm-tools/node_modules` into `node_modules`
  (offline bootstrap). In GitHub Actions, `npm install` fetches the same exact versions (no lockfile can
  be generated offline) and `oven-sh/setup-bun` provides bun.
- **Formatting:** no Prettier; `.editorconfig` plus lint whitespace rules.
**Why.** Meets every quality bar with tools that run here; nothing the brief asks for depends on Vite
specifically. Recorded for the final report so Tim knows why Vite is absent.

### D-066 · Rulings adopted from U5 (REVIEW-CROSS) and U6 (REVIEW-DESIGN-PLAN), 2026-10-13
The lead adopts the reviewers' proposed resolutions below. Details and rationale are in
`docs/reviews/REVIEW-DESIGN-PLAN.md` (rulings 1–18) and `docs/reviews/REVIEW-CROSS.md` (C-01..C-58);
`docs/reviews/REGISTRY-DRAFT.md` is the canonical id registry until BIBLE.md supersedes it.
1. **Contained Tyrant** retuned for a level-11 party: 460 HP; "Remember" once per phase; boss Rewind restores
   ≤10% max HP and is removed by Void or Ley damage; adds = 2 Temporal Aberrations at 40% HP (1 if solo);
   phase triggers count rounds. Target 12–18 rounds.
2. **`itm_echo_bolt`** (Amulet, every class): 10 MP, Ley, max(0.9·ATK, 4 + 0.8·SP); removes Rewind.
3. **Wizard economy:** regen 3 + ⌊level/4⌋ MP per turn (not 10%); Fireball 10 MP, 1.2·SP + 3, Burn 60%;
   Burn tick 1 + 0.2·SP; Echo Bolt 10 MP; Void Lance 1.3·SP + 3.
4. **Status timing:** a status applied during its holder's own turn skips that turn's countdown. DoT ticks apply
   resistance but never armor, ward, or Guard.
5. **Self-costs** (Blood price, HP costs) require current HP > cost and can never kill.
6. **Communion:** Resolve 0–8, starts at 1; rejection checked only at the end of Movements II and III;
   F ≥ 3, A ≥ 6, B = 8 (plus D-054's B requirements). Replaces DESIGN 0–100 and STORY 0–9.
7. **Closers:** both Loop 1 closers lead straight to Loop 2 Day 1 (no Threshold). Clock expiry starts the
   Horde (D-060) with a **3-move delay**; DESIGN's scripted Fall / `fall_clock` are removed. Death in any Horde
   = Fall. `closer_escape` = any portal flight in any loop; `closer_fall` carries reason `death|expiry|rejected`.
8. **Clock floor:** clock modifiers can never set the limit below current day + 3 dawns. Ending E's gate is
   "the last dawn before collapse" (`daysLeft ≤ 1`), not Day 29 (fixes Frayed Clock).
9. **Silverwood Before** has its own Day 1–3 counter (resets on re-entry); the Breach Clock is frozen inside.
10. **Breach-anchor:** 0 gold; its Ironclad rep gate is Neutral while `q_the_mending` or `q_iron_silence` is
    active; 3 ember ore (not 5). `echo_void_resonance` moves from the recipe to ending B's consent check (ending D
    no longer needs a Weavers loop). Every Heartstone choice yields **2 fragments**.
11. **Fleeing:** only bosses and story gates block flight; a fled fixed group scatters for the loop
    (+2 watches, no XP/loot). This makes the pacifist routes in WORLD §10 valid.
12. **Companions** have no MP; abilities use cooldowns. Dask obeys only the D-059 `temporallyUnstable` flag
    (Loop 2+; not on Veridian Glowlands unless flagged).
13. **Keys:** in combat, panel hotkeys require Shift; Drop = Delete with confirm; WASD only on the map.
14. **Enemy AI:** DESIGN's ordered-pattern intents win over PLAN's weighted-random; boss phase triggers are an
    OR-list (HP%, round, event).
15. **Units:** PLAN §4.10 numbers are replaced by DESIGN's; ability points and mastery are stored in half-points;
    the clock is stored in ticks (watches). Clock effects are always expressed in watches.
16. **One canonical condition/effect set** (PLAN §5 revised to cover every shape DESIGN/STORY/WORLD use).
17. **Metrics:** Loop 1 completion = Escape rate; DESIGN §19 is the single balance-target table.
18. **E2E:** a dev-only `loadScenario(id)` jumps to named states (boss fight, loop reset, ending); recorded action
    traces are used only for the determinism test.
19. **Amulet** never resets (D-047 stands; DESIGN §10.3 is corrected).
20. **Echo catalog:** STORY §12 remains the catalog; REGISTRY's mapping (41 rows → existing STORY Echoes, 26 added
    to STORY §12, 14 removed) is adopted. Quests: 44 + 6 stretch (optional) + 5 class mini-quests (adopted).
21. **Regional bosses** sit 2 levels above their band's top (DESIGN wins over WORLD's +1; WORLD stats retuned in U9).
22. **Item tier T5** (band 16–18, proposed by WORLD §7) is adopted; DESIGN §7 gains the T5 row in U8.

### D-067 · Rulings adopted from U7 (REVIEW-STORY-WORLD), 2026-10-13
Details in `docs/reviews/REVIEW-STORY-WORLD.md`. These amend earlier decisions where they conflict.
1. **No Apex soft-lock:** Loop 1 Apex entry offers *Face it / Not yet*; no autosave at the Loop 1 Apex or during a Horde.
2. **Level carry-over (amends D-011):** each new loop starts at ⌊0.6 × best level reached⌋, capped at 10, with
   ability points for that level. Inventory, gold, quests, world still reset.
3. **Communion pressure:** `tyr_hour_presses` deals 8% max HP × (1 − Resolve/8); cannot kill while Resolve ≥ 3;
   *Offer* never consumes items. Attacking during communion forfeits the current question.
4. **Anchors** persist for the current loop only; only items tagged `anchorable` can be placed.
5. **Silverwood Before:** each return to the present costs 1 Breach-Clock day; its loot and XP are granted once per loop.
6. **Breach-anchor schematic:** each half grants its own persistent Echo; half B also obtainable at Vane's Watch;
   heartwood also from Stone-Hide Golems and Kaelen's stock.
7. **Ending D** requires Brak as the active companion; ending D never triggers Brak's Apex death.
8. **Ending B**'s present-side act is the Wayfinder placing the anchor at the Apex; Ilyra and Dask appear as scene variants.
9. **Caelum** joins inside Silverwood Before after his errand and crosses in Caelum's 2nd quest; his pin is set before he crosses.
10. **The Conflux** in Silverwood Before holds the whole Heartstone; STORY's Before places map to events on WORLD nodes.
11. **Lore — the thirtieth dawn:** each earlier Wayfinder's death in the shear re-steadied the drift; the Amulet prevents
    that reset, which is why the thirtieth dawn now arrives.
12. **Lore — the Tyrant's strikes** are the Holding's reflex; from Loop 2 Veyran restrains them against one who has crossed.
13. **Lore — Nyx** landed at Where She Fell and knows "thirty" from Ashcombe's notes.
14. **Ending a loop on purpose:** from Loop 2, *Let go* at any camp closes the loop as `closer_fall` (reason
    `released`); for ending E, *Keep the vigil* skips to the last dawn.
15. Quests started at the Threshold survive into the next loop.
16. `echo_tyrant_jailer` requires two of its five sources (prevents an early dump of the twist; Dask alone can't give it).
17. **Loop 1 scope:** only four non-legacy quests are open in Loop 1; the rest unlock in Loop 2+ (keeps Loop 1 near
    the original game's size, 60–90 min).
18. **Shadow Weaver viability:** Void treats *resist void* as neutral against Cursed targets; Unravel deals Chrono;
    Vell's Umbra resists Void rather than being immune.
19. **`itm_echo_bolt`** = max(0.75·ATK, 4 + 0.8·SP), 1-turn cooldown (supersedes D-066.2's numbers); the Drowned
    lose "weak ley".
20. **Regional boss HP** = 12 × expected physical damage per round at band top; D-066.21's +2 levels raise attack,
    accuracy, and XP, not HP.

### D-068 · Leftovers from U8, 2026-10-13
1. Steppe road: WORLD X3's conditional road is accepted; `echo_steppe_waystones` stays.
2. Dask leaves the party on non-flagged locations (e.g. Veridian Glowlands) and rejoins at the next flagged one.
3. Contained Tyrant Phase 3 "takes ×1.5 damage" is provisional until simulations.
4. Branch coverage is not gated (bun reports lines/functions only); line coverage thresholds stand.

### D-069 · Rulings on U9 leftovers, 2026-10-13
1. `echo_anchor_half_a` / `echo_anchor_half_b` (schematic halves, D-067.6) are canon Echo ids; STORY §12 is the
   catalog (103 Echoes). REGISTRY-DRAFT §6.2 is superseded by STORY §12 + BIBLE.md for names and Echoes; it remains
   a useful list for the other id tables until content files exist.
2. Gate-Captain **Bryn Dunn**, id `npc_bryn_dunn` (replaces `npc_hesper_dunn`). `ev_fell_names` is a WORLD event.
3. Masque's observatory work happens on the Library roof on First Bell and under the Hall dome on Last Bell;
   Aulde walks the Outer Walks on First Bell and the Plaza's east terrace on Second Bell (STORY/WORLD day-split).
4. Ilyra is recruitable from **Loop 2** (STORY wins; DESIGN §12.1 to be corrected). Any faction can reach Sworn in
   Loop 1 (DESIGN §11.3 line removed).
5. Dropped clock effects become `passWatches` effects: `q_preserve_or_heal` ±8 watches, Bell Vault −4 watches.
6. `flag_tyrant_dead` is set when either Tyrant dies in combat; cleared at loop reset.
7. The five class mini-quests are Loop 2+.
8. Communion *Listen*: no HP lash (REVIEW-STORY-WORLD #4's fix); the only communion damage is `tyr_hour_presses`.
9. Engine effect kinds added to the canonical set: `multiHit`, `stripBuffs`, `healOnDamage`, `surviveRounds`
   (survival-win fights such as the Unraveling Tide), `leaveCombat`, `passWatches`; edge kind `road` (conditional
   road, Steppe waystones). Boss stats: Vell's Umbra 480 HP stands until sims; Unraveling Tide is a survival fight
   (`surviveRounds`), not retuned by D-067.20.
10. Chosen-not-ruled items in WORLD §13.2 (Anso takes present gold; cross-band escorts; the Orrery Key opens the
    Nexus orrery housing with `echo_eye_of_masque` or the Lens; Skyreach rest under the Spire Loom; infected-Library
    legacy behaviour) are accepted as written.

### D-070 · Scaffold deviations (U10) and U9.5 interpretations, 2026-10-13
Accepted as implemented:
1. Coverage floors live in `tools/coverage-gate.ts` (global 80% lines / 75% functions plus per-directory bars), not
   `bunfig.toml` — bun 1.4.2 applies `coverageThreshold` per file. bunfig defines `__DEV__`, `__E2E__`, `__VERSION__`.
2. `validate`, `sim`, `sim:balance` are explicit STUB scripts until their units land; `build` = `validate` + esbuild.
3. Playwright serves `dist-e2e/` under `/Aethelgard/` so every e2e run proves relative asset URLs.
4. Lint: `content-literals` checks only top-level table ids; `src/main.tsx` is an `app` layer with `ui` imports;
   `import type` edges ignored for engine-cycle detection; lint covers `public/`, `.github/`, root configs; any
   trailing blank line is flagged; `@ts-nocheck` treated like `@ts-ignore`. `.gitattributes` forces LF.
5. U9.5 interpretations: `q_preserve_or_heal` "±8" = `passWatches` 8 (forward only); carry-over `bestLevel` = max of
   `classMastery[*].bestLevel` (min 1); *Not yet* at the Loop 1 Apex returns the player to the previous node.
   New actions `letGo`/`keepVigil`; `MoveSchema.effects` holds combat-scope effect kinds.

### D-071 · Engine-type details from U11/U12, 2026-10-13
1. `onFlee` (flee mode: `scatter|hold|previous`) and `onFleeEffects` (effect list) are separate fields in
   `CombatState` and the encounter schema (PLAN §4.2/§5.3 had a duplicate key; fixed).
2. `EndingPending.reason` and `RunRecord.reason` include `released` (D-067.14).
3. `GameStateSchema` lives in `src/engine/types/schema.ts` (saves import it from there); `RngState` in `types/state.ts`.
4. `GameEvent`'s discriminant is `t`. Helpers `ActionOf`/`EventOf`; `Rng.float(min,max)`; `util/math.ts` (`clamp`,
   `round`, `pct`). `stateHash` = FNV-1a over sorted-key JSON, excluding `recentLog`.
5. xoshiro128** reference: state [1,2,3,4] → first output 0x2D00 (11520). PLAN §4.1 corrected.
6. State fields stay plain `string` ids (typed aliases exist in `types/ids.ts`); content validation enforces id shapes.

### D-072 · Implementation details accepted from U13–U16, 2026-10-13
**Engine (U13/U14):** `step` rejects wrong-mode actions before dispatch via `ACTION_MODES`; `MODE_TRANSITIONS` adds
title→threshold, explore/threshold→title, dialogue→combat, dialogue→ending. `createStep(handlers, hooks)` and
`enumerateLegal(table, …)` exist for tests. `ctx.ts` declares a narrow structural `ContentPack` that U17 replaces with
a re-export of the real type. `newRun` takes an optional player name; attunements, loop-start Echo effects and gear
max-HP/MP arrive in U31/U32/U21. Conditions: `evaluate`/`explain` take optional `{questId}`; `killed.sinceStage` uses a
kill count snapshotted in `QuestState.counters['kills:<cr>']`; `quests_completed`/`factions_trusted` are computed live
and read-only. Effects: `apply` takes optional `{source}`; flags/counters emit no events; out-of-combat `damage`
floors at 1 HP; `passWatches` is a no-op while the clock is frozen; effects owned by later units reject with a message
naming the unit (`startCombat` U23, `startDialogue` U33, `unlockRecipe` U34, combat-scope kinds U26/U27).
Condition/effect validation uses a custom one-key union for readable errors; ranges require min ≤ max; `endLoop`
reason only with `closer_fall`.
**Schemas (U15):** `Encounter.optionalWhen`; item `stats.evasion`; `weaponType` required on weapons; per-type
defaults resolved by transform (stack 10 consumables / 5 tomes / 99 materials; quest items bound); records `.strict()`;
new `AffixSchema` (percent fields are fractions); roads use `dir: 'path'`; encounters field ≤ 3 enemies.
Lead fix: `ItemSchema.anchorable` (default false) per D-067.4.
**Schemas (U16):** creature `pattern` defaults `[]` and must be empty when phases exist; `CombatWhen` accepts world
Condition atoms; new atoms `targetIsBoss`, `targetHasActed`; `StatusApply.power` and `.when`; `Move.spell` (+10
accuracy); phases gain `damageDealtRampPerRound`, `skipWhen`, `adds[].reinforce`; ability `levelReq`/`costHalf`/
`cooldown` default from tier (companions: from kind), contradictions error; class resource event `basic_crit`;
companion `stats.evasion`, `statusImmunities`; stricter id prefixes. `SPECIALS` registry has 15 ids tagged by usage;
U26's engine copy must match. DESIGN §4.12's worked example follows the pattern notation (its prose turn numbers are
off by one); `tyr_chrono_strike`'s telegraph line is provisional (WORLD gives only the wind-up).

### D-073 · U17–U19 details; C1 contract freeze, 2026-10-13
**C1 reached (U19, bbbae0d).** From here, §4/§5 types and schemas change only through a DECISIONS entry plus the
owning unit (PLAN §9.1).
- **U17:** `ContentPack.factions` is `Partial<Record<…>>`; `recipesByStation` has the single key `emberforge`;
  `Merchant.repFaction` accepts `best` (Kaelen); `EndingSchema.reasons` adds `released`; typed-prefix ids in all new
  schemas (dialogue `speaker` stays plain); exhaustive config objects (`tierTexts`, `rarityStatMult`,
  `companionCooldownByKind`); `upgradeCostMult` keyed by target rarity; `fodderXp.eliteMult` 1.8, `anomalyMult` 1.3;
  per-record checks (stage/node refs, `merchantId === id`, `codexLine` ≤ 40 words). `GameConfigSchema`,
  `ContentIssue`/`ContentReport` live in `schema/contentPack.ts`.
- **U18:** the fixture pack is deliberately small (1 quest, 1 scene, 1 ending, 18 items); its boss is the Unveiled
  Tyrant cut to 3 phases with a communion subset (U29 appends Echo-gated answers and outcomes A/B); fixture
  `apexGate` = 1 quest; no forge station yet (U34 adds one).
- **U19:** `validateContent(pack, {strict, pending, registries})`. Non-strict (default; tests, fixture pack) skips
  completeness-count rules; strict runs them; the CLI runs strict and reports count failures as *pending* warnings while
  the real pack has zero locations, errors afterwards. Rules 4–5 (UI/audio registries) run only when registries are
  injected, as warnings. Config refs checked once the pack has locations. Closers exempt from the `{ending}` effect rule.
  Rule-21 expects **103** Echoes. Rule-13 also checks ability-tier prerequisites. `buildContentPack` validates by
  default (`validate: false` to skip).

### D-074 · U20/U21 details, 2026-10-13
- **Time pipeline:** time effects resolve in post-step hooks — arrival hook, then clock hook, then U21's
  `characterPostStep`. `ARRIVAL_HOOKS` (U23 encounters — no roll on `retreat`/`notYet`; U30 Horde spread),
  `DAWN_HOOKS` (U34 restock). `enterStartLocation` must be called by newGame/newLoop (U30/U31).
- **Apex prompt:** *Face it / Not yet* is engine-native (`scene_apex_prompt`, choices `face_it`/`not_yet`) through a
  minimal `choose` handler that U33 must preserve when it implements dialogue. `letGo`/`keepVigil` belong to U30
  (`skipToLastDawn` ready in `loop.ts`).
- **Expiry:** sets `flag_clock_expired`, starts the Horde (cause `expiry`, delay 3, portal opens), deferred until combat
  ends; spread/Ilyra/Echo grants are U30's.
- **Warnings** use whole days to the limit rounded up (fire on Days 20/25/28/29); only the most urgent crossed threshold
  fires per step.
- **Explore interpretations:** retreat costs the edge's watches; gather 1 unit/action up to `perDay`; `once:false`
  items respawn on rest; DoTs tick per watch and rest clears them; 40-slot pack excludes quest/key items; examining a
  location reveals hidden items; short rest is free; wild-camp ambush is U23's.
- **Character:** `characterPostStep` applies the Weaver mark when Corruption reaches 6 (Remnants −10, clock −4 watches)
  and keeps stored max HP/MP synced with `derive()` outside combat (current values shift by the same delta, ≥ 1 HP).
  Mastery is read-only during a loop; U30 writes this loop's unlocks and `bestLevel` at loop end. Respec at camp/wild
  rests, refunds exactly this loop's costs. %-reductions and %-HP self-costs round down (self-cost ≥ 1); slotless
  quest/key items apply their stats (Amulet +1 MAG, grants `itm_echo_bolt`). Helpers `resourceGain`, `abilityCost`,
  `playerAbilityCost` for U26. U20's `slotsUsed` and U21's pack counting overlap — consolidate in U22 or later.

### D-075 · U22/U23 details, 2026-10-13
- **Saves (U22):** `SaveFile` carries `savedAt` (string supplied by the UI; the engine never reads a clock).
  `deserialize` accepts object or text and returns `{state, migratedFrom, warnings, file}`; unknown items/abilities/
  quests drop with warnings, unknown class/location is fatal. `canAutosave(state)`: explore/threshold only, no open
  dialogue, no Horde, not at the Loop 1 Apex; the `settings.autosave` check is the store's. `save` emits
  `saveRequested`; `load` (title mode only) replaces the state and refuses combat/dialogue/ending saves. Storage keys
  follow DESIGN §14.1: `aethelgard.run.slot1|2|3|auto`, `aethelgard.profile`, `aethelgard.settings.mirror` (PLAN text
  corrected). Extras: profile file, two-phase write (.tmp/.bak), backup restore, export file names. The profile
  merge-on-import (DESIGN §14.3) is UI-side.
- **Combat core (U23):** hit roll = `int(0,99) < chance` (PLAN form); certain chances draw nothing (Mark skips the roll).
  `beginCombat` lives in `turnOrder.ts` (avoids a cycle with `effects.ts`) and ticks Poison/Bleed/Curse for watches
  travelled in the same step. Guard is a real action; class-resource events guard/turn_start/hit_taken/dodge/crit
  (taunt → U26). Rested is consumed when a fight starts. Shield pool read from `StatusInstance.tick` until U24 decides.
  Enemy/companion turns are placeholders (TODO U25/U28). Not done: wild-camp ambush (DESIGN unspecified — leave out
  unless a later review asks), anomaly spawns (needs a region link; U-content units), loot rarity/full pack/bestiary
  (U26/U27).
- **Follow-up (must not be lost):** a Loop 1 death outside a Horde leaves the state in combat mode, phase `defeat`, with
  **no legal actions** — there is no combat→title transition yet. The closer/game-over unit (U30) or the UI shell must
  add an explicit `acknowledgeDefeat` → title (Loop 1 classic FALLEN screen, D-049) so bots and players are never stuck.

### D-076 · U24 status details; worked-example correction, 2026-10-13
- **DESIGN §4.12 corrected:** the Shade's Mark (3 turns, applied round 2) expires at the end of its round-4 turn under
  §4.5 + D-066 #4, so round 5's crit deals **27**, not 31 (still lethal). The rules are canon; the example was wrong.
- Shield pool lives in `StatusInstance.tick` (no contract change). `beginCombat` and the clock hook share
  `tickCarriedWatch` (built on `dotDamage`), so out-of-combat ticks also apply gear resistance. Stun recovery window is
  stored as cooldown key `status_stun`. Taunt sits on the taunted creature (source = taunter). Refresh resets duration
  to the new application and keeps the stronger tick. DoT ticks bypass Shield and trigger no interplay; D-067.18
  applies to Curse ticks. Immolate deals 3 × tick × remaining turns at once. Interplay row 1 Shocks every other living
  combatant on the target's side. Phase beats Mark (consuming Phase removes the Mark). "Immune" is log-only (no event).
- API for later units: `applyStatusRows(…, evalWhen)`, `cleanse`, `blocksAction(…, 'flee')`, `tauntedBy`; Doom Sigil
  timer is TODO(U26) in `startTurn`.

### D-077 · U25 intent details, 2026-10-13
- **DESIGN §4.12 corrected again:** the next-intent previews after the Shade's round-4 turn and the Brute's round-5 turn
  follow the §4.2 pointer: Wail 5–6 and Strike 8–10 (were Rake and Maul). Neither is played; all fight numbers stand.
- **Generation timing (DESIGN §4.2, not "start of round"):** each enemy rolls an opening intent before turn 1, then its
  next intent immediately after its own turn (after its end-of-turn countdown). At the start of every player turn,
  intents are re-aimed (Taunt, or dead target → next valid pick) and re-projected; the move is never re-chosen. A hidden
  intent is revealed if its enemy acts before the player's next turn.
- No contract changes: area intents carry tag `ALL`; wind-up countdowns live in the creature cooldown table under
  `windup:<move>`; the pattern pointer is an instruction address in a compiled program; `turnsTaken` counts every
  combatant's turns. Summon (respects `max` and the 3-enemy cap) and revive are implemented; move `effects`,
  `special`, `riposte` → U26; `leaveCombat` → U27.

### D-078 · U26 details and follow-ups, 2026-10-13
- **Scripted abilities:** ten rows that fields + the 15 specials cannot express are scripted by id in `ABILITY_SCRIPTS`
  (Venom Coat, Doom Sigil, Smoke Bomb, Veilwalk, Iron Guard, Field Dressing, Steady Breath, Exsanguinate, Collapse,
  Unravel). **~25 rows are still unscripted** (listed in the header of `abilities.ts`: Hunter's Eye crit, Crescendo,
  Moment Between, Apex Predator, Unbroken, …) — they currently resolve only their data fields. **Follow-up unit U26b**
  (Opus) scripts every remaining row and adds a test that every ability in DESIGN §5 has either full data expression or
  a script; it must land before balance simulations.
- Fight timers live in cooldown tables under prefixed keys (`coat:`, `delay:`, `counter:`, `riposte:`,
  `guard_value:NN`, `foresight`); the UI shows only ability-id keys as cooldowns. Cooldowns set on the caster's own
  turn get +1 (a 1-turn cooldown blocks exactly the next turn). Throwables work via `grantAbility` on consumables
  (damage attributed to the `itm_` ability id). Drain shares (50%, Feast 60%) and Blood Pact 30% are engine constants.
- Flee: a fleeable `hold` encounter records HP and moves to the previous node (no re-roll there); `hold` only appears on
  unfleeable fights in DESIGN, so this path is defensive. The bound mage rolls at first cast. Counters/ripostes trigger
  on any connecting rolled Physical single-target hit (no melee/ranged distinction in data).
- **Warden Guard:** DESIGN wins over PLAN §8.1 — plain Guard is 50% (+8 Grit); 65% only with Iron Guard.
- **Companion commands `focus`/`hold`:** DESIGN never defines them; U28 either defines them (record a DECISIONS entry)
  or removes them from `Action` via a C1 change note. Only the signature command exists today.
- Crushing Blow's −5 accuracy is not expressible (no ability accuracy field) — U26b scripts it.
- §4.12 worked example now reproduces exactly through the reducer (all six rounds).

### D-079 · U27 details, 2026-10-14
- Kill XP = the creature's authored `xp` × the loop nudge; WORLD's numbers already include elite ×1.8 / anomaly ×1.3, so
  the engine does not multiply again (`expectedKillXp` keeps the formula for content checks).
- Phase triggers: `round: n` means the phase begins with round n; one event satisfying several later phases enters each
  in order; a phase whose trigger never held is passed over for good (phases never go backwards). Example: a Contained
  Tyrant still in Phase 1 at round 12 skips Phase 2's adds. Ramp counts rounds spent in the phase.
- Survival fights read their goal from content plus a `phase:<i>` marker in `pattern.firedOnce` (no C1 change).
- Bestiary: kills written at the kill, `seen` at fight end, intents recorded each player turn; the first kill reveals
  resistances for the whole family. `att_echo_sense` → U31. `recordSpared` (communion, U29) emits no bestiary event
  (no `spared` field in the event).
- Overflow loot lies on the ground (dawn expiry not yet implemented). `giveItem` does not roll rarity yet (U34 reuses
  `rollRarity`/`rollAffixes`).
- **Combat leftovers folded into U26b:** `affix_of_echoes` (+10% kill XP); a data shape for phase `onEnter` area damage
  (DESIGN §4.10 mentions an "AoE" with no schema form — add a combat-scope effect or a phase field via a C1 note);
  ground-loot dawn expiry.

### D-080 · U26b/U28 details, 2026-10-14
- **Companion orders (resolves D-078):** `focus` and `hold` are free orders, one per player turn. `focus` sets the
  companion's single target while that enemy stands (no target clears it); `hold` = the companion skips its next
  action and Guards. Stance change is free once per turn in a fight, any time outside one.
- **KO:** a knocked-out companion returns only at a **full** rest, at 50% (DESIGN §12.6 wins over "any rest"); KO costs
  −2 loyalty. Trusted loyalty gives +10% damage/healing; loyalty ≥ 50 cuts the signature cooldown by 1. Companion max
  HP grows with level. The signature's self-cost is paid (Nyx 10%).
- **Dask** flickering out empties the active slot; he rejoins automatically on flagged/infected nodes (D-068.2 over
  DESIGN §12.8's "offers"). `swapCompanion` works at a rest spot or where the companion waits.
- **Targeting:** §4.9 wins over §12.4 — Ilyra's Ward and Caelum's Foresight shield the player. `buff`/`utility`
  abilities are used only in Support stance. The content `stances` schema (threshold/weights) is unused; §4.9's
  numbers are engine constants (Guard threshold 35%). Brak's Hold the Line follows §4.7 (Guard ends when his own turn
  starts) — flag for the balance pass: it currently does almost nothing.
- **Abilities (U26b):** every DESIGN §5 row is data or scripted (`ABILITY_SCRIPTS`, mirrored by `SCRIPTED_ABILITIES` in
  `schema/ability.ts` — a C1 addition); a completeness test casts all 75 through `step()`. New combat-scope effect
  `areaMove: <boss move id>` (C1 addition), allowed only in a phase `onEnter`, lands at the start of the next turn.
  Buffs are timers in the holder's cooldown table (`buff:`/`bonus:` keys; never persisted to run state). Moment Between
  inserts a second player slot; Crescendo counts distinct Bladesong abilities used (incl. itself); Oathbound blocks new
  debuffs only; Last Bastion reflects Shield-absorbed damage, revives a downed ally at 40% or heals a standing one 30%;
  `wvr_unravel` is Void (DESIGN). `affix_of_echoes` = unique trinket passive `kill_xp` +10%. Ground loot (drops and
  overflow spoils) expires at the next dawn; a location's authored items stay.
- **Lead fixes:** `DRAIN_SHARES.comp_nyx_drink = 0.6`; stale focus/hold text in `abilities.ts`.
- **Open for later units:** Lanternreed Salts need a `revive` effect (out-of-combat item effect calling
  `reviveCompanion`) — add in the items/crafting unit (U34) with a C1 note.

### D-081 · U29 communion details, 2026-10-14
- Communion can open only on the player's first turn of the fight, or the first player turn after the Tyrant enters a
  Movement phase. While communing, companions Guard (Dask/Caelum in Support add +1 Resolve on their turn); adds still act.
- Any player action that hits or debuffs an enemy forfeits the current question; a forfeit can end Movement III, and at
  Resolve ≥ 3 the Tyrant is still spared.
- After Movement III at Resolve ≥ 3 the Tyrant is spared and the turn holds for a **Resolution**: the only legal action
  is Speak with an eligible outcome `choiceId`; its effects (incl. `ending`) apply while communion is active so
  `{resolve}` conditions hold; the fight then closes as a victory with no spoils and no `onVictory`; encounter cleared.
  (DESIGN says combat ends before the Resolution; this ordering is required for `{resolve}` and is canon.)
- "Leave" after rejection = `flee` with no roll → `closer_fall` (reason `rejected`) + `echo_tyrant_rejected`.
- Every Listen grants `echo_tyrant_speaks`; Korr's −1 applies when the next question appears. Movement end fires the
  `communionMovementEnd` phase trigger; entering a phase with no Movement (Phase 4) closes communion.
- **Listen's cost:** per D-069.8/STORY §8.3 the next press is not reduced by Resolve (no separate lash). WORLD §6.8/§13.2's
  `tyr_time_lash` after Listen is **superseded** — the content unit for the Tyrant must not transcribe it.
- Resist "acts as Guard", but the press ignores Guard (resistance step only) — Resist matters only against adds; flag for
  the balance pass.
- C1 addition: `CommunionSpec.movements[].listen?: { effects }` (codex fragments a Listen unlocks).
- Not done: `ach_commune` (achievement engine is a later unit); STORY's "Mireya present: automatic" is expressed by
  gating an answer on her in content. Question ids are recorded in the Tyrant's bestiary `intentsSeen` (harmless).

### D-082 · U30 details and rulings, 2026-10-14
- **Defeat acknowledgement:** a Loop 1 death outside a Horde shows the FALLEN screen; the only legal action is
  `returnToTitle` (legal in combat mode only while the fight is in phase `defeat`) — resolves the D-075 follow-up.
- Loop-end bookkeeping runs in a post-step `loopEndHook` (avoids an effects↔loop import cycle; catches same-step Echoes).
  The reset happens on the last `acknowledgeEnding`; for Loop 2+ the state is already the next loop in threshold mode
  with `pendingEnding` kept (DESIGN's `threshold.pending`). U31's `newLoop` uses `nextLoopState` + `beginLoop`.
- Horde edge delays (Mistwood→Plaza 2, Outpost→Emberforge 1) are engine constants (no exit field). Brak dies when the
  Tyrant falls per WORLD `ws_brak_at_apex`, skipped if `echo_brak_lives` was earned this loop; the watchable stand and
  Ilyra's portal scene are dialogue (U33) — log lines for now. Infected-node damage lands after travel regen.
- **Resonance:** Echoes pay nothing (DESIGN §10.6); `EchoSchema.resonance` default changed 5 → **0** (C1 tweak).
  *Let go* (`released`) pays no +10 (STORY §10.7). Modifier Resonance multipliers and a Threshold-entry autosave are not
  implemented (no schema field / no autosave reason) — revisit in U31 if DESIGN requires them.
- **Expiry-Horde death reason = `expiry`** (DESIGN §10.2, PLAN §4.11, STORY §4.3 over DESIGN §4.7 / WORLD R10-3).
- ***Keep the vigil*** is offered at any camp or wild rest from Loop 2 (no Horde), per DESIGN §10.2 / D-067.14;
  STORY/WORLD's "Ilyra offers it at the Heartstone Depths" becomes flavor: content may add her line there, the mechanic is
  the camp action.
- **Engine-granted Echoes:** `ENGINE_GRANTED_ECHOES` in `schema/echo.ts` lists the Echoes the engine grants itself
  (`echo_amulet_memory`, `echo_brak_death`, `echo_brak_lives`, `echo_horde_path`, `echo_korr_marginalia`,
  `echo_thirtieth_dawn`, `echo_tyrant_rejected`, `echo_tyrant_speaks`, `echo_ending_a`–`f`); validator rule 16 treats
  them as granted; a test keeps the list in sync with literals in `src/engine`.

### D-083 · U31/U32 details, 2026-10-14
**Threshold (U31):**
- C1 additions: `AttunementSchema` gains `mp_max_pct` and `custom {scriptId, params}` (PLAN §5.13's kinds could not express
  10 of DESIGN §10.7's 15 rows); optional `PlayerState.attunements` (active set fixed at loop start; empty under Iron Loop);
  optional `RunCounters.resonance`; AutosaveReason `thresholdEntered` (fires only when arriving from ending screens).
- Loom actions only at the Loom; class change and `newLoop` only at the Far Light (DESIGN over PLAN §6.3). Refunds only for
  attunements bought this visit. Modifier Resonance multipliers are engine constants paid at loop end (reason `modifiers`).
- **New Game+:** a fresh profile keeping Echoes, codex (+ paid discovery keys), achievements, settings, modifier toggles and
  the loop counter, `newGamePlus` +1; resets Resonance, Attunements, mastery, bestiary, map memory, run history, endings.
  Offered at the Loom and on true-ending screens (resolves PLAN §4.4 vs DESIGN §10.8). `ach_ng_plus` → achievement unit.
- Pacifist's Vow doubles all non-kill XP (the `xp` effect cannot tell quest from discovery XP — equivalent in practice).
  Glass doubles DoT ticks too. D-067.2 carry-over wins over DESIGN §10.9's "1 AP, 30 gold".
- **Attunements/modifiers flagged, not yet wired:** Foresight (intent projection) and Horde Rising (elite variants) →
  balance/combat polish unit; Companion's Trust / `loyalty_start` → U33 (recruitment); Borin's Favor, Kaelen's Ledger,
  `shop_discount` → U34. `rest_heal_pct`, `flee_pct` have no DESIGN row (unused).
**Silverwood Before and Echoes (U32):**
- DESIGN §10.4's per-Echo `effects` model is not in `EchoSchema`: rep starts (20) and bond loyalty (25) are engine tables
  copied from §10.5; shortcuts use `QuestSchema.shortcuts` (quest opens at `skipTo`); routes/dialogue unlocks/ending flags
  stay content `{echo}` conditions. Mute Ley disables rep starts and shortcuts only (bond starts stay).
- `grantEcho` refuses an Echo whose `exclusiveWith` partner was granted this loop, and applies `onGrant`. At loop end the
  engine grants bond Echoes (loyalty ≥ 50) and Ironclad/Weaver oaths (Trusted+), `echo_before_route` on entry,
  `echo_anchor_mechanic` when an Anchor is found in the Depths (all on `ENGINE_GRANTED_ECHOES`).
- Before rules: Before-local flags are `flag_before_*` plus `flag_wanted_in_silverwood` (content naming rule); every entry
  is a fresh echo; `before_resets` counts per loop; any full rest inside advances its day; with `q_stop_the_ritual`
  resolved Last Bell holds; each Before fight pays once per loop; gathering counts carry between visits. The engine sets
  the door flags on entry (WORLD's gates cannot set flags). Anchors are placed with `drop` in the Conflux (quest items
  allowed), appear in the Depths at once, last the loop.
- **Contradiction resolved:** WORLD §3.11/§12.1 `ev_conflux_sundering` (sent home at Last Bell's dusk) is superseded by
  DESIGN §10.1/STORY §9.1 (the echo resets to First Bell in place). `q_echo_crystal`'s shortcut stage is whatever content's
  `shortcuts.skipTo` names. Before merchants restock per Before day → U34 (hook `beforeDayAdvanced`).

### D-084 · U33/U34 details, 2026-10-14
**Quests and dialogue (U33):**
- Quest stage transitions and the scene open/node/close cycle live in `effects.ts` (the `startDialogue`/`questAdvance`
  effects need them inside a step; lint forbids import cycles); the reducers handle sweep, talk, choose, continue,
  accept, camp scenes, interact. The quest sweep is the first post-step hook; flags set by later hooks are swept next step.
- Rules: objectives stay done once met for the current stage; a stage with no `advanceWhen` and no required objective
  moves only by a holding branch or `questAdvance` (a plain `next` waits — schema/PLAN §5.9 over DESIGN §13.1's
  "next defaults to the following stage"); a quest found active on an ending stage ends at the sweep; once-per-profile
  quests count done via `discoveries` `quest:<id>` or a past run.
- Companion reactions: first match for the standing companion, shown at scene end as a dialogue log line. Choice-less
  nodes voiced by an absent companion are skipped. `flag_scene_done_<scene>` blocks only non-repeatable scenes. A camp
  scene opens automatically after a full rest (+2 loyalty).
- **Content rule:** every scene's entry rule list must end with an unconditional rule (`{all: []}`) — validator rule 10
  only treats rule nodes as reachable.
- Companion's Trust: loyalty gains ×1.25 (round half up); `loyalty_start` added at recruitment; bond-Echo starts add on top.
- **Follow-up:** `talk` is explore-only in `ACTION_MODES`; Dask's conversations at the Threshold (D-012) need `talk`
  allowed in threshold mode — do it in the Threshold content/UI unit.
**Economy and crafting (U34):**
- C1 additions: `revive: Pct` effect (D-080); `upgrade.affixId?` (player picks one of three offered affixes when a
  tier-up opens a slot, DESIGN §8.3).
- Stock draws use a separate stream per merchant and day (restocks never move the run Rng). A merchant is stocked on the
  player's (or its NPC's) arrival; stock gates read at restock, prices/refusal live. Wary hides the theme pool; Kaelen at
  all-Hostile prices as Wary. Known recipes live in `player.uses['recipe:<id>']`. An upgrade costs 1 watch when it is the
  visit's first forge job. Kaelen's Echo discount is an engine table. Before merchants restock on each Before day.
- **Content-schema gaps (decide in the first content unit that needs them):** merchants have no "buys category" field
  (every stall buys anything sellable); stock affix bias and "fixed Rare (affix_x)" gear lines aren't expressible;
  salvage names an affix material only for "of the Void"; "Trusted or `echo_borin_oath`" is written as a `requires`
  condition (fine).

### D-085 · U35/U40 details; C2 engine milestone; Unravel and Echo Bolt fixed, 2026-10-15
- **C2 reached (U35, 8c760c8):** across 623 seeded states from all 8 fixture packs (Loop 1 and 2+), every listed action is
  accepted and ≥ 200 unlisted ones per state are rejected with the same refs. Fixed: Object.prototype names as ids made
  `step` throw (now rejected before any handler); unknown rest kinds / companion commands / commune params / item targets
  were silently accepted. `load` is never listed (the shell supplies the file). Equivalent forms list one representative
  (`newGame` name/seed, `drop`/`sell` per item, `buy` quantity, `equip` slot, untargeted abilities/items/signature);
  `isLegal` uses the handler check for those. No state has an empty legal list (title → `newGame`; FALLEN → `returnToTitle`).
- **UI note:** the engine does not track "last enemy targeted" (DESIGN §4.8 default); the UI must send targets explicitly.
- **Validator:** rule 6 now also rejects nested ids (`id`/`choiceId`/`answerId`) that name Object.prototype members.
- **Unravel deals Chrono** — D-067.18 stands (it gives the Shadow Weaver an answer to Void-resistant regions). D-080's
  "Void (DESIGN)" reverted it by mistake; DESIGN §5 and the test fixture are corrected.
- **`itm_echo_bolt`** = max(0.75·ATK, 4 + 0.8·SP), 1-turn cooldown (D-067.19); DESIGN §5.7's row was stale and is corrected.
- **Content (U40):** pattern for later content units: `description` = play text, `flavor` = DESIGN's line verbatim, `tags`
  = DESIGN's role notes; Guard +5 resource rule on every class (Warden +8). Files live under `src/content/shared/` and
  `src/content/abilities/` (brief paths, not PLAN §2). Field Dressing's out-of-combat heal is a flat 26 (no stat-scaled heal
  effect), Rewind stays combat-only. `uniqueQuestId` unset until `q_class_*` exist. The Dark Spellbook record is minimal
  (its 3-reads → `echo_litany_verse_2` rule comes with the items unit). Primitive Bow = 15 gold (DESIGN §7.7).
- **Engine gap — affixes/passives in combat (must land before balance sims):** the affix scripts `basic_attack_rider`
  (Embers), `damage_vs_status` (Iron), `reflect_melee` (Thorns) are not implemented, and the passives `statusOnHit`,
  `regen`, `lifeSteal`, `curse` are computed by `derive()` but never used in combat (only `kill_xp` works). Queued as
  **U34b** (Opus).

### D-086 · U36/U37 details — scenarios, sim runner, first bots, 2026-10-15
- **Scenarios (U36, 9f79ad7):** 13 builders (PLAN §4.13 plus `first_fight`); `ScenarioOptions` = `{seed, companionId}`.
  `src/sim` has its own `newProfile(seed)` with `profileId` = the seed, so Loop 2+ run seeds are deterministic. A pack that
  can't express a scenario throws `ScenarioUnavailable`; a lost scripted fight retries with a derived seed
  (`ScenarioDefeat`). The builders sit behind `if (__DEV__ || __E2E__)` and are stripped from production (~320 kB minified
  when present, well inside the budget). What each scenario constructs rather than plays is listed in
  `SCENARIOS[id].constructed`.
- **Runner (U37, e1083e8):** `runLoop(cfg, content)` follows PLAN §7.3's signature. `RunResult` adds `stopReason`, `fallen`
  and `final`, plus `rule`/`detail` on soft-locks. `RunConfig` adds `onFallen`, `maxFallen` (25), `validateEvery` (50) and
  `softLock`. The runner plays the shell: on the Loop 1 FALLEN screen it returns to the title and reloads the last autosave
  (D-049); scenario runs stop at FALLEN instead. An empty legal list counts as both an invariant error (§7.3) and a
  soft-lock (§7.6).
- **Bots:** `Bot` adds an optional `stallSteps`. `random` keeps PLAN's weights and also damps menu toggles and loop-enders
  (the list is in `random.ts`). Where PLAN §7.2 is silent, `melee`:
  - routes only to places whose level band starts at most 2 above its own;
  - remembers where it died across reloads;
  - takes the Apex when its level ≥ the fight's level − 3, otherwise rests until the clock runs out;
  - tries Field Dressing before Guard.
  The flee check now comes before Guard, because PLAN's order made fleeing impossible.
- **Lint:** the determinism rule (no `Math.random`, `Date.now`, timers or DOM) now covers `src/sim/bots/**` as PLAN §7.1
  asks. The runner and CLI may time themselves.
- **Balance target #9** (DESIGN §19, "random ≥ 3 deaths") is a Loop 1 measure: reloads make several deaths possible there.
  In Loop 2+ the first death ends the loop. No change.
- **Speed:** a step takes 0.65–0.9 ms under `__DEV__` (deep-freeze) against PLAN's 150–300 µs. U39's batch runner must
  run with `__DEV__` off.
- **Fixture findings (for balance, not bugs):**
  - `melee` closes Loop 1 in 840/840 runs, almost always by waiting out the clock and taking the portal.
  - In the fixtures it never levels enough to face the Tyrant, and from `pre_tyrant_l11`/`l13` it loses to the fixture
    Tyrant.
  - The Shadow Weaver falls to the expiry Horde in 4 of the packs.
  - Real-pack numbers come once locations exist (`--pack real`).

### D-087 · U34b/U38 details — gear in combat, Horde Rising, the policy bots and pathBot, 2026-10-15
- **Gear in combat (U34b, e903c9d):** `combat/gear.ts`.
  - An **on-hit** is the player's landed basic attack or damaging ability. Each target counts once per cast. DoTs,
    counters, reflects, auras, companions and items are not on-hits.
  - `statusOnHit` and `curse` work. The dagger's self-cost is a log line and never takes HP below 1.
  - `lifeSteal` takes a floor of `pct` × the HP the hit removed. It is halved by Curse, like every heal, and never
    overheals.
  - Gear `regen` happens at the player's turn start, before mana regen. HP regen is halved while Poisoned.
  - `basic_attack_rider` takes `pct` of the main hit's HP and Shield damage. It counts the resistance step and is not an
    on-hit.
  - `damage_vs_status` applies at pipeline step 7 to player direct hits. Thrown items are excluded.
  - `reflect_melee` works on a rolled, single-target Physical enemy blow that took HP, and the attacker's resistance
    applies.
  - Damage events carry kind `item` and refId `gear:<itemId>`/`affix:<affixId>`, which is also the `damageBySource` key.
    **C1 addition:** an optional `statusApplied.source`.
- **Foresight** keeps next-next intents visible all fight (Hunter's Eye's key).
- **Horde Rising:**
  - Arrival fights that can be fled gain +1 enemy from the region pool (max 3, bosses excluded).
  - Each **fodder** slot has a 30% chance to become an elite: +40% HP, +20% ATK, "Elite …", ×1.8 kill XP. Anomalies,
    elites, bosses and an `elite` record's own groups never do. This follows DESIGN §15.1 "30% of fodder"; the lead
    narrowed U34b's "non-boss, non-elite".
  - Untouched: bosses, story gates (`fleeable: false`), and fights that story effects set up (`spawn`, `startCombat`).
  - Draws use the fight's own stream, seeded from seed, loop, node, encounter and fight count. The extra enemy rolls its
    initiative on the run Rng.
  - Still open: anomaly spawns (DESIGN §6.6) need a region link in the schema (TODO in `reducers/combat.ts`).
- **Policy bots and pathBot (U38, d67199f):**
  - `bots/policy.ts` is the shared kit: melee's rows with each bot's knobs, communion, the Apex plan, and notes on deaths
    and bounces.
  - `Bot.halt?` and `Bot.examines?` were added. `RunResult` gains `stopReason` values `script_done`/`script_assert` and
    a `stopMessage`.
  - No bot draws randomness, so `botRng` is unused.
  - Readings where PLAN §7.2 is silent:
    - speedrunner and pacifist put points into AGI;
    - pacifist prefers ranger/ironclad_warden;
    - explorer caps corruption at 4, flees encounters ≥ level + 4 and visits until Day 26;
    - caster aims for endings in the order C, B, A, F, E, D.
  - A communion question with no eligible answer can only be forfeited by a hit (DESIGN §4.11). The pacifist strikes that
    one forfeit blow. It counts as "forced" and is not a kill.
  - Ending proofs: `tests/fixtures/scripts/endings.ts` holds 9 scripts (escape, fall by expiry/death/release, Unbound,
    Warden's Vigil, Mending) and passes on all 9 fixture packs. `npm run sim:endings` and `endings.reachable.test.ts` come
    with the endings content.
- **Fixture results:**
  - Loop 1: 720/720 closers across 4 bots × 9 packs × 20 seeds, 0 errors, 0 soft-locks.
  - The pacifist escapes only 13/20 times in `economy`: a Mistwood path with return chance 1 walls it in.
  - Loop 2+ communion reaches `ending_unbound` for pacifist 180/180, speedrunner 178/180 and caster 170/180.

### D-088 · Companion records wait for their references, 2026-10-15
- A companion record names its NPC, arc quests and camp scenes, and every `comp_` ability needs its companion record
  (validator rule 1). None of these NPCs, quests or scenes exist yet, so registering the companions would break the real
  pack.
- U41 authors all six records and their 24 abilities in full, with real ids. They are exported but **not** in
  `contentTables`, and are proven by a test that validates them against stub records created only inside the test.
- **The unit that lands the last reference registers them (planned: U56, the last companion-arc unit).** Each region unit
  that authors a companion's NPC must use the id U41 used.
- Until then, real-pack sims run without companions.

### D-089 · U41/U39 details; companion signature gaps queued (U34c); balance flags, 2026-10-15
- **Content (U41, 5c87139):** 45 class rows (every class now has 15), `itm_echo_bolt` and `item_amulet_of_echoes` are
  registered; 113 pending checks remain, and rule 13 is cleared.
- **Companions (U41):** the six records and their 24 abilities are authored but not registered (D-088). They reference 42
  outside ids:
  - NPCs `npc_<name>`, each with `companionId` set back;
  - three arc quests each, per STORY §11.4;
  - camp scenes `scene_<name>_camp_1..3`, coined here because STORY names none, so U54–U56 may rename them.
  Brak is `permadeath_scripted` (§12.6). Dask's restriction uses `requiresTemporallyUnstable` plus `constraintText`.
- **Values DESIGN leaves open:** Silverwood Bloom's Regen is `6 + 0.3·SP`, and Last Bastion's Shield lasts 2 turns (the
  fixture's numbers). Out of combat, Ley Mend and Steady Breath heal a flat 22 and 20 (U40's convention).
- **Amulet handover:** the Amulet has no `sources` yet. U42 adds `loc:loc_whispering_ruins` when the location exists.
- **Engine gap → U34c (Opus, small):**
  - DESIGN §12.4 Mireya's *Lanternreed Bloom* "party heal 30% max HP" can't be expressed: `heal` is base + coef·stat.
  - Ilyra's *Archive Light* "all hidden intents revealed for 2 turns" has nothing to reveal hidden intents.
  - Script both by ability id, like ABILITY_SCRIPTS (no C1 change), and pin them in tests. The data rows describe the rest.
- **Batch (U39, 549dfe8):**
  - The `sim:balance` and `sim:batch` scripts run bun with `--define __DEV__=false --define __E2E__=true`. E2E stays on
    for `loadScenario`.
  - Speed: the median `step` takes 108 µs with DEV off and 213 µs with it on. The whole bot loop takes about 380 µs/step
    with DEV off, so D-086's 0.65–0.9 ms was the whole loop with DEV on.
  - Results with 1 worker and with N workers are identical, and the determinism sample is clean.
  - A scenario that can't be built, or whose builder fight is lost on every retry, is "skipped" and named in
    Recommendations.
  - Row 18 (roll-replay harness) stays n/a until that harness exists, so gate G5 can't pass before then.
  - No BALANCE.md is committed: the lead generates it once real regions exist.
  - This box has 2 CPUs, so pass `--workers 2`.
- **Balance flag (fixtures):** every one of the 42 fixture blockers is a combat stall (> 60 rounds) at a Tyrant:
  - Shadow Weaver caster and elf/warden pacifist runs on `economy`;
  - melee/caster Ironclad Warden runs in the pre-Tyrant scenarios.
  Watch Warden and Weaver damage against bosses when the real Tyrants land (U45; DESIGN §19 #19 wants 12–18 rounds).

### D-090 · Forward references while the world is authored; region-unit ownership, 2026-10-16
- **Forward references.** Region files name creatures, items, quests, scenes, Echoes and NPCs that later units author.
  - `src/content/progress.ts` lists `INCOMPLETE_TABLES`, the tables still being authored. Today that is every table except
    classes, statuses, affixes and abilities.
  - In the real pack (`buildContentPack()` with no arguments, or `npm run validate`), a reference into one of those tables
    that does not resolve is a **pending** warning, "content not yet authored (reference)". A reference into any other
    table must resolve. Test and fixture packs stay fully resolved (`BuildOptions.incompleteTables`, default none).
  - The validate CLI stays in pending mode while the list is non-empty. This replaces "the pack has no locations".
  - The unit that completes a table removes it from the list in the same commit. Whatever still dangles then surfaces as
    errors, and that unit fixes it together with the lead.
  - Authors use the **final ids exactly as WORLD, STORY and BIBLE spell them** and never coin an id the documents lack;
    any that is needed is listed in the reply. Typos into incomplete tables surface when the table completes.
- **Who authors what:**
  - A region unit authors its region record, locations (with their encounters and events), the NPCs whose home location
    is in the region, and the creatures whose **first** region in WORLD §6's Regions column is its region.
  - Item placements are references. Item records belong to U49/U50, except the Amulet, which already exists.
  - Quests, dialogue scenes, Echoes and codex entries are referenced by id and authored by their own units.
  - Companion NPCs use `npc_<name>` with `companionId` set. That reference stays pending until U56 registers the
    companions (D-088).
- **Sims on the real pack** are only meaningful for scenario and combat runs until items, quests and Echoes exist (U49–U52).
  An engine error caused by a dangling reference before then is expected and is not an engine bug.

### D-091 · U34c/U42 details; the region pattern; expressiveness gaps queued (U34d), 2026-10-16
- **U34c (0d30d4c):**
  - Lanternreed Bloom's heal and Archive Light's reveal are scripted by ability id in `COMPANION_SCRIPTS`, separate from
    ABILITY_SCRIPTS, so there is no content mirror and no C1 change.
  - The Bloom heal applies healing modifiers (Trusted +10%; Curse halves it, since the heal lands before the cleanse).
  - Archive Light holds `REVEAL_KEY` for 2 player turns.
  - `talk` is legal in threshold mode. `THRESHOLD_LOCATIONS` uses WORLD §3.12's ids. Resonance gained in a Threshold talk
    doesn't count toward the next loop's tally.
  - Balance note: a hidden intent is already revealed just before its creature acts (DESIGN §4.2). So Archive Light
    matters only when Slow or Haste reorders turns, or for companion AI decisions. Review it in the fun rounds.
- **U42, Silverwood Ruins (fd079c0) — the region pattern:**
  - One folder per region (`region`, `locations`, `creatures`, `npcs`, `items`, `index`). A region unit adds one import
    line and one `REGION_FOLDERS` entry in `src/content/regions/index.ts`; `contentTables` spreads the barrel.
  - The conventions are in `silverwood_ruins/index.ts`'s header. Encounter ids are `enc_<place>_<group>`, event ids take
    `ev_` (the schema wins over WORLD's "verbatim legacy ids"), and boss phases are `<creature>_<phase>`.
  - Test readers for WORLD live in `tests/unit/content/regions/worldDoc.ts`. `legacy.test.ts` keeps a `LANDED` list that
    each region appends to.
  - The lead checked the words U42 wrote for tone: 9 encounter intros, the Library nook rest text and a few
    descriptions. They are listed in the commit.
- **Rulings on U42's readings:**
  - The Whispering Ruins are `safe: false` (WORLD's 20% return pool beats PLAN §5.17).
  - The Library portal is the engine's `enterPortal`, not an exit.
  - The palette follows DESIGN §17.1 (D-062).
  - "Ilyra Trusted" means loyalty ≥ 75 (§12.5).
  - `ev_ruins_thirtieth` fires on entering at the last dusk (`daysLeft ≤ 0`, so it scales with Frayed Clock).
  - WORLD §6.8's one `tide_crest` id becomes two moves (`tide_crest` and a coined `tide_fall`).
  - The Scholar's Lost Scroll is gated loot on the Drowned Archivist.
- **Lead fixes (8e95f0b):**
  - The engine counts **`horde_moves`** (`HORDE_MOVES_COUNTER`), so the Corridor Tide can block after move 14.
  - **`ENGINE_WRITTEN_FLAGS`** (`schema/flags.ts`, kept in sync with `FLAG_*` constants by a test) stops rule 2 from
    warning about flags the engine sets.
  - shared2's real-pack pins now follow D-090.
- **Owner:** `cr_horde_husk` has no first region in WORLD §6 ("Horde, any infected node"), so **U45** authors it: the
  Nexus waves in `q_weavers_dawn`.
- **Known rule-11 warnings:** two placements are out of band on purpose: the Loop 4+ Redundant Wayfinder (L12) at the
  Ruins, and the L14 Horde Tide in the band-2–3 Corridor.
- **Expressiveness gaps → U34d (Opus, after U43–U48 surface their own):**
  1. Location items have no `chance`: the wax seal (30%) and bell shard (10%) are placed at 100%, hidden.
  2. Location items spawn only at a loop's first entry, so the Corridor's Horde tonic appears only when that first entry
     happens during a Horde.
  3. The Redundant Wayfinder can't mirror the class's damage type and resistance, and "the player died here in a
     previous loop" can't be expressed. The Paradox Wisp can't copy "your last spell's type". Both want a `special`.
  4. Anomaly spawns and variants (DESIGN §6.6, WORLD §10.2) — the D-087 TODO.
  5. The `drowned` tag is never read.
  6. Rule 11 should ignore Horde-gated and anomaly placements.
  7. `pathBot`'s `talk` works only in explore mode.
  8. Foresight's next-next chip ignores hidden flags.

### D-092 · U43/U45 details; first Tyrant numbers; worktree method, 2026-10-17
- **U43, Mistwood & the Ironclad Reach (23a869b):** 6 locations, 5 creatures and 3 NPCs (`npc_brak` has
  `companionId`). All 13 landed locations are reachable from the start.
  - Readings: a WORLD "30%" second spawn is a second roll; story gates are a holding gate, then the plain legacy group,
    and the gate's win scatters the plain group. The Camp counts as "infected" from `horde_moves` ≥ 8, or ≥ 10 after
    expiry.
  - The Brute's Maul follows DESIGN §4.12's pattern, not WORLD's `everyNthTurn: 3`. Where a worked example and WORLD
    disagree, DESIGN wins.
- **U45, Glowlands & Nexus (98ac100):** 3 locations and 11 creatures: both Tyrants with the full §4.11 communion,
  `cr_tyrants_reach` and `cr_horde_husk`. The Tyrant's Reach lives here even though WORLD lists the Highlands first, so
  U44 must not duplicate it.
  - XP comes from DESIGN's formula, so the Orrery Knight has 589 (WORLD says 588).
  - Listen's "full-strength Time Lash" is superseded by D-069.8/D-081 and not transcribed.
  - WORLD lists the Glow Gland twice; the item unit checks it.
  - Coined: outcome ids `pass_into_before`, `pass_beyond`, `take_its_place`, `consent_mending`.
- **Validator (U45):** in rule 8, while `locations` is incomplete, a location reachable only through unauthored locations
  is a pending warning. Complete packs are unaffected.
- **Pattern form:** U45 writes patterns as a first-match `if` chain plus `everyNthAmong`. This keeps cadences such as
  "every 3rd turn" that do not divide the cycle evenly. Later regions use it whenever a cadence matters. U34d re-checks
  the Ruins and Mistwood patterns for cadence fidelity.
- **First Tyrant numbers (U45, a scratch pack with a stub route; not tuning):**
  - L11 solo: 0% wins for every class against DESIGN §19 #19's ≥ 60%.
  - L13: Warden 13%, Wizard 2%.
  - Cause: the `pre_tyrant` scenarios have only starter gear, because no gear exists yet (ATK/SP 22–27, armor 0–2, against
    the Tyrant's armor 6 and ward 8), and there is no companion.
  - **Ruling:** #19 is measured only after U49/U50 add level-banded gear. The scenario builders must then equip
    band-appropriate gear (U36 marks gear as "constructed"), and companions must be registered (U56). Until then this
    number is not a balance signal.
- **Gaps added to U34d:**
  - an on-death move (Spore Drift);
  - a move that costs the Breach Clock (Hour Leech);
  - location items with a chance, and items that appear after the first visit (Frayed Moments);
  - per-effect conditions inside one event (dust "with the key");
  - infected-node description text;
  - a boss line at a low-HP threshold;
  - region hazards;
  - condition atoms "ally down", "ally below 50%" and "repeat previous move";
  - more than one gatherable item per node;
  - placing the caravan merchant (Tessaly) at runtime.
- **Worktree method:** a unit that runs in parallel gets an `isolation: "worktree"` agent. The worktree starts from
  `main`, so the agent first runs `git merge --ff-only unraveling` and then commits on its own branch. The lead merges
  (the only conflicts are the barrel, `LANDED` and shared pins), then deletes the worktree and branch.

### D-093 · U48 split; both halves on Opus, 2026-10-17
- U48 is split, on Tim's call: **U48a** is the Skyreach (5 locations) and **U48b** is Silverwood Before and the Threshold
  (14 locations).
- Both halves run on **Opus**. The Before and the Threshold run on engine mechanics that already exist (U31, U32, U34c), so
  their data must match those exactly. They will also need the most judgment calls about what the schema can't express.
- The prose is still WORLD's, verbatim.
- Fable stays reserved for U53–U57, which write new dialogue and scenes.

### D-094 · U44/U46 details, 2026-10-17
- **U44 (44928b3), the Voidscar and the Aether-Kissed Highlands:**
  - 5 locations, 8 creatures, and Nyx and Dask (both with `companionId`).
  - The Glowlands, Nexus and Apex are now reachable from the start, in 6, 7 and 8 watches.
  - `cr_steppe_harrier` belongs to U44, because its first region is the Highlands.
  - Constructs carry Poison and Bleed immunity, following WORLD's conventions line 1622. The engine adds only Poison for the
    `construct` tag, so U34d checks every construct (the U43 Golems too), or the engine adds Bleed for the tag.
  - The Harrier drops Storm Glass at 30% (DESIGN §8.2 and WORLD §8.1 beat the creature block).
  - Mortals use a `portrait` sigil, because the schema requires one.
- **U46 (04028ea, b5da198), the Drowned Reach and the Ashen Steppe:**
  - 17 locations, 10 creatures and 7 NPCs, with the Bell-Warden and Ashmaw at three phases each.
  - Boss arenas that name no wandering pool are `safe: true`.
  - Ashmaw's armor 0 becomes `damageTakenMult` 1.185.
  - The Grave adds `item_dreyls_pyre_ledger` (100% on the first clear).
  - `ev_hallows_cairn` grants only `echo_iron_that_does_not_wish` (WORLD over BIBLE).
  - Readings that are pinned: the Steppe return sweep is 2.0 against WORLD's 1.9, and the Flats' second roll is `chance`
    0.999.
- **Gaps added to U34d:**
  - hazards (Soaked on entry, ashfall, Pan glare, Cairns lightning, Void-chill, Pass mirage);
  - the lamp-dark state;
  - the Warden's Soaked each round;
  - the `ambush` flag, which the engine never reads;
  - a second region's pool share ("pool(glowfen) 10%");
  - "misses if Guard";
  - boss lines at HP thresholds;
  - the Choir's priority order;
  - `optionalWhen` bypasses that hide the fight forever;
  - the Glass Mote's on-death Shatter;
  - "ally down", currently approximated as `allyCountBelow: 1`;
  - Dask as a Loop 1 flicker;
  - the exploited Heartstone's +1 level;
  - `q_lightless_stair`'s giver.
- **Merge state:** 7 of 12 regions, 38 of 73 locations; 2,711 tests.

### D-095 · U48b details — Silverwood Before and the Threshold, 2026-10-17
- **U48b (8879f95):** the Before has 10 locations, 5 creatures and 16 NPCs. The Threshold has 4 locations. The barrel
  order is 6 and 12.
- **Mechanics proven on the real pack:**
  - entering through the Nexus door and through the Apex tear;
  - Garret rests advancing Day 1 → 2 → 3;
  - Last Bell resetting the echo, except after `q_stop_the_ritual`;
  - a Conflux Anchor showing up in the Depths;
  - the Bell encounter chances, checked over 300 seeds;
  - Threshold *Let go* landing on the Still Shore, each place listing its legal actions, and `chooseClass` → `newLoop`
    returning to the Ruins.
- **Readings:**
  - Bell conditions use `beforeDay`.
  - A Bell encounter below 100% uses `respawn: 'daily'`.
  - Drawing a weapon in the Plaza is an `interact` event that starts a Watch fight.
  - The Gate event fires once per echo, through `flag_before_gate_whole`.
  - `flag_visited_before` is set at the Gate and at the Conflux.
  - The Conflux pillars wake only when you come by the stair.
  - The region is gated with `unlockWhen loop ≥ 2`.
  - The Threshold's band is 1–20, because the schema needs one. "After any ending" means any of `echo_ending_a`–`f`.
  - The Library adepts spawn at 60% (§3.11/§12.1 over §6.9).
  - `ev_conflux_sundering` is superseded by D-083 and left out.
  - `q_the_mending` uses STORY's stage 2, not WORLD §7.10's stage 3.
- **Gaps added to U34d:**
  - NPC presence by Bell or hour. Today every NPC stands at its home. **This matters most for the living city** — make it
    a priority in U34d.
  - the non-lethal arrest;
  - the Corridor's ley-flare hazard;
  - "noon" under the frozen clock;
  - the early-hound anomaly;
  - `thresholdGo` runs no arrival hooks, so Threshold location events never fire (pinned in a test).
- **Test infrastructure:** the 1-vs-2-worker batch test now has a 30 s timeout. It takes about 6 s on the shared 2-core box.

### D-096 · U47 details — the Veil and the Glowfen, 2026-10-17
- **U47 (9ed46ab, 480047f):** the Veil has 8 locations, 4 creatures and 3 NPCs. The Glowfen has 8 locations, 2 creatures
  (Barrow-Light, Lantern Matron) and 4 NPCs. All 16 locations are reachable.
- **Readings:**
  - The Glowfen's first-visit fights follow §3.9 (Barrows 40% by day, 100% at dusk or night) over §10.3's printed 4.4.
  - Umbra is L16, which is out of band at the Eye: WORLD §3.8 says band 13, §6.1 says 10–14.
  - The Pool cleanse is a conditional `sanctum` rest at Corruption ≥ 6. Short rests cleanse there too.
  - Mireya's lantern being "lit" reads as Mireya active plus the lantern carried.
- **Gaps added to U34d:**
  - weather and hazards (Glowfen rain and Soaked, spore-fog, Shallows sinking, Gullet draw, the Veil's Unmaking hazard,
    Gallery Blind);
  - conditioned pool entries (the Barrow-light is only 2% at dusk or night);
  - `killed` that holds across loops (Umbra's Phase 1 skip);
  - per-move use caps, currently approximated (Matron Drink, Umbra Cling);
  - "cannot be reapplied" (the Matron's Phase 3, approximated with `stripBuffs`);
  - creature loot gated on `killed` (the Barrow vial is a hidden location item).

### D-097 · U48a details; every region and location authored, 2026-10-17
- **U48a, the Skyreach (f2a7263):**
  - 5 locations and 4 creatures, the Stormcrown with three phases.
  - The Crown, Roost, Eyrie and Perch are `safe`.
  - The Eyrie is a free camp: the Skyreach inn was dropped in C-31.
  - The Stormcrown bargain is gated `loop ≥ 2`, following §2.11, STORY and BIBLE.
  - The greataxe is given by an interact event (Ironclad −10 without `echo_sky_oath`).
  - The Perch's 3 storm glass lie on the ground.
  - The L9 Sentinel stays in `pool_skyreach` as WORLD places it, even though §10.1 says pools hold in-band fodder only.
  - Open for U51: `echo_sky_oath`'s source is the Cairns in WORLD and the Perch in STORY §12. Decide it in the Echo catalog.
- **Every region and location is authored:** 12 regions and 73 locations, each reachable from `loc_whispering_ruins`
  (rule 8 reports nothing).
  - `regions` and `locations` are off `INCOMPLETE_TABLES`, and every location reference resolves.
  - **Creatures:** 56 of WORLD §6's 57. `cr_unmade` (Loop 3+ anomaly) and WORLD §10.2's 16 `cr_anomaly_*` variants go to
    U34d with anomaly spawns.
  - **NPCs:** all 38 of WORLD §4's. The 8 other §4 ids are former names (§4's mapping table). `npcs` stays on the list in
    case STORY quests need an NPC §4 lacks.
- **Real-pack sims** stop on the first missing item (`item_glyphbound_lantern`, `mat_rootbone`, `mat_shadow_ash`), as D-090
  expects. U49/U50 unblock them.
- **Gaps added to U34d:** a % HP cost (fleeing the Stair costs 10% HP), a pickup with a cost, "dark" description variants,
  and Skyreach weather (Gale, lightning on Soaked).
- **Totals:** 2,960 tests; 24 known warnings, all rule-11 deliberate placements or rule-2 flags that later units set.

### D-098 · U34d split into world-state (U34d) and combat (U34e), 2026-10-17
- The gap list in D-091, D-092 and D-094–D-097 is too big for one unit, so it is split.
- **U34d (Opus, this batch) — world state.** In priority order:
  1. NPC schedules: the Before's Bells, Tessaly's caravan, Dask's flicker.
  2. Location items: `chance`, spawns after the first entry, more than one gatherable per node.
  3. Per-effect `when` in events, and pickup costs.
  4. Pool entries with a `when`, and a second region's pool share.
  5. Threshold arrival hooks.
  6. Infected and dark description variants, the Before's "noon", the non-lethal arrest.
  7. Validator: rule-11 exemptions; new engine flags.
- **U34e (Opus, queued) — combat.**
  - condition atoms "ally down", "ally below X%", "repeat previous move";
  - `killed` across loops, and "died here in a previous loop";
  - on-death moves, and moves that cost the Breach Clock;
  - per-move use caps, "cannot be reapplied", "misses if Guard";
  - boss lines at HP thresholds, and a % HP damage effect;
  - construct Bleed immunity, the `drowned` tag, the `ambush` flag;
  - the exploited Heartstone's +1 level;
  - hazards and weather;
  - anomaly spawns with `cr_unmade` and the 16 `cr_anomaly_*` variants;
  - re-check pattern cadence in the Ruins and Mistwood;
  - small items: `pathBot`'s `talk` outside explore; Foresight's chip and hidden intents.

### D-099 · U49 details — 70 pieces of gear, 2026-10-17
- **U49 (3732c2b):** 32 weapons, 18 armor and 20 trinkets. The kit gear moved out of `starter.ts` with the same ids.
- **Readings:**
  - Ironclad Mail is tier 2, because its armor 4 fits only T2.
  - The Heartstone pair is tier 0, fixed Common, and bound.
  - Crafted rows are fixed Common.
  - "Never sold" means no merchant stocks the item.
  - The five kit weapons drop from the Redundant Wayfinder, and the Bell Shard from the Bell-Ringer.
- **New `custom` passive scripts the engine does not read yet → U34e:** `basic_stun_chance` (Clapper),
  `status_duration_reduction` (Diver's Coat, Salt Charm), `low_hp_status` (Lantern-Moth Brooch), `foresight` (Unlidded Eye),
  `ability_mp_cost_reduction` (Oriel's Quill), `hazard_immunity` (Weaver's Thread Ring).
- **Balance flags (pinned, not fixed):**
  - Three T3 trinkets give +1 instead of +2: Choir Mask, Dask's Scout Badge, Salt Charm.
  - Four plates have ward under their tier: Cinderhorn 1, Ironclad Plate −2 (the legacy "weak to magic"), Oathplate 2,
    Sunderforged 3.
  - The Sky-Whisper Talisman sells for 32 g, under T2 (legacy).
  - The Umbral Mirror has its own 15% Curse plus `affix_of_the_void`'s 15% Curse, about 28% per hit together. That is as
    WORLD writes it. The fun/balance pass decides.
- **Open for U50:**
  - Merchant stock can't name a fixed affix.
  - The Clapper recipe needs `output.rarity: 'common'`.

### D-100 · U51 details — the loop records; Echo codex lines are placeholders, 2026-10-17
- **U51 (c27b972):** 103 Echoes, 40 achievements, 15 attunements, 6 modifiers, 6 endings plus 2 closers, and 3 factions,
  all registered. `echoes`, `achievements`, `attunements`, `modifiers`, `endings` and `factions` are off
  `INCOMPLETE_TABLES`; no region reference was a typo.
- **`echo_sky_oath` (D-097):** it is earned at the Ashen Cairns (`ev_cairns_strike`) and spent at the Stormcrown's Perch
  (Loop 2+). STORY §12's row is amended to match WORLD and the authored data.
- **C1 changes:**
  - The validator's `awaitsStory` turns rules 15 and 16 into pending warnings while quests and dialogues are unauthored.
  - `endingSlides` puts `CLOSER_TEXT.fall[reason]` in front of the `closer_fall` records.
- **Rule 16 now (pending):**
  - 56 Echoes have no grant yet; they arrive with quests and dialogue (U52+).
  - 51 Echoes "gate nothing" yet.
  - Endings C, D and E wait for their quests' `{ending}` effects.
  - `echo_litany_complete`, `echo_heartstone_triune` and `echo_anchor_schema` have **no grant mechanism at all**. The quest
    or dialogue units must give them one, or the lead rules on it.
- **Rulings:**
  - Achievements pay **0 Resonance**. DESIGN §10.6 lists no such source, and 40 × 10 would buy most of the shop.
  - The attunement costs sum to 430; DESIGN §10.7's prose says 440, and the table wins.
  - Achievement ids and names follow DESIGN §15.2 over STORY's titles.
- **Echo `codexLine`s (103)** were written by U51 (Sonnet) as functional Wayfinder's-Notes lines. They read like
  mechanics notes. **The ✦ codex unit rewrites them** in the BIBLE's voice (STORY §14's codex plan).
- **Gaps → the achievement/engine work:** 13 engine-only `tally_*` counters (listed in the `achievements.ts` header).
  `flag_named_nyx` must be set by dialogue.

### D-101 · U50 details — the items are complete; first Tyrant numbers with gear, 2026-10-17
- **U50 (60cba5c):** 157 items in total (U49's 70 gear, plus consumables, materials, and quest, key, recipe and tome items),
  30 recipes, 8 merchants, and 7 thrown-consumable `itm_*` abilities. `starter.ts` and `amulet.ts` were folded into the
  category files. `items`, `recipes` and `merchants` are off `INCOMPLETE_TABLES`, which leaves creatures, quests,
  dialogues, npcs, companions, codex and encounters.
- **Deviations:**
  - Trusted merchant pieces are Rare with a rolled affix, because stock can't name a fixed affix.
  - Pieces for Loop 2+ and for Days 1–2 are core stock entries with a `when`.
  - The Veil Sigil costs 30 g only at Neutral (`priceMult` 5/6).
  - The Sworn gift pieces are not stock.
  - Fenlight Regen 4 is a guess, pinned in a test.
- **Gaps → U34e:**
  - The engine does not read the custom passives `cleanse`, `whetstone_strip`, `remnant_ink`, `lantern_oil_ward`,
    `keepers_copy`, `scouts_whistle`, `remnant_wax_seal` and `counts_as_spellbook`, nor U49's six (D-099).
  - `readBook` counts toward `spellbooksRead` only when it raises Corruption.
  - A Hostile Hollis is still refused at Corruption 3.
  - Kaelen's pool rule contradicts his list.
  - WORLD §9.3's Glow Moss prices disagree (11 against 20).
- **Tyrant scenarios** now equip the band's best Common gear (`gearTierOf` and `bestGear` in `src/sim/scenarios.ts`).
  Potions are band-aware.
- **First Contained-Tyrant numbers with gear (solo, 20 seeds, real pack; DESIGN §19 #19 wants ≥ 60% wins at L11, ≥ 80% at
  L13 and 12–18 rounds) — report only:**
  - L11 wins, caster/melee:

    | Class | Caster | Melee |
    |---|---|---|
    | Ranger | 80% | 85% |
    | Wizard | 85% | 35% |
    | Elf | 50% | 70% |
    | Warden | 0% | 0% |

    The Shadow Weaver died on the walk to the Apex.
  - L13 wins sit between 0% and 72%, all under 80%. The Ranger drops from 85% at L11 to 25% at L13, which looks like a
    scenario problem.
  - The median is 20 rounds, against 12–18. Elite fights run 13 rounds, against 6–9.
  - **Warden 0% plus `guard` loops past round 60** repeat D-089's flag: the Warden's damage against bosses, and the bots'
    Warden play.
  - None of this is tuned yet. It feeds the balance unit, together with companions (U56).
- **Real-pack blockers now:**
  1. `unknown codex entry 'codex_maelis_korr'`: reading Korr's Marginalia unlocks a codex entry. The codex table arrives
     with ✦ U60/U61. STORY §14.1 also lacks Vask, Rhune and Dreyl.
  2. Scenario `communion_movement_2` crashes on the real pack (`cannot walk in ending mode` at the Corridor, Day 30). This
     is a scenario builder bug → U34e.

### D-102 · U34d details — world-state expressiveness, 2026-10-17
- **U34d (42be256), C1 additions (all optional, with defaults):**
  - `npc.schedule` is a list of `{when, at}`: the first entry that holds wins, `at: []` means absent, and `npcOverrides`
    still win.
  - Location items gain `chance` (default 1) and `onTake` effects.
  - `gather` takes one node or a list.
  - Locations gain `wanderingPools: [{regionId, chance}]`.
  - Region pool entries gain an optional `when`.
  - New effect `onlyIf {when, effects}`.
  - New condition `infected: true`.
  - The `gather` action gains an optional `itemId`.
- **Behaviour:**
  - The Before's people move by Bell and hour; talk, examine and merchants follow their schedules.
  - Tessaly is at Hearthring and also at the Camp after `flag_hearthring_caravan`. Dask is absent in Loop 1.
  - Item `chance` is rolled once per loop on the run Rng; a miss waits for the next loop. A `when` that turns true later
    spawns the item on a later arrival.
  - The Roost greataxe uses item `onTake`, so its coined interact events and flag are gone.
  - Threshold places fire their `enter` events.
  - Infected nodes say "The air here is coming apart at the seams."
  - The Before keeps its own hour, and a Garret short rest advances it, so "noon" works.
  - Creatures tagged `non_lethal` (the halberdiers) arrest instead of killing: you wake in the Garret a Bell later.
  - Rule 11 skips Horde-only encounters and anomalies (20 → 15 warnings).
- **Not done:** "dark" description variants, because WORLD gives no text for them.
- **Readings of WORLD contradictions:**
  - Oriel is at the Archives on Days 1–2 and at the plinths on Day 3.
  - The Masque's place follows §3.11.
  - Tessaly is at both Hearthring and the Camp.
  - Caelum is at the Plaza at noon on First Bell.
- **Real-pack sim** (18 runs × 3,000 steps, 6 bots × classes): the only errors are codex entries (`codex_oriel_danthe`,
  `codex_maelis_korr`) unlocked by `readBook`. The ✦ codex units (U60/U61) fix them. There are no soft-locks, and 3,153
  tests pass.

### D-103 · Worktree agents back up their branches, 2026-10-17
- A worktree agent's commits live only on this cloud machine until the lead merges them. If the usage window cuts the
  session off and the machine is then reclaimed, those commits are lost.
- From U52 on, every worktree agent pushes its branch after each commit to `origin wip/<unit>`
  (`git push -q origin HEAD:refs/heads/wip/<unit>`). It never pushes `main` or `unraveling`.
- The lead still merges into `unraveling` and deletes the `wip/` branch after the merge.
- Parallelism is Tim's call per batch. Running four at once is fine when the units barely overlap. The 2-core box makes
  each check slower, so raise test timeouts that are sensitive to timing.

### D-104 · U63 details — the UI foundation and its patterns, 2026-10-17
- **U63 (9776a97, 6501262):** `src/ui/**` holds the App, Shell, store, hotkeys, tokens and themes, Title and Class Select,
  and first cuts of the Settings and Saves panels (U69 owns the full ones).
  - 115 UI unit tests, and `tests/e2e/title.spec.ts` on desktop and mobile.
  - Bundles: production 330.6 kB gzip, e2e 467.4 kB, against a 600 kB budget.
  - `main.tsx` renders `<App/>`, and the smoke test now plays New game → class → first location.
- **Patterns every later screen copies:**
  - A container with hooks renders a pure view that takes props only. Tests drive the view through
    `tests/unit/ui/tree.ts` (`expand`, `byName`, `call`).
  - Game state comes from `useGame(selector)`. A screen enables only actions that `useIsLegal` or `useLegal` allow.
    Anything that isn't gameplay goes through `store.shell`.
  - Keys are declared with `useHotkeys(map, { scope })`. One Shell listener applies the rules, and the legend and the `?`
    panel read the same registry.
  - A panel is added to `PANEL_COMPONENTS` and opens in the shared `Modal` (focus trap, Esc, focus back to the opener).
    `useShell().confirm` asks yes or no.
  - The control a view should focus first carries `data-autofocus`.
  - Token names are `--text-*`, `--surface-*`, `--glyph-*`, `--fill-X` and `--on-fill-X`. `tokens.test.ts` enforces their
    contrast, and `--target-min` sets the 44 px target size.
- **Rulings:**
  1. **`?scenario=` in e2e builds:** the **app layer** (`src/main.tsx`) may import `@sim/scenarios`, only behind
     `if (__DEV__ || __E2E__)`, so production drops it as before (U36). `src/ui/**` still must not import `sim`. The first
     unit that needs a scenario e2e test (U64) adds the lint allowance and the boot hook.
  2. **The Title menu follows DESIGN §16.3:** Achievements and Lore are added when their panels exist (U66 and U69, after
     the codex U60).
  3. **Corruption colour:** DESIGN's `#7B3FE4` is kept for fills and art. For text and glyphs on lighter surfaces the token
     uses a lighter tint of the same hue, enough for 3:1 (D-035 beats exact hex; D-062 stays the palette source).
- **Extras on PLAN §6.1's store:** `notify`, `getNotices`, `isLegal`, and `shell.continueSlot` / `restoreSlot` /
  `canPersist`. `listSlots` also returns empty and damaged slots (DESIGN §14.4).
- **Housekeeping:** the git proxy refuses remote branch deletion, so merged `wip/<unit>` backups stay on GitHub. They are
  harmless, and Tim can delete them.

### D-105 · U52 details — the quest/dialogue pattern, 2026-10-17
- **U52 (ddc6c52):** all six legacy quests and 23 scenes are in `src/content/shared/{quests,dialogues}/`.
  - The conventions are in the two barrel headers.
  - A `pathBot` proof per outcome (13/13) runs on the real pack: `npm run sim -- quest [<id>]`, `src/sim/scripts/quests.ts`.
  - Rule 16 pending went from 97 to 84, rule 22 from 6 to 0, and rule-2 warnings from 21 to 17.
- **Conventions U53–U59 copy:**
  - One scene per purpose per NPC, each in a `SCENE_PRIORITY` band. NPC scenes close during the Horde (`NOT_IN_HORDE`).
  - Every node is tagged `legacy`, `story` or `written`, and the first two are tested against their sources.
  - Echo lines use `echoLocked()`.
  - Consequences sit on the choice, with `questAdvance` last. `rewards` holds only what every outcome pays.
  - A quest never opens a scene. Companion lines are `companionReactions`, and there is no `recruit` until U56.
  - `loyaltyFor()` applies DESIGN §12.5.
  - Each quest outcome gets a `QUEST_SCRIPTS` proof, played by `trained(pathBot)`.
- **C1 addition:** a `statBonus` effect, which writes `passiveBonuses`. It pays the legacy +1 MAG, +15 max HP and
  +20 max HP rewards.
- **Rulings:**
  - Echo-locked lines show **greyed from Loop 2**, as DESIGN §13.2 says: the tease is the point. Hiding them is a
    one-line change if the fun review asks for it.
  - Keeping the Crystal pays 60 XP and no gold (legacy).
  - The Crystal-location Echo is granted when the Crystal is first taken.
  - Refusing the shards completes `q_void_shards` (D-017).
  - The warder's word is a choice in the scene (STORY §13), not an entry rule.
  - Listen happens in the Crystal scene; the Library Listen goes to U58.
  - `echo_heartstone_triune` is granted in the Heartstone choice, which resolves D-100's gap for it.
- **Gaps → U34e:**
  - Content never sets `world.heartstone`, so Destroy's Ley +25% MP and Breach-born −25% HP don't apply.
  - At the Outpost the plain Golem group still fights when the gate is skipped by the Echo.
  - The Depths' choice log text is duplicated.
  - "Shimmering Pass" random lines would need a "visited" condition and a random pick.
- **Open for the ✦ units:** `echo_borin_oath` has no line anywhere (STORY or legacy). Brak and Nyx recruitment, Ilyra's
  déjà-vu lines, and companions leaving after an Exploit belong to U54–U56.
- **Balance note:** the Hollow's two Stalkers beat a level-7 melee ranger about one seed in five.

### D-106 · Four units at once, 2026-10-18
- Tim's batch runs U34e (Opus), U60 (✦ Fable), U53 (✦ Fable) and U64 (Opus) **in parallel**, each in its own worktree with a
  `wip/<unit>` backup (D-103).
- Their paths are disjoint: the engine, codex content, faction quests and the UI. The overlaps are barrel and registration
  lines, plus the content tests' pins.
- On the 2-core machine an agent re-runs a test that times out once before investigating it, and never loosens timeouts
  outside its own tests.
- **U53** follows U52's conventions (D-105). **U60** writes the people, Nine, Wayfinder, faction and history entries; U61
  writes places, regions, creatures, items, magic and the loop.
- U51's Echo `codexLine`s (D-100) are rewritten in **U61** (or the first fun review), not in U60.

### D-107 · U64 details — the Explore screen and node map, 2026-10-18
- **U64 (937c84c):**
  - The Explore screen with scene, description, NPCs, items, ExitBar, ActionBar, HUD, StatusBar and log.
  - `MapPanel`, used both as an overlay and docked.
  - First art pieces: `Scene`, `RegionPalette` and `Icon` (20 templates → horizon plus far, mid and near shapes, coloured
    from DESIGN §17.1).
  - The `?scenario=` boot. Production drops the builders, and a bundle test proves it.
  - Bundles: production 357.1 kB, e2e 512.6 kB gzip. `explore.spec.ts` passes 8/8 on desktop and mobile.
- **Patterns added:**
  - A pure model helper per screen (`exploreModel.ts`, `mapModel.ts`) and `legalSet(legal)`.
  - The hotkey level `inPanel`.
  - `bootGame({ start })`.
  - Loop-ending actions ask for confirmation.
  - The `--text-warn` token.
- **Rulings:**
  - The HUD is a top band, following PLAN's grid. DESIGN §16.1's left column is superseded.
  - The visible log is `role="log"` with `aria-live="off"`: one spoken sentence per step through the Shell's live region
    beats PLAN §8.4's "the log is a live region".
  - The mobile tab bar is decided in U69: PLAN §6.8 says Scene · Actions · Log · Map · Menu, DESIGN §16.1 says Explore ·
    Journal · Pack · Map · Menu.
  - In Loop 1 the clock chip shows only the day and watch.
- **Left for later units:** the Fall forecast and Threshold inset (U70), quest rings on the map (U66), merchant and forge
  buttons (U67), the bottom tab bar (U69), per-location silhouettes and focal pieces (U71/U72).

### D-108 · U60 details — Codex I, 2026-10-18
- **U60 (3e5ab55, dede08c):** 42 codex entries by voice: RA 22, IT 8, WF 5, WN 7.
  - The 31 listed in the brief.
  - `codex_litany_2..9`, the 8 missing from STORY §14.1's 79 rows (its "`codex_litany_1` .. `_9`" row).
  - Three new people STORY lacked (D-101): `codex_tobrin_vask` (WN), `codex_ilsabet_rhune` (RA) and `codex_corvin_dreyl`
    (IT). The lead pointed their tomes (`item_tobrins_warding_primer`, `item_rhunes_hydromancy`, `item_dreyls_pyre_ledger`)
    at these entries.
  - `codex` stays on `INCOMPLETE_TABLES` until U61.
- **Real-pack sim** (random, melee, explorer × 3 seeds): 0 errors and 0 soft-locks. The codex blockers are cleared.
- **Unlock readings where §14.1 has no condition atom:**
  - "Reach the Apex" = at the Apex or `echo_apex_resonance`.
  - "Meet X" = their offer scene is done, or the quest or recruitment.
  - "Trade with Borin" = at the Emberforge or one of Borin's Echoes (no trade atom exists).
  - `q_hollow_choir` counts as completed.
  - Quest and companion references are pending until U53/U56.
- **Fact choice:** the Choir has sung verse VIII wrong for "four hundred years" (BIBLE/§14.1), longer than Ysolde (Year
  243): their practice is older than she is.
- `echo_hadrek_clockwright` mentions a codex entry that doesn't exist. U61 writes it, or the Echo line is amended.

### D-109 · U53 details — the faction chains, 2026-10-18
- **U53 (c60c778):** the four faction chain quests and 19 scenes on U52's pattern. 8 proofs complete on the real pack.
  - The first three top-level `encounters` records are the Day of Teeth's Horde-echo waves. `enc` is now a lint id prefix.
  - Rule 16 pending went from 84 to 80.
- **Written words:** 56 nodes, 17 choices and 16 journal lines, pinned in the test's `WRITTEN`. Among them is the eighth
  verse as the Choir sings it wrong: "We name it, and it enters us. / Open, and enter."
- **Readings:**
  - The Ledger is read inside the offer scene and grants `echo_seven_wayfinders`.
  - Blackreed's Axe is handed back ("Keep it"), with no second reward.
  - `q_hollow_choir` opens at Weavers ≥ −9, following STORY over DESIGN §11.4's Trusted.
  - Accepting `q_unlidded_eye` after the Nexus Aberration is already dead spawns a second one.
  - `item_pells_day_count` sits at the Cistern while the Ledger quest is active (WORLD §9; the §3.6 block omits it).
- **Balance flag → the balance unit:** a carry-over start (level 10, starter kit; the bots never buy weapons) loses to
  the L12 elite Aberration about half the time solo, and to the three chained Husk waves after it about a third of the
  time. A first visit to the Nexus on the Telling stage runs that whole chain with no breath between fights.
- **Left for U55/U56/U58/U62:** Nyx's side of `q_unlidded_eye`, Brak refusing the Choir, what `echo_day_of_teeth` and
  `echo_choir_knows` gate, and the Horde's "Go, Wayfinder!" lines.

### D-110 · U34e details — combat expressiveness; creatures complete, 2026-10-18
- **U34e (634731a … a8b7a3c, seven commits; resumed after the usage cutoff):** all seven brief items are done.
- **C1 additions (all optional and defaulted):**
  - effect `heartstone`; Location `levelBonus`, `fleeEffects` and `hazards` (fields: on, when, cycle, chance, firstVisit,
    text, status, strike, accuracy, dealtMult, hpPctMax, restoreOnLeave, watches);
  - CombatWhen `allyDown` / `allyBelow`;
  - Move `repeatPrevious`, `missesIfGuarded`, `consumesAlly`, `clockCost`;
  - Phase `statusImmunities`, `roundStatuses`;
  - Creature `deathMove`, `hpLines`, `innateStatuses`, `anomaly{region,loop,count,when?}`;
  - Condition `killed.anyLoop`, `diedHere`; effect `damage.pctMax`; specials `class_mirror` and `last_spell`;
  - Profile `lastDeathLocation?`.
  - A merchant's `refusesWhen` now overrides the Hostile rule.
- **Behaviour:**
  - The Heartstone choice sets `world.heartstone`. Destroyed: Ley abilities cost +25% MP, and breach-born and ley-made
    enemies have −25% HP. Exploited: the Hollow's stalkers are +1 level.
  - All 14 item custom passives are read.
  - The creature files use the new mechanics.
  - Per-place hazards and weather are in, and the Thread Ring blocks the Unmaking.
  - `cr_unmade` and the 16 `cr_anomaly_*` exist. They spawn from Loop 2 at 10% + 5% per loop (cap 30%, +10% at night) on
    their own Rng stream.
  - The Loop 1 closer survives a Fall on the way to the portal, which fixes the scenario crash.
  - **`creatures` is off `INCOMPLETE_TABLES`**, done by the lead: 57 + 16 records.
- **Readings:**
  - Anomaly loot is the guaranteed Frayed Moment only.
  - The Rootbound Pack is one combatant with 3× HP that strikes three times.
  - The Cairns' "5 Storm per watch" is per round.
  - "Ranged" means a wielded bow.
  - Kaelen's explicit list wins over his rule.
  - Ability MP-cost reduction stacks additively with the staff's.
- **Not modelled:** the Nexus temporal shear, Mistwood fog, wind and rockfall, and the Ruins' cosmetic hazards. Golem
  Cover keeps `allyPresent`, because `allyBelow: 0.5` breaks the Outpost proof; the balance unit decides. No UI reads
  `foreseenMove` yet (U65).
- **After the merge:**
  - The `q_keepers_ledger` "whole" proof died on the Drowned route in 4 of 5 seeds (a level-6 ranger in Loop 2, with the
    new hazards and anomalies). It now pins a seed that wins.
  - A real-pack sim (24 runs, 3,000 steps) has 0 errors and 2 soft-locks, both bot `guard` loops past round 60: a caster
    ranger against the Stair lampreys, and an explorer Warden at the Barrows.
- **For the balance and bot unit:**
  - Bots must stop guarding forever.
  - Drowned Reach lethality at L6 in Loop 2.
  - The D-109 Nexus chain.
  - The D-101 Tyrant numbers.

### D-111 · The companions are registered now; this supersedes D-088's "at U56", 2026-10-21
- With D-090 in place, a companion record's references to arc quests and camp scenes that don't exist yet are pending
  warnings, not errors. All six NPCs exist.
- So the lead registered the six companions and their 24 abilities in `contentTables` before U54/U55, and took
  `companions` off `INCOMPLETE_TABLES`. `npm run validate` reports 0 errors.
- The tests that pinned "not registered" were repinned in the same commit.
- U52's convention "no `recruit` until U56" (D-105) is lifted: U54–U56 recruit as STORY says.
- U54 (Ilyra, Brak) and U55 (Nyx, Dask) run as ✦ Fable subagents in parallel, in worktrees with `wip/` backups.

### D-112 · U55 details — Nyx's and Dask's arcs, 2026-10-22
- **U55 (d32f4a1; resumed after the usage cutoff from the lead's snapshot e3024ba):**
  - 6 quests with 25 stages, and 34 scenes: 14 for Nyx, including 3 camp scenes, and 20 for Dask, including 3 camp scenes.
  - 11 proofs cover every outcome and recruitment; all 31 quest proofs pass on the real pack.
  - Written words: 97 nodes (Nyx 47, Dask 35, narrator 15), 29 choices and 19 journal lines, pinned in `WRITTEN`.
  - Pending: rule 16 went from 75 to 64, and rule 18 from 6 to 4. The `flag_named_nyx` warning is gone.
- **Edits outside its owned files (the region units left the hooks):**
  - Nyx's and Dask's NPC `schedule`s for their arcs: "in four places" for Dask, Nyx's Sanctum line during
    `q_unlidded_eye`.
  - `ev_gallery_marks` grants `echo_seven_wayfinders` and advances `q_seven_marks`.
  - `shardsGathered(loop2)`, because Nyx's Loop 2+ déjà-vu scene now comes before the legacy offer. U53's proofs were
    updated to match.
- **Readings:**
  - `q_seven_marks` starts only on the Still Shore (Loop 3+, once per profile).
  - "Ask in Movement III" means `flag_tyrant_spared` with Dask active; his choice is a talk at the Apex afterwards.
  - Loyalty: +5 per stage, +3 for agreeing to undo, −10 for a flat refusal, and −10 for Nyx joining while
    `echo_choir_knows` is held.
  - Telling in `q_the_dark_between` sets `flag_nyx_hostile` and dismisses her.
- **Gaps → U58 and the balance unit:**
  - No condition atom expresses a companion refusing a place (Nyx at the Emberforge, the Apex or the Before).
  - Dask's −30 for a Tyrant kill and +3 for sparing it need a hook in the Tyrant's data.
  - The Phase 3 "one voice quieter" with `echo_dask_rest` is creature data.
  - `echo_threshold` and `echo_ritual_inevitable` are granted by U57/U58.

### D-113 · U54 details — Ilyra's and Brak's arcs; companion gaps queued (U34f), 2026-10-22
- **U54 (6824137; resumed after the usage cutoff from the lead's snapshot 74c023a):**
  - 6 quests and 23 scenes: hubs `scene_ilyra_arc` and `scene_brak_arc` hold recruitment and the offers, plus 3 déjà-vu
    scenes, 6 camp scenes, `scene_the_first_drowned`, `scene_braks_brother`, Dray's and Hadda's scenes, Kaelen's offer
    and Borin's oath.
  - 11 proofs. All 43 quest proofs pass together on the real pack after the merge.
  - Written words: 97 nodes, about 1,790 words, pinned in `WRITTEN`.
  - Pending: rule 16 down 13, rule 18 from 6 to 2 after U55, rule 1 from 193 to 178.
- **Edits outside its owned files:**
  - a `dejaVu: 30` scene band in `dialogues/common.ts`;
  - Ilyra's reaction to an Exploit, plus her leaving for the loop (STORY §7.1), in the legacy Heartstone scene;
  - `ev_archives_first_drowned`;
  - Brak's schedule at Hearthring when he is kept away.
  - Merging U54 after U55 concatenated both quest-script blocks; U55's `waiter` was renamed `restingWaiter`.
- **Readings:**
  - An NPC's offers share one hub.
  - Legacy offers still win ties: Brak joins after the Outpost offer, Ilyra after the scroll offer (DESIGN §12.1).
  - The Line's outcome A is DESIGN example 5 verbatim, plus `dismiss`.
  - The Line's `failWhen` is `flag_tyrant_dead`.
  - Every end of the Line gives Ironclad +10 (§11.2/STORY over §11.3's +15).
  - Loyalty tiers follow §12.5 (25/50) over §11.4.
  - `echo_borin_oath`'s line is written (STORY gives only the beat).
- **Balance flag:** without the bond Echo, a single loop reaches about 46 loyalty with Ilyra, so STORY §6.2's "ending E in
  Loop 2" falls about 4 short of Loyal (50). The balance unit decides: raise the per-stage +5, or accept that E needs the
  bond or Companion's Trust.
- **Engine gaps → U34f (Opus, small):**
  - Companions refusing places has no data form: Ilyra and the Veil; Brak and the Choir, Nyx behind him, the Apex after an
    Exploit; Nyx and the Emberforge, the Apex and the Before; Dask's silence toward Nyx (D-112). Proposed: `refusesWhen`
    on the companion record, read by `companionAllowedAt`, plus each refusal line.
  - Dask's −30 for killing the Tyrant and +3 for sparing it need a hook in the Tyrant's data.
  - "Named" and "Unbound Hand" have no engine effect.
  - A refused Ledger offer hides the Keeper's Price, because U53's offer wins Dray's tie.

### D-114 · U34f details — companions refuse places; Dask and the Tyrant, 2026-10-22
- **U34f (ef664e9), C1 additions:**
  - companion `refusesWhen: [{when, text}]` and `traits: [{id, name, when, signatureTarget?, text}]`;
  - condition atom `region`, and companion `state: 'following'`;
  - communion `onSpared`.
- **Behaviour:**
  - `companionAllowedAt` takes the profile. A companion who refuses a place steps out with a line and waits at the
    previous node, or at home. They rejoin at the next node where they may stand, and are never fielded or swapped in where
    they refuse.
  - Dask loses 30 loyalty when the Tyrant is killed (its `onDefeat`) and gains 3 when it is spared (`onSpared`), whenever
    he is recruited.
  - With `echo_dask_rest`, Phase 3's Shear drops out of the cycle.
  - Named, from Blood and Salt's `spoke` stage, makes Hold the Line shield the party.
  - Unbound Hand is ruled flavour: no portal cost exists in the data to lower.
  - Dray's offers moved into `scene_dray_offers`, so a refused Ledger no longer hides the Keeper's Price.
- **Refusals written:** 12 lines (Ilyra 2, Brak 3, Nyx 3, Dask 1, Mireya 1, Caelum 2); five quote STORY verbatim.
  - Nyx refuses the Apex until `q_what_she_would_undo` is done.
  - Caelum refuses the Library until `q_a_boy_from_a_doomed_city` starts, and the Depths while the Heartbeat is active.
  - Mireya refuses to leave the Glowfen while `q_lantern_in_the_reeds` is active.
  - Mireya's "will not fight Mirelings" is not modelled, because it is not a place.
- 42 of 42 quest proofs pass, and 3,633 tests.

### D-115 · U56 details — the last companions; bundle size watch, 2026-10-22
- **U56 (59967d5, 13209f5 by ✦ Fable; finished as 23d837b by Opus):** Fable hit its model-specific usage limit while
  writing the tests, after the content and proofs were committed. Opus finished the tests without changing any prose.
  - Mireya's quests: `q_lantern_in_the_reeds`, `q_what_the_light_takes`, `q_preserve_or_heal` (dammed, dammed_dark or
    let_run).
  - Caelum's quests: `q_the_apprentices_errand`, `q_a_boy_from_a_doomed_city` (crossed or stayed), `q_his_masters_sin`
    (forgiven or cannot).
  - 28 scenes, 6 of them camp conversations. Caelum's answer to the Tyrant's Masque question is now in the communion.
  - Written words: 99 nodes, 2,644 words.
  - **All six companions are fully authored**: rule 18 is now 0. All 52 quest proofs and 3,668 tests pass.
- **Readings:**
  - "Bitterroot" is `item_antidote_root`.
  - The errand is offered at the Garret.
  - Mireya refuses places while her first quest runs (U34f).
  - "Elder Wen Hostile" and Lanternreed Bloom's Haste have no data form.
  - Without the bond Echo, neither companion reaches loyalty 25 in one loop → the balance unit, together with D-113.
- **Bundle:** production is 430.5 kB gzip against the 600 kB budget, up from 357 kB at U64, because content grows with
  every unit. The unminified e2e build (609 kB) is now exempt from the budget (`tools/build.ts`).
  - **Watch:** the remaining quests (22), codex (45) and UI screens may push production past 600 kB. If they do, load the
    content pack lazily or split it per region, rather than raising the budget.

### D-116 · U65 details — the Combat screen, 2026-10-23
- **U65 (6114016 by the first Opus agent; tests snapshot ab31ebf after a container restart, verified unchanged by a second
  agent):**
  - Enemy cards: sigil, HP split at phase thresholds, statuses, resistances once known, the intent chip with its damage
    range, `?` for a hidden intent, "then …" for a wind-up, and the foreseen next-next move.
  - Turn order, and banners for phase changes and boss `hpLines`.
  - The player panel shows what each incoming hit would do after Guard, and the flee odds. Fleeing the Tyrant asks for
    confirmation first.
  - The ability bar (1–9, costs, cooldowns, why a tile is off), targeting by tap or by ←/→, and an ally picker.
  - The companion card, with stance, Command and Hold.
  - The communion bar: Resolve as 8 pips, answers greyed with what they need.
  - A combat log that explains each hit, and summary dialogs.
  - `CreatureSigil`, plus 6 damage-type and 15 status icons (DESIGN §17.5).
- **Tests:** 41 UI unit tests; `combat.spec.ts` passes 12/12 on desktop and mobile (first_fight won by keyboard and by tap,
  the Bell-Warden's phase change, a communion Listen). 3,709 tests in all. Production bundle 447.8 kB gzip of 600 (D-115
  watch).
- **Deviations:** ←/→ cycle targets instead of Tab, because Tab stays the browser's focus key (D-035). Victory and flight
  show as a dialog over Explore, because the engine leaves combat in the same step (`CombatAftermath`).
- **Patterns:** `CombatAftermath` sits beside a screen in App. The Shell keeps focus on a dialog opened by a mode change.

### D-117 · U66 details — Dialogue, Journal, Codex, Bestiary, 2026-10-23
- **U66 (90991f5, Sonnet; spot-reviewed):**
  - The Dialogue screen: an `NpcSigil` bust, numbered choices, greyed reasons, companion reactions and a back-log.
  - The Journal: quests, objectives, rewards, reputation tiers and loyalty.
  - The Codex: each voice set in its own type (RA a serif with a drop cap, IT slab, WF italic and dashed, WN monospace on
    ruled paper). Locked entries are silhouettes with a hint that spoils nothing.
  - The Bestiary.
  - Lore on the Title screen, and gold quest rings on map nodes.
  - New shared pieces: `Tabs`, `MasterDetail` and `useListNav`.
  - Tests: 66 unit; `dialogue.spec.ts` 12/12 across desktop and mobile, and the full e2e run passes 43. Production
    bundle 461.7 kB gzip.
- **Rulings:**
  - Echo-locked answers grey out in real content, through `echoLocked()`'s `disabledWhen`. The fixture's `it_spoke`
    hides, because it has none.
  - Codex read state lives in its own localStorage key per profile, as a per-viewer UI convenience; it is not saved in the
    Profile.
  - Dialogue has no Esc, because the engine has no "leave" action.
  - The Journal, Codex and Bestiary buttons on Explore are stopgaps until U69's tab bar.
  - The only engine change is exporting `APEX_PROMPT_TEXT`.

### D-118 · U67 details — Inventory, Abilities, Merchant, Forge, Camp, 2026-10-23
- **U67 (0691eab, Sonnet; spot-reviewed):** five panels.
  - Inventory and Equipment: slots, the satchel, item cards and the stat change a swap would make.
  - Abilities: three branches by tier, unlock, respec, stat points.
  - Merchant: prices with the reputation modifier shown, refusals, quantity.
  - Forge: craft, upgrade with the affix choice, salvage.
  - Camp: rests and their time cost, camp conversations, *Let go* behind a confirmation.
  - `ItemIcon` shows rarity as a frame pattern, the word and a colour token; affixes are diamonds.
  - Shared pieces: `panelAction`/`useRunAction`, `ItemCard`, `QtyStepper` and `NeedList`.
  - Tests: `inventory.spec.ts` passes 9 tests on both desktop and mobile; 3,870 tests in all. Production bundle 484.4 kB
    gzip of 600 (D-115 watch).
- **Rulings:**
  - Abilities open with `k`, because WASD move on the map.
  - Camp opens from an ActionBar row ("Camp", or "The inn" at an inn).
  - The Explore rest rows stay as shortcuts.
  - Two real-pack-only scenarios were added: `loop1_respite` and `loop1_emberforge`.
- **Open → balance unit:** upgrading Common → Uncommon adds no affix slot, while a rolled Uncommon may carry one (DESIGN
  §7.3: "50% chance of one affix"). Decide whether the tier-up should offer the affix choice (§8.3).

### D-119 · U68 details — Threshold, Ending, Run Summary, Timeline, Achievements, 2026-10-24
- **U68 (4f20f02, b0006b6, 72c4619; Sonnet, spot-reviewed):**
  - The Threshold screen covers the engine's four places (Still Shore, Gallery, Loom, Far Light). DESIGN's "Archive"
    is a section inside the Gallery: Echoes held, by kind.
  - The Ending screen plays the slides and epilogues, then goes on to the Threshold or New Game+.
  - The Run Summary is a UI step after the last ending slide, because the engine leaves ending mode on the last
    acknowledge. It can be reopened from the Shore.
  - Loop Timeline and Achievements panels (hidden achievements show as "???"). Achievements is on the Title menu.
  - Tests: 73 unit; `threshold.spec.ts` passes 11 (+1 keyboard-only test skipped on mobile); 3,943 tests in all. Production
    bundle **496.9 kB** gzip of 600 (D-115 watch: about 100 kB of headroom left).
- **Gap → the achievement engine (balance / polish unit):** no engine code awards achievements yet. The panel reads
  `profile.achievements`, and the 13 `tally_*` counters (D-100) still need writing.
- **Reading:** at `loop2_end`, `meta.loop` is already 3 while the summary names "Loop 2" (the loop just ended). Correct.

### D-120 · U69 details — Saves, Settings, persistence, the mobile tab bar; the e2e gap, 2026-10-24
- **U69 (8bac922, 7f56bcd, a0a2d53; Sonnet, spot-reviewed):**
  - Persistence per DESIGN §14: `recoverInterrupted` at boot (`.tmp` leftovers), `.bak` restore of damaged slots, export /
    import (refused cleanly when invalid), `mergeProfiles` (§14.3; Resonance sums, capped at the summed earned total; a
    profile merged into itself counts once). Pure over a `StoragePort`.
  - Saves panel (empty / occupied / damaged slots, in-panel confirms); Settings panel (every field `Settings` has, applied
    live and persisted; volumes stored, labelled "no audio yet"; profile export/import/delete).
  - Tests: 56 unit + `persistence.spec.ts` (9, both viewports); 3,998 tests in all; full e2e 90 passed, 2 skipped.
    Production bundle **502.0 kB** gzip of 600 (D-115 watch: ~98 kB left).
- **Ruling — the mobile tab bar is DESIGN §16.1's** (Explore · Journal · Pack · Map · Menu), closing D-107. PLAN §6.8's
  Scene · Actions · Log · Map · Menu only switched regions of Explore and gave the panels no entry point. The bar shows in
  Explore only (Combat, Dialogue and the Threshold have their own layouts); bottom bar under 760 px, the same nav above the
  key legend wider. It replaces the Explore menu nav and the D-117 stopgaps. A new **Menu** panel lists Abilities, Codex,
  Bestiary, Timeline, Achievements, Saves, Settings, Keys and Return to title.
- **Rulings:** every non-Tyrant Flee now asks first by default (the `confirmFlee` setting); the Explore log shows
  `settings.logLength` lines (default 100, was a fixed 40); new `store.shell` extras `importProfile`, `exportSlot`,
  `previewImport`, `importToSlot`, `timestamp`.
- **Not built (C1 freeze):** keybinding remaps and screen-reader verbosity — `Settings` has no fields for them.
- **Open → U70/polish:** opening one panel from the Menu loses focus return, because `useFocusTrap` ignores a disconnected
  opener.
- **Process — the e2e gap:** `npm run check` runs only the `@smoke` e2e subset, so U68's Title-menu change broke the full
  suite's focus-order test (`title.spec.ts`) unnoticed until CI (fixed e988ae8). From now on the lead runs the full suite
  (`bun tools/build.ts --e2e && npx playwright test --grep-invert @screens`) after merging any UI unit, and briefs ask agents
  to run it too.

### D-121 · U70 details — onboarding, toasts, the Breach forecast; C4 playable, 2026-10-24
- **U70 (… 3394440; Sonnet, spot-reviewed):**
  - Callouts (DESIGN §16.8; once-only, skippable): intent, Guard (button lit), status, branching (Wildling Brute), camp (rest
    row lit), clock chip; Loop 2+: the Breach Clock and the Echo glyph only. The level-1 AP toast.
  - Toasts: rep delta/tier, Resonance "+n ◇", Echo gained, level-up, quest start/advance/complete/fail, item taken/given,
    achievement, Loop 2+ clock warnings. Repeats merge ("×n" or summed); 5 s (warning 10 s, error 12 s).
  - Map: a lighter forecast hatch from 5 dawns before the limit (nodes, edges, legend, note) over the Horde's spread rules;
    `breachOverlay()` feeds `SceneState.breachOverlay` for U71.
  - Focus: a fallback when the opener vanished (the Menu tab, else the heading) and a fix for focus left on a closed dialog
    (closes D-120's open item; the reported miss did not reproduce in Chromium).
  - Tests: +66 unit (4,064 in all); `onboarding.spec.ts` 9 on both viewports; full e2e 109 passed, 3 skipped. Production
    bundle **508.0 kB** gzip of 600 (D-115 watch: ~92 kB left).
- **C4 playable — reached.** The e2e plays a fresh Loop 1 from the Title through the UI alone to the Horde, the Fall, the
  closer and Loop 2's Breach Clock hint.
- **Rulings:**
  - "Tutorials: off" lives in UI persistence (`aethelgard.tutorials.off`; seen hints per profile), because `Settings` has no
    field for it (C1 freeze).
  - The Echo glyph callout fires in Loop 2+ (DESIGN §16.8 contradicts itself; Echo-tagged answers only exist from Loop 2).
  - With no status tooltip component, the first-status hint is a callout.
- **Gap → balance/polish unit:** DESIGN §16.8 forces the first Shade's intents (Wail, then Rake so Guard visibly halves it).
  No engine or creature data does this; the Shade runs Rake → Wail → Fade/Rake and the callouts show on whatever comes. Needs a
  first-fight `forcedIntents` hook (creature data or an encounter flag).

### D-122 · U57 details — the six regional quests, 2026-10-24
- **U57 (… 101f508; ✦ Fable, spot-reviewed):**
  - `q_bell_vault`, `q_bone_road`, `q_lightless_stair`, `q_the_drowned_lantern`, `q_high_mark`, `q_the_still_shore` in
    `quests/regional.ts` (+ 3 encounters) and `dialogues/regional.ts` (23 scenes); `q_echoing_heartbeat` stays U52's. 34 of 44
    quests authored.
  - Region hooks: Drowned Reach, Ashen Steppe, Voidscar, the Veil (a Blind hazard `lightless` on the Mouth and the Stair),
    Glowfen, Aether-Kissed Highlands, Skyreach, the Threshold (the Shore starts the quest; Gallery, Loom and Far Light events).
  - Written: 52 node texts, 23 choices, 20 journals, ~2,000 words, all pinned in `WRITTEN`; STORY lines verbatim (verse IV, the
    figure on the water §10.7, the six first journals).
  - Echoes granted: `echo_bell_vault` + `echo_archive_door`, `echo_steppe_waystones`, `echo_litany_verse_4` + `echo_hallows_ember`
    (+ `echo_iron_that_does_not_wish` with the mark), `echo_lightless_stair`, `echo_breach_clock` + `echo_high_mark`,
    **`echo_threshold`** (D-112's open grant, settled here) and `echo_six_in_the_mass` on looking back.
  - Tests: 27 unit; 10 new proofs (62/62 on the real pack); 4,101 tests in all. Pending: rule 16 38 → 28, rule 1 151 → 145,
    rule 2 12 → 6.
- **Rulings:**
  - Discoveries are interacts, not arrival scenes (an arrival scene would skip the place's fixed fight).
  - Bone Road ambushes: Bone Orchard (Brutes ×2) and Stormgate Cairns (Stalkers ×2); a Pan ambush was unwinnable under the salt
    glare. Borin hands over the mark at the Emberforge while the Road runs (WORLD §3.7), optional.
  - Dask offers the High Mark only before his Flickering Man is in the journal (keeps U55's pins).
  - The Still Shore is started by the Shore's event (a `startWhen` cannot tell the Threshold from the Ruins, D-082). Its Loom
    stage completes on arrival ("spend one Resonance" has no condition atom). Once per profile, `countsForApex: false`. The first
    walk to the Far Light now plays the "look back" scene (the Threshold e2e steps past it).
  - Hadda's Bone Road offer outranks her idle lines from Loop 2 (factions pins updated).
- **Gaps:** Phase negating the Stair's Blind has no data form (Nyx in the party and `echo_lightless_stair` do); the Lantern of
  Lanternreed is not an item (the boat is relit with one Glow Moss); Dray's Bell Vault offer loses its tie to an unaccepted Ledger
  offer (D-113's tie rule; the stair discovery covers it).
- **Balance → the balance unit:** two Stalkers at the Cairns beat a carried-over L10 Ranger about 1 in 2 (seed pinned
  `quest:bone:mark:1`); the Scriptorium guard and the Windward Stair's kites (band 12) kill L7–10 (the proofs flee them).

### D-123 · U58 details — loop-only and ending quests, the communion's words, the real ending scripts; C3 content, 2026-10-25
- **U58 (225b170, the lead's cutoff snapshot 34d5752, … 30a218d; ✦ Fable, spot-reviewed; resumed after a usage cutoff):**
  - Loop-only `q_the_thirtieth_dawn`, `q_what_the_crystal_heard`, `q_stop_the_ritual`, `q_the_first_drowned`; ending quests
    `q_wardens_vigil`, `q_the_mending`, `q_weavers_dawn`, `q_iron_silence`, `q_long_archive`, `q_unbound` (`quests/{loop,endings}.ts`,
    `dialogues/{loop,endings,tyrant}.ts`). **All 44 quests are authored.**
  - The Tyrant: question lines in Veyran's voice, a silence answer for every question (resolve 0; the gaps no longer need a
    forfeit blow), `nothing_left` below Resolve 3 (rejection, STORY §8.5), Movement III's Listen at Resolve ≥ 6 gives verse IX,
    `onSpared` opens the Resolution's words (`scene_ending_mending` / `_vigil` / `_unbound`), outcomes carry `questAdvance`.
  - Written: 79 scene nodes, 22 journals, 10 descriptions, 5 question lines and 9 answers, all pinned in `WRITTEN`; 54 story nodes
    verbatim; verse VII corrected to STORY §2.3.
  - **Real ending scripts** (`src/sim/scripts/endings/index.ts`, `npm run sim:endings`): escape, fall, A, B (from the
    `ending_b_ready` scenario), C, E and F reached by play; D a **known gap** (below). 72/72 quest proofs; 4,161 tests. Validate:
    rule 15 pending 3 → 0, rule 16 28 → 18.
- **C1 additions (minimal):** `EndingScript.profile?`; `run.ts` plays with `trained(pathBot)` and a profile; `playCommunion`
  settles an open dialogue; a `cli.ts endings` subcommand and `sim:endings`.
- **Rulings:**
  - `q_stop_the_ritual`'s attempts may come in any order, not one per reset (STORY §11.5 says one per reset).
  - STORY §11.6 D says "fight the Tyrant to Phase 2", but a phase's entry cannot carry a conditional effect (validator rule 11).
    The iron is offered through the communion's anchor Offer in any Movement instead (`scene_ending_silence`).
  - Keep-the-vigil (E) passes the days in the scene, because the Depths have no camp. The Dawn waves are ×2/×2 (the
    creature note said ×3). Dray's Thirtieth Dawn offer is in the `offer` band.
  - `echo_litany_complete` and `echo_anchor_schema` are granted by the offers (D-100 gap).
  - The e2e communion test now expects focus on the first answer that can be given, the silence (4e4d7ff).
- **Gap → the balance unit (high priority): ending D cannot be reached by play.** After Destroy, the anchor's materials,
  Borin and the Apex lie past the 19 dawns left. `scene_ending_silence` is proven on a constructed state. B's played road (pin →
  forge → Apex) is covered by unit tests only; its sim proof starts from the scenario.

### D-124 · Scene art: painted backdrops (Grok Imagine) under code overlays; U71/U72 re-scoped, 2026-10-24
- **Tim's ruling:** location scenes are **painted with Grok Imagine** (his SuperGrok subscription), not drawn only in code.
  Code-drawn SVG scenes would read as flat vector art; atmosphere matters for fun.
- **The split:**
  - Paintings: one backdrop per location (73), the Heartstone Depths' three state variants, and Title key art. 77 prompts in
    tiers (test batch of 4 → 24 story places → 49 others).
  - Code still draws what changes in play: time-of-day tint, particles, the Breach overlay and infection hatching, focal glows,
    creature sigils, item icons and status glyphs (U73 stays code).
- **The art session runs on Tim's PC**, from a separate Claude task linked to his computer (this cloud task cannot link). It
  follows `docs/ART.md` (style lock, region light lines, shot list, screening, delivery), shows Tim contact sheets for approval,
  and pushes WebPs (1440 × 600 + 720 × 300) to `public/art/scenes/` on `wip/art`; the lead merges.
- **Fallback is permanent:** own painting → a region-mate's painting (nearest by map distance) with the region tint → U64's
  parametric SVG. The game ships whole at any point in the art session.
- **Budget:** images are separate files, outside PLAN §1.1's 600 kB JS budget; target ≤ 160 kB per large WebP (~8 MB for the full
  set on Pages).
- **Units:**
  - **U71** (Opus) is now the backdrop system: manifest, `<picture>` under the overlays, the fallbacks, preloading exits,
    Title key art, high contrast, credits (`docs/briefs/u71.md`). Runs before or alongside the art session, with fixture images.
  - **U72** (Sonnet) shrinks to per-location overlay data: particles, focal glows, time-of-day per place, and the parametric
    fallback's silhouettes. Its brief is written after the test batch is approved.
  - Grok's usage terms for a public game are checked by the art session and noted in `docs/ART.md` §8.
- **Amended 2026-10-25 (art session, Tim's ruling): the backdrop style is dark-fantasy dungeon-crawler RPG pixel art, lightly
  pixellated** — not the painterly matte painting first specified. Grok renders the pixel art directly (crisp, fine grain);
  pixellating paintings in post was tried and rejected as muddy. `docs/ART.md` §3 holds the new style lock; the four Tier 0
  backdrops on `wip/art` are the pixel versions. For U71: the WebPs are ordinary 1440 × 600 / 720 × 300 images with the pixel
  grain baked in, so no `image-rendering` change is needed. U72's overlays (particles, glows) should stay soft and sparse so
  they sit on the pixel art without fighting it; U64's vector fallback will look smoother than its neighbours until painted.

### D-125 · U71 details — the painted-backdrop scene system; art Tier 0–1 merged, 2026-10-25
- **U71 (… 6ecc3e8; Opus, spot-reviewed):** `sceneManifest.ts`, `backdropChooser.ts` (fallback chooser, failure registry, exit
  preload list), `sceneLayers.tsx`, `SceneBackdrop.tsx`, `useBackdrop.ts`; `<Scene backdrop>` keeps U64's parametric scene as the
  fallback. Explore, Threshold, Ending and Title use it.
  - Tests: 20 unit + `scene.spec.ts` (9 on both viewports); 4,182 unit tests; full e2e 127 passed, 3 skipped.
- **Rulings:**
  - The manifest is **inlined** as an esbuild define: < 2 kB gzip for all 77 images (a unit test holds it), so there is no fetch
    and no SVG flash. `--e2e` builds use fixture art (`tests/fixtures/art/`); `--e2e --real-art` uses `public/art`.
  - High contrast: paintings in the Explore and Threshold frames dim to brightness 0.45; paintings behind text (Title, Ending) hide.
  - Smooth browser scaling is kept (scales are fractional; no `image-rendering: pixelated`). The Title uses the large file on a
    portrait phone (the `@sm` file blew up ~7× and blurred).
  - Under reduced motion the painted scene draws no particles. A failed image is not retried until reload.
  - `tools/serve.mjs` serves `.webp`; `react.d.ts` gained `picture`/`source`/`srcSet` typings. No C1 changes.
- **Art merged:** the art session's Tier 0 and Tier 1 (27 locations + title, 4.2 MB in `public/art`); the style is now
  dark-fantasy pixel art (Tim's ruling, `docs/ART.md` §3). Production JS **533.0 kB** gzip of 600 (D-115 watch: ~67 kB left — the
  growth since D-121 is mostly U57/U58's text). The lead's screenshots: the Title art and a borrowed region-mate backdrop
  (the Wayfarer's Respite shows Mistwood Path's) read well.

### D-126 · U72 details — overlays fitted to each painting; art complete, 2026-10-25
- **Art complete:** the art session delivered Tier 2 (every remaining location + the three Heartstone states): 73 locations, 3
  variants and the title, 11 MB in `public/art`, every file within ART §1's size limits.
- **U72 (… 532f22f; Sonnet, spot-reviewed):** `src/ui/art/overlays.ts`, a UI-side registry with one entry per location and
  Heartstone state, each written after looking at its painting. It sets particles (kind, area, rate; cap 24), at most one
  focal glow (a slow 9 s pulse), tint strength, and a pure `resolveOverlay`.
  - The Library portal marker shows once a Horde opens it (`SceneState.portalOpen`), and the aria-label says so.
  - Infection adds a `breach-dark` layer (0.3 × the breach value) under U70's hatch.
  - Tests: +22 unit (4,204); `scene.spec.ts` 28; full e2e 137 passed, 3 skipped. Production JS 537.2 kB gzip of 600 (D-115
    watch: ~63 kB left).
- **Rulings:**
  - The particle kinds `mist`, `dust` and `void_flecks` live UI-side only, because the frozen `art.particles` enum lacks them.
  - Reduced motion draws no particles (D-125). The glow and the portal marker stay drawn but do not pulse.
  - A scene may have two ambient motions (particles + the glow's slow opacity pulse), a deliberate exception to DESIGN §17.7's
    one.
  - The portal marker also shows on a borrowed painting (it is information); glow and tint do not.
  - High contrast keeps the hatch and hides the glow.
- **Fixed from the screenshots:**
  - The portal marker drew at the top-left, because a CSS transform overrode the SVG one.
  - Mist on the Drowned Stair looked like a grey moon.
  - Infection darkening buried the violet places (Chasm, Veil Mouth). The hatch is weakest on violet-on-violet but readable.

### D-127 · U59 details — the class mini-quests; `quests` complete; the Echoes still ungranted or unread, 2026-10-25
- **U59 (796cce7, cf5ab23; ✦ Fable, spot-reviewed):** `quests/classes.ts` (5 quests + 4 encounters: the Plaza duel, the
  Camp's three waves) and `dialogues/classes.ts` (21 scenes); `uniqueQuestId` on all five classes.
  - Hooks: two Mistwood events, three Silverwood Ruins events, one Voidscar event, and a `wall` choice in Brak's hub
    (`scene_brak_arc` → `scene_brak_wall_offer`).
  - Written: 58 nodes (~1,950 words; narrator 23, Nyx 11, Kaelen 8, Tamsin 7, Brak 5, Borin 4), all pinned.
  - Tests: 15 new (class and loop gates for all 5 × 5 classes and Loop 1); 80/80 quest proofs; 4,205 unit tests;
    `sim:endings` 8/8; full e2e 137 passed, 3 skipped.
- **`quests` leaves INCOMPLETE_TABLES** (49 quests, no pending reference). The lead also tried closing `dialogues`, `npcs` and
  `encounters`, which have no pending references. Closing `dialogues` made rule 16 strict and surfaced 5 errors, so the list
  stays `dialogues · npcs · codex · encounters` until the gaps below close.
- **Rulings:**
  - The class badge is the completed quest itself, read from the profile's run history (no engine field; C1 kept). XP 150.
  - The Ranger's "Kaelen's prices −5% this loop" is the `echo_kaelen_ledger` grant, because no loop-scoped discount exists.
  - Not modelled (no atom): the Weaver's hex is narrated; the Elf's "without taking a hit" (a win is a win); the Warden's
    dawn gate on Borin.
  - Nyx's and Brak's class offers wait behind their legacy offers (D-113's tie rule).
- **Open → U61/U62 and the audit — rule 16's 18 pending checks:**
  - **Granted by nothing:** `echo_breach_door`, `echo_hadrek_clockwright`, `echo_emberforge_vein`, `echo_nomad_signs`,
    `echo_hollow_path`.
  - **Read by nothing:** `echo_heartstone_triune`, `echo_ninth_verse_unfinished`, `echo_breach_recoil`, `echo_day_of_teeth`,
    `echo_tyrant_consent`, `echo_tyrant_rejected`, `echo_amulet_memory`, `echo_horde_path`, `echo_breach_door`,
    `echo_caelum_stayed`, `echo_crystal_seeded`, `echo_glowfen_dammed`, `echo_glowfen_let_run`.
  - STORY §12 says what each grants or unlocks. U62 (scenes) takes the ones its scenes give; whatever remains goes to the
    audit. When rule 16 has no pending items, close `dialogues`, `npcs` and `encounters`.

### D-128 · Creature sprites and character portraits (Grok Imagine); the combat stage; U73 split, 2026-10-25
- **Tim's ruling:** pixel-art **cut-out sprites standing in the scene** in combat, in the backdrops' style, instead of framed
  cards. Code alone left the figures as small sigils and outline busts, the weakest part of the look.
- **Art:** `docs/ART-2.md`, run from Tim's PC like Part 1, pushing to `wip/art`. 105 prompts in tiers:
  - 56 creature sprites. The 16 anomaly variants reuse their base sprite with a code effect, and the Redundant Wayfinder
    reuses the player's class sprite.
  - 5 class sprites and 6 companion sprites.
  - 38 portraits.

  Sprites are keyed out of a flat green or magenta background into transparent WebP, stored by size class (256 / 384 / 512 /
  768 px). Portraits are opaque 512 px busts.
- **Code keeps the small symbols:** the family sigil stays as a corner badge (shape for colour-blind players) and as the fallback
  for any missing figure; item icons, damage and status glyphs stay code.
- **Units:**
  - **U73a** (Opus, new): the combat stage (backdrop band, heroes left, enemies right, event-driven motion, sprite targeting),
    portraits in dialogue, Explore, the Bestiary and Class Select, the variant registry, fallbacks (`docs/briefs/u73a.md`).
    Builds with fixture art; runs before or alongside the art session.
  - **U73** (Sonnet) shrinks to the code glyphs (DESIGN §17.4–17.5) and the sigil polish; brief written after U73a.

### D-129 · U73a details — the combat stage, sprites, portraits; the first real figures; a new screen starts at its top, 2026-10-25
- **U73a (… 815cd8c; Opus, spot-reviewed):**
  - New: `src/ui/art/{sprites,spriteManifest,Sprite,Portrait,stageLayout,stageMotion}`, `components/combat/{CombatStage,stageModel}`,
    `styles/stage.css`.
  - Wired into Combat, Dialogue, the Explore rows, the companion chip, the Bestiary and Class Select.
  - The build reads each figure's size and warns when a height misses its size class.
  - Fixtures: 19 figures in `tests/fixtures/art/`. `cr_rootling` is left out so the sigil fallback stays tested.
  - Tests: 20 unit (4,247); `stage.spec.ts` 18; full e2e 155 passed, 3 skipped.
- **Rulings:**
  - Stage scale fits the tallest size class present, never below `large`.
  - Sprite buttons are named like their cards and kept out of the Tab order; the cards remain the keyboard and screen-reader
    control. `combat.spec` lookups are narrowed to `.combat__enemies`.
  - Variant effects beyond the brief: Frayed Brute and Paired Aberration doubled; Rootbound Pack and One-Herd tripled; Seeding
    Toad tinted. The Stutter Hound keeps its own sprite and also doubles.
  - A test-only `?start=session` boot (behind `__DEV__ || __E2E__`) starts from a stored state, for four-enemy, companion and
    anomaly fights that no content encounter makes.
- **Art merged:** ART-2's Tier 0, Tier 1 and part of Tier 2 (45 sprites, 1 portrait). Production JS **552.4 kB** gzip of 600
  (D-115 watch: **~48 kB left**).
- **The lead's review with real figures:**
  - The first fight, the Tyrant + Aberration and the Bell-Warden read well: heroes left, foes right, bosses large.
  - **Fixed:** a boss fight or a phone opened scrolled down to the focused Attack button, with the stage off screen. `focusView`
    now takes `fromTop`: a new screen scrolls to the top and focuses without scrolling (Shell; panels and sub-views unchanged).
- **Open → fun review / polish:** on a phone, the abilities sit below the fold under the stage and cards (a sticky action bar
  is worth trying).
- **Budget warning → U61/U62:** about 48 kB of JS headroom is left, and Codex II, the Echo lines, the scenes and the epilogues
  are mostly text. Before they push past 600 kB, split content per D-115 (e.g. lazy-load codex text and ending/epilogue text as
  separate JSON chunks); do not raise the budget.

### D-130 · U73 re-scoped to glyph coverage + the phone action bar; U61 brief, 2026-10-25
- PLAN §9.2's U73 work was mostly done along the way: U64/U65 `Icon` (the HUD, 18 statuses, 6 damage types), U65
  `CreatureSigil`, U67 `ItemIcon`, and U73a's sprites. **U73** (Sonnet) is now:
  - **A:** the art registry test (every item `art.icon`, status, damage type, sigil and `IconKind` drawn), legibility at real
    sizes in both themes;
  - **B:** D-129's open item, a pinned action bar on phones (Attack, Guard, Item, Flee, Abilities sheet; the communion takes the
    slot).
- **U61** (✦ Fable): Codex II (every §14 entry U60 didn't write, to STORY's 87), a rewrite of the 103 Echo `codexLine`s in
  the Wayfinder's voice (D-100), and `codex` off `INCOMPLETE_TABLES` when nothing is pending. It must stop and report if
  production JS would pass 590 kB (D-129).
- **Art:** ART-2 has delivered all 67 sprites and 7 of 38 portraits so far, merged.

### D-131 · U73 and U61 details; ART-2 complete; codex entries never unlock; the text budget → U62a, 2026-10-25
- **U73 (af26ad6, 3a7c117, 3dfc5c9; Sonnet, spot-reviewed):**
  - Art registry test: every item `art.icon` (12 glyphs added: bell, coat, badge, boots, moth, circlet, bloom, bowl, cake,
    ingot, crystal, anchor), status, damage type, sigil and `IconKind` is drawn.
  - Legibility: Slow is a snail, not an hourglass; Rewind is a counter-clockwise arrow round a clock hand; Shock's bolt is
    larger than Storm's; glyphs under 20 px use stroke 2.25; Legendary frames have four solid corner diamonds.
    These depart from DESIGN §17.5's Slow and Rewind for legibility.
  - **The phone action bar** (closes D-129's open item): under 760 px, Attack · Guard · Item · Flee · Abilities (a sheet)
    pinned in the dock with the player's HP and Focus; the communion takes the slot.
  - Tests: 4,268 unit; full e2e 162 passed (10 skipped: phone-only and desktop-only cases).
- **U61 (… 3554b9a; ✦ Fable, spot-reviewed):**
  - Codex II, 48 entries (`codex/{places,creatures,magic,items,loops}.ts`). The codex is now **90** (STORY's 87 + D-101's
    three). Voices: RA 15 · IT 11 · WN 13 · WF 9.
  - All 103 Echo `codexLine`s are rewritten in the Wayfinder's voice (≤ 40 words, no tooltip numbers).
  - `codex` leaves `INCOMPLETE_TABLES` (0 pending references); `dialogues`, `npcs` and `encounters` remain for D-127's
    rule-16 Echoes.
  - Hooks: the Dark Spellbook and Korr's marginalia unlock their entry on reading. Five §12 "codex" Echoes are added as
    alternates (`echo_hadrek_clockwright` → the Nexus entry).
  - `codex_breach_clock` is Wayfinder's Notes (§14.2's sample is first person; §14.1 says RA).
  - Production JS **575.2 kB**.
- **ART-2 complete:** 67 sprites and 38 portraits merged.
- **Found at the merge — codex entries never unlock (high priority):** the engine unlocks an entry only through an
  `unlockCodex` effect, and `unlockWhen` is documentation. Only 11 of 90 entries are an effect's target, so **79 can never
  be unlocked in play**, most of Codex I included. → **U62a** Part A: the engine evaluates `unlockWhen`, indexed by atom.
- **Budget:** production JS **577.7 kB** gzip of 600 after the portrait manifest; ~22 kB left, and U62 is text. → **U62a**
  Part B: long prose (codex bodies, dialogue text, ending text) moves to lazily loaded JSON chunks; target ≤ 520 kB (D-115:
  never raise the budget).
- The lead added the missing `region` hint to `codexModel.ts`.

### D-132 · U74 details — the audio engine and 30 synthesized SFX; e2e ports per worktree, 2026-10-26
- **U74 (… b105969; Opus, spot-reviewed):** `src/audio/{synth,sfx,map,engine}` and `ui/hooks/useAudio.ts`. The sounds are
  synthesized in Web Audio, with no audio files.
  - Buses: sfx, ui (follows the effects volume, since `Settings` has none), music and ambient (left for U75).
  - The event map has a row for every engine event kind, and an exhaustiveness test fails on any new kind without one.
  - Sounds follow the combat stage's 420 ms beats. A repeat within a beat plays once, a step plays at most 10, and at most 8
    voices sound at once.
  - Reduced motion only drops the combat hat ticks. Ctrl+M mutes.
  - The Settings volumes and mute are live, with a test sound 250 ms after a change.
  - The 30-sound table is at the top of `src/audio/sfx/sfx.ts`. DESIGN §18.3's combat kick and hat are two extra sounds.
  - `?audition` (dev/e2e builds only) plays every sound. A private artifact, "Aethelgard Sound Audition", lets Tim listen;
    nobody has heard them yet, so Tim's ear is the review.
  - Tests: 4,377 unit; `audio.spec.ts` 6; full e2e 168 passed, 10 skipped. Production JS **583.7 kB** (+6.0).
- **Process (D-106):** parallel worktrees shared e2e port 4173, and `reuseExistingServer` silently tested whichever build was
  already served. `playwright.config.ts` now reads **`E2E_PORT`**. Parallel units must each set their own; the lead uses
  4380.

### D-133 · U62a details — codex entries unlock by `unlockWhen`; long prose in lazy chunks, 2026-10-26
- **U62a (… 83fb881; Opus, spot-reviewed):**
  - **Part A, `src/engine/codexUnlock.ts`:** the last post-step hook evaluates the `unlockWhen` of each still-locked entry,
    indexed by the atoms it reads. It shares one unlock path with the `unlockCodex` effect (profile + `codexUnlocked` event, so
    toasts, Resonance and achievements follow).
    - A new game, a load, a new loop and New Game+ re-check every entry, so old saves unlock what they already qualify for.
    - Per-run unlocks, before → after: explorer 4.2 → 46.9, speedrunner 0.1 → 32.7, melee 0.1 → 30.5, caster 2.1 → 26.4,
      pacifist 0 → 19.2.
    - Sim cost +1.3% µs/step.
  - **Part B:** codex bodies, dialogue node text and ending slides/epilogues move to 15 hashed JSON chunks (codex, endings,
    dialogue per region + common), 71.9 kB gzip in all, outside the JS budget. The work is in `src/content/{tables,prose}.ts`
    and `tools/build.ts` (`__PROSE_MANIFEST__`), and `src/ui/text/{prose,TextLoading}`.
    - The UI shows a quiet loading line until a chunk arrives. Shell preloads the region's dialogue and the common chunk, and
      the endings chunk after 2 s; the Codex chunk loads when the panel opens.
    - The sims never need chunks: the same final state hash on the split pack.
    - In a split build, `dialogueNode`/`endingSlide` event text is a reference the UI resolves. A line that repeats a
      location event's words stays in the bundle (`sceneSaysIt`).
  - **Production JS 577.7 → 508.7 kB** gzip; **514.9 kB** with U74's audio merged (~85 kB of headroom for U62 and later).
  - Tests: 4,405 unit (`codexUnlock` 98, `textChunks` 14, `proseSplit` 4); `textChunks.spec.ts`; full e2e 170 passed, 10
    skipped; 80/80 quest proofs; `sim:endings` 8/8.
- **C1 notes (types only):** `PostStepHook` gains optional `(before, beforeProfile, action)`; `DialogueModel`, `CodexRow` and
  `EndingSlide` gain `loading`.
- **Git identity:** a merge made with the local default identity showed as Unverified on GitHub. The repo's git config is now
  `Claude <noreply@anthropic.com>`; amend any stray commit with `--reset-author` before pushing.

### D-134 · U75 details — region beds, the Threshold drone, the Tyrant theme; Fable writes only text, 2026-10-26
- **U75 (23d0c9c; Sonnet, spot-reviewed):** `src/audio/ambient/{recipes,layers,theme,ambient}.ts`. All 14 ambient presets in
  content have recipes: the 12 regions plus the Nexus and the Apex.
  - Beds crossfade over 2 s on a region change. Interiors play through a 1.1 kHz lowpass, and infection adds a tritone layer at
    or below −30 dB. At most 3 layers are alive at once.
  - The Tyrant theme follows DESIGN §18.4 on the music bus. Each phase adds to it (a 65 Hz saw, a doubled tick, detune drift).
    The communion thins it toward just intonation and stills the tick and swell. The bed ducks to 0.4 under it, and it fades
    over 2.5 s after the fight.
  - The Title and the endings are silent. Reduced motion drops the amplitude LFOs and the Apex gate.
  - `AudioEngine` gained `context()`, `levels()`, `reducedMotion()` and `subscribe()` (additive).
  - Tests: 4,524 unit (leak tests: 100 start/stop cycles leave no nodes); full e2e 176 passed, 10 skipped. Production JS
    **519.5 kB**.
  - Deviations from §18.2: a quiet octave under beds below 60 Hz, and +6 dB for narrow noise bands. Nobody has heard them;
    Tim's ear on `?audition` is the review.
- **Fable budget (Tim, 2026-10-25): Fable units write text only.** Tim is nearly out of Fable usage, and U62 had begun editing
  `src/engine` and `src/sim`, where debugging and long test output burn tokens.
  - The lead snapshot U62 (88b82d3) and narrowed it: polish the five new key scenes, write the endings' `sequence` and
    `epilogues` (slide `art` and `mood`), and write the lines §12 gives the loose Echoes. It runs only `npm run validate` and
    single test files.
  - From now on: **a ✦ unit writes prose and commits it; an Opus finisher does all wiring, engine changes, tests, proofs and
    verification after it.** If Fable runs out, the finisher completes the remaining text in the established voices.

### D-135 · `sfx_combat_start` replaced by Tim's pick; noise layers loop, 2026-10-26
- Tim found the combat-start sound (a 0.22 s drum and snap) too short, and wanted tones that say "an imposing challenge".
  A Sonnet agent drafted four (A Brass Swell, B War Drum & Horn, C Gong & Cluster, D Heartbeat) on a private audition page,
  "Combat Start Drafts". **Tim chose A.**
- **A, Brass Swell (1.72 s):** a C-diminished-with-tritone stack (C2 G♭2 C3 E♭3 G♭3), three saws ±9 cents each, scoops up
  through an opening lowpass and lands at 0.85 s on a sub thump and a lowpassed thud. It is in `src/audio/sfx/sfx.ts` with
  small held-sound helpers (`osc`, `swell`, `trim`). The swell's peak is halved and the note gains doubled, so every gain
  stage stays ≤ 0.5 (the sfx test's rule) at the same output. It also plays softer (vel 0.7) when a boss summons adds.
- **Bug fixed:** `noise()` read the 1 s noise buffer from a random offset up to 0.5 s, so bursts longer than ~0.5 s ran dry
  (`sfx_breach_tear`'s 2 s layer went silent early). Noise sources now loop.
- Process: sound drafts go to Tim on an audition page before they ship. Nobody can hear them in the container.

### D-136 · U62 + U62b — the key scenes, the endings' text, D-127's Echoes; **every content table complete**, 2026-10-26
- **U62 (✦ Fable, narrowed by D-134; 88b82d3 … c6cc489):**
  - The five missing §13 scenes (`dialogues/scenes.ts`): the Tyrant's defeat (Loop 2+ "You knew."), Brak's stand, Ilyra's
    portal, waking into Loop 2, the thirtieth dawn. Also 21 legacy Horde scenes.
  - All eight endings' `sequence` and `epilogues` against STORY §10, every slide with `art` and `mood`.
  - Echo variant lines.
  - Fable's own §13 test passes line-for-line for all 21 key scenes.
- **U62b (Opus finisher; … 1332ef0, spot-reviewed):**
  - **Fable's engine edits:** kept the scenes opened by the Horde, the expiry, the Amulet skip, the spellbook counter, the
    waking event and the portal arrival. Fixed `echo_ilyra_cost` (only when Ilyra isn't the active companion) and `pathBot`
    (it broke the Tyrant's first-words adoption; it now walks through only scenes its target doesn't speak in).
  - **Loop 2's first autosave:** a checkpoint reached inside a scene is now written when the scene closes.
  - **D-127's Echoes are wired.**
    - Grants:
      - `breach_door`: a Nexus event with the Lens and verse 1.
      - `hadrek_clockwright`: the Ninefold Hall on First Bell.
      - `emberforge_vein`: the third Emberforge visit in a loop, plus a once-a-loop "Work the ember vein": 3 ore, or 8 with
        the Echo.
      - `nomad_signs`: Ferrin's scene at Ironclad Neutral or better.
      - `hollow_path`: arriving at the Hollow.
    - Reads:
      - `heartstone_triune` → `recipe_breach_anchor_triune`, a 31st recipe: the anchor without a Heartstone piece.
      - `caelum_stayed` → the Mending without Caelum (a pin scene alone, +3 days).
      - `crystal_seeded` → the Library's Listen gives `nine_voices`.
      - `ninth_verse_unfinished` and `breach_recoil` → Movement I answers, +1 each.
      - `horde_path` → the map shows the Horde's next three moves.
      - `breach_door` → the Breach-door route from Loop 2 without the Lens.
  - **`INCOMPLETE_TABLES` is empty: every content table is complete.** `validate`: 0 errors, 0 pending.
  - The Ending screen shows each slide over its painting. The ending proofs show every slide (7/7 N/N; D the known gap).
  - Tests: 4,559 unit (`endingsText`, `echoHooks`); full e2e 176 passed, 10 skipped; 80/80 quest proofs. Production JS
    **523.1 kB**; text chunks 75.0 kB.
- **For the fun review / audit:**
  - The `breach_recoil` answer ("I named nothing; I only held") reads as Veyran's voice more than the Wayfinder's; reread it.
  - STORY §10.2's "Nyx, if present, closes his eyes" has no slide (slides aren't conditional).
  - The Horde forecast is empty during the Horde's 3-move delay.
- **Cost note:** U62b took ~1.6 h, the longest Opus unit so far. It reviewed another unit's engine edits, wired 18 features,
  and ran the slow full suites. Next time, split a finisher this size in two.
