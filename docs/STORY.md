# STORY.md — Echoes of Aethelgard: The Unraveling

*Narrative design. Elaborates DECISIONS.md (D-001..D-040); never overrides it. Where this
document names a new location, NPC, or item, treat the name as a proposal for WORLD.md unless
DECISIONS already fixes it.*

**Id conventions.** Quests `q_*`, Echoes `echo_*`, scenes `scene_*`, codex `codex_*`, endings
`ending_*`, loop-closers `closer_*`. DECISIONS writes Echoes as `echo.litany_verse_1`; this
document uses the snake_case form `echo_litany_verse_1` for the same Echo. Conditions are
written in the D-033 language.

**Legacy marking.** In Loop 1 material, lines marked **[legacy]** are quoted from
`echoes_of_aethelgard.py` / `aethelgard_data.py` and must be kept verbatim (one typo fix noted).
Lines marked **[new]** are connective tissue written for the rebuild.

---

## 1. Premise and themes

Five hundred years ago, nine mages stood in the Ley Line Conflux beneath the capital of
Silverwood and tried to hold an hour still. The hour tore. The Great Sundering folded the
kingdom of Aethelgard into ruin, wild magic, and three quarrelling peoples. At the heart of the
wound, where the Temporal Breach opens at the Apex, something has stood ever since: a towering
figure of rippling time, skeletal limbs and crystalline shards surfacing and vanishing in its
mass. The Remnants named it the Chronos Tyrant. Every Wayfinder who ever reached it died.

You are the eighth Wayfinder. You arrive at the Whispering Ruins with no memory of why you were
pulled there, pick up an amulet in the first room, help a scholar listen to the past, clear a
mountain for a scout, gather three shards for a shadow, choose what to do with the beating
Heartstone, and climb to the Apex to kill the Tyrant. You kill it. The world ends. A friend dies
holding a doorway. Another holds a portal open with her hands. You step through and wake on the
first morning with the amulet warm at your throat, and the scholar asks you the same question
she asked before.

The Tyrant was the jailer. It is Archmagus Veyran Thal, leader of the Nine, who stepped into the
tear and has held it shut for five hundred years, existing at every instant of his failed ritual
at once. Killing him removes the only containment. He cannot say so to anyone who has not
crossed the Breach. Now you have.

**Themes, and how the game argues them:**

- **Ambition and cost.** The Nine wanted to command time and paid with the world. Every power
  the player takes (Dark Spellbooks, the Heartstone Core, Void Shards) costs vitality, days, or
  trust, and the costs are shown, not described.
- **Preservation vs healing.** The Remnants want to keep; the Glowfen want to stay what they
  are; Ilyra can hold a door open forever. The game asks whether holding is the same as mending,
  and lets the player answer either way (endings E and B are both honest).
- **What you owe to a world that made you.** Wayfinders are not chosen; they are a symptom, the
  ley network's fever. The player can refuse the debt (ending F) and the game does not punish
  them. It only reports what happened to everyone else.
- **The jailer mistaken for the tyrant.** The first thing the player kills is the one thing
  keeping them alive. Every faction is wrong about Veyran in a different way, and the loop exists
  so the player can be wrong first, and then not.

The register is grave and strange, never grim-dark. People are tired, decent, and mistaken.
The land is beautiful where it is broken. No one is punished for ambition except by its
consequences.

---

## 2. Backstory — the true history

### 2.1 Silverwood at its height

Silverwood was the capital of the kingdom of Aethelgard and the seat of its mages. It stood
where the ruin-field stands now (D-023): a walled city on the ley confluence, white marble and
silver-barked trees, libraries "filled with secrets of the cosmos" **[legacy lore]**. Its heart
was the Plaza with its fountains and bells; its mind was the Library and the Archive beneath it;
its engine was the Conflux, a chamber under the Archive where every ley line in the kingdom met
in a living core the Circle called the Heartstone.

The Circle of mages that ruled Silverwood's learning was never a council of nine by law. Nine is
how many stood in the Conflux on the last night. The Remnants call them the Ninefold Circle, or
the Nine, and the Shadow Weavers call them the same with a different tone.

### 2.2 The Ninefold Circle

Four names are fixed by D-006. Five are new. Each has a role in the ritual (a verse of the
Litany), a trace in the present, and a one-line fate.

