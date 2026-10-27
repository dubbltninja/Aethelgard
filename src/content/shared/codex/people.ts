// Codex I (U60), part 3: people of the present and of the last days (STORY §14.1 rows `codex_dask`, `codex_ilyra`,
// `codex_brak_and_kaelen`, `codex_borin`, `codex_mireya`, `codex_caelum`, `codex_present_leaders`), plus the three figures
// STORY §14.1 has no row for (D-101; STORY §2.2 "Silverwood people who were not of the Nine", BIBLE §3.4, WORLD §2.7/§2.8/§3):
// `codex_corvin_dreyl` (Ironclad Telling: the Steppe is the Nomads' and the brand is on their beasts), `codex_ilsabet_rhune`
// (Remnant Archive: the Tidewell ledger and the Archive's own drowning) and `codex_tobrin_vask` (Wayfinder's Notes: the seal
// and the failsafe found under Vane's Watch). Each unlocks on the Echo STORY §12 gives its trace (`echo_dreyl_brand`,
// `echo_rhune_choice`, `echo_vask_seal`; all three rows say "codex"). The three tomes WORLD §7.13 marks "codex (person)"
// (items/quest.ts) still unlock nothing: pointing them here is a one-line change each, and U50's consumables test pins them.
// "Recruit" is the companion in the roster (`state: 'recruited'`); "Meet all four" is any quest each of the four gives
// (STORY §11.1), since there is no "met" atom and four `location` atoms can never hold at once; "Trade with Borin" is being
// at his forge, or either Echo only he hands over.
import type { CodexEntryInput } from '@schema/codex';
import type { Condition } from '@schema/condition';

const met = (quests: `q_${string}`[]): Condition => ({ any: quests.map((id) => ({ quest: { id } })) });

/** The present's four: Keeper Dray, Hadda Ironvow, Sethe the Unlidded, Elder Wen Thistlecourt — each by the quests only they give. */
export const MET_ALL_FOUR: Condition = {
  all: [
    met(['q_keepers_ledger', 'q_bell_vault', 'q_the_keepers_price', 'q_the_thirtieth_dawn', 'q_long_archive']),
    met(['q_bone_road', 'q_day_of_teeth', 'q_iron_silence']),
    met(['q_hollow_choir', 'q_unlidded_eye']),
    met(['q_the_drowned_lantern']),
  ],
};

