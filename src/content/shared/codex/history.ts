// Codex I (U60), part 2: history, the Litany, the Wayfinders and the three factions (STORY §14.1 rows `codex_breach`,
// `codex_litany_1` .. `_9`, `codex_wayfinder_nature`, `codex_wayfinder_symptom`, `codex_seven_wayfinders`, `codex_remnants`,
// `codex_remnant_seal`, `codex_weavers`, `codex_weaver_choir`, `codex_ironclad`, `codex_ironclad_oath`). The nine Litany
// entries are §14.1's one row "`codex_litany_1` .. `codex_litany_9` · RA (text) + WN (note)": the verse as the Archive holds
// it (STORY §2.3, canonical text), one line on who spoke it, and the Wayfinder's note in italics after the dash; they are
// tagged `remnant_archive` because the text is the Archive's record. The Day-1 entries (`codex_breach`, `codex_remnants`,
// `codex_wayfinder_nature`) say only what a Remnant knows on Day 1 of Year 500 (BIBLE §4): the Breach is contained, by what
// the Archive cannot say; the seal is older than the order; the Ledger counts seven. "Meet Nyx" / "Meet Brak" are the
// legacy offer scenes' done flags (C-58), their quests, or the companion in the roster; "or Keeper Dray" is his Ledger quest.
import type { CodexEntryInput } from '@schema/codex';
import type { Condition } from '@schema/condition';

interface Verse {
  n: number;
  title: string;
  speaker: string;
  lines: [string, string, string];
  /** RA: one line on who spoke it. */
  spoken: string;
  /** WN: the Wayfinder's note. */
  note: string;
  related: `codex_${string}`[];
}