| # | Name | Role in the Circle | Verse | Trace in the present | Fate (one line) |
|---|------|--------------------|-------|----------------------|-----------------|
| 1 | **Veyran Thal** | Archmagus; leader | 9 · The Holding | The Chronos Tyrant | Stepped into the tear and is still speaking the ninth verse. |
| 2 | **Nyxaria Vell** ("Nyx") | Theorist of the Void | 8 · The Dark Between | Herself, in the Chasm of Whispers | Flung 500 years forward by the recoil; arrived Year 460. |
| 3 | **Oriel Danthe** | Archivist; the Witness | 1 · The Witness | The Litany record (Scholar's Lost Scroll), the Echo Crystal, the Sunken Archives; the First Drowned | Ran with the record; drowned when ley-water rose through the Archive; bound to her pages. |
| 4 | **Maelis Korr** | Author of the Dark Spellbooks; the Lesson | 2 · The Lesson | Dark Spellbooks; the Corrupted Shades (his students) | Pulled into the tear; his hand still writes in the margins. |
| 5 | **Haldric Vane** | The Warder | 3 · The Warding | Stone-Hide Golems; the Blighted Outpost (once "Vane's Watch") | Pulled into the tear; his golems still hold his last order: *guard*. |
| 6 | **Durn Hallow** | The Smith; forged the Heartstone's cradle | 4 · The Cradle | The Emberforge; the Ironclad's fire and their proverb; Hallow's Cairn on the Ashen Steppe | Said "Stop." Walked out at the sixth verse; died on the Barren Peaks carrying a forge-ember north. |
| 7 | **Seraphine Aulde** | The Spire-builder; the Resonant | 5 · The Spire | Aetherium Spires; Aetherial Weavers (her loom-strands); Aetherium Shards | Pulled into the tear; the Spires hum her one note. |
| 8 | **Imre Sallow** | Life-mage; the Breath | 6 · The Breath | Veridian Glowlands and the Glowfen; Glowfen Mirelings; Glow Moss; the Breathing Pool | Pulled into the tear; the Glowlands glow because her breath still leaks. |
| 9 | **Tovren Masque** | Astronomer; the Eye | 7 · The Eye | The Chronos Nexus (his observatory); the Chronos Lens; Temporal Aberrations (his watch-wardens) | Saw the failure before it came and said so; pulled into the tear, still looking. |

**Who is in the Tyrant.** Six: Thal (core), Korr, Vane, Aulde, Sallow, Masque. They are the
"skeletal limbs and crystalline shards" **[legacy]** in its mass. Each bleeds down the ley line
they were holding, and what they bleed shaped a place or a creature family: Korr's students
became Corrupted Shades, Vane's wards still walk as Stone-Hide Golems, Aulde's strands spin as
Aetherial Weavers, Sallow's breath lights the Glowlands, Masque's watch-wardens flicker as
Temporal Aberrations. Vell was flung forward. Danthe drowned. Hallow walked.

**Characters in brief.**

- *Veyran Thal* was not a monster. He was the most gifted mage of his age and knew it, kind to
  apprentices, impatient with limits, certain that a mind large enough could hold anything. He
  called the ritual "the Holding" because he did not intend to break time, only to keep one
  hour still long enough to study it. He has had five hundred years to learn what he is.
- *Nyxaria Vell* was the youngest of the Nine, the only one who had thought carefully about the
  dark between moments, and the only one who said, afterward, that she had known. She did not.
  She wanted to.
- *Oriel Danthe* believed a thing recorded could not be lost. She set the Echo Crystal to hold
  the Litany as it was spoken and died carrying the written copy. The Remnants' wax seal is her
  seal.
- *Maelis Korr* wrote everything down and read everything twice. His workbooks are the Dark
  Spellbooks. He believed knowledge was a debt that must be paid forward; the books collect it.
- *Haldric Vane* trusted stone over people. His golems were built to shrug off the ritual's
  backlash, which is why magic "skitters off" them **[legacy]**. He set them to guard the
  northern ley-knot and they have not stopped.
- *Durn Hallow* was the Circle's smith, a plain man who made the iron cradle that held the
  Heartstone during the rite. He asked for it to be "iron that does not wish," and he was the
  only one who, when the stone cracked, said stop and meant it. The Ironclad are, without
  knowing it, his people.
- *Seraphine Aulde* raised the Aetherium Spires as tuning forks for the ley. She loved one note
  above all others and the Spires still hold it.
- *Imre Sallow* was a healer and a gardener who agreed to the rite only if the overflow could
  be given to living things instead of stone. It was. They are still carrying it.
- *Tovren Masque* built the observatory at the Nexus to read the sky during the Holding. He
  read it. It said *no*.

### 2.3 The Litany of the Conflux

The Litany is the ritual's spoken structure: nine verses, one per station, one per voice,
spoken in order in the Conflux chamber at dusk on the last day. Each verse binds a distant
station (Vane's wards, Hallow's cradle, Aulde's Spires, Sallow's Green, Masque's Eye) to the
Heartstone. Oriel's first verse is why the Echo Crystal recorded it; Veyran's ninth is still
being spoken. The player collects verses as Echoes (`echo_litany_verse_1` .. `_9`); knowing all
nine grants `echo_litany_complete`.

Register: plain, archaic, unrhymed. These are the canonical texts.

**I. The Witness** (Oriel Danthe)
> Let it be written as it is done.
> Let the hand fail and the word stand.
> What we do here, we do before the stone.

**II. The Lesson** (Maelis Korr)
> What is read is owed.
> We have read, and we have paid, and we are not done paying.
> Let the debt be carried into the hour.

**III. The Warding** (Haldric Vane)
> Stone, stand where flesh would fall.
> Keep the line and hold the gate.
> Meet what comes without fear, for you have none.

**IV. The Cradle** (Durn Hallow)
> Iron that does not wish, hold the heart.
> Take the weight and do not want it.
> What the hand would grasp, let the cradle only carry.

**V. The Spire** (Seraphine Aulde)
> Rise, lines, and be lifted.
> Sing the one note the world was tuned to.
> Let the sky hear what the ground has always known.

**VI. The Breath** (Imre Sallow)
> Green, take what the stone cannot.
> Breathe in what burns; breathe out what grows.
> Let what lives carry what does not.

**VII. The Eye** (Tovren Masque)
> Read the sky before it is written.
> See the hour from its far side.
> Tell us true, and we will not turn away.

**VIII. The Dark Between** (Nyxaria Vell)
> There is a dark between one moment and the next.
> We name it, and so we may enter it.
> Open, and be entered.

**IX. The Holding** (Veyran Thal)
> Hour, stay.
> Be as you are, and do not become.
> I hold you. I hold you. I hold—

The ninth verse has no last line. In the Warden's Vigil the Wayfinder supplies it ("—I hold
you."). In the Mending it is answered with a different word ("Hour, go.").

### 2.4 The night of the Sundering

Silverwood kept time by the Plaza bells. The Remnants reconstructed this sequence from Oriel's
record and the Echo Crystal; it is canon.

- **Dusk, the ninth bell.** The Circle descends the Archive stair to the Conflux. Oriel sets the
  Echo Crystal on its stand and takes her place at the circle's edge with ink and the record.
  Caelum Vesper, Veyran's errand-boy, is sent up the stair with a message for the Spire Yard; he
  is on the third step when the first verse begins. The Heartstone's beat is slow and even.
- **The first verse.** Oriel speaks. The Crystal wakes. (This is why it holds nine voices.)
- **The second and third verses.** Korr; Vane. The northern ley-knot answers; far away, the
  golems of Vane's Watch turn to face outward. The Heartstone brightens.
- **The fourth verse.** Hallow. The iron cradle takes the stone's weight and the chamber sings
  a low note the Plaza bells pick up and ring back. The city, above, thinks it is a festival.
- **The fifth verse.** Aulde. The Spires in the east answer with her note. The sky over
  Silverwood goes silver-white. Children are lifted onto shoulders to see it.
- **The sixth verse.** Sallow. The Green takes the overflow. The first crack opens in the
  Heartstone, a hairline, with a sound like a tooth breaking. Hallow says: "Stop." Veyran says:
  "It holds." Hallow says: "It is *held*. That is not the same." He steps out of the circle,
  takes an ember from the brazier in his bare hand, and climbs the stair. No one follows. His
  verse is already spoken; the Litany does not need him to stay.
- **The seventh verse.** Masque, reading the sky through the Lens from the Nexus-link in the
  chamber wall. He says, flatly, "It fails. I can see the hour from the far side and in it we
  are not here." Veyran: "Then we read it again." Masque reads it again. It says the same.
- **The eighth verse.** Nyxaria names the dark between. A seam opens above the stone, black,
  without depth. She feels the recoil begin in her teeth and does not say so.
- **The ninth verse, first line.** "Hour, stay." The Heartstone bursts its cradle. The seam
  widens into the Breach. The recoil, finding the one mind that has named the dark, throws
  Nyxaria Vell forward five hundred years. Veyran shouts to Oriel: "Carry it out!" She runs
  with the record.
- **The ninth verse, second line.** "Be as you are, and do not become." The Breach begins to
  swallow the chamber. Veyran Thal looks at it and understands, exactly and too late, what it
  will do if nothing stands in it. He steps in. He speaks the third line.
- **He is still speaking it.**

### 2.5 Veyran's choice, and Nyx's recoil forward

Veyran's choice was not to die for the world. It was smaller and more in character: he could not
let the thing he had made run unwatched. He stepped into the tear meaning to *hold* it, as the
verse says, until he found the flaw and corrected it. The Breach took him at his word. He exists
now at every instant of the ritual simultaneously, in pain that does not vary, with five mages'
remains surfacing through him, holding a wound shut with a sentence he has not finished. He has
watched seven Wayfinders die. He has not been able to tell any of them anything, because the
Breach only lets him speak to what has crossed it, and until now nothing that crossed it
survived.

Nyxaria arrived in the Voidscar Hollow in Year 460, where the void is thinnest, naked of
everything but her name and the Litany in her head, with eyes that now held "quiet starlight"
**[legacy]**. She was perhaps thirty. The Breach-touch has slowed her; she looks fifty. She
found a four-hundred-year-old cult already collecting Void Shards in the Chasm, told them what
the Shards were, and let them call her prophet. She wants the Breach fully open so she can go
*back*, to the chamber, to the sixth verse, and say what Hallow said with a reason attached.
She believes it will work. It will not (D-016; ending C).

### 2.6 What happened to Silverwood

The shear ran out along the ley lines within the hour. The towers "folded into impossible
angles" (the Apex still does **[legacy]**). The Archive flooded as ley-water rose through the
vaults; Oriel drowned in her carrel with the record sealed in her own wax. The Plaza cratered
and its fountains have seeped mist since. The Spires cracked and did not stop humming. The
golems at Vane's Watch locked into their last order. The Green drank the light and glows. The
dome of Masque's observatory shattered. Hallow died on the Barren Peaks two days later, the
ember still alight in a clay bowl; his apprentices carried it north.

By dawn the Breach had "closed" to a scar at what is now the Apex. It closed because a man was
standing in it. The Sundering, as the scroll says, "was merely its catastrophic echo"
**[legacy]**.

### 2.7 The three factions over five hundred years

- **The Remnants of Aethelgard** are the scholars who dug the Archive out. They took Oriel's
  seal, began the count of years ("Year 500 of the Sundering," D-025), and kept the Ledger of
  Wayfinders. They named the Tyrant in Year 44 after the first Wayfinder died, reasoning that
  whatever stood at the heart of the Breach must be its cause, and that it tyrannized the hour.
  They believe understanding the past heals the present. Their instinct, under pressure, is to
  hold still.
- **The Shadow Weavers** descend from Silverwood's lesser mages who went down into the Voidscar
  because the void there was thin enough to touch. They found Void Shards ("tears from the
  Breach," **[legacy]**) and built a rite around them, the Hollow Choir, in the Veil beneath the
  Chasm. One Wayfinder (Ysolde Marr, Year 243) was theirs; she was Taken and they call it
  ascension. Nyx has led them for thirty years and lies to them gently.
- **The Ironclad Nomads** are the city guard and Hallow's forge-hands who fled north with the
  ember. They relit it in a canyon they named the Emberforge and have never let it go out. They
  take an oath and drop their family names for clan-names (D-022). Their proverb "Steel sings
  louder than fear" **[legacy, Borin]** is Hallow's last recorded saying. Their defining memory
  is the Day of Teeth (Year 178), when a Wayfinder wounded the Tyrant and a horde of
  time-things came out of the Apex for one day; twenty Nomads held it with steel. They believe
  the lesson is that the Tyrant must be killed *properly*.

### 2.8 The seven previous Wayfinders

Wayfinders are born when the containment weakens (D-007). The Remnants' Ledger lists seven. All
died at or near the Apex. The Tyrant watched each.

| # | Name | Year | Class / temperament | Death |
|---|------|------|---------------------|-------|
| 1 | **Sael Orrin** | 44 | Silverwood-blooded duelist (Elf); proud | Went to the Apex alone, cut at the Tyrant, and was unmade by a chrono-strike. His death got the Tyrant its name. |
| 2 | **Hesper Vayle** | 110 | Wandering healer (Ranger, Wildcraft); gentle | Reached the Apex and would not strike. Sat down before the Tyrant and died of the shear, unspoken to. |
| 3 | **Corwen Blackreed** | 178 | Ironclad warrior; stubborn | Brought twenty Nomads. Wounded the Tyrant; containment slipped for a day (the Day of Teeth). Died in the horde he let out. |
| 4 | **Ysolde Marr** | 243 | Shadow Weaver; hungry | Tried to take the Tyrant's power into herself. The Breach took her instead. The Weavers call her the Taken. |
| 5 | **Pell Ashcombe** | 309 | Scholar (Wizard); careful | First to count the days. His notes name "the thirtieth dawn." Died at the Apex of the shear without ever fighting. |
| 6 | **Rook Tallis** | 371 | Hunter (Ranger); wary | Turned back at the Apex. The pull brought him back a year later; died in the Nexus under the broken dome. |
| 7 | **Dask** | 430 | Ironclad-trained scout turned loner (Ironclad Warden); dry | Saw what the Tyrant was and would not kill it. Tried to speak to it. A chrono-strike scattered him across moments. He is the Flickering Man. |

The player is the eighth. Gap to Dask: seventy years, as D-025 requires.

---

## 3. The present — Day 1, Year 500

### 3.1 State of the world

Aethelgard is "a patchwork of isolated settlements, dangerous wilderness, and ancient,
magic-infused ruins" **[legacy lore]**. The ruin-field of Silverwood is the Remnants' ground;
Mistwood and the Reach belong to the Nomads' nearest camp; the Voidscar and the Veil beneath it
to the Weavers; the Aether-Kissed Highlands to no one; the Glowlands and the Nexus to the fen
folk and the dead. Beyond the legacy map lie the Drowned Reach under the Archives, the Ashen
Steppe where the Nomads range, the Glowfen past the Glowlands, and the Skyreach above the
plateau (D-015). Trade runs through Kaelen Stonehand's Respite, which is neutral ground (D-014).

### 3.2 Why the Breach is failing now

Veyran has been speaking one sentence for five hundred years and the Heartstone, which anchors
his hold, has begun to beat out of step with it. A Remnant with a water-clock can measure it: the
Heartstone's pulse and the Apex's flicker drift apart by a little more each day. When they fall
fully out of phase, the hold breaks whether or not anyone touches the Tyrant. By Pell Ashcombe's
count and by the engine's, that is **the thirtieth dawn** (D-005). The ley network, sensing the
weakening, has produced a Wayfinder, as a body produces fever. That is you. You feel it as "an
inexplicable pull" **[legacy lore]** toward the Ruins.

Nobody alive knows this on Day 1. Ilyra knows the whispers are "louder each day." Brak knows
the east "feels wrong." Nyx knows exactly what the thirtieth dawn is and has not told anyone.

### 3.3 Where every named NPC is, and what they want

| NPC | Where | Wants (stated) | Wants (true) |
|-----|-------|----------------|--------------|
| **Ilyra** (~30, Remnant scholar) | Whispering Ruins | The Echo Crystal from the Shattered Library; her lost scroll from the Sunken Archives | To understand why she hears the whispers more clearly than any Remnant should. She descends from Oriel Danthe and does not know it. |
| **Brak** (~40, Ironclad scout) | Ironclad Camp | The Barren Peaks cleared; the Blighted Outpost cleared | The camp moved west before whatever is in the east arrives. To not think about his brother. |
| **Nyx** (Nyxaria Vell; here 40 years) | Chasm of Whispers | Three Void Shards | The Breach opened wide enough to walk back through. A Wayfinder strong enough to help. |
| **Kaelen Stonehand** (~44, trader) | The Wayfarer's Respite | To trade fair and not waste words | To know whether Brak is still alive without asking anyone. |
| **Borin Stonefist** (~55, Ironclad smith) | The Emberforge | Coin and patience | To keep the fire lit. He suspects the forge is older than the Nomads and does not like what that implies. |
| **Dask** (the Flickering Man; dead 70 years) | Shimmering Pass (glimpsed); the Highlands, Nexus, Apex, Threshold | Nothing. He is between instants. | To tell the next Wayfinder not to do what he nearly did. |
| **Mireya of Lanternreed** (Glowfen herbalist) | Lanternreed, in the Glowfen | Glow Moss, help with the sick | To know why her people's skin has begun to shine. |
| **Caelum Vesper** (apprentice, ~16) | Silverwood Before, on the Archive stair | To deliver Master Thal's message to the Spire Yard | To be allowed back into the chamber. |
| **Keeper Ansel Dray** (new; Remnant elder, ~70) | Shattered Library reading-room camp | The Ledger of Wayfinders kept; the Litany recovered | The loop made deliberate (ending E). He has read Ashcombe's notes. |
| **Hadda Ironvow** (new; Ironclad warchief, ~50) | The Ring of Wagons, Ashen Steppe | The east cleared; the Day of Teeth avenged | The Tyrant killed "properly" (ending D by her lights). |
| **Sethe the Unlidded** (new; Weaver lieutenant) | The Hollow Choir, the Veil | The Choir's rite completed | To see what Nyx has seen. |
| **Elder Wen Thistlecourt** (new; Glowfen elder) | Lanternreed | The old ways kept | The glow kept, whatever it costs. |

### 3.4 What each faction believes about the Tyrant, and how each is wrong

- **Remnants:** *It is a thing born of or guarding the Breach; the Breach is a wound to be
  studied and held closed.* Right that it contains the Breach. Wrong that it is a thing; wrong
  that holding is healing. Their ending (E) makes the hold permanent and calls it peace.
- **Shadow Weavers:** *It is a gatekeeper hoarding the Breach's power; the Breach is an
  opportunity.* Right that the Breach can be entered and that the Shards are its tears. Wrong
  that power waits on the far side; Nyx knows this and lets the Choir believe it because she
  needs them. Their ending (C) opens the gate and finds the same failure waiting.
- **Ironclad Nomads:** *It is a monster; magic is the disease; kill it properly and the land
  heals.* Right that steel can hold a line and that the ley can be cut (ending D works). Wrong
  that killing it saves anyone, and wrong about where their own fire came from.

---

## 4. Loop 1 — "Echoes of Aethelgard" (the legacy story, preserved)

Loop 1 is the original game, intact, with a subtle day counter and a handful of new lines that
only read as foreshadowing on a second pass. Classic game-over applies (D-002). The Apex opens at
six completed quests; the Heartstone opens at two (legacy gates, kept).

### 4.1 Beat-by-beat

1. **Waking in the Whispering Ruins.** "The air smells of ozone and decay, and a chill wind
   carries faint whispers..." **[legacy]**. Event: "A low, resonant hum vibrates under your skin,
   as if the stones are breathing." **[legacy]**. The Amulet of Echoes lies among the tablets; the
   player takes it. Class intro line **[legacy]** per class; Ironclad Warden and Shadow Weaver get
   new intros in the same shape. Day counter reads "First dawn." **[new, subtle]**
2. **Ilyra** (`scene_first_meeting_ilyra`): "The whispers here are louder each day. The past is
   trying to speak. Will you help me listen?" **[legacy]**. Accept → `q_echo_crystal`. Refuse →
   "Ilyra nods, her eyes shadowed with disappointment." **[legacy]**
3. **North.** Crumbling Archway: "A whisper slips through the archway: 'Wayfinder... follow.'"
   **[legacy]**. Darkened Corridor: Corrupted Shade (drops a Dark Spellbook). Shattered Library:
   Arcane Wisp; "A cold gust rattles the shelves, and you smell old ink and rain." **[legacy]**;
   the Echo Crystal in an alcove behind a fallen shelf **[new detail: the alcove, so
   `echo_crystal_location` has something to shortcut]**.
4. **The Crystal choice** (`scene_echo_crystal`): "You found it. Will you share its truth with the
   Remnants?" **[legacy]** → Give: "Ilyra cradles the crystal, whispering a prayer." / "You gain
   the Remnants' trust." **[legacy]** (Remnants +15; `echo_litany_verse_1` granted on the *next*
   conversation, D-017). Keep: "You tuck the crystal away, its whispers now yours alone." / "The
   Shadow Weavers' influence stirs within you." **[legacy]** (Weavers +10, Remnants −10).
5. **The Scroll.** Ilyra asks for her lost scroll **[legacy]** → `q_lost_scroll`. Sunken Archives:
   "A submerged page unfurls, whispering of the Ley Line Conflux." **[legacy]**; the Drowned
   Archivist guards the Scholar's Lost Scroll. Return: the legacy revelation paragraph ("It
   speaks of a desperate ritual at the Conflux... only contained by something ancient and
   terrible.") **[legacy, keep whole]**. +1 MAG, Mana Bloom.
6. **"A Distant Pulse."** After two completed quests: "A deep heartbeat rolls through the ruins,
   calling you downward." **[legacy]** → `q_echoing_heartbeat`; Heartstone Depths unlocks.
7. **East to the Ironclad.** Mistwood Path; the Respite (Kaelen: "Steel and salt are all that keep
   you breathing out here." **[legacy]**); Ironclad Camp: Brak: "Magic twists the wilds. We survive
   by steel and stubbornness. Prove your worth, Wayfinder." **[legacy]** → `q_clear_path` (Wildling
   Brute; Ironclad Mail) → `q_blighted_outpost` (two Stone-Hide Golems; Ironclad Plate Armor, +15
   max HP; "Brak clasps your forearm..." **[legacy]**). The Emberforge: Borin upgrades gear.
8. **The Chasm.** Nyx: "The void remembers you. Its shards wait in the hollow to the east, where
   the corruption thickens." **[legacy]** If the Crystal was kept: "The echo you kept drew me here.
   The void has tasted you already. Its shards lie to the east." **[legacy]** → `q_void_shards`;
   Voidscar Hollow, three Void-Touched Stalkers. Give the shards → Shadow-Kissed Dagger and Nyx's
   speech ("These Void Shards... they are tears from the Temporal Breach itself...") **[legacy]**.
   Refuse → "Then keep their whispers, for now." **[legacy]**
9. **The Heartstone** (`scene_heartstone_choice`): "The relic throbs with unstable power. You
   sense three paths: soothe it, seize it, or shatter it." **[legacy]**; the three options and
   their result lines **[legacy]**; new consequences spoken aloud (section 13). Clock changes per
   D-017 (+6 / −5 / −10 days) are shown as a dawn-count line **[new]**.
10. **The Highlands.** Six quests done; the Nexus gate opens ("I can't help but feeling I need to
    go back and see what else needs done first." **[legacy]** until then). Shimmering Pass: "Light
    fractures into false paths, then snaps back into focus." **[legacy]** + **[new]**: "In one of
    the false paths a man stands with a hand raised, as if to stop you. When the light snaps back,
    he is gone." (Dask; see 4.4.) Aetherium Spires; Sky-Whisper Plateau; Veridian Glowlands; The
    Chronos Nexus: "A future voice overlaps your own, warning of a choice already made."
    **[legacy]**; the Chronos Lens.
11. **The Apex.** "Reality tears here in violent seams..." **[legacy]**. On first entry the
    player is fully healed **[legacy behavior, kept]**; new flavor line: "You arrive whole. The
    hour held here is one in which no one has been hurt yet." **[new]** "You sense danger... The
    Chronos Tyrant approaches!" **[legacy]** The Tyrant does not speak. It cannot.
12. **The fight.** Three phases (section 8.4). Phase 3's voices are audible but unintelligible in
    Loop 1 ("a chorus of countless dying moments" **[legacy]**).
13. **The defeat** (`scene_tyrant_defeat`): legacy lines kept verbatim with the "dust,," typo
    corrected to "dust,". "Brak Stonehand, his face grim and scarred, bursts into the Apex, his
    heavy axe already drawn." **[legacy; birth name deliberate, D-022]** Brak's two speeches
    **[legacy]**. Brak comes only if both his quests were completed this loop (D-017).
14. **The Horde.** Infection spreads node by node from the Apex; crossing an infected node costs a
    third of max HP: "The temporal collapse lashes out as you push through..." **[legacy]**.
    Leaving the Apex: "Brak gave me a chance to get out of there and make it to the portal before
    the unraveling swallows Aethelgard. His sacrifice will not be forgotten." **[legacy; this is
    the Wayfinder's Notes voice]** NPCs: "Go, Wayfinder! The horde approaches!" **[legacy]**
15. **Ilyra at the portal** (`scene_ilyra_portal`): the legacy Library description ("...Ilyra
    stands before it, her hands glowing with an intense, straining light...") and her speech
    ("Wayfinder! You made it! This portal... it's not just a way from Aethelgard, it's a tear
    through the Temporal Breach itself!... Go! Escape... and remember!") **[legacy]**. If six
    Dark Spellbooks were read, her spellbook lore paragraph plays first **[legacy]**.
16. **Enter the portal** → the transition (4.2).

### 4.2 The Loop 1 → Loop 2 transition (`closer_escape`)

Exact sequence:

1. Headline **The Last Threshold** **[legacy]**. The legacy paragraph, lightly trimmed (the middle
   sentences about Aethelgard being lost are now untrue and are cut; the last sentence is kept
   for its irony):
   > You plunge through the shimmering portal, the screams of Aethelgard's final moments echoing
   > behind you. The journey through the Temporal Breach is disorienting, a maelstrom of fractured
   > realities. When you finally emerge, the air is still, the world unfamiliar. The Wayfinder's
   > true journey has just begun...
2. The legacy ESCAPE summary screen plays in full (score, final stats, "a game by Tim Dibert").
   The player believes the game is over. Hold two seconds.
3. **The Breach shear** **[new]**: the summary screen tears from the corner like paper. Text over
   black: "The stillness breaks. Something behind you has not finished speaking. The Breach does
   not lead *beyond*. It leads *back*."
4. **Waking** (`scene_waking_loop_2`): the Whispering Ruins description **[legacy]**, then
   **[new]**: "The Amulet of Echoes is warm against your throat. You did not pick it up. It is
   simply there, as it was, as it will be. Your hands remember a portal. The stones remember
   nothing." Day counter now reads **Breach Clock — Day 1 of 30**. The Amulet is no longer in the
   room; it is the one object exempt from the reset (D-003: it holds memory across shear).
5. Ilyra: "The whispers here are louder each day. The past is trying to speak. Will you help me
   listen?" **[legacy, unchanged]**. New options are present (section 5.1).

The Threshold is **not** visited on this transition: the shear is too violent and the Wayfinder
has not yet learned to stand in it. From the end of Loop 2 onward every closer lands on the
Still Shore (D-012). The Gallery of Loops shows Loop 1 retroactively.

### 4.3 The two alternative Loop 1 closers

**Breach Clock expiry (in Loop 1 it resolves as `closer_escape` with reason `expiry` if the
portal is reached, or as the classic FALLEN screen if not; from Loop 2 it is `closer_fall` with
reason `expiry`).** If the thirtieth dawn
arrives with the Tyrant alive, wherever the player is: "The thirtieth dawn does not come up. The
sky tears instead, east to west, a seam of no-colour. From the Apex, across every mile between,
a scream reaches you: guttural, echoing, a chorus of countless dying moments. The Tyrant has not
been touched. It is screaming anyway." **[new; reuses legacy phrases]**. The Horde spreads from
the Apex exactly as in the legacy defeat; Ilyra tears her portal in the Shattered Library in
response to the unraveling, not to the Tyrant's death. Brak is not at the Apex (he lives this
loop; the player simply never sees him). Reaching the portal → the transition (4.2) with one
changed line in the shear text: "You did not kill it. It happened anyway." This grants
`echo_thirtieth_dawn` on waking: the huge clue that the Tyrant was never the cause.

**Death (`closer_fall`, Loop 1 form).** Classic: the legacy GAME OVER art, "The echoes fade,
and the world grows silent." **[legacy]**, the FALLEN summary. Reload a save. From Loop 2 onward,
death instead lands on the Still Shore (D-002).

### 4.4 Dask in Loop 1

**Decision:** Dask can be glimpsed in the Shimmering Pass in Loop 1 but not spoken to until
Loop 2. **Justification:** he exists between instants, and only something that has itself been
through the Breach can hear him, which is the same rule that governs the Tyrant's speech (D-004).
One rule, two payoffs. The glimpse line (beat 10) is the only Loop 1 trace. In Loop 2 the same
event fires and continues: "This time, when the light snaps back, he is still there."

---

## 5. Loop 2 — the reveal loop

Loop 2 is where the real game starts. The world is identical. The player is not.

### 5.1 What is different on waking

- **Breach Clock explicit:** "Day 1 of 30" in the status bar; dawns are counted aloud.
- **The Amulet** is at the throat, warm, and now has a use action: *Listen* (hear Echoes bound
  to a place; in the Shattered Library with the Crystal kept it yields the nine voices).
- **Ilyra's first line is unchanged.** Player options:
  1. "Yes." (legacy path; nothing changes)
  2. "Ilyra, I've done this before." → she is kind and does not believe you (déjà vu tier 1
     lines, 6.3). Flag `ilyra_told_loop`.
  3. [`echo_ilyra_watchword`] "The ink still holds." → she goes white and believes you at once
     (the watchword is earned in Loop 2, usable from Loop 3; see `q_voices_in_the_stacks`).
  4. [`echo_crystal_location`] "I know where the Crystal is. Behind the fallen shelf, third
     alcove." → shortcut: `q_echo_crystal` starts at stage 2.
- **Shortcuts live:** `echo_crystal_location`, `echo_apex_resonance` (the Nexus→Apex gate opens
  without six quests once you have stood at the Apex), `echo_breach_door` (the Breach-door in
  the Nexus with Lens + `echo_litany_verse_1`, D-016).
- **Dask is audible** in the Shimmering Pass (`scene_dask_introduction`).
- **The Tyrant speaks** (`scene_tyrant_first_words`) to anyone who has crossed.
- **New dialogue with everyone**, keyed to Echoes the player holds. Nobody remembers; everybody
  has déjà vu (6.3).

### 5.2 New dialogue by NPC (déjà vu level 1)

- **Ilyra:** "You keep looking at my hands. Is something wrong with them?" (Her hands burned
  holding the portal; the player remembers.) With `echo_litany_verse_1`: "You hummed something
  just now. Where did you hear that? I have never... I think I have always known it."
- **Brak:** "You walk into my camp like you've sat at this fire before. Have we met?" With
  `echo_brak_death`: option to tell him (opens `q_the_line_he_holds`). He does not believe it;
  he remembers it anyway, in his shoulders.
- **Nyx:** "You are standing differently. Something has crossed you." With `echo_nine_voices`:
  "I know what you are, Nyx." → `scene_nyx_unmasking` opens early (or via `q_the_dark_between`).
- **Kaelen:** "You've got a look like a man who's already bought what he came for." With
  `echo_brak_birth_name`: "Don't say that name in here."
- **Borin:** "Forge says you've held iron it's seen before. Forge is usually right."
- **Keeper Ansel Dray** (new): opens the Ledger; with `echo_thirtieth_dawn` or `echo_breach_clock`
  he produces Pell Ashcombe's notes: "He counted thirty. Nobody understood why."

### 5.3 Dask's introduction

Shimmering Pass, Loop 2+. The legacy shimmer event fires, the man stays. He is in Ironclad
scout's leathers seventy years out of fashion, and every few words he skips like a scratched
record, losing a syllable. He knows what a Wayfinder is because he was one. He has never seen a
loop; the Amulet and Ilyra's portal are new to him, and he is briefly, fiercely jealous. He says
the thing no one else can: *the Tyrant is holding it shut*. He asks you not to kill it. Full
scene in section 13.

### 5.4 The Tyrant's first words

At the Apex, before combat begins, the legacy encounter text plays and then, for the first time,
the mass speaks in one voice under the chorus. It knows you have crossed. It asks whether you
came back to finish it. It tells you, in as few words as it can manage (speaking costs it), that
it is the only thing standing in the door. It cannot ask for help; asking is letting go. The
player's options: fight; listen (opens communion, 8.3); leave. Listening grants
`echo_tyrant_speaks`. Full scene in section 13.

### 5.5 How the player learns the Tyrant is the jailer (independent sources)

At least two are needed so no single path is required; the game provides five:

1. **Dask** (Shimmering Pass; no quest needed): "It isn't guarding the door. It *is* the door."
2. **The Tyrant itself** (Apex; `echo_tyrant_speaks`): "I hold. If I do not hold, you have seen
   what comes."
3. **Nyx reading Oriel's scroll** (`q_lost_scroll` given to Nyx instead of Ilyra, Loop 2+): "He
   is holding it. He has been holding it since I fell."
4. **The Echo Crystal heard yourself** (kept; *Listen* in the Library): nine voices; the last is
   still speaking: "the ninth voice has not finished its verse" → `echo_ninth_verse_unfinished`.
5. **The thirtieth dawn** (if Loop 1 ended by expiry): `echo_thirtieth_dawn`; Keeper Dray's
   Ledger of the Day of Teeth confirms the pattern: every wound to it loosened the world.

### 5.6 How the six ending paths open

Each path is *named* in Loop 2 by someone, so the player leaves Loop 2 with a map of endings:

- **A · Warden's Vigil** — Dask: "Someone could take his place. Someone who knew the words."
- **B · The Mending** — the Tyrant: "Both ends. It must be closed from both ends." Borin, with
  `echo_iron_that_does_not_wish`: "Hallow's note says iron that does not wish. I can make that."
- **C · Weaver's Dawn** — Nyx, Trusted: "Open it all the way, and I will go back and stop them."
- **D · Iron Silence** — Hadda Ironvow: "Cut the line under it. No ley, no Breach, no Tyrant."
- **E · Long Archive** — Keeper Dray: "If the hour must be held, let it be held *well*. Let
  someone remember."
- **F · Unbound** — the Tyrant: "Or go. The tear is open. I will not stop you."

### 5.7 The Breach Clock becomes explicit

`q_the_thirtieth_dawn` (loop-only) teaches it: Keeper Dray's water-clock in the Library and the
Heartstone's pulse are compared; the drift is shown as a number of days remaining. From this
point every clock effect (Heartstone ±days, resting, travel) is displayed. Expiry in Loop 2+ is a
`closer_fall` to the Threshold, not a FALLEN screen.

---

## 6. Loops 3+ and the shape of a full playthrough

### 6.1 The critic's path (true ending in five loops)

| Loop | Goal | Key choices | Echoes gained | Closer |
|------|------|-------------|---------------|--------|
| 1 | Play the legacy game | Give Crystal; stabilize Heartstone; give shards | `echo_litany_verse_1`, `echo_heartstone_resonance`, `echo_brak_death`, `echo_crystal_location`, `echo_apex_resonance` | `closer_escape` |
| 2 | Learn the truth | Meet Dask; keep Crystal → `echo_nine_voices`; give scroll to **Nyx**; shards to Nyx; reach Weavers Trusted; listen at the Apex | `echo_tyrant_speaks`, `echo_nyx_is_of_the_nine`, `echo_litany_verse_8`, `echo_breach_recoil`, `echo_void_resonance`, `echo_breach_clock` | `closer_fall` (expiry or death) → Threshold |
| 3 | The Remnants' truth | Scroll to **Ilyra**; Remnants Trusted; `q_voices_in_the_stacks` → watchword; Drowned Reach → `echo_archive_door`, `echo_oriel_drowned`; Brak's arc → he lives | `echo_ilyra_watchword`, `echo_oriel_lineage`, verses 2–4, `echo_iron_that_does_not_wish` | Spare the Tyrant; communion; pass to Silverwood Before; expiry → Threshold |
| 4 | Silverwood Before | Nexus Breach-door; three days; `q_stop_the_ritual` fails; recruit Caelum; verses 5–7, 9 | `echo_ritual_inevitable`, `echo_caelum_unanchored`, `echo_anchor_mechanic`, `echo_litany_complete` | Return through the Apex; expiry → Threshold |
| 5 | The Mending | Stabilize Heartstone; Trusted with two factions; forge Breach-anchor; Caelum anchors the Conflux; communion → consent | `echo_tyrant_consent` | `ending_mending` |

### 6.2 Shorter paths to each ending

- **A · Warden's Vigil:** needs `echo_litany_complete`, so a minimum of three loops (Loop 1;
  Loop 2 for verses 1, 8 and the Breach-door; Loop 3 for Silverwood Before and verses 2–7, 9,
  then back through the Apex to step in). Three.
- **C · Weaver's Dawn:** Weavers Sworn, Heartstone exploited, Nyx alive and loyal: Loop 2 is
  enough if the player keeps the Crystal, gives shards, completes Nyx's arc, and exploits. Two.
- **D · Iron Silence:** Ironclad Sworn, Heartstone destroyed, Breach-anchor, Brak alive. The
  anchor needs `echo_iron_that_does_not_wish` (Hallow's Cairn) and the Emberforge; Brak alive
  needs `echo_brak_death` from Loop 1. Loop 2 or 3. Two to three.
- **E · Long Archive:** Remnants Sworn, stabilized, Corruption < 6, Ilyra alive. Loop 2 if the
  player gives everything to Ilyra. Two.
- **F · Unbound:** Loop 2, at the Apex, spare, refuse all. Two.
- **B · The Mending:** at least four loops by design (D-010), five is comfortable.

### 6.3 Mutually exclusive Echoes per loop, and why

| Echo set | Why exclusive |
|----------|---------------|
| `echo_heartstone_resonance` / `echo_heartstone_hunger` / `echo_heartstone_silence` | One Heartstone per loop. Knowing all three grants `echo_heartstone_triune`. |
| `echo_oriel_lineage` (+`echo_archive_door` route) vs `echo_breach_recoil` (+`echo_litany_verse_8`) | Oriel's scroll can be read by Ilyra or by Nyx, not both. The Remnant reading gives the lineage and the Drowned Reach; the Weaver reading gives how Nyx came forward and her verse. |
| `echo_nine_voices` vs Remnants +15 from the Crystal | Keep or give. Verse 1 comes either way (Ilyra deciphers it, or the Amulet lets you hear it). |
| `echo_brak_death` vs Brak alive | He dies only in loops where the Tyrant falls with him at the Apex. |
| `echo_glowfen_dammed` vs `echo_glowfen_let_run` | Mireya's choice is made once per loop. |
| `echo_void_resonance` (Weavers Trusted) vs Remnants Sworn in the same loop | Not forbidden, but rep deltas make both in one loop impractical. The Mending requires `echo_void_resonance` from *some* loop (D-018). |

### 6.4 NPC déjà vu by loop tier

Nobody remembers. The Breach leaks, and people who stand near the Wayfinder a long time start to
flinch at the right moments.

**Ilyra**
- Tier 2: "I dreamed of a library on fire and a door I was holding. I never dream."
- Tier 3–4: "When you walked in I almost said *you made it*. Made it from where?"
- Tier 5+: "I know your name before you say it. I know you'll go east. I know I'll hold
  something open until my hands burn and I know you'll step through and I don't know *why* I
  know it, and I would like you to tell me, please, this time."

**Brak**
- Tier 2: "My axe hand aches when you're about. Old wound I don't remember getting."
- Tier 3–4: "Had a dream I was standing in a door that wasn't a door, telling someone to run.
  Woke up angry and couldn't say at who."
- Tier 5+: "Tell me straight. Do I die? ...Don't answer. I saw your face. Stonehand's boys never
  could keep a face."

**Nyx**
- Tier 2: "The void stirs when you breathe. It knows you. I would like to know why."
- Tier 3–4: "You have heard my true name. Don't deny it; you flinched when the Choir sang it
  wrong."
- Tier 5+: "How many times, Wayfinder? Do not lie to me. I have counted forty years of this day
  and I can feel that you have counted more."

**Kaelen**
- Tier 2: "Odd. I set out the thing you wanted before you asked."
- Tier 3–4: "You keep nearly saying my brother's name. Everyone who comes from the camp does.
  You do it like you've heard how it ends."
- Tier 5+: "Salt. Steel. Whatever it is you're carrying between us this time, put it on the
  counter and I'll weigh it."

**Borin**
- Tier 2: "Hammer slipped when you came in. Hasn't slipped in ten years."
- Tier 3–4: "I've forged you something before. Don't know what. The hands know."
- Tier 5+: "Forge has a note it holds when you're near. Hallow's note, if the old telling's
  right. Say what you want made. I think I already know."

---

## 7. Companions

One active at a time, swapped at camps (D-013). Stances: Aggressive / Guarded / Support. Each has
a signature ability (named here for flavour; numbers belong to DESIGN.md). Personal arcs are
three quests each (catalogued in section 11). Recruitment resets each loop; Echoes shorten it.

### 7.1 Ilyra

**Who.** Remnant scholar, ~30, "wrapped in faded robes, eyes bright with purpose" **[legacy]**.
Hears the whispers more clearly than any Remnant should; descends from Oriel Danthe through the
Archive's junior keepers. Support / Ley caster. Signature: *Oriel's Seal* (a ward that absorbs
one hit and returns Mana).

**Voice.** Precise, hopeful, formal under stress; says "Wayfinder" like a title she is honoured
to use. Samples:
- "Listen. Not with your ears. The stone keeps the shape of what was said in front of it."
- "I have copied this page nine times and the ninth copy is different. The ink is correcting me."
- "I don't want to hold the door forever. I want to understand why it needs holding."

**Recruitment.** Loop 1: not recruitable (she stays in the Ruins; legacy). Loop 2+: after
`q_echo_crystal` resolves either way and the player tells her about the loop, or immediately with
`echo_ilyra_watchword`.

**Loyalty beats.** Giving her the Crystal; giving her the scroll; letting her read the Litany
aloud in the Shattered Library; standing with her against Keeper Dray when he wants the Litany
copied and locked away (she wants it *used*).

**Arc — the cost of preservation.**
1. `q_voices_in_the_stacks` — at night the Library whispers in a voice she recognises as her own.
   She learns the whispers are Oriel's verse looping, and that it answers her blood. Yields the
   watchword ("the ink still holds") for next loop.
2. `q_the_danthe_line` — the Drowned Reach; the Door of Pages opens to Oriel's seal, which is the
   Remnants' seal, which Ilyra wears. She meets the First Drowned. Outcome A: she takes Oriel's
   ring and the lineage openly (`echo_oriel_lineage`; Remnants +10). Outcome B: she leaves it,
   refusing a dead woman's claim on her (Remnants −5; she gains the *Unbound Hand* trait: her
   portal costs less).
3. `q_the_keepers_price` — Keeper Dray tells her what the portal does to the one who tears it.
   She chooses: become the Keeper who remembers (path to E), or swear never to tear it again and
   find another way (path to B; the Mending needs her to anchor the present end *without* tearing).

**Stance on the Tyrant.** Loop 1: it is the cause. Loop 2+: horrified by what it is; wants it
*held* better, not killed; argues with Dask about whether a prison can be mercy.

**Refusals.** Will not enter the Veil ("That place reads you back"). Will not go to the Apex in
Loop 1. Will not help exploit the Heartstone and leaves the party for the loop if the player does.

### 7.2 Brak

**Who.** Ironclad scout, ~40, "sharpening a chipped axe" **[legacy]**; born Brak Stonehand,
Kaelen's younger brother; took the oath and dropped the name after Kaelen left (D-022). Bruiser.
Signature: *Hold the Line* (taunt all, guard, generate Grit).

**Voice.** Blunt, short, dry humour, calls the unraveling "the Horde." Samples:
- "Steel and stubbornness. One of them runs out. Make sure it's the steel."
- "I don't trust anything that glows. You glow a little, Wayfinder. I'm making an exception."
- "My brother sells salt to people who are going to die anyway. Somebody has to."

**Recruitment.** After `q_clear_path` in any loop (Loop 1 included; he joins for the Outpost).

**Loyalty beats.** Completing both legacy quests; carrying salt to Kaelen; not lying to him about
the Apex; letting him choose.

**Arc — the line he holds.**
1. `q_the_scouts_oath` — the Ring of Wagons; Hadda Ironvow; why he dropped his name. He speaks it
   once, in the dark: Stonehand. `echo_brak_birth_name`.
2. `q_blood_and_salt` — carry a thing between the brothers (`scene_braks_brother`). Outcome A:
   they speak; Kaelen gives him their father's whetstone; Brak gains *Named* (his taunt also
   shields). Outcome B: Kaelen refuses; Brak gains nothing and says it's fine; it is not.
3. `q_the_line_he_holds` — with `echo_brak_death`, tell him the truth. Outcome A: he believes you
   and stays at the Ring of Wagons (he lives; you lose his aid at the Apex). Outcome B: he comes
   anyway "to see it," and if the Tyrant falls he dies as before. Outcome C (needs `q_blood_and_salt`
   A): he comes with Kaelen's salt and holds the line *at the Nexus* instead, where the Horde is
   thinner, and lives (D-017: "an Echo and a choice").

**Stance on the Tyrant.** Kill it. Then, Loop 2+, hearing what it is: "Then it's a man standing
in a door. I've done that. You don't shoot the man. You find out what's behind him."

**Refusals.** Will not enter the Hollow Choir. Will not let Nyx walk behind him. Will not go to
the Apex in a loop where you exploited the Heartstone ("That thing's in your pack hurting you and
you want *me* to hold a line?").

### 7.3 Nyx

**Who.** Nyxaria Vell of the Nine, forty years in the present; "a shadow-wrapped figure whose
eyes burn with quiet starlight" **[legacy]**. Void caster. Signature: *The Dark Between* (phase
the party for one turn; enemies lose their intents).

**Voice.** Smoke; present tense; elliptical; never raises it. Samples:
- "The void remembers you. It remembers everyone. It is not a compliment."
- "I have told the Choir what they could bear. You, I think, can bear a little more."
- "I was there. Do not ask me to be sorry in a way you can use."

**Recruitment.** After `q_void_shards` with shards given (any loop). Loop 2+ with
`echo_nine_voices`: recruitable after `scene_nyx_unmasking` even if shards are refused, Wary.

**Loyalty beats.** Giving the shards; keeping the Crystal; exploiting the Heartstone (she approves
and says so quietly); not telling the Choir what she is.

**Arc — what she would undo.**
1. `q_tears_of_the_breach` — she teaches you to read a Shard: it is a moment, torn. The three you
   hold are the sixth, eighth, and ninth verses of a night she will not name yet.
2. `q_the_dark_between` — Nyx's Cell in the Veil. Her unmasking (`scene_nyx_unmasking`):
   `echo_nyx_is_of_the_nine`, `echo_litany_verse_8`. Outcome A: you keep her secret from Sethe
   (Weavers +10; she is Loyal). Outcome B: you tell the Choir (Weavers −20; Sethe turns on her;
   she leaves the party, Hostile, for the loop; `echo_choir_knows` persists).
3. `q_what_she_would_undo` — she asks for help going back. Outcome A: agree (path to C). Outcome
   B: refuse with the truth (`echo_ritual_inevitable`): she does not believe you, then she does;
   if Weavers Trusted she gives `echo_void_resonance` anyway, "so that someone closes it who
   knows what it is."

**Stance on the Tyrant.** She knows exactly who it is and has never once gone to the Apex to
look. "I am not ready to see his face. I was never ready. That is why I am here and he is there."

**Refusals.** Will not enter the Emberforge (Hallow's fire). Will not go to the Apex until
`q_what_she_would_undo` resolves. Will not stand in Silverwood Before ("Two of me is one too
many").

### 7.4 Dask

**Who.** The Flickering Man; seventh Wayfinder; died Year 430; an Ironclad-trained scout in
leathers seventy years out of fashion. Exists between instants; can only remain in temporally
unstable places: Highlands, Nexus, Apex, Threshold, Silverwood Before (D-013). Ironclad Warden
pattern. Signature: *Between* (rewinds one ally's last turn of damage).

**Voice.** Dry; skips syllables when the instant slips (render as a dropped word, never a
stutter joke). Samples:
- "Seventy years. Felt like an afternoon. A long one. Don't do what I did. Don't do what I
  nearly did either."
- "You've got a thing round your neck that remembers. I'd have killed for that. Did, in a way."
- "It isn't guarding the door. It *is* the door. I worked that out about a second before it
  worked out I'd worked it out."

**Recruitment.** Loop 2+, Shimmering Pass, after `scene_dask_introduction`. No quest needed.

**Loyalty beats.** Visiting the Gallery of Loops with him; finding his moments; not killing the
Tyrant in his presence; letting him see the Threshold.

**Arc — the last instant.**
1. `q_the_flickering_man` — gather four of his scattered moments across the Highlands (he is in
   each, mid-sentence). Pacifist. `echo_flickering_man`.
2. `q_seven_marks` — the Gallery of Loops; the seven Wayfinders' marks; he knew Rook Tallis's
   grave. `echo_seven_wayfinders`, `echo_wayfinder_symptom`.
3. `q_the_last_instant` — at the Apex, in communion, the Tyrant can gather him into one instant.
   Outcome A: he rests (he dies properly; `echo_dask_rest`; the Tyrant's phase 3 becomes one voice
   quieter). Outcome B: he asks to stay "until it's done" and becomes your anchor for the Mending's
   present end (needed only if Ilyra swore not to tear).

**Stance on the Tyrant.** The only one who starts right. Wants someone to take its place and is
ashamed that it cannot be him.

**Refusals.** Cannot enter stable locations (he fades at the edge of the Pass). Will not speak
to Nyx until she has admitted what she is in his hearing.

### 7.5 Mireya of Lanternreed

**Who.** Glowfen herbalist from the stilt-village of Lanternreed; practical, warm, in her
thirties; her forearms have begun to shine in the dark. Nature/glow healer. Signature: *Lantern*
(group Regen that also clears Blind).

**Voice.** Herb-names and weather; kind without softness. Samples:
- "Glow Moss for the wound, bitterroot for the fever, and sit *down*, I can see your knees."
- "My grandmother glowed at the end. We said it was holiness. It was the water."
- "You keep saying *preserve*. The fen doesn't preserve anything. It changes it or it eats it."

**Recruitment.** Reach Lanternreed and complete `q_lantern_in_the_reeds` (any loop; the Glowfen
is open from Loop 1 via the Glowlands).

**Loyalty beats.** Healing the changed without flinching; bringing Imre Sallow's name back from
the Breathing Pool; letting Lanternreed decide for itself.

**Arc — what the light takes.**
1. `q_lantern_in_the_reeds` — the sick of Lanternreed; a child whose eyes have gone Mireling-green
   and who can see in the dark now. Pacifist.
2. `q_what_the_light_takes` — the Breathing Pool, Imre Sallow's station; the glow is Breach-leak
   down Sallow's line (`echo_breathing_pool`). Elder Wen wants it kept; Mireya is not sure.
3. `q_preserve_or_heal` — dam the leak with a Stabilized Heartstone fragment (the glow fades;
   the changed stop changing and some sicken; `echo_glowfen_dammed`) or let it run (the fen folk
   become something new and bright and no longer quite human; `echo_glowfen_let_run`). Mireya
   accepts either and never says you chose right.

**Stance on the Tyrant.** Doesn't care what it is; cares what it leaks. Backs the Mending once
she understands the leak would stop.

**Refusals.** Will not leave the Glowfen until stage 2 resolves. Will not fight Mirelings
("They were people. Some of them were people last spring").

### 7.6 Caelum Vesper

**Who.** Apprentice to the Nine, ~16, Veyran's errand-boy; met on the Archive stair in
Silverwood Before, three steps up, with a message he never delivers. Chrono caster (taught by
Masque and Thal). Signature: *Errand* (Haste on one ally; the first time each fight, Rewind).

**Voice.** Eager, formal, old-city diction; "Master Thal"; asks questions he's afraid of.
Samples:
- "Master Thal says the Holding is a kindness to the hour. Is it? You look like someone who's
  seen the hour afterward."
- "Everything in your pack is older than my city. That isn't possible. I'm holding it."
- "If I go with you, nobody delivers the message. Nobody *ever* delivered it, did they."

**Recruitment.** Silverwood Before, Day −1, after `q_a_boy_from_a_doomed_city` (he chooses to
come forward). He can be brought to the present because the Breach's first breath touched him
on the stair (`echo_caelum_unanchored`, D-016).

**Loyalty beats.** Not lying to him about the city; letting him see the Shattered Library;
letting him speak to the Tyrant.

**Arc — a boy from a doomed city learning his masters' sin.**
1. `q_the_apprentices_errand` — carry the message to the Spire Yard with him. Pacifist. Aulde
   reads it and laughs; it says *begin*.
2. `q_a_boy_from_a_doomed_city` — show him the present through the Breach-door (one glimpse of
   the Shattered Library). Outcome A: he comes forward. Outcome B: he refuses and dies with the
   city at every reset; `echo_caelum_stayed`; the Mending is still possible via Dask as anchor,
   but the Conflux anchor must be placed by the player (harder quest stage).
3. `q_his_masters_sin` — in the present, he faces the Tyrant in communion. Outcome A: he forgives
   Veyran (`echo_caelum_forgives`; the Tyrant's consent comes without a second test). Outcome B:
   he cannot, and says so; Veyran accepts it; consent still comes, but the Mending's final scene
   is colder.

**Stance on the Tyrant.** It is his teacher. He wants it to be *allowed to stop*.

**Refusals.** Will not enter the Shattered Library until stage 2 (he knows what it was). Will not
be present when the Heartstone is exploited or destroyed ("That's the cradle. Hallow *made*
that").

### 7.7 Companion × ending — one-line fates

| | A Vigil | B Mending | C Weaver's Dawn | D Iron Silence | E Long Archive | F Unbound |
|---|---|---|---|---|---|---|
| **Ilyra** | Writes the eighth name in the Ledger; never tears another portal. | Keeps the Archive dry; teaches children the count of years starting again at one. | Unravelled with the Library, holding a door nobody comes through. | Hears nothing ever again; copies books by hand and says it is enough. | Becomes the Keeper; remembers every loop; is kind about it. | Holds the portal; you go; she does not know where. |
| **Brak** | Lives; names a wagon-child Stonehand. | Lives; speaks to his brother every market day. | Dies holding a line against a tide that was always coming. | Lives; the Nomads inherit a mundane world and he hates how quiet it is. | Lives the same thirty days forever and never minds. | Lives if kept from the Apex; otherwise dies as before. |
| **Nyx** | Weeps once, at the Chasm, where no one sees. Leads the Choir honestly. | Freed from her hope; grows old quickly and gratefully. | Becomes one of the shards. | Ages five hundred years in a season; sleeps. | Keeps her secret forever in a world where forever is thirty days. | Goes to the Apex at last and looks at his face. |
| **Dask** | Rests; the Tyrant's chorus is one voice quieter. | Rests, if `echo_dask_rest`; else fades with the Breach, content. | Scattered again across a world that is ending. | Gone; nothing between instants remains. | Stays in the Pass, flickering, the Keeper's only confidant. | Watches you go and says "fair." |
| **Mireya** | Lanternreed glows or doesn't, as chosen; she tends it. | The leak stops; the changed stop changing; she grieves the light. | Unravelled. | The fen goes dark; she lights real lanterns. | The fen glows the same every thirty days. | As chosen; she waves from the stilts. |
| **Caelum** | Stays in the present; apprentices to Borin. | Places the cradle-pin; stays; grows up in a world his masters didn't break twice. | Dies in the chamber on the stair, as he always did. | Loses his Chrono gift; learns to forge. | Lives the same three days in the Before, forever, never delivering the message. | Comes with you if asked; else returns to the stair. |
| **Kaelen / Borin** | Trade and forge; the Respite stays neutral. | Kaelen crosses to the camp for the first time in years. Borin lets the fire go out for one night, on purpose, and relights it. | Unravelled. | Borin's fire is the only fire that matters now. | Same market day forever. | One line each. |

---

## 8. The Tyrant

### 8.1 Veyran's psychology after five hundred years

He is not mad. That is the horror of him. He is a very intelligent man who has had five hundred
years to think, in pain, without sleep, about one mistake, with five dead colleagues surfacing
through his body, and who has arrived at the conclusion that he deserves this and that it is also
unendurable. He is proud: he still calls it the Holding. He is a jailer who knows that he is also
the prisoner and that the cell is the only thing keeping the house up. He has watched seven
Wayfinders die, four of them trying to kill him, and he cannot tell any of them anything, and he
has come to resent them for it and then to grieve the resentment. He wants to stop. He cannot
want to let go. These are not the same wish, and the whole communion path lives in the gap.

He speaks as a chorus of the Nine, with his own voice under it like a bass line. He refers to
"the hour." He never says "I am sorry," because he does not believe it is his to say to the
living; he says it, once, to Caelum.

### 8.2 What it says, by loop

- **Loop 1:** nothing. Only the legacy scream at death.
- **Loop 2 (first words):** "You have crossed. So. One of you finally crossed... Did you come
  back to finish it? ... I hold. If I do not hold, you have seen what comes. I cannot ask. Do
  you understand that I cannot ask?"
- **Loop 3:** "Again. You carry more of the words each time. Say the ones you have; I will know
  which are missing by where you stop." (The Tyrant becomes a check on `echo_litany_*`: it
  will not confirm verses, but it falls silent at the gaps.)
- **Loop 5+:** "I have begun to count by you. That is a thing I had forgotten how to do. Do not
  make me a clock, Wayfinder. Finish it, one way or another, while I still have a way to be
  grateful."

### 8.3 The communion (non-combat resolution)

A dialogue "fight" at the Apex, available from Loop 2 with `echo_tyrant_speaks` (or the moment
the player chooses *Listen*). Three movements mirror the combat phases. The player has a
**Resolve** meter (0–9) rather than HP; each correct answer adds, each wrong one subtracts and
the Tyrant's intent for the "turn" is a question. Reaching the end with Resolve ≥ 6 unlocks the
outcome branches; below 3 the Tyrant rejects you (8.5). Echoes are the player's "abilities."

**Movement I — The Holding (why have you come).** Three questions. Good answers draw on
`echo_tyrant_jailer`, `echo_thirtieth_dawn`, `echo_seven_wayfinders`. Saying "to kill you"
honestly is not wrong (+1: it respects honesty); lying is (−2: it knows).

**Movement II — The Fracture (the Nine speak through him).** Each of the five others asks one
thing through the mass. Each is answered by the matching verse Echo or by a trace Echo:
- Korr: "What is read is owed. What have you read?" (`echo_litany_verse_2` or `echo_korr_marginalia`;
  Corruption ≥ 3 also satisfies him and costs Resolve with the others.)
- Vane: "Who guards the gate now?" (`echo_litany_verse_3` or `echo_stone_hide_origin`.)
- Aulde: "What note does the sky hold?" (`echo_litany_verse_5` or `echo_spire_note`.)
- Sallow: "What lives, that carries what does not?" (`echo_litany_verse_6` or
  `echo_breathing_pool`; Mireya present: automatic.)
- Masque: "Tell me what you saw from the far side." (`echo_litany_verse_7` or `echo_eye_of_masque`;
  `echo_ritual_inevitable` is the perfect answer.)
Hallow's silence is a sixth question with no asker; `echo_hallow_said_stop` answers it (+2).

**Movement III — The Nine Speak (the choice).** With Resolve ≥ 6 the chorus quiets and Veyran
speaks alone. The outcomes offered depend on what the player holds:
- **Let you pass** (always): the Apex opens onto Silverwood Before (D-016) or onto the far side
  (ending F).
- **Let you take its place** (`echo_litany_complete`): ending A.
- **Consent to the Mending** (Breach-anchor in inventory + `echo_anchor_mechanic` + Caelum placed
  the cradle-pin): `echo_tyrant_consent`; ending B.
- **Reject** (Resolve < 3 at any movement's end, or lying twice): see 8.5.

### 8.4 The combat version — three phases

Hand-tuned boss; cannot be fled (D-009). From Loop 2, with `echo_tyrant_speaks`, the player may
stop at any phase transition and shift to communion (at Movement II).

**Phase 1 — The Holding** (100–66% HP). Emotional beat: *it does not want to fight you.* Slow,
heavy Chrono strikes; it braces rather than attacks on alternate turns. Intents: "The Tyrant
braces the hour against you." / "A skeletal limb surfaces, reaching." / "Time thickens around
your feet." Adds: none. Status: Slow on hit.

**Phase 2 — The Fracture** (65–31%). Beat: *the others wake.* The mass splits; each of the five
strikes with their element once per rotation: Korr (Fire, Burn), Vane (Physical, Armor Break),
Aulde (Ley, Shield on self), Sallow (Ley, Regen on self, Poison on you), Masque (Chrono, Rewind
its own damage). Intents name them without naming them: "Something that was a scholar burns." /
"Stone-grey hands close." Adds: two Temporal Aberrations at the phase start.

**Phase 3 — The Nine Speak** (≤30%). Beat: *they are begging.* Each hit the player lands is
answered by a voice: "Do not." "It holds." "Tell them." "Stop." In Loop 1 these are unintelligible
("a chorus of countless dying moments"). From Loop 2 they are words. Veyran's own voice, once, at
10%: "If you finish this, run. I mean that kindly." Intents: "The Tyrant stops guarding itself."
Damage taken ×1.5; it stops bracing.

Defeat → `scene_tyrant_defeat` (legacy lines) → the Horde.

### 8.5 Rejection

If the Tyrant rejects the player in communion: "Then you are the fifth to come for me with a
blade in your mouth. Go and get a real one." Combat begins at Phase 2 with no Phase 1. If the
player leaves instead, the Breach shears them to the Threshold (`closer_fall`, reason
`rejected`), and `echo_tyrant_rejected` persists; the next communion starts at Movement II.

### 8.6 The Horde

Brak's word; the Remnants say "the unraveling." It is "not just creatures, but a cascading
temporal collapse" **[legacy lore]**: the Breach spilling along the ley lines node by node (the
legacy infection map is kept: Apex → Nexus → Glowlands... with the Mistwood → Plaza delay). In
it walk Temporal Aberrations, Shimmering Phantoms, and new *Unravelled* (creatures from any
family, flickering, with no intents, because they have no next moment). In Loop 2+ dying in the
Horde is a `closer_fall`. Brak's stand (`scene_braks_stand`) can be watched from the Nexus if
the player lingers one watch; the narration names him Brak Stonehand at the moment he falls.

---

## 9. Silverwood Before

### 9.1 Getting there and the three days

Reached from Loop 2 via the Breach-door in the Chronos Nexus (Chronos Lens + `echo_litany_verse_1`)
or through the Apex when the Tyrant lets you pass (D-016). It is a time-locked echo of the last
three days before the Sundering, repeating. The player arrives on the morning of **Day −3** at the
Silver Gate with Breach-touched eyes; citizens take them for a foreign scholar. The three days
are driven by the clock; the ritual begins at dusk on Day −1 whatever the player does, and at the
first line of the ninth verse the echo resets to Day −3. Each reset keeps the player's Echoes and
inventory. Ten locations (proposed for WORLD.md): the Silver Gate, Scholars' Row, the Plaza (bells
intact, fountains running), the Hall of the Circle, Veyran's study, the Archive (dry; Oriel at her
carrel), the Archive stair, the Conflux chamber (the Heartstone whole in Hallow's iron cradle),
Hallow's Forge, the Spire Yard.

### 9.2 What the player can see

- **The Nine alive.** Veyran lecturing in the Hall ("the Holding is a kindness to the hour");
  Korr annotating a workbook that the player recognises as a Dark Spellbook, uncharred; Vane
  reviewing golem sigils; Hallow at the forge, arguing with no one; Aulde tuning the Spires from
  the Yard; Sallow in the Green Court with seedlings; Masque on the observatory roof refusing to
  come down; Oriel at work in the dry Archive with the Echo Crystal on its stand.
- **Nyx young.** Nyxaria Vell, perhaps thirty, eyes still ordinary, walking the Plaza at night.
  She alone looks at the player twice. "You're from the far side of something. I can see the
  seam on you." She does not recognise herself in your description of Nyx and will not hear it.
- **Caelum Vesper** on the Archive stair, on each Day −1 at dusk, three steps up.
- **The bells.** The Plaza bells ring back the Cradle's note on Day −1; this is the "chorus of
  distant bells" the Plaza still echoes **[legacy event]** (`echo_bells_of_silverwood`).

### 9.3 The Anchor mechanic in story terms

Nothing the player changes in the Before survives the reset, because the Before is an echo: the
Breach replays it. Except the Conflux chamber. The chamber is where the Breach *is*, at every
instant; an object set down there is set down in every instant at once, and so it is still there
when the present arrives. Objects placed in the Conflux chamber survive the Sundering and appear
in Heartstone Depths (D-016). The Remnants will later find them without explanation. The player
discovers this with a Sky-Whisper Talisman left on the cradle's rim, which is lying in the Depths
on return (`echo_anchor_mechanic`). The Mending uses it for Hallow's cradle-pin.

### 9.4 `q_stop_the_ritual` — the tragic failure

The quest offers four attempts across resets, each with its own small, informative tragedy:
1. **Warn Veyran.** He listens courteously. "You have seen it fail. Then you have seen the version
   in which I did not know. Now I know." He begins the ritual anyway, convinced knowledge is the
   difference. It fails identically.
2. **Keep Hallow in the circle.** He stays. The sixth verse cracks the stone. Nothing changes
   except that Hallow dies in the tear instead of on the Peaks, and the Ironclad never exist. The
   player wakes in the Before with `echo_hallow_said_stop` and a hollow where a faction was, which
   the reset fills back in.
3. **Steal the Litany.** Oriel's record is taken; the Nine speak it from memory. The Crystal
   records the player's footsteps leaving.
4. **Break the cradle.** Hallow's iron holds. "Iron that does not wish." It cannot be broken by
   wanting to.
On the fourth failure Masque, from the roof, says to the player: "You see it too now. From the
far side. It was always going to fail, and we were always going to do it." → `echo_ritual_inevitable`.

### 9.5 Echoes it yields

`echo_before_route`, `echo_bells_of_silverwood`, `echo_hallow_said_stop`, `echo_ritual_inevitable`,
`echo_anchor_mechanic`, `echo_caelum_unanchored`, and the verses heard spoken in the chamber on
Day −1: `echo_litany_verse_2` through `_7` whole, and the first line of verse 9 before the reset.
Verse 9 whole is found in Veyran's study (his written draft of the last line he never reached), or
from the Tyrant in communion, or from Nyx when Loyal (section 12). Each verse also has a present-day
source (Korr's margins, Vane's Watch, Hallow's Cairn, the Spires, the Breathing Pool, the Nexus), so
no verse is locked to the Before; the Before is simply where they are heard together.

### 9.6 How Caelum comes forward

Caelum was on the third step when the first verse began and the Breach's first breath came up
the stair and touched him. He is *unanchored*: the echo does not hold him the way it holds the
others, which is why he can remember the player between resets (he is the only one who does).
In `q_a_boy_from_a_doomed_city` the player opens the Breach-door from the Before side and lets
him look once at the Shattered Library. If he chooses to come, he walks out through the tear
beside the player and arrives in the Nexus with the message still in his hand
(`scene_caelum_crossing`). He cannot go back; the Before, for him, is now a place he was.

---

## 10. Endings

All six are reachable from Loop 2+. Each has an ending quest (section 11), a final scene with
the last choice (section 13), epilogue slides, an achievement, and a tone. Companion fates per
ending are the table in 7.7; the slides below give world, factions, and the Wayfinder. Every
ending screen closes with "a game by Tim Dibert" (D-027).

### 10.1 `ending_wardens_vigil` — A · The Warden's Vigil

**Requirements.**
```
{ all: [ { echo: "echo_litany_complete" }, { flag: "tyrant_spared" },
         { flag: "communion_resolve_6" }, { location: "the_temporal_breach_apex" } ] }
```
**Final sequence.**
1. Communion, Movement III. Veyran: "You have all nine. You could say them. You understand that
   whoever says the ninth must stay in it."
2. The Wayfinder speaks the Litany, verse by verse; at each the matching member of the Nine
   surfaces in the mass and goes still. Key line (Masque): "Tell us true." Player: "It failed."
   Masque: "Thank you."
3. Verse nine. The player speaks "Hour, stay. Be as you are, and do not become. I hold you. I
   hold you." Veyran, for the first time in five hundred years, stops speaking. "—I hold you,"
   the player finishes, and the mass is theirs.
4. Veyran Thal steps out of the tear as a man, old, and sits down on the Apex floor. "It is
   heavier than it looks. It is lighter than it was." He dies in the next watch, in no pain.
5. The companions, if present, are let go gently; Dask, if present, is gathered into one instant
   and rests.
6. Slide: the sky over the Apex steadies. The Breach Clock stops at the current day and does not
   restart.
**Epilogue slides.** *World:* Aethelgard is saved; the Breach is held, not sealed; wild magic
quiets to a murmur. *Remnants:* the Ledger gains an eighth name and the words "did not die."
*Weavers:* the Shards stop falling; the Choir sings to a door that answers. *Ironclad:* Hadda
sends a scout to the Apex every year to leave an axe-head on the floor. *Wayfinder:* "You hold.
You are not in pain. You can hear every bell in Silverwood, ringing back a note." No more
Wayfinders are born: the symptom has a cause that is now content.
**Achievement:** *The Ninth Verse*. **Tone:** bittersweet; stillness earned.

### 10.2 `ending_mending` — B · The Mending (true ending)

**Requirements.**
```
{ all: [ { echo: "echo_heartstone_resonance" }, { echo: "echo_litany_complete" },
         { echo: "echo_void_resonance" }, { item: "breach_anchor", count: 1 },
         { flag: "cradle_pin_anchored" }, { flag: "tyrant_spared" },
         { flag: "communion_resolve_6" },
         { any: [ { all: [ { rep: { faction: "remnants", min: 20 } }, { rep: { faction: "ironclad", min: 20 } } ] },
                  { all: [ { rep: { faction: "remnants", min: 20 } }, { rep: { faction: "weavers", min: 20 } } ] },
                  { all: [ { rep: { faction: "ironclad", min: 20 } }, { rep: { faction: "weavers", min: 20 } } ] } ] } ] }
```
**Final sequence.**
1. Communion, Movement III, with the Breach-anchor in hand. Veyran: "Both ends. You found the
   other end." Caelum, if forgiving: "Master Thal. It's done. You can put it down."
2. Consent (`echo_tyrant_consent`): "Then I will say the word I have not been able to say."
3. The player drives the Breach-anchor into the Apex floor. In the Before, at the same instant,
   the cradle-pin Caelum set on the rim takes the Heartstone's weight that Hallow's iron could not.
4. Veyran speaks the ninth verse's ending: "Hour, *go*."
5. The Nine come out of the mass one by one as the dead, lie down, and are dead. Veyran last,
   standing, then not. Nyx, if present, closes his eyes.
6. Slide: time flows forward. The Breach Clock reads "Day 1" and then, for the first time, "Day
   31."
**Epilogue slides.** *World:* the Breach is sealed from both ends; the Heartstone beats evenly;
the Glowlands dim to ordinary green over a decade; the Spires fall silent. *Remnants:* begin a
new count, Year 1 of the Mending, and argue about whether to keep the old one. *Weavers:* the
Choir disbands; some stay to tend the Chasm as a grave. *Ironclad:* Borin forges the next
anchor-pin out of habit and hangs it over the door. *Wayfinder:* "You are not pulled anywhere. You
stand in the Plaza where the fountains have stopped seeping, and you do not know what to do with
your hands. It is a good problem." The ley stops making Wayfinders.
**Achievement:** *Both Ends*. **Tone:** release; quiet joy with grief in it.

### 10.3 `ending_weavers_dawn` — C · The Weaver's Dawn

**Requirements.**
```
{ all: [ { rep: { faction: "weavers", min: 60 } }, { flag: "heartstone_exploited" },
         { companion: "nyx", state: "loyal" }, { quest: "q_what_she_would_undo", stage: "agreed" } ] }
```
**Final sequence.**
1. The Apex. Nyx, for the first time, looks at the Tyrant's face. "Veyran. It's me. I'm going to
   fix it." The chorus says her name in eight voices and his.
2. With the Heartstone Core, the player and Nyx tear the hold open. The Horde does not wait for
   the Tyrant to die; it comes as the hold fails, and the present unravels behind them as they
   step through.
3. Silverwood Before, Day −1, dusk, the ninth bell. Nyx runs down the Archive stair past Caelum.
   The player follows. The circle is closed; she cannot enter it; she speaks the sixth verse's
   warning from the edge and Hallow turns, and says "Stop," and Veyran says "It holds."
4. It fails identically. The recoil, finding the one mind that has named the dark twice, does
   not throw her forward. It keeps her. She becomes one of the shards.
5. The tear widens. Veyran steps in. The mass forms. Among the skeletal limbs and crystalline
   shards there is a face the player knows, because it is theirs.
6. Slide: black. One line: "Five hundred years later, something pulls at the edge of the
   Whispering Ruins."
**Epilogue slides.** *World:* unravelled, then remade identically, with one more in the Tyrant.
*Factions:* one line each: "They form again. They are wrong again, in the same three ways."
*Wayfinder:* "You hold. You are in pain that does not vary. You are waiting for someone to cross."
**Achievement:** *Nine, and One More*. **Tone:** dark; a circle closing with a click.

### 10.4 `ending_iron_silence` — D · The Iron Silence

**Requirements.**
```
{ all: [ { rep: { faction: "ironclad", min: 60 } }, { flag: "heartstone_destroyed" },
         { item: "breach_anchor", count: 1 }, { companion: "brak", state: "alive" } ] }
```
**Final sequence.**
1. The Apex; Brak at the player's shoulder (he insists; this is the one loop he is allowed).
   The Tyrant, if spoken to: "Iron that does not wish. He made that for me once. I see."
2. The player drives the Breach-anchor into the Apex floor and Brak hammers it home with the
   flat of his axe. The ley line under the Apex parts with a sound like a bell cracking.
3. The Breach, fed by nothing, closes like a mouth with nothing to say. The Tyrant's mass goes to
   dust without a scream; it does not unravel, because there is nothing left for it to unravel
   through. A man is briefly visible, and then is not.
4. Across Aethelgard, in one slide per place: the Spires stop humming; the Glowlands go dark; the
   Chasm's murmurs end; Ilyra, in the Ruins, puts a hand to her ear; the Emberforge's fire burns
   as an ordinary fire.
5. Brak: "Quiet. I thought I'd like it."
**Epilogue slides.** *World:* magic dies; no more Wayfinders; a mundane world with ruins in it.
*Remnants:* keep books nobody can hear anymore; the count of years continues out of stubbornness.
*Weavers:* disperse; Nyx sleeps. *Ironclad:* inherit; Hadda is first chief of a confederation that
no longer needs the oath and keeps it anyway. *Wayfinder:* "The pull is gone. You are a person with
a sword in a place with weather."
**Achievement:** *Iron That Does Not Wish*. **Tone:** stern; a cost paid in full and in silence.

### 10.5 `ending_long_archive` — E · The Long Archive

**Requirements.**
```
{ all: [ { rep: { faction: "remnants", min: 60 } }, { flag: "heartstone_stabilized" },
         { echo: "echo_heartstone_resonance" }, { corruption: { min: 0, max: 5 } },
         { companion: "ilyra", state: "alive" }, { quest: "q_the_keepers_price", stage: "keeper" } ] }
```
**Final sequence.**
1. The Heartstone Depths at the twenty-ninth dawn. Ilyra sets the Stabilized Heartstone back in
   the cradle's broken rim; the resonance climbs the ley line to the Apex.
2. The Apex (seen through the Lens from the Nexus): the Tyrant's mass eases, the limbs sink, the
   chorus drops to a hum. Veyran, if spoken to earlier: "Ah. The archivist's blood. She would do
   this. Tell her it is not nothing."
3. The thirtieth dawn comes up and goes down and comes up again as the first. Nothing unravels.
   Ilyra, alone of everyone, remembers.
4. Ilyra: "I will keep it. All of it. Every time. Go or stay; I'll know which you chose, and I'll
   be kind about it."
5. The player chooses: stay in the ring (fade on the Ruins, Day 1 again, the Amulet warm) or step
   through the portal she tears without pain (the same door, a different shore).
**Epilogue slides.** *World:* Aethelgard becomes a conscious time-ring, safe and unchanging,
thirty days long. *Remnants:* the Keeper's order; one person who remembers, and children who are
told stories about the thirty-first day. *Weavers:* the Shards fall and are gathered and fall
again. *Ironclad:* the same hunt, the same fire, the same market day. *Wayfinder:* "You may
leave. You are the only one who may. Ilyra waves, and already knows whether you will wave back."
**Achievement:** *The Thirty-First Day*. **Tone:** gentle and uncanny; peace as a held breath.

### 10.6 `ending_unbound` — F · The Unbound

**Requirements.**
```
{ all: [ { flag: "tyrant_spared" }, { loop: { min: 2 } }, { location: "the_temporal_breach_apex" },
         { not: { any: [ { flag: "chose_vigil" }, { flag: "chose_mending" }, { flag: "chose_dawn" },
                         { flag: "chose_silence" }, { flag: "chose_archive" } ] } } ] }
```
**Final sequence.**
1. Communion or not; the Tyrant, spared: "Or go. The tear is open. I will not stop you. I have
   never been able to stop anyone."
2. The player steps past it, into the Breach, toward somewhere that is not Aethelgard.
3. Slide: "The journey through the Temporal Breach is disorienting, a maelstrom of fractured
   realities. When you finally emerge, the air is still, the world unfamiliar." **[legacy, now
   literally true]**
**Epilogue slides.** One line each, cold, reported: *World:* "The thirtieth dawn came. The sky
tore. It was as you saw it." *Remnants:* "They kept writing until there was no paper." *Weavers:*
"They sang." *Ironclad:* "Twenty held the Nexus for a day. It was not enough and they knew."
*Companions:* per 7.7. *Wayfinder:* "You remember all of it. Nobody where you are knows what an
Echo is."
**Achievement:** *Not My World*. **Tone:** cold; honest; the game does not argue.

### 10.7 Loop-closers

**`closer_escape` — The Escape (Loop 1 only).** Sequence in 4.2. Recorded in the Gallery as
"Loop 1 — Escape."

**`closer_fall` — The Fall (Loop 2+).** Reasons: `death`, `expiry`, `rejected`, `portal`
(entering any portal into the Breach without an ending). Sequence:
1. Reason text (death: "The echoes fade." **[legacy fragment]** / expiry: the thirtieth-dawn
   text, 4.3 / portal: the trimmed Last Threshold paragraph).
2. The Breach shear.
3. The Still Shore: grey water, no horizon, a far light. Run summary (days used, Echoes gained,
   Resonance earned). Dask, if recruited this loop, stands at the water's edge: "So this is where
   you go. Huh. Nicer than mine."
4. Far out on the water, a figure holds something up with both hands. It does not move.
5. The Far Light → Day 1.

---

## 11. Quest catalog (44 quests)

**Composition.** 44 total, with the six legacy quests counted inside the categories: five open the
faction chains (Remnants 2, Ironclad 2, Weavers 1) and `q_echoing_heartbeat` is the Silverwood
Ruins regional pivot. Silverwood Before's quest (`q_stop_the_ritual`) is counted as loop-only
because the region is loop-locked. Distribution: faction chains 9 · companion arcs 18 · regional 7
· loop-only 4 · ending 6. See Open Questions for the D-019 arithmetic note.

**Conventions.** Level bands are proposals for WORLD.md. "Pacifist: yes" means every stage can be
completed with no kill (fleeing is allowed). Bots: M melee · C caster · X explorer · S speedrunner
· P pacifist. Journal text ≤ 40 words per stage. Rep deltas follow D-017 where the choice is a
legacy one.

### 11.1 Table

| Id | Name | Category | Giver | Region | Loop | Pacifist |
|----|------|----------|-------|--------|------|----------|
| `q_echo_crystal` | Echoes in the Library | Remnants 1 (legacy) | Ilyra | Silverwood Ruins | 1+ | yes (flee) |
| `q_lost_scroll` | The Scholar's Lost Scroll | Remnants 2 (legacy) | Ilyra | Silverwood Ruins | 1+ | 2+ via `q_the_first_drowned` |
| `q_keepers_ledger` | The Keeper's Ledger | Remnants 3 | Keeper Ansel Dray | Silverwood Ruins / Drowned Reach | 2+ | yes |
| `q_clear_path` | Clear the Barren Peaks | Ironclad 1 (legacy) | Brak | Mistwood & Reach | 1+ | no |
| `q_blighted_outpost` | The Blighted Outpost | Ironclad 2 (legacy) | Brak | Mistwood & Reach | 1+ | no |
| `q_day_of_teeth` | The Day of Teeth | Ironclad 3 | Hadda Ironvow | Ashen Steppe / Nexus | 2+ | no |
| `q_void_shards` | Whispers of the Void | Weavers 1 (legacy) | Nyx | Voidscar | 1+ | no |
| `q_hollow_choir` | The Hollow Choir | Weavers 2 | Sethe the Unlidded | The Veil | 1+ | yes |
| `q_unlidded_eye` | The Unlidded Eye | Weavers 3 | Sethe | The Veil / Nexus | 2+ | no |
| `q_echoing_heartbeat` | The Echoing Heartbeat | Regional: Silverwood Ruins (legacy) | auto (2 quests done) | Silverwood Ruins | 1+ | yes |
| `q_bell_vault` | The Bell Vault | Regional: Drowned Reach | discovery / Keeper Dray | Drowned Reach | 1+ | no |
| `q_bone_road` | The Bone Road | Regional: Ashen Steppe | Hadda Ironvow | Ashen Steppe | 1+ | no |
| `q_lightless_stair` | The Lightless Stair | Regional: The Veil | discovery | The Veil | 1+ | yes |
| `q_the_drowned_lantern` | The Drowned Lantern | Regional: The Glowfen | Elder Wen Thistlecourt | The Glowfen | 1+ | yes |
| `q_high_mark` | The High Mark | Regional: Skyreach | discovery / Dask | Skyreach | 1+ | yes |
| `q_the_still_shore` | The Still Shore | Regional: Threshold | auto (first Fall) | The Threshold | 2+ | yes |
| `q_voices_in_the_stacks` | Voices in the Stacks | Ilyra 1 | Ilyra | Silverwood Ruins | 2+ | yes |
| `q_the_danthe_line` | The Danthe Line | Ilyra 2 | Ilyra | Drowned Reach | 2+ | yes |
| `q_the_keepers_price` | The Keeper's Price | Ilyra 3 | Keeper Dray / Ilyra | Silverwood Ruins | 2+ | yes |
| `q_the_scouts_oath` | The Scout's Oath | Brak 1 | Brak | Ashen Steppe | 1+ | no |
| `q_blood_and_salt` | Blood and Salt | Brak 2 | Brak / Kaelen | Mistwood & Reach | 1+ | yes |
| `q_the_line_he_holds` | The Line He Holds | Brak 3 | Brak | Mistwood & Reach / Nexus | requires `echo_brak_death` | yes |
| `q_tears_of_the_breach` | Tears of the Breach | Nyx 1 | Nyx | Voidscar / Veil | 1+ | yes |
| `q_the_dark_between` | The Dark Between | Nyx 2 | Nyx | The Veil | 2+ | yes |
| `q_what_she_would_undo` | What She Would Undo | Nyx 3 | Nyx | Voidscar | requires `echo_nyx_is_of_the_nine` | yes |
| `q_the_flickering_man` | The Flickering Man | Dask 1 | Dask | Highlands | 2+ | yes |
| `q_seven_marks` | Seven Marks | Dask 2 | Dask | Threshold / Skyreach | 2+ | yes |
| `q_the_last_instant` | The Last Instant | Dask 3 | Dask | Apex | requires `echo_tyrant_speaks` | yes |
| `q_lantern_in_the_reeds` | Lantern in the Reeds | Mireya 1 | Mireya | The Glowfen | 1+ | yes |
| `q_what_the_light_takes` | What the Light Takes | Mireya 2 | Mireya | The Glowfen | 1+ | yes |
| `q_preserve_or_heal` | Preserve or Heal | Mireya 3 | Mireya | The Glowfen | requires `echo_breathing_pool` | yes |
| `q_the_apprentices_errand` | The Apprentice's Errand | Caelum 1 | Caelum | Silverwood Before | requires `echo_before_route` | yes |
| `q_a_boy_from_a_doomed_city` | A Boy from a Doomed City | Caelum 2 | Caelum | Silverwood Before | 2+ | yes |
| `q_his_masters_sin` | His Masters' Sin | Caelum 3 | Caelum | Apex | requires `echo_caelum_unanchored` | yes |
| `q_the_thirtieth_dawn` | The Thirtieth Dawn | Loop-only | Keeper Dray | Silverwood Ruins | 2+ | yes |
| `q_what_the_crystal_heard` | What the Crystal Heard | Loop-only | self (Amulet) | Silverwood Ruins / Voidscar | requires `echo_nine_voices` | yes |
| `q_stop_the_ritual` | Stop the Ritual | Loop-only (Silverwood Before) | self | Silverwood Before | requires `echo_before_route` | yes |
| `q_the_first_drowned` | The First Drowned | Loop-only | discovery | Sunken Archives | requires `echo_oriel_drowned` | yes |
| `q_wardens_vigil` | The Warden's Vigil | Ending A | Dask | Apex | requires `echo_litany_complete` | yes |
| `q_the_mending` | The Mending | Ending B | Borin / Caelum / Ilyra | Emberforge / Before / Apex | requires `echo_anchor_mechanic` | yes |
| `q_weavers_dawn` | The Weaver's Dawn | Ending C | Nyx | Apex / Before | requires Weavers Sworn | no |
| `q_iron_silence` | The Iron Silence | Ending D | Hadda Ironvow | Emberforge / Apex | requires `echo_iron_that_does_not_wish` | no |
| `q_long_archive` | The Long Archive | Ending E | Keeper Dray | Heartstone Depths | requires `echo_heartstone_resonance` | yes |
| `q_unbound` | The Unbound | Ending F | the Tyrant | Apex | 2+ | yes |

### 11.2 Faction chains

#### `q_echo_crystal` — Echoes in the Library (legacy)
**Giver / where:** Ilyra, Whispering Ruins. Silverwood Ruins, band 1–3. **Prereq:** none.
**Stages.** 1. Reach the Shattered Library. Journal: "Retrieve the Echo Crystal from the Shattered
Library to the north of Whispering Ruins." **[legacy]** Done: `{ location: "shattered_library" }`.
2. Take the Crystal from the third alcove behind the fallen shelf (shortcut: `echo_crystal_location`
skips the search). Done: `{ item: "echo_crystal", count: 1 }`. 3. Return to Ilyra and choose.
**Choices.** Give: Remnants +15; `echo_litany_verse_1` on next talk; flag `crystal_given`. Keep:
Weavers +10, Remnants −10; flag `kept_echo_crystal`; Loop 2+ *Listen* → `echo_litany_verse_1` +
`echo_nine_voices` at once. Both: `echo_crystal_location`.
**Rewards.** 60 xp, 20 gold (half xp if kept **[legacy]**). **Bots:** M C X S P. **Loop:** 1+.

#### `q_lost_scroll` — The Scholar's Lost Scroll (legacy)
**Giver:** Ilyra, after `q_echo_crystal`. Silverwood Ruins, band 1–3.
**Stages.** 1. Descend to the Sunken Archives. Journal: "Retrieve the lost scroll from the Sunken
Archives beneath the Whispering Ruins." **[legacy]** 2. Recover the Scholar's Lost Scroll from the
Drowned Archivist's carrel (kill, or from Loop 2+ with `echo_oriel_drowned`, speak: see
`q_the_first_drowned`). 3. Bring it to Ilyra, or (Loop 2+) to Nyx.
**Choices.** To Ilyra: legacy revelation paragraph; +1 MAG, Mana Bloom; Remnants +10;
`echo_oriel_lineage` seeded (confirmed in `q_the_danthe_line`); `echo_archive_door`. To Nyx (Loop 2+):
Weavers +15, Remnants −15; `echo_breach_recoil`, `echo_litany_verse_8`, `echo_tyrant_jailer`.
**Rewards.** 70 xp. **Bots:** M C X S; P from Loop 2+. **Loop:** 1+.

#### `q_keepers_ledger` — The Keeper's Ledger
**Giver:** Keeper Ansel Dray, Shattered Library reading-room. Silverwood Ruins → Drowned Reach,
band 4–7. **Prereq:** Remnants ≥ 20 and `{ loop: { min: 2 } }`.
**Stages.** 1. Hear the Ledger read: seven names. Journal: "Keeper Dray keeps the Ledger of
Wayfinders. He wants the eighth entry written before it is needed." 2. Recover Pell Ashcombe's
day-count from the Cistern of Names (Drowned Reach). 3. Choose what the Remnants may copy: the
whole Litany you hold, or verse 1 only.
**Choices.** Whole: Remnants +25 (path to Sworn); flag `remnants_hold_litany`; Keeper Dray proposes
ending E. Verse 1 only: Remnants +10; Ilyra approves ("The ink is not ours to lock away").
**Rewards.** 180 xp; Keeper's Copy (quest item: re-read any verse Echo). **Bots:** X S P (C M fine).
**Loop:** 2+.

#### `q_clear_path` — Clear the Barren Peaks (legacy)
**Giver:** Brak, Ironclad Camp. Mistwood & Reach, band 2–5.
**Stages.** 1. Journal: "Defeat the Wildling Brute prowling the Barren Peaks north of Ironclad
Camp." **[legacy]** Done: `{ killed: "wildling_brute", count: 1 }`. 2. Report to Brak: "Brak hands
you Ironclad Mail." **[legacy]**
**Consequences.** Ironclad +10; Brak recruitable. Skipping both Brak quests in a loop keeps him
from the Apex (D-017). **Rewards.** 50 xp, Ironclad Mail. **Bots:** M C S X. **Loop:** 1+.

#### `q_blighted_outpost` — The Blighted Outpost (legacy)
**Giver:** Brak after `q_clear_path`. Band 3–5.
**Stages.** 1. Journal: "Clear the Stone-Hide Golems from the Blighted Outpost east of the Barren
Peaks." **[legacy]** Done: no Stone-Hide Golem remains at the Outpost. 2. Report: "Brak clasps your
forearm and hands over Ironclad Plate Armor." / "Your body feels tougher after the ordeal."
**[legacy]**
**Consequences.** Ironclad +15; Brak Loyal; Vane's sigil noticed on the golems → `echo_stone_hide_origin`
(codex). Golems resist magic 80% (caster bot must use Physical companions or Storm-on-Soaked).
**Rewards.** 80 xp, Ironclad Plate Armor, +15 max HP. **Bots:** M (C with Brak). **Loop:** 1+.

#### `q_day_of_teeth` — The Day of Teeth
**Giver:** Hadda Ironvow, Ring of Wagons. Ashen Steppe → Nexus, band 8–11. **Prereq:** Ironclad ≥ 20,
`{ loop: { min: 2 } }`.
**Stages.** 1. Hear the Telling of Year 178. Journal: "Hadda wants Corwen Blackreed's axe back from
the Nexus, where twenty held a horde for a day." 2. Fight through a Horde-echo at the Nexus (three
waves of Unravelled). 3. Recover Blackreed's Axe. 4. Return; Hadda asks what the Tyrant is.
**Choices.** Tell her the truth (needs `echo_tyrant_jailer`): Ironclad +20; she proposes ending D
*and* promises to keep the Nomads from the Apex; `echo_day_of_teeth`. Tell her it is a monster:
Ironclad +25; she sends scouts east; Clock −2 (they thin the hold).
**Rewards.** 260 xp, Blackreed's Axe (Physical, +Armor Break). **Bots:** M C. **Loop:** 2+.

#### `q_void_shards` — Whispers of the Void (legacy)
**Giver:** Nyx, Chasm of Whispers. Voidscar, band 4–6.
**Stages.** 1. Journal: "Collect three Void Shards from the corrupted creatures in the Voidscar
Hollow east of the Chasm of Whispers." **[legacy]** Done: `{ item: "void_shard", count: 3 }`.
2. Return: "Nyx extends a gloved hand for the shards. Give them?" **[legacy]**
**Choices.** Give: Weavers +20; Shadow-Kissed Dagger; Nyx's speech **[legacy]**; Nyx recruitable.
Refuse: keep shards (void-forged gear at the Emberforge), Ironclad +5; Nyx Wary **[D-017]**.
**Rewards.** 90 xp. **Bots:** M C S. **Loop:** 1+.

#### `q_hollow_choir` — The Hollow Choir
**Giver:** Sethe the Unlidded, the Hollow Choir (Veil). Band 7–10. **Prereq:** Weavers ≥ −9;
reached via `q_lightless_stair`.
**Stages.** 1. Journal: "Sethe will let you hear the Choir if you bring one thing torn from a
moment. A Shard, or a memory." 2. Offer a Void Shard, or (Loop 2+) *Listen* with the Amulet and
offer an Echo (any `echo_litany_verse_*`; it is not lost). 3. Hear the Choir sing the eighth verse
wrong.
**Choices.** Correct them (needs `echo_litany_verse_8`): Weavers +15; Sethe suspects Nyx.
Say nothing: Weavers +10. **Rewards.** 160 xp; Choir Mask (Void resist). **Bots:** X S P C.
**Loop:** 1+.

#### `q_unlidded_eye` — The Unlidded Eye
**Giver:** Sethe after `q_hollow_choir`. Veil → Nexus, band 8–11. **Prereq:** Weavers ≥ 20.
**Stages.** 1. Journal: "Sethe wants to see what Nyx has seen. Bring the lens of a thing that
looks between moments." 2. Kill a Temporal Aberration at the Nexus and take an Aberrant Eye.
3. Return; Sethe looks through it at Nyx.
**Choices.** Warn Nyx first: she leaves the sanctum for a day; Weavers +10; Nyx Loyal. Let Sethe
look: Weavers +20; Sethe sees the seam on Nyx; `echo_choir_knows`; Nyx Wary. Either: at Weavers
Trusted, `echo_void_resonance` is granted by Nyx or by Sethe ("the Shards sing one note; it is the
note of the tear closing, not opening"). **Rewards.** 240 xp; Unlidded Eye (amulet: see intents one
turn early). **Bots:** M C. **Loop:** 2+.

### 11.3 Regional quests

#### `q_echoing_heartbeat` — The Echoing Heartbeat (legacy; Silverwood Ruins pivot)
**Giver:** automatic after two completed quests: "A Distant Pulse." **[legacy]** Band 3–5.
**Stages.** 1. Journal: "Follow the pulsing call beneath the Whispering Ruins to the hidden
Heartstone." **[legacy]** 2. In the Depths, choose.
**Choices (D-017).** Stabilize: Clock +6; Remnants +15; `echo_heartstone_resonance`; Stabilized
Heartstone; Ley-tuned crafting. Exploit: Heartstone Core; Clock −5; Weavers +15, Remnants −15; Depths
unstable; `echo_heartstone_hunger`. Destroy: Clock −10; Breach-born −25% HP; Ironclad +20, Remnants
−25, Weavers −10; Ley abilities +25% MP; Depths dark; `echo_heartstone_silence`; +20 max HP **[legacy]**.
Wait: nothing **[legacy]**. **Rewards.** per choice. **Bots:** all. **Loop:** 1+.

#### `q_bell_vault` — The Bell Vault
**Where:** Drowned Reach, band 4–7. **Giver:** discovery (the flooded stair below the Sunken
Archives) or Keeper Dray. **Prereq:** `{ any: [ { echo: "echo_archive_door" }, { quest: "q_lost_scroll", stage: "complete" } ] }`.
**Stages.** 1. Journal: "A flooded stair drops below the Archives. Something rings down there on
the hour." 2. Find the three sunken bells and ring them in Silverwood's order (Plaza, Gate,
Archive; the order is written on the Plaza fountain). 3. The water drops a level: the Cistern of
Names and the Door of Pages are reachable. Drowned Archivists stir.
**Consequences.** Clock −1 (a day in the dark). `echo_bell_vault`. **Rewards.** 150 xp; Bell-Vault
Key; Glyphbound Lantern. **Bots:** M C X. **Loop:** 1+.

#### `q_bone_road` — The Bone Road
**Where:** Ashen Steppe, band 5–8. **Giver:** Hadda Ironvow. **Prereq:** reached the Ring of Wagons.
**Stages.** 1. Journal: "Hadda's wagons must cross the Bone Road before the salt-wind. Ride ahead
and clear the cairns." 2. Clear two cairn-ambushes (Wildling Brutes, Void-Touched Stalkers).
3. At Hallow's Cairn, read the ember-bowl inscription.
**Consequences.** Ironclad +10; `echo_hallows_ember`; with Borin's forge-mark in inventory,
`echo_iron_that_does_not_wish`. **Rewards.** 170 xp, 40 gold; Salt-Wind Cloak. **Bots:** M C X.
**Loop:** 1+.

#### `q_lightless_stair` — The Lightless Stair
**Where:** The Veil, band 7–10. **Giver:** discovery at the bottom of the Chasm.
**Stages.** 1. Journal: "A stair goes down from the Chasm into the Veil. Nothing lit survives it."
2. Descend without a light source (lanterns are extinguished; Blind applies; `Phase` or Nyx's
signature negates). 3. Reach the Hollow Choir.
**Consequences.** `echo_lightless_stair` (shortcut: the stair is lit for you by the Choir
thereafter). **Rewards.** 140 xp. **Bots:** X S P (C with Nyx). **Loop:** 1+.

#### `q_the_drowned_lantern` — The Drowned Lantern
**Where:** The Glowfen, band 7–10. **Giver:** Elder Wen Thistlecourt, Lanternreed.
**Stages.** 1. Journal: "Lanternreed's lantern-boat sank in the Reed Maze. Without it the village
cannot find the Breathing Pool at night." 2. Navigate the Reed Maze (the glow pulses mark the
way; Mirelings follow but do not attack a lit party). 3. Raise the boat; relight the Lantern of
Lanternreed with Glow Moss.
**Consequences.** Glowfen folk Neutral→friendly (not a faction; flag `lanternreed_trusts`);
Mireya recruitable. **Rewards.** 150 xp; Stilt-walker's Boots (+AGI, no Soaked). **Bots:** X P
(all). **Loop:** 1+.

#### `q_high_mark` — The High Mark
**Where:** Skyreach, band 9–12. **Giver:** discovery (the Wind Stair above the Plateau) or Dask.
**Stages.** 1. Journal: "Above the plateau the markers point up. The Nomads say the sky can be
seen from its edge." 2. Climb the Wind Stair (Sky-Whisper Sentinels patrol; a Sky-Whisper Talisman
lets you pass as "wind-kin" without a fight). 3. At the High Mark, look east.
**Consequences.** The Breach's edge is visible as a line in the sky, creeping: `echo_breach_clock`
(if not already); `echo_high_mark`. **Rewards.** 200 xp; Sky-Whisper Cloak. **Bots:** X P S.
**Loop:** 1+.

