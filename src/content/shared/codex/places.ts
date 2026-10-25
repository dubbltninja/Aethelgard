// Codex II (U61), part 1: the twelve regions and the fifteen places (STORY §14.1 rows `codex_region_*` and `codex_place_*`;
// D-020 voices; every body ≤ 220 words, STORY §15.1/§15.5). Facts are WORLD §2–§3, BIBLE §2 and §5 and STORY §2–§3; where
// an entry adds texture (a survey's year, a rule of the Respite) it contradicts nothing and says nothing its unlock has not
// earned: an "Enter" entry read on Day 1 of Loop 1 does not name who the Drowned Archivist was, what the Library portal is or
// where the Ironclad's fire came from. Unlocks are §14.1's, as Conditions (D-108's readings): "Enter <location>" is
// `{ location }`; "Enter the <region>" (the Reach, the Steppe, the Veil, the Glowfen, the Skyreach) is `{ region }`, since
// each has more than one door; "Day 1" is `unlockedAtStart`; the rest are their Echoes.
import type { CodexEntryInput } from '@schema/codex';

export const placesCodex = [
  // ---- regions ---------------------------------------------------------------------------------------------------------------
  {
    id: 'codex_region_silverwood_ruins',
    title: 'The Ruins of Silverwood',
    voice: 'remnant_archive',
    category: 'places',
    order: 10,
    date: 'Year 500 of the Sundering',
    unlockedAtStart: true,
    related: ['codex_breach', 'codex_remnants', 'codex_place_shattered_library', 'codex_place_silverwood_plaza', 'codex_place_sunken_archives', 'codex_place_heartstone_depths'],
    body: `The ruin-field of Silverwood, capital of Aethelgard until Year 0. The Archive keeps the old street names. Everyone else says the Whispering Ruins and means the whole field; the Archive notes the usage and does not adopt it.

What stands, and what it was. The outskirts, where the cold fire is kept: the Outer Walks, gardens once, now twisted trees with crystal in the branches and tablets underfoot. The Crumbling Archway: the Silver Gate, nine faces on the keystone, eight worn smooth. The Darkened Corridor: the Scholars' Corridor, a covered walk, now wet, with a scorch on one wall in the shape of a hand. The Shattered Library: the Grand Library, its glass roof gone. Silverwood Plaza: the Plaza of Bells, cratered; its fountains seep mist and the air tastes of copper. The Sunken Archives: the Archives of Danthe, flooded since the first night. Heartstone Depths: the Conflux, under everything, where the ley lines meet.

Permanent twilight. The stones hum. Pages turn without hands. The order's scholars have recorded the whispers as louder every year; the present Keeper's own hand says every day. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_region_mistwood_reach',
    title: 'Mistwood and the Ironclad Reach',
    voice: 'ironclad_telling',
    category: 'places',
    order: 20,
    unlockWhen: { location: 'loc_mistwood_path' },
    related: ['codex_ironclad', 'codex_place_wayfarers_respite', 'codex_place_emberforge', 'codex_place_blighted_outpost', 'codex_brak_and_kaelen', 'codex_creatures_wilds'],
    body: `You'll have come in by the Path. Fog in the morning, fog at dusk, bark that glows a little so you don't walk into it, and the smell of crushed herbs where something went through ahead of you. That's the Mistwood. The scrap-iron cairns on the right-hand side are ours. The left side is the wood's.

Follow it up and you get the Respite, which is Kaelen's and nobody's: a wagon with the wheels chocked and a stream that runs silver. Steel and salt. Don't talk sides there.

Past that, the Camp. Brak's. Tents, barricades, an anvil going like a heartbeat. Then the Peaks, which are called Barren because they are, and the wind up there will take an arrow off its line. Then the Outpost, which is older than us and not ours whatever the map says: palisades like broken teeth, drag-marks in the dirt. Stay out of the lanes the drag-marks make.

And at the end, down in a canyon that's warm all year, the Emberforge. Borin's. The fire that came over the Peaks in a bowl. You'll smell it before you see it.

That's the Reach. North of the Respite is Ironclad. East of the Outpost's burned gate is ash, and that's another telling.`,
  },
  {
    id: 'codex_region_voidscar',
    title: 'The Voidscar',
    voice: 'weaver_fragment',
    category: 'places',
    order: 30,
    unlockWhen: { location: 'loc_chasm_of_whispers' },
    related: ['codex_weavers', 'codex_place_chasm_of_whispers', 'codex_item_void_shard', 'codex_region_veil', 'codex_creatures_hollowed'],
    body: `Stand at the lip and breathe out. The Chasm breathes in. It has done this on the hour for five hundred years and it is not breathing for you.

Below the Plaza the ground stops. This is the Voidscar: a split in the earth where the dark between is nearest the surface, near enough to put a hand on, which is why we came down. The Chasm is the mouth of it. A rope bridge crosses to the far lip, where the ground turns to glass. Past the glass, the Hollow: obsidian scree, bruised crystal, things that fray at the edges like smoke. The Shards fall there. Nothing else falls there.

Starlight by day. No weather. Frost on the hour.

She waits at the lip. Ask her for nothing you are not ready to carry. The murmurs below promise power to those who listen. They are not lying, which is the trouble with them.

At the Hollow's far edge the scree stops at a curtain of dark that moves when nothing moves it. That is the way down. You will not be let through until you are known.`,
  },
  {
    id: 'codex_region_highlands',
    title: 'The Aether-Kissed Highlands',
    voice: 'remnant_archive',
    category: 'places',
    order: 40,
    date: 'Year 500 of the Sundering',
    unlockWhen: { location: 'loc_shimmering_pass' },
    related: ['codex_dask', 'codex_place_aetherium_spires', 'codex_region_skyreach', 'codex_region_glowlands_nexus', 'codex_creatures_spireborn', 'codex_creatures_watch_wardens'],
    body: `The Aether Road, which ran from Silverwood east to the observatory, rises above the ground here, and the ground does not quite agree with it. Three places the order's surveys name: the Shimmering Pass, a cut between crystal-laced rock; the Aetherium Spires, humming in a basin; the Sky-Whisper Plateau, a shelf of wind and standing markers that looks over the whole fractured land.

Distance lies here. A survey of Year 211 measured the Pass at four hundred paces going east and six hundred coming back, and the Archive has not sent another. Light bends. Paths show that are not there, and a walker who takes one loses time and gains nothing. The Archive advises against camping where the rock is thin, and cannot say where that is.

No faction holds the Highlands. Nomad hunters cross the Plateau to the Outpost. Remnant survey cairns mark the old road, where they have not been moved.

Hunters in the Pass report a man in old leathers who is there and is not. The Archive has had the report for three generations and has not had the man. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_region_glowlands_nexus',
    title: 'The Glowlands and the Nexus',
    voice: 'remnant_archive',
    category: 'places',
    order: 50,
    date: 'Year 500 of the Sundering',
    unlockWhen: { location: 'loc_veridian_glowlands' },
    related: ['codex_place_chronos_nexus', 'codex_breach', 'codex_imre_sallow', 'codex_tovren_masque', 'codex_creatures_green', 'codex_creatures_watch_wardens', 'codex_creatures_unravelled', 'codex_region_glowfen'],
    body: `The Aether Road ends in a swamp that glows and an observatory whose dome fell inward. Above the observatory, the Apex, which the Archive treats elsewhere and briefly.

The Veridian Glowlands. A basin of water and reed that gives off a green light from under the soil. The Archive's position, held since the order's first years, is that the light is overflow from the Conflux, given to living things on the last night and carried by them since. The fen folk south along the causeway say simpler things about it and are not wrong either.

The Chronos Nexus. Tovren Masque built it to read the sky during the Holding; Hadrek the Clockwright made its orrery. The dome shattered the first night. Time buckles under it: the watch-markers flicker, a step can lose a watch or gain one, and the wardens Masque set to keep the observatory's hours keep all of them at once. Two Wayfinders died there, in Year 178 and Year 372.

Remnant astronomers kept the Nexus for a time, and stopped. The Archive does not record why. The present Keeper suspects it was the ticking.`,
  },
  {
    id: 'codex_region_silverwood_before',
    title: 'Silverwood, Three Days Before',
    voice: 'wayfinder_notes',
    category: 'places',
    order: 60,
    unlockWhen: { echo: 'echo_before_route' },
    related: ['codex_place_chronos_nexus', 'codex_anchors', 'codex_caelum', 'codex_nine_overview', 'codex_place_silverwood_plaza', 'codex_region_silverwood_ruins'],
    body: `I walked through a door in the Nexus wall and came out at the Silver Gate with the roofs on. Dawn. Bells. A gate-captain who took me for a foreign scholar and wrote me a pass without looking up.

Three days. First Bell is a festival; they ring all day and dance in the Plaza, and somebody pulled me into it. Second Bell is overcast, the bells toll single, and the Circle seals the Archive. Last Bell there are no birds, there's a hum in the ground you feel in your teeth, the ninth bell cracks on the first toll, and at dusk the Nine go down the stair.

Then it starts over. First Bell. The same dance. The same boy on the same step.

What I couldn't change: anything. I moved a cart and the cart was back. I told a man to leave the city and he was at his stall the next time round. The echo plays, and I'm the only thing in it that isn't played. Except, maybe, the chamber. I'll write that down separately when I'm sure.

The door takes a dawn going back. Every time. I counted.`,
  },
  {
    id: 'codex_region_drowned_reach',
    title: 'The Drowned Reach',
    voice: 'remnant_archive',
    category: 'places',
    order: 70,
    date: 'Year 500 of the Sundering',
    unlockWhen: { region: 'region_drowned_reach' },
    related: ['codex_place_sunken_archives', 'codex_creatures_drowned', 'codex_ilsabet_rhune', 'codex_remnant_seal', 'codex_item_lost_scroll'],
    body: `Below the Sunken Archives a stair goes down into lamplight, and below the lamplight, further. This is the undercity of Silverwood: a guildhall, cisterns, a scriptorium, a bell tower, all under black water since the first night of Year 0, when the Warden of Waters opened the cisterns to drown the Conflux's fire. The water never left.

The order keeps lamps on every ninth step. Its divers bring up vellum; the dry room above the water, Lamplighters' Rest, is where they sell it, and where the lamplighter counts the bell.

The bell. It lies on its side at the Bellmouth and it rings, on no schedule the Archive has found. When it rings, the drowned stand up.

Places of record. Tidewell Hall, where the clerks are still checking names. The Cistern of Names, every stone of it cut with one. The Sunken Scriptorium, which the divers call the Door of Pages: clear water, ink that has not run, pages in the order's own wax still being written by a hand that is not any living scribe's.

The dark below the stair is not ordinary dark. Carry a glyphed lantern or do not go. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_region_ashen_steppe',
    title: 'The Ashen Steppe',
    voice: 'ironclad_telling',
    category: 'places',
    order: 80,
    unlockWhen: { region: 'region_ashen_steppe' },
    related: ['codex_ironclad', 'codex_place_ring_of_wagons', 'codex_place_hallows_cairn', 'codex_corvin_dreyl', 'codex_creatures_wilds', 'codex_brak_and_kaelen'],
    body: `You'll come through the Scorched Gate, and Ferrin will blow two notes, and two notes will come back from a long way off. That's Hearthring saying it knows. Everything past the gate is ours.

The sky is white. It's ash. It's been coming down since the night the old city's fire turned outward and burned the plains, and it hasn't finished. Grass grows grey. The herds that didn't burn turned to stone where they stood; you'll see them in the Bone Orchard, mid-stride, with a mark burned into every flank. On the Flats the cinderbacks run in lanes, and you Guard when you hear them. On the Pan the salt will blind you at noon.

The Bone Road is the long way round, waystone to waystone. There's a short road if you know the order. Hadda knows it.

The Cairns pull lightning. Ours, built on purpose, to drag the storms down away from the herds. One of them is older than the rest and capped with a hammer-head. Don't camp near it. Camp at the Ridge, where the signal fire is and you can see the Apex as a white stain and pretend you can't.

Hearthring's in the middle. Sit. You'll smell of the Breach; everyone does who comes from the west.`,
  },
  {
    id: 'codex_region_veil',
    title: 'The Veil',
    voice: 'weaver_fragment',
    category: 'places',
    order: 90,
    unlockWhen: { region: 'region_veil' },
    related: ['codex_weavers', 'codex_place_hollow_choir', 'codex_region_voidscar', 'codex_nyxaria_vell', 'codex_creatures_hollowed'],
    body: `Come down without a light. The dark is the medium here, not the threat. You will see by it once you stop asking it to be something else.

Past the Hollow the scar goes down and the dark goes up. Black glass at the Mouth, under stars that are not ours, and two of us counting you in. A stair where each step is less there than the last; hold the thread along the wall and do not look at your feet. Then the Sanctum, which is woven, not built.

Then the places we do not take guests. A shelf where the Hollow and the Veil can be seen at once and do not meet where they should. A gallery of glass that shows nothing, where your reflection will not follow. An orchard of trees that are the absence of trees. Past all of it, the Eye, which is the deepest the scar goes, and something waiting there in her shape.

At the end, a crater. Forty paces across, forty years old. Glass that still shows stars at noon. We call it Where She Fell, and we do not go there without her leave.

Do not sleep in the Orchard. Do not say the name you were given at the Chasm to anyone below the stair.`,
  },
  {
    id: 'codex_region_glowfen',
    title: 'The Glowfen',
    voice: 'wayfinder_notes',
    category: 'places',
    order: 100,
    unlockWhen: { region: 'region_glowfen' },
    related: ['codex_place_lanternreed', 'codex_mireya', 'codex_creatures_green', 'codex_region_glowlands_nexus', 'codex_imre_sallow'],
    body: `South of the Glowlands the water deepens and the light comes up from under it. I followed the reed causeway in. The lanterns along it are lit, nobody tends them, and they have no oil.

Lanternreed stands on stilts over a pool that rises and falls like a chest. Six in, six out. Houses of reed and lantern-glass. The people are kind. They don't go out at night any more. Every one of them has a little light under the skin at the wrists and the throat, and a child showed me hers and said it meant she was chosen, and the herbalist behind her said nothing at all.

Past the village: shelves of fungus and light-dust where the moss grows; one tree older than the Sundering that answers in an old man's voice; a well of light that breathes; barrows that leak it; a white gullet of current that pulls toward a hall I did not go into the first time.

The elders say the light is the Breach's. I think they're right. I think it's been leaking since the first night, drinking them a little at a time for five hundred years, and they've been drinking it back.

They are becoming something. I don't know yet whether to stop it.`,
  },
  {
    id: 'codex_region_skyreach',
    title: 'The Skyreach',
    voice: 'ironclad_telling',
    category: 'places',
    order: 110,
    unlockWhen: { region: 'region_skyreach' },
    related: ['codex_region_highlands', 'codex_place_high_mark', 'codex_place_aetherium_spires', 'codex_creatures_spireborn', 'codex_seraphine_aulde'],
    body: `You'll have found the stair, or you wouldn't be reading this. Steps cut into moving air. They hold when a gust crosses them and not otherwise. You breathe when the wind-kin's charm says and step when the wind says, and for eleven steps you are not falling. That's the way up. Hunters who make it don't go a second time.

Above the Plateau the wind has edges. There's the crown of the tallest Spire, with a disc of crystal on top. There are roosts where the Sentinels nest, and ledges where we leave our dead to the sky; the Sentinels don't touch them, and we don't ask why. There's an eyrie of glass and brass where a woman of the old city kept looms, and the looms are still running. Nothing up there has forgotten what it was told.

And there's the Mark. A place on the stair where you look east and see the sky with a seam in it, over the Apex. The hunters say the seam is longer than it was. The hunters' fathers said the same.

Gale by default. Storm at dusk. Dawn is the only calm hour. Go at dawn, and leave your wet coat at the bottom; the lightning up there goes for whatever's soaked.`,
  },
  {
    id: 'codex_region_threshold',
    title: 'The Threshold',
    voice: 'wayfinder_notes',
    category: 'places',
    order: 120,
    unlockWhen: { echo: 'echo_threshold' },
    related: ['codex_threshold_shore', 'codex_loop', 'codex_echoes', 'codex_dask'],
    body: `This is where I go when a loop ends. Not the Ruins, not at first. Here.

Black sand. Grey water, still, with no horizon on it. No sky, but a light far out across the water, which is the only bright thing. No hunger, no clock, no wind. I arrive standing, with nothing in my hands, and I remember everything.

West along the sand there's a colonnade with one painting per loop. They're of me. They're not flattering. Under each one a plaque: how many days, and what ended it. East there's a loom of driftwood strung with threads of light; each thread is a thing I learned, and if I pull one taut it stays taut when I wake. Five coats on hooks behind it.

South is the light. I walk toward it across the water and the water holds me, and the light is a door, and the door is a morning, and the morning smells of ozone and decay.

Far out on the water a figure holds something up with both hands. It doesn't move. I haven't gone to look. The water between us shows me the last thirty days when I stand still enough to watch.`,
  },

  // ---- places ----------------------------------------------------------------------------------------------------------------
  {
    id: 'codex_place_shattered_library',
    title: 'The Shattered Library',
    voice: 'remnant_archive',
    category: 'places',
    order: 210,
    date: 'Year 500 of the Sundering',
    unlockWhen: { location: 'loc_shattered_library' },
    related: ['codex_region_silverwood_ruins', 'codex_item_echo_crystal', 'codex_remnants', 'codex_present_leaders', 'codex_maelis_korr', 'codex_ilyra'],
    body: `The Grand Library of Silverwood stood here under a roof of glass. The roof is gone. What is left: collapsed shelves in ridges of splintered wood and stone, dust in a dim glow, and pages that turn without hands. The Archive has catalogued the sound and not its cause.

Of the carrels along the north wall, one was Maelis Korr's. The books he kept there are not there. The order has recovered three from other places and shelves them apart, under seal, because of what reading them costs.

In an alcove behind the fallen stacks, in a cradle of stone, the Echo Crystal. The order has known where it lies since its first years and has not brought it out. The present Keeper's explanation is that the stacks fell across the alcove and what lives in the stacks does not read.

The Keeper camps in the reading-room, where the Ledger is kept. The order's standing instruction, older than any living Keeper, is that when the east comes, the order runs to the Library. The instruction gives no reason. The Archive has kept it anyway. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_place_silverwood_plaza',
    title: 'Silverwood Plaza',
    voice: 'remnant_archive',
    category: 'places',
    order: 220,
    date: 'Year 500 of the Sundering',
    unlockWhen: { location: 'loc_silverwood_plaza' },
    related: ['codex_region_silverwood_ruins', 'codex_region_silverwood_before', 'codex_remnants', 'codex_present_leaders', 'codex_durn_hallow'],
    body: `The Plaza of Bells. Fountains ran here; nine bells hung in a ring; the Watch kept a post on the east side and a bellwright kept a stall. The city told time by the bells, and the Archive's account of the last night is kept in bells also: the ninth bell, dusk.

Now a cratered ring of marble. The fountains seep a mist that shimmers; the air tastes of copper. The order's scribe sets a table on the fountain's rim and weighs ink against salt. The Weavers watch the east edge. The Nomads will not come onto it.

Wild magic surges here without warning. When it does, a chorus of distant bells rings out and fades. The Archive has recorded the chorus four hundred and nine times and holds the bells to have been melted or taken in the first years; no bell has been found. The ninth bell, the order's oldest entries say, was flat. The bellwright had told them so.

When the east comes, it comes onto the Plaza last and slowly, by the road from the Mistwood. The scribe keeps her stall packed. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_place_sunken_archives',
    title: 'The Sunken Archives',
    voice: 'remnant_archive',
    category: 'places',
    order: 230,
    date: 'Year 500 of the Sundering',
    unlockWhen: { location: 'loc_sunken_archives' },
    related: ['codex_region_silverwood_ruins', 'codex_region_drowned_reach', 'codex_creatures_drowned', 'codex_remnants', 'codex_item_lost_scroll', 'codex_oriel_danthe'],
    body: `The Archives of Danthe, where the Circle's archivist kept the records of Silverwood's learning in dry vaults. The vaults are half-buried now and the water in them is brackish. The shelves sag under tomes soaked for five hundred years. A slow drip marks time, and the ley lines glow through the flood.

The flood came on the first night, when the ley-water rose through the floor. The Archive holds this to be the night the order began: the junior keepers who dug these vaults out in the years after were the first Remnants. They found the record of the rite here, sealed. They found the seal.

What else they found: the Drowned. Hunched, robed, dripping, still at the shelves. The Archive's position is that they are what remains of the scholars who stayed with the books, and that they can be read to as well as fought. One of them keeps a carrel under the east stair and has not finished its page. The order has not identified it. The present Keeper has a suspicion and has not entered it.

A stair goes down to the west, its lower steps lit by something that is not the ley. The order keeps a lantern at its top. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_place_heartstone_depths',
    title: 'Heartstone Depths',
    voice: 'remnant_archive',
    category: 'places',
    order: 240,
    date: 'Year 500 of the Sundering',
    unlockWhen: { location: 'loc_heartstone_depths' },
    related: ['codex_item_heartstone', 'codex_durn_hallow', 'codex_anchors', 'codex_region_silverwood_ruins', 'codex_breach_clock'],
    body: `The Conflux. The Archive's full name for it is the Ley Line Conflux: the chamber under the Archives where every ley line in the kingdom met in a living core the Circle called the Heartstone. The way down is through the Archives, and then the ground opens.

The Heartstone is there. Cracked, beating, each beat a ripple in the air that shakes dust from the ceiling. Nine plinths stand around it, eight empty. At its foot, the remains of an iron cradle, burst outward. The Archive has the smith's name from the record: Durn Hallow, who made the cradle and asked that it be iron that did not wish. The record says it took the stone's weight at the fourth verse and did not hold it at the ninth. The Archive notes that the smith had said stop, two verses earlier.

The stone's beat is the oldest measured thing the order has. A Keeper with a water-clock can count it, and the present Keeper does, every year. The count drifts. From what, the Archive does not yet say.

What might be done to the stone, the Archive does not advise. It has been soothed, seized and shattered in the order's imagination for five hundred years. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_place_chasm_of_whispers',
    title: 'The Chasm of Whispers',
    voice: 'weaver_fragment',
    category: 'places',
    order: 250,
    unlockWhen: { location: 'loc_chasm_of_whispers' },
    related: ['codex_region_voidscar', 'codex_weavers', 'codex_item_void_shard', 'codex_nyxaria_vell', 'codex_place_hollow_choir'],
    body: `Stand where the ground stops. Not nearer. The Chasm breathes in on the hour, and nothing that goes down with the breath comes up the same shape.

Why it breathes cold. Because the dark between is cold, and this is where it lies nearest the surface. The rift is a mouth, and a mouth breathes. The murmurs that rise from it promise power to those who listen. They are the Breach talking in its sleep. Do not answer. Listening is enough.

She waits at the lip. She has waited there forty years. She will ask you for three Shards and tell you nothing about why, and if you bring them she will tell you a little, and if you do not she will remember.

A rope bridge crosses to the far side, where the ground turns to glass. The bridge holds. It has always held. We do not know who hung it and we do not replace the rope.

This is where we meet outsiders. Nothing past the bridge is for outsiders. Cross it and come back, and you are something else, and we will treat you so.`,
  },
  {
    id: 'codex_place_emberforge',
    title: 'The Emberforge',
    voice: 'ironclad_telling',
    category: 'places',
    order: 260,
    unlockWhen: { location: 'loc_emberforge' },
    related: ['codex_region_mistwood_reach', 'codex_borin', 'codex_ironclad', 'codex_ironclad_oath', 'codex_item_breach_anchor', 'codex_place_hallows_cairn'],
    body: `You'll have felt the heat before the canyon opened. That's the forge. A warm cavern, walls veined with ember-bright stone, heat breathing up from below, and a hammer going.

Here's the telling. When the city broke, the ones who got out carried a fire with them, over the Peaks, and set it down here because here was warm already. Why it was warm already is a question Borin doesn't like. Something runs under this canyon. The veins in the wall pulse in time with it, and it's a long way south-west of here, and Borin can tell you what it's doing tonight if you ask him plain.

The fire has not gone out since. Not once. Not in the Day of Teeth, not in the lean years. Borin keeps it now. Somebody has always kept it, back to a smith nobody names, who isn't in any of our songs and should be.

The Emberforge is the only forge there is. Anything you want made properly gets made here or not at all. You'll pay in ore and coin and patience, in that order. The void-forged work Borin won't do for a stranger. The rest he will.

Speak plain when you get there. He does.`,
  },
  {
    id: 'codex_place_blighted_outpost',
    title: "Vane's Watch",
    voice: 'ironclad_telling',
    category: 'places',
    order: 270,
    unlockWhen: { echo: 'echo_stone_hide_origin' },
    related: ['codex_haldric_vane', 'codex_creatures_wards', 'codex_tobrin_vask', 'codex_region_mistwood_reach', 'codex_region_ashen_steppe'],
    body: `You'll have read the mark on their brows by now, or had it read to you: a square inside a circle. A warder's seal. So here's what the Outpost was, since the map won't tell you.

It wasn't ours. It was never ours. Before the city broke, a mage called Vane, the one they call the Warder, set stone men on the ley-knot north of the city to keep it, and built them a palisade and a gate with a bull on it facing east. Vane's Watch. The stone men were made to shrug off magic, which is why yours will skitter off them. When the city broke they turned to face outward and locked on the one order, and they've held it five hundred years: *guard*. They're not blighted. They're obedient.

That's why the drag-marks run in lanes. They're patrolling. They're patrolling a watch nobody set and nobody can stand down. Except somebody can. The warder's word, said right, stills them. Brak won't say it. Borin says it isn't steel and he won't learn it. I'd learn it.

The gate in the east wall burned the night the plains did. Past it the land goes grey, and that's a different telling.`,
  },
  {
    id: 'codex_place_chronos_nexus',
    title: 'The Chronos Nexus',
    voice: 'remnant_archive',
    category: 'places',
    order: 280,
    date: 'Year 500 of the Sundering',
    unlockWhen: { any: [{ location: 'loc_chronos_nexus' }, { echo: 'echo_hadrek_clockwright' }] }, // + STORY §12: the Clockwright's Key says "codex" (D-108)
    related: ['codex_region_glowlands_nexus', 'codex_tovren_masque', 'codex_item_chronos_lens', 'codex_creatures_watch_wardens', 'codex_seven_wayfinders', 'codex_region_silverwood_before'],
    body: `Tovren Masque's observatory, built at the end of the Aether Road to read the sky during the Holding, under a dome that fell inward the first night. The order's astronomers kept it for a time after. Their last entry is Year 61 and says only *the clocks disagree*.

Time buckles here. The watch-markers flicker. A walker loses a watch or gains one; the Archive measured the losses and gains over a season and found them equal, which it did not find reassuring. Past and future flicker on the cracked stone, and a visitor may hear a voice over their own, warning of a choice already made.

The orrery is Hadrek the Clockwright's. A brass plate names him. It has been polished recently, and not by the order. The Lens, Masque's, is kept in the orrery's housing. The order has never taken it. The Keeper's note on the matter says the Nexus should keep its eye.

In the east wall, a door with no handle, and the stone around it new. The Archive has no entry on the door.

Two Wayfinders died under this dome: Corwen Blackreed, Year 178, whose axe is still here, and Rook Tallis, Year 372. Above is the Apex. On the Apex the Archive advises nothing the Ledger does not already say. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_place_aetherium_spires',
    title: 'The Aetherium Spires',
    voice: 'weaver_fragment',
    category: 'places',
    order: 290,
    unlockWhen: { location: 'loc_aetherium_spires' },
    related: ['codex_region_highlands', 'codex_seraphine_aulde', 'codex_creatures_spireborn', 'codex_region_skyreach', 'codex_litany_5'],
    body: `Stand in the basin and hum. Whatever note you choose, the Spires will correct it. They have one note and they are patient.

She raised them, the one of the Nine who built. Tuning forks the height of towers, crystal, set in a ring to lift the ley lines and sing them one note. They answered her on the last night: the sky went silver-white over the city, and children were lifted onto shoulders to see it, and the Spires have not stopped answering. Cracked, every one. Still humming.

What drifts between them trailing light: strands off her loom, carrying the note. Do not confuse them with us. They will pass you by the first time if you have heard what they carry. They will not pass you by the second.

The shards that lie in the basin are the Spires' own. Pick them up; they are the only part of her you can carry. The tallest Spire has steps cut into its flank, spiralling up out of sight. Up is the Skyreach. Up is where the looms are.

Do not sleep in the basin. The note gets into the teeth, and the dark cannot get in past it, and you will wake deaf to us.`,
  },
  {
    id: 'codex_place_wayfarers_respite',
    title: "The Wayfarer's Respite",
    voice: 'ironclad_telling',
    category: 'places',
    order: 300,
    unlockWhen: { location: 'loc_wayfarers_respite' },
    related: ['codex_region_mistwood_reach', 'codex_brak_and_kaelen', 'codex_ironclad', 'codex_remnants', 'codex_weavers'],
    body: `You'll have been told it's neutral ground, and it is, and here's what that costs. Kaelen Stonehand came out of the Nomads with his father's name still on him, put a wagon down between the cliffs where the stream runs silver, chocked the wheels, and started selling. Salt from the Steppe pans. Ink from the Remnant scribes. Rivets, rope, whatever walked in. Steel and salt, he says. He means: I'll sell to either side, I'll weigh it fair, and I'll not carry your news.

The stream quiets your head. That's not Kaelen's doing; it was like that before him. A distant hum never quite fades. That's the Reach, under everything.

Rules of the Respite. No blades drawn. No sides at the counter. Pay in coin or in something he can weigh. Don't ask him about the Camp. He looks east at it sometimes, long, and then doesn't, and that's the whole of what he'll say on the subject.

Last to fall when the east comes, because it's furthest from everything. If you're running, run here and keep running.

The Remnants send scribes to trade ink for salt. The Weavers come at night. We come when we need rivets. Everybody comes.`,
  },
  {
    id: 'codex_place_lanternreed',
    title: 'Lanternreed',
    voice: 'wayfinder_notes',
    category: 'places',
    order: 310,
    unlockWhen: { location: 'loc_lanternreed' },
    related: ['codex_region_glowfen', 'codex_mireya', 'codex_creatures_green', 'codex_present_leaders'],
    body: `Stilts over the pool. Reed walls, lantern-glass windows, walkways that creak in time with the water's breathing. Nobody tends the lanterns and they don't go out.

People. An old man who says *not yet* to everything, whom the big tree answers in his own voice. An older woman at the Pool who says *no*. A trader with moss at three a bundle, who swaps it for Nomad salt through baskets lowered down the Reedmarch and has never met a Nomad. A herbalist with shining forearms who told me to sit *down* before she told me her name. Mireya. The sick are hers. She wants Glow Moss and bitterroot and nothing else from anyone.

Neutral ground. All three factions come here and none of them stays the night. The fen folk don't go out after dark either. I asked why. *Not yet.*

The light under their skin is brightest at the wrists and the throat. A child told me it means she's chosen. Mireya said nothing. I asked the old woman at the Pool, and she said the old ways keep the light, and I think she meant it as the opposite of a warning.

They say it was dimmer in their grandparents' time. I'm going to watch it.`,
  },
  {
    id: 'codex_place_ring_of_wagons',
    title: 'The Ring of Wagons',
    voice: 'ironclad_telling',
    category: 'places',
    order: 320,
    unlockWhen: { location: 'loc_hearthring' },
    related: ['codex_region_ashen_steppe', 'codex_ironclad', 'codex_present_leaders', 'codex_brak_and_kaelen', 'codex_place_emberforge'],
    body: `You'll smell of the Breach when you come in. Everyone does who comes from the west. Oma Varr will say so without looking up, and tell you to sit, and you sit.

Hearthring. A ring of standing stones with a fire in the middle that has not gone out in four hundred years, lit from the last ember of the Burned Hall. Hide tents leaning on the stones. Children, dogs, a forge-wagon, a bull's skull on a pole. The clan-mother sits with her back to the fire and her eyes on the gate. That's Hadda Ironvow. She has two hundred who'll follow her east on a word, and she remembers that twenty held the Nexus once for a day, and she does the arithmetic out loud.

Who else. Tessaly Varr, who runs the caravans and sells rivets by the fist. Ketch, who has the drum and sings the Day of Teeth, and knows a verse about two brothers he'll stop singing if he sees your face. Oma, who knew the Stonehand boys when they were boys and doesn't care who hears it.

The Remnants write *the Ring of Wagons* on their maps. There are wagons. Nobody here calls it that.

Brak's from here. When he's not at the Camp, he's here, with his back to the same fire.`,
  },
  {
    id: 'codex_place_hollow_choir',
    title: 'The Hollow Choir',
    voice: 'weaver_fragment',
    category: 'places',
    order: 330,
    unlockWhen: { location: 'loc_sanctum_of_threads' },
    related: ['codex_region_veil', 'codex_weavers', 'codex_weaver_choir', 'codex_item_void_shard', 'codex_present_leaders', 'codex_litany_8'],
    body: `Come in by the stair and hold the thread the whole way. Let go at the door. Inside, the thread is the building.

A hall woven, not built. Grey and violet from wall to wall in thousands, and the walls are more thread, and we sit in the web and work. At the centre an old woman with no eyes holds the one thread all the others are tied to. She is the Thread-Mother. She will feel what you are before you speak. If she says you are knotted, you are.

On the east wall, worked in thread the colour of the rest, nine names. The Nine. The eighth is picked out in a thread that is not grey, and hers is the verse the Choir sings, every night, over a Shard, until the Shard answers.

The Unlidded one keeps the rite. She cut her eyelids away to watch between moments. Do not pity her. She would not know what to do with it.

The quartermaster sells the thread. The dark is free.

This is the Hollow Choir. Outsiders call it the Sanctum. Call it what you like below the stair, and nothing at all above it.`,
  },
  {
    id: 'codex_place_hallows_cairn',
    title: "Hallow's Cairn",
    voice: 'ironclad_telling',
    category: 'places',
    order: 340,
    unlockWhen: { echo: 'echo_hallows_ember' },
    related: ['codex_durn_hallow', 'codex_ironclad_oath', 'codex_place_emberforge', 'codex_region_ashen_steppe', 'codex_litany_4', 'codex_item_breach_anchor'],
    body: `You'll have put your hand under the ash by now and felt it warm. Five hundred years. Still warm.

One cairn stands apart from the rest at Stormgate: older, capped with a hammer-head where the others carry a spike. The spiked ones are ours, built to drag the lightning down away from the herds. The hammer-head one we found. The forge-boys who built it were the first of us, before there was an us, and they built it the way smiths build: square, tight, no mortar.

Here's what's under it. A smith of the old city, two days out from the Peaks on foot, carrying a coal in a clay bowl with hands that were already gone. He sat down against a rock. He didn't put the bowl down. They found him sat up with the coal still red, and they took the bowl from him, and they piled the rock over him, and they carried the coal north. That's the fire at the Emberforge.

The words cut on the inside of the cairn, where you have to lie down to read them: *iron that does not wish*. Borin has the same mark on his forge. Nobody told him what it meant. Show him.

Steel sings louder than fear. He said that too. Not about steel.`,
  },
  {
    id: 'codex_place_high_mark',
    title: 'The High Mark',
    voice: 'wayfinder_notes',
    category: 'places',
    order: 350,
    unlockWhen: { echo: 'echo_high_mark' },
    related: ['codex_region_skyreach', 'codex_breach', 'codex_breach_clock', 'codex_place_aetherium_spires'],
    body: `Eleven steps where I wasn't falling. The Talisman told me when to breathe and the wind told me when to step, and between the two of them I got up the Windward Stair, and at the top of the eleventh there's a place where the rock turns east and you can see it.

The sky has a seam. Over the Apex, east, a line in the air where the two halves of the sky don't quite meet, the way a badly set bone doesn't. White at the edges. It moves like breathing. From the Ridge on the Steppe it looks like a stain; from here it looks like what it is.

The hunters call this the High Mark. They say it's longer than it was. Their fathers said the same thing, and I believe both of them.

I stood there a watch and counted. I don't know what I was counting yet. The Heartstone's beat, maybe, in my own pulse, and the seam's breathing against it. They weren't the same. They were nearly the same.

For next time: the stair opens without the Talisman now. I know when to step. I don't know how I know.`,
  },
] satisfies CodexEntryInput[];
