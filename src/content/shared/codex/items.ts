// Codex II (U61), part 4: the eight item entries (STORY §14.1 rows `codex_item_*`; D-020 voices; every body ≤ 220 words).
// Facts are BIBLE §6.2 and STORY §2. `codex_item_void_shard` is STORY §14.2's sample text, verbatim. Unlocks are §14.1's:
// "Take the X" and "Hold one" are `{ item }` (inventory, satchel or equipped); "Forge it" is holding the anchor; "Reach the
// Depths" is standing there or `echo_heartstone_path` (D-108's "Reach the Apex" reading); "Day 1" is `unlockedAtStart`;
// "Read one" has no condition atom (reading is an `onUse`), so the Dark Spellbook and Korr's Marginalia carry an
// `unlockCodex` effect in items/quest.ts, the way the three D-108 tomes do. Four STORY §12 Echoes whose "Unlocks" cell says
// "codex" and that §14.1 gives no row (D-108 flagged Hadrek's) are alternates on the entry they are about: the Crystal's
// unfinished ninth voice, the Three Beats, Shards Are Moments here; the Day of Teeth (creatures.ts); the Clockwright's Key
// (places.ts, the Nexus).
import type { CodexEntryInput } from '@schema/codex';

export const itemsCodex = [
  {
    id: 'codex_item_amulet',
    title: 'The Amulet of Echoes',
    voice: 'wayfinder_notes',
    category: 'items',
    order: 10,
    unlockedAtStart: true,
    related: ['codex_wayfinder_nature', 'codex_breach', 'codex_loop', 'codex_echoes', 'codex_region_silverwood_ruins'],
    body: `Found it in the first room, among the tablets, where the cold fire is. It was warm. Nothing else there was.

A disc on a cord, dark metal, with a seam across the face that doesn't open. The Remnant woman at the fire said *tied to the Great Sundering* the way you say a thing you've read and not understood, and then looked at me as if I had.

What it does, as far as I can tell today: it hums when the stones hum. It pulls east. Near a place where something was said, it pulls harder. It gives me a bolt of ley I didn't have yesterday, which is not nothing.

What I think it is: a thing that holds what it hears. Everything here whispers. This is a whisper you can carry.

I'm not taking it off. I tried. My hands wouldn't.

For later: it's warm every morning before I touch it. Every morning. I don't know what that means yet. I think it remembers.`,
  },
  {
    id: 'codex_item_echo_crystal',
    title: 'The Echo Crystal',
    voice: 'remnant_archive',
    category: 'items',
    order: 20,
    date: 'Year 500 of the Sundering',
    unlockWhen: { any: [{ item: { id: 'item_echo_crystal' } }, { echo: 'echo_crystal_location' }, { echo: 'echo_ninth_verse_unfinished' }] }, // + STORY §12: the Crystal's unfinished ninth voice says "codex"
    related: ['codex_oriel_danthe', 'codex_place_shattered_library', 'codex_litany_1', 'codex_nine_overview', 'codex_ilyra'],
    body: `The Echo Crystal: a shard of pale crystal the length of a forearm, on a stand of stone, in the third alcove of the Shattered Library behind the fallen stacks. The order has known where it lies since its first years.

What it is, as the record has it. The Archivist of the Circle set it on its stand in the Conflux on the last night to hold the rite as it was spoken, so that what was done would be written as it was done. It woke at her voice. It heard nine. It holds nine.

No Keeper has made it speak. It has been held to the ear, warmed, cooled, sung to and read to by those of the order who reached the alcove, and it has given them nothing but the sense, which each recorded without knowing the others had, that it is listening. The Archive's position is that it answers a voice it knows.

What the order will do with it: shelve it under seal, and listen. What the Weavers would do with it, the Archive does not record. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_item_lost_scroll',
    title: "The Scholar's Lost Scroll",
    voice: 'remnant_archive',
    category: 'items',
    order: 30,
    date: 'Year 500 of the Sundering',
    unlockWhen: { item: { id: 'item_scholars_lost_scroll' } },
    related: ['codex_oriel_danthe', 'codex_remnant_seal', 'codex_place_sunken_archives', 'codex_ilyra', 'codex_litany_1'],
    body: `The Scholar's Lost Scroll, as the order's lists have it: a roll of vellum in a case, kept in the carrel under the east stair of the Sunken Archives, sealed in grey-brown wax with the order's own device, an open book under three wavy lines.

It is the record of the rite. The Archivist of the Circle wrote it as the Litany was spoken and carried it out of the chamber when she was told to. The Archive's account of the last night is drawn from it and from the Crystal together. It was sealed with the water rising. The seal has never been broken; the order copies from a copy made in Year 3 by a keeper who broke a different one.

The Archive notes that the scroll has stood on the order's lists as *lost* for longer than the present Keeper has held the Ledger, that the order has always known where it is, and that the reader in the carrel does not give it up. A scholar of the order has asked for its return every year of her service. The Archive notes also that she asks as if it were hers. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_item_dark_spellbook',
    title: 'The Dark Spellbooks',
    voice: 'weaver_fragment',
    category: 'items',
    order: 40,
    // "Read one": the `unlockCodex` on item_dark_spellbook's and item_korrs_marginalia's onUse (items/quest.ts)
    related: ['codex_maelis_korr', 'codex_creatures_hollowed', 'codex_litany_2', 'codex_place_shattered_library', 'codex_weavers'],
    body: `Open it and pay. That is the whole of the instruction, and you have already paid, or you would not be reading this.

His workbooks. The one of the Nine called the Lesson wrote everything down and read everything twice, and believed a thing learned was a thing owed, and the books collect the debt. Charred at the edges, every one, though no fire reached them. The pages take blood and give back the ability to do what the page says. The margins are in his hand. The margins are still in his hand; look at one in a good light and the ink has not dried.

Read one, and you are owed a little less by the world. Read three in one turning of the days, and the margins line up and say something between them that none of them says alone.

The Shades in the Corridor carry them because the Shades were his students. The quartermaster at the Sanctum sells them because we are not his students, and we read anyway.

What is read is owed. It is not a warning. It is a price list.`,
  },
  {
    id: 'codex_item_chronos_lens',
    title: 'The Chronos Lens',
    voice: 'remnant_archive',
    category: 'items',
    order: 50,
    date: 'Year 500 of the Sundering',
    unlockWhen: { item: { id: 'item_chronos_lens' } },
    related: ['codex_tovren_masque', 'codex_place_chronos_nexus', 'codex_litany_7', 'codex_region_silverwood_before', 'codex_creatures_watch_wardens'],
    body: `The Chronos Lens: a disc of black glass in a brass rim, kept at the Nexus in an eyepiece housing on the orrery. Tovren Masque's, made for him by the Clockwright. Through it, the order's older entries say, the astronomer read the sky during the Holding, and read it twice.

What it does. It focuses time's echo. Hold it to the eye at the Nexus and the flicker of past and future on the stone resolves into one of them. Hold it at dawn and the sky through it is the sky of another hour. The Archive has one report, of Year 178, from a Nomad who held it toward the Apex and saw the figure there *from the far side of something*, and put it down, and would not pick it up again.

The order has never kept it. It is heavier than it looks, and the Keeper's note on the matter says the Nexus should keep its eye.

The record of the rite says the seventh verse was read through it. The Archive does not say what was read. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_item_heartstone',
    title: 'The Heartstone',
    voice: 'remnant_archive',
    category: 'items',
    order: 60,
    date: 'Year 500 of the Sundering',
    unlockWhen: { any: [{ location: 'loc_heartstone_depths' }, { echo: 'echo_heartstone_path' }, { echo: 'echo_heartstone_triune' }] }, // + STORY §12: the Three Beats says "codex"
    related: ['codex_place_heartstone_depths', 'codex_durn_hallow', 'codex_breach_clock', 'codex_item_breach_anchor', 'codex_litany_4'],
    body: `The Heartstone: the living core of the Conflux, where every ley line in the kingdom met, and meets. Not cut, not made. The Circle found it under the Archive and built the city's learning over it.

On the last night it sat in an iron cradle, Durn Hallow's, that took its weight at the fourth verse. At the sixth it cracked, a hairline, with a sound the record likens to a tooth breaking. At the ninth it burst the cradle. It is cracked now, and it beats. Each beat ripples the air. The Archive holds the beat to be the oldest measured thing in the world, and measures it with a water-clock once a year, and has for some years found the count drifting.

What might be done to it. The Archive is aware of three positions and holds none. The Weavers would exploit it: let it take, and take from it. The Nomads would shatter it: the sickness has a heart, cut it out. The order's own younger members would soothe it: steady the beat and leave it be. The present Keeper notes that all three parties agree the stone must be touched, and that in five hundred years nobody has. — *Keeper's hand, Year 500.*`,
  },
  {
    // STORY §14.2, verbatim
    id: 'codex_item_void_shard',
    title: 'Void Shards',
    voice: 'weaver_fragment',
    category: 'items',
    order: 70,
    unlockWhen: { any: [{ item: { id: 'item_void_shard' } }, { echo: 'echo_shard_moments' }] }, // + STORY §12: Shards Are Moments says "codex"
    related: ['codex_weavers', 'codex_weaver_choir', 'codex_region_voidscar', 'codex_nyxaria_vell', 'codex_creatures_hollowed', 'codex_item_breach_anchor'],
    body: `A shard of condensed shadow that promises power. That is what the Archive wrote, and the Archive is not wrong, only deaf.

Hold one to your eye in the dark. There: a stair. A boy on the third step. A bell, mid-ring, that will not finish ringing. Each Shard is a moment torn from the night the hour tore, and each one is the same night, and each one is a different second of it. The Choir has gathered eleven thousand seconds and the night is not yet whole.

They fall from the Breach the way tears fall: without being asked. The Hollow is where they land because the Hollow is where *she* landed, and the dark remembers the shape of what it has held.

Do not keep more than three. Three is a verse. Four is a sentence you did not mean to say.`,
  },
  {
    id: 'codex_item_breach_anchor',
    title: 'The Breach-Anchor',
    voice: 'ironclad_telling',
    category: 'items',
    order: 80,
    unlockWhen: { item: { id: 'item_breach_anchor' } },
    related: ['codex_borin', 'codex_place_emberforge', 'codex_ironclad_oath', 'codex_durn_hallow', 'codex_seraphine_aulde', 'codex_tobrin_vask', 'codex_item_heartstone'],
    body: `You'll have made it by now, at Borin's fire, with Borin swearing at the Shards, so you know what went in. Aetherium from the Spires, so the ley has something to run through. A piece of the Heartstone, steadied first, so the ley has something to run *to*. Void Shards, because the thing at the Apex is half dark and the anchor has to know what dark feels like from the inside. Three ember ore. Silverwood heartwood, off a golem or from Kaelen or from the city with its roofs on, and don't tell Borin which. And the forging itself, which is the part that matters: iron that does not wish.

Here's what that means. Everything else you'll carry wants something. A blade wants to cut. A shield wants to be hit. This wants nothing. It's a weight. You drive it into the Apex floor and it holds what it's holding and doesn't care what that is.

The design was the spire-builder's, in two halves: one in her eyrie, one with a ward-engineer's apprentice who had the sense to hide a copy. Borin had the last line of the recipe on his forge the whole time and didn't know it.

Two uses the tellers know of. Hadda's: cut the ley with it. The other's quieter. Borin won't say it aloud.`,
  },
] satisfies CodexEntryInput[];