#### `q_the_still_shore` — The Still Shore
**Where:** The Threshold. **Giver:** automatic on first `closer_fall`. **Prereq:** `{ loop: { min: 2 } }`.
**Stages.** 1. Journal: "Grey water, no horizon, a far light. You are between loops. Walk the four
places." 2. The Gallery of Loops (see Loop 1 recorded). 3. The Loom (spend one Resonance). 4. The
Far Light; before stepping through, look back at the water.
**Consequences.** `echo_threshold`; the figure on the water is seen (`echo_six_in_the_mass`
hinted). **Rewards.** 5 Resonance. **Bots:** all. **Loop:** 2+.

### 11.4 Companion arcs

#### `q_voices_in_the_stacks` — Voices in the Stacks (Ilyra 1)
**Giver:** Ilyra, after `q_echo_crystal`, Loop 2+. Silverwood Ruins, band 1–3.
**Stages.** 1. Journal: "Ilyra hears the Library at night in a voice like her own. Wait with her
past the second watch." 2. Rest in the Shattered Library; the whispers resolve into verse 1, looped.
3. Ask her what she would say to someone who claimed to know her. She chooses: "the ink still holds."
**Consequences.** `echo_ilyra_watchword` (usable from the next loop); Ilyra recruitable; Remnants +5.
**Rewards.** 90 xp. **Bots:** all. **Loop:** 2+. Pacifist.

