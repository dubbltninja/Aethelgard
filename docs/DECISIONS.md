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
