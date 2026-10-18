// Codex I (U60), part 1: the Ninefold Circle and the Tyrant (STORY §14.1 rows `codex_nine_overview` .. `codex_tyrant_six`;
// D-020 voices; every body ≤ 220 words, STORY §15.1/§15.5). Facts are STORY §2, §8 and BIBLE §2–§3; where an entry adds a
// detail (a seal's device, a Keeper's marginal hand) it contradicts nothing and says nothing its unlock has not earned.
// `codex_oriel_danthe`, `codex_durn_hallow` and `codex_tyrant_naming` are STORY §14.2's sample texts, verbatim: their voice is
// the standard the rest are written to. Unlocks are §14.1's, as Conditions; the tome items (items/quest.ts) and the Tyrant's
// communion `listen` effects also `unlockCodex` three of these, which is why the real-pack sim stopped on them (D-101).
import type { CodexEntryInput } from '@schema/codex';
import type { Condition } from '@schema/condition';

const VERSES = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `echo_litany_verse_${n}` as const);

/** "any two verse Echoes": every pair of the nine, as `{ all: [a, b] }` (36 of them). */
export function anyTwoVerses(): Condition[] {
  const pairs: Condition[] = [];
  for (let i = 0; i < VERSES.length; i++) {
    for (let j = i + 1; j < VERSES.length; j++) pairs.push({ all: [{ echo: VERSES[i] as `echo_${string}` }, { echo: VERSES[j] as `echo_${string}` }] });
  }
  return pairs;
}