#### `q_the_danthe_line` — The Danthe Line (Ilyra 2)
**Giver:** Ilyra after `q_bell_vault`. Drowned Reach, band 4–7. **Prereq:** `echo_archive_door` or
Bell-Vault Key.
**Stages.** 1. Journal: "The Door of Pages opens only to Oriel's seal. Ilyra wears the Remnants'
seal. Try it." 2. Open the Door; reach Oriel's carrel. 3. Meet the First Drowned
(`scene_the_first_drowned`); Ilyra chooses the ring or leaves it (7.1).
**Consequences.** `echo_oriel_lineage`; `echo_oriel_drowned`; Remnants +10 or −5; Ilyra Loyal.
**Rewards.** 200 xp; Oriel's Ring (Ley +1) if taken. **Bots:** all. **Loop:** 2+. Pacifist.

#### `q_the_keepers_price` — The Keeper's Price (Ilyra 3)
**Giver:** Keeper Dray, with Ilyra present. Silverwood Ruins. **Prereq:** Ilyra Loyal; `echo_ilyra_cost`
or `q_keepers_ledger` complete.
**Stages.** 1. Journal: "Dray knows what tearing a portal costs the one who tears it. He wants
Ilyra to hear it from him." 2. The telling: each portal costs years she will not get back; the
Keeper's way costs everything and keeps everything. 3. Ilyra chooses.
**Choices.** *Keeper* (stage flag `keeper`): path to E; Remnants +15. *Never again* (`unbound_hand`):
path to B; she can anchor the present end without tearing. **Rewards.** 220 xp. **Bots:** all.
**Loop:** 2+. Pacifist.