export const peopleCodex = [
  {
    // STORY §14.2, verbatim
    id: 'codex_dask',
    title: 'The Flickering Man',
    voice: 'ironclad_telling',
    category: 'people',
    order: 10,
    unlockWhen: { echo: 'echo_flickering_man' },
    related: ['codex_seven_wayfinders', 'codex_wayfinder_symptom', 'codex_ironclad', 'codex_region_highlands', 'codex_threshold_shore'],
    body: `Dask was ours before he wasn't. Scout, Year 430 or thereabouts, Ring of Wagons, good eyes, bad temper, a way of going quiet when the wind came from the east. He went east on his own in the end. We don't say *deserted*; the pull takes who it takes.

He came back the way the Highlands give things back. Hunters in the Shimmering Pass see a man in old leathers with a hand up, and then they don't. Some of the old scouts say he's warning them off the road. Some say he's waving.

Dray's lot put him in their Ledger as the seventh. Seventh what, we asked. They didn't like the question.

If you see him, don't move. He loses you when you move.`,
  },
  {
    id: 'codex_ilyra',
    title: 'Ilyra',
    voice: 'wayfinder_notes',
    category: 'people',
    order: 20,
    unlockWhen: { companion: { id: 'ilyra', state: 'recruited' } },
    related: ['codex_remnants', 'codex_remnant_seal', 'codex_oriel_danthe', 'codex_item_echo_crystal', 'codex_place_shattered_library'],
    body: `Ilyra. Remnant scholar, thirty or so, by the cold fire at the Ruins' edge every dawn I've had. Faded robes, bright eyes, a satchel of ink. The first face I see each time and the first question: *you hear them too, I think?*

She hears more than she should. Every Remnant hears the whispers in the stones a little; she hears words. She copied a page nine times once and told me the ninth copy was different, that the ink was correcting her. I believed her. I've seen what she does with ink.

She holds doors. I watched her hold the Library's portal open with her hands while the shelves came down, and step back from it, and not come through. She doesn't remember that. I do.

Her light, the one she throws over both of us when it gets bad, she calls *Oriel's seal*. I asked why. She didn't know. She looked at her hands when she said it.

Won't enter the Veil. *That place reads you back.* Gets more formal the worse things get; if she starts saying *Wayfinder* every sentence, we're in trouble.

She says she doesn't want to hold the door forever. She wants to know why it needs holding. So do I. I think that's why she comes.`,
  },
  {
    id: 'codex_brak_and_kaelen',
    title: 'The Stonehand Brothers',
    voice: 'ironclad_telling',
    category: 'people',
    order: 30,
    unlockWhen: { echo: 'echo_brak_birth_name' },
    related: ['codex_ironclad', 'codex_ironclad_oath', 'codex_place_wayfarers_respite', 'codex_place_ring_of_wagons'],
    body: `Oma Varr tells this one, so I'll tell it her way. Two boys. One kept the name, one kept the road. Both kept the sulk.

Stonehand was their father's. He's dead; the name isn't. Kaelen, the elder, had it first and has it still. He left the Nomads before Brak was old enough to swear, and went west to the Respite, and sells salt and tonic and fair weights to anyone with coin, Remnant or Weaver or us, and that's allowed, because the Respite is nobody's. He'll weigh you a pound of anything. He won't weigh you a word about his brother.

Brak stayed. Took the oath. Gave the name back, which means gave it to Kaelen, which means Kaelen's got the only Stonehand there is and never asked for it. Brak's *Brak of the Ironclad*, and if you call him the other thing he'll let it pass once.

They haven't spoken in years. Not a quarrel anyone remembers. Just a road between them that neither one will walk first. Ketch has a verse about it. He stops singing it when either of them's in earshot.

Carry salt between them sometime. Tell Kaelen who it's for. He'll give it you free and say it's for the camp.`,
  },
  {
    id: 'codex_borin',
    title: 'Borin Stonefist',
    voice: 'ironclad_telling',
    category: 'people',
    order: 40,
    unlockWhen: { any: [{ location: 'loc_emberforge' }, { echo: 'echo_borin_oath' }, { echo: 'echo_emberforge_vein' }] },
    related: ['codex_ironclad', 'codex_ironclad_oath', 'codex_durn_hallow', 'codex_place_emberforge', 'codex_item_breach_anchor'],
    body: `Speak plain to him. He'll say it anyway, so save him the breath.

Borin Stonefist keeps the Emberforge. Fifty-five or so, arms like the rest of him, a hammer he hasn't put down in your lifetime. He's the only smith we've got worth the name and the only one anywhere who can temper what you bring him. Drop the ore on the anvil and say what you want. Don't describe it. He'll tell you what it is.

He talks about the fire the way you'd talk about an old woman you live with. *She.* *She's sulking.* *She doesn't like being asked how old.* He's not wrong to. That fire came over the Peaks in a bowl when there weren't Nomads yet, and it's been fed every day since, and Borin is the one feeding it now. He'll tell you it's older than us. Then he'll change the subject, because he's thought about what that means and he'd rather not.

Bring him Void Shards and he'll forge with them and not ask questions, and the clan will count it as your choosing us. Bring him word from the cairn road and he'll go quiet.

He works nights. The fire doesn't sleep; he says it's rude to make her do it alone.`,
  },
  {
    id: 'codex_mireya',
    title: 'Mireya of Lanternreed',
    voice: 'wayfinder_notes',
    category: 'people',
    order: 50,
    unlockWhen: { companion: { id: 'mireya', state: 'recruited' } },
    related: ['codex_imre_sallow', 'codex_region_glowfen', 'codex_place_lanternreed', 'codex_creatures_green'],
    body: `Mireya of Lanternreed. Herbalist. Thirties, I'd say; the fen makes it hard to tell. She met me on the stilts with a basket of moss and told me to sit down before I'd said a word.

Glow Moss for the wound. Bitterroot for the fever. Feverfew, then water, then you tell her where you've been. She gives kindness as orders and I've stopped arguing.

Her forearms shine. Not much; you see it when the lanterns are low, a green under the skin like a lamp under cloth. Her grandmother glowed at the end, she says. They called it holiness. She says it was the water. The elders say the glow is the Breach, leaking down into the pool the village stands over, and they say it like a blessing. She doesn't say it like anything. She wants to know why.

A child in the village has eyes gone Mireling-green and can see in the dark now. Mireya treats her as a patient and not a sign. That's the whole of her, I think.

Won't fight Mirelings. *They were people. Some of them were people last spring.* Won't leave while there's a sick-bed untended.

Told me the fen doesn't preserve anything. It changes it or it eats it. Looked at me when she said it.`,
  },
  {
    id: 'codex_caelum',
    title: 'Caelum Vesper',
    voice: 'wayfinder_notes',
    category: 'people',
    order: 60,
    unlockWhen: { companion: { id: 'caelum', state: 'recruited' } },
    related: ['codex_veyran_thal', 'codex_seraphine_aulde', 'codex_region_silverwood_before', 'codex_anchors', 'codex_litany_5'],
    body: `Caelum Vesper. Sixteen. Apprentice to the Circle and Master Thal's errand-boy, and proud of both.

I walked the noon message with him to the Spire Yard. Aulde read it and laughed. *Begin at the ninth bell.* He was proud of that. He has been proud of that every time, because he doesn't know it's every time. Except he does, a little. He's the only one in this city who looks at me on the second morning and says *you were here yesterday*. Nobody else remembers. He asked me why he does. I don't know. Something touched him on that stair and didn't let go.

The second message is the dusk one. Up the Archive stair, back to the Yard. He's three steps up when the first verse starts. He never gets to the top. He doesn't know that yet, or he does and won't say; he asks the questions he's afraid of, and that one he hasn't asked.

Old-city formal. *Master Thal.* Never *sir*. Asked me if the Holding was a kindness to the hour and looked as if he knew my face would answer before I did.

Everything in my pack is older than his city. He held the Amulet and said *that isn't possible*, and gave it back carefully, as if it might be.`,
  },
  {
    id: 'codex_present_leaders',
    title: 'Dray, Ironvow, Sethe, Thistlecourt',
    voice: 'remnant_archive',
    category: 'people',
    order: 70,
    date: 'Year 500 of the Sundering',
    unlockWhen: MET_ALL_FOUR,
    related: ['codex_remnants', 'codex_ironclad', 'codex_weavers', 'codex_seven_wayfinders', 'codex_region_glowfen', 'codex_place_hollow_choir', 'codex_place_ring_of_wagons'],
    body: `Year 500. The Archive's notes on the four people who, between them, decide what the living do about the Breach.

*Keeper Ansel Dray*, Remnants. About seventy. Keeps the Ledger of Wayfinders at the Library and has checked Pell Ashcombe's arithmetic every year since Year 442. Wants the Ledger kept and the Litany recovered. Cites years in conversation. The Archive's own; the Archive notes the bias.

*Hadda Ironvow*, Ironclad. About fifty. Clan-mother and warchief at Hearthring on the Steppe, with two hundred spears and the Day of Teeth in her mouth every morning. Wants the east cleared and Year 178 answered. Speaks in proverbs and orders and does not distinguish them.

*Sethe the Unlidded*, Shadow Weavers. Age not recorded. Lieutenant of the Choir under the Chasm. Cut away her own eyelids to keep watch between moments, and has not blinked since. Wants the rite completed. Wants, more, to see what her prophet sees.

*Elder Wen Thistlecourt*, Glowfen. Sits on a reed mat at the Breathing Pool. Wants the old ways kept and the glow kept, whatever it costs. Her recorded replies to the Archive's questions, Years 491 to 499, are all the same word. The Archive has stopped asking.

Four stubborn people. The Archive notes that it produced one of them.`,
  },

  // ---- D-101: the three STORY §14.1 has no row for ---------------------------------------------------------------------------
  {
    id: 'codex_corvin_dreyl',
    title: 'Captain Corvin Dreyl',
    voice: 'ironclad_telling',
    category: 'people',
    order: 80,
    unlockWhen: { echo: 'echo_dreyl_brand' },
    related: ['codex_haldric_vane', 'codex_ironclad', 'codex_region_ashen_steppe', 'codex_creatures_wilds', 'codex_region_silverwood_before'],
    body: `You've seen the mark now. A flame inside a ring, on the flank of every stone beast in the Orchard, and on things out on the flats that aren't stone yet. That's the Captain's brand. Dreyl.

He wasn't one of the Nine. He was the city's Watch, the man who kept blades sheathed in the Plaza and had you carried if you argued, and his one piece of magic was borrowed. Vane drew him a ward, a fire-ring round the whole city, so nothing could cross it that it didn't burn. Dreyl built it. His ledger's last column is headed *outward*.

Because that's what it did. The night the hour tore, the ring turned round. It didn't burn what came in. It burned what was out: the plains, the grass, the herds standing in it, all in a day. Where it touched, it branded. The ash that's still falling is that fire's.

We came after. We made the ash ours. But every spring Hadda leaves the first calf at the Herd-Grave for the thing that burned and kept burning, and nobody calls that superstition where she can hear.

A man built a wall to keep his city safe. The wall is why there's a Steppe. Think on that before you build anything.`,
  },
  {
    id: 'codex_ilsabet_rhune',
    title: 'Ilsabet Rhune, Warden of Waters',
    voice: 'remnant_archive',
    category: 'people',
    order: 90,
    date: 'Year 500 of the Sundering',
    unlockWhen: { echo: 'echo_rhune_choice' },
    related: ['codex_oriel_danthe', 'codex_remnants', 'codex_region_drowned_reach', 'codex_creatures_drowned', 'codex_place_sunken_archives'],
    body: `Warden of Waters of Silverwood: a civic office, the Archive notes, not a seat of the Circle. She kept the cisterns under the city and the sluices that fed the Plaza fountains, and she checked every wheel twice, and the Archive's one surviving account of her says she did not sleep.

On the last night she did what she had said she would do. Her sluice tables, recovered from the Deep in Year 500, have one page that is not a table: a drowning, worked out to the hour. When the Conflux's fire broke upward through the Archive she opened every cistern and sent the water down the stair to meet it. She sent the bell-ringers' guild to the great bell to ring when she pulled the wheels. They rang. They did not leave the ropes.

The fire went out. The water did not leave. The Archive drowned, and its Archivist in it, and the undercity below, and the Archive notes without comment that it owes its own name to that night.

The Tidewell ledger lists the drowned by street. Its last line is in another hand: *and the Warden of Waters, by her own choice.*

The Archive has not decided whether she saved the city or finished it. It records that she decided first.`,
  },
  {
    id: 'codex_tobrin_vask',
    title: 'Tobrin Vask',
    voice: 'wayfinder_notes',
    category: 'people',
    order: 100,
    unlockWhen: { echo: 'echo_vask_seal' },
    related: ['codex_haldric_vane', 'codex_place_blighted_outpost', 'codex_item_breach_anchor', 'codex_creatures_wards'],
    body: `A square inside a circle. It's on the brow of every golem at the Outpost, and the same mark opens a slot under the burned gate's sill that nobody found in five hundred years because nobody had the mark to open it with. Inside: half a drawing of a device, and a name. Tobrin Vask.

Not one of the Nine. Vane's apprentice, I think; a ward-engineer, which seems to mean the boy who checks the wards after the master has walked off. Borin found his primer in the forge slag, every page corrected in red in someone else's hand. He was learning. He was being corrected.

And he kept a failsafe. The Nine built a machine to hold an hour and this one apprentice looked at it and thought something like: if it goes wrong, someone should be able to open the door. So he made a seal the stone would kneel to, and kept the second half of a drawing of what it would take to shut the door properly, and buried a copy under the Watch where the master wouldn't look.

Half. The other half is somewhere else. He'd have known that too.

I don't know if he got out. I'd like to think so. Somebody in that city was checking the promises.`,
  },
] satisfies CodexEntryInput[];