export const nineCodex = [
  {
    id: 'codex_nine_overview',
    title: 'The Ninefold Circle',
    voice: 'remnant_archive',
    category: 'the_nine',
    order: 10,
    date: 'Year 0 of the Sundering',
    unlockWhen: { any: [{ echo: 'echo_nine_voices' }, ...anyTwoVerses()] },
    related: ['codex_veyran_thal', 'codex_oriel_danthe', 'codex_durn_hallow', 'codex_nyxaria_vell', 'codex_breach', 'codex_litany_1'],
    body: `Year 0 of the Sundering. Nine mages stood in the Conflux beneath the Archive at dusk on the last day and spoke the Litany, one verse each, in order. The Circle that ruled Silverwood's learning was never a council of nine by law; nine is how many went down the stair.

Oriel Danthe, archivist, the Witness. Maelis Korr, the Lesson. Haldric Vane, the Warder. Durn Hallow, smith, the Cradle. Seraphine Aulde, the Spire. Imre Sallow, the Breath. Tovren Masque, astronomer, the Eye. Nyxaria Vell, youngest, the Dark Between. Veyran Thal, Archmagus, the Holding.

Of the nine, the Archive accounts for three. Hallow walked out at the sixth verse and died on the ash two days later. Danthe ran with the record and drowned in her carrel. Vell was not found; the Weavers' fragments say one of the Circle fell forward, and the Archive does not amend on a Fragment's word.

The other six went into the tear with Thal and were not seen again. The Archive notes that the figure at the Apex has limbs and shards in its mass, and declines to count them.

The Weavers call them the Nine also, with a different tone.`,
  },
  {
    id: 'codex_veyran_thal',
    title: 'Veyran Thal',
    voice: 'remnant_archive',
    category: 'the_nine',
    order: 20,
    date: 'Year 500 of the Sundering',
    unlockWhen: { echo: 'echo_tyrant_name' },
    related: ['codex_nine_overview', 'codex_tyrant_naming', 'codex_tyrant_holding', 'codex_litany_9', 'codex_caelum'],
    body: `Archmagus of Silverwood; leader of the Circle; the ninth voice of the Litany. The Archive's older entries call him the most gifted mage of his age and record that he agreed. Kind to apprentices. Impatient with limits. He taught that a mind large enough could hold anything, and he found the one thing that could not be argued with by holding it.

He named the rite the Holding. He did not mean to break the hour; he meant to keep it still long enough to study. When the Heartstone cracked at the sixth verse he said *it holds*. When Masque read the sky and said *it fails*, he said *then we read it again*. When the Breach opened he sent the record out of the chamber and stepped in himself, speaking the ninth verse's third line.

He is still speaking it.

The Archive's entry on the Chronos Tyrant stands two shelves from this one. Keeper Avel Dray wrote it in Year 44. No Keeper since has set the two side by side. This copy does.`,
  },
  {
    id: 'codex_nyxaria_vell',
    title: 'Nyxaria Vell',
    voice: 'weaver_fragment',
    category: 'the_nine',
    order: 30,
    unlockWhen: { echo: 'echo_nyx_is_of_the_nine' },
    related: ['codex_nine_overview', 'codex_weavers', 'codex_litany_8', 'codex_weaver_choir'],
    body: `Do not say her name in the Sanctum. The thread knows it already; the mouths do not need to.

She was the youngest at the stone. The others held lines and gates and sky. She held the gap. *There is a dark between one moment and the next*: eight words, and the dark heard them, and learned the shape of the mouth that said them.

The recoil found her by that shape. It took the one mind that had named it and threw it the way you throw a thing you have burned your hand on: far, and forward. Five hundred years. She came down in the Veil in a bowl of glass that still shows stars at noon, with the Litany in her head and nothing else on her. She crawled to the Hollow. The Hollow was already full of people picking up what fell from the Breach and calling it power. She told them what it was. They called her prophet. She let them.

Her eyes hold starlight because she named the dark and the dark learned her name. Look at them once. Not twice.

Nine names on the rim of the glass, in chalk. Eight crossed out.`,
  },
  {
    // STORY §14.2, verbatim
    id: 'codex_oriel_danthe',
    title: 'Oriel Danthe',
    voice: 'remnant_archive',
    category: 'the_nine',
    order: 40,
    unlockWhen: { echo: 'echo_oriel_drowned' },
    related: ['codex_nine_overview', 'codex_remnant_seal', 'codex_remnants', 'codex_litany_1', 'codex_ilsabet_rhune', 'codex_item_echo_crystal', 'codex_item_lost_scroll', 'codex_place_sunken_archives'],
    body: `Archivist of the Circle; born in Silverwood; died in the Sundering, Year 0, in the vault now called the Sunken Archives. She spoke the first verse of the Litany of the Conflux, which the Archive holds to be the reason the Echo Crystal recorded the rite: *let it be written as it is done*. When the Heartstone burst its cradle she was told to carry the record out. She reached her carrel. The ley-water rose through the floor. The record survived in her seal, which is the seal this Archive uses, and which no Keeper before Ansel Dray thought to ask the origin of.

Her junior keepers founded the Remnants. Her line continues; the Archive does not say where. The Drowned Archivist that guards her carrel reads the same page she was reading. It has not finished.`,
  },
  {
    id: 'codex_maelis_korr',
    title: 'Maelis Korr',
    voice: 'weaver_fragment',
    category: 'the_nine',
    order: 50,
    unlockWhen: { any: [{ echo: 'echo_korr_marginalia' }, { corruption: { min: 3 } }] },
    related: ['codex_nine_overview', 'codex_litany_2', 'codex_item_dark_spellbook', 'codex_creatures_hollowed'],
    body: `Open one of his books and read the margin first. The text is what he knew. The margin is what he found out.

He wrote everything down and read everything twice, and he taught that what is read is owed: a debt, carried forward, paid by the reader to the next reader. His students paid. They are the Shades in the Corridor and under the shelves, grey where the ink went in, still turning pages that are not there. They are not done paying. Neither is he.

Second verse. *We have read, and we have paid.* Then the tear took him with the others, and the debt went with him, and it has been collecting since. That is why the books cost blood to open. That is why the hand in the margin is fresh when the page is five hundred years dry. He is still annotating. He annotates you.

Read if you must. Read twice and you owe it twice. When the margin begins to answer questions you did not write down, close the book. Then open the next one, because you already owe it.`,
  },
  {
    id: 'codex_haldric_vane',
    title: 'Haldric Vane',
    voice: 'ironclad_telling',
    category: 'the_nine',
    order: 60,
    unlockWhen: { echo: 'echo_stone_hide_origin' },
    related: ['codex_nine_overview', 'codex_litany_3', 'codex_creatures_wards', 'codex_place_blighted_outpost', 'codex_tobrin_vask', 'codex_corvin_dreyl'],
    body: `You've met his work. Two of them, at the Outpost, and you'll have noticed your spells came off them like rain off a helm. That was the point. He built them to stand in the backwash of the rite and not care.

Vane was the Warder of the Nine. Third verse. *Stone, stand where flesh would fall.* He said once that stone does not tire of an order, and meant it as praise, and that tells you the whole man. He trusted stone over people and he put his stone where the people were thin: the northern ley-knot, the watch-post we call the Blighted Outpost. Vane's Watch, it was. His garrison turned to face outward when he spoke his verse, and when the hour tore they locked on the last order he gave them, which was *guard*.

He went into the tear with the others. The golems didn't get told. Five hundred years on they're still holding his line, and the square-in-a-circle on their brows is a warder's seal, if you know to look.

So when the old scouts say the Outpost's never been cleared, only emptied, that's what they mean. Flesh fell. The stone's still standing. Break the armor, then hit it plain.`,
  },
  {
    // STORY §14.2, verbatim
    id: 'codex_durn_hallow',
    title: 'Durn Hallow',
    voice: 'ironclad_telling',
    category: 'the_nine',
    order: 70,
    unlockWhen: { echo: 'echo_hallows_ember' },
    related: ['codex_nine_overview', 'codex_litany_4', 'codex_ironclad_oath', 'codex_borin', 'codex_place_emberforge', 'codex_place_hallows_cairn'],
    body: `You'll have heard it said steel sings louder than fear. Here's who said it first.

Hallow was a smith. Not a Nomad; there weren't Nomads. A city smith, Silverwood, when the city had a name and bells. The mages wanted a cradle for their stone, iron that would hold and not want, and he made it, and he spoke his piece in their rite because they asked him to. Fourth verse. Then the stone cracked, and he said *stop*, and the tall one said it holds, and Hallow said *held isn't the same*, and he picked an ember out of the brazier with his bare hand and walked up the stair.

He got over the Peaks and two days out onto the ash. His hands were gone by then but the ember wasn't. The forge-boys found him sat up against a rock with the bowl in his lap and the coal still red, and they piled the rock up over him, and that's the cairn. They carried the coal north. It's the fire Borin keeps.

So when you hear *steel sings louder than fear*, know it was a man with no hands who said it, and he wasn't talking about steel.`,
  },
  {
    id: 'codex_seraphine_aulde',
    title: 'Seraphine Aulde',
    voice: 'weaver_fragment',
    category: 'the_nine',
    order: 80,
    unlockWhen: { echo: 'echo_spire_note' },
    related: ['codex_nine_overview', 'codex_litany_5', 'codex_creatures_spireborn', 'codex_place_aetherium_spires', 'codex_caelum'],
    body: `Stand under the tallest Spire at dusk and shut your mouth. Now you have heard it. Do not ask what it is. It is the note.

She built them for that. Nine forks of aetherium driven into the Highlands, tuned to one pitch, so that when the lines rose they would have somewhere to go and something to say. *Rise, lines, and be lifted.* Fifth verse. The sky over the city went silver-white and children were put on shoulders to see it, and she laughed, because it was the first time anyone had heard it but her.

Then the hour tore, and the Spires cracked, and did not stop. They have not stopped. Everything that spins in the Highlands is a strand of her loom carrying that pitch a little further. Cut a strand and the pitch goes on without it. The weavers of the Spires are not the loom.

At the crown of the tallest, threads of light run out in nine directions. Eight have gone dark. Do not ask which is lit.

She went into the tear with the others. Where the tear is, the note is. Listen east.`,
  },
  {
    id: 'codex_imre_sallow',
    title: 'Imre Sallow',
    voice: 'remnant_archive',
    category: 'the_nine',
    order: 90,
    unlockWhen: { echo: 'echo_breathing_pool' },
    related: ['codex_nine_overview', 'codex_litany_6', 'codex_creatures_green', 'codex_mireya', 'codex_region_glowfen'],
    body: `Life-mage of the Circle; keeper of the Green Court above the cisterns; the sixth voice. The Archive holds her consent to the rite in her own hand, with its condition: that whatever the Heartstone could not hold be given to living things and not to stone. *Green, take what the stone cannot.* The condition was met. The Archive notes that it has been met every day since.

At the sixth verse the Green took the overflow and the first crack opened in the stone. She was taken into the tear with the others at the ninth. Her line was not. It runs out from the Conflux and comes up where the Glowlands begin, and it has not stopped carrying. The Glowlands glow because her breath still leaks down it. The Breathing Pool at the line's end inhales for six heartbeats and exhales for six. Fen folk who live over it shine at the wrists. (Year 499, a Glowfen report, copied: the changed were counted among the living last spring. The report does not say what they are counted among now.)

The Archive has not determined whether a promise kept for five hundred years is a success.`,
  },
  {
    id: 'codex_tovren_masque',
    title: 'Tovren Masque',
    voice: 'remnant_archive',
    category: 'the_nine',
    order: 100,
    unlockWhen: { echo: 'echo_eye_of_masque' },
    related: ['codex_nine_overview', 'codex_litany_7', 'codex_creatures_watch_wardens', 'codex_place_chronos_nexus', 'codex_item_chronos_lens'],
    body: `Astronomer of the Circle; the Eye; the seventh voice. He built the observatory at the Nexus to watch the sky during the Holding and ground the Lens that is still there, and he had Hadrek the Clockwright make him an orrery so the sky could be read when it was clouded. The Archive holds his working notes to the last evening. They are dated by the hour.

At the seventh verse he read the sky through the Lens, by the chamber's link to the Nexus, and said: *It fails. I can see the hour from the far side and in it we are not here.* The Archmagus said: *Then we read it again.* He read it again. The notes record the second reading in the same hand, steadier than the first. It said the same.

He spoke his verse anyway and was taken into the tear with the others. His wardens, set to keep the observatory's hours, kept them; the hours broke; the Archive's position is that they now keep all of them at once, which accounts for the Phantoms. The dome came down the same night.

Masque is the only one of the Nine the Archive records as having been right. It has not helped him.`,
  },
  {
    // STORY §14.2, verbatim
    id: 'codex_tyrant_naming',
    title: 'On the Naming of the Tyrant',
    voice: 'remnant_archive',
    category: 'the_nine',
    order: 110,
    date: 'Year 44 of the Sundering',
    unlockWhen: { any: [{ location: 'loc_temporal_breach_apex' }, { echo: 'echo_apex_resonance' }] },
    related: ['codex_veyran_thal', 'codex_seven_wayfinders', 'codex_remnants', 'codex_breach', 'codex_tyrant_holding'],
    body: `Year 44 of the Sundering. Sael Orrin, first of those the Archive would later call Wayfinders, reached the Apex alone and did not return. A party of six followed at a distance and recorded what they saw: a towering figure of rippling time, skeletal limbs and crystalline shards surfacing and vanishing within its shifting mass. Orrin struck it. It struck once in answer and he was not there.

Keeper Avel Dray, second of that name, entered the figure in the Ledger as *the Chronos Tyrant*, with this reasoning: whatever stands at the heart of a wound must be the wound's maker; and the thing held one hour and would not let it pass, which is tyranny over time. The name was adopted by the Ironclad within a generation and by the Weavers never, who call it the Keeper of the Gate.

The Archive notes, for completeness, that the reasoning contains an assumption. The entry has not been amended. — *Keeper's hand, Year 498.*`,
  },
  {
    id: 'codex_tyrant_holding',
    title: 'The Holding',
    voice: 'wayfinder_notes',
    category: 'the_nine',
    order: 120,
    unlockWhen: { echo: 'echo_tyrant_speaks' },
    related: ['codex_tyrant_naming', 'codex_tyrant_six', 'codex_veyran_thal', 'codex_litany_9', 'codex_breach'],
    body: `It spoke. Nobody told me it could.

Not with a mouth; it hasn't got one that stays. The voices come up through the mass like bubbles through tar, several at once, and under them one voice, low, holding the others together the way a bass holds a chord. That one is the one that talked to me.

What it said, as near as I can set it down: that I had crossed. That one of us finally had. It asked if I had come back to finish it. Then: *I hold. If I do not hold, you have seen what comes.* Then: *I cannot ask. Do you understand that I cannot ask?*

What it couldn't say: what it is holding, or against what. Who it is. Why me and not the seven before. Every word cost it; I watched the shards surface faster while it talked, and it stopped when it had said the least it could.

It didn't strike first. I stood in reach for a full minute and it braced, and shook, and didn't strike. The first time, it struck.

Something has changed since the first time. I think the something is me.`,
  },
  {
    id: 'codex_tyrant_six',
    title: 'Six in the Mass',
    voice: 'wayfinder_notes',
    category: 'the_nine',
    order: 130,
    unlockWhen: { echo: 'echo_six_in_the_mass' },
    related: ['codex_tyrant_holding', 'codex_nine_overview', 'codex_maelis_korr', 'codex_haldric_vane', 'codex_seraphine_aulde', 'codex_imre_sallow', 'codex_tovren_masque', 'codex_durn_hallow'],
    body: `Six. I counted them in the second Movement, when the chorus split and each one asked me something.

Thal is the core. The low voice. The one who holds.

Korr is the burning one. *What is read is owed. What have you read?* When he strikes, something that was a scholar burns.

Vane is the hands. Stone-grey, closing. *Who guards the gate now?* He breaks armor because he never trusted anything else.

Aulde is the note. The mass shields itself when she sings, and the Spires answer from the east. *What note does the sky hold?*

Sallow is the green in it, the part that poisons and heals in the same breath. *What lives, that carries what does not?*

Masque is the gathered strike, the one that took Dask apart. He can take a wound back, too. *Tell me what you saw from the far side.*

That's five, and Thal. Six in the mass.

There's a question nobody asks. A gap where a voice should be, after Vane's and before Aulde's, where the fourth verse was spoken by a man who then walked up the stair. Hallow's silence. I think it wants answering too.

Nine stood. Six are here. That leaves three.`,
  },
] satisfies CodexEntryInput[];