#### `q_the_scouts_oath` — The Scout's Oath (Brak 1)
**Giver:** Brak after `q_blighted_outpost`. Ashen Steppe, band 5–8.
**Stages.** 1. Journal: "Brak must report to the Ring of Wagons. Ride with him across the Steppe."
2. Two Steppe ambushes. 3. At the Ring, Hadda calls him "Brak of the Ironclad"; that night he says
the other name once.
**Consequences.** `echo_brak_birth_name`; Ironclad +10. **Rewards.** 160 xp; Scout's Whistle (call
Brak to the active slot at any camp). **Bots:** M C. **Loop:** 1+.

#### `q_blood_and_salt` — Blood and Salt (Brak 2)
**Giver:** Brak (or Kaelen, with `echo_brak_birth_name`). Mistwood & Reach.
**Stages.** 1. Journal: "Kaelen sells salt. Brak needs salt for the camp and will not ask. Carry it."
2. Buy or earn a sack of Respite salt (Kaelen gives it free if told who it's for). 3. Bring it to
Brak; return with his answer (`scene_braks_brother`).
**Choices.** A: the brothers speak; Father's Whetstone to Brak; Ironclad +5. B: Kaelen refuses;
nothing; Brak says it's fine. **Rewards.** 120 xp. **Bots:** all. **Loop:** 1+. Pacifist.

#### `q_the_line_he_holds` — The Line He Holds (Brak 3)
**Giver:** Brak. **Prereq:** `{ all: [ { echo: "echo_brak_death" }, { quest: "q_blighted_outpost", stage: "complete" } ] }`.
**Stages.** 1. Journal: "You know how Brak dies. Tell him." 2. He asks for proof: name the Apex
floor's colour, or the words he said. 3. He chooses (7.2 outcomes A/B/C).
**Consequences.** A: `brak_kept_away`; he lives. B: dies as before if the Tyrant falls. C (needs
`q_blood_and_salt` A): he holds the Nexus and lives; `echo_brak_lives`. Ironclad +10 any.
**Rewards.** 200 xp. **Bots:** all. **Loop:** requires Echo. Pacifist.

#### `q_tears_of_the_breach` — Tears of the Breach (Nyx 1)
**Giver:** Nyx after `q_void_shards` (given). Voidscar → Veil, band 4–8.
**Stages.** 1. Journal: "Nyx will teach you to read a Shard. Bring one to the Chasm's edge at
night." 2. Hold a Void Shard while she speaks; see a torn moment: a stair, a boy, a bell. 3. Ask
whose moment it is. She does not answer. Weavers +10.
**Consequences.** `echo_shard_moments` (Shards are moments; codex). **Rewards.** 110 xp; one Void
Shard. **Bots:** all. **Loop:** 1+. Pacifist.

#### `q_the_dark_between` — The Dark Between (Nyx 2)
**Giver:** Nyx, Loop 2+, after `q_tears_of_the_breach` or with `echo_nine_voices`. The Veil.
**Stages.** 1. Journal: "Nyx keeps a cell in the Veil no one enters. She has asked you in."
2. Nyx's Cell: a wall of nine names, eight crossed out. 3. `scene_nyx_unmasking`.
**Choices.** Keep her secret: Weavers +10; Nyx Loyal. Tell Sethe: Weavers −20; `echo_choir_knows`;
Nyx Hostile this loop. **Consequences.** `echo_nyx_is_of_the_nine`, `echo_litany_verse_8`.
**Rewards.** 220 xp. **Bots:** all. **Loop:** 2+. Pacifist.

#### `q_what_she_would_undo` — What She Would Undo (Nyx 3)
**Giver:** Nyx. **Prereq:** `echo_nyx_is_of_the_nine`; Nyx Loyal.
**Stages.** 1. Journal: "Nyx wants to go back to the sixth verse and say what Hallow said, with a
reason. She needs the Breach open and a Wayfinder beside her." 2. Hear the plan at the Hollow.
3. Answer.
**Choices.** *Agreed*: path to C; Weavers +15. *Refused with the truth* (`echo_ritual_inevitable`):
she breaks, then thanks you; if Weavers ≥ 20, `echo_void_resonance`. *Refused flatly*: Weavers −10.
**Rewards.** 240 xp. **Bots:** all. **Loop:** requires Echo. Pacifist.

#### `q_the_flickering_man` — The Flickering Man (Dask 1)
**Giver:** Dask, Shimmering Pass, Loop 2+. Highlands, band 6–9.
**Stages.** 1. Journal: "Dask is in four places at once, mid-sentence. Find the other three and hear
the whole sentence." 2–4. Moments at the Spires, the Plateau, the Nexus (each: approach, *Listen*).
5. The sentence: "Don't kill it; it's the only thing holding the door, and I think it knows my name."
**Consequences.** `echo_flickering_man`; `echo_tyrant_jailer` if not held. **Rewards.** 150 xp;
Dask's Scout Badge (Chrono resist). **Bots:** X P S. **Loop:** 2+. Pacifist.

#### `q_seven_marks` — Seven Marks (Dask 2)
**Giver:** Dask at the Threshold or the High Mark. **Prereq:** `echo_threshold`.
**Stages.** 1. Journal: "Seven Wayfinders left marks. Dask knows where six are. The seventh is
his." 2. Find the marks in the Gallery of Loops (they are the Gallery's first seven frames).
3. At the High Mark, Dask scratches the eighth frame's outline and leaves it blank.
**Consequences.** `echo_seven_wayfinders`, `echo_wayfinder_symptom`; codex ×7. **Rewards.** 180 xp;
10 Resonance. **Bots:** X P. **Loop:** 2+. Pacifist.

#### `q_the_last_instant` — The Last Instant (Dask 3)
**Giver:** Dask. **Prereq:** `echo_tyrant_speaks`; Dask Loyal; at the Apex in communion.
**Stages.** 1. Journal: "The Tyrant can gather Dask into one instant. He has asked you to ask it."
2. In Movement III, ask. 3. Dask chooses (7.4 A/B).
**Consequences.** A: `echo_dask_rest`; Phase 3 one voice quieter. B: `dask_anchor` flag (present-end
anchor for B if Ilyra swore off tearing). **Rewards.** 260 xp. **Bots:** all. **Loop:** requires
Echo. Pacifist.

#### `q_lantern_in_the_reeds` — Lantern in the Reeds (Mireya 1)
**Giver:** Mireya, Lanternreed. The Glowfen, band 7–10.
**Stages.** 1. Journal: "Three of Lanternreed are sick with the shining. Mireya needs Glow Moss,
bitterroot, and a pair of steady hands." 2. Gather 3 Glow Moss + 2 Bitterroot (Reed Maze). 3. Tend
the sick; a child's eyes go Mireling-green and she says she can see the stars under the water.
**Consequences.** Mireya recruitable; `lanternreed_trusts`. **Rewards.** 140 xp; Fenlight Salve ×3.
**Bots:** X P (all). **Loop:** 1+. Pacifist.

#### `q_what_the_light_takes` — What the Light Takes (Mireya 2)
**Giver:** Mireya after stage 1. The Glowfen.
**Stages.** 1. Journal: "The Breathing Pool is where the glow is born. Elder Wen forbids it. Mireya
is going anyway." 2. Reach the Pool through the Drowned Lantern's route. 3. *Listen*: Sallow's
verse, breathing. Mireya: "It's a person. It's been a person the whole time."
**Consequences.** `echo_breathing_pool`, `echo_litany_verse_6`. **Rewards.** 200 xp. **Bots:** X P
(all). **Loop:** 1+. Pacifist.

#### `q_preserve_or_heal` — Preserve or Heal (Mireya 3)
**Giver:** Mireya / Elder Wen. **Prereq:** `echo_breathing_pool`.
**Stages.** 1. Journal: "Dam the leak with a Stabilized Heartstone fragment, or let it run. Mireya
will stand by either. Elder Wen will not." 2. Choose at the Pool.
**Choices.** Dam (needs Stabilized Heartstone): `echo_glowfen_dammed`; Clock +2; some sicken;
Elder Wen Hostile. Let run: `echo_glowfen_let_run`; Clock −2; the fen folk brighten; Mireya's
*Lantern* also Hastes. **Rewards.** 240 xp. **Bots:** all. **Loop:** requires Echo. Pacifist.

#### `q_the_apprentices_errand` — The Apprentice's Errand (Caelum 1)
**Giver:** Caelum, Archive stair, Silverwood Before. **Prereq:** `echo_before_route`.
**Stages.** 1. Journal: "Caelum carries Master Thal's message to the Spire Yard. He has never
arrived. Walk with him." 2. Cross the Plaza on Day −1 at dusk. 3. Aulde reads it: *begin*. She
laughs.
**Consequences.** `echo_litany_verse_5` (she sings it); Caelum trusts you. **Rewards.** 150 xp.
**Bots:** X P. **Loop:** requires Echo. Pacifist.

#### `q_a_boy_from_a_doomed_city` — A Boy from a Doomed City (Caelum 2)
**Giver:** Caelum after the errand. Silverwood Before.
**Stages.** 1. Journal: "Caelum remembers you between resets. He has asked what you know. Decide
what to show him." 2. Open the Breach-door from the Before side; one glimpse of the Shattered
Library. 3. He chooses (7.6 A/B); `scene_caelum_crossing`.
**Consequences.** A: `echo_caelum_unanchored`; Caelum recruited. B: `echo_caelum_stayed`.
**Rewards.** 220 xp. **Bots:** X P. **Loop:** 2+. Pacifist.

#### `q_his_masters_sin` — His Masters' Sin (Caelum 3)
**Giver:** Caelum in the present. **Prereq:** `echo_caelum_unanchored`; at the Apex in communion.
**Stages.** 1. Journal: "Caelum wants to speak to Master Thal. Let him." 2. Movement II: Caelum
answers Masque's question himself. 3. Veyran says the one thing he will not say to the living, to
him. Caelum forgives or cannot (7.6).
**Consequences.** `echo_caelum_forgives` or `echo_caelum_cannot`; consent in B comes without a
second test if forgiven. **Rewards.** 260 xp. **Bots:** all. **Loop:** requires Echo. Pacifist.

### 11.5 Loop-only quests

#### `q_the_thirtieth_dawn` — The Thirtieth Dawn
**Giver:** Keeper Dray, Loop 2+. **Prereq:** `{ any: [ { echo: "echo_thirtieth_dawn" }, { echo: "echo_breach_clock" }, { loop: { min: 2 } } ] }`.
**Stages.** 1. Journal: "Dray's water-clock and the Heartstone's pulse are drifting apart. Measure
the drift." 2. Count the Heartstone's beats for one watch in the Depths. 3. Compare at the
Library: the number is the days remaining.
**Consequences.** `echo_breach_clock`; the Breach Clock shows every clock effect from now on.
**Rewards.** 120 xp. **Bots:** all. **Loop:** 2+. Pacifist.

#### `q_what_the_crystal_heard` — What the Crystal Heard
**Giver:** the Amulet (self). **Prereq:** `echo_nine_voices` and the Crystal kept this loop.
**Stages.** 1. Journal: "Nine voices. One of them is in the Chasm. Make her hear herself." 2. Bring
the Crystal to the Chasm and *Listen* in front of Nyx. 3. She hears the eighth verse in her own
voice. (`scene_nyx_unmasking`, alternate entry.)
**Consequences.** `echo_nyx_is_of_the_nine`; `echo_ninth_verse_unfinished`; Weavers −5 (she is
angry), then Nyx Loyal if you keep it from Sethe. **Rewards.** 180 xp. **Bots:** all. **Loop:**
requires Echo. Pacifist.

#### `q_stop_the_ritual` — Stop the Ritual
**Where:** Silverwood Before. **Prereq:** `echo_before_route`. Four attempts (9.4), one per reset.
**Stages.** 1. Journal: "You are three days before the Sundering. Try." 2–5. Warn Veyran; keep
Hallow; steal the record; break the cradle. 6. Masque, from the roof.
**Consequences.** `echo_hallow_said_stop` (attempt 2), `echo_ritual_inevitable` (attempt 4),
verses 4, 7, 9 heard. **Rewards.** 300 xp; 15 Resonance. **Bots:** X P. **Loop:** requires Echo.
Pacifist.

#### `q_the_first_drowned` — The First Drowned
**Where:** Sunken Archives. **Prereq:** `echo_oriel_drowned`.
**Stages.** 1. Journal: "The Drowned Archivist guarding the scroll is Oriel Danthe. Show her the
seal, or the Amulet." 2. Approach without drawing; show Oriel's Ring or *Listen*. 3. She gives the
scroll and the first verse in her own voice.
**Consequences.** `q_lost_scroll` stage 2 completes without combat; `echo_litany_verse_1` if not
held; Remnants +5. **Rewards.** 100 xp. **Bots:** P X. **Loop:** requires Echo. Pacifist.

### 11.6 Ending quests

#### `q_wardens_vigil` — The Warden's Vigil (A)
**Giver:** Dask. **Prereq:** `echo_litany_complete`. **Stages.** 1. Journal: "You know all nine
verses. Dask says someone who knows them could take his place. Go and see if it's you." 2. Reach
the Apex; communion to Movement III with Resolve ≥ 6. 3. Choose to step in (`scene_ending_vigil`).
**Rewards.** `ending_wardens_vigil`. **Bots:** all. Pacifist.

#### `q_the_mending` — The Mending (B)
**Givers:** Borin (anchor), Caelum (cradle-pin), Ilyra or Dask (present end). **Prereq:**
`echo_anchor_mechanic`, `echo_heartstone_resonance`, `echo_void_resonance`, `echo_litany_complete`.
**Stages.** 1. Journal: "Both ends. Borin can forge an anchor from Aetherium, a stabilized
Heartstone fragment, and a Shard that remembers the tear closing." 2. Forge the Breach-anchor at
the Emberforge (Aetherium Shard + Stabilized Heartstone + Void Shard; Borin needs
`echo_iron_that_does_not_wish`). 3. In the Before, Caelum sets Hallow's cradle-pin on the rim
(`scene_anchor_in_the_conflux`); return; it lies in the Depths. 4. Apex: communion; consent; drive
the anchor (`scene_ending_mending`). **Rewards.** `ending_mending`. **Bots:** all (communion). Pacifist.

#### `q_weavers_dawn` — The Weaver's Dawn (C)
**Giver:** Nyx. **Prereq:** Weavers ≥ 60; `heartstone_exploited`; Nyx Loyal; `q_what_she_would_undo`
agreed. **Stages.** 1. Journal: "Nyx is ready to look at his face. Take the Core to the Apex."
2. Reach the Apex with the Heartstone Core; fight through the hold's failing (two waves). 3. Tear
it open together (`scene_ending_dawn`). **Rewards.** `ending_weavers_dawn`. **Bots:** M C.

#### `q_iron_silence` — The Iron Silence (D)
**Giver:** Hadda Ironvow. **Prereq:** Ironclad ≥ 60; `heartstone_destroyed`; Brak alive;
`echo_iron_that_does_not_wish`. **Stages.** 1. Journal: "Hadda wants the line cut under the Apex.
Borin can forge the thing that cuts it." 2. Forge the Breach-anchor (as B; a destroyed Heartstone
leaves "dead fragments" that serve). 3. Apex with Brak; fight the Tyrant to Phase 2 or talk it to
Movement II; drive the anchor (`scene_ending_silence`). **Rewards.** `ending_iron_silence`.
**Bots:** M.