const VERSES: Verse[] = [
  {
    n: 1,
    title: 'The Witness',
    speaker: 'Oriel Danthe',
    lines: ['Let it be written as it is done.', 'Let the hand fail and the word stand.', 'What we do here, we do before the stone.'],
    spoken: 'Spoken first, at the ninth bell, by Oriel Danthe, Archivist, with ink in her hand. The Echo Crystal woke at her voice; the Archive holds this to be why it holds nine.',
    note: 'She was the only one of them writing. I think she knew she would need to have been.',
    related: ['codex_oriel_danthe', 'codex_item_echo_crystal'],
  },
  {
    n: 2,
    title: 'The Lesson',
    speaker: 'Maelis Korr',
    lines: ['What is read is owed.', 'We have read, and we have paid, and we are not done paying.', 'Let the debt be carried into the hour.'],
    spoken: 'Spoken second by Maelis Korr, author of the workbooks the Archive shelves as Dark Spellbooks. The northern ley-knot answered.',
    note: 'The margins of three of his books say this between them. He made sure of that.',
    related: ['codex_maelis_korr', 'codex_item_dark_spellbook'],
  },
  {
    n: 3,
    title: 'The Warding',
    speaker: 'Haldric Vane',
    lines: ['Stone, stand where flesh would fall.', 'Keep the line and hold the gate.', 'Meet what comes without fear, for you have none.'],
    spoken: 'Spoken third by Haldric Vane, the Warder. Far to the north, the golems of his Watch turned to face outward.',
    note: "They're still facing outward. He wrote it for them, he said, not for us.",
    related: ['codex_haldric_vane', 'codex_creatures_wards'],
  },
  {
    n: 4,
    title: 'The Cradle',
    speaker: 'Durn Hallow',
    lines: ['Iron that does not wish, hold the heart.', 'Take the weight and do not want it.', 'What the hand would grasp, let the cradle only carry.'],
    spoken: 'Spoken fourth by Durn Hallow, smith, who made the cradle it names. The chamber sang a low note and the Plaza bells rang it back; the city thought it was a festival.',
    note: "Two verses later he said stop and walked out. The cradle's the only part of the rite that did what it was asked.",
    related: ['codex_durn_hallow', 'codex_ironclad_oath'],
  },
  {
    n: 5,
    title: 'The Spire',
    speaker: 'Seraphine Aulde',
    lines: ['Rise, lines, and be lifted.', 'Sing the one note the world was tuned to.', 'Let the sky hear what the ground has always known.'],
    spoken: 'Spoken fifth by Seraphine Aulde, who raised the Spires. They answered with her note; the sky over Silverwood went silver-white.',
    note: "The Spires are still singing it. I don't think she meant them to stop. I don't think she thought about stopping at all.",
    related: ['codex_seraphine_aulde', 'codex_caelum'],
  },
  {
    n: 6,
    title: 'The Breath',
    speaker: 'Imre Sallow',
    lines: ['Green, take what the stone cannot.', 'Breathe in what burns; breathe out what grows.', 'Let what lives carry what does not.'],
    spoken: 'Spoken sixth by Imre Sallow, life-mage. The Green took the overflow, and the first crack opened in the Heartstone with a sound like a tooth breaking.',
    note: 'The Pool at Lanternreed breathes to this. Six in, six out. The fen folk breathe with it.',
    related: ['codex_imre_sallow', 'codex_mireya'],
  },
  {
    n: 7,
    title: 'The Eye',
    speaker: 'Tovren Masque',
    lines: ['Read the sky before it is written.', 'See the hour from its far side.', 'Tell us true, and we will not turn away.'],
    spoken: 'Spoken seventh by Tovren Masque, astronomer, reading the sky through the Lens as he spoke. He told them true. They did not turn away.',
    note: 'He read it twice. It said no twice. He stayed. I don\'t know yet whether that was loyalty or arithmetic.',
    related: ['codex_tovren_masque', 'codex_item_chronos_lens'],
  },
  {
    n: 8,
    title: 'The Dark Between',
    speaker: 'Nyxaria Vell',
    lines: ['There is a dark between one moment and the next.', 'We name it, and so we may enter it.', 'Open, and be entered.'],
    spoken: 'Spoken eighth by Nyxaria Vell, youngest of the Circle. A seam opened above the stone, black, without depth. Its first breath went up the stair.',
    note: 'The Choir under the Chasm sings the last line wrong. Nobody has corrected them in four hundred years. Someone could have.',
    related: ['codex_nyxaria_vell', 'codex_weaver_choir'],
  },
  {
    n: 9,
    title: 'The Holding',
    speaker: 'Veyran Thal',
    lines: ['Hour, stay.', 'Be as you are, and do not become.', 'I hold you. I hold you. I hold—'],
    spoken: 'Spoken ninth by Veyran Thal, Archmagus. The Heartstone burst its cradle at the first line. The record stops at the third, mid-word, where the Archivist was told to carry it out.',
    note: 'There is no last line. The Crystal\'s ninth voice is still on the third. Someone will have to finish it, or answer it.',
    related: ['codex_veyran_thal', 'codex_tyrant_holding'],
  },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

function litanyEntry(v: Verse): CodexEntryInput {
  const prev = v.n > 1 ? [`codex_litany_${v.n - 1}` as const] : [];
  const next = v.n < 9 ? [`codex_litany_${v.n + 1}` as const] : [];
  return {
    id: `codex_litany_${v.n}`,
    title: `The Litany, Verse ${ROMAN[v.n - 1]} · ${v.title}`,
    voice: 'remnant_archive',
    category: 'history',
    order: 100 + v.n,
    date: 'Year 0 of the Sundering',
    unlockWhen: { echo: `echo_litany_verse_${v.n}` },
    related: [...prev, ...next, ...v.related],
    body: `From the record of Oriel Danthe, as the Archive holds it; the Echo Crystal confirms the voice.

*${v.lines[0]}*
*${v.lines[1]}*
*${v.lines[2]}*

${v.spoken}

— *${v.note}*`,
  };
}

export const litanyCodex: CodexEntryInput[] = VERSES.map(litanyEntry);

/** The legacy offer scenes (shared/dialogues/legacy.ts) that are the first words of Nyx and Brak; their done flags are C-58's. */
export const MET_NYX: Condition = { any: [{ flag: 'flag_scene_done_scene_nyx_void_shards_offer' }, { quest: { id: 'q_void_shards' } }, { companion: { id: 'nyx', state: 'recruited' } }] };
export const MET_BRAK: Condition = { any: [{ flag: 'flag_scene_done_scene_brak_clear_path_offer' }, { quest: { id: 'q_clear_path' } }, { companion: { id: 'brak', state: 'recruited' } }] };

export const historyCodex = [
  // ---- history ---------------------------------------------------------------------------------------------------------------
  {
    id: 'codex_breach',
    title: 'The Temporal Breach',
    voice: 'remnant_archive',
    category: 'history',
    order: 10,
    date: 'Year 500 of the Sundering',
    unlockedAtStart: true,
    related: ['codex_nine_overview', 'codex_tyrant_naming', 'codex_wayfinder_nature', 'codex_remnants', 'codex_region_silverwood_ruins'],
    body: `Year 0 of the Sundering. Nine mages of Silverwood stood in the Conflux beneath the Archive and tried to hold one hour still. The hour tore. The Archive's oldest leaf, in the first Keeper's hand, has it in six words: *the hour tore and the city followed.*

The tear is the Temporal Breach. It opens at the Apex, where the old towers folded into angles that do not resolve. By the first dawn it had drawn in to a scar, and the Archive's early entries say *closed*. The Archive no longer says this. A wound that had closed would not kill what comes near it; this one does, and the Ledger shows it. A wound that had closed would not have opened for a day in Year 178 when a Wayfinder struck the figure that stands in it. The Archive's present position is that the Breach has never closed. It is contained. By what, and how well, the Archive has studied for five hundred years and cannot say.

What came out of the tear on the first night is the Sundering: the shear along the ley lines, the flood, the fire, the Spires cracking, the Green drinking the light. The Archive calls it, carefully, the echo. The wound is still there.`,
  },
  ...litanyCodex,

  // ---- wayfinders ------------------------------------------------------------------------------------------------------------
  {
    id: 'codex_wayfinder_nature',
    title: 'On Wayfinders',
    voice: 'remnant_archive',
    category: 'wayfinders',
    order: 10,
    date: 'Year 500 of the Sundering',
    unlockedAtStart: true,
    related: ['codex_seven_wayfinders', 'codex_breach', 'codex_remnants', 'codex_item_amulet'],
    body: `The Archive uses *Wayfinder* for a person born with the ley-sense: one who feels the lines as a pull in the body and is drawn to the Ruins without being told where they are. The word is the Archive's. The first of them, in Year 44, had no name for what he was.

They are rare. The Ledger of Wayfinders, kept at the Library since Year 44, lists seven in five hundred years: Years 44, 110, 178, 243, 309, 371, 430. Roughly one a lifetime. The Archive notes the regularity and does not explain it.

Each went to the Apex, or was brought back to it. Each died there or near it. The Ledger records how, where that was known. The Keeper rules a line for the eighth before the eighth arrives; the present Keeper has kept his page open since he was twelve.

The Archive's position is that a Wayfinder is a gift of the ley to a wounded land. It is a position, not a finding. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_wayfinder_symptom',
    title: 'The Fever Theory',
    voice: 'wayfinder_notes',
    category: 'wayfinders',
    order: 20,
    unlockWhen: { echo: 'echo_wayfinder_symptom' },
    related: ['codex_wayfinder_nature', 'codex_seven_wayfinders', 'codex_dask', 'codex_loop'],
    body: `Dask said it first, on the sand, looking at seven frames and an empty eighth. *We're not chosen. We're a symptom.*

Here's the theory, mine and his. The hold at the Apex weakens on its own, a little, over a lifetime. When it gets weak enough the land notices, the way a body notices rot, and it runs a fever. The fever is a person. Someone is born with the lines in them, and the lines pull, and they walk to the Ruins not knowing why, and they go up to the Apex because that's where the pull points. Seven times. Years 44, 110, 178, 243, 309, 371, 430. Then me.

Nobody picked us. Nothing meant us. The ley doesn't want anything; it's a riverbed. Water finds the low place. We're the low place.

What this changes: the pull is not a calling. The Amulet is not a sign. The seven didn't fail a test; they were a fever that broke. If I want to be more than a symptom I have to decide to be, and nothing in the world will mind if I don't.

Dask says that's the freeing part. He said it the way you say *it's not far now*.`,
  },
  {
    id: 'codex_seven_wayfinders',
    title: 'The Ledger of Seven',
    voice: 'remnant_archive',
    category: 'wayfinders',
    order: 30,
    date: 'Year 500 of the Sundering',
    unlockWhen: { any: [{ echo: 'echo_seven_wayfinders' }, { quest: { id: 'q_keepers_ledger' } }] },
    related: ['codex_wayfinder_nature', 'codex_tyrant_naming', 'codex_dask', 'codex_weaver_choir', 'codex_ironclad', 'codex_present_leaders'],
    body: `The Ledger of Wayfinders, as kept at the Library. Seven entries. The Archive's hand throughout, save where noted.

*Sael Orrin, Year 44.* Silverwood-blooded duelist. Went to the Apex alone and cut at the figure there. Unmade by one strike. His death gave the figure its name.

*Hesper Vayle, Year 110.* Wandering healer. Reached the Apex and would not strike. Sat down before it and died of the shear, unspoken to.

*Corwen Blackreed, Year 178.* Ironclad warrior. Brought twenty Nomads. Wounded the Tyrant; the containment slipped for one day, the Day of Teeth. Died in the horde he let out. His axe stayed in the Nexus.

*Ysolde Marr, Year 243.* Shadow Weaver. Tried to take the Tyrant's power into herself. The Breach took her. The Weavers call it ascension.

*Pell Ashcombe, Year 309.* Scholar. First to count the days; his notes name the thirtieth dawn. Died at the Apex of the shear without fighting.

*Rook Tallis, Year 371.* Hunter. Turned back at the Apex. The pull brought him back the next year; died in the Nexus under the broken dome.

*Dask, Year 430.* Ironclad-trained scout. Tried to speak to it. Scattered. (The Ironclad dispute the word *died*. Entered as written.)

An eighth line is ruled. — *A. Dray.*`,
  },

  // ---- factions --------------------------------------------------------------------------------------------------------------
  {
    id: 'codex_remnants',
    title: 'The Remnants of Aethelgard',
    voice: 'remnant_archive',
    category: 'factions',
    order: 10,
    date: 'Year 500 of the Sundering',
    unlockedAtStart: true,
    related: ['codex_remnant_seal', 'codex_breach', 'codex_wayfinder_nature', 'codex_present_leaders', 'codex_ilyra', 'codex_place_shattered_library'],
    body: `Founded in the years after the Sundering by the junior keepers who dug the Archive out of the flood. The name they took says what they meant to be: what was left.

What the Remnants do: keep. They began the count of years, so that Year 500 is Year 500 and not *long ago*. They keep the Ledger of Wayfinders at the Library, where the Keeper camps in the reading-room. They keep lamps lit on the drowned stairs under the Archive. They seal what they copy with a wax seal older than the order, whose origin the Archive has not established. They named the figure at the Apex, in Year 44, and have not amended the entry.

What the Remnants believe: that the Breach is a wound in time, to be studied and held closed; that the figure in it is of it; that understanding the past heals the present. The Archive notes that under pressure the order's instinct is to hold still, and that this has been called wisdom and cowardice by turns.

The Remnants' ground is the ruin-field of Silverwood. Their strongest ley-hand is a scholar of about thirty who sits by a cold fire at the Ruins' edge and hears the whispers more clearly than she should.`,
  },
  {
    id: 'codex_remnant_seal',
    title: 'The Seal of the Remnants',
    voice: 'remnant_archive',
    category: 'factions',
    order: 20,
    date: 'Year 500 of the Sundering',
    unlockWhen: { echo: 'echo_oriel_lineage' },
    related: ['codex_remnants', 'codex_oriel_danthe', 'codex_ilyra', 'codex_item_lost_scroll', 'codex_region_drowned_reach'],
    body: `Every Remnant copy carries it: a disc of grey-brown wax pressed with an open book under three wavy lines. Scribes buy the wax by the stick. Divers in the Reach sell what they bring up only if the seal is unbroken. The order has used it since there was an order, and until the present Keeper, nobody asked where it came from.

It is Oriel Danthe's seal. The Archivist of the Circle sealed her record of the Litany in her own wax on the night of the Sundering, in her carrel, with the water rising through the floor. Her junior keepers found the record by the seal when they dug the Archive out. They kept the seal because it was on everything worth keeping. Within a generation it was theirs. Within two, it was only theirs.

The Archive notes the following, having been shown it: the Door of Pages in the Drowned Reach opens to the seal. Not to a key. To the seal, pressed to the door by a hand of her line. The Archive has one such hand in its service and did not know it until Year 500.

The record is corrected. The seal is not changed. It was never the Archive's to change.`,
  },
  {
    id: 'codex_weavers',
    title: 'The Shadow Weavers',
    voice: 'weaver_fragment',
    category: 'factions',
    order: 30,
    unlockWhen: MET_NYX,
    related: ['codex_weaver_choir', 'codex_nyxaria_vell', 'codex_item_void_shard', 'codex_region_voidscar', 'codex_region_veil', 'codex_present_leaders'],
    body: `We went down because the ground was thin there. That is the whole of the founding. The city broke, and the ones who had been taught a little and trusted with nothing went to the place where the breaking was closest to the surface and put their hands on it.

Do not call it a cult in the Veil. Call it the Choir if you must call it anything.

What we found: tears. The Breach weeps, and what it weeps lands in the Hollow, and each tear is a second of the night it was torn from. The Archive wrote *condensed shadow that promises power* and was right about the power and deaf to the rest. We were right about the Shards. Ask the Archive how long it took them.

What we keep: the Choir, which sings the eighth verse under the Chasm. The thread, which the Thread-Mother holds and all of us are tied to. The sign, which you will be shown when you have earned it and not before.

Ysolde Marr was ours. The Breach took her up. We do not say *died*.

The one at the Apex is the Keeper of the Gate. We do not say *Tyrant*. Ask her why, the one at the Chasm's lip. She will not tell you.`,
  },
  {
    id: 'codex_weaver_choir',
    title: 'The Hollow Choir',
    voice: 'weaver_fragment',
    category: 'factions',
    order: 40,
    unlockWhen: { quest: { id: 'q_hollow_choir', status: 'completed' } },
    related: ['codex_weavers', 'codex_litany_8', 'codex_nyxaria_vell', 'codex_item_void_shard', 'codex_place_hollow_choir', 'codex_seven_wayfinders'],
    body: `Come down without a light. Hold the thread. Sit where the threads cross and do not speak until the Unlidded one has looked at you; she will know what you brought.

The rite is this. A Shard is set on the thread. The Choir sings the eighth verse over it until the Shard answers, and what it answers with is a second of the last night, which is the only true thing left in the world. Eleven thousand seconds so far. The night is not yet whole. When it is whole the gate will open from this side and the Keeper of the Gate will have nothing left to keep.

The verse as the Choir sings it:
*There is a dark between one moment and the next.*
*We name it, and so we may enter it.*
*Open, and we will enter.*

The Choir has sung it so for four hundred years. Ysolde Marr sang it, and believed it, and went up to the Apex to enter, and was taken up. We call it ascension and we sing it louder for her.

Under the last line, in a hand that is not the Choir's, smaller: *Open, and be entered. Not the same. Leave them the comfort.*`,
  },
  {
    id: 'codex_ironclad',
    title: 'The Ironclad Nomads',
    voice: 'ironclad_telling',
    category: 'factions',
    order: 50,
    unlockWhen: MET_BRAK,
    related: ['codex_ironclad_oath', 'codex_brak_and_kaelen', 'codex_borin', 'codex_region_mistwood_reach', 'codex_region_ashen_steppe', 'codex_present_leaders'],
    body: `You'll have met Brak. Then you've met us: a camp, an axe, a man who counts what runs out. That's the Ironclad at the Reach. On the Steppe we're a people.

Here's the telling. When the city broke, the ones who got out were the ones with no magic to lose: the Watch, the forge-hands, the people who carried things. They carried a fire. Nobody now agrees whose fire it was, and Borin will tell you the fire doesn't like being asked. They crossed the Peaks with it and set it down in a warm canyon and it has not gone out since. That's the Emberforge. Everything else we are came after.

The oath: you swear to the fire and the line, and you lay down the name your father gave you and take the clan's. Stonefist, Ironvow, Varr. The old name is not forbidden. It's just not yours anymore.

The proverb: *steel sings louder than fear.* Nobody knows who said it first.

What we believe: magic is the sickness, the thing at the Apex is the sickness grown a body, and twenty of us once held a horde for a day with nothing but steel. So we know it can be held. We mean to find out if it can be killed properly.`,
  },
  {
    id: 'codex_ironclad_oath',
    title: 'The Oath and the Ember',
    voice: 'ironclad_telling',
    category: 'factions',
    order: 60,
    unlockWhen: { echo: 'echo_brak_birth_name' },
    related: ['codex_ironclad', 'codex_brak_and_kaelen', 'codex_borin', 'codex_durn_hallow', 'codex_place_emberforge', 'codex_place_hallows_cairn'],
    body: `You heard him say it. Once, in the dark, at the Ring. Don't say it back to him.

Here's why we give the name back. The oath is sworn to the fire, and the fire has a rule, and the rule is the one cut on the cairn out on the ash: *iron that does not wish*. A family name is a wish. It's a claim on land you haven't got and a grudge you didn't earn and a father's hand on your shoulder when you need both hands for the axe. So you give it back. Back, to whoever in the family is still using it. Brak gave his to his brother, who sells salt with it at the Respite.

Where the fire came from. Out of the city, in the hands of a smith called Hallow, over the Peaks and two days out onto the ash, where he died sat up against a rock with the coal still red. The forge-boys carried the coal north and set it down where the Emberforge is now, and that fire is that coal. Borin keeps it. Borin says it's older than us. Borin's right, and doesn't like it.

That's the oath. The fire took a man. We give it a name each, in return.`,
  },
] satisfies CodexEntryInput[];