#### `q_long_archive` — The Long Archive (E)
**Giver:** Keeper Dray. **Prereq:** Remnants ≥ 60; `heartstone_stabilized`; Corruption < 6; Ilyra
alive; `q_the_keepers_price` → keeper. **Stages.** 1. Journal: "Set the Stabilized Heartstone back
in its cradle on the twenty-ninth dawn. Ilyra will do the rest." 2. Reach the Depths on Day 29
(the clock must be *managed*; Stabilize's +6 makes it easy). 3. `scene_ending_archive`.
**Rewards.** `ending_long_archive`. **Bots:** all. Pacifist.

#### `q_unbound` — The Unbound (F)
**Giver:** none (the Tyrant's offer). **Prereq:** Loop 2+; Tyrant spared; at the Apex.
**Stages.** 1. Journal: "The tear is open. Nothing is stopping you." 2. Refuse every other path
offered in Movement III. 3. Step through (`scene_ending_unbound`). **Rewards.** `ending_unbound`.
**Bots:** S X. Pacifist.

### 11.7 Stretch quests (not counted; for the lead, if D-019's "44 new" reading is preferred)
`q_korrs_margins` (assemble verse 2 from three Dark Spellbooks; Corruption cost),
`q_vanes_watch` (verse 3 from the Outpost's sigil-stones), `q_the_one_note` (verse 5 by tuning the
Spires with an Aetherium Shard), `q_masques_eye` (verse 7 by reading the sky through the Lens at
the Nexus at dawn), `q_the_respite_ledger` (Kaelen's neutral-ground quest), `q_the_unravelled`
(Horde-only bestiary quest).

---

## 12. Echo catalog (75)

Echoes persist across loops (D-010, D-011). "Discovery" = *Listen* with the Amulet at a place
(Loop 2+ unless noted). Where two sources are listed, either grants the Echo.

| Id | Title | How earned | Unlocks | Exclusive with |
|----|-------|------------|---------|----------------|
| `echo_litany_verse_1` | The Witness | Give Crystal → Ilyra's next talk; or keep Crystal + *Listen* (2+); or `q_the_first_drowned` | Breach-door route (with Lens); communion; codex | — |
| `echo_litany_verse_2` | The Lesson | Read 3 Dark Spellbooks in one loop (margins assemble); or hear it in the Conflux (Before) | Answers Korr | — |
| `echo_litany_verse_3` | The Warding | Discovery at Blighted Outpost (sigil-stones); or Before | Answers Vane | — |
| `echo_litany_verse_4` | The Cradle | Hallow's Cairn (`q_bone_road`); or Before | Answers Hallow's silence; Breach-anchor recipe | — |
| `echo_litany_verse_5` | The Spire | `q_the_apprentices_errand`; or discovery at the Spires holding an Aetherium Shard | Answers Aulde | — |
| `echo_litany_verse_6` | The Breath | `q_what_the_light_takes`; or Before | Answers Sallow | — |
| `echo_litany_verse_7` | The Eye | Discovery at the Nexus through the Lens at dawn; or Before | Answers Masque | — |
| `echo_litany_verse_8` | The Dark Between | `scene_nyx_unmasking` (`q_the_dark_between` / `q_what_the_crystal_heard`); or scroll to Nyx | Correct the Choir; answers Vell | — |
| `echo_litany_verse_9` | The Holding | Tyrant, Movement III (Resolve ≥ 6); or Nyx Loyal recites; or Veyran's study draft (Before) | Required for `echo_litany_complete` | — |
| `echo_litany_complete` | The Litany of the Conflux | Hold all nine | Ending A; Mending; Tyrant falls silent at no gaps | — |
| `echo_heartstone_resonance` | Resonance | Stabilize the Heartstone | Endings B, E; Ley-tuned crafting; dam the Glowfen | hunger, silence (per loop) |
| `echo_heartstone_hunger` | Hunger | Exploit the Heartstone | Ending C flag; Depths unstable encounters | resonance, silence |
| `echo_heartstone_silence` | Silence | Destroy the Heartstone | Ending D flag; Depths dark; Breach-born −25% | resonance, hunger |
| `echo_heartstone_triune` | The Three Beats | Hold all three above | Codex; Borin's anchor dialogue shortcut | — |
| `echo_void_resonance` | The Note of Closing | Weavers Trusted in some loop: Nyx (`q_what_she_would_undo` refused-with-truth) or Sethe (`q_unlidded_eye`) | Ending B requirement; Breach-anchor's third part | — |
| `echo_nine_voices` | Nine Voices | Keep the Crystal; *Listen* in the Library (2+) | "I know what you are, Nyx"; `q_what_the_crystal_heard` | Remnants' Crystal rep (not an Echo) |
| `echo_ninth_verse_unfinished` | The Unfinished Verse | *Listen* to the Crystal (2+); or `q_what_the_crystal_heard` | Communion Movement I answer; codex | — |
| `echo_nyx_is_of_the_nine` | Nyxaria Vell | Unmasking (either route) | Nyx dialogue tree; Dask speaks to her; `q_what_she_would_undo` | — |
| `echo_breach_recoil` | The Recoil | Scroll to Nyx; or Nyx Loyal | Codex; answers Vell in communion | `echo_oriel_lineage` (per loop) |
| `echo_what_she_would_undo` | Her Plan | `q_what_she_would_undo` heard | Ending C path named | — |
| `echo_shard_moments` | Shards Are Moments | `q_tears_of_the_breach` | Codex; Shard-reading flavour | — |
| `echo_choir_knows` | The Choir Knows | Tell Sethe | Sethe dialogue; Nyx Wary on waking | — |
| `echo_ilyra_watchword` | The Ink Still Holds | `q_voices_in_the_stacks` | Ilyra believes you on first meeting (from next loop) | — |
| `echo_crystal_location` | The Third Alcove | Take the Crystal once | Shortcut: `q_echo_crystal` starts at stage 2 | — |
| `echo_oriel_lineage` | The Danthe Line | Scroll to Ilyra, confirmed by `q_the_danthe_line` | Ilyra arc; Oriel's Ring; E flavour | `echo_breach_recoil` (per loop) |
| `echo_oriel_drowned` | The First Drowned | `q_the_danthe_line`; or discovery at Oriel's carrel | `q_the_first_drowned` (pacifist scroll) | — |
| `echo_archive_door` | The Door of Pages | Scroll to Ilyra; or `q_bell_vault` | Route: Sunken Archives → Drowned Reach without the bells | — |
| `echo_ilyra_cost` | What the Door Costs | Watch the Library fall after passing the portal (2+); or Keeper Dray | `q_the_keepers_price` | — |
| `echo_brak_death` | Brak Stonehand | Brak dies at the Apex | `q_the_line_he_holds`; Kaelen dialogue | Brak alive (per loop) |
| `echo_brak_birth_name` | The Dropped Name | `q_the_scouts_oath` | Kaelen: "Don't say that name"; `q_blood_and_salt` via Kaelen | — |
| `echo_brak_lives` | The Line at the Nexus | `q_the_line_he_holds` outcome C | Ending D eased; codex | — |
| `echo_day_of_teeth` | The Day of Teeth | `q_day_of_teeth` told truth; or Keeper Dray's Ledger | Hadda keeps Nomads from the Apex; codex | — |
| `echo_hallows_ember` | Hallow's Ember | Hallow's Cairn | Borin dialogue; codex | — |
| `echo_iron_that_does_not_wish` | Iron That Does Not Wish | Cairn inscription + Borin's forge-mark; or `echo_litany_verse_4` + Borin | Breach-anchor forging (B, D) | — |
| `echo_hallow_said_stop` | Stop | `q_stop_the_ritual` attempt 2; or Before Day −1 | Answers Hallow's silence (+2 Resolve) | — |
| `echo_tyrant_speaks` | It Speaks | *Listen* at the Apex (2+) | Communion; stop combat at phase transitions; `q_the_last_instant` | — |
| `echo_tyrant_name` | Veyran Thal | Ask its name with `echo_nine_voices` or Dask's testimony | Nyx: "You said his name"; codex | — |
| `echo_tyrant_jailer` | The Jailer | Dask; Tyrant; Nyx's scroll reading; `q_the_flickering_man` | Communion Movement I; faction truth-tellings | — |
| `echo_six_in_the_mass` | Six | Communion Movement II complete; or `q_the_still_shore` (hint) | Codex; Phase 2 intents named | — |
| `echo_tyrant_consent` | Consent | Movement III with anchor + cradle-pin | Ending B final sequence | — |
| `echo_tyrant_rejected` | Rejected | Fail communion | Next communion starts at Movement II | — |
| `echo_breach_clock` | The Breach Clock | `q_the_thirtieth_dawn`; or `q_high_mark` | Explicit clock effects | — |
| `echo_thirtieth_dawn` | It Happened Anyway | Clock expiry in Loop 1 or any loop with the Tyrant alive | Communion answer; Keeper Dray's notes | — |
| `echo_amulet_memory` | The Amulet Remembers | Wake in Loop 2 | *Listen* action | — |
| `echo_breach_door` | The Breach-Door | Nexus with Lens + verse 1 | Route to Silverwood Before | — |
| `echo_apex_resonance` | The Way Up | Stand at the Apex once | Nexus→Apex gate opens without six quests (2+) | — |
| `echo_threshold` | The Still Shore | First Fall | Threshold quests; Dask at the shore | — |
| `echo_flickering_man` | The Flickering Man | `q_the_flickering_man` | Dask Loyal; codex | — |
| `echo_seven_wayfinders` | Seven Marks | `q_seven_marks`; or Keeper's Ledger | Codex ×7; communion Movement I | — |
| `echo_wayfinder_symptom` | A Symptom | `q_seven_marks`; or Tyrant Loop 3+ | Codex; ending-F epilogue line | — |
| `echo_dask_rest` | One Instant | `q_the_last_instant` A | Phase 3 one voice quieter; epilogues | `dask_anchor` (per loop) |
| `echo_before_route` | Three Days Before | Enter Silverwood Before | Before quests; Caelum | — |
| `echo_ritual_inevitable` | Always Going to Fail | `q_stop_the_ritual` attempt 4 | Perfect answer to Masque; refuse Nyx with truth | — |
| `echo_caelum_unanchored` | The Boy on the Stair | `q_a_boy_from_a_doomed_city` A | Caelum recruit; `q_his_masters_sin` | `echo_caelum_stayed` (per loop) |
| `echo_caelum_stayed` | He Stayed | `q_a_boy_from_a_doomed_city` B | Harder Mending (player places pin) | `echo_caelum_unanchored` |
| `echo_caelum_forgives` | Forgiven | `q_his_masters_sin` A | Consent without second test | `echo_caelum_cannot` |
| `echo_caelum_cannot` | He Cannot | `q_his_masters_sin` B | Consent after a second test; colder Mending final scene | `echo_caelum_forgives` |
| `echo_anchor_mechanic` | What the Chamber Keeps | Talisman left on the cradle rim found in the Depths | `q_the_mending` | — |
| `echo_bells_of_silverwood` | The Bells | Plaza in the Before on Day −1 | Bell-Vault order known (shortcut) | — |
| `echo_stone_hide_origin` | Vane's Wards | `q_blighted_outpost` with Amulet (2+) or Before | Answers Vane; codex | — |
| `echo_spire_note` | The One Note | Discovery at the Spires | Answers Aulde; codex | — |
| `echo_breathing_pool` | Sallow's Breath | `q_what_the_light_takes` | `q_preserve_or_heal`; answers Sallow | — |
| `echo_eye_of_masque` | The Far Side | Discovery at the Nexus with Lens | Answers Masque; codex | — |
| `echo_korr_marginalia` | The Margins | Read any Dark Spellbook with the Amulet (2+) | Answers Korr; codex | — |
| `echo_glowfen_dammed` / `echo_glowfen_let_run` | Mireya's Choice | `q_preserve_or_heal` | Epilogue variants | each other (per loop) |
| `echo_high_mark` / `echo_bell_vault` / `echo_lightless_stair` | Regional marks | Their regional quests | Shortcuts (stair lit; bells known; Sentinels pass) | — |
| `echo_ending_a` .. `echo_ending_f` | Witnessed | Reach each ending | Gallery frames; New Game+; achievements | — |

---

## 13. Key scenes (20)

Format: purpose · participants · dialogue · choices (condition → effect). Narration lines are
unattributed. **[legacy]** lines are verbatim.

#### `scene_first_meeting_ilyra` — The whispers are louder
**Purpose.** Open the game; from Loop 2, open the loop. **Participants.** Wayfinder, Ilyra. Whispering Ruins, Day 1.
- **Ilyra:** The whispers here are louder each day. The past is trying to speak. Will you help me listen? **[legacy]**
- *[Loop 2+]* She has a smudge of ink on her thumb. You remember the smudge.
- **Choices:** (1) "Yes." → `q_echo_crystal`. (2) "No." → "Ilyra nods, her eyes shadowed with disappointment." **[legacy]** (3) *[loop ≥ 2]* "Ilyra, I've done this before." → **Ilyra:** "Then you'll know I say yes to that with a smile and don't believe a word. Help me listen anyway." Flag `ilyra_told_loop`. (4) *[`echo_ilyra_watchword`]* "The ink still holds." → **Ilyra:** "...I have never said that aloud. Sit down. Tell me everything, and tell me quickly, because if you know *that* you know how little time we have." Ilyra recruitable; Remnants +10. (5) *[`echo_crystal_location`]* "Third alcove, behind the fallen shelf." → `q_echo_crystal` stage 2.

#### `scene_heartstone_choice` — Soothe, seize, or shatter
**Purpose.** The pivot; make the cost audible. **Participants.** Wayfinder; companion if present. Heartstone Depths.
- The relic throbs with unstable power. You sense three paths: soothe it, seize it, or shatter it. **[legacy]**
- **Choices:** 1) Stabilize the Heartstone and align it with the ley lines. 2) Exploit its power and claim it for yourself. 3) Destroy it, ending its pulse forever. **[legacy]**
- **1 →** The chamber calms, and the Heartstone settles into a steady rhythm. / You carry a harmonic fragment of its power. **[legacy]** **[new]** "Far to the east, something that has been bracing for five hundred years leans, very slightly, on you. The thirtieth dawn moves six days off." *[Ilyra present]* **Ilyra:** "It's keeping time with something. Can you hear it? It's keeping time."
- **2 →** You wrench the Heartstone free. The world shudders, and power floods your veins. **[legacy]** **[new]** "Each pulse hurts. Five days fall off the count like teeth." *[Nyx present]* **Nyx:** "Good. Now it has to hold without its anchor. Now we'll see what it is."
- **3 →** The Heartstone cracks. Silence follows, and your body hardens against the loss. **[legacy]** **[new]** "The Depths go dark. Ten dawns are gone. Every Breach-born thing in Aethelgard is a quarter less than it was. So is the thing holding the door." *[Brak present]* **Brak:** "That's the kind of quiet I don't trust."
- **Enter →** The Heartstone continues its slow, waiting beat. **[legacy]**

#### `scene_tyrant_defeat` — Witness the unraveling
**Purpose.** Legacy climax, kept whole. **Participants.** Wayfinder, the Tyrant, Brak (if both his quests done). Apex.
- As the Chronos Tyrant begins to crumble into a pile of temporal dust, a guttural, echoing scream tears through the Apex. **[legacy; "dust,," corrected to "dust,"]**
- *[Loop 2+, `echo_tyrant_speaks`]* **[new]** For one breath it is one voice: **The Tyrant:** "You knew."
- 'You have undone the threads! Now, witness the unraveling!' it shrieks, its voice a chorus of countless dying moments. **[legacy]**
- Brak Stonehand, his face grim and scarred, bursts into the Apex, his heavy axe already drawn. **[legacy]**
- The very air shatters, and from the newly formed chasms, a cacophony of screeches erupts! A tide of grotesque creatures, their eyes burning with hunger, surges towards you. **[legacy]**
- The Temporal Breach spills outward in a cascading collapse. The creatures surge forth, tearing at the fabric of stable reality. **[legacy]**
- **Brak:** Wayfinder! There's no time! The Tyrant's defeat has shattered its hold, and the Temporal Breach is fully unraveling! Reality itself is collapsing! A raw portal has just bloomed in the Shattered Library - Ilyra is there, Wayfinder, using all her Remnant power to hold it open! It's your only way out! You must reach it before this unraveling chaos, the true horrors of the Sundering, swallows the path and seals your last escape! **[legacy]**
- **Brak:** Go! I'll hold them back as long as I can! Don't look back, Wayfinder! Run! **[legacy]**
- **Choices:** Run (the Horde begins). *[Loop 2+]* Stay one watch → `scene_braks_stand`.

#### `scene_braks_stand` — Brak Stonehand
**Purpose.** Show what the player ran from; earn `echo_brak_death`. **Participants.** Brak; Wayfinder watching from the Nexus. Loop 2+.
- From the Nexus the Apex is a wound with a man in it. He has set his feet the way scouts are taught, the off-foot back.
- **Brak:** (to the tide) Steel and stubbornness. Come on, then. One of them's about to run out.
- He takes the first wave. He takes the second. On the third he is laughing, which is how you know.
- **Brak:** Tell Kaelen— no. Don't tell him anything. He'll know.
- The narration names him once, the way the Nomads never do: Brak Stonehand goes down holding the line, and the line holds a moment longer than he does.
- **Effect:** `echo_brak_death`; `echo_ilyra_cost` if the player then watches the Library. No choice; the player may leave at any line.

#### `scene_ilyra_portal` — The Last Threshold
**Purpose.** Legacy ending; the hinge. **Participants.** Ilyra, Wayfinder. Shattered Library, Horde active.
- The Shattered Library. The air here crackles with raw magic, and at its heart, a shimmering, unstable portal tears at the air. Ilyra stands before it, her hands glowing with an intense, straining light, her face etched with fierce concentration as she pours her energy into keeping the portal open. The whispers of the horde grow closer, echoing through the crumbling shelves. **[legacy]**
- *[6 Dark Spellbooks read]* Ilyra's spellbook paragraph. **[legacy]**
- **Ilyra:** Wayfinder! You made it! This portal... it's not just a way from Aethelgard, it's a tear through the Temporal Breach itself! I can't hold it much longer! The unraveling... it's consuming everything! You must step through! Carry the truth of Aethelgard's folly, the knowledge of this collapsing reality, to wherever it leads! Go! Escape... and remember! **[legacy]**
- *[Loop 2+, `ilyra_told_loop`]* **[new]** **Ilyra:** "You said you'd done this. Did I say *remember*? ...Then remember *me*, this time. The ink still holds."
- **Choices:** Enter the portal? (yes/no) **[legacy]** → yes: `closer_escape` / `closer_fall(portal)`.

#### `scene_waking_loop_2` — The Amulet is warm
**Purpose.** The twist lands. **Participants.** Wayfinder. Whispering Ruins, Day 1, Loop 2.
- The air smells of ozone and decay, and a chill wind carries faint whispers. Twisted trees reach into a twilight sky, their branches dotted with glowing crystals. Broken stone tablets litter the ground, etched with worn sigils. **[legacy]**
- A low, resonant hum vibrates under your skin, as if the stones are breathing. **[legacy]**
- The Amulet of Echoes is warm against your throat. You did not pick it up. It is simply there, as it was, as it will be. Your hands remember a portal. The stones remember nothing.
- Breach Clock — Day 1 of 30.
- Ilyra is standing where she stood. She has not seen you yet. She is about to.
- **Choices:** none; proceeds to `scene_first_meeting_ilyra` with the new options. **Effect:** `echo_amulet_memory`.

#### `scene_dask_introduction` — The Flickering Man
**Purpose.** First source for the truth; recruit Dask. **Participants.** Dask, Wayfinder. Shimmering Pass, Loop 2+.
- Light fractures into false paths, then snaps back into focus. **[legacy]** This time, when the light snaps back, he is still there.
- **Dask:** You can see me. You can— don't move, I lose you when you move. Seventy years. You're the first one who looked back.
- **Wayfinder:** Who are you?
- **Dask:** Dask. Scout. Was. Seventh of your lot, if the Remnants still count. You've got a thing round your neck that remembers; I'd have killed for that. Did, in a way.
- **Dask:** Listen, because I skip. It isn't guarding the door. It *is* the door. It's a man, or it was, holding a sentence shut with his teeth. I worked that out a second before it worked out I'd worked it out, and here I am, in four places, mid-word.
- **Wayfinder:** Then what do I do?
- **Dask:** Not what I did. Not what I nearly did either. Someone could take his place. Someone who knew the words. Not me; I'm not *anywhere* long enough.
- **Choices:** "Come with me." → Dask recruited (he cannot leave the Pass until you reach another unstable place; he explains the rule). "Where are the other three of you?" → `q_the_flickering_man`. **Effect:** `echo_tyrant_jailer`, `echo_flickering_man` (hint).

#### `scene_nyx_unmasking` — Nyxaria Vell
**Purpose.** The game's best twist, by either route. **Participants.** Nyx, Wayfinder; Sethe listening at the door (Veil route only).
- *[Veil route]* A wall of nine names in chalk. Eight are crossed out. The ninth has been written and rubbed out and written again.
- *[Crystal route]* You hold the Crystal up and *Listen*, and the eighth voice fills the Chasm, and it is hers.
- **Nyx:** Stop it. *Stop it.* ...There. Now you've heard it, and I can't un-say it, and you can't un-hear it. I was there.
- **Wayfinder:** You're one of the Nine.
- **Nyx:** Nyxaria Vell. Theorist of the Void. Eighth verse. "Open, and be entered." It did. I was the only one who'd named the dark, so the dark took me by the name and threw me *forward*. Five hundred years. I landed in the Hollow with nothing on and my teeth still humming.
- **Wayfinder:** The Tyrant—
- **Nyx:** Is Veyran. Yes. He stepped in. He is *holding* it, Wayfinder, he has been holding it since I fell, and I have not gone to look at his face in forty years because I am a coward, and because I have a plan, and the plan is better than looking.
- **Choices:** "Your secret's safe." → Nyx Loyal; Weavers +10. "The Choir should know." → *[Veil route]* Sethe steps in; Weavers −20; Nyx Hostile this loop; `echo_choir_knows`. "What's the plan?" → `q_what_she_would_undo` opens. **Effect:** `echo_nyx_is_of_the_nine`, `echo_litany_verse_8`, `echo_tyrant_name` if asked.

#### `scene_tyrant_first_words` — It cannot ask
**Purpose.** Second source for the truth; open communion. **Participants.** The Tyrant, Wayfinder. Apex, Loop 2+.
- Reality tears here in violent seams. Impossible angles fold into one another, and the air hums with distant, unsettling screams. **[legacy]**
- You arrive whole. The hour held here is one in which no one has been hurt yet.
- You sense danger... The Chronos Tyrant approaches! **[legacy]**
- Then, under the chorus, one voice. It is tired in a way you do not have a word for.
- **The Tyrant:** You have crossed. So. One of you finally crossed.
- **The Tyrant:** Did you come back to finish it?
- **The Tyrant:** I hold. If I do not hold, you have seen what comes. I cannot ask. Do you understand that I cannot *ask*? To ask is to let go of something, and I have nothing in my hands but this.
- **Wayfinder:** *[`echo_tyrant_name`]* Veyran.
- **The Tyrant:** ...Nobody has said that here. Say it again, or don't. Both will hurt.
- **Choices:** Fight → Phase 1. Listen → communion Movement I; `echo_tyrant_speaks`. Leave → it lets you.

#### `scene_braks_brother` — Blood and salt
**Purpose.** The Stonehand quest's heart. **Participants.** Kaelen, Wayfinder (Brak absent; this is why it works). The Respite.
- **Kaelen:** Steel and salt are all that keep you breathing out here. **[legacy]** You've got a sack of mine over your shoulder and a look I don't like. Who's it for.
- **Wayfinder:** Your brother.
- **Kaelen:** I don't have— (He puts both hands flat on the counter.) He took the oath. You take the oath, you give the name back. He gave *my* name back, Wayfinder. Our father's. Like it was a coat.
- **Wayfinder:** He said it once. At the Ring, in the dark. Stonehand.
- **Kaelen:** ...Did he.
- **Kaelen:** Salt's free. Take the whetstone too. It was Father's. Tell him— tell him it needs oiling, he never oiled anything.
- **Choices:** *[`echo_brak_birth_name`]* "He said it." → outcome A (whetstone; the brothers will speak). Without the Echo: **Kaelen:** "Salt's four gold. Don't come back with messages." → outcome B. **Effect:** per `q_blood_and_salt`.

#### `scene_anchor_in_the_conflux` — Iron that does not wish
**Purpose.** The Mending's far end. **Participants.** Caelum, Wayfinder, Hallow (unaware). Conflux chamber, Day −1, afternoon.
- The Heartstone is whole. It is beautiful, which nobody told you. It beats slow and even in Hallow's iron like a thing asleep.
- **Caelum:** Master Hallow forged the pin in the Yard this morning. He says the cradle wants a second pin and nobody will give him the hour. So I took it.
- **Wayfinder:** You stole from Hallow?
- **Caelum:** I *borrowed* from the only one of them who'd understand. (He sets the pin on the rim.) It isn't for the stone. It's for the thing that stands here after. You said he stands here after.
- The pin does not move. It does not shine. Iron that does not wish.
- **Caelum:** Will it still be here? When the city's gone?
- **Wayfinder:** It'll be the only thing that is.
- **Choices:** none. **Effect:** flag `cradle_pin_anchored`; on return, Hallow's Cradle-Pin lies in the Heartstone Depths beside the broken rim.

#### `scene_caelum_crossing` — Nobody delivered the message
**Purpose.** Recruit Caelum; the arc's turn. **Participants.** Caelum, Wayfinder. The Breach-door, Before side, Day −1.
- Through the door the Shattered Library: collapsed shelves, dust motes, pages turning on their own.
- **Caelum:** That's the Library. That's— the reading room is under *that*. Master Korr's carrel.
- **Wayfinder:** It's five hundred years from now. It's what's left.
- **Caelum:** And the Circle? And the city? ...You don't have to say. Your face says.
- **Caelum:** If I go with you, nobody delivers the message. Nobody *ever* delivered it, did they. That's why he came up the stair looking for me and the Breach was already—
- **Caelum:** I'll come. Not because I'm brave. Because I'd like to be somewhere the bells aren't about to ring.
- **Choices:** "Come." → `echo_caelum_unanchored`; he steps through holding the message. "Stay. It's your city." → **Caelum:** "It is. Thank you for asking." `echo_caelum_stayed`.

#### `scene_the_first_drowned` — Oriel's carrel
**Purpose.** Ilyra's lineage made flesh; a pacifist route to the scroll. **Participants.** The Drowned Archivist (Oriel), Ilyra, Wayfinder. Oriel's carrel, Drowned Reach.
- A sodden scholar bound to drowned pages, still guarding secrets. **[legacy]** She does not rise. She is reading.
- **Ilyra:** (holding up the seal) This is ours. This is— whose is it?
- The Archivist lifts her head. Her eyes are ink. She looks at the seal, and at Ilyra's face, and at the seal.
- **Oriel:** (a voice like a page turning) *Let it be written as it is done.* You have my hands. Who taught you to hold a pen like that?
- **Ilyra:** Nobody. I always—
- **Oriel:** Yes. Take the scroll. I have read it enough. Tell them the ink still holds. *Tell them.*
- **Choices:** Ilyra: take the ring → `echo_oriel_lineage`, Oriel's Ring; leave it → *Unbound Hand*. Wayfinder: *Listen* → `echo_litany_verse_1` in Oriel's voice. **Effect:** `echo_oriel_drowned`; `q_lost_scroll` stage 2 if open.

#### `scene_clock_expiry` — The thirtieth dawn
**Purpose.** The huge clue; alternative Loop 1 closer. **Participants.** Wayfinder, whoever is present.
- The thirtieth dawn does not come up. The sky tears instead, east to west, a seam of no-colour.
- From the Apex, across every mile between, a scream reaches you: guttural, echoing, a chorus of countless dying moments. The Tyrant has not been touched. It is screaming anyway.
- *[Ilyra present]* **Ilyra:** It wasn't *us*. We didn't— Wayfinder, it wasn't us.
- *[Brak present]* **Brak:** That's the Horde. I know the sound. Nobody *did* anything.
- *[Nyx present]* **Nyx:** (very quietly) Thirty. He always said it would be thirty.
- **Choices:** none. Run for the Library (Loop 1: Ilyra tears the portal) or fall. **Effect:** `echo_thirtieth_dawn`.

#### `scene_ending_vigil` — I hold you
**Purpose.** Ending A's last choice. **Participants.** The Tyrant, Wayfinder, companions. Apex, Movement III.
- **The Tyrant:** You have all nine. You could say them. You understand that whoever says the ninth must stay in it.
- **Wayfinder:** I understand.
- **The Tyrant:** Then I will ask you the only thing I have ever been able to ask. *Are you sure.*
- *[Ilyra]* **Ilyra:** There's another way. There's always— (She stops. There isn't, not tonight.) I'll write it down. All of it. I'll write it so it *stays*.
- *[Dask]* **Dask:** Should've been me. Glad it isn't. Both true.
- **Choices:** "I'm sure." → the Litany is spoken (10.1). "Not yet." → return to Movement III options.

#### `scene_ending_mending` — Hour, go
**Purpose.** Ending B's last choice. **Participants.** The Tyrant, Wayfinder, Caelum, companions.
- **The Tyrant:** Both ends. You found the other end. Who set the pin?
- **Caelum:** I did, Master Thal. I borrowed it from Master Hallow. I'm sorry; I never gave it back.
- **The Tyrant:** (a sound that was once a laugh) Caelum. The message. Did you—
- **Caelum:** No. Nobody did.
- **The Tyrant:** Good. It said *begin*. I am sorry, boy. I say it to you because you are the only one here I am allowed to say it to.
- **Wayfinder:** Will you let it go?
- **The Tyrant:** Drive it in, and I will say the word I have not been able to say.
- **Choices:** Drive the anchor → consent; "Hour, *go*." (10.2). Hesitate → **The Tyrant:** "Take the watch you need. I have had many."

#### `scene_ending_dawn` — His face
**Purpose.** Ending C's last choice. **Participants.** Nyx, the Tyrant, Wayfinder.
- Nyx walks to the edge of the mass and looks up, for the first time in forty years, at his face.
- **Nyx:** Veyran. It's me. I'm going to fix it.
- The chorus says her name in eight voices, and then in his.
- **The Tyrant:** Nyxaria. It will not—
- **Nyx:** You don't know that. You *held*. I'm going to *speak*. (to you) Give me the Core. Give me your hand.
- *[`echo_ritual_inevitable`]* **Wayfinder:** It was always going to fail. I've seen it. **Nyx:** Then you've seen the version where I wasn't there.
- **Choices:** Give her the Core → 10.3 sequence (no return). Refuse → Nyx Hostile; the loop continues; `q_weavers_dawn` fails.

#### `scene_ending_silence` — Quiet
**Purpose.** Ending D's last choice. **Participants.** Brak, the Tyrant, Wayfinder.
- **Brak:** That's it? That's the thing I was going to die for?
- **The Tyrant:** Iron that does not wish. He made that for me once. I see what it is for now.
- **Brak:** You're a man.
- **The Tyrant:** I was. Set it well, scout. I would like it to be quick, and I have forgotten how quick feels.
- **Brak:** (to you) Say the word. I'll swing.
- **Choices:** "Now." → Brak hammers the anchor home (10.4). "Wait." → **Brak:** "Don't make me stand here long. I've stood in this door before, I think."

#### `scene_ending_archive` — The thirty-first day
**Purpose.** Ending E's last choice. **Participants.** Ilyra, Wayfinder. Heartstone Depths, Day 29→30→1.
- Ilyra sets the Stabilized Heartstone into the cradle's broken rim. It takes the rhythm like a hand taking a hand.
- **Ilyra:** There. It's keeping time with him now. He'll rest. Not sleep; rest.
- The thirtieth dawn comes up. Nothing tears. It goes down. The first dawn comes up.
- **Ilyra:** I remember. Oh. I remember *all* of it. You in the Ruins, me saying— every time. Is this what it's been like for you?
- **Wayfinder:** Yes.
- **Ilyra:** Then I'll be kinder about it than the world was to you. Go or stay. I'll know which you chose, and I'll be kind about that too.
- **Choices:** Stay → fade on Day 1, the Amulet warm, Ilyra smiling before she sees you. Leave → she tears a portal without pain and you step through to a different shore.

#### `scene_ending_unbound` — Not my world
**Purpose.** Ending F's last choice. **Participants.** The Tyrant, Wayfinder.
- **The Tyrant:** Or go. The tear is open. I will not stop you. I have never been able to stop anyone.
- **Wayfinder:** You'll hold?
- **The Tyrant:** Until the thirtieth dawn. Then I will not. You know what comes. You will not be here for it. That is a kind of answer.
- *[Dask]* **Dask:** Fair. I'd have gone too, if I'd had the neck for it.
- **Choices:** Step through → 10.6. Turn back → Movement III options.

---

## 14. Codex plan (85 entries)

Voices (D-020): **RA** Remnant Archive · **IT** Ironclad Telling · **WF** Weaver Fragment · **WN**
Wayfinder's Notes. Every entry ≤ 220 words. Unlock triggers are conditions (discovery, Echo, or
reading an in-world text).

### 14.1 Table

| Id | Title | Voice | Unlock | Gist |
|----|-------|-------|--------|------|
| `codex_nine_overview` | The Ninefold Circle | RA | `echo_nine_voices` or any two verse Echoes | Nine stood in the Conflux; six are in the Tyrant; one fell forward; one drowned; one walked. |
| `codex_veyran_thal` | Veyran Thal | RA | `echo_tyrant_name` | The Archmagus who called it the Holding and is still holding. |
| `codex_nyxaria_vell` | Nyxaria Vell | WF | `echo_nyx_is_of_the_nine` | "She named the dark and the dark learned her name." |
| `codex_oriel_danthe` | Oriel Danthe | RA | `echo_oriel_drowned` | The Witness; the seal; the record carried out of the chamber. |
| `codex_maelis_korr` | Maelis Korr | WF | `echo_korr_marginalia` or Corruption ≥ 3 | What is read is owed; his hand in every book. |
| `codex_haldric_vane` | Haldric Vane | IT | `echo_stone_hide_origin` | The Warder whose stone still stands where flesh fell. |
| `codex_durn_hallow` | Durn Hallow | IT | `echo_hallows_ember` | The smith who said stop and carried the fire north. |
| `codex_seraphine_aulde` | Seraphine Aulde | WF | `echo_spire_note` | The one note; the Spires hold it. |
| `codex_imre_sallow` | Imre Sallow | RA | `echo_breathing_pool` | The Breath; the Green took what the stone could not. |
| `codex_tovren_masque` | Tovren Masque | RA | `echo_eye_of_masque` | He read the sky; it said no; he read it again. |
| `codex_tyrant_naming` | On the Naming of the Tyrant | RA | Reach the Apex | Year 44: why the Remnants called it Tyrant, and what they assumed. |
| `codex_tyrant_holding` | The Holding | WN | `echo_tyrant_speaks` | What it told me; what it couldn't. |
| `codex_tyrant_six` | Six in the Mass | WN | `echo_six_in_the_mass` | Who the limbs and shards are. |
| `codex_wayfinder_nature` | On Wayfinders | RA | Day 1 (starting entry) | Rare individuals with ley-sense; the Ledger's count. |
| `codex_wayfinder_symptom` | The Fever Theory | WN | `echo_wayfinder_symptom` | "We're not chosen. We're a symptom." |
| `codex_seven_wayfinders` | The Ledger of Seven | RA | `echo_seven_wayfinders` or Keeper Dray | Seven names, seven deaths at or near the Apex. |
| `codex_dask` | The Flickering Man | IT | `echo_flickering_man` | A scout who went east and didn't come back, and did. |
| `codex_region_silverwood_ruins` | The Ruins of Silverwood | RA | Day 1 | The capital's ruin-field; what each ruin was. |
| `codex_region_mistwood_reach` | Mistwood and the Ironclad Reach | IT | Enter Mistwood Path | Fog, herbs, the camp, the Peaks, the forge. |
| `codex_region_voidscar` | The Voidscar | WF | Enter the Chasm | Where the void is thin enough to touch. |
| `codex_region_highlands` | The Aether-Kissed Highlands | RA | Enter Shimmering Pass | Pass, Spires, Plateau; distance lies here. |
| `codex_region_glowlands_nexus` | The Glowlands and the Nexus | RA | Enter the Glowlands | Breath and Eye; the observatory under the broken dome. |
| `codex_region_silverwood_before` | Silverwood, Three Days Before | WN | `echo_before_route` | The city alive; the bells; what I couldn't change. |
| `codex_region_drowned_reach` | The Drowned Reach | RA | Enter the Reach | The undercity beneath the Archives; the bells; the Door of Pages. |
| `codex_region_ashen_steppe` | The Ashen Steppe | IT | Enter the Steppe | The Nomads' range; the Bone Road; the Cairn. |
| `codex_region_veil` | The Veil | WF | Enter the Veil | The Voidscar deeps; the Choir; the Cell. |
| `codex_region_glowfen` | The Glowfen | WN | Enter the Glowfen | Stilt-villages and green light; the people are changing. |
| `codex_region_skyreach` | The Skyreach | IT | Enter the Skyreach | Above the plateau; the High Mark; where the sky shows its seam. |
| `codex_region_threshold` | The Threshold | WN | `echo_threshold` | Grey water, a far light, a figure holding something up. |
| `codex_remnants` | The Remnants of Aethelgard | RA | Day 1 | Scholars; the count of years; preservation. |
| `codex_remnant_seal` | The Seal of the Remnants | RA | `echo_oriel_lineage` | It is Oriel's seal. |
| `codex_weavers` | The Shadow Weavers | WF | Meet Nyx | A cult that was right about the Shards. |
| `codex_weaver_choir` | The Hollow Choir | WF | `q_hollow_choir` | The rite; the eighth verse sung wrong for 400 years. |
| `codex_ironclad` | The Ironclad Nomads | IT | Meet Brak | Steel, grit, the oath, the dropped names. |
| `codex_ironclad_oath` | The Oath and the Ember | IT | `echo_brak_birth_name` | Why they give the name back; where the fire came from. |
| `codex_creatures_leywarped` | Ley-Warped Things | RA | Kill a Corrupted Shade | Shades, Wisps, Brutes: wild magic on living shapes. |
| `codex_creatures_vanes_wards` | Vane's Wards | IT | Kill a Stone-Hide Golem | Golems and Sentinels: built to guard; still guarding. |
| `codex_creatures_auldes_strands` | Aulde's Strands | WF | Kill an Aetherial Weaver | Luminous weavers between the Spires; her loom. |
| `codex_creatures_breachborn` | Breach-Born | WN | Kill a Shimmering Phantom | Phantoms, Aberrations, the Unravelled: things with no next moment. |
| `codex_creatures_drowned_and_fen` | The Drowned and the Fen | RA | Kill a Drowned Archivist or Mireling | Archivists bound to pages; Mirelings who were people. |
| `codex_creatures_void_touched` | Void-Touched | WF | Kill a Void-Touched Stalker | Eyes like cold stars; born of corrupted ley echoes. |
| `codex_litany_1` .. `codex_litany_9` | The Litany, Verses I–IX | RA (text) + WN (note) | The matching `echo_litany_verse_1` .. `_9` | The verse text and one line on who spoke it. |
| `codex_item_amulet` | The Amulet of Echoes | WN | Day 1 | "Tied to the Great Sundering." It remembers. |
| `codex_item_echo_crystal` | The Echo Crystal | RA | Take the Crystal | Oriel's recording stand; nine voices. |
| `codex_item_lost_scroll` | The Scholar's Lost Scroll | RA | Take the scroll | Oriel's record; Remnant wax. |
| `codex_item_dark_spellbook` | The Dark Spellbooks | WF | Read one | Korr's workbooks; what is read is owed. |
| `codex_item_chronos_lens` | The Chronos Lens | RA | Take the Lens | Masque's lens; it focuses time's echo. |
| `codex_item_heartstone` | The Heartstone | RA | Reach the Depths | The Conflux's living core; the cradle; the three choices. |
| `codex_item_void_shard` | Void Shards | WF | Hold one | Tears from the Breach; moments, torn. |
| `codex_item_breach_anchor` | The Breach-Anchor | IT | Forge it | Aetherium, stabilized stone, a Shard that remembers closing; iron that does not wish. |
| `codex_breach` | The Temporal Breach | RA | Day 1 | A wound in time; never closed, only contained. |
| `codex_breach_clock` | The Thirtieth Dawn | RA | `echo_breach_clock` | Ashcombe's count; the drift; why thirty. |
| `codex_loop` | On Returning | WN | `echo_amulet_memory` | I came back. Nobody else did. |
| `codex_echoes` | Echoes | WN | First Echo gained | What persists; what doesn't. |
| `codex_threshold_shore` | The Still Shore | WN | `echo_threshold` | Between loops; the figure on the water. |
| `codex_anchors` | What the Chamber Keeps | WN | `echo_anchor_mechanic` | Things set in the Conflux survive. |
| `codex_place_shattered_library` | The Shattered Library | RA | Enter | Silverwood's library; Korr's carrel; the portal that opens here. |
| `codex_place_silverwood_plaza` | Silverwood Plaza | RA | Enter | The civic heart; the bells; copper on the air. |
| `codex_place_sunken_archives` | The Sunken Archives | RA | Enter | Oriel's archive; the flood; the Drowned. |
| `codex_place_heartstone_depths` | Heartstone Depths | RA | Enter | The Conflux; Hallow's cradle, broken. |
| `codex_place_chasm_of_whispers` | The Chasm of Whispers | WF | Enter | Where Nyx waits; why it breathes cold. |
| `codex_place_emberforge` | The Emberforge | IT | Enter | Hallow's forge; the fire that has not gone out. |
| `codex_place_blighted_outpost` | Vane's Watch | IT | `echo_stone_hide_origin` | The Outpost was a ley-watch; the golems its garrison. |
| `codex_place_chronos_nexus` | The Chronos Nexus | RA | Enter | Masque's observatory; the Breach-door. |
| `codex_place_aetherium_spires` | The Aetherium Spires | WF | Enter | Aulde's tuning forks. |
| `codex_place_wayfarers_respite` | The Wayfarer's Respite | IT | Enter | Neutral ground; Kaelen's stream; "steel and salt." |
| `codex_place_lanternreed` | Lanternreed | WN | Enter | A stilt-village that glows a little more each year. |
| `codex_place_ring_of_wagons` | The Ring of Wagons | IT | Enter | The Nomads' great-camp; Hadda's fire. |
| `codex_place_hollow_choir` | The Hollow Choir | WF | Enter | The Weavers' sanctum; nine names on a wall. |
| `codex_place_hallows_cairn` | Hallow's Cairn | IT | `echo_hallows_ember` | Where the smith died with the ember still lit. |
| `codex_place_high_mark` | The High Mark | WN | `echo_high_mark` | The sky has a seam. It's getting longer. |
| `codex_ilyra` | Ilyra | WN | Recruit | Hears more than she should; holds doors. |
| `codex_brak_and_kaelen` | The Stonehand Brothers | IT | `echo_brak_birth_name` | One kept the name, one gave it back. |
| `codex_borin` | Borin Stonefist | IT | Trade with Borin | Keeper of a fire older than his people. |
| `codex_mireya` | Mireya of Lanternreed | WN | Recruit | Herbalist; her forearms shine in the dark. |
| `codex_caelum` | Caelum Vesper | WN | Recruit | A boy with an undelivered message. |
| `codex_present_leaders` | Dray, Ironvow, Sethe, Thistlecourt | RA | Meet all four | The present's four stubborn people. |

### 14.2 Sample entries (full text)

**`codex_tyrant_naming` — On the Naming of the Tyrant** *(Remnant Archive)*

> Year 44 of the Sundering. Sael Orrin, first of those the Archive would later call Wayfinders,
> reached the Apex alone and did not return. A party of six followed at a distance and recorded
> what they saw: a towering figure of rippling time, skeletal limbs and crystalline shards surfacing
> and vanishing within its shifting mass. Orrin struck it. It struck once in answer and he was not
> there.
>
> Keeper Avel Dray, second of that name, entered the figure in the Ledger as *the Chronos Tyrant*,
> with this reasoning: whatever stands at the heart of a wound must be the wound's maker; and the
> thing held one hour and would not let it pass, which is tyranny over time. The name was adopted
> by the Ironclad within a generation and by the Weavers never, who call it the Keeper of the Gate.
>
> The Archive notes, for completeness, that the reasoning contains an assumption. The entry has not
> been amended. — *Keeper's hand, Year 498.*

**`codex_oriel_danthe` — Oriel Danthe** *(Remnant Archive)*

> Archivist of the Circle; born in Silverwood; died in the Sundering, Year 0, in the vault now called
> the Sunken Archives. She spoke the first verse of the Litany of the Conflux, which the Archive holds
> to be the reason the Echo Crystal recorded the rite: *let it be written as it is done*. When the
> Heartstone burst its cradle she was told to carry the record out. She reached her carrel. The
> ley-water rose through the floor. The record survived in her seal, which is the seal this Archive
> uses, and which no Keeper before Ansel Dray thought to ask the origin of.
>
> Her junior keepers founded the Remnants. Her line continues; the Archive does not say where. The
> Drowned Archivist that guards her carrel reads the same page she was reading. It has not finished.

**`codex_durn_hallow` — Durn Hallow** *(Ironclad Telling)*

> You'll have heard it said steel sings louder than fear. Here's who said it first.
>
> Hallow was a smith. Not a Nomad; there weren't Nomads. A city smith, Silverwood, when the city had
> a name and bells. The mages wanted a cradle for their stone, iron that would hold and not want, and
> he made it, and he spoke his piece in their rite because they asked him to. Fourth verse. Then the
> stone cracked, and he said *stop*, and the tall one said it holds, and Hallow said *held isn't the
> same*, and he picked an ember out of the brazier with his bare hand and walked up the stair.
>
> He got as far as the Peaks. Two days. His hands were gone by then but the ember wasn't. The forge-boys
> found him sat up against a rock with the bowl in his lap and the coal still red. They carried it
> north. It's the fire Borin keeps.
>
> So when you hear *steel sings louder than fear*, know it was a man with no hands who said it, and
> he wasn't talking about steel.

**`codex_item_void_shard` — Void Shards** *(Weaver Fragment)*

> A shard of condensed shadow that promises power. That is what the Archive wrote, and the Archive
> is not wrong, only deaf.
>
> Hold one to your eye in the dark. There: a stair. A boy on the third step. A bell, mid-ring, that
> will not finish ringing. Each Shard is a moment torn from the night the hour tore, and each one is
> the same night, and each one is a different second of it. The Choir has gathered eleven thousand
> seconds and the night is not yet whole.
>
> They fall from the Breach the way tears fall: without being asked. The Hollow is where they land
> because the Hollow is where *she* landed, and the dark remembers the shape of what it has held.
>
> Do not keep more than three. Three is a verse. Four is a sentence you did not mean to say.

**`codex_breach_clock` — The Thirtieth Dawn** *(Wayfinder's Notes)*

> Dray's water-clock in the Library. The Heartstone's beat in the Depths. Counted both for a watch.
> They don't agree, and the disagreement grows by the same amount each day.
>
> Ashcombe worked this out in Year 309 and nobody understood his notes. I do. The beat is Veyran's
> sentence. The clock is the world. When they're fully out of step the hold breaks, whether or not
> anybody is standing at the Apex with a sword. Thirty dawns from the day I wake in the Ruins.
>
> Stabilizing the stone buys six. Exploiting it costs five. Breaking it costs ten.
>
> I saw it happen once without touching him. The sky tore east to west and he screamed from the Apex
> and nobody had done anything. That's the whole case against the Ironclad theory, in one dawn.
>
> I don't know yet what buys thirty-one.

**`codex_dask` — The Flickering Man** *(Ironclad Telling)*

> Dask was ours before he wasn't. Scout, Year 430 or thereabouts, Ring of Wagons, good eyes, bad
> temper, a way of going quiet when the wind came from the east. He went east on his own in the end.
> We don't say *deserted*; the pull takes who it takes.
>
> He came back the way the Highlands give things back. Hunters in the Shimmering Pass see a man in old
> leathers with a hand up, and then they don't. Some of the old scouts say he's warning them off the
> road. Some say he's waving.
>
> Dray's lot put him in their Ledger as the seventh. Seventh what, we asked. They didn't like the
> question.
>
> If you see him, don't move. He loses you when you move.

---

## 15. Style guide

### 15.1 House voice (D-020, made concrete)

Rules: concrete nouns; short sentences; the senses first; no purple prose; strangeness stated
plainly. The register is grave and strange, never grim-dark. Say what a thing *does*, not what it
*is like*, unless the comparison is physical and short.

| Do (legacy) | Don't (and why) |
|---|---|
| "The air smells of ozone and decay, and a chill wind carries faint whispers." | "An eldritch miasma of unspeakable dread pervaded the ancient ruins." (abstract, adjective-stacked) |
| "A slow drip marks time, and the ley lines glow through the flood." | "Time itself seemed to weep in that forsaken place." (personification without a body) |
| "Collapsed shelves form jagged ridges of splintered wood and stone." | "The library was utterly destroyed beyond all recognition." (tells, no image) |
| "Stone scrapes stone as something massive shifts in the dark." | "You feel an overwhelming sense of foreboding." (names the feeling instead of its cause) |
| "The Heartstone cracks. Silence follows, and your body hardens against the loss." | "With a cataclysmic detonation the Heartstone exploded in a blaze of arcane fury!" (volume as drama) |

Legacy text that breaks these rules ("a maelstrom of fractured realities," "the fabric of stable
reality") is kept where quoted and is not a model for new text.

**Banned in new text:** *fabric of reality / existence* (except legacy quotes), *eldritch*,
*unspeakable*, *unimaginable*, *nightmarish*, *epic*, *suddenly*, *very*, *literally*, *ancient* as
a default adjective (use the thing's age or maker), *dark* as a mood word (use it for light),
*mysterious*, *ethereal* outside the legacy Spires line, exclamation marks in narration, and any
sentence beginning "You feel a sense of."

**Cruelty rule.** No gore beyond the legacy "bloody lacerations"; no sexual content; death is
quick and named. The Nine are mistaken, not evil. Nobody is mocked for being wrong.

### 15.2 Per-character voice notes

- **Ilyra:** complete sentences; questions she already half-knows the answer to; "Wayfinder" as a
  title; metaphors from paper and ink. Never swears. Under stress she gets *more* formal.
- **Brak:** fragments; one joke per scene at most, dry; "the Horde"; counts things ("One of them
  runs out"). Never says "magic" without a verb of distrust.
- **Nyx:** present tense; no exclamation; sentences that stop a word early; "the void remembers."
  Says "he" of Veyran and never "it."
- **Kaelen:** merchant's economy; weighs and prices things in speech; deflects with trade talk.
- **Borin:** forge verbs (temper, draw, quench); "Speak plain"; speaks of the fire as a person.
- **Dask:** dry, kind, interrupted; render skips as a dropped word, never a stammer; swears mildly
  and old-fashionedly ("hells of a road" is his generation's).
- **Mireya:** herb names, weather, and orders; kindness as instruction ("sit *down*").
- **Caelum:** formal old-city diction, "Master —"; asks the question he fears; never says "sir."
- **Keeper Dray:** dated, precise, dry; cites years. **Hadda Ironvow:** proverbs and commands.
  **Sethe:** Choir cadence, repeated phrases. **Elder Wen:** short, flat refusals.
- **The Tyrant:** a chorus with one voice under it; "the hour"; present continuous; no apology to
  the living; speaking costs it, so it is brief. Never shouts except the legacy scream.

### 15.3 Intents (enemy telegraphs)

Second person, present tense, ≤ 12 words, names the *shape* of the next action without the number
(the UI shows type/target/number). Examples: "The Tyrant braces the hour against you." / "Stone-grey
hands close on your left." / "The Phantom flickers; it will strike where you were." / "The Mireling
breathes in." Avoid: "prepares to attack," "charges up," any verb from a menu.

### 15.4 Journal text

≤ 40 words per stage; present tense; says where to go and why in the character's framing, not the
system's. Legacy journal lines are the model: "Retrieve the Echo Crystal from the Shattered Library
to the north of Whispering Ruins." New stages may carry one clause of voice: "Hadda wants Corwen
Blackreed's axe back from the Nexus, where twenty held a horde for a day."

### 15.5 Codex

Tag every entry with a voice and write *in* it: RA cites years and hedges with "the Archive notes";
IT addresses the reader ("you'll have heard"); WF uses imperatives and refuses to explain; WN is
first-person, terse, and allowed to be wrong in early loops.

---

## 16. Open questions for the lead

1. **Quest count arithmetic.** D-019 reads "New quests: 9 + 18 + 7 + 4 + 6 = 44," which with the six
   legacy quests makes 50; the brief says 44. This document delivers **44 total** with the legacy six
   counted inside the categories (11 preamble) and lists six stretch quests (11.7) that restore the
   "44 new" reading if preferred. Please confirm which count is canon.
2. **Oriel as the Drowned Archivist.** I made the Drowned Archivist guarding the scroll Oriel's
   echo ("the First Drowned"), revealed in Loop 2+. This elaborates D-006 ("died in the Sundering")
   rather than contradicting it, but it is a strong claim; please confirm or make the Archivist generic.
3. **The Amulet exempt from the reset.** For the "Amulet warm" cue on waking (4.2), the Amulet
   returns *on* the Wayfinder rather than lying in the room. D-011 says inventory resets; I propose
   the Amulet as the single named exception. Engineering should know.
4. **Apex gate shortcut (`echo_apex_resonance`).** Opening the Nexus→Apex gate from Loop 2 without
   six quests makes the speedrunner viable and lets the communion path be reached early. It changes
   pacing; DESIGN.md should confirm or set a lower quest threshold (e.g., 3) instead.
5. **Threshold on the Loop 1→2 transition.** I skip the Threshold for the first transition so the
   Ruins-waking lands as the twist (4.2). D-012 could be read as requiring it every time.
6. **Hallow's walk-out.** Having one of the Nine leave at the sixth verse gives the Ironclad a true
   founding story and a sixth question in communion. It means eight stood in the chamber at the
   ninth verse; the Crystal still holds nine voices because all nine verses were spoken. Confirm.
7. **Year for the Day of Teeth.** I set Corwen Blackreed at Year 178 (table 2.8) and the Day of
   Teeth at Year 178 accordingly; BIBLE.md should fix this and the other six Wayfinder years.
8. **Mireya's dam needs a Stabilized Heartstone.** This couples her arc to the Stabilize choice;
   fine for B/E loops, awkward for D. An alternative is a "dead fragment" from Destroy that dams
   permanently (and darkly). Preference?
9. **Ending F epilogue tone.** "The game does not argue" is the brief's cold register; if the lead
   wants F to carry a hook for New Game+, one line about the Amulet still being warm would do it.
10. **Word count.** The document runs over the 22,000 target because the four catalogs are dense.
    The Echo table and the codex table could move to WORLD.md/BIBLE.md if STORY.md must be shorter.
11. **Proposed names needing WORLD.md ratification:** Keeper Ansel Dray, Hadda Ironvow, Sethe the
    Unlidded, Elder Wen Thistlecourt; the Ring of Wagons, Hallow's Cairn, the Bone Road, the Hollow
    Choir, Nyx's Cell, the Lightless Stair, Lanternreed, the Reed Maze, the Breathing Pool, the Wind
    Stair, the High Mark, the Cistern of Names, the Bell Vault, the Door of Pages, Oriel's carrel; and
    the ten Silverwood Before locations (9.1).

*a game by Tim Dibert*
